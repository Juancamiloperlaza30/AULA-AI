'use strict';

// ======================================================
// AULA-AI | PANEL DOCENTE
// REDISEÑO PREMIUM
// ======================================================

import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import ProfileDashboardHeader from '../components/ProfileDashboardHeader';

// ======================================================
// COLORES INSTITUCIONALES
// ======================================================

const COLORS = {
  navy: '#091D3A',
  blue: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#263B53',
  muted: '#718096',
  border: '#DFE7F0',
  pale: '#EAF3FC',
  red: '#B3261E',
  green: '#21845B',
};

// ======================================================
// TARJETA DE ACCESO
// ======================================================

function ModuleCard({
  title,
  description,
  icon,
  onPress,
  badge,
  disabled = false,
}) {
  const content = (
    <>
      <View style={styles.moduleIcon}>
        <Ionicons
          name={icon}
          size={24}
          color={COLORS.blue}
        />
      </View>

      <View style={styles.moduleContent}>
        <View style={styles.moduleTitleRow}>
          <Text style={styles.moduleTitle}>
            {title}
          </Text>

          {badge ? (
            <View style={styles.moduleBadge}>
              <Text style={styles.moduleBadgeText}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.moduleDescription}>
          {description}
        </Text>
      </View>

      <View style={styles.moduleArrow}>
        <Ionicons
          name={
            disabled
              ? 'information-circle-outline'
              : 'chevron-forward'
          }
          size={20}
          color={COLORS.blue}
        />
      </View>
    </>
  );

  if (disabled || typeof onPress !== 'function') {
    return (
      <View
        style={[
          styles.moduleCard,
          styles.moduleCardDisabled,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.moduleCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {content}
    </TouchableOpacity>
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function DocenteDashboard({
  usuario,
  apiUrl,
  accessToken,
  onLogout,
  onMySubjects,
  onAcademicActivities,
  onGrades,
  onAttendance,
  onReviewExcuses,
  onMyCommunications,
}) {
  // ====================================================
  // ESTADOS
  // ====================================================

  const [
    resumenDocente,
    setResumenDocente,
  ] = useState({
    materias: null,
    grupos: null,
  });

  const [
    cargandoResumen,
    setCargandoResumen,
  ] = useState(true);

  // ====================================================
  // CONSULTAR RESUMEN DEL DOCENTE
  // ====================================================

  useEffect(() => {
    let activo = true;

    const cargarResumenDocente = async () => {
      setCargandoResumen(true);

      try {
        const response = await fetch(
          `${apiUrl}/api/subjects/mis-materias`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          return;
        }

        const asignaciones = (
          data.materias || []
        ).filter(
          (item) => item?.estado === 'activa'
        );

        const materiasUnicas = new Set(
          asignaciones
            .map((item) => item?.materia?.id)
            .filter(Boolean)
        );

        const gruposUnicos = new Set(
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

        if (activo) {
          setResumenDocente({
            materias: materiasUnicas.size,
            grupos: gruposUnicos.size,
          });
        }
      } catch (error) {
        console.log(
          'Error cargando resumen del docente:',
          error
        );
      } finally {
        if (activo) {
          setCargandoResumen(false);
        }
      }
    };

    cargarResumenDocente();

    return () => {
      activo = false;
    };
  }, [apiUrl, accessToken]);

  // ====================================================
  // VISTA PRINCIPAL
  // ====================================================

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.contentContainer
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ================================================
          ENCABEZADO INSTITUCIONAL
      ================================================ */}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <Ionicons
              name="school-outline"
              size={15}
              color={COLORS.cyan}
            />

            <Text style={styles.heroBadgeText}>
              AULA-AI
            </Text>
          </View>

          <View style={styles.heroRoleBadge}>
            <Text style={styles.heroRoleText}>
              DOCENTE
            </Text>
          </View>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons
            name="book-outline"
            size={30}
            color={COLORS.white}
          />
        </View>

        <Text style={styles.heroTitle}>
          Panel Docente
        </Text>

        <Text style={styles.heroDescription}>
          Gestiona tus materias, actividades,
          calificaciones y el seguimiento académico
          de tus estudiantes desde un solo lugar.
        </Text>
      </View>

      {/* ================================================
          PERFIL ORIGINAL
      ================================================ */}

      <View style={styles.profileSection}>
        <ProfileDashboardHeader
          key={usuario?.id}
          apiUrl={apiUrl}
          accessToken={accessToken}
        >
          <View style={styles.teacherSummary}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIcon}>
                <Ionicons
                  name="library-outline"
                  size={19}
                  color={COLORS.blue}
                />
              </View>

              {cargandoResumen ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.blue}
                />
              ) : (
                <Text style={styles.summaryValue}>
                  {resumenDocente.materias ?? '-'}
                </Text>
              )}

              <Text style={styles.summaryLabel}>
                Materias
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <View style={styles.summaryIcon}>
                <Ionicons
                  name="people-outline"
                  size={19}
                  color={COLORS.blue}
                />
              </View>

              {cargandoResumen ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.blue}
                />
              ) : (
                <Text style={styles.summaryValue}>
                  {resumenDocente.grupos ?? '-'}
                </Text>
              )}

              <Text style={styles.summaryLabel}>
                Grupos
              </Text>
            </View>
          </View>
        </ProfileDashboardHeader>
      </View>

      {/* ================================================
          INTRODUCCIÓN A LOS MÓDULOS
      ================================================ */}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            Gestión académica
          </Text>

          <Text style={styles.sectionDescription}>
            Accede a tus herramientas de trabajo
          </Text>
        </View>

        <View style={styles.sectionIcon}>
          <Ionicons
            name="grid-outline"
            size={21}
            color={COLORS.blue}
          />
        </View>
      </View>

      {/* ================================================
          MIS MATERIAS
      ================================================ */}

      <ModuleCard
        title="Mis materias"
        description="Consulta las materias y los grupos que tienes asignados."
        icon="library-outline"
        onPress={onMySubjects}
      />

      {/* ================================================
          REVISIÓN DE EXCUSAS
      ================================================ */}

      <ModuleCard
        title="Revisión de excusas"
        description="Consulta las excusas de tus estudiantes, revisa sus soportes y registra una decisión."
        icon="document-text-outline"
        onPress={onReviewExcuses}
      />

      {/* ================================================
          ACTIVIDADES ACADÉMICAS
      ================================================ */}

      <ModuleCard
        title="Actividades académicas"
        description="Registra y consulta tareas, actividades y exámenes."
        icon="clipboard-outline"
        onPress={onAcademicActivities}
      />

      {/* ================================================
          CALIFICACIONES
      ================================================ */}

      <ModuleCard
        title="Calificaciones"
        description="Registra las calificaciones y la retroalimentación de tus estudiantes."
        icon="ribbon-outline"
        onPress={onGrades}
      />

      {/* ================================================
          ASISTENCIA
      ================================================ */}

      <ModuleCard
        title="Asistencia"
        description="Registra y consulta la asistencia de tus grupos asignados."
        icon="checkmark-done-circle-outline"
        onPress={onAttendance}
      />

      {/* ================================================
          COMUNICADOS INSTITUCIONALES
      ================================================ */}

      {typeof onMyCommunications === 'function' && (
        <ModuleCard
          title="Mis comunicados"
          description="Consulta los avisos, novedades y comunicados institucionales dirigidos a ti."
          icon="megaphone-outline"
          onPress={onMyCommunications}
        />
      )}

      {/* ================================================
          MIS ESTUDIANTES
          SIN NAVEGACIÓN EN EL CÓDIGO ORIGINAL
      ================================================ */}

      <ModuleCard
        title="Mis estudiantes"
        description="Gestión académica de los estudiantes asignados."
        icon="people-outline"
        badge="Informativo"
        disabled
      />

      {/* ================================================
          CERRAR SESIÓN
      ================================================ */}

      <View style={styles.sessionSection}>
        <View style={styles.sessionHeader}>
          <Ionicons
            name="shield-checkmark-outline"
            size={19}
            color={COLORS.blue}
          />

          <Text style={styles.sessionTitle}>
            Seguridad de la cuenta
          </Text>
        </View>

        <Text style={styles.sessionDescription}>
          Al finalizar tus actividades, cierra la sesión
          para proteger tu información académica.
        </Text>

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
            color={COLORS.white}
          />

          <Text style={styles.logoutText}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>
      </View>

      {/* ================================================
          PIE DE PÁGINA
      ================================================ */}

      <View style={styles.footer}>
        <Ionicons
          name="school-outline"
          size={15}
          color={COLORS.muted}
        />

        <Text style={styles.footerText}>
          AULA-AI · Gestión académica inteligente
        </Text>
      </View>
    </ScrollView>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 55,
  },

  // ====================================================
  // HERO
  // ====================================================

  hero: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 65,
    paddingBottom: 38,
    marginBottom: 22,
  },

  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },

  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  heroBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 8,
  },

  heroRoleBadge: {
    backgroundColor: 'rgba(39,196,232,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(39,196,232,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  heroRoleText: {
    color: COLORS.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 19,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  heroTitle: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 10,
  },

  heroDescription: {
    color: '#D7E5F3',
    fontSize: 13,
    lineHeight: 21,
  },

  // ====================================================
  // PERFIL Y RESUMEN
  // ====================================================

  profileSection: {
    marginBottom: 26,
  },

  teacherSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingVertical: 10,
  },

  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.blue,
    minHeight: 30,
  },

  summaryLabel: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },

  summaryDivider: {
    width: 1,
    height: 62,
    backgroundColor: COLORS.border,
  },

  // ====================================================
  // ENCABEZADO DE SECCIÓN
  // ====================================================

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
  },

  sectionTitle: {
    color: COLORS.navy,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 5,
  },

  sectionDescription: {
    color: COLORS.muted,
    fontSize: 12,
  },

  sectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ====================================================
  // TARJETAS DE MÓDULOS
  // ====================================================

  moduleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  moduleCardDisabled: {
    opacity: 0.8,
  },

  moduleIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  moduleContent: {
    flex: 1,
  },

  moduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },

  moduleTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 21,
  },

  moduleBadge: {
    backgroundColor: COLORS.pale,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },

  moduleBadgeText: {
    color: COLORS.blue,
    fontSize: 9,
    fontWeight: '800',
  },

  moduleDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
  },

  moduleArrow: {
    marginLeft: 8,
  },

  // ====================================================
  // SEGURIDAD Y CIERRE DE SESIÓN
  // ====================================================

  sessionSection: {
    marginTop: 20,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },

  sessionTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 9,
  },

  sessionDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 18,
  },

  logoutButton: {
    backgroundColor: COLORS.red,
    borderRadius: 13,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 9,
  },

  // ====================================================
  // PIE DE PÁGINA
  // ====================================================

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 27,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 7,
  },
});

// ======================================================
// FIN | DOCENTE DASHBOARD
// ======================================================