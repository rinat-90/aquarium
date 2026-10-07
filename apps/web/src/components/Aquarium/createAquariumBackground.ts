import {
  Container,
  Graphics,
} from 'pixi.js';

export type AquariumBackground = {
  container: Container;
  update: (
    deltaTime: number,
  ) => void;
};

type Bubble = {
  graphic: Graphics;
  speed: number;
  drift: number;
  phase: number;
};

export function createAquariumBackground(
  width: number,
  height: number,
): AquariumBackground {
  const container =
    new Container();

  /**
   * Water
   */
  const water = new Graphics()
    .rect(
      0,
      0,
      width,
      height,
    )
    .fill('#58c8e8');

  container.addChild(water);

  /**
   * Soft light rays coming from
   * the surface.
   */
  const lightRays =
    new Container();

  for (
    let i = 0;
    i < 5;
    i++
  ) {
    const x =
      width *
      (0.1 + i * 0.2);

    const ray =
      new Graphics()
        .poly([
          x - 25,
          0,

          x + 35,
          0,

          x + 130,
          height * 0.7,

          x + 40,
          height * 0.7,
        ])
        .fill({
          color: '#ffffff',
          alpha: 0.06,
        });

    lightRays.addChild(ray);
  }

  container.addChild(
    lightRays,
  );

  /**
   * Sand.
   */
  const sandHeight = 90;

  const sand =
    new Graphics()
      .rect(
        0,
        height - sandHeight,
        width,
        sandHeight,
      )
      .fill('#e8c982');

  container.addChild(sand);

  /**
   * Small sand dots / pebbles.
   */
  const pebbles =
    new Graphics();

  for (
    let i = 0;
    i < 80;
    i++
  ) {
    const x =
      Math.random() *
      width;

    const y =
      height -
      Math.random() *
      (sandHeight - 10);

    const radius =
      1 +
      Math.random() * 3;

    pebbles
      .circle(
        x,
        y,
        radius,
      )
      .fill({
        color:
          Math.random() >
          0.5
            ? '#c6a766'
            : '#f0d99d',

        alpha: 0.8,
      });
  }

  container.addChild(
    pebbles,
  );

  /**
   * Rocks.
   */
  const rocks =
    new Container();

  const rock1 =
    new Graphics()
      .ellipse(
        110,
        height - 65,
        65,
        35,
      )
      .fill('#64748b');

  const rock2 =
    new Graphics()
      .ellipse(
        175,
        height - 50,
        45,
        25,
      )
      .fill('#475569');

  const rock3 =
    new Graphics()
      .ellipse(
        width - 130,
        height - 55,
        55,
        28,
      )
      .fill('#64748b');

  rocks.addChild(
    rock1,
    rock2,
    rock3,
  );

  container.addChild(
    rocks,
  );

  /**
   * Plants.
   */
  const plants =
    new Container();

  const plantItems: {
    graphic: Graphics;
    baseX: number;
    phase: number;
  }[] = [];

  const createPlant = (
    x: number,
    plantHeight: number,
  ) => {
    const plant =
      new Graphics();

    plant
      .moveTo(
        0,
        0,
      )
      .bezierCurveTo(
        -25,
        -plantHeight * 0.35,
        30,
        -plantHeight * 0.7,
        0,
        -plantHeight,
      )
      .stroke({
        width: 10,
        color: '#15803d',
      });

    plant.position.set(
      x,
      height -
      sandHeight +
      25,
    );

    plant.pivot.set(
      0,
      0,
    );

    plants.addChild(
      plant,
    );

    plantItems.push({
      graphic: plant,
      baseX: x,
      phase:
        Math.random() *
        Math.PI *
        2,
    });
  };

  createPlant(
    width * 0.75,
    170,
  );

  createPlant(
    width * 0.79,
    220,
  );

  createPlant(
    width * 0.83,
    150,
  );

  createPlant(
    width * 0.87,
    200,
  );

  createPlant(
    width * 0.91,
    130,
  );

  createPlant(
    width * 0.08,
    130,
  );

  createPlant(
    width * 0.11,
    180,
  );

  container.addChild(
    plants,
  );

  /**
   * Bubbles.
   */
  const bubbleContainer =
    new Container();

  const bubbles: Bubble[] =
    [];

  const createBubble = (
    initial = false,
  ) => {
    const radius =
      3 +
      Math.random() * 6;

    const graphic =
      new Graphics()
        .circle(
          0,
          0,
          radius,
        )
        .stroke({
          width: 2,
          color: '#ffffff',
          alpha: 0.55,
        });

    graphic.position.set(
      Math.random() *
      width,

      initial
        ? Math.random() *
        height
        : height +
        Math.random() *
        100,
    );

    bubbleContainer.addChild(
      graphic,
    );

    bubbles.push({
      graphic,

      speed:
        20 +
        Math.random() *
        35,

      drift:
        8 +
        Math.random() *
        15,

      phase:
        Math.random() *
        Math.PI *
        2,
    });
  };

  for (
    let i = 0;
    i < 22;
    i++
  ) {
    createBubble(true);
  }

  container.addChild(
    bubbleContainer,
  );

  /**
   * Animation state.
   */
  let elapsed = 0;

  const update = (
    deltaTime: number,
  ) => {
    elapsed += deltaTime;

    /**
     * Very subtle light movement.
     */
    lightRays.alpha =
      0.85 +
      Math.sin(
        elapsed * 0.5,
      ) *
      0.1;

    /**
     * Plants gently sway.
     */
    for (
      const plant of
      plantItems
      ) {
      plant.graphic.rotation =
        Math.sin(
          elapsed * 0.8 +
          plant.phase,
        ) * 0.04;
    }

    /**
     * Bubbles rise and drift.
     */
    for (
      const bubble of
      bubbles
      ) {
      bubble.graphic.y -=
        bubble.speed *
        deltaTime;

      bubble.graphic.x +=
        Math.sin(
          elapsed +
          bubble.phase,
        ) *
        bubble.drift *
        deltaTime;

      /**
       * Bubble reached surface.
       * Recycle it at the bottom.
       */
      if (
        bubble.graphic.y <
        -20
      ) {
        bubble.graphic.y =
          height +
          Math.random() *
          100;

        bubble.graphic.x =
          Math.random() *
          width;
      }
    }
  };

  return {
    container,
    update,
  };
}