import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
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
  purple: '#7C3AED',
};

const LIMITE = 20;

const FILTROS_EVENTOS = [
  {
    id: '',
    nombre: 'Todos',
    icono: 'apps-outline',
  },
  {
    id: 'USUARIO_ACTIVADO_ADMIN',
    nombre: 'Activaciones',
    icono: 'lock-open-outline',
  },
  {
    id: 'USUARIO_DESACTIVADO_ADMIN',
    nombre: 'Desactivaciones',
    icono: 'lock-closed-outline',
  },
];

const obtenerConfiguracionEvento = (evento = '') => {
  const texto = String(evento).toLowerCase();

  if (
    texto.includes('desactivar') ||
    texto.includes('inactivar') ||
    texto.includes('bloquear')
  ) {
    return {
      icono: 'lock-closed-outline',
      color: COLORS.red,
      fondo: '#FDECEC',
    };
  }

  if (
    texto.includes('activar') ||
    texto.includes('habilitar')
  ) {
    return {
      icono: 'lock-open-outline',
      color: COLORS.green,
      fondo: '#EAF8EF',
    };
  }

  if (
    texto.includes('crear') ||
    texto.includes('registrar')
  ) {
    return {
      icono: 'person-add-outline',
      color: COLORS.primary,
      fondo: '#EAF1FB',
    };
  }

  if (
    texto.includes('actualizar') ||
    texto.includes('editar') ||
    texto.includes('modificar')
  ) {
    return {
      icono: 'create-outline',
      color: COLORS.purple,
      fondo: '#F3EEFF',
    };
  }

  return {
    icono: 'document-text-outline',
    color: COLORS.primary,
    fondo: '#EAF1FB',
  };
};

const formatearFecha = (valor) => {
  if (!valor) {
    return 'Fecha no disponible';
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'Fecha no disponible';
  }

  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatearEvento = (valor) => {
  if (!valor) {
    return 'Evento administrativo';
  }

  return String(valor)
    .replace(/[_-]/g, ' ')
    .trim();
};

export default function SystemMonitoringScreen({
  apiUrl,
  accessToken,
  onBack,
}) {
  const [eventos, setEventos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [eventoExpandido, setEventoExpandido] = useState(null);
  const [tipoEvento, setTipoEvento] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    evento: '',
    fechaInicio: '',
    fechaFin: '',
  });
  const [errorFiltros, setErrorFiltros] = useState('');
  const [recarga, setRecarga] = useState(0);

  const cargarEventos = useCallback(
    async (signal) => {
      if (
        typeof apiUrl !== 'string' ||
        !apiUrl.trim() ||
        typeof accessToken !== 'string' ||
        !accessToken.trim()
      ) {
        setError('No se encontró una sesión válida.');
        setEventos([]);
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
          pagina: String(pagina),
          limite: String(LIMITE),
        });

        if (busquedaAplicada) {
          parametros.append('busqueda', busquedaAplicada);
        }

        if (filtrosAplicados.evento) {
          parametros.append(
            'evento',
            filtrosAplicados.evento
          );
        }

        if (filtrosAplicados.fechaInicio) {
          parametros.append(
            'fechaInicio',
            filtrosAplicados.fechaInicio
          );
        }

        if (filtrosAplicados.fechaFin) {
          parametros.append(
            'fechaFin',
            filtrosAplicados.fechaFin
          );
        }

        const baseUrl = apiUrl.trim().replace(/\/+$/, '');
        const respuesta = await fetch(
          `${baseUrl}/api/users/auditoria?${parametros.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            signal,
          }
        );

        const datos = await respuesta.json();

        if (
          !respuesta.ok ||
          datos?.success !== true ||
          !Array.isArray(datos.eventos) ||
          !datos.paginacion ||
          !Number.isSafeInteger(datos.paginacion.total) ||
          !Number.isSafeInteger(datos.paginacion.totalPaginas)
        ) {
          throw new Error(
            datos?.message ||
            datos?.error ||
            'No fue posible consultar la auditoría.'
          );
        }

        if (signal.aborted) {
          return;
        }

        setEventos(datos.eventos);
        setTotal(datos.paginacion.total);
        setTotalPaginas(datos.paginacion.totalPaginas);
      } catch (requestError) {
        if (
          signal.aborted ||
          requestError?.name === 'AbortError'
        ) {
          return;
        }

        setError(
          requestError?.message ||
          'Ocurrió un error al consultar los eventos.'
        );
        setEventos([]);
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
      apiUrl,
      accessToken,
      pagina,
      busquedaAplicada,
      filtrosAplicados,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void cargarEventos(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [cargarEventos, recarga]);

  const buscar = () => {
    const termino = busqueda.trim();

    if (termino.length > 100) {
      setError('La búsqueda no puede superar 100 caracteres.');
      return;
    }

    setPagina(1);
    setBusquedaAplicada(termino);
    setEventoExpandido(null);
  };

  const limpiarBusqueda = () => {
    setBusqueda('');
    setBusquedaAplicada('');
    setPagina(1);
    setEventoExpandido(null);
  };

  const aplicarFiltros = () => {
    setErrorFiltros('');

    const inicio = fechaInicio.trim();
    const fin = fechaFin.trim();

    const validarFecha = (valor) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
      }

      const fecha = new Date(`${valor}T00:00:00.000Z`);

      return (
        !Number.isNaN(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === valor
      );
    };

    if (
      (inicio && !validarFecha(inicio)) ||
      (fin && !validarFecha(fin))
    ) {
      setErrorFiltros(
        'Ingresa fechas válidas con el formato AAAA-MM-DD.'
      );
      return;
    }

    if (inicio && fin && inicio > fin) {
      setErrorFiltros(
        'La fecha inicial no puede superar la fecha final.'
      );
      return;
    }

    setPagina(1);
    setEventoExpandido(null);
    setFiltrosAplicados({
      evento: tipoEvento,
      fechaInicio: inicio,
      fechaFin: fin,
    });
  };

  const limpiarFiltros = () => {
    setTipoEvento('');
    setFechaInicio('');
    setFechaFin('');
    setErrorFiltros('');
    setPagina(1);
    setEventoExpandido(null);
    setFiltrosAplicados({
      evento: '',
      fechaInicio: '',
      fechaFin: '',
    });
  };

  const refrescar = () => {
    setActualizando(true);
    setRecarga((actual) => actual + 1);
  };

  const alternarDetalle = (id) => {
    setEventoExpandido((actual) =>
      actual === id ? null : id
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 45 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={refrescar}
            colors={[COLORS.primary]}
          />
        }
      >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Regresar al panel de administrador"
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={COLORS.white}
            />
          </TouchableOpacity>

          <View style={styles.headerIcon}>
            <Ionicons
              name="analytics-outline"
              size={24}
              color={COLORS.cyan}
            />
          </View>
        </View>

        <Text style={styles.headerTitle}>
          Monitoreo del sistema
        </Text>

        <Text style={styles.headerSubtitle}>
          Consulta la actividad administrativa y los
          eventos registrados en AULA-AI.
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="pulse-outline"
              size={27}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.summaryContent}>
            <Text style={styles.summaryNumber}>
              {total}
            </Text>

            <Text style={styles.summaryLabel}>
              Eventos encontrados
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Buscar actividad
        </Text>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.secondary}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Correo, evento o descripción"
            placeholderTextColor="#98A2B3"
            value={busqueda}
            onChangeText={setBusqueda}
            onSubmitEditing={buscar}
            returnKeyType="search"
            autoCapitalize="none"
            maxLength={100}
            accessibilityLabel="Buscar por correo, evento o descripción"
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
            Buscar eventos
          </Text>
        </TouchableOpacity>

        <View style={styles.filtersSection}>
          <View style={styles.filtersHeader}>
            <View style={styles.filtersTitleRow}>
              <Ionicons
                name="options-outline"
                size={22}
                color={COLORS.primary}
              />

              <Text style={styles.filtersTitle}>
                Filtros avanzados
              </Text>
            </View>

            <TouchableOpacity
              onPress={limpiarFiltros}
              accessibilityRole="button"
              accessibilityLabel="Limpiar filtros"
            >
              <Text style={styles.clearFiltersText}>
                Limpiar
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filterLabel}>
            Tipo de evento
          </Text>

          <View style={styles.eventFilters}>
            {FILTROS_EVENTOS.map((filtro) => {
              const seleccionado = tipoEvento === filtro.id;

              return (
                <TouchableOpacity
                  key={filtro.nombre}
                  style={[
                    styles.filterChip,
                    seleccionado && styles.filterChipActive,
                  ]}
                  onPress={() => setTipoEvento(filtro.id)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: seleccionado,
                  }}
                >
                  <Ionicons
                    name={filtro.icono}
                    size={16}
                    color={
                      seleccionado
                        ? COLORS.white
                        : COLORS.primary
                    }
                  />

                  <Text
                    style={[
                      styles.filterChipText,
                      seleccionado &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {filtro.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.filterLabel}>
            Rango de fechas
          </Text>

          <View style={styles.dateFilters}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>
                Desde
              </Text>

              <TextInput
                style={styles.dateInput}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#98A2B3"
                value={fechaInicio}
                onChangeText={setFechaInicio}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                accessibilityLabel="Fecha inicial"
              />
            </View>

            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>
                Hasta
              </Text>

              <TextInput
                style={styles.dateInput}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#98A2B3"
                value={fechaFin}
                onChangeText={setFechaFin}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                accessibilityLabel="Fecha final"
              />
            </View>
          </View>

          {!!errorFiltros && (
            <View style={styles.filterErrorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.red}
              />

              <Text style={styles.filterErrorText}>
                {errorFiltros}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.applyFiltersButton}
            onPress={aplicarFiltros}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons
              name="filter-outline"
              size={19}
              color={COLORS.white}
            />

            <Text style={styles.applyFiltersText}>
              Aplicar filtros
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>
            Historial de actividad
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
              Consultando eventos...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="alert-circle-outline"
              size={30}
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
        ) : eventos.length === 0 ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="file-tray-outline"
              size={35}
              color="#98A2B3"
            />

            <Text style={styles.emptyTitle}>
              Sin eventos registrados
            </Text>

            <Text style={styles.emptyText}>
              No se encontraron registros de auditoría
              para los criterios seleccionados.
            </Text>
          </View>
        ) : (
          eventos.map((evento) => {
            const configuracion =
              obtenerConfiguracionEvento(evento.evento);
            const expandido =
              eventoExpandido === evento.id;
            const metadata =
              evento.metadata &&
              typeof evento.metadata === 'object'
                ? evento.metadata
                : null;

            return (
              <View
                key={String(evento.id)}
                style={styles.eventCard}
              >
                <TouchableOpacity
                  style={styles.eventHeader}
                  onPress={() => alternarDetalle(evento.id)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded: expandido,
                  }}
                >
                  <View
                    style={[
                      styles.eventIcon,
                      {
                        backgroundColor: configuracion.fondo,
                      },
                    ]}
                  >
                    <Ionicons
                      name={configuracion.icono}
                      size={23}
                      color={configuracion.color}
                    />
                  </View>

                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>
                      {formatearEvento(evento.evento)}
                    </Text>

                    <Text
                      style={styles.eventEmail}
                      numberOfLines={2}
                    >
                      {evento.correo ||
                        'Usuario no identificado'}
                    </Text>

                    <Text style={styles.eventDate}>
                      {formatearFecha(evento.created_at)}
                    </Text>
                  </View>

                  <Ionicons
                    name={
                      expandido
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={20}
                    color={COLORS.secondary}
                  />
                </TouchableOpacity>

                {expandido && (
                  <View style={styles.eventDetails}>
                    <Text style={styles.detailsTitle}>
                      Detalles del evento
                    </Text>

                    <Text style={styles.detailLabel}>
                      Descripción
                    </Text>

                    <Text style={styles.detailValue}>
                      {evento.descripcion ||
                        'Sin descripción disponible.'}
                    </Text>

                    <Text style={styles.detailLabel}>
                      Rol responsable
                    </Text>

                    <Text style={styles.detailValue}>
                      {evento.rol || 'No especificado'}
                    </Text>

                    <Text style={styles.detailLabel}>
                      Dirección IP
                    </Text>

                    <Text style={styles.detailValue}>
                      {evento.direccion_ip || 'No disponible'}
                    </Text>

                    <Text style={styles.detailLabel}>
                      Dispositivo
                    </Text>

                    <Text style={styles.detailValue}>
                      {evento.dispositivo || 'No disponible'}
                    </Text>

                    {metadata &&
                      typeof metadata === 'object' &&
                      !Array.isArray(metadata) &&
                      Object.keys(metadata).length > 0 && (
                        <View style={styles.metadataSection}>
                          <View style={styles.metadataHeader}>
                            <Ionicons
                              name="information-circle-outline"
                              size={20}
                              color={COLORS.primary}
                            />

                            <Text style={styles.metadataTitle}>
                              Información adicional
                            </Text>
                          </View>

                          {(() => {
                            const usuario =
                              evento.usuarioAfectado ||
                              metadata.usuarioAfectado ||
                              {};

                            const nombreUsuario =
                              usuario.nombreCompleto ||
                              metadata.nombreUsuario ||
                              'No disponible';

                            const correoUsuario =
                              usuario.correo ||
                              metadata.correoUsuario ||
                              'No disponible';

                            const rolUsuario =
                              usuario.rol ||
                              metadata.rolUsuario ||
                              'No disponible';

                            const usuarioId =
                              usuario.id ||
                              metadata.usuarioObjetivoId ||
                              metadata.usuarioId ||
                              null;

                            const tieneDatosUsuario =
                              Boolean(usuario.nombreCompleto) ||
                              Boolean(usuario.correo) ||
                              Boolean(usuario.rol) ||
                              Boolean(metadata.nombreUsuario) ||
                              Boolean(metadata.correoUsuario);

                            const tieneCambioEstado =
                              typeof metadata.estadoAnterior === 'boolean' ||
                              typeof metadata.estadoNuevo === 'boolean';

                            const camposExcluidos = [
                              'usuarioAfectado',
                              'nombreUsuario',
                              'correoUsuario',
                              'rolUsuario',
                              'usuarioObjetivoId',
                              'usuarioId',
                              'estadoAnterior',
                              'estadoNuevo',
                            ];

                            const camposAdicionales =
                              Object.entries(metadata).filter(
                                ([clave]) =>
                                  !camposExcluidos.includes(clave)
                              );

                            const renderEstado = (estado) => {
                              if (typeof estado !== 'boolean') {
                                return (
                                  <Text style={styles.metadataValue}>
                                    No especificado
                                  </Text>
                                );
                              }

                              return (
                                <View
                                  style={[
                                    styles.metadataBadge,
                                    estado
                                      ? styles.metadataBadgeActive
                                      : styles.metadataBadgeInactive,
                                  ]}
                                >
                                  <Ionicons
                                    name={
                                      estado
                                        ? 'checkmark-circle'
                                        : 'close-circle'
                                    }
                                    size={16}
                                    color={
                                      estado
                                        ? '#24834B'
                                        : '#B42318'
                                    }
                                  />

                                  <Text
                                    style={[
                                      styles.metadataBadgeText,
                                      {
                                        color: estado
                                          ? '#24834B'
                                          : '#B42318',
                                      },
                                    ]}
                                  >
                                    {estado ? 'Activo' : 'Inactivo'}
                                  </Text>
                                </View>
                              );
                            };

                            return (
                              <>
                                {tieneDatosUsuario && (
                                  <View style={styles.metadataRow}>
                                    <Text style={styles.metadataLabel}>
                                      Usuario afectado
                                    </Text>

                                    <View style={styles.metadataUserCard}>
                                      <View style={styles.metadataUserIcon}>
                                        <Ionicons
                                          name="person-outline"
                                          size={22}
                                          color={COLORS.primary}
                                        />
                                      </View>

                                      <View style={styles.metadataUserInfo}>
                                        <Text style={styles.metadataUserName}>
                                          {nombreUsuario}
                                        </Text>

                                        <Text
                                          style={styles.metadataUserEmail}
                                          selectable
                                        >
                                          {correoUsuario}
                                        </Text>

                                        <Text style={styles.metadataUserRole}>
                                          Rol: {rolUsuario}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                )}

                                {tieneCambioEstado && (
                                  <View style={styles.metadataRow}>
                                    <Text style={styles.metadataLabel}>
                                      Cambio realizado
                                    </Text>

                                    <View
                                      style={styles.metadataStatusChange}
                                    >
                                      {renderEstado(
                                        metadata.estadoAnterior
                                      )}

                                      <Ionicons
                                        name="arrow-forward"
                                        size={20}
                                        color={COLORS.primary}
                                      />

                                      {renderEstado(
                                        metadata.estadoNuevo
                                      )}
                                    </View>
                                  </View>
                                )}

                                {camposAdicionales.map(
                                  ([clave, valor]) => {
                                    const etiquetas = {
                                      rolAnterior: 'Rol anterior',
                                      rolNuevo: 'Rol nuevo',
                                      motivo: 'Motivo',
                                      observacion: 'Observación',
                                      resultado: 'Resultado',
                                      camposModificados: 'Campos modificados',
                                      cantidadCamposModificados:
                                        'Cantidad de campos modificados',
                                    };

                                    const nombresCampos = {
                                      nombres: 'Nombres',
                                      apellidos: 'Apellidos',
                                      telefono: 'Teléfono',
                                      tipo_documento: 'Tipo de documento',
                                      numero_documento: 'Número de documento',
                                    };

                                    const etiqueta =
                                      etiquetas[clave] ||
                                      clave
                                        .replace(/([A-Z])/g, ' $1')
                                        .replace(/_/g, ' ')
                                        .replace(/^./, (letra) =>
                                          letra.toUpperCase()
                                        );

                                    const valorTexto =
                                      clave === 'camposModificados' &&
                                      Array.isArray(valor)
                                        ? valor.length > 0
                                          ? valor
                                              .map(
                                                (campo) =>
                                                  nombresCampos[campo] ||
                                                  campo
                                              )
                                              .join(' • ')
                                          : 'Sin modificaciones'
                                        : valor === null ||
                                            valor === undefined
                                          ? 'No disponible'
                                          : typeof valor === 'boolean'
                                            ? valor
                                              ? 'Sí'
                                              : 'No'
                                            : typeof valor === 'object'
                                              ? JSON.stringify(valor)
                                              : String(valor);

                                    return (
                                      <View
                                        key={clave}
                                        style={styles.metadataRow}
                                      >
                                        <Text
                                          style={styles.metadataLabel}
                                        >
                                          {etiqueta}
                                        </Text>

                                        <Text
                                          style={styles.metadataValue}
                                          selectable
                                        >
                                          {valorTexto}
                                        </Text>
                                      </View>
                                    );
                                  }
                                )}

                                {!tieneDatosUsuario && usuarioId && (
                                  <View style={styles.metadataRow}>
                                    <Text style={styles.metadataLabel}>
                                      Identificador del usuario
                                    </Text>

                                    <Text
                                      style={styles.metadataValue}
                                      selectable
                                    >
                                      {String(usuarioId)}
                                    </Text>
                                  </View>
                                )}
                              </>
                            );
                          })()}
                        </View>
                      )}
                  </View>
                )}
              </View>
            );
          })
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
                setPagina((actual) =>
                  Math.max(1, actual - 1)
                )
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

        <View style={styles.infoCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={COLORS.primary}
          />

          <Text style={styles.infoText}>
            Los registros mostrados provienen de la
            auditoría del sistema. Su consulta está
            reservada a usuarios administradores
            autorizados.
          </Text>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 45 : 65,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(39,196,232,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 10,
  },

  headerSubtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: '#D6E4F2',
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 45,
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 26,
  },

  summaryIcon: {
    width: 54,
    height: 54,
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
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 14,
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
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
    marginBottom: 30,
  },

  searchButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
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

  eventCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    overflow: 'hidden',
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  eventInfo: {
    flex: 1,
    marginRight: 10,
  },

  eventTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'capitalize',
    marginBottom: 5,
  },

  eventEmail: {
    fontSize: 12,
    color: COLORS.secondary,
    marginBottom: 6,
  },

  eventDate: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },

  eventDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: '#FBFCFE',
  },

  detailsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 15,
  },

  detailLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.secondary,
    marginTop: 12,
    marginBottom: 5,
  },

  detailValue: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.text,
  },

  metadataSection: {
    marginTop: 20,
    backgroundColor: '#F1F6FC',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#DFE9F5',
  },

  metadataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },

  metadataTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },

  metadataRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#DFE7F0',
  },

  metadataLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 7,
  },

  metadataValue: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    color: COLORS.text,
  },

  metadataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },

  metadataBadgeActive: {
    backgroundColor: '#E4F6EA',
  },

  metadataBadgeInactive: {
    backgroundColor: '#FDE9E7',
  },

  metadataBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  metadataUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: '#DFE7F0',
  },

  metadataUserIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  metadataUserInfo: {
    flex: 1,
  },

  metadataUserName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },

  metadataUserEmail: {
    fontSize: 12,
    color: COLORS.secondary,
    marginBottom: 6,
  },

  metadataUserRole: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'capitalize',
  },

  metadataStatusChange: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 8,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: '#EAF1FB',
    padding: 16,
    borderRadius: 15,
    marginTop: 22,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.primary,
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    marginTop: 22,
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

  filtersSection: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 28,
  },

  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  filtersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  filtersTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },

  clearFiltersText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },

  eventFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 22,
  },

  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  filterChipTextActive: {
    color: COLORS.white,
  },

  dateFilters: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },

  dateField: {
    flex: 1,
  },

  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },

  dateInput: {
    height: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    fontSize: 12,
    color: COLORS.text,
  },

  applyFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 12,
  },

  applyFiltersText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  filterErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    backgroundColor: '#FFF1F0',
    padding: 12,
    borderRadius: 10,
  },

  filterErrorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.red,
  },
});
