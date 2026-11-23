BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sesiones_clase
    GROUP BY materia_grupo_periodo_id, fecha, numero_sesion
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-06: existen sesiones duplicadas por asignación, fecha y número de sesión; corríjalas antes de aplicar esta migración.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.asistencias
    GROUP BY sesion_clase_id, estudiante_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-06: existen asistencias duplicadas por sesión y estudiante; corríjalas antes de aplicar esta migración.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.asistencias
    WHERE estado IS NULL
      OR estado NOT IN ('presente', 'ausente', 'tarde')
  ) THEN
    RAISE EXCEPTION
      'RNF-06: existen estados de asistencia inválidos; corríjalos antes de aplicar esta migración.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.asistencias a
    LEFT JOIN public.sesiones_clase s
      ON s.id = a.sesion_clase_id
    LEFT JOIN public.materia_grupo_periodo mgp
      ON mgp.id = s.materia_grupo_periodo_id
    WHERE s.id IS NULL
      OR a.materia_grupo_periodo_id
        IS DISTINCT FROM s.materia_grupo_periodo_id
      OR a.docente_id IS DISTINCT FROM s.docente_id
      OR a.fecha IS DISTINCT FROM s.fecha
      OR NOT EXISTS (
        SELECT 1
        FROM public.estudiantes e
        WHERE e.usuario_id = a.estudiante_id
          AND e.grado_id = mgp.grado_id
          AND e.grupo_id = mgp.grupo_id
      )
  ) THEN
    RAISE EXCEPTION
      'RNF-06: existen asistencias con sesión, fecha, docente, asignación o estudiante inconsistentes; corrija los registros antes de aplicar esta migración.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.asistencias'::regclass
      AND conname = 'asistencias_estado_valido'
  ) THEN
    ALTER TABLE public.asistencias
      ADD CONSTRAINT asistencias_estado_valido
      CHECK (estado IN ('presente', 'ausente', 'tarde'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_sesiones_clase_asignacion_fecha_numero
ON public.sesiones_clase (
  materia_grupo_periodo_id,
  fecha,
  numero_sesion
);

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_asistencias_sesion_estudiante
ON public.asistencias (
  sesion_clase_id,
  estudiante_id
);

CREATE OR REPLACE FUNCTION public.hu06_validar_integridad_asistencia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_asignacion_id bigint;
  v_docente_id uuid;
  v_fecha date;
  v_fecha_inicio date;
  v_fecha_fin date;
  v_asignacion_estado text;
  v_periodo_activo boolean;
  v_grupo_activo boolean;
BEGIN
  IF NEW.estado IS NULL
    OR NEW.estado NOT IN ('presente', 'ausente', 'tarde')
  THEN
    RAISE EXCEPTION 'Estado de asistencia inválido.'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    s.materia_grupo_periodo_id,
    s.docente_id,
    s.fecha,
    pa.fecha_inicio,
    pa.fecha_fin,
    mgp.estado,
    pa.activo,
    g.activo
  INTO
    v_asignacion_id,
    v_docente_id,
    v_fecha,
    v_fecha_inicio,
    v_fecha_fin,
    v_asignacion_estado,
    v_periodo_activo,
    v_grupo_activo
  FROM public.sesiones_clase s
  JOIN public.materia_grupo_periodo mgp
    ON mgp.id = s.materia_grupo_periodo_id
  JOIN public.periodos_academicos pa
    ON pa.id = mgp.periodo_id
  JOIN public.grupos g
    ON g.id = mgp.grupo_id
  WHERE s.id = NEW.sesion_clase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La sesión de clase no existe.'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.materia_grupo_periodo_id IS DISTINCT FROM v_asignacion_id
    OR NEW.docente_id IS DISTINCT FROM v_docente_id
    OR NEW.fecha IS DISTINCT FROM v_fecha
  THEN
    RAISE EXCEPTION
      'La asistencia debe corresponder a la asignación, docente y fecha de su sesión.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' AND (
    v_asignacion_estado IS DISTINCT FROM 'activa'
    OR v_periodo_activo IS DISTINCT FROM true
    OR v_grupo_activo IS DISTINCT FROM true
    OR v_fecha_inicio IS NULL
    OR v_fecha_fin IS NULL
    OR v_fecha < v_fecha_inicio
    OR v_fecha > v_fecha_fin
    OR NOT EXISTS (
      SELECT 1
      FROM public.materia_docente md
      WHERE md.docente_id = v_docente_id
        AND md.materia_grupo_periodo_id =
          v_asignacion_id
    )
  ) THEN
    RAISE EXCEPTION
      'La sesión no pertenece a una asignación activa del docente dentro del período académico.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.estudiantes e
    JOIN public.materia_grupo_periodo mgp
      ON mgp.id = v_asignacion_id
    WHERE e.usuario_id = NEW.estudiante_id
      AND e.grado_id = mgp.grado_id
      AND e.grupo_id = mgp.grupo_id
  ) THEN
    RAISE EXCEPTION
      'El estudiante no pertenece al grupo de la sesión.'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hu06_validar_integridad_asistencia
ON public.asistencias;

CREATE TRIGGER hu06_validar_integridad_asistencia
BEFORE INSERT OR UPDATE OF
  sesion_clase_id,
  materia_grupo_periodo_id,
  docente_id,
  estudiante_id,
  fecha,
  estado
ON public.asistencias
FOR EACH ROW
EXECUTE FUNCTION public.hu06_validar_integridad_asistencia();

CREATE TABLE IF NOT EXISTS public.asistencia_alertas_pendientes (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  asistencia_id bigint NOT NULL UNIQUE
    REFERENCES public.asistencias(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'procesando', 'procesada')),
  intentos integer NOT NULL DEFAULT 0
    CHECK (intentos >= 0),
  proximo_intento_at timestamptz NOT NULL DEFAULT now(),
  bloqueado_at timestamptz,
  ultimo_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  idx_asistencia_alertas_pendientes_estado_fecha
ON public.asistencia_alertas_pendientes (
  estado,
  proximo_intento_at,
  id
);

ALTER TABLE public.asistencia_alertas_pendientes
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.asistencia_alertas_pendientes
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.asistencia_alertas_pendientes
  TO service_role;
GRANT USAGE, SELECT
  ON SEQUENCE public.asistencia_alertas_pendientes_id_seq
  TO service_role;

CREATE OR REPLACE FUNCTION public.hu06_encolar_alerta_asistencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.asistencia_alertas_pendientes (
    asistencia_id,
    estado,
    intentos,
    proximo_intento_at,
    bloqueado_at,
    ultimo_error,
    updated_at
  )
  VALUES (
    NEW.id,
    'pendiente',
    0,
    now(),
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (asistencia_id)
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

DROP TRIGGER IF EXISTS hu06_encolar_alerta_asistencia
ON public.asistencias;

CREATE TRIGGER hu06_encolar_alerta_asistencia
AFTER INSERT OR UPDATE OF
  estudiante_id,
  estado,
  fecha,
  materia_grupo_periodo_id
ON public.asistencias
FOR EACH ROW
EXECUTE FUNCTION public.hu06_encolar_alerta_asistencia();

COMMIT;
