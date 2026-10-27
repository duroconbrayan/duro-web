// Escena 3D de la oficina: salas, centro (Cerebro), caminos, luces y agentes que caminan y trabajan.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {geometria, EDIFICIO, ruta, rand, pick, hash, esc, conectadosEsperados, horaColombia, cifra, personasRed, seguidoresPorPersona, fijarEscalaRedes, viendoAhora, flujoVisitas, OFICINA} from './datos.js';

const H = 2.3;            // alto de las paredes
const ABAJO = new THREE.Vector3(0, -1, 0), ARRIBA = new THREE.Vector3(0, 1, 0);
const TMP_COLOR = new THREE.Color();
const HUB_R = 6.5;        // radio de la plataforma central
const NIVEL = 2.8;        // segundo nivel de DURO LIVE (detrás de TikTok)
const PENTHOUSE = 11.0;   // altura mínima del piso del penthouse de la OFICINA DURO (siempre queda por encima de las paredes)
const VEL = 1.6;          // velocidad al caminar (unidades/seg)

// ---------- Recursos compartidos ----------
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  sphere: new THREE.SphereGeometry(1, 24, 16),
  hair: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  torso: new THREE.CapsuleGeometry(0.22, 0.3, 6, 14),
  arm: new THREE.CapsuleGeometry(0.065, 0.28, 4, 8),
  leaf: new THREE.IcosahedronGeometry(1, 0),
  plane: new THREE.PlaneGeometry(1, 1),
};
// Versiones de pocos polígonos para las multitudes (miles de personas a la vez)
const GEO_M = {
  box: GEO.box,
  torso: new THREE.CapsuleGeometry(0.22, 0.3, 2, 6),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  hair: new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
};
const cacheMat = new Map();
function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!cacheMat.has(k)) cacheMat.set(k, new THREE.MeshStandardMaterial({color, roughness: 0.75, metalness: 0.05, ...opts}));
  return cacheMat.get(k);
}
const MAT_GHOST = new THREE.MeshStandardMaterial({color: '#cfe3ff', transparent: true, opacity: 0.38, emissive: '#2c4a85', emissiveIntensity: 0.5, depthWrite: false});

function caja(w, h, d, material, x = 0, y = 0, z = 0, sombra = true) {
  const m = new THREE.Mesh(GEO.box, material);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = sombra; m.receiveShadow = true;
  return m;
}
function cilindro(r, h, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(GEO.cyl, material);
  m.scale.set(r, h, r); m.position.set(x, y, z); m.castShadow = true;
  return m;
}
const tono = (hex, l) => { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); return new THREE.Color().setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l * l, 0, 1)); };

function texturaPiso(color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#' + tono(color, 1.25).getHexString(); x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#' + tono(color, 1.12).getHexString(); x.fillRect(5, 5, 118, 118);
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 3; x.strokeRect(4, 4, 120, 120);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Piso del estudio: negro brillante con líneas de neón
function texturaPisoNeon(color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#0d0915'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#120c1d'; x.fillRect(3, 3, 122, 122);
  x.strokeStyle = color; x.globalAlpha = 0.55; x.lineWidth = 2; x.strokeRect(1, 1, 126, 126);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Pantalla de la comunidad en una red: alto y altura de su centro
function pantallaRed(geo) {
  const h = geo.fans.pantalla.ancho * 200 / 512;
  return {h, y: Math.max(1.5, h / 2 + 0.6)};
}

// Holograma de Brayan IA: azul translúcido que parpadea un poco
function materialHolograma(res) {
  const m = new THREE.MeshBasicMaterial({color: '#4fd8ff', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false});
  res.push(m); return m;
}
function parpadeoHolograma(m) { if (m) m.opacity = 0.36 + Math.random() * 0.12; }

// ---------- Escena ----------
// publico: la versión que ve la gente (DURO CITY): sin datos privados, solo gente real y liviana para celulares
export function crearEscena({contenedor, capa, alClicSala, alClicFutura, publico = false}) {
  const celular = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const liviano = publico || celular;
  const renderer = new THREE.WebGLRenderer({antialias: !liviano, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, liviano ? 1.25 : 2));
  renderer.shadowMap.enabled = !liviano;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  contenedor.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060818');

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  camera.position.set(60, 62, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.05;
  controls.minAzimuthAngle = Math.PI / 4 - 0.7; controls.maxAzimuthAngle = Math.PI / 4 + 0.7;
  controls.minZoom = 0.6; controls.maxZoom = 18;
  controls.screenSpacePanning = true;

  // Luces
  scene.add(new THREE.HemisphereLight('#8fa8ff', '#1a1030', 0.75));
  const sol = new THREE.DirectionalLight('#fff1e0', 1.6);
  sol.position.set(25, 45, 12); sol.castShadow = true;
  sol.shadow.mapSize.set(4096, 4096);
  Object.assign(sol.shadow.camera, {left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 120});
  sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02;
  scene.add(sol);

  // Estrellas
  {
    const n = 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = rand(-160, 160); pos[i * 3 + 1] = rand(-90, -8); pos[i * 3 + 2] = rand(-160, 160); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({color: '#aab6ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7})));
  }

  // Post-proceso: brillo de pantallas, lámparas y del Cerebro
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.5, 0.88);
  if (publico && celular) bloom.enabled = false;   // el brillo es lo que más pesa en un celular
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const mundo = new THREE.Group(); scene.add(mundo);
  const hub = crearHub(); scene.add(hub.grupo);

  const rt = {t: 0, rooms: new Map(), futuras: [], caminos: new THREE.Group(), paquetes: [], memoria: new Map(), reunion: new Map(),
    asig: new Map(), demo: false, demoMap: new Map(), foco: null, hover: null, extent: 30};
  mundo.add(rt.caminos);

  // ---------- Centro: el Cerebro ----------
  function crearHub() {
    const grupo = new THREE.Group();
    const plat = cilindro(HUB_R, 0.5, mat('#0f1433', {roughness: 0.4, metalness: 0.4}), 0, -0.25, 0);
    plat.receiveShadow = true; grupo.add(plat);
    const anillos = [];
    for (const [r, w, o] of [[HUB_R - 0.2, 0.08, 0.9], [HUB_R - 1.6, 0.05, 0.5], [3.4, 0.06, 0.8]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - w, r, 96), new THREE.MeshBasicMaterial({color: '#4fb4ff', transparent: true, opacity: o, side: THREE.DoubleSide}));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; grupo.add(ring); anillos.push(ring);
    }
    // Ojo
    // Iris dibujado en un disco al frente (+z) del globo: así siempre mira hacia donde apunta el pivote
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const x = cv.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 10, 128, 128, 126);
    gr.addColorStop(0, '#9ae0ff'); gr.addColorStop(0.5, '#2f8ff0'); gr.addColorStop(0.92, '#0c3c8c'); gr.addColorStop(1, '#061a40');
    x.fillStyle = gr; x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 3;
    for (let a = 0; a < 48; a++) { const an = a / 48 * Math.PI * 2; x.beginPath(); x.moveTo(128 + Math.cos(an) * 52, 128 + Math.sin(an) * 52); x.lineTo(128 + Math.cos(an) * 116, 128 + Math.sin(an) * 116); x.stroke(); }
    x.fillStyle = '#040914'; x.beginPath(); x.arc(128, 128, 46, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(156, 98, 16, 0, Math.PI * 2); x.fill();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const ojo = new THREE.Group(); ojo.scale.setScalar(2.1);
    ojo.add(new THREE.Mesh(GEO.sphere, new THREE.MeshStandardMaterial({color: '#d6e6f7', roughness: 0.3, emissive: '#5d86b8', emissiveIntensity: 0.25})));
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshBasicMaterial({map: tex, transparent: true}));
    iris.position.z = 0.9; iris.scale.set(1, 1, 1);
    // Curva el disco sobre la esfera empujando el centro hacia afuera
    const pos = iris.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), py = pos.getY(i); pos.setZ(i, Math.sqrt(Math.max(0, 1 - px * px - py * py)) * 1.025 - 0.9); }
    ojo.add(iris);
    const pivote = new THREE.Group(); pivote.position.y = 3.6; pivote.add(ojo); grupo.add(pivote);
    // Burbuja de vidrio y anillos que giran
    const vidrio = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({color: '#5ab8ff', transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false}));
    vidrio.scale.setScalar(3.1); vidrio.position.y = 3.6; grupo.add(vidrio);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.07, 12, 120), new THREE.MeshBasicMaterial({color: '#9fe0ff'}));
    halo.position.y = 3.6; grupo.add(halo);
    const halo2 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.03, 8, 120), new THREE.MeshBasicMaterial({color: '#4fb4ff', transparent: true, opacity: 0.7}));
    halo2.position.y = 3.6; grupo.add(halo2);
    // Rayo hacia arriba
    const cvb = document.createElement('canvas'); cvb.width = 4; cvb.height = 128;
    const xb = cvb.getContext('2d'); const gb = xb.createLinearGradient(0, 0, 0, 128);
    gb.addColorStop(0, 'rgba(110,195,255,0)'); gb.addColorStop(1, 'rgba(110,195,255,1)'); xb.fillStyle = gb; xb.fillRect(0, 0, 4, 128);
    const rayo = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 40, 20, 1, true),
      new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(cvb), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    rayo.position.y = 5.8 + 20; grupo.add(rayo);
    // La luz va abajo, fuera del ojo, para que ilumine la plataforma sin quemar el iris
    const luz = new THREE.PointLight('#5ab8ff', 14, 22, 1.4); luz.position.set(0, 2.2, 0); grupo.add(luz);
    // Pulso cuando llega trabajo
    const pulso = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({color: '#9fe0ff', transparent: true, opacity: 0, side: THREE.DoubleSide}));
    pulso.rotation.x = -Math.PI / 2; pulso.position.y = 0.05; grupo.add(pulso);
    // Zona clicable
    const clic = new THREE.Mesh(new THREE.CylinderGeometry(HUB_R, HUB_R, 7, 24), new THREE.MeshBasicMaterial({visible: false}));
    clic.position.y = 3; clic.userData = {sala: 'cerebro'}; grupo.add(clic);
    return {grupo, ojo, pivote, halo, halo2, rayo, anillos, pulso, clic, mirar: new THREE.Vector3(1, 0.4, 1), mirarObj: new THREE.Vector3(1, 0.4, 1), timer: 2, parpadeo: 4, cerrado: 0, pulsoT: 1};
  }

  // ---------- Sala ----------
  // Alto natural de las paredes de una sala (la arena y las redes las tienen altas: el equipo trabaja arriba)
  function alturaPared(s, geo) {
    const st = geo.stream;
    return st ? Math.max(6.4, st.yT + 1.4, (s.oficina ? 0 : geo.yPiso) + 3.2, st.gradas.alto + 4.6)
      : s.tipo === 'red' ? Math.max(5.4, pantallaRed(geo).y + pantallaRed(geo).h / 2 + 2.4 * geo.fans.k)
      : s.tipo === 'festival' ? 4.8 : s.tipo === 'casa' ? geo.casa.PH : H;
  }

  function construirSala(s) {
    const geo = geometria(s), {L, X0, Z0} = geo, c = s.color;
    const g = new THREE.Group();
    const res = []; // texturas propias para liberar

    const st = geo.stream;
    // La arena y las redes tienen paredes altas: el equipo trabaja arriba (palco o mezzanine)
    // paredHw: si la sala va pegada a otra, las dos paredes terminan a la misma altura (como una sola pared)
    const Hw = s.paredHw ?? alturaPared(s, geo);

    // Base y piso (baldosas; en el estudio, piso oscuro brillante con cuadrícula de neón)
    // La arena y el festival son lugares oscuros con neón; las demás salas, iluminadas
    const oscuro = st || s.tipo === 'festival';
    g.add(caja(L + 0.3, 0.5, L + 0.3, mat(oscuro ? '#0c0812' : '#' + tono(c, 0.45).getHexString()), 0, -0.25, 0, false));
    const tpiso = oscuro ? texturaPisoNeon(c) : s.tipo === 'casa' ? texturaPiso('#d8cfc2') : texturaPiso(c); tpiso.repeat.set(L, L); res.push(tpiso);
    const piso = new THREE.Mesh(GEO.plane, new THREE.MeshStandardMaterial({map: tpiso, roughness: oscuro ? 0.28 : 0.6, metalness: oscuro ? 0.45 : 0, emissive: new THREE.Color(c), emissiveIntensity: 0}));
    piso.scale.set(L, L, 1); piso.rotation.x = -Math.PI / 2; piso.position.y = 0.005; piso.receiveShadow = true;
    piso.userData = {sala: s.id}; g.add(piso); res.push(piso.material);
    if (!st && s.tipo !== 'casa') {
      const alf = new THREE.Mesh(GEO.plane, mat('#' + tono(c, 0.85).getHexString(), {roughness: 0.95}));
      alf.scale.set(L * 0.62, L * 0.55, 1); alf.position.set(0.3, 0.012, 0.3);
      alf.rotation.x = -Math.PI / 2; alf.receiveShadow = true; g.add(alf);
    }

    // Paredes del fondo (x = X0 y z = Z0) con borde claro arriba
    const mPared = st ? mat('#' + new THREE.Color(c).multiplyScalar(0.28).getHexString(), {roughness: 0.6}) : oscuro ? mat('#140b1f', {roughness: 0.7}) : s.tipo === 'casa' ? mat('#efe6d8', {roughness: 0.85}) : mat('#' + tono(c, 0.9).getHexString(), {roughness: 0.85});
    g.add(caja(0.2, Hw, L + 0.2, mPared, X0 - 0.1, Hw / 2, -0.1, s.tipo !== 'casa'));
    // Pared del fondo. En TikTok, si DURO LIVE está detrás, el tramo de la oficina compartida queda abierto, con un vidrio
    // a la altura del mezzanine: el equipo de TikTok y el de DURO LIVE trabajan en una misma oficina
    // Con DURO LIVE detrás, la pared del fondo de TikTok queda baja (hasta el segundo nivel) para no tapar DURO LIVE
    if (s.huecoOficina) g.add(caja(L, NIVEL, 0.2, mPared, 0, NIVEL / 2, Z0 - 0.1));
    else g.add(caja(L, Hw, 0.2, mPared, 0, Hw / 2, Z0 - 0.1, s.tipo !== 'casa'));
    const mBorde = oscuro ? new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(1.4), toneMapped: false}) : mat('#' + tono(c, 1.3).getHexString());
    if (oscuro) res.push(mBorde);
    g.add(caja(0.24, 0.06, L + 0.24, mBorde, X0 - 0.1, Hw + 0.03, -0.1, false));
    if (s.huecoOficina) g.add(caja(L + 0.04, 0.06, 0.24, mBorde, 0, NIVEL + 0.03, Z0 - 0.1, false));
    else g.add(caja(L + 0.04, 0.06, 0.24, mBorde, 0, Hw + 0.03, Z0 - 0.1, false));

    // Pantalla grande en la pared del fondo (en el estudio, la LED gigante detrás del streamer)
    const cvP = document.createElement('canvas'); cvP.width = st ? 1024 : 512; cvP.height = st ? 400 : 200;
    const tP = new THREE.CanvasTexture(cvP); tP.colorSpace = THREE.SRGBColorSpace; tP.anisotropy = 4; res.push(tP);
    // En el estadio va en la pared del fondo, entre la cabina de producción y la bóveda
    const pw = st ? Math.min(L - 2 * st.B - 1.0, 8) : Math.min(L - 2.2, 4.2);
    const ph = pw * cvP.height / cvP.width;
    // En la arena va alta, por encima de las últimas filas del público
    // En las redes la pantalla del fondo es la del equipo, a la altura del mezzanine
    const px = st ? 0 : 0.4, py = st ? Math.max(2.6, st.gradas.alto + 0.4) + ph / 2 : s.tipo === 'red' ? geo.yPiso + 1.3 : 1.45;
    const pantalla = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tP, toneMapped: false}));
    // En TikTok con la súper oficina, la pantalla del equipo va en el vidrio de su módulo, mirando hacia TikTok
    const conModulo = s.tipo === 'red' && s.oficina, pz = conModulo ? s.oficina.zo + OFICINA.fondo + 0.55 : Z0 + 0.035, pxF = conModulo ? s.oficina.xo + OFICINA.ancho / 2 : px;
    pantalla.scale.set(pw, ph, 1); pantalla.position.set(pxF, py, pz); g.add(pantalla);
    // En el festival la pared del fondo es de las portadas: esta pantalla no se usa
    if (s.tipo === 'festival' || s.tipo === 'casa') pantalla.visible = false;
    else g.add(caja(pw + 0.12, ph + 0.12, 0.04, mat('#0b0d1a'), pxF, py, pz - 0.035, false));
    if (!s.tipo) {
      // Tablero de colores en la pared izquierda (solo en las salas de trabajo comunes)
      const paleta = [c, '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f8f9fa'];
      for (let i = 0; i < 6; i++) {
        const p = caja(0.03, 0.32, 0.42, mat(paleta[i], {emissive: paleta[i], emissiveIntensity: 0.15}), X0 + 0.02, 1.25 + (i % 2) * 0.42, Z0 + 1.2 + Math.floor(i / 2) * 0.5, false);
        g.add(p);
      }
    }

    // Lámpara de pie con luz cálida (en el estudio, una luz de color sobre el escenario)
    const lx = X0 + 0.45, lz = Z0 + 0.45;
    let luz;
    if (s.tipo === 'festival') {
      luz = new THREE.PointLight(c, 14, L, 1.4); luz.position.set(0, 4.2, 0); g.add(luz);
    } else if (st) {
      luz = new THREE.PointLight(c, 22, L * 0.8, 1.4); luz.position.set(st.C.x, 4.2, st.C.z); g.add(luz);
    } else {
      g.add(cilindro(0.18, 0.05, mat('#20222e'), lx, 0.03, lz));
      g.add(cilindro(0.025, 1.7, mat('#20222e'), lx, 0.85, lz));
      const bombillo = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({color: '#fff2c9', toneMapped: false}));
      bombillo.scale.setScalar(0.17); bombillo.position.set(lx, 1.75, lz); g.add(bombillo);
      luz = new THREE.PointLight('#ffd9a0', 9, L * 1.1, 1.8); luz.position.set(lx + 0.3, 1.9, lz + 0.3); g.add(luz);
    }

    // Plantas
    const planta = (px, pz, esc_ = 1) => {
      g.add(cilindro(0.2 * esc_, 0.32 * esc_, mat('#c9743e'), px, 0.16 * esc_, pz));
      for (const [dx, dy, dz, r, col] of [[0, 0.62, 0, 0.32, '#3fbf6a'], [0.12, 0.85, 0.05, 0.22, '#57d47f'], [-0.1, 0.78, -0.08, 0.2, '#2fa85a']]) {
        const h = new THREE.Mesh(GEO.leaf, mat(col, {flatShading: true}));
        h.scale.setScalar(r * esc_); h.position.set(px + dx * esc_, dy * esc_, pz + dz * esc_); h.castShadow = true; g.add(h);
      }
    };
    // En la arena la esquina de adelante es la llegada de la escalera de TikTok: ahí no va maceta
    if (!st && s.tipo !== 'casa') { planta(X0 + L - 0.5, Z0 + L - 0.5); planta(X0 + L - 0.45, Z0 + 0.45, 0.85); }

    // En la arena la producción trabaja en el palco elevado
    const zona = new THREE.Group(); zona.position.y = geo.yPiso || 0; g.add(zona);

    // Máquina de café
    const cafe = geo.cafe || {x: 0};
    if (geo.cafe) {
      const mz = cafe.mz ?? Z0 + 0.25;
      zona.add(caja(0.55, 0.95, 0.4, mat('#2e3245'), cafe.x, 0.475, mz));
      zona.add(caja(0.12, 0.08, 0.02, new THREE.MeshBasicMaterial({color: '#ff5470', toneMapped: false}), cafe.x, 0.8, mz + 0.21, false));
    }

    // Escritorios, sillas y monitores
    const ags = s.agentes.slice(0, geo.cap);
    const mEsc = mat('#eee9df', {roughness: 0.5}), mPata = mat('#1c1e28'), mMon = mat('#1d2030', {roughness: 0.4});
    const pantallaOff = mat('#' + tono(c, 0.35).getHexString(), {emissive: tono(c, 0.6), emissiveIntensity: 0.25});
    const cvC = document.createElement('canvas'); cvC.width = 128; cvC.height = 80;
    const tC = new THREE.CanvasTexture(cvC); tC.colorSpace = THREE.SRGBColorSpace; res.push(tC);
    const pantallaOn = new THREE.MeshBasicMaterial({map: tC, toneMapped: false}); res.push(pantallaOn);
    const puestos = ags.map((ag, i) => {
      const d = geo.escritorio(i);
      zona.add(caja(1.6, 0.06, 0.7, mEsc, d.x + 0.8, 0.75, d.z + 0.35));
      for (const [px, pz] of [[0.08, 0.08], [1.52, 0.08], [0.08, 0.62], [1.52, 0.62]]) zona.add(caja(0.05, 0.72, 0.05, mPata, d.x + px, 0.36, d.z + pz));
      zona.add(caja(0.86, 0.52, 0.05, mMon, d.x + 0.8, 1.1, d.z + 0.12));
      zona.add(caja(0.06, 0.2, 0.06, mMon, d.x + 0.8, 0.86, d.z + 0.1));
      zona.add(caja(0.5, 0.02, 0.16, mat('#2a2d3c'), d.x + 0.8, 0.79, d.z + 0.45));
      const scr = new THREE.Mesh(GEO.plane, pantallaOff);
      scr.scale.set(0.78, 0.44, 1); scr.position.set(d.x + 0.8, 1.1, d.z + 0.146); zona.add(scr);
      // Silla (el respaldo queda detrás de la persona)
      const silla = new THREE.Group(); silla.position.set(d.x + 0.8, 0, d.z + 1.15);
      const mSilla = mat('#24273a');
      silla.add(caja(0.5, 0.08, 0.48, mSilla, 0, 0.47, 0));
      silla.add(caja(0.5, 0.55, 0.07, mSilla, 0, 0.78, 0.24));
      silla.add(cilindro(0.035, 0.42, mPata, 0, 0.23, 0));
      silla.add(caja(0.5, 0.04, 0.06, mPata, 0, 0.03, 0)); silla.add(caja(0.06, 0.04, 0.5, mPata, 0, 0.03, 0));
      zona.add(silla);
      return {scr, ag};
    });

    const stream = st ? construirSet(g, geo, c, res, Hw, s) : null;
    const red = s.tipo === 'red' ? construirRed(g, geo, s, res) : null;
    const fest = s.tipo === 'festival' ? construirFestival(g, geo, s, res, Hw) : null;
    const casa = s.tipo === 'casa' ? construirCasa(g, geo, s, res) : null;
    // Las pantallas extra (caras de la pantalla colgante, pantalla de la comunidad) muestran lo mismo que la de la pared
    g.children.forEach(o => { if (o.userData.cara) o.material = pantalla.material; });
    return {g, geo, Hw, piso, pantalla, tP, cvP, tC, cvC, pantallaOn, pantallaOff, puestos, luz, res, stream, red, fest, casa, ultimoP: -1, ultimoC: 0};
  }

  // ---------- Salas de redes sociales: logo en neón, placa y equipo de grabación ----------
  function construirRed(g, geo, s, res) {
    const {L, X0, Z0} = geo, c = s.color;
    const lienzo = (w, h, dibujar) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; dibujar(cv.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; res.push(t);
      const m = new THREE.MeshBasicMaterial({map: t, transparent: true, toneMapped: false}); res.push(m);
      return m;
    };
    // Logo de la red en la pared izquierda, con su luz
    const logo = new THREE.Mesh(GEO.plane, lienzo(256, 256, (x, w, h) => dibujarLogo(x, s.red, w, h)));
    const zc = geo.fans.zc, k = geo.fans.k, PR = pantallaRed(geo);
    const yLogo = PR.y + PR.h / 2 + 0.9 * k;
    logo.scale.set(1.2 * k, 1.2 * k, 1); logo.rotation.y = Math.PI / 2; logo.position.set(X0 + 0.04, yLogo, zc); g.add(logo);
    const luzLogo = new THREE.PointLight(c, 10 * k, 6 * k, 1.6); luzLogo.position.set(X0 + 1.8 * k, yLogo, zc); g.add(luzLogo);
    // Placa de YouTube: oro desde 1 millón, plata desde 100 mil
    if (s.red === 'youtube' && s.seguidores >= 1e5) {
      const oro = s.seguidores >= 1e6;
      // En la pared del fondo, a la derecha (la pared izquierda es de la pantalla de la comunidad)
      const marco = caja(0.75, 0.95, 0.06, mat(oro ? '#d4af37' : '#c8ccd2', {metalness: 1, roughness: 0.22}), X0 + L - 1.0, geo.yPiso + 1.3, Z0 + 0.05, false);
      g.add(marco);
      const placa = new THREE.Mesh(GEO.plane, lienzo(192, 256, (x, w, h) => {
        x.fillStyle = oro ? '#e8c45a' : '#dfe3e8'; x.fillRect(0, 0, w, h);
        x.fillStyle = oro ? '#b8922f' : '#a9afb7';
        x.beginPath(); x.roundRect(36, 70, 120, 84, 22); x.fill();
        x.fillStyle = oro ? '#fff3c4' : '#ffffff';
        x.beginPath(); x.moveTo(84, 92); x.lineTo(84, 132); x.lineTo(118, 112); x.closePath(); x.fill();
        x.fillStyle = '#3a2d10'; x.font = '700 15px ui-monospace, Menlo, monospace'; x.textAlign = 'center';
        x.fillText(oro ? '1.000.000' : '100.000', w / 2, 200); x.fillText('SUSCRIPTORES', w / 2, 222);
      }));
      placa.scale.set(0.62, 0.82, 1); placa.position.set(X0 + L - 1.0, geo.yPiso + 1.3, Z0 + 0.085); g.add(placa);
    }
    // Equipo de grabación en la esquina de adelante a la izquierda
    const E = geo.fans.escenario, Q = geo.fans.equipo;
    const eq = new THREE.Group(); eq.position.set(Q.x, 0, Q.z); eq.rotation.y = Math.atan2(E.x - Q.x, E.z - Q.z); eq.scale.setScalar(geo.fans.k); g.add(eq);
    const tripode = (alto) => { for (const a of [0, 2.1, 4.2]) { const p = caja(0.025, alto, 0.025, mat('#222'), Math.sin(a) * 0.17, alto / 2 - 0.02, Math.cos(a) * 0.17); p.rotation.set(Math.cos(a) * 0.28, 0, -Math.sin(a) * 0.28); eq.add(p); } };
    if (s.red === 'twitch') {
      tripode(1.15);
      eq.add(caja(0.34, 0.24, 0.46, mat('#15151c', {metalness: 0.5, roughness: 0.3}), 0, 1.2, 0));
      const lente = cilindro(0.09, 0.18, mat('#0b0b0f'), 0, 1.2, 0.3); lente.rotation.x = Math.PI / 2; eq.add(lente);
      // Dos softbox a los lados
      for (const sx of [-0.85, 0.85]) {
        eq.add(cilindro(0.02, 1.6, mat('#222'), sx, 0.8, -0.1));
        const sb = caja(0.7, 0.55, 0.08, new THREE.MeshBasicMaterial({color: '#fff7ea', toneMapped: false}), sx, 1.7, 0.05, false);
        sb.rotation.y = sx > 0 ? -0.5 : 0.5; eq.add(sb);
      }
    } else if (s.red === 'tiktok' || s.red === 'instagram') {
      // Celular vertical en trípode con aro de luz
      tripode(1.3);
      eq.add(caja(0.1, 0.19, 0.015, mat('#0b0b0f'), 0, 1.4, 0));
      eq.add(caja(0.088, 0.172, 0.005, new THREE.MeshBasicMaterial({color: c, toneMapped: false}), 0, 1.4, 0.011, false));
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 10, 40), new THREE.MeshBasicMaterial({color: '#fff6e8', toneMapped: false}));
      res.push(aro.geometry); aro.position.set(0, 1.4, -0.03); eq.add(aro);
    }
    // Mezzanine del equipo: piso elevado al fondo con baranda de vidrio y neón (aparte de la comunidad)
    const D = geo.mezz.D, yP = geo.yPiso;
    const mNeon = new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(1.4), toneMapped: false}); res.push(mNeon);
    if (!s.oficina) {
    g.add(caja(L, 0.25, D, mat('#1a1d2b', {roughness: 0.4, metalness: 0.3}), 0, yP - 0.125, Z0 + D / 2));
    const vidrio = new THREE.MeshStandardMaterial({color: '#9cc9ff', transparent: true, opacity: 0.18, metalness: 0.6, roughness: 0.05, depthWrite: false}); res.push(vidrio);
    g.add(caja(L, 1.0, 0.04, vidrio, 0, yP + 0.5, Z0 + D, false));
    g.add(caja(L, 0.05, 0.06, mNeon, 0, yP + 1.0, Z0 + D, false));
    g.add(caja(L, 0.05, 0.06, mNeon, 0, yP - 0.27, Z0 + D, false));
    for (const x of [X0 + 0.15, X0 + L - 0.15]) g.add(caja(0.14, yP, 0.14, mat('#2a2d3c', {metalness: 0.7}), x, yP / 2, Z0 + D - 0.1));
    }
    // Escenario de Brayan frente a la pantalla de la red
    // Mirador: plataforma elevada con el escenario y la media luna de los que te ven ahora.
    // Es un espacio aparte del dormitorio de los seguidores; se sube por una escalera.
    const hP = geo.fans.ahora ? 0.8 * Math.sqrt(geo.fans.k) : 0;
    if (hP) {
      const rM = geo.fans.ahora.rZ + 0.1;
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(rM, rM, hP, 64, 1, false, 0, Math.PI), mat('#141026', {roughness: 0.35, metalness: 0.4}));
      res.push(plat.geometry); plat.position.set(E.x, hP / 2, E.z); plat.receiveShadow = true; g.add(plat);
      g.add(caja(0.06, hP, rM * 2, mat('#141026'), E.x, hP / 2, E.z));
      const borde = new THREE.Mesh(new THREE.TorusGeometry(rM, 0.03, 6, 64, Math.PI), mNeon); res.push(borde.geometry);
      borde.rotation.set(Math.PI / 2, 0, -Math.PI / 2); borde.position.set(E.x, hP, E.z); g.add(borde);
      // Escalera hacia el dormitorio (al frente del mirador)
      const pasos = 5, huella = 1.6 / pasos;
      for (let i = 0; i < pasos; i++) {
        const alto = hP * (pasos - i) / pasos;
        g.add(caja(huella, alto, 1.1, mat('#1d1836', {roughness: 0.5}), E.x + rM + (i + 0.5) * huella, alto / 2, E.z));
        g.add(caja(0.04, 0.03, 1.1, mNeon, E.x + rM + (i + 1) * huella - 0.02, alto, E.z, false));
      }
    }
    // Escenario alto para que Brayan se vea por encima de su comunidad (crece con la sala)
    const hE = 0.55 * geo.fans.k;
    g.add(cilindro(E.r, hE, mat('#0d0912', {roughness: 0.25, metalness: 0.5}), E.x, hP + hE / 2, E.z));
    const aroE = new THREE.Mesh(new THREE.TorusGeometry(E.r, 0.03, 8, 64), mNeon); res.push(aroE.geometry);
    aroE.rotation.x = Math.PI / 2; aroE.position.set(E.x, hP + hE, E.z); g.add(aroE);
    // Brayan no puede estar en todos lados: aquí lo representa Brayan IA, su holograma
    const holo = materialHolograma(res);
    const brayan = crearPersona({nombre: 'Brayan IA', estado: 'activo'}, {gafas: true, audifonos: true, material: holo});
    if (s.red === 'youtube') construirEstudio(g, s, res, E, hP, hE, geo.fans.k, c);
    // Bóvedas de Videos y Shorts (solo en la oficina personal: son estadísticas privadas)
    const bovedas = s.red === 'youtube' && !publico && geo.fans?.ahora ? construirBovedasYT(g, geo, res, c) : null;
    brayan.raiz.position.set(E.x, hP + hE, E.z); brayan.raiz.rotation.y = Math.PI / 2; brayan.raiz.scale.setScalar(geo.fans.k); g.add(brayan.raiz);

    // Zona de la comunidad: su propia pantalla en la pared izquierda (detrás de Brayan), baranda y puerta
    const F = geo.fans;
    if (F) {
      const pf = new THREE.Mesh(GEO.plane, null); pf.userData.cara = true;
      pf.scale.set(F.pantalla.ancho, PR.h, 1); pf.rotation.y = Math.PI / 2; pf.position.set(F.pantalla.x + 0.03, PR.y, F.pantalla.z); g.add(pf);
      g.add(caja(0.04, PR.h + 0.1, F.pantalla.ancho + 0.1, mat('#0b0d1a'), F.pantalla.x, PR.y, F.pantalla.z, false));
      const mBar = new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(1.4), toneMapped: false}); res.push(mBar);
      const zb = F.z0 - 0.25, xa = X0 + 0.25, xb = X0 + L - 0.25;
      g.add(caja(xb - xa, 0.05, 0.05, mBar, (xa + xb) / 2, 0.85, zb, false));
      for (let x = xa; x <= xb + 0.01; x += (xb - xa) / Math.max(1, Math.round((xb - xa) / 1.2))) g.add(caja(0.05, 0.85, 0.05, mat('#2a2d3c', {metalness: 0.6}), x, 0.425, zb, false));
      // Puerta de entrada en el borde de adelante
      const pu = new THREE.Group(); pu.position.set(F.puerta.x, 0, F.puerta.z); g.add(pu);
      for (const sx of [-0.6, 0.6]) pu.add(caja(0.1, 2.1, 0.1, mBar, sx, 1.05, 0, false));
      pu.add(caja(1.3, 0.1, 0.1, mBar, 0, 2.1, 0, false));
    }

    // Afuera: el parque de diversiones de la red, donde están los seguidores distraídos.
    // Adentro (pasando la entrada del muro) solo está el mirador para los que te están viendo.
    const pos = geo.fans?.posiciones || [];
    const parque = geo.fans?.parque ? construirParque(g, geo, res, c) : null;
    const multitud = pos.length ? crearMultitud(g, res, {posiciones: pos, color: c, mira: geo.fans.parque.entrada, puerta: geo.fans.puerta, semilla: s.id}) : null;
    if (multitud) multitud.marca = new THREE.Vector3((geo.fans.parque.x0 + geo.fans.parque.x1) / 2, 1.9, geo.fans.z1 + 0.2);

    // Viendo ahora: media luna iluminada frente a Brayan, separada de la comunidad por una baranda de neón.
    // Está vacía hasta que haya gente viendo tus videos en este momento.
    const A = geo.fans?.ahora;
    let ahora = null;
    if (A) {
      const rojo = new THREE.MeshBasicMaterial({color: new THREE.Color('#ff2a2a').multiplyScalar(1.5), toneMapped: false}); res.push(rojo);
      const piso = new THREE.MeshBasicMaterial({color: '#ff2a2a', transparent: true, opacity: 0.08, depthWrite: false}); res.push(piso);
      const media = (r0, r1, m, y) => {
        const geom = new THREE.RingGeometry(r0, r1, 96, 1, -Math.PI / 2, Math.PI); res.push(geom);
        const o = new THREE.Mesh(geom, m); o.rotation.x = -Math.PI / 2; o.position.set(E.x, y, E.z); g.add(o);
      };
      media(A.rIn, A.rZ, piso, hP + 0.012);
      media(A.rZ, A.rZ + 0.06, rojo, hP + 0.02);
      // Baranda de la media luna: postes y pasamanos, con un hueco donde llega la escalera
      const rB = A.rZ + 0.03, hueco = 0.65 / rB, paso = Math.PI / Math.max(4, Math.round(A.rZ * 2));
      const angulos = [];
      for (let a = -Math.PI / 2; a <= -hueco + 0.001; a += paso) angulos.push(a);
      angulos.push(-hueco, hueco);
      for (let a = Math.PI / 2; a >= hueco - 0.001; a -= paso) angulos.push(a);
      angulos.sort((x, y) => x - y);
      const enArco = a => new THREE.Vector3(E.x + Math.cos(a) * rB, hP, E.z + Math.sin(a) * rB);
      const unicos = angulos.filter((a, i) => i === 0 || a - angulos[i - 1] > 0.01);
      unicos.forEach((a, i) => {
        const p = enArco(a);
        g.add(caja(0.05, 0.6, 0.05, mat('#2a2d3c', {metalness: 0.6}), p.x, hP + 0.3, p.z, false));
        const b = unicos[i + 1];
        if (b === undefined || (a < 0 && b > 0)) return;              // el hueco de la escalera
        const q = enArco(b), largo = p.distanceTo(q);
        const riel = caja(largo, 0.04, 0.04, rojo, (p.x + q.x) / 2, hP + 0.6, (p.z + q.z) / 2, false);
        riel.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x); g.add(riel);
      });
      const M2 = A.posiciones.length ? crearMultitud(g, res, {posiciones: A.posiciones.map(p => ({...p, y: hP})), color: c, mira: E, puerta: geo.fans.puerta, semilla: `${s.id}-ahora`}) : null;
      ahora = {M: M2, n: 0, cT: 0, marca: new THREE.Vector3(E.x + A.rZ * 0.75, hP + 2.0, E.z)};
      if (M2 && multitud) {
        // Quien empieza a verte se despierta: se levanta de entre tus seguidores (los más cercanos primero)
        // y camina hasta la media luna. Cuando deja de verte vuelve a su lugar y se duerme otra vez.
        M2.alEntrar = p => {
          const presentes = multitud.personas.length;
          for (let k = 0; k < presentes; k++) if (!multitud.ocultos.has(k)) {
            multitud.ocultos.add(k); multitud.sucio = true;
            const d = multitud.gente[k], asiento = M2.gente[p.k], rM = A.rZ + 0.1;
            // Del dormitorio al pie de la escalera, sube al mirador y camina a su lugar
            // Del parque a la entrada del muro, al pie de la escalera, sube al mirador y camina a su lugar
            const P = geo.fans.parque;
            p.ruta = ruta3D([{x: d.x, y: 0, z: d.z}, {x: P.xMuro + 0.9, y: 0, z: P.entrada.z}, {x: P.xMuro - 0.6, y: 0, z: P.entrada.z},
              {x: E.x + rM + 1.9, y: 0, z: E.z}, {x: E.x + rM - 0.2, y: hP, z: E.z}, {x: asiento.x, y: hP, z: asiento.z}]);
            p.origen = k; return;
          }
        };
        M2.alSalir = p => { if (p.origen != null) { multitud.ocultos.delete(p.origen); multitud.sucio = true; } };
      }
    }
    return {logo, multitud, ahora, parque, bovedas, brayan, holo, mirar: new THREE.Vector3(E.x, 1, E.z)};
  }

  // Los seguidores que no te están viendo usan el parque: caminan a una atracción y se montan (una persona por góndola
  // de la rueda, por caballito del carrusel, o en el mostrador del puesto). Si está llena, esperan haciendo fila
  // alrededor hasta que salga alguien. Después de un rato vuelven a su lugar. Más o menos 6 de cada 10 están jugando.
  const vAsiento = new THREE.Vector3(), vCentro = new THREE.Vector3();
  // Dónde va (y hacia dónde mira) quien está montado en un puesto de una atracción, en coordenadas de la sala
  function enAsiento(A_, g, a) {
    A_.obj.updateWorldMatrix(true, false);
    g.worldToLocal(A_.obj.localToWorld(vAsiento.copy(A_.local)));
    let rot = A_.mira ?? 0;
    if (A_.gira) { A_.obj.parent.getWorldPosition(vCentro); g.worldToLocal(vCentro); const f = Math.atan2(vAsiento.z - vCentro.z, vAsiento.x - vCentro.x); rot = Math.atan2(Math.sin(f), -Math.cos(f)); }
    else if (!A_.sentado) rot = Math.atan2(a.x - vAsiento.x, a.z - vAsiento.z);
    return {x: vAsiento.x, y: vAsiento.y, z: vAsiento.z, rot, sentado: A_.sentado};
  }
  function jugarEnParque(M, juegos, dt, g) {
    if (!juegos?.length) return;
    if (!M.jugar) M.jugar = (p, t) => {
      const J = p.juego, g_ = M.gente[p.k], e = t - J.t0;
      const lerp = (A, B, u) => ({x: A.x + (B.x - A.x) * u, z: A.z + (B.z - A.z) * u, rot: Math.atan2(B.x - A.x, B.z - A.z)});
      if (e < J.T1) return lerp(g_, J.P0, e / J.T1);
      if (e < J.T1 + J.Tr) {
        if (J.asiento) return enAsiento(J.asiento, g, J.a);   // montado: va pegado a su puesto, que se mueve con la atracción
        // Haciendo fila alrededor (despacito)
        const ang = J.ang + (e - J.T1) * J.w, x = J.a.x + Math.cos(ang) * J.R, z = J.a.z + Math.sin(ang) * J.R;
        return {x, z, rot: Math.atan2(J.a.x - x, J.a.z - z)};
      }
      if (J.asiento?.p === p) J.asiento.p = null;
      if (e < J.T1 + J.Tr + J.T2) return lerp(J.P1, g_, (e - J.T1 - J.Tr) / J.T2);
      p.estado = 'quieto'; p.juego = null; M.sucio = true;
      return {x: g_.x, z: g_.z, rot: g_.rot};
    };
    M.cJuego = (M.cJuego ?? 0) - dt;
    if (M.cJuego > 0) return;
    M.cJuego = 0.25;
    const libres = M.personas.filter(p => p.estado === 'quieto' && !M.ocultos.has(p.k));
    const jugando = M.personas.filter(p => p.estado === 'jugando').length;
    const meta = Math.min(400, Math.round((libres.length + jugando) * 0.6));
    const t = rt.t;
    for (let i = 0; i < 4 && jugando + i < meta && libres.length; i++) {
      const p = libres.splice(Math.floor(Math.random() * libres.length), 1)[0], g_ = M.gente[p.k];
      // Prefiere una atracción cercana con puesto libre; si todas las cercanas están llenas, hace fila en la más cercana
      const dist = J_ => Math.hypot(J_.a.x - g_.x, J_.a.z - g_.z);
      const libre = J_ => J_.asientos.find(A_ => !A_.p || t > A_.hasta + 10);
      const orden = [...juegos].sort((u, v) => dist(u) - dist(v));
      const J_ = orden.find(libre) || orden[0], a = J_.a, asiento = libre(J_);
      const R = a.r + 0.55, ang = Math.atan2(g_.z - a.z, g_.x - a.x) + rand(-0.6, 0.6);
      const Tr = asiento ? rand(10, 22) : rand(5, 10), w = asiento ? 0 : (Math.random() < 0.5 ? 1 : -1) * 0.25 / R;
      // Sube y baja por el lado que da a su lugar
      const borde = asiento ? a.r * 0.75 : R;
      const P0 = {x: a.x + Math.cos(ang) * borde, z: a.z + Math.sin(ang) * borde}, P1 = asiento ? P0 : {x: a.x + Math.cos(ang + w * Tr) * R, z: a.z + Math.sin(ang + w * Tr) * R};
      const vel = 1.3 * (g_.esc || 1), T1 = Math.max(0.5, Math.hypot(P0.x - g_.x, P0.z - g_.z) / vel);
      if (asiento) { asiento.p = p; asiento.hasta = t + T1 + Tr; }
      p.juego = {a, asiento, R, ang, w, Tr, P0, P1, t0: t, T1, T2: Math.max(0.5, Math.hypot(P1.x - g_.x, P1.z - g_.z) / vel)};
      p.estado = 'jugando';
    }
  }

  // La comunidad de una red: se mueve un poco y salta cuando el equipo de la sala trabaja
  function actualizarMultitud(room, dt) {
    const M = room.red.multitud; if (!M) return;
    const n = personasRed(room.s, M.gente.length), t = rt.t, animada = room.ocupados > 0;
    jugarEnParque(M, room.red.parque?.juegos, dt, room.g);
    moverMultitud(M, n, dt, room.s.id, animada);
    M.n = n;
    // Viendo ahora: la cifra estimada sube y baja un poco, como la gente real que entra y sale
    const Z = room.red.ahora;
    // Visitas de la última hora repartidas por minuto: cada visita entra caminando (reales o, si no hay, simuladas)
    const sim = flujoVisitas(room.s);
    if (Z?.M && sim) {
      // Simulación persona por persona: llegan al azar a razón de «visitas por hora» y cada una se queda
      // en promedio «minutos por visita». Es la misma cuenta que hace YouTube, en tiempo real.
      const expo = media => -Math.log(1 - Math.random()) * media;
      const lambda = (sim.vistasHora || 0) / 3600, D = Math.max(0.2, sim.minutos || 0) * 60;
      const firma = `${sim.vistasHora}|${sim.minutos}`;
      if (Z.simFirma !== firma) {
        if (!Z.salidas || Z.simFirma == null || Z.simReal !== sim.real) {
          // Arranca como si llevara rato: la gente que estaría viendo en este momento ya está arriba
          Z.llegadas = 0;
          Z.salidas = Array.from({length: Math.round(lambda * D)}, () => rt.t + expo(D));
        }
        // Si solo cambió el ritmo (llegó la medición nueva cada 5 minutos), la gente que ya está se queda
        Z.simFirma = firma; Z.simReal = sim.real;
        Z.proxima = lambda > 0 ? rt.t + expo(1 / lambda) : Infinity;
      }
      while (rt.t >= Z.proxima) { Z.salidas.push(rt.t + expo(D)); Z.llegadas++; Z.proxima += expo(1 / lambda); }
      Z.salidas = Z.salidas.filter(t => t > rt.t);
      Z.n = Math.min(Z.M.gente.length, Z.salidas.length);
      moverMultitud(Z.M, Z.n, dt, room.s.id, animada);
    } else if (Z?.M) {
      Z.simFirma = null;
      Z.cT -= dt;
      if (Z.cT <= 0) { const base = viendoAhora(room.s); Z.n = Math.min(Z.M.gente.length, base ? Math.max(1, Math.round(base * rand(0.85, 1.15))) : 0); Z.cT = rand(5, 10); }
      moverMultitud(Z.M, Z.n, dt, room.s.id, animada);
    }
    // Bóvedas de Videos y Shorts: se redibujan cuando llegan datos nuevos
    if (room.red.bovedas) {
      const clave = JSON.stringify(room.s.ytPriv || null);
      if (room.red.bovedas.clave !== clave) { room.red.bovedas.clave = clave; dibujarBovedasYT(room.red.bovedas, room.s.ytPriv); }
      for (const l of room.red.bovedas.leds) l.m.color.copy(l.base).multiplyScalar(0.55 + 0.45 * Math.abs(Math.sin(rt.t * l.vel + l.fase)));
    }
    // Atracciones del parque: la rueda gira despacio y el carrusel da vueltas
    for (const a of room.red.parque?.anim || []) a.obj.rotation[a.eje] += dt * a.vel;
    // Zzz: suben despacio sobre seguidores que están durmiendo
    for (const zz of Z?.zzz || []) {
      zz.t += dt * 0.22;
      if (zz.t >= 1 || !zz.d) {
        zz.t %= 1;
        const k = Math.floor(rand(0, Math.max(1, M.personas.length)));
        zz.d = M.ocultos.has(k) ? null : M.gente[k];
      }
      zz.sp.visible = !!zz.d;
      if (!zz.d) continue;
      zz.sp.position.set(zz.d.x + zz.t * 0.25, 0.8 + zz.t * 0.9, zz.d.z);
      zz.sp.material.opacity = Math.sin(Math.PI * zz.t) * 0.85;
    }
    // Brayan IA le habla a la comunidad; si el equipo está trabajando, más animado
    parpadeoHolograma(room.red.holo);
    const B_ = room.red.brayan, energia = animada ? 1.4 : 1;
    B_.bI.rotation.x = -0.5 + Math.sin(t * 2.4 * energia) * 0.5; B_.bD.rotation.x = -0.7 + Math.sin(t * 2.9 * energia + 1) * 0.55;
    B_.cabeza.rotation.y = Math.sin(t * 0.8) * 0.4; B_.cabeza.rotation.x = Math.sin(t * 6) * 0.03;
    B_.cuerpo.position.y = Math.abs(Math.sin(t * 3 * energia)) * 0.02;
    const e = room.etqFans;
    if (e) {
      const clave = `${n}|${room.s.seguidores}`;
      if (e.clave !== clave) {
        e.clave = clave;
        const esc_ = seguidoresPorPersona(room.s);
        e.el.innerHTML = `<b>🎡 Parque · ${n.toLocaleString('es-CO')} seguidores</b><small>distraídos afuera; entran cuando te ven · ${esc_ === 1 ? '1 a 1' : `1 = ${cifra(esc_)} ${esc(room.s.unidad || 'seguidores')}`}</small>`;
      }
      e.el.style.display = rt.foco === room.s.id ? '' : 'none';
      ubicar(e.el, tmpW.copy(M.marca).add(room.g.position), 0);
    }
    const ea = room.etqAhora;
    if (ea && Z) {
      const presentes = Z.M ? Z.M.personas.filter(p => p.estado !== 'saliendo').length : 0;
      const t_ = room.s.tiempoReal || {}, clave = `${presentes}|${viendoAhora(room.s)}|${sim ? Z.llegadas : ''}`;
      if (ea.clave !== clave) {
        ea.clave = clave;
        ea.el.innerHTML = sim
          ? `<b class="rojo">● ${presentes.toLocaleString('es-CO')} viendo ahora</b><small>${sim.real ? 'real' : 'simulación'} · ${Number(sim.vistasHora).toLocaleString('es-CO')} visitas/h ≈ ${Math.round(sim.vistasHora / 60).toLocaleString('es-CO')} por minuto · ${Z.llegadas} llegaron</small>`
          : viendoAhora(room.s)
          ? `<b class="rojo">● ${presentes.toLocaleString('es-CO')} viendo ahora</b><small>${t_.ahora > 0 ? 'dato directo' : 'estimado con tus vistas y su duración'}</small>`
          : `<b>● Viendo ahora</b><small>${publico ? 'nadie en este momento' : 'sin datos: cárgalos en el panel'}</small>`;
      }
      ea.el.style.display = rt.foco === room.s.id ? '' : 'none';
      ubicar(ea.el, tmpW.copy(Z.marca).add(room.g.position), 0);
    }
  }

  // Una atracción de parque (rueda de la fortuna, carrusel o puesto de comida), armada en unidades.
  // Las que giran se agregan a «anim» para animarlas.
  function construirAtraccion(tipo, col, colores, i, res, anim, r_ = 0) {
    const at = new THREE.Group(), asientos = [];
    const luz = (c_, k = 1.4) => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(c_).multiplyScalar(k), toneMapped: false}); res.push(m); return m; };
    const metal = mat('#c9ccd6', {metalness: 0.7, roughness: 0.3});
    if (tipo === 'rueda') {
      // Rueda de la fortuna de frente a la cámara (su plano mira hacia +x +z)
      at.rotation.y = -Math.PI / 4;
      const R = 1.6, h = R + 0.35;
      for (const sz of [-1, 1]) {
        const p = caja(0.08, h + 0.15, 0.08, metal, 0, h / 2, sz * 0.55); p.rotation.x = sz * 0.3; at.add(p);
      }
      const rueda = new THREE.Group(); rueda.position.y = h; at.add(rueda);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 8, 48), luz(col)); res.push(aro.geometry); aro.rotation.y = Math.PI / 2; rueda.add(aro);
      // Góndolas abiertas colgando de cada rayo: giran al revés que la rueda para quedar siempre derechas
      for (let k = 0; k < 8; k++) {
        const ang = k * Math.PI / 4;
        const rayo = caja(0.04, R, 0.04, metal, 0, Math.sin(ang) * R / 2, Math.cos(ang) * R / 2, false); rayo.rotation.x = -ang + Math.PI / 2; rueda.add(rayo);
        const gon = new THREE.Group(); gon.position.set(0, Math.sin(ang) * R, Math.cos(ang) * R); rueda.add(gon);
        const mG = mat(colores[(i + k) % colores.length], {roughness: 0.5});
        gon.add(caja(0.04, 0.3, 0.04, metal, 0, -0.15, 0, false));
        gon.add(caja(0.34, 0.04, 0.5, mG, 0, -0.42, 0));                                         // piso
        for (const sz of [-1, 1]) gon.add(caja(0.34, 0.16, 0.04, mG, 0, -0.34, sz * 0.25));     // barandas
        for (const sx of [-1, 1]) gon.add(caja(0.04, 0.16, 0.5, mG, sx * 0.17, -0.34, 0));
        gon.add(caja(0.36, 0.03, 0.03, luz(colores[(i + k + 1) % colores.length]), 0, -0.26, -0.25, false));   // borde de luz
        anim.push({obj: gon, eje: 'x', vel: -0.25});
        asientos.push({obj: gon, local: new THREE.Vector3(0, -0.42, 0), mira: Math.PI / 4, sentado: true});
      }
      anim.push({obj: rueda, eje: 'x', vel: 0.25});
    } else if (tipo === 'carrusel') {
      if (r_) at.scale.setScalar(r_ / 1.5);
      at.add(cilindro(1.5, 0.22, mat('#2a2236', {roughness: 0.5}), 0, 0.11, 0));
      const giro = new THREE.Group(); at.add(giro);
      giro.add(cilindro(0.08, 2.0, metal, 0, 1.1, 0));
      // Techo abierto (para que se vea quién va montado): cúpula pequeña en el poste, aro de luces y banderines
      const techo = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.5, 12), mat(col, {roughness: 0.5})); res.push(techo.geometry); techo.position.y = 2.3; giro.add(techo);
      const borde = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.04, 6, 48), luz('#fff1c9')); res.push(borde.geometry);
      borde.rotation.x = Math.PI / 2; borde.position.y = 1.92; giro.add(borde);
      for (let k = 0; k < 12; k++) {
        const ang = k * Math.PI / 6, b_ = caja(0.3, 0.22, 0.02, mat(colores[k % colores.length], {roughness: 0.6}), Math.cos(ang) * 1.25, 1.8, Math.sin(ang) * 1.25, false);
        b_.rotation.y = -ang + Math.PI / 2; giro.add(b_);
      }
      for (let k = 0; k < 6; k++) {
        const ang = k * Math.PI / 3, r = 1.05, yC = 0.55 + (k % 2) * 0.15;
        giro.add(caja(0.03, 1.7, 0.03, metal, Math.cos(ang) * r, 1.05, Math.sin(ang) * r, false));
        // Caballito mirando hacia donde gira, con cabeza
        const cab = new THREE.Group(); cab.position.set(Math.cos(ang) * r, yC, Math.sin(ang) * r); cab.rotation.y = -ang; giro.add(cab);
        const mC = mat(colores[(i + k + 1) % colores.length], {roughness: 0.5});
        cab.add(caja(0.16, 0.2, 0.5, mC, 0, 0, 0)); cab.add(caja(0.12, 0.2, 0.14, mC, 0, 0.14, -0.26));
        asientos.push({obj: cab, local: new THREE.Vector3(0, 0.1, 0.02), sentado: true, gira: true});
      }
      anim.push({obj: giro, eje: 'y', vel: 0.5});
    } else {
      // Puesto de comida con toldo de rayas y letrero
      at.rotation.y = Math.PI / 4;
      at.add(caja(1.6, 0.9, 0.7, mat('#3a2a22', {roughness: 0.7}), 0, 0.45, 0));
      for (const sx of [-0.75, 0.75]) at.add(caja(0.06, 1.9, 0.06, metal, sx, 0.95, 0.3));
      for (let k = 0; k < 6; k++) at.add(caja(0.28, 0.06, 0.95, mat(k % 2 ? '#ffffff' : col, {roughness: 0.6}), -0.7 + k * 0.28, 1.95, 0.05));
      at.add(caja(0.9, 0.3, 0.05, luz(col), 0, 2.25, 0.3, false));
      for (const [x, z] of [[-0.4, 0.8], [0.4, 0.8], [0, 1.45]]) asientos.push({obj: at, local: new THREE.Vector3(x, 0, z), mira: Math.PI / 4 + Math.PI, sentado: false});
    }
    at.userData.asientos = asientos;
    return at;
  }

  // ---------- Parque de diversiones de cada red (afuera de la sala) ----------
  // Los seguidores andan aquí, distraídos. Los que empiezan a verte cruzan la entrada del muro hacia el mirador.
  function construirParque(g, geo, res, c) {
    const P = geo.fans.parque, {Z0, X0, L} = geo, D = geo.mezz.D;
    const anim = [], juegos = [];
    const luz = (col, k = 1.4) => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(k), toneMapped: false}); res.push(m); return m; };
    // Piso del parque: verde con un toque del color de la red
    const pasto = new THREE.Mesh(GEO.plane, mat('#' + new THREE.Color('#1f6b3c').lerp(new THREE.Color(c), 0.18).getHexString(), {roughness: 0.95}));
    pasto.rotation.x = -Math.PI / 2; pasto.receiveShadow = true;
    const ancho = X0 + L - (P.xMuro + 0.1), fondo = L - D;
    pasto.scale.set(ancho, fondo, 1); pasto.position.set(P.xMuro + 0.1 + ancho / 2, 0.012, Z0 + D + fondo / 2); g.add(pasto);
    // Muro entre la sala y el parque, con la entrada frente al mirador
    const hM = 1.7, mMuro = mat('#' + new THREE.Color(c).multiplyScalar(0.35).getHexString(), {roughness: 0.6}), neon = luz(c);
    const zIni = Z0 + D, zFin = Z0 + L, e0 = P.entrada.z - P.entrada.ancho / 2, e1 = P.entrada.z + P.entrada.ancho / 2;
    for (const [a, b] of [[zIni, e0], [e1, zFin]]) {
      g.add(caja(0.25, hM, b - a, mMuro, P.xMuro, hM / 2, (a + b) / 2));
      g.add(caja(0.28, 0.05, b - a, neon, P.xMuro, hM, (a + b) / 2, false));
    }
    // Arco de la entrada con letrero
    for (const z of [e0, e1]) g.add(caja(0.18, 2.6, 0.18, neon, P.xMuro, 1.3, z, false));
    g.add(caja(0.2, 0.18, P.entrada.ancho + 0.18, neon, P.xMuro, 2.6, P.entrada.z, false));
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.font = '800 54px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('▶ VER A BRAYAN', 256, 50);
    const t = new THREE.CanvasTexture(cv); res.push(t);
    const cartel = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide})); res.push(cartel.material);
    cartel.scale.set(P.entrada.ancho + 0.8, (P.entrada.ancho + 0.8) * 96 / 512, 1); cartel.rotation.y = Math.PI / 2; cartel.position.set(P.xMuro + 0.12, 3.0, P.entrada.z); g.add(cartel);

    // Atracciones (se arman en unidades y se escalan con la sala)
    const kr = (P.atracciones[0]?.r || 2.1) / 2.1, colores = [c, '#ffd166', '#38e8ff', '#ff7ab6'];
    P.atracciones.forEach((a, i) => {
      const at = construirAtraccion(a.tipo, colores[i % colores.length], colores, i, res, anim);
      at.position.set(a.x, 0, a.z); at.scale.setScalar(kr); g.add(at);
      juegos.push({a, asientos: at.userData.asientos});
    });
    return {anim, juegos};
  }

  // ---------- Bóvedas de YouTube: base de datos de Videos y de Shorts ----------
  // Dos gabinetes iguales a los dos lados de la escalera del mirador (en espejo), con un tablero encima.
  function construirBovedasYT(g, geo, res, c) {
    const F = geo.fans, P = F.parque, E = F.escenario, kv = Math.min(2, Math.sqrt(F.k));
    const leds = [], tableros = [];
    [['videos', -1, c], ['shorts', 1, '#ffffff']].forEach(([tipo, lado, col]) => {
      const b = new THREE.Group(); b.position.set(P.xMuro - 1.5 * kv, 0, F.zc + lado * F.ahora.rZ * 0.85); b.scale.setScalar(kv); g.add(b);
      // Gabinete con luces (como los racks de DURO LIVE)
      b.add(caja(1.4, 1.9, 1.0, mat('#14141c', {metalness: 0.6, roughness: 0.35}), 0, 0.95, 0));
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
      const x = cv.getContext('2d'); x.fillStyle = '#05060a'; x.fillRect(0, 0, 64, 128);
      for (let r = 0; r < 12; r++) for (let k = 0; k < 6; k++) { x.fillStyle = (r + k) % 4 ? col : '#ff0033'; x.fillRect(6 + k * 9, 6 + r * 10, 5, 3); }
      const t = new THREE.CanvasTexture(cv); res.push(t);
      const m = new THREE.MeshBasicMaterial({map: t, toneMapped: false}); res.push(m);
      leds.push({m, base: m.color.clone(), vel: 2 + tableros.length, fase: tableros.length * 1.3});
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(GEO.plane, m); f.scale.set(1.2, 1.7, 1); f.position.set(sx * 0.701, 0.95, 0); f.rotation.y = sx * Math.PI / 2; b.add(f); }
      const fr = new THREE.Mesh(GEO.plane, m); fr.scale.set(1.2, 1.7, 1); fr.position.set(0, 0.95, 0.501); b.add(fr);
      const neon = new THREE.MeshBasicMaterial({color: new THREE.Color(col === '#ffffff' ? '#ff4d6d' : col).multiplyScalar(1.5), toneMapped: false}); res.push(neon);
      b.add(caja(1.44, 0.05, 1.04, neon, 0, 1.92, 0, false));
      // Tablero flotante, mirando a la cámara
      const cvT = document.createElement('canvas'); cvT.width = 640; cvT.height = 400;
      const tT = new THREE.CanvasTexture(cvT); tT.colorSpace = THREE.SRGBColorSpace; tT.anisotropy = 4; res.push(tT);
      const mT = new THREE.MeshBasicMaterial({map: tT, toneMapped: false, transparent: true, side: THREE.DoubleSide}); res.push(mT);
      const tab = new THREE.Mesh(GEO.plane, mT); tab.scale.set(4.4, 2.75, 1); tab.position.set(0, 3.6, 0); tab.rotation.y = Math.PI / 4; b.add(tab);
      tableros.push({tipo, cv: cvT, t: tT, col});
    });
    return {leds, tableros, clave: null};
  }
  function dibujarBovedasYT(B, datos) {
    const num = n => Number(n || 0).toLocaleString('es-CO');
    const mil = n => n >= 1e6 ? `${(n / 1e6).toLocaleString('es-CO', {maximumFractionDigits: 1})} M` : n >= 1e3 ? `${Math.round(n / 1e3).toLocaleString('es-CO')} mil` : num(n);
    for (const T of B.tableros) {
      const x = T.cv.getContext('2d'), w = T.cv.width, h = T.cv.height;
      x.clearRect(0, 0, w, h);
      x.fillStyle = 'rgba(10,8,16,.88)'; x.fillRect(0, 0, w, h);
      x.strokeStyle = T.tipo === 'videos' ? '#ff0033' : '#ffffff'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
      x.textBaseline = 'top'; x.fillStyle = x.strokeStyle; x.font = '800 44px ui-monospace, Menlo, monospace';
      x.fillText(T.tipo === 'videos' ? '▶ VIDEOS' : '⚡ SHORTS', 24, 18);
      // Analytics nombra los tipos «videoOnDemand» y «shorts» (se aceptan también en mayúsculas)
      const t28 = datos?.ytTipos28 || {};
      const d = datos?.ytTipos?.[T.tipo], a = T.tipo === 'videos' ? (t28.videoOnDemand || t28.VIDEO_ON_DEMAND) : (t28.shorts || t28.SHORTS);
      x.fillStyle = '#fff'; x.font = '600 26px ui-monospace, Menlo, monospace';
      if (!d && !a) {
        x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '24px ui-monospace, Menlo, monospace';
        x.fillText(datos?.error ? 'Falta conectar tu oficina:' : 'Esperando datos del Worker…', 24, 100);
        if (datos?.error) x.fillText('python3 conectar_oficina.py', 24, 136);
        T.t.needsUpdate = true; continue;
      }
      let y = 84;
      const linea = (txt, col = '#fff', f = '600 26px') => { x.fillStyle = col; x.font = `${f} ui-monospace, Menlo, monospace`; x.fillText(txt, 24, y); y += 36; };
      if (d) linea(`${num(d.n)} ${T.tipo === 'videos' ? 'videos' : 'shorts'} · ${mil(d.vistas)} vistas`, '#fff', '700 28px');
      if (a) {
        linea(`28 días: ${mil(a.vistas)} vistas · +${num(a.suscriptores)} subs`, '#ffd166');
        linea(`${mil(a.minutos)} min vistos · ${Math.floor(a.duracion / 60)}:${String(Math.round(a.duracion % 60)).padStart(2, '0')} por vista`, '#ffd166');
      }
      y += 6;
      for (const v of d?.top || []) linea(`${mil(v.v).padStart(7)}  ${v.t.length > 30 ? v.t.slice(0, 29) + '…' : v.t}`, 'rgba(255,255,255,.75)', '22px');
      T.t.needsUpdate = true;
    }
  }

  // ---------- Estudio ideal de YouTube ----------
  // El set de un canal de más de un millón: lo que Brayan ya tiene se ve sólido y lo que le falta, como
  // holograma azul (es a lo que apunta). Se arma alrededor de Brayan IA, que mira hacia +x (la cámara).
  function construirEstudio(g, s, res, E, hP, hE, k, c) {
    const lista = s.estudio || [];
    const tiene = id => { const x = lista.find(e => e.id === id); return !x || x.real; };
    const holo = new THREE.MeshBasicMaterial({color: '#5fd0ff', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false}); res.push(holo);
    const m = (id, real) => tiene(id) ? real : holo;
    const luz = color => { const x = new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(1.3), toneMapped: false}); res.push(x); return x; };
    const est = new THREE.Group(); est.position.set(E.x, hP, E.z); est.scale.setScalar(k); g.add(est);
    const y0 = hE / k;                       // arriba del escenario
    // En la versión pública solo se ve lo que ya tienes: las metas son tuyas
    const add = (id, malla) => { malla.castShadow = false; if (!tiene(id)) { if (publico) return malla; malla.renderOrder = 2; } est.add(malla); return malla; };
    const negro = mat('#16161e', {roughness: 0.4, metalness: 0.5}), metal = mat('#2a2d3a', {metalness: 0.8, roughness: 0.3});

    // Fondo con la marca y paneles acústicos, detrás de Brayan
    add('fondo', caja(0.05, 1.6, 1.4, m('fondo', mat('#120a14', {roughness: 0.8})), -0.66, y0 + 0.8, 0));
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.font = '900 70px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DURO', 128, 52);
    const tl = new THREE.CanvasTexture(cv); res.push(tl);
    const neon = new THREE.MeshBasicMaterial({map: tl, color: tiene('fondo') ? new THREE.Color(c).multiplyScalar(1.6) : '#5fd0ff', transparent: true, toneMapped: false, opacity: tiene('fondo') ? 1 : 0.4}); res.push(neon);
    const logo = new THREE.Mesh(GEO.plane, neon); logo.scale.set(0.8, 0.3, 1); logo.rotation.y = Math.PI / 2; logo.position.set(-0.63, y0 + 1.25, 0); if (!publico || tiene('fondo')) est.add(logo);
    for (const [z, col] of [[-0.45, '#c9ccd6'], [0.45, '#d4af37']]) add('fondo', caja(0.03, 0.34, 0.26, m('fondo', mat(col, {metalness: 0.9, roughness: 0.2})), -0.62, y0 + 0.75, z));
    for (const z of [-0.55, 0.55]) for (let f = 0; f < 3; f++) add('acustica', caja(0.06, 0.24, 0.2, m('acustica', mat(f % 2 ? '#2a1a33' : '#1d1426', {roughness: 0.95})), -0.6, y0 + 0.2 + f * 0.3, z));
    // Luz de contra: tubos LED del color de la sala a los lados del fondo
    for (const z of [-0.68, 0.68]) add('luzContra', caja(0.05, 1.3, 0.05, m('luzContra', luz(c)), -0.5, y0 + 0.7, z));

    // Escritorio con dos monitores, el computador, la interfaz y el disco de respaldo
    add('escritorio', caja(0.42, 0.04, 1.0, m('escritorio', mat('#1b1b24', {roughness: 0.3})), 0.32, y0 + 0.72, 0));
    for (const z of [-0.45, 0.45]) add('escritorio', caja(0.38, 0.7, 0.04, m('escritorio', negro), 0.32, y0 + 0.36, z));
    for (const z of [-0.3, 0.3]) {
      const mon = add('escritorio', caja(0.03, 0.22, 0.36, m('escritorio', negro), 0.45, y0 + 0.92, z));
      mon.rotation.y = z > 0 ? 0.35 : -0.35;
      const pant = add('escritorio', new THREE.Mesh(GEO.plane, m('escritorio', luz('#7fa8ff'))));
      pant.scale.set(0.33, 0.19, 1); pant.rotation.y = -Math.PI / 2 + (z > 0 ? 0.35 : -0.35); pant.position.set(0.43, y0 + 0.92, z);
    }
    add('computador', caja(0.2, 0.012, 0.28, m('computador', mat('#9aa0ab', {metalness: 0.9, roughness: 0.25})), 0.26, y0 + 0.75, 0));
    const tapa = add('computador', caja(0.012, 0.18, 0.28, m('computador', mat('#9aa0ab', {metalness: 0.9, roughness: 0.25})), 0.37, y0 + 0.84, 0)); tapa.rotation.z = -0.25;
    add('interfaz', caja(0.1, 0.05, 0.14, m('interfaz', mat('#b3262d', {roughness: 0.4})), 0.24, y0 + 0.77, 0.38));
    add('respaldo', caja(0.14, 0.18, 0.08, m('respaldo', negro), 0.32, y0 + 0.1, -0.3));
    // Micrófono de transmisión en su brazo, frente a la boca
    add('mic', cilindro(0.015, 0.45, m('mic', metal), 0.42, y0 + 0.96, -0.45));
    const brazo = add('mic', caja(0.02, 0.02, 0.5, m('mic', metal), 0.28, y0 + 1.2, -0.25)); brazo.rotation.y = 0.55; brazo.rotation.x = 0.2;
    const mic = add('mic', cilindro(0.05, 0.16, m('mic', mat('#202026', {metalness: 0.6, roughness: 0.35})), 0.16, y0 + 1.32, -0.08)); mic.rotation.z = 1.1;

    // Cámara principal en trípode con teleprompter, mirando a Brayan
    const tripode = (id, px, pz, alto) => { for (const a of [0, 2.1, 4.2]) { const p = add(id, caja(0.02, alto, 0.02, m(id, metal), px + Math.sin(a) * 0.12, alto / 2, pz + Math.cos(a) * 0.12)); p.rotation.set(Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22); } };
    tripode('camara', 1.15, 0, y0 + 1.15);
    add('camara', caja(0.24, 0.16, 0.14, m('camara', negro), 1.18, y0 + 1.25, 0));
    const lente = add('camara', cilindro(0.06, 0.16, m('camara', mat('#0b0b0f', {metalness: 0.6})), 1.0, y0 + 1.25, 0)); lente.rotation.z = Math.PI / 2;
    const vidrio = add('teleprompter', new THREE.Mesh(GEO.plane, m('teleprompter', new THREE.MeshStandardMaterial({color: '#9cc9ff', transparent: true, opacity: 0.35, metalness: 0.8, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide}))));
    vidrio.scale.set(0.3, 0.26, 1); vidrio.rotation.set(0, Math.PI / 2, -0.78); vidrio.position.set(0.86, y0 + 1.25, 0);
    add('teleprompter', caja(0.22, 0.02, 0.3, m('teleprompter', negro), 0.9, y0 + 1.1, 0));
    // Segunda cámara (plano lateral): el celular en su trípode
    tripode('camaraB', 0.95, -0.6, y0 + 1.1);
    const cel = add('camaraB', caja(0.02, 0.16, 0.08, m('camaraB', negro), 0.95, y0 + 1.18, -0.6)); cel.rotation.y = -Math.atan2(-0.6, 0.95);
    // Luces: principal grande y relleno, en sus pedestales, apuntando a Brayan
    // A los lados (no entre la cámara y Brayan), para que no lo tapen
    for (const [id, px, pz, lado] of [['luzPrincipal', 0.5, 1.15, 0.55], ['luzRelleno', 0.5, -1.15, 0.4]]) {
      add(id, cilindro(0.018, y0 + 1.4, m(id, metal), px, (y0 + 1.4) / 2, pz));
      const sb = add(id, caja(0.06, lado, lado, m(id, luz('#c9bfae')), px, y0 + 1.45, pz));
      sb.rotation.y = -Math.atan2(pz, px);
    }
  }

  // ---------- Festival de playlists: un escenario por playlist, con su portada, Brayan de DJ y su público ----------
  const cargador = new THREE.TextureLoader();
  function construirFestival(g, geo, s, res, Hw) {
    const {Z0, L} = geo, F = geo.festival;
    const escenarios = F.escenarios.map((E, i) => {
      const c = E.pl.color, w = E.ancho, alto = 0.55, prof = 2.5;
      const neon = new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(1.5), toneMapped: false}); res.push(neon);
      // Tarima con borde de neón
      g.add(caja(w, alto, prof, mat('#0d0912', {roughness: 0.25, metalness: 0.5}), E.cx, alto / 2, Z0 + 0.2 + prof / 2));
      g.add(caja(w, 0.05, 0.05, neon, E.cx, alto, E.frente - 0.05, false));
      // Portada gigante de la playlist en la pared, con marco de neón
      const lado = Math.min(w - 0.6, Hw - 1.6);
      const tex = E.pl.portada ? cargador.load(E.pl.portada) : posterArtista(E.pl); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; res.push(tex);
      const portada = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tex, toneMapped: false})); res.push(portada.material);
      portada.scale.set(lado, lado, 1); portada.position.set(E.cx, alto + 0.35 + lado / 2, Z0 + 0.04); g.add(portada);
      for (const [dx, dy, sw, sh] of [[0, lado / 2 + 0.04, lado + 0.16, 0.06], [0, -lado / 2 - 0.04, lado + 0.16, 0.06], [lado / 2 + 0.05, 0, 0.06, lado + 0.16], [-lado / 2 - 0.05, 0, 0.06, lado + 0.16]]) {
        g.add(caja(sw, sh, 0.04, neon, E.cx + dx, alto + 0.35 + lado / 2 + dy, Z0 + 0.03, false));
      }
      // Letrero LED encima: nombre y guardados
      const cv = document.createElement('canvas'); cv.width = 600; cv.height = 110;
      const tLED = new THREE.CanvasTexture(cv); tLED.colorSpace = THREE.SRGBColorSpace; res.push(tLED);
      const led = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tLED, toneMapped: false})); res.push(led.material);
      const anchoLED = Math.min(w, 4), yLED = Math.min(Hw - 0.35, alto + 0.35 + lado + 0.45);
      led.scale.set(anchoLED, anchoLED * 110 / 600, 1); led.position.set(E.cx, yLED, Z0 + 0.04); g.add(led);
      const concierto = E.pl.modo === 'concierto';
      const platos = [];
      if (!concierto) {
        // Cabina de DJ con dos tornamesas y Brayan detrás
        const dj = new THREE.Group(); dj.position.set(E.cx, alto, Z0 + 1.75); g.add(dj);
        dj.add(caja(1.7, 0.9, 0.6, mat('#121218', {roughness: 0.4, metalness: 0.4}), 0, 0.45, 0));
        dj.add(caja(1.72, 0.05, 0.05, neon, 0, 0.88, 0.31, false));
        for (const dx of [-0.5, 0.5]) {
          const p = cilindro(0.2, 0.03, mat('#0b0b0f', {metalness: 0.5}), dx, 0.92, 0); dj.add(p);
          const eti = cilindro(0.07, 0.035, neon, dx, 0.925, 0); dj.add(eti); platos.push(p, eti);
        }
        dj.add(caja(0.34, 0.04, 0.3, mat('#1b1b26'), 0, 0.92, 0, false));
      } else {
        // Concierto: pie de micrófono al frente y monitores de piso
        g.add(cilindro(0.015, 1.25, mat('#222'), E.cx + 0.12, alto + 0.62, Z0 + 1.95));
        g.add(cilindro(0.12, 0.03, mat('#222'), E.cx + 0.12, alto + 0.015, Z0 + 1.95));
        for (const dx of [-0.8, 0.8]) { const m = caja(0.6, 0.3, 0.4, mat('#121218', {roughness: 0.4}), E.cx + dx, alto + 0.15, E.frente - 0.35); m.rotation.x = -0.4; g.add(m); }
      }
      // Brayan: de DJ con audífonos, o de pie cantando en el concierto
      const holo = materialHolograma(res);
      const brayan = crearPersona({nombre: 'Brayan IA', estado: 'activo'}, {gafas: true, audifonos: !concierto, material: holo});
      brayan.raiz.position.set(E.cx, alto, Z0 + (concierto ? 1.75 : 1.15)); g.add(brayan.raiz);
      // Parlantes a los lados del escenario
      const woofers = [];
      for (const sx of [-1, 1]) {
        const x = E.cx + sx * (w / 2 - 0.35);
        g.add(caja(0.55, 1.3, 0.5, mat('#121218', {roughness: 0.4}), x, alto + 0.65, E.frente - 0.4));
        for (const y of [0.45, 1.0]) { const wf = cilindro(0.17, 0.05, mat('#2a2a35', {metalness: 0.4}), x, alto + y, E.frente - 0.13); wf.rotation.x = Math.PI / 2; g.add(wf); woofers.push(wf); }
      }
      // Dos reflectores que barren la pista de este escenario
      const conos = [];
      const geoCono = new THREE.ConeGeometry(0.6, 4.4, 24, 1, true); geoCono.translate(0, -2.2, 0); res.push(geoCono);
      for (const sx of [-1, 1]) {
        const base = new THREE.Vector3(E.cx + sx * (w / 2 - 0.2), Hw - 0.2, Z0 + 0.3);
        g.add(caja(0.22, 0.18, 0.22, mat('#15151c', {metalness: 0.6}), base.x, base.y, base.z, false));
        const m = new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}); res.push(m);
        const cono = new THREE.Mesh(geoCono, m); cono.position.copy(base); g.add(cono);
        conos.push({cono, base, fase: i * 2 + sx});
      }
      // Público: las personas que guardaron la playlist
      const M = crearMultitud(g, res, {posiciones: E.posiciones, color: c, mira: E.mira, puerta: E.puerta, semilla: `${s.id}-${E.pl.id}`});
      M.marca = new THREE.Vector3(E.cx, 2.1, Z0 + L - 0.3);
      // Valla entre un público y el siguiente
      if (i > 0) {
        const xv = E.cx - L / F.escenarios.length / 2, z0 = E.frente + 0.3, z1 = Z0 + L - 0.2;
        g.add(caja(0.05, 0.05, z1 - z0, neon, xv, 0.9, (z0 + z1) / 2, false));
        for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / Math.max(1, Math.round((z1 - z0) / 1.2))) g.add(caja(0.05, 0.9, 0.05, mat('#2a2d3c', {metalness: 0.6}), xv, 0.45, z, false));
      }
      return {E, cv, tLED, brayan, holo, platos, woofers, conos, M, concierto, objetivoLuz: new THREE.Vector3(E.cx, 0, E.frente + 2.2), ultimo: -1};
    });
    return {escenarios};
  }

  // Póster del artista dibujado: nombre, sonido y su canción más escuchada
  function posterArtista(pl) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const x = cv.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, '#1a0a02'); gr.addColorStop(1, '#050505');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = pl.color; x.globalAlpha = 0.25; x.lineWidth = 2;
    for (let k = 0; k < 18; k++) { x.beginPath(); x.moveTo(0, 300 + k * 12); x.lineTo(512, 260 + k * 16); x.stroke(); }
    x.globalAlpha = 1; x.textAlign = 'center';
    x.fillStyle = '#fff'; x.font = '900 78px Impact, Helvetica, sans-serif'; x.fillText('BRAYAN', 256, 170); x.fillText('TRAMPA', 256, 250);
    x.fillStyle = pl.color; x.font = '700 24px ui-monospace, Menlo, monospace'; x.fillText('TRAP · DIGITAL · HYPERPOP', 256, 300);
    x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '20px ui-monospace, Menlo, monospace';
    if (pl.top?.[0]) x.fillText(`▶ ${pl.top[0].t}`, 256, 420);
    x.fillText('DESDE URABÁ', 256, 456);
    return new THREE.CanvasTexture(cv);
  }

  function dibujarLetrero(es, pl, personas) {
    const x = es.cv.getContext('2d'), w = es.cv.width, h = es.cv.height;
    x.fillStyle = '#07060d'; x.fillRect(0, 0, w, h);
    x.fillStyle = pl.color; x.font = '800 46px ui-monospace, Menlo, monospace'; x.textBaseline = 'middle';
    x.fillText(pl.nombre, 20, 40);
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '24px ui-monospace, Menlo, monospace';
    if (pl.top?.length) {
      const c = pl.top[Math.floor(rt.t / 4) % pl.top.length];
      x.fillText(`▶ ${c.t} · ${c.n.toLocaleString('es-CO')}`, 20, 86);
    } else x.fillText(`${(pl.guardados || 0).toLocaleString('es-CO')} ${pl.unidad || 'guardados'} · ${pl.canciones || '—'} canciones`, 20, 86);
    // Ecualizador a la derecha
    for (let k = 0; k < 14; k++) {
      const v = 0.2 + Math.abs(Math.sin(rt.t * (2.5 + k * 0.4) + k)) * 0.8;
      x.fillStyle = pl.color; x.fillRect(w - 20 - (14 - k) * 13, h - 12 - v * 80, 9, v * 80);
    }
    es.tLED.needsUpdate = true;
  }

  // La música siempre está sonando: Brayan pincha, los parlantes laten, la gente baila y los reflectores barren
  function actualizarFestival(room, dt) {
    const t = rt.t, fase = t * 120 / 60, pulso = (1 - (fase % 1)) ** 3, F = room.geo.festival;
    for (const es of room.fest.escenarios) {
      const pl = room.s.playlists.find(p => p.id === es.E.pl.id) || es.E.pl;
      const n = F.personas(pl);
      moverMultitud(es.M, n, dt, room.s.id, true);
      const b = es.brayan;
      parpadeoHolograma(es.holo);
      if (es.concierto) {
        b.bD.rotation.x = -2.5 + Math.sin(t * 2) * 0.08;                  // mano del micrófono
        b.bI.rotation.x = -1.6 + Math.sin(t * 3.2) * 0.9;                 // la otra mano arenga al público
        b.cabeza.rotation.y = Math.sin(t * 0.7) * 0.45; b.cabeza.rotation.x = -0.05 + pulso * 0.08;
        b.cuerpo.position.y = pulso * 0.09;
      } else {
        b.bI.rotation.x = -1.1 + Math.sin(t * 4) * 0.12; b.bD.rotation.x = -0.6 + Math.sin(t * 8) * 0.6;
        b.cabeza.rotation.x = 0.1 + pulso * 0.12; b.cuerpo.position.y = pulso * 0.03;
      }
      for (const p of es.platos) p.rotation.y += dt * 3.5;
      for (const w of es.woofers) { const k = 1 + pulso * 0.16; w.scale.set(0.17 * k, 0.05, 0.17 * k); }
      for (const c of es.conos) {
        const destino = tmpW.copy(es.objetivoLuz).add(new THREE.Vector3(Math.sin(t * 0.6 + c.fase) * 1.6, 0, Math.cos(t * 0.45 + c.fase) * 1.4));
        c.cono.quaternion.setFromUnitVectors(ABAJO, destino.sub(c.base).normalize());
        c.cono.material.opacity = 0.035 + pulso * 0.035;
      }
      es.ultimo -= dt;
      if (es.ultimo <= 0) { dibujarLetrero(es, pl, n); es.ultimo = 0.12; }
      // Etiqueta del público al entrar a la sala
      if (es.etq) {
        const clave = `${n}|${pl.guardados}`;
        if (es.etq.clave !== clave) { es.etq.clave = clave; es.etq.el.innerHTML = `<b>${esc(pl.nombre)} · 👥 ${n}</b><small>1 = ${F.porPersona} ${esc(pl.unidad || 'guardados')}</small>`; }
        es.etq.el.style.display = rt.foco === room.s.id ? '' : 'none';
        ubicar(es.etq.el, tmpW.copy(es.M.marca).add(room.g.position), 0);
      }
    }
  }

  // ---------- Edificio DURO: 6 pisos y rooftop (antes la casa de Brayan) ----------
  // Cada piso es un grupo: para mirar uno por dentro se esconden los de arriba (selector de pisos).
  // Fachadas de vidrio en los dos lados que dan a la cámara; las paredes del fondo son las de la sala.
  function construirCasa(g, geo, s, res) {
    const {L, X0, Z0} = geo, PH = geo.casa.PH, A = geo.casa.ascensor;
    const oro = mat('#d4af37', {metalness: 1, roughness: 0.25}), marmol = mat('#efe9df', {roughness: 0.2, metalness: 0.1});
    const madera = mat('#8a5a35', {roughness: 0.6}), oscuro = mat('#1d1f2a', {roughness: 0.5}), blanco = mat('#f3eee6', {roughness: 0.7});
    const metal = mat('#c9ccd6', {metalness: 0.7, roughness: 0.3}), negro = mat('#111216', {roughness: 0.4});
    const neon = (c_, k = 1.4) => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(c_).multiplyScalar(k), toneMapped: false}); res.push(m); return m; };
    const vidrio = new THREE.MeshStandardMaterial({color: '#bfe3ff', transparent: true, opacity: 0.13, metalness: 0.6, roughness: 0.05, depthWrite: false}); res.push(vidrio);
    const luzCalida = neon('#ffe2a8', 1);
    // Caja por sus bordes (x, z de 0 a L desde la esquina del fondo; y desde el piso del grupo)
    const B = (fg, x0, x1, y0, y1, z0, z1, m, sombra = false) => { const o = caja(x1 - x0, y1 - y0, z1 - z0, m, X0 + (x0 + x1) / 2, (y0 + y1) / 2, Z0 + (z0 + z1) / 2, sombra); fg.add(o); return o; };
    const Cil = (fg, r, h, m, x, y0, z) => { const o = cilindro(r, h, m, X0 + x, y0 + h / 2, Z0 + z); o.castShadow = false; fg.add(o); return o; };
    const lienzo = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; res.push(t); return {cv, t}; };
    // Letrero de neón (o con fondo) que mira hacia rotY
    const letrero = (fg, texto, col, ancho, x, y, z, rotY = 0, fondo = null) => {
      const {cv, t} = lienzo(512, 128), c2 = cv.getContext('2d');
      if (fondo) { c2.fillStyle = fondo; c2.fillRect(0, 0, 512, 128); }
      let fs = 78; c2.font = `800 ${fs}px ui-monospace, Menlo, monospace`;
      while (c2.measureText(texto).width > 480 && fs > 18) { fs -= 3; c2.font = `800 ${fs}px ui-monospace, Menlo, monospace`; }
      c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillStyle = col; c2.shadowColor = col; c2.shadowBlur = fondo ? 0 : 16; c2.fillText(texto, 256, 66);
      const m = new THREE.MeshBasicMaterial({map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide}); res.push(m);
      const p = new THREE.Mesh(GEO.plane, m); p.scale.set(ancho, ancho / 4, 1); p.position.set(X0 + x, y, Z0 + z); p.rotation.y = rotY; fg.add(p); return p;
    };
    const palma = (fg, x, z, alto = 2.8) => {
      const tronco = cilindro(0.1, alto, mat('#7a5a3a'), X0 + x, alto / 2, Z0 + z); tronco.rotation.z = 0.1; fg.add(tronco);
      for (let k = 0; k < 7; k++) {
        const a = k * Math.PI * 2 / 7, hoja = caja(1.4, 0.04, 0.34, mat(k % 2 ? '#2e9e57' : '#3fbf6a', {flatShading: true}), X0 + x + Math.cos(a) * 0.6 + 0.15, alto - 0.05, Z0 + z - Math.sin(a) * 0.6);
        hoja.rotation.set(0, a, -0.45); fg.add(hoja);
      }
    };
    const planta = (fg, x, z, k = 1) => { B(fg, x - 0.2 * k, x + 0.2 * k, 0, 0.4 * k, z - 0.2 * k, z + 0.2 * k, mat('#3a2a22')); const h_ = new THREE.Mesh(GEO.leaf, mat('#3fbf6a', {flatShading: true})); h_.scale.setScalar(0.42 * k); h_.position.set(X0 + x, 0.75 * k, Z0 + z); fg.add(h_); };
    // Gente del edificio: quieta (sentada, trabajando) o caminando entre puntos
    const animados = [], caminantes = [];
    const persona = (fg, nombre, estilo, x, z, rot, pose = null) => {
      const P_ = crearPersona({nombre, estado: 'activo'}, estilo); P_.raiz.position.set(X0 + x, 0, Z0 + z); P_.raiz.rotation.y = rot; fg.add(P_.raiz);
      if (pose === 'sentado' || pose === 'teclea') { P_.pI.rotation.x = P_.pD.rotation.x = -Math.PI / 2; P_.cuerpo.position.y = -0.05; }
      if (pose === 'teclea') animados.push(t => { P_.bI.rotation.x = -1.2 + Math.sin(t * 15 + x) * 0.07; P_.bD.rotation.x = -1.2 + Math.cos(t * 14 + z) * 0.07; });
      if (pose === 'canta') animados.push(t => { P_.bD.rotation.x = -2.4; P_.bI.rotation.x = -0.8 + Math.sin(t * 3) * 0.4; P_.cabeza.rotation.x = Math.sin(t * 6) * 0.08; });
      if (pose === 'acostado') { P_.raiz.rotation.set(-Math.PI / 2, 0, rot); P_.raiz.position.y = 0.62; }
      return P_;
    };
    const camina = (fg, nombre, estilo, puntos, vel = 1.1) => {
      const p0 = pick(puntos), P_ = crearPersona({nombre, estado: 'activo'}, estilo); P_.raiz.position.set(p0.x, 0, p0.z); fg.add(P_.raiz);
      caminantes.push({P: P_, puntos, x: p0.x, z: p0.z, dest: null, timer: rand(0, 4), vel});
    };
    const ropa = () => ({camisa: pick(['#ff3d6e', '#38e8ff', '#ffd166', '#a855f7', '#3ddc84', '#ffffff', '#ff7a1a', '#1f2235']), pantalon: pick(['#1f2235', '#2b3a55', '#141414', '#d6c8a8'])});

    const pisos = [];
    for (let n = 1; n <= 7; n++) { const fg = new THREE.Group(); fg.position.y = (n - 1) * PH; g.add(fg); pisos.push(fg); }
    // Losas, fachadas de vidrio, columnas y el ducto del ascensor (en la esquina del fondo a la izquierda)
    const losa = mat('#2a2d3a', {roughness: 0.6}), bordeOro = neon('#ffd166', 1.2), paredFondo = mat('#efe6d8', {roughness: 0.85});
    const acabados = ['#d8cfc2', '#cfd6df', '#8a7a9c', '#7d8496', '#6b2a35', '#c9b79c', '#b98a5c'];
    pisos.forEach((fg, i) => {
      const n = i + 1;
      if (n > 1) {
        B(fg, 0, L, -0.25, 0, 0, L, losa);
        B(fg, 0, L, 0, 0.01, 0, L, mat(acabados[i], {roughness: n === 6 ? 0.25 : 0.7, metalness: n === 6 ? 0.15 : 0}));
      }
      if (n > 1) {
        const hP = n === 7 ? 1.1 : PH;
        B(fg, -0.2, 0, 0, hP, -0.2, L, paredFondo); B(fg, 0, L, 0, hP, -0.2, 0, paredFondo);
        B(fg, -0.22, 0.02, hP, hP + 0.06, -0.22, L, bordeOro); B(fg, 0, L, hP, hP + 0.06, -0.22, 0.02, bordeOro);
      }
      // Franja dorada en el borde de cada losa (de noche se ve el edificio piso por piso)
      B(fg, 0, L + 0.04, -0.14, -0.06, L, L + 0.04, bordeOro); B(fg, L, L + 0.04, -0.14, -0.06, 0, L + 0.04, bordeOro);
      if (n === 7) return;
      // Fachada de vidrio con parales cada 2 m (en el primer piso, la entrada principal queda abierta)
      const hV = PH - 0.25;
      for (let k = 0; k < L; k += 2) {
        if (!(n === 1 && k >= 6 && k < 10)) B(fg, k, k + 2, 0, hV, L - 0.02, L + 0.02, vidrio);
        B(fg, L - 0.02, L + 0.02, 0, hV, k, k + 2, vidrio);
        B(fg, k - 0.03, k + 0.03, 0, hV, L - 0.03, L + 0.03, negro); B(fg, L - 0.03, L + 0.03, 0, hV, k - 0.03, k + 0.03, negro);
      }
      B(fg, L - 0.12, L + 0.12, 0, PH, L - 0.12, L + 0.12, negro);   // columna de la esquina
      // Ducto del ascensor: marco con vidrio, puerta hacia adelante
      for (const [x, z] of [[0.2, 2.2], [2.0, 2.2], [2.0, 0.2]]) B(fg, x - 0.05, x + 0.05, 0, PH, z - 0.05, z + 0.05, oro);
      B(fg, 2.0, 2.02, 0, PH - 0.2, 0.2, 2.2, vidrio); B(fg, 0.2, 0.6, 0, PH - 0.2, 2.2, 2.22, vidrio); B(fg, 1.6, 2.0, 0, PH - 0.2, 2.2, 2.22, vidrio);
      letrero(fg, `${n}`, '#ffd166', 0.9, 1.1, 2.6, 2.25);
    });
    // Cabina del ascensor (sube y baja con Brayan)
    const cabina = new THREE.Group(); cabina.position.set(X0 + 1.1, 0, Z0 + 1.2); g.add(cabina);
    cabina.add(caja(1.5, 0.08, 1.5, oro, 0, 0.04, 0, false)); cabina.add(caja(1.5, 0.08, 1.5, oro, 0, 2.5, 0, false));
    cabina.add(caja(1.5, 2.4, 0.03, vidrio, 0, 1.25, -0.74, false)); cabina.add(caja(0.03, 2.4, 1.5, vidrio, 0.74, 1.25, 0, false));
    cabina.add(caja(1.4, 0.04, 0.04, neon('#ffd166'), 0, 2.45, 0.72, false));

    // ===== Piso 1 · Centro DURO: pasadizo comercial, tiendas, escenario, skatepark y zona de encuentro =====
    {
      const f = pisos[0];
      B(f, 2.4, L, 0, 0.012, 3.2, 5.2, mat('#3a3f52', {roughness: 0.4}));             // pasadizo
      B(f, 6.6, 9.4, 0, 0.012, 5.2, L, mat('#3a3f52', {roughness: 0.4}));             // de la entrada al pasadizo
      for (const x of [6.6, 9.4]) B(f, x - 0.03, x + 0.03, 0, 0.02, 5.2, L, neon('#ffd166', 1));
      // Tres tiendas contra el fondo
      [['DURO WEAR', '#ff3d6e', 2.6], ['GAFAS CLUB', '#ff2bd6', 7.1], ['URABÁ STORE', '#22c55e', 11.6]].forEach(([nombre, col, x0], j) => {
        const x1 = x0 + 4.3;
        B(f, x0, x1, 0, 0.015, 0, 3.2, mat('#' + new THREE.Color(col).multiplyScalar(0.25).getHexString(), {roughness: 0.5}));
        B(f, x1 - 0.06, x1 + 0.06, 0, 2.7, 0, 3.2, blanco);                                              // división
        B(f, x0, x1, 2.7, 2.95, 3.1, 3.25, negro); letrero(f, nombre, col, 3.4, (x0 + x1) / 2, 2.83, 3.27);
        // Repisa en la pared con camisetas / gafas / tenis
        for (let r = 0; r < 3; r++) {
          B(f, x0 + 0.3, x1 - 0.3, 0.7 + r * 0.6, 0.74 + r * 0.6, 0.05, 0.4, madera);
          for (let k = 0; k < 6; k++) B(f, x0 + 0.45 + k * 0.6, x0 + 0.75 + k * 0.6, 0.74 + r * 0.6, 0.98 + r * 0.6, 0.1, 0.35, mat(pick(['#ff3d6e', '#fff', '#111', '#38e8ff', '#ffd166', col])));
        }
        // Percheros con ropa colgada y un mostrador
        for (const xr of [x0 + 1.2, x0 + 3.0]) {
          B(f, xr - 0.6, xr + 0.6, 1.45, 1.5, 1.85, 1.9, metal); for (const sx of [-0.6, 0.6]) B(f, xr + sx - 0.02, xr + sx + 0.02, 0, 1.5, 1.85, 1.9, metal);
          for (let k = 0; k < 5; k++) B(f, xr - 0.5 + k * 0.25, xr - 0.32 + k * 0.25, 0.75, 1.42, 1.7, 2.05, mat(pick(['#ff3d6e', '#fff', '#111', '#a855f7', col])));
        }
        B(f, x1 - 1.3, x1 - 0.3, 0, 0.95, 2.4, 2.9, blanco); B(f, x1 - 1.35, x1 - 0.25, 0.95, 1.0, 2.35, 2.95, oro);
        persona(f, 'vendedor' + j, {camisa: col}, x1 - 0.8, 2.15, 0);
      });
      // Escenario para presentaciones (pared izquierda) con su público
      B(f, 0, 3.4, 0, 0.5, 5.6, 11.0, oscuro); B(f, 3.38, 3.42, 0.1, 0.5, 5.6, 11.0, neon('#a855f7'));
      for (const z of [5.8, 10.8]) B(f, 3.0, 3.12, 0.5, 3.05, z - 0.06, z + 0.06, metal);
      B(f, 3.0, 3.12, 2.95, 3.05, 5.8, 10.8, metal);
      for (let k = 0; k < 5; k++) { const foco = new THREE.Mesh(GEO.sphere, neon(['#ff3d6e', '#38e8ff', '#ffd166', '#a855f7', '#3ddc84'][k])); foco.scale.setScalar(0.11); foco.position.set(X0 + 3.06, 2.85, Z0 + 6.4 + k * 1.0); f.add(foco); }
      for (const z of [6.1, 10.5]) B(f, 2.4, 3.0, 0.5, 1.7, z - 0.3, z + 0.3, negro);
      Cil(f, 0.015, 1.4, metal, 2.6, 0.5, 8.3);
      const pantallaShow = letrero(f, 'DURO SHOWS', '#ff3d6e', 4.4, 0.07, 2.0, 8.3, Math.PI / 2, '#0b0710');
      pantallaShow.scale.set(4.4, 1.6, 1);
      for (const x of [4.5, 5.5, 6.5]) B(f, x - 0.25, x + 0.25, 0, 0.42, 6.2, 10.4, madera);
      for (let k = 0; k < 6; k++) persona(f, 'publico' + k, ropa(), 4.5 + (k % 3), 6.8 + Math.floor(k / 3) * 2.4 + (k % 2) * 0.4, -Math.PI / 2, 'sentado');
      persona(f, 'artista-show', {camisa: '#ffd166', gafas: true}, 2.0, 7.0, Math.PI / 2, 'canta').raiz.position.y = 0.5;
      // Skatepark: half-pipe con dos rampas curvas, baranda para grindear y un funbox
      B(f, 9.3, L, 0, 0.014, 6.0, L, mat('#8d929c', {roughness: 0.85}));
      B(f, 9.25, 9.35, 0, 0.6, 6.0, 9.2, vidrio); B(f, 9.25, 9.35, 0, 0.6, 10.2, L, vidrio);
      const R = 1.6, forma = new THREE.Shape();
      forma.moveTo(0, 0); forma.lineTo(R, 0); forma.absarc(R, R, R, -Math.PI / 2, Math.PI, true); forma.lineTo(0, 0);
      const geoRampa = new THREE.ExtrudeGeometry(forma, {depth: 4.6, bevelEnabled: false, curveSegments: 16}); res.push(geoRampa);
      const mRampa = mat('#c8955a', {roughness: 0.5});
      for (const [x, sx] of [[9.6, 1], [15.8, -1]]) {
        const r_ = new THREE.Mesh(geoRampa, mRampa); r_.position.set(X0 + x, 0, Z0 + 10.6); r_.scale.x = sx; f.add(r_);
        const cop = cilindro(0.06, 4.6, neon('#38e8ff'), X0 + x, R, Z0 + 12.9); cop.rotation.x = Math.PI / 2; f.add(cop);
      }
      B(f, 10.5, 14.5, 0.45, 0.5, 7.36, 7.44, metal); for (const x of [10.6, 14.4]) B(f, x - 0.03, x + 0.03, 0, 0.45, 7.37, 7.43, metal);
      B(f, 11.6, 13.4, 0, 0.45, 8.3, 9.3, mat('#5a6070')); letrero(f, 'SKATEPARK', '#38e8ff', 2.6, 12.7, 2.5, 6.1);
      // Dos skaters en el half-pipe (suben y bajan las rampas)
      const skaters = [0, 1].map(k => {
        const tilt = new THREE.Group(); f.add(tilt);
        const P_ = crearPersona({nombre: 'skater' + k, estado: 'activo'}, {camisa: k ? '#38e8ff' : '#ff3d6e', pantalon: '#141414'}); tilt.add(P_.raiz);
        P_.raiz.add(caja(0.22, 0.05, 0.8, mat('#ffd166'), 0, 0.03, 0, false));
        P_.raiz.position.y = 0.06; P_.bI.rotation.z = 0.9; P_.bD.rotation.z = -0.9;
        return {tilt, P: P_, z: 11.6 + k * 2.4, fase: k * 2.1};
      });
      const perfil = x => { const d = x < 11.2 ? 11.2 - x : x > 14.2 ? x - 14.2 : 0, dd = Math.min(d, R * 0.97); return {y: R - Math.sqrt(R * R - dd * dd), a: Math.asin(dd / R) * (x < 11.2 ? -1 : 1)}; };
      animados.push(t => skaters.forEach(k => {
        const w = 0.9, x = 12.7 + 3.0 * Math.sin(t * w + k.fase), v = Math.cos(t * w + k.fase), pf = perfil(x);
        k.tilt.position.set(X0 + x, pf.y, Z0 + k.z); k.tilt.rotation.z = pf.a;
        k.P.raiz.rotation.y = v > 0 ? Math.PI / 2 : -Math.PI / 2;
      }));
      // Zona de encuentro: sala, café DURO y la moto de Brayan junto a la entrada
      B(f, 0.4, 5.0, 0, 0.012, 11.6, 15.6, mat('#b5835a', {roughness: 0.95}));
      const tela = mat('#3b2a4a', {roughness: 0.9});
      B(f, 0.6, 3.6, 0, 0.42, 15.0, 15.6, tela); B(f, 0.6, 3.6, 0.42, 0.8, 15.4, 15.6, tela);
      B(f, 1.4, 2.8, 0, 0.35, 13.0, 13.8, marmol);
      B(f, 4.6, 6.4, 0, 1.0, 11.8, 12.6, madera); B(f, 4.55, 6.45, 1.0, 1.06, 11.75, 12.65, marmol);
      letrero(f, 'DURO CAFÉ', '#ffd166', 2.0, 5.5, 2.3, 12.2, Math.PI / 4);
      for (const [x, z] of [[0.5, 11.3], [8.9, 15.5], [6.2, 5.5]]) planta(f, x, z);
      letrero(f, 'CENTRO DE ENCUENTRO', '#ffffff', 3.2, 2.6, 2.6, 11.3, Math.PI / 4);
      // Entrada principal con arco dorado
      for (const x of [6.5, 9.5]) B(f, x - 0.15, x + 0.15, 0, 2.9, L - 0.15, L + 0.15, oro);
      for (let k = 0; k < 8; k++) camina(f, 'cliente' + k, ropa(), geo.casa.paseo);
    }

    // ===== Piso 2 · Oficinas DURO =====
    let tab;
    {
      const f = pisos[1];
      letrero(f, 'OFICINAS DURO', '#ffd166', 3.0, 3.6, 2.6, 2.6, Math.PI / 4);
      B(f, 3.0, 5.4, 0, 1.05, 4.0, 4.7, blanco); B(f, 2.95, 5.45, 1.05, 1.1, 3.95, 4.75, oro);           // recepción
      persona(f, 'recepcion', {camisa: '#ffd166'}, 4.2, 5.2, Math.PI);
      // Tablero de misiones en la pared del fondo
      tab = lienzo(640, 320);
      const tablero = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tab.t, toneMapped: false})); res.push(tablero.material);
      tablero.scale.set(3.2, 1.6, 1); tablero.position.set(X0 + 6.5, 1.7, Z0 + 0.06); f.add(tablero);
      B(f, 4.8, 8.2, 0.8, 2.6, 0.01, 0.04, oro);
      // Escritorios en dos filas, con su equipo trabajando
      const equipos = ['Management', 'Marketing', 'Booking', 'Legal', 'Contenido', 'Finanzas', 'Diseño', 'Eventos'];
      equipos.forEach((nombre, k) => {
        const x = 3.8 + (k % 4) * 2.6, z = k < 4 ? 6.6 : 10.0;
        B(f, x - 0.8, x + 0.8, 0.72, 0.77, z - 0.35, z + 0.35, blanco); for (const sx of [-0.75, 0.75]) B(f, x + sx - 0.03, x + sx + 0.03, 0, 0.72, z - 0.3, z + 0.3, metal);
        B(f, x - 0.35, x + 0.35, 0.8, 1.22, z - 0.3, z - 0.26, negro); B(f, x - 0.32, x + 0.32, 0.83, 1.19, z - 0.255, z - 0.25, neon('#38e8ff', 0.8));
        B(f, x - 0.25, x + 0.25, 0.42, 0.48, z + 0.45, z + 0.95, mat('#2a2d40'));
        if (k !== 3 && k !== 6) persona(f, 'oficina' + k, ropa(), x, z + 0.7, Math.PI, 'teclea');
        letrero(f, nombre.toUpperCase(), '#ffffff', 1.3, x, 1.5, z - 0.24);
      });
      // Sala de juntas de vidrio
      B(f, 11.0, 11.03, 0, 2.7, 0.2, 4.6, vidrio); B(f, 11.0, L, 0, 2.7, 4.58, 4.62, vidrio);
      B(f, 12.0, 15.0, 0.72, 0.78, 1.6, 3.0, madera); B(f, 13.4, 13.6, 0, 0.72, 2.2, 2.4, negro);
      for (const x of [12.4, 13.5, 14.6]) for (const z of [1.2, 3.4]) B(f, x - 0.22, x + 0.22, 0.42, 0.5, z - 0.2, z + 0.2, mat('#2a2d40'));
      letrero(f, 'SALA DE JUNTAS', '#ffd166', 2.4, 13.5, 2.45, 4.65);
      // Zona de descanso
      B(f, 12.0, 15.6, 0, 0.42, 13.6, 14.4, mat('#3b2a4a', {roughness: 0.9})); B(f, 12.0, 15.6, 0.42, 0.8, 14.2, 14.4, mat('#3b2a4a', {roughness: 0.9}));
      B(f, 13.0, 14.6, 0, 0.35, 12.2, 13.0, marmol);
      for (const [x, z] of [[0.6, 15.3], [11.4, 15.3], [15.4, 5.4]]) planta(f, x, z);
    }

    // ===== Piso 3 · Estudios de música =====
    {
      const f = pisos[2], panel = mat('#4a3466', {roughness: 0.95}), panel2 = mat('#6a4a8c', {roughness: 0.95});
      [['ESTUDIO A', 2.6], ['ESTUDIO B', 7.1], ['ESTUDIO C', 11.6]].forEach(([nombre, x0], j) => {
        const x1 = x0 + 4.4, xc = (x0 + x1) / 2;
        B(f, x0, x1, 0, 0.012, 0, 7.4, mat('#6e5a86', {roughness: 0.6}));
        B(f, x0 - 0.06, x0 + 0.06, 0, 2.7, 0, 7.4, panel);                                        // paredes entre estudios
        if (j === 2) B(f, x1 - 0.06, x1 + 0.06, 0, 2.7, 0, 7.4, panel);
        // Frente de vidrio con puerta, y vidrio entre la cabina de voz y el control
        B(f, x0, xc - 0.5, 0, 2.7, 7.38, 7.42, vidrio); B(f, xc + 0.5, x1, 0, 2.7, 7.38, 7.42, vidrio);
        B(f, x0, x1 - 1.2, 0, 2.7, 3.48, 3.52, vidrio); B(f, x1 - 0.4, x1, 0, 2.7, 3.48, 3.52, vidrio);
        letrero(f, nombre, '#ff6f9a', 2.2, xc, 2.45, 7.45);
        // Paneles acústicos en la cabina
        for (let k = 0; k < 7; k++) B(f, x0 + 0.3 + k * 0.55, x0 + 0.75 + k * 0.55, 0.9, 2.3, 0.02, 0.08, k % 2 ? panel : panel2);
        // Micrófono en la cabina
        Cil(f, 0.015, 1.45, metal, xc, 0, 1.6); Cil(f, 0.12, 0.03, metal, xc, 0, 1.6);
        const mic = new THREE.Mesh(GEO.torso, mat('#2b2b33', {metalness: 0.6, roughness: 0.3})); mic.scale.setScalar(0.25); mic.position.set(X0 + xc, 1.5, Z0 + 1.7); f.add(mic);
        // Control: consola, dos monitores y parlantes
        B(f, xc - 1.2, xc + 1.2, 0.72, 0.8, 4.0, 4.7, oscuro); B(f, xc - 1.1, xc + 1.1, 0.8, 0.84, 4.1, 4.6, neon(j === 1 ? '#38e8ff' : '#ff3d6e', 0.6));
        for (const dx of [-0.5, 0.5]) B(f, xc + dx - 0.3, xc + dx + 0.3, 0.9, 1.3, 3.9, 3.95, negro);
        for (const dx of [-1.4, 1.4]) B(f, xc + dx - 0.15, xc + dx + 0.15, 0.8, 1.2, 4.1, 4.35, negro);
        B(f, xc - 1.2, xc - 0.8, 0, 0.72, 4.0, 4.7, oscuro); B(f, xc + 0.8, xc + 1.2, 0, 0.72, 4.0, 4.7, oscuro);
        if (j > 0) { persona(f, 'productor' + j, ropa(), xc, 5.3, Math.PI, 'teclea'); persona(f, 'cantante' + j, {...ropa(), audifonos: true}, xc, 2.1, Math.PI, 'canta'); }
      });
      // Sala común: piano, sofá, guitarras y discos de oro en la pared
      B(f, 2.8, 4.6, 0.7, 0.8, 10.4, 11.0, negro); B(f, 2.85, 4.55, 0.8, 0.83, 10.45, 10.75, blanco);
      for (const sx of [3.0, 4.4]) B(f, sx - 0.04, sx + 0.04, 0, 0.7, 10.5, 10.9, negro);
      B(f, 7.0, 11.0, 0, 0.42, 13.6, 14.4, mat('#4a2340', {roughness: 0.9})); B(f, 7.0, 11.0, 0.42, 0.8, 14.2, 14.4, mat('#4a2340', {roughness: 0.9}));
      for (let k = 0; k < 4; k++) { const d = cilindro(0.35, 0.03, oro, X0 + 0.06, 1.6, Z0 + 9.5 + k * 1.1); d.rotation.z = Math.PI / 2; f.add(d); }
      for (const z of [12.6, 13.2]) { B(f, 13.5, 13.62, 0, 1.0, z - 0.05, z + 0.05, madera); B(f, 13.4, 13.72, 0.2, 0.6, z - 0.12, z + 0.12, madera); }
      letrero(f, 'DURO RECORDS', '#ff6f9a', 3.2, 0.07, 2.5, 11.2, Math.PI / 2);
      for (const [x, z] of [[15.4, 15.3], [0.6, 15.3]]) planta(f, x, z);
    }

    // ===== Piso 4 · Video y streaming =====
    {
      const f = pisos[3], verde = mat('#16c35a', {roughness: 0.9});
      // Pantalla verde (ciclorama) con cámara y dos luces
      B(f, 2.6, 8.4, 0, 2.9, 0.02, 0.1, verde); B(f, 2.6, 8.4, 0, 0.02, 0.1, 4.0, verde);
      Cil(f, 0.03, 1.3, metal, 5.5, 0, 4.6); B(f, 5.3, 5.7, 1.3, 1.6, 4.3, 4.8, negro);
      for (const x of [3.4, 7.6]) { Cil(f, 0.03, 1.8, metal, x, 0, 4.2); const sb = caja(0.7, 0.7, 0.1, neon('#fff6e0', 1.2), X0 + x, 1.95, Z0 + 4.15, false); sb.rotation.y = x < 5 ? 0.5 : -0.5; f.add(sb); }
      letrero(f, 'SET DE VIDEO', '#3ddc84', 2.2, 5.5, 3.0, 0.12);
      // Cuarto de streaming: escritorio con tres monitores, aro de luz y ON AIR
      B(f, 10.0, 15.0, 0.72, 0.78, 0.3, 1.2, negro); for (const x of [10.2, 14.8]) B(f, x - 0.04, x + 0.04, 0, 0.72, 0.4, 1.1, metal);
      for (const dx of [-1.1, 0, 1.1]) { B(f, 12.5 + dx - 0.5, 12.5 + dx + 0.5, 0.9, 1.5, 0.35, 0.4, negro); B(f, 12.5 + dx - 0.46, 12.5 + dx + 0.46, 0.94, 1.46, 0.41, 0.42, neon(['#ff3d6e', '#38e8ff', '#a855f7'][dx + 1 | 0] || '#ff3d6e', 0.7)); }
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 8, 32), neon('#ffffff', 1.3)); res.push(aro.geometry); aro.position.set(X0 + 12.5, 1.55, Z0 + 1.4); f.add(aro);
      B(f, 12.2, 12.8, 0.45, 0.52, 2.0, 2.6, mat('#ff3d6e'));
      letrero(f, '● ON AIR', '#ff2a2a', 1.8, 12.5, 2.5, 0.08, 0, '#1a0508');
      letrero(f, 'DURO LIVE', '#ff3d6e', 3.0, 15.93, 1.8, 2.6, -Math.PI / 2);
      // Set de podcast
      B(f, 1.2, 1.26, 0.4, 2.6, 8.4, 13.6, mat('#1a0f26')); letrero(f, 'DURO PODCAST', '#ffd166', 4.2, 1.3, 1.6, 11.0, Math.PI / 2);
      Cil(f, 0.9, 0.06, madera, 4.4, 0.72, 11.0); Cil(f, 0.08, 0.72, negro, 4.4, 0, 11.0);
      [-1.1, 0, 1.1].forEach((a, k) => {
        const x = 4.4 + Math.cos(a) * 1.3, z = 11.0 + Math.sin(a) * 1.3;
        Cil(f, 0.02, 0.3, metal, 4.4 + (x - 4.4) * 0.6, 0.78, 11.0 + (z - 11.0) * 0.6);
        persona(f, 'podcast' + k, ropa(), x, z, Math.atan2(4.4 - x, 11.0 - z), 'sentado');
      });
      // Sala de edición
      for (const x of [11.2, 13.8]) {
        B(f, x - 0.9, x + 0.9, 0.72, 0.77, 10.0, 10.7, blanco); B(f, x - 0.5, x + 0.5, 0.8, 1.3, 10.02, 10.07, negro); B(f, x - 0.46, x + 0.46, 0.84, 1.26, 10.075, 10.08, neon('#38e8ff', 0.7));
      }
      persona(f, 'editor', ropa(), 11.2, 11.1, Math.PI, 'teclea');
      letrero(f, 'EDICIÓN', '#38e8ff', 1.6, 12.5, 2.3, 9.95);
      for (const [x, z] of [[15.4, 15.3], [8.6, 15.3]]) planta(f, x, z);
    }

    // ===== Piso 5 · Hotel DURO: pasillo con alfombra y habitaciones =====
    {
      const f = pisos[4], pared = mat('#efe6d8', {roughness: 0.85});
      B(f, 0, L, 0, 0.014, 7.0, 9.0, mat('#7a1426', {roughness: 0.95}));
      for (const x of [0.4, L - 0.4]) B(f, x - 0.02, x + 0.02, 0, 0.02, 7.1, 8.9, neon('#ffd166', 0.9));
      const cuartos = [[2.4, 6.9, 0, 7.0], [6.9, 11.4, 0, 7.0], [11.4, L, 0, 7.0], [0, 4, 9.0, L], [4, 8, 9.0, L], [8, 12, 9.0, L], [12, L, 9.0, L]];
      cuartos.forEach(([x0, x1, z0, z1], k) => {
        const atras = z0 === 0, zP = atras ? z1 : z0, xc = (x0 + x1) / 2;
        // Paredes bajitas (como casa de muñecas) para ver cada habitación por dentro: hacia el pasillo con puerta y con el vecino
        const hW = 0.9;
        B(f, x0, xc - 0.5, 0, hW, zP - 0.05, zP + 0.05, pared); B(f, xc + 0.5, x1, 0, hW, zP - 0.05, zP + 0.05, pared);
        B(f, x1 - 0.05, x1 + 0.05, 0, hW, z0, z1, pared);
        for (const dx of [-0.5, 0.5]) B(f, xc + dx - 0.05, xc + dx + 0.05, 0, 1.5, zP - 0.06, zP + 0.06, oro);
        letrero(f, `${501 + k}`, '#ffd166', 0.8, xc, 1.62, atras ? zP + 0.07 : zP - 0.07, atras ? 0 : Math.PI);
        // Cama doble con almohadas, mesa de noche con lámpara y tapete
        const zc = atras ? z0 + 2.0 : z1 - 2.0, sg = atras ? 1 : -1;
        B(f, xc - 0.9, xc + 0.9, 0, 0.45, zc - 1.0, zc + 1.0, blanco); B(f, xc - 0.95, xc + 0.95, 0, 1.1, zc - sg * 1.05 - 0.05, zc - sg * 1.05 + 0.05, madera);
        B(f, xc - 0.88, xc + 0.88, 0.45, 0.52, Math.min(zc - 0.3 * sg, zc + sg), Math.max(zc - 0.3 * sg, zc + sg), mat(pick(['#a855f7', '#38e8ff', '#ff3d6e', '#ffd166'])));
        for (const dx of [-0.45, 0.45]) B(f, xc + dx - 0.3, xc + dx + 0.3, 0.45, 0.6, zc - sg * 0.85 - 0.15, zc - sg * 0.85 + 0.15, blanco);
        B(f, xc + 1.1, xc + 1.5, 0, 0.5, zc - sg * 0.8 - 0.2, zc - sg * 0.8 + 0.2, madera);
        const lampara = new THREE.Mesh(GEO.sphere, luzCalida); lampara.scale.setScalar(0.12); lampara.position.set(X0 + xc + 1.3, 0.68, Z0 + zc - sg * 0.8); f.add(lampara);
        B(f, xc - 1.0, xc + 1.0, 0, 0.012, zc + sg * 1.1, zc + sg * 2.4, mat('#c9b79c', {roughness: 0.95}));
        if (k === 1 || k === 5) persona(f, 'huesped' + k, ropa(), xc, zc, atras ? Math.PI : 0, 'acostado');
      });
      letrero(f, 'HOTEL DURO', '#ffd166', 2.6, 1.2, 2.5, 6.9, 0);
      camina(f, 'huesped-pasillo', ropa(), [[3, 8], [8, 8], [13, 8], [15.2, 8]].map(([x, z]) => ({x: X0 + x, z: Z0 + z})), 0.8);
      camina(f, 'botones', {camisa: '#7a1426', pantalon: '#141414'}, [[2.6, 8.2], [10, 7.8], [14.6, 8.2]].map(([x, z]) => ({x: X0 + x, z: Z0 + z})), 0.9);
    }

    // ===== Piso 6 · Penthouse de Brayan =====
    let hoyApp;
    {
      const f = pisos[5];
      // Gimnasio (al lado del ascensor)
      B(f, 2.6, 6.6, 0, 0.012, 0.2, 3.8, mat('#222', {roughness: 0.9}));
      B(f, 3.4, 5.4, 0.4, 0.5, 1.4, 1.8, negro); for (const x of [3.6, 5.2]) B(f, x - 0.05, x + 0.05, 0, 0.4, 1.4, 1.8, metal);
      for (const z of [0.6, 3.0]) { B(f, 5.9, 6.0, 0, 2.0, z - 0.05, z + 0.05, metal); }
      B(f, 5.9, 6.0, 1.6, 1.65, 0.6, 3.0, metal); for (const z of [0.9, 2.7]) Cil(f, 0.25, 0.08, negro, 5.95, 1.55, z);
      // Tablero HOY con las tareas y hábitos de la app (pared izquierda)
      const hoy = lienzo(640, 420);
      const pHoy = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: hoy.t, toneMapped: false})); res.push(pHoy.material);
      pHoy.scale.set(2.6, 2.6 * 420 / 640, 1); pHoy.rotation.y = Math.PI / 2; pHoy.position.set(X0 + 0.07, 1.75, Z0 + 5.4); f.add(pHoy);
      f.add(caja(0.04, 2.6 * 420 / 640 + 0.12, 2.72, oro, X0 + 0.04, 1.75, Z0 + 5.4, false));
      // Sala: TV grande en la pared izquierda, sofá en L y lámpara de araña
      B(f, 0.6, 7.8, 0, 0.012, 6.6, 11.4, mat('#b5835a', {roughness: 0.95}));
      const tv = lienzo(512, 288);
      { const x = tv.cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 512, 288); gr.addColorStop(0, '#1a0510'); gr.addColorStop(1, '#05060f'); x.fillStyle = gr; x.fillRect(0, 0, 512, 288); x.fillStyle = '#ff3d6e'; x.font = '800 64px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.fillText('DURO', 256, 150); x.fillStyle = '#fff'; x.font = '24px ui-monospace, Menlo, monospace'; x.fillText('desde Urabá', 256, 200); }
      const pTV = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tv.t, toneMapped: false})); res.push(pTV.material);
      pTV.scale.set(2.8, 1.58, 1); pTV.rotation.y = Math.PI / 2; pTV.position.set(X0 + 0.1, 1.5, Z0 + 8.6); f.add(pTV);
      B(f, 0.05, 0.1, 0.65, 2.35, 7.1, 10.1, negro); B(f, 0.1, 0.6, 0, 0.45, 7.2, 10.0, madera);
      const tela = mat('#3b2a4a', {roughness: 0.9});
      B(f, 5.0, 5.9, 0, 0.42, 7.0, 10.6, tela); B(f, 5.7, 5.95, 0.42, 0.8, 7.0, 10.6, tela); B(f, 2.6, 5.9, 0, 0.42, 10.0, 10.9, tela);
      B(f, 2.6, 4.0, 0, 0.32, 8.0, 9.4, marmol);
      const arana = new THREE.Group(); arana.position.set(X0 + 3.6, 2.7, Z0 + 8.6); f.add(arana);
      const aroA = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 40), oro); res.push(aroA.geometry); aroA.rotation.x = Math.PI / 2; arana.add(aroA);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, b_ = new THREE.Mesh(GEO.sphere, luzCalida); b_.scale.setScalar(0.07); b_.position.set(Math.cos(a) * 0.55, -0.05, Math.sin(a) * 0.55); arana.add(b_); }
      // Cocina contra el fondo, isla y comedor
      B(f, 9.0, 15.6, 0, 0.9, 0.2, 0.9, oscuro); B(f, 9.0, 15.6, 0.9, 0.95, 0.15, 0.95, marmol); B(f, 9.0, 15.6, 1.6, 2.4, 0.2, 0.55, madera);
      B(f, 10.2, 13.8, 0, 0.9, 3.0, 3.8, oscuro); B(f, 10.1, 13.9, 0.9, 0.96, 2.95, 3.85, marmol);
      for (const x of [10.8, 12.0, 13.2]) { Cil(f, 0.16, 0.05, oscuro, x, 0.6, 4.3); Cil(f, 0.025, 0.6, oro, x, 0, 4.3); }
      B(f, 10.6, 13.4, 0.72, 0.78, 5.8, 7.0, madera); for (const x of [11.0, 12.0, 13.0]) for (const z of [5.4, 7.4]) B(f, x - 0.2, x + 0.2, 0, 0.45, z - 0.2, z + 0.2, madera);
      // Cuarto principal (adelante a la derecha): cama king con cabecero dorado
      B(f, 9.4, L, 0, 1.3, 9.0, 9.1, mat('#efe6d8', {roughness: 0.85}));
      B(f, 11.4, 13.6, 0, 0.5, 9.2, 11.8, blanco); B(f, 11.3, 13.7, 0, 1.4, 9.1, 9.25, oro);
      B(f, 11.45, 13.55, 0.5, 0.58, 10.4, 11.8, mat('#2a1d3a'));
      for (const dx of [-0.5, 0.5]) B(f, 12.5 + dx - 0.35, 12.5 + dx + 0.35, 0.5, 0.66, 9.35, 9.75, blanco);
      for (const x of [10.9, 14.1]) { B(f, x - 0.25, x + 0.25, 0, 0.5, 9.25, 9.75, madera); const l = new THREE.Mesh(GEO.sphere, luzCalida); l.scale.setScalar(0.12); l.position.set(X0 + x, 0.68, Z0 + 9.5); f.add(l); }
      B(f, 10.6, 14.4, 0, 0.012, 12.2, 14.6, mat('#d9c9a8', {roughness: 0.95}));
      for (const [x, z] of [[8.6, 15.3], [0.6, 15.3], [15.4, 6.6]]) planta(f, x, z, 1.2);
      letrero(f, 'PENTHOUSE', '#ffd166', 2.4, 4.0, 2.6, 4.4, Math.PI / 4);
      hoyApp = construirHoy(hoy);
    }

    // ===== Rooftop: piscina infinita, jardín de hábitos, bar y el letrero del edificio =====
    let macetas;
    {
      const f = pisos[6];
      B(f, 0, L, 0, 0.02, 0, L, mat('#b98a5c', {roughness: 0.7}));
      // Baranda de vidrio
      B(f, 0, L, 0, 1.0, L - 0.04, L, vidrio); B(f, L - 0.04, L, 0, 1.0, 0, L, vidrio);
      B(f, 0, L, 1.0, 1.05, L - 0.06, L + 0.02, oro); B(f, L - 0.06, L + 0.02, 1.0, 1.05, 0, L, oro);
      // Piscina infinita
      B(f, 8.4, 15.6, 0, 0.3, 7.8, 15.2, marmol);
      const agua = new THREE.Mesh(GEO.plane, new THREE.MeshStandardMaterial({color: '#29b6f6', emissive: '#1e88e5', emissiveIntensity: 0.55, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.92}));
      res.push(agua.material); agua.scale.set(6.8, 7.0, 1); agua.rotation.x = -Math.PI / 2; agua.position.set(X0 + 12.0, 0.31, Z0 + 11.5); f.add(agua);
      for (const z of [10.6, 13.0]) { const sil = caja(0.6, 0.12, 1.5, blanco, X0 + 7.4, 0.26, Z0 + z); sil.rotation.x = -0.12; f.add(sil); }
      palma(f, 15.0, 6.6, 3.2); palma(f, 7.6, 15.2, 2.8); palma(f, 0.8, 15.0, 3.0);
      // Jardín con fuente y una matica por hábito alrededor
      B(f, 1.4, 7.6, 0, 0.03, 3.4, 9.0, mat('#3e8f45', {roughness: 0.95}));
      Cil(f, 0.9, 0.35, marmol, 4.5, 0, 6.0);
      const aguaF = cilindro(0.78, 0.04, new THREE.MeshStandardMaterial({color: '#4fc3f7', emissive: '#1e88e5', emissiveIntensity: 0.5, roughness: 0.1}), X0 + 4.5, 0.34, Z0 + 6.0); res.push(aguaF.material); f.add(aguaF);
      Cil(f, 0.12, 1.1, marmol, 4.5, 0, 6.0); Cil(f, 0.35, 0.08, marmol, 4.5, 1.1, 6.0);
      macetas = [0, 1, 2, 3, 4, 5].map(k => {
        const a = Math.PI * (0.15 + k * 0.34), m = new THREE.Group(); m.position.set(X0 + 4.5 + Math.cos(a) * 2.0, 0, Z0 + 6.0 - Math.sin(a) * 2.0); f.add(m);
        m.add(cilindro(0.2, 0.3, mat('#b5653a', {roughness: 0.8}), 0, 0.15, 0));
        const mata = new THREE.Mesh(GEO.sphere, mat('#3fbf6a', {flatShading: true})); mata.position.y = 0.3; m.add(mata);
        const flor = new THREE.Mesh(GEO.sphere, neon('#ffd34d', 1)); flor.scale.setScalar(0.09); m.add(flor);
        m.visible = false; return {m, mata, flor};
      });
      // Bar y fogata con sofás
      B(f, 9.0, 15.4, 0, 1.05, 0.5, 1.2, oscuro); B(f, 8.95, 15.45, 1.05, 1.1, 0.45, 1.25, marmol);
      for (let k = 0; k < 5; k++) { Cil(f, 0.16, 0.05, oscuro, 9.6 + k * 1.3, 0.7, 1.8); Cil(f, 0.025, 0.7, oro, 9.6 + k * 1.3, 0, 1.8); }
      Cil(f, 0.6, 0.3, oscuro, 12.2, 0, 4.6); const fuego = new THREE.Mesh(GEO.leaf, neon('#ff7a1a', 1.6)); fuego.scale.set(0.35, 0.5, 0.35); fuego.position.set(X0 + 12.2, 0.55, Z0 + 4.6); f.add(fuego);
      animados.push(t => { fuego.scale.y = 0.45 + Math.sin(t * 9) * 0.08; fuego.rotation.y = t * 2; });
      for (const [x, z, w, d] of [[10.0, 4.6, 0.7, 2.2], [14.4, 4.6, 0.7, 2.2]]) B(f, x - w / 2, x + w / 2, 0, 0.42, z - d / 2, z + d / 2, mat('#3b2a4a', {roughness: 0.9}));
      // Salida del ascensor y cuarto de máquinas
      B(f, 0.2, 2.2, 0, 2.6, 0.2, 2.2, vidrio); B(f, 0.1, 2.3, 2.6, 2.75, 0.1, 2.3, oro);
      // El letrero del edificio, de frente a la ciudad
      const cartelE = letrero(f, 'EDIFICIO DURO', '#ffd166', 9.0, 9.0, 3.4, 0.5); cartelE.scale.set(9, 2.0, 1);
      for (const x of [4.8, 13.2]) B(f, x - 0.07, x + 0.07, 0, 2.4, 0.43, 0.57, oro);
    }

    // Estrellas de los sueños que ya son reales
    const cvE = document.createElement('canvas'); cvE.width = cvE.height = 128;
    { const x = cvE.getContext('2d'); x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⭐', 64, 70); }
    const tE = new THREE.CanvasTexture(cvE); res.push(tE);
    const matE = new THREE.SpriteMaterial({map: tE, transparent: true, depthWrite: false}); res.push(matE);
    const estrellas = {};
    for (const [id, p] of Object.entries(geo.casa.suenos)) {
      const sp = new THREE.Sprite(matE); sp.scale.setScalar(0.55); sp.position.set(p.x, p.y, p.z); sp.visible = false; g.add(sp); estrellas[id] = sp;
    }

    construirMoto(pisos[0], geo.casa.moto, res);
    // Brayan vive en su penthouse
    const brayan = crearPersona({nombre: 'Brayan Trampa', estado: 'activo'}, {camisa: '#ff5a00', pantalon: '#141414', pelo: '#0d0d12', piel: '#8d5a3b', gafas: true});
    const L0 = geo.casa.lugares[0];
    brayan.raiz.position.set(L0.x, L0.y, L0.z); g.add(brayan.raiz);

    // Hábitos: una matica por hábito en el jardín del rooftop (crece con la semana, florece si ya lo hizo hoy)
    const actualizarHabitos = habitos => macetas.forEach((o, i) => {
      const h_ = habitos[i]; o.m.visible = !!h_;
      if (!h_) return;
      const k = Math.min(1, (h_.semana || 0) / Math.max(1, h_.meta || 7));
      o.mata.scale.set(0.22 + k * 0.12, 0.18 + k * 0.5, 0.22 + k * 0.12); o.mata.position.y = 0.3 + o.mata.scale.y * 0.6;
      o.flor.visible = !!h_.hoy; o.flor.position.y = 0.3 + o.mata.scale.y * 1.5;
    });
    const hoyConMacetas = {clave: null, actualizar(A_) { hoyApp.actualizar(A_); actualizarHabitos(A_?.habitos || []); }};
    hoyConMacetas.actualizar(null);
    return {tablero: tab, hoyApp: hoyConMacetas, brayan, estrellas, lugares: geo.casa.lugares, pisos, cabina, animados, caminantes, ascensor: A, PH,
      i: 0, x: L0.x, y: L0.y, z: L0.z, rot: L0.rot, ruta: null, d: 0, destino: null, timer: rand(4, 8), ultimo: -1, verHasta: 7};
  }

  // Tablero «HOY» del penthouse: tareas y hábitos de la app
  function construirHoy(hoy) {
    const cortarT = (t, n) => { t = String(t ?? ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
    return {actualizar(A) {
      const tareas = A?.tareas || [], habitos = A?.habitos || [];
      const x = hoy.cv.getContext('2d'), w = 640;
      x.fillStyle = '#1a1206'; x.fillRect(0, 0, w, 420); x.textBaseline = 'alphabetic';
      x.fillStyle = '#f5d76e'; x.font = '800 40px Georgia, serif'; x.textAlign = 'center'; x.fillText('HOY', w / 2, 52);
      x.textAlign = 'left'; x.font = '700 22px ui-monospace, Menlo, monospace'; x.fillStyle = 'rgba(255,255,255,.6)';
      x.fillText(`TAREAS ${tareas.filter(t_ => t_.hecha).length}/${tareas.length}`, 24, 94); x.fillText('HÁBITOS (SEMANA)', 340, 94);
      if (!tareas.length) { x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '22px ui-monospace, Menlo, monospace'; x.fillText('Sin tareas en la app', 24, 134); }
      tareas.slice(0, 7).forEach((t_, i) => {
        x.fillStyle = t_.hecha ? '#3ddc84' : '#fff'; x.font = '24px ui-monospace, Menlo, monospace';
        x.fillText(`${t_.hecha ? '✓' : '○'} ${cortarT(t_.titulo, 17)}`, 24, 134 + i * 40);
      });
      if (!habitos.length) { x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '22px ui-monospace, Menlo, monospace'; x.fillText('Sin hábitos en la app', 340, 134); }
      habitos.slice(0, 6).forEach((h_, i) => {
        const y = 134 + i * 46, k = Math.min(1, (h_.semana || 0) / Math.max(1, h_.meta || 7));
        x.fillStyle = h_.hoy ? '#ffd34d' : '#fff'; x.font = '24px ui-monospace, Menlo, monospace'; x.fillText(`${h_.hoy ? '★' : '·'} ${cortarT(h_.nombre, 10)}`, 340, y);
        x.fillStyle = 'rgba(255,255,255,.6)'; x.textAlign = 'right'; x.fillText(`${h_.semana}/${h_.meta}`, w - 24, y); x.textAlign = 'left';
        x.fillStyle = '#2a2016'; x.fillRect(340, y + 8, w - 364, 8); x.fillStyle = '#3fbf6a'; x.fillRect(340, y + 8, (w - 364) * k, 8);
      });
      hoy.t.needsUpdate = true;
    }};
  }

  function construirMoto(g, pos, res) {
    const m = new THREE.Group(); m.position.set(pos.x, 0, pos.z); m.rotation.y = pos.rot; g.add(m);
    const negro = mat('#0e0f12', {roughness: 0.4, metalness: 0.35}), verde = mat('#16a34a', {roughness: 0.35, metalness: 0.15});
    const gris = mat('#3a3d45', {metalness: 0.7, roughness: 0.35}), cromo = mat('#c9ccd2', {roughness: 0.15, metalness: 1}), goma = mat('#0a0a0a', {roughness: 0.95});
    // Ruedas: delantera 21" y trasera 18", con tacos
    for (const [z, r] of [[0.68, 0.36], [-0.62, 0.31]]) {
      const geoR = new THREE.TorusGeometry(r, 0.07, 10, 28); res.push(geoR);
      const rueda = new THREE.Mesh(geoR, goma); rueda.rotation.y = Math.PI / 2; rueda.position.set(0, r + 0.07, z); rueda.castShadow = true; m.add(rueda);
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; m.add(caja(0.15, 0.04, 0.05, goma, 0, r + 0.07 + Math.sin(a) * (r + 0.06), z + Math.cos(a) * (r + 0.06), false)); }
      const rin = cilindro(r - 0.06, 0.02, cromo, 0, r + 0.07, z); rin.rotation.z = Math.PI / 2; m.add(rin);
      const eje = cilindro(0.05, 0.16, gris, 0, r + 0.07, z); eje.rotation.z = Math.PI / 2; m.add(eje);
    }
    // Chasis negro, motor y protector
    const chasis = caja(0.08, 0.08, 1.15, negro, 0, 0.78, 0.02); chasis.rotation.x = -0.08; m.add(chasis);
    m.add(caja(0.26, 0.3, 0.36, gris, 0, 0.5, 0.05));
    m.add(caja(0.3, 0.05, 0.42, mat('#1d1f24', {metalness: 0.6}), 0, 0.32, 0.05, false));
    // Tanque negro con laterales verdes (las tapas tipo enduro)
    m.add(caja(0.26, 0.2, 0.42, negro, 0, 0.98, 0.22));
    for (const sx of [-1, 1]) { const tapa = caja(0.03, 0.26, 0.4, verde, sx * 0.14, 0.95, 0.24, false); tapa.rotation.x = -0.15; m.add(tapa); }
    // Sillín largo y plano, y colita verde con stop
    m.add(caja(0.22, 0.08, 0.72, negro, 0, 1.04, -0.28));
    for (const sx of [-1, 1]) m.add(caja(0.03, 0.14, 0.5, verde, sx * 0.12, 0.92, -0.42, false));
    m.add(caja(0.18, 0.05, 0.3, verde, 0, 0.97, -0.78, false));
    m.add(caja(0.08, 0.04, 0.03, new THREE.MeshBasicMaterial({color: '#ff2a2a', toneMapped: false}), 0, 0.95, -0.94, false));
    // Horquilla larga, guardabarros delantero alto (verde), manubrio ancho y farola con máscara
    for (const sx of [-1, 1]) { const h = caja(0.05, 0.85, 0.05, cromo, sx * 0.09, 0.8, 0.58); h.rotation.x = 0.28; m.add(h); }
    m.add(caja(0.18, 0.04, 0.55, verde, 0, 0.95, 0.78, false));
    m.add(caja(0.7, 0.03, 0.03, negro, 0, 1.24, 0.42));
    for (const sx of [-1, 1]) m.add(caja(0.08, 0.04, 0.04, mat('#222'), sx * 0.36, 1.24, 0.42, false));
    m.add(caja(0.22, 0.24, 0.06, verde, 0, 1.08, 0.58, false));
    const farola = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({color: '#fff3d6', toneMapped: false})); farola.scale.set(0.06, 0.06, 0.03); farola.position.set(0, 1.08, 0.62); m.add(farola);
    // Exhosto alto, típico de enduro
    const exh = cilindro(0.045, 0.55, cromo, 0.15, 0.82, -0.45); exh.rotation.x = Math.PI / 2 - 0.35; m.add(exh);
    m.rotation.z = 0.07;   // apoyada en la pata lateral
    return m;
  }

  // Tablero de la casa: las misiones que hay que resolver pronto
  function dibujarTablero(room, enVivo) {
    const C = room.casa, x = C.tablero.cv.getContext('2d'), w = 640, h = 320;
    x.fillStyle = '#14100b'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffc21a'; x.font = '800 30px ui-monospace, Menlo, monospace'; x.textBaseline = 'top'; x.fillText('🎯 MISIONES', 22, 16);
    if (enVivo) { x.fillStyle = '#ff2a2a'; x.font = '700 22px ui-monospace, Menlo, monospace'; x.fillText('● BRAYAN ESTÁ EN EL LIVE', 330, 22); }
    const orden = {pronto: 0, mes: 1, luego: 2};
    const lista = (datos.misiones || []).filter(m => !m.hecha).sort((a, b) => (orden[a.prioridad] ?? 3) - (orden[b.prioridad] ?? 3)).slice(0, 4);
    lista.forEach((m, k) => {
      const y = 70 + k * 60, total = m.pasos?.length || 0, hechos = (m.pasos || []).filter(p => p.hecho).length;
      x.fillStyle = m.prioridad === 'pronto' ? '#ff5470' : m.prioridad === 'mes' ? '#ffb020' : '#8d95c4';
      x.font = '700 15px ui-monospace, Menlo, monospace'; x.fillText(m.prioridad === 'pronto' ? 'PRONTO' : m.prioridad === 'mes' ? 'ESTE MES' : 'LUEGO', 22, y);
      x.fillStyle = '#fff'; x.font = '700 22px ui-monospace, Menlo, monospace'; x.fillText(m.titulo.length > 34 ? m.titulo.slice(0, 33) + '…' : m.titulo, 120, y - 3);
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(120, y + 26, 380, 8);
      x.fillStyle = '#3ddc84'; x.fillRect(120, y + 26, total ? 380 * hechos / total : 0, 8);
      // Salas que mueve esta misión
      (m.salas || []).forEach((id, j) => { const s = datos.salas.find(z => z.id === id); if (!s) return; x.fillStyle = s.color; x.beginPath(); x.arc(526 + j * 22, y + 12, 8, 0, Math.PI * 2); x.fill(); });
    });
    if (!lista.length) { x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '22px ui-monospace, Menlo, monospace'; x.fillText('Todo al día. Agrega misiones en la pestaña Misiones.', 22, 90); }
    C.tablero.t.needsUpdate = true;
  }

  // Selector de pisos del Edificio DURO: para ver un piso por dentro se esconden los de arriba
  const selPisos = document.createElement('div');
  selPisos.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);display:none;flex-direction:column;gap:4px;z-index:5;font:700 12px ui-monospace,Menlo,monospace';
  if (!publico) contenedor.appendChild(selPisos);
  function verPiso(room, n, mover = true) {
    const C = room.casa; C.verHasta = n;
    C.pisos.forEach((fg, k) => { fg.visible = k + 1 <= n; });
    for (const bt of selPisos.children) { const si = +bt.dataset.n === n; bt.style.background = si ? '#d4af37' : 'rgba(20,14,8,.85)'; bt.style.color = si ? '#140e08' : '#f5d76e'; }
    if (mover && rt.foco === room.s.id) {
      // La cámara deja su objetivo un poco abajo de la pantalla: se corre para que el piso quede en el centro
      const P_ = room.g.localToWorld(new THREE.Vector3(0, n === 7 ? C.PH * 3 : (n - 1) * C.PH + 1, 0));
      const arriba = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const k = -controls.target.clone().project(camera).y * (camera.top - camera.bottom) / (2 * camera.zoom);
      Object.assign(objetivo, {target: P_.sub(arriba.multiplyScalar(k)), zoom: camera.zoom, activo: true});
    }
  }
  function armarSelector(room) {
    selPisos.innerHTML = '';
    [[7, '🏢 Todo el edificio'], ...EDIFICIO.nombres.slice(0, 6).map((nm, k) => [k + 1, `${k + 1} · ${nm}`]).reverse()].forEach(([n, txt]) => {
      const bt = document.createElement('button'); bt.dataset.n = n; bt.textContent = txt;
      bt.style.cssText = 'all:unset;cursor:pointer;padding:6px 10px;border:1px solid #d4af37;border-radius:8px;text-align:left';
      bt.onclick = e => { e.stopPropagation(); verPiso(room, n); };
      selPisos.appendChild(bt);
    });
    verPiso(room, room.casa.verHasta, false);
  }

  // Brayan vive en el Edificio DURO: va de un lugar a otro (en ascensor si es otro piso); cuando DURO LIVE está en vivo, se va a la arena
  const POSE = {stream: 'compu', show: 'estudio', piscina: 'cama'};
  function rutaBrayan(C, dest) {
    const A_ = C.ascensor, aqui = C.lugares[C.i], pts = [{x: C.x, y: C.y, z: C.z}];
    const en = (p, y) => ({x: p.x, y, z: p.z});
    for (const v of [...aqui.via].reverse()) pts.push(en(v, aqui.y));
    if (dest.y !== aqui.y) pts.push(en(A_.puerta, aqui.y), en(A_.adentro, aqui.y), en(A_.adentro, dest.y), en(A_.puerta, dest.y));
    for (const v of dest.via) pts.push(en(v, dest.y));
    pts.push(en(dest, dest.y + dest.dy));
    return ruta3D(pts);
  }
  function actualizarCasa(room, dt) {
    const C = room.casa, b = C.brayan, t = rt.t;
    const enVivo = datos.salas.some(s => s.streamer?.enVivo);
    C.ultimo -= dt;
    if (C.ultimo <= 0) { dibujarTablero(room, enVivo); C.ultimo = 1; }
    const yMax = (C.verHasta - 1) * C.PH;
    for (const s_ of room.s.suenos || []) { const sp = C.estrellas[s_.id]; if (sp) sp.visible = !!s_.real && Math.floor((sp.position.y + 0.01) / C.PH) * C.PH <= yMax; }
    for (const sp of Object.values(C.estrellas)) sp.scale.setScalar(0.5 + Math.sin(t * 2.5) * 0.06);
    const kHoy = JSON.stringify(room.s.casaApp ?? null);
    if (kHoy !== C.hoyApp.clave) { C.hoyApp.clave = kHoy; C.hoyApp.actualizar(room.s.casaApp); }
    // Selector de pisos: solo cuando se mira el edificio; al salir se vuelve a ver completo
    const mirando = rt.foco === room.s.id;
    if (mirando && selPisos.style.display === 'none') { selPisos.style.display = 'flex'; armarSelector(room); }
    if (!mirando && selPisos.style.display !== 'none') { selPisos.style.display = 'none'; verPiso(room, 7); }
    // La gente del edificio
    for (const fn of C.animados) fn(t);
    for (const w of C.caminantes) {
      const P_ = w.P;
      if (!w.dest) {
        w.timer -= dt; P_.pI.rotation.x = P_.pD.rotation.x = P_.bI.rotation.x = P_.bD.rotation.x = 0;
        if (w.timer <= 0) { let d; do d = pick(w.puntos); while (d === w.ult && w.puntos.length > 1); w.dest = d; }
      } else {
        const dx = w.dest.x - w.x, dz = w.dest.z - w.z, d = Math.hypot(dx, dz);
        if (d < 0.05) { w.ult = w.dest; w.dest = null; w.timer = rand(2, 7); }
        else { const m = Math.min(d, dt * w.vel); w.x += dx / d * m; w.z += dz / d * m; P_.raiz.rotation.y = Math.atan2(dx, dz); const s9 = Math.sin(t * 9 + w.vel * 7); P_.pI.rotation.x = s9 * 0.6; P_.pD.rotation.x = -s9 * 0.6; P_.bI.rotation.x = -s9 * 0.5; P_.bD.rotation.x = s9 * 0.5; }
      }
      P_.raiz.position.set(w.x, 0, w.z);
    }
    let vertical = false;
    if (!enVivo) {
      const aqui = C.lugares[C.i];
      if (C.ruta) {
        const q0 = enRuta(C.ruta, Math.min(1, C.d / C.ruta.largo));
        vertical = Math.abs(q0.dx) + Math.abs(q0.dz) < 1e-3;
        C.d += dt * (vertical ? 3.5 : 1.4);
        if (C.d >= C.ruta.largo) { C.i = C.lugares.indexOf(C.destino); const L_ = C.destino; C.x = L_.x; C.y = L_.y + L_.dy; C.z = L_.z; C.ruta = null; C.destino = null; C.timer = rand(6, 12); }
        else { const q = enRuta(C.ruta, C.d / C.ruta.largo); C.x = q.x; C.y = q.y; C.z = q.z; if (!vertical) C.rot = Math.atan2(q.dx, q.dz); }
      } else {
        C.rot += (Math.atan2(Math.sin(aqui.rot - C.rot), Math.cos(aqui.rot - C.rot))) * Math.min(1, dt * 6);
        C.timer -= dt;
        if (C.timer <= 0) {
          // Pasa más tiempo en su penthouse y en el rooftop
          const opciones = C.lugares.flatMap((l, k) => k === C.i ? [] : l.piso >= 6 ? [l, l] : [l]);
          C.destino = pick(opciones); C.ruta = rutaBrayan(C, C.destino); C.d = 0;
        }
      }
      b.raiz.position.set(C.x, C.y, C.z); b.raiz.rotation.y = C.rot;
      // El ascensor acompaña a Brayan mientras va adentro
      const A_ = C.ascensor;
      if (Math.abs(C.x - A_.adentro.x) < 0.9 && Math.abs(C.z - A_.adentro.z) < 0.9) C.cabina.position.y = C.y;
      // Pose según la actividad
      const act = C.ruta ? (vertical ? 'ascensor' : 'caminando') : POSE[aqui.id] || aqui.id;
      const s9 = Math.sin(t * 9);
      b.pI.rotation.x = b.pD.rotation.x = 0; b.cuerpo.position.y = 0; b.cabeza.rotation.set(0, 0, 0);
      if (act === 'caminando') { b.pI.rotation.x = s9 * 0.6; b.pD.rotation.x = -s9 * 0.6; b.bI.rotation.x = -s9 * 0.5; b.bD.rotation.x = s9 * 0.5; b.cuerpo.position.y = Math.abs(Math.cos(t * 9)) * 0.05; }
      else if (act === 'estudio') { b.bD.rotation.x = -2.5; b.bI.rotation.x = -1.2 + Math.sin(t * 3) * 0.5; b.cabeza.rotation.x = Math.sin(t * 6) * 0.06; b.cuerpo.position.y = Math.abs(Math.sin(t * 4)) * 0.03; }
      else if (act === 'compu') { b.bI.rotation.x = -1.2 + Math.sin(t * 16) * 0.06; b.bD.rotation.x = -1.2 + Math.cos(t * 15) * 0.06; b.cabeza.rotation.x = Math.sin(t * 4) * 0.08; }
      else if (act === 'misiones') { b.bD.rotation.x = -2.0 + Math.sin(t * 1.5) * 0.3; b.bI.rotation.x = -0.2; b.cabeza.rotation.y = Math.sin(t * 0.8) * 0.3; }
      else if (act === 'gym') { const sube = (Math.sin(t * 3) + 1) / 2; b.bI.rotation.x = b.bD.rotation.x = -0.4 - sube * 2.4; }
      else if (act === 'moto') { b.pI.rotation.x = b.pD.rotation.x = -1.2; b.cuerpo.position.y = 0.32; b.bI.rotation.x = b.bD.rotation.x = -1.35; b.cabeza.rotation.y = Math.sin(t * 0.6) * 0.15; }
      else if (act === 'cocina') { b.bI.rotation.x = -1.0 + Math.sin(t * 5) * 0.2; b.bD.rotation.x = -1.0 + Math.cos(t * 5) * 0.2; b.cabeza.rotation.x = 0.2; }
      else if (act === 'sofa' || act === 'piscina' || act === 'cama') { b.pI.rotation.x = b.pD.rotation.x = -Math.PI / 2; b.cuerpo.position.y = -0.05; b.bI.rotation.x = b.bD.rotation.x = -0.3; b.cabeza.rotation.y = Math.sin(t * 0.5) * 0.2; }
      else { b.bI.rotation.x = b.bD.rotation.x = Math.sin(t * 2) * 0.1; }
    }
    b.raiz.visible = !enVivo && C.y <= yMax + 0.6;
    C.cabina.visible = C.cabina.position.y <= yMax + 0.1;
    // Etiqueta: qué está haciendo Brayan y en qué piso
    if (room.etqCasa) {
      const piso = n => EDIFICIO.nombres[n - 1];
      const texto = enVivo ? '<b>🔴 Brayan está en el LIVE</b>' : C.ruta ? `<b>${vertical ? '🛗' : '🚶'} Brayan</b><small>${vertical ? 'en el ascensor' : 'caminando'} · hacia ${piso(C.destino.piso)}</small>`
        : `<b>${C.lugares[C.i].emoji} Brayan</b><small>${C.lugares[C.i].texto} · ${piso(C.lugares[C.i].piso)}</small>`;
      if (room.etqCasa.texto !== texto) { room.etqCasa.texto = texto; room.etqCasa.el.innerHTML = texto; }
      ubicar(room.etqCasa.el, tmpW.set(enVivo ? 0 : C.x, enVivo ? 1.5 : C.y + 2.0, enVivo ? 0 : C.z).add(room.g.position), -4);
      room.etqCasa.el.style.visibility = enVivo || b.raiz.visible ? '' : 'hidden';   // está en un piso que no se ve
    }
  }

  // ---------- Multitudes (comunidades de redes y públicos de playlists) ----------
  // Personas de pie con instancias, para que sean muchas sin costo. Cada una mira a un punto (mira).
  // dormida: los seguidores existen pero no están mirando; se ven apagados, sentados en el piso y cabeceando
  function crearMultitud(g, res, {posiciones, color, mira, puerta, semilla, dormida = false}) {
    const N = posiciones.length;
    const capa_ = (geom, brillo) => {
      const m = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.7, emissive: '#ffffff', emissiveIntensity: brillo}); res.push(m);
      const im = new THREE.InstancedMesh(geom, m, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; g.add(im); return im;
    };
    const piernas = capa_(GEO_M.box, 0), cuerpos = capa_(GEO_M.torso, dormida ? 0 : 0.12), cabezas = capa_(GEO_M.sphere, dormida ? 0 : 0.05), pelos = capa_(GEO_M.hair, 0);
    // Con miles de personas no hay sombras por persona: sería demasiado para la tarjeta de video
    const grande = N > 1500;
    cuerpos.castShadow = !grande;
    const gris = new THREE.Color('#2a3048');
    const apagar = c => dormida ? c.lerp(gris, 0.7).multiplyScalar(0.55) : c;
    const gente = posiciones.map((p, i) => {
      const h = hash(`${semilla}-${i}`);
      // Uno de cada tres lleva la camiseta del color de la sala. Los colores se guardan por persona
      const colores = [i % 3 === 0 ? new THREE.Color(color) : new THREE.Color().setHSL((h % 360) / 360, 0.7, 0.58),
        new THREE.Color(['#8d5a3b', '#6b4128', '#b07a52', '#4a2f1f'][h % 4]), new THREE.Color(['#15110f', '#2b1a10', '#d9b26a', '#0d0d12'][h % 4]),
        new THREE.Color(['#1f2235', '#2b3a55', '#3a2a22'][h % 3])].map(apagar);
      const x = p.x + ((h % 7) - 3) * 0.015, z = p.z + ((h % 5) - 2) * 0.015;
      return {x, z, colores, y: p.y || 0, rot: Math.atan2(mira.x - x, mira.z - z) + ((h % 9) - 4) * 0.04, fase: (h % 100) / 16, esc: 0.82 + (h % 5) * 0.03};
    });
    return {piernas, cuerpos, cabezas, pelos, gente, grande, dormida, ocultos: new Set(), sucio: true, personas: [], iniciada: false, puerta: new THREE.Vector3(puerta.x, 0, puerta.z),
      m4: new THREE.Matrix4(), v: new THREE.Vector3(), sc: new THREE.Vector3(), q: new THREE.Quaternion()};
  }

  // ---------- De TikTok a DURO LIVE ----------
  // Los LIVE de Brayan son de TikTok: cuando está en vivo, la gente sale del parque de TikTok (que queda al lado),
  // sale por su puerta y camina hasta la entrada de la arena. Al irse, vuelve a su lugar en el parque.
  const geoEntrada = room => { const e = room.geo.stream.entrada; return new THREE.Vector3(e.x, 0, e.z); };
  function caminoDesdeTikTok(arena, destino) {
    const tk = rt.rooms.get('tiktok'), M = tk?.red?.multitud;
    if (!M) return null;
    const presentes = M.personas.length;
    let k = -1;
    for (let i = presentes - 1; i >= 0; i--) if (!M.ocultos.has(i)) { k = i; break; }   // los del fondo del parque
    if (k < 0) return null;
    M.ocultos.add(k); M.sucio = true;
    const enArena = (x, z) => arena.g.worldToLocal(tk.g.localToWorld(new THREE.Vector3(x, 0, z)));
    const d = M.gente[k], puerta = tk.geo.fans.puerta, esq = arena.geo.stream.parque?.esquina;
    // Con las salas pegadas: derecho a la puerta compartida y de ahí alrededor de la arena hasta la entrada
    const porPuerta = caminoPuerta(arena);
    const pts = [enArena(d.x, d.z)];
    if (porPuerta) pts.push(...porPuerta);
    else {
      pts.push(enArena(puerta.x, puerta.z - 0.6), enArena(puerta.x, puerta.z + 1.2));
      if (esq) pts.push(new THREE.Vector3(esq.x, 0, esq.z));
    }
    pts.push(destino.clone());
    return {ruta: ruta3D(pts.map(p => ({x: p.x, y: p.y || 0, z: p.z}))), origen: {M, k}};
  }
  function devolverATikTok(p) {
    if (!p.origen) return;
    p.origen.M.ocultos.delete(p.origen.k); p.origen.M.sucio = true;
  }

  // Un tablero dibujado en un canvas que se puede volver a pintar (para lo que cambia con los datos de la app)
  function pizarra(padre, res, w, h, ancho, pos, rotY = 0) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res.push(t);
    const m = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide})); res.push(m.material);
    m.scale.set(ancho, ancho * h / w, 1); m.position.copy(pos); m.rotation.y = rotY; padre.add(m);
    return {pintar(fn) { const x = cv.getContext('2d'); x.clearRect(0, 0, w, h); fn(x, w, h); t.needsUpdate = true; }};
  }
  const MISIONES_APP = {instagram_follow: ['Seguir IG', '#e1306c', 'instagram'], instagram_like: ['Like IG', '#e1306c', 'instagram'],
    facebook_follow: ['Seguir Facebook', '#1877f2', 'facebook'], twitch_follow: ['Seguir Twitch', '#9146ff', 'twitch'],
    gafas_club: ['Gafas Club', '#ffd34d', 'artista'], uraba: ['URABÁ', '#22c55e', 'artista'],
    artista_angelito: ['Misión Ángelito', '#38e8ff', 'playlists'], artista_jlopez: ['Misión JLopez', '#38e8ff', 'playlists']};
  const fondoPizarra = (x, w, h, borde) => { x.fillStyle = 'rgba(10,6,16,.92)'; x.fillRect(0, 0, w, h); x.strokeStyle = borde; x.lineWidth = 6; x.strokeRect(4, 4, w - 8, h - 8); };
  const cortar = (t, n) => { t = String(t ?? ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

  // ---------- Misiones aprobadas: de la taquilla de DURO LIVE a la sala de esa red ----------
  // Sale de la taquilla, baja por la escalera a TikTok, sale por su puerta, cruza el Cerebro y entra a la otra sala.
  rt.caminantes = [];
  function lanzarCaminante(arena, accion) {
    const [, color, destinoId] = MISIONES_APP[accion] || [];
    const tk = rt.rooms.get('tiktok'), dest = rt.rooms.get(destinoId), S = arena.stream;
    if (!tk || !dest || !S?.estructuras || rt.caminantes.length > 12) return;
    const aMundo = (g, x, y, z) => mundo.worldToLocal(g.localToWorld(new THREE.Vector3(x, y, z)));
    const t0 = S.estructuras.taquillaPos, h = arena.geo.L / 2, pts = [aMundo(arena.g, t0.x, 0, t0.z)];
    for (const [x, z] of [[h - 0.5, t0.z], [h - 0.5, h - 0.3], [0.6, h - 0.3]]) pts.push(aMundo(arena.g, x, 0, z));
    const PT = puertaTikTok(arena);
    if (PT) for (const q of [PT.rellano, ...[...PT.tramos[Math.random() < 0.5 ? 0 : 1]].reverse()]) pts.push(aMundo(arena.g, q.x, q.y || 0, q.z));
    const pt = tk.geo.fans?.puerta;
    if (pt) pts.push(aMundo(tk.g, pt.x, 0, pt.z - 0.6), aMundo(tk.g, pt.x, 0, pt.z + 1.2));
    const borde = g => { const d = g.position.clone().setY(0).normalize(); return d.multiplyScalar(HUB_R - 0.6); };
    const salida = borde(tk.g), llegada = borde(dest.g);
    // Rodea el Cerebro por el borde de la plataforma
    const a0 = Math.atan2(salida.z, salida.x); let da = Math.atan2(llegada.z, llegada.x) - a0; da = Math.atan2(Math.sin(da), Math.cos(da));
    const n = Math.max(1, Math.ceil(Math.abs(da) / 0.3));
    for (let k = 0; k <= n; k++) { const a = a0 + da * k / n; pts.push(new THREE.Vector3(Math.cos(a) * (HUB_R - 0.6), 0, Math.sin(a) * (HUB_R - 0.6))); }
    const dir = dest.g.position.clone().setY(0).normalize(), Ld = dest.geo.L || 10;
    pts.push(dest.g.position.clone().setY(0).sub(dir.clone().multiplyScalar(Ld * 0.62)), dest.g.position.clone().setY(0).sub(dir.multiplyScalar(Ld * 0.45)));
    const P = crearPersona({nombre: 'mision-' + accion + rt.t, estado: 'activo'}, {camisa: color});
    // Un globito con el color de la red encima de la cabeza
    const globo = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(1.5), toneMapped: false}));
    globo.scale.setScalar(0.16); globo.position.y = 1.9; P.raiz.add(globo);
    P.raiz.scale.setScalar(0.9); mundo.add(P.raiz);
    const R = ruta3D(pts.map(q => ({x: q.x, y: q.y, z: q.z})));
    rt.caminantes.push({P, R, u: 0, vel: 4 / R.largo, globo});
  }
  function moverCaminantes(dt) {
    rt.caminantes = rt.caminantes.filter(c => {
      c.u += dt * c.vel;
      if (c.u >= 1) { mundo.remove(c.P.raiz); c.globo.material.dispose(); return false; }
      const q = enRuta(c.R, c.u), sw = Math.sin(rt.t * 9) * 0.5;
      c.P.raiz.position.set(q.x, q.y, q.z);
      if (Math.hypot(q.dx, q.dz) > 1e-3) c.P.raiz.rotation.y = Math.atan2(q.dx, q.dz);
      c.P.pI.rotation.x = sw; c.P.pD.rotation.x = -sw; c.P.bI.rotation.x = -sw * 0.8; c.P.bD.rotation.x = sw * 0.8;
      c.globo.position.y = 1.9 + Math.sin(rt.t * 4) * 0.06;
      return true;
    });
  }

  // Camino de varios tramos (con subidas): se recorre con u de 0 a 1
  function ruta3D(puntos) {
    const acum = [0];
    for (let i = 1; i < puntos.length; i++) acum.push(acum[i - 1] + Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y, puntos[i].z - puntos[i - 1].z));
    return {puntos, acum, largo: Math.max(0.5, acum.at(-1))};
  }
  function enRuta(R, u) {
    const d = u * R.largo, P = R.puntos;
    let i = 1;
    while (i < P.length - 1 && R.acum[i] < d) i++;
    const a = P[i - 1], b = P[i], t = Math.min(1, Math.max(0, (d - R.acum[i - 1]) / ((R.acum[i] - R.acum[i - 1]) || 1)));
    return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, dx: b.x - a.x, dz: b.z - a.z};
  }

  // Lleva la multitud a n personas: las nuevas entran caminando por la puerta (y cuentan como entrada
  // a la sala) y las que sobran salen. Quietas se mecen; si la sala está animada, saltan por turnos.
  function moverMultitud(M, n, dt, salaId, animada) {
    const t = rt.t, {m4, v, sc, q} = M;
    if (!M.iniciada) { M.iniciada = true; M.sucio = true; for (let k = 0; k < n; k++) M.personas.push({k, estado: 'quieto', u: 1}); }
    const presentes = M.personas.filter(p => p.estado !== 'saliendo').length;
    // Si cambian muchísimas personas de golpe, se aplican de una (caminar de a una tardaría horas)
    if (Math.abs(n - presentes) > 40) {
      if (n > presentes) { for (let k = presentes; k < n; k++) { const p = {k, estado: 'quieto', u: 1}; M.alEntrar?.(p); M.personas.push(p); } contarEntrada(salaId, n - presentes); }
      else M.personas = M.personas.filter(p => p.k < n || (M.alSalir?.(p), false));
      M.sucio = true;
    }
    M.cPuerta = (M.cPuerta ?? 0) - dt;
    if (M.cPuerta <= 0 && presentes !== n && Math.abs(n - presentes) <= 40) {
      if (presentes < n) { const p = {k: presentes, estado: 'entrando', u: 0}; M.alEntrar?.(p); M.personas.push(p); contarEntrada(salaId); }
      else { const p = [...M.personas].reverse().find(p => p.estado !== 'saliendo'); if (p) { p.estado = 'saliendo'; M.alIrse?.(p); } }
      M.cPuerta = 0.18;
    }
    // Las multitudes grandes no se mecen: solo se redibujan cuando alguien entra o sale
    const moviendo = M.personas.some(p => p.estado !== 'quieto');
    if (M.grande && !moviendo && !M.sucio) return;
    M.sucio = false;
    const quietos = M.grande;
    let j = 0;
    M.personas = M.personas.filter(p => {
      const g_ = M.gente[p.k];
      // Cada persona camina desde la puerta o, si se despertó entre tus seguidores, desde su lugar
      const o = p.desde || M.puerta;
      const largo = p.ruta ? p.ruta.largo : Math.max(0.5, Math.hypot(g_.x - o.x, g_.z - o.z));
      // Los trayectos largos (desde el parque de TikTok) se caminan más rápido: nadie tarda más de ~15 s
      // Al llegar se queda quieto en su lugar, o hace lo que diga alLlegar (por ejemplo, ponerse a jugar en el parque)
      if (p.estado === 'entrando') { p.u += dt * Math.max(1.8, largo / 15) / largo; if (p.u >= 1) { p.u = 1; p.estado = p.alLlegar || 'quieto'; p.alLlegar = null; } }
      else if (p.estado === 'saliendo') { p.u -= dt * Math.max(2.2, largo / 12) / largo; if (p.u <= 0) { M.alSalir?.(p); return false; } }
      // Los que se despertaron y se fueron a mirar no se dibujan en su lugar de dormir
      if (M.ocultos.has(p.k)) return true;
      // Jugando: M.jugar dice dónde está (da vueltas alrededor de una atracción)
      const jg = p.estado === 'jugando' ? M.jugar(p, t) : null;
      const r_ = jg ? null : p.ruta ? enRuta(p.ruta, p.u) : null;
      const x = jg ? jg.x : r_ ? r_.x : o.x + (g_.x - o.x) * p.u, z = jg ? jg.z : r_ ? r_.z : o.z + (g_.z - o.z) * p.u, e = g_.esc, y0 = jg ? jg.y || 0 : r_ ? r_.y : g_.y * p.u;
      p.px = x; p.pz = z;
      const camina = p.estado !== 'quieto';
      const rot = jg ? jg.rot : camina ? (r_ ? Math.atan2(r_.dx, r_.dz) : Math.atan2(g_.x - o.x, g_.z - o.z)) + (p.estado === 'saliendo' ? Math.PI : 0) : g_.rot;
      q.setFromAxisAngle(ARRIBA, rot);
      const y = y0 + (camina ? Math.abs(Math.sin(t * 9 + g_.fase)) * 0.05 : quietos || M.dormida ? 0
        : animada && (p.k % 3 === Math.floor(t * 2.2) % 3) ? Math.abs(Math.sin(t * 6.9 + g_.fase)) * 0.12 : Math.abs(Math.sin(t * 1.4 + g_.fase)) * 0.02);
      if (jg?.sentado) {
        // Montado en la rueda o en un caballito: sentado derecho, con las piernas hacia adelante
        const fx = Math.sin(rot) * 0.1 * e, fz = Math.cos(rot) * 0.1 * e;
        M.piernas.setMatrixAt(j, m4.compose(v.set(x + fx, y0 + 0.07 * e, z + fz), q, sc.set(0.3 * e, 0.14 * e, 0.34 * e)));
        M.cuerpos.setMatrixAt(j, m4.compose(v.set(x, y0 + 0.4 * e, z), q, sc.set(0.85 * e, 0.7 * e, 0.7 * e)));
        M.cabezas.setMatrixAt(j, m4.compose(v.set(x, y0 + 0.8 * e, z), q, sc.setScalar(0.19 * e)));
        M.pelos.setMatrixAt(j, m4.compose(v.set(x, y0 + 0.815 * e, z), q, sc.setScalar(0.2 * e)));
      } else if (M.dormida && !camina) {
        // Sentados en el piso con las piernas recogidas y la cabeza caída hacia adelante
        const fx = Math.sin(rot) * 0.1 * e, fz = Math.cos(rot) * 0.1 * e;
        M.piernas.setMatrixAt(j, m4.compose(v.set(x + fx, y + 0.07 * e, z + fz), q, sc.set(0.3 * e, 0.14 * e, 0.34 * e)));
        M.cuerpos.setMatrixAt(j, m4.compose(v.set(x, y + 0.36 * e, z), q, sc.set(0.85 * e, 0.66 * e, 0.7 * e)));
        M.cabezas.setMatrixAt(j, m4.compose(v.set(x + fx * 1.2, y + 0.66 * e, z + fz * 1.2), q, sc.setScalar(0.19 * e)));
        M.pelos.setMatrixAt(j, m4.compose(v.set(x + fx * 1.1, y + 0.68 * e, z + fz * 1.1), q, sc.setScalar(0.2 * e)));
      } else {
        M.piernas.setMatrixAt(j, m4.compose(v.set(x, y + 0.23 * e, z), q, sc.set(0.26 * e, 0.46 * e, 0.15 * e)));
        M.cuerpos.setMatrixAt(j, m4.compose(v.set(x, y + 0.72 * e, z), q, sc.set(0.85 * e, 0.8 * e, 0.7 * e)));
        M.cabezas.setMatrixAt(j, m4.compose(v.set(x, y + 1.14 * e, z), q, sc.setScalar(0.19 * e)));
        M.pelos.setMatrixAt(j, m4.compose(v.set(x, y + 1.155 * e, z), q, sc.setScalar(0.2 * e)));
      }
      const [cC, cCa, cP, cPi] = g_.colores;
      M.cuerpos.setColorAt(j, p.camiseta || cC); M.cabezas.setColorAt(j, cCa); M.pelos.setColorAt(j, cP); M.piernas.setColorAt(j, cPi);
      j++;
      return true;
    });
    for (const im of [M.piernas, M.cuerpos, M.cabezas, M.pelos]) { im.count = j; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }

  // Logos simples dibujados a mano (no son los archivos oficiales de cada marca)
  function dibujarLogo(x, red, w, h) {
    x.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    if (red === 'youtube') {
      x.fillStyle = '#ff0033'; x.beginPath(); x.roundRect(28, 58, 200, 140, 40); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(108, 92); x.lineTo(108, 164); x.lineTo(168, 128); x.closePath(); x.fill();
    } else if (red === 'tiktok') {
      x.fillStyle = '#0b0b10'; x.beginPath(); x.roundRect(28, 28, 200, 200, 46); x.fill();
      x.font = '700 170px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#25f4ee'; x.fillText('♪', cx - 7, cy - 5);
      x.fillStyle = '#fe2c55'; x.fillText('♪', cx + 7, cy + 5);
      x.fillStyle = '#ffffff'; x.fillText('♪', cx, cy);
    } else if (red === 'instagram') {
      const gr = x.createLinearGradient(30, 226, 226, 30);
      gr.addColorStop(0, '#feda75'); gr.addColorStop(0.35, '#fa7e1e'); gr.addColorStop(0.6, '#d62976'); gr.addColorStop(1, '#4f5bd5');
      x.strokeStyle = gr; x.lineWidth = 20;
      x.beginPath(); x.roundRect(40, 40, 176, 176, 50); x.stroke();
      x.beginPath(); x.arc(cx, cy, 44, 0, Math.PI * 2); x.stroke();
      x.fillStyle = gr; x.beginPath(); x.arc(178, 78, 12, 0, Math.PI * 2); x.fill();
    } else if (red === 'twitch') {
      // Globo de chat morado con dos barras
      x.fillStyle = '#9146ff';
      x.beginPath(); x.moveTo(52, 40); x.lineTo(214, 40); x.lineTo(214, 150); x.lineTo(168, 196); x.lineTo(128, 196); x.lineTo(98, 226); x.lineTo(98, 196); x.lineTo(52, 196); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.fillRect(110, 84, 18, 56); x.fillRect(150, 84, 18, 56);
    } else if (red === 'facebook') {
      x.fillStyle = '#1877f2'; x.beginPath(); x.arc(cx, cy, 100, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.font = '800 170px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('f', cx + 10, cy + 18);
    }
  }

  // Pantalla de la sala de una red: contador de seguidores
  function dibujarRed(room, ocupados) {
    const x = room.cvP.getContext('2d'), w = 512, h = 200, s = room.s, c = s.color;
    const fondo = x.createLinearGradient(0, 0, w, h);
    fondo.addColorStop(0, '#' + tono(c, 0.28).getHexString()); fondo.addColorStop(1, '#07070d');
    x.fillStyle = fondo; x.fillRect(0, 0, w, h);
    x.textBaseline = 'top'; x.textAlign = 'left';
    x.fillStyle = '#fff'; x.font = '800 30px ui-monospace, Menlo, monospace'; x.fillText(s.nombre.toUpperCase(), 22, 16);
    x.fillStyle = c; x.font = '800 70px ui-monospace, Menlo, monospace'; x.fillText(cifra(s.seguidores), 22, 56);
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '22px ui-monospace, Menlo, monospace'; x.fillText(s.unidad || 'seguidores', 24, 132);
    x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '18px ui-monospace, Menlo, monospace';
    if (!publico) x.fillText(`${s.tareas.filter(t => t.estado === 'hecho').length}/${s.tareas.length} tareas · ${ocupados} trabajando`, 24, 166);
    room.tP.needsUpdate = true;
  }

  // ---------- Arena DURO LIVE: escenario central, público en anillos y palco de producción ----------
  function construirSet(g, geo, c, res, Hw, s) {
    const {B, C, radioEscenario: RE, anillos, asientos} = geo.stream, {Z0, X0, L, yPiso} = geo;
    const alto = 0.4;
    // Neones: el color de la sala, cian y morado. Se guardan sus colores base para hacerlos latir.
    const neon = col => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(1.5), toneMapped: false}); m.userData.base = m.color.clone(); res.push(m); return m; };
    const nRosa = neon(c), nCian = neon('#38e8ff'), nMorado = neon('#a855f7');
    const nuevo = geom => { res.push(geom); return geom; };

    // --- Paredes: tiras de neón a tres alturas, paneles acústicos y ON AIR ---
    for (const [y, m] of [[0.08, nRosa], [Hw * 0.5, nCian], [Hw - 0.12, nMorado]]) {
      g.add(caja(L, 0.05, 0.04, m, 0, y, Z0 + 0.02, false));
      g.add(caja(0.04, 0.05, L, m, X0 + 0.02, y, 0, false));
    }
    const libre = L - 2 * B;
    for (let fy = 0; fy < 3; fy++) for (let fz = 0; fz < Math.floor((libre - 2) / 0.5); fz++) {
      g.add(caja(0.07, 0.44, 0.44, mat((fy + fz) % 2 ? '#1b1129' : '#251838', {roughness: 0.95}), X0 + 0.04, 3.6 + fy * 0.5, Z0 + B + 1.4 + fz * 0.5, false));
    }
    const cvOA = document.createElement('canvas'); cvOA.width = 256; cvOA.height = 96;
    const xo = cvOA.getContext('2d');
    xo.fillStyle = '#1a0507'; xo.fillRect(0, 0, 256, 96);
    xo.strokeStyle = '#ff3b3b'; xo.lineWidth = 6; xo.strokeRect(5, 5, 246, 86);
    xo.fillStyle = '#ff3b3b'; xo.font = '800 48px ui-monospace, Menlo, monospace'; xo.textAlign = 'center'; xo.textBaseline = 'middle';
    xo.fillText('ON AIR', 128, 50);
    const tOA = new THREE.CanvasTexture(cvOA); tOA.colorSpace = THREE.SRGBColorSpace; res.push(tOA);
    const onAir = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tOA, toneMapped: false, color: '#3a2a2a'})); res.push(onAir.material);
    onAir.scale.set(1.6, 0.6, 1); onAir.rotation.y = Math.PI / 2; onAir.position.set(X0 + 0.05, 2.8, Z0 + B + libre / 2); g.add(onAir);

    // --- Oficina del equipo (palco): solo si el equipo no está en la súper oficina ---
    if (!s.oficina) {
    // --- Oficina del equipo (palco): esquina de adelante a la izquierda, con vidrio polarizado hacia el escenario ---
    const PZ = geo.stream.PZ;
    g.add(caja(B, 0.3, B, mat('#0b1020', {roughness: 0.35, metalness: 0.4}), X0 + B / 2, yPiso - 0.15, PZ + B / 2));
    // Si el palco va elevado (con gradas), columnas y borde de neón por debajo; si no, queda en el piso de la sala
    if (yPiso > 1) {
      for (const [x, z, w, d] of [[X0 + B, PZ + B / 2, 0.06, B], [X0 + B / 2, PZ, B, 0.06]]) g.add(caja(w, 0.05, d, nRosa, x, yPiso - 0.32, z, false));
      for (const [x, z] of [[X0 + B - 0.12, PZ + 0.12], [X0 + B - 0.12, PZ + B - 0.12], [X0 + 0.12, PZ + 0.12]]) {
        g.add(caja(0.22, yPiso - 0.3, 0.22, mat('#2a2d3c', {metalness: 0.7}), x, (yPiso - 0.3) / 2, z));
      }
    }
    const vidrio = new THREE.MeshStandardMaterial({color: '#0a1830', transparent: true, opacity: 0.4, metalness: 0.9, roughness: 0.08, depthWrite: false}); res.push(vidrio);
    const hv = 2.4;
    g.add(caja(0.06, hv, B, vidrio, X0 + B, yPiso + hv / 2, PZ + B / 2, false));
    g.add(caja(B, hv, 0.06, vidrio, X0 + B / 2, yPiso + hv / 2, PZ, false));
    for (const y of [yPiso + 0.03, yPiso + hv]) {
      g.add(caja(0.08, 0.05, B + 0.08, nCian, X0 + B, y, PZ + B / 2, false));
      g.add(caja(B + 0.08, 0.05, 0.08, nCian, X0 + B / 2, y, PZ, false));
    }
    g.add(caja(0.08, hv, 0.08, nCian, X0 + B, yPiso + hv / 2, PZ, false));
    const cvPr = document.createElement('canvas'); cvPr.width = 512; cvPr.height = 96;
    const xp = cvPr.getContext('2d'); xp.fillStyle = '#ff6f9a'; xp.font = '800 56px ui-monospace, Menlo, monospace'; xp.textAlign = 'center'; xp.textBaseline = 'middle';
    xp.fillText('EQUIPO DURO LIVE', 256, 50);
    const tPr = new THREE.CanvasTexture(cvPr); tPr.colorSpace = THREE.SRGBColorSpace; res.push(tPr);
    const letrero = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tPr, transparent: true, toneMapped: false})); res.push(letrero.material);
    letrero.scale.set(2.6, 0.5, 1); letrero.rotation.y = Math.PI / 4; letrero.position.set(X0 + B - 0.8, yPiso + hv + 0.4, PZ + 0.8); g.add(letrero);
    g.add(cilindro(0.18, 0.3, mat('#c9743e'), X0 + B - 0.35, yPiso + 0.15, PZ + 0.35));
    const hoja = new THREE.Mesh(GEO.leaf, mat('#3fbf6a', {flatShading: true})); hoja.scale.setScalar(0.3); hoja.position.set(X0 + B - 0.35, yPiso + 0.55, PZ + 0.35); g.add(hoja);

    }

    // --- Escenario circular con anillos de neón ---
    const esc = cilindro(RE, alto, mat('#0d0912', {roughness: 0.22, metalness: 0.55}), C.x, alto / 2, C.z); esc.receiveShadow = true; g.add(esc);
    for (const [r, m, tubo] of [[RE, nCian, 0.04], [RE * 0.66, nRosa, 0.025], [RE * 0.35, nMorado, 0.02]]) {
      const a = new THREE.Mesh(nuevo(new THREE.TorusGeometry(r, tubo, 8, 96)), m); a.rotation.x = Math.PI / 2; a.position.set(C.x, alto + 0.005, C.z); g.add(a);
    }

    // Todo lo del streamer va en un grupo girado hacia la cámara (+x, +z)
    const set = new THREE.Group(); set.position.set(C.x, alto, C.z); set.rotation.y = Math.PI / 4; g.add(set);
    set.add(caja(1.9, 0.07, 0.72, mat('#101018', {roughness: 0.35, metalness: 0.4}), 0, 0.75, 0.35));
    set.add(caja(1.86, 0.03, 0.04, nRosa, 0, 0.72, 0.72, false));
    for (const dx of [-0.85, 0.85]) set.add(caja(0.06, 0.72, 0.6, mat('#101018'), dx, 0.36, 0.35));
    const pads = [];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      const m = new THREE.MeshBasicMaterial({color: '#1b1a2a', toneMapped: false}); res.push(m);
      const p = caja(0.075, 0.025, 0.075, m, 0.32 + k * 0.09, 0.8, 0.22 + r * 0.09, false);
      set.add(p); pads.push(p);
    }
    set.add(caja(0.42, 0.03, 0.42, mat('#0b0b12'), 0.455, 0.785, 0.355, false));
    set.add(caja(0.5, 0.05, 0.3, mat('#14141c', {metalness: 0.5}), -0.45, 0.8, 0.32, false));
    for (let k = 0; k < 5; k++) set.add(cilindro(0.025, 0.04, nCian, -0.65 + k * 0.1, 0.84, 0.28));
    for (const dx of [-0.72, 0.72]) {
      const mon = new THREE.Group(); mon.position.set(dx, 1.08, 0.3); mon.rotation.y = Math.PI + (dx < 0 ? -0.5 : 0.5);
      mon.add(caja(0.62, 0.38, 0.04, mat('#1d2030'), 0, 0, 0));
      const s = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({color: tono(c, 1.1), toneMapped: false})); s.scale.set(0.56, 0.32, 1); s.position.z = 0.025; mon.add(s);
      set.add(mon);
    }
    const brayan = crearPersona({nombre: 'Brayan Trampa', estado: 'activo'}, {camisa: '#ff5a00', pantalon: '#141414', pelo: '#0d0d12', piel: '#8d5a3b', gafas: true, audifonos: true});
    brayan.raiz.position.set(0, 0, -0.27);
    brayan.pI.rotation.x = brayan.pD.rotation.x = -Math.PI / 2; brayan.cuerpo.position.y = 0.04;
    set.add(brayan.raiz);
    const silla = new THREE.Group(); silla.position.set(0, 0, -0.35);
    silla.add(caja(0.56, 0.1, 0.52, mat('#1a1a22'), 0, 0.47, 0));
    silla.add(caja(0.58, 0.9, 0.09, mat('#1a1a22'), 0, 0.98, -0.27));
    silla.add(caja(0.2, 0.7, 0.095, mat(c), 0, 1.0, -0.27, false));
    silla.add(cilindro(0.04, 0.42, mat('#111'), 0, 0.23, 0));
    set.add(silla);
    set.add(cilindro(0.015, 0.5, mat('#222'), 0.35, 1.0, 0.45));
    const brazoMic = caja(0.03, 0.03, 0.55, mat('#222'), 0.25, 1.25, 0.2); brazoMic.rotation.y = 0.35; set.add(brazoMic);
    const mic = new THREE.Mesh(GEO.torso, mat('#2b2b33', {metalness: 0.6, roughness: 0.3})); mic.scale.setScalar(0.28); mic.rotation.x = 1.2; mic.position.set(0.13, 1.28, -0.05); set.add(mic);
    const ring = new THREE.Group(); ring.position.set(-0.95, 0, 1.05); set.add(ring);
    ring.add(cilindro(0.02, 1.5, mat('#222'), 0, 0.75, 0));
    const aro = new THREE.Mesh(nuevo(new THREE.TorusGeometry(0.32, 0.045, 10, 40)), new THREE.MeshBasicMaterial({color: '#fff6e8', toneMapped: false}));
    aro.position.y = 1.55; aro.rotation.y = 0.75; ring.add(aro);
    const luzRing = new THREE.PointLight('#fff1dc', 0, 3.2, 1.5); luzRing.position.set(-0.5, 1.5, 0.6); set.add(luzRing);
    const cam = new THREE.Group(); cam.position.set(0.15, 0, 1.3); set.add(cam);
    for (const a of [0, 2.1, 4.2]) { const pata = caja(0.025, 1.15, 0.025, mat('#222'), Math.sin(a) * 0.18, 0.55, Math.cos(a) * 0.18); pata.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); cam.add(pata); }
    cam.add(caja(0.32, 0.22, 0.42, mat('#15151c', {metalness: 0.5, roughness: 0.3}), 0, 1.2, 0));
    const lente = cilindro(0.08, 0.16, mat('#0b0b0f'), 0, 1.2, -0.27); lente.rotation.x = Math.PI / 2; cam.add(lente);
    const tally = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({color: '#330a0a', toneMapped: false})); tally.scale.setScalar(0.04); tally.position.set(0.1, 1.34, -0.1); cam.add(tally);
    const woofers = [];
    for (const sx of [-1.55, 1.55]) {
      set.add(caja(0.55, 0.9, 0.45, mat('#121218', {roughness: 0.4}), sx, 0.45, -0.55));
      const w = cilindro(0.19, 0.05, mat('#2a2a35', {metalness: 0.4}), sx, 0.36, -0.31); w.rotation.x = Math.PI / 2; set.add(w);
      const tw = cilindro(0.07, 0.04, nRosa, sx, 0.72, -0.31); tw.rotation.x = Math.PI / 2; set.add(tw);
      woofers.push(w);
    }
    // Brayan IA: holograma de pie a su lado
    const proyector = cilindro(0.38, 0.05, new THREE.MeshBasicMaterial({color: '#39d0ff', transparent: true, opacity: 0.6, toneMapped: false}), 1.05, 0.03, 0.75);
    res.push(proyector.material); set.add(proyector);
    const matHolo = new THREE.MeshBasicMaterial({color: '#4fd8ff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false}); res.push(matHolo);
    const clon = crearPersona({nombre: 'Brayan IA', estado: 'activo'}, {gafas: true, audifonos: true, material: matHolo});
    clon.raiz.position.set(1.05, 0, 0.75); clon.raiz.rotation.y = -0.3; set.add(clon.raiz);
    const haz = new THREE.Mesh(nuevo(new THREE.CylinderGeometry(0.38, 0.38, 1.8, 24, 1, true)), new THREE.MeshBasicMaterial({color: '#39d0ff', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    res.push(haz.material); haz.position.set(1.05, 0.9, 0.75); set.add(haz);

    // --- Pantalla colgante de 4 caras, truss circular y reflectores ---
    const {yJ, yT, anchoJ} = geo.stream, altoJ = anchoJ * 400 / 1024;
    g.add(caja(anchoJ + 0.1, altoJ + 0.1, anchoJ + 0.1, mat('#0b0b12', {metalness: 0.6}), C.x, yJ, C.z, false));
    for (let k = 0; k < 4; k++) {
      const cara = new THREE.Mesh(GEO.plane, null); cara.userData.cara = true;
      const a = k * Math.PI / 2;
      cara.scale.set(anchoJ, altoJ, 1); cara.rotation.y = a;
      cara.position.set(C.x + Math.sin(a) * (anchoJ / 2 + 0.06), yJ, C.z + Math.cos(a) * (anchoJ / 2 + 0.06));
      g.add(cara);
    }
    const aroJ = new THREE.Mesh(nuevo(new THREE.TorusGeometry(anchoJ * 0.78, 0.03, 6, 64)), nMorado); aroJ.rotation.x = Math.PI / 2; aroJ.position.set(C.x, yJ - altoJ / 2 - 0.08, C.z); g.add(aroJ);
    const truss = new THREE.Mesh(nuevo(new THREE.TorusGeometry(RE + 0.7, 0.07, 8, 96)), mat('#8a8f9e', {metalness: 0.8, roughness: 0.3}));
    truss.rotation.x = Math.PI / 2; truss.position.set(C.x, yT, C.z); g.add(truss);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; g.add(caja(0.02, yT - yJ - altoJ / 2, 0.02, mat('#333'), C.x + Math.sin(a) * anchoJ * 0.47, (yT + yJ + altoJ / 2) / 2, C.z + Math.cos(a) * anchoJ * 0.47, false)); }
    const conos = [];
    const geoCono = nuevo(new THREE.ConeGeometry(0.75 * geo.stream.k, yT - 0.2, 28, 1, true)); geoCono.translate(0, -(yT - 0.2) / 2, 0);
    ['#38e8ff', c, '#a855f7', '#ffc21a', '#38e8ff', c].forEach((col, i) => {
      const a = i * Math.PI / 3;
      const base = new THREE.Vector3(C.x + Math.sin(a) * (RE + 0.7), yT - 0.15, C.z + Math.cos(a) * (RE + 0.7));
      g.add(caja(0.24, 0.2, 0.24, mat('#15151c', {metalness: 0.6}), base.x, base.y, base.z, false));
      const m = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}); res.push(m);
      const cono = new THREE.Mesh(geoCono, m); cono.position.copy(base); g.add(cono);
      conos.push({cono, base, fase: i * 1.3});
    });
    const geoOnda = nuevo(new THREE.RingGeometry(0.97, 1, 128));
    const ondas = Array.from({length: 5}, () => {
      const m = new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(1.6), transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide}); res.push(m);
      const o = new THREE.Mesh(geoOnda, m); o.rotation.x = -Math.PI / 2; o.position.set(C.x, 0.03, C.z); g.add(o);
      return {o, t: 1, r0: RE + 0.1};
    });

    // --- Graderío: anillos escalonados con el pasillo de entrada al frente ---
    const {frente, entrada, orden: ordenLlenado} = geo.stream;
    const mGrada = mat('#2a1426', {roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide});
    anillos.forEach((a, f) => {
      const h = 0.22 + f * 0.2, rin = a.r - 0.4, rout = a.r + 0.4;
      const hueco = geo.stream.pasillo / (2 * rin);          // mismo ancho de pasillo en todo el escalón
      const desde = frente + hueco, arco = 2 * Math.PI - 2 * hueco;
      // RingGeometry acostada: ángulo θ = -φ · CylinderGeometry: θ = π/2 - φ
      const tapa = new THREE.Mesh(nuevo(new THREE.RingGeometry(rin, rout, 128, 1, -(desde + arco), arco)), mGrada);
      tapa.rotation.x = -Math.PI / 2; tapa.position.set(C.x, h, C.z); tapa.receiveShadow = true; g.add(tapa);
      for (const r of [rin, rout]) { const pared = new THREE.Mesh(nuevo(new THREE.CylinderGeometry(r, r, h, 128, 1, true, Math.PI / 2 - (desde + arco), arco)), mGrada); pared.position.set(C.x, h / 2, C.z); g.add(pared); }
      const borde = new THREE.Mesh(nuevo(new THREE.RingGeometry(rin, rin + 0.04, 128, 1, -(desde + arco), arco)), f % 2 ? nMorado : nCian);
      borde.rotation.x = -Math.PI / 2; borde.position.set(C.x, h + 0.004, C.z); g.add(borde);
    });
    // Pasillo iluminado desde la puerta hasta el escenario
    const largoPasillo = Math.hypot(entrada.x - C.x, entrada.z - C.z) - RE;
    const pas = new THREE.Group(); pas.position.set(C.x, 0, C.z); pas.rotation.y = Math.PI / 2 - frente; g.add(pas);
    pas.add(caja(geo.stream.pasillo - 0.1, 0.02, largoPasillo, mat('#1a1228', {roughness: 0.3, metalness: 0.5}), 0, 0.012, RE + largoPasillo / 2, false));
    for (const sx of [-1, 1]) pas.add(caja(0.04, 0.03, largoPasillo, nRosa, sx * (geo.stream.pasillo / 2 - 0.05), 0.03, RE + largoPasillo / 2, false));
    // Puerta de entrada: arco de neón con letrero
    const puerta = new THREE.Group(); puerta.position.set(entrada.x, 0, entrada.z); puerta.rotation.y = Math.PI / 2 - frente; g.add(puerta);
    const ancho = geo.stream.pasillo + 0.5;
    for (const sx of [-1, 1]) puerta.add(caja(0.14, 2.4, 0.14, nCian, sx * ancho / 2, 1.2, 0, false));
    puerta.add(caja(ancho + 0.14, 0.14, 0.14, nCian, 0, 2.4, 0, false));
    const cvEnt = document.createElement('canvas'); cvEnt.width = 512; cvEnt.height = 96;
    const xe = cvEnt.getContext('2d'); xe.fillStyle = '#ffffff'; xe.font = '800 60px ui-monospace, Menlo, monospace'; xe.textAlign = 'center'; xe.textBaseline = 'middle';
    xe.fillText('ENTRADA', 256, 52);
    const tEnt = new THREE.CanvasTexture(cvEnt); tEnt.colorSpace = THREE.SRGBColorSpace; res.push(tEnt);
    const letEnt = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tEnt, transparent: true, toneMapped: false, side: THREE.DoubleSide})); res.push(letEnt.material);
    letEnt.scale.set(ancho, ancho * 96 / 512, 1); letEnt.position.set(0, 2.72, 0); puerta.add(letEnt);

    // --- Público (instancias): cada persona entra por la puerta, sube por el pasillo y camina hasta su silla ---
    const N = asientos.length;
    // Cojines blancos: cada lado se pinta con su color (rosado: seguidores · azul grisáceo: los que no te siguen)
    const mCojin = mat('#ffffff', {roughness: 0.9});
    const cojines = new THREE.InstancedMesh(GEO.box, mCojin, N);
    const blanco = (brillo = 0) => { const m = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.7, emissive: '#ffffff', emissiveIntensity: brillo}); res.push(m); return m; };
    const piernas = new THREE.InstancedMesh(GEO.box, blanco(), N);
    const cuerpos = new THREE.InstancedMesh(GEO.torso, blanco(0.12), N);
    const cabezas = new THREE.InstancedMesh(GEO.sphere, blanco(0.05), N);
    const pelos = new THREE.InstancedMesh(GEO.hair, blanco(), N);
    const matCel = new THREE.MeshBasicMaterial({color: '#dff3ff', toneMapped: false}); res.push(matCel);
    const celulares = new THREE.InstancedMesh(GEO.plane, matCel, N);
    cuerpos.castShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const lugares = asientos.map((a, i) => {
      const hacia = Math.atan2(C.x - a.x, C.z - a.z), base = 0.22 + a.fila * 0.2, h = hash(`p${i}`);
      q.setFromAxisAngle(ARRIBA, hacia);
      cojines.setMatrixAt(i, m4.compose(v.set(a.x, base + 0.025, a.z), q, sc.set(0.38, 0.05, 0.34)));
      // Camino desde la puerta: subir por el pasillo hasta su anillo y caminar por el escalón hasta la silla
      const pts = [new THREE.Vector3(entrada.x, 0, entrada.z)];
      const pie = new THREE.Vector3(C.x + Math.cos(frente) * a.r, base, C.z + Math.sin(frente) * a.r);
      pts.push(new THREE.Vector3(C.x + Math.cos(frente) * (anillos.at(-1).r + 0.6), 0, C.z + Math.sin(frente) * (anillos.at(-1).r + 0.6)), pie);
      let dphi = a.phi - frente; dphi = Math.atan2(Math.sin(dphi), Math.cos(dphi));
      const pasos = Math.max(1, Math.ceil(Math.abs(dphi) / 0.25));
      for (let k = 1; k <= pasos; k++) { const ph = frente + dphi * k / pasos; pts.push(new THREE.Vector3(C.x + Math.cos(ph) * a.r, base, C.z + Math.sin(ph) * a.r)); }
      const largos = [0]; for (let k = 1; k < pts.length; k++) largos.push(largos[k - 1] + pts[k].distanceTo(pts[k - 1]));
      return {x: a.x, z: a.z, base, hacia, q: q.clone(), pts, largos, fase: (h % 100) / 16,
        cuerpo: new THREE.Color().setHSL((h % 360) / 360, 0.75, 0.58),
        // Camiseta según quién es: seguidores en rosados DURO, los que no te siguen en blancos y grises
        cuerpoSeg: new THREE.Color().setHSL(0.93 + (h % 9) / 100, 0.85, 0.52 + (h % 7) / 50), cuerpoNo: new THREE.Color().setHSL(0.6, 0.1, 0.62 + (h % 8) / 30), piel: new THREE.Color(['#8d5a3b', '#6b4128', '#b07a52', '#4a2f1f'][h % 4]),
        pelo: new THREE.Color(['#15110f', '#2b1a10', '#d9b26a'][h % 3]), pantalon: new THREE.Color(['#1f2235', '#2b3a55', '#3a2a22'][h % 3])};
    });
    for (const im of [cojines, piernas, cuerpos, cabezas, pelos, celulares]) { im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(im); }
    // La gente camina lejos de sus sillas (desde TikTok, por la escalera): que nunca se oculte por estar fuera de cuadro
    for (const im of [piernas, cuerpos, cabezas, pelos, celulares]) im.frustumCulled = false;
    const colLado = [new THREE.Color(c).multiplyScalar(0.75), new THREE.Color('#4f5d7c')];
    for (let i = 0; i < N; i++) cojines.setColorAt(i, colLado[asientos[i].lado]);
    // Colores iniciales (se reescriben por persona al dibujar)
    for (let i = 0; i < N; i++) { cuerpos.setColorAt(i, lugares[i].cuerpo); cabezas.setColorAt(i, lugares[i].piel); pelos.setColorAt(i, lugares[i].pelo); piernas.setColorAt(i, lugares[i].pantalon); }
    piernas.count = cuerpos.count = cabezas.count = pelos.count = celulares.count = 0;

    const sprite = (txt, color) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const x = cv.getContext('2d'); x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (color) x.fillStyle = color; x.fillText(txt, 64, 70);
      const t = new THREE.CanvasTexture(cv); res.push(t);
      const m = new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false}); res.push(m);
      return m;
    };
    const matCorazon = sprite('❤', '#ff3d6e'), matGafas = sprite('😎');

    const estadio = construirEstadio(g, geo, s, res, {nRosa, nCian, nMorado, mGrada});
    // Destellos dorados: cuando alguien nuevo te empieza a seguir y salta al lado de los seguidores
    const geoDest = nuevo(new THREE.SphereGeometry(1, 16, 12));
    const destellos = Array.from({length: 6}, () => {
      const m = new THREE.MeshBasicMaterial({color: '#ffd76a', transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false}); res.push(m);
      const o = new THREE.Mesh(geoDest, m); o.visible = false; g.add(o);
      return {o, t: 1};
    });

    set.updateMatrix();
    const enSala = p => p.applyMatrix4(set.matrix);
    const rMax = anillos.at(-1).r;
    return {brayan, clon, matHolo, proyector, haz, aro, luzRing, tally, matCorazon, matGafas, particulas: [], corazones: 0, regalos: 0, flash: 0,
      aforo: geo.stream.aforo, conectados: 0, objetivo: 0, cAforo: 0, g, centro: new THREE.Vector3(C.x, 0, C.z),
      inst: {piernas, cuerpos, cabezas, pelos, celulares}, lugares, ordenLlenado, personas: [], ocupadas: new Set(), entradas: 0,
      m4, v, sc, q2: new THREE.Quaternion(),
      neones: [nRosa, nCian, nMorado], pads, woofers, conos, ondas, onAir, beat: -1, objetivoLuz: new THREE.Vector3(C.x, alto, C.z),
      marcas: {brayan: enSala(new THREE.Vector3(0, 1.4, -0.27)), etqBrayan: enSala(new THREE.Vector3(-0.2, 2.15, -0.27)),
        clon: enSala(new THREE.Vector3(1.05, 2.25, 0.75)),
        zonaSeg: new THREE.Vector3(C.x + Math.cos(geo.stream.frente + Math.PI / 2) * rMax * 0.75, 2.4, C.z + Math.sin(geo.stream.frente + Math.PI / 2) * rMax * 0.75),
        zonaNo: new THREE.Vector3(C.x + Math.cos(geo.stream.frente - Math.PI / 2) * rMax * 0.75, 2.4, C.z + Math.sin(geo.stream.frente - Math.PI / 2) * rMax * 0.75),
        zonaFila: new THREE.Vector3(geo.stream.entrada.x, 2.2, geo.stream.entrada.z), publico: new THREE.Vector3(C.x, alto + 1.2, C.z)},
      mirar: new THREE.Vector3(C.x, 1, C.z), gradas: estadio.M, gradasN: geo.stream.gradas.posiciones.length, leds: estadio.leds, parqueAnim: estadio.parqueAnim, juegosLive: estadio.juegosLive,
      portales: estadio.portales, paso: estadio.paso, fila: estadio.fila, boveda: estadio.boveda, estructuras: estadio.estructuras, destellos,
      // Del portal a la entrada de la arena (los nuevos entran por el cian; los que se van, salen por el morado)
      rutaNuevos: () => rutaPortal(geo, 'nuevos'), rutaSalida: () => rutaPortal(geo, 'salida'),
      // Lado de cada silla (0: seguidores · 1: nuevos) y orden de llenado de cada lado
      ordenLado: [0, 1].map(l => ordenLlenado.filter(i => geo.stream.asientos[i].lado === l)),
      mezcla: {seg: 0, nue: 0, paso: 0, conv: null}, convVistos: null, convSim: 0, cConv: 20};
  }

  // Lo que hace del set un estadio: gradas con los espectadores del último LIVE (1 a 1),
  // la sala de máquinas (el código de DURO LIVE) y la bóveda (la fuente #1 de ingresos)
  function construirEstadio(g, geo, s, res, {nRosa, nCian, nMorado, mGrada}) {
    const {C, frente, gradas: G, maquinas: SM, boveda: BV} = geo.stream, {X0, Z0, L} = geo;
    const nuevo = geom => { res.push(geom); return geom; };
    const lienzo = (w, h, dibujar) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      dibujar(cv.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res.push(t);
      const m = new THREE.MeshBasicMaterial({map: t, toneMapped: false}); res.push(m);
      return m;
    };
    // Arco sin el pasillo de entrada a un radio dado
    const arcoEn = r => { const hueco = G.pasillo / (2 * r); return {desde: frente + hueco, arco: 2 * Math.PI - 2 * hueco}; };

    // --- Gradas: un escalón por fila, con el pasillo de entrada abierto al frente ---
    G.filas.forEach((f, i) => {
      const rin = f.r - 0.26, rout = f.r + 0.26, h = f.y, {desde, arco} = arcoEn(rin);
      const tapa = new THREE.Mesh(nuevo(new THREE.RingGeometry(rin, rout, 160, 1, -(desde + arco), arco)), mGrada);
      tapa.rotation.x = -Math.PI / 2; tapa.position.set(C.x, h, C.z); tapa.receiveShadow = true; g.add(tapa);
      const contra = new THREE.Mesh(nuevo(new THREE.CylinderGeometry(rin, rin, h, 160, 1, true, Math.PI / 2 - (desde + arco), arco)), mGrada);
      contra.position.set(C.x, h / 2, C.z); g.add(contra);
      // Cada cinco filas, una línea de neón (como en un estadio de verdad)
      if (i % 5 === 0) {
        const b = new THREE.Mesh(nuevo(new THREE.RingGeometry(rin, rin + 0.04, 160, 1, -(desde + arco), arco)), i % 10 ? nMorado : nCian);
        b.rotation.x = -Math.PI / 2; b.position.set(C.x, h + 0.004, C.z); g.add(b);
      }
    });
    if (G.filas.length) {
      // Muro de atrás de la última fila, con la tira de la marca
      const f = G.filas.at(-1), r = f.r + 0.26, {desde, arco} = arcoEn(r), alto = f.y + 0.9;
      const muro = new THREE.Mesh(nuevo(new THREE.CylinderGeometry(r, r, alto, 160, 1, true, Math.PI / 2 - (desde + arco), arco)), mGrada);
      muro.position.set(C.x, alto / 2, C.z); g.add(muro);
      const tira = new THREE.Mesh(nuevo(new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.06, 160, 1, true, Math.PI / 2 - (desde + arco), arco)), nRosa);
      tira.position.set(C.x, alto, C.z); g.add(tira);
    }
    // Sillas de las gradas: tantas como espectadores tuvo tu último LIVE (la meta a llenar)
    if (G.posiciones.length) {
      const sillas = new THREE.InstancedMesh(GEO_M.box, mat('#' + new THREE.Color(s.color).multiplyScalar(0.45).getHexString(), {roughness: 0.8}), G.posiciones.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(0.34, 0.06, 0.3);
      G.posiciones.forEach((p, i) => { q.setFromAxisAngle(ARRIBA, Math.atan2(C.x - p.x, C.z - p.z)); sillas.setMatrixAt(i, m4.compose(v.set(p.x, p.y + 0.03, p.z), q, sc)); });
      g.add(sillas);
    }
    // Las gradas empiezan vacías: solo se llenan con la gente conectada en vivo que no cabe en la pista
    const M = G.posiciones.length ? crearMultitud(g, res, {posiciones: G.posiciones, color: s.color, mira: C, puerta: geo.stream.entrada, semilla: `${s.id}-gradas`}) : null;

    // --- Sala de máquinas: 1 rack = 2.500 líneas de código o 5 tablas ---
    const leds = [];
    // Se arman a la medida del palco (5,6) y se agrandan hasta su esquina
    const B0 = 5.6, e = SM.B / B0;
    if (s.codigo) {
      const codigo = s.codigo || [];
      const racks = codigo.flatMap(b => Array.from({length: Math.max(1, b.racks || 1)}, () => b));
      const base = new THREE.Group(); base.position.set(SM.x, 0, SM.z); base.scale.setScalar(e); g.add(base);
      base.add(caja(B0, 0.12, B0, mat('#0a0d18', {roughness: 0.3, metalness: 0.6}), 0, 0.06, 0));
      for (const [x, z, w, d] of [[B0 / 2, 0, 0.05, B0], [0, -B0 / 2, B0, 0.05]]) base.add(caja(w, 0.04, d, nCian, x, 0.13, z, false));
      const porFila = 7, mRack = mat('#11131c', {roughness: 0.35, metalness: 0.7});
      const frentes = new Map();
      racks.forEach((b, i) => {
        const fila = Math.floor(i / porFila), col = i % porFila;
        const x = -B0 / 2 + 0.75 + col * 0.66, z = -B0 / 2 + 0.9 + fila * 1.55;
        base.add(caja(0.58, 1.9, 0.8, mRack, x, 0.12 + 0.95, z));
        // Frente con luces del color de su bloque (un material por bloque, para hacerlas titilar)
        if (!frentes.has(b)) {
          const m = lienzo(64, 192, (x_, w, h) => {
            x_.fillStyle = '#05060a'; x_.fillRect(0, 0, w, h);
            for (let r = 0; r < 14; r++) {
              x_.fillStyle = '#1a1d28'; x_.fillRect(6, 8 + r * 13, w - 12, 9);
              for (let k = 0; k < 4; k++) { x_.fillStyle = (r + k) % 3 ? b.color : '#ffffff'; x_.fillRect(10 + k * 7, 11 + r * 13, 4, 3); }
            }
          });
          m.userData.base = m.color.clone(); frentes.set(b, m); leds.push({m, fase: leds.length * 1.7, vel: 3 + leds.length});
        }
        const f = new THREE.Mesh(GEO.plane, frentes.get(b)); f.scale.set(0.5, 1.75, 1); f.position.set(x, 0.12 + 0.95, z + 0.41); base.add(f);
        base.add(caja(0.58, 0.04, 0.04, nMorado, x, 2.1, z + 0.4, false));
      });
      // Tablero en la pared: qué es cada bloque
      const altoT = (0.62 + codigo.length * 0.36) * e;
      const tablero = new THREE.Mesh(GEO.plane, lienzo(1024, Math.round(1024 * altoT / (SM.B - 0.4)), (x, w, h) => {
        x.fillStyle = '#070a14'; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#38e8ff'; x.lineWidth = 6; x.strokeRect(4, 4, w - 8, h - 8);
        x.fillStyle = '#38e8ff'; x.font = '800 52px ui-monospace, Menlo, monospace'; x.fillText('SALA DE MÁQUINAS', 36, 70);
        const fila = (h - 110) / Math.max(1, codigo.length);
        codigo.forEach((b, i) => {
          const y = 110 + i * fila + fila * 0.62;
          x.fillStyle = b.color; x.fillRect(36, y - 26, 26, 26);
          x.fillStyle = '#ffffff'; x.font = '700 34px ui-monospace, Menlo, monospace'; x.fillText(b.nombre, 80, y);
          x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '28px ui-monospace, Menlo, monospace'; x.fillText(b.detalle || '', 560, y);
        });
      }));
      tablero.scale.set(SM.B - 0.4, altoT, 1); tablero.rotation.y = Math.PI / 2; tablero.position.set(X0 + 0.06, 2.4 * e + altoT / 2, SM.z); g.add(tablero);

    }
    // --- Bóveda: la fuente #1 de ingresos, con el último LIVE y la semana. Los números salen solos de las sesiones
    // de la app DURO Live (s.liveStats, por /privado). En la versión pública no va: son ingresos ---
    let boveda = null;
    if (!publico) {
      const u = numerosBoveda(s);
      const oro = mat('#d4af37', {metalness: 0.9, roughness: 0.25});
      const nOro = new THREE.MeshBasicMaterial({color: new THREE.Color('#ffd34d').multiplyScalar(1.4), toneMapped: false}); nOro.userData.base = nOro.color.clone(); res.push(nOro);
      const bv = new THREE.Group(); bv.position.set(BV.x, 0, BV.z); bv.scale.setScalar(e); g.add(bv);
      bv.add(caja(B0, 0.12, B0, mat('#120d05', {roughness: 0.3, metalness: 0.6}), 0, 0.06, 0));
      for (const [x, z, w, d] of [[-B0 / 2, 0, 0.05, B0], [0, B0 / 2, B0, 0.05]]) bv.add(caja(w, 0.04, d, nOro, x, 0.13, z, false));
      // Puerta circular en la pared del fondo
      const zp = -B0 / 2 + 0.12;
      const puerta = cilindro(1.15, 0.18, oro, 0, 1.45, zp); puerta.rotation.x = Math.PI / 2; bv.add(puerta);
      const aro = new THREE.Mesh(nuevo(new THREE.TorusGeometry(1.22, 0.07, 10, 64)), nOro); aro.position.set(0, 1.45, zp + 0.1); bv.add(aro);
      const volante = new THREE.Group(); volante.position.set(0, 1.45, zp + 0.22); bv.add(volante);
      const eje = cilindro(0.16, 0.12, oro, 0, 0, 0); eje.rotation.x = Math.PI / 2; volante.add(eje);
      for (let k = 0; k < 3; k++) { const r = caja(1.3, 0.07, 0.07, oro, 0, 0, 0.04); r.rotation.z = k * Math.PI / 3; volante.add(r); }
      // Monedas: una por cada dólar de la semana, en columnas de 8 (se prenden y apagan solas durante el LIVE)
      const geoMoneda = nuevo(new THREE.CylinderGeometry(0.16, 0.16, 0.045, 20));
      const monedas = Array.from({length: 160}, (_, i) => {
        const col = Math.floor(i / 8), k = i % 8;
        const m = new THREE.Mesh(geoMoneda, oro);
        m.position.set(-1.45 + (col % 8) * 0.42, 0.14 + k * 0.05, 0.6 + Math.floor(col / 8) * 0.42); m.rotation.y = i * 0.7;
        m.castShadow = true; bv.add(m); return m;
      });
      // Tablero con los números, encima de la puerta
      const usd = n => `$${Number(n || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      const num = n => Number(n || 0).toLocaleString('es-CO');
      // El banco: saldo del mes, de dónde entró la plata, ingreso por hora y RPM, y los últimos movimientos (cada directo)
      const dibujar = (x, w, h, u) => {
        x.fillStyle = '#0d0903'; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#ffd34d'; x.lineWidth = 8; x.strokeRect(5, 5, w - 10, h - 10);
        x.textAlign = 'left';
        x.fillStyle = '#ffd34d'; x.font = '800 46px ui-monospace, Menlo, monospace'; x.fillText('BANCO DURO LIVE', 40, 66);
        x.fillStyle = 'rgba(255,211,77,.6)'; x.font = '24px ui-monospace, Menlo, monospace'; x.fillText(`FUENTE #1 DE INGRESOS · ${u.mes}`, 40, 100);
        x.fillStyle = 'rgba(255,255,255,.65)'; x.font = '26px ui-monospace, Menlo, monospace'; x.fillText('SALDO DEL MES', 40, 160);
        x.fillStyle = '#ffffff'; x.font = '800 84px ui-monospace, Menlo, monospace'; x.fillText(usd(u.saldo), 36, 240);
        x.font = '26px ui-monospace, Menlo, monospace';
        x.fillStyle = '#ff6f9a'; x.fillText(`🎁 Regalos TikTok  ${usd(u.regalos)}`, 40, 300);
        x.fillStyle = '#6fb3ff'; x.fillText(`💳 PayPal           ${usd(u.paypal)}`, 40, 340);
        x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(`${usd(u.porHora)}/hora · RPM ${usd(u.rpm)} · ${num(u.directos)} directos`, 40, 400);
        // Movimientos
        x.strokeStyle = 'rgba(255,211,77,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(620, 130); x.lineTo(620, 420); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.65)'; x.font = '26px ui-monospace, Menlo, monospace'; x.fillText('MOVIMIENTOS', 650, 160);
        if (!u.movimientos.length) { x.fillStyle = 'rgba(255,255,255,.45)'; x.fillText('Sin depósitos aún', 650, 214); }
        u.movimientos.forEach((m, i) => {
          x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '28px ui-monospace, Menlo, monospace'; x.fillText(`LIVE #${m.n}`, 650, 214 + i * 56);
          x.fillStyle = '#7dff9a'; x.font = '800 30px ui-monospace, Menlo, monospace'; x.fillText(`+${usd(m.usd)}`, 820, 214 + i * 56);
        });
      };
      const mB = lienzo(1024, 460, (x, w, h) => dibujar(x, w, h, u));
      const tablaB = new THREE.Mesh(GEO.plane, mB);
      // Durante el LIVE los números cambian: se redibuja solo el tablero y se prenden las monedas (sin rehacer la sala)
      boveda = {clave: JSON.stringify(u), actualizar(u2) {
        const cv = mB.map.image; dibujar(cv.getContext('2d'), cv.width, cv.height, u2); mB.map.needsUpdate = true;
        const n = Math.min(160, Math.round(u2.saldo || 0)); monedas.forEach((m, i) => { m.visible = i < n; });
      }};
      boveda.actualizar(u);
      const anchoB = BV.B - 0.5;
      tablaB.scale.set(anchoB, anchoB * 460 / 1024, 1); tablaB.position.set(BV.x, 3.0 * e + anchoB * 230 / 1024, Z0 + 0.06); g.add(tablaB);
      const luz = new THREE.PointLight('#ffcf5a', 6, 7, 1.6); luz.position.set(0, 2.2, 0.6); bv.add(luz);
      leds.push({m: nOro, fase: 0, vel: 1.2});
    }
    // --- Parque de DURO LIVE (adentro, en la esquina de adelante): pasto, el camino por el eje y atracciones en espejo ---
    const PQ = geo.stream.parque, parqueAnim = [], juegosLive = [];
    const neon = c_ => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(c_).multiplyScalar(1.5), toneMapped: false}); res.push(m); return m; };
    if (PQ) {
      const largo = PQ.fin - PQ.dEnt, ang = Math.PI / 2 - frente;   // grupo alineado con el eje de la arena
      const zona = new THREE.Group(); zona.position.set(C.x, 0, C.z); zona.rotation.y = ang; g.add(zona);
      // Piso del parque con los colores de la sala: vino oscuro con brillo y bordes de neón rosado. Si la entrada mira a la
      // esquina es un cuadrado en esa esquina; si mira de frente, una franja centrada que llega hasta el borde de adelante
      const deFrente = Math.abs(frente - Math.PI / 2) < 1e-6;
      const desde = Math.min(...PQ.atracciones.map(a => Math.min(a.x, a.z) - a.r - 0.6)), hasta = L / 2;
      const [x0p, x1p, z0p, z1p] = deFrente
        ? [-hasta, hasta, PQ.dEnt - 1.0, hasta]
        : [desde, hasta, desde, hasta];
      // Baldosas de feria: rombos vino y morado con puntitos dorados
      const cvB = document.createElement('canvas'); cvB.width = cvB.height = 128;
      { const x = cvB.getContext('2d'); x.fillStyle = '#3a0f24'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#2a1240';
        x.beginPath(); x.moveTo(64, 0); x.lineTo(128, 64); x.lineTo(64, 128); x.lineTo(0, 64); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(255,61,110,.35)'; x.lineWidth = 2; x.stroke(); x.fillStyle = '#ffd166'; for (const [px, py] of [[64, 64], [0, 0], [128, 0], [0, 128], [128, 128]]) { x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); } }
      const tB = new THREE.CanvasTexture(cvB); tB.colorSpace = THREE.SRGBColorSpace; tB.wrapS = tB.wrapT = THREE.RepeatWrapping; res.push(tB);
      const pasto = new THREE.Mesh(GEO.plane, new THREE.MeshStandardMaterial({map: tB, roughness: 0.35, metalness: 0.35})); res.push(pasto.material);
      pasto.rotation.x = -Math.PI / 2; pasto.receiveShadow = true;
      pasto.scale.set(x1p - x0p, z1p - z0p, 1); pasto.position.set((x0p + x1p) / 2, 0.008, (z0p + z1p) / 2); g.add(pasto);
      tB.repeat.set((x1p - x0p) / 1.2, (z1p - z0p) / 1.2);
      if (deFrente) {
        // Postes con guirnaldas de bombillos de colores a lo largo del borde de adelante y de los costados
        const yPo = 3.0, zA = hasta - 0.25, mPoste = mat('#2a2d3c', {metalness: 0.7, roughness: 0.3});
        const postes = [[-hasta + 0.3, z0p + 0.2], [-hasta + 0.3, zA], [-5.4, zA], [-1.6, zA], [1.6, zA], [5.4, zA], [hasta - 0.3, zA], [hasta - 0.3, z0p + 0.2]];
        for (const [x, z] of postes) {
          g.add(caja(0.09, yPo, 0.09, mPoste, x, yPo / 2, z));
          g.add(caja(0.2, 0.2, 0.2, neon('#ffd166'), x, yPo + 0.1, z, false));
        }
        const bombillos = ['#ff3d6e', '#ffd166', '#38e8ff', '#a855f7', '#3ddc84'].map(neon);
        const foco = new THREE.SphereGeometry(0.075, 8, 6); res.push(foco);
        for (let k = 0; k < postes.length - 1; k++) {
          const [xa, za] = postes[k], [xb, zb] = postes[k + 1];
          if (Math.abs(xa) === 1.6 && Math.abs(xb) === 1.6) continue;   // el hueco de la escalera queda libre
          const n = Math.max(4, Math.round(Math.hypot(xb - xa, zb - za) / 0.45));
          for (let j = 1; j < n; j++) {
            const u = j / n, b_ = new THREE.Mesh(foco, bombillos[(k + j) % bombillos.length]);
            b_.position.set(xa + (xb - xa) * u, yPo - Math.sin(Math.PI * u) * 0.55, za + (zb - za) * u); g.add(b_);
          }
        }
        // Palmeras de Urabá en las dos esquinas de adelante y racimos de globos junto a la escalera
        for (const sx of [-1, 1]) {
          const px = sx * (hasta - 1.0), pz = zA - 0.5, alto = 3.4;
          const tronco = cilindro(0.11, alto, mat('#7a5a3a'), px, alto / 2, pz); tronco.rotation.z = -sx * 0.08; g.add(tronco);
          for (let k = 0; k < 7; k++) {
            const a = k * Math.PI * 2 / 7, hoja = caja(1.5, 0.04, 0.36, mat(k % 2 ? '#2e9e57' : '#3fbf6a', {flatShading: true}), px + Math.cos(a) * 0.62, alto - 0.05, pz - Math.sin(a) * 0.62);
            hoja.rotation.set(0, a, -0.45); g.add(hoja);
          }
          for (let k = 0; k < 5; k++) {
            const gx = sx * 2.3 + rand(-0.25, 0.25), gz = zA - 0.2 + rand(-0.2, 0.2), gy = 2.2 + rand(0, 0.7);
            const globo = new THREE.Mesh(GEO.sphere, mat(['#ff3d6e', '#ffd166', '#38e8ff', '#a855f7', '#ffffff'][k], {roughness: 0.25, metalness: 0.1}));
            globo.scale.set(0.2, 0.25, 0.2); globo.position.set(gx, gy, gz); g.add(globo);
            const hilo = new THREE.Mesh(GEO.box, mat('#dddddd')); hilo.scale.set(0.01, gy - 0.9, 0.01); hilo.position.set((gx + sx * 2.3) / 2, (gy + 0.9) / 2 - 0.1, (gz + zA - 0.2) / 2); g.add(hilo);
          }
          g.add(cilindro(0.18, 0.9, mat('#3a2a22'), sx * 2.3, 0.45, zA - 0.2));
        }
      }
      const borde = neon(s.color);
      g.add(caja(x1p - x0p, 0.04, 0.06, borde, (x0p + x1p) / 2, 0.03, z0p, false));
      g.add(caja(0.06, 0.04, z1p - z0p, borde, x0p, 0.03, (z0p + z1p) / 2, false));

      // Círculos de luz morada bajo cada atracción
      for (const a of PQ.atracciones) {
        const aro = new THREE.Mesh(new THREE.RingGeometry(a.r * 0.95, a.r, 48), neon('#a855f7')); res.push(aro.geometry);
        aro.rotation.x = -Math.PI / 2; aro.position.set(a.x, 0.02, a.z); g.add(aro);
      }
      zona.add(caja(PQ.ancho, 0.04, largo, mat('#1a1530', {roughness: 0.4, metalness: 0.3}), 0, 0.02, PQ.dEnt + largo / 2, false));
      for (const sx of [-1, 1]) zona.add(caja(0.06, 0.04, largo, neon('#ff3d6e'), sx * PQ.ancho / 2, 0.05, PQ.dEnt + largo / 2, false));
      // Faroles en espejo a los dos lados del camino
      for (let d = PQ.dEnt + 1.5; d < PQ.fin - 0.3; d += 3) for (const sx of [-1, 1]) {
        zona.add(caja(0.07, 2.2, 0.07, mat('#2a2d3c', {metalness: 0.7}), sx * (PQ.ancho / 2 + 0.3), 1.1, d));
        zona.add(caja(0.22, 0.12, 0.22, neon('#ffb3c6'), sx * (PQ.ancho / 2 + 0.3), 2.25, d, false));
      }
      const colores = [s.color, '#ffd166', '#a855f7', '#38e8ff'];
      PQ.atracciones.forEach((a, i) => {
        const at = construirAtraccion(a.tipo, a.color || colores[Math.floor(i / 2) % colores.length], colores, i, res, parqueAnim, a.tipo === 'carrusel' ? a.r : 0);
        at.position.set(a.x, 0, a.z); g.add(at);
        juegosLive.push({a, asientos: at.userData.asientos});
      });
    }
    // --- Portales: por el cian salen los nuevos (y los de paso); por el morado se van los que nunca te siguieron ---
    const portales = [];
    const ent = geo.stream.entrada;
    if (PQ?.portales) for (const [P_, col, txt] of [[PQ.portales.nuevos, '#38e8ff', 'NUEVOS'], [PQ.portales.salida, '#a855f7', 'SALIDA']]) {
      const pg = new THREE.Group(); pg.position.set(P_.x, 0, P_.z); pg.rotation.y = Math.atan2(ent.x - P_.x, ent.z - P_.z); g.add(pg);
      const aro = new THREE.Mesh(nuevo(new THREE.TorusGeometry(0.72, 0.08, 12, 48)), neon(col)); aro.position.y = 0.9; pg.add(aro);
      const mDisco = new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(1.3), transparent: true, opacity: 0.35, toneMapped: false,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}); res.push(mDisco);
      const disco = new THREE.Mesh(nuevo(new THREE.CircleGeometry(0.68, 40)), mDisco); disco.position.y = 0.9; pg.add(disco);
      const base_ = new THREE.Mesh(nuevo(new THREE.RingGeometry(0.45, 0.8, 40)), neon(col)); base_.rotation.x = -Math.PI / 2; base_.position.y = 0.03; pg.add(base_);
      const mL = lienzo(256, 64, (x, w, h) => { x.font = '800 40px ui-monospace,Menlo,monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(txt, w / 2, h / 2); });
      mL.transparent = true; mL.side = THREE.DoubleSide;
      const letrero = new THREE.Mesh(GEO.plane, mL);
      letrero.scale.set(1.6, 0.4, 1); letrero.position.y = 1.95; pg.add(letrero);
      const luz = new THREE.PointLight(col, 3, 4, 1.8); luz.position.y = 1.05; pg.add(luz);
      portales.push({disco: mDisco, aro, luz, pos: new THREE.Vector3(P_.x, 0, P_.z)});
    }
    // Los de paso: de pie en el pasillo de atrás de la pista, apagaditos (te ven pero nunca interactúan)
    let paso = null;
    if (geo.stream.dePaso?.length && PQ?.portales) {
      paso = crearMultitud(g, res, {posiciones: geo.stream.dePaso, color: '#7a7f92', mira: C, puerta: PQ.portales.nuevos, semilla: 'de-paso'});
      const gris = new THREE.Color('#59607a');
      for (const p of paso.gente) p.colores.forEach(c_ => c_.lerp(gris, 0.6));
      // Camino: portal → entrada de la arena → pasillo de atrás → su lugar (y al irse, lo mismo pero hasta el portal de salida)
      const rPas = Math.min(...geo.stream.dePaso.map(d => d.r));
      const camino = (portal, d) => {
        const pts = [{x: portal.x, y: 0, z: portal.z}, {x: ent.x, y: 0, z: ent.z}];
        let dphi = d.phi - frente; dphi = Math.atan2(Math.sin(dphi), Math.cos(dphi));
        const pasos_ = Math.max(1, Math.ceil(Math.abs(dphi) / 0.2));
        for (let k = 0; k <= pasos_; k++) { const ph = frente + dphi * k / pasos_, r = k ? d.r : rPas; pts.push({x: C.x + Math.cos(ph) * r, y: 0, z: C.z + Math.sin(ph) * r}); }
        return ruta3D(pts);
      };
      paso.alEntrar = q => { q.ruta = camino(PQ.portales.nuevos, geo.stream.dePaso[q.k]); };
      paso.alIrse = q => { q.ruta = camino(PQ.portales.salida, geo.stream.dePaso[q.k]); };
    }
    // La fila de canciones: camisetas doradas, mirando al escenario
    let fila = null;
    if (geo.stream.filaCanciones?.length) {
      fila = crearMultitud(g, res, {posiciones: geo.stream.filaCanciones, color: '#ffc21a', mira: C, puerta: geo.stream.entrada, semilla: 'fila'});
      for (const p of fila.gente) { p.colores[0].set('#ffc21a'); p.colores[3].set('#7a5a12'); }
      // Alfombra dorada por el pasillo: del escenario a la entrada, para que se note dónde es la fila
      const alf = new THREE.Group(); alf.position.set(C.x, 0, C.z); alf.rotation.y = Math.PI / 2 - frente; g.add(alf);
      const ultimo = geo.stream.filaCanciones.at(-1);
      const d0 = geo.stream.radioEscenario + 0.3, d1 = Math.max(Math.hypot(geo.stream.entrada.x - C.x, geo.stream.entrada.z - C.z), Math.hypot(ultimo.x - C.x, ultimo.z - C.z) + 0.3);
      alf.add(caja(1.04, 0.02, d1 - d0, mat('#6b4d0c', {roughness: 0.5, metalness: 0.4}), 0, 0.012, (d0 + d1) / 2, false));
      for (const sx of [-1, 1]) alf.add(caja(0.04, 0.03, d1 - d0, neon('#ffc21a'), sx * 0.54, 0.02, (d0 + d1) / 2, false));
    }
    // --- Estructuras con lo que guarda la app DURO Live (solo en la oficina privada; pegada a TikTok) ---
    let estructuras = null;
    if (!publico && s.entradaAlFrente) {
      const h = L / 2, n45 = Math.PI / 4;
      const neonE = c_ => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(c_).multiplyScalar(1.4), toneMapped: false}); res.push(m); return m; };
      // Van en las dos franjas libres a los lados de la arena (entre las ruedas y la sala de máquinas / la bóveda)
      // 🏆 Salón de la fama (franja izquierda): podio de oro, plata y bronce sobre una tarima con alfombra roja
      const xf = -h + 1.65, zf = -1.4;
      g.add(caja(2.6, 0.12, 3.6, mat('#2a1020', {roughness: 0.5}), xf, 0.06, zf));
      g.add(caja(1.0, 0.13, 3.6, mat('#b3122e', {roughness: 0.9}), xf + 0.9, 0.07, zf, false));
      g.add(caja(2.62, 0.03, 3.62, neonE('#d4af37'), xf, 0.13, zf, false));
      for (const [dz, alto_, col] of [[0, 0.9, '#d4af37'], [-1.0, 0.6, '#c0c4cc'], [1.0, 0.4, '#cd7f32']]) {
        g.add(caja(0.9, alto_, 0.9, mat(col, {metalness: 0.8, roughness: 0.3}), xf - 0.3, 0.12 + alto_ / 2, zf + dz));
        g.add(caja(0.92, 0.04, 0.92, neonE(col), xf - 0.3, 0.12 + alto_ + 0.02, zf + dz, false));
      }
      // Trofeo encima del primer puesto
      g.add(cilindro(0.12, 0.25, mat('#d4af37', {metalness: 1, roughness: 0.2}), xf - 0.3, 1.27, zf));
      const copa = new THREE.Mesh(GEO.sphere, mat('#ffd34d', {metalness: 1, roughness: 0.15})); copa.scale.set(0.24, 0.2, 0.24); copa.position.set(xf - 0.3, 1.5, zf); g.add(copa);
      const fama = pizarra(g, res, 900, 520, 3.6, new THREE.Vector3(xf - 0.2, 3.3, zf), n45);
      // 🎯 Meta de tap taps: un corazón gigante flotando sobre el escenario, en el centro de la arena. Se llena con los
      // tap taps del LIVE y celebra cada vez que se cumple una meta
      const cvM = document.createElement('canvas'); cvM.width = 600; cvM.height = 720;
      const tM = new THREE.CanvasTexture(cvM); tM.colorSpace = THREE.SRGBColorSpace; res.push(tM);
      const mM = new THREE.SpriteMaterial({map: tM, transparent: true, depthWrite: false, depthTest: false, toneMapped: false}); res.push(mM);
      const meta = new THREE.Sprite(mM), yMeta = 6.4, anchoM = 4.8; meta.renderOrder = 10; meta.scale.set(anchoM, anchoM * 720 / 600, 1); meta.position.set(C.x, yMeta, C.z); g.add(meta);
      const corazon = x => { x.beginPath(); x.moveTo(75, 40); x.bezierCurveTo(75, 37, 70, 25, 50, 25); x.bezierCurveTo(20, 25, 20, 62.5, 20, 62.5);
        x.bezierCurveTo(20, 80, 40, 102, 75, 120); x.bezierCurveTo(110, 102, 130, 80, 130, 62.5); x.bezierCurveTo(130, 62.5, 130, 25, 100, 25); x.bezierCurveTo(85, 25, 75, 37, 75, 40); x.closePath(); };
      const pintarMeta = (M_, brillo) => {
        const x = cvM.getContext('2d'), k = Math.min(1, M_.progreso / M_.meta), num = n => Number(n || 0).toLocaleString('es-CO');
        x.clearRect(0, 0, 600, 720);
        x.save(); x.translate(30, -60); x.scale(3.6, 3.6);
        corazon(x); x.fillStyle = 'rgba(40,6,20,.85)'; x.fill();
        x.save(); corazon(x); x.clip();
        const yN = 120 - k * 95, gr = x.createLinearGradient(0, yN, 0, 120); gr.addColorStop(0, brillo ? '#ffffff' : '#ff8fb1'); gr.addColorStop(1, '#ff1f5a');
        x.fillStyle = gr; x.fillRect(0, yN, 150, 130);
        x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, yN, 150, 1.2);   // superficie del líquido
        x.restore();
        corazon(x); x.lineWidth = 3; x.strokeStyle = brillo ? '#ffffff' : '#ff3d6e'; x.shadowColor = '#ff3d6e'; x.shadowBlur = 12; x.stroke();
        x.restore();
        x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '800 86px ui-monospace, Menlo, monospace'; x.fillText(`${Math.floor(k * 100)}%`, 300, 255);
        x.fillStyle = '#ff8fb1'; x.font = '800 44px ui-monospace, Menlo, monospace'; x.fillText('META TAP TAPS', 300, 455);
        x.fillStyle = '#fff'; x.font = '800 66px ui-monospace, Menlo, monospace'; x.fillText(`${num(M_.progreso)} / ${num(M_.meta)}`, 300, 535);
        x.fillStyle = '#ffd166'; x.font = '700 30px ui-monospace, Menlo, monospace';
        x.fillText(M_.completadas ? `🏆 ${M_.completadas} ${M_.completadas === 1 ? 'meta cumplida' : 'metas cumplidas'} hoy` : 'Cada 5.000 tap taps, una meta', 300, 600);
        tM.needsUpdate = true;
      };
      let metaActual = {meta: 5000, progreso: 0, completadas: 0}, festejo = 0, pulso = 0;
      // 🎟️ Taquilla de misiones (franja derecha): las misiones completadas del mes. De aquí salen los caminantes
      const xq = h - 1.8, zq = 0.9;
      g.add(caja(1.6, 1.1, 0.9, mat('#151a2e', {roughness: 0.4, metalness: 0.4}), xq, 0.55, zq));
      g.add(caja(1.7, 0.06, 1.0, neonE('#38e8ff'), xq, 1.13, zq, false));
      for (const sx of [-1, 1]) g.add(caja(0.08, 1.4, 0.08, mat('#2a2d3c', {metalness: 0.7}), xq + sx * 0.75, 1.8, zq - 0.35));
      g.add(caja(1.7, 0.1, 1.0, neonE('#a855f7'), xq, 2.52, zq - 0.1, false));
      const taquilla = pizarra(g, res, 900, 520, 3.4, new THREE.Vector3(xq, 3.6, zq - 0.3), n45);
      estructuras = {taquillaPos: new THREE.Vector3(xq, 0, zq + 0.6),
        // Flota suavecito; late cuando suben los tap taps y al cumplir una meta destella y salta
        tick(dt, t) {
          pulso = Math.max(0, pulso - dt * 2.5);
          const f = festejo > 0 ? 1 + Math.abs(Math.sin(festejo * 9)) * 0.25 : 1 + pulso * 0.08 + Math.sin(t * 2.2) * 0.02;
          meta.scale.set(anchoM * f, anchoM * 720 / 600 * f, 1); meta.position.y = yMeta + Math.sin(t * 1.3) * 0.12 + (festejo > 0 ? Math.abs(Math.sin(festejo * 4)) * 0.6 : 0);
          if (festejo > 0) { festejo -= dt; const b_ = Math.floor(festejo * 6) % 2 === 0; if (b_ !== this.brillo) { this.brillo = b_; pintarMeta(metaActual, b_); } if (festejo <= 0) pintarMeta(metaActual, false); }
        },
        actualizar(E) {
        const usd = n => Number(n || 0).toLocaleString('es-CO');
        fama.pintar((x, w, h_) => {
          fondoPizarra(x, w, h_, '#d4af37'); x.textAlign = 'center';
          x.fillStyle = '#ffd34d'; x.font = '800 54px ui-monospace, Menlo, monospace'; x.fillText('🏆 SALÓN DE LA FAMA', w / 2, 70);
          const col = (x0, titulo, lista, val) => {
            x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '700 28px ui-monospace, Menlo, monospace'; x.fillText(titulo, x0, 130);
            if (!lista.length) { x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '26px ui-monospace, Menlo, monospace'; x.fillText('Aún nadie', x0, 180); }
            lista.slice(0, 5).forEach((u, i) => {
              x.fillStyle = ['#ffd34d', '#dfe3ea', '#e8a066', '#fff', '#fff'][i]; x.font = `${i ? 600 : 800} 30px ui-monospace, Menlo, monospace`;
              x.fillText(`${i + 1}. ${cortar(u.usuario, 13)}`, x0, 180 + i * 62);
              x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '24px ui-monospace, Menlo, monospace'; x.fillText(val(u), x0 + 18, 206 + i * 62);
            });
          };
          col(40, 'GAFAS DEL MES', E?.fama?.gafas || [], u => `${usd(u.monedas)} 💎 · ${u.veces} gafas`);
          col(470, 'TAP TAPS DEL LIVE', E?.fama?.taptap || [], u => `${usd(u.likes)} ❤`);
        });
        const M_ = E?.meta || {meta: 5000, progreso: 0, completadas: 0};
        if (M_.completadas > metaActual.completadas) festejo = 3;      // ¡se cumplió una meta!
        else if (M_.progreso > metaActual.progreso) pulso = 1;
        metaActual = M_; pintarMeta(M_, false);
        taquilla.pintar((x, w, h_) => {
          fondoPizarra(x, w, h_, '#38e8ff'); x.textAlign = 'center';
          x.fillStyle = '#38e8ff'; x.font = '800 50px ui-monospace, Menlo, monospace'; x.fillText('🎟️ MISIONES DEL MES', w / 2, 66);
          const porAccion = Object.fromEntries((E?.misiones || []).map(m => [m.accion, m]));
          Object.entries(MISIONES_APP).forEach(([k, [nombre, col]], i) => {
            const cx = i % 2 ? 470 : 40, cy = 130 + Math.floor(i / 2) * 90, m = porAccion[k];
            x.textAlign = 'left'; x.fillStyle = col; x.font = '700 30px ui-monospace, Menlo, monospace'; x.fillText(nombre, cx, cy);
            x.fillStyle = '#fff'; x.font = '800 34px ui-monospace, Menlo, monospace'; x.fillText(`${usd(m?.aprobadas)} ✓`, cx, cy + 40);
            if (m?.enviadas > m?.aprobadas) { x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '22px ui-monospace, Menlo, monospace'; x.fillText(`${m.enviadas - m.aprobadas} sin aprobar`, cx + 150, cy + 40); }
          });
        });
      }};
      estructuras.actualizar(s.extra);
    }
    return {M, leds, parqueAnim, juegosLive, portales, paso, fila, boveda, estructuras};
  }

  // Personaje
  // estilo: colores fijos, gafas, audífonos o un material único (holograma)
  function crearPersona(ag, estilo = {}) {
    const ghost = ag.estado === 'planeado';
    const h = hash(ag.nombre);
    const m = color => estilo.material || (ghost ? MAT_GHOST : mat(color));
    const camisa = estilo.camisa || '#' + new THREE.Color().setHSL((h % 360) / 360, 0.6, 0.5).getHexString();
    const piel = estilo.piel || ['#8d5a3b', '#6b4128', '#b07a52', '#4a2f1f'][h % 4];
    const pelo = estilo.pelo || ['#15110f', '#2b1a10', '#0d0d12'][h % 3];
    const pantalon = estilo.pantalon || ['#1f2235', '#2b3a55', '#3a2a22'][h % 3];

    const raiz = new THREE.Group();
    const cuerpo = new THREE.Group(); raiz.add(cuerpo);
    const pierna = sx => {
      const p = new THREE.Group(); p.position.set(sx, 0.47, 0);
      const mesh = caja(0.14, 0.46, 0.16, m(pantalon), 0, -0.23, 0); p.add(mesh);
      const zap = caja(0.15, 0.07, 0.22, m('#111'), 0, -0.44, 0.03); p.add(zap);
      cuerpo.add(p); return p;
    };
    const pI = pierna(-0.1), pD = pierna(0.1);
    const torso = new THREE.Mesh(GEO.torso, m(camisa)); torso.position.y = 0.8; torso.scale.z = 0.82; torso.castShadow = true; cuerpo.add(torso);
    const brazo = sx => {
      const b = new THREE.Group(); b.position.set(sx, 0.98, 0);
      const mesh = new THREE.Mesh(GEO.arm, m(camisa)); mesh.position.y = -0.2; mesh.castShadow = true; b.add(mesh);
      const mano = new THREE.Mesh(GEO.sphere, m(piel)); mano.scale.setScalar(0.07); mano.position.y = -0.4; b.add(mano);
      cuerpo.add(b); return b;
    };
    const bI = brazo(-0.29), bD = brazo(0.29);
    const cabeza = new THREE.Group(); cabeza.position.y = 1.3; cuerpo.add(cabeza);
    const cara = new THREE.Mesh(GEO.sphere, m(piel)); cara.scale.setScalar(0.22); cara.castShadow = true; cabeza.add(cara);
    const cab = new THREE.Mesh(GEO.hair, m(pelo)); cab.scale.setScalar(0.232); cab.position.set(0, 0.02, -0.015); cab.rotation.x = -0.25; cabeza.add(cab);
    if (estilo.gafas) {
      const mG = estilo.material || mat('#050508', {roughness: 0.15, metalness: 0.6});
      for (const sx of [-0.08, 0.08]) cabeza.add(caja(0.12, 0.07, 0.03, mG, sx, 0.025, 0.205, false));
      cabeza.add(caja(0.06, 0.02, 0.02, mG, 0, 0.04, 0.21, false));
    } else if (!ghost && !estilo.material) for (const sx of [-0.075, 0.075]) { const o = new THREE.Mesh(GEO.sphere, mat('#0b0b10')); o.scale.setScalar(0.028); o.position.set(sx, 0.02, 0.2); cabeza.add(o); }
    if (estilo.audifonos) {
      const mA = estilo.material || mat('#18181f', {roughness: 0.4});
      const arco = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.025, 6, 20, Math.PI), mA); arco.position.y = 0.02; cabeza.add(arco);
      for (const sx of [-0.235, 0.235]) { const cup = cilindro(0.08, 0.06, estilo.material || mat('#ff5a00'), sx, 0.0, 0); cup.rotation.z = Math.PI / 2; cabeza.add(cup); }
    }
    return {raiz, cuerpo, pI, pD, bI, bD, cabeza};
  }

  // ---------- Distribución en anillo ----------
  // Reparte las salas en un anillo alrededor del Cerebro: cada una ocupa un arco según su tamaño,
  // así la arena grande no obliga a separar todas las demás.
  function slots(tamanos) {
    const anchos = tamanos.map(L => L * 1.32 + 2.2);
    const maxL = Math.max(5, ...tamanos);
    const suma = anchos.reduce((x, y) => x + y, 0);
    const ubicar_ = R => {
      const holgura = (2 * Math.PI * R - suma) / anchos.length;
      // La primera sala queda arriba a la izquierda, sin quedar justo detrás del Cerebro (el rayo la taparía)
      let a = -3 * Math.PI / 4 - 0.45 - (anchos[0] + holgura) / (2 * R);
      return anchos.map(w => {
        const centro = a + (w + holgura) / (2 * R);
        a += (w + holgura) / R;
        return new THREE.Vector3(Math.cos(centro) * R, 0, Math.sin(centro) * R);
      });
    };
    // Con salas enormes una al lado de otra, la distancia en línea recta es menor que el arco: se abre el círculo
    // hasta que ningún par de vecinas se pise (las salas son cuadradas, así que se mira la diagonal)
    let R = Math.max(HUB_R + 4 + maxL * 0.75, suma / (2 * Math.PI)), pos = ubicar_(R);
    const sePisan = ps => ps.some((p, i) => {
      const j = (i + 1) % ps.length;
      return j !== i && p.distanceTo(ps[j]) < (tamanos[i] + tamanos[j]) * Math.SQRT1_2 + 1.5;
    });
    for (let k = 0; k < 40 && sePisan(pos); k++) pos = ubicar_(R *= 1.05);
    return {R, pos, maxL};
  }

  function camino(desde, hasta, activo) {
    const dir = hasta.clone().sub(desde); const largo = dir.length(); dir.normalize();
    const ang = Math.atan2(dir.x, dir.z);
    const g = new THREE.Group(); g.position.copy(desde); g.rotation.y = ang;
    const via = caja(1.5, 0.08, largo, mat(activo ? '#151b3d' : '#10142c', {roughness: 0.9}), 0, -0.04, largo / 2, false);
    via.receiveShadow = true; g.add(via);
    const mLinea = new THREE.MeshBasicMaterial({color: activo ? '#4a5aa8' : '#262d5a'});
    for (let d = 0.6; d < largo - 0.4; d += 1.3) g.add(caja(0.08, 0.02, 0.6, mLinea, 0, 0.01, d, false));
    return g;
  }

  // ---------- Reconstrucción cuando cambian los datos ----------
  let datos = null;
  function actualizar(state) {
    datos = state;
    fijarEscalaRedes(state.salas);
    const normales = state.salas.filter(s => !s.centro);
    // DURO LIVE va pegada a TikTok (es la misma plataforma): no ocupa lugar propio en el círculo, sino que queda
    // detrás de TikTok, centrada. TikTok reserva ese espacio en el círculo.
    const anexo = normales.find(s => s.id === 'live'), base = normales.find(s => s.id === 'tiktok');
    const juntas = anexo && base && anexo.tipo === 'stream';
    // Pegada a TikTok, la entrada de la arena mira de frente a TikTok (la escalera llega por el medio)
    // DURO LIVE mide solo lo que necesita (lo que tiene adentro), no el tamaño de TikTok
    if (juntas) anexo.entradaAlFrente = true; else if (anexo) delete anexo.entradaAlFrente;
    if (anexo) delete anexo.ladoMin;
    const enCirculo = juntas ? normales.filter(s => s !== anexo) : normales;
    const extra = s => juntas && s === base ? 2 * geometria(anexo).L : 0;
    const tamanos = [...enCirculo.map(s => geometria(s).L + extra(s)), ...state.futuras.map(() => 5)];
    const {R, pos, maxL} = slots(tamanos);
    rt.extent = R + maxL * 0.75;
    const posDe = new Map(enCirculo.map((s, i) => [s.id, pos[i]]));
    rt.anexo = null;
    if (juntas) {
      // Detrás de la pared del fondo de TikTok y en un segundo nivel: no tapa nada de TikTok. Alineada a la izquierda,
      // así la pared grande de TikTok (la de tus seguidores y tu figura grande) sigue derecho en la pared de la sala de
      // máquinas de DURO LIVE. La pared que comparten queda baja para que DURO LIVE se vea entera.
      const Lb = geometria(base).L, La = geometria(anexo).L, pb = posDe.get(base.id);
      rt.anexo = {lado: 'fondo'};
      posDe.set(anexo.id, pb.clone().add(new THREE.Vector3(-(Lb / 2 - La / 2), NIVEL, -(Lb / 2 + La / 2 + 0.25))));
      base.huecoOficina = {x0: -Lb / 2, x1: -Lb / 2 + Math.min(Lb, La)};
      // OFICINA DURO: un penthouse arriba de la unión de TikTok y DURO LIVE, a la izquierda de la escalera. El módulo de
      // TikTok queda sobre TikTok y el de DURO LIVE sobre DURO LIVE, con una sala de reuniones en el medio. Cada sala
      // recibe la esquina y la altura de su módulo en sus propias coordenadas (las dos están centradas en x).
      // Colgada de la pared izquierda (la que comparten en línea): x en coordenadas de cada sala
      // rz: centro de la sala de reuniones compartida (en la unión), en las coordenadas de cada sala
      anexo.oficina = {xo: -La / 2 + 0.3, zo: La / 2 - OFICINA.fondo - 1.3, y: 0, rz: La / 2 + 0.125};
      base.oficina = {xo: -Lb / 2 + 0.3, zo: -Lb / 2 + 1.3, y: 0, rz: -Lb / 2 - 0.125};
      // La pared de TikTok y la de DURO LIVE (que siguen en línea) terminan a la misma altura: la más alta de las dos
      delete base.paredHw; delete anexo.paredHw;
      const tope = Math.max(alturaPared(base, geometria(base)), NIVEL + alturaPared(anexo, geometria(anexo)));
      base.paredHw = tope; anexo.paredHw = tope - NIVEL;
      // El penthouse queda siempre por encima de esa pared
      const piso = Math.max(PENTHOUSE, tope + 0.5);
      base.oficina.y = piso; anexo.oficina.y = piso - NIVEL;
    } else if (base) { delete base.huecoOficina; delete base.oficina; delete base.paredHw; if (anexo) { delete anexo.oficina; delete anexo.paredHw; }
    }

    // Salas: solo se reconstruye la que cambió de forma
    const vivos = new Set();
    normales.forEach((s, i) => {
      vivos.add(s.id);
      const firma = JSON.stringify([s.huecoOficina, s.oficina, s.entradaAlFrente, s.paredHw, s.color, s.nombre, s.tipo, s.seguidores >= 1e6 ? 2 : s.seguidores >= 1e5 ? 1 : 0, geometria(s).L, s.agentes.map(a => a.nombre + a.estado), geometria(s).stream?.aforo, geometria(s).fans?.ahora?.posiciones.length, s.ultimoLive, s.codigo, s.estudio?.map(e => e.real)]);
      let room = rt.rooms.get(s.id);
      if (!room || room.firma !== firma) {
        if (room) { mundo.remove(room.g); room.res.forEach(r => r.dispose()); }
        room = construirSala(s); room.firma = firma; room.agentes = []; mundo.add(room.g);
        rt.rooms.set(s.id, room);
        montarAgentes(room, s);
      }
      room.s = s; room.g.position.copy(posDe.get(s.id));
    });
    for (const [id, room] of rt.rooms) if (!vivos.has(id)) { mundo.remove(room.g); room.res.forEach(r => r.dispose()); rt.rooms.delete(id); }

    // Lotes futuros
    rt.futuras.forEach(f => mundo.remove(f.g)); rt.futuras = [];
    state.futuras.forEach((nombre, j) => {
      const p = pos[enCirculo.length + j]; if (!p) return;
      const g = new THREE.Group(); g.position.copy(p);
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 0.02, 5)), new THREE.LineDashedMaterial({color: '#4b56a0', dashSize: 0.4, gapSize: 0.3}));
      borde.computeLineDistances(); g.add(borde);
      const base = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({color: '#3a4590', transparent: true, opacity: 0.08}));
      base.scale.set(5, 5, 1); base.rotation.x = -Math.PI / 2; base.userData = {futura: j}; g.add(base);
      mundo.add(g); rt.futuras.push({g, base, nombre, j});
    });

    // Caminos
    mundo.remove(rt.caminos); rt.caminos = new THREE.Group(); mundo.add(rt.caminos);
    // Un camino del centro a cada sala del círculo (a DURO LIVE se llega por TikTok)
    pos.slice(0, enCirculo.length + state.futuras.length).forEach((p, i) => {
      const dir = p.clone().normalize();
      const L = i < enCirculo.length ? geometria(enCirculo[i]).L : 5;
      rt.caminos.add(camino(dir.clone().multiplyScalar(HUB_R - 0.2), p.clone().sub(dir.clone().multiplyScalar(L * 0.62)), i < enCirculo.length));
    });

    if (rt.anexo) { rt.paseoAnim = []; construirPuertaTikTok(); } else construirPaseo();

    calcAsignaciones();
    construirEtiquetas();
    ajustarCamara();
  }

  // ---------- Escalera de TikTok a DURO LIVE ----------
  // DURO LIVE está detrás de la pared del fondo de TikTok, centrada y en un segundo nivel, con la entrada de la arena
  // mirando a TikTok. En el MEDIO de la pared que comparten hay una escalera doble dentro de TikTok: dos tramos en espejo
  // pegados a la pared que llegan a un descanso central, y de ahí se entra por el arco «♪ TIKTOK» al camino del parque,
  // todo en línea con la entrada. Coordenadas de DURO LIVE: TikTok queda NIVEL más abajo y su pared en z = h + 0,25.
  function puertaTikTok(ar) {
    if (!rt.anexo || !ar?.geo.stream) return null;
    const h = ar.geo.L / 2, pasos = Math.ceil(NIVEL / 0.2), huella = 0.32, run = pasos * huella;
    const W = 1.0, z0 = h + 0.4, z1 = h + 1.9, zc = (z0 + z1) / 2;   // W: medio ancho del descanso; z0-z1: franja de los tramos
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    return {h, pasos, huella, run, W, z0, z1, zc,
      rellano: v(0, 0, zc), arco: v(0, 0, h - 0.9), piso: v(0, 0, h - 2.2),
      // Tramo izquierdo (sube hacia la derecha) y tramo derecho (sube hacia la izquierda), en espejo
      tramos: [-1, 1].map(sg => [v(sg * (W + run + 0.6), -NIVEL, zc + 0.9), v(sg * (W + run + 0.6), -NIVEL, zc), v(sg * W, 0, zc)])};
  }
  // Desde donde entra da la vuelta por fuera de la arena hasta quedar frente a la entrada
  function vueltaHastaFrente(geo, desde) {
    const {C, frente, parque} = geo.stream, r = parque.dEnt + 0.9;
    const a0 = Math.atan2(desde.z - C.z, desde.x - C.x);
    let d = frente - a0; d = Math.atan2(Math.sin(d), Math.cos(d));
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.25)), pts = [];
    for (let k = 0; k <= n; k++) { const a = a0 + d * k / n; pts.push(new THREE.Vector3(C.x + Math.cos(a) * r, 0, C.z + Math.sin(a) * r)); }
    return pts;
  }
  // De TikTok a DURO LIVE: uno de los dos tramos → descanso → arco → camino del parque → frente de la arena
  function caminoPuerta(ar, tramo = Math.random() < 0.5 ? 0 : 1) {
    const P = puertaTikTok(ar);
    return P ? [...P.tramos[tramo], P.rellano, P.arco, P.piso, ...vueltaHastaFrente(ar.geo, P.piso)] : null;
  }
  function construirPuertaTikTok() {
    const ar = rt.rooms.get('live'), P = puertaTikTok(ar);
    if (!P) return;
    const res = [], e = new THREE.Group(); e.position.copy(ar.g.position); rt.caminos.add(e);
    const luz = (c_, k = 1.5) => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(c_).multiplyScalar(k), toneMapped: false}); res.push(m); return m; };
    const piedra = mat('#8f7fb8', {roughness: 0.55, metalness: 0.1}), cian = luz('#25f4ee', 1.6), rosa = luz('#ff3d6e', 1.2);
    const gris = mat('#151826', {roughness: 0.7, metalness: 0.4});
    const b = (x0, x1, y0, y1, z0, z1, m, sombra = true) => e.add(caja(x1 - x0, y1 - y0, z1 - z0, m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, sombra));
    const letrero = (txt, col, ancho_, pos, rotY = 0) => {
      const cv = document.createElement('canvas'); cv.width = 768; cv.height = 96;
      const c2 = cv.getContext('2d'); c2.font = '800 60px ui-monospace, Menlo, monospace'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.fillStyle = col; c2.fillText(txt, 384, 50);
      const tx = new THREE.CanvasTexture(cv); res.push(tx);
      const m = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tx, transparent: true, toneMapped: false, side: THREE.DoubleSide})); res.push(m.material);
      m.scale.set(ancho_, ancho_ * 96 / 768, 1); m.position.copy(pos); m.rotation.y = rotY; e.add(m);
    };
    const {h, W, z0, z1} = P, sube = NIVEL / P.pasos;
    // --- Escalera doble en el medio: dos tramos en espejo pegados a la pared de TikTok ---
    for (const sg of [-1, 1]) {
      for (let k = 0; k < P.pasos; k++) {
        const d0 = W + P.run - k * P.huella, d1 = d0 - P.huella, top = -NIVEL + (k + 1) * sube;   // de afuera hacia el centro
        const xa = sg * Math.min(d0, d1), xb = sg * Math.max(d0, d1);
        b(Math.min(xa, xb), Math.max(xa, xb), -NIVEL, top, z0, z1, piedra);
        const xn = sg * d1;
        b(Math.min(xn, xn + sg * 0.06), Math.max(xn, xn + sg * 0.06), top, top + 0.04, z0, z1, cian, false);
      }
      const r = caja(Math.hypot(P.run, NIVEL), 0.06, 0.06, cian, sg * (W + P.run / 2), -NIVEL / 2 + 0.9, z1, false);
      r.rotation.z = -sg * Math.atan2(NIVEL, P.run); e.add(r);
    }
    // Descanso central (sobre la pared de TikTok) con baranda hacia TikTok
    b(-W, W, -0.2, 0, h, z1, piedra);
    b(-W, W, 0.9, 0.96, z1 - 0.04, z1, cian, false);
    // Arco «♪ TIKTOK» en la mitad del borde de adelante de DURO LIVE, en línea con la entrada
    const ancho = 1.6, alto = 2.6;
    for (const sx of [-1, 1]) b(sx * ancho / 2 - 0.06, sx * ancho / 2 + 0.06, 0, alto, h - 0.03, h + 0.03, cian, false);
    b(-ancho / 2 - 0.06, ancho / 2 + 0.06, alto, alto + 0.12, h - 0.03, h + 0.03, cian, false);
    b(-ancho / 2, ancho / 2, 0.005, 0.03, h - 1.6, h, rosa, false);
    letrero('♪ TIKTOK', '#25f4ee', 2.0, new THREE.Vector3(0, alto + 0.45, h + 0.05));

    // --- OFICINA DURO: penthouse de vidrio arriba de la unión de TikTok y DURO LIVE, a la izquierda de la escalera. El
    // público no llega ahí. Módulo de DURO LIVE sobre DURO LIVE, sala de reuniones en el medio y módulo de TikTok sobre
    // TikTok (los escritorios los pone cada sala en su módulo). Cuelga de la pared izquierda, en un tercer nivel ---
    const yP = ar.s.oficina?.y ?? PENTHOUSE - NIVEL, xo = ar.s.oficina?.xo ?? -h + 0.3, x0 = xo - 0.3, x1 = xo + OFICINA.ancho + 0.3;
    const zr0 = h - 1.3, zr1 = h + 1.55, zi = zr0 - OFICINA.fondo - 0.4, zf = zr1 + OFICINA.fondo + 0.4;
    const vidrio = new THREE.MeshStandardMaterial({color: '#9cc9ff', transparent: true, opacity: 0.15, metalness: 0.6, roughness: 0.05, depthWrite: false}); res.push(vidrio);
    const blanco = luz('#ffffff', 1.1), hv = 2.6;
    b(x0, x1, yP - 0.35, yP, zi, zf, mat('#1b1f33', {roughness: 0.4, metalness: 0.4}));
    b(x0, x1, yP + 0.002, yP + 0.012, zi, zr0, mat('#3a1525', {roughness: 0.6}), false);        // módulo DURO LIVE
    b(x0, x1, yP + 0.002, yP + 0.012, zr0, zr1, mat('#24183a', {roughness: 0.5}), false);       // sala de reuniones
    b(x0, x1, yP + 0.002, yP + 0.012, zr1, zf, mat('#0f2f33', {roughness: 0.6}), false);        // módulo TikTok
    // Vidrio alrededor y divisiones bajas entre módulos; marcos de neón arriba (rosado DURO LIVE, blanco, cian TikTok)
    b(x0 - 0.03, x0 + 0.03, yP, yP + hv, zi, zf, vidrio, false); b(x1 - 0.03, x1 + 0.03, yP, yP + hv, zi, zf, vidrio, false);
    b(x0, x1, yP, yP + hv, zi - 0.03, zi + 0.03, vidrio, false); b(x0, x1, yP, yP + hv, zf - 0.03, zf + 0.03, vidrio, false);
    // Divisiones bajas entre módulos y sala de reuniones, con una puerta en el pasillo (por ahí pasan a compartir)
    const xp = xo + 6.2 - 0.55;
    for (const z of [zr0, zr1]) { b(x0, xp, yP, yP + 1.1, z - 0.03, z + 0.03, vidrio, false); b(x0, xp, yP + 1.1, yP + 1.15, z - 0.03, z + 0.03, blanco, false); }
    for (const [za, zb, m] of [[zi, zr0, rosa], [zr0, zr1, blanco], [zr1, zf, cian]]) for (const x of [x0, x1]) b(x - 0.05, x + 0.05, yP + hv, yP + hv + 0.06, za, zb, m, false);
    b(x0, x1, yP + hv, yP + hv + 0.06, zi - 0.05, zi + 0.05, rosa, false); b(x0, x1, yP + hv, yP + hv + 0.06, zf - 0.05, zf + 0.05, cian, false);
    b(x0, x1, yP - 0.4, yP - 0.34, zi - 0.03, zf + 0.03, luz('#a855f7', 1.3), false);
    // Sala de reuniones: mesa y sillas
    const xc = (x0 + x1) / 2, zc = (zr0 + zr1) / 2;
    b(xc - 1.4, xc + 1.4, yP + 0.72, yP + 0.78, zc - 0.55, zc + 0.55, mat('#e9e4da', {roughness: 0.4}));
    b(xc - 0.1, xc + 0.1, yP, yP + 0.72, zc - 0.1, zc + 0.1, gris);
    for (const dx of [-1, 0, 1]) for (const sz of [-1, 1]) b(xc + dx * 0.9 - 0.22, xc + dx * 0.9 + 0.22, yP + 0.42, yP + 0.5, zc + sz * 0.95 - 0.2, zc + sz * 0.95 + 0.2, mat('#2a2d40'));
    // 📥 Bandeja de revisión: las pruebas de misiones que esperan tu aprobación en la app, apiladas en la mesa
    rt.bandeja = null;
    if (!publico) {
    const papeles = new THREE.Group(); papeles.position.set(xc + 0.9, yP + 0.78, zc); e.add(papeles);
    const mPapel = mat('#f4f1ea', {roughness: 0.8});
    for (let i = 0; i < 12; i++) { const h_ = caja(0.42, 0.025, 0.3, mPapel, rand(-0.02, 0.02), 0.015 + i * 0.03, rand(-0.02, 0.02), false); h_.rotation.y = rand(-0.2, 0.2); papeles.add(h_); }
    const cartel = pizarra(e, res, 520, 200, 1.6, new THREE.Vector3(xc + 0.9, yP + 1.75, zc), Math.PI / 4);
    rt.bandeja = {clave: null, actualizar(n) {
      papeles.children.forEach((h_, i) => { h_.visible = i < Math.min(12, n); });
      cartel.pintar((x, w, h_) => {
        fondoPizarra(x, w, h_, n ? '#ffb020' : '#3ddc84'); x.textAlign = 'center';
        x.fillStyle = n ? '#ffb020' : '#3ddc84'; x.font = '800 54px ui-monospace, Menlo, monospace';
        x.fillText(n ? `📥 ${n} POR REVISAR` : '📥 BANDEJA AL DÍA', w / 2, 92);
        x.fillStyle = 'rgba(255,255,255,.65)'; x.font = '26px ui-monospace, Menlo, monospace'; x.fillText('pruebas de misiones en la app', w / 2, 150);
      });
    }};
    rt.bandeja.actualizar(0);
    }
    // Sin columnas: el penthouse cuelga de la pared izquierda (la que TikTok y DURO LIVE comparten en línea), con
    // soportes de acero en diagonal pegados a la pared
    for (const z of [zi + 0.6, zr0 - 0.5]) {
      const largo = Math.hypot(2.6, 2.2), r = caja(largo, 0.14, 0.14, mat('#2a2d3c', {metalness: 0.8, roughness: 0.3}), x0 + 1.3, yP - 0.35 - 1.1, z);
      r.rotation.z = Math.atan2(2.2, 2.6); e.add(r);
      b(x0, x0 + 0.12, yP - 2.6, yP - 0.35, z - 0.12, z + 0.12, mat('#2a2d3c', {metalness: 0.8, roughness: 0.3}));
    }
    // Letreros
    letrero('OFICINA DURO', '#ffffff', 5.4, new THREE.Vector3(xc, yP + hv + 0.8, zc), Math.PI / 4);
    letrero('EQUIPO DURO LIVE', '#ff6f9a', 3.4, new THREE.Vector3(xc, yP + hv + 0.3, (zi + zr0) / 2), Math.PI / 4);
    letrero('EQUIPO TIKTOK', '#25f4ee', 3.4, new THREE.Vector3(xc, yP + hv + 0.3, (zr1 + zf) / 2), Math.PI / 4);

    // Las paredes de DURO LIVE (izquierda y fondo) bajan hasta el piso, tapando el hueco bajo su losa: se ve como un
    // muro continuo desde abajo, en línea con la pared de TikTok
    const L = ar.geo.L, mPared = mat('#' + new THREE.Color(ar.s.color).multiplyScalar(0.28).getHexString(), {roughness: 0.6});
    e.add(caja(0.2, NIVEL, L + 0.2, mPared, -h - 0.1, -NIVEL / 2, -0.1));
    e.add(caja(L, NIVEL, 0.2, mPared, 0, -NIVEL / 2, -h - 0.1));
    // Columnas y losa bajo DURO LIVE, con borde de neón
    e.add(caja(L, 0.35, L, gris, 0, -0.2, 0, false));
    for (const cx of [-1, 0, 1]) for (const cz of [-1, 0, 1]) if (cx || cz) e.add(caja(0.6, NIVEL, 0.6, gris, cx * (h - 0.5), -NIVEL / 2 - 0.2, cz * (h - 0.5)));
    e.add(caja(0.08, 0.05, L + 0.1, rosa, h + 0.02, -0.38, 0, false));
  }

  // ---------- Paseo de TikTok a DURO LIVE (cuando no están pegadas) ----------
  // Sale derecho de la puerta del parque de TikTok y llega a la esquina de adelante de DURO LIVE, sobre el eje
  // de la arena; de ahí sigue por el camino del parque de DURO LIVE hasta la entrada. Por aquí camina la gente en vivo.
  rt.paseoAnim = [];
  function puntosPaseo() {
    const tk = rt.rooms.get('tiktok'), ar = rt.rooms.get('live');
    if (!tk?.geo.fans || !ar?.geo.stream?.parque) return null;
    const pu = tk.geo.fans.puerta, esq = ar.geo.stream.parque.esquina;
    const A = tk.g.localToWorld(new THREE.Vector3(pu.x, 0, pu.z + 1.2));       // saliendo de TikTok
    const B = ar.g.localToWorld(new THREE.Vector3(esq.x, 0, esq.z));           // esquina de DURO LIVE, sobre el eje
    return {A, B, tk, ar};
  }
  function construirPaseo() {
    rt.paseoAnim = [];
    const P = puntosPaseo();
    if (!P) return;
    const {A, B} = P;
    const dir = B.clone().sub(A), largo = dir.length(); dir.normalize();
    const g = new THREE.Group(); g.position.copy(A); g.rotation.y = Math.atan2(dir.x, dir.z); rt.caminos.add(g);
    const res = [];
    const luz = (c_, k = 1.5) => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(c_).multiplyScalar(k), toneMapped: false}); res.push(m); return m; };
    const ancho = 2.4, mitad = largo / 2;
    // Piso oscuro con bordes de neón: cian (TikTok) la primera mitad y rosado (DURO LIVE) la segunda, igual a los dos lados
    const piso = caja(ancho, 0.05, largo, mat('#1a1530', {roughness: 0.4, metalness: 0.3}), 0, 0.025, mitad, false); piso.receiveShadow = true; g.add(piso);
    for (const sx of [-1, 1]) {
      g.add(caja(0.06, 0.04, mitad, luz('#25f4ee'), sx * ancho / 2, 0.06, mitad / 2, false));
      g.add(caja(0.06, 0.04, mitad, luz('#ff3d6e'), sx * ancho / 2, 0.06, mitad + mitad / 2, false));
    }
    // Faroles en espejo, repartidos parejo a lo largo del paseo
    const nF = Math.max(2, Math.round(largo / 6));
    for (let i = 0; i < nF; i++) {
      const d = largo * (i + 0.5) / nF;
      for (const sx of [-1, 1]) {
        g.add(caja(0.07, 2.2, 0.07, mat('#2a2d3c', {metalness: 0.7}), sx * (ancho / 2 + 0.3), 1.1, d));
        g.add(caja(0.22, 0.12, 0.22, luz(d < mitad ? '#9ff9f6' : '#ffb3c6', 1.6), sx * (ancho / 2 + 0.3), 2.25, d, false));
      }
    }
    // Arcos en los dos extremos: salida de TikTok y entrada a DURO LIVE
    const arco = (d, texto, col) => {
      for (const sx of [-1, 1]) g.add(caja(0.14, 2.9, 0.14, luz(col, 1.2), sx * (ancho / 2 + 0.5), 1.45, d, false));
      g.add(caja(ancho + 1.14, 0.14, 0.14, luz(col, 1.2), 0, 2.9, d, false));
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 96;
      const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.font = '800 54px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(texto, 320, 50);
      const t = new THREE.CanvasTexture(cv); res.push(t);
      const cartel = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide})); res.push(cartel.material);
      cartel.scale.set(ancho + 1.2, (ancho + 1.2) * 96 / 640, 1); cartel.position.set(0, 3.25, d); g.add(cartel);
    };
    arco(0.6, 'TIKTOK ▶ DURO LIVE', '#25f4ee');
    arco(largo - 0.3, 'DURO LIVE', '#ff3d6e');
  }


  function montarAgentes(room, s) {
    const geo = room.geo;
    room.agentes = s.agentes.slice(0, geo.cap).map((ag, i) => {
      const key = `${s.id}:${i}:${ag.nombre}`;
      const silla = geo.silla(i);
      const prev = rt.memoria.get(key);
      const p = crearPersona(ag);
      room.g.add(p.raiz);
      const A = prev && prev.L === geo.L
        ? Object.assign(prev, {p})
        : {x: silla.x, z: silla.z, path: [], modo: 'sentado', timer: rand(1, 9), rot: Math.PI, rotObj: Math.PI, pk: rand(1, 3), fase: rand(0, 6), p};
      Object.assign(A, {key, ag, i, silla, L: geo.L, room});
      if (A.path.length) A.path = ruta(A, A.path[A.path.length - 1], geo);
      rt.memoria.set(key, A);
      return A;
    });
  }

  function calcAsignaciones() {
    rt.asig = new Map();
    for (const s of datos.salas) {
      const room = rt.rooms.get(s.id);
      const cap = room ? room.geo.cap : 0;
      const libres = s.agentes.slice(0, cap).map((a, i) => ({k: `${s.id}:${i}:${a.nombre}`, a}));
      const pendientes = [];
      for (const t of s.tareas.filter(t => t.estado === 'desarrollo')) {
        const f = t.agente ? libres.findIndex(o => o.a.nombre === t.agente) : -1;
        if (f >= 0) { rt.asig.set(libres[f].k, t.t); libres.splice(f, 1); } else pendientes.push(t);
      }
      for (const t of pendientes) { const o = libres.shift(); if (o) rt.asig.set(o.k, t.t); }
    }
  }
  const tareaDe = k => rt.asig.get(k) || rt.demoMap.get(k)?.texto || null;
  // Entradas de gente por sala en esta sesión
  const entradas = new Map();
  const contarEntrada = (id, n = 1) => entradas.set(id, (entradas.get(id) || 0) + n);

  // ---------- Etiquetas HTML sobre la escena ----------
  const tmpV = new THREE.Vector3();
  function construirEtiquetas() {
    capa.innerHTML = '';
    for (const room of rt.rooms.values()) {
      const s = room.s, n = s.agentes.length;
      const el = document.createElement('div');
      el.className = 'etq'; el.dataset.sala = s.id;
      el.innerHTML = `<span class="pt" style="background:${s.color}"></span><b>${esc(s.nombre)}</b><small>${publico ? (s.seguidores ? `${cifra(s.seguidores)} ${esc(s.unidad || 'seguidores')}` : '') : `${s.seguidores ? `${cifra(s.seguidores)} · ` : ''}${n} ${n === 1 ? 'agente' : 'agentes'} · ${s.tareas.length} tareas`}</small><em class="vivo">● trabajando</em><em class="rojo">● EN VIVO</em>`;
      capa.appendChild(el); room.etq = el;
      if (room.casa) {
        const d = document.createElement('div'); d.className = 'etq mini'; d.dataset.sala = s.id; capa.appendChild(d);
        room.etqCasa = {el: d, texto: ''};
      }
      for (const es of room.fest?.escenarios || []) {
        const d = document.createElement('div'); d.className = 'etq mini'; d.dataset.sala = s.id; capa.appendChild(d);
        es.etq = {el: d, clave: ''};
      }
      if (room.red?.multitud) {
        const d = document.createElement('div'); d.className = 'etq mini'; d.dataset.sala = s.id; capa.appendChild(d);
        room.etqFans = {el: d, clave: ''};
      }
      if (room.red?.ahora) {
        const d = document.createElement('div'); d.className = 'etq mini'; d.dataset.sala = s.id; capa.appendChild(d);
        room.etqAhora = {el: d, clave: ''};
      }
      if (room.stream) {
        const mini = () => { const d = document.createElement('div'); d.className = 'etq mini'; d.dataset.sala = s.id; capa.appendChild(d); return d; };
        room.etqSet = {brayan: mini(), clon: mini(), publico: mini(), zSeg: mini(), zNo: mini(), zFila: mini(), clave: ''};
      }
      room.agentes.forEach(A => {
        const b = document.createElement('div'); b.className = 'burbuja'; capa.appendChild(b); A.bub = b; A.bubMsg = '';
      });
    }
    for (const f of rt.futuras) {
      const el = document.createElement('div'); el.className = 'etq futura'; el.dataset.futura = f.j;
      el.innerHTML = `<span class="pt"></span><b>${esc(f.nombre)}</b><small>+ activar</small>`;
      capa.appendChild(el); f.etq = el;
    }
    const c = datos.salas.find(s => s.centro);
    hub.etq = document.createElement('div'); hub.etq.className = 'etq centro'; hub.etq.dataset.sala = 'cerebro';
    hub.etq.innerHTML = publico ? `<span class="pt" style="background:${c?.color}"></span><b>DURO CITY</b>`
      : `<span class="pt" style="background:${c?.color || '#3aa0ff'}"></span><b>Cerebro</b><small>${datos.notas.length} notas</small>`;
    capa.appendChild(hub.etq);
  }
  function ubicar(el, v, dy = 0) {
    tmpV.copy(v).project(camera);
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    el.style.transform = `translate(-50%,-100%) translate(${(tmpV.x + 1) / 2 * w}px,${(1 - tmpV.y) / 2 * h + dy}px)`;
  }

  // ---------- Cámara ----------
  const objetivo = {target: new THREE.Vector3(), zoom: 1, activo: false};
  function ajustarCamara() {
    const w = contenedor.clientWidth, h = contenedor.clientHeight, asp = w / h;
    const half = Math.max(rt.extent * 0.6, rt.extent * 1.0 / asp);
    controls.maxZoom = Math.max(18, rt.extent / 2);
    const sombra = rt.extent + 8;
    Object.assign(sol.shadow.camera, {left: -sombra, right: sombra, top: sombra, bottom: -sombra, far: sombra * 3});
    sol.position.set(sombra * 0.5, sombra, sombra * 0.25);
    sol.shadow.camera.updateProjectionMatrix();
    // Más espacio arriba para que los contadores no tapen las salas
    Object.assign(camera, {left: -half * asp, right: half * asp, top: half * 1.14, bottom: -half * 0.86});
    camera.updateProjectionMatrix();
    renderer.setSize(w, h); composer.setSize(w, h); bloom.setSize(w, h);
  }
  function enfocar(id) {
    if (id === null) { rt.foco = null; Object.assign(objetivo, {target: new THREE.Vector3(), zoom: 1, activo: true}); return; }
    const room = rt.rooms.get(id);
    const p = room ? room.g.position.clone().add(new THREE.Vector3(0, room.casa ? room.casa.PH * 3 : 1, 0)) : new THREE.Vector3(0, 2, 0);
    const L = room ? (room.casa ? room.geo.L + 8 : room.geo.L) : 9;
    rt.foco = id;
    // En pantallas anchas el panel ocupa la derecha: la sala tiene que caber en lo que queda y se corre hacia allá
    const w = contenedor.clientWidth, visible = w > 720 ? (w - Math.min(410, w * 0.45)) / w : 1;
    const zoom = THREE.MathUtils.clamp(rt.extent * visible / (L + 2), 1.6, 60);
    if (w > 720) {
      const anchoMundo = (camera.right - camera.left) / zoom;
      const derecha = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      p.add(derecha.multiplyScalar(anchoMundo * Math.min(410, w * 0.45) / 2 / w));
    }
    Object.assign(objetivo, {target: p, zoom, activo: true});
  }

  // ---------- Interacción ----------
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let abajo = null;
  function pickables() { return [...[...rt.rooms.values()].map(r => r.piso), ...rt.futuras.map(f => f.base), hub.clic]; }
  function tocar(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(mouse, camera);
    return ray.intersectObjects(pickables(), false)[0]?.object.userData;
  }
  renderer.domElement.addEventListener('pointerdown', e => { abajo = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!abajo || Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) > 6) return;
    const u = tocar(e);
    if (u?.sala) { enfocar(u.sala); alClicSala(u.sala); }
    else if (u?.futura !== undefined) alClicFutura(u.futura);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    const u = tocar(e);
    rt.hover = u?.sala ?? null;
    renderer.domElement.style.cursor = u ? 'pointer' : '';
  });
  capa.addEventListener('click', e => {
    const el = e.target.closest('.etq'); if (!el) return;
    if (el.dataset.futura !== undefined) alClicFutura(+el.dataset.futura);
    else { enfocar(el.dataset.sala); alClicSala(el.dataset.sala); }
  });
  addEventListener('resize', ajustarCamara);
  new ResizeObserver(ajustarCamara).observe(contenedor);

  // ---------- Comportamiento de los agentes ----------
  function mover(A, dt) {
    let paso = VEL * dt;
    while (A.path.length && paso > 0) {
      const p = A.path[0], dx = p.x - A.x, dz = p.z - A.z, dist = Math.hypot(dx, dz);
      if (dist < 1e-3) { A.path.shift(); continue; }
      A.rotObj = Math.atan2(dx, dz);
      const m = Math.min(paso, dist);
      A.x += dx / dist * m; A.z += dz / dist * m; paso -= m;
      if (m >= dist) A.path.shift();
    }
    return !A.path.length;
  }
  function elegirDestino(room, A) {
    const {cafe, planta, ventana} = room.geo;
    const otros = room.agentes.filter(o => o !== A && (o.modo === 'sentado' || o.modo === 'trabajando'));
    const op = [cafe, cafe, planta, ventana];
    // Con la súper oficina, los que no están haciendo nada pueden ir a la sala de reuniones que comparten los dos equipos
    const libres = (room.geo.reunion || []).map((r, i) => ({...r, silla: i})).filter(r => !rt.reunion.has(r.silla));
    if (libres.length) op.push(pick(libres), pick(libres), pick(libres));
    if (otros.length) { const o = pick(otros); op.push({x: o.silla.x + 0.65, z: o.silla.z, tag: 'charla', con: o}, {x: o.silla.x + 0.65, z: o.silla.z, tag: 'charla', con: o}); }
    const d = pick(op);
    return {...d, x: d.x + (d.tag === 'cafe' ? 0 : rand(-0.15, 0.15)), z: d.z + (d.tag === 'cafe' ? rand(0, 0.25) : 0)};
  }
  const ROT_VISITA = {cafe: Math.PI, ventana: -Math.PI / 2, planta: Math.PI / 2};

  function actualizarAgente(room, A, dt) {
    const geo = room.geo, tarea = tareaDe(A.key);
    const enSilla = Math.hypot(A.x - A.silla.x, A.z - A.silla.z) < 0.03 && !A.path.length;
    if (tarea && A.modo !== 'trabajando') {
      if (enSilla) { A.modo = 'trabajando'; A.rotObj = Math.PI; }
      else if (A.modo !== 'volviendo') { A.path = ruta(A, A.silla, geo); A.modo = 'volviendo'; }
    }
    if (!tarea && A.modo === 'trabajando') { A.modo = 'sentado'; A.timer = rand(2, 6); }
    // Al volver a su puesto (o si le llega una tarea) deja libre su silla en la sala de reuniones
    if (A.modo === 'volviendo' && A.destino?.tag === 'reunion' && rt.reunion.get(A.destino.silla) === A.key) rt.reunion.delete(A.destino.silla);
    switch (A.modo) {
      case 'sentado':
        A.timer -= dt;
        if (A.timer <= 0) {
          A.destino = elegirDestino(room, A); A.path = ruta(A, A.destino, geo); A.modo = 'caminando';
          if (A.destino.tag === 'reunion') rt.reunion.set(A.destino.silla, A.key);
        }
        break;
      case 'caminando':
        if (mover(A, dt)) {
          A.modo = 'visita'; A.timer = A.destino.tag === 'reunion' ? rand(8, 16) : rand(3, 7);
          const d = A.destino;
          const mira = d.tag === 'charla' ? d.con : d.tag === 'reunion' ? d.mira : d.tag === 'live' ? (room.stream?.mirar || room.red?.mirar) : null;
          A.rotObj = mira ? Math.atan2(mira.x - A.x, mira.z - A.z) : ROT_VISITA[d.tag] ?? A.rotObj;
        }
        break;
      case 'visita':
        A.timer -= dt;
        if (A.timer <= 0) { A.path = ruta(A, A.silla, geo); A.modo = 'volviendo'; }
        break;
      case 'volviendo':
        if (mover(A, dt)) { A.modo = tarea ? 'trabajando' : 'sentado'; A.rotObj = Math.PI; A.timer = rand(6, 15); }
        break;
      case 'trabajando':
        A.pk -= dt;
        if (A.pk <= 0) { lanzarPaquete(room); A.pk = rand(2.5, 5.5); }
        break;
    }

    // Pose
    const p = A.p, t = rt.t + A.fase;
    const andando = A.path.length > 0;
    const sentado = !andando && (A.modo === 'sentado' || A.modo === 'trabajando');
    let dRot = A.rotObj - A.rot; dRot = Math.atan2(Math.sin(dRot), Math.cos(dRot));
    A.rot += dRot * Math.min(1, dt * 10);
    p.raiz.position.set(A.x, geo.yPiso || 0, A.z);
    p.raiz.rotation.y = A.rot;
    if (andando) {
      const s = Math.sin(t * 9);
      p.cuerpo.position.y = Math.abs(Math.cos(t * 9)) * 0.06;
      p.pI.rotation.x = s * 0.6; p.pD.rotation.x = -s * 0.6;
      p.bI.rotation.x = -s * 0.5; p.bD.rotation.x = s * 0.5;
      p.cabeza.rotation.x = 0;
    } else if (sentado) {
      p.cuerpo.position.y = 0.04;
      p.pI.rotation.x = p.pD.rotation.x = -Math.PI / 2;
      if (A.modo === 'trabajando') {
        p.bI.rotation.x = -1.15 + Math.sin(t * 18) * 0.08; p.bD.rotation.x = -1.15 + Math.cos(t * 17) * 0.08;
        p.cabeza.rotation.x = 0.12 + Math.sin(t * 2) * 0.04;
      } else {
        const estira = Math.sin(t * 0.37) > 0.97;
        p.bI.rotation.x = p.bD.rotation.x = estira ? -2.8 : -0.3 + Math.sin(t * 1.6) * 0.03;
        p.cabeza.rotation.x = Math.sin(t * 0.8) * 0.05;
      }
    } else {
      p.cuerpo.position.y = Math.sin(t * 2.2) * 0.012;
      p.pI.rotation.x = p.pD.rotation.x = 0;
      p.bI.rotation.x = A.destino?.tag === 'cafe' ? -1.2 : Math.sin(t * 2) * 0.1;
      p.bD.rotation.x = A.destino?.tag === 'charla' ? -0.6 + Math.sin(t * 5) * 0.4 : Math.sin(t * 2 + 1) * 0.1;
      p.cabeza.rotation.x = 0;
    }

    // Monitor
    const pu = room.puestos[A.i];
    if (pu) pu.scr.material = A.modo === 'trabajando' ? room.pantallaOn : room.pantallaOff;

    // Burbuja
    let msg = '';
    if (A.modo === 'trabajando') msg = '⌨ ' + (tarea.length > 22 ? tarea.slice(0, 21) + '…' : tarea);
    else if (A.modo === 'visita') msg = {cafe: '☕', charla: '💬', planta: '🌱', ventana: '👀', live: '📺'}[A.destino?.tag] || '';
    if (A.bub) {
      if (msg !== A.bubMsg) { A.bubMsg = msg; A.bub.textContent = msg; A.bub.classList.toggle('on', !!msg); A.bub.classList.toggle('mini', A.modo !== 'trabajando'); }
      if (msg) ubicar(A.bub, tmpW.set(A.x, 1.95 + (geo.yPiso || 0), A.z).add(room.g.position), -4);
    }
  }
  const tmpW = new THREE.Vector3();

  function dibujarPantallaSala(room, ocupados) {
    if (room.stream) return dibujarLED(room, ocupados);
    if (room.s.tipo === 'red') return dibujarRed(room, ocupados);
    const x = room.cvP.getContext('2d'), w = 512, h = 200, c = room.s.color;
    x.fillStyle = '#0a0c1c'; x.fillRect(0, 0, w, h);
    x.fillStyle = c; x.font = '700 40px ui-monospace, Menlo, monospace'; x.textBaseline = 'top';
    x.fillText(room.s.nombre.toUpperCase().slice(0, 18), 24, 20);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '24px ui-monospace, Menlo, monospace';
    const hechas = room.s.tareas.filter(t => t.estado === 'hecho').length;
    if (!publico) x.fillText(`${hechas}/${room.s.tareas.length} tareas · ${ocupados} trabajando`, 24, 70);
    const n = 22;
    for (let k = 0; k < n; k++) {
      const v = ocupados ? 0.15 + Math.abs(Math.sin(rt.t * (2.4 + k * 0.37) + k)) * 0.85 : 0.08;
      x.fillStyle = ocupados ? c : 'rgba(255,255,255,.15)';
      x.fillRect(24 + k * 21, h - 18 - v * 70, 14, v * 70);
    }
    room.tP.needsUpdate = true;
  }
  // Pantalla LED gigante del estudio: visualizador, vinilo girando y la canción a la que reaccionas
  function dibujarLED(room, ocupados) {
    const x = room.cvP.getContext('2d'), w = room.cvP.width, h = room.cvP.height, c = room.s.color, S = room.stream;
    const st = room.s.streamer || {}, vivo = !!st.enVivo, stats = room.s.stats || {};
    const fondo = x.createLinearGradient(0, 0, w, h);
    fondo.addColorStop(0, '#16061f'); fondo.addColorStop(0.6, '#07040f'); fondo.addColorStop(1, '#03111a');
    x.fillStyle = fondo; x.fillRect(0, 0, w, h);
    x.textBaseline = 'top'; x.textAlign = 'left';
    const fase = rt.t * 96 / 60, pulso = vivo ? (1 - (fase % 1)) ** 3 : 0;

    // Visualizador circular con vinilo al centro
    const cx = 200, cy = 200, r0 = 92;
    for (let k = 0; k < 64; k++) {
      const a = k / 64 * Math.PI * 2;
      const v = vivo ? 0.2 + Math.abs(Math.sin(rt.t * (2 + (k % 7) * 0.45) + k * 0.6)) * 0.8 * (0.7 + pulso * 0.5) : 0.08;
      x.strokeStyle = k % 2 ? c : '#38e8ff'; x.lineWidth = 6; x.globalAlpha = vivo ? 0.95 : 0.35;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * (r0 + 6), cy + Math.sin(a) * (r0 + 6));
      x.lineTo(cx + Math.cos(a) * (r0 + 6 + v * 70), cy + Math.sin(a) * (r0 + 6 + v * 70)); x.stroke();
    }
    x.globalAlpha = 1;
    x.save(); x.translate(cx, cy); x.rotate(vivo ? rt.t * 3.4 : 0);
    x.fillStyle = '#0a0a0e'; x.beginPath(); x.arc(0, 0, r0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 2;
    for (let rr = 30; rr < r0; rr += 8) { x.beginPath(); x.arc(0, 0, rr, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = c; x.beginPath(); x.arc(0, 0, 28, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#0a0a0e'; x.font = '800 15px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('DURO', 0, 0);
    x.restore();
    x.textAlign = 'left'; x.textBaseline = 'top';

    // Texto
    const tx = 400;
    if (vivo) {
      if (Math.sin(rt.t * 5) > -0.3) { x.fillStyle = '#ff2a2a'; x.beginPath(); x.arc(tx + 14, 52, 14, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#fff'; x.font = '800 40px ui-monospace, Menlo, monospace'; x.fillText('EN VIVO', tx + 40, 32);
      x.fillStyle = '#38e8ff'; x.font = '700 24px ui-monospace, Menlo, monospace'; x.fillText('REACCIONANDO A', tx, 104);
      const cancion = (st.reaccion || 'Lo que pida el público').toUpperCase();
      x.fillStyle = '#ffffff'; x.font = '800 54px ui-monospace, Menlo, monospace';
      x.fillText(cancion.length > 18 ? cancion.slice(0, 17) + '…' : cancion, tx, 136);
      x.font = '600 30px ui-monospace, Menlo, monospace'; x.fillStyle = '#ffb3c6';
      x.fillText(`👥 ${S.conectados}/${S.aforo}   ❤ ${S.corazones.toLocaleString('es-CO')}   😎 ${S.regalos}`, tx, 214);
    } else {
      x.fillStyle = c; x.font = '800 64px ui-monospace, Menlo, monospace'; x.fillText('DURO LIVE', tx, 34);
      x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '700 28px ui-monospace, Menlo, monospace'; x.fillText('○ FUERA DEL AIRE', tx, 116);
      x.font = '26px ui-monospace, Menlo, monospace';
      if (publico) x.fillText('Síguelo en TikTok: @duroconbrayan', tx, 168);
      else {
        // Lo mismo que muestra la app DURO Live: el último LIVE y el mes
        const A = room.s.appStats?.actual, ul = room.s.liveStats?.ultimo;
        x.fillText(ul ? `Último: LIVE #${ul.numero} · $${ul.usd.toFixed(2)} · +${ul.seguidores} seguidores` : 'Sin directos aún: arranca tu próximo LIVE', tx, 168);
        x.fillStyle = 'rgba(255,255,255,.38)';
        x.fillText(`${A?.directos ?? 0} directos · $${Number(A?.total ?? 0).toFixed(2)} este mes · mejor hora ${A?.mejor_hora || '—'}`, tx, 206);
      }
    }
    // Onda de audio abajo
    x.strokeStyle = c; x.lineWidth = 4; x.globalAlpha = vivo ? 0.9 : 0.3; x.beginPath();
    for (let px = tx; px < w - 30; px += 6) {
      const a = vivo ? Math.sin(px * 0.045 + rt.t * 9) * Math.sin(px * 0.011 + rt.t * 2) * (22 + pulso * 26) : Math.sin(px * 0.05) * 3;
      px === tx ? x.moveTo(px, 330 + a) : x.lineTo(px, 330 + a);
    }
    x.stroke(); x.globalAlpha = 1;

    if (S.flash > 0) {
      x.fillStyle = `rgba(255,194,26,${Math.min(1, S.flash)})`; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1a1300'; x.font = '800 110px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('😎 ¡GAFAS!', w / 2, h / 2); x.textAlign = 'left'; x.textBaseline = 'top';
    }
    room.tP.needsUpdate = true;
  }

  function dibujarCodigo(room) {
    const x = room.cvC.getContext('2d'), c = room.s.color;
    x.fillStyle = '#0b0e1e'; x.fillRect(0, 0, 128, 80);
    for (let k = 0; k < 7; k++) {
      x.fillStyle = k % 3 === 0 ? c : k % 3 === 1 ? '#e8ecff' : '#7d88c9';
      x.fillRect(8 + (k % 2) * 10, 6 + k * 10, rand(20, 90), 4);
    }
    room.tC.needsUpdate = true;
  }

  // ---------- Animación del set de stream ----------
  function actualizarSet(room, dt) {
    const S = room.stream, st = room.s.streamer || {}, vivo = !!st.enVivo, t = rt.t;
    const b = S.brayan;
    // Brayan solo está en la arena cuando sale en vivo; el resto del tiempo está en su casa
    b.raiz.visible = vivo;
    if (vivo) {
      // Habla con el público: gesticula y mueve la cabeza
      b.bI.rotation.x = -0.75 + Math.sin(t * 2.6) * 0.45; b.bD.rotation.x = -0.95 + Math.sin(t * 3.1 + 1) * 0.5;
      b.cabeza.rotation.y = Math.sin(t * 0.9) * 0.35; b.cabeza.rotation.x = Math.sin(t * 7) * 0.04;
      b.cuerpo.position.y = 0.04 + Math.abs(Math.sin(t * 4)) * 0.015;
    } else {
      b.bI.rotation.x = b.bD.rotation.x = -1.1 + Math.sin(t * 1.3) * 0.05;
      b.cabeza.rotation.y = Math.sin(t * 0.4) * 0.15; b.cabeza.rotation.x = 0.18;
      b.cuerpo.position.y = 0.04;
    }
    S.tally.material.color.set(vivo && Math.sin(t * 4) > -0.6 ? '#ff2a2a' : '#330a0a');
    S.luzRing.intensity = vivo ? 5 : 0;
    S.aro.material.color.set(vivo ? '#fff6e8' : '#5a5650');

    // Ritmo: 96 BPM mientras suena la música
    const fase = t * 96 / 60, golpe = Math.floor(fase), caida = 1 - (fase % 1);
    const nuevoGolpe = vivo && golpe !== S.beat;
    S.beat = golpe;
    const pulso = vivo ? caida ** 3 : 0;
    // Neones: laten con el ritmo en vivo, respiran suave fuera del aire
    S.neones.forEach((m, i) => m.color.copy(m.userData.base).multiplyScalar(vivo ? 0.55 + pulso * 0.7 : 0.45 + Math.sin(t * 0.8 + i) * 0.08));
    S.onAir.material.color.set(vivo ? (Math.sin(t * 3) > -0.8 ? '#ffffff' : '#ff9a9a') : '#3a2a2a');
    for (const w of S.woofers) { const k = 1 + pulso * 0.18; w.scale.set(0.16 * k, 0.05, 0.16 * k); }
    if (nuevoGolpe) {
      const paleta = ['#ff3d6e', '#38e8ff', '#a855f7', '#ffc21a', '#3ddc84'];
      for (const p of S.pads) p.material.color.set(Math.random() < 0.45 ? pick(paleta) : '#1b1a2a');
      const o = S.ondas.find(o => o.t >= 1); if (o) o.t = 0;
    }
    if (!vivo) for (const p of S.pads) p.material.color.set('#1b1a2a');
    for (const o of S.ondas) {
      if (o.t < 1) o.t = Math.min(1, o.t + dt * 0.7);
      o.o.scale.setScalar(o.r0 + o.t * 3.2);
      o.o.material.opacity = o.t < 1 ? (1 - o.t) * 0.8 : 0;
    }
    // Reflectores: barren el escenario cuando estás en vivo
    for (const c of S.conos) {
      const destino = tmpW.copy(S.objetivoLuz).add(new THREE.Vector3(Math.sin(t * 0.7 + c.fase) * 1.4, 0, Math.cos(t * 0.5 + c.fase) * 0.9));
      const dir = destino.sub(c.base).normalize();
      c.cono.quaternion.setFromUnitVectors(ABAJO, dir);
      c.cono.material.opacity = vivo ? 0.035 + pulso * 0.04 : 0;
    }

    // Brayan IA: más sólido a medida que avanza el proyecto del clon
    const op = {planeado: 0.12, desarrollo: 0.3, activo: 0.55}[st.clon || 'planeado'];
    S.matHolo.opacity = op * (0.8 + Math.random() * 0.2);
    S.haz.material.opacity = op * 0.25;
    S.proyector.material.opacity = 0.25 + op;
    const c = S.clon;
    c.raiz.position.y = Math.sin(t * 1.5) * 0.03;
    c.pI.rotation.x = c.pD.rotation.x = 0;
    if (st.clon === 'activo' && vivo) { c.bI.rotation.x = b.bI.rotation.x; c.bD.rotation.x = b.bD.rotation.x; c.cabeza.rotation.y = -b.cabeza.rotation.y; }
    else { c.bI.rotation.x = Math.sin(t * 1.2) * 0.08; c.bD.rotation.x = -Math.sin(t * 1.2) * 0.08; c.cabeza.rotation.y = Math.sin(t * 0.5) * 0.3; }

    // Público: en vivo entra la gente que sueles tener conectada a esta hora de Colombia (simulado hasta conectar DURO LIVE).
    // Primero se llena la pista; los que no caben suben a las gradas.
    // Cada persona entra por la puerta y camina a su silla; cuando se desconecta, sale por el mismo camino.
    S.cAforo -= dt;
    if (S.cAforo <= 0) {
      // Si la app DURO Live está mandando sus muestras, entra la gente real; si no, se simula con tu promedio por hora
      const real = room.s.auto?.ok ? room.s.auto.conectados : null;
      // En la versión pública solo entra gente real: nada simulado
      const esperado = real ?? (publico ? 0 : conectadosEsperados(room.s, horaColombia()) + rand(-1.5, 1.5));
      S.objetivo = vivo ? Math.round(THREE.MathUtils.clamp(esperado, real == null ? 1 : 0, S.aforo + S.gradasN)) : 0;
      S.cAforo = vivo ? rand(6, 12) : 1;
      // Simulado: 30 % seguidores, 20 % nuevos y el resto de paso
      if (room.s.auto?.ok == null) {
        const fila = Math.min(Math.round(S.objetivo * 0.3), 2 + Math.round(rand(0, 4)));
        const seg = Math.round(S.objetivo * 0.3) - fila, nue = Math.round(S.objetivo * 0.2);
        S.mezcla = {seg, nue, paso: Math.max(0, S.objetivo - seg - nue - fila), conv: S.convSim, fila, filaMeta: fila, canciones: fila + Math.round(rand(0, 2))};
      }
    }
    // Quiénes son de verdad (app DURO Live): seguidores (vienen del parque de TikTok), nuevos que interactúan (salen del portal) y los de paso
    const A = room.s.auto;
    if (A?.ok && A.seguidoresVivo != null) S.mezcla = {seg: A.seguidoresVivo, nue: A.nuevosVivo || 0, paso: A.dePaso || 0, conv: A.nuevosSeguidores ?? null};
    else if (A?.ok) S.mezcla = {seg: S.objetivo, nue: 0, paso: 0, conv: null};   // app vieja: sin el desglose
    if (A?.ok) Object.assign(S.mezcla, {fila: A.enFila || 0, canciones: A.cancionesFila || 0, filaLista: A.filaLista || null});
    if (!vivo) S.mezcla = {seg: 0, nue: 0, paso: 0, conv: S.mezcla.conv, fila: 0, canciones: 0};
    // Los de la fila son seguidores, pero la app ya los descuenta (persona por persona): seg son solo los de la pista
    const enFila = Math.min(S.mezcla.fila || 0, S.fila ? S.fila.gente.length : 0);
    const segPista = S.mezcla.seg;
    // Simulación: de vez en cuando alguien nuevo te empieza a seguir
    if (vivo && room.s.auto?.ok == null && !publico) {
      S.cConv -= dt;
      if (S.cConv <= 0) { S.cConv = rand(18, 40); if (S.personas.some(p => p.tipo === 'nue' && p.estado === 'sentado')) S.mezcla.conv = ++S.convSim; }
    }
    // Te empezaron a seguir: los nuevos saltan al lado de los seguidores con un destello
    const conv = S.mezcla.conv;
    if (conv == null || S.convVistos == null || conv < S.convVistos) S.convVistos = conv;
    else if (conv > S.convVistos) {
      const p = S.personas.find(p => p.tipo === 'nue' && p.estado === 'sentado');
      if (p) {
        S.convVistos++;
        p.tipo = 'seg'; p.pre = S.rutaSalida(); p.origen = null;
        const nueva = S.ordenLado[0].find(i => !S.ocupadas.has(i));
        destello(S, S.lugares[p.asiento]);
        if (nueva !== undefined) { S.ocupadas.delete(p.asiento); S.ocupadas.add(nueva); p.de = p.asiento; p.asiento = nueva; p.u = 0; p.estado = 'cambiando'; }
        else p.d = S.lugares[p.asiento].largos.at(-1) + (p.pre?.largo || 0);
      } else S.convVistos = conv;   // no hay nuevos sentados para animar
    }
    const capLado = l => S.ordenLado[l].length;
    S.cEntrada = (S.cEntrada ?? 0) - dt;
    if (S.cEntrada <= 0) {
      S.cEntrada = vivo ? 0.3 : 0.06;
      for (const [tipo, lado] of [['seg', 0], ['nue', 1]]) {
        const quiero = Math.min(tipo === 'seg' ? segPista : S.mezcla.nue, capLado(lado));
        const hay = S.personas.filter(p => (p.tipo || 'seg') === tipo && p.estado !== 'saliendo').length;
        if (hay < quiero) {
          // La siguiente silla libre de su lado, en el orden simétrico
          const asiento = S.ordenLado[lado].find(i => !S.ocupadas.has(i));
          if (asiento === undefined) continue;
          const p = {asiento, c: asiento, d: 0, estado: 'entrando', tipo};
          if (tipo === 'seg') {
            // Tus seguidores salen del parque de TikTok (que queda al lado) y caminan hasta la entrada de la arena
            const pre = vivo ? caminoDesdeTikTok(room, S.lugares[asiento].pts[0]) : null;
            if (pre) Object.assign(p, {pre: pre.ruta, origen: pre.origen});
          } else p.pre = S.rutaNuevos();
          S.ocupadas.add(asiento); S.personas.push(p); S.entradas++; contarEntrada(room.s.id);
        } else if (hay > quiero) {
          // Sale el último que entró de ese tipo (así cada lado se vacía parejo)
          const p = [...S.personas].reverse().find(p => (p.tipo || 'seg') === tipo && p.estado !== 'saliendo' && p.estado !== 'cambiando');
          if (!p) continue;
          const largoSilla = S.lugares[p.asiento].largos.at(-1), pre0 = p.pre?.largo || 0;
          // Los nuevos que nunca te siguieron se van por el portal de salida
          if (tipo === 'nue' && p.d >= pre0) { p.pre = S.rutaSalida(); p.d = p.d - pre0 + p.pre.largo; }
          p.estado = 'saliendo'; p.d = Math.min(p.d, largoSilla + (p.pre?.largo || 0));
        }
      }
    }
    const {piernas, cuerpos, cabezas, pelos, celulares} = S.inst, m4 = S.m4, v = S.v, sc = S.sc, q2 = S.q2;
    let j = 0, nCel = 0;
    S.personas = S.personas.filter(p => {
      const L_ = S.lugares[p.asiento], pre = p.pre?.largo || 0, total = pre + L_.largos.at(-1), col = S.lugares[p.c ?? p.asiento];
      // Los que vienen desde TikTok caminan más rápido (el trayecto es largo)
      const vel = p.d < pre ? Math.max(4.5, pre / 12) : 2.2;
      if (p.estado === 'entrando') { p.d += dt * vel; if (p.d >= total) { p.d = total; p.estado = 'sentado'; } }
      else if (p.estado === 'saliendo') { p.d -= dt * (p.d < pre ? Math.max(4.5, pre / 12) : 2.6); if (p.d <= 0) { S.ocupadas.delete(p.asiento); devolverATikTok(p); return false; } }
      // Posición sobre el camino: primero el trayecto desde TikTok, luego el de la arena
      let a, b;
      if (p.estado === 'cambiando') {
        // Salta por el aire desde su silla de nuevo hasta su silla de seguidor
        p.u = Math.min(1, p.u + dt / 1.5);
        const D = S.lugares[p.de], e_ = p.u * p.u * (3 - 2 * p.u);
        v.set(D.x + (L_.x - D.x) * e_, D.base + (L_.base - D.base) * e_ + Math.sin(Math.PI * p.u) * 2.4, D.z + (L_.z - D.z) * e_);
        a = D; b = L_;
        if (p.u >= 1) { p.estado = 'sentado'; p.d = total; destello(S, L_); }
      } else if (p.d < pre) { const r_ = enRuta(p.pre, p.d / pre); v.set(r_.x, r_.y, r_.z); a = {x: 0, z: 0}; b = {x: r_.dx, z: r_.dz}; }
      else {
        const d_ = p.d - pre;
        let k = 1; while (k < L_.largos.length - 1 && L_.largos[k] < d_) k++;
        a = L_.pts[k - 1]; b = L_.pts[k];
        const u = (d_ - L_.largos[k - 1]) / Math.max(1e-6, L_.largos[k] - L_.largos[k - 1]);
        v.lerpVectors(a, b, THREE.MathUtils.clamp(u, 0, 1));
      }
      const sentado = p.estado === 'sentado';
      let rot = L_.hacia, y = v.y;
      if (!sentado) {
        rot = Math.atan2(b.x - a.x, b.z - a.z) + (p.estado === 'saliendo' ? Math.PI : 0);
        y += Math.abs(Math.sin(t * 9 + L_.fase)) * 0.05;
      } else {
        // En su puesto, de pie como en un concierto; la mitad salta con el ritmo
        const salta = vivo && (j % 2 === golpe % 2);
        y += salta ? pulso * 0.12 : 0;
      }
      q2.setFromAxisAngle(ARRIBA, rot);
      const x = v.x, z = v.z;
      piernas.setMatrixAt(j, m4.compose(v.set(x, y + 0.21, z), q2, sc.set(0.24, 0.42, 0.15)));
      cuerpos.setMatrixAt(j, m4.compose(v.set(x, y + 0.6, z), q2, sc.set(0.7, 0.6, 0.66)));
      cabezas.setMatrixAt(j, m4.compose(v.set(x, y + 0.93, z), q2, sc.setScalar(0.15)));
      pelos.setMatrixAt(j, m4.compose(v.set(x, y + 0.945, z), q2, sc.setScalar(0.16)));
      piernas.setColorAt(j, col.pantalon); cuerpos.setColorAt(j, p.tipo === 'nue' ? col.cuerpoNo : col.cuerpoSeg); cabezas.setColorAt(j, col.piel); pelos.setColorAt(j, col.pelo);
      if (sentado && vivo) {
        // Celular levantado frente a la cara, hacia el escenario
        const dx = Math.sin(rot), dz = Math.cos(rot);
        celulares.setMatrixAt(nCel++, m4.compose(v.set(x + dx * 0.16 + dz * 0.12, y + 1.25, z + dz * 0.16 - dx * 0.12), q2, sc.set(0.09, 0.15, 1)));
      }
      j++;
      return true;
    });
    for (const im of [piernas, cuerpos, cabezas, pelos]) { im.count = j; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    celulares.count = nCel; celulares.instanceMatrix.needsUpdate = true;
    S.sentados = S.personas.filter(p => p.estado === 'sentado').length;
    // Gradas: la gente conectada que ya no cabe en la pista (también vienen desde el parque de TikTok)
    if (S.gradas && !S.gradas.alEntrar) {
      S.gradas.alEntrar = q => {
        const asiento = S.gradas.gente[q.k], ent = geoEntrada(room);
        const pre = caminoDesdeTikTok(room, ent);
        if (pre) { q.ruta = ruta3D([...pre.ruta.puntos, {x: asiento.x, y: asiento.y, z: asiento.z}]); q.origen = pre.origen; }
      };
      S.gradas.alSalir = devolverATikTok;
    }
    const capPaso = S.paso ? S.paso.gente.length : 0;
    const sobran = Math.max(0, segPista - capLado(0)) + Math.max(0, (S.mezcla.fila || 0) - enFila) + Math.max(0, S.mezcla.nue - capLado(1)) + Math.max(0, S.mezcla.paso - capPaso);
    if (S.gradas) moverMultitud(S.gradas, vivo ? Math.min(sobran, S.gradasN) : 0, dt, room.s.id, false);
    S.enGradas = S.gradas ? S.gradas.personas.filter(p => p.estado === 'quieto').length : 0;
    if (S.paso) moverMultitud(S.paso, vivo ? Math.min(S.mezcla.paso, capPaso) : 0, dt, room.s.id, false);
    S.dePaso = S.paso ? S.paso.personas.filter(p => p.estado === 'quieto').length : 0;
    // La fila: llegan desde el parque de TikTok y hacen fila por el pasillo hasta el escenario
    if (S.fila) actualizarFila(room, S, vivo, dt, t);
    S.enFila = S.fila ? S.fila.personas.filter(p => p.estado !== 'saliendo').length : 0;
    S.conectados = S.sentados + S.enGradas + S.dePaso + S.enFila;
    // La bóveda sigue a la app DURO Live: si cambian los números, se redibuja el tablero
    if (S.boveda) { const u = numerosBoveda(room.s), k = JSON.stringify(u); if (k !== S.boveda.clave) { S.boveda.clave = k; S.boveda.actualizar(u); } }
    // Salón de la fama, meta, taquilla: se redibujan cuando la app cambia algo
    if (S.estructuras) {
      const E = room.s.extra, k = JSON.stringify(E && {f: E.fama, m: E.meta, q: E.misiones});
      if (k !== S.claveEstructuras) { S.claveEstructuras = k; S.estructuras.actualizar(E); }
      S.estructuras.tick(dt, t);
      // Misiones aprobadas hace poco: una persona sale de la taquilla y camina hasta la sala de esa red
      const recientes = E?.recientes || [];
      if (!S.misionesVistas) S.misionesVistas = new Set(recientes.map(m => m.id));
      for (const m of recientes) if (!S.misionesVistas.has(m.id)) { S.misionesVistas.add(m.id); lanzarCaminante(room, m.accion); }
    }
    // Portales: laten mientras estás en vivo
    for (const [i, P_] of (S.portales || []).entries()) {
      P_.disco.opacity = vivo ? 0.3 + Math.sin(t * 3 + i * 2) * 0.12 : 0.08;
      P_.aro.rotation.z += dt * (vivo ? 0.8 : 0.15) * (i ? -1 : 1); P_.luz.intensity = vivo ? 3 : 0.4;
    }
    for (const d of S.destellos) {
      if (d.t >= 1) { d.o.visible = false; continue; }
      d.t = Math.min(1, d.t + dt / 0.9);
      d.o.visible = true; d.o.scale.setScalar(0.2 + d.t * 1.6); d.o.material.opacity = (1 - d.t) * 0.9;
    }
    // Luces de los racks y de la bóveda
    for (const a of S.parqueAnim || []) a.obj.rotation[a.eje] += dt * a.vel;   // atracciones del parque de DURO LIVE
    for (const l of S.leds) l.m.color.copy(l.m.userData.base).multiplyScalar(0.55 + 0.45 * Math.abs(Math.sin(t * l.vel + l.fase)));
    if (vivo && S.conectados > 0) {
      // Más gente, más corazones; los regalos siguen tu ingreso por hora
      S.cCorazon = (S.cCorazon ?? 0) - dt;
      if (S.cCorazon <= 0) { lanzarParticula(S, S.matCorazon, 0.32, false); S.corazones += Math.floor(rand(3, 14)); S.cCorazon = rand(0.6, 1.6) / Math.sqrt(S.conectados); }
      S.cRegalo = (S.cRegalo ?? 3) - dt;
      const porHora = room.s.stats?.ingresoHora || 1;
      if (S.cRegalo <= 0) { lanzarParticula(S, S.matGafas, 0.6, true); S.cRegalo = THREE.MathUtils.clamp(14 / porHora, 3, 20) * rand(0.6, 1.4); }
    }
    S.flash = Math.max(0, S.flash - dt);
    S.particulas = S.particulas.filter(p => {
      p.t += dt / p.vida;
      if (p.t >= 1) {
        room.g.remove(p.s); p.s.material.dispose();
        if (p.regalo) { S.regalos++; S.flash = 1.6; }
        return false;
      }
      if (p.regalo) p.s.position.lerpVectors(p.desde, S.marcas.brayan, p.t).y += Math.sin(Math.PI * p.t) * 1.2;
      else {
        // Suben y se van acercando al escenario
        const hacia = tmpW.copy(S.centro).sub(p.s.position).setY(0).normalize();
        p.s.position.addScaledVector(hacia, dt * 0.45); p.s.position.y += dt * 0.9; p.s.position.x += Math.sin(t * 3 + p.fase) * dt * 0.15;
      }
      p.s.material.opacity = p.t < 0.15 ? p.t / 0.15 : 1 - Math.max(0, p.t - 0.6) / 0.4;
      return true;
    });

    // Etiquetas dentro del set
    const e = room.etqSet;
    if (e) {
      const stats = room.s.stats || {};
      const M_ = S.mezcla, clave = `${vivo}|${st.clon}|${S.conectados}|${S.entradas}|${M_.seg}|${M_.nue}|${M_.paso}|${M_.conv}|${M_.fila}|${M_.canciones}|${JSON.stringify(S.filaCuenta || {})}`;
      if (e.clave !== clave) {
        e.clave = clave;
        e.brayan.innerHTML = `<b>Brayan Trampa</b>${vivo ? '<em class="rojo">● EN VIVO</em>' : '<small>en el Edificio DURO</small>'}`;
        e.clon.innerHTML = `<b>Brayan IA</b><small>${{planeado: 'planeado', desarrollo: 'en desarrollo', activo: 'activo'}[st.clon || 'planeado']}</small>`;
        e.publico.innerHTML = vivo
          ? `<b>👥 ${S.conectados.toLocaleString('es-CO')} conectados ahora</b><small>💗 ${M_.seg} te siguen · 🎵 ${M_.fila || 0} en la fila · 👀 ${M_.nue + M_.paso} no te siguen${M_.conv ? ` · +${M_.conv} te siguieron` : ''}</small><small>pista ${S.sentados}/${S.aforo} · gradas ${S.enGradas.toLocaleString('es-CO')} · ${S.entradas} entradas</small>`
          : `<b>🏟️ ${(S.aforo + S.gradasN).toLocaleString('es-CO')} lugares</b><small>${S.conectados ? `saliendo… ${S.conectados}` : 'vacío: se llena con la gente que entra en vivo'}</small>`;
        // Las tres zonas del público, cada una con su cuenta
        e.zSeg.innerHTML = `<b style="color:#ff6f9a">💗 TE SIGUEN</b><small>${M_.seg} en la pista</small>`;
        e.zNo.innerHTML = `<b style="color:#aab6d3">👀 NO TE SIGUEN</b><small>✨ ${M_.nue} interactúan · 👣 ${M_.paso} de paso</small>`;
        const fc = S.filaCuenta || {a: 0, e: 0, i: 0};
        e.zFila.innerHTML = `<b style="color:#ffc21a">🎵 FILA DE CANCIONES</b><small>${M_.fila || 0} seguidores · ${M_.canciones || 0} canciones</small>`
          + `<small>👆 ${fc.a} dando tap tap · <span style="color:#ff9a3d">⏳ ${fc.e} por vencer</span> · 🎡 ${fc.i} en el parque</small>`;
      }
      // Solo se muestran al entrar a la sala, para no llenar el mapa general de texto
      const dentro = rt.foco === room.s.id;
      for (const el of [e.brayan, e.clon, e.publico]) el.style.display = dentro ? '' : 'none';
      for (const el of [e.zSeg, e.zNo, e.zFila]) el.style.display = dentro && vivo ? '' : 'none';
      ubicar(e.brayan, tmpW.copy(S.marcas.etqBrayan).add(room.g.position), -4);
      ubicar(e.clon, tmpW.copy(S.marcas.clon).add(room.g.position), -4);
      ubicar(e.publico, tmpW.copy(S.marcas.publico).add(room.g.position));
      ubicar(e.zSeg, tmpW.copy(S.marcas.zonaSeg).add(room.g.position));
      ubicar(e.zNo, tmpW.copy(S.marcas.zonaNo).add(room.g.position));
      ubicar(e.zFila, tmpW.copy(S.marcas.zonaFila).add(room.g.position));
    }
    return vivo;
  }

  // La fila de canciones: cada persona tiene su puesto en el pasillo (el #1 pegado al escenario).
  // Mientras da tap tap se queda en su puesto; si su canción está por vencer, su camiseta parpadea en naranja;
  // si se inactiva (dejó de dar tap tap) se va a jugar al parque de DURO LIVE, y cuando vuelve a dar tap tap
  // regresa a su puesto. Cada persona se reconoce por un número (filaLista), así la fila puede avanzar.
  const NARANJA = new THREE.Color('#ff7a1a'), APAGADO = new THREE.Color('#5a3a10');
  function actualizarFila(room, S, vivo, dt, t) {
    const F = S.fila, geo = room.geo.stream, ent = geoEntrada(room), esq = geo.parque?.esquina, juegos = geo.parque?.atracciones || [];
    if (!F.jugar) {
      F.iniciada = true;   // las personas las maneja esta función, no moverMultitud
      F.alSalir = devolverATikTok;
      // Jugando: da vueltas alrededor de una atracción del parque
      F.jugar = (p, t_) => {
        const a = juegos[p.juego], R = a.r + 0.7;
        const J_ = S.juegosLive?.[p.juego];
        if (J_) {
          if (p.asiento && p.asiento.p !== p && t_ < p.asiento.hasta) p.asiento = null;
          p.asiento ||= J_.asientos.find(A_ => !A_.p || t_ > A_.hasta);
          if (p.asiento) { p.asiento.p = p; p.asiento.hasta = t_ + 1; return enAsiento(p.asiento, room.g, a); }
        }
        if (p.t0 == null) p.t0 = t_;
        const ang = p.ang0 + (t_ - p.t0) * 0.45;
        return {x: a.x + Math.cos(ang) * R, z: a.z + Math.sin(ang) * R, rot: Math.atan2(-Math.sin(ang), Math.cos(ang))};
      };
    }
    // Simulación (oficina sin la app): la fila va cambiando sola para ver todo funcionando
    if (room.s.auto?.ok == null && vivo && !publico) {
      S.simFila ||= []; S.cSimFila = (S.cSimFila ?? 0) - dt;
      if (S.cSimFila <= 0) {
        S.cSimFila = rand(3, 6);
        const meta = S.mezcla.filaMeta || 0;
        if (S.simFila.length < meta) S.simFila.push({id: `s${S.simId = (S.simId || 0) + 1}`, e: 'a'});
        else if (S.simFila.length > meta) S.simFila.pop();
        else if (S.simFila.length && Math.random() < 0.2) S.simFila.shift();   // sonó la primera canción
        else if (S.simFila.length) { const l = pick(S.simFila); l.e = {a: 'e', e: 'i', i: 'a'}[l.e]; }
      }
      S.mezcla.filaLista = S.simFila;
    }
    const lista = vivo ? (S.mezcla.filaLista || Array.from({length: S.mezcla.fila || 0}, (_, i) => ({id: `n${i}`, e: 'a'}))).slice(0, F.gente.length) : [];
    S.mezcla.fila = lista.length;
    S.filaCuenta = {a: 0, e: 0, i: 0};
    for (const l of lista) S.filaCuenta[l.e]++;
    const punto = (x, z) => ({x, y: 0, z});
    const puesto = k => punto(F.gente[k].x, F.gente[k].z);
    const aqui = p => punto(p.px ?? F.gente[p.k].x, p.pz ?? F.gente[p.k].z);
    const vaAlParque = p => p.estado === 'jugando' || p.alLlegar === 'jugando';
    const caminar = (p, pts, alLlegar = null) => { p.ruta = ruta3D(pts); p.u = 0; p.estado = 'entrando'; p.alLlegar = alLlegar; p.t0 = null; };
    const vivos = new Map(F.personas.filter(p => p.estado !== 'saliendo').map(p => [p.id, p]));
    const ids = new Set(lista.map(l => l.id));
    // Los que salieron de la fila (su canción ya sonó o la quitaron) vuelven al parque de TikTok
    for (const p of vivos.values()) if (!ids.has(p.id)) {
      const desde = vaAlParque(p) ? [] : [punto(ent.x, ent.z)];
      const haciaTikTok = caminoPuerta(room)?.map(v => ({x: v.x, y: v.y, z: v.z})) || (esq ? [punto(esq.x, esq.z)] : []);
      p.ruta = ruta3D([...haciaTikTok, ...desde, aqui(p)]); p.u = 1; p.estado = 'saliendo'; p.alLlegar = null;
    }
    lista.forEach((l, i) => {
      let p = vivos.get(l.id);
      if (!p) {
        // Nuevo en la fila: sale del parque de TikTok y camina hasta su puesto
        p = {k: i, id: l.id, estado: 'entrando', u: 0, juego: juegos.length ? hash(String(l.id)) % juegos.length : 0, ang0: rand(0, 6.28)};
        const pre = caminoDesdeTikTok(room, new THREE.Vector3(F.gente[i].x, 0, F.gente[i].z));
        if (pre) { p.ruta = pre.ruta; p.origen = pre.origen; } else p.ruta = ruta3D([punto(ent.x, ent.z), puesto(i)]);
        F.personas.push(p); contarEntrada(room.s.id);
      }
      const parque = vaAlParque(p);
      if (l.e === 'i' && !parque && juegos.length) {
        // Dejó de dar tap tap: se va a jugar al parque
        const a = juegos[p.juego], R = a.r + 0.7;
        caminar(p, [aqui(p), punto(ent.x, ent.z), punto(a.x + Math.cos(p.ang0) * R, a.z + Math.sin(p.ang0) * R)], 'jugando');
      } else if (l.e !== 'i' && parque) {
        // Volvió a dar tap tap: regresa a su puesto
        p.k = i; p.ang0 += (t - (p.t0 ?? t)) * 0.45;
        caminar(p, [aqui(p), punto(ent.x, ent.z), puesto(i)]);
      } else if (p.k !== i) {
        // La fila avanzó: pasa al puesto de adelante
        p.k = i;
        if (!parque && p.estado === 'quieto') caminar(p, [aqui(p), puesto(i)]);
        else if (!parque && p.ruta) {
          // Todavía viene caminando: alarga su camino hasta el puesto nuevo sin que pegue un salto
          const largo0 = p.ruta.largo; p.ruta = ruta3D([...p.ruta.puntos, puesto(i)]); p.u *= largo0 / p.ruta.largo;
        }
      }
      // Por vencer: la camiseta parpadea en naranja (avisa que le quedan menos de 3 minutos)
      p.camiseta = l.e === 'e' ? (Math.sin(t * 9) > 0 ? NARANJA : APAGADO) : null;
    });
    // Los que dan tap tap sueltan corazoncitos desde su puesto
    S.cTap = (S.cTap ?? 0) - dt;
    if (S.cTap <= 0) {
      S.cTap = rand(0.4, 0.9);
      const activos = F.personas.filter(p => p.estado === 'quieto' && lista[p.k]?.e === 'a');
      if (activos.length) {
        const p = pick(activos), sp = new THREE.Sprite(S.matCorazon.clone());
        sp.scale.setScalar(0.22); sp.position.set(p.px, 1.45, p.pz); S.g.add(sp);
        S.particulas.push({s: sp, desde: sp.position.clone(), t: 0, vida: 1.3, regalo: false, fase: rand(0, 6)});
      }
    }
    moverMultitud(F, F.personas.filter(p => p.estado !== 'saliendo').length, dt, room.s.id, false);
  }

  // Los números del banco (la bóveda), tal cual los tiene la app DURO Live: su pantalla de estadísticas del mes
  // (s.appStats) y sus sesiones (s.liveStats, para separar regalos y PayPal y los últimos depósitos)
  function numerosBoveda(s) {
    const A = s.appStats?.actual, L = s.liveStats || {};
    const movs = A?.sesiones_grafico?.length ? A.sesiones_grafico.slice(-3).reverse().map(x => ({n: x.id, usd: Number(x.total_revenue_usd) || 0}))
      : (L.ultimos || []).slice(0, 3).map(x => ({n: x.numero, usd: x.usd}));
    return {mes: (s.appStats?.mes || new Date().toISOString().slice(0, 7)), saldo: A?.total ?? L.mes?.usd ?? 0,
      regalos: L.mes?.regalosUsd ?? 0, paypal: L.mes?.paypalUsd ?? 0, porHora: A?.ingreso_por_hora ?? 0, rpm: A?.tiktok_rpm ?? 0,
      directos: A?.directos ?? L.mes?.directos ?? 0, movimientos: movs};
  }

  function rutaPortal(geo, cual) {
    const P_ = geo.stream.parque?.portales?.[cual], e = geo.stream.entrada;
    return P_ ? ruta3D([{x: P_.x, y: 0, z: P_.z}, {x: e.x, y: 0, z: e.z}]) : null;
  }

  function destello(S, lugar) {
    const d = S.destellos.find(d => d.t >= 1) || S.destellos[0];
    d.t = 0; d.o.position.set(lugar.x, lugar.base + 0.8, lugar.z);
  }

  function lanzarParticula(S, material, tam, regalo) {
    // Salen de la gente sentada (conectados en vivo)
    const sentados = S.personas.filter(p => p.estado === 'sentado');
    if (!sentados.length) return;
    const o = S.lugares[pick(sentados).asiento];
    const s = new THREE.Sprite(material.clone());
    s.scale.setScalar(tam);
    const desde = new THREE.Vector3(o.x, o.base + 1.5, o.z);
    s.position.copy(desde);
    S.g.add(s);
    S.particulas.push({s, desde, t: 0, vida: regalo ? 2.2 : rand(1.6, 2.6), regalo, fase: rand(0, 6)});
  }

  function actualizarSala(room, dt) {
    for (const A of room.agentes) actualizarAgente(room, A, dt);
    const ocupados = room.agentes.filter(A => A.modo === 'trabajando').length;
    room.ocupados = ocupados;
    const vivo = room.stream ? actualizarSet(room, dt) : false;
    if (room.red) actualizarMultitud(room, dt);
    if (room.fest) actualizarFestival(room, dt);
    if (room.casa) actualizarCasa(room, dt);
    room.ultimoP -= dt;
    if (room.ultimoP <= 0 || room.ocupadosAntes !== ocupados || room.vivoAntes !== vivo) {
      dibujarPantallaSala(room, ocupados); room.ultimoP = ocupados || vivo ? 0.1 : 5; room.ocupadosAntes = ocupados; room.vivoAntes = vivo;
    }
    room.ultimoC -= dt;
    if (ocupados && room.ultimoC <= 0) { dibujarCodigo(room); room.ultimoC = 0.16; }
    // Resalte al pasar el mouse o al enfocar
    const brillo = rt.hover === room.s.id ? 0.18 : rt.foco === room.s.id ? 0.1 : 0;
    room.piso.material.emissiveIntensity += (brillo - room.piso.material.emissiveIntensity) * Math.min(1, dt * 8);
    room.luz.intensity = 9 + (ocupados ? Math.sin(rt.t * 3) * 1.5 + 3 : 0);
    if (room.etq) {
      // En el estudio la etiqueta va sobre producción para no tapar la LED
      ubicar(room.etq, tmpW.set(room.stream ? room.geo.L * 0.25 : 0, room.Hw + 0.4, -room.geo.L / 2).add(room.g.position), -6);
      room.etq.classList.toggle('ocupada', ocupados > 0);
      room.etq.classList.toggle('envivo', vivo);
    }
  }

  // ---------- Paquetes hacia el Cerebro ----------
  const GEO_PAQ = new THREE.SphereGeometry(0.22, 12, 8);
  function lanzarPaquete(room) {
    const m = new THREE.Mesh(GEO_PAQ, new THREE.MeshBasicMaterial({color: room.s.color, toneMapped: false}));
    m.material.color.multiplyScalar(2.2);
    scene.add(m);
    rt.paquetes.push({m, desde: room.g.position.clone().add(new THREE.Vector3(0, 1.5, 0)), t: 0, dur: rand(1.3, 1.9)});
  }
  function actualizarPaquetes(dt) {
    rt.paquetes = rt.paquetes.filter(p => {
      p.t += dt / p.dur;
      if (p.t >= 1) {
        scene.remove(p.m); p.m.material.dispose();
        hub.pulsoT = 0;
        hub.mirarObj.copy(p.desde).setY(1.2); hub.timer = 1.6;
        return false;
      }
      const e = p.t < .5 ? 2 * p.t * p.t : 1 - (-2 * p.t + 2) ** 2 / 2;
      p.m.position.lerpVectors(p.desde, new THREE.Vector3(0, 3.6, 0), e);
      p.m.position.y += Math.sin(Math.PI * p.t) * 4;
      return true;
    });
  }

  function actualizarHub(dt) {
    hub.timer -= dt;
    if (hub.timer <= 0) {
      // Mira hacia la cámara con pequeñas variaciones
      const c = camera.position.clone().sub(controls.target).normalize().multiplyScalar(20);
      hub.mirarObj.set(c.x + rand(-6, 6), 3.6 + c.y + rand(-4, 3), c.z + rand(-6, 6)); hub.timer = rand(1.5, 4);
    }
    hub.mirar.lerp(hub.mirarObj, Math.min(1, dt * 4));
    hub.pivote.lookAt(hub.mirar);
    hub.parpadeo -= dt;
    if (hub.parpadeo <= 0) { hub.cerrado = 0.14; hub.parpadeo = rand(3, 7); }
    hub.cerrado -= dt;
    hub.ojo.scale.y = hub.cerrado > 0 ? 0.25 : 2.1;
    hub.halo.rotation.x = Math.PI / 2 + Math.sin(rt.t * 0.6) * 0.25; hub.halo.rotation.y = rt.t * 0.4;
    hub.halo2.rotation.x = Math.PI / 2.4 + Math.cos(rt.t * 0.5) * 0.3; hub.halo2.rotation.z = rt.t * 0.3;
    hub.anillos[1].rotation.z = rt.t * 0.15;
    hub.rayo.material.opacity = 0.45 + Math.sin(rt.t * 1.6) * 0.1;
    if (hub.pulsoT < 1) {
      hub.pulsoT = Math.min(1, hub.pulsoT + dt * 1.2);
      hub.pulso.scale.setScalar(2 + hub.pulsoT * (HUB_R + 3));
      hub.pulso.material.opacity = (1 - hub.pulsoT) * 0.9;
    }
    hub.clic.material.visible = false;
    if (hub.etq) ubicar(hub.etq, tmpW.set(0, 0.4, HUB_R * 0.55), 40);
  }

  function demoTick(dt) {
    for (const room of rt.rooms.values()) {
      const libres = room.agentes.filter(A => !rt.asig.has(A.key) && !rt.demoMap.has(A.key));
      const activos = room.agentes.length - libres.length;
      if (libres.length && activos < Math.ceil(room.agentes.length * 0.6) && Math.random() < dt * 0.6) {
        const enCurso = new Set(room.agentes.map(A => tareaDe(A.key)));
        const ts = room.s.tareas.filter(t => t.estado !== 'hecho' && !enCurso.has(t.t));
        rt.demoMap.set(pick(libres).key, {texto: ts.length ? pick(ts).t : 'Trabajando', hasta: rt.t + rand(7, 15)});
      }
    }
    for (const [k, v] of rt.demoMap) if (v.hasta < rt.t) rt.demoMap.delete(k);
  }

  // ---------- Bucle ----------
  const reloj = new THREE.Clock();
  function bucle() {
    const dt = Math.min(0.1, reloj.getDelta());
    rt.t += dt;
    if (rt.demo) demoTick(dt);
    for (const room of rt.rooms.values()) actualizarSala(room, dt);
    for (const x of rt.paseoAnim) x.obj.rotation[x.eje] += dt * x.vel;   // atracciones del parque de DURO LIVE
    moverCaminantes(dt);
    if (rt.bandeja) { const n = rt.rooms.get('live')?.s.extra?.bandeja || 0; if (n !== rt.bandeja.clave) { rt.bandeja.clave = n; rt.bandeja.actualizar(n); } }
    actualizarPaquetes(dt);
    actualizarHub(dt);
    for (const f of rt.futuras) if (f.etq) ubicar(f.etq, tmpW.set(0, 0.4, -2.5).add(f.g.position), -4);
    if (objetivo.activo) {
      controls.target.lerp(objetivo.target, Math.min(1, dt * 4));
      camera.zoom += (objetivo.zoom - camera.zoom) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
      if (controls.target.distanceTo(objetivo.target) < 0.02 && Math.abs(camera.zoom - objetivo.zoom) < 0.005) objetivo.activo = false;
    }
    controls.update();
    composer.render();
    requestAnimationFrame(bucle);
  }
  controls.addEventListener('start', () => { objetivo.activo = false; });
  ajustarCamara();
  requestAnimationFrame(bucle);

  return {
    actualizar,
    enfocar,
    setDemo(v) { rt.demo = v; if (!v) rt.demoMap.clear(); },
    // Lleva la cámara a las gradas de enfrente para ver a la gente de cerca
    verPublico(id) {
      const room = rt.rooms.get(id);
      if (!room?.stream) return;
      const an = room.geo.stream.anillos, rMed = an[Math.floor(an.length / 2)].r;
      const p = room.g.position.clone().add(new THREE.Vector3(Math.SQRT1_2 * rMed, 0.8, Math.SQRT1_2 * rMed));
      rt.foco = id;
      const zoom = THREE.MathUtils.clamp(rt.extent / 4, 5, 40), w = contenedor.clientWidth;
      // Igual que al enfocar una sala: con el panel abierto, corre la vista a la parte visible
      if (w > 720) p.add(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar((camera.right - camera.left) / zoom * Math.min(410, w * 0.45) / 2 / w));
      Object.assign(objetivo, {target: p, zoom, activo: true});
    },
    // Para depurar desde la consola: lleva la cámara a un punto de una sala (en coordenadas de la sala)
    mirar(id, x, z, zoom = 20, y = 0) {
      const room = rt.rooms.get(id);
      if (!room) return null;
      rt.foco = id;
      Object.assign(objetivo, {target: room.g.localToWorld(new THREE.Vector3(x, y, z)), zoom, activo: true});
      return room.geo.stream?.parque || null;
    },
    entradas() { return new Map(entradas); },
    publico() {
      for (const room of rt.rooms.values()) if (room.stream) return {conectados: room.stream.conectados, aforo: room.stream.aforo + room.stream.gradasN};
      return null;
    },
    trabajando() {
      const lista = [];
      for (const room of rt.rooms.values()) for (const A of room.agentes) if (A.modo === 'trabajando') lista.push({sala: room.s, agente: A.ag.nombre, tarea: tareaDe(A.key)});
      return lista;
    },
    get demo() { return rt.demo; },
  };
}
