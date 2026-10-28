
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import DateTimePicker from
  '@react-native-community/datetimepicker';

import ProfileDashboardHeader from
  '../components/ProfileDashboardHeader';

import GuardianAcademicAlerts from
  '../components/GuardianAcademicAlerts';

import GuardianExcuses from
  '../components/GuardianExcuses';

// =====================================================
// AULA-AI | HU-08
// PANEL PROFESIONAL DEL ACUDIENTE
//
// - Múltiples estudiantes autorizados.
// - Resumen académico.
// - Calificaciones por período.
// - Actividades y evaluaciones.
// - Asistencia con filtros avanzados.
// - Calendario para rango de fechas.
// - Filtros por materia, día y estado.
// - Consultas exclusivamente de lectura.
// =====================================================

const C = {
  fondo: '#F4F7FB',
  blanco: '#FFFFFF',
  azul: '#123B73',
  azulOscuro: '#091D3A',
  azulSuave: '#EAF3FC',
  cyan: '#27C4E8',
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

const PESTANAS = [
  ['resumen', 'Resumen', 'grid-outline'],
  ['notas', 'Calificaciones', 'ribbon-outline'],
  ['actividades', 'Actividades', 'clipboard-outline'],
  ['asistencia', 'Asistencia', 'calendar-outline'],
  ['excusas', 'Excusas', 'document-text-outline'],
  ['alertas', 'Alertas', 'notifications-outline'],
];

const TIPOS = [
  ['todas', 'Todas'],
  ['tarea', 'Tareas'],
  ['actividad', 'Actividades'],
  ['examen', 'Exámenes'],
];

const DIAS = [
  ['todos', 'Todos los días'],
  ['1', 'Lunes'],
  ['2', 'Martes'],
  ['3', 'Miércoles'],
  ['4', 'Jueves'],
  ['5', 'Viernes'],
  ['6', 'Sábado'],
  ['0', 'Domingo'],
];

const ESTADOS = [
  ['todos', 'Todos'],
  ['presente', 'Presentes'],
  ['ausente', 'Ausentes'],
  ['tarde', 'Llegadas tarde'],
];

const relacion = (dato) =>
  Array.isArray(dato)
    ? dato[0] || null
    : dato || null;

const nombreCompleto = (item) =>
  item?.nombreCompleto ||
  [item?.nombres, item?.apellidos]
    .filter(Boolean)
    .join(' ') ||
  'Estudiante';

const nombreRelacion = (dato) =>
  typeof dato === 'string'
    ? dato
    : relacion(dato)?.nombre || 'No asignado';

const notaTexto = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return 'Sin notas';
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero.toFixed(2)
    : 'Sin notas';
};

const fechaClave = (valor) => {
  if (!valor) return null;

  const texto = String(valor);

  // Evitar desplazamientos de día en fechas SQL DATE.
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const fecha = new Date(texto);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1)
    .padStart(2, '0');
  const d = String(fecha.getDate())
    .padStart(2, '0');

  return `${y}-${m}-${d}`;
};

const fechaLocal = (clave) => {
  if (!clave) return null;

  const partes = clave.split('-').map(Number);

  if (partes.length !== 3) return null;

  const [anio, mes, dia] = partes;

  const fecha = new Date(
    anio,
    mes - 1,
    dia,
    12,
    0,
    0
  );

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

const fechaVisible = (valor) => {
  const clave = fechaClave(valor);
  const fecha = fechaLocal(clave);

  return fecha
    ? fecha.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Sin fecha';
};

const diaSemana = (valor) => {
  const fecha = fechaLocal(fechaClave(valor));

  return fecha ? String(fecha.getDay()) : null;
};

const tipoTexto = (tipo) => {
  if (tipo === 'tarea') return 'Tarea';
  if (tipo === 'examen') return 'Examen';
  return 'Actividad';
};

const asistenciaEstado = (estado) => {
  if (estado === 'presente') {
    return {
      texto: 'Presente',
      color: C.verde,
      fondo: C.verdeSuave,
    };
  }

  if (estado === 'ausente') {
    return {
      texto: 'Ausente',
      color: C.rojo,
      fondo: C.rojoSuave,
    };
  }

  if (estado === 'tarde') {
    return {
      texto: 'Llegada tarde',
      color: C.amarillo,
      fondo: C.amarilloSuave,
    };
  }

  return {
    texto: estado || 'Sin estado',
    color: C.gris,
    fondo: C.azulSuave,
  };
};

const actividadEstado = (actividad) => {
  if (actividad.entrega) {
    const tarde =
      actividad.entrega.estado === 'entregada_tarde' ||
      actividad.entrega.entregada_tarde;

    return tarde
      ? {
          texto: 'Entregada tarde',
          color: C.amarillo,
          fondo: C.amarilloSuave,
        }
      : {
          texto: 'Entrega registrada',
          color: C.verde,
          fondo: C.verdeSuave,
        };
  }

  const limite = actividad.fecha_entrega
    ? new Date(actividad.fecha_entrega)
    : null;

  const vencida =
    limite &&
    !Number.isNaN(limite.getTime()) &&
    limite.getTime() < Date.now();

  return vencida
    ? {
        texto: 'Sin entrega · Plazo vencido',
        color: C.rojo,
        fondo: C.rojoSuave,
      }
    : {
        texto: 'Sin entrega registrada',
        color: C.amarillo,
        fondo: C.amarilloSuave,
      };
};

async function getApi(url, token, signal) {
  if (!token) {
    throw new Error(
      'La sesión no está disponible. Inicia sesión nuevamente.'
    );
  }

  let respuesta;

  try {
    respuesta = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal,
    });
  } catch (error) {
    // Mantener la cancelación de solicitudes cuando
    // se cambia de estudiante o se cierra sesión.
    if (signal?.aborted || error?.name === 'AbortError') {
      throw error;
    }

    throw new Error(
      'No fue posible conectar con AULA-AI. ' +
      'Comprueba tu conexión a Internet ' +
      'e inténtalo nuevamente.'
    );
  }

  let datos;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(
      'El servidor devolvió una respuesta no válida. ' +
      'Inténtalo nuevamente.'
    );
  }

  if (!respuesta.ok || datos?.success !== true) {
    const error = new Error(
      respuesta.status === 401 ||
      respuesta.status === 403
        ? 'La sesión o vinculación no permite consultar estos datos.'
        : datos?.message ||
          'No fue posible consultar la información.'
    );

    error.status = respuesta.status;
    throw error;
  }

  return datos;
}

// =====================================================
// COMPONENTES VISUALES
// =====================================================

function Boton({
  texto,
  onPress,
  ocupado = false,
  principal = false,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.boton,
        principal && styles.botonPrincipal,
      ]}
      onPress={onPress}
      disabled={ocupado}
      accessibilityRole="button"
    >
      {ocupado ? (
        <ActivityIndicator
          color={principal ? C.blanco : C.azul}
        />
      ) : (
        <Text
          style={[
            styles.botonTexto,
            principal && styles.botonTextoBlanco,
          ]}
        >
          {texto}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function Mensaje({
  titulo,
  texto,
  error = false,
  reintentar,
}) {
  return (
    <View style={styles.mensaje}>
      <Text
        style={[
          styles.mensajeTitulo,
          error && { color: C.rojo },
        ]}
      >
        {titulo}
      </Text>

      <Text style={styles.mensajeTexto}>
        {texto}
      </Text>

      {reintentar && (
        <Boton
          texto="Reintentar"
          principal
          onPress={reintentar}
        />
      )}
    </View>
  );
}

function Cargando({ texto }) {
  return (
    <View style={styles.cargando}>
      <ActivityIndicator
        size="large"
        color={C.azul}
      />
      <Text style={styles.cargandoTexto}>
        {texto}
      </Text>
    </View>
  );
}

function Contador({ valor, titulo }) {
  return (
    <View style={styles.contador}>
      <Text style={styles.contadorNumero}>
        {valor ?? 0}
      </Text>
      <Text style={styles.contadorTitulo}>
        {titulo}
      </Text>
    </View>
  );
}

function Etiqueta({ texto, color, fondo }) {
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

function Titulo({ titulo, descripcion }) {
  return (
    <View style={styles.bloqueTitulo}>
      <Text style={styles.bloqueTituloTexto}>
        {titulo}
      </Text>

      {!!descripcion && (
        <Text style={styles.bloqueDescripcion}>
          {descripcion}
        </Text>
      )}
    </View>
  );
}

function Opciones({
  valores,
  seleccionado,
  onChange,
}) {
  return (
    <View style={styles.opciones}>
      {valores.map(([id, texto]) => {
        const activo =
          String(seleccionado) === String(id);

        return (
          <TouchableOpacity
            key={id}
            onPress={() => onChange(id)}
            style={[
              styles.opcion,
              activo && styles.opcionActiva,
            ]}
            accessibilityRole="button"
            accessibilityState={{
              selected: activo,
            }}
          >
            <Text
              style={[
                styles.opcionTexto,
                activo && styles.opcionTextoActivo,
              ]}
            >
              {texto}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function AcudienteDashboard({
  usuario,
  apiUrl,
  accessToken,
  onLogout,
  onMyCommunications,
}) {
  const [pantalla, setPantalla] =
    useState('inicio');

  const [estudiantes, setEstudiantes] =
    useState([]);

  const [estudiante, setEstudiante] =
    useState(null);

  const [tab, setTab] =
    useState('resumen');

  const [cargandoLista, setCargandoLista] =
    useState(false);

  const [errorLista, setErrorLista] =
    useState('');

  const [notas, setNotas] =
    useState(null);

  const [actividades, setActividades] =
    useState(null);

  const [asistencia, setAsistencia] =
    useState(null);

  const [cargandoDatos, setCargandoDatos] =
    useState(false);

  const [errorDatos, setErrorDatos] =
    useState('');

  const [actualizando, setActualizando] =
    useState(false);

  const [ultimaConsulta, setUltimaConsulta] =
    useState(null);

  const [periodoNotas, setPeriodoNotas] =
    useState(null);

  const [periodoAsistencia, setPeriodoAsistencia] =
    useState('todos');

  const [materiaAsistencia, setMateriaAsistencia] =
    useState('todas');

  const [estadoAsistencia, setEstadoAsistencia] =
    useState('todos');

  const [diaAsistencia, setDiaAsistencia] =
    useState('todos');

  const [desde, setDesde] =
    useState(null);

  const [hasta, setHasta] =
    useState(null);

  const [calendario, setCalendario] =
    useState(null);

  const [filtroActividades, setFiltroActividades] =
    useState('todas');

  const abortLista = useRef(null);
  const abortDatos = useRef(null);

  const versionLista = useRef(0);
  const versionDatos = useRef(0);

  const base = typeof apiUrl === 'string'
    ? apiUrl.trim().replace(/\/+$/, '')
    : '';

  // ===================================================
  // CANCELACIÓN Y LIMPIEZA
  // ===================================================

  const cancelarLista = useCallback(() => {
    versionLista.current += 1;
    abortLista.current?.abort();
    abortLista.current = null;
  }, []);

  const cancelarDatos = useCallback(() => {
    versionDatos.current += 1;
    abortDatos.current?.abort();
    abortDatos.current = null;
  }, []);

  const limpiarFiltrosAsistencia = useCallback(() => {
    setPeriodoAsistencia('todos');
    setMateriaAsistencia('todas');
    setEstadoAsistencia('todos');
    setDiaAsistencia('todos');
    setDesde(null);
    setHasta(null);
    setCalendario(null);
  }, []);

  const limpiarDatos = useCallback(() => {
    cancelarDatos();

    setNotas(null);
    setActividades(null);
    setAsistencia(null);
    setCargandoDatos(false);
    setActualizando(false);
    setErrorDatos('');
    setUltimaConsulta(null);

    setPeriodoNotas(null);
    setFiltroActividades('todas');
    limpiarFiltrosAsistencia();
  }, [cancelarDatos, limpiarFiltrosAsistencia]);

  useEffect(() => {
    cancelarLista();
    cancelarDatos();

    const temporizador = setTimeout(() => {
      limpiarDatos();
      setPantalla('inicio');
      setEstudiantes([]);
      setEstudiante(null);
      setTab('resumen');
      setCargandoLista(false);
      setErrorLista('');
    }, 0);

    return () => {
      clearTimeout(temporizador);
      cancelarLista();
      cancelarDatos();
    };
  }, [
    usuario?.id,
    accessToken,
    cancelarLista,
    cancelarDatos,
    limpiarDatos,
  ]);

  // ===================================================
  // ESTUDIANTES AUTORIZADOS
  // ===================================================

  const cargarEstudiantes = useCallback(async () => {
    cancelarLista();
    limpiarDatos();

    const controller = new AbortController();
    const version = versionLista.current;
    abortLista.current = controller;

    setCargandoLista(true);
    setErrorLista('');
    setEstudiantes([]);
    setEstudiante(null);

    try {
      const datos = await getApi(
        `${base}/api/guardian/mis-estudiantes`,
        accessToken,
        controller.signal
      );

      if (
        controller.signal.aborted ||
        version !== versionLista.current
      ) {
        return;
      }

      if (!Array.isArray(datos.estudiantes)) {
        throw new Error(
          'El servidor no devolvió una lista válida.'
        );
      }

      setEstudiantes(
        datos.estudiantes.filter(
          (item) =>
            item &&
            typeof item.id === 'string'
        )
      );
    } catch (error) {
      if (
        controller.signal.aborted ||
        version !== versionLista.current
      ) {
        return;
      }

      setErrorLista(error.message);
    } finally {
      if (
        !controller.signal.aborted &&
        version === versionLista.current
      ) {
        setCargandoLista(false);
      }
    }
  }, [
    base,
    accessToken,
    cancelarLista,
    limpiarDatos,
  ]);

  useEffect(() => {
    if (pantalla !== 'estudiantes') {
      return undefined;
    }

    const temporizador = setTimeout(() => {
      void cargarEstudiantes();
    }, 0);

    return () => {
      clearTimeout(temporizador);
      cancelarLista();
    };
  }, [
    pantalla,
    cargarEstudiantes,
    cancelarLista,
  ]);

  // ===================================================
  // SEGUIMIENTO ACADÉMICO
  // ===================================================

  const cargarSeguimiento = useCallback(
    async (estudianteId, refrescar = false) => {
      cancelarDatos();

      const controller = new AbortController();
      const version = versionDatos.current;

      abortDatos.current = controller;

      setErrorDatos('');
      setNotas(null);
      setActividades(null);
      setAsistencia(null);

      if (refrescar) {
        setActualizando(true);
      } else {
        setCargandoDatos(true);
      }

      try {
        const ruta =
          `${base}/api/guardian/estudiantes/` +
          encodeURIComponent(estudianteId);

        const [
          respuestaNotas,
          respuestaActividades,
          respuestaAsistencia,
        ] = await Promise.all([
          getApi(
            `${ruta}/calificaciones`,
            accessToken,
            controller.signal
          ),
          getApi(
            `${ruta}/actividades`,
            accessToken,
            controller.signal
          ),
          getApi(
            `${ruta}/asistencia`,
            accessToken,
            controller.signal
          ),
        ]);

        if (
          controller.signal.aborted ||
          version !== versionDatos.current
        ) {
          return;
        }

        const validos =
          respuestaNotas.estudiante?.id === estudianteId &&
          respuestaActividades.estudiante?.id === estudianteId &&
          respuestaAsistencia.estudiante?.id === estudianteId &&
          Array.isArray(
            respuestaNotas.promediosPeriodos
          ) &&
          Array.isArray(
            respuestaNotas.calificaciones
          ) &&
          Array.isArray(
            respuestaActividades.actividades
          ) &&
          Array.isArray(
            respuestaAsistencia.asistencias
          ) &&
          respuestaAsistencia.resumen;

        if (!validos) {
          throw new Error(
            'La respuesta académica está incompleta.'
          );
        }

        setNotas(respuestaNotas);
        setActividades(respuestaActividades);
        setAsistencia(respuestaAsistencia);

        const periodos =
          respuestaNotas.promediosPeriodos;

        setPeriodoNotas((anterior) => {
          const existe = periodos.some(
            (p) =>
              String(p.periodoId) ===
              String(anterior)
          );

          return anterior !== null && existe
            ? anterior
            : respuestaNotas.periodoActual?.id ??
              periodos[0]?.periodoId ??
              null;
        });

        setUltimaConsulta(new Date());
      } catch (error) {
        if (
          controller.signal.aborted ||
          version !== versionDatos.current
        ) {
          return;
        }

        setNotas(null);
        setActividades(null);
        setAsistencia(null);
        setErrorDatos(error.message);
      } finally {
        if (
          !controller.signal.aborted &&
          version === versionDatos.current
        ) {
          setCargandoDatos(false);
          setActualizando(false);
        }
      }
    },
    [base, accessToken, cancelarDatos]
  );

  const seleccionarEstudiante = (item) => {
    const autorizado = estudiantes.find(
      (actual) => actual.id === item?.id
    );

    if (!autorizado) return;

    limpiarDatos();
    setEstudiante(autorizado);
    setTab((actual) =>
      actual === 'alertas'
        ? 'alertas'
        : 'resumen'
    );
  };

  useEffect(() => {
    if (
      pantalla !== 'estudiantes' ||
      !estudiante?.id
    ) {
      return undefined;
    }

    const temporizador = setTimeout(() => {
      void cargarSeguimiento(estudiante.id);
    }, 0);

    return () => {
      clearTimeout(temporizador);
      cancelarDatos();
    };
  }, [
    pantalla,
    estudiante?.id,
    cargarSeguimiento,
    cancelarDatos,
  ]);

  // ===================================================
  // NAVEGACIÓN
  // ===================================================

  const volverInicio = () => {
    cancelarLista();
    limpiarDatos();

    setPantalla('inicio');
    setEstudiantes([]);
    setEstudiante(null);
  };

  const volverLista = () => {
    limpiarDatos();
    setEstudiante(null);
    setTab('resumen');
  };

  const abrirAlertas = () => {
    cancelarLista();
    limpiarDatos();

    setEstudiante(null);
    setEstudiantes([]);
    setTab('alertas');
    setPantalla('estudiantes');
  };

  const cerrarSesion = () => {
    cancelarLista();
    limpiarDatos();

    setEstudiantes([]);
    setEstudiante(null);

    onLogout();
  };

  // ===================================================
  // CALENDARIO
  // ===================================================

  const abrirCalendario = (campo) => {
    setCalendario(campo);
  };

  const cambiarFecha = (evento, nuevaFecha) => {
    const campo = calendario;
    setCalendario(null);

    if (
      evento.type !== 'set' ||
      !nuevaFecha ||
      !campo
    ) {
      return;
    }

    const clave = fechaClave(nuevaFecha);

    if (campo === 'desde') {
      setDesde(clave);

      // Evitar rango invertido.
      if (hasta && clave > hasta) {
        setHasta(null);
      }
    } else {
      setHasta(clave);

      if (desde && clave < desde) {
        setDesde(null);
      }
    }
  };

  // ===================================================
  // ENCABEZADOS
  // ===================================================

  const renderEncabezado = (
    titulo,
    descripcion
  ) => (
    <View style={styles.encabezado}>
      <Text style={styles.tituloPagina}>
        {titulo}
      </Text>

      <Text style={styles.descripcionPagina}>
        {descripcion}
      </Text>
    </View>
  );

  // ===================================================
  // INICIO
  // ===================================================

  const renderInicio = () => (
    <>
      <View style={styles.welcomePanel}>
        <View style={styles.welcomeIcon}>
          <Ionicons
            name="people-outline"
            size={24}
            color={C.cyan}
          />
        </View>

        <Text style={styles.welcomeEyebrow}>
          ACOMPAÑAMIENTO FAMILIAR
        </Text>

        <Text style={styles.welcomeTitle}>
          Seguimiento académico
        </Text>

        <Text style={styles.welcomeDescription}>
          Consulta de forma segura la información
          académica de tus estudiantes vinculados.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.menuCard}
        onPress={() =>
          setPantalla('estudiantes')
        }
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <View style={styles.menuCardTop}>
          <View style={[styles.menuIcon, styles.menuIconBlue]}>
            <Ionicons
              name="people-outline"
              size={24}
              color={C.azul}
            />
          </View>

          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitulo}>
              Estudiantes a cargo
            </Text>

            <Text style={styles.menuDescripcion}>
              Seguimiento académico, calificaciones,
              actividades y asistencia.
            </Text>
          </View>

          <Ionicons
            name="arrow-forward-circle-outline"
            size={24}
            color={C.cyan}
          />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuCard}
        onPress={abrirAlertas}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <View style={styles.menuCardTop}>
          <View style={[styles.menuIcon, styles.menuIconAmber]}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color={C.amarillo}
            />
          </View>

          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitulo}>
              Alertas y notificaciones
            </Text>

            <Text style={styles.menuDescripcion}>
              Avisos académicos e institucionales.
            </Text>
          </View>

          <Ionicons
            name="arrow-forward-circle-outline"
            size={24}
            color={C.cyan}
          />
        </View>
      </TouchableOpacity>

      {/* HU-12 | COMUNICADOS INSTITUCIONALES */}
      {typeof onMyCommunications === 'function' && (
        <TouchableOpacity
          style={styles.menuCard}
          onPress={onMyCommunications}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Consultar mis comunicados institucionales"
        >
          <View style={styles.menuCardTop}>
            <View style={[styles.menuIcon, styles.menuIconPurple]}>
              <Ionicons
                name="megaphone-outline"
                size={24}
                color="#7353B6"
              />
            </View>

            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitulo}>
                Mis comunicados
              </Text>

              <Text style={styles.menuDescripcion}>
                Consulta los avisos, novedades y comunicados
                institucionales dirigidos a ti.
              </Text>
            </View>

            <Ionicons
              name="arrow-forward-circle-outline"
              size={24}
              color={C.cyan}
            />
          </View>
        </TouchableOpacity>
      )}
    </>
  );

  // ===================================================
  // LISTA DE ESTUDIANTES
  // ===================================================

  const renderLista = () => {
    if (cargandoLista) {
      return (
        <Cargando texto="Consultando estudiantes autorizados..." />
      );
    }

    if (errorLista) {
      return (
        <Mensaje
          titulo="No fue posible consultar estudiantes"
          texto={errorLista}
          error
          reintentar={cargarEstudiantes}
        />
      );
    }

    if (estudiantes.length === 0) {
      return (
        <Mensaje
          titulo="Sin estudiantes autorizados"
          texto="No se encontraron vinculaciones activas y verificadas."
          reintentar={cargarEstudiantes}
        />
      );
    }

    return (
      <>
        <View style={styles.totalCard}>
          <Text style={styles.totalNumero}>
            {estudiantes.length}
          </Text>

          <Text style={styles.totalTexto}>
            {estudiantes.length === 1
              ? 'Estudiante autorizado'
              : 'Estudiantes autorizados'}
          </Text>
        </View>

        {estudiantes.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.estudianteCard}
            onPress={() =>
              seleccionarEstudiante(item)
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>
                {nombreCompleto(item)
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.estudianteNombre}>
                {nombreCompleto(item)}
              </Text>

              <Text style={styles.estudianteDetalle}>
                Grado: {nombreRelacion(item.grado)}
                {' · Grupo: '}
                {nombreRelacion(item.grupo)}
              </Text>
            </View>

            <Ionicons
              name="arrow-forward-circle-outline"
              size={25}
              color={C.cyan}
            />
          </TouchableOpacity>
        ))}

        <Boton
          texto="Actualizar estudiantes"
          onPress={cargarEstudiantes}
        />
      </>
    );
  };

  // ===================================================
  // RESUMEN GENERAL
  // ===================================================

  const renderResumen = () => {
    const resumenActividades =
      actividades.resumen || {};

    const resumenAsistencia =
      asistencia.resumen || {};

    const periodo = notas.promediosPeriodos.find(
      (item) =>
        String(item.periodoId) ===
        String(notas.periodoActual?.id)
    );

    return (
      <>
        <Titulo
          titulo="Resumen académico"
          descripcion="Información general del estudiante seleccionado."
        />

        <View style={styles.destacado}>
          <Text style={styles.destacadoEtiqueta}>
            Promedio del período actual
          </Text>

          <Text style={styles.destacadoValor}>
            {notaTexto(periodo?.promedio)}
          </Text>

          <Text style={styles.destacadoDetalle}>
            {periodo?.nombre ||
              'Sin período vigente'}
          </Text>
        </View>

        <View style={styles.contadoresFila}>
          <Contador
            valor={actividades.total}
            titulo="Actividades"
          />
          <Contador
            valor={resumenActividades.conEntrega}
            titulo="Con entrega"
          />
        </View>

        <View style={styles.contadoresFila}>
          <Contador
            valor={resumenAsistencia.presentes}
            titulo="Presentes"
          />
          <Contador
            valor={resumenAsistencia.ausentes}
            titulo="Ausentes"
          />
        </View>

        <View style={styles.contadoresFila}>
          <Contador
            valor={resumenAsistencia.llegadasTarde}
            titulo="Llegadas tarde"
          />
          <Contador
            valor={resumenAsistencia.totalRegistros}
            titulo="Sesiones registradas"
          />
        </View>

        <Mensaje
          titulo="Seguimiento académico"
          texto="Selecciona las pestañas superiores para consultar cada módulo. Los indicadores muestran los registros disponibles en AULA-AI."
        />
      </>
    );
  };

  // ===================================================
  // CALIFICACIONES
  // ===================================================

  const renderNotas = () => {
    const periodos =
      notas.promediosPeriodos || [];

    const periodo = periodos.find(
      (item) =>
        String(item.periodoId) ===
        String(periodoNotas)
    );

    const detalle = notas.calificaciones.filter(
      (nota) => {
        const actividad = relacion(nota.actividad);
        const asignacion = relacion(
          actividad?.materia_grupo_periodo
        );

        return (
          String(asignacion?.periodo_id) ===
          String(periodoNotas)
        );
      }
    );

    return (
      <>
        <Titulo
          titulo="Calificaciones"
          descripcion="Consulta de notas por período y materia."
        />

        <View style={styles.destacado}>
          <Text style={styles.destacadoEtiqueta}>
            Promedio del período
          </Text>

          <Text style={styles.destacadoValor}>
            {notaTexto(periodo?.promedio)}
          </Text>

          <Text style={styles.destacadoDetalle}>
            {periodo?.nombre ||
              'Sin período seleccionado'}
          </Text>
        </View>

        <Text style={styles.apartadoTitulo}>
          Período académico
        </Text>

        <Opciones
          valores={periodos.map(
            (p) => [
              String(p.periodoId),
              p.nombre,
            ]
          )}
          seleccionado={periodoNotas}
          onChange={setPeriodoNotas}
        />

        <Text style={styles.apartadoTitulo}>
          Promedios por materia
        </Text>

        {periodo?.materias?.length ? (
          periodo.materias.map((materia) => (
            <View
              key={String(materia.materiaId)}
              style={styles.materiaFila}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.materiaNombre}>
                  {materia.materia}
                </Text>

                <Text style={styles.textoSecundario}>
                  {materia.cantidadNotas}{' '}
                  calificaciones
                </Text>
              </View>

              <Text style={styles.materiaNota}>
                {notaTexto(materia.promedio)}
              </Text>
            </View>
          ))
        ) : (
          <Mensaje
            titulo="Sin promedios"
            texto="No existen calificaciones registradas en este período."
          />
        )}

        <Text style={styles.apartadoTitulo}>
          Detalle de calificaciones
        </Text>

        {detalle.length ? (
          detalle.map((nota) => {
            const actividad = relacion(nota.actividad);
            const asignacion = relacion(
              actividad?.materia_grupo_periodo
            );
            const materia = relacion(
              asignacion?.materia
            );

            return (
              <View
                key={String(nota.id)}
                style={styles.registro}
              >
                <View style={styles.fila}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.registroTitulo}>
                      {actividad?.titulo ||
                        'Actividad académica'}
                    </Text>

                    <Text style={styles.textoSecundario}>
                      {materia?.nombre ||
                        'Materia no disponible'}
                    </Text>
                  </View>

                  <Text style={styles.materiaNota}>
                    {notaTexto(nota.valor)}
                  </Text>
                </View>

                {!!nota.retroalimentacion && (
                  <Text style={styles.observacion}>
                    {nota.retroalimentacion}
                  </Text>
                )}
              </View>
            );
          })
        ) : (
          <Mensaje
            titulo="Sin calificaciones registradas"
            texto="La ausencia de notas no significa que el estudiante haya perdido sus materias."
          />
        )}
      </>
    );
  };

  // ===================================================
  // ACTIVIDADES
  // ===================================================

  const renderActividades = () => {
    const lista = actividades.actividades || [];

    const filtradas = lista.filter(
      (actividad) =>
        filtroActividades === 'todas' ||
        actividad.tipo === filtroActividades
    );

    return (
      <>
        <Titulo
          titulo="Actividades y evaluaciones"
          descripcion="Tareas, trabajos y exámenes publicados."
        />

        <View style={styles.contadoresFila}>
          <Contador
            valor={actividades.total}
            titulo="Publicadas"
          />
          <Contador
            valor={actividades.resumen?.conEntrega}
            titulo="Con entrega"
          />
          <Contador
            valor={actividades.resumen?.sinEntrega}
            titulo="Sin entrega"
          />
        </View>

        <Text style={styles.apartadoTitulo}>
          Filtrar por tipo
        </Text>

        <Opciones
          valores={TIPOS}
          seleccionado={filtroActividades}
          onChange={setFiltroActividades}
        />

        {filtradas.length === 0 ? (
          <Mensaje
            titulo="Sin actividades"
            texto="No hay actividades publicadas para el filtro seleccionado."
          />
        ) : (
          filtradas.map((actividad) => {
            const asignacion = relacion(
              actividad.materia_grupo_periodo
            );

            const materia = relacion(
              asignacion?.materia
            );

            const periodo = relacion(
              asignacion?.periodo
            );

            const estado = actividadEstado(
              actividad
            );

            return (
              <View
                key={String(actividad.id)}
                style={styles.registro}
              >
                <Text style={styles.registroTitulo}>
                  {actividad.titulo}
                </Text>

                <Text style={styles.materiaNombre}>
                  {materia?.nombre ||
                    'Materia no disponible'}
                </Text>

                <Text style={styles.textoSecundario}>
                  {periodo?.nombre ||
                    'Período no disponible'}
                </Text>

                <Etiqueta
                  texto={tipoTexto(actividad.tipo)}
                  color={C.azul}
                  fondo={C.azulSuave}
                />

                {!!actividad.descripcion && (
                  <Text style={styles.observacion}>
                    {actividad.descripcion}
                  </Text>
                )}

                <View style={styles.divisor} />

                <Text style={styles.fechaRegistro}>
                  Fecha de entrega:{' '}
                  {fechaVisible(
                    actividad.fecha_entrega
                  )}
                </Text>

                <Etiqueta
                  texto={estado.texto}
                  color={estado.color}
                  fondo={estado.fondo}
                />

                {!!actividad.entrega && (
                  <Text style={styles.observacion}>
                    Entrega:{' '}
                    {actividad.entrega.estado}
                    {actividad.entrega.fecha_entrega
                      ? ` · ${fechaVisible(
                          actividad.entrega.fecha_entrega
                        )}`
                      : ''}
                  </Text>
                )}

                {!!actividad.entrega?.comentario && (
                  <Text style={styles.observacion}>
                    Comentario:{' '}
                    {actividad.entrega.comentario}
                  </Text>
                )}

                {actividad.calificacion ? (
                  <View style={styles.notaActividad}>
                    <Text style={styles.textoSecundario}>
                      Calificación registrada
                    </Text>

                    <Text style={styles.materiaNota}>
                      {notaTexto(
                        actividad.calificacion.valor
                      )}
                    </Text>

                    {!!actividad.calificacion
                      .retroalimentacion && (
                      <Text style={styles.observacion}>
                        {actividad.calificacion
                          .retroalimentacion}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.textoSecundario}>
                    Sin calificación registrada
                  </Text>
                )}
              </View>
            );
          })
        )}

        <Text style={styles.notaInformativa}>
          La ausencia de entrega no equivale
          a una calificación de cero.
        </Text>
      </>
    );
  };

  // ===================================================
  // ASISTENCIA CON FILTROS AVANZADOS
  // ===================================================

  const renderAsistencia = () => {
    const historial = asistencia.asistencias || [];

    const periodos =
      notas.promediosPeriodos || [];

    const materias = [
      ...new Set(
        historial
          .map((r) => r.materia)
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      a.localeCompare(b, 'es')
    );

    // Todos los filtros actúan sobre registros reales.
    const filtrados = historial.filter((r) => {
      if (
        periodoAsistencia !== 'todos' &&
        String(r.periodoId) !==
          String(periodoAsistencia)
      ) {
        return false;
      }

      if (
        materiaAsistencia !== 'todas' &&
        r.materia !== materiaAsistencia
      ) {
        return false;
      }

      if (
        estadoAsistencia !== 'todos' &&
        r.estado !== estadoAsistencia
      ) {
        return false;
      }

      if (
        diaAsistencia !== 'todos' &&
        diaSemana(r.fecha) !== diaAsistencia
      ) {
        return false;
      }

      const fecha = fechaClave(r.fecha);

      if (
        desde &&
        (!fecha || fecha < desde)
      ) {
        return false;
      }

      if (
        hasta &&
        (!fecha || fecha > hasta)
      ) {
        return false;
      }

      return true;
    });

    // Contadores calculados según los filtros,
    // no usando el resumen global.
    const resumen = {
      total: filtrados.length,
      presentes: filtrados.filter(
        (r) => r.estado === 'presente'
      ).length,
      ausentes: filtrados.filter(
        (r) => r.estado === 'ausente'
      ).length,
      tarde: filtrados.filter(
        (r) => r.estado === 'tarde'
      ).length,
    };

    const filtrosActivos =
      periodoAsistencia !== 'todos' ||
      materiaAsistencia !== 'todas' ||
      estadoAsistencia !== 'todos' ||
      diaAsistencia !== 'todos' ||
      desde !== null ||
      hasta !== null;

    return (
      <>
        <Titulo
          titulo="Control de asistencia"
          descripcion="Consulta la asistencia por materia, fecha, día de la semana y estado."
        />

        <View style={styles.filtroCard}>
          <Text style={styles.filtroTitulo}>
            Período académico
          </Text>

          <Opciones
            valores={[
              ['todos', 'Todos'],
              ...periodos.map((p) => [
                String(p.periodoId),
                p.nombre,
              ]),
            ]}
            seleccionado={periodoAsistencia}
            onChange={setPeriodoAsistencia}
          />

          <Text style={styles.filtroTitulo}>
            Materia
          </Text>

          <Opciones
            valores={[
              ['todas', 'Todas'],
              ...materias.map((materia) => [
                materia,
                materia,
              ]),
            ]}
            seleccionado={materiaAsistencia}
            onChange={setMateriaAsistencia}
          />

          {materias.length === 0 && (
            <Text style={styles.ayuda}>
              Todavía no hay materias con
              asistencia registrada.
            </Text>
          )}

          <Text style={styles.filtroTitulo}>
            Rango de fechas
          </Text>

          <View style={styles.fechasFila}>
            <TouchableOpacity
              style={styles.fechaBoton}
              onPress={() =>
                abrirCalendario('desde')
              }
            >
              <Text style={styles.fechaEtiqueta}>
                Desde
              </Text>

              <Text style={styles.fechaValor}>
                {desde
                  ? fechaVisible(desde)
                  : 'Elegir fecha'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fechaBoton}
              onPress={() =>
                abrirCalendario('hasta')
              }
            >
              <Text style={styles.fechaEtiqueta}>
                Hasta
              </Text>

              <Text style={styles.fechaValor}>
                {hasta
                  ? fechaVisible(hasta)
                  : 'Elegir fecha'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filtroTitulo}>
            Día de la semana
          </Text>

          <Opciones
            valores={DIAS}
            seleccionado={diaAsistencia}
            onChange={setDiaAsistencia}
          />

          <Text style={styles.filtroTitulo}>
            Estado
          </Text>

          <Opciones
            valores={ESTADOS}
            seleccionado={estadoAsistencia}
            onChange={setEstadoAsistencia}
          />

          <TouchableOpacity
            style={styles.limpiarBoton}
            onPress={limpiarFiltrosAsistencia}
          >
            <Text style={styles.limpiarTexto}>
              Limpiar todos los filtros
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultadoCabecera}>
          <Text style={styles.resultadoTitulo}>
            Resultados de asistencia
          </Text>

          <Text style={styles.resultadoCantidad}>
            {filtrados.length}{' '}
            {filtrados.length === 1
              ? 'registro'
              : 'registros'}
          </Text>
        </View>

        <View style={styles.contadoresFila}>
          <Contador
            valor={resumen.total}
            titulo="Registros"
          />

          <Contador
            valor={resumen.presentes}
            titulo="Presentes"
          />
        </View>

        <View style={styles.contadoresFila}>
          <Contador
            valor={resumen.ausentes}
            titulo="Ausentes"
          />

          <Contador
            valor={resumen.tarde}
            titulo="Llegadas tarde"
          />
        </View>

        <Text style={styles.apartadoTitulo}>
          Historial por fecha
        </Text>

        {filtrados.length === 0 ? (
          <Mensaje
            titulo="Sin registros encontrados"
            texto={
              filtrosActivos
                ? 'No hay registros de asistencia que coincidan con los filtros seleccionados. Puedes cambiar las fechas, materia o estado.'
                : 'Todavía no existen asistencias registradas para este estudiante.'
            }
          />
        ) : (
          filtrados.map((registro) => {
            const estado = asistenciaEstado(
              registro.estado
            );

            const nombreDia =
              DIAS.find(
                ([id]) =>
                  id === diaSemana(registro.fecha)
              )?.[1] || '';

            return (
              <View
                key={String(
                  registro.asistenciaId
                )}
                style={styles.registro}
              >
                <View style={styles.fila}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.registroTitulo}>
                      {registro.materia ||
                        'Materia no disponible'}
                    </Text>

                    <Text style={styles.textoSecundario}>
                      {nombreDia},{' '}
                      {fechaVisible(registro.fecha)}
                    </Text>

                    <Text style={styles.textoSecundario}>
                      Sesión de clase:{' '}
                      {registro.numeroSesion ?? 'N/D'}
                    </Text>
                  </View>

                  <Etiqueta
                    texto={estado.texto}
                    color={estado.color}
                    fondo={estado.fondo}
                  />
                </View>

                {!!registro.observacion && (
                  <View style={styles.observacionCaja}>
                    <Text style={styles.observacion}>
                      {registro.observacion}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        <Text style={styles.notaInformativa}>
          Se muestran solamente las sesiones
          con asistencia registrada. Un día sin
          registros no significa automáticamente
          ausencia ni que se haya dictado clase.
        </Text>
      </>
    );
  };

  // ===================================================
  // SEGUIMIENTO CON PESTAÑAS
  // ===================================================

  const renderSeguimiento = () => (
    <>
      <TouchableOpacity
        style={styles.volverBoton}
        onPress={volverLista}
      >
        <Text style={styles.volverTexto}>
          {'‹'} Cambiar estudiante
        </Text>
      </TouchableOpacity>

      <View style={styles.estudianteResumen}>
      <View style={[styles.avatar, styles.avatarPremium]}>
          <Text style={styles.avatarTexto}>
            {nombreCompleto(estudiante)
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.estudianteNombre}>
            {nombreCompleto(estudiante)}
          </Text>

          <Text style={styles.estudianteDetalle}>
            Grado {nombreRelacion(
              estudiante.grado
            )}
            {' · Grupo '}
            {nombreRelacion(
              estudiante.grupo
            )}
          </Text>

          <Text style={styles.autorizadoTexto}>
            Vinculación autorizada
          </Text>
        </View>
      </View>

      <View style={styles.pestanas}>
        {PESTANAS.map(([id, nombre, icono]) => (
          <TouchableOpacity
            key={id}
            style={[
              styles.pestana,
              tab === id && styles.pestanaActiva,
            ]}
            onPress={() => setTab(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === id }}
          >
            <Ionicons
              name={icono}
              size={15}
              color={tab === id ? C.blanco : C.azul}
            />
            <Text
              style={[
                styles.pestanaTexto,
                tab === id &&
                  styles.pestanaTextoActivo,
              ]}
            >
              {nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'excusas' && (
        <View style={styles.contenido}>
          <GuardianExcuses
            key={estudiante.id}
            apiUrl={apiUrl}
            accessToken={accessToken}
            estudiante={estudiante}
          />
        </View>
      )}

      {tab === 'alertas' || tab === 'excusas' ? (
        tab === 'alertas' && (
          <View style={styles.contenido}>
            <GuardianAcademicAlerts
              apiUrl={apiUrl}
              accessToken={accessToken}
              estudiante={estudiante}
              notas={notas}
              obtenerPorcentajeBarra={obtenerPorcentajeBarra}
              obtenerColorBarra={obtenerColorBarra}
              obtenerTextoEstadoMateria={obtenerTextoEstadoMateria}
            />
          </View>
        )
      ) : cargandoDatos || actualizando ? (
        <Cargando texto="Consultando información académica..." />
      ) : errorDatos ? (
        <Mensaje
          titulo="No fue posible cargar el seguimiento"
          texto={errorDatos}
          error
          reintentar={() =>
            cargarSeguimiento(estudiante.id)
          }
        />
      ) : notas && actividades && asistencia ? (
        <View style={styles.contenido}>
          {tab === 'resumen' && renderResumen()}
          {tab === 'notas' && renderNotas()}
          {tab === 'actividades' && renderActividades()}
          {tab === 'asistencia' && renderAsistencia()}

          {!!ultimaConsulta && (
            <Text style={styles.actualizacionTexto}>
              Última actualización:{' '}
              {ultimaConsulta.toLocaleString('es-CO')}
            </Text>
          )}

          <Boton
            texto="Actualizar información"
            ocupado={actualizando}
            onPress={() =>
              cargarSeguimiento(
                estudiante.id,
                true
              )
            }
          />
        </View>
      ) : (
        <Cargando texto="Preparando seguimiento..." />
      )}
    </>
  );

  const obtenerPorcentajeBarra = (alerta) => {
    const porcentaje = alerta?.detalles?.porcentaje;

    if (
      typeof porcentaje === 'number' &&
      !Number.isNaN(porcentaje)
    ) {
      return Math.max(0, Math.min(100, porcentaje));
    }

    const promedio = alerta?.detalles?.promedio;

    if (
      typeof promedio === 'number' &&
      !Number.isNaN(promedio)
    ) {
      return Math.max(0, Math.min(100, (promedio / 5) * 100));
    }

    return 0;
  };

  const obtenerColorBarra = (alerta) => {
    const clasificacion = alerta?.detalles?.clasificacion;
    const nivel = alerta?.nivel;

    if (clasificacion === 'riesgo' || nivel === 'alta') {
      return '#C62828';
    }

    if (clasificacion === 'seguimiento' || nivel === 'media') {
      return '#F9A825';
    }

    return '#2E7D32';
  };

  const obtenerTextoEstadoMateria = (alerta) => {
    const clasificacion = alerta?.detalles?.clasificacion;
    const nivel = alerta?.nivel;

    if (clasificacion === 'riesgo' || nivel === 'alta') {
      return 'Riesgo';
    }

    if (clasificacion === 'seguimiento' || nivel === 'media') {
      return 'Seguimiento';
    }

    return 'Favorable';
  };

  // ===================================================
  // PANTALLA PRINCIPAL
  // ===================================================

  return (
    <ScrollView
      key={usuario?.id}
      style={styles.container}
      contentContainerStyle={styles.contenedor}
      showsVerticalScrollIndicator={false}
      refreshControl={
        pantalla === 'estudiantes' &&
        !!estudiante
          ? (
              <RefreshControl
                refreshing={actualizando}
                onRefresh={() =>
                  cargarSeguimiento(
                    estudiante.id,
                    true
                  )
                }
                tintColor={C.azul}
                colors={[C.azul]}
              />
            )
          : undefined
      }
    >
      <ProfileDashboardHeader
        key={usuario?.id}
        apiUrl={apiUrl}
        accessToken={accessToken}
        guardianPremium
      />

      {pantalla !== 'inicio' && (
        <TouchableOpacity
          style={styles.volverInicio}
          onPress={volverInicio}
        >
          <Text style={styles.volverTexto}>
            {'‹'} Volver al inicio
          </Text>
        </TouchableOpacity>
      )}

      {pantalla === 'inicio' &&
        renderInicio()}

      {pantalla === 'estudiantes' && (
        estudiante ? (
          renderSeguimiento()
        ) : (
          <>
            {renderEncabezado(
              tab === 'alertas'
                ? 'Alertas académicas'
                : 'Estudiantes a cargo',
              tab === 'alertas'
                ? 'Selecciona un estudiante autorizado para consultar sus alertas.'
                : 'Selecciona el estudiante que deseas consultar.'
            )}
            {renderLista()}
          </>
        )
      )}

      <TouchableOpacity
        style={styles.cerrarSesion}
        onPress={cerrarSesion}
      >
        <Text style={styles.cerrarTexto}>
          Cerrar sesión
        </Text>
      </TouchableOpacity>

      {calendario && (
        <DateTimePicker
          value={
            fechaLocal(
              calendario === 'desde'
                ? desde
                : hasta
            ) || new Date()
          }
          mode="date"
          display="default"
          onChange={cambiarFecha}
        />
      )}
    </ScrollView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.fondo,
  },
  contenedor: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 55,
  },
  welcomePanel: {
    backgroundColor: C.azulOscuro,
    borderRadius: 22,
    padding: 21,
    marginBottom: 17,
    overflow: 'hidden',
    borderBottomWidth: 3,
    borderBottomColor: C.cyan,
  },
  welcomeIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#17375B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeEyebrow: {
    color: '#78DDF1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  welcomeTitle: {
    color: C.blanco,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    marginTop: 7,
  },
  welcomeDescription: {
    color: '#C5D5E5',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  menuCard: {
    backgroundColor: C.blanco,
    borderRadius: 19,
    padding: 17,
    borderWidth: 1,
    borderColor: C.borde,
    marginBottom: 15,
    shadowColor: C.azulOscuro,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  menuCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBlue: {
    backgroundColor: C.azulSuave,
  },
  menuIconAmber: {
    backgroundColor: C.amarilloSuave,
  },
  menuIconPurple: {
    backgroundColor: '#F1ECFA',
  },
  menuTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  menuTitulo: {
    color: C.azulOscuro,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 21,
  },
  menuDescripcion: {
    color: C.gris,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  flecha: {
    color: C.azul,
    fontSize: 27,
  },
  volverInicio: {
    alignSelf: 'flex-start',
    marginTop: 22,
    marginBottom: 22,
  },
  volverBoton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  volverTexto: {
    color: C.azul,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 5,
  },
  encabezado: {
    marginBottom: 20,
    marginTop: 5,
  },
  tituloPagina: {
    color: C.azulOscuro,
    fontSize: 25,
    fontWeight: '900',
  },
  descripcionPagina: {
    color: C.gris,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  totalCard: {
    backgroundColor: C.azulSuave,
    padding: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
    shadowColor: C.azulOscuro,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  totalNumero: {
    color: C.azul,
    fontSize: 31,
    fontWeight: '800',
    marginRight: 15,
  },
  totalTexto: {
    color: C.azul,
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
  },
  estudianteCard: {
    backgroundColor: C.blanco,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borde,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: C.azulOscuro,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  estudianteResumen: {
    backgroundColor: C.blanco,
    borderRadius: 19,
    padding: 17,
    borderWidth: 1,
    borderColor: C.borde,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },
  avatar: {
    width: 49,
    height: 49,
    borderRadius: 14,
    backgroundColor: C.azulSuave,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  avatarPremium: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#E8F5FC',
  },
  avatarTexto: {
    fontSize: 22,
    fontWeight: '800',
    color: C.azul,
  },
  estudianteNombre: {
    color: C.texto,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  estudianteDetalle: {
    color: C.gris,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  autorizadoTexto: {
    color: C.verde,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  pestanas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
    backgroundColor: '#EAF0F7',
    borderRadius: 17,
    padding: 8,
  },
  pestana: {
    backgroundColor: C.blanco,
    borderColor: C.borde,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pestanaActiva: {
    backgroundColor: C.azulOscuro,
    borderColor: C.azulOscuro,
    elevation: 2,
  },
  pestanaTexto: {
    color: C.azul,
    fontSize: 12,
    fontWeight: '700',
  },
  pestanaTextoActivo: {
    color: C.blanco,
  },
  contenido: {
    backgroundColor: C.blanco,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borde,
    padding: 18,
    marginBottom: 15,
    shadowColor: C.azulOscuro,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 9,
    elevation: 1,
  },
  bloqueTitulo: {
    marginBottom: 18,
  },
  bloqueTituloTexto: {
    color: C.azulOscuro,
    fontSize: 22,
    fontWeight: '800',
  },
  bloqueDescripcion: {
    color: C.gris,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
  },
  destacado: {
    backgroundColor: C.azulSuave,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  destacadoEtiqueta: {
    color: C.gris,
    fontSize: 13,
  },
  destacadoValor: {
    color: C.azul,
    fontSize: 29,
    fontWeight: '800',
    marginVertical: 8,
  },
  destacadoDetalle: {
    color: C.gris,
    fontSize: 12,
  },
  contadoresFila: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  contador: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: 13,
    backgroundColor: C.azulSuave,
    alignItems: 'center',
  },
  contadorNumero: {
    fontSize: 25,
    color: C.azul,
    fontWeight: '800',
  },
  contadorTitulo: {
    color: C.gris,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 5,
  },
  apartadoTitulo: {
    color: C.azul,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 12,
  },
  opciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  opcion: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.fondo,
  },
  opcionActiva: {
    backgroundColor: C.azul,
    borderColor: C.azul,
  },
  opcionTexto: {
    fontSize: 12,
    color: C.azul,
    fontWeight: '700',
  },
  opcionTextoActivo: {
    color: C.blanco,
  },
  materiaFila: {
    borderBottomWidth: 1,
    borderBottomColor: C.borde,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  materiaNombre: {
    color: C.texto,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  materiaNota: {
    color: C.azul,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 10,
  },
  textoSecundario: {
    color: C.gris,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
  registro: {
    backgroundColor: '#F9FBFD',
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 13,
    padding: 15,
    marginBottom: 11,
  },
  registroTitulo: {
    color: C.texto,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    lineHeight: 21,
  },
  fechaRegistro: {
    color: C.texto,
    fontSize: 13,
    marginBottom: 12,
  },
  observacion: {
    color: C.gris,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 12,
  },
  observacionCaja: {
    backgroundColor: C.blanco,
    borderRadius: 9,
    padding: 10,
    marginTop: 12,
  },
  divisor: {
    height: 1,
    backgroundColor: C.borde,
    marginVertical: 14,
  },
  notaActividad: {
    backgroundColor: C.azulSuave,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  etiqueta: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 9,
  },
  etiquetaTexto: {
    fontSize: 12,
    fontWeight: '800',
  },
  filtroCard: {
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 15,
    padding: 15,
    backgroundColor: '#F9FBFD',
    marginBottom: 20,
  },
  filtroTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: C.azul,
    marginTop: 14,
    marginBottom: 10,
  },
  fechasFila: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  fechaBoton: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 11,
    padding: 12,
    backgroundColor: C.blanco,
    minWidth: 0,
  },
  fechaEtiqueta: {
    color: C.gris,
    fontSize: 11,
    marginBottom: 5,
  },
  fechaValor: {
    color: C.azul,
    fontWeight: '800',
    fontSize: 13,
  },
  ayuda: {
    color: C.gris,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  limpiarBoton: {
    borderWidth: 1,
    borderColor: C.azul,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  limpiarTexto: {
    fontWeight: '800',
    color: C.azul,
    fontSize: 13,
  },
  resultadoCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  resultadoTitulo: {
    fontSize: 16,
    color: C.azul,
    fontWeight: '800',
    flex: 1,
  },
  resultadoCantidad: {
    color: C.gris,
    fontSize: 12,
    fontWeight: '700',
  },
  mensaje: {
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 14,
    padding: 21,
    alignItems: 'center',
    marginVertical: 12,
  },
  mensajeTitulo: {
    color: C.azul,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  mensajeTexto: {
    fontSize: 13,
    lineHeight: 21,
    color: C.gris,
    textAlign: 'center',
    marginTop: 12,
  },
  cargando: {
    alignItems: 'center',
    paddingVertical: 35,
  },
  cargandoTexto: {
    color: C.gris,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
  boton: {
    borderWidth: 1,
    borderColor: C.azul,
    borderRadius: 11,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  botonPrincipal: {
    backgroundColor: C.azul,
  },
  botonTexto: {
    color: C.azul,
    fontSize: 14,
    fontWeight: '800',
  },
  botonTextoBlanco: {
    color: C.blanco,
  },
  actualizacionTexto: {
    fontSize: 11,
    color: C.gris,
    textAlign: 'center',
    marginTop: 20,
  },
  notaInformativa: {
    color: C.gris,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 15,
  },
  cerrarSesion: {
    backgroundColor: C.rojo,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  cerrarTexto: {
    color: C.blanco,
    fontSize: 16,
    fontWeight: '800',
  },
});
