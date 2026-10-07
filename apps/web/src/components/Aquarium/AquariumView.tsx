import { useEffect, useRef } from 'react';
import {
  Application,
  Assets,
  Graphics,
  Sprite,
  type Texture,
} from 'pixi.js';

import { Aquarium } from '@aquarium/aquarium-engine';

import type { CreatedFish } from '../../App';

type AquariumViewProps = {
  createdFish: CreatedFish[];
};

export function AquariumView({
                               createdFish,
                             }: AquariumViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const aquariumRef = useRef<Aquarium | null>(null);
  const appRef = useRef<Application | null>(null);

  const fishSpritesRef = useRef(
    new Map<string, Sprite>(),
  );

  const loadingFishRef = useRef(
    new Set<string>(),
  );

  const createdFishRef = useRef(createdFish);

  const addCreatedFish = async (
    created: CreatedFish,
  ) => {
    const aquarium = aquariumRef.current;
    const app = appRef.current;

    if (!aquarium || !app) {
      return;
    }

    // Already rendered.
    if (
      fishSpritesRef.current.has(created.id)
    ) {
      return;
    }

    // Already being loaded.
    if (
      loadingFishRef.current.has(created.id)
    ) {
      return;
    }

    loadingFishRef.current.add(created.id);

    const fish = aquarium.createFish(
      created.id,
    );

    try {
      const texture =
        await Assets.load<Texture>(
          created.image,
        );

      // The component could have unmounted while
      // the texture was loading.
      if (
        !appRef.current ||
        !aquariumRef.current
      ) {
        aquarium.removeFish(created.id);
        return;
      }

      const sprite = new Sprite(texture);

      sprite.anchor.set(0.5);

      // Preserve the drawing aspect ratio.
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

      app.stage.addChild(sprite);

      console.log(
        'Added drawn fish:',
        created.id,
        texture.width,
        texture.height,
      );
    } catch (error) {
      aquarium.removeFish(created.id);

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
   * Keep the latest React state available to
   * the Pixi initialization effect.
   */
  useEffect(() => {
    createdFishRef.current = createdFish;
  }, [createdFish]);

  /**
   * Initialize Pixi and the aquarium engine.
   */
  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const app = new Application();

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

      const aquarium = new Aquarium({
        width: app.screen.width,
        height: app.screen.height,
      });

      aquariumRef.current = aquarium;
      appRef.current = app;

      const fishGraphics =
        new Map<string, Graphics>();

      /**
       * Temporary placeholder fish.
       *
       * We'll remove these once user-created
       * fish are working reliably.
       */
      for (let i = 0; i < 10; i++) {
        const fish =
          aquarium.createFish(
            `placeholder-fish-${i}`,
          );

        const color = Math.floor(
          Math.random() * 0xffffff,
        );

        const graphic = new Graphics()
          .ellipse(0, 0, 35, 20)
          .fill(color)
          .poly([
            -30, 0,
            -55, -20,
            -55, 20,
          ])
          .fill(color);

        graphic.position.set(
          fish.position.x,
          fish.position.y,
        );

        fishGraphics.set(
          fish.id,
          graphic,
        );

        app.stage.addChild(
          graphic,
        );
      }

      /**
       * A fish could have been created while
       * Pixi was still initializing.
       */
      for (
        const created of
        createdFishRef.current
        ) {
        void addCreatedFish(
          created,
        );
      }

      app.ticker.add(
        (ticker) => {
          const deltaTime =
            ticker.deltaMS / 1000;

          aquarium.update(
            deltaTime,
          );

          for (
            const fish of
            aquarium.getFish()
            ) {
            /**
             * Placeholder fish.
             */
            const graphic =
              fishGraphics.get(
                fish.id,
              );

            if (graphic) {
              graphic.position.set(
                fish.position.x,
                fish.position.y,
              );

              graphic.scale.x =
                fish.direction ===
                'right'
                  ? 1
                  : -1;

              graphic.rotation =
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
             * User-created fish.
             */
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
        },
      );
    };

    void init();

    return () => {
      cancelled = true;

      aquariumRef.current = null;
      appRef.current = null;

      fishSpritesRef.current.clear();
      loadingFishRef.current.clear();

      if (initialized) {
        app.destroy(true);
      }
    };
  }, []);

  /**
   * React fish state changed.
   *
   * Add anything Pixi doesn't already know
   * about.
   */
  useEffect(() => {
    createdFishRef.current =
      createdFish;

    for (
      const created of createdFish
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