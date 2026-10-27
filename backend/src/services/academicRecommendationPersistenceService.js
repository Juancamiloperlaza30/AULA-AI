'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const ORIGENES_PERMITIDOS = new Set([
  'ia',
  'plantilla',
]);

const normalizarParaComparacion = (valor) => {
  if (Array.isArray(valor)) {
    return valor.map(normalizarParaComparacion);
  }

  if (
    valor !== null &&
    typeof valor === 'object'
  ) {
    const resultado = {};

    for (const clave of Object.keys(valor).sort()) {
      resultado[clave] = normalizarParaComparacion(
        valor[clave]
      );
    }

    return resultado;
  }

  return valor;
};

const sonIguales = (primero, segundo) => {
  return JSON.stringify(
    normalizarParaComparacion(primero)
  ) === JSON.stringify(
    normalizarParaComparacion(segundo)
  );
};

const guardarRecomendacionAcademica = async ({
  estudianteId,
  alertaId = null,
  contextoIA,
  resultado,
}) => {
  if (
    typeof estudianteId !== 'string' ||
    !estudianteId.trim()
  ) {
    throw new Error(
      'El identificador del estudiante es obligatorio.'
    );
  }

  if (
    !contextoIA ||
    typeof contextoIA !== 'object' ||
    Array.isArray(contextoIA)
  ) {
    throw new Error(
      'Los indicadores académicos son inválidos.'
    );
  }

  if (
    !resultado ||
    typeof resultado !== 'object' ||
    !ORIGENES_PERMITIDOS.has(resultado.origen) ||
    !Array.isArray(resultado.recomendaciones) ||
    resultado.recomendaciones.length === 0
  ) {
    throw new Error(
      'El resultado de recomendaciones es inválido.'
    );
  }

  const origen = resultado.origen;

  const modeloIA =
    origen === 'ia'
      ? resultado.modeloIA || null
      : null;

  const version =
    Number.isInteger(resultado.version) &&
    resultado.version > 0
      ? resultado.version
      : 1;

  const contenido = {
    aviso: resultado.aviso || null,
    notaOrigen: resultado.notaOrigen || null,
    recomendaciones: resultado.recomendaciones,
    motivoRespaldo:
      resultado.motivoRespaldo || null,
  };

  // Buscar recomendaciones anteriores del estudiante.
  const { data: anteriores, error: errorConsulta } =
    await supabaseAdmin
      .from('recomendaciones')
      .select(
        'id, estudiante_id, alerta_id, origen, version, indicadores, contenido, modelo_ia, estado, created_at'
      )
      .eq('estudiante_id', estudianteId)
      .eq('origen', origen)
      .eq('version', version)
      .order('created_at', {
        ascending: false,
      })
      .limit(100);

  if (errorConsulta) {
    console.error(
      '[HU-11] Error al consultar recomendaciones:',
      errorConsulta.message
    );

    throw new Error(
      'No fue posible verificar las recomendaciones anteriores.'
    );
  }

  // Comprobar si ya existe una recomendación equivalente.
  const existente = (anteriores || []).find(
    (anterior) => {
      const mismaAlerta =
        anterior.alerta_id === alertaId;

      const mismoModelo =
        (anterior.modelo_ia || null) === modeloIA;

      return (
        mismaAlerta &&
        mismoModelo &&
        sonIguales(
          anterior.indicadores,
          contextoIA
        ) &&
        sonIguales(
          anterior.contenido,
          contenido
        )
      );
    }
  );

  if (existente) {
    return {
      ...existente,
      registroExistente: true,
    };
  }

  const registro = {
    estudiante_id: estudianteId,
    alerta_id: alertaId,
    origen,
    version,
    indicadores: contextoIA,
    contenido,
    modelo_ia: modeloIA,
    estado: 'generada',
  };

  const { data, error } = await supabaseAdmin
    .from('recomendaciones')
    .insert(registro)
    .select()
    .single();

  if (error) {
    console.error(
      '[HU-11] Error al guardar recomendación:',
      error.message
    );

    throw new Error(
      'No fue posible guardar la recomendación académica.'
    );
  }

  return {
    ...data,
    registroExistente: false,
  };
};

module.exports = {
  guardarRecomendacionAcademica,
};
