import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  guardarActividadesLocales,
  obtenerActividadesLocales,
} from '../../database/localDatabase';

const formatearFechaHora = (fecha) => {
  if (!fecha) {
    return '-';
  }

  return new Date(fecha).toLocaleString(
    'es-CO',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
};

const StudentActivitiesScreen = ({
  apiUrl,
  accessToken,
  usuarioId,
  onBack,
  onSubmitActivity,
  onViewSubmission,
}) => {
  const [actividades, setActividades] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  const [recarga, setRecarga] =
    useState(0);

  const [recursosPorActividad, setRecursosPorActividad] =
    useState({});

  const [
    materiaSeleccionada,
    setMateriaSeleccionada,
  ] = useState(null);

  useEffect(() => {
    let activo = true;

    const cargarActividades = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/activities/mis-actividades-estudiante`,
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
          if (activo) {
            Alert.alert(
              'Error',
              data.message ||
                'No fue posible consultar las actividades.'
            );
          }

          return;
        }

        if (activo) {
          const actividadesServidor =
            data.actividades || [];

          setActividades(
            actividadesServidor
          );

          await guardarActividadesLocales(
            usuarioId,
            actividadesServidor
          );
        }
      } catch (error) {
        if (!activo) {
          return;
        }

        console.log(
          'Error consultando actividades:',
          error
        );

        try {
          const actividadesLocales =
            await obtenerActividadesLocales(
              usuarioId
            );

          const actividadesAdaptadas =
            actividadesLocales.map(
              (item) => ({
                id: item.id,
                tipo: item.tipo,
                titulo: item.titulo,
                descripcion:
                  item.descripcion,
                fecha_publicacion:
                  item.fecha_publicacion,
                fecha_entrega:
                  item.fecha_entrega,
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

                entrega:
                  item.entrega_id
                    ? {
                        id:
                          item.entrega_id,

                        estado:
                          item.entrega_estado,

                        fecha_entrega:
                          item.entrega_fecha,

                        comentario:
                          item.entrega_comentario,

                        entregada_tarde:
                          item.entrega_estado ===
                          'entregada_tarde',
                      }
                    : null,

                calificacion:
                  item.calificacion_id
                      ? {
                          id:
                            item.calificacion_id,

                          valor:
                            item.calificacion_valor,

                          retroalimentacion:
                            item.calificacion_retroalimentacion,
                        }
                      : null,

                esOffline: true,
              })
            );

          setActividades(
            actividadesAdaptadas
          );

          if (
            actividadesAdaptadas.length === 0
          ) {
            Alert.alert(
              'Sin conexión',
              'No hay actividades sincronizadas disponibles.'
            );
          }
        } catch (errorLocal) {
          console.log(
            'Error leyendo actividades locales:',
            errorLocal
          );

          Alert.alert(
            'Error',
            'No fue posible consultar las actividades guardadas.'
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarActividades();

    return () => {
      activo = false;
    };
  }, [apiUrl, accessToken, usuarioId, recarga]);

  const obtenerEstadoFecha = (
    fechaEntrega
  ) => {
    const ahora = new Date();

    const entrega =
      new Date(fechaEntrega);

    if (entrega < ahora) {
      return 'Vencida';
    }

    const diferencia =
      entrega.getTime() -
      ahora.getTime();

    const dias =
      diferencia /
      (1000 * 60 * 60 * 24);

    if (dias <= 3) {
      return 'Próxima';
    }

    return 'Pendiente';
  };

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return '';
    }

    return new Date(
      fecha
    ).toLocaleString();
  };

  const deshacerEntrega = async (
    entregaId
  ) => {
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
              const response =
                await fetch(
                  `${apiUrl}/api/activities/entregas/${entregaId}/deshacer`,
                  {
                    method: 'PUT',

                    headers: {
                      Authorization:
                        `Bearer ${accessToken}`,
                    },
                  }
                );

              const data =
                await response.json();

              if (!response.ok) {
                Alert.alert(
                  'Error',
                  data.message ||
                    'No fue posible deshacer la entrega.'
                );

                return;
              }

              Alert.alert(
                'Entrega deshecha',
                'La entrega fue anulada correctamente.'
              );

              setRecarga(
                (actual) => actual + 1
              );
            } catch (error) {
              console.log(
                'Error deshaciendo entrega:',
                error
              );

              Alert.alert(
                'Sin conexión',
                'No fue posible deshacer la entrega en este momento.'
              );
            }
          },
        },
      ]
    );
  };

  const cargarRecursos = async (actividadId) => {
    try {
      const response = await fetch(
        `${apiUrl}/api/activities/${actividadId}/recursos`,
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
        Alert.alert(
          'Error',
          data.message ||
            'No fue posible consultar los recursos.'
        );

        return;
      }

      setRecursosPorActividad(
        (actuales) => ({
          ...actuales,
          [actividadId]:
            data.recursos || [],
        })
      );
    } catch (error) {
      console.log(
        'Error consultando recursos:',
        error
      );

      Alert.alert(
        'Sin conexión',
        'No fue posible consultar los recursos.'
      );
    }
  };

  const abrirRecurso = async (url) => {
    try {
      const compatible =
        await Linking.canOpenURL(url);

      if (!compatible) {
        Alert.alert(
          'Error',
          'No fue posible abrir este recurso.'
        );

        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.log(
        'Error abriendo recurso:',
        error
      );

      Alert.alert(
        'Error',
        'No fue posible abrir el recurso.'
      );
    }
  };

  const actividadesPorMateria =
    actividades.reduce(
      (acumulado, actividad) => {
        const nombreMateria =
          actividad
            .materia_grupo_periodo
            ?.materia
            ?.nombre ||
          'Sin materia';

        if (
          !acumulado[nombreMateria]
        ) {
          acumulado[nombreMateria] =
            [];
        }

        acumulado[
          nombreMateria
        ].push(
          actividad
        );

        return acumulado;
      },
      {}
    );

  Object.keys(
    actividadesPorMateria
  ).forEach(
    (materia) => {
      actividadesPorMateria[
        materia
      ].sort(
        (a, b) =>
          new Date(
            b.fecha_publicacion
          ) -
          new Date(
            a.fecha_publicacion
          )
      );
    }
  );

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text>
          Cargando actividades...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >
      <Text style={styles.title}>
        {materiaSeleccionada
          ? materiaSeleccionada
          : 'Mis actividades'}
      </Text>

      <Text style={styles.subtitle}>
        {materiaSeleccionada
          ? 'Consulta las actividades, tareas y exámenes de esta materia.'
          : 'Selecciona una materia para consultar tus actividades.'}
      </Text>

      {!materiaSeleccionada ? (
        <>
          {Object.keys(
            actividadesPorMateria
          ).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No hay materias disponibles
              </Text>

              <Text style={styles.emptyText}>
                Actualmente no tienes actividades asignadas.
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
                    key={
                      nombreMateria
                    }
                    style={
                      styles.subjectCard
                    }
                    onPress={() =>
                      setMateriaSeleccionada(
                        nombreMateria
                      )
                    }
                  >
                    <View
                      style={
                        styles.subjectIcon
                      }
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

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          styles.subjectTitle
                        }
                      >
                        {
                          nombreMateria
                        }
                      </Text>

                      <Text
                        style={
                          styles.subjectInfo
                        }
                      >
                        {
                          listaActividades.length
                        }{' '}
                        {
                          listaActividades.length ===
                          1
                            ? 'actividad'
                            : 'actividades'
                        }
                      </Text>

                      <Text
                        style={
                          styles.subjectPending
                        }
                      >
                        {
                          pendientes
                        }{' '}
                        pendientes
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.subjectArrow
                      }
                    >
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
            style={
              styles.subjectBackButton
            }
            onPress={() =>
              setMateriaSeleccionada(
                null
              )
            }
          >
            <Text
              style={
                styles.subjectBackText
              }
            >
              ← Ver materias
            </Text>
          </TouchableOpacity>

          {actividadesPorMateria[
            materiaSeleccionada
          ]?.map(
            (actividad) => {
              const estadoFecha =
                obtenerEstadoFecha(
                  actividad.fecha_entrega
                );

              const entrega =
                actividad.entrega;

              const tieneEntrega =
                !!entrega;

              const entregadaTarde =
                entrega?.estado ===
                'entregada_tarde';

              const calificacion =
                actividad.calificacion;

              return (
                <View
                  key={
                    actividad.id
                  }
                  style={
                    styles.card
                  }
                >
                  <View
                    style={
                      styles.cardHeader
                    }
                  >
                    <Text
                      style={
                        styles.type
                      }
                    >
                      {actividad.tipo?.toUpperCase()}
                    </Text>

                    <Text
                      style={
                        styles.state
                      }
                    >
                      {
                        estadoFecha
                      }
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.activityTitle
                    }
                  >
                    {
                      actividad.titulo
                    }
                  </Text>

                  {actividad.esOffline && (
                    <Text
                      style={
                        styles.offlineText
                      }
                    >
                      Disponible sin conexión
                    </Text>
                  )}

                  <Text
                    style={
                      styles.publicationDate
                    }
                  >
                    Publicada:{' '}
                    {formatearFecha(
                      actividad.fecha_publicacion
                    )}
                  </Text>

                  <Text
                    style={
                      styles.description
                    }
                  >
                    {
                      actividad.descripcion
                    }
                  </Text>

                  <Text
                    style={
                      styles.dateText
                    }
                  >
                    Fecha de entrega:{' '}
                    {formatearFecha(
                      actividad.fecha_entrega
                    )}
                  </Text>

                  <View
                    style={
                      styles.gradeSection
                    }
                  >
                    <Text
                      style={
                        styles.gradeLabel
                      }
                    >
                      Calificación
                    </Text>

                    {calificacion ? (
                      <>
                        <Text
                          style={
                            styles.gradeValue
                          }
                        >
                          {Number(
                            calificacion.valor
                          ).toFixed(2)}
                          {' / 5.00'}
                        </Text>

                        {calificacion
                          .retroalimentacion ? (
                          <View
                            style={
                              styles.feedbackSection
                            }
                          >
                            <Text
                              style={
                                styles.feedbackTitle
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
                                calificacion
                                  .retroalimentacion
                              }
                            </Text>
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <Text
                        style={
                          styles.gradePending
                        }
                      >
                        Pendiente por calificar
                      </Text>
                    )}
                  </View>

                  <View
                    style={
                      styles.deliverySection
                    }
                  >
                    {!tieneEntrega ? (
                      <>
                        <Text
                          style={
                            styles.deliveryPending
                          }
                        >
                          Sin entregar
                        </Text>

                        <Text
                          style={
                            styles.deliveryInfo
                          }
                        >
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

                        <Text
                          style={
                            styles.deliveryInfo
                          }
                        >
                          Entregada:{' '}
                          {formatearFechaHora(
                            entrega.fecha_entrega
                          )}
                        </Text>

                        {entrega.comentario ? (
                          <Text
                            style={
                              styles.deliveryComment
                            }
                          >
                            Comentario:{' '}
                            {
                              entrega.comentario
                            }
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.resourcesButton,
                      actividad.esOffline &&
                        styles.disabledButton,
                    ]}
                    onPress={() => {
                      if (
                        actividad.esOffline
                      ) {
                        Alert.alert(
                          'Sin conexión',
                          'Conéctate a Internet para consultar archivos y enlaces.'
                        );

                        return;
                      }

                      cargarRecursos(
                        actividad.id
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.resourcesButtonText,
                        actividad.esOffline &&
                          styles.disabledButtonText,
                      ]}
                    >
                      Ver archivos y enlaces
                    </Text>
                  </TouchableOpacity>

                  {recursosPorActividad[
                    actividad.id
                  ]?.map(
                    (recurso) => (
                      <TouchableOpacity
                        key={
                          recurso.id
                        }
                        style={
                          styles.resourceCard
                        }
                        onPress={() =>
                          abrirRecurso(
                            recurso.url
                          )
                        }
                      >
                        <Text
                          style={
                            styles.resourceName
                          }
                        >
                          {
                            recurso.nombre_original
                          }
                        </Text>

                        <Text
                          style={
                            styles.resourceType
                          }
                        >
                          {recurso.tipo_recurso ===
                          'enlace'
                            ? 'Abrir enlace'
                            : 'Abrir / descargar archivo'}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}

                  {!tieneEntrega && (
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        actividad.esOffline &&
                          styles.disabledButton,
                      ]}
                      onPress={() => {
                        if (
                          actividad.esOffline
                        ) {
                          Alert.alert(
                            'Sin conexión',
                            'Se requiere conexión a Internet para entregar una actividad.'
                          );

                          return;
                        }

                        onSubmitActivity(
                          actividad
                        );
                      }}
                    >
                      <Text
                        style={
                          styles.submitButtonText
                        }
                      >
                        Entregar actividad
                      </Text>
                    </TouchableOpacity>
                  )}

                  {tieneEntrega &&
                    !actividad.esOffline && (
                      <>
                        <TouchableOpacity
                          style={
                            styles.viewSubmissionButton
                          }
                          onPress={() =>
                            onViewSubmission(
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
                          style={
                            styles.undoButton
                          }
                          onPress={() =>
                            deshacerEntrega(
                              entrega.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.undoButtonText
                            }
                          >
                            Deshacer entrega
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                </View>
              );
            }
          )}
        </>
      )}

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text>
          Volver
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },

  title: {
    fontSize: 25,
    fontWeight: 'bold',
    marginBottom: 6,
  },

  subtitle: {
    color: '#607D8B',
    marginBottom: 20,
  },

  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E5EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#E9EEF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  subjectIconText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D405D',
  },

  subjectTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2D3D',
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
    borderColor: '#E0E5EB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
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
  },

  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  publicationDate: {
    fontSize: 12,
    color: '#607D8B',
    marginBottom: 10,
  },

  offlineText: {
    marginTop: 8,
    fontSize: 12,
    color: '#607D8B',
    fontWeight: '600',
  },

  description: {
    lineHeight: 20,
    marginBottom: 12,
  },

  info: {
    fontSize: 14,
    marginBottom: 4,
  },

  dateText: {
    marginTop: 10,
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
  },

  deliverySection: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F5F7FA',
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
    marginBottom: 3,
  },

  deliveryComment: {
    marginTop: 6,
    fontSize: 13,
    fontStyle: 'italic',
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
    backgroundColor: '#2D405D',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  emptyCard: {
    padding: 24,
    borderWidth: 1,
    borderColor: '#E0E5EB',
    borderRadius: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6,
  },

  emptyText: {
    color: '#607D8B',
  },

  backButton: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
  },
});

export default StudentActivitiesScreen;
