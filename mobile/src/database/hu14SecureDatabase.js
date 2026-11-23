import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// HU-14: prueba aislada de SQLCipher.
// NO abre ni modifica las bases de datos existentes.
const BASE_PRUEBA = 'aulaai_hu14_prueba_cifrada.db';
const CLAVE_PRUEBA = 'aulaai_hu14_prueba_sqlcipher_v1';

let pruebaEnCurso = null;

const obtenerClavePrueba = async () => {
  let clave = await SecureStore.getItemAsync(CLAVE_PRUEBA);

  if (clave === null) {
    const bytes = await Crypto.getRandomBytesAsync(32);

    clave = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');

    await SecureStore.setItemAsync(
      CLAVE_PRUEBA,
      clave
    );
  }

  if (!/^[a-f0-9]{64}$/i.test(clave)) {
    throw new Error(
      'La clave local de prueba no es válida.'
    );
  }

  return clave;
};

export const verificarSQLCipherHU14 = async () => {
  if (
    Platform.OS !== 'android' &&
    Platform.OS !== 'ios'
  ) {
    throw new Error(
      'La prueba de SQLCipher requiere Android o iOS.'
    );
  }

  if (pruebaEnCurso) {
    return pruebaEnCurso;
  }

  pruebaEnCurso = (async () => {
    const db = await SQLite.openDatabaseAsync(
      BASE_PRUEBA
    );

    try {
      // Comprobar el soporte nativo antes de cifrar.
      const soporte = await db.getFirstAsync(
        'PRAGMA cipher_version;'
      );

      if (!soporte?.cipher_version) {
        throw new Error(
          'SQLCipher no está disponible. Usa una development build con useSQLCipher: true. Expo Go no lo admite.'
        );
      }

      const clave = await obtenerClavePrueba();

      // Clave aleatoria de 256 bits.
      await db.execAsync(
        `PRAGMA key = "x'${clave}'";`
      );

      // Comprobar que la clave permite acceder
      // a la base antes de escribir.
      await db.getFirstAsync(
        'SELECT count(*) AS total FROM sqlite_master;'
      );

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS hu14_prueba_cifrado (
          id INTEGER PRIMARY KEY NOT NULL,
          contenido TEXT NOT NULL
        );
      `);

      await db.runAsync(
        `INSERT OR REPLACE INTO
          hu14_prueba_cifrado (id, contenido)
         VALUES (?, ?);`,
        [1, 'prueba_ok']
      );

      const registro = await db.getFirstAsync(
        `SELECT contenido
         FROM hu14_prueba_cifrado
         WHERE id = ?;`,
        [1]
      );

      if (registro?.contenido !== 'prueba_ok') {
        throw new Error(
          'La prueba de lectura y escritura falló.'
        );
      }

      return {
        sqlcipherDisponible: true,
        lecturaEscrituraCorrecta: true,
        baseProbada: BASE_PRUEBA,
      };
    } finally {
      await db.closeAsync();
    }
  })().finally(() => {
    pruebaEnCurso = null;
  });

  return pruebaEnCurso;
};
