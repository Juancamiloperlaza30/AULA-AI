import React, {
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

const ActivitySubmissionsScreen = ({
  apiUrl,
  accessToken,
  activity,
  onBack,
}) => {
  const [entregas, setEntregas] =
    useState([]);

  const [actividadInfo, setActividadInfo] =
    useState(null);

  const [cargando, setCargando] =
    useState(true);

  useEffect(() => {
    let activo = true;

    const cargarEntregas = async () => {
      try {
        const response =
          await fetch(
            `${apiUrl}/api/activities/${activity.id}/entregas`,
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
                'No fue posible consultar las entregas.'
            );
          }

          return;
        }

        if (activo) {
          setActividadInfo(
            data.actividad || null
          );

          setEntregas(
            data.entregas || []
          );
        }
      } catch (error) {
        if (activo) {
          console.log(
            'Error consultando entregas de la actividad:',
            error
          );

          Alert.alert(
            'Sin conexión',
            'No fue posible consultar las entregas en este momento.'
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarEntregas();

    return () => {
      activo = false;
    };
  }, [apiUrl, accessToken, activity.id]);

  const formatearFechaHora =
    (fecha) => {
      if (!fecha) {
        return '-';
      }

      return new Date(
        fecha
      ).toLocaleString(
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

  const abrirRecurso =
    async (url) => {
      try {
        const disponible =
          await Linking.canOpenURL(
            url
          );

        if (!disponible) {
          Alert.alert(
            'Error',
            'No fue posible abrir este recurso.'
          );

          return;
        }

        await Linking.openURL(
          url
        );
      } catch (error) {
        console.log(
          'Error abriendo recurso de entrega:',
          error
        );

        Alert.alert(
          'Error',
          'No fue posible abrir el recurso.'
        );
      }
    };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

        <Text>
          Cargando entregas...
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
        Entregas
      </Text>

      <Text style={styles.activityTitle}>
        {actividadInfo?.titulo ||
          activity?.titulo}
      </Text>

      <Text style={styles.deadline}>
        Fecha límite:{' '}
        {formatearFechaHora(
          actividadInfo?.fechaLimite
        )}
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryNumber}>
          {entregas.length}
        </Text>

        <Text style={styles.summaryText}>
          Entregas recibidas
        </Text>
      </View>

      {entregas.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            Sin entregas
          </Text>

          <Text style={styles.emptyText}>
            Ningún estudiante ha entregado esta actividad todavía.
          </Text>
        </View>
      ) : (
        entregas.map(
          (entrega) => {
            const estudiante =
              entrega.estudiante;

            const esTarde =
              entrega.entregada_tarde;

            return (
              <View
                key={entrega.id}
                style={styles.card}
              >
                <View
                  style={
                    styles.cardHeader
                  }
                >
                  <View style={styles.studentInfo}>
                    <Text
                      style={
                        styles.studentName
                      }
                    >
                      {estudiante?.nombres}{' '}
                      {estudiante?.apellidos}
                    </Text>

                    <Text
                      style={
                        styles.studentEmail
                      }
                    >
                      {estudiante?.correo}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      esTarde
                        ? styles.lateBadge
                        : styles.successBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        esTarde
                          ? styles.lateText
                          : styles.successText,
                      ]}
                    >
                      {esTarde
                        ? 'Con retraso'
                        : 'A tiempo'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.infoLabel}>
                  Fecha y hora de entrega
                </Text>

                <Text style={styles.infoValue}>
                  {formatearFechaHora(
                    entrega.fecha_entrega
                  )}
                </Text>

                {entrega.comentario ? (
                  <>
                    <Text
                      style={
                        styles.infoLabel
                      }
                    >
                      Comentario
                    </Text>

                    <Text
                      style={
                        styles.comment
                      }
                    >
                      {entrega.comentario}
                    </Text>
                  </>
                ) : null}

                <Text
                  style={
                    styles.resourcesTitle
                  }
                >
                  Archivos y enlaces
                </Text>

                {entrega.recursos?.length >
                0 ? (
                  entrega.recursos.map(
                    (recurso) => (
                      <TouchableOpacity
                        key={recurso.id}
                        style={
                          styles.resourceCard
                        }
                        onPress={() =>
                          abrirRecurso(
                            recurso.url
                          )
                        }
                      >
                        <View
                          style={
                            styles.resourceInfo
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
                              ? 'Enlace externo'
                              : 'Archivo adjunto'}
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.openText
                          }
                        >
                          {recurso.tipo_recurso ===
                          'enlace'
                            ? 'Abrir'
                            : 'Abrir / descargar'}
                        </Text>
                      </TouchableOpacity>
                    )
                  )
                ) : (
                  <Text style={styles.noResources}>
                    El estudiante no adjuntó archivos ni enlaces.
                  </Text>
                )}
              </View>
            );
          }
        )
      )}

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backText}>
          Volver a actividades
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles =
  StyleSheet.create({
    container: {
      padding: 20,
      paddingBottom: 40,
    },

    center: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      gap: 10,
    },

    title: {
      fontSize: 27,
      fontWeight: 'bold',
      marginBottom: 5,
    },

    activityTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 5,
    },

    deadline: {
      color: '#607D8B',
      marginBottom: 18,
    },

    summaryCard: {
      backgroundColor: '#F3F6F9',
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      alignItems: 'center',
    },

    summaryNumber: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#2D405D',
    },

    summaryText: {
      marginTop: 3,
      color: '#607D8B',
    },

    card: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E0E5EB',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },

    cardHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },

    studentInfo: {
      flex: 1,
      paddingRight: 10,
    },

    studentName: {
      fontSize: 17,
      fontWeight: 'bold',
      marginBottom: 3,
    },

    studentEmail: {
      fontSize: 12,
      color: '#607D8B',
    },

    statusBadge: {
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    successBadge: {
      backgroundColor: '#E8F5E9',
    },

    lateBadge: {
      backgroundColor: '#FFEBEE',
    },

    statusText: {
      fontSize: 11,
      fontWeight: 'bold',
    },

    successText: {
      color: '#2E7D32',
    },

    lateText: {
      color: '#C62828',
    },

    infoLabel: {
      marginTop: 10,
      fontSize: 12,
      color: '#607D8B',
    },

    infoValue: {
      marginTop: 3,
      fontWeight: '600',
    },

    comment: {
      marginTop: 4,
      lineHeight: 20,
    },

    resourcesTitle: {
      marginTop: 16,
      marginBottom: 8,
      fontWeight: 'bold',
    },

    resourceCard: {
      backgroundColor: '#F5F7FA',
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    resourceInfo: {
      flex: 1,
      paddingRight: 10,
    },

    resourceName: {
      fontWeight: '600',
      marginBottom: 3,
    },

    resourceType: {
      fontSize: 12,
      color: '#607D8B',
    },

    openText: {
      color: '#2D405D',
      fontWeight: 'bold',
      fontSize: 12,
    },

    noResources: {
      color: '#607D8B',
      fontStyle: 'italic',
    },

    emptyCard: {
      padding: 24,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#E0E5EB',
      alignItems: 'center',
    },

    emptyTitle: {
      fontWeight: 'bold',
      fontSize: 17,
      marginBottom: 6,
    },

    emptyText: {
      color: '#607D8B',
      textAlign: 'center',
    },

    backButton: {
      marginTop: 12,
      padding: 14,
      alignItems: 'center',
    },

    backText: {
      color: '#2D405D',
      fontWeight: '600',
    },
  });

export default ActivitySubmissionsScreen;
