import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';


import {
  AppState,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import LoginScreen from './src/components/LoginScreen';
import AdminDashboard from './src/screens/AdminDashboard';
import RolesPermissionsScreen
  from './src/screens/RolesPermissionsScreen';
import RoleUsersScreen
  from './src/screens/RoleUsersScreen';
import SystemMonitoringScreen
  from './src/screens/SystemMonitoringScreen';
// HU-13: ubicación del dispositivo
import LocationScreen from './src/screens/LocationScreen';
import AcademicPeriodsScreen
  from './src/screens/AcademicPeriodsScreen';
import AcademicActivitiesScreen
  from './src/screens/AcademicActivitiesScreen';
import ActivitySubmissionsScreen
  from './src/screens/ActivitySubmissionsScreen';
import ActivityResourcesScreen
  from './src/screens/ActivityResourcesScreen';
import RegisterActivityScreen
  from './src/screens/RegisterActivityScreen';
import EditSubjectScreen
  from './src/screens/EditSubjectScreen';
import MySubjectsScreen
  from './src/screens/MySubjectsScreen';
import MyStudentsScreen
  from './src/screens/MyStudentsScreen';
import StudentActivitiesScreen
  from './src/screens/StudentActivitiesScreen';
import StudentGradesScreen
  from './src/screens/StudentGradesScreen';
import TeacherGradesScreen
  from './src/screens/TeacherGradesScreen';
import AttendanceScreen
  from './src/screens/AttendanceScreen';
import StudentAttendanceScreen from './src/screens/StudentAttendanceScreen';
import MySubmissionScreen
  from './src/screens/MySubmissionScreen';
import SubmitActivityScreen
  from './src/screens/SubmitActivityScreen';
import RegisterSubjectScreen
  from './src/screens/RegisterSubjectScreen';
import SubjectManagementScreen
  from './src/screens/SubjectManagementScreen';
import RegisterUserScreen
  from './src/screens/RegisterUserScreen';
import ActivateAccountScreen
  from './src/screens/ActivateAccountScreen';
import ResetPasswordScreen
  from './src/screens/ResetPasswordScreen';
import MandatoryPasswordChangeScreen
  from './src/screens/MandatoryPasswordChangeScreen';
import CoordinatorDashboard from './src/screens/CoordinatorDashboard';
import OrientadorDashboard from './src/screens/OrientadorDashboard';
import DocenteDashboard from './src/screens/DocenteDashboard';
import ExcuseReviewScreen
  from './src/screens/ExcuseReviewScreen';
import AcudienteDashboard from './src/screens/AcudienteDashboard';
import EstudianteDashboard from './src/screens/EstudianteDashboard';
import StudentCommunicationsScreen
  from './src/screens/StudentCommunicationsScreen';

import PublishCommunicationScreen
  from './src/screens/PublishCommunicationScreen';

import {
  eliminarSesion,
  guardarSesion,
  obtenerSesion,
} from './src/services/sessionService';
import {
  guardarAutorizacionOffline,
  verificarAutorizacionOffline,
  eliminarAutorizacionOffline,
} from './src/services/offlineAuthorizationService';
import {
  registrarDispositivoEnBackend,
} from './src/services/notificationService';
import { API_URL } from './src/config/apiConfig';
import {
  eliminarHistorialEstudianteOffline,
} from './src/database/studentAcademicOfflineDatabase';
import {
  eliminarCacheAcademicaLocal,
} from './database/localDatabase';
import AcademicOfflineScreen from './src/screens/AcademicOfflineScreen';

export default function App() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [
    mostrarContrasena,
    setMostrarContrasena,
  ] = useState(false);

  const [cargando, setCargando] = useState(false);

  const [cargandoSesion, setCargandoSesion] =
    useState(true);

  const [usuario, setUsuario] = useState(null);

  const [sesion, setSesion] = useState(null);

  // =====================================================
  // HU-14 | ESTADO DE ACCESO OFFLINE
  // =====================================================

  // Indica si la aplicación está utilizando una
  // autorización local limitada.
  //
  // Por defecto permanece desactivado.
  // No debe activarse sin validar previamente
  // las condiciones de acceso offline.
  const [modoOffline, setModoOffline] = useState(false);

  // HU-14: usuario autorizado exclusivamente
  // para consultar información académica local.
  const [usuarioOffline, setUsuarioOffline] = useState(null);
  const usuarioOfflineId = usuarioOffline?.id;

  // Permite identificar si el usuario tiene una
  // sesión online validada por el servidor.
  const sesionOnlineValidada =
    Boolean(usuario?.id && sesion?.accessToken) &&
    !modoOffline;

  const [
    materiaSeleccionada,
    setMateriaSeleccionada,
  ] = useState(null);

  const [
    rolUsuariosSeleccionado,
    setRolUsuariosSeleccionado,
  ] = useState(null);

  const [
    actividadSeleccionada,
    setActividadSeleccionada,
  ] = useState(null);

  const [
    actividadDocenteSeleccionada,
    setActividadDocenteSeleccionada,
  ] = useState(null);

  const [
    actividadRecursosSeleccionada,
    setActividadRecursosSeleccionada,
  ] = useState(null);

  const [
    entregaSeleccionadaId,
    setEntregaSeleccionadaId,
  ] = useState(null);

  const [
    pantallaActual,
    setPantallaActual,
  ] = useState('dashboard');

  const [
    recuperandoPassword,
    setRecuperandoPassword,
  ] = useState(false);

  const [
    correoRecuperacion,
    setCorreoRecuperacion,
  ] = useState(null);

  const renovacionSesionEnCurso = useRef(null);

  const [
    modoActivacion,
    setModoActivacion,
  ] = useState(false);

  const [
    activationAccessToken,
    setActivationAccessToken,
  ] = useState(null);

  const accessToken =
    sesion?.accessToken;
  const usuarioAutenticado =
    Boolean(usuario?.id);
  const debeCambiarPassword =
    usuario?.debeCambiarPassword;

  // ======================================================
  // HU-13 | PERMISO AUTOMÁTICO DE UBICACIÓN
  // ======================================================

  useEffect(() => {
    let activo = true;

    const solicitarPermisoGPS = async () => {
      if (
        cargandoSesion ||
        modoOffline ||
        !usuarioAutenticado ||
        !accessToken ||
        debeCambiarPassword === true ||
        recuperandoPassword ||
        modoActivacion
      ) {
        return;
      }

      try {
        const permisoActual =
          await Location.getForegroundPermissionsAsync();

        if (!activo) {
          return;
        }

        if (
          permisoActual.granted ||
          !permisoActual.canAskAgain
        ) {
          return;
        }

        await Location.requestForegroundPermissionsAsync();
      } catch (error) {
        console.warn(
          '[HU-13] No fue posible solicitar el permiso GPS:',
          error?.message || error
        );
      }
    };

    void solicitarPermisoGPS();

    return () => {
      activo = false;
    };
  }, [
    cargandoSesion,
    modoOffline,
    usuarioAutenticado,
    debeCambiarPassword,
    accessToken,
    recuperandoPassword,
    modoActivacion,
  ]);

  useEffect(() => {
    const registrarPush = async () => {
      if (
        modoOffline ||
        !accessToken ||
        !usuario
      ) {
        return;
      }

      const resultado =
        await registrarDispositivoEnBackend(
          API_URL,
          accessToken
        );

      if (!resultado.success) {
        console.log(
          'No se pudo registrar push:',
          resultado.message
        );
      }
    };

    registrarPush();
  }, [
    modoOffline,
    accessToken,
    usuario,
  ]);

  const fetchConTimeout = useCallback(async (
    url,
    options
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const renovarSesionAutenticada = useCallback(async () => {
    const refreshToken = sesion?.refreshToken;

    if (!refreshToken) {
      throw new Error(
        'La sesión ya no se puede renovar. Inicia sesión nuevamente.'
      );
    }

    if (renovacionSesionEnCurso.current) {
      return renovacionSesionEnCurso.current;
    }

    const renovacion = (async () => {
      const response = await fetchConTimeout(
        `${API_URL}/api/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        }
      );

      let resultado;

      try {
        resultado = await response.json();
      } catch {
        throw new Error(
          'El servidor devolvió una respuesta inválida al renovar la sesión.'
        );
      }

      if (
        !response.ok ||
        resultado?.success !== true ||
        !resultado?.session?.accessToken ||
        !resultado?.session?.refreshToken
      ) {
        throw new Error(
          resultado?.message ||
            'La sesión no pudo renovarse. Inicia sesión nuevamente.'
        );
      }

      const sesionRenovada = {
        usuario: resultado.usuario,
        session: resultado.session,
      };

      const guardado = await guardarSesion(sesionRenovada);

      if (!guardado) {
        throw new Error(
          'La sesión se renovó, pero no pudo guardarse de forma segura.'
        );
      }

      setUsuario(resultado.usuario);
      setSesion(resultado.session);

      return resultado.session;
    })();

    renovacionSesionEnCurso.current = renovacion;

    try {
      return await renovacion;
    } finally {
      if (renovacionSesionEnCurso.current === renovacion) {
        renovacionSesionEnCurso.current = null;
      }
    }
  }, [fetchConTimeout, sesion?.refreshToken]);

  useEffect(() => {
    const expiresAt = Number(sesion?.expiresAt);

    if (
      modoOffline ||
      !usuario?.id ||
      !sesion?.refreshToken ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= 0
    ) {
      return undefined;
    }

    const expiresAtMs = expiresAt * 1000;
    const margenRenovacionMs = 2 * 60 * 1000;
    let temporizador;

    const renovarSiNecesario = async () => {
      if (
        Date.now() <
        expiresAtMs - margenRenovacionMs
      ) {
        programarRenovacion();
        return;
      }

      try {
        await renovarSesionAutenticada();
      } catch (error) {
        console.warn(
          'No se pudo renovar la sesión activa:',
          error.message
        );
      }
    };

    const programarRenovacion = () => {
      clearTimeout(temporizador);

      const tiempoRestante =
        expiresAtMs -
        Date.now() -
        margenRenovacionMs;

      temporizador = setTimeout(
        renovarSiNecesario,
        Math.max(0, tiempoRestante)
      );
    };

    const suscripcion = AppState.addEventListener(
      'change',
      (estado) => {
        if (estado === 'active') {
          void renovarSiNecesario();
        }
      }
    );

    programarRenovacion();

    return () => {
      clearTimeout(temporizador);
      suscripcion.remove();
    };
  }, [
    modoOffline,
    renovarSesionAutenticada,
    sesion?.expiresAt,
    sesion?.refreshToken,
    usuario?.id,
  ]);

  const procesarDeepLink = async (url) => {
    if (!url) {
      return;
    }

    console.log(
      'Deep link recibido.'
    );

    // Primero verificamos si realmente
    // es un enlace que AULA-AI debe procesar.
    const esActivacion =
      url.includes('activate-account');

    let esRecuperacion =
      url.startsWith(
        'aulaai://reset-password'
      );

    if (!esRecuperacion) {
      try {
        const urlRecuperacion =
          new URL(url);

        esRecuperacion =
          urlRecuperacion.protocol ===
            'exp:' &&
          /^\/--\/reset-password\/?$/.test(
            urlRecuperacion.pathname
          );
      } catch (error) {
        console.log(
          'No se pudo interpretar el enlace recibido:',
          error.message
        );
      }
    }

    // Si no es ninguno de los dos,
    // simplemente lo ignoramos.
    if (
      !esActivacion &&
      !esRecuperacion
    ) {
      return;
    }

    let accessToken = null;

    // Supabase puede devolver el token
    // después del símbolo #
    if (url.includes('#')) {
      const fragment =
        url.split('#')[1];

      const params =
        new URLSearchParams(fragment);

      accessToken =
        params.get('access_token');
    }

    // También puede venir como query parameter.
    if (!accessToken) {
      const parsed =
        Linking.parse(url);

      accessToken =
        parsed.queryParams?.access_token;
    }

    // Solo mostramos error si realmente
    // era un enlace de AULA-AI y faltó el token.
    if (!accessToken) {
      Alert.alert(
        'Enlace inválido',
        'No fue posible validar el enlace recibido.'
      );

      return;
    }

    if (esActivacion) {
      setActivationAccessToken(
        accessToken
      );

      setModoActivacion(true);
      return;
    }

    if (esRecuperacion) {
      Alert.alert(
        'Recuperación mediante código',
        'Por seguridad, los enlaces antiguos ya no permiten restablecer contraseñas. Solicita un nuevo código desde la pantalla de inicio de sesión.'
      );

      return;
    }
  };

  useEffect(() => {
    const subscription =
      Linking.addEventListener(
        'url',
        ({ url }) => {
          procesarDeepLink(url);
        }
      );

    Linking.getInitialURL().then(
      (url) => {
        if (url) {
          procesarDeepLink(url);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // =====================================================
  // HU-14 | VERIFICACION DE CONECTIVIDAD
  // =====================================================

  const dispositivoSinConexion = useCallback(async () => {
    try {
      const estadoRed = await Network.getNetworkStateAsync();

      const sinConexion =
        estadoRed.isConnected === false ||
        estadoRed.isInternetReachable === false;

      if (sinConexion) {
        console.log(
          '[HU-14] Dispositivo sin conexion a Internet.'
        );
      }

      return sinConexion;
    } catch (error) {
      console.warn(
        '[HU-14] No fue posible verificar la conectividad:',
        error?.message || error
      );

      // Si no podemos comprobar la conectividad,
      // no autorizamos automaticamente el modo offline.
      return false;
    }
  }, []);

  // =====================================================
  // HU-14 | RECUPERACION DE ACCESO OFFLINE
  // =====================================================

  const intentarAccesoOffline = useCallback(
    async (datosGuardados) => {
      const usuarioGuardado = datosGuardados?.usuario;

      // Solo habilitamos inicialmente la consulta
      // academica offline para estudiantes.
      if (
        !usuarioGuardado?.id ||
        usuarioGuardado.rol !== 'estudiante' ||
        usuarioGuardado.debeCambiarPassword === true
      ) {
        return false;
      }

      // La autorizacion debe haberse generado
      // previamente durante una sesion online valida.
      const autorizado =
        await verificarAutorizacionOffline(
          usuarioGuardado
        );

      if (!autorizado) {
        console.log(
          '[HU-14] No existe autorizacion offline vigente.'
        );
        return false;
      }

      // No activamos la sesion online ni exponemos
      // tokens a los dashboards.
      setUsuario(null);
      setSesion(null);

      setUsuarioOffline(usuarioGuardado);
      setModoOffline(true);

      console.log(
        '[HU-14] Acceso local de solo lectura autorizado.'
      );

      return true;
    },
    []
  );

  const cargarSesionGuardada = useCallback(async () => {
    let datosGuardados = null;

    try {
      datosGuardados = await obtenerSesion();

      if (
        !datosGuardados?.session?.accessToken ||
        !datosGuardados?.session?.refreshToken
      ) {
        return;
      }

      // =====================================================
      // HU-14 | ACCESO SIN CONEXION AL INICIAR
      // =====================================================

      const sinInternetAlIniciar =
        await dispositivoSinConexion();

      if (sinInternetAlIniciar) {
        console.log(
          '[HU-14] Inicio sin Internet. Verificando acceso local.'
        );

        const accesoOffline =
          await intentarAccesoOffline(datosGuardados);

        if (accesoOffline) {
          return;
        }

        // Sin autorizacion vigente, no se permite
        // acceder a informacion academica local.
        setUsuarioOffline(null);
        setModoOffline(false);
        setUsuario(null);
        setSesion(null);

        return;
      }

      /**
       * Primero intentamos utilizar
       * el access token almacenado.
       */
      let response = await fetchConTimeout(
        `${API_URL}/api/auth/me`,
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${datosGuardados.session.accessToken}`,
          },
        }
      );

      /**
       * Si la sesión sigue siendo válida,
       * continuamos normalmente.
       */
      if (response.ok) {
        const data = await response.json();

        const sesionActualizada = {
          usuario: data.usuario,
          session: datosGuardados.session,
        };

        setModoOffline(false);

        setUsuario(data.usuario);
        setSesion(datosGuardados.session);

        await guardarSesion(
          sesionActualizada
        );

        // HU-14: registrar autorización offline únicamente
        // después de validar la sesión con el servidor.
        if (data.usuario?.debeCambiarPassword !== true) {
          await guardarAutorizacionOffline(data.usuario);
        }

        return;
      }

      // =====================================================
      // HU-14 | CONTROL DE ERRORES HTTP
      // =====================================================

      // Si el servidor responde con un error temporal,
      // conservamos la sesion guardada y evitamos
      // renovar tokens innecesariamente.
      if (response.status >= 500) {
        console.warn(
          '[HU-14] Error temporal del servidor:',
          response.status
        );

        // Si ya existe acceso offline autorizado,
        // conservamos la consulta académica local.
        if (modoOffline && usuarioOfflineId) {
          return;
        }

        setUsuarioOffline(null);
        setModoOffline(false);
        setUsuario(null);
        setSesion(null);

        return;
      }

      // Solo renovamos credenciales cuando el servidor
      // informa que la autenticacion no es valida.
      if (
        response.status !== 401 &&
        response.status !== 403
      ) {
        console.warn(
          '[HU-14] Respuesta inesperada al validar sesion:',
          response.status
        );

        // No cerrar la consulta offline por una
        // respuesta HTTP distinta a un rechazo
        // explícito de autenticación.
        if (modoOffline && usuarioOfflineId) {
          return;
        }

        setUsuarioOffline(null);
        setModoOffline(false);
        setUsuario(null);
        setSesion(null);

        return;
      }

      /**
       * Si el access token dejó de ser válido,
       * intentamos renovar la sesión.
       */
      const refreshResponse = await fetchConTimeout(
        `${API_URL}/api/auth/refresh`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            refreshToken:
              datosGuardados.session
                .refreshToken,
          }),
        }
      );

      /**
       * Si tampoco podemos renovarla,
       * eliminamos la sesión local.
       */
      if (!refreshResponse.ok) {
        // HU-14: una respuesta de autenticacion
        // rechazada invalida el acceso offline.
        //
        // Los errores temporales del servidor no
        // deben tratarse como credenciales revocadas.
        if (
          refreshResponse.status === 400 ||
          refreshResponse.status === 401 ||
          refreshResponse.status === 403
        ) {
          const autorizacionEliminada =
            await eliminarAutorizacionOffline();

          if (!autorizacionEliminada) {
            console.warn(
              '[HU-14] No se pudo revocar la autorizacion offline.'
            );
          }

          const sesionEliminada = await eliminarSesion();

          if (!sesionEliminada) {
            console.warn(
              '[HU-14] No se pudo eliminar la sesion rechazada.'
            );
          }
        }

        // HU-14 | Conservar consulta offline ante
        // errores temporales de renovación.
        if (
          ![400, 401, 403].includes(refreshResponse.status) &&
          modoOffline &&
          usuarioOfflineId
        ) {
          console.warn(
            '[HU-14] Renovacion temporalmente no disponible. ' +
            'Se conserva el acceso offline autorizado.'
          );

          return;
        }

        setUsuarioOffline(null);
        setModoOffline(false);
        setUsuario(null);
        setSesion(null);

        return;
      }

      const refreshData =
        await refreshResponse.json();

      /**
       * Guardamos inmediatamente
       * los nuevos tokens.
       */
      const nuevaSesion = {
        usuario: refreshData.usuario,
        session: refreshData.session,
      };

      await guardarSesion(nuevaSesion);

      if (refreshData.usuario?.debeCambiarPassword !== true) {
        await guardarAutorizacionOffline(refreshData.usuario);
      }

      setModoOffline(false);

      setUsuario(refreshData.usuario);
      setSesion(refreshData.session);
    } catch (error) {
      console.log(
        'Error validando o renovando sesión:',
        error
      );

      // HU-14: no conceder acceso offline ante
      // cualquier error de forma indiscriminada.
      //
      // Solo se intenta cuando la solicitud no
      // obtuvo respuesta HTTP del servidor.
      const posibleFalloConexion =
        error?.name === 'AbortError' ||
        error instanceof TypeError;

      if (
        posibleFalloConexion &&
        datosGuardados &&
        (await dispositivoSinConexion())
      ) {
        try {
          const accesoAutorizado =
            await intentarAccesoOffline(
              datosGuardados
            );

          if (accesoAutorizado) {
            return;
          }
        } catch (errorOffline) {
          console.warn(
            '[HU-14] Error verificando acceso offline:',
            errorOffline?.message || errorOffline
          );
        }
      }

      // HU-14 | Si la consulta offline ya estaba
      // autorizada, un fallo temporal de red no
      // debe eliminar ese acceso local.
      if (modoOffline && usuarioOfflineId) {
        console.warn(
          '[HU-14] Fallo durante la reconexion. ' +
          'Se mantiene la consulta academica offline.'
        );

        return;
      }

      setUsuarioOffline(null);
      setModoOffline(false);
      setUsuario(null);
      setSesion(null);
    } finally {
      setCargandoSesion(false);
    }
  }, [
    fetchConTimeout,
    intentarAccesoOffline,
    dispositivoSinConexion,
    modoOffline,
    usuarioOfflineId,
  ]);

  // =====================================================
  // HU-14 | RECUPERACION INICIAL DE SESION
  // =====================================================

  // Conserva la version mas reciente de la funcion
  // sin provocar nuevas recuperaciones al cambiar
  // el estado online/offline.
  const cargarSesionGuardadaRef = useRef(
    cargarSesionGuardada
  );

  useEffect(() => {
    cargarSesionGuardadaRef.current =
      cargarSesionGuardada;
  }, [cargarSesionGuardada]);

  // La recuperacion inicial debe ejecutarse
  // una sola vez al montar la aplicacion.
  useEffect(() => {
    void Promise.resolve().then(() => {
      return cargarSesionGuardadaRef.current();
    });
  }, []);

  // =====================================================
  // HU-14 | RECONEXION AUTOMATICA DESDE MODO OFFLINE
  // =====================================================

  const reconexionEnProceso = useRef(false);

  // HU-14 | Identifica una salida voluntaria del modo offline.
  const salidaOfflineSolicitada = useRef(false);

  useEffect(() => {
    if (!modoOffline || !usuarioOffline?.id) {
      return;
    }

    let activo = true;

    const intentarReconexion = async () => {
      if (!activo || reconexionEnProceso.current) {
        return;
      }

      reconexionEnProceso.current = true;

      try {
        const estadoRed = await Network.getNetworkStateAsync();

        const hayConexion =
          estadoRed.isConnected === true &&
          estadoRed.isInternetReachable !== false;

        if (!hayConexion || !activo) {
          return;
        }

        console.log(
          '[HU-14] Conexion recuperada. Validando sesion.'
        );

        await cargarSesionGuardada();
      } catch (error) {
        console.warn(
          '[HU-14] No fue posible recuperar la sesion:',
          error?.message || error
        );
      } finally {
        reconexionEnProceso.current = false;
      }
    };

    const suscripcion = Network.addNetworkStateListener(
      (estadoRed) => {
        const hayConexion =
          estadoRed.isConnected === true &&
          estadoRed.isInternetReachable !== false;

        if (hayConexion) {
          void intentarReconexion();
        }
      }
    );

    // Verificacion inicial al activar el modo offline.
    void intentarReconexion();

    // Reintento moderado mientras permanezca offline.
    // La funcion verifica primero la conectividad,
    // evitando solicitudes al backend sin Internet.
    const intervaloReconexion = setInterval(() => {
      if (AppState.currentState === 'active') {
        void intentarReconexion();
      }
    }, 30000);

    // Al regresar a la aplicacion, comprobar si
    // la conexion fue recuperada en segundo plano.
    const suscripcionAppState = AppState.addEventListener(
      'change',
      (estado) => {
        if (estado === 'active') {
          void intentarReconexion();
        }
      }
    );

    return () => {
      activo = false;

      clearInterval(intervaloReconexion);

      suscripcion.remove();
      suscripcionAppState.remove();
    };
  }, [
    modoOffline,
    usuarioOffline?.id,
    cargarSesionGuardada,
  ]);

  /**
   * Inicio de sesión contra el backend.
   */
  const handleLogin = async () => {
    if (!correo.trim()) {
      Alert.alert(
        'Campo obligatorio',
        'Por favor ingrese el correo institucional.'
      );
      return;
    }

    if (!contrasena.trim()) {
      Alert.alert(
        'Campo obligatorio',
        'Por favor ingrese la contraseña.'
      );
      return;
    }

    try {
      setCargando(true);

      const response = await fetchConTimeout(
        `${API_URL}/api/auth/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            correo: correo.trim(),
            contrasena,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          'No fue posible iniciar sesión',
          data.message ||
            'Verifique sus credenciales.'
        );

        return;
      }

      /**
       * Guardamos localmente:
       * - usuario
       * - tokens de sesión
       */
      const datosSesion = {
        usuario: data.usuario,
        session: data.session,
      };

      const guardado =
        await guardarSesion(datosSesion);

      if (!guardado) {
        Alert.alert(
          'Advertencia',
          'La sesión inició, pero no pudo guardarse de forma segura.'
        );
      }

      // HU-14: una autenticacion online correcta puede
      // habilitar posteriormente la consulta offline.
      // Si no fue posible guardar la sesion, no
      // registramos una autorizacion offline.
      if (
        guardado &&
        data.usuario?.debeCambiarPassword !== true
      ) {
        const autorizacionGuardada =
          await guardarAutorizacionOffline(data.usuario);

        if (!autorizacionGuardada) {
          console.warn(
            '[HU-14] No se pudo registrar la autorizacion offline.'
          );
        }
      }

      setModoOffline(false);

      setUsuario(data.usuario);
      setSesion(data.session);

      setContrasena('');
    } catch (error) {
      console.log(
        'Error al conectar con el servidor:',
        error
      );

      Alert.alert(
        'Error de conexión',
        error.name === 'AbortError'
          ? 'El servidor no respondió en 15 segundos. Verifique que el backend de AULA-AI esté activo y que el dispositivo tenga acceso a internet.'
          : 'No fue posible conectarse con el servidor de AULA-AI.'
      );
    } finally {
      setCargando(false);
    }
  };

  const handleRecuperarPassword = async () => {
    if (!correo.trim()) {
      Alert.alert(
        'Correo requerido',
        'Ingrese primero su correo institucional para recuperar la contraseña.'
      );
      return;
    }

    try {
      setCargando(true);

      const redirectTo =
        Linking.createURL(
          'reset-password'
        );

      console.log(
        'URL RECUPERACION EXPO:',
        redirectTo
      );

      const response = await fetch(
        `${API_URL}/api/auth/recuperar-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: correo.trim().toLowerCase(),
            redirectTo,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          'No fue posible procesar la solicitud',
          data.message ||
            'Intente nuevamente más tarde.'
        );
        return;
      }

      const correoDestino =
        correo.trim().toLowerCase();

      Alert.alert(
        'Revisa tu correo',
        `${data.message} Ingresa el código recibido para crear una nueva contraseña.`,
        [
          {
            text: 'Continuar',
            onPress: () => {
              setCorreoRecuperacion(
                correoDestino
              );
              setRecuperandoPassword(true);
            },
          },
        ]
      );
    } catch (error) {
      console.log(
        'Error recuperando contraseña:',
        error
      );

      Alert.alert(
        'Error de conexión',
        'No fue posible conectarse con el servidor de AULA-AI.'
      );
    } finally {
      setCargando(false);
    }
  };

  // HU-07: limpiar los datos privados del estudiante
  // antes de permitir un cambio de cuenta.
  const handleLogout = async () => {
    if (cargando) {
      return;
    }

    setCargando(true);

    const usuarioActual = usuario;
    let limpiezaCompleta =
      usuarioActual?.rol !== 'estudiante' ||
      !usuarioActual?.id;

    try {
      if (
        usuarioActual?.rol === 'estudiante' &&
        usuarioActual?.id
      ) {
        await eliminarCacheAcademicaLocal(
          usuarioActual.id
        );
        await eliminarHistorialEstudianteOffline(
          usuarioActual.id
        );
        limpiezaCompleta = true;

        console.log(
          'HU-07: caché académica del estudiante eliminada.'
        );
      }

      if (sesion?.accessToken) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          5000
        );

        try {
          await fetch(
            `${API_URL}/api/auth/logout`,
            {
              signal: controller.signal,
              method: 'POST',

              headers: {
              Authorization:
                `Bearer ${sesion.accessToken}`,
              },
            }
          );
        } finally {
          clearTimeout(timeoutId);
        }
      }
    } catch (error) {
      console.log(
        'Error durante el cierre de sesión:',
        error
      );
    } finally {
      if (
        usuarioActual?.rol === 'estudiante' &&
        usuarioActual?.id &&
        !limpiezaCompleta
      ) {
        Alert.alert(
          'No se pudo completar el cierre de sesión',
          'Ocurrió un problema al limpiar los datos locales. Inténtalo nuevamente.'
        );
        setCargando(false);
        return;
      }

      try {
        // HU-14: revocar primero la autorizacion
        // offline antes de eliminar la sesion.
        const autorizacionEliminada =
          await eliminarAutorizacionOffline();

        if (!autorizacionEliminada) {
          throw new Error(
            'No fue posible eliminar la autorizacion offline.'
          );
        }

        const sesionEliminada = await eliminarSesion();

        if (!sesionEliminada) {
          throw new Error(
            'No fue posible eliminar la sesión del almacenamiento seguro.'
          );
        }
      } catch (error) {
        console.warn(
          'HU-14: no fue posible eliminar la sesión local:',
          error?.message || 'Error desconocido'
        );

        Alert.alert(
          'No se pudo completar el cierre de sesión',
          'Ocurrió un problema al eliminar la sesión guardada. Inténtalo nuevamente.'
        );
        setCargando(false);
        return;
      }

      setUsuario(null);
      setSesion(null);
      setModoOffline(false);

      setMateriaSeleccionada(null);
      setActividadSeleccionada(null);
      setActividadDocenteSeleccionada(null);
      setActividadRecursosSeleccionada(null);
      setEntregaSeleccionadaId(null);

      setPantallaActual('dashboard');
      setCorreo('');
      setContrasena('');
      setMostrarContrasena(false);

      console.log(
        'HU-07: cierre de sesión local completado.'
      );

      setCargando(false);
    }
  };

  const handleActivateAccount =
    async (password) => {
      if (!activationAccessToken) {
        Alert.alert(
          'Enlace inválido',
          'No fue posible validar la activación.'
        );

        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/users/activar-cuenta`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              accessToken:
                activationAccessToken,

              password,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          Alert.alert(
            'No fue posible activar la cuenta',
            data.message
          );

          return;
        }

        Alert.alert(
          'Cuenta activada',
          'Su cuenta fue activada correctamente. Ya puede iniciar sesión.'
        );

        setModoActivacion(false);
        setActivationAccessToken(null);

        setUsuario(null);
        setSesion(null);
        setCorreo('');
        setContrasena('');
      } catch (error) {
        console.log(
          'Error activando cuenta:',
          error
        );

        Alert.alert(
          'Error de conexión',
          'No fue posible conectarse con el servidor.'
        );
      }
    };

  const handleMandatoryPasswordChanged =
    async () => {
      const usuarioActualizado = {
        ...usuario,
        debeCambiarPassword: false,
        passwordCambiadoAt:
          new Date().toISOString(),
      };

      const guardado =
        await guardarSesion({
          usuario: usuarioActualizado,
          session: sesion,
        });

      if (!guardado) {
        Alert.alert(
          'Advertencia',
          'La contraseña cambió, pero no se pudo actualizar la sesión guardada. Cierre sesión y vuelva a ingresar.'
        );
      }

      setUsuario(usuarioActualizado);
    };

  if (
    recuperandoPassword &&
    correoRecuperacion
  ) {
    return (
      <ResetPasswordScreen
        apiUrl={API_URL}
        recoveryEmail={
          correoRecuperacion
        }
        onPasswordChanged={
          async () => {
            setRecuperandoPassword(
              false
            );

            setSesionRecuperacion(
              null
            );
            setCorreoRecuperacion(
              null
            );

            await eliminarSesion();

            setUsuario(null);
            setSesion(null);
            setCorreo('');
            setContrasena('');
          }
        }
      />
    );
  }

  /**
   * Mientras verificamos si existe
   * una sesión guardada mostramos carga.
   */
  if (cargandoSesion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#1F4E79"
        />

        <Text style={styles.loadingText}>
          Cargando AULA-AI...
        </Text>
      </View>
    );
  }

  // =====================================================
  // HU-14 | PANTALLA ACADEMICA OFFLINE
  // =====================================================

  if (modoOffline && usuarioOffline?.id) {
    return (
      <AcademicOfflineScreen
        usuario={usuarioOffline}
        onBack={() => {
          // Impide que una reconexion pendiente
          // restaure la sesion despues de salir.
          salidaOfflineSolicitada.current = true;

          setUsuarioOffline(null);
          setModoOffline(false);
          setUsuario(null);
          setSesion(null);
        }}
      />
    );
  }

  if (
    usuario?.debeCambiarPassword === true
  ) {
    return (
      <MandatoryPasswordChangeScreen
        usuario={usuario}
        apiUrl={API_URL}
        accessToken={
          sesion?.accessToken
        }
        onLogout={handleLogout}
        onPasswordChanged={
          handleMandatoryPasswordChanged
        }
      />
    );
  }

  if (modoActivacion) {
    return (
      <ActivateAccountScreen
        onActivate={
          handleActivateAccount
        }

        onCancel={() => {
          setModoActivacion(false);
          setActivationAccessToken(null);
        }}
      />
    );
  }

  // =====================================================
  // 1. REGISTRAR MATERIA
  // =====================================================

  if (
    usuario &&
    pantallaActual === 'editarMateria' &&
    materiaSeleccionada
  ) {
    if (
      usuario.rol !== 'administrador' &&
      usuario.rol !== 'coordinador'
    ) {
      setPantallaActual('dashboard');
    } else {
      return (
        <EditSubjectScreen
          subject={materiaSeleccionada}
          accessToken={sesion?.accessToken}
          apiUrl={API_URL}
          onBack={() => {
            setMateriaSeleccionada(null);

            setPantallaActual(
              'gestionMaterias'
            );
          }}
          onUpdated={() => {
            setMateriaSeleccionada(null);

            setPantallaActual(
              'gestionMaterias'
            );
          }}
        />
      );
    }
  }

  if (
    usuario &&
    pantallaActual === 'registrarMateria'
  ) {
    if (
      usuario.rol !== 'administrador' &&
      usuario.rol !== 'coordinador'
    ) {
      setPantallaActual('dashboard');
    } else {
      return (
        <RegisterSubjectScreen
          accessToken={sesion?.accessToken}
          apiUrl={API_URL}
          onBack={() =>
            setPantallaActual(
              'gestionMaterias'
            )
          }
          onSuccess={() =>
            setPantallaActual(
              'gestionMaterias'
            )
          }
        />
      );
    }
  }

  // =====================================================
  // 2. GESTIÓN DE MATERIAS
  // =====================================================

  if (
    usuario &&
    pantallaActual === 'gestionMaterias'
  ) {
    if (
      usuario.rol !== 'administrador' &&
      usuario.rol !== 'coordinador'
    ) {
      setPantallaActual('dashboard');
    } else {
      return (
        <SubjectManagementScreen
          rol={usuario.rol}
          accessToken={
            sesion?.accessToken
          }
          apiUrl={API_URL}
          onBack={() =>
            setPantallaActual('dashboard')
          }
          onRegisterSubject={() =>
            setPantallaActual(
              'registrarMateria'
            )
          }
          onEditSubject={(materia) => {
            setMateriaSeleccionada(
              materia
            );

            setPantallaActual(
              'editarMateria'
            );
          }}
        />
      );
    }
  }

  // ====================================================
  // HU-13 | UBICACIÓN DEL DISPOSITIVO
  // ====================================================

  if (
    usuario &&
    pantallaActual === 'ubicacionDispositivo'
  ) {
    return (
      <LocationScreen
        onBack={() => {
          setPantallaActual('dashboard');
        }}
      />
    );
  }

  // ====================================================
  // ADMINISTRADOR | ROLES Y PERMISOS
  // ====================================================

  if (
    usuario?.rol === 'administrador' &&
    pantallaActual === 'monitoreoSistema'
  ) {
    return (
      <SystemMonitoringScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        onBack={() => {
          setPantallaActual('dashboard');
        }}
      />
    );
  }

  if (
    usuario?.rol === 'administrador' &&
    pantallaActual === 'rolesPermisos'
  ) {
    return (
      <RolesPermissionsScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        onBack={() => {
          setPantallaActual('dashboard');
        }}
        onManageUsers={(rol) => {
          setRolUsuariosSeleccionado(rol);
          setPantallaActual('usuariosPorRol');
        }}
      />
    );
  }

  if (
    usuario?.rol === 'administrador' &&
    pantallaActual === 'usuariosPorRol' &&
    rolUsuariosSeleccionado
  ) {
    return (
      <RoleUsersScreen
        rol={rolUsuariosSeleccionado}
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        onBack={() => {
          setPantallaActual('rolesPermisos');
        }}
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'periodosAcademicos'
  ) {
    if (
      usuario.rol !== 'coordinador' &&
      usuario.rol !== 'administrador'
    ) {
      setPantallaActual('dashboard');
    } else {
      return (
        <AcademicPeriodsScreen
          apiUrl={API_URL}
          accessToken={sesion?.accessToken}
          onBack={() =>
            setPantallaActual('dashboard')
          }
        />
      );
    }
  }

  if (
    usuario &&
    pantallaActual === 'registrarUsuario'
  ) {
    if (
      usuario.rol !== 'administrador' &&
      usuario.rol !== 'coordinador'
    ) {
      setPantallaActual('dashboard');
    } else {
      return (
        <RegisterUserScreen
          rol={usuario.rol}
          accessToken={
            sesion?.accessToken
          }
          apiUrl={API_URL}
          onBack={() =>
            setPantallaActual('dashboard')
          }
        />
      );
    }
  }

  if (
    usuario &&
    pantallaActual === 'revisionExcusas'
  ) {
    if (usuario.rol !== 'docente' && usuario.rol !== 'coordinador') {
      setPantallaActual('dashboard');
    } else {
      return (
        <ExcuseReviewScreen
          apiUrl={API_URL}
          accessToken={sesion?.accessToken}
          usuarioId={usuario?.id}
          onBack={() =>
            setPantallaActual('dashboard')
          }
        />
      );
    }
  }

  if (
    usuario &&
    pantallaActual === 'misEstudiantesDocente'
  ) {
    if (usuario.rol !== 'docente') {
      setPantallaActual('dashboard');
    } else {
      return (
        <MyStudentsScreen
          apiUrl={API_URL}
          accessToken={sesion?.accessToken}
          onBack={() =>
            setPantallaActual('dashboard')
          }
        />
      );
    }
  }

  if (
    usuario &&
    pantallaActual === 'misMateriasDocente'
  ) {
    return (
      <MySubjectsScreen
        accessToken={sesion?.accessToken}
        apiUrl={API_URL}
        endpoint="/api/subjects/mis-materias"
        usuarioId={usuario.id}
        tipoUsuario="docente"
        title="Mis materias"
        onBack={() =>
          setPantallaActual('dashboard')
        }
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'misMateriasEstudiante'
  ) {
    return (
      <MySubjectsScreen
        accessToken={sesion?.accessToken}
        apiUrl={API_URL}
        endpoint="/api/subjects/mis-materias-estudiante"
        usuarioId={usuario.id}
        tipoUsuario="estudiante"
        title="Mis materias"
        onBack={() =>
          setPantallaActual('dashboard')
        }
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'actividadesAcademicas'
  ) {
    return (
      <AcademicActivitiesScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        onBack={() =>
          setPantallaActual('dashboard')
        }
        onRegisterActivity={() =>
          setPantallaActual(
            'registrarActividad'
          )
        }
        onViewSubmissions={(actividad) => {
          setActividadDocenteSeleccionada(
            actividad
          );

          setPantallaActual(
            'entregasActividad'
          );
        }}
        onViewResources={(actividad) => {
          setActividadRecursosSeleccionada(
            actividad
          );

          setPantallaActual(
            'recursosActividad'
          );
        }}
      />
    );
  }

  if (
    usuario &&
    pantallaActual ===
      'recursosActividad' &&
    actividadRecursosSeleccionada
  ) {
    return (
      <ActivityResourcesScreen
        apiUrl={API_URL}
        accessToken={
          sesion?.accessToken
        }
        actividad={
          actividadRecursosSeleccionada
        }
        onBack={() => {
          setActividadRecursosSeleccionada(
            null
          );

          setPantallaActual(
            'actividadesAcademicas'
          );
        }}
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'entregasActividad' &&
    actividadDocenteSeleccionada
  ) {
    return (
      <ActivitySubmissionsScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        activity={
          actividadDocenteSeleccionada
        }
        onBack={() => {
          setActividadDocenteSeleccionada(
            null
          );

          setPantallaActual(
            'actividadesAcademicas'
          );
        }}
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'registrarActividad'
  ) {
    return (
      <RegisterActivityScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        onBack={() =>
          setPantallaActual(
            'actividadesAcademicas'
          )
        }
        onRegistered={() =>
          setPantallaActual(
            'actividadesAcademicas'
          )
        }
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'misActividadesEstudiante'
  ) {
    return (
      <StudentActivitiesScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        usuarioId={usuario.id}
        onBack={() =>
          setPantallaActual('dashboard')
        }
        onSubmitActivity={(actividad) => {
          setActividadSeleccionada(
            actividad
          );

          setPantallaActual(
            'entregarActividad'
          );
        }}
        onViewSubmission={(entregaId) => {
          setEntregaSeleccionadaId(
            entregaId
          );

          setPantallaActual(
            'verMiEntrega'
          );
        }}
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'calificacionesDocente'
  ) {
    return (
      <TeacherGradesScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        onBack={() =>
          setPantallaActual('dashboard')
        }
      />
    );
  }

  if (
    usuario?.rol === 'docente' &&
    pantallaActual === 'asistenciaDocente'
  ) {
    return (
      <AttendanceScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        usuarioId={usuario.id}
        onBack={() =>
          setPantallaActual('dashboard')
        }
      />
    );
  }

  if (
    usuario?.rol === 'estudiante' &&
    pantallaActual === 'miAsistenciaEstudiante'
  ) {
    return (
      <StudentAttendanceScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        usuarioId={usuario.id}
        onBack={() => setPantallaActual('dashboard')}
      />
    );
  }

  // ====================================================
  // HU-12 | PUBLICAR COMUNICADOS
  // ====================================================

  if (
    ['administrador', 'coordinador'].includes(usuario?.rol) &&
    pantallaActual === 'publicarComunicado'
  ) {
    return (
      <PublishCommunicationScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        rol={usuario.rol}
        onBack={() => setPantallaActual('dashboard')}
        onSuccess={() => setPantallaActual('dashboard')}
      />
    );
  }

  if (
    [
      'administrador',
      'estudiante',
      'acudiente',
      'docente',
      'orientador',
      'coordinador',
    ].includes(usuario?.rol) &&
    pantallaActual === 'misComunicadosEstudiante'
  ) {
    return (
      <StudentCommunicationsScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        onBack={() => setPantallaActual('dashboard')}
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'misCalificacionesEstudiante'
  ) {
    return (
      <StudentGradesScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        usuarioId={usuario.id}
        onBack={() =>
          setPantallaActual('dashboard')
        }
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'verMiEntrega' &&
    entregaSeleccionadaId
  ) {
    return (
      <MySubmissionScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        entregaId={
          entregaSeleccionadaId
        }
        onBack={() =>
          setPantallaActual(
            'misActividadesEstudiante'
          )
        }
        onUndo={() => {
          setEntregaSeleccionadaId(
            null
          );

          setPantallaActual(
            'misActividadesEstudiante'
          );
        }}
      />
    );
  }

  if (
    usuario &&
    pantallaActual === 'entregarActividad' &&
    actividadSeleccionada
  ) {
    return (
      <SubmitActivityScreen
        apiUrl={API_URL}
        accessToken={sesion?.accessToken}
        activity={
          actividadSeleccionada
        }
        onBack={() =>
          setPantallaActual(
            'misActividadesEstudiante'
          )
        }
        onSubmitted={() => {
          setActividadSeleccionada(null);

          setPantallaActual(
            'misActividadesEstudiante'
          );
        }}
      />
    );
  }

  /**
   * Usuario autenticado.
   */
  if (usuario) {
    switch (usuario.rol) {
      case 'administrador':
        return (
          <AdminDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={accessToken}
            onLogout={handleLogout}
            onRegisterUser={() =>
              setPantallaActual(
                'registrarUsuario'
              )
            }
            onManageSubjects={() =>
              setPantallaActual(
                'gestionMaterias'
              )
            }
            onManagePeriods={() =>
              setPantallaActual(
                'periodosAcademicos'
              )
            }
            onMyCommunications={() =>
              setPantallaActual(
                'misComunicadosEstudiante'
              )
            }
            onPublishCommunication={() =>
              setPantallaActual('publicarComunicado')
            }
            onManageRoles={() =>
              setPantallaActual('rolesPermisos')
            }
            onSystemMonitoring={() =>
              setPantallaActual('monitoreoSistema')
            }
            onLocation={() => {
              setPantallaActual('ubicacionDispositivo');
            }}
          />
        );

      case 'coordinador':
        return (
          <CoordinatorDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={accessToken}
            onLogout={handleLogout}
            onRegisterUser={() =>
              setPantallaActual(
                'registrarUsuario'
              )
            }
            onManageSubjects={() =>
              setPantallaActual(
                'gestionMaterias'
              )
            }
            onManagePeriods={() =>
              setPantallaActual(
                'periodosAcademicos'
              )
            }
            onReviewExcuses={() =>
              setPantallaActual('revisionExcusas')
            }
            onMyCommunications={() =>
              setPantallaActual(
                'misComunicadosEstudiante'
              )
            }
            onPublishCommunication={() =>
              setPantallaActual('publicarComunicado')
            }
            onLocation={() =>
              setPantallaActual('ubicacionDispositivo')
            }
          />
        );

      case 'orientador':
        return (
          <OrientadorDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={sesion?.accessToken}
            onLogout={handleLogout}
            onMyCommunications={() =>
              setPantallaActual(
                'misComunicadosEstudiante'
              )
            }
            onLocation={() =>
              setPantallaActual('ubicacionDispositivo')
            }
          />
        );

      case 'docente':
        return (
          <DocenteDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={accessToken}
            onLogout={handleLogout}
            onMySubjects={() =>
              setPantallaActual(
                'misMateriasDocente'
              )
            }
            onMyStudents={() =>
              setPantallaActual(
                'misEstudiantesDocente'
              )
            }
            onAcademicActivities={() =>
              setPantallaActual(
                'actividadesAcademicas'
              )
            }
            onGrades={() =>
              setPantallaActual(
                'calificacionesDocente'
              )
            }
            onAttendance={() =>
              setPantallaActual(
                'asistenciaDocente'
              )
            }
            onReviewExcuses={() =>
              setPantallaActual('revisionExcusas')
            }
            onMyCommunications={() =>
              setPantallaActual(
                'misComunicadosEstudiante'
              )
            }
            onLocation={() =>
              setPantallaActual('ubicacionDispositivo')
            }
          />
        );

      case 'acudiente':
        return (
          <AcudienteDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={sesion?.accessToken}
            onRefreshSession={renovarSesionAutenticada}
            onLogout={handleLogout}
            onMyCommunications={() =>
              setPantallaActual(
                'misComunicadosEstudiante'
              )
            }
            onLocation={() =>
              setPantallaActual('ubicacionDispositivo')
            }
          />
        );

      case 'estudiante':
        return (
          <EstudianteDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={accessToken}
            onLogout={handleLogout}
            onMySubjects={() =>
              setPantallaActual(
                'misMateriasEstudiante'
              )
            }
            onMyActivities={() =>
              setPantallaActual(
                'misActividadesEstudiante'
              )
            }
            onMyAttendance={() => setPantallaActual('miAsistenciaEstudiante')}
            onMyGrades={() =>
              setPantallaActual(
                'misCalificacionesEstudiante'
              )
            }
            onMyCommunications={() =>
              setPantallaActual(
                'misComunicadosEstudiante'
              )
            }
            onLocation={() =>
              setPantallaActual('ubicacionDispositivo')
            }
            onRefreshSession={
              renovarSesionAutenticada
            }
          />
        );

      default:
        return (
          <View style={styles.container}>
            <Text style={styles.title}>
              AULA-AI
            </Text>

            <Text style={styles.subtitle}>
              El usuario no tiene un rol válido.
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogout}
            >
              <Text style={styles.buttonText}>
                Cerrar sesión
              </Text>
            </TouchableOpacity>
          </View>
        );
    }
  }

  /**
   * Usuario no autenticado.
   */
  return (
    <LoginScreen
      correo={correo}
      setCorreo={setCorreo}
      contrasena={contrasena}
      setContrasena={setContrasena}
      mostrarContrasena={mostrarContrasena}
      setMostrarContrasena={setMostrarContrasena}
      cargando={cargando}
      onLogin={handleLogin}
      onForgotPassword={handleRecuperarPassword}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#5F6B7A',
  },

  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F4E79',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#5F6B7A',
    marginBottom: 40,
    lineHeight: 22,
  },

  roleText: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 30,
  },

  button: {
    backgroundColor: '#1F4E79',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 5,
    minHeight: 52,
    justifyContent: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

});