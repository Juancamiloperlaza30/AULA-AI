'use strict';

const { performance } = require('node:perf_hooks');

const medirTiempoRespuestaActividad =
  (operacion) => (req, res, next) => {
    const inicio = performance.now();

    res.once('finish', () => {
      console.info(
        '[RNF-04.4] Tiempo de respuesta (ms):',
        {
          operacion,
          estado: res.statusCode,
          total: Math.round(
            performance.now() - inicio
          ),
        }
      );
    });

    next();
  };

module.exports = {
  medirTiempoRespuestaActividad,
};
