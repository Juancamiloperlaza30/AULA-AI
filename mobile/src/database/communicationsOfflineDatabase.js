import * as SQLite from 'expo-sqlite';

let database = null;

const iniciarBase = async () => {
  if (!database) {
    database = await SQLite.openDatabaseAsync(
      'aulaai_offline.db'
    );
  }

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS comunicados_offline (
      usuario_id TEXT NOT NULL,
      comunicado_id TEXT NOT NULL,
      datos TEXT NOT NULL,
      sincronizado_en TEXT NOT NULL,
      PRIMARY KEY (usuario_id, comunicado_id)
    );

    CREATE TABLE IF NOT EXISTS notificaciones_offline (
      usuario_id TEXT NOT NULL,
      notificacion_id TEXT NOT NULL,
      datos TEXT NOT NULL,
      sincronizado_en TEXT NOT NULL,
      PRIMARY KEY (usuario_id, notificacion_id)
    );

    CREATE TABLE IF NOT EXISTS comunicaciones_sync_state (
      usuario_id TEXT NOT NULL,
      recurso TEXT NOT NULL,
      sincronizado_en TEXT NOT NULL,
      PRIMARY KEY (usuario_id, recurso)
    );
  `);

  return database;
};

const guardarRegistros = async ({
  usuarioId,
  recurso,
  registros,
  tabla,
  idCampo,
}) => {
  if (!usuarioId) {
    throw new Error(
      'Se requiere el usuario autenticado para guardar datos offline.'
    );
  }

  const db = await iniciarBase();
  const usuarioIdTexto = String(usuarioId);
  const sincronizadoEn = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const registro of registros || []) {
      if (registro?.id === null || registro?.id === undefined) {
        continue;
      }

      await db.runAsync(
        `INSERT INTO ${tabla} (
          usuario_id, ${idCampo}, datos, sincronizado_en
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(usuario_id, ${idCampo}) DO UPDATE SET
          datos = excluded.datos,
          sincronizado_en = excluded.sincronizado_en`,
        [
          usuarioIdTexto,
          String(registro.id),
          JSON.stringify(registro),
          sincronizadoEn,
        ]
      );
    }

    await db.runAsync(
      `INSERT INTO comunicaciones_sync_state (
        usuario_id, recurso, sincronizado_en
      ) VALUES (?, ?, ?)
      ON CONFLICT(usuario_id, recurso) DO UPDATE SET
        sincronizado_en = excluded.sincronizado_en`,
      [usuarioIdTexto, recurso, sincronizadoEn]
    );
  });

  return sincronizadoEn;
};

const obtenerRegistros = async ({
  usuarioId,
  tabla,
  idCampo,
  recurso,
}) => {
  if (!usuarioId) {
    return { registros: [], sincronizadoEn: null };
  }

  const db = await iniciarBase();
  const filas = await db.getAllAsync(
    `SELECT datos FROM ${tabla}
     WHERE usuario_id = ?
     ORDER BY sincronizado_en DESC, ${idCampo} DESC`,
    [String(usuarioId)]
  );
  const estado = await db.getFirstAsync(
    `SELECT sincronizado_en FROM comunicaciones_sync_state
     WHERE usuario_id = ? AND recurso = ?`,
    [String(usuarioId), recurso]
  );

  const registros = [];

  for (const fila of filas) {
    try {
      registros.push(JSON.parse(fila.datos));
    } catch (error) {
      console.warn(
        'Se omitió un registro offline con formato inválido.',
        error?.message || error
      );
    }
  }

  registros.sort((a, b) => {
    const fechaA = new Date(
      a.fechaPublicacion || a.fechaCreacion || 0
    ).getTime();
    const fechaB = new Date(
      b.fechaPublicacion || b.fechaCreacion || 0
    ).getTime();
    return fechaB - fechaA;
  });

  return {
    registros,
    sincronizadoEn: estado?.sincronizado_en || null,
    disponible:
      Boolean(estado?.sincronizado_en) ||
      filas.length > 0,
  };
};

export const guardarComunicadosOffline = ({
  usuarioId,
  comunicados,
}) =>
  guardarRegistros({
    usuarioId,
    recurso: 'comunicados',
    registros: comunicados,
    tabla: 'comunicados_offline',
    idCampo: 'comunicado_id',
  });

export const obtenerComunicadosOffline = (usuarioId) =>
  obtenerRegistros({
    usuarioId,
    recurso: 'comunicados',
    tabla: 'comunicados_offline',
    idCampo: 'comunicado_id',
  });

export const guardarNotificacionesOffline = ({
  usuarioId,
  notificaciones,
}) =>
  guardarRegistros({
    usuarioId,
    recurso: 'notificaciones',
    registros: notificaciones,
    tabla: 'notificaciones_offline',
    idCampo: 'notificacion_id',
  });

export const actualizarComunicadoOffline = async ({
  usuarioId,
  comunicado,
}) => {
  if (!usuarioId || !comunicado?.id) {
    return;
  }

  const db = await iniciarBase();
  await db.runAsync(
    `UPDATE comunicados_offline
     SET datos = ?, sincronizado_en = ?
     WHERE usuario_id = ? AND comunicado_id = ?`,
    [
      JSON.stringify(comunicado),
      new Date().toISOString(),
      String(usuarioId),
      String(comunicado.id),
    ]
  );
};

export const obtenerNotificacionesOffline = (usuarioId) =>
  obtenerRegistros({
    usuarioId,
    recurso: 'notificaciones',
    tabla: 'notificaciones_offline',
    idCampo: 'notificacion_id',
  });

export const actualizarNotificacionOffline = async ({
  usuarioId,
  notificacion,
}) => {
  if (!usuarioId || !notificacion?.id) {
    return;
  }

  const db = await iniciarBase();
  await db.runAsync(
    `UPDATE notificaciones_offline
     SET datos = ?, sincronizado_en = ?
     WHERE usuario_id = ? AND notificacion_id = ?`,
    [
      JSON.stringify(notificacion),
      new Date().toISOString(),
      String(usuarioId),
      String(notificacion.id),
    ]
  );
};

export const eliminarCacheComunicacionesOffline =
  async (usuarioId) => {
    if (!usuarioId) {
      return;
    }

    const db = await iniciarBase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'DELETE FROM comunicados_offline WHERE usuario_id = ?',
        [String(usuarioId)]
      );
      await db.runAsync(
        'DELETE FROM notificaciones_offline WHERE usuario_id = ?',
        [String(usuarioId)]
      );
      await db.runAsync(
        'DELETE FROM comunicaciones_sync_state WHERE usuario_id = ?',
        [String(usuarioId)]
      );
    });
  };
