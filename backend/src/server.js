// Importamos las dependencias principales del servidor
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const adminRoutes =
  require('./routes/adminRoutes');
const academicRoutes =
  require('./routes/academicRoutes');
const userRoutes =
  require('./routes/userRoutes');
const subjectRoutes =
  require('./routes/subjectRoutes');
const activityRoutes =
  require('./routes/activityRoutes');
const gradeRoutes =
  require('./routes/gradeRoutes');
const profileRoutes =
  require('./routes/profileRoutes');
const pushRoutes =
  require('./routes/pushRoutes');
const {
  iniciarRecordatoriosActividades,
} = require('./jobs/activityReminderJob');
const {
  supabaseAdmin,
} = require('./config/supabase');


// Creamos la aplicación de Express
const app = express();

// Puerto donde funcionará nuestra API.
// Más adelante Render podrá asignar su propio puerto.
const PORT = process.env.PORT || 3000;

// Permite recibir información en formato JSON
app.use(express.json());

// Permitimos solicitudes desde otros clientes.
// Más adelante restringiremos los orígenes permitidos.
app.use(cors());

// Rutas de autenticación de AULA-AI
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use(
  '/api/academic',
  academicRoutes
);
app.use(
  '/api/users',
  userRoutes
);
app.use(
  '/api/subjects',
  subjectRoutes
);
app.use(
  '/api/activities',
  activityRoutes
);
app.use(
  '/api/grades',
  gradeRoutes
);
app.use(
  '/api/profile',
  profileRoutes
);
app.use(
  '/api/push',
  pushRoutes
);

// Ruta de prueba para comprobar que la API está funcionando
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API de AULA-AI funcionando correctamente',
  });
});

app.get('/api/health/ready', async (req, res) => {
  try {
    const {
      error,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .limit(1);

    if (error) {
      console.error(
        'Comprobación de disponibilidad de Supabase fallida:',
        error.message
      );

      return res.status(503).json({
        success: false,
        api: 'available',
        supabase: 'unavailable',
        message:
          'La API está activa, pero no puede consultar Supabase.',
      });
    }

    return res.status(200).json({
      success: true,
      api: 'available',
      supabase: 'connected',
    });
  } catch (error) {
    console.error(
      'Error comprobando disponibilidad de Supabase:',
      error
    );

    return res.status(503).json({
      success: false,
      api: 'available',
      supabase: 'unavailable',
      message:
        'La API está activa, pero no puede consultar Supabase.',
    });
  }
});

// Si alguien intenta acceder a una ruta que no existe
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

iniciarRecordatoriosActividades();

// Iniciamos el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Servidor AULA-AI ejecutándose en http://localhost:${PORT}`
  );

  console.log(
    'Servidor escuchando:',
    server.listening
  );
});

server.on('error', (error) => {
  console.error(
    'ERROR DEL SERVIDOR:',
    error
  );
});

process.on('beforeExit', (code) => {
  console.log(
    'Node está intentando finalizar. Código:',
    code
  );
});