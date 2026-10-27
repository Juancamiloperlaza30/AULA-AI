'use strict';

// ======================================================
// AULA-AI | HU-10
// PRUEBA DE PROTECCIÓN DEL SEGUIMIENTO ACADÉMICO
// ======================================================

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const { supabaseAdmin } = require('../src/config/supabase');

const {
  evaluarRendimientoMateria,
} = require('../src/services/academicAlertService');

const ALERTA_ID = 3;

const ESTUDIANTE_ID =
  '85fb51da-83cb-4eed-b818-95aa7426d2f6';

const ORIENTADOR_ID =
  '45018aa1-4519-41a1-95e2-3536592134d6';

async function consultarAlerta() {
  const { data, error } = await supabaseAdmin
    .from('alertas_academicas')
    .select(`
      id,
      estudiante_id,
      estado,
      nivel,
      seguimiento_iniciado_at,
      seguimiento_iniciado_por,
      resuelta_at
    `)
    .eq('id', ALERTA_ID)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function ejecutarPrueba() {
  try {
    console.log('====================================');
    console.log('AULA-AI | HU-10');
    console.log('PRUEBA DE PROTECCIÓN DE SEGUIMIENTO');
    console.log('====================================');

    // 1. Consultar el estado inicial.
    const antes = await consultarAlerta();

    console.log('Estado inicial:', antes.estado);
    console.log('Nivel inicial:', antes.nivel);

    if (
      antes.estudiante_id !== ESTUDIANTE_ID ||
      antes.estado !== 'en_seguimiento' ||
      antes.seguimiento_iniciado_por !== ORIENTADOR_ID ||
      !antes.seguimiento_iniciado_at
    ) {
      throw new Error(
        'La alerta no tiene el seguimiento esperado. ' +
        'Se cancela la prueba para evitar cambios incorrectos.'
      );
    }

    const fechaInicio = antes.seguimiento_iniciado_at;

    // 2. Ejecutar nuevamente la evaluación académica.
    // No modifica calificaciones ni actividades.
    // Sí puede actualizar la alerta académica.
    const resultado = await evaluarRendimientoMateria({
      estudianteId: ESTUDIANTE_ID,
      materiaId: 1,
      materiaNombre: 'Matematicas',
      periodoId: 1,
      promedio: 2.0,
      cantidadNotas: 1,
    });

    console.log('Acción del motor:', resultado.accion);

    // 3. Consultar nuevamente la alerta.
    const despues = await consultarAlerta();

    console.log('Estado posterior:', despues.estado);
    console.log('Nivel posterior:', despues.nivel);
    console.log(
      'Orientador responsable:',
      despues.seguimiento_iniciado_por
    );

    // 4. Verificar que el seguimiento se conservó.
    const pruebaExitosa =
      despues.id === ALERTA_ID &&
      despues.estado === 'en_seguimiento' &&
      despues.nivel === 'alta' &&
      despues.seguimiento_iniciado_por === ORIENTADOR_ID &&
      despues.seguimiento_iniciado_at === fechaInicio &&
      despues.resuelta_at === null;

    if (!pruebaExitosa) {
      console.error(
        'PRUEBA NO SUPERADA: el seguimiento fue alterado.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('====================================');
    console.log('PRUEBA EXITOSA');
    console.log('El motor respetó el seguimiento.');
    console.log('====================================');
  } catch (error) {
    console.error(
      'PRUEBA NO SUPERADA:',
      error.message
    );

    process.exitCode = 1;
  }
}

ejecutarPrueba();
