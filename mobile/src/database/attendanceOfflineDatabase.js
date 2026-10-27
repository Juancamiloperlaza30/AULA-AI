import * as SQLite from 'expo-sqlite';

// ==================================================
// AULA-AI | HU-06
// CACHÉ DE ASISTENCIAS Y COLA DE SINCRONIZACIÓN
// ==================================================

let databasePromise = null;

const ESTADOS_ASISTENCIA = [
  'presente',
  'ausente',
  'tarde',
];

const ESTADOS_COLA = [
  'pendiente',
  'sincronizando',
  'sincronizado',
  'error',
];

const validarUsuario = (usuarioId) => {
  if (
    typeof usuarioId !== 'string' ||
    !usuarioId.trim()
  ) {
    throw new Error(
      'Identificador de usuario inválido.'
    );
  }

  return usuarioId.trim();
};

const enteroPositivo = (valor) => {
  const numero = Number(valor);

  return Number.isSafeInteger(numero) &&
    numero > 0;
};

const fechaValida = (fecha) => {
  if (
    typeof fecha !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
  ) {
    return false;
  }

  const fechaObjeto = new Date(
    `${fecha}T12:00:00Z`
  );

  return (
    !Number.isNaN(fechaObjeto.getTime()) &&
    fechaObjeto.toISOString().slice(0, 10) ===
      fecha
  );
};

const validarRegistros = (registros) => {
  if (
    !Array.isArray(registros) ||
    registros.length < 1 ||
    registros.length > 100
  ) {
    throw new Error(
      'Debe registrar entre 1 y 100 estudiantes.'
    );
  }

  const identificadores = new Set();

  return registros.map((registro) => {
    const estudianteId =
      registro?.estudianteId;

    if (
      typeof estudianteId !== 'string' ||
      !estudianteId.trim()
    ) {
      throw new Error(
        'Estudiante sin identificador válido.'
      );
    }

    if (
      !ESTADOS_ASISTENCIA.includes(
        registro.estado
      )
    ) {
      throw new Error(
        'Estado de asistencia inválido.'
      );
    }

    const id = estudianteId.trim();
    const clave = id.toLowerCase();

    if (identificadores.has(clave)) {
      throw new Error(
        'Hay estudiantes repetidos.'
      );
    }

    identificadores.add(clave);

    const observacion =
      registro.observacion == null
        ? null
        : String(registro.observacion).trim();

    if (
      observacion &&
      observacion.length > 1000
    ) {
      throw new Error(
        'Una observación supera 1000 caracteres.'
      );
    }

    return {
      estudianteId: id,
      estado: registro.estado,
      observacion: observacion || null,
    };
  });
};

const abrirBase = async () => {
  if (!databasePromise) {
    databasePromise =
      SQLite.openDatabaseAsync(
        'aulaai_asistencias.db'
      ).catch((error) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
};

// ==================================================
// 1. INICIALIZACIÓN
// ==================================================

export const iniciarAsistenciaOffline = async () => {
  const db = await abrirBase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS asistencias_cache (
      usuario_id TEXT NOT NULL,
      asignacion_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      sesion_id INTEGER NOT NULL,
      datos TEXT NOT NULL,
      sincronizado_en TEXT NOT NULL,

      PRIMARY KEY (
        usuario_id,
        asignacion_id,
        fecha,
        sesion_id
      )
    );

    CREATE INDEX IF NOT EXISTS
      idx_asistencias_cache_usuario
    ON asistencias_cache (
      usuario_id,
      asignacion_id,
      fecha
    );

    CREATE TABLE IF NOT EXISTS asistencias_pendientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      usuario_id TEXT NOT NULL,
      asignacion_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,

      numero_sesion INTEGER NOT NULL DEFAULT 1,
      registros TEXT NOT NULL,

      estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (
          estado IN (
            'pendiente',
            'sincronizando',
            'sincronizado',
            'error'
          )
        ),

      intentos INTEGER NOT NULL DEFAULT 0,
      ultimo_error TEXT,
      sesion_remota_id INTEGER,

      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL,
      sincronizado_en TEXT,

      UNIQUE (
        usuario_id,
        asignacion_id,
        fecha,
        numero_sesion
      )
    );

    CREATE INDEX IF NOT EXISTS
      idx_asistencias_pendientes_usuario_estado
    ON asistencias_pendientes (
      usuario_id,
      estado,
      creado_en
    );

    -- Nueva tabla: estudiantes y asignación
    -- disponibles para consulta sin internet.

    CREATE TABLE IF NOT EXISTS
      asistencias_grupos_cache (
        usuario_id TEXT NOT NULL,
        asignacion_id INTEGER NOT NULL,

        asignacion_datos TEXT NOT NULL,
        estudiantes_datos TEXT NOT NULL,

        actualizado_en TEXT NOT NULL,

        PRIMARY KEY (
          usuario_id,
          asignacion_id
        )
      );

    CREATE INDEX IF NOT EXISTS
      idx_asistencias_grupos_usuario
    ON asistencias_grupos_cache (
      usuario_id
    );
  `);

  return db;
};

// ==================================================
// 2. GUARDAR GRUPO Y ESTUDIANTES
// ==================================================

export const guardarGrupoAsistenciaOffline =
  async ({
    usuarioId,
    asignacion,
    estudiantes,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (
      !enteroPositivo(asignacion?.id) ||
      !Array.isArray(estudiantes) ||
      estudiantes.some(
        (item) =>
          !item ||
          typeof item.id !== 'string' ||
          !item.id.trim()
      )
    ) {
      throw new Error(
        'Datos de asignación o estudiantes inválidos.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const ahora = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO asistencias_grupos_cache (
        usuario_id,
        asignacion_id,
        asignacion_datos,
        estudiantes_datos,
        actualizado_en
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (
        usuario_id,
        asignacion_id
      )
      DO UPDATE SET
        asignacion_datos = excluded.asignacion_datos,
        estudiantes_datos = excluded.estudiantes_datos,
        actualizado_en = excluded.actualizado_en`,
      [
        usuario,
        Number(asignacion.id),
        JSON.stringify(asignacion),
        JSON.stringify(estudiantes),
        ahora,
      ]
    );

    return true;
  };

// ==================================================
// 3. RECUPERAR GRUPO SIN CONEXIÓN
// ==================================================

export const obtenerGrupoAsistenciaOffline =
  async ({
    usuarioId,
    asignacionId,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (!enteroPositivo(asignacionId)) {
      throw new Error(
        'Asignación inválida.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const fila = await db.getFirstAsync(
      `SELECT
        asignacion_datos,
        estudiantes_datos,
        actualizado_en
      FROM asistencias_grupos_cache
      WHERE usuario_id = ?
        AND asignacion_id = ?`,
      [
        usuario,
        Number(asignacionId),
      ]
    );

    if (!fila) {
      return null;
    }

    let asignacion;
    let estudiantes;

    try {
      asignacion = JSON.parse(
        fila.asignacion_datos
      );

      estudiantes = JSON.parse(
        fila.estudiantes_datos
      );
    } catch {
      throw new Error(
        'No fue posible leer el grupo guardado.'
      );
    }

    if (
      !enteroPositivo(asignacion?.id) ||
      !Array.isArray(estudiantes)
    ) {
      throw new Error(
        'Los datos del grupo local están incompletos.'
      );
    }

    return {
      asignacion,
      estudiantes,
      actualizadoEn: fila.actualizado_en,
      origen: 'sqlite',
    };
  };

// ==================================================
// 4. GUARDAR ASISTENCIA CONSULTADA EN LÍNEA
// ==================================================

export const guardarAsistenciaOffline =
  async ({
    usuarioId,
    asignacionId,
    fecha,
    sesion,
    asistencias,
    estudiantes,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (
      !enteroPositivo(asignacionId) ||
      !enteroPositivo(sesion?.id) ||
      !fechaValida(fecha) ||
      !Array.isArray(asistencias) ||
      !Array.isArray(estudiantes)
    ) {
      throw new Error(
        'Datos insuficientes para guardar asistencia local.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const datos = JSON.stringify({
      sesion,
      asistencias,
      estudiantes,
    });

    await db.runAsync(
      `INSERT INTO asistencias_cache (
        usuario_id,
        asignacion_id,
        fecha,
        sesion_id,
        datos,
        sincronizado_en
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (
        usuario_id,
        asignacion_id,
        fecha,
        sesion_id
      )
      DO UPDATE SET
        datos = excluded.datos,
        sincronizado_en = excluded.sincronizado_en`,
      [
        usuario,
        Number(asignacionId),
        fecha,
        Number(sesion.id),
        datos,
        new Date().toISOString(),
      ]
    );

    return true;
  };

// ==================================================
// 5. CONSULTAR ASISTENCIAS GUARDADAS
// ==================================================

export const obtenerAsistenciasOffline =
  async ({
    usuarioId,
    asignacionId,
    fecha,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (
      !enteroPositivo(asignacionId) ||
      !fechaValida(fecha)
    ) {
      throw new Error(
        'Datos de consulta offline inválidos.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const filas = await db.getAllAsync(
      `SELECT
        sesion_id,
        datos,
        sincronizado_en
      FROM asistencias_cache
      WHERE usuario_id = ?
        AND asignacion_id = ?
        AND fecha = ?
      ORDER BY sesion_id`,
      [
        usuario,
        Number(asignacionId),
        fecha,
      ]
    );

    return filas.map((fila) => {
      let datos;

      try {
        datos = JSON.parse(fila.datos);
      } catch (error) {
        throw new Error(
          `Error al leer sesión ${fila.sesion_id}: ${error.message}`
        );
      }

      if (
        !datos?.sesion ||
        !Array.isArray(datos.asistencias) ||
        !Array.isArray(datos.estudiantes)
      ) {
        throw new Error(
          `El caché de sesión ${fila.sesion_id} está incompleto.`
        );
      }

      return {
        ...datos,
        sesionId: fila.sesion_id,
        sincronizadoEn: fila.sincronizado_en,
        origen: 'sqlite',
      };
    });
  };

// ==================================================
// 6. CONSULTAR ASIGNACIONES LOCALES
// ==================================================

export const obtenerAsignacionesAsistenciaOffline =
  async (usuarioId) => {
    const usuario = validarUsuario(usuarioId);

    const db = await iniciarAsistenciaOffline();

    const filas = await db.getAllAsync(
      `SELECT
        asignacion_id,
        asignacion_datos
      FROM asistencias_grupos_cache
      WHERE usuario_id = ?
      ORDER BY asignacion_id`,
      [usuario]
    );

    const asignaciones = new Map();

    for (const fila of filas) {
      let asignacion;

      try {
        asignacion = JSON.parse(
          fila.asignacion_datos
        );
      } catch {
        continue;
      }

      if (enteroPositivo(asignacion?.id)) {
        asignaciones.set(
          Number(asignacion.id),
          {
            ...asignacion,
            origen: 'sqlite',
          }
        );
      }
    }

    // Compatibilidad con cachés anteriores,
    // aunque todavía no tengan grupo guardado.

    const antiguos = await db.getAllAsync(
      `SELECT asignacion_id
      FROM asistencias_cache
      WHERE usuario_id = ?

      UNION

      SELECT asignacion_id
      FROM asistencias_pendientes
      WHERE usuario_id = ?`,
      [usuario, usuario]
    );

    for (const fila of antiguos) {
      const id = Number(
        fila.asignacion_id
      );

      if (!asignaciones.has(id)) {
        asignaciones.set(id, {
          id,
          materia: {
            nombre: `Asignación ${id}`,
          },
          grado: null,
          grupo: null,
          periodo: null,
          origen: 'sqlite',
        });
      }
    }

    return [...asignaciones.values()]
      .sort((a, b) => a.id - b.id);
  };

// ==================================================
// 7. REGISTRAR ASISTENCIA PENDIENTE
// ==================================================

export const encolarAsistenciaOffline =
  async ({
    usuarioId,
    asignacionId,
    fecha,
    numeroSesion = 1,
    registros,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (
      !enteroPositivo(asignacionId) ||
      !enteroPositivo(numeroSesion) ||
      !fechaValida(fecha)
    ) {
      throw new Error(
        'Asignación, fecha o sesión inválida.'
      );
    }

    const registrosValidados =
      validarRegistros(registros);

    const db = await iniciarAsistenciaOffline();

    const ahora = new Date().toISOString();

    const resultado = await db.runAsync(
      `INSERT OR IGNORE
      INTO asistencias_pendientes (
        usuario_id,
        asignacion_id,
        fecha,
        numero_sesion,
        registros,
        estado,
        intentos,
        creado_en,
        actualizado_en
      )
      VALUES (
        ?, ?, ?, ?, ?,
        'pendiente', 0, ?, ?
      )`,
      [
        usuario,
        Number(asignacionId),
        fecha,
        Number(numeroSesion),
        JSON.stringify(registrosValidados),
        ahora,
        ahora,
      ]
    );

    if (resultado.changes !== 1) {
      throw new Error(
        'Ya existe una operación local para esta materia, fecha y sesión.'
      );
    }

    return {
      id: resultado.lastInsertRowId,
      estado: 'pendiente',
      mensaje:
        'Asistencia guardada en SQLite. Pendiente de sincronización.',
    };
  };

// ==================================================
// 8. CONSULTAR COLA DE SINCRONIZACIÓN
// ==================================================

export const obtenerColaAsistencia =
  async ({
    usuarioId,
    estados = ['pendiente', 'error'],
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (
      !Array.isArray(estados) ||
      !estados.length ||
      estados.some(
        (estado) =>
          !ESTADOS_COLA.includes(estado)
      )
    ) {
      throw new Error(
        'Estados de cola inválidos.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const marcadores = estados
      .map(() => '?')
      .join(', ');

    const filas = await db.getAllAsync(
      `SELECT *
      FROM asistencias_pendientes
      WHERE usuario_id = ?
        AND estado IN (${marcadores})
      ORDER BY creado_en, id`,
      [usuario, ...estados]
    );

    return filas.map((fila) => {
      let registros;

      try {
        registros = JSON.parse(
          fila.registros
        );

        validarRegistros(registros);
      } catch (error) {
        throw new Error(
          `Registro pendiente ${fila.id} inválido: ${error.message}`
        );
      }

      return {
        id: fila.id,
        usuarioId: fila.usuario_id,
        asignacionId: fila.asignacion_id,
        fecha: fila.fecha,
        numeroSesion: fila.numero_sesion,
        registros,
        estado: fila.estado,
        intentos: fila.intentos,
        ultimoError: fila.ultimo_error,
        sesionRemotaId:
          fila.sesion_remota_id,
        creadoEn: fila.creado_en,
        actualizadoEn: fila.actualizado_en,
        sincronizadoEn: fila.sincronizado_en,
      };
    });
  };

// ==================================================
// 9. MARCAR OPERACIÓN COMO SINCRONIZANDO
// ==================================================

export const marcarAsistenciaSincronizando =
  async ({
    usuarioId,
    pendienteId,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (!enteroPositivo(pendienteId)) {
      throw new Error(
        'Operación pendiente inválida.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const resultado = await db.runAsync(
      `UPDATE asistencias_pendientes
      SET estado = 'sincronizando',
          intentos = intentos + 1,
          ultimo_error = NULL,
          actualizado_en = ?
      WHERE id = ?
        AND usuario_id = ?
        AND estado IN ('pendiente', 'error')`,
      [
        new Date().toISOString(),
        Number(pendienteId),
        usuario,
      ]
    );

    return resultado.changes === 1;
  };

// ==================================================
// 10. REGISTRAR ERROR DE SINCRONIZACIÓN
// ==================================================

export const marcarErrorAsistenciaOffline =
  async ({
    usuarioId,
    pendienteId,
    mensaje,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (!enteroPositivo(pendienteId)) {
      throw new Error(
        'Operación pendiente inválida.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const resultado = await db.runAsync(
      `UPDATE asistencias_pendientes
      SET estado = 'error',
          ultimo_error = ?,
          actualizado_en = ?
      WHERE id = ?
        AND usuario_id = ?
        AND estado = 'sincronizando'`,
      [
        String(
          mensaje ||
          'Error de sincronización.'
        ).slice(0, 1000),
        new Date().toISOString(),
        Number(pendienteId),
        usuario,
      ]
    );

    return resultado.changes === 1;
  };

// ==================================================
// 11. CONFIRMAR SINCRONIZACIÓN
// ==================================================

export const marcarAsistenciaSincronizada =
  async ({
    usuarioId,
    pendienteId,
    sesionRemotaId,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (
      !enteroPositivo(pendienteId) ||
      !enteroPositivo(sesionRemotaId)
    ) {
      throw new Error(
        'Confirmación remota inválida.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const ahora = new Date().toISOString();

    const resultado = await db.runAsync(
      `UPDATE asistencias_pendientes
      SET estado = 'sincronizado',
          sesion_remota_id = ?,
          ultimo_error = NULL,
          sincronizado_en = ?,
          actualizado_en = ?
      WHERE id = ?
        AND usuario_id = ?
        AND estado = 'sincronizando'`,
      [
        Number(sesionRemotaId),
        ahora,
        ahora,
        Number(pendienteId),
        usuario,
      ]
    );

    return resultado.changes === 1;
  };

// ==================================================
// 12. RECUPERAR OPERACIÓN INTERRUMPIDA
// ==================================================

// Conservamos el estado para reintentar usando
// el mismo UUID persistido por el servicio.
// El reintento requiere que el backend aplique
// idempotencia sobre ese identificador.

export const recuperarAsistenciaInterrumpida =
  async ({
    usuarioId,
    pendienteId,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (!enteroPositivo(pendienteId)) {
      throw new Error(
        'Operación pendiente inválida.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    const resultado = await db.runAsync(
      `UPDATE asistencias_pendientes
      SET estado = 'error',
          ultimo_error =
            'Envío interrumpido. Conservar el identificador original para conciliar.',
          actualizado_en = ?
      WHERE id = ?
        AND usuario_id = ?
        AND estado = 'sincronizando'`,
      [
        new Date().toISOString(),
        Number(pendienteId),
        usuario,
      ]
    );

    return resultado.changes === 1;
  };

// ==================================================
// 13. CONTAR OPERACIONES SIN CONFIRMAR
// ==================================================

export const contarAsistenciasPendientes =
  async (usuarioId) => {
    const usuario = validarUsuario(usuarioId);

    const db = await iniciarAsistenciaOffline();

    const fila = await db.getFirstAsync(
      `SELECT COUNT(*) AS total
      FROM asistencias_pendientes
      WHERE usuario_id = ?
        AND estado <> 'sincronizado'`,
      [usuario]
    );

    return Number(fila?.total || 0);
  };

// ==================================================
// 14. LIMPIAR CACHÉ DEL USUARIO
// ==================================================

// No eliminamos asistencias pendientes.
// Deben conservarse hasta su conciliación.

export const limpiarAsistenciasOffline =
  async (usuarioId) => {
    const usuario = validarUsuario(usuarioId);

    const db = await iniciarAsistenciaOffline();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM asistencias_cache
        WHERE usuario_id = ?`,
        [usuario]
      );

      await db.runAsync(
        `DELETE FROM asistencias_grupos_cache
        WHERE usuario_id = ?`,
        [usuario]
      );
    });

    return true;
  };

// ==================================================
// 15. ELIMINAR CACHÉ DE UNA SESIÓN
// ==================================================

export const eliminarSesionOffline =
  async ({
    usuarioId,
    sesionId,
  }) => {
    const usuario = validarUsuario(usuarioId);

    if (!enteroPositivo(sesionId)) {
      throw new Error(
        'Sesión inválida.'
      );
    }

    const db = await iniciarAsistenciaOffline();

    await db.runAsync(
      `DELETE FROM asistencias_cache
      WHERE usuario_id = ?
        AND sesion_id = ?`,
      [
        usuario,
        Number(sesionId),
      ]
    );

    return true;
  };
