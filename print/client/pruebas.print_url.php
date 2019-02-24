<?php
date_default_timezone_set('America/Lima');	

require __DIR__ . '/autoload.php';
use Mike42\Escpos\Printer;
use Mike42\Escpos\EscposImage;
use Mike42\Escpos\ImagickEscposImage;
use Mike42\Escpos\PrintConnectors\WindowsPrintConnector;


// header('Access-Control-Allow-Origin: *');  

//require_once('https://papaya.com.pe/p.php'); 
//$file = file_get_contents('pruebas2.txt'); 
//echo $file;

$arrData = $_POST['arrData'];

foreach ($arrData as $item) {
	
	$data=$item['data'];	
	$nom_file=$item['nom_documento'].".txt";
	$nom_us=$item['nomUs'];
	$estructura = file_get_contents($nom_file);
    eval($estructura);

    // echo "paso";

	// echo file_get_contents($nom_file);
}

// eval($estructura);

//$aa = $_POST['ip_print'];
//echo json_encode($aa); 
//eval(file_get_contents('https://papaya.com.pe/p.txt'));


?>