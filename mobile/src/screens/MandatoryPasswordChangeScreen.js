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

const MandatoryPasswordChangeScreen = ({
  usuario,
  apiUrl,
  accessToken,
  onPasswordChanged,
  onLogout,
}) => {
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

  const cambiarContrasena =
    async () => {
      if (!nuevaContrasena.trim()) {
        Alert.alert(
          'Campo obligatorio',
          'Ingrese una nueva contraseña.'
        );

        return;
      }

      if (
        nuevaContrasena.length < 8
      ) {
        Alert.alert(
          'Contraseña no segura',
          'La nueva contraseña debe tener mínimo 8 caracteres.'
        );

        return;
      }

      if (
        nuevaContrasena !==
        confirmarContrasena
      ) {
        Alert.alert(
          'Las contraseñas no coinciden',
          'Verifique la nueva contraseña y su confirmación.'
        );

        return;
      }

      try {
        setGuardando(true);

        const response =
          await fetch(
            `${apiUrl}/api/auth/cambiar-password-inicial`,
            {
              method: 'PUT',

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                nuevaContrasena,
                confirmarContrasena,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              'No fue posible cambiar la contraseña.'
          );
        }

        Alert.alert(
          'Contraseña actualizada',
          'Tu contraseña fue cambiada correctamente.',
          [
            {
              text: 'Continuar',

              onPress: () => {
                onPasswordChanged();
              },
            },
          ]
        );
      } catch (error) {
        console.log(
          'Error cambiando contraseña:',
          error
        );

        Alert.alert(
          'No fue posible cambiar la contraseña',
          error.message ||
            'Intente nuevamente.'
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
          Cambia tu contraseña
        </Text>

        <Text style={styles.description}>
          Hola {usuario?.nombres}.
          Estás utilizando una contraseña
          temporal. Por seguridad debes
          crear una contraseña personal
          antes de continuar.
        </Text>

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

        <TouchableOpacity
          style={[
            styles.button,
            guardando &&
              styles.buttonDisabled,
          ]}
          onPress={
            cambiarContrasena
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
              Cambiar contraseña
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onLogout}
          disabled={guardando}
        >
          <Text
            style={
              styles.logoutText
            }
          >
            Cerrar sesión
          </Text>
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

    button: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: '#1D4E7A',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 6,
    },

    buttonDisabled: {
      opacity: 0.6,
    },

    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },

    logoutText: {
      textAlign: 'center',
      color: '#6B7C8F',
      fontSize: 14,
      fontWeight: '600',
      marginTop: 22,
    },
  });

export default MandatoryPasswordChangeScreen;
