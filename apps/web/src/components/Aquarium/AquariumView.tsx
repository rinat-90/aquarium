import { useEffect, useRef } from 'react';
import {
  Application,
  Assets,
  Graphics,
  Sprite,
  type Texture,
} from 'pixi.js';

import { Aquarium } from '@aquarium/aquarium-engine';

import { createAquariumBackground } from './createAquariumBackground';

import type { CreatedFish } from '../../App';

type AquariumViewProps = {
  createdFish: CreatedFish[];
};

export function AquariumView({
                               createdFish,
                             }: AquariumViewProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const aquariumRef =
    useRef<Aquarium | null>(null);

  const appRef =
    useRef<Application | null>(null);

  const fishSpritesRef = useRef(
    new Map<string, Sprite>(),
  );

  const foodGraphicsRef = useRef(
    new Map<string, Graphics>(),
  );

  const loadingFishRef = useRef(
    new Set<string>(),
  );

  const createdFishRef =
    useRef(createdFish);

  /**
   * Load a user-created drawing into Pixi.
   */
  const addCreatedFish = async (
    created: CreatedFish,
  ) => {
    const aquarium =
      aquariumRef.current;

    const app =
      appRef.current;

    if (!aquarium || !app) {
      return;
    }

    if (
      fishSpritesRef.current.has(
        created.id,
      )
    ) {
      return;
    }

    if (
      loadingFishRef.current.has(
        created.id,
      )
    ) {
      return;
    }

    loadingFishRef.current.add(
      created.id,
    );

    const fish =
      aquarium.createFish(
        created.id,
      );

    try {
      const texture =
        await Assets.load<Texture>(
          created.image,
        );

      if (
        !appRef.current ||
        !aquariumRef.current
      ) {
        aquarium.removeFish(
          created.id,
        );

        return;
      }

      const sprite =
        new Sprite(texture);

      sprite.anchor.set(0.5);

      const maxWidth = 160;
      const maxHeight = 120;

      const scale = Math.min(
        maxWidth / texture.width,
        maxHeight / texture.height,
      );

      sprite.scale.set(scale);

      sprite.position.set(
        fish.position.x,
        fish.position.y,
      );

      fishSpritesRef.current.set(
        created.id,
        sprite,
      );

      app.stage.addChild(
        sprite,
      );
    } catch (error) {
      aquarium.removeFish(
        created.id,
      );

      console.error(
        'Failed to load drawn fish:',
        error,
      );
    } finally {
      loadingFishRef.current.delete(
        created.id,
      );
    }
  };

  /**
   * Drop food into the aquarium.
   */
  const addFood = (
    x: number,
    y: number,
  ) => {
    const aquarium =
      aquariumRef.current;

    const app =
      appRef.current;

    if (!aquarium || !app) {
      return;
    }

    const id =
      crypto.randomUUID();

    aquarium.addFood({
      id,
      position: {
        x,
        y,
      },
    });

    /**
     * Simple food pellet.
     */
    const pellet =
      new Graphics()
        .circle(0, 0, 7)
        .fill('#7c3f00');

    pellet.position.set(
      x,
      y,
    );

    foodGraphicsRef.current.set(
      id,
      pellet,
    );

    app.stage.addChild(
      pellet,
    );
  };

  /**
   * Keep latest React fish available
   * during Pixi initialization.
   */
  useEffect(() => {
    createdFishRef.current =
      createdFish;
  }, [createdFish]);

  /**
   * Initialize Pixi.
   */
  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const app =
      new Application();

    let cancelled = false;
    let initialized = false;

    const init = async () => {
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

      container.appendChild(
        app.canvas,
      );

      /**
       * Background.
       */
      const background =
        createAquariumBackground(
          app.screen.width,
          app.screen.height,
        );

      app.stage.addChild(
        background.container,
      );

      /**
       * Engine.
       */
      const aquarium =
        new Aquarium({
          width: app.screen.width,
          height: app.screen.height,
        });

      aquariumRef.current =
        aquarium;

      appRef.current =
        app;

      /**
       * Make the stage interactive.
       */
      app.stage.eventMode =
        'static';

      app.stage.hitArea =
        app.screen;

      /**
       * Clicking/tapping the water
       * drops food.
       */
      app.stage.on(
        'pointerdown',
        (event) => {
          const position =
            event.global;

          addFood(
            position.x,
            position.y,
          );
        },
      );

      /**
       * Add any fish that already exist.
       */
      for (
        const created of
        createdFishRef.current
        ) {
        void addCreatedFish(
          created,
        );
      }

      /**
       * Simulation loop.
       */
      app.ticker.add(
        (ticker) => {
          const deltaTime =
            ticker.deltaMS /
            1000;

          aquarium.update(
            deltaTime,
          );

          background.update(
            deltaTime,
          );

          /**
           * Update fish.
           */
          for (
            const fish of
            aquarium.getFish()
            ) {
            const sprite =
              fishSpritesRef.current.get(
                fish.id,
              );

            if (!sprite) {
              continue;
            }

            sprite.position.set(
              fish.position.x,
              fish.position.y,
            );

            const absoluteScaleX =
              Math.abs(
                sprite.scale.x,
              );

            sprite.scale.x =
              fish.direction ===
              'right'
                ? absoluteScaleX
                : -absoluteScaleX;

            sprite.rotation =
              Math.max(
                -0.2,
                Math.min(
                  0.2,
                  fish.velocity.y /
                  500,
                ),
              );
          }

          /**
           * Remove eaten food from Pixi.
           *
           * The engine is the source of truth.
           */

          /**
           * Render sinking food positions.
           */
          for (
            const food of
            aquarium.getFood()
            ) {
            const graphic =
              foodGraphicsRef.current.get(
                food.id,
              );

            if (!graphic) {
              continue;
            }

            graphic.position.set(
              food.position.x,
              food.position.y,
            );
          }

          const existingFood =
            new Set(
              aquarium
                .getFood()
                .map(
                  (food) =>
                    food.id,
                ),
            );

          for (
            const [
              id,
              graphic,
            ] of
            foodGraphicsRef.current
            ) {
            if (
              existingFood.has(
                id,
              )
            ) {
              continue;
            }

            graphic.destroy();

            foodGraphicsRef.current.delete(
              id,
            );
          }
        },
      );
    };

    void init();

    return () => {
      cancelled = true;

      aquariumRef.current =
        null;

      appRef.current =
        null;

      fishSpritesRef.current.clear();
      foodGraphicsRef.current.clear();
      loadingFishRef.current.clear();

      if (initialized) {
        app.destroy(true);
      }
    };
  }, []);

  /**
   * Add new React fish to Pixi.
   */
  useEffect(() => {
    createdFishRef.current =
      createdFish;

    for (
      const created of
      createdFish
      ) {
      void addCreatedFish(
        created,
      );
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