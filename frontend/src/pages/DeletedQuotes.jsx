import { useState, useEffect } from 'react';
import HistoricHeader from '../components/historic/HistoricHeader.jsx';
import HistoricTable from '../components/historic/HistoricTable.jsx';
import api from '../services/api';

export default function DeletedQuotes({ onNavigateToActive, onPreviewQuote }) {
    const [quotes, setQuotes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAirport, setSelectedAirport] = useState('');
    const [selectedAircraft, setSelectedAircraft] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedModel, setSelectedModel] = useState('');

    const fetchDeletedQuotes = () => {
        api.get('/listar/cotizaciones-eliminadas')
            .then(response => setQuotes(response.data))
            .catch(error => console.error('Error fetching deleted quotes:', error));
    };

    useEffect(() => {
        fetchDeletedQuotes();
    }, []);

    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
    };

    const airports = [...new Set(quotes.map(quote => quote.icao_aeropuerto))].filter(Boolean).sort();
    const aircrafts = [...new Set(quotes.map(quote => quote.matricula_aeronave))].filter(Boolean).sort();
    const years = [...new Set(quotes.map(quote => new Date(quote.fecha_creacion).getFullYear()))].filter(Boolean).sort((a, b) => b - a);
    const customers = [...new Set(quotes.map(quote => quote.nombre_cliente))].filter(Boolean).sort();
    const models = [...new Set(quotes.map(quote => quote.icao_aeronave))].filter(Boolean).sort();

    const filteredQuotes = quotes.filter(quote => {
        const searchTermLower = searchTerm.toLowerCase();
        const quoteYear = new Date(quote.fecha_creacion).getFullYear();
        const formattedCreationDate = new Date(quote.fecha_creacion).toLocaleString().toLowerCase();

        return (
            (selectedAirport ? quote.icao_aeropuerto === selectedAirport : true) &&
            (selectedAircraft ? quote.matricula_aeronave === selectedAircraft : true) &&
            (selectedModel ? quote.icao_aeronave === selectedModel : true) &&
            (selectedYear ? quoteYear === selectedYear : true) &&
            (selectedCustomer ? quote.nombre_cliente === selectedCustomer : true) &&
            (
                (quote.numero_referencia?.toLowerCase() ?? '').includes(searchTermLower) ||
                (formattedCreationDate.includes(searchTermLower)) ||
                (quote.nombre_cat_operacion?.toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.icao_aeropuerto?.toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.matricula_aeronave?.toString().toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.icao_aeronave?.toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.nombre_cliente?.toLowerCase() ?? '').includes(searchTermLower) ||
                (quote.total_final?.toString().toLowerCase() ?? '').includes(searchTermLower)
            )
        );
    });

    return (
        <div className="bg-blue-dark p-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <HistoricHeader
                    isDeletedView={true} // Prop para indicar que es la vista de eliminados
                    onNavigateToActive={onNavigateToActive}
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
                />
                <HistoricTable 
                    quotes={filteredQuotes} 
                    onPreviewQuote={onPreviewQuote}
                    showPreview={true}
                    showDelete={false}
                />
            </div>
        </div>
    );
}
