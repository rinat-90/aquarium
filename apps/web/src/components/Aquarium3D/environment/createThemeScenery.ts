import * as THREE from 'three';
import type { DecorationInstance } from '../decorations/createAquariumDecorations';

export type ThemeAsset = 'reef-fan' | 'reef-arch' | 'kelp' | 'seagrass' | 'glow-plant' | 'glow-mushroom';
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

function glowPlant(color: string): Animated {
  const group = new THREE.Group();
  // A small number of shared meshes/materials keeps this suitable for webOS.
  const stemGeometry = new THREE.CylinderGeometry(0.025, 0.045, 1, 5);
  const leafGeometry = new THREE.SphereGeometry(1, 7, 5);
  const stemMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.55) });
  const glowMaterial = new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.8,
  });
  const stalks: Array<{ pivot: THREE.Group; phase: number }> = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.position.x = (i - 1) * 0.27;
    const height = 1.05 + (i % 2) * 0.35;
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.scale.y = height;
    stem.position.y = height * 0.5;
    pivot.add(stem);
    for (let j = 0; j < 4; j++) {
      const leaf = new THREE.Mesh(leafGeometry, glowMaterial);
      const side = j % 2 === 0 ? -1 : 1;
      leaf.position.set(side * 0.15, 0.3 + j * height * 0.19, 0);
      leaf.scale.set(0.23, 0.085, 0.06);
      leaf.rotation.z = side * 0.35;
      pivot.add(leaf);
    }
    const tip = new THREE.Mesh(leafGeometry, glowMaterial);
    tip.position.y = height;
    tip.scale.setScalar(0.11);
    pivot.add(tip);
    group.add(pivot);
    stalks.push({ pivot, phase: i * 1.1 });
  }
  return {
    group,
    update(time) {
      for (const { pivot, phase } of stalks) {
        pivot.rotation.z = Math.sin(time * 0.65 + phase) * 0.06;
      }
    },
  };
}

function glowMushroom(color: string): Animated {
  const group = new THREE.Group();
  // Shared low-poly geometry/materials; emissive caps require no extra lights.
  const stemGeometry = new THREE.CylinderGeometry(0.055, 0.085, 1, 6);
  const capGeometry = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const dotGeometry = new THREE.SphereGeometry(1, 5, 4);
  const stemMaterial = new THREE.MeshLambertMaterial({ color: '#a5a4ca' });
  const capColor = new THREE.Color(color);
  const capMaterial = new THREE.MeshLambertMaterial({
    color: capColor,
    emissive: capColor,
    emissiveIntensity: 0.9,
    side: THREE.DoubleSide,
  });
  const dotMaterial = new THREE.MeshBasicMaterial({ color: '#fff2ff' });
  const mushrooms: Array<{ pivot: THREE.Group; phase: number }> = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.position.x = (i - 1) * 0.3;
    const height = i === 1 ? 0.94 : 0.62 + i * 0.06;
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.scale.y = height;
    stem.position.y = height * 0.5;
    pivot.add(stem);
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = height;
    cap.scale.set(i === 1 ? 0.31 : 0.24, 0.2, i === 1 ? 0.31 : 0.24);
    pivot.add(cap);
    // Tiny luminous spots are attached to the cap, not independent particles.
    for (let j = 0; j < 3; j++) {
      const a = j * Math.PI * 2 / 3 + i * 0.3;
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(Math.cos(a) * 0.11, height + 0.14, Math.sin(a) * 0.11);
      dot.scale.setScalar(0.028);
      pivot.add(dot);
    }
    group.add(pivot);
    mushrooms.push({ pivot, phase: i * 1.7 });
  }
  return {
    group,
    update(time) {
      for (const { pivot, phase } of mushrooms) {
        pivot.rotation.z = Math.sin(time * 0.5 + phase) * 0.035;
      }
    },
  };
}

const factories: Record<ThemeAsset, (color: string) => Animated> = {
  'reef-fan': reefFan, 'reef-arch': reefArch, kelp, seagrass, 'glow-plant': glowPlant, 'glow-mushroom': glowMushroom,
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
          const factory = factories[instance.type];

          if (!factory) {
            console.error('[ThemeScenery] Unknown asset:', instance.type);
            continue;
          }

          const object = factory(color);

          console.log('[ThemeScenery] Created:', {
            id: instance.id,
            type: instance.type,
            color,
            meshes: object.group.children.length,
          });

          item = { object, type: instance.type, color };
          items.set(instance.id, item);
          root.add(object.group);
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
