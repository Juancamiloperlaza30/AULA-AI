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

import * as DocumentPicker
  from 'expo-document-picker';
import {
  File,
  UploadType,
} from 'expo-file-system';

const ProfileDashboardHeader = ({
  apiUrl,
  accessToken,
  onOpenProfile,
  children,
}) => {
  const [
    perfil,
    setPerfil,
  ] = useState(null);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    subiendoFoto,
    setSubiendoFoto,
  ] = useState(false);

  const cargarPerfil =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `${apiUrl}/api/profile/me`,
              {
                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.message ||
                'No fue posible consultar el perfil.'
            );
          }

          setPerfil(
            data.perfil
          );
        } catch (error) {
          console.log(
            'Error cargando perfil:',
            error
          );
        } finally {
          setCargando(false);
        }
      },
      [
        accessToken,
        apiUrl,
      ]
    );

  useEffect(() => {
    Promise.resolve().then(
      cargarPerfil
    );
  }, [cargarPerfil]);

  const obtenerIniciales =
    () => {
      if (!perfil) {
        return 'U';
      }

      const nombre =
        perfil.nombres
          ?.trim()
          ?.charAt(0) || '';

      const apellido =
        perfil.apellidos
          ?.trim()
          ?.charAt(0) || '';

      return `${nombre}${apellido}`
        .toUpperCase();
    };

  const formatearRol =
    (rol) => {
      if (!rol) {
        return '';
      }

      return (
        rol.charAt(0).toUpperCase() +
        rol.slice(1)
      );
    };

  const subirFoto =
    async (imagen) => {
      try {
        setSubiendoFoto(
          true
        );

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
          data =
            resultadoSubida.body
              ? JSON.parse(
                  resultadoSubida.body
                )
              : {};
        } catch (errorJson) {
          console.error(
            'Respuesta no JSON al subir foto de perfil:',
            errorJson
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

        await cargarPerfil();
      } catch (error) {
        console.log(
          'Error subiendo foto:',
          error
        );

        Alert.alert(
          'Error',
          error.message ||
            'No fue posible actualizar la foto de perfil.'
        );
      } finally {
        setSubiendoFoto(
          false
        );
      }
    };

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

  const seleccionarFoto =
    async () => {
      try {
        let imagePicker = null;

        try {
          imagePicker =
            await import(
              'expo-image-picker'
            );
        } catch (error) {
          console.warn(
            'ImagePicker no está disponible en este runtime; se usará el selector de documentos.',
            error
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
            permiso.status !==
            'granted'
          ) {
            Alert.alert(
              'Permiso requerido',
              'Debes permitir el acceso a tus fotos para seleccionar una imagen de perfil.'
            );

            return;
          }

          const resultado =
            await imagePicker
              .launchImageLibraryAsync({
                mediaTypes:
                  ['images'],

                allowsEditing:
                  true,

                aspect:
                  [1, 1],

                quality:
                  0.8,
              });

          if (
            resultado.canceled
          ) {
            return;
          }

          const imagen =
            resultado.assets[0];

          await subirFoto(
            imagen
          );
        } catch (error) {
          const mensaje =
            String(error?.message || error);

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

          console.warn(
            'ImagePicker no está integrado en este runtime; se usará el selector de documentos.',
            error
          );

          await seleccionarConDocumentPicker();
        }
      } catch (error) {
        console.log(
          'Error seleccionando imagen:',
          error
        );

        Alert.alert(
          'Error',
          'No fue posible seleccionar la imagen.'
        );
      }
    };

  if (cargando) {
    return (
      <View
        style={
          styles.loading
        }
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.profileRow
        }
      >
        <TouchableOpacity
          style={
            styles.avatarContainer
          }
          onPress={
            seleccionarFoto
          }
          disabled={
            subiendoFoto
          }
        >
          {perfil?.fotoPerfilUrl ? (
            <Image
              source={{
                uri:
                  perfil.fotoPerfilUrl,
              }}
              style={
                styles.avatar
              }
            />
          ) : (
            <View
              style={
                styles.initialAvatar
              }
            >
              <Text
                style={
                  styles.initialText
                }
              >
                {
                  obtenerIniciales()
                }
              </Text>
            </View>
          )}

          <View
            style={
              styles.cameraBadge
            }
          >
            <Text
              style={
                styles.cameraText
              }
            >
              +
            </Text>
          </View>

          {subiendoFoto && (
            <View
              style={
                styles.uploadOverlay
              }
            >
              <ActivityIndicator
                size="small"
              />
            </View>
          )}
        </TouchableOpacity>

        <View
          style={
            styles.userInfo
          }
        >
          <Text
            style={
              styles.welcome
            }
          >
            Bienvenido
          </Text>

          <Text
            style={
              styles.name
            }
          >
            {perfil?.nombres}{' '}
            {perfil?.apellidos}
          </Text>

          <View
            style={
              styles.roleBadge
            }
          >
            <Text
              style={
                styles.roleText
              }
            >
              {formatearRol(
                perfil?.rol
              )}
            </Text>
          </View>

          <Text
            style={
              styles.email
            }
          >
            {perfil?.correo}
          </Text>
        </View>
      </View>

      {children ? (
        <View
          style={
            styles.extraContent
          }
        >
          {children}
        </View>
      ) : null}

      {onOpenProfile ? (
        <TouchableOpacity
          style={
            styles.profileButton
          }
          onPress={
            onOpenProfile
          }
        >
          <Text
            style={
              styles.profileButtonText
            }
          >
            Ver mi perfil
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles =
  StyleSheet.create({
    container: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 24,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor:
        '#E6EBF2',
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
      backgroundColor:
        '#E9EEF5',
      justifyContent:
        'center',
      alignItems:
        'center',
    },

    initialText: {
      fontSize: 27,
      fontWeight: '900',
      color:
        '#2D405D',
    },

    cameraBadge: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 29,
      height: 29,
      borderRadius: 10,
      backgroundColor:
        '#2D405D',
      borderWidth: 3,
      borderColor:
        '#FFFFFF',
      justifyContent:
        'center',
      alignItems:
        'center',
    },

    cameraText: {
      color:
        '#FFFFFF',
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
      justifyContent:
        'center',
      alignItems:
        'center',
    },

    userInfo: {
      flex: 1,
    },

    welcome: {
      fontSize: 12,
      color:
        '#7B8794',
      fontWeight: '600',
    },

    name: {
      marginTop: 3,
      fontSize: 21,
      fontWeight: '900',
      color:
        '#1B2733',
    },

    roleBadge: {
      alignSelf:
        'flex-start',
      marginTop: 7,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor:
        '#E9EEF5',
    },

    roleText: {
      fontSize: 11,
      fontWeight: '800',
      color:
        '#2D405D',
      textTransform:
        'uppercase',
    },

    email: {
      marginTop: 8,
      fontSize: 12,
      color:
        '#607D8B',
    },

    extraContent: {
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor:
        '#EEF1F5',
    },

    profileButton: {
      marginTop: 16,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor:
        '#F0F4F8',
      alignItems:
        'center',
    },

    profileButtonText: {
      color:
        '#2D405D',
      fontWeight: '800',
      fontSize: 13,
    },

    loading: {
      minHeight: 120,
      justifyContent:
        'center',
      alignItems:
        'center',
    },
  });

export default ProfileDashboardHeader;
