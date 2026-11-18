BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.actividades_academicas
    WHERE client_request_id IS NOT NULL
    GROUP BY client_request_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-04: existen actividades con client_request_id duplicado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recordatorios_actividades
    GROUP BY actividad_id, estudiante_id, tipo_recordatorio
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-04: existen recordatorios duplicados para la misma actividad, estudiante y tipo.';
  END IF;
END;
$$;

ALTER TABLE public.recordatorios_actividades
  ADD COLUMN IF NOT EXISTS estado_envio text;

ALTER TABLE public.recordatorios_actividades
  ADD COLUMN IF NOT EXISTS procesando_desde timestamptz;

ALTER TABLE public.recordatorios_actividades
  ADD COLUMN IF NOT EXISTS enviado_at timestamptz;

UPDATE public.recordatorios_actividades
SET estado_envio = 'enviado'
WHERE estado_envio IS NULL;

ALTER TABLE public.recordatorios_actividades
  ALTER COLUMN estado_envio SET DEFAULT 'enviado',
  ALTER COLUMN estado_envio SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'recordatorios_actividades_estado_envio_check'
      AND conrelid =
        'public.recordatorios_actividades'::regclass
  ) THEN
    ALTER TABLE public.recordatorios_actividades
      ADD CONSTRAINT
        recordatorios_actividades_estado_envio_check
      CHECK (
        estado_envio IN (
          'pendiente',
          'procesando',
          'enviado'
        )
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  actividades_academicas_client_request_id_uidx
ON public.actividades_academicas (client_request_id)
WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  recordatorios_actividades_destinatario_tipo_uidx
ON public.recordatorios_actividades (
  actividad_id,
  estudiante_id,
  tipo_recordatorio
);

CREATE INDEX IF NOT EXISTS
  actividades_publicadas_fecha_idx
ON public.actividades_academicas (
  fecha_publicacion,
  id
)
WHERE estado = 'publicada';

CREATE INDEX IF NOT EXISTS
  recordatorios_actividades_pendientes_idx
ON public.recordatorios_actividades (
  actividad_id,
  tipo_recordatorio,
  estado_envio,
  procesando_desde
);

COMMIT;
