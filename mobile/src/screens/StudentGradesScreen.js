
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  guardarCalificacionesLocales,
  obtenerCalificacionesLocales,
} from '../../database/localDatabase';

// =====================================================
// AULA-AI | HU-07
// MIS CALIFICACIONES ONLINE Y OFFLINE
// Conserva funcionalidades de HU-05.
// =====================================================

const TIMEOUT_MS = 8000;

const primero = (valor) =>
  Array.isArray(valor) ? valor[0] : valor;

const promedioSimple = (items) => {
  const notas = items
    .map((item) => Number(item.valor))
    .filter(Number.isFinite);

  if (!notas.length) return null;

  return notas.reduce(
    (suma, nota) => suma + nota,
    0
  ) / notas.length;
};

const formatearFecha = (fecha) => {
  if (!fecha) return '';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return '';
  }

  return valor.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatearActualizacion = (fecha) => {
  if (!fecha) return 'No disponible';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'No disponible';
  }

  return valor.toLocaleString('es-CO');
};

// Se utiliza un límite real de tiempo,
// incluso si Android demora en rechazar fetch.
const consultarJSON = async (
  url,
  accessToken,
  signal
) => {
  const controller = new AbortController();

  const cancelar = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener(
        'abort',
        cancelar,
        { once: true }
      );
    }
  }

  let temporizador;

  try {
    const consulta = (async () => {
      const respuesta = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        const error = new Error(
          respuesta.status === 401
            ? 'Tu sesión ha vencido. Inicia sesión nuevamente.'
            : respuesta.status === 403
              ? 'No tienes permiso para consultar esta información.'
              : data.message ||
                'No fue posible consultar los datos.'
        );

        error.status = respuesta.status;
        throw error;
      }

      return data;
    })();

    const controlada = consulta.then(
      (data) => ({
        tipo: 'resultado',
        data,
      }),
      (error) => ({
        tipo: 'error',
        error,
      })
    );

    const limite = new Promise((resolve) => {
      temporizador = setTimeout(() => {
        controller.abort();
        resolve({ tipo: 'timeout' });
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

    return resultado.data;
  } finally {
    clearTimeout(temporizador);

    if (signal) {
      signal.removeEventListener(
        'abort',
        cancelar
      );
    }
  }
};

const normalizarNota = (
  item,
  esLocal,
  promediosPeriodos = []
) => {
  if (esLocal) {
    return {
      id: item.id,
      valor: Number(item.valor),
      titulo:
        item.actividad_titulo || 'Actividad',
      tipo:
        item.actividad_tipo || 'actividad',
      materia:
        item.materia || 'Materia',
      materiaId: item.materia_id ?? null,
      grado: item.grado || '',
      grupo: item.grupo || '',
      periodoId: item.periodo_id ?? null,
      periodoNombre:
        item.periodo_nombre || '',
      anio:
        item.anio ??
        item.periodo_anio ??
        null,
      retroalimentacion:
        item.retroalimentacion || '',
      fecha:
        item.updated_at ||
        item.created_at ||
        '',
      tieneCalificacion: true,
    };
  }

  const actividad = primero(item.actividad);
  const asignacion = primero(
    actividad?.materia_grupo_periodo
  );

  const materia = primero(asignacion?.materia);
  const grado = primero(asignacion?.grado);
  const grupo = primero(asignacion?.grupo);
  const periodo = primero(asignacion?.periodo);

  const periodoId =
    asignacion?.periodo_id ?? null;

  const infoPeriodo = promediosPeriodos.find(
    (p) =>
      String(p.periodoId) ===
      String(periodoId)
  );

  return {
    id: item.id,
    valor: Number(item.valor),
    titulo:
      actividad?.titulo || 'Actividad',
    tipo:
      actividad?.tipo || 'actividad',
    materia:
      materia?.nombre || 'Materia',
    materiaId: materia?.id ?? null,
    grado: grado?.nombre || '',
    grupo: grupo?.nombre || '',
    periodoId,
    periodoNombre:
      periodo?.nombre ||
      infoPeriodo?.nombre ||
      '',
    anio:
      periodo?.anio ??
      infoPeriodo?.anio ??
      (
        String(
          periodo?.fecha_inicio ||
          infoPeriodo?.fechaInicio ||
          ''
        ).slice(0, 4) || null
      ),

    retroalimentacion:
      item.retroalimentacion || '',
    fecha:
      item.updated_at ||
      item.created_at ||
      '',
    tieneCalificacion: true,
  };
};

const normalizarMateriasSinNota = (
  asignadas,
  calificaciones,
  promediosPeriodos
) => {
  const clavesConNota = new Set(
    calificaciones.map(
      (nota) =>
        `${nota.materiaId}:${nota.periodoId}`
    )
  );

  const agregadas = new Set();

  return asignadas.flatMap((item) => {
    const asignacion = item.asignacion || item;

    const materia = primero(
      asignacion.materia
    );
    const grado = primero(asignacion.grado);
    const grupo = primero(asignacion.grupo);
    const periodo = primero(
      asignacion.periodo
    );

    const materiaId =
      materia?.id ??
      asignacion.materia_id ??
      asignacion.id;

    const periodoId =
      asignacion.periodo_id ??
      periodo?.id ??
      null;

    const clave =
      `${materiaId}:${periodoId}`;

    if (
      clavesConNota.has(clave) ||
      agregadas.has(clave)
    ) {
      return [];
    }

    agregadas.add(clave);

    const infoPeriodo = promediosPeriodos.find(
      (p) =>
        String(p.periodoId) ===
        String(periodoId)
    );

    return [{
      id: `sin-nota-${asignacion.id}`,
      valor: null,
      tieneCalificacion: false,
      titulo: 'Sin calificaciones registradas',
      tipo: 'Sin nota',
      materia:
        materia?.nombre || 'Materia',
      materiaId,
      grado: grado?.nombre || '',
      grupo: grupo?.nombre || '',
      periodoId,
      periodoNombre:
        periodo?.nombre ||
        infoPeriodo?.nombre ||
        '',
      anio:
        periodo?.anio ??
        infoPeriodo?.anio ??
        null,
      retroalimentacion: '',
      fecha: '',
    }];
  });
};

export default function StudentGradesScreen({
  apiUrl,
  accessToken,
  usuarioId,
  onBack,
}) {
  const [
    calificaciones,
    setCalificaciones,
  ] = useState([]);

  const [
    materiasAsignadas,
    setMateriasAsignadas,
  ] = useState([]);

  const [
    promediosPeriodos,
    setPromediosPeriodos,
  ] = useState([]);

  const [
    promedioAnual,
    setPromedioAnual,
  ] = useState(null);

  const [cargando, setCargando] =
    useState(true);

  const [
    actualizando,
    setActualizando,
  ] = useState(false);

  const [modoOffline, setModoOffline] =
    useState(false);

  const [origen, setOrigen] =
    useState(null);

  const [
    ultimaActualizacion,
    setUltimaActualizacion,
  ] = useState(null);

  const [error, setError] =
    useState('');

  const [aviso, setAviso] =
    useState('');

  const [
    materiaSeleccionada,
    setMateriaSeleccionada,
  ] = useState('Todas');

  const [
    periodoSeleccionado,
    setPeriodoSeleccionado,
  ] = useState('Todos');

  const solicitudId = useRef(0);
  const controllerRef = useRef(null);

  // ================================================
  // CARGAR SQLITE ANTES DEL SERVIDOR
  // ================================================

  const cargarCalificaciones = useCallback(
    async (mostrarCarga = true) => {
      const id = ++solicitudId.current;

      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;

      if (mostrarCarga) {
        setCargando(true);
      } else {
        setActualizando(true);
      }

      setError('');
      setAviso('');

      let hayCopia = false;

      try {
        if (!usuarioId || !accessToken) {
          throw new Error(
            'No existe una sesión válida.'
          );
        }

        // Primero consultar calificaciones SQLite.
        try {
          const locales =
            await obtenerCalificacionesLocales(
              usuarioId
            );

          if (
            controller.signal.aborted ||
            id !== solicitudId.current
          ) {
            return;
          }

          if (
            Array.isArray(locales) &&
            locales.length > 0
          ) {
            hayCopia = true;

            const normalizadas = locales
              .map((item) =>
                normalizarNota(item, true)
              )
              .filter((item) =>
                Number.isFinite(item.valor)
              );

            setCalificaciones(normalizadas);
            setModoOffline(true);
            setOrigen('sqlite');

            // Nunca utilizar un promedio oficial
            // anterior sin su contexto.
            setPromediosPeriodos([]);
            setPromedioAnual(null);
            setMateriasAsignadas([]);

            const fechaLocal =
              locales[0]?.sincronizado_en ||
              locales[0]?.actualizado_en ||
              null;

            setUltimaActualizacion(
              fechaLocal
            );

            setCargando(false);
          } else {
            setCalificaciones([]);
            setOrigen(null);
            setModoOffline(false);
          }
        } catch (errorLocal) {
          console.warn(
            'HU-07: no se pudieron leer las notas locales:',
            errorLocal.message
          );
        }

        // ========================================
        // CONSULTAR CALIFICACIONES OFICIALES
        // ========================================

        const data = await consultarJSON(
          `${apiUrl}/api/grades/estudiante/mis-calificaciones`,
          accessToken,
          controller.signal
        );

        if (
          controller.signal.aborted ||
          id !== solicitudId.current
        ) {
          return;
        }

        if (!Array.isArray(data.calificaciones)) {
          throw new Error(
            'El servidor devolvió calificaciones inválidas.'
          );
        }

        const listaPeriodos =
          Array.isArray(data.promediosPeriodos)
            ? data.promediosPeriodos
            : [];

        const notasNormalizadas =
          data.calificaciones
            .map((item) =>
              normalizarNota(
                item,
                false,
                listaPeriodos
              )
            )
            .filter((item) =>
              Number.isFinite(item.valor)
            );

        setCalificaciones(
          notasNormalizadas
        );

        setPromediosPeriodos(
          listaPeriodos
        );

        setPromedioAnual(
          data.resumen?.promedioAnual ??
          null
        );

        setModoOffline(false);
        setOrigen('servidor');
        setUltimaActualizacion(
          new Date().toISOString()
        );

        // ========================================
        // CARGAR MATERIAS PARA IDENTIFICAR
        // TAMBIÉN LAS QUE NO TIENEN NOTAS
        // ========================================

        try {
          const materiasData = await consultarJSON(
            `${apiUrl}/api/subjects/mis-materias-estudiante`,
            accessToken,
            controller.signal
          );

          if (
            id === solicitudId.current &&
            !controller.signal.aborted
          ) {
            setMateriasAsignadas(
              Array.isArray(materiasData.materias)
                ? materiasData.materias
                : []
            );
          }
        } catch (errorMaterias) {
          if (
            id === solicitudId.current &&
            !controller.signal.aborted
          ) {
            setMateriasAsignadas([]);

            console.warn(
              'HU-07: no fue posible cargar materias sin nota:',
              errorMaterias.message
            );
          }
        }

        // ========================================
        // GUARDAR NOTAS EN SQLITE
        // Se conserva la función original.
        // ========================================

        try {
          await guardarCalificacionesLocales(
            usuarioId,
            data.calificaciones
          );
        } catch (errorGuardado) {
          if (
            id === solicitudId.current &&
            !controller.signal.aborted
          ) {
            setAviso(
              'Las notas se consultaron correctamente, pero no pudieron guardarse para usarlas sin conexión.'
            );
          }

          console.warn(
            'HU-07: error guardando notas locales:',
            errorGuardado.message
          );
        }
      } catch (fallo) {
        if (
          controller.signal.aborted &&
          fallo.name === 'AbortError'
        ) {
          return;
        }

        if (id !== solicitudId.current) {
          return;
        }

        const accesoDenegado =
          fallo.status === 401 ||
          fallo.status === 403;

        if (accesoDenegado) {
          setCalificaciones([]);
          setMateriasAsignadas([]);
          setPromediosPeriodos([]);
          setPromedioAnual(null);
          setOrigen(null);
          setModoOffline(false);

          setError(fallo.message);
        } else if (hayCopia) {
          setOrigen('sqlite');
          setModoOffline(true);

          setAviso(
            'No fue posible conectarse al servidor. Estás consultando las últimas calificaciones guardadas en SQLite.'
          );
        } else {
          setCalificaciones([]);
          setOrigen(null);
          setModoOffline(false);

          setError(
            'No hay conexión y todavía no existen calificaciones descargadas en este dispositivo.'
          );
        }
      } finally {
        if (id === solicitudId.current) {
          setCargando(false);
          setActualizando(false);

          if (
            controllerRef.current ===
            controller
          ) {
            controllerRef.current = null;
          }
        }
      }
    },
    [
      apiUrl,
      accessToken,
      usuarioId,
    ]
  );

  useEffect(() => {
    const temporizador = setTimeout(() => {
      cargarCalificaciones(true);
    }, 0);

    return () => {
      clearTimeout(temporizador);
      solicitudId.current += 1;

      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [cargarCalificaciones]);

  // ================================================
  // DATOS PARA LA INTERFAZ
  // ================================================

  const notasRegistradas = useMemo(
    () =>
      calificaciones.filter(
        (nota) =>
          Number.isFinite(nota.valor)
      ),
    [calificaciones]
  );

  const materiasSinNota = useMemo(
    () => {
      if (modoOffline) {
        return [];
      }

      return normalizarMateriasSinNota(
        materiasAsignadas,
        notasRegistradas,
        promediosPeriodos
      );
    },
    [
      materiasAsignadas,
      notasRegistradas,
      promediosPeriodos,
      modoOffline,
    ]
  );

  const calificacionesParaMostrar = useMemo(
    () => [
      ...notasRegistradas,
      ...materiasSinNota,
    ],
    [
      notasRegistradas,
      materiasSinNota,
    ]
  );

  const periodosDisponibles = useMemo(() => {
    if (!modoOffline) {
      return promediosPeriodos;
    }

    const mapa = new Map();

    for (const nota of notasRegistradas) {
      if (
        nota.periodoId == null
      ) {
        continue;
      }

      const clave = String(nota.periodoId);

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          periodoId: nota.periodoId,
          nombre:
            nota.periodoNombre ||
            `Periodo ${nota.periodoId}`,
          anio: nota.anio,
        });
      }
    }

    return [...mapa.values()];
  }, [
    modoOffline,
    promediosPeriodos,
    notasRegistradas,
  ]);

  const materiasDisponibles = useMemo(
    () => [
      'Todas',
      ...new Set(
        calificacionesParaMostrar
          .map((nota) => nota.materia)
          .filter(Boolean)
      ),
    ],
    [calificacionesParaMostrar]
  );

  const calificacionesFiltradas = useMemo(
    () =>
      calificacionesParaMostrar.filter(
        (nota) =>
          (
            periodoSeleccionado === 'Todos' ||
            String(nota.periodoId) ===
              String(periodoSeleccionado)
          ) &&
          (
            materiaSeleccionada === 'Todas' ||
            nota.materia ===
              materiaSeleccionada
          )
      ),
    [
      calificacionesParaMostrar,
      periodoSeleccionado,
      materiaSeleccionada,
    ]
  );

  const notasFiltradas = useMemo(
    () =>
      calificacionesFiltradas.filter(
        (nota) => nota.tieneCalificacion
      ),
    [calificacionesFiltradas]
  );

  const promedioVisible = useMemo(() => {
    if (modoOffline) {
      // Promedio aritmético, NO oficial.
      const base =
        periodoSeleccionado === 'Todos'
          ? notasRegistradas
          : notasRegistradas.filter(
              (nota) =>
                String(nota.periodoId) ===
                String(periodoSeleccionado)
            );

      return promedioSimple(base);
    }

    if (periodoSeleccionado === 'Todos') {
      return promedioAnual;
    }

    const periodo = promediosPeriodos.find(
      (item) =>
        String(item.periodoId) ===
        String(periodoSeleccionado)
    );

    return periodo?.promedio ?? null;
  }, [
    modoOffline,
    periodoSeleccionado,
    notasRegistradas,
    promedioAnual,
    promediosPeriodos,
  ]);

  const resumenRendimiento = useMemo(
    () => ({
      alto: notasFiltradas.filter(
        (nota) => nota.valor >= 4
      ).length,
      medio: notasFiltradas.filter(
        (nota) =>
          nota.valor >= 3 &&
          nota.valor < 4
      ).length,
      bajo: notasFiltradas.filter(
        (nota) => nota.valor < 3
      ).length,
    }),
    [notasFiltradas]
  );

  // ================================================
  // TARJETA INDIVIDUAL
  // ================================================

  const renderCalificacion = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.materiaIcon}>
          <Text style={styles.materiaIconText}>
            {item.materia
              ?.trim()
              .charAt(0)
              .toUpperCase() || 'M'}
          </Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.materia}>
            {item.materia}
          </Text>

          <Text
            style={styles.titulo}
            numberOfLines={2}
          >
            {item.titulo}
          </Text>
        </View>

        <View style={styles.notaBox}>
          <Text style={styles.nota}>
            {item.tieneCalificacion
              ? Number(item.valor).toFixed(2)
              : '-'}
          </Text>

          <Text style={styles.notaMax}>
            {item.tieneCalificacion
              ? '/ 5.00'
              : 'Sin nota'}
          </Text>
        </View>
      </View>

      <View style={styles.divider}/>

      <View style={styles.detalles}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {item.tipo}
          </Text>
        </View>

        {item.grado || item.grupo ? (
          <Text style={styles.grupoTexto}>
            {item.grado}
            {item.grupo
              ? ` · ${item.grupo}`
              : ''}
          </Text>
        ) : null}

        {item.periodoNombre ? (
          <Text style={styles.fecha}>
            {item.periodoNombre}
          </Text>
        ) : null}

        {item.fecha ? (
          <Text style={styles.fecha}>
            {formatearFecha(item.fecha)}
          </Text>
        ) : null}
      </View>

      {item.retroalimentacion ? (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackLabel}>
            Retroalimentación
          </Text>

          <Text style={styles.feedbackText}>
            {item.retroalimentacion}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // ================================================
  // PANTALLA
  // ================================================

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <View style={styles.headerBadge}>
            <Ionicons
              name="school-outline"
              size={13}
              color="#27C4E8"
            />

            <Text style={styles.headerBadgeText}>
              AULA-AI · RENDIMIENTO
            </Text>
          </View>

          <Text style={styles.headerTitle}>
            Mis calificaciones
          </Text>

          <Text style={styles.headerSubtitle}>
            Rendimiento académico
          </Text>
        </View>
      </View>

      {origen === 'sqlite' && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineTitle}>
            Copia local de SQLite — puede estar desactualizada
          </Text>

          <Text style={styles.offlineText}>
            Última descarga:{' '}
            {formatearActualizacion(
              ultimaActualizacion
            )}
          </Text>
        </View>
      )}

      {origen === 'servidor' && (
        <View style={styles.onlineBanner}>
          <Text style={styles.onlineTitle}>
            Información actualizada desde el servidor
          </Text>

          <Text style={styles.onlineDate}>
            Última consulta:{' '}
            {formatearActualizacion(
              ultimaActualizacion
            )}
          </Text>
        </View>
      )}

      {aviso ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            {aviso}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              cargarCalificaciones(false)
            }
          >
            <Text style={styles.retryText}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {cargando && !origen ? (
        <View style={styles.centro}>
          <ActivityIndicator
            size="large"
            color="#1D4E7A"
          />

          <Text style={styles.cargandoTexto}>
            Cargando tus calificaciones...
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.periodosWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                styles.periodosContent
              }
            >
              <TouchableOpacity
                style={[
                  styles.periodoChip,
                  periodoSeleccionado === 'Todos' &&
                    styles.periodoChipActivo,
                ]}
                onPress={() =>
                  setPeriodoSeleccionado('Todos')
                }
              >
                <Text
                  style={[
                    styles.periodoChipTexto,
                    periodoSeleccionado === 'Todos' &&
                      styles.periodoChipTextoActivo,
                  ]}
                >
                  Año
                </Text>
              </TouchableOpacity>

              {periodosDisponibles.map(
                (periodo) => {
                  const seleccionado =
                    String(periodoSeleccionado) ===
                    String(periodo.periodoId);

                  return (
                    <TouchableOpacity
                      key={String(
                        periodo.periodoId
                      )}
                      style={[
                        styles.periodoChip,
                        seleccionado &&
                          styles.periodoChipActivo,
                      ]}
                      onPress={() =>
                        setPeriodoSeleccionado(
                          periodo.periodoId
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.periodoChipTexto,
                          seleccionado &&
                            styles.periodoChipTextoActivo,
                        ]}
                        numberOfLines={1}
                      >
                        {periodo.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Ionicons
                name="stats-chart-outline"
                size={22}
                color="#27C4E8"
              />

              <Text style={styles.summaryLabel}>
                {periodoSeleccionado === 'Todos'
                  ? 'Promedio anual'
                  : 'Promedio periodo'}
              </Text>

              <Text style={styles.summaryValue}>
                {promedioVisible !== null &&
                Number.isFinite(
                  Number(promedioVisible)
                )
                  ? Number(
                      promedioVisible
                    ).toFixed(2)
                  : '-'}
              </Text>

              <Text style={styles.summarySmall}>
                {modoOffline
                  ? 'Estimado · media simple'
                  : promedioVisible !== null
                    ? 'sobre 5.00'
                    : 'Pendiente'}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons
                name="ribbon-outline"
                size={22}
                color="#27C4E8"
              />

              <Text style={styles.summaryLabel}>
                Calificaciones
              </Text>

              <Text style={styles.summaryValue}>
                {notasFiltradas.length}
              </Text>

              <Text style={styles.summarySmall}>
                registradas
              </Text>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>
              Filtrar por materia
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                styles.filterScrollContent
              }
            >
              {materiasDisponibles.map(
                (materia) => {
                  const activa =
                    materiaSeleccionada === materia;

                  return (
                    <TouchableOpacity
                      key={materia}
                      style={[
                        styles.filterChip,
                        activa &&
                          styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setMateriaSeleccionada(
                          materia
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          activa &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        {materia}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.performanceTitle}>
              Resumen de rendimiento
            </Text>

            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Text
                  style={styles.performanceNumber}
                >
                  {resumenRendimiento.alto}
                </Text>

                <Text
                  style={styles.performanceLabel}
                >
                  Alto
                </Text>
              </View>

              <View style={styles.performanceItem}>
                <Text
                  style={styles.performanceNumber}
                >
                  {resumenRendimiento.medio}
                </Text>

                <Text
                  style={styles.performanceLabel}
                >
                  Medio
                </Text>
              </View>

              <View style={styles.performanceItem}>
                <Text
                  style={styles.performanceNumber}
                >
                  {resumenRendimiento.bajo}
                </Text>

                <Text
                  style={styles.performanceLabel}
                >
                  Por mejorar
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Resultados
            </Text>

            <Text style={styles.sectionCount}>
              {notasFiltradas.length}
            </Text>
          </View>

          <FlatList
            data={calificacionesFiltradas}
            keyExtractor={(item) =>
              String(item.id)
            }
            renderItem={renderCalificacion}
            contentContainerStyle={
              calificacionesFiltradas.length
                ? styles.lista
                : styles.listaVacia
            }
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={actualizando}
                onRefresh={() =>
                  cargarCalificaciones(false)
                }
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {error
                    ? 'No hay información disponible'
                    : 'Aún no tienes calificaciones'}
                </Text>

                <Text style={styles.emptyText}>
                  {error
                    ? 'Conéctate a internet para descargar tus calificaciones.'
                    : 'Cuando tus docentes registren notas, aparecerán aquí.'}
                </Text>
              </View>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 25,
    backgroundColor: '#091D3A',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  backText: {
    fontSize: 32,
    lineHeight: 34,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  headerBadgeText: {
    color: '#AFC4D8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 6,
  },

  headerTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#C0D5E9',
  },

  offlineBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF4D6',
  },
  offlineTitle: {
    fontWeight: '700',
    fontSize: 13,
    color: '#805A19',
  },
  offlineText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#805A19',
  },
  onlineBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#E8F2FA',
  },
  onlineTitle: {
    fontWeight: '700',
    fontSize: 13,
    color: '#1F4E79',
  },
  onlineDate: {
    marginTop: 5,
    fontSize: 12,
    color: '#607D8B',
  },
  noticeBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 13,
    backgroundColor: '#FFF7E8',
    borderRadius: 12,
  },
  noticeText: {
    color: '#805A19',
    fontSize: 13,
    lineHeight: 19,
  },
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#FFF2F0',
    borderRadius: 12,
  },
  errorText: {
    color: '#B42318',
    fontSize: 13,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#1F4E79',
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 22,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  summaryLabel: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '700',
    marginTop: 10,
  },

  summaryValue: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '900',
    color: '#123B73',
  },

  summarySmall: {
    marginTop: 2,
    fontSize: 11,
    color: '#718096',
  },
  periodosWrapper: {
    marginTop: 10,
    marginBottom: 20,
  },
  periodosContent: {
    paddingHorizontal: 20,
    paddingRight: 30,
    alignItems: 'center',
  },
  periodoChip: {
    height: 46,
    minWidth: 105,
    paddingHorizontal: 18,
    marginRight: 10,
    borderRadius: 23,
    backgroundColor: '#E8EEF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodoChipActivo: {
    backgroundColor: '#1D4E7A',
  },
  periodoChipTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: '#284866',
  },
  periodoChipTextoActivo: {
    color: '#FFFFFF',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterTitle: {
    marginHorizontal: 20,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#E9EEF5',
  },
  filterChipActive: {
    backgroundColor: '#2D405D',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D405D',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  performanceCard: {
    marginHorizontal: 20,
    marginBottom: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#091D3A',
    marginBottom: 16,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2D405D',
  },
  performanceLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#607D8B',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
  },
  sectionCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E8EEF6',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  lista: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  listaVacia: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  materiaIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#EAF0F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  materiaIconText: {
    fontSize: 19,
    fontWeight: '800',
  },
  cardInfo: {
    flex: 1,
    paddingRight: 10,
  },
  materia: {
    fontSize: 12,
    fontWeight: '700',
    color: '#718096',
    textTransform: 'uppercase',
  },
  titulo: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: '800',
    color: '#091D3A',
    lineHeight: 21,
  },
  notaBox: {
    minWidth: 72,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
  },
  nota: {
    fontSize: 22,
    fontWeight: '900',
  },
  notaMax: {
    marginTop: -2,
    fontSize: 10,
    color: '#607D8B',
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF0F4',
    marginVertical: 14,
  },
  detalles: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EEF2F7',
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  grupoTexto: {
    fontSize: 12,
    color: '#607D8B',
  },
  fecha: {
    marginLeft: 'auto',
    fontSize: 11,
    color: '#607D8B',
  },
  feedbackBox: {
    marginTop: 14,
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#F7F9FC',
  },
  feedbackLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#607D8B',
    textTransform: 'uppercase',
  },
  feedbackText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cargandoTexto: {
    marginTop: 12,
    fontSize: 14,
    color: '#607D8B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    color: '#607D8B',
  },
});
