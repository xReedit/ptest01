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
