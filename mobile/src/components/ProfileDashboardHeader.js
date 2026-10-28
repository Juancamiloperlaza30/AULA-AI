
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import * as DocumentPicker
  from 'expo-document-picker';

import {
  File,
  UploadType,
} from 'expo-file-system';

import {
  obtenerSesion,
} from '../services/sessionService';

// ================================================
// AULA-AI | HU-07
// ENCABEZADO DE PERFIL ONLINE / OFFLINE
//
// Conserva:
// - Datos del usuario.
// - Foto de perfil.
// - Cambio de foto.
// - Rol institucional.
// - Contenido académico recibido como children.
// - Botón de acceso al perfil.
//
// Mejoras:
// - Muestra datos locales inmediatamente.
// - No bloquea el resumen académico.
// - Consulta el servidor con timeout.
// - Identifica los datos sin conexión.
// - Evita actualizar después de desmontarse.
// ================================================

const TIMEOUT_MS = 8000;

const obtenerIniciales = (perfil) => {
  const nombres = String(
    perfil?.nombres || ''
  ).trim();

  const apellidos = String(
    perfil?.apellidos || ''
  ).trim();

  const inicialNombre =
    nombres.charAt(0);

  const inicialApellido =
    apellidos.charAt(0);

  return (
    `${inicialNombre}${inicialApellido}`
      .toUpperCase() || 'U'
  );
};

const formatearRol = (rol) => {
  const valor = String(rol || '');

  if (!valor) return 'Usuario';

  return (
    valor.charAt(0).toUpperCase() +
    valor.slice(1)
  );
};

const normalizarPerfil = (datos) => {
  if (!datos) return null;

  return {
    ...datos,

    nombres:
      datos.nombres || '',

    apellidos:
      datos.apellidos || '',

    correo:
      datos.correo ||
      datos.email ||
      '',

    rol:
      datos.rol || '',

    fotoPerfilUrl:
      datos.fotoPerfilUrl ||
      datos.foto_perfil_url ||
      null,
  };
};

const consultarPerfilRemoto = async ({
  apiUrl,
  accessToken,
  signal,
}) => {
  const controller =
    new AbortController();

  const cancelar = () =>
    controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener(
        'abort',
        cancelar,
        { once: true }
      );
    }
  }

  let temporizador;

  try {
    const consulta = (async () => {
      const response = await fetch(
        `${apiUrl}/api/profile/me`,
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(
          data.message ||
          'No fue posible consultar el perfil.'
        );

        error.status = response.status;
        throw error;
      }

      if (!data.perfil) {
        throw new Error(
          'El servidor no devolvió un perfil válido.'
        );
      }

      return data.perfil;
    })();

    const controlada = consulta.then(
      (perfil) => ({
        tipo: 'ok',
        perfil,
      }),
      (error) => ({
        tipo: 'error',
        error,
      })
    );

    const limite = new Promise(
      (resolve) => {
        temporizador = setTimeout(
          () => {
            controller.abort();

            resolve({
              tipo: 'timeout',
            });
          },
          TIMEOUT_MS
        );
      }
    );

    const resultado = await Promise.race([
      controlada,
      limite,
    ]);

    if (resultado.tipo === 'timeout') {
      throw new Error(
        'El servidor no respondió a tiempo.'
      );
    }

    if (resultado.tipo === 'error') {
      throw resultado.error;
    }

    return resultado.perfil;
  } finally {
    clearTimeout(temporizador);

    if (signal) {
      signal.removeEventListener(
        'abort',
        cancelar
      );
    }
  }
};

export default function ProfileDashboardHeader({
  apiUrl,
  accessToken,
  onOpenProfile,
  children,
  studentPremium: studentPremiumRequested = false,
  guardianPremium = false,
  coordinatorPremium = false,
  orientadorPremium = false,
}) {
  const studentPremium =
    studentPremiumRequested ||
    guardianPremium ||
    coordinatorPremium ||
    orientadorPremium;

  const [perfil, setPerfil] =
    useState(null);

  const [origen, setOrigen] =
    useState(null);

  const [cargando, setCargando] =
    useState(true);

  const [
    subiendoFoto,
    setSubiendoFoto,
  ] = useState(false);

  const [aviso, setAviso] =
    useState('');

  const cargarPerfil = useCallback(
    async (signal) => {
      setCargando(true);
      setAviso('');

      let tienePerfilLocal = false;

      // ========================================
      // PASO 1: RECUPERAR PERFIL DE LA SESIÓN
      // ========================================

      try {
        const datos =
          await obtenerSesion();

        if (signal?.aborted) return;

        const tokenGuardado =
          datos?.session?.accessToken;

        const usuarioGuardado =
          datos?.usuario;

        // Únicamente utilizar la información
        // que corresponda al token de la sesión
        // activa. Evita mezclar cuentas.
        if (
          usuarioGuardado &&
          tokenGuardado &&
          tokenGuardado === accessToken
        ) {
          setPerfil(
            normalizarPerfil(
              usuarioGuardado
            )
          );

          setOrigen('local');
          tienePerfilLocal = true;

          // El contenido académico puede
          // mostrarse desde este momento.
          setCargando(false);
        }
      } catch (errorLocal) {
        console.log(
          'HU-07: perfil de sesión no disponible:',
          errorLocal.message
        );
      }

      if (signal?.aborted) return;

      // ========================================
      // PASO 2: ACTUALIZAR PERFIL ONLINE
      // ========================================

      try {
        if (!apiUrl || !accessToken) {
          throw new Error(
            'No existe una sesión válida.'
          );
        }

        const perfilRemoto =
          await consultarPerfilRemoto({
            apiUrl,
            accessToken,
            signal,
          });

        if (signal?.aborted) return;

        setPerfil(
          normalizarPerfil(
            perfilRemoto
          )
        );

        setOrigen('servidor');
        setAviso('');
      } catch (error) {
        if (signal?.aborted) return;

        console.log(
          'HU-07: perfil remoto no disponible:',
          error.message
        );

        if (
          error.status === 401 ||
          error.status === 403
        ) {
          // No mostrar información de perfil
          // si el servidor rechaza la sesión.
          setPerfil(null);
          setOrigen(null);

          setAviso(
            'Tu sesión debe validarse nuevamente.'
          );
        } else if (tienePerfilLocal) {
          setOrigen('local');

          setAviso(
            'Perfil recuperado desde la sesión guardada.'
          );
        } else {
          setAviso(
            'No fue posible cargar el perfil. Inténtalo cuando tengas conexión.'
          );
        }
      } finally {
        if (!signal?.aborted) {
          setCargando(false);
        }
      }
    },
    [
      apiUrl,
      accessToken,
    ]
  );

  // ================================================
  // CARGA INICIAL
  // ================================================

  useEffect(() => {
    const controller =
      new AbortController();

    cargarPerfil(controller.signal);

    return () => {
      controller.abort();
    };
  }, [cargarPerfil]);

  // ================================================
  // ACTUALIZACIÓN DE FOTO DE PERFIL
  // Se mantiene la funcionalidad original.
  // ================================================

  const subirFoto = async (imagen) => {
    if (!accessToken || !apiUrl) {
      Alert.alert(
        'Sesión no disponible',
        'Inicia sesión para actualizar tu foto.'
      );

      return;
    }

    try {
      setSubiendoFoto(true);

      const tipo =
        imagen.mimeType ||
        'image/jpeg';

      const archivo =
        new File(imagen.uri);

      const tareaSubida =
        archivo.createUploadTask(
          `${apiUrl}/api/profile/me/foto`,
          {
            httpMethod: 'PUT',
            uploadType:
              UploadType.MULTIPART,
            fieldName: 'foto',
            mimeType: tipo,
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

      const resultadoSubida =
        await tareaSubida.uploadAsync();

      let data = {};

      try {
        data = resultadoSubida.body
          ? JSON.parse(
              resultadoSubida.body
            )
          : {};
      } catch (errorJson) {
        console.log(
          'La respuesta de foto no es JSON:',
          errorJson.message
        );
      }

      if (
        resultadoSubida.status < 200 ||
        resultadoSubida.status >= 300
      ) {
        throw new Error(
          data.message ||
          'No fue posible actualizar la foto.'
        );
      }

      Alert.alert(
        'Perfil actualizado',
        'Foto de perfil actualizada correctamente.'
      );

      const controller =
        new AbortController();

      await cargarPerfil(
        controller.signal
      );
    } catch (error) {
      console.log(
        'Error subiendo foto:',
        error
      );

      Alert.alert(
        'No se pudo actualizar la foto',
        error.message ||
        'Comprueba tu conexión a internet.'
      );
    } finally {
      setSubiendoFoto(false);
    }
  };

  // ================================================
  // SELECCIÓN DE FOTOGRAFÍA
  // ================================================

  const seleccionarConDocumentPicker =
    async () => {
      const resultado =
        await DocumentPicker
          .getDocumentAsync({
            type: 'image/*',
            copyToCacheDirectory: true,
            multiple: false,
          });

      if (
        resultado.canceled ||
        !resultado.assets?.[0]
      ) {
        return;
      }

      await subirFoto(
        resultado.assets[0]
      );
    };

  const seleccionarFoto = async () => {
    if (subiendoFoto) return;

    try {
      let imagePicker = null;

      try {
        imagePicker =
          await import(
            'expo-image-picker'
          );
      } catch (error) {
        console.warn(
          'ImagePicker no está disponible:',
          error.message
        );
      }

      if (!imagePicker) {
        await seleccionarConDocumentPicker();
        return;
      }

      try {
        const permiso =
          await imagePicker
            .requestMediaLibraryPermissionsAsync();

        if (
          permiso.status !== 'granted'
        ) {
          Alert.alert(
            'Permiso requerido',
            'Debes permitir el acceso a tus fotos.'
          );

          return;
        }

        const resultado =
          await imagePicker
            .launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

        if (
          resultado.canceled ||
          !resultado.assets?.[0]
        ) {
          return;
        }

        await subirFoto(
          resultado.assets[0]
        );
      } catch (error) {
        const mensaje =
          String(
            error?.message ||
            error
          );

        if (
          !mensaje.includes(
            'ExponentImagePicker'
          ) &&
          !mensaje.includes(
            'Cannot find native module'
          )
        ) {
          throw error;
        }

        await seleccionarConDocumentPicker();
      }
    } catch (error) {
      console.log(
        'Error seleccionando foto:',
        error
      );

      Alert.alert(
        'Error',
        'No fue posible seleccionar la imagen.'
      );
    }
  };

  // ================================================
  // PRESENTACIÓN
  //
  // Nunca ocultar children durante la carga.
  // ================================================

  return (
    <View
      style={[
        styles.container,
        studentPremium &&
          styles.studentPremiumContainer,
      ]}
    >
      {studentPremium && (
        <View style={styles.studentPremiumHeading}>
          <View
            style={styles.studentPremiumHeadingIcon}
          >
            <Ionicons
              name={
                guardianPremium
                  ? 'people-outline'
                  : coordinatorPremium
                    ? 'git-network-outline'
                    : orientadorPremium
                      ? 'heart-outline'
                      : 'school-outline'
              }
              size={19}
              color="#27C4E8"
            />
          </View>

          <View
            style={styles.studentPremiumHeadingContent}
          >
            <Text style={styles.studentPremiumEyebrow}>
              {guardianPremium
                ? 'AULA-AI · PORTAL FAMILIAR'
                : coordinatorPremium
                  ? 'AULA-AI · GESTIÓN INSTITUCIONAL'
                  : orientadorPremium
                    ? 'AULA-AI · ORIENTACIÓN ACADÉMICA'
                    : 'AULA-AI · PORTAL ACADÉMICO'}
            </Text>

            <Text
              style={styles.studentPremiumHeadingTitle}
            >
              {guardianPremium
                ? 'Panel del acudiente'
                : coordinatorPremium
                  ? 'Panel del coordinador'
                  : orientadorPremium
                    ? 'Panel del orientador'
                    : 'Panel del estudiante'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.profileRow}>
        <TouchableOpacity
          style={[
            styles.avatarContainer,
            studentPremium &&
              styles.studentPremiumAvatarContainer,
          ]}
          onPress={seleccionarFoto}
          disabled={subiendoFoto}
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil"
        >
          {perfil?.fotoPerfilUrl ? (
            <Image
              source={{
                uri: perfil.fotoPerfilUrl,
              }}
              style={[
                styles.avatar,
                studentPremium &&
                  styles.studentPremiumAvatar,
              ]}
            />
          ) : (
            <View
              style={[
                styles.initialAvatar,
                studentPremium &&
                  styles.studentPremiumInitialAvatar,
              ]}
            >
              <Text
                style={[
                  styles.initialText,
                  studentPremium &&
                    styles.studentPremiumInitialText,
                ]}
              >
                {obtenerIniciales(
                  perfil
                )}
              </Text>
            </View>
          )}

          <View style={styles.cameraBadge}>
            <Text style={styles.cameraText}>
              +
            </Text>
          </View>

          {subiendoFoto && (
            <View
              style={[
                styles.uploadOverlay,
                studentPremium &&
                  styles.studentPremiumUploadOverlay,
              ]}
            >
              <ActivityIndicator
                size="small"
                color="#1F4E79"
              />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.userInfo}>
          <Text
            style={[
              styles.welcome,
              studentPremium &&
                styles.studentPremiumWelcome,
            ]}
          >
            Bienvenido
          </Text>

          <Text
            style={[
              styles.name,
              studentPremium &&
                styles.studentPremiumName,
            ]}
            numberOfLines={2}
          >
            {perfil
              ? `${perfil.nombres} ${perfil.apellidos}`.trim()
              : 'AULA-AI'}
          </Text>
          {perfil?.rol ? (
            <View
              style={[
                styles.roleBadge,
                studentPremium &&
                  styles.studentPremiumRoleBadge,
              ]}
            >
              <Text
                style={[
                  styles.roleText,
                  studentPremium &&
                    styles.studentPremiumRoleText,
                ]}
              >
                {formatearRol(
                  perfil.rol
                )}
              </Text>
            </View>
          ) : null}

          {perfil?.correo ? (
            <Text
              style={[
                styles.email,
                studentPremium &&
                  styles.studentPremiumEmail,
              ]}
              numberOfLines={2}
            >
              {perfil.correo}
            </Text>
          ) : null}
        </View>
      </View>

      {/* INDICADOR NO BLOQUEANTE */}

      <View style={styles.estadoFila}>
        <View
          style={[
            styles.estadoPunto,
            {
              backgroundColor:
                origen === 'servidor'
                  ? '#24855E'
                  : origen === 'local'
                    ? '#B9872F'
                    : '#9AA8B6',
            },
          ]}
        />

        <Text
          style={[
            styles.estadoTexto,
            studentPremium &&
              styles.studentPremiumEstadoTexto,
          ]}
        >
          {origen === 'servidor'
            ? 'Perfil actualizado'
            : origen === 'local'
              ? 'Perfil de sesión guardada'
              : 'Perfil pendiente de consulta'}
        </Text>

        {cargando && (
          <ActivityIndicator
            size="small"
            color="#1F4E79"
          />
        )}

        {!cargando &&
          origen !== 'servidor' && (
            <TouchableOpacity
              onPress={() =>
                cargarPerfil()
              }
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.reintentarTexto,
                  studentPremium &&
                    styles.studentPremiumReintentarTexto,
                ]}
              >
                Reintentar
              </Text>
            </TouchableOpacity>
          )}
      </View>

      {aviso &&
        origen !== 'servidor' ? (
          <Text
            style={[
              styles.aviso,
              studentPremium &&
                styles.studentPremiumAviso,
            ]}
          >
            {aviso}
          </Text>
        ) : null}

      {/* EL RESUMEN ACADÉMICO SIEMPRE
          SE MUESTRA, AUNQUE NO HAYA RED */}

      {children ? (
        <View
          style={[
            styles.extraContent,
            studentPremium &&
              styles.studentPremiumExtraContent,
          ]}
        >
          {children}
        </View>
      ) : null}

      {onOpenProfile ? (
        <TouchableOpacity
          style={[
            styles.profileButton,
            studentPremium &&
              styles.studentPremiumProfileButton,
          ]}
          onPress={onOpenProfile}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.profileButtonText,
              studentPremium &&
                styles.studentPremiumProfileButtonText,
            ]}
          >
            Ver mi perfil
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E6EBF2',
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatarContainer: {
    width: 82,
    height: 82,
    marginRight: 16,
    position: 'relative',
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 26,
  },

  initialAvatar: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: '#E9EEF5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  initialText: {
    fontSize: 27,
    fontWeight: '900',
    color: '#2D405D',
  },

  cameraBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: '#2D405D',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cameraText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 21,
  },

  uploadOverlay: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor:
      'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  userInfo: {
    flex: 1,
  },

  welcome: {
    fontSize: 12,
    color: '#7B8794',
    fontWeight: '600',
  },

  name: {
    marginTop: 3,
    fontSize: 21,
    fontWeight: '900',
    color: '#1B2733',
  },

  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#E9EEF5',
  },

  roleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D405D',
    textTransform: 'uppercase',
  },

  email: {
    marginTop: 8,
    fontSize: 12,
    color: '#607D8B',
  },

  estadoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },

  estadoPunto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  estadoTexto: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#718399',
  },

  reintentarTexto: {
    color: '#1F4E79',
    fontWeight: '800',
    fontSize: 11,
  },

  aviso: {
    marginTop: 9,
    fontSize: 11,
    color: '#92661F',
    lineHeight: 17,
  },

  extraContent: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },

  profileButton: {
    marginTop: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
  },

  profileButtonText: {
    color: '#2D405D',
    fontWeight: '800',
    fontSize: 13,
  },

  // ==========================================
  // AULA-AI | ESTUDIANTE PREMIUM
  // ==========================================

  studentPremiumContainer: {
    backgroundColor: '#091D3A',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    borderWidth: 0,
    elevation: 4,
    shadowColor: '#091D3A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  studentPremiumHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },

  studentPremiumHeadingIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#17375B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  studentPremiumHeadingContent: {
    flex: 1,
  },

  studentPremiumEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78DDF1',
    letterSpacing: 1.1,
    marginBottom: 4,
  },

  studentPremiumHeadingTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  studentPremiumAvatarContainer: {
    width: 68,
    height: 68,
    marginRight: 13,
  },

  studentPremiumAvatar: {
    width: 68,
    height: 68,
    borderRadius: 20,
  },

  studentPremiumInitialAvatar: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#23486D',
  },

  studentPremiumInitialText: {
    fontSize: 23,
    color: '#FFFFFF',
  },

  studentPremiumWelcome: {
    fontSize: 11,
    color: '#B8CADF',
  },

  studentPremiumName: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 3,
  },

  studentPremiumRoleBadge: {
    backgroundColor: '#173E62',
    marginTop: 8,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },

  studentPremiumRoleText: {
    color: '#80DDF1',
    fontSize: 10,
  },

  studentPremiumEmail: {
    color: '#C5D5E5',
    fontSize: 11,
    marginTop: 8,
  },

  studentPremiumUploadOverlay: {
    width: 68,
    height: 68,
    borderRadius: 20,
  },

  studentPremiumEstadoTexto: {
    color: '#C5D5E5',
  },

  studentPremiumReintentarTexto: {
    color: '#80DDF1',
  },

  studentPremiumAviso: {
    color: '#F6D38A',
  },

  studentPremiumExtraContent: {
    borderTopColor: 'rgba(255,255,255,0.12)',
  },

  studentPremiumProfileButton: {
    backgroundColor: '#17375B',
  },

  studentPremiumProfileButtonText: {
    color: '#80DDF1',
  },
});
