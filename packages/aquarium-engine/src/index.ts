import type {
  Fish,
  Food,
  Vector3,
} from '@aquarium/types';

export type FishSpecies = 'basic' | 'angelfish';

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

const FISH_BOUNDS = {
  horizontalPadding: 1.7,
  verticalPadding: 1.55,
  depthPadding: 0.55,
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

  private species = new Map<string, FishSpecies>();

  private elapsedTime = 0;

  private foodSeekProgress =
    new Map<
      string,
      {
        foodId: string;
        bestDistance: number;
        lastProgressAt: number;
      }
    >();

  private options: AquariumOptions;

  constructor(options: AquariumOptions) {
    this.options = options;
  }

  addFish(fish: Fish) {
    this.fish.set(
      fish.id,
      fish,
    );
  }

  createFish(
    id: string,
    size = 1,
    _species: FishSpecies = 'basic',
  ): Fish {
    const speed =
      0.7 +
      Math.random() * 0.7;

    const position =
      this.createRandomPosition(
        size,
      );

    const target =
      this.createRandomTarget(
        undefined,
        undefined,
        size,
      );

    const direction =
      this.directionTo(
        position,
        target,
      );

    const initialSpeed =
      speed * 0.65;

    const fish: Fish = {
      id,
      size,
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
    this.species.delete(id);

    this.personalities.delete(
      id,
    );

    this.activities.delete(
      id,
    );

    this.foodSeekProgress.delete(
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
    const safePosition =
      this.getSafeFoodPosition(
        food.position,
      );

    this.food.set(
      food.id,
      {
        ...food,

        position:
        safePosition,

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
      this.getFoodBounds()
        .minY;

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

    const {
      horizontalPadding,
      verticalPadding,
      depthPadding,
    } = this.getFishBounds(
      fish.size,
    );

    const marginX =
      horizontalPadding * 1.2;

    const marginY =
      verticalPadding * 1.2;

    const marginZ =
      Math.max(
        0.9,
        depthPadding,
      );

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
        2.0;
    }

    if (leftDistance < marginX) {
      x +=
        (1 -
          leftDistance /
          marginX) *
        2.0;
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
        1.9;
    }

    if (bottomDistance < marginY) {
      y +=
        (1 -
          bottomDistance /
          marginY) *
        1.9;
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

  private applyFishSeparation(
    fish: Fish,
    desiredDirection: Vector3,
  ): Vector3 {
    let separationX = 0;
    let separationY = 0;
    let separationZ = 0;
    let nearbyFish = 0;

    for (
      const other of
      this.fish.values()
      ) {
      if (other.id === fish.id) {
        continue;
      }

      const dx =
        fish.position.x -
        other.position.x;

      const dy =
        fish.position.y -
        other.position.y;

      const dz =
        fish.position.z -
        other.position.z;

      const distanceSquared =
        dx * dx +
        dy * dy +
        dz * dz;

      if (distanceSquared <= 0.0001) {
        const direction =
          fish.id < other.id
            ? -1
            : 1;

        separationX += direction;
        nearbyFish += 1;
        continue;
      }

      const distance =
        Math.sqrt(
          distanceSquared,
        );

      const separationDistance =
        0.72 *
        (fish.size + other.size);

      if (
        distance >=
        separationDistance
      ) {
        continue;
      }

      const strength =
        1 -
        distance /
        separationDistance;

      separationX +=
        (dx / distance) *
        strength;

      separationY +=
        (dy / distance) *
        strength *
        0.7;

      separationZ +=
        (dz / distance) *
        strength;

      nearbyFish += 1;
    }

    if (nearbyFish === 0) {
      return desiredDirection;
    }

    const separationWeight =
      fish.behavior ===
      'seeking-food'
        ? 1.15
        : 1.45;

    const x =
      desiredDirection.x +
      separationX *
      separationWeight;

    const y =
      desiredDirection.y +
      separationY *
      separationWeight;

    const z =
      desiredDirection.z +
      separationZ *
      separationWeight;

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

  private getFishBounds(
    size = 1,
  ) {
    const safeSize =
      Math.max(
        0.6,
        Math.min(
          1.4,
          size,
        ),
      );

    return {
      horizontalPadding:
        FISH_BOUNDS.horizontalPadding *
        safeSize,

      verticalPadding:
        FISH_BOUNDS.verticalPadding *
        safeSize,

      depthPadding:
        FISH_BOUNDS.depthPadding *
        safeSize,
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

        const foodDistance =
          this.distance(
            fish.position,
            food.position,
          );

        if (
          foodDistance < 0.4
        ) {
          this.eatFood(
            fish,
            food,
          );

          return;
        }

        if (
          this.isFoodTargetStalled(
            fish,
            food,
            foodDistance,
          )
        ) {
          this.returnToWandering(
            fish,
          );
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
          fish.size,
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

    const boundaryDirection =
      this.applyBoundaryAvoidance(
        fish,
        targetDirection,
      );

    const desiredDirection =
      this.applyFishSeparation(
        fish,
        boundaryDirection,
      );

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
    const {
      horizontalPadding,
      verticalPadding,
      depthPadding,
    } = this.getFishBounds(
      fish.size,
    );

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

    this.foodSeekProgress.delete(
      fish.id,
    );

    const personality =
      this.getPersonality(
        fish,
      );

    fish.target =
      this.createRandomTarget(
        fish.position,
        personality,
        fish.size,
      );
  }

  private getFoodBounds() {
    /*
     * Food stays away from the extreme sides
     * and above the substrate / decoration
     * zone. This prevents fish from being
     * asked to chase pellets into rocks.
     */
    return {
      minX:
        -this.options.width / 2 +
        1.15,

      maxX:
        this.options.width / 2 -
        1.15,

      minY:
        -this.options.height / 2 +
        1.45,

      maxY:
        this.options.height / 2 -
        0.55,

      minZ:
        -this.options.depth / 2 +
        0.65,

      maxZ:
        this.options.depth / 2 -
        0.65,
    };
  }

  private getSafeFoodPosition(
    position: Vector3,
  ): Vector3 {
    const bounds =
      this.getFoodBounds();

    return {
      x: Math.max(
        bounds.minX,
        Math.min(
          bounds.maxX,
          position.x,
        ),
      ),

      y: Math.max(
        bounds.minY,
        Math.min(
          bounds.maxY,
          position.y,
        ),
      ),

      z: Math.max(
        bounds.minZ,
        Math.min(
          bounds.maxZ,
          position.z,
        ),
      ),
    };
  }

  private isFoodTargetStalled(
    fish: Fish,
    food: Food,
    distance: number,
  ): boolean {
    const existing =
      this.foodSeekProgress.get(
        fish.id,
      );

    if (
      !existing ||
      existing.foodId !== food.id
    ) {
      this.foodSeekProgress.set(
        fish.id,
        {
          foodId: food.id,
          bestDistance: distance,
          lastProgressAt:
          this.elapsedTime,
        },
      );

      return false;
    }

    /*
     * Only count meaningful progress so tiny
     * steering oscillations do not keep an
     * unreachable target alive forever.
     */
    if (
      distance <
      existing.bestDistance -
      0.12
    ) {
      existing.bestDistance =
        distance;

      existing.lastProgressAt =
        this.elapsedTime;

      return false;
    }

    const stalledFor =
      this.elapsedTime -
      existing.lastProgressAt;

    if (stalledFor < 4.5) {
      return false;
    }

    /*
     * Remove the unreachable pellet as well.
     * Otherwise another fish would immediately
     * claim the same bad target.
     */
    this.food.delete(
      food.id,
    );

    this.foodSeekProgress.delete(
      fish.id,
    );

    return true;
  }

  private createRandomPosition(
    size = 1,
  ): Vector3 {
    const {
      horizontalPadding,
      verticalPadding,
      depthPadding,
    } = this.getFishBounds(
      size,
    );

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

  private createRandomTarget(
    from?: Vector3,
    personality?: FishPersonality,
    size = 1,
  ): Vector3 {
    const {
      horizontalPadding,
      verticalPadding,
      depthPadding,
    } = this.getFishBounds(
      size,
    );

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

      /*
       * The illustrated aquarium is visually
       * much deeper than the original tank.
       *
       * Give wandering fish meaningful
       * front/back travel so they can move
       * between foreground and background
       * layers instead of hovering around
       * one Z plane.
       */
      z: Math.max(
        minZ,
        Math.min(
          maxZ,
          from.z +
          (
            Math.random() -
            0.5
          ) *
          4.8 *
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
          (this.species.get(fish.id) === 'angelfish' ? 6 : 10) +
          Math.random() * 10,
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
        (this.species.get(fish.id) === 'angelfish' ? 2.5 : 1.2) +
        Math.random() * 2.5;

      activity.idleUntil =
        this.elapsedTime +
        idleDuration;

      activity.nextIdleAt =
        activity.idleUntil +
        (this.species.get(fish.id) === 'angelfish' ? 7 : 11) +
        Math.random() * 10;

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

    const angelfish = this.species.get(fish.id) === 'angelfish';

    const personality: FishPersonality = {
      /*
       * Relaxed cruiser -> energetic cruiser.
       */
      cruiseSpeed:
        (angelfish ? 0.68 : 0.9) + random(11) * (angelfish ? 0.18 : 0.3),

      /*
       * Wide lazy turns -> responsive turns.
       */
      turnResponsiveness:
        (angelfish ? 0.52 : 0.95) + random(23) * (angelfish ? 0.18 : 0.35),

      /*
       * How much the fish explores vertically.
       */
      verticalRange:
        (angelfish ? 0.35 : 0.75) + random(37) * (angelfish ? 0.3 : 0.55),

      /*
       * How much the fish explores tank depth.
       */
      depthRange:
        (angelfish ? 0.5 : 0.75) + random(51) * (angelfish ? 0.35 : 0.55),

      /*
       * How strongly it speeds up for food.
       */
      foodExcitement:
        (angelfish ? 1.35 : 1.2) + random(67) * 0.3,
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
