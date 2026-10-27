import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  listarRecomendacionesEstudiante,
} from '../services/academicRecommendationService';

import {
  listarPlanesEstudiante,
} from '../services/academicPlanService';

import AcademicRecommendationContent
  from './AcademicRecommendationContent';

// ================================================
// HU-11 | CONSULTA ACADÉMICA DEL ESTUDIANTE
// Acceso exclusivamente de lectura
// ================================================

const ESTADOS = {
  propuesto: 'Propuesto',
  en_seguimiento: 'En seguimiento',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const ORIGENES = {
  ia: 'Generada mediante IA',
  plantilla: 'Recomendación predefinida',
};

const PRIORIDADES = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

function fechaLegible(valor) {
  if (!valor) return 'No definida';

  const partes = String(valor)
    .slice(0, 10)
    .split('-');

  if (partes.length !== 3) {
    return 'Fecha no disponible';
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function descripcionElemento(item) {
  if (typeof item === 'string') return item;

  if (!item || typeof item !== 'object') {
    return String(item ?? '');
  }

  return (
    item.descripcion ||
    item.indicador ||
    item.titulo ||
    item.nombre ||
    'Acción académica registrada'
  );
}

function ListaAcademica({
  elementos,
  indicadores = false,
}) {
  if (
    !Array.isArray(elementos) ||
    elementos.length === 0
  ) {
    return (
      <Text style={styles.secundario}>
        Sin información registrada.
      </Text>
    );
  }

  return elementos.map((elemento, indice) => {
    const objeto =
      elemento &&
      typeof elemento === 'object' &&
      !Array.isArray(elemento)
        ? elemento
        : null;

    const unidad =
      objeto?.unidad === 'porcentaje'
        ? '%'
        : objeto?.unidad || '';

    return (
      <View
        key={`${indice}`}
        style={styles.elemento}
      >
        <Text style={styles.punto}>
          {indicadores ? '◎' : '•'}
        </Text>

        <View style={styles.elementoContenido}>
          <Text style={styles.elementoTitulo}>
            {descripcionElemento(elemento)}
          </Text>

          {objeto?.frecuencia ? (
            <Text style={styles.detalle}>
              Frecuencia: {objeto.frecuencia}
            </Text>
          ) : null}

          {objeto?.meta !== undefined &&
          objeto?.meta !== null ? (
            <Text style={styles.detalle}>
              Meta: {objeto.meta} {unidad}
            </Text>
          ) : null}
        </View>
      </View>
    );
  });
}

function TarjetaPlan({ plan }) {
  const [expandido, setExpandido] =
    useState(false);

  return (
    <View style={styles.plan}>
      <TouchableOpacity
        onPress={() => setExpandido(!expandido)}
        accessibilityRole="button"
        accessibilityLabel={
          `Consultar detalles del plan ${plan.id}`
        }
      >
        <View style={styles.filaTitulo}>
          <Text style={styles.planTitulo}>
            Plan #{plan.id}
          </Text>

          <View style={[
            styles.etiquetaEstado,
            plan.estado === 'completado' &&
              styles.estadoCompletado,
          ]}>
            <Text style={styles.estadoTexto}>
              {ESTADOS[plan.estado] ||
                plan.estado ||
                'Sin estado'}
            </Text>
          </View>
        </View>

        <Text style={styles.objetivo}>
          {plan.objetivo || 'Sin objetivo registrado'}
        </Text>

        <Text style={styles.detalle}>
          Prioridad:{' '}
          {PRIORIDADES[plan.prioridad] ||
            plan.prioridad ||
            'No definida'}
        </Text>

        <Text style={styles.detalle}>
          Próximo seguimiento:{' '}
          {fechaLegible(plan.fecha_seguimiento)}
        </Text>

        <Text style={styles.enlace}>
          {expandido
            ? 'Ocultar detalles ▲'
            : 'Consultar mi plan ▼'}
        </Text>
      </TouchableOpacity>

      {expandido && (
        <View style={styles.detalles}>
          <Text style={styles.seccion}>
            Mis acciones de refuerzo
          </Text>

          <ListaAcademica
            elementos={plan.acciones}
          />

          <Text style={styles.seccion}>
            Indicadores de progreso
          </Text>

          <ListaAcademica
            elementos={plan.indicadores_progreso}
            indicadores
          />

          <Text style={styles.seccion}>
            Observaciones de acompañamiento
          </Text>

          <Text style={styles.texto}>
            {plan.observaciones_orientador ||
              'No hay observaciones disponibles.'}
          </Text>

          <Text style={styles.detalle}>
            Fecha de creación:{' '}
            {fechaLegible(plan.created_at)}
          </Text>
        </View>
      )}
    </View>
  );
}

function TarjetaRecomendacion({ recomendacion }) {
  const [expandido, setExpandido] =
    useState(false);

  return (
    <View style={styles.plan}>
      <TouchableOpacity
        onPress={() => setExpandido(!expandido)}
        accessibilityRole="button"
        accessibilityLabel={
          `Consultar recomendación ${recomendacion.id}`
        }
      >
        <View style={styles.filaTitulo}>
          <Text style={styles.planTitulo}>
            Recomendación #{recomendacion.id}
          </Text>
        </View>

        <Text style={styles.detalle}>
          {ORIGENES[recomendacion.origen] ||
            'Origen no identificado'}
        </Text>

        <Text style={styles.detalle}>
          Generada:{' '}
          {fechaLegible(recomendacion.created_at)}
        </Text>

        <Text style={styles.enlace}>
          {expandido
            ? 'Ocultar recomendación ▲'
            : 'Ver recomendaciones ▼'}
        </Text>
      </TouchableOpacity>

      {expandido && (
        <View style={styles.detalles}>
          <AcademicRecommendationContent
            contenido={recomendacion.contenido}
            indicadores={recomendacion.indicadores}
            origen={recomendacion.origen}
          />
        </View>
      )}
    </View>
  );
}

export default function StudentAcademicRecommendations({
  estudianteId,
  apiUrl,
  accessToken,
}) {
  const [recomendaciones, setRecomendaciones] =
    useState([]);

  const [planes, setPlanes] =
    useState([]);

  const [cargando, setCargando] =
    useState(false);

  const [errorRecomendaciones, setErrorRecomendaciones] =
    useState('');

  const [errorPlanes, setErrorPlanes] =
    useState('');

  const [visible, setVisible] =
    useState(false);

  const cargarInformacion = useCallback(async () => {
    if (!estudianteId || !accessToken) {
      setErrorRecomendaciones(
        'No se encontró una sesión válida.'
      );
      setErrorPlanes(
        'No se encontró una sesión válida.'
      );
      return;
    }

    setCargando(true);
    setErrorRecomendaciones('');
    setErrorPlanes('');

    console.log(
      '[HU-11] ID utilizado por Estudiante:',
      estudianteId
    );

    const resultados = await Promise.allSettled([
      listarRecomendacionesEstudiante({
        apiUrl,
        accessToken,
        estudianteId,
      }),
      listarPlanesEstudiante({
        apiUrl,
        accessToken,
        estudianteId,
      }),
    ]);

    console.log('[HU-11] Diagnóstico de consultas:', {
      recomendaciones:
        resultados[0].status === 'fulfilled'
          ? {
              estado: 'OK',
              cantidad:
                resultados[0].value?.recomendaciones?.length,
            }
          : {
              estado: 'ERROR',
              mensaje: resultados[0].reason?.message,
            },

      planes:
        resultados[1].status === 'fulfilled'
          ? {
              estado: 'OK',
              cantidad: Array.isArray(resultados[1].value)
                ? resultados[1].value.length
                : 'FORMATO_INESPERADO',
            }
          : {
              estado: 'ERROR',
              mensaje: resultados[1].reason?.message,
            },
    });

    if (resultados[0].status === 'fulfilled') {
      const datos = resultados[0].value;

      setRecomendaciones(
        Array.isArray(datos?.recomendaciones)
          ? datos.recomendaciones
          : []
      );
    } else {
      setRecomendaciones([]);
      setErrorRecomendaciones(
        resultados[0].reason?.message ||
          'No fue posible consultar las recomendaciones.'
      );
    }

    if (resultados[1].status === 'fulfilled') {
      const datos = resultados[1].value;

      setPlanes(
        Array.isArray(datos) ? datos : []
      );
    } else {
      setPlanes([]);
      setErrorPlanes(
        resultados[1].reason?.message ||
          'No fue posible consultar los planes.'
      );
    }

    setCargando(false);
  }, [apiUrl, accessToken, estudianteId]);

  useEffect(() => {
    let activo = true;

    Promise.resolve().then(() => {
      if (activo) {
        setVisible(false);
        setRecomendaciones([]);
        setPlanes([]);
        setErrorRecomendaciones('');
        setErrorPlanes('');
      }
    });

    return () => {
      activo = false;
    };
  }, [estudianteId, accessToken]);

  const alternar = () => {
    if (visible) {
      setVisible(false);
      return;
    }

    setVisible(true);
    cargarInformacion();
  };

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>
        Mis recomendaciones y planes
      </Text>

      <Text style={styles.descripcion}>
        Consulta las recomendaciones académicas
        y los planes de refuerzo que te ayudarán
        a organizar tus actividades y mejorar
        tu desempeño.
      </Text>

      <TouchableOpacity
        style={styles.boton}
        onPress={alternar}
        accessibilityRole="button"
      >
        <Text style={styles.botonTexto}>
          {visible
            ? 'Ocultar recomendaciones y planes'
            : 'Consultar mi acompañamiento académico'}
        </Text>
      </TouchableOpacity>

      {visible && (
        <View style={styles.contenido}>
          <TouchableOpacity
            style={styles.botonSecundario}
            onPress={cargarInformacion}
            disabled={cargando}
            accessibilityRole="button"
          >
            <Text style={styles.botonSecundarioTexto}>
              Actualizar información
            </Text>
          </TouchableOpacity>

          {cargando ? (
            <View style={styles.carga}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.secundario}>
                Consultando tu información académica...
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.subtitulo}>
                Mis recomendaciones
              </Text>

              {errorRecomendaciones ? (
                <Text style={styles.error}>
                  {errorRecomendaciones}
                </Text>
              ) : recomendaciones.length === 0 ? (
                <Text style={styles.secundario}>
                  Todavía no tienes recomendaciones
                  académicas registradas.
                </Text>
              ) : (
                recomendaciones.map((item) => (
                  <TarjetaRecomendacion
                    key={String(item.id)}
                    recomendacion={item}
                  />
                ))
              )}

              <Text style={styles.subtitulo}>
                Mis planes de refuerzo
              </Text>

              {errorPlanes ? (
                <Text style={styles.error}>
                  {errorPlanes}
                </Text>
              ) : planes.length === 0 ? (
                <Text style={styles.secundario}>
                  Todavía no tienes planes de
                  acompañamiento registrados.
                </Text>
              ) : (
                planes.map((plan) => (
                  <TarjetaPlan
                    key={String(plan.id)}
                    plan={plan}
                  />
                ))
              )}

              <Text style={styles.aviso}>
                Las recomendaciones son orientativas.
                Los planes y su seguimiento formal
                son gestionados por el personal
                institucional autorizado.
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E6ED',
    padding: 18,
    marginBottom: 16,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 9,
  },
  descripcion: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 15,
  },
  boton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  botonSecundario: {
    backgroundColor: '#EFF6FF',
    borderRadius: 9,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  botonSecundarioTexto: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  contenido: {
    marginTop: 15,
  },
  subtitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 12,
  },
  plan: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  filaTitulo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  planTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  objetivo: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 21,
    color: '#334155',
    marginBottom: 10,
  },
  etiquetaEstado: {
    backgroundColor: '#DBEAFE',
    padding: 7,
    borderRadius: 8,
  },
  estadoCompletado: {
    backgroundColor: '#DCFCE7',
  },
  estadoTexto: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  detalle: {
    fontSize: 12,
    lineHeight: 19,
    color: '#64748B',
    marginTop: 5,
  },
  enlace: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 12,
  },
  detalles: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 14,
    paddingTop: 10,
  },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 10,
  },
  elemento: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  punto: {
    color: '#2563EB',
    fontSize: 17,
  },
  elementoContenido: {
    flex: 1,
  },
  elementoTitulo: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  texto: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
  secundario: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  carga: {
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  error: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  aviso: {
    fontSize: 12,
    lineHeight: 19,
    color: '#64748B',
    marginTop: 18,
  },
});
