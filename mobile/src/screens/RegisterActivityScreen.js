
import { useEffect, useState } from 'react';

import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';

import {
  File,
  UploadType,
} from 'expo-file-system';

import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';

// =====================================================
// AULA-AI | HU-04 / HU-08
// REGISTRO DE ACTIVIDADES ACADÉMICAS
//
// Corrección:
// Android utiliza selectores nativos separados
// para fecha y hora.
//
// Se mantienen:
// - Asignaciones del docente.
// - Tipos de actividad.
// - Registro con reintentos.
// - Adjuntos y enlaces.
// - Validaciones.
// - Fechas ISO para el backend.
// =====================================================

const COLORES = {
  primario: '#2D405D',
  fondo: '#F5F7FB',
  blanco: '#FFFFFF',
  texto: '#17243A',
  secundario: '#65738A',
  borde: '#D5DCE5',
  error: '#B00020',
};

const fechaInicialEntrega = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000);

const fechaValida = (fecha) =>
  fecha instanceof Date &&
  !Number.isNaN(fecha.getTime());

const combinarFecha = (actual, seleccionada, modo) => {
  const resultado = new Date(actual);

  if (modo === 'date') {
    resultado.setFullYear(
      seleccionada.getFullYear(),
      seleccionada.getMonth(),
      seleccionada.getDate()
    );
  } else {
    resultado.setHours(
      seleccionada.getHours(),
      seleccionada.getMinutes(),
      0,
      0
    );
  }

  return resultado;
};

const formatearFecha = (fecha) => {
  if (!fechaValida(fecha)) return 'Sin fecha';

  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatearHora = (fecha) => {
  if (!fechaValida(fecha)) return 'Sin hora';

  return fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const RegisterActivityScreen = ({
  apiUrl,
  accessToken,
  onBack,
  onRegistered,
}) => {
  // ===================================================
  // ESTADOS DEL FORMULARIO
  // ===================================================

  const [tipo, setTipo] = useState('tarea');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [
    archivoSeleccionado,
    setArchivoSeleccionado,
  ] = useState(null);

  const [linkExterno, setLinkExterno] = useState('');

  const [asignaciones, setAsignaciones] = useState([]);

  const [
    asignacionSeleccionada,
    setAsignacionSeleccionada,
  ] = useState(null);

  const [
    fechaPublicacion,
    setFechaPublicacion,
  ] = useState(() => new Date());

  const [
    fechaEntrega,
    setFechaEntrega,
  ] = useState(fechaInicialEntrega);

  const [selectorIOS, setSelectorIOS] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // ===================================================
  // CARGAR ASIGNACIONES DEL DOCENTE
  // ===================================================

  useEffect(() => {
    let activo = true;

    const cargarAsignaciones = async () => {
      try {
        setCargando(true);

        const response = await fetch(
          `${apiUrl}/api/activities/mis-asignaciones`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          if (activo) {
            Alert.alert(
              'Error',
              data.message ||
                'No fue posible cargar las materias asignadas.'
            );
          }
          return;
        }

        if (activo) {
          setAsignaciones(data.asignaciones || []);
        }
      } catch (error) {
        if (!activo) return;

        console.log(
          'ERROR CONSULTANDO ASIGNACIONES:',
          error
        );

        Alert.alert(
          'Error al cargar asignaciones',
          error?.message ||
            'No fue posible consultar las asignaciones.'
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarAsignaciones();

    return () => {
      activo = false;
    };
  }, [apiUrl, accessToken]);

  // ===================================================
  // SELECTOR DE FECHA Y HORA
  // ===================================================

  const actualizarFecha = (campo, modo, valor) => {
    if (!fechaValida(valor)) return;

    const actualizar = (actual) =>
      combinarFecha(actual, valor, modo);

    if (campo === 'publicacion') {
      setFechaPublicacion(actualizar);
    } else {
      setFechaEntrega(actualizar);
    }
  };

  const abrirSelector = (campo, modo) => {
    if (guardando) return;

    const valor =
      campo === 'publicacion'
        ? fechaPublicacion
        : fechaEntrega;

    if (Platform.OS === 'android') {
      try {
        DateTimePickerAndroid.open({
          value: valor,
          mode: modo,
          is24Hour: true,
          display: 'default',

          onChange: (event, seleccionado) => {
            if (
              event?.type !== 'set' ||
              !fechaValida(seleccionado)
            ) {
              return;
            }

            actualizarFecha(
              campo,
              modo,
              seleccionado
            );
          },
        });
      } catch (error) {
        console.error(
          'Error abriendo selector Android:',
          error
        );

        Alert.alert(
          'Error de calendario',
          'No fue posible abrir el selector. Inténtelo nuevamente.'
        );
      }

      return;
    }

    // iOS conserva el selector visual integrado.
    setSelectorIOS({ campo, modo });
  };

  const cerrarSelectorIOS = () => {
    setSelectorIOS(null);
  };

  const cambiarSelectorIOS = (event, valor) => {
    if (
      !selectorIOS ||
      event?.type === 'dismissed' ||
      !fechaValida(valor)
    ) {
      return;
    }

    actualizarFecha(
      selectorIOS.campo,
      selectorIOS.modo,
      valor
    );
  };

  // ===================================================
  // SELECCIONAR ARCHIVO ADJUNTO
  // ===================================================

  const seleccionarArchivo = async () => {
    try {
      const resultado =
        await DocumentPicker.getDocumentAsync({
          type: '*/*',
          multiple: false,
          copyToCacheDirectory: true,
        });

      if (resultado.canceled) return;

      const archivo = resultado.assets?.[0];

      if (!archivo) return;

      setArchivoSeleccionado({
        uri: archivo.uri,
        name: archivo.name,
        mimeType:
          archivo.mimeType ||
          'application/octet-stream',
        size: archivo.size || 0,
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

  // ===================================================
  // REGISTRAR ACTIVIDAD
  // ===================================================

  const registrarActividad = async () => {
    if (guardando) return;

    setGuardando(true);

    try {
      if (
        !tipo ||
        !titulo.trim() ||
        !descripcion.trim() ||
        !asignacionSeleccionada
      ) {
        Alert.alert(
          'Campos incompletos',
          'Complete todos los campos obligatorios.'
        );
        return;
      }

      if (
        !fechaValida(fechaPublicacion) ||
        !fechaValida(fechaEntrega)
      ) {
        Alert.alert(
          'Fechas inválidas',
          'Seleccione fechas válidas para la actividad.'
        );
        return;
      }

      if (fechaEntrega <= fechaPublicacion) {
        Alert.alert(
          'Fecha no válida',
          'La fecha de entrega debe ser posterior a la fecha de publicación.'
        );
        return;
      }

      const clientRequestId = Crypto.randomUUID();

      const body = {
        materiaGrupoPeriodoId:
          asignacionSeleccionada.id,
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        fechaPublicacion:
          fechaPublicacion.toISOString(),
        fechaEntrega: fechaEntrega.toISOString(),
        clientRequestId,
      };

      const esperar = (ms) =>
        new Promise((resolve) =>
          setTimeout(resolve, ms)
        );

      const tiemposEspera = [
        1000,
        2000,
        4000,
        8000,
      ];

      let response = null;

      for (let intento = 0; intento < 5; intento++) {
        try {
          response = await fetch(
            `${apiUrl}/api/activities`,
            {
              method: 'POST',
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            }
          );

          break;
        } catch (error) {
          console.log(
            `Intento ${intento + 1} fallido al registrar actividad.`,
            error
          );

          if (intento < 4) {
            await esperar(tiemposEspera[intento]);
          }
        }
      }

      if (!response) {
        throw new Error(
          'No hay conexión con el servidor. Verifique su conexión e intente nuevamente.'
        );
      }

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          'Error',
          data.message ||
            'No fue posible registrar la actividad.'
        );
        return;
      }

      // ===============================================
      // SUBIR ARCHIVO ADJUNTO
      // ===============================================

      if (archivoSeleccionado) {
        const archivo = new File(
          archivoSeleccionado.uri
        );

        const tareaSubida = archivo.createUploadTask(
          `${apiUrl}/api/activities/${data.actividadId}/recursos`,
          {
            httpMethod: 'POST',
            uploadType: UploadType.MULTIPART,
            fieldName: 'archivo',
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

        console.log(
          'DOCENTE UPLOAD STATUS:',
          resultadoSubida.status
        );

        console.log(
          'DOCENTE UPLOAD BODY:',
          resultadoSubida.body
        );

        let dataArchivo = {};

        try {
          dataArchivo = resultadoSubida.body
            ? JSON.parse(resultadoSubida.body)
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
          console.log(
            'Error subiendo archivo:',
            dataArchivo.message
          );

          Alert.alert(
            'Actividad registrada',
            'La actividad se creó correctamente, pero no fue posible subir el archivo adjunto.'
          );
          return;
        }
      }

      // ===============================================
      // REGISTRAR ENLACE EXTERNO
      // ===============================================

      if (linkExterno.trim()) {
        const responseLink = await fetch(
          `${apiUrl}/api/activities/${data.actividadId}/enlaces`,
          {
            method: 'POST',
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              url: linkExterno.trim(),
              nombre: 'Enlace de apoyo',
            }),
          }
        );

        const dataLink =
          await responseLink.json();

        if (!responseLink.ok) {
          Alert.alert(
            'Actividad registrada',
            dataLink.message ||
              'La actividad se creó, pero no fue posible guardar el enlace.'
          );
          return;
        }
      }

      Alert.alert(
        'Éxito',
        'Actividad registrada con éxito.',
        [
          {
            text: 'Aceptar',
            onPress: onRegistered,
          },
        ]
      );
    } catch (error) {
      console.log(
        'ERROR REAL REGISTRANDO ACTIVIDAD:',
        error
      );

      Alert.alert(
        'Error al registrar actividad',
        error?.message ||
          'No fue posible registrar la actividad.'
      );
    } finally {
      setGuardando(false);
    }
  };

  // ===================================================
  // COMPONENTE PARA FECHA Y HORA
  // ===================================================

  const renderCampoFecha = (campo, tituloCampo, valor) => (
    <View>
      <Text style={styles.label}>
        {tituloCampo} *
      </Text>

      <View style={styles.filaFechas}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() =>
            abrirSelector(campo, 'date')
          }
          disabled={guardando}
        >
          <Text style={styles.dateCaption}>
            Fecha
          </Text>

          <Text style={styles.dateValue}>
            {formatearFecha(valor)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() =>
            abrirSelector(campo, 'time')
          }
          disabled={guardando}
        >
          <Text style={styles.dateCaption}>
            Hora
          </Text>

          <Text style={styles.dateValue}>
            {formatearHora(valor)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===================================================
  // ESTADO DE CARGA
  // ===================================================

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORES.primario}
        />

        <Text style={styles.loadingText}>
          Cargando materias asignadas...
        </Text>
      </View>
    );
  }

  // ===================================================
  // INTERFAZ PRINCIPAL
  // ===================================================

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        Registrar actividad
      </Text>

      <Text style={styles.subtitle}>
        Complete los datos académicos de la actividad.
      </Text>

      <Text style={styles.label}>
        Tipo de actividad *
      </Text>

      <View style={styles.options}>
        {[
          'tarea',
          'actividad',
          'examen',
        ].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.option,
              tipo === item &&
                styles.optionSelected,
            ]}
            onPress={() => setTipo(item)}
            disabled={guardando}
          >
            <Text
              style={[
                styles.optionText,
                tipo === item &&
                  styles.optionTextSelected,
              ]}
            >
              {item.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>
        Materia y grupo *
      </Text>

      <View style={styles.options}>
        {asignaciones.length === 0 && (
          <Text style={styles.emptyText}>
            No se encontraron asignaciones
            académicas para este docente.
          </Text>
        )}

        {asignaciones.map((asignacion) => {
          const seleccionado =
            asignacionSeleccionada?.id ===
            asignacion.id;

          return (
            <TouchableOpacity
              key={asignacion.id}
              style={[
                styles.option,
                seleccionado &&
                  styles.optionSelected,
              ]}
              onPress={() =>
                setAsignacionSeleccionada(
                  asignacion
                )
              }
              disabled={guardando}
            >
              <Text style={styles.optionTitle}>
                {asignacion.materia?.nombre}
              </Text>

              <Text style={styles.optionDetail}>
                Grado:{' '}
                {asignacion.grado?.nombre}
              </Text>

              <Text style={styles.optionDetail}>
                Grupo:{' '}
                {asignacion.grupo?.nombre}
              </Text>

              <Text style={styles.optionDetail}>
                Período:{' '}
                {asignacion.periodo?.nombre}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>
        Título *
      </Text>

      <TextInput
        style={styles.input}
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Título de la actividad"
        maxLength={200}
        editable={!guardando}
      />

      <Text style={styles.label}>
        Descripción *
      </Text>

      <TextInput
        style={[
          styles.input,
          styles.textArea,
        ]}
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Descripción de la actividad"
        multiline
        textAlignVertical="top"
        editable={!guardando}
      />

      <Text style={styles.label}>
        Material adicional
      </Text>

      <TouchableOpacity
        style={styles.fileButton}
        onPress={seleccionarArchivo}
        disabled={guardando}
      >
        <Text style={styles.fileButtonText}>
          + Seleccionar archivo
        </Text>
      </TouchableOpacity>

      {archivoSeleccionado && (
        <View style={styles.fileCard}>
          <Text style={styles.fileName}>
            {archivoSeleccionado.name}
          </Text>

          <TouchableOpacity
            onPress={() =>
              setArchivoSeleccionado(null)
            }
            disabled={guardando}
          >
            <Text style={styles.removeFile}>
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
        onChangeText={setLinkExterno}
        placeholder="https://..."
        autoCapitalize="none"
        keyboardType="url"
        editable={!guardando}
      />

      {renderCampoFecha(
        'publicacion',
        'Fecha de publicación',
        fechaPublicacion
      )}

      {renderCampoFecha(
        'entrega',
        'Fecha de entrega',
        fechaEntrega
      )}

      {Platform.OS === 'ios' &&
        selectorIOS && (
          <View style={styles.iosPickerCard}>
            <Text style={styles.iosPickerTitle}>
              Seleccionar{' '}
              {selectorIOS.modo === 'date'
                ? 'fecha'
                : 'hora'}
            </Text>

            <DateTimePicker
              value={
                selectorIOS.campo ===
                'publicacion'
                  ? fechaPublicacion
                  : fechaEntrega
              }
              mode={selectorIOS.modo}
              display="spinner"
              onChange={cambiarSelectorIOS}
              is24Hour
            />

            <TouchableOpacity
              style={styles.iosConfirmButton}
              onPress={cerrarSelectorIOS}
            >
              <Text
                style={styles.iosConfirmText}
              >
                Listo
              </Text>
            </TouchableOpacity>
          </View>
        )}

      <TouchableOpacity
        style={[
          styles.saveButton,
          guardando && styles.disabledButton,
        ]}
        onPress={registrarActividad}
        disabled={guardando}
      >
        {guardando ? (
          <ActivityIndicator
            color={COLORES.blanco}
          />
        ) : (
          <Text style={styles.saveButtonText}>
            Registrar actividad
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        disabled={guardando}
      >
        <Text style={styles.backButtonText}>
          Volver
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 20,
  },

  loadingText: {
    color: COLORES.secundario,
    textAlign: 'center',
  },

  title: {
    fontSize: 25,
    fontWeight: 'bold',
    color: COLORES.texto,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: COLORES.secundario,
    marginBottom: 18,
  },

  label: {
    fontWeight: '600',
    color: COLORES.texto,
    marginTop: 14,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 10,
    padding: 12,
    backgroundColor: COLORES.blanco,
    color: COLORES.texto,
  },

  textArea: {
    minHeight: 120,
  },

  fileButton: {
    borderWidth: 1,
    borderColor: COLORES.primario,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    backgroundColor: COLORES.blanco,
  },

  fileButtonText: {
    color: COLORES.primario,
    fontWeight: 'bold',
  },

  fileCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EAF0F6',
  },

  fileName: {
    fontWeight: '600',
    color: COLORES.texto,
    marginBottom: 6,
  },

  removeFile: {
    color: COLORES.error,
    fontWeight: '600',
  },

  options: {
    gap: 8,
  },

  option: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 10,
    padding: 12,
    backgroundColor: COLORES.blanco,
  },

  optionSelected: {
    borderWidth: 2,
    borderColor: COLORES.primario,
    backgroundColor: '#EAF0F6',
  },

  optionText: {
    color: COLORES.texto,
    fontWeight: '500',
  },

  optionTextSelected: {
    color: COLORES.primario,
    fontWeight: 'bold',
  },

  optionTitle: {
    fontWeight: 'bold',
    color: COLORES.texto,
    marginBottom: 4,
  },

  optionDetail: {
    color: COLORES.secundario,
    marginTop: 2,
  },

  emptyText: {
    color: COLORES.secundario,
    paddingVertical: 12,
  },

  filaFechas: {
    flexDirection: 'row',
    gap: 10,
  },

  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 10,
    padding: 13,
    backgroundColor: COLORES.blanco,
  },

  dateCaption: {
    fontSize: 12,
    color: COLORES.secundario,
    marginBottom: 5,
  },

  dateValue: {
    fontWeight: '600',
    color: COLORES.texto,
    fontSize: 14,
  },

  iosPickerCard: {
    marginTop: 12,
    backgroundColor: COLORES.blanco,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 10,
  },

  iosPickerTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORES.texto,
  },

  iosConfirmButton: {
    backgroundColor: COLORES.primario,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },

  iosConfirmText: {
    color: COLORES.blanco,
    fontWeight: 'bold',
  },

  saveButton: {
    marginTop: 24,
    padding: 15,
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: COLORES.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: COLORES.blanco,
    fontWeight: 'bold',
  },

  backButton: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
  },

  backButtonText: {
    color: COLORES.secundario,
    fontWeight: '600',
  },
});

export default RegisterActivityScreen;
