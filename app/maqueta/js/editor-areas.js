// "Áreas y mesas" desde el editor "Armar salon": agregar areas, cambiar cuantas mesas tiene cada una y elegir si las
// mesas son solo numeros (01, 02…) o llevan prefijo (S1-01…). Guarda con los mismos op de log_009.php que la pestaña
// AREAS Y MESAS de Configuracion (50 numericas, 51 alfanumericas): esas re-insertan las areas y arrastran las reglas de
// impresora por titulo. El nombre de un area ya guardada no se cambia aqui: su salon dibujado esta enlazado a el.
import { mesasDelArea } from './plano.js?v=20261102m';
import { preguntar } from './editor-ui.js?v=20261102m';

const MAX_MESA = 999;
const sinEspacios = t => String(t).replace(/\s+/g, '');

/**
 * Por que la lista de areas no se puede guardar ('' si se puede).
 * @param {Array<{titulo: string, desde: number, hasta: number, prefijo?: string}>} lista
 * @param {boolean} alfanumerica
 */
export function problemaDeAreas(lista, alfanumerica) {
	if (!lista.length) { return 'Deja al menos un área.'; }
	const vistos = new Set();
	for (const a of lista) {
		const nombre = String(a.titulo || '').trim();
		if (!nombre) { return 'Falta el nombre de un área.'; }
		if (vistos.has(sinEspacios(nombre).toUpperCase())) { return `Hay dos áreas que se llaman «${nombre}».`; }
		vistos.add(sinEspacios(nombre).toUpperCase());
		if (!Number.isInteger(a.desde) || !Number.isInteger(a.hasta) || a.desde < 1 || a.hasta > MAX_MESA) {
			return `En «${nombre}» las mesas van del 1 al ${MAX_MESA}.`;
		}
		if (a.hasta < a.desde) { return `En «${nombre}» la última mesa no puede ser menor que la primera.`; }
		if (alfanumerica && !String(a.prefijo || '').trim()) { return `Falta el prefijo de «${nombre}» (por ejemplo S1-).`; }
	}
	const [i, k] = choques(lista, alfanumerica)[0] || [];
	return i === undefined ? '' : `«${lista[i].titulo.trim()}» y «${lista[k].titulo.trim()}» tienen mesas con el mismo número. Cambia la primera o la última mesa de una de las dos.`;
}

/** Pares [i, k] de areas con alguna mesa en comun (con prefijo, solo chocan las del mismo prefijo). */
function choques(lista, alfanumerica) {
	const pares = [];
	for (let i = 0; i < lista.length; i++) {
		for (let k = i + 1; k < lista.length; k++) {
			const a = lista[i], b = lista[k];
			const mismoGrupo = !alfanumerica || String(a.prefijo).trim() === String(b.prefijo).trim();
			if (mismoGrupo && a.desde <= b.hasta && b.desde <= a.hasta) { pares.push([i, k]); }
		}
	}
	return pares;
}

/** Indices de las areas que comparten alguna mesa con otra (se marcan en rojo mientras se escribe). */
export const filasQueChocan = (lista, alfanumerica) => new Set(choques(lista, alfanumerica).flat());

function nodo(tag, clase, texto) {
	const e = document.createElement(tag);
	if (clase) { e.className = clase; }
	if (texto != null) { e.textContent = texto; }
	return e;
}

function entrada(tipo, valor, clase, titulo) {
	const i = nodo('input', `selected-template-1 ${clase}`);   // los inputs del sistema (x-areas-mesas)
	i.type = tipo;
	i.value = valor ?? '';
	i.title = titulo;
	if (tipo === 'number') { i.min = '1'; i.max = String(MAX_MESA); }
	return i;
}

/**
 * Abre el dialogo con las areas guardadas. Resuelve con lo que hay que guardar o null si cancela.
 * @param {{filas: object[], alfanumerica: boolean, conPlano: Set<string>}} op filas de pedirAreas; conPlano = titulos
 *   sin espacios de las areas que tienen salon guardado
 * @returns {Promise<null | {lista: object[], alfanumerica: boolean, cambioTipo: boolean}>}
 */
export function editarAreas({ filas, alfanumerica, conPlano }) {
	return new Promise(resolver => {
		let alfa = alfanumerica;
		let filasVivas = filas.map(f => ({ titulo: String(f.titulo), desde: parseInt(f.desde, 10), hasta: parseInt(f.hasta, 10), prefijo: f.prefijo || '', nueva: false }));
		const dlg = nodo('dialog', 'mqe-dlg mqe-dlg-areas');
		const cab = nodo('div', 'xdlg-head');
		cab.appendChild(nodo('h3', '', 'Áreas y mesas'));
		const cuerpo = nodo('div', 'xdlg-body');
		const pie = nodo('div', 'xdlg-foot');
		const cancelar = nodo('button', 'btn btn-sm btn-light', 'Cancelar');
		const guardar = nodo('button', 'btn btn-sm btn-success', 'Guardar áreas');
		for (const b of [cancelar, guardar]) { b.type = 'button'; }
		pie.append(cancelar, guardar);

		const tipo = nodo('div', 'mqe-tipo');
		const opcion = (valor, texto) => {
			const l = nodo('label');
			const r = nodo('input');
			r.type = 'radio';
			r.name = 'mqe_tipo_mesa';
			r.value = valor;
			r.checked = (valor === 'alfa') === alfa;
			l.append(r, ` ${texto}`);
			return l;
		};
		tipo.append(nodo('span', 'mqe-et', 'Las mesas se llaman:'), opcion('num', 'con números (01, 02…)'), opcion('alfa', 'con prefijo (S1-01, P2-01…)'));
		const avisoTipo = nodo('p', 'mqe-nota mqe-nota-roja', 'Esto cambia el nombre de todas las mesas del local. Hazlo con el local cerrado (sin cuentas abiertas). Después, cierra sesión y vuelve a entrar en cada caja.');
		const tabla = nodo('table', 'table table-sm mqe-tabla-areas');
		const agregar = nodo('button', 'btn btn-sm btn-light', '+ Agregar área');
		agregar.type = 'button';
		const error = nodo('p', 'mqe-nota mqe-nota-roja');
		error.hidden = true;
		cuerpo.append(nodo('p', 'mqe-ayuda', 'Cada área es una pestaña del salón. Para tener más mesas, sube el número de la última.'), tipo, avisoTipo, tabla, agregar, error);

		function leer() {
			filasVivas = [...tabla.tBodies[0].rows].map((tr, i) => ({
				...filasVivas[i],
				titulo: filasVivas[i].nueva ? tr.querySelector('.mqe-a-nombre').value : filasVivas[i].titulo,
				desde: parseInt(tr.querySelector('.mqe-a-desde').value, 10),
				hasta: parseInt(tr.querySelector('.mqe-a-hasta').value, 10),
				prefijo: alfa ? tr.querySelector('.mqe-a-prefijo').value.trim() : filasVivas[i].prefijo,
			}));
		}

		function dibujar() {
			avisoTipo.hidden = alfa === alfanumerica;
			const thead = nodo('thead'), fila = nodo('tr');
			for (const t of ['Área', ...(alfa ? ['Prefijo'] : []), 'Primera mesa', 'Última mesa', 'Mesas', '']) { fila.appendChild(nodo('th', '', t)); }
			thead.appendChild(fila);
			const tbody = nodo('tbody');
			filasVivas.forEach((a, i) => {
				const tr = nodo('tr');
				const nombre = nodo('td');
				if (a.nueva) { nombre.appendChild(entrada('text', a.titulo, 'mqe-a-nombre', 'Nombre del área')); } else { nombre.textContent = a.titulo; }
				tr.appendChild(nombre);
				if (alfa) { tr.appendChild(nodo('td')).appendChild(entrada('text', a.prefijo, 'mqe-a-prefijo', 'Prefijo de las mesas, por ejemplo S1-')); }
				tr.appendChild(nodo('td')).appendChild(entrada('number', a.desde, 'mqe-a-desde', 'Número de la primera mesa'));
				tr.appendChild(nodo('td')).appendChild(entrada('number', a.hasta, 'mqe-a-hasta', 'Número de la última mesa'));
				const ok = Number.isInteger(a.desde) && Number.isInteger(a.hasta) && a.hasta >= a.desde;
				const codigos = ok ? mesasDelArea(a, alfa) : [];
				tr.appendChild(nodo('td', 'mqe-a-ej', ok ? `${codigos.length}: ${codigos[0]} a ${codigos[codigos.length - 1]}` : '—'));
				const quitar = nodo('button', 'btn btn-sm btn-light mqe-borrar', 'Quitar');
				quitar.type = 'button';
				quitar.dataset.quitar = String(i);
				tr.appendChild(nodo('td')).appendChild(quitar);
				tbody.appendChild(tr);
			});
			tabla.replaceChildren(thead, tbody);
			validar();
		}

		tipo.addEventListener('change', e => { leer(); alfa = e.target.value === 'alfa'; dibujar(); });
		const aLista = () => filasVivas.map(a => ({ titulo: String(a.titulo).trim(), descripcion: '', desde: a.desde, hasta: a.hasta, prefijo: alfa ? a.prefijo : '' }));

		/** Mientras se escribe: el problema arriba de Guardar (que se apaga) y en rojo las areas que se pisan. */
		function validar() {
			const lista = aLista(), problema = problemaDeAreas(lista, alfa), malas = filasQueChocan(lista, alfa);
			error.textContent = problema;
			error.hidden = !problema;
			guardar.disabled = !!problema;
			[...tabla.tBodies[0].rows].forEach((tr, i) => tr.classList.toggle('mqe-a-mal', malas.has(i)));
		}

		tabla.addEventListener('change', () => { leer(); dibujar(); });
		tabla.addEventListener('input', () => { leer(); validar(); });
		tabla.addEventListener('click', e => {
			const b = e.target.closest('[data-quitar]');
			if (!b) { return; }
			leer();
			filasVivas = filasVivas.filter((_, i) => i !== Number(b.dataset.quitar));
			dibujar();
		});
		agregar.addEventListener('click', () => {
			leer();
			const desde = Math.max(0, ...filasVivas.map(a => a.hasta).filter(Number.isInteger)) + 1;
			filasVivas = [...filasVivas, { titulo: '', desde, hasta: desde + 9, prefijo: '', nueva: true }];
			dibujar();
			tabla.querySelector('tbody tr:last-child .mqe-a-nombre').focus();
		});

		let resultado = null;
		cancelar.addEventListener('click', () => dlg.close());
		guardar.addEventListener('click', async () => {
			leer();
			const lista = aLista();
			const problema = problemaDeAreas(lista, alfa);
			error.textContent = problema;
			error.hidden = !problema;
			if (problema) { return; }
			const quedan = new Set(lista.map(a => sinEspacios(a.titulo)));
			const pierden = [...conPlano].filter(t => !quedan.has(t));
			if (pierden.length && !await preguntar('¿Quitar áreas con salón?',
				`Las áreas que quitas ya tienen su salón dibujado (${pierden.join(', ')}). Dejarán de verse en el editor y en Control de pedidos.`,
				'Sí, quitar')) { return; }
			resultado = { lista, alfanumerica: alfa, cambioTipo: alfa !== alfanumerica };
			dlg.close();
		});
		dlg.addEventListener('close', () => { dlg.remove(); resolver(resultado); });
		dlg.append(cab, cuerpo, pie);
		document.body.appendChild(dlg);
		dibujar();
		dlg.showModal();
	});
}
