
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  guardarHistorialEstudianteOffline,
  obtenerHistorialEstudianteOffline,
} from '../database/studentAcademicOfflineDatabase';

const LIMITE_ESPERA_MS = 8000;

const RESUMEN_VACIO = {
  totalRegistros: 0,
  presentes: 0,
  ausentes: 0,
  llegadasTarde: 0,
};

const ESTADOS = {
  presente: {
    nombre: 'Presente',
    fondo: '#E7F5EC',
    color: '#166534',
  },
  ausente: {
    nombre: 'Ausente',
    fondo: '#FDECEC',
    color: '#B42318',
  },
  tarde: {
    nombre: 'Llegada tarde',
    fondo: '#FFF3DC',
    color: '#9A6700',
  },
};

function formatearFecha(fecha) {
  if (!fecha) return 'No disponible';

  const partes = String(fecha)
    .slice(0, 10)
    .split('-');

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : String(fecha);
}

function formatearActualizacion(fecha) {
  if (!fecha) return 'No disponible';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'No disponible';
  }

  return valor.toLocaleString('es-CO');
}

function normalizarResumen(resumen) {
  return {
    totalRegistros:
      Number(resumen?.totalRegistros) || 0,
    presentes:
      Number(resumen?.presentes) || 0,
    ausentes:
      Number(resumen?.ausentes) || 0,
    llegadasTarde:
      Number(resumen?.llegadasTarde) || 0,
  };
}

export default function StudentAttendanceScreen({
  apiUrl,
  accessToken,
  usuarioId,
  onBack,
}) {
  const [historial, setHistorial] = useState([]);
  const [resumen, setResumen] =
    useState(RESUMEN_VACIO);

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] =
    useState(false);

  const [origen, setOrigen] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] =
    useState(null);

  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const activoRef = useRef(false);
  const peticionRef = useRef(null);
  const enCursoRef = useRef(false);

  const aplicarDatos = useCallback(
    (datos, fuente, fecha) => {
      if (!activoRef.current) return;

      setHistorial(
        Array.isArray(datos.asistencias)
          ? datos.asistencias
          : []
      );

      setResumen(
        normalizarResumen(datos.resumen)
      );

      setOrigen(fuente);
      setUltimaActualizacion(fecha || null);
    },
    []
  );

  const consultarAsistencias = useCallback(
    async (primeraCarga = false) => {
      if (enCursoRef.current) return;

      enCursoRef.current = true;

      const controller = new AbortController();
      peticionRef.current = controller;

      let temporizador = null;
      let copiaLocal = null;

      if (activoRef.current) {
        setError('');
        setAviso('');

        if (primeraCarga) {
          setCargando(true);
        } else {
          setActualizando(true);
        }
      }

      try {
        if (!usuarioId || !accessToken || !apiUrl) {
          throw new Error(
            'No hay una sesión válida para consultar la asistencia.'
          );
        }

        // Primero recuperar SQLite.
        try {
          copiaLocal =
            await obtenerHistorialEstudianteOffline(
              usuarioId
            );

          if (controller.signal.aborted) return;

          if (copiaLocal) {
            aplicarDatos(
              copiaLocal,
              'sqlite',
              copiaLocal.actualizadoEn
            );

            // Mostrar los datos locales sin esperar
            // a que termine la petición remota.
            if (activoRef.current) {
              setCargando(false);
            }
          }
        } catch (errorSQLite) {
          console.warn(
            'HU-07: no se pudo consultar SQLite:',
            errorSQLite.message
          );
        }

        if (controller.signal.aborted) return;

        // Una petición remota nunca debe esperar
        // indefinidamente cuando no hay conexión.
        const respuestaPromesa = fetch(
          `${apiUrl}/api/attendance/mi-historial`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            signal: controller.signal,
          }
        );

        // Capturar desde el inicio un eventual
        // rechazo tardío de la petición.
        const respuestaControlada =
          respuestaPromesa.then(
            (respuesta) => ({
              tipo: 'respuesta',
              respuesta,
            }),
            (errorFetch) => ({
              tipo: 'error',
              error: errorFetch,
            })
          );

        const tiempoLimite = new Promise(
          (resolve) => {
            temporizador = setTimeout(
              () => resolve({ tipo: 'timeout' }),
              LIMITE_ESPERA_MS
            );
          }
        );

        const resultado = await Promise.race([
          respuestaControlada,
          tiempoLimite,
        ]);

        if (resultado.tipo === 'timeout') {
          controller.abort();

          throw new Error(
            'El servidor no respondió dentro del tiempo permitido.'
          );
        }

        if (resultado.tipo === 'error') {
          throw resultado.error;
        }

        const respuesta = resultado.respuesta;

        if (controller.signal.aborted) return;

        // No mantener visible información local si
        // el servidor rechaza expresamente el acceso.
        if (
          respuesta.status === 401 ||
          respuesta.status === 403
        ) {
          if (activoRef.current) {
            setHistorial([]);
            setResumen(RESUMEN_VACIO);
            setOrigen(null);
            setUltimaActualizacion(null);
          }

          throw new Error(
            respuesta.status === 401
              ? 'Tu sesión no es válida. Inicia sesión nuevamente.'
              : 'No tienes autorización para consultar esta información.'
          );
        }

        if (!respuesta.ok) {
          throw new Error(
            'El servidor no pudo actualizar las asistencias.'
          );
        }

        const datos = await respuesta.json();

        if (controller.signal.aborted) return;

        if (
          datos?.success !== true ||
          !Array.isArray(datos.asistencias) ||
          !datos.resumen
        ) {
          throw new Error(
            'El servidor devolvió información incompleta.'
          );
        }

        // Mostrar los registros oficiales.
        const fechaConsulta =
          new Date().toISOString();

        aplicarDatos(
          datos,
          'servidor',
          fechaConsulta
        );

        // Guardar una nueva copia autorizada.
        try {
          const guardado =
            await guardarHistorialEstudianteOffline({
              usuarioId,
              asistencias: datos.asistencias,
            });

          if (
            activoRef.current &&
            !controller.signal.aborted
          ) {
            setUltimaActualizacion(
              guardado.actualizadoEn
            );
          }
        } catch (errorGuardado) {
          console.warn(
            'HU-07: error guardando copia local:',
            errorGuardado.message
          );

          if (activoRef.current) {
            setAviso(
              'La consulta fue exitosa, pero no se pudo guardar para uso sin conexión.'
            );
          }
        }
      } catch (fallo) {
        if (
          !activoRef.current ||
          (controller.signal.aborted &&
            fallo?.name === 'AbortError' &&
            fallo?.message !==
              'El servidor no respondió dentro del tiempo permitido.')
        ) {
          return;
        }

        const accesoDenegado =
          fallo.message?.includes(
            'Tu sesión no es válida'
          ) ||
          fallo.message?.includes(
            'No tienes autorización'
          );

        if (accesoDenegado) {
          setError(fallo.message);
        } else if (copiaLocal) {
          setAviso(
            'No fue posible conectarse al servidor. Se muestra la última copia guardada en SQLite.'
          );
        } else {
          setError(
            'No hay conexión con el servidor y no existe una copia local disponible. Conéctate a internet para descargar tus asistencias.'
          );
        }
      } finally {
        if (temporizador) {
          clearTimeout(temporizador);
        }

        if (peticionRef.current === controller) {
          peticionRef.current = null;
          enCursoRef.current = false;
        }

        if (activoRef.current) {
          setCargando(false);
          setActualizando(false);
        }
      }
    },
    [
      apiUrl,
      accessToken,
      usuarioId,
      aplicarDatos,
    ]
  );

  // Cargar al abrir la pantalla.
  useEffect(() => {
    activoRef.current = true;

    const temporizador = setTimeout(() => {
      consultarAsistencias(true);
    }, 0);

    return () => {
      activoRef.current = false;
      clearTimeout(temporizador);

      if (peticionRef.current) {
        peticionRef.current.abort();
      }
    };
  }, [consultarAsistencias]);

  // Reintentar al regresar a primer plano.
  useEffect(() => {
    const suscripcion = AppState.addEventListener(
      'change',
      (estado) => {
        if (estado === 'active') {
          consultarAsistencias(false);
        }
      }
    );

    return () => suscripcion.remove();
  }, [consultarAsistencias]);

  const renderizarRegistro = (registro, indice) => {
    const estilo = ESTADOS[registro.estado] || {
      nombre: registro.estado || 'Sin estado',
      fondo: '#EEF2F5',
      color: '#455A64',
    };

    return (
      <View
        key={String(
          registro.asistenciaId ?? indice
        )}
        style={styles.registro}
      >
        <View style={styles.registroCabecera}>
          <Text style={styles.materia}>
            {registro.materia ||
              'Materia no disponible'}
          </Text>

          <View
            style={[
              styles.etiqueta,
              { backgroundColor: estilo.fondo },
            ]}
          >
            <Text
              style={[
                styles.etiquetaTexto,
                { color: estilo.color },
              ]}
            >
              {estilo.nombre}
            </Text>
          </View>
        </View>

        <Text style={styles.detalle}>
          Fecha: {formatearFecha(registro.fecha)}
        </Text>

        <Text style={styles.detalle}>
          Sesión: {registro.numeroSesion ?? '-'}
        </Text>

        {registro.observacion ? (
          <Text style={styles.observacion}>
            Observación: {registro.observacion}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.pantalla}>
      <View style={styles.encabezado}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.botonVolver}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color="#BCECF7"
          />

          <Text style={styles.volverTexto}>
            Volver
          </Text>
        </TouchableOpacity>

        <View style={styles.headerBadge}>
          <Ionicons
            name="school-outline"
            size={13}
            color="#27C4E8"
          />

          <Text style={styles.headerBadgeText}>
            AULA-AI · SEGUIMIENTO
          </Text>
        </View>

        <Text style={styles.titulo}>
          Mi asistencia
        </Text>

        <Text style={styles.subtitulo}>
          Consulta tus registros de asistencia,
          ausencias y llegadas tarde.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contenido}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={() =>
              consultarAsistencias(false)
            }
            colors={['#1F4E79']}
          />
        }
      >
        {cargando && !origen ? (
          <View style={styles.cargando}>
            <ActivityIndicator
              size="large"
              color="#1F4E79"
            />

            <Text style={styles.auxiliar}>
              Consultando tu información...
            </Text>
          </View>
        ) : (
          <>
            {origen && (
              <View style={styles.resumen}>
                <View style={styles.summaryIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color="#FFFFFF"
                  />
                </View>

                <Text style={styles.total}>
                  {resumen.totalRegistros}
                </Text>

                <Text style={styles.totalEtiqueta}>
                  Registros de asistencia
                </Text>

                <View style={styles.estadisticas}>
                  <View style={styles.estadistica}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={19}
                      color="#198754"
                    />

                    <Text style={styles.presentes}>
                      {resumen.presentes}
                    </Text>
                    <Text style={styles.estadisticaTexto}>
                      Presentes
                    </Text>
                  </View>

                  <View style={styles.estadistica}>
                    <Ionicons
                      name="close-circle-outline"
                      size={19}
                      color="#C0392B"
                    />

                    <Text style={styles.ausentes}>
                      {resumen.ausentes}
                    </Text>
                    <Text style={styles.estadisticaTexto}>
                      Ausencias
                    </Text>
                  </View>

                  <View style={styles.estadistica}>
                    <Ionicons
                      name="time-outline"
                      size={19}
                      color="#BB7200"
                    />

                    <Text style={styles.tardes}>
                      {resumen.llegadasTarde}
                    </Text>
                    <Text style={styles.estadisticaTexto}>
                      Llegadas tarde
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {origen && (
              <View
                style={[
                  styles.fuente,
                  origen === 'sqlite' &&
                    styles.fuenteLocal,
                ]}
              >
                <Text style={styles.fuenteTitulo}>
                  {origen === 'sqlite'
                    ? 'Copia local de SQLite — puede estar desactualizada'
                    : 'Información actualizada desde el servidor'}
                </Text>

                <Text style={styles.fuenteFecha}>
                  Última actualización:{' '}
                  {formatearActualizacion(
                    ultimaActualizacion
                  )}
                </Text>
              </View>
            )}

            {aviso ? (
              <View style={styles.aviso}>
                <Text style={styles.avisoTexto}>
                  {aviso}
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.error}>
                <Text style={styles.errorTexto}>
                  {error}
                </Text>

                <TouchableOpacity
                  style={styles.reintentar}
                  onPress={() =>
                    consultarAsistencias(false)
                  }
                >
                  <Text style={styles.reintentarTexto}>
                    Reintentar
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {origen && (
              <>
                <Text style={styles.seccion}>
                  Historial de asistencia
                </Text>

                {historial.length ? (
                  historial.map(renderizarRegistro)
                ) : (
                  <View style={styles.vacio}>
                    <Text style={styles.auxiliar}>
                      No tienes registros de
                      asistencia disponibles.
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  encabezado: {
    backgroundColor: '#091D3A',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 26,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  botonVolver: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 18,
  },

  volverTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },

  headerBadgeText: {
    color: '#AFC4D8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 6,
  },

  titulo: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  subtitulo: {
    color: '#C0D5E9',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 19,
  },

  scroll: {
    flex: 1,
  },
  contenido: {
    padding: 20,
    paddingBottom: 50,
  },
  resumen: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#123B73',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  total: {
    fontSize: 36,
    fontWeight: '900',
    color: '#123B73',
  },

  totalEtiqueta: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '700',
    marginBottom: 18,
  },

  estadisticas: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },

  estadistica: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderRadius: 13,
    paddingVertical: 12,
  },

  presentes: {
    fontSize: 22,
    fontWeight: '900',
    color: '#198754',
    marginTop: 5,
  },

  ausentes: {
    fontSize: 22,
    fontWeight: '900',
    color: '#C0392B',
    marginTop: 5,
  },

  tardes: {
    fontSize: 22,
    fontWeight: '900',
    color: '#BB7200',
    marginTop: 5,
  },

  estadisticaTexto: {
    fontSize: 10,
    color: '#718096',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 5,
  },
  fuente: {
    backgroundColor: '#E8F2FA',
    borderColor: '#C8DDEB',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
  },
  fuenteLocal: {
    backgroundColor: '#FFF3DC',
    borderColor: '#EDD6A5',
  },
  fuenteTitulo: {
    color: '#1F4E79',
    fontWeight: '700',
    fontSize: 13,
  },
  fuenteFecha: {
    color: '#607D8B',
    fontSize: 12,
    marginTop: 5,
  },
  aviso: {
    backgroundColor: '#FFF7E8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
  },
  avisoTexto: {
    color: '#805A19',
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    backgroundColor: '#FFF2F0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 16,
  },
  errorTexto: {
    color: '#B42318',
    fontSize: 13,
    lineHeight: 20,
  },
  reintentar: {
    backgroundColor: '#1F4E79',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  reintentarTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  seccion: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1F4E79',
    marginBottom: 12,
  },
  registro: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    padding: 17,
    marginBottom: 12,
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.035,
    shadowRadius: 7,
    elevation: 1,
  },
  registroCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  materia: {
    flex: 1,
    flexShrink: 1,
    color: '#091D3A',
    fontSize: 14,
    fontWeight: '800',
    marginRight: 8,
  },
  etiqueta: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '48%',
  },
  etiquetaTexto: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  detalle: {
    fontSize: 13,
    color: '#52647A',
    marginTop: 4,
  },
  observacion: {
    fontSize: 13,
    color: '#607D8B',
    marginTop: 10,
    lineHeight: 19,
  },
  cargando: {
    alignItems: 'center',
    paddingVertical: 75,
  },
  auxiliar: {
    color: '#607D8B',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  vacio: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E6ED',
    padding: 25,
  },
});
