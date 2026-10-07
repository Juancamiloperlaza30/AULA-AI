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

export default function SubjectManagementScreen({
  accessToken,
  apiUrl,
  onBack,
  onRegisterSubject,
  onEditSubject,
}) {
  const [materias, setMaterias] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargarMaterias = useCallback(async () => {
    try {
      setCargando(true);

      const response = await fetch(
        `${apiUrl}/api/subjects`,
        {
          method: 'GET',
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
            'No fue posible consultar las materias.'
        );

        return;
      }

      setMaterias(
        data.materias || []
      );
    } catch (error) {
      console.log(
        'Error consultando materias:',
        error
      );

      Alert.alert(
        'Error de conexión',
        'No fue posible consultar las materias.'
      );
    } finally {
      setCargando(false);
    }
  }, [
    accessToken,
    apiUrl,
  ]);

  useEffect(() => {
    Promise.resolve().then(
      cargarMaterias
    );
  }, [cargarMaterias]);

  const materiasFiltradas = materias.filter(
    (item) => {
      const termino =
        busqueda.trim().toLowerCase();

      if (!termino) {
        return true;
      }

      const nombre =
        item.materia?.nombre
          ?.toLowerCase() || '';

      const grado =
        item.grado?.nombre
          ?.toLowerCase() || '';

      const grupo =
        item.grupo?.nombre
          ?.toLowerCase() || '';

      const periodo =
        item.periodo?.nombre
          ?.toLowerCase() || '';

      return (
        nombre.includes(termino) ||
        grado.includes(termino) ||
        grupo.includes(termino) ||
        periodo.includes(termino)
      );
    }
  );

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
        Gestión de Materias
      </Text>

      <Text style={styles.subtitle}>
        Consulte y administre las materias de la institución.
      </Text>

      <TouchableOpacity
        style={styles.registerButton}
        onPress={onRegisterSubject}
      >
        <Text
          style={styles.registerButtonText}
        >
          + Registrar materia
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.searchInput}
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Buscar por materia, grado, grupo o periodo"
      />

      {cargando ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="large"
          />

          <Text style={styles.loadingText}>
            Cargando materias...
          </Text>
        </View>
      ) : materiasFiltradas.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            No hay materias registradas
          </Text>

          <Text style={styles.emptyText}>
            Registre la primera materia para comenzar a organizar la estructura académica.
          </Text>
        </View>
      ) : (
        materiasFiltradas.map((item) => (
          <View
            key={item.id}
            style={styles.card}
          >
            <Text style={styles.subjectName}>
              {item.materia?.nombre}
            </Text>

            <Text style={styles.cardText}>
              Grado:{' '}
              {item.grado?.nombre}
            </Text>

            <Text style={styles.cardText}>
              Grupo:{' '}
              {item.grupo?.nombre}
            </Text>

            <Text style={styles.cardText}>
              Periodo:{' '}
              {item.periodo?.nombre}
            </Text>

            <Text style={styles.cardText}>
              Estado:{' '}
              {item.estado}
            </Text>

            <Text style={styles.cardLabel}>
              Docentes responsables:
            </Text>

            {item.docentes?.map(
              (relacion) => (
                <Text
                  key={
                    relacion.docente?.id
                  }
                  style={styles.teacherText}
                >
                  •{' '}
                  {relacion.docente
                    ?.nombres}{' '}
                  {relacion.docente
                    ?.apellidos}
                </Text>
              )
            )}

            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                onEditSubject(item)
              }
            >
              <Text style={styles.editButtonText}>
                Editar materia
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}
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
    lineHeight: 21,
    marginBottom: 25,
  },

  registerButton: {
    backgroundColor: '#1F4E79',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 25,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 20,
  },

  loadingBox: {
    alignItems: 'center',
    paddingVertical: 50,
  },

  loadingText: {
    marginTop: 12,
    color: '#607D8B',
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 6,
  },

  emptyText: {
    color: '#607D8B',
    lineHeight: 20,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E5EB',
  },

  subjectName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 12,
  },

  cardText: {
    color: '#455A64',
    marginBottom: 5,
  },

  cardLabel: {
    marginTop: 8,
    marginBottom: 4,
    color: '#263238',
    fontWeight: '600',
  },

  teacherText: {
    color: '#607D8B',
    marginBottom: 3,
  },

  editButton: {
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#1F4E79',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },

  editButtonText: {
    color: '#1F4E79',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
