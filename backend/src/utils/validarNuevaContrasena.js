'use strict';

/**
 * Valida una contraseña nueva para AULA-AI.
 *
 * No registra ni devuelve contraseñas en mensajes de error.
 */
const validarNuevaContrasena = (
  nuevaContrasena,
  confirmarContrasena
) => {
  if (
    typeof nuevaContrasena !== 'string' ||
    !nuevaContrasena.trim()
  ) {
    return {
      valida: false,
      mensaje: 'La nueva contraseña es obligatoria.',
    };
  }

  if (
    typeof confirmarContrasena !== 'string' ||
    !confirmarContrasena.trim()
  ) {
    return {
      valida: false,
      mensaje: 'Debe confirmar la nueva contraseña.',
    };
  }

  if (nuevaContrasena !== confirmarContrasena) {
    return {
      valida: false,
      mensaje: 'Las contraseñas no coinciden.',
    };
  }

  if (nuevaContrasena.length < 8) {
    return {
      valida: false,
      mensaje: 'La contraseña debe tener mínimo 8 caracteres.',
    };
  }

  if (
    !/[A-Z]/.test(nuevaContrasena) ||
    !/[a-z]/.test(nuevaContrasena) ||
    !/[0-9]/.test(nuevaContrasena)
  ) {
    return {
      valida: false,
      mensaje:
        'La contraseña debe incluir al menos una letra mayúscula, una minúscula y un número.',
    };
  }

  return {
    valida: true,
    mensaje: null,
  };
};

module.exports = {
  validarNuevaContrasena,
};