import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

// ========================================
// IDENTIDAD VISUAL AULA-AI
// ========================================

const COLORS = {
  navy: '#091D3A',
  blue: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#334155',
  muted: '#718096',
  border: '#DFE7F0',
  pale: '#EAF3FC',
  green: '#15803D',
  greenBackground: '#ECFDF3',
  orange: '#B45309',
  orangeBackground: '#FFF7ED',
  red: '#B91C1C',
  redBackground: '#FEF2F2',
};

const TarjetaResumen = ({
  icono,
  valor,
  titulo,
  color,
  fondo,
}) => (
  <View style={styles.summaryCard}>
    <View
      style={[
        styles.summaryIcon,
        {
          backgroundColor: fondo,
        },
      ]}
    >
      <Ionicons
        name={icono}
        size={22}
        color={color}
      />
    </View>

    <Text style={styles.summaryValue}>
      {valor}
    </Text>

    <Text style={styles.summaryLabel}>
      {titulo}
    </Text>
  </View>
);

const FilaInformacion = ({
  icono,
  etiqueta,
  valor,
}) => (
  <View style={styles.infoRow}>
    <View style={styles.infoRowIcon}>
      <Ionicons
        name={icono}
        size={17}
        color={COLORS.blue}
      />
    </View>

    <Text style={styles.infoLabel}>
      {etiqueta}
    </Text>

    <Text
      style={styles.infoValue}
      numberOfLines={2}
    >
      {valor || '-'}
    </Text>
  </View>
);

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

const AcademicActivitiesScreen = ({
  apiUrl,
  accessToken,
  onBack,
  onRegisterActivity,
  onViewSubmissions,
  onViewResources,
}) => {
  // ========================================
  // ESTADOS
  // ========================================

  const [actividades, setActividades] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  // ========================================
  // CONSULTAR ACTIVIDADES
  // ========================================

  const consultarActividades = useCallback(
    async () => {
      const response = await fetch(
        `${apiUrl}/api/activities/mis-actividades`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'No fue posible consultar las actividades.'
        );
      }

      return data.actividades || [];
    },
    [apiUrl, accessToken]
  );

  // ========================================
  // CARGA INICIAL
  // ========================================

  useEffect(() => {
    let activo = true;

    const cargarActividades = async () => {
      try {
        setCargando(true);

        const resultado =
          await consultarActividades();

        if (activo) {
          setActividades(resultado);
        }
      } catch (error) {
        console.log(
          'Error consultando actividades:',
          error
        );

        if (activo) {
          Alert.alert(
            'Error',
            error.message ||
              'No fue posible consultar las actividades en este momento.'
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarActividades();

    return () => {
      activo = false;
    };
  }, [consultarActividades]);

  // ========================================
  // ACTUALIZAR ACTIVIDADES
  // ========================================

  const actualizarActividades = async () => {
    if (actualizando) {
      return;
    }

    try {
      setActualizando(true);

      const resultado =
        await consultarActividades();

      setActividades(resultado);
    } catch (error) {
      console.log(
        'Error actualizando actividades:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'No fue posible actualizar las actividades.'
      );
    } finally {
      setActualizando(false);
    }
  };

  // ========================================
  // ESTADO SEGÚN FECHA DE ENTREGA
  // ========================================

  const obtenerEstadoFecha = (fechaEntrega) => {
    if (!fechaEntrega) {
      return 'Pendiente';
    }

    const ahora = new Date();

    const entrega = new Date(fechaEntrega);

    if (Number.isNaN(entrega.getTime())) {
      return 'Pendiente';
    }

    if (entrega < ahora) {
      return 'Vencida';
    }

    const diferencia =
      entrega.getTime() - ahora.getTime();

    const dias =
      diferencia / (1000 * 60 * 60 * 24);

    if (dias <= 3) {
      return 'Próxima';
    }

    return 'Pendiente';
  };

  // ========================================
  // FORMATEAR FECHA
  // ========================================

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return 'Sin fecha definida';
    }

    const fechaConvertida = new Date(fecha);

    if (
      Number.isNaN(fechaConvertida.getTime())
    ) {
      return 'Fecha no disponible';
    }

    return fechaConvertida.toLocaleString(
      'es-CO',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  };

  // ========================================
  // ESTILO SEGÚN ESTADO
  // ========================================

  const obtenerConfiguracionEstado = (
    estado
  ) => {
    switch (estado) {
      case 'Vencida':
        return {
          color: COLORS.red,
          background: COLORS.redBackground,
          icon: 'alert-circle-outline',
        };

      case 'Próxima':
        return {
          color: COLORS.orange,
          background: COLORS.orangeBackground,
          icon: 'time-outline',
        };

      default:
        return {
          color: COLORS.green,
          background: COLORS.greenBackground,
          icon: 'checkmark-circle-outline',
        };
    }
  };

  // ========================================
  // ICONO SEGÚN TIPO
  // ========================================

  const obtenerIconoTipo = (tipo) => {
    const tipoNormalizado = String(
      tipo || ''
    ).toLowerCase();

    if (tipoNormalizado.includes('examen')) {
      return 'document-text-outline';
    }

    if (tipoNormalizado.includes('tarea')) {
      return 'clipboard-outline';
    }

    if (
      tipoNormalizado.includes('evaluacion') ||
      tipoNormalizado.includes('evaluación')
    ) {
      return 'reader-outline';
    }

    return 'book-outline';
  };

  // ========================================
  // RESUMEN DE ACTIVIDADES
  // ========================================

  const totalActividades = actividades.length;

  const actividadesProximas =
    actividades.filter(
      (actividad) =>
        obtenerEstadoFecha(
          actividad.fecha_entrega
        ) === 'Próxima'
    ).length;

  const actividadesVencidas =
    actividades.filter(
      (actividad) =>
        obtenerEstadoFecha(
          actividad.fecha_entrega
        ) === 'Vencida'
    ).length;

  // ========================================
  // PANTALLA DE CARGA
  // ========================================

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons
            name="library-outline"
            size={34}
            color={COLORS.blue}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.blue}
        />

        <Text style={styles.loadingTitle}>
          Consultando actividades...
        </Text>

        <Text style={styles.loadingSubtitle}>
          Estamos preparando la información
          académica.
        </Text>
      </View>
    );
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ========================================

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={actualizarActividades}
          colors={[COLORS.blue]}
          tintColor={COLORS.blue}
        />
      }
    >
      {/* ================================== */}
      {/* ENCABEZADO */}
      {/* ================================== */}

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backHeaderButton}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color={COLORS.white}
            />

            <Text style={styles.backHeaderText}>
              Volver
            </Text>
          </TouchableOpacity>

          <View style={styles.headerBadge}>
            <Ionicons
              name="school-outline"
              size={14}
              color={COLORS.cyan}
            />

            <Text style={styles.headerBadgeText}>
              ACADÉMICO
            </Text>
          </View>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="library-outline"
            size={30}
            color={COLORS.white}
          />
        </View>

        <Text style={styles.title}>
          Actividades académicas
        </Text>

        <Text style={styles.headerSubtitle}>
          Gestiona tareas, actividades,
          evaluaciones y exámenes de tus
          estudiantes.
        </Text>
      </View>

      {/* ================================== */}
      {/* RESUMEN */}
      {/* ================================== */}

      <View style={styles.summaryContainer}>
        <TarjetaResumen
          icono="layers-outline"
          valor={totalActividades}
          titulo="Registradas"
          color={COLORS.blue}
          fondo={COLORS.pale}
        />

        <TarjetaResumen
          icono="time-outline"
          valor={actividadesProximas}
          titulo="Próximas"
          color={COLORS.orange}
          fondo={COLORS.orangeBackground}
        />

        <TarjetaResumen
          icono="alert-circle-outline"
          valor={actividadesVencidas}
          titulo="Vencidas"
          color={COLORS.red}
          fondo={COLORS.redBackground}
        />
      </View>

      {/* ================================== */}
      {/* ACCIONES PRINCIPALES */}
      {/* ================================== */}

      <View style={styles.actionsSection}>
        <View style={styles.actionsHeader}>
          <View style={styles.actionsHeaderIcon}>
            <Ionicons
              name="create-outline"
              size={22}
              color={COLORS.blue}
            />
          </View>

          <View style={styles.actionsHeaderText}>
            <Text style={styles.sectionTitle}>
              Gestión de actividades
            </Text>

            <Text style={styles.sectionSubtitle}>
              Registra y consulta tus
              actividades académicas.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={onRegisterActivity}
          activeOpacity={0.85}
        >
          <View style={styles.buttonContent}>
            <Ionicons
              name="add-circle-outline"
              size={22}
              color={COLORS.white}
            />

            <Text
              style={styles.registerButtonText}
            >
              Registrar actividad
            </Text>

            <Ionicons
              name="arrow-forward"
              size={19}
              color={COLORS.white}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* ================================== */}
      {/* LISTADO */}
      {/* ================================== */}

      <View style={styles.listHeader}>
        <View style={styles.listHeaderLeft}>
          <View style={styles.listHeaderIcon}>
            <Ionicons
              name="list-outline"
              size={22}
              color={COLORS.blue}
            />
          </View>

          <View style={styles.listHeaderText}>
            <Text style={styles.sectionTitle}>
              Mis actividades
            </Text>

            <Text style={styles.sectionSubtitle}>
              Actividades registradas
              en el sistema.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={actualizarActividades}
          disabled={actualizando}
          activeOpacity={0.8}
        >
          {actualizando ? (
            <ActivityIndicator
              size="small"
              color={COLORS.blue}
            />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={21}
              color={COLORS.blue}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* ================================== */}
      {/* ESTADO VACÍO */}
      {/* ================================== */}

      {actividades.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="folder-open-outline"
              size={37}
              color={COLORS.blue}
            />
          </View>

          <Text style={styles.emptyTitle}>
            No hay actividades registradas
          </Text>

          <Text style={styles.emptyDescription}>
            Todavía no se han registrado
            actividades académicas.
            Puedes comenzar creando
            una nueva actividad.
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={onRegisterActivity}
            activeOpacity={0.85}
          >
            <Ionicons
              name="add-outline"
              size={20}
              color={COLORS.white}
            />

            <Text style={styles.emptyButtonText}>
              Crear actividad
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        actividades.map((actividad, index) => {
          const asignacion =
            actividad.materia_grupo_periodo;

          const estadoFecha =
            obtenerEstadoFecha(
              actividad.fecha_entrega
            );

          const configuracionEstado =
            obtenerConfiguracionEstado(
              estadoFecha
            );

          return (
            <View
              key={String(actividad.id)}
              style={styles.activityCard}
            >
              {/* ENCABEZADO DE TARJETA */}

              <View style={styles.cardHeader}>
                <View style={styles.cardTypeContainer}>
                  <View style={styles.cardTypeIcon}>
                    <Ionicons
                      name={obtenerIconoTipo(
                        actividad.tipo
                      )}
                      size={21}
                      color={COLORS.blue}
                    />
                  </View>

                  <View style={styles.cardTypeInfo}>
                    <Text style={styles.cardIndex}>
                      ACTIVIDAD {index + 1}
                    </Text>

                    <Text style={styles.activityType}>
                      {actividad.tipo
                        ? String(
                            actividad.tipo
                          ).toUpperCase()
                        : 'ACTIVIDAD'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ESTADO */}

              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        configuracionEstado.background,
                    },
                  ]}
                >
                  <Ionicons
                    name={configuracionEstado.icon}
                    size={16}
                    color={configuracionEstado.color}
                  />

                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          configuracionEstado.color,
                      },
                    ]}
                  >
                    {estadoFecha}
                  </Text>
                </View>
              </View>

              {/* TÍTULO */}

              <Text style={styles.activityTitle}>
                {actividad.titulo ||
                  'Actividad sin título'}
              </Text>

              {/* DESCRIPCIÓN */}

              <Text style={styles.description}>
                {actividad.descripcion ||
                  'Esta actividad no tiene una descripción registrada.'}
              </Text>

              <View style={styles.divider} />

              {/* INFORMACIÓN ACADÉMICA */}

              <Text style={styles.detailsTitle}>
                Información académica
              </Text>

              <View style={styles.detailsContainer}>
                <FilaInformacion
                  icono="book-outline"
                  etiqueta="Materia"
                  valor={
                    asignacion?.materia?.nombre
                  }
                />

                <FilaInformacion
                  icono="school-outline"
                  etiqueta="Grado"
                  valor={
                    asignacion?.grado?.nombre
                  }
                />

                <FilaInformacion
                  icono="people-outline"
                  etiqueta="Grupo"
                  valor={
                    asignacion?.grupo?.nombre
                  }
                />

                <FilaInformacion
                  icono="calendar-outline"
                  etiqueta="Período"
                  valor={
                    asignacion?.periodo?.nombre
                  }
                />
              </View>

              {/* FECHA DE ENTREGA */}

              <View style={styles.deliveryContainer}>
                <View style={styles.deliveryIcon}>
                  <Ionicons
                    name="calendar-number-outline"
                    size={21}
                    color={COLORS.blue}
                  />
                </View>

                <View style={styles.deliveryContent}>
                  <Text style={styles.deliveryLabel}>
                    FECHA DE ENTREGA
                  </Text>

                  <Text style={styles.deliveryDate}>
                    {formatearFecha(
                      actividad.fecha_entrega
                    )}
                  </Text>
                </View>
              </View>

              {/* ACCIONES */}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.resourcesButton}
                  onPress={() =>
                    onViewResources(actividad)
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="folder-open-outline"
                    size={19}
                    color={COLORS.blue}
                  />

                  <Text
                    style={styles.resourcesButtonText}
                  >
                    Archivos y enlaces
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={COLORS.blue}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submissionsButton}
                  onPress={() =>
                    onViewSubmissions(actividad)
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={19}
                    color={COLORS.white}
                  />

                  <Text
                    style={styles.submissionsButtonText}
                  >
                    Ver entregas
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={17}
                    color={COLORS.white}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* ================================== */}
      {/* INFORMACIÓN FINAL */}
      {/* ================================== */}

      <View style={styles.infoCard}>
        <Ionicons
          name="information-circle-outline"
          size={22}
          color={COLORS.blue}
        />

        <Text style={styles.infoText}>
          Consulta los recursos de cada
          actividad y revisa las entregas
          realizadas por tus estudiantes.
          Las fechas permiten identificar
          actividades próximas o vencidas.
        </Text>
      </View>

      {/* ================================== */}
      {/* VOLVER */}
      {/* ================================== */}

      <TouchableOpacity
        style={styles.bottomBackButton}
        onPress={onBack}
        activeOpacity={0.8}
      >
        <Ionicons
          name="arrow-back-outline"
          size={18}
          color={COLORS.blue}
        />

        <Text style={styles.bottomBackText}>
          Volver al panel
        </Text>
      </TouchableOpacity>

      {/* ================================== */}
      {/* PIE DE PÁGINA */}
      {/* ================================== */}

      <View style={styles.footer}>
        <Ionicons
          name="shield-checkmark-outline"
          size={15}
          color="#64748B"
        />

        <Text style={styles.footerText}>
          Gestión académica · AULA-AI
        </Text>
      </View>
    </ScrollView>
  );
};

// ========================================
// ESTILOS PREMIUM
// ========================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    paddingHorizontal: 24,
    paddingBottom: 55,
  },

  // ======================================
  // ENCABEZADO
  // ======================================

  header: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
    marginBottom: 26,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },

  backHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },

  backHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
  },

  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: '#D6E4F2',
  },

  // ======================================
  // RESUMEN
  // ======================================

  summaryContainer: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 25,
  },

  summaryCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.white,
    borderRadius: 17,
    paddingVertical: 15,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: '#E5ECF4',
    elevation: 2,
  },

  summaryIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: 5,
  },

  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
  },

  // ======================================
  // GESTIÓN
  // ======================================

  actionsSection: {
    marginBottom: 27,
  },

  actionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  actionsHeaderIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  actionsHeaderText: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 5,
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },

  registerButton: {
    minHeight: 58,
    backgroundColor: COLORS.blue,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.cyan,
    elevation: 3,
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  registerButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  // ======================================
  // LISTADO
  // ======================================

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
  },

  listHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  listHeaderIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  listHeaderText: {
    flex: 1,
  },

  refreshButton: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // ======================================
  // TARJETAS DE ACTIVIDADES
  // ======================================

  activityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  cardTypeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardTypeIcon: {
    width: 47,
    height: 47,
    borderRadius: 14,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardTypeInfo: {
    flex: 1,
  },

  cardIndex: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
    marginBottom: 5,
  },

  activityType: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.blue,
  },

  statusContainer: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  activityTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: 9,
    lineHeight: 25,
  },

  description: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.text,
    marginBottom: 17,
  },

  divider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginBottom: 17,
  },

  detailsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 13,
  },

  detailsContainer: {
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    padding: 14,
    marginBottom: 17,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },

  infoRowIcon: {
    width: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  infoLabel: {
    width: 63,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },

  infoValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'right',
  },

  // ======================================
  // FECHA DE ENTREGA
  // ======================================

  deliveryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.pale,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },

  deliveryIcon: {
    width: 39,
    height: 39,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  deliveryContent: {
    flex: 1,
  },

  deliveryLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.blue,
    marginBottom: 6,
  },

  deliveryDate: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },

  // ======================================
  // BOTONES DE ACTIVIDADES
  // ======================================

  cardActions: {
    gap: 10,
  },

  resourcesButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 13,
    paddingHorizontal: 12,
  },

  resourcesButtonText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
  },

  submissionsButton: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.blue,
    borderRadius: 13,
    paddingHorizontal: 12,
  },

  submissionsButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  // ======================================
  // ESTADO VACÍO
  // ======================================

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },

  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 23,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 10,
  },

  emptyDescription: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 20,
  },

  emptyButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingHorizontal: 19,
  },

  emptyButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  // ======================================
  // INFORMACIÓN FINAL
  // ======================================

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.pale,
    borderRadius: 15,
    padding: 16,
    marginTop: 5,
    marginBottom: 18,
    gap: 10,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: '#475569',
  },

  // ======================================
  // VOLVER
  // ======================================

  bottomBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    gap: 9,
  },

  bottomBackText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
  },

  // ======================================
  // PIE DE PÁGINA
  // ======================================

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 7,
  },

  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // ======================================
  // PANTALLA DE CARGA
  // ======================================

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 23,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  loadingTitle: {
    marginTop: 18,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
  },

  loadingSubtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default AcademicActivitiesScreen;