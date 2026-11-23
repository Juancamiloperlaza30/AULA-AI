BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.calificaciones
    WHERE estado = 'registrada'
    GROUP BY actividad_id, estudiante_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-05: existen calificaciones registradas duplicadas por actividad y estudiante.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.calificaciones
    WHERE estado = 'registrada'
      AND (
        valor IS NULL
        OR valor < 0
        OR valor > 5
      )
  ) THEN
    RAISE EXCEPTION
      'RNF-05: existen calificaciones registradas fuera de la escala 0-5.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calificaciones_valor_rnf05_check'
      AND conrelid = 'public.calificaciones'::regclass
  ) THEN
    ALTER TABLE public.calificaciones
      ADD CONSTRAINT calificaciones_valor_rnf05_check
      CHECK (valor >= 0 AND valor <= 5);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  calificaciones_actividad_estudiante_registrada_uidx
ON public.calificaciones (actividad_id, estudiante_id)
WHERE estado = 'registrada';

CREATE TABLE IF NOT EXISTS
  public.calificacion_alertas_pendientes (
    id bigserial PRIMARY KEY,
    actividad_id bigint NOT NULL,
    estudiante_id uuid NOT NULL,
    estado text NOT NULL DEFAULT 'pendiente',
    intentos integer NOT NULL DEFAULT 0,
    proximo_intento_at timestamptz NOT NULL DEFAULT now(),
    bloqueado_at timestamptz,
    ultimo_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT calificacion_alertas_pendientes_estado_check
      CHECK (estado IN ('pendiente', 'procesando', 'procesada')),
    CONSTRAINT calificacion_alertas_pendientes_intentos_check
      CHECK (intentos >= 0),
    CONSTRAINT calificacion_alertas_pendientes_unica
      UNIQUE (actividad_id, estudiante_id)
  );

ALTER TABLE public.calificacion_alertas_pendientes
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.calificacion_alertas_pendientes
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.calificacion_alertas_pendientes
  TO service_role;

GRANT USAGE, SELECT ON SEQUENCE
  public.calificacion_alertas_pendientes_id_seq
  TO service_role;

CREATE INDEX IF NOT EXISTS
  calificacion_alertas_pendientes_pendientes_idx
ON public.calificacion_alertas_pendientes (
  estado,
  proximo_intento_at,
  bloqueado_at,
  id
);

CREATE OR REPLACE FUNCTION
  public.encolar_alerta_por_calificacion_rnf05()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM 'registrada' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.valor IS NOT DISTINCT FROM NEW.valor AND
      OLD.retroalimentacion
        IS NOT DISTINCT FROM NEW.retroalimentacion AND
      OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.calificacion_alertas_pendientes (
    actividad_id,
    estudiante_id,
    estado,
    intentos,
    proximo_intento_at,
    bloqueado_at,
    ultimo_error,
    updated_at
  )
  VALUES (
    NEW.actividad_id,
    NEW.estudiante_id,
    'pendiente',
    0,
    now(),
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (actividad_id, estudiante_id)
  DO UPDATE SET
    estado = 'pendiente',
    intentos = 0,
    proximo_intento_at = now(),
    bloqueado_at = NULL,
    ultimo_error = NULL,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  calificaciones_alerta_rnf05_trigger
ON public.calificaciones;

CREATE TRIGGER calificaciones_alerta_rnf05_trigger
AFTER INSERT OR UPDATE OF valor, retroalimentacion, estado
ON public.calificaciones
FOR EACH ROW
EXECUTE FUNCTION
  public.encolar_alerta_por_calificacion_rnf05();

CREATE OR REPLACE FUNCTION
  public.guardar_calificaciones_masivas_rnf05(
    p_actividad_id bigint,
    p_docente_id uuid,
    p_calificaciones jsonb
  )
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actividad public.actividades_academicas%ROWTYPE;
  v_grado_id bigint;
  v_grupo_id bigint;
  v_item jsonb;
  v_estudiante_id uuid;
  v_estudiantes_vistos uuid[] := ARRAY[]::uuid[];
  v_valor numeric;
  v_retroalimentacion text;
  v_calificacion public.calificaciones%ROWTYPE;
  v_valor_anterior numeric;
  v_retroalimentacion_anterior text;
  v_es_nueva boolean;
  v_resultados jsonb := '[]'::jsonb;
BEGIN
  IF p_actividad_id IS NULL OR p_actividad_id <= 0
    OR p_docente_id IS NULL THEN
    RAISE EXCEPTION 'La actividad o el docente no son válidos.';
  END IF;

  IF jsonb_typeof(p_calificaciones) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Debe enviar al menos una calificación.';
  END IF;

  IF jsonb_array_length(p_calificaciones) = 0 THEN
    RAISE EXCEPTION 'Debe enviar al menos una calificación.';
  END IF;

  SELECT *
  INTO v_actividad
  FROM public.actividades_academicas
  WHERE id = p_actividad_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La actividad académica no existe.';
  END IF;

  IF v_actividad.docente_id IS DISTINCT FROM p_docente_id THEN
    RAISE EXCEPTION 'El docente no está asignado a esta actividad.';
  END IF;

  SELECT grado_id, grupo_id
  INTO v_grado_id, v_grupo_id
  FROM public.materia_grupo_periodo
  WHERE id = v_actividad.materia_grupo_periodo_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La actividad no tiene una asignación válida.';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_calificaciones)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
      OR COALESCE(v_item->>'estudianteId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR COALESCE(v_item->>'valor', '') = '' THEN
      RAISE EXCEPTION 'Una calificación contiene datos inválidos.';
    END IF;

    v_estudiante_id := (v_item->>'estudianteId')::uuid;
    v_valor := (v_item->>'valor')::numeric;
    v_retroalimentacion :=
      NULLIF(btrim(v_item->>'retroalimentacion'), '');

    IF v_valor < 0 OR v_valor > 5 THEN
      RAISE EXCEPTION 'La nota debe estar entre 0 y 5.';
    END IF;

    IF v_estudiante_id = ANY(v_estudiantes_vistos) THEN
      RAISE EXCEPTION 'La solicitud contiene estudiantes duplicados.';
    END IF;

    v_estudiantes_vistos :=
      array_append(v_estudiantes_vistos, v_estudiante_id);

    IF NOT EXISTS (
      SELECT 1
      FROM public.estudiantes
      WHERE usuario_id = v_estudiante_id
        AND grado_id = v_grado_id
        AND grupo_id = v_grupo_id
    ) THEN
      RAISE EXCEPTION
        'Un estudiante no pertenece al grupo de la actividad.';
    END IF;

    SELECT *
    INTO v_calificacion
    FROM public.calificaciones
    WHERE actividad_id = p_actividad_id
      AND estudiante_id = v_estudiante_id
      AND estado = 'registrada'
    FOR UPDATE;

    v_es_nueva := NOT FOUND;

    IF v_es_nueva THEN
      INSERT INTO public.calificaciones (
        actividad_id,
        estudiante_id,
        valor,
        retroalimentacion,
        estado,
        created_at,
        updated_at
      )
      VALUES (
        p_actividad_id,
        v_estudiante_id,
        v_valor,
        v_retroalimentacion,
        'registrada',
        now(),
        now()
      )
      RETURNING *
      INTO v_calificacion;
    ELSIF
      v_calificacion.valor IS DISTINCT FROM v_valor OR
      v_calificacion.retroalimentacion
        IS DISTINCT FROM v_retroalimentacion THEN
      v_valor_anterior := v_calificacion.valor;
      v_retroalimentacion_anterior :=
        v_calificacion.retroalimentacion;

      UPDATE public.calificaciones
      SET valor = v_valor,
          retroalimentacion = v_retroalimentacion,
          updated_at = now()
      WHERE id = v_calificacion.id
      RETURNING *
      INTO v_calificacion;

      INSERT INTO public.calificaciones_historial (
        calificacion_id,
        usuario_id,
        valor_anterior,
        valor_nuevo,
        retroalimentacion_anterior,
        retroalimentacion_nueva,
        motivo,
        rol_usuario
      )
      VALUES (
        v_calificacion.id,
        p_docente_id,
        v_valor_anterior,
        v_valor,
        v_retroalimentacion_anterior,
        v_retroalimentacion,
        'Calificación actualizada por el docente.',
        'docente'
      );
    END IF;

    v_resultados := v_resultados || jsonb_build_array(
      jsonb_build_object(
        'id', v_calificacion.id,
        'estudiante_id', v_calificacion.estudiante_id,
        'valor', v_calificacion.valor,
        'retroalimentacion', v_calificacion.retroalimentacion,
        'estado', v_calificacion.estado,
        'created_at', v_calificacion.created_at,
        'updated_at', v_calificacion.updated_at,
        'esNueva', v_es_nueva
      )
    );
  END LOOP;

  RETURN v_resultados;
END;
$$;

CREATE OR REPLACE FUNCTION
  public.actualizar_calificacion_auditada_rnf05(
    p_calificacion_id bigint,
    p_usuario_id uuid,
    p_rol text,
    p_valor numeric,
    p_retroalimentacion text,
    p_motivo text
  )
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_calificacion public.calificaciones%ROWTYPE;
  v_grado_id bigint;
  v_grupo_id bigint;
  v_valor_anterior numeric;
  v_retroalimentacion_anterior text;
  v_retroalimentacion text :=
    NULLIF(btrim(p_retroalimentacion), '');
BEGIN
  IF p_calificacion_id IS NULL OR p_calificacion_id <= 0
    OR p_usuario_id IS NULL
    OR p_rol IS NULL
    OR p_rol NOT IN ('administrador', 'coordinador')
    OR p_valor IS NULL
    OR p_valor < 0
    OR p_valor > 5 THEN
    RAISE EXCEPTION 'Los datos de actualización no son válidos.';
  END IF;

  SELECT *
  INTO v_calificacion
  FROM public.calificaciones
  WHERE id = p_calificacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La calificación no existe.';
  END IF;

  IF p_rol = 'coordinador' THEN
    SELECT mgp.grado_id, mgp.grupo_id
    INTO v_grado_id, v_grupo_id
    FROM public.actividades_academicas a
    JOIN public.materia_grupo_periodo mgp
      ON mgp.id = a.materia_grupo_periodo_id
    WHERE a.id = v_calificacion.actividad_id;

    IF NOT FOUND OR NOT EXISTS (
      SELECT 1
      FROM public.coordinador_ambito ca
      WHERE ca.coordinador_id = p_usuario_id
        AND ca.grado_id = v_grado_id
        AND ca.grupo_id = v_grupo_id
        AND ca.activo = true
    ) THEN
      RAISE EXCEPTION
        'El coordinador no tiene autorización para esta calificación.';
    END IF;
  END IF;

  IF v_calificacion.valor IS DISTINCT FROM p_valor OR
    v_calificacion.retroalimentacion
      IS DISTINCT FROM v_retroalimentacion THEN
    v_valor_anterior := v_calificacion.valor;
    v_retroalimentacion_anterior :=
      v_calificacion.retroalimentacion;

    UPDATE public.calificaciones
    SET valor = p_valor,
        retroalimentacion = v_retroalimentacion,
        updated_at = now()
    WHERE id = p_calificacion_id
    RETURNING *
    INTO v_calificacion;

    INSERT INTO public.calificaciones_historial (
      calificacion_id,
      usuario_id,
      valor_anterior,
      valor_nuevo,
      retroalimentacion_anterior,
      retroalimentacion_nueva,
      motivo,
      rol_usuario
    )
    VALUES (
      v_calificacion.id,
      p_usuario_id,
      v_valor_anterior,
      p_valor,
      v_retroalimentacion_anterior,
      v_retroalimentacion,
      NULLIF(btrim(p_motivo), ''),
      p_rol
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
  public.guardar_calificaciones_masivas_rnf05(bigint, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.guardar_calificaciones_masivas_rnf05(bigint, uuid, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION
  public.actualizar_calificacion_auditada_rnf05(
    bigint,
    uuid,
    text,
    numeric,
    text,
    text
  )
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.actualizar_calificacion_auditada_rnf05(
    bigint,
    uuid,
    text,
    numeric,
    text,
    text
  )
  TO service_role;

COMMIT;
