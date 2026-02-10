import React, { useState, useEffect, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import QuoteHeader from '../components/quote/QuoteHeader';
import QuoteForm from '../components/quote/QuoteForm';
import QuoteTable from '../components/quote/QuoteTable';
import QuoteTotal from '../components/quote/QuoteTotal';
import AddServiceModal from '../components/modals/AddServiceModal';
import PDFPreviewModal from '../components/modals/PDFPreviewModal';
import ConfirmationModal, { ExclamationTriangleIcon, InboxArrowDownIcon } from '../components/modals/ConfirmationModal';
import api from '../services/api';
import QuotePDFDocument from '../components/quote/QuotePDFDocument';
import QuotePDFClientDocument from '../components/quote/QuotePDFClientDocument';
import PDFSelectionModal from '../components/modals/PDFSelectionModal';

function NewQuote({ onNavigateToHistorico, previewingQuote, onCloneQuote }) {
    const [items, setItems] = useState([]);
    const conceptsFetchedRef = useRef(false);
    const exchangeRateFetchedRef = useRef(false);
    const quoteFormRef = useRef();
    const [exchangeRate, setExchangeRate] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClearQuoteModalOpen, setIsClearQuoteModalOpen] = useState(false);
    const [isSaveQuoteModalOpen, setIsSaveQuoteModalOpen] = useState(false);
    const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
    const [isPdfSelectionModalOpen, setIsPdfSelectionModalOpen] = useState(false);
    const [pdfData, setPdfData] = useState(null);
    const [pdfDocumentComponent, setPdfDocumentComponent] = useState(null);
    const [allServices, setAllServices] = useState([]);
    const [defaultConceptos, setDefaultConceptos] = useState([]);
    const [rafTariffs, setRafTariffs] = useState([]);
    const [currentClassificationId, setCurrentClassificationId] = useState(null);

    const [isReadOnly, setIsReadOnly] = useState(!!previewingQuote);
    const [onNewQuoteBlocked, setOnNewQuoteBlocked] = useState(true);

    const [quoteDataForPreview, setQuoteDataForPreview] = useState(null);
    const [isFormReady, setIsFormReady] = useState(false);
    const [totalEnPalabras, setTotalEnPalabras] = useState(null);

    const [globalNoSc, setGlobalNoSc] = useState(false);
    const [globalNoVat, setGlobalNoVat] = useState(false);

    const quoteId = previewingQuote ? previewingQuote.id_cotizacion : null;

    const [isCaaMember, setIsCaaMember] = useState(false);
    const [currentMtow, setCurrentMtow] = useState(0);

    const [clientSpecialPrices, setClientSpecialPrices] = useState([]); 

    const [currentOpCatID, setCurrentOpCatID] = useState(null);

    const [customScRate, setCustomScRate] = useState(null); 

    // CONFIGURACIÓN: Lista de clientes con SC especial 
    const CLIENTS_WITH_SPECIAL_SC = {
        '15': 0.15,  // ID de REVA
        '16': 0.06,  // ID AEG ICE
        '18': 0.12,  // ID ALE
        '19': 0.08,  // ID UAS
        '20': 0.06,  // ID GLOBAL X
        '21': 0.12   // ID PRIME JET
    };

    // Nuevos estados para Landing Permit Coordination
    const LANDING_PERMIT_COORD = 'Landing Permit Coordination';
    const [isGeneralAviation, setIsGeneralAviation] = useState(false);
    const [categoryCoordFee, setCategoryCoordFee] = useState(0);

    const [totals, setTotals] = useState({
        cost: 0,
        sCharge: 0,
        vat: 0,
        total: 0,
    });

 // Callback para recibir el ID desde QuoteForm
    const handleFlightTypeChange = useCallback((id) => {
        console.log("Categoría cambiada, Nuevo ID:", id); // Para depuración
        setCurrentOpCatID(id);
    }, []);


    // Callback para recibir la tarifa desde QuoteForm
    const handleCategoryFeeChange = useCallback((fee) => {
        setCategoryCoordFee(fee);
    }, []);

    const handleClassificationChange = useCallback((id) => {
        setCurrentClassificationId(id);
    }, []);

    // Convertir a Toneladas
    const calculateTons = (val, unit) => {
        const weight = parseFloat(val) || 0;
        if (weight === 0) return 0;
        return unit === 'KG' ? weight / 1000 : weight / 2204.62;
    };

    // Helper: Calcular el total de un item (costo + sCharge + vat)
    const calculateItemTotal = (item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const priceUSD = parseFloat(item.priceUSD) || 0;
        const scPercentage = parseFloat(item.scPercentage) || 0;
        const vatPercentage = parseFloat(item.vatPercentage) || 0;

        const cost = quantity * priceUSD;
        const sCharge = cost * scPercentage;

        // --- CAMBIO: Si SC es 0, el VAT se calcula sobre el Costo ---
        const baseForVat = (scPercentage === 0) ? cost : sCharge;
        const vat = baseForVat * vatPercentage;
     
        const itemTotal = parseFloat((cost + sCharge + vat).toFixed(2));

        return itemTotal;
    };

    // Helper: Determina el porcentaje SC que debería aplicar en este momento
    const getApplicableScPercentage = useCallback(() => {
        if (globalNoSc) return 0;                 // Prioridad 1: Casilla Global 0%
        if (customScRate !== null) return customScRate; // Prioridad 2: Tarifa Especial Cliente (15%)
        return isCaaMember ? 0.10 : 0.18;         // Prioridad 3: CAA (10%) o Standard (18%)
    }, [globalNoSc, customScRate, isCaaMember]);

    useEffect(() => {
        if (quoteId) {
            setIsReadOnly(true);
            setOnNewQuoteBlocked(previewingQuote?.estatus === 'INACTIVA');

            api.get(`/cotizacion/${quoteId}`)
                .then(response => {
                    const quoteData = response.data;
                    setTotalEnPalabras(quoteData.total_en_palabras || null);

                    const isJoinedQuote = quoteData.total_en_palabras && quoteData.total_en_palabras.startsWith('JOIN OF:');
                    
                    // LÓGICA CORREGIDA: Determinar si es Aviación General al cargar
                    const isGenAv = quoteData.fbo === 'Aviación General' || (quoteData.servicios && quoteData.servicios.some(s => s.nombre_cat_concepto && s.nombre_cat_concepto.includes('General Aviation')));
                    setIsGeneralAviation(isGenAv);

                    const mappedItems = quoteData.servicios.map(servicio => {
                        const isLanding = servicio.nombre_servicio.toUpperCase().includes('LANDING FEE');
                        const isGeneralAviation = servicio.nombre_cat_concepto === 'Airport Services General Aviation';
                        const mtow = parseFloat(quoteData.mtow) || 0;
                        const mtowUnit = quoteData.mtow_unit || 'KG';
                        const tons = (mtow > 0) ? (mtowUnit === 'KG' ? mtow / 1000 : mtow / 2204.62) : 0;

                        let baseRate = undefined;
                        if (isLanding && isGeneralAviation && tons > 0) {
                            const priceMXN = parseFloat(servicio.costo_mxn) || 0;
                            if (priceMXN > 0) {
                                baseRate = (priceMXN / 1.16) / tons;
                            }
                        }

                        return {
                            id: servicio.id_concepto_std || null,
                            description: servicio.nombre_servicio,
                            category: servicio.nombre_cat_concepto,
                            quantity: parseFloat(servicio.cantidad) || 0,
                            priceMXN: parseFloat(servicio.costo_mxn) || 0,
                            priceUSD: parseFloat(servicio.costo_usd) || 0,
                            scPercentage: parseFloat(servicio.sc_porcentaje) || 0,
                            vatPercentage: parseFloat(servicio.vat_porcentaje) || 0,
                            anchorCurrency: 'MXN',
                            total: parseFloat(servicio.total_usd) || 0,
                            noSc: parseFloat(servicio.sc_porcentaje) === 0,
                            noVat: parseFloat(servicio.vat_porcentaje) === 0,
                            baseRate: baseRate,
                            isSnapshot: true, // Marcamos que viene de la BD
                        };
                    });
                    setItems(mappedItems);
                    setExchangeRate(quoteData.exchange_rate);

                    if (isJoinedQuote) {
                        const formDataForPdf = {
                            quoteNumber: quoteData.numero_referencia || null,
                            customerName: quoteData.cliente || '',
                            date: quoteData.fecha_cotizacion ? new Date(quoteData.fecha_cotizacion).toISOString().split('T')[0] : '',
                            flightTypeName: quoteData.cat_operacion || '',
                            quotedBy: quoteData.nombre_responsable || '',
                            aircraftModelName: quoteData.modelo_aeronave || '',
                            aircraftRegistrationValue: quoteData.matricula_aeronave || '',
                            stationName: quoteData.aeropuerto || '',
                            fboName: quoteData.fbo || '',
                            exchangeRate: quoteData.exchange_rate,
                            isCaaMember: !!quoteData.es_miembro_caa,
                            totalEnPalabras: quoteData.total_en_palabras || null,
                            eta: quoteData.fecha_llegada ? new Date(quoteData.fecha_llegada).toISOString().split('T')[0] : null,
                            etd: quoteData.fecha_salida ? new Date(quoteData.fecha_salida).toISOString().split('T')[0] : null,
                            crewFrom: quoteData.tripulacion_llegada || '',
                            paxFrom: quoteData.pasajeros_llegada || '',
                            crewTo: quoteData.tripulacion_salida || '',
                            paxTo: quoteData.pasajeros_salida || '',
                            fromName: quoteData.aeropuerto_origen || '',
                            toName: quoteData.aeropuerto_destino || '',
                        };

                        let legsData = null;
                        if (quoteData.legs && quoteData.legs.length > 0) {
                            legsData = quoteData.legs.map(leg => {
                                const legItems = leg.servicios.map(servicio => ({
                                    description: servicio.nombre_servicio,
                                    category: servicio.nombre_cat_concepto,
                                    quantity: servicio.cantidad,
                                    priceMXN: servicio.costo_mxn,
                                    priceUSD: servicio.costo_usd,
                                    scPercentage: servicio.sc_porcentaje,
                                    vatPercentage: servicio.vat_porcentaje,
                                    anchorCurrency: 'MXN',
                                    total: servicio.total_usd,
                                    noSc: parseFloat(servicio.sc_porcentaje) === 0,
                                    noVat: parseFloat(servicio.vat_porcentaje) === 0,
                                    isSnapshot: true,
                                }));

                                return {
                                    quoteNumber: leg.quoteNumber,
                                    station: leg.station,
                                    eta: leg.eta ? new Date(leg.eta).toISOString().split('T')[0] : null,
                                    etd: leg.etd ? new Date(leg.etd).toISOString().split('T')[0] : null,
                                    from: leg.from,
                                    to: leg.to,
                                    crewFrom: leg.crewFrom,
                                    paxFrom: leg.paxFrom,
                                    crewTo: leg.crewTo,
                                    paxTo: leg.paxTo,
                                    items: legItems
                                };
                            });
                        }

                        const calculatedTotals = mappedItems.reduce((acc, item) => {
                            const quantity = parseFloat(item.quantity) || 0;
                            const priceUSD = parseFloat(item.priceUSD) || 0;
                            const scPercentage = parseFloat(item.scPercentage) || 0;
                            const vatPercentage = parseFloat(item.vatPercentage) || 0;

                            const cost = quantity * priceUSD;
                            const sCharge = cost * scPercentage;
                            const vat = sCharge * vatPercentage;

                            acc.cost += cost;
                            acc.sCharge += sCharge;
                            acc.vat += vat;
                            acc.total += cost + sCharge + vat;
                            return acc;
                        }, { cost: 0, sCharge: 0, vat: 0, total: 0 });

                        const fullPdfData = {
                            formData: formDataForPdf,
                            items: mappedItems,
                            totals: calculatedTotals,
                            legs: legsData,
                        };

                        setPdfData(fullPdfData);
                        setIsPdfSelectionModalOpen(true);
                        setOnNewQuoteBlocked(false);
                    } else {
                        setQuoteDataForPreview(quoteData);
                        setOnNewQuoteBlocked(false);
                    }

                    // LÓGICA CORREGIDA: Cargar el catálogo de servicios (allServices) para el modal
                    // sin sobrescribir los items actuales de la cotización.
                    if (quoteData.id_fbo) {
                        api.get('/servicios', { params: { id_fbo: quoteData.id_fbo } })
                            .then(res => setAllServices(res.data))
                            .catch(err => console.error('Error loading services catalog:', err));
                    } else if (quoteData.fbo === 'Aviación General' || quoteData.fbo === 'Aviación Comercial') {
                        api.get('/servicios-by-aviation-type', { params: { aviationType: quoteData.fbo } })
                            .then(res => setAllServices(res.data))
                            .catch(err => console.error('Error loading services catalog:', err));
                    }

                })
                .catch(error => console.error('Error fetching quote details:', error));
        } else if (previewingQuote?.isClone) {
            setIsReadOnly(false);
            setOnNewQuoteBlocked(true);

            // 1. Obtener ID y Configurar el Estado Global (Para servicios NUEVOS)
            const cloneCustomerId = previewingQuote.selectedCustomer?.id_cliente || previewingQuote.customer;
            
            if (cloneCustomerId) {
                const specialRate = CLIENTS_WITH_SPECIAL_SC[String(cloneCustomerId)];
                if (specialRate !== undefined) {
                    // Esto asegura que si agregas un item NUEVO, nazca con el 12%, 15%, etc.
                    setCustomScRate(specialRate); 
                }
            }

            // 2. Hidratar items (RESPETANDO LO GUARDADO)
            const hydratedItems = (previewingQuote.items || []).map(item => {
                
                const isExempt = item.scPercentage === 0;

                // CORRECCIÓN: 
                // Ya no forzamos "targetSc = initialCloneScRate".
                // Confiamos ciegamente en lo que viene guardado en el item.
                const targetSc = parseFloat(item.scPercentage); 

                return {
                    ...item,
                    isSnapshot: false,   
                    
                    // IMPORTANTE: manualPrice: true protege estos valores de los Efectos Maestros
                    // hasta que cambies de cliente.
                    manualPrice: true, 
                    
                    id: item.id || null ,
                    isScExempt: isExempt,
                    noSc: isExempt,
                    
                    // Usamos el porcentaje original guardado, sin tocarlo.
                    scPercentage: targetSc 
                };
            });

            setItems(hydratedItems);

           
            // Recuperamos el ID del cliente del objeto clonado
            if (cloneCustomerId) {
                console.log("Cargando precios especiales para clonación, Cliente ID:", cloneCustomerId);
                api.get(`/clientes/${cloneCustomerId}/servicios-especiales`)
                    .then(res => {
                        console.log("Precios especiales cargados (Clone):", res.data);
                        setClientSpecialPrices(res.data);
                    })
                    .catch(err => console.error("Error cargando precios especiales en clon:", err));
            }         

            setExchangeRate(previewingQuote.exchangeRate);
            setQuoteDataForPreview(previewingQuote);
            setIsFormReady(false);

            const allNoSc = previewingQuote.items?.every(item => item.scPercentage === 0);
            const allNoVat = previewingQuote.items?.every(item => item.vatPercentage === 0);
            setGlobalNoSc(allNoSc);
            setGlobalNoVat(allNoVat);
            
            // LÓGICA CORREGIDA: Restaurar estado de Aviación General al clonar
            const isGenAv = previewingQuote.fboName === 'Aviación General' || previewingQuote.items.some(i => i.category && i.category.includes('General Aviation'));
            setIsGeneralAviation(isGenAv);

            if (previewingQuote.selectedFboId) {
                api.get('/servicios', {
                    params: { id_fbo: previewingQuote.selectedFboId },
                })
                .then(response => setAllServices(response.data))
                .catch(error => console.error('Error fetching services for clone:', error));
            } else if (previewingQuote.fboName === 'Aviación General' || previewingQuote.fboName === 'Aviación Comercial') {
                 api.get('/servicios-by-aviation-type', { params: { aviationType: previewingQuote.fboName } })
                    .then(res => setAllServices(res.data))
                    .catch(err => console.error('Error loading services catalog for clone:', err));
            }
        } else {
            setIsReadOnly(false);
            setOnNewQuoteBlocked(true);
            setQuoteDataForPreview(null);
            setTotalEnPalabras(null);
            setIsFormReady(false);
            setGlobalNoSc(false);
            setGlobalNoVat(false);

            if (quoteFormRef.current) {
                if (!previewingQuote?.isClone) quoteFormRef.current.clearAllFields();
            }
            
            const fetchExchangeRate = async () => {
                if (exchangeRateFetchedRef.current) return;
                exchangeRateFetchedRef.current = true;

                try {
                    const response = await api.get('/tipo-de-cambio');
                    setExchangeRate(parseFloat(response.data.tipoDeCambio));
                } catch (error) {
                    console.error('Error fetching exchange rate:', error);
                    setExchangeRate(18);
                }
            };

            fetchExchangeRate();
        }
    }, [quoteId, previewingQuote]);

    // Cargar Tarifas RAF al montar
    useEffect(() => {
        api.get('/listar/tarifas_raf_mtow')
            .then(response => setRafTariffs(response.data))
            .catch(error => console.error('Error fetching RAF tariffs:', error));
    }, []);

    useEffect(() => {
        if (quoteDataForPreview && isFormReady && quoteFormRef.current) {
            console.log("¡Sincronización completa! Rellenando formulario...");
            const isClone = previewingQuote?.isClone || false;
            quoteFormRef.current.setFormData(quoteDataForPreview, isClone);
        }
    }, [quoteDataForPreview, isFormReady, previewingQuote]);

    useEffect(() => {
        const newTotals = items.reduce((acc, item) => {
            const quantity = parseFloat(item.quantity) || 0;
            const priceUSD = parseFloat(item.priceUSD) || 0;
            const scPercentage = parseFloat(item.scPercentage) || 0;
            const vatPercentage = parseFloat(item.vatPercentage) || 0;

            const rawCost = quantity * priceUSD;
            const rawSCharge = rawCost * scPercentage;

            // --- CAMBIO: Lógica condicional para el VAT ---
            const baseForVat = (scPercentage === 0) ? rawCost : rawSCharge;
            const rawVat = baseForVat * vatPercentage;

            const costRounded = parseFloat(rawCost.toFixed(2));
            const sChargeRounded = parseFloat(rawSCharge.toFixed(2));
            const vatRounded = parseFloat(rawVat.toFixed(2));
            const itemTotalRounded = parseFloat((rawCost + rawSCharge + rawVat).toFixed(2));

            acc.cost += costRounded;
            acc.sCharge += sChargeRounded;
            acc.vat += vatRounded;
            acc.total += itemTotalRounded;
            return acc;
        }, { cost: 0, sCharge: 0, vat: 0, total: 0 });

        setTotals(newTotals);
    }, [items]);

    useEffect(() => {
        if (isReadOnly) return;

        if (exchangeRate) {
            setItems(prevItems =>
                prevItems.map(item => {
                    if (item.manualPrice) {
                        const cost = (item.quantity || 0) * (item.priceUSD || 0);
                        const serviceCharge = cost * (item.scPercentage || 0);
                        const vat = serviceCharge * (item.vatPercentage || 0);
                        const newTotal = parseFloat((cost + serviceCharge + vat).toFixed(2));
                        return {
                            ...item,
                            total: newTotal,
                        };
                    }

                    let newPriceUSD = item.priceUSD || 0;
                    let newPriceMXN = item.priceMXN || 0;

                    if (item.anchorCurrency === 'MXN') {
                        newPriceUSD = parseFloat((Number(item.priceMXN || 0) / exchangeRate).toFixed(2));
                        newPriceMXN = parseFloat(Number(item.priceMXN || 0).toFixed(2));
                    } else {
                        newPriceMXN = parseFloat((Number(item.priceUSD || 0) * exchangeRate).toFixed(2));
                        newPriceUSD = parseFloat(Number(item.priceUSD || 0).toFixed(2));
                    }

                    const updatedItem = {
                        ...item,
                        priceUSD: newPriceUSD,
                        priceMXN: newPriceMXN,
                    };
                    const newTotal = calculateItemTotal(updatedItem);

                    return {
                        ...updatedItem,
                        total: newTotal,
                    };
                })
            );
        }
    }, [exchangeRate]);

    useEffect(() => {
        setItems(prevItems =>
            prevItems.map(item => {
                const targetVat = globalNoVat ? 0 : 0.16;
                const updatedItem = {
                    ...item,
                    vatPercentage: targetVat,
                    noVat: globalNoVat,
                };
                updatedItem.total = calculateItemTotal(updatedItem);
                return updatedItem;
            })
        );
    }, [globalNoVat]);

    // Efecto: Cuando cambia el cliente seleccionado, cargamos sus precios especiales
    useEffect(() => {
        // quoteFormRef nos da acceso al cliente seleccionado (id)
        const currentFormData = quoteFormRef.current?.getAllFormData();
        const customerId = currentFormData?.selectedCustomer?.id_cliente;

        if (customerId) {
            api.get(`/clientes/${customerId}/servicios-especiales`)
                .then(res => {
                    setClientSpecialPrices(res.data);
                })
                .catch(err => console.error(err));
        } else {
            setClientSpecialPrices([]);
        }
    },
     
    [quoteFormRef]);

    const prevIsCaaMemberRef = useRef(isCaaMember);

    // Efecto unificado para actualizar SC cuando cambie CUALQUIER factor (CAA, Cliente Especial, Checkbox Global)
    useEffect(() => {
        const targetSc = getApplicableScPercentage(); 

        setItems(prevItems =>
            prevItems.map(item => {
                // 1. Si el item es exento por naturaleza (BD), se queda en 0 siempre.
                if (item.isScExempt) {
                    // Solo actualizamos si por error tiene algo diferente a 0
                    if (item.scPercentage !== 0 || !item.noSc) {
                         const fixedItem = { ...item, scPercentage: 0, noSc: true };
                         fixedItem.total = calculateItemTotal(fixedItem);
                         return fixedItem;
                    }
                    return item;
                }

                if (item.manualPrice && !globalNoSc) {
                    return item;
                }

                // 3. ACTUALIZACIÓN AUTOMÁTICA (15%, 18%, 10%)
                // Si el porcentaje ya es el correcto, no hacemos nada (optimización)
                if (item.scPercentage === targetSc && item.noSc === (targetSc === 0)) {
                    return item;
                }

                const updatedItem = {
                    ...item,
                    scPercentage: targetSc,
                    noSc: targetSc === 0,
                };
                
                updatedItem.total = calculateItemTotal(updatedItem);
                return updatedItem;
            })
        );
    }, [isCaaMember, globalNoSc, customScRate, getApplicableScPercentage]);

    const handleGlobalCheckboxChange = (setter, value) => {
        setter(value); 
        // Al hacer setter(value), cambia el estado (ej. globalNoSc), 
        if (value === true) { // Solo si estamos ACTIVANDO la casilla
             setItems(prevItems => prevItems.map(item => ({
                ...item,
                // Si quieres que al marcar "No SC" se respete el precio base pero se quite el SC:
                noSc: true,
                scPercentage: 0
            })));
        }
    };

    /*
    // useEffect para actualizar Landing Permit Coordination cuando cambia categoryCoordFee
    useEffect(() => {
        setItems(prevItems => 
            prevItems.map(item => {
                if (item.description === LANDING_PERMIT_COORD) {
                    // Solo aplica si es General Aviation
                    if (!isGeneralAviation) return item;

                    // Si el precio fue editado manualmente, no recalcular
                    if (item.manualPrice) return item;

                    const newPriceUSD = categoryCoordFee > 0 ? categoryCoordFee : (item.baseRate || 0);
                    const newPriceMXN = exchangeRate ? parseFloat((newPriceUSD * exchangeRate).toFixed(2)) : 0;

                    const updatedItem = {
                        ...item,
                        priceUSD: newPriceUSD,
                        priceMXN: newPriceMXN,
                        anchorCurrency: 'USD',
                        isCategoryOverride: categoryCoordFee > 0
                    };

                    updatedItem.total = calculateItemTotal(updatedItem);
                    return updatedItem;
                }
                return item;
            })
        );
    }, [categoryCoordFee, exchangeRate, isGeneralAviation]);  */

    /*
    // useEffect para actualizar RAF Coordination cuando cambia MTOW o Clasificación
    useEffect(() => {
        setItems(prevItems => 
            prevItems.map(item => {
                if (item.description.includes('RAF Coordination')) {
                    
                    // 1. Calcular el precio teórico según la tabla
                    let calculatedPriceUSD = 0;
                    if (currentClassificationId) {
                        const tariff = rafTariffs.find(t => 
                            parseInt(t.id_clasificacion) === parseInt(currentClassificationId)
                        );

                        if (tariff) {
                            if (isCaaMember) {
                                // Usamos Number() para manejar strings o números, y || 0 para nulos
                                calculatedPriceUSD = parseFloat(tariff.costo_caa_usd) || 0;
                            } else {
                                calculatedPriceUSD = parseFloat(tariff.costo_usd) || 0;
                            }
                        }
                    }

                    // 2. Manejo de Carga Inicial (Snapshot)
                    // Comparamos el precio guardado con el de la tabla para saber si fue manual
                    if (item.isSnapshot) {
                        // Si aún no tenemos clasificación o tarifas (carga asíncrona), esperamos
                        if ((!currentClassificationId || rafTariffs.length === 0) && !item.manualPrice) return item;

                        const currentPrice = parseFloat(item.priceUSD || 0);
                        
                        // Si el precio guardado difiere del de tabla, asumimos que fue manual
                        if (Math.abs(currentPrice - calculatedPriceUSD) > 0.01) {
                            return { ...item, manualPrice: true, isSnapshot: false };
                        } else {
                            // Si coinciden, lo dejamos vinculado a la tabla
                            return { ...item, isSnapshot: false };
                        }
                    }

                    // 3. Si es manual, no tocamos nada
                    if (item.manualPrice) return item;

                    // 4. Actualización automática
                    const newPriceMXN = exchangeRate ? parseFloat((calculatedPriceUSD * exchangeRate).toFixed(2)) : 0;

                    const updatedItem = {
                        ...item,
                        priceUSD: calculatedPriceUSD,
                        priceMXN: newPriceMXN,
                        anchorCurrency: 'USD',
                    };
                    updatedItem.total = calculateItemTotal(updatedItem);
                    return updatedItem;
                }
                return item;
            })
        );
    }, [currentClassificationId, rafTariffs, exchangeRate, isCaaMember]); // Se asegura que reaccione a isCaaMember

   */

    const fetchServices = async (id_aeropuerto, id_fbo, fboNameOrAviationType) => {
        if (isReadOnly) return;

        setItems(prevItems => prevItems.filter(item => item.description === ''));

        // Determinar si es aviación general (puede venir de un FBO real o de selección manual)
        const isGenAv = fboNameOrAviationType === 'Aviación General';
        setIsGeneralAviation(isGenAv);

        // Caso 1: Hay un FBO real seleccionado (aeropuerto existe en BD)
        if (id_fbo) {
            try {
                const response = await api.get('/servicios', {
                    params: { id_fbo },
                });

                const serviciosData = response.data;
                console.log("Servicios recibidos:", serviciosData);

                setAllServices(serviciosData);

                const defaultServices = serviciosData.filter(s => s.es_default);

                const newItemsToAdd = defaultServices.map(s => {
                    // 1. DECLARACIÓN DE VARIABLES AL INICIO (Para evitar ReferenceError)
                    const isUSDDefault = s.divisa === 'USD';
                    let rawRate = parseFloat(s.tarifa_servicio) || 0;
                    
                    // Inicializamos las variables de precio y moneda
                    let priceMXN = 0;
                    let priceUSD = 0;
                    let anchorCurrency = isUSDDefault ? 'USD' : 'MXN';
                    let pricingMethod = 'DEFAULT'; // Para controlar la lógica final

                    // 2. IDENTIFICACIÓN DE SERVICIOS
                    const isExempt = !!s.exento_sc;
                    const isLandingFee = s.nombre_concepto_default.toUpperCase().includes('LANDING FEE');
                    const isLandingPermitCoord = s.nombre_concepto_default === LANDING_PERMIT_COORD;
                    const isRafCoordination = s.nombre_concepto_default.includes('RAF Coordination');
                    const isOvernight = s.nombre_concepto_default.toUpperCase().includes('OVERNIGHT (PER NIGHT)');
                    const isParking = s.nombre_concepto_default.toUpperCase().includes('PARKING FEE');
                    const isEmbarking = s.nombre_concepto_default.toUpperCase().includes('EMBARKING / DISEMBARKING');
                    const isTua = s.nombre_concepto_default.toUpperCase() === 'TUA';

                    const serviceID = s.id_concepto_std;
                    const currentFlightTypeData = quoteFormRef.current?.getFormData(); 
                    const currentOpCatID = currentFlightTypeData?.flightType; 

                    // --- 3. BUSCAR PRECIO ESPECIAL (LÓGICA MEJORADA) ---
                    // Paso A: Filtramos todas las reglas para ESTE servicio específico
                    const serviceRules = clientSpecialPrices.filter(sp => sp.id_concepto_std == serviceID);

                    // Paso B: Intentamos encontrar una coincidencia EXACTA de categoría (Prioridad 1)
                    let specialPriceObj = serviceRules.find(sp => sp.id_cat_operacion == currentOpCatID);

                    // Paso C: Si no hay exacta, buscamos la regla GLOBAL/COMODÍN (Prioridad 2)
                    if (!specialPriceObj) {
                        specialPriceObj = serviceRules.find(sp => sp.id_cat_operacion == null);
                    }

                    // --- NUEVA LÓGICA DE DECISIÓN ---
                    let useSpecialPrice = false;
                    if (specialPriceObj) {
                        const spCost = parseFloat(specialPriceObj.costo_servicio);
                        // Si cuesta dinero O es gratis pero NO es RAF (ej. Landing Permit) -> Usar especial
                        // Si es RAF y cuesta 0 -> Ignorar especial (Ir a MTOW)
                        if (spCost > 0 || !isRafCoordination) {
                            useSpecialPrice = true;
                        }
                    }

                    // ============================================================
                    // 4. LÓGICA DE CASCADA DE PRECIOS
                    // ============================================================

                    // NIVEL 1: CLIENTE ESPECIAL (Tiene prioridad sobre todo)
                    if (useSpecialPrice) {
                        const specialCost = parseFloat(specialPriceObj.costo_servicio);
                        
                        // Si es cliente especial, generalmente la tarifa es en USD fija
                        priceUSD = specialCost;
                        priceMXN = exchangeRate ? parseFloat((priceUSD * exchangeRate).toFixed(2)) : 0;
                        anchorCurrency = 'USD';
                        pricingMethod = 'SPECIAL_CLIENT';
                        
                        // Actualizamos el rawRate para referencia
                        rawRate = specialCost;
                    }
                    // NIVEL 2: LANDING PERMIT COORDINATION (Lógica de Categoría)
                    else if (isLandingPermitCoord && isGenAv && categoryCoordFee > 0) {
                        priceUSD = categoryCoordFee;
                        priceMXN = exchangeRate ? parseFloat((priceUSD * exchangeRate).toFixed(2)) : 0;
                        anchorCurrency = 'USD';
                        pricingMethod = 'CATEGORY_FEE';
                    }
                    // NIVEL 3: LANDING FEE (Lógica MTOW)
                    else if (isLandingFee && isGenAv && currentMtow > 0) {
                        const tons = parseFloat(currentMtow.toFixed(2));
                        const calculatedBase = rawRate * tons * 1.16; // Fórmula base con redondeo
                        if (isUSDDefault) {
                            priceUSD = parseFloat(calculatedBase.toFixed(2));
                            priceMXN = exchangeRate ? parseFloat((calculatedBase * exchangeRate).toFixed(2)) : 0;
                        } else {
                            priceMXN = parseFloat(calculatedBase.toFixed(2));
                            priceUSD = exchangeRate ? parseFloat((calculatedBase / exchangeRate).toFixed(2)) : 0;
                        }
                        pricingMethod = 'MTOW_CALC';
                    }
                    // NIVEL 3.5: OVERNIGHT (Lógica MTOW con fórmula especial)
                    else if (isOvernight && currentMtow > 0) {
                        const tons = parseFloat(currentMtow.toFixed(2));
                        const calculatedBase = rawRate * 2 * 24 * tons * 1.16;
                        if (isUSDDefault) {
                            priceUSD = parseFloat(calculatedBase.toFixed(2));
                            priceMXN = exchangeRate ? parseFloat((calculatedBase * exchangeRate).toFixed(2)) : 0;
                        } else {
                            priceMXN = parseFloat(calculatedBase.toFixed(2));
                            priceUSD = exchangeRate ? parseFloat((calculatedBase / exchangeRate).toFixed(2)) : 0;
                        }
                        pricingMethod = 'OVERNIGHT_CALC';
                    }
                    // NIVEL 3.6: PARKING & EMBARKING (Lógica MTOW con fórmula especial)
                    else if ((isParking || isEmbarking) && currentMtow > 0) {
                        const tons = parseFloat(currentMtow.toFixed(2));
                        const calculatedBase = rawRate * 2 * tons * 1.16;
                        if (isUSDDefault) {
                            priceUSD = parseFloat(calculatedBase.toFixed(2));
                            priceMXN = exchangeRate ? parseFloat((calculatedBase * exchangeRate).toFixed(2)) : 0;
                        } else {
                            priceMXN = parseFloat(calculatedBase.toFixed(2));
                            priceUSD = exchangeRate ? parseFloat((calculatedBase / exchangeRate).toFixed(2)) : 0;
                        }
                        pricingMethod = isParking ? 'PARKING_CALC' : 'EMBARKING_CALC';
                    }
                    // NIVEL 3.7: TUA (Fórmula especial: Base MXN * 1.16)
                    else if (isTua) {
                        if (isUSDDefault) {
                            const baseMXN = parseFloat((rawRate * exchangeRate).toFixed(2));
                            priceMXN = parseFloat((baseMXN * 1.16).toFixed(2));
                            priceUSD = exchangeRate ? parseFloat((priceMXN / exchangeRate).toFixed(2)) : 0;
                        } else {
                            priceMXN = parseFloat((rawRate * 1.16).toFixed(2));
                            priceUSD = exchangeRate ? parseFloat((priceMXN / exchangeRate).toFixed(2)) : 0;
                        }
                        pricingMethod = 'TUA_CALC';
                    }
                    // NIVEL 4: RAF COORDINATION (Lógica MTOW / Clasificación)
                    else if (isRafCoordination) {
                        let calculatedRafUSD = 0;
                        
                        if (currentClassificationId) {
                            const tariff = rafTariffs.find(t => 
                                parseInt(t.id_clasificacion) === parseInt(currentClassificationId)
                            );
                            if (tariff) {
                                if (isCaaMember) {
                                    calculatedRafUSD = parseFloat(tariff.costo_caa_usd) || 0;
                                } else {
                                    calculatedRafUSD = parseFloat(tariff.costo_usd) || 0;
                                }
                            }
                        }
                        
                        priceUSD = calculatedRafUSD;
                        priceMXN = exchangeRate ? parseFloat((priceUSD * exchangeRate).toFixed(2)) : 0;
                        anchorCurrency = 'USD';
                        pricingMethod = 'RAF_MTOW';
                    }
                    // NIVEL 5: PRECIO DEFAULT (Base de datos)
                    else {
                        if (isUSDDefault) {
                            priceUSD = parseFloat(rawRate.toFixed(2));
                            priceMXN = exchangeRate ? parseFloat((priceUSD * exchangeRate).toFixed(2)) : 0;
                        } else {
                            priceMXN = parseFloat(rawRate.toFixed(2));
                            priceUSD = exchangeRate ? parseFloat((priceMXN / exchangeRate).toFixed(2)) : 0;
                        }
                    }

                    // 5. CÁLCULO DE TOTALES E IMPUESTOS
                    const quantity = 1;
                    const scPercentage = isExempt ? 0 : getApplicableScPercentage();
                    const vatPercentage = globalNoVat ? 0 : 0.16;

                    const cost = quantity * priceUSD;
                    const serviceCharge = cost * scPercentage;

                    const baseForVat = (scPercentage === 0) ? cost : serviceCharge;
                    const vat = baseForVat * vatPercentage;

                    const total = cost + serviceCharge + vat;

                    return {
                        id: s.id_concepto_std,
                        description: s.nombre_concepto_default,
                        category: s.nombre_cat_concepto,
                        quantity,
                        priceMXN,
                        priceUSD,
                        scPercentage,
                        vatPercentage,
                        noSc: isExempt || globalNoSc,
                        noVat: globalNoVat,
                        anchorCurrency,
                        baseRate: rawRate, // Guardamos la tarifa base original o calculada
                        total,
                        isScExempt: isExempt,
                        pricingMethod // Útil para debugging, saber de dónde salió el precio
                    };
                });

                setItems(prev => [...prev, ...newItemsToAdd]);

            } catch (error) {
                console.error('Error fetching FBO services:', error);
            }
        } 

        // Caso 2: Aviación seleccionada manualmente (aeropuerto no existe en BD)
        else if (fboNameOrAviationType === 'Aviación General' || fboNameOrAviationType === 'Aviación Comercial') {
            try {
                // Traer los servicios por defecto según el tipo de aviación
                const response = await api.get('/servicios-by-aviation-type', {
                    params: { aviationType: fboNameOrAviationType },
                });

                const serviciosData = response.data;
                console.log("Servicios por tipo de aviación recibidos:", serviciosData);

                setAllServices(serviciosData);

                // Cargar servicios con precios en 0 para que el usuario los edite
                const newItemsToAdd = serviciosData.map(s => {
                    const isExempt = !!s.exento_sc;

                    // Todos los servicios de aviación manual comienzan con precio 0
                    const priceMXN = 0;
                    const priceUSD = 0;
                    const quantity = 1;
                    const scPercentage = isExempt ? 0 : getApplicableScPercentage();
                    const vatPercentage = globalNoVat ? 0 : 0.16;

                    const cost = quantity * priceUSD;
                    const serviceCharge = cost * scPercentage;
                    const vat = serviceCharge * vatPercentage;
                    const total = cost + serviceCharge + vat;

                    return {
                        id: s.id_concepto_std, // IMPORTANTE: Agregar el ID para que funcionen los precios especiales
                        description: s.nombre_concepto_default,
                        category: s.nombre_cat_concepto,
                        quantity,
                        priceMXN,
                        priceUSD,
                        scPercentage,
                        vatPercentage,
                        noSc: isExempt || globalNoSc,
                        noVat: globalNoVat,
                        anchorCurrency: 'USD',
                        baseRate: 0,
                        total,
                        isScExempt: isExempt,
                    };
                });

                setItems(prev => [...prev, ...newItemsToAdd]);
                console.log(`Servicios cargados para ${fboNameOrAviationType} con valores iniciales en 0`);

            } catch (error) {
                console.error('Error fetching services by aviation type:', error);
                setAllServices([]);
            }
        }
        // Caso 3: Sin aviación ni FBO seleccionados
        else {
            setAllServices([]);
        }
    };

    const handleMtowChange = useCallback((val, unit) => {
        const tons = calculateTons(val, unit);
        setCurrentMtow(tons);

        if (isReadOnly) return;

        setItems(prevItems => 
            prevItems.map(item => {
                // Si el precio fue editado manualmente, no recalcular
                if (item.manualPrice) return item;

                const isLanding = item.description.toUpperCase().includes('LANDING FEE');
                const isGeneralAviation = item.category === 'Airport Services General Aviation';
                const isOvernight = item.description.toUpperCase().includes('OVERNIGHT (PER NIGHT)');
                const isParking = item.description.toUpperCase().includes('PARKING FEE');
                const isEmbarking = item.description.toUpperCase().includes('EMBARKING / DISEMBARKING');

                // Solo recalcular Landing Fees de General Aviation, Overnight, Parking o Embarking
                if ((!isLanding || !isGeneralAviation) && !isOvernight && !isParking && !isEmbarking) return item;

                const rate = item.baseRate || (item.anchorCurrency === 'USD' ? item.priceUSD : item.priceMXN);
                
                let newPriceMXN = 0;
                let newPriceUSD = 0;

                if (tons > 0) {
                    let calculatedBase = 0;
                    if (isOvernight) {
                        const tonsRounded = parseFloat(tons.toFixed(2));
                        calculatedBase = rate * 2 * 24 * tonsRounded * 1.16;
                    } else if (isParking || isEmbarking) {
                        const tonsRounded = parseFloat(tons.toFixed(2));
                        calculatedBase = rate * 2 * tonsRounded * 1.16;
                    } else {
                        const tonsRounded = parseFloat(tons.toFixed(2));
                        calculatedBase = (rate * tonsRounded) * 1.16;
                    }
                    
                    if (item.anchorCurrency === 'USD') {
                        newPriceUSD = parseFloat(calculatedBase.toFixed(2));
                        newPriceMXN = exchangeRate ? parseFloat((calculatedBase * exchangeRate).toFixed(2)) : 0;
                    } else {
                        newPriceMXN = parseFloat(calculatedBase.toFixed(2));
                        newPriceUSD = exchangeRate ? parseFloat((calculatedBase / exchangeRate).toFixed(2)) : 0;
                    }
                }

                const updatedItem = {
                    ...item,
                    baseRate: item.baseRate || rate,
                    priceMXN: parseFloat(Number(newPriceMXN || 0).toFixed(2)),
                    priceUSD: parseFloat(Number(newPriceUSD || 0).toFixed(2)),
                };
                
                updatedItem.total = calculateItemTotal(updatedItem);
                return updatedItem;
            })
        );
    }, [exchangeRate, isReadOnly]);

    // EFECTO MAESTRO: Recalcular precios en tiempo real
    useEffect(() => {

        if (isReadOnly) return;

        setItems(prevItems => prevItems.map(item => {
            // 1. Si es manual, ignorar
            if (item.manualPrice) return item;

            // 2. Identificar servicio
            let serviceId = item.id;

            // AUTO-REPARACIÓN DE ID:
            // Si el item viene de un clon/load y perdió su ID, lo buscamos por nombre
            if (!serviceId && allServices.length > 0) {
                const found = allServices.find(s => s.nombre_concepto_default === item.description);
                if (found) {
                    serviceId = found.id_concepto_std;
                }
            }

            const isLandingFee = item.description.toUpperCase().includes('LANDING FEE');
            const isLandingPermitCoord = item.description === LANDING_PERMIT_COORD;
            const isRafCoordination = item.description.includes('RAF Coordination');
            const isOvernight = item.description.toUpperCase().includes('OVERNIGHT (PER NIGHT)');
            const isParking = item.description.toUpperCase().includes('PARKING FEE');
            const isEmbarking = item.description.toUpperCase().includes('EMBARKING / DISEMBARKING');
            const isTua = item.description.toUpperCase() === 'TUA';

            // 3. BUSCAR PRECIO ESPECIAL DE CLIENTE
            // Paso A: Filtramos reglas de este servicio
            const serviceRules = clientSpecialPrices.filter(sp => sp.id_concepto_std == serviceId);

            // Paso B: Buscamos coincidencia EXACTA primero (Ej. Ambulancia)
            let specialPriceObj = serviceRules.find(sp => sp.id_cat_operacion == currentOpCatID);

            // Paso C: Si no hay, buscamos la GLOBAL (null)
            if (!specialPriceObj) {
                specialPriceObj = serviceRules.find(sp => sp.id_cat_operacion == null);
            }

            // --- NUEVA LÓGICA DE DECISIÓN ---
            let useSpecialPrice = false;
            if (specialPriceObj) {
                const spCost = parseFloat(specialPriceObj.costo_servicio);
                
                // REGLA DE ORO:
                // Usamos el precio especial si:
                // A) El costo es mayor a 0 (ej. $350, $550)
                // B) O el costo es 0 PERO NO ES RAF (ej. Landing Permit que es gratis)
                if (spCost > 0 || !isRafCoordination) {
                    useSpecialPrice = true;
                }
                // Si es RAF y el costo es 0, 'useSpecialPrice' se queda en false
                // y el código caerá automáticamente al "else if (isRafCoordination)" de abajo.
            }

            // Variables para el nuevo precio
            let newPriceUSD = 0;
            let newPriceMXN = 0;
            let newAnchor = item.anchorCurrency;
            let pricingMethod = 'UPDATE_DEFAULT';

            // 4. LÓGICA DE RE-CÁLCULO
            
            if (useSpecialPrice) {
                // CASO A: TIENE PRECIO ESPECIAL (Prioridad Máxima)
                newPriceUSD = parseFloat(specialPriceObj.costo_servicio);
                newPriceMXN = exchangeRate ? parseFloat((newPriceUSD * exchangeRate).toFixed(2)) : 0;
                newAnchor = 'USD';
                pricingMethod = 'UPDATE_SPECIAL';
            } 
            else if (isLandingPermitCoord) {
                // CASO B: LANDING PERMIT (Por Categoría)
                if (isGeneralAviation) {
                    // Si es General: Usamos el precio de la categoría (así sea 700, 400 o 0)
                    newPriceUSD = categoryCoordFee;
                } else {
                    // Si es Comercial/FBO: La regla es que NO aplica tarifa de categoría.
                    // Forzamos 0 para limpiar cualquier precio "pegado" anterior.
                    newPriceUSD = 0;
                }
                newPriceMXN = exchangeRate ? parseFloat((newPriceUSD * exchangeRate).toFixed(2)) : 0;
                newAnchor = 'USD';
                pricingMethod = 'UPDATE_CAT_FEE';
            }
            else if (isRafCoordination) {
                // CASO C: RAF (Por Tabla MTOW / Clasificación)
                let calculatedRaf = 0;
                // Solo calculamos si hay una clasificación válida seleccionada
                if (currentClassificationId && rafTariffs.length > 0) {
                    const tariff = rafTariffs.find(t => parseInt(t.id_clasificacion) === parseInt(currentClassificationId));
                    if (tariff) {
                        calculatedRaf = isCaaMember ? parseFloat(tariff.costo_caa_usd) : parseFloat(tariff.costo_usd);
                    }
                }
                newPriceUSD = calculatedRaf;
                newPriceMXN = exchangeRate ? parseFloat((newPriceUSD * exchangeRate).toFixed(2)) : 0;
                newAnchor = 'USD';
                pricingMethod = 'UPDATE_RAF';
            }
            else if (isOvernight && currentMtow > 0) {
                // CASO C.5: OVERNIGHT (Fórmula especial)
                const tons = parseFloat(currentMtow.toFixed(2));
                let base = item.baseRate || 0;
                const totalCost = base * 2 * 24 * tons * 1.16;

                if (item.anchorCurrency === 'USD') {
                    newPriceUSD = totalCost;
                    newPriceMXN = exchangeRate ? parseFloat((totalCost * exchangeRate).toFixed(2)) : 0;
                } else {
                    newPriceMXN = totalCost;
                    newPriceUSD = exchangeRate ? parseFloat((totalCost / exchangeRate).toFixed(2)) : 0;
                }
                newAnchor = item.anchorCurrency;
                pricingMethod = 'UPDATE_OVERNIGHT';
            }
            else if ((isParking || isEmbarking) && currentMtow > 0) {
                // CASO C.6: PARKING & EMBARKING (Fórmula especial)
                const tons = parseFloat(currentMtow.toFixed(2));
                let base = item.baseRate || 0;
                const totalCost = base * 2 * tons * 1.16;

                if (item.anchorCurrency === 'USD') {
                    newPriceUSD = totalCost;
                    newPriceMXN = exchangeRate ? parseFloat((totalCost * exchangeRate).toFixed(2)) : 0;
                } else {
                    newPriceMXN = totalCost;
                    newPriceUSD = exchangeRate ? parseFloat((totalCost / exchangeRate).toFixed(2)) : 0;
                }
                newAnchor = item.anchorCurrency;
                pricingMethod = isParking ? 'UPDATE_PARKING' : 'UPDATE_EMBARKING';
            }
            else if (isTua) {
                // CASO C.7: TUA (Fórmula especial: Base MXN * 1.16)
                let base = item.baseRate || 0;
                if (item.anchorCurrency === 'USD') {
                    const baseMXN = parseFloat((base * exchangeRate).toFixed(2));
                    newPriceMXN = parseFloat((baseMXN * 1.16).toFixed(2));
                    newPriceUSD = exchangeRate ? parseFloat((newPriceMXN / exchangeRate).toFixed(2)) : 0;
                } else {
                    newPriceMXN = parseFloat((base * 1.16).toFixed(2));
                    newPriceUSD = exchangeRate ? parseFloat((newPriceMXN / exchangeRate).toFixed(2)) : 0;
                }
                newAnchor = item.anchorCurrency;
                pricingMethod = 'UPDATE_TUA';
            }
            else if (isLandingFee && isGeneralAviation && currentMtow > 0) {
                // CASO D: LANDING FEE (Recalcular con MTOW actual)
                let base = item.baseRate || 0;
                const tons = parseFloat(currentMtow.toFixed(2));
                const totalCost = base * tons * 1.16;

                if (item.anchorCurrency === 'USD') {
                    newPriceUSD = totalCost;
                    newPriceMXN = exchangeRate ? parseFloat((totalCost * exchangeRate).toFixed(2)) : 0;
                } else {
                    newPriceMXN = totalCost;
                    newPriceUSD = exchangeRate ? parseFloat((totalCost / exchangeRate).toFixed(2)) : 0;
                }
                newAnchor = item.anchorCurrency;
                pricingMethod = 'UPDATE_LANDING';
            }
            else {
                // Si no aplica ninguna regla dinámica, dejamos el item como estaba
                return item; 
            }

            // 5. RECALCULAR TOTALES
            const quantity = parseFloat(item.quantity) || 0;
            let finalPriceForCalc = newAnchor === 'USD' ? newPriceUSD : (newPriceMXN && exchangeRate ? newPriceMXN/exchangeRate : 0);
            
            const scPercentage = item.noSc ? 0 : (item.isScExempt ? 0 : (isCaaMember ? 0.10 : 0.18));
            const vatPercentage = item.noVat ? 0 : item.vatPercentage;

            const cost = quantity * finalPriceForCalc;
            const serviceCharge = cost * scPercentage;
            const vat = serviceCharge * vatPercentage;
            const total = cost + serviceCharge + vat;

            return {
                ...item,
                priceUSD: parseFloat(Number(newPriceUSD).toFixed(2)),
                priceMXN: parseFloat(Number(newPriceMXN).toFixed(2)),
                anchorCurrency: newAnchor,
                scPercentage,
                total: parseFloat(total.toFixed(2)),
                pricingMethod
            };
        }));
    }, [
        clientSpecialPrices,      // Se dispara al cambiar Cliente
        currentClassificationId,  // Se dispara al cambiar Avión
        currentOpCatID,           // <--- AHORA SÍ: Se dispara al cambiar Categoría
        categoryCoordFee,         
        isCaaMember,              
        currentMtow,              
        exchangeRate,             
        isGeneralAviation         
    ]);

    const handleCaaChange = useCallback((isMember) => {
        setIsCaaMember(isMember);
    }, []);

    const handleAddItem = () => {
        // Determinar la categoría de "Additional Services" según el tipo de aviación
        let correctCategory = isGeneralAviation 
            ? 'Additional Services General Aviation' 
            : 'Additional Services Commercial Aviation';

        const initialSc = getApplicableScPercentage();

        const newItem = {
            description: '',
            category: correctCategory,
            quantity: 1,
            priceMXN: 0,
            priceUSD: 0,
            scPercentage: initialSc,
            vatPercentage: globalNoVat ? 0 : 0.16,
            noSc: globalNoSc,
            noVat: globalNoVat,
            anchorCurrency: 'MXN',
            total: 0,
        };
        setItems([...items, newItem]);
    };

    const handleClearQuote = () => {
        setIsClearQuoteModalOpen(true);
    };

    const handleClerQuote = () => {
        if (quoteFormRef.current) {
            quoteFormRef.current.clearAllFields();
        }
        setItems([]);
        setAllServices([]);
        setIsClearQuoteModalOpen(false);
        setIsReadOnly(false);
    };

    const handleRemoveItem = (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleUpdateItem = (index, field, value) => {
        if (!exchangeRate) return;

        if (field === 'scPercentage' && globalNoSc) {
            setGlobalNoSc(false);
        }
        if (field === 'vatPercentage' && globalNoVat) {
            setGlobalNoVat(false);
        }

        setItems(prevItems => {
            const newItems = [...prevItems];
            // IMPORTANTE: Crear copia del objeto para no mutar estado directamente
            const item = { ...newItems[index] };

            // Marcar que el precio fue editado manualmente (Protege Landing Fee y Overnight)
            if (field === 'priceMXN' || field === 'priceUSD') {
                item.manualPrice = true;
            }

            item[field] = value;

            if (field === 'priceMXN') {
                item.priceUSD = parseFloat(Number((value || 0) / exchangeRate).toFixed(2));
                item.anchorCurrency = 'MXN';
            } else if (field === 'priceUSD') {
                item.priceMXN = parseFloat(Number((value || 0) * exchangeRate).toFixed(2));
                item.anchorCurrency = 'USD';
            }

            item.total = calculateItemTotal(item);
            newItems[index] = item;
            return newItems;
        });
    };

    const handleSaveServices = (selectedServicesFromModal) => {
        if (!exchangeRate) return;

        const allServiceDescriptions = new Set(allServices.map(s => s.nombre_concepto_default));
        const manualItems = items.filter(item => !allServiceDescriptions.has(item.description));

        const processedServiceItems = selectedServicesFromModal.map(service => {
            const existingItem = items.find(item => item.description === service.name);

            if (existingItem) {
                return existingItem;
            }

            const isExempt = !!service.exento_sc;
            const isUSD = service.divisa?.trim().toUpperCase() === 'USD';
            const rawRate = parseFloat(service.tarifa_servicio) || 0;

            const isLandingFee = service.nombre_concepto_default.toUpperCase().includes('LANDING FEE');
            const isLandingPermitCoord = service.name === LANDING_PERMIT_COORD;
            const isRafCoordination = service.name.includes('RAF Coordination');
            const isOvernight = service.name.toUpperCase().includes('OVERNIGHT (PER NIGHT)');
            const isParking = service.name.toUpperCase().includes('PARKING FEE');
            const isEmbarking = service.name.toUpperCase().includes('EMBARKING / DISEMBARKING');
            const isTua = service.name.toUpperCase() === 'TUA';

            // --- NUEVO: LÓGICA DE PRECIO ESPECIAL 
            const serviceID = service.id || service.id_concepto_std; // Aseguramos el ID
            const currentFlightTypeData = quoteFormRef.current?.getFormData(); 
            const currentOpCatID_Local = currentFlightTypeData?.flightType; 

            // 1. Buscar reglas para este servicio
            const serviceRules = clientSpecialPrices.filter(sp => sp.id_concepto_std == serviceID);
            
            // 2. Buscar coincidencia exacta o global
            let specialPriceObj = serviceRules.find(sp => sp.id_cat_operacion == currentOpCatID_Local);
            if (!specialPriceObj) {
                specialPriceObj = serviceRules.find(sp => sp.id_cat_operacion == null);
            }

            // 3. Decidir si usamos precio especial
            let useSpecialPrice = false;
            if (specialPriceObj) {
                const spCost = parseFloat(specialPriceObj.costo_servicio);
                if (spCost > 0 || !isRafCoordination) {
                    useSpecialPrice = true;
                }
            }

            let priceMXN = 0;
            let priceUSD = 0;
            let anchorCurrency = isUSD ? 'USD' : 'MXN';

            // 1. PRECIO ESPECIAL (REVA, PCJ, ETC.)
            if (useSpecialPrice) {
                const specialCost = parseFloat(specialPriceObj.costo_servicio);
                priceUSD = specialCost;
                priceMXN = parseFloat((priceUSD * exchangeRate).toFixed(2));
                anchorCurrency = 'USD';
            }
            // 2. Landing Permit Coordination (Estándar)
            else if (isLandingPermitCoord) {
                if (isGeneralAviation) {
                    priceUSD = categoryCoordFee;
                } else {
                    priceUSD = 0; // Limpieza automática en Comercial
                }
                
                priceMXN = parseFloat((priceUSD * exchangeRate).toFixed(2));
                anchorCurrency = 'USD';
            }
            // 3. Landing Fee con MTOW (Estándar)
            else if (isLandingFee && isGeneralAviation && currentMtow > 0) {
                const tons = parseFloat(currentMtow.toFixed(2));
                const calculatedBase = rawRate * tons * 1.16;
                if (isUSD) {
                    priceUSD = parseFloat(calculatedBase.toFixed(2));
                    priceMXN = exchangeRate ? parseFloat((calculatedBase * exchangeRate).toFixed(2)) : 0;
                } else {
                    priceMXN = parseFloat(calculatedBase.toFixed(2));
                    priceUSD = exchangeRate ? parseFloat((calculatedBase / exchangeRate).toFixed(2)) : 0;
                }
            }
            // 4. RAF Coordination (Estándar MTOW)
            else if (isRafCoordination) {
                if (currentClassificationId) {
                    const tariff = rafTariffs.find(t => 
                        parseInt(t.id_clasificacion) === parseInt(currentClassificationId)
                    );
                    if (tariff) {
                        if (isCaaMember) {
                            priceUSD = parseFloat(tariff.costo_caa_usd) || 0;
                        } else {
                            priceUSD = parseFloat(tariff.costo_usd) || 0;
                        }
                    }
                }
                priceMXN = parseFloat((priceUSD * exchangeRate).toFixed(2));
                anchorCurrency = 'USD';
            }
            // 4.5 Overnight (Fórmula especial)
            else if (isOvernight && currentMtow > 0) {
                const tons = parseFloat(currentMtow.toFixed(2));
                const calculatedBase = rawRate * 2 * 24 * tons * 1.16;
                if (isUSD) {
                    priceUSD = parseFloat(calculatedBase.toFixed(2));
                    priceMXN = exchangeRate ? parseFloat((calculatedBase * exchangeRate).toFixed(2)) : 0;
                } else {
                    priceMXN = parseFloat(calculatedBase.toFixed(2));
                    priceUSD = exchangeRate ? parseFloat((calculatedBase / exchangeRate).toFixed(2)) : 0;
                }
            }
            // 4.6 Parking & Embarking (Fórmula especial)
            else if ((isParking || isEmbarking) && currentMtow > 0) {
                const tons = parseFloat(currentMtow.toFixed(2));
                const calculatedBase = rawRate * 2 * tons * 1.16;
                if (isUSD) {
                    priceUSD = parseFloat(calculatedBase.toFixed(2));
                    priceMXN = exchangeRate ? parseFloat((calculatedBase * exchangeRate).toFixed(2)) : 0;
                } else {
                    priceMXN = parseFloat(calculatedBase.toFixed(2));
                    priceUSD = exchangeRate ? parseFloat((calculatedBase / exchangeRate).toFixed(2)) : 0;
                }
            }
            // 4.7 TUA (Fórmula especial)
            else if (isTua) {
                if (isUSD) {
                    const baseMXN = parseFloat((rawRate * exchangeRate).toFixed(2));
                    priceMXN = parseFloat((baseMXN * 1.16).toFixed(2));
                    priceUSD = exchangeRate ? parseFloat((priceMXN / exchangeRate).toFixed(2)) : 0;
                } else {
                    priceMXN = parseFloat((rawRate * 1.16).toFixed(2));
                    priceUSD = exchangeRate ? parseFloat((priceMXN / exchangeRate).toFixed(2)) : 0;
                }
            }
            // 5. LÓGICA NORMAL (Default BD)
            else {
                if (isUSD) {
                    priceUSD = parseFloat(rawRate.toFixed(2));
                    priceMXN = parseFloat((priceUSD * exchangeRate).toFixed(2));
                } else {
                    priceMXN = parseFloat(rawRate.toFixed(2));
                    priceUSD = parseFloat((priceMXN / exchangeRate).toFixed(2));
                }
            }

            const quantity = 1;
            const scPercentage = isExempt ? 0 : getApplicableScPercentage();
            const vatPercentage = globalNoVat ? 0 : 0.16;

            const cost = quantity * priceUSD;
            const serviceCharge = cost * scPercentage;

            const baseForVat = (scPercentage === 0) ? cost : serviceCharge;
            const vat = baseForVat * vatPercentage;
            const total = cost + serviceCharge + vat;

            return {
                id: service.id || service.id_concepto_std, 
                description: service.name,
                category: service.description,
                quantity,
                priceMXN,
                priceUSD,
                scPercentage,
                vatPercentage,
                noSc: isExempt || globalNoSc,
                noVat: globalNoVat,
                anchorCurrency,
                baseRate: rawRate,
                total,
                isScExempt: isExempt,
            };
        });

        setItems([...manualItems, ...processedServiceItems]);
    };

    const confirmAndSaveQuote = async () => {
        if (quoteFormRef.current) {
            const isValid = quoteFormRef.current.validate(exchangeRate);
            if (!isValid) {
                setIsSaveQuoteModalOpen(false);
                return;
            }

            // Validar que haya al menos un servicio
            if (items.length === 0) {
                console.error('Cannot save quote without services');
                alert('Por favor, agregue al menos un servicio antes de guardar la cotización.');
                setIsSaveQuoteModalOpen(false);
                return;
            }

            const rawData = quoteFormRef.current.getFormData();

            // Validar que haya nombre de aeropuerto válido
            if (!rawData.stationName) {
                console.error('Station name is required');
                alert('Por favor, ingrese el nombre del aeropuerto.');
                setIsSaveQuoteModalOpen(false);
                return;
            }

            const itemsToSave = items.map(item => {
                let finalScPercentage = item.scPercentage;
                let finalVatPercentage = item.vatPercentage;
                
                if (globalNoSc && !item.isScExempt) {
                    finalScPercentage = 0;
                }
                
                if (globalNoVat) {
                    finalVatPercentage = 0;
                }
                
                return {
                    ...item,
                    scPercentage: finalScPercentage,
                    vatPercentage: finalVatPercentage,
                    noSc: item.isScExempt ? false : globalNoSc,
                    noVat: globalNoVat,
                };
            });

            const servicios = itemsToSave.map(item => {
                const quantity = parseFloat(item.quantity) || 0;
                const costo_mxn = parseFloat(Number(item.priceMXN || 0).toFixed(2));
                const costo_usd = parseFloat(Number(item.priceUSD || 0).toFixed(2));
                const s_cargo = parseFloat(Number(quantity * costo_usd * (item.scPercentage || 0)).toFixed(2));

                // --- CAMBIO AQUÍ ---
                // Calculamos la base cruda antes de redondear para mayor precisión, o usamos los valores ya calculados
                const rawCost = quantity * costo_usd;
                const rawSc = rawCost * (item.scPercentage || 0);
                const baseForVat = (item.scPercentage === 0) ? rawCost : rawSc;
                const vat = parseFloat(Number(baseForVat * (item.vatPercentage || 0)).toFixed(2));

                // Recalculamos el total final para asegurar consistencia
                const total_usd = parseFloat((rawCost + rawSc + (baseForVat * (item.vatPercentage || 0))).toFixed(2));


                return {
                    nombre_servicio: item.description,
                    cantidad: item.quantity,
                    costo_mxn: costo_mxn,
                    costo_usd: costo_usd,
                    sc_porcentaje: item.scPercentage,
                    vat_porcentaje: item.vatPercentage,
                    noSc: item.noSc,
                    noVat: item.noVat,
                    s_cargo: s_cargo,
                    vat: vat,
                    total_usd: total_usd,
                    nombre_cat_concepto: item.category,
                };
            });

            const quoteData = {
                date: rawData.date,
                exchangeRate: rawData.exchangeRate,
                quotedBy: rawData.quotedBy,
                isCaaMember: rawData.isCaaMember,
                attn: rawData.attn,
                eta: rawData.eta,
                etd: rawData.etd,
                crewFrom: rawData.crewFrom,
                paxFrom: rawData.paxFrom,
                crewTo: rawData.crewTo,
                paxTo: rawData.paxTo,
                mtow: rawData.mtow,
                mtow_unit: rawData.mtow_unit,

                total_costo: totals.cost,
                total_s_cargo: totals.sCharge,
                total_vat: totals.vat,
                total_final: totals.total,

                customer: {
                    id: rawData.customer,
                    label: rawData.customerName
                },

                aircraftModel: { 
                    id: rawData.aircraftModel,
                    label: rawData.aircraftRegistrationValue,
                    id_modelo_aeronave: rawData.aircraftModelId,
                    modelo: rawData.aircraftModelName
                },

                flightType: {
                    id: rawData.flightType,
                    label: rawData.flightTypeName
                },

                station: rawData.station ? {
                    id: rawData.station,
                    label: rawData.stationName
                } : {
                    id: null,
                    label: rawData.stationName  // Enviar el nombre manual del aeropuerto
                },

                fbo: rawData.fbo || rawData.fboName
                    ? { id: rawData.fbo, label: rawData.fboName }
                    : undefined,  // Cambiar de null a undefined para ignorarlo mejor

                from: rawData.from || rawData.fromName
                    ? { id: rawData.from, label: rawData.fromName }
                    : null,

                to: rawData.to || rawData.toName
                    ? { id: rawData.to, label: rawData.toName }
                    : null,

                servicios: servicios
            };

            console.log("Payload enviado al Backend:", quoteData);
            try {
                const response = await api.post('/cotizaciones', quoteData);
                console.log('Quote saved successfully:', response.data);
                onNavigateToHistorico();
            } catch (error) {
                console.error('Error saving quote:', error);
            }
        }
        setIsSaveQuoteModalOpen(false);
    };

    const handleSaveQuote = () => {
        if (quoteFormRef.current) {
            const isValid = quoteFormRef.current.validate(exchangeRate);
            if (isValid) {
                setIsSaveQuoteModalOpen(true);
            }
        }
    };

    const handleSaveAsNew = () => {
        if (quoteFormRef.current) {
            quoteFormRef.current.clearQuoteNumberOnly();

            const token = localStorage.getItem('token');
            let loggedInUser = '';
            if (token) {
                try {
                    const decodedToken = jwtDecode(token);
                    loggedInUser = decodedToken.username || '';
                } catch (error) {
                    console.error("Error decoding token:", error);
                }
            }

            quoteFormRef.current.setQuotedByValue(loggedInUser);
            const currentFormData = quoteFormRef.current.getAllFormData();

            onCloneQuote({
                ...currentFormData,
                quotedBy: loggedInUser,
                items: items,
                servicios: items,
                exchangeRate: exchangeRate,
                isClone: true,
            });
        }
    };

    const handlePreviewPdf = () => {
        setOnNewQuoteBlocked(true);
        if (quoteFormRef.current) {
            const isValid = quoteFormRef.current.validate(exchangeRate);
            if (!isValid) {
                setOnNewQuoteBlocked(false);
                return;
            }
            const formData = quoteFormRef.current.getFormData();
            const fullPdfData = {
                formData: {
                    ...formData,
                    totalEnPalabras: totalEnPalabras,
                },
                items: items,
                totals: totals,
            };

            setPdfData(fullPdfData);
            setPdfDocumentComponent(() => QuotePDFDocument);
            setIsPdfPreviewOpen(true);
        }
    };

    const handlePreviewClientPdf = () => {
        setOnNewQuoteBlocked(true);
        if (quoteFormRef.current) {
            const isValid = quoteFormRef.current.validate(exchangeRate);
            if (!isValid) {
                setOnNewQuoteBlocked(false);
                return;
            }
            const formData = quoteFormRef.current.getFormData();
            const fullPdfData = {
                formData: {
                    ...formData,
                    totalEnPalabras: totalEnPalabras,
                },
                items: items,
                totals: totals,
            };

            setPdfData(fullPdfData);
            setPdfDocumentComponent(() => QuotePDFClientDocument);
            setIsPdfPreviewOpen(true);
        }
    };

    const handleSelectOpsPdf = () => {
        setPdfDocumentComponent(() => QuotePDFDocument);
        setIsPdfSelectionModalOpen(false);
        setIsPdfPreviewOpen(true);
    };

    const handleSelectClientPdf = () => {
        setPdfDocumentComponent(() => QuotePDFClientDocument);
        setIsPdfSelectionModalOpen(false);
        setIsPdfPreviewOpen(true);
    };

    const initialSelectedServices = items
        .filter(item => allServices.some(s => s.nombre_concepto_default === item.description))
        .map(item => {
            const service = allServices.find(s => s.nombre_concepto_default === item.description);
            return {
                ...service,
                id: service.id_precio_concepto || service.id_concepto_std,
                name: service.nombre_concepto_default,
                description: service.nombre_cat_concepto
            };
        });

    // Función que ejecutará QuoteForm cuando el usuario seleccione un cliente
    // Función que ejecutará QuoteForm cuando el usuario seleccione un cliente
    const handleCustomerSelect = (customer) => {
        if (customer && customer.id_cliente) {
            console.log("Cliente:", customer.nombre_cliente, "ID:", customer.id_cliente);
            
            // 1. Detectar si el cliente tiene una Tasa Especial (Ej. REVA = 0.15)
            const customerIdStr = String(customer.id_cliente);
            const specialRate = CLIENTS_WITH_SPECIAL_SC[customerIdStr];

            // Definimos cuál será el porcentaje objetivo para los items NO exentos
            // Si hay specialRate usalo, si no, usa la lógica estándar (10% CAA o 18% Normal)
            const targetRate = specialRate !== undefined ? specialRate : (isCaaMember ? 0.10 : 0.18);

            if (specialRate !== undefined) {
                setCustomScRate(specialRate);
            } else {
                setCustomScRate(null);
            }

            // 2. Cargar servicios especiales (Base de datos)
            api.get(`/clientes/${customer.id_cliente}/servicios-especiales`)
                .then(res => setClientSpecialPrices(res.data))
                .catch(err => console.error(err));

            // 3. ACTUALIZAR ITEMS (ROMPIENDO CANDADO MANUAL)
            setItems(prevItems => prevItems.map(item => {
                
                // PROTECCIÓN CRÍTICA: 
                // Si el item es exento por BD (isScExempt) O ya estaba en 0% (y no fue un error manual),
                // debe mantenerse en 0% sin importar qué cliente sea.
                const shouldBeExempt = item.isScExempt || (item.scPercentage === 0 && !item.manualPrice);

                return {
                    ...item,
                    // A) Rompemos el candado manual para que se recalculen los PRECIOS BASE (USD/MXN)
                    manualPrice: false, 
                    
                    // B) Recalculamos el SC:
                    // Si es exento (Agent, APIS) -> Se queda en 0.
                    // Si NO es exento -> Toma la tasa del cliente (15% o 18%).
                    scPercentage: shouldBeExempt ? 0 : targetRate,
                    noSc: shouldBeExempt
                };
            }));

        } else {
            // Si borran el cliente, limpiamos todo
            setClientSpecialPrices([]);
            setCustomScRate(null);
        }
    };

   
    return (
        <div className="bg-blue-dark p-8">
            <div className="bg-gray-50 min-h-screen rounded-lg shadow-lg p-6">
                <QuoteHeader
                    onClearQuote={handleClearQuote}
                    onSaveQuote={handleSaveQuote}
                    onExportToPdf={handlePreviewPdf}
                    onExportToClientPdf={handlePreviewClientPdf}
                    isReadOnly={isReadOnly}
                    onNewQuoteBlocked={onNewQuoteBlocked}
                    onSaveAsNew={handleSaveAsNew}
                />
                <main className="max-w-7xl mx-auto mt-4">
                    <QuoteForm
                        ref={quoteFormRef}
                        onAddItem={handleAddItem}
                        onCaaChange={handleCaaChange}
                        onMtowChange={handleMtowChange}
                        onOpenServiceModal={() => setIsModalOpen(true)}
                        onSelectionChange={fetchServices}
                        exchangeRate={exchangeRate || ''}
                        onExchangeRateChange={(value) => setExchangeRate(parseFloat(value) || 0)}
                        isReadOnly={isReadOnly}
                        onDataLoaded={() => setIsFormReady(true)}
                        globalNoSc={globalNoSc}
                        globalNoVat={globalNoVat}
                        onGlobalNoScChange={(e) => handleGlobalCheckboxChange(setGlobalNoSc, e.target.checked)}
                        onGlobalNoVatChange={(e) => handleGlobalCheckboxChange(setGlobalNoVat, e.target.checked)}
                        onCategoryFeeChange={handleCategoryFeeChange}
                        onClassificationChange={handleClassificationChange}
                        onCustomerChange={handleCustomerSelect}
                        onFlightTypeChange={handleFlightTypeChange}
                    />
                    <QuoteTable
                        items={items}
                        onRemoveItem={handleRemoveItem}
                        onUpdateItem={handleUpdateItem}
                        isReadOnly={isReadOnly}
                        globalNoSc={globalNoSc}
                        globalNoVat={globalNoVat}
                    />
                    <QuoteTotal totals={totals} />
                </main>
                <AddServiceModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveServices}
                    initialSelectedServices={initialSelectedServices}
                    allServices={allServices.map(s => ({
                        ...s,
                        id: s.id_precio_concepto || s.id_concepto_std,
                        name: s.nombre_concepto_default,
                        description: s.nombre_cat_concepto
                    }))}
                />
                <ConfirmationModal
                    isOpen={isClearQuoteModalOpen}
                    onClose={() => setIsClearQuoteModalOpen(false)}
                    onConfirm={handleClerQuote}
                    title="Clear Quote"
                    icon={ExclamationTriangleIcon}
                    iconBgColorClass="bg-red-100"
                    iconColorClass="text-red-600"
                >
                    <p className="text-base text-gray-700">¿Are you sure you want to clear this quote?</p>
                </ConfirmationModal>

                <ConfirmationModal
                    isOpen={isSaveQuoteModalOpen}
                    onClose={() => setIsSaveQuoteModalOpen(false)}
                    onConfirm={confirmAndSaveQuote}
                    title="Save Quote"
                    icon={InboxArrowDownIcon}
                    iconBgColorClass="bg-blue-100"
                    iconColorClass="text-blue-600"
                >
                    <p className="text-base text-gray-700">Do you want to save this quote?</p>
                </ConfirmationModal>

                <PDFPreviewModal
                    isOpen={isPdfPreviewOpen}
                    onClose={() => {
                        setIsPdfPreviewOpen(false);
                        if (totalEnPalabras && totalEnPalabras.startsWith('JOIN OF:')) {
                            onNavigateToHistorico();
                        } else if (quoteId) {
                            setOnNewQuoteBlocked(false);
                        }
                    }}
                    pdfData={pdfData}
                    DocumentComponent={pdfDocumentComponent}
                    fileName={`Quote ${pdfData?.formData?.quoteNumber || 'Draft'}.pdf`}
                />
                <PDFSelectionModal
                    isOpen={isPdfSelectionModalOpen}
                    onClose={() => {
                        setIsPdfSelectionModalOpen(false);
                        onNavigateToHistorico();
                    }}
                    onSelectOps={handleSelectOpsPdf}
                    onSelectClient={handleSelectClientPdf}
                />
            </div>
        </div>
    );
}

export default NewQuote;