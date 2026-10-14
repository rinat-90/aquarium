import * as THREE from 'three';
import type { DecorationInstance } from '../decorations/createAquariumDecorations';

export type ThemeAsset = 'reef-fan' | 'reef-arch' | 'kelp' | 'seagrass';
export type ThemeSceneryInstance = Omit<DecorationInstance, 'type'> & { type: ThemeAsset };

type Animated = { group: THREE.Group; update?: (time: number) => void };
const mat = (color: string, factor = 1) => new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(factor), side: THREE.DoubleSide });

function reefFan(color: string): Animated {
  const group = new THREE.Group();
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.6, 6), mat(color, 0.75));
  stalk.position.y = 0.28; group.add(stalk);
  const branches = 11;
  for (let i = 0; i < branches; i++) {
    const angle = -Math.PI * 0.46 + i * (Math.PI * 0.92 / (branches - 1));
    const height = 1.1 + 0.2 * Math.cos(angle);
    const tip = new THREE.Vector3(Math.sin(angle) * 0.82, height, 0);
    const start = new THREE.Vector3(0, 0.36, 0);
    const direction = tip.clone().sub(start);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.065, direction.length(), 5), mat(color, 0.85 + i * 0.025));
    branch.position.copy(start).add(tip).multiplyScalar(0.5);
    branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    group.add(branch);
    for (let j = 1; j <= 3; j++) {
      const y = 0.35 + j * 0.18;
      const x = Math.sin(angle) * j * 0.19;
      const spur = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.025, 0.22, 4), mat(color, 1.1));
      spur.position.set(x + (angle < 0 ? -0.055 : 0.055), y, 0);
      spur.rotation.z = angle < 0 ? -0.6 : 0.6;
      group.add(spur);
    }
  }
  return { group };
}

function reefArch(color: string): Animated {
  const group = new THREE.Group();
  const stone = mat(color);
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  // Broad stone arch with an open swim-through in the middle.
  const points: Array<[number, number, number]> = [
    [-0.9, 0.24, 0], [-0.84, 0.58, 0], [-0.66, 0.94, 0], [-0.34, 1.16, 0],
    [0, 1.23, 0], [0.34, 1.16, 0], [0.66, 0.94, 0], [0.84, 0.58, 0], [0.9, 0.24, 0],
  ];
  points.forEach(([x, y, z], i) => {
    const rock = new THREE.Mesh(geometry, stone);
    rock.position.set(x, y, z);
    rock.scale.set(i === 0 || i === 8 ? 0.36 : 0.3, 0.26, 0.31);
    rock.rotation.z = i * 0.39;
    group.add(rock);
  });
  return { group };
}

function kelp(color: string): Animated {
  const group = new THREE.Group();
  const stems: Array<{ pivot: THREE.Group; phase: number }> = [];
  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Group();
    pivot.position.set((i - 2) * 0.2, 0, (i % 2) * 0.08);
    const height = 1.9 + (i % 3) * 0.42;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.04, height, 5), mat(color, 0.65));
    stem.position.y = height / 2; pivot.add(stem);
    for (let j = 0; j < 7; j++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), mat(color, 0.85 + j * 0.035));
      const side = j % 2 ? 1 : -1;
      leaf.position.set(side * 0.16, 0.3 + j * (height - 0.45) / 7, 0);
      leaf.scale.set(0.22, 0.075, 0.035);
      leaf.rotation.z = side * 0.34;
      pivot.add(leaf);
    }
    group.add(pivot); stems.push({ pivot, phase: i * 0.8 });
  }
  return { group, update(time) { stems.forEach(({ pivot, phase }) => { pivot.rotation.z = Math.sin(time * 0.6 + phase) * 0.055; }); } };
}

function seagrass(color: string): Animated {
  const group = new THREE.Group();
  const blades: Array<{ pivot: THREE.Group; phase: number }> = [];
  for (let i = 0; i < 15; i++) {
    const pivot = new THREE.Group();
    const x = (i - 7) * 0.11;
    pivot.position.x = x;
    const h = 0.5 + (i % 5) * 0.12;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.075, h, 4), mat(color, 0.78 + (i % 4) * 0.1));
    leaf.position.y = h / 2; leaf.scale.z = 0.35;
    pivot.add(leaf); group.add(pivot);
    blades.push({ pivot, phase: i * 0.4 });
  }
  return { group, update(time) { blades.forEach(({ pivot, phase }) => { pivot.rotation.z = Math.sin(time * 0.85 + phase) * 0.075; }); } };
}

const factories: Record<ThemeAsset, (color: string) => Animated> = {
  'reef-fan': reefFan, 'reef-arch': reefArch, kelp, seagrass,
};

function dispose(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m));
  });
  geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
}

export function createThemeScenery(scene: THREE.Scene) {
  const root = new THREE.Group(); root.name = 'aquarium-theme-scenery'; scene.add(root);
  const items = new Map<string, { object: Animated; type: ThemeAsset; color: string }>();
  function remove(id: string) {
    const item = items.get(id); if (!item) return;
    root.remove(item.object.group); dispose(item.object.group); items.delete(id);
  }
  return {
    setDecorations(instances: ThemeSceneryInstance[]) {
      const ids = new Set(instances.map((instance) => instance.id));
      for (const id of items.keys()) if (!ids.has(id)) remove(id);
      for (const instance of instances) {
        const color = instance.color ?? '#64bba0';
        let item = items.get(instance.id);
        if (item && (item.type !== instance.type || item.color !== color)) { remove(instance.id); item = undefined; }
        if (!item) {
          item = { object: factories[instance.type](color), type: instance.type, color };
          items.set(instance.id, item); root.add(item.object.group);
        }
        item.object.group.position.set(instance.x, instance.y, 0);
        item.object.group.scale.setScalar(instance.scale);
        item.object.group.rotation.y = instance.rotation ?? 0;
      }
    },
    update(time: number) { items.forEach(({ object }) => object.update?.(time)); },
    destroy() { Array.from(items.keys()).forEach(remove); scene.remove(root); },
  };
}
