import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
import CoordinatorDashboard from './src/screens/CoordinatorDashboard';
import OrientadorDashboard from './src/screens/OrientadorDashboard';
import DocenteDashboard from './src/screens/DocenteDashboard';
import AcudienteDashboard from './src/screens/AcudienteDashboard';
import EstudianteDashboard from './src/screens/EstudianteDashboard';

import {
  eliminarSesion,
  guardarSesion,
  obtenerSesion,
} from './src/services/sessionService';
import {
  registrarDispositivoEnBackend,
} from './src/services/notificationService';
import { API_URL } from './src/config/apiConfig';

export default function App() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');

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
    modoRecuperacion,
    setModoRecuperacion,
  ] = useState(false);

  const [
    recoveryAccessToken,
    setRecoveryAccessToken,
  ] = useState(null);

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
      4000
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

  const procesarDeepLink = (url) => {
    if (!url) {
      return;
    }

    console.log(
      'Deep link recibido:',
      url
    );

    // Primero verificamos si realmente
    // es un enlace que AULA-AI debe procesar.
    const esActivacion =
      url.includes('activate-account');

    const esRecuperacion =
      url.includes('reset-password');

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
      setRecoveryAccessToken(
        accessToken
      );

      setModoRecuperacion(true);
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
          ? 'El servidor no respondió en 4 segundos. Verifique que el backend de AULA-AI esté activo.'
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

      const response = await fetch(
        `${API_URL}/api/auth/recuperar-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: correo.trim().toLowerCase(),
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

      Alert.alert(
        'Revisa tu correo',
        data.message
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

  /**
   * Cierra la sesión y elimina
   * cualquier información guardada.
   */
  const handleLogout = async () => {
    try {
      if (sesion?.accessToken) {
        await fetch(
          `${API_URL}/api/auth/logout`,
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${sesion.accessToken}`,
            },
          }
        );
      }
    } catch (error) {
      console.log(
        'Error notificando logout al servidor:',
        error
      );
    } finally {
      await eliminarSesion();

      setUsuario(null);
      setSesion(null);

      setCorreo('');
      setContrasena('');
    }
  };

  const handleActualizarPassword =
    async (nuevaPassword) => {
      if (!recoveryAccessToken) {
        Alert.alert(
          'Enlace inválido',
          'No fue posible validar el enlace de recuperación.'
        );

        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/auth/actualizar-password`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              accessToken:
                recoveryAccessToken,

              nuevaPassword,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          Alert.alert(
            'No fue posible actualizar',
            data.message
          );

          return;
        }

        Alert.alert(
          'Contraseña actualizada',
          'Ya puede iniciar sesión con su nueva contraseña.'
        );

        setModoRecuperacion(false);
        setRecoveryAccessToken(null);

        await eliminarSesion();

        setUsuario(null);
        setSesion(null);
      } catch (error) {
        console.log(
          'Error actualizando contraseña:',
          error
        );

        Alert.alert(
          'Error',
          'No fue posible actualizar la contraseña.'
        );
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

  if (modoRecuperacion) {
    return (
      <ResetPasswordScreen
        onActualizarPassword={
          handleActualizarPassword
        }

        onCancelar={() => {
          setModoRecuperacion(false);
          setRecoveryAccessToken(null);
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
          />
        );

      case 'orientador':
        return (
          <OrientadorDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={sesion?.accessToken}
            onLogout={handleLogout}
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
          />
        );

      case 'acudiente':
        return (
          <AcudienteDashboard
            usuario={usuario}
            apiUrl={API_URL}
            accessToken={sesion?.accessToken}
            onLogout={handleLogout}
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
            onMyGrades={() =>
              setPantallaActual(
                'misCalificacionesEstudiante'
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
    <View style={styles.container}>
      <Text style={styles.title}>
        AULA-AI
      </Text>

      <Text style={styles.subtitle}>
        Sistema inteligente de alerta temprana y acompañamiento escolar
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>
          Correo institucional
        </Text>

        <TextInput
          style={styles.input}
          placeholder="usuario@institucion.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={correo}
          onChangeText={setCorreo}
          editable={!cargando}
        />

        <Text style={styles.label}>
          Contraseña
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ingrese su contraseña"
          secureTextEntry
          value={contrasena}
          onChangeText={setContrasena}
          editable={!cargando}
        />

        <TouchableOpacity
          style={[
            styles.button,
            cargando &&
              styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.buttonText}>
              Iniciar sesión
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          disabled={cargando}
          onPress={handleRecuperarPassword}
        >
          <Text style={styles.forgotPassword}>
            ¿Olvidaste tu contraseña?
          </Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </View>
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

  form: {
    width: '100%',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#263238',
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 20,
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

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  forgotPassword: {
    textAlign: 'center',
    color: '#1F4E79',
    marginTop: 20,
    fontSize: 14,
  },
});