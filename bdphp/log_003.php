<?php
	//log registrar el print server
	session_start();	
	header('content-type: text/html; charset: utf-8');
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	include "ManejoBD.php";
	$bd=new xManejoBD("restobar");

	date_default_timezone_set('America/Lima');

	$op = $_GET['op'];	
    switch ($op) {
		case '1': //registrar impresion
			$detalle_json = $_POST['datos'];
			$idprint_server_estructura = $_POST['idprint_server_estructura'];
			$tipo = $_POST['tipo'];
			$sql="INSERT INTO print_server_detalle (idorg, idsede, idusuario, idprint_server_estructura, descripcion_doc, fecha, hora, detalle_json) 
											values (".$_SESSION['ido'].",".$_SESSION['idsede'].",".$_SESSION['idusuario'].",".$idprint_server_estructura.", '".$tipo."', DATE_FORMAT(now(),'%d/%m/%Y'), DATE_FORMAT(now(),'%H:%i:%s'),'".$detalle_json."')";
			
			// echo $sql;
			$bd->xConsulta($sql);
			break;
		case '2': // buscar documentos no imprimidos
			$sql="SELECT psd.*, pse.estructura_json, pse.nom_documento, u.nombres as nomUs
						FROM print_server_detalle as psd
							INNER JOIN print_server_estructura as pse on pse.idprint_server_estructura = psd.idprint_server_estructura
							INNER JOIN usuario as u on u.idusuario = psd.idusuario
					where (psd.idorg=".$_SESSION['ido']." and psd.idsede=".$_SESSION['idsede'].") and psd.impreso=0 order by psd.idprint_server_detalle";
			$bd->xConsulta($sql);
			break;
		case '3': //guardar impreso=1
			$sql="update print_server_detalle set impreso=1 where idprint_server_detalle=".$_POST['id'];
			$bd->xConsulta_NoReturn($sql);
			break;
		case '4': // list estructuras
			$sql="SELECT nom_documento, v, estructura_json FROM print_server_estructura where estado=0";
			$bd->xConsulta($sql);
			break;
	}

?>