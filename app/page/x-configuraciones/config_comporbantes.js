var idSedeSel = 0; 
var idComprobanteSel = 0; 

function config_comprobante_add(){
    $("#form_emision_comprobante #idsede").val(idSedeSel);
	$("#form_emision_comprobante #idtipo_comprobante").val(idComprobanteSel);
	xPopupLoad.xopen();
	$.post("../../bdphp/ManejoBD_IUD.php?tb=tipo_comprobante_serie",$("#form_emision_comprobante").serialize(),function(a){
        xPopupLoad.xclose();
        const idorg = $("#form_emision_comprobante #idorg").val();
        $("#form_emision_comprobante").reset();
        $("#form_emision_comprobante #idorg").val(idorg);
		xPopupLoad.xclose();
	    config_comprobante_getall();
	})
}

function config_comprobante_getall() {
    $("#tb_emision_comprobantes .row").remove();
    $("#tb_emision_comprobantes").append('<tr class="row"><td colspan="4"><paper-spinner active></paper-spinner></td></tr>');
    
    $.ajax({ type: 'POST', url: '../../bdphp/log.php?op=1607'})
	.done( function (dtComprobante) {
        var xdtComprobante=$.parseJSON(dtComprobante);
		var xcadena_tr_comp='';


        xdtComprobante=xdtComprobante.datos;
        xdtComprobante.map(x => {
            // xcadena_sel_sede=String(xcadena_sel_sede+ '<option value='+x[i].idsede+'>'+x[i].dsc_sede+'</option>');
            // xcadena_sel_comprobante=String(xcadena_sel_comprobante+ '<option value='+x[i].idtipo_comprobante+'>'+x[i].dsc_comprobante+'</option>');

            xcadena_tr_comp=String(xcadena_tr_comp+'<tr class="row" data-id="'+x.idtipo_comprobante_serie+'" data-t="tipo_comprobante_serie"><td>'+x.dsc_sede+'</td>'+
                '<td>'+x.dsc_comprobante+'</td>'+
                '<td>'+x.serie+'</td>'+
                '<td>'+x.correlativo+'</td>'+
                '<td><span class="xDeleteRow" title="Borrar" onclick="xBorrarItem(this);"></span></td>'+
				'</tr>')
        })

        $("#tb_emision_comprobantes .row").remove();
		$("#tb_emision_comprobantes").append(xcadena_tr_comp).trigger('create');
		// $("#tb_emision_comprobantes").html(xcadena_sel_almacen_file).trigger('create');

    })
}

function _getSede($event) {
    console.log('llego: ', $event);
    this.idSedeSel = $event.idsede;
}

function _getComprobante($event) {
    console.log('llego: ', $event);
    this.idComprobanteSel = $event.idtipo_comprobante;
}