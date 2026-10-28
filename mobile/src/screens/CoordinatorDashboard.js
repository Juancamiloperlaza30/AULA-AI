import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
          color={disabled ? '#98A2B3' : accentColor}
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

export default function CoordinatorDashboard({
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
              name="git-network-outline"
              size={14}
              color={COLORS.cyan}
            />

            <Text style={styles.roleBadgeText}>
              COORDINADOR
            </Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>
          Panel del coordinador
        </Text>

        <Text style={styles.headerDescription}>
          Coordina la gestión académica y las comunicaciones
          de tu institución desde un solo lugar.
        </Text>
      </View>

      <View style={styles.mainContent}>
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
              coordinatorPremium
            />
          </View>
        </View>

        <SectionTitle
          title="Gestión académica"
          subtitle="Administra y acompaña los procesos académicos de la institución."
        />

        <DashboardCard
          icon="people-outline"
          title="Gestión de usuarios"
          description="Registra usuarios y consulta las vinculaciones académicas disponibles."
          onPress={onRegisterUser}
          accentColor={COLORS.primary}
        />

        <DashboardCard
          icon="book-outline"
          title="Gestión de materias"
          description="Consulta, registra, edita y asigna materias académicas."
          onPress={onManageSubjects}
          accentColor="#2563EB"
        />

        <DashboardCard
          icon="calendar-outline"
          title="Períodos académicos"
          description="Configura y consulta las fechas de los períodos de la institución."
          onPress={onManagePeriods}
          accentColor="#7C3AED"
        />

        <SectionTitle
          title="Seguimiento institucional"
          subtitle="Consulta las herramientas de acompañamiento académico."
        />

        <DashboardCard
          icon="analytics-outline"
          title="Indicadores institucionales"
          description="Consulta de información general y seguimiento académico."
          disabled
          accentColor="#0891B2"
        />

        <SectionTitle
          title="Comunicaciones"
          subtitle="Mantén informada a la comunidad educativa."
        />

        {typeof onPublishCommunication === 'function' && (
          <DashboardCard
            icon="create-outline"
            title="Publicar comunicado"
            description="Redacta y envía comunicados según los alcances autorizados para tu rol."
            onPress={onPublishCommunication}
            accentColor="#0891B2"
          />
        )}

        {typeof onMyCommunications === 'function' && (
          <DashboardCard
            icon="megaphone-outline"
            title="Mis comunicados"
            description="Consulta los avisos y comunicados institucionales dirigidos a ti."
            onPress={onMyCommunications}
            accentColor="#0D9488"
          />
        )}

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
            AULA-AI · Plataforma de acompañamiento académico
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
    paddingBottom: 36,
  },
  header: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 24,
    paddingTop: 58,
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerDecorationOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(39,196,232,0.07)',
    top: -105,
    right: -42,
  },
  headerDecorationTwo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -84,
    left: '48%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#17375B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandContent: {
    flex: 1,
  },
  brandName: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  brandAccent: {
    color: COLORS.cyan,
  },
  brandSubtitle: {
    color: '#B8CADF',
    fontSize: 11,
    marginTop: 3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#17375B',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  roleBadgeText: {
    color: '#9CEAF8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
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
    maxWidth: 420,
  },
  mainContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  profileSection: {
    marginBottom: 25,
  },
  profileSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  profileTitle: {
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
  sectionHeader: {
    marginTop: 4,
    marginBottom: 13,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: COLORS.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
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
  disabledCard: {
    backgroundColor: '#FAFBFC',
    borderColor: '#EAECF0',
    shadowOpacity: 0.02,
    elevation: 0,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '800',
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
    fontWeight: '800',
  },
  cardDescription: {
    color: COLORS.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sessionSection: {
    alignItems: 'center',
    paddingTop: 14,
  },
  sessionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    alignSelf: 'stretch',
    marginBottom: 18,
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
    fontWeight: '800',
    fontSize: 14,
  },
  footerText: {
    color: COLORS.secondary,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 17,
  },
});
