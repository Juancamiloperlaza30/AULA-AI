'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const responderError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const esFechaValida = (valor) => {
  if (
    typeof valor !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00.000Z`);

  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === valor
  );
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const obtenerUsuarioObjetivoId = (metadata) => {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata)
  ) {
    return null;
  }

  const identificadores = [
    metadata.usuarioObjetivoId,
    metadata.usuario_objetivo_id,
    metadata.usuarioAfectadoId,
  ];

  return (
    identificadores.find(
      (identificador) =>
        typeof identificador === 'string' &&
        UUID_REGEX.test(identificador)
    ) || null
  );
};

const listarEventosAuditoria = async (req, res) => {
  try {
    const {
      pagina: paginaRaw = '1',
      limite: limiteRaw = '20',
      busqueda: busquedaRaw = '',
      evento: eventoRaw = '',
      fechaInicio: fechaInicioRaw = '',
      fechaFin: fechaFinRaw = '',
    } = req.query;

    if (
      typeof paginaRaw !== 'string' ||
      !/^[1-9]\d*$/.test(paginaRaw) ||
      typeof limiteRaw !== 'string' ||
      !/^[1-9]\d*$/.test(limiteRaw)
    ) {
      return responderError(
        res,
        400,
        'Los parámetros de paginación no son válidos.'
      );
    }

    const pagina = Number(paginaRaw);
    const limite = Number(limiteRaw);
    const desde = (pagina - 1) * limite;

    if (
      !Number.isSafeInteger(pagina) ||
      !Number.isSafeInteger(limite) ||
      limite > 100 ||
      !Number.isSafeInteger(desde) ||
      desde > 100000
    ) {
      return responderError(
        res,
        400,
        'Los parámetros de paginación no son válidos.'
      );
    }

    if (
      typeof busquedaRaw !== 'string' ||
      typeof eventoRaw !== 'string' ||
      typeof fechaInicioRaw !== 'string' ||
      typeof fechaFinRaw !== 'string'
    ) {
      return responderError(
        res,
        400,
        'Uno o más filtros no son válidos.'
      );
    }

    const busqueda = busquedaRaw.trim();
    const evento = eventoRaw.trim();
    const fechaInicio = fechaInicioRaw.trim();
    const fechaFin = fechaFinRaw.trim();

    if (busqueda.length > 100 || evento.length > 100) {
      return responderError(
        res,
        400,
        'Los filtros superan la longitud permitida.'
      );
    }

    if (
      (fechaInicio && !esFechaValida(fechaInicio)) ||
      (fechaFin && !esFechaValida(fechaFin))
    ) {
      return responderError(
        res,
        400,
        'Las fechas deben tener el formato AAAA-MM-DD y ser válidas.'
      );
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      return responderError(
        res,
        400,
        'La fecha inicial no puede superar la fecha final.'
      );
    }

    let consulta = supabaseAdmin
      .from('auditoria')
      .select(
        `
          id,
          usuario_id,
          correo,
          evento,
          descripcion,
          rol,
          direccion_ip,
          dispositivo,
          metadata,
          created_at
        `,
        { count: 'exact' }
      );

    if (busqueda) {
      const textoSeguro = busqueda
        .replace(/[%_,().\\"]/g, ' ')
        .trim();

      if (!textoSeguro) {
        return responderError(
          res,
          400,
          'Ingrese un término de búsqueda válido.'
        );
      }

      consulta = consulta.or(
        [
          `correo.ilike.%${textoSeguro}%`,
          `evento.ilike.%${textoSeguro}%`,
          `descripcion.ilike.%${textoSeguro}%`,
        ].join(',')
      );
    }

    if (evento) {
      consulta = consulta.eq('evento', evento);
    }

    if (fechaInicio) {
      consulta = consulta.gte(
        'created_at',
        `${fechaInicio}T00:00:00.000Z`
      );
    }

    if (fechaFin) {
      const fechaExclusiva = new Date(
        `${fechaFin}T00:00:00.000Z`
      );

      fechaExclusiva.setUTCDate(
        fechaExclusiva.getUTCDate() + 1
      );

      consulta = consulta.lt(
        'created_at',
        fechaExclusiva.toISOString()
      );
    }

    const hasta = desde + limite - 1;
    const {
      data,
      error,
      count,
    } = await consulta
      .order('created_at', {
        ascending: false,
      })
      .order('id', {
        ascending: false,
      })
      .range(desde, hasta);

    if (error) {
      console.error(
        'Error consultando auditoría:',
        error.message
      );

      return responderError(
        res,
        500,
        'No fue posible consultar los eventos administrativos.'
      );
    }

    const eventos = data || [];
    const identificadores = [
      ...new Set(
        eventos
          .map((registro) =>
            obtenerUsuarioObjetivoId(registro.metadata)
          )
          .filter(Boolean)
      ),
    ];
    const usuariosPorId = new Map();

    if (identificadores.length > 0) {
      const {
        data: usuarios,
        error: usuariosError,
      } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombres, apellidos, correo, rol')
        .in('id', identificadores);

      if (usuariosError) {
        console.error(
          'Error consultando usuarios afectados:',
          usuariosError.message
        );
      } else {
        for (const usuario of usuarios || []) {
          usuariosPorId.set(usuario.id, usuario);
        }
      }
    }

    const eventosEnriquecidos = eventos.map((registro) => {
      const usuarioObjetivoId = obtenerUsuarioObjetivoId(
        registro.metadata
      );
      const usuario = usuarioObjetivoId
        ? usuariosPorId.get(usuarioObjetivoId)
        : null;

      let usuarioAfectado = null;

      if (usuario) {
        const nombreCompleto = [
          usuario.nombres,
          usuario.apellidos,
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

        usuarioAfectado = {
          id: usuario.id,
          nombreCompleto: nombreCompleto || 'Usuario sin nombre',
          correo: usuario.correo,
          rol: usuario.rol,
        };
      }

      return {
        ...registro,
        usuarioAfectado,
      };
    });

    const total = count || 0;

    return res.status(200).json({
      success: true,
      eventos: eventosEnriquecidos,
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando auditoría:',
      error
    );

    return responderError(
      res,
      500,
      'Ocurrió un error al consultar el monitoreo.'
    );
  }
};

module.exports = {
  listarEventosAuditoria,
};
