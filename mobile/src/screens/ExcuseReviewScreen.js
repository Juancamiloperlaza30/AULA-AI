import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert as NativeAlert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import GuardianSupportViewer
  from '../components/GuardianSupportViewer';

// ======================================================
// AULA-AI | REVISIÓN DE EXCUSAS
// HU-09 | DISEÑO PREMIUM
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
  green: '#21845B',
  red: '#B3261E',
  amber: '#986515',
};

// ======================================================
// ALERTAS COMPATIBLES CON ANDROID Y WEB
// ======================================================

function mostrarAlerta(titulo, mensaje, botones) {
  if (Platform.OS !== 'web') {
    NativeAlert.alert(titulo, mensaje, botones);
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  const accionConfirmar = botones?.find(
    (boton) =>
      boton.style !== 'cancel' &&
      typeof boton.onPress === 'function'
  );

  if (accionConfirmar) {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) {
      accionConfirmar.onPress();
    }

    return;
  }

  window.alert(`${titulo}\n\n${mensaje}`);
}

const Alert = {
  alert: mostrarAlerta,
};

// ======================================================
// ESTADOS DE EXCUSAS
// ======================================================

const ESTADOS = {
  pendiente_revision: 'Pendiente de revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  requiere_correccion: 'Requiere corrección',
};

function obtenerEstado(estado) {
  return ESTADOS[estado] || estado || 'Sin estado';
}

function obtenerEstiloEstado(estado) {
  switch (estado) {
    case 'aprobada':
      return {
        background: '#EAF7EF',
        text: COLORS.green,
        icon: 'checkmark-circle-outline',
      };

    case 'rechazada':
      return {
        background: '#FDECEB',
        text: COLORS.red,
        icon: 'close-circle-outline',
      };

    case 'pendiente_revision':
      return {
        background: '#FFF4DC',
        text: COLORS.amber,
        icon: 'time-outline',
      };

    case 'requiere_correccion':
      return {
        background: '#EAF3FC',
        text: COLORS.blue,
        icon: 'create-outline',
      };

    default:
      return {
        background: '#F0F3F7',
        text: COLORS.muted,
        icon: 'information-circle-outline',
      };
  }
}

function formatearFecha(valor) {
  if (!valor) return 'Sin registrar';

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'Fecha no disponible';
  }

  return fecha.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ======================================================
// COMPONENTES VISUALES
// ======================================================

function EstadoExcusa({ estado }) {
  const apariencia = obtenerEstiloEstado(estado);

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: apariencia.background },
      ]}
    >
      <Ionicons
        name={apariencia.icon}
        size={15}
        color={apariencia.text}
      />

      <Text
        style={[
          styles.statusText,
          { color: apariencia.text },
        ]}
      >
        {obtenerEstado(estado)}
      </Text>
    </View>
  );
}

function EncabezadoSeccion({
  icon,
  title,
  description,
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={COLORS.blue}
        />
      </View>

      <View style={styles.sectionHeadingContent}>
        <Text style={styles.sectionTitle}>
          {title}
        </Text>

        {description ? (
          <Text style={styles.sectionDescription}>
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DatoDetalle({
  icon,
  label,
  value,
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons
          name={icon}
          size={18}
          color={COLORS.blue}
        />
      </View>

      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>
          {label}
        </Text>

        <Text style={styles.detailValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function ExcuseReviewScreen({
  apiUrl,
  accessToken,
  usuarioId,
  onBack,
}) {
  // ====================================================
  // ESTADOS ORIGINALES
  // ====================================================

  const [excusas, setExcusas] = useState([]);

  const [
    excusaSeleccionada,
    setExcusaSeleccionada,
  ] = useState(null);

  const [cargando, setCargando] = useState(true);

  const [
    actualizando,
    setActualizando,
  ] = useState(false);

  const [
    cargandoDetalle,
    setCargandoDetalle,
  ] = useState(false);

  const [error, setError] = useState('');

  const [
    procesando,
    setProcesando,
  ] = useState(false);

  const [
    observacion,
    setObservacion,
  ] = useState('');

  const [soportes, setSoportes] = useState([]);

  const [
    cargandoSoportes,
    setCargandoSoportes,
  ] = useState(false);

  const [
    errorSoportes,
    setErrorSoportes,
  ] = useState('');

  const [
    soporteSeleccionado,
    setSoporteSeleccionado,
  ] = useState(null);

  // ====================================================
  // PERMISOS ORIGINALES
  // ====================================================

  const esResponsableAsignado = Boolean(
    usuarioId &&
    excusaSeleccionada?.revision_asignada_a &&
    String(excusaSeleccionada.revision_asignada_a) ===
      String(usuarioId)
  );

  const estaPendiente =
    excusaSeleccionada?.estado ===
    'pendiente_revision';

  // ====================================================
  // CONSULTAS AL BACKEND
  // ====================================================

  const solicitar = useCallback(
    async (ruta) => {
      if (!apiUrl || !accessToken) {
        throw new Error(
          'No hay una sesión activa para consultar excusas.'
        );
      }

      const respuesta = await fetch(
        `${apiUrl}${ruta}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
          datos.message ||
          'No fue posible completar la consulta.'
        );
      }

      return datos;
    },
    [apiUrl, accessToken]
  );

  // ====================================================
  // CARGAR LISTADO
  // ====================================================

  const cargarExcusas = useCallback(
    async (esActualizacion = false) => {
      try {
        setError('');

        if (esActualizacion) {
          setActualizando(true);
        } else {
          setCargando(true);
        }

        const datos = await solicitar(
          '/api/excuse-review'
        );

        setExcusas(
          Array.isArray(datos.excusas)
            ? datos.excusas
            : []
        );
      } catch (errorConsulta) {
        setError(errorConsulta.message);
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [solicitar]
  );

  useEffect(() => {
    const solicitudInicial = setTimeout(() => {
      void cargarExcusas();
    }, 0);

    return () => clearTimeout(solicitudInicial);
  }, [cargarExcusas]);

  // ====================================================
  // CARGAR SOPORTES
  // ====================================================

  const cargarSoportes = async (excusaId) => {
    try {
      setCargandoSoportes(true);
      setErrorSoportes('');
      setSoportes([]);

      const datos = await solicitar(
        `/api/excuse-review/${excusaId}/soportes`
      );

      setSoportes(
        Array.isArray(datos.soportes)
          ? datos.soportes
          : []
      );
    } catch (errorConsulta) {
      setErrorSoportes(errorConsulta.message);
    } finally {
      setCargandoSoportes(false);
    }
  };

  // ====================================================
  // ABRIR DETALLE
  // ====================================================

  const abrirDetalle = async (excusaId) => {
    try {
      setCargandoDetalle(true);
      setObservacion('');

      const datos = await solicitar(
        `/api/excuse-review/${excusaId}`
      );

      setExcusaSeleccionada(datos.excusa);
      setObservacion('');

      await cargarSoportes(excusaId);
    } catch (errorConsulta) {
      Alert.alert(
        'No fue posible abrir la excusa',
        errorConsulta.message
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ====================================================
  // ENVIAR ACCIONES
  // ====================================================

  const enviarAccion = async (
    excusaId,
    accion,
    cuerpo
  ) => {
    if (!apiUrl || !accessToken) {
      throw new Error('No hay una sesión activa.');
    }

    const respuesta = await fetch(
      `${apiUrl}/api/excuse-review/${excusaId}/${accion}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cuerpo || {}),
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        datos.mensaje ||
        datos.message ||
        'No fue posible completar la operación.'
      );
    }

    return datos;
  };

  // ====================================================
  // ASUMIR REVISIÓN
  // ====================================================

  const asumirRevision = async () => {
    if (!excusaSeleccionada || procesando) return;

    if (
      !estaPendiente ||
      excusaSeleccionada.revision_asignada_a
    ) {
      Alert.alert(
        'Acción no permitida',
        'Solo puedes asumir una excusa pendiente que no tenga responsable asignado.'
      );
      return;
    }

    try {
      setProcesando(true);

      await enviarAccion(
        excusaSeleccionada.id,
        'asumir'
      );

      const detalle = await solicitar(
        `/api/excuse-review/${excusaSeleccionada.id}`
      );

      setExcusaSeleccionada(detalle.excusa);

      Alert.alert(
        'Revisión asignada',
        'Has asumido correctamente esta solicitud.'
      );
    } catch (errorAccion) {
      Alert.alert(
        'No fue posible asumir',
        errorAccion.message
      );
    } finally {
      setProcesando(false);
    }
  };

  // ====================================================
  // REGISTRAR DECISIÓN
  // ====================================================

  const registrarDecision = async (decision) => {
    if (!excusaSeleccionada || procesando) return;

    const mostrarMensaje = (titulo, mensaje) => {
      if (Platform.OS === 'web') {
        window.alert(`${titulo}\n\n${mensaje}`);
      } else {
        Alert.alert(titulo, mensaje);
      }
    };

    if (!esResponsableAsignado || !estaPendiente) {
      mostrarMensaje(
        'Acción no permitida',
        'Debes tener asignada una excusa pendiente para registrar una decisión.'
      );
      return;
    }

    if (!observacion.trim()) {
      mostrarMensaje(
        'Observación obligatoria',
        'Escribe una observación antes de registrar la decisión.'
      );
      return;
    }

    if (observacion.length > 2000) {
      mostrarMensaje(
        'Observación demasiado extensa',
        'La observación no puede superar los 2000 caracteres.'
      );
      return;
    }

    const titulo =
      decision === 'aprobada'
        ? 'Confirmar aprobación'
        : 'Confirmar rechazo';

    const mensaje =
      'Esta decisión quedará registrada en el historial de la excusa.';

    const ejecutarDecision = async () => {
      try {
        setProcesando(true);

        await enviarAccion(
          excusaSeleccionada.id,
          'resolver',
          {
            decision,
            observacion: observacion.trim(),
          }
        );

        const detalle = await solicitar(
          `/api/excuse-review/${excusaSeleccionada.id}`
        );

        setExcusaSeleccionada(detalle.excusa);
        setObservacion('');

        mostrarMensaje(
          'Decisión registrada',
          decision === 'aprobada'
            ? 'La excusa fue aprobada correctamente.'
            : 'La excusa fue rechazada correctamente.'
        );
      } catch (errorAccion) {
        console.error(
          '[AULA-AI HU-09] Error registrando decisión:',
          errorAccion
        );

        mostrarMensaje(
          'No fue posible registrar la decisión',
          errorAccion.message
        );
      } finally {
        setProcesando(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmado = window.confirm(
        `${titulo}\n\n${mensaje}`
      );

      if (confirmado) {
        await ejecutarDecision();
      }

      return;
    }

    Alert.alert(
      titulo,
      mensaje,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: () => {
            void ejecutarDecision();
          },
        },
      ]
    );
  };

  // ====================================================
  // VOLVER
  // ====================================================

  const volver = () => {
    if (excusaSeleccionada) {
      setExcusaSeleccionada(null);
      setObservacion('');
      void cargarExcusas(true);
      return;
    }

    onBack?.();
  };

  // ====================================================
  // CONTADORES
  // ====================================================

  const pendientes = excusas.filter(
    (excusa) =>
      excusa.estado === 'pendiente_revision'
  ).length;

  const aprobadas = excusas.filter(
    (excusa) => excusa.estado === 'aprobada'
  ).length;

  const rechazadas = excusas.filter(
    (excusa) => excusa.estado === 'rechazada'
  ).length;

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <View style={styles.container}>
      {/* ENCABEZADO PREMIUM */}

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={volver}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={COLORS.white}
            />

            <Text style={styles.backText}>
              Volver
            </Text>
          </TouchableOpacity>

          <View style={styles.brandBadge}>
            <Ionicons
              name="school-outline"
              size={15}
              color={COLORS.cyan}
            />

            <Text style={styles.brandText}>
              AULA-AI
            </Text>
          </View>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons
            name="document-text-outline"
            size={29}
            color={COLORS.white}
          />
        </View>

        <Text style={styles.title}>
          {excusaSeleccionada
            ? 'Detalle de excusa'
            : 'Revisión de excusas'}
        </Text>

        <Text style={styles.subtitle}>
          {excusaSeleccionada
            ? 'Consulta los documentos y gestiona la solicitud según tus permisos.'
            : 'Consulta, revisa y realiza seguimiento a las solicitudes académicas.'}
        </Text>
      </View>

      {/* CARGA DE DETALLE */}

      {cargandoDetalle && (
        <View style={styles.loadingRow}>
          <ActivityIndicator
            color={COLORS.blue}
          />

          <Text style={styles.loadingText}>
            Consultando solicitud...
          </Text>
        </View>
      )}

      {/* ================================================
          DETALLE DE EXCUSA
      ================================================ */}

      {excusaSeleccionada ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* INFORMACIÓN DE LA SOLICITUD */}

          <View style={styles.card}>
            <EncabezadoSeccion
              icon="document-text-outline"
              title={`Excusa #${excusaSeleccionada.id}`}
              description="Información de la solicitud"
            />

            <View style={styles.statusContainer}>
              <EstadoExcusa
                estado={excusaSeleccionada.estado}
              />
            </View>

            <View style={styles.divider} />

            <DatoDetalle
              icon="calendar-outline"
              label="Fecha de solicitud"
              value={formatearFecha(
                excusaSeleccionada.created_at
              )}
            />

            <View style={styles.detailBlock}>
              <Text style={styles.label}>
                Motivo presentado
              </Text>

              <View style={styles.motivoBox}>
                <Text style={styles.motivo}>
                  {excusaSeleccionada.motivo}
                </Text>
              </View>
            </View>

            <DatoDetalle
              icon="shield-checkmark-outline"
              label="Seguimiento institucional"
              value={
                excusaSeleccionada.revision_asignada_a
                  ? 'En revisión por un responsable'
                  : excusaSeleccionada.vista_at
                    ? 'Vista por la institución'
                    : 'Sin revisar'
              }
            />

            {excusaSeleccionada.observacion_revision
              ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.label}>
                    Observación de revisión
                  </Text>

                  <View style={styles.observationBox}>
                    <Text style={styles.value}>
                      {
                        excusaSeleccionada
                          .observacion_revision
                      }
                    </Text>
                  </View>
                </View>
              )
              : null}
          </View>

          {/* SOPORTES */}

          <View style={styles.card}>
            <EncabezadoSeccion
              icon="attach-outline"
              title="Documentos de soporte"
              description="Archivos adjuntos a la solicitud"
            />

            <Text style={styles.supportDescription}>
              Revisa los archivos enviados por el
              acudiente antes de registrar una decisión.
            </Text>

            {cargandoSoportes ? (
              <View style={styles.supportLoading}>
                <ActivityIndicator
                  color={COLORS.blue}
                />

                <Text style={styles.loadingText}>
                  Consultando soportes...
                </Text>
              </View>
            ) : errorSoportes ? (
              <View style={styles.supportError}>
                <Text style={styles.errorText}>
                  {errorSoportes}
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    cargarSoportes(
                      excusaSeleccionada.id
                    )
                  }
                >
                  <Ionicons
                    name="refresh-outline"
                    size={19}
                    color={COLORS.white}
                  />

                  <Text style={styles.buttonText}>
                    Reintentar
                  </Text>
                </TouchableOpacity>
              </View>
            ) : soportes.length === 0 ? (
              <View style={styles.emptySupport}>
                <Ionicons
                  name="folder-open-outline"
                  size={29}
                  color={COLORS.muted}
                />

                <Text style={styles.emptySupportText}>
                  No hay documentos adjuntos a esta excusa.
                </Text>
              </View>
            ) : (
              soportes.map((soporte) => {
                const esPdf =
                  soporte.tipo_mime ===
                  'application/pdf';

                return (
                  <TouchableOpacity
                    key={String(soporte.id)}
                    style={styles.supportItem}
                    onPress={() =>
                      setSoporteSeleccionado(soporte)
                    }
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <View style={styles.supportIcon}>
                      <Ionicons
                        name={
                          esPdf
                            ? 'document-outline'
                            : 'image-outline'
                        }
                        size={23}
                        color={COLORS.blue}
                      />
                    </View>

                    <View style={styles.supportContent}>
                      <Text
                        style={styles.supportName}
                        numberOfLines={2}
                      >
                        {soporte.nombre_archivo ||
                          `Soporte #${soporte.id}`}
                      </Text>

                      <Text style={styles.supportLink}>
                        Ver documento
                      </Text>
                    </View>

                    <Ionicons
                      name="open-outline"
                      size={19}
                      color={COLORS.blue}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* GESTIÓN DE LA SOLICITUD */}

          {estaPendiente && (
            <View style={styles.card}>
              <EncabezadoSeccion
                icon="checkmark-done-outline"
                title="Gestión de la solicitud"
                description="Acciones disponibles según la asignación"
              />

              {!excusaSeleccionada.revision_asignada_a ? (
                <>
                  <View style={styles.infoNotice}>
                    <Ionicons
                      name="information-circle-outline"
                      size={21}
                      color={COLORS.blue}
                    />

                    <Text style={styles.infoNoticeText}>
                      Esta excusa todavía no tiene un
                      responsable asignado. Puedes asumir
                      su revisión.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      procesando &&
                        styles.disabledButton,
                    ]}
                    onPress={asumirRevision}
                    disabled={procesando}
                    activeOpacity={0.85}
                  >
                    {procesando ? (
                      <ActivityIndicator
                        color={COLORS.white}
                      />
                    ) : (
                      <Ionicons
                        name="person-add-outline"
                        size={20}
                        color={COLORS.white}
                      />
                    )}

                    <Text style={styles.buttonText}>
                      {procesando
                        ? 'Procesando...'
                        : 'Asumir revisión'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : esResponsableAsignado ? (
                <>
                  <View style={styles.assignedNotice}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={COLORS.green}
                    />

                    <Text style={styles.assignedText}>
                      Esta solicitud está asignada a tu
                      usuario. Puedes registrar una decisión.
                    </Text>
                  </View>

                  <Text style={styles.label}>
                    Observación institucional
                  </Text>

                  <Text style={styles.inputHelp}>
                    Explica el motivo de la aprobación
                    o del rechazo.
                  </Text>

                  <TextInput
                    style={styles.observationInput}
                    placeholder="Escribe la justificación de tu decisión..."
                    placeholderTextColor="#8291A3"
                    multiline
                    maxLength={2000}
                    value={observacion}
                    onChangeText={setObservacion}
                    editable={!procesando}
                  />

                  <Text style={styles.characterCount}>
                    {observacion.length}/2000 caracteres
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      styles.approveButton,
                      procesando &&
                        styles.disabledButton,
                    ]}
                    disabled={procesando}
                    onPress={() =>
                      registrarDecision('aprobada')
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={21}
                      color={COLORS.white}
                    />

                    <Text style={styles.buttonText}>
                      Aprobar excusa
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      styles.rejectButton,
                      procesando &&
                        styles.disabledButton,
                    ]}
                    disabled={procesando}
                    onPress={() =>
                      registrarDecision('rechazada')
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={21}
                      color={COLORS.white}
                    />

                    <Text style={styles.buttonText}>
                      Rechazar excusa
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.infoNotice}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={21}
                    color={COLORS.blue}
                  />

                  <Text style={styles.infoNoticeText}>
                    Esta solicitud ya fue asumida por
                    otro responsable. Puedes consultar
                    su información, pero no registrar
                    una decisión.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* AVISO INSTITUCIONAL */}

          <View style={styles.notice}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={COLORS.blue}
            />

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Revisión institucional
              </Text>

              <Text style={styles.noticeText}>
                Solo puedes registrar una decisión si
                tienes asignada esta excusa y continúa
                pendiente de revisión.
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* ==============================================
           LISTADO DE EXCUSAS
        ============================================== */

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={actualizando}
              onRefresh={() =>
                cargarExcusas(true)
              }
              colors={[COLORS.blue]}
              tintColor={COLORS.blue}
            />
          }
        >
          {/* RESUMEN */}

          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIcon}>
                <Ionicons
                  name="documents-outline"
                  size={22}
                  color={COLORS.blue}
                />
              </View>

              <Text style={styles.summaryNumber}>
                {excusas.length}
              </Text>

              <Text style={styles.summaryLabel}>
                Solicitudes
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <View style={styles.summaryIcon}>
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={COLORS.amber}
                />
              </View>

              <Text style={styles.summaryNumber}>
                {pendientes}
              </Text>

              <Text style={styles.summaryLabel}>
                Pendientes
              </Text>
            </View>
          </View>

          <View style={styles.secondarySummary}>
            <View style={styles.secondarySummaryItem}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={COLORS.green}
              />

              <Text style={styles.secondarySummaryText}>
                {aprobadas} aprobadas
              </Text>
            </View>

            <View style={styles.secondarySummaryDivider} />

            <View style={styles.secondarySummaryItem}>
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={COLORS.red}
              />

              <Text style={styles.secondarySummaryText}>
                {rechazadas} rechazadas
              </Text>
            </View>
          </View>

          {/* TÍTULO DEL LISTADO */}

          <View style={styles.listHeading}>
            <View>
              <Text style={styles.listTitle}>
                Solicitudes académicas
              </Text>

              <Text style={styles.listSubtitle}>
                Consulta las excusas disponibles
              </Text>
            </View>

            <View style={styles.listIcon}>
              <Ionicons
                name="list-outline"
                size={22}
                color={COLORS.blue}
              />
            </View>
          </View>

          {/* CONTENIDO */}

          {cargando ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator
                size="large"
                color={COLORS.blue}
              />

              <Text style={styles.loadingText}>
                Cargando solicitudes...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.card}>
              <View style={styles.errorHeading}>
                <Ionicons
                  name="alert-circle-outline"
                  size={25}
                  color={COLORS.red}
                />

                <Text style={styles.errorTitle}>
                  No fue posible consultar las excusas
                </Text>
              </View>

              <Text style={styles.errorText}>
                {error}
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => cargarExcusas()}
              >
                <Ionicons
                  name="refresh-outline"
                  size={19}
                  color={COLORS.white}
                />

                <Text style={styles.buttonText}>
                  Reintentar
                </Text>
              </TouchableOpacity>
            </View>
          ) : excusas.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="folder-open-outline"
                  size={35}
                  color={COLORS.blue}
                />
              </View>

              <Text style={styles.emptyTitle}>
                No hay excusas para revisar
              </Text>

              <Text style={styles.emptyText}>
                Cuando existan solicitudes autorizadas,
                aparecerán aquí.
              </Text>
            </View>
          ) : (
            excusas.map((excusa) => (
              <TouchableOpacity
                key={String(excusa.id)}
                style={styles.card}
                onPress={() =>
                  abrirDetalle(excusa.id)
                }
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  `Ver detalle de excusa ${excusa.id}`
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.excuseIcon}>
                    <Ionicons
                      name="document-text-outline"
                      size={23}
                      color={COLORS.blue}
                    />
                  </View>

                  <View style={styles.cardTitleContent}>
                    <Text style={styles.cardTitle}>
                      Excusa #{excusa.id}
                    </Text>

                    <EstadoExcusa
                      estado={excusa.estado}
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.previewLabel}>
                  Motivo presentado
                </Text>

                <Text
                  style={styles.motivoPreview}
                  numberOfLines={3}
                >
                  {excusa.motivo}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={COLORS.muted}
                    />

                    <Text style={styles.date}>
                      {formatearFecha(
                        excusa.created_at
                      )}
                    </Text>
                  </View>

                  <View style={styles.openLinkRow}>
                    <Text style={styles.openLink}>
                      Ver detalle
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={17}
                      color={COLORS.blue}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

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
      )}

      {/* VISOR ORIGINAL DE SOPORTES */}

      <GuardianSupportViewer
        visible={Boolean(soporteSeleccionado)}
        onClose={() =>
          setSoporteSeleccionado(null)
        }
        apiUrl={apiUrl}
        accessToken={accessToken}
        excusaId={excusaSeleccionada?.id}
        soporteId={soporteSeleccionado?.id}
        modo="revision"
      />
    </View>
  );
}

// ======================================================
// ESTILOS PREMIUM
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 31,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 23,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },

  backText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },

  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  brandText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 7,
  },

  heroIcon: {
    width: 59,
    height: 59,
    borderRadius: 18,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  title: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '900',
  },

  subtitle: {
    color: '#D7E5F3',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 9,
  },

  content: {
    paddingHorizontal: 19,
    paddingTop: 21,
    paddingBottom: 55,
  },

  // RESUMEN

  summary: {
    flexDirection: 'row',
    marginBottom: 13,
  },

  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 17,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  summaryNumber: {
    fontSize: 29,
    fontWeight: '900',
    color: COLORS.blue,
  },

  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    marginTop: 4,
  },

  secondarySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 26,
  },

  secondarySummaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondarySummaryDivider: {
    height: 25,
    width: 1,
    backgroundColor: COLORS.border,
  },

  secondarySummaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: 7,
  },

  // ENCABEZADOS

  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
  },

  listTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.navy,
  },

  listSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 5,
  },

  listIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },

  sectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  sectionHeadingContent: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.navy,
  },

  sectionDescription: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
    lineHeight: 17,
  },

  // TARJETAS

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 19,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  excuseIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardTitleContent: {
    flex: 1,
    alignItems: 'flex-start',
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: 9,
  },

  statusContainer: {
    alignItems: 'flex-start',
    marginBottom: 5,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
  },

  divider: {
    height: 1,
    backgroundColor: '#E9EFF5',
    marginVertical: 17,
  },

  previewLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
    marginBottom: 7,
  },

  motivoPreview: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 18,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  date: {
    color: COLORS.muted,
    fontSize: 11,
    marginLeft: 6,
  },

  openLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  openLink: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '900',
    marginRight: 6,
  },

  // DETALLE

  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 17,
  },

  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  detailContent: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
    marginBottom: 5,
  },

  detailValue: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
  },

  detailBlock: {
    marginBottom: 18,
  },

  label: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 9,
  },

  value: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 21,
  },

  motivoBox: {
    backgroundColor: COLORS.background,
    borderRadius: 13,
    padding: 15,
  },

  motivo: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 22,
  },

  observationBox: {
    backgroundColor: COLORS.background,
    borderRadius: 13,
    padding: 15,
  },

  // SOPORTES

  supportDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 12,
  },

  supportLoading: {
    alignItems: 'center',
    paddingVertical: 20,
  },

  supportError: {
    marginTop: 12,
  },

  emptySupport: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 13,
    padding: 23,
    marginTop: 8,
  },

  emptySupportText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 19,
  },

  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 13,
    padding: 13,
    marginTop: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  supportIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  supportContent: {
    flex: 1,
    marginRight: 8,
  },

  supportName: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },

  supportLink: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
  },

  // AVISOS

  notice: {
    flexDirection: 'row',
    backgroundColor: COLORS.pale,
    borderRadius: 15,
    padding: 17,
    marginBottom: 15,
  },

  noticeContent: {
    flex: 1,
    marginLeft: 11,
  },

  noticeTitle: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 7,
  },

  noticeText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 20,
  },

  infoNotice: {
    flexDirection: 'row',
    backgroundColor: COLORS.pale,
    borderRadius: 13,
    padding: 14,
    marginBottom: 17,
  },

  infoNoticeText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
    marginLeft: 10,
  },

  assignedNotice: {
    flexDirection: 'row',
    backgroundColor: '#EAF7EF',
    borderRadius: 13,
    padding: 14,
    marginBottom: 20,
  },

  assignedText: {
    flex: 1,
    color: COLORS.green,
    fontSize: 12,
    lineHeight: 19,
    marginLeft: 10,
    fontWeight: '700',
  },

  // FORMULARIO

  inputHelp: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 10,
  },

  observationInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F8FAFD',
    borderRadius: 13,
    minHeight: 130,
    padding: 15,
    textAlignVertical: 'top',
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 21,
  },

  characterCount: {
    textAlign: 'right',
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 8,
    marginBottom: 19,
  },

  // BOTONES

  primaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 13,
    minHeight: 51,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  approveButton: {
    backgroundColor: COLORS.green,
  },

  rejectButton: {
    backgroundColor: COLORS.red,
    marginTop: 12,
  },

  disabledButton: {
    opacity: 0.65,
  },

  buttonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 13,
    marginLeft: 8,
  },

  // CARGA Y ERRORES

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  loadingBox: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 35,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 12,
    marginLeft: 10,
    marginTop: 6,
  },

  errorHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  errorTitle: {
    flex: 1,
    color: COLORS.red,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 9,
  },

  errorText: {
    color: COLORS.red,
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 15,
  },

  // ESTADO VACÍO

  emptyBox: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyIcon: {
    width: 73,
    height: 73,
    borderRadius: 22,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 9,
  },

  emptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },

  // PIE DE PÁGINA

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 7,
  },
});