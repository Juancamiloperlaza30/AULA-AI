const {
  supabaseAdmin,
} = require('../config/supabase');

// =====================================================
// AULA-AI | HU-08
// CONTROLADOR DE SEGUIMIENTO DEL ACUDIENTE
//
// Consulta exclusivamente estudiantes vinculados
// al acudiente autenticado, con relación activa
// y verificada institucionalmente.
//
// No permite consultar estudiantes arbitrarios.
// No modifica registros académicos.
// =====================================================

const TAMANO_PAGINA = 500;

// Consulta paginada para no imponer un máximo
// arbitrario de estudiantes vinculados.
const obtenerTodosLosRegistros = async (
  crearConsulta
) => {
  const registros = [];
  let inicio = 0;

  while (true) {
    const { data, error } =
      await crearConsulta().range(
        inicio,
        inicio + TAMANO_PAGINA - 1
      );

    if (error) {
      throw error;
    }

    const pagina = data || [];

    registros.push(...pagina);

    if (pagina.length < TAMANO_PAGINA) {
      break;
    }

    inicio += TAMANO_PAGINA;
  }

  return registros;
};

// =====================================================
// GET /api/guardian/mis-estudiantes
// =====================================================

const listarMisEstudiantes = async (
  req,
  res
) => {
  try {
    // La identidad viene del middleware de
    // autenticación, nunca del cliente móvil.
    const acudienteId = req.usuario?.id;

    if (
      !acudienteId ||
      req.usuario?.rol !== 'acudiente'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene autorización para consultar esta información.',
      });
    }

    // ================================================
    // 1. CONSULTAR VINCULACIONES AUTORIZADAS
    // ================================================

    const vinculaciones =
      await obtenerTodosLosRegistros(
        () =>
          supabaseAdmin
            .from('acudiente_estudiante')
            .select(`
              id,
              acudiente_id,
              estudiante_id,
              created_at,
              updated_at
            `)
            .eq(
              'acudiente_id',
              acudienteId
            )
            .eq('activo', true)
            .eq('verificado', true)
            .order('id', {
              ascending: true,
            })
      );

    if (vinculaciones.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        estudiantes: [],
        message:
          'No tiene estudiantes con vinculaciones activas y verificadas.',
      });
    }

    const estudianteIds = [
      ...new Set(
        vinculaciones.map(
          (vinculacion) =>
            vinculacion.estudiante_id
        )
      ),
    ];

    // ================================================
    // 2. VALIDAR PERFILES DE ESTUDIANTES
    // ================================================

    const perfiles = [];

    for (
      let inicio = 0;
      inicio < estudianteIds.length;
      inicio += TAMANO_PAGINA
    ) {
      const lote = estudianteIds.slice(
        inicio,
        inicio + TAMANO_PAGINA
      );

      const {
        data,
        error,
      } = await supabaseAdmin
        .from('usuarios')
        .select(`
          id,
          nombres,
          apellidos,
          correo,
          rol,
          activo
        `)
        .in('id', lote)
        .eq('rol', 'estudiante')
        .eq('activo', true);

      if (error) {
        throw error;
      }

      perfiles.push(...(data || []));
    }

    const perfilesPorId = new Map(
      perfiles.map((perfil) => [
        String(perfil.id),
        perfil,
      ])
    );

    // ================================================
    // 3. CONSULTAR GRADO Y GRUPO
    // ================================================

    const estudiantesAcademicos = [];

    for (
      let inicio = 0;
      inicio < estudianteIds.length;
      inicio += TAMANO_PAGINA
    ) {
      const lote = estudianteIds.slice(
        inicio,
        inicio + TAMANO_PAGINA
      );

      const {
        data,
        error,
      } = await supabaseAdmin
        .from('estudiantes')
        .select(`
          usuario_id,
          grado_id,
          grupo_id,
          grado:grados (
            id,
            nombre
          ),
          grupo:grupos (
            id,
            nombre
          )
        `)
        .in('usuario_id', lote);

      if (error) {
        throw error;
      }

      estudiantesAcademicos.push(
        ...(data || [])
      );
    }

    const academicosPorId = new Map(
      estudiantesAcademicos.map(
        (estudiante) => [
          String(
            estudiante.usuario_id
          ),
          estudiante,
        ]
      )
    );

    // ================================================
    // 4. CONSTRUIR RESPUESTA AUTORIZADA
    // ================================================

    const estudiantes = vinculaciones
      .map((vinculacion) => {
        const estudianteId = String(
          vinculacion.estudiante_id
        );

        const perfil =
          perfilesPorId.get(estudianteId);

        const academico =
          academicosPorId.get(estudianteId);

        // No exponer cuentas desactivadas,
        // usuarios con otro rol o estudiantes
        // sin registro académico válido.
        if (!perfil || !academico) {
          return null;
        }

        const grado = Array.isArray(
          academico.grado
        )
          ? academico.grado[0]
          : academico.grado;

        const grupo = Array.isArray(
          academico.grupo
        )
          ? academico.grupo[0]
          : academico.grupo;

        return {
          id: perfil.id,

          nombres:
            perfil.nombres || '',

          apellidos:
            perfil.apellidos || '',

          nombreCompleto: [
            perfil.nombres,
            perfil.apellidos,
          ]
            .filter(Boolean)
            .join(' '),

          grado: grado
            ? {
                id: grado.id,
                nombre: grado.nombre,
              }
            : null,

          grupo: grupo
            ? {
                id: grupo.id,
                nombre: grupo.nombre,
              }
            : null,

          vinculacion: {
            id: vinculacion.id,
            fechaVinculacion:
              vinculacion.created_at,
            actualizadaEn:
              vinculacion.updated_at,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.nombreCompleto.localeCompare(
          b.nombreCompleto,
          'es'
        )
      );

    // ================================================
    // 5. RESPUESTA FINAL
    // ================================================

    return res.status(200).json({
      success: true,
      total: estudiantes.length,
      estudiantes,
    });
  } catch (error) {
    console.error(
      'HU-08: error consultando estudiantes del acudiente:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible consultar los estudiantes vinculados. Inténtelo nuevamente.',
    });
  }
};

module.exports = {
  listarMisEstudiantes,
};
