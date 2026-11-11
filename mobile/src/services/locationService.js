import * as Location from 'expo-location';

const TIEMPO_MAXIMO_MS = 8000;

export const MENSAJES_UBICACION = {
  PERMISO_DENEGADO:
    'No se concedió permiso para acceder a la ubicación. Esta función no estará disponible, pero puedes seguir utilizando AULA-AI.',

  GPS_DESACTIVADO:
    'La ubicación del dispositivo está desactivada. Actívala para continuar.',

  TIEMPO_AGOTADO:
    'No fue posible obtener la ubicación dentro de los 8 segundos permitidos. Inténtalo nuevamente.',

  ERROR_GENERAL:
    'No fue posible obtener la ubicación del dispositivo. Inténtalo nuevamente.',

  ERROR_PERMISOS:
    'No fue posible verificar los permisos de ubicación.',

  CANCELADO:
    'La solicitud de ubicación fue cancelada.',
};

const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

const verificarCancelacion = (signal) => {
  if (signal?.aborted) {
    throw crearError(
      'CANCELADO',
      MENSAJES_UBICACION.CANCELADO
    );
  }
};

/**
 * Consulta los permisos actuales sin solicitar autorización.
 */
export const consultarPermisoUbicacion = async () => {
  try {
    const permiso =
      await Location.getForegroundPermissionsAsync();

    return {
      concedido: permiso.granted === true,
      estado: permiso.status,
      puedeSolicitarNuevamente:
        permiso.canAskAgain === true,
    };
  } catch (error) {
    console.error(
      'Error consultando permisos de ubicación:',
      error
    );

    return {
      concedido: false,
      estado: 'error',
      puedeSolicitarNuevamente: false,
    };
  }
};

/**
 * Obtiene una única ubicación bajo demanda.
 *
 * - No activa seguimiento en segundo plano.
 * - No guarda coordenadas en la base de datos.
 * - Cancela la espera al recibir AbortSignal.
 * - Elimina la suscripción al terminar.
 * - Limita a 8 segundos la espera de coordenadas.
 */
export const obtenerUbicacionActual = async ({
  signal,
  solicitarPermiso = true,
} = {}) => {
  verificarCancelacion(signal);

  let permiso;

  try {
    permiso =
      await Location.getForegroundPermissionsAsync();

    verificarCancelacion(signal);

    if (!permiso.granted && solicitarPermiso) {
      permiso =
        await Location.requestForegroundPermissionsAsync();
    }
  } catch (error) {
    if (error?.codigo === 'CANCELADO') {
      throw error;
    }

    console.error(
      'Error verificando permisos de ubicación:',
      error
    );

    throw crearError(
      'ERROR_PERMISOS',
      MENSAJES_UBICACION.ERROR_PERMISOS
    );
  }

  verificarCancelacion(signal);

  if (!permiso.granted) {
    throw crearError(
      'PERMISO_DENEGADO',
      MENSAJES_UBICACION.PERMISO_DENEGADO
    );
  }

  let gpsHabilitado;

  try {
    gpsHabilitado =
      await Location.hasServicesEnabledAsync();
  } catch (error) {
    console.error(
      'Error verificando GPS:',
      error
    );

    throw crearError(
      'ERROR_GPS',
      MENSAJES_UBICACION.ERROR_GENERAL
    );
  }

  verificarCancelacion(signal);

  if (!gpsHabilitado) {
    throw crearError(
      'GPS_DESACTIVADO',
      MENSAJES_UBICACION.GPS_DESACTIVADO
    );
  }

  return new Promise((resolve, reject) => {
    let suscripcion = null;
    let temporizador = null;
    let finalizado = false;

    const liberarSuscripcion = () => {
      if (!suscripcion) {
        return;
      }

      const actual = suscripcion;
      suscripcion = null;

      try {
        actual.remove();
      } catch (error) {
        console.warn(
          'No fue posible liberar la suscripción GPS:',
          error
        );
      }
    };

    const limpiar = () => {
      if (temporizador !== null) {
        clearTimeout(temporizador);
        temporizador = null;
      }

      signal?.removeEventListener?.(
        'abort',
        cancelar
      );

      liberarSuscripcion();
    };

    const finalizar = (error = null, resultado = null) => {
      if (finalizado) {
        return;
      }

      finalizado = true;
      limpiar();

      if (error) {
        reject(error);
      } else {
        resolve(resultado);
      }
    };

    function cancelar() {
      finalizar(
        crearError(
          'CANCELADO',
          MENSAJES_UBICACION.CANCELADO
        )
      );
    }

    if (signal?.aborted) {
      cancelar();
      return;
    }

    signal?.addEventListener?.(
      'abort',
      cancelar,
      { once: true }
    );

    temporizador = setTimeout(() => {
      finalizar(
        crearError(
          'TIEMPO_AGOTADO',
          MENSAJES_UBICACION.TIEMPO_AGOTADO
        )
      );
    }, TIEMPO_MAXIMO_MS);

    const iniciarGPS = async () => {
      try {
        const nuevaSuscripcion =
          await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 1000,
              distanceInterval: 0,
            },
            (posicion) => {
              if (finalizado) {
                return;
              }

              const latitud =
                posicion?.coords?.latitude;

              const longitud =
                posicion?.coords?.longitude;

              if (
                !Number.isFinite(latitud) ||
                !Number.isFinite(longitud)
              ) {
                finalizar(
                  crearError(
                    'UBICACION_INVALIDA',
                    MENSAJES_UBICACION.ERROR_GENERAL
                  )
                );

                return;
              }

              finalizar(null, {
                latitud,
                longitud,
                precision:
                  posicion.coords.accuracy ?? null,
                fecha:
                  posicion.timestamp ?? Date.now(),
              });
            }
          );

        /*
         * Si el tiempo expiró o el usuario canceló
         * antes de que Android terminara de crear
         * la suscripción, la liberamos igualmente.
         */
        if (finalizado) {
          try {
            nuevaSuscripcion.remove();
          } catch (error) {
            console.warn(
              'Error liberando suscripción tardía:',
              error
            );
          }

          return;
        }

        suscripcion = nuevaSuscripcion;
      } catch (error) {
        if (finalizado) {
          return;
        }

        console.error(
          'Error obteniendo ubicación:',
          error
        );

        finalizar(
          crearError(
            'ERROR_UBICACION',
            MENSAJES_UBICACION.ERROR_GENERAL
          )
        );
      }
    };

    void iniciarGPS();
  });
};