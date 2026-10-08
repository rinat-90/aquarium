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
  const group =
    new THREE.Group();

  scene.add(group);

  const geometries:
    THREE.BufferGeometry[] = [];

  const materials:
    THREE.Material[] = [];

  const plantLeaves:
    PlantLeaf[] = [];

  /*
   * --------------------------------
   * SAND
   * --------------------------------
   *
   * Slightly uneven substrate instead
   * of one perfectly flat yellow box.
   */
  const sandGeometry =
    new THREE.PlaneGeometry(
      tankWidth,
      tankDepth,
      32,
      16,
    );

  sandGeometry.rotateX(
    -Math.PI / 2,
  );

  const sandPositions =
    sandGeometry.attributes
      .position as
      THREE.BufferAttribute;

  for (
    let index = 0;
    index <
    sandPositions.count;
    index++
  ) {
    const x =
      sandPositions.getX(
        index,
      );

    const z =
      sandPositions.getZ(
        index,
      );

    const mound =
      Math.sin(
        x * 0.85,
      ) *
      0.035 +
      Math.cos(
        z * 1.8 +
        x * 0.25,
      ) *
      0.025;

    const edgeRise =
      Math.max(
        0,
        (
          Math.abs(x) -
          tankWidth * 0.32
        ) *
        0.018,
      );

    const rearRise =
      THREE.MathUtils.mapLinear(
        z,
        -tankDepth / 2,
        tankDepth / 2,
        0.12,
        -0.03,
      );

    sandPositions.setY(
      index,
      mound +
      edgeRise +
      rearRise,
    );
  }

  sandPositions.needsUpdate =
    true;

  sandGeometry
    .computeVertexNormals();

  const sandMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xa99268,
      roughness: 1,
      metalness: 0,
    });

  geometries.push(
    sandGeometry,
  );

  materials.push(
    sandMaterial,
  );

  const sand =
    new THREE.Mesh(
      sandGeometry,
      sandMaterial,
    );

  sand.position.y =
    -tankHeight / 2 +
    0.22;

  group.add(sand);

  /*
   * Subtle darker substrate below
   * the visible sand.
   */
  const substrateGeometry =
    new THREE.BoxGeometry(
      tankWidth,
      0.28,
      tankDepth,
    );

  const substrateMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x514b3f,
      roughness: 1,
    });

  geometries.push(
    substrateGeometry,
  );

  materials.push(
    substrateMaterial,
  );

  const substrate =
    new THREE.Mesh(
      substrateGeometry,
      substrateMaterial,
    );

  substrate.position.y =
    -tankHeight / 2 +
    0.05;

  group.add(substrate);

  /*
   * --------------------------------
   * ROCKS
   * --------------------------------
   */

  const rockMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x566568,
      roughness: 0.95,
    }),

    new THREE.MeshStandardMaterial({
      color: 0x6c7773,
      roughness: 1,
    }),

    new THREE.MeshStandardMaterial({
      color: 0x465759,
      roughness: 0.92,
    }),
  ];

  materials.push(
    ...rockMaterials,
  );

  const createRock = (
    x: number,
    z: number,
    size: number,
    materialIndex: number,
  ) => {
    const geometry =
      new THREE.DodecahedronGeometry(
        size,
        1,
      );

    geometries.push(
      geometry,
    );

    const rock =
      new THREE.Mesh(
        geometry,
        rockMaterials[
        materialIndex %
        rockMaterials.length
          ],
      );

    rock.position.set(
      x,
      -tankHeight / 2 +
      size * 0.42 +
      0.22,
      z,
    );

    rock.rotation.set(
      Math.random() * 0.35,
      Math.random() *
      Math.PI,
      Math.random() * 0.2,
    );

    rock.scale.set(
      1 +
      Math.random() *
      0.45,

      0.55 +
      Math.random() *
      0.3,

      0.8 +
      Math.random() *
      0.35,
    );

    group.add(rock);
  };

  /*
   * Left rock formation.
   */
  createRock(
    -3.95,
    -2.05,
    0.78,
    0,
  );

  createRock(
    -3.15,
    -1.75,
    0.58,
    1,
  );

  createRock(
    -4.45,
    -1.45,
    0.48,
    2,
  );

  createRock(
    -2.65,
    -2.15,
    0.34,
    0,
  );

  /*
   * Smaller right formation.
   */
  createRock(
    4.05,
    -2.05,
    0.52,
    1,
  );

  createRock(
    4.55,
    -1.55,
    0.34,
    2,
  );

  /*
   * --------------------------------
   * DRIFTWOOD
   * --------------------------------
   */

  const woodMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x65452d,
      roughness: 0.95,
    });

  materials.push(
    woodMaterial,
  );

  const createBranch = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
  ) => {
    const direction =
      new THREE.Vector3()
        .subVectors(
          end,
          start,
        );

    const length =
      direction.length();

    const geometry =
      new THREE.CylinderGeometry(
        radius * 0.7,
        radius,
        length,
        8,
      );

    geometries.push(
      geometry,
    );

    const branch =
      new THREE.Mesh(
        geometry,
        woodMaterial,
      );

    branch.position
      .copy(start)
      .add(end)
      .multiplyScalar(
        0.5,
      );

    branch.quaternion
      .setFromUnitVectors(
        new THREE.Vector3(
          0,
          1,
          0,
        ),
        direction.normalize(),
      );

    group.add(branch);
  };

  const woodBase =
    -tankHeight / 2 +
    0.38;

  createBranch(
    new THREE.Vector3(
      -2.9,
      woodBase,
      -1.75,
    ),

    new THREE.Vector3(
      -0.75,
      woodBase + 0.55,
      -1.95,
    ),

    0.13,
  );

  createBranch(
    new THREE.Vector3(
      -2.15,
      woodBase + 0.28,
      -1.82,
    ),

    new THREE.Vector3(
      -1.45,
      woodBase + 1.15,
      -2.05,
    ),

    0.08,
  );

  createBranch(
    new THREE.Vector3(
      -1.7,
      woodBase + 0.42,
      -1.9,
    ),

    new THREE.Vector3(
      -0.55,
      woodBase + 0.8,
      -2.15,
    ),

    0.065,
  );

  /*
   * --------------------------------
   * PLANTS
   * --------------------------------
   *
   * Two plant styles:
   * - tall ribbon-like background plants
   * - broad Anubias-like foreground plants
   *
   * The center stays open for the drawn fish.
   */

  const tallPlantMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x1f7447,
      roughness: 0.8,
      side: THREE.DoubleSide,
    }),

    new THREE.MeshStandardMaterial({
      color: 0x3f9b5f,
      roughness: 0.82,
      side: THREE.DoubleSide,
    }),

    new THREE.MeshStandardMaterial({
      color: 0x155b3a,
      roughness: 0.88,
      side: THREE.DoubleSide,
    }),
  ];

  const broadPlantMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x367a46,
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),

    new THREE.MeshStandardMaterial({
      color: 0x4a9256,
      roughness: 0.82,
      side: THREE.DoubleSide,
    }),

    new THREE.MeshStandardMaterial({
      color: 0x285f39,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
  ];

  materials.push(
    ...tallPlantMaterials,
    ...broadPlantMaterials,
  );

  const createTallLeaf = (
    baseX: number,
    baseZ: number,
    height: number,
    width: number,
    lean: number,
    materialIndex: number,
  ) => {
    const geometry =
      new THREE.PlaneGeometry(
        width,
        height,
        3,
        10,
      );

    geometries.push(
      geometry,
    );

    const positions =
      geometry.attributes
        .position as
        THREE.BufferAttribute;

    for (
      let index = 0;
      index < positions.count;
      index++
    ) {
      const x =
        positions.getX(
          index,
        );

      const y =
        positions.getY(
          index,
        );

      const normalized =
        THREE.MathUtils.clamp(
          y / height +
          0.5,
          0,
          1,
        );

      const taper =
        1 -
        Math.pow(
          normalized,
          2.2,
        ) *
        0.82;

      positions.setX(
        index,
        x * taper +
        lean *
        Math.pow(
          normalized,
          1.7,
        ),
      );

      positions.setZ(
        index,
        Math.sin(
          normalized *
          Math.PI,
        ) *
        0.11 +
        Math.sin(
          normalized *
          Math.PI *
          2,
        ) *
        0.025,
      );
    }

    positions.needsUpdate =
      true;

    geometry
      .computeVertexNormals();

    const leaf =
      new THREE.Mesh(
        geometry,
        tallPlantMaterials[
        materialIndex %
        tallPlantMaterials.length
          ],
      );


    leaf.position.set(
      baseX,

      -tankHeight / 2 +
      height / 2 +
      0.24,

      baseZ,
    );

    leaf.rotation.y =
      (
        Math.random() -
        0.5
      ) *
      0.9;

    const baseRotationZ =
      (
        Math.random() -
        0.5
      ) *
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
        Math.random() *
        0.026,

      speed:
        0.32 +
        Math.random() *
        0.22,
    });
  };

  const createTallPlantCluster = (
    x: number,
    z: number,
    count: number,
    minHeight: number,
    maxHeight: number,
    spread = 0.7,
  ) => {
    for (
      let index = 0;
      index < count;
      index++
    ) {
      const height =
        minHeight +
        Math.random() *
        (
          maxHeight -
          minHeight
        );

      const width =
        0.075 +
        Math.random() *
        0.095;

      const lean =
        (
          Math.random() -
          0.5
        ) *
        0.72;

      createTallLeaf(
        x +
        (
          Math.random() -
          0.5
        ) *
        spread,

        z +
        (
          Math.random() -
          0.5
        ) *
        spread *
        0.7,

        height,
        width,
        lean,
        index,
      );
    }
  };

  const createBroadLeaf = (
    baseX: number,
    baseZ: number,
    height: number,
    width: number,
    angle: number,
    materialIndex: number,
  ) => {
    const shape =
      new THREE.Shape();

    shape.moveTo(
      0,
      0,
    );

    shape.bezierCurveTo(
      -width * 0.75,
      height * 0.25,

      -width * 0.65,
      height * 0.72,

      0,
      height,
    );

    shape.bezierCurveTo(
      width * 0.65,
      height * 0.72,

      width * 0.75,
      height * 0.25,

      0,
      0,
    );

    const geometry =
      new THREE.ShapeGeometry(
        shape,
        8,
      );

    geometries.push(
      geometry,
    );

    const leaf =
      new THREE.Mesh(
        geometry,
        broadPlantMaterials[
        materialIndex %
        broadPlantMaterials.length
          ],
      );

    leaf.position.set(
      baseX,

      -tankHeight / 2 +
      0.25,

      baseZ,
    );

    leaf.rotation.z =
      angle;

    leaf.rotation.y =
      (
        Math.random() -
        0.5
      ) *
      1.4;

    leaf.rotation.x =
      (
        Math.random() -
        0.5
      ) *
      0.25;

    group.add(leaf);
  };

  const createBroadPlant = (
    x: number,
    z: number,
    scale = 1,
  ) => {
    const leafCount = 6;

    for (
      let index = 0;
      index < leafCount;
      index++
    ) {
      const normalized =
        index /
        (
          leafCount -
          1
        );

      const angle =
        -0.72 +
        normalized *
        1.44 +
        (
          Math.random() -
          0.5
        ) *
        0.16;

      const height =
        (
          0.55 +
          Math.random() *
          0.32
        ) *
        scale;

      const width =
        (
          0.28 +
          Math.random() *
          0.1
        ) *
        scale;

      createBroadLeaf(
        x +
        (
          Math.random() -
          0.5
        ) *
        0.08,

        z +
        (
          Math.random() -
          0.5
        ) *
        0.08,

        height,
        width,
        angle,
        index,
      );
    }
  };

  createTallPlantCluster(
    -4.25,
    -2.35,
    9,
    1.05,
    2.35,
    0.95,
  );

  createTallPlantCluster(
    -3.25,
    -2.45,
    5,
    0.75,
    1.55,
    0.72,
  );

  createTallPlantCluster(
    4.15,
    -2.35,
    10,
    1.1,
    2.45,
    1.0,
  );

  createTallPlantCluster(
    3.05,
    -2.45,
    5,
    0.75,
    1.6,
    0.78,
  );

  createBroadPlant(
    -3.9,
    -1.35,
    0.95,
  );

  createBroadPlant(
    -2.9,
    -1.5,
    0.7,
  );

  createBroadPlant(
    3.85,
    -1.45,
    0.9,
  );

  createBroadPlant(
    4.45,
    -0.85,
    0.7,
  );

  createBroadPlant(
    -1.0,
    -2.15,
    0.55,
  );

  /*
   * --------------------------------
   * SMALL PEBBLES
   * --------------------------------
   */

  const pebbleMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x80796a,
      roughness: 1,
    });

  materials.push(
    pebbleMaterial,
  );

  for (
    let index = 0;
    index < 18;
    index++
  ) {
    const size =
      0.04 +
      Math.random() *
      0.08;

    const geometry =
      new THREE.SphereGeometry(
        size,
        6,
        4,
      );

    geometries.push(
      geometry,
    );

    const pebble =
      new THREE.Mesh(
        geometry,
        pebbleMaterial,
      );

    let x =
      (
        Math.random() -
        0.5
      ) *
      (
        tankWidth -
        0.7
      );

    /*
     * Avoid cluttering the center too
     * heavily.
     */
    if (
      Math.abs(x) < 1.7
    ) {
      x +=
        x < 0
          ? -1.4
          : 1.4;
    }

    pebble.position.set(
      x,

      -tankHeight / 2 +
      0.28,

      (
        Math.random() -
        0.5
      ) *
      (
        tankDepth -
        0.5
      ),
    );

    pebble.scale.set(
      1.5,
      0.55,
      1,
    );

    group.add(pebble);
  }

  const update = (
    elapsed: number,
  ) => {
    for (
      const leaf of
      plantLeaves
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

    /*
     * Some materials/geometries are
     * shared, so dispose each unique
     * resource once.
     */
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