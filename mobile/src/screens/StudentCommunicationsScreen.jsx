'use strict';

// ======================================================
// AULA-AI | HU-12
// COMUNICADOS INSTITUCIONALES
// REDISEÑO PREMIUM - LISTADO, DETALLE Y LECTURA
// ======================================================

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

import {
  consultarMisComunicados,
  consultarDetalleComunicado,
  marcarComunicadoComoLeido,
} from '../services/comunicadoService';

// ======================================================
// CONFIGURACIÓN
// ======================================================

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
  green: '#21845B',
  greenLight: '#EAF7EF',
  amber: '#B7791F',
  amberLight: '#FFF5DF',
  red: '#A52A22',
  redLight: '#FFF4F2',
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

const formatearFecha = (fecha) => {
  if (!fecha) {
    return 'Fecha no disponible';
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return valor.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const obtenerMensajeError = (error) => {
  return (
    error?.message ||
    'Ocurrió un error inesperado. Inténtalo nuevamente.'
  );
};

// ======================================================
// COMPONENTE: ENCABEZADO
// ======================================================

function HeaderComunicados({
  detalle = false,
  onBack,
  disabled = false,
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          disabled={disabled}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={COLORS.white}
          />

          <Text style={styles.backButtonText}>
            {detalle ? 'Mis comunicados' : 'Volver'}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerBadge}>
          <Ionicons
            name="megaphone-outline"
            size={14}
            color={COLORS.cyan}
          />

          <Text style={styles.headerBadgeText}>
            AULA-AI
          </Text>
        </View>
      </View>

      <View style={styles.heroIcon}>
        <Ionicons
          name={
            detalle
              ? 'document-text-outline'
              : 'mail-open-outline'
          }
          size={30}
          color={COLORS.white}
        />
      </View>

      <Text style={styles.headerTitle}>
        {detalle
          ? 'Detalle del comunicado'
          : 'Mis comunicados'}
      </Text>

      <Text style={styles.headerDescription}>
        {detalle
          ? 'Consulta la información publicada por tu institución educativa.'
          : 'Mantente al día con las novedades, avisos e información institucional dirigida a ti.'}
      </Text>
    </View>
  );
}

// ======================================================
// COMPONENTE: ESTADO DE LECTURA
// ======================================================

function EstadoLectura({ leido }) {
  return (
    <View
      style={[
        styles.statusBadge,
        leido
          ? styles.statusBadgeRead
          : styles.statusBadgePending,
      ]}
    >
      <Ionicons
        name={
          leido
            ? 'checkmark-circle'
            : 'time-outline'
        }
        size={14}
        color={
          leido ? COLORS.green : COLORS.amber
        }
      />

      <Text
        style={[
          styles.statusBadgeText,
          leido
            ? styles.statusTextRead
            : styles.statusTextPending,
        ]}
      >
        {leido ? 'Leído' : 'No leído'}
      </Text>
    </View>
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function StudentCommunicationsScreen({
  apiUrl,
  accessToken,
  onBack,
}) {
  // ====================================================
  // ESTADOS ORIGINALES
  // ====================================================

  const [comunicados, setComunicados] = useState([]);

  const [
    comunicadoSeleccionado,
    setComunicadoSeleccionado,
  ] = useState(null);

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [cargandoDetalle, setCargandoDetalle] =
    useState(false);

  const [registrandoLectura, setRegistrandoLectura] =
    useState(false);

  const [cargandoMas, setCargandoMas] =
    useState(false);

  const [paginaActual, setPaginaActual] =
    useState(1);

  const [totalPaginas, setTotalPaginas] =
    useState(1);

  const [errorConsulta, setErrorConsulta] =
    useState('');

  // ====================================================
  // CONSULTAR COMUNICADOS
  // ====================================================

  const cargarComunicados = useCallback(
    async ({
      pagina = 1,
      agregar = false,
      refrescar = false,
    } = {}) => {
      if (agregar) {
        setCargandoMas(true);
      } else if (refrescar) {
        setActualizando(true);
      } else {
        setCargando(true);
      }

      setErrorConsulta('');

      try {
        const resultado =
          await consultarMisComunicados({
            apiUrl,
            accessToken,
            pagina,
            limite: LIMITE_PAGINA,
          });

        const nuevosComunicados =
          resultado.comunicados;

        if (agregar) {
          setComunicados((anteriores) => {
            const mapa = new Map();

            anteriores.forEach((item) => {
              mapa.set(String(item.id), item);
            });

            nuevosComunicados.forEach((item) => {
              mapa.set(String(item.id), item);
            });

            return Array.from(mapa.values());
          });
        } else {
          setComunicados(nuevosComunicados);
        }

        setPaginaActual(pagina);

        setTotalPaginas(
          Math.max(
            1,
            Number(
              resultado.paginacion?.totalPaginas
            ) || 1
          )
        );
      } catch (error) {
        setErrorConsulta(
          obtenerMensajeError(error)
        );
      } finally {
        setCargando(false);
        setActualizando(false);
        setCargandoMas(false);
      }
    },
    [apiUrl, accessToken]
  );

  // ====================================================
  // CARGA INICIAL
  // ====================================================

  useEffect(() => {
    const temporizador = setTimeout(() => {
      cargarComunicados({
        pagina: 1,
      });
    }, 0);

    return () => {
      clearTimeout(temporizador);
    };
  }, [cargarComunicados]);

  // ====================================================
  // ACTUALIZAR LISTA
  // ====================================================

  const actualizarComunicados = async () => {
    await cargarComunicados({
      pagina: 1,
      refrescar: true,
    });
  };

  // ====================================================
  // CARGAR MÁS COMUNICADOS
  // ====================================================

  const cargarMasComunicados = async () => {
    if (
      cargando ||
      actualizando ||
      cargandoMas ||
      paginaActual >= totalPaginas
    ) {
      return;
    }

    await cargarComunicados({
      pagina: paginaActual + 1,
      agregar: true,
    });
  };

  // ====================================================
  // CONSULTAR DETALLE
  // ====================================================

  const abrirComunicado = async (comunicadoId) => {
    if (cargandoDetalle) {
      return;
    }

    setCargandoDetalle(true);

    try {
      const detalle =
        await consultarDetalleComunicado({
          apiUrl,
          accessToken,
          comunicadoId,
        });

      setComunicadoSeleccionado(detalle);
    } catch (error) {
      Alert.alert(
        'No fue posible abrir el comunicado',
        obtenerMensajeError(error)
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ====================================================
  // MARCAR COMO LEÍDO
  // ====================================================

  const registrarLectura = async () => {
    if (
      !comunicadoSeleccionado ||
      comunicadoSeleccionado.leido ||
      registrandoLectura
    ) {
      return;
    }

    setRegistrandoLectura(true);

    try {
      const resultado =
        await marcarComunicadoComoLeido({
          apiUrl,
          accessToken,
          comunicadoId:
            comunicadoSeleccionado.id,
        });

      if (resultado.leido !== true) {
        throw new Error(
          'El servidor no confirmó la lectura del comunicado.'
        );
      }

      const comunicadoId =
        comunicadoSeleccionado.id;

      setComunicadoSeleccionado((anterior) => {
        if (!anterior) {
          return anterior;
        }

        return {
          ...anterior,
          leido: true,
          fechaLectura:
            resultado.fechaLectura || null,
        };
      });

      setComunicados((anteriores) =>
        anteriores.map((item) => {
          if (
            String(item.id) !==
            String(comunicadoId)
          ) {
            return item;
          }

          return {
            ...item,
            leido: true,
            fechaLectura:
              resultado.fechaLectura || null,
          };
        })
      );

      Alert.alert(
        'Lectura registrada',
        'El comunicado fue marcado como leído correctamente.'
      );
    } catch (error) {
      Alert.alert(
        'No fue posible registrar la lectura',
        obtenerMensajeError(error)
      );
    } finally {
      setRegistrandoLectura(false);
    }
  };

  // ====================================================
  // REGRESAR DESDE EL DETALLE
  // ====================================================

  const regresarALista = () => {
    if (registrandoLectura) {
      return;
    }

    setComunicadoSeleccionado(null);
  };

  // ====================================================
  // RESUMEN VISUAL
  // ====================================================

  const totalCargados = comunicados.length;

  const totalLeidos = comunicados.filter(
    (item) => item.leido
  ).length;

  const totalPendientes = comunicados.filter(
    (item) => !item.leido
  ).length;

  // ====================================================
  // VISTA DE DETALLE
  // ====================================================

  if (comunicadoSeleccionado) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.contentContainer
        }
        showsVerticalScrollIndicator={false}
      >
        <HeaderComunicados
          detalle
          onBack={regresarALista}
          disabled={registrandoLectura}
        />

        <View style={styles.detailCard}>
          <View style={styles.detailTop}>
            <View style={styles.detailIcon}>
              <Ionicons
                name="document-text-outline"
                size={24}
                color={COLORS.blue}
              />
            </View>

            <EstadoLectura
              leido={
                comunicadoSeleccionado.leido
              }
            />
          </View>

          <Text style={styles.detailTitle}>
            {comunicadoSeleccionado.titulo}
          </Text>

          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={COLORS.muted}
            />

            <Text style={styles.detailDate}>
              Publicado el{' '}
              {formatearFecha(
                comunicadoSeleccionado
                  .fechaPublicacion
              )}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.contentSectionHeader}>
            <View style={styles.contentSectionIcon}>
              <Ionicons
                name="reader-outline"
                size={19}
                color={COLORS.blue}
              />
            </View>

            <Text style={styles.sectionTitle}>
              Contenido del comunicado
            </Text>
          </View>

          <Text style={styles.detailContent}>
            {comunicadoSeleccionado.contenido}
          </Text>

          {comunicadoSeleccionado.leido &&
            comunicadoSeleccionado.fechaLectura && (
              <View style={styles.readInfo}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={21}
                  color={COLORS.green}
                />

                <View style={styles.readInfoContent}>
                  <Text style={styles.readInfoTitle}>
                    Lectura registrada
                  </Text>

                  <Text style={styles.readInfoText}>
                    {formatearFecha(
                      comunicadoSeleccionado
                        .fechaLectura
                    )}
                  </Text>
                </View>
              </View>
            )}
        </View>

        {!comunicadoSeleccionado.leido && (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              registrandoLectura &&
                styles.disabledButton,
            ]}
            onPress={registrarLectura}
            disabled={registrandoLectura}
            accessibilityRole="button"
          >
            {registrandoLectura ? (
              <>
                <ActivityIndicator
                  color={COLORS.white}
                />

                <Text
                  style={styles.primaryButtonText}
                >
                  Registrando lectura...
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="checkmark-done-outline"
                  size={21}
                  color={COLORS.white}
                />

                <Text
                  style={styles.primaryButtonText}
                >
                  Marcar como leído
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={regresarALista}
          disabled={registrandoLectura}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-back-outline"
            size={18}
            color={COLORS.blue}
          />

          <Text style={styles.secondaryButtonText}>
            Volver a mis comunicados
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={COLORS.muted}
          />

          <Text style={styles.footerText}>
            Comunicaciones institucionales · AULA-AI
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ====================================================
  // VISTA DE LISTADO
  // ====================================================

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.contentContainer
      }
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={actualizarComunicados}
          colors={[COLORS.blue]}
          tintColor={COLORS.blue}
        />
      }
    >
      {/* ENCABEZADO */}

      <HeaderComunicados onBack={onBack} />

      {/* RESUMEN */}

      <View style={styles.summarySection}>
        <View style={styles.summaryMainCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="mail-outline"
              size={24}
              color={COLORS.white}
            />
          </View>

          <Text style={styles.summaryLabel}>
            Comunicados recibidos
          </Text>

          <Text style={styles.summaryNumber}>
            {totalCargados}
          </Text>

          <Text style={styles.summaryDescription}>
            Comunicados cargados hasta ahora
          </Text>
        </View>

        <View style={styles.summarySideColumn}>
          <View style={styles.summarySmallCard}>
            <View style={styles.summarySmallTop}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={COLORS.green}
              />

              <Text
                style={[
                  styles.summarySmallNumber,
                  { color: COLORS.green },
                ]}
              >
                {totalLeidos}
              </Text>
            </View>

            <Text style={styles.summarySmallLabel}>
              Leídos
            </Text>
          </View>

          <View style={styles.summarySmallCard}>
            <View style={styles.summarySmallTop}>
              <Ionicons
                name="time-outline"
                size={20}
                color={COLORS.amber}
              />

              <Text
                style={[
                  styles.summarySmallNumber,
                  { color: COLORS.amber },
                ]}
              >
                {totalPendientes}
              </Text>
            </View>

            <Text style={styles.summarySmallLabel}>
              Pendientes
            </Text>
          </View>
        </View>
      </View>

      {/* TÍTULO DEL LISTADO */}

      <View style={styles.listHeader}>
        <View>
          <Text style={styles.listTitle}>
            Bandeja de comunicados
          </Text>

          <Text style={styles.listSubtitle}>
            Selecciona un comunicado para leerlo
          </Text>
        </View>

        <View style={styles.listHeaderIcon}>
          <Ionicons
            name="albums-outline"
            size={20}
            color={COLORS.blue}
          />
        </View>
      </View>

      {/* CARGA INICIAL */}

      {cargando && (
        <View style={styles.centerCard}>
          <ActivityIndicator
            size="large"
            color={COLORS.blue}
          />

          <Text style={styles.loadingText}>
            Consultando comunicados institucionales...
          </Text>
        </View>
      )}

      {/* ERROR DE CONSULTA */}

      {!cargando && errorConsulta ? (
        <View style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="alert-circle-outline"
              size={29}
              color={COLORS.red}
            />
          </View>

          <Text style={styles.errorTitle}>
            No fue posible consultar los comunicados
          </Text>

          <Text style={styles.errorText}>
            {errorConsulta}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              cargarComunicados({
                pagina: 1,
              })
            }
            accessibilityRole="button"
          >
            <Ionicons
              name="refresh-outline"
              size={17}
              color={COLORS.white}
            />

            <Text style={styles.retryButtonText}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* LISTA VACÍA */}

      {!cargando &&
        !errorConsulta &&
        comunicados.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="mail-open-outline"
                size={35}
                color={COLORS.blue}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No tienes comunicados
            </Text>

            <Text style={styles.emptyDescription}>
              Cuando tu institución publique un
              comunicado dirigido a ti, aparecerá
              en esta sección.
            </Text>
          </View>
        )}

      {/* TARJETAS DE COMUNICADOS */}

      {!cargando &&
        comunicados.map((comunicado) => (
          <TouchableOpacity
            key={String(comunicado.id)}
            style={[
              styles.communicationCard,
              !comunicado.leido &&
                styles.unreadCard,
            ]}
            onPress={() =>
              abrirComunicado(comunicado.id)
            }
            disabled={cargandoDetalle}
            accessibilityRole="button"
            accessibilityLabel={
              `Abrir comunicado: ${comunicado.titulo}`
            }
            activeOpacity={0.85}
          >
            <View style={styles.communicationTop}>
              <View
                style={[
                  styles.communicationIcon,
                  !comunicado.leido &&
                    styles.communicationIconUnread,
                ]}
              >
                <Ionicons
                  name={
                    comunicado.leido
                      ? 'mail-open-outline'
                      : 'mail-unread-outline'
                  }
                  size={22}
                  color={COLORS.blue}
                />
              </View>

              <EstadoLectura
                leido={comunicado.leido}
              />
            </View>

            <Text style={styles.communicationTitle}>
              {comunicado.titulo}
            </Text>

            <Text
              style={styles.communicationPreview}
              numberOfLines={3}
            >
              {comunicado.contenido}
            </Text>

            <View style={styles.communicationDivider} />

            <View style={styles.communicationFooter}>
              <View style={styles.communicationDateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={COLORS.muted}
                />

                <Text
                  style={styles.communicationDate}
                >
                  {formatearFecha(
                    comunicado.fechaPublicacion
                  )}
                </Text>
              </View>

              <View style={styles.openDetail}>
                <Text style={styles.openDetailText}>
                  Ver detalle
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={COLORS.blue}
                />
              </View>
            </View>
          </TouchableOpacity>
        ))}

      {/* CARGANDO DETALLE */}

      {cargandoDetalle && (
        <View style={styles.centerCard}>
          <ActivityIndicator
            color={COLORS.blue}
          />

          <Text style={styles.loadingText}>
            Abriendo comunicado...
          </Text>
        </View>
      )}

      {/* PAGINACIÓN */}

      {!cargando &&
        paginaActual < totalPaginas && (
          <TouchableOpacity
            style={[
              styles.loadMoreButton,
              cargandoMas &&
                styles.disabledButton,
            ]}
            onPress={cargarMasComunicados}
            disabled={cargandoMas}
            accessibilityRole="button"
          >
            {cargandoMas ? (
              <>
                <ActivityIndicator
                  color={COLORS.blue}
                />

                <Text style={styles.loadMoreText}>
                  Cargando comunicados...
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={COLORS.blue}
                />

                <Text style={styles.loadMoreText}>
                  Cargar más comunicados
                </Text>

                <Ionicons
                  name="chevron-down-outline"
                  size={17}
                  color={COLORS.blue}
                />
              </>
            )}
          </TouchableOpacity>
        )}

      {/* ACTUALIZAR */}

      {!cargando && (
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={actualizarComunicados}
          disabled={actualizando || cargandoMas}
          accessibilityRole="button"
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={COLORS.blue}
          />

          <Text style={styles.refreshButtonText}>
            Actualizar comunicados
          </Text>
        </TouchableOpacity>
      )}

      {/* VOLVER */}

      <TouchableOpacity
        style={styles.bottomBackButton}
        onPress={onBack}
        accessibilityRole="button"
      >
        <Ionicons
          name="arrow-back-outline"
          size={18}
          color={COLORS.blue}
        />

        <Text style={styles.bottomBackText}>
          Volver al inicio
        </Text>
      </TouchableOpacity>

      {/* PIE DE PÁGINA */}

      <View style={styles.footer}>
        <Ionicons
          name="shield-checkmark-outline"
          size={16}
          color={COLORS.muted}
        />

        <Text style={styles.footerText}>
          Comunicaciones institucionales · AULA-AI
        </Text>
      </View>
    </ScrollView>
  );
}

// ======================================================
// ESTILOS PREMIUM
// ======================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 55,
  },

  // ENCABEZADO

  header: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 35,
    marginBottom: 22,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  backButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },

  headerBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 7,
  },

  heroIcon: {
    width: 59,
    height: 59,
    borderRadius: 18,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: '900',
    marginBottom: 10,
  },

  headerDescription: {
    color: '#D6E4F2',
    fontSize: 13,
    lineHeight: 21,
  },

  // RESUMEN

  summarySection: {
    flexDirection: 'row',
    marginBottom: 25,
  },

  summaryMainCard: {
    flex: 1.15,
    backgroundColor: COLORS.blue,
    borderRadius: 18,
    padding: 17,
    marginRight: 10,
    justifyContent: 'center',
  },

  summaryIcon: {
    width: 41,
    height: 41,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  summaryLabel: {
    color: '#DCEBFA',
    fontSize: 11,
    fontWeight: '700',
  },

  summaryNumber: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 5,
  },

  summaryDescription: {
    color: '#DCEBFA',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },

  summarySideColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },

  summarySmallCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    minHeight: 93,
    justifyContent: 'center',
    marginBottom: 7,
  },

  summarySmallTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summarySmallNumber: {
    fontSize: 22,
    fontWeight: '900',
  },

  summarySmallLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },

  // LISTADO

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  listTitle: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 5,
  },

  listSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
  },

  listHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // TARJETAS

  communicationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
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

  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.cyan,
  },

  communicationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  communicationIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  communicationIconUnread: {
    backgroundColor: '#DDF5FB',
  },

  communicationTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 23,
    marginBottom: 9,
  },

  communicationPreview: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 17,
  },

  communicationDivider: {
    height: 1,
    backgroundColor: '#E9EFF5',
    marginBottom: 13,
  },

  communicationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  communicationDateRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },

  communicationDate: {
    flexShrink: 1,
    color: COLORS.muted,
    fontSize: 10,
    marginLeft: 6,
  },

  openDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  openDetailText: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '800',
    marginRight: 3,
  },

  // ESTADOS

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },

  statusBadgeRead: {
    backgroundColor: COLORS.greenLight,
  },

  statusBadgePending: {
    backgroundColor: COLORS.amberLight,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },

  statusTextRead: {
    color: COLORS.green,
  },

  statusTextPending: {
    color: COLORS.amber,
  },

  // CARGA

  centerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    padding: 28,
    marginBottom: 18,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },

  // ERRORES

  errorCard: {
    backgroundColor: COLORS.redLight,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#F0C6C0',
    padding: 21,
    marginBottom: 18,
    alignItems: 'center',
  },

  errorIcon: {
    width: 55,
    height: 55,
    borderRadius: 17,
    backgroundColor: '#FFE4E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  errorTitle: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 9,
  },

  errorText: {
    color: '#8A423C',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },

  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.red,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 18,
  },

  retryButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },

  // VACÍO

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    padding: 29,
    marginBottom: 18,
  },

  emptyIconContainer: {
    width: 75,
    height: 75,
    borderRadius: 23,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  emptyTitle: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 10,
  },

  emptyDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },

  // PAGINACIÓN

  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.pale,
    borderRadius: 14,
    padding: 16,
    marginTop: 7,
    marginBottom: 15,
  },

  loadMoreText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: 9,
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
  },

  refreshButtonText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },

  // DETALLE

  detailCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  detailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  detailIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailTitle: {
    color: COLORS.navy,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 14,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  detailDate: {
    color: COLORS.muted,
    fontSize: 12,
    marginLeft: 8,
  },

  separator: {
    height: 1,
    backgroundColor: '#E6EDF5',
    marginVertical: 23,
  },

  contentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },

  contentSectionIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  sectionTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '900',
  },

  detailContent: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 25,
  },

  readInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.greenLight,
    borderRadius: 13,
    padding: 15,
    marginTop: 23,
  },

  readInfoContent: {
    flex: 1,
    marginLeft: 10,
  },

  readInfoTitle: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 5,
  },

  readInfoText: {
    color: COLORS.green,
    fontSize: 12,
  },

  // BOTONES

  primaryButton: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    marginBottom: 13,
    paddingHorizontal: 14,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 10,
  },

  secondaryButton: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 13,
  },

  secondaryButtonText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 9,
  },

  bottomBackButton: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginTop: 3,
  },

  bottomBackText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 9,
  },

  disabledButton: {
    opacity: 0.6,
  },

  // PIE DE PÁGINA

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 7,
  },
});

// ======================================================
// FIN | STUDENT COMMUNICATIONS SCREEN
// ======================================================