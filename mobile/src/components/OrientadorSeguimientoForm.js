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
  registrarSeguimientoOrientador,
} from '../services/orientadorAlertService';

const TIPOS_INTERVENCION = [
  {
    valor: 'observacion',
    etiqueta: 'Observación académica',
  },
  {
    valor: 'entrevista',
    etiqueta: 'Entrevista',
  },
  {
    valor: 'contacto_acudiente',
    etiqueta: 'Contacto con acudiente',
  },
  {
    valor: 'plan_mejora',
    etiqueta: 'Plan de mejoramiento',
  },
  {
    valor: 'remision',
    etiqueta: 'Remisión',
  },
];

function validarFecha(fecha) {
  if (!fecha) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const valor = new Date(
    `${fecha}T00:00:00Z`
  );

  return (
    !Number.isNaN(valor.getTime()) &&
    valor.toISOString().slice(0, 10) === fecha
  );
}

function mostrarMensaje(titulo, mensaje) {
  if (Platform.OS === 'web') {
    window.alert(`${titulo}\n\n${mensaje}`);
    return;
  }

  Alert.alert(titulo, mensaje);
}

export default function OrientadorSeguimientoForm({
  alertaId,
  apiUrl,
  accessToken,
  estadoAlerta,
  onRegistrado,
}) {
  const [tipo, setTipo] =
    useState('observacion');

  const [observacion, setObservacion] =
    useState('');

  const [proximaRevision, setProximaRevision] =
    useState('');

  const [guardando, setGuardando] =
    useState(false);

  const alertaResuelta =
    estadoAlerta === 'resuelta';

  const registrar = async () => {
    if (guardando || alertaResuelta) {
      return;
    }

    const texto = observacion.trim();
    const fecha = proximaRevision.trim();

    if (
      texto.length < 1 ||
      texto.length > 3000
    ) {
      mostrarMensaje(
        'Observación no válida',
        'Escribe una observación de entre ' +
        '1 y 3000 caracteres.'
      );
      return;
    }

    if (!validarFecha(fecha)) {
      mostrarMensaje(
        'Fecha no válida',
        'La próxima revisión debe tener ' +
        'el formato AAAA-MM-DD y ser válida.'
      );
      return;
    }

    setGuardando(true);

    try {
      await registrarSeguimientoOrientador({
        apiUrl,
        accessToken,
        alertaId,
        tipoIntervencion: tipo,
        observacion: texto,
        proximaRevision: fecha || null,
      });

      setObservacion('');
      setProximaRevision('');

      mostrarMensaje(
        'Seguimiento registrado',
        'La intervención académica se ' +
        'guardó correctamente.'
      );

      if (typeof onRegistrado === 'function') {
        await onRegistrado();
      }
    } catch (error) {
      mostrarMensaje(
        'No fue posible registrar',
        error.message ||
        'Ocurrió un error inesperado.'
      );
    } finally {
      setGuardando(false);
    }
  };

  if (alertaResuelta) {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>
          Registrar intervención
        </Text>

        <Text style={styles.aviso}>
          Esta alerta está resuelta.
          No se permiten nuevas intervenciones.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>
        Registrar intervención
      </Text>

      <Text style={styles.descripcion}>
        Registra las acciones de orientación
        realizadas para acompañar al estudiante.
      </Text>

      <Text style={styles.etiqueta}>
        Tipo de intervención
      </Text>

      <View style={styles.opciones}>
        {TIPOS_INTERVENCION.map((opcion) => {
          const seleccionado =
            tipo === opcion.valor;

          return (
            <TouchableOpacity
              key={opcion.valor}
              style={[
                styles.opcion,
                seleccionado &&
                  styles.opcionSeleccionada,
              ]}
              onPress={() =>
                setTipo(opcion.valor)
              }
              disabled={guardando}
              accessibilityRole="radio"
              accessibilityState={{
                selected: seleccionado,
              }}
            >
              <Text
                style={[
                  styles.opcionTexto,
                  seleccionado &&
                    styles.opcionTextoSeleccionada,
                ]}
              >
                {opcion.etiqueta}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.etiqueta}>
        Observación
      </Text>

      <TextInput
        style={styles.observacionInput}
        placeholder={
          'Describe la intervención realizada...'
        }
        placeholderTextColor="#98A2B3"
        multiline
        textAlignVertical="top"
        maxLength={3000}
        value={observacion}
        onChangeText={setObservacion}
        editable={!guardando}
      />

      <Text style={styles.contador}>
        {observacion.length}/3000 caracteres
      </Text>

      <Text style={styles.etiqueta}>
        Próxima revisión (opcional)
      </Text>

      <TextInput
        style={styles.fechaInput}
        placeholder="AAAA-MM-DD"
        placeholderTextColor="#98A2B3"
        value={proximaRevision}
        onChangeText={setProximaRevision}
        maxLength={10}
        editable={!guardando}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />

      <TouchableOpacity
        style={[
          styles.guardarBoton,
          guardando &&
            styles.guardarBotonDeshabilitado,
        ]}
        onPress={registrar}
        disabled={guardando}
        accessibilityRole="button"
      >
        {guardando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.guardarTexto}>
            Guardar intervención
          </Text>
        )}
      </TouchableOpacity>
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
    marginBottom: 10,
  },

  descripcion: {
    fontSize: 13,
    lineHeight: 20,
    color: '#667085',
    marginBottom: 18,
  },

  etiqueta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#344054',
    marginBottom: 9,
    marginTop: 12,
  },

  opciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  opcion: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  opcionSeleccionada: {
    borderColor: '#2563EB',
    backgroundColor: '#EEF4FF',
  },

  opcionTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475467',
  },

  opcionTextoSeleccionada: {
    color: '#2563EB',
  },

  observacionInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1D2A3A',
    backgroundColor: '#FFFFFF',
  },

  contador: {
    fontSize: 11,
    color: '#667085',
    textAlign: 'right',
    marginTop: 6,
  },

  fechaInput: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1D2A3A',
  },

  guardarBoton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },

  guardarBotonDeshabilitado: {
    opacity: 0.65,
  },

  guardarTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  aviso: {
    backgroundColor: '#F2F4F7',
    color: '#667085',
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    lineHeight: 20,
  },
});
