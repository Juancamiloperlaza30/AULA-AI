'use strict';

const medirTiempoRespuestaAsistencia =
  (operacion) => (req, res, next) => {
    const inicio = Date.now();

    res.once('finish', () => {
      const duracionMs = Date.now() - inicio;
      const registrar = duracionMs > 3000
        ? console.warn
        : console.info;

      registrar(
        '[RNF-06.6] Tiempo de respuesta de asistencia:',
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
  medirTiempoRespuestaAsistencia,
};
