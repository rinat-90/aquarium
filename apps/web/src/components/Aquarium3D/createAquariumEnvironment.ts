import * as THREE from 'three';

export type AquariumEnvironment = {
  update: (
    elapsed: number,
  ) => void;

  destroy: () => void;
};

type PlantLeaf = {
  mesh: THREE.Mesh;

  baseRotationZ: number;

  phase: number;
  sway: number;
  speed: number;
};

export function createAquariumEnvironment(
  scene: THREE.Scene,
  tankWidth: number,
  tankHeight: number,
  tankDepth: number,
): AquariumEnvironment {
  const group = new THREE.Group();
  scene.add(group);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const plantLeaves: PlantLeaf[] = [];

  const addGeometry = <T extends THREE.BufferGeometry>(
    geometry: T,
  ): T => {
    geometries.push(geometry);
    return geometry;
  };

  const addMaterial = <T extends THREE.Material>(
    material: T,
  ): T => {
    materials.push(material);
    return material;
  };

  const floorY =
    -tankHeight / 2 + 0.18;

  /*
   * --------------------------------
   * WARM CARTOON SAND
   * --------------------------------
   */
  const sandGeometry =
    addGeometry(
      new THREE.PlaneGeometry(
        tankWidth * 1.18,
        tankDepth * 1.25,
        48,
        24,
      ),
    );

  sandGeometry.rotateX(-Math.PI / 2);

  const sandPositions =
    sandGeometry.attributes.position as
      THREE.BufferAttribute;

  for (
    let index = 0;
    index < sandPositions.count;
    index++
  ) {
    const x =
      sandPositions.getX(index);
    const z =
      sandPositions.getZ(index);

    const broadDunes =
      Math.sin(x * 0.72 + z * 0.3) *
        0.055 +
      Math.cos(z * 1.7 - x * 0.22) *
        0.035;

    const sideMounds =
      Math.max(
        0,
        Math.abs(x) -
          tankWidth * 0.27,
      ) * 0.055;

    sandPositions.setY(
      index,
      broadDunes + sideMounds,
    );
  }

  sandPositions.needsUpdate = true;
  sandGeometry.computeVertexNormals();

  const sandMaterial =
    addMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xe6a33a,
        roughness: 0.95,
        metalness: 0,
      }),
    );

  const sand =
    new THREE.Mesh(
      sandGeometry,
      sandMaterial,
    );

  sand.position.y = floorY;
  group.add(sand);

  const lowerSandMaterial =
    addMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xa86d2c,
        roughness: 1,
      }),
    );

  const lowerSand =
    new THREE.Mesh(
      addGeometry(
        new THREE.BoxGeometry(
          tankWidth * 1.15,
          0.32,
          tankDepth * 1.2,
        ),
      ),
      lowerSandMaterial,
    );

  lowerSand.position.y =
    -tankHeight / 2 + 0.02;

  group.add(lowerSand);

  /*
   * --------------------------------
   * CARTOON ROCKS
   * --------------------------------
   */
  const rockMaterials = [
    0x236f9d,
    0x315a9b,
    0x5650a6,
    0x2b86a5,
  ].map((color) =>
    addMaterial(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
      }),
    ),
  );

  const createRock = (
    x: number,
    z: number,
    size: number,
    colorIndex: number,
    squash = 0.72,
  ) => {
    const rock =
      new THREE.Mesh(
        addGeometry(
          new THREE.SphereGeometry(
            size,
            12,
            8,
          ),
        ),
        rockMaterials[
          colorIndex %
            rockMaterials.length
        ],
      );

    rock.scale.set(
      1.25,
      squash,
      0.92,
    );

    rock.position.set(
      x,
      floorY +
        size * squash * 0.6,
      z,
    );

    rock.rotation.y =
      Math.random() * Math.PI;

    group.add(rock);
    return rock;
  };

  createRock(-4.45, -1.55, 0.75, 0);
  createRock(-3.72, -1.72, 0.58, 2);
  createRock(-4.75, -0.9, 0.48, 1);
  createRock(-3.15, -1.95, 0.38, 3);

  createRock(4.4, -1.62, 0.72, 0);
  createRock(3.65, -1.82, 0.52, 2);
  createRock(4.8, -0.88, 0.42, 1);
  createRock(3.0, -2.02, 0.34, 3);

  /*
   * --------------------------------
   * COLORFUL SEAWEED
   * --------------------------------
   */
  const seaweedMaterials = [
    0x2aa84a,
    0x63c83c,
    0x168d58,
    0x75d544,
  ].map((color) =>
    addMaterial(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.72,
        side: THREE.DoubleSide,
      }),
    ),
  );

  const createSeaweedBlade = (
    x: number,
    z: number,
    height: number,
    width: number,
    lean: number,
    materialIndex: number,
  ) => {
    const geometry =
      addGeometry(
        new THREE.PlaneGeometry(
          width,
          height,
          3,
          10,
        ),
      );

    const positions =
      geometry.attributes.position as
        THREE.BufferAttribute;

    for (
      let index = 0;
      index < positions.count;
      index++
    ) {
      const px =
        positions.getX(index);
      const py =
        positions.getY(index);

      const normalized =
        THREE.MathUtils.clamp(
          py / height + 0.5,
          0,
          1,
        );

      const taper =
        1 -
        Math.pow(normalized, 2.1) *
          0.76;

      positions.setX(
        index,
        px * taper +
          lean *
            Math.pow(
              normalized,
              1.6,
            ),
      );

      positions.setZ(
        index,
        Math.sin(
          normalized * Math.PI,
        ) * 0.12,
      );
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const leaf =
      new THREE.Mesh(
        geometry,
        seaweedMaterials[
          materialIndex %
            seaweedMaterials.length
        ],
      );

    leaf.position.set(
      x,
      floorY + height / 2 + 0.05,
      z,
    );

    leaf.rotation.y =
      (Math.random() - 0.5) * 0.7;

    const baseRotationZ =
      (Math.random() - 0.5) *
      0.08;

    leaf.rotation.z =
      baseRotationZ;

    group.add(leaf);

    plantLeaves.push({
      mesh: leaf,
      baseRotationZ,
      phase:
        Math.random() *
        Math.PI *
        2,
      sway:
        0.018 +
        Math.random() * 0.022,
      speed:
        0.3 +
        Math.random() * 0.2,
    });
  };

  const createSeaweedCluster = (
    x: number,
    z: number,
    count: number,
    minHeight: number,
    maxHeight: number,
    spread: number,
  ) => {
    for (
      let index = 0;
      index < count;
      index++
    ) {
      createSeaweedBlade(
        x +
          (Math.random() - 0.5) *
            spread,
        z +
          (Math.random() - 0.5) *
            spread *
            0.45,
        minHeight +
          Math.random() *
            (maxHeight - minHeight),
        0.11 +
          Math.random() * 0.11,
        (Math.random() - 0.5) *
          0.65,
        index,
      );
    }
  };

  createSeaweedCluster(
    -4.35,
    -1.95,
    12,
    1.0,
    2.35,
    1.15,
  );

  createSeaweedCluster(
    -3.25,
    -2.15,
    7,
    0.7,
    1.55,
    0.8,
  );

  createSeaweedCluster(
    4.3,
    -1.95,
    12,
    1.0,
    2.4,
    1.15,
  );

  createSeaweedCluster(
    3.2,
    -2.15,
    7,
    0.7,
    1.5,
    0.8,
  );

  /*
   * --------------------------------
   * BRANCHING CARTOON CORAL
   * --------------------------------
   */
  const coralMaterials = [
    0xff7043,
    0xff3f72,
    0xf2c23e,
    0xe25bcb,
  ].map((color) =>
    addMaterial(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
      }),
    ),
  );

  const createCylinderBetween = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    material: THREE.Material,
  ) => {
    const direction =
      new THREE.Vector3()
        .subVectors(end, start);

    const length =
      direction.length();

    const branch =
      new THREE.Mesh(
        addGeometry(
          new THREE.CylinderGeometry(
            radius * 0.82,
            radius,
            length,
            8,
          ),
        ),
        material,
      );

    branch.position
      .copy(start)
      .add(end)
      .multiplyScalar(0.5);

    branch.quaternion
      .setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      );

    group.add(branch);
    return branch;
  };

  const createCoral = (
    x: number,
    z: number,
    scale: number,
    materialIndex: number,
  ) => {
    const material =
      coralMaterials[
        materialIndex %
          coralMaterials.length
      ];

    const base =
      new THREE.Vector3(
        x,
        floorY + 0.04,
        z,
      );

    const trunkTop =
      new THREE.Vector3(
        x,
        floorY + 0.72 * scale,
        z,
      );

    createCylinderBetween(
      base,
      trunkTop,
      0.09 * scale,
      material,
    );

    const branches = [
      [-0.3, 0.52],
      [0.32, 0.62],
      [-0.22, 0.82],
      [0.2, 0.92],
    ] as const;

    for (
      const [dx, height] of
      branches
    ) {
      const start =
        new THREE.Vector3(
          x,
          floorY +
            height *
              scale *
              0.58,
          z,
        );

      const end =
        new THREE.Vector3(
          x + dx * scale,
          floorY +
            height * scale,
          z +
            Math.abs(dx) *
              0.1,
        );

      createCylinderBetween(
        start,
        end,
        0.065 * scale,
        material,
      );

      const tip =
        new THREE.Mesh(
          addGeometry(
            new THREE.SphereGeometry(
              0.085 * scale,
              8,
              6,
            ),
          ),
          material,
        );

      tip.position.copy(end);
      group.add(tip);
    }
  };

  createCoral(-4.55, -1.15, 0.95, 0);
  createCoral(-3.65, -1.25, 0.72, 3);
  createCoral(-2.95, -1.85, 0.62, 2);

  createCoral(4.5, -1.15, 0.95, 1);
  createCoral(3.65, -1.35, 0.72, 0);
  createCoral(2.95, -1.9, 0.58, 2);

  /*
   * --------------------------------
   * CARTOON SPONGES
   * --------------------------------
   */
  const spongeMaterials = [
    0x16aee0,
    0x7650d9,
    0xff7d3b,
  ].map((color) =>
    addMaterial(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.72,
        side: THREE.DoubleSide,
      }),
    ),
  );

  const createSpongeCluster = (
    x: number,
    z: number,
    scale: number,
    materialIndex: number,
  ) => {
    const material =
      spongeMaterials[
        materialIndex %
          spongeMaterials.length
      ];

    const heights =
      [0.52, 0.72, 0.4];

    const offsets =
      [-0.22, 0, 0.23];

    heights.forEach(
      (height, index) => {
        const geometry =
          addGeometry(
            new THREE.CylinderGeometry(
              0.12 * scale,
              0.18 * scale,
              height * scale,
              12,
              1,
              true,
            ),
          );

        const sponge =
          new THREE.Mesh(
            geometry,
            material,
          );

        sponge.position.set(
          x +
            offsets[index] *
              scale,
          floorY +
            height *
              scale /
              2 +
            0.05,
          z,
        );

        sponge.rotation.z =
          (index - 1) * 0.09;

        group.add(sponge);
      },
    );
  };

  createSpongeCluster(
    -4.7,
    -0.78,
    0.9,
    0,
  );

  createSpongeCluster(
    -3.95,
    -0.9,
    0.68,
    2,
  );

  createSpongeCluster(
    4.55,
    -0.78,
    0.82,
    1,
  );

  /*
   * --------------------------------
   * BACKGROUND SHIPWRECK
   * --------------------------------
   *
   * This is intentionally muted and
   * pushed backward so it feels embedded
   * in the world instead of like a toy
   * placed in front of the fish.
   */
  const wreck =
    new THREE.Group();

  wreck.position.set(
    1.15,
    floorY + 0.12,
    -3.15,
  );

  wreck.rotation.set(
    0.02,
    -0.12,
    -0.08,
  );

  wreck.scale.setScalar(1.28);

  const wreckWood =
    addMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x176e76,
        roughness: 0.88,
      }),
    );

  const wreckDark =
    addMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x10535f,
        roughness: 0.94,
      }),
    );

  const wreckEdge =
    addMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x2a9290,
        roughness: 0.82,
      }),
    );

  const hull =
    new THREE.Mesh(
      addGeometry(
        new THREE.SphereGeometry(
          1.05,
          16,
          10,
        ),
      ),
      wreckWood,
    );

  hull.scale.set(
    1.8,
    0.55,
    0.62,
  );

  hull.position.y = 0.3;
  wreck.add(hull);

  const deck =
    new THREE.Mesh(
      addGeometry(
        new THREE.BoxGeometry(
          2.65,
          0.18,
          0.82,
        ),
      ),
      wreckEdge,
    );

  deck.position.set(
    0,
    0.77,
    0,
  );

  wreck.add(deck);

  /*
   * Raised stern with big arched windows.
   */
  const stern =
    new THREE.Mesh(
      addGeometry(
        new THREE.BoxGeometry(
          1.15,
          0.72,
          0.78,
        ),
      ),
      wreckWood,
    );

  stern.position.set(
    0.92,
    1.05,
    -0.02,
  );

  stern.rotation.z = -0.05;
  wreck.add(stern);

  const windowMaterial =
    addMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x0b4056,
        roughness: 0.5,
      }),
    );

  const windowGeometry =
    addGeometry(
      new THREE.CircleGeometry(
        0.11,
        12,
      ),
    );

  for (
    let index = 0;
    index < 4;
    index++
  ) {
    const window =
      new THREE.Mesh(
        windowGeometry,
        windowMaterial,
      );

    window.position.set(
      0.55 +
        index * 0.24,
      1.08,
      0.405,
    );

    wreck.add(window);
  }

  /*
   * Broken masts.
   */
  const createMast = (
    x: number,
    height: number,
    lean: number,
  ) => {
    const mast =
      new THREE.Mesh(
        addGeometry(
          new THREE.CylinderGeometry(
            0.055,
            0.075,
            height,
            8,
          ),
        ),
        wreckDark,
      );

    mast.position.set(
      x,
      0.78 + height / 2,
      0,
    );

    mast.rotation.z = lean;
    wreck.add(mast);

    const crossbar =
      new THREE.Mesh(
        addGeometry(
          new THREE.CylinderGeometry(
            0.035,
            0.04,
            0.92,
            8,
          ),
        ),
        wreckDark,
      );

    crossbar.rotation.z =
      Math.PI / 2 + lean;

    crossbar.position.set(
      x - Math.sin(lean) *
        height * 0.28,
      0.78 + height * 0.7,
      0,
    );

    wreck.add(crossbar);
  };

  createMast(-0.55, 1.8, -0.12);
  createMast(0.32, 1.38, 0.1);

  /*
   * A broken bow rail gives the silhouette
   * more of a shipwreck/storybook feel.
   */
  const railMaterial = wreckEdge;

  for (
    const x of
    [-1.05, -0.72, -0.39]
  ) {
    createCylinderBetween(
      new THREE.Vector3(
        wreck.position.x + x,
        floorY + 0.98,
        wreck.position.z + 0.3,
      ),
      new THREE.Vector3(
        wreck.position.x + x,
        floorY + 1.35,
        wreck.position.z + 0.3,
      ),
      0.035,
      railMaterial,
    );
  }

  group.add(wreck);

  /*
   * Rocks around the wreck help visually
   * bury it into the sand.
   */
  createRock(0.15, -2.65, 0.38, 0);
  createRock(1.65, -2.7, 0.45, 3);
  createRock(2.25, -2.5, 0.3, 2);

  /*
   * --------------------------------
   * STARFISH + SHELLS
   * --------------------------------
   */
  const starMaterial =
    addMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xf45168,
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
    );

  const createStarfish = (
    x: number,
    z: number,
    scale: number,
  ) => {
    const shape =
      new THREE.Shape();

    const points = 10;

    for (
      let index = 0;
      index < points;
      index++
    ) {
      const radius =
        index % 2 === 0
          ? 0.22 * scale
          : 0.09 * scale;

      const angle =
        -Math.PI / 2 +
        index *
          Math.PI /
          5;

      const px =
        Math.cos(angle) * radius;

      const py =
        Math.sin(angle) * radius;

      if (index === 0) {
        shape.moveTo(px, py);
      } else {
        shape.lineTo(px, py);
      }
    }

    shape.closePath();

    const star =
      new THREE.Mesh(
        addGeometry(
          new THREE.ShapeGeometry(
            shape,
          ),
        ),
        starMaterial,
      );

    star.position.set(
      x,
      floorY + 0.08,
      z,
    );

    star.rotation.x =
      -Math.PI / 2;

    star.rotation.z =
      Math.random() *
      Math.PI;

    group.add(star);
  };

  createStarfish(-3.6, -0.45, 1);
  createStarfish(3.55, -0.55, 0.9);
  createStarfish(1.75, -0.7, 0.72);

  const shellMaterial =
    addMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xf5a074,
        roughness: 0.78,
      }),
    );

  const createShell = (
    x: number,
    z: number,
    scale: number,
  ) => {
    const shell =
      new THREE.Mesh(
        addGeometry(
          new THREE.SphereGeometry(
            0.18 * scale,
            12,
            8,
          ),
        ),
        shellMaterial,
      );

    shell.scale.set(
      1.35,
      0.62,
      0.85,
    );

    shell.position.set(
      x,
      floorY + 0.1,
      z,
    );

    shell.rotation.z = -0.35;
    group.add(shell);
  };

  createShell(-2.65, -0.75, 1);
  createShell(2.75, -0.85, 0.8);

  /*
   * Small colorful pebbles finish the
   * bottom without cluttering the center.
   */
  const pebbleMaterials = [
    0x4167b1,
    0x7051b2,
    0x2b8aaa,
  ].map((color) =>
    addMaterial(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
      }),
    ),
  );

  const pebblePositions = [
    [-2.9, -0.35],
    [-3.25, -0.7],
    [-2.4, -1.15],
    [2.85, -0.4],
    [3.15, -0.75],
    [2.4, -1.1],
  ] as const;

  pebblePositions.forEach(
    ([x, z], index) => {
      const pebble =
        new THREE.Mesh(
          addGeometry(
            new THREE.SphereGeometry(
              0.12 +
                (index % 3) *
                  0.025,
              8,
              6,
            ),
          ),
          pebbleMaterials[
            index %
              pebbleMaterials.length
          ],
        );

      pebble.scale.set(
        1.45,
        0.55,
        1,
      );

      pebble.position.set(
        x,
        floorY + 0.08,
        z,
      );

      group.add(pebble);
    },
  );

  const update = (
    elapsed: number,
  ) => {
    for (
      const leaf of plantLeaves
    ) {
      leaf.mesh.rotation.z =
        leaf.baseRotationZ +
        Math.sin(
          elapsed *
            leaf.speed +
            leaf.phase,
        ) *
          leaf.sway;
    }
  };

  const destroy = () => {
    scene.remove(group);

    for (
      const geometry of
      new Set(geometries)
    ) {
      geometry.dispose();
    }

    for (
      const material of
      new Set(materials)
    ) {
      material.dispose();
    }

    group.clear();
  };

  return {
    update,
    destroy,
  };
}