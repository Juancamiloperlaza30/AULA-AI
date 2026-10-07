import { useState } from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ResetPasswordScreen({
  onActualizarPassword,
  onCancelar,
}) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] =
    useState('');

  const handleGuardar = async () => {
    if (!password.trim()) {
      Alert.alert(
        'Campo obligatorio',
        'Ingrese la nueva contraseña.'
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Contraseña no válida',
        'La contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    if (password !== confirmacion) {
      Alert.alert(
        'Las contraseñas no coinciden',
        'Verifique la confirmación de la contraseña.'
      );
      return;
    }

    await onActualizarPassword(password);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Nueva contraseña
      </Text>

      <Text style={styles.subtitle}>
        Establezca una nueva contraseña para su cuenta de AULA-AI.
      </Text>

      <Text style={styles.label}>
        Nueva contraseña
      </Text>

      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Ingrese la nueva contraseña"
      />

      <Text style={styles.label}>
        Confirmar contraseña
      </Text>

      <TextInput
        style={styles.input}
        secureTextEntry
        value={confirmacion}
        onChangeText={setConfirmacion}
        placeholder="Repita la nueva contraseña"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleGuardar}
      >
        <Text style={styles.buttonText}>
          Actualizar contraseña
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onCancelar}
      >
        <Text style={styles.cancelText}>
          Cancelar
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1F4E79',
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: '#5F6B7A',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#263238',
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 20,
  },

  button: {
    backgroundColor: '#1F4E79',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },

  cancelText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#607D8B',
    fontSize: 14,
  },
});
