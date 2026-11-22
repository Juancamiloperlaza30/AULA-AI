
-- HU-14: asegura las asignaciones del período académico vigente.
-- No modifica asistencias, calificaciones, actividades ni historial.
-- Ejecución idempotente y protegida contra concurrencia.

CREATE OR REPLACE FUNCTION
  public.hu14_asegurar_asignaciones_periodo_actual(
    p_fecha_actual date
  )
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_periodo_actual record;
  v_origen record;
  v_asignacion_destino bigint;
  v_total_creadas integer := 0;
BEGIN
  IF p_fecha_actual IS NULL THEN
    RAISE EXCEPTION 'La fecha académica actual es obligatoria.'
      USING ERRCODE = '22004';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('hu14_asegurar_asignaciones_periodo_actual')
  );

  SELECT id, fecha_inicio
  INTO v_periodo_actual
  FROM public.periodos_academicos
  WHERE activo = true
    AND estado_academico = 'en_curso'
    AND cerrado_at IS NULL
    AND fecha_inicio <= p_fecha_actual
    AND fecha_fin >= p_fecha_actual
  ORDER BY fecha_inicio DESC, id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  FOR v_origen IN
    SELECT DISTINCT ON (
      origen.materia_id,
      origen.grupo_id
    )
      origen.id,
      origen.materia_id,
      origen.grado_id,
      origen.grupo_id,
      origen.estado
    FROM public.materia_grupo_periodo origen
    JOIN public.periodos_academicos periodo_origen
      ON periodo_origen.id = origen.periodo_id
    JOIN public.grupos grupo
      ON grupo.id = origen.grupo_id
      AND grupo.activo = true
    JOIN public.materias materia
      ON materia.id = origen.materia_id
      AND materia.estado = 'activa'
    WHERE origen.estado = 'activa'
      AND periodo_origen.fecha_fin <
          v_periodo_actual.fecha_inicio
    ORDER BY
      origen.materia_id,
      origen.grupo_id,
      periodo_origen.fecha_fin DESC,
      origen.id DESC
  LOOP

    INSERT INTO public.materia_grupo_periodo (
      materia_id,
      grado_id,
      grupo_id,
      periodo_id,
      estado
    )
    VALUES (
      v_origen.materia_id,
      v_origen.grado_id,
      v_origen.grupo_id,
      v_periodo_actual.id,
      v_origen.estado
    )
    ON CONFLICT (materia_id, grupo_id, periodo_id)
      DO NOTHING
    RETURNING id INTO v_asignacion_destino;

    IF v_asignacion_destino IS NOT NULL THEN
      v_total_creadas := v_total_creadas + 1;
    ELSE
      SELECT id
      INTO v_asignacion_destino
      FROM public.materia_grupo_periodo
      WHERE materia_id = v_origen.materia_id
        AND grupo_id = v_origen.grupo_id
        AND periodo_id = v_periodo_actual.id;
    END IF;

    -- Completar docentes faltantes sin duplicarlos.
    -- No modificar docentes ya vinculados.
    IF v_asignacion_destino IS NOT NULL THEN
      INSERT INTO public.materia_docente (
        docente_id,
        materia_grupo_periodo_id
      )
      SELECT
        md.docente_id,
        v_asignacion_destino
      FROM public.materia_docente md
      WHERE md.materia_grupo_periodo_id = v_origen.id
      ON CONFLICT (materia_grupo_periodo_id, docente_id)
        DO NOTHING;
    END IF;

  END LOOP;

  RETURN v_total_creadas;
END;
$$;

REVOKE ALL ON FUNCTION
  public.hu14_asegurar_asignaciones_periodo_actual(date)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.hu14_asegurar_asignaciones_periodo_actual(date)
  TO service_role;
