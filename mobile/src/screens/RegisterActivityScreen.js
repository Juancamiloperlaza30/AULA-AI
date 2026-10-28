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

import { Ionicons } from '@expo/vector-icons';

import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';

// =====================================================
// AULA-AI | HU-04 / HU-08
// REGISTRO DE ACTIVIDADES ACADÉMICAS
// REDISEÑO PREMIUM
//
// Se conservan:
// - Consulta de asignaciones del docente.
// - Tipos de actividad.
// - Validaciones del formulario.
// - Fechas ISO para el backend.
// - Selectores nativos Android e iOS.
// - Registro con reintentos.
// - Archivos adjuntos y enlaces.
// - Navegación y callbacks originales.
// =====================================================

const COLORES = {
  navy: '#091D3A',
  primario: '#123B73',
  cyan: '#27C4E8',
  fondo: '#F4F7FB',
  blanco: '#FFFFFF',
  texto: '#334155',
  secundario: '#718096',
  borde: '#DFE7F0',
  pale: '#EAF3FC',
  error: '#B91C1C',
  errorFondo: '#FEF2F2',
  verde: '#15803D',
  verdeFondo: '#ECFDF3',
};

const TIPOS_ACTIVIDAD = [
  {
    id: 'tarea',
    titulo: 'Tarea',
    icono: 'clipboard-outline',
    descripcion: 'Trabajo asignado',
  },
  {
    id: 'actividad',
    titulo: 'Actividad',
    icono: 'book-outline',
    descripcion: 'Trabajo académico',
  },
  {
    id: 'examen',
    titulo: 'Examen',
    icono: 'document-text-outline',
    descripcion: 'Evaluación',
  },
];

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
  if (!fechaValida(fecha)) {
    return 'Sin fecha';
  }

  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatearHora = (fecha) => {
  if (!fechaValida(fecha)) {
    return 'Sin hora';
  }

  return fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// =====================================================
// COMPONENTES VISUALES
// =====================================================

const EncabezadoSeccion = ({
  icono,
  titulo,
  descripcion,
  numero,
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIcon}>
      <Ionicons
        name={icono}
        size={21}
        color={COLORES.primario}
      />
    </View>

    <View style={styles.sectionHeaderText}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>
          {titulo}
        </Text>

        {numero ? (
          <View style={styles.sectionNumber}>
            <Text style={styles.sectionNumberText}>
              {numero}
            </Text>
          </View>
        ) : null}
      </View>

      {descripcion ? (
        <Text style={styles.sectionDescription}>
          {descripcion}
        </Text>
      ) : null}
    </View>
  </View>
);

const EtiquetaCampo = ({
  texto,
  obligatorio = false,
}) => (
  <View style={styles.labelRow}>
    <Text style={styles.label}>
      {texto}
    </Text>

    {obligatorio && (
      <Text style={styles.requiredMark}>
        *
      </Text>
    )}
  </View>
);

// =====================================================
// PANTALLA PRINCIPAL
// =====================================================

const RegisterActivityScreen = ({
  apiUrl,
  accessToken,
  onBack,
  onRegistered,
}) => {
  // ===================================================
  // ESTADOS ORIGINALES
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
  // CONSULTAR ASIGNACIONES
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
  // SELECTORES DE FECHA Y HORA
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
  // SELECCIÓN DE ARCHIVO
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
  // LÓGICA ORIGINAL CONSERVADA
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
  // COMPONENTE DE FECHA Y HORA
  // ===================================================

  const renderCampoFecha = (
    campo,
    tituloCampo,
    valor
  ) => (
    <View style={styles.dateSection}>
      <EtiquetaCampo
        texto={tituloCampo}
        obligatorio
      />

      <View style={styles.filaFechas}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() =>
            abrirSelector(campo, 'date')
          }
          disabled={guardando}
          activeOpacity={0.8}
        >
          <View style={styles.dateIcon}>
            <Ionicons
              name="calendar-outline"
              size={21}
              color={COLORES.primario}
            />
          </View>

          <Text style={styles.dateCaption}>
            FECHA
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
          activeOpacity={0.8}
        >
          <View style={styles.dateIcon}>
            <Ionicons
              name="time-outline"
              size={21}
              color={COLORES.primario}
            />
          </View>

          <Text style={styles.dateCaption}>
            HORA
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
        <View style={styles.loadingIcon}>
          <Ionicons
            name="school-outline"
            size={35}
            color={COLORES.primario}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORES.primario}
        />

        <Text style={styles.loadingTitle}>
          Preparando registro
        </Text>

        <Text style={styles.loadingText}>
          Cargando las materias y grupos
          asignados al docente...
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
      {/* ============================================ */}
      {/* ENCABEZADO PREMIUM */}
      {/* ============================================ */}

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={onBack}
            disabled={guardando}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={COLORES.blanco}
            />

            <Text style={styles.headerBackText}>
              Volver
            </Text>
          </TouchableOpacity>

          <View style={styles.headerBadge}>
            <Ionicons
              name="school-outline"
              size={14}
              color={COLORES.cyan}
            />

            <Text style={styles.headerBadgeText}>
              DOCENTE
            </Text>
          </View>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="create-outline"
            size={29}
            color={COLORES.blanco}
          />
        </View>

        <Text style={styles.headerTitle}>
          Registrar actividad
        </Text>

        <Text style={styles.headerSubtitle}>
          Organiza las actividades académicas,
          asigna fechas y comparte recursos
          con tus estudiantes.
        </Text>
      </View>

      {/* ============================================ */}
      {/* MENSAJE INFORMATIVO */}
      {/* ============================================ */}

      <View style={styles.introCard}>
        <Ionicons
          name="information-circle-outline"
          size={22}
          color={COLORES.primario}
        />

        <Text style={styles.introText}>
          Completa los datos del formulario.
          Los campos marcados con * son
          obligatorios.
        </Text>
      </View>

      {/* ============================================ */}
      {/* SECCIÓN 1: TIPO DE ACTIVIDAD */}
      {/* ============================================ */}

      <View style={styles.sectionCard}>
        <EncabezadoSeccion
          icono="apps-outline"
          titulo="Tipo de actividad"
          descripcion="Selecciona la categoría académica."
          numero="01"
        />

        <EtiquetaCampo
          texto="Categoría"
          obligatorio
        />

        <View style={styles.typesContainer}>
          {TIPOS_ACTIVIDAD.map((item) => {
            const seleccionado =
              tipo === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.typeCard,
                  seleccionado &&
                    styles.typeCardSelected,
                ]}
                onPress={() =>
                  setTipo(item.id)
                }
                disabled={guardando}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.typeIcon,
                    seleccionado &&
                      styles.typeIconSelected,
                  ]}
                >
                  <Ionicons
                    name={item.icono}
                    size={22}
                    color={
                      seleccionado
                        ? COLORES.blanco
                        : COLORES.primario
                    }
                  />
                </View>

                <Text
                  style={[
                    styles.typeTitle,
                    seleccionado &&
                      styles.typeTitleSelected,
                  ]}
                >
                  {item.titulo}
                </Text>

                <Text style={styles.typeDescription}>
                  {item.descripcion}
                </Text>

                <Ionicons
                  name={
                    seleccionado
                      ? 'checkmark-circle'
                      : 'ellipse-outline'
                  }
                  size={19}
                  color={
                    seleccionado
                      ? COLORES.primario
                      : COLORES.borde
                  }
                  style={styles.typeCheck}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ============================================ */}
      {/* SECCIÓN 2: ASIGNACIÓN ACADÉMICA */}
      {/* ============================================ */}

      <View style={styles.sectionCard}>
        <EncabezadoSeccion
          icono="school-outline"
          titulo="Asignación académica"
          descripcion="Elige la materia y el grupo."
          numero="02"
        />

        <EtiquetaCampo
          texto="Materia y grupo"
          obligatorio
        />

        {asignaciones.length === 0 ? (
          <View style={styles.emptyAssignments}>
            <Ionicons
              name="folder-open-outline"
              size={34}
              color={COLORES.primario}
            />

            <Text style={styles.emptyTitle}>
              Sin asignaciones disponibles
            </Text>

            <Text style={styles.emptyText}>
              No se encontraron asignaciones
              académicas para este docente.
            </Text>
          </View>
        ) : (
          <View style={styles.assignmentsContainer}>
            {asignaciones.map((asignacion) => {
              const seleccionado =
                asignacionSeleccionada?.id ===
                asignacion.id;

              return (
                <TouchableOpacity
                  key={String(asignacion.id)}
                  style={[
                    styles.assignmentCard,
                    seleccionado &&
                      styles.assignmentSelected,
                  ]}
                  onPress={() =>
                    setAsignacionSeleccionada(
                      asignacion
                    )
                  }
                  disabled={guardando}
                  activeOpacity={0.8}
                >
                  <View style={styles.assignmentTop}>
                    <View style={styles.assignmentIcon}>
                      <Ionicons
                        name="book-outline"
                        size={20}
                        color={COLORES.primario}
                      />
                    </View>

                    <View style={styles.assignmentTitleBox}>
                      <Text style={styles.assignmentTitle}>
                        {asignacion.materia?.nombre ||
                          'Materia sin nombre'}
                      </Text>

                      <Text style={styles.assignmentSubtitle}>
                        Asignación académica
                      </Text>
                    </View>

                    <Ionicons
                      name={
                        seleccionado
                          ? 'checkmark-circle'
                          : 'ellipse-outline'
                      }
                      size={23}
                      color={
                        seleccionado
                          ? COLORES.primario
                          : COLORES.borde
                      }
                    />
                  </View>

                  <View style={styles.assignmentDetails}>
                    <View style={styles.assignmentDetail}>
                      <Ionicons
                        name="school-outline"
                        size={15}
                        color={COLORES.secundario}
                      />

                      <Text style={styles.assignmentDetailText}>
                        Grado:{' '}
                        {asignacion.grado?.nombre ||
                          '-'}
                      </Text>
                    </View>

                    <View style={styles.assignmentDetail}>
                      <Ionicons
                        name="people-outline"
                        size={15}
                        color={COLORES.secundario}
                      />

                      <Text style={styles.assignmentDetailText}>
                        Grupo:{' '}
                        {asignacion.grupo?.nombre ||
                          '-'}
                      </Text>
                    </View>

                    <View style={styles.assignmentDetail}>
                      <Ionicons
                        name="calendar-outline"
                        size={15}
                        color={COLORES.secundario}
                      />

                      <Text style={styles.assignmentDetailText}>
                        Período:{' '}
                        {asignacion.periodo?.nombre ||
                          '-'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ============================================ */}
      {/* SECCIÓN 3: INFORMACIÓN DE LA ACTIVIDAD */}
      {/* ============================================ */}

      <View style={styles.sectionCard}>
        <EncabezadoSeccion
          icono="document-text-outline"
          titulo="Información de la actividad"
          descripcion="Describe el trabajo que realizarán los estudiantes."
          numero="03"
        />

        <EtiquetaCampo
          texto="Título de la actividad"
          obligatorio
        />

        <View style={styles.inputContainer}>
          <Ionicons
            name="text-outline"
            size={20}
            color={COLORES.secundario}
          />

          <TextInput
            style={styles.inputWithIcon}
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Ej. Taller de matemáticas"
            placeholderTextColor={COLORES.secundario}
            maxLength={200}
            editable={!guardando}
          />
        </View>

        <Text style={styles.characterCounter}>
          {titulo.length}/200 caracteres
        </Text>

        <EtiquetaCampo
          texto="Descripción"
          obligatorio
        />

        <TextInput
          style={styles.textArea}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Describe las instrucciones, objetivos y actividades que deben desarrollar los estudiantes..."
          placeholderTextColor={COLORES.secundario}
          multiline
          textAlignVertical="top"
          editable={!guardando}
        />
      </View>

      {/* ============================================ */}
      {/* SECCIÓN 4: RECURSOS ADICIONALES */}
      {/* ============================================ */}

      <View style={styles.sectionCard}>
        <EncabezadoSeccion
          icono="attach-outline"
          titulo="Recursos de apoyo"
          descripcion="Adjunta materiales complementarios."
          numero="04"
        />

        <View style={styles.optionalBadge}>
          <Ionicons
            name="information-circle-outline"
            size={15}
            color={COLORES.primario}
          />

          <Text style={styles.optionalText}>
            Esta sección es opcional
          </Text>
        </View>

        <EtiquetaCampo texto="Archivo adjunto" />

        <TouchableOpacity
          style={styles.fileButton}
          onPress={seleccionarArchivo}
          disabled={guardando}
          activeOpacity={0.8}
        >
          <View style={styles.fileButtonIcon}>
            <Ionicons
              name="cloud-upload-outline"
              size={25}
              color={COLORES.primario}
            />
          </View>

          <Text style={styles.fileButtonTitle}>
            Seleccionar archivo
          </Text>

          <Text style={styles.fileButtonSubtitle}>
            Pulsa aquí para buscar un documento
          </Text>
        </TouchableOpacity>

        {archivoSeleccionado && (
          <View style={styles.fileCard}>
            <View style={styles.selectedFileIcon}>
              <Ionicons
                name="document-attach-outline"
                size={23}
                color={COLORES.primario}
              />
            </View>

            <View style={styles.selectedFileInfo}>
              <Text
                style={styles.fileName}
                numberOfLines={2}
              >
                {archivoSeleccionado.name}
              </Text>

              <Text style={styles.fileSelectedLabel}>
                Archivo seleccionado
              </Text>
            </View>

            <TouchableOpacity
              style={styles.removeFileButton}
              onPress={() =>
                setArchivoSeleccionado(null)
              }
              disabled={guardando}
            >
              <Ionicons
                name="close-circle-outline"
                size={24}
                color={COLORES.error}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.fieldSeparator} />

        <EtiquetaCampo texto="Enlace externo" />

        <View style={styles.inputContainer}>
          <Ionicons
            name="link-outline"
            size={20}
            color={COLORES.secundario}
          />

          <TextInput
            style={styles.inputWithIcon}
            value={linkExterno}
            onChangeText={setLinkExterno}
            placeholder="https://..."
            placeholderTextColor={COLORES.secundario}
            autoCapitalize="none"
            keyboardType="url"
            editable={!guardando}
          />
        </View>

        <Text style={styles.helperText}>
          Puedes agregar un enlace a material
          educativo o recursos complementarios.
        </Text>
      </View>

      {/* ============================================ */}
      {/* SECCIÓN 5: FECHAS */}
      {/* ============================================ */}

      <View style={styles.sectionCard}>
        <EncabezadoSeccion
          icono="calendar-outline"
          titulo="Programación"
          descripcion="Define cuándo se publica y cuándo vence la actividad."
          numero="05"
        />

        {renderCampoFecha(
          'publicacion',
          'Fecha de publicación',
          fechaPublicacion
        )}

        <View style={styles.dateDivider}>
          <Ionicons
            name="arrow-down-outline"
            size={18}
            color={COLORES.secundario}
          />
        </View>

        {renderCampoFecha(
          'entrega',
          'Fecha de entrega',
          fechaEntrega
        )}

        <View style={styles.dateInfo}>
          <Ionicons
            name="alert-circle-outline"
            size={19}
            color={COLORES.primario}
          />

          <Text style={styles.dateInfoText}>
            La fecha de entrega debe ser posterior
            a la fecha de publicación.
          </Text>
        </View>

        {/* SELECTOR NATIVO IOS */}

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
                <Text style={styles.iosConfirmText}>
                  Listo
                </Text>
              </TouchableOpacity>
            </View>
          )}
      </View>

      {/* ============================================ */}
      {/* ACCIONES FINALES */}
      {/* ============================================ */}

      <View style={styles.actionsCard}>
        <View style={styles.actionsInfo}>
          <Ionicons
            name="shield-checkmark-outline"
            size={21}
            color={COLORES.verde}
          />

          <Text style={styles.actionsInfoText}>
            Verifica los datos antes de registrar
            la actividad académica.
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            guardando && styles.disabledButton,
          ]}
          onPress={registrarActividad}
          disabled={guardando}
          activeOpacity={0.85}
        >
          {guardando ? (
            <>
              <ActivityIndicator
                color={COLORES.blanco}
                size="small"
              />

              <Text style={styles.saveButtonText}>
                Registrando actividad...
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={22}
                color={COLORES.blanco}
              />

              <Text style={styles.saveButtonText}>
                Registrar actividad
              </Text>

              <Ionicons
                name="arrow-forward"
                size={19}
                color={COLORES.blanco}
              />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          disabled={guardando}
          activeOpacity={0.8}
        >
          <Ionicons
            name="arrow-back-outline"
            size={19}
            color={COLORES.primario}
          />

          <Text style={styles.backButtonText}>
            Volver sin registrar
          </Text>
        </TouchableOpacity>
      </View>

      {/* ============================================ */}
      {/* PIE DE PÁGINA */}
      {/* ============================================ */}

      <View style={styles.footer}>
        <Ionicons
          name="shield-checkmark-outline"
          size={15}
          color={COLORES.secundario}
        />

        <Text style={styles.footerText}>
          Gestión académica · AULA-AI
        </Text>
      </View>
    </ScrollView>
  );
};

// =====================================================
// ESTILOS PREMIUM
// =====================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },

  container: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },

  // ===================================================
  // ENCABEZADO
  // ===================================================

  header: {
    backgroundColor: COLORES.navy,
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 35,
    marginBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },

  headerBackText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORES.blanco,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
  },

  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORES.blanco,
  },

  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORES.primario,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  headerTitle: {
    fontSize: 27,
    fontWeight: '900',
    color: COLORES.blanco,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: '#D6E4F2',
  },

  // ===================================================
  // INFORMACIÓN
  // ===================================================

  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORES.pale,
    borderRadius: 15,
    padding: 16,
    gap: 11,
    marginBottom: 20,
  },

  introText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 20,
    color: COLORES.texto,
  },

  // ===================================================
  // SECCIONES
  // ===================================================

  sectionCard: {
    backgroundColor: COLORES.blanco,
    borderRadius: 21,
    padding: 19,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORES.borde,
    shadowColor: COLORES.navy,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORES.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  sectionTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
    color: COLORES.navy,
  },

  sectionDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORES.secundario,
    marginTop: 5,
  },

  sectionNumber: {
    backgroundColor: COLORES.pale,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  sectionNumberText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORES.primario,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    marginBottom: 10,
  },

  label: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORES.navy,
  },

  requiredMark: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORES.error,
  },

  // ===================================================
  // TIPOS DE ACTIVIDAD
  // ===================================================

  typesContainer: {
    flexDirection: 'row',
    gap: 8,
  },

  typeCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 15,
    paddingHorizontal: 5,
    paddingVertical: 15,
  },

  typeCardSelected: {
    backgroundColor: COLORES.pale,
    borderColor: COLORES.primario,
    borderWidth: 2,
  },

  typeIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: COLORES.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  typeIconSelected: {
    backgroundColor: COLORES.primario,
  },

  typeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORES.navy,
    textAlign: 'center',
  },

  typeTitleSelected: {
    color: COLORES.primario,
  },

  typeDescription: {
    fontSize: 9,
    lineHeight: 14,
    color: COLORES.secundario,
    textAlign: 'center',
    marginTop: 5,
    minHeight: 28,
  },

  typeCheck: {
    marginTop: 7,
  },

  // ===================================================
  // ASIGNACIONES
  // ===================================================

  assignmentsContainer: {
    gap: 11,
  },

  assignmentCard: {
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 15,
    padding: 15,
  },

  assignmentSelected: {
    backgroundColor: COLORES.pale,
    borderWidth: 2,
    borderColor: COLORES.primario,
  },

  assignmentTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  assignmentIcon: {
    width: 41,
    height: 41,
    borderRadius: 12,
    backgroundColor: COLORES.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  assignmentTitleBox: {
    flex: 1,
  },

  assignmentTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORES.navy,
    marginBottom: 4,
  },

  assignmentSubtitle: {
    fontSize: 11,
    color: COLORES.secundario,
  },

  assignmentDetails: {
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
    gap: 9,
  },

  assignmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  assignmentDetailText: {
    flex: 1,
    fontSize: 12,
    color: COLORES.texto,
    fontWeight: '600',
  },

  emptyAssignments: {
    backgroundColor: '#F8FAFD',
    borderRadius: 15,
    padding: 24,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORES.navy,
    marginTop: 12,
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORES.secundario,
    marginTop: 8,
    textAlign: 'center',
  },

  // ===================================================
  // CAMPOS DEL FORMULARIO
  // ===================================================

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 53,
    gap: 10,
  },

  inputWithIcon: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: COLORES.navy,
    paddingVertical: 12,
  },

  textArea: {
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 13,
    padding: 14,
    minHeight: 135,
    fontSize: 13,
    lineHeight: 21,
    color: COLORES.navy,
  },

  characterCounter: {
    fontSize: 10,
    color: COLORES.secundario,
    textAlign: 'right',
    marginTop: 6,
  },

  helperText: {
    fontSize: 11,
    lineHeight: 18,
    color: COLORES.secundario,
    marginTop: 9,
  },

  fieldSeparator: {
    height: 1,
    backgroundColor: COLORES.borde,
    marginVertical: 19,
  },

  // ===================================================
  // ARCHIVOS
  // ===================================================

  optionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    backgroundColor: COLORES.pale,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 13,
  },

  optionalText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORES.primario,
  },

  fileButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORES.primario,
    backgroundColor: '#F8FAFD',
    borderRadius: 15,
    paddingVertical: 22,
    paddingHorizontal: 15,
    alignItems: 'center',
  },

  fileButtonIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: COLORES.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  fileButtonTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORES.primario,
    marginBottom: 5,
  },

  fileButtonSubtitle: {
    fontSize: 11,
    color: COLORES.secundario,
    textAlign: 'center',
  },

  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORES.verdeFondo,
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },

  selectedFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: COLORES.blanco,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedFileInfo: {
    flex: 1,
  },

  fileName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORES.navy,
  },

  fileSelectedLabel: {
    fontSize: 10,
    color: COLORES.verde,
    marginTop: 4,
  },

  removeFileButton: {
    padding: 5,
  },

  // ===================================================
  // FECHAS
  // ===================================================

  dateSection: {
    marginBottom: 6,
  },

  filaFechas: {
    flexDirection: 'row',
    gap: 10,
  },

  dateButton: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 14,
    padding: 13,
  },

  dateIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: COLORES.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },

  dateCaption: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORES.secundario,
    marginBottom: 6,
  },

  dateValue: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORES.navy,
  },

  dateDivider: {
    alignItems: 'center',
    paddingVertical: 13,
  },

  dateInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORES.pale,
    borderRadius: 13,
    padding: 13,
    marginTop: 18,
  },

  dateInfoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    color: COLORES.texto,
  },

  iosPickerCard: {
    marginTop: 14,
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 12,
  },

  iosPickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    color: COLORES.navy,
  },

  iosConfirmButton: {
    backgroundColor: COLORES.primario,
    padding: 13,
    borderRadius: 11,
    alignItems: 'center',
  },

  iosConfirmText: {
    color: COLORES.blanco,
    fontWeight: '800',
  },

  // ===================================================
  // ACCIONES
  // ===================================================

  actionsCard: {
    backgroundColor: COLORES.blanco,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },

  actionsInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORES.verdeFondo,
    padding: 13,
    borderRadius: 13,
    marginBottom: 17,
  },

  actionsInfoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    color: COLORES.texto,
  },

  saveButton: {
    minHeight: 58,
    backgroundColor: COLORES.primario,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 3,
    borderBottomColor: COLORES.cyan,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORES.blanco,
  },

  backButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 13,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  backButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORES.primario,
  },

  // ===================================================
  // CARGA
  // ===================================================

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORES.fondo,
    paddingHorizontal: 25,
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 23,
    backgroundColor: COLORES.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 23,
  },

  loadingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORES.navy,
    marginTop: 18,
  },

  loadingText: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORES.secundario,
    textAlign: 'center',
    marginTop: 9,
  },

  // ===================================================
  // PIE DE PÁGINA
  // ===================================================

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 24,
  },

  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORES.secundario,
  },
});

export default RegisterActivityScreen;