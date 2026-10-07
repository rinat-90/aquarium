import type { Fish, Vector2 } from '@aquarium/types';

export type AquariumOptions = {
  width: number;
  height: number;
};

export class Aquarium {
  private fish = new Map<string, Fish>();

  constructor(private options: AquariumOptions) {}

  addFish(fish: Fish) {
    this.fish.set(fish.id, fish);
  }

  createFish(id: string): Fish {
    const speed = 50 + Math.random() * 70;

    const position: Vector2 = {
      x: Math.random() * this.options.width,
      y: Math.random() * this.options.height,
    };

    const target = this.createRandomTarget();

    const dx = target.x - position.x;
    const dy = target.y - position.y;

    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    const fish: Fish = {
      id,
      position,
      target,

      velocity: {
        x: (dx / length) * speed,
        y: (dy / length) * speed,
      },

      speed,
      direction: dx >= 0 ? 'right' : 'left',
    };

    this.addFish(fish);

    return fish;
  }

  removeFish(id: string) {
    this.fish.delete(id);
  }

  getFish(): Fish[] {
    return [...this.fish.values()];
  }

  update(deltaTime: number) {
    for (const fish of this.fish.values()) {
      this.updateFish(fish, deltaTime);
    }
  }

  private updateFish(fish: Fish, deltaTime: number) {
    const distanceToTarget = this.distance(
      fish.position,
      fish.target,
    );

    if (distanceToTarget < 30) {
      fish.target = this.createRandomTarget();
    }

    const dx = fish.target.x - fish.position.x;
    const dy = fish.target.y - fish.position.y;

    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      return;
    }

    const desiredVelocity: Vector2 = {
      x: (dx / length) * fish.speed,
      y: (dy / length) * fish.speed,
    };

    // Smooth steering instead of immediately changing direction.
    const steering = 2;

    fish.velocity.x +=
      (desiredVelocity.x - fish.velocity.x) *
      steering *
      deltaTime;

    fish.velocity.y +=
      (desiredVelocity.y - fish.velocity.y) *
      steering *
      deltaTime;

    fish.position.x += fish.velocity.x * deltaTime;
    fish.position.y += fish.velocity.y * deltaTime;

    if (Math.abs(fish.velocity.x) > 1) {
      fish.direction =
        fish.velocity.x >= 0 ? 'right' : 'left';
    }
  }

  private createRandomTarget(): Vector2 {
    const padding = 80;

    return {
      x:
        padding +
        Math.random() *
        Math.max(
          0,
          this.options.width - padding * 2,
        ),

      y:
        padding +
        Math.random() *
        Math.max(
          0,
          this.options.height - padding * 2,
        ),
    };
  }

  private distance(a: Vector2, b: Vector2) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(dx * dx + dy * dy);
  }
}