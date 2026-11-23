'use strict';

const { supabaseAdmin } = require('../config/supabase');

const TAMANO_LOTE = 100;

async function registrarNotificaciones({
  destinatarios,
  tipo,
  titulo,
  mensaje,
  recursoTipo,
  recursoId,
  eventoClave,
  estado = 'pendiente',
}) {
  const usuarios = [...new Set(
    (destinatarios || []).filter(
      (id) => typeof id === 'string' && id.trim()
    )
  )];

  if (
    !tipo ||
    !titulo ||
    !mensaje ||
    !eventoClave ||
    usuarios.length === 0
  ) {
    return { destinatarios: usuarios.length, registradas: 0 };
  }

  let registradas = 0;
  const fecha = new Date().toISOString();

  for (let inicio = 0; inicio < usuarios.length; inicio += TAMANO_LOTE) {
    const registros = usuarios
      .slice(inicio, inicio + TAMANO_LOTE)
      .map((usuarioId) => ({
        usuario_id: usuarioId,
        tipo,
        titulo: String(titulo).slice(0, 160),
        mensaje: String(mensaje).slice(0, 2000),
        comunicado_id:
          recursoTipo === 'comunicado' ? recursoId : null,
        recurso_tipo: recursoTipo || null,
        recurso_id: recursoId || null,
        evento_clave: `${eventoClave}:${usuarioId}`,
        estado,
        fecha_creacion: fecha,
        updated_at: fecha,
      }));

    const { error } = await supabaseAdmin
      .from('notificaciones')
      .upsert(registros, {
        onConflict: 'usuario_id,evento_clave',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      throw error;
    }

    registradas += registros.length;
  }

  return {
    destinatarios: usuarios.length,
    registradas,
  };
}

module.exports = { registrarNotificaciones };
