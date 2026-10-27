import React, {
  useCallback,
  useEffect,
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

import * as Network from 'expo-network';

import {
  contarAsistenciasPendientes,
} from '../database/attendanceOfflineDatabase';

import {
  sincronizarAsistenciasPendientes,
} from '../services/attendanceOfflineSync';

export default function AttendanceSyncButton({
  usuarioId,
  apiUrl,
  accessToken,
  onSincronizacionCompleta,
}) {
  const [pendientes, setPendientes] =
    useState(0);

  const [sincronizando, setSincronizando] =
    useState(false);

  const consultarPendientes = useCallback(
    async () => {
      if (!usuarioId) {
        setPendientes(0);
        return;
      }

      try {
        const total =
          await contarAsistenciasPendientes(
            usuarioId
          );

        setPendientes(total);
      } catch (error) {
        console.log(
          'HU-06: error consultando pendientes:',
          error.message
        );
      }
    },
    [usuarioId]
  );

  useEffect(() => {
    const temporizador = setTimeout(() => {
      consultarPendientes();
    }, 0);

    return () => {
      clearTimeout(temporizador);
    };
  }, [consultarPendientes]);

  const sincronizar = async () => {
    if (
      sincronizando ||
      !usuarioId ||
      !accessToken ||
      !apiUrl
    ) {
      return;
    }

    try {
      const red =
        await Network.getNetworkStateAsync();

      if (
        red.isConnected !== true ||
        red.isInternetReachable === false
      ) {
        Alert.alert(
          'Sin conexión',
          'Conéctate a internet para sincronizar las asistencias pendientes.'
        );
        return;
      }

      setSincronizando(true);

      const resultado =
        await sincronizarAsistenciasPendientes({
          usuarioId,
          apiUrl,
          accessToken,
        });

      await consultarPendientes();

      if (resultado.ocupada) {
        Alert.alert(
          'Sincronización en curso',
          'Ya existe un proceso de sincronización activo.'
        );
        return;
      }

      if (
        resultado.errores > 0 ||
        resultado.requierenRevision > 0
      ) {
        Alert.alert(
          'Sincronización parcial',
          `Sincronizadas: ${resultado.sincronizadas}\n` +
          `Con error: ${resultado.errores}\n` +
          `Requieren revisión: ${resultado.requierenRevision}\n\n` +
          'Las operaciones no confirmadas permanecen guardadas en SQLite.'
        );
      } else {
        Alert.alert(
          'Sincronización completada',
          `${resultado.sincronizadas} operación(es) sincronizada(s).`
        );
      }

      if (
        resultado.sincronizadas > 0 &&
        typeof onSincronizacionCompleta ===
          'function'
      ) {
        await onSincronizacionCompleta();
      }
    } catch (error) {
      Alert.alert(
        'No se pudo sincronizar',
        error.message ||
          'Ocurrió un error inesperado.'
      );
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.informacion}>
        <Text style={styles.titulo}>
          Sincronización de asistencia
        </Text>

        <Text style={styles.descripcion}>
          {pendientes === 0
            ? 'No hay operaciones pendientes.'
            : `${pendientes} operación(es) sin confirmar en Supabase.`}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.boton,
          sincronizando &&
            styles.botonDeshabilitado,
        ]}
        onPress={sincronizar}
        disabled={
          sincronizando ||
          !usuarioId ||
          !accessToken
        }
      >
        {sincronizando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.textoBoton}>
            Sincronizar pendientes
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#DFE6ED',
  },

  informacion: {
    marginBottom: 12,
  },

  titulo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F4E79',
  },

  descripcion: {
    fontSize: 13,
    color: '#607D8B',
    marginTop: 5,
    lineHeight: 19,
  },

  boton: {
    backgroundColor: '#1F4E79',
    borderRadius: 10,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  botonDeshabilitado: {
    opacity: 0.6,
  },

  textoBoton: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
