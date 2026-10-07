import { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ActivateAccountScreen({
  onActivate,
  onCancel,
}) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleActivate = async () => {
    if (!password.trim()) {
      Alert.alert(
        'Campo obligatorio',
        'Ingrese una contraseña.'
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

    try {
      setCargando(true);
      await onActivate(password);
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        AULA-AI
      </Text>

      <Text style={styles.title}>
        Activar cuenta
      </Text>

      <Text style={styles.subtitle}>
        Cree su contraseña para completar la activación de su cuenta.
      </Text>

      <Text style={styles.label}>
        Contraseña
      </Text>

      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 8 caracteres"
        editable={!cargando}
      />

      <Text style={styles.label}>
        Confirmar contraseña
      </Text>

      <TextInput
        style={styles.input}
        secureTextEntry
        value={confirmacion}
        onChangeText={setConfirmacion}
        placeholder="Repita su contraseña"
        editable={!cargando}
      />

      <TouchableOpacity
        style={[
          styles.button,
          cargando && styles.buttonDisabled,
        ]}
        onPress={handleActivate}
        disabled={cargando}
      >
        {cargando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            Activar cuenta
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onCancel}
        disabled={cargando}
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

  logo: {
    fontSize: 34,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F4E79',
    marginBottom: 15,
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#263238',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#607D8B',
    lineHeight: 22,
    marginBottom: 30,
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

  buttonDisabled: {
    opacity: 0.7,
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
  },
});