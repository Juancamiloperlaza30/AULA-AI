const { supabaseAdmin } =
  require('../config/supabase');

const {
  enviarNotificacionPush,
} =
  require('../services/pushService');

const registrarTokenPush =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      const {
        tokenFcm,
        plataforma = 'android',
      } = req.body;

      if (!tokenFcm) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'El token FCM es obligatorio.',
          });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          'dispositivos_push'
        )
        .upsert(
          {
            usuario_id:
              usuarioId,

            token_fcm:
              tokenFcm,

            plataforma,

            activo: true,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              'token_fcm',
          }
        )
        .select()
        .single();

      if (error) {
        console.error(
          'Error registrando token FCM:',
          error.message
        );

        return res
          .status(500)
          .json({
            success: false,
            message:
              'No fue posible registrar el dispositivo.',
          });
      }

      return res.json({
        success: true,
        message:
          'Dispositivo registrado correctamente.',
        dispositivo: data,
      });
    } catch (error) {
      console.error(
        'Error registrarTokenPush:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error interno del servidor.',
        });
    }
  };

const enviarNotificacionPrueba =
  async (req, res) => {
    try {
        const usuarioId =
          req.usuario.id;

        const {
          data: dispositivos,
          error,
        } = await supabaseAdmin
          .from('dispositivos_push')
          .select('token_fcm')
          .eq('usuario_id', usuarioId)
          .eq('activo', true);

        if (error) {
          console.error(
            'Error consultando dispositivos push:',
            error.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible consultar los dispositivos.',
          });
        }

        if (
          !dispositivos ||
          dispositivos.length === 0
        ) {
          return res.status(404).json({
            success: false,
            message:
              'El usuario no tiene dispositivos registrados.',
          });
        }

        for (
          const dispositivo of dispositivos
        ) {
          await enviarNotificacionPush({
            tokenFcm:
              dispositivo.token_fcm,

            titulo:
              'AULA-AI',

            mensaje:
              'Notificación de prueba enviada correctamente.',

            data: {
              tipo:
                'prueba_fcm',
            },
          });
        }

        return res.json({
          success: true,
          message:
            'Notificación de prueba enviada.',
        });
    } catch (error) {
        console.error(
          'ERROR FCM COMPLETO:',
          error
        );

        console.error(
          'FCM CODE:',
          error?.code
        );

        console.error(
          'FCM MESSAGE:',
          error?.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible enviar la notificación de prueba.',
        });
    }
  };

module.exports = {
  registrarTokenPush,
  enviarNotificacionPrueba,
};
