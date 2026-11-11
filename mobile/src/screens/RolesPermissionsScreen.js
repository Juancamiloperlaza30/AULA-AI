import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

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
};

const ROLES = [
  {
    id: 'administrador',
    nombre: 'Administrador',
    icono: 'shield-checkmark-outline',
    color: '#123B73',
    descripcion:
      'Responsable de la administración general de la plataforma.',
    funciones: [
      'Registrar y administrar usuarios.',
      'Gestionar materias y periodos académicos.',
      'Publicar comunicados institucionales.',
      'Consultar información administrativa.',
    ],
  },
  {
    id: 'coordinador',
    nombre: 'Coordinador',
    icono: 'school-outline',
    color: '#7C3AED',
    descripcion:
      'Supervisa los procesos académicos y la gestión institucional.',
    funciones: [
      'Gestionar usuarios autorizados.',
      'Administrar materias y periodos académicos.',
      'Revisar excusas académicas.',
      'Publicar comunicados.',
    ],
  },
  {
    id: 'orientador',
    nombre: 'Orientador',
    icono: 'heart-outline',
    color: '#DB2777',
    descripcion:
      'Realiza acompañamiento y seguimiento a los estudiantes.',
    funciones: [
      'Consultar información de acompañamiento.',
      'Gestionar recomendaciones y planes de seguimiento.',
      'Consultar comunicados institucionales.',
    ],
  },
  {
    id: 'docente',
    nombre: 'Docente',
    icono: 'book-outline',
    color: '#2563EB',
    descripcion:
      'Gestiona las actividades y el seguimiento académico.',
    funciones: [
      'Consultar materias asignadas.',
      'Registrar actividades académicas.',
      'Gestionar calificaciones.',
      'Registrar asistencia.',
      'Revisar excusas.',
    ],
  },
  {
    id: 'estudiante',
    nombre: 'Estudiante',
    icono: 'person-outline',
    color: '#0891B2',
    descripcion:
      'Consulta y participa en sus procesos académicos.',
    funciones: [
      'Consultar materias.',
      'Consultar y entregar actividades.',
      'Consultar calificaciones.',
      'Revisar asistencia.',
      'Consultar comunicados.',
    ],
  },
  {
    id: 'acudiente',
    nombre: 'Acudiente',
    icono: 'people-outline',
    color: '#16A34A',
    descripcion:
      'Acompaña el proceso educativo del estudiante.',
    funciones: [
      'Consultar información disponible de acompañamiento.',
      'Consultar comunicados institucionales.',
    ],
  },
];

export default function RolesPermissionsScreen({
  onBack,
  apiUrl,
  accessToken,
  onManageUsers,
}) {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [rolExpandido, setRolExpandido] = useState(null);

  useEffect(() => {
    let activo = true;
    const controller = new AbortController();

    const cargarResumen = async () => {
      setCargando(true);
      setError('');
      setResumen(null);

      try {
        const baseUrl = apiUrl.trim().replace(/\/+$/, '');
        const response = await fetch(
          `${baseUrl}/api/users/resumen`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          data?.success !== true ||
          !data.resumen ||
          typeof data.resumen.total !== 'number' ||
          typeof data.resumen.activos !== 'number' ||
          typeof data.resumen.inactivos !== 'number' ||
          !data.resumen.porRol ||
          typeof data.resumen.porRol !== 'object'
        ) {
          throw new Error(
            data?.message ||
            data?.error ||
            'No fue posible consultar las estadísticas.'
          );
        }

        if (activo) {
          setResumen(data.resumen);
        }
      } catch (err) {
        if (activo && err?.name !== 'AbortError') {
          setError(
            err?.message ||
            'No fue posible consultar las estadísticas.'
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    Promise.resolve().then(() => {
      if (!activo) {
        return;
      }

      if (
        typeof apiUrl !== 'string' ||
        !apiUrl.trim() ||
        typeof accessToken !== 'string' ||
        !accessToken.trim()
      ) {
        setError('No se encontró una sesión válida.');
        setCargando(false);
        return;
      }

      void cargarResumen();
    });

    return () => {
      activo = false;
      controller.abort();
    };
  }, [apiUrl, accessToken]);

  const alternarRol = (id) => {
    setRolExpandido((actual) =>
      actual === id ? null : id
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Regresar al panel"
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={COLORS.white}
            />
          </TouchableOpacity>

          <View style={styles.headerIcon}>
            <Ionicons
              name="key-outline"
              size={24}
              color={COLORS.cyan}
            />
          </View>
        </View>

        <Text style={styles.headerTitle}>
          Perfiles de acceso
        </Text>

        <Text style={styles.headerSubtitle}>
          Consulta informativa de los roles fijos y sus
          responsabilidades. Esta pantalla no modifica permisos.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="people-outline"
              size={25}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.summaryContent}>
            <View>
              <Text style={styles.summaryNumber}>
                {ROLES.length} roles
              </Text>

              {cargando ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 8,
                  }}
                />
              ) : error ? (
                <Text
                  style={{
                    color: '#B42318',
                    marginTop: 6,
                    fontSize: 12,
                  }}
                >
                  {error}
                </Text>
              ) : (
                <Text
                  style={{
                    color: COLORS.secondary,
                    marginTop: 6,
                  }}
                >
                  {resumen?.total ?? 0} usuarios registrados
                  {'\n'}
                  {resumen?.activos ?? 0} activos ·{' '}
                  {resumen?.inactivos ?? 0} inactivos
                </Text>
              )}
            </View>

            <Text style={styles.summaryDescription}>
              Perfiles definidos en el sistema
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Roles fijos del sistema
          </Text>

          <Text style={styles.sectionSubtitle}>
            Selecciona un rol para consultar su descripción
            y ver los usuarios asociados.
          </Text>
        </View>

        {ROLES.map((rol) => {
          const expandido = rolExpandido === rol.id;

          return (
            <View
              key={rol.id}
              style={styles.roleCard}
            >
              <TouchableOpacity
                style={styles.roleHeader}
                onPress={() => alternarRol(rol.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{
                  expanded: expandido,
                }}
              >
                <View
                  style={[
                    styles.roleIcon,
                    {
                      backgroundColor: `${rol.color}12`,
                    },
                  ]}
                >
                  <Ionicons
                    name={rol.icono}
                    size={23}
                    color={rol.color}
                  />
                </View>

                <View style={styles.roleInfo}>
                  <Text style={styles.roleName}>
                    {rol.nombre}
                  </Text>

                  {!cargando && !error && resumen && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: COLORS.primary,
                        fontWeight: '700',
                        marginBottom: 5,
                      }}
                    >
                      {resumen.porRol?.[rol.id] ?? 0}{' '}
                      {(resumen.porRol?.[rol.id] ?? 0) === 1
                        ? 'usuario registrado'
                        : 'usuarios registrados'}
                    </Text>
                  )}

                  <Text style={styles.roleDescription}>
                    {rol.descripcion}
                  </Text>
                </View>

                <Ionicons
                  name={
                    expandido
                      ? 'chevron-up'
                      : 'chevron-down'
                  }
                  size={20}
                  color={COLORS.secondary}
                />
              </TouchableOpacity>

              {expandido && (
                <View style={styles.roleDetails}>
                  <Text style={styles.detailsTitle}>
                    Funciones generales
                  </Text>

                  {rol.funciones.map(
                    (funcion, indice) => (
                      <View
                        key={`${rol.id}-${indice}`}
                        style={styles.permissionRow}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={COLORS.green}
                        />

                        <Text
                          style={styles.permissionText}
                        >
                          {funcion}
                        </Text>
                      </View>
                    )
                  )}

                  <TouchableOpacity
                    style={styles.manageUsersButton}
                    onPress={() => onManageUsers?.(rol.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Administrar usuarios del rol ${rol.nombre}`}
                  >
                    <Ionicons
                      name="people-outline"
                      size={19}
                      color={COLORS.white}
                    />

                    <Text style={styles.manageUsersButtonText}>
                      Administrar usuarios
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={COLORS.white}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={COLORS.primary}
          />

          <Text style={styles.infoText}>
            Esta sección es solo de consulta. Los roles son
            fijos; aquí puedes revisar sus descripciones y
            usuarios, pero no editar permisos.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 55 : 75,
    paddingHorizontal: 22,
    paddingBottom: 32,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(39,196,232,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
  },

  headerSubtitle: {
    color: '#D6E4F2',
    fontSize: 13,
    lineHeight: 21,
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 45,
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 26,
  },

  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  summaryContent: {
    flex: 1,
  },

  summaryNumber: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.primary,
  },

  summaryDescription: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 4,
  },

  sectionHeader: {
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.secondary,
  },

  roleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  roleInfo: {
    flex: 1,
    marginRight: 10,
  },

  roleName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 5,
  },

  roleDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.secondary,
  },

  roleDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: '#FBFCFE',
  },

  detailsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 14,
  },

  permissionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },

  permissionText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.text,
  },

  manageUsersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginTop: 12,
  },

  manageUsersButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: '#EAF1FB',
    padding: 16,
    borderRadius: 15,
    marginTop: 15,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.primary,
  },
});
