'use strict';

const cron = require('node-cron');
const { supabaseAdmin } = require('../config/supabase');
const {
  procesarEnvioInstitucional,
} = require('../services/notificacionProcesamientoService');

const TAMANO_LOTE = 50;
let ejecutando = false;
let tarea = null;

async function procesarPendientesNotificacion() {
  if (ejecutando) {
    return { omitido: true, motivo: 'procesamiento_en_curso' };
  }

  ejecutando = true;
  try {
    const { data: envios, error } = await supabaseAdmin
      .from('notificaciones_envios')
      .select('id')
      .eq('estado', 'pendiente')
      .lte('proximo_intento_at', new Date().toISOString())
      .order('proximo_intento_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(TAMANO_LOTE);

    if (error) {
      throw error;
    }

    const resultados = [];
    for (const envio of envios || []) {
      try {
        resultados.push(
          await procesarEnvioInstitucional({
            envioId: envio.id,
            simulacion: false,
          })
        );
      } catch (errorEnvio) {
        console.error(
          '[HU-12 PUSH] Falló el procesamiento de un envío.',
          {
            envioId: envio.id,
            mensaje: errorEnvio?.message || 'Error desconocido',
          }
        );
        resultados.push({
          envioId: envio.id,
          procesado: false,
          error: true,
        });
      }
    }

    return {
      encontrados: (envios || []).length,
      resultados,
    };
  } finally {
    ejecutando = false;
  }
}

function iniciarColaNotificaciones() {
  if (tarea) {
    return tarea;
  }

  tarea = cron.schedule('* * * * *', () => {
    void procesarPendientesNotificacion().catch((error) => {
      console.error(
        '[HU-12 PUSH] No fue posible consultar la cola de notificaciones.',
        error?.message || error
      );
    });
  });

  return tarea;
}

module.exports = {
  procesarPendientesNotificacion,
  iniciarColaNotificaciones,
};
