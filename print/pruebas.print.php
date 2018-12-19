<?php	
require __DIR__ . '/autoload.php';
use Mike42\Escpos\Printer;
use Mike42\Escpos\EscposImage;
use Mike42\Escpos\PrintConnectors\WindowsPrintConnector;


$fecha_actual=date('d').'/'.date('m').'/'.date('y');
$hora_actual=date('H').':'.date('i').':'.date('s');
try {
    // Enter the share name for your printer here, as a smb:// url format
    // $connector = new WindowsPrintConnector("smb://desa1/ticketera");
    //$connector = new WindowsPrintConnector("smb://Guest@computername/Receipt Printer");
    //$connector = new WindowsPrintConnector("smb://FooUser:secret@computername/workgroup/Receipt Printer");
    $connector = new WindowsPrintConnector("smb://pc:182182@192.168.1.56/ticketera1");
    
    /* Print a "Hello world" receipt" */
    $printer = new Printer($connector);


    $logo = EscposImage::load('./logo/11logo_prueba4.jpg', false);
	$printer -> setJustification(Printer::JUSTIFY_CENTER);
    $printer -> graphics($logo);
    
    $printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);
	$printer -> text('MESA 01'."\n");
	$printer -> selectPrintMode();
	$printer -> text("------------------------------------------------\n");
	$printer -> text('Referencia del pedido ej: Sr. Perez'."\n");
    $printer -> feed();
    
    $printer -> setJustification(Printer::JUSTIFY_CENTER);								
	$printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);
	$printer -> selectPrintMode(Printer::MODE_UNDERLINE);
	$printer -> setEmphasis(true);				
	$printer -> text("*** CONSUMIR EN EL LOCAL ***\n");	
	$printer -> setEmphasis(false);
    $printer -> selectPrintMode();
    
    //SECCION 1
	$printer -> setJustification(Printer::JUSTIFY_LEFT);
	$printer -> setEmphasis(true);				
	$printer -> text('ENTRADAS'."\n");
	$printer -> text("------------------------------------------------\n");	
    $printer -> setEmphasis(false);
    
    //destalles
	$printer -> setEmphasis(false);
	$printer -> text(new item('01 ARROZ CON LECHE', '2.00'));
	$printer -> text(new item('01 ENSALADA FRESCA', '2.00'));
	$printer -> text(new item('01 CAUSA RELLENA', '5.00'));
	$printer -> feed();

    /* TOTALES */
	$printer -> feed();
	$printer -> text("------------------------------------------------\n");
	$printer -> setEmphasis(true);
	
	$printer -> selectPrintMode(Printer::MODE_DOUBLE_WIDTH);	
	$printer -> text(new item('TOTAL', '39.00', true));
	$printer -> selectPrintMode();

	/* PIE DE PAGINA */	
	$printer -> feed(2);
	$printer -> setJustification(Printer::JUSTIFY_CENTER);
	$printer -> text($ArrayEnca['pie_pagina']."\n");
	$printer -> feed(2);
	$printer -> text("Atendido por: PEDRO \n");
	$printer -> text($fecha_actual.' | '.$hora_actual. "\n");

	$printer -> text("www.papaya.com.pe\n");

	$printer -> cut();
    $printer -> close();
    
    // $printer -> text("Hello World!\n");
    // $printer -> cut();
    
    /* Close printer */
    $printer -> close();
} catch (Exception $e) {
    echo "Couldn't print to this printer: " . $e -> getMessage() . "\n";
}


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

?>