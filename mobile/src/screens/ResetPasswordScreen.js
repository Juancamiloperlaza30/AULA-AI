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

import {
  supabase,
  supabaseConfigurado,
} from '../../supabaseClient';

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

  const [
    sesionVerificada,
    setSesionVerificada,
  ] = useState(Boolean(recoverySession));

  const finalizarRecuperacion =
    async () => {
      try {
        const {
          error,
        } = await supabase.auth.signOut();

        if (error) {
          console.error(
            'Error cerrando sesión de recuperación:',
            error.message
          );
        }
      } catch (error) {
        console.error(
          'Error cerrando sesión de recuperación:',
          error
        );
      } finally {
        await onPasswordChanged();
      }
    };

  const cambiarPassword =
    async () => {
      if (
        !supabaseConfigurado ||
        !supabase
      ) {
        Alert.alert(
          'Configuración incompleta',
          'La recuperación de contraseña no está disponible en esta versión de AULA-AI.'
        );

        return;
      }

      if (
        !recoverySession &&
        !sesionVerificada &&
        !codigoRecuperacion.trim()
      ) {
        Alert.alert(
          'Código obligatorio',
          'Ingresa el código de recuperación que recibiste por correo.'
        );

        return;
      }

      if (
        !nuevaContrasena.trim()
      ) {
        Alert.alert(
          'Campo obligatorio',
          'Ingrese una nueva contraseña.'
        );

        return;
      }

      if (
        !confirmarContrasena.trim()
      ) {
        Alert.alert(
          'Campo obligatorio',
          'Confirme la nueva contraseña.'
        );

        return;
      }

      if (
        nuevaContrasena.length < 8
      ) {
        Alert.alert(
          'Contraseña no segura',
          'La contraseña debe tener mínimo 8 caracteres.'
        );

        return;
      }

      const tieneMayuscula =
        /[A-Z]/.test(
          nuevaContrasena
        );

      const tieneMinuscula =
        /[a-z]/.test(
          nuevaContrasena
        );

      const tieneNumero =
        /[0-9]/.test(
          nuevaContrasena
        );

      if (
        !tieneMayuscula ||
        !tieneMinuscula ||
        !tieneNumero
      ) {
        Alert.alert(
          'Contraseña no segura',
          'Debe incluir al menos una mayúscula, una minúscula y un número.'
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

        if (
          !recoverySession &&
          !sesionVerificada
        ) {
          if (!recoveryEmail) {
            throw new Error(
              'No se encontró el correo asociado a la solicitud. Inicia nuevamente la recuperación.'
            );
          }

          const {
            data: recoveryData,
            error: recoveryError,
          } =
            await supabase.auth.verifyOtp({
              email: recoveryEmail,
              token:
                codigoRecuperacion.trim(),
              type: 'recovery',
            });

          if (recoveryError) {
            throw recoveryError;
          }

          if (!recoveryData?.session) {
            throw new Error(
              'El código no generó una sesión de recuperación válida. Verifica el código o solicita uno nuevo.'
            );
          }

          setSesionVerificada(true);
        }

        const {
          error: updateError,
        } =
          await supabase.auth.updateUser({
            password:
              nuevaContrasena,
          });

        if (updateError) {
          throw updateError;
        }

        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const recoveryAccessToken =
          sessionData?.session
            ?.access_token;

        if (!recoveryAccessToken) {
          throw new Error(
            'No se encontró la sesión segura de recuperación.'
          );
        }

        const response =
          await fetch(
            `${apiUrl}/api/auth/confirmar-recuperacion-password`,
            {
              method: 'PUT',
              headers: {
                Authorization:
                  `Bearer ${recoveryAccessToken}`,
                'Content-Type':
                  'application/json',
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          console.log(
            'Error sincronizando recuperación:',
            data
          );

          Alert.alert(
            'Contraseña actualizada',
            'La contraseña fue cambiada en Supabase, pero no fue posible finalizar la sincronización del perfil. Intente nuevamente.'
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
        console.log(
          'Error restableciendo contraseña:',
          error
        );

        Alert.alert(
          'No fue posible cambiar la contraseña',
          error.message ||
            'El código puede ser incorrecto o haber vencido. Solicita una nueva recuperación.'
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

        {!recoverySession &&
          !sesionVerificada && (
            <>
              <Text style={styles.label}>
                Código de recuperación
              </Text>

              <TextInput
                style={styles.input}
                value={codigoRecuperacion}
                onChangeText={
                  setCodigoRecuperacion
                }
                placeholder="Código recibido por correo"
                keyboardType="number-pad"
                autoCapitalize="none"
                editable={!guardando}
              />
            </>
          )}

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
