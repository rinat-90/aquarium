import * as THREE from 'three';

export type Fish3DModel = {
  group: THREE.Group;
  body: THREE.Mesh;
  paintCanvas: HTMLCanvasElement;
  paintTexture: THREE.CanvasTexture;
  tail: THREE.Mesh;
  leftFin: THREE.Mesh;
  rightFin: THREE.Mesh;
  setBodyColor: (color: string) => void;
  setFinColor: (color: string) => void;
  setPaintImage: (image?: string) => void;
  dispose: () => void;
};

export function createFish3DModel(): Fish3DModel {
  const group = new THREE.Group();
  const paintCanvas = document.createElement('canvas');
  paintCanvas.width = 1024;
  paintCanvas.height = 512;
  const paintContext = paintCanvas.getContext('2d');
  if (!paintContext) throw new Error('Could not create fish paint canvas.');

  const paintTexture = new THREE.CanvasTexture(paintCanvas);
  paintTexture.colorSpace = THREE.SRGBColorSpace;
  paintTexture.wrapS = THREE.ClampToEdgeWrapping;
  paintTexture.wrapT = THREE.ClampToEdgeWrapping;

  let disposed = false;
  let paintLoadVersion = 0;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8a3d,
    roughness: 0.67,
    metalness: 0,
    emissive: 0xff8a3d,
    emissiveIntensity: 0.12,
  });
  const finMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    roughness: 0.64,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: 0xffb347,
    emissiveIntensity: 0.12,
  });
  const whiteMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.34,
  });
  const pupilMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.25,
  });
  const mouthMaterial = new THREE.MeshStandardMaterial({
    color: 0x9b4a2b,
    roughness: 0.8,
  });

  // Preserve sphere UVs so the existing painting system keeps working.
  // Deform the vertices instead of replacing the mesh with custom UVs.
  const bodyGeometry = new THREE.SphereGeometry(1, 48, 32);
  const positions = bodyGeometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const nx = positions.getX(i);
    const ny = positions.getY(i);
    const nz = positions.getZ(i);
    const rear = THREE.MathUtils.smoothstep(-nx, 0.0, 1.0);
    const front = THREE.MathUtils.smoothstep(nx, 0.15, 1.0);
    const taper = 1 - rear * 0.38;
    const headRoundness = 1 - front * 0.07;
    positions.setXYZ(
      i,
      nx * 1.58,
      ny * 0.89 * taper * headRoundness,
      nz * 0.72 * taper * headRoundness,
    );
  }
  positions.needsUpdate = true;
  bodyGeometry.computeVertexNormals();
  bodyGeometry.computeBoundingSphere();

  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.name = 'fish-paintable-body';
  group.add(body);

  const paintGeometry = bodyGeometry.clone();
  paintGeometry.scale(1.004, 1.004, 1.004);
  const paintMaterial = new THREE.MeshBasicMaterial({
    map: paintTexture,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const paintBody = new THREE.Mesh(paintGeometry, paintMaterial);
  paintBody.name = 'fish-paint-layer';
  paintBody.visible = false; // Skip overlay draw calls until painting loads.
  group.add(paintBody);

  // A shallow extrusion gives the fins thickness when viewed at an angle.
  const makeFin = (shape: THREE.Shape, depth = 0.045) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 14,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geometry, finMaterial);
  };

  // Tail: rounded fan with a modest center notch, attached at a narrow peduncle.
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0.06, 0);
  tailShape.bezierCurveTo(-0.25, 0.18, -0.58, 0.68, -0.98, 0.78);
  tailShape.quadraticCurveTo(-0.85, 0.28, -0.77, 0);
  tailShape.quadraticCurveTo(-0.85, -0.28, -0.98, -0.78);
  tailShape.bezierCurveTo(-0.58, -0.68, -0.25, -0.18, 0.06, 0);
  const tail = makeFin(tailShape, 0.055);
  tail.position.set(-1.45, 0, 0);
  group.add(tail);

  // Rounded dorsal fin with a root tucked into the back.
  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(-0.85, -0.18);
  dorsalShape.bezierCurveTo(-0.82, 0.12, -0.68, 0.48, -0.40, 0.68);
  dorsalShape.bezierCurveTo(-0.28, 0.72, -0.26, 0.54, -0.16, 0.38);
  dorsalShape.bezierCurveTo(0.02, 0.12, 0.28, -0.04, 0.52, -0.20);
  dorsalShape.quadraticCurveTo(-0.12, -0.30, -0.85, -0.18);
  const dorsalFin = makeFin(dorsalShape, 0.04);
  dorsalFin.position.set(-0.20, 0.56, 0);
  group.add(dorsalFin);

  // Smaller anal fin swept toward the tail.
  const analShape = new THREE.Shape();
  analShape.moveTo(-0.55, 0.16);
  analShape.bezierCurveTo(-0.62, -0.08, -0.57, -0.35, -0.38, -0.50);
  analShape.bezierCurveTo(-0.24, -0.48, -0.16, -0.24, -0.02, -0.10);
  analShape.quadraticCurveTo(0.12, 0.04, 0.28, 0.16);
  analShape.quadraticCurveTo(-0.12, 0.08, -0.55, 0.16);
  const analFin = makeFin(analShape, 0.035);
  analFin.position.set(-0.52, -0.52, 0);
  group.add(analFin);

  // Pectoral fins pivot around their narrow root.
  const sideShape = new THREE.Shape();
  sideShape.moveTo(0.08, 0.04);
  sideShape.bezierCurveTo(-0.12, 0.12, -0.36, 0.02, -0.62, -0.16);
  sideShape.bezierCurveTo(-0.76, -0.28, -0.68, -0.40, -0.49, -0.39);
  sideShape.bezierCurveTo(-0.26, -0.36, -0.04, -0.16, 0.08, 0.04);

  const leftFin = makeFin(sideShape, 0.035);
  leftFin.position.set(0.43, -0.13, 0.73);
  leftFin.rotation.y = -0.16;
  leftFin.rotation.z = -0.08;
  group.add(leftFin);

  const rightFin = makeFin(sideShape, 0.035);
  rightFin.position.set(0.43, -0.13, -0.73);
  rightFin.rotation.y = 0.16;
  rightFin.rotation.z = -0.08;
  group.add(rightFin);

  const eyeGeometry = new THREE.SphereGeometry(0.155, 24, 18);
  const pupilGeometry = new THREE.SphereGeometry(0.077, 20, 16);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, whiteMaterial);
    eye.position.set(1.03, 0.23, side * 0.43);
    group.add(eye);
    const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    pupil.position.set(1.095, 0.24, side * 0.55);
    group.add(pupil);
  }

  // Calculate the same deformed body surface used by the mesh.
  // This places the mouth slightly above the surface, not inside it.
  const getBodySurfaceZ = (x: number, y: number) => {
    const nx = x / 1.58;
    const rear = THREE.MathUtils.smoothstep(-nx, 0, 1);
    const front = THREE.MathUtils.smoothstep(nx, 0.15, 1);
    const taper = 1 - rear * 0.38;
    const roundness = 1 - front * 0.07;
    const ry = 0.89 * taper * roundness;
    const rz = 0.72 * taper * roundness;
    return rz * Math.sqrt(Math.max(0, 1 - nx * nx - (y / ry) ** 2));
  };

  for (const side of [-1, 1]) {
    const mouthPoints = [
      { x: 1.29, y: -0.18 },
      { x: 1.35, y: -0.205 },
      { x: 1.41, y: -0.19 },
    ];
    const points = mouthPoints.map(({ x, y }) =>
      new THREE.Vector3(x, y, side * (getBodySurfaceZ(x, y) + 0.025)),
    );
    const smile = new THREE.QuadraticBezierCurve3(points[0], points[1], points[2]);
    const mouthGeometry = new THREE.TubeGeometry(smile, 16, 0.013, 6, false);
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.name = 'fish-mouth';
    group.add(mouth);
  }

  group.rotation.y = -0.18;

  const setBodyColor = (color: string) => {
    bodyMaterial.color.set(color);
    bodyMaterial.emissive.set(color);
  };
  const setFinColor = (color: string) => {
    finMaterial.color.set(color);
    finMaterial.emissive.set(color);
  };
  const setPaintImage = (image?: string) => {
    const loadVersion = ++paintLoadVersion;
    paintBody.visible = false;
    paintContext.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    paintTexture.needsUpdate = true;
    if (!image) return;
    const source = new Image();
    source.onload = () => {
      if (disposed || loadVersion !== paintLoadVersion) return;
      paintContext.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
      paintContext.drawImage(source, 0, 0, paintCanvas.width, paintCanvas.height);
      paintTexture.needsUpdate = true;
      paintBody.visible = true;
    };
    source.onerror = () => {
      if (!disposed && loadVersion === paintLoadVersion) {
        console.error('Failed to load fish paint image.');
      }
    };
    source.src = image;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    paintLoadVersion += 1;
    const geometries = new Set<THREE.BufferGeometry>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    paintTexture.dispose();
    bodyMaterial.dispose();
    paintMaterial.dispose();
    finMaterial.dispose();
    whiteMaterial.dispose();
    pupilMaterial.dispose();
    mouthMaterial.dispose();
  };

  return {
    group, body, paintCanvas, paintTexture,
    tail, leftFin, rightFin,
    setBodyColor, setFinColor, setPaintImage, dispose,
  };
}
