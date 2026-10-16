import * as THREE from 'three';
import type { Fish3DModel } from './createFish3DModel';

/** Finny mascot v5. Forward is +X; the camera initially sees the +Z side. */
export function createFinny3DModel(): Fish3DModel {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const geo = <T extends THREE.BufferGeometry>(value: T): T => (geometries.push(value), value);
  const mat = <T extends THREE.Material>(value: T): T => (materials.push(value), value);
  const tex = <T extends THREE.Texture>(value: T): T => (textures.push(value), value);
  const standard = (color: string, roughness = 0.48) =>
    mat(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, side: THREE.DoubleSide }));

  const navy = standard('#123453');
  const finColorMaterial = standard('#ff9a21');
  const orangeDetail = standard('#ff941b');
  const white = standard('#fffaf1', 0.3);
  const iris = standard('#1589d7', 0.2);
  const pupil = standard('#08223a', 0.16);
  const mouthColor = standard('#602436');
  const tongue = standard('#ff7280');
  const shine = mat(new THREE.MeshBasicMaterial({ color: '#ffffff' }));

  // Single compact, round clownfish body: generous forehead and cheeks,
  // short tapered peduncle. Front is +X; body and paint share the same UVs.
  const bodyGeometry = geo(new THREE.SphereGeometry(1, 64, 40));
  const positions = bodyGeometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const t = THREE.MathUtils.smoothstep(x, -0.85, 0.48);
    const width = 0.77 + 0.23 * t;
    const forwardCheek = 0.1 * Math.exp(-Math.pow((x - 0.48) / 0.38, 2));
    positions.setXYZ(
      i,
      x * 0.94 + forwardCheek,
      positions.getY(i) * 1.0 * width,
      positions.getZ(i) * 0.94 * width,
    );
  }
  positions.needsUpdate = true;
  bodyGeometry.computeVertexNormals();

  // Draw stripes per texture pixel using the *same parametric coordinates*
  // as SphereGeometry. Unlike vertex colors, the band edges remain smooth
  // even when they fall between mesh vertices. No overlapping stripe meshes.
  const bodyCanvas = document.createElement('canvas');
  bodyCanvas.width = 1024;
  bodyCanvas.height = 512;
  const bodyContext = bodyCanvas.getContext('2d');
  if (!bodyContext) throw new Error('Finny body canvas unavailable');
  const smooth = (a: number, b: number, x: number) => {
    const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const redrawBody = (color: string) => {
    const image = bodyContext.createImageData(1024, 512);
    const base = new THREE.Color(color);
    const warm = new THREE.Color('#ffc24b');
    const shade = new THREE.Color('#e96c21');
    const whiteBand = new THREE.Color('#fff9ed');
    const border = new THREE.Color('#183854');
    const result = new THREE.Color();
    const srgb = new THREE.Color();
    const bands: readonly (readonly [number, number])[] = [
      [0.02, 0.125],
      [-0.58, 0.07],
    ];
    for (let py = 0; py < 512; py++) {
      // Canvas top is UV v=1; sphere y=cos(theta).
      const theta = (Math.PI * (py + 0.5)) / 512;
      const y = Math.cos(theta);
      const radial = Math.sin(theta);
      for (let px = 0; px < 1024; px++) {
        const phi = (Math.PI * 2 * (px + 0.5)) / 1024;
        const sphereX = -Math.cos(phi) * radial;
        const t = smooth(-0.85, 0.48, sphereX);
        const x = sphereX * 0.94 + 0.1 * Math.exp(-Math.pow((sphereX - 0.48) / 0.38, 2));
        const bodyY = y * (0.77 + 0.23 * t);
        const lighting = smooth(-0.8, 0.9, bodyY);
        result
          .copy(shade)
          .lerp(base, 0.77)
          .lerp(warm, lighting * 0.28);
        // Gentle curved stripes, behind the facial features.
        const bandX = x + 0.045 * (1 - Math.abs(bodyY));
        for (const [center, halfWidth] of bands) {
          const distance = Math.abs(bandX - center);
          const outer = 1 - smooth(halfWidth + 0.013, halfWidth + 0.029, distance);
          const inner = 1 - smooth(halfWidth - 0.023, halfWidth - 0.006, distance);
          result.lerp(border, outer);
          result.lerp(whiteBand, inner);
        }
        const i = (py * 1024 + px) * 4;
        // THREE.Color channels are linear; ImageData expects sRGB bytes.
        srgb.copy(result).convertLinearToSRGB();
        image.data[i] = Math.round(srgb.r * 255);
        image.data[i + 1] = Math.round(srgb.g * 255);
        image.data[i + 2] = Math.round(srgb.b * 255);
        image.data[i + 3] = 255;
      }
    }
    bodyContext.putImageData(image, 0, 0);
  };
  redrawBody('#ff941b');
  const bodyTexture = tex(new THREE.CanvasTexture(bodyCanvas));
  bodyTexture.colorSpace = THREE.SRGBColorSpace;
  const bodyMaterial = mat(new THREE.MeshStandardMaterial({ map: bodyTexture, roughness: 0.46 }));
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.name = 'fish-paintable-body';
  group.add(body);

  const paintCanvas = document.createElement('canvas');
  paintCanvas.width = 1024;
  paintCanvas.height = 512;
  const paintContext = paintCanvas.getContext('2d');
  if (!paintContext) throw new Error('Finny paint canvas unavailable');
  const paintTexture = tex(new THREE.CanvasTexture(paintCanvas));
  paintTexture.colorSpace = THREE.SRGBColorSpace;
  const paintMaterial = mat(
    new THREE.MeshBasicMaterial({
      map: paintTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side: THREE.FrontSide,
    }),
  );
  const paintGeometry = geo(bodyGeometry.clone());
  paintGeometry.scale(1.008, 1.008, 1.008);
  const paintLayer = new THREE.Mesh(paintGeometry, paintMaterial);
  paintLayer.name = 'fish-paint-layer';
  paintLayer.visible = false;
  paintLayer.renderOrder = 3;
  group.add(paintLayer);

  const ellipsoid = (
    radius: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    parent: THREE.Object3D = group,
  ) => {
    const mesh = new THREE.Mesh(geo(new THREE.SphereGeometry(radius, 24, 16)), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };

  // Fin cap faces are orange on BOTH sides; thin navy walls form the edge.
  // ExtrudeGeometry assigns material 0 to caps and material 1 to walls.
  // One mesh per fin prevents the reversed-side navy artifact and z-fighting.
  const extrude = (shape: THREE.Shape) =>
    geo(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.045,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.018,
        bevelThickness: 0.018,
        curveSegments: 14,
        steps: 1,
      }),
    );
  const fanShape = (length: number, spread: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(
      -length * 0.3,
      spread * 0.32,
      -length * 0.76,
      spread * 0.96,
      -length,
      spread * 0.78,
    );
    shape.quadraticCurveTo(-length * 1.11, 0, -length, -spread * 0.78);
    shape.bezierCurveTo(-length * 0.76, -spread * 0.96, -length * 0.3, -spread * 0.32, 0, 0);
    return shape;
  };
  const makeFin = (shape: THREE.Shape, x: number, y: number, z: number) => {
    const fin = new THREE.Mesh(extrude(shape), [finColorMaterial, navy]);
    fin.position.set(x, y, z);
    group.add(fin);
    return fin;
  };
  const tail = makeFin(fanShape(0.65, 0.47), -0.99, 0, -0.022);
  const sweptFinShape = (height: number, width: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(
      -width * 0.08,
      height * 0.4,
      -width * 0.37,
      height * 0.86,
      -width * 0.8,
      height,
    );
    shape.quadraticCurveTo(-width * 1.05, height * 1.06, -width, height * 0.75);
    shape.bezierCurveTo(-width * 0.93, height * 0.42, -width * 0.8, height * 0.1, -width * 1.16, 0);
    shape.closePath();
    return shape;
  };
  makeFin(sweptFinShape(0.36, 0.54), -0.12, 0.82, -0.025);
  const anal = makeFin(sweptFinShape(0.25, 0.41), -0.3, -0.71, -0.025);
  anal.scale.y = -1;
  const leftFin = makeFin(fanShape(0.32, 0.25), -0.06, -0.22, 0.77);
  const rightFin = makeFin(fanShape(0.32, 0.25), -0.06, -0.22, -0.77);
  rightFin.rotation.y = Math.PI;

  // Forward-set eyes: visible in front and 3/4 views, no stalk effect.
  // The front-facing eye centers are separated along Z but sit on the nose.
  for (const side of [-1, 1]) {
    const z = side * 0.35;
    ellipsoid(0.235, navy, 0.805, 0.23, z, 0.42, 1.05, 0.83);
    ellipsoid(0.218, white, 0.836, 0.235, z, 0.43, 1.07, 0.8);
    ellipsoid(0.145, iris, 0.867, 0.22, z + side * 0.014, 0.46, 1.04, 0.78);
    ellipsoid(0.105, pupil, 0.89, 0.22, z + side * 0.015, 0.44, 1.0, 0.78);
    ellipsoid(0.039, shine, 0.917, 0.282, z - side * 0.022, 0.42, 1, 0.64);
    const brow = ellipsoid(0.055, orangeDetail, 0.818, 0.515, z, 0.9, 0.36, 2.2);
    brow.rotation.x = side * 0.12;
  }

  // Smile visible from front and three-quarter angles: a gently curved
  // dark mouth on the nose, with pink lower interior and orange lip.
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.919, -0.13, -0.24),
    new THREE.Vector3(0.988, -0.255, -0.13),
    new THREE.Vector3(1.015, -0.29, 0),
    new THREE.Vector3(0.988, -0.255, 0.13),
    new THREE.Vector3(0.919, -0.13, 0.24),
  ]);
  const smile = new THREE.Mesh(
    geo(new THREE.TubeGeometry(smileCurve, 24, 0.025, 8, false)),
    mouthColor,
  );
  group.add(smile);
  ellipsoid(0.07, tongue, 1.015, -0.31, 0, 0.28, 0.23, 1.35);

  let disposed = false;
  let imageVersion = 0;
  const setPaintImage = (image?: string) => {
    const version = ++imageVersion;
    paintLayer.visible = false;
    paintContext.clearRect(0, 0, 1024, 512);
    paintTexture.needsUpdate = true;
    if (!image) return;
    const source = new Image();
    source.onload = () => {
      if (disposed || version !== imageVersion) return;
      paintContext.drawImage(source, 0, 0, 1024, 512);
      paintTexture.needsUpdate = true;
      paintLayer.visible = true;
    };
    source.src = image;
  };
  return {
    group,
    body,
    paintCanvas,
    paintTexture,
    tail,
    leftFin,
    rightFin,
    setBodyColor: (color: string) => {
      redrawBody(color);
      bodyTexture.needsUpdate = true;
      orangeDetail.color.set(color);
    },
    setFinColor: (color: string) => finColorMaterial.color.set(color),
    setPaintImage,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      imageVersion++;
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
      textures.forEach((item) => item.dispose());
    },
  };
}
