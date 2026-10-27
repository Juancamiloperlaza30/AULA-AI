import React, { useState } from 'react';

import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import ProfileDashboardHeader
  from '../components/ProfileDashboardHeader';

import OrientadorAcademicAlerts
  from '../components/OrientadorAcademicAlerts';

import OrientadorAlertDetailScreen
  from './OrientadorAlertDetailScreen';

export default function OrientadorDashboard({
  usuario,
  apiUrl,
  accessToken,
  onLogout,
  onMyCommunications,
}) {
  const [alertaSeleccionada, setAlertaSeleccionada] =
    useState(null);

  const seleccionarAlerta = (alerta) => {
    if (!alerta?.id) {
      return;
    }

    setAlertaSeleccionada(alerta);
  };

  const volverAlListado = () => {
    setAlertaSeleccionada(null);
  };

  if (alertaSeleccionada) {
    return (
      <OrientadorAlertDetailScreen
        alertaId={alertaSeleccionada.id}
        estudiante={alertaSeleccionada.estudiante}
        apiUrl={apiUrl}
        accessToken={accessToken}
        onVolver={volverAlListado}
      />
    );
  }

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
          Consulta las alertas académicas de los
          estudiantes bajo tu responsabilidad y
          realiza el seguimiento de sus casos.
        </Text>
      </View>

      {typeof onMyCommunications === 'function' && (
        <TouchableOpacity
          style={styles.communicationCard}
          onPress={onMyCommunications}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Consultar mis comunicados institucionales"
        >
          <View style={styles.communicationHeader}>
            <Text style={styles.communicationTitle}>
              📢 Mis comunicados
            </Text>

            <Text style={styles.communicationArrow}>
              ›
            </Text>
          </View>

          <Text style={styles.communicationText}>
            Consulta los avisos, novedades y
            comunicados institucionales dirigidos a ti.
          </Text>
        </TouchableOpacity>
      )}

      <OrientadorAcademicAlerts
        apiUrl={apiUrl}
        accessToken={accessToken}
        onSeleccionarAlerta={seleccionarAlerta}
      />

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={onLogout}
        accessibilityRole="button"
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
    paddingBottom: 35,
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

  communicationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginTop: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },

  communicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  communicationTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1D2A3A',
  },

  communicationArrow: {
    fontSize: 27,
    color: '#304F73',
    marginLeft: 10,
  },

  communicationText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
    marginTop: 8,
  },

  logoutButton: {
    marginTop: 22,
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
