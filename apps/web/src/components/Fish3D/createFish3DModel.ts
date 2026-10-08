import * as THREE from 'three';

export type Fish3DModel = {
  group: THREE.Group;
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

  group.add(body);

  /*
   * Tail
   *
   * ShapeGeometry already lies in the
   * XY plane, which is exactly what we
   * want when viewing the fish from
   * the side.
   *
   * Do NOT rotate it 90deg around Y,
   * otherwise it becomes edge-on.
   */
  const tailShape =
    new THREE.Shape();

  /*
   * Connection point at the body.
   */
  tailShape.moveTo(
    0.15,
    0,
  );

  /*
   * Upper tail.
   */
  tailShape.bezierCurveTo(
    -0.25,
    0.25,
    -0.75,
    0.9,
    -1.15,
    1.0,
  );

  /*
   * Pull inward at the center to give
   * it a proper fish-tail silhouette.
   */
  tailShape.quadraticCurveTo(
    -0.88,
    0.25,
    -0.78,
    0,
  );

  /*
   * Lower half.
   */
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

  /*
   * Body extends to about -1.55.
   * Slight overlap prevents a visible
   * gap between body and tail.
   */
  tail.position.set(
    -1.48,
    0,
    0,
  );

  group.add(tail);

  /*
   * Dorsal / top fin
   *
   * Also stays in XY so its side
   * silhouette is visible.
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
    tailGeometry.dispose();
    dorsalGeometry.dispose();

    leftFinGeometry.dispose();
    rightFinGeometry.dispose();

    eyeGeometry.dispose();
    pupilGeometry.dispose();

    bodyMaterial.dispose();
    finMaterial.dispose();
    whiteMaterial.dispose();
    pupilMaterial.dispose();
  };

  return {
    group,
    tail,
    leftFin,
    rightFin,
    setBodyColor,
    setFinColor,
    dispose,
  };
}