'use strict';

const {
  registrarAuditoria,
} = require('../services/auditService');

/**
 * RNF-02.8
 * Audita solicitudes de registro rechazadas o fallidas.
 *
 * El registro exitoso ya se audita desde userController.
 * Nunca almacena el cuerpo de la solicitud,
 * contraseñas, documentos ni tokens.
 */
const auditarRegistroFallido = (req, res, next) => {
  res.once('finish', () => {
    const codigoHttp = res.statusCode;

    if (codigoHttp < 400) {
      return;
    }

    const esFalloServidor = codigoHttp >= 500;

    const evento = esFalloServidor
      ? 'REGISTRO_USUARIO_FALLIDO'
      : 'REGISTRO_USUARIO_RECHAZADO';

    const datosAuditoria = {
      usuarioId: req.usuario?.id || null,
      rol: req.usuario?.rol || null,
      evento,
      descripcion: esFalloServidor
        ? 'Falló una solicitud de registro de usuario.'
        : 'Se rechazó una solicitud de registro de usuario.',
      metadata: {
        resultado: esFalloServidor
          ? 'fallido'
          : 'rechazado',
        codigoHttp,
        fechaHora: new Date().toISOString(),
      },
    };

    Promise.resolve()
      .then(() => registrarAuditoria(datosAuditoria))
      .then((registrado) => {
        if (registrado !== true) {
          console.error(
            '[RNF-02.8] No se pudo persistir la auditoría del registro.'
          );
        }
      })
      .catch(() => {
        console.error(
          '[RNF-02.8] Error guardando auditoría del registro.'
        );
      });
  });

  next();
};

module.exports = {
  auditarRegistroFallido,
};
