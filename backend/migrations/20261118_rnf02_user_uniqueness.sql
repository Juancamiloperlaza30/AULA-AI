
BEGIN;

-- RNF-02.4: Verificar duplicados normalizados.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE correo IS NOT NULL
      AND btrim(correo) <> ''
    GROUP BY lower(btrim(correo))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-02: existen correos duplicados al normalizar.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE numero_documento IS NOT NULL
      AND btrim(numero_documento) <> ''
    GROUP BY btrim(numero_documento)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'RNF-02: existen documentos duplicados al normalizar.';
  END IF;
END;
$$;

-- Correo sin distinguir mayúsculas ni espacios externos.
CREATE UNIQUE INDEX IF NOT EXISTS
usuarios_correo_normalizado_uidx
ON public.usuarios (lower(btrim(correo)))
WHERE correo IS NOT NULL
  AND btrim(correo) <> '';

-- Documento sin espacios externos.
CREATE UNIQUE INDEX IF NOT EXISTS
usuarios_documento_normalizado_uidx
ON public.usuarios (btrim(numero_documento))
WHERE numero_documento IS NOT NULL
  AND btrim(numero_documento) <> '';

COMMIT;
