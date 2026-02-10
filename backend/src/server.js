const express = require('express');
const cors = require('cors');
const axios = require('axios'); 

const pool = require('./config/db');

const clientesRoutes = require('./routes/clientes.routes');
const aeropuertosRoutes = require('./routes/aeropuertos.routes');
const categoriasOperacionesRoutes = require('./routes/categorias_operaciones.routes');
const fbosRoutes = require('./routes/fbos.routes');
const serviciosRoutes = require('./routes/servicios.routes');
const aeronavesModelosRoutes = require('./routes/aeronaves_modelos.routes');
const clientesAeronavesRoutes = require('./routes/clientes_aeronaves.routes');
const cotizacionesHistoricoRoutes = require('./routes/cotizaciones_historico.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const tarifasRafMtowRoutes = require('./routes/tarifas_raf_mtow.routes');


const corsOptions = require('./config/cors');

const app = express();
const port = process.env.PORT || 3000;

// Habilitar CORS con las opciones configuradas
app.use(cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json());


// Rutas de la API
app.use('/api', clientesRoutes);
app.use('/api', aeropuertosRoutes);
app.use('/api', categoriasOperacionesRoutes);
app.use('/api', fbosRoutes);
app.use('/api', serviciosRoutes);
app.use('/api', aeronavesModelosRoutes);
app.use('/api', clientesAeronavesRoutes);
app.use('/api', cotizacionesHistoricoRoutes);
app.use('/api', usuariosRoutes);
app.use('/api', tarifasRafMtowRoutes);

// ----- CACHÉ EN MEMORIA -----
let cacheTipoCambio = {
    fecha: null,
    valor: null,
    timestamp: null 
};

app.get('/api/tipo-de-cambio', async (req, res) => {
    const token = process.env.BANXICO_TOKEN || '069c2abcc766a1ecd1b91604ad1c08da08a5cb734c0bf8188550ee85937b14ee';
    const idSerie = 'SF43718'; 
    const ahora = new Date();

    // ===== 1. REVISAR SI HAY CACHÉ VÁLIDO =====
    if (cacheTipoCambio.fecha && cacheTipoCambio.valor) {
        const cacheEsDeHoy =
            cacheTipoCambio.timestamp &&
            new Date(cacheTipoCambio.timestamp).toDateString() === ahora.toDateString();

        if (cacheEsDeHoy) {
            return res.json({
                fromCache: true,
                fecha: cacheTipoCambio.fecha,
                tipoDeCambio: cacheTipoCambio.valor
            });
        }
    }

    // ===== 2. FUNCIONES DE FECHA =====
    const restarDiaHabil = (fecha) => {
        fecha.setDate(fecha.getDate() - 1);
        const dia = fecha.getDay();

        if (dia === 0) fecha.setDate(fecha.getDate() - 2);
        if (dia === 6) fecha.setDate(fecha.getDate() - 1);

        return fecha;
    };

    const formatearFecha = (f) =>
        `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

    const consultarBanxico = async (fechaStr) => {
        const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${idSerie}/datos/${fechaStr}/${fechaStr}?token=${token}`;
        try {
            const response = await axios.get(url);
            const datos = response.data?.bmx?.series?.[0]?.datos;
            if (datos && datos.length > 0) return datos[0].dato;
            return null;
        } catch {
            return null;
        }
    };

    // ===== 3. BUSCAR ÚLTIMO DÍA HÁBIL =====
    let fecha = restarDiaHabil(new Date());
    let fechaFormateada = formatearFecha(fecha);
    let tipoDeCambio = await consultarBanxico(fechaFormateada);

    let intentos = 0;
    while (!tipoDeCambio && intentos < 10) {
        fecha = restarDiaHabil(fecha);
        fechaFormateada = formatearFecha(fecha);
        tipoDeCambio = await consultarBanxico(fechaFormateada);
        intentos++;
    }

    // ===== 4. FALLBACK =====
    if (!tipoDeCambio) {
        if (cacheTipoCambio.valor) {
            // USAR ÚLTIMO VALOR VÁLIDO
            return res.json({
                fromCache: true,
                advertencia: 'No se pudo obtener datos recientes de Banxico, usando último valor válido.',
                fecha: cacheTipoCambio.fecha,
                tipoDeCambio: cacheTipoCambio.valor
            });
        }

        // SI NO HAY CACHÉ, DEVOLVER VALOR POR DEFECTO
        return res.json({
            fromCache: false,
            advertencia: 'No se pudo obtener datos y no hay valores en caché.',
            tipoDeCambio: "NO DISPONIBLE"
        });
    }

    // ===== 5. GUARDAR EN CACHÉ =====
    cacheTipoCambio = {
        fecha: fechaFormateada,
        valor: tipoDeCambio,
        timestamp: new Date()
    };

    return res.json({
        fromCache: false,
        fecha: fechaFormateada,
        tipoDeCambio
    });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
