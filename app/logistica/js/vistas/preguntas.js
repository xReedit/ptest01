// Preguntas en lenguaje natural (F8, central), como chat. La IA solo elige que consultar; los numeros salen del sistema.
// Las sugerencias (rapidas y las que vienen con cada respuesta) van directo, sin IA: funcionan aunque la IA no este configurada.
// La conversacion vive mientras no se recargue la pagina (volver a esta vista la conserva).
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver } from '../ui.js?v=20261015i';

const INICIALES = [
	{ texto: '¿Qué pedidos faltan atender?', herramienta: 'pedidos', icono: 'fa-inbox' },
	{ texto: '¿Qué va en camino?', herramienta: 'en_camino', icono: 'fa-truck' },
	{ texto: '¿Qué está debajo del mínimo?', herramienta: 'bajo_minimo', icono: 'fa-arrow-down' },
	{ texto: '¿Qué falta que llegue de los proveedores?', herramienta: 'por_llegar', icono: 'fa-file-text-o' },
	{ texto: '¿Qué hay parado en las sedes?', herramienta: 'estancados', icono: 'fa-pause-circle' },
	{ texto: '¿Qué está por vencer?', herramienta: 'por_vencer', icono: 'fa-clock-o' },
	{ texto: '¿Cuánto compramos este mes?', herramienta: 'compras', icono: 'fa-shopping-cart', dias: new Date().getDate() },
	{ texto: '¿Cuánto arroz hay en todas las sedes?', icono: 'fa-comment-o' },
	{ texto: '¿Cómo apruebo una orden de compra?', icono: 'fa-question-circle' },
];
const FILAS_VISIBLES = 8;
const num = n => typeof n === 'number' ? n.toLocaleString('es-PE', { maximumFractionDigits: 2 }) : esc(n);

let chat = [];          // [{yo: texto} | {ia: respuesta} | {error: texto}]
let enCurso = false;

export function render(cont) {
	cont.innerHTML = tarjeta({
		titulo: 'Pregúntale a la IA',
		ayuda: 'Escribe como le preguntarías a una persona. Puedes seguir preguntando: "¿y en AYCHA?", "¿y la semana pasada?".',
		acciones: `<button class="btn btn-sm btn-light" id="pg_nueva"><i class="fa fa-refresh"></i>Nueva conversación</button>${volver()}`,
		cuerpo: `<div class="lg-chat" id="pg_chat" aria-live="polite"></div>
			<form id="pg_form" class="lg-chat-form" autocomplete="off">
				<input class="inv-input" id="pg_q" maxlength="300" placeholder="Escribe tu pregunta…" aria-label="Tu pregunta">
				<button class="btn btn-primary" id="pg_ir" type="submit" title="Enviar"><i class="fa fa-paper-plane"></i>Enviar</button>
			</form>`,
	});
	const q = cont.querySelector('#pg_q');
	cont.querySelector('#pg_form').addEventListener('submit', e => {
		e.preventDefault();
		const t = q.value.trim();
		if (t.length < 3) { aviso('Escribe tu pregunta. Por ejemplo: "¿cuánto arroz hay?"', 'error'); return; }
		q.value = '';
		preguntar(cont, t, { pregunta: t, contexto: ultimoContexto() });
	});
	cont.querySelector('#pg_nueva').addEventListener('click', () => { chat = []; pintar(cont); q.focus(); });
	// un solo listener para todas las sugerencias (se redibujan con cada mensaje)
	cont.querySelector('#pg_chat').addEventListener('click', e => {
		const b = e.target.closest('[data-sug]');
		if (b) { usarSugerencia(cont, JSON.parse(b.dataset.sug)); return; }
		const v = e.target.closest('[data-ver]');
		if (v) { v.closest('.lg-msg').querySelectorAll('tr.lg-oculta').forEach(tr => tr.classList.remove('lg-oculta')); v.remove(); }
	});
	pintar(cont);
	q.focus();
}

const ultimoContexto = () => { for (let i = chat.length - 1; i >= 0; i--) { if (chat[i].ia) { return chat[i].ia.contexto; } } return null; };

function usarSugerencia(cont, s) {
	if (!s.herramienta) { preguntar(cont, s.texto, { pregunta: s.texto, contexto: ultimoContexto() }); return; }
	const { texto, herramienta, producto, sede, proveedor, dias } = s;
	preguntar(cont, texto, { herramienta, producto, sede, proveedor, dias }, true);
}

async function preguntar(cont, texto, cuerpo, esBoton) {
	if (enCurso) { return; }
	enCurso = true;
	chat = [...chat, { yo: texto }];
	pintar(cont, true);
	try {
		const r = await api(esBoton ? 'preguntas.php?op=boton' : 'preguntas.php?op=preguntar', cuerpo);
		chat = [...chat, { ia: r }];
	} catch (err) {
		chat = [...chat, { error: err.message }];
	} finally {
		enCurso = false;
	}
	if (cont.isConnected) { pintar(cont); cont.querySelector('#pg_q').focus(); }
}

function chips(lista) {
	return `<div class="lg-chips lg-chat-sug">${lista.map(s => `<button type="button" class="btn btn-sm btn-light" data-sug="${esc(JSON.stringify(s))}">
		<i class="fa ${s.icono || 'fa-angle-right'}"></i>${esc(s.texto)}</button>`).join('')}</div>`;
}

function tabla(r) {
	if (!r.filas.length) { return ''; }
	const mas = r.filas.length - FILAS_VISIBLES;
	return `<div class="inv-table-wrap"><table class="inv-table"><thead><tr>${r.columnas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
		<tbody>${r.filas.map((f, i) => `<tr${i >= FILAS_VISIBLES ? ' class="lg-oculta"' : ''}>${f.map(v => `<td${typeof v === 'number' ? ' class="inv-num"' : ''}>${num(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
		${mas > 0 ? `<button type="button" class="btn btn-sm btn-link" data-ver>Ver ${mas} fila(s) más${r.filas.length >= 200 ? ' (se muestran las primeras 200)' : ''}</button>` : ''}`;
}

function pintar(cont, esperando) {
	const caja = cont.querySelector('#pg_chat');
	if (!caja) { return; }
	const ultimo = chat.length - 1;
	const msgs = chat.map((m, i) => {
		if (m.yo) { return `<div class="lg-msg lg-msg-yo">${esc(m.yo)}</div>`; }
		if (m.error) { return `<div class="lg-msg lg-msg-ia lg-msg-error"><i class="fa fa-info-circle"></i> ${esc(m.error)}</div>${i === ultimo ? chips(INICIALES.slice(0, 4)) : ''}`; }
		const r = m.ia;
		return `<div class="lg-msg lg-msg-ia"><p class="lg-msg-titulo">${esc(r.titulo)}</p><p class="lg-msg-texto">${esc(r.respuesta)}</p>${tabla(r)}
			${r.tema ? `<a class="btn btn-sm btn-light" href="#" data-ir="ayuda/${esc(r.tema)}"><i class="fa fa-question-circle"></i>Ver en la ayuda</a>` : ''}</div>
			${i === ultimo && r.sugerencias && r.sugerencias.length ? chips(r.sugerencias) : ''}`;
	});
	caja.innerHTML = `<div class="lg-msg lg-msg-ia"><p class="lg-msg-texto">Hola. Pregúntame por stock, ventas, compras, envíos, órdenes de compra, mínimos, vencimientos o pedidos de las sedes. También cómo se usa el Centro Logístico.</p></div>
		${chat.length ? '' : chips(INICIALES)}${msgs.join('')}
		${esperando ? '<div class="lg-msg lg-msg-ia lg-msg-espera"><i class="fa fa-spinner fa-spin"></i> Buscando en el sistema…</div>' : ''}`;
	cont.querySelectorAll('#pg_ir, #pg_q').forEach(el => { el.disabled = !!esperando; });
	caja.scrollTop = caja.scrollHeight;
}
