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

    // cambio para sumar los costos negativos, si es que es delivery y el comercio paga
	xArraySubTotales = darFormatoSubTotalesParaFacturacion(xArraySubTotales, false);    


    // console.log('xArrayComprobante.correlativo C', xArrayComprobante.correlativo);
    

    // cpe = false subtotal + adicional -> lo ponemos en xImprimirComprobanteAhora() // para mostrar en la impresion
    var xitems = xEstructuraItemsJsonComprobante(xArrayCuerpo, xArraySubTotales, false);        

    // si el comprobante es solo por consumo entonces tomamos solo el primer item de items
    try {        
        if ( xArrayComprobante?.modo.id===2 ){
            xitems = xitems.slice(0,1);
        }
    } catch (error) {
        console.log('error xArrayComprobante?.modo', error);
    }

    // ================= normalizacion para SUNAT (2026-08) =================
    // 1. Items con importe NEGATIVO: SUNAT no acepta lineas negativas; se extraen
    //    de items y se convierten en descuento global (codigo 02). El ticket
    //    impreso no cambia, solo la representacion fiscal del CPE.
    // 2. Total en CERO (descuento 100%): se emite como TRANSFERENCIA GRATUITA
    //    (afectacion de bonificacion, valor referencial, leyenda 1002) que SUNAT
    //    acepta. Antes iba como venta onerosa en 0 y SUNAT la RECHAZABA.
    // 3. Total NEGATIVO: no existe tributariamente; se avisa al cajero y NO se
    //    envia a SUNAT (la venta continua sin CPE, no se bloquea nada).
    let _montoItemsNegativos = 0;
    const _itemsNegativos = xitems.filter(x => parseFloat(x.precio_total) < 0);
    if ( _itemsNegativos.length > 0 ) {
        _montoItemsNegativos = _itemsNegativos.reduce((s, x) => s + Math.abs(parseFloat(x.precio_total)), 0);
        xitems = xitems.filter(x => parseFloat(x.precio_total) >= 0);
    }

    const _totalNetoCPE = parseFloat(xArraySubTotales[xArraySubTotales.length - 1].importe);

    if ( _totalNetoCPE < 0 ) {
        // CASO 3: total negativo -> validacion local, jamas llega a SUNAT
        const _swalTotalNegativo = paramsSwalAlert;
        _swalTotalNegativo.html = `<div class="p-1">
									<p class="fw-600 fs-18 text-danger">No se puede emitir el comprobante</p>
									<p class="fw-100 fs-14">El importe total es negativo (S/ ${_totalNetoCPE.toFixed(2)}).</p>
									<p class="fw-100 fs-14">Los descuentos o items negativos superan el valor de la venta. Corrija el pedido; no se enviará comprobante electrónico.</p>
								</div>`;
        _swalTotalNegativo.showCancelButton = false;
        _swalTotalNegativo.showConfirmButton = true;
        _swalTotalNegativo.confirmButtonText = 'Entendido.';
        showAlertSwalHtmlDecision(_swalTotalNegativo);

        // mismo formato que "sin facturacion electronica": la venta continua sin CPE
        hash.ok = true;
        hash.qr = '';
        hash.hash = '';
        hash.external_id = '';
        return hash;
    }

    const _hayItemsConValor = xitems.filter(x => parseFloat(x.precio_total) > 0).length > 0;
    // CASO 2: total 0 con items valorizados -> transferencia gratuita
    const esGratuita = _totalNetoCPE === 0 && _hayItemsConValor;

    if ( _totalNetoCPE === 0 && !_hayItemsConValor ) {
        // todas las lineas en 0: no hay nada que facturar, continua sin CPE
        hash.ok = true;
        hash.qr = '';
        hash.hash = '';
        hash.external_id = '';
        return hash;
    }

    xitems = xJsonSunatCocinarItemDetalle(xitems, valIGV, isExoneradoIGV, esGratuita);

    

    


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
    let arrDescuento = [];    
    let arrLegends = [];
    let descuentoEnTotal = 0;

    
    // los items negativos extraidos se suman al descuento global; en gratuita no va descuento
    if ( (isHayDescuento || _montoItemsNegativos > 0) && !esGratuita ) {
        descuentoEnTotal = (isHayDescuento ? parseFloat(itemDescuento.importe) * -1 : 0) + _montoItemsNegativos;
        // importe_total_pagar = importe_total_pagar + descuentoEnTotal;
        // importe_total_pagar = importe_total_pagar + descuentoEnTotal;

        _base = importe_total_pagar - parseFloat(importe_total_igv) + descuentoEnTotal;
        // const porcentaje_dsc = (descuentoEnTotal / _base).toFixed(2);
        const porcentaje_dsc = (descuentoEnTotal / _base).toFixed(4);


        // 040921// si hay descuentos no se registra en factura, la sunat no tiene claro que le importe el descuento, no hay ejemplos y xml da error
        // solo el igv
        arrDescuento.push(
            {
                "codigo": "02",
                "descripcion": "Descuento Global afecta a la base imponible",
                "porcentaje": porcentaje_dsc,
                "monto": descuentoEnTotal.toFixed(2),
               "base": _base.toFixed(2)
            }
        );

        // console.log('arrDescuento', arrDescuento);


        importe_total_pagar += descuentoEnTotal;

        // descuentoEnTotal = 0;

    }


    if ( esGratuita ) {
        // TRANSFERENCIA GRATUITA: los items van con valor referencial (afectacion 15/21,
        // codigo_tipo_precio 02) y el total a pagar es 0. SUNAT lo acepta con leyenda 1002.
        let _valorRefGratuitas = 0, _igvGratuitas = 0;
        xitems.forEach(x => {
            _valorRefGratuitas += parseFloat(x.total_valor_item) || 0;
            _igvGratuitas += parseFloat(x.total_igv) || 0;
        });

        totales = {
            "total_descuentos": 0.00,
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": 0.00,
            "total_operaciones_inafectas": 0.00,
            "total_operaciones_exoneradas": 0.00,
            "total_operaciones_gratuitas": parseFloat(_valorRefGratuitas.toFixed(2)),
            "total_igv_operaciones_gratuitas": parseFloat(_igvGratuitas.toFixed(2)),
            "total_igv": 0.00,
            "total_impuestos": 0.00,
            "total_valor": 0.00,
            "total_venta": 0.00
        }

        arrLegends.push({
            "codigo": "1002",
            "valor": "TRANSFERENCIA GRATUITA DE UN BIEN Y/O SERVICIO PRESTADO GRATUITAMENTE"
        });

    } else if ( isExoneradoIGV ) { // exonerado del igv
     
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

        const _totalVenta = (importe_total_pagar - descuentoEnTotal).toFixed(2);
        totales = {
            "total_descuentos": descuentoEnTotal.toFixed(2),
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": 0.00,
            "total_operaciones_inafectas": 0.00,
            // "total_operaciones_exoneradas": importe_total_pagar + descuentoEnTotal,
            "total_operaciones_exoneradas": importe_total_pagar,
            "total_operaciones_gratuitas": 0.00,
            "total_igv": 0.00,
            "total_impuestos": 0.00,
            "total_valor": _totalVenta,
            "total_venta": _totalVenta
        }


        arrLegends.push({
            "codigo": "2001",
            "valor": "BIENES TRANSFERIDOS EN LA AMAZONÍA REGIÓN SELVA PARA SER CONSUMIDOS EN LA MISMA."
        })

        
    } else {

        // const total_operaciones_gravadas = descuentoEnTotal > 0 ? (importe_total_pagar_calc_igv - parseFloat(importe_total_igv)) + descuentoEnTotal : xArraySubTotales[0].importe; // el subtotal
        // const total_operaciones_gravadas = xArraySubTotales[0].importe; // el subtotal
        // const _total_valor = descuentoEnTotal > 0 ? _base - descuentoEnTotal : importe_total_pagar - parseFloat(importe_total_igv);
        const _total_venta = importe_total_pagar_calc_igv;

        const procentaje_IGV = parseFloat(parseFloat(valIGV) / 100);
        let _total_operaciones_gravadas = xCalcMontoBaseIGV(_total_venta, procentaje_IGV);
        let _total_igv = parseFloat(_total_venta - _total_operaciones_gravadas).toFixed(2);
        let _total_valor = _total_operaciones_gravadas

        totales = {
            // "total_descuentos": descuentoEnTotal,
            // "total_descuentos": 0.00,            
            "total_descuentos": 0.00, //descuentoEnTotal, aunque haya descuento se coloca 0 si es descuento global
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": _total_operaciones_gravadas,
            "total_operaciones_inafectas": 0.00,
            "total_operaciones_exoneradas": 0.00,
            "total_operaciones_gratuitas": 0.00,
            "total_igv": _total_igv, // importe_total_igv,
            "total_impuestos": _total_igv, // importe_total_igv,
            "total_valor": _total_valor,
            "total_venta": _total_venta
        }
    }

    // console.log('totales', totales);

    // totales.total_descuentos = descuentoEnTotal;


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
        const telefonoEmisor = xArrayEncabezado[0].sedetelefono === '' ? xArrayEncabezado[0].telefono : xArrayEncabezado[0].sedetelefono;
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

        // console.log('xArrayComprobante.correlativo D', xArrayComprobante.correlativo);

        comprobarNumCorrelativoComprobante(xArrayComprobante);

        const _nomCliente = xArrayCliente?.nombres || 'PUBLICO EN GENERAL';
        const _fechaMetodoPago = xArrayComprobante.forma_de_pago?.fecha_de_pago || '';
        const _fechaVencimiento = _fechaMetodoPago !== '' ? _fechaMetodoPago : fecha_actual;
        const _observacionesCPE = xArrayComprobante?.observaciones || '';

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
                "telefono": telefonoEmisor,
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
            "descuentos": arrDescuento,
            "totales": totales,
            "items": xitems,
            "leyendas": arrLegends,
            "extras":{
                "forma_de_pago": xArrayComprobante.forma_de_pago,
                "observaciones": removeSpecialCharString(_observacionesCPE),
                "vendedor": "",
                "caja": "",
                "idcliente": xArrayCliente.idcliente
            }

        }

        // console.log('jsonData', jsonData);


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


function xJsonSunatCocinarItemDetalle(items, ValorIGV, isExoneradoIGV, esGratuita = false ) {
    var xListItemsRpt =[];
    const procentaje_IGV = parseFloat(parseFloat(ValorIGV)/100);
    
    // var valor_referencial_unitario_por_item_en_operaciones_no_onerosas_y_codigo = {"monto_de_valor_referencial_unitario": "01", "codigo_de_tipo_de_precio": "02"};

    items.map( (x, index) => {
        index++;

        // 2026-08: un item sin nombre generaba <cbc:Description></cbc:Description>
        // y SUNAT rechazaba el comprobante ENTERO (codigo 2026), no solo la linea.
        // Paso el codigo interno para que el item siga siendo identificable en el
        // PDF y en la consulta; el API ademas rechaza en la puerta si queda vacio.
        const _descripcion = String(x.des == null ? '' : x.des).trim()
            || (x.id ? `PRODUCTO ${x.id}` : 'PRODUCTO');

        if ( _descripcion !== x.des ) {
            // no bloquea la venta (el fallback ya hace valido el CPE), pero
            // alguien tiene que enterarse para corregir el producto en la carta
            showToastSwal('warning', `Producto sin nombre (cod. ${x.id || 's/c'}): se emitio como "${_descripcion}". Corregir en la carta.`);
        }

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
        //   total_igv = parseFloat(parseFloat(x.precio_total) * procentaje_IGV).toFixed(2);
        //   _valor_unitario = parseFloat(_precio_unitario) - (parseFloat(_precio_unitario) * procentaje_IGV); 
        //   total_valor_item = _valor_unitario *  x.cantidad;
          
        //   total_base_igv = parseFloat(_precio_unitario) * x.cantidad;
            _valor_unitario = xCalcMontoBaseIGV(_precio_unitario, procentaje_IGV); // parseFloat(_precio_unitario) - (parseFloat(_precio_unitario) * procentaje_IGV); 
            total_valor_item = _valor_unitario * x.cantidad;
            total_base_igv = total_valor_item; 
            total_igv = parseFloat(parseFloat(x.precio_total) - total_base_igv).toFixed(2);


        } else {
            total_base_igv = parseFloat(x.precio_total); // cambio x error 3105 IGV // 12/07/2020            
            
        }

        // transferencia gratuita (total del comprobante en 0): el item conserva su
        // valor como REFERENCIAL -> afectacion catalogo 07 (15 bonificacion gravada,
        // 21 exonerada gratuita) y codigo_tipo_precio 02 (valor referencial).
        // Reglas validadas contra SUNAT beta (2026-08-08):
        //  - 2640: el precio "real" (cac:Price / valor_unitario) debe ir en 0; el
        //    referencial viaja SOLO en AlternativeConditionPrice (tipo 02).
        //  - 3111: el IGV referencial de la linea debe ser != 0 en gravadas gratuitas
        //    (queda el total_igv calculado); en exoneradas (21) va 0.
        //  - 3271: el referencial tipo 02 es el VALOR unitario (sin IGV): SUNAT valida
        //    LineExtensionAmount = cantidad x referencial.
        if ( esGratuita ) {
            codigo_tipo_afectacion_igv = isExoneradoIGV ? "21" : "15";
            _precio_unitario = _valor_unitario; // valor referencial unitario (sin IGV)
            _valor_unitario = 0;                // precio real en 0
        }

        
        //const montoIGVItem =  parseFloat(parseFloat(x.precio_total) * procentaje_IGV).toFixed(2);
        var jsonItem = {
            "codigo_interno": x.id,
            "descripcion": _descripcion,
            "codigo_producto_sunat": "90101500",
            "codigo_producto_gsl": "90101500",
            "unidad_de_medida": "NIU",
            "cantidad": x.cantidad,
            "valor_unitario": _valor_unitario,
            "codigo_tipo_precio": esGratuita ? "02" : "01",
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

// xm_all.js
// function xCalcMontoBaseIGV(importeTotal, procentaje_IGV) {
//     return parseFloat(parseFloat(importeTotal) / (1 + procentaje_IGV)).toFixed(2)
// }

async function xCocinarJsonNotaCredito(doc) {
    const _dataXML = JSON.parse(doc.json_xml);    
    const _numSerieDoc = getSerieDoc(doc.numero);
    const _codDocumento = doc.codsunat;
    const _fecha = xSetInputDate(xDevolverFecha());
    const _hora = xDevolverHora();
    const _jsonXmlNC = {
        "serie_documento": "F"+_numSerieDoc,
        "numero_documento": "#",
        "fecha_de_emision": _fecha,
        "hora_de_emision": _hora,
        "codigo_tipo_documento":"07",
        "codigo_tipo_nota": "01",
        "motivo_o_sustento_de_nota": txt_motivo_anular.value,
        "codigo_tipo_moneda": "PEN",
        "numero_orden_de_compra": "",
        "documento_afectado": {
          "serie_documento": _dataXML.serie_documento,
          "numero_documento": parseInt(_dataXML.numero_documento),
          "codigo_tipo_documento": _codDocumento
        },
        "datos_del_emisor": _dataXML.datos_del_emisor,
        "datos_del_cliente_o_receptor":_dataXML.datos_del_cliente_o_receptor,
        "totales": _dataXML.totales,
        "items":_dataXML.items,
        "extras": {}
    }

    console.log('_jsonHead', _jsonXmlNC);
    console.log('doc.idce', doc.idce);
    const _res = await xSendNotaCredito(_jsonXmlNC, doc.idce);
    return _res;

}

async function xSendNotaCredito (_jsonXmlNC, idce) {

    const dtSede = xm_log_get("datos_org_sede")[0];
    const url_api_fac_sede = dtSede.url_api_fac || '';
    const URL_COMPROBANTE = url_api_fac_sede === '' ?  xm_log_get('app3_sys_const')[0].value : url_api_fac_sede;
    const _url = URL_COMPROBANTE+'/documents';
    let _headers = HEADERS_COMPROBANTE;
    _headers.Authorization = "Bearer " + dtSede.authorization_api_comprobante;

    xm_all_xToastOpen("Conectando con Sunat...");

    console.log('_headers', _headers);
    console.log('_url', _url);


    // console.log('_url', _url);
    // setTimeout(() => {        
    //     xm_all_xToastClose();
    // }, 2000);

    const _rpt = await fetch(_url, {
        method: 'POST',
        headers: _headers,
        body: JSON.stringify(_jsonXmlNC),
    }).then(function (response) {
        return response.json();
    })
    .then(function (res) {

        // guardar nc
        if ( res.success == true ) {
            res.idce = idce;
            res.jsonxml = _jsonXmlNC;
            CpeInterno_RegistrarNC(res);

            showToastSwal('success', 'Listo proceso correcto.');

        } else {
            // si hay algun error            
            showAlertSwalOk('error', 'Ocurrio un error!', res.message);
        }        


        return res;
    }).catch(async function (error) {
        console.error('error', error);
        showAlertSwalOk('error', 'Ocurrio un error!', 'No se pudo concretar el proceso. Error inesperado.');
        return false;
    });
    
    return _rpt;

}

function getSerieDoc(num_doc) {
    return num_doc.split('-')[0].replace(/\D/g,'');
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
    

    // console.log('xArrayComprobante.correlativo E numero_comp', numero_comp);

    await fetch(_url, {
        method: 'POST',
        headers: _headers,
        body: JSON.stringify(json_xml),
    }).then(function (response) {
        return response.json();
    }).then(function (res) { 
        // console.log(res);
        try {
            
            const errSoap = res.response ? res.response.error_soap : false;
            const _rptCPEResponse = res.response ? res.response : res;
            const _isCPEResponseCode = _rptCPEResponse?.code ? true : false; 
            const _rptCPESuccess = _rptCPEResponse.success

            // 2026-08: 'accepted' del API responde "¿SUNAT lo declaró?".
            // 'success' solo dice que la llamada SOAP no reventó: un CDR
            // rechazado (ej. code 2255) llegaba igual con success:true, y por
            // eso los rechazos pasaban desapercibidos en caja. Si el API es
            // anterior al cambio no manda 'accepted' y queda null → se
            // clasifica solo por código, como antes.
            const _aceptado = typeof _rptCPEResponse?.accepted === 'boolean'
                ? _rptCPEResponse.accepted
                : null;

            if ( _isCPEResponseCode || _aceptado === false ) { // hay algo que analizar
            // if (!_rptCPESuccess) {
                // analizamos el code error
                // Pasar external_id para guardar en cpe_error
                const _external_id = res.data?.external_id || '';
                // sin await a propósito: el popup no debe frenar la impresión
                xVerificarCodeResponseCPE(_rptCPEResponse, _external_id, _aceptado)
            }
        } catch (error) {
            // antes se tragaba todo en silencio: un fallo acá dejaba al cajero
            // sin ningún aviso y sin rastro para soporte
            console.error('xSendApiSunat: no se pudo analizar la respuesta del CPE', error);
        }
        // if (res.success || !errSoap) { // respuesta ok
            // console.log('xArrayComprobante.correlativo F res api', res.data.number);

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
                const dtSede = xm_log_get("datos_org_sede")[0];
                
                const _userId = dtSede.id_api_comprobante; // whastapp
                const _payloadPdf = {
                    telefono: telefonoCliente,
                    external_id: rpt.external_id,
                    numero_comprobante: res.data.number,
                    comercio: nomComercio,
                    user_id: _userId,
                    comercio_telefono: dtSede.telefono
                };
                // link de la encuesta: se firma aqui (el secreto vive en el POS) y viaja como un campo mas.
                // Si no hay canal whatsapp publicado o falla, vuelve '' y el mensaje sale como siempre.
                if (typeof xEncUrlVenta === 'function') {
                    const _enviarWsp = function (urlEncuesta) {
                        if (urlEncuesta) { _payloadPdf.url_encuesta = urlEncuesta; }
                        xSendWhatsAppPdfComrpobante(_payloadPdf);
                    };
                    xEncUrlVenta(_idregistro_p, 'whatsapp').then(_enviarWsp, function () { _enviarWsp(''); });
                } else {
                    xSendWhatsAppPdfComrpobante(_payloadPdf);
                }
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
        // console.log('xArrayComprobante.correlativo F error res api', rpt.correlativo_comprobante);
        console.log('error res api', error);
        rpt.facturacion_correlativo_api = correlativo_error.facturacion_correlativo_api;
        console.log(correlativo_error);
    });
    
    // setTimeout(() => {        
    //     xm_all_xToastClose();
    // }, 500);

    // console.log('rpt cpe', rpt);
    
    return rpt;
}

function xSendWhatsAppPdfComrpobante(payload) {    
    // console.log('external_id', payload);
    
    _cpSocketComprobanteWhatApp(payload)
}




// Export para pruebas en Node (test/xjsonsunat.gratuita.test.js);
// en el navegador las funciones quedan globales como siempre.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { xJsonSunatCocinarItemDetalle };
}
