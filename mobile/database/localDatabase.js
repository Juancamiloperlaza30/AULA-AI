
import * as SQLite from 'expo-sqlite';

// ==================================================
// AULA-AI | BASE DE DATOS LOCAL
// HU-03, HU-04, HU-05 Y HU-07
//
// Mantiene materias, actividades y calificaciones
// independientes para cada usuario.
//
// La migracion agrega columnas faltantes.
// No elimina los registros anteriores.
// ==================================================

let db = null;
let inicializacion = null;

const primero = (valor) =>
  Array.isArray(valor) ? valor[0] : valor;

const texto = (valor) =>
  valor == null ? '' : String(valor);

const ejecutarMigracion = async (
  database,
  tabla,
  columnasNuevas
) => {
  const columnas = await database.getAllAsync(
    `PRAGMA table_info(${tabla});`
  );

  const existentes = new Set(
    columnas.map((columna) => columna.name)
  );

  for (const [nombre, tipo] of columnasNuevas) {
    if (!existentes.has(nombre)) {
      await database.execAsync(
        `ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo};`
      );
    }
  }
};

// ==================================================
// 1. INICIALIZAR BASE DE DATOS
// ==================================================

export const iniciarBaseLocal = async () => {
  if (inicializacion) {
    return inicializacion;
  }

  inicializacion = (async () => {
    if (!db) {
      db = await SQLite.openDatabaseAsync(
        'aulaai.db'
      );
    }

    await db.execAsync(`
      PRAGMA journal_mode = WAL;

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

    // HU-03: compatibilidad de materias.
    await ejecutarMigracion(
      db,
      'materias_locales',
      [
        ['periodo_id', 'INTEGER'],
      ]
    );

    // HU-04: datos de entregas y calificaciones
    // asociados a cada actividad.
    await ejecutarMigracion(
      db,
      'actividades_locales',
      [
        ['entrega_id', 'INTEGER'],
        ['entrega_estado', 'TEXT'],
        ['entrega_fecha', 'TEXT'],
        ['entrega_comentario', 'TEXT'],
        ['calificacion_id', 'INTEGER'],
        ['calificacion_valor', 'REAL'],
        ['calificacion_retroalimentacion', 'TEXT'],
      ]
    );

    // HU-07: datos academicos necesarios para
    // reconstruir los filtros sin internet.
    await ejecutarMigracion(
      db,
      'calificaciones_locales',
      [
        ['materia_id', 'INTEGER'],
        ['periodo_id', 'INTEGER'],
        ['periodo_nombre', 'TEXT'],
        ['anio', 'INTEGER'],
      ]
    );

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS
        idx_calificaciones_usuario_periodo
      ON calificaciones_locales (
        usuario_id,
        periodo_id
      );

      CREATE INDEX IF NOT EXISTS
        idx_calificaciones_usuario_materia
      ON calificaciones_locales (
        usuario_id,
        materia_id
      );
    `);

    return db;
  })().catch((error) => {
    inicializacion = null;
    throw error;
  });

  return inicializacion;
};

// ==================================================
// 2. GUARDAR MATERIAS LOCALES
// Mantiene la funcion utilizada por HU-03.
// ==================================================

export const guardarMateriasLocales = async (
  usuarioId,
  materias = [],
  periodoId = null
) => {
  const database = await iniciarBaseLocal();

  if (!usuarioId) {
    throw new Error(
      'Se requiere el identificador del usuario.'
    );
  }

  if (!Array.isArray(materias)) {
    throw new Error(
      'La lista de materias no es valida.'
    );
  }

  await database.withTransactionAsync(
    async () => {
      if (periodoId != null) {
        await database.runAsync(
          `
            DELETE FROM materias_locales
            WHERE usuario_id = ?
              AND periodo_id = ?
          `,
          [usuarioId, periodoId]
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

      const ahora = new Date().toISOString();

      for (const item of materias) {
        const asignacion = primero(
          item.asignacion || item
        );

        const materia = primero(
          asignacion?.materia
        );

        const grado = primero(
          asignacion?.grado
        );

        const grupo = primero(
          asignacion?.grupo
        );

        const periodo = primero(
          asignacion?.periodo
        );

        const relacionesDocentes =
          asignacion?.materia_docente || [];

        const docentes = (
          Array.isArray(relacionesDocentes)
            ? relacionesDocentes
            : []
        )
          .map((relacion) => {
            const docente = primero(
              relacion.usuarios ||
              relacion.docente
            );

            if (!docente) return '';

            return [
              docente.nombres,
              docente.apellidos,
            ]
              .filter(Boolean)
              .join(' ');
          })
          .filter(Boolean)
          .join(', ');

        const idPeriodo =
          asignacion?.periodo_id ??
          periodo?.id ??
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
            asignacion.id,
            usuarioId,
            idPeriodo,
            texto(materia?.nombre),
            texto(grado?.nombre),
            texto(grupo?.nombre),
            texto(periodo?.nombre),
            texto(
              asignacion.estado || 'activa'
            ),
            docentes,
            ahora,
          ]
        );
      }
    }
  );
};

// ==================================================
// 3. OBTENER MATERIAS LOCALES
// ==================================================

export const obtenerMateriasLocales = async (
  usuarioId,
  periodoId = null
) => {
  const database = await iniciarBaseLocal();

  if (!usuarioId) return [];

  if (periodoId != null) {
    return database.getAllAsync(
      `
        SELECT *
        FROM materias_locales
        WHERE usuario_id = ?
          AND periodo_id = ?
        ORDER BY nombre ASC
      `,
      [usuarioId, periodoId]
    );
  }

  return database.getAllAsync(
    `
      SELECT *
      FROM materias_locales
      WHERE usuario_id = ?
      ORDER BY nombre ASC
    `,
    [usuarioId]
  );
};

// ==================================================
// 4. GUARDAR ACTIVIDADES LOCALES
// Mantiene las entregas y notas de HU-04.
// ==================================================

export const guardarActividadesLocales = async (
  usuarioId,
  actividades = []
) => {
  const database = await iniciarBaseLocal();

  if (!usuarioId) {
    throw new Error(
      'Se requiere el identificador del usuario.'
    );
  }

  if (!Array.isArray(actividades)) {
    throw new Error(
      'La lista de actividades no es valida.'
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

      const ahora = new Date().toISOString();

      for (const actividad of actividades) {
        const asignacion = primero(
          actividad.materia_grupo_periodo
        );

        const materia = primero(
          asignacion?.materia
        );

        const grado = primero(
          asignacion?.grado
        );

        const grupo = primero(
          asignacion?.grupo
        );

        const periodo = primero(
          asignacion?.periodo
        );

        const entrega = primero(
          actividad.entrega
        );

        const calificacion = primero(
          actividad.calificacion
        );

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
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `,
          [
            actividad.id,
            usuarioId,
            texto(actividad.tipo),
            texto(actividad.titulo),
            texto(actividad.descripcion),
            texto(actividad.fecha_publicacion),
            texto(actividad.fecha_entrega),
            texto(actividad.estado),
            texto(materia?.nombre),
            texto(grado?.nombre),
            texto(grupo?.nombre),
            texto(periodo?.nombre),
            entrega?.id ?? null,
            entrega?.estado ?? null,
            entrega?.fecha_entrega ?? null,
            entrega?.comentario ?? null,
            calificacion?.id ?? null,
            calificacion?.valor ?? null,
            calificacion?.retroalimentacion ?? null,
            ahora,
          ]
        );
      }
    }
  );
};

// ==================================================
// 5. OBTENER ACTIVIDADES LOCALES
// ==================================================

export const obtenerActividadesLocales = async (
  usuarioId
) => {
  const database = await iniciarBaseLocal();

  if (!usuarioId) return [];

  return database.getAllAsync(
    `
      SELECT *
      FROM actividades_locales
      WHERE usuario_id = ?
      ORDER BY fecha_entrega ASC
    `,
    [usuarioId]
  );
};

// ==================================================
// 6. GUARDAR CALIFICACIONES LOCALES
//
// HU-07: agrega materia_id, periodo_id,
// periodo_nombre y anio.
//
// El resto de campos de HU-05 se conserva.
// ==================================================

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

    if (!Array.isArray(calificaciones)) {
      throw new Error(
        'La lista de calificaciones no es valida.'
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

        const ahora =
          new Date().toISOString();

        for (const calificacion of calificaciones) {
          const actividad = primero(
            calificacion.actividad
          );

          const asignacion = primero(
            actividad?.materia_grupo_periodo
          );

          const materia = primero(
            asignacion?.materia
          );

          const grado = primero(
            asignacion?.grado
          );

          const grupo = primero(
            asignacion?.grupo
          );

          const periodo = primero(
            asignacion?.periodo
          );

          const periodoId =
            asignacion?.periodo_id ??
            periodo?.id ??
            null;

          const anioTexto = String(
            periodo?.anio ??
            periodo?.fecha_inicio ??
            ''
          ).slice(0, 4);

          const anio =
            /^\d{4}$/.test(anioTexto)
              ? Number(anioTexto)
              : null;

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
                sincronizado_en,
                materia_id,
                periodo_id,
                periodo_nombre,
                anio
              )
              VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?
              )
            `,
            [
              calificacion.id,
              usuarioId,
              actividad?.id ??
                calificacion.actividad_id,
              calificacion.valor,
              texto(
                calificacion.retroalimentacion
              ),
              texto(calificacion.estado),
              texto(actividad?.titulo),
              texto(actividad?.tipo),
              texto(materia?.nombre),
              texto(grado?.nombre),
              texto(grupo?.nombre),
              texto(actividad?.fecha_entrega),
              texto(calificacion.created_at),
              texto(calificacion.updated_at),
              ahora,
              materia?.id ??
                asignacion?.materia_id ??
                null,
              periodoId,
              texto(periodo?.nombre),
              anio,
            ]
          );
        }
      }
    );
  };

// ==================================================
// 7. OBTENER CALIFICACIONES LOCALES
//
// Los nuevos campos quedan disponibles
// para StudentGradesScreen.js.
// ==================================================

export const obtenerCalificacionesLocales =
  async (usuarioId) => {
    const database =
      await iniciarBaseLocal();

    if (!usuarioId) return [];

    return database.getAllAsync(
      `
        SELECT *
        FROM calificaciones_locales
        WHERE usuario_id = ?
        ORDER BY created_at DESC
      `,
      [usuarioId]
    );
  };

// ==================================================
// 8. LIMPIAR COPIAS ACADÉMICAS DE UN USUARIO
//
// No toca las operaciones offline de HU-06.
// Esta funcion se conectara al flujo de
// cierre de sesion del estudiante.
// ==================================================

export const eliminarCacheAcademicaLocal =
  async (usuarioId) => {
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
            DELETE FROM materias_locales
            WHERE usuario_id = ?
          `,
          [usuarioId]
        );

        await database.runAsync(
          `
            DELETE FROM actividades_locales
            WHERE usuario_id = ?
          `,
          [usuarioId]
        );

        await database.runAsync(
          `
            DELETE FROM calificaciones_locales
            WHERE usuario_id = ?
          `,
          [usuarioId]
        );
      }
    );

    return {
      success: true,
    };
  };
