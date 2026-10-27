'use strict';

// ======================================================
// AULA-AI | HU-12
// PANTALLA DE COMUNICADOS INSTITUCIONALES
// CONSULTA, DETALLE Y REGISTRO DE LECTURA
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

import {
  consultarMisComunicados,
  consultarDetalleComunicado,
  marcarComunicadoComoLeido,
} from '../services/comunicadoService';

// ======================================================
// CONFIGURACION
// ======================================================

const LIMITE_PAGINA = 20;

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
// COMPONENTE PRINCIPAL
// ======================================================

export default function StudentCommunicationsScreen({
  apiUrl,
  accessToken,
  onBack,
}) {
  // ----------------------------------------------------
  // ESTADOS
  // ----------------------------------------------------

  const [comunicados, setComunicados] = useState([]);
  const [comunicadoSeleccionado, setComunicadoSeleccionado] =
    useState(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [registrandoLectura, setRegistrandoLectura] =
    useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [errorConsulta, setErrorConsulta] = useState('');

  // ----------------------------------------------------
  // CONSULTAR COMUNICADOS
  // ----------------------------------------------------

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
        const resultado = await consultarMisComunicados({
          apiUrl,
          accessToken,
          pagina,
          limite: LIMITE_PAGINA,
        });

        const nuevosComunicados = resultado.comunicados;

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
            Number(resultado.paginacion?.totalPaginas) || 1
          )
        );
      } catch (error) {
        setErrorConsulta(obtenerMensajeError(error));
      } finally {
        setCargando(false);
        setActualizando(false);
        setCargandoMas(false);
      }
    },
    [apiUrl, accessToken]
  );

  // ----------------------------------------------------
  // CARGA INICIAL
  // ----------------------------------------------------

  useEffect(() => {
    const temporizador = setTimeout(() => {
      cargarComunicados({
        pagina: 1,
      });
    }, 0);

    return () => clearTimeout(temporizador);
  }, [cargarComunicados]);

  // ----------------------------------------------------
  // ACTUALIZAR LISTA
  // ----------------------------------------------------

  const actualizarComunicados = async () => {
    await cargarComunicados({
      pagina: 1,
      refrescar: true,
    });
  };

  // ----------------------------------------------------
  // CARGAR MAS COMUNICADOS
  // ----------------------------------------------------

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

  // ----------------------------------------------------
  // CONSULTAR DETALLE
  // ----------------------------------------------------

  const abrirComunicado = async (comunicadoId) => {
    if (cargandoDetalle) {
      return;
    }

    setCargandoDetalle(true);

    try {
      const detalle = await consultarDetalleComunicado({
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

  // ----------------------------------------------------
  // MARCAR COMO LEIDO
  // ----------------------------------------------------

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
      const resultado = await marcarComunicadoComoLeido({
        apiUrl,
        accessToken,
        comunicadoId: comunicadoSeleccionado.id,
      });

      if (resultado.leido !== true) {
        throw new Error(
          'El servidor no confirmó la lectura del comunicado.'
        );
      }

      const comunicadoId = comunicadoSeleccionado.id;

      setComunicadoSeleccionado((anterior) => {
        if (!anterior) {
          return anterior;
        }

        return {
          ...anterior,
          leido: true,
          fechaLectura: resultado.fechaLectura || null,
        };
      });

      setComunicados((anteriores) =>
        anteriores.map((item) => {
          if (String(item.id) !== String(comunicadoId)) {
            return item;
          }

          return {
            ...item,
            leido: true,
            fechaLectura: resultado.fechaLectura || null,
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

  // ----------------------------------------------------
  // REGRESAR DESDE EL DETALLE
  // ----------------------------------------------------

  const regresarALista = () => {
    if (registrandoLectura) {
      return;
    }

    setComunicadoSeleccionado(null);
  };

  // ====================================================
  // VISTA DE DETALLE
  // ====================================================

  if (comunicadoSeleccionado) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={regresarALista}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>
            ← Volver a mis comunicados
          </Text>
        </TouchableOpacity>

        <View style={styles.headerCard}>
          <Text style={styles.headerSubtitle}>
            AULA-AI | HU-12
          </Text>

          <Text style={styles.headerTitle}>
            Comunicado institucional
          </Text>

          <Text style={styles.headerDescription}>
            Información publicada por tu institución educativa.
          </Text>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.detailTop}>
            <Text
              style={[
                styles.statusText,
                comunicadoSeleccionado.leido
                  ? styles.statusRead
                  : styles.statusPending,
              ]}
            >
              {comunicadoSeleccionado.leido
                ? '✓ Leído'
                : '● Pendiente de lectura'}
            </Text>
          </View>

          <Text style={styles.detailTitle}>
            {comunicadoSeleccionado.titulo}
          </Text>

          <Text style={styles.detailDate}>
            Publicado el{' '}
            {formatearFecha(
              comunicadoSeleccionado.fechaPublicacion
            )}
          </Text>

          <View style={styles.separator} />

          <Text style={styles.sectionTitle}>
            Contenido del comunicado
          </Text>

          <Text style={styles.detailContent}>
            {comunicadoSeleccionado.contenido}
          </Text>

          {comunicadoSeleccionado.leido &&
            comunicadoSeleccionado.fechaLectura && (
              <View style={styles.readInfo}>
                <Text style={styles.readInfoText}>
                  Lectura registrada el{' '}
                  {formatearFecha(
                    comunicadoSeleccionado.fechaLectura
                  )}
                </Text>
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
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                ✓ Marcar como leído
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // ====================================================
  // VISTA DE LISTADO
  // ====================================================

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={actualizarComunicados}
          colors={['#1F4E79']}
        />
      }
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
      >
        <Text style={styles.backButtonText}>
          ← Volver al inicio
        </Text>
      </TouchableOpacity>

      <View style={styles.headerCard}>
        <Text style={styles.headerSubtitle}>
          AULA-AI | COMUNICADOS
        </Text>

        <Text style={styles.headerTitle}>
          Mis comunicados
        </Text>

        <Text style={styles.headerDescription}>
          Consulta las novedades, avisos e información
          institucional dirigida a ti.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          Comunicados recibidos
        </Text>

        <Text style={styles.summaryNumber}>
          {comunicados.length}
        </Text>

        <Text style={styles.summaryDescription}>
          Mostrando los comunicados cargados.
        </Text>
      </View>

      {cargando && (
        <View style={styles.centerContent}>
          <ActivityIndicator
            size="large"
            color="#1F4E79"
          />

          <Text style={styles.loadingText}>
            Consultando comunicados institucionales...
          </Text>
        </View>
      )}

      {!cargando && errorConsulta ? (
        <View style={styles.errorCard}>
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
          >
            <Text style={styles.retryButtonText}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!cargando &&
        !errorConsulta &&
        comunicados.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>
              📭
            </Text>

            <Text style={styles.emptyTitle}>
              No tienes comunicados
            </Text>

            <Text style={styles.emptyDescription}>
              Cuando tu institución publique un comunicado
              dirigido a ti, aparecerá en esta sección.
            </Text>
          </View>
        )}

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
          >
            <View style={styles.communicationHeader}>
              <Text
                style={styles.communicationTitle}
              >
                {comunicado.titulo}
              </Text>

              {!comunicado.leido && (
                <View style={styles.unreadDot} />
              )}
            </View>

            <Text
              style={styles.communicationPreview}
              numberOfLines={3}
            >
              {comunicado.contenido}
            </Text>

            <View style={styles.communicationFooter}>
              <Text style={styles.communicationDate}>
                {formatearFecha(
                  comunicado.fechaPublicacion
                )}
              </Text>

              <Text
                style={[
                  styles.communicationStatus,
                  comunicado.leido
                    ? styles.readLabel
                    : styles.pendingLabel,
                ]}
              >
                {comunicado.leido
                  ? 'Leído'
                  : 'No leído'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

      {cargandoDetalle && (
        <View style={styles.centerContent}>
          <ActivityIndicator
            color="#1F4E79"
          />

          <Text style={styles.loadingText}>
            Abriendo comunicado...
          </Text>
        </View>
      )}

      {!cargando &&
        paginaActual < totalPaginas && (
          <TouchableOpacity
            style={[
              styles.loadMoreButton,
              cargandoMas && styles.disabledButton,
            ]}
            onPress={cargarMasComunicados}
            disabled={cargandoMas}
            accessibilityRole="button"
          >
            {cargandoMas ? (
              <ActivityIndicator color="#1F4E79" />
            ) : (
              <Text style={styles.loadMoreText}>
                Cargar más comunicados
              </Text>
            )}
          </TouchableOpacity>
        )}
    </ScrollView>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  contentContainer: {
    padding: 20,
    paddingTop: 55,
    paddingBottom: 50,
  },

  backButton: {
    marginBottom: 18,
    alignSelf: 'flex-start',
  },

  backButtonText: {
    color: '#1F4E79',
    fontSize: 14,
    fontWeight: '700',
  },

  headerCard: {
    backgroundColor: '#1F4E79',
    borderRadius: 16,
    padding: 22,
    marginBottom: 18,
  },

  headerSubtitle: {
    color: '#BBD9F0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 8,
  },

  headerDescription: {
    color: '#E5EFF7',
    fontSize: 13,
    lineHeight: 20,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E6ED',
  },

  summaryTitle: {
    color: '#607D8B',
    fontSize: 13,
    fontWeight: '600',
  },

  summaryNumber: {
    color: '#1F4E79',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6,
  },

  summaryDescription: {
    color: '#78909C',
    fontSize: 11,
    marginTop: 4,
  },

  communicationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E6ED',
  },

  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#1F4E79',
  },

  communicationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  communicationTitle: {
    flex: 1,
    color: '#263238',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },

  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#1F4E79',
    marginLeft: 10,
    marginTop: 6,
  },

  communicationPreview: {
    color: '#455A64',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 15,
  },

  communicationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  communicationDate: {
    color: '#78909C',
    fontSize: 11,
  },

  communicationStatus: {
    fontSize: 11,
    fontWeight: '800',
  },

  readLabel: {
    color: '#21845B',
  },

  pendingLabel: {
    color: '#B7791F',
  },

  centerContent: {
    alignItems: 'center',
    paddingVertical: 30,
  },

  loadingText: {
    marginTop: 12,
    color: '#607D8B',
    fontSize: 13,
    textAlign: 'center',
  },

  errorCard: {
    backgroundColor: '#FFF4F2',
    borderWidth: 1,
    borderColor: '#F0C6C0',
    borderRadius: 12,
    padding: 18,
    marginBottom: 18,
  },

  errorTitle: {
    color: '#A52A22',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },

  errorText: {
    color: '#8A423C',
    fontSize: 13,
    lineHeight: 20,
  },

  retryButton: {
    backgroundColor: '#A52A22',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginTop: 15,
    alignSelf: 'flex-start',
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E6ED',
  },

  emptyIcon: {
    fontSize: 38,
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#1F4E79',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },

  emptyDescription: {
    color: '#607D8B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  loadMoreButton: {
    backgroundColor: '#EAF2F8',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },

  loadMoreText: {
    color: '#1F4E79',
    fontSize: 14,
    fontWeight: '700',
  },

  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E0E6ED',
    marginBottom: 20,
  },

  detailTop: {
    marginBottom: 16,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },

  statusRead: {
    color: '#21845B',
  },

  statusPending: {
    color: '#B7791F',
  },

  detailTitle: {
    color: '#1F4E79',
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 29,
    marginBottom: 12,
  },

  detailDate: {
    color: '#78909C',
    fontSize: 12,
  },

  separator: {
    height: 1,
    backgroundColor: '#E0E6ED',
    marginVertical: 22,
  },

  sectionTitle: {
    color: '#263238',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },

  detailContent: {
    color: '#455A64',
    fontSize: 15,
    lineHeight: 25,
  },

  readInfo: {
    marginTop: 22,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#EAF7EF',
  },

  readInfoText: {
    color: '#21845B',
    fontSize: 12,
    fontWeight: '600',
  },

  primaryButton: {
    backgroundColor: '#1F4E79',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.6,
  },
});

// ======================================================
// FIN | STUDENT COMMUNICATIONS SCREEN
// ======================================================
