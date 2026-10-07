import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AcademicPeriodsScreen({
  apiUrl,
  accessToken,
  onBack,
}) {
  const [
    periodos,
    setPeriodos,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    guardandoId,
    setGuardandoId,
  ] = useState(null);

  const [
    periodoActual,
    setPeriodoActual,
  ] = useState(null);

  const consultarPeriodos =
    useCallback(async () => {
      const response = await fetch(
        `${apiUrl}/api/academic/periodos`,
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
            'No fue posible consultar los periodos.'
        );
      }

      return data.periodos || [];
    }, [
      apiUrl,
      accessToken,
    ]);

  const cargarPeriodos =
    useCallback(async () => {
      setCargando(true);

      try {
        const periodosCargados =
          await consultarPeriodos();

        setPeriodos(periodosCargados);
      } catch (error) {
        console.log(
          'Error consultando periodos:',
          error
        );

        Alert.alert(
          'Error',
          error.message ||
            'No fue posible consultar los periodos académicos.'
        );
      } finally {
        setCargando(false);
      }
    }, [consultarPeriodos]);

  const consultarPeriodoActual =
    useCallback(async () => {
      const response = await fetch(
        `${apiUrl}/api/academic/periodo-actual`,
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
            'No fue posible consultar el periodo actual.'
        );
      }

      return data.periodo || null;
    }, [
      apiUrl,
      accessToken,
    ]);

  const cargarPeriodoActual =
    useCallback(async () => {
      try {
        const periodo =
          await consultarPeriodoActual();

        setPeriodoActual(periodo);
      } catch (error) {
        console.log(
          'Error consultando periodo actual:',
          error
        );
      }
    }, [consultarPeriodoActual]);

  useEffect(() => {
    let activo = true;

    const cargarDatos = async () => {
      const [
        resultadoPeriodos,
        resultadoPeriodoActual,
      ] = await Promise.allSettled([
        consultarPeriodos(),
        consultarPeriodoActual(),
      ]);

      if (!activo) {
        return;
      }

      if (
        resultadoPeriodos.status ===
        'fulfilled'
      ) {
        setPeriodos(
          resultadoPeriodos.value
        );
      } else {
        console.log(
          'Error consultando periodos:',
          resultadoPeriodos.reason
        );

        Alert.alert(
          'Error',
          resultadoPeriodos.reason.message ||
            'No fue posible consultar los periodos académicos.'
        );
      }

      if (
        resultadoPeriodoActual.status ===
        'fulfilled'
      ) {
        setPeriodoActual(
          resultadoPeriodoActual.value
        );
      } else {
        console.log(
          'Error consultando periodo actual:',
          resultadoPeriodoActual.reason
        );
      }

      setCargando(false);
    };

    cargarDatos();

    return () => {
      activo = false;
    };
  }, [
    consultarPeriodos,
    consultarPeriodoActual,
  ]);

  const actualizarCampo = (
    periodoId,
    campo,
    valor
  ) => {
    setPeriodos(
      (anteriores) =>
        anteriores.map(
          (periodo) =>
            periodo.id === periodoId
              ? {
                  ...periodo,
                  [campo]: valor,
                }
              : periodo
        )
    );
  };

  const guardarPeriodo =
    async (periodo) => {
      try {
        if (
          !periodo.fecha_inicio ||
          !periodo.fecha_fin
        ) {
          Alert.alert(
            'Fechas requeridas',
            'Debe ingresar la fecha de inicio y la fecha de finalización.'
          );

          return;
        }

        setGuardandoId(
          periodo.id
        );

        const response = await fetch(
          `${apiUrl}/api/academic/periodos/${periodo.id}`,
          {
            method: 'PUT',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              fechaInicio:
                periodo.fecha_inicio,

              fechaFin:
                periodo.fecha_fin,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              'No fue posible actualizar el periodo.'
          );
        }

        Alert.alert(
          'Periodo actualizado',
          data.message ||
            'Periodo académico actualizado correctamente.'
        );

        setCargando(true);
        await cargarPeriodos();
        await cargarPeriodoActual();
      } catch (error) {
        console.log(
          'Error actualizando periodo:',
          error
        );

        Alert.alert(
          'Error',
          error.message ||
            'No fue posible actualizar el periodo académico.'
        );
      } finally {
        setGuardandoId(null);
      }
    };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Consultando periodos...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
        >
          <Text style={styles.back}>
            ← Volver
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Periodos académicos
        </Text>

        <Text style={styles.subtitle}>
          Configure las fechas de inicio
          y finalización de cada periodo.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        {periodos.map(
          (periodo) => (
            <View
              key={periodo.id}
              style={styles.card}
            >
              <View
                style={
                  styles.cardHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.periodName
                    }
                  >
                    {periodo.nombre}
                  </Text>

                  {periodoActual?.id ===
                  periodo.id ? (
                    <View
                      style={
                        styles.currentBadge
                      }
                    >
                      <Text
                        style={
                          styles.currentBadgeText
                        }
                      >
                        PERIODO ACTUAL
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={
                        styles.status
                      }
                    >
                      {periodo.activo
                        ? 'Configurado'
                        : 'Inactivo'}
                    </Text>
                  )}
                </View>
              </View>

              <Text
                style={
                  styles.label
                }
              >
                Fecha de inicio
              </Text>

              <TextInput
                style={styles.input}
                value={
                  periodo.fecha_inicio ||
                  ''
                }
                placeholder="AAAA-MM-DD"
                onChangeText={(
                  valor
                ) =>
                  actualizarCampo(
                    periodo.id,
                    'fecha_inicio',
                    valor
                  )
                }
              />

              <Text
                style={
                  styles.label
                }
              >
                Fecha de finalización
              </Text>

              <TextInput
                style={styles.input}
                value={
                  periodo.fecha_fin ||
                  ''
                }
                placeholder="AAAA-MM-DD"
                onChangeText={(
                  valor
                ) =>
                  actualizarCampo(
                    periodo.id,
                    'fecha_fin',
                    valor
                  )
                }
              />

              <TouchableOpacity
                style={[
                  styles.saveButton,

                  guardandoId ===
                    periodo.id &&
                    styles.disabledButton,
                ]}
                disabled={
                  guardandoId ===
                  periodo.id
                }
                onPress={() =>
                  guardarPeriodo(
                    periodo
                  )
                }
              >
                <Text
                  style={
                    styles.saveText
                  }
                >
                  {guardandoId ===
                  periodo.id
                    ? 'Guardando...'
                    : 'Guardar cambios'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F5F7FA',
    },

    header: {
      backgroundColor:
        '#FFFFFF',
      paddingHorizontal: 20,
      paddingTop: 55,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor:
        '#E5EAF0',
    },

    back: {
      fontSize: 15,
      fontWeight: '700',
      color: '#1F4E79',
      marginBottom: 14,
    },

    title: {
      fontSize: 27,
      fontWeight: '900',
      color: '#1F2937',
    },

    subtitle: {
      marginTop: 7,
      fontSize: 14,
      lineHeight: 20,
      color: '#607D8B',
    },

    content: {
      padding: 20,
      paddingBottom: 40,
    },

    card: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor:
        '#E0E6ED',
    },

    cardHeader: {
      marginBottom: 16,
    },

    periodName: {
      fontSize: 18,
      fontWeight: '900',
      color: '#1F4E79',
    },

    status: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '700',
      color: '#607D8B',
    },

    currentBadge: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: '#E8F5E9',
    },

    currentBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#2E7D32',
    },

    label: {
      marginTop: 12,
      marginBottom: 6,
      fontSize: 13,
      fontWeight: '700',
      color: '#455A64',
    },

    input: {
      height: 48,
      borderWidth: 1,
      borderColor:
        '#D8E0E8',
      borderRadius: 10,
      backgroundColor:
        '#F8FAFC',
      paddingHorizontal: 14,
      fontSize: 15,
      color: '#1F2937',
    },

    saveButton: {
      marginTop: 18,
      backgroundColor:
        '#1F4E79',
      paddingVertical: 14,
      borderRadius: 11,
      alignItems: 'center',
    },

    disabledButton: {
      opacity: 0.6,
    },

    saveText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },

    center: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      backgroundColor:
        '#F5F7FA',
    },

    loadingText: {
      marginTop: 12,
      color: '#607D8B',
    },
  });
