/**
 * Pruebas de js/porcion.utils.js
 * Ejecutar:  node test/porcion.utils.test.js
 *
 * Caso guia: porcion PECHUGA, sede Cazador, 2026-08-04.
 * La cabecera del dia mostraba "Cant. Ventas: 6 / Cant. Devol.: 3" contando FILAS,
 * y "Aumenta +0" ignorando las devoluciones, asi que Inicio 13 - 6 = 7 no cuadraba con Fin 10.
 */

const assert = require('assert');
const {
    SIGNO_MOVIMIENTO,
    resumirMovimientosPorcion,
    calcularStockConvertido,
    extraerInicialesPorcion,
    generarCodigoUnicoPorcion
} = require('../js/porcion.utils');

let pasaron = 0;
function test(nombre, fn) {
    try {
        fn();
        pasaron++;
        console.log('  ok  - ' + nombre);
    } catch (e) {
        console.error('  FAIL- ' + nombre + '\n        ' + e.message);
        process.exitCode = 1;
    }
}

/** Formatea igual que cocinarArrayHistorial() en x-porcion-detalle.html */
function formatear(filas) {
    return filas.map(f => {
        const tipo = f.tipo_movimiento.toUpperCase();
        return {
            tipo_movimiento: tipo,
            cantidad: (SIGNO_MOVIMIENTO[tipo] || '') + f.cantidad,
            stock_total: f.stock_total
        };
    });
}

// Movimientos reales del 2026-08-04, del mas nuevo al mas viejo (como los devuelve el backend)
const MOV_04_AGOSTO = formatear([
    { tipo_movimiento: 'Venta', cantidad: 1, stock_total: 10 },
    { tipo_movimiento: 'Venta devolucion', cantidad: 1, stock_total: 11 },
    { tipo_movimiento: 'Venta devolucion', cantidad: 1, stock_total: 10 },
    { tipo_movimiento: 'Venta', cantidad: 1, stock_total: 9 },
    { tipo_movimiento: 'Venta devolucion', cantidad: 1, stock_total: 10 },
    { tipo_movimiento: 'Venta', cantidad: 1, stock_total: 9 },
    { tipo_movimiento: 'Venta', cantidad: 1, stock_total: 10 },
    { tipo_movimiento: 'Venta', cantidad: 1, stock_total: 11 },
    { tipo_movimiento: 'Venta', cantidad: 1, stock_total: 12 }
]);

console.log('\nSIGNO_MOVIMIENTO');

test('VENTA DEVOLUCION suma stock, por eso lleva "+"', () => {
    assert.strictEqual(SIGNO_MOVIMIENTO['VENTA DEVOLUCION'], '+');
});

test('VENTA y DISMINUYE restan stock', () => {
    assert.strictEqual(SIGNO_MOVIMIENTO['VENTA'], '-');
    assert.strictEqual(SIGNO_MOVIMIENTO['DISMINUYE'], '-');
});

test('AUMENTA y RECUPERACION suman stock', () => {
    assert.strictEqual(SIGNO_MOVIMIENTO['AUMENTA'], '+');
    assert.strictEqual(SIGNO_MOVIMIENTO['RECUPERACIÓN'], '+');
});

console.log('\nresumirMovimientosPorcion');

test('suma cantidades, no cuenta filas (6 movimientos de venta = 6 unidades aqui, pero 3 devoluciones = 3)', () => {
    const r = resumirMovimientosPorcion(MOV_04_AGOSTO);
    assert.strictEqual(r.vendido, 6, 'vendido');
    assert.strictEqual(r.devuelto, 3, 'devuelto');
    assert.strictEqual(r.movimientos, 9, 'movimientos');
});

test('la salida neta del dia es -3, no -6', () => {
    assert.strictEqual(resumirMovimientosPorcion(MOV_04_AGOSTO).neto, -3);
});

test('la cabecera cuadra: Inicio + neto === Fin', () => {
    const r = resumirMovimientosPorcion(MOV_04_AGOSTO);
    assert.strictEqual(r.stockInicio, '13');
    assert.strictEqual(r.stockFinal, '10');
    assert.strictEqual(Number(r.stockInicio) + r.neto, Number(r.stockFinal));
});

test('cantidades > 1 se suman por magnitud, no por cantidad de filas', () => {
    const r = resumirMovimientosPorcion(formatear([
        { tipo_movimiento: 'Venta devolucion', cantidad: 24, stock_total: 100 },
        { tipo_movimiento: 'Venta', cantidad: 8, stock_total: 76 },
        { tipo_movimiento: 'Venta', cantidad: 8, stock_total: 84 },
        { tipo_movimiento: 'Venta', cantidad: 8, stock_total: 92 }
    ]));
    assert.strictEqual(r.vendido, 24);
    assert.strictEqual(r.devuelto, 24);
    assert.strictEqual(r.neto, 0);
    assert.strictEqual(r.stockInicio, '100');
    assert.strictEqual(r.stockFinal, '100');
});

test('AUMENTA / DISMINUYE van a ajuste, no a vendido ni devuelto', () => {
    const r = resumirMovimientosPorcion(formatear([
        { tipo_movimiento: 'Disminuye', cantidad: 2, stock_total: 18 },
        { tipo_movimiento: 'Aumenta', cantidad: 5, stock_total: 20 },
        { tipo_movimiento: 'Venta', cantidad: 1, stock_total: 15 }
    ]));
    assert.strictEqual(r.vendido, 1);
    assert.strictEqual(r.devuelto, 0);
    assert.strictEqual(r.ajuste, 3);
    assert.strictEqual(r.neto, 2);
    assert.strictEqual(Number(r.stockInicio) + r.neto, Number(r.stockFinal));
});

test('un solo movimiento reconstruye bien el stock inicial', () => {
    const r = resumirMovimientosPorcion(formatear([
        { tipo_movimiento: 'Venta', cantidad: 1, stock_total: 12 }
    ]));
    assert.strictEqual(r.stockInicio, '13');
    assert.strictEqual(r.stockFinal, '12');
});

test('lista vacia no rompe', () => {
    const r = resumirMovimientosPorcion([]);
    assert.strictEqual(r.vendido, 0);
    assert.strictEqual(r.neto, 0);
    assert.strictEqual(r.stockInicio, '');
    assert.strictEqual(r.stockFinal, '');
});

test('acepta null y filas con cantidad no numerica', () => {
    assert.strictEqual(resumirMovimientosPorcion(null).movimientos, 0);
    const r = resumirMovimientosPorcion([
        { tipo_movimiento: 'VENTA', cantidad: '-1', stock_total: '9' },
        { tipo_movimiento: 'VENTA', cantidad: 'x', stock_total: '10' }
    ]);
    assert.strictEqual(r.vendido, 1);
});

test('decimales con coma se parsean', () => {
    const r = resumirMovimientosPorcion([
        { tipo_movimiento: 'VENTA', cantidad: '-0,5', stock_total: '9,5' }
    ]);
    assert.strictEqual(r.vendido, 0.5);
});

console.log('\nutilidades existentes (no deben romperse)');

test('calcularStockConvertido', () => {
    assert.strictEqual(calcularStockConvertido(16, 8), '2');
    assert.strictEqual(calcularStockConvertido(10, 4), '2.50');
    assert.strictEqual(calcularStockConvertido(0, 8), '');
});

test('extraerInicialesPorcion / generarCodigoUnicoPorcion', () => {
    assert.strictEqual(extraerInicialesPorcion('CARNE DE TOYO 200GR'), 'CT200');
    assert.strictEqual(generarCodigoUnicoPorcion('ABANICO', '002'), 'A-002');
});

console.log('\n' + pasaron + ' pruebas ok' + (process.exitCode ? ' (con fallas)' : ''));
