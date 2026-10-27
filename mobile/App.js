import * as Linking from 'expo-linking';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  supabase,
  supabaseConfigurado,
} from './supabaseClient';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import LoginScreen from './src/components/LoginScreen';
import AdminDashboard from './src/screens/AdminDashboard';
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
  registrarDispositivoEnBackend,
} from './src/services/notificationService';
import { API_URL } from './src/config/apiConfig';
import {
  eliminarHistorialEstudianteOffline,
} from './src/database/studentAcademicOfflineDatabase';
import {
  eliminarCacheAcademicaLocal,
} from './database/localDatabase';

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

  const [
    materiaSeleccionada,
    setMateriaSeleccionada,
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
    sesionRecuperacion,
    setSesionRecuperacion,
  ] = useState(null);

  const [
    correoRecuperacion,
    setCorreoRecuperacion,
  ] = useState(null);

  const procesandoEnlaceRecuperacion =
    useRef(false);

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

  useEffect(() => {
    const registrarPush = async () => {
      if (
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
    accessToken,
    usuario,
  ]);

  const fetchConTimeout = async (
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
  };

  /**
   * Al abrir la aplicación verificamos
   * si existe una sesión guardada.
   */
  useEffect(() => {
    cargarSesionGuardada();
  }, []);

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
      if (
        !supabaseConfigurado ||
        !supabase
      ) {
        console.log(
          'Supabase móvil no está configurado.'
        );

        return;
      }

      const query =
        url.split('#')[0].split('?')[1] ||
        '';
      const fragment =
        url.split('#')[1] || '';

      const parametros =
        new URLSearchParams(
          `${query}&${fragment}`
        );

      const accessTokenRecuperacion =
        parametros.get(
          'access_token'
        );

      const refreshTokenRecuperacion =
        parametros.get(
          'refresh_token'
        );

      const tipo =
        parametros.get('type');

      if (
        tipo &&
        tipo !== 'recovery'
      ) {
        return;
      }

      if (
        !accessTokenRecuperacion ||
        !refreshTokenRecuperacion
      ) {
        Alert.alert(
          'Enlace inválido',
          'El enlace de recuperación no contiene una sesión válida.'
        );

        return;
      }

      if (
        procesandoEnlaceRecuperacion.current
      ) {
        return;
      }

      procesandoEnlaceRecuperacion.current =
        true;

      let data;
      let error;

      try {
        ({
          data,
          error,
        } = await supabase.auth.setSession({
          access_token:
            accessTokenRecuperacion,
          refresh_token:
            refreshTokenRecuperacion,
        }));
      } catch (errorSesion) {
        procesandoEnlaceRecuperacion.current =
          false;

        console.log(
          'Error estableciendo sesión de recuperación:',
          errorSesion
        );

        Alert.alert(
          'Enlace inválido',
          'No fue posible validar la sesión de recuperación. Solicite un nuevo enlace.'
        );

        return;
      }

      if (error || !data?.session) {
        procesandoEnlaceRecuperacion.current =
          false;

        console.log(
          'Error estableciendo sesión de recuperación:',
          error?.message
        );

        Alert.alert(
          'Enlace inválido',
          'No fue posible validar la sesión de recuperación. Solicite un nuevo enlace.'
        );

        return;
      }

      console.log(
        'Sesión de recuperación establecida correctamente.'
      );

      setSesionRecuperacion(
        data.session
      );
      setCorreoRecuperacion(
        data.session.user?.email || null
      );

      setRecuperandoPassword(true);
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

  const cargarSesionGuardada = async () => {
    try {
      const datosGuardados =
        await obtenerSesion();

      if (
        !datosGuardados?.session?.accessToken ||
        !datosGuardados?.session?.refreshToken
      ) {
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

        setUsuario(data.usuario);
        setSesion(datosGuardados.session);

        await guardarSesion(
          sesionActualizada
        );

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
        await eliminarSesion();

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

      setUsuario(refreshData.usuario);
      setSesion(refreshData.session);
    } catch (error) {
      console.log(
        'Error validando o renovando sesión:',
        error
      );

      /**
       * No eliminamos automáticamente los datos
       * solamente por un problema de red.
       *
       * HU-14 definirá posteriormente
       * el funcionamiento offline.
       */
      setUsuario(null);
      setSesion(null);
    } finally {
      setCargandoSesion(false);
    }
  };

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
              setSesionRecuperacion(null);
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
        await eliminarSesion();
      } catch (error) {
        console.warn(
          'HU-07: no fue posible eliminar la sesión local:',
          error.message
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
    (
      sesionRecuperacion ||
      correoRecuperacion
    )
  ) {
    return (
      <ResetPasswordScreen
        apiUrl={API_URL}
        recoveryEmail={
          correoRecuperacion
        }
        recoverySession={
          sesionRecuperacion
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

            procesandoEnlaceRecuperacion.current =
              false;

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
            onMyCommunications={() =>
              setPantallaActual(
                'misComunicadosEstudiante'
              )
            }
            onPublishCommunication={() =>
              setPantallaActual('publicarComunicado')
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
          />
        );

      case 'acudiente':
        return (
          <AcudienteDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={sesion?.accessToken}
            onLogout={handleLogout}
            onMyCommunications={() =>
              setPantallaActual(
                'misComunicadosEstudiante'
              )
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