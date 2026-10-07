const {
  supabaseAdmin,
} = require('../config/supabase');

const obtenerMiPerfil =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      const {
        data: usuario,
        error: errorUsuario,
      } = await supabaseAdmin
        .from('usuarios')
        .select(`
          id,
          nombres,
          apellidos,
          correo,
          rol,
          activo,
          foto_perfil_path,
          perfil_actualizado_at
        `)
        .eq(
          'id',
          usuarioId
        )
        .maybeSingle();

      if (errorUsuario) {
        console.error(
          'Error consultando perfil:',
          errorUsuario.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar el perfil.',
        });
      }

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message:
            'No se encontró el perfil del usuario.',
        });
      }

      let fotoUrl = null;

      if (
        usuario.foto_perfil_path
      ) {
        const {
          data: signedData,
          error: errorSigned,
        } =
          await supabaseAdmin.storage
            .from(
              'aulaai-perfiles'
            )
            .createSignedUrl(
              usuario.foto_perfil_path,
              60 * 60
            );

        if (errorSigned) {
          console.error(
            'Error generando URL firmada de la foto de perfil:',
            errorSigned.message
          );
        } else if (signedData) {
          fotoUrl =
            signedData.signedUrl;
        }
      }

      return res.status(200).json({
        success: true,
        perfil: {
          id:
            usuario.id,

          nombres:
            usuario.nombres,

          apellidos:
            usuario.apellidos,

          correo:
            usuario.correo,

          rol:
            usuario.rol,

          activo:
            usuario.activo,

          fotoPerfilUrl:
            fotoUrl,

          perfilActualizadoAt:
            usuario.perfil_actualizado_at,
        },
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando perfil:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar el perfil.',
      });
    }
  };

const actualizarFotoPerfil =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            'Debe seleccionar una imagen.',
        });
      }

      const tiposPermitidos = [
        'image/jpeg',
        'image/png',
        'image/webp',
      ];

      if (
        !tiposPermitidos.includes(
          req.file.mimetype
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La imagen debe ser JPG, PNG o WEBP.',
        });
      }

      const extension =
        req.file.mimetype ===
        'image/png'
          ? 'png'
          : req.file.mimetype ===
              'image/webp'
            ? 'webp'
            : 'jpg';

      const rutaFoto =
        `usuarios/${usuarioId}/perfil.${extension}`;

      // 1. Subir o reemplazar la foto
      const {
        error: errorSubida,
      } =
        await supabaseAdmin.storage
          .from(
            'aulaai-perfiles'
          )
          .upload(
            rutaFoto,
            req.file.buffer,
            {
              contentType:
                req.file.mimetype,

              upsert: true,
            }
          );

      if (errorSubida) {
        console.error(
          'Error subiendo foto de perfil:',
          errorSubida.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible guardar la foto de perfil.',
        });
      }

      // 2. Guardar ruta en usuarios
      const {
        error: errorUsuario,
      } = await supabaseAdmin
        .from('usuarios')
        .update({
          foto_perfil_path:
            rutaFoto,

          perfil_actualizado_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          usuarioId
        );

      if (errorUsuario) {
        console.error(
          'Error actualizando usuario:',
          errorUsuario.message
        );

        return res.status(500).json({
          success: false,
          message:
            'La imagen fue subida, pero no fue posible actualizar el perfil.',
        });
      }

      // 3. Crear URL temporal
      const {
        data: signedData,
        error: errorSigned,
      } =
        await supabaseAdmin.storage
          .from(
            'aulaai-perfiles'
          )
          .createSignedUrl(
            rutaFoto,
            60 * 60
          );

      return res.status(200).json({
        success: true,
        message:
          'Foto de perfil actualizada correctamente.',

        fotoPerfilUrl:
          !errorSigned
            ? signedData?.signedUrl
            : null,
      });
    } catch (error) {
      console.error(
        'Error inesperado actualizando foto de perfil:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al actualizar la foto de perfil.',
      });
    }
  };

module.exports = {
  obtenerMiPerfil,
  actualizarFotoPerfil,
};
