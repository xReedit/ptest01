// cocina la data del comprobante electronico en un json para ser enviada a la sunat 
//

// xArrayCuerpo (items) debe tener estructura de mod impresion, (como sub pedido ::app3_sys_dta_pe)
// xArraySubTotales ya esta calculado los subtotales
// xArrayComprobante datos del comprobante : tipodoc , serie correlativo id's
// xArrayCliente datos del cliente nombre dni ruc direccion

function xJsonSunatCocinarDatos(xArrayCuerpo, xArraySubTotales, xArrayComprobante, xArrayCliente) {
    var hash = '';
    const isFacturacionElectronica = true; // si se emiten comprobantes electronicos    

    if ( !isFacturacionElectronica ) {
        return hash;   
    }    


    const xxxitems = xEstructuraItemsJsonComprobante(xArrayCuerpo);

    // array encabezado org sede
	var xArrayEncabezado = xm_log_get('datos_org_sede'); 
    var items = [], fecha_actual = '', hora_actual = '';
    var xnum_doc_cliente = xArrayCliente.num_doc;

    const abreviaCo = xArrayComprobante.descripcion.substr(0,1).toUpperCase();

    const xtipo_de_documento_identidad_cliente = xnum_doc_cliente.length === 11 ? 6 : 1;
    const xtipo_de_documento_comprobante = xArrayComprobante.codsunat;


    // si viene dni sin valor '00000000 = publico en general'
    xnum_doc_cliente = xnum_doc_cliente.length === 0 ? '00000000' : xnum_doc_cliente;

    // Importe total a pagar siempre ultimo es es el total
	const index_total = xArraySubTotales.length-1;
    const importe_total_pagar = xArraySubTotales[index_total].importe;
    
    //verifica si esta exonerado al igv /*/ caso de la selva u otros ubigeos exonerados del igv
    const isExoneradoIGV = true;
    let total_valor_de_venta_operaciones_gravadas = 0,total_valor_de_venta_operaciones_exoneradas = 0, leyenda = [];

    if ( isExoneradoIGV ) {
        total_valor_de_venta_operaciones_exoneradas = importe_total_pagar;
        total_valor_de_venta_operaciones_gravadas = 0;
        leyenda = [{"codigo_de_la_leyenda": "2001", "descripcion_de_la_leyenda": `${xArrayComprobante.pie_pagina_comprobante}`}]
    } else {
        total_valor_de_venta_operaciones_exoneradas = 0;
        total_valor_de_venta_operaciones_gravadas = importe_total_pagar;
        leyenda = [];
    }

    //items





    // fecha actual del servidor
    // cabecera
    $.ajax({type: 'POST', url: '../../bdphp/log_001.php', data:{'p_from':'z'}})
    .done( function (rptDate) {
        rptDate=rptDate.split('|');
        fecha_actual = rptDate[0];
        hora_actual = rptDate[1];    

        var jsonData = {
            "datos_de_la_factura_electronica": {
                "version_del_ubl": "v21",
                "numeracion_conformada_por_serie_y_numero_correlativo": `${abreviaCo}${xArrayComprobante.serie}-${xArrayComprobante.correlativo}`,
                "fecha_de_emision": `${fecha_actual}`,
                "hora_de_emision": `${hora_actual}`,
                "tipo_de_documento": `${xArrayComprobante.codsunat}`,
                "tipo_de_moneda_en_la_cual_se_emite_la_factura_electronica": "PEN",
                "fecha_de_vencimiento": `${fecha_actual}`
            },
            "datos_del_emisor": {
                "numero_de_ruc": {
                    "numero_ruc": `${xArrayEncabezado[0].ruc}`,
                    "tipo_de_documento": `${xtipo_de_documento_comprobante}`
                },
                "nombre_comercial": `${xArrayEncabezado[0].nombre}`,
                "apellidos_y_nombres_denominacion_o_razon_social": `${xArrayEncabezado[0].nombre}`
            },
            "datos_adicionales_lugar_en_el_que_se_entrega_el_bien_o_se_presta_el_servicio": {
                "codigo_del_domicilio_fiscal_o_de_local_anexo_del_emisor": "0001"
            },
            "datos_del_cliente_o_receptor": {
                "tipo_y_numero_de_documento_de_identidad_del_adquirente_o_usuario": {                    
                    "numero_de_documento": `${xnum_doc_cliente}`,
                    "tipo_de_documento": `${xtipo_de_documento_identidad_cliente}`
                },
                "apellidos_y_nombres_denominacion_o_razon_social_del_adquirente_o_usuario": `${xArrayCliente.nombres}`
            },
            "guia_de_remision_relacionada": [{
                "numero_de_guia": "",
                "tipo_de_documento": "09"
            }],
            "otro_documento_relacionado": [{
                "numero_de_guia": "",
                "tipo_de_documento": "09"
            }],
            "informacion_adicional_gastos_art_37_renta___numero_de_placa_del_vehiculo": "",
            "items": "?items",
            "totales": {
                "total_valor_de_venta_operaciones_gravadas": {
                    "monto": `${total_valor_de_venta_operaciones_gravadas}`
                },
                "total_valor_de_venta_operaciones_inafectas": {
                    "monto": "0"
                },
                "total_valor_de_venta_operaciones_exoneradas": {
                    "monto": `${total_valor_de_venta_operaciones_exoneradas}`
                },
                "total_valor_de_venta_operaciones_gratuitas": {
                    "total_valor_venta_operaciones_gratuitas": "0"
                },
                "total_descuentos": {
                    "monto": "0"
                },
                "sumatoria_igv": {
                    "sumatoria_igv_amount": "0"
                },
                "sumatoria_isc": {
                    "sumatoria_isc_amount": "0"
                },
                "sumatoria_otros_tributos": {
                    "sumatoria_otros_tributos_amount": "0"
                },
                "descuentos_globales": "0",
                "sumatoria_otros_cargos": "0",
                "importe_total_de_la_venta_cesion_en_uso_o_del_servicio_prestado": `${importe_total_pagar}`
            },
            "detraccion": {
                "cuenta_banco_nacion": "",
                "codigo_producto": "",
                "porcentaje_detraccion": 0,
                "monto_detraccion": 0
            },
            "informacion_adicional_anticipos": {
                "informacion_prepagado_o_anticipado": {
                    "serie_y_numero_de_documento_que_se_realizo_el_anticipo": "123-123",
                    "tipo_de_comprobante_que_se_realizo_el_anticipo": "",
                    "tipo_de_documento_del_emisor_del_anticipo": ""
                },
                "total_anticipos": "0"
            },
            "informacion_adicional": {
                "tipo_de_operacion": "0101",
                "leyendas": leyenda
            },
            "extras": {
                "logo": ""
            }
        };

        console.log(JSON.stringify(jsonData))
    })


}

