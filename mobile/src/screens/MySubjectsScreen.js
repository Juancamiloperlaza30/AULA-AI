import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  guardarMateriasLocales,
  obtenerMateriasLocales,
} from '../../database/localDatabase';

import {
  guardarMateriasOffline,
} from '../database/offlineDatabase';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function MySubjectsScreen({
  accessToken,
  apiUrl,
  endpoint,
  usuarioId,
  tipoUsuario,
  title,
  onBack,
}) {
  const [materias, setMaterias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modoOffline, setModoOffline] =
    useState(false);

  const [
    periodos,
    setPeriodos,
  ] = useState([]);

  const [
    periodoSeleccionado,
    setPeriodoSeleccionado,
  ] = useState(null);

  const [
    cargandoPeriodos,
    setCargandoPeriodos,
  ] = useState(tipoUsuario === 'estudiante');

  const [
    errorPeriodos,
    setErrorPeriodos,
  ] = useState(null);

  const solicitudMateriasId = useRef(0);
  const solicitudPeriodosId = useRef(0);

  const cargarMaterias = useCallback(async () => {
    const solicitudId =
      ++solicitudMateriasId.current;

    try {
      setCargando(true);

      if (
        tipoUsuario === 'estudiante' &&
        !periodoSeleccionado
      ) {
        setMaterias([]);
        return;
      }

      setMaterias([]);
      setModoOffline(false);

      const urlConsulta =
        tipoUsuario === 'estudiante'
          ? `${apiUrl}${endpoint}?periodoId=${periodoSeleccionado}`
          : `${apiUrl}${endpoint}`;

      const response = await fetch(
        urlConsulta,
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'No fue posible consultar las materias.'
        );
      }

      if (
        solicitudId !==
        solicitudMateriasId.current
      ) {
        return;
      }

      const materiasServidor =
        data.materias || [];

      setMaterias(materiasServidor);

      try {
        await guardarMateriasLocales(
          usuarioId,
          materiasServidor,
          tipoUsuario === 'estudiante'
            ? periodoSeleccionado
            : null
        );
      } catch (error) {
        console.log(
          'No fue posible guardar la copia local:',
          error
        );
      }

      if (
        solicitudId !==
        solicitudMateriasId.current
      ) {
        return;
      }

      await guardarMateriasOffline({
        materias: materiasServidor,
        usuarioId,
        tipoUsuario,
        periodoId:
          tipoUsuario === 'estudiante'
            ? periodoSeleccionado
            : null,
      });

      setModoOffline(false);
    } catch (error) {
      if (
        solicitudId !==
        solicitudMateriasId.current
      ) {
        return;
      }

      console.log(
        'Sin conexión. Cargando materias locales...',
        error
      );

      try {
        const materiasLocales =
          await obtenerMateriasLocales(
            usuarioId,
            tipoUsuario === 'estudiante'
              ? periodoSeleccionado
              : null
          );

        if (
          solicitudId !==
          solicitudMateriasId.current
        ) {
          return;
        }

        const materiasAdaptadas =
          materiasLocales.map((item) => ({
            id: item.id,
            materia: {
              nombre: item.nombre,
            },
            grado: {
              nombre: item.grado,
            },
            grupo: {
              nombre: item.grupo,
            },
            periodo: {
              nombre: item.periodo,
            },
            estado: item.estado,
            docentesTexto: item.docentes,
            esOffline: true,
          }));

        setMaterias(materiasAdaptadas);
        setModoOffline(true);

        if (materiasAdaptadas.length === 0) {
          Alert.alert(
            'Sin conexión',
            'No hay materias sincronizadas disponibles.'
          );
        }
      } catch (errorLocal) {
        if (
          solicitudId !==
          solicitudMateriasId.current
        ) {
          return;
        }

        console.log(
          'Error leyendo materias locales:',
          errorLocal
        );

        Alert.alert(
          'Error',
          'No fue posible consultar las materias guardadas.'
        );
      }
    } finally {
      if (
        solicitudId ===
        solicitudMateriasId.current
      ) {
        setCargando(false);
      }
    }
  }, [
    accessToken,
    apiUrl,
    endpoint,
    tipoUsuario,
    usuarioId,
    periodoSeleccionado,
  ]);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      if (activo) {
        await cargarMaterias();
      }
    };

    cargar();

    return () => {
      activo = false;
      solicitudMateriasId.current += 1;
    };
  }, [cargarMaterias]);

  const cargarPeriodosDisponibles =
    useCallback(async () => {
      const solicitudId =
        ++solicitudPeriodosId.current;

      try {
        const response = await fetch(
          `${apiUrl}/api/academic/periodos-disponibles`,
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
          throw new Error(
            data.message ||
              'No fue posible consultar los periodos académicos.'
          );
        }

        const listaPeriodos =
          data.periodos || [];

        if (
          solicitudId !==
          solicitudPeriodosId.current
        ) {
          return;
        }

        setPeriodos(listaPeriodos);
        setErrorPeriodos(null);

        const actual =
          listaPeriodos.find(
            (periodo) =>
              periodo.esActual
          );

        setPeriodoSeleccionado(
          actual?.id ?? null
        );
      } catch (error) {
        if (
          solicitudId ===
          solicitudPeriodosId.current
        ) {
          console.log(
            'Error cargando periodos:',
            error
          );

          setPeriodos([]);
          setPeriodoSeleccionado(null);
          setErrorPeriodos(
            error.message ||
              'No fue posible consultar los periodos académicos.'
          );
        }
      } finally {
        if (
          solicitudId ===
          solicitudPeriodosId.current
        ) {
          setCargandoPeriodos(false);
        }
      }
    }, [
      apiUrl,
      accessToken,
    ]);

  useEffect(() => {
    if (tipoUsuario !== 'estudiante') {
      return undefined;
    }

    Promise.resolve().then(
      cargarPeriodosDisponibles
    );

    return () => {
      solicitudPeriodosId.current += 1;
    };
  }, [
    cargarPeriodosDisponibles,
    tipoUsuario,
  ]);

  const obtenerDatosMateria = (item) => {
    if (item.materia_nombre) {
      return {
        id: item.id,
        nombre: item.materia_nombre,
        grado: item.grado_nombre,
        grupo: item.grupo_nombre,
        periodo: item.periodo_nombre,
        estado: item.estado,
      };
    }

    const asignacion =
      item.asignacion || item;

    return {
      id: asignacion.id,
      nombre:
        asignacion.materia?.nombre || '',
      grado:
        asignacion.grado?.nombre || '',
      grupo:
        asignacion.grupo?.nombre || '',
      periodo:
        asignacion.periodo?.nombre || '',
      estado:
        asignacion.estado || 'activa',
    };
  };

  const periodoSeleccionadoDetalle =
    periodos.find(
      (periodo) =>
        periodo.id === periodoSeleccionado
    );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
      >
        <Text style={styles.backText}>
          ← Volver
        </Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        {title}
      </Text>

      {tipoUsuario === 'estudiante' && (
          <View
            style={
              styles.periodSection
            }
          >
            <Text style={styles.periodTitle}>
              Periodo académico
            </Text>

            <Text style={styles.periodDescription}>
              El periodo actual se determina según
              las fechas configuradas por la institución.
            </Text>

            {cargandoPeriodos ? (
              <View style={styles.periodLoading}>
                <ActivityIndicator
                  size="small"
                  color="#1F4E79"
                />
                <Text style={styles.periodMessage}>
                  Consultando periodos...
                </Text>
              </View>
            ) : errorPeriodos ? (
              <View style={styles.periodErrorBox}>
                <Text style={styles.periodErrorText}>
                  {errorPeriodos}
                </Text>

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    setCargandoPeriodos(true);
                    cargarPeriodosDisponibles();
                  }}
                >
                  <Text style={styles.periodRetryText}>
                    Reintentar
                  </Text>
                </TouchableOpacity>
              </View>
            ) : periodos.length === 0 ? (
              <Text style={styles.periodMessage}>
                No hay periodos académicos configurados.
              </Text>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  contentContainerStyle={
                    styles.periodList
                  }
                >
                  {periodos.map(
                    (periodo) => {
                      const seleccionado =
                        periodoSeleccionado ===
                        periodo.id;

                      const etiquetaEstado =
                        periodo.esActual
                          ? 'Actual'
                          : periodo.finalizado
                            ? 'Finalizado'
                            : periodo.futuro
                              ? 'Próximo'
                              : 'Configurado';

                      const estiloEstado =
                        periodo.esActual
                          ? styles.periodStatusCurrent
                          : periodo.finalizado
                            ? styles.periodStatusFinished
                            : styles.periodStatusFuture;

                      return (
                        <TouchableOpacity
                          key={periodo.id}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: seleccionado,
                          }}
                          style={[
                            styles.periodButton,
                            seleccionado &&
                              styles.periodButtonActive,
                          ]}
                          onPress={() =>
                            setPeriodoSeleccionado(
                              periodo.id
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.periodButtonText,
                              seleccionado &&
                                styles.periodButtonTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {periodo.nombre
                              ?.replace(
                                /\s*-\s*\d{4}$/,
                                ''
                              )}
                          </Text>

                          <Text
                            style={[
                              styles.periodStatus,
                              estiloEstado,
                              seleccionado &&
                                styles.periodStatusActive,
                            ]}
                          >
                            {etiquetaEstado}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </ScrollView>

                {periodoSeleccionadoDetalle && (
                  <Text style={styles.selectedPeriodText}>
                    Materias de{' '}
                    {periodoSeleccionadoDetalle.nombre}
                  </Text>
                )}

                {!periodos.some(
                  (periodo) =>
                    periodo.esActual
                ) && (
                  <Text style={styles.periodNotice}>
                    No hay un periodo vigente según las
                    fechas configuradas. Puede consultar
                    otro periodo.
                  </Text>
                )}
              </>
            )}
          </View>
        )}

      {modoOffline && (
        <Text style={styles.offlineBannerText}>
          Mostrando materias guardadas sin conexión.
        </Text>
      )}

      {cargando ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Cargando materias...
          </Text>
        </View>
      ) : materias.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            No hay materias disponibles
          </Text>

          <Text style={styles.emptyText}>
            {periodoSeleccionadoDetalle
              ? `No hay materias asignadas para ${periodoSeleccionadoDetalle.nombre}.`
              : 'Seleccione un periodo académico para consultar sus materias.'}
          </Text>
        </View>
      ) : (
        materias.map((item) => {
          const datos =
            obtenerDatosMateria(item);

          return (
            <View
              key={
                datos.id ||
                item.materia_grupo_periodo_id
              }
              style={styles.card}
            >
              <Text style={styles.subjectName}>
                {datos.nombre}
              </Text>

              {item.esOffline && (
                <Text style={styles.offlineText}>
                  Disponible sin conexión
                </Text>
              )}

              {datos.grado && (
                <Text style={styles.cardText}>
                  Grado: {datos.grado}
                </Text>
              )}

              {datos.grupo && (
                <Text style={styles.cardText}>
                  Grupo: {datos.grupo}
                </Text>
              )}

              {datos.periodo && (
                <Text style={styles.cardText}>
                  Periodo: {datos.periodo}
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  container: {
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 50,
  },

  backButton: {
    marginBottom: 20,
  },

  backText: {
    color: '#1F4E79',
    fontWeight: '600',
    fontSize: 16,
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 25,
  },

  periodSection: {
    marginBottom: 20,
  },

  periodTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#455A64',
    marginBottom: 4,
  },

  periodDescription: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#607D8B',
  },

  periodLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  periodMessage: {
    paddingVertical: 10,
    fontSize: 13,
    color: '#607D8B',
  },

  periodErrorBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FDECEC',
  },

  periodErrorText: {
    color: '#9B1C1C',
    fontSize: 13,
    lineHeight: 18,
  },

  periodRetryText: {
    marginTop: 8,
    color: '#1F4E79',
    fontSize: 13,
    fontWeight: '800',
  },

  periodList: {
    paddingRight: 10,
    paddingBottom: 4,
  },

  periodButton: {
    minWidth: 108,
    maxWidth: 150,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E0E8',
    alignItems: 'center',
  },

  periodButtonActive: {
    backgroundColor: '#1F4E79',
    borderColor: '#1F4E79',
  },

  periodButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#455A64',
  },

  periodButtonTextActive: {
    color: '#FFFFFF',
  },

  periodStatus: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '700',
  },

  periodStatusCurrent: {
    color: '#2E7D32',
  },

  periodStatusFinished: {
    color: '#607D8B',
  },

  periodStatusFuture: {
    color: '#1F4E79',
  },

  periodStatusActive: {
    color: '#FFFFFF',
  },

  selectedPeriodText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F4E79',
  },

  periodNotice: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#8A5A00',
  },

  offlineBannerText: {
    marginBottom: 14,
    fontSize: 14,
    color: '#7A5C00',
    backgroundColor: '#FFF4CC',
    padding: 10,
    borderRadius: 8,
  },

  offlineText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#607D8B',
  },

  loadingBox: {
    alignItems: 'center',
    paddingVertical: 50,
  },

  loadingText: {
    marginTop: 12,
    color: '#607D8B',
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 6,
  },

  emptyText: {
    color: '#607D8B',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E5EB',
  },

  subjectName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F4E79',
    marginBottom: 10,
  },

  cardText: {
    color: '#455A64',
    marginBottom: 5,
  },
});
