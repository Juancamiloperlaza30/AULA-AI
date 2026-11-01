import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  obtenerUbicacionActual,
  MENSAJES_UBICACION,
} from '../services/locationService';

const COLORS = {
  navy: '#091D3A',
  primary: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#1D2939',
  secondary: '#667085',
  border: '#E4EAF2',
  green: '#16A34A',
  red: '#B42318',
};

export default function LocationScreen({ onBack }) {
  const [cargando, setCargando] = useState(false);
  const [ubicacion, setUbicacion] = useState(null);
  const [error, setError] = useState('');

  const solicitudRef = useRef(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;

    return () => {
      montadoRef.current = false;

      if (solicitudRef.current) {
        solicitudRef.current.abort();
        solicitudRef.current = null;
      }
    };
  }, []);

  const solicitarUbicacion = async () => {
    if (solicitudRef.current) {
      return;
    }

    const controller = new AbortController();
    solicitudRef.current = controller;

    setCargando(true);
    setError('');
    setUbicacion(null);

    try {
      const resultado = await obtenerUbicacionActual({
        signal: controller.signal,
        solicitarPermiso: true,
      });

      if (!montadoRef.current || controller.signal.aborted) {
        return;
      }

      setUbicacion(resultado);
    } catch (errorSolicitud) {
      if (!montadoRef.current || controller.signal.aborted) {
        return;
      }

      setError(
        errorSolicitud?.message ||
          MENSAJES_UBICACION.ERROR_GENERAL
      );
    } finally {
      if (solicitudRef.current === controller) {
        solicitudRef.current = null;
      }

      if (montadoRef.current) {
        setCargando(false);
      }
    }
  };

  const confirmarSolicitud = () => {
    if (solicitudRef.current || cargando) {
      return;
    }

    Alert.alert(
      'Permiso de ubicación',
      'AULA-AI necesita acceder a tu ubicación para ejecutar esta función. La ubicación se consultará una sola vez y no se almacenará ni se utilizará para realizar seguimiento permanente.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Continuar',
          onPress: () => {
            if (!solicitudRef.current && montadoRef.current) {
              void solicitarUbicacion();
            }
          },
        },
      ]
    );
  };

  const regresar = () => {
    solicitudRef.current?.abort();
    onBack?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={regresar}
          accessibilityRole="button"
          accessibilityLabel="Regresar"
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.white}
          />
        </TouchableOpacity>

        <View style={styles.headerIcon}>
          <Ionicons
            name="location-outline"
            size={27}
            color={COLORS.cyan}
          />
        </View>

        <Text style={styles.headerTitle}>
          Ubicación del dispositivo
        </Text>

        <Text style={styles.headerSubtitle}>
          Consulta tu ubicación cuando una función de AULA-AI
          lo requiera.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.infoCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={30}
            color={COLORS.primary}
          />

          <Text style={styles.infoTitle}>
            Tu privacidad es importante
          </Text>

          <Text style={styles.infoText}>
            AULA-AI solicitará acceso a tu ubicación únicamente
            cuando decidas utilizar esta función.
            {'\n\n'}
            No realizamos seguimiento permanente ni almacenamos
            tus coordenadas en nuestra base de datos.
          </Text>
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>
            Consultar ubicación actual
          </Text>

          <Text style={styles.description}>
            Presiona el botón para solicitar autorización y
            obtener la ubicación actual de tu dispositivo.
          </Text>

          <TouchableOpacity
            style={[
              styles.locationButton,
              cargando && styles.disabledButton,
            ]}
            onPress={confirmarSolicitud}
            disabled={cargando}
            accessibilityRole="button"
            accessibilityLabel="Obtener mi ubicación"
          >
            {cargando ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Ionicons
                name="navigate-outline"
                size={20}
                color={COLORS.white}
              />
            )}

            <Text style={styles.locationButtonText}>
              {cargando
                ? 'Obteniendo ubicación...'
                : 'Obtener mi ubicación'}
            </Text>
          </TouchableOpacity>
        </View>

        {ubicacion && (
          <View style={styles.resultCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={31}
              color={COLORS.green}
            />

            <Text style={styles.resultTitle}>
              Ubicación obtenida correctamente
            </Text>

            <Text style={styles.resultLabel}>
              Latitud
            </Text>

            <Text style={styles.resultValue}>
              {ubicacion.latitud}
            </Text>

            <Text style={styles.resultLabel}>
              Longitud
            </Text>

            <Text style={styles.resultValue}>
              {ubicacion.longitud}
            </Text>

            <Text style={styles.resultLabel}>
              Precisión aproximada
            </Text>

            <Text style={styles.resultValue}>
              {ubicacion.precision !== null
                ? `${Math.round(ubicacion.precision)} metros`
                : 'No disponible'}
            </Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={27}
              color={COLORS.red}
            />

            <Text style={styles.errorTitle}>
              No fue posible obtener la ubicación
            </Text>

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 55 : 75,
    paddingHorizontal: 22,
    paddingBottom: 30,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(39,196,232,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D6E4F2',
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 18,
    paddingBottom: 50,
  },

  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },

  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 15,
    marginBottom: 10,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.secondary,
  },

  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },

  description: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.secondary,
    marginBottom: 20,
  },

  locationButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  disabledButton: {
    opacity: 0.65,
  },

  locationButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  resultCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#BBE7CA',
    marginBottom: 18,
  },

  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.green,
    marginTop: 10,
    marginBottom: 18,
  },

  resultLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 5,
  },

  resultValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 15,
  },

  errorCard: {
    backgroundColor: '#FFF1F0',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.red,
    marginTop: 10,
    marginBottom: 10,
  },

  errorText: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.red,
  },
});
