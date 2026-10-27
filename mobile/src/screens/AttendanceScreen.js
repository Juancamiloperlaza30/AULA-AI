
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import * as Network from 'expo-network';
import AttendanceSyncButton from
  '../components/AttendanceSyncButton';

import {
  ActivityIndicator,
  Alert as NativeAlert,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  iniciarAsistenciaOffline,
  guardarAsistenciaOffline,
  obtenerAsistenciasOffline,
  obtenerAsignacionesAsistenciaOffline,
  guardarGrupoAsistenciaOffline,
  obtenerGrupoAsistenciaOffline,
  obtenerColaAsistencia,
  encolarAsistenciaOffline,
} from '../database/attendanceOfflineDatabase';

const COLORS = {
  primary: '#1F4E79',
  primaryLight: '#EAF2FA',
  background: '#F5F7FA',
  white: '#FFFFFF',
  text: '#263238',
  muted: '#607D8B',
  border: '#DFE6ED',
  green: '#198754',
  greenLight: '#E7F5EC',
  red: '#C0392B',
  redLight: '#FCECEB',
  orange: '#BB7200',
  orangeLight: '#FFF2D7',
};

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
    const confirmar = window.confirm(
      `${titulo}\n\n${mensaje}`
    );

    if (confirmar) {
      accionConfirmar.onPress();
    }

    return;
  }

  window.alert(`${titulo}\n\n${mensaje}`);
}

const Alert = {
  alert: mostrarAlerta,
};

const ESTADOS = [
  {
    value: 'presente',
    label: 'Presente',
    color: COLORS.green,
    background: COLORS.greenLight,
  },
  {
    value: 'ausente',
    label: 'Ausente',
    color: COLORS.red,
    background: COLORS.redLight,
  },
  {
    value: 'tarde',
    label: 'Tarde',
    color: COLORS.orange,
    background: COLORS.orangeLight,
  },
];

function fechaLocal() {
  const ahora = new Date();

  const anio = ahora.getFullYear();
  const mes = String(
    ahora.getMonth() + 1
  ).padStart(2, '0');

  const dia = String(
    ahora.getDate()
  ).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

function fechaValida(fecha) {
  if (
    typeof fecha !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
  ) {
    return false;
  }

  const valor = new Date(
    `${fecha}T12:00:00Z`
  );

  return (
    !Number.isNaN(valor.getTime()) &&
    valor.toISOString().slice(0, 10) === fecha
  );
}

function mensajeError(error) {
  return (
    error?.message ||
    'Ocurrió un error inesperado.'
  );
}

function EstadoSelector({
  value,
  onChange,
  disabled = false,
}) {
  return (
    <View style={styles.estadosRow}>
      {ESTADOS.map((estado) => {
        const seleccionado =
          value === estado.value;

        return (
          <TouchableOpacity
            key={estado.value}
            disabled={disabled}
            onPress={() =>
              onChange(estado.value)
            }
            style={[
              styles.estadoButton,
              {
                borderColor: seleccionado
                  ? estado.color
                  : COLORS.border,
                backgroundColor: seleccionado
                  ? estado.background
                  : COLORS.white,
              },
              disabled &&
                styles.disabledControl,
            ]}
            accessibilityRole="radio"
            accessibilityState={{
              selected: seleccionado,
              disabled,
            }}
          >
            <Text
              style={[
                styles.estadoText,
                {
                  color: seleccionado
                    ? estado.color
                    : COLORS.muted,
                },
              ]}
            >
              {estado.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TarjetaEstudiante({
  estudiante,
  estado,
  registrado,
  onEstadoChange,
  onEditar,
  soloConsulta,
}) {
  const nombre = [
    estudiante.nombres,
    estudiante.apellidos,
  ]
    .filter(Boolean)
    .join(' ');

  const config = ESTADOS.find(
    (item) => item.value === estado
  );

  return (
    <View style={styles.studentCard}>
      <View style={styles.studentHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {String(
              estudiante.nombres || 'E'
            )
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>

        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>
            {nombre || 'Estudiante'}
          </Text>

          <Text style={styles.studentSub}>
            {registrado
              ? 'Asistencia registrada'
              : 'Seleccione el estado'}
          </Text>
        </View>
      </View>

      {registrado ? (
        <View style={styles.registeredRow}>
          <View
            style={[
              styles.estadoBadge,
              {
                backgroundColor:
                  config?.background ||
                  COLORS.primaryLight,
              },
            ]}
          >
            <Text
              style={[
                styles.estadoBadgeText,
                {
                  color:
                    config?.color ||
                    COLORS.primary,
                },
              ]}
            >
              {config?.label || estado}
            </Text>
          </View>

          {typeof onEditar ===
            'function' && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                onEditar(estudiante)
              }
            >
              <Text style={styles.editText}>
                Editar asistencia
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <EstadoSelector
          value={estado}
          onChange={onEstadoChange}
          disabled={soloConsulta && registrado}
        />
      )}
    </View>
  );
}

export default function AttendanceScreen({
  apiUrl,
  accessToken,
  usuarioId,
  onBack,
}) {
  const [asignaciones, setAsignaciones] =
    useState([]);

  const [
    asignacionSeleccionada,
    setAsignacionSeleccionada,
  ] = useState(null);

  const [estudiantes, setEstudiantes] =
    useState([]);

  const [
    sesionSeleccionada,
    setSesionSeleccionada,
  ] = useState(null);

  const [fecha, setFecha] = useState(
    fechaLocal()
  );

  const [estados, setEstados] =
    useState({});

  const [
    asistenciasGuardadas,
    setAsistenciasGuardadas,
  ] = useState([]);

  const [cargando, setCargando] =
    useState(false);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    actualizando,
    setActualizando,
  ] = useState(false);

  const [
    refrescando,
    setRefrescando,
  ] = useState(false);
  const [modoOffline, setModoOffline] =
    useState(false);
  const [hayConexion, setHayConexion] =
    useState(null);
  const [
    fechaUltimaSincronizacion,
    setFechaUltimaSincronizacion,
  ] = useState(null);

  const [
    mostrarMaterias,
    setMostrarMaterias,
  ] = useState(false);

  const [
    modalEdicion,
    setModalEdicion,
  ] = useState(false);

  const [
    estudianteEditando,
    setEstudianteEditando,
  ] = useState(null);

  const [
    asistenciaEditando,
    setAsistenciaEditando,
  ] = useState(null);

  const [
    nuevoEstado,
    setNuevoEstado,
  ] = useState('presente');

  const [
    observacion,
    setObservacion,
  ] = useState('');

  const [
    motivo,
    setMotivo,
  ] = useState('');

  const registrado =
    asistenciasGuardadas.length > 0;
  const soloConsulta =
    modoOffline || hayConexion !== true;

  useEffect(() => {
    iniciarAsistenciaOffline().catch(
      (error) => {
        console.log(
          'No fue posible inicializar SQLite:',
          error.message
        );
      }
    );
  }, []);

  useEffect(() => {
    let activa = true;

    const actualizarConexion = (estado) => {
      if (activa) {
        setHayConexion(
          estado.isConnected === true &&
          estado.isInternetReachable !== false
        );
      }
    };

    Network.getNetworkStateAsync()
      .then(actualizarConexion)
      .catch((error) => {
        console.log(
          'No fue posible consultar el estado de la red:',
          error.message
        );
      });

    const suscripcion =
      Network.addNetworkStateListener(
        actualizarConexion
      );

    return () => {
      activa = false;
      suscripcion.remove();
    };
  }, []);

  const verificarConexion = async () => {
    try {
      const estado =
        await Network.getNetworkStateAsync();
      const disponible =
        estado.isConnected === true &&
        estado.isInternetReachable !== false;

      setHayConexion(disponible);
      return disponible;
    } catch (error) {
      console.log(
        'No fue posible confirmar la conexión antes de escribir:',
        error.message
      );
      setHayConexion(null);
      return false;
    }
  };

  const normalizarUrl = String(
    apiUrl || ''
  ).replace(/\/+$/, '');

  const solicitar = useCallback(
    async (
      endpoint,
      opciones = {}
    ) => {
      const controlador =
        new AbortController();
      const temporizador = setTimeout(
        () => controlador.abort(),
        8000
      );

      try {
        let response;

        try {
          response = await fetch(
            `${normalizarUrl}${endpoint}`,
            {
              ...opciones,
              signal: controlador.signal,
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
                'Content-Type':
                  'application/json',
                ...(opciones.headers || {}),
              },
            }
          );
        } catch {
          const error = new Error(
            'No fue posible conectar con el servidor.'
          );
          error.sinConexion = true;
          throw error;
        }

        const texto =
          await response.text();

        let data = {};

        if (texto) {
          try {
            data = JSON.parse(texto);
          } catch {
            const formatoError = new Error(
              'El servidor respondió con un formato inesperado.'
            );
            formatoError.status =
              response.status;
            throw formatoError;
          }
        }

        if (!response.ok) {
          const solicitudError = new Error(
            data.message ||
            `Error HTTP ${response.status}`
          );
          solicitudError.status =
            response.status;
          throw solicitudError;
        }

        return data;
      } finally {
        clearTimeout(temporizador);
      }
    },
    [normalizarUrl, accessToken]
  );

  const cargarAsignaciones =
    useCallback(async () => {
      try {
        setCargando(true);

        const data = await solicitar(
          '/api/attendance/mis-asignaciones'
        );

        setAsignaciones(
          data.asignaciones || []
        );
        setModoOffline(false);
      } catch (error) {
        if (!error.status && usuarioId) {
          try {
            const locales =
              await obtenerAsignacionesAsistenciaOffline(
                usuarioId
              );

            if (locales.length) {
              setAsignaciones(locales);
              setModoOffline(true);
              return;
            }
          } catch (errorLocal) {
            console.log(
              'Error consultando asignaciones locales:',
              errorLocal.message
            );
          }
        }

        if (
          error.status === 401 ||
          error.status === 403
        ) {
          setModoOffline(false);
        }

        Alert.alert(
          'Error al cargar materias',
          mensajeError(error)
        );
      } finally {
        setCargando(false);
      }
    }, [solicitar, usuarioId]);

  useEffect(() => {
    let activa = true;

    const cargar = async () => {
      try {
        const data = await solicitar(
          '/api/attendance/mis-asignaciones'
        );

        if (activa) {
          setAsignaciones(
            data.asignaciones || []
          );
          setModoOffline(false);
        }
      } catch (error) {
        if (activa) {
          if (!error.status && usuarioId) {
            try {
              const locales =
                await obtenerAsignacionesAsistenciaOffline(
                  usuarioId
                );

              if (activa && locales.length) {
                setAsignaciones(locales);
                setModoOffline(true);
                return;
              }
            } catch (errorLocal) {
              console.log(
                'Error consultando asignaciones locales:',
                errorLocal.message
              );
            }
          }

          if (error.status === 401 ||
            error.status === 403) {
            setModoOffline(false);
          }

          Alert.alert(
            'Error al cargar materias',
            mensajeError(error)
          );
        }
      } finally {
        if (activa) {
          setCargando(false);
        }
      }
    };

    cargar();

    return () => {
      activa = false;
    };
  }, [solicitar, usuarioId]);

  const cargarAsistenciaSesion =
    useCallback(
      async (
        sesionId,
        {
          sesion = sesionSeleccionada,
          estudiantesSesion = estudiantes,
          asignacionId =
            asignacionSeleccionada?.id,
        } = {}
      ) => {
        const data = await solicitar(
          `/api/attendance/sesiones/${sesionId}`
        );

        const registros =
          data.asistencias || [];

        setAsistenciasGuardadas(
          registros
        );

        const mapa = {};

        registros.forEach(
          (item) => {
            mapa[item.estudiante_id] =
              item.estado;
          }
        );

        setEstados((anteriores) => ({
          ...anteriores,
          ...mapa,
        }));

        if (sesion?.id && asignacionId) {
          try {
            await guardarAsistenciaOffline({
              usuarioId,
              asignacionId,
              fecha: sesion.fecha,
              sesion,
              asistencias: registros,
              estudiantes: estudiantesSesion,
            });
            setFechaUltimaSincronizacion(
              new Date().toISOString()
            );
            setModoOffline(false);
          } catch (error) {
            console.log(
              'Error guardando caché SQLite:',
              error.message
            );
          }
        }

        return registros;
      },
      [
        solicitar,
        sesionSeleccionada,
        estudiantes,
        asignacionSeleccionada?.id,
        usuarioId,
      ]
    );

  const consultarCopiaLocal = useCallback(
    async (asignacionId, fechaConsulta) => {
      if (!usuarioId) {
        throw new Error(
          'No se pudo identificar al docente.'
        );
      }

      // 1. Consultar sesiones previamente
      // guardadas en SQLite.
      const copias =
        await obtenerAsistenciasOffline({
          usuarioId,
          asignacionId,
          fecha: fechaConsulta,
        });

      if (copias.length > 0) {
        const copia = copias[0];

        setSesionSeleccionada(copia.sesion);
        setEstudiantes(copia.estudiantes);
        setAsistenciasGuardadas(
          copia.asistencias
        );

        const estadosLocales = {};

        copia.asistencias.forEach((item) => {
          estadosLocales[item.estudiante_id] =
            item.estado;
        });

        setEstados(estadosLocales);
        setModoOffline(true);

        setFechaUltimaSincronizacion(
          copia.sincronizadoEn
        );

        console.log(
          'HU-06: sesión recuperada desde SQLite.'
        );

        return copia;
      }

      // 2. Si todavía no existe asistencia
      // para esa fecha, recuperar el grupo.
      const grupoLocal =
        await obtenerGrupoAsistenciaOffline({
          usuarioId,
          asignacionId,
        });

      if (!grupoLocal) {
        throw new Error(
          'El grupo no está disponible sin conexión. Consúltelo primero con internet.'
        );
      }

      const listaEstudiantes =
        grupoLocal.estudiantes;

      const estadosIniciales = {};

      listaEstudiantes.forEach((estudiante) => {
        estadosIniciales[estudiante.id] = null;
      });

      setSesionSeleccionada(null);
      setEstudiantes(listaEstudiantes);
      setAsistenciasGuardadas([]);
      setEstados(estadosIniciales);

      setModoOffline(true);

      setFechaUltimaSincronizacion(
        grupoLocal.actualizadoEn
      );

      console.log(
        'HU-06: grupo recuperado desde SQLite sin conexión.'
      );

      return {
        sesion: null,
        asistencias: [],
        estudiantes: listaEstudiantes,
        origen: 'sqlite',
        sincronizadoEn:
          grupoLocal.actualizadoEn,
      };
    },
    [usuarioId]
  );

  useEffect(() => {
    if (
      hayConexion !== false ||
      !asignacionSeleccionada?.id
    ) {
      return undefined;
    }

    let activa = true;

    Promise.resolve().then(async () => {
      if (!activa) {
        return;
      }

      try {
        await consultarCopiaLocal(
          asignacionSeleccionada.id,
          fecha
        );
      } catch {
        if (activa) {
          setSesionSeleccionada(null);
          setEstudiantes([]);
          setEstados({});
          setAsistenciasGuardadas([]);
          setModoOffline(false);
          setFechaUltimaSincronizacion(null);
        }
      }
    });

    return () => {
      activa = false;
    };
  }, [
    hayConexion,
    asignacionSeleccionada?.id,
    fecha,
    consultarCopiaLocal,
  ]);

  const cargarDatosAsignacion =
    useCallback(
      async (
        asignacion,
        fechaConsulta
      ) => {
        if (!asignacion?.id) {
          return;
        }

        const id = asignacion.id;
        setModoOffline(false);
        setFechaUltimaSincronizacion(null);

        try {
          const [
            estudiantesData,
            sesionesData,
          ] = await Promise.all([
            solicitar(
              `/api/attendance/asignaciones/${id}/estudiantes`
            ),
            solicitar(
              `/api/attendance/asignaciones/${id}/sesiones`
            ),
          ]);

          const listaEstudiantes =
            estudiantesData.estudiantes ||
            [];

          const listaSesiones =
            sesionesData.sesiones || [];

          // HU-06: almacenar el grupo y sus estudiantes
          // para futuras consultas sin conexión.
          //
          // No interrumpimos la consulta en línea
          // si ocurre un error guardando el caché.
          if (usuarioId && asignacion?.id) {
            try {
              await guardarGrupoAsistenciaOffline({
                usuarioId,
                asignacion,
                estudiantes: listaEstudiantes,
              });

              console.log(
                'HU-06: grupo y estudiantes guardados en SQLite.'
              );
            } catch (errorCache) {
              console.log(
                'HU-06: no fue posible guardar el grupo local:',
                errorCache.message
              );
            }
          }

          setEstudiantes(
            listaEstudiantes
          );

          const iniciales = {};

          listaEstudiantes.forEach(
            (estudiante) => {
              iniciales[estudiante.id] =
                null;
            }
          );

          setEstados(iniciales);
          setAsistenciasGuardadas([]);

          const sesionesFecha =
            listaSesiones
              .filter(
                (item) =>
                  item.fecha === fechaConsulta
              )
              .sort(
                (a, b) =>
                  a.numero_sesion -
                  b.numero_sesion
              );

          const sesion =
            sesionesFecha[0] || null;

          setSesionSeleccionada(sesion);

          if (sesion) {
            await cargarAsistenciaSesion(
              sesion.id,
              {
                sesion,
                estudiantesSesion:
                  listaEstudiantes,
                asignacionId: id,
              }
            );
          }
        } catch (error) {
          setSesionSeleccionada(null);
          setEstudiantes([]);
          setEstados({});
          setAsistenciasGuardadas([]);

          // Los errores de autorización no deben
          // permitir acceder mediante el caché local.
          if (
            error.status ||
            !usuarioId
          ) {
            setModoOffline(false);
            throw error;
          }

          // Primero intentamos recuperar una sesión
          // de asistencia ya guardada en SQLite.
          try {
            await consultarCopiaLocal(
              id,
              fechaConsulta
            );
            return;
          } catch {
            // No hay sesión registrada localmente.
            // Intentamos recuperar el grupo y sus
            // estudiantes para un registro nuevo.
          }

          const grupoLocal =
            await obtenerGrupoAsistenciaOffline({
              usuarioId,
              asignacionId: id,
            });

          if (!grupoLocal) {
            setModoOffline(true);
            setFechaUltimaSincronizacion(null);

            throw new Error(
              'No hay estudiantes guardados para esta materia. Conéctese a internet y consulte el grupo primero.'
            );
          }

          const listaEstudiantes =
            grupoLocal.estudiantes;

          const estadosIniciales = {};

          listaEstudiantes.forEach((estudiante) => {
            estadosIniciales[estudiante.id] = null;
          });

          setEstudiantes(listaEstudiantes);
          setEstados(estadosIniciales);
          setSesionSeleccionada(null);
          setAsistenciasGuardadas([]);

          setModoOffline(true);

          setFechaUltimaSincronizacion(
            grupoLocal.actualizadoEn
          );

          console.log(
            'HU-06: grupo recuperado desde SQLite sin conexión.'
          );
        }
      },
      [
        solicitar,
        cargarAsistenciaSesion,
        consultarCopiaLocal,
        usuarioId,
      ]
    );

  const seleccionarAsignacion =
    async (asignacion) => {
      setMostrarMaterias(false);
      setAsignacionSeleccionada(
        asignacion
      );

      setSesionSeleccionada(null);
      setAsistenciasGuardadas([]);
      setEstudiantes([]);

      try {
        setCargando(true);

        await cargarDatosAsignacion(
          asignacion,
          fecha
        );
      } catch (error) {
        Alert.alert(
          'Error',
          mensajeError(error)
        );
      } finally {
        setCargando(false);
      }
    };

  const actualizarFecha =
    async () => {
      if (!fechaValida(fecha)) {
        Alert.alert(
          'Fecha inválida',
          'Ingrese una fecha válida en formato AAAA-MM-DD.'
        );

        return;
      }

      if (!asignacionSeleccionada) {
        Alert.alert(
          'Materia requerida',
          'Seleccione primero una materia.'
        );

        return;
      }

      try {
        setCargando(true);

        await cargarDatosAsignacion(
          asignacionSeleccionada,
          fecha
        );
      } catch (error) {
        Alert.alert(
          'Error',
          mensajeError(error)
        );
      } finally {
        setCargando(false);
      }
    };

  const seleccionarEstado = (
    estudianteId,
    estado
  ) => {
    if (registrado) {
      return;
    }

    setEstados(
      (anteriores) => ({
        ...anteriores,
        [estudianteId]: estado,
      })
    );
  };

  const crearSesionSiNoExiste =
    async () => {
      if (soloConsulta) {
        throw new Error(
          'No se pueden crear sesiones sin conexión.'
        );
      }

      if (sesionSeleccionada) {
        return sesionSeleccionada;
      }

      // Primera versión:
      // sesión número 1 para la fecha
      // y asignación seleccionadas.

      const data = await solicitar(
        '/api/attendance/sesiones',
        {
          method: 'POST',
          body: JSON.stringify({
            materiaGrupoPeriodoId:
              asignacionSeleccionada.id,
            fecha,
            numeroSesion: 1,
          }),
        }
      );

      const sesion = data.sesion;

      if (!sesion?.id) {
        throw new Error(
          'No se pudo obtener la sesión creada.'
        );
      }

      setSesionSeleccionada(
        sesion
      );

      return sesion;
    };

  const guardarRegistroOffline = async () => {
    if (
      guardando ||
      !usuarioId ||
      !asignacionSeleccionada?.id ||
      !estudiantes.length ||
      registrado
    ) {
      return;
    }

    if (!fechaValida(fecha)) {
      Alert.alert(
        'Fecha inválida',
        'Verifique la fecha de la clase.'
      );
      return;
    }

    const sinMarcar = estudiantes.filter(
      (item) =>
        !ESTADOS.some(
          (estado) =>
            estado.value === estados[item.id]
        )
    );

    if (sinMarcar.length > 0) {
      Alert.alert(
        'Asistencia incompleta',
        `Faltan ${sinMarcar.length} estudiantes por marcar.`
      );
      return;
    }

    const registros = estudiantes.map(
      (estudiante) => ({
        estudianteId: estudiante.id,
        estado: estados[estudiante.id],
        observacion: null,
      })
    );

    if (
      fecha < '2026-01-20' ||
      fecha > '2026-03-27'
    ) {
      Alert.alert(
        'Fecha fuera del período',
        'La fecha seleccionada no pertenece al período académico configurado. No se guardó ninguna operación.'
      );
      return;
    }

    setGuardando(true);

    try {
      const existentes = await obtenerColaAsistencia({
        usuarioId,
        estados: [
          'pendiente',
          'sincronizando',
          'error',
          'sincronizado',
        ],
      });

      const duplicada = existentes.some(
        (item) =>
          Number(item.asignacionId) ===
            Number(asignacionSeleccionada.id) &&
          item.fecha === fecha &&
          Number(item.numeroSesion) === 1
      );

      if (duplicada) {
        Alert.alert(
          'Registro existente',
          'Ya hay una operación local para esta materia, fecha y sesión. No se guardó otra.'
        );
        return;
      }

      const resultado = await encolarAsistenciaOffline({
        usuarioId,
        asignacionId: asignacionSeleccionada.id,
        fecha,
        numeroSesion: 1,
        registros,
      });

      Alert.alert(
        'Guardado en el dispositivo',
        `Operación ${resultado.id} guardada en SQLite.\n\nPendiente de sincronización con Supabase.`
      );

      console.log(
        'HU-06: asistencia pendiente guardada en SQLite.',
        resultado.id
      );
    } catch (error) {
      Alert.alert(
        'Error al guardar offline',
        mensajeError(error)
      );
    } finally {
      setGuardando(false);
    }
  };

  const guardarAsistencia =
    async () => {
      if (
        soloConsulta ||
        !(await verificarConexion())
      ) {
        Alert.alert(
          'Sin conexión',
          'No se pueden registrar asistencias mientras se consulta información local.'
        );
        return;
      }

      if (
        !asignacionSeleccionada ||
        !estudiantes.length
      ) {
        Alert.alert(
          'Datos incompletos',
          'Seleccione una materia con estudiantes.'
        );
        return;
      }

      if (!fechaValida(fecha)) {
        Alert.alert(
          'Fecha inválida',
          'Verifique la fecha de la clase.'
        );
        return;
      }

      if (registrado) {
        Alert.alert(
          'Asistencia registrada',
          'Esta sesión ya tiene asistencia. Utilice Editar asistencia para realizar correcciones.'
        );
        return;
      }

      const sinMarcar =
        estudiantes.filter(
          (item) =>
            !ESTADOS.some(
              (estado) =>
                estado.value ===
                estados[item.id]
            )
        );

      if (sinMarcar.length) {
        Alert.alert(
          'Asistencia incompleta',
          `Falta seleccionar el estado de ${sinMarcar.length} estudiante(s).`
        );
        return;
      }

      Alert.alert(
        'Confirmar asistencia',
        'Una vez registrada, las modificaciones quedarán registradas en el historial de correcciones.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Guardar',
            onPress:
              ejecutarGuardado,
          },
        ]
      );
    };

  const ejecutarGuardado =
    async () => {
      if (
        guardando ||
        soloConsulta ||
        !(await verificarConexion())
      ) {
        return;
      }

      setGuardando(true);

      try {
        const sesion =
          await crearSesionSiNoExiste();

        const registros =
          estudiantes.map(
            (estudiante) => ({
              estudianteId:
                estudiante.id,
              estado:
                estados[estudiante.id],
              observacion: null,
            })
          );

        await solicitar(
          `/api/attendance/sesiones/${sesion.id}/asistencias`,
          {
            method: 'POST',
            body: JSON.stringify({
              registros,
            }),
          }
        );

        await cargarAsistenciaSesion(
          sesion.id
        );

        Alert.alert(
          'Registro exitoso',
          'Asistencia registrada correctamente'
        );
      } catch (error) {
        Alert.alert(
          'No fue posible guardar',
          `${mensajeError(error)} Consulte nuevamente la sesión antes de reintentar.`
        );

        // Verificar si el servidor
        // alcanzó a registrar la operación.
        try {
          await cargarDatosAsignacion(
            asignacionSeleccionada,
            fecha
          );
        } catch {
          // Mantener mensaje original.
        }
      } finally {
        setGuardando(false);
      }
    };

  const abrirEdicion = (
    estudiante
  ) => {
    const registro =
      asistenciasGuardadas.find(
        (item) =>
          item.estudiante_id ===
          estudiante.id
      );

    if (!registro) {
      Alert.alert(
        'Registro no encontrado',
        'No existe una asistencia guardada para este estudiante.'
      );
      return;
    }

    setEstudianteEditando(
      estudiante
    );

    setAsistenciaEditando(
      registro
    );

    setNuevoEstado(
      registro.estado
    );

    setObservacion(
      registro.observacion || ''
    );

    setMotivo('');
    setModalEdicion(true);
  };

  const cerrarEdicion = () => {
    if (actualizando) {
      return;
    }

    setModalEdicion(false);
    setEstudianteEditando(null);
    setAsistenciaEditando(null);
    setMotivo('');
    setObservacion('');
  };

  const guardarCorreccion =
    async () => {
      if (
        soloConsulta ||
        !(await verificarConexion())
      ) {
        Alert.alert(
          'Sin conexión',
          'No se pueden corregir asistencias mientras se consulta información local.'
        );
        return;
      }

      if (
        !asistenciaEditando?.id ||
        !sesionSeleccionada?.id
      ) {
        Alert.alert(
          'Error',
          'No se encontró el registro que desea corregir.'
        );
        return;
      }

      if (
        !ESTADOS.some(
          (item) =>
            item.value === nuevoEstado
        )
      ) {
        Alert.alert(
          'Estado inválido',
          'Seleccione un estado válido.'
        );
        return;
      }

      if (!motivo.trim()) {
        Alert.alert(
          'Motivo obligatorio',
          'Explique por qué está realizando esta corrección.'
        );
        return;
      }

      if (
        motivo.length > 1000 ||
        observacion.length > 1000
      ) {
        Alert.alert(
          'Texto demasiado largo',
          'El motivo y la observación no pueden superar 1000 caracteres.'
        );
        return;
      }

      const observacionNueva =
        observacion.trim() || null;

      if (
        nuevoEstado ===
          asistenciaEditando.estado &&
        observacionNueva ===
          (asistenciaEditando.observacion ||
            null)
      ) {
        Alert.alert(
          'Sin cambios',
          'Debe modificar el estado o la observación antes de guardar.'
        );
        return;
      }

      Alert.alert(
        'Confirmar corrección',
        '¿Desea guardar esta modificación? Se conservará el historial del cambio.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Guardar cambios',
            onPress:
              ejecutarCorreccion,
          },
        ]
      );
    };

  const ejecutarCorreccion =
    async () => {
      if (
        actualizando ||
        soloConsulta ||
        !(await verificarConexion())
      ) {
        return;
      }

      setActualizando(true);

      try {
        await solicitar(
          `/api/attendance/asistencias/${asistenciaEditando.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              estado: nuevoEstado,
              observacion:
                observacion.trim() ||
                null,
              motivo: motivo.trim(),
            }),
          }
        );

        await cargarAsistenciaSesion(
          sesionSeleccionada.id,
          {
            sesion: sesionSeleccionada,
            estudiantesSesion:
              estudiantes,
            asignacionId:
              asignacionSeleccionada?.id,
          }
        );

        setModalEdicion(false);
        setEstudianteEditando(null);
        setAsistenciaEditando(null);
        setMotivo('');
        setObservacion('');

        Alert.alert(
          'Corrección guardada',
          'La asistencia se actualizó correctamente en Supabase.'
        );
      } catch (error) {
        Alert.alert(
          'No fue posible corregir',
          mensajeError(error)
        );

        try {
          await cargarAsistenciaSesion(
            sesionSeleccionada.id
          );
        } catch {
          // Conservar mensaje del error original.
        }
      } finally {
        setActualizando(false);
      }
    };

  const refrescar = async () => {
    setRefrescando(true);

    try {
      if (asignacionSeleccionada) {
        await cargarDatosAsignacion(
          asignacionSeleccionada,
          fecha
        );
      } else {
        await cargarAsignaciones();
      }
    } catch (error) {
      Alert.alert(
        'Error',
        mensajeError(error)
      );
    } finally {
      setRefrescando(false);
    }
  };

  const nombreMateria =
    asignacionSeleccionada
      ? [
          asignacionSeleccionada
            .materia?.nombre,
          asignacionSeleccionada
            .grado?.nombre,
          asignacionSeleccionada
            .grupo?.nombre,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'Seleccionar materia y grupo';

  const presentes =
    estudiantes.filter(
      (item) =>
        estados[item.id] === 'presente'
    ).length;

  const ausentes =
    estudiantes.filter(
      (item) =>
        estados[item.id] === 'ausente'
    ).length;

  const tardes =
    estudiantes.filter(
      (item) =>
        estados[item.id] === 'tarde'
    ).length;

  return (
    <SafeAreaView
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            {'‹  Volver'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Asistencia
        </Text>

        <Text style={styles.headerSubtitle}>
          Registro y seguimiento académico
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {modoOffline || hayConexion !== true ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerTitle}>
              {hayConexion === false
                ? 'Sin conexión · Solo consulta'
                : 'Conexión no confirmada · Solo consulta'}
            </Text>
            <Text style={styles.offlineBannerText}>
              {modoOffline
                ? 'Mostrando datos guardados en este dispositivo.'
                : 'Las acciones de escritura están deshabilitadas hasta confirmar la conexión.'}
              {modoOffline && fechaUltimaSincronizacion
                ? ` Última sincronización: ${new Date(
                    fechaUltimaSincronizacion
                  ).toLocaleString()}`
                : ''}
              {' '}No puedes registrar ni corregir asistencias sin conexión.
            </Text>
          </View>
        ) : null}

        <AttendanceSyncButton
          usuarioId={usuarioId}
          apiUrl={apiUrl}
          accessToken={accessToken}
          onSincronizacionCompleta={async () => {
            if (asignacionSeleccionada) {
              await cargarDatosAsignacion(
                asignacionSeleccionada,
                fecha
              );
            }
          }}
        />

        <Text style={styles.sectionTitle}>
          Materia y grupo
        </Text>

        <TouchableOpacity
          style={styles.selectCard}
          onPress={() =>
            setMostrarMaterias(
              !mostrarMaterias
            )
          }
          disabled={
            cargando || guardando
          }
        >
          <Text style={styles.selectText}>
            {nombreMateria}
          </Text>

          <Text style={styles.selectArrow}>
            {'⌄'}
          </Text>
        </TouchableOpacity>

        {mostrarMaterias && (
          <View style={styles.optionsBox}>
            {asignaciones.map(
              (asignacion) => (
                <TouchableOpacity
                  key={String(
                    asignacion.id
                  )}
                  style={styles.option}
                  onPress={() =>
                    seleccionarAsignacion(
                      asignacion
                    )
                  }
                >
                  <Text
                    style={
                      styles.optionTitle
                    }
                  >
                    {
                      asignacion.materia
                        ?.nombre
                    }
                  </Text>

                  <Text
                    style={
                      styles.optionSubtitle
                    }
                  >
                    {
                      asignacion.grado
                        ?.nombre
                    }{' '}
                    —{' '}
                    {
                      asignacion.grupo
                        ?.nombre
                    }
                  </Text>
                </TouchableOpacity>
              )
            )}

            {!asignaciones.length && (
              <Text
                style={
                  styles.emptyText
                }
              >
                No hay materias activas asignadas.
              </Text>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>
          Fecha de la clase
        </Text>

        <View style={styles.dateRow}>
          <TextInput
            style={styles.dateInput}
            value={fecha}
            onChangeText={setFecha}
            placeholder="AAAA-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            autoCorrect={false}
            editable={
              !cargando &&
              !guardando
            }
          />

          <TouchableOpacity
            style={styles.dateButton}
            onPress={
              actualizarFecha
            }
            disabled={
              !asignacionSeleccionada ||
              cargando ||
              guardando
            }
          >
            <Text
              style={
                styles.dateButtonText
              }
            >
              Consultar
            </Text>
          </TouchableOpacity>
        </View>

        {cargando && (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={styles.loader}
          />
        )}

        {!cargando &&
          asignacionSeleccionada && (
            <>
              <View
                style={styles.summaryContainer}
              >
                <Text
                  style={styles.summaryTitle}
                >
                  Resumen de asistencia
                </Text>

                <View
                  style={styles.summaryRow}
                >
                  <View
                    style={styles.summaryItem}
                  >
                    <Text
                      style={
                        styles.summaryNumber
                      }
                    >
                      {estudiantes.length}
                    </Text>
                    <Text
                      style={
                        styles.summaryLabel
                      }
                    >
                      Total
                    </Text>
                  </View>

                  <View
                    style={styles.summaryItem}
                  >
                    <Text
                      style={[
                        styles.summaryNumber,
                        {
                          color:
                            COLORS.green,
                        },
                      ]}
                    >
                      {presentes}
                    </Text>
                    <Text
                      style={
                        styles.summaryLabel
                      }
                    >
                      Presentes
                    </Text>
                  </View>

                  <View
                    style={styles.summaryItem}
                  >
                    <Text
                      style={[
                        styles.summaryNumber,
                        {
                          color:
                            COLORS.red,
                        },
                      ]}
                    >
                      {ausentes}
                    </Text>
                    <Text
                      style={
                        styles.summaryLabel
                      }
                    >
                      Ausentes
                    </Text>
                  </View>

                  <View
                    style={styles.summaryItem}
                  >
                    <Text
                      style={[
                        styles.summaryNumber,
                        {
                          color:
                            COLORS.orange,
                        },
                      ]}
                    >
                      {tardes}
                    </Text>
                    <Text
                      style={
                        styles.summaryLabel
                      }
                    >
                      Tarde
                    </Text>
                  </View>
                </View>
              </View>

              {registrado && (
                <View
                  style={styles.noticeBox}
                >
                  <Text
                    style={styles.noticeTitle}
                  >
                    Asistencia registrada
                  </Text>

                  <Text
                    style={styles.noticeText}
                  >
                    Esta sesión ya fue guardada.
                    Puede corregir individualmente
                    los registros que realizó,
                    indicando el motivo del cambio.
                  </Text>
                </View>
              )}

              <Text
                style={styles.sectionTitle}
              >
                Estudiantes
              </Text>

              {estudiantes.map(
                (estudiante) => (
                  <TarjetaEstudiante
                    key={String(
                      estudiante.id
                    )}
                    estudiante={
                      estudiante
                    }
                    estado={
                      estados[
                        estudiante.id
                      ]
                    }
                    registrado={
                      registrado
                    }
                    soloConsulta={
                      soloConsulta
                    }
                    onEstadoChange={(
                      valor
                    ) =>
                      seleccionarEstado(
                        estudiante.id,
                        valor
                      )
                    }
                    onEditar={
                      registrado &&
                      !soloConsulta
                        ? abrirEdicion
                        : undefined
                    }
                  />
                )
              )}

              {!estudiantes.length && (
                <Text
                  style={styles.emptyText}
                >
                  No se encontraron estudiantes activos en este grupo.
                </Text>
              )}

              {!registrado &&
                estudiantes.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      guardando &&
                        styles.disabledControl,
                    ]}
                    onPress={
                      soloConsulta
                        ? guardarRegistroOffline
                        : guardarAsistencia
                    }
                    disabled={guardando}
                  >
                    {guardando ? (
                      <ActivityIndicator
                        color={
                          COLORS.white
                        }
                      />
                    ) : (
                      <Text
                        style={
                          styles.saveText
                        }
                      >
                        {soloConsulta
                          ? 'Guardar offline'
                          : 'Guardar asistencia'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
            </>
          )}
      </ScrollView>

      <Modal
        visible={modalEdicion}
        transparent
        animationType="slide"
        onRequestClose={
          cerrarEdicion
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.modalContent}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              <Text
                style={styles.modalTitle}
              >
                Editar asistencia
              </Text>

              <Text
                style={styles.modalSubtitle}
              >
                {[
                  estudianteEditando
                    ?.nombres,
                  estudianteEditando
                    ?.apellidos,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </Text>

              <Text
                style={styles.formLabel}
              >
                Nuevo estado
              </Text>

              <EstadoSelector
                value={nuevoEstado}
                onChange={
                  setNuevoEstado
                }
                disabled={
                  actualizando ||
                  soloConsulta
                }
              />

              <Text
                style={styles.formLabel}
              >
                Observación (opcional)
              </Text>

              <TextInput
                style={
                  styles.formInput
                }
                value={observacion}
                onChangeText={
                  setObservacion
                }
                multiline
                maxLength={1000}
                placeholder="Escriba una observación..."
                editable={
                  !actualizando &&
                  !soloConsulta
                }
              />

              <Text
                style={styles.formLabel}
              >
                Motivo de la corrección *
              </Text>

              <TextInput
                style={[
                  styles.formInput,
                  styles.reasonInput,
                ]}
                value={motivo}
                onChangeText={
                  setMotivo
                }
                multiline
                maxLength={1000}
                placeholder="Explique por qué se modifica la asistencia..."
                editable={
                  !actualizando &&
                  !soloConsulta
                }
              />

              <Text
                style={styles.auditHint}
              >
                El sistema conservará
                el estado anterior, el
                nuevo estado, la fecha
                y el usuario responsable.
              </Text>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (actualizando || soloConsulta) &&
                    styles.disabledControl,
                ]}
                onPress={
                  guardarCorreccion
                }
                disabled={
                  actualizando ||
                  soloConsulta
                }
              >
                {actualizando ? (
                  <ActivityIndicator
                    color={
                      COLORS.white
                    }
                  />
                ) : (
                  <Text
                    style={
                      styles.saveText
                    }
                  >
                    Guardar cambios
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.cancelButton
                }
                onPress={
                  cerrarEdicion
                }
                disabled={
                  actualizando
                }
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },
  header: {
    backgroundColor:
      COLORS.primary,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 25,
  },
  backButton: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    marginTop: 5,
    color: '#D7E6F3',
    fontSize: 13,
  },
  content: {
    padding: 20,
    paddingBottom: 65,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 18,
    marginBottom: 12,
  },
  selectCard: {
    padding: 17,
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },
  selectText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selectArrow: {
    color: COLORS.primary,
    fontSize: 22,
    marginLeft: 8,
  },
  optionsBox: {
    backgroundColor:
      COLORS.white,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    overflow: 'hidden',
  },
  option: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
  },
  optionTitle: {
    fontWeight: '700',
    color: COLORS.primary,
    fontSize: 15,
  },
  optionSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 3,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 9,
  },
  dateInput: {
    flex: 1,
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  dateButton: {
    backgroundColor:
      COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  dateButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  loader: {
    marginVertical: 30,
  },
  summaryContainer: {
    backgroundColor:
      COLORS.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    marginTop: 20,
  },
  summaryTitle: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '800',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 21,
    fontWeight: '900',
    color: COLORS.primary,
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.muted,
  },
  noticeBox: {
    backgroundColor:
      COLORS.primaryLight,
    padding: 15,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#C9DDEC',
  },
  offlineBanner: {
    backgroundColor: COLORS.orangeLight,
    borderColor: COLORS.orange,
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
  },
  offlineBannerTitle: {
    color: COLORS.orange,
    fontSize: 14,
    fontWeight: '800',
  },
  offlineBannerText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  noticeTitle: {
    fontWeight: '800',
    fontSize: 14,
    color: COLORS.primary,
  },
  noticeText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.text,
  },
  studentCard: {
    backgroundColor:
      COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor:
      COLORS.border,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 41,
    height: 41,
    borderRadius: 21,
    backgroundColor:
      COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  studentSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 3,
  },
  estadosRow: {
    flexDirection: 'row',
    gap: 6,
  },
  estadoButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estadoText: {
    fontSize: 12,
    fontWeight: '800',
  },
  disabledControl: {
    opacity: 0.55,
  },
  registeredRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 10,
  },
  estadoBadge: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
  },
  estadoBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  editButton: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 9,
    backgroundColor:
      COLORS.primaryLight,
  },
  editText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  saveButton: {
    backgroundColor:
      COLORS.primary,
    minHeight: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  saveText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 21,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.50)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor:
      COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    paddingBottom: 35,
    maxHeight: '90%',
  },
  modalTitle: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: COLORS.text,
    fontSize: 15,
    marginTop: 7,
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 9,
    marginTop: 15,
  },
  formInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    padding: 13,
    backgroundColor:
      COLORS.background,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  reasonInput: {
    minHeight: 90,
  },
  auditHint: {
    marginTop: 15,
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
  },
  cancelButton: {
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelText: {
    color: COLORS.red,
    fontWeight: '800',
    fontSize: 15,
  },
});
