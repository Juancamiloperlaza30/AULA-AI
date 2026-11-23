
import { File, FileMode } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// HU-14: inventario no destructivo de bases SQLite.

const BASES = [
  'aulaai.db',
  'aulaai_offline.db',
  'aulaai_asistencias.db',
  'aulaai_estudiante_academico.db',
  'aulaai_acudiente_academico.db',
];

const CABECERA_SQLITE = [
  83, 81, 76, 105, 116, 101, 32, 102,
  111, 114, 109, 97, 116, 32, 51, 0,
];

// Convertir la ruta nativa a una URI absoluta.
const obtenerArchivo = (nombre) => {
  const directorio = SQLite.defaultDatabaseDirectory;

  if (
    typeof directorio !== 'string' ||
    (!directorio.startsWith('/') &&
      !directorio.startsWith('file://'))
  ) {
    throw new Error(
      'La ruta nativa de SQLite no es absoluta.'
    );
  }

  const ruta = directorio.replace(/\/+$/, '');

  const uriBase = ruta.startsWith('file://')
    ? ruta
    : `file://${ruta}`;

  return new File(`${uriBase}/${nombre}`);
};

const revisarAuxiliar = (nombre) => {
  const archivo = obtenerArchivo(nombre);

  return {
    existe: archivo.exists,
    bytes: archivo.exists ? archivo.size : 0,
  };
};

const revisarBase = (nombre) => {
  const archivo = obtenerArchivo(nombre);

  const wal = revisarAuxiliar(`${nombre}-wal`);
  const shm = revisarAuxiliar(`${nombre}-shm`);

  if (!archivo.exists) {
    return {
      nombre,
      estado: 'NO_CREADA_EN_ESTE_DISPOSITIVO',
      bytes: 0,
      wal,
      shm,
    };
  }

  let manejador = null;
  let formato = 'DESCONOCIDO';

  try {
    manejador = archivo.open(FileMode.ReadOnly);

    const cabecera = manejador.readBytes(16);

    const esSQLiteSinCifrar =
      cabecera.length === 16 &&
      CABECERA_SQLITE.every(
        (valor, indice) =>
          cabecera[indice] === valor
      );

    formato = esSQLiteSinCifrar
      ? 'CABECERA_SQLITE_EN_TEXTO_PLANO'
      : 'SIN_CABECERA_SQLITE_NO_CONCLUYENTE';

  } finally {
    manejador?.close();
  }

  return {
    nombre,
    estado: 'ENCONTRADA',
    bytes: archivo.size,
    formato,
    wal,
    shm,
  };
};

export const revisarBasesLocalesHU14 = async () => {
  if (
    Platform.OS !== 'android' &&
    Platform.OS !== 'ios'
  ) {
    throw new Error(
      'Esta revisión requiere Android o iOS.'
    );
  }

  const bases = BASES.map((nombre) => {
    try {
      return revisarBase(nombre);
    } catch (error) {
      return {
        nombre,
        estado: 'ERROR_DE_LECTURA',
        detalle: String(
          error?.message || error
        ).split('\n')[0],
      };
    }
  });

  return {
    fecha: new Date().toISOString(),
    tipo: 'INVENTARIO_LECTURA_SOLAMENTE',
    bases,
    migracionEjecutada: false,
  };
};
