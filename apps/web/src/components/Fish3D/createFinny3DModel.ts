import * as THREE from 'three';
import type { Fish3DModel } from './createFish3DModel';

/** Finny mascot v7. Forward is +X; the camera initially sees the +Z side. */
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
    const width = 0.76 + 0.24 * t;
    const forwardCheek = 0.085 * Math.exp(-Math.pow((x - 0.48) / 0.38, 2));
    positions.setXYZ(
      i,
      x * 0.91 + forwardCheek,
      positions.getY(i) * 1.03 * width,
      positions.getZ(i) * 0.98 * width,
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
        const x = sphereX * 0.91 + 0.085 * Math.exp(-Math.pow((sphereX - 0.48) / 0.38, 2));
        const bodyY = y * 1.03 * (0.76 + 0.24 * t);
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
  // Rounded, swept fins: broad organic lobes, not sharp triangles.
  const fanShape = (length: number, spread: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(
      -length * 0.28,
      spread * 0.36,
      -length * 0.65,
      spread * 0.96,
      -length * 0.91,
      spread * 0.86,
    );
    shape.bezierCurveTo(
      -length * 1.16,
      spread * 0.78,
      -length * 1.18,
      spread * 0.18,
      -length * 1.08,
      0,
    );
    shape.bezierCurveTo(
      -length * 1.18,
      -spread * 0.18,
      -length * 1.16,
      -spread * 0.78,
      -length * 0.91,
      -spread * 0.86,
    );
    shape.bezierCurveTo(-length * 0.65, -spread * 0.96, -length * 0.28, -spread * 0.36, 0, 0);
    return shape;
  };
  const makeFin = (shape: THREE.Shape, x: number, y: number, z: number) => {
    const fin = new THREE.Mesh(extrude(shape), [finColorMaterial, navy]);
    fin.position.set(x, y, z);
    group.add(fin);
    return fin;
  };
  const tail = makeFin(fanShape(0.6, 0.46), -0.99, 0, -0.022);
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
  const leftFin = makeFin(fanShape(0.38, 0.29), -0.06, -0.22, 0.77);
  const rightFin = makeFin(fanShape(0.38, 0.29), -0.06, -0.22, -0.77);
  rightFin.rotation.y = Math.PI;

  // Bright, open expression. Lift the irises and pupils so Finny looks
  // toward the viewer rather than down; keep each layer close to the face.
  for (const side of [-1, 1]) {
    const z = side * 0.305;
    ellipsoid(0.305, navy, 0.747, 0.265, z, 0.33, 1.1, 0.96);
    ellipsoid(0.287, white, 0.766, 0.272, z, 0.33, 1.09, 0.93);
    ellipsoid(0.195, iris, 0.8, 0.315, z + side * 0.012, 0.36, 1.05, 0.88);
    ellipsoid(0.135, pupil, 0.826, 0.325, z + side * 0.013, 0.35, 1.03, 0.87);
    ellipsoid(0.052, shine, 0.849, 0.405, z - side * 0.047, 0.32, 1, 0.72);

    // Outer end lifted for a welcoming, playful eyebrow shape.
    const brow = ellipsoid(0.059, orangeDetail, 0.754, 0.655, z, 0.62, 0.36, 2.0);
    brow.rotation.x = -side * 0.2;
  }

  // Trace the smile against the *actual deformed body surface* rather than
  // placing a tube out in front of the nose. The arc bends around the snout.
  // Front-facing body radius is approximately 0.94, with a cheek bump.
  const mouthPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const z = (u - 0.5) * 0.6;
    const y = -0.13 - 0.145 * Math.sin(u * Math.PI);
    const width = 0.98;
    const normalized = Math.min(0.99, (y / (1.03 * width)) ** 2 + (z / (0.98 * width)) ** 2);
    const sphereX = Math.sqrt(1 - normalized);
    const x = sphereX * 0.91 + 0.085 * Math.exp(-Math.pow((sphereX - 0.48) / 0.38, 2));
    mouthPoints.push(new THREE.Vector3(x + 0.014, y, z));
  }
  const smileCurve = new THREE.CatmullRomCurve3(mouthPoints);
  group.add(
    new THREE.Mesh(geo(new THREE.TubeGeometry(smileCurve, 36, 0.019, 7, false)), mouthColor),
  );
  // A subtle lower-lip accent follows the smile instead of floating off the face.
  const lipPoints = mouthPoints
    .slice(5, 20)
    .map((point) => new THREE.Vector3(point.x + 0.003, point.y - 0.025, point.z));
  group.add(
    new THREE.Mesh(
      geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPoints), 20, 0.009, 5, false)),
      tongue,
    ),
  );

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
