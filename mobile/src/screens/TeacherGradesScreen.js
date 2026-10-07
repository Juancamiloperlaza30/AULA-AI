import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function TeacherGradesScreen({
  apiUrl,
  accessToken,
  onBack,
}) {
  const [
    actividades,
    setActividades,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    actividadSeleccionada,
    setActividadSeleccionada,
  ] = useState(null);

  const [
    estudiantes,
    setEstudiantes,
  ] = useState([]);

  const [
    cargandoEstudiantes,
    setCargandoEstudiantes,
  ] = useState(false);

  const [
    calificaciones,
    setCalificaciones,
  ] = useState({});

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const consultarActividades =
    useCallback(async () => {
      const response = await fetch(
        `${apiUrl}/api/grades/docente/actividades`,
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
            'No fue posible consultar las actividades.'
        );
      }

      return data.actividades || [];
    }, [
      apiUrl,
      accessToken,
    ]);

  const mostrarErrorCarga = useCallback(
    (error) => {
      console.log(
        'Error consultando actividades calificables:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'No fue posible consultar las actividades.'
      );
    },
    []
  );

  const actualizarActividades =
    useCallback(async () => {
      setCargando(true);
      try {
        const actividadesCargadas =
          await consultarActividades();

        setActividades(
          actividadesCargadas
        );
      } catch (error) {
        mostrarErrorCarga(error);
      } finally {
        setCargando(false);
      }
    }, [
      consultarActividades,
      mostrarErrorCarga,
    ]);

  useEffect(() => {
    let activo = true;

    const cargarActividades =
      async () => {
        try {
          const actividadesCargadas =
            await consultarActividades();

          if (activo) {
            setActividades(
              actividadesCargadas
            );
          }
        } catch (error) {
          if (activo) {
            mostrarErrorCarga(error);
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
  }, [
    consultarActividades,
    mostrarErrorCarga,
  ]);

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return 'Sin fecha';
    }

    return new Date(
      fecha
    ).toLocaleDateString(
      'es-CO'
    );
  };

  const seleccionarActividad =
    async (actividad) => {
      try {
        setCargandoEstudiantes(true);

        const response = await fetch(
          `${apiUrl}/api/grades/docente/actividades/${actividad.id}/estudiantes`,
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
              'No fue posible consultar los estudiantes.'
          );
        }

        setActividadSeleccionada(
          actividad
        );

        setEstudiantes(
          data.estudiantes || []
        );

        setCalificaciones({});
      } catch (error) {
        console.log(
          'Error consultando estudiantes:',
          error
        );

        Alert.alert(
          'Error',
          error.message ||
            'No fue posible consultar los estudiantes.'
        );
      } finally {
        setCargandoEstudiantes(false);
      }
    };

  const actualizarCalificacion = (
    estudianteId,
    campo,
    valor
  ) => {
    setCalificaciones(
      (anteriores) => ({
        ...anteriores,

        [estudianteId]: {
          ...anteriores[
            estudianteId
          ],

          [campo]: valor,
        },
      })
    );
  };

  const guardarCalificaciones =
    async () => {
      try {
        const registros =
          estudiantes
            .map((estudiante) => {
              const datos =
                calificaciones[
                  estudiante.usuario_id
                ];

              if (
                !datos?.valor ||
                !String(
                  datos.valor
                ).trim()
              ) {
                return null;
              }

              const valor =
                Number(
                  String(
                    datos.valor
                  ).replace(',', '.')
                );

              return {
                estudianteId:
                  estudiante.usuario_id,

                valor,

                retroalimentacion:
                  datos
                    .retroalimentacion
                    ?.trim() || null,
              };
            })
            .filter(Boolean);

        if (
          registros.length === 0
        ) {
          Alert.alert(
            'Calificaciones',
            'Debe ingresar al menos una calificación.'
          );

          return;
        }

        const tieneNotaInvalida =
          registros.some(
            (registro) =>
              !Number.isFinite(
                registro.valor
              ) ||
              registro.valor < 0 ||
              registro.valor > 5
          );

        if (tieneNotaInvalida) {
          Alert.alert(
            'Calificación inválida',
            'Las calificaciones deben estar entre 0.00 y 5.00.'
          );

          return;
        }

        setGuardando(true);

        const response =
          await fetch(
            `${apiUrl}/api/grades/docente/calificaciones`,
            {
              method: 'POST',

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                actividadId:
                  actividadSeleccionada.id,

                calificaciones:
                  registros,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              'No fue posible registrar las calificaciones.'
          );
        }

        Alert.alert(
          'Calificaciones',
          data.message ||
            'Calificaciones registradas correctamente.'
        );

        setCalificaciones({});
      } catch (error) {
        console.log(
          'Error guardando calificaciones:',
          error
        );

        Alert.alert(
          'Error',
          error.message ||
            'No fue posible registrar las calificaciones.'
        );
      } finally {
        setGuardando(false);
      }
    };

  const renderActividad = ({
    item,
  }) => {
    const asignacion =
      item.materia_grupo_periodo;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          seleccionarActividad(item)
        }
      >
        <Text style={styles.tipo}>
          {item.tipo?.toUpperCase() ||
            'ACTIVIDAD'}
        </Text>

        <Text style={styles.titulo}>
          {item.titulo}
        </Text>

        <Text style={styles.materia}>
          {asignacion?.materia?.nombre ||
            'Materia'}
        </Text>

        <Text style={styles.detalle}>
          {asignacion?.grado?.nombre ||
            '-'}{' '}
          · Grupo{' '}
          {asignacion?.grupo?.nombre ||
            '-'}
        </Text>

        <Text style={styles.fecha}>
          Entrega:{' '}
          {formatearFecha(
            item.fecha_entrega
          )}
        </Text>

        <View style={styles.estado}>
          <Text style={styles.estadoText}>
            {item.estado ||
              'publicada'}
          </Text>
        </View>

        <Text style={styles.accion}>
          Calificar estudiantes →
        </Text>
      </TouchableOpacity>
    );
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Consultando actividades...
        </Text>
      </View>
    );
  }

  if (actividadSeleccionada) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setActividadSeleccionada(
                null
              );

              setEstudiantes([]);
            }}
          >
            <Text style={styles.back}>
              ← Actividades
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {actividadSeleccionada.titulo}
          </Text>

          <Text style={styles.headerText}>
            Estudiantes de la actividad
          </Text>
        </View>

        {cargandoEstudiantes ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
            />

            <Text style={styles.loadingText}>
              Consultando estudiantes...
            </Text>
          </View>
        ) : (
          <FlatList
            data={estudiantes}
            keyExtractor={(item) =>
              String(item.usuario_id)
            }
            contentContainerStyle={
              styles.list
            }
            renderItem={({ item }) => (
              <View style={styles.studentCard}>
                <Text style={styles.studentName}>
                  {item.usuario?.nombres}{' '}
                  {item.usuario?.apellidos}
                </Text>

                <Text style={styles.studentEmail}>
                  {item.usuario?.correo}
                </Text>

                <Text style={styles.inputLabel}>
                  Calificación
                </Text>

                <TextInput
                  style={styles.gradeInput}
                  placeholder="Ej: 4.5"
                  keyboardType="decimal-pad"
                  value={
                    calificaciones[
                      item.usuario_id
                    ]?.valor || ''
                  }
                  onChangeText={(valor) =>
                    actualizarCalificacion(
                      item.usuario_id,
                      'valor',
                      valor
                    )
                  }
                />

                <Text style={styles.inputLabel}>
                  Retroalimentación
                </Text>

                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Escriba una observación para el estudiante..."
                  multiline
                  textAlignVertical="top"
                  value={
                    calificaciones[
                      item.usuario_id
                    ]?.retroalimentacion ||
                    ''
                  }
                  onChangeText={(valor) =>
                    actualizarCalificacion(
                      item.usuario_id,
                      'retroalimentacion',
                      valor
                    )
                  }
                />
              </View>
            )}
            ListEmptyComponent={
              <View
                style={
                  styles.emptyContainer
                }
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  Sin estudiantes
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  No hay estudiantes
                  registrados en este grupo.
                </Text>
              </View>
            }
          />
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            guardando &&
              styles.saveButtonDisabled,
          ]}
          onPress={
            guardarCalificaciones
          }
          disabled={guardando}
        >
          <Text style={styles.saveButtonText}>
            {guardando
              ? 'Guardando...'
              : 'Guardar calificaciones'}
          </Text>
        </TouchableOpacity>
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

        <Text style={styles.headerTitle}>
          Calificaciones
        </Text>

        <Text style={styles.headerText}>
          Seleccione una actividad para
          registrar las calificaciones
          de sus estudiantes.
        </Text>
      </View>

      <FlatList
        data={actividades}
        keyExtractor={(item) =>
          String(item.id)
        }
        renderItem={renderActividad}
        contentContainerStyle={
          styles.list
        }
        refreshing={cargando}
        onRefresh={
          actualizarActividades
        }
        ListEmptyComponent={
          <View
            style={
              styles.emptyContainer
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No hay actividades
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              No tiene actividades
              disponibles para calificar.
            </Text>
          </View>
        }
      />
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
      paddingHorizontal: 20,
      paddingTop: 55,
      paddingBottom: 18,
      backgroundColor:
        '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor:
        '#E5EAF0',
    },

    back: {
      fontSize: 15,
      color: '#1F4E79',
      fontWeight: '700',
      marginBottom: 14,
    },

    headerTitle: {
      fontSize: 27,
      fontWeight: '900',
      color: '#1F2937',
    },

    headerText: {
      marginTop: 7,
      fontSize: 14,
      lineHeight: 20,
      color: '#607D8B',
    },

    list: {
      padding: 20,
      paddingBottom: 40,
    },

    card: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 18,
      marginBottom: 15,
      borderWidth: 1,
      borderColor:
        '#E0E6ED',
    },

    studentCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#E0E6ED',
    },

    studentName: {
      fontSize: 16,
      fontWeight: '800',
      color: '#1F2937',
    },

    studentEmail: {
      marginTop: 5,
      fontSize: 13,
      color: '#607D8B',
    },

    inputLabel: {
      marginTop: 16,
      marginBottom: 6,
      fontSize: 13,
      fontWeight: '700',
      color: '#455A64',
    },

    gradeInput: {
      height: 48,
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#D8E0E8',
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 16,
      color: '#1F2937',
    },

    feedbackInput: {
      minHeight: 90,
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#D8E0E8',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: '#1F2937',
    },

    saveButton: {
      marginHorizontal: 20,
      marginBottom: 24,
      backgroundColor: '#1F4E79',
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: 'center',
    },

    saveButtonDisabled: {
      opacity: 0.6,
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },

    tipo: {
      fontSize: 11,
      fontWeight: '800',
      color: '#607D8B',
    },

    titulo: {
      marginTop: 5,
      fontSize: 18,
      fontWeight: '800',
      color: '#1F2937',
    },

    materia: {
      marginTop: 10,
      fontSize: 15,
      fontWeight: '700',
      color: '#1F4E79',
    },

    detalle: {
      marginTop: 4,
      fontSize: 13,
      color: '#607D8B',
    },

    fecha: {
      marginTop: 10,
      fontSize: 13,
      color: '#455A64',
    },

    estado: {
      alignSelf:
        'flex-start',
      marginTop: 10,
      backgroundColor:
        '#EAF2F8',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },

    estadoText: {
      color: '#1F4E79',
      fontSize: 11,
      fontWeight: '800',
      textTransform:
        'uppercase',
    },

    accion: {
      marginTop: 15,
      fontSize: 14,
      fontWeight: '800',
      color: '#1F4E79',
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

    emptyContainer: {
      paddingVertical: 60,
      alignItems: 'center',
    },

    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#1F2937',
    },

    emptyText: {
      marginTop: 7,
      fontSize: 14,
      color: '#607D8B',
      textAlign: 'center',
    },
  });
