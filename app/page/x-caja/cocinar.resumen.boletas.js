async function xCocinarResumenBoletas() {
    dialog_enviando_sunat.open();
    const rpt = await xSoapSunat_ResumenBoletas();
    console.log(rpt);
    setTimeout(() => {
        dialog_enviando_sunat.close();        
    }, 1000);
}