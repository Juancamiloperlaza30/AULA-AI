import {
  useCallback,
  useEffect,
  useRef,
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
        Alert.alert(
          'Error',
          data.message || 'No fue posible cargar los grados.'
        );
        return;
      }

      setGrados(data.grados || []);
    } catch (error) {
      console.log('Error cargando grados:', error);

      Alert.alert(
        'Error de conexión',
        'No fue posible consultar los grados.'
      );
    }
  }, [
    accessToken,
    apiUrl,
  ]);

  useEffect(() => {
    if (rol === 'estudiante') {
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
        Alert.alert(
          'Error',
          data.message || 'No fue posible cargar los grupos.'
        );
        return;
      }

      setGrupos(data.grupos || []);
    } catch (error) {
      console.log('Error cargando grupos:', error);

      Alert.alert(
        'Error de conexión',
        'No fue posible consultar los grupos.'
      );
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
          Alert.alert(
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
      Alert.alert(
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

      limpiarFormulario();
    } catch (error) {
      console.log(
        'Error registrando usuario:',
        error
      );

      Alert.alert(
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
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
      >
        <Text style={styles.backText}>
          ← Volver
        </Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        Registrar usuario
      </Text>

      <Text style={styles.subtitle}>
        Complete la información del nuevo usuario.
      </Text>

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
              setRol(item);

              if (item !== 'estudiante') {
                setGradoId(null);
                setGrupoId(null);
              }
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

      {rol === 'estudiante' && (
        <>
          <Text style={styles.sectionTitle}>
            Información académica
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
        </>
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
    backgroundColor: '#F5F7FA',
  },

  container: {
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 50,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },

  backText: {
    color: '#1F4E79',
    fontWeight: '600',
    fontSize: 16,
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 5,
  },

  subtitle: {
    fontSize: 15,
    color: '#607D8B',
    marginBottom: 30,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#263238',
    marginBottom: 8,
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

  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginTop: 15,
    marginBottom: 20,
  },

  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  option: {
    borderWidth: 1,
    borderColor: '#C8D1DB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },

  optionSelected: {
    backgroundColor: '#1F4E79',
    borderColor: '#1F4E79',
  },

  optionText: {
    color: '#455A64',
    fontSize: 14,
  },

  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  infoBox: {
    backgroundColor: '#EAF1F8',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },

  infoTitle: {
    color: '#1F4E79',
    fontWeight: 'bold',
    marginBottom: 5,
  },

  infoText: {
    color: '#455A64',
    lineHeight: 20,
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
    backgroundColor: '#1F4E79',
    minHeight: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    padding: 14,
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
    borderColor: '#1F4E79',
    borderWidth: 2,
    backgroundColor: '#EAF1F8',
  },

  selectionText: {
    marginTop: 8,
    fontSize: 13,
    color: '#607D8B',
    fontWeight: '600',
  },

  selectionTextSelected: {
    color: '#1F4E79',
  },
});