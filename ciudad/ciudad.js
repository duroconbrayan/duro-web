// DURO CITY: la versión pública de la oficina. Solo lectura, liviana para celulares y con gente real:
// las salas salen de publico/salas.json (lo que Brayan publica desde su oficina, sin datos privados)
// y los números en vivo de /api/publico (después, del Worker público).
import {usarModoLiviano, viendoAhora, cifra, esc} from './datos.js';
import {crearEscena} from './escena.js';

usarModoLiviano();
// Para publicarla en otro lado se cambian las direcciones con window.DURO_CITY = {datos, vivo, estadoLive}:
// - vivo: números públicos de todas las salas (local: /api/publico; después, el Worker público)
// - estadoLive: solo si Brayan está en vivo ({live: true/false}), del Worker de DURO LIVE
const CFG = window.DURO_CITY || {};
const DATOS = CFG.datos || 'publico/salas.json';
const VIVO = 'vivo' in CFG ? CFG.vivo : '/api/publico';
const ESTADO_LIVE = CFG.estadoLive || null;
// Entrada privada: la clave se comprueba contra el Worker de DURO LIVE (la misma de admin.html).
// La clave no se guarda; solo se recuerda en esta pestaña que ya entraste.
const LOGIN = CFG.login || null;
const LIVE_TIKTOK = 'https://www.tiktok.com/@duroconbrayan/live';

const $ = id => document.getElementById(id);
let state = null, abierta = null;
const sala = id => state?.salas.find(s => s.id === id);

const escena = crearEscena({
  contenedor: $('escena'), capa: $('capa'), publico: true,
  alClicSala: id => abrir(id), alClicFutura: () => {},
});

// ---------- Tarjeta de una sala ----------
const NOMBRE_RED = {youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', twitch: 'Twitch'};
function abrir(id) {
  const s = sala(id);
  if (!s || s.centro) return cerrar();
  abierta = id;
  pintarTarjeta();
}
function cerrar() { abierta = null; $('tarjeta').hidden = true; $('abajo').classList.remove('oculto'); }

function pintarTarjeta() {
  const s = sala(abierta), t = $('tarjeta');
  if (!s) return;
  const n = x => Number(x || 0).toLocaleString('es-CO');
  let cuerpo = '';
  if (s.tipo === 'stream') {
    const vivo = !!s.streamer?.enVivo, conectados = s.auto?.conectados;
    cuerpo = `
      <div class="cifras">
        <div class="ahora"><b>${vivo ? (conectados != null ? n(conectados) : '●') : '—'}</b><span>${vivo ? 'conectados ahora' : 'fuera del aire'}</span></div>
        <div><b>${n(s.capacidad || 0)}</b><span>lugares en el estadio</span></div>
      </div>
      <p class="nota">${vivo ? 'Brayan está en vivo: cada persona conectada entra al estadio.' : 'El estadio se llena cuando Brayan sale en vivo en TikTok.'}</p>
      <a class="ir" style="--c:#ff4d4d" href="${LIVE_TIKTOK}" target="_blank" rel="noopener noreferrer">${vivo ? '● Entra al LIVE' : 'Seguir en TikTok'}</a>`;
  } else if (s.tipo === 'red') {
    const ahora = viendoAhora(s);
    cuerpo = `
      <div class="cifras">
        <div><b>${cifra(s.seguidores)}</b><span>${esc(s.unidad || 'seguidores')}</span></div>
        <div class="ahora"><b>${ahora ? n(ahora) : '—'}</b><span>viendo ahora</span></div>
      </div>
      <p class="nota">Los seguidores duermen en el dormitorio; los que están viendo a Brayan en este momento se despiertan y suben al mirador.${ahora && !(s.auto?.ahora > 0) ? ' (Estimado con las vistas de la última hora.)' : ''}</p>
      ${s.url ? `<a class="ir" style="--c:${s.color}" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Abrir en ${NOMBRE_RED[s.red] || esc(s.nombre)} ↗</a>` : ''}`;
  } else if (s.tipo === 'festival') {
    cuerpo = `<ul class="lista" style="margin-top:12px">${(s.playlists || []).map(p => `
      <li><a href="${esc(p.url || '#')}" target="_blank" rel="noopener noreferrer"><span>${esc(p.nombre)}</span><small>${n(p.guardados)} ${esc(p.unidad || 'guardados')} ↗</small></a></li>`).join('')}</ul>
      ${(s.playlists || []).flatMap(p => p.top || []).length ? `<p class="nota" style="margin-top:12px">Más escuchadas: ${(s.playlists[0].top || []).slice(0, 3).map(x => esc(x.t)).join(' · ')}</p>` : ''}`;
  }
  t.innerHTML = `<button class="cerrar" aria-label="Cerrar">✕</button><h2><i style="background:${s.color}"></i>${esc(s.nombre)}</h2>${cuerpo}`;
  t.hidden = false;
  $('abajo').classList.add('oculto');
}
$('tarjeta').addEventListener('click', e => { if (e.target.closest('.cerrar')) { cerrar(); escena.enfocar(null); } });
$('general').addEventListener('click', () => { cerrar(); escena.enfocar(null); });

// ---------- Números en vivo ----------
async function leer(url) {
  try { const r = await fetch(url, {cache: 'no-store'}); return r.ok ? await r.json() : null; } catch { return null; }
}
async function traerVivo() {
  const salas = {...((VIVO && (await leer(VIVO))?.salas) || {})};
  if (ESTADO_LIVE) {
    const e = await leer(ESTADO_LIVE);
    if (e && typeof e.live === 'boolean') salas.live = {...salas.live, ok: true, enVivo: e.live};
  }
  let rearmar = false;
  for (const [id, d] of Object.entries(salas)) {
    const s = sala(id);
    if (!s || !d.ok) continue;
    s.auto = d;
    if (d.seguidores > 0 && Math.abs(d.seguidores - (s.seguidores || 0)) > Math.max(1, s.seguidores || 0) * 0.005) { s.seguidores = d.seguidores; rearmar = true; }
    if (s.tipo === 'stream' && typeof d.enVivo === 'boolean') s.streamer = {...s.streamer, enVivo: d.enVivo};
  }
  if (rearmar) escena.actualizar(state);
  const vivo = !!sala('live')?.streamer?.enVivo;
  $('vivo').classList.toggle('on', vivo);
  $('vivo').textContent = vivo ? 'EN VIVO · Entra' : 'fuera del aire';
  if (abierta) pintarTarjeta();
}

async function iniciar() {
  try {
    const r = await fetch(DATOS, {cache: 'no-store'});
    if (!r.ok) throw new Error(r.status);
    state = await r.json();
  } catch {
    $('cargando').textContent = 'DURO CITY todavía no está publicada.';
    return;
  }
  state.futuras ||= []; state.notas ||= []; state.misiones ||= [];
  escena.actualizar(state);
  $('cargando').remove();
  await traerVivo();
  setInterval(traerVivo, 30000);
}
function pedirEntrada() {
  $('cargando').hidden = true;
  $('entrada').hidden = false;
  $('clave').focus();
  $('formEntrada').addEventListener('submit', async e => {
    e.preventDefault();
    const boton = e.target.querySelector('button'), error = $('errorEntrada');
    boton.disabled = true; error.textContent = '';
    let estado = 0;
    try {
      // Una consulta de solo lectura: con la clave correcta responde 200 (o 404 si no hay LIVE); si no, 401
      const r = await fetch(LOGIN, {headers: {Authorization: `Bearer ${$('clave').value}`}, cache: 'no-store'});
      estado = r.status;
    } catch { error.textContent = 'No hay conexión. Intenta de nuevo.'; }
    boton.disabled = false;
    if (estado === 200 || estado === 404) {
      try { sessionStorage.setItem('duroCity', '1'); } catch {}
      $('clave').value = '';
      $('entrada').hidden = true; $('cargando').hidden = false;
      iniciar();
    } else if (estado) error.textContent = 'Clave incorrecta.';
  });
}
let adentro = false;
try { adentro = sessionStorage.getItem('duroCity') === '1'; } catch {}
if (LOGIN && !adentro) pedirEntrada(); else iniciar();
