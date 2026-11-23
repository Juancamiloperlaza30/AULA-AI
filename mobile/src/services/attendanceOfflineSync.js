import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import {
  iniciarAsistenciaOffline,
  obtenerColaAsistencia,
  obtenerGrupoAsistenciaOffline,
  guardarAsistenciaOffline,
  marcarAsistenciaSincronizando,
  marcarAsistenciaSincronizada,
  marcarErrorAsistenciaOffline,
  recuperarAsistenciaInterrumpida,
} from '../database/attendanceOfflineDatabase';

// ==========================================
// HU-06 - SERVICIO DE SINCRONIZACIÓN OFFLINE
// ==========================================

let promesaBase = null;
let sincronizacionActiva = false;

const abrirBase = async () => {
  if (!promesaBase) {
    promesaBase = SQLite.openDatabaseAsync(
      'aulaai_asistencias.db'
    ).catch((error) => {
      promesaBase = null;
      throw error;
    });
  }

  return promesaBase;
};

// ==========================================
// IDENTIFICADORES PERMANENTES DE OPERACIÓN
// ==========================================

const prepararIdentificadores = async () => {
  await iniciarAsistenciaOffline();

  const db = await abrirBase();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS
      asistencias_offline_identificadores (
        pendiente_id INTEGER PRIMARY KEY,
        usuario_id TEXT NOT NULL,
        operacion_id TEXT NOT NULL UNIQUE,
        creado_en TEXT NOT NULL,

        FOREIGN KEY (pendiente_id)
          REFERENCES asistencias_pendientes(id)
      );
  `);

  return db;
};

const obtenerOperacionId = async (
  usuarioId,
  pendienteId
) => {
  const db = await prepararIdentificadores();

  const existente = await db.getFirstAsync(
    `SELECT operacion_id
     FROM asistencias_offline_identificadores
     WHERE pendiente_id = ?
       AND usuario_id = ?`,
    [pendienteId, usuarioId]
  );

  if (existente?.operacion_id) {
    return existente.operacion_id;
  }

  const nuevoId = Crypto.randomUUID();

  await db.runAsync(
    `INSERT OR IGNORE INTO
      asistencias_offline_identificadores (
        pendiente_id,
        usuario_id,
        operacion_id,
        creado_en
      )
     VALUES (?, ?, ?, ?)`,
    [
      pendienteId,
      usuarioId,
      nuevoId,
      new Date().toISOString(),
    ]
  );

  const guardado = await db.getFirstAsync(
    `SELECT operacion_id
     FROM asistencias_offline_identificadores
     WHERE pendiente_id = ?
       AND usuario_id = ?`,
    [pendienteId, usuarioId]
  );

  if (!guardado?.operacion_id) {
    throw new Error(
      'No fue posible conservar el identificador de sincronización.'
    );
  }

  return guardado.operacion_id;
};

// ==========================================
// CONSULTAR EL SERVIDOR CON TIEMPO LÍMITE
// ==========================================

const enviarOperacion = async ({
  apiUrl,
  accessToken,
  operacion,
  operacionId,
}) => {
  const controlador = new AbortController();

  const temporizador = setTimeout(() => {
    controlador.abort();
  }, 15000);

  try {
    const respuesta = await fetch(
      `${String(apiUrl).replace(/\/+$/, '')}/api/attendance/sincronizar-offline`,
      {
        method: 'POST',
        signal: controlador.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operacionId,
          asignacionId: operacion.asignacionId,
          fecha: operacion.fecha,
          numeroSesion: operacion.numeroSesion,
          registros: operacion.registros,
        }),
      }
    );

    const texto = await respuesta.text();

    let datos = {};

    try {
      datos = texto ? JSON.parse(texto) : {};
    } catch {
      throw new Error(
        'El backend devolvió una respuesta inválida.'
      );
    }

    if (!respuesta.ok) {
      const error = new Error(
        datos.message ||
        `Error HTTP ${respuesta.status}`
      );

      error.status = respuesta.status;
      throw error;
    }

    if (
      datos.success !== true ||
      String(datos.operacionId).toLowerCase() !==
        operacionId.toLowerCase() ||
      !Number.isSafeInteger(Number(datos.sesionId)) ||
      Number(datos.sesionId) <= 0 ||
      Number(datos.cantidad) !== operacion.registros.length
    ) {
      throw new Error(
        'La confirmación recibida no coincide con la operación enviada.'
      );
    }

    return datos;
  } finally {
    clearTimeout(temporizador);
  }
};

const actualizarCacheSesionConfirmada = async ({
  apiUrl,
  accessToken,
  usuarioId,
  operacion,
  sesionId,
}) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => {
    controlador.abort();
  }, 15000);

  try {
    const respuesta = await fetch(
      `${String(apiUrl).replace(/\/+$/, '')}/api/attendance/sesiones/${sesionId}`,
      {
        method: 'GET',
        signal: controlador.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const texto = await respuesta.text();
    let datos = {};

    try {
      datos = texto ? JSON.parse(texto) : {};
    } catch {
      throw new Error(
        'El backend devolvió una respuesta inválida al consultar la sesión sincronizada.'
      );
    }

    if (
      !respuesta.ok ||
      datos.success !== true ||
      Number(datos.sesion?.id) !== Number(sesionId) ||
      Number(datos.sesion?.materia_grupo_periodo_id) !==
        Number(operacion.asignacionId) ||
      String(datos.sesion?.fecha) !== String(operacion.fecha) ||
      Number(datos.sesion?.numero_sesion) !==
        Number(operacion.numeroSesion) ||
      String(datos.sesion?.docente_id) !== String(usuarioId) ||
      !Array.isArray(datos.asistencias)
    ) {
      throw new Error(
        'La respuesta del servidor no contiene la sesión completa que se sincronizó.'
      );
    }

    const idsAsistencia = new Set();
    for (const asistencia of datos.asistencias) {
      const estudianteId = String(
        asistencia?.estudiante_id || ''
      ).trim();

      if (
        !estudianteId ||
        !['presente', 'ausente', 'tarde'].includes(
          asistencia.estado
        ) ||
        idsAsistencia.has(estudianteId.toLowerCase())
      ) {
        throw new Error(
          'La sesión recibida contiene asistencias incompletas o duplicadas.'
        );
      }

      idsAsistencia.add(estudianteId.toLowerCase());
    }

    const idsOperacion = operacion.registros.map(
      (registro) =>
        String(registro.estudianteId).trim().toLowerCase()
    );

    if (
      !idsOperacion.every((id) => idsAsistencia.has(id))
    ) {
      throw new Error(
        'La sesión recibida no contiene todos los registros confirmados.'
      );
    }

    const grupo = await obtenerGrupoAsistenciaOffline({
      usuarioId,
      asignacionId: operacion.asignacionId,
    });

    if (
      !grupo ||
      !Array.isArray(grupo.estudiantes) ||
      grupo.estudiantes.length === 0
    ) {
      throw new Error(
        'No se encontró el grupo local necesario para guardar la sesión sincronizada.'
      );
    }

    const idsEstudiantes = new Set(
      grupo.estudiantes.map((estudiante) =>
        String(estudiante?.id || '').trim().toLowerCase()
      )
    );

    if (
      !idsAsistencia.size ||
      [...idsAsistencia].some((id) => !idsEstudiantes.has(id))
    ) {
      throw new Error(
        'La sesión recibida no coincide con el grupo local guardado.'
      );
    }

    await guardarAsistenciaOffline({
      usuarioId,
      asignacionId: operacion.asignacionId,
      fecha: datos.sesion.fecha,
      sesion: datos.sesion,
      asistencias: datos.asistencias,
      estudiantes: grupo.estudiantes,
    });
  } finally {
    clearTimeout(temporizador);
  }
};

// ==========================================
// SINCRONIZAR PENDIENTES DE UN DOCENTE
// ==========================================

export const sincronizarAsistenciasPendientes =
  async ({
    usuarioId,
    apiUrl,
    accessToken,
  }) => {
    if (!usuarioId || !apiUrl || !accessToken) {
      throw new Error(
        'Faltan los datos de sesión necesarios para sincronizar.'
      );
    }

    // Evita iniciar dos procesos simultáneos
    // dentro de la misma instancia de la app.
    if (sincronizacionActiva) {
      return {
        ocupada: true,
        sincronizadas: 0,
        errores: 0,
      };
    }

    sincronizacionActiva = true;

    let sincronizadas = 0;
    let errores = 0;
    let requierenRevision = 0;

    try {
      await prepararIdentificadores();

      // Recuperamos operaciones interrumpidas
      // conservando su identificador permanente.
      const interrumpidas =
        await obtenerColaAsistencia({
          usuarioId,
          estados: ['sincronizando'],
        });

      for (const operacion of interrumpidas) {
        await obtenerOperacionId(
          usuarioId,
          operacion.id
        );

        await recuperarAsistenciaInterrumpida({
          usuarioId,
          pendienteId: operacion.id,
        });
      }

      const pendientes =
        await obtenerColaAsistencia({
          usuarioId,
          estados: ['pendiente', 'error'],
        });

      for (const operacion of pendientes) {
        // Los errores de autorización o
        // conflictos requieren revisión.
        // No se reenvían automáticamente.
        if (
          operacion.estado === 'error' &&
          /HTTP (400|401|403|409)/.test(
            operacion.ultimoError || ''
          )
        ) {
          requierenRevision++;
          continue;
        }

        const operacionId =
          await obtenerOperacionId(
            usuarioId,
            operacion.id
          );

        const marcada =
          await marcarAsistenciaSincronizando({
            usuarioId,
            pendienteId: operacion.id,
          });

        if (!marcada) {
          continue;
        }

        try {
          const respuesta =
            await enviarOperacion({
              apiUrl,
              accessToken,
              operacion,
              operacionId,
            });

          await actualizarCacheSesionConfirmada({
            apiUrl,
            accessToken,
            usuarioId,
            operacion,
            sesionId: respuesta.sesionId,
          });

          const confirmada =
            await marcarAsistenciaSincronizada({
              usuarioId,
              pendienteId: operacion.id,
              sesionRemotaId:
                respuesta.sesionId,
            });

          if (!confirmada) {
            throw new Error(
              'El servidor confirmó la operación, pero SQLite no pudo actualizar su estado.'
            );
          }

          sincronizadas++;
        } catch (error) {
          errores++;

          const mensaje = error.status
            ? `HTTP ${error.status}: ${error.message}`
            : error.message;

          try {
            await marcarErrorAsistenciaOffline({
              usuarioId,
              pendienteId: operacion.id,
              mensaje,
            });
          } catch (errorLocal) {
            console.error(
              'No fue posible guardar el error de sincronización:',
              errorLocal
            );
          }

          // No continuar enviando registros
          // si la autenticación fue rechazada.
          if (
            error.status === 401 ||
            error.status === 403
          ) {
            break;
          }
        }
      }

      return {
        ocupada: false,
        sincronizadas,
        errores,
        requierenRevision,
      };
    } finally {
      sincronizacionActiva = false;
    }
  };
