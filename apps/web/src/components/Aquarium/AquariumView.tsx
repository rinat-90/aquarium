
import { useEffect, useRef } from 'react';
import {
  Application,
  Assets,
  Graphics,
  type Texture,
} from 'pixi.js';

import { Aquarium } from '@aquarium/aquarium-engine';
import type { CreatedFish } from '../../App';

import { createAquariumBackground } from './createAquariumBackground';
import {
  createAnimatedFish,
  type AnimatedFish,
} from './fish/AnimatedFish';
import {
  createFishAnimationState,
  updateFishAnimation,
  type FishAnimationState,
} from './fish/FishAnimation';

type AquariumViewProps = {
  createdFish: CreatedFish[];
};

export function AquariumView({
                               createdFish,
                             }: AquariumViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aquariumRef = useRef<Aquarium | null>(null);
  const appRef = useRef<Application | null>(null);

  const animatedFishRef = useRef(
    new Map<string, AnimatedFish>(),
  );

  const fishAnimationRef = useRef(
    new Map<string, FishAnimationState>(),
  );

  const foodGraphicsRef = useRef(
    new Map<string, Graphics>(),
  );

  const loadingFishRef = useRef(
    new Set<string>(),
  );

  const createdFishRef = useRef(createdFish);

  const addCreatedFish = async (
    created: CreatedFish,
  ) => {
    // The PixiJS aquarium only renders drawn fish.
    // 3D models are handled by ThreeAquariumView.
    if (created.type !== 'drawn') {
      return;
    }

    const aquarium = aquariumRef.current;
    const app = appRef.current;

    if (!aquarium || !app) {
      return;
    }

    if (
      animatedFishRef.current.has(created.id) ||
      loadingFishRef.current.has(created.id)
    ) {
      return;
    }

    loadingFishRef.current.add(created.id);

    const fish = aquarium.createFish(
      created.id,
      created.size,
    );

    try {
      const texture = await Assets.load<Texture>(
        created.image,
      );

      // The original aquarium may have been
      // destroyed while the texture was loading.
      if (
        aquariumRef.current !== aquarium ||
        appRef.current !== app
      ) {
        aquarium.removeFish(created.id);
        return;
      }

      if (animatedFishRef.current.has(created.id)) {
        aquarium.removeFish(created.id);
        return;
      }

      const animatedFish = createAnimatedFish(
        texture,
        160,
        120,
      );

      animatedFish.container.position.set(
        fish.position.x,
        fish.position.y,
      );

      animatedFishRef.current.set(
        created.id,
        animatedFish,
      );

      fishAnimationRef.current.set(
        created.id,
        createFishAnimationState(),
      );

      app.stage.addChild(
        animatedFish.container,
      );
    } catch (error) {
      aquarium.removeFish(created.id);

      animatedFishRef.current.delete(
        created.id,
      );

      fishAnimationRef.current.delete(
        created.id,
      );

      console.error(
        'Failed to load drawn fish:',
        error,
      );
    } finally {
      if (aquariumRef.current === aquarium) {
        loadingFishRef.current.delete(
          created.id,
        );
      }
    }
  };

  const addFood = (x: number, y: number) => {
    const aquarium = aquariumRef.current;
    const app = appRef.current;

    if (!aquarium || !app) {
      return;
    }

    const id = crypto.randomUUID();

    aquarium.addFood({
      id,
      position: {
        x,
        y,
        z: 0,
      },
    });

    const pellet = new Graphics()
      .circle(0, 0, 7)
      .fill('#7c3f00');

    pellet.position.set(x, y);

    foodGraphicsRef.current.set(
      id,
      pellet,
    );

    app.stage.addChild(pellet);
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const app = new Application();

    let cancelled = false;
    let initialized = false;

    const init = async () => {
      try {
        await app.init({
          resizeTo: container,
          background: '#58c8e8',
          antialias: true,
        });

        initialized = true;

        if (cancelled) {
          app.destroy(true);
          return;
        }

        container.appendChild(app.canvas);

        const background = createAquariumBackground(
          app.screen.width,
          app.screen.height,
        );

        app.stage.addChild(
          background.container,
        );

        const aquarium = new Aquarium({
          width: app.screen.width,
          height: app.screen.height,
          depth: 10,
        });

        aquariumRef.current = aquarium;
        appRef.current = app;

        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;

        app.stage.on('pointerdown', (event) => {
          const position = event.global;

          addFood(
            position.x,
            position.y,
          );
        });

        for (const created of createdFishRef.current) {
          void addCreatedFish(created);
        }

        app.ticker.add((ticker) => {
          const deltaTime = Math.min(
            ticker.deltaMS / 1000,
            0.05,
          );

          aquarium.update(deltaTime);
          background.update(deltaTime);

          // Update and animate fish.
          for (const fish of aquarium.getFish()) {
            const animatedFish =
              animatedFishRef.current.get(fish.id);

            const animationState =
              fishAnimationRef.current.get(fish.id);

            if (!animatedFish || !animationState) {
              continue;
            }

            const velocityMagnitude = Math.sqrt(
              fish.velocity.x * fish.velocity.x +
              fish.velocity.y * fish.velocity.y,
            );

            const speedRatio =
              fish.speed > 0
                ? velocityMagnitude / fish.speed
                : 1;

            const animation = updateFishAnimation(
              animationState,
              deltaTime,
              speedRatio,
            );

            animatedFish.container.position.set(
              fish.position.x,
              fish.position.y + animation.yOffset,
            );

            const movementRotation = Math.max(
              -0.2,
              Math.min(
                0.2,
                fish.velocity.y / 500,
              ),
            );

            animatedFish.container.rotation =
              movementRotation +
              animation.rotation;

            animatedFish.update(
              animationState.elapsed,
              animation.swimIntensity,
              fish.direction,
            );
          }

          // Update sinking food positions.
          const existingFood = new Set<string>();

          for (const food of aquarium.getFood()) {
            existingFood.add(food.id);

            const graphic =
              foodGraphicsRef.current.get(food.id);

            if (!graphic) {
              continue;
            }

            graphic.position.set(
              food.position.x,
              food.position.y,
            );
          }

          // Remove eaten food.
          for (const [
            id,
            graphic,
          ] of foodGraphicsRef.current) {
            if (existingFood.has(id)) {
              continue;
            }

            graphic.destroy();

            foodGraphicsRef.current.delete(id);
          }
        });
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Failed to initialize 2D aquarium:',
            error,
          );
        }
      }
    };

    void init();

    return () => {
      cancelled = true;

      aquariumRef.current = null;
      appRef.current = null;

      for (const animatedFish of animatedFishRef.current.values()) {
        animatedFish.destroy();
      }

      animatedFishRef.current.clear();
      fishAnimationRef.current.clear();
      foodGraphicsRef.current.clear();
      loadingFishRef.current.clear();

      if (initialized) {
        app.destroy(true);
      }
    };
  }, []);

  useEffect(() => {
    createdFishRef.current = createdFish;

    for (const created of createdFish) {
      void addCreatedFish(created);
    }
  }, [createdFish]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
      }}
    />
  );
}
