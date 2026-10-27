import React from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  navy: '#091D3A',
  primary: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#1D2939',
  secondary: '#667085',
  border: '#DDE5EF',
};

export default function LoginScreen({
  correo,
  setCorreo,
  contrasena,
  setContrasena,
  mostrarContrasena,
  setMostrarContrasena,
  cargando,
  onLogin,
  onForgotPassword,
}) {
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.navy}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO */}

        <View style={styles.header}>
          <View style={styles.headerDecorationOne} />
          <View style={styles.headerDecorationTwo} />

          <View style={styles.logoContainer}>
            <Ionicons
              name="school-outline"
              size={36}
              color={COLORS.white}
            />
          </View>

          <Text style={styles.brandName}>
            AULA<Text style={styles.brandAccent}>-AI</Text>
          </Text>

          <Text style={styles.brandSubtitle}>
            Plataforma inteligente de acompañamiento escolar
          </Text>

          <View style={styles.headerBadge}>
            <Ionicons
              name="sparkles-outline"
              size={15}
              color={COLORS.cyan}
            />

            <Text style={styles.headerBadgeText}>
              Educación conectada e inteligente
            </Text>
          </View>
        </View>

        {/* FORMULARIO */}

        <View style={styles.formSection}>
          <View style={styles.formCard}>
            <Text style={styles.welcomeTitle}>
              ¡Bienvenido!
            </Text>

            <Text style={styles.welcomeSubtitle}>
              Ingresa tus credenciales para acceder a tu
              espacio académico.
            </Text>

            {/* CORREO */}

            <Text style={styles.label}>
              Correo institucional
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={21}
                color={COLORS.secondary}
              />

              <TextInput
                style={styles.input}
                placeholder="usuario@institucion.edu"
                placeholderTextColor="#98A2B3"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                value={correo}
                onChangeText={setCorreo}
                editable={!cargando}
                accessibilityLabel="Correo institucional"
              />
            </View>

            {/* CONTRASEÑA */}

            <Text style={styles.label}>
              Contraseña
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={21}
                color={COLORS.secondary}
              />

              <TextInput
                style={styles.input}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#98A2B3"
                secureTextEntry={!mostrarContrasena}
                autoCapitalize="none"
                autoCorrect={false}
                value={contrasena}
                onChangeText={setContrasena}
                editable={!cargando}
                accessibilityLabel="Contraseña"
              />

              <TouchableOpacity
                style={styles.visibilityButton}
                onPress={() =>
                  setMostrarContrasena(!mostrarContrasena)
                }
                disabled={cargando}
                accessibilityRole="button"
                accessibilityLabel={
                  mostrarContrasena
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
                accessibilityState={{
                  selected: mostrarContrasena,
                }}
              >
                <Ionicons
                  name={
                    mostrarContrasena
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={22}
                  color={COLORS.secondary}
                />
              </TouchableOpacity>
            </View>

            {/* RECUPERAR CONTRASEÑA */}

            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={onForgotPassword}
              disabled={cargando}
              accessibilityRole="button"
            >
              <Text style={styles.forgotPassword}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            {/* BOTÓN PRINCIPAL */}

            <TouchableOpacity
              style={[
                styles.loginButton,
                cargando && styles.loginButtonDisabled,
              ]}
              onPress={onLogin}
              disabled={cargando}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {cargando ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <View style={styles.loginButtonContent}>
                  <Text style={styles.loginButtonText}>
                    Iniciar sesión
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={COLORS.white}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* INFORMACIÓN */}

            <View style={styles.securityInformation}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color="#16A34A"
              />

              <Text style={styles.securityText}>
                Acceso seguro a tu información académica
              </Text>
            </View>
          </View>

          {/* PIE DE PÁGINA */}

          <View style={styles.footer}>
            <Text style={styles.footerTitle}>
              AULA-AI
            </Text>

            <Text style={styles.footerDescription}>
              Sistema inteligente de alerta temprana
              y acompañamiento escolar
            </Text>

            <Text style={styles.footerCopyright}>
              © {new Date().getFullYear()} AULA-AI
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    flexGrow: 1,
  },

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 48 : 65,
    paddingBottom: 85,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },

  headerDecorationOne: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(39,196,232,0.08)',
    top: -100,
    right: -100,
  },

  headerDecorationTwo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -80,
    left: -70,
  },

  logoContainer: {
    width: 76,
    height: 76,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  brandName: {
    color: COLORS.white,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 1,
  },

  brandAccent: {
    color: COLORS.cyan,
  },

  brandSubtitle: {
    color: '#D6E4F2',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 290,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 30,
    marginTop: 20,
  },

  headerBadgeText: {
    color: '#E7F2FA',
    fontSize: 11,
    fontWeight: '600',
  },

  formSection: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -55,
  },

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 23,
    paddingVertical: 24,
    elevation: 6,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },

  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 7,
  },

  welcomeSubtitle: {
    fontSize: 14,
    color: COLORS.secondary,
    lineHeight: 21,
    marginBottom: 27,
  },

  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 9,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    minHeight: 55,
    marginBottom: 21,
  },

  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 13,
    marginLeft: 11,
    minWidth: 0,
  },

  visibilityButton: {
    width: 35,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -5,
    marginBottom: 25,
  },

  forgotPassword: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },

  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    minHeight: 55,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },

  loginButtonDisabled: {
    opacity: 0.65,
  },

  loginButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },

  securityInformation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 22,
  },

  securityText: {
    color: COLORS.secondary,
    fontSize: 11,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 25,
    paddingBottom: Platform.OS === 'android' ? 65 : 45,
    paddingHorizontal: 20,
  },

  footerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },

  footerDescription: {
    marginTop: 6,
    color: COLORS.secondary,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    maxWidth: 260,
  },

  footerCopyright: {
    marginTop: 12,
    color: '#98A2B3',
    fontSize: 11,
  },
});
