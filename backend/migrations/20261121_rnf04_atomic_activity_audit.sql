-- RNF-04: registro y actualización con auditoría atómica
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.actividades_academicas') IS NULL
     OR to_regclass('public.usuarios') IS NULL
     OR to_regclass('public.auditoria') IS NULL
     OR to_regclass('public.materia_docente') IS NULL
     OR to_regclass('public.materia_grupo_periodo') IS NULL
     OR to_regclass('public.periodos_academicos') IS NULL
     OR to_regclass('public.coordinador_ambito') IS NULL THEN
    RAISE EXCEPTION
      'RNF-04: faltan tablas requeridas para registrar actividades y auditoría; verifique el esquema antes de aplicar esta migración.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION
  public.rnf04_guardar_actividad_auditada(
    p_operacion text,
    p_actividad jsonb,
    p_auditoria jsonb
  )
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid;
  v_correo text;
  v_rol text;
  v_actividad_id bigint;
  v_materia_grupo_periodo_id bigint;
  v_grado_id bigint;
  v_grupo_id bigint;
  v_metadata jsonb;
  v_evento text;
BEGIN
  IF p_operacion NOT IN ('registrar', 'actualizar') THEN
    RAISE EXCEPTION 'Operación de actividad no válida.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_actividad) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_auditoria) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Los datos de actividad y auditoría deben ser objetos JSON.'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_usuario_id := NULLIF(
      BTRIM(p_auditoria->>'usuario_id'),
      ''
    )::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'El usuario responsable no es válido.'
        USING ERRCODE = '22023';
  END;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'El usuario responsable es obligatorio.'
      USING ERRCODE = '22023';
  END IF;

  SELECT u.correo, u.rol
  INTO v_correo, v_rol
  FROM public.usuarios u
  WHERE u.id = v_usuario_id
    AND u.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario responsable no está activo.'
      USING ERRCODE = '42501';
  END IF;

  v_metadata := COALESCE(
    p_auditoria->'metadata',
    '{}'::jsonb
  );

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Los metadatos de auditoría no son válidos.'
      USING ERRCODE = '22023';
  END IF;

  IF p_operacion = 'registrar' THEN
    IF v_rol <> 'docente' THEN
      RAISE EXCEPTION 'Solo un docente puede registrar una actividad.'
        USING ERRCODE = '42501';
    END IF;

    BEGIN
      v_materia_grupo_periodo_id :=
        NULLIF(p_actividad->>'materia_grupo_periodo_id', '')::bigint;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'La asignación académica no es válida.'
          USING ERRCODE = '22023';
    END;

    IF v_materia_grupo_periodo_id IS NULL
       OR NULLIF(BTRIM(p_actividad->>'titulo'), '') IS NULL
       OR COALESCE(p_actividad->>'tipo', '') NOT IN (
         'tarea',
         'actividad',
         'examen'
       )
       OR NULLIF(BTRIM(p_actividad->>'descripcion'), '') IS NULL
       OR NULLIF(BTRIM(p_actividad->>'fecha_publicacion'), '') IS NULL
       OR NULLIF(BTRIM(p_actividad->>'fecha_entrega'), '') IS NULL THEN
      RAISE EXCEPTION 'Faltan datos obligatorios de la actividad.'
        USING ERRCODE = '22023';
    END IF;

    IF
      (p_actividad->>'fecha_entrega')::timestamptz <=
      (p_actividad->>'fecha_publicacion')::timestamptz
    THEN
      RAISE EXCEPTION
        'La fecha de entrega debe ser posterior a la fecha de publicación.'
        USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.materia_docente md
      JOIN public.materia_grupo_periodo mgp
        ON mgp.id = md.materia_grupo_periodo_id
      JOIN public.periodos_academicos pa
        ON pa.id = mgp.periodo_id
      WHERE md.docente_id = v_usuario_id
        AND md.materia_grupo_periodo_id =
          v_materia_grupo_periodo_id
        AND mgp.estado = 'activa'
        AND pa.activo = true
    ) THEN
      RAISE EXCEPTION
        'El docente no tiene una asignación académica activa para esta actividad.'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.actividades_academicas (
      materia_grupo_periodo_id,
      docente_id,
      tipo,
      titulo,
      descripcion,
      fecha_publicacion,
      fecha_entrega,
      estado,
      client_request_id
    )
    VALUES (
      v_materia_grupo_periodo_id,
      v_usuario_id,
      BTRIM(p_actividad->>'tipo'),
      BTRIM(p_actividad->>'titulo'),
      BTRIM(p_actividad->>'descripcion'),
      (p_actividad->>'fecha_publicacion')::timestamptz,
      (p_actividad->>'fecha_entrega')::timestamptz,
      COALESCE(
        NULLIF(BTRIM(p_actividad->>'estado'), ''),
        'publicada'
      ),
      NULLIF(p_actividad->>'client_request_id', '')::uuid
    )
    RETURNING id INTO v_actividad_id;

    v_evento := 'ACTIVIDAD_REGISTRADA';
  ELSE
    IF v_rol NOT IN ('administrador', 'coordinador') THEN
      RAISE EXCEPTION
        'No tienes permisos para modificar actividades.'
        USING ERRCODE = '42501';
    END IF;

    BEGIN
      v_actividad_id :=
        NULLIF(p_actividad->>'id', '')::bigint;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'El identificador de actividad no es válido.'
          USING ERRCODE = '22023';
    END;

    IF v_actividad_id IS NULL OR v_actividad_id <= 0 THEN
      RAISE EXCEPTION 'El identificador de actividad es obligatorio.'
        USING ERRCODE = '22023';
    END IF;

    SELECT a.materia_grupo_periodo_id
    INTO v_materia_grupo_periodo_id
    FROM public.actividades_academicas a
    WHERE a.id = v_actividad_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La actividad no existe.'
        USING ERRCODE = 'P0002';
    END IF;

    IF v_rol = 'coordinador' THEN
      SELECT mgp.grado_id, mgp.grupo_id
      INTO v_grado_id, v_grupo_id
      FROM public.materia_grupo_periodo mgp
      WHERE mgp.id = v_materia_grupo_periodo_id;

      IF NOT FOUND OR NOT EXISTS (
        SELECT 1
        FROM public.coordinador_ambito ca
        WHERE ca.coordinador_id = v_usuario_id
          AND ca.grado_id = v_grado_id
          AND ca.grupo_id = v_grupo_id
          AND ca.activo = true
      ) THEN
        RAISE EXCEPTION
          'El coordinador no tiene autorización para modificar esta actividad.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    IF NULLIF(BTRIM(p_actividad->>'titulo'), '') IS NULL
       OR COALESCE(p_actividad->>'tipo', '') NOT IN (
         'tarea',
         'actividad',
         'examen'
       )
       OR NULLIF(BTRIM(p_actividad->>'descripcion'), '') IS NULL
       OR NULLIF(BTRIM(p_actividad->>'fecha_publicacion'), '') IS NULL
       OR NULLIF(BTRIM(p_actividad->>'fecha_entrega'), '') IS NULL
       OR COALESCE(p_actividad->>'estado', '') NOT IN (
         'publicada',
         'cancelada'
       ) THEN
      RAISE EXCEPTION 'Los datos de actualización de la actividad no son válidos.'
        USING ERRCODE = '22023';
    END IF;

    IF
      (p_actividad->>'fecha_entrega')::timestamptz <=
      (p_actividad->>'fecha_publicacion')::timestamptz
    THEN
      RAISE EXCEPTION
        'La fecha de entrega debe ser posterior a la fecha de publicación.'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.actividades_academicas
    SET
      tipo = BTRIM(p_actividad->>'tipo'),
      titulo = BTRIM(p_actividad->>'titulo'),
      descripcion = BTRIM(p_actividad->>'descripcion'),
      fecha_publicacion =
        (p_actividad->>'fecha_publicacion')::timestamptz,
      fecha_entrega =
        (p_actividad->>'fecha_entrega')::timestamptz,
      estado = p_actividad->>'estado',
      updated_at = now()
    WHERE id = v_actividad_id;

    v_evento := 'ACTIVIDAD_MODIFICADA';
  END IF;

  INSERT INTO public.auditoria (
    usuario_id,
    correo,
    evento,
    descripcion,
    rol,
    direccion_ip,
    dispositivo,
    metadata
  )
  VALUES (
    v_usuario_id,
    v_correo,
    v_evento,
    CASE p_operacion
      WHEN 'registrar' THEN 'Registro de actividad académica'
      ELSE 'Actualización de actividad académica'
    END,
    v_rol,
    NULLIF(p_auditoria->>'direccion_ip', ''),
    NULLIF(p_auditoria->>'dispositivo', ''),
    v_metadata || jsonb_build_object('actividadId', v_actividad_id)
  );

  RETURN jsonb_build_object('id', v_actividad_id);
END;
$$;

REVOKE ALL ON FUNCTION
  public.rnf04_guardar_actividad_auditada(text,jsonb,jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rnf04_guardar_actividad_auditada(text,jsonb,jsonb)
TO service_role;

COMMIT;
