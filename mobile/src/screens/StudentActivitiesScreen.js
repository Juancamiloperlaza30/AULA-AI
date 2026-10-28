
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  guardarActividadesLocales,
  obtenerActividadesLocales,
} from '../../database/localDatabase';

// =====================================================
// AULA-AI - HU-07
// MIS ACTIVIDADES DEL ESTUDIANTE
//
// Consulta online y offline mediante SQLite.
// Conserva las entregas, recursos y calificaciones
// desarrollados previamente en HU-04 y HU-05.
// =====================================================

const TIMEOUT_MS = 8000;

const formatearFechaHora = (fecha) => {
  if (!fecha) return '-';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return '-';
  }

  return valor.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return '-';
  }

  return valor.toLocaleString('es-CO');
};

const obtenerEstadoFecha = (fechaEntrega) => {
  if (!fechaEntrega) {
    return 'Sin fecha';
  }

  const entrega = new Date(fechaEntrega);

  if (Number.isNaN(entrega.getTime())) {
    return 'Sin fecha';
  }

  const diferencia =
    entrega.getTime() - Date.now();

  if (diferencia < 0) {
    return 'Vencida';
  }

  const dias = diferencia / 86400000;

  if (dias <= 3) {
    return 'Próxima';
  }

  return 'Pendiente';
};

// =====================================================
// ADAPTAR ACTIVIDADES PROCEDENTES DE SQLITE
// =====================================================

const adaptarActividadLocal = (item) => ({
  id: item.id,
  tipo: item.tipo,
  titulo: item.titulo,
  descripcion: item.descripcion,
  fecha_publicacion: item.fecha_publicacion,
  fecha_entrega: item.fecha_entrega,
  estado: item.estado,

  materia_grupo_periodo: {
    materia: {
      nombre: item.materia,
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
  },

  entrega: item.entrega_id
    ? {
        id: item.entrega_id,
        estado: item.entrega_estado,
        fecha_entrega: item.entrega_fecha,
        comentario: item.entrega_comentario,
        entregada_tarde:
          item.entrega_estado ===
          'entregada_tarde',
      }
    : null,

  calificacion: item.calificacion_id
    ? {
        id: item.calificacion_id,
        valor: item.calificacion_valor,
        retroalimentacion:
          item.calificacion_retroalimentacion,
      }
    : null,

  esOffline: true,
});

// =====================================================
// CONSULTA CON TIEMPO MÁXIMO
// =====================================================

const consultarJSON = async ({
  url,
  accessToken,
  method = 'GET',
  signal,
}) => {
  const controller = new AbortController();

  let temporizador;
  let canceladoPorTiempo = false;

  const cancelar = () => {
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener(
        'abort',
        cancelar,
        { once: true }
      );
    }
  }

  try {
    const solicitud = (async () => {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(
          response.status === 401
            ? 'Tu sesión ha vencido. Inicia sesión nuevamente.'
            : response.status === 403
              ? 'No tienes autorización para esta operación.'
              : data.message ||
                'No fue posible completar la solicitud.'
        );

        error.status = response.status;
        throw error;
      }

      return data;
    })();

    const controlada = solicitud.then(
      (data) => ({
        tipo: 'resultado',
        data,
      }),
      (error) => ({
        tipo: 'error',
        error,
      })
    );

    const limite = new Promise((resolve) => {
      temporizador = setTimeout(() => {
        canceladoPorTiempo = true;
        controller.abort();

        resolve({
          tipo: 'timeout',
        });
      }, TIMEOUT_MS);
    });

    const resultado = await Promise.race([
      controlada,
      limite,
    ]);

    if (resultado.tipo === 'timeout') {
      throw new Error(
        'El servidor no respondió a tiempo.'
      );
    }

    if (resultado.tipo === 'error') {
      throw resultado.error;
    }

    return resultado.data;
  } finally {
    clearTimeout(temporizador);

    if (signal) {
      signal.removeEventListener(
        'abort',
        cancelar
      );
    }

    if (
      canceladoPorTiempo &&
      !controller.signal.aborted
    ) {
      controller.abort();
    }
  }
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function StudentActivitiesScreen({
  apiUrl,
  accessToken,
  usuarioId,
  onBack,
  onSubmitActivity,
  onViewSubmission,
}) {
  const [actividades, setActividades] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [recarga, setRecarga] =
    useState(0);

  const [modoOffline, setModoOffline] =
    useState(false);

  const [origen, setOrigen] =
    useState(null);

  const [ultimaActualizacion, setUltimaActualizacion] =
    useState(null);

  const [error, setError] =
    useState('');

  const [aviso, setAviso] =
    useState('');

  const [
    recursosPorActividad,
    setRecursosPorActividad,
  ] = useState({});

  const [
    materiaSeleccionada,
    setMateriaSeleccionada,
  ] = useState(null);

  const solicitudId = useRef(0);
  const solicitudController = useRef(null);

  // ===================================================
  // CARGAR ACTIVIDADES
  // Primero SQLite y después backend.
  // ===================================================

  const cargarActividades = useCallback(
    async (mostrarCarga = true) => {
      const id = ++solicitudId.current;

      if (solicitudController.current) {
        solicitudController.current.abort();
      }

      const controller = new AbortController();
      solicitudController.current = controller;

      if (mostrarCarga) {
        setCargando(true);
      } else {
        setActualizando(true);
      }

      setError('');
      setAviso('');

      let tieneCopiaLocal = false;

      try {
        if (!usuarioId || !accessToken) {
          throw new Error(
            'No existe una sesión válida.'
          );
        }

        // -----------------------------------------
        // 1. RECUPERAR SQLITE
        // -----------------------------------------

        try {
          const locales =
            await obtenerActividadesLocales(
              usuarioId
            );

          if (
            controller.signal.aborted ||
            id !== solicitudId.current
          ) {
            return;
          }

          const adaptadas = (
            Array.isArray(locales)
              ? locales
              : []
          ).map(adaptarActividadLocal);

          if (adaptadas.length > 0) {
            tieneCopiaLocal = true;

            setActividades(adaptadas);
            setModoOffline(true);
            setOrigen('sqlite');

            const fechaGuardada =
              locales[0]?.sincronizado_en ||
              locales[0]?.actualizado_en ||
              null;

            setUltimaActualizacion(
              fechaGuardada
            );

            setCargando(false);
          } else {
            setActividades([]);
            setOrigen(null);
            setModoOffline(false);
          }
        } catch (errorLocal) {
          console.warn(
            'HU-07: error leyendo actividades de SQLite:',
            errorLocal.message
          );
        }

        // -----------------------------------------
        // 2. CONSULTAR EL SERVIDOR
        // -----------------------------------------

        const data = await consultarJSON({
          url:
            `${apiUrl}/api/activities/` +
            'mis-actividades-estudiante',
          accessToken,
          signal: controller.signal,
        });

        if (
          controller.signal.aborted ||
          id !== solicitudId.current
        ) {
          return;
        }

        const servidor = Array.isArray(
          data.actividades
        )
          ? data.actividades
          : [];

        setActividades(servidor);
        setModoOffline(false);
        setOrigen('servidor');

        const fechaConsulta =
          new Date().toISOString();

        setUltimaActualizacion(
          fechaConsulta
        );

        // Evitar que queden recursos de una
        // consulta anterior en pantalla.
        setRecursosPorActividad({});

        // -----------------------------------------
        // 3. ACTUALIZAR SQLITE
        // -----------------------------------------

        try {
          await guardarActividadesLocales(
            usuarioId,
            servidor
          );
        } catch (errorGuardado) {
          console.warn(
            'HU-07: no se pudo guardar SQLite:',
            errorGuardado.message
          );

          if (
            id === solicitudId.current &&
            !controller.signal.aborted
          ) {
            setAviso(
              'Las actividades se consultaron correctamente, pero no pudieron guardarse para usarlas sin internet.'
            );
          }
        }
      } catch (errorConsulta) {
        if (
          controller.signal.aborted &&
          errorConsulta.name === 'AbortError'
        ) {
          return;
        }

        if (id !== solicitudId.current) {
          return;
        }

        const sinPermiso =
          errorConsulta.status === 401 ||
          errorConsulta.status === 403;

        if (sinPermiso) {
          setActividades([]);
          setModoOffline(false);
          setOrigen(null);
          setUltimaActualizacion(null);
          setRecursosPorActividad({});

          setError(errorConsulta.message);
        } else if (tieneCopiaLocal) {
          setModoOffline(true);
          setOrigen('sqlite');

          setAviso(
            'No fue posible conectarse al servidor. Estás consultando las últimas actividades guardadas en SQLite.'
          );
        } else {
          setActividades([]);
          setOrigen(null);

          setError(
            'No hay conexión con el servidor y todavía no existen actividades descargadas en este dispositivo.'
          );
        }
      } finally {
        if (id === solicitudId.current) {
          setCargando(false);
          setActualizando(false);

          if (
            solicitudController.current ===
            controller
          ) {
            solicitudController.current = null;
          }
        }
      }
    },
    [
      apiUrl,
      accessToken,
      usuarioId,
    ]
  );

  useEffect(() => {
    cargarActividades(true);

    return () => {
      solicitudId.current += 1;

      if (solicitudController.current) {
        solicitudController.current.abort();
      }
    };
  }, [
    cargarActividades,
    recarga,
  ]);

  const reintentar = () => {
    cargarActividades(false);
  };

  // ===================================================
  // DESHACER ENTREGA
  // Se conserva el comportamiento online.
  // ===================================================

  const deshacerEntrega = (entregaId) => {
    if (modoOffline) {
      Alert.alert(
        'Sin conexión',
        'Conéctate a internet para modificar una entrega.'
      );

      return;
    }

    Alert.alert(
      'Deshacer entrega',
      '¿Seguro que deseas deshacer esta entrega? Podrás volver a enviarla después.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Deshacer',
          style: 'destructive',

          onPress: async () => {
            try {
              await consultarJSON({
                url:
                  `${apiUrl}/api/activities/` +
                  `entregas/${entregaId}/deshacer`,
                method: 'PUT',
                accessToken,
              });

              Alert.alert(
                'Entrega deshecha',
                'La entrega fue anulada correctamente.'
              );

              setRecarga(
                (actual) => actual + 1
              );
            } catch (fallo) {
              Alert.alert(
                'No se pudo deshacer',
                fallo.message ||
                  'Intenta nuevamente.'
              );
            }
          },
        },
      ]
    );
  };

  // ===================================================
  // RECURSOS DE ACTIVIDADES
  // ===================================================

  const cargarRecursos = async (actividadId) => {
    if (modoOffline) {
      Alert.alert(
        'Sin conexión',
        'Conéctate a internet para consultar archivos y enlaces.'
      );

      return;
    }

    try {
      const data = await consultarJSON({
        url:
          `${apiUrl}/api/activities/` +
          `${actividadId}/recursos`,
        accessToken,
      });

      setRecursosPorActividad(
        (actuales) => ({
          ...actuales,
          [actividadId]:
            data.recursos || [],
        })
      );
    } catch (fallo) {
      Alert.alert(
        'No se pudieron consultar los recursos',
        fallo.message
      );
    }
  };

  const abrirRecurso = async (url) => {
    if (modoOffline) {
      Alert.alert(
        'Sin conexión',
        'Este recurso necesita conexión a internet.'
      );
      return;
    }

    try {
      const compatible =
        await Linking.canOpenURL(url);

      if (!compatible) {
        throw new Error(
          'El enlace no se puede abrir.'
        );
      }

      await Linking.openURL(url);
    } catch (fallo) {
      Alert.alert(
        'Error',
        'No fue posible abrir el recurso.'
      );
    }
  };

  // ===================================================
  // AGRUPAR ACTIVIDADES POR MATERIA
  // ===================================================

  const actividadesPorMateria =
    actividades.reduce(
      (acumulado, actividad) => {
        const nombreMateria =
          actividad
            .materia_grupo_periodo
            ?.materia?.nombre ||
          'Sin materia';

        if (!acumulado[nombreMateria]) {
          acumulado[nombreMateria] = [];
        }

        acumulado[nombreMateria].push(
          actividad
        );

        return acumulado;
      },
      {}
    );

  Object.keys(
    actividadesPorMateria
  ).forEach((materia) => {
    actividadesPorMateria[materia].sort(
      (a, b) =>
        new Date(
          b.fecha_publicacion || 0
        ).getTime() -
        new Date(
          a.fecha_publicacion || 0
        ).getTime()
    );
  });

  // ===================================================
  // TARJETAS DE ACTIVIDAD
  // ===================================================

  const renderizarActividad = (actividad) => {
    const estadoFecha = obtenerEstadoFecha(
      actividad.fecha_entrega
    );

    const entrega = actividad.entrega;
    const tieneEntrega = Boolean(entrega);

    const entregadaTarde =
      entrega?.estado ===
      'entregada_tarde';

    const calificacion =
      actividad.calificacion;

    return (
      <View
        key={String(actividad.id)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.type}>
            {actividad.tipo?.toUpperCase() ||
              'ACTIVIDAD'}
          </Text>

          <Text style={styles.state}>
            {estadoFecha}
          </Text>
        </View>

        <Text style={styles.activityTitle}>
          {actividad.titulo}
        </Text>

        {modoOffline && (
          <Text style={styles.offlineText}>
            Disponible sin conexión
          </Text>
        )}

        <Text style={styles.publicationDate}>
          Publicada:{' '}
          {formatearFecha(
            actividad.fecha_publicacion
          )}
        </Text>

        <Text style={styles.description}>
          {actividad.descripcion ||
            'Sin descripción disponible.'}
        </Text>

        <Text style={styles.dateText}>
          Fecha de entrega:{' '}
          {formatearFecha(
            actividad.fecha_entrega
          )}
        </Text>

        {/* CALIFICACIÓN */}

        <View style={styles.gradeSection}>
          <Text style={styles.gradeLabel}>
            Calificación
          </Text>

          {calificacion ? (
            <>
              <Text style={styles.gradeValue}>
                {Number(
                  calificacion.valor
                ).toFixed(2)}
                {' / 5.00'}
              </Text>

              {calificacion.retroalimentacion ? (
                <View
                  style={styles.feedbackSection}
                >
                  <Text
                    style={styles.feedbackTitle}
                  >
                    Retroalimentación
                  </Text>

                  <Text
                    style={styles.feedbackText}
                  >
                    {
                      calificacion
                        .retroalimentacion
                    }
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.gradePending}>
              Pendiente por calificar
            </Text>
          )}
        </View>

        {/* ESTADO DE ENTREGA */}

        <View style={styles.deliverySection}>
          {!tieneEntrega ? (
            <>
              <Text
                style={styles.deliveryPending}
              >
                Sin entregar
              </Text>

              <Text style={styles.deliveryInfo}>
                Aún no has enviado esta actividad.
              </Text>
            </>
          ) : (
            <>
              <Text
                style={
                  entregadaTarde
                    ? styles.deliveryLate
                    : styles.deliverySuccess
                }
              >
                {entregadaTarde
                  ? 'Entregada con retraso'
                  : 'Entregada a tiempo'}
              </Text>

              <Text style={styles.deliveryInfo}>
                Entregada:{' '}
                {formatearFechaHora(
                  entrega.fecha_entrega
                )}
              </Text>

              {entrega.comentario ? (
                <Text
                  style={styles.deliveryComment}
                >
                  Comentario:{' '}
                  {entrega.comentario}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* RECURSOS */}

        <TouchableOpacity
          style={[
            styles.resourcesButton,
            modoOffline &&
              styles.disabledButton,
          ]}
          onPress={() =>
            cargarRecursos(actividad.id)
          }
          disabled={modoOffline}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.resourcesButtonText,
              modoOffline &&
                styles.disabledButtonText,
            ]}
          >
            Ver archivos y enlaces
          </Text>
        </TouchableOpacity>

        {recursosPorActividad[
          actividad.id
        ]?.map((recurso) => (
          <TouchableOpacity
            key={String(recurso.id)}
            style={styles.resourceCard}
            onPress={() =>
              abrirRecurso(recurso.url)
            }
            disabled={modoOffline}
          >
            <Text style={styles.resourceName}>
              {recurso.nombre_original}
            </Text>

            <Text style={styles.resourceType}>
              {recurso.tipo_recurso === 'enlace'
                ? 'Abrir enlace'
                : 'Abrir / descargar archivo'}
            </Text>
          </TouchableOpacity>
        ))}

        {/* ENTREGAR ACTIVIDAD */}

        {!tieneEntrega && (
          <TouchableOpacity
            style={[
              styles.submitButton,
              modoOffline &&
                styles.disabledButton,
            ]}
            disabled={modoOffline}
            onPress={() =>
              onSubmitActivity?.(actividad)
            }
          >
            <Text style={styles.submitButtonText}>
              {modoOffline
                ? 'Entrega disponible con internet'
                : 'Entregar actividad'}
            </Text>
          </TouchableOpacity>
        )}

        {/* CONSULTAR Y DESHACER ENTREGA */}

        {tieneEntrega && (
          <>
            <TouchableOpacity
              style={[
                styles.viewSubmissionButton,
                modoOffline &&
                  styles.disabledButton,
              ]}
              disabled={modoOffline}
              onPress={() =>
                onViewSubmission?.(
                  entrega.id
                )
              }
            >
              <Text
                style={
                  styles.viewSubmissionButtonText
                }
              >
                Ver mi entrega
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.undoButton,
                modoOffline &&
                  styles.disabledButton,
              ]}
              disabled={modoOffline}
              onPress={() =>
                deshacerEntrega(
                  entrega.id
                )
              }
            >
              <Text style={styles.undoButtonText}>
                Deshacer entrega
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={reintentar}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity
            style={styles.topBackButton}
            onPress={
              materiaSeleccionada
                ? () =>
                    setMateriaSeleccionada(null)
                : onBack
            }
            accessibilityRole="button"
          >
            <Ionicons
              name="arrow-back"
              size={19}
              color="#FFFFFF"
            />

            <Text style={styles.backText}>
              Volver
            </Text>
          </TouchableOpacity>

          <View style={styles.heroBadge}>
            <Ionicons
              name="school-outline"
              size={14}
              color="#27C4E8"
            />

            <Text style={styles.heroBadgeText}>
              AULA-AI
            </Text>
          </View>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons
            name="clipboard-outline"
            size={29}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.title}>
          {materiaSeleccionada ||
            'Mis actividades'}
        </Text>

        <Text style={styles.subtitle}>
          {materiaSeleccionada
            ? 'Consulta las actividades, tareas y exámenes de esta materia.'
            : 'Selecciona una materia para consultar tus actividades.'}
        </Text>
      </View>

      {/* ESTADO DE LA INFORMACIÓN */}

      {origen === 'sqlite' && (
        <View style={styles.offlineBanner}>
          <Ionicons
            name="cloud-offline-outline"
            size={21}
            color="#805A19"
          />

          <View style={styles.bannerContent}>
          <Text style={styles.offlineBannerTitle}>
            Copia local de SQLite — puede estar desactualizada
          </Text>

          {ultimaActualizacion && (
            <Text style={styles.offlineBannerDate}>
              Última descarga:{' '}
              {formatearFechaHora(
                ultimaActualizacion
              )}
            </Text>
          )}
          </View>
        </View>
      )}

      {origen === 'servidor' && (
        <View style={styles.onlineBanner}>
          <Ionicons
            name="cloud-done-outline"
            size={21}
            color="#21845B"
          />

          <View style={styles.bannerContent}>
          <Text style={styles.onlineBannerTitle}>
            Información actualizada desde el servidor
          </Text>

          <Text style={styles.onlineBannerDate}>
            Última consulta:{' '}
            {formatearFechaHora(
              ultimaActualizacion
            )}
          </Text>
          </View>
        </View>
      )}

      {aviso ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            {aviso}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={reintentar}
          >
            <Text style={styles.retryText}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {cargando && !origen ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#1F4E79"
          />

          <Text style={styles.loadingText}>
            Cargando actividades...
          </Text>
        </View>
      ) : !materiaSeleccionada ? (
        <>
          {Object.keys(
            actividadesPorMateria
          ).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No hay actividades disponibles
              </Text>

              <Text style={styles.emptyText}>
                {error
                  ? 'Conéctate a internet para descargar tus actividades.'
                  : 'Actualmente no tienes actividades asignadas.'}
              </Text>
            </View>
          ) : (
            Object.entries(
              actividadesPorMateria
            ).map(
              ([
                nombreMateria,
                listaActividades,
              ]) => {
                const pendientes =
                  listaActividades.filter(
                    (actividad) =>
                      !actividad.entrega
                  ).length;

                return (
                  <TouchableOpacity
                    key={nombreMateria}
                    style={styles.subjectCard}
                    onPress={() =>
                      setMateriaSeleccionada(
                        nombreMateria
                      )
                    }
                  >
                    <View
                      style={styles.subjectIcon}
                    >
                      <Text
                        style={
                          styles.subjectIconText
                        }
                      >
                        {nombreMateria
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.subjectInfoBox}>
                      <Text
                        style={styles.subjectTitle}
                      >
                        {nombreMateria}
                      </Text>

                      <Text
                        style={styles.subjectInfo}
                      >
                        {listaActividades.length}{' '}
                        {listaActividades.length === 1
                          ? 'actividad'
                          : 'actividades'}
                      </Text>

                      <Text
                        style={styles.subjectPending}
                      >
                        {pendientes}{' '}
                        pendientes
                      </Text>
                    </View>

                    <Text style={styles.subjectArrow}>
                      ›
                    </Text>
                  </TouchableOpacity>
                );
              }
            )
          )}
        </>
      ) : (
        <>
          <TouchableOpacity
            style={styles.subjectBackButton}
            onPress={() =>
              setMateriaSeleccionada(null)
            }
          >
            <Text
              style={styles.subjectBackText}
            >
              ← Ver materias
            </Text>
          </TouchableOpacity>

          {(
            actividadesPorMateria[
              materiaSeleccionada
            ] || []
          ).map(renderizarActividad)}
        </>
      )}

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backText}>
          Volver al panel
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  container: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },

  hero: {
    backgroundColor: '#091D3A',
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 26,
    marginBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 23,
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 65,
    gap: 12,
  },

  loadingText: {
    color: '#607D8B',
    fontSize: 14,
  },

  topBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  backText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: '700',
    fontSize: 14,
  },

  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },

  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 6,
  },

  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#123B73',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 12,
    color: '#D6E4F2',
    lineHeight: 21,
  },

  bannerContent: {
    flex: 1,
    marginLeft: 11,
  },

  offlineBanner: {
    backgroundColor: '#FFF3DC',
    borderWidth: 1,
    borderColor: '#EDD6A5',
    borderRadius: 14,
    padding: 15,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  offlineBannerTitle: {
    color: '#805A19',
    fontSize: 13,
    fontWeight: '700',
  },

  offlineBannerDate: {
    color: '#805A19',
    marginTop: 6,
    fontSize: 12,
  },

  onlineBanner: {
    backgroundColor: '#EAF7EF',
    borderWidth: 1,
    borderColor: '#C7E9D3',
    borderRadius: 14,
    padding: 15,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  onlineBannerTitle: {
    color: '#21845B',
    fontWeight: '700',
    fontSize: 13,
  },

  onlineBannerDate: {
    color: '#607D8B',
    fontSize: 12,
    marginTop: 6,
  },

  noticeBox: {
    backgroundColor: '#FFF7E8',
    borderRadius: 10,
    padding: 13,
    marginBottom: 15,
  },

  noticeText: {
    color: '#805A19',
    lineHeight: 19,
    fontSize: 13,
  },

  errorBox: {
    backgroundColor: '#FFF2F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },

  errorText: {
    color: '#B42318',
    lineHeight: 20,
    fontSize: 13,
  },

  retryButton: {
    backgroundColor: '#1F4E79',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 9,
    marginTop: 12,
    alignSelf: 'flex-start',
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#EAF3FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  subjectIconText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#123B73',
  },

  subjectInfoBox: {
    flex: 1,
  },

  subjectTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#091D3A',
  },

  subjectInfo: {
    marginTop: 4,
    fontSize: 13,
    color: '#607D8B',
  },

  subjectPending: {
    marginTop: 3,
    fontSize: 12,
    color: '#8A98A8',
  },

  subjectArrow: {
    fontSize: 30,
    color: '#607D8B',
  },

  subjectBackButton: {
    marginBottom: 14,
    alignSelf: 'flex-start',
  },

  subjectBackText: {
    color: '#2D405D',
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
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
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  type: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D405D',
  },

  state: {
    fontSize: 12,
    fontWeight: '600',
    color: '#607D8B',
  },

  activityTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#091D3A',
    marginBottom: 8,
  },

  publicationDate: {
    fontSize: 12,
    color: '#607D8B',
    marginBottom: 10,
  },

  offlineText: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 12,
    color: '#805A19',
    fontWeight: '700',
  },

  description: {
    color: '#455A64',
    lineHeight: 20,
    marginBottom: 12,
  },

  dateText: {
    marginTop: 10,
    color: '#455A64',
    fontWeight: '600',
  },

  gradeSection: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F7F9FC',
  },

  gradeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#607D8B',
    textTransform: 'uppercase',
  },

  gradeValue: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800',
    color: '#2D405D',
  },

  gradePending: {
    marginTop: 6,
    fontSize: 14,
    color: '#607D8B',
    fontWeight: '600',
  },

  feedbackSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E5EB',
  },

  feedbackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#607D8B',
  },

  feedbackText: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: '#455A64',
  },

  deliverySection: {
    marginTop: 14,
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#F4F7FB',
  },

  deliveryPending: {
    fontWeight: 'bold',
    color: '#607D8B',
    marginBottom: 4,
  },

  deliverySuccess: {
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },

  deliveryLate: {
    fontWeight: 'bold',
    color: '#C62828',
    marginBottom: 4,
  },

  deliveryInfo: {
    fontSize: 13,
    color: '#455A64',
    marginBottom: 3,
  },

  deliveryComment: {
    marginTop: 6,
    fontSize: 13,
    fontStyle: 'italic',
    color: '#455A64',
  },

  viewSubmissionButton: {
    marginTop: 10,
    backgroundColor: '#E9EEF5',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },

  viewSubmissionButtonText: {
    color: '#2D405D',
    fontWeight: 'bold',
  },

  undoButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#B00020',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },

  undoButtonText: {
    color: '#B00020',
    fontWeight: 'bold',
  },

  resourcesButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#2D405D',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },

  resourcesButtonText: {
    color: '#2D405D',
    fontWeight: 'bold',
  },

  disabledButton: {
    opacity: 0.45,
  },

  disabledButtonText: {
    color: '#8A98A8',
  },

  resourceCard: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F3F6F9',
    borderRadius: 10,
  },

  resourceName: {
    fontWeight: '600',
    marginBottom: 4,
  },

  resourceType: {
    fontSize: 12,
    color: '#607D8B',
  },

  submitButton: {
    marginTop: 14,
    backgroundColor: '#123B73',
    borderRadius: 13,
    padding: 14,
    alignItems: 'center',
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderWidth: 1,
    borderColor: '#E0E5EB',
    borderRadius: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 6,
  },

  emptyText: {
    color: '#607D8B',
    lineHeight: 20,
  },

  backButton: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
  },
});
