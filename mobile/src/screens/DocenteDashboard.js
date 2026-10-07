import {
  useEffect,
  useState,
} from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ProfileDashboardHeader
  from '../components/ProfileDashboardHeader';

export default function DocenteDashboard({
  usuario,
  apiUrl,
  accessToken,
  onLogout,
  onMySubjects,
  onAcademicActivities,
  onGrades,
}) {
  const [
    resumenDocente,
    setResumenDocente,
  ] = useState({
    materias: null,
    grupos: null,
  });

  useEffect(() => {
    const cargarResumenDocente =
      async () => {
        try {
          const response = await fetch(
            `${apiUrl}/api/subjects/mis-materias`,
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
            return;
          }

          const asignaciones =
            (data.materias || []).filter(
              (item) =>
                item?.estado === 'activa'
            );

          const materiasUnicas =
            new Set(
              asignaciones
                .map(
                  (item) =>
                    item?.materia?.id
                )
                .filter(Boolean)
            );

          const gruposUnicos =
            new Set(
              asignaciones
                .filter(
                  (item) =>
                    item?.grado?.id &&
                    item?.grupo?.id
                )
                .map(
                  (item) =>
                    `${item.grado.id}-${item.grupo.id}`
                )
            );

          setResumenDocente({
            materias:
              materiasUnicas.size,
            grupos:
              gruposUnicos.size,
          });
        } catch (error) {
          console.log(
            'Error cargando resumen del docente:',
            error
          );
        }
      };

    cargarResumenDocente();
  }, [apiUrl, accessToken]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.contentContainer
      }
      showsVerticalScrollIndicator={false}
    >
      <ProfileDashboardHeader
        key={usuario?.id}
        apiUrl={apiUrl}
        accessToken={accessToken}
      >
        <View style={styles.teacherSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {resumenDocente.materias ?? '-'}
            </Text>

            <Text style={styles.summaryLabel}>
              Materias
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {resumenDocente.grupos ?? '-'}
            </Text>

            <Text style={styles.summaryLabel}>
              Grupos
            </Text>
          </View>
        </View>
      </ProfileDashboardHeader>

      <TouchableOpacity
        style={styles.card}
        onPress={onMySubjects}
      >
        <Text style={styles.cardTitle}>
          Mis materias
        </Text>

        <Text style={styles.cardText}>
          Consulte las materias que tiene asignadas.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={onAcademicActivities}
      >
        <Text style={styles.cardTitle}>
          Actividades Académicas
        </Text>

        <Text style={styles.cardText}>
          Registra y consulta tareas, actividades y exámenes.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={onGrades}
      >
        <Text style={styles.cardTitle}>
          Calificaciones
        </Text>

        <Text style={styles.cardText}>
          Registra las calificaciones y retroalimentación
          de tus estudiantes.
        </Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Mis estudiantes
        </Text>

        <Text style={styles.cardText}>
          Gestión académica de los estudiantes asignados.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={onLogout}
      >
        <Text style={styles.logoutText}>
          Cerrar sesión
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 50,
  },
  teacherSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F4E79',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#607D8B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E6ED',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14,
    color: '#455A64',
  },
  logoutButton: {
    marginTop: 30,
    backgroundColor: '#B3261E',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});