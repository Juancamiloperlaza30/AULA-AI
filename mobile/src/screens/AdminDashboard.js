import React from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import ProfileDashboardHeader
  from '../components/ProfileDashboardHeader';

const COLORS = {
  navy: '#091D3A',
  primary: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#1D2939',
  secondary: '#667085',
  border: '#E4EAF2',
  green: '#16A34A',
  red: '#B42318',
};

function SectionTitle({ title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {subtitle ? (
        <Text style={styles.sectionSubtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function DashboardCard({
  icon,
  title,
  description,
  onPress,
  accentColor = COLORS.primary,
  disabled = false,
}) {
  const content = (
    <View
      style={[
        styles.card,
        disabled && styles.disabledCard,
      ]}
    >
      <View
        style={[
          styles.cardIconContainer,
          {
            backgroundColor: disabled
              ? '#F2F4F7'
              : `${accentColor}12`,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={
            disabled
              ? '#98A2B3'
              : accentColor
          }
        />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardTitleRow}>
          <Text
            style={[
              styles.cardTitle,
              disabled && styles.disabledText,
            ]}
          >
            {title}
          </Text>

          {disabled && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>
                Próximamente
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.cardDescription}>
          {description}
        </Text>
      </View>

      {!disabled && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color="#98A2B3"
        />
      )}
    </View>
  );

  if (disabled || typeof onPress !== 'function') {
    return content;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {content}
    </TouchableOpacity>
  );
}

export default function AdminDashboard({
  usuario,
  apiUrl,
  accessToken,
  onLogout,
  onRegisterUser,
  onManageSubjects,
  onManagePeriods,
  onMyCommunications,
  onPublishCommunication,
}) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ENCABEZADO INSTITUCIONAL */}

      <View style={styles.header}>
        <View style={styles.headerDecorationOne} />
        <View style={styles.headerDecorationTwo} />

        <View style={styles.headerTop}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="school-outline"
              size={26}
              color={COLORS.white}
            />
          </View>

          <View style={styles.brandContent}>
            <Text style={styles.brandName}>
              AULA<Text style={styles.brandAccent}>-AI</Text>
            </Text>

            <Text style={styles.brandSubtitle}>
              Gestión institucional
            </Text>
          </View>

          <View style={styles.roleBadge}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color={COLORS.cyan}
            />

            <Text style={styles.roleBadgeText}>
              ADMIN
            </Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>
          Panel de administración
        </Text>

        <Text style={styles.headerDescription}>
          Gestiona los recursos académicos y administrativos
          de tu institución desde un solo lugar.
        </Text>
      </View>

      {/* CONTENIDO */}

      <View style={styles.mainContent}>
        {/* PERFIL DEL ADMINISTRADOR */}

        <View style={styles.profileSection}>
          <View style={styles.profileSectionTitle}>
            <Ionicons
              name="person-circle-outline"
              size={20}
              color={COLORS.primary}
            />

            <Text style={styles.profileTitle}>
              Mi perfil
            </Text>
          </View>

          <View style={styles.profileCard}>
            <ProfileDashboardHeader
              key={usuario?.id}
              apiUrl={apiUrl}
              accessToken={accessToken}
            />
          </View>
        </View>

        {/* GESTIÓN INSTITUCIONAL */}

        <SectionTitle
          title="Gestión institucional"
          subtitle="Administra los recursos principales del sistema."
        />

        <DashboardCard
          icon="people-outline"
          title="Gestión de usuarios"
          description="Crear, editar, activar y desactivar usuarios."
          onPress={onRegisterUser}
          accentColor={COLORS.primary}
        />

        <DashboardCard
          icon="book-outline"
          title="Gestión de materias"
          description="Crear, consultar y asignar materias académicas."
          onPress={onManageSubjects}
          accentColor="#2563EB"
        />

        <DashboardCard
          icon="calendar-outline"
          title="Periodos académicos"
          description="Configura las fechas de los periodos académicos."
          onPress={onManagePeriods}
          accentColor="#7C3AED"
        />

        {/* COMUNICACIONES */}

        <SectionTitle
          title="Comunicaciones"
          subtitle="Mantén informada a la comunidad educativa."
        />

        {typeof onPublishCommunication === 'function' && (
          <DashboardCard
            icon="create-outline"
            title="Publicar comunicado"
            description="Redacta y envía comunicados institucionales."
            onPress={onPublishCommunication}
            accentColor="#0891B2"
          />
        )}

        {typeof onMyCommunications === 'function' && (
          <DashboardCard
            icon="megaphone-outline"
            title="Mis comunicados"
            description="Consulta los avisos y comunicados dirigidos a ti."
            onPress={onMyCommunications}
            accentColor="#0D9488"
          />
        )}

        {/* ADMINISTRACIÓN AVANZADA */}

        <SectionTitle
          title="Administración avanzada"
          subtitle="Herramientas complementarias de gestión."
        />

        <DashboardCard
          icon="key-outline"
          title="Roles y permisos"
          description="Administración de accesos y permisos del sistema."
          disabled
        />

        <DashboardCard
          icon="analytics-outline"
          title="Monitoreo del sistema"
          description="Consulta de actividad y eventos administrativos."
          disabled
        />

        {/* CERRAR SESIÓN */}

        <View style={styles.sessionSection}>
          <View style={styles.sessionDivider} />

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={onLogout}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons
              name="log-out-outline"
              size={21}
              color={COLORS.red}
            />

            <Text style={styles.logoutText}>
              Cerrar sesión
            </Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            AULA-AI · Plataforma de acompañamiento escolar
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
    paddingBottom: Platform.OS === 'android' ? 60 : 40,
  },

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 55 : 75,
    paddingHorizontal: 22,
    paddingBottom: 70,
    overflow: 'hidden',
  },

  headerDecorationOne: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(39,196,232,0.07)',
    top: -100,
    right: -90,
  },

  headerDecorationTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -70,
    left: -60,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },

  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  brandContent: {
    flex: 1,
  },

  brandName: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.white,
  },

  brandAccent: {
    color: COLORS.cyan,
  },

  brandSubtitle: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
  },

  roleBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 9,
  },

  headerDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D6E4F2',
    maxWidth: 320,
  },

  mainContent: {
    paddingHorizontal: 18,
    marginTop: -38,
  },

  profileSection: {
    marginBottom: 28,
  },

  profileSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 13,
    marginLeft: 4,
  },

  profileTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },

  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  sectionHeader: {
    marginTop: 7,
    marginBottom: 15,
    paddingHorizontal: 4,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 5,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.secondary,
    lineHeight: 18,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cardIconContainer: {
    width: 49,
    height: 49,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  cardContent: {
    flex: 1,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 5,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },

  cardDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.secondary,
  },

  disabledCard: {
    backgroundColor: '#FAFBFC',
    opacity: 0.75,
  },

  disabledText: {
    color: '#667085',
  },

  pendingBadge: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },

  pendingBadgeText: {
    color: '#667085',
    fontSize: 9,
    fontWeight: '700',
  },

  sessionSection: {
    marginTop: 25,
  },

  sessionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 24,
  },

  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 16,
  },

  logoutText: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '800',
  },

  footerText: {
    textAlign: 'center',
    color: '#98A2B3',
    fontSize: 11,
    marginTop: 25,
  },
});
