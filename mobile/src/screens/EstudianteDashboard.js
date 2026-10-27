
import React, {
  useCallback,
  useEffect,
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

import ProfileDashboardHeader
  from '../components/ProfileDashboardHeader';

import StudentAcademicReminders
  from '../components/StudentAcademicReminders';

import StudentAcademicRecommendations
  from '../components/StudentAcademicRecommendations';

import {
  obtenerMateriasLocales,
  obtenerActividadesLocales,
  obtenerCalificacionesLocales,
} from '../../database/localDatabase';

// ================================================
// AULA-AI | HU-07
// PANEL DEL ESTUDIANTE ONLINE Y OFFLINE
// ================================================

const TIEMPO_LIMITE = 8000;

const esEntregaCompletada = (estado) =>
  ['entregada', 'entregada_tarde'].includes(
    String(estado || '').toLowerCase()
  );

const primero = (valor) =>
  Array.isArray(valor) ? valor[0] : valor;

const obtenerPeriodoNumero = (nombre) => {
  const coincidencia = String(
    nombre || ''
  ).match(/\d+/);

  return coincidencia
    ? coincidencia[0]
    : '-';
};

const obtenerPromedioSimple = (notas) => {
  const valores = notas
    .map((nota) => Number(nota.valor))
    .filter(Number.isFinite);

  if (!valores.length) return null;

  return (
    valores.reduce(
      (total, valor) => total + valor,
      0
    ) / valores.length
  );
};

// Solicitud con límite de tiempo y cancelación.
const consultarApi = async (
  url,
  token,
  signal
) => {
  const controller = new AbortController();

  const cancelar = () =>
    controller.abort();

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

  let temporizador;

  try {
    const consulta = fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const error = new Error(
          'Consulta académica no disponible.'
        );

        error.status = response.status;
        throw error;
      }

      return response.json();
    });

    const controlada = consulta.then(
      (data) => ({
        tipo: 'ok',
        data,
      }),
      (error) => ({
        tipo: 'error',
        error,
      })
    );

    const limite = new Promise((resolve) => {
      temporizador = setTimeout(() => {
        controller.abort();
        resolve({ tipo: 'timeout' });
      }, TIEMPO_LIMITE);
    });

    const resultado = await Promise.race([
      controlada,
      limite,
    ]);

    if (resultado.tipo === 'timeout') {
      throw new Error(
        'Tiempo de espera agotado.'
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
  }
};

const valorResumen = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return '-';
  }

  return String(valor);
};

const RESUMEN_INICIAL = {
  grado: '-',
  grupo: '-',
  totalMaterias: null,
  pendientes: null,
  periodo: '-',
  promedio: null,
  promedioEstimado: false,
};

export default function EstudianteDashboard({
  usuario,
  apiUrl,
  accessToken,
  onLogout,
  onMySubjects,
  onMyActivities,
  onMyGrades,
  onMyAttendance,
  onMyCommunications,
}) {
  const [resumen, setResumen] =
    useState(RESUMEN_INICIAL);

  const [origen, setOrigen] =
    useState(null);

  const [cargandoResumen, setCargandoResumen] =
    useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [aviso, setAviso] =
    useState('');

  const cargarResumen = useCallback(
    async (signal) => {
      const usuarioId = usuario?.id;

      if (!usuarioId || !accessToken) {
        setCargandoResumen(false);
        return;
      }

      setCargandoResumen(true);
      setAviso('');

      let hayCopia = false;
      let resumenLocal = {
        ...RESUMEN_INICIAL,
      };

      // ========================================
      // PASO 1: MOSTRAR DATOS DE SQLITE
      // ========================================

      try {
        const resultados = await Promise.allSettled([
          obtenerMateriasLocales(usuarioId),
          obtenerActividadesLocales(usuarioId),
          obtenerCalificacionesLocales(usuarioId),
        ]);

        if (signal.aborted) return;

        const materias =
          resultados[0].status === 'fulfilled'
            ? resultados[0].value
            : [];

        const actividades =
          resultados[1].status === 'fulfilled'
            ? resultados[1].value
            : [];

        const notas =
          resultados[2].status === 'fulfilled'
            ? resultados[2].value
            : [];

        const hayMaterias =
          Array.isArray(materias) &&
          materias.length > 0;

        const hayActividades =
          Array.isArray(actividades) &&
          actividades.length > 0;

        const hayNotas =
          Array.isArray(notas) &&
          notas.length > 0;

        hayCopia =
          hayMaterias ||
          hayActividades ||
          hayNotas;

        if (hayCopia) {
          // Las materias corresponden a asignaciones
          // de materia, grupo y periodo.
          const materiasUnicas = new Set(
            materias.map((item) =>
              String(item.nombre || item.id)
            )
          );

          // Recuperar periodo desde las materias.
          // No inventar un periodo cuando falte.
          const materiaConPeriodo =
            materias.find(
              (item) =>
                item.periodo_id != null
            );

          const periodoId =
            materiaConPeriodo?.periodo_id ??
            null;

          const periodoNombre =
            materiaConPeriodo?.periodo || '';

          const pendientes = actividades.filter(
            (actividad) => {
              if (
                actividad.estado &&
                actividad.estado !== 'publicada'
              ) {
                return false;
              }

              return !esEntregaCompletada(
                actividad.entrega_estado
              );
            }
          ).length;

          const notasPeriodo =
            periodoId == null
              ? notas
              : notas.filter(
                  (nota) =>
                    String(nota.periodo_id) ===
                    String(periodoId)
                );

          resumenLocal = {
            grado:
              materias[0]?.grado || '-',
            grupo:
              materias[0]?.grupo || '-',
            totalMaterias: hayMaterias
              ? materiasUnicas.size
              : null,
            pendientes: hayActividades
              ? pendientes
              : null,
            periodo:
              obtenerPeriodoNumero(
                periodoNombre
              ),
            promedio: hayNotas
              ? obtenerPromedioSimple(
                  notasPeriodo
                )
              : null,
            promedioEstimado: hayNotas,
          };

          setResumen(resumenLocal);
          setOrigen('sqlite');
          setCargandoResumen(false);
        }
      } catch (errorLocal) {
        console.warn(
          'HU-07: error consultando resumen SQLite:',
          errorLocal.message
        );
      }

      // ========================================
      // PASO 2: ACTUALIZAR DESDE EL BACKEND
      // ========================================

      try {
        const [
          materiasResult,
          actividadesResult,
          periodoResult,
        ] = await Promise.allSettled([
          consultarApi(
            `${apiUrl}/api/subjects/mis-materias-estudiante`,
            accessToken,
            signal
          ),
          consultarApi(
            `${apiUrl}/api/activities/mis-actividades-estudiante`,
            accessToken,
            signal
          ),
          consultarApi(
            `${apiUrl}/api/academic/periodo-actual`,
            accessToken,
            signal
          ),
        ]);

        if (signal.aborted) return;

        const materiasData =
          materiasResult.status === 'fulfilled'
            ? materiasResult.value
            : null;

        const actividadesData =
          actividadesResult.status === 'fulfilled'
            ? actividadesResult.value
            : null;

        const periodoData =
          periodoResult.status === 'fulfilled'
            ? periodoResult.value
            : null;

        const datosOnline =
          Boolean(materiasData) ||
          Boolean(actividadesData) ||
          Boolean(periodoData);

        if (!datosOnline) {
          setAviso(
            hayCopia
              ? 'Sin conexión. Mostrando el resumen guardado.'
              : 'No se pudo consultar el resumen académico.'
          );
          return;
        }

        let nuevoResumen = {
          ...resumenLocal,
        };

        if (materiasData?.resumenAcademico) {
          const academico =
            materiasData.resumenAcademico;

          nuevoResumen = {
            ...nuevoResumen,
            grado:
              academico.grado ??
              nuevoResumen.grado,
            grupo:
              academico.grupo ??
              nuevoResumen.grupo,
            totalMaterias:
              academico.totalMaterias ??
              nuevoResumen.totalMaterias,
          };
        }

        if (
          Array.isArray(
            actividadesData?.actividades
          )
        ) {
          const pendientes =
            actividadesData.actividades.filter(
              (actividad) => {
                if (
                  actividad.estado &&
                  actividad.estado !== 'publicada'
                ) {
                  return false;
                }

                const entrega = primero(
                  actividad.entrega
                );

                return !esEntregaCompletada(
                  entrega?.estado
                );
              }
            ).length;

          nuevoResumen.pendientes =
            pendientes;
        }

        const periodoActual =
          periodoData?.periodo;

        if (periodoActual) {
          nuevoResumen.periodo =
            obtenerPeriodoNumero(
              periodoActual.nombre
            );
        }

        setResumen(nuevoResumen);
        setOrigen('servidor');

        // Recuperar el promedio oficial únicamente
        // cuando exista un periodo actual válido.
        if (periodoActual?.id) {
          try {
            const notasData =
              await consultarApi(
                `${apiUrl}/api/grades/estudiante/mis-calificaciones?periodoId=${encodeURIComponent(periodoActual.id)}`,
                accessToken,
                signal
              );

            if (signal.aborted) return;

            // Respetamos el valor devuelto
            // por el backend. No inventamos nota.
            const promedioOficial =
              notasData.resumen?.promedio ??
              notasData.promediosPeriodos?.find(
                (periodo) =>
                  String(periodo.periodoId) ===
                  String(periodoActual.id)
              )?.promedio ??
              null;

            setResumen((anterior) => ({
              ...anterior,
              promedio: promedioOficial,
              promedioEstimado: false,
            }));
          } catch (errorPromedio) {
            // Si no existe promedio oficial,
            // conservamos los datos locales,
            // identificados como estimados.
            console.log(
              'HU-07: promedio oficial no disponible:',
              errorPromedio.message
            );
          }
        }
      } catch (error) {
        if (!signal.aborted) {
          setAviso(
            hayCopia
              ? 'Resumen recuperado desde SQLite.'
              : 'No fue posible consultar el resumen.'
          );
        }
      } finally {
        if (!signal.aborted) {
          setCargandoResumen(false);
          setActualizando(false);
        }
      }
    },
    [
      usuario?.id,
      apiUrl,
      accessToken,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();

    cargarResumen(controller.signal);

    return () => {
      controller.abort();
    };
  }, [cargarResumen]);

  const promedioTexto =
    resumen.promedio !== null &&
    resumen.promedio !== undefined &&
    Number.isFinite(
      Number(resumen.promedio)
    )
      ? Number(
          resumen.promedio
        ).toFixed(2)
      : '-';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.contentContainer
      }
      showsVerticalScrollIndicator={false}
    >
      {/* CABECERA EXISTENTE */}

      <ProfileDashboardHeader
        apiUrl={apiUrl}
        accessToken={accessToken}
      >
        <View style={styles.academicSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {valorResumen(
                resumen.grado
              )}
            </Text>
            <Text style={styles.summaryLabel}>
              Grado
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {valorResumen(
                resumen.grupo
              )}
            </Text>
            <Text style={styles.summaryLabel}>
              Grupo
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {valorResumen(
                resumen.totalMaterias
              )}
            </Text>
            <Text style={styles.summaryLabel}>
              Materias
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {valorResumen(
                resumen.pendientes
              )}
            </Text>
            <Text style={styles.summaryLabel}>
              Pendientes
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {resumen.periodo}
            </Text>
            <Text style={styles.summaryLabel}>
              Periodo
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {promedioTexto}
            </Text>

            <Text style={styles.summaryLabel}>
              Promedio
            </Text>

            {resumen.promedioEstimado &&
              resumen.promedio !== null && (
                <Text style={styles.estimado}>
                  Estimado
                </Text>
              )}
          </View>
        </View>
      </ProfileDashboardHeader>

      {/* ESTADO DEL RESUMEN */}

      <View style={styles.estadoResumen}>
        <View
          style={[
            styles.estadoPunto,
            {
              backgroundColor:
                origen === 'servidor'
                  ? '#21845B'
                  : origen === 'sqlite'
                    ? '#C18A29'
                    : '#A0AAB6',
            },
          ]}
        />

        <Text style={styles.estadoTexto}>
          {origen === 'servidor'
            ? 'Resumen consultado con el servidor'
            : origen === 'sqlite'
              ? 'Resumen local · puede estar desactualizado'
              : 'Resumen académico no disponible'}
        </Text>

        {cargandoResumen && (
          <ActivityIndicator
            size="small"
            color="#1F4E79"
          />
        )}
      </View>

      {aviso ? (
        <Text style={styles.aviso}>
          {aviso}
        </Text>
      ) : null}

      {/* INFORMACIÓN ACADÉMICA */}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Mi información académica
        </Text>

        <Text style={styles.cardText}>
          Consulta de materias, actividades y rendimiento.
        </Text>
      </View>

      {/* RECORDATORIOS HU-07 */}

      <StudentAcademicReminders
        usuarioId={usuario?.id}
        apiUrl={apiUrl}
        accessToken={accessToken}
        onViewActivities={onMyActivities}
      />

      {/* ACCESOS EXISTENTES */}

      <TouchableOpacity
        style={styles.card}
        onPress={onMySubjects}
        accessibilityRole="button"
      >
        <Text style={styles.cardTitle}>
          Mis materias
        </Text>

        <Text style={styles.cardText}>
          Consulta las materias correspondientes a tu grado y grupo.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={onMyActivities}
        accessibilityRole="button"
      >
        <Text style={styles.cardTitle}>
          Mis actividades
        </Text>

        <Text style={styles.cardText}>
          Consulta tus tareas, actividades y exámenes.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={onMyGrades}
        accessibilityRole="button"
      >
        <Text style={styles.cardTitle}>
          Mis calificaciones
        </Text>

        <Text style={styles.cardText}>
          Consulta tus notas y la retroalimentación de tus actividades.
        </Text>
      </TouchableOpacity>

      {typeof onMyAttendance === 'function' && (
        <TouchableOpacity
          style={styles.card}
          onPress={onMyAttendance}
          accessibilityRole="button"
          accessibilityLabel="Consultar mi asistencia"
        >
          <Text style={styles.cardTitle}>
            Mi asistencia
          </Text>

          <Text style={styles.cardText}>
            Consulta tus asistencias, inasistencias
            y llegadas tarde, organizadas por
            fecha y materia.
          </Text>
        </TouchableOpacity>
      )}

      {typeof onMyCommunications === 'function' && (
        <TouchableOpacity
          style={styles.card}
          onPress={onMyCommunications}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Consultar mis comunicados institucionales"
        >
          <Text style={styles.cardTitle}>
            📢 Mis comunicados
          </Text>

          <Text style={styles.cardText}>
            Consulta los avisos, novedades y comunicados
            publicados por tu institución educativa.
          </Text>
        </TouchableOpacity>
      )}

      <StudentAcademicRecommendations
        estudianteId={usuario?.id}
        apiUrl={apiUrl}
        accessToken={accessToken}
      />

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={onLogout}
        accessibilityRole="button"
      >
        <Text style={styles.logoutText}>
          Cerrar sesión
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 50,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E6ED',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14,
    color: '#455A64',
    lineHeight: 21,
  },
  logoutButton: {
    marginTop: 30,
    backgroundColor: '#B3261E',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  academicSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F4E79',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#607D8B',
    textAlign: 'center',
  },
  estimado: {
    marginTop: 3,
    fontSize: 9,
    color: '#9A6A18',
    fontWeight: '700',
  },
  estadoResumen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 15,
    gap: 9,
  },
  estadoPunto: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
  estadoTexto: {
    flex: 1,
    color: '#607D8B',
    fontSize: 11,
    fontWeight: '600',
  },
  aviso: {
    color: '#91651D',
    fontSize: 12,
    marginBottom: 15,
    lineHeight: 18,
  },
});
