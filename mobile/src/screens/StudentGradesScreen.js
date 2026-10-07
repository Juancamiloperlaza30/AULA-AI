import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';

import {
  guardarCalificacionesLocales,
  obtenerCalificacionesLocales,
} from '../../database/localDatabase';

const StudentGradesScreen = ({
  apiUrl,
  accessToken,
  usuarioId,
  onBack,
}) => {
  const [
    calificaciones,
    setCalificaciones,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    actualizando,
    setActualizando,
  ] = useState(false);

  const [
    modoOffline,
    setModoOffline,
  ] = useState(false);

  const [
    materiaSeleccionada,
    setMateriaSeleccionada,
  ] = useState('Todas');

  const normalizarCalificacion =
    useCallback(
      (item) => {
        if (modoOffline) {
          return {
            id: item.id,
            valor:
              Number(item.valor) || 0,
            titulo:
              item.actividad_titulo ||
              'Actividad',
            tipo:
              item.actividad_tipo ||
              'actividad',
            materia:
              item.materia ||
              'Materia',
            grado:
              item.grado || '',
            grupo:
              item.grupo || '',
            retroalimentacion:
              item.retroalimentacion ||
              '',
            fecha:
              item.updated_at ||
              item.created_at ||
              '',
          };
        }

        const actividad =
          item.actividad;

        const asignacion =
          actividad
            ?.materia_grupo_periodo;

        return {
          id: item.id,
          valor:
            Number(item.valor) || 0,
          titulo:
            actividad?.titulo ||
            'Actividad',
          tipo:
            actividad?.tipo ||
            'actividad',
          materia:
            asignacion
              ?.materia
              ?.nombre ||
            'Materia',
          grado:
            asignacion
              ?.grado
              ?.nombre ||
            '',
          grupo:
            asignacion
              ?.grupo
              ?.nombre ||
            '',
          retroalimentacion:
            item.retroalimentacion ||
            '',
          fecha:
            item.updated_at ||
            item.created_at ||
            '',
        };
      },
      [modoOffline]
    );

  const calificacionesNormalizadas =
    useMemo(
      () =>
        calificaciones.map(
          normalizarCalificacion
        ),
      [
        calificaciones,
        normalizarCalificacion,
      ]
    );

  const materiasDisponibles =
    useMemo(() => {
      const materias =
        calificacionesNormalizadas
          .map(
            (item) =>
              item.materia
          )
          .filter(Boolean);

      return [
        'Todas',
        ...Array.from(
          new Set(materias)
        ),
      ];
    }, [
      calificacionesNormalizadas,
    ]);

  const calificacionesFiltradas =
    useMemo(() => {
      if (
        materiaSeleccionada ===
        'Todas'
      ) {
        return calificacionesNormalizadas;
      }

      return calificacionesNormalizadas.filter(
        (item) =>
          item.materia ===
          materiaSeleccionada
      );
    }, [
      calificacionesNormalizadas,
      materiaSeleccionada,
    ]);

  const promedioVisible =
    useMemo(() => {
      if (
        calificacionesFiltradas.length === 0
      ) {
        return 0;
      }

      const total =
        calificacionesFiltradas.reduce(
          (suma, item) =>
            suma +
            Number(item.valor),
          0
        );

      return (
        total /
        calificacionesFiltradas.length
      );
    }, [
      calificacionesFiltradas,
    ]);

  const cargarCalificaciones =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `${apiUrl}/api/grades/estudiante/mis-calificaciones`,
              {
                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.message ||
                'No fue posible consultar las calificaciones.'
            );
          }

          const nuevasCalificaciones =
            data.calificaciones || [];

          setCalificaciones(
            nuevasCalificaciones
          );

          setModoOffline(false);

          await guardarCalificacionesLocales(
            usuarioId,
            nuevasCalificaciones
          );
        } catch (error) {
          console.log(
            'Consulta online de calificaciones no disponible:',
            error
          );

          const locales =
            await obtenerCalificacionesLocales(
              usuarioId
            );

          setCalificaciones(
            locales || []
          );

          setModoOffline(true);
        } finally {
          setCargando(false);
          setActualizando(false);
        }
      },
      [
        accessToken,
        apiUrl,
        usuarioId,
      ]
    );

  useEffect(() => {
    Promise.resolve().then(
      cargarCalificaciones
    );
  }, [cargarCalificaciones]);

  const formatearFecha =
    (fecha) => {
      if (!fecha) {
        return '';
      }

      try {
        return new Date(
          fecha
        ).toLocaleDateString(
          'es-CO',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }
        );
      } catch {
        return '';
      }
    };

  const obtenerInicialMateria =
    (materia) => {
      if (!materia) {
        return 'M';
      }

      return materia
        .trim()
        .charAt(0)
        .toUpperCase();
    };

  const renderCalificacion =
    ({ item }) => (
      <View
        style={
          styles.card
        }
      >
        <View
          style={
            styles.cardTop
          }
        >
          <View
            style={
              styles.materiaIcon
            }
          >
            <Text
              style={
                styles.materiaIconText
              }
            >
              {
                obtenerInicialMateria(
                  item.materia
                )
              }
            </Text>
          </View>

          <View
            style={
              styles.cardInfo
            }
          >
            <Text
              style={
                styles.materia
              }
            >
              {item.materia}
            </Text>

            <Text
              style={
                styles.titulo
              }
              numberOfLines={2}
            >
              {item.titulo}
            </Text>
          </View>

          <View
            style={
              styles.notaBox
            }
          >
            <Text
              style={
                styles.nota
              }
            >
              {item.valor.toFixed(2)}
            </Text>

            <Text
              style={
                styles.notaMax
              }
            >
              / 5.00
            </Text>
          </View>
        </View>

        <View
          style={
            styles.divider
          }
        />

        <View
          style={
            styles.detalles
          }
        >
          <View
            style={
              styles.badge
            }
          >
            <Text
              style={
                styles.badgeText
              }
            >
              {item.tipo}
            </Text>
          </View>

          {item.grado ||
          item.grupo ? (
            <Text
              style={
                styles.grupoTexto
              }
            >
              {item.grado}
              {
                item.grupo
                  ? ` · ${item.grupo}`
                  : ''
              }
            </Text>
          ) : null}

          {item.fecha ? (
            <Text
              style={
                styles.fecha
              }
            >
              {
                formatearFecha(
                  item.fecha
                )
              }
            </Text>
          ) : null}
        </View>

        {item.retroalimentacion ? (
          <View
            style={
              styles.feedbackBox
            }
          >
            <Text
              style={
                styles.feedbackLabel
              }
            >
              Retroalimentación
            </Text>

            <Text
              style={
                styles.feedbackText
              }
            >
              {
                item.retroalimentacion
              }
            </Text>
          </View>
        ) : null}
      </View>
    );

  if (cargando) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.centro
          }
        >
          <ActivityIndicator
            size="large"
          />

          <Text
            style={
              styles.cargandoTexto
            }
          >
            Cargando tus
            calificaciones...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
      <View
        style={
          styles.header
        }
      >
        <TouchableOpacity
          style={
            styles.backButton
          }
          onPress={
            onBack
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ‹
          </Text>
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.headerTitle
            }
          >
            Mis calificaciones
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Rendimiento académico
          </Text>
        </View>
      </View>

      {modoOffline && (
        <View
          style={
            styles.offlineBanner
          }
        >
          <Text
            style={
              styles.offlineTitle
            }
          >
            Modo sin conexión
          </Text>

          <Text
            style={
              styles.offlineText
            }
          >
            Mostrando las últimas
            calificaciones
            sincronizadas.
          </Text>
        </View>
      )}

      <View
        style={
          styles.summaryContainer
        }
      >
        <View
          style={
            styles.summaryCard
          }
        >
          <Text
            style={
              styles.summaryLabel
            }
          >
            Promedio
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {promedioVisible.toFixed(2)}
          </Text>

          <Text
            style={
              styles.summarySmall
            }
          >
            sobre 5.00
          </Text>
        </View>

        <View
          style={
            styles.summaryCard
          }
        >
          <Text
            style={
              styles.summaryLabel
            }
          >
            Calificaciones
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {
              calificacionesFiltradas
                .length
            }
          </Text>

          <Text
            style={
              styles.summarySmall
            }
          >
            registradas
          </Text>
        </View>
      </View>

      <View
        style={
          styles.filterSection
        }
      >
        <Text
          style={
            styles.filterTitle
          }
        >
          Filtrar por materia
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filterScrollContent
          }
        >
          {materiasDisponibles.map(
            (materia) => {
              const activa =
                materiaSeleccionada ===
                materia;

              return (
                <TouchableOpacity
                  key={materia}
                  style={[
                    styles.filterChip,
                    activa &&
                      styles.filterChipActive,
                  ]}
                  onPress={() =>
                    setMateriaSeleccionada(
                      materia
                    )
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activa &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {materia}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      <View
        style={
          styles.performanceCard
        }
      >
        <Text
          style={
            styles.performanceTitle
          }
        >
          Resumen de rendimiento
        </Text>

        <View
          style={
            styles.performanceRow
          }
        >
          <View
            style={
              styles.performanceItem
            }
          >
            <Text
              style={
                styles.performanceNumber
              }
            >
              {
                calificacionesFiltradas.filter(
                  (item) =>
                    Number(item.valor) >= 4
                ).length
              }
            </Text>

            <Text
              style={
                styles.performanceLabel
              }
            >
              Alto
            </Text>
          </View>

          <View
            style={
              styles.performanceItem
            }
          >
            <Text
              style={
                styles.performanceNumber
              }
            >
              {
                calificacionesFiltradas.filter(
                  (item) => {
                    const valor =
                      Number(item.valor);

                    return (
                      valor >= 3 &&
                      valor < 4
                    );
                  }
                ).length
              }
            </Text>

            <Text
              style={
                styles.performanceLabel
              }
            >
              Medio
            </Text>
          </View>

          <View
            style={
              styles.performanceItem
            }
          >
            <Text
              style={
                styles.performanceNumber
              }
            >
              {
                calificacionesFiltradas.filter(
                  (item) =>
                    Number(item.valor) < 3
                ).length
              }
            </Text>

            <Text
              style={
                styles.performanceLabel
              }
            >
              Por mejorar
            </Text>
          </View>
        </View>
      </View>

      <View
        style={
          styles.sectionHeader
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Resultados
        </Text>

        <Text
          style={
            styles.sectionCount
          }
        >
          {
            calificacionesFiltradas
              .length
          }
        </Text>
      </View>

      <FlatList
        data={
          calificacionesFiltradas
        }
        keyExtractor={
          (item) =>
            String(item.id)
        }
        renderItem={
          renderCalificacion
        }
        contentContainerStyle={
          calificacionesFiltradas
            .length
            ? styles.lista
            : styles.listaVacia
        }
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              actualizando
            }
            onRefresh={() => {
              setActualizando(true);
              cargarCalificaciones();
            }}
          />
        }
        ListEmptyComponent={
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Aún no tienes
              calificaciones
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Cuando tus docentes
              registren notas,
              aparecerán aquí.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F4F7FB',
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 14,
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        '#FFFFFF',
      justifyContent:
        'center',
      alignItems:
        'center',
      marginRight: 12,
    },

    backText: {
      fontSize: 32,
      lineHeight: 34,
      fontWeight: '400',
    },

    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
    },

    headerSubtitle: {
      marginTop: 2,
      fontSize: 13,
      opacity: 0.55,
    },

    offlineBanner: {
      marginHorizontal: 20,
      marginBottom: 14,
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        '#FFF4D6',
    },

    offlineTitle: {
      fontWeight: '700',
      fontSize: 14,
    },

    offlineText: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 18,
      opacity: 0.75,
    },

    summaryContainer: {
      flexDirection: 'row',
      gap: 12,
      marginHorizontal: 20,
      marginBottom: 22,
    },

    summaryCard: {
      flex: 1,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 18,
    },

    summaryLabel: {
      fontSize: 13,
      opacity: 0.55,
      fontWeight: '600',
    },

    summaryValue: {
      marginTop: 8,
      fontSize: 30,
      fontWeight: '800',
    },

    summarySmall: {
      marginTop: 2,
      fontSize: 12,
      opacity: 0.55,
    },

    filterSection: {
      marginBottom: 20,
    },

    filterTitle: {
      marginHorizontal: 20,
      marginBottom: 10,
      fontSize: 14,
      fontWeight: '700',
    },

    filterScroll: {
      flexGrow: 0,
    },

    filterScrollContent: {
      paddingHorizontal: 20,
      gap: 8,
    },

    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: '#E9EEF5',
    },

    filterChipActive: {
      backgroundColor: '#2D405D',
    },

    filterChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#2D405D',
    },

    filterChipTextActive: {
      color: '#FFFFFF',
    },

    performanceCard: {
      marginHorizontal: 20,
      marginBottom: 22,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 18,
    },

    performanceTitle: {
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 16,
    },

    performanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },

    performanceItem: {
      flex: 1,
      alignItems: 'center',
    },

    performanceNumber: {
      fontSize: 24,
      fontWeight: '900',
      color: '#2D405D',
    },

    performanceLabel: {
      marginTop: 4,
      fontSize: 12,
      opacity: 0.6,
      textAlign: 'center',
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 12,
    },

    sectionTitle: {
      flex: 1,
      fontSize: 19,
      fontWeight: '800',
    },

    sectionCount: {
      minWidth: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        '#E8EEF6',
      textAlign: 'center',
      textAlignVertical:
        'center',
      fontSize: 13,
      fontWeight: '700',
    },

    lista: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },

    listaVacia: {
      flexGrow: 1,
      justifyContent:
        'center',
      paddingHorizontal: 20,
      paddingBottom: 40,
    },

    card: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
    },

    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    materiaIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor:
        '#EAF0F8',
      justifyContent:
        'center',
      alignItems:
        'center',
      marginRight: 12,
    },

    materiaIconText: {
      fontSize: 19,
      fontWeight: '800',
    },

    cardInfo: {
      flex: 1,
      paddingRight: 10,
    },

    materia: {
      fontSize: 12,
      fontWeight: '700',
      opacity: 0.55,
      textTransform:
        'uppercase',
    },

    titulo: {
      marginTop: 3,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 21,
    },

    notaBox: {
      minWidth: 72,
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderRadius: 15,
      backgroundColor:
        '#F0F4F8',
      alignItems: 'center',
    },

    nota: {
      fontSize: 22,
      fontWeight: '900',
    },

    notaMax: {
      marginTop: -2,
      fontSize: 10,
      opacity: 0.55,
    },

    divider: {
      height: 1,
      backgroundColor:
        '#EDF0F4',
      marginVertical: 14,
    },

    detalles: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor:
        '#EEF2F7',
      borderRadius: 20,
    },

    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform:
        'capitalize',
    },

    grupoTexto: {
      fontSize: 12,
      opacity: 0.55,
    },

    fecha: {
      marginLeft: 'auto',
      fontSize: 11,
      opacity: 0.5,
    },

    feedbackBox: {
      marginTop: 14,
      padding: 13,
      borderRadius: 14,
      backgroundColor:
        '#F7F9FC',
    },

    feedbackLabel: {
      fontSize: 11,
      fontWeight: '800',
      opacity: 0.55,
      textTransform:
        'uppercase',
    },

    feedbackText: {
      marginTop: 5,
      fontSize: 13,
      lineHeight: 19,
    },

    centro: {
      flex: 1,
      justifyContent:
        'center',
      alignItems:
        'center',
    },

    cargandoTexto: {
      marginTop: 12,
      fontSize: 14,
      opacity: 0.65,
    },

    emptyCard: {
      backgroundColor:
        '#FFFFFF',
      padding: 28,
      borderRadius: 20,
      alignItems:
        'center',
    },

    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
    },

    emptyText: {
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
      opacity: 0.6,
    },
  });

export default StudentGradesScreen;
