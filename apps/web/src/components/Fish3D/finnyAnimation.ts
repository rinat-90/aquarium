import type { Fish3DModel } from './createFish3DModel';
import { animateFinny3DModel } from './createFinny3DModel';

/** Per-instance animation controller: usable in previews, aquarium and TV scenes. */
export function createFinnyAnimationController(fish: Fish3DModel) {
  const baseY = fish.group.position.y;
  const baseZ = fish.group.rotation.z;
  let reactionStart = -Infinity;
  let reactionStrength = 0;
  let lastTime = 0;

  return {
    /** Call on selection or tap. Reactions blend back into the idle swim. */
    celebrate(strength = 1) {
      reactionStart = lastTime;
      reactionStrength = Math.min(Math.max(strength, 0), 1);
    },
    update(seconds: number) {
      lastTime = seconds;
      const elapsed = Math.max(0, seconds - reactionStart);
      const envelope = elapsed < 1.5 ? Math.pow(1 - elapsed / 1.5, 2) * reactionStrength : 0;
      const swimBlend = 1 + envelope * 0.6;

      fish.tail.rotation.y =
        Math.sin(seconds * 3.2) * 0.24 * swimBlend + Math.sin(elapsed * 18) * envelope * 0.13;
      fish.leftFin.rotation.z = -0.3 + Math.sin(seconds * 4.5) * (0.18 + envelope * 0.13);
      fish.rightFin.rotation.z = -0.3 - Math.sin(seconds * 4.5) * (0.18 + envelope * 0.13);
      fish.group.position.y =
        baseY +
        Math.sin(seconds * 1.4) * 0.045 +
        Math.sin(Math.min(elapsed / 0.8, 1) * Math.PI) * envelope * 0.1;
      fish.group.rotation.z =
        baseZ + Math.sin(seconds * 1.6) * 0.025 + Math.sin(elapsed * 15) * envelope * 0.13;

      animateFinny3DModel(fish, seconds);
    },
  };
}
