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
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Cargando información académica...
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
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
      >
        <Text style={styles.backText}>
          ← Volver
        </Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        Registrar materia
      </Text>

      <Text style={styles.label}>
        Nombre de la materia *
      </Text>

      <TextInput
        style={styles.input}
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ejemplo: Matemáticas"
      />

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
            Grupo o grupos *
          </Text>

          <TextInput
            style={styles.input}
            value={busquedaGrupo}
            onChangeText={setBusquedaGrupo}
            placeholder="Buscar grupo"
          />

          <View style={styles.optionsContainer}>
            {gruposFiltrados.map((grupo) => {
              const seleccionado =
                gruposSeleccionados.some(
                  (item) =>
                    item.id === grupo.id
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
                    alternarGrupo(grupo)
                  }
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
        </>
      )}

      <Text style={styles.label}>
        Docente o docentes responsables *
      </Text>

      <TextInput
        style={styles.input}
        value={busquedaDocente}
        onChangeText={setBusquedaDocente}
        placeholder="Buscar docente por nombre, documento o correo"
      />

      {buscandoDocentes && (
        <Text style={styles.searchingText}>
          Buscando docentes...
        </Text>
      )}

      <View style={styles.listContainer}>
        {docentes.map((docente) => {
          const seleccionado =
            docentesSeleccionados.some(
              (item) =>
                item.id === docente.id
            );

          return (
            <TouchableOpacity
              key={docente.id}
              style={[
                styles.personCard,
                seleccionado &&
                  styles.personCardSelected,
              ]}
              onPress={() =>
                alternarDocente(
                  docente
                )
              }
            >
              <Text style={styles.personName}>
                {docente.nombres}{' '}
                {docente.apellidos}
              </Text>

              <Text style={styles.personInfo}>
                {docente.correo}
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
        })}
      </View>

      <Text style={styles.label}>
        Periodo académico *
      </Text>

      <View style={styles.optionsContainer}>
        {periodos.map((periodo) => (
          <TouchableOpacity
            key={periodo.id}
            style={[
              styles.option,
              periodoId === periodo.id &&
                styles.optionSelected,
            ]}
            onPress={() =>
              setPeriodoId(
                periodo.id
              )
            }
          >
            <Text
              style={[
                styles.optionText,
                periodoId === periodo.id &&
                  styles.optionTextSelected,
              ]}
            >
              {periodo.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>
        Estado
      </Text>

      <View style={styles.optionsContainer}>
        {[
          'activa',
          'inactiva',
        ].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.option,
              estado === item &&
                styles.optionSelected,
            ]}
            onPress={() =>
              setEstado(item)
            }
          >
            <Text
              style={[
                styles.optionText,
                estado === item &&
                  styles.optionTextSelected,
              ]}
            >
              {item === 'activa'
                ? 'Activa'
                : 'Inactiva'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.saveButton,
          guardando &&
            styles.saveButtonDisabled,
        ]}
        onPress={guardarMateria}
        disabled={guardando}
      >
        {guardando ? (
          <ActivityIndicator
            color="#FFFFFF"
          />
        ) : (
          <Text style={styles.saveButtonText}>
            Registrar materia
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

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: '#607D8B',
  },

  backButton: {
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
    minHeight: 52,
    backgroundColor: '#1F4E79',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
