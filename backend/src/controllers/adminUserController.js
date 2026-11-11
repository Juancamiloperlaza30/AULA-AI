'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarAuditoria,
} = require('../services/auditService');

const ROLES_VALIDOS = [
  'administrador',
  'coordinador',
  'orientador',
  'docente',
  'estudiante',
  'acudiente',
];

const CAMPOS_EDITABLES = [
  'nombres',
  'apellidos',
  'telefono',
  'tipo_documento',
  'numero_documento',
];

const CAMPOS_PUBLICOS = `
  id,
  nombres,
  apellidos,
  correo,
  rol,
  activo,
  tipo_documento,
  numero_documento,
  telefono,
  created_at,
  updated_at,
  debe_cambiar_password
`;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const esUuidValido = (valor) =>
  typeof valor === 'string' &&
  UUID_REGEX.test(valor);

const responderError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const registrarEventoAdministrativo = async (
  req,
  evento,
  descripcion,
  metadata = {}
) =>
  registrarAuditoria({
    usuarioId: req.usuario.id,
    correo: req.usuario.correo,
    evento,
    descripcion,
    rol: req.usuario.rol,
    direccionIp: req.ip,
    dispositivo: req.headers['user-agent'] || null,
    metadata,
  });

const listarUsuarios = async (req, res) => {
  try {
    const paginaRaw = req.query.pagina ?? '1';
    const limiteRaw = req.query.limite ?? '20';

    if (
      !/^[1-9]\d*$/.test(String(paginaRaw)) ||
      !/^[1-9]\d*$/.test(String(limiteRaw))
    ) {
      return responderError(
        res,
        400,
        'Los parámetros de paginación no son válidos.'
      );
    }

    const pagina = Number(paginaRaw);
    const limite = Number(limiteRaw);

    if (
      !Number.isSafeInteger(pagina) ||
      !Number.isSafeInteger(limite) ||
      limite > 100 ||
      (pagina - 1) * limite > 100000
    ) {
      return responderError(
        res,
        400,
        'Los parámetros de paginación no son válidos.'
      );
    }

    const busqueda =
      typeof req.query.busqueda === 'string'
        ? req.query.busqueda.trim()
        : '';
    const rol =
      typeof req.query.rol === 'string'
        ? req.query.rol.trim()
        : '';
    const estado =
      typeof req.query.estado === 'string'
        ? req.query.estado.trim()
        : '';

    if (req.query.busqueda !== undefined &&
        typeof req.query.busqueda !== 'string') {
      return responderError(
        res,
        400,
        'El término de búsqueda no es válido.'
      );
    }

    if (req.query.rol !== undefined &&
        typeof req.query.rol !== 'string') {
      return responderError(
        res,
        400,
        'El rol solicitado no es válido.'
      );
    }

    if (req.query.estado !== undefined &&
        typeof req.query.estado !== 'string') {
      return responderError(
        res,
        400,
        'El estado solicitado no es válido.'
      );
    }

    if (rol && !ROLES_VALIDOS.includes(rol)) {
      return responderError(
        res,
        400,
        'El rol solicitado no es válido.'
      );
    }

    if (estado && !['activo', 'inactivo'].includes(estado)) {
      return responderError(
        res,
        400,
        'El estado solicitado no es válido.'
      );
    }

    if (busqueda.length > 100) {
      return responderError(
        res,
        400,
        'La búsqueda no puede superar 100 caracteres.'
      );
    }

    const desde = (pagina - 1) * limite;
    const hasta = desde + limite - 1;

    let consulta = supabaseAdmin
      .from('usuarios')
      .select(CAMPOS_PUBLICOS, {
        count: 'exact',
      });

    if (rol) {
      consulta = consulta.eq('rol', rol);
    }

    if (estado) {
      consulta = consulta.eq('activo', estado === 'activo');
    }

    if (busqueda) {
      const termino = busqueda.replace(
        /[%_,().\\"]/g,
        ''
      ).trim();

      if (!termino) {
        return responderError(
          res,
          400,
          'Ingrese un término de búsqueda válido.'
        );
      }

      consulta = consulta.or(
        [
          `nombres.ilike.%${termino}%`,
          `apellidos.ilike.%${termino}%`,
          `correo.ilike.%${termino}%`,
          `numero_documento.ilike.%${termino}%`,
        ].join(',')
      );
    }

    const {
      data,
      count,
      error,
    } = await consulta
      .order('created_at', {
        ascending: false,
      })
      .range(desde, hasta);

    if (error) {
      console.error(
        'Error listando usuarios:',
        error.message
      );

      return responderError(
        res,
        500,
        'No fue posible consultar los usuarios.'
      );
    }

    const total = count || 0;

    return res.status(200).json({
      success: true,
      usuarios: data || [],
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
    });
  } catch (error) {
    console.error(
      'Error inesperado listando usuarios:',
      error
    );

    return responderError(
      res,
      500,
      'Ocurrió un error consultando los usuarios.'
    );
  }
};

const obtenerResumenUsuarios = async (req, res) => {
  try {
    const contar = (configurar = (consulta) => consulta) =>
      configurar(
        supabaseAdmin
          .from('usuarios')
          .select('id', {
            count: 'exact',
            head: true,
          })
      );

    const consultasPorRol = ROLES_VALIDOS.map((rol) =>
      contar((consulta) => consulta.eq('rol', rol))
    );

    const [
      totalResult,
      activosResult,
      inactivosResult,
      ...rolesResult
    ] = await Promise.all([
      contar(),
      contar((consulta) => consulta.eq('activo', true)),
      contar((consulta) => consulta.eq('activo', false)),
      ...consultasPorRol,
    ]);

    const resultados = [
      totalResult,
      activosResult,
      inactivosResult,
      ...rolesResult,
    ];
    const resultadoConError = resultados.find(
      (resultado) => resultado.error
    );

    if (resultadoConError) {
      console.error(
        'Error consultando resumen de usuarios:',
        resultadoConError.error.message
      );

      return responderError(
        res,
        500,
        'No fue posible consultar el resumen.'
      );
    }

    const porRol = Object.fromEntries(
      ROLES_VALIDOS.map((rol, indice) => [
        rol,
        rolesResult[indice].count || 0,
      ])
    );

    return res.status(200).json({
      success: true,
      resumen: {
        total: totalResult.count || 0,
        activos: activosResult.count || 0,
        inactivos: inactivosResult.count || 0,
        porRol,
      },
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando resumen de usuarios:',
      error
    );

    return responderError(
      res,
      500,
      'No fue posible consultar el resumen.'
    );
  }
};

const obtenerDetalleUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (!esUuidValido(id)) {
      return responderError(
        res,
        400,
        'El identificador del usuario no es válido.'
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('usuarios')
      .select(CAMPOS_PUBLICOS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(
        'Error consultando usuario:',
        error.message
      );

      return responderError(
        res,
        500,
        'No fue posible consultar el usuario.'
      );
    }

    if (!data) {
      return responderError(
        res,
        404,
        'El usuario no existe.'
      );
    }

    return res.status(200).json({
      success: true,
      usuario: data,
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando usuario:',
      error
    );

    return responderError(
      res,
      500,
      'No fue posible consultar el usuario.'
    );
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (!esUuidValido(id)) {
      return responderError(
        res,
        400,
        'El identificador del usuario no es válido.'
      );
    }

    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      return responderError(
        res,
        400,
        'Los datos enviados no son válidos.'
      );
    }

    const camposRecibidos = Object.keys(req.body);

    if (
      camposRecibidos.length === 0 ||
      camposRecibidos.some(
        (campo) => !CAMPOS_EDITABLES.includes(campo)
      )
    ) {
      return responderError(
        res,
        400,
        'Se enviaron campos no permitidos para edición.'
      );
    }

    const cambios = {};

    for (const campo of camposRecibidos) {
      const valor = req.body[campo];

      if (typeof valor !== 'string') {
        return responderError(
          res,
          400,
          `El campo ${campo} debe ser texto.`
        );
      }

      const normalizado = valor.trim();

      if (
        ['nombres', 'apellidos'].includes(campo) &&
        !normalizado
      ) {
        return responderError(
          res,
          400,
          `El campo ${campo} es obligatorio.`
        );
      }

      if (normalizado.length > 150) {
        return responderError(
          res,
          400,
          `El campo ${campo} supera la longitud permitida.`
        );
      }

      cambios[campo] =
        normalizado ||
        (
          ['telefono', 'tipo_documento', 'numero_documento']
            .includes(campo)
            ? null
            : normalizado
        );
    }

    const {
      data: usuarioAnterior,
      error: consultaError,
    } = await supabaseAdmin
      .from('usuarios')
      .select(CAMPOS_PUBLICOS)
      .eq('id', id)
      .maybeSingle();

    if (consultaError) {
      console.error(
        'Error validando usuario antes de actualizar:',
        consultaError.message
      );

      return responderError(
        res,
        500,
        'No fue posible validar el usuario.'
      );
    }

    if (!usuarioAnterior) {
      return responderError(
        res,
        404,
        'El usuario no existe.'
      );
    }

    if (
      cambios.numero_documento &&
      cambios.numero_documento !== usuarioAnterior.numero_documento
    ) {
      const {
        data: duplicados,
        error: duplicadoError,
      } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('numero_documento', cambios.numero_documento)
        .neq('id', id)
        .limit(1);

      if (duplicadoError) {
        console.error(
          'Error validando documento duplicado:',
          duplicadoError.message
        );

        return responderError(
          res,
          500,
          'No fue posible validar el documento.'
        );
      }

      if (duplicados?.length) {
        return responderError(
          res,
          409,
          'Ya existe un usuario con ese documento.'
        );
      }
    }

    cambios.updated_at = new Date().toISOString();

    const {
      data: usuarioActualizado,
      error: actualizacionError,
    } = await supabaseAdmin
      .from('usuarios')
      .update(cambios)
      .eq('id', id)
      .select(CAMPOS_PUBLICOS)
      .single();

    if (actualizacionError) {
      console.error(
        'Error actualizando usuario:',
        actualizacionError.message
      );

      // PostgreSQL: violación de restricción UNIQUE.
      if (actualizacionError.code === '23505') {
        if (
          actualizacionError.message?.includes(
            'usuarios_numero_documento_key'
          )
        ) {
          return responderError(
            res,
            409,
            'Ya existe un usuario registrado con ese número de documento.'
          );
        }

        return responderError(
          res,
          409,
          'Ya existe un usuario con uno de los datos proporcionados.'
        );
      }

      return responderError(
        res,
        500,
        'No fue posible actualizar el usuario.'
      );
    }

    const camposModificados = camposRecibidos.filter((campo) => {
      const valorAnterior = usuarioAnterior[campo] ?? null;
      const valorNuevo = usuarioActualizado[campo] ?? null;

      return valorAnterior !== valorNuevo;
    });

    if (camposModificados.length > 0) {
      await registrarEventoAdministrativo(
        req,
        'USUARIO_ACTUALIZADO',
        `Se actualizaron ${camposModificados.length} campo(s) de un usuario.`,
        {
          usuarioObjetivoId: id,
          camposModificados,
          cantidadCamposModificados: camposModificados.length,
          resultado: 'Actualización exitosa',
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Usuario actualizado correctamente.',
      usuario: usuarioActualizado,
    });
  } catch (error) {
    console.error(
      'Error inesperado actualizando usuario:',
      error
    );

    return responderError(
      res,
      500,
      'No fue posible actualizar el usuario.'
    );
  }
};

const cambiarEstadoUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validar identificador del usuario.
    if (!esUuidValido(id)) {
      return responderError(
        res,
        400,
        'El identificador del usuario no es válido.'
      );
    }

    // 2. Validar estado solicitado.
    if (
      !req.body ||
      typeof req.body.activo !== 'boolean'
    ) {
      return responderError(
        res,
        400,
        'Debe indicar un estado válido.'
      );
    }

    const { activo } = req.body;

    // 3. Validar administrador autenticado.
    const adminId = req.usuario?.id;

    if (!adminId || !esUuidValido(adminId)) {
      return responderError(
        res,
        401,
        'No fue posible identificar al administrador autenticado.'
      );
    }

    // 4. Impedir autodesactivación.
    if (
      id === adminId &&
      activo === false
    ) {
      return responderError(
        res,
        403,
        'No puede desactivar su propia cuenta.'
      );
    }

    // 5. Consultar usuario objetivo.
    const {
      data: usuario,
      error: consultaError,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', id)
      .maybeSingle();

    if (consultaError) {
      console.error(
        'Error consultando usuario para cambiar estado:',
        consultaError.message
      );

      return responderError(
        res,
        500,
        'No fue posible consultar el usuario.'
      );
    }

    if (!usuario) {
      return responderError(
        res,
        404,
        'El usuario no existe.'
      );
    }

    // 6. Evitar cambios innecesarios.
    if (usuario.activo === activo) {
      return res.status(200).json({
        success: true,
        message: 'La cuenta ya tiene el estado solicitado.',
        usuario,
      });
    }

    // 7. Proteger cuentas administradoras.
    if (
      usuario.rol === 'administrador' &&
      activo === false
    ) {
      return responderError(
        res,
        403,
        'No está permitido desactivar cuentas administradoras desde esta función.'
      );
    }

    // 8. Ejecutar cambio de estado y auditoría
    // en una única transacción de PostgreSQL.
    const {
      data: resultado,
      error: transaccionError,
    } = await supabaseAdmin.rpc(
      'admin_cambiar_estado_usuario',
      {
        p_admin_id: adminId,
        p_usuario_id: id,
        p_activo: activo,
        p_direccion_ip:
          req.ip || null,
        p_dispositivo:
          req.headers['user-agent'] || null,
      }
    );

    if (transaccionError) {
      console.error(
        'Error en transacción administrativa:',
        {
          code: transaccionError.code,
          message: transaccionError.message,
        }
      );

      return responderError(
        res,
        500,
        'No fue posible cambiar el estado del usuario.'
      );
    }

    // 9. Validar respuesta de PostgreSQL.
    if (
      !resultado ||
      resultado.success !== true
    ) {
      console.error(
        'Respuesta inesperada de la función administrativa:',
        resultado
      );

      return responderError(
        res,
        500,
        'No fue posible confirmar el cambio de estado.'
      );
    }

    // 10. Consultar estado final para mantener
    // la estructura de respuesta del backend.
    const {
      data: actualizado,
      error: verificacionError,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', id)
      .maybeSingle();

    if (verificacionError) {
      console.error(
        'El cambio se realizó, pero falló la consulta de verificación:',
        verificacionError.message
      );
    }

    // Si la consulta de verificación falla,
    // utilizamos el resultado confirmado por la RPC.
    const usuarioFinal = actualizado || {
      id: resultado.usuarioId || id,
      rol: resultado.rol || usuario.rol,
      activo: resultado.activo,
    };

    // 11. Responder al cliente.
    return res.status(200).json({
      success: true,
      message: resultado.sinCambios
        ? 'La cuenta ya tiene el estado solicitado.'
        : activo
          ? 'Cuenta activada correctamente.'
          : 'Cuenta desactivada correctamente.',
      usuario: usuarioFinal,
    });
  } catch (error) {
    console.error(
      'Error inesperado cambiando estado de usuario:',
      error
    );

    return responderError(
      res,
      500,
      'No fue posible cambiar el estado del usuario.'
    );
  }
};

module.exports = {
  listarUsuarios,
  obtenerResumenUsuarios,
  obtenerDetalleUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
};
