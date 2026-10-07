import { useState } from 'react';

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';

import {
  File,
  UploadType,
} from 'expo-file-system';

const SubmitActivityScreen = ({
  apiUrl,
  accessToken,
  activity,
  onBack,
  onSubmitted,
}) => {
  const [comentario, setComentario] =
    useState('');

  const [linkExterno, setLinkExterno] =
    useState('');

  const [
    archivoSeleccionado,
    setArchivoSeleccionado,
  ] = useState(null);

  const [enviando, setEnviando] =
    useState(false);

  const seleccionarArchivo =
    async () => {
      try {
        const resultado =
          await DocumentPicker.getDocumentAsync({
            type: '*/*',
            multiple: false,
            copyToCacheDirectory: true,
          });

        if (resultado.canceled) {
          return;
        }

        const archivo =
          resultado.assets?.[0];

        if (!archivo) {
          return;
        }

        setArchivoSeleccionado({
          uri: archivo.uri,
          name: archivo.name,
          mimeType:
            archivo.mimeType ||
            'application/octet-stream',
          size:
            archivo.size || 0,
        });
      } catch (error) {
        console.log(
          'Error seleccionando archivo:',
          error
        );

        Alert.alert(
          'Error',
          'No fue posible seleccionar el archivo.'
        );
      }
    };

  const esperar = (ms) =>
    new Promise(
      (resolve) =>
        setTimeout(resolve, ms)
    );

  const fetchConReintentos =
    async (
      url,
      opciones,
      maxIntentos = 3
    ) => {
      let ultimoError = null;

      for (
        let intento = 1;
        intento <= maxIntentos;
        intento++
      ) {
        try {
          const response =
            await fetch(
              url,
              opciones
            );

          if (
            response.status >= 500 &&
            intento < maxIntentos
          ) {
            const espera =
              1000 *
              Math.pow(
                2,
                intento - 1
              );

            await esperar(
              espera
            );

            continue;
          }

          return response;
        } catch (error) {
          ultimoError =
            error;

          if (
            intento ===
            maxIntentos
          ) {
            throw error;
          }

          const espera =
            1000 *
            Math.pow(
              2,
              intento - 1
            );

          await esperar(
            espera
          );
        }
      }

      throw (
        ultimoError ||
        new Error(
          'No fue posible completar la solicitud.'
        )
      );
    };

  const enviarEntrega = async () => {
    if (
      !comentario.trim() &&
      !archivoSeleccionado &&
      !linkExterno.trim()
    ) {
      Alert.alert(
        'Entrega vacía',
        'Agrega un comentario, archivo o enlace antes de entregar.'
      );

      return;
    }

    try {
      setEnviando(true);

      // ==========================================
      // 1. REGISTRAR LA ENTREGA BASE
      // ==========================================

      const clientRequestId =
        Crypto.randomUUID();

      const responseEntrega =
        await fetchConReintentos(
          `${apiUrl}/api/activities/${activity.id}/entregas`,
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              comentario:
                comentario.trim(),
              clientRequestId,
            }),
          }
        );

      const dataEntrega =
        await responseEntrega.json();

      if (!responseEntrega.ok) {
        Alert.alert(
          'No fue posible entregar',
          dataEntrega.message ||
            'No fue posible registrar la entrega.'
        );

        return;
      }

      const entregaId =
        dataEntrega.entregaId ||
        dataEntrega.entrega?.id;

      if (!entregaId) {
        Alert.alert(
          'Error',
          'La entrega fue procesada, pero no se recibió su identificador.'
        );

        return;
      }

      const advertencias = [];

      // ==========================================
      // 2. SUBIR ARCHIVO
      // ==========================================

      if (archivoSeleccionado) {
        try {
          const archivo =
            new File(
              archivoSeleccionado.uri
            );

          const tareaSubida =
            archivo.createUploadTask(
              `${apiUrl}/api/activities/entregas/${entregaId}/recursos`,
              {
                httpMethod: 'POST',

                uploadType:
                  UploadType.MULTIPART,

                fieldName:
                  'archivo',

                mimeType:
                  archivoSeleccionado.mimeType ||
                  'application/octet-stream',

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              }
            );

          const resultadoSubida =
            await tareaSubida.uploadAsync();

          let dataArchivo = {};

          try {
            dataArchivo =
              resultadoSubida.body
                ? JSON.parse(
                    resultadoSubida.body
                  )
                : {};
          } catch (_errorJson) {
            console.log(
              'Respuesta no JSON al subir archivo:',
              resultadoSubida.body
            );
          }

          if (
            resultadoSubida.status < 200 ||
            resultadoSubida.status >= 300
          ) {
            advertencias.push(
              dataArchivo.message ||
                'El archivo no pudo ser adjuntado.'
            );
          }
        } catch (errorArchivo) {
          console.log(
            'Error subiendo archivo:',
            errorArchivo
          );

          advertencias.push(
            'El archivo no pudo ser adjuntado.'
          );
        }
      }

      // ==========================================
      // 3. GUARDAR LINK
      // ==========================================

      if (linkExterno.trim()) {
        try {
          const responseLink =
            await fetch(
              `${apiUrl}/api/activities/entregas/${entregaId}/enlaces`,
              {
                method: 'POST',

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,

                  'Content-Type':
                    'application/json',
                },

                body: JSON.stringify({
                  url:
                    linkExterno.trim(),

                  nombre:
                    'Enlace de entrega',
                }),
              }
            );

          const dataLink =
            await responseLink.json();

          if (!responseLink.ok) {
            advertencias.push(
              dataLink.message ||
                'El enlace no pudo ser guardado.'
            );
          }
        } catch (errorLink) {
          console.log(
            'Error guardando enlace:',
            errorLink
          );

          advertencias.push(
            'El enlace no pudo ser guardado.'
          );
        }
      }

      // ==========================================
      // 4. MOSTRAR RESULTADO REAL
      // ==========================================

      if (advertencias.length > 0) {
        Alert.alert(
          'Entrega registrada',
          `La actividad fue entregada correctamente, pero ocurrió lo siguiente:\n\n${advertencias.join(
            '\n'
          )}`,
          [
            {
              text: 'Aceptar',
              onPress:
                onSubmitted,
            },
          ]
        );

        return;
      }

      Alert.alert(
        'Éxito',
        dataEntrega.message ||
          'Entrega registrada con éxito.',
        [
          {
            text: 'Aceptar',
            onPress:
              onSubmitted,
          },
        ]
      );
    } catch (error) {
      console.log(
        'Error enviando entrega:',
        error
      );

      Alert.alert(
        'Sin conexión',
        'No fue posible comunicar la entrega con el servidor. Verifica tu conexión e inténtalo nuevamente.'
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >
      <Text style={styles.title}>
        Entregar actividad
      </Text>

      <View style={styles.activityCard}>
        <Text
          style={
            styles.activityTitle
          }
        >
          {activity?.titulo}
        </Text>

        <Text>
          {activity?.descripcion}
        </Text>
      </View>

      <Text style={styles.label}>
        Comentario
      </Text>

      <TextInput
        style={[
          styles.input,
          styles.textArea,
        ]}
        value={comentario}
        onChangeText={setComentario}
        placeholder="Escribe un comentario sobre tu entrega"
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>
        Archivo
      </Text>

      <TouchableOpacity
        style={styles.fileButton}
        onPress={seleccionarArchivo}
      >
        <Text
          style={
            styles.fileButtonText
          }
        >
          + Seleccionar archivo
        </Text>
      </TouchableOpacity>

      {archivoSeleccionado && (
        <View style={styles.fileCard}>
          <Text
            style={styles.fileName}
          >
            {archivoSeleccionado.name}
          </Text>

          <TouchableOpacity
            onPress={() =>
              setArchivoSeleccionado(
                null
              )
            }
          >
            <Text
              style={
                styles.removeFile
              }
            >
              Quitar archivo
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.label}>
        Link externo
      </Text>

      <TextInput
        style={styles.input}
        value={linkExterno}
        onChangeText={
          setLinkExterno
        }
        placeholder="https://..."
        autoCapitalize="none"
        keyboardType="url"
      />

      <TouchableOpacity
        style={[
          styles.submitButton,
          enviando && styles.submitButtonDisabled,
        ]}
        onPress={enviarEntrega}
        disabled={enviando}
      >
        <Text
          style={
            styles.submitButtonText
          }
        >
          {enviando
            ? 'Enviando...'
            : 'Entregar actividad'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        disabled={enviando}
      >
        <Text>
          Volver
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 25,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  activityCard: {
    backgroundColor: '#F3F6F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },

  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  label: {
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },

  textArea: {
    minHeight: 120,
  },

  fileButton: {
    borderWidth: 1,
    borderColor: '#2D405D',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },

  fileButtonText: {
    color: '#2D405D',
    fontWeight: 'bold',
  },

  fileCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F3F6F9',
  },

  fileName: {
    fontWeight: '600',
    marginBottom: 6,
  },

  removeFile: {
    color: '#B00020',
  },

  submitButton: {
    marginTop: 24,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#2D405D',
    alignItems: 'center',
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  backButton: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
  },
});

export default SubmitActivityScreen;
