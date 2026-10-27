
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

import {
  MaterialCommunityIcons,
  Ionicons,
} from '@expo/vector-icons';

import {
  obtenerActividadesLocales,
} from '../../database/localDatabase';

import {
  generarRecordatoriosAcademicos,
  resumirRecordatoriosAcademicos,
} from '../services/studentAcademicReminders';

// ================================================
// AULA-AI | HU-07
// RECORDATORIOS ACADÉMICOS - DISEÑO PREMIUM
//
// Mantiene:
// - Consulta online del estudiante.
// - Consulta offline mediante SQLite.
// - Clasificación por vencimiento.
// - Acceso a Mis actividades.
// ================================================

const TIMEOUT_MS = 8000;

const COLORES = {
  azulOscuro: '#102B4B',
  azul: '#1676B8',
  azulClaro: '#EAF4FC',
  azulTexto: '#20537D',
  celeste: '#9EDDF8',
  blanco: '#FFFFFF',
  fondo: '#F4F7FB',
  texto: '#20334B',
  secundario: '#718399',
  borde: '#E7EDF4',

  rojo: '#C23943',
  rojoFondo: '#FFF0F1',

  naranja: '#B87514',
  naranjaFondo: '#FFF5DF',

  verde: '#16835E',
  verdeFondo: '#E9F7F0',
};

const adaptarActividadLocal = (item) => ({
  id: item.id,
  titulo: item.titulo,
  tipo: item.tipo,
  estado: item.estado,
  fecha_entrega: item.fecha_entrega,

  materia_grupo_periodo: {
    materia: {
      nombre: item.materia,
    },
  },

  entrega: item.entrega_id
    ? {
        id: item.entrega_id,
        estado: item.entrega_estado,
      }
    : null,
});

const fechaBonita = (fecha) => {
  if (!fecha) {
    return 'Sin fecha';
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return valor.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const obtenerConfiguracionEstado = (categoria) => {
  switch (categoria) {
    case 'vencida':
      return {
        etiqueta: 'Vencida',
        icono: 'alert-circle-outline',
        color: COLORES.rojo,
        fondo: COLORES.rojoFondo,
        borde: '#F7D5D8',
      };

    case 'examen_proximo':
      return {
        etiqueta: 'Examen próximo',
        icono: 'school-outline',
        color: COLORES.azul,
        fondo: COLORES.azulClaro,
        borde: '#D5E8F8',
      };

    default:
      return {
        etiqueta: 'Próxima a vencer',
        icono: 'clock-outline',
        color: COLORES.naranja,
        fondo: COLORES.naranjaFondo,
        borde: '#F4E3BB',
      };
  }
};

const solicitarActividades = async ({
  apiUrl,
  accessToken,
  signal,
}) => {
  const controller = new AbortController();

  const abortar = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener(
        'abort',
        abortar,
        { once: true }
      );
    }
  }

  let temporizador;

  try {
    const consulta = (async () => {
      const response = await fetch(
        `${apiUrl}/api/activities/mis-actividades-estudiante`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(
          data.message ||
            'No se pudieron consultar las actividades.'
        );

        error.status = response.status;
        throw error;
      }

      if (!Array.isArray(data.actividades)) {
        throw new Error(
          'El servidor devolvió actividades inválidas.'
        );
      }

      return data.actividades;
    })();

    const controlada = consulta.then(
      (actividades) => ({
        tipo: 'ok',
        actividades,
      }),
      (error) => ({
        tipo: 'error',
        error,
      })
    );

    const limite = new Promise((resolve) => {
      temporizador = setTimeout(() => {
        controller.abort();

        resolve({
          tipo: 'timeout',
        });
      }, TIMEOUT_MS);
    });

    const resultado = await Promise.race([
      controlada,
      limite,
    ]);

    if (resultado.tipo === 'timeout') {
      throw new Error(
        'El servidor no respondió a tiempo.'
      );
    }

    if (resultado.tipo === 'error') {
      throw resultado.error;
    }

    return resultado.actividades;
  } finally {
    clearTimeout(temporizador);

    if (signal) {
      signal.removeEventListener(
        'abort',
        abortar
      );
    }
  }
};

// ================================================
// TARJETA DE ESTADÍSTICA
// ================================================

function Estadistica({
  cantidad,
  titulo,
  icono,
  color,
}) {
  return (
    <View style={styles.estadistica}>
      <View style={styles.estadisticaArriba}>
        <MaterialCommunityIcons
          name={icono}
          size={19}
          color={color}
        />
      </View>

      <Text style={styles.estadisticaNumero}>
        {cantidad}
      </Text>

      <Text
        style={styles.estadisticaTitulo}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {titulo}
      </Text>
    </View>
  );
}

// ================================================
// TARJETA DE RECORDATORIO
// ================================================

function TarjetaRecordatorio({
  recordatorio,
  onPress,
}) {
  const configuracion =
    obtenerConfiguracionEstado(
      recordatorio.categoria
    );

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={typeof onPress !== 'function'}
      style={[
        styles.recordatorioCard,
        {
          borderLeftColor:
            configuracion.color,
        },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.recordatorioSuperior}>
        <View
          style={[
            styles.estadoChip,
            {
              backgroundColor:
                configuracion.fondo,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={configuracion.icono}
            size={14}
            color={configuracion.color}
          />

          <Text
            style={[
              styles.estadoTexto,
              {
                color: configuracion.color,
              },
            ]}
          >
            {configuracion.etiqueta}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={17}
          color="#A0AFBF"
        />
      </View>

      <Text
        style={styles.recordatorioTitulo}
        numberOfLines={2}
      >
        {recordatorio.titulo}
      </Text>

      <View style={styles.materiaFila}>
        <MaterialCommunityIcons
          name="book-open-variant"
          size={15}
          color={COLORES.secundario}
        />

        <Text
          style={styles.materiaTexto}
          numberOfLines={1}
        >
          {recordatorio.materia}
        </Text>
      </View>

      <View style={styles.recordatorioInferior}>
        <View style={styles.fechaFila}>
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={15}
            color={COLORES.secundario}
          />

          <Text style={styles.fechaTexto}>
            {fechaBonita(
              recordatorio.fechaEntrega
            )}
          </Text>
        </View>

        {recordatorio.categoria !== 'vencida' ? (
          <Text style={styles.diasTexto}>
            {recordatorio.diasRestantes === 0
              ? 'Vence hoy'
              : recordatorio.diasRestantes === 1
                ? 'Falta 1 día'
                : `Faltan ${recordatorio.diasRestantes} días`}
          </Text>
        ) : (
          <Text style={styles.vencidaTexto}>
            Revisar entrega
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ================================================
// COMPONENTE PRINCIPAL
// ================================================

export default function StudentAcademicReminders({
  usuarioId,
  accessToken,
  apiUrl,
  onViewActivities,
}) {
  const [
    recordatorios,
    setRecordatorios,
  ] = useState([]);

  const [
    fuente,
    setFuente,
  ] = useState(null);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    actualizando,
    setActualizando,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState('');

  const [
    mostrarTodos,
    setMostrarTodos,
  ] = useState(false);

  const activo = useRef(false);
  const consultaId = useRef(0);
  const controllerRef = useRef(null);

  const cargarRecordatorios = useCallback(
    async (esActualizacion = false) => {
      const id = ++consultaId.current;

      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller =
        new AbortController();

      controllerRef.current = controller;

      if (esActualizacion) {
        setActualizando(true);
      } else {
        setCargando(true);
      }

      setMensaje('');

      let localesDisponibles = false;

      try {
        if (
          !usuarioId ||
          !accessToken ||
          !apiUrl
        ) {
          throw new Error(
            'No se encontró una sesión válida.'
          );
        }

        // 1. Consultar SQLite primero.
        try {
          const locales =
            await obtenerActividadesLocales(
              usuarioId
            );

          if (
            controller.signal.aborted ||
            id !== consultaId.current ||
            !activo.current
          ) {
            return;
          }

          if (
            Array.isArray(locales) &&
            locales.length > 0
          ) {
            const adaptadas =
              locales.map(
                adaptarActividadLocal
              );

            const recordatoriosLocales =
              generarRecordatoriosAcademicos(
                adaptadas
              );

            localesDisponibles = true;

            setRecordatorios(
              recordatoriosLocales
            );

            setFuente('sqlite');
            setCargando(false);
          }
        } catch (errorLocal) {
          console.log(
            'No se pudo consultar SQLite:',
            errorLocal.message
          );
        }

        // 2. Intentar actualizar con servidor.
        const actividades =
          await solicitarActividades({
            apiUrl,
            accessToken,
            signal: controller.signal,
          });

        if (
          controller.signal.aborted ||
          id !== consultaId.current ||
          !activo.current
        ) {
          return;
        }

        const nuevosRecordatorios =
          generarRecordatoriosAcademicos(
            actividades
          );

        setRecordatorios(
          nuevosRecordatorios
        );

        setFuente('servidor');
        setMensaje('');
      } catch (error) {
        if (
          id !== consultaId.current ||
          !activo.current
        ) {
          return;
        }

        if (
          error.status === 401 ||
          error.status === 403
        ) {
          setRecordatorios([]);
          setFuente(null);
          setMensaje(
            'Tu sesión no está autorizada. Inicia sesión nuevamente.'
          );
        } else if (localesDisponibles) {
          setFuente('sqlite');
          setMensaje(
            'Mostrando la última información guardada en este dispositivo.'
          );
        } else {
          setRecordatorios([]);
          setFuente(null);
          setMensaje(
            'No se encontraron datos disponibles. Conéctate a internet para actualizar.'
          );
        }
      } finally {
        if (
          id === consultaId.current &&
          activo.current
        ) {
          setCargando(false);
          setActualizando(false);
          controllerRef.current = null;
        }
      }
    },
    [
      usuarioId,
      accessToken,
      apiUrl,
    ]
  );

  useEffect(() => {
    activo.current = true;

    const temporizador = setTimeout(() => {
      cargarRecordatorios();
    }, 0);

    return () => {
      clearTimeout(temporizador);
      activo.current = false;
      consultaId.current += 1;

      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [cargarRecordatorios]);

  const resumen =
    resumirRecordatoriosAcademicos(
      recordatorios
    );

  const visibles = mostrarTodos
    ? recordatorios
    : recordatorios.slice(0, 3);

  const hayRecordatorios =
    recordatorios.length > 0;

  return (
    <View style={styles.contenedor}>
      {/* CABECERA PREMIUM */}

      <View style={styles.cabecera}>
        <View style={styles.cabeceraFila}>
          <View style={styles.iconoPrincipal}>
            <MaterialCommunityIcons
              name="bell-ring-outline"
              size={25}
              color={COLORES.celeste}
            />
          </View>

          <View style={styles.cabeceraTexto}>
            <Text style={styles.etiquetaSuperior}>
              CENTRO ACADÉMICO
            </Text>

            <Text style={styles.tituloPrincipal}>
              Mis recordatorios
            </Text>

            <Text style={styles.subtituloPrincipal}>
              Organiza tus pendientes y cumple tus metas.
            </Text>
          </View>
        </View>

        <View style={styles.cabeceraSeparador}/>

        <View style={styles.estadisticasFila}>
          <Estadistica
            cantidad={resumen.vencidas}
            titulo="Vencidas"
            icono="alert-circle-outline"
            color="#FFB4B4"
          />

          <Estadistica
            cantidad={resumen.proximas}
            titulo="Próximas"
            icono="clock-outline"
            color="#FFE092"
          />

          <Estadistica
            cantidad={resumen.examenesProximos}
            titulo="Exámenes"
            icono="school-outline"
            color="#A6E2FF"
          />
        </View>
      </View>

      {/* INFORMACIÓN DE SINCRONIZACIÓN */}

      <View style={styles.estadoConexionFila}>
        <View style={styles.estadoConexion}>
          <View
            style={[
              styles.puntoConexion,
              {
                backgroundColor:
                  fuente === 'servidor'
                    ? COLORES.verde
                    : fuente === 'sqlite'
                      ? COLORES.naranja
                      : '#A8B4C2',
              },
            ]}
          />

          <Text style={styles.estadoConexionTexto}>
            {fuente === 'servidor'
              ? 'Información actualizada'
              : fuente === 'sqlite'
                ? 'Información guardada · SQLite'
                : 'Sin datos sincronizados'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actualizarBoton}
          onPress={() =>
            cargarRecordatorios(true)
          }
          disabled={actualizando || cargando}
          accessibilityRole="button"
        >
          {actualizando ? (
            <ActivityIndicator
              size="small"
              color={COLORES.azul}
            />
          ) : (
            <>
              <Ionicons
                name="refresh-outline"
                size={16}
                color={COLORES.azul}
              />

              <Text style={styles.actualizarTexto}>
                Actualizar
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* MENSAJES */}

      {fuente === 'sqlite' && (
        <View style={styles.avisoLocal}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={COLORES.naranja}
          />

          <Text style={styles.avisoLocalTexto}>
            Estos recordatorios se calculan con
            datos guardados anteriormente.
            Pueden existir cambios sin sincronizar.
          </Text>
        </View>
      )}

      {mensaje ? (
        <View style={styles.mensajeCaja}>
          <Text style={styles.mensajeTexto}>
            {mensaje}
          </Text>
        </View>
      ) : null}

      {/* LISTADO */}

      <View style={styles.seccionEncabezado}>
        <View style={styles.seccionTituloFila}>
          <MaterialCommunityIcons
            name="clipboard-text-clock-outline"
            size={21}
            color={COLORES.azulOscuro}
          />

          <Text style={styles.seccionTitulo}>
            Requieren tu atención
          </Text>
        </View>

        {hayRecordatorios && (
          <View style={styles.contador}>
            <Text style={styles.contadorTexto}>
              {recordatorios.length}
            </Text>
          </View>
        )}
      </View>

      {cargando && !fuente ? (
        <View style={styles.cargandoCaja}>
          <ActivityIndicator
            size="large"
            color={COLORES.azul}
          />

          <Text style={styles.cargandoTexto}>
            Consultando tus recordatorios...
          </Text>
        </View>
      ) : hayRecordatorios ? (
        <>
          {visibles.map((recordatorio) => (
            <TarjetaRecordatorio
              key={recordatorio.id}
              recordatorio={recordatorio}
              onPress={onViewActivities}
            />
          ))}

          {recordatorios.length > 3 && (
            <TouchableOpacity
              style={styles.verMasBoton}
              onPress={() =>
                setMostrarTodos(
                  (anterior) => !anterior
                )
              }
              accessibilityRole="button"
            >
              <Text style={styles.verMasTexto}>
                {mostrarTodos
                  ? 'Mostrar menos'
                  : `Ver los ${recordatorios.length} recordatorios`}
              </Text>

              <Ionicons
                name={
                  mostrarTodos
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={16}
                color={COLORES.azul}
              />
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={styles.vacioCaja}>
          <View style={styles.vacioIcono}>
            <MaterialCommunityIcons
              name={
                fuente
                  ? 'check-circle-outline'
                  : 'cloud-off-outline'
              }
              size={31}
              color={
                fuente
                  ? COLORES.verde
                  : COLORES.secundario
              }
            />
          </View>

          <Text style={styles.vacioTitulo}>
            {fuente
              ? '¡Estás al día!'
              : 'Sin información disponible'}
          </Text>

          <Text style={styles.vacioDescripcion}>
            {fuente
              ? 'No encontramos actividades pendientes que requieran un recordatorio en la información consultada.'
              : 'Conéctate a internet para descargar tus actividades y consultar los recordatorios.'}
          </Text>
        </View>
      )}

      {/* BOTÓN PRINCIPAL */}

      {typeof onViewActivities === 'function' && (
        <TouchableOpacity
          style={styles.botonPrincipal}
          activeOpacity={0.85}
          onPress={onViewActivities}
          accessibilityRole="button"
        >
          <View style={styles.botonPrincipalIcono}>
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={19}
              color={COLORES.blanco}
            />
          </View>

          <Text style={styles.botonPrincipalTexto}>
            Ver todas mis actividades
          </Text>

          <Ionicons
            name="arrow-forward"
            size={19}
            color={COLORES.blanco}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ================================================
// ESTILOS
// ================================================

const styles = StyleSheet.create({
  contenedor: {
    marginBottom: 18,
  },

  cabecera: {
    backgroundColor: COLORES.azulOscuro,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#102B4B',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },

  cabeceraFila: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconoPrincipal: {
    width: 51,
    height: 51,
    borderRadius: 16,
    backgroundColor: '#224768',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cabeceraTexto: {
    flex: 1,
  },

  etiquetaSuperior: {
    color: '#9EC5DF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },

  tituloPrincipal: {
    color: COLORES.blanco,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },

  subtituloPrincipal: {
    marginTop: 4,
    color: '#C3D9E9',
    fontSize: 11.5,
    lineHeight: 17,
  },

  cabeceraSeparador: {
    height: 1,
    backgroundColor: '#2A4C6D',
    marginTop: 17,
    marginBottom: 15,
  },

  estadisticasFila: {
    flexDirection: 'row',
    gap: 9,
  },

  estadistica: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#214462',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 5,
    alignItems: 'center',
  },

  estadisticaArriba: {
    marginBottom: 7,
  },

  estadisticaNumero: {
    color: COLORES.blanco,
    fontSize: 25,
    fontWeight: '900',
  },

  estadisticaTitulo: {
    color: '#D3E5F1',
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },

  estadoConexionFila: {
    marginTop: 17,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  estadoConexion: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  puntoConexion: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  estadoConexionTexto: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORES.secundario,
  },

  actualizarBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
  },

  actualizarTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORES.azul,
  },

  avisoLocal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORES.naranjaFondo,
    marginBottom: 13,
  },

  avisoLocalTexto: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: '#805D20',
  },

  mensajeCaja: {
    backgroundColor: '#F0F4F9',
    borderRadius: 11,
    padding: 12,
    marginBottom: 13,
  },

  mensajeTexto: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORES.secundario,
  },

  seccionEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  seccionTituloFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  seccionTitulo: {
    color: COLORES.texto,
    fontSize: 16,
    fontWeight: '900',
    flexShrink: 1,
  },

  contador: {
    minWidth: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: COLORES.azulClaro,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  contadorTexto: {
    color: COLORES.azul,
    fontSize: 12,
    fontWeight: '900',
  },

  recordatorioCard: {
    backgroundColor: COLORES.blanco,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderLeftWidth: 4,
    padding: 15,
    marginBottom: 10,
  },

  recordatorioSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  estadoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },

  estadoTexto: {
    fontSize: 10,
    fontWeight: '800',
  },

  recordatorioTitulo: {
    color: COLORES.texto,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    marginBottom: 10,
  },

  materiaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  materiaTexto: {
    flex: 1,
    color: COLORES.secundario,
    fontSize: 12,
    fontWeight: '600',
  },

  recordatorioInferior: {
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
    marginTop: 13,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  fechaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  fechaTexto: {
    color: COLORES.secundario,
    fontSize: 11,
  },

  diasTexto: {
    color: COLORES.naranja,
    fontSize: 11,
    fontWeight: '800',
  },

  vencidaTexto: {
    color: COLORES.rojo,
    fontSize: 11,
    fontWeight: '800',
  },

  verMasBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginBottom: 12,
  },

  verMasTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORES.azul,
  },

  cargandoCaja: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.blanco,
    borderRadius: 15,
    padding: 30,
    marginBottom: 12,
  },

  cargandoTexto: {
    color: COLORES.secundario,
    fontSize: 12,
    marginTop: 12,
  },

  vacioCaja: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 16,
    paddingVertical: 25,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 12,
  },

  vacioIcono: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORES.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  vacioTitulo: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORES.texto,
    textAlign: 'center',
  },

  vacioDescripcion: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    color: COLORES.secundario,
    textAlign: 'center',
  },

  botonPrincipal: {
    backgroundColor: COLORES.azul,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: COLORES.azul,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 7,
  },

  botonPrincipalIcono: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  botonPrincipalTexto: {
    flex: 1,
    color: COLORES.blanco,
    fontSize: 13,
    fontWeight: '800',
  },
});
