import {
  useEffect,
  useState,
} from 'react';

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

import DateTimePicker from '@react-native-community/datetimepicker';

const RegisterActivityScreen = ({
  apiUrl,
  accessToken,
  onBack,
  onRegistered,
}) => {
  const [tipo, setTipo] =
    useState('tarea');

  const [titulo, setTitulo] =
    useState('');

  const [descripcion, setDescripcion] =
    useState('');

  const [archivoSeleccionado, setArchivoSeleccionado] =
    useState(null);

  const [linkExterno, setLinkExterno] =
    useState('');

  const [
    asignaciones,
    setAsignaciones,
  ] = useState([]);

  const [
    asignacionSeleccionada,
    setAsignacionSeleccionada,
  ] = useState(null);

  const [
    fechaPublicacion,
    setFechaPublicacion,
  ] = useState(new Date());

  const [
    fechaEntrega,
    setFechaEntrega,
  ] = useState(
    () =>
      new Date(
        Date.now() +
          24 * 60 * 60 * 1000
      )
  );

  const [
    mostrarFechaPublicacion,
    setMostrarFechaPublicacion,
  ] = useState(false);

  const [
    mostrarFechaEntrega,
    setMostrarFechaEntrega,
  ] = useState(false);

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  useEffect(() => {
    let activo = true;

    const cargarAsignaciones = async () => {
      try {
        setCargando(true);

        const response = await fetch(
          `${apiUrl}/api/activities/mis-asignaciones`,
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
          Alert.alert(
            'Error',
            data.message ||
              'No fue posible cargar las materias asignadas.'
          );

          return;
        }

        if (activo) {
          setAsignaciones(
            data.asignaciones || []
          );
        }
      } catch (error) {
        if (!activo) {
          return;
        }

        console.log(
          'ERROR REAL CONSULTANDO ASIGNACIONES:',
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

  const seleccionarArchivo = async () => {
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

  const generarClientRequestId =
    () => {
      return Crypto.randomUUID();
    };

  const registrarActividad =
    async () => {
      if (guardando) {
        return;
      }

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
          fechaEntrega <
          fechaPublicacion
        ) {
          Alert.alert(
            'Fecha no válida',
            'La fecha de entrega no puede ser anterior a la fecha de publicación.'
          );

          return;
        }

        const clientRequestId =
          generarClientRequestId();

        const body = {
          materiaGrupoPeriodoId:
            asignacionSeleccionada.id,

          tipo,

          titulo:
            titulo.trim(),

          descripcion:
            descripcion.trim(),

          fechaPublicacion:
            fechaPublicacion.toISOString(),

          fechaEntrega:
            fechaEntrega.toISOString(),

          clientRequestId,
        };

        const esperar = (ms) =>
          new Promise(
            (resolve) =>
              setTimeout(resolve, ms)
          );

        let response = null;

        const tiemposEspera = [
          1000,
          2000,
          4000,
          8000,
        ];

        for (
          let intento = 0;
          intento < 5;
          intento++
        ) {
          try {
            response =
              await fetch(
                `${apiUrl}/api/activities`,
                {
                  method: 'POST',

                  headers: {
                    Authorization:
                      `Bearer ${accessToken}`,

                    'Content-Type':
                      'application/json',
                  },

                  body:
                    JSON.stringify(body),
                }
              );

            break;
          } catch (error) {
            console.log(
              `Intento ${
                intento + 1
              } fallido al registrar actividad.`,
              error
            );

            if (intento < 4) {
              await esperar(
                tiemposEspera[intento]
              );
            }
          }
        }

        if (!response) {
          throw new Error(
            'No hay conexión con el servidor. Verifique su conexión e intente nuevamente.'
          );
        }

        const data =
          await response.json();

        if (!response.ok) {
          Alert.alert(
            'Error',
            data.message ||
              'No fue posible registrar la actividad.'
          );

          return;
        }

        if (archivoSeleccionado) {
          const archivo =
            new File(
              archivoSeleccionado.uri
            );

          const tareaSubida =
            archivo.createUploadTask(
              `${apiUrl}/api/activities/${data.actividadId}/recursos`,
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

        if (linkExterno.trim()) {
          const responseLink =
            await fetch(
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
                  nombre:
                    'Enlace de apoyo',
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
              onPress:
                onRegistered,
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

  const formatearFecha =
    (fecha) => {
      return fecha.toLocaleString();
    };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

        <Text>
          Cargando materias asignadas...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >
      <Text style={styles.title}>
        Registrar actividad
      </Text>

      <Text style={styles.label}>
        Tipo *
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
            onPress={() =>
              setTipo(item)
            }
          >
            <Text>
              {item.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>
        Materia y grupo *
      </Text>

      <View style={styles.options}>
        {asignaciones.map(
          (asignacion) => {
            const seleccionado =
              asignacionSeleccionada
                ?.id ===
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
              >
                <Text
                  style={
                    styles.optionTitle
                  }
                >
                  {
                    asignacion.materia
                      ?.nombre
                  }
                </Text>

                <Text>
                  Grado:{' '}
                  {
                    asignacion.grado
                      ?.nombre
                  }
                </Text>

                <Text>
                  Grupo:{' '}
                  {
                    asignacion.grupo
                      ?.nombre
                  }
                </Text>

                <Text>
                  Periodo:{' '}
                  {
                    asignacion.periodo
                      ?.nombre
                  }
                </Text>
              </TouchableOpacity>
            );
          }
        )}
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
      />

      <Text style={styles.label}>
        Material adicional
      </Text>

      <TouchableOpacity
        style={styles.fileButton}
        onPress={seleccionarArchivo}
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
      />

      <Text style={styles.label}>
        Fecha de publicación *
      </Text>

      <TouchableOpacity
        style={styles.dateButton}
        onPress={() =>
          setMostrarFechaPublicacion(
            true
          )
        }
      >
        <Text>
          {formatearFecha(
            fechaPublicacion
          )}
        </Text>
      </TouchableOpacity>

      {mostrarFechaPublicacion && (
        <DateTimePicker
          value={fechaPublicacion}
          mode="datetime"
          display={
            Platform.OS === 'ios'
              ? 'spinner'
              : 'default'
          }
          onChange={(
            event,
            selectedDate
          ) => {
            setMostrarFechaPublicacion(
              Platform.OS === 'ios'
            );

            if (selectedDate) {
              setFechaPublicacion(
                selectedDate
              );
            }
          }}
        />
      )}

      <Text style={styles.label}>
        Fecha de entrega *
      </Text>

      <TouchableOpacity
        style={styles.dateButton}
        onPress={() =>
          setMostrarFechaEntrega(
            true
          )
        }
      >
        <Text>
          {formatearFecha(
            fechaEntrega
          )}
        </Text>
      </TouchableOpacity>

      {mostrarFechaEntrega && (
        <DateTimePicker
          value={fechaEntrega}
          mode="datetime"
          display={
            Platform.OS === 'ios'
              ? 'spinner'
              : 'default'
          }
          onChange={(
            event,
            selectedDate
          ) => {
            setMostrarFechaEntrega(
              Platform.OS === 'ios'
            );

            if (selectedDate) {
              setFechaEntrega(
                selectedDate
              );
            }
          }}
        />
      )}

      <TouchableOpacity
        style={[
          styles.saveButton,
          guardando && {
            opacity: 0.6,
          },
        ]}
        onPress={registrarActividad}
        disabled={guardando}
      >
        <Text
          style={
            styles.saveButtonText
          }
        >
          {guardando
            ? 'Registrando...'
            : 'Registrar actividad'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text>
          Volver
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles =
  StyleSheet.create({
    container: {
      padding: 20,
      paddingBottom: 40,
    },

    center: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      gap: 10,
    },

    title: {
      fontSize: 25,
      fontWeight: 'bold',
      marginBottom: 20,
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

    options: {
      gap: 8,
    },

    option: {
      borderWidth: 1,
      borderColor: '#D5DCE5',
      borderRadius: 10,
      padding: 12,
    },

    optionSelected: {
      borderWidth: 2,
      borderColor: '#2D405D',
    },

    optionTitle: {
      fontWeight: 'bold',
      marginBottom: 4,
    },

    dateButton: {
      borderWidth: 1,
      borderColor: '#D5DCE5',
      borderRadius: 10,
      padding: 14,
      backgroundColor: '#FFFFFF',
    },

    saveButton: {
      marginTop: 24,
      padding: 15,
      borderRadius: 10,
      backgroundColor: '#2D405D',
      alignItems: 'center',
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
    },

    backButton: {
      marginTop: 12,
      padding: 14,
      alignItems: 'center',
    },
  });

export default RegisterActivityScreen;
