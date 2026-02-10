import React, { useEffect, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import api from '../../services/api';
import { jwtDecode } from 'jwt-decode';

import Calculator from '../features/Calculator.jsx';


const QuoteForm = forwardRef(({ onAddItem, onOpenServiceModal, onSelectionChange, exchangeRate, onExchangeRateChange, isReadOnly, onDataLoaded, globalNoSc, globalNoVat, onGlobalNoScChange, onGlobalNoVatChange, onCaaChange, onMtowChange, onCategoryFeeChange, onClassificationChange, onFlightTypeChange, onCustomerChange }, ref) => {
    const [clientes, setClientes] = useState([]);
    const [aeropuertos, setAeropuertos] = useState([]);
    const [clientesAeronaves, setClientesAeronaves] = useState([]); 

    const [allFbos, setAllFbos] = useState([]);
    const [filteredFbos, setFilteredFbos] = useState([]);
    const [allaeronavesModelos, setAllAeronavesModelos] = useState([]); 
    const [filteredRegistrations, setFilteredRegistrations] = useState([]);
    const [filteredAeronavesModelos, setFilteredAeronavesModelos] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [modelValue, setModelValue] = useState('');
    const [registrationValue, setRegistrationValue] = useState('');
    const [isCaaMember, setIsCaaMember] = useState(false); 

    const [customerValue, setCustomerValue] = useState('');
    const [attnValue, setAttnValue] = useState('');
    const [flightType, setFlightType] = useState('');

    const [selectStation, setSelectStation] = useState('');
    const [fromStation, setFromStation] = useState('');
    const [toStation, setToStation] = useState('');
    const [crewFrom, setCrewFrom] = useState('');
    const [paxFrom, setPaxFrom] = useState('');
    const [crewTo, setCrewTo] = useState('');
    const [paxTo, setPaxTo] = useState('');
    const [quotedBy, setQuotedBy] = useState('');
    const [loggedInUser, setLoggedInUser] = useState('');
    const [fboValue, setFboValue] = useState('');
    const [quoteNumber, setQuoteNumber] = useState(null);

    const [errors, setErrors] = useState({});


    const [categoriasOperaciones, setCategoriasOperaciones] = useState([]);
    const [selectedAirportId, setSelectedAirportId] = useState(null);
    const [selectedFboId, setSelectedFboId] = useState(null);
    const [manualAviationType, setManualAviationType] = useState(''); // Para cuando el aeropuerto no existe en BD

    const [noEta, setNoEta] = useState(false);
    const [noEtd, setNoEtd] = useState(false); // 

    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const separator_label = "─── REST OF MODELS ───";


    
    
    // Ref para decodificar el token una sola vez al montar (similar a exchangeRate)
    const userDecodedRef = useRef(false);
    
    //Fecha y MTOW
        const [date, setDate] = useState('');

        const [etaDate, setEtaDate] = useState('');
        const [etdDate, setEtdDate] = useState('');
        const [mtowValue, setMtowValue] = useState("");
        const [unit, setUnit] = useState("KG");

    useImperativeHandle(ref, () => {

    const validate = (currentExchangeRate) => { // Accept exchangeRate as an argument
        const newErrors = {};
        if (!customerValue.trim()) {
            newErrors.customer = "This field is required";
        }
        if (!flightType.trim()) {
            newErrors.flightType = "This field is required";
        }
        if (!selectStation.trim()) {
            newErrors.station = "This field is required";
        }
        if (!currentExchangeRate || parseFloat(currentExchangeRate) <= 0) { // Use the argument
            newErrors.exchangeRate = "This field is required";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    return {

        clearQuoteNumberOnly() {
            setQuoteNumber(null);
        },

        setQuotedByValue(userName) {
            setQuotedBy(userName);
        },
        validate,
        
        clearAllFields() {
            setQuoteNumber(null);
            setSelectedCustomer(null);
            setModelValue('');
            setRegistrationValue('');
            setMtowValue('');
            setFilteredRegistrations([]);
            setFilteredAeronavesModelos([]);
            setIsCaaMember(false);
            if (onClassificationChange) onClassificationChange(null);
            if (onCaaChange) onCaaChange(false);
            setSelectedAirportId(null);
            setSelectedFboId(null);
            setFilteredFbos([]);
            setManualAviationType(''); // Limpiar aviación manual
            setNoEta(false); 
            setNoEtd(false); 
            setErrors({});
            
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            setDate(formattedDate);
            setEtaDate(formattedDate);
            setEtdDate(formattedDate);

            setCustomerValue('');
            setAttnValue('');
            setFlightType('');
            setSelectStation('');
            setFromStation('');
            setToStation('');
            setCrewFrom('');
            setPaxFrom('');
            setCrewTo('');
            setPaxTo('');
            setFboValue('');
            // Preserva el usuario logueado: restaura quotedBy al usuario autenticado
            if (loggedInUser) {
                setQuotedBy(loggedInUser);
            }
      
        },

        setFormData(quote, preserveCurrentUser = false) {


            setQuoteNumber(quote.numero_referencia || null);

            const customer = clientes.find(c => c.id_cliente === quote.id_cliente);
            const flightType = categoriasOperaciones.find(c => c.id_cat_operacion === quote.id_cat_operacion);
            const station = aeropuertos.find(a => a.id_aeropuerto === quote.id_aeropuerto);
            const fbo = allFbos.find(f => f.id_fbo === quote.id_fbo);
            const from = aeropuertos.find(a => a.id_aeropuerto === quote.aeropuerto_origen_id);
            const to = aeropuertos.find(a => a.id_aeropuerto === quote.aeropuerto_destino_id);

            

            setCustomerValue(customer ? customer.nombre_cliente : (quote.cliente || ''));            
            setSelectedCustomer(customer || null); 

            setFlightType(flightType ? flightType.nombre_cat_operacion : (quote.cat_operacion || '')); // Fallback texto

            setDate(quote.fecha_cotizacion ? new Date(quote.fecha_cotizacion).toISOString().split('T')[0] : '');
            // Si preserveCurrentUser es true (clonación), mantener quotedBy actual; si no, usar del quote
            if (!preserveCurrentUser) {
                setQuotedBy(quote.nombre_responsable || '');
            }
            setAttnValue(quote.nombre_solicitante || '');

            setSelectStation(station ? station.icao_aeropuerto : (quote.aeropuerto || '')); 
            setSelectedAirportId(station ? station.id_aeropuerto : null);
            
            if (station) {
                const fbosForAirport = allFbos.filter(f => f.id_aeropuerto === station.id_aeropuerto);
                setFilteredFbos(fbosForAirport);
                setManualAviationType(''); // Limpiar aviación manual si hay estación
            } else if (quote.aeropuerto) { // El aeropuerto es manual (no está en la BD)
                setFilteredFbos([]); // No hay FBOs para un aeropuerto manual
                // Si el FBO guardado es un tipo de aviación, lo seleccionamos en el dropdown
                if (quote.fbo === 'Aviación General' || quote.fbo === 'Aviación Comercial') {
                    setManualAviationType(quote.fbo);
                } else {
                    setManualAviationType('');
                }
            }

            const isMember = !!quote.es_miembro_caa;
            setIsCaaMember(isMember);
            if (onCaaChange) onCaaChange(isMember);

            setNoEta(quote.fecha_llegada === null);
            setEtaDate(quote.fecha_llegada ? new Date(quote.fecha_llegada).toISOString().split('T')[0] : '');

            
            setFromStation(from ? from.icao_aeropuerto : (quote.aeropuerto_origen || ''));

            setToStation(to ? to.icao_aeropuerto : (quote.aeropuerto_destino || ''));


            setCrewFrom(quote.tripulacion_llegada || '');
            setPaxFrom(quote.pasajeros_llegada || '');

            setFboValue(fbo ? fbo.nombre_fbo : (quote.fbo || ''));
            setSelectedFboId(fbo ? fbo.id_fbo : null);

            // Si la fecha es null, marca el checkbox y limpia el campo de fecha.
            setNoEtd(quote.fecha_salida === null);
            setEtdDate(quote.fecha_salida ? new Date(quote.fecha_salida).toISOString().split('T')[0] : '');

            setCrewTo(quote.tripulacion_salida || '');
            setPaxTo(quote.pasajeros_salida || '');

            // Handle aircraft model and registration

            const aircraft = clientesAeronaves.find(a => a.id_cliente_aeronave === quote.id_cliente_aeronave);
                if (aircraft) {
                    const model = allaeronavesModelos.find(m => m.id_modelo_aeronave === aircraft.id_modelo_aeronave);
                    setModelValue(model ? model.icao_aeronave : '');
                    if (model && onClassificationChange) onClassificationChange(model.id_clasificacion);
                    setRegistrationValue(aircraft.matricula_aeronave || (quote.matricula_aeronave || ''));
                    // FIX: Priorizar el MTOW guardado en la cotización (snapshot).
                    // Si no existe, usar el del catálogo como fallback.
                    setMtowValue(quote.mtow || (model ? model.mtow_aeronave : ''));
                    setUnit(quote.mtow_unit || 'KG');
                } else {
                               
                setRegistrationValue(quote.matricula_aeronave || ''); // Matrícula snapshot
                
                setModelValue(quote.modelo_aeronave || '');         // Modelo snapshot
                setMtowValue(quote.mtow || '');                     // MTOW snapshot
                setUnit(quote.mtow_unit || 'KG');                   // Unit snapshot
                
                // Intentar recuperar clasificación si tenemos el modelo guardado
                if (quote.id_modelo_aeronave) {
                    const model = allaeronavesModelos.find(m => m.id_modelo_aeronave === quote.id_modelo_aeronave);
                    if (model && onClassificationChange) onClassificationChange(model.id_clasificacion);
                }
                

            }


            if (customer) {
                const customerAircraftLinks = clientesAeronaves.filter(
                    registration => registration.id_cliente === customer.id_cliente
                );
                setFilteredRegistrations(customerAircraftLinks);
                
                // Lógica del Separador (Igual que en handleCustomerChange) para mostrar TODOS los modelos
                const customerModelIds = new Set(customerAircraftLinks.map(r => r.id_modelo_aeronave));
                const clientModels = allaeronavesModelos.filter(model => customerModelIds.has(model.id_modelo_aeronave));
                const otherModels = allaeronavesModelos.filter(model => !customerModelIds.has(model.id_modelo_aeronave));

                if (clientModels.length > 0 && otherModels.length > 0) {
                    const separatorObj = { id_modelo_aeronave: 'separator-id-load', icao_aeronave: separator_label };
                    setFilteredAeronavesModelos([...clientModels, separatorObj, ...otherModels]);
                } else {
                    setFilteredAeronavesModelos(allaeronavesModelos);
                }
            }

                else {
        // Si no hay cliente (es manual), permitimos ver todos los modelos 
        // y vaciamos las matrículas filtradas (porque es manual)
        setFilteredRegistrations([]);
        setFilteredAeronavesModelos(allaeronavesModelos);
    }

                
            
            
        
    },
    
        //Guardar el formulario
        getFormData() { 
            const selectedFlightType = categoriasOperaciones.find(cat => cat.nombre_cat_operacion === flightType);
            // FIX: Buscar en la lista completa de aeronaves (`clientesAeronaves`) en lugar de solo en la lista filtrada.
            // Esto asegura que siempre encontremos el ID si la matrícula existe, previniendo el envío de `null`.
            const selectedRegistration = clientesAeronaves.find(reg => reg.matricula_aeronave === registrationValue);

            // FIX: Buscar en la lista completa de modelos para asegurar que encontramos el ID
            // incluso si el cliente es nuevo y la lista filtrada está mostrando todos los modelos.
            const selectedAircraftModel = allaeronavesModelos.find(model => model.icao_aeronave === modelValue);
            const fromAirport = aeropuertos.find(a => a.icao_aeropuerto === fromStation);
            const toAirport = aeropuertos.find(a => a.icao_aeropuerto === toStation);
            const stationAirport = aeropuertos.find(a => a.id_aeropuerto === selectedAirportId);
            const fbo = allFbos.find(f => f.id_fbo === selectedFboId);

            return {
                quoteNumber: quoteNumber, // Ensure quoteNumber is always passed
                // Existing fields for saving
                customer: selectedCustomer ? selectedCustomer.id_cliente : null,
                flightType: selectedFlightType ? selectedFlightType.id_cat_operacion : null,
                date: date,
                aircraftModel: selectedRegistration ? selectedRegistration.id_cliente_aeronave : null,
                isCaaMember: isCaaMember,
                mtow: mtowValue,
                mtow_unit: unit,
                quotedBy: quotedBy,
                attn: attnValue,
                station: selectedAirportId,
                eta: noEta ? null : etaDate,
                from: fromAirport ? fromAirport.id_aeropuerto : null,
                crewFrom: crewFrom,
                paxFrom: paxFrom,
                fbo: selectedFboId,
                etd: noEtd ? null : etdDate,
                to: toAirport ? toAirport.id_aeropuerto : null,
                crewTo: crewTo,
                paxTo: paxTo,
                exchangeRate: exchangeRate,

                // New fields for PDF

            // 1. Objetos completos (para obtener IDs fácilmente en el padre)
            selectedCustomer: selectedCustomer,
            selectedModel: selectedRegistration, // Pasamos el objeto de matrícula completo

            // 2. Valores de Texto Crudo (Lo que el usuario escribió)
            // ESTO ES LO QUE TE FALTABA PARA EVITAR "label: undefined"
            customerValue: customerValue,       
            registrationValue: registrationValue,
            aircraftModelId: selectedAircraftModel ? selectedAircraftModel.id_modelo_aeronave : null, // ID del modelo

            // New fields for PDF
            customerName: selectedCustomer ? selectedCustomer.nombre_cliente : customerValue,
            flightTypeName: flightType,
            aircraftModelName: selectedAircraftModel ? selectedAircraftModel.icao_aeronave : modelValue,
            aircraftRegistrationValue: registrationValue, // The string value
            stationName: stationAirport ? stationAirport.icao_aeropuerto : selectStation,
            fromName: fromAirport ? fromAirport.icao_aeropuerto : fromStation,
            fboName: fbo ? fbo.nombre_fbo : fboValue,
            toName: toAirport ? toAirport.icao_aeropuerto : toStation,

            }; 
          },

          //Clonar el formulario
          getAllFormData() {
            return {
                customerValue,
                attnValue,
                flightType,
                date,
                quotedBy,
                selectStation,
                etaDate,
                noEta,
                fromStation,
                crewFrom,
                paxFrom,
                fboValue,
                etdDate,
                noEtd,
                toStation,
                crewTo,
                paxTo,
                registrationValue,
                isCaaMember,
                modelValue,
                mtowValue,
                unit,
                // IDs and complex objects that are also part of the state
                selectedCustomer,
                selectedAirportId,
                selectedFboId,
            }
          }
         };
         
        },[
            isDataLoaded, 
            clientes,
            aeropuertos,
            clientesAeronaves,
            allFbos,
            filteredFbos,

            allaeronavesModelos,
            categoriasOperaciones,
            filteredRegistrations,
            filteredAeronavesModelos,
            selectedCustomer,
            modelValue,
            registrationValue,
            customerValue,
            attnValue,
            flightType,
            selectStation,
            fromStation,
            toStation,
            crewFrom,
            paxFrom,
            crewTo,
            paxTo,
            quotedBy,
            fboValue,
            date,
            etaDate,
            etdDate,
            mtowValue,
            unit,
            isCaaMember,
            noEta,
            errors,
            noEtd,
            selectedAirportId,
            selectedFboId,
            quoteNumber,
            loggedInUser,
            onClassificationChange,
            onCaaChange,
            onMtowChange,
            
        ]
    );

    useEffect(() => {
        // CONSOLIDADO: Decodificar token + Cargar datos iniciales (similar a Exchange Rate)
        // Solo se ejecuta una vez al montar el componente
        
        // 1. Decodificar token y cargar usuario logueado (una sola vez)
        if (!userDecodedRef.current) {
            userDecodedRef.current = true;
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const decodedToken = jwtDecode(token);
                    const userName = decodedToken.username;
                    if (userName && typeof userName === 'string') {
                        setLoggedInUser(userName);
                        setQuotedBy(userName);
                    }
                } catch (error) {
                    console.error("Error decoding token:", error);
                }
            }
        }

        

        // 2. Establecer fechas de hoy
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        setDate(formattedDate);
        setEtaDate(formattedDate);
        setEtdDate(formattedDate);

        // 3. Cargar datos de APIs
        const fetchData = async () => {
            try {
                const [
                    clientesResponse,
                    aeropuertosResponse,
                    categoriasOperacionesResponse,
                    fbosResponse,
                    aeronavesModelosResponse,
                    clientesAeronavesResponse
                ] = await Promise.all([
                    api.get('/listar/clientes'),
                    api.get('/listar/aeropuertos'),
                    api.get('/listar/categoriasOperaciones'),
                    api.get('/listar/fbos'),
                    api.get('/listar/aeronaves_modelos'),
                    api.get('/listar/clientes_aeronaves')
                ]);

                setClientes(clientesResponse.data);
                setAeropuertos(aeropuertosResponse.data);
                setCategoriasOperaciones(categoriasOperacionesResponse.data);
                setAllFbos(fbosResponse.data);
                setAllAeronavesModelos(aeronavesModelosResponse.data);
                setClientesAeronaves(clientesAeronavesResponse.data);

                onSelectionChange(null, null);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsDataLoaded(true);
                if (onDataLoaded) onDataLoaded();
            }
        };

        fetchData();
    }, []);

    // Efecto para sincronizar los checkboxes 'No ETA' y 'No ETD' con sus campos de fecha.
    useEffect(() => {
        if (noEta) {
            setEtaDate(''); // Limpia la fecha si 'No ETA' está marcado
        }
    }, [noEta]);

    useEffect(() => {
        if (noEtd) {
            setEtdDate(''); // Limpia la fecha si 'No ETD' está marcado
        }
    }, [noEtd]);


    // USEEFFECT PARA DETECTAR CAMBIOS EN MTOW O UNIDAD
    const prevMtowValue = useRef(mtowValue);
    const prevUnit = useRef(unit);

    useEffect(() => {
        if (prevMtowValue.current !== mtowValue || prevUnit.current !== unit) {
            if (onMtowChange) {
                // Enviamos el valor crudo y la unidad (KG/LB)
                onMtowChange(mtowValue, unit);
            }
            prevMtowValue.current = mtowValue;
            prevUnit.current = unit;
        }
    }, [mtowValue, unit, onMtowChange]);

  
    // UseEffect para detectar cambios en la categoría de operación (flightType)
    useEffect(() => {
        // Buscamos el objeto completo de la categoría seleccionada
        const selectedCatObj = categoriasOperaciones.find(
            c => c.nombre_cat_operacion === flightType
        );

        // 1. Avisamos de la tarifa (Lógica existente)
        const fee = selectedCatObj ? parseFloat(selectedCatObj.tarifa_land_permit_coord) || 0 : 0;
        if (onCategoryFeeChange) {
            onCategoryFeeChange(fee);
        }

        // 2. NUEVO: Avisamos del ID de la categoría para los precios especiales
        if (onFlightTypeChange) {
            const catId = selectedCatObj ? selectedCatObj.id_cat_operacion : null;
            onFlightTypeChange(catId);
        }

    }, [flightType, categoriasOperaciones, onCategoryFeeChange, onFlightTypeChange]);

    // Cuando se desmarca el checkbox, si no hay fecha, se establece la de hoy.
    const handleNoEtaChange = (e) => {
        setNoEta(e.target.checked);
        if (!e.target.checked && !etaDate) setEtaDate(new Date().toISOString().split('T')[0]);
    };

    const handleNoEtdChange = (e) => {
        setNoEtd(e.target.checked);
        if (!e.target.checked && !etdDate) setEtdDate(new Date().toISOString().split('T')[0]);
    };
           
    //No permite que la fecha de ETA sea posterior a la de ETD
    const handleEtaDateChange = (e) => {
        const newEta = e.target.value;
        setEtaDate(newEta);
        // Si la nueva fecha de llegada es posterior a la de salida, ajusta la de salida.
        if (newEta && etdDate && newEta > etdDate) {
            setEtdDate(newEta);
        }
    };



    const handleStationChange = (event) => {
        const selectedAirportName = event.target.value;
        const selectedAirport = aeropuertos.find(
            (a) => a.icao_aeropuerto === selectedAirportName
        );

        if (selectedAirport) {
            setSelectedAirportId(selectedAirport.id_aeropuerto);
            setFboValue(''); // Clear FBO input text
            setSelectedFboId(null); // Reset FBO ID
            setManualAviationType(''); // Reset aviación manual
            const fbosForAirport = allFbos.filter(fbo => fbo.id_aeropuerto === selectedAirport.id_aeropuerto);
            setFilteredFbos(fbosForAirport);
            onSelectionChange(selectedAirport.id_aeropuerto, null);
        } else {
            // Aeropuerto no encontrado en BD - permitir que el usuario seleccione aviación manualmente
            setSelectedAirportId(null);
            setFboValue(''); // Also clear FBO input when airport is cleared
            setSelectedFboId(null);
            setFilteredFbos([]); // Vacío porque no hay FBOs para este aeropuerto
            setManualAviationType(''); // Reset para que seleccione de nuevo
            onSelectionChange(null, null);
        }
    };

    // Manejo de aviación seleccionada manualmente (cuando aeropuerto no existe en BD)
    const handleManualAviationChange = (event) => {
        const aviationType = event.target.value;
        setManualAviationType(aviationType);
        setFboValue(aviationType); // Sincronizar con fboValue para que se guarde
        // Pasar la aviación manual al padre para categorizar servicios
        onSelectionChange(selectedAirportId, null, aviationType);
    };

    const handleFboChange = (event) => {
        const selectedFboName = event.target.value;
        const selectedFbo = filteredFbos.find(
            (f) => f.nombre_fbo === selectedFboName
        );

        if (selectedFbo) {
            setSelectedFboId(selectedFbo.id_fbo);
            setManualAviationType(''); // Limpiar aviación manual si se selecciona FBO real
            onSelectionChange(selectedAirportId, selectedFbo.id_fbo, selectedFbo.nombre_fbo);
        } else {
            setSelectedFboId(null);
            onSelectionChange(selectedAirportId, null);
        }
    };

    const handleIntegerChange = (setter) => (e) => {
        const value = e.target.value;
        if (/^[0-9]*$/.test(value)) {
            if (value === '') {
                setter('');
                return;
            }
            const num = parseInt(value, 10);
            if (num <= 999) {
                setter(value);
            } else {
                setter('999');
            }
        }
    };


    //Carga ambas listas (modelos y matrículas) filtradas por cliente
    const handleCustomerChange = (event) => {

            const selectedCustomerName = event.target.value;
            
            setCustomerValue(selectedCustomerName);

            // Limpiamos los campos relacionados inmediatamente.
            setSelectedCustomer(null);
            setModelValue('');
            if (onClassificationChange) onClassificationChange(null);
            setRegistrationValue('');
            setMtowValue('');
            setFilteredRegistrations([]);
            setFilteredAeronavesModelos([]);

            //Buscar si el cliente existe en la lista 
            const customer = clientes.find(c => c.nombre_cliente === selectedCustomerName);

            if (customer) {  
                setSelectedCustomer(customer);
                
                if (onCustomerChange) {
                onCustomerChange(customer);
                 }
                // --- Cargar Matrículas del Cliente ---
                const customerAircraftLinks = clientesAeronaves.filter(
                    registration => registration.id_cliente === customer.id_cliente
                );
                
                // Setear TODAS las matrículas de ese cliente 
                setFilteredRegistrations(customerAircraftLinks);

                // 2. Lógica del Separador
                const customerModelIds = new Set(customerAircraftLinks.map(r => r.id_modelo_aeronave));

                const clientModels = allaeronavesModelos.filter(model => customerModelIds.has(model.id_modelo_aeronave));
                const otherModels = allaeronavesModelos.filter(model => !customerModelIds.has(model.id_modelo_aeronave));

                // Solo agregamos el separador si hay diferencia entre las listas
                if (clientModels.length > 0 && otherModels.length > 0) {
                    const separatorObj = { 
                        id_modelo_aeronave: 'separator-id', // ID falso único
                        icao_aeronave: separator_label // El texto que se verá
                    };
                    setFilteredAeronavesModelos([...clientModels, separatorObj, ...otherModels]);
                } else {
                    // Si el cliente no tiene nada, o tiene todo, mostramos todo normal
                    setFilteredAeronavesModelos(allaeronavesModelos);
                }
             
            } else{

                if (onCustomerChange) {
                onCustomerChange(null);
                }

                //El cliente no fue encontrado, es un nombre nuevo.
                // 'selectedCustomer' se queda como null.

                console.log("Cliente NUEVO. Cargando TODOS los modelos.");
                // Cargar TODOS los modelos del universo
                setFilteredAeronavesModelos(allaeronavesModelos);
            }
        };

        //(Flow 1: Cliente -> Modelo -> Matrícula) Se dispara al seleccionar un modelo. Filtra la lista de matrículas.
        const handleModelChange = (event) => {
            
            const selectedIcaoModel = event.target.value;

            // --- GUARDIA DE SEGURIDAD ---
            // Si seleccionan el separador, limpiamos el campo y no hacemos nada más.
            if (selectedIcaoModel === separator_label) {
                setModelValue(''); 
                if (onClassificationChange) onClassificationChange(null);
                return; 
            }
            // ----------------------------

            setModelValue(selectedIcaoModel);

            // Verificamos si la matrícula que está escrita actualmente existe en la base de datos
            const isKnownRegistration = filteredRegistrations.some(
                reg => reg.matricula_aeronave === registrationValue
            );

            if (isKnownRegistration) {
                setRegistrationValue(''); 
            }

            setMtowValue(''); // Reset MTOW on model change
        
            const selectedModel = filteredAeronavesModelos.find(
                (model) => model.icao_aeronave === selectedIcaoModel
            );
        
            if (selectedModel) {

                if (onClassificationChange) onClassificationChange(selectedModel.id_clasificacion);

                if (selectedModel.mtow_aeronave) {
                    setMtowValue(selectedModel.mtow_aeronave);
                    setUnit('KG');
                }

                    //Filtrar matrículas solo si hay un cliente existente seleccionado
                    if (selectedCustomer) {
                        // Filtrar la lista de matrículas para que solo muestre las de este modelo
                        const modelRegistrations = clientesAeronaves.filter(
                            (registration) =>
                                registration.id_modelo_aeronave === selectedModel.id_modelo_aeronave &&
                                registration.id_cliente === selectedCustomer.id_cliente
                        );
                        setFilteredRegistrations(modelRegistrations);
                    }
            } else {
                // Si el modelo no se encuentra (o se borró), limpiamos la clasificación
                // Esto corrige el error donde se quedaba el precio de la categoría anterior (ej. Light Jet)
                if (onClassificationChange) onClassificationChange(null);
                
                if (!selectedIcaoModel) {
                    // Si el campo está vacío, reseteamos la lista de matrículas
                    if (selectedCustomer) {
                        const customerAircraftLinks = clientesAeronaves.filter(
                            registration => registration.id_cliente === selectedCustomer?.id_cliente
                        );
                        setFilteredRegistrations(customerAircraftLinks || []);
                    }
                }
            }
        };

            //(Flow 2: Cliente -> Matrícula -> Modelo) Se dispara al seleccionar una matrícula. Autocompleta el modelo y MTOW.
            const handleRegistrationChange = (event) => {
                const selectedMatricula = event.target.value;

                //Actualiza el valor que el usuario está escribiendo
                setRegistrationValue(selectedMatricula);

               if (selectedMatricula === '') {
                // Limpiamos los campos dependientes para evitar confusiones
                setModelValue('');
                if (onClassificationChange) onClassificationChange(null);
                setMtowValue('');
                setIsCaaMember(false);
                if (onCaaChange) onCaaChange(false);

                // Si hay un cliente seleccionado, RE-CALCULAMOS su lista original de modelos
                if (selectedCustomer) {
                    const allCustomerRegistrations = clientesAeronaves.filter(
                    reg => reg.id_cliente === selectedCustomer.id_cliente
                ); 
                setFilteredRegistrations(allCustomerRegistrations);

                    if (allCustomerRegistrations.length > 0) {

                        const uniqueModelIds = new Set(allCustomerRegistrations.map(r => r.id_modelo_aeronave));
            
                        const clientModels = allaeronavesModelos.filter(model => uniqueModelIds.has(model.id_modelo_aeronave));
                        const otherModels = allaeronavesModelos.filter(model => !uniqueModelIds.has(model.id_modelo_aeronave));


                    if (clientModels.length > 0 && otherModels.length > 0) {
                                    const separatorObj = { 
                                        id_modelo_aeronave: 'separator-id-2', 
                                        icao_aeronave: separator_label 
                                    };
                                    setFilteredAeronavesModelos([...clientModels, separatorObj, ...otherModels]);
                                } else {
                                    setFilteredAeronavesModelos(allaeronavesModelos);
                                }
                            } else {
                                setFilteredAeronavesModelos(allaeronavesModelos);
                            }
                        } else {

                        // Si no hay cliente, mostrar todo el universo
                        setFilteredAeronavesModelos(allaeronavesModelos);
                        setFilteredRegistrations([]);
                    }
                    return; 
                }
                            
                //Solo intenta autocompletar el modelo si el cliente existe
                if (selectedCustomer) {
                   

                    // Buscar la matrícula seleccionada filtrada por cliente
                    // por si el usuario escribe una matrícula sin haber filtrado por modelo.
                    const selectedRegistration = clientesAeronaves.find(
                        reg => reg.matricula_aeronave === selectedMatricula && 
                            reg.id_cliente === selectedCustomer?.id_cliente
                    );

                    //la matricula existe para este cliente
                    if (selectedRegistration) {
                        // Encontrar el modelo correspondiente a esta matrícula
                        const model = allaeronavesModelos.find(
                            m => m.id_modelo_aeronave === selectedRegistration.id_modelo_aeronave
                        );

                        if (model) {
                            // Autocompletar Modelo y MTOW
                            setModelValue(model.icao_aeronave);
                            if (onClassificationChange) onClassificationChange(model.id_clasificacion);
                            
                            if (model.mtow_aeronave) {
                                setMtowValue(model.mtow_aeronave);
                                setUnit('KG');
                            }
                            // Restaurar la lógica para actualizar el estado de CAA Member
                            // basado en la matrícula seleccionada.
                            const isMember = !!selectedRegistration.es_miembro_caa;
                            setIsCaaMember(isMember);
                            if (onCaaChange) onCaaChange(isMember);
                        }
                       
                    }
                    else {
                        setFilteredAeronavesModelos(allaeronavesModelos);
                    }
                }
            };


            const handleInputChange = (e) => {
                let inputValue = e.target.value;

                let cleanedValue = inputValue.replace(/[^0-9.]/g, '');

                const decimalParts = cleanedValue.split('.');
                if (decimalParts.length > 2) {
                    cleanedValue = decimalParts[0] + '.' + decimalParts.slice(1).join('');
                }

                // VALIDACIÓN DE MTOW MÁXIMO
                // El avión más pesado del mundo (Antonov An-225) tenía un MTOW de 640,000 kg.
                // Establecemos un límite seguro de 650,000 kg (aprox 1,433,000 lbs).
                const numericValue = parseFloat(cleanedValue);
                const maxKG = 650000;
                const maxLB = 1433000;

                if (!isNaN(numericValue)) {
                    if (unit === 'KG' && numericValue > maxKG) return;
                    if (unit === 'LB' && numericValue > maxLB) return;
                }
            
                if (cleanedValue === '' || parseFloat(cleanedValue) < 0) {
                    setMtowValue('');
                } else {
                    setMtowValue(cleanedValue);
                }
            };

        const convertToLB = () => {
            const currentValue = parseFloat(mtowValue);
            if (isNaN(currentValue) || currentValue <=0) {
                setMtowValue('');
                return;
            }
            
            if(unit=== "KG") {
                const lbValue = (currentValue * 2.20462).toFixed(2);
                setMtowValue(lbValue);
                setUnit("LB");
                    } else {
                    setUnit("LB")
                }
            };
          
          const convertToKG = () => {
            const currentValue = parseFloat(mtowValue);
            if (isNaN(currentValue) || currentValue <= 0) {
                setMtowValue('');
                return;
            }

            if (unit === "LB") {
              const kgValue = (currentValue / 2.20462).toFixed(2);
              setMtowValue(kgValue);
              setUnit("KG");
                } else {
                    setUnit("KG")
                }
            };

    return (
        <main className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-dark-gray" htmlFor="customer">
                                Select Customer
                            </label>
                            <div className="relative mt-1">
                                <input
                                    list="customer-list"
                                    id="customer"
                                    name="customer"
                                    value = {customerValue}
                                    onChange={(e) => {
                                        setCustomerValue(e.target.value);
                                        handleCustomerChange(e);
                                    }}
                                    className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                    disabled={isReadOnly} style={errors.customer ? { borderColor: 'red' } : {}}
                               />
                                <datalist id="customer-list">
                                    {clientes.map((cliente) => (
                                        <option key={cliente.id_cliente} value={cliente.nombre_cliente} />
                                    ))}
                                </datalist>
                                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <span className="material-icons text-gray-400"></span>
                                </span>
                            </div>
                            {errors.customer && <p className="text-red-500 text-xs mt-1">{errors.customer}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-dark-gray" htmlFor="flight-type">
                                Select Category
                                {/* Category es flight type */}
                            </label>
                            <div className="relative mt-1">
                                <input
                                    list="categoriasOperaciones-list"
                                    id="flight-type"
                                    name="flight-type"
                                    className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                    disabled={isReadOnly} style={errors.flightType ? { borderColor: 'red' } : {}}
                               
                                    value={flightType}
                                    onChange={(e) => setFlightType(e.target.value)}
                                />
                               <datalist id="categoriasOperaciones-list">
                                    {categoriasOperaciones.map((categoriaOp) => (
                                        <option key={categoriaOp.id_cat_operacion} value={categoriaOp.nombre_cat_operacion} />
                                    ))}
                                </datalist>

                                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <span className="material-icons text-gray-400"></span>
                                </span>
                            </div>
                            {errors.flightType && <p className="text-red-500 text-xs mt-1">{errors.flightType}</p>}
                        </div>

                        <div>
                            {quoteNumber && (
                                <>
                                    <div className="mt-0 md:mt-0 flex justify-center">
                                        <div
                                            className="w-auto bg-gradient-to-r from-sky-500 to-cyan-700 text-white font-semibold rounded-md shadow-md px-3 py-2 text-center text-sm tracking-wide"
                                        >
                                            {`#${quoteNumber}`}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-dark-gray" htmlFor="date">
                                Date
                            </label>

                            <div className="relative mt-1">
                                    <input className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed" 
                                           id="date" 
                                           type="date" 
                                           value={date} 
                                           onChange={(e) => setDate(e.target.value)}
                                           disabled={isReadOnly} />
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                        <span className="material-icons text-gray-400"></span>
                                    </span>
                            </div>

   
                        </div>

                       <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">

                           {/* Aircraft Registration (Flow 2)*/}
                        <div>
                            <label className="block text-sm font-medium text-dark-gray" htmlFor="aircraft-registration">
                                Aircraft Registration
                            </label>

                              <input
                                    list="aircraft-registration-list"
                                    className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                    id="aircraft-registration"
                                    type="text"
                                    value={registrationValue}
                                    onChange={handleRegistrationChange}
                                    disabled={isReadOnly}
                                    //disabled={!customerValue}
                                />

                            <datalist id="aircraft-registration-list">
                                {/* Mapea las matrículas filtradas (ya sea por cliente o por modelo) */}
                                    {filteredRegistrations.map((registration) => (
                                        <option key={registration.id_cliente_aeronave} value={registration.matricula_aeronave} />
                                    ))}
                            </datalist>

                            <div className="checkbox-container flex items-center gap-2 mt-1">
                                <input 
                                    id="caa-member" 
                                    type="checkbox" 
                                    checked={isCaaMember}
                                    onChange={(e) => {
                                        setIsCaaMember(e.target.checked);
                                        if (onCaaChange) onCaaChange(e.target.checked);
                                    }}
                                    disabled={isReadOnly}
                                    className='disabled:bg-gray-200 disabled:cursor-not-allowed cursor-pointer'
                                />
                                <label htmlFor="caa-member" className="block text-sm font-medium text-dark-gray">
                                    <a>
                                        Is CAA Member
                                    </a>
                                </label>
                            </div>
                            <a
                                href="https://caa.org/my-dashboard"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-sky-600 underline hover:text-sky-800"
                                >
                                Verify if it is CAA Member
                            </a>
                        </div>
                        
                        {/* Aircraft Model (Flow 1)*/}
                        <div>
                            <label className="block text-sm font-medium text-dark-gray" htmlFor="aircraft-model">
                                Aircraft Model
                            </label>
                            <div className="relative mt-1">
                                <input
                                    list="aircraft-model-list"
                                    id="aircraft-model"
                                    name="aircraft-model"
                                    className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                    onChange={handleModelChange}
                                    value={modelValue}
                                    disabled={isReadOnly}
                                    //disabled={!customerValue}
                                    
                                />
                                 <datalist id="aircraft-model-list">
                                    {/* Mapear los modelos filtrados por CLIENTE */}
                                    {filteredAeronavesModelos.map((model) => (
                                        <option key={model.id_modelo_aeronave} value={model.icao_aeronave} />
                                     ))}
                                </datalist>
                                
                                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <span className="material-icons text-gray-400"></span>
                                </span>
                            </div>
                        </div>
                        

                        {/* Aircraft MTOW */}
                        <div>
                            <label className="block text-sm font-medium text-dark-gray" htmlFor="mtow">
                                Aircraft MTOW
                            </label>
                            <div className="flex items-center mt-1">
                                <input
                                    className="w-full bg-gray-100 border border-gray-300 rounded-l-md shadow-sm pl-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                    id="mtow"
                                    type="number"
                                    value={mtowValue}
                                    step="any"
                                    onChange={handleInputChange}
                                    disabled={isReadOnly}
                                />
                                <div className="flex">
                                    <button
                                        type="button"
                                        className={`px-3 py-2 border-t border-b border-gray-300 text-sm ${unit === "KG" ? "bg-sky-600 text-white" : "bg-white text-dark-gray disabled:cursor-not-allowed cursor-pointer"}`}
                                        onClick={convertToKG}
                                        disabled={isReadOnly}
                                    >
                                        KG
                                    </button>
                                    <button
                                        type="button"
                                        className={`px-3 py-2 border border-gray-300 text-sm rounded-r-md ${unit === "LB" ? "bg-sky-600 text-white" : "bg-white text-dark-gray disabled:cursor-not-allowed cursor-pointer"}`}
                                        onClick={convertToLB}
                                        disabled={isReadOnly}
                                    >
                                        LB
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>


                    
                        <div>
                            {/*Espacio en blanco*/}
                        </div>
                        <div className="self-start">
                            <div>
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="quoted-by">
                                    Quoted by
                                </label>
                                <input className="mt-1 w-full bg-gray-200 border border-gray-300 rounded-md shadow-sm pl-3 py-2 focus:outline-none sm:text-sm cursor-not-allowed" 
                                        id="quoted-by" 
                                        type="text" 
                                        value={quotedBy}
                                        readOnly
                                />
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="attn">
                                    Attn.
                                </label>
                                <input className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed" 
                                       id="attn" 
                                       type="text"  
                                       value={attnValue}
                                       onChange={(e) => setAttnValue(e.target.value)}
                                       disabled={isReadOnly}/>
                            </div>
                        </div>
                        
                       
                       {/* Tercera Fila */}
                        <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                            {/* Select Station */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="select-station">
                                    Select Station
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        list="select-station-list"
                                        id="select-station"
                                        name="select-station"
                                        value = {selectStation}
                                        onChange={(e) => {
                                            setSelectStation(e.target.value);
                                            handleStationChange(e);
                                        }}

                                        className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                        disabled={isReadOnly} style={errors.station ? { borderColor: 'red' } : {}}
                                        

                                   />
                                   <datalist id="select-station-list">
                                        {aeropuertos.map((aeropuerto) => (
                                        <option key={aeropuerto.id_aeropuerto} value={aeropuerto.icao_aeropuerto}/>
                                    ))}
                                    </datalist>

                                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                        <span className="material-icons text-gray-400"></span>
                                    </span>
                                </div>
                                {errors.station && <p className="text-red-500 text-xs mt-1">{errors.station}</p>}
                            </div>

                            {/* ATA */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="eta">
                                    Select ETA
                                </label>
                                <div className="relative mt-1">
                                    <input className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm
                                                       disabled:cursor-not-allowed disabled:text-opacity-70" 
                                           id="eta"                                           
                                           type={noEta ? 'text' : 'date'}
                                           value={etaDate}
                                           placeholder="No ETA Selected"
                                           onChange={handleEtaDateChange}
                                           disabled={noEta || isReadOnly} />
                                </div>
                            </div>

                            {/* ========= INICIO DEL CAMBIO: Grupo flexible para Checkbox y From ========= */}
    {/* Este es el contenedor clave: ocupa 2 columnas y usa flexbox */}
    <div className="md:col-span-2 flex items-end gap-6">
        
        {/* ETA Checkbox - Con tamaño fijo, no se encogerá */}
        <div className="flex-shrink-0 flex items-end pb-2">
            <div className="flex items-center h-5">
                <input id="eta-checkbox" 
                       name="eta-checkbox" 
                       type="checkbox" 
                       className="focus:ring-sky-500 h-4 w-4 text-sky-600 border-gray-300 rounded disabled:bg-gray-200 disabled:cursor-not-allowed cursor-pointer"
                       checked={noEta}
                       onChange={handleNoEtaChange} 
                       disabled={isReadOnly}/>
            </div>
            <div className="ml-2 text-sm">
                <label htmlFor="eta-checkbox" className="font-medium text-dark-gray whitespace-nowrap">No ETA</label>
            </div>
        </div>

        {/* From - Crecerá para ocupar todo el espacio sobrante */}
        <div className="flex-1">
            <label className="block text-sm font-medium text-dark-gray" htmlFor="from-station">
                From
            </label>
            <div className="relative mt-1">
                 <input
                    list="from-station-list"
                    id="from-station"
                    name="station"
                    className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                    value={fromStation}
                    onChange={(e) => setFromStation(e.target.value)}
                    disabled={isReadOnly}
                 />
                   <datalist id="from-station-list">
                                    {aeropuertos.map((aeropuerto) => (
                                        <option key={aeropuerto.id_aeropuerto} value={aeropuerto.icao_aeropuerto} />
                                    ))}
                   </datalist>

                
            </div>
        </div>
    </div>
                            {/* Crew */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="crew-from">
                                    Crew
                                </label>
                                <input className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed" 
                                       id="crew-from" 
                                       type="text" 
                                       inputMode="numeric"
                                       value={crewFrom}
                                       onChange={handleIntegerChange(setCrewFrom)}
                                       disabled={isReadOnly} />
                            </div>

                            {/* Pax */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="pax-from">
                                    Pax
                                </label>
                                <input className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed" 
                                       id="pax-from" 
                                       type="text" 
                                       inputMode="numeric"
                                       value={paxFrom}
                                       onChange={handleIntegerChange(setPaxFrom)}
                                       disabled={isReadOnly}
                                       />
                            </div>
                        </div>

                        {/* Cuarta Fila */}
                        <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-dark-gray" htmlFor="fbo">
                                Select Aviation Type
                            </label>

                            {/* Mostrar select si no hay FBOs (aeropuerto no existe en BD) */}
                            {filteredFbos.length === 0 && selectedAirportId === null ? (
                                <div className="relative mt-1">
                                    <select
                                        id="fbo-select"
                                        className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                        value={manualAviationType}
                                        onChange={handleManualAviationChange}
                                        disabled={isReadOnly}
                                    >
                                        <option value="">-- Select Type --</option>
                                        <option value="Aviación General">Aviación General</option>
                                        <option value="Aviación Comercial">Aviación Comercial</option>
                                    </select>
                                </div>
                            ) : (
                                /* Mostrar datalist si hay FBOs disponibles (aeropuerto existe en BD) */
                                <div className="relative mt-1">
                                    <input
                                        list="fbo-list"
                                        id="fbo"
                                        name="fbo"
                                        className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                        value={fboValue}
                                        onChange={(e) => {
                                            setFboValue(e.target.value);
                                            handleFboChange(e);
                                        }}
                                        disabled={isReadOnly}
                                    />

                                     
                                    <datalist id="fbo-list">
                                         {/* Se mapean los FBOs filtrados para mostrarlos como opciones */}
                                         {filteredFbos.map((fbo) => (
                                            <option key={fbo.id_fbo} value={fbo.nombre_fbo} />
                                         ))}
                                    </datalist>

                                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                        <span className="material-icons text-gray-400"></span>
                                    </span>
                                </div>
                            )}
                        </div>
                        <div>
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="etd">
                                    Select ETD
                                </label>
                                <div className="relative mt-1">
                                    <input className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm
                                                       disabled:cursor-not-allowed disabled:text-opacity-70s" 
                                           id="etd"
                                           type={noEtd ? 'text' : 'date'}
                                           value={etdDate}
                                           placeholder="No ETD Selected"
                                           onFocus={(e) => e.target.type = 'date'}
                                           onChange={(e) => setEtdDate(e.target.value)}
                                           min={etaDate}
                                           disabled={noEtd || isReadOnly}/>
                                  
                                </div>
                        </div>

                        <div className="md:col-span-2 flex items-end gap-6">

                         {/* ETD Checkbox */}
                            <div className="flex-shrink-0 flex items-end pb-2">
                                <div className="flex items-center h-5">
                                    <input id="etd-checkbox" 
                                           name="etd-checkbox" 
                                           type="checkbox" 
                                           className="focus:ring-sky-500 h-4 w-4 text-sky-600 border-gray-300 rounded disabled:cursor-not-allowed cursor-pointer"
                                           checked={noEtd}
                                           onChange={handleNoEtdChange} 
                                           disabled={isReadOnly} />
                                </div>

                                <div className="ml-2 text-sm">
                                    <label htmlFor="etd-checkbox" className="font-medium text-dark-gray">No ETD</label>
                                </div>
                            </div>
                        <div className="flex-1" >
                                    <label className="block text-sm font-medium text-dark-gray" htmlFor="to-station">
                                        To
                                    </label>

                                    <div className="relative mt-1">
                                        <input
                                            list="to-station-list"
                                            id="to-station"
                                            name="to-station"
                                            className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed"
                                            value={toStation}
                                            onChange={(e) => setToStation(e.target.value)}
                                            disabled={isReadOnly}
                                        />

                                        <datalist id="to-station-list">
                                            {aeropuertos.map((aeropuerto) => (
                                            <option key={aeropuerto.id_aeropuerto} value={aeropuerto.icao_aeropuerto} />
                                            ))}
                                        </datalist>

                                        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                            <span className="material-icons text-gray-400"></span>
                                        </span>
                                    </div>
                            </div>
                        </div>


                        {/* Crew */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="crew-to">
                                    Crew
                                </label>
                                <input className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed" 
                                       id="crew-to" 
                                       type="text" 
                                       inputMode="numeric"
                                       value={crewTo}
                                       onChange={handleIntegerChange(setCrewTo)}
                                       disabled={isReadOnly}/>
                            </div>

                            {/* PAX */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray" htmlFor="pax-to">
                                    Pax
                                </label>
                                <input className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed" 
                                       id="pax-to" 
                                       type="text" 
                                       inputMode="numeric"
                                       value={paxTo}
                                       onChange={handleIntegerChange(setPaxTo)}
                                       disabled={isReadOnly}/>
                            </div>   

                    </div>
                      {/* Exchange Rate */}
                            <div className="md:col-span-5 flex justify-center">
                                <div className="w-50">
                                    <label className="block text-sm font-medium text-dark-gray" htmlFor="exchange-rate">
                                        Exchange Rate
                                    </label>
                                    <input className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm pl-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:cursor-not-allowed" 
                                           id="exchange-rate" 
                                           type="number" 
                                           min="0" onKeyDown={(e) => { if (e.key === '-' || e.key === '+') { e.preventDefault(); } }}
                                           value={exchangeRate}
                                           onChange={(e) => onExchangeRateChange(e.target.value)} 
                                           disabled={isReadOnly} style={errors.exchangeRate ? { borderColor: 'red' } : {}}/>

                                        {errors.exchangeRate && <p className="text-red-500 text-xs mt-1">{errors.exchangeRate}</p>}
                                        <a
                                        href="https://dof.gob.mx/indicadores.php#gsc.tab=0"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-sky-600 underline hover:text-sky-800"
                                        >
                                        Verify exchange rate in DOF
                                        </a>
                                </div>
                            </div>  
                    </div>
            <div className="mt-8 flex items-center space-x-4">
                <button
                    type="button"
                    onClick={onOpenServiceModal}
                    
                    className="btn-glass disabled:opacity-60"
                    disabled={isReadOnly}
                >
                    + Add Service
                </button>
                <button
                    type="button"
                    onClick={onAddItem}

                    className="btn-glass disabled:opacity-60"
                    disabled={isReadOnly}
                >
                    + Add Empty Row
                </button>
                 <Calculator isReadOnly={isReadOnly} />
                {/* Global "No SC" Checkbox */}
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="global-no-sc"
                        checked={globalNoSc}
                        onChange={onGlobalNoScChange}
                        disabled={isReadOnly}
                        className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded disabled:cursor-not-allowed cursor-pointer"
                    />
                    <label htmlFor="global-no-sc" className="ml-2 text-sm font-medium text-dark-gray">No S.C. (All)</label>
                </div>
                {/* Global "No VAT" Checkbox */}
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="global-no-vat"
                        checked={globalNoVat}
                        onChange={onGlobalNoVatChange}
                        disabled={isReadOnly}
                        className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded disabled:cursor-not-allowed cursor-pointer"
                    />
                    <label htmlFor="global-no-vat" className="ml-2 text-sm font-medium text-dark-gray">No VAT (All)</label>
                </div>
            </div>
        </main>
    );
});
export default QuoteForm;
