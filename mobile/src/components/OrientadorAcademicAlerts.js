import React, {
  useCallback,
  useEffect,
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

import {
  listarAlertasOrientador,
} from '../services/orientadorAlertService';

const NIVELES = {
  baja: {
    texto: 'Baja',
    fondo: '#EAF7EE',
    color: '#167347',
  },
  media: {
    texto: 'Media',
    fondo: '#FFF5DB',
    color: '#946200',
  },
  alta: {
    texto: 'Alta',
    fondo: '#FEECEB',
    color: '#C62828',
  },
  critica: {
    texto: 'Crítica',
    fondo: '#FCE4EC',
    color: '#AD1457',
  },
};

const ESTADOS = {
  activa: 'Activa',
  en_seguimiento: 'En seguimiento',
  resuelta: 'Resuelta',
};

const TIPOS = {
  bajo_rendimiento: 'Bajo rendimiento',
  inasistencias: 'Inasistencias',
  llegadas_tarde: 'Llegadas tarde',
  actividad_incumplida: 'Actividad incumplida',
};

function normalizarAlertas(resultado) {
  if (Array.isArray(resultado?.alertas)) {
    return resultado.alertas;
  }

  if (Array.isArray(resultado?.data)) {
    return resultado.data;
  }

  return [];
}

export default function OrientadorAcademicAlerts({
  apiUrl,
  accessToken,
  onSeleccionarAlerta,
}) {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] =
    useState(false);
  const [error, setError] = useState('');

  const cargarAlertas = useCallback(async () => {
    try {
      setError('');

      const resultado =
        await listarAlertasOrientador({
          apiUrl,
          accessToken,
        });

      setAlertas(normalizarAlertas(resultado));
    } catch (err) {
      setError(
        err.message ||
        'No fue posible cargar las alertas.'
      );
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [apiUrl, accessToken]);

  useEffect(() => {
    let activo = true;

    Promise.resolve().then(() => {
      if (activo) {
        cargarAlertas();
      }
    });

    return () => {
      activo = false;
    };
  }, [cargarAlertas]);

  const actualizar = useCallback(() => {
    setActualizando(true);
    cargarAlertas();
  }, [cargarAlertas]);

  return (
    <View style={styles.container}>
      <View style={styles.encabezado}>
        <View style={styles.encabezadoTexto}>
          <Text style={styles.titulo}>
            Alertas académicas
          </Text>

          <Text style={styles.subtitulo}>
            Seguimiento de estudiantes autorizados
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actualizarBoton}
          onPress={actualizar}
          disabled={actualizando}
          accessibilityRole="button"
          accessibilityLabel="Actualizar alertas"
        >
          <Text style={styles.actualizarTexto}>
            Actualizar
          </Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
          <Text style={styles.mensaje}>
            Cargando alertas...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.mensajeCard}>
          <Text style={styles.errorTexto}>
            {error}
          </Text>

          <TouchableOpacity
            onPress={actualizar}
            style={styles.reintentarBoton}
          >
            <Text style={styles.reintentarTexto}>
              Reintentar
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.lista}
          nestedScrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={actualizando}
              onRefresh={actualizar}
            />
          }
        >
          {alertas.length === 0 ? (
            <View style={styles.mensajeCard}>
              <Text style={styles.vacioTitulo}>
                Sin alertas disponibles
              </Text>
              <Text style={styles.mensaje}>
                No hay alertas académicas asignadas
                a tu ámbito de orientación.
              </Text>
            </View>
          ) : (
            alertas.map((alerta) => {
              const nivel =
                NIVELES[alerta.nivel] ||
                NIVELES.media;

              return (
                <TouchableOpacity
                  key={String(alerta.id)}
                  style={styles.alertaCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (
                      typeof onSeleccionarAlerta ===
                      'function'
                    ) {
                      onSeleccionarAlerta(alerta);
                    }
                  }}
                >
                  <View style={styles.alertaSuperior}>
                    <Text
                      style={styles.alertaTitulo}
                      numberOfLines={2}
                    >
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
                        {nivel.texto}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.tipo}>
                    {TIPOS[alerta.tipo] ||
                      alerta.tipo ||
                      'Riesgo académico'}
                  </Text>

                  <Text
                    style={styles.descripcion}
                    numberOfLines={3}
                  >
                    {alerta.descripcion ||
                      'Sin descripción disponible.'}
                  </Text>

                  <View style={styles.alertaPie}>
                    <Text style={styles.estado}>
                      {ESTADOS[alerta.estado] ||
                        alerta.estado}
                    </Text>

                    <Text style={styles.verDetalle}>
                      Ver detalle ›
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  encabezadoTexto: {
    flex: 1,
    paddingRight: 10,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D2A3A',
  },
  subtitulo: {
    fontSize: 12,
    lineHeight: 18,
    color: '#667085',
    marginTop: 4,
  },
  actualizarBoton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#EEF4FF',
    borderRadius: 10,
  },
  actualizarTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  centro: {
    paddingVertical: 35,
    alignItems: 'center',
  },
  mensajeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  mensaje: {
    fontSize: 13,
    lineHeight: 20,
    color: '#667085',
    textAlign: 'center',
    marginTop: 8,
  },
  errorTexto: {
    fontSize: 13,
    color: '#B42318',
    textAlign: 'center',
    lineHeight: 20,
  },
  reintentarBoton: {
    marginTop: 12,
    padding: 10,
  },
  reintentarTexto: {
    color: '#2563EB',
    fontWeight: '700',
  },
  vacioTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#344054',
  },
  lista: {
    maxHeight: 520,
  },
  alertaCard: {
    borderWidth: 1,
    borderColor: '#E6EAF0',
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  alertaSuperior: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  alertaTitulo: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1D2A3A',
    paddingRight: 8,
  },
  nivelBadge: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  nivelTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  tipo: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 8,
  },
  descripcion: {
    fontSize: 13,
    lineHeight: 19,
    color: '#667085',
    marginTop: 8,
  },
  alertaPie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    paddingTop: 12,
    marginTop: 12,
  },
  estado: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475467',
  },
  verDetalle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
});
