// duro-ciudad: los números en vivo de DURO CITY (duroconbrayan.com/ciudad).
//
// Entrega SOLO números públicos en GET /publico: si Brayan está en vivo y cuántos están conectados,
// seguidores, vistas por hora y espectadores de directos. Nunca llaves ni datos privados.
// Es un Worker aparte: NO toca playlist-api. De DURO LIVE solo LEE dos cosas que ya existen:
//   - KV DURO_STATE, clave "live" (si está en vivo)
//   - D1 duro-playlist, tabla live_viewer_samples (la app DURO Live guarda una muestra por minuto)
// Una vez por hora (cron) consulta las APIs de las redes y guarda el resultado en su propio KV (CIUDAD).
// Así se ahorra cuota: las visitas de cada hora se reparten por minuto en DURO CITY.
//
// Llaves (secretos del Worker, nunca en el código): YOUTUBE_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET,
// y para la duración media de las vistas (YouTube Analytics): YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN.
// Lo que falte simplemente no se consulta.

const ORIGENES = ['https://duroconbrayan.com', 'https://www.duroconbrayan.com', 'http://localhost:4173', 'http://localhost:4174'];
const YOUTUBE_HANDLE = '@Brayanus14';
const TWITCH_LOGIN = 'duroconbrayan';
// Lo único de cada sala que sale al público
const CAMPOS_PUBLICOS = ['ok', 'enVivo', 'conectados', 'ahora', 'vistasHora', 'minutos', 'seguidores', 'actualizado',
  // Audiencia del directo: seguidores, nuevos que interactúan, nuevos seguidores del directo y los que solo miran
  'seguidoresVivo', 'nuevosVivo', 'nuevosSeguidores', 'dePaso', 'enFila', 'cancionesFila', 'filaLista'];

export default {
  async fetch(request, env) {
    const origen = request.headers.get('Origin');
    const cors = {'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0], 'Vary': 'Origin'};
    if (request.method === 'OPTIONS') return new Response(null, {headers: {...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS'}});
    const url = new URL(request.url);
    // Solo para la oficina personal de Brayan (con su token): estadísticas de Videos y Shorts. No es público.
    if (url.pathname === '/privado' && request.method === 'GET') {
      if (!env.OFICINA_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.OFICINA_TOKEN}`) return new Response('No autorizado', {status: 401});
      const e = (await env.CIUDAD.get('estado', 'json')) || {};
      const [live, app, extra] = await Promise.all([estadisticasLive(env).catch(() => null), estadisticasApp(env).catch(() => null),
        estructurasLive(env).catch(() => null)]);
      return Response.json({ytTipos: e.ytTipos || null, ytTipos28: e.ytTipos28 || null, live, app, extra}, {headers: {'Cache-Control': 'no-store'}});
    }
    if (url.pathname !== '/publico' || request.method !== 'GET') return new Response('No encontrado', {status: 404, headers: cors});

    const estado = (await env.CIUDAD.get('estado', 'json')) || {};
    const salas = {...(estado.salas || {})};
    // DURO LIVE se lee al momento (no espera al cron): así el estadio se prende apenas sales en vivo
    try { salas.live = await duroLive(env); } catch (e) { salas.live = {ok: false, actualizado: ahora()}; }
    const publicas = Object.fromEntries(Object.entries(salas).map(([id, d]) =>
      [id, Object.fromEntries(CAMPOS_PUBLICOS.map(k => [k, d?.[k] ?? null]))]));
    return Response.json({salas: publicas, ahora: ahora()}, {headers: {...cors, 'Cache-Control': 'public, max-age=20'}});
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(recolectar(env));
  },
};

const ahora = () => Math.floor(Date.now() / 1000);

// ---------- DURO LIVE (solo lectura) ----------
export async function duroLive(env) {
  const enVivo = (await env.DURO_STATE.get('live')) === 'true';
  let conectados = null, audiencia = {};
  if (enVivo) {
    // SELECT *: las columnas de audiencia solo existen cuando la app nueva ya mandó alguna muestra
    const fila = await env.DB.prepare('SELECT * FROM live_viewer_samples ORDER BY sampled_at DESC LIMIT 1').first();
    // Solo vale si la app la mandó hace poco (manda una por minuto)
    if (fila && Date.now() - Date.parse(fila.sampled_at) < 5 * 60 * 1000) {
      conectados = Number(fila.viewer_count) || 0;
      const n = v => (v == null ? null : Number(v) || 0);
      audiencia = {seguidoresVivo: n(fila.followers_count), nuevosVivo: n(fila.new_count),
        nuevosSeguidores: n(fila.new_followers_count), dePaso: n(fila.passing_count)};
    }
    // La fila de canciones (solo para seguidores): quién tiene canción pedida o sonando ahora
    const lista = await filaDeCanciones(env).catch(() => null);
    if (lista) Object.assign(audiencia, lista);
    else {
      const cola = await env.DB.prepare("SELECT COUNT(*) AS canciones, COUNT(DISTINCT COALESCE(tiktok_user_id, lower(username), id)) AS personas FROM requests WHERE status IN ('queue', 'playing')").first();
      audiencia.enFila = Number(cola?.personas) || 0;
      audiencia.cancionesFila = Number(cola?.canciones) || 0;
    }
  }
  return {ok: true, enVivo, conectados, ...audiencia, actualizado: ahora()};
}

// Estadísticas de los directos para la oficina privada (la bóveda «FUENTE #1 DE INGRESOS» y la pantalla de DURO LIVE):
// las mismas sesiones que guarda la app DURO Live. Ingresos = regalos de TikTok + PayPal + otros. Solo va por /privado.
async function estadisticasLive(env) {
  const filas = (await env.DB.prepare(`SELECT id, started_at, ended_at, status, tiktok_gifts_usd, paypal_revenue, other_revenue_usd,
    tiktok_diamonds, tiktok_donors, new_followers, peak_viewers, unique_viewers, tiktok_views, tiktok_likes, tiktok_comments,
    tiktok_shares, songs_processed FROM live_sessions ORDER BY started_at DESC, id DESC LIMIT 500`).all()).results || [];
  const n = v => Number(v) || 0;
  const fecha = t => t ? Date.parse(String(t).replace(' ', 'T') + (/[zZ+]/.test(String(t).slice(10)) ? '' : 'Z')) : NaN;
  const sesion = (f, i) => {
    const ini = fecha(f.started_at), fin = f.ended_at ? fecha(f.ended_at) : Date.now();
    return {numero: filas.length - i, enCurso: f.status === 'active' && !f.ended_at, inicio: f.started_at,
      usd: Math.round((n(f.tiktok_gifts_usd) + n(f.paypal_revenue) + n(f.other_revenue_usd)) * 100) / 100,
      regalosUsd: n(f.tiktok_gifts_usd), paypalUsd: n(f.paypal_revenue), diamantes: n(f.tiktok_diamonds), donadores: n(f.tiktok_donors),
      seguidores: n(f.new_followers), pico: n(f.peak_viewers), espectadores: n(f.unique_viewers) || n(f.tiktok_views),
      likes: n(f.tiktok_likes), comentarios: n(f.tiktok_comments), compartidos: n(f.tiktok_shares), canciones: n(f.songs_processed),
      minutos: Number.isFinite(ini) ? Math.max(0, Math.round((fin - ini) / 60000)) : 0, t: ini};
  };
  const sesiones = filas.map(sesion);
  const r2 = v => Math.round(v * 100) / 100;
  const suma = lista => ({directos: lista.length,
    usd: r2(lista.reduce((a, x) => a + x.usd, 0)),
    regalosUsd: r2(lista.reduce((a, x) => a + x.regalosUsd, 0)), paypalUsd: r2(lista.reduce((a, x) => a + x.paypalUsd, 0)),
    diamantes: lista.reduce((a, x) => a + x.diamantes, 0), donadores: lista.reduce((a, x) => a + x.donadores, 0),
    seguidores: lista.reduce((a, x) => a + x.seguidores, 0), minutos: lista.reduce((a, x) => a + x.minutos, 0),
    likes: lista.reduce((a, x) => a + x.likes, 0)});
  // Semana: últimos 7 días. Mes: el mes en curso en hora de Colombia (UTC-5)
  const co = new Date(Date.now() - 5 * 3600 * 1000), inicioMes = Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), 1) + 5 * 3600 * 1000;
  const semana = suma(sesiones.filter(x => x.t >= Date.now() - 7 * 86400 * 1000));
  const mes = suma(sesiones.filter(x => x.t >= inicioMes));
  const quitar = ({t, ...x}) => x;
  return {total: sesiones.length, ultimo: sesiones[0] ? quitar(sesiones[0]) : null, semana, mes,
    ultimos: sesiones.slice(0, 8).map(x => ({numero: x.numero, usd: x.usd}))};
}

// Lo que la app guarda y la oficina muestra como estructuras (todo privado, por /privado):
// salón de la fama (top de Gafas del mes y top de tap taps del directo), misiones del mes y las aprobadas hace poco
// (caminan a la sala de esa red), rocola (canciones más sonadas del mes y la que suena), meta de tap taps,
// capturas por revisar y, para la Casa, las tareas de hoy y los hábitos de la semana.
async function estructurasLive(env) {
  const co = new Date(Date.now() - 5 * 3600 * 1000), hoy = co.toISOString().slice(0, 10);
  // Inicio del mes y de la semana (lunes) en Colombia, como texto UTC comparable con CURRENT_TIMESTAMP
  const utc = t => new Date(t).toISOString().slice(0, 19).replace('T', ' ');
  const mesIni = utc(Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), 1) + 5 * 3600 * 1000);
  const dow = (co.getUTCDay() + 6) % 7, lunes = new Date(Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate() - dow)).toISOString().slice(0, 10);
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then(r => r.results || []).catch(() => []);
  const uno = (sql, ...a) => env.DB.prepare(sql).bind(...a).first().catch(() => null);
  const [gafas, likes, misiones, recientes, canciones, sonando, pendientes, tareas, habitos] = await Promise.all([
    q(`SELECT username AS usuario, SUM(coin_value * repeat_count) AS monedas, SUM(repeat_count) AS veces FROM gift_alerts
       WHERE created_at >= ? GROUP BY lower(username) ORDER BY monedas DESC LIMIT 5`, mesIni),
    uno(`SELECT total, base, top_users FROM live_likes WHERE id = 1`),
    q(`SELECT action AS accion, SUM(approved_count) AS aprobadas, SUM(submitted_count) AS enviadas FROM session_action_stats
       WHERE session_id IN (SELECT id FROM live_sessions WHERE started_at >= ?) GROUP BY action`, mesIni),
    q(`SELECT id, action AS accion, reviewed_at AS t FROM proofs WHERE status = 'approved' AND reviewed_at >= ? ORDER BY reviewed_at DESC LIMIT 30`,
      utc(Date.now() - 2 * 3600 * 1000)),
    q(`SELECT MIN(text) AS cancion, COUNT(*) AS veces FROM session_songs WHERE created_at >= ? GROUP BY lower(text) ORDER BY veces DESC LIMIT 5`, mesIni),
    uno(`SELECT text FROM requests WHERE status = 'playing' ORDER BY id DESC LIMIT 1`),
    uno(`SELECT COUNT(*) AS n FROM proofs WHERE status = 'pending'`),
    q(`SELECT title AS titulo, status AS estado, planned_time AS hora FROM daily_tasks WHERE task_date = ? ORDER BY sort_order, id`, hoy),
    q(`SELECT h.id, h.name AS nombre, h.target_per_week AS meta,
         (SELECT COUNT(*) FROM habit_logs l WHERE l.habit_id = h.id AND l.completed = 1 AND l.log_date >= ?) AS semana,
         (SELECT COUNT(*) FROM habit_logs l WHERE l.habit_id = h.id AND l.completed = 1 AND l.log_date = ?) AS hoy
       FROM habits h WHERE h.active = 1 ORDER BY h.sort_order, h.id`, lunes, hoy),
  ]);
  let top = [];
  try { top = JSON.parse(likes?.top_users || '[]').slice(0, 5).map(u => ({usuario: u.username, likes: Number(u.likes) || 0})); } catch {}
  const META = 5000, nuevos = Math.max(0, (Number(likes?.total) || 0) - (Number(likes?.base) || 0));
  return {
    fama: {gafas: gafas.map(x => ({usuario: x.usuario, monedas: Number(x.monedas) || 0, veces: Number(x.veces) || 0})), taptap: top},
    meta: {meta: META, progreso: nuevos % META, completadas: Math.floor(nuevos / META), likes: nuevos},
    misiones: misiones.map(x => ({accion: x.accion, aprobadas: Number(x.aprobadas) || 0, enviadas: Number(x.enviadas) || 0})),
    recientes: recientes.map(x => ({id: x.id, accion: x.accion, t: x.t})),
    rocola: {top: canciones.map(x => ({cancion: x.cancion, veces: Number(x.veces) || 0})), sonando: sonando?.text || null},
    bandeja: Number(pendientes?.n) || 0,
    casa: {fecha: hoy, tareas: tareas.map(x => ({titulo: x.titulo, hecha: x.estado === 'done' || x.estado === 'completed', hora: x.hora})),
      habitos: habitos.map(x => ({nombre: x.nombre, meta: Number(x.meta) || 7, semana: Number(x.semana) || 0, hoy: Number(x.hoy) > 0}))},
  };
}

// La pantalla de estadísticas de la app DURO Live, tal cual: GET /admin/monthly-stats de playlist-api (por el enlace
// interno), con la misma clave de administrador que usa la app. Mes en hora de Colombia. Sin la clave, no hay datos.
async function estadisticasApp(env) {
  if (!env.PLAYLIST || !env.DURO_ADMIN_KEY) return null;
  const co = new Date(Date.now() - 5 * 3600 * 1000), mes = co.toISOString().slice(0, 7);
  const r = await env.PLAYLIST.fetch(`https://playlist-api/admin/monthly-stats?month=${mes}`, {headers: {Authorization: `Bearer ${env.DURO_ADMIN_KEY}`}});
  if (!r.ok) return null;
  const d = await r.json();
  return {mes, actual: d.current || null, meses: d.months || []};
}

// La fila en orden (la que suena primero), una entrada por persona con el estado de su tap tap:
// a = activa, e = por vencer, i = inactiva (dejó de dar tap tap). Sin nombres: solo un número
// (el id de su primera canción) para que la arena reconozca a cada persona aunque la fila avance.
async function filaDeCanciones(env) {
  if (!env.PLAYLIST) return null;
  const r = await env.PLAYLIST.fetch('https://playlist-api/requests');
  if (!r.ok) return null;
  const canciones = (await r.json()).filter(c => c.status === 'queue' || c.status === 'playing')
    .sort((a, b) => (b.status === 'playing') - (a.status === 'playing') || a.sort_order - b.sort_order || a.id - b.id);
  const rango = {active: 'a', expiring: 'e', inactive: 'i'}, mejor = {a: 2, e: 1, i: 0};
  const personas = new Map();
  for (const c of canciones) {
    const clave = c.tiktok_user_id || String(c.username || '').toLowerCase() || `c${c.id}`;
    const e = rango[c.presence_status] || 'a', p = personas.get(clave);
    if (!p) personas.set(clave, {id: c.id, e});
    else if (mejor[e] > mejor[p.e]) p.e = e;   // con varias canciones vale la más activa
  }
  const fila = [...personas.values()];
  return {enFila: fila.length, cancionesFila: canciones.length, filaLista: fila};
}

// ---------- Recolección (cada hora) ----------
export async function recolectar(env, pedir = pedirJSON) {
  const estado = (await env.CIUDAD.get('estado', 'json')) || {};
  estado.salas ||= {}; estado.historial ||= {}; estado.tokens ||= {};
  const fuentes = {youtube, twitch};
  for (const [sala, fn] of Object.entries(fuentes)) {
    try {
      const r = await fn(env, estado, pedir);
      if (r) estado.salas[sala] = {...r, actualizado: ahora()};
    } catch (e) {
      // Un error no borra el último dato bueno
      estado.salas[sala] = {...estado.salas[sala], ok: false, error: String(e.message || e).slice(0, 200), actualizado: ahora()};
    }
  }
  await env.CIUDAD.put('estado', JSON.stringify(estado));
  return estado;
}

async function pedirJSON(url, opciones = {}) {
  const r = await fetch(url, opciones);
  const texto = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${texto.slice(0, 160)}`);
  return texto ? JSON.parse(texto) : null;
}
const conParams = (base, p) => base + '?' + new URLSearchParams(Object.entries(p).filter(([, v]) => v != null)).toString();

// Guarda el total de vistas y calcula cuántas sumó en la última hora (o lo que haya medido)
export function vistasPorHora(estado, sala, total, t = ahora()) {
  const h = (estado.historial[sala] ||= []);
  h.push([t, total]);
  estado.historial[sala] = h.filter(p => t - p[0] <= 3 * 3600);
  // Contra la medición anterior más reciente que tenga al menos 10 minutos (con el cron, la de hace una hora)
  const base = [...estado.historial[sala]].reverse().find(p => t - p[0] >= 600);
  if (!base) return null;
  return Math.max(0, Math.round((total - base[1]) * 3600 / (t - base[0])));
}

// ---------- YouTube (Data API v3, solo API key) ----------
async function youtube(env, estado, pedir) {
  const key = env.YOUTUBE_API_KEY;
  if (!key) return {ok: false, nota: 'falta YOUTUBE_API_KEY'};
  const api = 'https://www.googleapis.com/youtube/v3';
  const canal = await pedir(conParams(`${api}/channels`, {part: 'statistics,contentDetails', forHandle: YOUTUBE_HANDLE, key}));
  const item = canal?.items?.[0];
  if (!item) throw new Error('no encontré el canal');
  const stats = item.statistics || {};
  const seguidores = stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount || 0);
  // Si falla la duración media, igual siguen las vistas
  let minutos = estado.ytDuracion?.minutos || null;
  try { minutos = await duracionYouTube(env, estado, pedir); } catch (e) { estado.ytDuracionError = String(e.message || e).slice(0, 160); }
  // Todos los videos del canal. La lista se renueva cada 3 horas, y esa vez no se suman vistas:
  // así ninguna corrida pasa de 50 consultas (el límite gratis de un Worker).
  const cache = (estado.youtubeIds ||= {});
  if (!cache.ids?.length || ahora() - (cache.cuando || 0) > 3 * 3600) {
    const ids = [];
    let pagina = null;
    for (let i = 0; i < 40; i++) {
      const lista = await pedir(conParams(`${api}/playlistItems`, {part: 'contentDetails', playlistId: item.contentDetails.relatedPlaylists.uploads, maxResults: 50, pageToken: pagina, key}));
      ids.push(...(lista?.items || []).map(x => x.contentDetails.videoId));
      pagina = lista?.nextPageToken;
      if (!pagina) break;
    }
    Object.assign(cache, {ids, cuando: ahora()});
    return {...estado.salas.youtube, ok: true, seguidores, minutos};
  }
  let total = 0, directo = 0;
  // Videos y Shorts por separado. La API no dice cuál es Short: se toma como Short lo que dura 3 minutos o menos
  // (es una aproximación; los números de los últimos 28 días por tipo sí son exactos, salen de Analytics).
  const tipo = () => ({n: 0, vistas: 0, likes: 0, top: []});
  const tipos = {videos: tipo(), shorts: tipo()};
  for (let i = 0; i < cache.ids.length; i += 50) {
    // Pedir más partes no cuesta más cuota: sigue siendo 1 unidad por consulta
    const videos = await pedir(conParams(`${api}/videos`, {part: 'statistics,liveStreamingDetails,contentDetails,snippet', id: cache.ids.slice(i, i + 50).join(','), key}));
    for (const v of videos?.items || []) {
      const vistas = Number(v.statistics?.viewCount || 0);
      total += vistas;
      directo += Number(v.liveStreamingDetails?.concurrentViewers || 0);
      const T = tipos[segundosISO(v.contentDetails?.duration) <= 180 ? 'shorts' : 'videos'];
      T.n++; T.vistas += vistas; T.likes += Number(v.statistics?.likeCount || 0);
      T.top.push({t: String(v.snippet?.title || '').slice(0, 70), v: vistas});
    }
  }
  for (const T of Object.values(tipos)) T.top = T.top.sort((a, b) => b.v - a.v).slice(0, 3);
  estado.ytTipos = {...tipos, cuando: ahora()};
  return {ok: true, seguidores, minutos, vistasHora: vistasPorHora(estado, 'youtube', total), ahora: directo || null};
}

// Duración media de las vistas del canal, con YouTube Analytics (necesita que Brayan autorice su canal una vez:
// autorizar_youtube.py). Es el promedio de los últimos 28 días; YouTube lo publica con ~2 días de atraso,
// así que basta pedirlo cada 6 horas.
export async function duracionYouTube(env, estado, pedir) {
  if (!env.YT_CLIENT_ID || !env.YT_CLIENT_SECRET || !env.YT_REFRESH_TOKEN) return estado.ytDuracion?.minutos || null;
  const c = (estado.ytDuracion ||= {});
  if (c.minutos && estado.ytTipos28 && ahora() - (c.cuando || 0) < 6 * 3600) return c.minutos;
  const tok = await pedir('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: 'refresh_token'}).toString()});
  const dia = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const r = await pedir(conParams('https://youtubeanalytics.googleapis.com/v2/reports',
    {ids: 'channel==MINE', startDate: dia(30), endDate: dia(2), metrics: 'averageViewDuration,views'}),
    {headers: {Authorization: `Bearer ${tok.access_token}`}});
  const segundos = Number(r?.rows?.[0]?.[0] || 0);
  if (segundos > 0) Object.assign(c, {minutos: Math.round(segundos / 6) / 10, cuando: ahora()});
  // Los últimos 28 días separados por tipo de contenido (Shorts, videos, directos): esto sí es exacto
  try {
    const t = await pedir(conParams('https://youtubeanalytics.googleapis.com/v2/reports',
      {ids: 'channel==MINE', startDate: dia(30), endDate: dia(2), dimensions: 'creatorContentType',
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained'}),
      {headers: {Authorization: `Bearer ${tok.access_token}`}});
    estado.ytTipos28 = Object.fromEntries((t?.rows || []).map(([tipo, vistas, minutos, dur, subs]) =>
      [tipo, {vistas: Number(vistas), minutos: Number(minutos), duracion: Number(dur), suscriptores: Number(subs)}]));
    estado.ytTipos28.cuando = ahora();
  } catch (e) { estado.ytTipos28Error = String(e.message || e).slice(0, 160); }
  return c.minutos || null;
}

// «PT1M5S» → 65 segundos
export function segundosISO(d) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(String(d || '')) || [];
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

// ---------- Twitch (Helix, token de app) ----------
async function twitch(env, estado, pedir) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) return {ok: false, nota: 'faltan las llaves de Twitch'};
  let t = estado.tokens.twitch;
  if (!t || t.vence < ahora() + 300) {
    const r = await pedir('https://id.twitch.tv/oauth2/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials'}).toString()});
    t = estado.tokens.twitch = {token: r.access_token, vence: ahora() + Number(r.expires_in || 3600)};
  }
  const r = await pedir(conParams('https://api.twitch.tv/helix/streams', {user_login: TWITCH_LOGIN}),
    {headers: {'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${t.token}`}});
  const directo = r?.data?.[0];
  return {ok: true, enVivo: !!directo, ahora: directo ? Number(directo.viewer_count) : 0};
}
