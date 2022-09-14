var xul;
var xdialog;


window.onerror = function (error, url, line) {
	console.log(error);
	// controller.sendLog({ acc: 'error', data: 'ERR:' + error + ' URL:' + url + ' L:' + line });
};

// var s = document.createElement('script');
// 	s.src = "app/web_components/webcomponentsjs/webcomponents-lite.min.js",
// 	document.head.appendChild(s);


if ('registerElement' in document && 'import' in document.createElement('link')) {
	// no polyfills needed
	console.log('no polyfills needed');
  } else {
	console.log('si necestia polyfills');	


  }

  

// $(this).one('pageshow',function(){
window.addEventListener('WebComponentsReady', function (e) {	

	this.getFrase();


	console.log(
		"Native HTML Imports?", 'import' in document.createElement('link'),
		"Native Custom Elements v0?", 'registerElement' in document, 
		"Native Shadow DOM v0?", 'createShadowRoot' in document.createElement('div'));
		
	// alert('eee');
	//$('body').addClass('loaded');
	xdialog = document.querySelector('x-dialog');
	xul=document.querySelector('x-user-login');

	
	//destruye sessuion
	// $.ajax({ type: 'POST', url: 'bdphp/log.php?op=-103'});
	// setClearLocalStorage(false);


	$("#bta").click(function(){
		var xdta=window.localStorage.getItem("::app3_woDUS");
		$.ajax({ type: 'POST', url: 'bdphp/log.php?op=-1112', data:{d:xdta}})
		.done( function (xdt) {
			// alert(xdt)
			if(xdt==='0'){
				$.ajax({ type: 'POST', url: 'bdphp/log.php?op=-1113'})
				.done( function (dt) {
					window.localStorage.setItem("::app3_woDUS", dt);
				})
			}
			//window.localStorage.setItem("::app3_woDUS", dt);
		})
	})
	/////////

	

	// xdialog.xclose();
	var t = setTimeout(function(){
		$('body').addClass('loaded');
		// setTimeout(() => {
		// 	$('.wrapper').addClass('xQuitar')
		// }, 1000);		
	},1000);

	xul.addEventListener('xSend', function (e) {

		var u=e.detail.xRpts[0].us;
		var p=e.detail.xRpts[0].p;
		var c=e.detail.xRpts[0].co;

		xdialog.xopen();
		// alert(JSON.stringify(e.detail));
		
		switch(xul.xop){
			case 1://
				break;
			case 2:
				// localStorage.removeItem('::app3_woDUS');

				$.ajax({ type: 'POST', url: 'bdphp/log.php?op=-1', data:{u:u, p:p}})
				.done( function (dt) {
					if(dt==1){
						var printL = window.localStorage.getItem('::app3_woIpPrintLoC');

						
						//destruye sessuion // anterior
						// $.ajax({ type: 'POST', url: 'bdphp/log.php?op=-103'})
						// .done(res => {
							setClearLocalStorage(false);
							window.location = 'app/page/m_panel.html';
							if (printL) {window.localStorage.setItem('::app3_woIpPrintLoC', printL)};
						// });
						// window.localStorage.clear();
						// document.location.href='app/page/m_panel.html';
						// location.href='app/page/m_panel.html';
						// confirm('eee');
						// if ((navigator.userAgent.match(/iPhone/i)) || (navigator.userAgent.match(/iPod/i))) {
						// 	alert('ipod / ipad')
						// 	location.replace("app/page/m_panel.html");
						//  } else {
						// 	location.href='app/page/m_panel.html';
						//  }
						// window.Headers

					}else{
						xdialog.xclose();
						//alert('Usuario o clave incorrecto');
						xul.xocurrencia(0);
					}
				});
				break;
			case 3://registrar
				//verificar disponibilidad usuario
				$.ajax({ type: 'POST', url: 'bdphp/log.php?op=-3', data:{u:u}})
				.done( function (dt) {
					if(dt==1){
						xdialog.xclose();
						xul.xocurrencia(1);
					}else{
						$.ajax({ type: 'POST', url: 'bdphp/log.php?op=-301', data:{u:u, p:p, c:c}})
						.done( function (dt) {
							$.ajax({ type: 'POST', url: 'bdphp/log.php?op=-1', data:{u:u, p:p}})
							document.location.href='app/page/m_panel.html';
						})
					}
				})
				break;
			}
	});
});

function getFrase() {
	fetch('bdphp/log_005.php?op=100')
	.then(res => {
		return res.json();
	}).then(res => {
		const data = res.datos[0];		
		$('#lbl-frase').text(data.frase);
		$('#lbl-autor').text('- ' + data.autor);		
	});
}


// (function() {
// 	if ('registerElement' in document
// 		&& 'import' in document.createElement('link')
// 		&& 'content' in document.createElement('template')) {
// 	  // platform is good!
// 	} else {
// 	  // polyfill the platform!
// 	  var e = document.createElement('script');
// 	  e.src = './app/web_components/webcomponentsjs/webcomponents-lite.min.js';
// 	  document.body.appendChild(e);
// 	}
//   })();
