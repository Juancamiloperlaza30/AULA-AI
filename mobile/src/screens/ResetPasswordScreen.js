import React, {
  useState,
} from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

const ResetPasswordScreen = ({
  apiUrl,
  recoveryEmail,
  recoverySession,
  onPasswordChanged,
}) => {
  const [
    codigoRecuperacion,
    setCodigoRecuperacion,
  ] = useState('');

  const [
    nuevaContrasena,
    setNuevaContrasena,
  ] = useState('');

  const [
    confirmarContrasena,
    setConfirmarContrasena,
  ] = useState('');

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const finalizarRecuperacion = async () => {
    try {
      await onPasswordChanged();
    } catch (error) {
      console.error(
        'Error finalizando recuperación:',
        error
      );

      Alert.alert(
        'Aviso',
        'La contraseña cambió, pero no fue posible volver al inicio de sesión.'
      );
    }
  };

  const cambiarPassword = async () => {
    if (guardando) {
      return;
    }

    if (!recoveryEmail?.trim()) {
      Alert.alert(
        'Correo no disponible',
        'Inicia nuevamente la recuperación desde la pantalla de acceso.'
      );
      return;
    }

    if (!codigoRecuperacion.trim()) {
      Alert.alert(
        'Código obligatorio',
        'Ingresa el código de recuperación que recibiste por correo.'
      );
      return;
    }

    if (!nuevaContrasena.trim()) {
      Alert.alert(
        'Campo obligatorio',
        'Ingrese una nueva contraseña.'
      );
      return;
    }

    if (!confirmarContrasena.trim()) {
      Alert.alert(
        'Campo obligatorio',
        'Confirme la nueva contraseña.'
      );
      return;
    }

    if (nuevaContrasena.length < 8) {
      Alert.alert(
        'Contraseña no segura',
        'La contraseña debe tener mínimo 8 caracteres.'
      );
      return;
    }

    if (
      !/[A-Z]/.test(nuevaContrasena) ||
      !/[a-z]/.test(nuevaContrasena) ||
      !/[0-9]/.test(nuevaContrasena)
    ) {
      Alert.alert(
        'Contraseña no segura',
        'Debe incluir al menos una mayúscula, una minúscula y un número.'
      );
      return;
    }

    if (nuevaContrasena !== confirmarContrasena) {
      Alert.alert(
        'Las contraseñas no coinciden',
        'Verifique la nueva contraseña y su confirmación.'
      );
      return;
    }

    try {
      setGuardando(true);

      const response = await fetch(
        `${apiUrl}/api/auth/completar-recuperacion-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: recoveryEmail.trim().toLowerCase(),
            codigo: codigoRecuperacion.trim(),
            nuevaContrasena,
            confirmarContrasena,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        if (data.code === 'PROFILE_UPDATE_FAILED') {
          Alert.alert(
            'Recuperación parcialmente completada',
            'La contraseña cambió, pero no se pudo actualizar el perfil institucional. Contacta al administrador antes de volver a intentarlo.'
          );
          return;
        }

        Alert.alert(
          'No fue posible cambiar la contraseña',
          data.message ||
            'Verifica el código o solicita una nueva recuperación.'
        );
        return;
      }

      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña fue restablecida correctamente. Ya puedes iniciar sesión con tu nueva contraseña.',
        [
          {
            text: 'Ir al inicio de sesión',
            onPress: finalizarRecuperacion,
          },
        ]
      );
    } catch (error) {
      console.error(
        'Error restableciendo contraseña:',
        error.message
      );

      Alert.alert(
        'Error de conexión',
        'No fue posible comunicarse con el servidor de AULA-AI.'
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.logo}>
          AULA-AI
        </Text>

        <Text style={styles.title}>
          Restablecer contraseña
        </Text>

        <Text style={styles.description}>
          Ingresa el código enviado a
          {` ${recoveryEmail || 'tu correo'}`}
          {' '}y crea una nueva contraseña
          segura para tu cuenta.
        </Text>

        <Text style={styles.label}>
          Código de recuperación
        </Text>

        <TextInput
          style={styles.input}
          value={codigoRecuperacion}
          onChangeText={setCodigoRecuperacion}
          placeholder="Código recibido por correo"
          keyboardType="number-pad"
          autoCapitalize="none"
          editable={!guardando}
        />

        <Text style={styles.label}>
          Nueva contraseña
        </Text>

        <TextInput
          style={styles.input}
          value={nuevaContrasena}
          onChangeText={
            setNuevaContrasena
          }
          placeholder="Nueva contraseña"
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.label}>
          Confirmar nueva contraseña
        </Text>

        <TextInput
          style={styles.input}
          value={confirmarContrasena}
          onChangeText={
            setConfirmarContrasena
          }
          placeholder="Repita la nueva contraseña"
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.help}>
          Mínimo 8 caracteres, una
          mayúscula, una minúscula y un
          número.
        </Text>

        <TouchableOpacity
          style={[
            styles.button,
            guardando &&
              styles.buttonDisabled,
          ]}
          onPress={
            cambiarPassword
          }
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles.buttonText
              }
            >
              Guardar nueva contraseña
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles =
  StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: '#F4F7FB',
    },

    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      padding: 24,
      elevation: 3,
    },

    logo: {
      fontSize: 18,
      fontWeight: '800',
      color: '#1D4E7A',
      marginBottom: 24,
    },

    title: {
      fontSize: 26,
      fontWeight: '800',
      color: '#172B4D',
      marginBottom: 12,
    },

    description: {
      fontSize: 15,
      lineHeight: 22,
      color: '#52667A',
      marginBottom: 26,
    },

    label: {
      fontSize: 14,
      fontWeight: '700',
      color: '#263D52',
      marginBottom: 7,
    },

    input: {
      height: 52,
      borderWidth: 1,
      borderColor: '#D8E0E8',
      borderRadius: 14,
      paddingHorizontal: 15,
      fontSize: 16,
      color: '#172B4D',
      backgroundColor: '#FAFBFC',
      marginBottom: 18,
    },

    help: {
      fontSize: 12,
      lineHeight: 18,
      color: '#75879A',
      marginBottom: 20,
    },

    button: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: '#1D4E7A',
      justifyContent: 'center',
      alignItems: 'center',
    },

    buttonDisabled: {
      opacity: 0.6,
    },

    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
  });

export default ResetPasswordScreen;
