<?php
    //log registrar peidod y pago
    
    session_start();
	//header("Cache-Control: no-cache,no-store");
	header('content-type: text/html; charset: utf-8');
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	include "ManejoBD.php";
	$bd=new xManejoBD("restobar");

    date_default_timezone_set('America/Lima');
    
    switch($_GET['op'])
	{
        case 1:// load sedes
            $sql = "select idsede, nombre from sede where idorg = ".$_SESSION['ido']." and estado=0 ";
            $bd->xConsulta($sql);
            break;
        case 2:// load comprobantes generales
            $sql = "SELECT * FROM tipo_comprobante where estado=0";
            $bd->xConsulta($sql);
            break;
    }