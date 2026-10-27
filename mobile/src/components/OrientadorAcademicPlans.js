'use strict';

import React, {
  useCallback,
  useEffect,
  useMemo,
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

import {
  listarPlanesEstudiante,
  crearPlanEstudiante,
  actualizarPlanEstudiante,
} from '../services/academicPlanService';

import {
  listarRecomendacionesEstudiante,
} from '../services/academicRecommendationService';

// ======================================================
// AULA-AI | HU-11
// GESTIÓN DE PLANES DE ACOMPAÑAMIENTO
// ======================================================

const ESTADOS = {
  propuesto: 'Propuesto',
  en_seguimiento: 'En seguimiento',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const TRANSICIONES = {
  propuesto: ['en_seguimiento', 'cancelado'],
  en_seguimiento: ['completado', 'cancelado'],
  completado: [],
  cancelado: [],
};

const PRIORIDADES = ['baja', 'media', 'alta'];

const COLORES = {
  primario: '#2563EB',
  primarioOscuro: '#1D4ED8',
  fondo: '#F8FAFC',
  blanco: '#FFFFFF',
  texto: '#172033',
  secundario: '#64748B',
  borde: '#E2E8F0',
  azulClaro: '#EFF6FF',
  verdeClaro: '#ECFDF5',
  verde: '#047857',
  rojo: '#B91C1C',
  rojoClaro: '#FEF2F2',
  amarilloClaro: '#FFFBEB',
};

const crearFormularioInicial = () => ({
  recomendacionId: null,
  recomendacionIndice: null,
  objetivo: '',
  acciones: '',
  indicadores: '',
  prioridad: 'media',
  fecha: '',
  observaciones: '',
  estado: 'propuesto',
});

// ======================================================
// UTILIDADES
// ======================================================

function esObjeto(valor) {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  );
}

function fechaTexto(valor) {
  if (!valor) {
    return 'Sin fecha definida';
  }

  const texto = String(valor).slice(0, 10);
  const partes = texto.split('-');

  if (partes.length !== 3) {
    return 'Fecha no disponible';
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function fechaValida(valor) {
  if (!valor) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === valor
  );
}

function descripcionElemento(elemento) {
  if (typeof elemento === 'string') {
    return elemento;
  }

  if (!esObjeto(elemento)) {
    return '';
  }

  return (
    elemento.descripcion ||
    elemento.indicador ||
    elemento.titulo ||
    elemento.nombre ||
    ''
  );
}

function listaTexto(elementos) {
  if (!Array.isArray(elementos)) {
    return '';
  }

  return elementos
    .map(descripcionElemento)
    .filter(Boolean)
    .join('\n');
}

function listaDesdeTexto(texto, originales = []) {
  const lineas = String(texto || '')
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean);

  return lineas.map((linea, indice) => {
    const anterior = originales[indice];

    if (
      esObjeto(anterior) &&
      descripcionElemento(anterior) === linea
    ) {
      return anterior;
    }

    return linea;
  });
}

function obtenerContenido(recomendacion) {
  let contenido = recomendacion?.contenido;

  if (typeof contenido === 'string') {
    try {
      contenido = JSON.parse(contenido);
    } catch {
      return {};
    }
  }

  if (!esObjeto(contenido)) {
    return {};
  }

  return contenido;
}

function obtenerSugerencias(recomendacion) {
  const contenido = obtenerContenido(recomendacion);

  if (Array.isArray(contenido.recomendaciones)) {
    return contenido.recomendaciones;
  }

  if (
    esObjeto(contenido.contenido) &&
    Array.isArray(contenido.contenido.recomendaciones)
  ) {
    return contenido.contenido.recomendaciones;
  }

  return [];
}

function prioridadTexto(prioridad) {
  return String(prioridad || 'media').toUpperCase();
}

function crearObjetivoDesdeSugerencia(sugerencia) {
  const titulo = String(sugerencia?.titulo || '').trim();

  if (!titulo) {
    return '';
  }

  return `Fortalecer el desempeño académico mediante: ${titulo.charAt(0).toLowerCase()}${titulo.slice(1)}.`;
}

function obtenerAccionesSugeridas(sugerencia) {
  if (!Array.isArray(sugerencia?.acciones)) {
    return '';
  }

  return sugerencia.acciones
    .map(descripcionElemento)
    .filter(Boolean)
    .join('\n');
}

function obtenerIndicadoresSugeridos(sugerencia) {
  const categoria = sugerencia?.categoria;

  const indicadores = {
    actividades: [
      'Cantidad de actividades pendientes completadas.',
      'Cumplimiento de las fechas de entrega.',
    ],
    asistencia: [
      'Número de asistencias registradas durante el seguimiento.',
      'Variación de las inasistencias registradas.',
    ],
    puntualidad: [
      'Cantidad de llegadas tarde durante el seguimiento.',
      'Cumplimiento de los horarios establecidos.',
    ],
    organizacion: [
      'Cumplimiento de las actividades planificadas.',
      'Cantidad de tareas completadas dentro del plazo.',
    ],
    estudio: [
      'Cumplimiento de las sesiones de estudio acordadas.',
      'Evolución de las calificaciones disponibles.',
    ],
    acompanamiento: [
      'Cumplimiento de las acciones de acompañamiento acordadas.',
      'Registro de revisiones de seguimiento realizadas.',
    ],
    general: [
      'Cumplimiento de las acciones académicas acordadas.',
    ],
  };

  return (
    indicadores[categoria] ||
    indicadores.general
  ).join('\n');
}

// ======================================================
// COMPONENTES REUTILIZABLES
// ======================================================

function Boton({
  titulo,
  onPress,
  secundario = false,
  peligro = false,
  disabled = false,
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.boton,
        secundario && styles.botonSecundario,
        peligro && styles.botonPeligro,
        disabled && styles.deshabilitado,
      ]}
    >
      <Text
        style={[
          styles.botonTexto,
          secundario && styles.botonTextoSecundario,
          peligro && styles.botonTextoPeligro,
        ]}
      >
        {titulo}
      </Text>
    </TouchableOpacity>
  );
}

function Campo({
  titulo,
  valor,
  onChange,
  placeholder,
  multiline = false,
  obligatorio = false,
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>
        {titulo}
        {obligatorio ? ' *' : ''}
      </Text>

      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        textAlignVertical={
          multiline ? 'top' : 'center'
        }
        style={[
          styles.input,
          multiline && styles.inputMultiline,
        ]}
      />
    </View>
  );
}

function Etiqueta({
  texto,
  tipo = 'azul',
}) {
  return (
    <View
      style={[
        styles.etiquetaEstado,
        tipo === 'verde' && styles.etiquetaVerde,
        tipo === 'rojo' && styles.etiquetaRoja,
      ]}
    >
      <Text
        style={[
          styles.etiquetaEstadoTexto,
          tipo === 'verde' && styles.textoVerde,
          tipo === 'rojo' && styles.textoRojo,
        ]}
      >
        {texto}
      </Text>
    </View>
  );
}

function ListaElementos({
  titulo,
  elementos,
}) {
  return (
    <View style={styles.bloqueDetalle}>
      <Text style={styles.subtitulo}>
        {titulo}
      </Text>

      {!Array.isArray(elementos) ||
      elementos.length === 0 ? (
        <Text style={styles.textoSecundario}>
          Sin información registrada.
        </Text>
      ) : (
        elementos.map((elemento, indice) => (
          <View
            key={indice}
            style={styles.filaElemento}
          >
            <Text style={styles.viñeta}>
              •
            </Text>

            <View style={{ flex: 1 }}>
              <Text style={styles.textoNormal}>
                {descripcionElemento(elemento)}
              </Text>

              {esObjeto(elemento) &&
              elemento.meta !== undefined ? (
                <Text style={styles.textoSecundario}>
                  Meta: {String(elemento.meta)}
                  {elemento.unidad
                    ? ` ${elemento.unidad}`
                    : ''}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function OrientadorAcademicPlans({
  estudianteId,
  apiUrl,
  accessToken,
  alertaId = null,
}) {
  const [planes, setPlanes] = useState([]);
  const [
    recomendaciones,
    setRecomendaciones,
  ] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [errorPlanes, setErrorPlanes] = useState('');
  const [
    errorRecomendaciones,
    setErrorRecomendaciones,
  ] = useState('');

  const [formularioVisible, setFormularioVisible] =
    useState(false);

  const [formulario, setFormulario] = useState(
    crearFormularioInicial()
  );

  const [editando, setEditando] = useState(null);
  const [expandido, setExpandido] = useState(null);

  const [mostrarRecomendaciones, setMostrarRecomendaciones] =
    useState(false);

  // ====================================================
  // ACTUALIZAR FORMULARIO
  // ====================================================

  const cambiar = (campo, valor) => {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  // ====================================================
  // CONSULTAR INFORMACIÓN
  // ====================================================

  const cargar = useCallback(async () => {
    if (!estudianteId) {
      setErrorPlanes(
        'No se identificó al estudiante.'
      );
      setCargando(false);
      return;
    }

    setCargando(true);
    setErrorPlanes('');
    setErrorRecomendaciones('');

    try {
      const resultados = await Promise.allSettled([
        listarPlanesEstudiante({
          estudianteId,
          apiUrl,
          accessToken,
        }),
        listarRecomendacionesEstudiante({
          estudianteId,
          apiUrl,
          accessToken,
        }),
      ]);

      const resultadoPlanes = resultados[0];
      const resultadoRecomendaciones = resultados[1];

      if (resultadoPlanes.status === 'fulfilled') {
        setPlanes(
          Array.isArray(resultadoPlanes.value)
            ? resultadoPlanes.value
            : []
        );
      } else {
        setErrorPlanes(
          resultadoPlanes.reason?.message ||
          'No fue posible consultar los planes.'
        );
      }

      if (
        resultadoRecomendaciones.status === 'fulfilled'
      ) {
        const datos = resultadoRecomendaciones.value;

        setRecomendaciones(
          Array.isArray(datos?.recomendaciones)
            ? datos.recomendaciones
            : []
        );
      } else {
        setErrorRecomendaciones(
          resultadoRecomendaciones.reason?.message ||
          'No fue posible consultar las recomendaciones.'
        );
      }
    } finally {
      setCargando(false);
    }
  }, [estudianteId, apiUrl, accessToken]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ====================================================
  // RESUMEN
  // ====================================================

  const resumen = useMemo(() => {
    return {
      total: planes.length,

      activos: planes.filter((plan) =>
        ['propuesto', 'en_seguimiento'].includes(
          plan.estado
        )
      ).length,

      completados: planes.filter(
        (plan) => plan.estado === 'completado'
      ).length,
    };
  }, [planes]);

  // ====================================================
  // CREAR NUEVO PLAN
  // ====================================================

  const nuevoPlan = () => {
    setEditando(null);
    setFormulario(crearFormularioInicial());
    setMostrarRecomendaciones(true);
    setFormularioVisible(true);
  };

  // ====================================================
  // SELECCIONAR RECOMENDACIÓN
  // ====================================================

  const seleccionarRecomendacion = (recomendacion) => {
    setFormulario((actual) => ({
      ...actual,
      recomendacionId: Number(recomendacion.id),
      recomendacionIndice: null,
      objetivo: '',
      acciones: '',
      indicadores: '',
      prioridad: 'media',
    }));
  };

  // ====================================================
  // UTILIZAR SUGERENCIA DE GEMINI
  // ====================================================

  const aplicarSugerencia = (
    recomendacion,
    sugerencia,
    indice
  ) => {
    const objetivo =
      crearObjetivoDesdeSugerencia(sugerencia);

    const acciones =
      obtenerAccionesSugeridas(sugerencia);

    const indicadores =
      obtenerIndicadoresSugeridos(sugerencia);

    setFormulario((actual) => ({
      ...actual,

      recomendacionId: Number(recomendacion.id),
      recomendacionIndice: indice,

      objetivo,
      acciones,
      indicadores,

      prioridad: PRIORIDADES.includes(
        sugerencia.prioridad
      )
        ? sugerencia.prioridad
        : 'media',
    }));

    setMostrarRecomendaciones(false);
  };

  // ====================================================
  // EDITAR PLAN
  // ====================================================

  const editarPlan = (plan) => {
    const permitidos =
      TRANSICIONES[plan.estado] || [];

    if (permitidos.length === 0) {
      Alert.alert(
        'Plan finalizado',
        'Este plan ya no admite modificaciones.'
      );
      return;
    }

    setEditando(plan);

    setFormulario({
      recomendacionId: Number(
        plan.recomendacion_id
      ),

      recomendacionIndice: null,

      objetivo: plan.objetivo || '',

      acciones: listaTexto(plan.acciones),

      indicadores: listaTexto(
        plan.indicadores_progreso
      ),

      prioridad: plan.prioridad || 'media',

      fecha: plan.fecha_seguimiento || '',

      observaciones:
        plan.observaciones_orientador || '',

      estado: plan.estado,
    });

    setFormularioVisible(true);
    setMostrarRecomendaciones(false);
  };

  // ====================================================
  // CANCELAR FORMULARIO
  // ====================================================

  const cancelarFormulario = () => {
    if (guardando) {
      return;
    }

    setFormularioVisible(false);
    setEditando(null);
    setFormulario(crearFormularioInicial());
    setMostrarRecomendaciones(false);
  };

  // ====================================================
  // VALIDAR Y GUARDAR
  // ====================================================

  const ejecutarGuardado = async () => {
    if (guardando) {
      return;
    }

    const objetivo =
      formulario.objetivo.trim();

    const fecha =
      formulario.fecha.trim();

    const acciones = listaDesdeTexto(
      formulario.acciones,
      editando?.acciones
    );

    const indicadoresProgreso = listaDesdeTexto(
      formulario.indicadores,
      editando?.indicadores_progreso
    );

    if (!editando && !formulario.recomendacionId) {
      Alert.alert(
        'Recomendación requerida',
        'Selecciona una recomendación académica.'
      );
      return;
    }

    if (!objetivo) {
      Alert.alert(
        'Objetivo requerido',
        'Debes registrar el objetivo académico.'
      );
      return;
    }

    if (acciones.length === 0) {
      Alert.alert(
        'Acciones requeridas',
        'Registra al menos una acción de acompañamiento.'
      );
      return;
    }

    if (indicadoresProgreso.length === 0) {
      Alert.alert(
        'Indicadores requeridos',
        'Registra al menos un indicador para evaluar el progreso del estudiante.'
      );
      return;
    }

    if (!fechaValida(fecha)) {
      Alert.alert(
        'Fecha inválida',
        'Utiliza el formato AAAA-MM-DD.'
      );
      return;
    }

    const datos = {
      objetivo,
      acciones,
      indicadoresProgreso,
      prioridad: formulario.prioridad,
      fechaSeguimiento: fecha || null,
      observacionesOrientador:
        formulario.observaciones.trim() || null,
    };

    setGuardando(true);

    try {
      if (editando) {
        await actualizarPlanEstudiante({
          apiUrl,
          accessToken,
          estudianteId,
          planId: editando.id,

          cambios: {
            ...datos,
            estado: formulario.estado,
          },
        });
      } else {
        await crearPlanEstudiante({
          apiUrl,
          accessToken,
          estudianteId,

          recomendacionId:
            formulario.recomendacionId,

          alertaId:
            alertaId === null
              ? null
              : Number(alertaId),

          ...datos,
        });
      }

      const eraEdicion = Boolean(editando);

      cancelarFormulario();
      await cargar();

      Alert.alert(
        'Operación exitosa',
        eraEdicion
          ? 'El seguimiento del plan se actualizó correctamente.'
          : 'El plan de acompañamiento se creó correctamente.'
      );
    } catch (error) {
      Alert.alert(
        'No fue posible guardar',
        error.message ||
          'Comprueba la información e inténtalo nuevamente.'
      );
    } finally {
      setGuardando(false);
    }
  };

  const confirmarGuardado = () => {
    if (guardando) {
      return;
    }

    Alert.alert(
      editando
        ? 'Actualizar seguimiento'
        : 'Crear plan de acompañamiento',

      '¿Confirmas que la información ha sido revisada y deseas guardarla?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: ejecutarGuardado,
        },
      ]
    );
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>
          Planes de acompañamiento
        </Text>

        <Text style={styles.descripcion}>
          Diseña, administra y realiza seguimiento
          a los planes de apoyo académico.
        </Text>
      </View>

      {/* RESUMEN */}

      <View style={styles.resumen}>
        {[
          ['Total', resumen.total],
          ['Activos', resumen.activos],
          ['Completados', resumen.completados],
        ].map(([titulo, cantidad]) => (
          <View
            key={titulo}
            style={styles.resumenTarjeta}
          >
            <Text style={styles.resumenNumero}>
              {cantidad}
            </Text>

            <Text style={styles.resumenTitulo}>
              {titulo}
            </Text>
          </View>
        ))}
      </View>

      <Boton
        titulo="Actualizar información"
        onPress={cargar}
        secundario
        disabled={cargando || guardando}
      />

      {cargando ? (
        <ActivityIndicator
          size="large"
          color={COLORES.primario}
          style={{ marginVertical: 24 }}
        />
      ) : (
        <>
          {/* ERROR DE PLANES */}

          {errorPlanes ? (
            <View style={styles.errorCaja}>
              <Text style={styles.errorTexto}>
                {errorPlanes}
              </Text>

              <Boton
                titulo="Reintentar consulta"
                onPress={cargar}
                secundario
              />
            </View>
          ) : null}

          {/* CREAR PLAN */}

          {!formularioVisible && (
            <Boton
              titulo="+ Crear plan de acompañamiento"
              onPress={nuevoPlan}
            />
          )}

          {/* FORMULARIO */}

          {formularioVisible && (
            <View style={styles.formulario}>
              <Text style={styles.formularioTitulo}>
                {editando
                  ? `Seguimiento del plan #${editando.id}`
                  : 'Nuevo plan académico'}
              </Text>

              <Text style={styles.textoSecundario}>
                {editando
                  ? 'Actualiza las acciones, los indicadores y el estado del plan.'
                  : 'Selecciona una recomendación y revisa las acciones propuestas antes de guardar.'}
              </Text>

              {/* RECOMENDACIONES */}

              {!editando && (
                <View style={styles.seccionFormulario}>
                  <Text style={styles.subtitulo}>
                    1. Recomendación de origen
                  </Text>

                  {errorRecomendaciones ? (
                    <View style={styles.advertenciaCaja}>
                      <Text style={styles.advertenciaTexto}>
                        {errorRecomendaciones}
                      </Text>
                    </View>
                  ) : null}

                  <Boton
                    titulo={
                      mostrarRecomendaciones
                        ? 'Ocultar recomendaciones'
                        : 'Cambiar recomendación'
                    }
                    secundario
                    onPress={() =>
                      setMostrarRecomendaciones(
                        (actual) => !actual
                      )
                    }
                  />

                  {mostrarRecomendaciones && (
                    <View style={styles.listaRecomendaciones}>
                      {recomendaciones.length === 0 ? (
                        <Text style={styles.textoSecundario}>
                          No hay recomendaciones disponibles.
                          Genera primero una recomendación académica.
                        </Text>
                      ) : (
                        recomendaciones.map(
                          (recomendacion) => {
                            const seleccionada =
                              formulario.recomendacionId ===
                              Number(recomendacion.id);

                            const sugerencias =
                              obtenerSugerencias(
                                recomendacion
                              );

                            return (
                              <View
                                key={String(
                                  recomendacion.id
                                )}
                                style={[
                                  styles.recomendacionTarjeta,
                                  seleccionada &&
                                    styles.tarjetaSeleccionada,
                                ]}
                              >
                                <TouchableOpacity
                                  onPress={() =>
                                    seleccionarRecomendacion(
                                      recomendacion
                                    )
                                  }
                                >
                                  <Text
                                    style={styles.recomendacionTitulo}
                                  >
                                    {seleccionada
                                      ? '● '
                                      : '○ '}
                                    Recomendación #
                                    {recomendacion.id}
                                  </Text>

                                  <Text
                                    style={styles.textoSecundario}
                                  >
                                    {recomendacion.origen ===
                                    'ia'
                                      ? 'Generada mediante inteligencia artificial'
                                      : 'Recomendación predefinida'}
                                  </Text>
                                </TouchableOpacity>

                                {seleccionada &&
                                sugerencias.length > 0 ? (
                                  <View
                                    style={styles.sugerencias}
                                  >
                                    <Text
                                      style={styles.subtitulo}
                                    >
                                      Selecciona una sugerencia
                                    </Text>

                                    {sugerencias.map(
                                      (
                                        sugerencia,
                                        indice
                                      ) => (
                                        <TouchableOpacity
                                          key={indice}
                                          style={
                                            styles.sugerenciaTarjeta
                                          }
                                          onPress={() =>
                                            aplicarSugerencia(
                                              recomendacion,
                                              sugerencia,
                                              indice
                                            )
                                          }
                                        >
                                          <Text
                                            style={
                                              styles.sugerenciaTitulo
                                            }
                                          >
                                            {indice + 1}.{' '}
                                            {sugerencia.titulo ||
                                              'Sugerencia académica'}
                                          </Text>

                                          <Text
                                            style={
                                              styles.textoSecundario
                                            }
                                          >
                                            {sugerencia.descripcion ||
                                              ''}
                                          </Text>

                                          <Text
                                            style={
                                              styles.enlaceAccion
                                            }
                                          >
                                            Utilizar esta sugerencia →
                                          </Text>
                                        </TouchableOpacity>
                                      )
                                    )}
                                  </View>
                                ) : null}
                              </View>
                            );
                          }
                        )
                      )}
                    </View>
                  )}

                  {formulario.recomendacionId ? (
                    <View style={styles.confirmacionCaja}>
                      <Text style={styles.confirmacionTexto}>
                        Recomendación #
                        {formulario.recomendacionId}
                        {' '}seleccionada.
                      </Text>

                      {formulario.recomendacionIndice !==
                      null ? (
                        <Text
                          style={styles.confirmacionTexto}
                        >
                          Sugerencia #
                          {formulario.recomendacionIndice +
                            1}
                          {' '}aplicada al formulario.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )}

              {/* OBJETIVO */}

              <View style={styles.seccionFormulario}>
                <Text style={styles.subtitulo}>
                  {editando
                    ? 'Objetivo del plan'
                    : '2. Objetivo académico'}
                </Text>

                <Campo
                  titulo="Objetivo"
                  obligatorio
                  valor={formulario.objetivo}
                  onChange={(valor) =>
                    cambiar('objetivo', valor)
                  }
                  multiline
                  placeholder="Describe el resultado académico que se busca alcanzar."
                />
              </View>

              {/* ACCIONES */}

              <View style={styles.seccionFormulario}>
                <Text style={styles.subtitulo}>
                  Acciones de acompañamiento
                </Text>

                <Campo
                  titulo="Acciones (una por línea)"
                  obligatorio
                  valor={formulario.acciones}
                  onChange={(valor) =>
                    cambiar('acciones', valor)
                  }
                  multiline
                  placeholder="Escribe las acciones que se realizarán."
                />

                <Text style={styles.ayuda}>
                  Las acciones sugeridas por IA pueden
                  modificarse antes de guardar.
                </Text>
              </View>

              {/* INDICADORES */}

              <View style={styles.seccionFormulario}>
                <Text style={styles.subtitulo}>
                  Indicadores de progreso
                </Text>

                <Campo
                  titulo="Indicadores (uno por línea)"
                  obligatorio
                  valor={formulario.indicadores}
                  onChange={(valor) =>
                    cambiar('indicadores', valor)
                  }
                  multiline
                  placeholder="Define cómo se evaluará el avance."
                />

                <Text style={styles.ayuda}>
                  Estos indicadores permitirán evaluar
                  posteriormente el cumplimiento del plan.
                </Text>
              </View>

              {/* PRIORIDAD */}

              <View style={styles.seccionFormulario}>
                <Text style={styles.subtitulo}>
                  Prioridad del plan
                </Text>

                <View style={styles.prioridades}>
                  {PRIORIDADES.map((prioridad) => (
                    <TouchableOpacity
                      key={prioridad}
                      onPress={() =>
                        cambiar(
                          'prioridad',
                          prioridad
                        )
                      }
                      style={[
                        styles.prioridadBoton,
                        formulario.prioridad ===
                          prioridad &&
                          styles.prioridadSeleccionada,
                      ]}
                    >
                      <Text
                        style={[
                          styles.prioridadTexto,
                          formulario.prioridad ===
                            prioridad &&
                            styles.prioridadTextoSeleccionado,
                        ]}
                      >
                        {prioridadTexto(prioridad)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* FECHA */}

              <Campo
                titulo="Fecha de seguimiento (AAAA-MM-DD)"
                valor={formulario.fecha}
                onChange={(valor) =>
                  cambiar('fecha', valor)
                }
                placeholder="2026-11-20"
              />

              {/* OBSERVACIONES */}

              <Campo
                titulo="Observaciones del orientador"
                valor={formulario.observaciones}
                onChange={(valor) =>
                  cambiar('observaciones', valor)
                }
                multiline
                placeholder="Registra observaciones relevantes."
              />

              {/* ESTADO */}

              {editando && (
                <View style={styles.seccionFormulario}>
                  <Text style={styles.subtitulo}>
                    Estado del seguimiento
                  </Text>

                  {[
                    editando.estado,
                    ...(TRANSICIONES[
                      editando.estado
                    ] || []),
                  ].map((estado) => (
                    <TouchableOpacity
                      key={estado}
                      style={[
                        styles.estadoOpcion,
                        formulario.estado ===
                          estado &&
                          styles.estadoOpcionSeleccionada,
                      ]}
                      onPress={() =>
                        cambiar('estado', estado)
                      }
                    >
                      <Text style={styles.estadoOpcionTexto}>
                        {formulario.estado ===
                        estado
                          ? '● '
                          : '○ '}
                        {ESTADOS[estado]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ADVERTENCIA */}

              <View style={styles.advertenciaCaja}>
                <Text style={styles.advertenciaTexto}>
                  Las sugerencias automáticas son un
                  apoyo orientativo. El Orientador debe
                  revisar y validar el plan antes de
                  guardarlo.
                </Text>
              </View>

              {/* ACCIONES */}

              <Boton
                titulo={
                  guardando
                    ? 'Guardando información...'
                    : editando
                      ? 'Guardar seguimiento'
                      : 'Guardar plan de acompañamiento'
                }
                onPress={confirmarGuardado}
                disabled={guardando}
              />

              <Boton
                titulo="Cancelar"
                onPress={cancelarFormulario}
                secundario
                disabled={guardando}
              />
            </View>
          )}

          {/* HISTORIAL */}

          <View style={styles.historial}>
            <Text style={styles.historialTitulo}>
              Planes registrados ({planes.length})
            </Text>

            {!errorPlanes && planes.length === 0 ? (
              <View style={styles.vacio}>
                <Text style={styles.vacioTitulo}>
                  Sin planes registrados
                </Text>

                <Text style={styles.textoSecundario}>
                  Cuando se cree un plan de acompañamiento,
                  aparecerá en esta sección.
                </Text>
              </View>
            ) : null}

            {planes.map((plan) => {
              const abierto =
                expandido === plan.id;

              const modificable =
                (
                  TRANSICIONES[plan.estado] ||
                  []
                ).length > 0;

              return (
                <View
                  key={String(plan.id)}
                  style={styles.planTarjeta}
                >
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() =>
                      setExpandido(
                        abierto ? null : plan.id
                      )
                    }
                  >
                    <View style={styles.planEncabezado}>
                      <Text style={styles.planTitulo}>
                        Plan #{plan.id}
                      </Text>

                      <Etiqueta
                        texto={
                          ESTADOS[plan.estado] ||
                          plan.estado
                        }
                        tipo={
                          plan.estado ===
                          'completado'
                            ? 'verde'
                            : plan.estado ===
                                'cancelado'
                              ? 'rojo'
                              : 'azul'
                        }
                      />
                    </View>

                    <Text style={styles.planObjetivo}>
                      {plan.objetivo}
                    </Text>

                    <Text style={styles.textoSecundario}>
                      Prioridad:{' '}
                      {prioridadTexto(
                        plan.prioridad
                      )}
                    </Text>

                    <Text style={styles.textoSecundario}>
                      Seguimiento:{' '}
                      {fechaTexto(
                        plan.fecha_seguimiento
                      )}
                    </Text>

                    <Text style={styles.enlaceAccion}>
                      {abierto
                        ? 'Ocultar detalles ▲'
                        : 'Ver detalles y seguimiento ▼'}
                    </Text>
                  </TouchableOpacity>

                  {abierto && (
                    <View style={styles.planDetalles}>
                      <Text style={styles.textoSecundario}>
                        Recomendación de origen: #
                        {plan.recomendacion_id}
                      </Text>

                      <ListaElementos
                        titulo="Acciones académicas"
                        elementos={plan.acciones}
                      />

                      <ListaElementos
                        titulo="Indicadores de progreso"
                        elementos={
                          plan.indicadores_progreso
                        }
                      />

                      <Text style={styles.subtitulo}>
                        Observaciones del orientador
                      </Text>

                      <Text style={styles.textoNormal}>
                        {plan.observaciones_orientador ||
                          'Sin observaciones registradas.'}
                      </Text>

                      <Text style={styles.textoSecundario}>
                        Creado:{' '}
                        {fechaTexto(
                          plan.created_at
                        )}
                      </Text>

                      {modificable && (
                        <Boton
                          titulo="Editar y registrar seguimiento"
                          onPress={() =>
                            editarPlan(plan)
                          }
                          secundario
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: COLORES.blanco,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    marginBottom: 16,
  },

  encabezado: {
    marginBottom: 18,
  },

  titulo: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORES.texto,
    marginBottom: 8,
  },

  descripcion: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORES.secundario,
  },

  resumen: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },

  resumenTarjeta: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 5,
    backgroundColor: COLORES.fondo,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORES.borde,
  },

  resumenNumero: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORES.primarioOscuro,
  },

  resumenTitulo: {
    fontSize: 11,
    color: COLORES.secundario,
    marginTop: 5,
  },

  boton: {
    backgroundColor: COLORES.primario,
    borderRadius: 11,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 12,
  },

  botonSecundario: {
    backgroundColor: COLORES.azulClaro,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },

  botonPeligro: {
    backgroundColor: COLORES.rojoClaro,
  },

  botonTexto: {
    color: COLORES.blanco,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  botonTextoSecundario: {
    color: COLORES.primarioOscuro,
  },

  botonTextoPeligro: {
    color: COLORES.rojo,
  },

  deshabilitado: {
    opacity: 0.5,
  },

  formulario: {
    marginTop: 20,
    padding: 15,
    borderRadius: 14,
    backgroundColor: COLORES.fondo,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },

  formularioTitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORES.texto,
    marginBottom: 8,
  },

  seccionFormulario: {
    marginTop: 20,
  },

  subtitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORES.texto,
    marginBottom: 10,
  },

  campo: {
    marginTop: 14,
  },

  etiqueta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },

  input: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: COLORES.texto,
  },

  inputMultiline: {
    minHeight: 95,
  },

  ayuda: {
    color: COLORES.secundario,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 7,
  },

  listaRecomendaciones: {
    marginTop: 12,
  },

  recomendacionTarjeta: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },

  tarjetaSeleccionada: {
    borderColor: COLORES.primario,
    backgroundColor: '#F8FBFF',
  },

  recomendacionTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORES.texto,
    marginBottom: 5,
  },

  sugerencias: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
    paddingTop: 12,
  },

  sugerenciaTarjeta: {
    backgroundColor: COLORES.azulClaro,
    padding: 12,
    borderRadius: 10,
    marginBottom: 9,
  },

  sugerenciaTitulo: {
    color: COLORES.primarioOscuro,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },

  enlaceAccion: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORES.primario,
    marginTop: 12,
  },

  confirmacionCaja: {
    backgroundColor: COLORES.verdeClaro,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },

  confirmacionTexto: {
    color: COLORES.verde,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 19,
  },

  advertenciaCaja: {
    backgroundColor: COLORES.amarilloClaro,
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },

  advertenciaTexto: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 19,
  },

  prioridades: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  prioridadBoton: {
    flexGrow: 1,
    padding: 12,
    borderRadius: 9,
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    alignItems: 'center',
  },

  prioridadSeleccionada: {
    backgroundColor: '#DBEAFE',
    borderColor: COLORES.primario,
  },

  prioridadTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORES.secundario,
  },

  prioridadTextoSeleccionado: {
    color: COLORES.primarioOscuro,
  },

  estadoOpcion: {
    padding: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORES.borde,
    backgroundColor: COLORES.blanco,
    marginBottom: 8,
  },

  estadoOpcionSeleccionada: {
    backgroundColor: COLORES.azulClaro,
    borderColor: COLORES.primario,
  },

  estadoOpcionTexto: {
    fontSize: 13,
    color: COLORES.texto,
    fontWeight: '600',
  },

  historial: {
    marginTop: 25,
  },

  historialTitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORES.texto,
    marginBottom: 14,
  },

  vacio: {
    backgroundColor: COLORES.fondo,
    padding: 22,
    borderRadius: 12,
    alignItems: 'center',
  },

  vacioTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORES.texto,
    marginBottom: 8,
  },

  planTarjeta: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    backgroundColor: COLORES.fondo,
    borderRadius: 13,
    padding: 15,
    marginBottom: 13,
  },

  planEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  planTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORES.texto,
  },

  planObjetivo: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: COLORES.texto,
    marginBottom: 12,
  },

  etiquetaEstado: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  etiquetaEstadoTexto: {
    color: COLORES.primarioOscuro,
    fontSize: 11,
    fontWeight: '700',
  },

  etiquetaVerde: {
    backgroundColor: '#DCFCE7',
  },

  etiquetaRoja: {
    backgroundColor: '#FEE2E2',
  },

  textoVerde: {
    color: '#166534',
  },

  textoRojo: {
    color: COLORES.rojo,
  },

  planDetalles: {
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
    marginTop: 15,
    paddingTop: 15,
  },

  bloqueDetalle: {
    marginTop: 16,
  },

  filaElemento: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 9,
  },

  viñeta: {
    color: COLORES.primario,
    fontSize: 18,
  },

  textoNormal: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 21,
  },

  textoSecundario: {
    color: COLORES.secundario,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 4,
  },

  errorCaja: {
    backgroundColor: COLORES.rojoClaro,
    padding: 13,
    borderRadius: 10,
    marginTop: 15,
  },

  errorTexto: {
    color: COLORES.rojo,
    fontSize: 12,
    lineHeight: 19,
  },
});