import {
  Container,
  Rectangle,
  Sprite,
  Texture,
} from 'pixi.js';

export type AnimatedFish = {
  container: Container;

  update: (
    elapsed: number,
    intensity: number,
    direction: 'left' | 'right',
  ) => void;

  destroy: () => void;
};

type FishSegment = {
  sprite: Sprite;
  normalizedX: number;
};

const SEGMENT_COUNT = 12;

export function createAnimatedFish(
  sourceTexture: Texture,
  maxWidth = 160,
  maxHeight = 120,
): AnimatedFish {
  const container =
    new Container();

  const textureWidth =
    sourceTexture.width;

  const textureHeight =
    sourceTexture.height;

  const scale =
    Math.min(
      maxWidth / textureWidth,
      maxHeight / textureHeight,
    );

  const renderedWidth =
    textureWidth * scale;

  const segmentWidth =
    textureWidth /
    SEGMENT_COUNT;

  const segments: FishSegment[] =
    [];

  for (
    let index = 0;
    index < SEGMENT_COUNT;
    index++
  ) {
    const sourceX =
      index * segmentWidth;

    const width =
      index ===
      SEGMENT_COUNT - 1
        ? textureWidth -
        sourceX
        : segmentWidth;

    const frame =
      new Rectangle(
        sourceX,
        0,
        width,
        textureHeight,
      );

    const texture =
      new Texture({
        source:
        sourceTexture.source,

        frame,
      });

    const sprite =
      new Sprite(texture);

    sprite.anchor.set(
      0.5,
      0.5,
    );

    const normalizedX =
      index /
      (SEGMENT_COUNT - 1);

    const localX =
      -renderedWidth / 2 +
      (
        sourceX +
        width / 2
      ) *
      scale;

    sprite.position.set(
      localX,
      0,
    );

    sprite.scale.set(
      scale,
    );

    container.addChild(
      sprite,
    );

    segments.push({
      sprite,
      normalizedX,
    });
  }

  const update = (
    elapsed: number,
    intensity: number,
    direction:
      | 'left'
      | 'right',
  ) => {
    const clampedIntensity =
      Math.max(
        0.35,
        Math.min(
          intensity,
          1.8,
        ),
      );

    for (
      const segment of
      segments
      ) {
      /**
       * Our drawings are assumed to
       * face right initially.
       *
       * Left side of the texture is
       * treated as the tail.
       */
      const tailAmount =
        1 -
        segment.normalizedX;

      /**
       * Keep the head relatively stable
       * while allowing the tail to move.
       */
      const amplitude =
        2 +
        tailAmount *
        9 *
        clampedIntensity;

      /**
       * Offset the phase along the body
       * to create a travelling wave.
       */
      const phase =
        elapsed -
        tailAmount * 2.4;

      const wave =
        Math.sin(
          phase,
        );

      segment.sprite.y =
        wave *
        amplitude;

      segment.sprite.rotation =
        wave *
        0.03 *
        tailAmount *
        clampedIntensity;
    }

    /**
     * Flip the complete fish rather
     * than changing which side of the
     * drawing is considered the tail.
     */
    container.scale.x =
      direction === 'right'
        ? 1
        : -1;
  };

  const destroy = () => {
    for (
      const segment of
      segments
      ) {
      /**
       * Destroy the sliced texture,
       * but NOT the shared underlying
       * source texture.
       */
      segment.sprite.texture.destroy(
        false,
      );
    }

    container.destroy({
      children: true,
    });
  };

  return {
    container,
    update,
    destroy,
  };
}