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

export default function SubjectManagementScreen({
  rol,
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
      {/* ENCABEZADO INSTITUCIONAL */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              rol === 'coordinador'
                ? 'Volver al panel del coordinador'
                : 'Volver al panel de administración'
            }
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
              {rol === 'coordinador'
                ? 'COORDINADOR'
                : 'ADMIN'}
            </Text>
          </View>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="library-outline"
            size={28}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.title}>
          Gestión de materias
        </Text>

        <Text style={styles.subtitle}>
          Consulta, registra y administra las materias
          académicas de la institución.
        </Text>
      </View>

      {/* ACCIÓN PRINCIPAL */}
      <TouchableOpacity
        style={styles.registerButton}
        onPress={onRegisterSubject}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Registrar nueva materia"
      >
        <Ionicons
          name="add-circle-outline"
          size={23}
          color="#FFFFFF"
        />

        <Text style={styles.registerButtonText}>
          Registrar nueva materia
        </Text>

        <Ionicons
          name="arrow-forward"
          size={19}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* BUSCADOR DE MATERIAS */}
      <View style={styles.searchCard}>
        <View style={styles.searchHeader}>
          <View style={styles.searchIconBox}>
            <Ionicons
              name="search-outline"
              size={21}
              color="#123B73"
            />
          </View>

          <View style={styles.searchHeaderContent}>
            <Text style={styles.searchTitle}>
              Buscar materias
            </Text>

            <Text style={styles.searchSubtitle}>
              Encuentra materias por sus datos académicos
            </Text>
          </View>
        </View>

        <View style={styles.searchInputContainer}>
          <Ionicons
            name="search"
            size={19}
            color="#718096"
          />

          <TextInput
            style={styles.searchInput}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Materia, grado, grupo o período"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            returnKeyType="search"
          />

          {busqueda.length > 0 && (
            <TouchableOpacity
              onPress={() => setBusqueda('')}
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
      </View>

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
            {/* ENCABEZADO DE LA MATERIA */}
            <View style={styles.subjectHeader}>
              <View style={styles.subjectIcon}>
                <Ionicons
                  name="book-outline"
                  size={23}
                  color="#123B73"
                />
              </View>

              <View style={styles.subjectHeaderContent}>
                <Text style={styles.subjectName}>
                  {item.materia?.nombre || 'Materia sin nombre'}
                </Text>

                <Text style={styles.subjectCaption}>
                  Información académica
                </Text>
              </View>
            </View>

            {/* INFORMACIÓN ACADÉMICA */}
            <View style={styles.subjectDetails}>
              <View style={styles.detailRow}>
                <Ionicons
                  name="school-outline"
                  size={18}
                  color="#64748B"
                />
                <Text style={styles.detailLabel}>
                  Grado:
                </Text>
                <Text style={styles.detailValue}>
                  {item.grado?.nombre || 'Sin asignar'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name="people-outline"
                  size={18}
                  color="#64748B"
                />
                <Text style={styles.detailLabel}>
                  Grupo:
                </Text>
                <Text style={styles.detailValue}>
                  {item.grupo?.nombre || 'Sin asignar'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#64748B"
                />
                <Text style={styles.detailLabel}>
                  Período:
                </Text>
                <Text style={styles.detailValue}>
                  {item.periodo?.nombre || 'Sin asignar'}
                </Text>
              </View>
            </View>

            {/* ESTADO */}
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>
                Estado de la materia
              </Text>

              <View
                style={[
                  styles.statusBadge,
                  String(item.estado || '').toLowerCase() === 'activo'
                    ? styles.statusActive
                    : styles.statusInactive,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    String(item.estado || '').toLowerCase() === 'activo'
                      ? styles.statusDotActive
                      : styles.statusDotInactive,
                  ]}
                />

                <Text
                  style={[
                    styles.statusText,
                    String(item.estado || '').toLowerCase() === 'activo'
                      ? styles.statusTextActive
                      : styles.statusTextInactive,
                  ]}
                >
                  {item.estado || 'Sin estado'}
                </Text>
              </View>
            </View>

            {/* DOCENTES RESPONSABLES */}
            <View style={styles.teachersSection}>
              <View style={styles.teachersHeader}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color="#123B73"
                />

                <Text style={styles.teachersTitle}>
                  Docentes responsables
                </Text>
              </View>

              {item.docentes?.length > 0 ? (
                item.docentes.map((relacion, index) => (
                  <View
                    key={`${relacion.docente?.id || 'docente'}-${index}`}
                    style={styles.teacherRow}
                  >
                    <View style={styles.teacherDot} />

                    <Text style={styles.teacherName}>
                      {relacion.docente?.nombres}{' '}
                      {relacion.docente?.apellidos}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noTeachersText}>
                  No hay docentes asignados.
                </Text>
              )}
            </View>

            {/* EDITAR MATERIA */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onEditSubject(item)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Editar materia ${item.materia?.nombre || ''}`}
            >
              <Ionicons
                name="create-outline"
                size={19}
                color="#123B73"
              />

              <Text style={styles.editButtonText}>
                Editar materia
              </Text>

              <Ionicons
                name="chevron-forward"
                size={17}
                color="#123B73"
              />
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
    backgroundColor: '#F4F7FB',
  },

  container: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 60,
  },

  header: {
    backgroundColor: '#091D3A',
    paddingTop: 55,
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

  registerButton: {
    backgroundColor: '#123B73',
    minHeight: 58,
    borderRadius: 16,
    marginHorizontal: 18,
    marginBottom: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  registerButtonText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 22,
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

  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  searchIconBox: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  searchHeaderContent: {
    flex: 1,
  },

  searchTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#091D3A',
    marginBottom: 4,
  },

  searchSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#718096',
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DFE7F0',
    borderRadius: 13,
    paddingHorizontal: 14,
    minHeight: 53,
    gap: 10,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#091D3A',
    fontSize: 14,
    paddingVertical: 12,
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
    borderRadius: 18,
    padding: 22,
    marginHorizontal: 18,
    borderWidth: 1,
    borderColor: '#E5ECF4',
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

  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 17,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },

  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  subjectHeaderContent: {
    flex: 1,
  },

  subjectCaption: {
    fontSize: 12,
    color: '#718096',
  },

  subjectDetails: {
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    padding: 15,
    marginBottom: 17,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 9,
  },

  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

  detailValue: {
    flex: 1,
    fontSize: 13,
    color: '#091D3A',
    fontWeight: '700',
    textAlign: 'right',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },

  statusLabel: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },

  statusActive: {
    backgroundColor: '#E7F8EF',
  },

  statusInactive: {
    backgroundColor: '#F1F5F9',
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  statusDotActive: {
    backgroundColor: '#16A34A',
  },

  statusDotInactive: {
    backgroundColor: '#64748B',
  },

  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },

  statusTextActive: {
    color: '#15803D',
  },

  statusTextInactive: {
    color: '#475569',
  },

  teachersSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    paddingTop: 17,
    marginBottom: 18,
  },

  teachersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  teachersTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#091D3A',
  },

  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    gap: 9,
  },

  teacherDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#27C4E8',
  },

  teacherName: {
    flex: 1,
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },

  noTeachersText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 18,
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

  subjectName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#091D3A',
    marginBottom: 5,
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
    backgroundColor: '#EAF3FC',
    borderWidth: 1,
    borderColor: '#D5E5F7',
    borderRadius: 13,
    minHeight: 48,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  editButtonText: {
    color: '#123B73',
    fontWeight: '800',
    fontSize: 14,
  },
});
