<?php
    //log comprobantes electronicos
    session_start();
	//header("Cache-Control: no-cache,no-store");
	header('content-type: text/html; charset: utf-8');
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	include "ManejoBD.php";
	$bd=new xManejoBD("restobar");

	date_default_timezone_set('America/Lima');
	
    $op = $_POST['op'];

    switch ($op) {
        case '1': //registrar envio cpe 
            $objRegistro = $_POST['data'];
            $sqlRp= "update registro_pago set external_id_comprobante = '".$objRegistro['idexternal']."' where idregistro_pago=".$objRegistro['idregistro_pago'];

            // registra comprobante
            $sqlCpe="insert into registro_pago_cpe (idregistro_pago, external_id_comprobante, fecha, jsonxml, registrado) values (".$objRegistro['idregistro_pago'].",'".$objRegistro['idexternal']."',DATE_FORMAT(now(),'%d/%m/%Y'),'".$objRegistro['jsonXml']."',".$objRegistro['enviado'].")";
            $sql = $sqlRp."; ".$sqlCpe;
            echo $sql;
            $bd->xMultiConsulta($sql);
            break;
        case '2': // actualiza el estado del compravante: si fue aceptada = 1 o fue anulada = 1
            $objRegistro = $_POST['data'];
            $sql="update registro_pago_cpe set ".$objRegistro['campo']."=".$objRegistro['valor']." where external_id_comprobante = '".$objRegistro['idexternal']."'";
            $bd->xConsulta($sql);
        case '201': // actualiza el estado de las boletas enviadas segun fecha // y registrar en cpe_resumen_boletas
            $objRegistro = $_POST['data'];
            // registra resumen
            $sqlResumen = "insert into cpe_resumen_boletas (fecha, id, ticket, msj, registrado) values ('".$objRegistro['fecha']."', ".$objRegistro['id'].",'".$objRegistro['ticket']."','".$objRegistro['msj']."',1)";
            // cambia de estado aceptdo a todas las boletas segun fecha
            $sql="update registro_pago_cpe set ".$objRegistro['campo']."=".$objRegistro['valor']." where fecha = '".$objRegistro['fecha']."'";
            $sql = $sqlResumen."; ".$sql;         
            $bd->xMultiConsulta($sql);
        default:
            # code...
            break;
    }
    
?>