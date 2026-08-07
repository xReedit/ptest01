/**
 * Utilidades para el manejo de porciones
 * Funciones compartidas entre componentes de porciones
 */

/**
 * Calcula el stock convertido a la unidad alternativa
 * @param {number} stock - Stock en la unidad base
 * @param {number} factorConversion - Factor de conversión (unidad_base / unidad_alternativa)
 * @returns {string} Stock convertido formateado (sin decimales si es entero, con 2 decimales si no)
 */
function calcularStockConvertido(stock, factorConversion) {
    if (!stock || !factorConversion) return '';
    const stockConvertido = parseFloat(stock) / parseFloat(factorConversion);
    return stockConvertido % 1 === 0 ? stockConvertido.toFixed(0) : stockConvertido.toFixed(2);
}

/**
 * Extrae las iniciales de un nombre de porción para generar el código
 * Ejemplos: 
 * - "HAMBURGUESA DE RES 200GR" -> "HR200"
 * - "AA 200GR CECINA" -> "AA200"
 * - "CARNE DE TOYO 200GR" -> "CT200"
 * - "ABANICO" -> "A"
 * - "CECINA 100GR" -> "C100"
 * 
 * @param {string} nombrePorcion - Nombre de la porción
 * @returns {string} Iniciales extraídas (letras y números)
 */
function extraerInicialesPorcion(nombrePorcion) {
    if (!nombrePorcion) return '';
    
    // Limpiar y convertir a mayúsculas
    const nombre = nombrePorcion.toUpperCase().trim();
    
    // Dividir en palabras
    const palabras = nombre.split(/\s+/);
    
    // Lista de palabras a ignorar (preposiciones y artículos comunes)
    const palabrasIgnorar = ['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'E', 'A', 'AL'];
    
    let iniciales = '';
    
    for (let palabra of palabras) {
        // Ignorar preposiciones y artículos
        if (palabrasIgnorar.includes(palabra)) {
            continue;
        }
        
        // Si la palabra contiene números, extraer todos los dígitos
        const numeros = palabra.match(/\d+/);
        if (numeros) {
            // Tomar solo el primer número encontrado
            iniciales += numeros[0];
        } else {
            // Tomar la primera letra de la palabra
            iniciales += palabra.charAt(0);
        }
    }
    
    // Limitar a máximo 5 caracteres para las iniciales
    return iniciales.substring(0, 5);
}

/**
 * Genera un código único basado en el nombre de la porción y un número secuencial
 * Formato: INICIALES-NNN (ej: HDR2-001, A2C-002)
 * 
 * @param {string} nombrePorcion - Nombre de la porción
 * @param {string} numeroSecuencial - Número secuencial con formato "001", "002", etc.
 * @returns {string} Código único generado
 */
function generarCodigoUnicoPorcion(nombrePorcion, numeroSecuencial) {
    const iniciales = extraerInicialesPorcion(nombrePorcion);
    return iniciales + '-' + numeroSecuencial;
}

/**
 * Signo con el que cada tipo de movimiento afecta al stock.
 * El backend devuelve el tipo capitalizado ('Venta devolucion'), por eso se compara en MAYUSCULAS.
 * VENTA DEVOLUCION suma stock: antes no tenia signo y se leia como si no afectara.
 */
var SIGNO_MOVIMIENTO = {
    'VENTA': '-',
    'DISMINUYE': '-',
    'VENTA DISMINUYE': '-',
    'SALIDA': '-',
    'AUMENTA': '+',
    'RECUPERACIÓN': '+',
    'RECUPERACION': '+',
    'VENTA DEVOLUCION': '+',
    'ENTRADA': '+'
};

/**
 * Resume los movimientos de una porcion sumando CANTIDADES (no contando filas).
 *
 * @param {Array<{tipo_movimiento: string, cantidad: string|number, stock_total: string|number}>} items
 *        Movimientos ya formateados (cantidad con signo), ordenados del mas nuevo al mas viejo.
 * @returns {{vendido: number, devuelto: number, ajuste: number, neto: number,
 *            stockInicio: string, stockFinal: string, movimientos: number}}
 *          vendido/devuelto son magnitudes positivas; neto = -vendido + devuelto + ajuste.
 *          Se cumple: stockInicio + neto === stockFinal.
 */
function resumirMovimientosPorcion(items) {
    var lista = items || [];
    var vendido = 0;
    var devuelto = 0;
    var ajuste = 0;

    for (var i = 0; i < lista.length; i++) {
        var it = lista[i] || {};
        var tipo = ((it.tipo_movimiento || '') + '').toUpperCase();
        var n = parseFloat((it.cantidad === 0 ? '0' : (it.cantidad || '0')).toString().replace(',', '.'));
        if (isNaN(n)) continue;

        if (tipo === 'VENTA') {
            vendido += Math.abs(n);
        } else if (tipo === 'VENTA DEVOLUCION') {
            devuelto += Math.abs(n);
        } else {
            // AUMENTA / RECUPERACION suman, DISMINUYE resta: el signo ya viene en la cantidad
            ajuste += n;
        }
    }

    var neto = -vendido + devuelto + ajuste;

    // La lista viene del mas nuevo al mas viejo: el stock final es el del primero,
    // y el inicial se reconstruye quitando el efecto del movimiento mas viejo.
    var nuevo = lista.length ? lista[0] : null;
    var viejo = lista.length ? lista[lista.length - 1] : null;
    var stockFinalNum = nuevo ? parseFloat((nuevo.stock_total || '0').toString().replace(',', '.')) : NaN;
    var stockViejoNum = viejo ? parseFloat((viejo.stock_total || '0').toString().replace(',', '.')) : NaN;
    var cantViejaNum = viejo ? parseFloat((viejo.cantidad || '0').toString().replace(',', '.')) : NaN;

    return {
        vendido: vendido,
        devuelto: devuelto,
        ajuste: ajuste,
        neto: neto,
        stockInicio: (!isNaN(stockViejoNum) && !isNaN(cantViejaNum)) ? (stockViejoNum - cantViejaNum).toString() : '',
        stockFinal: isNaN(stockFinalNum) ? '' : stockFinalNum.toString(),
        movimientos: lista.length
    };
}

// Export para pruebas en Node; en el navegador las funciones quedan globales.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcularStockConvertido: calcularStockConvertido,
        extraerInicialesPorcion: extraerInicialesPorcion,
        generarCodigoUnicoPorcion: generarCodigoUnicoPorcion,
        SIGNO_MOVIMIENTO: SIGNO_MOVIMIENTO,
        resumirMovimientosPorcion: resumirMovimientosPorcion
    };
}
