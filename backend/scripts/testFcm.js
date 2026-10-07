require('dotenv').config();

const {
  supabaseAdmin,
} = require('../src/config/supabase');

const {
  enviarNotificacionPush,
} = require('../src/services/pushService');

const ejecutar = async () => {
  try {
    console.log(
      '1. Buscando dispositivo Android activo...'
    );

    const {
      data: dispositivos,
      error,
    } = await supabaseAdmin
      .from('dispositivos_push')
      .select('token_fcm')
      .eq('activo', true)
      .eq('plataforma', 'android')
      .limit(1);

    if (error) {
      console.error(
        'ERROR SUPABASE:',
        error.message
      );

      process.exit(1);
    }

    if (
      !dispositivos ||
      dispositivos.length === 0
    ) {
      console.error(
        'No hay dispositivos Android activos.'
      );

      process.exit(1);
    }

    console.log(
      '2. Dispositivo encontrado.'
    );

    const tokenFcm =
      dispositivos[0]?.token_fcm;

    console.log(
      'TOKEN TYPE:',
      typeof tokenFcm
    );

    console.log(
      'TOKEN LENGTH:',
      tokenFcm?.length
    );

    console.log(
      'TOKEN EXISTE:',
      Boolean(tokenFcm)
    );

    console.log(
      '3. Enviando notificación con Firebase...'
    );

    const respuesta =
      await enviarNotificacionPush({
        tokenFcm,

        titulo:
          'AULA-AI',

        mensaje:
          'Prueba directa de Firebase FCM.',

        data: {
          tipo:
            'prueba_directa',
        },
      });

    console.log(
      'FCM FUNCIONÓ CORRECTAMENTE.'
    );

    console.log(
      'Respuesta:',
      respuesta
    );

    process.exit(0);

  } catch (error) {
    console.error(
      '===== ERROR REAL DE FIREBASE ====='
    );

    console.error(
      'CODE:',
      error?.code
    );

    console.error(
      'MESSAGE:',
      error?.message
    );

    console.error(
      'STACK COMPLETO:'
    );

    console.error(
      error?.stack
    );

    process.exit(1);
  }
};

ejecutar();
