import * as THREE from 'three';
import './style.css';

const canvas = document.querySelector('#scene-canvas');
const app = document.querySelector('#app');
const panel = document.querySelector('#mode-panel');
const detailCard = document.querySelector('#detail-card');
const toast = document.querySelector('#toast');
const vrButton = document.querySelector('#vr-toggle');
const photoModal = document.querySelector('#photo-modal');
const photoRange = document.querySelector('#photo-range');
const mapPlayer = document.querySelector('#map-player');
const roomStatusText = document.querySelector('#room-status-text');

const ROOM = { width: 16, depth: 12, wall: 5.98, height: 4.35 };
const MAX_PEOPLE = 28;
const sharedColliders = [];
const furnitureColliders = { equipped: [], base: [] };

function addCollider(list, x, z, width, depth) {
  list.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
}

function isBlocked(x, z, state = roomState, radius = .28) {
  const obstacles = [...sharedColliders, ...furnitureColliders[state]];
  return obstacles.some((item) => x > item.minX - radius && x < item.maxX + radius && z > item.minZ - radius && z < item.maxZ + radius);
}
const keys = new Set();
const touchMoves = new Set();
let currentView = 'explore';
let roomState = 'equipped';
let toastTimer;
let lastFrame = 0;
let lastMapUpdate = 0;
let vrSupported = false;
let dragging = false;
let pointerMoved = false;
let previousPointer = { x: 0, y: 0 };
let activePointer = null;

const equipment = {
  osciloscopio: {
    title: 'Osciloscopio',
    short: 'Lectura de señales en el tiempo',
    eyebrow: 'INSTRUMENTO DE MEDICIÓN',
    icon: 'scope',
    description: 'Permite observar cómo cambia una señal eléctrica a lo largo del tiempo y comparar amplitud, periodo, frecuencia y desfase entre canales.',
    practice: 'Visualizar señales de circuitos, reconocer transitorios y contrastar la medición con el comportamiento esperado.',
    relation: 'Circuitos eléctricos · Señales y sistemas · Electrónica análoga',
    note: 'La referencia no permite identificar marca o modelo. La simulación muestra un equipo genérico; las especificaciones deben completarse con el inventario del laboratorio.'
  },
  fuente: {
    title: 'Fuente de alimentación',
    short: 'Energía regulada para el montaje',
    eyebrow: 'INSTRUMENTO DE ALIMENTACIÓN',
    icon: 'source',
    description: 'Entrega energía eléctrica regulada para alimentar prototipos y circuitos de práctica. En la actividad se ajustan los niveles de salida y se trabaja con límites de corriente de forma segura.',
    practice: 'Energizar un montaje, verificar polaridad y observar cómo responde el circuito ante cambios en la alimentación.',
    relation: 'Circuitos eléctricos · Electrónica análoga · Instrumentación y mediciones',
    note: 'Las fotografías no muestran con suficiente detalle las placas de identificación. No se atribuyen voltajes, corrientes ni modelos específicos.'
  },
  generador: {
    title: 'Generador de señales',
    short: 'Señales de prueba para experimentar',
    eyebrow: 'INSTRUMENTO DE EXCITACIÓN',
    icon: 'generator',
    description: 'Produce señales de prueba —por ejemplo, senoidales, cuadradas o triangulares— para estudiar la respuesta de un circuito al cambiar frecuencia y amplitud.',
    practice: 'Excitar un circuito y observar su respuesta en el osciloscopio; relacionar la forma de onda de entrada con la salida.',
    relation: 'Señales y sistemas · Electrónica análoga · Control automático',
    note: 'Representación genérica basada en la fotografía. El rango de frecuencia y las funciones disponibles dependen del equipo real.'
  }
};

const courses = [
  {
    id: 'circuitos', title: 'Circuitos eléctricos', area: 'ANÁLISIS Y MEDICIÓN',
    description: 'Prácticas de análisis de redes, respuesta transitoria y medición de variables eléctricas en montajes de baja tensión.',
    practice: 'Armar un circuito, alimentarlo desde la fuente y contrastar sus señales con las lecturas del osciloscopio.',
    equipment: 'Fuente regulable · Osciloscopio · Generador de señales'
  },
  {
    id: 'electronica-analoga', title: 'Electrónica análoga', area: 'DISEÑO DE CIRCUITOS',
    description: 'Exploración de componentes, amplificación y acondicionamiento de señales mediante montajes de laboratorio.',
    practice: 'Comparar la señal de entrada y salida de una etapa electrónica y observar el efecto de variar sus parámetros.',
    equipment: 'Fuente regulable · Generador de señales · Osciloscopio'
  },
  {
    id: 'electronica-digital', title: 'Electrónica digital', area: 'LÓGICA Y SISTEMAS',
    description: 'Trabajo con niveles lógicos, señales de reloj y circuitos digitales para observar su comportamiento de forma experimental.',
    practice: 'Inyectar señales de prueba, identificar niveles y analizar la temporización de una implementación.',
    equipment: 'Fuente regulable · Osciloscopio · Generador de señales'
  },
  {
    id: 'senales', title: 'Señales y sistemas', area: 'DOMINIO DEL TIEMPO',
    description: 'Análisis práctico de formas de onda y de la respuesta de sistemas ante diferentes señales de entrada.',
    practice: 'Cambiar la frecuencia de excitación y observar desfase, amplitud y respuesta temporal.',
    equipment: 'Generador de señales · Osciloscopio'
  },
  {
    id: 'control', title: 'Control automático', area: 'RESPUESTA DE SISTEMAS',
    description: 'Actividades demostrativas para observar respuestas, perturbaciones y señales en sistemas de control e instrumentación.',
    practice: 'Usar señales de prueba para discutir respuesta, estabilidad y comportamiento de un sistema.',
    equipment: 'Fuente regulable · Generador de señales · Osciloscopio'
  },
  {
    id: 'instrumentacion', title: 'Instrumentación y mediciones', area: 'PRÁCTICA EXPERIMENTAL',
    description: 'Familiarización con instrumentos, conexiones, lectura de señales y buenas prácticas para medir en el laboratorio.',
    practice: 'Seleccionar el instrumento apropiado, observar una señal y documentar las mediciones del montaje.',
    equipment: 'Osciloscopio · Fuente regulable · Generador de señales'
  }
];

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c9d0cc');
scene.fog = new THREE.Fog('#c9d0cc', 25, 42);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 65);
camera.position.set(0, 1.68, 0);
camera.rotation.order = 'YXZ';
const player = new THREE.Group();
player.position.set(0, 0, 5.18);
player.add(camera);
scene.add(player);

const equippedGroup = new THREE.Group();
equippedGroup.name = 'Montaje equipado';
scene.add(equippedGroup);
const baseGroup = new THREE.Group();
baseGroup.name = 'Espacio base';
scene.add(baseGroup);
baseGroup.visible = false;

const materials = {
  concrete: new THREE.MeshStandardMaterial({ color: '#96958e', roughness: .92 }),
  plaster: new THREE.MeshStandardMaterial({ color: '#e1e0d8', roughness: .86 }),
  floor: new THREE.MeshStandardMaterial({ color: '#b6b5ae', roughness: .84 }),
  steel: new THREE.MeshStandardMaterial({ color: '#858d8d', roughness: .38, metalness: .48 }),
  steelDark: new THREE.MeshStandardMaterial({ color: '#434b4b', roughness: .47, metalness: .38 }),
  wood: new THREE.MeshStandardMaterial({ color: '#504037', roughness: .79 }),
  benchTop: new THREE.MeshStandardMaterial({ color: '#c4c4bd', roughness: .55 }),
  chair: new THREE.MeshStandardMaterial({ color: '#e6e3dc', roughness: .63 }),
  blue: new THREE.MeshStandardMaterial({ color: '#0757c8', roughness: .44, metalness: .12 }),
  blueDark: new THREE.MeshStandardMaterial({ color: '#0646a3', roughness: .48, metalness: .12 }),
  glass: new THREE.MeshStandardMaterial({ color: '#a8cad0', roughness: .18, metalness: .16, transparent: true, opacity: .55, side: THREE.DoubleSide }),
  glassWarm: new THREE.MeshStandardMaterial({ color: '#c6d7d2', roughness: .2, metalness: .08, transparent: true, opacity: .4, side: THREE.DoubleSide }),
  emissiveLight: new THREE.MeshStandardMaterial({ color: '#fff8e5', emissive: '#fff4d4', emissiveIntensity: 2.3, roughness: .25 }),
  black: new THREE.MeshStandardMaterial({ color: '#1c2322', roughness: .42 }),
  instrument: new THREE.MeshStandardMaterial({ color: '#9da09b', roughness: .47, metalness: .18 }),
  instrumentDark: new THREE.MeshStandardMaterial({ color: '#4a504e', roughness: .55, metalness: .1 }),
  skin: new THREE.MeshStandardMaterial({ color: '#be8c68', roughness: .8 }),
  hair: new THREE.MeshStandardMaterial({ color: '#332820', roughness: .9 })
};

function box(parent, name, dimensions, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  if (options.userData) Object.assign(mesh.userData, options.userData);
  parent.add(mesh);
  return mesh;
}

function makeBlockTexture() {
  const canvasTex = document.createElement('canvas');
  canvasTex.width = 1024;
  canvasTex.height = 512;
  const ctx = canvasTex.getContext('2d');
  ctx.fillStyle = '#a19f97';
  ctx.fillRect(0, 0, canvasTex.width, canvasTex.height);
  const blockW = 128;
  const blockH = 78;
  for (let row = 0; row < 7; row++) {
    const offset = row % 2 ? -64 : 0;
    for (let x = offset; x < canvasTex.width + blockW; x += blockW) {
      const shade = 148 + ((row * 17 + Math.floor((x + 70) / blockW) * 13) % 26);
      ctx.fillStyle = `rgb(${shade},${shade - 1},${shade - 6})`;
      ctx.fillRect(x + 2, row * blockH + 2, blockW - 4, blockH - 4);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(x + 4, row * blockH + 3, blockW - 8, 4);
      ctx.fillStyle = 'rgba(45,47,45,.19)';
      ctx.fillRect(x, row * blockH + blockH - 3, blockW, 3);
      ctx.fillRect(x + blockW - 3, row * blockH, 3, blockH);
    }
  }
  const texture = new THREE.CanvasTexture(canvasTex);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
const blockTexture = makeBlockTexture();
function blockMaterial(width, height) {
  const map = blockTexture.clone();
  map.needsUpdate = true;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(width / 3.2, height / 1.8);
  return new THREE.MeshStandardMaterial({ map, color: '#eeeeeb', roughness: .94 });
}

function wallPlane(name, width, height, position, orientation, material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.position.set(...position);
  if (orientation === 'left') mesh.rotation.y = Math.PI / 2;
  if (orientation === 'right') mesh.rotation.y = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function buildArchitecture() {
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = floorCanvas.height = 256;
  const ctx = floorCanvas.getContext('2d');
  ctx.fillStyle = '#c0beb7';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(255,255,255,.11)';
  ctx.fillRect(4, 4, 246, 246);
  ctx.strokeStyle = 'rgba(70,72,69,.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 252, 252);
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(16, 12);
  floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  materials.floor.map = floorTex;
  materials.floor.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), materials.floor);
  floor.name = 'Piso';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.isFloor = true;
  scene.add(floor);
  window.floorMesh = floor;

  const backZ = -ROOM.wall;
  wallPlane('Muro posterior bajo', ROOM.width, 2.42, [0, 1.21, backZ], 'back', blockMaterial(ROOM.width, 2.42));
  wallPlane('Muro posterior alto', ROOM.width, .94, [0, 3.88, backZ], 'back', blockMaterial(ROOM.width, .94));

  const windowY = 2.92;
  const windowH = .94;
  const windowWidth = 1.78;
  for (let i = 0; i < 8; i++) {
    const x = -6.86 + i * 1.96;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(windowWidth, windowH), i % 3 === 0 ? materials.glassWarm : materials.glass);
    pane.position.set(x, windowY, backZ + .055);
    pane.receiveShadow = true;
    scene.add(pane);
    box(scene, 'Marco vertical de ventana', [.055, 1.05, .07], [x - windowWidth / 2, windowY, backZ + .04], materials.steel, { castShadow: false });
    box(scene, 'Marco vertical de ventana', [.055, 1.05, .07], [x + windowWidth / 2, windowY, backZ + .04], materials.steel, { castShadow: false });
  }
  box(scene, 'Dintel de ventanas', [ROOM.width, .09, .1], [0, 3.42, backZ + .025], materials.steel, { castShadow: false });
  box(scene, 'Alféizar de ventanas', [ROOM.width, .11, .11], [0, 2.43, backZ + .025], materials.steel, { castShadow: false });
  box(scene, 'Travesaño de ventanas', [ROOM.width, .045, .09], [0, 2.91, backZ + .02], materials.steel, { castShadow: false });

  wallPlane('Muro izquierdo de bloque', ROOM.depth, 2.35, [-ROOM.width / 2, 1.175, 0], 'left', blockMaterial(ROOM.depth, 2.35));
  wallPlane('Muro izquierdo alto', ROOM.depth, 2.0, [-ROOM.width / 2, 3.35, 0], 'left', new THREE.MeshStandardMaterial({ color: '#b7b5ae', roughness: .9 }));
  wallPlane('Muro derecho', ROOM.depth, ROOM.height, [ROOM.width / 2, ROOM.height / 2, 0], 'right', materials.plaster);

  // Ventanas altas y perfiles en el muro lateral izquierdo.
  for (let i = 0; i < 5; i++) {
    const z = -4.25 + i * 2.05;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.74, .62), materials.glassWarm);
    pane.position.set(-ROOM.width / 2 + .055, 2.82, z);
    pane.rotation.y = Math.PI / 2;
    scene.add(pane);
    box(scene, 'Perfil ventana lateral', [.07, .68, .055], [-ROOM.width / 2 + .02, 2.82, z - .87], materials.steel, { castShadow: false });
    box(scene, 'Perfil ventana lateral', [.07, .68, .055], [-ROOM.width / 2 + .02, 2.82, z + .87], materials.steel, { castShadow: false });
  }

  // Columna y paños claros en la zona de circulación lateral.
  box(scene, 'Columna estructural derecha', [.48, 4.12, .54], [5.35, 2.06, -3.45], materials.plaster, { castShadow: true });
  box(scene, 'Base de columna', [.62, .12, .68], [5.35, .06, -3.45], materials.plaster);
  box(scene, 'Columna posterior', [.34, 3.85, .42], [-5.5, 1.93, -4.55], materials.plaster, { castShadow: true });
  addCollider(sharedColliders, 5.35, -3.45, .7, .72);
  addCollider(sharedColliders, -5.5, -4.55, .55, .6);

  // Puerta de servicio en el lateral izquierdo, orientada hacia el espacio.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.22), new THREE.MeshStandardMaterial({ color: '#aeb7b6', roughness: .48, metalness: .15, side: THREE.DoubleSide }));
  door.position.set(-7.955, 1.12, 1.08);
  door.rotation.y = Math.PI / 2;
  scene.add(door);
  box(scene, 'Marco superior de puerta', [.12, .08, 1.28], [-7.9, 2.26, 1.08], materials.steel, { castShadow: false });
  box(scene, 'Visor de puerta', [.025, .48, .22], [-7.89, 1.61, 1.08], materials.glass, { castShadow: false });
  box(scene, 'Manija de puerta', [.055, .15, .035], [-7.84, 1.05, .72], materials.black, { castShadow: false });
  box(scene, 'Protector de puerta', [.04, .12, .23], [-7.84, .96, 1.08], materials.blueDark, { castShadow: false });

  // Archivadores azules, inspirados en el armario de las fotografías.
  const lockerX = -7.16;
  const lockerZ = 4.46;
  addCollider(sharedColliders, lockerX, lockerZ, 1.15, .86);
  box(scene, 'Archivador azul', [1.1, 2.72, .78], [lockerX, 1.36, lockerZ], materials.blue, { castShadow: true });
  for (let level = 0; level < 2; level++) {
    const y = .69 + level * 1.34;
    for (let doorIndex = 0; doorIndex < 2; doorIndex++) {
      const x = lockerX - .265 + doorIndex * .53;
      box(scene, 'Puerta de archivador', [.51, 1.26, .045], [x, y, lockerZ + .411], doorIndex === 0 ? materials.blue : materials.blueDark, { castShadow: false });
      box(scene, 'Tirador de archivador', [.025, .15, .025], [x + .15, y, lockerZ + .44], materials.steel, { castShadow: false });
    }
  }
  box(scene, 'Zócalo de archivador', [1.11, .07, .8], [lockerX, .035, lockerZ], materials.steelDark, { castShadow: false });

  buildCeiling();
}

function buildCeiling() {
  const ductMat = new THREE.MeshStandardMaterial({ color: '#9aa0a0', roughness: .4, metalness: .62 });
  const ductDark = new THREE.MeshStandardMaterial({ color: '#687071', roughness: .54, metalness: .45 });
  const beamMat = new THREE.MeshStandardMaterial({ color: '#454d4b', roughness: .63, metalness: .38 });
  const ceilingY = 4.13;

  // Ventilation trunks, transversales y longitudinales.
  box(scene, 'Ducto principal frontal', [15.8, .46, .72], [0, 3.88, 1.35], ductMat);
  box(scene, 'Ducto principal posterior', [15.8, .42, .62], [0, 3.91, -2.35], ductMat);
  for (const x of [-6.2, -2.1, 2.0, 6.0]) {
    box(scene, 'Ducto longitudinal', [.58, .42, 11.4], [x, 3.91, 0], ductMat);
    box(scene, 'Borde inferior de ducto', [.62, .045, 11.35], [x, 3.685, 0], ductDark, { castShadow: false });
  }
  for (const z of [-4.4, -.55, 3.15]) {
    box(scene, 'Viga de techo expuesta', [16, .1, .12], [0, ceilingY, z], beamMat, { castShadow: false });
  }

  // Canalizaciones y tuberías vistas.
  const pipeMat = new THREE.MeshStandardMaterial({ color: '#c1c3bd', roughness: .43, metalness: .65 });
  const pipeBlue = new THREE.MeshStandardMaterial({ color: '#6488a7', roughness: .42, metalness: .45 });
  function pipeAlongX(length, radius, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
    mesh.position.set(x, y, z);
    mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = false;
    scene.add(mesh);
  }
  function pipeAlongZ(length, radius, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = false;
    scene.add(mesh);
  }
  pipeAlongX(15.7, .035, 0, 4.19, -.15, pipeMat);
  pipeAlongX(15.7, .024, 0, 4.23, -.42, pipeBlue);
  pipeAlongX(15.7, .025, 0, 4.19, 3.77, pipeMat);
  pipeAlongZ(11.5, .028, -4.45, 4.18, 0, pipeMat);
  pipeAlongZ(11.5, .021, 4.35, 4.2, 0, pipeBlue);

  // Luminarias lineales suspendidas bajo la red de ductos.
  const lightPositions = [
    [-4.7, 3.63, 2.35], [-.35, 3.61, 2.15], [4.0, 3.63, 2.4],
    [-4.7, 3.63, -1.05], [-.35, 3.61, -1.0], [4.0, 3.63, -1.0]
  ];
  for (const [x, y, z] of lightPositions) {
    box(scene, 'Luminaria suspendida', [.16, .075, 2.18], [x, y, z], materials.emissiveLight, { castShadow: false });
    box(scene, 'Carcasa de luminaria', [.25, .055, 2.26], [x, y + .048, z], ductDark, { castShadow: false });
  }

  // Pequeñas suspensiones y rejillas para hacer legible la infraestructura.
  for (const x of [-6.2, -2.1, 2.0, 6.0]) {
    for (const z of [-3.8, 2.9]) {
      box(scene, 'Soporte de ducto', [.035, .28, .035], [x, 4.23, z], ductDark, { castShadow: false });
    }
  }
}

function buildLighting() {
  const hemi = new THREE.HemisphereLight(0xe9f2f0, 0x7c7568, 2.05);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4df, 2.4);
  key.position.set(-4.5, 8.5, 5.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 24;
  key.shadow.camera.left = -11;
  key.shadow.camera.right = 11;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -.0005;
  key.shadow.normalBias = .025;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd4e5f5, .7);
  fill.position.set(6, 5.5, -5);
  scene.add(fill);
  const frontFill = new THREE.DirectionalLight(0xffe5c3, .55);
  frontFill.position.set(0, 5, 7);
  scene.add(frontFill);
}

function buildBaseState() {
  const plainTop = new THREE.MeshStandardMaterial({ color: '#d0d0c8', roughness: .62 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#8c9391', roughness: .5, metalness: .42 });
  const darkChair = new THREE.MeshStandardMaterial({ color: '#2d3332', roughness: .6 });
  function plainTable(x, z, width = 1.65, depth = 1.0, y = .78) {
    addCollider(furnitureColliders.base, x, z, width, depth);
    box(baseGroup, 'Mesa auxiliar del espacio base', [width, .075, depth], [x, y, z], plainTop);
    for (const dx of [-width / 2 + .09, width / 2 - .09]) {
      for (const dz of [-depth / 2 + .08, depth / 2 - .08]) {
        box(baseGroup, 'Pata de mesa auxiliar', [.065, y - .045, .065], [x + dx, (y - .075) / 2, z + dz], legMat);
      }
    }
  }
  function officeChair(x, z, rotation = 0) {
    addCollider(furnitureColliders.base, x, z, .52, .58);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotation;
    baseGroup.add(g);
    box(g, 'Asiento de silla auxiliar', [.43, .1, .43], [0, .47, 0], darkChair);
    box(g, 'Respaldo de silla auxiliar', [.43, .5, .08], [0, .76, .2], darkChair);
    box(g, 'Pata central de silla auxiliar', [.07, .45, .07], [0, .23, 0], legMat);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const leg = box(g, 'Base de silla auxiliar', [.32, .035, .045], [Math.cos(angle) * .16, .04, Math.sin(angle) * .16], legMat);
      leg.rotation.y = angle;
    }
  }
  plainTable(-5.25, 3.25, 1.8, 1.1, .77);
  plainTable(-3.05, .45, 1.65, 1.2, .78);
  plainTable(-1.2, -.65, 1.55, 1.05, .79);
  plainTable(.05, -2.75, 1.0, 1.35, .78);
  plainTable(5.9, -.4, 1.35, 2.45, .8);
  plainTable(-6.0, 5.0, 1.55, .9, .76);
  officeChair(-5.7, 4.35, Math.PI);
  officeChair(-5.2, 2.3, 0);
  officeChair(-6.4, 4.8, .12);
}

const equipmentRoots = [];
const seats = [];
const pickables = [];

function makeDisplayTexture(label, tone) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0e1817';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = tone;
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
  ctx.fillStyle = tone;
  ctx.font = '700 27px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(label, 15, 36);
  ctx.globalAlpha = .7;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(15, 92);
  ctx.bezierCurveTo(44, 70, 58, 112, 84, 86);
  ctx.bezierCurveTo(108, 61, 119, 107, 145, 79);
  ctx.bezierCurveTo(172, 54, 189, 100, 238, 72);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const instrumentDisplay = {
  osciloscopio: { label: 'OSC', tone: '#84e8ab' },
  fuente: { label: 'DC', tone: '#f4d16f' },
  generador: { label: 'GEN', tone: '#80d7dc' }
};

function addInstrument(parent, type, x, z, bankNumber) {
  const root = new THREE.Group();
  root.name = `${equipment[type].title} · Banco ${bankNumber}`;
  root.position.set(x, 1.105, z);
  root.userData.equipmentId = type;
  root.userData.bankNumber = bankNumber;
  parent.add(root);
  box(root, 'Carcasa del instrumento', [.56, .34, .34], [0, 0, 0], materials.instrument, { castShadow: true });
  box(root, 'Frente oscuro del instrumento', [.52, .28, .025], [0, -.005, .175], materials.instrumentDark, { castShadow: false });

  const d = instrumentDisplay[type];
  const displayTexture = makeDisplayTexture(d.label, d.tone);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(.28, .135), new THREE.MeshBasicMaterial({ map: displayTexture, side: THREE.DoubleSide }));
  display.position.set(-.085, .055, .190);
  display.name = 'Pantalla';
  display.userData.equipmentId = type;
  root.add(display);

  const knobMat = new THREE.MeshStandardMaterial({ color: '#262c2b', roughness: .38, metalness: .14 });
  for (const [kx, ky, r] of [[.135, .065, .035], [.135, -.04, .027], [.207, -.04, .027]]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .025, 12), knobMat);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(kx, ky, .193);
    knob.name = 'Control de instrumento';
    knob.userData.equipmentId = type;
    root.add(knob);
  }
  const status = new THREE.Mesh(new THREE.SphereGeometry(.017, 8, 8), new THREE.MeshBasicMaterial({ color: type === 'fuente' ? '#f2ce5e' : '#76dfaa' }));
  status.position.set(-.21, -.095, .193);
  status.userData.equipmentId = type;
  root.add(status);
  equipmentRoots.push(root);
  pickables.push(root);
}

function cylinderBetween(parent, start, end, radius, material, name = 'Segmento') {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .92, radius, direction.length(), 7), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

const clothing = ['#718775', '#74869b', '#b67850', '#6c8184', '#aa8065', '#728d59', '#806f91', '#b4a15e'];
function makePerson(index) {
  const person = new THREE.Group();
  person.name = 'Estudiante';
  const shirt = new THREE.MeshStandardMaterial({ color: clothing[index % clothing.length], roughness: .83 });
  const pants = new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? '#3c4643' : '#4a4440', roughness: .9 });
  const skin = new THREE.MeshStandardMaterial({ color: ['#bb8765', '#d1a17d', '#996a4e', '#e0b490'][index % 4], roughness: .85 });
  const hair = new THREE.MeshStandardMaterial({ color: ['#33271f', '#4b382d', '#252521', '#584034'][index % 4], roughness: .95 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.19, .235, .48, 8), shirt);
  torso.position.set(0, 1.03, -.01);
  torso.castShadow = true;
  person.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.065, .07, .1, 7), skin);
  neck.position.set(0, 1.31, -.015);
  person.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.135, 12, 10), skin);
  head.position.set(0, 1.46, -.035);
  head.castShadow = true;
  person.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.138, 12, 8, 0, Math.PI * 2, 0, Math.PI * .53), hair);
  hairCap.position.set(0, 1.49, -.047);
  person.add(hairCap);

  for (const side of [-1, 1]) {
    cylinderBetween(person, [side * .09, .82, .015], [side * .105, .55, -.25], .085, pants, 'Muslo');
    cylinderBetween(person, [side * .105, .55, -.25], [side * .11, .2, -.44], .062, pants, 'Pierna');
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(.13, .08, .2), new THREE.MeshStandardMaterial({ color: '#282e2d', roughness: .75 }));
    shoe.position.set(side * .11, .12, -.49);
    person.add(shoe);
    cylinderBetween(person, [side * .19, 1.17, -.01], [side * .25, 1.0, -.19], .045, shirt, 'Brazo');
    cylinderBetween(person, [side * .25, 1.0, -.19], [side * .17, .93, -.35], .04, skin, 'Antebrazo');
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.045, 7, 6), skin);
    hand.position.set(side * .17, .93, -.35);
    person.add(hand);
  }
  return person;
}

function createChair(parent, seatId, x, z, rotation, bankNumber, label) {
  addCollider(furnitureColliders.equipped, x, z, .52, .58);
  const chairGroup = new THREE.Group();
  chairGroup.name = `Puesto ${seatId + 1} · ${label}`;
  chairGroup.position.set(x, 0, z);
  chairGroup.rotation.y = rotation;
  parent.add(chairGroup);

  const white = materials.chair;
  const legMaterial = new THREE.MeshStandardMaterial({ color: '#d4d0c7', roughness: .7, metalness: .06 });
  box(chairGroup, 'Asiento plástico', [.43, .075, .42], [0, .49, .015], white);
  box(chairGroup, 'Respaldo plástico', [.43, .47, .07], [0, .77, .205], white);
  for (const sx of [-.13, 0, .13]) {
    box(chairGroup, 'Listón del respaldo', [.035, .34, .035], [sx, .77, .246], legMaterial, { castShadow: false });
  }
  for (const sx of [-.16, .16]) {
    for (const sz of [-.15, .17]) {
      box(chairGroup, 'Pata de silla', [.042, .47, .042], [sx, .24, sz], legMaterial, { castShadow: false });
    }
  }
  box(chairGroup, 'Travesaño de silla', [.33, .035, .035], [0, .27, .14], legMaterial, { castShadow: false });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(.215, .014, 5, 24),
    new THREE.MeshBasicMaterial({ color: '#b8ec5b', transparent: true, opacity: .92 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, .535, 0);
  ring.visible = false;
  ring.name = 'Indicador de puesto disponible';
  chairGroup.add(ring);

  const target = new THREE.Mesh(
    new THREE.SphereGeometry(.28, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false })
  );
  target.position.set(0, .67, 0);
  target.name = 'Zona interactiva del puesto';
  target.userData.seatId = seatId;
  chairGroup.add(target);
  pickables.push(target);

  seats.push({ id: seatId, x, z, rotation, group: chairGroup, ring, target, bankNumber, label, avatar: null });
}

function addBench(parent, x, z, bankNumber) {
  const width = 3.62;
  const depth = .94;
  const topY = .91;
  addCollider(furnitureColliders.equipped, x, z, width, depth + .12);
  box(parent, `Superficie de banco ${bankNumber}`, [width, .095, depth], [x, topY, z], materials.benchTop, { castShadow: true });
  for (const dx of [-1.69, 1.69]) {
    for (const dz of [-.34, .34]) {
      box(parent, `Estructura de banco ${bankNumber}`, [.105, .82, .105], [x + dx, .43, z + dz], materials.wood);
    }
  }
  box(parent, `Travesaño frontal ${bankNumber}`, [3.34, .085, .075], [x, .54, z + .32], materials.steelDark, { castShadow: false });
  box(parent, `Canaleta de conexiones ${bankNumber}`, [3.48, .31, .12], [x, 1.1, z - .36], materials.steel, { castShadow: true });
  box(parent, `Borde de canaleta ${bankNumber}`, [3.48, .035, .135], [x, 1.27, z - .36], materials.steelDark, { castShadow: false });
  for (let j = 0; j < 4; j++) {
    const px = x - 1.29 + j * .86;
    box(parent, 'Toma de corriente', [.22, .16, .018], [px, 1.105, z - .283], new THREE.MeshStandardMaterial({ color: '#eeeae0', roughness: .8 }), { castShadow: false });
    box(parent, 'Detalle de tomacorriente', [.04, .095, .02], [px, 1.105, z - .27], materials.instrumentDark, { castShadow: false });
  }

  addInstrument(parent, 'osciloscopio', x - 1.04, z - .035, bankNumber);
  addInstrument(parent, 'fuente', x, z - .035, bankNumber);
  addInstrument(parent, 'generador', x + 1.04, z - .035, bankNumber);

  const seatXs = [x - 1.32, x - .44, x + .44, x + 1.32];
  for (const seatX of seatXs) createChair(parent, seats.length, seatX, z + 1.04, 0, bankNumber, 'Banco principal');
}

function buildEquippedState() {
  const rows = [-2.33, .02, 2.37];
  const columns = [-3.15, 1.96];
  let bankNumber = 1;
  for (const z of rows) {
    for (const x of columns) addBench(equippedGroup, x, z, bankNumber++);
  }

  // Banco de apoyo lateral con puestos orientados hacia la pared.
  const sideX = 6.34;
  const sideZ = -.18;
  addCollider(furnitureColliders.equipped, sideX, sideZ, 1.02, 3.45);
  box(equippedGroup, 'Superficie de banco lateral', [.92, .095, 3.35], [sideX, .91, sideZ], materials.benchTop);
  for (const dz of [-1.48, 1.48]) {
    for (const dx of [-.32, .32]) box(equippedGroup, 'Pata de banco lateral', [.09, .82, .09], [sideX + dx, .43, sideZ + dz], materials.wood);
  }
  box(equippedGroup, 'Canaleta lateral', [.16, .32, 3.15], [sideX - .34, 1.1, sideZ], materials.steel);
  for (let i = 0; i < 3; i++) {
    const z = sideZ - .92 + i * .92;
    addInstrument(equippedGroup, ['osciloscopio', 'fuente', 'generador'][i], sideX, z, 7);
  }
  for (let i = 0; i < 4; i++) {
    const z = sideZ - 1.12 + i * .75;
    createChair(equippedGroup, seats.length, 5.36, z, -Math.PI / 2, 7, 'Banco lateral');
  }
}

function buildScene() {
  buildArchitecture();
  buildLighting();
  buildBaseState();
  buildEquippedState();
}

buildScene();

function iconFor(type) {
  const icons = {
    scope: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 12h2l2-4 3 8 2-4h3"/><path d="M7 2v2m10-2v2"/></svg>',
    source: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 15h3m3 0h2M12 6v6m-2-2 2 2 2-2"/></svg>',
    generator: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M5.5 12c1.6-4.3 3.2-4.3 4.8 0s3.2 4.3 4.8 0 2.2-4.2 3.4-2.6"/><circle cx="7" cy="7" r=".7" fill="currentColor" stroke="none"/></svg>'
  };
  return icons[type] || icons.scope;
}

function panelTopline(label) {
  return `<div class="panel-topline"><span class="eyebrow"><i></i>${label}</span><button class="panel-close" type="button" data-action="hide-panel" aria-label="Ocultar panel"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>`;
}

function renderExplorePanel() {
  panel.innerHTML = `
    ${panelTopline('RECORRIDO · HANGAR DIEE')}
    <p class="panel-kicker">UN ESPACIO PARA APRENDER HACIENDO</p>
    <h1 class="panel-title">El laboratorio<br><em>también se aprende.</em></h1>
    <p class="panel-description">Muévete por el Hangar, acércate a los bancos y descubre cómo podría vivirse una práctica antes de llegar al espacio.</p>
    <div class="state-selector" role="group" aria-label="Estado del laboratorio">
      <button class="state-choice ${roomState === 'equipped' ? 'is-active' : ''}" type="button" data-state="equipped">PROPUESTA EQUIPADA</button>
      <button class="state-choice ${roomState === 'base' ? 'is-active' : ''}" type="button" data-state="base">ESPACIO BASE</button>
    </div>
    <div class="metrics-row">
      <div class="metric-card"><span class="metric-icon"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 7.5h15M4 7.5V16h12V7.5M6 7.5V4h8v3.5M7 11h2m2 0h2"/><path d="M4 16h12"/></svg></span><span><b class="metric-value">7 bancos</b><small class="metric-label">DE TRABAJO</small></span></div>
      <div class="metric-card"><span class="metric-icon"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="6" r="2.2"/><path d="M2.8 15v-1.4a4.2 4.2 0 0 1 8.4 0V15M14.5 8a2 2 0 1 0 0-4M13.2 11a3.8 3.8 0 0 1 4 3.8V15"/></svg></span><span><b class="metric-value">28 puestos</b><small class="metric-label">AFORO ESTIMADO</small></span></div>
    </div>
    <button class="primary-button" type="button" data-action="start-tour">Comenzar recorrido <span>↗</span></button>
    <div class="panel-divider"></div>
    <div class="section-heading"><span>Equipos del banco</span><button type="button" data-action="show-equipment">Ver información</button></div>
    <div class="equipment-list">
      ${Object.entries(equipment).map(([id, item]) => `<button class="equipment-link" type="button" data-equipment="${id}"><span class="equip-symbol">${iconFor(item.icon)}</span><span><strong>${item.title}</strong><small>${item.short}</small></span><span class="link-arrow">›</span></button>`).join('')}
    </div>
    <p class="panel-footnote">Modelo 3D conceptual construido a partir de las fotografías de referencia. Distribución y mobiliario sujetos a validación en terreno.</p>
  `;
}

function renderOccupancyPanel() {
  const count = seats.filter((seat) => seat.avatar).length;
  const fill = `${(count / MAX_PEOPLE) * 100}%`;
  panel.innerHTML = `
    ${panelTopline('AFORO · DISTRIBUCIÓN')}
    <p class="panel-kicker">SIMULA UNA SESIÓN DE CLASE</p>
    <h1 class="panel-title">¿Cuántas personas<br><em>caben aquí?</em></h1>
    <p class="panel-description">Ubica estudiantes en cada silla para estimar el aforo. Puedes moverlos uno a uno o distribuir un grupo con el control.</p>
    <div class="occupancy-number"><strong id="occupancy-count">${count}</strong><span>de <b>${MAX_PEOPLE}</b> puestos</span></div>
    <div class="range-label-row"><span>Personas en el espacio</span><span id="occupancy-range-value">${count} / ${MAX_PEOPLE}</span></div>
    <input class="occupancy-range" id="occupancy-range" type="range" min="0" max="${MAX_PEOPLE}" value="${count}" style="--fill:${fill}" aria-label="Ajustar cantidad de personas en el laboratorio" />
    <div class="capacity-breakdown"><div><b>24</b><span>Bancos principales</span></div><i></i><div><b>4</b><span>Banco lateral</span></div><i></i><div><b>28</b><span>Total dibujado</span></div></div>
    <div class="occupancy-actions"><button class="primary-button" type="button" data-action="add-next">Añadir siguiente persona <span>+</span></button><button class="secondary-button" type="button" data-action="clear-people">Vaciar</button></div>
    <div class="instruction-callout"><b>↗</b><span>En el modelo, haz clic sobre un asiento para agregar o retirar una persona.</span></div>
    <p class="panel-footnote">Estimación visual preliminar: 24 puestos en los bancos principales y 4 en el banco lateral. No reemplaza el cálculo normativo de ocupación.</p>
  `;
}

function renderCoursesPanel() {
  panel.innerHTML = `
    ${panelTopline('CURSOS · PRÁCTICAS')}
    <p class="panel-kicker">FORMACIÓN EN ELECTRICIDAD Y ELECTRÓNICA</p>
    <h1 class="panel-title">Ideas que pasan<br><em>del plano al banco.</em></h1>
    <p class="panel-description">El espacio puede apoyar actividades de medición, montaje y experimentación. Selecciona una línea para ver una práctica posible.</p>
    <div class="course-list">
      ${courses.map((course, i) => `<button class="course-card" type="button" data-course="${course.id}"><span class="course-index">${String(i + 1).padStart(2, '0')}</span><span><strong>${course.title}</strong><small>${course.area}</small></span><span class="course-arrow">↗</span></button>`).join('')}
    </div>
    <p class="academic-note">Propuesta académica orientativa, no es un listado oficial de asignaturas. Confirmar nombres, códigos y oferta vigente con el DIEE-UNAL.</p>
    <p class="panel-footnote">Las prácticas sugeridas relacionan los instrumentos que se distinguen en las fotografías; deben ajustarse al inventario real y a los resultados de aprendizaje de cada curso.</p>
  `;
}

function renderPanel() {
  if (currentView === 'occupancy') renderOccupancyPanel();
  else if (currentView === 'courses') renderCoursesPanel();
  else renderExplorePanel();
}
renderPanel();

function showToast(message, duration = 2500) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  if (view === 'occupancy') setRoomState('equipped');
  seats.forEach((seat) => { seat.ring.visible = view === 'occupancy'; });
  panel.classList.remove('is-hidden');
  document.querySelector('#reopen-panel').classList.remove('is-visible');
  closeDetail();
  renderPanel();
  updateStatus();
  if (view === 'occupancy') showToast('Modo aforo: selecciona sillas en el modelo o usa el control para distribuir personas.');
}

document.querySelectorAll('.nav-button').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

function setRoomState(state) {
  roomState = state === 'base' ? 'base' : 'equipped';
  equippedGroup.visible = roomState === 'equipped';
  baseGroup.visible = roomState === 'base';
  if (isBlocked(player.position.x, player.position.z)) setPlayerPosition(player.position.x, player.position.z);
  if (roomState === 'base') {
    seats.forEach((seat) => {
      setPersonOnSeat(seat, false);
      seat.ring.visible = false;
    });
    refreshOccupancyUi();
    if (currentView === 'occupancy') setView('explore');
  }
  document.querySelectorAll('[data-state]').forEach((button) => button.classList.toggle('is-active', button.dataset.state === roomState));
  updateStatus();
}

function updateStatus() {
  if (currentView === 'occupancy') roomStatusText.textContent = 'MODO AFORO · 28 PUESTOS';
  else if (currentView === 'courses') roomStatusText.textContent = 'HANGAR · ZONA DE PRÁCTICAS';
  else roomStatusText.textContent = roomState === 'base' ? 'HANGAR · ESPACIO BASE' : 'HANGAR · VISTA GENERAL';
}

function setPersonOnSeat(seat, occupied) {
  if (occupied && !seat.avatar) {
    seat.avatar = makePerson(seat.id);
    seat.group.add(seat.avatar);
    seat.ring.material.color.set('#f4b654');
    seat.ring.material.opacity = .35;
  } else if (!occupied && seat.avatar) {
    seat.group.remove(seat.avatar);
    disposeObject(seat.avatar);
    seat.avatar = null;
    seat.ring.material.color.set('#b8ec5b');
    seat.ring.material.opacity = .92;
  }
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material && child.material !== materials.skin && child.material !== materials.hair) {
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material.dispose();
    }
  });
}

function refreshOccupancyUi() {
  const count = seats.filter((seat) => seat.avatar).length;
  document.querySelector('#top-count').textContent = count;
  const counter = document.querySelector('#occupancy-count');
  const range = document.querySelector('#occupancy-range');
  const rangeValue = document.querySelector('#occupancy-range-value');
  if (counter) counter.textContent = count;
  if (range) {
    range.value = count;
    range.style.setProperty('--fill', `${(count / MAX_PEOPLE) * 100}%`);
  }
  if (rangeValue) rangeValue.textContent = `${count} / ${MAX_PEOPLE}`;
}

function setOccupancyCount(rawCount) {
  const desired = THREE.MathUtils.clamp(Math.round(Number(rawCount) || 0), 0, MAX_PEOPLE);
  let current = seats.filter((seat) => seat.avatar).length;
  if (desired > current) {
    for (const seat of seats) {
      if (!seat.avatar && current < desired) {
        setPersonOnSeat(seat, true);
        current++;
      }
    }
  } else if (desired < current) {
    for (let i = seats.length - 1; i >= 0 && current > desired; i--) {
      if (seats[i].avatar) {
        setPersonOnSeat(seats[i], false);
        current--;
      }
    }
  }
  refreshOccupancyUi();
}

function toggleSeat(seatId) {
  const seat = seats[seatId];
  if (!seat) return;
  setPersonOnSeat(seat, !seat.avatar);
  refreshOccupancyUi();
  showToast(seat.avatar ? `Persona ubicada en ${seat.label.toLowerCase()}, puesto ${seat.id + 1}.` : `Puesto ${seat.id + 1} disponible.`, 1500);
}

function renderDetail(type, id) {
  let data;
  let isCourse = false;
  if (type === 'equipment') {
    data = equipment[id];
  } else if (type === 'course') {
    data = courses.find((course) => course.id === id);
    isCourse = true;
  }
  if (!data) return;
  const icon = isCourse
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10h6"/></svg>'
    : iconFor(data.icon);
  const eyebrow = isCourse ? data.area : data.eyebrow;
  const detailTag = isCourse ? data.equipment : data.relation;
  detailCard.innerHTML = `
    <button class="detail-close" type="button" data-action="close-detail" aria-label="Cerrar información"><svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg></button>
    <div class="detail-visual">${icon}</div>
    <span class="detail-eyebrow">${eyebrow}</span>
    <h2 class="detail-title">${data.title}</h2>
    <p class="detail-description">${data.description}</p>
    <div class="detail-block"><strong>EN UNA PRÁCTICA</strong><p>${data.practice}</p></div>
    <div class="detail-block"><strong>${isCourse ? 'EQUIPOS QUE PODRÍAN USARSE' : 'RELACIÓN CON CURSOS'}</strong><p>${detailTag}</p></div>
    <span class="detail-tag">${isCourse ? 'LÍNEA DE FORMACIÓN' : 'INFORMACIÓN GENÉRICA'}</span>
    ${data.note ? `<p class="detail-footnote">${data.note}</p>` : '<p class="detail-footnote">Actividad sugerida para planeación académica. Validar contenidos y equipos con el equipo docente del DIEE-UNAL.</p>'}
  `;
  detailCard.hidden = false;
  app.classList.add('detail-open');
}

function closeDetail() {
  detailCard.hidden = true;
  app.classList.remove('detail-open');
}

detailCard.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="close-detail"]')) closeDetail();
});

panel.addEventListener('click', (event) => {
  const stateButton = event.target.closest('[data-state]');
  if (stateButton) {
    setRoomState(stateButton.dataset.state);
    renderPanel();
    return;
  }
  const equipmentButton = event.target.closest('[data-equipment]');
  if (equipmentButton) {
    renderDetail('equipment', equipmentButton.dataset.equipment);
    return;
  }
  const courseButton = event.target.closest('[data-course]');
  if (courseButton) {
    renderDetail('course', courseButton.dataset.course);
    return;
  }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  switch (actionButton.dataset.action) {
    case 'hide-panel':
      panel.classList.add('is-hidden');
      document.querySelector('#reopen-panel').classList.add('is-visible');
      break;
    case 'start-tour':
      player.position.set(0, 0, 5.18);
      player.rotation.y = 0;
      camera.rotation.x = 0;
      showToast('Recorrido listo. Arrastra para mirar y usa W A S D para caminar.');
      break;
    case 'show-equipment':
      renderDetail('equipment', 'osciloscopio');
      break;
    case 'add-next': {
      const firstEmpty = seats.find((seat) => !seat.avatar);
      if (firstEmpty) toggleSeat(firstEmpty.id);
      else showToast('Los 28 puestos del modelo ya están ocupados.');
      break;
    }
    case 'clear-people':
      setOccupancyCount(0);
      showToast('Se retiraron todas las personas del modelo.');
      break;
    default:
      break;
  }
});

panel.addEventListener('input', (event) => {
  if (event.target.id === 'occupancy-range') setOccupancyCount(event.target.value);
});

document.querySelector('#reopen-panel').addEventListener('click', () => {
  panel.classList.remove('is-hidden');
  document.querySelector('#reopen-panel').classList.remove('is-visible');
});

function setPhotoSplit(value) {
  const clamped = THREE.MathUtils.clamp(Number(value) || 0, 0, 100);
  document.querySelector('#photo-stage').style.setProperty('--split', `${clamped}%`);
  photoRange.value = clamped;
}
photoRange.addEventListener('input', (event) => setPhotoSplit(event.target.value));
document.querySelectorAll('[data-photo-value]').forEach((button) => button.addEventListener('click', () => setPhotoSplit(button.dataset.photoValue)));

document.querySelector('#photos-open').addEventListener('click', () => {
  closeDetail();
  photoModal.hidden = false;
  setPhotoSplit(50);
  document.querySelector('[data-close-photos].icon-close')?.focus();
});
function closePhotos() {
  photoModal.hidden = true;
  document.querySelector('#photos-open').focus();
}
photoModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-photos]')) closePhotos();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !photoModal.hidden) closePhotos();
});

function updateMap() {
  const mapX = THREE.MathUtils.clamp(80 + (player.position.x / 8) * 70, 12, 148);
  const mapY = THREE.MathUtils.clamp(60 + (player.position.z / 6) * 46, 12, 108);
  mapPlayer.setAttribute('cx', mapX.toFixed(1));
  mapPlayer.setAttribute('cy', mapY.toFixed(1));
}

function setPlayerPosition(x, z, notify = false) {
  let nextX = THREE.MathUtils.clamp(x, -7.35, 7.35);
  let nextZ = THREE.MathUtils.clamp(z, -5.35, 5.35);
  if (isBlocked(nextX, nextZ)) {
    let found = false;
    for (let radius = .38; radius <= 3.2 && !found; radius += .32) {
      for (let step = 0; step < 16; step++) {
        const angle = (step / 16) * Math.PI * 2;
        const candidateX = THREE.MathUtils.clamp(nextX + Math.cos(angle) * radius, -7.35, 7.35);
        const candidateZ = THREE.MathUtils.clamp(nextZ + Math.sin(angle) * radius, -5.35, 5.35);
        if (!isBlocked(candidateX, candidateZ)) {
          nextX = candidateX;
          nextZ = candidateZ;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      nextX = player.position.x;
      nextZ = player.position.z;
    }
  }
  player.position.x = nextX;
  player.position.z = nextZ;
  updateMap();
  if (notify) showToast('Te desplazaste a otra zona del Hangar.');
}

const mapButton = document.querySelector('#mini-map');
mapButton.addEventListener('click', (event) => {
  const svg = mapButton.querySelector('.floor-plan');
  const rect = svg.getBoundingClientRect();
  const vx = ((event.clientX - rect.left) / rect.width) * 160;
  const vy = ((event.clientY - rect.top) / rect.height) * 120;
  setPlayerPosition(((vx - 80) / 70) * 8, ((vy - 60) / 46) * 6, true);
});

function clampPitch(value) { return THREE.MathUtils.clamp(value, -1.28, 1.28); }
function updateLook(dx, dy) {
  player.rotation.y -= dx * .0048;
  camera.rotation.x = clampPitch(camera.rotation.x - dy * .0042);
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== undefined && event.button !== 0) return;
  dragging = true;
  pointerMoved = false;
  activePointer = event.pointerId;
  previousPointer = { x: event.clientX, y: event.clientY };
  try { canvas.setPointerCapture(event.pointerId); } catch { /* Pointer capture is not available in every embedded browser. */ }
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging || activePointer !== event.pointerId) return;
  const dx = event.clientX - previousPointer.x;
  const dy = event.clientY - previousPointer.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) pointerMoved = true;
  if (pointerMoved) updateLook(dx, dy);
  previousPointer = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', (event) => {
  if (activePointer !== event.pointerId) return;
  if (!pointerMoved) pickFromScreen(event.clientX, event.clientY);
  dragging = false;
  activePointer = null;
});
canvas.addEventListener('pointercancel', () => { dragging = false; activePointer = null; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

function getMetadata(object, key) {
  let node = object;
  while (node) {
    if (node.userData && node.userData[key] !== undefined) return node.userData[key];
    node = node.parent;
  }
  return undefined;
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function isInteractiveHit(item) {
  if (roomState !== 'equipped') return false;
  return getMetadata(item.object, 'seatId') !== undefined || getMetadata(item.object, 'equipmentId') !== undefined;
}

function pickFromScreen(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const intersections = raycaster.intersectObjects(pickables, true);
  const hit = intersections.find(isInteractiveHit);
  if (hit) handlePick(hit.object);
}

function handlePick(object) {
  const seatId = getMetadata(object, 'seatId');
  if (seatId !== undefined) {
    if (currentView === 'occupancy') toggleSeat(seatId);
    else showToast('Abre “Aforo” para ubicar personas en los puestos.');
    return;
  }
  const equipmentId = getMetadata(object, 'equipmentId');
  if (equipmentId) {
    renderDetail('equipment', equipmentId);
    return;
  }
}

function walkPlayerTo(x, z) {
  const targetX = THREE.MathUtils.clamp(x, -7.35, 7.35);
  const targetZ = THREE.MathUtils.clamp(z, -5.35, 5.35);
  if (!isBlocked(targetX, player.position.z)) player.position.x = targetX;
  if (!isBlocked(player.position.x, targetZ)) player.position.z = targetZ;
  updateMap();
}

function movePlayer(dx, forward, delta) {
  const magnitude = Math.hypot(dx, forward);
  if (magnitude < .01) return;
  const nx = dx / magnitude;
  const nf = forward / magnitude;
  const speed = 2.45 * delta;
  const yaw = player.rotation.y;
  const forwardX = Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = Math.sin(yaw);
  const x = player.position.x + (rightX * nx + forwardX * nf) * speed;
  const z = player.position.z + (rightZ * nx + forwardZ * nf) * speed;
  walkPlayerTo(x, z);
}

function pressedMove() {
  let x = 0;
  let forward = 0;
  if (keys.has('a') || keys.has('arrowleft') || touchMoves.has('left')) x -= 1;
  if (keys.has('d') || keys.has('arrowright') || touchMoves.has('right')) x += 1;
  if (keys.has('w') || keys.has('arrowup') || touchMoves.has('forward')) forward += 1;
  if (keys.has('s') || keys.has('arrowdown') || touchMoves.has('back')) forward -= 1;
  return { x, forward };
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    keys.add(key);
    if (!['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) event.preventDefault();
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); touchMoves.clear(); });

const touchControls = document.querySelector('.touch-controls');
touchControls.querySelectorAll('[data-move]').forEach((button) => {
  const move = button.dataset.move;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    touchMoves.add(move);
    try { button.setPointerCapture(event.pointerId); } catch { /* no-op */ }
  });
  const release = () => touchMoves.delete(move);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

const controllers = [];
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)];
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#d6f577', transparent: true, opacity: .58 }));
  beam.scale.z = 8;
  controller.add(beam);
  controller.addEventListener('selectstart', () => selectFromController(controller));
  scene.add(controller);
  controllers.push(controller);
}

function selectFromController(controller) {
  if (!renderer.xr.isPresenting) return;
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(0, 0, -1);
  const controllerRotation = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(controllerRotation);
  direction.applyQuaternion(controllerRotation);
  raycaster.set(origin, direction.normalize());
  const intersections = raycaster.intersectObjects(pickables, true);
  const hit = intersections.find(isInteractiveHit);
  if (hit) {
    handlePick(hit.object);
    return;
  }
  if (window.floorMesh) {
    const floorHit = raycaster.intersectObject(window.floorMesh, false)[0];
    if (floorHit) {
      setPlayerPosition(floorHit.point.x, floorHit.point.z, true);
    }
  }
}

function moveWithXRGamepad(delta) {
  const session = renderer.xr.getSession();
  if (!session) return;
  const source = [...session.inputSources].find((item) => item.handedness === 'left' && item.gamepad) || [...session.inputSources].find((item) => item.gamepad);
  if (!source || !source.gamepad) return;
  const axes = source.gamepad.axes;
  const axisX = axes.length >= 4 ? axes[2] : axes[0];
  const axisY = axes.length >= 4 ? axes[3] : axes[1];
  if (Math.abs(axisX || 0) < .12 && Math.abs(axisY || 0) < .12) return;
  movePlayer(axisX || 0, -(axisY || 0), delta);
}

vrButton.addEventListener('click', async () => {
  if (renderer.xr.isPresenting) {
    const session = renderer.xr.getSession();
    if (session) await session.end();
    return;
  }
  if (!vrSupported || !navigator.xr) {
    showToast('Para entrar en VR, abre este recorrido en un navegador compatible con WebXR y conecta un visor.', 3800);
    return;
  }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session);
  } catch (error) {
    console.warn('No fue posible iniciar WebXR:', error);
    showToast('No se pudo iniciar el visor. Revisa que esté conectado y vuelve a intentarlo.', 3500);
  }
});

renderer.xr.addEventListener('sessionstart', () => {
  vrButton.classList.add('is-live');
  vrButton.querySelector('span').textContent = 'Salir de VR';
  showToast('VR activa. Usa el joystick para moverte y apunta al piso para desplazarte.', 3500);
});
renderer.xr.addEventListener('sessionend', () => {
  vrButton.classList.remove('is-live');
  vrButton.querySelector('span').textContent = 'Visor VR';
});

async function detectVR() {
  if (!navigator.xr || !window.isSecureContext) return;
  try {
    vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
    if (vrSupported) vrButton.title = 'Entrar en recorrido de realidad virtual';
  } catch {
    vrSupported = false;
  }
}
detectVR();

function animate(time) {
  const delta = Math.min((time - (lastFrame || time)) / 1000, .05);
  lastFrame = time;
  const move = pressedMove();
  if (move.x || move.forward) movePlayer(move.x, move.forward, delta);
  if (renderer.xr.isPresenting) moveWithXRGamepad(delta);
  if (time - lastMapUpdate > 120) {
    updateMap();
    lastMapUpdate = time;
  }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
updateMap();
refreshOccupancyUi();
