import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Fish3DModel } from './createFish3DModel';

export function createGuppy3DModel(): Fish3DModel {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const geometry = <T extends THREE.BufferGeometry>(g: T): T => { geometries.push(g); return g; };
  const material = <T extends THREE.Material>(m: T): T => { materials.push(m); return m; };
  const texture = <T extends THREE.Texture>(t: T): T => { textures.push(t); return t; };
  const random = (n: number) => { const v = Math.sin(n * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };

  const paintCanvas = document.createElement('canvas');
  paintCanvas.width = 1024;
  paintCanvas.height = 512;
  const paintContext = paintCanvas.getContext('2d');
  if (!paintContext) throw new Error('Could not create guppy paint canvas.');
  const paintTexture = texture(new THREE.CanvasTexture(paintCanvas));
  paintTexture.colorSpace = THREE.SRGBColorSpace;
  paintTexture.wrapS = THREE.ClampToEdgeWrapping;
  paintTexture.wrapT = THREE.ClampToEdgeWrapping;

  const bodyCanvas = document.createElement('canvas');
  bodyCanvas.width = 1024;
  bodyCanvas.height = 512;
  const bodyCtx = bodyCanvas.getContext('2d');
  if (!bodyCtx) throw new Error('Could not create guppy body texture.');
  const bodyTexture = texture(new THREE.CanvasTexture(bodyCanvas));
  bodyTexture.colorSpace = THREE.SRGBColorSpace;

  const bodyMaterial = material(new THREE.MeshStandardMaterial({
    map: bodyTexture, color: '#ffffff', roughness: 0.34, metalness: 0.08,
    emissive: '#063a65', emissiveIntensity: 0.09,
  }));
  const finMaterial = material(new THREE.MeshStandardMaterial({
    color: '#ff9549', roughness: 0.55, side: THREE.DoubleSide,
    transparent: true, opacity: 0.98, depthWrite: false,
  }));
  const eyeWhite = material(new THREE.MeshStandardMaterial({ color: '#e9f9ff', roughness: 0.25 }));
  const eyeBlack = material(new THREE.MeshStandardMaterial({ color: '#06152a', roughness: 0.18 }));
  const shine = material(new THREE.MeshBasicMaterial({ color: '#ffffff' }));

  // Sphere UVs are preserved for the existing raycast painting tools.
  const bodyGeometry = geometry(new THREE.SphereGeometry(1, 64, 40));
  const pos = bodyGeometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rear = THREE.MathUtils.smoothstep(-x, 0, 1);
    const front = THREE.MathUtils.smoothstep(x, 0.4, 1);
    const taper = 1 - rear * 0.57 - front * 0.12;
    pos.setXYZ(i, x * 1.43, y * 0.46 * taper, z * 0.36 * taper);
  }
  pos.needsUpdate = true;
  bodyGeometry.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.name = 'fish-paintable-body';
  group.add(body);

  const paintGeometry = geometry(bodyGeometry.clone());
  paintGeometry.scale(1.008, 1.008, 1.008);
  const paintMaterial = material(new THREE.MeshBasicMaterial({
    map: paintTexture, transparent: true, depthWrite: false,
    side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  const paintBody = new THREE.Mesh(paintGeometry, paintMaterial);
  paintBody.name = 'fish-paint-layer';
  paintBody.renderOrder = 3;
  paintBody.visible = false; // No overlay draw call until a paint image loads.
  group.add(paintBody);

  // Painted-on scales and patches follow the body UVs, including in 3D.
  const redrawBody = () => {
    const w = bodyCanvas.width, h = bodyCanvas.height;
    bodyCtx.clearRect(0, 0, w, h);
    const bodyGradient = bodyCtx.createLinearGradient(0, 0, 0, h);
    bodyGradient.addColorStop(0, '#0879e9');
    bodyGradient.addColorStop(0.34, '#05bbff');
    bodyGradient.addColorStop(0.53, '#00a7ed');
    bodyGradient.addColorStop(0.72, '#46dbe2');
    bodyGradient.addColorStop(1, '#d1faff');
    bodyCtx.fillStyle = bodyGradient;
    bodyCtx.fillRect(0, 0, w, h);
    // A subtle violet shoulder and golden mid-body markings.
    for (const [x, y, rx, ry, color] of [
      [265, 225, 145, 95, 'rgba(115,60,238,0.42)'],
      [375, 305, 175, 55, 'rgba(255,116,15,0.96)'],
      [680, 245, 90, 65, 'rgba(0,38,145,0.56)'],
    ] as const) {
      bodyCtx.fillStyle = color;
      bodyCtx.beginPath();
      bodyCtx.ellipse(x, y, rx, ry, -0.12, 0, Math.PI * 2);
      bodyCtx.fill();
    }
    for (let i = 0; i < 260; i++) {
      const x = 110 + (i % 26) * 30 + (Math.floor(i / 26) % 2) * 15;
      const y = 100 + Math.floor(i / 26) * 33;
      bodyCtx.strokeStyle = `rgba(3,62,153,${0.08 + random(i) * 0.19})`;
      bodyCtx.lineWidth = 1.5;
      bodyCtx.beginPath();
      bodyCtx.ellipse(x, y, 12, 8, 0, -0.3, Math.PI * 0.9);
      bodyCtx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const x = 180 + random(i + 400) * 570;
      const y = 175 + random(i + 500) * 170;
      bodyCtx.fillStyle = `rgba(4,38,119,${0.24 + random(i + 600) * 0.5})`;
      bodyCtx.beginPath();
      bodyCtx.ellipse(x, y, 3 + random(i + 700) * 10, 3 + random(i + 800) * 7, random(i + 900), 0, Math.PI * 2);
      bodyCtx.fill();
    }
    bodyTexture.needsUpdate = true;
  };
  redrawBody();

  // Fin texture uses UV coordinates: u runs root-to-edge and v runs top-to-bottom.
  const finCanvas = document.createElement('canvas');
  finCanvas.width = 1024;
  finCanvas.height = 1024;
  const finCtx = finCanvas.getContext('2d');
  if (!finCtx) throw new Error('Could not create guppy fin texture.');
  const finTexture = texture(new THREE.CanvasTexture(finCanvas));
  finTexture.colorSpace = THREE.SRGBColorSpace;
  finTexture.wrapS = THREE.ClampToEdgeWrapping;
  finTexture.wrapT = THREE.ClampToEdgeWrapping;
  const patternedFinMaterial = material(new THREE.MeshStandardMaterial({
    map: finTexture, color: '#ffffff', roughness: 0.57,
    side: THREE.DoubleSide, transparent: true, opacity: 0.98,
    depthWrite: false,
  }));
  const redrawFins = (base: string) => {
    const w = finCanvas.width, h = finCanvas.height;
    finCtx.clearRect(0, 0, w, h);
    const grad = finCtx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#063ba5');
    grad.addColorStop(0.22, '#0089f7');
    grad.addColorStop(0.42, base);
    grad.addColorStop(0.69, '#ff891c');
    grad.addColorStop(0.88, '#ff503d');
    grad.addColorStop(1, '#9c72f8');
    finCtx.fillStyle = grad;
    finCtx.fillRect(0, 0, w, h);
    // Radiating pigment streaks.
    for (let i = 0; i < 48; i++) {
      const y = i / 47 * h;
      finCtx.strokeStyle = i % 3 === 0 ? 'rgba(234,221,255,0.42)' : 'rgba(12,64,166,0.18)';
      finCtx.lineWidth = 2 + random(i + 90) * 5;
      finCtx.beginPath();
      finCtx.moveTo(0, h / 2);
      finCtx.quadraticCurveTo(w * 0.54, (y + h / 2) / 2, w, y);
      finCtx.stroke();
    }
    // Irregular leopard spots, not a regular grid.
    for (let i = 0; i < 85; i++) {
      const x = 260 + random(i + 1000) * 650;
      const y = 80 + random(i + 2000) * 860;
      const r = 6 + random(i + 3000) * 19;
      finCtx.fillStyle = `rgba(7,35,116,${0.6 + random(i + 4000) * 0.35})`;
      finCtx.beginPath();
      finCtx.ellipse(x, y, r * (0.7 + random(i + 5000)), r * 0.68, random(i + 6000) * Math.PI, 0, Math.PI * 2);
      finCtx.fill();
    }
    finTexture.needsUpdate = true;
  };
  redrawFins('#ff9549');

  // The tail mesh's local origin is at the body attachment point.
  // This lets Fish3DPreview animate fish.tail.rotation.y directly.
  const tailRoot = -1.33;
  const tailLength = 1.95;
  const segments = 48, rows = 24;
  const tailPositions: number[] = [], tailUVs: number[] = [], tailIndices: number[] = [];
  // Smoothly curved membrane, with a soft ripple near the outer edge.
  const tailPoint = (u: number, v: number, offset = 0) => {
    const y = tailEdge(v) * tailSpread(u);
    const x = -tailLength * u
      + 0.16 * Math.abs(Math.sin((v - 0.5) * Math.PI)) ** 2 * u
      + 0.025 * Math.sin(v * Math.PI * 14) * u ** 3;
    const z = 0.23 * u * u * Math.cos((v - 0.5) * Math.PI)
      + 0.085 * Math.sin(v * Math.PI * 3) * Math.sin(Math.PI * u * 0.85)
      + 0.045 * u ** 3 * Math.sin(v * Math.PI * 12)
      + offset;
    return new THREE.Vector3(x, y, z);
  };
  // Rounded delta silhouette: wide near the outer rim, softly scalloped.
  const tailEdge = (v: number) => {
    const a = (v - 0.5) * Math.PI;
    return 1.42 * Math.sin(a) * (0.975 + 0.025 * Math.cos(a * 12));
  };
  const tailSpread = (u: number) => {
    // Fan out quickly at the root, then round the outer edge.
    return Math.sin(Math.min(1, u) * Math.PI * 0.5) ** 0.85;
  };
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const point = tailPoint(u, v);
      tailPositions.push(point.x, point.y, point.z);
      tailUVs.push(u, v);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j, b = a + rows + 1;
      tailIndices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const tailGeometry = geometry(new THREE.BufferGeometry());
  tailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tailPositions, 3));
  tailGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(tailUVs, 2));
  tailGeometry.setIndex(tailIndices);
  tailGeometry.computeVertexNormals();
  const tail = new THREE.Mesh(tailGeometry, patternedFinMaterial);
  tail.name = 'guppy-tail';
  tail.position.set(tailRoot, 0, 0);
  group.add(tail);

  // A second membrane surface and a narrow rounded rim give the fin
  // a little physical depth without changing its silhouette.
  const backPositions = tailPositions.slice();
  for (let i = 2; i < backPositions.length; i += 3) backPositions[i] -= 0.022;
  const backGeometry = geometry(new THREE.BufferGeometry());
  backGeometry.setAttribute('position', new THREE.Float32BufferAttribute(backPositions, 3));
  backGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(tailUVs, 2));
  backGeometry.setIndex(tailIndices.slice());
  backGeometry.computeVertexNormals();
  const tailBack = new THREE.Mesh(backGeometry, patternedFinMaterial);
  tailBack.name = 'guppy-tail-back';
  tail.add(tailBack);

  const rimMaterial = material(new THREE.MeshBasicMaterial({
    color: '#ffb4da', transparent: true, opacity: 0.55, depthWrite: false,
  }));
  // Combine the three static rim tubes into a single tail child.
  // The tail's existing animation continues to transform this mesh.
  const rimGeometries: THREE.BufferGeometry[] = [];
  const addRim = (points: THREE.Vector3[]) => {
    const curve = new THREE.CatmullRomCurve3(points);
    rimGeometries.push(new THREE.TubeGeometry(curve, points.length * 2, 0.011, 5, false));
  };
  addRim(Array.from({ length: 49 }, (_, i) => tailPoint(1, i / 48, 0.006)));
  addRim(Array.from({ length: 25 }, (_, i) => tailPoint(i / 24, 0, 0.006)));
  addRim(Array.from({ length: 25 }, (_, i) => tailPoint(i / 24, 1, 0.006)));
  const mergedRimGeometry = mergeGeometries(rimGeometries, false);
  rimGeometries.forEach((g) => g.dispose());
  if (!mergedRimGeometry) throw new Error('Failed to merge guppy tail rims');
  const mergedRim = new THREE.Mesh(geometry(mergedRimGeometry), rimMaterial);
  mergedRim.name = 'guppy-merged-tail-rims';
  tail.add(mergedRim);

  const rayMaterial = material(new THREE.MeshBasicMaterial({
    color: '#e5d6ff', transparent: true, opacity: 0.34, depthWrite: false,
  }));
  const rayGeometries: THREE.BufferGeometry[] = [];
  for (let j = 1; j < 18; j++) {
    const v = j / 18;
    const points: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      points.push(tailPoint(u, v, 0.013));
    }
    rayGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.004, 4, false));
  }
  const mergedRayGeometry = mergeGeometries(rayGeometries, false);
  rayGeometries.forEach((g) => g.dispose());
  if (!mergedRayGeometry) throw new Error('Failed to merge guppy tail rays');
  const mergedRays = new THREE.Mesh(geometry(mergedRayGeometry), rayMaterial);
  mergedRays.name = 'guppy-merged-tail-rays';
  tail.add(mergedRays);

  // Swept dorsal fin, textured with the same blue/orange/purple mosaic.
  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(-0.83, 0);
  dorsalShape.bezierCurveTo(-1.08, 0.32, -1.32, 0.79, -1.34, 0.86);
  dorsalShape.bezierCurveTo(-1.05, 0.96, -0.57, 0.70, -0.18, 0.36);
  dorsalShape.bezierCurveTo(0.02, 0.13, 0.17, 0.02, 0.34, 0);
  dorsalShape.quadraticCurveTo(-0.20, -0.04, -0.83, 0);
  const dorsalGeometry = geometry(new THREE.ShapeGeometry(dorsalShape, 40));
  dorsalGeometry.computeBoundingBox();
  const dorsalBounds = dorsalGeometry.boundingBox!;
  const dorsalUV = dorsalGeometry.getAttribute('uv');
  const dorsalPos = dorsalGeometry.getAttribute('position');
  for (let i = 0; i < dorsalUV.count; i++) {
    dorsalUV.setXY(i,
      (dorsalBounds.max.y - dorsalPos.getY(i)) / Math.max(0.01, dorsalBounds.max.y - dorsalBounds.min.y),
      (dorsalPos.getX(i) - dorsalBounds.min.x) / Math.max(0.01, dorsalBounds.max.x - dorsalBounds.min.x),
    );
  }
  dorsalUV.needsUpdate = true;
  // Curve the dorsal fin away from the center plane, especially at the tip.
  for (let i = 0; i < dorsalPos.count; i++) {
    const x = dorsalPos.getX(i);
    const y = dorsalPos.getY(i);
    const height = THREE.MathUtils.clamp(y / 0.96, 0, 1);
    dorsalPos.setZ(i, 0.10 * height * height + 0.045 * Math.sin(x * 5) * height);
  }
  dorsalPos.needsUpdate = true;
  dorsalGeometry.computeVertexNormals();
  const dorsal = new THREE.Mesh(dorsalGeometry, patternedFinMaterial);
  dorsal.position.set(-0.1, 0.32, 0);
  group.add(dorsal);

  const analShape = new THREE.Shape();
  analShape.moveTo(-0.4, 0.06);
  analShape.bezierCurveTo(-0.65, -0.11, -0.72, -0.4, -0.6, -0.48);
  analShape.bezierCurveTo(-0.3, -0.42, -0.06, -0.15, 0.18, 0.06);
  analShape.quadraticCurveTo(-0.1, 0.02, -0.4, 0.06);
  const anal = new THREE.Mesh(geometry(new THREE.ShapeGeometry(analShape, 24)), finMaterial);
  anal.position.set(-0.48, -0.31, 0);
  group.add(anal);

  const pectoralShape = new THREE.Shape();
  pectoralShape.moveTo(0.04, 0.02);
  pectoralShape.bezierCurveTo(-0.16, 0.1, -0.34, -0.05, -0.42, -0.17);
  pectoralShape.bezierCurveTo(-0.43, -0.28, -0.24, -0.27, -0.12, -0.17);
  pectoralShape.quadraticCurveTo(-0.01, -0.05, 0.04, 0.02);
  const leftFin = new THREE.Mesh(geometry(new THREE.ShapeGeometry(pectoralShape, 24)), finMaterial);
  leftFin.position.set(0.43, -0.06, 0.31);
  leftFin.rotation.y = -0.25;
  group.add(leftFin);
  const rightFin = new THREE.Mesh(geometry(new THREE.ShapeGeometry(pectoralShape, 24)), finMaterial);
  rightFin.position.set(0.43, -0.06, -0.31);
  rightFin.rotation.y = 0.25;
  group.add(rightFin);

  const eyeGeometry = geometry(new THREE.SphereGeometry(0.092, 20, 16));
  const pupilGeometry = geometry(new THREE.SphereGeometry(0.052, 16, 12));
  const highlightGeometry = geometry(new THREE.SphereGeometry(0.014, 10, 8));
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeWhite);
    eye.position.set(0.95, 0.105, side * 0.19);
    group.add(eye);
    const pupil = new THREE.Mesh(pupilGeometry, eyeBlack);
    pupil.position.set(0.972, 0.105, side * 0.267);
    group.add(pupil);
    const dot = new THREE.Mesh(highlightGeometry, shine);
    dot.position.set(0.983, 0.13, side * 0.305);
    group.add(dot);
  }
  const mouth = new THREE.Mesh(geometry(new THREE.SphereGeometry(0.047, 16, 12)), bodyMaterial);
  mouth.position.set(1.414, -0.035, 0);
  mouth.scale.set(0.55, 0.45, 0.9);
  group.add(mouth);

  const setBodyColor = (color: string) => {
    // Tint without destroying the saturated body texture.
    const tint = new THREE.Color(color);
    bodyMaterial.color.copy(new THREE.Color('#ffffff').lerp(tint, 0.22));
    bodyMaterial.emissive.set('#063a65');
  };
  const setFinColor = (color: string) => {
    finMaterial.color.set(color);
    redrawFins(color);
  };
  let disposed = false;
  let paintLoadVersion = 0;
  const setPaintImage = (image?: string) => {
    const version = ++paintLoadVersion;
    paintBody.visible = false;
    paintContext.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    paintTexture.needsUpdate = true;
    if (!image) return;
    const source = new Image();
    source.onload = () => {
      if (disposed || version !== paintLoadVersion) return;
      paintContext.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
      paintContext.drawImage(source, 0, 0, paintCanvas.width, paintCanvas.height);
      paintTexture.needsUpdate = true;
      paintBody.visible = true;
    };
    source.onerror = () => {
      if (!disposed && version === paintLoadVersion) console.error('Failed to load guppy paint image.');
    };
    source.src = image;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    paintLoadVersion++;
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };
  group.rotation.y = -0.18;
  return { group, body, paintCanvas, paintTexture, tail, leftFin, rightFin, setBodyColor, setFinColor, setPaintImage, dispose };
}