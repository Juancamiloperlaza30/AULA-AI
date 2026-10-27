-- HU-06: permitir a un docente corregir únicamente
-- asistencias propias de una sesión y asignación activas.
-- Ejecutar en el SQL Editor de Supabase.
BEGIN;

CREATE OR REPLACE FUNCTION public.hu06_corregir_asistencia(
  p_asistencia_id bigint,
  p_usuario_id uuid,
  p_estado text,
  p_observacion text,
  p_motivo text
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_anterior public.asistencias%ROWTYPE;
  v_rol text;
  v_grupo bigint;
  v_grado bigint;
  v_docente_sesion uuid;
BEGIN
  SELECT *
  INTO v_anterior
  FROM public.asistencias
  WHERE id = p_asistencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asistencia inexistente'
      USING ERRCODE = '22023';
  END IF;

  SELECT rol
  INTO v_rol
  FROM public.usuarios
  WHERE id = p_usuario_id
    AND activo = true;

  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Usuario no autorizado'
      USING ERRCODE = '42501';
  END IF;

  IF v_rol = 'docente' THEN
    SELECT docente_id
    INTO v_docente_sesion
    FROM public.sesiones_clase
    WHERE id = v_anterior.sesion_clase_id;

    IF
      v_anterior.docente_id IS DISTINCT FROM p_usuario_id
      OR v_docente_sesion IS DISTINCT FROM p_usuario_id
      OR NOT EXISTS (
        SELECT 1
        FROM public.materia_docente md
        JOIN public.materia_grupo_periodo mgp
          ON mgp.id = md.materia_grupo_periodo_id
        JOIN public.periodos_academicos pa
          ON pa.id = mgp.periodo_id
        JOIN public.grupos g
          ON g.id = mgp.grupo_id
        WHERE md.docente_id = p_usuario_id
          AND md.materia_grupo_periodo_id =
            v_anterior.materia_grupo_periodo_id
          AND mgp.estado = 'activa'
          AND pa.activo = true
          AND g.activo = true
      )
    THEN
      RAISE EXCEPTION
        'El docente solo puede corregir asistencias propias de asignaciones activas'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_rol = 'coordinador' THEN
    SELECT grado_id, grupo_id
    INTO v_grado, v_grupo
    FROM public.materia_grupo_periodo
    WHERE id = v_anterior.materia_grupo_periodo_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.coordinador_ambito
      WHERE coordinador_id = p_usuario_id
        AND grado_id = v_grado
        AND grupo_id = v_grupo
        AND activo = true
    ) THEN
      RAISE EXCEPTION
        'Fuera del ámbito del coordinador'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_rol <> 'administrador' THEN
    RAISE EXCEPTION 'No autorizado'
      USING ERRCODE = '42501';
  END IF;

  IF
    p_estado IS NULL
    OR p_estado NOT IN ('presente', 'ausente', 'tarde')
    OR NULLIF(BTRIM(p_motivo), '') IS NULL
  THEN
    RAISE EXCEPTION 'Estado o motivo inválido'
      USING ERRCODE = '22023';
  END IF;

  IF
    v_anterior.estado IS NOT DISTINCT FROM p_estado
    AND v_anterior.observacion IS NOT DISTINCT FROM
      p_observacion
  THEN
    RAISE EXCEPTION 'No hay cambios para guardar'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.asistencias
  SET
    estado = p_estado,
    observacion = p_observacion,
    updated_at = now()
  WHERE id = p_asistencia_id;

  INSERT INTO public.asistencias_historial (
    asistencia_id,
    usuario_id,
    estado_anterior,
    estado_nuevo,
    observacion_anterior,
    observacion_nueva,
    motivo
  )
  VALUES (
    p_asistencia_id,
    p_usuario_id,
    v_anterior.estado,
    p_estado,
    v_anterior.observacion,
    p_observacion,
    BTRIM(p_motivo)
  );

  INSERT INTO public.auditoria (
    usuario_id,
    evento,
    rol,
    descripcion,
    metadata
  )
  VALUES (
    p_usuario_id,
    'ASISTENCIA_CORREGIDA',
    v_rol,
    'Corrección de asistencia',
    jsonb_build_object(
      'asistenciaId', p_asistencia_id,
      'estadoAnterior', v_anterior.estado,
      'estadoNuevo', p_estado,
      'motivo', p_motivo
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.hu06_corregir_asistencia(
    bigint,
    uuid,
    text,
    text,
    text
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.hu06_corregir_asistencia(
    bigint,
    uuid,
    text,
    text,
    text
  )
TO service_role;

COMMIT;
