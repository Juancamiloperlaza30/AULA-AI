import * as SQLite from 'expo-sqlite';

let db = null;

export const iniciarBaseLocal = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(
      'aulaai.db'
    );
  }

  const columnas =
    await db.getAllAsync(`
      PRAGMA table_info(materias_locales);
    `);

  const tablaExiste =
    columnas.length > 0;

  const tieneUsuarioId =
    columnas.some(
      (columna) =>
        columna.name === 'usuario_id'
    );

  if (
    tablaExiste &&
    !tieneUsuarioId
  ) {
    await db.execAsync(`
      DROP TABLE materias_locales;
    `);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS materias_locales (
      id INTEGER NOT NULL,
      usuario_id TEXT NOT NULL,
      periodo_id INTEGER,
      nombre TEXT NOT NULL,
      grado TEXT,
      grupo TEXT,
      periodo TEXT,
      estado TEXT,
      docentes TEXT,
      sincronizado_en TEXT,
      PRIMARY KEY (id, usuario_id)
    );
  `);

  const columnasMaterias =
    await db.getAllAsync(`
      PRAGMA table_info(materias_locales);
    `);

  const tienePeriodoId =
    columnasMaterias.some(
      (columna) =>
        columna.name === 'periodo_id'
    );

  if (!tienePeriodoId) {
    await db.execAsync(`
      ALTER TABLE materias_locales
      ADD COLUMN periodo_id INTEGER;
    `);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS actividades_locales (
      id INTEGER NOT NULL,
      usuario_id TEXT NOT NULL,
      tipo TEXT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      fecha_publicacion TEXT,
      fecha_entrega TEXT,
      estado TEXT,
      materia TEXT,
      grado TEXT,
      grupo TEXT,
      periodo TEXT,
      sincronizado_en TEXT,
      PRIMARY KEY (id, usuario_id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS calificaciones_locales (
      id INTEGER NOT NULL,
      usuario_id TEXT NOT NULL,
      actividad_id INTEGER NOT NULL,
      valor REAL NOT NULL,
      retroalimentacion TEXT,
      estado TEXT,
      actividad_titulo TEXT,
      actividad_tipo TEXT,
      materia TEXT,
      grado TEXT,
      grupo TEXT,
      fecha_entrega TEXT,
      created_at TEXT,
      updated_at TEXT,
      sincronizado_en TEXT,
      PRIMARY KEY (id, usuario_id)
    );
  `);

  const columnasActividades =
    await db.getAllAsync(`
      PRAGMA table_info(actividades_locales);
    `);

  const nombresColumnas =
    columnasActividades.map(
      (columna) => columna.name
    );

  if (
    !nombresColumnas.includes(
      'entrega_id'
    )
  ) {
    await db.execAsync(`
      ALTER TABLE actividades_locales
      ADD COLUMN entrega_id INTEGER;
    `);
  }

  if (
    !nombresColumnas.includes(
      'entrega_estado'
    )
  ) {
    await db.execAsync(`
      ALTER TABLE actividades_locales
      ADD COLUMN entrega_estado TEXT;
    `);
  }

  if (
    !nombresColumnas.includes(
      'entrega_fecha'
    )
  ) {
    await db.execAsync(`
      ALTER TABLE actividades_locales
      ADD COLUMN entrega_fecha TEXT;
    `);
  }

  if (
    !nombresColumnas.includes(
      'entrega_comentario'
    )
  ) {
    await db.execAsync(`
      ALTER TABLE actividades_locales
      ADD COLUMN entrega_comentario TEXT;
    `);
  }

  if (
    !nombresColumnas.includes(
      'calificacion_id'
    )
  ) {
    await db.execAsync(`
      ALTER TABLE actividades_locales
      ADD COLUMN calificacion_id INTEGER;
    `);
  }

  if (
    !nombresColumnas.includes(
      'calificacion_valor'
    )
  ) {
    await db.execAsync(`
      ALTER TABLE actividades_locales
      ADD COLUMN calificacion_valor REAL;
    `);
  }

  if (
    !nombresColumnas.includes(
      'calificacion_retroalimentacion'
    )
  ) {
    await db.execAsync(`
      ALTER TABLE actividades_locales
      ADD COLUMN calificacion_retroalimentacion TEXT;
    `);
  }

  return db;
};

export const guardarMateriasLocales =
  async (
    usuarioId,
    materias = [],
    periodoId = null
  ) => {
    const database =
      await iniciarBaseLocal();

    if (!usuarioId) {
      throw new Error(
        'Se requiere el identificador del usuario.'
      );
    }

    await database.withTransactionAsync(
      async () => {
        if (periodoId) {
          await database.runAsync(
            `
            DELETE FROM materias_locales
            WHERE usuario_id = ?
            AND periodo_id = ?
            `,
            [
              usuarioId,
              periodoId,
            ]
          );
        } else {
          await database.runAsync(
            `
            DELETE FROM materias_locales
            WHERE usuario_id = ?
            `,
            [usuarioId]
          );
        }

        for (const item of materias) {
          const materia =
            item.asignacion || item;

          const docentes =
            materia.materia_docente
              ?.map((relacion) => {
                const docente =
                  relacion.usuarios ||
                  relacion.docente;

                if (!docente) {
                  return '';
                }

                return `${docente.nombres || ''} ${
                  docente.apellidos || ''
                }`.trim();
              })
              .filter(Boolean)
              .join(', ') || '';

          const periodoIdMateria =
            materia.periodo_id ??
            materia.periodo?.id ??
            periodoId ??
            null;

          await database.runAsync(
            `
            INSERT OR REPLACE INTO materias_locales (
              id,
              usuario_id,
              periodo_id,
              nombre,
              grado,
              grupo,
              periodo,
              estado,
              docentes,
              sincronizado_en
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              materia.id,
              usuarioId,
              periodoIdMateria,
              materia.materia?.nombre || '',
              materia.grado?.nombre || '',
              materia.grupo?.nombre || '',
              materia.periodo?.nombre || '',
              materia.estado || 'activa',
              docentes,
              new Date().toISOString(),
            ]
          );
        }
      }
    );
  };

export const obtenerMateriasLocales =
  async (
    usuarioId,
    periodoId = null
  ) => {
    const database =
      await iniciarBaseLocal();

    if (!usuarioId) {
      return [];
    }

    if (periodoId) {
      return await database.getAllAsync(
        `
        SELECT *
        FROM materias_locales
        WHERE usuario_id = ?
        AND periodo_id = ?
        ORDER BY nombre ASC
        `,
        [
          usuarioId,
          periodoId,
        ]
      );
    }

    return await database.getAllAsync(
      `
      SELECT *
      FROM materias_locales
      WHERE usuario_id = ?
      ORDER BY nombre ASC
      `,
      [usuarioId]
    );
  };

export const guardarActividadesLocales =
  async (
    usuarioId,
    actividades = []
  ) => {
    const database =
      await iniciarBaseLocal();

    if (!usuarioId) {
      throw new Error(
        'Se requiere el identificador del usuario.'
      );
    }

    await database.withTransactionAsync(
      async () => {
        await database.runAsync(
          `
          DELETE FROM actividades_locales
          WHERE usuario_id = ?
          `,
          [usuarioId]
        );

        for (
          const actividad of actividades
        ) {
          const asignacion =
            actividad.materia_grupo_periodo;

          await database.runAsync(
            `
            INSERT INTO actividades_locales (
              id,
              usuario_id,
              tipo,
              titulo,
              descripcion,
              fecha_publicacion,
              fecha_entrega,
              estado,
              materia,
              grado,
              grupo,
              periodo,
              entrega_id,
              entrega_estado,
              entrega_fecha,
              entrega_comentario,
              calificacion_id,
              calificacion_valor,
              calificacion_retroalimentacion,
              sincronizado_en
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            `,
            [
              actividad.id,
              usuarioId,
              actividad.tipo || '',
              actividad.titulo || '',
              actividad.descripcion || '',
              actividad.fecha_publicacion || '',
              actividad.fecha_entrega || '',
              actividad.estado || '',
              asignacion?.materia?.nombre || '',
              asignacion?.grado?.nombre || '',
              asignacion?.grupo?.nombre || '',
              asignacion?.periodo?.nombre || '',
              actividad.entrega?.id || null,
              actividad.entrega?.estado || null,
              actividad.entrega?.fecha_entrega || null,
              actividad.entrega?.comentario || null,
              actividad.calificacion?.id || null,
              actividad.calificacion?.valor ?? null,
              actividad.calificacion?.retroalimentacion || null,
              new Date().toISOString(),
            ]
          );
        }
      }
    );
  };

export const obtenerActividadesLocales =
  async (usuarioId) => {
    const database =
      await iniciarBaseLocal();

    if (!usuarioId) {
      return [];
    }

    return await database.getAllAsync(
      `
      SELECT *
      FROM actividades_locales
      WHERE usuario_id = ?
      ORDER BY fecha_entrega ASC
      `,
      [usuarioId]
    );
  };

export const guardarCalificacionesLocales =
  async (
    usuarioId,
    calificaciones = []
  ) => {
    const database =
      await iniciarBaseLocal();

    if (!usuarioId) {
      throw new Error(
        'Se requiere el identificador del usuario.'
      );
    }

    await database.withTransactionAsync(
      async () => {
        await database.runAsync(
          `
          DELETE FROM calificaciones_locales
          WHERE usuario_id = ?
          `,
          [usuarioId]
        );

        for (
          const calificacion of calificaciones
        ) {
          const actividad =
            calificacion.actividad;

          const asignacion =
            actividad
              ?.materia_grupo_periodo;

          await database.runAsync(
            `
            INSERT INTO calificaciones_locales (
              id,
              usuario_id,
              actividad_id,
              valor,
              retroalimentacion,
              estado,
              actividad_titulo,
              actividad_tipo,
              materia,
              grado,
              grupo,
              fecha_entrega,
              created_at,
              updated_at,
              sincronizado_en
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            `,
            [
              calificacion.id,
              usuarioId,
              actividad?.id || null,
              calificacion.valor,
              calificacion.retroalimentacion || '',
              calificacion.estado || '',
              actividad?.titulo || '',
              actividad?.tipo || '',
              asignacion?.materia?.nombre || '',
              asignacion?.grado?.nombre || '',
              asignacion?.grupo?.nombre || '',
              actividad?.fecha_entrega || '',
              calificacion.created_at || '',
              calificacion.updated_at || '',
              new Date().toISOString(),
            ]
          );
        }
      }
    );
  };

export const obtenerCalificacionesLocales =
  async (usuarioId) => {
    const database =
      await iniciarBaseLocal();

    if (!usuarioId) {
      return [];
    }

    return await database.getAllAsync(
      `
      SELECT *
      FROM calificaciones_locales
      WHERE usuario_id = ?
      ORDER BY created_at DESC
      `,
      [usuarioId]
    );
  };
