import { useEffect, useState } from 'react';
import * as THREE from 'three';

import type { FishSpecies } from '../Fish3D/Fish3DPreview';
import { createFish3DModel } from '../Fish3D/createFish3DModel';
import { createAngelfish3DModel } from '../Fish3D/createAngelfish3DModel';
import { createGuppy3DModel } from '../Fish3D/createGuppy3DModel';
import { createFinny3DModel } from '../Fish3D/createFinny3DModel';

type Props = {
  species: FishSpecies;
  bodyColor: string;
  finColor: string;
  paintImage?: string;
  size?: number;
};

// One shared WebGL context for every list thumbnail, rather than a
// renderer + animation loop per fish. Results are static and cached.
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
const THUMBNAIL_SIZE = 160;

function renderThumbnail({ species, bodyColor, finColor, paintImage, size }: Props): string {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }

  const model =
    species === 'finny'
      ? createFinny3DModel()
      : species === 'angelfish'
        ? createAngelfish3DModel()
        : species === 'guppy'
          ? createGuppy3DModel()
          : createFish3DModel();

  try {
    model.setBodyColor(bodyColor);
    model.setFinColor(finColor);
    if (paintImage) model.setPaintImage(paintImage);
    model.group.scale.setScalar(size ?? 1);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5d8ca3, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(4, 6, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ee7ff, 1.5);
    fill.position.set(-4, 1, 4);
    scene.add(fill);
    scene.add(model.group);

    const bounds = new THREE.Box3().setFromObject(model.group);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(0.1, sphere.radius) * (species === 'guppy' ? 1.22 : 1.32);
    const camera = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.1, 200);
    camera.position.set(
      sphere.center.x,
      sphere.center.y,
      sphere.center.z + Math.max(12, sphere.radius * 5),
    );
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();

    renderer.clear();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    model.dispose();
  }
}

export function FishListThumbnail(props: Props) {
  const { species, bodyColor, finColor, paintImage, size } = props;
  const cacheKey = JSON.stringify([species, bodyColor, finColor, paintImage ?? '', size ?? 1]);
  const [image, setImage] = useState<string | null>(() => cache.get(cacheKey) ?? null);

  useEffect(() => {
    const cached = cache.get(cacheKey);
    if (cached) {
      setImage(cached);
      return;
    }

    // Defer rendering until the row has mounted; never run an animation loop.
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const result = renderThumbnail({ species, bodyColor, finColor, paintImage, size });
        cache.set(cacheKey, result);
        setImage(result);
      } catch (error) {
        console.warn('Unable to render fish list thumbnail', error);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [cacheKey, species, bodyColor, finColor, paintImage, size]);

  return image ? (
    <img className="fish-panel__image" src={image} alt="" aria-hidden="true" />
  ) : (
    <span className="fish-panel__thumbnail-placeholder" aria-hidden="true">
      🐟
    </span>
  );
}
