import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const AcademicActivitiesScreen = ({
  apiUrl,
  accessToken,
  onBack,
  onRegisterActivity,
  onViewSubmissions,
  onViewResources,
}) => {
  const [actividades, setActividades] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  useEffect(() => {
    let activo = true;

    const cargarActividades = async () => {
      try {
        setCargando(true);

        const response = await fetch(
          `${apiUrl}/api/activities/mis-actividades`,
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
              'No fue posible consultar las actividades.'
          );

          return;
        }

        if (activo) {
          setActividades(
            data.actividades || []
          );
        }
      } catch (error) {
        console.log(
          'Error consultando actividades:',
          error
        );

        Alert.alert(
          'Sin conexión',
          'No fue posible consultar las actividades en este momento.'
        );
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
  }, [apiUrl, accessToken]);

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

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) {
      return '';
    }

    return new Date(
      fecha
    ).toLocaleString();
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

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
        Actividades Académicas
      </Text>

      <Text style={styles.subtitle}>
        Tareas, actividades y exámenes
        registrados.
      </Text>

      <TouchableOpacity
        style={styles.registerButton}
        onPress={onRegisterActivity}
      >
        <Text
          style={
            styles.registerButtonText
          }
        >
          + Registrar actividad
        </Text>
      </TouchableOpacity>

      {actividades.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No hay actividades
            registradas.
          </Text>
        </View>
      ) : (
        actividades.map(
          (actividad) => {
            const asignacion =
              actividad
                .materia_grupo_periodo;

            const estadoFecha =
              obtenerEstadoFecha(
                actividad.fecha_entrega
              );

            return (
              <View
                key={actividad.id}
                style={styles.card}
              >
                <View
                  style={
                    styles.cardHeader
                  }
                >
                  <Text
                    style={
                      styles.activityType
                    }
                  >
                    {actividad.tipo
                      ?.toUpperCase()}
                  </Text>

                  <Text
                    style={
                      styles.dateState
                    }
                  >
                    {estadoFecha}
                  </Text>
                </View>

                <Text
                  style={
                    styles.activityTitle
                  }
                >
                  {actividad.titulo}
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

                <Text style={styles.info}>
                  Materia:{' '}
                  {asignacion?.materia
                    ?.nombre || '-'}
                </Text>

                <Text style={styles.info}>
                  Grado:{' '}
                  {asignacion?.grado
                    ?.nombre || '-'}
                </Text>

                <Text style={styles.info}>
                  Grupo:{' '}
                  {asignacion?.grupo
                    ?.nombre || '-'}
                </Text>

                <Text style={styles.info}>
                  Periodo:{' '}
                  {asignacion?.periodo
                    ?.nombre || '-'}
                </Text>

                <Text
                  style={styles.dateText}
                >
                  Entrega:{' '}
                  {formatearFecha(
                    actividad.fecha_entrega
                  )}
                </Text>

                <TouchableOpacity
                  style={
                    styles.secondaryButton
                  }
                  onPress={() =>
                    onViewResources(
                      actividad
                    )
                  }
                >
                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    Ver archivos y enlaces
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={
                    styles.submissionsButton
                  }
                  onPress={() =>
                    onViewSubmissions(
                      actividad
                    )
                  }
                >
                  <Text
                    style={
                      styles.submissionsButtonText
                    }
                  >
                    Ver entregas
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }
        )
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

const styles =
  StyleSheet.create({
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
      fontSize: 15,
      color: '#607D8B',
      marginBottom: 20,
    },

    registerButton: {
      backgroundColor: '#2D405D',
      padding: 15,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 20,
    },

    registerButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: 16,
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
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },

    activityType: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#2D405D',
    },

    dateState: {
      fontSize: 12,
      fontWeight: '600',
    },

    activityTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },

    description: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },

    info: {
      fontSize: 14,
      marginBottom: 4,
    },

    dateText: {
      marginTop: 10,
      fontSize: 13,
      fontWeight: '600',
    },

    submissionsButton: {
      marginTop: 14,
      backgroundColor: '#E9EEF5',
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
    },

    secondaryButton: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: '#2D405D',
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
    },

    secondaryButtonText: {
      color: '#2D405D',
      fontWeight: 'bold',
    },

    submissionsButtonText: {
      color: '#2D405D',
      fontWeight: 'bold',
    },

    emptyCard: {
      padding: 24,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#E0E5EB',
      alignItems: 'center',
    },

    emptyText: {
      color: '#607D8B',
    },

    backButton: {
      marginTop: 10,
      padding: 14,
      alignItems: 'center',
    },
  });

export default AcademicActivitiesScreen;
