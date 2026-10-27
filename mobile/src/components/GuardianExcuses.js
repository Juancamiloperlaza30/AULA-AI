import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert as NativeAlert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';

import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import GuardianSupportViewer from './GuardianSupportViewer';

// =====================================================
// AULA-AI | HU-09
// EXCUSAS ACADÉMICAS DEL ACUDIENTE
//
// - Consultar solicitudes
// - Consultar inasistencias disponibles
// - Seleccionar inasistencia
// - Registrar motivo
// - Tomar fotografía
// - Seleccionar imagen
// - Seleccionar PDF
// - Preparar archivo local
// - Enviar multipart/form-data
// - Consultar estado de las solicitudes
// =====================================================

const COLORES = {
  blanco: '#FFFFFF',
  azul: '#1F4E79',
  azulOscuro: '#132F4A',
  azulSuave: '#EAF2FA',
  texto: '#263B4D',
  gris: '#687B8B',
  borde: '#DFE7EF',
  verde: '#18764C',
  verdeSuave: '#E8F6EE',
  rojo: '#B3261E',
  amarillo: '#94620F',
  amarilloSuave: '#FFF4DC',
};

const MAX_BYTES = 5 * 1024 * 1024;

function mostrarAlerta(titulo, mensaje, botones) {
  if (Platform.OS !== 'web') {
    NativeAlert.alert(titulo, mensaje, botones);
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  const accionConfirmar = botones?.find(
    (boton) =>
      boton.style !== 'cancel' &&
      typeof boton.onPress === 'function'
  );

  if (accionConfirmar) {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) {
      accionConfirmar.onPress();
    }

    return;
  }

  window.alert(`${titulo}\n\n${mensaje}`);
}

const Alert = {
  alert: mostrarAlerta,
};

const MIME_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ESTADOS = {
  pendiente_revision: {
    texto: 'Pendiente de revisión',
    color: COLORES.amarillo,
    fondo: COLORES.amarilloSuave,
  },
  aprobada: {
    texto: 'Aprobada',
    color: COLORES.verde,
    fondo: COLORES.verdeSuave,
  },
  rechazada: {
    texto: 'Rechazada',
    color: COLORES.rojo,
    fondo: '#FDECEA',
  },
  requiere_correccion: {
    texto: 'Requiere corrección',
    color: COLORES.amarillo,
    fondo: COLORES.amarilloSuave,
  },
};

// =====================================================
// UTILIDADES
// =====================================================

function mostrarFecha(valor) {
  if (!valor) return 'Sin fecha';

  const texto = String(valor);

  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? new Date(`${texto}T12:00:00`)
    : new Date(texto);

  if (Number.isNaN(fecha.getTime())) {
    return 'Sin fecha';
  }

  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function validarArchivo(archivo) {
  if (!archivo?.uri) {
    throw new Error(
      'No fue posible acceder al archivo seleccionado.'
    );
  }

  if (!MIME_PERMITIDOS.includes(archivo.type)) {
    throw new Error(
      'Solo se permiten archivos JPG, PNG, WebP o PDF.'
    );
  }

  if (
    !Number.isFinite(archivo.size) ||
    archivo.size <= 0
  ) {
    throw new Error(
      'No fue posible verificar el tamaño del archivo.'
    );
  }

  if (archivo.size > MAX_BYTES) {
    throw new Error(
      'El soporte no puede superar los 5 MB.'
    );
  }

  return archivo;
}

function extensionPorMime(mime) {
  switch (mime) {
    case 'application/pdf':
      return 'pdf';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

function Boton({
  texto,
  onPress,
  principal = false,
  peligro = false,
  disabled = false,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        styles.boton,
        principal && styles.botonPrincipal,
        peligro && styles.botonPeligro,
        disabled && styles.botonDeshabilitado,
      ]}
    >
      <Text
        style={[
          styles.botonTexto,
          (principal || peligro) &&
            styles.botonTextoBlanco,
        ]}
      >
        {texto}
      </Text>
    </TouchableOpacity>
  );
}

function EtiquetaEstado({ estado }) {
  const config = ESTADOS[estado] || {
    texto: estado || 'Sin estado',
    color: COLORES.gris,
    fondo: COLORES.azulSuave,
  };

  return (
    <View
      style={[
        styles.etiqueta,
        { backgroundColor: config.fondo },
      ]}
    >
      <Text
        style={[
          styles.etiquetaTexto,
          { color: config.color },
        ]}
      >
        {config.texto}
      </Text>
    </View>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function GuardianExcuses({
  apiUrl,
  accessToken,
  estudiante,
}) {
  const [modo, setModo] = useState('seguimiento');

  const [excusas, setExcusas] = useState([]);
  const [inasistencias, setInasistencias] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [cargandoAusencias, setCargandoAusencias] =
    useState(false);

  const [enviando, setEnviando] = useState(false);
  const [descargandoSoporte, setDescargandoSoporte] =
    useState(null);
  const [
    soporteEnVista,
    setSoporteEnVista,
  ] = useState(null);

  const [error, setError] = useState('');
  const [errorAusencias, setErrorAusencias] = useState('');

  const [total, setTotal] = useState(0);

  const [asistenciaId, setAsistenciaId] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [archivo, setArchivo] = useState(null);

  const claveEnvio = useRef(null);
  const bloqueoEnvio = useRef(false);
  const version = useRef(0);

  const archivoRef = useRef(null);

  const base =
    typeof apiUrl === 'string'
      ? apiUrl.trim().replace(/\/+$/, '')
      : '';

  const estudianteId = estudiante?.id;

  useEffect(() => {
    setSoporteEnVista(null);
  }, [estudianteId, accessToken]);

  const ruta = estudianteId
    ? `${base}/api/guardian/estudiantes/${encodeURIComponent(
        estudianteId
      )}`
    : '';

  // =====================================================
  // ELIMINAR ARCHIVOS TEMPORALES PROPIOS
  // =====================================================

  const eliminarTemporal = (dato) => {
    if (!dato?.uri) return;

    if (
      Platform.OS === 'web' &&
      dato.uri.startsWith('blob:')
    ) {
      URL.revokeObjectURL(dato.uri);
      return;
    }

    if (!dato.temporal) return;

    try {
      const archivoLocal = new File(dato.uri);

      if (archivoLocal.exists) {
        archivoLocal.delete();
      }
    } catch (error) {
      console.warn(
        'HU-09: No fue posible limpiar archivo temporal:',
        error?.message
      );
    }
  };

  const actualizarArchivo = (nuevo) => {
    const anterior = archivoRef.current;

    archivoRef.current = nuevo;
    setArchivo(nuevo);

    claveEnvio.current = null;

    if (
      anterior?.uri &&
      anterior.uri !== nuevo?.uri
    ) {
      eliminarTemporal(anterior);
    }
  };

  // =====================================================
  // CONSULTAS AUTENTICADAS
  // =====================================================

  const peticionGet = useCallback(
    async (url, signal) => {
      if (!accessToken) {
        throw new Error(
          'Tu sesión no está disponible. Ingresa nuevamente.'
        );
      }

      const respuesta = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal,
      });

      const datos = await respuesta.json();

      if (!respuesta.ok || datos?.success !== true) {
        throw new Error(
          datos?.message ||
            'No fue posible consultar la información.'
        );
      }

      if (datos.estudiante?.id !== estudianteId) {
        throw new Error(
          'La respuesta no corresponde al estudiante seleccionado.'
        );
      }

      return datos;
    },
    [accessToken, estudianteId]
  );

  // =====================================================
  // CARGAR SEGUIMIENTO
  // =====================================================

  const cargarExcusas = useCallback(
    async (signal) => {
      if (!ruta || !accessToken) return;

      setCargando(true);
      setError('');

      try {
        const datos = await peticionGet(
          `${ruta}/excusas?pagina=1&limite=50`,
          signal
        );

        if (!Array.isArray(datos.excusas)) {
          throw new Error(
            'El servidor devolvió una lista incorrecta.'
          );
        }

        if (signal?.aborted) return;

        setExcusas(datos.excusas);

        setTotal(
          datos.paginacion?.total ??
            datos.excusas.length
        );
      } catch (err) {
        if (
          signal?.aborted ||
          err?.name === 'AbortError'
        ) {
          return;
        }

        setError(
          err?.message ||
            'No fue posible consultar las excusas.'
        );
      } finally {
        if (!signal?.aborted) {
          setCargando(false);
        }
      }
    },
    [ruta, accessToken, peticionGet]
  );

  // =====================================================
  // HU-09 | ABRIR SOPORTE ACADÉMICO
  // =====================================================

  const abrirVisorSoporte = (excusaId, soporteId) => {
    if (!/^[1-9]\d*$/.test(String(excusaId))) {
      Alert.alert(
        'Soporte no disponible',
        'El identificador de la excusa no es válido.'
      );
      return;
    }

    if (!/^[1-9]\d*$/.test(String(soporteId))) {
      Alert.alert(
        'Soporte no disponible',
        'El identificador del soporte no es válido.'
      );
      return;
    }

    setSoporteEnVista({
      excusaId,
      soporteId,
    });
  };

  const cerrarVisorSoporte = () => {
    setSoporteEnVista(null);
  };

  const descargarSoporte = async (excusaId, soporteId) => {
    if (descargandoSoporte !== null) {
      return;
    }

    if (
      !ruta ||
      !accessToken ||
      !/^[1-9]\d*$/.test(String(excusaId)) ||
      !/^[1-9]\d*$/.test(String(soporteId))
    ) {
      Alert.alert(
        'Soporte no disponible',
        'La sesión o el identificador del soporte no son válidos.'
      );
      return;
    }

    setDescargandoSoporte(`${excusaId}:${soporteId}`);

    let destino = null;

    try {
      if (!FileSystem.cacheDirectory) {
        throw new Error(
          'No está disponible el almacenamiento temporal.'
        );
      }

      const url =
        `${ruta}/excusas/${encodeURIComponent(excusaId)}` +
        `/soportes/${encodeURIComponent(soporteId)}/descargar`;
      const cache = FileSystem.cacheDirectory.endsWith('/')
        ? FileSystem.cacheDirectory
        : `${FileSystem.cacheDirectory}/`;

      destino =
        `${cache}hu09-descarga-${Crypto.randomUUID()}`;

      const resultado = await FileSystem.downloadAsync(
        url,
        destino,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept:
              'application/pdf, image/jpeg, image/png, image/webp',
          },
        }
      );

      if (resultado.status !== 200) {
        throw new Error(
          `No fue posible descargar el soporte (HTTP ${resultado.status}).`
        );
      }

      const tipo = String(
        resultado.headers?.['Content-Type'] ||
          resultado.headers?.['content-type'] ||
          ''
      )
        .split(';')[0]
        .trim()
        .toLowerCase();

      const extensiones = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      const extension = extensiones[tipo];

      if (!extension) {
        throw new Error(
          'El servidor devolvió un tipo de archivo no permitido.'
        );
      }

      const informacion = await FileSystem.getInfoAsync(destino);

      if (
        !informacion.exists ||
        !Number.isFinite(informacion.size) ||
        informacion.size <= 0 ||
        informacion.size > MAX_BYTES
      ) {
        throw new Error(
          'El soporte descargado está vacío o supera los 5 MB.'
        );
      }

      const destinoFinal = `${destino}.${extension}`;

      await FileSystem.moveAsync({
        from: destino,
        to: destinoFinal,
      });

      destino = destinoFinal;

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error(
          'Este dispositivo no permite guardar o compartir el archivo.'
        );
      }

      await Sharing.shareAsync(destino, {
        mimeType: tipo,
        dialogTitle: 'Guardar o compartir soporte académico',
        ...(tipo === 'application/pdf'
          ? { UTI: 'com.adobe.pdf' }
          : {}),
      });
    } catch (errorDescarga) {
      console.error(
        'HU-09: Error descargando soporte:',
        errorDescarga?.message || errorDescarga
      );

      Alert.alert(
        'No fue posible descargar el soporte',
        errorDescarga?.message || 'Intenta nuevamente.'
      );
    } finally {
      if (destino) {
        try {
          await FileSystem.deleteAsync(destino, {
            idempotent: true,
          });
        } catch (errorLimpieza) {
          console.warn(
            'HU-09: No fue posible limpiar la descarga:',
            errorLimpieza?.message
          );
        }
      }

      setDescargandoSoporte(null);
    }
  };

  // =====================================================
  // CARGAR INASISTENCIAS
  // =====================================================

  const cargarInasistencias = useCallback(
    async (signal) => {
      if (!ruta || !accessToken) return;

      setCargandoAusencias(true);
      setErrorAusencias('');

      try {
        const datos = await peticionGet(
          `${ruta}/excusas/inasistencias`,
          signal
        );

        if (!Array.isArray(datos.inasistencias)) {
          throw new Error(
            'No se recibió una lista válida.'
          );
        }

        if (signal?.aborted) return;

        setInasistencias(datos.inasistencias);
      } catch (err) {
        if (
          signal?.aborted ||
          err?.name === 'AbortError'
        ) {
          return;
        }

        setErrorAusencias(
          err?.message ||
            'No fue posible consultar las inasistencias.'
        );
      } finally {
        if (!signal?.aborted) {
          setCargandoAusencias(false);
        }
      }
    },
    [ruta, accessToken, peticionGet]
  );

  // =====================================================
  // CAMBIO DE ESTUDIANTE O SESIÓN
  // =====================================================

  useEffect(() => {
    version.current += 1;

    setSoporteEnVista(null);
    setDescargandoSoporte(null);

    claveEnvio.current = null;
    bloqueoEnvio.current = false;

    setDescargandoSoporte(null);
    setModo('seguimiento');
    setExcusas([]);
    setInasistencias([]);

    setAsistenciaId(null);
    setMotivo('');

    setTotal(0);
    setError('');
    setErrorAusencias('');

    const anterior = archivoRef.current;

    archivoRef.current = null;
    setArchivo(null);

    eliminarTemporal(anterior);

    const controller = new AbortController();

    void cargarExcusas(controller.signal);

    return () => {
      version.current += 1;
      controller.abort();
    };
  }, [estudianteId, accessToken, cargarExcusas]);

  // =====================================================
  // ABRIR Y CERRAR FORMULARIO
  // =====================================================

  const abrirFormulario = async () => {
    setModo('nueva');
    setErrorAusencias('');

    await cargarInasistencias();
  };

  const cancelarFormulario = () => {
    if (enviando) return;

    setModo('seguimiento');
    setAsistenciaId(null);
    setMotivo('');

    actualizarArchivo(null);

    claveEnvio.current = null;

    void cargarExcusas();
  };

  const seleccionarAsistencia = (item) => {
    if (
      !item.disponibleParaExcusa ||
      enviando
    ) {
      return;
    }

    setAsistenciaId(item.asistenciaId);

    claveEnvio.current = null;
  };

  // =====================================================
  // PREPARAR ARCHIVO EN CACHÉ
  //
  // Copiar el PDF al caché propio evita depender de
  // los permisos temporales del selector de Android.
  // =====================================================

  const guardarArchivo = async (dato) => {
    let destino = null;

    try {
      if (!dato?.uri || typeof dato.uri !== 'string') {
        throw new Error(
          'No se recibió una ubicación válida del archivo.'
        );
      }

      const tipo = dato.type;

      if (!MIME_PERMITIDOS.includes(tipo)) {
        throw new Error(
          'Solo se permiten archivos JPG, PNG, WebP o PDF.'
        );
      }

      const extension = extensionPorMime(tipo);

      const nombre =
        dato.name ||
        `soporte-${Date.now()}.${extension}`;

      let uriPreparada = dato.uri.trim();
      let tamano = Number(dato.size);
      let temporal = false;
      let archivoWeb = null;

      if (Platform.OS === 'web') {
        if (
          !dato.file ||
          typeof dato.file.slice !== 'function'
        ) {
          throw new Error(
            'No fue posible acceder al archivo seleccionado en el navegador.'
          );
        }

        archivoWeb = dato.file;
        tamano = Number(archivoWeb.size);
      } else if (tipo === 'application/pdf') {
        if (
          Number.isFinite(tamano) &&
          tamano > MAX_BYTES
        ) {
          throw new Error(
            'El soporte no puede superar los 5 MB.'
          );
        }

        if (!FileSystem.cacheDirectory) {
          throw new Error(
            'No está disponible la caché local para preparar el archivo.'
          );
        }

        const carpetaCache = FileSystem.cacheDirectory.endsWith('/')
          ? FileSystem.cacheDirectory
          : `${FileSystem.cacheDirectory}/`;

        destino =
          `${carpetaCache}hu09-${Crypto.randomUUID()}.${extension}`;

        await FileSystem.copyAsync({
          from: uriPreparada,
          to: destino,
        });

        const informacion = await FileSystem.getInfoAsync(destino);

        if (!informacion.exists) {
          throw new Error(
            'No fue posible preparar una copia local del archivo.'
          );
        }

        tamano = Number(informacion.size);
        uriPreparada = destino;
        temporal = true;
      } else {
        if (!uriPreparada.startsWith('file://')) {
          throw new Error(
            'Android no entregó una copia local del archivo. ' +
            'Selecciona nuevamente la imagen.'
          );
        }

        if (!Number.isFinite(tamano) || tamano <= 0) {
          const archivoLocal = new File(uriPreparada);
          tamano = archivoLocal.size;
        }
      }

      if (!Number.isFinite(tamano) || tamano <= 0) {
        throw new Error(
          'No fue posible verificar el tamaño del archivo preparado.'
        );
      }

      if (tamano > MAX_BYTES) {
        throw new Error(
          'El soporte no puede superar los 5 MB.'
        );
      }

      actualizarArchivo({
        uri: uriPreparada,
        name: nombre,
        type: tipo,
        size: tamano,
        temporal,
        file: archivoWeb,
      });

      console.log('HU-09: Soporte preparado', {
        tipo,
        tamano,
        uriLocal: uriPreparada.startsWith('file://'),
      });
    } catch (error) {
      if (destino) {
        try {
          await FileSystem.deleteAsync(destino, {
            idempotent: true,
          });
        } catch (errorLimpieza) {
          console.warn(
            'HU-09: No fue posible limpiar la copia temporal:',
            errorLimpieza
          );
        }
      }

      if (
        Platform.OS === 'web' &&
        typeof dato?.uri === 'string' &&
        dato.uri.startsWith('blob:') &&
        dato.uri !== archivoRef.current?.uri
      ) {
        URL.revokeObjectURL(dato.uri);
      }

      console.error(
        'HU-09: Error al preparar archivo:',
        error
      );

      Alert.alert(
        'Archivo no válido',
        error?.message ||
          'No fue posible preparar el archivo seleccionado.'
      );
    }
  };

  // =====================================================
  // SELECCIONAR PDF
  // =====================================================

  const seleccionarDocumento = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: false,
      });

      if (resultado.canceled) {
        return;
      }

      const seleccionado = resultado.assets?.[0];

      if (!seleccionado?.uri) {
        throw new Error(
          'No se recibió el documento seleccionado.'
        );
      }

      const tamano = Number(seleccionado.size);

      if (
        !Number.isFinite(tamano) ||
        tamano <= 0 ||
        tamano > MAX_BYTES
      ) {
        throw new Error(
          'El PDF está vacío, no tiene un tamaño válido o supera los 5 MB.'
        );
      }

      console.log('HU-09: PDF seleccionado', {
        esquema: seleccionado.uri.split(':')[0],
        nombre: seleccionado.name,
        tamano,
      });

      await guardarArchivo({
        uri: seleccionado.uri,
        name: seleccionado.name || 'soporte.pdf',
        type: 'application/pdf',
        size: tamano,
        file: seleccionado.file,
      });
    } catch (error) {
      console.warn(
        'HU-09: Error al seleccionar PDF:',
        error?.message
      );

      Alert.alert(
        'No fue posible seleccionar el PDF',
        error?.message ||
          'Intenta seleccionar nuevamente el documento.'
      );
    }
  };

  // =====================================================
  // CÁMARA Y GALERÍA
  // =====================================================

  const seleccionarImagen = async (camara) => {
    try {
      if (camara) {
        const permiso =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permiso.granted) {
          Alert.alert(
            'Permiso requerido',
            'Autoriza el acceso a la cámara.'
          );
          return;
        }
      } else {
        const permiso =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permiso.granted) {
          Alert.alert(
            'Permiso requerido',
            'Autoriza el acceso a las fotografías.'
          );
          return;
        }
      }

      const opciones = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      };

      const resultado = camara
        ? await ImagePicker.launchCameraAsync(opciones)
        : await ImagePicker.launchImageLibraryAsync(
            opciones
          );

      if (resultado.canceled) return;

      const imagen = resultado.assets?.[0];

      if (!imagen) return;

      const tipo =
        imagen.mimeType || 'image/jpeg';

      const extension = extensionPorMime(tipo);

      await guardarArchivo({
        uri: imagen.uri,
        name:
          imagen.fileName ||
          `soporte-${Date.now()}.${extension}`,
        type: tipo,
        size: imagen.fileSize,
        file: imagen.file,
      });
    } catch (err) {
      Alert.alert(
        'Imagen',
        err?.message ||
          'No fue posible seleccionar la imagen.'
      );
    }
  };

  // =====================================================
  // VALIDAR Y CONFIRMAR ENVÍO
  // =====================================================

  const confirmarEnvio = () => {
    if (
      bloqueoEnvio.current ||
      enviando
    ) {
      return;
    }

    const texto = motivo.trim();

    if (!asistenciaId) {
      Alert.alert(
        'Inasistencia requerida',
        'Selecciona una inasistencia.'
      );
      return;
    }

    if (
      texto.length < 10 ||
      texto.length > 2000
    ) {
      Alert.alert(
        'Motivo no válido',
        'El motivo debe tener entre 10 y 2000 caracteres.'
      );
      return;
    }

    if (!archivo) {
      Alert.alert(
        'Soporte requerido',
        'Adjunta una fotografía o un PDF.'
      );
      return;
    }

    try {
      validarArchivo(archivo);
    } catch (err) {
      Alert.alert(
        'Archivo no válido',
        err.message
      );
      return;
    }

    Alert.alert(
      'Confirmar envío',
      '¿Deseas presentar esta excusa académica para revisión institucional?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Enviar excusa',
          onPress: () => {
            void enviarExcusa();
          },
        },
      ]
    );
  };

  // =====================================================
  // ENVIAR EXCUSA
  // =====================================================

  const enviarExcusa = async () => {
    if (bloqueoEnvio.current || enviando) {
      return;
    }

    bloqueoEnvio.current = true;
    setEnviando(true);

    const versionActual = version.current;
    const estudianteActual = estudianteId;

    try {
      if (!ruta || !accessToken) {
        throw new Error(
          'Tu sesión no está disponible.'
        );
      }

      const soporte = validarArchivo(
        archivoRef.current
      );

      const tamanoSoporte = Number(soporte.size);

      if (
        !Number.isFinite(tamanoSoporte) ||
        tamanoSoporte <= 0 ||
        tamanoSoporte > MAX_BYTES
      ) {
        throw new Error(
          'El archivo está vacío o supera los 5 MB.'
        );
      }

      if (!claveEnvio.current) {
        claveEnvio.current = Crypto.randomUUID();
      }

      console.log('HU-09: Iniciando envío multipart', {
        tipo: soporte.type,
        tamano: tamanoSoporte,
        estudianteId: estudianteActual,
        asistenciaId,
      });

      let status;
      let responseBody;

      if (Platform.OS === 'web') {
        if (
          !soporte.file ||
          typeof soporte.file.slice !== 'function'
        ) {
          throw new Error(
            'El archivo del navegador ya no está disponible. Selecciónalo nuevamente.'
          );
        }

        const formulario = new FormData();
        formulario.append(
          'soporte',
          soporte.file,
          soporte.name
        );
        formulario.append(
          'asistenciaId',
          String(asistenciaId)
        );
        formulario.append('motivo', motivo.trim());
        formulario.append(
          'claveIdempotencia',
          claveEnvio.current
        );

        const respuesta = await fetch(
          `${ruta}/excusas`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            body: formulario,
          }
        );

        status = respuesta.status;
        responseBody = await respuesta.text();
      } else {
        if (
          typeof soporte.uri !== 'string' ||
          !soporte.uri.startsWith('file://')
        ) {
          throw new Error(
            'El documento no tiene una ubicación local válida. Selecciónalo nuevamente.'
          );
        }

        const informacion = await FileSystem.getInfoAsync(
          soporte.uri
        );

        if (
          !informacion.exists ||
          (
            typeof informacion.size === 'number' &&
            (
              informacion.size <= 0 ||
              informacion.size > MAX_BYTES
            )
          )
        ) {
          throw new Error(
            'El archivo está vacío, supera los 5 MB o ya no está disponible. Selecciónalo nuevamente.'
          );
        }

        const resultado = await FileSystem.uploadAsync(
          `${ruta}/excusas`,
          soporte.uri,
          {
            httpMethod: 'POST',
            uploadType:
              FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'soporte',
            mimeType: soporte.type,
            parameters: {
              asistenciaId: String(asistenciaId),
              motivo: motivo.trim(),
              claveIdempotencia: claveEnvio.current,
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );

        status = resultado.status;
        responseBody = resultado.body;
      }

      let datos;

      try {
        datos = JSON.parse(responseBody || '{}');
      } catch {
        throw new Error(
          `El servidor devolvió una respuesta no válida (HTTP ${status}).`
        );
      }

      if (
        versionActual !== version.current ||
        estudianteActual !== estudianteId
      ) {
        return;
      }

      if (
        status < 200 ||
        status >= 300 ||
        datos?.success !== true
      ) {
        if (status === 409) {
          await cargarInasistencias();
          await cargarExcusas();
        }

        throw new Error(
          datos?.message ||
            `No fue posible confirmar el envío (HTTP ${status}).`
        );
      }

      claveEnvio.current = null;

      setModo('seguimiento');
      setAsistenciaId(null);
      setMotivo('');

      actualizarArchivo(null);

      await cargarExcusas();

      Alert.alert(
        'Solicitud registrada',
        datos.message ||
          'La excusa quedó pendiente de revisión.'
      );
    } catch (err) {
      console.error(
        'HU-09: Error al enviar excusa:',
        err
      );

      if (
        versionActual !== version.current ||
        estudianteActual !== estudianteId
      ) {
        return;
      }

      Alert.alert(
        'Verificar solicitud',
        (err?.message ||
          'No fue posible confirmar el envío.') +
          '\n\nConsulta el seguimiento antes de volver a intentarlo.'
      );
    } finally {
      bloqueoEnvio.current = false;

      if (versionActual === version.current) {
        setEnviando(false);
      }
    }
  };

  // =====================================================
  // INASISTENCIAS DISPONIBLES
  // =====================================================

  const disponibles = inasistencias.filter(
    (item) => item.disponibleParaExcusa
  );

  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>
        Excusas académicas
      </Text>

      <Text style={styles.descripcion}>
        Presenta solicitudes de justificación
        y consulta su estado para el estudiante
        seleccionado.
      </Text>

      {modo === 'seguimiento' ? (
        <>
          <Boton
            texto="+ Nueva excusa académica"
            principal
            onPress={abrirFormulario}
          />

          <View style={styles.resumen}>
            <View>
              <Text style={styles.resumenEtiqueta}>
                Solicitudes registradas
              </Text>

              <Text style={styles.resumenNumero}>
                {total}
              </Text>
            </View>

            <Boton
              texto="Actualizar"
              onPress={() => cargarExcusas()}
              disabled={cargando}
            />
          </View>

          {cargando ? (
            <View style={styles.centrado}>
              <ActivityIndicator
                size="large"
                color={COLORES.azul}
              />

              <Text style={styles.textoSuave}>
                Consultando excusas...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.aviso}>
              <Text style={styles.errorTitulo}>
                No fue posible consultar las solicitudes
              </Text>

              <Text style={styles.textoSuave}>
                {error}
              </Text>
            </View>
          ) : excusas.length === 0 ? (
            <View style={styles.aviso}>
              <Text style={styles.subtitulo}>
                Sin solicitudes registradas
              </Text>

              <Text style={styles.textoSuave}>
                Puedes presentar una excusa
                seleccionando una inasistencia disponible.
              </Text>
            </View>
          ) : (
            excusas.map((item) => (
              <View
                key={String(item.id)}
                style={styles.tarjeta}
              >
                <View style={styles.fila}>
                  <Text style={styles.identificador}>
                    Solicitud #{item.id}
                  </Text>

                  <EtiquetaEstado
                    estado={item.estado}
                  />
                </View>

                <Text style={styles.materia}>
                  {item.asistencia?.materia ||
                    'Materia no disponible'}
                </Text>

                <Text style={styles.detalle}>
                  Inasistencia:{' '}
                  {mostrarFecha(
                    item.asistencia?.fecha
                  )}
                </Text>

                <Text style={styles.detalle}>
                  Enviada:{' '}
                  {mostrarFecha(item.fechaEnvio)}
                </Text>

                <View style={styles.separador} />

                <Text style={styles.subtitulo}>
                  Motivo de la excusa
                </Text>

                <Text style={styles.motivo}>
                  {item.motivo}
                </Text>

                {!!item.observacionRevision && (
                  <View style={styles.observacion}>
                    <Text style={styles.subtitulo}>
                      Observación institucional
                    </Text>

                    <Text style={styles.motivo}>
                      {item.observacionRevision}
                    </Text>
                  </View>
                )}

                <Text style={styles.soporteTexto}>
                  Soportes adjuntos:{' '}
                  {item.cantidadSoportes ?? 0}
                </Text>

                {Array.isArray(item.soportes) &&
                  item.soportes.map((soporte, indice) => (
                    <View
                      key={String(soporte.id)}
                      style={styles.accionesSoporte}
                    >
                      <Text style={styles.nombreSoporte}>
                        Soporte {indice + 1}
                      </Text>

                      <Boton
                        texto="Ver soporte"
                        onPress={() =>
                          abrirVisorSoporte(
                            item.id,
                            soporte.id
                          )
                        }
                        disabled={descargandoSoporte !== null}
                      />

                      <Boton
                        texto={
                          descargandoSoporte ===
                          `${item.id}:${soporte.id}`
                            ? 'Descargando soporte...'
                            : 'Descargar soporte'
                        }
                        onPress={() =>
                          descargarSoporte(
                            item.id,
                            soporte.id
                          )
                        }
                        disabled={descargandoSoporte !== null}
                      />
                    </View>
                  ))}
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <View style={styles.tarjeta}>
            <Text style={styles.subtituloGrande}>
              Nueva excusa académica
            </Text>

            <Text style={styles.descripcion}>
              Selecciona una inasistencia registrada
              para presentar la justificación.
            </Text>

            {cargandoAusencias ? (
              <ActivityIndicator
                color={COLORES.azul}
                size="large"
              />
            ) : errorAusencias ? (
              <>
                <Text style={styles.errorTitulo}>
                  {errorAusencias}
                </Text>

                <Boton
                  texto="Volver a consultar"
                  onPress={() =>
                    cargarInasistencias()
                  }
                />
              </>
            ) : disponibles.length === 0 ? (
              <View style={styles.aviso}>
                <Text style={styles.textoSuave}>
                  No hay inasistencias disponibles
                  para presentar una nueva excusa.
                </Text>
              </View>
            ) : (
              disponibles.map((item) => {
                const activo =
                  String(asistenciaId) ===
                  String(item.asistenciaId);

                return (
                  <TouchableOpacity
                    key={String(item.asistenciaId)}
                    onPress={() =>
                      seleccionarAsistencia(item)
                    }
                    disabled={enviando}
                    style={[
                      styles.ausencia,
                      activo &&
                        styles.ausenciaActiva,
                    ]}
                  >
                    <Text style={styles.materia}>
                      {activo ? '● ' : '○ '}
                      {item.materia || 'Materia'}
                    </Text>

                    <Text style={styles.detalle}>
                      {mostrarFecha(item.fecha)}
                    </Text>

                    <Text style={styles.detalle}>
                      Inasistencia #{item.asistenciaId}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {disponibles.length > 0 &&
            !errorAusencias && (
              <>
                <View style={styles.tarjeta}>
                  <Text
                    style={styles.subtituloGrande}
                  >
                    Motivo de la excusa
                  </Text>

                  <TextInput
                    value={motivo}
                    onChangeText={(texto) => {
                      setMotivo(texto);
                      claveEnvio.current = null;
                    }}
                    editable={!enviando}
                    multiline
                    maxLength={2000}
                    placeholder="Explica el motivo de la inasistencia..."
                    placeholderTextColor={
                      COLORES.gris
                    }
                    textAlignVertical="top"
                    style={styles.campoMotivo}
                  />

                  <Text style={styles.contador}>
                    {motivo.trim().length}/2000
                    {' '}caracteres (mínimo 10)
                  </Text>
                </View>

                <View style={styles.tarjeta}>
                  <Text
                    style={styles.subtituloGrande}
                  >
                    Soporte académico
                  </Text>

                  <Text style={styles.descripcion}>
                    Adjunta un solo archivo
                    de máximo 5 MB.
                  </Text>

                  <Boton
                    texto="Tomar fotografía"
                    onPress={() =>
                      seleccionarImagen(true)
                    }
                    disabled={enviando}
                  />

                  <Boton
                    texto="Elegir de la galería"
                    onPress={() =>
                      seleccionarImagen(false)
                    }
                    disabled={enviando}
                  />

                  <Boton
                    texto="Seleccionar PDF"
                    onPress={seleccionarDocumento}
                    disabled={enviando}
                  />

                  {!!archivo && (
                    <View style={styles.archivo}>
                      <Text
                        style={styles.archivoNombre}
                      >
                        {archivo.name}
                      </Text>

                      <Text style={styles.detalle}>
                        {(archivo.size / 1024).toFixed(
                          1
                        )}{' '}
                        KB
                      </Text>

                      <Boton
                        texto="Quitar archivo"
                        peligro
                        disabled={enviando}
                        onPress={() =>
                          actualizarArchivo(null)
                        }
                      />
                    </View>
                  )}
                </View>

                <Boton
                  texto={
                    enviando
                      ? 'Enviando solicitud...'
                      : 'Enviar excusa académica'
                  }
                  principal
                  disabled={enviando}
                  onPress={confirmarEnvio}
                />
              </>
            )}

          <Boton
            texto="Volver al seguimiento"
            onPress={cancelarFormulario}
            disabled={enviando}
          />

          {enviando && (
            <View style={styles.centrado}>
              <ActivityIndicator
                color={COLORES.azul}
                size="large"
              />

              <Text style={styles.textoSuave}>
                Registrando solicitud y soporte...
              </Text>
            </View>
          )}
        </>
      )}

      <GuardianSupportViewer
        visible={soporteEnVista !== null}
        apiUrl={apiUrl}
        accessToken={accessToken}
        estudianteId={estudianteId}
        excusaId={soporteEnVista?.excusaId}
        soporteId={soporteEnVista?.soporteId}
        onClose={cerrarVisorSoporte}
      />
    </View>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  contenedor: {
    width: '100%',
  },

  titulo: {
    color: COLORES.azulOscuro,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 7,
  },

  subtituloGrande: {
    color: COLORES.azulOscuro,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },

  subtitulo: {
    color: COLORES.azulOscuro,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 7,
  },

  descripcion: {
    color: COLORES.gris,
    lineHeight: 21,
    fontSize: 13,
    marginBottom: 16,
  },

  textoSuave: {
    color: COLORES.gris,
    lineHeight: 21,
    marginTop: 7,
  },

  boton: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    backgroundColor: COLORES.blanco,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 11,
  },

  botonPrincipal: {
    backgroundColor: COLORES.azul,
    borderColor: COLORES.azul,
  },

  botonPeligro: {
    backgroundColor: COLORES.rojo,
    borderColor: COLORES.rojo,
  },

  botonDeshabilitado: {
    opacity: 0.5,
  },

  botonTexto: {
    color: COLORES.azul,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },

  botonTextoBlanco: {
    color: COLORES.blanco,
  },

  resumen: {
    backgroundColor: COLORES.azulSuave,
    borderRadius: 14,
    padding: 16,
    marginVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  resumenEtiqueta: {
    color: COLORES.azul,
    fontWeight: '700',
  },

  resumenNumero: {
    color: COLORES.azul,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 5,
  },

  centrado: {
    alignItems: 'center',
    padding: 25,
  },

  aviso: {
    backgroundColor: COLORES.blanco,
    borderRadius: 13,
    borderColor: COLORES.borde,
    borderWidth: 1,
    padding: 17,
    marginBottom: 14,
  },

  errorTitulo: {
    color: COLORES.rojo,
    fontWeight: '800',
    marginBottom: 8,
  },

  tarjeta: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 15,
    padding: 16,
    marginVertical: 7,
  },

  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 12,
  },

  identificador: {
    color: COLORES.azulOscuro,
    fontWeight: '800',
  },

  etiqueta: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },

  etiquetaTexto: {
    fontSize: 11,
    fontWeight: '800',
  },

  materia: {
    color: COLORES.azul,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 9,
  },

  detalle: {
    color: COLORES.gris,
    fontSize: 13,
    marginBottom: 5,
  },

  separador: {
    height: 1,
    backgroundColor: COLORES.borde,
    marginVertical: 13,
  },

  motivo: {
    color: COLORES.texto,
    fontSize: 13,
    lineHeight: 21,
  },

  observacion: {
    backgroundColor: COLORES.azulSuave,
    borderRadius: 11,
    padding: 12,
    marginTop: 13,
  },

  soporteTexto: {
    color: COLORES.azul,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 14,
  },

  accionesSoporte: {
    marginTop: 10,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DFE7EF',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    gap: 10,
  },

  nombreSoporte: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F4E79',
    marginBottom: 2,
  },

  ausencia: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  ausenciaActiva: {
    borderColor: COLORES.azul,
    borderWidth: 2,
    backgroundColor: COLORES.azulSuave,
  },

  campoMotivo: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 11,
    padding: 13,
    color: COLORES.texto,
    fontSize: 14,
    lineHeight: 21,
  },

  contador: {
    textAlign: 'right',
    color: COLORES.gris,
    marginTop: 8,
    fontSize: 12,
  },

  archivo: {
    backgroundColor: COLORES.azulSuave,
    borderRadius: 12,
    padding: 12,
    marginTop: 9,
  },

  archivoNombre: {
    color: COLORES.azulOscuro,
    fontWeight: '700',
    marginBottom: 7,
  },
});