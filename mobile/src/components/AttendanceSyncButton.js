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
    useState(null);

  const [sincronizando, setSincronizando] =
    useState(false);

  const [estadoConsulta, setEstadoConsulta] =
    useState('cargando');

  const consultaId = useRef(0);

  const consultarPendientes = useCallback(
    async () => {
      const idConsulta = ++consultaId.current;
      const usuarioConsulta = usuarioId;

      setEstadoConsulta('cargando');

      if (!usuarioConsulta) {
        setPendientes(null);
        setEstadoConsulta('error');

        if (__DEV__) {
          console.warn(
            '[HU-14] No se consultó la cola de asistencia:',
            {
              docenteIdUltimos4: 'ausente',
              error: 'Identificador de docente ausente.',
            }
          );
        }

        return;
      }

      try {
        const total =
          await contarAsistenciasPendientes(
            usuarioConsulta
          );

        if (idConsulta !== consultaId.current) {
          return;
        }

        if (
          !Number.isSafeInteger(total) ||
          total < 0
        ) {
          throw new Error(
            'SQLite devolvió un conteo inválido.'
          );
        }

        setPendientes(total);
        setEstadoConsulta('listo');

        if (__DEV__) {
          console.info(
            '[HU-14] Conteo local de asistencia:',
            {
              docenteIdUltimos4:
                String(usuarioConsulta).slice(-4),
              pendientes: total,
            }
          );
        }
      } catch (error) {
        if (idConsulta !== consultaId.current) {
          return;
        }

        setPendientes(null);
        setEstadoConsulta('error');

        if (__DEV__) {
          console.warn(
            '[HU-14] Error leyendo la cola de asistencia:',
            {
              docenteIdUltimos4:
                String(usuarioConsulta).slice(-4),
              error: error?.message || 'Error desconocido.',
            }
          );
        }
      }
    },
    [usuarioId]
  );

  useEffect(() => {
    const temporizador = setTimeout(() => {
      void consultarPendientes();
    }, 0);

    return () => {
      clearTimeout(temporizador);
      consultaId.current += 1;
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

        {estadoConsulta === 'cargando' ? (
          <View style={styles.estadoConsulta}>
            <ActivityIndicator
              size="small"
              color="#1F4E79"
            />
            <Text style={styles.descripcion}>
              Cargando operaciones pendientes...
            </Text>
          </View>
        ) : estadoConsulta === 'error' ? (
          <Text style={styles.descripcion}>
            No fue posible consultar las operaciones pendientes.
          </Text>
        ) : pendientes === 0 ? (
          <Text style={styles.descripcion}>
            No hay operaciones pendientes.
          </Text>
        ) : (
          <Text style={styles.descripcion}>
            {pendientes} operación(es) sin confirmar en Supabase.
          </Text>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          onPress={consultarPendientes}
          disabled={
            estadoConsulta === 'cargando' ||
            !usuarioId
          }
          style={styles.consultarBoton}
        >
          <Text style={styles.consultarTexto}>
            {estadoConsulta === 'cargando'
              ? 'Consultando...'
              : 'Actualizar contador'}
          </Text>
        </TouchableOpacity>
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

  estadoConsulta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  consultarBoton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },

  consultarTexto: {
    color: '#1F4E79',
    fontSize: 12,
    fontWeight: '700',
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
