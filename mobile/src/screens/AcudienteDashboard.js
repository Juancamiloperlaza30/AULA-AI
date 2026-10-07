import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ProfileDashboardHeader
  from '../components/ProfileDashboardHeader';

export default function AcudienteDashboard({
  usuario,
  apiUrl,
  accessToken,
  onLogout,
}) {
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
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Estudiantes a cargo
        </Text>

        <Text style={styles.cardText}>
          Consulta del seguimiento académico autorizado.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Alertas y notificaciones
        </Text>

        <Text style={styles.cardText}>
          Consulta de alertas académicas e institucionales.
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