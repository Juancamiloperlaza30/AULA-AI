import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
};

export default function AcademicPeriodsScreen({
  apiUrl,
  accessToken,
  onBack,
}) {
  // ========================================
  // ESTADOS ORIGINALES
  // ========================================

  const [periodos, setPeriodos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);
  const [periodoActual, setPeriodoActual] = useState(null);

  // ========================================
  // CONSULTAR PERÍODOS
  // ========================================

  const consultarPeriodos = useCallback(async () => {
    const response = await fetch(
      `${apiUrl}/api/academic/periodos`,
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
          'No fue posible consultar los periodos.'
      );
    }

    return data.periodos || [];
  }, [apiUrl, accessToken]);

  // ========================================
  // RECARGAR PERÍODOS
  // ========================================

  const cargarPeriodos = useCallback(async () => {
    setCargando(true);

    try {
      const periodosCargados =
        await consultarPeriodos();

      setPeriodos(periodosCargados);
    } catch (error) {
      console.log(
        'Error consultando periodos:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'No fue posible consultar los periodos académicos.'
      );
    } finally {
      setCargando(false);
    }
  }, [consultarPeriodos]);

  // ========================================
  // CONSULTAR PERÍODO ACTUAL
  // ========================================

  const consultarPeriodoActual = useCallback(async () => {
    const response = await fetch(
      `${apiUrl}/api/academic/periodo-actual`,
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
          'No fue posible consultar el periodo actual.'
      );
    }

    return data.periodo || null;
  }, [apiUrl, accessToken]);

  // ========================================
  // RECARGAR PERÍODO ACTUAL
  // ========================================

  const cargarPeriodoActual = useCallback(async () => {
    try {
      const periodo =
        await consultarPeriodoActual();

      setPeriodoActual(periodo);
    } catch (error) {
      console.log(
        'Error consultando periodo actual:',
        error
      );
    }
  }, [consultarPeriodoActual]);

  // ========================================
  // CARGA INICIAL
  // ========================================

  useEffect(() => {
    let activo = true;

    const cargarDatos = async () => {
      const [
        resultadoPeriodos,
        resultadoPeriodoActual,
      ] = await Promise.allSettled([
        consultarPeriodos(),
        consultarPeriodoActual(),
      ]);

      if (!activo) {
        return;
      }

      if (
        resultadoPeriodos.status === 'fulfilled'
      ) {
        setPeriodos(resultadoPeriodos.value);
      } else {
        console.log(
          'Error consultando periodos:',
          resultadoPeriodos.reason
        );

        Alert.alert(
          'Error',
          resultadoPeriodos.reason.message ||
            'No fue posible consultar los periodos académicos.'
        );
      }

      if (
        resultadoPeriodoActual.status === 'fulfilled'
      ) {
        setPeriodoActual(
          resultadoPeriodoActual.value
        );
      } else {
        console.log(
          'Error consultando periodo actual:',
          resultadoPeriodoActual.reason
        );
      }

      setCargando(false);
    };

    cargarDatos();

    return () => {
      activo = false;
    };
  }, [
    consultarPeriodos,
    consultarPeriodoActual,
  ]);

  // ========================================
  // ACTUALIZAR CAMPOS LOCALMENTE
  // ========================================

  const actualizarCampo = (
    periodoId,
    campo,
    valor
  ) => {
    setPeriodos((anteriores) =>
      anteriores.map((periodo) =>
        periodo.id === periodoId
          ? {
              ...periodo,
              [campo]: valor,
            }
          : periodo
      )
    );
  };

  // ========================================
  // GUARDAR PERÍODO
  // ========================================

  const guardarPeriodo = async (periodo) => {
    try {
      if (
        !periodo.fecha_inicio ||
        !periodo.fecha_fin
      ) {
        Alert.alert(
          'Fechas requeridas',
          'Debe ingresar la fecha de inicio y la fecha de finalización.'
        );

        return;
      }

      setGuardandoId(periodo.id);

      const response = await fetch(
        `${apiUrl}/api/academic/periodos/${periodo.id}`,
        {
          method: 'PUT',

          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            fechaInicio: periodo.fecha_inicio,
            fechaFin: periodo.fecha_fin,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'No fue posible actualizar el periodo.'
        );
      }

      Alert.alert(
        'Periodo actualizado',
        data.message ||
          'Periodo académico actualizado correctamente.'
      );

      setCargando(true);

      await cargarPeriodos();
      await cargarPeriodoActual();
    } catch (error) {
      console.log(
        'Error actualizando periodo:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'No fue posible actualizar el periodo académico.'
      );
    } finally {
      setGuardandoId(null);
    }
  };

  // ========================================
  // DATOS PARA LA INTERFAZ
  // ========================================

  const cantidadPeriodos = periodos.length;

  const cantidadConfigurados = periodos.filter(
    (periodo) => periodo.activo
  ).length;

  // ========================================
  // PANTALLA DE CARGA
  // ========================================

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons
            name="calendar-outline"
            size={34}
            color={COLORS.blue}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.blue}
        />

        <Text style={styles.loadingTitle}>
          Consultando períodos...
        </Text>

        <Text style={styles.loadingSubtitle}>
          Estamos preparando la información académica.
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
      keyboardShouldPersistTaps="handled"
    >
      {/* ENCABEZADO */}

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color={COLORS.white}
            />

            <Text style={styles.backText}>
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
            name="calendar-outline"
            size={30}
            color={COLORS.white}
          />
        </View>

        <Text style={styles.title}>
          Períodos académicos
        </Text>

        <Text style={styles.headerSubtitle}>
          Administra las fechas de inicio y finalización
          de los períodos académicos de la institución.
        </Text>
      </View>

      {/* RESUMEN */}

      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="calendar-number-outline"
              size={23}
              color={COLORS.blue}
            />
          </View>

          <Text style={styles.summaryValue}>
            {cantidadPeriodos}
          </Text>

          <Text style={styles.summaryLabel}>
            Períodos registrados
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="checkmark-done-outline"
              size={23}
              color={COLORS.green}
            />
          </View>

          <Text style={styles.summaryValue}>
            {cantidadConfigurados}
          </Text>

          <Text style={styles.summaryLabel}>
            Períodos activos
          </Text>
        </View>
      </View>

      {/* PERÍODO ACTUAL */}

      <View style={styles.currentSection}>
        <View style={styles.currentSectionIcon}>
          <Ionicons
            name="time-outline"
            size={22}
            color={COLORS.cyan}
          />
        </View>

        <View style={styles.currentSectionContent}>
          <Text style={styles.currentSectionLabel}>
            PERÍODO ACADÉMICO ACTUAL
          </Text>

          <Text style={styles.currentSectionTitle}>
            {periodoActual?.nombre ||
              'Sin período actual definido'}
          </Text>

          <Text style={styles.currentSectionSubtitle}>
            Información obtenida del sistema académico.
          </Text>
        </View>
      </View>

      {/* TÍTULO DEL LISTADO */}

      <View style={styles.listHeader}>
        <View style={styles.listHeaderIcon}>
          <Ionicons
            name="list-outline"
            size={22}
            color={COLORS.blue}
          />
        </View>

        <View style={styles.listHeaderContent}>
          <Text style={styles.listTitle}>
            Configuración de períodos
          </Text>

          <Text style={styles.listSubtitle}>
            Actualiza las fechas de cada período.
          </Text>
        </View>
      </View>

      {/* LISTADO */}

      {periodos.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="calendar-clear-outline"
            size={38}
            color="#94A3B8"
          />

          <Text style={styles.emptyTitle}>
            No hay períodos disponibles
          </Text>

          <Text style={styles.emptyDescription}>
            Actualmente no se encontraron períodos
            académicos para configurar.
          </Text>
        </View>
      ) : (
        periodos.map((periodo, index) => {
          const esActual =
            periodoActual?.id === periodo.id;

          const estaGuardando =
            guardandoId === periodo.id;

          return (
            <View
              key={periodo.id}
              style={styles.periodCard}
            >
              {/* ENCABEZADO DE TARJETA */}

              <View style={styles.periodHeader}>
                <View style={styles.periodIcon}>
                  <Ionicons
                    name="calendar"
                    size={22}
                    color={COLORS.blue}
                  />
                </View>

                <View style={styles.periodInfo}>
                  <Text style={styles.periodIndex}>
                    PERÍODO {index + 1}
                  </Text>

                  <Text style={styles.periodName}>
                    {periodo.nombre}
                  </Text>
                </View>
              </View>

              {/* ESTADO */}

              <View style={styles.statusContainer}>
                {esActual ? (
                  <View style={styles.currentBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={COLORS.green}
                    />

                    <Text style={styles.currentBadgeText}>
                      PERÍODO ACTUAL
                    </Text>
                  </View>
                ) : periodo.activo ? (
                  <View style={styles.activeBadge}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={COLORS.green}
                    />

                    <Text style={styles.activeBadgeText}>
                      Configurado
                    </Text>
                  </View>
                ) : (
                  <View style={styles.inactiveBadge}>
                    <Ionicons
                      name="pause-circle-outline"
                      size={16}
                      color={COLORS.orange}
                    />

                    <Text style={styles.inactiveBadgeText}>
                      Inactivo
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              {/* FECHA DE INICIO */}

              <Text style={styles.fieldLabel}>
                Fecha de inicio
                <Text style={styles.required}> *</Text>
              </Text>

              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={COLORS.blue}
                  />
                </View>

                <TextInput
                  style={styles.dateInput}
                  value={periodo.fecha_inicio || ''}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  onChangeText={(valor) =>
                    actualizarCampo(
                      periodo.id,
                      'fecha_inicio',
                      valor
                    )
                  }
                />
              </View>

              <Text style={styles.fieldHint}>
                Formato: año-mes-día
              </Text>

              {/* FECHA DE FINALIZACIÓN */}

              <Text style={styles.fieldLabel}>
                Fecha de finalización
                <Text style={styles.required}> *</Text>
              </Text>

              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={COLORS.blue}
                  />
                </View>

                <TextInput
                  style={styles.dateInput}
                  value={periodo.fecha_fin || ''}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  onChangeText={(valor) =>
                    actualizarCampo(
                      periodo.id,
                      'fecha_fin',
                      valor
                    )
                  }
                />
              </View>

              <Text style={styles.fieldHint}>
                Formato: año-mes-día
              </Text>

              {/* BOTÓN GUARDAR */}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  estaGuardando &&
                    styles.disabledButton,
                ]}
                disabled={estaGuardando}
                onPress={() =>
                  guardarPeriodo(periodo)
                }
                activeOpacity={0.85}
              >
                {estaGuardando ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.white}
                    />

                    <Text style={styles.saveText}>
                      Guardando...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons
                      name="save-outline"
                      size={20}
                      color={COLORS.white}
                    />

                    <Text style={styles.saveText}>
                      Guardar cambios
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={COLORS.white}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* INFORMACIÓN FINAL */}

      <View style={styles.infoCard}>
        <Ionicons
          name="information-circle-outline"
          size={22}
          color={COLORS.blue}
        />

        <Text style={styles.infoText}>
          Las fechas configuradas se utilizan
          para organizar los períodos académicos.
          Verifica la información antes de guardar.
        </Text>
      </View>

      {/* BOTÓN VOLVER */}

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

      {/* PIE DE PÁGINA */}

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
}

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

  // ENCABEZADO

  header: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 34,
    marginBottom: 24,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },

  backText: {
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

  // RESUMEN

  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5ECF4',
    elevation: 2,
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  summaryValue: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: 6,
  },

  summaryLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.muted,
  },

  // PERÍODO ACTUAL

  currentSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.blue,
    borderRadius: 18,
    padding: 18,
    marginBottom: 28,
  },

  currentSectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  currentSectionContent: {
    flex: 1,
  },

  currentSectionLabel: {
    color: COLORS.cyan,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 7,
  },

  currentSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 6,
  },

  currentSectionSubtitle: {
    fontSize: 11,
    lineHeight: 17,
    color: '#D6E4F2',
  },

  // LISTADO

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
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

  listHeaderContent: {
    flex: 1,
  },

  listTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 5,
  },

  listSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
  },

  // TARJETAS DE PERÍODOS

  periodCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5ECF4',
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  periodIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  periodInfo: {
    flex: 1,
  },

  periodIndex: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
    marginBottom: 5,
  },

  periodName: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.navy,
  },

  statusContainer: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.greenBackground,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  currentBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.green,
  },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.greenBackground,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.green,
  },

  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.orangeBackground,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.orange,
  },

  divider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginBottom: 17,
  },

  // CAMPOS DE FECHAS

  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 9,
    marginTop: 9,
  },

  required: {
    color: '#E11D48',
    fontWeight: '900',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 13,
  },

  inputIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },

  dateInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.navy,
    paddingVertical: 13,
  },

  fieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 7,
    marginBottom: 12,
  },

  // GUARDAR

  saveButton: {
    minHeight: 55,
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 17,
    paddingHorizontal: 12,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  saveText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  // ESTADO VACÍO

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    marginTop: 15,
    marginBottom: 9,
    textAlign: 'center',
  },

  emptyDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
    textAlign: 'center',
  },

  // INFORMACIÓN

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EAF3FC',
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

  // VOLVER

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

  // PIE DE PÁGINA

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

  // CARGA

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