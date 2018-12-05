<?php
session_start();
date_default_timezone_set('America/Lima');	

require __DIR__ . '/autoload.php';
use Mike42\Escpos\Printer;
use Mike42\Escpos\EscposImage;
use Mike42\Escpos\PrintConnectors\NetworkPrintConnector;
use Mike42\Escpos\PrintConnectors\WindowsPrintConnector;

$ArraySubTotales=$_POST['ArraySubTotales'];
$ArrayItem=$_POST['ArrayItem'];
$ArrayEnca=$_POST['Array_enca'];
$xArray_print=$_POST['Array_print'];
$xArrayComprobante = $_POST['ArrayComprobante'];
$xArrayCliente = $_POST['ArrayCliente'];

$ip_printer=$xArray_print[0]['ip_print'];

if($ip_printer===''){return;}
try {
	//por ip o por usb
	$impresora_print=$ip_printer;
	$pos_print=strrpos($impresora_print,'//');
	if($pos_print===false){
		$connector = new NetworkPrintConnector($impresora_print);
	}else{
		$impresora_print='smb:'.$impresora_print;
		$connector = new WindowsPrintConnector($impresora_print);
	}
	
	$printer = new Printer($connector);	
} catch (Exception $e) {
	print 'Error, Verifique que la ticketera este prendida y que tenga papel.';
	return;
}


$logo_post="./logo/".$xArray_print[0]['logo'];
// $num_mesa=$ArrayEnca['m'];
// $num_pedido=$ArrayEnca['num_pedido'];
// $correlativo_dia=$ArrayEnca['correlativo_dia'];
// $referencia=$ArrayEnca['r'];
// $reservar=$ArrayEnca['reservar'];
// $solo_llevar=$ArrayEnca['solo_llevar'];
// $pre_cuenta=!empty($ArrayEnca['precuenta']) ? $ArrayEnca['precuenta'] : '';
// $logo_solo_llevar="_ico_solo_llevar2.png";

// encabezado
$nom_empresa = $ArrayEnca[0]['nombre'];
$ruc_empresa = $ArrayEnca[0]['ruc']; 
$hash = $ArrayEnca[0]['hash'];
$direccion_empresa = $ArrayEnca[0]['sededireccion'];
$ciudad_empresa = $ArrayEnca[0]['sedeciudad'];
$telefono_empresa = $ArrayEnca[0]['sedetelefono'];


$nom_us=explode(' ',$_SESSION['nomUs']);
$fecha_actual=date('d').'/'.date('m').'/'.date('y');
$hora_actual=date('H').':'.date('i').':'.date('s');
$sum_total=0;
$num_copias=$xArray_print[0]['num_copias'];
$cuenta_copias=0;

//configuracion de la impresora //margen font
$var_margen_iz=(int)$xArray_print[0]['var_margen_iz'];
$var_size_font=(int)$xArray_print[0]['var_size_font'];
$var_margen_iz=intLowHigh($var_margen_iz, 2);
$local = (int)$xArray_print[0]['local'] || 0;
//			

$connector->write(Printer::GS.'L'.$var_margen_iz);			
$printer -> setFont($var_size_font);
//---------------////////////////

// el hash define si es CPE
$denominacion_comprobante = "COMPROBANTE";
$incial_comprobante = "";
if ($hash) {
	$denominacion_comprobante = "COMPROBANTE ELECTRONICO";
	$incial_comprobante = $xArrayComprobante['inicial'];
}

// if($num_mesa=='' || $num_mesa=='00'){$num_mesa='Pedido: '.$correlativo_dia;}else{$num_mesa='MESA: '.$num_mesa;}

$precio='';

while($num_copias>=0){

	// if($cuenta_copias>0 && $pre_cuenta!=true){
	// 	$printer -> setJustification(Printer::JUSTIFY_CENTER);
	// 	$printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);
	// 	$printer -> text("****** COPIA ******\n");
	// 	$printer -> selectPrintMode();
	// }

	

	/*num pedido*/
	// $printer -> selectPrintMode();	
	// $printer -> setJustification(Printer::JUSTIFY_CENTER);
	// $printer -> setEmphasis(true);
	// $printer -> text('CO-'.$correlativo_dia."\n");
	// $printer -> setEmphasis(false);
	/* Print top logo */
	if($logo_post!=''){
		$logo = EscposImage::load($logo_post, false);
		$printer -> setJustification(Printer::JUSTIFY_CENTER);
		$printer -> graphics($logo);
	}	

	/* ENCABEZADO */
    $printer -> setJustification(Printer::JUSTIFY_CENTER);
	$printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);
    $printer -> text($nom_empresa."\n");
    $printer -> selectPrintMode();
    $printer -> text("RUC: ".$ruc_empresa."\n");
    $printer -> text($direccion_empresa."\n");
    $printer -> text($ciudad_empresa."\n");
    $printer -> text("Telefono: ".$telefono_empresa."\n");
	$printer -> selectPrintMode();
	$printer -> text("------------------------------------------------\n");
    $printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);
	$printer -> text($denominacion_comprobante."\n");
	$printer -> text($xArrayComprobante['descripcion']." ".$incial_comprobante.$xArrayComprobante['serie']."-".$xArrayComprobante['correlativo']."\n");
	$printer -> selectPrintMode();
    $printer -> text("------------------------------------------------\n");
	$printer -> feed();

	// cliente, fecha
	$cliente_nombres = $xArrayCliente['nombres'] === "" ? "PUBLICO EN GENERAL" : $xArrayCliente['nombres'];
	$cliente_direcicon = $xArrayCliente['direccion'];
	$cliente_num_doc = $xArrayCliente['num_doc'];
	$cliente_documento = strlen($cliente_num_doc) > 8 ? 'RUC' : 'DNI';

	$printer -> setJustification(Printer::JUSTIFY_LEFT);
	$printer -> selectPrintMode();
	$printer -> text("FECHA DE EMISION: ".$fecha_actual.' | '.$hora_actual. "\n");
	
	$printer -> text("CLIENTE: ".$cliente_nombres. "\n");	
	if ($cliente_num_doc.trim() !== ""){ $printer -> text($cliente_documento.": ".$cliente_num_doc. "\n"); }	
	if ($cliente_direcicon.trim() !== ""){ $printer -> text("DIRECCION: ".$cliente_direcicon. "\n"); }	
	
	$printer -> selectPrintMode();
	$printer -> text("------------------------------------------------\n");
	$printer -> feed();


	/* CUERPO , ITEMS*/
	$si_tiene_item=0;
	$cuenta_row=0;
	$cuenta_tpc=0;
	$tipo_consumo='';
	$indicaciones_item='';
	$des_part2='';
	$sum_total=0;

	foreach ($ArrayItem as $item) {
		if($item==null){continue;}

		$tipo_consumo=$item["seccion"];
		/*$printer -> setEmphasis(true);
		$printer -> text($item["des"]."\n");
		$printer -> text("------------------------------------------------\n");
		$printer -> setEmphasis(false);*/
		
		$si_tiene_item=0;
		$cuenta_row=0;
		$seccion='';
		$des_part2='';
		//$sum_total=0;
		usort($item, "cmp");

		//ordena por donde procede 0 de la carta(sigue el orden) !=0 bodega
		foreach ($item as $key => $row) {
		    $procede[$key]  = !empty($row['procede_index']) ? $row['procede_index'] : '';
		    $or_des_seccion[$key]  = !empty($row['des_seccion']) ? $row['des_seccion'] : ''; 
		}
		array_multisort($procede, SORT_ASC,$or_des_seccion, SORT_ASC, $item);		
		
		foreach ($item as $subitem) {
			if(is_array($subitem)==false){continue;}
			if($subitem['cantidad']==0){continue;}			
			
			/*titulo tipo consumo*/		
			if($si_tiene_item==0){			
				$printer -> setJustification(Printer::JUSTIFY_CENTER);								
				$printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);
				$printer -> selectPrintMode(Printer::MODE_UNDERLINE);
				$printer -> setEmphasis(true);			
				if($cuenta_tpc>0){$printer -> text("\n\n");}
				$printer -> text("*** ".$tipo_consumo." ***\n");
				//$printer -> text("------------------------------------------------\n");
				$printer -> setEmphasis(false);
				$printer -> selectPrintMode();
				$cuenta_tpc++;
			}


			$si_tiene_item=1;
			$printer -> setJustification(Printer::JUSTIFY_LEFT);
			$printer -> setEmphasis(true);	
			if($seccion!=$subitem["des_seccion"]){			
				if($cuenta_row>0){$printer -> text("\n");}	
				$seccion=$subitem["des_seccion"];
				$printer -> text($seccion."\n");
				$printer -> text("------------------------------------------------\n");	
				$printer -> setEmphasis(false);
				$cuenta_row++;
			}		
			
			$printer -> setEmphasis(false);
			$precio=$subitem["precio_print"];
			$indicaciones_item=$subitem["indicaciones"];
			if($indicaciones_item!=''){$indicaciones_item='('.$indicaciones_item.')';}
			if($precio==''){$precio=$subitem["precio_total"];}
			$r_subitem=$subitem["cantidad"].' '.$subitem["des"].$indicaciones_item;
			$des_part2='';
			$des_part3='';
			if(strlen($r_subitem) > 35){
				$des_part2='  '.substr($r_subitem,35,strlen($r_subitem));
				$r_subitem=substr($r_subitem,0,35)."-";			
			}
			if(strlen($des_part2) > 35){
				$des_part3='  '.substr($des_part2,35,strlen($des_part2));
				$des_part2=substr($des_part2,0,35)."-";			
			}
			//$r_subitem = strlen($r_subitem) > 35 ? substr($r_subitem,0,35)."..." : $r_subitem;

			$sum_total=(float)$sum_total+(float)$precio;
			$printer -> text(new item($r_subitem, $precio));
			if($des_part2!=''){$printer -> text(new item($des_part2, ''));}
			if($des_part3!=''){$printer -> text(new item($des_part3, ''));}
		}	
	}

	/* TOTALES */
	$printer -> feed();
	$printer -> text("------------------------------------------------\n");
	$printer -> setEmphasis(true);
	$r_subt_t=0;		
	/*foreach ($xArray_print as $item) {
		if($item['des_detalle']==''){continue;}
		$r_subt=$item['porcentaje']/100;
		$r_subt=$sum_total*$r_subt;
		$r_subt_t=$r_subt_t+$r_subt;
		$r_subt=number_format($r_subt, 2, ".", "");
		$printer -> text(new item($r_subitem, $r_subt));
	}
	$sum_total=$sum_total+$r_subt_t;
	$sum_total=number_format($sum_total, 2, ".", "");

	$printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);
	$printer -> text(new item('Total', $sum_total, true));
	$printer -> selectPrintMode();*/
	
	//	
	foreach ($ArraySubTotales as $item_sbt) {//
		if($item_sbt['visible']=='false'){continue;}
		$des_sbt=$item_sbt['descripcion'];//
		$imp_sbt=$item_sbt['importe'];//

		if($des_sbt=='Total'){
			$printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);
			$printer -> text(new item($des_sbt, $imp_sbt, true));
			$printer -> selectPrintMode();
			
			$printer -> feed(1);
			$printer -> text("SON: ".$item_sbt['importe_letras']."\n");
			continue;			
		}
		
		$printer -> text(new item($des_sbt, $imp_sbt));
	}
	//

	/* CODIGO QR */	
	$printer -> feed();
	if ( $hash !== "" ) { // si hay hash significa que no es factura electronica
		$testStr = $hash;
		$printer -> setJustification(Printer::JUSTIFY_CENTER);
		$printer -> qrCode($testStr, Printer::QR_ECLEVEL_L, 5);	
		$printer -> feed();
	
		/* PIE DE PAGINA */	
		$printer -> setJustification(Printer::JUSTIFY_LEFT);
		$printer -> text($xArray_print[0]['pie_pagina_comprobante']."\n");
		$printer -> feed();
	}

	/* PIE DE PAGINA */	
	// $printer -> setJustification(Printer::JUSTIFY_LEFT);
	// $printer -> text($xArray_print[0]['pie_pagina_comprobante']."\n");
	// $printer -> feed();
	$printer -> setJustification(Printer::JUSTIFY_CENTER);
	$printer -> text($xArray_print[0]['pie_pagina']."\n");
	$printer -> feed(2);
	$printer -> text("Atendido por:".$nom_us[0]."\n");
	$printer -> text($fecha_actual.' | '.$hora_actual. "\n");

	$printer -> text("www.papaya.com.pe\n");
	$printer -> cut();
	$printer -> pulse();

	$num_copias--;
	$cuenta_copias++;
}

$printer -> close();

class item
{
    private $name;
    private $price;
    private $dollarSign;

    public function __construct($name = '', $price = '', $dollarSign = false)
    {
        $this -> name = $name;
        $this -> price = $price;
        $this -> dollarSign = $dollarSign;
    }

    public function __toString()
    {
        $rightCols = 10;
        $leftCols = 38;
        if ($this -> dollarSign) {
            $leftCols = $leftCols / 2 - $rightCols / 2;
        }
        $left = str_pad($this -> name, $leftCols) ;

        $sign = ($this -> dollarSign ? 'S/. ' : '');
        $right = str_pad($sign . $this -> price, $rightCols, ' ', STR_PAD_LEFT);
        return "$left$right\n";
    }
}

function cmp($a, $b)
{
	if(is_array($a)==false){return;}
    return strcmp($a["des_seccion"], $b["des_seccion"]);
}
function cmp_procede($a, $b)
{
	if(is_array($a)==false){return;}
    return strcmp($a["procede"], $b["procede"]);
}


function intLowHigh($input, $length)
{
    // Function to encode a number as two bytes. This is straight out of Mike42\Escpos\Printer
    $outp = "";
    for ($i = 0; $i < $length; $i++) {
        $outp .= chr($input % 256);
        $input = (int)($input / 256);
    }
    return $outp;
}
?>