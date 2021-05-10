// notifica acciones del cliete desde pwa
// pago de cuenta y Solicitar atencion
var pAudioNotifica;


function pNotificaPago(res) {

  var hora = pTimeNow();

  var _datos = {
    nummesa: res.mesa,
    nom_cliente: res.objCliente.nombres,
    importe: parseFloat(res.importe).toFixed(2),
    brand: res.objTransaction.brand,
  };

	if (typeof window.stackBottomRight === 'undefined') {
    window.stackBottomRight = {
      'dir1': 'up',
      'dir2': 'left',
      'firstpos1': 25,
      'firstpos2': 25
    };
  }

  if ( !res.objTransaction.error ) {
    var canalPedido = _datos.nummesa ? ' La Mesa ' + xCeroIzq(_datos.nummesa, 2) : '';
    canalPedido = canalPedido === '' ? res.isdelivery ? ' Pedido Delivery ' : ' Pedido Para LLevar ' : canalPedido;

    PNotify.success({
      title: 'Pago por Aplicacion',
      text: hora + '<strong>' + canalPedido + '</strong> <p>'+ _datos.nom_cliente +'</p><p> Pagó con tarjeta desde la aplicación el importe de: <strong>S/. '+ _datos.importe  +'</strong> </p>',
      textTrusted: true,
      // icon: 'fas fa-info-circle',
      hide: false,
      stack: window.stackBottomRight,
      modules: {
        Confirm: {
          confirm: true,
          buttons: [{
            text: 'Listo',
            primary: true,
            click: function(notice) {
              notice.close();
            }
          }]
        },
        // Buttons: {
        //   closer: false,
        //   sticker: false
        // },
        // History: {
        //   history: false
        // }
      }
    });
} else {

  // error de pago

  var pagoError = PNotify.error({  
    // text: ''+ hora + ' Mesa <span><strong>'+ _datos.nummesa +'</strong> solicita atención.',
    text: '<strong>Pago Denegado.</strong><br><strong>' + res.objTransaction.descripcion + '</strong> mesa <strong>' + _datos.nummesa + '</strong> '+ _datos.nom_cliente +' Esta intentanto pagar <strong> S/. '+ _datos.importe  +'</strong>',
    textTrusted: true,  
    hide: false,
    stack: window.stackBottomRight,
    modules: {
      History: {
        maxInStack: 5
      }
    } 
  });  

  pagoError.on('click', function() {
  	pagoError.close();
	});

}


// PlaySound('../../sound/notifica-pago.mp3');
PlaySound('notificaPagoCliente');

}


function pNotificaPersonal(mesa) {
  var hora = pTimeNow();

	if (typeof window.stackBottomRight === 'undefined') {
    window.stackBottomRight = {
      'dir1': 'up',
      'dir2': 'left',
      'firstpos1': 25,
      'firstpos2': 25
    };
  }

  var notice = PNotify.notice({  
    text: ''+ hora + ' Mesa <span><strong>'+ mesa +'</strong> solicita atención.',
    textTrusted: true,  
    hide: false,
    stack: window.stackBottomRight,
    modules: {
      History: {
        maxInStack: 5
      }
    } 
  });  

  notice.on('click', function() {
  	notice.close();
	});


  // PlaySound('../../sound/notifica-llamado.mp3');
  PlaySound('notificaLlamadoCliente');

}


// notifica nuevo pedido desde el app
function pNotificaNuevoPedido(pedido) {
  // solo notifica pedidos de clientes desde app
  if ( !pedido ) {return; }
  if ( !pedido.p_header ) {return; }
  if ( pedido.p_header.isCliente === 0 ) {return; }

  pedido.p_header.m = pedido.p_header.m ? pedido.p_header.m : '';
  
  // tipo // delivery // llevar
  var nomCliente = pedido.p_header.r;
  var iconPedido = pedido.p_header.delivery === 1 ? 'fa fa-motorcycle' : 'fa fa-shopping-bag';
  var canalPedido = pedido.p_header.delivery === 1 ? 'Delivery' : 'Para LLevar';
  canalPedido = pedido.p_header.m === '' ? canalPedido : 'Mesa ' + xCeroIzq(pedido.p_header.m, 2);
  iconPedido = pedido.p_header.m === '' ? iconPedido : 'fa fa-cutlery';

  var importePedido = pedido.p_subtotales[pedido.p_subtotales.length - 1].importe;


  
  var hora = pTimeNow();



	if (typeof window.stackBottomRight === 'undefined') {
    window.stackBottomRight = {
      'dir1': 'up',
      'dir2': 'left',
      'firstpos1': 25,
      'firstpos2': 25
    };
  }

  var notice = PNotify.notice({  
    text: hora + ' Pedido APP <span><strong>'+ canalPedido + ' <i class="' + iconPedido + '"></i></strong>' +
          '<p>' + nomCliente + ' <span><strong> S/.'+ importePedido + '</strong></p>',
    textTrusted: true,  
    delay: 30000,
    closer: true,
    stack: window.stackBottomRight,
    modules: {
      History: {
        maxInStack: 5
      }
    } 
  });  

  notice.on('click', function() {
  	notice.close();
	});


  // PlaySound('../../sound/notifica-llamado.mp3');
  PlaySound('notificaNuevoPedido');

}


function pTimeNow() {
  var d = new Date(),
    h = (d.getHours()<10?'0':'') + d.getHours(),
    m = (d.getMinutes()<10?'0':'') + d.getMinutes();
  return h + ':' + m;
}



function PlaySound(Path){

  pAudioNotifica=document.getElementById(Path);
  pAudioNotifica.autobuffer = true;
  pAudioNotifica.muted = false;
  pAudioNotifica.load();
  pAudioNotifica.play();
	

  // var audioElement = document.createElement('audio');
  // if (navigator.userAgent.match('Firefox/'))
  //     audioElement.setAttribute('src', Path);
  // else
  //     audioElement.setAttribute('src', Path);
  

  // $.get();
  // audioElement.addEventListener("load", function() {
  //     audioElement.play();
  // }, true);

  // audioElement.pause();
  // audioElement.play();
}