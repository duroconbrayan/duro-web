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
const CAMPOS_PUBLICOS = ['ok', 'enVivo', 'conectados', 'ahora', 'vistasHora', 'minutos', 'seguidores', 'actualizado'];

export default {
  async fetch(request, env) {
    const origen = request.headers.get('Origin');
    const cors = {'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0], 'Vary': 'Origin'};
    if (request.method === 'OPTIONS') return new Response(null, {headers: {...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS'}});
    const url = new URL(request.url);
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
  let conectados = null;
  if (enVivo) {
    const fila = await env.DB.prepare('SELECT viewer_count, sampled_at FROM live_viewer_samples ORDER BY sampled_at DESC LIMIT 1').first();
    // Solo vale si la app la mandó hace poco (manda una por minuto)
    if (fila && Date.now() - Date.parse(fila.sampled_at) < 5 * 60 * 1000) conectados = Number(fila.viewer_count) || 0;
  }
  return {ok: true, enVivo, conectados, actualizado: ahora()};
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
  for (let i = 0; i < cache.ids.length; i += 50) {
    const videos = await pedir(conParams(`${api}/videos`, {part: 'statistics,liveStreamingDetails', id: cache.ids.slice(i, i + 50).join(','), key}));
    for (const v of videos?.items || []) {
      total += Number(v.statistics?.viewCount || 0);
      directo += Number(v.liveStreamingDetails?.concurrentViewers || 0);
    }
  }
  return {ok: true, seguidores, minutos, vistasHora: vistasPorHora(estado, 'youtube', total), ahora: directo || null};
}

// Duración media de las vistas del canal, con YouTube Analytics (necesita que Brayan autorice su canal una vez:
// autorizar_youtube.py). Es el promedio de los últimos 28 días; YouTube lo publica con ~2 días de atraso,
// así que basta pedirlo cada 6 horas.
export async function duracionYouTube(env, estado, pedir) {
  if (!env.YT_CLIENT_ID || !env.YT_CLIENT_SECRET || !env.YT_REFRESH_TOKEN) return estado.ytDuracion?.minutos || null;
  const c = (estado.ytDuracion ||= {});
  if (c.minutos && ahora() - (c.cuando || 0) < 6 * 3600) return c.minutos;
  const tok = await pedir('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: 'refresh_token'}).toString()});
  const dia = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const r = await pedir(conParams('https://youtubeanalytics.googleapis.com/v2/reports',
    {ids: 'channel==MINE', startDate: dia(30), endDate: dia(2), metrics: 'averageViewDuration,views'}),
    {headers: {Authorization: `Bearer ${tok.access_token}`}});
  const segundos = Number(r?.rows?.[0]?.[0] || 0);
  if (segundos > 0) Object.assign(c, {minutos: Math.round(segundos / 6) / 10, cuando: ahora()});
  return c.minutos || null;
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
