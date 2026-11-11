import React, {
  useCallback,
  useEffect,
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

import { Ionicons } from '@expo/vector-icons';

import {
  listarPlanesEstudiante,
} from '../services/academicPlanService';

import {
  listarRecomendacionesEstudiante,
} from '../services/academicRecommendationService';

import AcademicRecommendationContent
  from './AcademicRecommendationContent';

const ESTADOS = {
  propuesto: 'Propuesto',
  en_seguimiento: 'En seguimiento',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const fechaLegible = (valor) => {
  if (!valor) return 'No definida';

  const partes = String(valor)
    .slice(0, 10)
    .split('-');

  if (partes.length !== 3) {
    return 'Fecha no disponible';
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

function ListaAcciones({ titulo, elementos }) {
  if (!Array.isArray(elementos) || elementos.length === 0) {
    return null;
  }

  return (
    <View style={styles.lista}>
      <Text style={styles.etiqueta}>{titulo}</Text>
      {elementos.map((elemento, indice) => {
        const texto =
          typeof elemento === 'string'
            ? elemento
            : elemento?.descripcion ||
              elemento?.indicador ||
              elemento?.titulo ||
              elemento?.nombre;

        return texto ? (
          <Text
            key={`${indice}-${texto}`}
            style={styles.accion}
          >
            {'• '}{texto}
          </Text>
        ) : null;
      })}
    </View>
  );
}

export default function GuardianAcademicRecommendations({
  estudianteId,
  apiUrl,
  accessToken,
}) {
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorRecomendaciones, setErrorRecomendaciones] =
    useState('');
  const [errorPlanes, setErrorPlanes] = useState('');
  const solicitudRef = useRef(0);
  const [consultaInicialCompleta, setConsultaInicialCompleta] =
    useState(false);

  const cargar = useCallback(async () => {
    const solicitud = ++solicitudRef.current;

    if (!estudianteId || !accessToken) {
      const mensaje = !estudianteId
        ? 'No se encontró un estudiante para consultar.'
        : 'No se encontró una sesión válida.';

      setErrorRecomendaciones(mensaje);
      setErrorPlanes(mensaje);
      setRecomendaciones([]);
      setPlanes([]);
      setCargando(false);
      setConsultaInicialCompleta(true);
      return;
    }

    setCargando(true);
    setErrorRecomendaciones('');
    setErrorPlanes('');

    try {
      const [resultadoRecomendaciones, resultadoPlanes] =
        await Promise.allSettled([
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

      if (solicitud !== solicitudRef.current) {
        return;
      }

      if (resultadoRecomendaciones.status === 'fulfilled') {
        const datos = resultadoRecomendaciones.value;

        if (Array.isArray(datos?.recomendaciones)) {
          setRecomendaciones(datos.recomendaciones);
        } else {
          setErrorRecomendaciones(
            'El servidor devolvió recomendaciones en un formato no válido.'
          );
        }
      } else {
        setErrorRecomendaciones(
          resultadoRecomendaciones.reason?.message ||
            'No fue posible consultar las recomendaciones.'
        );
      }

      if (resultadoPlanes.status === 'fulfilled') {
        if (Array.isArray(resultadoPlanes.value)) {
          setPlanes(resultadoPlanes.value);
        } else {
          setErrorPlanes(
            'El servidor devolvió los planes en un formato no válido.'
          );
        }
      } else {
        setErrorPlanes(
          resultadoPlanes.reason?.message ||
            'No fue posible consultar los planes.'
        );
      }
    } finally {
      if (solicitud === solicitudRef.current) {
        setCargando(false);
        setConsultaInicialCompleta(true);
      }
    }
  }, [apiUrl, accessToken, estudianteId]);

  useEffect(() => {
    let activo = true;

    Promise.resolve().then(() => {
      if (activo) {
        void cargar();
      }
    });

    return () => {
      activo = false;
      solicitudRef.current += 1;
    };
  }, [cargar]);

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Ionicons
          name="sparkles-outline"
          size={21}
          color="#123B73"
        />
        <View style={styles.encabezadoTexto}>
          <Text style={styles.titulo}>
            Recomendaciones y planes
          </Text>
          <Text style={styles.descripcion}>
            Consulta de solo lectura para el estudiante vinculado.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.actualizar}
        onPress={() => void cargar()}
        disabled={cargando}
        accessibilityRole="button"
      >
        {cargando ? (
          <ActivityIndicator size="small" color="#123B73" />
        ) : (
          <Ionicons
            name="refresh-outline"
            size={17}
            color="#123B73"
          />
        )}
        <Text style={styles.actualizarTexto}>
          {cargando ? 'Consultando...' : 'Actualizar información'}
        </Text>
      </TouchableOpacity>

      {cargando && !consultaInicialCompleta ? (
        <View style={styles.cargando}>
          <ActivityIndicator color="#123B73" />
          <Text style={styles.secundario}>
            Consultando el acompañamiento académico...
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.subtitulo}>
            Recomendaciones académicas
          </Text>
          {errorRecomendaciones ? (
            <Text style={styles.error}>
              {errorRecomendaciones}
            </Text>
          ) : recomendaciones.length === 0 ? (
            <Text style={styles.secundario}>
              No hay recomendaciones académicas registradas.
            </Text>
          ) : (
            recomendaciones.map((recomendacion) => (
              <View
                key={String(recomendacion.id)}
                style={styles.tarjeta}
              >
                <Text style={styles.tarjetaTitulo}>
                  Recomendación #{recomendacion.id}
                </Text>
                <AcademicRecommendationContent
                  contenido={recomendacion.contenido}
                  indicadores={recomendacion.indicadores}
                  origen={recomendacion.origen}
                />
              </View>
            ))
          )}

          <Text style={styles.subtitulo}>
            Planes de acompañamiento
          </Text>
          {errorPlanes ? (
            <Text style={styles.error}>{errorPlanes}</Text>
          ) : planes.length === 0 ? (
            <Text style={styles.secundario}>
              No hay planes de acompañamiento registrados.
            </Text>
          ) : (
            planes.map((plan) => (
              <View
                key={String(plan.id)}
                style={styles.tarjeta}
              >
                <View style={styles.fila}>
                  <Text style={styles.tarjetaTitulo}>
                    Plan #{plan.id}
                  </Text>
                  <Text style={styles.estado}>
                    {ESTADOS[plan.estado] ||
                      plan.estado ||
                      'Sin estado'}
                  </Text>
                </View>

                <Text style={styles.objetivo}>
                  {plan.objetivo || 'Sin objetivo registrado'}
                </Text>

                <Text style={styles.secundario}>
                  Prioridad: {plan.prioridad || 'No definida'}
                </Text>
                <Text style={styles.secundario}>
                  Próximo seguimiento:{' '}
                  {fechaLegible(plan.fecha_seguimiento)}
                </Text>

                <ListaAcciones
                  titulo="Acciones"
                  elementos={plan.acciones}
                />
                <ListaAcciones
                  titulo="Indicadores de progreso"
                  elementos={plan.indicadores_progreso}
                />
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DFE7F0',
    padding: 18,
    marginBottom: 18,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  encabezadoTexto: {
    flex: 1,
  },
  titulo: {
    color: '#123B73',
    fontSize: 17,
    fontWeight: '800',
  },
  descripcion: {
    color: '#718096',
    fontSize: 12,
    marginTop: 4,
  },
  actualizar: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#EAF3FC',
    marginBottom: 16,
  },
  actualizarTexto: {
    color: '#123B73',
    fontSize: 12,
    fontWeight: '700',
  },
  cargando: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  subtitulo: {
    color: '#123B73',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 10,
  },
  tarjeta: {
    backgroundColor: '#F8FAFC',
    borderColor: '#DFE7F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  tarjetaTitulo: {
    color: '#263B53',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  estado: {
    color: '#123B73',
    fontSize: 12,
    fontWeight: '800',
  },
  objetivo: {
    color: '#263B53',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  etiqueta: {
    color: '#263B53',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  lista: {
    marginTop: 6,
  },
  accion: {
    color: '#526174',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  secundario: {
    color: '#718096',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  error: {
    color: '#A52A22',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
});
