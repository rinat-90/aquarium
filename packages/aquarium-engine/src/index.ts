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

type FishPersonality = {
  cruiseSpeed: number;
  turnResponsiveness: number;
  verticalRange: number;
  depthRange: number;
  foodExcitement: number;
};

type FishActivity = {
  idleUntil: number;
  nextIdleAt: number;
};

export class Aquarium {
  private fish =
    new Map<string, Fish>();

  private food =
    new Map<string, Food>();

  private personalities =
    new Map<
      string,
      FishPersonality
    >();

  private activities =
    new Map<
      string,
      FishActivity
    >();

  private elapsedTime = 0;

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

    this.personalities.delete(
      id,
    );

    this.activities.delete(
      id,
    );
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

    this.elapsedTime +=
      safeDeltaTime;

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

  private applyBoundaryAvoidance(
    fish: Fish,
    desiredDirection: Vector3,
  ): Vector3 {
    const halfWidth =
      this.options.width / 2;

    const halfHeight =
      this.options.height / 2;

    const halfDepth =
      this.options.depth / 2;

    const marginX = 1.4;
    const marginY = 1.2;
    const marginZ = 0.9;

    let x = desiredDirection.x;
    let y = desiredDirection.y;
    let z = desiredDirection.z;

    /*
     * Start gently steering inward before
     * actually reaching the glass.
     */
    const rightDistance =
      halfWidth - fish.position.x;

    const leftDistance =
      fish.position.x + halfWidth;

    if (rightDistance < marginX) {
      x -=
        (1 -
          rightDistance /
          marginX) *
        1.8;
    }

    if (leftDistance < marginX) {
      x +=
        (1 -
          leftDistance /
          marginX) *
        1.8;
    }

    const topDistance =
      halfHeight - fish.position.y;

    const bottomDistance =
      fish.position.y + halfHeight;

    if (topDistance < marginY) {
      y -=
        (1 -
          topDistance /
          marginY) *
        1.4;
    }

    if (bottomDistance < marginY) {
      y +=
        (1 -
          bottomDistance /
          marginY) *
        1.4;
    }

    const frontDistance =
      halfDepth - fish.position.z;

    const backDistance =
      fish.position.z + halfDepth;

    if (frontDistance < marginZ) {
      z -=
        (1 -
          frontDistance /
          marginZ) *
        1.3;
    }

    if (backDistance < marginZ) {
      z +=
        (1 -
          backDistance /
          marginZ) *
        1.3;
    }

    const length =
      Math.sqrt(
        x * x +
        y * y +
        z * z,
      ) || 1;

    return {
      x: x / length,
      y: y / length,
      z: z / length,
    };
  }

  private updateFish(
    fish: Fish,
    deltaTime: number,
  ) {
    const personality =
      this.getPersonality(
        fish,
      );

    const isIdling =
      this.updateActivity(
        fish,
      );

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
     * Pick a new wandering target before
     * completely stopping.
     */
    if (
      fish.behavior ===
      'wandering' &&
      distanceToTarget < 0.75
    ) {
      fish.target =
        this.createRandomTarget(
          fish.position,
          personality,
        );

      distanceToTarget =
        this.distance(
          fish.position,
          fish.target,
        );
    }

    const targetDirection =
      this.directionTo(
        fish.position,
        fish.target,
      );

    const desiredDirection =
      fish.behavior ===
      'wandering'
        ? this.applyBoundaryAvoidance(
          fish,
          targetDirection,
        )
        : targetDirection;

    /*
     * Small continuous speed variation keeps
     * cruising from looking mechanical.
     */
    const cruisingVariation =
      0.68 +
      Math.sin(
        fish.position.x * 0.7 +
        fish.position.y * 0.4,
      ) *
      0.08;

    /*
     * Personality affects both normal
     * cruising speed and how strongly the
     * fish reacts to food.
     */
    let targetSpeed =
      fish.behavior ===
      'seeking-food'
        ? fish.speed *
        personality.foodExcitement
        : fish.speed *
        cruisingVariation *
        personality.cruiseSpeed;

    /*
     * Wandering fish occasionally enter a
     * short idle/glide period. Food seeking
     * always keeps its normal speed.
     */
    if (
      fish.behavior ===
      'wandering' &&
      isIdling
    ) {
      targetSpeed *= 0.18;
    }

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

    /*
     * Responsive fish make tighter turns.
     * Calm fish make broader, slower turns.
     */
    const steering =
      (
        fish.behavior ===
        'seeking-food'
          ? 2.8
          : 1.45
      ) *
      personality.turnResponsiveness;

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

    const personality =
      this.getPersonality(
        fish,
      );

    fish.target =
      this.createRandomTarget(
        fish.position,
        personality,
      );
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

  private createRandomTarget(
    from?: Vector3,
    personality?: FishPersonality,
  ): Vector3 {
    const horizontalPadding = 1;
    const verticalPadding = 0.9;
    const depthPadding = 0.6;

    const minX =
      -this.options.width / 2 +
      horizontalPadding;

    const maxX =
      this.options.width / 2 -
      horizontalPadding;

    const minY =
      -this.options.height / 2 +
      verticalPadding;

    const maxY =
      this.options.height / 2 -
      verticalPadding;

    const minZ =
      -this.options.depth / 2 +
      depthPadding;

    const maxZ =
      this.options.depth / 2 -
      depthPadding;

    if (!from) {
      return {
        x:
          minX +
          Math.random() *
          (maxX - minX),

        y:
          minY +
          Math.random() *
          (maxY - minY),

        z:
          minZ +
          Math.random() *
          (maxZ - minZ),
      };
    }

    /*
     * Fish mainly cruise horizontally.
     */
    const horizontalDistance =
      2.5 +
      Math.random() * 3.5;

    const horizontalDirection =
      Math.random() < 0.5
        ? -1
        : 1;

    const verticalRange =
      personality
        ?.verticalRange ??
      1;

    const depthRange =
      personality
        ?.depthRange ??
      1;

    return {
      x: Math.max(
        minX,
        Math.min(
          maxX,
          from.x +
          horizontalDistance *
          horizontalDirection,
        ),
      ),

      y: Math.max(
        minY,
        Math.min(
          maxY,
          from.y +
          (
            Math.random() -
            0.5
          ) *
          2.2 *
          verticalRange,
        ),
      ),

      z: Math.max(
        minZ,
        Math.min(
          maxZ,
          from.z +
          (
            Math.random() -
            0.5
          ) *
          1.8 *
          depthRange,
        ),
      ),
    };
  }

  private updateActivity(
    fish: Fish,
  ): boolean {
    let activity =
      this.activities.get(
        fish.id,
      );

    if (!activity) {
      activity = {
        idleUntil: 0,

        nextIdleAt:
          this.elapsedTime +
          8 +
          Math.random() * 12,
      };

      this.activities.set(
        fish.id,
        activity,
      );
    }

    /*
     * Food always wins over idling.
     */
    if (
      fish.behavior ===
      'seeking-food'
    ) {
      return false;
    }

    if (
      this.elapsedTime <
      activity.idleUntil
    ) {
      return true;
    }

    if (
      this.elapsedTime >=
      activity.nextIdleAt
    ) {
      const idleDuration =
        1.8 +
        Math.random() * 3;

      activity.idleUntil =
        this.elapsedTime +
        idleDuration;

      activity.nextIdleAt =
        activity.idleUntil +
        8 +
        Math.random() * 12;

      return true;
    }

    return false;
  }

  private getPersonality(
    fish: Fish,
  ): FishPersonality {
    const existing =
      this.personalities.get(
        fish.id,
      );

    if (existing) {
      return existing;
    }

    /*
     * Generate deterministic pseudo-random
     * traits from the fish ID.
     *
     * The same fish therefore keeps the same
     * personality after a page refresh.
     */
    const seed =
      this.hashString(
        fish.id,
      );

    const random = (
      offset: number,
    ) =>
      this.seededRandom(
        seed + offset,
      );

    const personality: FishPersonality = {
      /*
       * Relaxed cruiser -> energetic cruiser.
       */
      cruiseSpeed:
        0.82 +
        random(11) * 0.3,

      /*
       * Wide lazy turns -> responsive turns.
       */
      turnResponsiveness:
        0.85 +
        random(23) * 0.4,

      /*
       * How much the fish explores vertically.
       */
      verticalRange:
        0.65 +
        random(37) * 0.6,

      /*
       * How much the fish explores tank depth.
       */
      depthRange:
        0.65 +
        random(51) * 0.6,

      /*
       * How strongly it speeds up for food.
       */
      foodExcitement:
        1.15 +
        random(67) * 0.35,
    };

    this.personalities.set(
      fish.id,
      personality,
    );

    return personality;
  }

  private hashString(
    value: string,
  ): number {
    let hash = 2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^=
        value.charCodeAt(
          index,
        );

      hash =
        Math.imul(
          hash,
          16777619,
        );
    }

    return hash >>> 0;
  }

  private seededRandom(
    seed: number,
  ): number {
    let value =
      seed + 0x6d2b79f5;

    value =
      Math.imul(
        value ^
        (value >>> 15),
        value | 1,
      );

    value ^=
      value +
      Math.imul(
        value ^
        (value >>> 7),
        value | 61,
      );

    return (
      (
        value ^
        (value >>> 14)
      ) >>>
      0
    ) / 4294967296;
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
      x: dx / length,
      y: dy / length,
      z: dz / length,
    };
  }
}
