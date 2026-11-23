'use strict';

const medirTiempoRespuestaAlertas =
  (operacion) => (req, res, next) => {
    const inicio = Date.now();

    res.once('finish', () => {
      const duracionMs = Date.now() - inicio;
      const registrar = duracionMs > 1500
        ? console.warn
        : console.info;

      registrar(
        '[RNF-10.4] Tiempo de respuesta de alertas académicas:',
        {
          operacion,
          duracionMs,
          superaObjetivo: duracionMs > 1500,
          metodo: req.method,
          ruta: req.route?.path || req.path,
          codigoHttp: res.statusCode,
        }
      );
    });

    next();
  };

module.exports = {
  medirTiempoRespuestaAlertas,
};
