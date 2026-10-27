// Motor de la oficina: estados, escalas y geometría de cada sala. Es público (lo usa también DURO CITY):
// aquí no va ningún dato privado; la semilla con tus datos está en semilla.js.
export const STORE = 'duro-oficina-v1';

export const ESTADOS = {
  hecho:      {l: 'Hecho',          c: '#3ddc84'},
  desarrollo: {l: 'En desarrollo',  c: '#ffb020'},
  pendiente:  {l: 'Pendiente',      c: '#c9d1e0'},
  confirmar:  {l: 'Por confirmar',  c: '#6ea8ff'},
  idea:       {l: 'Idea',           c: '#a48cff'},
  bloqueado:  {l: 'Bloqueado',      c: '#ff5470'},
};
export const AGENTE_ESTADOS = {
  activo:    'Activo',
  confirmar: 'Existe · por revisar',
  planeado:  'Planeado',
};

// Capacidad del público: la que fijó Brayan; si no hay, el promedio de conectados más alto en una hora
export function aforo(s) {
  if (s.aforo > 0) return s.aforo;
  const v = Object.values(s.stats?.conectadosPorHora || {});
  return v.length ? Math.ceil(Math.max(...v)) : 15;
}
// Conectados esperados a una hora de Colombia (si no hay dato para esa hora, el promedio del día)
export function conectadosEsperados(s, hora) {
  const t = s.stats?.conectadosPorHora || {};
  if (t[hora] != null) return t[hora];
  const v = Object.values(t);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 10;
}
export const horaColombia = () => (new Date().getUTCHours() + 19) % 24;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];

// Tamaño del proyecto: cada agente pesa más que una tarea. Crece con lo que tenga la sala en ese momento.
export function pesoProyecto(s) { return s.agentes.length * 1.5 + s.tareas.length * 0.5; }
export function ladoSala(s) {
  const porProyecto = Math.min(9.5, Math.max(4.5, 4 + pesoProyecto(s) * 0.3));
  // ladoMin: pegada a otra sala, la iguala en tamaño (DURO LIVE detrás de TikTok, para que queden simétricas)
  return Math.round(Math.max(porProyecto, ladoPorAudiencia(s), s.ladoMin || 0) * 2) / 2;
}
// Las salas de redes crecen con su audiencia: 40 mil ≈ 6,5 · 210 mil ≈ 8 · 1,2 millones ≈ 9,5
export function ladoPorAudiencia(s) {
  if (s.tipo !== 'red' || !(s.seguidores > 0)) return 0;
  return Math.min(11, Math.max(5, 5 + 2.2 * Math.log10(s.seguidores / 10000)));
}
export function cifra(n) {
  if (!(n > 0)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('es-CO', {maximumFractionDigits: 1})} M`;
  if (n >= 1e3) return `${Math.round(n / 1e3).toLocaleString('es-CO')} mil`;
  return n.toLocaleString('es-CO');
}

// Súper oficina (TikTok y DURO LIVE): cada equipo trabaja en su módulo, afuera de su sala, pegado a su costado derecho.
// zo: dónde empieza el módulo (de atrás hacia adelante). 2 filas × 3 escritorios, con su pasillo, café, planta y ventana.
export const OFICINA = {ancho: 6.6, fondo: 4.6};
// xo, zo: esquina del módulo (la de atrás a la izquierda) en las coordenadas de la sala; rz: centro de la sala de
// reuniones que comparten los dos equipos (ahí van los que no están haciendo nada en el momento)
export function moduloOficina(xo, zo, rz) {
  const carril = xo + 6.2;
  const escritorio = i => ({x: xo + 0.4 + (i % 3) * 1.9, z: zo + 0.4 + Math.floor(i / 3) * 1.85});
  return {cols: 3, filas: 2, cap: 6, carril, escritorio,
    silla: i => { const d = escritorio(i); return {x: d.x + 0.8, z: d.z + 1.2}; },
    cafe: {x: carril, z: zo + 0.95, tag: 'cafe', mz: zo + 0.25},
    planta: {x: carril, z: zo + 3.9, tag: 'planta'},
    ventana: {x: carril, z: zo + 4.2, tag: 'live'},
    reunion: rz == null ? null : [-1, 0, 1].flatMap(dx => [-1, 1].map(sz => ({x: xo + OFICINA.ancho / 2 + dx * 0.9, z: rz + sz * 0.95,
      tag: 'reunion', mira: {x: xo + OFICINA.ancho / 2, z: rz}})))};
}

// Geometría del piso de una sala de lado L (x hacia la derecha, z hacia el frente; paredes en x=-L/2 y z=-L/2).
// Se guarda en memoria: las salas grandes generan miles de posiciones y no hace falta repetirlas si nada cambió.
const cacheGeo = new Map();
export function geometria(s, L = ladoSala(s)) {
  const clave = JSON.stringify([s.id, s.tipo, L, s.oficina, s.entradaAlFrente, s.seguidores, s.tipo === 'red' ? [seguidoresPorPersona(s), viendoAhora(s)] : 0, s.aforo, s.agentes.length,
    s.playlists?.map(p => p.guardados), s.tipo === 'stream' ? [s.stats?.conectadosPorHora, gradasArena(s)] : 0]);
  if (!cacheGeo.has(clave)) {
    if (cacheGeo.size > 200) cacheGeo.clear();
    cacheGeo.set(clave, calcularGeometria(s, L));
  }
  return cacheGeo.get(clave);
}
function calcularGeometria(s, L) {
  if (s.tipo === 'stream') return geometriaStream(s, L);   // crece lo necesario para el aforo
  if (s.tipo === 'red') return geometriaRed(s, L);
  if (s.tipo === 'festival') return geometriaFestival(s);
  if (s.tipo === 'casa') return geometriaCasa();
  const X0 = -L / 2, Z0 = -L / 2;
  const cols = Math.floor((L - 2.6) / 2.8) + 1;
  const filas = Math.floor((L - 2.3) / 1.85) + 1;
  // Los escritorios ocupados se centran en el piso para que una sala grande no quede vacía adelante
  const n = Math.min(s.agentes.length, cols * filas);
  const usadas = Math.max(1, Math.ceil(n / cols)), colsUsadas = Math.max(1, Math.min(cols, n));
  const ox = (cols - colsUsadas) * 1.4, oz = (filas - usadas) * 0.925;
  const escritorio = i => ({x: X0 + ox + 0.7 + (i % cols) * 2.8, z: Z0 + oz + 0.8 + Math.floor(i / cols) * 1.85});
  const carril = X0 + ox + 2.9;
  return {
    L, X0, Z0, cols, filas, cap: cols * filas, carril, escritorio,
    silla: i => { const d = escritorio(i); return {x: d.x + 0.8, z: d.z + 1.2}; },
    cafe: {x: carril, z: Z0 + 1.0, tag: 'cafe'},
    planta: {x: X0 + L - 0.85, z: Z0 + oz + 2.0 + (usadas - 1) * 1.85, tag: 'planta'},
    ventana: {x: X0 + 0.45, z: Z0 + oz + 2.0, tag: 'ventana'},
  };
}

// Arena DURO LIVE: escenario circular al centro, público en anillos completos (360°, simétricos)
// y la producción en un palco elevado de vidrio en la esquina del fondo, por encima del público.
function geometriaStream(s, Lmin) {
  const B = 5.6;                                     // palco: lado
  const cupo = sillasArena(s), paso = 0.55, dR = 0.8;
  const PASILLO = 1.1;                               // ancho del pasillo de entrada (al frente, hacia la cámara)
  // La entrada mira a la esquina de adelante; pegada a TikTok mira de frente a TikTok (la escalera llega por el medio)
  const alFrente = !!s.entradaAlFrente, frente = alFrente ? Math.PI / 2 : Math.PI / 4;
  // Un estadio: el escenario, la pantalla y el truss crecen con la gente de las gradas
  const gente = gradasArena(s), k = Math.min(2.2, 1 + gente / 8000);
  const RE = 2.2 * k, R0 = RE + 1.0;
  const arcoDe = (r, ancho) => 2 * Math.PI - ancho / r;     // cada anillo deja libre el pasillo
  // Pista (los conectados en vivo): cuántos anillos hacen falta, y las sillas se reparten con la misma densidad en todos
  const radios = [];
  for (let capacidad = 0, r = R0; capacidad < cupo && radios.length < 12; r += dR) { radios.push(r); capacidad += Math.floor(arcoDe(r, PASILLO) * r / paso); }
  const repartir = (rs, total, ancho) => {
    const suma = rs.reduce((x, r) => x + r, 0);
    const fs = rs.map(r => ({r, n: Math.floor(total * r / suma), hueco: ancho / (2 * r)}));
    for (let i = fs.length - 1, resto = total - fs.reduce((x, a) => x + a.n, 0); resto > 0 && fs.length; i = (i - 1 + fs.length) % fs.length, resto--) fs[i].n++;
    return fs;
  };
  const anillos = repartir(radios, cupo, PASILLO);
  const rMax = anillos.at(-1)?.r ?? R0;
  const C = {x: 0, z: 0};
  // Sillas repartidas parejo en el arco de cada anillo, simétricas respecto al pasillo
  const sentar = (filas, alturaDe) => {
    const out = [];
    filas.forEach((a, fila) => {
      const arco = 2 * Math.PI - 2 * a.hueco;
      for (let j = 0; j < a.n; j++) {
        const phi = frente + a.hueco + (j + 0.5) * arco / a.n;
        // Qué tan cerca del pasillo está (0 = junto al pasillo) y de qué lado
        const cerca = Math.min(j, a.n - 1 - j), lado = j < a.n / 2 ? 0 : 1;
        out.push({fila, phi, r: a.r, x: C.x + Math.cos(phi) * a.r, z: C.z + Math.sin(phi) * a.r, y: alturaDe(fila), cerca, lado});
      }
    });
    return out;
  };
  const asientos = sentar(anillos, f => 0.22 + f * 0.2);
  // Orden de llenado: anillo de adentro primero, desde el pasillo hacia atrás, alternando lados (siempre simétrico)
  const ordenar = lista => lista.map((_, i) => i).sort((a, b) => lista[a].fila - lista[b].fila || lista[a].cerca - lista[b].cerca || lista[a].lado - lista[b].lado);
  const orden = ordenar(asientos);
  // Gradas del estadio: los espectadores del último LIVE, 1 a 1, en filas que suben
  const PAS_G = 1.6, dG = 0.6, hG = 0.24, rG0 = rMax + 1.8, yG0 = 0.22 + anillos.length * 0.2 + 0.15;
  const radiosG = [];
  for (let capacidad = 0, r = rG0; capacidad < gente && radiosG.length < 120; r += dG) { radiosG.push(r); capacidad += Math.floor(arcoDe(r, PAS_G) * r / PASO); }
  const filasG = repartir(radiosG, gente, PAS_G).map((f, i) => ({...f, y: yG0 + i * hG}));
  const enGradas = sentar(filasG, f => yG0 + f * hG);
  const posGradas = ordenar(enGradas).map(i => enGradas[i]);
  // Sin gradas el muro de la arena encierra también el pasillo de atrás, donde se quedan de pie los de paso
  const rFin = radiosG.length ? radiosG.at(-1) + 0.6 : rMax + 1.8;
  // El palco de producción queda por encima de la última fila, para ver el escenario por encima del público
  // Sin gradas la oficina queda en el piso de la sala (al nivel del mezzanine de TikTok, con el que la comparte)
  // Con la oficina en el penthouse, el piso del equipo es el del penthouse (s.oficina.y, en coordenadas de la sala)
  const yPiso = s.oficina ? s.oficina.y ?? 0 : gente > 0 ? Math.max(3.6, yG0 + filasG.length * hG + 1.2) : 0;
  // La sala deja libres las cuatro esquinas: palco (fondo), sala de máquinas y bóveda (lados), entrada (frente)
  // Sala de máquinas y bóveda (las dos iguales, simetría). Pegada a TikTok la sala es compacta: un poco más chicas
  const Bc = alFrente ? 4.8 : B;
  // Parque de DURO LIVE: adentro, en la esquina de adelante, a los dos lados del camino que llega a la entrada
  // (en espejo respecto al eje de la arena). Un par de ruedas de la fortuna: la sala es compacta, para 100 personas.
  const dEnt = rFin + 1.2, rA = 2.1, lado = 3.3, pasos = [dEnt + 3.0];
  // De frente (pegada a TikTok) las dos ruedas van a los costados de la arena, en espejo, y no delante: la sala queda
  // compacta. aR: ángulo desde el eje de la entrada; rR: distancia al centro
  const aR = 0.95, rR = rFin + rA + 0.4;
  // Justo lo que ocupa lo de adentro
  const mitad = alFrente
    ? Math.max(rFin + 1.0, (rFin + 0.3) / Math.SQRT2 + Bc, rR * Math.sin(aR) + rA + 0.3, rR * Math.cos(aR) + rA + 0.3, dEnt + 1.8)
    : Math.max(rFin + 2.2, (rFin + 0.8) / Math.SQRT2 + Bc, (pasos.at(-1) + lado) / Math.SQRT2 + rA + 0.3);
  const L = Math.max(Lmin, Math.ceil(mitad * 8) / 4);
  const X0 = -L / 2, Z0 = -L / 2;
  const entrada = {x: C.x + Math.cos(frente) * dEnt, z: C.z + Math.sin(frente) * dEnt};
  // Punto sobre el eje, en la esquina de adelante: por ahí entra el paseo que viene de TikTok
  const dEsq = alFrente ? L / 2 - 0.3 : (L / 2) * Math.SQRT2 - 0.5;
  const eje = d => ({x: C.x + Math.cos(frente) * d, z: C.z + Math.sin(frente) * d});
  const perp = {x: -Math.sin(frente), z: Math.cos(frente)};
  const atracciones = [];
  if (alFrente) for (const sg of [-1, 1]) atracciones.push({tipo: 'rueda', r: rA, x: C.x + Math.cos(frente + sg * aR) * rR, z: C.z + Math.sin(frente + sg * aR) * rR});
  // Y dos carruseles pequeños en espejo entre los portales y las ruedas (también son para jugar)
  if (alFrente) for (const sg of [-1, 1]) atracciones.push({tipo: 'carrusel', r: 1.0, color: sg < 0 ? '#ff7ab6' : '#38e8ff', x: C.x + sg * 4.4, z: C.z + Math.sin(frente) * (rFin + 1.6)});
  else [['rueda', pasos[0]]].forEach(([tipo, d]) => {
    for (const sg of [-1, 1]) { const e = eje(d); atracciones.push({tipo, r: rA, x: e.x + perp.x * lado * sg, z: e.z + perp.z * lado * sg}); }
  });
  // El camino del parque llega hasta la esquina de adelante: por ahí sube la escalera desde TikTok, sobre el mismo eje
  const fin = alFrente ? L / 2 - 1.0 : dEsq - 0.3;
  const parque = {esquina: eje(dEsq), dEnt, dEsq, fin, atracciones, ancho: 2.4,
    // Dos portales a los lados del camino, pegados a la puerta de la arena: por uno salen los nuevos (y los de paso), por el otro se van
    portales: {nuevos: (e => ({x: e.x - perp.x * 1.9, z: e.z - perp.z * 1.9}))(eje(dEnt - 0.5)),
      salida: (e => ({x: e.x + perp.x * 1.9, z: e.z + perp.z * 1.9}))(eje(dEnt - 0.5))}};
  // Los de paso (conectados que nunca interactúan) se quedan de pie en el pasillo de atrás de la pista, entre la pista y las gradas,
  // solo en la mitad de los que no te siguen (así las dos mitades quedan bien separadas)
  const dePaso = [];
  for (const r of [rMax + 0.75, rMax + 1.25]) {
    const hueco = (PASILLO + 0.4) / (2 * r), arco = 2 * Math.PI - 2 * hueco, n = Math.floor(arco * r / 0.5);
    for (let j = Math.ceil(n / 2); j < n; j++) { const phi = frente + hueco + (j + 0.5) * arco / n; dePaso.push({x: C.x + Math.cos(phi) * r, z: C.z + Math.sin(phi) * r, phi, r, cerca: n - 1 - j}); }
  }
  // La fila de canciones (solo seguidores): de dos en dos por el pasillo, del escenario hacia la entrada, dejando
  // libre el medio para los que entran. El #1 y el #2 quedan pegados al escenario; caben unas 22 personas.
  const filaCanciones = [];
  for (let d = RE + 0.7; d < fin - 0.3 && filaCanciones.length < 200; d += 0.55) for (const sg of [-1, 1]) {
    const e = eje(d); filaCanciones.push({x: e.x + perp.x * 0.3 * sg, z: e.z + perp.z * 0.3 * sg});
  }
  dePaso.sort((a, b) => a.cerca - b.cerca);
  // Oficina del equipo (palco): 2 columnas × 3 filas de escritorios y un pasillo a la derecha. Va en la esquina de
  // adelante a la izquierda, la que toca la pared del equipo de TikTok (la comparten como una sola oficina)
  const PZ = -Z0 - B;
  const escritorio = i => ({x: X0 + 0.3 + (i % 2) * 1.9, z: PZ + 0.4 + Math.floor(i / 2) * 1.85});
  const carril = X0 + 4.4;
  const yJ = 4.5 + (k - 1) * 3, yT = 5.6 + (k - 1) * 3.4;
  // Con la súper oficina el equipo trabaja en su módulo (adelante, pegado a TikTok); si no, en el palco de la esquina
  const oficina = s.oficina ? moduloOficina(s.oficina.xo, s.oficina.zo, s.oficina.rz) : {
    cols: 2, filas: 3, cap: 6, carril, escritorio,
    silla: i => { const d = escritorio(i); return {x: d.x + 0.8, z: d.z + 1.2}; },
    cafe: {x: carril, z: PZ + B - 0.6, tag: 'cafe'},
    planta: {x: X0 + 4.95, z: PZ + 0.3, tag: 'planta'},
    // Desde el vidrio de la oficina miran el LIVE
    ventana: {x: carril, z: PZ + 0.3, tag: 'live'}};
  return {
    L, X0, Z0, yPiso, ...oficina,
    stream: {B, PZ, C, radioEscenario: RE, k, yJ, yT, anchoJ: 2.0 * k, anillos, asientos, orden, entrada, frente, pasillo: PASILLO, aforo: cupo,
      dePaso, filaCanciones, gradas: {filas: filasG, posiciones: posGradas, pasillo: PAS_G, alto: yG0 + filasG.length * hG, rFin},
      maquinas: s.oficina && !alFrente ? {x: X0 + Bc / 2, z: -Z0 - Bc / 2, B: Bc} : {x: X0 + Bc / 2, z: Z0 + Bc / 2, B: Bc}, boveda: {x: -X0 - Bc / 2, z: Z0 + Bc / 2, B: Bc}, parque},
  };
}

// Sala de una red: Brayan (su holograma) es el protagonista en un escenario frente a la pantalla de la red,
// la comunidad (los seguidores) lo mira desde el piso y el equipo trabaja aparte en un mezzanine al fondo.
// La comunidad es tan real como se pueda: 1 a 1 hasta MAX_PERSONAS, y la sala crece lo que haga falta.
function geometriaRed(s, L) {
  for (let intento = 0; intento < 40; intento++) {
    const X0 = -L / 2, Z0 = -L / 2, yPiso = s.oficina?.y ?? 2.8;
    const cols = Math.floor((L - 2.6) / 2.8) + 1;
    const filas = Math.max(1, Math.min(2, Math.ceil(s.agentes.length / cols)));
    const nAg = Math.min(s.agentes.length, cols * filas);
    const ox = (cols - Math.max(1, Math.min(cols, nAg))) * 1.4;
    const D = filas * 1.85 + 0.75;            // fondo del mezzanine del equipo
    const n = personasRed(s);
    const k = Math.min(4, Math.max(1, L / 12));
    // Adentro: el escenario de Brayan y el mirador (media luna) de los que lo están viendo, con lugar para un 30 % más
    const rIn = 1.5 * k, cupoAhora = Math.ceil(viendoAhora(s) * 1.3);
    const rZ = Math.max(rIn + 1.4, Math.sqrt(rIn * rIn + 2 * cupoAhora * PASO * PASO * 0.87 * 1.2 / Math.PI));
    const z0 = Z0 + D + 0.45, z1 = Z0 + L - 0.35;
    const zc = (z0 + z1) / 2;
    const escenario = {x: X0 + 1.25 * k, z: zc, r: 0.75 * k};
    // Muro con la entrada: separa la sala (adentro) del parque de diversiones (afuera) donde están los seguidores
    const xMuro = escenario.x + rZ + 2.6;
    const px0 = xMuro + 0.6, px1 = X0 + L - 0.4;
    // El parque: tantas atracciones como quepan (1 cada ~150 m²) y la gente alrededor, distraída
    const kr = Math.min(2, Math.sqrt(k)), rAtr = 2.1 * kr;
    const areaGente = n * PASO * PASO * 0.87 * 1.15;
    const nAtr = Math.max(1, Math.min(6, Math.round(areaGente / 150) + 1));
    const area = areaGente + nAtr * Math.PI * (rAtr + 0.5) ** 2;
    const libre = Math.max(0, px1 - px0) * (z1 - z0);
    if (z1 - z0 < 2 * rZ + 1.2 || px1 - px0 < 2 * rAtr + 1.5 || libre < area) {
      // Crece de a poco: lo que le falta al lado del cuadrado que necesita el parque
      L = Math.ceil((L + Math.max(1, Math.sqrt(area) - Math.sqrt(libre))) * 2) / 2;
      continue;
    }
    // Atracciones repartidas en una grilla dentro del parque
    const atracciones = [];
    const colsA = Math.max(1, Math.round(Math.sqrt(nAtr * (px1 - px0) / (z1 - z0))));
    const filasA = Math.ceil(nAtr / colsA);
    for (let i = 0; i < nAtr; i++) {
      const c = i % colsA, f = Math.floor(i / colsA);
      atracciones.push({x: px0 + (c + 0.5) * (px1 - px0) / colsA, z: z0 + (f + 0.5) * (z1 - z0) / filasA, r: rAtr,
        tipo: ['rueda', 'carrusel', 'puesto', 'rueda', 'puesto', 'carrusel'][i]});
    }
    const escritorio = i => ({x: X0 + ox + 0.7 + (i % cols) * 2.8, z: Z0 + 0.8 + Math.floor(i / cols) * 1.85});
    const carril = X0 + ox + 2.9;
    const equipo = {x: X0 + 2.55 * k, z: zc + 0.6 * k};
    const entrada = {x: xMuro, z: zc, ancho: 1.8};
    const posiciones = [], enVivo = [];
    for (let z = z0, fila = 0; z <= z1; z += PASO, fila++) {
      for (let x = X0 + 0.4 + (fila % 2) * PASO / 2; x <= px1; x += PASO) {
        const dE = Math.hypot(x - escenario.x, z - escenario.z);
        if (x < xMuro) {
          // Adentro solo está el mirador
          if (dE >= rIn && dE < rZ - 0.2 && x > escenario.x) enVivo.push({x, z});
          continue;
        }
        if (x < px0) continue;                                                                // el muro
        if (Math.abs(z - zc) < 1.2 && x < px0 + 1.4) continue;                                 // frente a la entrada
        if (atracciones.some(a => Math.hypot(x - a.x, z - a.z) < a.r + 0.45)) continue;        // las atracciones
        posiciones.push({x, z});
      }
    }
    // Los que primero entran a ver son los que están más cerca de la entrada
    const aEntrada = p => Math.round(Math.hypot(p.x - entrada.x, p.z - entrada.z) / PASO);
    posiciones.sort((a, b) => aEntrada(a) - aEntrada(b) || a.z - b.z);
    const dist = p => Math.round(Math.hypot(p.x - escenario.x, p.z - escenario.z) / PASO);
    enVivo.sort((a, b) => dist(a) - dist(b) || Math.abs(a.z - zc) - Math.abs(b.z - zc) || a.z - b.z);
    const oficina = s.oficina ? moduloOficina(s.oficina.xo, s.oficina.zo, s.oficina.rz) : {
      cols, filas, cap: cols * filas, carril, escritorio,
      silla: i => { const d = escritorio(i); return {x: d.x + 0.8, z: d.z + 1.2}; },
      cafe: {x: carril, z: Z0 + 1.0, tag: 'cafe'},
      planta: {x: X0 + L - 0.85, z: Z0 + 2.0 + (filas - 1) * 1.85, tag: 'planta'},
      // Desde la baranda del mezzanine miran a Brayan
      ventana: {x: carril, z: Z0 + D - 0.35, tag: 'live'}};
    return {
      L, X0, Z0, yPiso, ...oficina,
      mezz: {D},
      fans: {posiciones, z0, z1, zc, escenario, equipo, k, ahora: {posiciones: enVivo, rIn, rZ},
        parque: {x0: px0, x1: px1, xMuro, entrada, atracciones},
        puerta: {x: (px0 + px1) / 2, z: Z0 + L + 0.05},
        pantalla: {x: X0 + 0.04, z: zc, ancho: Math.min(z1 - z0 - 0.2, Math.max(3, L * 0.35))}},
    };
  }
  return geometriaRed(s, 120);
}

// Festival de playlists: los escenarios van en fila contra la pared del fondo y cada uno tiene
// su público adelante (las personas que guardaron esa playlist), separado por vallas.
// Todos usan la misma escala (1 a 1 si cabe) y las columnas crecen para que quepa la playlist más grande.
function geometriaFestival(s) {
  const lista = s.playlists || [];
  const N = Math.max(1, lista.length);
  const maximo = Math.max(1, ...lista.map(pl => pl.guardados || 0));
  const porPersona = escalaReal(maximo);
  const area = Math.round(maximo / porPersona) * PASO * PASO * 0.87 * 1.12;
  const ancho = Math.max(5.4, Math.sqrt(area) + 1);
  const L = Math.max(9, Math.ceil((N * ancho + 0.6) * 2) / 2, Math.ceil((3.65 + area / (ancho - 0.9)) * 2) / 2);
  const X0 = -L / 2, Z0 = -L / 2, col = L / N;
  const escenarios = lista.map((pl, i) => {
    const cx = X0 + (i + 0.5) * col, frente = Z0 + 2.7;
    const x0 = cx - col / 2 + 0.45, x1 = cx + col / 2 - 0.45, z0 = frente + 0.55, z1 = Z0 + L - 0.4;
    const posiciones = [];
    for (let z = z0, fila = 0; z <= z1; z += PASO, fila++) {
      for (let x = x0 + (fila % 2) * PASO / 2; x <= x1; x += PASO) {
        if (Math.hypot(x - (X0 + L - 0.5), z - (Z0 + L - 0.5)) < 0.6) continue;   // planta
        posiciones.push({x, z});
      }
    }
    // Se llena desde el escenario hacia atrás, parejo a ambos lados
    const dist = p => Math.round(Math.hypot(p.x - cx, p.z - frente) / PASO);
    posiciones.sort((a, b) => dist(a) - dist(b) || Math.abs(a.x - cx) - Math.abs(b.x - cx) || a.x - b.x);
    return {pl, cx, frente, ancho: Math.min(col - 0.9, 4.2), posiciones,
      puerta: {x: cx + col * 0.28, z: Z0 + L + 0.05}, mira: {x: cx, z: Z0 + 1.4}};
  });
  const cupo = Math.min(...escenarios.map(e => e.posiciones.length));
  const nada = () => ({x: 0, z: 0});
  return {L, X0, Z0, cols: 0, filas: 0, cap: 0, carril: 0, escritorio: nada, silla: nada, cafe: null,
    planta: {x: X0 + L - 0.85, z: Z0 + L - 0.85, tag: 'planta'}, ventana: {x: X0 + 0.45, z: Z0 + L - 1, tag: 'ventana'},
    festival: {escenarios, porPersona, personas: pl => Math.min(cupo, Math.round((pl.guardados || 0) / porPersona))}};
}

// Edificio DURO: 6 pisos y rooftop. 1 centro comercial (tiendas, escenario, skatepark), 2 oficinas, 3 estudios de
// música, 4 video y streaming, 5 hotel, 6 penthouse de Brayan y arriba el rooftop. Se sube y baja en ascensor.
export const EDIFICIO = {pisos: 6, alto: 3.2, nombres: ['Centro DURO', 'Oficinas', 'Estudios de música', 'Video y streaming', 'Hotel DURO', 'Penthouse', 'Rooftop']};
function geometriaCasa() {
  const L = 16, X0 = -L / 2, Z0 = -L / 2, PH = EDIFICIO.alto;
  const P = (x, z) => ({x: X0 + x, z: Z0 + z});
  const nada = () => ({x: 0, z: 0});
  // Cada lugar dice en qué piso está (7 = rooftop) y, si hace falta, por dónde se llega (para no atravesar paredes)
  const lugar = (id, piso, x, z, rot, emoji, texto, via = [], dy = 0) => ({id, piso, y: (piso - 1) * PH, dy, ...P(x, z), rot, emoji, texto, via: via.map(([vx, vz]) => P(vx, vz))});
  const lugares = [
    lugar('sofa', 6, 5.0, 8.6, -Math.PI / 2, '📺', 'en su penthouse'),
    lugar('cocina', 6, 12.0, 2.3, Math.PI, '🍳', 'cocinando', [[7.5, 4.6], [9.6, 2.3]]),
    lugar('cama', 6, 12.5, 10.8, 0, '😴', 'descansando en su cuarto', [[8.0, 5.0], [8.8, 12.6], [12.5, 12.6]], 0.5),
    lugar('gym', 6, 4.4, 2.3, Math.PI / 2, '💪', 'entrenando'),
    lugar('piscina', 7, 7.4, 13.0, Math.PI / 2, '🌴', 'en la piscina del rooftop', [[0.9, 10.0]], 0.3),
    lugar('fuente', 7, 4.5, 7.4, Math.PI, '🌱', 'cuidando sus hábitos en el rooftop'),
    lugar('estudio', 3, 4.8, 2.1, Math.PI, '🎤', 'grabando en el estudio', [[1.4, 7.8], [4.8, 7.8], [6.2, 5.2], [6.2, 2.8]]),
    lugar('compu', 3, 4.8, 5.3, Math.PI, '🎛️', 'produciendo', [[1.4, 7.8], [4.8, 7.8]]),
    lugar('stream', 4, 12.5, 1.9, Math.PI, '🎥', 'preparando contenido'),
    lugar('misiones', 2, 6.5, 1.4, Math.PI, '🎯', 'revisando sus misiones'),
    lugar('moto', 1, 2.2, 14.2, Math.PI / 2, '🏍️', 'en su XTZ', [[3.9, 5.0], [3.9, 11.4]]),
    lugar('tienda', 1, 4.8, 4.0, Math.PI, '👕', 'en la tienda DURO WEAR'),
    lugar('skate', 1, 8.7, 12.4, Math.PI / 2, '🛹', 'viendo el skatepark', [[3.9, 5.0], [8.0, 5.0], [8.6, 9.0]]),
    lugar('show', 1, 2.0, 9.4, Math.PI / 2, '🎙️', 'ensayando en el escenario', [[3.9, 5.0], [3.9, 9.4]], 0.5),
  ];
  // Dónde aparece la estrella de cada sueño cuando ya es real (y = altura)
  const sueno = (piso, x, z, dy = 2.3) => ({...P(x, z), y: (piso - 1) * PH + dy});
  const suenos = {moto: sueno(1, 2.2, 14.2), casa: sueno(7, 9, 0.6, 4.6), estudio: sueno(3, 4.9, 1.2), gym: sueno(6, 4.4, 1.6),
    piscina: sueno(7, 12, 11.5), cuarto: sueno(6, 12.5, 10.4), cocina: sueno(6, 12, 1.0)};
  return {L, X0, Z0, cols: 0, filas: 0, cap: 0, carril: 0, escritorio: nada, silla: nada, cafe: null,
    planta: {x: X0 + L - 0.85, z: Z0 + L - 0.85, tag: 'planta'}, ventana: {x: X0 + 0.45, z: Z0 + 2, tag: 'ventana'},
    casa: {lugares, moto: {...P(2.2, 14.2), rot: Math.PI / 2}, suenos, P, PH,
      ascensor: {puerta: P(1.1, 2.8), adentro: P(1.1, 1.1)},
      // Por donde pasea la gente del centro comercial (primer piso)
      paseo: [[4.8, 4.2], [9.4, 4.2], [13.9, 4.2], [8.0, 4.6], [5.4, 6.4], [5.4, 9.8], [3.4, 12.8], [6.2, 13.2], [8.0, 15.0], [8.6, 9.2], [8.6, 6.2]].map(([x, z]) => P(x, z))}};
}

// Escala del público: 1 a 1 siempre que se pueda. Solo si una sala pasaría del máximo,
// cada persona representa a varias (la escala más pequeña que quepa).
export let MAX_PERSONAS = 12000, MAX_PERSONAS_RED = 24000;
export const PASO = 0.46;
// Modo liviano (la versión pública, pensada para celulares): menos gente dibujada en las salas grandes
export function usarModoLiviano() { MAX_PERSONAS = 3000; MAX_PERSONAS_RED = 6000; }
const ESCALAS_RED = [1, 2, 4, 5, 10, 20, 25, 50, 100, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000, 1000000];
export function escalaReal(valor, max = MAX_PERSONAS) {
  const bruto = (valor || 0) / max;
  return ESCALAS_RED.find(e => e >= bruto) || Math.ceil(bruto / 1e6) * 1e6;
}
export function personasReales(valor) { return Math.round((valor || 0) / escalaReal(valor)); }

// Todas las redes sociales usan UNA misma escala, la que fija la red más grande: así el tamaño
// de cada sala es proporcional a su audiencia real (YouTube se ve mucho más grande que Instagram).
let escalaRedes = 1;
// Una red con escala: 'real' (como Twitch, por pedido de Brayan) muestra a su gente 1 a 1 y no entra en la escala común.
export function fijarEscalaRedes(salas) {
  const mayor = Math.max(1, ...salas.filter(s => s.tipo === 'red' && s.escala !== 'real').map(s => s.seguidores || 0));
  escalaRedes = escalaReal(mayor, MAX_PERSONAS_RED);
}
export function seguidoresPorPersona(s) { return s?.escala === 'real' ? escalaReal(s.seguidores) : escalaRedes; }
// «Viendo ahora» en una red: la gente que está viendo tus videos en este momento, 1 a 1.
// Si lo sabes directo (por ejemplo, los espectadores de un directo de Twitch) va en `ahora`; si no, se estima
// con la ley de Little: vistas por hora × minutos que dura en promedio cada vista ÷ 60.
// Lo automático (s.auto, de recolector.py) manda sobre lo que se carga a mano.
// Las visitas reales (automáticas) mandan sobre la simulación; la simulación solo se usa si no hay datos reales.
export function flujoVisitas(s) {
  const a = s?.auto?.ok ? s.auto : {}, t = s?.tiempoReal || {};
  if (!(a.ahora > 0) && a.vistasHora > 0) return {vistasHora: a.vistasHora, minutos: a.minutos > 0 ? a.minutos : t.minutos > 0 ? t.minutos : 1, real: true};
  return s?.simulacion?.activa ? {...s.simulacion, real: false} : null;
}
export function viendoAhora(s) {
  const t = s?.tiempoReal || {}, a = s?.auto?.ok ? s.auto : {};
  if (a.ahora > 0) return Math.min(MAX_PERSONAS, Math.round(a.ahora));
  // Visitas por hora × minutos que se queda cada una ÷ 60
  const f = flujoVisitas(s);
  if (f) return Math.min(MAX_PERSONAS, Math.round((f.vistasHora || 0) * (f.minutos || 0) / 60));
  if (t.ahora > 0) return Math.min(MAX_PERSONAS, Math.round(t.ahora));
  const porHora = a.vistasHora > 0 ? a.vistasHora : t.vistas60 > 0 ? t.vistas60 : t.vistas24 > 0 ? t.vistas24 / 24 : 0;
  // La duración media automática (YouTube Analytics) manda sobre la que se carga a mano
  const minutos = a.minutos > 0 ? a.minutos : t.minutos;
  return minutos > 0 ? Math.min(MAX_PERSONAS, Math.round(porHora * minutos / 60)) : 0;
}
export function personasRed(s, cupo = Infinity) { return Math.min(cupo, Math.round((s.seguidores || 0) / seguidoresPorPersona(s))); }

export function ruta(a, b, g) {
  if (Math.abs(a.z - b.z) < 0.01) return [{x: b.x, z: b.z}];
  return [{x: g.carril, z: a.z}, {x: g.carril, z: b.z}, {x: b.x, z: b.z}];
}

// Arena: la capacidad (aforo) está en miles de visualizaciones al mes. Se dibujan como máximo 360 sillas
// para que la gente siempre se vea; si la capacidad es mayor, cada silla vale más visualizaciones.
export const MAX_SILLAS = 360;
const ESCALAS = [1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000, 1000000];
export function vistasPorSilla(s) {
  const bruto = aforo(s) * 1000 / MAX_SILLAS;
  return ESCALAS.find(e => e >= bruto) || Math.ceil(bruto / 1e6) * 1e6;
}
// La arena es para la gente conectada al LIVE: una silla por persona, hasta 360
export function sillasArena(s) {
  return Math.max(10, Math.min(MAX_SILLAS, Math.round(aforo(s))));
}
// ---------- Versión pública (DURO CITY) ----------
// Solo sale lo que cualquiera puede ver: salas de redes, el estadio y la música. Nunca ingresos, notas,
// misiones, tareas, nombres del equipo, el código, la casa ni las descripciones internas.
const TIPOS_PUBLICOS = ['stream', 'red', 'festival'];
export function datosPublicos(state) {
  const sala = s => ({
    id: s.id, nombre: s.nombre, color: s.color, tipo: s.tipo, red: s.red, url: s.url,
    seguidores: s.seguidores, unidad: s.unidad, escala: s.escala, aforo: s.aforo, capacidad: s.capacidad,
    streamer: s.tipo === 'stream' ? {enVivo: false, clon: s.streamer?.clon || 'planeado'} : undefined,
    playlists: s.playlists?.map(p => ({id: p.id, nombre: p.nombre, color: p.color, portada: p.portada, url: p.url, modo: p.modo,
      unidad: p.unidad, guardados: p.guardados, canciones: p.canciones, resumen: p.resumen, top: p.top})),
    // El equipo se ve trabajando, pero sin nombres ni tareas
    agentes: s.agentes.map(a => ({nombre: 'Equipo DURO', rol: '', estado: a.estado === 'planeado' ? 'planeado' : 'activo'})),
    tareas: [],
    tiempoReal: s.tiempoReal?.minutos ? {minutos: s.tiempoReal.minutos} : undefined,
    // Del estudio solo sale qué ya es real (en público no se muestran las metas)
    estudio: s.estudio?.map(e => ({id: e.id, real: !!e.real})),
  });
  return {
    version: 1, publicado: new Date().toISOString(),
    salas: [...state.salas.filter(s => TIPOS_PUBLICOS.includes(s.tipo)).map(sala),
      {id: 'centro', nombre: 'DURO CITY', color: '#ff3d6e', centro: true, agentes: [], tareas: []}],
    futuras: [], notas: [], misiones: [],
  };
}

// Capacidad total del estadio (pista + gradas). Brayan la fijó en 500; si no hay, los espectadores del último LIVE
export function capacidadArena(s) {
  return Math.min(MAX_PERSONAS, Math.max(sillasArena(s), Math.round(s.capacidad || s.ultimoLive?.espectadores || 0)));
}
// Gradas: lo que queda de la capacidad después de la pista
export function gradasArena(s) {
  return Math.max(0, capacidadArena(s) - sillasArena(s));
}
export function sentadosDelMes(s) {
  return Math.min(sillasArena(s), Math.round((s.stats?.vistasMes || 0) / vistasPorSilla(s)));
}
