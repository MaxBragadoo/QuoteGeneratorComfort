import { useState, useEffect, useMemo } from 'react';
import CotizacionNueva from './pages/NewQuote.jsx';
import Catalogos from './pages/Catalogos.jsx';
import HistoricoCotizaciones from './pages/HistoricQuote.jsx';
import DeletedQuotes from './pages/DeletedQuotes.jsx';
import Login from './pages/Login.jsx';
import '../index.css';
import RAFLogoBlanco from './assets/RafLogoBlanco.png';
import api from './services/api';

const HeaderClock = ({ userName }) => {
    const [dateState, setDateState] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setDateState(new Date()), 1000); 
        return () => clearInterval(timer);
    }, []);

    // Formateo de fecha y hora
    const formattedData = useMemo(() => {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        
        const day = dateState.getDate();
        const month = months[dateState.getMonth()];
        const year = dateState.getFullYear();

        // Helper para agregar ceros (09:05 en vez de 9:5)
        const pad = (n) => n < 10 ? '0' + n : n;

        const utcHours = pad(dateState.getUTCHours());
        const utcMinutes = pad(dateState.getUTCMinutes());
        
        const localHours = pad(dateState.getHours());
        const localMinutes = pad(dateState.getMinutes());

        return {
            date: `${month} ${day}/${year}`,
            utc: `${utcHours}:${utcMinutes}`,
            lc: `${localHours}:${localMinutes}`
        };
    }, [dateState]);

    return (
        <h1 className="text-s font-bold text-slate-200">
            Welcome {userName || 'User'} {formattedData.date} UTC: {formattedData.utc} | LC: {formattedData.lc}
        </h1>
    );
};

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentPage, setCurrentPage] = useState('historico');
    const [previewingQuote, setPreviewingQuote] = useState(null);

    const [currentUser, setCurrentUser] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('username');

        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setIsAuthenticated(true);
            if (savedUser) setCurrentUser(savedUser);
        }
    }, []);

    const handleLogin = (usernameFromLogin) => {
        setIsAuthenticated(true);
        setCurrentUser(usernameFromLogin);
        setCurrentPage('historico');
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username'); // Borramos usuario al salir
        delete api.defaults.headers.common['Authorization'];
        setIsAuthenticated(false);
        setCurrentUser(''); // Limpiamos estado
    };

    const handleCloneQuote = (quoteDataToClone) => {
        setPreviewingQuote({ ...quoteDataToClone, id_cotizacion: null, isClone: true });
        setCurrentPage('cotizacion');
    };

    const handlePreviewQuote = (quote) => {
        setPreviewingQuote(quote);
        setCurrentPage('cotizacion');
    };

    const handleNavigateToHistorico = () => {
        setPreviewingQuote(null);
        setCurrentPage('historico');
    };

    const handleNavigateNewQuote = () => {
        setPreviewingQuote(null);
        setCurrentPage('cotizacion');
    };

    const handleNavigateToDeleted = () => {
        setCurrentPage('historico-eliminadas');
    };

    const handleNavigateToActive = () => {
        setCurrentPage('historico');
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'cotizacion':
                return <CotizacionNueva onNavigateToHistorico={handleNavigateToHistorico} previewingQuote={previewingQuote} onCloneQuote={handleCloneQuote} />;
            case 'catalogos':
                return <Catalogos />;
            case 'historico-eliminadas':
                return <DeletedQuotes onNavigateToActive={handleNavigateToActive} onPreviewQuote={handlePreviewQuote} />;
            case 'historico':
                return <HistoricoCotizaciones onNavigateNewQuote={handleNavigateNewQuote} onPreviewQuote={handlePreviewQuote} onNavigateToDeleted={handleNavigateToDeleted} />;
            default:
                return <HistoricoCotizaciones onNavigateNewQuote={handleNavigateNewQuote} onPreviewQuote={handlePreviewQuote} onNavigateToDeleted={handleNavigateToDeleted} />;
        }
    };

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navegación */}
            <nav className="bg-sky-950 shadow-sm border-b">
                <div className="mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-12 items-center">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center space-x-10">
                                <img
                                    alt="RAF International Ground Support Logo"
                                    src={RAFLogoBlanco}
                                    className="h-10 w-auto object-contain"
                                />
                                <HeaderClock userName={currentUser}/>
                            </div>
                        </div>
                        <div className="flex items-center space-x-8">
                            <button
                                onClick={() => setCurrentPage('historico')}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${currentPage === 'historico'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'text-gray-500 hover:text-gray-700'
                                    } cursor-pointer`}
                            >
                                Historical
                            </button>
                            {/*
                            <button
                                onClick={() => setCurrentPage('catalogos')}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${currentPage === 'catalogos'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'text-gray-500 hover:text-gray-700'
                                    } cursor-pointer`}
                            >
                                Catalogs
                            </button>
                            */}
                            <button
                                onClick={handleNavigateNewQuote}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${currentPage === 'cotizacion'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'text-gray-500 hover:text-gray-700'
                                    } cursor-pointer`}
                            >
                                New Quote
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-100 cursor-pointer"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            {/* Contenido de la página */}
            <main className="w-full">
                {renderPage()}
            </main>
        </div>
        
    );
}