'use strict';

// ======================================================
// AULA-AI | HU-12
// PUBLICACION DE COMUNICADOS INSTITUCIONALES
// ======================================================

import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  publicarComunicado,
} from '../services/comunicadoService';

const ROLES_DESTINATARIOS = [
  { id: 'administrador', nombre: 'Administrador' },
  { id: 'coordinador', nombre: 'Coordinador' },
  { id: 'docente', nombre: 'Docente' },
  { id: 'orientador', nombre: 'Orientador' },
  { id: 'estudiante', nombre: 'Estudiante' },
  { id: 'acudiente', nombre: 'Acudiente' },
];

const ALCANCES = [
  {
    id: 'general',
    nombre: 'Toda la institución',
    descripcion: 'Todos los usuarios activos.',
  },
  {
    id: 'roles',
    nombre: 'Por roles',
    descripcion: 'Seleccionar uno o varios roles.',
  },
  {
    id: 'grado',
    nombre: 'Por grado',
    descripcion: 'Estudiantes y acudientes de un grado.',
  },
  {
    id: 'grupo',
    nombre: 'Por grupo',
    descripcion: 'Estudiantes y acudientes de un grupo.',
  },
];

const obtenerMensajeError = (error) =>
  error?.message || 'Ocurrió un error inesperado.';

const esIdValido = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return false;
  }

  const numero = Number(valor);

  return Number.isSafeInteger(numero) && numero > 0;
};

const consultarEstructuraAcademica = async ({
  apiUrl,
  accessToken,
  ruta,
  signal,
}) => {
  const response = await fetch(
    `${apiUrl.replace(/\/+$/, '')}${ruta}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal,
    }
  );

  let resultado;

  try {
    resultado = await response.json();
  } catch {
    throw new Error(
      'El servidor devolvió una respuesta inválida.'
    );
  }

  if (!response.ok || resultado?.success === false) {
    throw new Error(
      resultado?.message ||
        'No fue posible consultar la estructura académica.'
    );
  }

  return resultado;
};

export default function PublishCommunicationScreen({
  apiUrl,
  accessToken,
  rol,
  onBack,
  onSuccess,
}) {
  const esAdministrador = rol === 'administrador';
  const esCoordinador = rol === 'coordinador';
  const puedePublicar = esAdministrador || esCoordinador;

  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [alcanceTipo, setAlcanceTipo] = useState(
    esCoordinador ? 'grupo' : 'general'
  );
  const [alcanceRoles, setAlcanceRoles] = useState([]);
  const [grados, setGrados] = useState([]);
  const [gradoId, setGradoId] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState(null);
  const [cargandoGrados, setCargandoGrados] =
    useState(esCoordinador);
  const [cargandoGrupos, setCargandoGrupos] =
    useState(false);
  const [publicando, setPublicando] = useState(false);

  useEffect(() => {
    if (
      !['grado', 'grupo'].includes(alcanceTipo) ||
      !apiUrl ||
      !accessToken
    ) {
      return undefined;
    }

    const controller = new AbortController();
    let activa = true;

    consultarEstructuraAcademica({
      apiUrl,
      accessToken,
      ruta: '/api/academic/grados',
      signal: controller.signal,
    })
      .then((resultado) => {
        if (activa) {
          setGrados(
            Array.isArray(resultado.grados)
              ? resultado.grados
              : []
          );
        }
      })
      .catch((error) => {
        if (activa && error?.name !== 'AbortError') {
          Alert.alert(
            'Error consultando grados',
            obtenerMensajeError(error)
          );
        }
      })
      .finally(() => {
        if (activa) {
          setCargandoGrados(false);
        }
      });

    return () => {
      activa = false;
      controller.abort();
    };
  }, [alcanceTipo, apiUrl, accessToken]);

  useEffect(() => {
    if (
      alcanceTipo !== 'grupo' ||
      !esIdValido(gradoId) ||
      !apiUrl ||
      !accessToken
    ) {
      return undefined;
    }

    const controller = new AbortController();
    let activa = true;

    consultarEstructuraAcademica({
      apiUrl,
      accessToken,
      ruta: `/api/academic/grados/${gradoId}/grupos`,
      signal: controller.signal,
    })
      .then((resultado) => {
        if (activa) {
          setGrupos(
            Array.isArray(resultado.grupos)
              ? resultado.grupos
              : []
          );
        }
      })
      .catch((error) => {
        if (activa && error?.name !== 'AbortError') {
          Alert.alert(
            'Error consultando grupos',
            obtenerMensajeError(error)
          );
        }
      })
      .finally(() => {
        if (activa) {
          setCargandoGrupos(false);
        }
      });

    return () => {
      activa = false;
      controller.abort();
    };
  }, [alcanceTipo, apiUrl, accessToken, gradoId]);

  const seleccionarAlcance = (nuevoAlcance) => {
    setAlcanceTipo(nuevoAlcance);
    setAlcanceRoles([]);
    setGradoId(null);
    setGrupoId(null);
    setGrupos([]);
    setCargandoGrados(
      ['grado', 'grupo'].includes(nuevoAlcance)
    );
    setCargandoGrupos(false);
  };

  const seleccionarGrado = (id) => {
    setGradoId(id);
    setGrupoId(null);
    setGrupos([]);
    setCargandoGrupos(alcanceTipo === 'grupo');
  };

  const alternarRol = (rolSeleccionado) => {
    setAlcanceRoles((actuales) =>
      actuales.includes(rolSeleccionado)
        ? actuales.filter((item) => item !== rolSeleccionado)
        : [...actuales, rolSeleccionado]
    );
  };

  const validarFormulario = () => {
    if (!puedePublicar) {
      Alert.alert(
        'Acceso restringido',
        'No tienes permisos para publicar comunicados.'
      );
      return false;
    }

    if (!titulo.trim()) {
      Alert.alert(
        'Título requerido',
        'Ingresa el título del comunicado.'
      );
      return false;
    }

    if (!contenido.trim()) {
      Alert.alert(
        'Contenido requerido',
        'Escribe el contenido del comunicado.'
      );
      return false;
    }

    if (
      esCoordinador &&
      !['grado', 'grupo'].includes(alcanceTipo)
    ) {
      Alert.alert(
        'Alcance no permitido',
        'El coordinador solo puede publicar por grado o grupo.'
      );
      return false;
    }

    if (
      alcanceTipo === 'roles' &&
      alcanceRoles.length === 0
    ) {
      Alert.alert(
        'Destinatarios requeridos',
        'Selecciona al menos un rol.'
      );
      return false;
    }

    if (
      ['grado', 'grupo'].includes(alcanceTipo) &&
      !esIdValido(gradoId)
    ) {
      Alert.alert(
        'Grado requerido',
        'Selecciona un grado.'
      );
      return false;
    }

    if (
      alcanceTipo === 'grupo' &&
      !esIdValido(grupoId)
    ) {
      Alert.alert(
        'Grupo requerido',
        'Selecciona un grupo.'
      );
      return false;
    }

    return true;
  };

  const ejecutarPublicacion = async () => {
    if (publicando || !validarFormulario()) {
      return;
    }

    setPublicando(true);

    try {
      const resultado = await publicarComunicado({
        apiUrl,
        accessToken,
        titulo,
        contenido,
        alcanceTipo,
        alcanceRoles,
        gradoId:
          ['grado', 'grupo'].includes(alcanceTipo)
            ? Number(gradoId)
            : null,
        grupoId:
          alcanceTipo === 'grupo'
            ? Number(grupoId)
            : null,
      });

      const totalDestinatarios =
        resultado?.data?.totalDestinatarios;
      const mensaje =
        typeof totalDestinatarios === 'number'
          ? `El comunicado fue publicado correctamente para ${totalDestinatarios} destinatario(s).`
          : 'El comunicado fue publicado correctamente.';

      Alert.alert(
        'Publicación exitosa',
        mensaje,
        [
          {
            text: 'Aceptar',
            onPress: () => {
              if (typeof onSuccess === 'function') {
                onSuccess(resultado);
              } else {
                onBack?.();
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'No se pudo confirmar la publicación',
        obtenerMensajeError(error)
      );
    } finally {
      setPublicando(false);
    }
  };

  const confirmarPublicacion = () => {
    if (publicando || !validarFormulario()) {
      return;
    }

    Alert.alert(
      'Confirmar publicación',
      'El comunicado se enviará a los destinatarios seleccionados. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Publicar', onPress: ejecutarPublicacion },
      ]
    );
  };

  if (!puedePublicar) {
    return (
      <View style={styles.container}>
        <View style={styles.contenido}>
          <Text style={styles.titulo}>
            Acceso restringido
          </Text>

          <Text style={styles.descripcion}>
            Tu rol no permite publicar comunicados.
          </Text>

          <TouchableOpacity
            style={styles.botonSecundario}
            onPress={onBack}
            accessibilityRole="button"
          >
            <Text style={styles.textoSecundario}>
              Volver
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={styles.botonVolver}
        onPress={onBack}
        disabled={publicando}
        accessibilityRole="button"
      >
        <Text style={styles.textoVolver}>
          ← Volver
        </Text>
      </TouchableOpacity>

      <Text style={styles.titulo}>
        📝 Publicar comunicado
      </Text>

      <Text style={styles.descripcion}>
        Redacta un comunicado institucional y
        selecciona sus destinatarios.
      </Text>

      <Text style={styles.etiqueta}>
        Título del comunicado
      </Text>

      <TextInput
        style={styles.input}
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Ej. Reunión de acudientes"
        maxLength={180}
        editable={!publicando}
      />

      <Text style={styles.etiqueta}>
        Contenido
      </Text>

      <TextInput
        style={[styles.input, styles.inputMultilinea]}
        value={contenido}
        onChangeText={setContenido}
        placeholder="Escribe aquí el comunicado..."
        multiline
        textAlignVertical="top"
        editable={!publicando}
      />

      <Text style={styles.seccionTitulo}>
        Destinatarios
      </Text>

      <Text style={styles.descripcion}>
        Selecciona a quién va dirigido el comunicado.
      </Text>

      {ALCANCES.filter((alcance) =>
        esAdministrador
          ? true
          : ['grado', 'grupo'].includes(alcance.id)
      ).map((alcance) => {
        const seleccionado = alcanceTipo === alcance.id;

        return (
          <TouchableOpacity
            key={alcance.id}
            style={[
              styles.opcion,
              seleccionado && styles.opcionSeleccionada,
            ]}
            onPress={() => seleccionarAlcance(alcance.id)}
            disabled={publicando}
            accessibilityRole="button"
            accessibilityState={{ selected: seleccionado }}
          >
            <Text
              style={[
                styles.opcionTitulo,
                seleccionado && styles.textoSeleccionado,
              ]}
            >
              {seleccionado ? '● ' : '○ '}
              {alcance.nombre}
            </Text>

            <Text style={styles.opcionDescripcion}>
              {alcance.descripcion}
            </Text>
          </TouchableOpacity>
        );
      })}

      {alcanceTipo === 'roles' && esAdministrador && (
        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>
            Selecciona los roles
          </Text>

          {ROLES_DESTINATARIOS.map((item) => {
            const seleccionado =
              alcanceRoles.includes(item.id);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.opcion,
                  seleccionado && styles.opcionSeleccionada,
                ]}
                onPress={() => alternarRol(item.id)}
                disabled={publicando}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: seleccionado }}
              >
                <Text style={styles.opcionTitulo}>
                  {seleccionado ? '☑' : '☐'} {item.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {['grado', 'grupo'].includes(alcanceTipo) && (
        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>
            Selecciona el grado
          </Text>

          {!apiUrl || !accessToken ? (
            <Text style={styles.textoInformativo}>
              Inicia sesión nuevamente para consultar los grados.
            </Text>
          ) : cargandoGrados ? (
            <ActivityIndicator color="#1764B5" />
          ) : grados.length === 0 ? (
            <Text style={styles.textoInformativo}>
              No hay grados disponibles.
            </Text>
          ) : (
            grados.map((grado) => {
              const seleccionado =
                String(gradoId) === String(grado.id);

              return (
                <TouchableOpacity
                  key={String(grado.id)}
                  style={[
                    styles.opcion,
                    seleccionado && styles.opcionSeleccionada,
                  ]}
                  onPress={() => seleccionarGrado(grado.id)}
                  disabled={publicando}
                  accessibilityRole="button"
                  accessibilityState={{ selected: seleccionado }}
                >
                  <Text style={styles.opcionTitulo}>
                    {seleccionado ? '●' : '○'} {grado.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {alcanceTipo === 'grupo' && esIdValido(gradoId) && (
        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>
            Selecciona el grupo
          </Text>

          {!apiUrl || !accessToken ? (
            <Text style={styles.textoInformativo}>
              Inicia sesión nuevamente para consultar los grupos.
            </Text>
          ) : cargandoGrupos ? (
            <ActivityIndicator color="#1764B5" />
          ) : grupos.length === 0 ? (
            <Text style={styles.textoInformativo}>
              No hay grupos disponibles para el grado seleccionado.
            </Text>
          ) : (
            grupos.map((grupo) => {
              const seleccionado =
                String(grupoId) === String(grupo.id);

              return (
                <TouchableOpacity
                  key={String(grupo.id)}
                  style={[
                    styles.opcion,
                    seleccionado && styles.opcionSeleccionada,
                  ]}
                  onPress={() => setGrupoId(grupo.id)}
                  disabled={publicando}
                  accessibilityRole="button"
                  accessibilityState={{ selected: seleccionado }}
                >
                  <Text style={styles.opcionTitulo}>
                    {seleccionado ? '●' : '○'} {grupo.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {esCoordinador && (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>
            Solo puedes publicar en grados y grupos autorizados
            para tu cuenta. El sistema verificará tus permisos
            antes de realizar la publicación.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.botonPublicar,
          publicando && styles.botonDeshabilitado,
        ]}
        onPress={confirmarPublicacion}
        disabled={publicando}
        accessibilityRole="button"
      >
        {publicando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.textoPublicar}>
            📢 Publicar comunicado
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  contenido: {
    padding: 20,
    paddingBottom: 45,
  },

  botonVolver: {
    marginBottom: 18,
  },

  textoVolver: {
    color: '#1764B5',
    fontSize: 15,
    fontWeight: '600',
  },

  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#142A43',
    marginBottom: 10,
  },

  descripcion: {
    fontSize: 14,
    color: '#66788A',
    lineHeight: 21,
    marginBottom: 18,
  },

  etiqueta: {
    fontSize: 15,
    fontWeight: '600',
    color: '#263D54',
    marginBottom: 10,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2ED',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#142A43',
    marginBottom: 20,
  },

  inputMultilinea: {
    minHeight: 150,
  },

  seccionTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#142A43',
    marginTop: 8,
    marginBottom: 10,
  },

  seccion: {
    marginTop: 15,
  },

  opcion: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2ED',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  opcionSeleccionada: {
    borderColor: '#1764B5',
    backgroundColor: '#EAF3FF',
  },

  opcionTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#263D54',
  },

  textoSeleccionado: {
    color: '#1764B5',
  },

  opcionDescripcion: {
    fontSize: 12,
    color: '#66788A',
    marginTop: 5,
  },

  textoInformativo: {
    fontSize: 14,
    color: '#66788A',
    marginVertical: 12,
  },

  aviso: {
    backgroundColor: '#FFF5DF',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },

  avisoTexto: {
    color: '#785A18',
    fontSize: 13,
    lineHeight: 20,
  },

  botonPublicar: {
    backgroundColor: '#1764B5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 25,
  },

  botonDeshabilitado: {
    opacity: 0.65,
  },

  textoPublicar: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  botonSecundario: {
    backgroundColor: '#1764B5',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },

  textoSecundario: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
