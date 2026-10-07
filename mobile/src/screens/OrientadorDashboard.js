import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import ProfileDashboardHeader
  from '../components/ProfileDashboardHeader';

export default function OrientadorDashboard({
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
        apiUrl={apiUrl}
        accessToken={accessToken}
      />

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          Panel del Orientador
        </Text>

        <Text style={styles.infoText}>
          Desde este espacio podrá acceder a las
          funciones de orientación y acompañamiento
          académico disponibles en AULA-AI.
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
    backgroundColor: '#F5F7FB',
  },

  contentContainer: {
    flexGrow: 1,
    padding: 20,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D2A3A',
    marginBottom: 8,
  },

  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
  },

  logoutButton: {
    marginTop: 'auto',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D92D20',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },

  logoutText: {
    color: '#D92D20',
    fontSize: 15,
    fontWeight: '700',
  },
});