import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_BYTES = 5 * 1024 * 1024;

const PDF_HTML = require('../../assets/pdf-viewer/viewer.html');
const PDF_JS = require('../../assets/pdf-viewer/pdf-v4.min.pdfasset');
const PDF_WORKER = require('../../assets/pdf-viewer/pdf-v4.worker.min.pdfasset');

const COLORES = {
  azul: '#1F4E79',
  azulOscuro: '#132F4A',
  blanco: '#FFFFFF',
  fondo: '#F1F5F9',
  texto: '#263B4D',
  rojo: '#B3261E',
};

async function copiarRecurso(modulo, destino) {
  const recurso = Asset.fromModule(modulo);
  await recurso.downloadAsync();

  if (!recurso.localUri) {
    throw new Error(
      'No fue posible cargar un recurso del visor.'
    );
  }

  await FileSystem.copyAsync({
    from: recurso.localUri,
    to: destino,
  });
}

export default function GuardianSupportViewer({
  visible,
  onClose,
  apiUrl,
  accessToken,
  estudianteId,
  excusaId,
  soporteId,
  modo = 'acudiente',
}) {
  const webView = useRef(null);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [documento, setDocumento] = useState(null);
  const [visorHtml, setVisorHtml] = useState(null);
  const [webLista, setWebLista] = useState(false);

  useEffect(() => {
    let activo = true;
    let archivoTemporal = null;
    let carpetaTemporal = null;
    let urlTemporalWeb = null;

    const preparar = async () => {
      if (!visible) {
        setDocumento(null);
        setVisorHtml(null);
        setWebLista(false);
        setError('');
        setCargando(false);
        return;
      }

      setCargando(true);
      setError('');
      setDocumento(null);
      setVisorHtml(null);
      setWebLista(false);

      try {
        if (
          !apiUrl ||
          !accessToken ||
          (modo === 'acudiente' && !estudianteId) ||
          !excusaId ||
          !soporteId
        ) {
          throw new Error(
            'Tu sesión o el identificador del soporte no están disponibles.'
          );
        }

        const base = apiUrl.trim().replace(/\/+$/, '');
        const url =
          modo === 'revision'
            ? `${base}/api/excuse-review/` +
              `${encodeURIComponent(excusaId)}/soportes/` +
              `${encodeURIComponent(soporteId)}/descargar`
            : `${base}/api/guardian/estudiantes/` +
              `${encodeURIComponent(estudianteId)}` +
              `/excusas/${encodeURIComponent(excusaId)}` +
              `/soportes/${encodeURIComponent(soporteId)}/descargar`;

        if (Platform.OS === 'web') {
          const respuesta = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept:
                'application/pdf, image/jpeg, image/png, image/webp',
            },
          });

          if (!respuesta.ok) {
            throw new Error(
              `No se pudo obtener el soporte (HTTP ${respuesta.status}).`
            );
          }

          const archivo = await respuesta.blob();
          const tipo = String(
            respuesta.headers.get('content-type') ||
              archivo.type ||
              ''
          )
            .split(';')[0]
            .trim()
            .toLowerCase();

          if (
            ![
              'application/pdf',
              'image/jpeg',
              'image/png',
              'image/webp',
            ].includes(tipo)
          ) {
            throw new Error(
              'El formato del archivo no está permitido.'
            );
          }

          if (
            !Number.isFinite(archivo.size) ||
            archivo.size <= 0 ||
            archivo.size > MAX_BYTES
          ) {
            throw new Error(
              'El soporte está vacío o supera los 5 MB.'
            );
          }

          urlTemporalWeb = URL.createObjectURL(archivo);

          if (!activo) {
            URL.revokeObjectURL(urlTemporalWeb);
            urlTemporalWeb = null;
            return;
          }

          setDocumento({
            tipo,
            uri: urlTemporalWeb,
          });
          return;
        }

        if (!FileSystem.cacheDirectory) {
          throw new Error(
            'El almacenamiento temporal no está disponible.'
          );
        }

        const cache = FileSystem.cacheDirectory.endsWith('/')
          ? FileSystem.cacheDirectory
          : `${FileSystem.cacheDirectory}/`;
        const identificador = Crypto.randomUUID();

        archivoTemporal = `${cache}hu09-${identificador}`;
        carpetaTemporal = `${cache}hu09-visor-${identificador}/`;

        const respuesta = await FileSystem.downloadAsync(
          url,
          archivoTemporal,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept:
                'application/pdf, image/jpeg, image/png, image/webp',
            },
          }
        );

        if (!activo) {
          return;
        }

        if (respuesta.status !== 200) {
          throw new Error(
            `No se pudo obtener el soporte (HTTP ${respuesta.status}).`
          );
        }

        const tipo = String(
          respuesta.headers?.['Content-Type'] ||
          respuesta.headers?.['content-type'] ||
          ''
        )
          .split(';')[0]
          .trim()
          .toLowerCase();

        const tiposPermitidos = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
        ];

        if (!tiposPermitidos.includes(tipo)) {
          throw new Error(
            'El formato del archivo no está permitido.'
          );
        }

        const info = await FileSystem.getInfoAsync(
          archivoTemporal
        );

        if (
          !info.exists ||
          !Number.isFinite(info.size) ||
          info.size <= 0 ||
          info.size > MAX_BYTES
        ) {
          throw new Error(
            'El soporte está vacío o supera los 5 MB.'
          );
        }

        const base64 = await FileSystem.readAsStringAsync(
          archivoTemporal,
          {
            encoding: FileSystem.EncodingType.Base64,
          }
        );

        if (!activo) {
          return;
        }

        if (tipo === 'application/pdf') {
          await FileSystem.makeDirectoryAsync(carpetaTemporal, {
            intermediates: true,
          });

          await Promise.all([
            copiarRecurso(
              PDF_HTML,
              `${carpetaTemporal}viewer.html`
            ),
            copiarRecurso(
              PDF_JS,
              `${carpetaTemporal}pdf.min.js`
            ),
            copiarRecurso(
              PDF_WORKER,
              `${carpetaTemporal}pdf.worker.min.js`
            ),
          ]);

          if (!activo) {
            return;
          }

          setVisorHtml(`${carpetaTemporal}viewer.html`);
        }

        setDocumento({ tipo, base64 });
      } catch (errorPreparacion) {
        if (activo) {
          setError(
            errorPreparacion?.message ||
              'No fue posible abrir el soporte.'
          );
        }
      } finally {
        if (archivoTemporal) {
          try {
            await FileSystem.deleteAsync(archivoTemporal, {
              idempotent: true,
            });
          } catch (errorLimpieza) {
            console.warn(
              'HU-09: No fue posible limpiar la descarga:',
              errorLimpieza?.message
            );
          }
        }

        if (activo) {
          setCargando(false);
        }
      }
    };

    void preparar();

    return () => {
      activo = false;

      if (urlTemporalWeb) {
        URL.revokeObjectURL(urlTemporalWeb);
      }

      if (carpetaTemporal) {
        void FileSystem.deleteAsync(carpetaTemporal, {
          idempotent: true,
        }).catch((errorLimpieza) => {
          console.warn(
            'HU-09: No fue posible limpiar recursos del visor:',
            errorLimpieza?.message
          );
        });
      }
    };
  }, [
    visible,
    apiUrl,
    accessToken,
    estudianteId,
    excusaId,
    soporteId,
    modo,
  ]);

  useEffect(() => {
    if (
      !webLista ||
      !documento ||
      documento.tipo !== 'application/pdf' ||
      !webView.current
    ) {
      return;
    }

    const mensaje = JSON.stringify({
      tipo: 'pdf',
      base64: documento.base64,
    });

    webView.current.injectJavaScript(`
      window.dispatchEvent(
        new MessageEvent('message', {
          data: ${JSON.stringify(mensaje)}
        })
      );
      true;
    `);
  }, [webLista, documento]);

  const recibirMensaje = (evento) => {
    try {
      const datos = JSON.parse(evento.nativeEvent.data);

      if (datos.tipo === 'preparado') {
        setWebLista(true);
      } else if (datos.tipo === 'error') {
        setError(
          datos.mensaje ||
            'No fue posible mostrar el PDF.'
        );
      }
    } catch {
      setError(
        'Se recibió una respuesta inválida del visor.'
      );
    }
  };

  const compartirDocumento = async () => {
    if (
      Platform.OS === 'web' &&
      documento?.uri &&
      typeof document !== 'undefined'
    ) {
      const extension =
        documento.tipo === 'application/pdf'
          ? 'pdf'
          : documento.tipo === 'image/png'
            ? 'png'
            : documento.tipo === 'image/webp'
              ? 'webp'
              : 'jpg';
      const enlace = document.createElement('a');

      enlace.href = documento.uri;
      enlace.download = `soporte-${excusaId}.${extension}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      return;
    }

    if (!documento?.base64) {
      return;
    }

    let archivoCompartir = null;

    try {
      if (!FileSystem.cacheDirectory) {
        throw new Error(
          'El almacenamiento temporal no está disponible.'
        );
      }

      const extension =
        documento.tipo === 'application/pdf'
          ? 'pdf'
          : documento.tipo === 'image/png'
            ? 'png'
            : documento.tipo === 'image/webp'
              ? 'webp'
              : 'jpg';

      archivoCompartir =
        `${FileSystem.cacheDirectory}hu09-compartir-` +
        `${Crypto.randomUUID()}.${extension}`;

      await FileSystem.writeAsStringAsync(
        archivoCompartir,
        documento.base64,
        {
          encoding: FileSystem.EncodingType.Base64,
        }
      );

      await Sharing.shareAsync(archivoCompartir, {
        mimeType: documento.tipo,
        dialogTitle: 'Compartir soporte académico',
        ...(documento.tipo === 'application/pdf'
          ? { UTI: 'com.adobe.pdf' }
          : {}),
      });
    } catch (errorCompartir) {
      console.error(
        'HU-09: No fue posible compartir el soporte:',
        errorCompartir
      );

      setError(
        errorCompartir?.message ||
          'No fue posible compartir el soporte.'
      );
    } finally {
      if (archivoCompartir) {
        try {
          await FileSystem.deleteAsync(archivoCompartir, {
            idempotent: true,
          });
        } catch (errorLimpieza) {
          console.warn(
            'HU-09: No fue posible limpiar el archivo compartido:',
            errorLimpieza?.message
          );
        }
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Visor de soporte</Text>

          <View style={styles.acciones}>
            <Pressable
              accessibilityRole="button"
              onPress={compartirDocumento}
              disabled={!documento}
              style={[
                styles.accion,
                !documento && styles.accionDeshabilitada,
              ]}
            >
              <Text style={styles.accionTexto}>
                {Platform.OS === 'web'
                  ? 'Descargar'
                  : 'Compartir'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.volver}
            >
              <Text style={styles.volverTexto}>
                Volver al seguimiento
              </Text>
            </Pressable>
          </View>
        </View>

        {cargando ? (
          <View style={styles.centrado}>
            <ActivityIndicator
              size="large"
              color={COLORES.azul}
            />
            <Text style={styles.descripcion}>
              Cargando soporte académico...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centrado}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : Platform.OS === 'web' &&
          documento?.tipo === 'application/pdf' &&
          documento.uri ? (
          <View style={styles.centrado}>
            <Text style={styles.descripcion}>
              El documento está listo para abrirse en una pestaña nueva.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                window.open(
                  documento.uri,
                  '_blank',
                  'noopener,noreferrer'
                )
              }
              style={styles.accion}
            >
              <Text style={styles.accionTexto}>
                Abrir documento PDF
              </Text>
            </Pressable>
          </View>
        ) : documento?.tipo === 'application/pdf' &&
          visorHtml ? (
          <WebView
            ref={webView}
            originWhitelist={['*']}
            source={{ uri: visorHtml }}
            allowingReadAccessToURL={visorHtml}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            scalesPageToFit
            bounces={false}
            overScrollMode="never"
            javaScriptEnabled
            onMessage={recibirMensaje}
            onError={() =>
              setError('No fue posible abrir el documento PDF.')
            }
            style={styles.webview}
          />
        ) : documento ? (
          <Image
            source={{
              uri: documento.uri ||
                `data:${documento.tipo};base64,${documento.base64}`,
            }}
            resizeMode="contain"
            style={styles.imagen}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  encabezado: {
    padding: 18,
    backgroundColor: COLORES.blanco,
    borderBottomWidth: 1,
    borderBottomColor: '#DFE7EF',
  },
  titulo: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORES.azulOscuro,
    marginBottom: 12,
  },
  acciones: {
    gap: 8,
  },
  accion: {
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORES.azul,
  },
  accionDeshabilitada: {
    opacity: 0.45,
  },
  accionTexto: {
    color: COLORES.azul,
    fontWeight: '800',
  },
  volver: {
    padding: 12,
    backgroundColor: COLORES.azul,
    borderRadius: 10,
    alignItems: 'center',
  },
  volverTexto: {
    color: COLORES.blanco,
    fontWeight: '800',
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  descripcion: {
    marginTop: 12,
    color: COLORES.texto,
    textAlign: 'center',
  },
  error: {
    color: COLORES.rojo,
    textAlign: 'center',
  },
  webview: {
    flex: 1,
  },
  imagen: {
    flex: 1,
    width: '100%',
  },
});
