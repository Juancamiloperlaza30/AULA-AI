
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

import { Ionicons } from '@expo/vector-icons';

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
        studentPremium
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

      <View style={styles.introCard}>
        <View style={styles.introIcon}>
          <Ionicons
            name="school-outline"
            size={25}
            color="#27C4E8"
          />
        </View>

        <View style={styles.introContent}>
          <Text style={styles.introTitle}>
            Mi espacio académico
          </Text>

          <Text style={styles.introText}>
            Consulta tus materias, actividades y rendimiento
            académico desde un solo lugar.
          </Text>
        </View>
      </View>

      {/* RECORDATORIOS HU-07 */}

      <StudentAcademicReminders
        usuarioId={usuario?.id}
        apiUrl={apiUrl}
        accessToken={accessToken}
        onViewActivities={onMyActivities}
      />

      {/* ACCESOS EXISTENTES */}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name="grid-outline"
            size={19}
            color="#123B73"
          />
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            Mis herramientas
          </Text>

          <Text style={styles.sectionSubtitle}>
            Accede a tu información académica
          </Text>
        </View>
      </View>

      <View style={styles.menuGrid}>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={onMySubjects}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <View style={[styles.menuIcon, styles.iconBlue]}>
            <Ionicons
              name="book-outline"
              size={25}
              color="#123B73"
            />
          </View>

          <Text style={styles.menuTitle}>
            Mis materias
          </Text>

          <Text style={styles.menuDescription}>
            Consulta tus asignaturas
          </Text>

          <Ionicons
            name="arrow-forward-circle-outline"
            size={21}
            color="#27C4E8"
            style={styles.menuArrow}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={onMyActivities}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <View style={[styles.menuIcon, styles.iconCyan]}>
            <Ionicons
              name="clipboard-outline"
              size={25}
              color="#0891B2"
            />
          </View>

          <Text style={styles.menuTitle}>
            Mis actividades
          </Text>

          <Text style={styles.menuDescription}>
            Tareas y evaluaciones
          </Text>

          <Ionicons
            name="arrow-forward-circle-outline"
            size={21}
            color="#27C4E8"
            style={styles.menuArrow}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={onMyGrades}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <View style={[styles.menuIcon, styles.iconPurple]}>
            <Ionicons
              name="ribbon-outline"
              size={25}
              color="#7353B6"
            />
          </View>

          <Text style={styles.menuTitle}>
            Mis calificaciones
          </Text>

          <Text style={styles.menuDescription}>
            Notas y rendimiento
          </Text>

          <Ionicons
            name="arrow-forward-circle-outline"
            size={21}
            color="#27C4E8"
            style={styles.menuArrow}
          />
        </TouchableOpacity>

        {typeof onMyAttendance === 'function' && (
          <TouchableOpacity
            style={styles.menuCard}
            onPress={onMyAttendance}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Consultar mi asistencia"
          >
            <View style={[styles.menuIcon, styles.iconGreen]}>
              <Ionicons
                name="calendar-outline"
                size={25}
                color="#16845B"
              />
            </View>

            <Text style={styles.menuTitle}>
              Mi asistencia
            </Text>

            <Text style={styles.menuDescription}>
              Asistencias y llegadas tarde
            </Text>

            <Ionicons
              name="arrow-forward-circle-outline"
              size={21}
              color="#27C4E8"
              style={styles.menuArrow}
            />
          </TouchableOpacity>
        )}

        {typeof onMyCommunications === 'function' && (
          <TouchableOpacity
            style={styles.menuCard}
            onPress={onMyCommunications}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Consultar mis comunicados institucionales"
          >
            <View style={[styles.menuIcon, styles.iconOrange]}>
              <Ionicons
                name="megaphone-outline"
                size={25}
                color="#C47A20"
              />
            </View>

            <Text style={styles.menuTitle}>
              Mis comunicados
            </Text>

            <Text style={styles.menuDescription}>
              Avisos de tu institución
            </Text>

            <Ionicons
              name="arrow-forward-circle-outline"
              size={21}
              color="#27C4E8"
              style={styles.menuArrow}
            />
          </TouchableOpacity>
        )}
      </View>

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
    backgroundColor: '#F4F7FB',
  },

  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 50,
  },

  academicSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },

  summaryItem: {
    width: '33.33%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
  },

  summaryValue: {
    fontSize: 21,
    fontWeight: '900',
    color: '#123B73',
  },

  summaryLabel: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },

  estimado: {
    marginTop: 4,
    fontSize: 10,
    color: '#B7791F',
    fontWeight: '700',
  },

  estadoResumen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E7EDF5',
    gap: 9,
  },

  estadoPunto: {
    height: 9,
    width: 9,
    borderRadius: 5,
  },

  estadoTexto: {
    flex: 1,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },

  aviso: {
    backgroundColor: '#FFF7E8',
    borderRadius: 12,
    padding: 12,
    color: '#91651D',
    fontSize: 12,
    marginBottom: 15,
    lineHeight: 18,
  },

  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#091D3A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 22,
    elevation: 3,
    shadowColor: '#091D3A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  introIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#17375B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  introContent: {
    flex: 1,
  },

  introTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },

  introText: {
    fontSize: 12,
    color: '#D6E5F5',
    lineHeight: 19,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },

  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#E7F1FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#091D3A',
  },

  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },

  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  menuCard: {
    width: '48%',
    minHeight: 184,
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E6ECF4',
    elevation: 2,
    shadowColor: '#091D3A',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  menuIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  iconBlue: {
    backgroundColor: '#E8F1FC',
  },

  iconCyan: {
    backgroundColor: '#E2F8FC',
  },

  iconPurple: {
    backgroundColor: '#F1EBFA',
  },

  iconGreen: {
    backgroundColor: '#E5F7EE',
  },

  iconOrange: {
    backgroundColor: '#FFF1DD',
  },

  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#091D3A',
    marginBottom: 5,
  },

  menuDescription: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },

  menuArrow: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },

  logoutButton: {
    marginTop: 22,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#F5D1CF',
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
  },

  logoutText: {
    color: '#B3261E',
    fontWeight: '800',
    fontSize: 15,
  },
});
