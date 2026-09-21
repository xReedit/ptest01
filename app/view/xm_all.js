var _socketSuperMaster = null;
var xh_sys,
    // xLamarVoz=0,
    xIdUsuario="",
    xNomU,
    xNomUsario,
    xCargoU,
    xUsAc_Ini,
    xidCategoria=1,//cambiar luego desayuno/1:almuerzo/cena/
    xRowObj,
    xTableRow,
    xIdROw,
    xIdOrg,
    xIdSede;

//xTonoLLamada='notifica1',
//router,

// window.onerror = function(error, url, line) {
//   console.log(error);
//   // controller.sendLog({ acc: 'error', data: 'ERR:' + error + ' URL:' + url + ' L:' + line });
// };
window.addEventListener("error", function(e) {
	if (!e) { return }
  console.log(e);
//   alert(e.error);
  // You can send data to your server
  // sendError(data);
});

function xGetTT(ctr,t_limite){
	var xt_porcentaje='';
	//var xt_transcurrido;
	if(t_limite!==''){
		var t_l = new Date();
		var t_l2 = new Date();
		xt_porcentaje=t_limite.split(':');
		t_l.setHours(xt_porcentaje[0],xt_porcentaje[1],xt_porcentaje[2]);
		t_l2.setHours(0,0,0);
		t_l=t_l-t_l2;
	}else{t_limite=0;}
	xTiempoTranscurridos_2(xh_sys,function(a,b,c,d){
		if(t_limite!==0){
			xt_porcentaje=(parseFloat(d/t_l).toFixed(1))*100;
			switch(xt_porcentaje){
				case 70:$("#"+ctr).css('color','#F90');
					break;
				case 100:$("#"+ctr).css('color','#F00');
					break;
				}
			}
		$("#"+ctr).text(a+':'+b+':'+c);
		});
	}

function xFondoImg(ruta){
	var xRuta=ruta.slice(0,-1);
	xRuta=xRuta.split(';');
	$.backstretch(xRuta, {
        fade: 650,
        duration: 12000,
        //centeredX:true, centeredY:true
    });
}

function xFondoVideo(ruta){
	var xVideo='<iframe id="xvideo" src="//www.youtube.com/embed/'+ruta+'?enablejsapi=1&version=3&loop=1&playlist='+ruta+'&modestbranding=0&showinfo=0&rel=0&autoplay=1&iv_load_policy=3" frameborder="0" style="overflow:hidden;overflow-x:hidden;overflow-y:hidden;height:100%;width:100%;position:absolute;top:0px;left:0px;right:0px;bottom:0px" height="100%" width="100%"></iframe>';
	$(".Content_pantalla").append(xVideo).trigger('create');
}

function xAnimTk(idC,tp){
	//
	if(tp==3){
	$("#"+idC).animate({top:'0px'},1500,'swing',function(){
		document.getElementById('sonido_notifica').play();
		if(xLamarVoz==1){xVoz(idC);}
	});}else{
		$("#"+idC).animate({marginLeft:'0px'},1500,'swing',function(){
		document.getElementById('sonido_notifica').play();
		if(xLamarVoz==1){xVoz(idC);}
		});
	}
}

function xAnimHideTk(idC){
	$("#"+idC).animate({opacity:'0'},1800,'swing',function(){
		$("#"+idC).hide('slow', function(){
			$("#"+idC).remove();
			idC=idC.replace('t','');
			$.post('../../bdphp/log.php?op=503',{i:idC},function(){return false;});
		});
	});
}

function xVoz(tk,txt){
	var xVoz_lenguaje='es-ES';
	var xVoz_text;
	if(tk!==null){
		var xCtrl=$("#"+tk);
		var xNumTk=xCtrl.find('#tk_num').text();
		var xDesV=xCtrl.find('#tk_titulo2').text();
		var xNumV=parseInt(xCtrl.find('#tk_m_num').text());
		var xDesTk=xNumTk.replace(xNumTk.match(/[0-9]+/g)[0],'');
		var xDesTkLetra='';

		xNumTk=xNumTk.match(/[0-9]+/g)[0];
		xDesTk=xDesTk.split("");

		for (var i = 0; i < xDesTk.length; i++) {
			xDesTkLetra=xDesTkLetra+'-'+xDesTk[i];
		}

		xVoz_text='Ticket "'+xDesTkLetra+'" "'+xNumTk+'", pase, a '+xDesV+' "'+xNumV+'"';

	}
	else{xVoz_text=txt;}

	if ('speechSynthesis' in window) {
		var speech = new SpeechSynthesisUtterance();
		speech.voiceURI = 'native'; speech.volume = 1; speech.rate = 1.00; speech.pitch = 1;speech.lang = xVoz_lenguaje;
		speech.text=xVoz_text;
		window.speechSynthesis.speak(speech);
	}
	else{
		var audio = new Audio();
		audio.src = "../../bdphp/vozx.php?txt="+xVoz_text+"&lenguaje="+xVoz_lenguaje;
		console.log(audio.src);
		audio.type = "audio/mpeg";
		audio.play();

	}
}

function xvalidateForm(des,responde) {
	var obj=$('#'+des);
	var a=true;
	obj.find('paper-input').each(function(e,element){
		if(!element.validate()){a=false;}
	});
	responde(a);
}

function xvalidateFormInput(des,responde) {
	var obj=$('#'+des),
      a=true,
      b;
	obj.find('input').each(function(e,element){
		element.checkValidity();
		b=element.validity;
		if(b.valid===false){
			a=false;
			$(element).addClass('invalido');
		}
	});
	responde(a);
}
function xvalidateObjFormInput(obj,responde) {
	var a=true,
      b;
	obj.find('input').each(function(e,element){
		element.checkValidity();
		b=element.validity;
		if(b.valid===false){
			a=false;
			$(element).addClass('invalido');
		}
	});
	responde(a);
}


function xBorrarRegistroFisico(tabla,i){
	$.post('../../bdphp/log.php?op=101', {t:tabla, id:i});
}

function xBorrarRegistroFisico2(tabla,i,nomcampo){
	$.post('../../bdphp/log.php?op=10101', { t: tabla, id: i, campo: nomcampo});
}

function xBorrarRegistro(tabla,i){ //borrado logico
	$.post('../../bdphp/log.php?op=103', {t:tabla, id:i});
}

//_c = valor
function xBorrarRegistroCampo(tabla,i,_campo,_c){ //borrado logico
	$.post('../../bdphp/log.php?op=106', {t:tabla, id:i, campo: _campo, c: _c});
}

function xBorrarRegistroEnAnulado(tabla,i){
	$.post('../../bdphp/log.php?op=104', {t:tabla, id:i});
}
function xBorrarItem(obj){
	if(obj!==null){
		xRowObj=obj.parentNode.parentNode;
		xTableRow=$(xRowObj).attr('data-t');
		xIdROw = $(xRowObj).attr('data-id') || xRowObj.dataId;
	}
	xBorrarRegistro(xTableRow,xIdROw);
	$(xRowObj).fadeTo(550, 0, function () {$(this).remove();});
}

function xBorrarItemLogicoCampo(obj, val) {
	if (obj !== null) {
		xRowObj = obj.parentNode.parentNode;
		xTableRow = $(xRowObj).attr('data-t');
		xIdROw = $(xRowObj).attr('data-id') || xRowObj.dataId;
		xCampo = $(xRowObj).attr('data-campo') || xRowObj.dataCampo;
	}
	xBorrarRegistroCampo(xTableRow, xIdROw, xCampo, val);
	$(xRowObj).fadeTo(550, 0, function () {
		$(this).remove();
	});
}

function xBorrarItemLocal(obj){
	$(obj).parent().fadeTo(550, 0, function () {$(this).remove();});
}
function xScrollIrA(xIdControl){$('body,html').stop(true,true).animate({scrollTop: $(xIdControl).offset().top-5},1000);}
 //Element.prototype.remove = function() { this.parentElement.removeChild(this); } NodeList.prototype.remove = HTMLCollection.prototype.remove = function() { for(var i = this.length - 1; i >= 0; i--) { if(this[i] && this[i].parentElement) { this[i].parentElement.removeChild(this[i]); } } }}

function xLoadPageTerminal(i, responde){
 	var xi=xStorageId();
 	$.ajax({ type: 'POST', url: 'bdphp/log.php?op=10', data:{i:i, xi:xi}})
	.done( function (dt) {
		var xdt=$.parseJSON(dt);
		if(!xdt.success){alert(xdt.error); return;}
		//
		if(xdt.datos.length>0){
			window.localStorage.setItem('xweb::i',xdt.datos[0].xi);
			responde(xdt.datos[0]);
		}
		else{
			responde(null);
		}
	});
 }

function xStorageId(){
	return window.localStorage.getItem('xweb::i');
}

function xRowFocusInput(xRow,xmoneda){
	if($(xRow).find('.xTextRow').length>0){return;}
	var xValRow=$(xRow).text();
	$(xRow).html('<input type="text" onblur="xRowFocusInput_blur(this,'+xmoneda+')" class="xTextRow" value="'+xValRow+'" focus>').trigger('create');
}
function xRowFocusInput_blur(obj,xmoneda){
	var xval='';
	if(xmoneda=='1'){xRetornaMoneda(obj);}
	xval=$(obj).val();
	$(obj).parent().text(xval);
	$(obj).remove();
}

function xGeneraCod(){
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      code = "",
      lon=5,
      rand;
	for (var x=0; x < lon; x++){
		rand = Math.floor(Math.random()*chars.length);
		code += chars.substr(rand, 1);
	}
	return code;
}

function xEnumerarTbRow(tb,nomCol){
	var cuenta=1;
	$(tb).find(nomCol).each(function(index, element){
		$(element).text(xCeroIzq(cuenta,2));
		cuenta++;
	});
}

function xSumaCantRow(tb,nomCol){
	var suma=0;
	$(tb).find(nomCol).each(function(index, element){
		if(!isNaN(parseInt($(element).text()))){
			suma=suma+parseFloat($(element).text());
		}
	});
	return suma;
}
function xSumaCantRowVisible(tb,nomCol){
	var suma=0;
	$(tb).find(nomCol).each(function(index, element){
		if($(element).is(':hidden')){return;}
		if(!isNaN(parseInt($(element).text()))){
			suma=suma+parseFloat($(element).text());
		}
	});
	return suma;
}


function xContarCantRow(tb,nomCol){
	var cuenta=0;
	$(tb).find(nomCol).each(function(index, element){
		cuenta++;
	});
	return cuenta;
}

function xContarCantRowVisible(tb,nomCol){
	var cuenta=0;
	// cuenta=$(tb).find(nomCol).filter(":visible").size();
	cuenta = $(tb).find(nomCol).filter(":visible").length;
	/*$(tb).find(nomCol).each(function(index, element){
		if($(element).is(':hidden')){return};
		cuenta++;
	});*/
	return cuenta;
}
function xContarCantRowAttr(tb,BuscarEn,filter){
	var cuenta=0;
	$(tb).find(".row").each(function (index, element) {
		var xIdRowTb=$(element).attr(BuscarEn);
		if(xIdRowTb==filter){
			cuenta++;
		}
    });
    return cuenta;
}
//obtener la suma del total row segun attr
//subfind = td donde esta el valor
function xObtnerValSumRowAttr(tb,BuscarEn,filter,subfind){
	var cuenta=0;
	$(tb).find(".row").each(function (index, element) {
		var xIdRowTb=$(element).attr(BuscarEn);
		if(xIdRowTb==filter){
			cuenta=parseFloat(cuenta)+parseFloat($(element).find(subfind).text());
		}
    });
    return cuenta;
}

/*function xLoadHoraChekOut(){
	//solo una vez al iniciar session
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=903'})
	.done( function (dth) {window.localStorage.setItem('::app2_wo::out',dth) ;})
	//habilitar fecha check_in en habitacion
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=9033'})
	.done( function (dth) {window.localStorage.setItem('::app2_wo::fci',dth) ;})
}*/
function xLoadSetDatosSession(responde){
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-101'})
	.done( function (dtS) {
		var xdtS=$.parseJSON(dtS);
		if(xdtS.success===false){alert(xdtS.error); return;}
		xIdOrg=xdtS.datos[0].ido;
		xIdSede=xdtS.datos[0].idse;
		xIdUsuario=xdtS.datos[0].idu;
		xNomU=xdtS.datos[0].nomU;
		xNomUsario=xdtS.datos[0].nomUs;
		xCargoU=xdtS.datos[0].cargoU;

		window.localStorage.setItem("::app3_wo", xIdOrg);
		window.localStorage.setItem("::app3_woS", xIdSede);
		window.localStorage.setItem("::app3_woU", xIdUsuario);
		window.localStorage.setItem("::app3_woA", xdtS.datos[0].acc);
		window.localStorage.setItem("::app3_woNus", xdtS.datos[0].nomUs);
		responde(xdtS.datos[0].acc);
		});
}

function xVerificarSession(){
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-104'})
	.done( function (a) {
		if(a==1){
			setClearLocalStorage();
			// var printL = window.localStorage.getItem('::app3_woIpPrintLo');
			// window.localStorage.clear();

			// window.localStorage.setItem('::app3_woIpPrintLo', printL);

			// document.location.href='../../logueese-9e9140c8.html';
			//window.location.href="../../index-2898d3fd.html";
		}
	});
}

function xLoadImpresoras(){
	//$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-105',async: false})
	//.done( function (DtbdPrint) {
		//var xDtbdPrint=$.parseJSON(DtbdPrint);
	var xDtbdPrint_eval=xm_log_get('app3_woIpPrint');
	var xPrintLocal = window.localStorage.getItem('::app3_woIpPrintLoC');
		
		//var xPrintLocal;
		//var xDtbdPrint_eval=xDtbdPrint.datos;
		//xDtbdPrint=JSON.stringify(xDtbdPrint_eval);
		//window.localStorage.setItem("::app3_woIpPrint", xDtbdPrint);
		//window.localStorage.setItem("::app3_woIpPrintLo", '');
		//busca si hay impresora local y si pertenece a este terminal

		//xPrintLocal=getCookie('app3_print_ID');
	// const dt_print_local = xDtbdPrint_eval.filter(x => x.local === "1").map(x => x);
	// const cant_print_local_bd = dt_print_local.length;
	
	// verificar si existe alguna impresora registrada en la bd si solo hay una lo registra	
	// ESTA SOLUCION AFECTARIA A TODOS LOS USUARIOS // EL USUARIO DE CAJA DEBE IR A CONFIGURACION Y ASIGNARSE LA IMPRESORA QUE LE CORRESPONDE
	// if (xPrintLocal === null && cant_print_local_bd === 1) { // si no co
	// 	window.localStorage.setItem("::app3_woIpPrintLoC", dt_print_local[0].descripcion);// para comparar si existe impresora local
	// 	window.localStorage.setItem("::app3_woIpPrintLo", JSON.stringify(dt_print_local[0]));
	// 	return;
	// }
	
		
	for (var i = 0; i < xDtbdPrint_eval.length; i++) {		
		if(xDtbdPrint_eval[i].local==1){
			if(xPrintLocal === xDtbdPrint_eval[i].descripcion){//impresora local detec
				window.localStorage.setItem("::app3_woIpPrintLoC", xDtbdPrint_eval[i].descripcion);// para comparar si existe impresora local
				window.localStorage.setItem("::app3_woIpPrintLo", JSON.stringify(xDtbdPrint_eval[i]));
				return;
			}
		}
	}
	//});
	//load conf_print_otros //precuenta comprobante
	//$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-106',async: false})
	//.done( function (DtbdPrintx) {
		//var xDtbdPrintx=$.parseJSON(DtbdPrintx);
		//xDtbdPrintx=xDtbdPrintx.datos;
		//xDtbdPrintx=JSON.stringify(xDtbdPrintx);
		//window.localStorage.setItem("::app3_woIpPrintO", xDtbdPrintx);
	//});
}

function xCerrarSessionAll(){
	$('body').removeClass('loaded');
	$.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-103'})
	.done( function (a) {
		setClearLocalStorage()
		// var printL = window.localStorage.getItem('::app3_woIpPrintLo');
		// window.localStorage.clear();

		// window.localStorage.setItem('::app3_woIpPrintLo', printL);
		// document.location.href='../../logueese-9e9140c8.html';
	});
}

function setClearLocalStorage(redirec = true) {
	// variables que se conservan
	var printL = window.localStorage.getItem('::app3_woIpPrintLoC');
	var touchVR = window.localStorage.getItem('::app3_sys_vr_touch');	
	var lasIdSede = window.localStorage.getItem('::app3_sys_last_s');
	var show_opcion_item = window.localStorage.getItem('::app3_sys_vr_show_opcion');
	var vr_touch_item = window.localStorage.getItem('::app3_sys_vr_touch');
	const pinpad_sn = window.localStorage.getItem('::app3_pinpad_sn');
	
	// zona de despacho
	var app3_woZD = window.localStorage.getItem('::app3_woZD');
	var app3_woZD_TP = window.localStorage.getItem('::app3_woZD_TP');
	var app3_woZD_orderItemVerticalZD = window.localStorage.getItem('::app3_woZD_orderItemVerticalZD');
	
	window.localStorage.clear();

	if (printL) {window.localStorage.setItem('::app3_woIpPrintLoC', printL); }
	if (touchVR) {window.localStorage.setItem('::app3_sys_vr_touch', touchVR); }
	if (lasIdSede) {window.localStorage.setItem('::app3_sys_last_s', lasIdSede); }
	if (show_opcion_item) {window.localStorage.setItem('::app3_sys_vr_show_opcion', show_opcion_item); }
	if (vr_touch_item) {window.localStorage.setItem('::app3_sys_vr_touch', vr_touch_item); }
	if (pinpad_sn) {window.localStorage.setItem('::app3_pinpad_sn', pinpad_sn); }

	// zona de despacho
	if (app3_woZD) { window.localStorage.setItem('::app3_woZD', app3_woZD); }
	if (app3_woZD_TP) { window.localStorage.setItem('::app3_woZD_TP', app3_woZD_TP); }
	if (app3_woZD_orderItemVerticalZD) { window.localStorage.setItem('::app3_woZD_orderItemVerticalZD', app3_woZD_orderItemVerticalZD); }

	if(redirec) {
		document.location.href='../../logueese.html';
	}
};

function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}

function xm_LogIni(responde){
  $.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-1111'})
		.done( function (dt) {
			// console.log('-1111 dt ===> ', dt)
      if(dt=="0"){xVerificarSession();responde(false);}else{
        window.localStorage.setItem("::app3_woDUS", dt);
        responde(true);
      }
	})
}
function xm_LogChequea(responde){
  var callback = typeof responde === 'function' ? responde : function () { };
  var xdt_log=window.localStorage.getItem("::app3_woDUS");
  var _xdt_log= xdt_log
	// Datos del sistema: si la pagina de configuraciones marco el snapshot como vencido,
	// mandamos "undefined" para que op=-1112 responda "0" y el cliente lo regenere desde
	// la BD con op=-1111. No borramos ::app3_woDUS: sigue disponible hasta que llegue el nuevo.
	try {
		if (window.localStorage.getItem('::app3_woDUS_stale')) {
			window.localStorage.removeItem('::app3_woDUS_stale');
			_xdt_log = 'undefined';
		}
	} catch (e) { /* storage no disponible: sigue el flujo normal */ }
  if (_xdt_log === null){
	_xdt_log="undefined";
	} else {
		// _xdt_log = {
		// 	us: xm_log_get('app3_us')
		// }
		// _xdt_log = btoa(JSON.stringify(_xdt_log));
	}
	// console.log("xm_log_get('datos_org_all_sede')", xm_log_get('datos_org_all_sede'))
	// console.log('xdt_log ', xdt_log)
  $.ajax({ type: 'POST', url: '../../bdphp/log.php?op=-1112',data:{d:_xdt_log}})
		.done( function (rpt) {
			// console.log('-1112 ==> xm_LogChequea == rpt ', rpt);
      switch (rpt) {
        case "0":
          // callback y no responde: hay paginas que llaman xm_LogChequea() sin argumento
          // (x-venta-rapida) y esta rama ahora tambien se usa para refrescar el snapshot.
          xm_LogIni(function(a){if(a){callback(true)}});
          break;
        case "1":
        //   responde(true)
		  callback(true);
          break;
        case "2":
          xVerificarSession();
          break;
        default:
          window.localStorage.setItem("::app3_woDUS",rpt);
		  callback(true);
          break;
      }
      //if(rpt==="1"){xm_LogIni(function(a){if(a){responde(true)}});}else{window.localStorage.setItem("::app3_woDUS",rpt); return responde(false);}
		})
}
function xm_log_get(seccion){
	// Si la pestaña esta operando en otra sede (POS multi-sede), preferir el
	// snapshot por-pestaña en sessionStorage. Defensivo: si opSede no existe
	// o no hay snapshot, cae al localStorage habitual sin cambiar comportamiento.
	var xdt_log = null, xdt_rpt;
	var rawSrc = null;
	try {
		// 'app3_us' es la identidad/pertenencia del usuario: SIEMPRE del storage base.
		// Ademas, opSede.isOverride() -> getPertenencia() -> _us() -> xm_log_get('app3_us'),
		// asi que consultar opSede para 'app3_us' causaria recursion infinita (cuelga la pagina).
		if (seccion !== 'app3_us' &&
		    typeof opSede !== 'undefined' && opSede.isOverride && opSede.isOverride()) {
			rawSrc = window.sessionStorage.getItem('::app3_woDUS_op');
		}
	} catch (e) { /* opSede no disponible aun */ }
	if (!rawSrc) {
		rawSrc = window.localStorage.getItem("::app3_woDUS");
	}
	try {
		xdt_log=window.atob(rawSrc);
		xdt_log=JSON.parse(xdt_log)

	} catch (error) {
		console.log(error);
		return;
	}

  switch (seccion) {
	case 'app3_us':
	  xdt_rpt = xdt_log.us;
	  break;
	case 'ini_us':
      xIdOrg=xdt_log.us.ido;
      xIdSede=xdt_log.us.idsede;
      xIdUsuario=xdt_log.us.idus;
      xNomU=xdt_log.us.nombre;
      xNomUsario=xdt_log.us.nomus;
      xCargoU=xdt_log.us.cargo;
      xUsAc_Ini=xdt_log.us.acc;
      break;
    case 'app3_Us_home':
      	xdt_rpt=xdt_log.sistema.url ;
		break;
	case 'app3_sys_const':		
		xdt_rpt = xdt_log.sistema.constantes;
		break;
	case 'cpe_alerts':// * sedes
      xdt_rpt=xdt_log.sistema.cpe_alert;
	  break;
    case 'app3_woA':
      xdt_rpt=xdt_log.us.acc;
      break;
	case 'app3_woPer':
		xdt_rpt = xdt_log.us.per;
		break;
    case 'app3_woIpPrint':
      xdt_rpt=xdt_log.dispositivos.dispositivo;
      break;
    case 'app3_woIpPrintO':
      xdt_rpt=xdt_log.dispositivos.otros_print_doc;
      break;
    case 'sede_generales'://app3_sys_dta_prt
      xdt_rpt=xdt_log.sede.generales;
      break;
    case 'sede_otros_datos'://app3_sys_dta_other
      xdt_rpt=xdt_log.sede.otros_datos;
      break;
    case 'categorias'://app3_sys_dt_mlc
      xdt_rpt=xdt_log.carta.categorias;
	  break;
	case 'carta_subtotales'://
      xdt_rpt=xdt_log.carta.subtotales;
      break;
    case 'estructura_pedido'://amar array con tipo de consumo // amar estructura, del pedido tambien para imoresion ::app3_sys_dta_pe = {tipo consumo > seccion > item} // ::app3_sys_dta_tct //::app3_sys_dta_tct_estructura
      xdt_rpt=xdt_log.carta.estructura_pedido;
      break;
	case 'reglas_de_carta'://app3_sys_dta_rec
      xdt_rpt=xdt_log.carta.regla_carta;
	  break;
	case 'datos_org_sede':// datos org y sede para facturacion
      xdt_rpt=xdt_log.sede.datos_org_sede;
	  break;
	case 'datos_org_all_sede':// * sedes
      xdt_rpt=xdt_log.sede.datos_org_all_sede;
	  break;
	case 'datos_sede_variables':// * sedes
      xdt_rpt=xdt_log.sede.datos_sede_variables;
	  break;	
	case 'datos_sede_holding':// * sedes
	  xdt_rpt=xdt_log.sede.datos_sede_holding;
	  break;
	
		// xDtUS(3)
  }
  return xdt_rpt;
}

function getVariableSede(variable) {
	let variablesSede = xm_log_get('datos_sede_variables');
	try {
		
		if(variablesSede) {
			variablesSede = variablesSede[0];
			variablesSede.switch1 = variablesSede.switch1 === '1';	
			variablesSede.switch2 = variablesSede.switch2 === '1';
			variablesSede.update_stock_after = variablesSede.update_stock_after === '1';	
		} else {
			// valores predeterminados para variablesSede
			variablesSede = {
				switch1: false,
				switch2: false,
				num_intentos_cierre: 3,
				update_stock_after: false,
				hora_cierre:  '0:00'
			}
		}

	} catch (error) {
		// valores predeterminados para variablesSede
		variablesSede = {
			switch1: false,
			switch2: false,
			num_intentos_cierre: 3,
			update_stock_after: false,
			hora_cierre:  '0:00'
		}
	}
	
	return variablesSede[variable];
}

//3
// El servicio de RUC responde con CUERPO VACIO y http 200 cuando el documento no existe.
// JSON.parse('') lanza, y si eso pasa dentro de un .done de jQuery el callback nunca se ejecuta:
// la barra de progreso se quedaba girando sin decir nada (reporte 18/09/2026).
// Devuelve el objeto, o null si no hay respuesta util.
function xParseRptDocumento(dt) {
	if (dt === null || dt === undefined || String(dt).trim() === '') { return null; }
	try { return JSON.parse(dt); } catch (e) { return null; }
}
// Respuesta uniforme para "no existe": success:false hace que quien llama muestre el mensaje.
function xRptDocumentoNoExiste(num_doc) {
	return {
		success: false, idcliente: '', nombres: '', direccion: '', f_nac: '',
		num_doc: num_doc, telefono: '', buscarSunat: false,
		msg: 'No se encontro el documento. Verifique el numero.'
	};
}

async function xGetFindCliente(valor, servicio, buscarSoloSunat, callback) {
	var esFacturacionElectronica=false;
	var rpt = [];
	var token = "XXeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.1tLS4vhIGufCW5H5vJ4bmNxhf43x-Vaik4oRwaDXi7E";
	var label_num = servicio === "dni" ? "ndni" : "ruc"; 
	var _url_servicio;
	var num_doc = valor;
	var buscarSunat = false;

		if ( buscarSoloSunat ) {
			xVerificarRucChangeSunat(valor, (rpt) => {
				callback(rpt);
			});
			return;
		}

				
		//primero busca en local
		// el await sin try lanzaba si la peticion fallaba, y como quien llama no espera la promesa
		// el error se perdia y el callback nunca corria: otra via de quedarse cargando
		var dt;
		try {
			dt = await $.ajax({ type: 'POST', url: '../../bdphp/log.php?op=602', data:{doc: valor}});
		} catch (e) {
			callback({ success: false, idcliente: '', nombres: '', direccion: '', f_nac: '',
				num_doc: valor, telefono: '', buscarSunat: false,
				msg: 'Problemas de conexion. intente nuevamente en un momento.' });
			return;
		}
			dt = xParseRptDocumento(dt);
			if (!dt || !dt.datos) { dt = { datos: [] }; } // respuesta rara: se sigue por la via de la API
			if (dt.datos.length > 0) { // si tiene los datos en el local
				dt = dt.datos[0];

				// show boton buscar en sunat
				buscarSunat = label_num === 'ruc';

				rpt = {
					success: true,
					idcliente:dt.idcliente,
					nombres: dt.nombres,
					direccion: dt.direccion,
					num_doc: dt.ruc,
					telefono: dt.telefono,
					msg: 'ok',
					buscarSunat: buscarSunat,
					f_nac: dt.f_nac
				};							

				// dt.count_search las veces que se busco la bd pasado 5 veces busca cambios en la sunat
				// if ( buscarSunat && dt.countSearch > 5 ) {
				// 	xVerificarRucChangeSunat(valor, (rpt) => {
				// 		callback(rpt);
				// 	});
				// } else {
				// 	// responde(rpt); 
				// }
				callback(rpt);





				// return rpt;
			} else {
							
				xValidarToken(token, (t)=> {
					token = t;
					if (t==="error"){ // algo paso con el servicio
						if (!esFacturacionElectronica) { // si no esta habilitado para facturacion electronica 
							rpt = {success: true, idcliente:'', nombres:'', direccion:'',num_doc:'', telefono: '', msg: 'ok'};
							// responde(rpt); return;							
						} else {
							rpt = {success: false, idcliente:'', nombres:'', direccion:'',num_doc:'', telefono: '', msg: 'Problemas de conexion. intente nuevamente en un momento.'};
							// responde(rpt); return;
						}
						
						// return rpt;						

						callback(rpt);
					}
			
					// token = t;					
					_url_servicio = "../../consulta/"+servicio+"/api/service.php?"+label_num+"="+valor+"&token="+token;
					
								
					$.ajax({ type: 'POST', url: _url_servicio})
					.done( function (dt) {
						// cuerpo vacio = el documento no existe: se responde y se corta aca,
						// sino JSON.parse revienta y el callback nunca llega
						dt = xParseRptDocumento(dt);
						if (!dt) { callback(xRptDocumentoNoExiste(valor)); return; }
						var nombres='', direccion='', telefono='';
						var num_doc = valor;
						var fnacimiento = '';

						if (dt.success && dt.haydatos) {			
							if (servicio === 'ruc') {
								nombres = dt.result.RazonSocial;
								direccion = dt.result.Direccion;
							} else {
								
								const ap_paterno = dt.result.ApellidoPaterno || '';
								const ap_materno = dt.result.ApellidoMaterno || '';
								const apellidos = ap_paterno === '' ? dt.result.apellidos || '' : ap_paterno + ' ' + ap_materno;
								nombres = dt.result.Nombres + " " + apellidos;
								nombres = nombres===' '? '' : nombres;
								direccion = '';								
								fnacimiento = dt.result.FechaNacimiento || '';
							}
						} else {
							if (!esFacturacionElectronica) { // si no esta habilitado para facturacion electronica 
								rpt = {success: true, idcliente:'', nombres:'', direccion:'',num_doc:num_doc, telefono: telefono, msg: 'ok'};
								// responde(rpt); return;
								// return rpt;
								callback(rpt);
							}
						}

						rpt = { success: dt.haydatos, idcliente: "", nombres: nombres, direccion: direccion, num_doc: num_doc, f_nac: fnacimiento, telefono: telefono, msg: dt.msg, buscarSunat: buscarSunat };

						// responde(rpt);
						callback(rpt);
					})
					.fail((jqXHR, textStatus)=>{
						rpt = { success: false, idcliente: "", nombres: "", direccion: "", f_nac: "", num_doc: num_doc, telefono: "", msg: "Problemas de conexion. intente nuevamente en un momento." };
						// responde(rpt); return;
						// return rpt;
						callback(rpt);
					});

				});
			}
		// });
		// });
	// });
}

function xVerificarRucChangeSunat(valor, callback) {
	var token = "XXeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.1tLS4vhIGufCW5H5vJ4bmNxhf43x-Vaik4oRwaDXi7E";
	xValidarToken(token, (t)=> {
		token = t;
		var rpt = {};
		_url_servicio = "../../consulta/ruc/api/service.php?ruc="+valor+"&token="+token;		
						
					$.ajax({ type: 'POST', url: _url_servicio})
					.done( function (dt) {
						// cuerpo vacio = el RUC no existe (ver xParseRptDocumento)
						dt = xParseRptDocumento(dt);
						if (!dt) { callback(xRptDocumentoNoExiste(valor)); return; }
						var nombres='', direccion='', telefono='';
						var num_doc = valor;
						var fnacimiento = '';

						if (dt.success && dt.haydatos) {			
							// if (servicio === 'ruc') {
								nombres = dt.result.RazonSocial;
								direccion = dt.result.Direccion;
							// } else {
								
							// 	const ap_paterno = dt.result.ApellidoPaterno || '';
							// 	const ap_materno = dt.result.ApellidoMaterno || '';
							// 	const apellidos = ap_paterno === '' ? dt.result.apellidos || '' : ap_paterno + ' ' + ap_materno;
							// 	nombres = dt.result.Nombres + " " + apellidos;
							// 	nombres = nombres===' '? '' : nombres;
							// 	direccion = '';								
							// 	fnacimiento = dt.result.FechaNacimiento || '';
							// }
						} else {
							// if (!esFacturacionElectronica) { // si no esta habilitado para facturacion electronica 
								rpt = {success: true, idcliente:'', nombres:'', direccion:'',num_doc:num_doc, telefono: telefono, msg: 'ok'};
								// responde(rpt); return;
								// return rpt;
								callback(rpt);
							// }
						}

						// _rebusqueda =busca ruc para informar de cambios 
						rpt = { success: dt.haydatos, idcliente: "", nombres: nombres, direccion: direccion, num_doc: num_doc, f_nac: fnacimiento, telefono: telefono, msg: dt.msg, buscarSunat: false };

						// responde(rpt);
						callback(rpt);
					})
					.fail(function () {
						// sin .fail el progreso quedaba girando ante cualquier corte de red
						callback({ success: false, idcliente: '', nombres: '', direccion: '', f_nac: '',
							num_doc: valor, telefono: '', buscarSunat: false,
							msg: 'Problemas de conexion. intente nuevamente en un momento.' });
					});
	});	
}


//1
function xValidarToken(token, callback) {
	var _token = token;
	var _url_servicio = "../../consulta/dni/api/validar.php?token=" + _token;
	$.ajax({ type: 'POST', url: _url_servicio, timeout:3000})
	.done( function (ValRpt) {
		ValRpt = JSON.parse(ValRpt);
		if (!ValRpt.success) {
			xRefreshToken((t)=>{
				_token = t;
				callback(_token);
			});
		} else {
			callback(_token);
		}
	}).fail((jqXHR, textStatus)=> {
		callback("error");
	});
}

//*2
function xRefreshToken(callback) {	
	var token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.1tLS4vhIGufCW5H5vJ4bmNxhf43x-Vaik4oRwaDXi7E";
	callback(token);
}


// recibe los array de respuesta que emite log_001 los convierte a un solo array para poder leerlo
function xm_all_SetResponseLog_001(response) {
	const arr = response.split('|');
	var _concat = {};
	arr.map(x => {
		if (x === "") {return;}		
		const arr_row = JSON.parse(x);
		Object.keys(arr_row).map(k => {
			_concat[k] = arr_row[k];			
		})
	});

	return _concat;
}

function xm_all_xToastOpen (msj, duracion=0, loading=true, iconWifi=false) {	
	msj = msj === null? 'Cargando...': msj;
	if (!loading) {
		$("#toast #loading").addClass("xInvisible");
	} else {
		$("#toast #loading").removeClass("xInvisible");
	}
	
	iconWifi ? $("#toast #icon-wifi").removeClass("xInvisible") : $("#toast #icon-wifi").addClass("xInvisible");
	
	toast = document.getElementById("toast");
	toast.duration = duracion;
  	toast.text = msj;
  	toast.show();
}

function xm_all_xToastClose() {
	toast = document.getElementById("toast");
	toast.hide();
}

function delay(callback, ms) {
	var timer = 0;
	return function () {
		var context = this, args = arguments;
		clearTimeout(timer);
		timer = setTimeout(function () {
			callback.apply(context, args);
		}, ms || 0);
	};
}

function xDelay(delayInms) {
	return new Promise(resolve => {
	  setTimeout(() => {
		resolve(2);
	  }, delayInms);
	});
  }

function setImportHTML(_linkImport) {

	_linkImport = _linkImport.trim().split(',');
	
	let link = document.createElement('link');	
	link.rel = 'import';
	_linkImport.map( x => {
		link.href = x;
		link.onload = onload;
		document.head.appendChild(link);
	})

}

// convierte el serializeArray del form a object ej: $("#form_new_co_pla").serializeArray()
function objectifyForm(formArray) { //serialize data function
	var returnArray = {};
	for (var i = 0; i < formArray.length; i++) {
		returnArray[formArray[i]['name']] = formArray[i]['value'];
	}
	return returnArray;
}

function pantallaCompleta() {
	var elem = document.documentElement;

	if ( !window.screenTop && !window.screenY ) {
		if (elem.mozRequestFullScreen) { /* Firefox */
			elem.mozRequestFullScreen();
		} else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
			elem.webkitRequestFullscreen();
		}
	} else {
		if (document.mozCancelFullScreen) { /* Firefox */
			document.mozCancelFullScreen();
		} else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
			document.webkitExitFullscreen();
		}
	}
}


// enviar correos electronicos
async function xSendEmailClienteSES(params) {
	const _url = URL_SERVER +'delivery/send-email-ses';
        await $.ajax({
				type: 'POST',
                url: _url,
                data: { msj: params}
			})
			.done((res) => {				
				return res;
			});
}

function xCalcMontoBaseIGV(importeTotal, procentaje_IGV) {
	return parseFloat(parseFloat(importeTotal) / (1 + procentaje_IGV)).toFixed(2)
}

function getDataUsRRHH() {
	const dataUser = xm_log_get('app3_us')[0]
	const dataOrg = xm_log_get('datos_org_sede')[0]
	const dataSede = xm_log_get('datos_org_all_sede')[0]
	return {
		"user": {
			"usuario": xNomU,
			"pass": '',
			"idusuario_restobar": parseInt(xIdUsuario),
			"nombres": xNomUsario,
			"cargo": xCargoU
		},
		"org": {
			"idorg_restobar": parseInt(dataOrg.idorg),
			"nombre": dataOrg.nombre,
			"direccion": dataOrg.direccion,
			"ruc": dataOrg.ruc,
			"telefono": dataOrg.telefono
		},
		"sede": {
			"idsede_restobar": parseInt(dataSede.idsede),
			"ruc": dataOrg.ruc,
			"razon_social": dataOrg.nombre,
			"ciudad": dataSede.ciudad,
			"direccion": dataSede.direccion,
			"telefono": dataSede.telefono,
			"nombre": dataSede.nombre
		}
	}
}


// verifica el codigo de error de la sunat
// aceptado: viene del campo 'accepted' del API (2026-08). true/false = el API
// sabe si SUNAT declaro el comprobante; null = API viejo, se clasifica solo por
// codigo como antes. Es la autoridad: manda sobre lo que diga sunat_errores.
// Codigo centinela (migracion 037) para errores de transporte: sunat_errores.codigo
// es int(11), asi que un code no numerico como 'HTTP' jamas puede catalogarse ahi.
const CPE_COD_ERROR_TRANSPORTE = -1;

// Registra el error en cpe_error (historial para soporte). Acepta 'codigo' y el
// backend (log_009 op=32) resuelve el idsunat_errores; asi tambien quedan los
// casos sin codigo catalogado, que antes no dejaban ningun rastro.
async function xRegistrarCpeError(external_id, datos) {
	if ( !external_id ) { return; }
	try {
		const fetchData = new httpFecht();
		await fetchData.postJson('../../bdphp/log_009.php?op=32', Object.assign({ external_id }, datos));
	} catch (error) {
		// el registro es telemetria: nunca debe tumbar el flujo de caja
		console.error('xRegistrarCpeError', error);
	}
}

// errSoap: el API marca error_soap en TODO fallo de envio (Facturalo.php:217-224),
// incluidos los rechazos reales con codigo numerico (2255, 2335). Por eso no basta
// por si solo para distinguir un problema de red - ver xEsErrorTransporteCPE.
async function xVerificarCodeResponseCPE(response, external_id = '', aceptado = null, errSoap = false) {
	// Error de TRANSPORTE: SoapFault sin ningun digito en el codigo ('HTTP' con
	// 'Bad Gateway' / 'Error Fetching http headers'). El lado del API extrae los
	// digitos del faultcode, asi que un codigo sin digitos significa que nadie en
	// SUNAT llego a evaluar el documento: no lo rechazo, no lo recibio.
	// El comprobante queda emitido en estado 01 y el cron sunat:retry-send lo
	// reenvia, por eso se avisa sin alarmar y sin mandar a soporte.
	const _codigoCpeRaw = String(response.code === undefined || response.code === null ? '' : response.code);
	if ( errSoap === true && !/\d/.test(_codigoCpeRaw) ) {
		await xRegistrarCpeError(external_id, { codigo: CPE_COD_ERROR_TRANSPORTE });
		ToastAlertSwal.fire({
			icon: 'warning',
			title: 'SUNAT no responde. Comprobante emitido, pendiente de envío.',
			timer: 6000
		});
		return false;
	}

	// Sin codigo solo se sigue si el API afirma que NO fue aceptado.
	// FIX: el API devuelve el codigo como STRING, y "0" es truthy: el guard no lo atrapaba y
	// terminaba en el toast "Obs. comprobante 0" despues de cada comprobante correcto (0 = CDR
	// aceptado sin observaciones, y no esta catalogado en sunat_errores).
	// parseInt base 10 para no confundir '0109' (transitorio real) con cero: parseInt('0109',10)=109.
	const _codigoCpe = (response.code === undefined || response.code === null) ? '' : String(response.code).trim();
	const _sinObservacion = _codigoCpe === '' || parseInt(_codigoCpe, 10) === 0;
	if (_sinObservacion && aceptado !== false) {
		return;
	}

    const codeResponseCPE = response.code;

    // Consultar directamente la tabla sunat_errores por el código
    const fetchData = new httpFecht();
    const _dataConsulta = {
        "codigo": codeResponseCPE
    };
    
    const _codeCpe = await fetchData.postJson('../../bdphp/log_009.php?op=33', _dataConsulta);
    
    if ( _codeCpe && _codeCpe.success && _codeCpe.data ) {
		const errorData = _codeCpe.data;

		// Clasificacion segun tabla sunat_errores (migracion 020):
		//  - rechazo=1 o critico=1 -> popup "comuniquese con soporte" (interrumpe)
		//  - bloquea_serie=1       -> ademas deshabilita facturacion (SOLO certificado);
		//                             un rechazo de contenido ya NO tumba las series
		//  - resto (transitorios ej. 0109, observaciones 4xxx) -> toast discreto
		// Reclasificar = UPDATE en sunat_errores, sin deploy.
		// aceptado===false gana sobre la tabla: si el API dice que SUNAT no lo
		// declaro, es rechazo aunque el codigo este catalogado como benigno.
		const isRechazo = errorData.rechazo == '1' || aceptado === false;
		const isCritico = isRechazo || errorData.critico == '1';
		const isBloqueaSerie = errorData.bloquea_serie == '1';
		const _mensajeCpe = response.description || response.message;

		// Registrar SIEMPRE en cpe_error (historial para soporte, critico o no)
		await xRegistrarCpeError(external_id, {
			"idsunat_errores": errorData.idsunat_errores,
			"codigo": response.code,
			"mensaje": _mensajeCpe
		});

		// Bloquear facturacion SOLO por errores de infraestructura (certificado digital)
		if ( isBloqueaSerie ) {
			const fetchData = new httpFecht();
			const _dataSend = {
				"tipo": "error",
				"mensaje": _mensajeCpe,
				"codigo": response.code,
			}
			await fetchData.postJson('../../bdphp/log_009.php?op=31', _dataSend);
		}

		if ( isCritico ) {
			// Requiere intervencion de soporte: interrumpe con popup
			const _titulo = isRechazo ? 'Error Crítico - Comprobante RECHAZADO' : 'Error Crítico en Facturación Electrónica';
			const _swalAlertValues = paramsSwalAlert; 
			_swalAlertValues.html = `<div class="p-1"> 
										<p class="fw-600 fs-20 text-danger">${_titulo}</p>
										<p class="fw-100 fs-14">Código: ${response.code}</p>
										<p class="fw-100 fs-14">${_mensajeCpe}</p>
										<p class="fw-600 fs-14 text-warning">Comuníquese con soporte técnico.</p>
									</div>`;
			_swalAlertValues.showCancelButton = false;
			_swalAlertValues.showConfirmButton = true;
			_swalAlertValues.confirmButtonText = 'Entendido.';

			const rptSwlalCPE = await showAlertSwalHtmlDecision(_swalAlertValues);
			if ( rptSwlalCPE.isConfirmed && isBloqueaSerie ) {
				// recarga solo si se bloqueo la facturacion, para cargar el nuevo estado
				setTimeout(() => {
					window.location.reload();
				}, 1500);
			}

			return false;
		}

		// No critico (transitorio u observacion): aviso discreto sin interrumpir al cajero
		ToastAlertSwal.fire({
			icon: 'info',
			title: `Obs. comprobante ${response.code}`,
			timer: 4000
		});

		return false;
	} else {
		// Codigo no catalogado en sunat_errores. Se registra igual contra el
		// centinela: antes estos casos no dejaban ningun rastro en cpe_error y
		// no habia forma de medirlos ni de saber que faltaba catalogarlos.
		await xRegistrarCpeError(external_id, {
			"codigo": CPE_COD_ERROR_TRANSPORTE,
			"mensaje": `${response.code}: ${response.description || response.message || ''}`
		});

		if ( aceptado === false ) {
			// Fail closed: el API afirma que SUNAT NO lo declaro. Un rechazo no
			// puede quedar en un toast de 4 segundos solo porque el codigo aun
			// no esta en la tabla (ej. 2255 "falta PaidAmount"). Se avisa igual
			// y se pide catalogarlo.
			const _swalAlertValues = paramsSwalAlert;
			_swalAlertValues.html = `<div class="p-1">
										<p class="fw-600 fs-20 text-danger">Comprobante RECHAZADO por SUNAT</p>
										<p class="fw-100 fs-14">Código: ${response.code || 'sin código'}</p>
										<p class="fw-100 fs-14">${response.description || response.message || 'SUNAT no devolvió detalle.'}</p>
										<p class="fw-600 fs-14 text-warning">Comuníquese con soporte técnico.</p>
									</div>`;
			_swalAlertValues.showCancelButton = false;
			_swalAlertValues.showConfirmButton = true;
			_swalAlertValues.confirmButtonText = 'Entendido.';

			await showAlertSwalHtmlDecision(_swalAlertValues);
			return false;
		}

		// Codigo desconocido pero sin rechazo confirmado: visible sin
		// interrumpir; queda en logs del facturador
		ToastAlertSwal.fire({
			icon: 'info',
			title: `Obs. comprobante ${response.code}`,
			timer: 4000
		});
	}
}


// chequea si is_bloqueado_facturacion de la sede esta habilitada
// sino muestra un mensaje de alerta, pidiendo que se comunique con soporte
function checkAlertCPESede() {
	try {
		
		const _sede = xm_log_get('datos_org_all_sede')[0];	
		if ( _sede.is_bloqueado_facturacion == '1' ) {
			const _swalAlertValues = paramsSwalAlert; 
			_swalAlertValues.html = `<div class="p-1">
										<p class="fw-600 fs-20 text-danger">Problemas con la facturación electrónica.</p>
										<p class="fw-100 fs-15">${_sede.msj_cpe_alert}.</p>	
										<p class="fw-100 fs-15 text-warning">Comuniquese con soporte técnico.</p>
									</div>`;
			_swalAlertValues.showCancelButton = false;
			_swalAlertValues.showConfirmButton = true;
			_swalAlertValues.confirmButtonText = 'Entendido.';
	
			showAlertSwalHtmlDecision(_swalAlertValues);
		}
	} catch (error) {
		console.error('_data', error);
	}
}
