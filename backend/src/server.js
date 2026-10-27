
'use strict';

// ======================================================
// AULA-AI | SERVIDOR PRINCIPAL
// HU-01 A HU-08
// ======================================================

// Importamos las dependencias principales del servidor.
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// ======================================================
// IMPORTACIÓN DE RUTAS
// ======================================================

const authRoutes =
  require('./routes/authRoutes');

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

const attendanceRoutes =
  require('./routes/attendanceRoutes');

// HU-08: seguimiento académico del acudiente.
const guardianRoutes =
  require('./routes/guardianRoutes');

const excuseReviewRoutes =
  require('./routes/excuseReviewRoutes');

// HU-10: alertas de riesgo académico.
const riskAlertRoutes =
  require('./routes/riskAlertRoutes');

// ======================================================
// HU-11: RECOMENDACIONES ACADÉMICAS
// ======================================================

const academicRecommendationRoutes =
  require('./routes/academicRecommendationRoutes');

// ======================================================
// HU-11: PLANES DE ACOMPAÑAMIENTO ACADÉMICO
// ======================================================

const academicPlanRoutes =
  require('./routes/academicPlanRoutes');

// ======================================================
// HU-12: COMUNICADOS INSTITUCIONALES
// ======================================================

const comunicadoRoutes =
  require('./routes/comunicadoRoutes');

// HU-12: notificaciones institucionales.
const notificacionRoutes =
  require('./routes/notificacionRoutes');

// ======================================================
// SERVICIOS Y TAREAS PROGRAMADAS
// ======================================================

const {
  iniciarRecordatoriosActividades,
} = require('./jobs/activityReminderJob');

const {
  supabaseAdmin,
} = require('./config/supabase');

// ======================================================
// CONFIGURACIÓN DEL SERVIDOR
// ======================================================

const app = express();

const PORT = process.env.PORT || 3000;

// Permite recibir información en formato JSON.
app.use(express.json());

// Permitimos solicitudes desde otros clientes.
// Más adelante restringiremos los orígenes permitidos.
app.use(cors());

// ======================================================
// REGISTRO DE RUTAS
// ======================================================

// HU-01: autenticación.
app.use(
  '/api/auth',
  authRoutes
);

// Administración.
app.use(
  '/api/admin',
  adminRoutes
);

// Gestión académica.
app.use(
  '/api/academic',
  academicRoutes
);

// HU-02: usuarios.
app.use(
  '/api/users',
  userRoutes
);

// HU-03: materias.
app.use(
  '/api/subjects',
  subjectRoutes
);

// HU-04: actividades.
app.use(
  '/api/activities',
  activityRoutes
);

// HU-05: calificaciones.
app.use(
  '/api/grades',
  gradeRoutes
);

// Perfil institucional.
app.use(
  '/api/profile',
  profileRoutes
);

// Notificaciones.
app.use(
  '/api/push',
  pushRoutes
);

// HU-06: asistencia.
app.use(
  '/api/attendance',
  attendanceRoutes
);

// ======================================================
// HU-08: SEGUIMIENTO DEL ACUDIENTE
// ======================================================

// GET /api/guardian/mis-estudiantes
//
// Requiere:
// - Token JWT válido.
// - Rol acudiente.
// - Vinculación activa y verificada.
//
// Permite consultar todos los estudiantes
// autorizados del acudiente autenticado.
app.use(
  '/api/guardian',
  guardianRoutes
);

// HU-09 | Revisión de excusas por docentes y coordinadores
app.use('/api/excuse-review', excuseReviewRoutes);

// ======================================================
// HU-10: ALERTAS DE RIESGO ACADÉMICO
// ======================================================

app.use(
  '/api/risk-alerts',
  riskAlertRoutes
);

// ======================================================
// HU-11: RECOMENDACIONES ACADÉMICAS
// ======================================================

app.use(
  '/api/recomendaciones',
  academicRecommendationRoutes
);

// ======================================================
// HU-11: PLANES DE ACOMPAÑAMIENTO ACADÉMICO
// ======================================================

app.use(
  '/api/planes-acompanamiento',
  academicPlanRoutes
);

// ======================================================
// HU-12: COMUNICADOS INSTITUCIONALES
// ======================================================

app.use(
  '/api/comunicados',
  comunicadoRoutes
);

app.use(
  '/api/notificaciones',
  notificacionRoutes
);

// ======================================================
// VERIFICACIÓN DE DISPONIBILIDAD
// ======================================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message:
      'API de AULA-AI funcionando correctamente',
  });
});

app.get(
  '/api/health/ready',
  async (req, res) => {
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
  }
);

// ======================================================
// MANEJO DE RUTAS NO ENCONTRADAS
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message:
      'Ruta no encontrada',
  });
});

// ======================================================
// TAREAS PROGRAMADAS EXISTENTES
// ======================================================

iniciarRecordatoriosActividades();

// ======================================================
// INICIO DEL SERVIDOR
// ======================================================

const server = app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Servidor AULA-AI ejecutándose en http://localhost:${PORT}`
    );

    console.log(
      'Servidor escuchando:',
      server.listening
    );
  }
);

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
