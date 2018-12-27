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
            $sqlCpe="insert into registro_pago_cpe (idregistro_pago, external_id_comprobante, codsunat, fecha, jsonxml, registrado) 
                                            values (".$objRegistro['idregistro_pago'].",'".$objRegistro['idexternal']."',
                                            '".$objRegistro['codsunat']."',DATE_FORMAT(now(),'%d/%m/%Y'),'".$objRegistro['jsonXml']."',".$objRegistro['enviado'].")";
            $sql = $sqlRp."; ".$sqlCpe;            
            $bd->xMultiConsulta($sql);
            break;
        case '101': // registra documentos que generaron algun error
            $objRegistro = $_POST['data'];
            $sql = "update registro_pago_cpe set external_id_comprobante = '".$objRegistro['idexternal']."', registrado=".$objRegistro['enviado']." where idregistro_pago = ".$objRegistro['idregistro_pago'];
            $bd->xConsulta($sql);
            break;
        case '2': // actualiza el estado del compravante: si fue aceptada = 1 o fue anulada = 1
            $objRegistro = $_POST['data'];
            $sql="update registro_pago_cpe set ".$objRegistro['campo']."=".$objRegistro['valor']." where external_id_comprobante = '".$objRegistro['idexternal']."'";
            $bd->xConsulta($sql);
            break;
        case '201': // actualiza el estado de las boletas enviadas segun fecha // y registrar en cpe_resumen_boletas
            $objRegistro = $_POST['data'];
            // registra resumen
            $sqlResumen = "insert into cpe_resumen_boletas (fecha, id, ticket, msj, registrado) values ('".$objRegistro['fecha']."', ".$objRegistro['id'].",'".$objRegistro['ticket']."','".$objRegistro['msj']."',1)";
            // cambia de estado aceptdo a todas las boletas segun fecha
            $sql="update registro_pago_cpe set ".$objRegistro['campo']."=".$objRegistro['valor']." where fecha = '".$objRegistro['fecha']."'";
            $sql = $sqlResumen."; ".$sql;         
            $bd->xMultiConsulta($sql);
            break;
        case '3': // consulta de boletas que fueron registradas pero no aceptadas(por cualquier motivo), devuelve fechas no aceptadas
            $sql="
                select DATE_FORMAT(STR_TO_DATE(cpe.fecha, '%d/%m/%Y'), '%Y-%m-%d') as fecha
                from registro_pago_cpe as cpe
                    inner join registro_pago as rp on rp.idregistro_pago = cpe.idregistro_pago	
                where (rp.idorg = ".$_SESSION['ido']." and rp.idsede = ".$_SESSION['idsede'].") and cpe.codsunat = '03' and cpe.aceptado = '0'
                group by fecha
                order by fecha
            ";
            $bd->xConsulta($sql);
            break;
        case '301': // lista documentos no registrados - documnentos que no fueron enviados al servicio api por algun error de conexion
            $sql="
                SELECT cpe.idregistro_pago_cpe, cpe.idregistro_pago, cpe.jsonxml, cpe.codsunat
                from registro_pago_cpe as cpe
                    inner join registro_pago as rp on rp.idregistro_pago = cpe.idregistro_pago	
                where (rp.idorg = ".$_SESSION['ido']." and rp.idsede = ".$_SESSION['idsede'].") and cpe.registrado = 0
            ";
            $bd->xConsulta($sql);
            break;
        default:
            # code...
            break;
    }
    
?>