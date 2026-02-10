import axios from 'axios';

// En Vite, las variables de entorno se acceden con import.meta.env
// Si VITE_API_URL existe (Azure), la usa. Si no (Local), usa localhost.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: baseURL,
});

export default api;