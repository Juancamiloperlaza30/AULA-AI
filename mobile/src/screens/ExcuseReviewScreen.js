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

import GuardianSupportViewer
  from '../components/GuardianSupportViewer';

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

const ESTADOS = {
  pendiente_revision: 'Pendiente de revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  requiere_correccion: 'Requiere corrección',
};

function obtenerEstado(estado) {
  return ESTADOS[estado] || estado || 'Sin estado';
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

export default function ExcuseReviewScreen({
  apiUrl,
  accessToken,
  usuarioId,
  onBack,
}) {
  const [excusas, setExcusas] = useState([]);
  const [excusaSeleccionada, setExcusaSeleccionada] =
    useState(null);

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] =
    useState(false);

  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [soportes, setSoportes] = useState([]);
  const [cargandoSoportes, setCargandoSoportes] =
    useState(false);
  const [errorSoportes, setErrorSoportes] = useState('');
  const [soporteSeleccionado, setSoporteSeleccionado] =
    useState(null);

  const esResponsableAsignado =
    Boolean(
      usuarioId &&
      excusaSeleccionada?.revision_asignada_a &&
      String(excusaSeleccionada.revision_asignada_a) ===
        String(usuarioId)
    );

  const estaPendiente =
    excusaSeleccionada?.estado === 'pendiente_revision';

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

  const enviarAccion = async (excusaId, accion, cuerpo) => {
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

  const asumirRevision = async () => {
    if (!excusaSeleccionada || procesando) return;

    if (!estaPendiente || excusaSeleccionada.revision_asignada_a) {
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

  const volver = () => {
    if (excusaSeleccionada) {
      setExcusaSeleccionada(null);
      setObservacion('');
      void cargarExcusas(true);
      return;
    }

    onBack?.();
  };

  const pendientes = excusas.filter(
    (excusa) =>
      excusa.estado === 'pendiente_revision'
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={volver}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ← Volver
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Revisión de excusas
        </Text>

        <Text style={styles.subtitle}>
          Consulta y seguimiento de solicitudes académicas
        </Text>
      </View>

      {cargandoDetalle && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#1676B8" />
          <Text style={styles.loadingText}>
            Consultando solicitud...
          </Text>
        </View>
      )}

      {excusaSeleccionada ? (
        <ScrollView
          contentContainerStyle={styles.content}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Excusa #{excusaSeleccionada.id}
            </Text>

            <Text style={styles.label}>
              Estado
            </Text>
            <Text style={styles.value}>
              {obtenerEstado(
                excusaSeleccionada.estado
              )}
            </Text>

            <Text style={styles.label}>
              Fecha de solicitud
            </Text>
            <Text style={styles.value}>
              {formatearFecha(
                excusaSeleccionada.created_at
              )}
            </Text>

            <Text style={styles.label}>
              Motivo presentado
            </Text>
            <Text style={styles.motivo}>
              {excusaSeleccionada.motivo}
            </Text>

            <Text style={styles.label}>
              Seguimiento institucional
            </Text>
            <Text style={styles.value}>
              {excusaSeleccionada.revision_asignada_a
                ? 'En revisión por un responsable'
                : excusaSeleccionada.vista_at
                  ? 'Vista por la institución'
                  : 'Sin revisar'}
            </Text>

            {excusaSeleccionada.observacion_revision
              ? (
                <>
                  <Text style={styles.label}>
                    Observación de revisión
                  </Text>
                  <Text style={styles.value}>
                    {
                      excusaSeleccionada
                        .observacion_revision
                    }
                  </Text>
                </>
              )
              : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Documentos de soporte
            </Text>

            <Text style={styles.supportDescription}>
              Revisa los archivos enviados por el acudiente
              antes de registrar una decisión.
            </Text>

            {cargandoSoportes ? (
              <ActivityIndicator
                color="#1676B8"
                style={{ marginTop: 18 }}
              />
            ) : errorSoportes ? (
              <>
                <Text style={styles.errorText}>
                  {errorSoportes}
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    cargarSoportes(excusaSeleccionada.id)
                  }
                >
                  <Text style={styles.buttonText}>
                    Reintentar
                  </Text>
                </TouchableOpacity>
              </>
            ) : soportes.length === 0 ? (
              <Text style={styles.supportDescription}>
                No hay documentos adjuntos a esta excusa.
              </Text>
            ) : (
              soportes.map((soporte) => (
                <TouchableOpacity
                  key={String(soporte.id)}
                  style={styles.supportItem}
                  onPress={() =>
                    setSoporteSeleccionado(soporte)
                  }
                >
                  <Text style={styles.supportName}>
                    {soporte.tipo_mime === 'application/pdf'
                      ? '📄'
                      : '🖼️'}{' '}
                    {soporte.nombre_archivo ||
                      `Soporte #${soporte.id}`}
                  </Text>

                  <Text style={styles.supportLink}>
                    Ver documento →
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {estaPendiente && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Gestión de la solicitud
              </Text>

              {!excusaSeleccionada.revision_asignada_a ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={asumirRevision}
                  disabled={procesando}
                >
                  <Text style={styles.buttonText}>
                    {procesando
                      ? 'Procesando...'
                      : 'Asumir revisión'}
                  </Text>
                </TouchableOpacity>
              ) : esResponsableAsignado ? (
                <>
                  <Text style={styles.label}>
                    Observación institucional
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

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      {
                        backgroundColor: '#20845C',
                        marginTop: 15,
                      },
                    ]}
                    disabled={procesando}
                    onPress={() =>
                      registrarDecision('aprobada')
                    }
                  >
                    <Text style={styles.buttonText}>
                      Aprobar excusa
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      {
                        backgroundColor: '#B42318',
                        marginTop: 12,
                      },
                    ]}
                    disabled={procesando}
                    onPress={() =>
                      registrarDecision('rechazada')
                    }
                  >
                    <Text style={styles.buttonText}>
                      Rechazar excusa
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.value}>
                  Esta solicitud ya fue asumida por otro responsable.
                  Puedes consultar su información, pero no registrar
                  una decisión.
                </Text>
              )}
            </View>
          )}

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>
              Revisión institucional
            </Text>
            <Text style={styles.noticeText}>
              Solo puedes registrar una decisión si
              tienes asignada esta excusa y continúa
              pendiente de revisión.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={actualizando}
              onRefresh={() => cargarExcusas(true)}
            />
          }
        >
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {excusas.length}
              </Text>
              <Text style={styles.summaryLabel}>
                Solicitudes
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {pendientes}
              </Text>
              <Text style={styles.summaryLabel}>
                Pendientes
              </Text>
            </View>
          </View>

          {cargando ? (
            <ActivityIndicator
              size="large"
              color="#1676B8"
            />
          ) : error ? (
            <View style={styles.card}>
              <Text style={styles.errorText}>
                {error}
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => cargarExcusas()}
              >
                <Text style={styles.buttonText}>
                  Reintentar
                </Text>
              </TouchableOpacity>
            </View>
          ) : excusas.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>
                No hay excusas para revisar
              </Text>
              <Text style={styles.emptyText}>
                Cuando existan solicitudes
                autorizadas, aparecerán aquí.
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
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>
                    Excusa #{excusa.id}
                  </Text>

                  <Text style={styles.status}>
                    {obtenerEstado(excusa.estado)}
                  </Text>
                </View>

                <Text
                  style={styles.motivoPreview}
                  numberOfLines={3}
                >
                  {excusa.motivo}
                </Text>

                <Text style={styles.date}>
                  Enviada:{' '}
                  {formatearFecha(excusa.created_at)}
                </Text>

                <Text style={styles.openLink}>
                  Ver detalle →
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <GuardianSupportViewer
        visible={Boolean(soporteSeleccionado)}
        onClose={() => setSoporteSeleccionado(null)}
        apiUrl={apiUrl}
        accessToken={accessToken}
        excusaId={excusaSeleccionada?.id}
        soporteId={soporteSeleccionado?.id}
        modo="revision"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  header: {
    backgroundColor: '#102B4E',
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 25,
  },
  backButton: {
    marginBottom: 18,
  },
  backText: {
    color: '#B8E5FF',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },
  subtitle: {
    color: '#D0DCEB',
    fontSize: 13,
    marginTop: 7,
  },
  content: {
    padding: 18,
    paddingBottom: 45,
  },
  summary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1676B8',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#63748A',
    marginTop: 5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 19,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5EBF2',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#183553',
    flexShrink: 1,
  },
  status: {
    color: '#1676B8',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  motivoPreview: {
    color: '#42566C',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  date: {
    color: '#738399',
    fontSize: 12,
  },
  openLink: {
    color: '#1676B8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 15,
  },
  label: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 6,
  },
  value: {
    color: '#183553',
    fontSize: 15,
    lineHeight: 22,
  },
  motivo: {
    color: '#183553',
    fontSize: 15,
    lineHeight: 24,
    backgroundColor: '#F4F7FB',
    padding: 14,
    borderRadius: 12,
  },
  notice: {
    backgroundColor: '#EAF4FC',
    borderRadius: 14,
    padding: 18,
  },
  noticeTitle: {
    color: '#183553',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 7,
  },
  noticeText: {
    color: '#42566C',
    fontSize: 13,
    lineHeight: 21,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 15,
  },
  loadingText: {
    color: '#64748B',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#183553',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748B',
    lineHeight: 21,
  },
  errorText: {
    color: '#B42318',
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#1676B8',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  observationInput: {
    borderWidth: 1,
    borderColor: '#D7E0EB',
    backgroundColor: '#F8FAFD',
    borderRadius: 12,
    minHeight: 120,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#183553',
  },
  supportDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 8,
  },
  supportItem: {
    backgroundColor: '#F4F7FB',
    borderRadius: 12,
    padding: 15,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E1E8F0',
  },
  supportName: {
    color: '#183553',
    fontSize: 14,
    fontWeight: '600',
  },
  supportLink: {
    color: '#1676B8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
