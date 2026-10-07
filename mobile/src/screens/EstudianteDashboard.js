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

export default function EstudianteDashboard({
  usuario,
  apiUrl,
  accessToken,
  onLogout,
  onMySubjects,
  onMyActivities,
  onMyGrades,
}) {
  const [
    resumenAcademico,
    setResumenAcademico,
  ] = useState(null);

  const [
    actividadesPendientes,
    setActividadesPendientes,
  ] = useState(null);

  const [
    periodoActual,
    setPeriodoActual,
  ] = useState(null);

  useEffect(() => {
    const cargarResumenAcademico =
      async () => {
        try {
          const response = await fetch(
            `${apiUrl}/api/subjects/mis-materias-estudiante`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          );

          const data =
            await response.json();

          if (
            response.ok &&
            data.resumenAcademico
          ) {
            setResumenAcademico(
              data.resumenAcademico
            );
          }
        } catch (error) {
          console.log(
            'Error cargando resumen académico:',
            error
          );
        }
      };

    cargarResumenAcademico();
  }, [apiUrl, accessToken]);

  useEffect(() => {
    const cargarActividadesPendientes =
      async () => {
        try {
          const response = await fetch(
            `${apiUrl}/api/activities/mis-actividades-estudiante`,
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

          const actividades =
            data.actividades || [];

          const pendientes =
            actividades.filter(
              (actividad) =>
                !actividad.entrega
            ).length;

          setActividadesPendientes(
            pendientes
          );
        } catch (error) {
          console.log(
            'Error cargando actividades pendientes:',
            error
          );
        }
      };

    cargarActividadesPendientes();
  }, [apiUrl, accessToken]);

  useEffect(() => {
    const cargarPeriodoActual =
      async () => {
        try {
          const response = await fetch(
            `${apiUrl}/api/academic/periodo-actual`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          );

          const data =
            await response.json();

          if (
            response.ok &&
            data.periodo
          ) {
            setPeriodoActual(
              data.periodo
            );
          }
        } catch (error) {
          console.log(
            'Error cargando periodo actual:',
            error
          );
        }
      };

    cargarPeriodoActual();
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
        apiUrl={apiUrl}
        accessToken={accessToken}
      >
        <View style={styles.academicSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {resumenAcademico?.grado || '-'}
            </Text>

            <Text style={styles.summaryLabel}>
              Grado
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {resumenAcademico?.grupo || '-'}
            </Text>

            <Text style={styles.summaryLabel}>
              Grupo
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {resumenAcademico?.totalMaterias ?? '-'}
            </Text>

            <Text style={styles.summaryLabel}>
              Materias
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {actividadesPendientes ?? '-'}
            </Text>

            <Text
              style={styles.summaryLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Pendientes
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {periodoActual?.nombre
                ?.match(/\d+/)?.[0] || '-'}
            </Text>

            <Text
              style={styles.summaryLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Periodo
            </Text>
          </View>
        </View>
      </ProfileDashboardHeader>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Mi información académica
        </Text>

        <Text style={styles.cardText}>
          Consulta de materias, actividades y rendimiento.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.card}
        onPress={onMySubjects}
      >
        <Text style={styles.cardTitle}>
          Mis materias
        </Text>

        <Text style={styles.cardText}>
          Consulte las materias correspondientes a su grado y grupo.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={onMyActivities}
      >
        <Text style={styles.cardTitle}>
          Mis actividades
        </Text>

        <Text style={styles.cardText}>
          Consulta tus tareas, actividades y exámenes.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={onMyGrades}
      >
        <Text style={styles.cardTitle}>
          Mis calificaciones
        </Text>

        <Text style={styles.cardText}>
          Consulta tus notas y la retroalimentación de tus actividades.
        </Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Recomendaciones
        </Text>

        <Text style={styles.cardText}>
          Herramientas de acompañamiento académico.
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 10,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '600',
    color: '#263238',
  },
  role: {
    fontSize: 14,
    color: '#607D8B',
    marginBottom: 30,
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
  academicSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: 11,
    fontWeight: '600',
    color: '#607D8B',
    textAlign: 'center',
  },
});