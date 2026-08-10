/**
 * Pruebas de xJsonSunatCocinarItemDetalle (app/view/xJsonSunat.js)
 * Ejecutar:  node test/xjsonsunat.gratuita.test.js
 *
 * Caso guia: comprobante con descuento 100% (total 0) debe salir como
 * TRANSFERENCIA GRATUITA — afectacion catalogo 07 (15 gravada / 21 exonerada)
 * y codigo_tipo_precio "02" (valor referencial) — para que SUNAT lo acepte
 * en lugar de rechazarlo y (antes) bloquear las series.
 */

const assert = require('assert');

// globales de navegador que usa el modulo
global.xCalcMontoBaseIGV = (importeTotal, procentaje_IGV) =>
    parseFloat(parseFloat(importeTotal) / (1 + procentaje_IGV)).toFixed(2);

const { xJsonSunatCocinarItemDetalle } = require('../app/view/xJsonSunat.js');

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

const ITEM_23 = { id: 1, des: 'PECHUGA A LA PLANCHA', cantidad: 1, punitario: '23.00', precio_total: '23.00' };
const IGV = 18;

console.log('\nventa normal (sin cambios de comportamiento)');

test('gravado: afectacion 10 y tipo de precio 01', () => {
    const [it] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, false);
    assert.strictEqual(it.codigo_tipo_afectacion_igv, '10');
    assert.strictEqual(it.codigo_tipo_precio, '01');
});

test('exonerado: afectacion 20 y tipo de precio 01', () => {
    const [it] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, true);
    assert.strictEqual(it.codigo_tipo_afectacion_igv, '20');
    assert.strictEqual(it.codigo_tipo_precio, '01');
});

test('valor unitario = base sin IGV (23.00 / 1.18 = 19.49)', () => {
    const [it] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, false);
    assert.strictEqual(it.valor_unitario, '19.49');
    assert.strictEqual(it.precio_unitario, '23.00');
});

test('item con precio 0 se omite (regresion)', () => {
    const rpt = xJsonSunatCocinarItemDetalle(
        [{ ...ITEM_23 }, { id: 2, des: 'CORTESIA', cantidad: 1, punitario: '0', precio_total: '0' }],
        IGV, false);
    assert.strictEqual(rpt.length, 1);
});

console.log('\ntransferencia gratuita (total del comprobante en 0)');

test('gravada gratuita: afectacion 15 (bonificacion) y precio referencial (02)', () => {
    const [it] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, false, true);
    assert.strictEqual(it.codigo_tipo_afectacion_igv, '15');
    assert.strictEqual(it.codigo_tipo_precio, '02');
});

test('exonerada gratuita: afectacion 21 y precio referencial (02)', () => {
    const [it] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, true, true);
    assert.strictEqual(it.codigo_tipo_afectacion_igv, '21');
    assert.strictEqual(it.codigo_tipo_precio, '02');
});

// Formato final ACEPTADO por SUNAT beta el 2026-08-08 (F001-8, código 0):
// precio real (valor_unitario) en 0, referencial SIN IGV en precio_unitario,
// IGV referencial != 0 en la línea (gravadas). Reglas 2640 / 3111 / 3271 / 3302.

test('gratuita: precio real en 0 y referencial SIN IGV (SUNAT 2640/3271)', () => {
    const [it] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, false, true);
    assert.strictEqual(it.valor_unitario, 0);
    assert.strictEqual(it.precio_unitario, '19.49'); // 23.00 sin IGV
});

test('gratuita gravada: IGV referencial de linea != 0 (SUNAT 3111)', () => {
    const [it] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, false, true);
    assert.strictEqual(it.total_igv, '3.51');
    assert.strictEqual(parseFloat(it.total_base_igv) > 0, true);
    assert.strictEqual(parseFloat(it.total_valor_item).toFixed(2), '19.49');
});

test('gratuita exonerada: IGV 0 y referencial igual al precio', () => {
    const [it] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, true, true);
    assert.strictEqual(it.valor_unitario, 0);
    assert.strictEqual(it.precio_unitario, '23.00');
    assert.strictEqual(parseFloat(it.total_igv), 0);
});

test('esGratuita por defecto false: llamadas existentes no cambian', () => {
    const [a] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, false);
    const [b] = xJsonSunatCocinarItemDetalle([{ ...ITEM_23 }], IGV, false, false);
    assert.deepStrictEqual(a, b);
});

console.log('\n' + pasaron + ' pruebas ok' + (process.exitCode ? ' (con fallas)' : ''));
