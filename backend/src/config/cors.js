const whitelist = ['http://localhost:5173', 'http://127.0.0.1:5173'];

if (process.env.FRONTEND_URL) {
  // Eliminamos la barra final '/' si existe para asegurar coincidencia exacta con el Origin
  const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, "");
  whitelist.push(frontendUrl);
}

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};

module.exports = corsOptions;
