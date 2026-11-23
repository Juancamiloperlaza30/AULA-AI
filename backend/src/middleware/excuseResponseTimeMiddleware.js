'use strict';

const { performance } = require('node:perf_hooks');

const medirTiempoRespuestaExcusa =
  (req, res, next) => {
    const inicio = performance.now();

    res.once('finish', () => {
      const duracionTotalMs = Math.round(
        performance.now() - inicio
      );
      const transferenciaSoporteMs =
        req.rnf09TransferenciaSoporteMs || 0;
      const duracionMs = Math.max(
        0,
        Math.round(
          duracionTotalMs - transferenciaSoporteMs
        )
      );
      const superaObjetivo = duracionMs > 3000;
      const registrar = superaObjetivo
        ? console.warn
        : console.info;

      registrar(
        '[RNF-09.6] Tiempo de procesamiento de excusa:',
        {
          duracionMs,
          transferenciaSoporteMs: Math.round(
            transferenciaSoporteMs
          ),
          superaObjetivo,
          codigoHttp: res.statusCode,
          estudianteId:
            req.params?.estudianteId || null,
        }
      );
    });

    next();
  };

module.exports = {
  medirTiempoRespuestaExcusa,
};
