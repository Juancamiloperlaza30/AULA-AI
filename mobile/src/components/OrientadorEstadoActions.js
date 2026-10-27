import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  iniciarSeguimientoOrientador,
  cerrarAlertaOrientador,
} from '../services/orientadorAlertService';

function mostrarMensaje(titulo, mensaje) {
  if (Platform.OS === 'web') {
    window.alert(`${titulo}\n\n${mensaje}`);
    return;
  }

  Alert.alert(titulo, mensaje);
}

function confirmarAccion(titulo, mensaje, accion, textoAccion, destructiva = false) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) {
      void accion();
    }
    return;
  }

  Alert.alert(
    titulo,
    mensaje,
    [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: textoAccion,
        style: destructiva ? 'destructive' : 'default',
        onPress: () => {
          void accion();
        },
      },
    ]
  );
}

export default function OrientadorEstadoActions({
  alertaId,
  estadoAlerta,
  apiUrl,
  accessToken,
  onActualizado,
}) {
  const [procesando, setProcesando] =
    useState(false);

  const [mostrarCierre, setMostrarCierre] =
    useState(false);

  const [motivo, setMotivo] =
    useState('');

  const actualizar = async () => {
    if (typeof onActualizado === 'function') {
      await onActualizado();
    }
  };

  const ejecutarInicio = async () => {
    setProcesando(true);

    try {
      await iniciarSeguimientoOrientador({
        apiUrl,
        accessToken,
        alertaId,
      });

      await actualizar();

      mostrarMensaje(
        'Seguimiento iniciado',
        'La alerta ahora se encuentra ' +
          'en seguimiento.'
      );
    } catch (error) {
      mostrarMensaje(
        'No fue posible iniciar',
        error.message ||
          'Ocurrió un error inesperado.'
      );
    } finally {
      setProcesando(false);
    }
  };

  const iniciarSeguimiento = () => {
    if (
      procesando ||
      estadoAlerta !== 'activa'
    ) {
      return;
    }

    confirmarAccion(
      'Iniciar seguimiento',
      '¿Confirmas que deseas iniciar el ' +
        'seguimiento académico de esta alerta?',
      ejecutarInicio,
      'Iniciar'
    );
  };

  const ejecutarCierre = async (motivoLimpio) => {
    setProcesando(true);

    try {
      await cerrarAlertaOrientador({
        apiUrl,
        accessToken,
        alertaId,
        motivo: motivoLimpio,
      });

      setMotivo('');
      setMostrarCierre(false);

      await actualizar();

      mostrarMensaje(
        'Alerta resuelta',
        'El cierre manual se registró ' +
          'correctamente.'
      );
    } catch (error) {
      mostrarMensaje(
        'No fue posible cerrar',
        error.message ||
          'Ocurrió un error inesperado.'
      );
    } finally {
      setProcesando(false);
    }
  };

  const confirmarCierre = () => {
    if (
      procesando ||
      estadoAlerta !== 'en_seguimiento'
    ) {
      return;
    }

    const motivoLimpio = motivo.trim();

    if (
      motivoLimpio.length < 10 ||
      motivoLimpio.length > 2000
    ) {
      mostrarMensaje(
        'Motivo no válido',
        'El motivo de cierre debe tener ' +
          'entre 10 y 2000 caracteres.'
      );
      return;
    }

    confirmarAccion(
      'Confirmar cierre manual',
      'Esta acción marcará la alerta como ' +
        'resuelta e impedirá registrar nuevas ' +
        'intervenciones. ¿Deseas continuar?',
      () => ejecutarCierre(motivoLimpio),
      'Cerrar alerta',
      true
    );
  };

  if (estadoAlerta === 'resuelta') {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>
          Gestión del caso
        </Text>

        <View style={styles.resuelta}>
          <Text style={styles.resueltaTitulo}>
            Alerta resuelta
          </Text>

          <Text style={styles.resueltaTexto}>
            Este caso ya fue resuelto.
            No se permiten nuevas acciones
            de seguimiento ni cierre.
          </Text>
        </View>
      </View>
    );
  }

  if (estadoAlerta === 'activa') {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>
          Gestión del caso
        </Text>

        <Text style={styles.descripcion}>
          Esta alerta está activa.
          Inicia el seguimiento para registrar
          formalmente su atención.
        </Text>

        <TouchableOpacity
          style={styles.botonPrincipal}
          onPress={iniciarSeguimiento}
          disabled={procesando}
          accessibilityRole="button"
        >
          {procesando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.botonPrincipalTexto}>
              Iniciar seguimiento
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (estadoAlerta !== 'en_seguimiento') {
    return null;
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>
        Gestión del caso
      </Text>

      <View style={styles.estadoCard}>
        <Text style={styles.estadoTitulo}>
          Seguimiento en curso
        </Text>

        <Text style={styles.descripcion}>
          El caso está siendo atendido.
          Registra las intervenciones necesarias
          antes de realizar su cierre.
        </Text>
      </View>

      {!mostrarCierre ? (
        <TouchableOpacity
          style={styles.abrirCierreBoton}
          onPress={() => setMostrarCierre(true)}
          disabled={procesando}
          accessibilityRole="button"
        >
          <Text style={styles.abrirCierreTexto}>
            Solicitar cierre manual
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.formularioCierre}>
          <Text style={styles.cierreTitulo}>
            Cierre manual de alerta
          </Text>

          <Text style={styles.descripcion}>
            Explica por qué consideras que
            el caso puede darse por resuelto.
          </Text>

          <TextInput
            style={styles.motivoInput}
            placeholder={
              'Escribe el motivo del cierre...'
            }
            placeholderTextColor="#98A2B3"
            multiline
            textAlignVertical="top"
            maxLength={2000}
            value={motivo}
            onChangeText={setMotivo}
            editable={!procesando}
          />

          <Text style={styles.contador}>
            {motivo.length}/2000 caracteres
          </Text>

          <TouchableOpacity
            style={styles.cerrarBoton}
            onPress={confirmarCierre}
            disabled={procesando}
            accessibilityRole="button"
          >
            {procesando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.cerrarTexto}>
                Confirmar cierre manual
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelarBoton}
            disabled={procesando}
            onPress={() => {
              setMostrarCierre(false);
              setMotivo('');
            }}
            accessibilityRole="button"
          >
            <Text style={styles.cancelarTexto}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 18,
    marginBottom: 16,
  },

  titulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1D2A3A',
    marginBottom: 12,
  },

  descripcion: {
    fontSize: 13,
    lineHeight: 20,
    color: '#667085',
    marginBottom: 14,
  },

  botonPrincipal: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },

  botonPrincipalTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  estadoCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },

  estadoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 6,
  },

  abrirCierreBoton: {
    borderWidth: 1,
    borderColor: '#D92D20',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },

  abrirCierreTexto: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '700',
  },

  formularioCierre: {
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E6EAF0',
  },

  cierreTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B42318',
    marginBottom: 8,
  },

  motivoInput: {
    minHeight: 125,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1D2A3A',
    textAlignVertical: 'top',
  },

  contador: {
    fontSize: 11,
    color: '#667085',
    textAlign: 'right',
    marginTop: 6,
  },

  cerrarBoton: {
    backgroundColor: '#D92D20',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },

  cerrarTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  cancelarBoton: {
    paddingVertical: 14,
    alignItems: 'center',
  },

  cancelarTexto: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '600',
  },

  resuelta: {
    backgroundColor: '#EAF7EE',
    borderRadius: 12,
    padding: 14,
  },

  resueltaTitulo: {
    color: '#167347',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },

  resueltaTexto: {
    color: '#475467',
    fontSize: 13,
    lineHeight: 20,
  },
});
