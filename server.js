// server.js - VERSIÓN FINAL PARA RENDER

// 1. Importaciones
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');

// 2. Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Conexión a la Base de Datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// 4. Función para crear las tablas
const createTables = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
    CREATE TABLE IF NOT EXISTS pacientes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        habitacion VARCHAR(50)
`);

await client.query(`
    CREATE TABLE IF NOT EXISTS tareas (
        id SERIAL PRIMARY KEY,
        descripcion TEXT NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        paciente_id INTEGER REFERENCES pacientes(id),
        estado VARCHAR(50) DEFAULT 'en curso',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
`);
        console.log("Tablas de PostgreSQL verificadas.");
    } catch (err) {
        console.error("Error al crear las tablas:", err);
    } finally {
        client.release();
}
};


// Ruta para obtener pacientes
app.get('/api/pacientes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pacientes');
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ruta para crear tareas
app.post('/api/tareas', async (req, res) => {
    const { descripcion, categoria, paciente_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO tareas (descripcion, categoria, paciente_id) VALUES ($1, $2, $3)',
            [descripcion, categoria, paciente_id]
        );
        res.status(201).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 5. Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Autenticación CORREGIDO
app.use('/api', basicAuth({
    authorizer: (username, password) => {
        const envUser = process.env.ADMIN_USERNAME || 'admin';
        const envPass = process.env.ADMIN_PASSWORD || 'password';
        return basicAuth.safeCompare(username, envUser) && basicAuth.safeCompare(password, envPass);
    },
    challenge: true,
    realm: 'ControlHApp',
}));

app.use(express.static(path.join(__dirname, 'public')));

// 6. RUTAS DE LA API (sin cambios)
// ... (Aquí van todas tus rutas de /api/pacientes, /api/tareas, etc. que ya tenías)

// 7. Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor de ControlH corriendo en el puerto ${PORT}`);
    createTables();
});
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});