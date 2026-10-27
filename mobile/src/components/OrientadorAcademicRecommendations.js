'use strict';

// ======================================================
// AULA-AI | HU-11
// RECOMENDACIONES ACADÉMICAS DEL ESTUDIANTE
// ======================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  listarRecomendacionesEstudiante,
  generarRecomendacionEstudiante,
} from '../services/academicRecommendationService';

import AcademicRecommendationContent
  from './AcademicRecommendationContent';

const ESTADOS = {
  generada: 'Generada',
  revisada: 'Revisada',
  archivada: 'Archivada',
};

const ORIGENES = {
  ia: 'Generada mediante IA',
  plantilla: 'Recomendación predefinida',
};

function formatearFecha(valor) {
  if (!valor) {
    return 'No registrada';
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'Fecha no disponible';
  }

  return fecha.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function mostrarContenido(valor) {
  if (valor === null || valor === undefined) {
    return 'No disponible';
  }

  if (typeof valor === 'string') {
    return valor || 'No disponible';
  }

  if (Array.isArray(valor)) {
    if (valor.length === 0) {
      return 'Sin información registrada';
    }

    return valor
      .map((elemento) => {
        if (typeof elemento === 'string') {
          return `• ${elemento}`;
        }

        return JSON.stringify(elemento, null, 2);
      })
      .join('\n');
  }

  if (typeof valor === 'object') {
    if (Object.keys(valor).length === 0) {
      return 'Sin información registrada';
    }

    return JSON.stringify(valor, null, 2);
  }

  return String(valor);
}

export default function OrientadorAcademicRecommendations({
  estudianteId,
  apiUrl,
  accessToken,
}) {
  const [recomendaciones, setRecomendaciones] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  const [generando, setGenerando] =
    useState(false);

  const [error, setError] =
    useState('');

  const [mensaje, setMensaje] =
    useState('');

  const generacionEnCurso = useRef(false);

  const cargarRecomendaciones = useCallback(async () => {
    if (!estudianteId) {
      setRecomendaciones([]);
      setError(
        'No se encontró el identificador del estudiante.'
      );
      setCargando(false);
      return;
    }

    setCargando(true);
    setError('');

    try {
      const resultado =
        await listarRecomendacionesEstudiante({
          apiUrl,
          accessToken,
          estudianteId,
        });

      setRecomendaciones(
        Array.isArray(resultado?.recomendaciones)
          ? resultado.recomendaciones
          : []
      );
    } catch (err) {
      setError(
        err.message ||
        'No fue posible consultar las recomendaciones.'
      );
    } finally {
      setCargando(false);
    }
  }, [apiUrl, accessToken, estudianteId]);

  useEffect(() => {
    let activo = true;

    Promise.resolve().then(() => {
      if (activo) {
        cargarRecomendaciones();
      }
    });

    return () => {
      activo = false;
    };
  }, [cargarRecomendaciones]);

  const ejecutarGeneracion = async () => {
    if (generacionEnCurso.current) return;

    generacionEnCurso.current = true;

    setGenerando(true);
    setError('');
    setMensaje('');

    try {
      const resultado =
        await generarRecomendacionEstudiante({
          apiUrl,
          accessToken,
          estudianteId,
        });

      setMensaje(
        resultado.registroExistente
          ? 'Se recuperó una recomendación existente.'
          : 'La recomendación fue guardada correctamente.'
      );

      await cargarRecomendaciones();

      Alert.alert(
        'Recomendación procesada',
        resultado.registroExistente
          ? 'Se encontró una recomendación equivalente que ya estaba almacenada.'
          : 'La recomendación académica fue almacenada. Puedes consultarla en el historial.'
      );
    } catch (err) {
      Alert.alert(
        'No fue posible generar la recomendación',
        err.message ||
          'Ocurrió un error al procesar la solicitud.'
      );
    } finally {
      generacionEnCurso.current = false;
      setGenerando(false);
    }
  };

  const confirmarGeneracion = () => {
    if (
      cargando ||
      generando ||
      !estudianteId ||
      !accessToken
    ) {
      return;
    }

    Alert.alert(
      'Generar recomendación académica',
      'El sistema analizará los indicadores académicos disponibles del estudiante. La recomendación tendrá carácter orientativo y podrá utilizarse como apoyo para el acompañamiento.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Generar',
          onPress: ejecutarGeneracion,
        },
      ]
    );
  };

  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>
          Recomendaciones académicas
        </Text>

        <TouchableOpacity
          style={styles.botonActualizar}
          onPress={cargarRecomendaciones}
          disabled={cargando || generando}
          accessibilityRole="button"
        >
          <Text style={styles.textoActualizar}>
            Actualizar
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.descripcion}>
        Consulta las recomendaciones generadas
        para apoyar el desempeño académico
        del estudiante.
      </Text>

      <TouchableOpacity
        style={[
          styles.botonGenerar,
          (cargando || generando || !estudianteId) &&
            styles.botonDeshabilitado,
        ]}
        onPress={confirmarGeneracion}
        disabled={
          cargando ||
          generando ||
          !estudianteId ||
          !accessToken
        }
        accessibilityRole="button"
        accessibilityLabel="Generar recomendación académica"
      >
        {generando ? (
          <View style={styles.filaCargando}>
            <ActivityIndicator color="#FFFFFF" />

            <Text style={styles.textoGenerar}>
              Generando recomendación...
            </Text>
          </View>
        ) : (
          <Text style={styles.textoGenerar}>
            Generar recomendación académica
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.aviso}>
        Las recomendaciones apoyan el seguimiento
        académico y no sustituyen el criterio del
        orientador ni las decisiones institucionales.
      </Text>

      {mensaje ? (
        <View style={styles.exitoCaja}>
          <Text style={styles.exitoTexto}>
            {mensaje}
          </Text>
        </View>
      ) : null}

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator
            size="small"
            color="#2563EB"
          />

          <Text style={styles.mensaje}>
            Consultando recomendaciones...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorCaja}>
          <Text style={styles.errorTexto}>
            {error}
          </Text>

          <TouchableOpacity
            onPress={cargarRecomendaciones}
            accessibilityRole="button"
          >
            <Text style={styles.textoActualizar}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : recomendaciones.length === 0 ? (
        <Text style={styles.mensaje}>
          Este estudiante todavía no tiene
          recomendaciones académicas registradas.
        </Text>
      ) : (
        <>
          <Text style={styles.historialTitulo}>
            Historial de recomendaciones (
            {recomendaciones.length})
          </Text>

          {recomendaciones.map((recomendacion) => (
            <View
              key={String(recomendacion.id)}
              style={styles.recomendacion}
            >
              <View style={styles.fila}>
                <Text style={styles.recomendacionTitulo}>
                  Recomendación #{recomendacion.id}
                </Text>

                <View style={styles.estadoBadge}>
                  <Text style={styles.estadoTexto}>
                    {ESTADOS[recomendacion.estado] ||
                      recomendacion.estado}
                  </Text>
                </View>
              </View>

              <Text style={styles.etiqueta}>
                Origen
              </Text>

              <Text style={styles.valor}>
                {ORIGENES[recomendacion.origen] ||
                  'Origen no identificado'}
              </Text>

              {recomendacion.origen === 'plantilla' ? (
                <View style={styles.avisoPlantilla}>
                  <Text style={styles.avisoPlantillaTexto}>
                    Recomendación predefinida.
                    No fue generada mediante IA.
                  </Text>
                </View>
              ) : null}

              <Text style={styles.etiqueta}>
                Fecha de creación
              </Text>

              <Text style={styles.valor}>
                {formatearFecha(
                  recomendacion.created_at
                )}
              </Text>

              <Text style={styles.etiqueta}>
                Versión
              </Text>

              <Text style={styles.valor}>
                {String(recomendacion.version || 1)}
              </Text>

              <AcademicRecommendationContent
                contenido={recomendacion.contenido}
                indicadores={recomendacion.indicadores}
                origen={recomendacion.origen}
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 18,
    marginBottom: 16,
  },

  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  titulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1D2A3A',
    flex: 1,
  },

  descripcion: {
    fontSize: 13,
    lineHeight: 20,
    color: '#667085',
    marginBottom: 14,
  },

  botonActualizar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
    marginLeft: 8,
  },

  textoActualizar: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },

  botonGenerar: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  botonDeshabilitado: {
    opacity: 0.55,
  },

  textoGenerar: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  filaCargando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  aviso: {
    fontSize: 12,
    lineHeight: 19,
    color: '#64748B',
    marginBottom: 14,
  },

  centro: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  mensaje: {
    fontSize: 13,
    lineHeight: 20,
    color: '#667085',
    marginTop: 8,
  },

  errorCaja: {
    padding: 12,
    backgroundColor: '#FEECEB',
    borderRadius: 10,
  },

  errorTexto: {
    fontSize: 13,
    color: '#B42318',
    marginBottom: 8,
  },

  exitoCaja: {
    padding: 12,
    backgroundColor: '#ECFDF3',
    borderRadius: 10,
    marginBottom: 12,
  },

  exitoTexto: {
    fontSize: 13,
    color: '#027A48',
  },

  historialTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#344054',
    marginTop: 10,
  },

  recomendacion: {
    borderTopWidth: 1,
    borderTopColor: '#E6EAF0',
    paddingVertical: 16,
  },

  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  recomendacionTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#344054',
    flex: 1,
  },

  estadoBadge: {
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },

  estadoTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  etiqueta: {
    fontSize: 12,
    color: '#667085',
    marginTop: 10,
    marginBottom: 4,
  },

  valor: {
    fontSize: 13,
    lineHeight: 20,
    color: '#1D2A3A',
  },

  avisoIA: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },

  avisoIATexto: {
    color: '#1D4ED8',
    fontSize: 12,
    lineHeight: 19,
  },

  avisoPlantilla: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },

  avisoPlantillaTexto: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 19,
  },
});
