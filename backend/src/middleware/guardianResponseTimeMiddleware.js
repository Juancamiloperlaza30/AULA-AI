'use strict';

const { performance } = require('node:perf_hooks');

const medirTiempoRespuestaAcudiente =
  (operacion) => (req, res, next) => {
    const inicio = performance.now();

    res.once('finish', () => {
      const duracionMs = Math.round(
        performance.now() - inicio
      );
      const superaObjetivo =
        duracionMs > 3000;
      const registrar = superaObjetivo
        ? console.warn
        : console.info;

      registrar(
        '[RNF-08.5] Tiempo de respuesta del acudiente:',
        {
          operacion,
          duracionMs,
          superaObjetivo,
          metodo: req.method,
          ruta: req.route?.path || req.path,
          codigoHttp: res.statusCode,
        }
      );
    });

    next();
  };

module.exports = {
  medirTiempoRespuestaAcudiente,
};
