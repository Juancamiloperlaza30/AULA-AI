import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  obtenerAlertaOrientador,
  listarSeguimientosOrientador,
} from '../services/orientadorAlertService';

import OrientadorSeguimientoForm
  from '../components/OrientadorSeguimientoForm';

import OrientadorEstadoActions
  from '../components/OrientadorEstadoActions';

import OrientadorAcademicRecommendations
  from '../components/OrientadorAcademicRecommendations';

import OrientadorAcademicPlans
  from '../components/OrientadorAcademicPlans';

const NIVELES = {
  baja: {
    nombre: 'Baja',
    fondo: '#EAF7EE',
    color: '#167347',
  },
  media: {
    nombre: 'Media',
    fondo: '#FFF5DB',
    color: '#946200',
  },
  alta: {
    nombre: 'Alta',
    fondo: '#FEECEB',
    color: '#C62828',
  },
  critica: {
    nombre: 'Crítica',
    fondo: '#FCE4EC',
    color: '#AD1457',
  },
};

const ESTADOS = {
  activa: 'Activa',
  en_seguimiento: 'En seguimiento',
  resuelta: 'Resuelta',
};

function formatearFecha(valor) {
  if (!valor) return 'No registrada';

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'Fecha no disponible';
  }

  return fecha.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Campo({ etiqueta, valor }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>
        {etiqueta}
      </Text>

      <Text style={styles.valor}>
        {valor === null ||
        valor === undefined ||
        valor === ''
          ? 'No disponible'
          : String(valor)}
      </Text>
    </View>
  );
}

export default function OrientadorAlertDetailScreen({
  alertaId,
  estudiante,
  apiUrl,
  accessToken,
  onVolver,
}) {
  const [alerta, setAlerta] = useState(null);
  const [seguimientos, setSeguimientos] =
    useState([]);
  const [cargando, setCargando] =
    useState(true);
  const [error, setError] = useState('');

  const cargarDetalle = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const [
        respuestaAlerta,
        respuestaSeguimientos,
      ] = await Promise.all([
        obtenerAlertaOrientador({
          apiUrl,
          accessToken,
          alertaId,
        }),
        listarSeguimientosOrientador({
          apiUrl,
          accessToken,
          alertaId,
        }),
      ]);

      if (!respuestaAlerta?.alerta) {
        throw new Error(
          'No se recibió la información de la alerta.'
        );
      }

      setAlerta(respuestaAlerta.alerta);

      setSeguimientos(
        Array.isArray(
          respuestaSeguimientos?.seguimientos
        )
          ? respuestaSeguimientos.seguimientos
          : []
      );
    } catch (err) {
      setError(
        err.message ||
        'No fue posible consultar el caso.'
      );
    } finally {
      setCargando(false);
    }
  }, [alertaId, apiUrl, accessToken]);

  useEffect(() => {
    let activo = true;

    Promise.resolve().then(() => {
      if (activo) {
        cargarDetalle();
      }
    });

    return () => {
      activo = false;
    };
  }, [cargarDetalle]);

  const nivel = alerta
    ? NIVELES[alerta.nivel] || NIVELES.media
    : NIVELES.media;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contenido}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={styles.volverBoton}
        onPress={onVolver}
        accessibilityRole="button"
      >
        <Text style={styles.volverTexto}>
          ‹ Volver a las alertas
        </Text>
      </TouchableOpacity>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
          <Text style={styles.mensaje}>
            Consultando información académica...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.tarjeta}>
          <Text style={styles.errorTexto}>
            {error}
          </Text>

          <TouchableOpacity
            style={styles.actualizarBoton}
            onPress={cargarDetalle}
          >
            <Text style={styles.actualizarTexto}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.tarjeta}>
            <Text style={styles.seccionTitulo}>
              Detalle de la alerta
            </Text>

            <Text style={styles.alertaTitulo}>
              {alerta.titulo ||
                'Alerta académica'}
            </Text>

            <View
              style={[
                styles.nivelBadge,
                {
                  backgroundColor:
                    nivel.fondo,
                },
              ]}
            >
              <Text
                style={[
                  styles.nivelTexto,
                  { color: nivel.color },
                ]}
              >
                Riesgo {nivel.nombre}
              </Text>
            </View>

            <Campo
              etiqueta="Identificador"
              valor={`#${alerta.id}`}
            />

            <Campo
              etiqueta="Estado"
              valor={
                ESTADOS[alerta.estado] ||
                alerta.estado
              }
            />

            <Campo
              etiqueta="Tipo de riesgo"
              valor={alerta.tipo}
            />

            <Campo
              etiqueta="Descripción"
              valor={alerta.descripcion}
            />

            <Campo
              etiqueta="Fecha del evento"
              valor={formatearFecha(
                alerta.fecha_evento
              )}
            />

            <Campo
              etiqueta="Fecha de creación"
              valor={formatearFecha(
                alerta.created_at
              )}
            />
          </View>

          <View style={styles.tarjeta}>
            <Text style={styles.seccionTitulo}>
              Estudiante relacionado
            </Text>

            <Campo
              etiqueta="Nombre completo"
              valor={
                [
                  estudiante?.nombres,
                  estudiante?.apellidos,
                ]
                  .filter(Boolean)
                  .join(' ') || 'No disponible'
              }
            />

            <Campo
              etiqueta="Grado y grupo"
              valor={
                estudiante?.grado_id && estudiante?.grupo_id
                  ? 'Información académica asociada'
                  : 'No disponible'
              }
            />

            <Campo
              etiqueta="Identificador del estudiante"
              valor={alerta.estudiante_id}
            />
          </View>

          {/* ==========================================
              HU-11: RECOMENDACIONES ACADÉMICAS
          ========================================== */}

          <OrientadorAcademicRecommendations
            estudianteId={alerta.estudiante_id}
            apiUrl={apiUrl}
            accessToken={accessToken}
          />

          <OrientadorAcademicPlans
            estudianteId={alerta.estudiante_id}
            alertaId={alerta.id}
            apiUrl={apiUrl}
            accessToken={accessToken}
          />

          <OrientadorEstadoActions
            alertaId={alerta.id}
            estadoAlerta={alerta.estado}
            apiUrl={apiUrl}
            accessToken={accessToken}
            onActualizado={cargarDetalle}
          />

          <OrientadorSeguimientoForm
            alertaId={alerta.id}
            apiUrl={apiUrl}
            accessToken={accessToken}
            estadoAlerta={alerta.estado}
            onRegistrado={cargarDetalle}
          />

          <View style={styles.tarjeta}>
            <View style={styles.filaTitulo}>
              <Text style={styles.seccionTitulo}>
                Historial de seguimiento
              </Text>

              <TouchableOpacity
                onPress={cargarDetalle}
                style={styles.actualizarBoton}
              >
                <Text style={styles.actualizarTexto}>
                  Actualizar
                </Text>
              </TouchableOpacity>
            </View>

            {seguimientos.length === 0 ? (
              <Text style={styles.mensaje}>
                Todavía no hay intervenciones
                registradas para esta alerta.
              </Text>
            ) : (
              seguimientos.map(
                (seguimiento, indice) => (
                  <View
                    key={String(
                      seguimiento.id ?? indice
                    )}
                    style={styles.seguimiento}
                  >
                    <Text style={styles.seguimientoTitulo}>
                      Intervención #{indice + 1}
                    </Text>

                    <Campo
                      etiqueta="Tipo de intervención"
                      valor={
                        seguimiento.tipo_intervencion
                      }
                    />

                    <Campo
                      etiqueta="Observación"
                      valor={
                        seguimiento.observacion
                      }
                    />

                    <Campo
                      etiqueta="Fecha"
                      valor={formatearFecha(
                        seguimiento.created_at
                      )}
                    />
                  </View>
                )
              )
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  contenido: {
    padding: 20,
    paddingBottom: 40,
  },
  volverBoton: {
    marginBottom: 16,
    paddingVertical: 10,
  },
  volverTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 18,
    marginBottom: 16,
  },
  seccionTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1D2A3A',
    marginBottom: 12,
  },
  alertaTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#344054',
    marginBottom: 12,
  },
  nivelBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  nivelTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  campo: {
    marginTop: 12,
  },
  etiqueta: {
    fontSize: 12,
    color: '#667085',
    marginBottom: 4,
  },
  valor: {
    fontSize: 14,
    lineHeight: 21,
    color: '#1D2A3A',
  },
  filaTitulo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seguimiento: {
    borderTopWidth: 1,
    borderTopColor: '#E6EAF0',
    paddingVertical: 12,
  },
  seguimientoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#344054',
  },
  actualizarBoton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
  },
  actualizarTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  centro: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  mensaje: {
    fontSize: 13,
    lineHeight: 20,
    color: '#667085',
    marginTop: 8,
  },
  errorTexto: {
    fontSize: 13,
    lineHeight: 20,
    color: '#B42318',
  },
});
