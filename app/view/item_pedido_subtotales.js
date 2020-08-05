/// calcula los subtotales desde el total de la mesa
/// se utiliza en dashboard - control de pedidos
var xLocal_xDtSubTotales;
var xLocal_SubTotal_Quitados = "";
var arrVerifySubTotalTachados = []; // para tachar a todo o no
function xArmarSubtotalesFromTotal(itemMesa) {
	if (!itemMesa) return;
	
	var dtDetalle = itemMesa.secciones.split(',');
	var subtotales_tachados_bd = itemMesa.subtotales_tachados; 
	var arrDt = [];

	dtDetalle.map((d,index) => {
		var _d = d.split(':');
		arrDt.push({'tipoconsumo':_d[0], 'seccion': _d[1], 'cantidad': _d[2], 'subtotales_tachados': subtotales_tachados_bd});		
    });
    
    return xCalcTotalSubArray(arrDt,itemMesa.importe);
}

//Armar subtotales del array a imprimir
function xArmarSubtotalesArray(xarr_data_pedido=null, total=0){
	var xLocal_TotalImporte=0, arrDt=[];

	// si data_pedido es null es decir no indican, es por que viene de nuevo pedido
	// xmipedido, control mesa o venta rapida 
	// en ese caso toma xArrayPedidoObj que es la variable global donde se almacena el nuevo pedido 
	xarr_data_pedido = xarr_data_pedido || xArrayPedidoObj;
	
	xLocal_TotalImporte = total===0 ? xSumaCantArray(xarr_data_pedido) : total;
	
	// estructuramos para calcular
    for (var i = 0; i < xarr_data_pedido.length; i++) {
		if(xarr_data_pedido[i]==null){continue;}
		$.map(xarr_data_pedido[i], function(n, z) {
			if (typeof n=="object"){
				const  subtotales_tachados = n.subtotales_tachados !== undefined ? n.subtotales_tachados : xLocal_SubTotal_Quitados;
				const  idpedido = n.idpedido ? n.idpedido : 0;
				arrDt.push({'tipoconsumo':n.idtipo_consumo, 'seccion': n.idseccion, 'cantidad':n.cantidad, 'subtotales_tachados': subtotales_tachados, 'idpedido': idpedido});
			}
		})
	}
       
    return xCalcTotalSubArray(arrDt,xLocal_TotalImporte);
}

 
function xCalcTotalSubArray(arrDt, importeTotal) {
	var xCartaSubtotales=xm_log_get('carta_subtotales'),
		arrTipoConsumo = arrDt || [];
	
	xLocal_xDtSubTotales=[]; // variable global
	var arrSuma = [];

	xLocal_xDtSubTotales.push({'descripcion':'Sub Total', 'importe':xMoneda(importeTotal), 'visible':true , 'quitar': false}); 
	arrSuma.push({ 'descripcion': 'Sub Total', 'importe': xMoneda(importeTotal), 'visible': true, 'quitar': false, 'visible_cpe': true}); 

	
	xSumTotalPorcentaje = 0;
	xSumCantImporte = 0; // suma totales
	// arrVerifySubTotalTachados = []; // para tachar a todo o no
	const countPedidos = arrTipoConsumo.length; 

	
	// adicionales taper | deliver | etc
	if ( arrTipoConsumo.length === 0  || arrTipoConsumo[0].subtotales_tachados === undefined ) return;

	// se agrupa la data y se suma las cantidades	
	var arrCocinada = arrTipoConsumo				
	.map(x => { 
		x.grupo = x.tipoconsumo+x.seccion;
		// x.grupoTipoconsumo = x.tipoconsumo
		return x;
	 })		
	.reduce((obj,val) => {
		const grupo = val.grupo;
		if (obj[grupo]) {
			obj[grupo].grupo = val.grupo;
			obj[grupo].grupoTipoconsumo = val.tipoconsumo;
			obj[grupo].cantidad = parseFloat(obj[grupo].cantidad) + parseFloat(val.cantidad)
			obj[grupo].subtotales_tachados = !obj[grupo].subtotales_tachados ? val.subtotales_tachados : obj[grupo].subtotales_tachados + val.subtotales_tachados;
		} else {
			obj[grupo] = [];
			obj[grupo].grupo = val.grupo;
			obj[grupo].grupoTipoconsumo = val.tipoconsumo;
			obj[grupo].cantidad = val.cantidad
			obj[grupo].subtotales_tachados = !obj[grupo].subtotales_tachados ? val.subtotales_tachados : obj[grupo].subtotales_tachados + val.subtotales_tachados;
		}
		return obj;
	}, []);

	var all_subtotales_tachados = '';
	arrCocinada.map( x => {
		all_subtotales_tachados += x.subtotales_tachados
	})

	arrCocinada.all_subtotales_tachados = all_subtotales_tachados;

	// CALCULAR RECORRIENDO CADA ITEM UNO X UNO
	
	xCartaSubtotales
		// .filter(c => c.tipo==='a')// todos los que son adicionales
		.map(c => {c.grupo = c.idtipo_consumo+c.idseccion; return c;})
		.map(c => {		
			switch (c.tipo) {
				case 'a': // todos los que son adicionales
					arrTipoConsumo // arr que contiene todos los items
						// .filter(x => x.grupo===c.grupo)				
						.map(x => {
							
							const id = c.tipo+c.id; // para quitar												
							const nivel = parseInt(c.nivel);										
							let sumItem = 0;
							let importe_tachado = 0;
							let subtotales_tachados_local = '';
							let cantidadItemPedido = 0;
							
							// arrCocinada[x.grupo].subtotales_tachados = evalua el grupo
							xLocal_SubTotal_Quitados = arrCocinada[x.grupo].subtotales_tachados != '' ? arrCocinada[x.grupo].subtotales_tachados : xLocal_SubTotal_Quitados;
		
							if ( nivel === 0){ // nivel item x item							
								if (x.grupo !== c.grupo) {return}
								sumItem = parseFloat(x.cantidad) * parseFloat(c.monto);
								if ( sumItem === 0) { return; }//no tiene esta seccion
							} else { // nivel pedido
								if (x.tipoconsumo !== c.idtipo_consumo) {return}
								sumItem = parseFloat(c.monto);						
						}
		
							// si esta para tachar al item no suma
							// evalua uno por uno
							importe_tachado = sumItem ;

							// if ( x.subtotales_tachados === "" ){ // quiere decir que no hay para procesar o que viene de venta rapida
							// 	subtotales_tachados_local = xLocal_SubTotal_Quitados;
							// 	cantidadItemPedido = 1;
							// } else {
								subtotales_tachados_local = x.subtotales_tachados;
								cantidadItemPedido = arrCocinada[x.grupo].cantidad
							// }


							subtotales_tachados_local.indexOf(id) >=0 ? sumItem = 0 : importe_tachado = 0;

							const tachado = checkSubTotalQuitado(cantidadItemPedido, id, sumItem);
							
							var IdExite;
							arrSuma.map((z, index) => {if (z.id === id) {IdExite = index; return;}} );
														

							if (IdExite) {
								// const importeItem = parseFloat(arrSuma[IdExite].importe);
								const importeItem = parseFloat(arrSuma[IdExite].importe);
								const importeTachadoItem = parseFloat(arrSuma[IdExite].importe_tachado);
								arrSuma[IdExite].importe = nivel === 0 ? parseFloat( importeItem + parseFloat(sumItem))
								.toFixed(2) : parseFloat(sumItem).toFixed(2);

								// arrSuma[IdExite].cantidad++; // con punitario sacamos cantidad
								
								arrSuma[IdExite].importe_tachado = nivel === 0 ? parseFloat(importeTachadoItem + parseFloat(importe_tachado)).toFixed(2) : parseFloat(importe_tachado).toFixed(2);
							} else {
								arrSuma.push({ 'id': id, 'descripcion': c.descripcion, 'importe_tachado': xMoneda(importe_tachado), 'importe': xMoneda(sumItem), 'punitario': c.monto, 'esImpuesto': 0, 'visible': true, 'quitar': true, 'tachado': tachado, 'visible_cpe': false}); 
							}
		
						});
					break;

				case 'p': // todos los porcentajes // que se añaden al total de la cuentas y NO SON QUITABLES
					const id = c.tipo+c.id;
					const esImpuesto = c.es_impuesto;
					const valorImpuesto = c.activo === "0" ? c.monto : 0; // se marca 0=activo o 1=desactivado para obtener el % del impuesto requerido por comprobante electronico			
					const visible_cpe = esImpuesto === "1" ? true : false; // indica si se muestra en la facturacion electronica
					let porcentaje = parseFloat(parseFloat(valorImpuesto)/100).toFixed(2);		
					// porcentaje = parseFloat(parseFloat(importeTotal)*parseFloat(porcentaje)).toFixed(2);
					porcentaje = c.descripcion === 'I.G.V' ? porcentaje : parseFloat(parseFloat(importeTotal)*parseFloat(porcentaje)).toFixed(2);

					// const esVisible = porcentaje > 0 ? true : false; // ver que implica
					
					arrSuma.push({ 'id': id, 'descripcion': c.descripcion, 'importe': xMoneda(porcentaje), 'esImpuesto': esImpuesto, 'visible': true, 'quitar': false, 'tachado': false, 'visible_cpe': visible_cpe}); 
					break;
			}	
		});

	// SI TIENE COSTO DE ENTREGA
	var _costoServicio = localStorage.getItem('::app3_woDUS::cxe');
	if (_costoServicio) {
		rpt = {};
		rpt.id = -2;
        rpt.descripcion = 'Entrega';
        rpt.isDeliveryApp = true;
        rpt.esImpuesto = 0;
        rpt.visible = true;
        rpt.quitar = false;
        rpt.tachado = false;
        rpt.visible_cpe = false;
		rpt.importe = parseFloat(_costoServicio.toString()).toFixed(2);
		arrSuma.push(rpt);
	}

	//
	 
	// const sumTotal = Object.keys(arrSuma).map(x => arrSuma[x].importe).reduce((a, b) => parseFloat(a) + parseFloat(b));
	
	// IGV filtramos los que no es impuesto IGV | 030220
	// const arrSubTotalObj = Object.keys(arrSuma);
	var sumTotal = arrSuma.filter(x => x.descripcion !== "I.G.V").map(x => x.importe).reduce((a, b) => parseFloat(a) + parseFloat(b));
	var rowSubTotal =  arrSuma.filter(x => x.descripcion === "Sub Total")[0];
	var rowImporteIGV = arrSuma.filter(x => x.descripcion === "I.G.V")[0];	
	var _importeIGV = parseFloat(rowImporteIGV.importe);
	var _importeSubTotal = parseFloat(rowSubTotal.importe);

	if ( _importeIGV > 0 ) {
		_importeIGV = parseFloat(_importeSubTotal *  _importeIGV).toFixed(2);
		_importeSubTotal = _importeSubTotal - _importeIGV;
		rowImporteIGV.importe = _importeIGV;
		rowSubTotal.importe = _importeSubTotal.toFixed(2);
	}
	/// IGV --->

	if(arrSuma.length==1){arrSuma=[];}
	arrSuma.push({ 'descripcion': 'Total', 'importe': xMoneda(sumTotal), 'visible': true, 'visible_cpe': true});

	xLocal_xDtSubTotales = arrSuma;
	xSumCantImporte = sumTotal;
	// retorna el importe total + subtotales(igv,servio,taper)

	return xSumCantImporte;
}

// cheque si el subtotal fue quitaodo o marcado como no cobrar
// val = valor a sumar si no esta quitado
// x = grupo analizado que trae el subtotales_tachados
// countPedidos == cantidad de items
function checkSubTotalQuitado(countPedidos, id , val) {	
	var rpt = false;
	if (!xLocal_SubTotal_Quitados) { return; }	

	const CountIdTacahdos = xLocal_SubTotal_Quitados.toLowerCase().split(",").sort().filter(x => x===id).length;
	const hbilitarTachado =  parseInt(CountIdTacahdos) >= parseFloat(countPedidos);

	rpt = xLocal_SubTotal_Quitados.indexOf(id) >=0 ? true : false;
	if (!rpt) {xSumCantImporte += parseFloat(val);}
	
	return hbilitarTachado ? rpt : false; 
}

var groupBy = function(xs, key) {
	return xs.reduce(function(rv, x) {
	  (rv[x[key]] = rv[x[key]] || []).push(x);
	  return rv;
	}, {});
  };



// pedido delivery from app dar formato subtotales
// si esta suscrito a la red de repartidores

// quitamos servicio delivery y propina del subtotal
function darFormatoSubTotalesDelivery(arrTotales = null) {
    // console.log(arrTotales);
    var rowTotal = arrTotales[arrTotales.length - 1];
    // -2 = servicio deliver -3 = propina
    rowTotal.importe = arrTotales.filter(x => x.id !== -2 && x.id !== -3 && x.descripcion !== 'TOTAL').map(x => parseFloat(x.importe)).reduce((a, b) => a + b, 0);
	xLocal_xDtSubTotales =  arrTotales.filter(x => x.id !== -2 && x.id !== -3);
	return xLocal_xDtSubTotales;
  }

function getImporteTotalSubTotalesDelivery(arrTotales = null) {
    // console.log(arrTotales);
    var rowTotal = arrTotales[arrTotales.length - 1];
    // -2 = servicio deliver -3 = propina
    return rowTotal.importe;
  }



// quitamos servicio delivery y propina del subtotal
  // flagSolicitaRepartidor = cuando comercio con repartidor propio solicita repartidor de la red papaya express
function darFormatoSubTotalesComisionRepartidor(sedeInfo, arrTotales, costoEntrega, flagSolicitaRepartidor = false) {
    console.log('aaa');

    // si tiene sus propios repartidores no da formato no quita nada
    if ( sedeInfo.pwa_delivery_servicio_propio === '1' && !flagSolicitaRepartidor ) { return arrTotales; }


    // agregar o restar el importe del costo de entrega SI el comercio paga el costo de entrega pwa_delivery_comercio_paga_entrega
    if ( sedeInfo.pwa_delivery_comercio_paga_entrega === '1' || flagSolicitaRepartidor) {
      // ingresamos en la penultima postion del arrTotales
      const postionInsert = arrTotales.length - 1;
      const _row = {
        descripcion: 'Costo de Entrega',
        esImpuesto: 0,
        id: -4,
        importe: - costoEntrega,
        quitar: false,
        tachado: false,
        visible: false,
        visible_cpe: false
      };
      arrTotales.splice(postionInsert, 0, _row);

      // console.log('costo de entrega insertado', arrTotales);
	}	

    // console.log(arrTotales);
    const rowTotal = arrTotales[arrTotales.length - 1];

    // si repartidores propio muestra comisiciones y propina
    if ( sedeInfo.pwa_delivery_servicio_propio === '1') {

      rowTotal.importe = arrTotales.filter(x => x.descripcion !== 'TOTAL').map(x => parseFloat(x.importe)).reduce((a, b) => a + b, 0);
      return arrTotales;

    } else {
      // -2 = servicio deliver -3 = propina
      rowTotal.importe = arrTotales.filter(x => x.id !== -2 && x.id !== -3 && x.descripcion !== 'TOTAL').map(x => parseFloat(x.importe)).reduce((a, b) => a + b, 0);
      return arrTotales.filter(x => x.id !== -2 && x.id !== -3);
    }
  }


    // quitamos pwa_delivery_comercio_paga_entrega costo de entrega y lo volvemos a sumar, por que el costo de entrega que paga el comercio no figura en el comprobante
	function darFormatoSubTotalesParaFacturacion(arrTotales, isSumar = true) {
		const rowCostoEntrega = arrTotales.filter(x => x.id === -4)[0];
		if ( rowCostoEntrega ) {
			if ( isSumar  ) {
				const rowTotal = arrTotales[arrTotales.length - 1];
				rowTotal.importe += (rowCostoEntrega.importe * -1); // este dato es negativo
			}
		  return arrTotales.filter(x => x.id !== -4); // quitamos costo de entrega que paga el comericio
		}
		return arrTotales;
	  }