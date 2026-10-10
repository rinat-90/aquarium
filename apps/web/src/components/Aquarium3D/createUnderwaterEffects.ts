
import * as THREE from 'three';

export type UnderwaterEffects = {
  update: (
    deltaTime: number,
    elapsed: number,
  ) => void;
  destroy: () => void;
};

type Bubble = {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  speed: number;
  drift: number;
  phase: number;
  originX: number;
  originZ: number;
  age: number;
  lifetime: number;
};

export function createUnderwaterEffects(
  scene: THREE.Scene,
  tankWidth: number,
  tankHeight: number,
  tankDepth: number,
): UnderwaterEffects {
  const bubbleGeometry =
    new THREE.PlaneGeometry(1, 1);

  const bubbleMaterial =
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,

      uniforms: {},

      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            instanceMatrix *
            vec4(position, 1.0);
        }
      `,

      fragmentShader: `
        varying vec2 vUv;

        void main() {
          vec2 p =
            (vUv - 0.5) * 2.0;

          float r = length(p);

          if (r > 1.0) {
            discard;
          }

          // Soft outer rim.
          float rim =
            smoothstep(0.64, 0.96, r) *
            (1.0 - smoothstep(0.96, 1.0, r));

          // Slightly stronger reflection
          // on the upper-left side.
          float angle =
            atan(p.y, p.x);

          float reflection =
            pow(
              max(
                0.0,
                cos(angle - 2.25)
              ),
              7.0
            );

          float highlight =
            rim * reflection;

          // Small white reflection.
          vec2 highlightPos =
            vec2(-0.32, 0.38);

          float spot =
            exp(
              -length(
                (p - highlightPos) *
                vec2(1.3, 1.8)
              ) * 18.0
            );

          // Faint lower reflection.
          float bottomGlow =
            exp(
              -length(
                (p - vec2(0.28, -0.55)) *
                vec2(1.0, 2.0)
              ) * 12.0
            );

          float alpha =
            rim * 0.52 +
            highlight * 0.85 +
            spot * 0.90 +
            bottomGlow * 0.25;

          alpha *=
            1.0 -
            smoothstep(0.97, 1.0, r);

          vec3 color =
            mix(
              vec3(0.30, 0.78, 1.0),
              vec3(1.0, 1.0, 1.0),
              clamp(
                highlight + spot,
                0.0,
                1.0
              )
            );

          gl_FragColor =
            vec4(
              color,
              clamp(alpha, 0.0, 0.95)
            );
        }
      `,
    });

  const bubbles: Bubble[] = [];
  const bubbleCount = 65;

  // One mesh renders all 65 bubbles.
  const bubbleMesh =
    new THREE.InstancedMesh(
      bubbleGeometry,
      bubbleMaterial,
      bubbleCount,
    );

  bubbleMesh.instanceMatrix.setUsage(
    THREE.DynamicDrawUsage,
  );

  // Bubbles move around the aquarium,
  // so avoid stale bounding-volume culling.
  bubbleMesh.frustumCulled = false;

  scene.add(bubbleMesh);

  // Reused for writing instance transforms.
  const dummy = new THREE.Object3D();

  // Streams originate near the sides,
  // where coral and sponges are located.
  const bubbleSources = [
    {
      x: -tankWidth * 0.39,
      z: 0.5,
    },
    {
      x: -tankWidth * 0.29,
      z: -1.2,
    },
    {
      x: tankWidth * 0.34,
      z: 0.2,
    },
    {
      x: tankWidth * 0.41,
      z: -1.5,
    },
  ];

  const resetBubble = (
    bubble: Bubble,
    initial = false,
  ) => {
    const source =
      bubbleSources[
        Math.floor(
          Math.random() *
          bubbleSources.length,
        )
        ];

    // Mostly small bubbles,
    // with occasional larger ones.
    const random = Math.random();

    const diameter =
      random < 0.7
        ? 0.055 + Math.random() * 0.065
        : random < 0.94
          ? 0.12 + Math.random() * 0.075
          : 0.20 + Math.random() * 0.06;

    bubble.scale.set(
      diameter,
      diameter *
      (0.94 + Math.random() * 0.12),
      1,
    );

    bubble.originX =
      source.x +
      (Math.random() - 0.5) * 0.85;

    bubble.originZ =
      source.z +
      (Math.random() - 0.5) * 0.8;

    bubble.position.set(
      bubble.originX,
      initial
        ? -tankHeight / 2 +
        Math.random() * tankHeight
        : -tankHeight / 2 + 0.25,
      bubble.originZ,
    );

    bubble.speed =
      0.32 + Math.random() * 0.48;

    bubble.drift =
      0.06 + Math.random() * 0.12;

    bubble.phase =
      Math.random() * Math.PI * 2;

    bubble.age =
      initial
        ? Math.random() * 10
        : 0;

    bubble.lifetime = 30;
  };

  const writeBubbleMatrix = (
    bubble: Bubble,
    index: number,
  ) => {
    dummy.position.copy(bubble.position);
    dummy.scale.copy(bubble.scale);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();

    bubbleMesh.setMatrixAt(
      index,
      dummy.matrix,
    );
  };

  // Initialize bubbles and their transforms.
  for (
    let index = 0;
    index < bubbleCount;
    index++
  ) {
    const bubble: Bubble = {
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1, 1, 1),
      speed: 0,
      drift: 0,
      phase: 0,
      originX: 0,
      originZ: 0,
      age: 0,
      lifetime: 30,
    };

    resetBubble(bubble, true);

    bubbles.push(bubble);

    writeBubbleMatrix(
      bubble,
      index,
    );
  }

  bubbleMesh.instanceMatrix.needsUpdate = true;

  // Tiny suspended underwater particles.
  const particleCount = 150;

  const particlePositions =
    new Float32Array(
      particleCount * 3,
    );

  for (
    let index = 0;
    index < particleCount;
    index++
  ) {
    const offset = index * 3;

    particlePositions[offset] =
      (Math.random() - 0.5) *
      tankWidth;

    particlePositions[offset + 1] =
      (Math.random() - 0.5) *
      tankHeight;

    particlePositions[offset + 2] =
      (Math.random() - 0.5) *
      tankDepth;
  }

  const particleGeometry =
    new THREE.BufferGeometry();

  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      particlePositions,
      3,
    ),
  );

  const particleMaterial =
    new THREE.PointsMaterial({
      color: 0xc7f5ff,
      size: 0.018,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });

  const particles =
    new THREE.Points(
      particleGeometry,
      particleMaterial,
    );

  scene.add(particles);

  const update = (
    deltaTime: number,
    elapsed: number,
  ) => {
    const dt = Math.min(
      deltaTime,
      0.05,
    );

    for (
      let index = 0;
      index < bubbles.length;
      index++
    ) {
      const bubble = bubbles[index];

      bubble.age += dt;

      bubble.position.y +=
        bubble.speed * dt;

      // Gentle sideways wobble.
      bubble.position.x =
        bubble.originX +
        Math.sin(
          elapsed * 1.2 +
          bubble.phase,
        ) *
        bubble.drift;

      bubble.position.z =
        bubble.originZ +
        Math.cos(
          elapsed * 0.7 +
          bubble.phase,
        ) *
        bubble.drift *
        0.35;

      // Slight natural deformation.
      const wobble =
        1 +
        Math.sin(
          elapsed * 3 +
          bubble.phase,
        ) * 0.035;

      bubble.scale.y =
        bubble.scale.x *
        wobble;

      if (
        bubble.position.y >
        tankHeight / 2 - 0.15 ||
        bubble.age > bubble.lifetime
      ) {
        resetBubble(bubble);
      }

      writeBubbleMatrix(
        bubble,
        index,
      );
    }

    // Upload all updated transforms once.
    bubbleMesh.instanceMatrix.needsUpdate = true;

    particles.rotation.y =
      Math.sin(
        elapsed * 0.08,
      ) * 0.02;

    particles.position.y =
      Math.sin(
        elapsed * 0.15,
      ) * 0.025;
  };

  const destroy = () => {
    scene.remove(bubbleMesh);
    scene.remove(particles);

    bubbleGeometry.dispose();
    bubbleMaterial.dispose();

    particleGeometry.dispose();
    particleMaterial.dispose();
  };

  return {
    update,
    destroy,
  };
}
