import * as THREE from 'three';

export type DecorationType = 'rocks' | 'seaweed' | 'coral';

export type DecorationInstance = {
  id: string;
  type: DecorationType;
  x: number;
  y: number;
  scale: number;
  rotation?: number;
  color?: string;
};

type DecorationObject = {
  group: THREE.Group;
  update?: (elapsed: number) => void;
};

const DEFAULT_COLORS: Record<DecorationType, string> = {
  rocks: '#739fc8',
  seaweed: '#43ca78',
  coral: '#ff83a9',
};

function material(color: THREE.ColorRepresentation) {
  return new THREE.MeshLambertMaterial({ color });
}

function tint(color: string, multiplier: number) {
  return new THREE.Color(color).multiplyScalar(multiplier);
}

/**
 * Smooth rounded boulders with different silhouettes.
 */
function createRocks(color: string): DecorationObject {
  const group = new THREE.Group();

  const geometry = new THREE.SphereGeometry(1, 20, 14);

  const colors = [tint(color, 0.82), tint(color, 1.08), tint(color, 0.95), tint(color, 1.22)];

  const rocks = [
    {
      position: [-0.42, 0.23, 0.04],
      scale: [0.4, 0.29, 0.34],
      rotation: 0.2,
    },
    {
      position: [0.02, 0.33, -0.12],
      scale: [0.49, 0.39, 0.37],
      rotation: -0.12,
    },
    {
      position: [0.47, 0.2, 0.08],
      scale: [0.36, 0.26, 0.3],
      rotation: 0.14,
    },
    {
      position: [0.15, 0.15, 0.28],
      scale: [0.3, 0.19, 0.25],
      rotation: 0.08,
    },
  ];

  rocks.forEach((rock, index) => {
    const mesh = new THREE.Mesh(geometry, material(colors[index]));

    mesh.position.fromArray(rock.position);
    mesh.scale.fromArray(rock.scale);
    mesh.rotation.z = rock.rotation;

    group.add(mesh);
  });

  return { group };
}

/**
 * A curved, thick 3D leaf with a rounded tip.
 * Geometry is created once, not animated per frame.
 */
function createLeafGeometry(height: number, width: number, curve: number): THREE.BufferGeometry {
  const segments = 12;
  const radialSegments = 7;

  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    const y = t * height;

    const centerX =
      Math.sin(t * Math.PI * 0.85) * curve + Math.sin(t * Math.PI * 1.8) * curve * 0.13;

    // Wide middle, rounded narrowing toward the tip.
    const radius = width * (0.18 + 0.82 * Math.pow(Math.sin(Math.PI * t), 0.7));

    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;

      vertices.push(centerX + Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.28);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;

      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * A cluster of thick, curved leaves.
 * Each leaf sways around its base.
 */
function createSeaweed(color: string): DecorationObject {
  const group = new THREE.Group();

  const leaves: Array<{
    pivot: THREE.Group;
    phase: number;
    amplitude: number;
  }> = [];

  const leafDefinitions = [
    {
      x: -0.32,
      z: -0.04,
      height: 1.12,
      width: 0.16,
      curve: -0.26,
      phase: 0.1,
    },
    {
      x: -0.13,
      z: 0.06,
      height: 1.58,
      width: 0.18,
      curve: -0.18,
      phase: 0.7,
    },
    {
      x: 0.08,
      z: -0.1,
      height: 1.38,
      width: 0.19,
      curve: 0.22,
      phase: 1.4,
    },
    {
      x: 0.3,
      z: 0.03,
      height: 1.04,
      width: 0.15,
      curve: 0.28,
      phase: 2.0,
    },
    {
      x: 0.02,
      z: 0.18,
      height: 0.83,
      width: 0.15,
      curve: -0.13,
      phase: 2.8,
    },
  ];

  const sharedMaterial = [
    material(tint(color, 0.84)),
    material(tint(color, 1.1)),
    material(tint(color, 0.96)),
  ];

  leafDefinitions.forEach((leaf, index) => {
    const pivot = new THREE.Group();

    pivot.position.set(leaf.x, 0, leaf.z);

    const mesh = new THREE.Mesh(
      createLeafGeometry(leaf.height, leaf.width, leaf.curve),
      sharedMaterial[index % sharedMaterial.length],
    );

    mesh.rotation.y = (index - 2) * 0.12;

    pivot.add(mesh);
    group.add(pivot);

    leaves.push({
      pivot,
      phase: leaf.phase,
      amplitude: 0.055 + index * 0.004,
    });
  });

  return {
    group,

    update(elapsed) {
      for (const leaf of leaves) {
        leaf.pivot.rotation.z = Math.sin(elapsed * 0.65 + leaf.phase) * leaf.amplitude;
      }
    },
  };
}

/**
 * Rounded branching coral.
 */
function createCoral(color: string): DecorationObject {
  const group = new THREE.Group();

  const bodyMaterial = material(color);
  const tipMaterial = material(tint(color, 1.2));

  const sphereGeometry = new THREE.SphereGeometry(1, 12, 10);

  const branches: Array<{
    start: [number, number, number];
    end: [number, number, number];
    radius: number;
  }> = [
    {
      start: [0, 0.05, 0],
      end: [0, 0.55, 0],
      radius: 0.17,
    },
    {
      start: [0, 0.35, 0],
      end: [-0.31, 0.74, 0.04],
      radius: 0.12,
    },
    {
      start: [0, 0.37, 0],
      end: [0.34, 0.77, 0],
      radius: 0.13,
    },
    {
      start: [-0.23, 0.62, 0.04],
      end: [-0.4, 0.99, 0.08],
      radius: 0.09,
    },
    {
      start: [0.26, 0.65, 0],
      end: [0.43, 1.04, 0.04],
      radius: 0.09,
    },
    {
      start: [0.08, 0.42, 0],
      end: [0.1, 0.94, 0.18],
      radius: 0.1,
    },
  ];

  const up = new THREE.Vector3(0, 1, 0);

  branches.forEach((branch, index) => {
    const start = new THREE.Vector3(...branch.start);
    const end = new THREE.Vector3(...branch.end);

    const direction = new THREE.Vector3().subVectors(end, start);

    const length = direction.length();

    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(branch.radius * 0.83, branch.radius, length, 12),
      bodyMaterial,
    );

    cylinder.position.copy(start).add(end).multiplyScalar(0.5);

    cylinder.quaternion.setFromUnitVectors(up, direction.normalize());

    group.add(cylinder);

    const tip = new THREE.Mesh(sphereGeometry, index % 2 === 0 ? tipMaterial : bodyMaterial);

    tip.position.copy(end);
    tip.scale.setScalar(branch.radius * 1.05);

    group.add(tip);
  });

  const base = new THREE.Mesh(sphereGeometry, bodyMaterial);

  base.position.y = 0.12;
  base.scale.set(0.25, 0.18, 0.22);

  group.add(base);

  return { group };
}

const factories: Record<DecorationType, (color: string) => DecorationObject> = {
  rocks: createRocks,
  seaweed: createSeaweed,
  coral: createCoral,
};

function disposeObject(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    geometries.add(child.geometry);

    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];

    meshMaterials.forEach((item) => materials.add(item));
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((item) => item.dispose());
}

export function createAquariumDecorations(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = 'aquarium-decorations';
  scene.add(root);

  type ManagedDecoration = {
    object: DecorationObject;
    type: DecorationType;
    color: string;
  };

  const objects = new Map<string, ManagedDecoration>();
  let selectedId: string | null = null;
  let draggingId: string | null = null;

  function updateHighlight(id: string) {
    const managed = objects.get(id);
    if (!managed) return;

    const selected = selectedId === id;
    const dragging = draggingId === id;

    managed.object.group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      for (const item of materials) {
        if (!(item instanceof THREE.MeshLambertMaterial)) continue;
        item.emissive.set(selected ? 0x5ca9ff : 0x000000);
        item.emissiveIntensity = dragging ? 0.42 : selected ? 0.22 : 0;
      }
    });
  }

  function removeDecoration(id: string) {
    const managed = objects.get(id);
    if (!managed) return;

    root.remove(managed.object.group);
    disposeObject(managed.object.group);
    objects.delete(id);
    if (selectedId === id) selectedId = null;
    if (draggingId === id) draggingId = null;
  }

  function setDecorations(instances: DecorationInstance[]) {
    const incomingIds = new Set(instances.map((item) => item.id));

    // Remove objects that no longer exist.
    for (const id of objects.keys()) {
      if (!incomingIds.has(id)) {
        removeDecoration(id);
      }
    }

    for (const instance of instances) {
      const color = instance.color ?? DEFAULT_COLORS[instance.type];

      let managed = objects.get(instance.id);

      // Recreate only when the asset or color changes.
      if (managed && (managed.type !== instance.type || managed.color !== color)) {
        removeDecoration(instance.id);
        managed = undefined;
      }

      if (!managed) {
        const object = factories[instance.type](color);

        managed = {
          object,
          type: instance.type,
          color,
        };

        objects.set(instance.id, managed);
        root.add(object.group);
        updateHighlight(instance.id);
      }

      // Position, scale and rotation are cheap to update.
      const group = managed.object.group;

      group.position.set(instance.x, instance.y, 0);
      group.scale.setScalar(instance.scale);
      group.rotation.y = instance.rotation ?? 0;
    }
  }

  return {
    setDecorations,

    setSelectedDecoration(id: string | null) {
      const previousId = selectedId;
      selectedId = id && objects.has(id) ? id : null;
      if (previousId) updateHighlight(previousId);
      if (selectedId) updateHighlight(selectedId);
    },

    setDraggingDecoration(id: string | null) {
      const previousId = draggingId;
      draggingId = id && objects.has(id) ? id : null;
      if (previousId) updateHighlight(previousId);
      if (draggingId) updateHighlight(draggingId);
    },

    getDecorationAtPoint(raycaster: THREE.Raycaster): string | null {
      const meshes: THREE.Object3D[] = [];

      for (const managed of objects.values()) {
        meshes.push(managed.object.group);
      }

      const intersections = raycaster.intersectObjects(meshes, true);

      if (intersections.length === 0) {
        return null;
      }

      const hit = intersections[0].object;

      for (const [id, managed] of objects) {
        let current: THREE.Object3D | null = hit;

        while (current) {
          if (current === managed.object.group) {
            return id;
          }

          current = current.parent;
        }
      }

      return null;
    },

    moveDecoration(id: string, x: number, y: number) {
      const managed = objects.get(id);
      if (!managed) return;

      managed.object.group.position.set(x, y, 0);
    },

    update(elapsed: number) {
      for (const managed of objects.values()) {
        managed.object.update?.(elapsed);
      }
    },

    destroy() {
      for (const id of Array.from(objects.keys())) {
        removeDecoration(id);
      }

      scene.remove(root);
    },
  };
}
