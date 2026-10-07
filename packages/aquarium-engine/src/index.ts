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
      50 + Math.random() * 70;

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

    const dx =
      target.x - position.x;

    const dy =
      target.y - position.y;

    const length =
      Math.sqrt(
        dx * dx +
        dy * dy,
      ) || 1;

    const fish: Fish = {
      id,

      position,
      target,

      velocity: {
        x:
          (dx / length) *
          speed,

        y:
          (dy / length) *
          speed,
      },

      speed,

      direction:
        dx >= 0
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
    this.updateFood(
      deltaTime,
    );

    this.assignFoodTargets();

    for (
      const fish of
      this.fish.values()
      ) {
      this.updateFish(
        fish,
        deltaTime,
      );
    }
  }

  /**
   * Food slowly falls through
   * the aquarium.
   */
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

  /**
   * Every fish selects its closest
   * available pellet.
   *
   * A pellet can only be targeted by
   * one fish at a time.
   */
  private assignFoodTargets() {
    const claimedFood =
      new Set<string>();

    /**
     * Preserve valid existing
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

      if (!food) {
        this.returnToWandering(
          fish,
        );

        continue;
      }

      if (
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
     * Fish without food targets find
     * the nearest unclaimed pellet.
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
        }
      }
    }

    const distanceToTarget =
      this.distance(
        fish.position,
        fish.target,
      );

    if (
      fish.behavior ===
      'wandering' &&
      distanceToTarget < 30
    ) {
      fish.target =
        this.createRandomTarget();
    }

    const dx =
      fish.target.x -
      fish.position.x;

    const dy =
      fish.target.y -
      fish.position.y;

    const length =
      Math.sqrt(
        dx * dx +
        dy * dy,
      );

    if (length === 0) {
      return;
    }

    const desiredVelocity: Vector2 = {
      x:
        (dx / length) *
        fish.speed,

      y:
        (dy / length) *
        fish.speed,
    };

    /**
     * Fish react a little faster
     * when food appears.
     */
    const steering =
      fish.behavior ===
      'seeking-food'
        ? 3
        : 2;

    fish.velocity.x +=
      (
        desiredVelocity.x -
        fish.velocity.x
      ) *
      steering *
      deltaTime;

    fish.velocity.y +=
      (
        desiredVelocity.y -
        fish.velocity.y
      ) *
      steering *
      deltaTime;

    fish.position.x +=
      fish.velocity.x *
      deltaTime;

    fish.position.y +=
      fish.velocity.y *
      deltaTime;

    if (
      Math.abs(
        fish.velocity.x,
      ) > 1
    ) {
      fish.direction =
        fish.velocity.x >= 0
          ? 'right'
          : 'left';
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

    /**
     * Keep fish mostly above the sand.
     */
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