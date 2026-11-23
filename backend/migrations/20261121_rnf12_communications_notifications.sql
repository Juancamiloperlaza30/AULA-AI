BEGIN;

DO $$
BEGIN
  IF to_regclass('public.notificaciones') IS NULL
     OR to_regclass('public.notificaciones_envios') IS NULL
     OR to_regclass('public.dispositivos_push') IS NULL
     OR to_regclass('public.comunicados_destinatarios') IS NULL
     OR to_regclass('public.comunicados') IS NULL THEN
    RAISE EXCEPTION
      'RNF-12: faltan tablas base de notificaciones, dispositivos o comunicados; confirme el esquema antes de aplicar.';
  END IF;

  IF to_regproc('public.reservar_envio_institucional_hu12') IS NULL
     OR to_regproc('public.finalizar_envio_institucional_hu12') IS NULL THEN
    RAISE EXCEPTION
      'RNF-12: faltan las funciones de reserva/finalización de envíos HU-12.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notificaciones
    WHERE evento_clave IS NOT NULL
    GROUP BY usuario_id, evento_clave
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-12: existen eventos de notificación duplicados por usuario.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notificaciones_envios
    GROUP BY notificacion_id, dispositivo_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-12: existen envíos duplicados para una notificación y dispositivo.';
  END IF;
END;
$$;

ALTER TABLE public.notificaciones_envios
  ADD COLUMN IF NOT EXISTS proximo_intento_at timestamptz
  NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS
  notificaciones_usuario_evento_uidx
ON public.notificaciones (usuario_id, evento_clave);

CREATE UNIQUE INDEX IF NOT EXISTS
  notificaciones_envios_notificacion_dispositivo_uidx
ON public.notificaciones_envios (notificacion_id, dispositivo_id);

CREATE INDEX IF NOT EXISTS
  notificaciones_usuario_fecha_idx
ON public.notificaciones (usuario_id, fecha_creacion DESC, id DESC);

CREATE INDEX IF NOT EXISTS
  notificaciones_envios_pendientes_fecha_idx
ON public.notificaciones_envios (proximo_intento_at, id)
WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS
  comunicados_destinatarios_usuario_comunicado_idx
ON public.comunicados_destinatarios (usuario_id, comunicado_id);

CREATE OR REPLACE FUNCTION public.hu12_encolar_envio_notificacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado <> 'pendiente' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificaciones_envios (
    notificacion_id,
    dispositivo_id,
    estado,
    intentos,
    proximo_intento_at,
    updated_at
  )
  SELECT
    NEW.id,
    d.id,
    'pendiente',
    0,
    now(),
    now()
  FROM public.dispositivos_push d
  WHERE d.usuario_id = NEW.usuario_id
    AND d.activo = true
  ON CONFLICT (notificacion_id, dispositivo_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hu12_notificaciones_encolar
  ON public.notificaciones;
CREATE TRIGGER hu12_notificaciones_encolar
AFTER INSERT ON public.notificaciones
FOR EACH ROW
EXECUTE FUNCTION public.hu12_encolar_envio_notificacion();

CREATE OR REPLACE FUNCTION public.hu12_crear_notificacion_comunicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comunicado public.comunicados%ROWTYPE;
BEGIN
  SELECT *
  INTO v_comunicado
  FROM public.comunicados
  WHERE id = NEW.comunicado_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificaciones (
    usuario_id,
    tipo,
    titulo,
    mensaje,
    recurso_tipo,
    recurso_id,
    comunicado_id,
    evento_clave,
    estado,
    fecha_creacion,
    updated_at
  )
  VALUES (
    NEW.usuario_id,
    'comunicado',
    'Nuevo comunicado institucional',
    COALESCE(v_comunicado.titulo, 'AULA-AI'),
    'comunicado',
    v_comunicado.id,
    v_comunicado.id,
    'comunicado:' || v_comunicado.id::text || ':' || NEW.usuario_id::text,
    'pendiente',
    now(),
    now()
  )
  ON CONFLICT (usuario_id, evento_clave) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hu12_destinatarios_notificacion
  ON public.comunicados_destinatarios;
CREATE TRIGGER hu12_destinatarios_notificacion
AFTER INSERT ON public.comunicados_destinatarios
FOR EACH ROW
EXECUTE FUNCTION public.hu12_crear_notificacion_comunicado();

REVOKE ALL ON public.notificaciones_envios FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notificaciones_envios TO service_role;

COMMIT;
