'use strict';

import React, { useEffect, useState } from 'react';

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

import { Ionicons } from '@expo/vector-icons';

import {
  publicarComunicado,
} from '../services/comunicadoService';

// ======================================================
// AULA-AI | HU-12
// PUBLICACIÓN DE COMUNICADOS INSTITUCIONALES
// REDISEÑO PREMIUM
// ======================================================

const COLORS = {
  navy: '#091D3A',
  blue: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#263B53',
  muted: '#718096',
  border: '#DFE7F0',
  pale: '#EAF3FC',
  warning: '#FFF5DF',
  warningText: '#785A18',
  error: '#B91C1C',
};

const ROLES_DESTINATARIOS = [
  {
    id: 'administrador',
    nombre: 'Administrador',
    icono: 'shield-checkmark-outline',
  },
  {
    id: 'coordinador',
    nombre: 'Coordinador',
    icono: 'git-network-outline',
  },
  {
    id: 'docente',
    nombre: 'Docente',
    icono: 'school-outline',
  },
  {
    id: 'orientador',
    nombre: 'Orientador',
    icono: 'heart-outline',
  },
  {
    id: 'estudiante',
    nombre: 'Estudiante',
    icono: 'book-outline',
  },
  {
    id: 'acudiente',
    nombre: 'Acudiente',
    icono: 'people-outline',
  },
];

const ALCANCES = [
  {
    id: 'general',
    nombre: 'Toda la institución',
    descripcion: 'Todos los usuarios activos.',
    icono: 'globe-outline',
  },
  {
    id: 'roles',
    nombre: 'Por roles',
    descripcion: 'Seleccionar uno o varios roles.',
    icono: 'people-outline',
  },
  {
    id: 'grado',
    nombre: 'Por grado',
    descripcion: 'Estudiantes y acudientes de un grado.',
    icono: 'school-outline',
  },
  {
    id: 'grupo',
    nombre: 'Por grupo',
    descripcion: 'Estudiantes y acudientes de un grupo.',
    icono: 'layers-outline',
  },
];

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

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

// ======================================================
// COMPONENTES VISUALES
// ======================================================

const SectionHeader = ({
  icon,
  title,
  subtitle,
  number,
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIcon}>
      <Ionicons
        name={icon}
        size={22}
        color={COLORS.blue}
      />
    </View>

    <View style={styles.sectionHeaderContent}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {subtitle ? (
        <Text style={styles.sectionSubtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>

    {number ? (
      <View style={styles.sectionNumber}>
        <Text style={styles.sectionNumberText}>
          {number}
        </Text>
      </View>
    ) : null}
  </View>
);

const SelectionCard = ({
  title,
  description,
  icon,
  selected,
  onPress,
  disabled,
  checkbox = false,
}) => (
  <TouchableOpacity
    style={[
      styles.selectionCard,
      selected && styles.selectionCardActive,
    ]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.8}
    accessibilityRole={checkbox ? 'checkbox' : 'button'}
    accessibilityState={
      checkbox
        ? { checked: selected }
        : { selected }
    }
  >
    <View
      style={[
        styles.selectionIcon,
        selected && styles.selectionIconActive,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={
          selected ? COLORS.white : COLORS.blue
        }
      />
    </View>

    <View style={styles.selectionContent}>
      <Text
        style={[
          styles.selectionTitle,
          selected && styles.selectionTitleActive,
        ]}
      >
        {title}
      </Text>

      {description ? (
        <Text style={styles.selectionDescription}>
          {description}
        </Text>
      ) : null}
    </View>

    <Ionicons
      name={
        selected
          ? 'checkmark-circle'
          : checkbox
            ? 'square-outline'
            : 'ellipse-outline'
      }
      size={23}
      color={
        selected ? COLORS.blue : '#A6B5C7'
      }
    />
  </TouchableOpacity>
);

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function PublishCommunicationScreen({
  apiUrl,
  accessToken,
  rol,
  onBack,
  onSuccess,
}) {
  const esAdministrador = rol === 'administrador';
  const esCoordinador = rol === 'coordinador';

  const puedePublicar =
    esAdministrador || esCoordinador;

  // ====================================================
  // ESTADOS ORIGINALES
  // ====================================================

  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');

  const [alcanceTipo, setAlcanceTipo] = useState(
    esCoordinador ? 'grupo' : 'general'
  );

  const [alcanceRoles, setAlcanceRoles] =
    useState([]);

  const [grados, setGrados] = useState([]);
  const [gradoId, setGradoId] = useState(null);

  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState(null);

  const [cargandoGrados, setCargandoGrados] =
    useState(esCoordinador);

  const [cargandoGrupos, setCargandoGrupos] =
    useState(false);

  const [publicando, setPublicando] =
    useState(false);

  // ====================================================
  // CONSULTAR GRADOS
  // ====================================================

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
        if (
          activa &&
          error?.name !== 'AbortError'
        ) {
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

  // ====================================================
  // CONSULTAR GRUPOS
  // ====================================================

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
        if (
          activa &&
          error?.name !== 'AbortError'
        ) {
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
  }, [
    alcanceTipo,
    apiUrl,
    accessToken,
    gradoId,
  ]);

  // ====================================================
  // SELECCIONES
  // ====================================================

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
        ? actuales.filter(
            (item) => item !== rolSeleccionado
          )
        : [...actuales, rolSeleccionado]
    );
  };

  // ====================================================
  // VALIDACIONES ORIGINALES
  // ====================================================

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

  // ====================================================
  // PUBLICAR COMUNICADO
  // ====================================================

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

  // ====================================================
  // CONFIRMACIÓN
  // ====================================================

  const confirmarPublicacion = () => {
    if (publicando || !validarFormulario()) {
      return;
    }

    Alert.alert(
      'Confirmar publicación',
      'El comunicado se enviará a los destinatarios seleccionados. ¿Deseas continuar?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Publicar',
          onPress: ejecutarPublicacion,
        },
      ]
    );
  };

  // ====================================================
  // ACCESO RESTRINGIDO
  // ====================================================

  if (!puedePublicar) {
    return (
      <View style={styles.restrictedScreen}>
        <View style={styles.restrictedIcon}>
          <Ionicons
            name="lock-closed-outline"
            size={36}
            color={COLORS.blue}
          />
        </View>

        <Text style={styles.restrictedTitle}>
          Acceso restringido
        </Text>

        <Text style={styles.restrictedDescription}>
          Tu rol no permite publicar comunicados
          institucionales.
        </Text>

        <TouchableOpacity
          style={styles.restrictedButton}
          onPress={onBack}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-back-outline"
            size={18}
            color={COLORS.white}
          />

          <Text style={styles.restrictedButtonText}>
            Volver al panel
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ====================================================
  // INTERFAZ PREMIUM
  // ====================================================

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* ENCABEZADO */}

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backHeader}
            onPress={onBack}
            disabled={publicando}
            accessibilityRole="button"
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={COLORS.white}
            />

            <Text style={styles.backHeaderText}>
              Volver
            </Text>
          </TouchableOpacity>

          <View style={styles.headerBadge}>
            <Ionicons
              name="megaphone-outline"
              size={14}
              color={COLORS.cyan}
            />

            <Text style={styles.headerBadgeText}>
              COMUNICADOS
            </Text>
          </View>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons
            name="megaphone-outline"
            size={30}
            color={COLORS.white}
          />
        </View>

        <Text style={styles.heroTitle}>
          Publicar comunicado
        </Text>

        <Text style={styles.heroDescription}>
          Crea y comparte información
          institucional con los destinatarios
          correspondientes.
        </Text>
      </View>

      {/* INFORMACIÓN GENERAL */}

      <View style={styles.infoBanner}>
        <Ionicons
          name="information-circle-outline"
          size={22}
          color={COLORS.blue}
        />

        <Text style={styles.infoBannerText}>
          Completa la información del comunicado,
          selecciona sus destinatarios y confirma
          la publicación.
        </Text>
      </View>

      {/* SECCIÓN 1 */}

      <View style={styles.sectionCard}>
        <SectionHeader
          icon="create-outline"
          title="Información del comunicado"
          subtitle="Redacta el mensaje institucional."
          number="01"
        />

        <Text style={styles.label}>
          Título del comunicado
          <Text style={styles.required}> *</Text>
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons
            name="text-outline"
            size={19}
            color={COLORS.muted}
            style={styles.inputIcon}
          />

          <TextInput
            style={styles.input}
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Ej. Reunión de acudientes"
            placeholderTextColor="#94A3B8"
            maxLength={180}
            editable={!publicando}
          />
        </View>

        <Text style={styles.counter}>
          {titulo.length}/180 caracteres
        </Text>

        <Text style={styles.label}>
          Contenido
          <Text style={styles.required}> *</Text>
        </Text>

        <View style={styles.multilineContainer}>
          <TextInput
            style={styles.multilineInput}
            value={contenido}
            onChangeText={setContenido}
            placeholder="Escribe aquí el comunicado..."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            editable={!publicando}
          />
        </View>

        <View style={styles.editorFooter}>
          <Ionicons
            name="document-text-outline"
            size={15}
            color={COLORS.muted}
          />

          <Text style={styles.editorFooterText}>
            {contenido.length} caracteres escritos
          </Text>
        </View>
      </View>

      {/* SECCIÓN 2 */}

      <View style={styles.sectionCard}>
        <SectionHeader
          icon="people-outline"
          title="Destinatarios"
          subtitle="Define a quién llegará el comunicado."
          number="02"
        />

        <Text style={styles.label}>
          Alcance de publicación
          <Text style={styles.required}> *</Text>
        </Text>

        {ALCANCES.filter((alcance) =>
          esAdministrador
            ? true
            : ['grado', 'grupo'].includes(alcance.id)
        ).map((alcance) => {
          const seleccionado =
            alcanceTipo === alcance.id;

          return (
            <SelectionCard
              key={alcance.id}
              title={alcance.nombre}
              description={alcance.descripcion}
              icon={alcance.icono}
              selected={seleccionado}
              onPress={() =>
                seleccionarAlcance(alcance.id)
              }
              disabled={publicando}
            />
          );
        })}

        {/* SELECCIÓN POR ROLES */}

        {alcanceTipo === 'roles' &&
          esAdministrador && (
            <View style={styles.subsection}>
              <View style={styles.subsectionHeader}>
                <Ionicons
                  name="people-circle-outline"
                  size={21}
                  color={COLORS.blue}
                />

                <Text style={styles.subsectionTitle}>
                  Seleccionar roles
                </Text>
              </View>

              <Text style={styles.helperText}>
                Puedes seleccionar uno o varios roles.
              </Text>

              {ROLES_DESTINATARIOS.map((item) => {
                const seleccionado =
                  alcanceRoles.includes(item.id);

                return (
                  <SelectionCard
                    key={item.id}
                    title={item.nombre}
                    icon={item.icono}
                    selected={seleccionado}
                    onPress={() =>
                      alternarRol(item.id)
                    }
                    disabled={publicando}
                    checkbox
                  />
                );
              })}

              <View style={styles.selectionSummary}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={COLORS.blue}
                />

                <Text style={styles.selectionSummaryText}>
                  {alcanceRoles.length} rol(es)
                  seleccionado(s)
                </Text>
              </View>
            </View>
          )}

        {/* SELECCIÓN POR GRADO */}

        {['grado', 'grupo'].includes(alcanceTipo) && (
          <View style={styles.subsection}>
            <View style={styles.subsectionHeader}>
              <Ionicons
                name="school-outline"
                size={21}
                color={COLORS.blue}
              />

              <Text style={styles.subsectionTitle}>
                Seleccionar grado
              </Text>
            </View>

            {!apiUrl || !accessToken ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>
                  Inicia sesión nuevamente para
                  consultar los grados.
                </Text>
              </View>
            ) : cargandoGrados ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator
                  color={COLORS.blue}
                />

                <Text style={styles.loadingText}>
                  Cargando grados...
                </Text>
              </View>
            ) : grados.length === 0 ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>
                  No hay grados disponibles.
                </Text>
              </View>
            ) : (
              grados.map((grado) => {
                const seleccionado =
                  String(gradoId) ===
                  String(grado.id);

                return (
                  <SelectionCard
                    key={String(grado.id)}
                    title={grado.nombre}
                    icon="school-outline"
                    selected={seleccionado}
                    onPress={() =>
                      seleccionarGrado(grado.id)
                    }
                    disabled={publicando}
                  />
                );
              })
            )}
          </View>
        )}

        {/* SELECCIÓN POR GRUPO */}

        {alcanceTipo === 'grupo' &&
          esIdValido(gradoId) && (
            <View style={styles.subsection}>
              <View style={styles.subsectionHeader}>
                <Ionicons
                  name="layers-outline"
                  size={21}
                  color={COLORS.blue}
                />

                <Text style={styles.subsectionTitle}>
                  Seleccionar grupo
                </Text>
              </View>

              {!apiUrl || !accessToken ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>
                    Inicia sesión nuevamente para
                    consultar los grupos.
                  </Text>
                </View>
              ) : cargandoGrupos ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator
                    color={COLORS.blue}
                  />

                  <Text style={styles.loadingText}>
                    Cargando grupos...
                  </Text>
                </View>
              ) : grupos.length === 0 ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>
                    No hay grupos disponibles para
                    el grado seleccionado.
                  </Text>
                </View>
              ) : (
                grupos.map((grupo) => {
                  const seleccionado =
                    String(grupoId) ===
                    String(grupo.id);

                  return (
                    <SelectionCard
                      key={String(grupo.id)}
                      title={grupo.nombre}
                      icon="people-outline"
                      selected={seleccionado}
                      onPress={() =>
                        setGrupoId(grupo.id)
                      }
                      disabled={publicando}
                    />
                  );
                })
              )}
            </View>
          )}

        {/* AVISO COORDINADOR */}

        {esCoordinador && (
          <View style={styles.warningBanner}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={COLORS.warningText}
            />

            <Text style={styles.warningText}>
              Solo puedes publicar en grados y
              grupos autorizados para tu cuenta.
              El sistema verificará tus permisos
              antes de realizar la publicación.
            </Text>
          </View>
        )}
      </View>

      {/* SECCIÓN 3 */}

      <View style={styles.sectionCard}>
        <SectionHeader
          icon="checkmark-done-outline"
          title="Confirmar publicación"
          subtitle="Revisa los datos antes de continuar."
          number="03"
        />

        <View style={styles.reviewBox}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>
              Título
            </Text>

            <Text
              style={styles.reviewValue}
              numberOfLines={2}
            >
              {titulo.trim() || 'Sin completar'}
            </Text>
          </View>

          <View style={styles.reviewDivider} />

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>
              Alcance
            </Text>

            <Text style={styles.reviewValue}>
              {ALCANCES.find(
                (item) => item.id === alcanceTipo
              )?.nombre || '-'}
            </Text>
          </View>

          {alcanceTipo === 'roles' && (
            <>
              <View style={styles.reviewDivider} />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>
                  Roles
                </Text>

                <Text style={styles.reviewValue}>
                  {alcanceRoles.length} seleccionado(s)
                </Text>
              </View>
            </>
          )}

          {['grado', 'grupo'].includes(alcanceTipo) && (
            <>
              <View style={styles.reviewDivider} />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>
                  Grado
                </Text>

                <Text style={styles.reviewValue}>
                  {grados.find(
                    (item) =>
                      String(item.id) ===
                      String(gradoId)
                  )?.nombre || 'Sin seleccionar'}
                </Text>
              </View>
            </>
          )}

          {alcanceTipo === 'grupo' && (
            <>
              <View style={styles.reviewDivider} />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>
                  Grupo
                </Text>

                <Text style={styles.reviewValue}>
                  {grupos.find(
                    (item) =>
                      String(item.id) ===
                      String(grupoId)
                  )?.nombre || 'Sin seleccionar'}
                </Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.publishButton,
            publicando && styles.disabledButton,
          ]}
          onPress={confirmarPublicacion}
          disabled={publicando}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          {publicando ? (
            <>
              <ActivityIndicator
                color={COLORS.white}
              />

              <Text style={styles.publishButtonText}>
                Publicando comunicado...
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="megaphone-outline"
                size={21}
                color={COLORS.white}
              />

              <Text style={styles.publishButtonText}>
                Publicar comunicado
              </Text>

              <Ionicons
                name="arrow-forward"
                size={18}
                color={COLORS.white}
              />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.publishHint}>
          Se solicitará confirmación antes de
          realizar la publicación.
        </Text>
      </View>

      {/* VOLVER */}

      <TouchableOpacity
        style={styles.bottomBackButton}
        onPress={onBack}
        disabled={publicando}
        accessibilityRole="button"
      >
        <Ionicons
          name="arrow-back-outline"
          size={19}
          color={COLORS.blue}
        />

        <Text style={styles.bottomBackText}>
          Volver al panel
        </Text>
      </TouchableOpacity>

      {/* PIE DE PÁGINA */}

      <View style={styles.footer}>
        <Ionicons
          name="shield-checkmark-outline"
          size={16}
          color={COLORS.muted}
        />

        <Text style={styles.footerText}>
          Comunicaciones institucionales · AULA-AI
        </Text>
      </View>
    </ScrollView>
  );
}

// ======================================================
// ESTILOS PREMIUM
// ======================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    paddingHorizontal: 20,
    paddingBottom: 55,
  },

  // ENCABEZADO

  header: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 35,
    marginBottom: 22,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },

  backHeaderText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },

  headerBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },

  heroIcon: {
    width: 59,
    height: 59,
    borderRadius: 18,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  heroTitle: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: '900',
    marginBottom: 10,
  },

  heroDescription: {
    color: '#D6E4F2',
    fontSize: 13,
    lineHeight: 21,
  },

  // AVISO INICIAL

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: COLORS.pale,
    padding: 16,
    borderRadius: 15,
    marginBottom: 20,
  },

  infoBannerText: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    lineHeight: 20,
  },

  // SECCIONES

  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 19,
    marginBottom: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 9,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 23,
  },

  sectionIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  sectionHeaderContent: {
    flex: 1,
  },

  sectionTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 5,
  },

  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
  },

  sectionNumber: {
    backgroundColor: '#F0F5FA',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginLeft: 7,
  },

  sectionNumberText: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '900',
  },

  // CAMPOS

  label: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },

  required: {
    color: COLORS.error,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: '#FBFCFE',
    paddingHorizontal: 13,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: COLORS.navy,
    fontSize: 14,
    paddingVertical: 12,
  },

  counter: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 7,
    marginBottom: 21,
  },

  multilineContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: '#FBFCFE',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  multilineInput: {
    minHeight: 165,
    color: COLORS.navy,
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 10,
  },

  editorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 9,
  },

  editorFooterText: {
    color: COLORS.muted,
    fontSize: 11,
  },

  // SELECCIONES

  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    marginBottom: 10,
  },

  selectionCardActive: {
    borderColor: COLORS.blue,
    backgroundColor: '#F0F7FF',
    borderWidth: 1.5,
  },

  selectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  selectionIconActive: {
    backgroundColor: COLORS.blue,
  },

  selectionContent: {
    flex: 1,
    paddingRight: 8,
  },

  selectionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },

  selectionTitleActive: {
    color: COLORS.blue,
  },

  selectionDescription: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  subsection: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#E9EFF5',
  },

  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 13,
  },

  subsectionTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '800',
  },

  helperText: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 19,
  },

  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.pale,
    borderRadius: 11,
    padding: 12,
    marginTop: 4,
  },

  selectionSummaryText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
  },

  // MENSAJES Y CARGA

  messageBox: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  messageText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
  },

  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 12,
  },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.warning,
    borderRadius: 13,
    padding: 15,
    marginTop: 17,
  },

  warningText: {
    flex: 1,
    color: COLORS.warningText,
    fontSize: 12,
    lineHeight: 20,
  },

  // RESUMEN

  reviewBox: {
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    padding: 15,
    marginBottom: 19,
  },

  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  reviewLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },

  reviewValue: {
    flex: 1,
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },

  reviewDivider: {
    height: 1,
    backgroundColor: '#E6EDF5',
    marginVertical: 13,
  },

  // PUBLICACIÓN

  publishButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingHorizontal: 12,
  },

  disabledButton: {
    opacity: 0.65,
  },

  publishButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },

  publishHint: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 13,
  },

  // NAVEGACIÓN

  bottomBackButton: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
  },

  bottomBackText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 24,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  // ACCESO RESTRINGIDO

  restrictedScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  restrictedIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  restrictedTitle: {
    color: COLORS.navy,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },

  restrictedDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 25,
  },

  restrictedButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.blue,
    paddingHorizontal: 23,
    borderRadius: 13,
  },

  restrictedButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
});