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

const MySubmissionScreen = ({
  apiUrl,
  accessToken,
  entregaId,
  onBack,
  onUndo,
}) => {
  const [entrega, setEntrega] =
    useState(null);

  const [cargando, setCargando] =
    useState(true);

  useEffect(() => {
    let activo = true;

    const cargarEntrega = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/activities/entregas/${entregaId}`,
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
                'No fue posible consultar la entrega.'
            );
          }

          return;
        }

        if (activo) {
          setEntrega(
            data.entrega
          );
        }
      } catch (_error) {
        if (activo) {
          Alert.alert(
            'Sin conexión',
            'No fue posible consultar tu entrega en este momento.'
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarEntrega();

    return () => {
      activo = false;
    };
  }, [apiUrl, accessToken, entregaId]);

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
          month: 'long',
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
      } catch (_error) {
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
          Cargando tu entrega...
        </Text>
      </View>
    );
  }

  if (!entrega) {
    return (
      <View style={styles.center}>
        <Text>
          No se encontró la entrega.
        </Text>

        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
        >
          <Text>
            Volver
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const esTarde =
    entrega.estado ===
    'entregada_tarde';

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >
      <Text style={styles.title}>
        Mi entrega
      </Text>

      <View style={styles.statusCard}>
        <Text
          style={
            esTarde
              ? styles.statusLate
              : styles.statusSuccess
          }
        >
          {esTarde
            ? 'Entregada con retraso'
            : 'Entregada a tiempo'}
        </Text>

        <Text style={styles.dateText}>
          Fecha de entrega:
        </Text>

        <Text style={styles.dateValue}>
          {formatearFechaHora(
            entrega.fechaEntrega
          )}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Comentario
      </Text>

      <View style={styles.contentCard}>
        <Text style={styles.commentText}>
          {entrega.comentario ||
            'No agregaste comentario.'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Archivos y enlaces enviados
      </Text>

      {entrega.recursos?.length > 0 ? (
        entrega.recursos.map(
          (recurso) => (
            <TouchableOpacity
              key={recurso.id}
              style={styles.resourceCard}
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

              <Text style={styles.openText}>
                {recurso.tipo_recurso ===
                'enlace'
                  ? 'Abrir'
                  : 'Abrir / descargar'}
              </Text>
            </TouchableOpacity>
          )
        )
      ) : (
        <View style={styles.contentCard}>
          <Text style={styles.emptyText}>
            No enviaste archivos ni enlaces.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.undoButton}
        onPress={() => {
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
                        `${apiUrl}/api/activities/entregas/${entrega.id}/deshacer`,
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
                      'La entrega fue anulada correctamente.',
                      [
                        {
                          text: 'Aceptar',
                          onPress: () =>
                            onUndo(),
                        },
                      ]
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
        }}
      >
        <Text
          style={
            styles.undoButtonText
          }
        >
          Deshacer entrega
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backText}>
          Volver a mis actividades
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
      padding: 20,
      gap: 12,
    },

    title: {
      fontSize: 26,
      fontWeight: 'bold',
      marginBottom: 20,
    },

    statusCard: {
      backgroundColor: '#F5F7FA',
      borderRadius: 14,
      padding: 16,
      marginBottom: 22,
    },

    statusSuccess: {
      fontSize: 17,
      fontWeight: 'bold',
      color: '#2E7D32',
      marginBottom: 12,
    },

    statusLate: {
      fontSize: 17,
      fontWeight: 'bold',
      color: '#C62828',
      marginBottom: 12,
    },

    dateText: {
      fontSize: 13,
      color: '#607D8B',
    },

    dateValue: {
      marginTop: 4,
      fontWeight: '600',
      fontSize: 15,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      marginBottom: 8,
      marginTop: 6,
    },

    contentCard: {
      borderWidth: 1,
      borderColor: '#E0E5EB',
      borderRadius: 12,
      padding: 14,
      marginBottom: 18,
      backgroundColor: '#FFFFFF',
    },

    commentText: {
      lineHeight: 20,
    },

    resourceCard: {
      borderWidth: 1,
      borderColor: '#E0E5EB',
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
    },

    resourceInfo: {
      flex: 1,
      paddingRight: 10,
    },

    resourceName: {
      fontWeight: '600',
      marginBottom: 4,
    },

    resourceType: {
      fontSize: 12,
      color: '#607D8B',
    },

    openText: {
      color: '#2D405D',
      fontWeight: 'bold',
      fontSize: 13,
    },

    emptyText: {
      color: '#607D8B',
    },

    undoButton: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: '#B00020',
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },

    undoButtonText: {
      color: '#B00020',
      fontWeight: 'bold',
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

export default MySubmissionScreen;
