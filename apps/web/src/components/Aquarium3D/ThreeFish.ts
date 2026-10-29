import * as THREE from 'three';
import { detectFishOrientation } from '../../lib/image-processing/detectFishOrientation';

export type ThreeFish = {
  group: THREE.Group;
  update: (
    elapsed: number,
    intensity: number,
    direction: 'left' | 'right',
    depthVelocity?: number,
    nibbleProgress?: number,
  ) => void;
  destroy: () => void;
};

// One subdivided mesh: the tail animates without additional draw calls.
const BODY_SEGMENTS = 24;

export async function createThreeFish(
  image: string,
  maxWidth = 1.3,
  headDirection?: 'left' | 'right' | null,
): Promise<ThreeFish> {
  const texture = await new THREE.TextureLoader().loadAsync(image);

  let orientation: 'left' | 'right' = headDirection ?? 'right';
  if (!headDirection) {
    try {
      orientation = await detectFishOrientation(image);
    } catch (error) {
      console.warn('Fish orientation detection failed:', error);
    }
  }

  texture.colorSpace = THREE.SRGBColorSpace;
  const source = texture.image as { width: number; height: number };
  const aspect = source.width / source.height;
  const width = maxWidth;
  const height = width / aspect;

  const group = new THREE.Group();
  const directionGroup = new THREE.Group();
  const body = new THREE.Group();
  group.add(directionGroup);
  directionGroup.add(body);

  const geometry = new THREE.PlaneGeometry(width, height, BODY_SEGMENTS, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  body.add(mesh);

  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const originalPositions = new Float32Array(positions.array as Float32Array);
  const vertexCount = positions.count;
  const tailWeights = new Float32Array(vertexCount);
  const tailDistances = new Float32Array(vertexCount);

  for (let i = 0; i < vertexCount; i += 1) {
    const normalizedX = THREE.MathUtils.clamp((originalPositions[i * 3] + width / 2) / width, 0, 1);
    // The tail is opposite the head in the unflipped source texture.
    const tailAmount = orientation === 'right' ? 1 - normalizedX : normalizedX;
    tailDistances[i] = tailAmount;
    tailWeights[i] = Math.pow(tailAmount, 2.5);
  }

  let lastElapsed: number | undefined;
  let swimPhase = Math.random() * Math.PI * 2;
  const glideOffset = Math.random() * Math.PI * 2;
  const swimRate = 0.88 + Math.random() * 0.24;
  const glideRate = 0.42 + Math.random() * 0.24;
  const bobOffset = Math.random() * Math.PI * 2;
  const swayOffset = Math.random() * Math.PI * 2;
  let smoothedEffort = 0.65;
  let smoothedDepthTurn = 0;

  const update: ThreeFish['update'] = (
    elapsed,
    intensity,
    direction,
    depthVelocity = 0,
    nibbleProgress = 0,
  ) => {
    const clampedIntensity = THREE.MathUtils.clamp(intensity, 0.35, 1.8);
    // This clock is supplied by the aquarium view and already scales with
    // swimming speed. Smooth effort in that same time domain to avoid pops.
    const delta =
      lastElapsed === undefined ? 0 : THREE.MathUtils.clamp(elapsed - lastElapsed, 0, 0.1);
    lastElapsed = elapsed;

    const glideFactor = 0.5 + 0.5 * Math.sin(elapsed * glideRate + glideOffset);
    const targetEffort = clampedIntensity * THREE.MathUtils.lerp(0.38, 1, glideFactor);
    const effortBlend = 1 - Math.exp(-3.5 * delta);
    smoothedEffort += (targetEffort - smoothedEffort) * effortBlend;
    const effectiveIntensity = smoothedEffort;

    swimPhase += delta * swimRate * (1.65 + effectiveIntensity * 1.25);
    if (swimPhase > Math.PI * 2) swimPhase %= Math.PI * 2;

    // A PlaneGeometry displays its texture with the same left/right orientation
    // as the original image. Only mirror it when travel and head differ.
    // Switch the sign directly: interpolating through zero squashes the fish
    // into a line and makes it appear to swim edge-on during turns.
    directionGroup.scale.x = direction === orientation ? 1 : -1;

    // Keep the flat drawing readable while moving through depth.
    const depthTurn = THREE.MathUtils.clamp(depthVelocity * 0.16, -0.16, 0.16);
    smoothedDepthTurn += (depthTurn - smoothedDepthTurn) * (1 - Math.exp(-4 * delta));
    body.rotation.y = smoothedDepthTurn;

    const nibbleEnvelope = Math.sin(Math.PI * THREE.MathUtils.clamp(nibbleProgress, 0, 1));
    const nibble = Math.sin(elapsed * 12) * nibbleEnvelope * 0.09;
    // The head stays mostly stable. These small motions are intentionally
    // independent of the tail phase so the whole fish doesn't wag as a unit.
    const gentleSway = Math.sin(elapsed * 0.37 + swayOffset) * 0.012;
    body.rotation.z = nibble + gentleSway;
    body.position.x = -Math.abs(nibble) * 0.12;
    body.position.y = Math.sin(elapsed * 0.48 + bobOffset) * 0.014;

    for (let i = 0; i < vertexCount; i += 1) {
      const offset = i * 3;
      const wave = Math.sin(swimPhase - tailDistances[i] * 3.5);
      const bend = tailWeights[i] * effectiveIntensity;
      const lateral = wave * bend;
      positions.setXYZ(
        i,
        originalPositions[offset],
        originalPositions[offset + 1] + lateral * 0.035,
        originalPositions[offset + 2] + lateral * 0.16,
      );
    }
    positions.needsUpdate = true;
    geometry.computeBoundingSphere();
  };

  const destroy = () => {
    geometry.dispose();
    material.dispose();
    texture.dispose();
    group.clear();
  };

  return { group, update, destroy };
}
