import * as SQLite from 'expo-sqlite';

// ==================================================
// AULA-AI | HU-07
// CACHÉ ACADÉMICA OFFLINE DEL ESTUDIANTE
//
// - Almacena únicamente información consultada.
// - Cada registro pertenece a un usuario.
// - No modifica los datos oficiales de Supabase.
// - No utiliza la cola offline de HU-06.
// ==================================================

const NOMBRE_BASE =
  'aulaai_estudiante_academico.db';

let promesaBase = null;
let promesaInicializacion = null;

// ==================================================
// 1. VALIDACIONES
// ==================================================

const validarUsuarioId = (usuarioId) => {
  if (
    typeof usuarioId !== 'string' ||
    !usuarioId.trim()
  ) {
    throw new Error(
      'Se requiere un estudiante válido.'
    );
  }

  return usuarioId.trim();
};

const validarHistorial = (historial) => {
  if (!Array.isArray(historial)) {
    throw new Error(
      'El historial de asistencia no es válido.'
    );
  }

  const identificadores = new Set();

  return historial.map((registro) => {
    if (
      !registro ||
      typeof registro !== 'object'
    ) {
      throw new Error(
        'Se encontró un registro inválido.'
      );
    }

    const asistenciaId = Number(
      registro.asistenciaId
    );

    if (
      !Number.isSafeInteger(asistenciaId) ||
      asistenciaId <= 0
    ) {
      throw new Error(
        'La asistencia no tiene un ID válido.'
      );
    }

    if (identificadores.has(asistenciaId)) {
      throw new Error(
        'El historial contiene asistencias duplicadas.'
      );
    }

    identificadores.add(asistenciaId);

    if (
      !['presente', 'ausente', 'tarde'].includes(
        registro.estado
      )
    ) {
      throw new Error(
        'Existe un estado de asistencia inválido.'
      );
    }

    if (
      typeof registro.fecha !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        registro.fecha
      )
    ) {
      throw new Error(
        'Existe una fecha de asistencia inválida.'
      );
    }

    return {
      asistenciaId,
      sesionId: registro.sesionId ?? null,
      asignacionId:
        registro.asignacionId ?? null,
      periodoId: registro.periodoId ?? null,
      materia: registro.materia ?? null,
      fecha: registro.fecha,
      numeroSesion:
        registro.numeroSesion ?? null,
      estado: registro.estado,
      observacion:
        registro.observacion ?? null,
    };
  });
};

const calcularResumen = (historial) => {
  const resumen = {
    totalRegistros: historial.length,
    presentes: 0,
    ausentes: 0,
    llegadasTarde: 0,
  };

  for (const registro of historial) {
    switch (registro.estado) {
      case 'presente':
        resumen.presentes += 1;
        break;

      case 'ausente':
        resumen.ausentes += 1;
        break;

      case 'tarde':
        resumen.llegadasTarde += 1;
        break;

      default:
        break;
    }
  }

  return resumen;
};

// ==================================================
// 2. ABRIR BASE DE DATOS
// ==================================================

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

// ==================================================
// 3. INICIALIZACIÓN
// ==================================================

export const iniciarBaseAcademicaEstudiante =
  async () => {
    if (!promesaInicializacion) {
      promesaInicializacion = (async () => {
        const db = await abrirBase();

        await db.execAsync(`
          PRAGMA journal_mode = WAL;

          CREATE TABLE IF NOT EXISTS
            estudiante_asistencias_cache (
              usuario_id TEXT PRIMARY KEY
                NOT NULL,

              historial_json TEXT NOT NULL,
              resumen_json TEXT NOT NULL,

              actualizado_en TEXT NOT NULL
            );

          CREATE INDEX IF NOT EXISTS
            idx_estudiante_asistencias_actualizacion
          ON estudiante_asistencias_cache (
            actualizado_en
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

// ==================================================
// 4. GUARDAR HISTORIAL
//
// Se reemplaza la copia del mismo estudiante
// únicamente después de una respuesta exitosa
// y validada del backend.
//
// SQLite realiza el cambio atómicamente.
// ==================================================

export const guardarHistorialEstudianteOffline =
  async ({
    usuarioId,
    asistencias,
  }) => {
    const usuario = validarUsuarioId(
      usuarioId
    );

    const historial = validarHistorial(
      asistencias
    );

    const resumen = calcularResumen(
      historial
    );

    const actualizadoEn =
      new Date().toISOString();

    const db =
      await iniciarBaseAcademicaEstudiante();

    await db.runAsync(
      `
        INSERT INTO estudiante_asistencias_cache (
          usuario_id,
          historial_json,
          resumen_json,
          actualizado_en
        )
        VALUES (?, ?, ?, ?)

        ON CONFLICT(usuario_id)
        DO UPDATE SET
          historial_json =
            excluded.historial_json,

          resumen_json =
            excluded.resumen_json,

          actualizado_en =
            excluded.actualizado_en
      `,
      [
        usuario,
        JSON.stringify(historial),
        JSON.stringify(resumen),
        actualizadoEn,
      ]
    );

    return {
      success: true,
      cantidad: historial.length,
      actualizadoEn,
    };
  };

// ==================================================
// 5. RECUPERAR HISTORIAL OFFLINE
//
// La consulta exige el ID del usuario.
// Nunca devuelve la caché de otra cuenta.
// ==================================================

export const obtenerHistorialEstudianteOffline =
  async (usuarioId) => {
    const usuario = validarUsuarioId(
      usuarioId
    );

    const db =
      await iniciarBaseAcademicaEstudiante();

    const registro = await db.getFirstAsync(
      `
        SELECT
          historial_json,
          resumen_json,
          actualizado_en
        FROM estudiante_asistencias_cache
        WHERE usuario_id = ?
        LIMIT 1
      `,
      [usuario]
    );

    if (!registro) {
      return null;
    }

    let historial;
    let resumen;

    try {
      historial = JSON.parse(
        registro.historial_json
      );

      resumen = JSON.parse(
        registro.resumen_json
      );

      if (
        !Array.isArray(historial) ||
        !resumen ||
        typeof resumen !== 'object'
      ) {
        throw new Error(
          'La información guardada es inválida.'
        );
      }

      historial = validarHistorial(historial);
      resumen = calcularResumen(historial);
    } catch {
      throw new Error(
        'No fue posible leer la copia local de asistencias.'
      );
    }

    return {
      asistencias: historial,
      resumen,
      actualizadoEn:
        registro.actualizado_en,
      origen: 'sqlite',
    };
  };

// ==================================================
// 6. COMPROBAR SI EXISTE UNA COPIA
// ==================================================

export const existeHistorialEstudianteOffline =
  async (usuarioId) => {
    const usuario = validarUsuarioId(
      usuarioId
    );

    const db =
      await iniciarBaseAcademicaEstudiante();

    const resultado = await db.getFirstAsync(
      `
        SELECT 1 AS existe
        FROM estudiante_asistencias_cache
        WHERE usuario_id = ?
        LIMIT 1
      `,
      [usuario]
    );

    return Boolean(resultado);
  };

// ==================================================
// 7. ELIMINAR DATOS DEL ESTUDIANTE
//
// Se utilizará durante el cierre de sesión
// si la política seleccionada es borrar
// las copias académicas locales.
// ==================================================

export const eliminarHistorialEstudianteOffline =
  async (usuarioId) => {
    const usuario = validarUsuarioId(
      usuarioId
    );

    const db =
      await iniciarBaseAcademicaEstudiante();

    const resultado = await db.runAsync(
      `
        DELETE FROM estudiante_asistencias_cache
        WHERE usuario_id = ?
      `,
      [usuario]
    );

    return {
      success: true,
      eliminados: resultado.changes ?? 0,
    };
  };

// ==================================================
// 8. INFORMACIÓN DE LA CACHÉ
// ==================================================

export const obtenerEstadoCacheEstudiante =
  async (usuarioId) => {
    const usuario = validarUsuarioId(
      usuarioId
    );

    const db =
      await iniciarBaseAcademicaEstudiante();

    const registro = await db.getFirstAsync(
      `
        SELECT
          actualizado_en
        FROM estudiante_asistencias_cache
        WHERE usuario_id = ?
        LIMIT 1
      `,
      [usuario]
    );

    return {
      disponible: Boolean(registro),
      actualizadoEn:
        registro?.actualizado_en ?? null,
    };
  };
