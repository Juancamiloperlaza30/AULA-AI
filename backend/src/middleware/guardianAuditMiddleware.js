'use strict';

const {
  registrarAuditoria,
} = require('../services/auditService');

const auditarConsultaAcudiente = (
  req,
  res,
  next
) => {
  if (req.method !== 'GET') {
    return next();
  }

  res.once('finish', () => {
    Promise.resolve()
      .then(() =>
        registrarAuditoria({
          usuarioId: req.usuario?.id || null,
          correo: req.usuario?.correo || null,
          rol: req.usuario?.rol || null,
          evento:
            'CONSULTA_ACADEMICA_ACUDIENTE',
          descripcion:
            'Consulta de información académica por un acudiente.',
          direccionIp: req.ip || null,
          dispositivo:
            req.headers?.['user-agent'] || null,
          metadata: {
            estudianteId:
              req.params?.estudianteId || null,
            metodo: req.method,
            ruta:
              req.route?.path ||
              req.path ||
              null,
            estadoHttp: res.statusCode,
            fechaHora: new Date().toISOString(),
          },
        })
      )
      .then((registrado) => {
        if (registrado !== true) {
          console.error(
            '[HU-08] No se pudo persistir la auditoría de consulta del acudiente.'
          );
        }
      })
      .catch((error) => {
        console.error(
          '[HU-08] Error inesperado registrando la consulta del acudiente:',
          error?.message || error
        );
      });
  });

  return next();
};

const auditarEnvioExcusa = (
  req,
  res,
  next
) => {
  res.once('finish', () => {
    Promise.resolve()
      .then(() =>
        registrarAuditoria({
          usuarioId: req.usuario?.id || null,
          correo: req.usuario?.correo || null,
          rol: req.usuario?.rol || null,
          evento: 'ENVIO_EXCUSA_ACADEMICA',
          descripcion:
            'Registro del resultado de un envío de excusa académica.',
          direccionIp: req.ip || null,
          dispositivo:
            req.headers?.['user-agent'] || null,
          metadata: {
            estudianteId:
              req.params?.estudianteId || null,
            asistenciaId:
              req.body?.asistenciaId || null,
            excusaId:
              res.locals?.excusaId || null,
            metodo: req.method,
            ruta:
              req.route?.path ||
              req.path ||
              null,
            estadoHttp: res.statusCode,
            fechaHora: new Date().toISOString(),
          },
        })
      )
      .then((registrado) => {
        if (registrado !== true) {
          console.error(
            '[HU-09] No se pudo persistir la auditoría del envío de la excusa.'
          );
        }
      })
      .catch((error) => {
        console.error(
          '[HU-09] Error inesperado registrando el envío de la excusa:',
          error?.message || error
        );
      });
  });

  return next();
};

module.exports = {
  auditarConsultaAcudiente,
  auditarEnvioExcusa,
};
