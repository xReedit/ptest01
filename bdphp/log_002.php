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
            $obj = $_POST['data'];

            $ce_anulado = array_key_exists('anulado', $obj) ? $obj['anulado'] : 0; 
            
            $sqlCpe = "
                insert into ce (external_id, idorg, idsede, idusuario, idtipo_comprobante_serie, numero, fecha, hora, json_xml, estado_api, estado_sunat, viene_facturador, msj, anulado)
                values ('".$obj['external_id']."',".$_SESSION['ido'].",".$_SESSION['idsede'].",".$_SESSION['idusuario'].",".$obj['idtipo_comprobante_serie'].",
                '".$obj['numero']."', DATE_FORMAT(now(),'%d/%m/%Y'), DATE_FORMAT(now(),'%H:%i:%s'), '".$obj['jsonxml']."', ".$obj['estado_api'].",".$obj['estado_sunat'].",".$obj['viene_facturador'].",'".$obj['msj']."',".$ce_anulado.")";

            $idce = $bd->xConsulta_UltimoId($sqlCpe);
            
            // si el documento no es anulado // por validacion sunat
            if ( $ce_anulado === 0 ) {
                if (array_key_exists('idregistro_pago', $obj)) {
                    if ( $obj['viene_facturador'] === "1") {
                        $sqlRp= "update cpe_facturador set idce =".$idce ." where idcpe_facturador=".$obj['idregistro_pago'];
                        $bd->xConsulta_NoReturn($sqlRp);
                    } else {
                        $sqlRp= "update registro_pago set idce =".$idce ." where idregistro_pago=".$obj['idregistro_pago'];
                        $bd->xConsulta_NoReturn($sqlRp);
                    }
                }
            }

            break;
        case '101': // registra documentos que 
            $objRegistro = $_POST['data'];
            $sql = "update registro_pago_cpe set external_id_comprobante = '".$objRegistro['idexternal']."', registrado=".$objRegistro['enviado']." where idregistro_pago = ".$objRegistro['idregistro_pago'];
            $bd->xConsulta($sql);
            break;
        case '102': // registrar en cpe_facturador emitido desde facturador
            $objRegistro = $_POST['data'];
            $arrItems = $_POST['arrItems'];
            $sqlCpe="insert into cpe_facturador (idorg, idsede, idusuario, idcliente, idcomprobante, num_comprobante, fecha, subtotal, igv, total) 
                    values (".$_SESSION['ido'].",".$_SESSION['idsede'].",".$_SESSION['idusuario'].",".$objRegistro['idcliente'].",'".$objRegistro['idcomprobante']."',
                    '".$objRegistro['num_comprobante']."',now(),'".$objRegistro['jsonsubtotalXml']."','".$objRegistro['igv']."','".$objRegistro['total']."')";
            
            // echo $sqlCpe;
            $idcpe_facturador = $bd->xConsulta_UltimoId($sqlCpe);

            // detalles del comprobante
            $sql_dt_item = '';
            foreach ($arrItems as $item){
                $sql_dt_item=$sql_dt_item."(".$idcpe_facturador.",".$item['iditem'].",'".$item['descripcion']."','".$item['cantidad']."','".$item['punitario']."','".$item['ptotal']."'),";
            }
            $sql_dt_item=substr($sql_dt_item,0,-1);
            $sql_dt_item = "insert into cpe_facturador_detalle (idcpe_facturador, iditem, descripcion, cantidad, punitario, ptotal) values ".$sql_dt_item;
            $bd->xConsulta_NoReturn($sql_dt_item);

            print $idcpe_facturador;
            break;
        case '2': // actualiza el estado del compravante: si fue aceptada = 1 o fue anulada = 1
            $obj = $_POST['data'];
            $ce_anulado = array_key_exists('anulado', $obj) ? $obj['anulado'] : 0; 

            $sql = "
            update ce 
                set estado_api=".$obj['estado_api'].", 
                estado_sunat=".$obj['estado_sunat'].", 
                msj=".$obj['msj'].", 
                external_id=".$obj['external_id'].",
                numero=".$obj['numero'].",
                anulado=".$ce_anulado." 
            where idce=".$obj['idce'];
            $bd->xConsulta($sql);

            // $objRegistro = $_POST['data'];
            // $sql="update registro_pago_cpe set ".$objRegistro['campo']."=".$objRegistro['valor']." where external_id_comprobante = '".$objRegistro['idexternal']."'";
            // $bd->xConsulta($sql);
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
            // $sql="
            //     SELECT cpe.idregistro_pago_cpe, cpe.idregistro_pago, cpe.jsonxml, cpe.codsunat
            //     from registro_pago_cpe as cpe
            //         inner join registro_pago as rp on rp.idregistro_pago = cpe.idregistro_pago	
            //     where (rp.idorg = ".$_SESSION['ido']." and rp.idsede = ".$_SESSION['idsede'].") and cpe.registrado = 0
            // ";
            $sql = "SELECT * from ce where (idorg=".$_SESSION['ido']." and idsede=".$_SESSION['idsede'].") and estado_api = 1 and anulado=0";
            $bd->xConsulta($sql);
            break;
        case '4' : // guardar cpe y obtener correlativo
            $x_array_comprobante = $_POST['p_comprobante'];
            $correlativo_comprobante = 0; 
            $idtipo_comprobante_serie = $x_array_comprobante['idtipo_comprobante_serie'];
            if ($x_array_comprobante['idtipo_comprobante'] != "0"){ // 0 = ninguno | no imprimir comprobante

        
                $sql_doc_correlativo="select (correlativo + 1) as d1  from tipo_comprobante_serie where idtipo_comprobante_serie = ".$idtipo_comprobante_serie;		
                $correlativo_comprobante = $bd->xDevolverUnDato($sql_doc_correlativo);

                // guardamos el correlativo
                $sql_doc_correlativo = "update tipo_comprobante_serie set correlativo = ".$correlativo_comprobante." where idtipo_comprobante_serie = ".$idtipo_comprobante_serie;
                $bd->xConsulta_NoReturn($sql_doc_correlativo);
            } else {
                $correlativo_comprobante='0';
            }            


            print $correlativo_comprobante;
            break;
        case '5': // optiene las impresoras habilitadas para seleccionar donde se imprime el comprobante electronico
            $sql="SELECT * FROM impresora WHERE (idorg=".$_SESSION['ido']." and idsede=".$_SESSION['idsede'].") and estado=0";
            $bd->xConsulta($sql);
            break;
        default:
            # code...
            break;
    }
    
?>