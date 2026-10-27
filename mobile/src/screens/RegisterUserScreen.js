import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

const mostrarAlerta = (titulo, mensaje) => {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined'
  ) {
    window.alert(`${titulo}\n\n${mensaje}`);
    return;
  }

  Alert.alert(titulo, mensaje);
};

export default function RegisterUserScreen({
  accessToken,
  apiUrl,
  onBack,
}) {
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState('');

  const [grados, setGrados] = useState([]);
  const [grupos, setGrupos] = useState([]);

  const [gradoId, setGradoId] = useState(null);
  const [grupoId, setGrupoId] = useState(null);
  const [gradoAmbitoId, setGradoAmbitoId] =
    useState(null);
  const [gruposAmbito, setGruposAmbito] =
    useState([]);
  const [ambitosOrientador, setAmbitosOrientador] =
    useState([]);
  const [cargandoGruposAmbito, setCargandoGruposAmbito] =
    useState(false);
  const solicitudAmbitosId = useRef(0);

  const [busquedaEstudiante, setBusquedaEstudiante] = useState('');
  const [resultadosEstudiantes, setResultadosEstudiantes] = useState([]);
  const [estudiantesSeleccionados, setEstudiantesSeleccionados] = useState([]);
  const [buscandoEstudiante, setBuscandoEstudiante] = useState(false);
  const solicitudBusquedaId = useRef(0);

  const [cargando, setCargando] = useState(false);

  const roles = [
    'estudiante',
    'acudiente',
    'docente',
    'orientador',
    'coordinador',
  ];

  const cargarGrados = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiUrl}/api/academic/grados`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        mostrarAlerta(
          'Error',
          data.message || 'No fue posible cargar los grados.'
        );
        return;
      }

      setGrados(data.grados || []);
    } catch (error) {
      console.log('Error cargando grados:', error);

      mostrarAlerta(
        'Error de conexión',
        'No fue posible consultar los grados.'
      );
    }
  }, [
    accessToken,
    apiUrl,
  ]);

  useEffect(() => {
    if (
      rol === 'estudiante' ||
      rol === 'orientador'
    ) {
      Promise.resolve().then(
        cargarGrados
      );
    }
  }, [
    cargarGrados,
    rol,
  ]);

  const cargarGrupos = async (idGrado) => {
    try {
      setGrupoId(null);

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
        mostrarAlerta(
          'Error',
          data.message || 'No fue posible cargar los grupos.'
        );
        return;
      }

      setGrupos(data.grupos || []);
    } catch (error) {
      console.log('Error cargando grupos:', error);

      mostrarAlerta(
        'Error de conexión',
        'No fue posible consultar los grupos.'
      );
    }
  };

  const cargarGruposOrientador = async (
    idGrado
  ) => {
    const solicitudId =
      ++solicitudAmbitosId.current;

    setGradoAmbitoId(idGrado);
    setGruposAmbito([]);
    setCargandoGruposAmbito(true);

    try {
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
        if (
          solicitudId === solicitudAmbitosId.current
        ) {
          mostrarAlerta(
            'Error',
            data.message ||
              'No fue posible cargar los grupos.'
          );
        }
        return;
      }

      if (
        solicitudId === solicitudAmbitosId.current
      ) {
        setGruposAmbito(data.grupos || []);
      }
    } catch (error) {
      console.log(
        'Error cargando grupos del orientador:',
        error
      );

      if (
        solicitudId === solicitudAmbitosId.current
      ) {
        mostrarAlerta(
          'Error de conexión',
          'No fue posible consultar los grupos.'
        );
      }
    } finally {
      if (
        solicitudId === solicitudAmbitosId.current
      ) {
        setCargandoGruposAmbito(false);
      }
    }
  };

  const buscarEstudiantes = useCallback(async (terminoBusqueda) => {
    const termino = terminoBusqueda.trim();
    const solicitudId =
      ++solicitudBusquedaId.current;

    if (termino.length < 2) {
      setResultadosEstudiantes([]);
      setBuscandoEstudiante(false);
      return;
    }

    try {
      setBuscandoEstudiante(true);

      const response = await fetch(
        `${apiUrl}/api/users/estudiantes/buscar?q=${encodeURIComponent(
          termino
        )}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (
          solicitudId ===
          solicitudBusquedaId.current
        ) {
          mostrarAlerta(
            'No fue posible buscar',
            data.message ||
              'Ocurrió un error durante la búsqueda.'
          );

          setResultadosEstudiantes([]);
        }

        return;
      }

      if (
        solicitudId ===
        solicitudBusquedaId.current
      ) {
        setResultadosEstudiantes(
          data.estudiantes || []
        );
      }
    } catch (error) {
      console.log(
        'Error buscando estudiantes:',
        error
      );

      if (
        solicitudId ===
        solicitudBusquedaId.current
      ) {
        setResultadosEstudiantes([]);
      }
    } finally {
      if (
        solicitudId ===
        solicitudBusquedaId.current
      ) {
        setBuscandoEstudiante(false);
      }
    }
  }, [
    accessToken,
    apiUrl,
  ]);

  const manejarBusquedaEstudiante = (texto) => {
    setBusquedaEstudiante(texto);

    if (texto.trim().length < 2) {
      solicitudBusquedaId.current += 1;
      setResultadosEstudiantes([]);
      setBuscandoEstudiante(false);
    }
  };

  useEffect(() => {
    if (
      busquedaEstudiante.trim().length < 2
    ) {
      return undefined;
    }

    const temporizador = setTimeout(
      () =>
        buscarEstudiantes(
          busquedaEstudiante
        ),
      500
    );

    return () => {
      clearTimeout(temporizador);
    };
  }, [
    busquedaEstudiante,
    buscarEstudiantes,
  ]);

  const alternarSeleccionEstudiante = (
    estudiante
  ) => {
    const yaSeleccionado =
      estudiantesSeleccionados.some(
        (item) =>
          item.id === estudiante.id
      );

    if (yaSeleccionado) {
      setEstudiantesSeleccionados(
        estudiantesSeleccionados.filter(
          (item) =>
            item.id !== estudiante.id
        )
      );
    } else {
      setEstudiantesSeleccionados([
        ...estudiantesSeleccionados,
        estudiante,
      ]);
    }
  };

  const alternarAmbitoOrientador = (grupo) => {
    if (!gradoAmbitoId) {
      return;
    }

    setAmbitosOrientador((ambitosActuales) => {
      const yaSeleccionado = ambitosActuales.some(
        (ambito) =>
          String(ambito.gradoId) ===
            String(gradoAmbitoId) &&
          String(ambito.grupoId) ===
            String(grupo.id)
      );

      if (yaSeleccionado) {
        return ambitosActuales.filter(
          (ambito) =>
            String(ambito.gradoId) !==
              String(gradoAmbitoId) ||
            String(ambito.grupoId) !==
              String(grupo.id)
        );
      }

      const grado = grados.find(
        (item) =>
          String(item.id) ===
          String(gradoAmbitoId)
      );

      return [
        ...ambitosActuales,
        {
          gradoId: gradoAmbitoId,
          grupoId: grupo.id,
          gradoNombre: grado?.nombre || '',
          grupoNombre: grupo.nombre || '',
        },
      ];
    });
  };

  const quitarAmbitoOrientador = (
    gradoSeleccionadoId,
    grupoSeleccionadoId
  ) => {
    setAmbitosOrientador((ambitosActuales) =>
      ambitosActuales.filter(
        (ambito) =>
          String(ambito.gradoId) !==
            String(gradoSeleccionadoId) ||
          String(ambito.grupoId) !==
            String(grupoSeleccionadoId)
      )
    );
  };

  const validarFormulario = () => {
    if (!nombres.trim()) {
      return 'Ingrese los nombres.';
    }

    if (!apellidos.trim()) {
      return 'Ingrese los apellidos.';
    }

    if (!tipoDocumento.trim()) {
      return 'Ingrese el tipo de documento.';
    }

    if (!numeroDocumento.trim()) {
      return 'Ingrese el número de documento.';
    }

    if (!correo.trim()) {
      return 'Ingrese el correo institucional.';
    }

    const regexCorreo =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regexCorreo.test(correo.trim())) {
      return 'El correo electrónico no tiene un formato válido.';
    }

    if (!telefono.trim()) {
      return 'Ingrese el teléfono.';
    }

    if (!rol) {
      return 'Seleccione un rol.';
    }

    if (
      rol === 'estudiante' &&
      (!gradoId || !grupoId)
    ) {
      return 'Seleccione el grado y el grupo del estudiante.';
    }

    if (
      rol === 'orientador' &&
      ambitosOrientador.length === 0
    ) {
      return 'Seleccione al menos un grado y grupo para el orientador.';
    }

    if (
      rol === 'acudiente' &&
      estudiantesSeleccionados.length === 0
    ) {
      return 'Seleccione al menos un estudiante para el acudiente.';
    }

    return null;
  };

  const registrarUsuario = async () => {
    const errorValidacion =
      validarFormulario();

    if (errorValidacion) {
      mostrarAlerta(
        'Formulario incompleto',
        errorValidacion
      );

      return;
    }

    try {
      setCargando(true);

      const body = {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        tipoDocumento:
          tipoDocumento.trim(),
        numeroDocumento:
          numeroDocumento.trim(),
        correo:
          correo.trim().toLowerCase(),
        telefono: telefono.trim(),
        rol,
      };

      if (rol === 'estudiante') {
        body.gradoId = gradoId;
        body.grupoId = grupoId;
      }

      if (rol === 'acudiente') {
        body.estudiantesVinculados =
          estudiantesSeleccionados.map(
            (estudiante) =>
              estudiante.id
          );
      }

      if (rol === 'orientador') {
        body.ambitosOrientador =
          ambitosOrientador.map((ambito) => ({
            gradoId: ambito.gradoId,
            grupoId: ambito.grupoId,
          }));
      }

      const response = await fetch(
        `${apiUrl}/api/users`,
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

      const data = await response.json();

      if (!response.ok) {
        mostrarAlerta(
          'No fue posible registrar',
          data.message ||
            'Ocurrió un error durante el registro.'
        );

        return;
      }

      mostrarAlerta(
        'Registro exitoso',
        data.message
      );

      limpiarFormulario();
    } catch (error) {
      console.log(
        'Error registrando usuario:',
        error
      );

      mostrarAlerta(
        'Sin conexión',
        'Se requiere conexión a internet para registrar usuarios.'
      );
    } finally {
      setCargando(false);
    }
  };

  const limpiarFormulario = () => {
    setNombres('');
    setApellidos('');
    setTipoDocumento('');
    setNumeroDocumento('');
    setCorreo('');
    setTelefono('');
    setRol('');
    setGradoId(null);
    setGrupoId(null);
    setGradoAmbitoId(null);
    setGruposAmbito([]);
    setAmbitosOrientador([]);
    setCargandoGruposAmbito(false);
    solicitudAmbitosId.current += 1;
    setGrupos([]);
    setBusquedaEstudiante('');
    setResultadosEstudiantes([]);
    setEstudiantesSeleccionados([]);
  };

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
            accessibilityLabel="Volver al panel de administración"
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
              name="shield-checkmark-outline"
              size={14}
              color="#27C4E8"
            />

            <Text style={styles.headerBadgeText}>
              ADMIN
            </Text>
          </View>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="person-add-outline"
            size={28}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.title}>
          Registrar usuario
        </Text>

        <Text style={styles.subtitle}>
          Completa la información para crear una nueva
          cuenta institucional en AULA-AI.
        </Text>
      </View>

      {/* TARJETA: INFORMACIÓN PERSONAL */}
      <View style={styles.formCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons
              name="person-outline"
              size={21}
              color="#123B73"
            />
          </View>

          <View style={styles.cardHeaderContent}>
            <Text style={styles.cardTitle}>
              Información personal
            </Text>

            <Text style={styles.cardSubtitle}>
              Datos de identificación y contacto
            </Text>
          </View>
        </View>

      <Text style={styles.label}>
        Nombres *
      </Text>

      <TextInput
        style={styles.input}
        value={nombres}
        onChangeText={setNombres}
        placeholder="Nombres"
      />

      <Text style={styles.label}>
        Apellidos *
      </Text>

      <TextInput
        style={styles.input}
        value={apellidos}
        onChangeText={setApellidos}
        placeholder="Apellidos"
      />

      <Text style={styles.label}>
        Tipo de documento *
      </Text>

      <TextInput
        style={styles.input}
        value={tipoDocumento}
        onChangeText={setTipoDocumento}
        placeholder="Ejemplo: CC, TI, CE"
      />

      <Text style={styles.label}>
        Número de documento *
      </Text>

      <TextInput
        style={styles.input}
        value={numeroDocumento}
        onChangeText={setNumeroDocumento}
        placeholder="Número de documento"
        keyboardType="numeric"
      />

      <Text style={styles.label}>
        Correo institucional *
      </Text>

      <TextInput
        style={styles.input}
        value={correo}
        onChangeText={setCorreo}
        placeholder="usuario@institucion.edu"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>
        Teléfono *
      </Text>

      <TextInput
        style={styles.input}
        value={telefono}
        onChangeText={setTelefono}
        placeholder="Número de teléfono"
        keyboardType="phone-pad"
      />
      </View>
      {/* FIN TARJETA: INFORMACIÓN PERSONAL */}

      {/* TARJETA: ROL INSTITUCIONAL */}
      <View style={styles.formCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons
              name="people-outline"
              size={21}
              color="#123B73"
            />
          </View>

          <View style={styles.cardHeaderContent}>
            <Text style={styles.cardTitle}>
              Rol institucional
            </Text>

            <Text style={styles.cardSubtitle}>
              Selecciona el perfil del nuevo usuario
            </Text>
          </View>
        </View>

      <Text style={styles.label}>
        Rol *
      </Text>

      <View style={styles.optionsContainer}>
        {roles.map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.option,
              rol === item &&
                styles.optionSelected,
            ]}
            onPress={() => {
              if (item !== rol) {
                solicitudAmbitosId.current += 1;
                setGradoId(null);
                setGrupoId(null);
                setGrupos([]);
                setGradoAmbitoId(null);
                setGruposAmbito([]);
                setAmbitosOrientador([]);
                setCargandoGruposAmbito(false);
                setEstudiantesSeleccionados([]);
              }

              setRol(item);
            }}
          >
            <Text
              style={[
                styles.optionText,
                rol === item &&
                  styles.optionTextSelected,
              ]}
            >
              {item.charAt(0).toUpperCase() +
                item.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FIN TARJETA: ROL INSTITUCIONAL */}
      </View>

      {rol === 'estudiante' && (
        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons
                name="school-outline"
                size={22}
                color="#123B73"
              />
            </View>

            <View style={styles.cardHeaderContent}>
              <Text style={styles.cardTitle}>
                Información académica
              </Text>

              <Text style={styles.cardSubtitle}>
                Asigna el grado y grupo del estudiante
              </Text>
            </View>
          </View>

          <Text style={styles.label}>
            Grado *
          </Text>

          <View style={styles.optionsContainer}>
            {grados.map((grado) => (
              <TouchableOpacity
                key={grado.id}
                style={[
                  styles.option,
                  gradoId === grado.id &&
                    styles.optionSelected,
                ]}
                onPress={() => {
                  setGradoId(grado.id);
                  cargarGrupos(grado.id);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    gradoId === grado.id &&
                      styles.optionTextSelected,
                  ]}
                >
                  {grado.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {gradoId && (
            <>
              <Text style={styles.label}>
                Grupo *
              </Text>

              <View
                style={styles.optionsContainer}
              >
                {grupos.map((grupo) => (
                  <TouchableOpacity
                    key={grupo.id}
                    style={[
                      styles.option,
                      grupoId === grupo.id &&
                        styles.optionSelected,
                    ]}
                    onPress={() =>
                      setGrupoId(grupo.id)
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        grupoId === grupo.id &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {grupo.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {rol === 'orientador' && (
        <View style={styles.infoBox}>
          <Text style={styles.sectionTitle}>
            Ámbito de atención
          </Text>

          <Text style={styles.infoText}>
            Seleccione todos los pares de grado y
            grupo que tendrá asignados el orientador.
          </Text>

          <Text style={styles.label}>
            Grado *
          </Text>

          <View style={styles.optionsContainer}>
            {grados.map((grado) => (
              <TouchableOpacity
                key={grado.id}
                style={[
                  styles.option,
                  String(gradoAmbitoId) ===
                    String(grado.id) &&
                    styles.optionSelected,
                ]}
                onPress={() =>
                  cargarGruposOrientador(grado.id)
                }
                disabled={cargandoGruposAmbito}
                accessibilityRole="radio"
                accessibilityState={{
                  selected:
                    String(gradoAmbitoId) ===
                    String(grado.id),
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    String(gradoAmbitoId) ===
                      String(grado.id) &&
                      styles.optionTextSelected,
                  ]}
                >
                  {grado.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {gradoAmbitoId && (
            <>
              <Text style={styles.label}>
                Grupos *
              </Text>

              {cargandoGruposAmbito ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator
                    size="small"
                    color="#1F4E79"
                  />
                  <Text style={styles.searchLoadingText}>
                    Cargando grupos...
                  </Text>
                </View>
              ) : (
                <View style={styles.optionsContainer}>
                  {gruposAmbito.map((grupo) => {
                    const seleccionado =
                      ambitosOrientador.some(
                        (ambito) =>
                          String(ambito.gradoId) ===
                            String(gradoAmbitoId) &&
                          String(ambito.grupoId) ===
                            String(grupo.id)
                      );

                    return (
                      <TouchableOpacity
                        key={grupo.id}
                        style={[
                          styles.option,
                          seleccionado &&
                            styles.optionSelected,
                        ]}
                        onPress={() =>
                          alternarAmbitoOrientador(grupo)
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{
                          checked: seleccionado,
                        }}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            seleccionado &&
                              styles.optionTextSelected,
                          ]}
                        >
                          {grupo.nombre}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {ambitosOrientador.length > 0 && (
            <>
              <Text style={styles.label}>
                Ámbitos seleccionados
              </Text>

              {ambitosOrientador.map((ambito) => (
                <TouchableOpacity
                  key={`${ambito.gradoId}-${ambito.grupoId}`}
                  style={styles.studentCardSelected}
                  onPress={() =>
                    quitarAmbitoOrientador(
                      ambito.gradoId,
                      ambito.grupoId
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    `Quitar ${ambito.gradoNombre}, ` +
                    `${ambito.grupoNombre}`
                  }
                >
                  <Text style={styles.studentName}>
                    {ambito.gradoNombre} · {ambito.grupoNombre}
                  </Text>
                  <Text style={styles.selectionTextSelected}>
                    Tocar para quitar
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}

      {rol === 'acudiente' && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            Vincular estudiantes
          </Text>

          <Text style={styles.infoText}>
            Busque por nombre o número de documento.
          </Text>

          <TextInput
            style={styles.input}
            value={busquedaEstudiante}
            onChangeText={
              manejarBusquedaEstudiante
            }
            placeholder="Nombre o documento del estudiante"
          />

          {buscandoEstudiante && (
            <View style={styles.searchLoading}>
              <ActivityIndicator
                size="small"
                color="#1F4E79"
              />
              <Text style={styles.searchLoadingText}>
                Buscando estudiantes...
              </Text>
            </View>
          )}

          {resultadosEstudiantes.map(
            (estudiante) => {
              const seleccionado =
                estudiantesSeleccionados.some(
                  (item) =>
                    item.id === estudiante.id
                );

              return (
                <TouchableOpacity
                  key={estudiante.id}
                  style={[
                    styles.studentCard,
                    seleccionado &&
                      styles.studentCardSelected,
                  ]}
                  onPress={() =>
                    alternarSeleccionEstudiante(
                      estudiante
                    )
                  }
                >
                  <Text style={styles.studentName}>
                    {estudiante.nombres}{' '}
                    {estudiante.apellidos}
                  </Text>

                  <Text
                    style={
                      styles.studentDocument
                    }
                  >
                    Documento:{' '}
                    {estudiante.numero_documento}
                  </Text>

                  <Text
                    style={[
                      styles.selectionText,
                      seleccionado &&
                        styles.selectionTextSelected,
                    ]}
                  >
                    {seleccionado
                      ? '✓ Seleccionado'
                      : 'Tocar para seleccionar'}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.submitButton,
          cargando &&
            styles.submitButtonDisabled,
        ]}
        onPress={registrarUsuario}
        disabled={cargando}
      >
        {cargando ? (
          <ActivityIndicator
            color="#FFFFFF"
          />
        ) : (
          <Text style={styles.submitText}>
            Registrar usuario
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  container: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 60,
  },

  header: {
    backgroundColor: '#091D3A',
    paddingTop: Platform.OS === 'android' ? 55 : 75,
    paddingHorizontal: 24,
    paddingBottom: 35,
    marginBottom: 25,
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
    gap: 8,
    paddingVertical: 8,
  },

  backText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  headerIcon: {
    width: 55,
    height: 55,
    borderRadius: 17,
    backgroundColor: '#123B73',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 9,
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D6E4F2',
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5ECF4',
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardHeaderContent: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#091D3A',
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 18,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#263B53',
    marginBottom: 9,
  },

  input: {
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    color: '#091D3A',
    marginBottom: 19,
    minHeight: 52,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#091D3A',
    marginTop: 5,
    marginBottom: 18,
  },

  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 9,
  },

  option: {
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFD',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionSelected: {
    backgroundColor: '#123B73',
    borderColor: '#123B73',
  },

  optionText: {
    color: '#52657B',
    fontSize: 13,
    fontWeight: '600',
  },

  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 18,
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

  infoTitle: {
    color: '#091D3A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },

  infoText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 15,
  },

  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  searchLoadingText: {
    marginLeft: 8,
    color: '#455A64',
    fontSize: 13,
  },

  submitButton: {
    backgroundColor: '#123B73',
    minHeight: 56,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginHorizontal: 18,
    marginBottom: 20,
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  submitButtonDisabled: {
    opacity: 0.65,
  },

  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  searchButton: {
    backgroundColor: '#1F4E79',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },

  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  studentCard: {
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },

  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
  },

  studentDocument: {
    fontSize: 14,
    color: '#607D8B',
    marginTop: 4,
  },

  studentCardSelected: {
    borderColor: '#123B73',
    borderWidth: 1.5,
    borderRadius: 14,
    backgroundColor: '#EAF3FC',
    padding: 16,
    marginBottom: 10,
  },

  selectionText: {
    marginTop: 8,
    fontSize: 13,
    color: '#607D8B',
    fontWeight: '600',
  },

  selectionTextSelected: {
    color: '#123B73',
    fontWeight: '700',
  },
});