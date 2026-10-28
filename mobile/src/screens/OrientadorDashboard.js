import React, { useState } from 'react';

import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import ProfileDashboardHeader
  from '../components/ProfileDashboardHeader';

import OrientadorAcademicAlerts
  from '../components/OrientadorAcademicAlerts';

import OrientadorAlertDetailScreen
  from './OrientadorAlertDetailScreen';

const COLORS = {
  navy: '#091D3A',
  blue: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#263B53',
  muted: '#718096',
  border: '#DFE7F0',
  red: '#A52A22',
};

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
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerDecoration} />

        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="heart-outline"
              size={25}
              color={COLORS.white}
            />
          </View>

          <View style={styles.brandContent}>
            <Text style={styles.brandName}>
              AULA<Text style={styles.brandAccent}>-AI</Text>
            </Text>

            <Text style={styles.brandSubtitle}>
              Acompañamiento académico
            </Text>
          </View>

          <View style={styles.roleBadge}>
            <Ionicons
              name="heart-circle-outline"
              size={14}
              color={COLORS.cyan}
            />
            <Text style={styles.roleBadgeText}>
              ORIENTADOR
            </Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>
          Panel del orientador
        </Text>

        <Text style={styles.headerDescription}>
          Acompaña el proceso académico y realiza
          seguimiento oportuno a los casos asignados.
        </Text>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.profileSection}>
          <View style={styles.sectionLabel}>
            <Ionicons
              name="person-circle-outline"
              size={20}
              color={COLORS.blue}
            />
            <Text style={styles.sectionLabelText}>
              Mi perfil
            </Text>
          </View>

          <View style={styles.profileCard}>
            <ProfileDashboardHeader
              key={usuario?.id}
              apiUrl={apiUrl}
              accessToken={accessToken}
              orientadorPremium
            />
          </View>
        </View>

        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons
              name="analytics-outline"
              size={23}
              color={COLORS.cyan}
            />
          </View>

          <Text style={styles.introEyebrow}>
            SEGUIMIENTO Y ACOMPAÑAMIENTO
          </Text>

          <Text style={styles.introTitle}>
            Alertas académicas
          </Text>

          <Text style={styles.introText}>
            Consulta las alertas de estudiantes bajo tu
            responsabilidad y realiza seguimiento a sus casos.
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
            <View style={styles.communicationIcon}>
              <Ionicons
                name="megaphone-outline"
                size={23}
                color="#7353B6"
              />
            </View>

            <View style={styles.communicationContent}>
              <Text style={styles.communicationTitle}>
                Mis comunicados
              </Text>
              <Text style={styles.communicationText}>
                Consulta los avisos, novedades y comunicados
                institucionales dirigidos a ti.
              </Text>
            </View>

            <Ionicons
              name="arrow-forward-circle-outline"
              size={25}
              color={COLORS.cyan}
            />
          </TouchableOpacity>
        )}

        <OrientadorAcademicAlerts
          apiUrl={apiUrl}
          accessToken={accessToken}
          onSeleccionarAlerta={seleccionarAlerta}
        />

        <View style={styles.sessionSection}>
          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={onLogout}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color={COLORS.red}
            />
            <Text style={styles.logoutText}>
              Cerrar sesión
            </Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            AULA-AI · Acompañamiento académico
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 36,
  },
  header: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 23,
    paddingTop: 58,
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerDecoration: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(39,196,232,0.07)',
    top: -105,
    right: -42,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  brandIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: '#17375B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  brandContent: {
    flex: 1,
  },
  brandName: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },
  brandAccent: {
    color: COLORS.cyan,
  },
  brandSubtitle: {
    color: '#B8CADF',
    fontSize: 10,
    marginTop: 3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#17375B',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  roleBadgeText: {
    color: '#9CEAF8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
  },
  headerDescription: {
    color: '#C5D5E5',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  mainContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  profileSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 9,
  },
  sectionLabelText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  introCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 21,
    padding: 20,
    marginBottom: 15,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.cyan,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#17375B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  introEyebrow: {
    color: '#78DDF1',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  introTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
  },
  introText: {
    color: '#C5D5E5',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
  communicationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  communicationIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: '#F1ECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  communicationContent: {
    flex: 1,
    minWidth: 0,
  },
  communicationTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  communicationText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  sessionSection: {
    alignItems: 'center',
    paddingTop: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  logoutButton: {
    minHeight: 48,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF4F2',
    borderWidth: 1,
    borderColor: '#FEE4E2',
    borderRadius: 14,
  },
  logoutText: {
    color: COLORS.red,
    fontSize: 14,
    fontWeight: '800',
  },
  footerText: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 16,
  },
});
