// server.js - VERSIÓN FINAL PARA DESPLIEGUE EN RENDER (USA POSTGRESQL Y SEGURIDAD)

// 1. Importaciones
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');

// 2. Configuración inicial
const app = express();
// Render asignará el puerto automáticamente a través de esta variable de entorno
const PORT = process.env.PORT || 3000;

// 3. Conexión a la Base de Datos PostgreSQL
// Render nos da la URL de conexión en esta variable de entorno
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Requerido para conexiones en Render
    }
});

// 4. Función para crear las tablas si no existen
const createTables = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS pacientes (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL UNIQUE,
                habitacion TEXT
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS tareas (
                id SERIAL PRIMARY KEY,
                descripcion TEXT NOT NULL,
                categoria TEXT NOT NULL,
                estado TEXT DEFAULT 'en curso',
                fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                paciente_id INTEGER REFERENCES pacientes(id) ON DELETE SET NULL
            );
        `);
        console.log("Tablas de PostgreSQL verificadas o creadas con éxito.");
    } catch (err) {
        console.error("Error al crear las tablas en PostgreSQL:", err);
    } finally {
        client.release(); // Libera al cliente de vuelta al pool
    }
};

// 5. Middlewares (en el orden correcto)
app.use(express.json());

// Middleware de Autenticación: protege todo el sitio
app.use(basicAuth({
    authorizer: (username, password) => {
        const userMatches = basicAuth.safeCompare(username, process.env.ADMIN_USERNAME);
        const passwordMatches = basicAuth.safeCompare(password, process.env.ADMIN_PASSWORD);
        return userMatches && passwordMatches;
    },
    challenge: true,
    realm: 'ControlHApp',
}));

// Middleware para servir los archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));


// 6. RUTAS DE LA API (usando async/await y pool.query)
// --- PACIENTES ---
app.get('/api/pacientes', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM pacientes ORDER BY nombre");
        res.json({ data: result.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/pacientes/:id', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM pacientes WHERE id = $1", [req.params.id]);
        res.json({ data: result.rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/pacientes', async (req, res) => {
    try {
        const { nombre, habitacion } = req.body;
        const result = await pool.query("INSERT INTO pacientes (nombre, habitacion) VALUES ($1, $2) RETURNING id", [nombre, habitacion]);
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) { res.status(400).json({ error: "El paciente ya existe." }); }
});

// -- RUTA PARA EDITAR QUE FALTABA --
app.put('/api/pacientes/:id', async (req, res) => {
    try {
        const { nombre, habitacion } = req.body;
        await pool.query("UPDATE pacientes SET nombre = $1, habitacion = $2 WHERE id = $3", [nombre, habitacion, req.params.id]);
        res.json({ message: "Paciente actualizado" });
    } catch (err) { res.status(400).json({ error: "No se pudo editar." }); }
});

// -- RUTA PARA ELIMINAR QUE FALTABA --
app.delete('/api/pacientes/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM pacientes WHERE id = $1", [req.params.id]);
        res.json({ message: "Paciente eliminado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- TAREAS ---
app.get('/api/tareas/all', async (req, res) => {
    try {
        const sql = `SELECT t.id, t.descripcion, t.categoria, t.estado, t.fecha_creacion, p.nombre as paciente_nombre 
                     FROM tareas t LEFT JOIN pacientes p ON t.paciente_id = p.id ORDER BY t.fecha_creacion DESC`;
        const result = await pool.query(sql);
        res.json({ data: result.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tareas', async (req, res) => {
    try {
        const { descripcion, categoria, paciente_id } = req.body;
        const result = await pool.query("INSERT INTO tareas (descripcion, categoria, paciente_id) VALUES ($1, $2, $3) RETURNING id", [descripcion, categoria, paciente_id]);
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/tareas/:id/estado', async (req, res) => {
    try {
        const { estado } = req.body;
        await pool.query("UPDATE tareas SET estado = $1 WHERE id = $2", [estado, req.params.id]);
        res.json({ message: "Estado de la tarea actualizado" });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- CATEGORÍAS ---
app.get('/api/tareas/categoria/:categoria', async (req, res) => {
    try {
        const sql = `SELECT t.*, p.nombre as paciente_nombre, p.habitacion as paciente_habitacion 
                     FROM tareas t LEFT JOIN pacientes p ON t.paciente_id = p.id 
                     WHERE t.categoria = $1 AND t.estado = 'en curso'`;
        const result = await pool.query(sql, [req.params.categoria]);
        res.json({ data: result.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// 7. Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor de ControlH corriendo en el puerto ${PORT}`);
    // Verificamos y creamos las tablas al iniciar
    createTables();
});