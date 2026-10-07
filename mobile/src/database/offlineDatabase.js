import * as SQLite from 'expo-sqlite';

let database = null;

export const iniciarBaseOffline = async () => {
  if (!database) {
    database =
      await SQLite.openDatabaseAsync(
        'aulaai_offline.db'
      );
  }

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS materias_offline (
      id INTEGER PRIMARY KEY NOT NULL,
      materia_nombre TEXT NOT NULL,
      grado_nombre TEXT,
      grupo_nombre TEXT,
      periodo_id INTEGER,
      periodo_nombre TEXT,
      estado TEXT,
      usuario_id TEXT NOT NULL,
      tipo_usuario TEXT NOT NULL,
      sincronizado_en TEXT NOT NULL
    );
  `);

  const columnasMateriasOffline =
    await database.getAllAsync(`
      PRAGMA table_info(materias_offline);
    `);

  const tienePeriodoIdOffline =
    columnasMateriasOffline.some(
      (columna) =>
        columna.name === 'periodo_id'
    );

  if (!tienePeriodoIdOffline) {
    await database.execAsync(`
      ALTER TABLE materias_offline
      ADD COLUMN periodo_id INTEGER;
    `);
  }

  return database;
};

export const guardarMateriasOffline = async ({
  materias,
  usuarioId,
  tipoUsuario,
  periodoId = null,
}) => {
  if (!usuarioId || !tipoUsuario) {
    throw new Error(
      'Se requiere el usuario y su tipo para guardar materias offline.'
    );
  }

  const db = await iniciarBaseOffline();
  const usuarioIdTexto = String(usuarioId);
  const sincronizadoEn =
    new Date().toISOString();

  await db.withTransactionAsync(
    async () => {
      if (
        tipoUsuario === 'estudiante' &&
        periodoId
      ) {
        await db.runAsync(
          `
          DELETE FROM materias_offline
          WHERE usuario_id = ?
          AND tipo_usuario = ?
          AND periodo_id = ?
          `,
          [
            usuarioIdTexto,
            tipoUsuario,
            periodoId,
          ]
        );
      } else {
        await db.runAsync(
          `
          DELETE FROM materias_offline
          WHERE usuario_id = ?
          AND tipo_usuario = ?
          `,
          [
            usuarioIdTexto,
            tipoUsuario,
          ]
        );
      }

      for (
        const item of materias || []
      ) {
        const asignacion =
          item.asignacion || item;

        const materia =
          asignacion.materia ||
          item.materia;

        const grado =
          asignacion.grado ||
          item.grado;

        const grupo =
          asignacion.grupo ||
          item.grupo;

        const periodo =
          asignacion.periodo ||
          item.periodo;

        const periodoIdMateria =
          asignacion.periodo_id ??
          periodo?.id ??
          periodoId ??
          null;

        await db.runAsync(
          `
          INSERT INTO materias_offline (
            materia_nombre,
            grado_nombre,
            grupo_nombre,
            periodo_id,
            periodo_nombre,
            estado,
            usuario_id,
            tipo_usuario,
            sincronizado_en
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            materia?.nombre || '',
            grado?.nombre || null,
            grupo?.nombre || null,
            periodoIdMateria,
            periodo?.nombre || null,
            asignacion.estado ||
              item.estado ||
              null,
            usuarioIdTexto,
            tipoUsuario,
            sincronizadoEn,
          ]
        );
      }
    }
  );
};

export const obtenerMateriasOffline = async ({
  usuarioId,
  tipoUsuario,
}) => {
  if (!usuarioId || !tipoUsuario) {
    throw new Error(
      'Se requiere el usuario y su tipo para consultar materias offline.'
    );
  }

  const db = await iniciarBaseOffline();
  const filas = await db.getAllAsync(
    `SELECT
      id,
      materia_nombre,
      grado_nombre,
      grupo_nombre,
      periodo_nombre,
      estado
    FROM materias_offline
    WHERE usuario_id = ? AND tipo_usuario = ?
    ORDER BY id`,
    [String(usuarioId), tipoUsuario]
  );

  return filas.map((fila) => ({
    id: fila.id,
    materia: {
      nombre: fila.materia_nombre,
    },
    grado: fila.grado_nombre
      ? { nombre: fila.grado_nombre }
      : null,
    grupo: fila.grupo_nombre
      ? { nombre: fila.grupo_nombre }
      : null,
    periodo: fila.periodo_nombre
      ? { nombre: fila.periodo_nombre }
      : null,
    estado: fila.estado,
  }));
};
