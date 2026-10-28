
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  guardarMateriasLocales,
  obtenerMateriasLocales,
} from '../../database/localDatabase';

import {
  guardarMateriasOffline,
} from '../database/offlineDatabase';

import { Ionicons } from '@expo/vector-icons';

// AULA-AI | HU-07
// Consulta de materias con soporte offline.
// Conserva la consulta del docente de HU-03.

const TIMEOUT_MS = 8000;

const consultarAPI = async (url, accessToken) => {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(
        data.message ||
          'No fue posible completar la consulta.'
      );

      error.status = response.status;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
};

const adaptarMateriaLocal = (item) => ({
  id: item.id,
  materia: {
    nombre: item.nombre,
  },
  grado: {
    nombre: item.grado,
  },
  grupo: {
    nombre: item.grupo,
  },
  periodo: {
    nombre: item.periodo,
  },
  periodo_id: item.periodo_id,
  estado: item.estado,
  docentesTexto: item.docentes,
  esOffline: true,
});

const obtenerPeriodosLocales = async (usuarioId) => {
  const materias = await obtenerMateriasLocales(
    usuarioId
  );

  const periodosPorId = new Map();

  for (const materia of materias) {
    const id = Number(materia.periodo_id);

    if (
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      continue;
    }

    if (!periodosPorId.has(id)) {
      periodosPorId.set(id, {
        id,
        nombre:
          materia.periodo ||
          `Periodo ${id}`,
        esActual: false,
        finalizado: false,
        futuro: false,
        esOffline: true,
      });
    }
  }

  return [...periodosPorId.values()].sort(
    (a, b) => a.id - b.id
  );
};

const datosMateria = (item) => {
  if (item.materia_nombre) {
    return {
      id: item.id,
      nombre: item.materia_nombre,
      grado: item.grado_nombre,
      grupo: item.grupo_nombre,
      periodo: item.periodo_nombre,
      estado: item.estado,
    };
  }

  const asignacion = item.asignacion || item;

  return {
    id: asignacion.id,
    nombre:
      asignacion.materia?.nombre || '',
    grado:
      asignacion.grado?.nombre || '',
    grupo:
      asignacion.grupo?.nombre || '',
    periodo:
      asignacion.periodo?.nombre || '',
    estado:
      asignacion.estado || 'activa',
  };
};

export default function MySubjectsScreen({
  accessToken,
  apiUrl,
  endpoint,
  usuarioId,
  tipoUsuario,
  title,
  onBack,
}) {
  const esEstudiante =
    tipoUsuario === 'estudiante';

  const [materias, setMaterias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modoOffline, setModoOffline] =
    useState(false);

  const [periodos, setPeriodos] = useState([]);
  const [
    periodoSeleccionado,
    setPeriodoSeleccionado,
  ] = useState(null);

  const [
    cargandoPeriodos,
    setCargandoPeriodos,
  ] = useState(esEstudiante);

  const [
    errorPeriodos,
    setErrorPeriodos,
  ] = useState(null);

  const [errorMaterias, setErrorMaterias] =
    useState(null);

  const [ultimaActualizacion, setUltimaActualizacion] =
    useState(null);

  const [origenPeriodos, setOrigenPeriodos] =
    useState(null);

  const solicitudMateriasId = useRef(0);
  const solicitudPeriodosId = useRef(0);

  // ------------------------------------------------
  // PERIODOS:
  // Primero recuperamos los datos disponibles
  // en SQLite y luego intentamos actualizarlos
  // con el backend.
  // ------------------------------------------------

  const cargarPeriodosDisponibles = useCallback(
    async () => {
      if (!esEstudiante) {
        return;
      }

      const solicitudId =
        ++solicitudPeriodosId.current;

      setCargandoPeriodos(true);
      setErrorPeriodos(null);

      let periodosGuardados = [];

      try {
        if (usuarioId && accessToken) {
          periodosGuardados =
            await obtenerPeriodosLocales(
              usuarioId
            );

          if (
            solicitudId !==
            solicitudPeriodosId.current
          ) {
            return;
          }

          if (periodosGuardados.length > 0) {
            setPeriodos(periodosGuardados);
            setOrigenPeriodos('sqlite');

            setPeriodoSeleccionado(
              (anterior) => {
                if (
                  periodosGuardados.some(
                    (p) => p.id === anterior
                  )
                ) {
                  return anterior;
                }

                return periodosGuardados[0].id;
              }
            );
          }
        }
      } catch (errorSQLite) {
        console.warn(
          'HU-07: no se pudieron leer los periodos locales:',
          errorSQLite.message
        );
      }

      try {
        if (!accessToken || !apiUrl) {
          throw new Error(
            'No hay una sesión válida.'
          );
        }

        const data = await consultarAPI(
          `${apiUrl}/api/academic/periodos-disponibles`,
          accessToken
        );

        if (
          solicitudId !==
          solicitudPeriodosId.current
        ) {
          return;
        }

        const lista = Array.isArray(data.periodos)
          ? data.periodos
          : [];

        setPeriodos(lista);
        setOrigenPeriodos('servidor');
        setErrorPeriodos(null);

        setPeriodoSeleccionado((anterior) => {
          const periodoActual = lista.find(
            (p) => p.esActual
          );

          // Conservamos la selección previa
          // cuando todavía es válida.
          if (
            lista.some(
              (p) => Number(p.id) === anterior
            )
          ) {
            return anterior;
          }

          return periodoActual?.id != null
            ? Number(periodoActual.id)
            : null;
        });
      } catch (error) {
        if (
          solicitudId !==
          solicitudPeriodosId.current
        ) {
          return;
        }

        // Una sesión rechazada no debe utilizar
        // la caché para seguir mostrando datos.
        if (
          error.status === 401 ||
          error.status === 403
        ) {
          setPeriodos([]);
          setPeriodoSeleccionado(null);
          setOrigenPeriodos(null);
          setMaterias([]);

          setErrorPeriodos(
            'Tu sesión no es válida o no tienes permiso. Vuelve a iniciar sesión.'
          );

          return;
        }

        if (periodosGuardados.length > 0) {
          setErrorPeriodos(
            'Sin conexión. Puedes consultar los periodos y materias descargados previamente.'
          );

          setOrigenPeriodos('sqlite');
        } else {
          setErrorPeriodos(
            'No hay conexión y todavía no tienes periodos académicos guardados en este dispositivo.'
          );
        }
      } finally {
        if (
          solicitudId ===
          solicitudPeriodosId.current
        ) {
          setCargandoPeriodos(false);
        }
      }
    },
    [
      esEstudiante,
      usuarioId,
      accessToken,
      apiUrl,
    ]
  );

  // ------------------------------------------------
  // MATERIAS:
  // Se leen desde SQLite primero y luego se
  // actualizan desde el servidor.
  // ------------------------------------------------

  const cargarMaterias = useCallback(
    async () => {
      const solicitudId =
        ++solicitudMateriasId.current;

      setCargando(true);
      setErrorMaterias(null);

      if (
        esEstudiante &&
        periodoSeleccionado == null
      ) {
        setMaterias([]);
        setModoOffline(false);
        setCargando(false);
        return;
      }

      let materiasGuardadas = [];
      let copiaLocalDisponible = false;

      try {
        if (!usuarioId || !accessToken) {
          throw new Error(
            'No hay una sesión válida.'
          );
        }

        // Recuperar la copia local del periodo
        // seleccionado antes de consultar la red.
        try {
          materiasGuardadas =
            await obtenerMateriasLocales(
              usuarioId,
              esEstudiante
                ? periodoSeleccionado
                : null
            );

          if (
            solicitudId !==
            solicitudMateriasId.current
          ) {
            return;
          }

          if (materiasGuardadas.length > 0) {
            copiaLocalDisponible = true;

            setMaterias(
              materiasGuardadas.map(
                adaptarMateriaLocal
              )
            );

            setModoOffline(true);

            const fecha =
              materiasGuardadas[0]
                ?.sincronizado_en;

            setUltimaActualizacion(
              fecha || null
            );

            setCargando(false);
          } else {
            setMaterias([]);
            setModoOffline(false);
          }
        } catch (errorLocal) {
          console.warn(
            'HU-07: no se pudo recuperar la copia local:',
            errorLocal.message
          );
        }

        const urlConsulta = esEstudiante
          ? `${apiUrl}${endpoint}?periodoId=${periodoSeleccionado}`
          : `${apiUrl}${endpoint}`;

        const data = await consultarAPI(
          urlConsulta,
          accessToken
        );

        if (
          solicitudId !==
          solicitudMateriasId.current
        ) {
          return;
        }

        const materiasServidor =
          Array.isArray(data.materias)
            ? data.materias
            : [];

        setMaterias(materiasServidor);
        setModoOffline(false);
        setUltimaActualizacion(
          new Date().toISOString()
        );

        // Guardar la copia actualizada.
        try {
          await guardarMateriasLocales(
            usuarioId,
            materiasServidor,
            esEstudiante
              ? periodoSeleccionado
              : null
          );
        } catch (errorLocal) {
          console.warn(
            'HU-07: no se pudo actualizar materias_locales:',
            errorLocal.message
          );
        }

        // Conservar el segundo mecanismo
        // existente sin hacer depender la
        // pantalla de su resultado.
        try {
          await guardarMateriasOffline({
            materias: materiasServidor,
            usuarioId,
            tipoUsuario,
            periodoId: esEstudiante
              ? periodoSeleccionado
              : null,
          });
        } catch (errorOffline) {
          console.warn(
            'HU-07: copia secundaria no guardada:',
            errorOffline.message
          );
        }
      } catch (error) {
        if (
          solicitudId !==
          solicitudMateriasId.current
        ) {
          return;
        }

        if (
          error.status === 401 ||
          error.status === 403
        ) {
          setMaterias([]);
          setModoOffline(false);
          setErrorMaterias(
            'Tu sesión ha vencido o no tienes permiso para consultar las materias.'
          );
        } else if (copiaLocalDisponible) {
          setModoOffline(true);
          setErrorMaterias(
            'Sin conexión. Estás consultando la última copia de tus materias.'
          );
        } else {
          setErrorMaterias(
            'No hay conexión y no existen materias descargadas para este periodo.'
          );
        }
      } finally {
        if (
          solicitudId ===
          solicitudMateriasId.current
        ) {
          setCargando(false);
        }
      }
    },
    [
      accessToken,
      apiUrl,
      endpoint,
      esEstudiante,
      usuarioId,
      tipoUsuario,
      periodoSeleccionado,
    ]
  );

  useEffect(() => {
    if (!esEstudiante) {
      return undefined;
    }

    cargarPeriodosDisponibles();

    return () => {
      solicitudPeriodosId.current += 1;
    };
  }, [
    esEstudiante,
    cargarPeriodosDisponibles,
  ]);

  useEffect(() => {
    cargarMaterias();

    return () => {
      solicitudMateriasId.current += 1;
    };
  }, [cargarMaterias]);

  const periodoDetalle = periodos.find(
    (periodo) =>
      Number(periodo.id) ===
      Number(periodoSeleccionado)
  );

  const totalMaterias = materias.length;

  const materiasActivas = materias.filter(
    (item) => datosMateria(item).estado === 'activa'
  ).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ENCABEZADO */}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color="#FFFFFF"
            />

            <Text style={styles.backText}>
              Volver
            </Text>
          </TouchableOpacity>

          <View style={styles.heroBadge}>
            <Ionicons
              name="school-outline"
              size={15}
              color="#27C4E8"
            />

            <Text style={styles.heroBadgeText}>
              AULA-AI
            </Text>
          </View>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons
            name="library-outline"
            size={30}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.title}>
          {title || 'Mis materias'}
        </Text>

        <Text style={styles.heroDescription}>
          {esEstudiante
            ? 'Consulta las materias correspondientes a tu grado, grupo y período académico.'
            : 'Consulta tus materias asignadas y la información académica de los grupos.'}
        </Text>
      </View>

      {/* RESUMEN */}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Ionicons
            name="book-outline"
            size={23}
            color="#123B73"
          />

          <Text style={styles.summaryValue}>
            {totalMaterias}
          </Text>

          <Text style={styles.summaryLabel}>
            Materias cargadas
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Ionicons
            name="checkmark-circle-outline"
            size={23}
            color="#21845B"
          />

          <Text style={styles.summaryValue}>
            {materiasActivas}
          </Text>

          <Text style={styles.summaryLabel}>
            Asignaciones activas
          </Text>
        </View>
      </View>

      {/* PERÍODOS ACADÉMICOS: ESTUDIANTE */}
      {esEstudiante && (
        <View style={styles.periodSection}>
          <View style={styles.sectionHeading}>
            <Ionicons
              name="calendar-outline"
              size={21}
              color="#123B73"
            />

            <Text style={styles.periodTitle}>
              Período académico
            </Text>
          </View>

          <Text style={styles.periodDescription}>
            Selecciona el período que deseas consultar.
          </Text>

          {cargandoPeriodos &&
            periodos.length === 0 && (
              <View style={styles.periodLoading}>
                <ActivityIndicator
                  size="small"
                  color="#123B73"
                />

                <Text style={styles.periodMessage}>
                  Consultando períodos...
                </Text>
              </View>
            )}

          {errorPeriodos && (
            <View
              style={[
                styles.periodErrorBox,
                origenPeriodos === 'sqlite' &&
                  styles.periodOfflineBox,
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color="#9B1C1C"
              />

              <Text style={styles.periodErrorText}>
                {errorPeriodos}
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                accessibilityRole="button"
                onPress={
                  cargarPeriodosDisponibles
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color="#123B73"
                />

                <Text style={styles.periodRetryText}>
                  Reintentar
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {periodos.length > 0 && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.periodList
                }
              >
                {periodos.map((periodo) => {
                  const seleccionado =
                    Number(periodoSeleccionado) ===
                    Number(periodo.id);

                  const etiqueta =
                    periodo.esOffline
                      ? 'Guardado'
                      : periodo.esActual
                        ? 'Actual'
                        : periodo.finalizado
                          ? 'Finalizado'
                          : periodo.futuro
                            ? 'Próximo'
                            : 'Configurado';

                  return (
                    <TouchableOpacity
                      key={String(periodo.id)}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: seleccionado,
                      }}
                      style={[
                        styles.periodButton,
                        seleccionado &&
                          styles.periodButtonActive,
                      ]}
                      onPress={() =>
                        setPeriodoSeleccionado(
                          Number(periodo.id)
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.periodButtonText,
                          seleccionado &&
                            styles.periodButtonTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {periodo.nombre?.replace(
                          /\s*-\s*\d{4}$/,
                          ''
                        )}
                      </Text>

                      <Text
                        style={[
                          styles.periodStatus,
                          seleccionado
                            ? styles.periodStatusActive
                            : periodo.esActual
                              ? styles.periodStatusCurrent
                              : styles.periodStatusOther,
                        ]}
                      >
                        {etiqueta}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {periodoDetalle && (
                <Text
                  style={styles.selectedPeriodText}
                >
                  Materias de {periodoDetalle.nombre}
                </Text>
              )}

              {origenPeriodos === 'sqlite' && (
                <Text style={styles.periodNotice}>
                  Períodos recuperados desde SQLite.
                  La información puede estar desactualizada.
                </Text>
              )}

              {origenPeriodos === 'servidor' &&
                !periodos.some(
                  (periodo) => periodo.esActual
                ) && (
                  <Text style={styles.periodNotice}>
                    No hay un período vigente según las
                    fechas configuradas. Puedes consultar
                    otro período.
                  </Text>
                )}
            </>
          )}
        </View>
      )}

      {/* ESTADO DE CONEXIÓN */}
      {modoOffline && materias.length > 0 && (
        <View style={styles.offlineBanner}>
          <Ionicons
            name="cloud-offline-outline"
            size={22}
            color="#805A19"
          />

          <View style={styles.bannerContent}>
          <Text style={styles.offlineBannerText}>
            Información disponible sin conexión
          </Text>

          <Text style={styles.bannerDescription}>
            Estás consultando una copia local de SQLite.
            Los datos pueden estar desactualizados.
          </Text>

          {ultimaActualizacion && (
            <Text style={styles.offlineDate}>
              Última descarga:{' '}
              {new Date(
                ultimaActualizacion
              ).toLocaleString('es-CO')}
            </Text>
          )}
          </View>
        </View>
      )}

      {!modoOffline &&
        !cargando &&
        materias.length > 0 && (
          <View style={styles.onlineBanner}>
            <Ionicons
              name="cloud-done-outline"
              size={21}
              color="#21845B"
            />

            <Text style={styles.onlineBannerText}>
              Materias actualizadas desde el servidor.
            </Text>
          </View>
        )}

      {/* ERRORES */}
      {errorMaterias && (
        <View style={styles.errorBox}>
          <View style={styles.errorHeading}>
            <Ionicons
              name="alert-circle-outline"
              size={21}
              color="#9B1C1C"
            />

            <Text style={styles.errorTitle}>
              Aviso de consulta
            </Text>
          </View>

          <Text style={styles.errorText}>
            {errorMaterias}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={cargarMaterias}
            accessibilityRole="button"
          >
            <Ionicons
              name="refresh-outline"
              size={17}
              color="#123B73"
            />

            <Text style={styles.periodRetryText}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ENCABEZADO DE LISTADO */}
      <View style={styles.listHeading}>
        <View>
          <Text style={styles.listTitle}>
            Listado de materias
          </Text>

          <Text style={styles.listSubtitle}>
            Información de tus asignaciones académicas
          </Text>
        </View>

        <View style={styles.listIcon}>
          <Ionicons
            name="albums-outline"
            size={21}
            color="#123B73"
          />
        </View>
      </View>

      {/* CARGA, VACÍO Y MATERIAS */}
      {cargando && materias.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="large"
            color="#123B73"
          />

          <Text style={styles.loadingText}>
            Cargando materias...
          </Text>
        </View>
      ) : materias.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="library-outline"
              size={34}
              color="#123B73"
            />
          </View>

          <Text style={styles.emptyTitle}>
            No hay materias disponibles
          </Text>

          <Text style={styles.emptyText}>
            {esEstudiante &&
            periodoSeleccionado == null
              ? 'Selecciona un período académico para consultar tus materias.'
              : 'Todavía no hay materias disponibles para la selección realizada.'}
          </Text>
        </View>
      ) : (
        materias.map((item, indice) => {
          const datos = datosMateria(item);

          return (
            <View
              key={String(datos.id ?? indice)}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <View style={styles.subjectIcon}>
                  <Ionicons
                    name="book-outline"
                    size={23}
                    color="#123B73"
                  />
                </View>

                <View style={styles.cardTitleContainer}>
                  <Text style={styles.subjectName}>
                    {datos.nombre}
                  </Text>

                  {datos.estado ? (
                    <View
                      style={[
                        styles.stateBadge,
                        datos.estado === 'activa'
                          ? styles.activeBadge
                          : styles.inactiveBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stateText,
                          datos.estado === 'activa'
                            ? styles.activeText
                            : styles.inactiveText,
                        ]}
                      >
                        {datos.estado}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {item.esOffline && (
                <View style={styles.offlineTag}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={15}
                    color="#805A19"
                  />

                  <Text style={styles.offlineText}>
                    Disponible sin conexión
                  </Text>
                </View>
              )}

              <View style={styles.cardDivider} />

              {datos.grado ? (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="school-outline"
                    size={18}
                    color="#718096"
                  />

                  <Text style={styles.cardText}>
                    <Text style={styles.infoLabel}>
                      Grado:{' '}
                    </Text>
                    {datos.grado}
                  </Text>
                </View>
              ) : null}

              {datos.grupo ? (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color="#718096"
                  />

                  <Text style={styles.cardText}>
                    <Text style={styles.infoLabel}>
                      Grupo:{' '}
                    </Text>
                    {datos.grupo}
                  </Text>
                </View>
              ) : null}

              {datos.periodo ? (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#718096"
                  />

                  <Text style={styles.cardText}>
                    <Text style={styles.infoLabel}>
                      Período:{' '}
                    </Text>
                    {datos.periodo}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {/* PIE DE PÁGINA */}
      <View style={styles.footer}>
        <Ionicons
          name="shield-checkmark-outline"
          size={16}
          color="#718096"
        />

        <Text style={styles.footerText}>
          AULA-AI · Gestión académica inteligente
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  container: {
    paddingHorizontal: 20,
    paddingBottom: 55,
  },

  hero: {
    backgroundColor: '#091D3A',
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 36,
    marginBottom: 22,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },

  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 7,
  },

  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#123B73',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  title: {
    fontSize: 27,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 10,
  },

  heroDescription: {
    color: '#D7E5F3',
    fontSize: 13,
    lineHeight: 21,
  },

  summaryRow: {
    flexDirection: 'row',
    marginBottom: 25,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 17,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    marginHorizontal: 5,
  },

  summaryValue: {
    color: '#123B73',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 9,
  },

  summaryLabel: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },

  periodSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    marginBottom: 20,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  periodTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#091D3A',
    marginLeft: 9,
  },

  periodDescription: {
    marginBottom: 15,
    fontSize: 12,
    lineHeight: 19,
    color: '#718096',
  },

  periodLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  periodMessage: {
    marginLeft: 10,
    fontSize: 12,
    color: '#718096',
  },

  periodErrorBox: {
    backgroundColor: '#FFF4F2',
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },

  periodOfflineBox: {
    backgroundColor: '#FFF4CC',
  },

  periodErrorText: {
    color: '#9B1C1C',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },

  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 6,
  },

  periodRetryText: {
    color: '#123B73',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },

  periodList: {
    paddingRight: 10,
    paddingBottom: 8,
  },

  periodButton: {
    minWidth: 110,
    maxWidth: 160,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
    borderRadius: 13,
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    alignItems: 'center',
  },

  periodButtonActive: {
    backgroundColor: '#123B73',
    borderColor: '#123B73',
  },

  periodButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#263B53',
  },

  periodButtonTextActive: {
    color: '#FFFFFF',
  },

  periodStatus: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '700',
  },

  periodStatusCurrent: {
    color: '#21845B',
  },

  periodStatusOther: {
    color: '#718096',
  },

  periodStatusActive: {
    color: '#FFFFFF',
  },

  selectedPeriodText: {
    marginTop: 9,
    fontSize: 12,
    fontWeight: '800',
    color: '#123B73',
  },

  periodNotice: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 19,
    color: '#805A19',
  },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3DC',
    borderColor: '#EDD6A5',
    borderWidth: 1,
    padding: 16,
    borderRadius: 14,
    marginBottom: 17,
  },

  bannerContent: {
    flex: 1,
    marginLeft: 11,
  },

  offlineBannerText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#805A19',
  },

  bannerDescription: {
    fontSize: 11,
    color: '#805A19',
    lineHeight: 18,
    marginTop: 5,
  },

  offlineDate: {
    fontSize: 11,
    color: '#805A19',
    marginTop: 7,
  },

  onlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF7EF',
    borderRadius: 13,
    padding: 14,
    marginBottom: 18,
  },

  onlineBannerText: {
    flex: 1,
    color: '#21845B',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 10,
  },

  errorBox: {
    backgroundColor: '#FFF4F2',
    borderRadius: 14,
    padding: 17,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F0C6C0',
  },

  errorHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },

  errorTitle: {
    color: '#9B1C1C',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 8,
  },

  errorText: {
    color: '#9B1C1C',
    fontSize: 12,
    lineHeight: 20,
  },

  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  listTitle: {
    color: '#091D3A',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 5,
  },

  listSubtitle: {
    color: '#718096',
    fontSize: 11,
  },

  listIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 35,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },

  loadingText: {
    marginTop: 13,
    color: '#718096',
    fontSize: 13,
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#091D3A',
    marginBottom: 9,
    textAlign: 'center',
  },

  emptyText: {
    color: '#718096',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 19,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardTitleContainer: {
    flex: 1,
  },

  subjectName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#091D3A',
    lineHeight: 24,
    marginBottom: 8,
  },

  stateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  activeBadge: {
    backgroundColor: '#EAF7EF',
  },

  inactiveBadge: {
    backgroundColor: '#F0F3F7',
  },

  stateText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
  },

  activeText: {
    color: '#21845B',
  },

  inactiveText: {
    color: '#718096',
  },

  offlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
  },

  offlineText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#805A19',
    marginLeft: 7,
  },

  cardDivider: {
    height: 1,
    backgroundColor: '#E9EFF5',
    marginVertical: 17,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
  },

  cardText: {
    flex: 1,
    color: '#263B53',
    fontSize: 12,
    lineHeight: 19,
    marginLeft: 10,
  },

  infoLabel: {
    color: '#718096',
    fontWeight: '700',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },

  footerText: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 7,
  },
});
