// Escena 3D de la oficina: salas, centro (Cerebro), caminos, luces y agentes que caminan y trabajan.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {geometria, ruta, rand, pick, hash, esc, conectadosEsperados, horaColombia, cifra, personasRed, seguidoresPorPersona, fijarEscalaRedes, viendoAhora, flujoVisitas} from './datos.js';

const H = 2.3;            // alto de las paredes
const ABAJO = new THREE.Vector3(0, -1, 0), ARRIBA = new THREE.Vector3(0, 1, 0);
const TMP_COLOR = new THREE.Color();
const HUB_R = 6.5;        // radio de la plataforma central
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

  const rt = {t: 0, rooms: new Map(), futuras: [], caminos: new THREE.Group(), paquetes: [], memoria: new Map(),
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
  function construirSala(s) {
    const geo = geometria(s), {L, X0, Z0} = geo, c = s.color;
    const g = new THREE.Group();
    const res = []; // texturas propias para liberar

    const st = geo.stream;
    // La arena y las redes tienen paredes altas: el equipo trabaja arriba (palco o mezzanine)
    const Hw = st ? Math.max(6.4, st.yT + 1.4, geo.yPiso + 3.2, st.gradas.alto + 4.6) : s.tipo === 'red' ? Math.max(5.4, pantallaRed(geo).y + pantallaRed(geo).h / 2 + 2.4 * geo.fans.k) : s.tipo === 'festival' ? 4.8 : s.tipo === 'casa' ? 3.6 : H;

    // Base y piso (baldosas; en el estudio, piso oscuro brillante con cuadrícula de neón)
    // La arena y el festival son lugares oscuros con neón; las demás salas, iluminadas
    const oscuro = st || s.tipo === 'festival';
    g.add(caja(L + 0.3, 0.5, L + 0.3, mat(oscuro ? '#0c0812' : '#' + tono(c, 0.45).getHexString()), 0, -0.25, 0, false));
    const tpiso = oscuro ? texturaPisoNeon(c) : s.tipo === 'casa' ? texturaPiso('#d8cfc2') : texturaPiso(c); tpiso.repeat.set(L, L); res.push(tpiso);
    const piso = new THREE.Mesh(GEO.plane, new THREE.MeshStandardMaterial({map: tpiso, roughness: oscuro ? 0.28 : 0.6, metalness: oscuro ? 0.45 : 0, emissive: new THREE.Color(c), emissiveIntensity: 0}));
    piso.scale.set(L, L, 1); piso.rotation.x = -Math.PI / 2; piso.position.y = 0.005; piso.receiveShadow = true;
    piso.userData = {sala: s.id}; g.add(piso); res.push(piso.material);
    if (!st) {
      const alf = new THREE.Mesh(GEO.plane, mat('#' + tono(c, 0.85).getHexString(), {roughness: 0.95}));
      alf.scale.set(L * 0.62, L * 0.55, 1); alf.position.set(0.3, 0.012, 0.3);
      alf.rotation.x = -Math.PI / 2; alf.receiveShadow = true; g.add(alf);
    }

    // Paredes del fondo (x = X0 y z = Z0) con borde claro arriba
    const mPared = st ? mat('#' + new THREE.Color(c).multiplyScalar(0.28).getHexString(), {roughness: 0.6}) : oscuro ? mat('#140b1f', {roughness: 0.7}) : s.tipo === 'casa' ? mat('#efe6d8', {roughness: 0.85}) : mat('#' + tono(c, 0.9).getHexString(), {roughness: 0.85});
    g.add(caja(0.2, Hw, L + 0.2, mPared, X0 - 0.1, Hw / 2, -0.1));
    g.add(caja(L, Hw, 0.2, mPared, 0, Hw / 2, Z0 - 0.1));
    const mBorde = oscuro ? new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(1.4), toneMapped: false}) : mat('#' + tono(c, 1.3).getHexString());
    if (oscuro) res.push(mBorde);
    g.add(caja(0.24, 0.06, L + 0.24, mBorde, X0 - 0.1, Hw + 0.03, -0.1, false));
    g.add(caja(L + 0.04, 0.06, 0.24, mBorde, 0, Hw + 0.03, Z0 - 0.1, false));

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
    pantalla.scale.set(pw, ph, 1); pantalla.position.set(px, py, Z0 + 0.035); g.add(pantalla);
    // En el festival la pared del fondo es de las portadas: esta pantalla no se usa
    if (s.tipo === 'festival' || s.tipo === 'casa') pantalla.visible = false;
    else g.add(caja(pw + 0.12, ph + 0.12, 0.04, mat('#0b0d1a'), px, py, Z0 + 0.0, false));
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
    planta(X0 + L - 0.5, Z0 + L - 0.5);
    if (!st) planta(X0 + L - 0.45, Z0 + 0.45, 0.85);

    // En la arena la producción trabaja en el palco elevado
    const zona = new THREE.Group(); zona.position.y = geo.yPiso || 0; g.add(zona);

    // Máquina de café
    const cafe = geo.cafe || {x: 0};
    if (geo.cafe) {
      zona.add(caja(0.55, 0.95, 0.4, mat('#2e3245'), cafe.x, 0.475, Z0 + 0.25));
      zona.add(caja(0.12, 0.08, 0.02, new THREE.MeshBasicMaterial({color: '#ff5470', toneMapped: false}), cafe.x, 0.8, Z0 + 0.46, false));
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
    g.add(caja(L, 0.25, D, mat('#1a1d2b', {roughness: 0.4, metalness: 0.3}), 0, yP - 0.125, Z0 + D / 2));
    const vidrio = new THREE.MeshStandardMaterial({color: '#9cc9ff', transparent: true, opacity: 0.18, metalness: 0.6, roughness: 0.05, depthWrite: false}); res.push(vidrio);
    g.add(caja(L, 1.0, 0.04, vidrio, 0, yP + 0.5, Z0 + D, false));
    g.add(caja(L, 0.05, 0.06, mNeon, 0, yP + 1.0, Z0 + D, false));
    g.add(caja(L, 0.05, 0.06, mNeon, 0, yP - 0.27, Z0 + D, false));
    for (const x of [X0 + 0.15, X0 + L - 0.15]) g.add(caja(0.14, yP, 0.14, mat('#2a2d3c', {metalness: 0.7}), x, yP / 2, Z0 + D - 0.1));
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
    return {logo, multitud, ahora, parque, brayan, holo, mirar: new THREE.Vector3(E.x, 1, E.z)};
  }

  // La comunidad de una red: se mueve un poco y salta cuando el equipo de la sala trabaja
  function actualizarMultitud(room, dt) {
    const M = room.red.multitud; if (!M) return;
    const n = personasRed(room.s, M.gente.length), t = rt.t, animada = room.ocupados > 0;
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
  function construirAtraccion(tipo, col, colores, i, res, anim) {
    const at = new THREE.Group();
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
      for (let k = 0; k < 8; k++) {
        const ang = k * Math.PI / 4;
        const rayo = caja(0.04, R, 0.04, metal, 0, Math.sin(ang) * R / 2, Math.cos(ang) * R / 2, false); rayo.rotation.x = -ang + Math.PI / 2; rueda.add(rayo);
        rueda.add(caja(0.3, 0.24, 0.28, mat(colores[(i + k) % colores.length], {roughness: 0.5}), 0, Math.sin(ang) * R - 0.12, Math.cos(ang) * R));
      }
      anim.push({obj: rueda, eje: 'x', vel: 0.25});
    } else if (tipo === 'carrusel') {
      at.add(cilindro(1.5, 0.22, mat('#2a2236', {roughness: 0.5}), 0, 0.11, 0));
      const giro = new THREE.Group(); at.add(giro);
      giro.add(cilindro(0.08, 2.0, metal, 0, 1.1, 0));
      const techo = new THREE.Mesh(new THREE.ConeGeometry(1.65, 0.8, 16), mat(col, {roughness: 0.5})); res.push(techo.geometry); techo.position.y = 2.3; giro.add(techo);
      const borde = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.04, 6, 48), luz('#fff1c9')); res.push(borde.geometry);
      borde.rotation.x = Math.PI / 2; borde.position.y = 1.92; giro.add(borde);
      for (let k = 0; k < 6; k++) {
        const ang = k * Math.PI / 3, r = 1.05;
        giro.add(caja(0.03, 1.7, 0.03, metal, Math.cos(ang) * r, 1.05, Math.sin(ang) * r, false));
        giro.add(caja(0.42, 0.26, 0.14, mat(colores[(i + k + 1) % colores.length], {roughness: 0.5}), Math.cos(ang) * r, 0.75 + (k % 2) * 0.2, Math.sin(ang) * r));
      }
      anim.push({obj: giro, eje: 'y', vel: 0.5});
    } else {
      // Puesto de comida con toldo de rayas y letrero
      at.rotation.y = Math.PI / 4;
      at.add(caja(1.6, 0.9, 0.7, mat('#3a2a22', {roughness: 0.7}), 0, 0.45, 0));
      for (const sx of [-0.75, 0.75]) at.add(caja(0.06, 1.9, 0.06, metal, sx, 0.95, 0.3));
      for (let k = 0; k < 6; k++) at.add(caja(0.28, 0.06, 0.95, mat(k % 2 ? '#ffffff' : col, {roughness: 0.6}), -0.7 + k * 0.28, 1.95, 0.05));
      at.add(caja(0.9, 0.3, 0.05, luz(col), 0, 2.25, 0.3, false));
    }
    return at;
  }

  // ---------- Parque de diversiones de cada red (afuera de la sala) ----------
  // Los seguidores andan aquí, distraídos. Los que empiezan a verte cruzan la entrada del muro hacia el mirador.
  function construirParque(g, geo, res, c) {
    const P = geo.fans.parque, {Z0, X0, L} = geo, D = geo.mezz.D;
    const anim = [];
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
    });
    return {anim};
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

  // ---------- Casa de Brayan: el palacio al que escapa (y que quiere volver real) ----------
  function construirCasa(g, geo, s, res) {
    const {L, X0, Z0} = geo, c = s.color, P = geo.casa.P;
    const madera = mat('#8a5a35', {roughness: 0.6}), oscuro = mat('#1d1f2a', {roughness: 0.5}), blanco = mat('#f3eee6', {roughness: 0.7});
    const oro = mat('#d4af37', {metalness: 1, roughness: 0.25}), marmol = mat('#efe9df', {roughness: 0.2, metalness: 0.1});
    const luzCalida = new THREE.MeshBasicMaterial({color: '#ffe2a8', toneMapped: false}); res.push(luzCalida);
    const lienzo = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; res.push(t); return {cv, t}; };
    const suelo = (x, z, w, d, m, y = 0.013) => { const p = new THREE.Mesh(GEO.plane, m); p.scale.set(w, d, 1); p.rotation.x = -Math.PI / 2; p.position.set(X0 + x, y, Z0 + z); p.receiveShadow = true; g.add(p); return p; };
    const palma = (x, z, alto = 2.8) => {
      const px = X0 + x, pz = Z0 + z;
      const tronco = cilindro(0.1, alto, mat('#7a5a3a'), px, alto / 2, pz); tronco.rotation.z = 0.1; g.add(tronco);
      for (let k = 0; k < 7; k++) {
        const a = k * Math.PI * 2 / 7;
        const hoja = caja(1.4, 0.04, 0.34, mat(k % 2 ? '#2e9e57' : '#3fbf6a', {flatShading: true}), px + Math.cos(a) * 0.6 + 0.15, alto - 0.05, pz - Math.sin(a) * 0.6);
        hoja.rotation.set(0, a, -0.45); g.add(hoja);
      }
    };

    // Pilastras doradas en las paredes: el toque de palacio
    for (let k = 1; k < 5; k++) {
      g.add(caja(0.16, 3.4, 0.08, oro, X0 + k * 3, 1.7, Z0 + 0.04, false));
      g.add(caja(0.08, 3.4, 0.16, oro, X0 + 0.04, 1.7, Z0 + k * 3, false));
    }

    // Estudio de música (fondo izquierda)
    g.add(caja(1.8, 0.06, 0.6, oscuro, X0 + 1.4, 0.75, Z0 + 0.75));
    for (const dx of [-0.8, 0.8]) g.add(caja(0.05, 0.72, 0.5, oscuro, X0 + 1.4 + dx, 0.36, Z0 + 0.75));
    for (const dx of [-0.35, 0.35]) g.add(caja(0.62, 0.38, 0.04, mat('#111'), X0 + 1.4 + dx, 1.08, Z0 + 0.55));
    for (const dx of [-0.85, 0.85]) g.add(caja(0.2, 0.32, 0.22, mat('#151515'), X0 + 1.4 + dx, 0.94, Z0 + 0.6));
    g.add(cilindro(0.015, 1.3, mat('#222'), X0 + 3.0, 0.65, Z0 + 1.05));
    g.add(cilindro(0.12, 0.03, mat('#222'), X0 + 3.0, 0.015, Z0 + 1.05));
    const mic = new THREE.Mesh(GEO.torso, mat('#2b2b33', {metalness: 0.6, roughness: 0.3})); mic.scale.setScalar(0.25); mic.position.set(X0 + 3.0, 1.38, Z0 + 1.15); mic.rotation.x = 0.3; g.add(mic);
    for (let k = 0; k < 8; k++) g.add(caja(0.42, 0.42, 0.06, mat(k % 2 ? '#2a1d3a' : '#3a2650', {roughness: 0.95}), X0 + 0.5 + k * 0.5, 1.9, Z0 + 0.04, false));
    g.add(caja(0.06, 0.8, 0.62, oro, X0 + 0.05, 1.5, Z0 + 2.4, false));   // placa de YouTube

    // Oficina con el tablero de misiones (fondo centro)
    const tab = lienzo(640, 320);
    const tablero = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tab.t, toneMapped: false})); res.push(tablero.material);
    tablero.scale.set(3.2, 1.6, 1); tablero.position.set(X0 + 7.5, 1.6, Z0 + 0.06); g.add(tablero);
    g.add(caja(3.4, 1.8, 0.04, oro, X0 + 7.5, 1.6, Z0 + 0.03, false));
    g.add(caja(1.6, 0.06, 0.55, madera, X0 + 7.5, 0.75, Z0 + 1.1));
    for (const dx of [-0.72, 0.72]) g.add(caja(0.05, 0.72, 0.45, madera, X0 + 7.5 + dx, 0.36, Z0 + 1.1));

    // Cuarto principal (fondo derecha): cama king con cabecero dorado y mesas de noche
    suelo(12.7, 2.1, 4.2, 3.4, mat('#6b4a7a', {roughness: 0.95}));
    g.add(caja(2.2, 0.35, 2.3, oscuro, X0 + 12.5, 0.18, Z0 + 1.35));
    g.add(caja(2.1, 0.18, 2.1, blanco, X0 + 12.5, 0.44, Z0 + 1.45));
    g.add(caja(2.1, 0.06, 1.3, mat(c, {roughness: 0.8}), X0 + 12.5, 0.55, Z0 + 1.9));
    for (const dx of [-0.5, 0.5]) g.add(caja(0.8, 0.14, 0.4, blanco, X0 + 12.5 + dx, 0.6, Z0 + 0.5));
    g.add(caja(2.5, 1.3, 0.12, mat('#2a1f14'), X0 + 12.5, 0.95, Z0 + 0.12));
    g.add(caja(2.6, 0.06, 0.14, oro, X0 + 12.5, 1.62, Z0 + 0.12, false));
    for (const dx of [-1.55, 1.55]) {
      g.add(caja(0.5, 0.5, 0.45, madera, X0 + 12.5 + dx, 0.25, Z0 + 0.4));
      const lam = new THREE.Mesh(GEO.sphere, luzCalida); lam.scale.setScalar(0.12); lam.position.set(X0 + 12.5 + dx, 0.75, Z0 + 0.4); g.add(lam);
    }

    // Gimnasio
    g.add(caja(0.35, 0.08, 1.2, mat('#222'), X0 + 12.3, 0.45, Z0 + 5.6));
    for (const dz of [-0.45, 0.45]) g.add(caja(0.3, 0.42, 0.08, mat('#333'), X0 + 12.3, 0.21, Z0 + 5.6 + dz));
    g.add(caja(0.8, 1.3, 0.1, mat('#2a2a30'), X0 + 14.3, 0.65, Z0 + 5.6));
    for (let k = 0; k < 4; k++) { const pesa = cilindro(0.09, 0.06, mat('#3a3a40', {metalness: 0.6}), X0 + 14.1, 0.35 + k * 0.25, Z0 + 5.3 + (k % 2) * 0.6); pesa.rotation.z = Math.PI / 2; g.add(pesa); }

    // Garaje con la XTZ 125 (izquierda)
    suelo(1.6, 5.8, 3.2, 3.4, mat('#3b3e46', {roughness: 0.8}));
    g.add(caja(0.04, 0.05, 3.4, new THREE.MeshBasicMaterial({color: '#22c55e', toneMapped: false}), X0 + 0.05, 0.1, Z0 + 5.8, false));
    const cartel = lienzo(256, 96);
    { const x = cartel.cv.getContext('2d'); x.fillStyle = '#0b0b0d'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#22c55e'; x.font = '800 44px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('XTZ 125', 128, 50); }
    const cart = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: cartel.t, toneMapped: false})); res.push(cart.material);
    cart.scale.set(1.3, 0.49, 1); cart.rotation.y = Math.PI / 2; cart.position.set(X0 + 0.06, 1.9, Z0 + 5.8); g.add(cart);
    construirMoto(g, geo.casa.moto, res);

    // Salón: alfombra, sofá en L, mesa de centro, TV grande y lámpara de araña
    suelo(6.2, 6.9, 4.4, 3.4, mat('#b5835a', {roughness: 0.95}));
    const tela = mat('#3b2a4a', {roughness: 0.9});
    g.add(caja(3.2, 0.42, 0.9, tela, X0 + 6.0, 0.21, Z0 + 8.4)); g.add(caja(3.2, 0.75, 0.22, tela, X0 + 6.0, 0.38, Z0 + 8.8));
    g.add(caja(0.9, 0.42, 2.0, tela, X0 + 7.95, 0.21, Z0 + 7.4)); g.add(caja(0.22, 0.75, 2.0, tela, X0 + 8.35, 0.38, Z0 + 7.4));
    g.add(caja(1.1, 0.32, 0.6, marmol, X0 + 6.0, 0.16, Z0 + 6.9));
    const tv = lienzo(512, 288);
    { const x = tv.cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 512, 288); gr.addColorStop(0, '#1a0510'); gr.addColorStop(1, '#05060f'); x.fillStyle = gr; x.fillRect(0, 0, 512, 288); x.fillStyle = '#ff3d6e'; x.font = '800 64px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.fillText('DURO', 256, 150); x.fillStyle = '#fff'; x.font = '24px ui-monospace, Menlo, monospace'; x.fillText('desde Urabá', 256, 200); }
    const pantallaTV = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tv.t, toneMapped: false})); res.push(pantallaTV.material);
    pantallaTV.scale.set(2.6, 1.46, 1); pantallaTV.position.set(X0 + 6.0, 1.35, Z0 + 4.86); g.add(pantallaTV);
    g.add(caja(2.75, 1.6, 0.06, mat('#111'), X0 + 6.0, 1.35, Z0 + 4.82, false));
    g.add(caja(2.8, 0.45, 0.5, madera, X0 + 6.0, 0.22, Z0 + 4.85));
    const arana = new THREE.Group(); arana.position.set(X0 + 6.0, 3.0, Z0 + 6.8); g.add(arana);
    const aroA = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 40), oro); res.push(aroA.geometry); aroA.rotation.x = Math.PI / 2; arana.add(aroA);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const b = new THREE.Mesh(GEO.sphere, luzCalida); b.scale.setScalar(0.07); b.position.set(Math.cos(a) * 0.55, -0.05, Math.sin(a) * 0.55); arana.add(b); }
    arana.add(cilindro(0.015, 0.6, oro, 0, 0.3, 0));
    const luzArana = new THREE.PointLight('#ffd9a0', 16, 9, 1.6); luzArana.position.copy(arana.position).y -= 0.3; g.add(luzArana);

    // Cocina y comedor
    suelo(6.3, 10.4, 5.4, 2.2, mat('#ddd5c8', {roughness: 0.3}));
    g.add(caja(2.2, 0.85, 0.75, oscuro, X0 + 5.6, 0.43, Z0 + 9.9)); g.add(caja(2.3, 0.06, 0.85, marmol, X0 + 5.6, 0.88, Z0 + 9.9));
    for (const dx of [-0.6, 0.6]) { g.add(cilindro(0.16, 0.05, oscuro, X0 + 5.6 + dx, 0.62, Z0 + 10.55)); g.add(cilindro(0.025, 0.6, oro, X0 + 5.6 + dx, 0.3, Z0 + 10.55)); }
    g.add(caja(1.6, 0.06, 0.9, madera, X0 + 8.0, 0.75, Z0 + 10.5));
    for (const [dx, dz] of [[-0.5, -0.65], [0.5, -0.65], [-0.5, 0.65], [0.5, 0.65]]) g.add(caja(0.4, 0.45, 0.4, madera, X0 + 8.0 + dx, 0.23, Z0 + 10.5 + dz));
    for (const dx of [-0.5, 0.5]) { const p = new THREE.Mesh(GEO.sphere, luzCalida); p.scale.setScalar(0.1); p.position.set(X0 + 8.0 + dx, 2.0, Z0 + 10.5); g.add(p); g.add(cilindro(0.008, 1.1, mat('#222'), X0 + 8.0 + dx, 2.6, Z0 + 10.5)); }

    // Jardín con fuente y faroles (adelante izquierda)
    suelo(3.6, 13.3, 7.2, 3.4, mat('#3e8f45', {roughness: 0.95}));
    g.add(cilindro(1.0, 0.35, marmol, X0 + 3.6, 0.18, Z0 + 13.3));
    const aguaF = cilindro(0.88, 0.04, new THREE.MeshStandardMaterial({color: '#4fc3f7', emissive: '#1e88e5', emissiveIntensity: 0.5, roughness: 0.1}), X0 + 3.6, 0.34, Z0 + 13.3); res.push(aguaF.material); g.add(aguaF);
    g.add(cilindro(0.12, 1.1, marmol, X0 + 3.6, 0.7, Z0 + 13.3)); g.add(cilindro(0.4, 0.08, marmol, X0 + 3.6, 1.25, Z0 + 13.3));
    const chorro = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({color: '#bfe9ff', transparent: true, opacity: 0.6, toneMapped: false})); res.push(chorro.material);
    chorro.scale.set(0.12, 0.3, 0.12); chorro.position.set(X0 + 3.6, 1.5, Z0 + 13.3); g.add(chorro);
    for (const [x, z] of [[1.2, 11.9], [6.0, 11.9], [1.2, 14.6], [6.0, 14.6]]) {
      g.add(cilindro(0.04, 1.2, oscuro, X0 + x, 0.6, Z0 + z));
      const f = new THREE.Mesh(GEO.sphere, luzCalida); f.scale.setScalar(0.11); f.position.set(X0 + x, 1.25, Z0 + z); g.add(f);
    }
    palma(0.7, 14.3, 2.6); palma(6.7, 14.5, 3.0);

    // Terraza con piscina infinita, asoleadoras y palmeras (adelante derecha)
    suelo(11.8, 11.25, 6.4, 7.5, mat('#b98a5c', {roughness: 0.7}));
    g.add(caja(4.9, 0.14, 3.5, marmol, X0 + 11.7, 0.07, Z0 + 10.8, false));
    const agua = new THREE.Mesh(GEO.plane, new THREE.MeshStandardMaterial({color: '#29b6f6', emissive: '#1e88e5', emissiveIntensity: 0.55, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.92}));
    res.push(agua.material); agua.scale.set(4.6, 3.2, 1); agua.rotation.x = -Math.PI / 2; agua.position.set(X0 + 11.7, 0.145, Z0 + 10.8); g.add(agua);
    const luzPisc = new THREE.PointLight('#4fc3f7', 6, 5, 1.6); luzPisc.position.set(X0 + 11.7, 0.6, Z0 + 10.8); g.add(luzPisc);
    for (const x of [10.4, 12.0]) { const sil = caja(0.6, 0.12, 1.5, blanco, X0 + x, 0.26, Z0 + 13.6); sil.rotation.x = -0.12; g.add(sil); }
    palma(14.4, 8.0); palma(14.4, 14.3, 3.2); palma(9.0, 14.6, 2.6);

    // Entrada principal: arco dorado con el nombre de la casa
    const entrada = new THREE.Group(); entrada.position.set(X0 + 7.5, 0, Z0 + L - 0.15); g.add(entrada);
    for (const sx of [-1.1, 1.1]) { entrada.add(cilindro(0.16, 2.8, marmol, sx, 1.4, 0)); entrada.add(cilindro(0.22, 0.14, oro, sx, 2.85, 0)); }
    entrada.add(caja(2.6, 0.3, 0.3, oro, 0, 3.05, 0));
    const nombre = lienzo(512, 96);
    { const x = nombre.cv.getContext('2d'); x.fillStyle = '#1a1206'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#f5d76e'; x.font = '800 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CASA BRAYAN', 256, 52); }
    const letrero = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: nombre.t, toneMapped: false})); res.push(letrero.material);
    letrero.scale.set(2.4, 0.45, 1); letrero.position.set(0, 3.05, 0.16); entrada.add(letrero);

    // Estrellas de los sueños que ya son reales
    const cvE = document.createElement('canvas'); cvE.width = cvE.height = 128;
    { const x = cvE.getContext('2d'); x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⭐', 64, 70); }
    const tE = new THREE.CanvasTexture(cvE); res.push(tE);
    const matE = new THREE.SpriteMaterial({map: tE, transparent: true, depthWrite: false}); res.push(matE);
    const estrellas = {};
    for (const [id, p] of Object.entries(geo.casa.suenos)) {
      const sp = new THREE.Sprite(matE); sp.scale.setScalar(0.55); sp.position.set(p.x, id === 'casa' ? 3.7 : 2.3, p.z); sp.visible = false; g.add(sp);
      estrellas[id] = sp;
    }

    // Brayan vive aquí
    const brayan = crearPersona({nombre: 'Brayan Trampa', estado: 'activo'}, {camisa: '#ff5a00', pantalon: '#141414', pelo: '#0d0d12', piel: '#8d5a3b', gafas: true});
    const L0 = geo.casa.lugares[0];
    brayan.raiz.position.set(L0.x, 0, L0.z); g.add(brayan.raiz);
    return {tablero: tab, brayan, estrellas, lugares: geo.casa.lugares, i: 0, x: L0.x, z: L0.z, rot: L0.rot, destino: null, timer: rand(4, 8), ultimo: -1};
  }

  // Moto de Brayan: Yamaha XTZ 125 (2022), negra con verde. Enduro: rueda delantera más grande,
  // llantas de taco, guardabarros alto, sillín largo y plano, manubrio ancho. Mira hacia +z del grupo.
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

  // Brayan recorre su casa; cuando DURO LIVE está en vivo, se va a la arena
  function actualizarCasa(room, dt) {
    const C = room.casa, b = C.brayan, t = rt.t;
    const enVivo = datos.salas.some(s => s.streamer?.enVivo);
    b.raiz.visible = !enVivo;
    C.ultimo -= dt;
    if (C.ultimo <= 0) {
      dibujarTablero(room, enVivo); C.ultimo = 1;
      for (const s_ of room.s.suenos || []) if (C.estrellas[s_.id]) C.estrellas[s_.id].visible = !!s_.real;
    }
    for (const sp of Object.values(C.estrellas)) sp.scale.setScalar(0.5 + Math.sin(t * 2.5) * 0.06);
    if (!enVivo) {
      const aqui = C.lugares[C.i];
      if (C.destino) {
        const dx = C.destino.x - C.x, dz = C.destino.z - C.z, d = Math.hypot(dx, dz);
        if (d < 0.05) { C.i = C.lugares.indexOf(C.destino); C.destino = null; C.timer = rand(6, 12); }
        else { const m = Math.min(d, dt * 1.4); C.x += dx / d * m; C.z += dz / d * m; C.rot = Math.atan2(dx, dz); }
      } else {
        C.rot += (Math.atan2(Math.sin(aqui.rot - C.rot), Math.cos(aqui.rot - C.rot))) * Math.min(1, dt * 6);
        C.timer -= dt;
        if (C.timer <= 0) { let n; do n = Math.floor(Math.random() * C.lugares.length); while (n === C.i); C.destino = C.lugares[n]; }
      }
      b.raiz.position.set(C.x, 0, C.z); b.raiz.rotation.y = C.rot;
      // Pose según la actividad
      const act = C.destino ? 'caminando' : aqui.id;
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
    // Etiqueta: qué está haciendo Brayan
    if (room.etqCasa) {
      const texto = enVivo ? '<b>🔴 Brayan está en el LIVE</b>' : C.destino ? '<b>🚶 Brayan</b><small>caminando</small>' : `<b>${C.lugares[C.i].emoji} Brayan</b><small>${C.lugares[C.i].texto}</small>`;
      if (room.etqCasa.texto !== texto) { room.etqCasa.texto = texto; room.etqCasa.el.innerHTML = texto; }
      ubicar(room.etqCasa.el, tmpW.set(enVivo ? 0 : C.x, enVivo ? 1.5 : 2.0, enVivo ? 0 : C.z).add(room.g.position), -4);
    }
  }

  // ---------- Multitudes (comunidades de redes y públicos de playlists) ----------
  // Personas de pie con instancias, para que sean muchas sin costo. Cada una mira a un punto (mira).
  // dormida: los seguidores existen pero no están mirando; se ven apagados, sentados en el piso y cabeceando
  function crearMultitud(g, res, {posiciones, color, mira, puerta, semilla, dormida = false}) {
    const N = posiciones.length;
    const capa_ = (geom, brillo) => {
      const m = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.7, emissive: '#ffffff', emissiveIntensity: brillo}); res.push(m);
      const im = new THREE.InstancedMesh(geom, m, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; g.add(im); return im;
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
    const pts = [enArena(d.x, d.z), enArena(puerta.x, puerta.z - 0.6), enArena(puerta.x, puerta.z + 1.2)];
    if (esq) pts.push(new THREE.Vector3(esq.x, 0, esq.z));
    pts.push(destino.clone());
    return {ruta: ruta3D(pts.map(p => ({x: p.x, y: 0, z: p.z}))), origen: {M, k}};
  }
  function devolverATikTok(p) {
    if (!p.origen) return;
    p.origen.M.ocultos.delete(p.origen.k); p.origen.M.sucio = true;
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
      else { const p = [...M.personas].reverse().find(p => p.estado !== 'saliendo'); if (p) p.estado = 'saliendo'; }
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
      if (p.estado === 'entrando') { p.u += dt * 1.8 / largo; if (p.u >= 1) { p.u = 1; p.estado = 'quieto'; } }
      else if (p.estado === 'saliendo') { p.u -= dt * 2.2 / largo; if (p.u <= 0) { M.alSalir?.(p); return false; } }
      // Los que se despertaron y se fueron a mirar no se dibujan en su lugar de dormir
      if (M.ocultos.has(p.k)) return true;
      const r_ = p.ruta ? enRuta(p.ruta, p.u) : null;
      const x = r_ ? r_.x : o.x + (g_.x - o.x) * p.u, z = r_ ? r_.z : o.z + (g_.z - o.z) * p.u, e = g_.esc, y0 = r_ ? r_.y : g_.y * p.u;
      const camina = p.estado !== 'quieto';
      const rot = camina ? (r_ ? Math.atan2(r_.dx, r_.dz) : Math.atan2(g_.x - o.x, g_.z - o.z)) + (p.estado === 'saliendo' ? Math.PI : 0) : g_.rot;
      q.setFromAxisAngle(ARRIBA, rot);
      const y = y0 + (camina ? Math.abs(Math.sin(t * 9 + g_.fase)) * 0.05 : quietos || M.dormida ? 0
        : animada && (p.k % 3 === Math.floor(t * 2.2) % 3) ? Math.abs(Math.sin(t * 6.9 + g_.fase)) * 0.12 : Math.abs(Math.sin(t * 1.4 + g_.fase)) * 0.02);
      if (M.dormida && !camina) {
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
      M.cuerpos.setColorAt(j, cC); M.cabezas.setColorAt(j, cCa); M.pelos.setColorAt(j, cP); M.piernas.setColorAt(j, cPi);
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

    // --- Palco de producción: elevado en la esquina del fondo, con vidrio polarizado hacia el escenario ---
    g.add(caja(B, 0.3, B, mat('#0b1020', {roughness: 0.35, metalness: 0.4}), X0 + B / 2, yPiso - 0.15, Z0 + B / 2));
    for (const [x, z, w, d] of [[X0 + B, Z0 + B / 2, 0.06, B], [X0 + B / 2, Z0 + B, B, 0.06]]) g.add(caja(w, 0.05, d, nRosa, x, yPiso - 0.32, z, false));
    // Columnas que lo sostienen (queda por encima de la última fila de las gradas)
    for (const [x, z] of [[X0 + B - 0.12, Z0 + B - 0.12], [X0 + B - 0.12, Z0 + 0.12], [X0 + 0.12, Z0 + B - 0.12]]) {
      g.add(caja(0.22, yPiso - 0.3, 0.22, mat('#2a2d3c', {metalness: 0.7}), x, (yPiso - 0.3) / 2, z));
    }
    const vidrio = new THREE.MeshStandardMaterial({color: '#0a1830', transparent: true, opacity: 0.4, metalness: 0.9, roughness: 0.08, depthWrite: false}); res.push(vidrio);
    const hv = 2.4;
    g.add(caja(0.06, hv, B, vidrio, X0 + B, yPiso + hv / 2, Z0 + B / 2, false));
    g.add(caja(B, hv, 0.06, vidrio, X0 + B / 2, yPiso + hv / 2, Z0 + B, false));
    for (const y of [yPiso + 0.03, yPiso + hv]) {
      g.add(caja(0.08, 0.05, B + 0.08, nCian, X0 + B, y, Z0 + B / 2, false));
      g.add(caja(B + 0.08, 0.05, 0.08, nCian, X0 + B / 2, y, Z0 + B, false));
    }
    g.add(caja(0.08, hv, 0.08, nCian, X0 + B, yPiso + hv / 2, Z0 + B, false));
    const cvPr = document.createElement('canvas'); cvPr.width = 512; cvPr.height = 96;
    const xp = cvPr.getContext('2d'); xp.fillStyle = '#38e8ff'; xp.font = '800 56px ui-monospace, Menlo, monospace'; xp.textAlign = 'center'; xp.textBaseline = 'middle';
    xp.fillText('PRODUCCIÓN', 256, 50);
    const tPr = new THREE.CanvasTexture(cvPr); tPr.colorSpace = THREE.SRGBColorSpace; res.push(tPr);
    const letrero = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({map: tPr, transparent: true, toneMapped: false})); res.push(letrero.material);
    letrero.scale.set(2.6, 0.5, 1); letrero.rotation.y = Math.PI / 4; letrero.position.set(X0 + B - 0.8, yPiso + hv + 0.4, Z0 + B - 0.8); g.add(letrero);
    g.add(cilindro(0.18, 0.3, mat('#c9743e'), X0 + B - 0.35, yPiso + 0.15, Z0 + B - 0.35));
    const hoja = new THREE.Mesh(GEO.leaf, mat('#3fbf6a', {flatShading: true})); hoja.scale.setScalar(0.3); hoja.position.set(X0 + B - 0.35, yPiso + 0.55, Z0 + B - 0.35); g.add(hoja);

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
    const mCojin = mat('#' + tono(c, 0.45).getHexString(), {roughness: 0.9});
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
        cuerpo: new THREE.Color().setHSL((h % 360) / 360, 0.75, 0.58), piel: new THREE.Color(['#8d5a3b', '#6b4128', '#b07a52', '#4a2f1f'][h % 4]),
        pelo: new THREE.Color(['#15110f', '#2b1a10', '#d9b26a'][h % 3]), pantalon: new THREE.Color(['#1f2235', '#2b3a55', '#3a2a22'][h % 3])};
    });
    for (const im of [cojines, piernas, cuerpos, cabezas, pelos, celulares]) { im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(im); }
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

    set.updateMatrix();
    const enSala = p => p.applyMatrix4(set.matrix);
    const rMax = anillos.at(-1).r;
    return {brayan, clon, matHolo, proyector, haz, aro, luzRing, tally, matCorazon, matGafas, particulas: [], corazones: 0, regalos: 0, flash: 0,
      aforo: geo.stream.aforo, conectados: 0, objetivo: 0, cAforo: 0, g, centro: new THREE.Vector3(C.x, 0, C.z),
      inst: {piernas, cuerpos, cabezas, pelos, celulares}, lugares, ordenLlenado, personas: [], ocupadas: new Set(), entradas: 0,
      m4, v, sc, q2: new THREE.Quaternion(),
      neones: [nRosa, nCian, nMorado], pads, woofers, conos, ondas, onAir, beat: -1, objetivoLuz: new THREE.Vector3(C.x, alto, C.z),
      marcas: {brayan: enSala(new THREE.Vector3(0, 1.4, -0.27)), etqBrayan: enSala(new THREE.Vector3(-0.2, 2.15, -0.27)),
        clon: enSala(new THREE.Vector3(1.05, 2.25, 0.75)), publico: new THREE.Vector3(C.x + Math.SQRT1_2 * (rMax + 0.6), 1.6, C.z + Math.SQRT1_2 * (rMax + 0.6))},
      mirar: new THREE.Vector3(C.x, 1, C.z), gradas: estadio.M, gradasN: geo.stream.gradas.posiciones.length, leds: estadio.leds, parqueAnim: estadio.parqueAnim};
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
    // --- Bóveda: la fuente #1 de ingresos, con el último LIVE y la semana ---
    if (s.ultimoLive) {
      const u = s.ultimoLive || {};
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
      // Monedas: una por cada dólar de la semana, en columnas de 8
      const monedas = Math.min(160, Math.round(u.semanaUsd || 0));
      const geoMoneda = nuevo(new THREE.CylinderGeometry(0.16, 0.16, 0.045, 20));
      for (let i = 0; i < monedas; i++) {
        const col = Math.floor(i / 8), k = i % 8;
        const m = new THREE.Mesh(geoMoneda, oro);
        m.position.set(-1.45 + (col % 8) * 0.42, 0.14 + k * 0.05, 0.6 + Math.floor(col / 8) * 0.42); m.rotation.y = i * 0.7;
        m.castShadow = true; bv.add(m);
      }
      // Tablero con los números, encima de la puerta
      const usd = n => `$${Number(n || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      const num = n => Number(n || 0).toLocaleString('es-CO');
      const dur = u.minutos ? `${Math.floor(u.minutos / 60)} h ${u.minutos % 60} min` : '';
      const tablaB = new THREE.Mesh(GEO.plane, lienzo(1024, 460, (x, w, h) => {
        x.fillStyle = '#0d0903'; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#ffd34d'; x.lineWidth = 8; x.strokeRect(5, 5, w - 10, h - 10);
        x.fillStyle = '#ffd34d'; x.font = '800 58px ui-monospace, Menlo, monospace'; x.textAlign = 'center'; x.fillText('FUENTE #1 DE INGRESOS', w / 2, 82);
        x.textAlign = 'left';
        const linea = (y, et, val, extra) => {
          x.fillStyle = 'rgba(255,255,255,.65)'; x.font = '32px ui-monospace, Menlo, monospace'; x.fillText(et, 48, y);
          x.fillStyle = '#ffffff'; x.font = '800 60px ui-monospace, Menlo, monospace'; x.fillText(val, 330, y);
          x.fillStyle = '#ffd34d'; x.font = '32px ui-monospace, Menlo, monospace'; x.fillText(extra, 680, y);
        };
        linea(186, 'Último LIVE', usd(u.usd), `${num(u.diamantes)} 💎`);
        linea(276, 'Esta semana', usd(u.semanaUsd), `${num(u.semanaDiamantes)} 💎`);
        x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '30px ui-monospace, Menlo, monospace';
        x.fillText(`${num(u.espectadores)} espectadores · ${num(u.donadores)} donadores`, 48, 360);
        x.fillText(`+${num(u.nuevosSeguidores)} seguidores${dur ? ` · ${dur}` : ''}${u.fecha ? ` · ${u.fecha}` : ''}`, 48, 408);
      }));
      const anchoB = BV.B - 0.5;
      tablaB.scale.set(anchoB, anchoB * 460 / 1024, 1); tablaB.position.set(BV.x, 3.0 * e + anchoB * 230 / 1024, Z0 + 0.06); g.add(tablaB);
      const luz = new THREE.PointLight('#ffcf5a', 6, 7, 1.6); luz.position.set(0, 2.2, 0.6); bv.add(luz);
      leds.push({m: nOro, fase: 0, vel: 1.2});
    }
    // --- Parque de DURO LIVE (adentro, en la esquina de adelante): pasto, el camino por el eje y atracciones en espejo ---
    const PQ = geo.stream.parque, parqueAnim = [];
    if (PQ) {
      const largo = PQ.dEsq - PQ.dEnt, ang = Math.PI / 2 - frente;   // grupo alineado con el eje de la arena
      const zona = new THREE.Group(); zona.position.set(C.x, 0, C.z); zona.rotation.y = ang; g.add(zona);
      // El pasto es un cuadrado en la esquina de adelante de la sala (encaja justo con los bordes del piso)
      const desde = Math.min(...PQ.atracciones.map(a => Math.min(a.x, a.z) - a.r - 0.6)), hasta = L / 2;
      const pasto = new THREE.Mesh(GEO.plane, mat('#24563a', {roughness: 0.95})); pasto.rotation.x = -Math.PI / 2; pasto.receiveShadow = true;
      pasto.scale.set(hasta - desde, hasta - desde, 1); pasto.position.set((desde + hasta) / 2, 0.008, (desde + hasta) / 2); g.add(pasto);
      const neon = c_ => { const m = new THREE.MeshBasicMaterial({color: new THREE.Color(c_).multiplyScalar(1.5), toneMapped: false}); res.push(m); return m; };
      zona.add(caja(PQ.ancho, 0.04, largo, mat('#1a1530', {roughness: 0.4, metalness: 0.3}), 0, 0.02, PQ.dEnt + largo / 2, false));
      for (const sx of [-1, 1]) zona.add(caja(0.06, 0.04, largo, neon('#ff3d6e'), sx * PQ.ancho / 2, 0.05, PQ.dEnt + largo / 2, false));
      // Faroles en espejo a los dos lados del camino
      for (let d = PQ.dEnt + 1.5; d < PQ.dEsq - 0.5; d += 3) for (const sx of [-1, 1]) {
        zona.add(caja(0.07, 2.2, 0.07, mat('#2a2d3c', {metalness: 0.7}), sx * (PQ.ancho / 2 + 0.3), 1.1, d));
        zona.add(caja(0.22, 0.12, 0.22, neon('#ffb3c6'), sx * (PQ.ancho / 2 + 0.3), 2.25, d, false));
      }
      const colores = [s.color, '#ffd166', '#a855f7', '#38e8ff'];
      PQ.atracciones.forEach((a, i) => {
        const at = construirAtraccion(a.tipo, colores[Math.floor(i / 2) % colores.length], colores, i, res, parqueAnim);
        at.position.set(a.x, 0, a.z); g.add(at);
      });
    }
    return {M, leds, parqueAnim};
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
    const tamanos = [...normales.map(s => geometria(s).L), ...state.futuras.map(() => 5)];
    const {R, pos, maxL} = slots(tamanos);
    rt.extent = R + maxL * 0.75;

    // Salas: solo se reconstruye la que cambió de forma
    const vivos = new Set();
    normales.forEach((s, i) => {
      vivos.add(s.id);
      const firma = JSON.stringify([s.color, s.nombre, s.tipo, s.seguidores >= 1e6 ? 2 : s.seguidores >= 1e5 ? 1 : 0, geometria(s).L, s.agentes.map(a => a.nombre + a.estado), geometria(s).stream?.aforo, geometria(s).fans?.ahora?.posiciones.length, s.ultimoLive, s.codigo, s.estudio?.map(e => e.real)]);
      let room = rt.rooms.get(s.id);
      if (!room || room.firma !== firma) {
        if (room) { mundo.remove(room.g); room.res.forEach(r => r.dispose()); }
        room = construirSala(s); room.firma = firma; room.agentes = []; mundo.add(room.g);
        rt.rooms.set(s.id, room);
        montarAgentes(room, s);
      }
      room.s = s; room.g.position.copy(pos[i]);
    });
    for (const [id, room] of rt.rooms) if (!vivos.has(id)) { mundo.remove(room.g); room.res.forEach(r => r.dispose()); rt.rooms.delete(id); }

    // Lotes futuros
    rt.futuras.forEach(f => mundo.remove(f.g)); rt.futuras = [];
    state.futuras.forEach((nombre, j) => {
      const p = pos[normales.length + j]; if (!p) return;
      const g = new THREE.Group(); g.position.copy(p);
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 0.02, 5)), new THREE.LineDashedMaterial({color: '#4b56a0', dashSize: 0.4, gapSize: 0.3}));
      borde.computeLineDistances(); g.add(borde);
      const base = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({color: '#3a4590', transparent: true, opacity: 0.08}));
      base.scale.set(5, 5, 1); base.rotation.x = -Math.PI / 2; base.userData = {futura: j}; g.add(base);
      mundo.add(g); rt.futuras.push({g, base, nombre, j});
    });

    // Caminos
    mundo.remove(rt.caminos); rt.caminos = new THREE.Group(); mundo.add(rt.caminos);
    pos.slice(0, normales.length + state.futuras.length).forEach((p, i) => {
      const dir = p.clone().normalize();
      const L = i < normales.length ? geometria(normales[i]).L : 5;
      rt.caminos.add(camino(dir.clone().multiplyScalar(HUB_R - 0.2), p.clone().sub(dir.clone().multiplyScalar(L * 0.62)), i < normales.length));
    });

    construirPaseo();

    calcAsignaciones();
    construirEtiquetas();
    ajustarCamara();
  }

  // ---------- Paseo de TikTok a DURO LIVE ----------
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
        room.etqSet = {brayan: mini(), clon: mini(), publico: mini(), clave: ''};
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
    const p = room ? room.g.position.clone().add(new THREE.Vector3(0, 1, 0)) : new THREE.Vector3(0, 2, 0);
    const L = room ? room.geo.L : 9;
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
    switch (A.modo) {
      case 'sentado':
        A.timer -= dt;
        if (A.timer <= 0) { A.destino = elegirDestino(room, A); A.path = ruta(A, A.destino, geo); A.modo = 'caminando'; }
        break;
      case 'caminando':
        if (mover(A, dt)) {
          A.modo = 'visita'; A.timer = rand(3, 7);
          const d = A.destino;
          const mira = d.tag === 'charla' ? d.con : d.tag === 'live' ? (room.stream?.mirar || room.red?.mirar) : null;
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
        x.fillText(`Mejor hora ${stats.mejorHora || '—'} · ${stats.mejorDia || ''}`, tx, 168);
        x.fillStyle = 'rgba(255,255,255,.38)';
        x.fillText(`${stats.directos ?? '—'} directos · $${Number(stats.ingresosDirectos ?? 0).toFixed(2)} este mes`, tx, 206);
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
    }
    const enSala = S.personas.filter(p => p.estado !== 'saliendo').length;
    S.cEntrada = (S.cEntrada ?? 0) - dt;
    if (S.cEntrada <= 0) {
      if (enSala < Math.min(S.objetivo, S.aforo)) {
        // La siguiente silla libre en el orden simétrico
        const asiento = S.ordenLlenado.find(i => !S.ocupadas.has(i));
        if (asiento !== undefined) {
          const p = {asiento, d: 0, estado: 'entrando'};
          // Si hay parque de TikTok al lado, la persona sale de ahí y camina hasta la entrada de la arena
          const pre = vivo ? caminoDesdeTikTok(room, S.lugares[asiento].pts[0]) : null;
          if (pre) Object.assign(p, {pre: pre.ruta, origen: pre.origen});
          S.ocupadas.add(asiento); S.personas.push(p); S.entradas++; contarEntrada(room.s.id);
        }
        S.cEntrada = vivo ? 0.35 : 0.1;
      } else if (enSala > Math.min(S.objetivo, S.aforo)) {
        // Sale el último que entró (así el graderío se vacía también parejo)
        const p = [...S.personas].reverse().find(p => p.estado !== 'saliendo');
        if (p) { p.estado = 'saliendo'; p.d = Math.min(p.d, S.lugares[p.asiento].largos.at(-1) + (p.pre?.largo || 0)); }
        S.cEntrada = vivo ? 0.35 : 0.06;
      }
    }
    const {piernas, cuerpos, cabezas, pelos, celulares} = S.inst, m4 = S.m4, v = S.v, sc = S.sc, q2 = S.q2;
    let j = 0, nCel = 0;
    S.personas = S.personas.filter(p => {
      const L_ = S.lugares[p.asiento], pre = p.pre?.largo || 0, total = pre + L_.largos.at(-1);
      // Los que vienen desde TikTok caminan más rápido (el trayecto es largo)
      const vel = p.d < pre ? 4.5 : 2.2;
      if (p.estado === 'entrando') { p.d += dt * vel; if (p.d >= total) { p.d = total; p.estado = 'sentado'; } }
      else if (p.estado === 'saliendo') { p.d -= dt * (p.d < pre ? 4.5 : 2.6); if (p.d <= 0) { S.ocupadas.delete(p.asiento); devolverATikTok(p); return false; } }
      // Posición sobre el camino: primero el trayecto desde TikTok, luego el de la arena
      let a, b;
      if (p.d < pre) { const r_ = enRuta(p.pre, p.d / pre); v.set(r_.x, r_.y, r_.z); a = {x: 0, z: 0}; b = {x: r_.dx, z: r_.dz}; }
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
      piernas.setColorAt(j, L_.pantalon); cuerpos.setColorAt(j, L_.cuerpo); cabezas.setColorAt(j, L_.piel); pelos.setColorAt(j, L_.pelo);
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
    if (S.gradas) moverMultitud(S.gradas, vivo ? Math.max(0, S.objetivo - S.aforo) : 0, dt, room.s.id, false);
    S.enGradas = S.gradas ? S.gradas.personas.filter(p => p.estado === 'quieto').length : 0;
    S.conectados = S.sentados + S.enGradas;
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
      const clave = `${vivo}|${st.clon}|${S.conectados}|${S.entradas}`;
      if (e.clave !== clave) {
        e.clave = clave;
        e.brayan.innerHTML = `<b>Brayan Trampa</b>${vivo ? '<em class="rojo">● EN VIVO</em>' : '<small>en su casa</small>'}`;
        e.clon.innerHTML = `<b>Brayan IA</b><small>${{planeado: 'planeado', desarrollo: 'en desarrollo', activo: 'activo'}[st.clon || 'planeado']}</small>`;
        e.publico.innerHTML = vivo
          ? `<b>👥 ${S.conectados.toLocaleString('es-CO')} conectados ahora</b><small>pista ${S.sentados}/${S.aforo} · gradas ${S.enGradas.toLocaleString('es-CO')} · ${S.entradas} entradas</small>`
          : `<b>🏟️ ${(S.aforo + S.gradasN).toLocaleString('es-CO')} lugares</b><small>${S.conectados ? `saliendo… ${S.conectados}` : 'vacío: se llena con la gente que entra en vivo'}</small>`;
      }
      // Solo se muestran al entrar a la sala, para no llenar el mapa general de texto
      const dentro = rt.foco === room.s.id;
      for (const el of [e.brayan, e.clon, e.publico]) el.style.display = dentro ? '' : 'none';
      ubicar(e.brayan, tmpW.copy(S.marcas.etqBrayan).add(room.g.position), -4);
      ubicar(e.clon, tmpW.copy(S.marcas.clon).add(room.g.position), -4);
      ubicar(e.publico, tmpW.copy(S.marcas.publico).add(room.g.position));
    }
    return vivo;
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
