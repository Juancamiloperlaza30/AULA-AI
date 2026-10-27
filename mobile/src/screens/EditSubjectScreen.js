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

import { Ionicons } from '@expo/vector-icons';

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
  selected: '#EDF7FC',
  green: '#15803D',
};

const EditSubjectScreen = ({
  apiUrl,
  accessToken,
  subject,
  onBack,
  onUpdated,
}) => {
  // ========================================
  // ESTADOS ORIGINALES
  // ========================================

  const [nombre, setNombre] = useState(
    subject?.materia?.nombre || ''
  );

  const [estado, setEstado] = useState(
    subject?.estado || 'activa'
  );

  const [grados, setGrados] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [docentes, setDocentes] = useState([]);

  const [gradoId, setGradoId] = useState(
    subject?.grado?.id || null
  );

  const [grupoId, setGrupoId] = useState(
    subject?.grupo?.id || null
  );

  const [periodoId, setPeriodoId] = useState(
    subject?.periodo?.id || null
  );

  const [docentesIds, setDocentesIds] = useState(
    subject?.materia_docente?.map(
      (item) => item.docente_id
    ) ||
      subject?.docentes
        ?.map((item) => item.docente?.id)
        .filter(Boolean) ||
      []
  );

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Nuevo estado exclusivamente visual.
  // No modifica la consulta original al backend.
  const [busquedaDocente, setBusquedaDocente] =
    useState('');

  // ========================================
  // CARGA DE INFORMACIÓN
  // ========================================

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);

      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      const [
        respuestaGrados,
        respuestaPeriodos,
        respuestaDocentes,
      ] = await Promise.all([
        fetch(
          `${apiUrl}/api/academic/grados`,
          { headers }
        ),
        fetch(
          `${apiUrl}/api/academic/periodos`,
          { headers }
        ),
        fetch(
          `${apiUrl}/api/academic/docentes`,
          { headers }
        ),
      ]);

      if (
        !respuestaGrados.ok ||
        !respuestaPeriodos.ok ||
        !respuestaDocentes.ok
      ) {
        Alert.alert(
          'Error',
          'No fue posible cargar la información.'
        );

        return;
      }

      const [
        dataGrados,
        dataPeriodos,
        dataDocentes,
      ] = await Promise.all([
        respuestaGrados.json(),
        respuestaPeriodos.json(),
        respuestaDocentes.json(),
      ]);

      setGrados(dataGrados.grados || []);
      setPeriodos(dataPeriodos.periodos || []);
      setDocentes(dataDocentes.docentes || []);
    } catch (error) {
      console.log(
        'Error cargando información de materia:',
        error
      );

      Alert.alert(
        'Error',
        'No fue posible cargar la información.'
      );
    } finally {
      setCargando(false);
    }
  }, [accessToken, apiUrl]);

  // ========================================
  // CARGA DE GRUPOS
  // ========================================

  const cargarGrupos = useCallback(
    async (idGrado) => {
      try {
        setGrupos([]);

        const response = await fetch(
          `${apiUrl}/api/academic/grados/${idGrado}/grupos`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          Alert.alert(
            'Error',
            data.message ||
              'No fue posible cargar los grupos.'
          );

          return;
        }

        setGrupos(data.grupos || []);
      } catch (error) {
        console.log(
          'Error cargando grupos:',
          error
        );

        Alert.alert(
          'Error',
          'No fue posible cargar los grupos.'
        );
      }
    },
    [accessToken, apiUrl]
  );

  // ========================================
  // EFECTOS ORIGINALES
  // ========================================

  useEffect(() => {
    Promise.resolve().then(cargarDatos);
  }, [cargarDatos]);

  useEffect(() => {
    if (gradoId) {
      Promise.resolve().then(() =>
        cargarGrupos(gradoId)
      );
    }
  }, [cargarGrupos, gradoId]);

  // ========================================
  // SELECCIÓN MÚLTIPLE DE DOCENTES
  // ========================================

  const seleccionarDocente = (id) => {
    setDocentesIds((actuales) => {
      if (actuales.includes(id)) {
        return actuales.filter(
          (item) => item !== id
        );
      }

      return [...actuales, id];
    });
  };

  // ========================================
  // ACTUALIZAR MATERIA
  // ========================================

  const guardarCambios = async () => {
    if (
      !nombre.trim() ||
      !gradoId ||
      !grupoId ||
      !periodoId ||
      docentesIds.length === 0
    ) {
      Alert.alert(
        'Campos incompletos',
        'Complete todos los campos obligatorios.'
      );

      return;
    }

    try {
      setGuardando(true);

      const response = await fetch(
        `${apiUrl}/api/subjects/${subject.id}`,
        {
          method: 'PUT',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            nombre: nombre.trim(),
            gradoId,
            grupoId,
            periodoId,
            docentesIds,
            estado,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          'Error',
          data.message ||
            'No fue posible actualizar la materia.'
        );

        return;
      }

      Alert.alert(
        'Éxito',
        data.message ||
          'Materia actualizada con éxito.',
        [
          {
            text: 'Aceptar',
            onPress: onUpdated,
          },
        ]
      );
    } catch (error) {
      console.log(
        'Error modificando materia:',
        error
      );

      Alert.alert(
        'Sin conexión',
        'Se requiere conexión a internet para gestionar materias.'
      );
    } finally {
      setGuardando(false);
    }
  };

  // ========================================
  // FILTRO VISUAL DE DOCENTES
  // ========================================

  const docentesFiltrados = docentes.filter(
    (docente) => {
      const termino = busquedaDocente
        .trim()
        .toLowerCase();

      if (!termino) {
        return true;
      }

      const informacion = [
        docente.nombres,
        docente.apellidos,
        docente.correo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return informacion.includes(termino);
    }
  );

  // ========================================
  // COMPONENTE VISUAL: ENCABEZADO DE SECCIÓN
  // ========================================

  const renderSectionHeader = (
    icon,
    title,
    description
  ) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons
          name={icon}
          size={22}
          color={COLORS.blue}
        />
      </View>

      <View style={styles.sectionHeaderContent}>
        <Text style={styles.sectionTitle}>
          {title}
        </Text>

        <Text style={styles.sectionDescription}>
          {description}
        </Text>
      </View>
    </View>
  );

  // ========================================
  // CARGA INICIAL
  // ========================================

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons
            name="create-outline"
            size={34}
            color={COLORS.blue}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.blue}
        />

        <Text style={styles.loadingText}>
          Cargando información...
        </Text>

        <Text style={styles.loadingSubtitle}>
          Preparando la edición de la materia
        </Text>
      </View>
    );
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ========================================

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* ENCABEZADO INSTITUCIONAL */}

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Volver a gestión de materias"
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color={COLORS.white}
            />

            <Text style={styles.backText}>
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
              ACADÉMICO
            </Text>
          </View>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="create-outline"
            size={29}
            color={COLORS.white}
          />
        </View>

        <Text style={styles.title}>
          Editar materia
        </Text>

        <Text style={styles.headerSubtitle}>
          Actualiza la información académica,
          el grupo, los docentes responsables
          y el estado de la materia.
        </Text>
      </View>

      {/* INFORMACIÓN DE LA MATERIA */}

      <View style={styles.formCard}>
        {renderSectionHeader(
          'book-outline',
          'Información de la materia',
          'Modifica el nombre de la asignatura.'
        )}

        <Text style={styles.label}>
          Nombre de la materia
          <Text style={styles.required}> *</Text>
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons
            name="create-outline"
            size={20}
            color={COLORS.muted}
          />

          <TextInput
            style={styles.modernInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre de la materia"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {/* GRADO ACADÉMICO */}

      <View style={styles.formCard}>
        {renderSectionHeader(
          'school-outline',
          'Grado académico',
          'Selecciona el grado correspondiente.'
        )}

        <Text style={styles.label}>
          Seleccionar grado
          <Text style={styles.required}> *</Text>
        </Text>

        <View style={styles.chipContainer}>
          {grados.map((grado) => {
            const seleccionado =
              gradoId === grado.id;

            return (
              <TouchableOpacity
                key={grado.id}
                style={[
                  styles.chip,
                  seleccionado && styles.chipSelected,
                ]}
                onPress={() => {
                  setGradoId(grado.id);
                  setGrupoId(null);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{
                  selected: seleccionado,
                }}
              >
                <Ionicons
                  name={
                    seleccionado
                      ? 'checkmark-circle'
                      : 'ellipse-outline'
                  }
                  size={19}
                  color={
                    seleccionado
                      ? COLORS.white
                      : '#64748B'
                  }
                />

                <Text
                  style={[
                    styles.chipText,
                    seleccionado &&
                      styles.chipTextSelected,
                  ]}
                >
                  {grado.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* GRUPO ACADÉMICO */}

      <View style={styles.formCard}>
        {renderSectionHeader(
          'people-outline',
          'Grupo académico',
          'Selecciona el grupo al que pertenece la materia.'
        )}

        <Text style={styles.label}>
          Seleccionar grupo
          <Text style={styles.required}> *</Text>
        </Text>

        {!gradoId ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="information-circle-outline"
              size={26}
              color="#94A3B8"
            />

            <Text style={styles.emptyText}>
              Primero selecciona un grado académico.
            </Text>
          </View>
        ) : grupos.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="people-outline"
              size={26}
              color="#94A3B8"
            />

            <Text style={styles.emptyText}>
              No hay grupos disponibles para este grado.
            </Text>
          </View>
        ) : (
          <View style={styles.optionList}>
            {grupos.map((grupo) => {
              const seleccionado =
                grupoId === grupo.id;

              return (
                <TouchableOpacity
                  key={grupo.id}
                  style={[
                    styles.optionCard,
                    seleccionado &&
                      styles.optionCardSelected,
                  ]}
                  onPress={() =>
                    setGrupoId(grupo.id)
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: seleccionado,
                  }}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      seleccionado &&
                        styles.optionIconSelected,
                    ]}
                  >
                    <Ionicons
                      name="people"
                      size={18}
                      color={
                        seleccionado
                          ? COLORS.white
                          : COLORS.blue
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.optionName,
                      seleccionado &&
                        styles.optionNameSelected,
                    ]}
                  >
                    {grupo.nombre}
                  </Text>

                  <Ionicons
                    name={
                      seleccionado
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={23}
                    color={
                      seleccionado
                        ? COLORS.cyan
                        : '#94A3B8'
                    }
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* PERÍODO ACADÉMICO */}

      <View style={styles.formCard}>
        {renderSectionHeader(
          'calendar-outline',
          'Período académico',
          'Selecciona el período correspondiente.'
        )}

        <Text style={styles.label}>
          Seleccionar período
          <Text style={styles.required}> *</Text>
        </Text>

        {periodos.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="calendar-outline"
              size={26}
              color="#94A3B8"
            />

            <Text style={styles.emptyText}>
              No hay períodos académicos disponibles.
            </Text>
          </View>
        ) : (
          <View style={styles.optionList}>
            {periodos.map((periodo) => {
              const seleccionado =
                periodoId === periodo.id;

              return (
                <TouchableOpacity
                  key={periodo.id}
                  style={[
                    styles.optionCard,
                    seleccionado &&
                      styles.optionCardSelected,
                  ]}
                  onPress={() =>
                    setPeriodoId(periodo.id)
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: seleccionado,
                  }}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      seleccionado &&
                        styles.optionIconSelected,
                    ]}
                  >
                    <Ionicons
                      name="calendar"
                      size={18}
                      color={
                        seleccionado
                          ? COLORS.white
                          : COLORS.blue
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.optionName,
                      seleccionado &&
                        styles.optionNameSelected,
                    ]}
                  >
                    {periodo.nombre}
                  </Text>

                  <Ionicons
                    name={
                      seleccionado
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={23}
                    color={
                      seleccionado
                        ? COLORS.cyan
                        : '#94A3B8'
                    }
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* DOCENTES RESPONSABLES */}

      <View style={styles.formCard}>
        {renderSectionHeader(
          'person-outline',
          'Docentes responsables',
          'Selecciona uno o varios docentes.'
        )}

        <View style={styles.selectionTitleRow}>
          <Text style={styles.label}>
            Seleccionar docentes
            <Text style={styles.required}> *</Text>
          </Text>

          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {docentesIds.length} seleccionados
            </Text>
          </View>
        </View>

        {/* BUSCADOR VISUAL */}

        <View style={styles.inputContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.muted}
          />

          <TextInput
            style={styles.modernInput}
            value={busquedaDocente}
            onChangeText={setBusquedaDocente}
            placeholder="Buscar docente..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />

          {busquedaDocente.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                setBusquedaDocente('')
              }
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
            >
              <Ionicons
                name="close-circle"
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.teacherList}>
          {docentesFiltrados.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="people-outline"
                size={28}
                color="#94A3B8"
              />

              <Text style={styles.emptyText}>
                No se encontraron docentes.
              </Text>
            </View>
          ) : (
            docentesFiltrados.map((docente) => {
              const seleccionado =
                docentesIds.includes(docente.id);

              return (
                <TouchableOpacity
                  key={docente.id}
                  style={[
                    styles.teacherCard,
                    seleccionado &&
                      styles.optionCardSelected,
                  ]}
                  onPress={() =>
                    seleccionarDocente(docente.id)
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: seleccionado,
                  }}
                >
                  <View
                    style={[
                      styles.teacherAvatar,
                      seleccionado &&
                        styles.optionIconSelected,
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={21}
                      color={
                        seleccionado
                          ? COLORS.white
                          : COLORS.blue
                      }
                    />
                  </View>

                  <View style={styles.teacherInfo}>
                    <Text style={styles.teacherName}>
                      {docente.nombres}{' '}
                      {docente.apellidos}
                    </Text>

                    {!!docente.correo && (
                      <Text style={styles.teacherEmail}>
                        {docente.correo}
                      </Text>
                    )}

                    <Text
                      style={[
                        styles.teacherStatus,
                        seleccionado &&
                          styles.teacherStatusSelected,
                      ]}
                    >
                      {seleccionado
                        ? 'Docente seleccionado'
                        : 'Toca para seleccionar'}
                    </Text>
                  </View>

                  <Ionicons
                    name={
                      seleccionado
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={23}
                    color={
                      seleccionado
                        ? COLORS.cyan
                        : '#94A3B8'
                    }
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {docentesIds.length > 0 && (
          <View style={styles.selectionSummary}>
            <Ionicons
              name="checkmark-circle-outline"
              size={19}
              color={COLORS.green}
            />

            <Text style={styles.selectionSummaryText}>
              {docentesIds.length === 1
                ? '1 docente asignado'
                : `${docentesIds.length} docentes asignados`}
            </Text>
          </View>
        )}
      </View>

      {/* ESTADO DE LA MATERIA */}

      <View style={styles.formCard}>
        {renderSectionHeader(
          'options-outline',
          'Estado de la materia',
          'Define si la materia estará habilitada.'
        )}

        <Text style={styles.label}>
          Seleccionar estado
          <Text style={styles.required}> *</Text>
        </Text>

        {[
          {
            value: 'activa',
            title: 'Activa',
            description: 'Materia habilitada',
            icon: 'checkmark-circle-outline',
          },
          {
            value: 'inactiva',
            title: 'Inactiva',
            description: 'Materia deshabilitada',
            icon: 'pause-circle-outline',
          },
        ].map((item) => {
          const seleccionado =
            estado === item.value;

          return (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.optionCard,
                seleccionado &&
                  styles.optionCardSelected,
              ]}
              onPress={() =>
                setEstado(item.value)
              }
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{
                selected: seleccionado,
              }}
            >
              <View
                style={[
                  styles.optionIcon,
                  seleccionado &&
                    styles.optionIconSelected,
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={
                    seleccionado
                      ? COLORS.white
                      : COLORS.blue
                  }
                />
              </View>

              <View style={styles.optionDetails}>
                <Text
                  style={[
                    styles.optionName,
                    seleccionado &&
                      styles.optionNameSelected,
                  ]}
                >
                  {item.title}
                </Text>

                <Text style={styles.optionDescription}>
                  {item.description}
                </Text>
              </View>

              <Ionicons
                name={
                  seleccionado
                    ? 'checkmark-circle'
                    : 'ellipse-outline'
                }
                size={23}
                color={
                  seleccionado
                    ? COLORS.cyan
                    : '#94A3B8'
                }
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ACCIONES FINALES */}

      <View style={styles.actionCard}>
        <View style={styles.actionNotice}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={COLORS.blue}
          />

          <Text style={styles.actionNoticeText}>
            Verifica los cambios antes de actualizar
            la información académica.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            guardando &&
              styles.saveButtonDisabled,
          ]}
          onPress={guardarCambios}
          disabled={guardando}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Guardar cambios"
          accessibilityState={{
            disabled: guardando,
            busy: guardando,
          }}
        >
          {guardando ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator
                size="small"
                color={COLORS.white}
              />

              <Text style={styles.saveButtonText}>
                Guardando cambios...
              </Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons
                name="save-outline"
                size={22}
                color={COLORS.white}
              />

              <Text style={styles.saveButtonText}>
                Guardar cambios
              </Text>

              <Ionicons
                name="arrow-forward"
                size={19}
                color={COLORS.white}
              />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onBack}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-back-outline"
            size={18}
            color={COLORS.blue}
          />

          <Text style={styles.cancelButtonText}>
            Volver sin guardar
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Ionicons
            name="shield-checkmark-outline"
            size={15}
            color="#64748B"
          />

          <Text style={styles.footerText}>
            Gestión académica · AULA-AI
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

// ========================================
// ESTILOS PREMIUM AULA-AI
// ========================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 60,
  },

  // ENCABEZADO

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 55,
    paddingHorizontal: 24,
    paddingBottom: 34,
    marginHorizontal: -24,
    marginBottom: 28,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },

  backText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  headerBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },

  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: '#D6E4F2',
  },

  // TARJETAS

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5ECF4',
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 17,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  sectionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  sectionHeaderContent: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 5,
  },

  sectionDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },

  // FORMULARIOS

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 11,
  },

  required: {
    color: '#E11D48',
    fontWeight: '800',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    minHeight: 54,
    gap: 10,
  },

  modernInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: COLORS.navy,
    paddingVertical: 13,
  },

  // GRADOS

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 9,
    marginBottom: 10,
    gap: 8,
  },

  chipSelected: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },

  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },

  chipTextSelected: {
    color: COLORS.white,
  },

  // OPCIONES GENERALES

  optionList: {
    marginTop: 3,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },

  optionCardSelected: {
    backgroundColor: COLORS.selected,
    borderColor: COLORS.cyan,
    borderWidth: 1.5,
  },

  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  optionIconSelected: {
    backgroundColor: COLORS.blue,
  },

  optionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },

  optionNameSelected: {
    color: COLORS.blue,
  },

  optionDetails: {
    flex: 1,
    paddingRight: 8,
  },

  optionDescription: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 5,
  },

  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#E5ECF4',
    borderRadius: 14,
    paddingVertical: 26,
    paddingHorizontal: 15,
    marginTop: 5,
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
  },

  // DOCENTES

  selectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 12,
  },

  counter: {
    backgroundColor: COLORS.pale,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },

  counterText: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '800',
  },

  teacherList: {
    marginTop: 18,
  },

  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 13,
    marginBottom: 11,
  },

  teacherAvatar: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  teacherInfo: {
    flex: 1,
    paddingRight: 8,
  },

  teacherName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 5,
  },

  teacherEmail: {
    fontSize: 11,
    lineHeight: 16,
    color: '#64748B',
  },

  teacherStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 8,
  },

  teacherStatusSelected: {
    color: COLORS.green,
  },

  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
    gap: 8,
  },

  selectionSummaryText: {
    flex: 1,
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '700',
  },

  // ACCIONES

  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginTop: 4,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5ECF4',
    elevation: 2,
  },

  actionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F7FF',
    borderRadius: 13,
    padding: 13,
    marginBottom: 18,
    gap: 10,
  },

  actionNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: '#475569',
  },

  saveButton: {
    minHeight: 58,
    backgroundColor: COLORS.blue,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 3,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },

  cancelButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F8FAFD',
    marginTop: 13,
    gap: 8,
  },

  cancelButtonText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 17,
    gap: 6,
  },

  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // CARGA INICIAL

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 23,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  loadingText: {
    marginTop: 18,
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  loadingSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default EditSubjectScreen;