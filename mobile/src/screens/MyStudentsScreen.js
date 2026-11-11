import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
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
  blue: '#123B73',
  cyan: '#27C4E8',
  background: '#F4F7FB',
  white: '#FFFFFF',
  text: '#263B53',
  muted: '#718096',
  border: '#DFE7F0',
  pale: '#EAF3FC',
  red: '#B3261E',
};

async function solicitar({
  apiUrl,
  accessToken,
  ruta,
}) {
  if (!apiUrl || !accessToken) {
    throw new Error(
      'La sesión no está disponible. Inicia sesión nuevamente.'
    );
  }

  const respuesta = await fetch(
    `${apiUrl.replace(/\/+$/, '')}${ruta}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  let resultado;

  try {
    resultado = await respuesta.json();
  } catch {
    throw new Error(
      'El servidor devolvió una respuesta inválida.'
    );
  }

  if (!respuesta.ok || resultado?.success === false) {
    throw new Error(
      resultado?.message ||
        'No fue posible consultar los estudiantes.'
    );
  }

  return resultado;
}

function nombreEstudiante(estudiante) {
  return [
    estudiante?.nombres,
    estudiante?.apellidos,
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Estudiante';
}

export default function MyStudentsScreen({
  apiUrl,
  accessToken,
  onBack,
}) {
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] =
    useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [modoConsulta, setModoConsulta] =
    useState('materia');
  const [seleccionId, setSeleccionId] =
    useState(null);
  const solicitudRef = useRef(0);

  const cargarEstudiantes = useCallback(
    async (refrescar = false) => {
      const solicitudId = ++solicitudRef.current;
      setError('');

      if (refrescar) {
        setActualizando(true);
      } else {
        setCargando(true);
      }

      try {
        const resultadoAsignaciones =
          await solicitar({
            apiUrl,
            accessToken,
            ruta: '/api/attendance/mis-asignaciones',
          });
        const asignaciones = Array.isArray(
          resultadoAsignaciones.asignaciones
        )
          ? resultadoAsignaciones.asignaciones
          : [];
        const gruposUnicos = new Map();

        for (const asignacion of asignaciones) {
          const gradoId =
            asignacion?.grado?.id ??
            asignacion?.grado_id;
          const grupoId =
            asignacion?.grupo?.id ??
            asignacion?.grupo_id;
          const asignacionId = asignacion?.id;
          const materiaId =
            asignacion?.materia?.id ??
            asignacion?.materia_id;

          if (
            !gradoId ||
            !grupoId ||
            !asignacionId ||
            !materiaId
          ) {
            continue;
          }

          const clave = `${gradoId}:${grupoId}`;

          if (!gruposUnicos.has(clave)) {
            gruposUnicos.set(clave, {
              clave,
              gradoId: String(gradoId),
              grupoId: String(grupoId),
              gradoNombre:
                asignacion.grado?.nombre ||
                `Grado ${gradoId}`,
              grupoNombre:
                asignacion.grupo?.nombre ||
                `Grupo ${grupoId}`,
              asignacionId,
              materias: new Map(),
            });
          }

          const grupo = gruposUnicos.get(clave);
          grupo.materias.set(String(materiaId), {
            id: String(materiaId),
            nombre:
              asignacion.materia?.nombre ||
              `Materia ${materiaId}`,
          });
        }

        const gruposConEstudiantes =
          await Promise.all(
            [...gruposUnicos.values()].map(
              async (grupo) => {
                const resultadoEstudiantes =
                  await solicitar({
                    apiUrl,
                    accessToken,
                    ruta:
                      `/api/attendance/asignaciones/` +
                      `${grupo.asignacionId}/estudiantes`,
                  });

                const estudiantes = Array.isArray(
                  resultadoEstudiantes.estudiantes
                )
                  ? resultadoEstudiantes.estudiantes
                  : [];

                return {
                  ...grupo,
                  materias: [...grupo.materias.values()],
                  estudiantes,
                };
              }
            )
          );

        gruposConEstudiantes.sort((a, b) =>
          `${a.gradoNombre} ${a.grupoNombre}`.localeCompare(
            `${b.gradoNombre} ${b.grupoNombre}`,
            'es'
          )
        );

        if (solicitudId === solicitudRef.current) {
          setGrupos(gruposConEstudiantes);
        }
      } catch (errorConsulta) {
        if (solicitudId === solicitudRef.current) {
          setError(
            errorConsulta.message ||
              'No fue posible consultar tus estudiantes.'
          );
        }
      } finally {
        if (solicitudId === solicitudRef.current) {
          setCargando(false);
          setActualizando(false);
        }
      }
    },
    [accessToken, apiUrl]
  );

  useEffect(() => {
    let activo = true;

    Promise.resolve().then(() => {
      if (activo) {
        void cargarEstudiantes();
      }
    });

    return () => {
      activo = false;
      solicitudRef.current += 1;
    };
  }, [cargarEstudiantes]);

  const termino = busqueda.trim().toLocaleLowerCase('es');
  const materias = new Map();
  const grados = new Map();

  for (const grupo of grupos) {
    if (!grados.has(grupo.gradoId)) {
      grados.set(grupo.gradoId, {
        id: grupo.gradoId,
        nombre: grupo.gradoNombre,
      });
    }

    for (const materia of grupo.materias) {
      if (!materias.has(materia.id)) {
        materias.set(materia.id, {
          ...materia,
          grupos: new Set(),
        });
      }

      materias.get(materia.id).grupos.add(grupo.clave);
    }
  }

  const opciones = modoConsulta === 'materia'
    ? [...materias.values()]
        .map((materia) => ({
          id: materia.id,
          nombre: materia.nombre,
          cantidadGrupos: materia.grupos.size,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    : [...grados.values()]
        .map((grado) => ({
          ...grado,
          cantidadGrupos: grupos.filter(
            (grupo) => grupo.gradoId === grado.id
          ).length,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const gruposSeleccionados = grupos.filter((grupo) =>
    modoConsulta === 'materia'
      ? grupo.materias.some(
          (materia) => materia.id === seleccionId
        )
      : grupo.gradoId === seleccionId
  );
  const gruposFiltrados = gruposSeleccionados
    .map((grupo) => ({
      ...grupo,
      estudiantes: grupo.estudiantes.filter(
        (estudiante) =>
          nombreEstudiante(estudiante)
            .toLocaleLowerCase('es')
            .includes(termino)
      ),
    }))
    .filter((grupo) => grupo.estudiantes.length > 0);
  const totalEstudiantes = new Set(
    gruposSeleccionados.flatMap((grupo) =>
      grupo.estudiantes.map((estudiante) =>
        String(estudiante.id)
      )
    )
  ).size;
  const nombreSeleccion = opciones.find(
    (opcion) => opcion.id === seleccionId
  )?.nombre;

  const cambiarModo = (modo) => {
    setModoConsulta(modo);
    setSeleccionId(null);
    setBusqueda('');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={actualizando}
          onRefresh={() => cargarEstudiantes(true)}
          colors={[COLORS.blue]}
          tintColor={COLORS.blue}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver al panel docente"
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={COLORS.white}
          />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>

        <View style={styles.headingRow}>
          <View style={styles.headerIcon}>
            <Ionicons
              name="people-outline"
              size={25}
              color={COLORS.white}
            />
          </View>
          <View style={styles.headingContent}>
            <Text style={styles.title}>Mis estudiantes</Text>
            <Text style={styles.subtitle}>
              Encuentra tus grupos y consulta sus listas.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summary}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="people-circle-outline"
              size={23}
              color={COLORS.blue}
            />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryNumber}>
              {seleccionId ? totalEstudiantes : grupos.length}
            </Text>
            <Text style={styles.summaryLabel}>
              {seleccionId
                ? 'Estudiantes'
                : 'Grupos asignados'}
            </Text>
          </View>
        </View>
        <View style={styles.summary}>
          <View style={[styles.summaryIcon, styles.subjectSummaryIcon]}>
            <Ionicons
              name="library-outline"
              size={21}
              color={COLORS.blue}
            />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryNumber}>
              {materias.size}
            </Text>
            <Text style={styles.summaryLabel}>Materias</Text>
          </View>
        </View>
      </View>

      {!cargando && !error && (
        <View style={styles.filterCard}>
          <Text style={styles.sectionEyebrow}>CONSULTAR LISTADO</Text>
          <Text style={styles.filterTitle}>Organiza por</Text>
          <View style={styles.modeSelector}>
            {[
              {
                id: 'materia',
                label: 'Materia',
                icon: 'library-outline',
              },
              {
                id: 'grado',
                label: 'Grado',
                icon: 'school-outline',
              },
            ].map((modo) => {
              const activo = modoConsulta === modo.id;

              return (
                <TouchableOpacity
                  key={modo.id}
                  style={[
                    styles.modeButton,
                    activo && styles.modeButtonActive,
                  ]}
                  onPress={() => cambiarModo(modo.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                >
                  <Ionicons
                    name={modo.icon}
                    size={17}
                    color={activo ? COLORS.white : COLORS.blue}
                  />
                  <Text
                    style={[
                      styles.modeButtonText,
                      activo && styles.modeButtonTextActive,
                    ]}
                  >
                    {modo.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.optionLabel}>
            {modoConsulta === 'materia'
              ? 'Selecciona una materia'
              : 'Selecciona un grado'}
          </Text>
          {opciones.length === 0 ? (
            <Text style={styles.noOptionsText}>
              No hay {modoConsulta === 'materia' ? 'materias' : 'grados'} asignados para consultar.
            </Text>
          ) : (
            <View style={styles.optionsList}>
              {opciones.map((opcion) => {
                const activo = seleccionId === opcion.id;

                return (
                  <TouchableOpacity
                    key={opcion.id}
                    style={[
                      styles.optionCard,
                      activo && styles.optionCardActive,
                    ]}
                    onPress={() =>
                      setSeleccionId(
                        activo ? null : opcion.id
                      )
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: activo }}
                  >
                    <View
                      style={[
                        styles.optionIcon,
                        activo && styles.optionIconActive,
                      ]}
                    >
                      <Ionicons
                        name={
                          modoConsulta === 'materia'
                            ? 'book-outline'
                            : 'school-outline'
                        }
                        size={18}
                        color={activo ? COLORS.white : COLORS.blue}
                      />
                    </View>
                    <View style={styles.optionContent}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.optionName,
                          activo && styles.optionNameActive,
                        ]}
                      >
                        {opcion.nombre}
                      </Text>
                      <Text style={styles.optionMeta}>
                        {opcion.cantidadGrupos}{' '}
                        {opcion.cantidadGrupos === 1 ? 'grupo' : 'grupos'}
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        activo
                          ? 'checkmark-circle'
                          : 'chevron-forward'
                      }
                      size={19}
                      color={activo ? COLORS.cyan : COLORS.muted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {seleccionId && !cargando && !error && (
        <>
          <View style={styles.resultsHeading}>
            <View style={styles.resultsHeadingCopy}>
              <Text style={styles.resultsEyebrow}>
                LISTADO POR {modoConsulta.toUpperCase()}
              </Text>
              <Text style={styles.resultsTitle}>
                {nombreSeleccion}
              </Text>
              <Text style={styles.resultsSubtitle}>
                {totalEstudiantes}{' '}
                {totalEstudiantes === 1
                  ? 'estudiante'
                  : 'estudiantes'}{' '}
                · {gruposSeleccionados.length}{' '}
                {gruposSeleccionados.length === 1 ? 'grupo' : 'grupos'}
              </Text>
            </View>
            <View style={styles.resultsIcon}>
              <Ionicons
                name={
                  modoConsulta === 'materia'
                    ? 'book-outline'
                    : 'school-outline'
                }
                size={21}
                color={COLORS.blue}
              />
            </View>
          </View>

          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={19}
              color={COLORS.muted}
            />
            <TextInput
              style={styles.searchInput}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar estudiante por nombre"
              placeholderTextColor={COLORS.muted}
              accessibilityLabel="Buscar estudiante"
            />
            {busqueda.length > 0 && (
              <TouchableOpacity
                onPress={() => setBusqueda('')}
                accessibilityRole="button"
                accessibilityLabel="Limpiar búsqueda"
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={COLORS.muted}
                />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {cargando ? (
        <View style={styles.messageCard}>
          <ActivityIndicator
            size="large"
            color={COLORS.blue}
          />
          <Text style={styles.messageText}>
            Consultando grupos y estudiantes...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.messageCard}>
          <Ionicons
            name="alert-circle-outline"
            size={27}
            color={COLORS.red}
          />
          <Text style={styles.errorTitle}>
            No fue posible consultar tus estudiantes
          </Text>
          <Text style={styles.messageText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => cargarEstudiantes()}
            accessibilityRole="button"
          >
            <Ionicons
              name="refresh-outline"
              size={17}
              color={COLORS.white}
            />
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : grupos.length === 0 ? (
        <View style={styles.messageCard}>
          <Ionicons
            name="people-outline"
            size={27}
            color={COLORS.blue}
          />
          <Text style={styles.emptyTitle}>
            No tienes grupos asignados
          </Text>
          <Text style={styles.messageText}>
            Cuando tengas asignaciones activas, podrás consultar aquí sus estudiantes por materia o grado.
          </Text>
        </View>
      ) : !seleccionId ? (
        <View style={styles.hintCard}>
          <View style={styles.hintIcon}>
            <Ionicons
              name="options-outline"
              size={20}
              color={COLORS.blue}
            />
          </View>
          <View style={styles.hintCopy}>
            <Text style={styles.hintTitle}>
              Elige cómo consultar
            </Text>
            <Text style={styles.hintText}>
              Selecciona una materia o un grado para ver los grupos y su listado de estudiantes.
            </Text>
          </View>
        </View>
      ) : gruposFiltrados.length === 0 ? (
        <View style={styles.messageCard}>
          <Ionicons
            name="search-outline"
            size={27}
            color={COLORS.blue}
          />
          <Text style={styles.emptyTitle}>
            No se encontraron estudiantes
          </Text>
          <Text style={styles.messageText}>
            {busqueda
              ? 'Prueba con otro nombre.'
              : 'No hay estudiantes registrados para esta selección.'}
          </Text>
        </View>
      ) : (
        gruposFiltrados.map((grupo) => (
          <View
            key={grupo.clave}
            style={styles.groupCard}
          >
            <View style={styles.groupHeader}>
              <View style={styles.groupIcon}>
                <Ionicons
                  name="school-outline"
                  size={20}
                  color={COLORS.blue}
                />
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupTitle}>
                  {grupo.gradoNombre} · {grupo.grupoNombre}
                </Text>
                <Text style={styles.groupCount}>
                  {grupo.estudiantes.length}{' '}
                  {grupo.estudiantes.length === 1
                    ? 'estudiante'
                    : 'estudiantes'}
                </Text>
              </View>
              {modoConsulta === 'grado' && (
                <View style={styles.groupTag}>
                  <Text style={styles.groupTagText}>
                    {grupo.materias.length}{' '}
                    {grupo.materias.length === 1
                      ? 'materia'
                      : 'materias'}
                  </Text>
                </View>
              )}
            </View>

            {grupo.estudiantes.map((estudiante) => (
              <View
                key={String(estudiante.id)}
                style={styles.studentRow}
              >
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentInitial}>
                    {nombreEstudiante(estudiante)
                      .charAt(0)
                      .toLocaleUpperCase('es')}
                  </Text>
                </View>
                <Text style={styles.studentName}>
                  {nombreEstudiante(estudiante)}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -18,
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 23,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 19,
  },
  backText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 7,
  },
  headerIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: '#17477F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headingContent: {
    flex: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: 23,
    fontWeight: '900',
  },
  subtitle: {
    color: '#D7E5F3',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: -5,
    marginTop: 15,
  },
  summary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    marginHorizontal: 5,
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  summaryIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  subjectSummaryIcon: {
    backgroundColor: '#E8F7FA',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryNumber: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: '900',
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 2,
  },
  filterCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    marginTop: 14,
    padding: 15,
  },
  sectionEyebrow: {
    color: COLORS.blue,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  filterTitle: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 5,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F8',
    borderRadius: 13,
    padding: 4,
    marginTop: 13,
  },
  modeButton: {
    flex: 1,
    minHeight: 41,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: COLORS.blue,
  },
  modeButtonText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 7,
  },
  modeButtonTextActive: {
    color: COLORS.white,
  },
  optionLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 15,
    marginBottom: 8,
  },
  optionsList: {
    marginTop: 1,
  },
  optionCard: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBFCFE',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  optionCardActive: {
    backgroundColor: '#F3FAFC',
    borderColor: COLORS.cyan,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionIconActive: {
    backgroundColor: COLORS.blue,
  },
  optionContent: {
    flex: 1,
    marginRight: 7,
  },
  optionName: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  optionNameActive: {
    color: COLORS.blue,
  },
  optionMeta: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 3,
  },
  noOptionsText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 10,
  },
  resultsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 21,
    marginHorizontal: 2,
  },
  resultsHeadingCopy: {
    flex: 1,
    paddingRight: 10,
  },
  resultsEyebrow: {
    color: COLORS.blue,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resultsTitle: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 4,
  },
  resultsSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  resultsIcon: {
    width: 41,
    height: 41,
    borderRadius: 13,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 45,
    color: COLORS.text,
    paddingHorizontal: 9,
    fontSize: 14,
  },
  messageCard: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    marginTop: 17,
    padding: 23,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EAF3FC',
    borderWidth: 1,
    borderColor: '#D6E6F5',
    borderRadius: 15,
    marginTop: 13,
    padding: 14,
  },
  hintIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  hintCopy: {
    flex: 1,
  },
  hintTitle: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  hintText: {
    color: COLORS.text,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  messageText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
  },
  errorTitle: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 9,
  },
  emptyTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 9,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blue,
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginTop: 15,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 7,
  },
  groupCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingTop: 14,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: COLORS.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  groupInfo: {
    flex: 1,
  },
  groupTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  groupCount: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },
  groupTag: {
    backgroundColor: COLORS.pale,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  groupTagText: {
    color: COLORS.blue,
    fontSize: 9,
    fontWeight: '800',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  studentAvatar: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: '#EAF3FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  studentInitial: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '900',
  },
  studentName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
