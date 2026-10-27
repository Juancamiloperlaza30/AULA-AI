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

export default function RegisterSubjectScreen({
  accessToken,
  apiUrl,
  onBack,
  onSuccess,
}) {
  const [nombre, setNombre] = useState('');

  const [grados, setGrados] = useState([]);
  const [gradoId, setGradoId] = useState(null);

  const [grupos, setGrupos] = useState([]);
  const [gruposSeleccionados, setGruposSeleccionados] =
    useState([]);
  const [busquedaGrupo, setBusquedaGrupo] = useState('');
  const [busquedaGrupoAplicada, setBusquedaGrupoAplicada] =
    useState('');

  const [docentes, setDocentes] = useState([]);
  const [docentesSeleccionados, setDocentesSeleccionados] =
    useState([]);
  const [busquedaDocente, setBusquedaDocente] = useState('');
  const [buscandoDocentes, setBuscandoDocentes] = useState(false);

  const [periodos, setPeriodos] = useState([]);
  const [periodoId, setPeriodoId] = useState(null);

  const [estado, setEstado] = useState('activa');

  const [cargandoDatos, setCargandoDatos] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const cargarDatosIniciales = useCallback(async () => {
    try {
      setCargandoDatos(true);

      const [
        gradosResponse,
        periodosResponse,
      ] = await Promise.all([
        fetch(
          `${apiUrl}/api/academic/grados`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        ),

        fetch(
          `${apiUrl}/api/academic/periodos`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        ),
      ]);

      const gradosData =
        await gradosResponse.json();

      const periodosData =
        await periodosResponse.json();

      if (
        !gradosResponse.ok ||
        !periodosResponse.ok
      ) {
        Alert.alert(
          'Error',
          'No fue posible cargar la información necesaria.'
        );

        return;
      }

      setGrados(gradosData.grados || []);
      setPeriodos(periodosData.periodos || []);
    } catch (error) {
      console.log(
        'Error cargando datos:',
        error
      );

      Alert.alert(
        'Error de conexión',
        'No fue posible cargar la información.'
      );
    } finally {
      setCargandoDatos(false);
    }
  }, [
    accessToken,
    apiUrl,
  ]);

  const cargarGrupos = useCallback(async (
    idGrado
  ) => {
    try {
      setGrupos([]);
      setGruposSeleccionados([]);
      setBusquedaGrupo('');
      setBusquedaGrupoAplicada('');

      const response = await fetch(
        `${apiUrl}/api/academic/grados/${idGrado}/grupos`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
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
        'Error de conexión',
        'No fue posible consultar los grupos.'
      );
    }
  }, [
    accessToken,
    apiUrl,
  ]);

  const buscarDocentes = useCallback(async (texto) => {
    try {
      setBuscandoDocentes(true);

      const termino = texto.trim();

      const url =
        termino.length >= 2
          ? `${apiUrl}/api/academic/docentes?q=${encodeURIComponent(
              termino
            )}`
          : `${apiUrl}/api/academic/docentes`;

      const response = await fetch(
        url,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.log(
          'Error buscando docentes:',
          data.message
        );

        return;
      }

      setDocentes(data.docentes || []);
    } catch (error) {
      console.log(
        'Error buscando docentes:',
        error
      );
    } finally {
      setBuscandoDocentes(false);
    }
  }, [
    accessToken,
    apiUrl,
  ]);

  useEffect(() => {
    Promise.resolve().then(
      cargarDatosIniciales
    );
  }, [cargarDatosIniciales]);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      buscarDocentes(busquedaDocente);
    }, 300);

    return () => {
      clearTimeout(temporizador);
    };
  }, [
    buscarDocentes,
    busquedaDocente,
  ]);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaGrupoAplicada(
        busquedaGrupo.trim().toLowerCase()
      );
    }, 300);

    return () => {
      clearTimeout(temporizador);
    };
  }, [busquedaGrupo]);

  const alternarGrupo = (
    grupo
  ) => {
    const existe =
      gruposSeleccionados.some(
        (item) =>
          item.id === grupo.id
      );

    if (existe) {
      setGruposSeleccionados(
        gruposSeleccionados.filter(
          (item) =>
            item.id !== grupo.id
        )
      );
    } else {
      setGruposSeleccionados([
        ...gruposSeleccionados,
        grupo,
      ]);
    }
  };

  const alternarDocente = (
    docente
  ) => {
    const existe =
      docentesSeleccionados.some(
        (item) =>
          item.id === docente.id
      );

    if (existe) {
      setDocentesSeleccionados(
        docentesSeleccionados.filter(
          (item) =>
            item.id !== docente.id
        )
      );
    } else {
      setDocentesSeleccionados([
        ...docentesSeleccionados,
        docente,
      ]);
    }
  };

  const validarFormulario = () => {
    if (!nombre.trim()) {
      return 'Ingrese el nombre de la materia.';
    }

    if (!gradoId) {
      return 'Seleccione un grado.';
    }

    if (
      gruposSeleccionados.length === 0
    ) {
      return 'Seleccione al menos un grupo.';
    }

    if (
      docentesSeleccionados.length === 0
    ) {
      return 'Seleccione al menos un docente responsable.';
    }

    if (!periodoId) {
      return 'Seleccione un periodo académico.';
    }

    return null;
  };

  const guardarMateria = async () => {
    const errorValidacion =
      validarFormulario();

    if (errorValidacion) {
      Alert.alert(
        'Formulario incompleto',
        errorValidacion
      );

      return;
    }

    try {
      setGuardando(true);

      const body = {
        nombre:
          nombre.trim(),

        gradoId,

        gruposIds:
          gruposSeleccionados.map(
            (item) =>
              item.id
          ),

        docentesIds:
          docentesSeleccionados.map(
            (item) =>
              item.id
          ),

        periodoId,

        estado,
      };

      const response = await fetch(
        `${apiUrl}/api/subjects`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${accessToken}`,
          },

          body: JSON.stringify(body),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        Alert.alert(
          'No fue posible registrar',
          data.message ||
            'Ocurrió un error durante el registro.'
        );

        return;
      }

      Alert.alert(
        'Registro exitoso',
        data.message
      );

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.log(
        'Error registrando materia:',
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

  const gruposFiltrados = grupos.filter(
    (grupo) => {
      if (!busquedaGrupoAplicada) {
        return true;
      }

      return grupo.nombre
        ?.toLowerCase()
        .includes(busquedaGrupoAplicada);
    }
  );

  if (cargandoDatos) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons
            name="school-outline"
            size={35}
            color="#123B73"
          />
        </View>

        <ActivityIndicator
          size="large"
          color="#123B73"
        />

        <Text style={styles.loadingText}>
          Cargando información académica...
        </Text>

        <Text style={styles.loadingSubtitle}>
          Preparando el formulario de registro
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.container
      }
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
              color="#FFFFFF"
            />

            <Text style={styles.backText}>
              Volver
            </Text>
          </TouchableOpacity>

          <View style={styles.headerBadge}>
            <Ionicons
              name="school-outline"
              size={14}
              color="#27C4E8"
            />

            <Text style={styles.headerBadgeText}>
              ACADÉMICO
            </Text>
          </View>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="add-circle-outline"
            size={29}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.title}>
          Registrar materia
        </Text>

        <Text style={styles.headerSubtitle}>
          Configura una nueva materia académica,
          selecciona los grupos y asigna los
          docentes responsables.
        </Text>
      </View>

      {/* SECCIÓN: INFORMACIÓN DE LA MATERIA */}
      <View style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="book-outline"
              size={22}
              color="#123B73"
            />
          </View>

          <View style={styles.sectionHeaderContent}>
            <Text style={styles.sectionTitle}>
              Información de la materia
            </Text>

            <Text style={styles.sectionDescription}>
              Ingresa los datos principales de la asignatura.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>
          Nombre de la materia
          <Text style={styles.required}> *</Text>
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons
            name="create-outline"
            size={20}
            color="#718096"
          />

          <TextInput
            style={styles.modernInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ejemplo: Matemáticas"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {/* SECCIÓN: SELECCIÓN DE GRADO */}
      <View style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="school-outline"
              size={22}
              color="#123B73"
            />
          </View>

          <View style={styles.sectionHeaderContent}>
            <Text style={styles.sectionTitle}>
              Grado académico
            </Text>

            <Text style={styles.sectionDescription}>
              Selecciona el grado al que pertenece la materia.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>
          Seleccionar grado
          <Text style={styles.required}> *</Text>
        </Text>

        <View style={styles.gradeOptionsContainer}>
          {grados.map((grado) => {
            const seleccionado =
              gradoId === grado.id;

            return (
              <TouchableOpacity
                key={grado.id}
                style={[
                  styles.gradeOption,
                  seleccionado &&
                    styles.gradeOptionSelected,
                ]}
                onPress={() => {
                  setGradoId(grado.id);
                  cargarGrupos(grado.id);
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
                      ? '#FFFFFF'
                      : '#64748B'
                  }
                />

                <Text
                  style={[
                    styles.gradeOptionText,
                    seleccionado &&
                      styles.gradeOptionTextSelected,
                  ]}
                >
                  {grado.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SECCIÓN: SELECCIÓN DE GRUPOS */}
      {gradoId && (
        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons
                name="people-outline"
                size={22}
                color="#123B73"
              />
            </View>

            <View style={styles.sectionHeaderContent}>
              <Text style={styles.sectionTitle}>
                Grupos académicos
              </Text>

              <Text style={styles.sectionDescription}>
                Selecciona uno o varios grupos
                para asignar la materia.
              </Text>
            </View>
          </View>

          <View style={styles.groupTitleRow}>
            <Text style={styles.label}>
              Seleccionar grupos
              <Text style={styles.required}> *</Text>
            </Text>

            <View style={styles.groupCounter}>
              <Text style={styles.groupCounterText}>
                {gruposSeleccionados.length} seleccionados
              </Text>
            </View>
          </View>

          {/* BUSCADOR DE GRUPOS */}
          <View style={styles.groupSearchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#718096"
            />

            <TextInput
              style={styles.groupSearchInput}
              value={busquedaGrupo}
              onChangeText={setBusquedaGrupo}
              placeholder="Buscar grupo académico..."
              placeholderTextColor="#94A3B8"
            />

            {busquedaGrupo.length > 0 && (
              <TouchableOpacity
                onPress={() => setBusquedaGrupo('')}
                accessibilityRole="button"
                accessibilityLabel="Limpiar búsqueda de grupos"
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* LISTADO DE GRUPOS */}
          <View style={styles.groupList}>
            {gruposFiltrados.length === 0 ? (
              <View style={styles.groupEmpty}>
                <Ionicons
                  name="people-outline"
                  size={28}
                  color="#94A3B8"
                />

                <Text style={styles.groupEmptyText}>
                  No se encontraron grupos disponibles.
                </Text>
              </View>
            ) : (
              gruposFiltrados.map((grupo) => {
                const seleccionado =
                  gruposSeleccionados.some(
                    (item) => item.id === grupo.id
                  );

                return (
                  <TouchableOpacity
                    key={grupo.id}
                    style={[
                      styles.groupOption,
                      seleccionado &&
                        styles.groupOptionSelected,
                    ]}
                    onPress={() => alternarGrupo(grupo)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: seleccionado,
                    }}
                  >
                    <View
                      style={[
                        styles.groupOptionIcon,
                        seleccionado &&
                          styles.groupOptionIconSelected,
                      ]}
                    >
                      <Ionicons
                        name="people"
                        size={17}
                        color={
                          seleccionado
                            ? '#FFFFFF'
                            : '#123B73'
                        }
                      />
                    </View>

                    <Text
                      style={[
                        styles.groupOptionText,
                        seleccionado &&
                          styles.groupOptionTextSelected,
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
                      size={22}
                      color={
                        seleccionado
                          ? '#27C4E8'
                          : '#94A3B8'
                      }
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* RESUMEN DE SELECCIÓN */}
          {gruposSeleccionados.length > 0 && (
            <View style={styles.groupSelectionSummary}>
              <Ionicons
                name="checkmark-circle-outline"
                size={19}
                color="#15803D"
              />

              <Text style={styles.groupSelectionSummaryText}>
                {gruposSeleccionados.length === 1
                  ? '1 grupo seleccionado correctamente'
                  : `${gruposSeleccionados.length} grupos seleccionados correctamente`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ========================================
          SECCIÓN: DOCENTES RESPONSABLES
      ======================================== */}
      <View style={styles.formCard}>
        {/* ENCABEZADO */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="person-outline"
              size={22}
              color="#123B73"
            />
          </View>

          <View style={styles.sectionHeaderContent}>
            <Text style={styles.sectionTitle}>
              Docentes responsables
            </Text>

            <Text style={styles.sectionDescription}>
              Busca y asigna uno o varios docentes
              a la materia académica.
            </Text>
          </View>
        </View>

        {/* TÍTULO Y CONTADOR */}
        <View style={styles.teacherTitleRow}>
          <Text style={styles.label}>
            Seleccionar docentes
            <Text style={styles.required}> *</Text>
          </Text>

          <View style={styles.teacherCounter}>
            <Text style={styles.teacherCounterText}>
              {docentesSeleccionados.length} seleccionados
            </Text>
          </View>
        </View>

        {/* BUSCADOR */}
        <View style={styles.teacherSearchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color="#718096"
          />

          <TextInput
            style={styles.teacherSearchInput}
            value={busquedaDocente}
            onChangeText={setBusquedaDocente}
            placeholder="Nombre, documento o correo..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />

          {busquedaDocente.length > 0 && (
            <TouchableOpacity
              onPress={() => setBusquedaDocente('')}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda de docentes"
            >
              <Ionicons
                name="close-circle"
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* INDICADOR DE BÚSQUEDA */}
        {buscandoDocentes && (
          <View style={styles.teacherSearchingRow}>
            <ActivityIndicator
              size="small"
              color="#123B73"
            />

            <Text style={styles.teacherSearchingText}>
              Buscando docentes disponibles...
            </Text>
          </View>
        )}

        {/* LISTADO DE DOCENTES */}
        <View style={styles.teacherList}>
          {docentes.length === 0 && !buscandoDocentes ? (
            <View style={styles.teacherEmpty}>
              <Ionicons
                name="people-outline"
                size={30}
                color="#94A3B8"
              />

              <Text style={styles.teacherEmptyTitle}>
                No se encontraron docentes
              </Text>

              <Text style={styles.teacherEmptyDescription}>
                Intenta realizar una búsqueda
                con otro nombre o correo.
              </Text>
            </View>
          ) : (
            docentes.map((docente) => {
              const seleccionado =
                docentesSeleccionados.some(
                  (item) => item.id === docente.id
                );

              return (
                <TouchableOpacity
                  key={docente.id}
                  style={[
                    styles.teacherCard,
                    seleccionado &&
                      styles.teacherCardSelected,
                  ]}
                  onPress={() => alternarDocente(docente)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: seleccionado,
                  }}
                >
                  {/* AVATAR */}
                  <View
                    style={[
                      styles.teacherAvatar,
                      seleccionado &&
                        styles.teacherAvatarSelected,
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={21}
                      color={
                        seleccionado
                          ? '#FFFFFF'
                          : '#123B73'
                      }
                    />
                  </View>

                  {/* INFORMACIÓN */}
                  <View style={styles.teacherInfo}>
                    <Text style={styles.teacherName}>
                      {docente.nombres} {docente.apellidos}
                    </Text>

                    <View style={styles.teacherEmailRow}>
                      <Ionicons
                        name="mail-outline"
                        size={13}
                        color="#718096"
                      />

                      <Text
                        style={styles.teacherEmail}
                        numberOfLines={2}
                      >
                        {docente.correo}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.teacherSelectionLabel,
                        seleccionado &&
                          styles.teacherSelectionLabelSelected,
                      ]}
                    >
                      {seleccionado
                        ? 'Docente seleccionado'
                        : 'Toca para seleccionar'}
                    </Text>
                  </View>

                  {/* INDICADOR DE SELECCIÓN */}
                  <Ionicons
                    name={
                      seleccionado
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={23}
                    color={
                      seleccionado
                        ? '#27C4E8'
                        : '#94A3B8'
                    }
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* RESUMEN DE DOCENTES SELECCIONADOS */}
        {docentesSeleccionados.length > 0 && (
          <View style={styles.teacherSelectionSummary}>
            <Ionicons
              name="checkmark-circle-outline"
              size={19}
              color="#15803D"
            />

            <Text style={styles.teacherSelectionSummaryText}>
              {docentesSeleccionados.length === 1
                ? '1 docente asignado a la materia'
                : `${docentesSeleccionados.length} docentes asignados a la materia`}
            </Text>
          </View>
        )}
      </View>

      {/* ========================================
          SECCIÓN: PERÍODO ACADÉMICO
      ======================================== */}
      <View style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="calendar-outline"
              size={22}
              color="#123B73"
            />
          </View>

          <View style={styles.sectionHeaderContent}>
            <Text style={styles.sectionTitle}>
              Período académico
            </Text>

            <Text style={styles.sectionDescription}>
              Selecciona el período académico
              correspondiente a la materia.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>
          Seleccionar período
          <Text style={styles.required}> *</Text>
        </Text>

        <View style={styles.periodList}>
          {periodos.length === 0 ? (
            <View style={styles.periodEmpty}>
              <Ionicons
                name="calendar-outline"
                size={27}
                color="#94A3B8"
              />

              <Text style={styles.periodEmptyText}>
                No hay períodos académicos disponibles.
              </Text>
            </View>
          ) : (
            periodos.map((periodo) => {
              const seleccionado =
                periodoId === periodo.id;

              return (
                <TouchableOpacity
                  key={periodo.id}
                  style={[
                    styles.periodOption,
                    seleccionado &&
                      styles.periodOptionSelected,
                  ]}
                  onPress={() => setPeriodoId(periodo.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: seleccionado,
                  }}
                >
                  <View
                    style={[
                      styles.periodIcon,
                      seleccionado &&
                        styles.periodIconSelected,
                    ]}
                  >
                    <Ionicons
                      name="calendar"
                      size={19}
                      color={
                        seleccionado
                          ? '#FFFFFF'
                          : '#123B73'
                      }
                    />
                  </View>

                  <View style={styles.periodInfo}>
                    <Text
                      style={[
                        styles.periodName,
                        seleccionado &&
                          styles.periodNameSelected,
                      ]}
                    >
                      {periodo.nombre}
                    </Text>

                    <Text style={styles.periodCaption}>
                      Período académico disponible
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
                        ? '#27C4E8'
                        : '#94A3B8'
                    }
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      {/* ========================================
          SECCIÓN: ESTADO DE LA MATERIA
      ======================================== */}
      <View style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="options-outline"
              size={22}
              color="#123B73"
            />
          </View>

          <View style={styles.sectionHeaderContent}>
            <Text style={styles.sectionTitle}>
              Estado de la materia
            </Text>

            <Text style={styles.sectionDescription}>
              Define la disponibilidad inicial
              de la materia académica.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>
          Seleccionar estado
        </Text>

        <View style={styles.statusOptions}>
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
                  styles.statusOption,
                  seleccionado &&
                    styles.statusOptionSelected,
                ]}
                onPress={() => setEstado(item.value)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{
                  selected: seleccionado,
                }}
              >
                <View
                  style={[
                    styles.statusIcon,
                    seleccionado &&
                      styles.statusIconSelected,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={23}
                    color={
                      seleccionado
                        ? '#FFFFFF'
                        : '#123B73'
                    }
                  />
                </View>

                <View style={styles.statusInfo}>
                  <Text
                    style={[
                      styles.statusTitle,
                      seleccionado &&
                        styles.statusTitleSelected,
                    ]}
                  >
                    {item.title}
                  </Text>

                  <Text style={styles.statusDescription}>
                    {item.description}
                  </Text>
                </View>

                <Ionicons
                  name={
                    seleccionado
                      ? 'checkmark-circle'
                      : 'ellipse-outline'
                  }
                  size={22}
                  color={
                    seleccionado
                      ? '#27C4E8'
                      : '#94A3B8'
                  }
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ========================================
          ACCIÓN FINAL: REGISTRAR MATERIA
      ======================================== */}
      <View style={styles.actionCard}>
        <View style={styles.actionInfo}>
          <View style={styles.actionInfoIcon}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#123B73"
            />
          </View>

          <Text style={styles.actionInfoText}>
            Verifica que la información académica,
            los grupos y los docentes sean correctos
            antes de registrar la materia.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            guardando && styles.saveButtonDisabled,
          ]}
          onPress={guardarMateria}
          disabled={guardando}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={
            guardando
              ? 'Registrando materia'
              : 'Registrar materia'
          }
          accessibilityState={{
            disabled: guardando,
            busy: guardando,
          }}
        >
          {guardando ? (
            <View style={styles.saveButtonContent}>
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />

              <Text style={styles.saveButtonText}>
                Registrando materia...
              </Text>
            </View>
          ) : (
            <View style={styles.saveButtonContent}>
              <Ionicons
                name="checkmark-circle-outline"
                size={23}
                color="#FFFFFF"
              />

              <Text style={styles.saveButtonText}>
                Registrar materia
              </Text>

              <Ionicons
                name="arrow-forward"
                size={19}
                color="#FFFFFF"
              />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.actionFooter}>
          <Ionicons
            name="shield-checkmark-outline"
            size={15}
            color="#64748B"
          />

          <Text style={styles.actionFooterText}>
            Registro académico · AULA-AI
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  container: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 60,
  },

  header: {
    backgroundColor: '#091D3A',
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

  loadingContainer: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 18,
    color: '#091D3A',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 23,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  loadingSubtitle: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },

  backText: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: '#123B73',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },

  headerSubtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: '#D6E4F2',
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5ECF4',
    shadowColor: '#091D3A',
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
    backgroundColor: '#EAF3FC',
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
    color: '#091D3A',
    marginBottom: 5,
  },

  sectionDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#718096',
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
    borderColor: '#DFE7F0',
    borderRadius: 13,
    paddingHorizontal: 14,
    minHeight: 54,
    gap: 10,
  },

  modernInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#091D3A',
    paddingVertical: 13,
  },

  gradeOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },

  gradeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 9,
    marginBottom: 10,
    gap: 8,
  },

  gradeOptionSelected: {
    backgroundColor: '#123B73',
    borderColor: '#123B73',
  },

  gradeOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },

  gradeOptionTextSelected: {
    color: '#FFFFFF',
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 11,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 20,
  },

  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  option: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C8D1DB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
  },

  optionSelected: {
    backgroundColor: '#1F4E79',
    borderColor: '#1F4E79',
  },

  optionText: {
    color: '#455A64',
  },

  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  listContainer: {
    marginBottom: 20,
  },

  personCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },

  personCardSelected: {
    backgroundColor: '#EAF1F8',
    borderColor: '#1F4E79',
    borderWidth: 2,
  },

  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
  },

  personInfo: {
    color: '#607D8B',
    marginTop: 3,
  },

  searchingText: {
    color: '#607D8B',
    fontSize: 13,
    marginTop: -12,
    marginBottom: 12,
  },

  selectionText: {
    color: '#607D8B',
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },

  selectionTextSelected: {
    color: '#1F4E79',
  },

  saveButton: {
    minHeight: 58,
    backgroundColor: '#123B73',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // ========================================
  // SELECCIÓN DE GRUPOS ACADÉMICOS
  // ========================================

  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 12,
  },

  groupCounter: {
    backgroundColor: '#EAF3FC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },

  groupCounterText: {
    color: '#123B73',
    fontSize: 11,
    fontWeight: '800',
  },

  groupSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 13,
    paddingHorizontal: 14,
    minHeight: 54,
    gap: 10,
    marginBottom: 18,
  },

  groupSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#091D3A',
    paddingVertical: 12,
  },

  groupList: {
    marginTop: 2,
  },

  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  groupOptionSelected: {
    backgroundColor: '#EDF7FC',
    borderColor: '#27C4E8',
    borderWidth: 1.5,
  },

  groupOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  groupOptionIconSelected: {
    backgroundColor: '#123B73',
  },

  groupOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },

  groupOptionTextSelected: {
    color: '#123B73',
  },

  groupEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5ECF4',
  },

  groupEmptyText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 19,
    color: '#718096',
    textAlign: 'center',
  },

  groupSelectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
    gap: 8,
  },

  groupSelectionSummaryText: {
    flex: 1,
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },

  // ========================================
  // DOCENTES RESPONSABLES
  // ========================================

  teacherTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 12,
  },

  teacherCounter: {
    backgroundColor: '#EAF3FC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },

  teacherCounterText: {
    color: '#123B73',
    fontSize: 11,
    fontWeight: '800',
  },

  teacherSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 13,
    paddingHorizontal: 14,
    minHeight: 54,
    gap: 10,
    marginBottom: 16,
  },

  teacherSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#091D3A',
    paddingVertical: 12,
  },

  teacherSearchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },

  teacherSearchingText: {
    fontSize: 12,
    color: '#64748B',
  },

  teacherList: {
    marginTop: 2,
  },

  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 15,
    padding: 13,
    marginBottom: 11,
  },

  teacherCardSelected: {
    backgroundColor: '#EDF7FC',
    borderColor: '#27C4E8',
    borderWidth: 1.5,
  },

  teacherAvatar: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  teacherAvatarSelected: {
    backgroundColor: '#123B73',
  },

  teacherInfo: {
    flex: 1,
    paddingRight: 8,
  },

  teacherName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#091D3A',
    marginBottom: 6,
  },

  teacherEmailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },

  teacherEmail: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#64748B',
  },

  teacherSelectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 8,
  },

  teacherSelectionLabelSelected: {
    color: '#15803D',
  },

  teacherEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#E5ECF4',
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 15,
  },

  teacherEmptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginTop: 12,
    textAlign: 'center',
  },

  teacherEmptyDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: '#718096',
    textAlign: 'center',
    marginTop: 6,
  },

  teacherSelectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
    gap: 8,
  },

  teacherSelectionSummaryText: {
    flex: 1,
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },

  // ========================================
  // PERÍODO ACADÉMICO
  // ========================================

  periodList: {
    marginTop: 4,
  },

  periodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },

  periodOptionSelected: {
    backgroundColor: '#EDF7FC',
    borderColor: '#27C4E8',
    borderWidth: 1.5,
  },

  periodIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  periodIconSelected: {
    backgroundColor: '#123B73',
  },

  periodInfo: {
    flex: 1,
    paddingRight: 8,
  },

  periodName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
  },

  periodNameSelected: {
    color: '#123B73',
  },

  periodCaption: {
    fontSize: 11,
    color: '#718096',
  },

  periodEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#E5ECF4',
    borderRadius: 14,
    paddingVertical: 25,
    paddingHorizontal: 15,
  },

  periodEmptyText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 19,
    color: '#718096',
    textAlign: 'center',
  },

  // ========================================
  // ESTADO DE LA MATERIA
  // ========================================

  statusOptions: {
    marginTop: 4,
  },

  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },

  statusOptionSelected: {
    backgroundColor: '#EDF7FC',
    borderColor: '#27C4E8',
    borderWidth: 1.5,
  },

  statusIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  statusIconSelected: {
    backgroundColor: '#123B73',
  },

  statusInfo: {
    flex: 1,
    paddingRight: 8,
  },

  statusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
  },

  statusTitleSelected: {
    color: '#123B73',
  },

  statusDescription: {
    fontSize: 11,
    color: '#718096',
  },

  // ========================================
  // ACCIÓN FINAL DEL FORMULARIO
  // ========================================

  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginTop: 4,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5ECF4',
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  actionInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F7FF',
    borderRadius: 13,
    padding: 13,
    marginBottom: 18,
  },

  actionInfoIcon: {
    marginRight: 10,
    marginTop: 1,
  },

  actionInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: '#475569',
  },

  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 17,
    gap: 6,
  },

  actionFooterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});
