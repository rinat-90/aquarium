import type {
  Fish,
  Food,
  Vector3,
} from '@aquarium/types';

export type AquariumOptions = {
  width: number;
  height: number;
  depth: number;
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
      0.7 +
      Math.random() * 0.7;

    const position =
      this.createRandomPosition();

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

        z:
          direction.z *
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
          0.35,
      },
    );
  }

  getFood(): Food[] {
    return [
      ...this.food.values(),
    ];
  }

  update(deltaTime: number) {
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
    const bottom =
      -this.options.height /
      2 +
      0.8;

    for (
      const food of
      this.food.values()
      ) {
      food.position.y =
        Math.max(
          bottom,

          food.position.y -
          food.sinkSpeed *
          deltaTime,
        );
    }
  }

  private assignFoodTargets() {
    const claimedFood =
      new Set<string>();

    /*
     * Preserve existing assignments.
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

    /*
     * Assign nearest available food.
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

        if (
          this.distance(
            fish.position,
            food.position,
          ) < 0.4
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

    /*
     * Pick a new wandering target
     * before completely stopping.
     */
    if (
      fish.behavior ===
      'wandering' &&
      distanceToTarget < 0.55
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

    let targetSpeed =
      fish.behavior ===
      'seeking-food'
        ? fish.speed * 1.35
        : fish.speed * 0.72;

    /*
     * Slow down when approaching food.
     */
    if (
      fish.behavior ===
      'seeking-food' &&
      distanceToTarget < 1.2
    ) {
      const approachFactor =
        Math.max(
          0.55,
          distanceToTarget /
          1.2,
        );

      targetSpeed *=
        approachFactor;
    }

    const desiredVelocity: Vector3 = {
      x:
        desiredDirection.x *
        targetSpeed,

      y:
        desiredDirection.y *
        targetSpeed,

      z:
        desiredDirection.z *
        targetSpeed,
    };

    const steering =
      fish.behavior ===
      'seeking-food'
        ? 2.8
        : 1.45;

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

    fish.velocity.z +=
      (
        desiredVelocity.z -
        fish.velocity.z
      ) *
      steeringAmount;

    fish.position.x +=
      fish.velocity.x *
      deltaTime;

    fish.position.y +=
      fish.velocity.y *
      deltaTime;

    fish.position.z +=
      fish.velocity.z *
      deltaTime;

    this.keepFishInsideAquarium(
      fish,
    );

    if (
      Math.abs(
        fish.velocity.x,
      ) > 0.08
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
    const horizontalPadding =
      0.7;

    const verticalPadding =
      0.7;

    const depthPadding =
      0.45;

    const minX =
      -this.options.width /
      2 +
      horizontalPadding;

    const maxX =
      this.options.width /
      2 -
      horizontalPadding;

    const minY =
      -this.options.height /
      2 +
      verticalPadding;

    const maxY =
      this.options.height /
      2 -
      verticalPadding;

    const minZ =
      -this.options.depth /
      2 +
      depthPadding;

    const maxZ =
      this.options.depth /
      2 -
      depthPadding;

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

    if (
      fish.position.z < minZ
    ) {
      fish.position.z =
        minZ;

      fish.velocity.z =
        Math.abs(
          fish.velocity.z,
        );
    }

    if (
      fish.position.z > maxZ
    ) {
      fish.position.z =
        maxZ;

      fish.velocity.z =
        -Math.abs(
          fish.velocity.z,
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

  private createRandomPosition(): Vector3 {
    return {
      x:
        (
          Math.random() -
          0.5
        ) *
        (
          this.options.width -
          2
        ),

      y:
        (
          Math.random() -
          0.5
        ) *
        (
          this.options.height -
          2
        ),

      z:
        (
          Math.random() -
          0.5
        ) *
        (
          this.options.depth -
          1
        ),
    };
  }

  private createRandomTarget(): Vector3 {
    const horizontalPadding =
      0.8;

    const verticalPadding =
      0.8;

    const depthPadding =
      0.5;

    return {
      x:
        -this.options.width /
        2 +
        horizontalPadding +
        Math.random() *
        (
          this.options.width -
          horizontalPadding *
          2
        ),

      y:
        -this.options.height /
        2 +
        verticalPadding +
        Math.random() *
        (
          this.options.height -
          verticalPadding *
          2
        ),

      z:
        -this.options.depth /
        2 +
        depthPadding +
        Math.random() *
        (
          this.options.depth -
          depthPadding *
          2
        ),
    };
  }

  private directionTo(
    from: Vector3,
    to: Vector3,
  ): Vector3 {
    const dx =
      to.x - from.x;

    const dy =
      to.y - from.y;

    const dz =
      to.z - from.z;

    const length =
      Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz,
      ) || 1;

    return {
      x:
        dx / length,

      y:
        dy / length,

      z:
        dz / length,
    };
  }

  private distance(
    a: Vector3,
    b: Vector3,
  ) {
    const dx =
      a.x - b.x;

    const dy =
      a.y - b.y;

    const dz =
      a.z - b.z;

    return Math.sqrt(
      dx * dx +
      dy * dy +
      dz * dz,
    );
  }
}