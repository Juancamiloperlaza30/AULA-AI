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

import { Ionicons } from '@expo/vector-icons';

// =====================================================
// AULA-AI | CALIFICACIONES DEL DOCENTE
// REDISEÑO VISUAL PREMIUM
//
// Se conservan:
// - Consulta de actividades calificables.
// - Consulta de estudiantes por actividad.
// - Calificaciones previamente registradas.
// - Edición de notas y retroalimentación.
// - Validación de notas entre 0.00 y 5.00.
// - Registro de calificaciones en el backend.
// - Actualización de información después de guardar.
// - Navegación y actualización manual.
// =====================================================

const COLORS = {
  navy: '#091D3A',
  blue: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#334155',
  muted: '#718096',
  border: '#DFE7F0',
  pale: '#EAF3FC',
  green: '#15803D',
  greenLight: '#ECFDF3',
  orange: '#B45309',
  orangeLight: '#FFF7ED',
  red: '#B91C1C',
  redLight: '#FEF2F2',
};

const obtenerIconoTipo = (tipo) => {
  switch (String(tipo || '').toLowerCase()) {
    case 'tarea':
      return 'clipboard-outline';
    case 'examen':
      return 'document-text-outline';
    case 'actividad':
      return 'book-outline';
    default:
      return 'school-outline';
  }
};

const formatearFecha = (fecha) => {
  if (!fecha) {
    return 'Sin fecha';
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Sin fecha';
  }

  return valor.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const obtenerIniciales = (nombres, apellidos) => {
  const nombre = String(nombres || '').trim();
  const apellido = String(apellidos || '').trim();

  const inicialNombre = nombre.charAt(0);
  const inicialApellido = apellido.charAt(0);

  return (
    `${inicialNombre}${inicialApellido}`.toUpperCase() ||
    'ES'
  );
};

const obtenerNombreEstudiante = (estudiante) => {
  const nombres = estudiante.usuario?.nombres || '';
  const apellidos = estudiante.usuario?.apellidos || '';

  return (
    `${nombres} ${apellidos}`.trim() ||
    'Estudiante sin nombre'
  );
};

const obtenerEstadoNota = (valor) => {
  const texto = String(valor ?? '').trim();

  if (!texto) {
    return {
      titulo: 'Sin calificar',
      color: COLORS.orange,
      fondo: COLORS.orangeLight,
      icono: 'time-outline',
    };
  }

  const nota = Number(texto.replace(',', '.'));

  if (!Number.isFinite(nota) || nota < 0 || nota > 5) {
    return {
      titulo: 'Nota inválida',
      color: COLORS.red,
      fondo: COLORS.redLight,
      icono: 'alert-circle-outline',
    };
  }

  return {
    titulo: 'Nota ingresada',
    color: COLORS.green,
    fondo: COLORS.greenLight,
    icono: 'checkmark-circle-outline',
  };
};

// =====================================================
// COMPONENTES VISUALES
// =====================================================

function Header({
  titulo,
  descripcion,
  onBack,
  etiqueta = 'DOCENTE',
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={COLORS.white}
          />

          <Text style={styles.headerBackText}>
            Volver
          </Text>
        </TouchableOpacity>

        <View style={styles.headerBadge}>
          <Ionicons
            name="school-outline"
            size={14}
            color={COLORS.cyan}
          />

          <Text style={styles.headerBadgeText}>
            {etiqueta}
          </Text>
        </View>
      </View>

      <View style={styles.headerIcon}>
        <Ionicons
          name="ribbon-outline"
          size={28}
          color={COLORS.white}
        />
      </View>

      <Text style={styles.headerTitle}>
        {titulo}
      </Text>

      <Text style={styles.headerDescription}>
        {descripcion}
      </Text>
    </View>
  );
}

function EmptyState({
  icono,
  titulo,
  descripcion,
}) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name={icono}
          size={32}
          color={COLORS.blue}
        />
      </View>

      <Text style={styles.emptyTitle}>
        {titulo}
      </Text>

      <Text style={styles.emptyText}>
        {descripcion}
      </Text>
    </View>
  );
}

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function TeacherGradesScreen({
  apiUrl,
  accessToken,
  onBack,
}) {
  const [actividades, setActividades] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [
    actividadSeleccionada,
    setActividadSeleccionada,
  ] = useState(null);

  const [estudiantes, setEstudiantes] = useState([]);

  const [
    cargandoEstudiantes,
    setCargandoEstudiantes,
  ] = useState(false);

  const [
    calificaciones,
    setCalificaciones,
  ] = useState({});

  const [guardando, setGuardando] = useState(false);

  // ===================================================
  // CONSULTAR ACTIVIDADES
  // ===================================================

  const consultarActividades = useCallback(async () => {
    const response = await fetch(
      `${apiUrl}/api/grades/docente/actividades`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          'No fue posible consultar las actividades.'
      );
    }

    return data.actividades || [];
  }, [apiUrl, accessToken]);

  const mostrarErrorCarga = useCallback((error) => {
    console.log(
      'Error consultando actividades calificables:',
      error
    );

    Alert.alert(
      'Error',
      error.message ||
        'No fue posible consultar las actividades.'
    );
  }, []);

  const actualizarActividades = useCallback(async () => {
    setCargando(true);

    try {
      const actividadesCargadas =
        await consultarActividades();

      setActividades(actividadesCargadas);
    } catch (error) {
      mostrarErrorCarga(error);
    } finally {
      setCargando(false);
    }
  }, [consultarActividades, mostrarErrorCarga]);

  useEffect(() => {
    let activo = true;

    const cargarActividades = async () => {
      try {
        const actividadesCargadas =
          await consultarActividades();

        if (activo) {
          setActividades(actividadesCargadas);
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
  }, [consultarActividades, mostrarErrorCarga]);

  // ===================================================
  // SELECCIONAR ACTIVIDAD Y CONSULTAR ESTUDIANTES
  // ===================================================

  const seleccionarActividad = async (actividad) => {
    try {
      setCargandoEstudiantes(true);

      const response = await fetch(
        `${apiUrl}/api/grades/docente/actividades/${actividad.id}/estudiantes`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'No fue posible consultar los estudiantes.'
        );
      }

      setActividadSeleccionada(actividad);

      const listaEstudiantes = data.estudiantes || [];

      setEstudiantes(listaEstudiantes);

      const calificacionesIniciales = {};

      listaEstudiantes.forEach((estudiante) => {
        const nota = estudiante.calificacion;

        calificacionesIniciales[
          estudiante.usuario_id
        ] = {
          valor:
            nota?.valor !== undefined &&
            nota?.valor !== null
              ? String(nota.valor)
              : '',

          retroalimentacion:
            nota?.retroalimentacion || '',
        };
      });

      setCalificaciones(calificacionesIniciales);
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

  // ===================================================
  // ACTUALIZAR NOTA O RETROALIMENTACIÓN
  // ===================================================

  const actualizarCalificacion = (
    estudianteId,
    campo,
    valor
  ) => {
    setCalificaciones((anteriores) => ({
      ...anteriores,

      [estudianteId]: {
        ...anteriores[estudianteId],
        [campo]: valor,
      },
    }));
  };

  // ===================================================
  // GUARDAR CALIFICACIONES
  // LÓGICA ORIGINAL CONSERVADA
  // ===================================================

  const guardarCalificaciones = async () => {
    try {
      const registros = estudiantes
        .map((estudiante) => {
          const datos =
            calificaciones[estudiante.usuario_id];

          if (
            datos?.valor === undefined ||
            datos?.valor === null ||
            !String(datos.valor).trim()
          ) {
            return null;
          }

          const valor = Number(
            String(datos.valor).replace(',', '.')
          );

          return {
            estudianteId: estudiante.usuario_id,
            valor,
            retroalimentacion:
              datos.retroalimentacion?.trim() || null,
          };
        })
        .filter(Boolean);

      if (registros.length === 0) {
        Alert.alert(
          'Calificaciones',
          'Debe ingresar al menos una calificación.'
        );

        return;
      }

      const tieneNotaInvalida = registros.some(
        (registro) =>
          !Number.isFinite(registro.valor) ||
          registro.valor < 0 ||
          registro.valor > 5
      );

      if (tieneNotaInvalida) {
        Alert.alert(
          'Calificación inválida',
          'No se permiten notas negativas. Las calificaciones deben estar entre 0.00 y 5.00.'
        );

        return;
      }

      setGuardando(true);

      const response = await fetch(
        `${apiUrl}/api/grades/docente/calificaciones`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            actividadId: actividadSeleccionada.id,
            calificaciones: registros,
          }),
        }
      );

      const data = await response.json();

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

      await seleccionarActividad(actividadSeleccionada);
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

  // ===================================================
  // VOLVER A LA LISTA DE ACTIVIDADES
  // ===================================================

  const volverAActividades = () => {
    if (guardando) {
      return;
    }

    setActividadSeleccionada(null);
    setEstudiantes([]);
    setCalificaciones({});
  };

  // ===================================================
  // RESUMEN DE CALIFICACIONES
  // ===================================================

  const cantidadCalificadas = estudiantes.filter(
    (estudiante) => {
      const valor =
        calificaciones[estudiante.usuario_id]?.valor;

      return String(valor ?? '').trim().length > 0;
    }
  ).length;

  const cantidadPendientes =
    estudiantes.length - cantidadCalificadas;

  // ===================================================
  // TARJETA DE ACTIVIDAD
  // ===================================================

  const renderActividad = ({ item }) => {
    const asignacion = item.materia_grupo_periodo;

    const tipo = String(
      item.tipo || 'actividad'
    ).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => seleccionarActividad(item)}
        activeOpacity={0.85}
        disabled={cargandoEstudiantes}
      >
        <View style={styles.activityTop}>
          <View style={styles.activityIcon}>
            <Ionicons
              name={obtenerIconoTipo(item.tipo)}
              size={24}
              color={COLORS.blue}
            />
          </View>

          <View style={styles.activityTopContent}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {tipo}
              </Text>
            </View>

            <Text style={styles.activityTitle}>
              {item.titulo}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color={COLORS.blue}
          />
        </View>

        <View style={styles.activityDivider} />

        <View style={styles.activityInfoRow}>
          <Ionicons
            name="book-outline"
            size={17}
            color={COLORS.blue}
          />

          <Text style={styles.activitySubject}>
            {asignacion?.materia?.nombre || 'Materia'}
          </Text>
        </View>

        <View style={styles.activityInfoRow}>
          <Ionicons
            name="people-outline"
            size={17}
            color={COLORS.muted}
          />

          <Text style={styles.activityDetail}>
            {asignacion?.grado?.nombre || '-'}
            {' · Grupo '}
            {asignacion?.grupo?.nombre || '-'}
          </Text>
        </View>

        <View style={styles.activityInfoRow}>
          <Ionicons
            name="calendar-outline"
            size={17}
            color={COLORS.muted}
          />

          <Text style={styles.activityDetail}>
            Entrega: {formatearFecha(item.fecha_entrega)}
          </Text>
        </View>

        <View style={styles.activityBottom}>
          <View style={styles.statusBadge}>
            <Ionicons
              name="checkmark-circle-outline"
              size={15}
              color={COLORS.blue}
            />

            <Text style={styles.statusText}>
              {item.estado || 'publicada'}
            </Text>
          </View>

          <View style={styles.activityAction}>
            <Text style={styles.activityActionText}>
              Calificar
            </Text>

            <Ionicons
              name="arrow-forward"
              size={17}
              color={COLORS.blue}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ===================================================
  // TARJETA DE ESTUDIANTE
  // ===================================================

  const renderEstudiante = ({ item, index }) => {
    const datos =
      calificaciones[item.usuario_id] || {};

    const estadoNota = obtenerEstadoNota(datos.valor);

    const nombre = obtenerNombreEstudiante(item);

    return (
      <View style={styles.studentCard}>
        <View style={styles.studentTop}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentAvatarText}>
              {obtenerIniciales(
                item.usuario?.nombres,
                item.usuario?.apellidos
              )}
            </Text>
          </View>

          <View style={styles.studentIdentity}>
            <Text style={styles.studentName}>
              {nombre}
            </Text>

            <Text style={styles.studentEmail}>
              {item.usuario?.correo || 'Sin correo'}
            </Text>
          </View>

          <View style={styles.studentNumber}>
            <Text style={styles.studentNumberText}>
              {index + 1}
            </Text>
          </View>
        </View>

        <View style={styles.studentDivider} />

        <View
          style={[
            styles.gradeStatus,
            { backgroundColor: estadoNota.fondo },
          ]}
        >
          <Ionicons
            name={estadoNota.icono}
            size={15}
            color={estadoNota.color}
          />

          <Text
            style={[
              styles.gradeStatusText,
              { color: estadoNota.color },
            ]}
          >
            {estadoNota.titulo}
          </Text>
        </View>

        <View style={styles.gradeHeader}>
          <Text style={styles.inputLabel}>
            Calificación
          </Text>

          <Text style={styles.gradeScale}>
            Escala de 0.00 a 5.00
          </Text>
        </View>

        <View style={styles.gradeInputContainer}>
          <Ionicons
            name="ribbon-outline"
            size={21}
            color={COLORS.blue}
          />

          <TextInput
            style={styles.gradeInput}
            placeholder="Ej: 4.5"
            placeholderTextColor={COLORS.muted}
            keyboardType="decimal-pad"
            value={datos.valor || ''}
            editable={!guardando}
            onChangeText={(valor) =>
              actualizarCalificacion(
                item.usuario_id,
                'valor',
                valor
              )
            }
          />

          <View style={styles.gradeMaxBadge}>
            <Text style={styles.gradeMaxText}>
              / 5.0
            </Text>
          </View>
        </View>

        <View style={styles.feedbackHeader}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={18}
            color={COLORS.blue}
          />

          <Text style={styles.inputLabel}>
            Retroalimentación
          </Text>
        </View>

        <TextInput
          style={styles.feedbackInput}
          placeholder="Escribe una observación para el estudiante..."
          placeholderTextColor={COLORS.muted}
          multiline
          textAlignVertical="top"
          value={datos.retroalimentacion || ''}
          editable={!guardando}
          onChangeText={(valor) =>
            actualizarCalificacion(
              item.usuario_id,
              'retroalimentacion',
              valor
            )
          }
        />
      </View>
    );
  };

  // ===================================================
  // CARGA INICIAL
  // ===================================================

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons
            name="ribbon-outline"
            size={34}
            color={COLORS.blue}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.blue}
        />

        <Text style={styles.loadingTitle}>
          Preparando calificaciones
        </Text>

        <Text style={styles.loadingText}>
          Consultando las actividades académicas
          disponibles para calificar...
        </Text>
      </View>
    );
  }

  // ===================================================
  // VISTA: ESTUDIANTES Y CALIFICACIONES
  // ===================================================

  if (actividadSeleccionada) {
    return (
      <View style={styles.container}>
        <FlatList
          data={estudiantes}
          keyExtractor={(item) =>
            String(item.usuario_id)
          }
          renderItem={renderEstudiante}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.studentList}
          ListHeaderComponent={
            <>
              <Header
                titulo="Calificar estudiantes"
                descripcion="Registra las notas y la retroalimentación académica."
                onBack={volverAActividades}
                etiqueta="CALIFICACIONES"
              />

              <View style={styles.selectedActivityCard}>
                <View style={styles.selectedActivityIcon}>
                  <Ionicons
                    name={obtenerIconoTipo(
                      actividadSeleccionada.tipo
                    )}
                    size={24}
                    color={COLORS.blue}
                  />
                </View>

                <View style={styles.selectedActivityInfo}>
                  <Text style={styles.selectedActivityLabel}>
                    ACTIVIDAD SELECCIONADA
                  </Text>

                  <Text style={styles.selectedActivityTitle}>
                    {actividadSeleccionada.titulo}
                  </Text>

                  <Text style={styles.selectedActivitySubject}>
                    {actividadSeleccionada
                      .materia_grupo_periodo
                      ?.materia?.nombre || 'Materia'}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryTitleRow}>
                  <Ionicons
                    name="stats-chart-outline"
                    size={20}
                    color={COLORS.blue}
                  />

                  <Text style={styles.summaryTitle}>
                    Resumen de calificaciones
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {estudiantes.length}
                    </Text>

                    <Text style={styles.summaryLabel}>
                      Estudiantes
                    </Text>
                  </View>

                  <View style={styles.summarySeparator} />

                  <View style={styles.summaryItem}>
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: COLORS.green },
                      ]}
                    >
                      {cantidadCalificadas}
                    </Text>

                    <Text style={styles.summaryLabel}>
                      Con nota
                    </Text>
                  </View>

                  <View style={styles.summarySeparator} />

                  <View style={styles.summaryItem}>
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: COLORS.orange },
                      ]}
                    >
                      {cantidadPendientes}
                    </Text>

                    <Text style={styles.summaryLabel}>
                      Pendientes
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Listado de estudiantes
                  </Text>

                  <Text style={styles.sectionSubtitle}>
                    Ingresa una nota y agrega observaciones.
                  </Text>
                </View>
              </View>

              {cargandoEstudiantes && (
                <View style={styles.inlineLoading}>
                  <ActivityIndicator
                    color={COLORS.blue}
                  />

                  <Text style={styles.inlineLoadingText}>
                    Consultando estudiantes...
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            cargandoEstudiantes ? null : (
              <EmptyState
                icono="people-outline"
                titulo="Sin estudiantes"
                descripcion="No hay estudiantes registrados en este grupo."
              />
            )
          }
          ListFooterComponent={
            <View style={styles.saveSection}>
              <View style={styles.saveInfo}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={COLORS.blue}
                />

                <Text style={styles.saveInfoText}>
                  Verifica las notas antes de guardar.
                  Solo se enviarán los estudiantes
                  que tengan una calificación ingresada.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (guardando || cargandoEstudiantes) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={guardarCalificaciones}
                disabled={
                  guardando || cargandoEstudiantes
                }
                activeOpacity={0.85}
              >
                {guardando ? (
                  <ActivityIndicator
                    color={COLORS.white}
                    size="small"
                  />
                ) : (
                  <Ionicons
                    name="save-outline"
                    size={21}
                    color={COLORS.white}
                  />
                )}

                <Text style={styles.saveButtonText}>
                  {guardando
                    ? 'Guardando calificaciones...'
                    : 'Guardar calificaciones'}
                </Text>

                {!guardando && (
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={COLORS.white}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={volverAActividades}
                disabled={guardando}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="arrow-back-outline"
                  size={18}
                  color={COLORS.blue}
                />

                <Text style={styles.secondaryButtonText}>
                  Volver a actividades
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    );
  }

  // ===================================================
  // VISTA: ACTIVIDADES DISPONIBLES
  // ===================================================

  return (
    <View style={styles.container}>
      <FlatList
        data={actividades}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderActividad}
        contentContainerStyle={styles.activityList}
        refreshing={cargando}
        onRefresh={actualizarActividades}
        ListHeaderComponent={
          <>
            <Header
              titulo="Calificaciones"
              descripcion="Selecciona una actividad para registrar las notas y la retroalimentación de tus estudiantes."
              onBack={onBack}
            />

            <View style={styles.introCard}>
              <View style={styles.introIcon}>
                <Ionicons
                  name="school-outline"
                  size={22}
                  color={COLORS.blue}
                />
              </View>

              <View style={styles.introContent}>
                <Text style={styles.introTitle}>
                  Gestión de calificaciones
                </Text>

                <Text style={styles.introDescription}>
                  Selecciona una actividad académica
                  para consultar sus estudiantes
                  y registrar las notas.
                </Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryTitleRow}>
                <Ionicons
                  name="layers-outline"
                  size={20}
                  color={COLORS.blue}
                />

                <Text style={styles.summaryTitle}>
                  Actividades disponibles
                </Text>
              </View>

              <Text style={styles.activitiesCount}>
                {actividades.length}
              </Text>

              <Text style={styles.activitiesCountLabel}>
                Actividades para gestionar calificaciones
              </Text>
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>
                  Mis actividades
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Selecciona la actividad que deseas calificar.
                </Text>
              </View>
            </View>

            {cargandoEstudiantes && (
              <View style={styles.inlineLoading}>
                <ActivityIndicator color={COLORS.blue} />

                <Text style={styles.inlineLoadingText}>
                  Abriendo actividad...
                </Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icono="folder-open-outline"
            titulo="No hay actividades"
            descripcion="No tienes actividades disponibles para calificar."
          />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={COLORS.muted}
            />

            <Text style={styles.footerText}>
              Gestión académica · AULA-AI
            </Text>
          </View>
        }
      />
    </View>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  activityList: {
    paddingHorizontal: 20,
    paddingBottom: 45,
  },

  studentList: {
    paddingHorizontal: 20,
    paddingBottom: 45,
  },

  // ===================================================
  // ENCABEZADO
  // ===================================================

  header: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 34,
    marginBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },

  headerBackText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  headerBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '900',
  },

  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 19,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: '900',
    marginBottom: 9,
  },

  headerDescription: {
    color: '#D6E4F2',
    fontSize: 13,
    lineHeight: 21,
  },

  // ===================================================
  // TARJETAS GENERALES
  // ===================================================

  introCard: {
    backgroundColor: COLORS.pale,
    borderRadius: 17,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },

  introIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  introContent: {
    flex: 1,
  },

  introTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: 5,
  },

  introDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.text,
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 19,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  summaryTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.navy,
  },

  activitiesCount: {
    fontSize: 37,
    fontWeight: '900',
    color: COLORS.blue,
  },

  activitiesCountLabel: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    marginTop: 4,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },

  summaryValue: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.blue,
  },

  summaryLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 5,
    textAlign: 'center',
  },

  summarySeparator: {
    width: 1,
    height: 38,
    backgroundColor: COLORS.border,
  },

  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navy,
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    marginTop: 5,
  },

  // ===================================================
  // ACTIVIDADES
  // ===================================================

  activityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 11,
    elevation: 2,
  },

  activityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  activityIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityTopContent: {
    flex: 1,
  },

  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.pale,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 7,
  },

  typeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.blue,
  },

  activityTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.navy,
  },

  activityDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  activityInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },

  activitySubject: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.blue,
  },

  activityDetail: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
  },

  activityBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.pale,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
    textTransform: 'uppercase',
  },

  activityAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  activityActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.blue,
  },

  // ===================================================
  // ACTIVIDAD SELECCIONADA
  // ===================================================

  selectedActivityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 19,
    padding: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 18,
  },

  selectedActivityIcon: {
    width: 51,
    height: 51,
    borderRadius: 15,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedActivityInfo: {
    flex: 1,
  },

  selectedActivityLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.muted,
    marginBottom: 6,
  },

  selectedActivityTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.navy,
  },

  selectedActivitySubject: {
    fontSize: 12,
    color: COLORS.blue,
    marginTop: 5,
    fontWeight: '700',
  },

  // ===================================================
  // ESTUDIANTES
  // ===================================================

  studentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },

  studentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  studentAvatar: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  studentAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.blue,
  },

  studentIdentity: {
    flex: 1,
  },

  studentName: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.navy,
  },

  studentEmail: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 5,
  },

  studentNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  studentNumberText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.blue,
  },

  studentDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 15,
  },

  gradeStatus: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 13,
  },

  gradeStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  gradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 9,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },

  gradeScale: {
    fontSize: 10,
    color: COLORS.muted,
  },

  gradeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 55,
    gap: 11,
  },

  gradeInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    paddingVertical: 11,
  },

  gradeMaxBadge: {
    backgroundColor: COLORS.pale,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  gradeMaxText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.blue,
  },

  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 19,
    marginBottom: 10,
  },

  feedbackInput: {
    minHeight: 105,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.navy,
  },

  // ===================================================
  // GUARDADO
  // ===================================================

  saveSection: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 7,
    marginBottom: 20,
  },

  saveInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    marginBottom: 16,
  },

  saveInfoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 19,
    color: COLORS.text,
  },

  saveButton: {
    minHeight: 58,
    backgroundColor: COLORS.blue,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    gap: 9,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.cyan,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
  },

  secondaryButton: {
    minHeight: 52,
    marginTop: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.blue,
  },

  // ===================================================
  // CARGA Y ESTADOS VACÍOS
  // ===================================================

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  loadingIcon: {
    width: 75,
    height: 75,
    borderRadius: 23,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 23,
  },

  loadingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.navy,
    marginTop: 18,
  },

  loadingText: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },

  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },

  inlineLoadingText: {
    fontSize: 12,
    color: COLORS.muted,
  },

  emptyContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 35,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },

  emptyIcon: {
    width: 67,
    height: 67,
    borderRadius: 20,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.navy,
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 9,
  },

  // ===================================================
  // PIE DE PÁGINA
  // ===================================================

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 17,
  },

  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
  },
});