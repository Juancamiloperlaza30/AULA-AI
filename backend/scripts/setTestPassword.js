require('dotenv').config();

const {
  supabaseAdmin,
} = require('../src/config/supabase');

const ejecutar = async () => {
  try {
    const userId =
      process.env.TEST_USER_ID;

    const password =
      process.env.TEST_USER_PASSWORD;

    if (!userId) {
      console.error(
        'Falta TEST_USER_ID.'
      );
      process.exit(1);
    }

    if (!password) {
      console.error(
        'Falta TEST_USER_PASSWORD.'
      );
      process.exit(1);
    }

    if (password.length < 8) {
      console.error(
        'La contraseña debe tener mínimo 8 caracteres.'
      );
      process.exit(1);
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin.auth.admin
        .updateUserById(
          userId,
          {
            password,
            email_confirm: true,
          }
        );

    if (error) {
      console.error(
        'Error:',
        error.message
      );
      process.exit(1);
    }

    console.log(
      'Contraseña asignada correctamente.'
    );

    console.log(
      'Usuario:',
      data.user.email
    );

    process.exit(0);
  } catch (error) {
    console.error(
      'Error inesperado:',
      error
    );
    process.exit(1);
  }
};

ejecutar();
