

var xIdOrg,xIdSede,xNomU,xNomUsario,xIdUsuario,xCargoU,xPopupLoad,xIdROw,xTableRow,xRowObj,xselectIdSedeGeneral=0,xdialogus;
var xMenuOp = '', xAcc, xIdAccDirecto, verCambioClave = false;
var xparam_time_ruter = false;
var componentsLoadPanel = false, dialogListNotification, ipPrintServerLocal = '';

// alert('aaa')

// var s = document.createElement('script');
// 	s.src = "../web_components/webcomponentsjs/webcomponents-lite.min.js",
// 	document.head.appendChild(s);

if ('registerElement' in document && 'import' in document.createElement('link')) {
	// no polyfills needed
	console.log('no polyfills needed');
  } else {
	console.log('si necestia polyfills');	
  }


window.addEventListener('WebComponentsReady', function (e) {	
	
	console.log('WebComponentsReady');
	$("#PanelDe").on("transitionend", function(a) {
		if (this.selected == "main") {
		  $("#PanelDe").css("z-index", "0");
		}
	  });
	
	// $('body').addClass('loaded');
	this.componentsLoadPanel = true;
	// setTimeout(() => {
		console.log('cargado en 4s - desde WebComponentsReady');	
		xIniDocument();
	// }, 3000);
});

window.onload = () => {	

	  setTimeout(() => {
		if ( this.componentsLoadPanel ) {return; }

		$("#PanelDe").on("transitionend", function(a) {
			if (this.selected == "main") {
			  $("#PanelDe").css("z-index", "0");
			}
		  });
		
		console.log('cargado en 4s - desde ready');	
		xIniDocument();
	}, 4000);
};



window.addEventListener("error", function (e) {
	console.log(e.error.message, "from", e.error.stack);
	// alert(e.error);
	// You can send data to your server
	// sendError(data);
});

// xxx();
// document.addEventListener("WebComponentsReady", function componentsReady() {
// 	$("#PanelDe").on("transitionend", function (a) {
// 		if (this.selected == "main") {
// 			$("#PanelDe").css("z-index", "0");
// 		}
// 	});
// 	xIniDocument();
// });

//window.onload = function(){xIniDocument();}
// window.addEventListener('WebComponentsReady', function(e) {
// 	xIniDocument();
// });
//window.onload = function(){$("#nom_sede").text('SAN CARLOS'); setTimeout( function(){ xIniDocument(); }, 1600); };
function xIniDocument(){
	// router = document.querySelector("app-router");

	//session activa
	xVerificarSession();
	// setInterval(function(){ xVerificarSession(); }, 1080000);
	//setInterval(function(){ xVerificarSession(); }, 5000);

 	xPopupLoad=document.getElementById('xLoad');
	 xdialogus = document.getElementById('dialog_us');

	 var xComptitulo_bar = document.getElementById('xtitulo_bar');
	 
	 dialogListNotification = document.getElementById('dialogListNotification');

	 dialogListNotification.addEventListener('xShowNotifications', (res) => {
		 console.log('recibi alerta de notifiacion desde el panel');
	 });

 	//xVerificarSession();
 	//xSoloAccPedido();

 	//xLoadRegla();//>>xm_log_get
	//xLoadDtPrint();//>>xm_log_get
	//xLoadOtherDatosSede();//>>xm_log_get

	//xLoadSetDatosSession(function(acc){//>>xm_log_get
	xm_LogChequea(function(){
 		//cagar opciones segun acc
 		//xGenerarMenu(acc);
		xm_log_get('ini_us');
		xLoadImpresoras();
		xDatosUs();
		xNewUs(); // verifica si es usuario nuevo
		// if (!xNewUs()) { 
		// 	if(xUsAc_Ini=='A2,'){window.localStorage.setItem('::app3_woUOn',1); xOpenPage(3);}else{xOpenPage(1);}
		// } 
		
		//si solo realizar pedido		
		// xm_all_xToastOpen("Enviando comprobantes...", 20000);

		//xSoloAccPedido();
 		/*debugger
 		xIdAccDirecto=getUrlParameter('dir','?');
		 if(xIdAccDirecto=='' || xIdAccDirecto===undefined){xOpenPage(1);}else{xOpenNewWindow();} */
		ipPrintServerLocal = xm_log_get('datos_org_sede')[0].ip_server_local;
		localStorage.setItem('::app3_sys_last_s', btoa(xm_log_get('datos_org_sede')[0].idsede));

		 xComptitulo_bar.init();
 	});

 	//xRefreshNotificaciones=setInterval(function () {xNotificaciones()},10000);
	/*$('#xMainContent1').perfectScrollbar();
	$('#xMainContent2').perfectScrollbar();		*/
 }

 function showNotificationList() {
	var pAudioNotificaAlert=document.getElementById('alertaNotificaciones');
	pAudioNotificaAlert.autobuffer = true;
	pAudioNotificaAlert.muted = false;
	pAudioNotificaAlert.load();
	pAudioNotificaAlert.play();
	
	

	dialogListNotification.xopen();
 }

/*function xOpenNewWindow(){
	//venta rapida
	document.querySelector('app-router').go(xIdAccDirecto);
	xScrolUp(0);
	PanelDe.closeDrawer();
}*/

//function xSoloAccPedido(){
	//router=document.querySelector('app-router');
	//xLoadSetDatosSession(function(acc){
		//if(xUsAc_Ini=='A2,'){window.localStorage.setItem('::app3_woUOn',1); xOpenPage(3);}
	//})
//}
window.onhashchange = function () {
	xLiberarRouter();
}

function xLiberarRouter() {
	// libera router
	setLocalSotrage('::app3_sys_route', 0);
	xparam_time_ruter = false;
	console.log('time router ', 0);
}

function xOneOptionPage(_codOne) {
	xLiberarRouter();
	xOpenPage(_codOne);
}

var aapasa=0;
async function xOpenPage(xop, parametro){	
	// var _route_count = getLocalStorage('::app3_sys_route') || 0;
	// console.log('open ' + xop);
	// console.log('app3_sys_route ' + _route_count);
	
	// if (parseInt(_route_count) === 1) {	
	// 	if (xparam_time_ruter) return
	// 	xparam_time_ruter = true;
	// 	setTimeout(() => {
	// 		xLiberarRouter();
	// 	}, 500);		
	// 	return;
	// }

	// setLocalSotrage('::app3_sys_route', 1);
	// console.log('aa');
	xPopupLoad.xopen();
	xPopupLoad.titulo = "Abriendo ...";
	await xDelayHere(100);
	// console.log('b');
	aapasa++;

	setTimeout(() => {
		xPopupLoad.xclose();
		xPopupLoad.titulo = "Guardando ...";
	}, 500);

	console.log('paso el router ', aapasa);
	xop = parseInt(xop);
	if(parametro==null){parametro='';}
	var xruta='';
	switch(xop){
		case 1:	xruta='/home';break;
		case 2:	xruta='/elaborar_carta';break;
		case 3:	

			if ( parseInt(xm_log_get('datos_org_sede')[0].pwa) === 1  ) { // si socket
				window.localStorage.removeItem("::app3_sys_first_load");
				document.location.href='https://app.restobar.papaya.com.pe';
				xLiberarRouter();
				return;
			} else {
				window.localStorage.removeItem("::app3_sys_first_load");
				document.location.href='m_menu.html';
				xLiberarRouter();
				return;
			}
			break;
		//case 4:	xruta='/menu'; break;
		//case 4:	xruta='/reglas';break;
		//case 5:	xruta='/datos_print';break;
		case 6:	xruta='/usuarios';break;
		case 7:	xruta='/configuraciones';break;
		case 8:	xruta='/caja';break;
		//case 9:	xruta='/control_pedidos';break;
		case 9:	
			document.location.href='m_control_pedidos.html';
			// del componente categoria
			clearStorageVariablesComp();
			xLiberarRouter();
			return;break;
		case 10:xruta='/detalle_pedido';break;
		case 11:
			// window.localStorage.removeItem("::app3_sys_first_load");
			h = window.screen.availHeight-100;
			window.open('m_menu.html', "Carta", "width=400,height="+h);	
			xLiberarRouter();
			return;break;
		case 12:xruta='/compras';break;
		case 13:xruta='/distribuicion';break;
		case 14:xruta='/porcionar';break;
		case 15:xruta='/recetas';break;
		//case 16:xruta='/venta_rapida';break;
		case 16:
			//var myWindow = window.open('#/venta_rapida', "Venta rapida");return;
			if ( isSynOsWinOrMac() ) {
				window.open('#/venta_rapida', "Pundo de Venta");return;
			}else{
				xruta='/venta_rapida';
			}
			console.log(window.innerWidth);
			break;
		case 17:xruta='/producto_porcion';break;
		case 18:xruta='/ie_almacen';break;
		case 19:xruta='/monitor_pedidos';break;
		case 20:xruta='/historial_ventas';break;
		case 21:xruta='/inventario';break;
		case 22:xruta='/resumen_caja';break;
		case 23:xruta='/zona_despacho';break;
		case 24:xruta='/items_borrados';break;
		case 25: 
			// xruta = '/facturador'; 
			window.open('#/facturador', "Facturador");
			return;
			break;
		case 26: xruta = '/c_electronico'; break;
		case 28: xruta = '/adm_dashboard'; break;
		case 29: xruta = '/us_contador'; break;
		case 30: xruta = '/cuentas_p_c'; break;
		case 31: xruta = '/gastos_fijos'; break;
		case 32: xruta = '/gastos_variables'; break;
		case 33: xruta = '/otros_ingresos'; break;
		case 34: xruta = '/recursos_humanos'; break;
		case 35: xruta = '/clientes'; break;
		case 36: xruta = '/panel_contador'; break;
		case 37: 
			window.open('https://restobar.papaya.com.pe/analitica', "Analitica");			
			break;
		case 38: xruta = '/promociones'; break;
		case 39: xruta = '/encuesta'; break;
		case 40: // lanzar encuesta 			
			const dataE = {
				o: xIdOrg,
                s: xIdSede,
                r: true // repeat
			}
			// const _urlEncuesta = 'http://192.168.1.64/restobar-encuesta/?o=' + btoa(JSON.stringify(dataE));
			const _urlEncuesta = 'http://appx.papaya.com.pe/encuesta/?o=' + btoa(JSON.stringify(dataE));
			// window.open(_urlEncuesta, "_self");// produccion
			window.location.replace(_urlEncuesta);// produccion			
			return;			

			break;
		case 27:			
			const demo = window.location.href.indexOf('demo') > -1 ? 'd' : '';
			const _xdataOrg = {o: xIdOrg, s: xIdSede, d:demo}
			const _xr = btoa(JSON.stringify(_xdataOrg));
			// const versionPrintServer = 'print-server' // parseInt(xm_log_get('datos_org_sede')[0].pwa) === 0 ? 'print-server' : 'print-server-1.2';
			// const _urlPrintServver = 'http://'+ipPrintServerLocal+versionPrintServer+'/print-server.html?o='+_xr
			
			// local 10022022
			const versionPrintServer = 'restobar/print/client/index.html'; 
			const _urlPrintServver = 'http://'+ipPrintServerLocal+'/'+versionPrintServer+'?o='+_xr;			
			// window.open('http://192.168.1.64/restobar-print-server/print-server.html?o=' + _xr, "Servidor de Impresion"); // desarrollo
			window.open(_urlPrintServver, "Servidor de Impresion");// produccion			
			return; 		
		case 41: xruta = '/indicadores'; break;
		case 42: xruta = '/mozo_virtual'; break;
		case 43: xruta = '/pago_desde_app'; break;
		case 44: 
			const url_s = 'https://comercio.papaya.com.pe/'; 
			window.open(url_s, "Seguimiento de Delivery");// produccion
		break;
		case 45: xruta = '/orden_pedido'; break;
		case 46: xruta = '/indicadores2'; break;
		case 47: xruta = '/facturacion'; break;	
		case 48: xruta = '/produccion_producto'; break;	
		case 49: xruta = '/promociones'; break;
		case 50: xruta = '/solicitud_remoto'; break;
	}
	xruta=xruta+parametro;
	// alert('go '+ xruta);
	if (router == undefined) { router = document.querySelector('app-router'); }
	router.go(xruta);

	xScrolUp(0);

	
	//PanelDe.closeDrawer();
}

// se libera para tomar la ultima actulizacion
function clearStorageVariablesComp() {
	localStorage.removeItem('::app3_comp_cat'); // categorias
	localStorage.removeItem('::::app3_comp_tpp_all'); // tipos de pago
}

function xBtn_Regresar(){
	parent.history.back();
	xScrolUp(0);
}

function xScrolUp(xelement){
	if(xelement!="0"){
		var elem = document.getElementById(xelement);
		xelement=elem.offsetTop;
	}

	$("#xMainContent1").stop(true,true).animate({ scrollTop: xelement }, 600);
}
function xScrolUpObj(obj){
	xelement=$(obj).offset().top;
	$("#xMainContent1").stop(true,true).animate({ scrollTop: xelement }, 600);
}

function xAbrirDialogUs(obj){
	xdialogus.open()
}
function xOpenDialog(nomId,idRow){
	xRowObj=$(idRow).parent().parent();
	xIdROw=$(idRow).parent().parent().attr('data-id');
	xTableRow=$(idRow).parent().parent().attr('data-t');
	nomId.open();
}

function xOpenDialog2(nomId){nomId.open();}
function xCerrarDialog2(nomId){nomId.close();}

function xCerrarSession(){
	$('body').removeClass('loaded');
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-103'})
	.done( function (a) {
		setClearLocalStorage();
		// var printL = window.localStorage.getItem('::app3_woIpPrintLo');
		// window.localStorage.clear();

		// window.localStorage.setItem('::app3_woIpPrintLo', printL);
		// document.location.href='../../logueese.html';
	});
}

function xDatosUs(){
	$("#xnomu").text(xNomUsario);
	$("#xcargou").text(xCargoU);
}
function xOpenPanelDe(){
	//PanelDe.openDrawer();
	$("#PanelDe").css('z-index','20');
}


function xGenerarMenu(op){
	/*switch(op){
		case 1://
			xMenuOp='<div class="xBtnMenuLateral" onClick="xOpenPage(7)"><p>Inicio</p></div>'+
				'<div class="xBtnMenuLateral" onClick="xOpenPage(4)"><p>Habitaciones</p></div>'+
				'<div class="xBtnMenuLateral" onClick="xOpenPage(10)"><p>Equipaje Consignado</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(2)"><p>Reservas</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(9)"><p>Movimientos de Caja</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(8)"><p>Venta Directa</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(7)"><p>Panel de Administrador</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(6)" id="btn_configurar"><p>Configuracion</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xCerrarSession()" id="btn_configurar"><p>Cerrar Sesion</p></div>';
			break;
		case 2://
			xMenuOp='<div class="xBtnMenuLateral" onClick="xOpenPage(7)"><p>Inicio</p></div>'+
				'<div class="xBtnMenuLateral" onClick="xOpenPage(4)"><p>Habitaciones</p></div>'+
				'<div class="xBtnMenuLateral" onClick="xOpenPage(10)"><p>Equipaje Consignado</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(2)"><p>Reservas</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(9)"><p>Movimientos de Caja</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(8)"><p>Venta Directa</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xOpenPage(5)"><p>Panel de Recepcionista</p></div>'+
	    		'<div class="xBtnMenuLateral" onClick="xCerrarSession()" id="btn_configurar"><p>Cerrar Sesion</p></div>';
			break;
	}
	$(".xBtnPanel").html(xMenuOp).trigger('create');*/

}

function showCambiarClave(){
	$("#datosGeneralesUs").addClass('xInvisible');
	$("#cambioClaveUs").removeClass('xInvisible');
}

function cambiarClaveUs() {
	const pa = $("#txtpa")[0].value;
	const pn = $("#txtpn")[0].value;

	$("#msj_1").addClass("xInvisible");
	$("#msj_2").addClass("xInvisible");
	
	if (pa.length < 6) {
		$("#msj_1").text('Minimo 6 caracteres.');
		$("#msj_1").removeClass("xInvisible");
	}

	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-304', data:{pa: pa, pn:pn}})
	.done( function (dtC) {
		// dtC=JSON.parse(dtC).datos[0].pass;		
		if (dtC === "0") {
			$("#msj_1").text('Claves incorrecta. No coiciden.');
			$("#msj_1").removeClass("xInvisible");			
		} else {
			$("#msj_2").removeClass("xInvisible");
		}
	});
}

function keyChangePass(event) {
	if (event.keyCode===13) changePass();
}

function changePass() {
	const p1 = pass1.value;
	const p2 = pass2.value;	

	if ( p1 === '') {msj_pass_clave.textContent = "Tiene que ingresar una clave"; return;}
	if ( p1 != p2 ) {msj_pass_clave.textContent = "Las claves no son iguales"; return;}
	if ( p1.length < 6) {msj_pass_clave.textContent = "Debe tener minimo 6 caracteres."; return;}
	if ( p1 === "123456" ) {msj_pass_clave.textContent = "La clave no puede ser la que pusiste."; return;}

	$.ajax({
			type: 'POST',
			url: '../../bdphp/log.php?op=-3041',
			data: {pn: p2}
		})
		.done(function (dtC) {
			msj_pass_clave.textContent = '';
			dialog_requiere_cambio_pas.close();
			localStorage.setItem('::app3_woUSN', 1);
			xPasarAMenuAcc();
		});
}

function xNewUs() {
	// var xNuevoUs=false;
	if ( !localStorage.getItem('::app3_woUSN') ) {
		const xNuevo = parseInt(xm_log_get('app3_us').nuevo);
		if (xNuevo === 0) {
			xNuevoUs = true; 
			$('body').addClass('loaded');
			dialog_requiere_cambio_pas.open();			
		} else {
			xPasarAMenuAcc();
		}
	} else {		
		xPasarAMenuAcc();
	}


	// return xNuevoUs;
}

function xPasarAMenuAcc() {
	xLiberarRouter();
	if(xUsAc_Ini=='A2,'){window.localStorage.setItem('::app3_woUOn',1); xOpenPage(3);}else{
		setLocalSotrage('::app3_sys_route', 0);
		xOpenPage(1);}
}

function showNotificationPago() {
	xOpenPage(47);
}

function xDelayHere(delayInms) {
	return new Promise(resolve => {
	  setTimeout(() => {
		resolve(2);
	  }, delayInms);
	});
  }

