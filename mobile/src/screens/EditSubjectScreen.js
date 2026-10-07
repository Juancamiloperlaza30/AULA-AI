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

const EditSubjectScreen = ({
  apiUrl,
  accessToken,
  subject,
  onBack,
  onUpdated,
}) => {
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
      subject?.docentes?.map(
        (item) => item.docente?.id
      ).filter(Boolean) ||
      []
  );

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);

      const headers = {
        Authorization:
          `Bearer ${accessToken}`,
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
  }, [
    accessToken,
    apiUrl,
  ]);

  const cargarGrupos = useCallback(async (idGrado) => {
    try {
      setGrupos([]);

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
        'Error',
        'No fue posible cargar los grupos.'
      );
    }
  }, [
    accessToken,
    apiUrl,
  ]);

  useEffect(() => {
    Promise.resolve().then(
      cargarDatos
    );
  }, [cargarDatos]);

  useEffect(() => {
    if (gradoId) {
      Promise.resolve().then(
        () => cargarGrupos(gradoId)
      );
    }
  }, [
    cargarGrupos,
    gradoId,
  ]);

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
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${accessToken}`,
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

      const data =
        await response.json();

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

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Cargando información...
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
        Editar materia
      </Text>

      <Text style={styles.label}>
        Nombre *
      </Text>

      <TextInput
        style={styles.input}
        value={nombre}
        onChangeText={setNombre}
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
              setGrupoId(null);
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

      <Text style={styles.label}>
        Grupo *
      </Text>

      <View style={styles.optionsContainer}>
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
              setPeriodoId(periodo.id)
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
        Docente o docentes *
      </Text>

      <View style={styles.optionsContainer}>
        {docentes.map((docente) => {
          const seleccionado =
            docentesIds.includes(docente.id);

          return (
            <TouchableOpacity
              key={docente.id}
              style={[
                styles.option,
                seleccionado &&
                  styles.optionSelected,
              ]}
              onPress={() =>
                seleccionarDocente(docente.id)
              }
            >
              <Text
                style={[
                  styles.optionText,
                  seleccionado &&
                    styles.optionTextSelected,
                ]}
              >
                {docente.nombres}{' '}
                {docente.apellidos}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>
        Estado *
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
        onPress={guardarCambios}
        disabled={guardando}
      >
        {guardando ? (
          <ActivityIndicator
            color="#FFFFFF"
          />
        ) : (
          <Text style={styles.saveButtonText}>
            {guardando
              ? 'Guardando...'
              : 'Guardar cambios'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backText}>
          Volver
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

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
    marginBottom: 30,
  },

  option: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C8D1DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
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

  saveButton: {
    minHeight: 52,
    backgroundColor: '#1F4E79',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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

export default EditSubjectScreen;
