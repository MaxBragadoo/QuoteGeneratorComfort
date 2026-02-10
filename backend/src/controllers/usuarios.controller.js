const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Iniciar sesión
const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // Buscar usuario por username
        const userResult = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Usuario y/o contraseña incorrecta' }); // Se muestra un mensaje genérico para no revelar que el usuario no existe  
        }

        const user = userResult.rows[0];

        // Verificar si el usuario está activo
        if (!user.esta_activo) {
            return res.status(403).json({ message: 'El usuario está inactivo' });
        }

        // Comparar contraseñas
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Usuario y/o contraseña incorrecta' });
        }

        // Generar token JWT
        const payload = {
            id: user.id_usuario,
            username: user.username,
            rol: user.rol,
        };

        if (!process.env.JWT_SECRET) {
            console.error('❌ ERROR CRÍTICO: Falta la variable JWT_SECRET en Azure.');
            return res.status(500).json({ message: 'Error de configuración del servidor' });
        }

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '1h', // El token expira en 1 hora
        });

        res.json({
            message: 'Inicio de sesión exitoso',
            token,
            user: {
                id: user.id_usuario,
                username: user.username,
                rol: user.rol,
            },
        });
    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// Crear un nuevo usuario (opcional, para desarrollo)
const registerUser = async (req, res) => {
    const { username, password, rol } = req.body;

    try {
        // Verificar si el usuario ya existe
        const userExists = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'El nombre de usuario ya existe' });
        }

        // Hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Insertar nuevo usuario
        const newUser = await pool.query(
            'INSERT INTO usuarios (username, password_hash, rol) VALUES ($1, $2, $3) RETURNING id_usuario, username, rol',
            [username, password_hash, rol || 'user']
        );

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: newUser.rows[0],
        });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

module.exports = {
    login,
    registerUser,
};
