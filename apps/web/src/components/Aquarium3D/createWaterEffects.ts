import * as THREE from 'three';

export type WaterEffects = {
  setCamera: (
    camera: THREE.PerspectiveCamera,
  ) => void;

  resize: (
    camera: THREE.PerspectiveCamera,
  ) => void;

  update: (
    deltaTime: number,
    elapsed: number,
  ) => void;

  destroy: () => void;
};

export function createWaterEffects(
  scene: THREE.Scene,
  _tankWidth: number,
  _tankHeight: number,
  _tankDepth: number,
): WaterEffects {
  /*
   * SCREEN-SPACE WATER OVERLAY
   *
   * This mesh does not use the aquarium camera's world
   * position at all. Its vertex shader writes directly
   * to clip space, guaranteeing that the effect occupies
   * the top of the rendered canvas.
   */
  const geometry =
    new THREE.PlaneGeometry(
      2,
      2,
    );

  const material =
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,

      blending:
      THREE.AdditiveBlending,

      toneMapped: false,

      uniforms: {
        uTime: {
          value: 0,
        },

        uAspect: {
          value: 1,
        },

        uCenterGlow: {
          value: 1,
        },
      },

      vertexShader: `
varying vec2 vUv;

void main() {
  vUv = uv;

  /*
   * PlaneGeometry already spans -1..1 after
   * scaling below, so render directly in NDC.
   */
  gl_Position =
    vec4(
      position.xy,
      0.0,
      1.0
    );
}
`,

      fragmentShader: `
varying vec2 vUv;

uniform float uTime;
uniform float uAspect;

vec2 hash22(vec2 p) {
  p = vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  );

  return fract(
    sin(p) * 43758.5453123
  );
}

vec2 worley(vec2 p, float timeOffset) {
  vec2 cell = floor(p);
  vec2 local = fract(p);

  float nearest = 10.0;
  float second = 10.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(
        float(x),
        float(y)
      );

      vec2 randomPoint =
        hash22(cell + offset);

      /*
       * Slow independent motion. Keeping this subtle
       * prevents the ceiling from "boiling".
       */
      randomPoint =
        0.5 +
        0.34 *
        sin(
          6.2831853 * randomPoint +
          timeOffset
        );

      vec2 delta =
        offset +
        randomPoint -
        local;

      float d =
        dot(delta, delta);

      if (d < nearest) {
        second = nearest;
        nearest = d;
      } else if (d < second) {
        second = d;
      }
    }
  }

  return sqrt(
    vec2(nearest, second)
  );
}

/*
 * Cheap smooth domain warp. This is what turns the
 * straight Voronoi polygons into liquid shapes.
 */
vec2 warp(vec2 p, float t) {
  vec2 q = p;

  q.x +=
    sin(p.y * 1.08 + t * 0.28) *
    0.42;

  q.y +=
    sin(p.x * 0.82 - t * 0.22) *
    0.32;

  q.x +=
    sin(
      p.x * 0.43 +
      p.y * 0.71 -
      t * 0.18
    ) *
    0.22;

  q.y +=
    cos(
      p.x * 0.61 -
      p.y * 0.47 +
      t * 0.16
    ) *
    0.18;

  return q;
}

void main() {
  float fromTop =
    1.0 - vUv.y;

  /*
   * A deeper luminous ceiling like the reference.
   * It fades smoothly into the normal blue water.
   */
  float surfaceMask =
    1.0 -
    smoothstep(
      0.004,
      0.158,
      fromTop
    );

  if (surfaceMask <= 0.001) {
    discard;
  }

  float depth =
    clamp(
      fromTop / 0.158,
      0.0,
      1.0
    );

  /*
   * Compress the pattern toward the horizon.
   */
  float perspective =
    mix(
      1.20,
      0.64,
      depth
    );

  vec2 base =
    vec2(
      (vUv.x - 0.5) *
      uAspect *
      5.15 *
      perspective,
      depth * 3.55
    );

  float t =
    uTime * 0.16;

  vec2 warped =
    warp(base, t);

  /*
   * Two warped networks at different scales.
   * Their overlap produces irregular broad cells,
   * small highlights, and broken edges.
   */
  vec2 cellsA =
    worley(
      warped,
      t * 0.72
    );

  vec2 cellsB =
    worley(
      warp(
        base * 0.61 +
        vec2(3.7, -1.9),
        -t * 0.73
      ),
      -t * 0.46
    );

  float edgeA =
    cellsA.y -
    cellsA.x;

  float edgeB =
    cellsB.y -
    cellsB.x;

  /*
   * Wide cyan halo + narrower luminous core.
   * The halo is important: without it the pattern
   * looks like a white wireframe.
   */
  float haloA =
    1.0 -
    smoothstep(
      0.045,
      0.235,
      edgeA
    );

  float coreA =
    1.0 -
    smoothstep(
      0.010,
      0.052,
      edgeA
    );

  float haloB =
    1.0 -
    smoothstep(
      0.040,
      0.220,
      edgeB
    );

  float coreB =
    1.0 -
    smoothstep(
      0.009,
      0.048,
      edgeB
    );

  /*
   * Break the lines up slightly so every border does
   * not have identical brightness.
   */
  float breakupA =
    0.5 +
    0.5 *
    sin(
      warped.x * 1.18 +
      warped.y * 1.73 +
      uTime * 0.21
    );

  float breakupB =
    0.5 +
    0.5 *
    cos(
      warped.x * 0.71 -
      warped.y * 1.31 -
      uTime * 0.16
    );

  float breakup =
    0.42 +
    0.58 *
    smoothstep(
      0.18,
      0.86,
      breakupA * 0.62 +
      breakupB * 0.38
    );

  /*
   * Surface sharpness follows the light sources.
   * Away from the rays we mostly see a broad, soft
   * cyan refraction. Directly under the bright ray
   * origins the narrow white caustic edges emerge.
   */
  float rayFocusLeft =
    exp(
      -pow(
        (vUv.x - 0.33) / 0.095,
        2.0
      )
    );

  float rayFocusCenter =
    exp(
      -pow(
        (vUv.x - 0.515) / 0.105,
        2.0
      )
    );

  float rayFocusRight =
    exp(
      -pow(
        (vUv.x - 0.695) / 0.095,
        2.0
      )
    );

  float rayFocus =
    clamp(
      max(
        rayFocusCenter,
        max(
          rayFocusLeft,
          rayFocusRight
        )
      ),
      0.0,
      1.0
    );

  /*
   * Keep the focused highlights strongest close to
   * the actual ceiling and let them soften rapidly
   * as the surface recedes downward.
   */
  rayFocus *=
    1.0 -
    smoothstep(
      0.34,
      0.92,
      depth
    );

  float softNetwork =
    haloA * 0.70 +
    haloB * 0.34;

  float sharpNetwork =
    (
      coreA *
      breakup *
      0.66 +
      coreB *
      breakup *
      0.22
    ) *
    rayFocus;

  float hotSpot =
    coreA *
    coreB *
    rayFocus;

  /*
   * The target is brightest around the upper middle,
   * while the outer edges stay more blue.
   */
  float centerGlow =
    exp(
      -pow(
        (vUv.x - 0.52) / 0.30,
        2.0
      )
    );

  float horizonGlow =
    exp(
      -pow(
        (depth - 0.17) / 0.24,
        2.0
      )
    );

  float ceilingFill =
    surfaceMask *
    (
      0.055 +
      centerGlow *
      horizonGlow *
      0.11
    );

  float shimmer =
    0.92 +
    sin(
      uTime * 0.38 +
      warped.x * 0.63 +
      warped.y * 0.81
    ) *
    0.08;

  float networkAlpha =
    (
      softNetwork *
      mix(
        0.18,
        0.40,
        rayFocus
      ) +
      sharpNetwork * 0.52 +
      hotSpot * 0.46
    ) *
    surfaceMask *
    shimmer;

  float alpha =
    clamp(
      ceilingFill +
      networkAlpha,
      0.0,
      0.88
    );

  vec3 deepCyan =
    vec3(
      0.00,
      0.48,
      0.92
    );

  vec3 glowCyan =
    vec3(
      0.20,
      0.88,
      1.00
    );

  vec3 warmWhite =
    vec3(
      0.91,
      1.00,
      1.00
    );

  vec3 color =
    mix(
      deepCyan,
      glowCyan,
      clamp(
        softNetwork * 0.56 +
        centerGlow * 0.16,
        0.0,
        1.0
      )
    );

  color =
    mix(
      color,
      warmWhite,
      clamp(
        sharpNetwork * 0.56 +
        hotSpot * 0.82,
        0.0,
        0.86
      )
    );

  gl_FragColor =
    vec4(
      color,
      alpha
    );
}
`,
    });

  const surface =
    new THREE.Mesh(
      geometry,
      material,
    );

  /*
   * The vertex shader is screen-space, so normal
   * frustum calculations are irrelevant.
   */
  surface.frustumCulled =
    false;

  /*
   * Transparent objects with larger renderOrder values
   * are rendered later. This intentionally places the
   * water overlay over the normal aquarium scene.
   */
  surface.renderOrder =
    10000;

  scene.add(surface);


  /*
   * ANIMATED SUNLIGHT SHAFTS
   *
   * A second screen-space pass sits behind the surface
   * highlights. Wide, soft shafts originate at the top
   * and fade before reaching the seabed. Their positions,
   * widths and intensity drift slowly so they feel tied
   * to moving surface refraction rather than spotlights.
   */
  const rayGeometry =
    new THREE.PlaneGeometry(
      2,
      2,
    );

  const rayMaterial =
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,

      blending:
      THREE.AdditiveBlending,

      toneMapped: false,

      uniforms: {
        uTime: {
          value: 0,
        },

        uAspect: {
          value: 1,
        },
      },

      vertexShader: `
varying vec2 vUv;

void main() {
  vUv = uv;

  gl_Position =
    vec4(
      position.xy,
      0.0,
      1.0
    );
}
`,

      fragmentShader: `
varying vec2 vUv;

uniform float uTime;
uniform float uAspect;

/*
 * One soft ray. The width grows with depth,
 * and two nearby lobes keep it from reading
 * as a perfect spotlight cone.
 */
float ray(
  vec2 uv,
  float origin,
  float lean,
  float width,
  float phase,
  float strength
) {
  float y =
    1.0 - uv.y;

  float drift =
    sin(
      uTime * 0.055 +
      phase
    ) *
    0.008;

  float center =
    origin +
    lean * y +
    drift;

  float localWidth =
    width *
    (
      0.22 +
      y * 1.25
    );

  float wobble =
    sin(
      y * 10.0 +
      phase +
      uTime * 0.09
    ) *
    localWidth *
    0.09;

  float d =
    abs(
      uv.x -
      center -
      wobble
    );

  float primary =
    1.0 -
    smoothstep(
      localWidth * 0.08,
      localWidth,
      d
    );

  float secondary =
    1.0 -
    smoothstep(
      localWidth * 0.06,
      localWidth * 0.62,
      abs(
        uv.x -
        center -
        localWidth * 0.46
      )
    );

  float shape =
    primary * 0.82 +
    secondary * 0.18;

  shape =
    pow(
      max(shape, 0.0),
      1.55
    );

  /*
   * Bright immediately below the surface,
   * then disappear well before the sand.
   */
  float vertical =
    smoothstep(
      0.012,
      0.060,
      y
    ) *
    (
      1.0 -
      smoothstep(
        0.30,
        0.62,
        y
      )
    );

  float shimmer =
    0.90 +
    sin(
      uTime * 0.20 +
      phase +
      y * 7.0
    ) *
    0.10;

  return
  shape *
  vertical *
  shimmer *
  strength;
}

void main() {
  /*
   * Three clustered sources rather than a row
   * of independent spotlights.
   */
  float leftCluster =
    ray(
      vUv,
      0.31,
      0.105,
      0.050,
      0.5,
      0.26
    ) +
    ray(
      vUv,
      0.345,
      0.082,
      0.028,
      1.4,
      0.12
    );

  float centerCluster =
    ray(
      vUv,
      0.50,
      0.025,
      0.062,
      2.6,
      0.31
    ) +
    ray(
      vUv,
      0.535,
      -0.012,
      0.031,
      3.5,
      0.13
    );

  float rightCluster =
    ray(
      vUv,
      0.68,
      -0.105,
      0.050,
      4.5,
      0.23
    ) +
    ray(
      vUv,
      0.715,
      -0.078,
      0.027,
      5.2,
      0.10
    );

  float light =
    leftCluster +
    centerCluster +
    rightCluster;

  /*
   * Slight center emphasis mirrors the brighter
   * ceiling area in the reference.
   */
  float centerBias =
    0.84 +
    0.16 *
    exp(
      -pow(
        (vUv.x - 0.51) / 0.34,
        2.0
      )
    );

  light *=
    centerBias;

  vec3 rayColor =
    mix(
      vec3(
        0.12,
        0.68,
        1.0
      ),
      vec3(
        0.72,
        0.98,
        1.0
      ),
      clamp(
        light * 2.4,
        0.0,
        1.0
      )
    );

  gl_FragColor =
    vec4(
      rayColor,
      clamp(
        light,
        0.0,
        0.15
      )
    );
}
`,
    });

  const rays =
    new THREE.Mesh(
      rayGeometry,
      rayMaterial,
    );

  rays.frustumCulled =
    false;

  /*
   * Rays render after the aquarium but before the bright
   * surface layer, so the surface remains the visual source.
   */
  rays.renderOrder =
    9999;

  scene.add(rays);

  const setAspect = (
    camera: THREE.PerspectiveCamera,
  ) => {
    material.uniforms
      .uAspect.value =
      camera.aspect;

    rayMaterial.uniforms
      .uAspect.value =
      camera.aspect;
  };

  const setCamera = (
    camera: THREE.PerspectiveCamera,
  ) => {
    setAspect(camera);
  };

  const resize = (
    camera: THREE.PerspectiveCamera,
  ) => {
    setAspect(camera);
  };

  const update = (
    _deltaTime: number,
    elapsed: number,
  ) => {
    material.uniforms
      .uTime.value =
      elapsed;

    rayMaterial.uniforms
      .uTime.value =
      elapsed;
  };

  const destroy = () => {
    scene.remove(surface);
    scene.remove(rays);

    geometry.dispose();
    material.dispose();

    rayGeometry.dispose();
    rayMaterial.dispose();
  };

  return {
    setCamera,
    resize,
    update,
    destroy,
  };
}
