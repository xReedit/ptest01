$(document).ready(function() {
	setTimeout(() => {
		$("body").addClass("loaded");
		xInitPrintServer();
	}, 1000);		
});

let ListDocs = [];
function xInitPrintServer() {
	$.ajax({
		url: '../bdphp/log_003.php?op=2',
		type: 'POST',		
	})
	.done((res) => {
		const _res = $.parseJSON(res);
		ListDocs = _res.datos;

		let cadena_tr = '';
		ListDocs.map((x, index) => {
			index++;
			cadena_tr += '<tr id='+index+'>'+
				'<td>'+ index +'</td>'+
				'<td>' + x.hora + '</td>' +
				'<td>' + x.descripcion_doc + '</td>' +
				'<td>estado</td>' +
			'</tr>';
		});

		$("#listDoc").append(cadena_tr).trigger('create');
	});	  
}

function xSendPrint() {
	const _listSend = ListDocs.map((x)=> {
		const _detalle_json = JSON.parse(x.detalle_json);
		const _nomUs = x.nomUs.split(' ')[0]; // -> viene de session		
		return { data: _detalle_json, nom_documento: x.nom_documento, nomUs:_nomUs };
	});

	$.ajax({
		url: 'http://192.168.1.64/restobar/print/client/pruebas.print_url.php',
		type: 'POST',
		data: { arrData: _listSend }
	})
	.done((res) => {
		console.log(res);
	});	
}

function xUpdateEstructuras() {
	$.ajax({
		url: '../bdphp/log_003.php?op=4',
		type: 'POST',		
	})
	.done((res) => {
		const _res = $.parseJSON(res);		
		let listEstructuras = _res.datos;

		$.ajax({
			url: 'http://192.168.1.64/restobar/print/client/comprobar_estructura.php',
			type: 'POST',
			data: { arrEstructura: listEstructuras}
		})
		.done((res) => {
			console.log(res);
		});	

	});
}