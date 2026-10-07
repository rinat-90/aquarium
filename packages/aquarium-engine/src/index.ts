import type {
  Fish,
  Food,
  Vector2,
} from '@aquarium/types';

export type AquariumOptions = {
  width: number;
  height: number;
};

export class Aquarium {
  private fish =
    new Map<string, Fish>();

  private food =
    new Map<string, Food>();

  constructor(
    private options: AquariumOptions,
  ) {}

  addFish(fish: Fish) {
    this.fish.set(
      fish.id,
      fish,
    );
  }

  createFish(id: string): Fish {
    const speed =
      50 +
      Math.random() * 70;

    const position: Vector2 = {
      x:
        80 +
        Math.random() *
        Math.max(
          0,
          this.options.width - 160,
        ),

      y:
        80 +
        Math.random() *
        Math.max(
          0,
          this.options.height - 160,
        ),
    };

    const target =
      this.createRandomTarget();

    const direction =
      this.directionTo(
        position,
        target,
      );

    const initialSpeed =
      speed * 0.65;

    const fish: Fish = {
      id,

      position,
      target,

      velocity: {
        x:
          direction.x *
          initialSpeed,

        y:
          direction.y *
          initialSpeed,
      },

      speed,

      direction:
        direction.x >= 0
          ? 'right'
          : 'left',

      behavior:
        'wandering',
    };

    this.addFish(fish);

    return fish;
  }

  removeFish(id: string) {
    this.fish.delete(id);
  }

  getFish(): Fish[] {
    return [
      ...this.fish.values(),
    ];
  }

  addFood(
    food: Omit<
      Food,
      'sinkSpeed'
    > & {
      sinkSpeed?: number;
    },
  ) {
    this.food.set(
      food.id,
      {
        ...food,

        sinkSpeed:
          food.sinkSpeed ??
          18,
      },
    );
  }

  getFood(): Food[] {
    return [
      ...this.food.values(),
    ];
  }

  update(deltaTime: number) {
    /**
     * Avoid giant movement jumps if
     * the browser tab stalls briefly.
     */
    const safeDeltaTime =
      Math.min(
        deltaTime,
        0.05,
      );

    this.updateFood(
      safeDeltaTime,
    );

    this.assignFoodTargets();

    for (
      const fish of
      this.fish.values()
      ) {
      this.updateFish(
        fish,
        safeDeltaTime,
      );
    }
  }

  private updateFood(
    deltaTime: number,
  ) {
    const bottomPadding = 70;

    const bottom =
      this.options.height -
      bottomPadding;

    for (
      const food of
      this.food.values()
      ) {
      food.position.y =
        Math.min(
          bottom,
          food.position.y +
          food.sinkSpeed *
          deltaTime,
        );
    }
  }

  private assignFoodTargets() {
    const claimedFood =
      new Set<string>();

    /**
     * Preserve valid existing food
     * assignments first.
     */
    for (
      const fish of
      this.fish.values()
      ) {
      if (
        !fish.targetFoodId
      ) {
        continue;
      }

      const food =
        this.food.get(
          fish.targetFoodId,
        );

      if (
        !food ||
        claimedFood.has(
          food.id,
        )
      ) {
        this.returnToWandering(
          fish,
        );

        continue;
      }

      claimedFood.add(
        food.id,
      );

      fish.behavior =
        'seeking-food';

      fish.target = {
        ...food.position,
      };
    }

    /**
     * Give unassigned fish the nearest
     * currently unclaimed pellet.
     */
    for (
      const fish of
      this.fish.values()
      ) {
      if (
        fish.targetFoodId
      ) {
        continue;
      }

      let closestFood:
        | Food
        | undefined;

      let closestDistance =
        Infinity;

      for (
        const food of
        this.food.values()
        ) {
        if (
          claimedFood.has(
            food.id,
          )
        ) {
          continue;
        }

        const distance =
          this.distance(
            fish.position,
            food.position,
          );

        if (
          distance <
          closestDistance
        ) {
          closestDistance =
            distance;

          closestFood =
            food;
        }
      }

      if (!closestFood) {
        continue;
      }

      claimedFood.add(
        closestFood.id,
      );

      fish.behavior =
        'seeking-food';

      fish.targetFoodId =
        closestFood.id;

      fish.target = {
        ...closestFood.position,
      };
    }
  }

  private updateFish(
    fish: Fish,
    deltaTime: number,
  ) {
    /**
     * Keep a food target synced with
     * the sinking pellet.
     */
    if (
      fish.behavior ===
      'seeking-food' &&
      fish.targetFoodId
    ) {
      const food =
        this.food.get(
          fish.targetFoodId,
        );

      if (!food) {
        this.returnToWandering(
          fish,
        );
      } else {
        fish.target = {
          ...food.position,
        };

        const distanceToFood =
          this.distance(
            fish.position,
            food.position,
          );

        if (
          distanceToFood < 20
        ) {
          this.eatFood(
            fish,
            food,
          );

          return;
        }
      }
    }

    let distanceToTarget =
      this.distance(
        fish.position,
        fish.target,
      );

    /**
     * Wandering fish choose a new
     * destination before reaching the
     * exact target. This prevents them
     * from stopping sharply.
     */
    if (
      fish.behavior ===
      'wandering' &&
      distanceToTarget < 45
    ) {
      fish.target =
        this.createRandomTarget();

      distanceToTarget =
        this.distance(
          fish.position,
          fish.target,
        );
    }

    const desiredDirection =
      this.directionTo(
        fish.position,
        fish.target,
      );

    /**
     * Fish cruise while wandering and
     * accelerate when food appears.
     */
    let targetSpeed =
      fish.behavior ===
      'seeking-food'
        ? fish.speed * 1.3
        : fish.speed * 0.72;

    /**
     * Slow down as we approach food.
     *
     * This makes eating look more like
     * an approach instead of the fish
     * shooting through the pellet.
     */
    if (
      fish.behavior ===
      'seeking-food' &&
      distanceToTarget < 100
    ) {
      const approachFactor =
        Math.max(
          0.35,
          distanceToTarget /
          100,
        );

      targetSpeed *=
        approachFactor;
    }

    const desiredVelocity: Vector2 = {
      x:
        desiredDirection.x *
        targetSpeed,

      y:
        desiredDirection.y *
        targetSpeed,
    };

    /**
     * Seeking food gets slightly more
     * responsive steering.
     */
    const steering =
      fish.behavior ===
      'seeking-food'
        ? 2.8
        : 1.45;

    /**
     * Exponential interpolation makes
     * steering independent of frame
     * rate and smoother than a direct
     * linear multiplier.
     */
    const steeringAmount =
      1 -
      Math.exp(
        -steering *
        deltaTime,
      );

    fish.velocity.x +=
      (
        desiredVelocity.x -
        fish.velocity.x
      ) *
      steeringAmount;

    fish.velocity.y +=
      (
        desiredVelocity.y -
        fish.velocity.y
      ) *
      steeringAmount;

    fish.position.x +=
      fish.velocity.x *
      deltaTime;

    fish.position.y +=
      fish.velocity.y *
      deltaTime;

    this.keepFishInsideAquarium(
      fish,
    );

    /**
     * Don't flip direction because of
     * tiny horizontal velocity changes.
     */
    if (
      Math.abs(
        fish.velocity.x,
      ) > 8
    ) {
      fish.direction =
        fish.velocity.x >= 0
          ? 'right'
          : 'left';
    }
  }

  private keepFishInsideAquarium(
    fish: Fish,
  ) {
    const horizontalPadding = 45;
    const topPadding = 45;
    const bottomPadding = 105;

    const minX =
      horizontalPadding;

    const maxX =
      Math.max(
        minX,
        this.options.width -
        horizontalPadding,
      );

    const minY =
      topPadding;

    const maxY =
      Math.max(
        minY,
        this.options.height -
        bottomPadding,
      );

    if (
      fish.position.x < minX
    ) {
      fish.position.x =
        minX;

      fish.velocity.x =
        Math.abs(
          fish.velocity.x,
        );
    }

    if (
      fish.position.x > maxX
    ) {
      fish.position.x =
        maxX;

      fish.velocity.x =
        -Math.abs(
          fish.velocity.x,
        );
    }

    if (
      fish.position.y < minY
    ) {
      fish.position.y =
        minY;

      fish.velocity.y =
        Math.abs(
          fish.velocity.y,
        );
    }

    if (
      fish.position.y > maxY
    ) {
      fish.position.y =
        maxY;

      fish.velocity.y =
        -Math.abs(
          fish.velocity.y,
        );
    }
  }

  private eatFood(
    fish: Fish,
    food: Food,
  ) {
    this.food.delete(
      food.id,
    );

    this.returnToWandering(
      fish,
    );
  }

  private returnToWandering(
    fish: Fish,
  ) {
    fish.behavior =
      'wandering';

    fish.targetFoodId =
      undefined;

    fish.target =
      this.createRandomTarget();
  }

  private createRandomTarget(): Vector2 {
    const horizontalPadding =
      80;

    const topPadding =
      80;

    const bottomPadding =
      120;

    return {
      x:
        horizontalPadding +
        Math.random() *
        Math.max(
          0,
          this.options.width -
          horizontalPadding *
          2,
        ),

      y:
        topPadding +
        Math.random() *
        Math.max(
          0,
          this.options.height -
          topPadding -
          bottomPadding,
        ),
    };
  }

  private directionTo(
    from: Vector2,
    to: Vector2,
  ): Vector2 {
    const dx =
      to.x - from.x;

    const dy =
      to.y - from.y;

    const length =
      Math.sqrt(
        dx * dx +
        dy * dy,
      ) || 1;

    return {
      x:
        dx / length,

      y:
        dy / length,
    };
  }

  private distance(
    a: Vector2,
    b: Vector2,
  ) {
    const dx =
      a.x - b.x;

    const dy =
      a.y - b.y;

    return Math.sqrt(
      dx * dx +
      dy * dy,
    );
  }
}