import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  consultarResumenAcademicoOffline,
} from '../services/academicOfflineService';
import AcademicRecommendationContent
  from '../components/AcademicRecommendationContent';
import StudentCommunicationsScreen
  from './StudentCommunicationsScreen';
import LocationScreen from './LocationScreen';

const SECCIONES = [
  { id: 'materias', titulo: 'Materias' },
  { id: 'actividades', titulo: 'Actividades' },
  { id: 'calificaciones', titulo: 'Calificaciones' },
  { id: 'planesRefuerzo', titulo: 'Planes' },
  { id: 'recomendaciones', titulo: 'Recomendaciones' },
  { id: 'perfil', titulo: 'Perfil' },
];

const formatearFecha = (fecha) => {
  if (!fecha) return 'Sin registro';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return valor.toLocaleString('es-CO');
};

export default function AcademicOfflineScreen({
  usuario,
  apiUrl,
  onBack,
}) {
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState(null);
  const [seccion, setSeccion] = useState('materias');
  const [mostrarComunicados, setMostrarComunicados] =
    useState(false);
  const [mostrarUbicacion, setMostrarUbicacion] =
    useState(false);
  const usuarioId = usuario?.id;

  const cargarInformacion = useCallback(async () => {
    setCargando(true);

    try {
      if (!usuarioId) {
        throw new Error(
          'No se encontro un usuario valido.'
        );
      }

      const resultado =
        await consultarResumenAcademicoOffline(
          usuarioId
        );

      setResumen(resultado);
    } catch (error) {
      console.error(
        'HU-14: error consultando informacion local:',
        error
      );

      Alert.alert(
        'Consulta offline',
        'No fue posible consultar la informacion almacenada.'
      );
    } finally {
      setCargando(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    let activo = true;

    Promise.resolve().then(() => {
      if (activo) {
        void cargarInformacion();
      }
    });

    return () => {
      activo = false;
    };
  }, [cargarInformacion]);

  const perfil = {
    nombres: usuario?.nombres || '',
    apellidos: usuario?.apellidos || '',
    correo: usuario?.correo || usuario?.email || '',
    rol: usuario?.rol || '',
  };
  const perfilDisponible = Object.values(perfil)
    .some((valor) => Boolean(String(valor).trim()));

  const registros = seccion === 'perfil'
    ? perfilDisponible
      ? [perfil]
      : []
    : resumen?.[seccion] || [];

  if (mostrarComunicados) {
    return (
      <StudentCommunicationsScreen
        apiUrl={apiUrl}
        accessToken={null}
        usuarioId={usuarioId}
        onBack={() => setMostrarComunicados(false)}
      />
    );
  }

  if (mostrarUbicacion) {
    return (
      <LocationScreen
        onBack={() => setMostrarUbicacion(false)}
      />
    );
  }

  const renderizarRegistro = ({ item }) => {
    let titulo = '';
    let detalle = '';

    if (seccion === 'materias') {
      titulo = item.nombre || 'Materia sin nombre';
      detalle = [
        item.grado,
        item.grupo,
        item.periodo,
        item.docentes
          ? `Docente: ${item.docentes}`
          : null,
      ].filter(Boolean).join(' - ');
    }

    if (seccion === 'actividades') {
      titulo = item.titulo || 'Actividad sin titulo';
      detalle = [
        item.materia,
        item.estado,
        item.entrega_estado
          ? `Entrega: ${item.entrega_estado}`
          : null,
        item.calificacion_valor != null
          ? `Nota: ${item.calificacion_valor}`
          : null,
        item.fecha_entrega
          ? `Entrega: ${formatearFecha(item.fecha_entrega)}`
          : null,
      ].filter(Boolean).join('\n');
    }

    if (seccion === 'calificaciones') {
      titulo =
        item.actividad_titulo || 'Calificacion';

      detalle = [
        item.materia,
        `Nota: ${item.valor ?? 'Sin nota'}`,
        item.retroalimentacion,
      ].filter(Boolean).join('\n');
    }

    if (seccion === 'planesRefuerzo') {
      titulo = `Plan de acompañamiento #${item.id}`;
      detalle = [
        item.objetivo,
        item.estado
          ? `Estado: ${item.estado}`
          : null,
        item.prioridad
          ? `Prioridad: ${item.prioridad}`
          : null,
        item.fecha_seguimiento
          ? `Seguimiento: ${formatearFecha(item.fecha_seguimiento)}`
          : null,
        ...(Array.isArray(item.acciones)
          ? item.acciones.map((accion) =>
              typeof accion === 'string'
                ? accion
                : accion?.descripcion ||
                  accion?.titulo ||
                  accion?.nombre
            )
          : []),
        item.observaciones_orientador,
      ].filter(Boolean).join('\n');
    }

    if (seccion === 'recomendaciones') {
      titulo =
        `Recomendacion academica #${item.id}`;
      detalle = [
        item.origen
          ? `Origen: ${item.origen}`
          : null,
        item.created_at
          ? `Generada: ${formatearFecha(item.created_at)}`
          : null,
      ].filter(Boolean).join('\n');
    }

    if (seccion === 'perfil') {
      titulo = [
        item.nombres,
        item.apellidos,
      ].filter(Boolean).join(' ') || 'Perfil del estudiante';
      detalle = [
        item.correo ? `Correo: ${item.correo}` : null,
        item.rol ? `Rol: ${item.rol}` : null,
      ].filter(Boolean).join('\n');
    }

    return (
      <View style={styles.registro}>
        <Text style={styles.registroTitulo}>
          {titulo}
        </Text>

        {detalle ? (
          <Text style={styles.registroDetalle}>
            {detalle}
          </Text>
        ) : null}

        {seccion === 'recomendaciones' && (
          <AcademicRecommendationContent
            contenido={item.contenido}
            indicadores={item.indicadores}
            origen={item.origen}
          />
        )}

        {seccion === 'planesRefuerzo' &&
          Array.isArray(item.indicadores_progreso) &&
          item.indicadores_progreso.length > 0 && (
            <Text style={styles.registroDetalle}>
              Indicadores:{' '}
              {item.indicadores_progreso
                .map((indicador) =>
                  typeof indicador === 'string'
                    ? indicador
                    : indicador?.descripcion ||
                      indicador?.indicador ||
                      indicador?.titulo
                )
                .filter(Boolean)
                .join(', ')}
            </Text>
          )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>
          Consulta academica offline
        </Text>

        <Text style={styles.subtitulo}>
          Informacion guardada en este dispositivo.
          Puede no estar actualizada.
        </Text>

        <Text style={styles.fecha}>
          Ultima sincronizacion registrada:{' '}
          {formatearFecha(
            resumen?.ultimaSincronizacion
          )}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pestanas}
        contentContainerStyle={styles.pestanasContenido}
      >
        {SECCIONES.map((opcion) => (
          <TouchableOpacity
            key={opcion.id}
            style={[
              styles.pestana,
              seccion === opcion.id &&
                styles.pestanaActiva,
            ]}
            onPress={() => setSeccion(opcion.id)}
          >
            <Text
              style={[
                styles.pestanaTexto,
                seccion === opcion.id &&
                  styles.pestanaTextoActivo,
              ]}
            >
              {opcion.titulo}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.fecha}>
        Actualizacion:{' '}
        {seccion === 'perfil'
          ? 'fecha no disponible'
          : formatearFecha(
              resumen?.fechasActualizacion?.[seccion]
            )}
      </Text>

      <TouchableOpacity
        style={styles.comunicados}
        onPress={() => setMostrarComunicados(true)}
      >
        <Text style={styles.botonTexto}>
          Consultar comunicados sincronizados
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.comunicados}
        onPress={() => setMostrarUbicacion(true)}
      >
        <Text style={styles.botonTexto}>
          Consultar ubicación del dispositivo
        </Text>
      </TouchableOpacity>

      {cargando ? (
        <ActivityIndicator
          size="large"
          color="#1F4E79"
          style={styles.cargando}
        />
      ) : (
        <FlatList
          data={registros}
          keyExtractor={(item, index) =>
            `${item.id ?? index}`
          }
          renderItem={renderizarRegistro}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={
            <View>
              {resumen?.errores?.[seccion] ? (
                <Text style={styles.error}>
                  {resumen.errores[seccion]}
                </Text>
              ) : null}
              <Text style={styles.vacio}>
                {resumen?.disponibilidad?.[seccion] === false
                  ? 'Esta informacion aun no se ha sincronizado en este dispositivo.'
                  : 'No hay informacion registrada para esta seccion.'}
              </Text>
            </View>
          }
        />
      )}

      <View style={styles.pie}>
        <TouchableOpacity
          style={styles.actualizar}
          onPress={cargarInformacion}
          disabled={cargando}
        >
          <Text style={styles.botonTexto}>
            Volver a consultar datos locales
          </Text>
        </TouchableOpacity>

        {typeof onBack === 'function' && (
          <TouchableOpacity
            style={styles.volver}
            onPress={onBack}
          >
            <Text style={styles.volverTexto}>
              Volver
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  encabezado: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E8EF',
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F4E79',
  },
  subtitulo: {
    marginTop: 8,
    color: '#526273',
    lineHeight: 20,
  },
  fecha: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748B',
  },
  pestanas: {
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  pestanasContenido: {
    flexDirection: 'row',
  },
  pestana: {
    minWidth: 104,
    marginHorizontal: 2,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  pestanaActiva: {
    backgroundColor: '#1F4E79',
  },
  pestanaTexto: {
    fontSize: 11,
    fontWeight: '600',
    color: '#526273',
  },
  pestanaTextoActivo: {
    color: '#FFFFFF',
  },
  comunicados: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#1F4E79',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  lista: {
    padding: 16,
    flexGrow: 1,
  },
  registro: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E3E8EF',
  },
  registroTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  registroDetalle: {
    marginTop: 8,
    color: '#526273',
    lineHeight: 21,
  },
  vacio: {
    textAlign: 'center',
    marginTop: 48,
    color: '#64748B',
  },
  error: {
    textAlign: 'center',
    marginTop: 32,
    color: '#A52A22',
  },
  cargando: {
    marginTop: 40,
  },
  pie: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  actualizar: {
    backgroundColor: '#1F4E79',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  botonTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  volver: {
    padding: 12,
    alignItems: 'center',
  },
  volverTexto: {
    color: '#1F4E79',
    fontWeight: '600',
  },
});
