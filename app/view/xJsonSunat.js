// cocina la data del comprobante electronico en un json para ser enviada a la sunat 
//

// xArrayCuerpo (items) debe tener estructura de mod impresion, (como sub pedido ::app3_sys_dta_pe)
// xArraySubTotales ya esta calculado los subtotales
// xArrayComprobante datos del comprobante : tipodoc , serie correlativo id's
// xArrayCliente datos del cliente nombre dni ruc direccion

async function xJsonSunatCocinarDatos(xArrayCuerpo, xArraySubTotales, xArrayComprobante, xArrayCliente, idregistro_pago) {
    var hash = {};
    var _arrSedes = xm_log_get('datos_org_sede'); // todas las sedes
    const isFacturacionElectronica = _arrSedes[0].facturacion_e_activo === "0" ? false : true; // si se emiten comprobantes electronicos    

    if (!isFacturacionElectronica || xArrayComprobante.codsunat === "0") { // porque puede ser ticket
        hash.ok=true;
        hash.qr='';
        hash.hash = '';
        hash.external_id = "";
        return hash;   
    }
    
    // evalua si I.G.V es = 0 esta exonerado
    var procentajeIGV = 0;
    var xCartaSubtotales=xm_log_get('carta_subtotales');

    xCartaSubtotales.filter(x => x.descripcion.indexOf('I.G.V') > -1)
        .map(x => procentajeIGV = x);
    const valIGV = parseFloat(procentajeIGV.monto);
    const isExoneradoIGV = procentajeIGV.activo === "1" ? true : false; //1 = desactivado => exonerado



    console.log('xArrayComprobante.correlativo C', xArrayComprobante.correlativo);
    // cambio para sumar los costos negativos, si es que es delivery y el comercio paga
	xArraySubTotales = darFormatoSubTotalesParaFacturacion(xArraySubTotales, false);

    // cpe = false subtotal + adicional -> lo ponemos en xImprimirComprobanteAhora() // para mostrar en la impresion
    var xitems = xEstructuraItemsJsonComprobante(xArrayCuerpo, xArraySubTotales, false);
    xitems = xJsonSunatCocinarItemDetalle(xitems, valIGV, isExoneradoIGV);


    // array encabezado org sede
    var xArrayEncabezado = xm_log_get('datos_org_sede');
    const logo64 = xArrayEncabezado[0].logo64.split("base64,")[1]; 
    var items = [], fecha_actual = '', hora_actual = '';
    var xnum_doc_cliente = xArrayCliente.num_doc;

    const abreviaCo = xArrayComprobante.descripcion.substr(0,1).toUpperCase();

    const xtipo_de_documento_identidad_cliente = xnum_doc_cliente.length >= 10 ? 6 : 1;
    const xtipo_de_documento_comprobante = xArrayComprobante.codsunat;
    const xidtipo__comprobante_serie = xArrayComprobante.idtipo_comprobante_serie;


    // si viene dni sin valor '00000000 = publico en general'
    xnum_doc_cliente = xnum_doc_cliente.length === 0 ? '00000000' : xnum_doc_cliente;

    // Importe total a pagar siempre ultimo es es el total
	const index_total = xArraySubTotales.length-1;
    let importe_total_pagar = parseFloat(xArraySubTotales[index_total].importe);
    let importe_total_pagar_calc_igv = importe_total_pagar;
    const importe_total_igv = xArraySubTotales.filter(x => x.descripcion === 'I.G.V').map( x => x.importe)[0] || 0;
    const itemDescuento = xArraySubTotales.filter(x => x.id === 6 )[0];    
    const isHayDescuento = !!itemDescuento;
    var _base = 0;
    
    //verifica si esta exonerado al igv /*/ caso de la selva u otros ubigeos exonerados del igv
    // const isExoneradoIGV = true;
    // let total_valor_de_venta_operaciones_gravadas = 0,total_valor_de_venta_operaciones_exoneradas = 0, leyenda = [];
    let totales = {};
    let descuento = [];
    let descuentoEnTotal = 0;

    
    if (  isHayDescuento ) {
        descuentoEnTotal = parseFloat(itemDescuento.importe) * -1;
        // importe_total_pagar = importe_total_pagar + descuentoEnTotal;
        // importe_total_pagar = importe_total_pagar + descuentoEnTotal;

        // _base = importe_total_pagar - parseFloat(importe_total_igv) + descuentoEnTotal;
        // const porcentaje_dsc = (descuentoEnTotal / _base).toFixed(2);

        // 040921// si hay descuentos no se registra en factura, la sunat no tiene claro que le importe el descuento, no hay ejemplos y xml da error
        // solo el igv
        // descuento = [
        //     {
        //     "codigo": "00",
        //     "descripcion": "Descuento Global afecta a la base imponible",
        //     "porcentaje": porcentaje_dsc,
        //     "monto": descuentoEnTotal,
        //     "base": _base
        //     }
        // ];



        importe_total_pagar += descuentoEnTotal;

        descuentoEnTotal = 0;

    }


    if ( isExoneradoIGV ) { // exonerado del igv
     
        //totales
        // totales = {
        //     "total_descuentos": descuentoEnTotal,
        //     "total_exportacion": 0.00,
        //     "total_operaciones_gravadas": 0.00,
        //     "total_operaciones_inafectas": 0.00,
        //     "total_operaciones_exoneradas": importe_total_pagar,
        //     "total_operaciones_gratuitas": 0.00,
        //     "total_igv": 0.00,
        //     "total_impuestos": 0.00,
        //     "total_valor": importe_total_pagar,
        //     "total_venta": importe_total_pagar
        // }

        totales = {
            "total_descuentos": descuentoEnTotal,
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": 0.00,
            "total_operaciones_inafectas": 0.00,
            "total_operaciones_exoneradas": importe_total_pagar + descuentoEnTotal,
            "total_operaciones_gratuitas": 0.00,
            "total_igv": 0.00,
            "total_impuestos": 0.00,
            "total_valor": importe_total_pagar,
            "total_venta": importe_total_pagar
        }


        
    } else {

        const total_operaciones_gravadas = descuentoEnTotal > 0 ? (importe_total_pagar_calc_igv - parseFloat(importe_total_igv)) + descuentoEnTotal : xArraySubTotales[0].importe; // el subtotal
        // const total_operaciones_gravadas = xArraySubTotales[0].importe; // el subtotal
        const _total_valor = descuentoEnTotal > 0 ? _base - descuentoEnTotal : importe_total_pagar - parseFloat(importe_total_igv);
        const _total_venta = importe_total_pagar_calc_igv;

        totales = {
            "total_descuentos": descuentoEnTotal,
            "total_descuentos": 0.00,
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": total_operaciones_gravadas,
            "total_operaciones_inafectas": 0.00,
            "total_operaciones_exoneradas": 0.00,
            "total_operaciones_gratuitas": 0.00,
            "total_igv": importe_total_igv,
            "total_impuestos": importe_total_igv,
            "total_valor": _total_valor,
            "total_venta": _total_venta
        }
    }

    totales.total_descuentos = descuentoEnTotal;


    // fecha actual del servidor
    // cabecera

    
    // console.log('paso I');
    // $.ajax({type: 'POST', url: '../../bdphp/log_001.php', data:{'p_from':'z'}})
    // .done( function (rptDate) {        
        
        const _fecha = xSetInputDate(xDevolverFecha());
        const _hora = xDevolverHora();
        
        rptDate = `${_fecha}|${_hora}`;
        rptDate=rptDate.split('|');

        const fecha_manual = xArrayComprobante.fecha_manual || null; // para regularizar desde facturador

        fecha_actual = fecha_manual === null ? rptDate[0] : fecha_manual;
        hora_actual = rptDate[1];    

        const direccionEmisor = xArrayEncabezado[0].sededireccion === '' ? xArrayEncabezado[0].direccion : xArrayEncabezado[0].sededireccion;
        const nomComercioEmisor = xArrayEncabezado[0].sedenombre;
        // console.log('xArrayEncabezado[0]', xArrayEncabezado);

        // "numero_documento": xArrayComprobante.correlativo,
        const telefonoCliente = xArrayCliente?.telefono || '';


        // para evitar que me
        // const _isNotIntNumComprobante = isNaN(parseInt(xArrayComprobante.correlativo));
        // if ( !xArrayComprobante.correlativo || xArrayComprobante.correlativo === '' || _viene_facturador || xArrayComprobante.correlativo === '#' || _isNotIntNumComprobante) {
        //     // estas lineas lo eliminaremos
        //     const numComprobante = await xGetCorrelativoComprobante(xArrayComprobante);
        //     xArrayComprobante.correlativo = numComprobante; 
        // }

        console.log('xArrayComprobante.correlativo D', xArrayComprobante.correlativo);

        comprobarNumCorrelativoComprobante(xArrayComprobante);

        const _nomCliente = xArrayCliente?.nombres || 'PUBLICO EN GENERAL';
        const _fechaMetodoPago = xArrayComprobante.forma_de_pago?.fecha_de_pago || '';
        const _fechaVencimiento = _fechaMetodoPago !== '' ? _fechaMetodoPago : fecha_actual;

        var jsonData = {                    
            "serie_documento": `${abreviaCo}${xArrayComprobante.serie}`,
            "numero_documento": xArrayComprobante.correlativo,
            "fecha_de_emision": `${fecha_actual}`,
            "hora_de_emision": `${hora_actual}`,
            "codigo_tipo_operacion": "0101",
            "codigo_tipo_documento": `${xtipo_de_documento_comprobante}`,
            "codigo_tipo_moneda": "PEN",
            "fecha_de_vencimiento": `${_fechaVencimiento}`,
            "numero_orden_de_compra": "",
            "datos_del_emisor": {
                "codigo_pais": "PE",
                "ubigeo": xArrayEncabezado[0].ubigeo,
                "direccion": `${direccionEmisor} `+ ' | ' + `${xArrayEncabezado[0].sedeciudad}`,
                "correo_electronico": "",
                "telefono": `${xArrayEncabezado[0].telefono}`,
                "codigo_del_domicilio_fiscal": xArrayEncabezado[0].codigo_del_domicilio_fiscal                
            },  
            "datos_del_cliente_o_receptor":{
                "codigo_tipo_documento_identidad": `${xtipo_de_documento_identidad_cliente}`,
                "numero_documento": `${xnum_doc_cliente}`,
                "apellidos_y_nombres_o_razon_social": `${_nomCliente.trim() === "" ? "PUBLICO EN GENERAL" : _nomCliente}`,
                "codigo_pais": "PE",
                "ubigeo": "150101",
                "direccion": xArrayCliente.direccion,
                "correo_electronico": "",
                "telefono": `${telefonoCliente}`
            },
            "descuentos": descuento,
            "totales": totales,
            "items": xitems,
            "extras":{
                "forma_de_pago": xArrayComprobante.forma_de_pago,
                "observaciones": "",
                "vendedor": "",
                "caja": "",
                "idcliente": xArrayCliente.idcliente
            }

        }


        const _viene_facturador = typeof idregistro_pago === "object" ? 1 : 0; 

        
        // console.log(JSON.stringify(jsonData));

        // espera respuesta numero comprobante
        // hash = xSendApiSunat(jsonData, idregistro_pago, xidtipo__comprobante_serie, true, nomComercioEmisor);        

        // console.log('paso j');
        // si viene del facturador espera respuesta o si el numero comprobante es #
        if ( _viene_facturador === 1 || xArrayComprobante.correlativo === '#') {
            hash = xSendApiSunat(jsonData, idregistro_pago, xidtipo__comprobante_serie, true, nomComercioEmisor);                    
        } else {
            // 310721 // para que sea mas rapido
            // no espera respuesta porque ya se sabe el numero del comprobante
            xSendApiSunat(jsonData, idregistro_pago, xidtipo__comprobante_serie, true, nomComercioEmisor);
    
            hash.ok = true;
            hash.qr = '';
            hash.hash = "www.papaya.com.pe";
            hash.external_id = '';
            hash.correlativo_comprobante =  xArrayComprobante.correlativo;

        }

        // console.log('paso k');

        return hash;

    // });
    
}


function xJsonSunatCocinarItemDetalle(items, ValorIGV, isExoneradoIGV ) {
    var xListItemsRpt =[];
    const procentaje_IGV = parseFloat(parseFloat(ValorIGV)/100);
    
    // var valor_referencial_unitario_por_item_en_operaciones_no_onerosas_y_codigo = {"monto_de_valor_referencial_unitario": "01", "codigo_de_tipo_de_precio": "02"};

    items.map( (x, index) => {
        index++;
        

        let codigo_tipo_afectacion_igv = "20";
        let total_base_igv = 0.01;
        let total_igv = 0;
        let total_valor_item = parseFloat(x.precio_total).toFixed(2);
        let _precio_unitario = x.punitario || x.precio_total;



        // verificamos que el precio del item no sea igual 0
        const _pTotal = parseFloat(x.precio_total);
        var _pUnitario = parseFloat(_precio_unitario);
        const _cantidad = parseFloat(x.cantidad);
        if ( _pTotal === 0 ) { return; }

        // chequeamos que la cantidad * punitario = ptotal
        const _totalCalc = _cantidad * _pUnitario;
        if ( _totalCalc !==  _pTotal) {
            _pUnitario = _pTotal / _cantidad;
            _precio_unitario = _pUnitario.toFixed(2);            
        }


        let _valor_unitario = _precio_unitario;


        if (!isExoneradoIGV) {// con igv
        //   valor_referencial_unitario_por_item_en_operaciones_no_onerosas_y_codigo = { monto_de_valor_referencial_unitario: "01" };
        //   total_base_igv = parseFloat(x.precio_total); //parseFloat(x.precio_total) - total_igv;  // cambio x error 3103 IGV // 12/07/2020
        //   _precio_unitario = parseFloat(_precio_unitario) + parseFloat(total_igv); 

          codigo_tipo_afectacion_igv = "10";
          total_igv = parseFloat(parseFloat(x.precio_total) * procentaje_IGV).toFixed(2);
          _valor_unitario = parseFloat(_precio_unitario) - (parseFloat(_precio_unitario) * procentaje_IGV); 
          total_base_igv = parseFloat(_precio_unitario) * x.cantidad;
          total_valor_item = _valor_unitario *  x.cantidad;

        } else {
            total_base_igv = parseFloat(x.precio_total); // cambio x error 3105 IGV // 12/07/2020
        }

        

        
        //const montoIGVItem =  parseFloat(parseFloat(x.precio_total) * procentaje_IGV).toFixed(2);
        var jsonItem = {
            "codigo_interno": x.id,
            "descripcion": x.des,
            "codigo_producto_sunat": "90101500",
            "codigo_producto_gsl": "90101500",
            "unidad_de_medida": "NIU",
            "cantidad": x.cantidad,
            "valor_unitario": _valor_unitario,
            "codigo_tipo_precio": "01",
            "precio_unitario": _precio_unitario,
            "codigo_tipo_afectacion_igv": codigo_tipo_afectacion_igv,
            "total_base_igv": total_base_igv,
            "porcentaje_igv": ValorIGV,
            "total_igv": total_igv,
            "total_impuestos": total_igv,
            "total_valor_item": total_valor_item,
            "total_item": x.precio_total
        }

        xListItemsRpt.push(jsonItem);

    })
    
    return xListItemsRpt;
}

// tipo_documento = 01 > factura se envia de manera individual 
// idtipo_comprobante_serie => guardar el correlativo
// nomComercio para notificar mensaje whatsapp
async function xSendApiSunat(json_xml, idregistro_pago, idtipo_comprobante_serie, guardarError=true, nomComercio = '') {
    const dtSede = xm_log_get("datos_org_sede")[0];
    const url_api_fac_sede = dtSede.url_api_fac || '';
    const URL_COMPROBANTE = url_api_fac_sede === '' ?  xm_log_get('app3_sys_const')[0].value : url_api_fac_sede;
    const _url = URL_COMPROBANTE+'/documents';
    let _headers = HEADERS_COMPROBANTE;
    _headers.Authorization = "Bearer " + dtSede.authorization_api_comprobante;

    var rpt = {};
    const numero_comp = json_xml.serie_documento + "-" + json_xml.numero_documento;
    const nomCliente = json_xml.datos_del_cliente_o_receptor.apellidos_y_nombres_o_razon_social;
    const telefonoCliente = json_xml.datos_del_cliente_o_receptor.telefono;
    const idclienteComprobante = json_xml.extras.idcliente;
    const totalComprobante = json_xml.totales.total_venta;
    const totalesJson = json_xml.totales;
    // json_xml = json_xml;   

    const _idregistro_p = typeof idregistro_pago === "object" ? idregistro_pago[1] : idregistro_pago;
    const _viene_facturador = typeof idregistro_pago === "object" ? 1 : 0; 
    
    //xPopupLoad.xopen();
    xm_all_xToastOpen("Conectando con Sunat...");

    setTimeout(() => {        
        xm_all_xToastClose();
    }, 2000);
    

    console.log('xArrayComprobante.correlativo E numero_comp', numero_comp);

    await fetch(_url, {
        method: 'POST',
        headers: _headers,
        body: JSON.stringify(json_xml),
    }).then(function (response) {
        return response.json();
    }).then(function (res) { 
        // console.log(res);
        const errSoap = res.response ? res.response.error_soap : false;
        // if (res.success || !errSoap) { // respuesta ok
            console.log('xArrayComprobante.correlativo F res api', res.data.number);

            rpt.ok = true; 
            rpt.qr = res.data.qr;
            rpt.hash = res.data.hash;
            rpt.external_id = res.data.external_id;
            rpt.correlativo_comprobante = xCeroIzqNumberComprobante(res.data.number).split('-')[1]            
            rpt.facturacion_correlativo_api = 1; // toma los correlativos del api
                        
            res.data.nomcliente = nomCliente;
            res.data.idcliente = idclienteComprobante;
            res.data.total = totalComprobante;
            res.data.totales_json = totalesJson;
            res.data.numero = numero_comp;
            res.data.idregistro_pago = _idregistro_p;
            res.data.viene_facturador = _viene_facturador;
            res.data.idtipo_comprobante_serie = idtipo_comprobante_serie;
            res.data.jsonxml = json_xml;
            // res.data.jsonxml = errSoap ? json_xml : ''; // si hay un error al enviar a sunat guarda jsonxml para enviarlo luego

            
            CpeInterno_Registrar(res);

            // enviar socket url pdf whatsapp
            if ( telefonoCliente !== '' ) {
                const _payloadPdf = {
                    telefono: telefonoCliente,
                    external_id: rpt.external_id,
                    numero_comprobante: res.data.number,
                    comercio: nomComercio
                };
                xSendWhatsAppPdfComrpobante(_payloadPdf);
            }



            
    }).catch(async function (error) { // error de conexion o algo pero imprime
        
        const data = {
                pdf:'0',
                cdr: '0',
                xml: '0',                
                idcliente: idclienteComprobante,
                total: totalComprobante,
                totales_json: totalesJson,
                nomcliente: nomCliente,
                numero: numero_comp, 
                jsonxml: json_xml, 
                external_id: '',  
                estado_api: 0,
                estado_sunat: 1,
                viene_facturador: _viene_facturador,
                idtipo_comprobante_serie: idtipo_comprobante_serie,                
            }
        
        rpt.ok = true;
        rpt.qr = '';
        rpt.hash = "www.papaya.com.pe";
        rpt.external_id = '';
        const correlativo_error = await CpeInterno_Error(data, _idregistro_p, _viene_facturador, idtipo_comprobante_serie);        
        rpt.correlativo_comprobante = correlativo_error.correlativo;
        console.log('xArrayComprobante.correlativo F error res api', rpt.correlativo_comprobante);
        console.log('error res api', error);
        rpt.facturacion_correlativo_api = correlativo_error.facturacion_correlativo_api;
        console.log(correlativo_error);
    });
    
    // setTimeout(() => {        
    //     xm_all_xToastClose();
    // }, 500);

    console.log('rpt cpe', rpt);
    
    return rpt;
}

function xSendWhatsAppPdfComrpobante(payload) {    
    console.log('external_id', payload);
    
    _cpSocketComprobanteWhatApp(payload)
}

