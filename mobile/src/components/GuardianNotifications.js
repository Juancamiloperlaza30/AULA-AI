import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

const LIMITE_PAGINA = 20;

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
  amber: '#B7791F',
  amberPale: '#FFF5DF',
  red: '#A52A22',
  redPale: '#FFF4F2',
};

function fechaVisible(valor) {
  if (!valor) {
    return 'Fecha no disponible';
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'Fecha no disponible';
  }

  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function iconoNotificacion(tipo) {
  const tipoNormalizado = String(tipo || '').toLowerCase();

  if (tipoNormalizado.includes('alert')) {
    return 'alert-circle-outline';
  }

  if (tipoNormalizado.includes('comunic')) {
    return 'megaphone-outline';
  }

  if (
    tipoNormalizado.includes('asistencia') ||
    tipoNormalizado.includes('inasistencia')
  ) {
    return 'calendar-outline';
  }

  return 'notifications-outline';
}

function esNotificacionAlerta(notificacion) {
  const referencia = [
    notificacion?.tipo,
    notificacion?.recursoTipo,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return referencia.includes('alert');
}

async function solicitar({
  apiUrl,
  accessToken,
  onRefreshSession,
  ruta,
  metodo = 'GET',
  signal,
}) {
  if (!apiUrl?.trim()) {
    throw new Error(
      'No está disponible la dirección del servidor.'
    );
  }

  const enviarSolicitud = async (token) => {
    try {
      return await fetch(
        `${apiUrl.trim().replace(/\/+$/, '')}${ruta}`,
        {
          method: metodo,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal,
        }
      );
    } catch (error) {
      if (
        signal?.aborted ||
        error?.name === 'AbortError'
      ) {
        throw error;
      }

      throw new Error(
        'No fue posible conectar con el servidor. Comprueba tu conexión e inténtalo nuevamente.'
      );
    }
  };

  let tokenActual = accessToken;

  if (!tokenActual?.trim() && onRefreshSession) {
    const sesionRenovada = await onRefreshSession();
    tokenActual = sesionRenovada?.accessToken;
  }

  if (!tokenActual?.trim()) {
    throw new Error(
      'La sesión no está disponible. Inicia sesión nuevamente.'
    );
  }

  let respuesta = await enviarSolicitud(tokenActual);

  if (
    respuesta.status === 401 &&
    typeof onRefreshSession === 'function'
  ) {
    const sesionRenovada = await onRefreshSession();
    const tokenRenovado = sesionRenovada?.accessToken;

    if (!tokenRenovado?.trim()) {
      throw new Error(
        'La sesión no pudo renovarse. Inicia sesión nuevamente.'
      );
    }

    respuesta = await enviarSolicitud(tokenRenovado);
  }

  let resultado;

  try {
    resultado = await respuesta.json();
  } catch {
    throw new Error(
      `El servidor devolvió una respuesta inválida (HTTP ${respuesta.status}).`
    );
  }

  if (
    !respuesta.ok ||
    resultado?.success !== true
  ) {
    const mensaje = respuesta.status === 403
        ? 'El servidor rechazó el acceso a las notificaciones de esta cuenta.'
        : resultado?.message ||
          'No fue posible completar la solicitud.';
    const error = new Error(
      `${mensaje} (HTTP ${respuesta.status}).`
    );
    error.status = respuesta.status;
    throw error;
  }

  return resultado;
}

export default function GuardianNotifications({
  apiUrl,
  accessToken,
  onRefreshSession,
  onOpenCommunications,
  onOpenAlerts,
}) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [lecturaEnCurso, setLecturaEnCurso] = useState(null);
  const [accionPendiente, setAccionPendiente] = useState('');
  const solicitudRef = useRef(0);
  const abortRef = useRef(null);

  const cargarNotificaciones = useCallback(
    async ({
      nuevaPagina = 1,
      agregar = false,
      refrescar = false,
    } = {}) => {
      const solicitudId = ++solicitudRef.current;
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      setError('');

      setCargando(!agregar && !refrescar);
      setActualizando(refrescar);
      setCargandoMas(agregar);

      if (!agregar && !refrescar) {
        setNotificaciones([]);
      }

      try {
        const resultado = await solicitar({
          apiUrl,
          accessToken,
          onRefreshSession,
          ruta:
            `/api/notificaciones?pagina=${nuevaPagina}` +
            `&limite=${LIMITE_PAGINA}`,
          signal: controller.signal,
        });

        const recibidas = Array.isArray(resultado.data)
          ? resultado.data
          : null;

        if (!recibidas) {
          throw new Error(
            'El servidor no devolvió una lista válida de notificaciones.'
          );
        }

        if (
          controller.signal.aborted ||
          solicitudId !== solicitudRef.current
        ) {
          return;
        }

        setNotificaciones((anteriores) => {
          if (!agregar) {
            return recibidas;
          }

          const idsExistentes = new Set(
            anteriores.map((item) => String(item.id))
          );

          return [
            ...anteriores,
            ...recibidas.filter(
              (item) => !idsExistentes.has(String(item.id))
            ),
          ];
        });
        setPagina(nuevaPagina);
        setTotalPaginas(
          Number(resultado.paginacion?.totalPaginas) || 1
        );
      } catch (errorConsulta) {
        if (
          controller.signal.aborted ||
          solicitudId !== solicitudRef.current ||
          errorConsulta?.name === 'AbortError'
        ) {
          return;
        }

        setError(
          errorConsulta.message ||
            'No fue posible consultar las notificaciones.'
        );
      } finally {
        if (solicitudId === solicitudRef.current) {
          setCargando(false);
          setActualizando(false);
          setCargandoMas(false);
        }
      }
    },
    [accessToken, apiUrl, onRefreshSession]
  );

  useEffect(() => {
    let activo = true;

    Promise.resolve().then(() => {
      if (activo) {
        void cargarNotificaciones();
      }
    });

    return () => {
      activo = false;
      solicitudRef.current += 1;
      abortRef.current?.abort();
    };
  }, [cargarNotificaciones]);

  const marcarComoLeida = async (notificacion) => {
    if (notificacion.leida || lecturaEnCurso !== null) {
      return;
    }

    setLecturaEnCurso(String(notificacion.id));
    setError('');

    try {
      const resultado = await solicitar({
        apiUrl,
        accessToken,
        onRefreshSession,
        ruta:
          `/api/notificaciones/` +
          `${encodeURIComponent(notificacion.id)}/lectura`,
        metodo: 'POST',
      });

      setNotificaciones((actuales) =>
        actuales.map((item) =>
          String(item.id) === String(notificacion.id)
            ? {
                ...item,
                ...(resultado.data || {}),
                leida: true,
              }
            : item
        )
      );
    } catch (errorLectura) {
      setError(
        errorLectura.message ||
          'No fue posible marcar la notificación como leída.'
      );
      throw errorLectura;
    } finally {
      setLecturaEnCurso(null);
    }
  };

  const abrirNotificacion = async (notificacion) => {
    if (accionPendiente) {
      return;
    }

    const abrirComunicado =
      Boolean(notificacion.comunicadoId) &&
      typeof onOpenCommunications === 'function';
    const abrirAlerta =
      esNotificacionAlerta(notificacion) &&
      typeof onOpenAlerts === 'function';

    if (!abrirComunicado && !abrirAlerta) {
      if (!notificacion.leida) {
        try {
          await marcarComoLeida(notificacion);
        } catch {
          return;
        }
      }
      setAccionPendiente('');
      return;
    }

    setAccionPendiente(String(notificacion.id));

    try {
      await marcarComoLeida(notificacion);
      if (abrirComunicado) {
        onOpenCommunications();
      } else {
        onOpenAlerts();
      }
    } catch {
      return;
    } finally {
      setAccionPendiente('');
    }
  };

  const noLeidas = notificaciones.filter(
    (notificacion) => !notificacion.leida
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons
            name="notifications-outline"
            size={24}
            color={COLORS.white}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CENTRO DE AVISOS</Text>
          <Text style={styles.title}>Notificaciones</Text>
          <Text style={styles.subtitle}>
            Avisos recibidos por tu cuenta de Acudiente.
          </Text>
        </View>
      </View>

      {!cargando && !error && (
        <View style={styles.summary}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="mail-unread-outline"
              size={21}
              color={COLORS.blue}
            />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryNumber}>{noLeidas}</Text>
            <Text style={styles.summaryLabel}>
              Sin leer en esta lista
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() =>
              cargarNotificaciones({ refrescar: true })
            }
            disabled={actualizando}
            accessibilityRole="button"
            accessibilityLabel="Actualizar notificaciones"
          >
            {actualizando ? (
              <ActivityIndicator
                size="small"
                color={COLORS.blue}
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={19}
                color={COLORS.blue}
              />
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.list}>
        {error && notificaciones.length > 0 && (
          <View style={styles.inlineError}>
            <Ionicons
              name="alert-circle-outline"
              size={17}
              color={COLORS.red}
            />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}

        {cargando ? (
          <View style={styles.stateCard}>
            <ActivityIndicator
              size="large"
              color={COLORS.blue}
            />
            <Text style={styles.stateText}>
              Consultando tus notificaciones...
            </Text>
          </View>
        ) : error && notificaciones.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons
              name="cloud-offline-outline"
              size={30}
              color={COLORS.red}
            />
            <Text style={styles.stateTitle}>
              No fue posible consultar los avisos
            </Text>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void cargarNotificaciones()}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : notificaciones.length === 0 ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="notifications-off-outline"
                size={27}
                color={COLORS.blue}
              />
            </View>
            <Text style={styles.stateTitle}>
              No tienes notificaciones
            </Text>
            <Text style={styles.stateText}>
              Los avisos institucionales enviados a tu cuenta aparecerán aquí. Las alertas de cada estudiante están en Alertas académicas.
            </Text>
          </View>
        ) : (
          <>
            {notificaciones.map((notificacion) => {
              const leida = Boolean(notificacion.leida);
              const procesando =
                accionPendiente === String(notificacion.id) ||
                lecturaEnCurso === String(notificacion.id);
              const tieneDestino =
                Boolean(notificacion.comunicadoId) ||
                esNotificacionAlerta(notificacion);
              const accionTexto =
                notificacion.comunicadoId
                  ? 'Ver comunicados'
                  : esNotificacionAlerta(notificacion)
                    ? 'Ver alertas académicas'
                    : leida
                      ? 'Leída'
                      : 'Marcar como leída';

              return (
                <View
                  key={String(notificacion.id)}
                  style={[
                    styles.card,
                    !leida && styles.unreadCard,
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View
                      style={[
                        styles.notificationIcon,
                        leida
                          ? styles.readIcon
                          : styles.unreadIcon,
                      ]}
                    >
                      <Ionicons
                        name={iconoNotificacion(notificacion.tipo)}
                        size={20}
                        color={leida ? COLORS.blue : COLORS.amber}
                      />
                    </View>
                    <View style={styles.cardHeading}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle}>
                          {notificacion.titulo || 'Notificación'}
                        </Text>
                        {!leida && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.date}>
                        {fechaVisible(notificacion.fechaCreacion)}
                      </Text>
                    </View>
                  </View>

                  {!!notificacion.mensaje && (
                    <Text style={styles.message}>
                      {notificacion.mensaje}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      leida && styles.actionButtonRead,
                    ]}
                    onPress={() =>
                      void abrirNotificacion(notificacion)
                    }
                    disabled={
                      procesando ||
                      accionPendiente !== '' ||
                      (leida && !tieneDestino)
                    }
                    accessibilityRole="button"
                  >
                    {procesando ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.blue}
                      />
                    ) : (
                      <>
                        <Text style={styles.actionText}>
                          {accionTexto}
                        </Text>
                        <Ionicons
                          name={
                            leida &&
                            !notificacion.comunicadoId &&
                            !esNotificacionAlerta(notificacion)
                              ? 'checkmark-circle-outline'
                              : 'arrow-forward-outline'
                          }
                          size={16}
                          color={COLORS.blue}
                        />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {pagina < totalPaginas && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() =>
                  void cargarNotificaciones({
                    nuevaPagina: pagina + 1,
                    agregar: true,
                  })
                }
                disabled={cargandoMas}
                accessibilityRole="button"
              >
                {cargandoMas ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.blue}
                  />
                ) : (
                  <Text style={styles.loadMoreText}>
                    Cargar más notificaciones
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 420,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 19,
    padding: 17,
    marginBottom: 13,
  },
  headerIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: COLORS.cyan,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  subtitle: {
    color: '#D7E5F3',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 10,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryNumber: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: '900',
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 1,
  },
  refreshButton: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 23,
    marginTop: 5,
  },
  stateTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
  },
  stateText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 9,
    marginTop: 13,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.redPale,
    borderRadius: 11,
    padding: 10,
    marginBottom: 9,
  },
  inlineErrorText: {
    flex: 1,
    color: COLORS.red,
    fontSize: 11,
    lineHeight: 16,
    marginLeft: 7,
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 13,
    marginBottom: 10,
  },
  unreadCard: {
    borderColor: '#E8D7AF',
    backgroundColor: '#FFFEFB',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  readIcon: {
    backgroundColor: COLORS.pale,
  },
  unreadIcon: {
    backgroundColor: COLORS.amberPale,
  },
  cardHeading: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.cyan,
    marginLeft: 7,
  },
  date: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
  },
  message: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  actionButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 11,
    paddingTop: 9,
  },
  actionButtonRead: {
    opacity: 0.88,
  },
  actionText: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '800',
  },
  loadMoreButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.pale,
    borderRadius: 12,
    marginTop: 2,
  },
  loadMoreText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
  },
});
