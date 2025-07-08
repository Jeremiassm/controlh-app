const express = require('express');
const basicAuth = require('express-basic-auth'); // La librería de seguridad
const path = require('path');
const { Pool } = require('pg'); // Usamos la versión de PostgreSQL para la nube

const app = express();
const PORT = process.env.PORT || 3000;

// --- Conexión a la Base de Datos PostgreSQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Función para crear las tablas
const createTables = async () => {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS pacientes (...)`); // Tu código de creación de tablas
        await client.query(`CREATE TABLE IF NOT EXISTS tareas (...)`); // Tu código de creación de tablas
        console.log("Tablas verificadas.");
    } finally {
        client.release();
    }
};

// =======================================================
// === CAMBIO IMPORTANTE EN EL ORDEN DE LOS MIDDLEWARES ===
// =======================================================

// 1. Middleware para entender JSON (siempre va primero)
app.use(express.json());

// 2. Middleware de Autenticación (ahora protege TODO)
app.use(basicAuth({
    authorizer: (username, password) => {
        // Comparamos de forma segura para evitar ataques de tiempo
        const userMatches = basicAuth.safeCompare(username, process.env.ADMIN_USERNAME || 'admin');
        const passwordMatches = basicAuth.safeCompare(password, process.env.ADMIN_PASSWORD || 'password123');
        return userMatches && passwordMatches;
    },
    challenge: true, // Esto hace que aparezca la ventana de login del navegador
    realm: 'ControlHApp',
}));

// 3. Middleware para servir los archivos estáticos (HTML, CSS, JS)
// Ahora se ejecuta DESPUÉS de la autenticación
app.use(express.static(path.join(__dirname, 'public')));


// =======================================================
// 5. RUTAS DE LA API
// =======================================================
// Tus rutas de /api/pacientes, /api/tareas, etc. van aquí sin cambios.
// ... (pega aquí todas tus rutas app.get, app.post, etc.) ...
app.get('/api/pacientes', async (req, res) => { /* ... */ });
app.post('/api/pacientes', async (req, res) => { /* ... */ });
// ... y así con todas las demás ...


// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor de ControlH corriendo en el puerto ${PORT}`);
    createTables().catch(console.error);
});