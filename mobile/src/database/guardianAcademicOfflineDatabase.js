import * as SQLite from 'expo-sqlite';

const NOMBRE_BASE =
  'aulaai_acudiente_academico.db';
const CLAVE_ESTUDIANTES_VINCULADOS =
  '__estudiantes_vinculados__';

let promesaBase = null;
let promesaInicializacion = null;

const validarTexto = (valor, nombre) => {
  if (
    typeof valor !== 'string' ||
    !valor.trim()
  ) {
    throw new Error(
      `Se requiere un ${nombre} valido.`
    );
  }

  return valor.trim();
};

const abrirBase = async () => {
  if (!promesaBase) {
    promesaBase = SQLite.openDatabaseAsync(
      NOMBRE_BASE
    ).catch((error) => {
      promesaBase = null;
      throw error;
    });
  }

  return promesaBase;
};

export const iniciarBaseAcudienteOffline =
  async () => {
    if (!promesaInicializacion) {
      promesaInicializacion = (async () => {
        const db = await abrirBase();

        await db.execAsync(`
          PRAGMA journal_mode = WAL;

          CREATE TABLE IF NOT EXISTS
            acudiente_academico_cache (
              acudiente_id TEXT NOT NULL,
              estudiante_id TEXT NOT NULL,
              recurso TEXT NOT NULL,
              clave TEXT NOT NULL,
              contenido_json TEXT NOT NULL,
              sincronizado_en TEXT NOT NULL,
              PRIMARY KEY (
                acudiente_id,
                estudiante_id,
                recurso,
                clave
              )
            );

          CREATE INDEX IF NOT EXISTS
            idx_acudiente_cache_usuario_estudiante
          ON acudiente_academico_cache (
            acudiente_id,
            estudiante_id
          );
        `);

        return db;
      })().catch((error) => {
        promesaInicializacion = null;
        throw error;
      });
    }

    return promesaInicializacion;
  };

export const guardarCacheAcudienteOffline =
  async ({
    acudienteId,
    estudianteId,
    recurso,
    clave = 'principal',
    contenido,
  }) => {
    const acudiente = validarTexto(
      acudienteId,
      'acudiente'
    );
    const estudiante = validarTexto(
      estudianteId,
      'estudiante'
    );
    const recursoValido = validarTexto(
      recurso,
      'recurso'
    );
    const claveValida = validarTexto(
      clave,
      'clave de caché'
    );

    if (
      contenido === undefined ||
      contenido === null
    ) {
      throw new Error(
        'El contenido de la caché no es válido.'
      );
    }

    const contenidoJson = JSON.stringify(
      contenido
    );

    if (typeof contenidoJson !== 'string') {
      throw new Error(
        'No fue posible serializar la caché académica.'
      );
    }

    const sincronizadoEn =
      new Date().toISOString();
    const db =
      await iniciarBaseAcudienteOffline();

    await db.runAsync(
      `
        INSERT INTO acudiente_academico_cache (
          acudiente_id,
          estudiante_id,
          recurso,
          clave,
          contenido_json,
          sincronizado_en
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (
          acudiente_id,
          estudiante_id,
          recurso,
          clave
        )
        DO UPDATE SET
          contenido_json =
            excluded.contenido_json,
          sincronizado_en =
            excluded.sincronizado_en
      `,
      [
        acudiente,
        estudiante,
        recursoValido,
        claveValida,
        contenidoJson,
        sincronizadoEn,
      ]
    );

    return { sincronizadoEn };
  };

export const obtenerCacheAcudienteOffline =
  async ({
    acudienteId,
    estudianteId,
    recurso,
    clave = 'principal',
  }) => {
    const acudiente = validarTexto(
      acudienteId,
      'acudiente'
    );
    const estudiante = validarTexto(
      estudianteId,
      'estudiante'
    );
    const recursoValido = validarTexto(
      recurso,
      'recurso'
    );
    const claveValida = validarTexto(
      clave,
      'clave de caché'
    );
    const db =
      await iniciarBaseAcudienteOffline();

    const fila = await db.getFirstAsync(
      `
        SELECT contenido_json, sincronizado_en
        FROM acudiente_academico_cache
        WHERE acudiente_id = ?
          AND estudiante_id = ?
          AND recurso = ?
          AND clave = ?
        LIMIT 1
      `,
      [
        acudiente,
        estudiante,
        recursoValido,
        claveValida,
      ]
    );

    if (!fila) {
      return null;
    }

    try {
      return {
        contenido: JSON.parse(
          fila.contenido_json
        ),
        sincronizadoEn:
          fila.sincronizado_en,
      };
    } catch {
      throw new Error(
        'No fue posible leer la copia académica local.'
      );
    }
  };

export const eliminarCacheEstudianteAcudienteOffline =
  async ({ acudienteId, estudianteId }) => {
    const acudiente = validarTexto(
      acudienteId,
      'acudiente'
    );
    const estudiante = validarTexto(
      estudianteId,
      'estudiante'
    );
    const db =
      await iniciarBaseAcudienteOffline();

    return db.runAsync(
      `
        DELETE FROM acudiente_academico_cache
        WHERE acudiente_id = ?
          AND estudiante_id = ?
      `,
      [acudiente, estudiante]
    );
  };

export const eliminarCachesEstudiantesNoVinculados =
  async ({ acudienteId, estudianteIds }) => {
    const acudiente = validarTexto(
      acudienteId,
      'acudiente'
    );

    if (!Array.isArray(estudianteIds)) {
      throw new Error(
        'La lista de estudiantes vinculados no es válida.'
      );
    }

    const ids = [
      ...new Set(
        estudianteIds
          .filter(
            (id) =>
              typeof id === 'string' &&
              id.trim()
          )
          .map((id) => id.trim())
      ),
    ];
    const db =
      await iniciarBaseAcudienteOffline();

    if (ids.length === 0) {
      return db.runAsync(
        `
          DELETE FROM acudiente_academico_cache
          WHERE acudiente_id = ?
            AND estudiante_id <> ?
        `,
        [
          acudiente,
          CLAVE_ESTUDIANTES_VINCULADOS,
        ]
      );
    }

    const marcadores = ids
      .map(() => '?')
      .join(', ');

    return db.runAsync(
      `
        DELETE FROM acudiente_academico_cache
        WHERE acudiente_id = ?
          AND estudiante_id <> ?
          AND estudiante_id NOT IN (${marcadores})
      `,
      [
        acudiente,
        CLAVE_ESTUDIANTES_VINCULADOS,
        ...ids,
      ]
    );
  };

export const eliminarCacheAcudienteOffline =
  async (acudienteId) => {
    const acudiente = validarTexto(
      acudienteId,
      'acudiente'
    );
    const db =
      await iniciarBaseAcudienteOffline();

    return db.runAsync(
      `
        DELETE FROM acudiente_academico_cache
        WHERE acudiente_id = ?
      `,
      [acudiente]
    );
  };

export const CLAVE_CACHE_ESTUDIANTES_VINCULADOS =
  CLAVE_ESTUDIANTES_VINCULADOS;
