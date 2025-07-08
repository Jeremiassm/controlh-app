// server.js - VERSIÓN CORRECTA PARA TRABAJAR EN TU COMPUTADORA (USA SQLITE)

// 1. Importaciones
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 2. Configuración inicial
const app = express();
const PORT = 3000;

// 3. Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4. Base de Datos (SQLite)
const dbPath = path.join(__dirname, 'controlh.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al abrir la base de datos", err.message);
    } else {
        console.log('Conectado a la base de datos SQLite: controlh.db');
        db.serialize(() => {
            db.run("PRAGMA foreign_keys = ON;");
            db.run(`CREATE TABLE IF NOT EXISTS pacientes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              nombre TEXT NOT NULL UNIQUE,
              habitacion TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS tareas (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              descripcion TEXT NOT NULL,
              categoria TEXT NOT NULL,
              estado TEXT DEFAULT 'en curso',
              fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
              paciente_id INTEGER,
              FOREIGN KEY (paciente_id) REFERENCES pacientes (id) ON DELETE SET NULL
            )`);
        });
    }
});

// =======================================================
// 5. RUTAS DE LA API
// =======================================================

// --- PACIENTES ---
app.get('/api/pacientes', (req, res) => {
    db.all("SELECT * FROM pacientes ORDER BY nombre", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.get('/api/pacientes/:id', (req, res) => {
    db.get("SELECT * FROM pacientes WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: row });
    });
});

app.post('/api/pacientes', (req, res) => {
    const { nombre, habitacion } = req.body;
    db.run(`INSERT INTO pacientes (nombre, habitacion) VALUES (?, ?)`, [nombre, habitacion], function(err) {
        if (err) return res.status(400).json({ error: "El paciente ya existe." });
        res.status(201).json({ id: this.lastID });
    });
});

// --- TAREAS ---
app.get('/api/tareas/all', (req, res) => {
    const sql = `SELECT t.*, p.nombre as paciente_nombre 
                 FROM tareas t LEFT JOIN pacientes p ON t.paciente_id = p.id ORDER BY t.fecha_creacion DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/tareas', (req, res) => {
    const { descripcion, categoria, paciente_id } = req.body;
    db.run(`INSERT INTO tareas (descripcion, categoria, paciente_id) VALUES (?, ?, ?)`, [descripcion, categoria, paciente_id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
});

app.put('/api/tareas/:id/estado', (req, res) => {
    const { estado } = req.body;
    db.run(`UPDATE tareas SET estado = ? WHERE id = ?`, [estado, req.params.id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Estado de la tarea actualizado" });
    });
});

// --- CATEGORÍAS ---
app.get('/api/tareas/categoria/:categoria', (req, res) => {
    const sql = `SELECT t.*, p.nombre as paciente_nombre, p.habitacion as paciente_habitacion 
                 FROM tareas t LEFT JOIN pacientes p ON t.paciente_id = p.id 
                 WHERE t.categoria = ? AND t.estado = 'en curso'`;
    db.all(sql, [req.params.categoria], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// 6. Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor de ControlH corriendo en http://localhost:${PORT}`);
});