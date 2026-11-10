// Panel "Personalizar" del editor (spec §6.2), portado del prototipo aprobado (GROUPS/presets/sliders): colores de
// piso, mesas, sillas, cojin, patas y paredes, modelo de silla, sombras y el umbral de "mucho tiempo". Se guarda por
// area con el plano. El panel no guarda nada: avisa cada cambio con alCambiar(ajustes, final); final = false mientras
// se arrastra un deslizador o el selector de color (solo se ve), true cuando el cambio queda (va al historial).
import { ajustesConDefaults } from './plano.js?v=20261102m';

const GRUPOS = [
	{ llave: 'piso', nombre: 'Piso', colores: ['#bababa', '#e6e8eb', '#e3e7ec', '#e3e8e5', '#e9e7e2', '#e6e5ea', '#e2ddd6', '#f1f0ee'] },
	{ llave: 'mesas', nombre: 'Mesas', colores: ['#fbfaf8', '#eadfce', '#cfae86', '#9a7350', '#5e4636', '#3a3d42'] },
	{ llave: 'sillas', nombre: 'Sillas', colores: ['#f3f1ed', '#e8dccb', '#c9c4bb', '#a9b8a0', '#d3a48c', '#3a3d42'] },
	{ llave: 'cojin', nombre: 'Cojín de la silla', colores: ['#e9e6e0', '#d9cbb6', '#b9bec6', '#9fae98', '#c99c8a', '#4a4e57'] },
	{ llave: 'patas', nombre: 'Patas', colores: ['#d9d5ce', '#b08a64', '#6b6f76', '#2e3035'] },
	{ llave: 'paredes', nombre: 'Paredes', colores: ['#fbfbfc', '#f3ece2', '#e6e8eb', '#e9e2f2'] },
];
const MODELOS = [['sillon', 'Sillón'], ['clasica', 'Clásica'], ['bistro', 'Bistró'], ['tapizada', 'Tapizada']];
const SOMBRAS = [['sombraNitida', 'suaves', 'definidas'], ['sombraLargo', 'cortas', 'largas']];
const MUCHO_TIEMPO = { min: 15, max: 600, paso: 5 };

function nodo(tag, clase, texto) {
	const e = document.createElement(tag);
	if (clase) { e.className = clase; }
	if (texto != null) { e.textContent = texto; }
	return e;
}

function titulo(texto) { return nodo('h4', 'mqe-cfg-t', texto); }

function filaColores(g, actual) {
	const fila = nodo('div', 'mqe-colores');
	fila.dataset.llave = g.llave;
	for (const c of g.colores) {
		const b = nodo('button', c === actual ? 'on' : '');
		b.type = 'button';
		b.dataset.color = c;
		b.style.background = c;
		b.title = 'Elegir este color';
		fila.appendChild(b);
	}
	const otro = nodo('input');
	otro.type = 'color';
	otro.value = actual;
	otro.title = 'Otro color';
	fila.appendChild(otro);
	return fila;
}

function deslizador(llave, min, max, paso, valor) {
	const r = nodo('input');
	Object.assign(r, { type: 'range', min, max, step: paso, value: valor });
	r.dataset.llave = llave;
	return r;
}

function modelos(actual) {
	const caja = nodo('div', 'mqe-modelos');
	for (const [k, nombre] of MODELOS) {
		const b = nodo('button', k === actual ? 'on' : '', nombre);
		b.type = 'button';
		b.dataset.modelo = k;
		caja.appendChild(b);
	}
	return caja;
}

const textoMuchoTiempo = min => `Mucho tiempo: ${min} min`;

function muchoTiempo(valor) {
	const caja = nodo('div', 'mqe-mucho');
	caja.append(
		titulo(textoMuchoTiempo(valor)),
		deslizador('muchoTiempoMin', MUCHO_TIEMPO.min, MUCHO_TIEMPO.max, MUCHO_TIEMPO.paso, valor),
		nodo('p', 'mqe-ayuda', 'Una mesa ocupada por más de este tiempo se marca en Control de pedidos para que la revises.'),
	);
	return caja;
}

/**
 * @param {HTMLElement} host
 * @param {{alCambiar: (ajustes: object, final: boolean) => void}} ev
 * @returns {{pintar: (ajustes: object) => void}}
 */
export function crearPanel(host, ev) {
	let ajustes = ajustesConDefaults({});

	function pintar(a) {
		ajustes = ajustesConDefaults(a);
		const partes = [titulo('Modelo de silla'), modelos(ajustes.modelo)];
		for (const g of GRUPOS) { partes.push(titulo(g.nombre), filaColores(g, ajustes[g.llave])); }
		partes.push(titulo('Sombras'));
		for (const [llave, izq, der] of SOMBRAS) {
			const fila = nodo('label', 'mqe-sl');
			fila.append(nodo('span', '', izq), deslizador(llave, 0, 100, 1, ajustes[llave]), nodo('span', '', der));
			partes.push(fila);
		}
		const reset = nodo('button', 'btn btn-sm btn-light mqe-reset', 'Volver a lo original');
		reset.type = 'button';
		partes.push(muchoTiempo(ajustes.muchoTiempoMin), reset);
		host.replaceChildren(...partes);
	}

	function cambiar(cambio, final) {
		ajustes = { ...ajustes, ...cambio };
		ev.alCambiar(ajustes, final);
		if (final) { pintar(ajustes); }
	}

	host.addEventListener('click', e => {
		const color = e.target.closest('button[data-color]');
		if (color) { cambiar({ [color.parentElement.dataset.llave]: color.dataset.color }, true); return; }
		const modelo = e.target.closest('button[data-modelo]');
		if (modelo) { cambiar({ modelo: modelo.dataset.modelo }, true); return; }
		if (e.target.closest('.mqe-reset')) { cambiar(ajustesConDefaults({}), true); }
	});
	// Mientras se arrastra solo se ve; al soltar queda (change).
	const leer = (t, final) => {
		if (t.type === 'color') { cambiar({ [t.parentElement.dataset.llave]: t.value.toLowerCase() }, final); return; }
		if (t.type !== 'range') { return; }
		const v = Number(t.value);
		if (t.dataset.llave === 'muchoTiempoMin') { t.previousElementSibling.textContent = textoMuchoTiempo(v); }
		cambiar({ [t.dataset.llave]: v }, final);
	};
	host.addEventListener('input', e => leer(e.target, false));
	host.addEventListener('change', e => leer(e.target, true));

	pintar(ajustes);
	return Object.freeze({ pintar });
}
