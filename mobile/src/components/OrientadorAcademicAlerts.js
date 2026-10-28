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

import { Ionicons } from '@expo/vector-icons';

import {
  listarAlertasOrientador,
} from '../services/orientadorAlertService';

const COLORS = {
  navy: '#091D3A',
  blue: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#263B53',
  muted: '#718096',
  border: '#DFE7F0',
};

const NIVELES = {
  baja: {
    texto: 'Baja',
    fondo: '#EAF7EF',
    color: '#21845B',
  },
  media: {
    texto: 'Media',
    fondo: '#FFF5DF',
    color: '#B7791F',
  },
  alta: {
    texto: 'Alta',
    fondo: '#FFF4F2',
    color: '#A52A22',
  },
  critica: {
    texto: 'Crítica',
    fondo: '#FFF0F4',
    color: '#AD1457',
  },
};

const ESTADOS = {
  activa: 'Activa',
  en_seguimiento: 'En seguimiento',
  resuelta: 'Resuelta',
};

const ESTADOS_VISUALES = {
  activa: {
    fondo: '#FFF4F2',
    color: '#A52A22',
  },
  en_seguimiento: {
    fondo: '#FFF5DF',
    color: '#946200',
  },
  resuelta: {
    fondo: '#EAF7EF',
    color: '#21845B',
  },
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

function nombreEstudiante(estudiante) {
  const nombre = [
    estudiante?.nombres,
    estudiante?.apellidos,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return nombre || 'Estudiante';
}

function fechaVisible(valor) {
  if (!valor) {
    return 'Fecha no disponible';
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'Fecha no disponible';
  }

  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

  const resumen = alertas.reduce(
    (conteo, alerta) => {
      conteo.total += 1;

      if (alerta.estado === 'activa') {
        conteo.activas += 1;
      } else if (alerta.estado === 'en_seguimiento') {
        conteo.seguimiento += 1;
      } else if (alerta.estado === 'resuelta') {
        conteo.resueltas += 1;
      }

      return conteo;
    },
    {
      total: 0,
      activas: 0,
      seguimiento: 0,
      resueltas: 0,
    }
  );

  return (
    <View style={styles.container}>
      <View style={styles.encabezado}>
        <View style={styles.headingIcon}>
          <Ionicons
            name="notifications-outline"
            size={21}
            color={COLORS.blue}
          />
        </View>

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
          <Ionicons
            name="refresh-outline"
            size={15}
            color={COLORS.blue}
          />
          <Text style={styles.actualizarTexto}>
            Actualizar
          </Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator
            size="large"
            color={COLORS.blue}
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
        <>
          <View style={styles.resumenSection}>
            <View style={styles.resumenHeading}>
              <Text style={styles.resumenTitulo}>
                Resumen de consulta
              </Text>

              <Text style={styles.resumenCaption}>
                {resumen.total} {resumen.total === 1
                  ? 'alerta cargada'
                  : 'alertas cargadas'}
              </Text>
            </View>

            <View style={styles.resumenGrid}>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>
                  {resumen.total}
                </Text>
                <Text style={styles.resumenLabel}>
                  Total
                </Text>
              </View>

              <View style={styles.resumenItem}>
                <Text
                  style={[
                    styles.resumenValor,
                    styles.resumenActivas,
                  ]}
                >
                  {resumen.activas}
                </Text>
                <Text style={styles.resumenLabel}>
                  Activas
                </Text>
              </View>

              <View style={styles.resumenItem}>
                <Text
                  style={[
                    styles.resumenValor,
                    styles.resumenSeguimiento,
                  ]}
                >
                  {resumen.seguimiento}
                </Text>
                <Text style={styles.resumenLabel}>
                  En seguimiento
                </Text>
              </View>

              <View style={styles.resumenItem}>
                <Text
                  style={[
                    styles.resumenValor,
                    styles.resumenResueltas,
                  ]}
                >
                  {resumen.resueltas}
                </Text>
                <Text style={styles.resumenLabel}>
                  Resueltas
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.listaEncabezado}>
            <View>
              <Text style={styles.listaTitulo}>
                Alertas registradas
              </Text>
              <Text style={styles.listaSubtitulo}>
                Selecciona una alerta para ver su seguimiento.
              </Text>
            </View>
          </View>

          {alertas.length === 0 ? (
            <ScrollView
              style={styles.lista}
              nestedScrollEnabled
              refreshControl={
                <RefreshControl
                  refreshing={actualizando}
                  onRefresh={actualizar}
                  colors={[COLORS.blue]}
                  tintColor={COLORS.blue}
                />
              }
            >
              <View style={styles.mensajeCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="checkmark-done-outline"
                    size={24}
                    color="#21845B"
                  />
                </View>
                <Text style={styles.vacioTitulo}>
                  Sin alertas disponibles
                </Text>
                <Text style={styles.mensaje}>
                  No hay alertas académicas asignadas
                  a tu ámbito de orientación.
                </Text>
              </View>
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.lista}
              nestedScrollEnabled
              refreshControl={
                <RefreshControl
                  refreshing={actualizando}
                  onRefresh={actualizar}
                  colors={[COLORS.blue]}
                  tintColor={COLORS.blue}
                />
              }
            >
              {alertas.map((alerta) => {
                const nivel =
                  NIVELES[alerta.nivel] ||
                  NIVELES.media;
                const estado =
                  ESTADOS_VISUALES[alerta.estado] ||
                  ESTADOS_VISUALES.activa;
                const estudiante = nombreEstudiante(
                  alerta.estudiante
                );
                const fecha = fechaVisible(
                  alerta.fecha_evento || alerta.created_at
                );

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
                    accessibilityRole="button"
                    accessibilityLabel={
                      `${alerta.titulo || 'Alerta académica'}, ` +
                      `${nivel.texto}, ${ESTADOS[alerta.estado] || alerta.estado}. ` +
                      'Ver detalle'
                    }
                  >
                    <View style={styles.alertaTopline}>
                      <View style={styles.alertaTipoFila}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={15}
                          color={COLORS.blue}
                        />
                        <Text style={styles.tipo}>
                          {TIPOS[alerta.tipo] ||
                            alerta.tipo ||
                            'Riesgo académico'}
                        </Text>
                      </View>

                      <Text style={styles.fecha}>
                        {fecha}
                      </Text>
                    </View>

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
                          { backgroundColor: nivel.fondo },
                        ]}
                      >
                        <View
                          style={[
                            styles.nivelPunto,
                            { backgroundColor: nivel.color },
                          ]}
                        />
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

                    <View style={styles.estudianteFila}>
                      <View style={styles.estudianteIcon}>
                        <Ionicons
                          name="person-outline"
                          size={15}
                          color={COLORS.blue}
                        />
                      </View>
                      <Text
                        style={styles.estudianteNombre}
                        numberOfLines={1}
                      >
                        {estudiante}
                      </Text>
                    </View>

                    <Text
                      style={styles.descripcion}
                      numberOfLines={3}
                    >
                      {alerta.descripcion ||
                        'Sin descripción disponible.'}
                    </Text>

                    <View style={styles.alertaPie}>
                      <View
                        style={[
                          styles.estadoBadge,
                          { backgroundColor: estado.fondo },
                        ]}
                      >
                        <Text
                          style={[
                            styles.estado,
                            { color: estado.color },
                          ]}
                        >
                          {ESTADOS[alerta.estado] ||
                            alerta.estado ||
                            'Sin estado'}
                        </Text>
                      </View>

                      <View style={styles.verDetalleFila}>
                        <Text style={styles.verDetalle}>
                          Ver detalle
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={15}
                          color={COLORS.blue}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 17,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 16,
  },
  headingIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  encabezadoTexto: {
    flex: 1,
    paddingRight: 10,
  },
  titulo: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.navy,
  },
  subtitulo: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
    marginTop: 4,
  },
  actualizarBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  actualizarTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.blue,
  },
  resumenSection: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 13,
    marginBottom: 20,
  },
  resumenHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 11,
  },
  resumenTitulo: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  resumenCaption: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  resumenGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  resumenItem: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 3,
  },
  resumenValor: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: '900',
  },
  resumenActivas: {
    color: '#A52A22',
  },
  resumenSeguimiento: {
    color: '#946200',
  },
  resumenResueltas: {
    color: '#21845B',
  },
  resumenLabel: {
    color: COLORS.muted,
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: 3,
    fontWeight: '700',
  },
  listaEncabezado: {
    marginBottom: 10,
  },
  listaTitulo: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  listaSubtitulo: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  centro: {
    paddingVertical: 35,
    alignItems: 'center',
  },
  mensajeCard: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  mensaje: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  errorTexto: {
    fontSize: 13,
    color: '#A52A22',
    textAlign: 'center',
    lineHeight: 20,
  },
  reintentarBoton: {
    marginTop: 12,
    padding: 10,
  },
  reintentarTexto: {
    color: COLORS.blue,
    fontWeight: '700',
  },
  vacioTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EAF7EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  lista: {
    maxHeight: 520,
  },
  alertaCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.cyan,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 7,
    elevation: 1,
  },
  alertaSuperior: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  alertaTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 9,
  },
  alertaTipoFila: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  alertaTitulo: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
    paddingRight: 8,
  },
  nivelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  nivelPunto: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nivelTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  tipo: {
    fontSize: 12,
    color: COLORS.blue,
    fontWeight: '800',
  },
  fecha: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  estudianteFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    marginTop: 11,
  },
  estudianteIcon: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: '#DDEBFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  estudianteNombre: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  descripcion: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
    marginTop: 8,
  },
  alertaPie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 12,
  },
  estado: {
    fontSize: 12,
    fontWeight: '800',
  },
  estadoBadge: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  verDetalleFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  verDetalle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.blue,
  },
});
