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
        await client.query(`CREATE TABLE IF NOT EXISTS pacientes (...)`);
        await client.query(`CREATE TABLE IF NOT EXISTS tareas (...)`);
        console.log("Tablas de PostgreSQL verificadas.");
    } catch (err) {
        console.error("Error al crear las tablas:", err);
    } finally {
        client.release();
}
};

// 5. Middlewares
app.use(express.json());

// Middleware de Autenticación CORREGIDO
app.use(basicAuth({
    authorizer: (username, password) => {
        // Obtenemos las credenciales de las variables de entorno.
        // Si no existen, usamos valores por defecto para evitar el 'undefined'.
        const envUser = process.env.ADMIN_USERNAME || 'admin';
        const envPass = process.env.ADMIN_PASSWORD || 'password';
        
        // Comparamos de forma segura
        const userMatches = basicAuth.safeCompare(username, envUser);
        const passwordMatches = basicAuth.safeCompare(password, envPass);
        
        return userMatches && passwordMatches;
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