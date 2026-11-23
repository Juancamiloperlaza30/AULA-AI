BEGIN;

DO $$
BEGIN
  IF to_regclass('public.excusas') IS NULL
    OR to_regclass('public.excusas_soportes') IS NULL
    OR to_regclass('public.asistencias') IS NULL
    OR to_regclass('public.acudiente_estudiante') IS NULL
    OR to_regclass('public.usuarios') IS NULL
  THEN
    RAISE EXCEPTION
      'RNF-09: faltan tablas requeridas para el flujo de excusas.';
  END IF;
END;
$$;

ALTER TABLE public.excusas
  ADD COLUMN IF NOT EXISTS clave_idempotencia uuid;

DO $$
DECLARE
  v_tipo_clave text;
BEGIN
  SELECT data_type
  INTO v_tipo_clave
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'excusas'
    AND column_name = 'clave_idempotencia';

  IF v_tipo_clave IN ('text', 'character varying') THEN
    IF EXISTS (
      SELECT 1
      FROM public.excusas
      WHERE clave_idempotencia IS NOT NULL
        AND clave_idempotencia::text !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) THEN
      RAISE EXCEPTION
        'RNF-09: hay claves idempotentes existentes que no son UUID validos.';
    END IF;

    ALTER TABLE public.excusas
      ALTER COLUMN clave_idempotencia TYPE uuid
      USING clave_idempotencia::uuid;

    v_tipo_clave := 'uuid';
  END IF;

  IF v_tipo_clave <> 'uuid' THEN
    RAISE EXCEPTION
      'RNF-09: excusas.clave_idempotencia debe ser UUID; revise los datos existentes antes de continuar.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.excusas
    WHERE clave_idempotencia IS NOT NULL
    GROUP BY acudiente_id, clave_idempotencia
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-09: existen claves idempotentes duplicadas; corrijalas antes de aplicar esta migracion.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.excusas
    WHERE estado IS NULL
      OR estado NOT IN (
        'pendiente_revision',
        'aprobada',
        'rechazada',
        'requiere_correccion'
      )
  ) THEN
    RAISE EXCEPTION
      'RNF-09: existen estados de excusa invalidos; corrijalos antes de aplicar esta migracion.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.excusas
    WHERE asistencia_id IS NULL
      AND estado IN (
        'pendiente_revision',
        'aprobada',
        'requiere_correccion'
      )
  ) THEN
    RAISE EXCEPTION
      'RNF-09: existen excusas activas sin asistencia asociada; corrijalas antes de aplicar esta migracion.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.excusas
    WHERE estado IN (
      'pendiente_revision',
      'aprobada',
      'requiere_correccion'
    )
    GROUP BY asistencia_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-09: existen varias excusas activas para una asistencia; corrijalas antes de aplicar esta migracion.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.excusas_soportes
    GROUP BY storage_path
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-09: existen rutas de soportes duplicadas; corrijalas antes de aplicar esta migracion.';
  END IF;
END;
$$;

ALTER TABLE public.excusas
  ALTER COLUMN asistencia_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_excusas_acudiente_clave_idempotencia
ON public.excusas (
  acudiente_id,
  clave_idempotencia
)
WHERE clave_idempotencia IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_excusas_asistencia_activa
ON public.excusas (asistencia_id)
WHERE estado IN (
  'pendiente_revision',
  'aprobada',
  'requiere_correccion'
);

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_excusas_soportes_storage_path
ON public.excusas_soportes (storage_path);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.excusas'::regclass
      AND conname = 'excusas_estado_valido'
  ) THEN
    ALTER TABLE public.excusas
      ADD CONSTRAINT excusas_estado_valido
      CHECK (
        estado IN (
          'pendiente_revision',
          'aprobada',
          'rechazada',
          'requiere_correccion'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.excusas'::regclass
      AND confrelid = 'public.usuarios'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = 'public.excusas'::regclass
            AND attname = 'estudiante_id'
        )
      ]::smallint[]
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.excusas e
      LEFT JOIN public.usuarios u
        ON u.id = e.estudiante_id
      WHERE u.id IS NULL
    ) THEN
      RAISE EXCEPTION
        'RNF-09: existen excusas sin estudiante asociado; corrijalas antes de aplicar esta migracion.';
    END IF;

    ALTER TABLE public.excusas
      ADD CONSTRAINT excusas_estudiante_fk
      FOREIGN KEY (estudiante_id)
      REFERENCES public.usuarios(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.excusas'::regclass
      AND confrelid = 'public.usuarios'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = 'public.excusas'::regclass
            AND attname = 'acudiente_id'
        )
      ]::smallint[]
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.excusas e
      LEFT JOIN public.usuarios u
        ON u.id = e.acudiente_id
      WHERE u.id IS NULL
    ) THEN
      RAISE EXCEPTION
        'RNF-09: existen excusas sin acudiente asociado; corrijalas antes de aplicar esta migracion.';
    END IF;

    ALTER TABLE public.excusas
      ADD CONSTRAINT excusas_acudiente_fk
      FOREIGN KEY (acudiente_id)
      REFERENCES public.usuarios(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.excusas'::regclass
      AND conname = 'excusas_asistencia_estudiante_fk'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.excusas e
      LEFT JOIN public.asistencias a
        ON a.id = e.asistencia_id
        AND a.estudiante_id = e.estudiante_id
      WHERE a.id IS NULL
    ) THEN
      RAISE EXCEPTION
        'RNF-09: existen excusas cuya asistencia no corresponde al estudiante; corrijalas antes de aplicar esta migracion.';
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS
      uq_asistencias_id_estudiante
    ON public.asistencias (id, estudiante_id);

    ALTER TABLE public.excusas
      ADD CONSTRAINT excusas_asistencia_estudiante_fk
      FOREIGN KEY (asistencia_id, estudiante_id)
      REFERENCES public.asistencias(id, estudiante_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.excusas_soportes'::regclass
      AND confrelid = 'public.excusas'::regclass
      AND contype = 'f'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.excusas_soportes s
      LEFT JOIN public.excusas e
        ON e.id = s.excusa_id
      WHERE e.id IS NULL
    ) THEN
      RAISE EXCEPTION
        'RNF-09: existen soportes sin excusa asociada; corrijalos antes de aplicar esta migracion.';
    END IF;

    ALTER TABLE public.excusas_soportes
      ADD CONSTRAINT excusas_soportes_excusa_fk
      FOREIGN KEY (excusa_id)
      REFERENCES public.excusas(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'excusas-soportes',
  'excusas-soportes',
  false,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.excusas
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.excusas_soportes
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.excusas
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.excusas_soportes
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.excusas, public.excusas_soportes
  TO service_role;

DO $$
DECLARE
  v_secuencia text;
BEGIN
  v_secuencia := pg_get_serial_sequence(
    'public.excusas',
    'id'
  );

  IF v_secuencia IS NOT NULL THEN
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE %s TO service_role',
      v_secuencia
    );
  END IF;

  v_secuencia := pg_get_serial_sequence(
    'public.excusas_soportes',
    'id'
  );

  IF v_secuencia IS NOT NULL THEN
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE %s TO service_role',
      v_secuencia
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.hu09_crear_excusa_con_soporte_rnf09(
  p_acudiente_id uuid,
  p_estudiante_id uuid,
  p_asistencia_id bigint,
  p_motivo text,
  p_clave_idempotencia uuid,
  p_storage_path text,
  p_nombre_archivo text,
  p_tipo_mime text,
  p_tamano_bytes bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_asistencia public.asistencias%ROWTYPE;
  v_excusa public.excusas%ROWTYPE;
  v_extension text;
BEGIN
  IF p_acudiente_id IS NULL
    OR p_estudiante_id IS NULL
    OR p_asistencia_id IS NULL
    OR p_clave_idempotencia IS NULL
    OR p_storage_path IS NULL
    OR length(btrim(COALESCE(p_motivo, ''))) < 10
    OR length(btrim(COALESCE(p_motivo, ''))) > 2000
    OR p_nombre_archivo IS NULL
    OR length(p_nombre_archivo) > 180
    OR p_tamano_bytes IS NULL
    OR p_tamano_bytes < 1
    OR p_tamano_bytes > 5242880
  THEN
    RAISE EXCEPTION 'Datos de excusa invalidos.'
      USING ERRCODE = '22023';
  END IF;

  v_extension := CASE p_tipo_mime
    WHEN 'image/jpeg' THEN 'jpg'
    WHEN 'image/png' THEN 'png'
    WHEN 'image/webp' THEN 'webp'
    WHEN 'application/pdf' THEN 'pdf'
    ELSE NULL
  END;

  IF v_extension IS NULL
    OR p_storage_path !~* (
      '^hu09/'
      || p_estudiante_id::text
      || '/'
      || p_acudiente_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.'
      || v_extension
      || '$'
    )
  THEN
    RAISE EXCEPTION 'Metadatos de soporte invalidos.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.acudiente_estudiante ae
    WHERE ae.acudiente_id = p_acudiente_id
      AND ae.estudiante_id = p_estudiante_id
      AND ae.activo = true
      AND ae.verificado = true
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_acudiente_id
      AND u.rol = 'acudiente'
      AND u.activo = true
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_estudiante_id
      AND u.rol = 'estudiante'
      AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Vinculacion del acudiente no autorizada.'
      USING ERRCODE = '42501';
  END IF;

  SELECT e.*
  INTO v_excusa
  FROM public.excusas e
  WHERE e.acudiente_id = p_acudiente_id
    AND e.clave_idempotencia = p_clave_idempotencia;

  IF FOUND THEN
    IF v_excusa.estudiante_id <> p_estudiante_id
      OR v_excusa.asistencia_id <> p_asistencia_id
      OR v_excusa.motivo <> btrim(p_motivo)
    THEN
      RAISE EXCEPTION
        'La clave de envio pertenece a otra solicitud.'
        USING ERRCODE = '23505';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.excusas_soportes s
      WHERE s.excusa_id = v_excusa.id
    ) THEN
      RAISE EXCEPTION
        'La solicitud existente no tiene un soporte confirmado.'
        USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'excusa_id', v_excusa.id,
      'estado', v_excusa.estado,
      'fecha_registro', v_excusa.created_at,
      'ya_registrada', true
    );
  END IF;

  SELECT a.*
  INTO v_asistencia
  FROM public.asistencias a
  WHERE a.id = p_asistencia_id
    AND a.estudiante_id = p_estudiante_id
    AND a.estado = 'ausente'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La inasistencia no esta disponible.'
      USING ERRCODE = '23503';
  END IF;

  SELECT e.*
  INTO v_excusa
  FROM public.excusas e
  WHERE e.acudiente_id = p_acudiente_id
    AND e.clave_idempotencia = p_clave_idempotencia;

  IF FOUND THEN
    IF v_excusa.estudiante_id <> p_estudiante_id
      OR v_excusa.asistencia_id <> p_asistencia_id
      OR v_excusa.motivo <> btrim(p_motivo)
    THEN
      RAISE EXCEPTION
        'La clave de envio pertenece a otra solicitud.'
        USING ERRCODE = '23505';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.excusas_soportes s
      WHERE s.excusa_id = v_excusa.id
    ) THEN
      RAISE EXCEPTION
        'La solicitud existente no tiene un soporte confirmado.'
        USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'excusa_id', v_excusa.id,
      'estado', v_excusa.estado,
      'fecha_registro', v_excusa.created_at,
      'ya_registrada', true
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.excusas e
    WHERE e.asistencia_id = p_asistencia_id
      AND e.estado IN (
        'pendiente_revision',
        'aprobada',
        'requiere_correccion'
      )
  ) THEN
    RAISE EXCEPTION
      'La inasistencia ya tiene una excusa activa.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.excusas (
    asistencia_id,
    estudiante_id,
    acudiente_id,
    motivo,
    estado,
    clave_idempotencia
  )
  VALUES (
    p_asistencia_id,
    p_estudiante_id,
    p_acudiente_id,
    btrim(p_motivo),
    'pendiente_revision',
    p_clave_idempotencia
  )
  RETURNING * INTO v_excusa;

  INSERT INTO public.excusas_soportes (
    excusa_id,
    storage_bucket,
    storage_path,
    nombre_archivo,
    tipo_mime,
    tamano_bytes
  )
  VALUES (
    v_excusa.id,
    'excusas-soportes',
    p_storage_path,
    p_nombre_archivo,
    p_tipo_mime,
    p_tamano_bytes
  );

  RETURN jsonb_build_object(
    'excusa_id', v_excusa.id,
    'estado', v_excusa.estado,
    'fecha_registro', v_excusa.created_at,
    'ya_registrada', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hu09_crear_excusa_con_soporte_rnf09(
  uuid,
  uuid,
  bigint,
  text,
  uuid,
  text,
  text,
  text,
  bigint
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hu09_crear_excusa_con_soporte_rnf09(
  uuid,
  uuid,
  bigint,
  text,
  uuid,
  text,
  text,
  text,
  bigint
)
TO service_role;

COMMIT;
