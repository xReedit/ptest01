var xArrayPedidoObj
,xidTipoConsumo
,xidItem
,xCambioCantidad=false
,xLocal_xDtSubTotales
,xLocal_TotalImporte=0
,xErrorPrint=false
,xArrayDesTipoConsumo=[]
,xVerificarImprimirComanda=false//si solo hay items de bodega imprime o no comanda segun confg en almacen// si en  imprimir_comanda=1 imprimi
,xGeneralDataCarta
,xGeneralRelojUpdateItemsSolo
,xGeneralRelojUpdateItemsCambioBd
,xDisparaUpdateItems=new Event('GeneralUpdateItemsSolo') //cada 60segundos de inactivida
,xGeneralNumPedidosActual=0
,xGeneralUpdateSeccion=0
,xGeneralDataSeccion
,xNumPedidosBD=0
,xGeneralArraySubTotales=[], itemPedidos_objItemSelected=[], objOptionItemSelect;

//var xLocal_TotalRowsArrayImporte=0;
// 'precio_total_calc': para calcular en regalas de carta
$(document.body).on('click', '#_xSubMenu_body div.xBtn', handlerFnMiPedido); // mi pedido
$(document.body).on('click', '#_xdlgBody div.xBtn', handlerFnMiPedido); // mi pedido -> dialog
$(document.body).on('click', '.subitem-content-resumen div.btnCount', handlerFnMiPedido); // mi pedido -> dialog
// $(document.body).delegate('#_xSubMenu_body div.xBtn', 'click', handlerFnMiPedido); // mi pedido
// $(document.body).delegate('#_xdlgBody div.xBtn', 'click', handlerFnMiPedido); // mi pedido -> dialog
// function handlerFn() {console.log('delegate click _xSubMenu_body>div.xBtn')}

// $(document).on('click', '.xBtn', function(e) {
function handlerFnMiPedido(e) {
		const _thisObj = $(this);
		xCambioCantidad=true;
		xidTipoConsumo = _thisObj.parent().attr('data-id');
		const _viene_venta_rapida = parseInt(_thisObj.parent().attr('data-ventarapida'));
		const _viene_subitems_mod = parseInt(_thisObj.parent().attr('data-viene-subitems-mod')); // si viene del sumar o restar subitem venta rapida
		
		if ( _viene_subitems_mod == 1 ) { // modifica el subitems_select por el subitem a modificar (+ -);
			modificarUnSubItem(_thisObj);
		}
		
		xidItem = itemPedidos_objItemSelected.idcarta_lista || itemPedidos_objItemSelected.iditem; // $(this).parents('.xmenu_item_2').attr('data-id'); // iditem lista de la carta
		// const _xmenu_item_2 = _thisObj.parents('.xmenu_item_2');
		// const _xmenu_item_2_dataset = JSON.parse(JSON.stringify(_xmenu_item_2[0].dataset));

		var xOperacion=_thisObj.text()
		, objCant = _thisObj.parent().find('.xCant_item')
		, objCant_cant = xArrayPedidoObj[xidTipoConsumo] ? xArrayPedidoObj[xidTipoConsumo][xidItem] ? xArrayPedidoObj[xidTipoConsumo][xidItem]['cantidad'] : 0 : 0 //itemPedidos_objItemSelected.xCant_item || 0// $(this).parent().find('.xCant_item')
		, xStockActual = itemPedidos_objItemSelected.stock_actual // _xmenu_item_2.find('.xstock_item p').text()
		//, xidItem2 = itemPedidos_objItemSelected.iditem
		, xidItem2 = itemPedidos_objItemSelected.iditem === xidItem ? itemPedidos_objItemSelected.iditem2 ? itemPedidos_objItemSelected.iditem2 : itemPedidos_objItemSelected.iditem : itemPedidos_objItemSelected.iditem // _xmenu_item_2_dataset.item // _xmenu_item_2.attr('data-item') //iditem verdader
		, xDesItem = itemPedidos_objItemSelected.des_item // _xmenu_item_2.find('.xtitulo_item').text()
		, xPrecioItem = itemPedidos_objItemSelected.precio // _xmenu_item_2.find('.xprecio_item').text()
		, xIndicaciones = itemPedidos_objItemSelected.xindicaciones //_xmenu_item_2.find('#txt_referencia').val()
		, xCantActual = parseInt(objCant_cant) //parseInt(objCant.text())
		, xCantSeccion=parseInt(xArrayPedidoObj[xidTipoConsumo]['cantidad'])
		, xCantTotalItem=0
		, xDesSeccion = itemPedidos_objItemSelected.des_seccion || xTituloDet // _xmenu_item_2_dataset.desseccion // _xmenu_item_2.attr('data-desseccion')
		, xIdSeccionItem = itemPedidos_objItemSelected.idseccion // _xmenu_item_2.attr('data-idseccion')
		, xIdSeccionItem_index = itemPedidos_objItemSelected.idseccion_index // _xmenu_item_2.attr('data-idseccionindex')
		, xRowidimpresora = itemPedidos_objItemSelected.idimpresora // _xmenu_item_2.attr('data-idimpresora')
		, xRowidimpresora_otro = itemPedidos_objItemSelected.idimpresora_otro
		, xRowidporcion = itemPedidos_objItemSelected.idprocede // _xmenu_item_2.attr('data-idprocede')
		, xRowProcede = itemPedidos_objItemSelected.procede // _xmenu_item_2.attr('data-procede')
		, xRowProcede_index = itemPedidos_objItemSelected.procede_index // _xmenu_item_2.attr('data-procedeindex')//para odernar al momento de imprimir: primero carta luego 1 bodega
		, ximprmir_comanda = itemPedidos_objItemSelected.imprimir_comanda // _xmenu_item_2.attr('data-imprimircomanda') //si solo hay items de bodega imprime o no comanda segun confg en almacen// si en  imprimir_comanda=1 imprimi
		, xcant_descontar = itemPedidos_objItemSelected.cant_descontar // _xmenu_item_2.attr('data-cant_descontar') //cantidad a desconatar del stock, si es porcion pueden ser 2,1  (2 chorizos, 1 huevo) o 2(2 porciones de 1/2 cocona)
		, xidalmacen_items = itemPedidos_objItemSelected.idalmacen_items // _xmenu_item_2.attr('data-idalmacen_items')
		, xidDescontar=xRowidporcion
		, xPrecioTotal
		, xcant_max = parseInt(xStockActual)
		, xidcategoria = itemPedidos_objItemSelected.idcategoria
		, xStockActual = xcant_max //$(element_li_add__print).attr('data-stock_actual');
		, xSotockSocket = xcant_max
		, xSotockSocketRun = xcant_max
		, xcantRunSocket = xcant_max
		, xcant = xCantActual
		, xsigno = xOperacion
		, sec_orden = itemPedidos_objItemSelected.sec_orden
		, subitems_selected_index = itemPedidos_objItemSelected.subitems_selected_index;

		

		//concatena con indicaciones >>en servidor
		//if(xIndicaciones!=""){xIndicaciones='('+xIndicaciones+')';}
		//xDesItem=xDesItem+xIndicaciones.toLowerCase();
		xCantActual = isNaN(xCantActual) ? 0 : xCantActual;
		xCantSeccion = isNaN(xCantSeccion) ? 0 : xCantSeccion;

		xcant = xCantActual;
		// if(isNaN(xCantActual)){xCantActual=0}
		// if(isNaN(xCantSeccion)){xCantSeccion=0}

		_thisObj.parents('.xpedir_item').find('.xCant_item').each(function (index, element) {
				var xval=parseInt($(element).text());
				if(isNaN(xval)){xval=0}
				xCantTotalItem=parseInt(xCantTotalItem)+xval
			});
			
			if (_viene_venta_rapida === 1) { //viene de venta rapida seleccionados obj
			
				if(xOperacion=='+'){
					//omitir para seguir vendiendo sin stock, da change a despues			
					if ( !isSocket ) {
						if(xcant<xcant_max){xcant++;}			
					} else {
						xSotockSocket = xcant_max > 0 ? xSotockSocket - 1 : 0;
						xSotockSocketRun = xcant_max > -1 ? xSotockSocketRun - 1 : 0;
						if(xcant_max > 0 ){xcant++;}
					}
					xcantRunSocket = xcant;				 
				}else{
		
					xSotockSocket = xcant === 0 ? xcant_max : xSotockSocket + 1;
					xSotockSocketRun = xcant === 0 ? xcant_max : xSotockSocketRun + 1;
					xcant--;	
					xcantRunSocket = xcant;					
					xcant = xcant <= 0 ? 0 : xcant;
					// xSotockSocket = xcant < 0 ? xSotockSocket : xSotockSocket + 1;
					// xSotockSocket = xSotockSocket > xcant_max ? xcant_max : xSotockSocket;
				}

				xCantActual = xcant;
				xCount_cant_ico = xcant; // esta variable se utiliza en mipedido para mostrar la cantidad de items por seccion
	
			} else {

				if(isNaN(xCantTotalItem)){xCantTotalItem=0}
				xCantActual=parseInt(xCantActual)+xOperacion+parseInt(1);
				xCantTotalItem=parseInt(xCantTotalItem)+xOperacion+parseInt(1);
				xCount_cant_ico=parseInt(xCount_cant_ico)+xOperacion+parseInt(1);
				xCantSeccion=parseInt(xCantSeccion)+xOperacion+parseInt(1);
		
				xCantActual=eval(xCantActual);
				xCantTotalItem=eval(xCantTotalItem);
				xCount_cant_ico=eval(xCount_cant_ico);
				xCantSeccion=eval(xCantSeccion);
				if(xCount_cant_ico<0){xCount_cant_ico=0;}
				if(xStockActual!='ND'){if(xCantTotalItem>parseInt(xStockActual)){return;}}
				if(xCantActual<=0){xCantActual=0; objCant.addClass('xInvisible');}else{objCant.removeClass('xInvisible');}
			}

		// itemPedidos_objItemSelected.xCant_item = xCeroIzq(xCantActual,2); // cantidad actual
		objCant.text(xCeroIzq(xCantActual,2));

		xPrecioTotal=parseFloat(xCantActual*xPrecioItem).toFixed(2);

		
		const mySubItemView = checkMySubitemView(xidTipoConsumo, xidItem);		

		// is controlable obtiene idsubitem 11/01/2022
		const isSubItemControlable = itemPedidos_objItemSelected?.subitems ? parseInt(itemPedidos_objItemSelected.subitems[0].iscontrolable) === 1 : false;
		const idSubItemControlable = isSubItemControlable ? itemPedidos_objItemSelected.subitems_selected[0].iditem_subitem : 0;

		xArrayPedidoObj[xidTipoConsumo]["cantidad"]=xCantSeccion;
		xArrayPedidoObj[xidTipoConsumo][xidItem]={
			'idcategoria':xidcategoria, 
			'idseccion':xIdSeccionItem, 
			'idseccion_index':xIdSeccionItem_index, 
			'des_seccion':xDesSeccion, 
			'sec_orden': sec_orden,
			'iditem':xidItem, 
			'idtipo_consumo':xidTipoConsumo, 
			'stock_actual': xStockActual, 
			'cantidad':xCantActual, 'precio':xPrecioItem, 'des':xDesItem,
			'precio_total': xPrecioTotal, 'precio_total_calc': xPrecioTotal,
			'precio_print':'','indicaciones':xIndicaciones,
			'iditem2':xidItem2,
			'idimpresora':xRowidimpresora, 
			'idimpresora_otro':xRowidimpresora_otro, 
			'idprocede':xRowidporcion, 'procede':xRowProcede, 'procede_index':xRowProcede_index,'imprimir_comanda':ximprmir_comanda, 'iddescontar':xidDescontar, 'cant_descontar':xcant_descontar, 'idalmacen_items':xidalmacen_items, 'visible':0
			,'pwa': isSocket ? 1 : 0, isporcion: itemPedidos_objItemSelected.isporcion
			,'precio_unitario': itemPedidos_objItemSelected.precio_unitario
			,'detalle': itemPedidos_objItemSelected.detalle
			,'subitems': itemPedidos_objItemSelected.subitems
			,'subitems_selected' : itemPedidos_objItemSelected.subitems_selected
			,'subitem_required_select': itemPedidos_objItemSelected.subitem_required_select
			,'subitem_cant_select': itemPedidos_objItemSelected.subitem_cant_select
			,'subitems_view':itemPedidos_objItemSelected.subitems_view ? itemPedidos_objItemSelected.subitems_view : mySubItemView
			,'isporcion': itemPedidos_objItemSelected.isporcion
			,'iditem_subitem': idSubItemControlable
			,'subitems_selected_index': subitems_selected_index			
		};

		// itemPedidos_objItemSelected = xArrayPedidoObj[xidTipoConsumo][xidItem];

		// itemPedidos_objItemSelected.cantidad = xCantActual;

		// subitems_view
		const sumar  =  xsigno === '+' ? true : false;
		xAddSubItemsView(xidTipoConsumo, xidItem, sumar);

		if(xCantActual<=0){delete xArrayPedidoObj[xidTipoConsumo][xidItem]}

		window.localStorage.setItem("::app3_sys_dta_pe",JSON.stringify(xArrayPedidoObj))

		window.localStorage.setItem("::app3_sys_dta_count_ico",xCount_cant_ico);
		const _objIcoPedido = $("#_xIco_MiPedido .xCantPedio_ico");
		if (xCount_cant_ico > 0) {
			_objIcoPedido.text(xCeroIzq(xCount_cant_ico, 2));
			_objIcoPedido.removeClass('xInvisible');
		} else {
			_objIcoPedido.addClass('xInvisible');
		}

		

		if ( itemPedidos_objItemSelected.cantidad !== 'ND' ) {
			if ( isSocket && xcantRunSocket >= 0 && xSotockSocketRun > -1) {			
				
				itemPedidos_objItemSelected.stock_actual = xSotockSocket;
				const itemNotifySocket = {
					cantidad: xSotockSocket,
					idcarta_lista: itemPedidos_objItemSelected.idcarta_lista,
					iditem: itemPedidos_objItemSelected.iditem,
					// isalmacen: itemPedidos_objItemSelected.procede === '0' ? 1 : 0,
					isalmacen: itemPedidos_objItemSelected.procede.toString() === '0' ? 1 : 0,
					isporcion: itemPedidos_objItemSelected.isporcion,
					subitems: typeof itemPedidos_objItemSelected.subitems === 'string' ? JSON.parse(itemPedidos_objItemSelected.subitems): itemPedidos_objItemSelected.subitems,
					subitems_selected: itemPedidos_objItemSelected.subitems_selected,
					sumar:  xsigno === '+' ? true : false
				}		
				
				// console.log('itemNotifySocket', itemNotifySocket)
				
				_cpSocketEmitItemModificado(itemNotifySocket);
	
				_cpSocketSavePedidoStorage(xArrayPedidoObj);
	
				compItemSumImporte(); // del componente comp-item-subitems
						
			}
		}

		xcantRunSocket = true;

		
		// si esta en modo vista pantalla tablet, update x-mipedido
		const xVistaMiPedido = document.getElementById('mipedido-view');

		if (xVistaMiPedido) {
			xVistaMiPedido._outLoadPedido();
		}

		if (_viene_venta_rapida == 1) { //viene de venta rapida
			xVerMipedidoVR();
		}

		//

		// event.stopPropagation();
		e.stopPropagation();
		e.stopImmediatePropagation()
		return false;
	}
	// })

//agregar item desde control de pedidos
$(document.body).on('click', '#content_item_pedido div.xBtn_li',(e) => handlerFnMiPedidoControl(e)); // control de mesas
// $(document.body).on('click', '.btn-sm-add-row', handlerFnMiPedidoControl); // control de mesas mismo pedido
$(document.body).on('click', '#accordion div.xBtn_contet_li2',(e) => handlerFnMiPedidoControl(e)); // venta rapida
// $(document.body).on('click', '#accordion div.content_li', handlerFnMiPedidoControl); // venta rapida
$(document.body).on('click', '#accordion div.content_li', function(e) {
	if (!isTouch) return; // desde venta rapida activa el touch
	
	handlerFnMiPedidoControl(e);
}); // venta rapida

$(document.body).on('click', '.list_add_item ul li', function(e) {
	// if (!isTouch) return; // desde venta rapida activa el touch
	if ( e.target.className.indexOf('xbtn_li_editar') > -1 ) {
		return;
	}
	handlerFnMiPedidoControl(e);
}); // lista control de pedidos

async function handlerFnMiPedidoControl(e) {
// $(document).on('click', '.xBtn_li, .xBtn_li2', function(e) {		

		var _nomClassXcant_li = 'xcant_li';
		var _thisObj = e.target || e;
		var isLoadingSubItems = false;
		const isRowItemPedido = _thisObj.dataset.op === 'itempedido' ? true : false;
		
		
		if ( isRowItemPedido ) { // viene del pedido item control pedido
			_thisObj = $(_thisObj).parents('tr')[0];			
		}

		const _objParentLi = _thisObj.dataset.index ? _thisObj : _thisObj.parentElement.dataset.index ? _thisObj.parentElement : _thisObj.parentElement.parentElement.dataset.index ? _thisObj.parentElement.parentElement : _thisObj.parentElement.parentElement.parentElement;
		const _dataSetObj = _objParentLi.dataset;
		// const _isLi = _dataSetObj.isli ? true : false; // si viene del li ventarapida sumar al click
		const _viene_venta_rapida = _dataSetObj.ventarapida; // _thisObj.parentElement.parentElement.dataset.ventarapida || 0;		
		var _itemIndex = _dataSetObj.index// _thisObj.parentElement.parentElement.dataset.index;

		
		

		
		
		const _idCategoriaItemAdd = _thisObj.dataset.idcategoria;
		if ( isRowItemPedido ) { // viene del pedido item control pedido

			// 0907222 consultamos si el item esta en la carta cargada
			if (_idCategoriaItemAdd && _idCategoriaItemAdd != 1 && xGeneralDataCarta[0].idcategoria != _idCategoriaItemAdd ) {
				xGeneralDataCarta = await xGeneralLoadItemsAddItem(_idCategoriaItemAdd);
			}

			// _thisObj = $(_thisObj).parents('tr')[0];
			const idItemRowPedido = _thisObj.dataset.iditem.toString();
			xGeneralDataCarta.map((x, i) => {
				if (x.iditem.toString() === idItemRowPedido) {
					_itemIndex = i;
				}
			});
		} else {
			_itemIndex = _dataSetObj.index// _thisObj.parentElement.parentElement.dataset.index;			
		}

		xidTipoConsumo = $("#select_ulTPC option:selected").val();
		itemPedidos_objItemSelected = xGeneralDataCarta[_itemIndex];
		
		
		// xli_des = itemPedidos_objItemSelected.des_item;
		
		if (_viene_venta_rapida == 1) { //viene de venta rapida seleccionados obj
			_nomClassXcant_li = 'xcant_li2';

			//si tiene subtiems lanza el popup opciones // en control de pedidos no lanza subopciones
			if (isShowOpcionesPrimero && itemPedidos_objItemSelected.subitems) { 
				xCompSubitems.openDialog(null, _itemIndex);  
				return; 
			} 
			// else {

			// 	if (isShowOpcionesPrimero) { 
			// 		// isLoadingSubItems = true;
			// 		// pedir al control devolver si tiene subitems para mostar dialog
			// 		// xCompSubitems.getSubtItemsItemById(itemPedidos_objItemSelected.iditem);
			// 		// console.log('data', _data);
			// 		xCompSubitems.getSubtItemsItemById(itemPedidos_objItemSelected.iditem).then(resSubItems => {
			// 			resSubItems = resSubItems?.length > 0 ? true : false;
			// 			if ( resSubItems ) {
			// 				xCompSubitems.openDialog(null, _itemIndex);  
			// 				return; 
			// 			}
			// 			//  else {
			// 			// 	isLoadingSubItems = false;
			// 			// }		
			// 		});
			// 	} 
			// }
			
		}

		// if ( isLoadingSubItems ) {return; }

		xidItem = itemPedidos_objItemSelected.idcarta_lista; // $(this).parents('.xmenu_item_2').attr('data-id'); // iditem lista de la carta
		var element_cant_li_sel = _objParentLi.getElementsByClassName(_nomClassXcant_li); // _thisObj.parentElement.getElementsByClassName(_nomClassXcant_li) //$(this).parent().find(_nomClassXcant_li);		
		element_cant_li_sel = $(element_cant_li_sel);
		// if(element_cant_li_sel.length==0){element_cant_li_sel=$(this).parent().find('.xcant_li2');}
		// var element_li_add__print= $(this).parent().parent();
		
		var xsigno= _thisObj.textContent != '+' && _thisObj.textContent != '-' ? _dataSetObj.signo : _thisObj.textContent; // signo si viene de ventarapida solo click en item suma //$(this).text(),
		xsigno = isRowItemPedido ? '+' : xsigno;
		var objCant_cant = xArrayPedidoObj[xidTipoConsumo] ? xArrayPedidoObj[xidTipoConsumo][xidItem] ? xArrayPedidoObj[xidTipoConsumo][xidItem]['cantidad'] : 0 : 0
		, xcant = parseInt(objCant_cant) //parseInt(element_cant_li_sel.text()),		
		, xcant_max = itemPedidos_objItemSelected.stock_actual || 1000 // element_cant_li_sel.attr('data-cantmax'),
		, xli_tipoconsumo = xidTipoConsumo //$("#select_ulTPC option:selected").val(),
		, xli_iditem = xidItem; //$(element_li_add__print).attr('data-idcl');
		
		// if(xli_des==""){xli_des=$(this).parent().parent().find('.xtitulo_li2').text();}//.split('|');xli_des=xli_des[1].trim();}
		var xli_des = itemPedidos_objItemSelected.des_item // $(this).parent().parent().find('.xtitulo_li').text();
		, xli_des_ref = itemPedidos_objItemSelected.indicaciones || '' //$(this).parent().parent().find('#xinput_li').val();
		, xli_precio = itemPedidos_objItemSelected.precio //$(element_li_add__print).attr('data-punitario'),
		, xli_idimpresora = itemPedidos_objItemSelected.idimpresora //$(element_li_add__print).attr('data-idimpresora'),
		, xli_idimpresora_otro = itemPedidos_objItemSelected.idimpresora_otro //$(element_li_add__print).attr('data-idimpresora'),
		, xli_idprocede = itemPedidos_objItemSelected.idprocede //$(element_li_add__print).attr('data-idprocede'),
		, xli_Procede = itemPedidos_objItemSelected.procede //$(element_li_add__print).attr('data-procede'),
		, xli_Procede_index = itemPedidos_objItemSelected.procede_index // $(element_li_add__print).attr('data-procedeindex');//para odernar al momento de imprimir: primero carta luego 1 bodeg,
		, xidsecion = itemPedidos_objItemSelected.idseccion
		, xidsecion_index = itemPedidos_objItemSelected.idseccion_index
		, xdes_seccion = itemPedidos_objItemSelected.des_seccion
		// , xidItem2 = itemPedidos_objItemSelected.iditem
		// , xidItem2 = itemPedidos_objItemSelected.iditem === xidItem ? itemPedidos_objItemSelected.iditem2 : itemPedidos_objItemSelected.iditem 
		, xidItem2 = itemPedidos_objItemSelected.iditem === xidItem ? itemPedidos_objItemSelected.iditem2 ? itemPedidos_objItemSelected.iditem2 : itemPedidos_objItemSelected.iditem : itemPedidos_objItemSelected.iditem // _xmenu_item_2_dataset.item // _xmenu_item_2.attr('data-item') //iditem verdader
		, xPrecioTotal=0
		// , xviene_venta_rapida = _viene_venta_rapida //$(element_li_add__print).attr('data-ventarapida'),
		, ximprmir_comanda = itemPedidos_objItemSelected.imprimir_comanda // $(element_li_add__print).attr('data-imprimircomanda') || 0, //si solo hay items de bodega imprime o no comanda segun confg en almacen// si en  imprimir_comanda=1 imprim,
		, xcant_descontar = itemPedidos_objItemSelected.cant_descontar // $(element_li_add__print).attr('data-cant_descontar'), //cantidad a desconatar del stock, si es porcion pueden ser 2,1  (2 chorizos, 1 huevo) o 2(2 porciones de 1/2 cocona,
		, xidcategoria = itemPedidos_objItemSelected.idcategoria || _idCategoriaItemAdd // $(element_li_add__print).attr('data-idcategoria'),
		, xli_idalmacen_items = itemPedidos_objItemSelected.idalmacen_items // $(element_li_add__print).attr('data-idalmacen_items'),
		, xStockActual = xcant_max //$(element_li_add__print).attr('data-stock_actual');
		, xSotockSocket = xcant_max
		, xSotockSocketRun = xcant_max
		, xcantRunSocket = xcant_max
		, sec_orden = itemPedidos_objItemSelected.sec_orden;

		//concatena con indicaciones >>en servidor
		//if(xIndicaciones!=""){xIndicaciones='('+xIndicaciones+')';}
		//xDesItem=xDesItem+xIndicaciones.toLowerCase();

		//var xArrayPedidoLiObj=new Array();

		// if(typeof xArrayPedidoObj[xli_tipoconsumo][xli_iditem]==="undefined"){xcant=0}else{
		// 	xcant = parseInt(xArrayPedidoObj[xli_tipoconsumo][xli_iditem].cantidad) || 0;
		// }

		if(xsigno=='+'){
			//omitir para seguir vendiendo sin stock, da change a despues			
			if ( !isSocket || isRowItemPedido ) {
				if(xcant<xcant_max){xcant++;}			
			} else {
				xSotockSocket = xcant_max > 0 ? xSotockSocket - 1 : 0;
				xSotockSocketRun = xcant_max > -1 ? xSotockSocketRun - 1 : 0;
				if(xcant_max > 0 ){xcant++;}
			}
			xcantRunSocket = xcant;				 
		}else{

			xSotockSocket = xcant === 0 ? xcant_max : xSotockSocket + 1;
			xSotockSocketRun = xcant === 0 ? xcant_max : xSotockSocketRun + 1;
			xcant--;	
			xcantRunSocket = xcant;					
			xcant = xcant <= 0 ? 0 : xcant;
			// xSotockSocket = xcant < 0 ? xSotockSocket : xSotockSocket + 1;
			// xSotockSocket = xSotockSocket > xcant_max ? xcant_max : xSotockSocket;
		}

		xPrecioTotal=parseFloat(parseFloat(xli_precio)*parseFloat(xcant)).toFixed(2);
		// xArrayPedidoObj[xli_tipoconsumo][xli_iditem]={'idcategoria':xidcategoria, 'idseccion':$(element_li_add__print).attr('data-idseccion'), 'idseccion_index':$(element_li_add__print).attr('data-idseccionindex'), 'des_seccion':$(element_li_add__print).attr('data-cat'), 'iditem':xli_iditem, 'idtipo_consumo':xli_tipoconsumo, 'stock_actual': xStockActual, 'cantidad':xcant, 'precio':xli_precio, 'des':xli_des,
		// 	'precio_total': xPrecioTotal, 'precio_total_calc': xPrecioTotal,'precio_print':xPrecioTotal,'indicaciones':xli_des_ref,'iditem2':$(element_li_add__print).attr('data-iditem'), 'idimpresora':xli_idimpresora, 'idprocede':xli_idprocede, 'procede':xli_Procede, 'procede_index':xli_Procede_index, 'imprimir_comanda':ximprmir_comanda, 'cant_descontar':xcant_descontar, 'idalmacen_items':xli_idalmacen_items,  'visible':0};
		
		var mySubItemView = checkMySubitemView(xli_tipoconsumo, xli_tipoconsumo);

		xArrayPedidoObj[xli_tipoconsumo][xli_iditem]={
			'idcategoria':xidcategoria,
			'idseccion':xidsecion,
			'idseccion_index':xidsecion_index,
			'sec_orden': sec_orden,
			'des_seccion':xdes_seccion,
			'iditem':xli_iditem,
			'idtipo_consumo':xli_tipoconsumo,
			'stock_actual': xStockActual,
			'cantidad':xcant,'precio':xli_precio, 'des':xli_des,
			'precio_total': xPrecioTotal, 'precio_total_calc': xPrecioTotal,
			'precio_print': xPrecioTotal, 'indicaciones': xli_des_ref, 
			'iditem2': xidItem2, 
			'idimpresora': xli_idimpresora, 
			'idimpresora_otro': xli_idimpresora_otro, 
			'idprocede': xli_idprocede, 'procede': xli_Procede, 'procede_index': xli_Procede_index, 'imprimir_comanda': ximprmir_comanda, 'cant_descontar': xcant_descontar, 'idalmacen_items': xli_idalmacen_items, 'visible': 0
			,'pwa': isSocket ? 1 : 0, isporcion: itemPedidos_objItemSelected.isporcion
			,'precio_unitario': itemPedidos_objItemSelected.precio_unitario
			,'detalle': itemPedidos_objItemSelected.detalle
			,'subitems': itemPedidos_objItemSelected.subitems
			,'subitems_selected' : itemPedidos_objItemSelected.subitems_selected
			,'subitem_required_select': itemPedidos_objItemSelected.subitem_required_select
			,'subitem_cant_select': itemPedidos_objItemSelected.subitem_cant_select
			,'subitems_view':itemPedidos_objItemSelected.subitems_view ? itemPedidos_objItemSelected.subitems_view : mySubItemView
			,'isporcion': itemPedidos_objItemSelected.isporcion
			};


		// limpiar de nulls xArrayPedidoObj
		// xArrayPedidoObj = xArrayPedidoObj.filter(x => x).map(x => x);
		// console.log(xArrayPedidoObj);


		element_cant_li_sel.text(xcant);
		if(xcant<=0){
			xcant=0;element_cant_li_sel.removeClass('cant_fixed_li');
			delete xArrayPedidoObj[xli_tipoconsumo][xli_iditem];}
		else{
			element_cant_li_sel.addClass('cant_fixed_li');
		}

		if ( itemPedidos_objItemSelected.cantidad !== 'ND' ) {
			if ( isSocket && xcantRunSocket >= 0 && xSotockSocketRun > -1) {			
				
				itemPedidos_objItemSelected.stock_actual = xSotockSocket;
				const itemNotifySocket = {
					cantidad: xSotockSocket,
					idcarta_lista: itemPedidos_objItemSelected.idcarta_lista,
					iditem: itemPedidos_objItemSelected.iditem,
					isalmacen: itemPedidos_objItemSelected.procede.toString() === '0' ? 1 : 0,
					isporcion: itemPedidos_objItemSelected.isporcion,
					subitems: typeof itemPedidos_objItemSelected.subitems === 'string' ? JSON.parse(itemPedidos_objItemSelected.subitems): itemPedidos_objItemSelected.subitems,
					subitems_selected: itemPedidos_objItemSelected.subitems_selected,
					sumar:  xsigno === '+' ? true : false
				}
				// console.log('itemNotifySocket list', itemNotifySocket)
				
				_cpSocketEmitItemModificado(itemNotifySocket);

				_cpSocketSavePedidoStorage(xArrayPedidoObj);
						
			}
		}

		xcantRunSocket = true;



		if (_viene_venta_rapida == 1) { //viene de venta rapida
			xVerMipedidoVR();
		}

		// event.stopPropagation();
		try {		
			e.stopPropagation();
			e.stopImmediatePropagation()
		} catch (error) {}
	}
	// })

// enviar item modificado socket

function xNotifyItemModificado(item) {
	const itemNotifySocket = {
		cantidad: item.cantidad,
		idcarta_lista: objItem.parent().attr('data-idcarta_lista'),
		iditem: objItem.parent().attr('data-iditem'),
		// isalmacen: objItem.parent().attr('data-procede') === '1' ? 0 : 1,
		isalmacen: objItem.parent().attr('data-procede') === '0' ? 1 : 0,
		// isalmacen: itemPedidos_objItemSelected.procede.toString() === '0' ? 1 : 0,
		isporcion: objItem.parent().attr('data-isporcion')
	}
}

// enviar item modificado socket

function checkMySubitemView(tpc, id) {
	try {
		return xArrayPedidoObj[tpc][id].subitems_view ? xArrayPedidoObj[tpc][id].subitems_view : null
	} catch (error) {
		return null;
	}
}

// envia el item por socket
function xSendItemBySocket(xsigno) {
	// itemPedidos_objItemSelected.stock_actual = xSotockSocket;
	const itemNotifySocket = {
		cantidad: xSotockSocket,
		idcarta_lista: itemPedidos_objItemSelected.idcarta_lista,
		iditem: itemPedidos_objItemSelected.iditem,
		// isalmacen: itemPedidos_objItemSelected.procede === '0' ? 1 : 0,
		isalmacen: itemPedidos_objItemSelected.procede.toString() === '0' ? 1 : 0,
		isporcion: itemPedidos_objItemSelected.isporcion,
		subitems: typeof itemPedidos_objItemSelected.subitems === 'string' ? JSON.parse(itemPedidos_objItemSelected.subitems): itemPedidos_objItemSelected.subitems,
		subitems_selected: itemPedidos_objItemSelected.subitems_selected,
		sumar:  xsigno === '+' ? true : false
	}			
	
	_cpSocketEmitItemModificado(itemNotifySocket);
	_cpSocketSavePedidoStorage(xArrayPedidoObj);
	compItemSumImporte(); // del componente comp-item-subitems
}

// de la lista de mi pedido subitems de venta rapida - para sumar o restar
function modificarUnSubItem(obj) {
	obj = obj.parents('tr')[0];
	// const _sumar = sumar === 0 ? false : true;
	// const _signo = _sumar ? '+' : '-';
	const _idtpc = obj.dataset.idtipo_consumo;
	const _idcl = obj.dataset.idcarta_lista;
	const _idsubitem = obj.dataset.idsubitem;
	const _indexSubItem = obj.dataset.index;
	var _subItemQuit = xArrayPedidoObj[_idtpc][_idcl];
	const _subItemDelete = _subItemQuit.subitems_view.filter(t => t.id === _idsubitem)[0].subitems;
	_subItemQuit.subitems_selected = [];
	_subItemQuit.subitems_selected = _subItemDelete;
	_subItemQuit.subitems_selected_index = _indexSubItem;

	// para que coincidan en la funcion principal
	itemPedidos_objItemSelected = _subItemQuit;
	itemPedidos_objItemSelected.des_item = _subItemQuit.des;
	itemPedidos_objItemSelected.idcarta_lista = _subItemQuit.iditem;
	itemPedidos_objItemSelected.subitems_selected_index = _indexSubItem;
	// xThisVentaRapida.objSubItemQuitar = _subItemQuit.subitems_view.filter(x => x.id === _idsubitem)[0];
	// console.log(_subItemQuit);
}

function xAddSubItemsView(tpc, id, sumar) {
	var elItem = xArrayPedidoObj[tpc][id];
	elItem.subitems_view = elItem.subitems_view ? elItem.subitems_view : [];	

	if ( !elItem.subitems ) { return; }
	if (elItem.subitems.length === 0 ) { return; }
    var newSubItemView = {};
    newSubItemView.id = '';
    newSubItemView.des = [];
    newSubItemView.cantidad_seleccionada = 0;
    newSubItemView.precio = 0;
    newSubItemView.indicaciones = '';
	newSubItemView.subitems = [];

	// if ( elItem.subitems_selected ) {
	if ( elItem.subitems_selected && elItem.subitems_selected.length > 0 ) {

        elItem.subitems_selected.map((x) => {
          newSubItemView.id += x.iditem_subitem.toString();
          newSubItemView.des.push(primeraConMayusculas(x.des.toLowerCase()));
          newSubItemView.cantidad_seleccionada = 1;
          newSubItemView.precio += parseFloat(x.precio);
          newSubItemView.indicaciones += x.indicaciones === undefined ? '' :  ' (' + x.indicaciones + ')';
		  newSubItemView.indicaciones_item = elItem.indicaciones
          newSubItemView.subitems.push(x);
		});
		
		newSubItemView.des = newSubItemView.des.join(', ');

		newSubItemView.des += elItem.indicaciones === undefined ? '' :  ', (' + elItem.indicaciones + ')';

        // itemCarta para sacar los indicadores
        // itemCarta.indicaciones = '';
        elItem.indicaciones = '';
        elItem.subitems_view = elItem.subitems_view ? elItem.subitems_view : [];
		
		var isExistSubItemView = elItem.subitems_view.filter((subView) => subView.id === newSubItemView.id && subView.indicaciones_item === newSubItemView.indicaciones_item)[0];
		if ( elItem.subitems_selected_index ) { // si viene de la lista de resumen pedido venta rapida
			isExistSubItemView = elItem.subitems_view[parseInt(elItem.subitems_selected_index)];
		}

        if ( isExistSubItemView ) {
          if ( sumar ) {
            isExistSubItemView.indicaciones += newSubItemView.indicaciones;
            isExistSubItemView.cantidad_seleccionada += 1;
            isExistSubItemView.precio += newSubItemView.precio;
          } else {
            // resta
            this.restarCantSubItemView(elItem, isExistSubItemView);
          }
        } else {
          // isExistSubItemView.indicaciones = newSubItemView.indicaciones;
          if ( sumar ) {
			elItem.subitems_view.push(newSubItemView);
			xArrayPedidoObj[tpc][id].subitems_view = elItem.subitems_view;
          } else {
            // si es restar y no existe en la lista quita el ultimo
            this.restarCantSubItemView(elItem, null);
          }
        }

      } else {
        this.restarCantSubItemView(elItem, null);
	  }
	  
	  this.addPrecioItemMiPedido(elItem);
	  
}

function restarCantSubItemView(_elItem, isExistSubItemView = null) {
    if ( isExistSubItemView ) {
      // si existe subitemview
      const precioDescontar = isExistSubItemView.precio / isExistSubItemView.cantidad_seleccionada;
      isExistSubItemView.cantidad_seleccionada -= 1;
      isExistSubItemView.precio -= precioDescontar;
      isExistSubItemView.precio = isExistSubItemView.precio < 0 ? 0 : isExistSubItemView.precio;

      if ( isExistSubItemView.cantidad_seleccionada <= 0 ) {
        // borrar el item
        _elItem.subitems_view = _elItem.subitems_view.filter((subView) => subView.cantidad_seleccionada > 0);
      }

    } else {
	  // si no envia o no existe el subitemview a restar toma el ultimo
      const lentSubItemView = _elItem.subitems_view.length;
      const _SubItemView = _elItem.subitems_view[lentSubItemView - 1];
	  if ( _SubItemView ) {
		  const precioDescontar = _SubItemView.precio / _SubItemView.cantidad_seleccionada;
	
		  _SubItemView.cantidad_seleccionada --;
		  _SubItemView.precio -= precioDescontar;
	
		  if ( _SubItemView.cantidad_seleccionada <= 0 ) {
			// borrar el item
			_elItem.subitems_view = _elItem.subitems_view.filter((subView) => subView.cantidad_seleccionada > 0);
		  }
	
		  // para restar en el back end
		  _elItem.subitems_selected = _SubItemView.subitems;
	  }
    }
  }

function addPrecioItemMiPedido(elItem) {
	elItem.cantidad_seleccionada = elItem.cantidad;
	var totalSubItems = elItem.subitems_view ? elItem.subitems_view.map((subIt) => parseFloat(subIt.precio)).reduce((a, b) => a + b , 0) : 0;
	var precioTotal = elItem.cantidad * parseFloat(elItem.precio_unitario);
	precioTotal = parseFloat(precioTotal + totalSubItems).toFixed(2);
	elItem.precio_total = precioTotal;
	elItem.precio_print = precioTotal;
}

//venta rapida
function xBtnSumarRestarKey(xobj,xval){
	//this=$(xobj);	
		const nomClassBtn = xval > 0 ? '.suma' : '.resta';
		const element_cant_li_sel=$(xobj).parent().find(nomClassBtn)[0];
		handlerFnMiPedidoControl(element_cant_li_sel);
		// return;

		// if(element_cant_li_sel.length==0){
		// 	element_cant_li_sel=$(xobj).parent().find('.xcant_li2');
		// }
		// var element_li_add__print= $(xobj).parent().parent();
		// //var xsigno=$(xobj)text();
		// var xcant=parseInt(element_cant_li_sel.text());
		// var xcant_max=element_cant_li_sel.attr('data-cantmax');
		// var xli_tipoconsumo=$("#select_ulTPC option:selected").val();
		// var xli_iditem=$(element_li_add__print).attr('data-idcl');
		// var xli_des=$(xobj).parent().parent().find('.xtitulo_li').text();
		// if(xli_des==""){xli_des=$(xobj).parent().parent().find('.xtitulo_li2').text();}//.split('|');xli_des=xli_des[1].trim();}
		// var xli_des_ref=$(xobj).parent().parent().find('#xinput_li').val();
		// var xli_precio=$(element_li_add__print).attr('data-punitario');
		// var xli_idimpresora=$(element_li_add__print).attr('data-idimpresora');
		// var xli_idprocede=$(element_li_add__print).attr('data-idprocede');
		// var xli_Procede=$(element_li_add__print).attr('data-procede');
		// var xli_Procede_index=$(element_li_add__print).attr('data-procedeindex');//para odernar al momento de imprimir: primero carta luego 1 bodega
		// var ximprmir_comanda=$(element_li_add__print).attr('data-imprimircomanda') || 0; //si solo hay items de bodega imprime o no comanda segun confg en almacen// si en  imprimir_comanda=1 imprimi
		// var xcant_descontar=$(element_li_add__print).attr('data-cant_descontar'); //cantidad a desconatar del stock, si es porcion pueden ser 2,1  (2 chorizos, 1 huevo) o 2(2 porciones de 1/2 cocona)
		// var xidcategoria=$(element_li_add__print).attr('data-idcategoria');
		// var xli_idalmacen_items=$(element_li_add__print).attr('data-idalmacen_items');
		// var xPrecioTotal=0;
		// //var xArrayPedidoLiObj=new Array();

		// //cantidad acutual si la hay
		// //para llevar o local caso venta rapida// add a al pedido
		// if(typeof xArrayPedidoObj[xli_tipoconsumo][xli_iditem]==="undefined"){xcant=0}else{
		// 	xcant = parseInt(xArrayPedidoObj[xli_tipoconsumo][xli_iditem].cantidad) || 0;
		// }

		// if(xval>0){ // resta o suma
		// 	//omitir para seguir vendiendo sin stock, da change a despues
		// 	if(xcant<xcant_max){xcant++;}
		// }else{
		// 	xcant--;
		// }

		// if(xcant<=0){xcant=0;element_cant_li_sel.removeClass('cant_fixed_li')}else{
		// 	element_cant_li_sel.addClass('cant_fixed_li')
		// 	delete xArrayPedidoObj[xli_tipoconsumo][xli_iditem]
		// }


		// xPrecioTotal=parseFloat(parseFloat(xli_precio)*parseFloat(xcant)).toFixed(2);
		// xArrayPedidoObj[xli_tipoconsumo][xli_iditem]={'idcategoria':xidcategoria, 'idseccion':$(element_li_add__print).attr('data-idseccion'), 'idseccion_index':$(element_li_add__print).attr('data-idseccionindex'), 'des_seccion':$(element_li_add__print).attr('data-cat'), 'iditem':xli_iditem, 'idtipo_consumo':xli_tipoconsumo, 'cantidad':xcant, 'precio':xli_precio, 'des':xli_des,
		// 	'precio_total': xPrecioTotal, 'precio_total_calc': xPrecioTotal,'precio_print':xPrecioTotal,'indicaciones':xli_des_ref,'iditem2':$(element_li_add__print).attr('data-iditem'), 'idimpresora':xli_idimpresora, 'idprocede':xli_idprocede, 'procede':xli_Procede, 'procede_index':xli_Procede_index, 'imprimir_comanda':ximprmir_comanda, 'cant_descontar':xcant_descontar,'idalmacen_items':xli_idalmacen_items, 'visible':0};

		// element_cant_li_sel.text(xcant);;

		// if(xcant<=0){xcant=0;element_cant_li_sel.removeClass('cant_fixed_li');delete xArrayPedidoObj[xli_tipoconsumo][xli_iditem]}else{
		// 	element_cant_li_sel.addClass('cant_fixed_li')
		// }

		/*event.stopPropagation();
		e.stopPropagation();
		e.stopImmediatePropagation()*/
}



// homologacion papaya express estructura pedido
// para delivery -> repartidores -> monitor

function xEstructuraExpress(orden, isDelivery, isComercioAppDeliveryMapa) {
	isDelivery = isDelivery.toString() === '1';
	isComercioAppDeliveryMapa = isComercioAppDeliveryMapa.toString() === '1';

	var arr_res = [], arr_tpc_master = {'tipoconsumo': []};
	var arr_tipoc = {
		'titulo': '',
		'secciones': [],
		'descripcion': '',
		'idtipo_consumo': '',
		'count_items_seccion': 1,
		'cantidad_seleccionada': 1
	};

	// si no es delivery o si no tiene habilitado para pp
	// if ( !isDelivery || !isComercioAppDeliveryMapa ) {
	if ( !isDelivery) {
		return arr_res;
	}

	var arr_secciones = [],	arr_seccion_add = [], id_seccion, isAddSeccion = false, isSeccionAdd = false, item_new;

	for (const key in orden) {
		if (orden.hasOwnProperty(key)) {
			const tpc = orden[key];
			arr_tipoc = {
				'titulo': '',
				'secciones': [],
				'descripcion': '',
				'idtipo_consumo': '',
				'count_items_seccion': 1,
				'cantidad_seleccionada': 1
			};
			arr_tipoc.descripcion = tpc.des;
			arr_tipoc.titulo = tpc.titulo;
			arr_tipoc.idtipo_consumo = tpc.id;
			isSeccionAdd = false;

			// arr_tipoc = [];
			arr_secciones = [];

			
			for (const i in tpc) {
				if (tpc.hasOwnProperty(i)) {
					const item_s = tpc[i];

					if ( typeof item_s !== 'object' ) { continue; }
					
					id_seccion = item_s.idseccion;
					isSeccionAdd = true;
					
					// busca seccion
					isAddSeccion = false;
					arr_seccion_add = arr_secciones.filter(s => s.idseccion === id_seccion)[0];
					if ( !arr_seccion_add ) {
						isAddSeccion = true;
						arr_seccion_add = {
							'des': item_s.des_seccion,
							'idseccion': item_s.idseccion,
							'sec_orden': 1,
							'count_items': 1,
							'idimpresora': item_s.idimpresora,
							'ver_stock_cero': item_s.visible,
							'items': []
						};
					}
			


					// items
					arr_seccion_add.items.push({
						'des' :  item_s.des,
						'img' :  '',
						'sumar' :  false,
						'iditem' :  item_s.iditem,
						'precio' :  item_s.precio,
						'procede' : item_s.procede,
						'seccion' : item_s.des_seccion,
						'visible' : true,
						'cantidad' : item_s.cantidad,
						'detalles' : item_s.detalle,
						'selected' :  true,
						'subitems' :  item_s.subitems,
						'isalmacen' : item_s.idalmacen_items,
						'idseccion' : item_s.idseccion,
						'isporcion' : item_s.isporcion,
						'sec_orden' :  1,
						'des_seccion' : item_s.des_seccion,
						'idimpresora' : item_s.idimpresora,
						'precio_print' : item_s.precio_total,
						'precio_total' : item_s.precio_total,
						'idcarta_lista' : item_s.iditem,
						'subitems_view' : item_s.subitems_view,
						'precio_default' : item_s.precio,
						'ver_stock_cero' :  0,
						'precio_unitario' : item_s.precio_unitario,
						'imprimir_comanda' : item_s.imprimir_comanda,
						'itemtiposconsumo' :  [],
						'precio_total_calc' : item_s.precio_total_calc,
						'subitems_selected' :  [],
						'subitem_cant_select' : item_s.subitem_cant_select,
						'cantidad_seleccionada' : item_s.cantidad,
						'subitem_required_select' : item_s.subitem_required_select
					});

					// arr_seccion_add.items.push(item_new);


					if ( isAddSeccion ) {
						arr_secciones.push(arr_seccion_add);
					}
				}
			}

			if ( isSeccionAdd ) {
				arr_tipoc.secciones = arr_secciones;
				arr_tpc_master.tipoconsumo.push(arr_tipoc);
				// console.log('arr_tpc_master', arr_tpc_master);
			}

		}
	}

	arr_res = arr_tpc_master.tipoconsumo.length > 0 ? arr_tpc_master : [];
	return arr_res;
}

// desde venta rapida
// cambia el tipo de consumo 
function xChangeTipoConsumoItems(idtipo_consumo) {
	

	// get canal seleccionado
	const canalSelect = xArrayPedidoObj.filter(i => i).filter(i => i.id === idtipo_consumo)[0];

	xArrayPedidoObj.filter(i => i).filter(i => i.id !== idtipo_consumo).map(tpc => {
		for (const i in tpc) {
			if (tpc.hasOwnProperty(i)) {
				const item_s = tpc[i];

				if ( typeof item_s !== 'object' ) { continue; }
				// console.log(item_s);
				item_s.idtipo_consumo = canalSelect.id; // cambiamos el tipo consumo del item
				canalSelect[i] = item_s;

				// borrar del canal anterior
				delete tpc[i];
			}
		}
	});

	xVerMipedidoVR();
	// console.log('xpedido', xArrayPedidoObj);
}

$(document.body).on('keyup', '.xMiTextReferencia', function(e) {
		if ( !xidTipoConsumo ) return;
		const val_ref = e.target.value;
		itemPedidos_objItemSelected.indicaciones = val_ref;
		itemPedidos_objItemSelected.xindicaciones = val_ref;
		try {			
			xArrayPedidoObj[xidTipoConsumo][xidItem].indicaciones = val_ref; // $(this).val();
		} catch (error) {}
		// xArrayPedidoObj[xli_tipoconsumo][xli_iditem]['indicaciones'] = val_ref;
		
		window.localStorage.setItem("::app3_sys_dta_pe",JSON.stringify(xArrayPedidoObj))

		// event.stopPropagation();
		e.stopPropagation();
		e.stopImmediatePropagation()
		return false;
	})


function xClassEstadoItem(xCantItem){
	var xClassEstado='';
	var xClassEstadoStock='';
	if(xCantItem=='ND'){xClassEstado='xEstadoVerde';xClassEstadoStock='xFondoColorVerde';}
			else{
				xCantItem=parseInt(xCantItem);
				if(xCantItem>5){xClassEstado='xEstadoAmarillo';xClassEstadoStock='xFondoColorAmarillo';}					//if(xCantItem>=5){xClassEstado='xEstadoAmarillo';xClassEstadoStock='xFondoColorAmarillo';}
				if(xCantItem>=10){xClassEstado='xEstadoVerde';xClassEstadoStock='xFondoColorVerde';}					//if(xCantItem>=10){xClassEstado='xEstadoVerde';xClassEstadoStock='xFondoColorVerde';}
				if(xCantItem<=5){xClassEstado='xEstadoAmbar';xClassEstadoStock='xFondoColorAmbar';}
				if(xCantItem<=0){xClassEstado='xEstadoRojo';xClassEstadoStock='xFondoColorRojo';}

				// if(xCantItem>=5){xClassEstado='xEstadoAmarillo';xClassEstadoStock='xFondoColorAmarillo';}
				// if(xCantItem>=10){xClassEstado='xEstadoVerde';xClassEstadoStock='xFondoColorVerde';}
				// if(xCantItem<=5){xClassEstado='xEstadoRojo';xClassEstadoStock='xFondoColorRojo';}
				// if(xCantItem<=0){xClassEstado='xEstadoRojo';xClassEstadoStock='xFondoColorRojo';}
				// if(xCantItem<=0){xClassEstado='xEstadoRojo';xClassEstadoStock='xFondoColorRojo';}
			}

	return xClassEstado+'|'+xClassEstadoStock
}

function xLoadArrayPedido(){	
	xArrayPedidoObj=JSON.parse(window.localStorage.getItem("::app3_sys_dta_pe"));
	if(xArrayPedidoObj!==null){if(xArrayPedidoObj.length>0){return;}}

	var xtpc_t=[];
	xArrayDesTipoConsumo=[];
	xArrayPedidoObj=[];
	
	
	xtpc_t=xm_log_get('estructura_pedido'); //$.parseJSON(window.localStorage.getItem("::app3_sys_dta_tct_estructura"));	
	xtpc_t.map(x => {
		const indexTpc = x.idtipo_consumo;
		xArrayPedidoObj[indexTpc] ={'id':x.idtipo_consumo, 'des':x.descripcion, 'titulo':x.titulo};
		xArrayDesTipoConsumo.push({'id':x.idtipo_consumo, 'des':x.descripcion, 'titulo':x.titulo});
	});
	
	// for (var i = 0; i < xtpc_t.length; i++) {
	// 	xArrayPedidoObj[xtpc_t[i].idtipo_consumo]={'id':xtpc_t[i].idtipo_consumo, 'des':xtpc_t[i].descripcion, 'titulo':xtpc_t[i].titulo};
	// 	xArrayDesTipoConsumo.push({'id':xtpc_t[i].idtipo_consumo, 'des':xtpc_t[i].descripcion, 'titulo':xtpc_t[i].titulo});
	// };
	window.localStorage.setItem("::app3_sys_dta_pe",JSON.stringify(xArrayPedidoObj))

	
}


//verifica si lo hay items de almacen bodega y segun confg imprime o no
function xVerificarSiSeImprimeComanda(xArray){
	if(xArray==null){xArray=xArrayPedidoObj}
	xVerificarImprimirComanda=false;
	for (var i = 0; i < xArray.length; i++) {
		if(xArray[i]==null){continue;}
		$.map(xArray[i], function(n, z) {
			if (typeof n=="object"){
				if(n.cantidad!=0){
					if(n.imprimir_comanda==1){xVerificarImprimirComanda=true; return;}
				}
			}
		});
	}
}

//para calcular la cantidad a descontar // segun item
function xObtnerValSumArray(xArray,filter){
	var cuenta=0;
	for (var i = 0; i < xArray.length; i++) {
		if(xArray[i]==null){continue;}
		$.map(xArray[i], function(n, z) {
			if (typeof n=="object"){
				var xIdRowTb=n.idseccion;
				if(xIdRowTb === filter){
					cuenta=parseFloat(cuenta)+parseFloat(n.cantidad);
				}
			}
		});
	}
	return cuenta;
}

//obtener la suma del total row segun attr
//subfind = td donde esta el valor
function xObtnerValSumTable(tb,BuscarEn,filter,subfind){
	var cuenta=0;
	$(tb).find(".row").each(function (index, element) {
		var xIdRowTb=$(element).attr(BuscarEn);
		if(xIdRowTb === filter){
			cuenta=parseFloat(cuenta)+parseFloat($(element).find(subfind).text());
		}
    });
    return parseInt(cuenta);
}

//sumar del array // precioprint // para totales
function xSumaCantArray(ArrySum){
	var suma=0;
	for (var i = 0; i < ArrySum.length; i++) {
		if(ArrySum[i] == null){continue;}
		$.map(ArrySum[i], function(n, z) {
			if (typeof n === "object"){
				const _xprecio_unitario = parseFloat(n.precio);
				const isSubItems = n.subitems_view ? true : false;
				
				// _total = x.precio_total_calc || x.total;
				// _total = _total.toString().indexOf(',') > -1 ? x.precio_total : _total; // cuando juntan la cuenta
				// _total = parseFloat(_total).toFixed(2);
				
				let _xcantidad = n.cantidad;				
				if (_xcantidad.toString().indexOf(",") > -1) { // caso de que se junte los items
					_xcantidad = _xcantidad.split(',');
					_xcantidad = _xcantidad.reduce((a, b) => parseFloat(a) + parseFloat(b));
				} 
				
				const importe_calculado_unitario = parseFloat(parseFloat(_xcantidad * _xprecio_unitario).toFixed(2));

				// let xp_print;
				// if (n.precio_print === '') { xp_print = n.precio_total_calc; } // cuando es igual a vacio viene de una regla de carta
				
				let xp_print = n.precio_print === '' ? parseFloat(n.precio_total_calc) : parseFloat(n.precio_print);
				// xp_print = xp_print === 0 ? _xprecio_unitario : xp_print;
				
				// let xp_print = isNaN(parseFloat(n.precio_print)) ? 0 : parseFloat(n.precio_print);
				// xp_print = xp_print === 0 ? _xprecio_unitario : xp_print;
				
				// si el precio calculado de und * punitario es menor que ptotal quiere decir que viene de desajuntar

				let xprecio_p = xp_print > importe_calculado_unitario && !isSubItems ? _xprecio_unitario.toFixed(2) : xp_print.toFixed(2);

				if(xprecio_p === ""){
					// xprecio_p = n.precio_total;
					xprecio_p = n.precio_total_calc; // cambio para calcular las reglas de carta
				}
				suma=suma+parseFloat(xprecio_p)
			}
		})
	}
	return suma;
}


//imprimir otros documentos --- -1 precuenta - -2 factura
//xArrayCuerpo debe tener estructura de mod impresion, (como sub pedido ::app3_sys_dta_pe)
function xMandarImprimirOtroDoc(xArrayEncabezado,xArrayDatosPrint,xArrayCuerpo,xidDoc){
	console.log('viene b');
	var xIdPrint=0;
	var xArrayBodyPrint=[];
	var xArrayImpresoras=xm_log_get('app3_woIpPrint'); //JSON.parse(window.localStorage.getItem("::app3_woIpPrint"));
	var xDtTipoDoc=xm_log_get('app3_woIpPrintO');//JSON.parse(window.localStorage.getItem("::app3_woIpPrintO"));
	var xPrintLocal=window.localStorage.getItem("::app3_woIpPrintLo");
	var xIpPrintDoc=xidDoc;
	var xpasePrint=false;

	for (var i = 0; i < xDtTipoDoc.length; i++) {
		//pre-cuenta
		if(xDtTipoDoc[i].idtipo_otro==-1){xIpPrintDoc=xDtTipoDoc[i].idimpresora; break;}
	};
	//si existe impresora local // imprime todos los otros documentos en esta impresora local.
	if(xPrintLocal!=undefined && xPrintLocal!=''){
		xPrintLocal=$.parseJSON(xPrintLocal);
		xArrayDatosPrint[0].ip_print=xPrintLocal.ip;
		xArrayDatosPrint[0].var_margen_iz=xPrintLocal.var_margen_iz;
		xArrayDatosPrint[0].var_size_font=xPrintLocal.var_size_font;
		xArrayDatosPrint[0].papel_size = xPrintLocal.papel_size;
		xArrayDatosPrint[0].num_copias = xPrintLocal.num_copias;
		// xArrayDatosPrint[0].copia_local = xPrintLocal.copia_local;
		xArrayDatosPrint[0].local = 1;
		xpasePrint=true;
	}else{
		for (var i = 0; i < xArrayImpresoras.length; i++) {
			if(xArrayImpresoras[i].idimpresora==xIpPrintDoc){
				xpasePrint=true;
				xIpPrintDoc=xArrayImpresoras[i].ip; 
				xArrayDatosPrint[0].ip_print=xIpPrintDoc;
				xArrayDatosPrint[0].var_margen_iz=xArrayImpresoras[i].var_margen_iz;
				xArrayDatosPrint[0].var_size_font=xArrayImpresoras[i].var_size_font;
				xArrayDatosPrint[0].papel_size = xArrayImpresoras[i].papel_size
				xArrayDatosPrint[0].num_copias = xArrayImpresoras[i].num_copias;
				xArrayDatosPrint[0].copia_local = xArrayImpresoras[i].copia_local;
				xArrayDatosPrint[0].local = 0;
				break;
			}
		}
	}
	if(xpasePrint==false){return false;}
	if(xArrayCuerpo.length==0){return false}

	xArmarSubtotalesArray(xArrayCuerpo,xArrayDatosPrint)
	//xArrayDatosPrint[0].ip_print=xIpPrintDoc;
	xImprimirAhora(xArrayEncabezado,xArrayDatosPrint,xArrayCuerpo,xLocal_xDtSubTotales,function(rpt_print){
		if(rpt_print==false){return;}
		xPopupLoad.titulo="Imprimiendo...";
		xPopupLoad.xopen();
		setTimeout(function(){ xPopupLoad.xclose()}, 3000);
	});
}

//imprimir otros documentos --- -1 precuenta // - -2 factura // no se usa
//xArrayCuerpo debe tener estructura de mod impresion, (como sub pedido ::app3_sys_dta_pe)
// xArraySubTotales ya esta calculado los subtotales
function xMandarImprimirOtroDoc(xArrayEncabezado,xArrayDatosPrint,xArrayCuerpo, xArraySubTotales,xidDoc, showFormatoCorto = false){
	console.log('vienen a');
	var xArrayImpresoras=xm_log_get('app3_woIpPrint'); //JSON.parse(window.localStorage.getItem("::app3_woIpPrint"));
	var xDtTipoDoc=xm_log_get('app3_woIpPrintO');//JSON.parse(window.localStorage.getItem("::app3_woIpPrintO"));
	var xPrintLocal=window.localStorage.getItem("::app3_woIpPrintLo");
	var xIpPrintDoc=xidDoc;
	var xpasePrint=false;

	if ( xidDoc === -1 ) { // precuenta
		showFormatoCorto  = xm_log_get('sede_generales')[0].isprint_cpe_short == '1';
	}

	// no es comanda
	xArrayDatosPrint[0].var_size_font_tall_comanda = 0; //default

	for (var i = 0; i < xDtTipoDoc.length; i++) {
		//pre-cuenta
		if (xDtTipoDoc[i].idtipo_otro == xidDoc){xIpPrintDoc=xDtTipoDoc[i].idimpresora; break;}
	};
	//si existe impresora local // imprime todos los otros documentos en esta impresora local.
	if(xPrintLocal!=undefined && xPrintLocal!=''){
		xPrintLocal=$.parseJSON(xPrintLocal);
		xArrayDatosPrint[0].ip_print=xPrintLocal.ip;
		xArrayDatosPrint[0].var_margen_iz=xPrintLocal.var_margen_iz;
		xArrayDatosPrint[0].var_size_font=xPrintLocal.var_size_font;
		xArrayDatosPrint[0].papel_size = xPrintLocal.papel_size;
		xArrayDatosPrint[0].num_copias = xPrintLocal.num_copias;
		// xArrayDatosPrint[0].copia_local = xPrintLocal.copia_local;
		xArrayDatosPrint[0].local = 1;
		xpasePrint=true;
	}else{
		for (var i = 0; i < xArrayImpresoras.length; i++) {
			if(xArrayImpresoras[i].idimpresora==xIpPrintDoc){
				xpasePrint=true;
				xIpPrintDoc=xArrayImpresoras[i].ip; 
				xArrayDatosPrint[0].ip_print=xIpPrintDoc;
				xArrayDatosPrint[0].var_margen_iz=xArrayImpresoras[i].var_margen_iz;
				xArrayDatosPrint[0].var_size_font=xArrayImpresoras[i].var_size_font;
				xArrayDatosPrint[0].papel_size = xArrayImpresoras[i].papel_size;
				xArrayDatosPrint[0].num_copias = xArrayImpresoras[i].num_copias;
				xArrayDatosPrint[0].copia_local = xArrayImpresoras[i].copia_local;
				xArrayDatosPrint[0].local = 0;
				break;
			}
		}
	}
	if(xpasePrint==false){return false;}
	if(xArrayCuerpo.length==0){return false}

	// si formato corto para precuenta
	if (showFormatoCorto) {
		// formato de impresion items comprobante donde no se tiene en cuenta el tipo de consumo solo seccion e items
		xArrayCuerpo = xEstructuraItemsJsonComprobante(xArrayCuerpo, xArraySubTotales, false, true); // cpe = true subtotal + adicional
		xArrayCuerpo = xEstructuraItemsAgruparPrintJsonComprobante(xArrayCuerpo);

		console.log('xArrayCuerpo', xArrayCuerpo)
	}

	// xArmarSubtotalesArray(xArrayCuerpo,xArrayDatosPrint) // ya viene con la funciom
	//xArrayDatosPrint[0].ip_print=xIpPrintDoc;
	xImprimirAhora(xArrayEncabezado,xArrayDatosPrint,xArrayCuerpo,xArraySubTotales,function(rpt_print){
		if(rpt_print==false){return;}
		xPopupLoad.titulo="Imprimiendo...";
		xPopupLoad.xopen();
		setTimeout(function(){ xPopupLoad.xclose()}, 3000);
	});
}

function xMandarImprimir(xArrayEncabezado,xArrayDatosPrint,xArrayCuerpo,responde){
	var xArrayImpresoras;
	var xIdPrint=0;
	var xArrayBodyPrint=new Array();
	var xCuentaImpresorasEvaluadas=0;//cuenta las impresoras evaluadas
	var xcuentaSeccionesImpresas=0;//cuenta secciones impresas, sino imprime ninguna manda nuevo x ejemplo en helados.
	var xPrintLocal=window.localStorage.getItem("::app3_woIpPrintLo");
	xArrayImpresoras=xm_log_get('app3_woIpPrint'); //$.parseJSON(window.localStorage.getItem("::app3_woIpPrint"));

	//si existe impresora local // saca una copia de todo el pedido
	if(xPrintLocal!=undefined && xPrintLocal!=''){
		xPrintLocal=$.parseJSON(xPrintLocal);
		xArmarSubtotalesArray(xArrayCuerpo,xArrayDatosPrint)
		xArrayDatosPrint[0].ip_print=xPrintLocal.ip;
		xArrayDatosPrint[0].var_margen_iz=xPrintLocal.var_margen_iz;
		xArrayDatosPrint[0].var_size_font=xPrintLocal.var_size_font;
		xArrayDatosPrint[0].local = 1;

		xImprimirAhora(xArrayEncabezado,xArrayDatosPrint,xArrayCuerpo,xLocal_xDtSubTotales,function(rpt_print){
			if(rpt_print==false){return;}
			xPopupLoad.titulo="Imprimiendo...";
			xPopupLoad.xopen();
			setTimeout(function(){ xPopupLoad.xclose()}, 3000);
		});
	}

	//evalua impresoras y secciones, despachos o areas, la seccion en que impresora se imprime
	for (var z = 0; z < xArrayImpresoras.length; z++) {
		xIdPrint=xArrayImpresoras[z].idimpresora;
		xArrayBodyPrint=new Array();
		xCuentaImpresorasEvaluadas++;
		for (var i = 0; i < xArrayCuerpo.length; i++) {
			//xCuentaItemsEvaluados++;
			if(xArrayCuerpo[i]==null){continue;}
			$.map(xArrayCuerpo[i], function(xn_p, z) {
				if (typeof xn_p=="object"){
					if(xIdPrint==xn_p.idimpresora){
						//if(xArrayBodyPrint.length==0){
						if(xArrayBodyPrint[i]===undefined){
							xArrayBodyPrint[i]={'des':xArrayCuerpo[i].des, 'id':xArrayCuerpo[i].id, 'titlo':xArrayCuerpo[i].titulo};
						}
						//try {xArrayBodyPrint[i][xn_p.iditem]=xn_p;}
						//catch(err) {console.log(err);}
						xArrayBodyPrint[i][xn_p.iditem]=xn_p;
					}
				}
			})
		}
		if(xArrayBodyPrint.length==0){continue}
		xcuentaSeccionesImpresas++;
		xArmarSubtotalesArray(xArrayBodyPrint,xArrayDatosPrint)
		//xArrayDatosPrint[0].ip_print='192.168.1.80';
		xArrayDatosPrint[0].ip_print=xArrayImpresoras[z].ip;
		xArrayDatosPrint[0].var_margen_iz=xArrayImpresoras[z].var_margen_iz;
		xArrayDatosPrint[0].var_size_font=xArrayImpresoras[z].var_size_font;
		xArrayDatosPrint[0].local = 0;
		xImprimirAhora(xArrayEncabezado,xArrayDatosPrint,xArrayBodyPrint,xLocal_xDtSubTotales,function(rpt_print){
			if(xArrayImpresoras.length==xCuentaImpresorasEvaluadas && rpt_print==false){//si todas las impresoras fueron evaluadas y no presentaron error termina la funcion
				setTimeout( function(){try{xNuevoPedidoMP();}catch(err){return false;}}, 2700); //nuevo pedido en mipedido
				if(responde){responde(true)};
			}
			else{if(responde){responde(false);}}
		});
	};

	if(xcuentaSeccionesImpresas==0){if(responde){responde(true)};}
}

// xArrayEncabezado ==> encabezados( mesa | num_pedido | correlativo_dia | reservado | solo_llevar | precuenta )
// xArrayDatosPrint ==> datos de impresora e impresion ( logo | ip_print | num_copias | pie_pagina | totales[{igv , 18}])
// xArrayCuerpo ==> datos del pedido ( categoria | secciones | items  )
// xArraySubtotal ==> todos los subtotales asignados | totales[{igv , 18}]
function xImprimirAhora(xArrayEncabezado,xArrayDatosPrint,xArrayCuerpo,xArraySubtotal,responde){
	//cuando se agrega item
	//xArrayEncabezado.solo_llevar=0;
	//xArrayEncabezado.reservar=0;
	xPopupLoad.titulo="Imprimiendo...";

	const _sys_local = parseInt(xm_log_get('datos_org_sede')[0].sys_local);
	xArrayEncabezado.nom_us = xm_log_get('app3_us').nomus;

	const _data = {
		Array_enca: xArrayEncabezado,
		Array_print: xArrayDatosPrint,
		ArrayItem: xArrayCuerpo,
		ArraySubTotales: xArraySubtotal
	}

	if (_sys_local === 1) {
			xPopupLoad.xopen();
			xSendDataPrintServer(_data, 1, 'pre cuenta');
			setTimeout(() => {
				xPopupLoad.xclose();
				return responde(false);
			}, 1000);
			return;
	}

	$.ajax({type: 'POST', url: '../../print/print3.php', 
	data:{
		Array_enca:xArrayEncabezado, 
		Array_print:xArrayDatosPrint, 
		ArrayItem:xArrayCuerpo, 
		ArraySubTotales:xArraySubtotal
	}})
	.done( function (dtPbd) {
		//xPopupLoad.xclose();
		if(dtPbd.indexOf('Error')!=-1){
			xPopupLoad.xclose();
			$("#print_error").text(dtPbd);
			xErrorPrint=true;
			dialog_erro_print.open();
		}else{
			//xPopupLoad.titulo='Exito!';
			xErrorPrint=false;
			xPopupLoad.titulo="Imprimiendo...";
			xPopupLoad.xopen();
			setTimeout(function(){ xPopupLoad.xclose()}, 3000);
			//setTimeout( function(){ xNuevoPedido(); }, 600);
			//xNuevoPedido()
			//setTimeout( function(){ xNuevoPedido(); }, 1500);

		}
		return responde(xErrorPrint);
	});
}


function xBuscarCantidadPorSeccionArray(idtpc_ad,idseccion_ad,xArraySumT){
	var xcant_sec_ad=0;
	if(xArraySumT[idtpc_ad]==undefined){return xcant_sec_ad;}
	$.map(xArraySumT[idtpc_ad], function(n,z){
 		if (typeof n=="object" && n!=null){
 			if(n.idseccion == idseccion_ad){
 				xcant_sec_ad=parseFloat(xcant_sec_ad)+parseFloat(n.cantidad);
 			}
 		}
 	});
 	return xcant_sec_ad;
}


function xCargarCategoriaActual(responde){
	//$(".xMenu_body #xContenedoPaginas").html('<div class="xCentradoVerticalHorizontal spinner"><paper-spinner active></paper-spinner></div>').trigger('create');
	var xCategoriaActual;
	//$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=302'})
	//.done( function (dtCat) {
		var xdtCat=xm_log_get('categorias'); //$.parseJSON(dtCat);
		var xCadenaCartegoria='';

		for (var i = 0; i < xdtCat.length; i++) {
			xMenuCategoria={'id':xdtCat[i].idcategoria, 'des':xdtCat[i].descripcion};
		}
		//window.localStorage.setItem("::app3_sys_dt_mlc",JSON.stringify(xMenuCategoria));
		if(xdtCat.length==1){xCategoriaActual=xdtCat[0].idcategoria}
		return responde(xdtCat);
	//})
}


//load general para item del la carta
// carta lista y boodega
//para venta_rapida y mipedido se actualiza cada nuevo pedido o cada 60segundos de inactividad
//para control_pedido cada que lo solicite
// xidCategoria  obligatorio en venta rapida y control de pedidos 
function xGeneralLoadItems(xidCategoria, x_rpt){
	// console.log('pasa cargando log.php205');
	// borrar localstorage subitems al volver cargar la carta
	localStorage.removeItem('::app3_listSubItem');

	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=205', data:{'idcategoria': xidCategoria}})
	.done( function (dtCarta) {
		var xdt_rpt=JSON.parse(dtCarta)
		// if(!xdt_rpt.success){alert(xdt_rpt.error); return x_rpt(false);}
		xGeneralDataCarta=xdt_rpt.datos;
		// console.log('xGeneralDataCarta', xGeneralDataCarta);
		if(x_rpt){return x_rpt(xGeneralDataCarta);}
	})
}

async function xGeneralLoadItemsAddItem(xidCategoria){
	// console.log('pasa cargando log.php205');
	// borrar localstorage subitems al volver cargar la carta
	localStorage.removeItem('::app3_listSubItem');

	const result = await $.ajax({ 
		type: 'POST',
		url: '../../bdphp/log.php?op=205',
		data:{'idcategoria': xidCategoria}});

	// .done( function (dtCarta) {
	// 	var xdt_rpt=JSON.parse(dtCarta)
	// 	// if(!xdt_rpt.success){alert(xdt_rpt.error); return x_rpt(false);}
	// 	xGeneralDataCarta=xdt_rpt.datos;
	// 	// console.log('xGeneralDataCarta', xGeneralDataCarta);
	// 	if(x_rpt){return x_rpt(xGeneralDataCarta);}
	// })

	var xdt_rpt=JSON.parse(result)
	xGeneralDataCarta=xdt_rpt.datos;
	return xGeneralDataCarta;
}

// limpia los items que tienen subitems seleccionados
// para nuevo pedido
function xLimpiarItemSeleccionadosSubItems() {
	xGeneralDataCarta.filter(x => x.subitems_selected).map( x => {
		x.subitems_selected = [];
	});
}

function xLimpiarItemIndicaciones() {
	xGeneralDataCarta.filter(x => x.indicaciones).map( x => {
		x.indicaciones = '';
		x.xindicaciones = '';
	});
}

//mi pedido // solo secciones
function xGeneralSeccionMiPedido(xidCategoria, x_rpt){	
	const ultima_categoria_cargada = localStorage.getItem('::app3_sys_last_cat_load');
	if (ultima_categoria_cargada === xidCategoria && xGeneralDataSeccion !== undefined ) {return x_rpt(false); } //1118 //si ya esta cargado, pasa, tiene que actualizar manual // remplaza al de abajo
	// if(xGeneralDataSeccion!=undefined){if(x_rpt){return x_rpt(false);}else{return;}}//si ya esta cargado, pasa, tiene que actualizar manual
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=2041', data:{'idcategoria': xidCategoria}})
	.done( function (dtSecciones_mp) {
		var xdtSecciones_mp=JSON.parse(dtSecciones_mp)
		if(!xdtSecciones_mp.success){alert(xdtSecciones_mp.error); return;}
		xGeneralDataSeccion=xdtSecciones_mp.datos;

		localStorage.setItem('::app3_sys_last_cat_load', xidCategoria);

		if(x_rpt){return x_rpt(xGeneralDataSeccion);}
	})
}


//dispara evento de actualizacion aumento de registtro en pedidos ca,bio bd
function xDisparaEventoLoadItemCambioBd(){
	clearInterval(xGeneralRelojUpdateItemsCambioBd);
	xGeneralRelojUpdateItemsCambioBd=setInterval(function () {xGeneralActualizarLoadItemCambioBd()},20000);
}

function xGeneralActualizarLoadItemCambioBd(){
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=3012'})
	.done( function (xCantPedidos) {
		xNumPedidosBD=xCantPedidos;
		if(xGeneralNumPedidosActual!=xNumPedidosBD){
			xGeneralNumPedidosActual=1
			xGeneralLoadItems();
		}
	})
}

//dispara evento por inactividad
function xDisparaEventoLoadItemInactividad(){
	clearInterval(xGeneralRelojUpdateItemsSolo);
	xGeneralRelojUpdateItemsSolo=setInterval(function () {xGeneralActualizaItemInactividad()},110000);
}
//para venta_rapida y mipedido se actualiza cada nuevo pedido o cada 60segundos de inactividad
function xGeneralActualizaItemInactividad(){
	var xpaseRefreshItem=true;
	if(xArrayPedidoObj!=undefined){
		for (var y = 0; y < xArrayPedidoObj.length; y++) {
			if(xArrayPedidoObj[y]==null){continue;}
			$.map(xArrayPedidoObj[y], function(n, z) {
				if (typeof n=="object"){
					xpaseRefreshItem=false;
				}
			})
			if(!xpaseRefreshItem){break;}
		}
	}

	if(xpaseRefreshItem){
		if(xDisparaUpdateItems.cancelBubble==true){xDisparaUpdateItems=new Event('GeneralUpdateItemsSolo');}
		document.dispatchEvent(xDisparaUpdateItems);
	}
}

// 'precio_total_calc': para calcular en regalas de carta
function xGeneralValidarRegalasCarta(xObjEvaluar,esarray){
	// if ( xObjEvaluar === null ) {xLoadArrayPedidoAquiMenuJS();}; // viene de cargar x-mipedido en primera pantalla - donde no hay objeto a evaluar
	var xArrayRegla=xm_log_get('reglas_de_carta'); //$.parseJSON(window.localStorage.getItem("::app3_sys_dta_rec"));
	var xSecc_bus='';
	var xSecc_detalle;
	var xCantidadBuscar=0;
	xVerificarImprimirComanda=false;

	//resete a precio_print all
	if(xArrayPedidoObj!=undefined){
		for (var y = 0; y < xArrayPedidoObj.length; y++) {
			if(xArrayPedidoObj[y]==null){continue;}
			$.map(xArrayPedidoObj[y], function(n, z) {
				if (typeof n=="object"){
					n.precio_print='';
					n.precio_total_calc = n.precio_total; // para calcular las reglas de la carta cuando es array reseteamos precio_total_calc
					// n.precio_total = n.precio * n.cantidad;
					// n.precio = xMoneda(n.precio_total);
				}
			})
		}
	}

	//xVerificarImprimirComanda=false;
	if( !esarray ) {//establa
		var xtb=$(xObjEvaluar);
		for (var i = 0; i < xArrayRegla.length; i++) {
		//if(xSecc_bus!=xArrayRegla[i].idseccion){
			xSecc_bus=xArrayRegla[i].idseccion;
			xSecc_detalle=xArrayRegla[i].idseccion_detalle;
			//buscar
			xCantidadBuscar=xObtnerValSumTable($(xtb),'data-idbus',xSecc_bus,'#cant_descontar');

			if (xCantidadBuscar === 0 ) continue; // no hay nada que buscar

			xCantidadBuscarSecc_detalle=xObtnerValSumTable($(xtb),'data-idbus',xSecc_detalle,'#cant_descontar');

			var diferencia = xCantidadBuscar - xCantidadBuscarSecc_detalle;			
			diferencia = diferencia < 0 ? xCantidadBuscar : diferencia; // no valores negativos 
			
			$(xtb).find(".row").each(function (index, element) {
				// if(xCantidadBuscar <= 0) {return;} // lo dejamos pasar si es cero para que coloque el precio normal a todos los items de lo contrario dejaria con precios del caso anterior
				var xIdRowTb = $(element).attr('data-idbus'),
				xIdtb_Item = $(element).attr('data-id'),
				xIdtb_tpc = $(element).attr('data-idtipocobus'),
				xPrecio_mostrado = parseFloat($(element).find('#ptotal').text()),
				xPrecio_item_bus = xMoneda(xPrecio_mostrado);

				if (xPrecio_mostrado === 0) return; // si es 0 quiere decir que ya fue descontado, continua con el siguiente

				// xPrecio_item_bus = xMoneda(xPrecio_item_bus);
				// xCant_item_bus,
				// xPreciott_item_bus=$(element).find('#ptotal').text();

				if (xIdRowTb === xSecc_detalle) {

					const cant_item = parseInt($(element).find('#cant_descontar').text());

					if ( xCantidadBuscar >= xCantidadBuscarSecc_detalle) {
						xPrecio_item_bus='0.00';
					} else if ( diferencia > 0 ){
						// const cant_item = parseInt($(element).find('#cant_descontar').text());
						const precioUnitario_item=parseFloat($(element).find('#punitario').text());

						// xPrecio_item_bus = parseFloat(parseFloat(cant_item * precioUnitario_item)-(diferencia * precioUnitario_item));
						xPrecio_item_bus = parseFloat(parseFloat(diferencia * precioUnitario_item));
						xPrecio_item_bus = xPrecio_mostrado - xPrecio_item_bus; // descuenta del precio que se muestra en pantalla( precio que ya fue procesado)
						xPrecio_item_bus = xPrecio_item_bus < 0 ? '0.00' : xMoneda(xPrecio_item_bus);
						
						diferencia = diferencia - cant_item < 0 ? 0 : diferencia - cant_item;													
					}

					$(element).find('#ptotal').text(xPrecio_item_bus);
					// $(element).attr('cant_descontado',xCant_item_bus)
					$(element).attr('cant_descontado', cant_item);

					//coloca en array precio a imprimir
					//xDtPedido[xIdtb_tpc][xIdtb_Item].precio_print=xPrecio_item_bus;
					xArrayPedidoObj[xIdtb_tpc][xIdtb_Item].precio_print=xPrecio_item_bus;					

				}
			})		
		}
	}
	else{//es array
		var xSqlTbSave='';
		var xArrayEv=xObjEvaluar;
		for (xi in xArrayRegla) {
			//if(xSecc_bus!=xArrayRegla[i].idseccion){
				xSecc_bus=xArrayRegla[xi].idseccion;
				xSecc_detalle=xArrayRegla[xi].idseccion_detalle;
				//buscar
				xCantidadBuscar=xObtnerValSumArray(xArrayEv,xSecc_bus);
				xCantidadBuscarSecc_detalle=xObtnerValSumArray(xArrayEv,xSecc_detalle);

				var diferencia = xCantidadBuscar - xCantidadBuscarSecc_detalle;			
				diferencia = diferencia < 0 ? xCantidadBuscar : diferencia; // no valores negativos 

				for (var y = 0; y < xArrayEv.length; y++) {
					if(xArrayEv[y] == null){continue;}
					if(xCantidadBuscar <= 0){break;}
					$.map(xArrayEv[y], function(n, z) {
						if (typeof n ==="object"){
							var xIdRowTb=n.idseccion;
							var xIdtb_Item=n.iditem;
							var xIdtb_tpc=n.idtipo_consumo;
							var xPrecio_mostrado = parseFloat(n.precio_total_calc);
							var xPrecio_item_bus = xMoneda(xPrecio_mostrado);

							if (xPrecio_mostrado === 0) return; // si es 0 quiere decir que ya fue descontado, continua con el siguiente
							
							if(xIdRowTb === xSecc_detalle){

								const cant_item = n.cantidad;
								if ( xCantidadBuscar >= xCantidadBuscarSecc_detalle) {
									xPrecio_item_bus='0.00';
								} else if ( diferencia > 0 ){
									// const cant_item = n.cantidad;
									const precioUnitario_item=n.precio;
									
									// xPrecio_item_bus=parseFloat(parseFloat(cant_item * precioUnitario_item)-(diferencia * precioUnitario_item));
									xPrecio_item_bus = parseFloat(parseFloat(diferencia * precioUnitario_item));
									xPrecio_item_bus = xPrecio_mostrado - xPrecio_item_bus; // descuenta del precio que se muestra en pantalla( precio que ya fue procesado)
									xPrecio_item_bus = xPrecio_item_bus < 0 ? '0.00' : xMoneda(xPrecio_item_bus);
									
									diferencia = diferencia - cant_item < 0 ? 0 : diferencia - cant_item;						
								}

								
								// n.precio_total = xPrecio_item_bus; // es el que se muestra para calcular la regla de carta
								n.precio_total_calc = xPrecio_item_bus; //
								n.precio_print = xPrecio_item_bus; //
								n.cant_descontado = cant_item;

								///coloca en array precio a imprimir
								xArrayEv[xIdtb_tpc][xIdtb_Item].precio_print=xPrecio_item_bus;
								xArrayPedidoObj[xIdtb_tpc][xIdtb_Item].precio_print=xPrecio_item_bus;

							}
						}
					});
				}
		};

		return xArrayEv;
	}
	//xGeneralSumarTotales();
}

// se utliza mayormente para cuande se hace nuevo pedido
// devuelve los subtotates desde
// xArraySum => estructura de impresion {tipo consumo > seccion > items}
function xGeneralSumarTotales(xArraySum){
	var xArrayFucRpt=new Array();// array de respuesta
	var xGeSumTotal=0;
	var xprecio_item_sum=0;
	// estructura de pedido si null toma xArrayPedidoObj=el array en storage del ultimo pedido que se esta trabajando. 
	if(xArraySum==null){xArraySum=xArrayPedidoObj}

	// sub total del pedido
	for (var a = 0; a < xArraySum.length; a++) {
		if(xArraySum[a]==null){continue;}
		$.map(xArraySum[a], function(n, z) {
			if (typeof n=="object"){
				//total del pedido
				if(n.precio_print==""){xprecio_item_sum=n.precio_total}else{xprecio_item_sum=n.precio_print;}
				xGeSumTotal=parseFloat(xGeSumTotal)+parseFloat(xprecio_item_sum);
				///
			}
		})
	}

	//sub totales / igv / servicio / adicionales/ etc
	// xDtPrint=> datos de impresion = impresora, ip, slogan etc
	var xDtPrint=xm_log_get('sede_generales'); //$.parseJSON(window.localStorage.getItem("::app3_sys_dta_prt"));
	var xdes_sb='';
 	var xporcentaje_sb;
 	var xCadenta_tt='';
 	var xCadena_tt_ad='';
 	var xtt_adicional=0;
 	var xid_tp_consumo_ad;
 	var xid_ad_seccion;

	xGeneralArraySubTotales=new Array();
	xGeneralArraySubTotales.push({'descripcion':'Sub Total', 'importe':xMoneda(xGeSumTotal), 'visible':true});

	for (var i = 0; i < xDtPrint.length; i++) {
		xdes_sb=xDtPrint[i].des_detalle;
	 	if(xdes_sb!=''){
			xporcentaje_sb=parseFloat(parseFloat(xDtPrint[i].porcentaje)/100).toFixed(2);
	 		xporcentaje_sb=parseFloat(parseFloat(xGeSumTotal)*parseFloat(xporcentaje_sb)).toFixed(2);
			xCadenta_tt=String(xCadenta_tt+'<tr class="row"><td data-ColumName="descripcion" class="xPedidoSubTotal">'+xdes_sb+'</td><td data-ColumName="importe" align="right">'+xporcentaje_sb+'</td><td class="xInvisible" data-ColumName="estado">0</td><td class="xInvisible" data-ColumName="idpedido">?p</td></tr>');

			xGeneralArraySubTotales.push({'descripcion':xMayusculaPrimera(xdes_sb.toLowerCase()), 'importe':xMoneda(xporcentaje_sb), 'visible':true});
	 		xGeSumTotal=parseFloat(xGeSumTotal)+parseFloat(xporcentaje_sb);
	 	}

 		//adicionales van con seccion ejemplo taper van con seccion para llevar
 		xid_tp_consumo_ad=xDtPrint[i].ad_idtp_consumo;

 		if(xid_tp_consumo_ad!=''){
 			xid_ad_seccion=xDtPrint[i].ad_idseccion;
 			xid_ad_seccion=xid_ad_seccion.split(',');

 			var xCant_item_sec=0;//=xArrayPedidoObj[xid_tp_consumo_ad].cantidad;
 			var u_id_ad_seccion;
 			for (var q = 0; q < xid_ad_seccion.length; q++){
 				u_id_ad_seccion=xid_ad_seccion[q];
 				xCant_item_sec=parseFloat(xCant_item_sec)+xBuscarCantidadPorSeccion(xid_tp_consumo_ad,u_id_ad_seccion);
 			};

 			if(xCant_item_sec==0){continue;}
 			xtt_adicional=parseInt(xtt_adicional)+(parseFloat(xCant_item_sec)*parseFloat(xDtPrint[i].ad_importe));
 			xtt_adicional=xMoneda(xtt_adicional);
 			xCadena_tt_ad=String(xCadena_tt_ad+'<tr class="row"><td><div class="xPedidoSubTotal" data-iddes="'+xGeneralArraySubTotales.length+'" data-importe="'+xtt_adicional+'"><paper-checkbox class="noselect" onchange="xNoCobrarSubTotal(this);" checked title="no cobrar" id="check'+xDtPrint[i].ad_descripcion+'">'+xDtPrint[i].ad_descripcion+'</paper-checkbox></div></td><td class="xInvisible" data-ColumName="descripcion">'+xDtPrint[i].ad_descripcion+'</td><td data-ColumName="importe" align="right">'+xtt_adicional+'</td><td class="xInvisible" data-ColumName="estado" id="td_estado_subt">0</td></tr>');
 			xGeneralArraySubTotales.push({'descripcion':xMayusculaPrimera(xDtPrint[i].ad_descripcion.toLowerCase()), 'importe':xtt_adicional, 'visible':true});

 			xGeSumTotal=parseFloat(xGeSumTotal)+parseFloat(xtt_adicional);
 		}
	}

	if(xGeneralArraySubTotales.length==1){xGeneralArraySubTotales=new Array()}
 	xGeneralArraySubTotales.push({'descripcion':'Total', 'importe':xMoneda(xGeSumTotal), 'visible':true});
 	xCadenta_tt=xCadenta_tt+xCadena_tt_ad+'<tr class="row xBold"><td class="xInvisible" data-ColumName="descripcion">TOTAL</td><td class="xInvisible" data-ColumName="importe" id="td_total_subt_2">'+xMoneda(xGeSumTotal)+'</td><td colspan="2" align="right" class="xPedidoTotal xSinBorde"><h3 class="xBold" id="td_total_subt">'+xMoneda(xGeSumTotal)+'</h3></td><td class="xInvisible" data-ColumName="estado">0</td></tr>';

 	xArrayFucRpt.push({'ImporteTotal':xGeSumTotal,'CadenaRow':xCadenta_tt});
 	//callback(xArrayFucRpt);
 	return xArrayFucRpt;
 	//$("#xtb_pedido_subtotales").html(xCadenta_tt).trigger('create');
}

//para mostrar cuenta en mipedido, imprimir precuenta o comprobante
//se hace de esta forma porque puede que no cobre taper o adicionales check
function xGeneralArmarSubTotalesBD(xnummesa_bus,responde){
	var xcadena_tt='';
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=2052',data:{m:xnummesa_bus}})
	.done( function (dtsub) {
		var xdtSub=$.parseJSON(dtsub);
		if(!xdtSub.success){alert(xdtSub.error); return;}
		xdtSub=xdtSub.datos;

		var count_row=xdtSub.length;
		var xtotal_sub_res=0;
		var xtotal_sub=0;
		xGeneralArraySubTotales=new Array()
		for (var i = 0; i < xdtSub.length; i++) {
			if(i==0){xtotal_sub=xdtSub[i].importe;xtotal_sub_res=xtotal_sub;}
			if(count_row>1 && i>0){//subtotal
				xtotal_sub_res=xtotal_sub_res-xdtSub[i].importe;
				xGeneralArraySubTotales[i]={'descripcion':xdtSub[i].descripcion, 'importe':xMoneda(xdtSub[i].importe), 'visible':true};
			}
		}
		if(count_row>1){
			xGeneralArraySubTotales[0]={'descripcion':'Sub Total', 'importe':xMoneda(xtotal_sub_res), 'visible':true};
			xGeneralArraySubTotales[count_row]={'descripcion':'Total', 'importe':xMoneda(xtotal_sub), 'visible':true};
		}else{
			xGeneralArraySubTotales[0]={'descripcion':'Total', 'importe':xMoneda(xtotal_sub), 'visible':true};
		}

		for (var a = 0; a < xGeneralArraySubTotales.length-1; a++) {
			xcadena_tt=xcadena_tt+'<tr class="row"><td>'+xGeneralArraySubTotales[a].descripcion+'</td><td align="right">'+xGeneralArraySubTotales[a].importe+'</td></tr>';
		}
		xcadena_tt=xcadena_tt+'<tr class="row xBold"><td></td><td align="right"><h3 class="xBold">'+xMoneda(xtotal_sub)+'</h3></td></tr>';

		if(responde){return responde(xcadena_tt);}
	})
}
//en array pedidos // para suma total
function xBuscarCantidadPorSeccion(idtpc_ad,idseccion_ad){
	var xcant_sec_ad=0;
	$.map(xArrayPedidoObj[idtpc_ad], function(n,z){
 		if (typeof n=="object" && n!=null){
 			if(n.idseccion == idseccion_ad){
 				xcant_sec_ad=parseFloat(xcant_sec_ad)+parseFloat(n.cantidad);
 			}
 		}
 	});
 	return xcant_sec_ad;
}

function xNoCobrarSubTotal(obj){
	var xid_ad_sec_restar=$(obj).parent().attr('data-iddes');
	var ximporte_ad_sec_restar=$(obj).parent().attr('data-importe');
	var ximpp_tt=$("#td_total_subt").text();
	var xestado_ad_item=0;
	xGeneralArraySubTotales[xid_ad_sec_restar].visible=obj.checked;
	if(obj.checked==false){xestado_ad_item=1;obj.title="cobrar"; $(obj).addClass('check_red');ximpp_tt=xMoneda(parseFloat(ximpp_tt)-parseFloat(ximporte_ad_sec_restar))}else{obj.title="no cobrar"; $(obj).removeClass('check_red');ximpp_tt=xMoneda(parseFloat(ximpp_tt)+parseFloat(ximporte_ad_sec_restar));}
	$(obj).parents('tr').find('#td_estado_subt').text(xestado_ad_item);
	$("#td_total_subt").text(ximpp_tt);
	$("#td_total_subt_2").text(ximpp_tt);
	xGeneralArraySubTotales[xGeneralArraySubTotales.length-1].importe=ximpp_tt;
}

//descuenta stock al vender o aumenta al anular o borrar
//op=operacion + o -
function xArmarArrayDescontarStock(obj_row,op){
	var xarray_rpt=new Array();// array respuesta
	var xrpt_row='';
	var xrpt_row_importe='';
	var xid_row_descontar=$(obj_row).attr('data-iddescontar');
	var x_row_tabla_procede=$(obj_row).attr('data-procede');
	var x_row_cant_descontar=$(obj_row).attr('data-cant_descontar');
	var x_row_cant=parseInt($(obj_row).find(".xcant_li").text());
	var x_row_cant_array=x_row_cant;


	if(isNaN(x_row_cant)){x_row_cant=parseFloat($(obj_row).find('#td_cant').text());}
	if(!isNaN(parseInt(x_row_tabla_procede))){x_row_tabla_procede=$(obj_row).attr('data-descontar');}
	if(op=='+'){x_row_cant=1}//borra item de uno en uno

	var x_id_p=$(obj_row).attr('data-idpedido');
	var x_id_pd=$(obj_row).attr('data-idpedidodetalle');
	var x_row_importe=parseFloat($(obj_row).attr('data-punitario'));


	x_row_cant_descontar=x_row_cant_descontar.split(',');
	xid_row_descontar=xid_row_descontar.split(',');

	//importe en caso de borrar item
	if(x_id_pd!=undefined){
		//x_row_cant_array--;
		//xArrayPedido[x_row_tpc][x_row_cl].cantidad=x_row_cant_array;
		//if(x_row_cant_array<=0){xArrayPedido[x_row_tpc][x_row_cl].visible=1}
		//x_row_tabla_procede=$(obj_row).attr('data-descontar');
		xsql1="update pedido_detalle set cantidad=cantidad-1, estado=if((cantidad)<=0,1,0), ptotal=format(ptotal-"+x_row_importe+",2) where idpedido_detalle="+x_id_pd+"; \r";
		xsql2="update pedido set total=format(total-"+x_row_importe+",2),estado=if((total)<=0,3,0) where idpedido="+x_id_p+"; \r update pedido_subtotales set importe=format(importe-"+x_row_importe+",2) where idpedido="+x_id_p+" and descripcion='TOTAL'; \r";
		xrpt_row_importe=String(xsql1+' '+xsql2)

	}
	//stock descuento o aumento
	for(xi in xid_row_descontar){
		xid_des=xid_row_descontar[xi];
		//if(x_row_tabla_procede!='porcion'){x_row_cant=1;x_row_cant_descontar[xi]=1;}// si se borra se borra de 1
		xcant_des=x_row_cant;
		if(x_row_tabla_procede=='porcion'){xcant_des=parseFloat(x_row_cant_descontar[xi])*parseFloat(x_row_cant);}// si se borra se borra de 1

		//xcant_des=parseFloat(x_row_cant_descontar[xi])*parseFloat(x_row_cant);

		xcampo_procede="stock=stock"+op+xcant_des;
		if(x_row_tabla_procede=='carta_lista'){xcampo_procede="cantidad=if(cantidad='ND','ND',cantidad"+op+xcant_des+")"}
		xrpt_row=xrpt_row+" update "+x_row_tabla_procede+" set "+xcampo_procede+" where id"+x_row_tabla_procede+"="+xid_des+";\r";
	}


	xarray_rpt.push({'stock':xrpt_row,'importe':xrpt_row_importe})
	return xarray_rpt;
}

//el detalle de los item en mipedido
function xArmarTipoConsumo(isVentaRapida = 0){	
	var xcadenaTC='';
	xArrayDesTipoConsumo=JSON.parse(window.localStorage.getItem("::app3_sys_dta_pe"));
	for(a in xArrayDesTipoConsumo){
		if(xArrayDesTipoConsumo[a]==null){continue;}
		xcadenaTC=String(xcadenaTC+'<div class="xpedir_row" data-ventarapida="'+ isVentaRapida +'" data-id="'+xArrayDesTipoConsumo[a].id+'">'+
							'<p>'+xArrayDesTipoConsumo[a].des+'</p>'+
							'<p class="xCant_item"></p>'+
							'<div class="xBtnIz xBtn">-</div>'+
							'<div class="xBtnDe xBtn">+</div>'+
						'</div>');
	}
	xcadenaTC='<div class="xpedir_item">'+xcadenaTC+'</div>';
	return xcadenaTC;
}

// verifica stock de los items si el stock es menor o igual a 5
async function xVerificarStockItemPedidoBefore() {
	var _rpt = false;
	var _rptList = [];
	const _arrItems = xEstructuraItemsJsonComprobante(xArrayPedidoObj, [])
										.filter(x => x.stock_actual != 'ND')
										.filter(x => parseInt(x.stock_actual) <= 5);
										
	const _arrItemsCartaLista = _arrItems.filter(x => parseInt(x.procede) === 1).map(x => x.id).join(',');
	const _arrItemsProducto = _arrItems.filter(x => parseInt(x.procede) === 0 ).map(x => x.id).join(',');

	if (_arrItemsCartaLista.length === 0 && _arrItemsProducto.length === 0) return _rpt=true;
	await $.ajax({
			type: "POST",
			url: "../../bdphp/log.php?op=3031",
			data: {i: _arrItemsCartaLista,p: _arrItemsProducto}
	})
	.done(function (res) {
		let _res = $.parseJSON(res);
		_res = _res.datos;
		
		// comparar el stock con la lista _arrItems
		_res.map(x => {
			const idFilter = x.idcarta_lista;
			_item = _arrItems.filter(i => i.id === idFilter).map(i => i);
			if (parseFloat(_item[0].stock_actual) > parseFloat(x.cantidad)) {
				// lista a mostrar
				_item[0].stock_actual = parseFloat(x.cantidad);
				_rptList.push(_item[0]);
				// console.log('item', _item[0].des);
			}
		});
	});
	
	return _rptList;
}

function xUpdateItemNoStock(op, items) {
	$.ajax({
		type: "POST",
		url: "../../bdphp/log.php?op=2301",
		data: {p_from: op, i: items}})
		.done(x => {
			console.log(x);
		})
}
