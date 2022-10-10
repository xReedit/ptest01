var xIdOrg,
xIdSede,
xNomU,
xPopupLoad,
xRouterTime_cp = false,
myWindowAppCarta,
componentsLoad = false, isOnlineDeliveryApp = false; showBusqyedaMesaOder = false;
// window.onload = function(){setTimeout( function(){ xIniControlPedido(); }, 600); };

// $(document).ready(function () {
// window.onload = () => {
// 	xIniControlPedido();
// 	// xConstAjax();
// };
// var s = document.createElement('script');
// 	s.src = "../web_components/webcomponentsjs/webcomponents-lite.js",
// 	document.head.appendChild(s);

if ('registerElement' in document && 'import' in document.createElement('link')) {
	// no polyfills needed
	console.log('no polyfills needed');
  } else {
	console.log('si necestia polyfills');
	
  }

  window.addEventListener('WebComponentsReady', function (e) {		

	// setTimeout(() => {
		// if ( this.componentsLoad ) {return; }		
		this.componentsLoad = true;
		console.log('cargado en 4s - desde WebComponentsReady');	
		xIniControlPedido();		
	// }, 4000);
  });


  window.onload = () => {	  
	  setTimeout(() => {
		if ( this.componentsLoad ) {return; }		
		console.log('cargado en 4s - desde ready');	
		xIniControlPedido();
	}, 4000);
  };

// document.addEventListener("DOMContentLoaded", function componentsReady() {
// 	xIniControlPedido();
// });

function xIniControlPedido(){
	xVerificarSession();
	//setInterval(function(){ xVerificarSession(); }, 5000); // constantemente actualiza

	xPopupLoad=document.getElementById('xLoad');
	
	xm_log_get('ini_us');
	var xDatos_p=xm_log_get('sede_generales');//$.parseJSON(window.localStorage.getItem("::app3_sys_dta_prt"));
	$("#en_nom_sede").text(xDatos_p[0].des_sede);
	$("#en_nom_ciudad").text(xDatos_p[0].ciudad);
	$("#en_nom_us").text(xNomUsario);
	
	xm_LogChequea(function(){

		xLoadTipoConsumoX();

		// xSetActivarDeliveryOnline(isOnlineDeliveryApp);
		setValueStorageOnlineDelivery();
		// setTimeout(() => {
		// 	xOpenPage(2, '?f1=1?df1=LOCAL');
		// }, 2500);

		// xOpenPage(2, "?f1=1?df1=LOCAL");
		
	});
	//if(xIdUsuario==''){	xIdUsuario=window.localStorage.getItem('::app3_woU');}


	/*xLoadTipoConsumoX();
	xOpenPage(2,'?f1=1?df1=LOCAL')
	var xDatos_p=xm_LogIni('sede_generales');//$.parseJSON(window.localStorage.getItem("::app3_sys_dta_prt"));
	$("#en_nom_sede").text(xDatos_p[0].des_sede);
	$("#en_nom_us").text(window.localStorage.getItem('::app3_woNus').toLowerCase());*/
}
// var axxx = 0;
function xOpenPage(xop, parametro){
	if (xRouterTime_cp) return;
	xRouterTime_cp = true;
	setTimeout(() => {
		xRouterTime_cp = false;
	}, 1000);

	// axxx++;
	// console.log('control pedidos router run ', axxx);	
	if(parametro==null){parametro='';}
	var xruta='';
	$('#div_filtro_header').addClass('xInvisible');
	switch(xop){
		case -1:xruta='/prueba';break;
		case 0:	xruta='/categoria';break;
		case 1:	xruta='/menu';break;
		case 2:	xruta='/c_pedido';
		$('#div_filtro_header').removeClass('xInvisible');
			break;
		case 3:	xruta='/caja';break;		
		case 4:			
			document.location.href='m_panel.html';
			return;
		case 5:
			h = window.screen.availHeight-100;
			if ( parseInt(xm_log_get('datos_org_sede')[0].pwa) === 1  ) { // si socket 
				if ( !myWindowAppCarta ) {					
					myWindowAppCarta = window.open('https://app.restobar.papaya.com.pe', "carta", "width=400,height="+h);
				}
				myWindowAppCarta.focus();
				return;
			}

			window.localStorage.removeItem("::app3_sys_first_load");			
			var myWindow = window.open('m_menu.html', "Carta", "width=400,height="+h);	return;break;
		case 6:	xruta='/pedido_detalle';break;
		case 7:	xruta='/monitor_pedidos';break;
		case 8:	xruta='/historial_ventas';break;
		case 9:	xruta='/historial_registro_pago_app';break;
		case 22:xruta='/resumen_caja';break;
		case 10:			
			xruta='/indicadores';
			break;
		case 11:xruta='/control-delivery';break;
		case 12:xruta='/pedidos-anulados';break;
	}
	xruta=xruta+parametro;
	// setTimeout( function(){
	// 	if (router != undefined) {
	// 		router.go(xruta); 
	// 	} else {
	// 		setTimeout(() => {
	// 			router.go(xruta); 
	// 		}, 4000);
	// 	}
	// }, 50);

	// setTimeout(() => {
	// 	router.go(xruta);
	// }, 2000);


	router.go(xruta);
}
function xLoadTipoConsumoX(){
	//$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=3'})
	//.done( function (dtTPC) {
		//var xdtTPC=$.parseJSON(dtTPC);
		$('#div_filtro_header').removeClass('xInvisible');
		var xdtTPC=xm_log_get('estructura_pedido'); //xdtTPC.datos;
		var xCadenaTPC='';
		var xDesLi='';
		var xIdTpc;
		var xidfiltro='';
		for (var i = 0; i < xdtTPC.length; i++) {
			if(xdtTPC[i]==null){continue;}
			xDesLi=xdtTPC[i].titulo;
			xIdTpc=xdtTPC[i].idtipo_consumo;
			xidfiltro='.tpc'+xIdTpc;
			if(xDesLi==''){xDesLi=xdtTPC[i].descripcion;}
			if(i==0){xOpenPage(2,'?f1='+xIdTpc+'?df1='+xDesLi)}
			xCadenaTPC=xCadenaTPC+String('<li onclick="xFiltroPedidos(this);" class="li_row m_pedidos" data-id="'+xIdTpc+'" id="DesTPC'+xIdTpc+'">'+
		    			'<div>'+
		    				'<span class="titulo">'+xDesLi+'</span>'+
		    				//'<span class="xIndicadorCant"></span>'+
		    			'</div>'+
		    		'</li>');

		};
		$("#list_menu_lateral .li_row").remove();
		$("#list_menu_lateral li:first-child").after(xCadenaTPC).trigger('create');
	//});
}

function setValueStorageOnlineDelivery() {
	var valDeliveryOnline = window.localStorage.getItem('::app3_sys_vr_online_delivery') ? window.localStorage.getItem('::app3_sys_vr_online_delivery') : 0;
	isOnlineDeliveryApp = parseInt(valDeliveryOnline) === 0 ? false : true;
	// isOnlineDeliveryApp = !isOnlineDeliveryApp;
	toogleOnline.checked = isOnlineDeliveryApp;
}

function xActivarDeliveryApp(obj) {
	isOnlineDeliveryApp = !isOnlineDeliveryApp;	
	xSetActivarDeliveryOnline(isOnlineDeliveryApp);
}

function xSetActivarDeliveryOnline(isValDeliveryOnline) {
	var valDeliveryOnline = isValDeliveryOnline ? 1 : 0;
	window.localStorage.setItem('::app3_sys_vr_online_delivery', valDeliveryOnline);

	$.ajax({ type: 'POST', url: '../../bdphp/log_005.php?op=12', data:{val:valDeliveryOnline}})
	.done( function (xidC) {
		console.log('online');
	});
}


// function xFiltroPedidos(obj){
// 	var xurl_actual = window.location.href;
// 	xDesFiltro1=$(obj).find('.titulo').text();
// 	xIdFiltro1=$(obj).attr('data-id');

// 	if(xurl_actual.indexOf('c_pedido')==-1){
// 		xOpenPage(2,'?f1='+xIdFiltro1+'?df1='+xDesFiltro1);
// 	}
// 	xIdFiltro1='.tpc'+xIdFiltro1;
	
// 	$("#Titulo_page").text("PEDIDOS | "+xDesFiltro1);	
	

// 	if (iIniIsotope) {
// 		$('.grid').isotope({ filter: xIdFiltro1 });
// 	} else {		
// 		iIniIsotope = true;
// 	}			
	
// }