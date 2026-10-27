'use strict';

// ======================================================
// AULA-AI | HU-11
// PRUEBA DEL MOTOR DE RECOMENDACIONES CON GEMINI
//
// Utiliza exclusivamente datos académicos ficticios.
// No consulta ni modifica Supabase.
// ======================================================

require('dotenv').config();

const {
  generarRecomendacionesAcademicas,
} = require('../src/services/academicGeminiService');

async function ejecutarPrueba() {
  console.log('\n======================================');
  console.log(' AULA-AI | PRUEBA HU-11 CON GEMINI');
  console.log('======================================');

  const contextoIA = {
    calificaciones: {
      cantidadCalificaciones: 5,
      promedioCalificacionesDisponibles: 3.2,
    },

    actividades: {
      totalPendientes: 4,
      totalVencidas: 2,
      totalEnPlazo: 2,
    },

    asistencia: {
      hayRegistros: true,
      totalAusencias: 3,
      totalLlegadasTarde: 2,
    },

    riesgos: {
      totalPendientesAtencion: 2,
      pendientesPorNivel: {
        alta: 1,
        media: 1,
        baja: 0,
      },
    },
  };

  console.log('\nModelo:', process.env.GEMINI_MODEL);
  console.log(
    'Gemini habilitado:',
    process.env.GEMINI_ENABLED
  );

  console.log('\nGenerando recomendaciones...');

  const inicio = Date.now();

  try {
    const resultado =
      await generarRecomendacionesAcademicas(contextoIA);

    const duracion = Date.now() - inicio;

    console.log('\n======================================');
    console.log(' RESULTADO');
    console.log('======================================');

    console.log('Duración:', duracion, 'ms');
    console.log('Origen:', resultado.origen);
    console.log('Modelo:', resultado.modeloIA || 'No aplica');

    console.log(
      'Motivo de respaldo:',
      resultado.motivoRespaldo || 'Ninguno'
    );

    console.log(
      'Cantidad de recomendaciones:',
      resultado.recomendaciones?.length || 0
    );

    console.log('\nRecomendaciones:');

    console.log(
      JSON.stringify(
        resultado.recomendaciones,
        null,
        2
      )
    );

    if (resultado.origen === 'ia') {
      console.log(
        '\n✅ ÉXITO: GEMINI GENERÓ RECOMENDACIONES REALES.'
      );
    } else {
      console.log(
        '\n⚠️ Se utilizó el sistema de respaldo.'
      );

      console.log(
        'Esto puede ocurrir si Gemini supera el tiempo límite.'
      );
    }
  } catch (error) {
    console.error(
      '\n❌ Error durante la prueba:',
      error.message
    );

    process.exitCode = 1;
  }
}

ejecutarPrueba();
