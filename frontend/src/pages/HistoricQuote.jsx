import { useState, useEffect } from 'react';
import HistoricHeader from '../components/historic/HistoricHeader';
import HistoricTable from '../components/historic/HistoricTable';
import ConfirmationModal, { ExclamationTriangleIcon } from '../components/modals/ConfirmationModal';
import api from '../services/api';

export default function HistoricoCotizaciones({ onNavigateNewQuote, onPreviewQuote, onNavigateToDeleted }) {
    const [quotes, setQuotes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAirport, setSelectedAirport] = useState('');
    const [selectedAircraft, setSelectedAircraft] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedQuoteIds, setSelectedQuoteIds] = useState([]);
    const [isJoining, setIsJoining] = useState(false);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [quoteToDelete, setQuoteToDelete] = useState(null);

    const fetchQuotes = () => {
        api.get('/listar/cotizaciones')
            .then(response => setQuotes(response.data))
            .catch(error => console.error('Error fetching quotes:', error));
    };

    useEffect(() => {
        fetchQuotes();
    }, []);

    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
    };

    const airports = [...new Set(quotes.map(quote => quote.icao_aeropuerto))].filter(Boolean).sort();
    const aircrafts = [...new Set(quotes.map(quote => quote.matricula_aeronave))].filter(Boolean).sort();
    // FIX: Usar 'fecha_creacion' para obtener los años correctamente.
    const years = [...new Set(quotes.map(quote => new Date(quote.fecha_creacion).getFullYear()))].filter(Boolean).sort((a, b) => b - a);
    const customers = [...new Set(quotes.map(quote => quote.nombre_cliente))].filter(Boolean).sort();
    const models = [...new Set(quotes.map(quote => quote.icao_aeronave))].filter(Boolean).sort();

    // Esta función ahora solo abre el modal de confirmación
    const handleDeleteQuote = (id) => {
        const quoteFound = quotes.find(q => q.id_cotizacion === id);
        setQuoteToDelete(quoteFound); // Guardamos el objeto completo de la cotización
        setIsDeleteModalOpen(true);
    };

    // Esta nueva función contiene la lógica para eliminar, se ejecuta al confirmar en el modal
    const confirmDeleteQuote = async () => {
        if (!quoteToDelete) return;
        
        const idToDelete = quoteToDelete.id_cotizacion; // Obtenemos el ID del objeto guardado

        try {
            // Usamos api.put en lugar de fetch
            const response = await api.put(`/eliminar/cotizacion/${idToDelete}`);
            if (response.status === 200) {
                 fetchQuotes();
            }
        } catch (error) {
            console.error('Error deleting quote:', error);
        } finally {
            setIsDeleteModalOpen(false);
            setQuoteToDelete(null);
        }
    };

    const filteredQuotes = quotes.filter(quote => {
        const searchTermLower = searchTerm.toLowerCase();
        // FIX: Usar 'fecha_creacion' para filtrar por año.
        const quoteYear = new Date(quote.fecha_creacion).getFullYear();
    
        // FIX: Formatear las fechas como se muestran en la tabla para que la búsqueda coincida.
        const formattedCreationDate = new Date(quote.fecha_creacion).toLocaleString(undefined, {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }).toLowerCase();
    
        const arrivalDate = quote.fecha_llegada ? new Date(quote.fecha_llegada).toLocaleDateString() : null;
        const departureDate = quote.fecha_salida ? new Date(quote.fecha_salida).toLocaleDateString() : null;
        let formattedOperationDate = 'n/a';
        if (arrivalDate && departureDate) {
            formattedOperationDate = arrivalDate === departureDate ? arrivalDate : `${arrivalDate} - ${departureDate}`;
        } else if (arrivalDate) {
            formattedOperationDate = arrivalDate;
        } else if (departureDate) {
            formattedOperationDate = departureDate;
        }
    
        return (
            (selectedAirport ? quote.icao_aeropuerto === selectedAirport : true) &&
            (selectedAircraft ? quote.matricula_aeronave === selectedAircraft : true) &&
            (selectedModel ? quote.icao_aeronave === selectedModel : true) &&
            (selectedYear ? quoteYear === selectedYear : true) &&
            (selectedCustomer ? quote.nombre_cliente === selectedCustomer : true) &&
            (
                (quote.numero_referencia?.toLowerCase() ?? '').includes(searchTermLower) ||
                (formattedCreationDate.includes(searchTermLower)) || // Búsqueda por fecha de creación
                (quote.nombre_cat_operacion?.toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.icao_aeropuerto?.toLowerCase() ?? '').includes(searchTermLower) ||
                (formattedOperationDate.includes(searchTermLower)) || // Búsqueda por fecha de operación
                (quote.matricula_aeronave?.toString().toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.icao_aeronave?.toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.nombre_cliente?.toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.total_final?.toString().toLowerCase() ?? '').includes(searchTermLower)
            )
        );
    });

    const handleToggleQuote = (quoteId) => {
        // La función de actualización de estado ahora maneja la lógica de añadir o quitar.
        // Si el ID ya está, lo filtra (quita). Si no está, lo añade al final.
        // El orden del array `selectedQuoteIds` ahora representa el orden de selección.
        setSelectedQuoteIds(prevIds =>
            prevIds.includes(quoteId)
                ? prevIds.filter(id => id !== quoteId)
                : [...prevIds, quoteId]);
    };

    const handleJoinQuotes = async () => {
        if (selectedQuoteIds.length < 2) {
            alert('Por favor selecciona al menos 2 cotizaciones para unir.');
            return;
        }

        setIsJoining(true);
        try {
            // Usamos api.post
            const response = await api.post('/cotizaciones/join', { ids: selectedQuoteIds });
            
            if (response.status !== 201 && response.status !== 200) {
                throw new Error(data.error || 'Error al unir las cotizaciones');
            }

            // Recargar las cotizaciones para mostrar la nueva cotización unida
            await fetchQuotes();
            // Limpiar selección
            setSelectedQuoteIds([]);
            alert('Cotizaciones unidas exitosamente.');
        } catch (error) {
            console.error('Error joining quotes:', error);
            alert(error.message || 'Error al unir las cotizaciones. Por favor verifica que todas las cotizaciones seleccionadas tengan el mismo cliente y la misma matrícula de aeronave.');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="bg-blue-dark p-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <HistoricHeader
                    onNavigateNewQuote={onNavigateNewQuote}
                    onNavigateToDeleted={onNavigateToDeleted} // Pasamos la nueva función de navegación
                    searchTerm={searchTerm}
                    handleSearch={handleSearch}
                    airports={airports}
                    aircrafts={aircrafts}
                    years={years}
                    customers={customers}
                    models={models}
                    selectedAirport={selectedAirport}
                    setSelectedAirport={setSelectedAirport}
                    selectedAircraft={selectedAircraft}
                    setSelectedAircraft={setSelectedAircraft}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                    selectedCustomer={selectedCustomer}
                    setSelectedCustomer={setSelectedCustomer}
                    onJoinQuotes={handleJoinQuotes}
                    selectedQuoteIds={selectedQuoteIds}
                    isJoining={isJoining}
                />
                <HistoricTable 
                    quotes={filteredQuotes} 
                    onPreviewQuote={onPreviewQuote} onDeleteQuote={handleDeleteQuote}
                    selectedQuoteIds={selectedQuoteIds}
                    onToggleQuote={handleToggleQuote}
                />
                
                <ConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={confirmDeleteQuote}
                    title="Delete Quote"
                    icon={ExclamationTriangleIcon}
                    iconBgColorClass="bg-red-100"
                    iconColorClass="text-red-600"
                >
                    <div className="mt-2">
                        <p className="text-lg text-gray-500">
                            Are you sure you want to delete quote
                            <span className="font-bold text-gray-900"> {quoteToDelete?.numero_referencia || 'selected'}</span>?
                        </p>
                        <p className="text-base text-gray-500 mt-1 text-center">
                            This action cannot be undone.
                        </p>
                    </div>
                </ConfirmationModal>
            </div>
        </div>
    );
} 