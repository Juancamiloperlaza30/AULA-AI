import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

const CATEGORIAS = {
  actividades: 'Actividades académicas',
  organizacion: 'Organización del estudio',
  asistencia: 'Asistencia',
  puntualidad: 'Puntualidad',
  acompanamiento: 'Acompañamiento',
  estudio: 'Hábitos de estudio',
  general: 'Orientación general',
};

const PRIORIDADES = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

const AVISO_IA =
  'Sugerencia generada por IA como apoyo orientativo. ' +
  'No constituye una decisión académica definitiva.';

const INDICADORES = {
  calificaciones: {
    titulo: 'Calificaciones',
    campos: {
      cantidadCalificaciones: 'Calificaciones registradas',
      promedioCalificacionesDisponibles:
        'Promedio de calificaciones disponibles',
    },
  },

  actividades: {
    titulo: 'Actividades académicas',
    campos: {
      totalPendientes: 'Actividades pendientes',
      totalVencidas: 'Actividades vencidas',
      totalEnPlazo: 'Pendientes dentro del plazo',
    },
  },

  asistencia: {
    titulo: 'Asistencia y puntualidad',
    campos: {
      hayRegistros: 'Existen registros de asistencia',
      totalAusencias: 'Inasistencias registradas',
      totalLlegadasTarde: 'Llegadas tarde',
    },
  },

  riesgos: {
    titulo: 'Alertas académicas',
    campos: {
      totalPendientesAtencion:
        'Alertas pendientes de atención',
    },
  },
};

function formatearValor(valor) {
  if (valor === true) return 'Sí';
  if (valor === false) return 'No';

  if (valor === null || valor === undefined) {
    return 'No disponible';
  }

  return String(valor);
}

function FilaIndicador({ titulo, valor }) {
  return (
    <View style={styles.filaIndicador}>
      <Text style={styles.indicadorNombre}>
        {titulo}
      </Text>

      <Text style={styles.indicadorValor}>
        {formatearValor(valor)}
      </Text>
    </View>
  );
}

export default function AcademicRecommendationContent({
  contenido,
  indicadores,
  origen,
}) {
  const datos =
    contenido &&
    typeof contenido === 'object' &&
    !Array.isArray(contenido)
      ? contenido
      : {};

  const recomendaciones = Array.isArray(
    datos.recomendaciones
  )
    ? datos.recomendaciones
    : [];

  const datosIndicadores =
    indicadores &&
    typeof indicadores === 'object' &&
    !Array.isArray(indicadores)
      ? indicadores
      : {};

  // El aviso se muestra una sola vez.
  // Se prioriza el texto guardado en Supabase.
  const aviso =
    typeof datos.aviso === 'string' &&
    datos.aviso.trim()
      ? datos.aviso.trim()
      : origen === 'ia'
        ? AVISO_IA
        : '';

  return (
    <View style={styles.contenedor}>
      {aviso ? (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>
            {aviso}
          </Text>
        </View>
      ) : null}

      {datos.notaOrigen ? (
        <Text style={styles.notaOrigen}>
          {datos.notaOrigen}
        </Text>
      ) : null}

      <Text style={styles.seccionTitulo}>
        Recomendaciones académicas
      </Text>

      {recomendaciones.length === 0 ? (
        <Text style={styles.vacio}>
          No hay recomendaciones estructuradas
          disponibles para este registro.
        </Text>
      ) : (
        recomendaciones.map((recomendacion, indice) => {
          if (
            !recomendacion ||
            typeof recomendacion !== 'object' ||
            Array.isArray(recomendacion)
          ) {
            return null;
          }

          const acciones = Array.isArray(
            recomendacion.acciones
          )
            ? recomendacion.acciones
            : [];

          return (
            <View
              key={`${indice}-${recomendacion.titulo || ''}`}
              style={styles.tarjeta}
            >
              <Text style={styles.titulo}>
                {indice + 1}.{' '}
                {recomendacion.titulo ||
                  'Recomendación académica'}
              </Text>

              <View style={styles.etiquetas}>
                <Text style={styles.categoria}>
                  {CATEGORIAS[
                    recomendacion.categoria
                  ] ||
                    recomendacion.categoria ||
                    'General'}
                </Text>

                <Text
                  style={[
                    styles.prioridad,
                    recomendacion.prioridad === 'alta' &&
                      styles.prioridadAlta,
                  ]}
                >
                  Prioridad:{' '}
                  {PRIORIDADES[
                    recomendacion.prioridad
                  ] || 'No definida'}
                </Text>
              </View>

              {recomendacion.descripcion ? (
                <Text style={styles.descripcion}>
                  {recomendacion.descripcion}
                </Text>
              ) : null}

              {acciones.length > 0 ? (
                <>
                  <Text style={styles.accionesTitulo}>
                    ¿Qué acciones realizar?
                  </Text>

                  {acciones.map((accion, i) => (
                    <View
                      key={`${indice}-accion-${i}`}
                      style={styles.accion}
                    >
                      <Text style={styles.punto}>
                        •
                      </Text>

                      <Text style={styles.accionTexto}>
                        {typeof accion === 'string'
                          ? accion
                          : 'Acción no disponible'}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          );
        })
      )}

      <Text style={styles.seccionTitulo}>
        Indicadores académicos utilizados
      </Text>

      {Object.entries(INDICADORES).map(
        ([grupo, configuracion]) => {
          const valores = datosIndicadores[grupo];

          if (
            !valores ||
            typeof valores !== 'object' ||
            Array.isArray(valores)
          ) {
            return null;
          }

          const campos = Object.entries(
            configuracion.campos
          ).filter(
            ([clave]) =>
              valores[clave] !== undefined
          );

          const niveles =
            grupo === 'riesgos'
              ? valores.pendientesPorNivel
              : null;

          if (
            campos.length === 0 &&
            !niveles
          ) {
            return null;
          }

          return (
            <View
              key={grupo}
              style={styles.grupoIndicador}
            >
              <Text style={styles.grupoTitulo}>
                {configuracion.titulo}
              </Text>

              {campos.map(([clave, titulo]) => (
                <FilaIndicador
                  key={clave}
                  titulo={titulo}
                  valor={valores[clave]}
                />
              ))}

              {niveles &&
              typeof niveles === 'object' ? (
                <>
                  <FilaIndicador
                    titulo="Alertas de prioridad alta"
                    valor={niveles.alta}
                  />

                  <FilaIndicador
                    titulo="Alertas de prioridad media"
                    valor={niveles.media}
                  />

                  <FilaIndicador
                    titulo="Alertas de prioridad baja"
                    valor={niveles.baja}
                  />
                </>
              ) : null}
            </View>
          );
        }
      )}

      <Text style={styles.notaFinal}>
        Los indicadores corresponden a la
        información disponible al momento de
        generar esta recomendación. No representan
        necesariamente resultados académicos
        definitivos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    marginTop: 8,
  },

  aviso: {
    padding: 13,
    backgroundColor: '#EAF3FC',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#27C4E8',
    marginBottom: 12,
  },

  avisoTexto: {
    color: '#123B73',
    fontSize: 12,
    lineHeight: 19,
  },

  notaOrigen: {
    color: '#718096',
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 12,
  },

  seccionTitulo: {
    color: '#091D3A',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 12,
  },

  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    marginBottom: 12,
  },

  titulo: {
    fontSize: 14,
    fontWeight: '900',
    color: '#091D3A',
    lineHeight: 21,
    marginBottom: 10,
  },

  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },

  categoria: {
    backgroundColor: '#EAF3FC',
    color: '#123B73',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
  },

  prioridad: {
    backgroundColor: '#F4F7FB',
    color: '#52647A',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
  },

  prioridadAlta: {
    backgroundColor: '#FFF0EE',
    color: '#A52A22',
  },

  descripcion: {
    color: '#52647A',
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 12,
  },

  accionesTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#123B73',
    marginBottom: 8,
  },

  accion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 7,
  },

  punto: {
    color: '#27C4E8',
    fontSize: 18,
    lineHeight: 20,
  },

  accionTexto: {
    flex: 1,
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },

  grupoIndicador: {
    backgroundColor: '#F4F7FB',
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },

  grupoTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#123B73',
    marginBottom: 8,
  },

  filaIndicador: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 7,
  },

  indicadorNombre: {
    flex: 1,
    color: '#718096',
    fontSize: 12,
    lineHeight: 18,
  },

  indicadorValor: {
    color: '#091D3A',
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'right',
  },

  vacio: {
    color: '#718096',
    fontSize: 13,
  },

  notaFinal: {
    color: '#718096',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
  },
});