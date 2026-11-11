import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  navy: '#091D3A',
  primary: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#1D2939',
  secondary: '#667085',
  border: '#E4EAF2',
  green: '#16A34A',
  red: '#B42318',
};

const ROLES = {
  administrador: 'Administradores',
  coordinador: 'Coordinadores',
  orientador: 'Orientadores',
  docente: 'Docentes',
  estudiante: 'Estudiantes',
  acudiente: 'Acudientes',
};

const LIMITE = 20;

export default function RoleUsersScreen({
  rol,
  apiUrl,
  accessToken,
  onBack,
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [estado, setEstado] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [usuarioProcesando, setUsuarioProcesando] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const solicitudEstadoEnCurso = useRef(false);

  const [modalEdicionVisible, setModalEdicionVisible] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [formularioEdicion, setFormularioEdicion] = useState({
    nombres: '',
    apellidos: '',
    telefono: '',
    tipo_documento: '',
    numero_documento: '',
  });

  const titulo = ROLES[rol] || 'Usuarios';

  const cargarUsuarios = useCallback(
    async (signal) => {
      if (
        !ROLES[rol] ||
        typeof apiUrl !== 'string' ||
        !apiUrl.trim() ||
        typeof accessToken !== 'string' ||
        !accessToken.trim()
      ) {
        setError('No se encontró una sesión o un rol válido.');
        setUsuarios([]);
        setTotal(0);
        setTotalPaginas(0);
        setCargando(false);
        setActualizando(false);
        return;
      }

      setCargando(true);
      setError('');

      try {
        const parametros = new URLSearchParams({
          rol,
          pagina: String(pagina),
          limite: String(LIMITE),
        });

        if (busquedaAplicada) {
          parametros.append('busqueda', busquedaAplicada);
        }

        if (estado !== 'todos') {
          parametros.append('estado', estado);
        }

        const baseUrl = apiUrl.trim().replace(/\/+$/, '');
        const response = await fetch(
          `${baseUrl}/api/users?${parametros.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            signal,
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          data?.success !== true ||
          !Array.isArray(data.usuarios) ||
          !data.paginacion ||
          !Number.isSafeInteger(data.paginacion.total) ||
          !Number.isSafeInteger(data.paginacion.totalPaginas)
        ) {
          throw new Error(
            data?.message ||
            data?.error ||
            'El servidor devolvió una respuesta de usuarios inválida.'
          );
        }

        if (signal.aborted) {
          return;
        }

        setUsuarios(data.usuarios);
        setTotal(data.paginacion.total);
        setTotalPaginas(data.paginacion.totalPaginas);
      } catch (requestError) {
        if (
          signal.aborted ||
          requestError?.name === 'AbortError'
        ) {
          return;
        }

        setError(
          requestError?.message ||
          'No fue posible consultar los usuarios.'
        );
        setUsuarios([]);
        setTotal(0);
        setTotalPaginas(0);
      } finally {
        if (!signal.aborted) {
          setCargando(false);
          setActualizando(false);
        }
      }
    },
    [
      rol,
      apiUrl,
      accessToken,
      pagina,
      busquedaAplicada,
      estado,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void cargarUsuarios(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [cargarUsuarios, recarga]);

  const buscar = () => {
    const termino = busqueda.trim();

    if (termino.length > 100) {
      setError('La búsqueda no puede superar 100 caracteres.');
      return;
    }

    setPagina(1);
    setBusquedaAplicada(termino);
  };

  const limpiarBusqueda = () => {
    setBusqueda('');
    setBusquedaAplicada('');
    setPagina(1);
  };

  const cambiarFiltro = (nuevoEstado) => {
    setEstado(nuevoEstado);
    setPagina(1);
  };

  const refrescar = () => {
    setActualizando(true);
    setRecarga((actual) => actual + 1);
  };

  const abrirEdicionUsuario = (usuario) => {
    if (!usuario || usuario.rol === 'administrador') {
      Alert.alert(
        'Cuenta protegida',
        'La edición de cuentas administradoras no está disponible desde este módulo.'
      );
      return;
    }

    if (guardandoEdicion || usuarioProcesando !== null) {
      return;
    }

    setUsuarioEditando(usuario);
    setFormularioEdicion({
      nombres: usuario.nombres || '',
      apellidos: usuario.apellidos || '',
      telefono: usuario.telefono || '',
      tipo_documento: usuario.tipo_documento || '',
      numero_documento: usuario.numero_documento || '',
    });
    setModalEdicionVisible(true);
  };

  const cerrarEdicionUsuario = () => {
    if (guardandoEdicion) {
      return;
    }

    setModalEdicionVisible(false);
    setUsuarioEditando(null);
    setFormularioEdicion({
      nombres: '',
      apellidos: '',
      telefono: '',
      tipo_documento: '',
      numero_documento: '',
    });
  };

  const actualizarCampoEdicion = (campo, valor) => {
    setFormularioEdicion((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const guardarEdicionUsuario = async () => {
    if (guardandoEdicion || !usuarioEditando) {
      return;
    }

    if (usuarioEditando.rol === 'administrador') {
      Alert.alert(
        'Cuenta protegida',
        'No está permitido editar cuentas administradoras desde este módulo.'
      );
      return;
    }

    const campos = [
      'nombres',
      'apellidos',
      'telefono',
      'tipo_documento',
      'numero_documento',
    ];

    const datosActualizados = {};

    for (const campo of campos) {
      const valor = formularioEdicion[campo];

      if (typeof valor !== 'string') {
        Alert.alert(
          'Datos inválidos',
          `El campo ${campo} debe contener texto.`
        );
        return;
      }

      const normalizado = valor.trim();

      if (
        ['nombres', 'apellidos'].includes(campo) &&
        !normalizado
      ) {
        Alert.alert(
          'Campo obligatorio',
          `El campo ${campo} no puede estar vacío.`
        );
        return;
      }

      if (normalizado.length > 150) {
        Alert.alert(
          'Longitud no permitida',
          `El campo ${campo} supera los 150 caracteres.`
        );
        return;
      }

      const valorAnterior = String(
        usuarioEditando[campo] ?? ''
      ).trim();

      if (normalizado !== valorAnterior) {
        datosActualizados[campo] = normalizado;
      }
    }

    if (Object.keys(datosActualizados).length === 0) {
      Alert.alert(
        'Sin modificaciones',
        'No se detectaron cambios en la información del usuario.'
      );
      return;
    }

    if (
      typeof apiUrl !== 'string' ||
      !apiUrl.trim() ||
      typeof accessToken !== 'string' ||
      !accessToken.trim()
    ) {
      Alert.alert(
        'Sesión no válida',
        'No se encontró una sesión válida para guardar los cambios.'
      );
      return;
    }

    setGuardandoEdicion(true);

    try {
      const baseUrl = apiUrl.trim().replace(/\/+$/, '');

      const respuesta = await fetch(
        `${baseUrl}/api/users/${encodeURIComponent(usuarioEditando.id)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(datosActualizados),
        }
      );

      const datos = await respuesta.json();

      if (
        !respuesta.ok ||
        datos?.success !== true ||
        !datos?.usuario
      ) {
        throw new Error(
          datos?.message ||
          datos?.error ||
          'No fue posible actualizar la información del usuario.'
        );
      }

      setUsuarios((actuales) =>
        actuales.map((usuario) =>
          usuario.id === usuarioEditando.id
            ? {
                ...usuario,
                ...datos.usuario,
              }
            : usuario
        )
      );

      setModalEdicionVisible(false);
      setUsuarioEditando(null);
      setFormularioEdicion({
        nombres: '',
        apellidos: '',
        telefono: '',
        tipo_documento: '',
        numero_documento: '',
      });

      Alert.alert(
        'Actualización exitosa',
        'La información del usuario se actualizó correctamente.'
      );

      setActualizando(true);
      setRecarga((actual) => actual + 1);
    } catch (errorEdicion) {
      console.error(
        'Error actualizando información del usuario:',
        errorEdicion
      );

      Alert.alert(
        'No se pudieron guardar los cambios',
        errorEdicion?.message ||
          'Ocurrió un error inesperado al actualizar el usuario.'
      );
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const obtenerNombre = (usuario) => {
    const nombre = [
      usuario.nombres,
      usuario.apellidos,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return nombre || 'Usuario sin nombre';
  };

  const ejecutarCambioEstado = async (usuario) => {
    if (solicitudEstadoEnCurso.current) {
      return;
    }

    if (usuario.rol === 'administrador') {
      Alert.alert(
        'Cuenta protegida',
        'Las cuentas administradoras no pueden desactivarse desde este módulo.'
      );
      return;
    }

    if (
      typeof apiUrl !== 'string' ||
      !apiUrl.trim() ||
      typeof accessToken !== 'string' ||
      !accessToken.trim()
    ) {
      Alert.alert(
        'Sesión no válida',
        'No se encontró una sesión válida para actualizar la cuenta.'
      );
      return;
    }

    const nuevoEstado = !usuario.activo;
    solicitudEstadoEnCurso.current = true;

    try {
      setUsuarioProcesando(usuario.id);

      const baseUrl = apiUrl.trim().replace(/\/+$/, '');
      const respuesta = await fetch(
        `${baseUrl}/api/users/${encodeURIComponent(usuario.id)}/estado`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            activo: nuevoEstado,
          }),
        }
      );

      const datos = await respuesta.json();

      if (
        !respuesta.ok ||
        datos?.success !== true ||
        typeof datos.usuario?.activo !== 'boolean'
      ) {
        throw new Error(
          datos?.message ||
          datos?.error ||
          'El servidor no confirmó el estado actualizado de la cuenta.'
        );
      }

      setUsuarios((actuales) =>
        actuales.map((item) =>
          item.id === usuario.id
            ? {
                ...item,
                activo: datos.usuario.activo,
              }
            : item
        )
      );

      Alert.alert(
        'Operación exitosa',
        datos.message ||
          (nuevoEstado
            ? 'Cuenta activada correctamente.'
            : 'Cuenta desactivada correctamente.')
      );

      setActualizando(true);
      setRecarga((actual) => actual + 1);
    } catch (errorCambio) {
      Alert.alert(
        'No se pudo actualizar',
        errorCambio?.message ||
          'Ocurrió un error al cambiar el estado.'
      );
    } finally {
      solicitudEstadoEnCurso.current = false;
      setUsuarioProcesando(null);
    }
  };

  const confirmarCambioEstado = (usuario) => {
    if (solicitudEstadoEnCurso.current) {
      return;
    }

    if (usuario.rol === 'administrador') {
      Alert.alert(
        'Cuenta protegida',
        'Las cuentas administradoras no pueden desactivarse desde este módulo.'
      );
      return;
    }

    const accion = usuario.activo
      ? 'desactivar'
      : 'activar';
    const nombre = obtenerNombre(usuario);

    Alert.alert(
      usuario.activo
        ? 'Desactivar cuenta'
        : 'Activar cuenta',
      `¿Estás seguro de que deseas ${accion} la cuenta de ${nombre}?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: usuario.activo
            ? 'Desactivar'
            : 'Activar',
          style: usuario.activo
            ? 'destructive'
            : 'default',
          onPress: () => {
            void ejecutarCambioEstado(usuario);
          },
        },
      ]
    );
  };

  const obtenerIniciales = (usuario) => {
    const nombres = [
      usuario.nombres,
      usuario.apellidos,
    ].filter(Boolean);

    if (!nombres.length) {
      return 'U';
    }

    return nombres
      .map((texto) => texto.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Regresar a roles y permisos"
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.white}
          />
        </TouchableOpacity>

        <View style={styles.headerIcon}>
          <Ionicons
            name="people-outline"
            size={25}
            color={COLORS.cyan}
          />
        </View>

        <Text style={styles.headerTitle}>
          Administrar {titulo.toLowerCase()}
        </Text>

        <Text style={styles.headerSubtitle}>
          Consulta los usuarios registrados y verifica
          sus estados de cuenta.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={refrescar}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="people"
              size={26}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.summaryContent}>
            <Text style={styles.summaryNumber}>
              {total}
            </Text>

            <Text style={styles.summaryLabel}>
              Usuarios encontrados
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Buscar usuarios
        </Text>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.secondary}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Nombre, correo o documento"
            placeholderTextColor="#98A2B3"
            value={busqueda}
            onChangeText={setBusqueda}
            returnKeyType="search"
            onSubmitEditing={buscar}
            autoCapitalize="none"
            maxLength={100}
            accessibilityLabel="Buscar por nombre, correo o documento"
          />

          {busqueda.length > 0 && (
            <TouchableOpacity
              onPress={limpiarBusqueda}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
            >
              <Ionicons
                name="close-circle"
                size={20}
                color="#98A2B3"
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.searchButton}
          onPress={buscar}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons
            name="search"
            size={18}
            color={COLORS.white}
          />

          <Text style={styles.searchButtonText}>
            Buscar
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          Estado de las cuentas
        </Text>

        <View style={styles.filtersRow}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'activo', label: 'Activos' },
            { id: 'inactivo', label: 'Inactivos' },
          ].map((filtro) => {
            const seleccionado = estado === filtro.id;

            return (
              <TouchableOpacity
                key={filtro.id}
                style={[
                  styles.filterButton,
                  seleccionado && styles.filterSelected,
                ]}
                onPress={() => cambiarFiltro(filtro.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: seleccionado }}
              >
                <Text
                  style={[
                    styles.filterText,
                    seleccionado && styles.filterTextSelected,
                  ]}
                >
                  {filtro.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>
            Usuarios registrados
          </Text>

          <Text style={styles.resultsText}>
            {total} resultados
          </Text>
        </View>

        {cargando ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text style={styles.loadingText}>
              Consultando usuarios...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={COLORS.red}
            />

            <Text style={styles.errorText}>
              {error}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={refrescar}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>
                Reintentar
              </Text>
            </TouchableOpacity>
          </View>
        ) : usuarios.length === 0 ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="people-outline"
              size={35}
              color="#98A2B3"
            />

            <Text style={styles.emptyTitle}>
              No se encontraron usuarios
            </Text>

            <Text style={styles.emptyText}>
              No hay registros que coincidan con los
              filtros seleccionados.
            </Text>
          </View>
        ) : (
          usuarios.map((usuario) => (
            <View
              key={usuario.id}
              style={styles.userCard}
            >
              <View style={styles.userTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {obtenerIniciales(usuario)}
                  </Text>
                </View>

                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {obtenerNombre(usuario)}
                  </Text>

                  <Text
                    style={styles.userEmail}
                    numberOfLines={2}
                  >
                    {usuario.correo || 'Sin correo'}
                  </Text>
                </View>
              </View>

              <View style={styles.userFooter}>
                <View
                  style={[
                    styles.statusBadge,
                    usuario.activo
                      ? styles.activeBadge
                      : styles.inactiveBadge,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: usuario.activo
                          ? COLORS.green
                          : COLORS.red,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: usuario.activo
                          ? COLORS.green
                          : COLORS.red,
                      },
                    ]}
                  >
                    {usuario.activo
                      ? 'Activo'
                      : 'Inactivo'}
                  </Text>
                </View>

                <Text style={styles.roleLabel}>
                  {rol}
                </Text>
              </View>

              {usuario.rol !== 'administrador' && (
                <TouchableOpacity
                  style={[
                    styles.editUserButton,
                    (guardandoEdicion ||
                      usuarioProcesando !== null) && {
                      opacity: 0.6,
                    },
                  ]}
                  onPress={() => abrirEdicionUsuario(usuario)}
                  disabled={
                    guardandoEdicion ||
                    usuarioProcesando !== null
                  }
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar información de ${obtenerNombre(usuario)}`}
                >
                  <Ionicons
                    name="create-outline"
                    size={19}
                    color={COLORS.primary}
                  />

                  <Text style={styles.editUserButtonText}>
                    Editar información
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              )}

              {usuario.rol !== 'administrador' ? (
                <TouchableOpacity
                  style={[
                    styles.changeStatusButton,
                    usuario.activo
                      ? styles.deactivateButton
                      : styles.activateButton,
                    usuarioProcesando === usuario.id && {
                      opacity: 0.6,
                    },
                  ]}
                  onPress={() => confirmarCambioEstado(usuario)}
                  disabled={usuarioProcesando !== null}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={
                    usuario.activo
                      ? 'Desactivar cuenta'
                      : 'Activar cuenta'
                  }
                >
                  {usuarioProcesando === usuario.id ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        usuario.activo
                          ? COLORS.red
                          : COLORS.green
                      }
                    />
                  ) : (
                    <Ionicons
                      name={
                        usuario.activo
                          ? 'lock-closed-outline'
                          : 'lock-open-outline'
                      }
                      size={18}
                      color={
                        usuario.activo
                          ? COLORS.red
                          : COLORS.green
                      }
                    />
                  )}

                  <Text
                    style={[
                      styles.changeStatusText,
                      {
                        color: usuario.activo
                          ? COLORS.red
                          : COLORS.green,
                      },
                    ]}
                  >
                    {usuarioProcesando === usuario.id
                      ? 'Procesando...'
                      : usuario.activo
                        ? 'Desactivar cuenta'
                        : 'Activar cuenta'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.protectedAccount}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={17}
                    color={COLORS.primary}
                  />

                  <Text style={styles.protectedAccountText}>
                    Cuenta administradora protegida
                  </Text>
                </View>
              )}
            </View>
          ))
        )}

        {!cargando && !error && totalPaginas > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[
                styles.pageButton,
                pagina <= 1 && styles.pageButtonDisabled,
              ]}
              disabled={pagina <= 1}
              onPress={() =>
                setPagina((actual) => Math.max(1, actual - 1))
              }
              accessibilityRole="button"
              accessibilityLabel="Página anterior"
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>

            <Text style={styles.pageText}>
              Página {pagina} de {totalPaginas}
            </Text>

            <TouchableOpacity
              style={[
                styles.pageButton,
                pagina >= totalPaginas &&
                  styles.pageButtonDisabled,
              ]}
              disabled={pagina >= totalPaginas}
              onPress={() =>
                setPagina((actual) =>
                  Math.min(totalPaginas, actual + 1)
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Página siguiente"
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalEdicionVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarEdicionUsuario}
      >
        <KeyboardAvoidingView
          style={styles.editModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <View style={styles.editModalIcon}>
                <Ionicons
                  name="create-outline"
                  size={23}
                  color={COLORS.primary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.editModalTitle}>
                  Editar información
                </Text>

                <Text style={styles.editModalSubtitle}>
                  {usuarioEditando
                    ? obtenerNombre(usuarioEditando)
                    : 'Usuario'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={cerrarEdicionUsuario}
                disabled={guardandoEdicion}
                accessibilityRole="button"
                accessibilityLabel="Cerrar formulario"
              >
                <Ionicons
                  name="close-circle-outline"
                  size={28}
                  color={COLORS.secondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.editModalContent}
            >
              {[
                { campo: 'nombres', etiqueta: 'Nombres' },
                { campo: 'apellidos', etiqueta: 'Apellidos' },
                { campo: 'telefono', etiqueta: 'Teléfono' },
                {
                  campo: 'tipo_documento',
                  etiqueta: 'Tipo de documento',
                },
                {
                  campo: 'numero_documento',
                  etiqueta: 'Número de documento',
                },
              ].map(({ campo, etiqueta }) => (
                <View
                  key={campo}
                  style={styles.editFieldContainer}
                >
                  <Text style={styles.editFieldLabel}>
                    {etiqueta}
                  </Text>

                  <TextInput
                    style={styles.editFieldInput}
                    value={formularioEdicion[campo]}
                    onChangeText={(texto) =>
                      actualizarCampoEdicion(campo, texto)
                    }
                    placeholder={`Ingrese ${etiqueta.toLowerCase()}`}
                    placeholderTextColor="#98A2B3"
                    autoCapitalize={
                      campo === 'telefono' ||
                      campo === 'numero_documento'
                        ? 'none'
                        : 'words'
                    }
                    keyboardType={
                      campo === 'telefono' ? 'phone-pad' : 'default'
                    }
                    maxLength={150}
                    editable={!guardandoEdicion}
                  />
                </View>
              ))}

              <View style={styles.editModalActions}>
                <TouchableOpacity
                  style={styles.editCancelButton}
                  onPress={cerrarEdicionUsuario}
                  disabled={guardandoEdicion}
                >
                  <Text style={styles.editCancelText}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editSaveButton}
                  onPress={guardarEdicionUsuario}
                  disabled={guardandoEdicion}
                >
                  <Ionicons
                    name="save-outline"
                    size={18}
                    color={COLORS.white}
                  />

                  <Text style={styles.editSaveText}>
                    Guardar cambios
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,29,58,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  editModalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    maxHeight: '85%',
    overflow: 'hidden',
  },

  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },

  editModalIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },

  editModalSubtitle: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 4,
  },

  editModalContent: {
    padding: 20,
    paddingBottom: 30,
  },

  editFieldContainer: {
    marginBottom: 17,
  },

  editFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },

  editFieldInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#F8FAFC',
  },

  editModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },

  editCancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editCancelText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: '800',
  },

  editSaveButton: {
    flex: 1.3,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editSaveText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 55 : 75,
    paddingHorizontal: 22,
    paddingBottom: 30,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(39,196,232,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D6E4F2',
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 50,
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 25,
  },

  summaryIcon: {
    width: 55,
    height: 55,
    borderRadius: 16,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  summaryContent: {
    flex: 1,
  },

  summaryNumber: {
    fontSize: 29,
    fontWeight: '800',
    color: COLORS.primary,
  },

  summaryLabel: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 3,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 13,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
    gap: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },

  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
    marginBottom: 27,
  },

  searchButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  filtersRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 27,
  },

  filterButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },

  filterSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  filterTextSelected: {
    color: COLORS.white,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  resultsText: {
    fontSize: 11,
    color: COLORS.secondary,
  },

  loadingBox: {
    paddingVertical: 45,
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.secondary,
    fontSize: 12,
  },

  messageCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorText: {
    color: COLORS.red,
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 14,
  },

  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 25,
    paddingVertical: 11,
  },

  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 13,
  },

  emptyText: {
    fontSize: 12,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
  },

  userCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },

  userTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  avatarText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '800',
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 5,
  },

  userEmail: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.secondary,
  },

  userFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 15,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },

  activeBadge: {
    backgroundColor: '#EAF8EF',
  },

  inactiveBadge: {
    backgroundColor: '#FDECEC',
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  roleLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    textTransform: 'capitalize',
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    marginTop: 23,
  },

  pageButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pageButtonDisabled: {
    opacity: 0.4,
  },

  pageText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },

  editUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#EAF1FB',
    borderWidth: 1,
    borderColor: '#C8D9EF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginTop: 15,
  },

  editUserButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  changeStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginTop: 15,
    borderWidth: 1,
  },

  deactivateButton: {
    backgroundColor: '#FFF1F0',
    borderColor: '#FECACA',
  },

  activateButton: {
    backgroundColor: '#EAF8EF',
    borderColor: '#BBE7CA',
  },

  changeStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },

  protectedAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    backgroundColor: '#EAF1FB',
    borderRadius: 12,
    marginTop: 15,
  },

  protectedAccountText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
