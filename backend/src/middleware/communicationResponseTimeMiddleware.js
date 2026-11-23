'use strict';

const { performance } = require('node:perf_hooks');

const medirConsultaComunicaciones = (operacion) =>
  (req, res, next) => {
    const inicio = performance.now();

    res.once('finish', () => {
      const duracionMs = Math.round(
        performance.now() - inicio
      );
      const superaObjetivo = duracionMs > 1500;
      const registrar = superaObjetivo
        ? console.warn
        : console.info;

      registrar('[RNF-12.3] Tiempo de consulta:', {
        operacion,
        duracionMs,
        superaObjetivo,
        codigoHttp: res.statusCode,
      });
    });

    next();
  };

module.exports = { medirConsultaComunicaciones };
