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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  consultarResumenAcademicoOffline,
} from '../services/academicOfflineService';

const SECCIONES = [
  { id: 'materias', titulo: 'Materias' },
  { id: 'actividades', titulo: 'Actividades' },
  { id: 'calificaciones', titulo: 'Calificaciones' },
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
  onBack,
}) {
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState(null);
  const [seccion, setSeccion] = useState('materias');
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

  const registros = resumen?.[seccion] || [];

  const renderizarRegistro = ({ item }) => {
    let titulo = '';
    let detalle = '';

    if (seccion === 'materias') {
      titulo = item.nombre || 'Materia sin nombre';
      detalle = [
        item.grado,
        item.grupo,
        item.periodo,
      ].filter(Boolean).join(' - ');
    }

    if (seccion === 'actividades') {
      titulo = item.titulo || 'Actividad sin titulo';
      detalle = [
        item.materia,
        item.estado,
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

      <View style={styles.pestanas}>
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
      </View>

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
            <Text style={styles.vacio}>
              No hay informacion almacenada
              para esta seccion.
            </Text>
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
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  pestana: {
    flex: 1,
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
