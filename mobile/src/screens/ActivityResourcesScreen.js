import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const ActivityResourcesScreen = ({
  apiUrl,
  accessToken,
  actividad,
  onBack,
}) => {
  const [recursos, setRecursos] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  useEffect(() => {
    let activo = true;

    const cargarRecursos = async () => {
      try {
        const respuesta =
          await fetch(
            `${apiUrl}/api/activities/${actividad.id}/recursos`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          );

        const data =
          await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(
            data.message ||
              'No fue posible consultar los recursos.'
          );
        }

        if (activo) {
          setRecursos(
            data.recursos || []
          );
        }
      } catch (error) {
        if (!activo) {
          return;
        }

        console.log(
          'Error consultando recursos:',
          error
        );

        Alert.alert(
          'Error',
          error.message ||
            'No fue posible consultar los archivos y enlaces.'
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarRecursos();

    return () => {
      activo = false;
    };
  }, [
    apiUrl,
    accessToken,
    actividad.id,
  ]);

  const abrirRecurso =
    async (recurso) => {
      const url =
        recurso.url ||
        recurso.url_externa ||
        recurso.signedUrl;

      if (!url) {
        Alert.alert(
          'Recurso no disponible',
          'No se encontró una URL válida para este recurso.'
        );

        return;
      }

      try {
        const soportado =
          await Linking.canOpenURL(
            url
          );

        if (!soportado) {
          throw new Error(
            'El dispositivo no puede abrir este recurso.'
          );
        }

        await Linking.openURL(url);
      } catch (error) {
        Alert.alert(
          'No fue posible abrir el recurso',
          error.message
        );
      }
    };

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <Text style={styles.title}>
          Archivos y enlaces
        </Text>

        <Text
          style={styles.activityTitle}
        >
          {actividad.titulo}
        </Text>

        {cargando ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="large"
            />

            <Text
              style={styles.loadingText}
            >
              Cargando recursos...
            </Text>
          </View>
        ) : recursos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text
              style={styles.emptyTitle}
            >
              Sin archivos o enlaces
            </Text>

            <Text
              style={styles.emptyText}
            >
              Esta actividad no tiene
              material adicional
              registrado.
            </Text>
          </View>
        ) : (
          recursos.map(
            (recurso) => (
              <View
                key={recurso.id}
                style={
                  styles.resourceCard
                }
              >
                <Text
                  style={
                    styles.resourceType
                  }
                >
                  {(
                    recurso.tipo_recurso ||
                    recurso.tipo ||
                    'recurso'
                  ).toUpperCase()}
                </Text>

                <Text
                  style={
                    styles.resourceName
                  }
                >
                  {recurso.nombre_original ||
                    recurso.nombre ||
                    recurso.url_externa ||
                    'Recurso de la actividad'}
                </Text>

                <TouchableOpacity
                  style={
                    styles.openButton
                  }
                  onPress={() =>
                    abrirRecurso(
                      recurso
                    )
                  }
                >
                  <Text
                    style={
                      styles.openButtonText
                    }
                  >
                    Abrir / descargar
                  </Text>
                </TouchableOpacity>
              </View>
            )
          )
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Volver a actividades
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },

    content: {
      padding: 24,
      paddingBottom: 50,
    },

    title: {
      fontSize: 32,
      fontWeight: '800',
      marginBottom: 8,
    },

    activityTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 24,
    },

    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 50,
    },

    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },

    emptyCard: {
      padding: 24,
      borderWidth: 1,
      borderColor: '#D9E0E8',
      borderRadius: 18,
      alignItems: 'center',
      marginBottom: 24,
    },

    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
    },

    emptyText: {
      fontSize: 16,
      textAlign: 'center',
      color: '#607585',
    },

    resourceCard: {
      borderWidth: 1,
      borderColor: '#D9E0E8',
      borderRadius: 18,
      padding: 20,
      marginBottom: 16,
    },

    resourceType: {
      fontSize: 13,
      fontWeight: '800',
      color: '#304B70',
      marginBottom: 8,
    },

    resourceName: {
      fontSize: 17,
      fontWeight: '600',
      marginBottom: 16,
    },

    openButton: {
      backgroundColor: '#304B70',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },

    openButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    backButton: {
      marginTop: 20,
      paddingVertical: 16,
      alignItems: 'center',
    },

    backButtonText: {
      color: '#304B70',
      fontSize: 17,
      fontWeight: '700',
    },
  });

export default ActivityResourcesScreen;
