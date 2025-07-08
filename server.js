// ==================================================================
// === CONTROLH SERVER.JS - VERSIÓN COMPLETA Y CORREGIDA PARA RENDER ===
// ==================================================================

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3001;

// === Conexión a PostgreSQL en Render ===
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// === Crear tablas si no existen ===
const createTables = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS pacientes (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                habitacion VARCHAR(50)
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS tareas (
                id SERIAL PRIMARY KEY,
                descripcion TEXT NOT NULL,
                categoria VARCHAR(100) NOT NULL,
                paciente_id INTEGER REFERENCES pacientes(id) ON DELETE SET NULL,
                estado VARCHAR(50) DEFAULT 'en curso',
                fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✔ Tablas creadas/verificadas");
    } catch (err) {
        console.error("❌ Error al crear tablas:", err);
    } finally {
        client.release();
    }
};

// === Middlewares ===
app.use(express.json());

// ✅ Solo esta línea para servir el front:
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Autenticación para las rutas de API
app.use('/api', basicAuth({
    authorizer: (username, password) => {
        const envUser = process.env.ADMIN_USERNAME || 'admin';
        const envPass = process.env.ADMIN_PASSWORD || 'password';
        return basicAuth.safeCompare(username, envUser) && basicAuth.safeCompare(password, envPass);
    },
    challenge: true,
    realm: 'ControlHAppRealm',
}));

// === Rutas de la API ===

// PACIENTES
app.get('/api/pacientes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pacientes ORDER BY nombre ASC');
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pacientes/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pacientes WHERE id = $1', [req.params.id]);
        res.json({ data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/pacientes', async (req, res) => {
    const { nombre, habitacion } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO pacientes (nombre, habitacion) VALUES ($1, $2) RETURNING *',
            [nombre, habitacion]
        );
        res.status(201).json({ data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/pacientes/:id', async (req, res) => {
    const { nombre, habitacion } = req.body;
    try {
        await pool.query(
            'UPDATE pacientes SET nombre = $1, habitacion = $2 WHERE id = $3',
            [nombre, habitacion, req.params.id]
        );
        res.status(200).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/pacientes/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM pacientes WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TAREAS
app.get('/api/tareas/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, p.nombre as paciente_nombre, p.habitacion as paciente_habitacion
            FROM tareas t
            LEFT JOIN pacientes p ON t.paciente_id = p.id
            ORDER BY t.fecha_creacion DESC
        `);
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tareas/categoria/:categoria', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, p.nombre as paciente_nombre, p.habitacion as paciente_habitacion
            FROM tareas t
            JOIN pacientes p ON t.paciente_id = p.id
            WHERE t.categoria = $1 AND t.estado = 'en curso'
            ORDER BY t.fecha_creacion DESC
        `, [req.params.categoria]);
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

app.put('/api/tareas/:id/estado', async (req, res) => {
    try {
        await pool.query(
            'UPDATE tareas SET estado = $1 WHERE id = $2',
            [req.body.estado, req.params.id]
        );
        res.status(200).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Ruta final para SPA (Single Page App)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Iniciar servidor ===
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
    createTables();
});
