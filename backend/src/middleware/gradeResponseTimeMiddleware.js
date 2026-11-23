'use strict';

const medirTiempoRespuestaCalificaciones =
  (operacion) => (req, res, next) => {
    const inicio = Date.now();

    res.once('finish', () => {
      const duracionMs = Date.now() - inicio;
      const registrar = duracionMs > 3000
        ? console.warn
        : console.info;

      registrar(
        '[RNF-05.5] Tiempo de respuesta de calificaciones:',
        {
          operacion,
          duracionMs,
          superaObjetivo: duracionMs > 3000,
          metodo: req.method,
          ruta: req.route?.path || req.path,
          codigoHttp: res.statusCode,
        }
      );
    });

    next();
  };

module.exports = {
  medirTiempoRespuestaCalificaciones,
};
