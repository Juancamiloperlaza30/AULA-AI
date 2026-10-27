
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

import GuardianAlertHistory from './GuardianAlertHistory';

// =====================================================
// AULA-AI | HU-08 | PASO 43
// PANEL DE ALERTAS Y RENDIMIENTO DEL ACUDIENTE
//
// - Rendimiento basado exclusivamente en promedios.
// - Estados de alertas independientes del rendimiento.
// - Resolución académica con colores coherentes.
// - Selección de períodos académicos.
// - Consulta segura de estudiantes autorizados.
// - Filtros, paginación y actualización de alertas.
// - No modifica datos de Supabase.
// =====================================================

const C = {
  blanco: '#FFFFFF',
  fondo: '#F4F7FB',
  azul: '#1F4E79',
  azulOscuro: '#132F4A',
  azulSuave: '#EAF2FA',
  texto: '#263B4D',
  gris: '#687B8B',
  borde: '#DFE7EF',
  verde: '#18764C',
  verdeSuave: '#E8F6EE',
  rojo: '#B3261E',
  rojoSuave: '#FDECEA',
  amarillo: '#94620F',
  amarilloSuave: '#FFF4DC',
};

const FILTROS = [
  ['activa', 'Activas'],
  ['todos', 'Todas'],
  ['resuelta', 'Resueltas'],
];

const LIMITE = 20;

// =====================================================
// FUNCIONES ACADÉMICAS
// =====================================================

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
    ? 'Sin notas'
    : numero.toFixed(2);
}

function porcentajeNota(valor) {
  const nota = numeroSeguro(valor);

  if (nota === null) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, (nota / 5) * 100)
  );
}

function clasificarPromedio(valor) {
  const promedio = numeroSeguro(valor);

  if (promedio === null) {
    return {
      nombre: 'Sin calificaciones',
      color: C.gris,
      fondo: C.fondo,
      estado: 'sin_datos',
    };
  }

  if (promedio < 3) {
    return {
      nombre: 'Riesgo académico',
      color: C.rojo,
      fondo: C.rojoSuave,
      estado: 'riesgo',
    };
  }

  if (promedio < 3.5) {
    return {
      nombre: 'Requiere seguimiento',
      color: C.amarillo,
      fondo: C.amarilloSuave,
      estado: 'seguimiento',
    };
  }

  return {
    nombre: 'Rendimiento favorable',
    color: C.verde,
    fondo: C.verdeSuave,
    estado: 'favorable',
  };
}

function estadoAlerta(estado) {
  if (estado === 'resuelta') {
    return {
      nombre: 'Resuelta',
      color: C.verde,
      fondo: C.verdeSuave,
    };
  }

  if (estado === 'en_seguimiento') {
    return {
      nombre: 'En seguimiento',
      color: C.amarillo,
      fondo: C.amarilloSuave,
    };
  }

  return {
    nombre: 'Activa',
    color: C.rojo,
    fondo: C.rojoSuave,
  };
}

function gravedadAlerta(nivel) {
  if (nivel === 'critica') {
    return {
      nombre: 'Crítica',
      color: C.rojo,
      fondo: C.rojoSuave,
    };
  }

  if (nivel === 'alta') {
    return {
      nombre: 'Alta',
      color: C.rojo,
      fondo: C.rojoSuave,
    };
  }

  if (nivel === 'media') {
    return {
      nombre: 'Media',
      color: C.amarillo,
      fondo: C.amarilloSuave,
    };
  }

  return {
    nombre: 'Baja',
    color: C.azul,
    fondo: C.azulSuave,
  };
}

function fechaVisible(valor) {
  if (!valor) {
    return 'Sin fecha';
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'Sin fecha';
  }

  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// =====================================================
// COMPONENTES REUTILIZABLES
// =====================================================

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

function Barra({
  valor,
  color,
}) {
  const avance = porcentajeNota(valor);

  return (
    <View style={styles.barraFondo}>
      <View
        style={[
          styles.barraProgreso,
          {
            width: `${avance}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

function Mensaje({
  titulo,
  descripcion,
  error = false,
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

      <Text style={styles.mensajeDescripcion}>
        {descripcion}
      </Text>
    </View>
  );
}

// =====================================================
// TARJETA DE RENDIMIENTO POR MATERIA
// =====================================================

function MateriaCard({ materia }) {
  const promedio = numeroSeguro(
    materia.promedio
  );

  const rendimiento = clasificarPromedio(
    promedio
  );

  return (
    <View style={styles.materiaCard}>
      <View style={styles.fila}>
        <View style={styles.flexible}>
          <Text style={styles.materiaNombre}>
            {materia.materia ||
              'Materia sin nombre'}
          </Text>

          <Text style={styles.secundario}>
            {materia.cantidadNotas ?? 0}{' '}
            calificación(es) registradas
          </Text>
        </View>

        <Text
          style={[
            styles.materiaValor,
            { color: rendimiento.color },
          ]}
        >
          {notaTexto(promedio)}
        </Text>
      </View>

      <Barra
        valor={promedio}
        color={rendimiento.color}
      />

      <View style={styles.filaPie}>
        <Text
          style={[
            styles.porcentaje,
            { color: rendimiento.color },
          ]}
        >
          {promedio === null
            ? 'Sin porcentaje'
            : `${porcentajeNota(
                promedio
              ).toFixed(0)} % de la escala`}
        </Text>

        <Etiqueta
          texto={rendimiento.nombre}
          color={rendimiento.color}
          fondo={rendimiento.fondo}
        />
      </View>
    </View>
  );
}

// =====================================================
// TARJETA DE ALERTA ACADÉMICA
// =====================================================

function AlertaCard({
  alerta,
  nombrePeriodo,
}) {
  const estado = estadoAlerta(
    alerta.estado
  );

  const gravedad = gravedadAlerta(
    alerta.nivel
  );

  const esResuelta =
    alerta.estado === 'resuelta';

  const promedio = numeroSeguro(
    alerta.detalles?.promedio
  );

  const tieneRendimiento =
    alerta.tipo === 'bajo_rendimiento' &&
    promedio !== null;

  // El rendimiento NO depende del nivel
  // ni del estado histórico de la alerta.
  const rendimiento = clasificarPromedio(
    promedio
  );

  return (
    <View
      style={[
        styles.alertaCard,
        {
          borderLeftColor:
            esResuelta
              ? C.verde
              : estado.color,
        },
      ]}
    >
      <View style={styles.fila}>
        <Text style={styles.alertaTitulo}>
          {alerta.titulo ||
            'Alerta académica'}
        </Text>

        {esResuelta ? (
          <Etiqueta
            texto="Recuperación"
            color={C.verde}
            fondo={C.verdeSuave}
          />
        ) : (
          <Etiqueta
            texto={gravedad.nombre}
            color={gravedad.color}
            fondo={gravedad.fondo}
          />
        )}
      </View>

      <Text style={styles.alertaDescripcion}>
        {alerta.descripcion ||
          'Sin descripción disponible.'}
      </Text>

      {!!alerta.detalles?.materia && (
        <Text style={styles.materiaAlerta}>
          Materia:{' '}
          {alerta.detalles.materia}
        </Text>
      )}

      {!!nombrePeriodo && (
        <Text style={styles.periodoAlerta}>
          {nombrePeriodo}
        </Text>
      )}

      {tieneRendimiento && (
        <View style={styles.rendimientoCaja}>
          <View style={styles.fila}>
            <Text style={styles.promedioEtiqueta}>
              Promedio registrado
            </Text>

            <Text
              style={[
                styles.promedioValor,
                {
                  color: rendimiento.color,
                },
              ]}
            >
              {notaTexto(promedio)} / 5.00
            </Text>
          </View>

          <View style={styles.barraEncabezado}>
            <Text style={styles.barraTitulo}>
              Nivel de rendimiento
            </Text>

            <Text
              style={[
                styles.barraEstado,
                {
                  color: rendimiento.color,
                },
              ]}
            >
              {rendimiento.nombre}
            </Text>
          </View>

          <Barra
            valor={promedio}
            color={rendimiento.color}
          />

          <View style={styles.filaPie}>
            <Text
              style={[
                styles.porcentaje,
                {
                  color: rendimiento.color,
                },
              ]}
            >
              {porcentajeNota(
                promedio
              ).toFixed(0)} %
            </Text>

            <Text style={styles.secundario}>
              Escala 0.0 - 5.0
            </Text>
          </View>
        </View>
      )}

      {esResuelta && (
        <View style={styles.recuperacionCaja}>
          <Text style={styles.recuperacionTexto}>
            Situación académica resuelta.
            El estudiante ya no presenta
            la condición de riesgo que
            originó esta alerta.
          </Text>
        </View>
      )}

      <View style={styles.pieAlerta}>
        <Etiqueta
          texto={estado.nombre}
          color={estado.color}
          fondo={estado.fondo}
        />

        <Text style={styles.secundario}>
          {fechaVisible(
            esResuelta
              ? alerta.resuelta_at ||
                  alerta.updated_at
              : alerta.created_at
          )}
        </Text>
      </View>
    </View>
  );
}

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

export default function GuardianAcademicAlerts({
  apiUrl,
  accessToken,
  estudiante,
  notas = null,
  mostrarRendimiento = true,
}) {
  const estudianteId = estudiante?.id;

  const [periodoId, setPeriodoId] =
    useState(null);

  const [alertas, setAlertas] =
    useState([]);

  const [filtro, setFiltro] =
    useState('activa');

  const [pagina, setPagina] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [
    tieneSiguiente,
    setTieneSiguiente,
  ] = useState(false);

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

  // ===================================================
  // PERÍODOS ACADÉMICOS
  // ===================================================

  const periodos = useMemo(() => {
    return Array.isArray(
      notas?.promediosPeriodos
    )
      ? notas.promediosPeriodos
      : [];
  }, [notas]);

  const periodoInicial = useMemo(() => {
    if (!periodos.length) {
      return null;
    }

    const actualId =
      notas?.periodoActual?.id;

    const actual = periodos.find(
      (p) =>
        String(p.periodoId) ===
        String(actualId)
    );

    const tieneNotas = (p) => {
      return (
        Array.isArray(p.materias) &&
        p.materias.some(
          (materia) =>
            numeroSeguro(
              materia.promedio
            ) !== null
        )
      );
    };

    if (
      actual &&
      tieneNotas(actual)
    ) {
      return String(
        actual.periodoId
      );
    }

    const conNotas = periodos.filter(
      tieneNotas
    );

    if (conNotas.length) {
      return String(
        conNotas[
          conNotas.length - 1
        ].periodoId
      );
    }

    if (actual) {
      return String(
        actual.periodoId
      );
    }

    return String(
      periodos[0].periodoId
    );
  }, [notas, periodos]);

  const periodoSeleccionado =
    useMemo(() => {
      const valido = periodos.some(
        (p) =>
          String(p.periodoId) ===
          String(periodoId)
      );

      return valido
        ? String(periodoId)
        : periodoInicial;
    }, [
      periodos,
      periodoId,
      periodoInicial,
    ]);

  const periodo = useMemo(() => {
    return (
      periodos.find(
        (p) =>
          String(p.periodoId) ===
          periodoSeleccionado
      ) || null
    );
  }, [
    periodos,
    periodoSeleccionado,
  ]);

  const materias = useMemo(() => {
    return Array.isArray(
      periodo?.materias
    )
      ? periodo.materias
      : [];
  }, [periodo]);

  const resumen = useMemo(() => {
    const evaluadas = materias.filter(
      (m) =>
        numeroSeguro(
          m.promedio
        ) !== null
    );

    return {
      riesgo: evaluadas.filter(
        (m) =>
          Number(m.promedio) < 3
      ).length,

      seguimiento: evaluadas.filter(
        (m) => {
          const n = Number(
            m.promedio
          );

          return n >= 3 && n < 3.5;
        }
      ).length,

      favorables: evaluadas.filter(
        (m) =>
          Number(m.promedio) >= 3.5
      ).length,
    };
  }, [materias]);

  const nombresPeriodos = useMemo(() => {
    const mapa = new Map();

    periodos.forEach((p) => {
      mapa.set(
        String(p.periodoId),
        p.nombre
      );
    });

    return mapa;
  }, [periodos]);

  // ===================================================
  // CONSULTAS SEGURAS DE ALERTAS
  // ===================================================

  const cancelarConsulta = useCallback(
    () => {
      versionRef.current += 1;

      abortRef.current?.abort();
      abortRef.current = null;
    },
    []
  );

  const consultarAlertas = useCallback(
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
        setAlertas([]);
        setPagina(1);
        setTotal(0);
        setTieneSiguiente(false);
      }

      setError('');

      try {
        if (
          !estudianteId ||
          !base ||
          !accessToken
        ) {
          throw new Error(
            'No hay datos suficientes para consultar las alertas.'
          );
        }

        const url =
          `${base}/api/guardian/estudiantes/` +
          `${encodeURIComponent(
            estudianteId
          )}/alertas`;

        const parametros = [
          `pagina=${nuevaPagina}`,
          `limite=${LIMITE}`,
        ];

        if (filtro !== 'todos') {
          parametros.push(
            `estado=${encodeURIComponent(
              filtro
            )}`
          );
        }

        const respuesta = await fetch(
          `${url}?${parametros.join('&')}`,
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
              ? 'No tienes autorización para consultar estas alertas.'
              : datos?.message ||
                'No fue posible consultar las alertas.'
          );
        }

        if (
          datos.estudiante?.id !==
            estudianteId ||
          !Array.isArray(
            datos.alertas
          )
        ) {
          throw new Error(
            'La información recibida no corresponde al estudiante seleccionado.'
          );
        }

        if (
          controller.signal.aborted ||
          version !==
            versionRef.current
        ) {
          return;
        }

        setAlertas((anteriores) => {
          if (!agregar) {
            return datos.alertas;
          }

          const existentes = new Set(
            anteriores.map(
              (a) => String(a.id)
            )
          );

          return [
            ...anteriores,
            ...datos.alertas.filter(
              (a) =>
                !existentes.has(
                  String(a.id)
                )
            ),
          ];
        });

        setPagina(nuevaPagina);

        setTotal(
          Number(
            datos.paginacion?.total
          ) || 0
        );

        setTieneSiguiente(
          datos.paginacion
            ?.tieneSiguiente === true
        );
      } catch (err) {
        if (
          controller.signal.aborted ||
          version !==
            versionRef.current ||
          err?.name === 'AbortError'
        ) {
          return;
        }

        setError(
          err?.message ||
            'Ocurrió un error al consultar las alertas.'
        );
      } finally {
        if (
          !controller.signal.aborted &&
          version ===
            versionRef.current
        ) {
          setCargando(false);
          setCargandoMas(false);
        }
      }
    },
    [
      estudianteId,
      base,
      accessToken,
      filtro,
      cancelarConsulta,
    ]
  );

  useEffect(() => {
    consultarAlertas();

    return () => {
      cancelarConsulta();
    };
  }, [
    consultarAlertas,
    cancelarConsulta,
  ]);

  // ===================================================
  // INTERFAZ
  // ===================================================

  if (!estudianteId) {
    return (
      <Mensaje
        titulo="Selecciona un estudiante"
        descripcion="Elige uno de tus estudiantes vinculados para consultar sus alertas."
      />
    );
  }

  return (
    <View style={styles.contenedor}>
      {mostrarRendimiento && notas && (
        <>
          <Text style={styles.titulo}>
            Rendimiento académico
          </Text>

          <Text style={styles.descripcion}>
            Consulta los promedios de
            cada materia y su
            clasificación académica.
          </Text>

          <Text style={styles.subtitulo}>
            Período académico
          </Text>

          <View style={styles.periodos}>
            {periodos.map((p) => {
              const activo =
                String(p.periodoId) ===
                periodoSeleccionado;

              return (
                <TouchableOpacity
                  key={String(p.periodoId)}
                  style={[
                    styles.periodoBoton,
                    activo &&
                      styles.periodoActivo,
                  ]}
                  onPress={() =>
                    setPeriodoId(
                      String(p.periodoId)
                    )
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: activo,
                  }}
                >
                  <Text
                    style={[
                      styles.periodoTexto,
                      activo &&
                        styles.periodoTextoActivo,
                    ]}
                  >
                    {p.nombre ||
                      `Período ${p.periodoId}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.resumenCard}>
            <Text style={styles.resumenEtiqueta}>
              Promedio del período
              seleccionado
            </Text>

            <Text style={styles.resumenPromedio}>
              {notaTexto(
                periodo?.promedio
              )}
            </Text>

            <Text style={styles.resumenPeriodo}>
              {periodo?.nombre ||
                'Sin período seleccionado'}
            </Text>
          </View>

          <View style={styles.indicadores}>
            {[
              [
                'En riesgo',
                resumen.riesgo,
                C.rojo,
              ],
              [
                'Seguimiento',
                resumen.seguimiento,
                C.amarillo,
              ],
              [
                'Favorables',
                resumen.favorables,
                C.verde,
              ],
            ].map(
              ([nombre, valor, color]) => (
                <View
                  key={nombre}
                  style={styles.indicador}
                >
                  <Text
                    style={[
                      styles.indicadorNumero,
                      { color },
                    ]}
                  >
                    {valor}
                  </Text>

                  <Text
                    style={styles.indicadorTexto}
                  >
                    {nombre}
                  </Text>
                </View>
              )
            )}
          </View>

          <Text style={styles.subtitulo}>
            Promedios por materia
          </Text>

          {materias.length === 0 ? (
            <Mensaje
              titulo="Sin promedios"
              descripcion="No hay promedios por materia registrados en este período."
            />
          ) : (
            materias.map(
              (materia, index) => (
                <MateriaCard
                  key={
                    `${materia.materiaId ?? 'materia'}-${index}`
                  }
                  materia={materia}
                />
              )
            )
          )}

          <Text style={styles.aviso}>
            El porcentaje de cada barra
            representa la nota obtenida
            respecto a la escala máxima de
            5.0. No es una probabilidad
            de perder el año.
          </Text>
        </>
      )}

      <View style={styles.alertasEncabezado}>
        <Text style={styles.titulo}>
          Alertas académicas
        </Text>

        <Text style={styles.descripcion}>
          Situaciones académicas que
          requieren seguimiento
          y acompañamiento.
        </Text>
      </View>

      <View style={styles.filtros}>
        {FILTROS.map(
          ([id, nombre]) => {
            const activo =
              filtro === id;

            return (
              <TouchableOpacity
                key={id}
                onPress={() =>
                  setFiltro(id)
                }
                style={[
                  styles.filtro,
                  activo &&
                    styles.filtroActivo,
                ]}
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
                  {nombre}
                </Text>
              </TouchableOpacity>
            );
          }
        )}
      </View>

      {cargando ? (
        <View style={styles.cargando}>
          <ActivityIndicator
            size="large"
            color={C.azul}
          />

          <Text style={styles.descripcion}>
            Consultando alertas...
          </Text>
        </View>
      ) : error &&
        alertas.length === 0 ? (
        <Mensaje
          titulo="No fue posible cargar las alertas"
          descripcion={error}
          error
        />
      ) : (
        <>
          <Text style={styles.totalAlertas}>
            {total}{' '}
            {total === 1
              ? 'alerta encontrada'
              : 'alertas encontradas'}
          </Text>

          {alertas.length === 0 ? (
            <Mensaje
              titulo="Sin alertas"
              descripcion="No existen alertas para el filtro seleccionado."
            />
          ) : (
            alertas.map((alerta) => (
              <AlertaCard
                key={String(alerta.id)}
                alerta={alerta}
                nombrePeriodo={
                  nombresPeriodos.get(
                    String(
                      alerta.periodo_id
                    )
                  ) ||
                  (alerta.periodo_id
                    ? `Período ${alerta.periodo_id}`
                    : null)
                }
              />
            ))
          )}

          {tieneSiguiente && (
            <TouchableOpacity
              style={styles.botonSecundario}
              disabled={cargandoMas}
              onPress={() =>
                consultarAlertas({
                  nuevaPagina:
                    pagina + 1,
                  agregar: true,
                })
              }
            >
              {cargandoMas ? (
                <ActivityIndicator
                  color={C.azul}
                />
              ) : (
                <Text
                  style={styles.botonSecundarioTexto}
                >
                  Ver más alertas
                </Text>
              )}
            </TouchableOpacity>
          )}

          {!!error &&
            alertas.length > 0 && (
              <Text style={styles.errorTexto}>
                {error}
              </Text>
            )}
        </>
      )}

      <TouchableOpacity
        style={styles.botonActualizar}
        disabled={
          cargando ||
          cargandoMas
        }
        onPress={() =>
          consultarAlertas({
            nuevaPagina: 1,
          })
        }
      >
        <Text
          style={styles.botonActualizarTexto}
        >
          Actualizar alertas
        </Text>
      </TouchableOpacity>

      <Text style={styles.aviso}>
        Las alertas muestran la
        información académica
        registrada en AULA-AI.
        Ante cualquier situación,
        comunícate con la institución.
      </Text>

      {/* ============================================
          HU-08 | HISTORIAL DE ALERTAS ACADÉMICAS
          ============================================ */}

      <GuardianAlertHistory
        apiUrl={apiUrl}
        accessToken={accessToken}
        estudiante={estudiante}
      />
    </View>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  contenedor: {
    width: '100%',
  },

  flexible: {
    flex: 1,
  },

  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  filaPie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },

  titulo: {
    fontSize: 21,
    fontWeight: '800',
    color: C.azulOscuro,
  },

  descripcion: {
    fontSize: 13,
    color: C.gris,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 16,
  },

  subtitulo: {
    fontSize: 16,
    fontWeight: '800',
    color: C.azulOscuro,
    marginTop: 13,
    marginBottom: 12,
  },

  secundario: {
    fontSize: 11,
    color: C.gris,
    marginTop: 5,
  },

  periodos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 17,
  },

  periodoBoton: {
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.blanco,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  periodoActivo: {
    backgroundColor: C.azul,
    borderColor: C.azul,
  },

  periodoTexto: {
    fontSize: 12,
    color: C.azul,
    fontWeight: '700',
  },

  periodoTextoActivo: {
    color: C.blanco,
  },

  resumenCard: {
    backgroundColor: C.azulOscuro,
    padding: 21,
    borderRadius: 18,
    marginBottom: 16,
  },

  resumenEtiqueta: {
    color: '#C7DDF1',
    fontSize: 13,
  },

  resumenPromedio: {
    color: C.blanco,
    fontSize: 39,
    fontWeight: '800',
    marginTop: 7,
  },

  resumenPeriodo: {
    color: '#C7DDF1',
    fontSize: 13,
    marginTop: 8,
  },

  indicadores: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },

  indicador: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: C.blanco,
    borderColor: C.borde,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 16,
    paddingHorizontal: 5,
  },

  indicadorNumero: {
    fontSize: 24,
    fontWeight: '800',
  },

  indicadorTexto: {
    fontSize: 10,
    color: C.gris,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '700',
  },

  materiaCard: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
  },

  materiaNombre: {
    fontSize: 14,
    fontWeight: '800',
    color: C.texto,
  },

  materiaValor: {
    fontSize: 23,
    fontWeight: '800',
  },

  barraFondo: {
    width: '100%',
    height: 12,
    backgroundColor: '#E8EDF3',
    borderRadius: 100,
    overflow: 'hidden',
    marginTop: 13,
  },

  barraProgreso: {
    height: '100%',
    borderRadius: 100,
  },

  porcentaje: {
    fontSize: 12,
    fontWeight: '800',
  },

  etiqueta: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  etiquetaTexto: {
    fontSize: 10,
    fontWeight: '800',
  },

  mensaje: {
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.blanco,
    borderRadius: 14,
    padding: 21,
    alignItems: 'center',
    marginVertical: 8,
  },

  mensajeTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: C.azulOscuro,
    textAlign: 'center',
  },

  mensajeDescripcion: {
    fontSize: 12,
    lineHeight: 20,
    color: C.gris,
    textAlign: 'center',
    marginTop: 8,
  },

  aviso: {
    fontSize: 11,
    color: C.gris,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 13,
    marginBottom: 10,
  },

  alertasEncabezado: {
    marginTop: 26,
  },

  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },

  filtro: {
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.blanco,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },

  filtroActivo: {
    backgroundColor: C.azul,
    borderColor: C.azul,
  },

  filtroTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: C.azul,
  },

  filtroTextoActivo: {
    color: C.blanco,
  },

  totalAlertas: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gris,
    marginBottom: 12,
  },

  alertaCard: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderLeftWidth: 4,
    borderRadius: 15,
    padding: 16,
    marginBottom: 13,
  },

  alertaTitulo: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: C.azulOscuro,
    lineHeight: 22,
  },

  alertaDescripcion: {
    fontSize: 13,
    lineHeight: 21,
    color: C.texto,
    marginTop: 13,
  },

  materiaAlerta: {
    fontSize: 12,
    fontWeight: '800',
    color: C.azul,
    marginTop: 12,
  },

  periodoAlerta: {
    fontSize: 11,
    color: C.gris,
    marginTop: 6,
  },

  rendimientoCaja: {
    marginTop: 15,
    padding: 13,
    borderRadius: 12,
    backgroundColor: C.fondo,
  },

  promedioEtiqueta: {
    flex: 1,
    fontSize: 12,
    color: C.gris,
  },

  promedioValor: {
    fontSize: 17,
    fontWeight: '800',
  },

  barraEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },

  barraTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: C.azulOscuro,
  },

  barraEstado: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },

  pieAlerta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 15,
  },

  recuperacionCaja: {
    marginTop: 13,
    backgroundColor: C.verdeSuave,
    borderRadius: 12,
    padding: 13,
  },

  recuperacionTexto: {
    color: C.verde,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '600',
  },

  cargando: {
    alignItems: 'center',
    paddingVertical: 30,
  },

  botonSecundario: {
    borderWidth: 1,
    borderColor: C.azul,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 7,
  },

  botonSecundarioTexto: {
    color: C.azul,
    fontSize: 13,
    fontWeight: '800',
  },

  botonActualizar: {
    backgroundColor: C.azul,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
  },

  botonActualizarTexto: {
    color: C.blanco,
    fontSize: 13,
    fontWeight: '800',
  },

  errorTexto: {
    color: C.rojo,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
});
