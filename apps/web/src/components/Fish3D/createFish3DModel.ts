import * as THREE from 'three';

export type Fish3DModel = {
  group: THREE.Group;

  /*
   * Expose the body because the painting
   * system will raycast against it.
   */
  body: THREE.Mesh;

  /*
   * Canvas + texture will become our
   * paint surface.
   */
  paintCanvas: HTMLCanvasElement;
  paintTexture: THREE.CanvasTexture;

  tail: THREE.Mesh;
  leftFin: THREE.Mesh;
  rightFin: THREE.Mesh;

  setBodyColor: (
    color: string,
  ) => void;

  setFinColor: (
    color: string,
  ) => void;

  dispose: () => void;
};

export function createFish3DModel(): Fish3DModel {
  const group =
    new THREE.Group();

  /*
   * Paint layer
   *
   * For now this canvas is completely
   * transparent, so the solid body color
   * remains visible underneath.
   */
  const paintCanvas =
    document.createElement(
      'canvas',
    );

  paintCanvas.width = 1024;
  paintCanvas.height = 512;

  const paintContext =
    paintCanvas.getContext(
      '2d',
    );

  if (!paintContext) {
    throw new Error(
      'Could not create fish paint canvas.',
    );
  }

  /*
   * Explicitly start transparent.
   */
  paintContext.clearRect(
    0,
    0,
    paintCanvas.width,
    paintCanvas.height,
  );

  const paintTexture =
    new THREE.CanvasTexture(
      paintCanvas,
    );

  paintTexture.colorSpace =
    THREE.SRGBColorSpace;

  /*
   * Prevent visible repetition outside
   * the normal sphere UV range.
   */
  paintTexture.wrapS =
    THREE.ClampToEdgeWrapping;

  paintTexture.wrapT =
    THREE.ClampToEdgeWrapping;

  /*
   * Materials
   */
  const bodyMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xff8a3d,
      roughness: 0.55,
      metalness: 0,
    });

  const finMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xffb347,
      roughness: 0.6,
      metalness: 0,
      side: THREE.DoubleSide,
    });

  const whiteMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
    });

  const pupilMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.5,
    });

  /*
   * Body
   *
   * Fish faces +X.
   */
  const bodyGeometry =
    new THREE.SphereGeometry(
      1,
      40,
      28,
    );

  bodyGeometry.scale(
    1.55,
    0.9,
    0.72,
  );

  const body =
    new THREE.Mesh(
      bodyGeometry,
      bodyMaterial,
    );

  /*
   * This gives us an easy way to
   * recognize the body during raycasts.
   */
  body.name =
    'fish-paintable-body';

  group.add(body);


  /*
 * Transparent painting layer.
 *
 * This is a second copy of the body
 * sitting just above the solid body.
 */
  const paintGeometry =
    bodyGeometry.clone();

  /*
   * Make it only slightly larger to
   * avoid z-fighting with the body.
   */
  paintGeometry.scale(
    1.003,
    1.003,
    1.003,
  );

  const paintMaterial =
    new THREE.MeshBasicMaterial({
      map: paintTexture,

      transparent: true,

      depthWrite: false,

      side: THREE.FrontSide,
    });

  const paintBody =
    new THREE.Mesh(
      paintGeometry,
      paintMaterial,
    );

  paintBody.name =
    'fish-paint-layer';

  group.add(paintBody);

  /*
   * Tail
   */
  const tailShape =
    new THREE.Shape();

  tailShape.moveTo(
    0.15,
    0,
  );

  tailShape.bezierCurveTo(
    -0.25,
    0.25,
    -0.75,
    0.9,
    -1.15,
    1.0,
  );

  tailShape.quadraticCurveTo(
    -0.88,
    0.25,
    -0.78,
    0,
  );

  tailShape.quadraticCurveTo(
    -0.88,
    -0.25,
    -1.15,
    -1.0,
  );

  tailShape.bezierCurveTo(
    -0.75,
    -0.9,
    -0.25,
    -0.25,
    0.15,
    0,
  );

  const tailGeometry =
    new THREE.ShapeGeometry(
      tailShape,
    );

  const tail =
    new THREE.Mesh(
      tailGeometry,
      finMaterial,
    );

  tail.position.set(
    -1.48,
    0,
    0,
  );

  group.add(tail);

  /*
   * Dorsal / top fin
   */
  const dorsalShape =
    new THREE.Shape();

  dorsalShape.moveTo(
    -0.65,
    0,
  );

  dorsalShape.bezierCurveTo(
    -0.35,
    0.45,
    -0.05,
    0.95,
    0.2,
    1.05,
  );

  dorsalShape.bezierCurveTo(
    0.35,
    0.65,
    0.55,
    0.25,
    0.72,
    0,
  );

  dorsalShape.lineTo(
    -0.65,
    0,
  );

  const dorsalGeometry =
    new THREE.ShapeGeometry(
      dorsalShape,
    );

  const dorsalFin =
    new THREE.Mesh(
      dorsalGeometry,
      finMaterial,
    );

  dorsalFin.position.set(
    -0.15,
    0.72,
    0,
  );

  group.add(dorsalFin);

  /*
   * Side fins
   */
  const leftFinGeometry =
    new THREE.ConeGeometry(
      0.32,
      0.75,
      24,
    );

  const rightFinGeometry =
    leftFinGeometry.clone();

  const leftFin =
    new THREE.Mesh(
      leftFinGeometry,
      finMaterial,
    );

  leftFin.position.set(
    0,
    -0.18,
    0.62,
  );

  leftFin.rotation.x =
    Math.PI / 2.8;

  leftFin.rotation.z =
    -Math.PI / 2.5;

  group.add(leftFin);

  const rightFin =
    new THREE.Mesh(
      rightFinGeometry,
      finMaterial,
    );

  rightFin.position.set(
    0,
    -0.18,
    -0.62,
  );

  rightFin.rotation.x =
    -Math.PI / 2.8;

  rightFin.rotation.z =
    -Math.PI / 2.5;

  group.add(rightFin);

  /*
   * Eyes
   */
  const eyeGeometry =
    new THREE.SphereGeometry(
      0.2,
      24,
      16,
    );

  const pupilGeometry =
    new THREE.SphereGeometry(
      0.09,
      20,
      14,
    );

  const createEye = (
    z: number,
  ) => {
    const eye =
      new THREE.Mesh(
        eyeGeometry,
        whiteMaterial,
      );

    eye.position.set(
      1.05,
      0.28,
      z,
    );

    group.add(eye);

    const pupil =
      new THREE.Mesh(
        pupilGeometry,
        pupilMaterial,
      );

    pupil.position.set(
      1.18,
      0.3,
      z > 0
        ? z + 0.12
        : z - 0.12,
    );

    group.add(pupil);
  };

  createEye(0.58);
  createEye(-0.58);

  /*
   * Slight default angle so the
   * creator preview feels 3D.
   */
  group.rotation.y =
    -0.18;

  /*
   * Customization
   */
  const setBodyColor = (
    color: string,
  ) => {
    bodyMaterial.color.set(
      color,
    );
  };

  const setFinColor = (
    color: string,
  ) => {
    finMaterial.color.set(
      color,
    );
  };

  /*
   * Cleanup
   */
  const dispose = () => {
    bodyGeometry.dispose();
    paintGeometry.dispose();

    tailGeometry.dispose();
    dorsalGeometry.dispose();

    leftFinGeometry.dispose();
    rightFinGeometry.dispose();

    eyeGeometry.dispose();
    pupilGeometry.dispose();

    paintTexture.dispose();

    bodyMaterial.dispose();
    paintMaterial.dispose();

    finMaterial.dispose();
    whiteMaterial.dispose();
    pupilMaterial.dispose();
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

    dispose,
  };
}