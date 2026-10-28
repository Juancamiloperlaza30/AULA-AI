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

import { Ionicons } from '@expo/vector-icons';

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
          <View style={styles.planHeading}>
            <View style={styles.planIcon}>
              <Ionicons
                name="flag-outline"
                size={18}
                color="#123B73"
              />
            </View>

            <Text style={styles.planTitulo}>
              Plan de acompañamiento #{plan.id}
            </Text>
          </View>

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

        <View style={styles.enlace}>
          <Text style={styles.enlaceTexto}>
            {expandido
              ? 'Ocultar detalles'
              : 'Consultar mi plan'}
          </Text>
          <Ionicons
            name={expandido ? 'chevron-up' : 'chevron-down'}
            size={15}
            color="#27C4E8"
          />
        </View>
      </TouchableOpacity>

      {expandido && (
        <View style={styles.detalles}>
          <View style={styles.seccionHeading}>
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color="#123B73"
            />
            <Text style={styles.seccion}>
              Mis acciones de refuerzo
            </Text>
          </View>

          <ListaAcademica
            elementos={plan.acciones}
          />

          <View style={styles.seccionHeading}>
            <Ionicons
              name="analytics-outline"
              size={16}
              color="#123B73"
            />
            <Text style={styles.seccion}>
              Indicadores de progreso
            </Text>
          </View>

          <ListaAcademica
            elementos={plan.indicadores_progreso}
            indicadores
          />

          <View style={styles.seccionHeading}>
            <Ionicons
              name="chatbox-ellipses-outline"
              size={16}
              color="#123B73"
            />
            <Text style={styles.seccion}>
              Observaciones de acompañamiento
            </Text>
          </View>

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
          <View style={styles.planHeading}>
            <View style={[styles.planIcon, styles.recommendationIcon]}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color="#7353B6"
              />
            </View>

            <Text style={styles.planTitulo}>
              Recomendación académica #{recomendacion.id}
            </Text>
          </View>
        </View>

        <Text style={styles.detalle}>
          {ORIGENES[recomendacion.origen] ||
            'Origen no identificado'}
        </Text>

        <Text style={styles.detalle}>
          Generada:{' '}
          {fechaLegible(recomendacion.created_at)}
        </Text>

        <View style={styles.enlace}>
          <Text style={styles.enlaceTexto}>
            {expandido
              ? 'Ocultar recomendación'
              : 'Ver recomendación'}
          </Text>
          <Ionicons
            name={expandido ? 'chevron-up' : 'chevron-down'}
            size={15}
            color="#27C4E8"
          />
        </View>
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
      <View style={styles.tituloPrincipal}>
        <View style={styles.tituloIcono}>
          <Ionicons
            name="sparkles-outline"
            size={22}
            color="#27C4E8"
          />
        </View>

        <View style={styles.tituloContenido}>
          <Text style={styles.titulo}>
            Recomendaciones y planes
          </Text>

          <Text style={styles.kicker}>
            ACOMPAÑAMIENTO ACADÉMICO
          </Text>
        </View>
      </View>

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
        <Ionicons
          name={visible ? 'chevron-up' : 'arrow-forward'}
          size={18}
          color="#FFFFFF"
        />

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
            <Ionicons
              name="refresh-outline"
              size={17}
              color="#123B73"
            />

            <Text style={styles.botonSecundarioTexto}>
              Actualizar información
            </Text>
          </TouchableOpacity>

          {cargando ? (
            <View style={styles.carga}>
              <ActivityIndicator color="#123B73" />
              <Text style={styles.secundario}>
                Consultando tu información académica...
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.subtitulo}>
                <Ionicons
                  name="bulb-outline"
                  size={17}
                  color="#7353B6"
                />
                <Text style={styles.subtituloTexto}>
                  Mis recomendaciones
                </Text>
              </View>

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

              <View style={styles.subtitulo}>
                <Ionicons
                  name="flag-outline"
                  size={17}
                  color="#123B73"
                />
                <Text style={styles.subtituloTexto}>
                  Mis planes de refuerzo
                </Text>
              </View>

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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    padding: 19,
    marginBottom: 18,
    shadowColor: '#091D3A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.045,
    shadowRadius: 9,
    elevation: 2,
  },

  tituloPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },

  tituloIcono: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  tituloContenido: {
    flex: 1,
  },

  titulo: {
    fontSize: 17,
    fontWeight: '900',
    color: '#091D3A',
    marginBottom: 4,
  },

  kicker: {
    color: '#718096',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  descripcion: {
    fontSize: 13,
    lineHeight: 20,
    color: '#52647A',
    marginBottom: 17,
  },

  boton: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#123B73',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#27C4E8',
  },

  botonTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  botonSecundario: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EAF3FC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },

  botonSecundarioTexto: {
    color: '#123B73',
    fontSize: 13,
    fontWeight: '800',
  },

  contenido: {
    marginTop: 15,
  },

  subtitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 17,
    marginBottom: 12,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EFF5',
  },

  subtituloTexto: {
    fontSize: 16,
    fontWeight: '900',
    color: '#091D3A',
  },

  plan: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    padding: 15,
    marginBottom: 13,
  },

  filaTitulo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  planHeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  recommendationIcon: {
    backgroundColor: '#F1EBFA',
  },

  planTitulo: {
    fontSize: 13,
    fontWeight: '900',
    color: '#091D3A',
    flexShrink: 1,
  },

  objetivo: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 21,
    color: '#334155',
    marginBottom: 10,
  },

  etiquetaEstado: {
    backgroundColor: '#EAF3FC',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  estadoCompletado: {
    backgroundColor: '#EAF7EF',
  },

  estadoTexto: {
    color: '#123B73',
    fontSize: 10,
    fontWeight: '800',
  },

  detalle: {
    fontSize: 12,
    lineHeight: 19,
    color: '#64748B',
    marginTop: 5,
  },

  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },

  enlaceTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: '#123B73',
  },

  detalles: {
    borderTopWidth: 1,
    borderTopColor: '#E9EFF5',
    marginTop: 14,
    paddingTop: 13,
  },

  seccionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    marginBottom: 8,
  },

  seccion: {
    fontSize: 13,
    fontWeight: '800',
    color: '#123B73',
  },

  elemento: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },

  punto: {
    color: '#123B73',
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
    backgroundColor: '#F4F7FB',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },

  error: {
    backgroundColor: '#FFF4F2',
    borderRadius: 12,
    padding: 13,
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },

  aviso: {
    backgroundColor: '#F4F7FB',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 19,
    color: '#64748B',
    marginTop: 16,
  },
});
