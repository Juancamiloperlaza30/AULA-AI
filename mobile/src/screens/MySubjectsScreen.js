
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
      >
        <Text style={styles.backText}>
          ← Volver
        </Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        {title}
      </Text>

      {esEstudiante && (
        <View style={styles.periodSection}>
          <Text style={styles.periodTitle}>
            Periodo académico
          </Text>

          <Text style={styles.periodDescription}>
            Consulta las materias correspondientes
            a tu grado, grupo y periodo académico.
          </Text>

          {cargandoPeriodos &&
            periodos.length === 0 && (
              <View style={styles.periodLoading}>
                <ActivityIndicator
                  size="small"
                  color="#1F4E79"
                />

                <Text style={styles.periodMessage}>
                  Consultando periodos...
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
              <Text style={styles.periodErrorText}>
                {errorPeriodos}
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                onPress={
                  cargarPeriodosDisponibles
                }
              >
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
                  Periodos recuperados desde SQLite.
                  La información puede estar
                  desactualizada.
                </Text>
              )}

              {origenPeriodos === 'servidor' &&
                !periodos.some(
                  (periodo) => periodo.esActual
                ) && (
                  <Text style={styles.periodNotice}>
                    No hay un periodo vigente según
                    las fechas configuradas. Puedes
                    consultar otro periodo.
                  </Text>
                )}
            </>
          )}
        </View>
      )}

      {modoOffline && materias.length > 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Copia local de SQLite — puede estar
            desactualizada.
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
      )}

      {!modoOffline &&
        !cargando &&
        materias.length > 0 && (
          <View style={styles.onlineBanner}>
            <Text style={styles.onlineBannerText}>
              Materias actualizadas desde el
              servidor.
            </Text>
          </View>
        )}

      {errorMaterias && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {errorMaterias}
          </Text>

          <TouchableOpacity
            onPress={cargarMaterias}
            accessibilityRole="button"
          >
            <Text style={styles.periodRetryText}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {cargando && materias.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="large"
            color="#1F4E79"
          />

          <Text style={styles.loadingText}>
            Cargando materias...
          </Text>
        </View>
      ) : materias.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            No hay materias disponibles
          </Text>

          <Text style={styles.emptyText}>
            {esEstudiante &&
            periodoSeleccionado == null
              ? 'Selecciona un periodo académico para consultar tus materias.'
              : 'Todavía no hay materias disponibles para la selección realizada.'}
          </Text>
        </View>
      ) : (
        materias.map((item, indice) => {
          const datos = datosMateria(item);

          return (
            <View
              key={String(
                datos.id ?? indice
              )}
              style={styles.card}
            >
              <Text style={styles.subjectName}>
                {datos.nombre}
              </Text>

              {item.esOffline && (
                <Text style={styles.offlineText}>
                  Disponible sin conexión
                </Text>
              )}

              {datos.grado ? (
                <Text style={styles.cardText}>
                  Grado: {datos.grado}
                </Text>
              ) : null}

              {datos.grupo ? (
                <Text style={styles.cardText}>
                  Grupo: {datos.grupo}
                </Text>
              ) : null}

              {datos.periodo ? (
                <Text style={styles.cardText}>
                  Periodo: {datos.periodo}
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 50,
  },
  backButton: {
    marginBottom: 20,
  },
  backText: {
    color: '#1F4E79',
    fontWeight: '600',
    fontSize: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 25,
  },
  periodSection: {
    marginBottom: 20,
  },
  periodTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#455A64',
    marginBottom: 4,
  },
  periodDescription: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#607D8B',
  },
  periodLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  periodMessage: {
    paddingVertical: 10,
    fontSize: 13,
    color: '#607D8B',
  },
  periodErrorBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FDECEC',
    marginBottom: 12,
  },
  periodOfflineBox: {
    backgroundColor: '#FFF4CC',
  },
  periodErrorText: {
    color: '#9B1C1C',
    fontSize: 13,
    lineHeight: 19,
  },
  periodRetryText: {
    marginTop: 9,
    color: '#1F4E79',
    fontSize: 13,
    fontWeight: '800',
  },
  periodList: {
    paddingRight: 10,
    paddingBottom: 4,
  },
  periodButton: {
    minWidth: 108,
    maxWidth: 150,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E0E8',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#1F4E79',
    borderColor: '#1F4E79',
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#455A64',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  periodStatus: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  periodStatusCurrent: {
    color: '#2E7D32',
  },
  periodStatusOther: {
    color: '#607D8B',
  },
  periodStatusActive: {
    color: '#FFFFFF',
  },
  selectedPeriodText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F4E79',
  },
  periodNotice: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#8A5A00',
  },
  offlineBanner: {
    backgroundColor: '#FFF3DC',
    borderColor: '#EDD6A5',
    borderWidth: 1,
    padding: 13,
    borderRadius: 10,
    marginBottom: 14,
  },
  offlineBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#805A19',
  },
  offlineDate: {
    fontSize: 12,
    color: '#805A19',
    marginTop: 5,
  },
  onlineBanner: {
    backgroundColor: '#E8F2FA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  onlineBannerText: {
    color: '#1F4E79',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FFF2F0',
    borderRadius: 10,
    padding: 13,
    marginBottom: 14,
  },
  errorText: {
    color: '#9B1C1C',
    fontSize: 13,
    lineHeight: 19,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 12,
    color: '#607D8B',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 6,
  },
  emptyText: {
    color: '#607D8B',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E5EB',
  },
  subjectName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 10,
  },
  cardText: {
    color: '#455A64',
    marginBottom: 5,
  },
  offlineText: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#805A19',
  },
});
