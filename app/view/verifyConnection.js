var comprobantdoConexion = false;
var restaurandoConexion = false;
var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
var type = connection.effectiveType;
var _num_intentos_conexion = 0;

// setGalleta();

window.addEventListener("focus", function (event) {
	console.log('focus windows');
	// diferencia en minutos de tiempo de inactividad
	const _now_date = new Date();
	const _date_bk = new Date(getLocalStorage('::app3_sys_backup_time'));
	const _minDiff = Math.round((_now_date.getTime() - _date_bk.getTime()) / 60000);
	if (_minDiff < 3) return;

	setTimeout(() => {
		updateConnectionStatusFocus();
	}, 3000);
});

$(window).blur(function () {
	console.log('blur');
	bkLocalStorage();
})


async function updateConnectionStatusFocus() {
	var rpt_conex = await comprobarConexion();
	if (rpt_conex) {		
		const _data_res = xm_log_get('app3_us')._sys_sessid;
		const _restore_conex = await restoreConexion(_data_res);
		if (_restore_conex) {
			// recuperar localstorage
			resotreLocalSotrage();	
			xm_all_xToastOpen('Verificando conexion', 2000);
			console.log('restablecio la conexion focus');		
		}
	}
}



async function updateConnectionStatus() {
	// comprobar conexion con una peticion			
	if (_num_intentos_conexion > 1) {
		_num_intentos_conexion = 0;
		return;
	}

	if ( !comprobantdoConexion ) {
		const _sys_no_conect = getLocalStorage('::app3_sys_no_conex') || false; // si en algun momepnto se desconecto esta ventana		
		var rpt_conex = await comprobarConexion();
		
		if (!rpt_conex) { // si es falso me evalua 2 veces, puede que tarde en conectar
			setTimeout(() => {	
				_num_intentos_conexion++;
				updateConnectionStatus();
				return;
			}, 2500);
		}

		// console.log('estado conexion ', rpt_conex);

		if (!rpt_conex) {
			// recoger datos
			// bk local storage
			console.log('estado conexion ', rpt_conex);			
			console.log('localstorage -> ', (getLocalStorage('::app3_woDUS')));
			setLocalSotrage('::app3_sys_no_conex', true);
			bkLocalStorage();
		} else {
			// enviar datos y tratar de restablecer la conexion
			// restaurarGalleta();
			if (!_sys_no_conect) return;
			removeLocalStorage('::app3_sys_no_conex');

			const _data_res = xm_log_get('app3_us')._sys_sessid;
			xm_all_xToastOpen('Recuperando conexion',3000);
			const _restore_conex = await restoreConexion(_data_res);
			
			if (_restore_conex) {
				// recuperar localstorage
				resotreLocalSotrage();
				removeLocalStorage('::app3_sys_no_conex');
			}
			console.log('estado conexion ', rpt_conex);
			
		}
	}

}

connection.addEventListener('change', activarChangeConection);

function activarChangeConection() {
	setTimeout(() => {
		updateConnectionStatus();
	}, 3000);
}

async function comprobarConexion() {
	var rpt_conex = false;
	comprobantdoConexion = true;
	await fetch('../../bdphp/log_run.php?op=3')
	.then(function (response) {
		return response
	})
	.then(res => {
		// console.log('online: ', res);
		rpt_conex = true;		
	}).catch(function (error) { // error de conexion
		rpt_conex = false;
		// console.log('offline');		
	});

	comprobantdoConexion = false;
	return rpt_conex;
}

async function restoreConexion(_data) {	
	restaurandoConexion = false;
	await $.ajax({
		type: 'POST',
		url: '../../bdphp/log.php?op=-1',
		data: {			
			sys_data: _data
		}
	})
    .done( function (res) {
        console.log('restaurando');
		restaurandoConexion = true;
    });

	return restaurandoConexion;
}

