import * as THREE from 'three';
import type { Fish3DModel } from './createFish3DModel';

export function createAngelfish3DModel(): Fish3DModel {
  const group = new THREE.Group();

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeometry = <T extends THREE.BufferGeometry>(
    geometry: T,
  ): T => {
    geometries.push(geometry);
    return geometry;
  };

  const trackMaterial = <T extends THREE.Material>(
    material: T,
  ): T => {
    materials.push(material);
    return material;
  };

  // --------------------------------------------------
  // Painting
  // --------------------------------------------------

  const paintCanvas = document.createElement('canvas');

  paintCanvas.width = 1024;
  paintCanvas.height = 512;

  const paintContext = paintCanvas.getContext('2d');

  if (!paintContext) {
    throw new Error('Could not create angelfish paint canvas.');
  }

  const paintTexture = new THREE.CanvasTexture(paintCanvas);

  paintTexture.colorSpace = THREE.SRGBColorSpace;
  paintTexture.wrapS = THREE.RepeatWrapping;
  paintTexture.wrapT = THREE.ClampToEdgeWrapping;
  paintTexture.needsUpdate = true;

  // --------------------------------------------------
  // Materials
  // --------------------------------------------------

  const bodyMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#f6b96a',
      roughness: 0.62,
      metalness: 0,
      emissive: '#f6b96a',
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide,
    }),
  );

  const finMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#f5d28a',
      roughness: 0.65,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
    }),
  );

  const finRayMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#c99855',
      roughness: 0.7,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );

  const eyeWhiteMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#fff8e8',
      roughness: 0.4,
    }),
  );

  const irisMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#996327',
      roughness: 0.38,
    }),
  );

  const pupilMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#17202a',
      roughness: 0.25,
    }),
  );

  const highlightMaterial = trackMaterial(
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
    }),
  );

  const detailMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#a66d38',
      roughness: 0.7,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );

  // --------------------------------------------------
  // Custom body geometry
  //
  // +X = forward
  // -X = tail
  // Y  = vertical
  // Z  = body thickness
  //
  // We build rings along the X axis.
  // Each ring has a custom height and thickness.
  // --------------------------------------------------

  type BodySection = {
    x: number;
    centerY: number;
    height: number;
    depth: number;
  };

  const sections: BodySection[] = [
    {
      x: -1.12,
      centerY: 0,
      height: 0.12,
      depth: 0.10,
    },
    {
      x: -1.0,
      centerY: 0,
      height: 0.35,
      depth: 0.16,
    },
    {
      x: -0.78,
      centerY: 0,
      height: 0.76,
      depth: 0.23,
    },
    {
      x: -0.42,
      centerY: 0,
      height: 1.1,
      depth: 0.30,
    },
    {
      x: -0.05,
      centerY: 0,
      height: 1.27,
      depth: 0.34,
    },
    {
      x: 0.3,
      centerY: -0.02,
      height: 1.12,
      depth: 0.31,
    },
    {
      x: 0.62,
      centerY: -0.04,
      height: 0.84,
      depth: 0.24,
    },
    {
      x: 0.86,
      centerY: -0.07,
      height: 0.59,
      depth: 0.19,
    },
    {
      x: 1.04,
      centerY: -0.10,
      height: 0.30,
      depth: 0.12,
    },
    {
      x: 1.09,
      centerY: -0.10,
      height: 0.095,
      depth: 0.065,
    },
  ];

  const rings = 64;
  const ringSegments = 48;

  const sectionCurve = new THREE.CatmullRomCurve3(
    sections.map(
      (section) =>
        new THREE.Vector3(
          section.x,
          section.height,
          section.depth,
        ),
    ),
    false,
    'centripetal',
  );

  const centerCurve = new THREE.CatmullRomCurve3(
    sections.map(
      (section) =>
        new THREE.Vector3(
          section.x,
          section.centerY,
          0,
        ),
    ),
    false,
    'centripetal',
  );

  const bodyVertices: number[] = [];
  const bodyUVs: number[] = [];
  const bodyIndices: number[] = [];

  for (let i = 0; i <= rings; i++) {
    const t = i / rings;

    const section = sectionCurve.getPoint(t);
    const center = centerCurve.getPoint(t);

    for (let j = 0; j <= ringSegments; j++) {
      const angle = (j / ringSegments) * Math.PI * 2;

      const y =
        center.y + Math.cos(angle) * section.y;

      const z =
        Math.sin(angle) * section.z;

      bodyVertices.push(
        section.x,
        y,
        z,
      );

      bodyUVs.push(
        t,
        j / ringSegments,
      );
    }
  }

  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < ringSegments; j++) {
      const a = i * (ringSegments + 1) + j;
      const b = a + ringSegments + 1;

      bodyIndices.push(
        a,
        b,
        a + 1,
      );

      bodyIndices.push(
        b,
        b + 1,
        a + 1,
      );
    }
  }

  const bodyGeometry = trackGeometry(
    new THREE.BufferGeometry(),
  );

  bodyGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      bodyVertices,
      3,
    ),
  );

  bodyGeometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      bodyUVs,
      2,
    ),
  );

  bodyGeometry.setIndex(bodyIndices);
  bodyGeometry.computeVertexNormals();

  const body = new THREE.Mesh(
    bodyGeometry,
    bodyMaterial,
  );

  body.name = 'fish-paintable-body';
  group.add(body);

  // --------------------------------------------------
  // Paint overlay
  //
  // Uses the same topology and UV coordinates
  // as the main body.
  // --------------------------------------------------

  const paintGeometry = trackGeometry(
    bodyGeometry.clone(),
  );

  const paintPositions =
    paintGeometry.attributes.position;

  for (let i = 0; i < paintPositions.count; i++) {
    const x = paintPositions.getX(i);
    const y = paintPositions.getY(i);
    const z = paintPositions.getZ(i);

    paintPositions.setXYZ(
      i,
      x * 1.003,
      y * 1.006,
      z * 1.025,
    );
  }

  paintPositions.needsUpdate = true;
  paintGeometry.computeVertexNormals();

  const paintMaterial = trackMaterial(
    new THREE.MeshBasicMaterial({
      map: paintTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );

  const paintBody = new THREE.Mesh(
    paintGeometry,
    paintMaterial,
  );

  paintBody.name = 'fish-paint-layer';
  paintBody.renderOrder = 2;
  group.add(paintBody);

  // --------------------------------------------------
  // Curved fin mesh helper
  //
  // The fin is a ribbon between two curves:
  // rootCurve = where it joins the body
  // edgeCurve = outside silhouette
  // --------------------------------------------------

  const createCurvedFin = (
    rootPoints: THREE.Vector3[],
    edgePoints: THREE.Vector3[],
    segments = 28,
    rows = 8,
  ) => {
    const rootCurve = new THREE.CatmullRomCurve3(
      rootPoints,
    );

    const edgeCurve = new THREE.CatmullRomCurve3(
      edgePoints,
    );

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;

      const root = rootCurve.getPoint(u);
      const edge = edgeCurve.getPoint(u);

      for (let j = 0; j <= rows; j++) {
        const v = j / rows;

        const point = root.clone().lerp(
          edge,
          v,
        );

        // Gentle curvature through the fin.
        point.z +=
          Math.sin(v * Math.PI) *
          Math.sin(u * Math.PI) *
          0.045;

        vertices.push(
          point.x,
          point.y,
          point.z,
        );

        uvs.push(u, v);
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j;
        const b = a + rows + 1;

        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    const geometry = trackGeometry(
      new THREE.BufferGeometry(),
    );

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        vertices,
        3,
      ),
    );

    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(
        uvs,
        2,
      ),
    );

    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return {
      geometry,
      rootCurve,
      edgeCurve,
    };
  };

  // --------------------------------------------------
  // Fin ray helper
  // --------------------------------------------------

  const addFinRay = (
    points: THREE.Vector3[],
    radius = 0.007,
  ) => {
    const curve = new THREE.CatmullRomCurve3(
      points,
    );

    const geometry = trackGeometry(
      new THREE.TubeGeometry(
        curve,
        16,
        radius,
        5,
        false,
      ),
    );

    const mesh = new THREE.Mesh(
      geometry,
      finRayMaterial,
    );

    group.add(mesh);
    return mesh;
  };

  const addFinRays = (
    rootCurve: THREE.CatmullRomCurve3,
    edgeCurve: THREE.CatmullRomCurve3,
    count: number,
  ) => {
    for (let i = 1; i < count; i++) {
      const t = i / count;

      const root = rootCurve.getPoint(t);
      const edge = edgeCurve.getPoint(t);

      const middle = root.clone().lerp(
        edge,
        0.55,
      );

      middle.z += Math.sin(0.55 * Math.PI) * Math.sin(t * Math.PI) * 0.045 + 0.012;

      const outer = root.clone().lerp(
        edge,
        0.94,
      );

      outer.z += Math.sin(0.94 * Math.PI) * Math.sin(t * Math.PI) * 0.045 + 0.012;

      addFinRay([
        root,
        middle,
        outer,
      ]);
    }
  };

  // --------------------------------------------------
  // Dorsal fin
  // --------------------------------------------------

  const dorsal = createCurvedFin(
    [
      new THREE.Vector3(-0.88, 0.45, 0),
      new THREE.Vector3(-0.56, 0.94, 0),
      new THREE.Vector3(-0.1, 1.24, 0),
      new THREE.Vector3(0.42, 1.0, 0),
      new THREE.Vector3(0.67, 0.62, 0),
    ],
    [
      new THREE.Vector3(-1.18, 0.76, 0),
      new THREE.Vector3(-1.34, 1.52, 0),
      new THREE.Vector3(-1.16, 2.16, 0),
      new THREE.Vector3(-0.34, 1.72, 0),
      new THREE.Vector3(0.67, 0.62, 0),
    ],
  );

  const dorsalFin = new THREE.Mesh(
    dorsal.geometry,
    finMaterial,
  );

  group.add(dorsalFin);

  addFinRays(
    dorsal.rootCurve,
    dorsal.edgeCurve,
    12,
  );

  // --------------------------------------------------
  // Anal fin
  // --------------------------------------------------

  const anal = createCurvedFin(
    [
      new THREE.Vector3(-0.87, -0.44, 0),
      new THREE.Vector3(-0.56, -0.93, 0),
      new THREE.Vector3(-0.1, -1.24, 0),
      new THREE.Vector3(0.42, -0.98, 0),
      new THREE.Vector3(0.68, -0.6, 0),
    ],
    [
      new THREE.Vector3(-1.18, -0.76, 0),
      new THREE.Vector3(-1.34, -1.50, 0),
      new THREE.Vector3(-1.14, -2.09, 0),
      new THREE.Vector3(-0.34, -1.68, 0),
      new THREE.Vector3(0.68, -0.6, 0),
    ],
  );

  const analFin = new THREE.Mesh(
    anal.geometry,
    finMaterial,
  );

  group.add(analFin);

  addFinRays(
    anal.rootCurve,
    anal.edgeCurve,
    12,
  );

  // --------------------------------------------------
  // Tail
  // --------------------------------------------------

  const tailData = createCurvedFin(
    [
      new THREE.Vector3(-1.08, 0.08, 0),
      new THREE.Vector3(-1.15, 0.04, 0),
      new THREE.Vector3(-1.17, 0, 0),
      new THREE.Vector3(-1.15, -0.04, 0),
      new THREE.Vector3(-1.08, -0.08, 0),
    ],
    [
      new THREE.Vector3(-1.84, 0.46, 0),
      new THREE.Vector3(-1.82, 0.27, 0),
      new THREE.Vector3(-1.79, 0, 0),
      new THREE.Vector3(-1.82, -0.27, 0),
      new THREE.Vector3(-1.84, -0.46, 0),
    ],
    24,
    8,
  );

  const tail = new THREE.Mesh(
    tailData.geometry,
    finMaterial,
  );

  group.add(tail);

  addFinRays(
    tailData.rootCurve,
    tailData.edgeCurve,
    9,
  );

  // --------------------------------------------------
  // Pectoral fins
  //
  // These are exposed as leftFin/rightFin so
  // your existing animation can move them.
  // --------------------------------------------------

  // Broad, softly swept pectoral fins. Their roots sit on the
  // outside of the body, so they remain visible in side view.
  const sideFinShape = new THREE.Shape();
  sideFinShape.moveTo(0.06, 0.04);
  sideFinShape.bezierCurveTo(-0.14, 0.08, -0.35, -0.04, -0.53, -0.22);
  sideFinShape.bezierCurveTo(-0.60, -0.32, -0.53, -0.39, -0.40, -0.37);
  sideFinShape.bezierCurveTo(-0.20, -0.33, -0.03, -0.12, 0.06, 0.04);

  const leftFinGeometry = trackGeometry(
    new THREE.ShapeGeometry(sideFinShape, 24),
  );
  const rightFinGeometry = trackGeometry(leftFinGeometry.clone());

  const leftFin = new THREE.Mesh(leftFinGeometry, finMaterial);
  leftFin.position.set(0.30, -0.16, 0.37);
  leftFin.rotation.y = -0.16;
  leftFin.rotation.z = -0.08;
  group.add(leftFin);

  const rightFin = new THREE.Mesh(rightFinGeometry, finMaterial);
  rightFin.position.set(0.30, -0.16, -0.37);
  rightFin.rotation.y = 0.16;
  rightFin.rotation.z = -0.08;
  group.add(rightFin);

  // --------------------------------------------------
  // Eyes
  // --------------------------------------------------

  const eyeGeometry = trackGeometry(
    new THREE.SphereGeometry(
      0.135,
      24,
      16,
    ),
  );

  const irisGeometry = trackGeometry(
    new THREE.SphereGeometry(
      0.089,
      20,
      14,
    ),
  );

  const pupilGeometry = trackGeometry(
    new THREE.SphereGeometry(
      0.055,
      20,
      14,
    ),
  );

  const highlightGeometry = trackGeometry(
    new THREE.SphereGeometry(
      0.019,
      12,
      8,
    ),
  );

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      eyeGeometry,
      eyeWhiteMaterial,
    );

    eye.position.set(
      0.72,
      0.18,
      side * 0.205,
    );

    group.add(eye);

    const iris = new THREE.Mesh(
      irisGeometry,
      irisMaterial,
    );

    iris.position.set(
      0.745,
      0.18,
      side * 0.30,
    );

    group.add(iris);

    const pupil = new THREE.Mesh(
      pupilGeometry,
      pupilMaterial,
    );

    pupil.position.set(
      0.755,
      0.18,
      side * 0.375,
    );

    group.add(pupil);

    const highlight = new THREE.Mesh(
      highlightGeometry,
      highlightMaterial,
    );

    highlight.position.set(
      0.748,
      0.21,
      side * 0.425,
    );

    group.add(highlight);
  }

  // --------------------------------------------------
  // Gill curves
  // --------------------------------------------------

  for (const side of [-1, 1]) {
    const gillCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.55, 0.4, side * 0.19),
      new THREE.Vector3(0.46, 0.14, side * 0.255),
      new THREE.Vector3(0.43, -0.15, side * 0.255),
      new THREE.Vector3(0.52, -0.37, side * 0.19),
    ]);

    const gillGeometry = trackGeometry(
      new THREE.TubeGeometry(
        gillCurve,
        24,
        0.008,
        5,
        false,
      ),
    );

    const gill = new THREE.Mesh(
      gillGeometry,
      detailMaterial,
    );

    group.add(gill);
  }

  // --------------------------------------------------
  // Mouth
  // --------------------------------------------------

  const mouthGeometry = trackGeometry(
    new THREE.SphereGeometry(
      0.075,
      16,
      12,
    ),
  );

  const mouth = new THREE.Mesh(
    mouthGeometry,
    bodyMaterial,
  );

  mouth.position.set(
    1.08,
    -0.13,
    0,
  );

  mouth.scale.set(
    0.55,
    0.65,
    0.9,
  );

  group.add(mouth);

  // Slight angle in the creator preview.
  group.rotation.y = -0.18;

  // --------------------------------------------------
  // Customization
  // --------------------------------------------------

  const setBodyColor = (
    color: string,
  ) => {
    bodyMaterial.color.set(color);
    bodyMaterial.emissive.set(color);
  };

  const setFinColor = (
    color: string,
  ) => {
    finMaterial.color.set(color);
  };

  // --------------------------------------------------
  // Restore saved painting
  // --------------------------------------------------

  let disposed = false;
  let paintLoadVersion = 0;

  const setPaintImage = (
    image?: string,
  ) => {
    const version = ++paintLoadVersion;

    paintContext.clearRect(
      0,
      0,
      paintCanvas.width,
      paintCanvas.height,
    );

    if (!image) {
      paintTexture.needsUpdate = true;
      return;
    }

    const source = new Image();

    source.onload = () => {
      if (
        disposed ||
        version !== paintLoadVersion
      ) {
        return;
      }

      paintContext.clearRect(
        0,
        0,
        paintCanvas.width,
        paintCanvas.height,
      );

      paintContext.drawImage(
        source,
        0,
        0,
        paintCanvas.width,
        paintCanvas.height,
      );

      paintTexture.needsUpdate = true;
    };

    source.onerror = () => {
      if (
        disposed ||
        version !== paintLoadVersion
      ) {
        return;
      }

      console.error(
        'Failed to load angelfish paint image.',
      );
    };

    source.src = image;
  };

  // --------------------------------------------------
  // Cleanup
  // --------------------------------------------------

  const dispose = () => {
    disposed = true;
    paintLoadVersion++;

    for (const geometry of geometries) {
      geometry.dispose();
    }

    for (const material of materials) {
      material.dispose();
    }

    paintTexture.dispose();
  };

  return {
    group,
    body,
    paintCanvas,
    paintTexture,
    tail,
    leftFin,
    rightFin,
    setBodyColor,
    setFinColor,
    setPaintImage,
    dispose,
  };
}

