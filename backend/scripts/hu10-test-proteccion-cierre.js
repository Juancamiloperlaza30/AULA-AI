'use strict';

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const {
  supabaseAdmin,
} = require('../src/config/supabase');

const {
  evaluarRendimientoMateria,
} = require('../src/services/academicAlertService');

const ESTUDIANTE_ID =
  '85fb51da-83cb-4eed-b818-95aa7426d2f6';

const ALERTA_REAL_ID = 3;
const ALERTA_PRUEBA_ID = 4;

async function consultarAlerta(id) {
  const { data, error } = await supabaseAdmin
    .from('alertas_academicas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function ejecutar() {
  try {
    console.log('====================================');
    console.log('HU-10 | PROTECCIÓN DEL CIERRE MANUAL');
    console.log('====================================');

    const pruebaAntes =
      await consultarAlerta(ALERTA_PRUEBA_ID);

    const realAntes =
      await consultarAlerta(ALERTA_REAL_ID);

    if (
      pruebaAntes.estado !== 'resuelta' ||
      !pruebaAntes.cierre_manual_at ||
      pruebaAntes.detalles?.es_prueba !== true
    ) {
      throw new Error(
        'La alerta #4 no cumple las condiciones de prueba.'
      );
    }

    if (realAntes.estado !== 'en_seguimiento') {
      throw new Error(
        'La alerta real #3 no está en seguimiento.'
      );
    }

    console.log('Alerta #4:', pruebaAntes.estado);
    console.log('Alerta #3:', realAntes.estado);

    // La alerta técnica #4 tiene una clave especial:
    // hu10:prueba-cierre:20261025
    //
    // evaluarRendimientoMateria genera claves con el
    // formato rendimiento:materiaId:periodoId.
    //
    // Por seguridad NO ejecutamos esa evaluación:
    // podría modificar la alerta académica real #3.

    console.log('====================================');
    console.log('VALIDACIONES DE SEGURIDAD CORRECTAS');
    console.log('Alerta #4 identificada como prueba.');
    console.log('Alerta #3 identificada como real.');
    console.log('No se modificaron datos académicos.');
    console.log('====================================');

    console.log(
      'Pendiente: prueba aislada de actualizarAlerta.'
    );
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  }
}

ejecutar();
