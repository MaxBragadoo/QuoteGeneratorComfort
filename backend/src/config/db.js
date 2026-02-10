const path = require('path');
// Explicitly point to the .env file in the 'backend' directory
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

const { Pool } = require('pg');

const config = {
  connectionString: process.env.DATABASE_URL,
};

if (process.env.NODE_ENV === 'production') {
  config.ssl = { rejectUnauthorized: false }; // Requerido para Azure PostgreSQL
  console.log('🔒 SSL habilitado para conexión a base de datos (Modo Producción)');
}

const pool = new Pool(config);

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error al conectar con PostgreSQL', err.stack);
  } else {
    console.log('✅ Conectado a PostgreSQL exitosamente.');
  }
});

module.exports = pool;