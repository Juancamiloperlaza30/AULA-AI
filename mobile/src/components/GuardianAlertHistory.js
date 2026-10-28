
import React, {
  useCallback,
  useEffect,
  useMemo,
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

// ======================================================
// AULA-AI | HU-08 | PASO 47
// HISTORIAL ACADÉMICO - DISEÑO MEJORADO
//
// - Línea de tiempo compacta.
// - Filtros por tipo de evento.
// - Variación real de calificaciones.
// - Detalles desplegables.
// - Consulta autenticada.
// - Paginación.
// - Control de solicitudes simultáneas.
// - Exclusivamente lectura.
// ======================================================

const C = {
  blanco: '#FFFFFF',
  fondo: '#F4F7FB',
  azul: '#123B73',
  azulOscuro: '#091D3A',
  azulSuave: '#EAF3FC',
  texto: '#263B53',
  gris: '#718096',
  borde: '#DFE7F0',
  verde: '#21845B',
  verdeSuave: '#EAF7EF',
  rojo: '#A52A22',
  rojoSuave: '#FFF4F2',
  amarillo: '#B7791F',
  amarilloSuave: '#FFF5DF',
};

const LIMITE = 20;

const FILTROS = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'resuelta', nombre: 'Recuperaciones' },
  { id: 'reabierta', nombre: 'Reaperturas' },
];

// ======================================================
// FUNCIONES DE PRESENTACIÓN
// ======================================================

function numeroSeguro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function notaTexto(valor) {
  const numero = numeroSeguro(valor);

  return numero === null
    ? '—'
    : numero.toFixed(2);
}

function fechaTexto(valor) {
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

function estadoTexto(estado) {
  const opciones = {
    activa: 'Activa',
    en_seguimiento: 'En seguimiento',
    resuelta: 'Resuelta',
  };

  return opciones[estado] || 'Sin registro';
}

function presentacionEvento(registro) {
  switch (registro.tipoEvento) {
    case 'resuelta':
      return {
        titulo: 'Situación resuelta',
        subtitulo: 'La condición de alerta fue superada',
        simbolo: '✓',
        color: C.verde,
        fondo: C.verdeSuave,
      };

    case 'reabierta':
      return {
        titulo: 'Alerta reabierta',
        subtitulo: 'La condición requiere atención nuevamente',
        simbolo: '!',
        color: C.rojo,
        fondo: C.rojoSuave,
      };

    case 'creada':
      return {
        titulo: 'Alerta generada',
        subtitulo: 'Se identificó una situación académica',
        simbolo: '!',
        color: C.rojo,
        fondo: C.rojoSuave,
      };

    default:
      return {
        titulo: 'Seguimiento actualizado',
        subtitulo: 'Se registró un cambio académico',
        simbolo: '↻',
        color: C.azul,
        fondo: C.azulSuave,
      };
  }
}

function obtenerVariacion(registro) {
  const anterior = numeroSeguro(
    registro.promedioAnterior
  );

  const nuevo = numeroSeguro(
    registro.promedioNuevo
  );

  if (anterior === null || nuevo === null) {
    return null;
  }

  const diferencia = nuevo - anterior;

  if (Math.abs(diferencia) < 0.005) {
    return {
      texto: 'Sin variación',
      color: C.gris,
      fondo: C.fondo,
      tendencia: 'igual',
    };
  }

  if (diferencia > 0) {
    return {
      texto: `+${diferencia.toFixed(2)}`,
      color: C.verde,
      fondo: C.verdeSuave,
      tendencia: 'subio',
    };
  }

  return {
    texto: diferencia.toFixed(2),
    color: C.rojo,
    fondo: C.rojoSuave,
    tendencia: 'bajo',
  };
}

// ======================================================
// ELEMENTOS VISUALES REUTILIZABLES
// ======================================================

function Etiqueta({
  texto,
  color = C.azul,
  fondo = C.azulSuave,
}) {
  return (
    <View
      style={[
        styles.etiqueta,
        { backgroundColor: fondo },
      ]}
    >
      <Text
        style={[
          styles.etiquetaTexto,
          { color },
        ]}
      >
        {texto}
      </Text>
    </View>
  );
}

function EstadoVacio({
  titulo,
  descripcion,
  error = false,
}) {
  return (
    <View style={styles.estadoVacio}>
      <Text
        style={[
          styles.estadoVacioTitulo,
          error && { color: C.rojo },
        ]}
      >
        {titulo}
      </Text>

      <Text style={styles.estadoVacioTexto}>
        {descripcion}
      </Text>
    </View>
  );
}

// ======================================================
// TARJETA DE EVENTO
// ======================================================

function EventoCard({
  registro,
  expandido,
  onToggle,
  ultimo,
}) {
  const estiloEvento = presentacionEvento(
    registro
  );

  const variacion = obtenerVariacion(
    registro
  );

  const notaAnterior = numeroSeguro(
    registro.promedioAnterior
  );

  const notaNueva = numeroSeguro(
    registro.promedioNuevo
  );

  const tienePromedios =
    notaAnterior !== null ||
    notaNueva !== null;

  const materia =
    registro.materia ||
    registro.detallesNuevos?.materia ||
    registro.detallesAnteriores?.materia ||
    'Evento académico';

  return (
    <View style={styles.eventoFila}>
      {/* Indicador de la línea de tiempo */}

      <View style={styles.lineaColumna}>
        <View
          style={[
            styles.eventoCirculo,
            {
              backgroundColor:
                estiloEvento.fondo,
              borderColor: estiloEvento.color,
            },
          ]}
        >
          <Text
            style={[
              styles.eventoSimbolo,
              { color: estiloEvento.color },
            ]}
          >
            {estiloEvento.simbolo}
          </Text>
        </View>

        {!ultimo && (
          <View style={styles.lineaVertical} />
        )}
      </View>

      {/* Contenido del evento */}

      <View style={styles.eventoContenido}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={
            `${expandido ? 'Ocultar' : 'Ver'} detalles de ` +
            estiloEvento.titulo
          }
          accessibilityState={{
            expanded: expandido,
          }}
          style={styles.tarjeta}
        >
          <View style={styles.tarjetaSuperior}>
            <View style={styles.tituloFlexible}>
              <Text style={styles.eventoTitulo}>
                {estiloEvento.titulo}
              </Text>

              <Text style={styles.fecha}>
                {fechaTexto(registro.fecha)}
              </Text>
            </View>

            <Text
              style={[
                styles.expandirIcono,
                expandido && {
                  color: C.azul,
                },
              ]}
            >
              {expandido ? '−' : '+'}
            </Text>
          </View>

          <Text style={styles.materia}>
            {materia}
          </Text>

          <Text style={styles.eventoSubtitulo}>
            {estiloEvento.subtitulo}
          </Text>

          {tienePromedios && (
            <View style={styles.resumenPromedios}>
              <View style={styles.notasEnLinea}>
                <Text style={styles.notaAnterior}>
                  {notaTexto(notaAnterior)}
                </Text>

                <Text style={styles.flecha}>
                  →
                </Text>

                <Text
                  style={[
                    styles.notaNueva,
                    {
                      color:
                        notaNueva === null
                          ? C.gris
                          : notaNueva < 3
                          ? C.rojo
                          : notaNueva < 3.5
                          ? C.amarillo
                          : C.verde,
                    },
                  ]}
                >
                  {notaTexto(notaNueva)}
                </Text>
              </View>

              {variacion && (
                <Etiqueta
                  texto={variacion.texto}
                  color={variacion.color}
                  fondo={variacion.fondo}
                />
              )}
            </View>
          )}

          {expandido && (
            <View style={styles.detalles}>
              <Text style={styles.detallesTitulo}>
                Detalles del cambio
              </Text>

              {registro.periodoId != null && (
                <View style={styles.detalleFila}>
                  <Text style={styles.detalleNombre}>
                    Período académico
                  </Text>

                  <Text style={styles.detalleValor}>
                    {registro.periodoId}
                  </Text>
                </View>
              )}

              <View style={styles.detalleFila}>
                <Text style={styles.detalleNombre}>
                  Estado anterior
                </Text>

                <Text style={styles.detalleValor}>
                  {registro.estadoAnterior
                    ? estadoTexto(
                        registro.estadoAnterior
                      )
                    : 'Sin estado previo'}
                </Text>
              </View>

              <View style={styles.detalleFila}>
                <Text style={styles.detalleNombre}>
                  Nuevo estado
                </Text>

                <Text
                  style={[
                    styles.detalleValor,
                    {
                      color:
                        estiloEvento.color,
                    },
                  ]}
                >
                  {estadoTexto(
                    registro.estadoNuevo
                  )}
                </Text>
              </View>

              {registro.descripcion ? (
                <View style={styles.descripcionCaja}>
                  <Text style={styles.descripcionDetalle}>
                    {registro.descripcion}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.detallesPie}>
                Registro histórico de AULA-AI
              </Text>
            </View>
          )}

          <View style={styles.tarjetaPie}>
            <Text style={styles.verDetalle}>
              {expandido
                ? 'Ocultar detalles'
                : 'Ver detalles'}
            </Text>

            <Text style={styles.verDetalle}>
              {expandido ? '⌃' : '⌄'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function GuardianAlertHistory({
  apiUrl,
  accessToken,
  estudiante,
}) {
  const estudianteId = estudiante?.id;

  const [filtro, setFiltro] =
    useState('todos');

  const [historial, setHistorial] =
    useState([]);

  const [expandidoId, setExpandidoId] =
    useState(null);

  const [pagina, setPagina] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [tieneSiguiente, setTieneSiguiente] =
    useState(false);

  const [cargando, setCargando] =
    useState(false);

  const [cargandoMas, setCargandoMas] =
    useState(false);

  const [error, setError] =
    useState('');

  const abortRef = useRef(null);
  const versionRef = useRef(0);

  const base = useMemo(() => {
    return typeof apiUrl === 'string'
      ? apiUrl.trim().replace(/\/+$/, '')
      : '';
  }, [apiUrl]);

  // ====================================================
  // CONSULTAS
  // ====================================================

  const cancelarConsulta = useCallback(() => {
    versionRef.current += 1;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    abortRef.current = null;
  }, []);

  const consultarHistorial = useCallback(
    async ({
      nuevaPagina = 1,
      agregar = false,
    } = {}) => {
      cancelarConsulta();

      const controller =
        new AbortController();

      const version =
        versionRef.current;

      abortRef.current = controller;

      if (agregar) {
        setCargandoMas(true);
      } else {
        setCargando(true);
        setHistorial([]);
        setPagina(1);
        setTotal(0);
        setTieneSiguiente(false);
        setExpandidoId(null);
      }

      setError('');

      try {
        if (
          !base ||
          !accessToken ||
          !estudianteId
        ) {
          throw new Error(
            'No hay una sesión válida para consultar el historial.'
          );
        }

        const ruta =
          `${base}/api/guardian/estudiantes/` +
          `${encodeURIComponent(estudianteId)}` +
          '/alertas/historial';

        const parametros = [
          `pagina=${nuevaPagina}`,
          `limite=${LIMITE}`,
        ];

        if (filtro !== 'todos') {
          parametros.push(
            `evento=${encodeURIComponent(filtro)}`
          );
        }

        const respuesta = await fetch(
          `${ruta}?${parametros.join('&')}`,
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            signal: controller.signal,
          }
        );

        let datos;

        try {
          datos = await respuesta.json();
        } catch {
          throw new Error(
            'El servidor devolvió una respuesta no válida.'
          );
        }

        if (
          !respuesta.ok ||
          datos?.success !== true
        ) {
          throw new Error(
            respuesta.status === 401 ||
            respuesta.status === 403
              ? 'No tienes autorización para consultar este historial.'
              : datos?.message ||
                'No fue posible consultar el historial.'
          );
        }

        if (
          datos.estudiante?.id !== estudianteId ||
          !Array.isArray(datos.historial)
        ) {
          throw new Error(
            'La información recibida no corresponde al estudiante seleccionado.'
          );
        }

        if (
          controller.signal.aborted ||
          version !== versionRef.current
        ) {
          return;
        }

        setHistorial((anteriores) => {
          if (!agregar) {
            return datos.historial;
          }

          const ids = new Set(
            anteriores.map(
              (registro) => String(registro.id)
            )
          );

          return [
            ...anteriores,
            ...datos.historial.filter(
              (registro) =>
                !ids.has(
                  String(registro.id)
                )
            ),
          ];
        });

        setPagina(nuevaPagina);

        setTotal(
          Number(datos.paginacion?.total) || 0
        );

        setTieneSiguiente(
          datos.paginacion?.tieneSiguiente === true
        );
      } catch (err) {
        if (
          controller.signal.aborted ||
          version !== versionRef.current ||
          err?.name === 'AbortError'
        ) {
          return;
        }

        setError(
          err?.message ||
          'Ocurrió un error al consultar el historial.'
        );
      } finally {
        if (
          version === versionRef.current
        ) {
          setCargando(false);
          setCargandoMas(false);
        }
      }
    },
    [
      base,
      accessToken,
      estudianteId,
      filtro,
      cancelarConsulta,
    ]
  );

  useEffect(() => {
    consultarHistorial();

    return () => {
      cancelarConsulta();
    };
  }, [
    consultarHistorial,
    cancelarConsulta,
  ]);

  // ====================================================
  // INTERFAZ
  // ====================================================

  if (!estudianteId) {
    return null;
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <View style={styles.encabezadoTextos}>
          <Text style={styles.titulo}>
            Evolución de alertas
          </Text>

          <Text style={styles.descripcion}>
            Consulta los cambios importantes
            en el seguimiento académico.
          </Text>
        </View>
      </View>

      <View style={styles.panelResumen}>
        <View style={styles.resumenIzquierda}>
          <Text style={styles.resumenNumero}>
            {total}
          </Text>

          <Text style={styles.resumenTexto}>
            {total === 1
              ? 'evento registrado'
              : 'eventos registrados'}
          </Text>
        </View>

        <View style={styles.resumenDerecha}>
          <Text style={styles.resumenAyuda}>
            Historial académico
          </Text>

          <Text style={styles.resumenAyudaDos}>
            Del más reciente al más antiguo
          </Text>
        </View>
      </View>

      <View style={styles.filtros}>
        {FILTROS.map((opcion) => {
          const activo =
            filtro === opcion.id;

          return (
            <TouchableOpacity
              key={opcion.id}
              style={[
                styles.filtro,
                activo &&
                  styles.filtroActivo,
              ]}
              onPress={() =>
                setFiltro(opcion.id)
              }
              accessibilityRole="button"
              accessibilityState={{
                selected: activo,
              }}
            >
              <Text
                style={[
                  styles.filtroTexto,
                  activo &&
                    styles.filtroTextoActivo,
                ]}
              >
                {opcion.nombre}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {cargando ? (
        <View style={styles.cargando}>
          <ActivityIndicator
            size="large"
            color={C.azul}
          />

          <Text style={styles.textoAuxiliar}>
            Cargando evolución académica...
          </Text>
        </View>
      ) : error && historial.length === 0 ? (
        <EstadoVacio
          titulo="No fue posible cargar el historial"
          descripcion={error}
          error
        />
      ) : (
        <>
          {historial.length === 0 ? (
            <EstadoVacio
              titulo="Sin eventos registrados"
              descripcion={
                filtro === 'todos'
                  ? 'Todavía no hay cambios históricos registrados para este estudiante.'
                  : 'No hay eventos para el filtro seleccionado.'
              }
            />
          ) : (
            <View style={styles.lineaTiempo}>
              {historial.map(
                (registro, index) => (
                  <EventoCard
                    key={String(registro.id)}
                    registro={registro}
                    ultimo={
                      index ===
                      historial.length - 1
                    }
                    expandido={
                      expandidoId ===
                      registro.id
                    }
                    onToggle={() => {
                      setExpandidoId(
                        expandidoId ===
                          registro.id
                          ? null
                          : registro.id
                      );
                    }}
                  />
                )
              )}
            </View>
          )}

          {tieneSiguiente && (
            <TouchableOpacity
              style={styles.botonMas}
              disabled={cargandoMas}
              onPress={() =>
                consultarHistorial({
                  nuevaPagina: pagina + 1,
                  agregar: true,
                })
              }
            >
              {cargandoMas ? (
                <ActivityIndicator
                  color={C.azul}
                />
              ) : (
                <Text style={styles.botonMasTexto}>
                  Cargar eventos anteriores
                </Text>
              )}
            </TouchableOpacity>
          )}

          {!!error &&
            historial.length > 0 && (
              <Text style={styles.errorTexto}>
                {error}
              </Text>
            )}
        </>
      )}

      <TouchableOpacity
        style={styles.botonActualizar}
        disabled={cargando || cargandoMas}
        onPress={() =>
          consultarHistorial({
            nuevaPagina: 1,
          })
        }
      >
        <Text style={styles.botonActualizarTexto}>
          ↻  Actualizar historial
        </Text>
      </TouchableOpacity>

      <View style={styles.notaCaja}>
        <Text style={styles.nota}>
          Este historial conserva los cambios
          de las alertas desde que se activó
          su registro en AULA-AI. Las
          calificaciones actuales se consultan
          en la sección de rendimiento académico.
        </Text>
      </View>
    </View>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  contenedor: {
    width: '100%',
    marginTop: 27,
  },

  encabezado: {
    marginBottom: 16,
  },

  encabezadoTextos: {
    flex: 1,
  },

  titulo: {
    fontSize: 21,
    fontWeight: '800',
    color: C.azulOscuro,
  },

  descripcion: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: C.gris,
  },

  panelResumen: {
    backgroundColor: C.azulOscuro,
    borderRadius: 19,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    borderBottomWidth: 3,
    borderBottomColor: '#27C4E8',
    shadowColor: C.azulOscuro,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },

  resumenIzquierda: {
    flex: 1,
  },

  resumenNumero: {
    color: C.blanco,
    fontSize: 29,
    fontWeight: '800',
  },

  resumenTexto: {
    color: '#D5E5F4',
    fontSize: 11,
    marginTop: 3,
  },

  resumenDerecha: {
    flex: 1,
    alignItems: 'flex-end',
  },

  resumenAyuda: {
    color: C.blanco,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },

  resumenAyudaDos: {
    color: '#BDD0E1',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'right',
    marginTop: 4,
  },

  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 20,
  },

  filtro: {
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 11,
    backgroundColor: C.blanco,
  },

  filtroActivo: {
    backgroundColor: C.azul,
    borderColor: C.azul,
  },

  filtroTexto: {
    color: C.azul,
    fontSize: 11,
    fontWeight: '800',
  },

  filtroTextoActivo: {
    color: C.blanco,
  },

  lineaTiempo: {
    width: '100%',
  },

  eventoFila: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 9,
  },

  lineaColumna: {
    width: 29,
    alignItems: 'center',
  },

  eventoCirculo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },

  eventoSimbolo: {
    fontSize: 13,
    fontWeight: '900',
  },

  lineaVertical: {
    width: 2,
    flex: 1,
    backgroundColor: C.borde,
    marginTop: 5,
    marginBottom: 5,
  },

  eventoContenido: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 13,
  },

  tarjeta: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 17,
    padding: 15,
    shadowColor: C.azulOscuro,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },

  tarjetaSuperior: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },

  tituloFlexible: {
    flex: 1,
  },

  eventoTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: C.azulOscuro,
  },

  fecha: {
    fontSize: 10,
    color: C.gris,
    marginTop: 5,
    lineHeight: 16,
  },

  expandirIcono: {
    color: C.azul,
    fontSize: 23,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
    width: 25,
  },

  materia: {
    fontSize: 14,
    fontWeight: '800',
    color: C.texto,
    marginTop: 15,
  },

  eventoSubtitulo: {
    fontSize: 11,
    color: C.gris,
    marginTop: 4,
    lineHeight: 17,
  },

  resumenPromedios: {
    backgroundColor: C.fondo,
    borderRadius: 12,
    marginTop: 13,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },

  notasEnLinea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  notaAnterior: {
    fontSize: 19,
    fontWeight: '800',
    color: C.azulOscuro,
  },

  notaNueva: {
    fontSize: 19,
    fontWeight: '800',
  },

  flecha: {
    fontSize: 18,
    color: C.gris,
  },

  etiqueta: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  etiquetaTexto: {
    fontSize: 11,
    fontWeight: '800',
  },

  detalles: {
    borderTopWidth: 1,
    borderTopColor: C.borde,
    marginTop: 15,
    paddingTop: 14,
  },

  detallesTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: C.azulOscuro,
    marginBottom: 12,
  },

  detalleFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },

  detalleNombre: {
    flex: 1,
    fontSize: 11,
    color: C.gris,
  },

  detalleValor: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: C.texto,
    textAlign: 'right',
  },

  descripcionCaja: {
    backgroundColor: C.fondo,
    borderRadius: 10,
    padding: 12,
    marginTop: 5,
  },

  descripcionDetalle: {
    fontSize: 11,
    color: C.texto,
    lineHeight: 18,
  },

  detallesPie: {
    fontSize: 10,
    color: C.gris,
    marginTop: 12,
  },

  tarjetaPie: {
    borderTopWidth: 1,
    borderTopColor: C.borde,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 11,
  },

  verDetalle: {
    color: C.azul,
    fontSize: 11,
    fontWeight: '800',
  },

  cargando: {
    alignItems: 'center',
    paddingVertical: 35,
  },

  textoAuxiliar: {
    fontSize: 12,
    color: C.gris,
    marginTop: 10,
  },

  estadoVacio: {
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 14,
    padding: 22,
    backgroundColor: C.blanco,
    alignItems: 'center',
  },

  estadoVacioTitulo: {
    fontSize: 14,
    color: C.azulOscuro,
    fontWeight: '800',
    textAlign: 'center',
  },

  estadoVacioTexto: {
    fontSize: 12,
    color: C.gris,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 9,
  },

  botonMas: {
    borderWidth: 1,
    borderColor: C.azul,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 7,
  },

  botonMasTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: C.azul,
  },

  botonActualizar: {
    backgroundColor: C.azul,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 12,
  },

  botonActualizarTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: C.blanco,
  },

  errorTexto: {
    color: C.rojo,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },

  notaCaja: {
    backgroundColor: C.fondo,
    borderRadius: 12,
    padding: 13,
    marginTop: 13,
  },

  nota: {
    color: C.gris,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
});
