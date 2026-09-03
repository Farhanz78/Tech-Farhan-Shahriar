'use client';

import { useEffect, useRef } from 'react';

/**
 * =============================================================================
 *  HERO SCENE — "deep field"
 * =============================================================================
 *
 * Replaces the earlier rotating icosahedron. Three layers, back to front:
 *
 *   1. A drifting particle volume (~5k points) in cold teal, with roughly one
 *      point in fourteen burning lime. Movement comes from 3D simplex noise
 *      evaluated in the vertex shader, so nothing is animated on the CPU.
 *   2. A displaced core — an icosahedron whose vertices are pushed along their
 *      normals by the same noise field, shaded with a fresnel rim so it reads
 *      as an energy shell rather than a solid object.
 *   3. A wider lime lattice around it, displaced by the same field at a
 *      different frequency, which is what gives the parallax between shells.
 *
 * Scroll dollies the camera INTO the field while the noise amplitude rises, so
 * the scene opens up as the reader moves toward Services instead of just
 * sliding away.
 *
 * WHY PLAIN three.js, STILL
 * One self-contained scene. react-three-fiber's reconciler would add ~150 KB
 * gzipped on top of three for no benefit here. No post-processing pass either:
 * EffectComposer means a second render target, more VRAM and another thing that
 * can fail on an unusual driver. The glow is done with additive blending and a
 * fresnel term, which costs nothing and cannot fail.
 *
 * THE FAILURE RULE
 * The whole build is wrapped so that ANY error -- a shader that will not
 * compile on some driver, a lost context, a missing extension -- removes the
 * canvas and leaves HeroCanvas's CSS gradient showing. The hero must never be a
 * blank rectangle. The site owner cannot read a console.
 */

/* ------------------------------------------------------------------ gating */

export function shouldRender3D(): boolean {
  if (typeof window === 'undefined') return false;

  // Data Saver on: the visitor has asked every site to be cheaper.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;

  // Two cores or fewer is a phone that will drop frames on everything else on
  // the page while this runs.
  if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2) {
    return false;
  }

  // deviceMemory is Chromium-only and absent elsewhere; only act when present.
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem <= 2) return false;

  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ shaders */

/**
 * Ashima / Stefan Gustavson simplex noise, 3D. Public domain (MIT).
 * Shared verbatim by both shaders below rather than duplicated, so the two
 * layers are guaranteed to be moving through the SAME field -- that coherence
 * is what makes the shells look related instead of independently wobbly.
 */
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    + i.y+vec4(0.0,i1.y,i2.y,1.0))
    + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const PARTICLE_VERT = /* glsl */ `
uniform float uTime;
uniform float uScroll;
uniform float uPixelRatio;
uniform vec2  uMouse;
attribute float aScale;
attribute float aSeed;
varying float vFade;
varying float vSpark;
${SIMPLEX}
void main() {
  vec3 p = position;
  float t = uTime * 0.055;

  // Two offset noise samples approximate a curl: the field swirls instead of
  // every point sliding the same way, which is what "drifting" looks like.
  float n1 = snoise(p * 0.14 + vec3(0.0, 0.0, t));
  float n2 = snoise(p * 0.19 + vec3(4.7, 2.1, t));
  p += vec3(n1, n2, n1 * n2) * (1.15 + uScroll * 0.9);

  // A slow individual bob so points at rest still breathe.
  p.y += sin(t * 3.1 + aSeed * 6.2831) * 0.28;

  // Mouse pushes the field, gently, and further for nearer points.
  p.xy += uMouse * (0.55 + aSeed * 0.5);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;

  // Fade at both ends: distant points dissolve into the background, and points
  // that come very close to the camera fade out instead of becoming huge
  // blurred discs across the screen.
  vFade = smoothstep(34.0, 9.0, dist) * smoothstep(1.2, 4.0, dist);

  // Lime sparks are RARE on purpose -- about one point in thirty. At one in
  // fourteen the field read as green confetti rather than a cold volume with
  // occasional heat in it.
  vSpark = step(0.966, aSeed);

  // 90, not 150. At the larger figure the near points became fat bokeh discs
  // that sat on top of the headline and made it unreadable.
  gl_PointSize = aScale * uPixelRatio * (90.0 / max(dist, 0.001));
  gl_Position = projectionMatrix * mv;
}`;

const PARTICLE_FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uTeal;
uniform vec3 uLime;
varying float vFade;
varying float vSpark;
void main() {
  // Round the square point sprite off and give it a soft falloff.
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float a = pow(smoothstep(0.5, 0.0, d), 2.4);

  vec3 col = mix(uTeal, uLime, vSpark);
  // Additive blending stacks: what looks reasonable for one point is glare
  // where twenty overlap. These are deliberately low.
  float strength = mix(0.42, 0.85, vSpark);
  gl_FragColor = vec4(col, a * vFade * strength);
}`;

const CORE_VERT = /* glsl */ `
uniform float uTime;
uniform float uScroll;
uniform float uAmp;
uniform float uFreq;
varying vec3  vNormal;
varying vec3  vView;
varying float vNoise;
${SIMPLEX}
void main() {
  float t = uTime * 0.22;
  float n  = snoise(normal * uFreq + vec3(0.0, 0.0, t));
  float n2 = snoise(normal * (uFreq * 2.3) + vec3(t * 0.6, 0.0, 0.0));

  // Scroll deepens the displacement, so the form becomes more agitated as the
  // reader moves down rather than just shrinking away.
  float disp = (n * 0.62 + n2 * 0.22) * uAmp * (1.0 + uScroll * 0.85);
  vNoise = disp;

  vec3 p = position + normal * disp;
  vNormal = normalize(normalMatrix * normal);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const CORE_FRAG = /* glsl */ `
precision mediump float;
uniform vec3  uTeal;
uniform vec3  uLime;
uniform float uRim;
uniform float uAlpha;
varying vec3  vNormal;
varying vec3  vView;
varying float vNoise;
void main() {
  // Fresnel: bright where the surface turns away from the camera. This is what
  // makes it read as a shell of energy rather than a lit solid, and it needs no
  // lights in the scene at all.
  float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), uRim);

  // Only the SHARPEST ridges tip toward lime. The first version opened this at
  // 0.02 and most of the surface cleared it, so the whole core rendered as a
  // yellow-green blob instead of a cold shell with hot edges.
  vec3 col = mix(uTeal, uLime, smoothstep(0.26, 0.60, vNoise));

  // No additive constant term. The +0.05 that used to be here filled the whole
  // silhouette with light, which is what put a glowing mass behind the H1.
  gl_FragColor = vec4(col * fres * 1.15, clamp(fres * uAlpha, 0.0, 1.0));
}`;

/* -------------------------------------------------------------------- scene */

export default function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const THREE = await import('three');
        if (disposed || !mountRef.current) return;

        const width = mount.clientWidth || window.innerWidth;
        const height = mount.clientHeight || window.innerHeight;

        // One budget decision, read once, used everywhere below.
        const narrow = width < 900;
        const cores = navigator.hardwareConcurrency ?? 8;
        const light = narrow || cores <= 4;

        const TEAL = new THREE.Color('#2ee6c5');
        const TEAL_DEEP = new THREE.Color('#0e7f7a');
        const LIME = new THREE.Color('#c4f82a');

        const scene = new THREE.Scene();
        // Fog is the budget: it hides the far edge of the particle volume so the
        // volume can simply stop existing back there instead of being drawn.
        scene.fog = new THREE.FogExp2(0x0b0c0e, 0.032);

        const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 90);
        const camBaseZ = narrow ? 15 : 13;
        camera.position.set(0, 0, camBaseZ);

        const renderer = new THREE.WebGLRenderer({
          antialias: !light,
          alpha: true,
          powerPreference: 'high-performance',
        });
        renderer.setSize(width, height);
        const dpr = Math.min(window.devicePixelRatio, light ? 1.5 : 2);
        renderer.setPixelRatio(dpr);
        mount.appendChild(renderer.domElement);

        // Everything hangs off this so the whole scene can be offset to the
        // side of the headline without moving the camera.
        const world = new THREE.Group();
        scene.add(world);

        const layout = (w: number) => {
          const n = w < 900;
          // 4.6, not 2.4. The visible width at the core's depth is about 19
          // world units on a 16:9 desktop, so 2.4 moved the form only ~12% of
          // the way right -- still directly behind the headline. 4.6 clears the
          // text column and leaves the form in the empty right half.
          // On narrow screens there IS no empty half, so it centres and shrinks
          // instead, and the scrim carries the legibility.
          world.position.set(n ? 0 : 4.6, n ? 0.2 : 0.45, 0);
          world.scale.setScalar(n ? 0.78 : 1);
        };
        layout(width);

        /* ---------------------------------------------------- particle field */

        const COUNT = light ? 2200 : 5200;
        const pos = new Float32Array(COUNT * 3);
        const scl = new Float32Array(COUNT);
        const seed = new Float32Array(COUNT);

        for (let i = 0; i < COUNT; i++) {
          // Points are placed in a flattened shell, not a solid ball: a solid
          // ball puts most of its points where they are hidden behind the core,
          // which costs fill rate and shows nothing.
          const r = 5.5 + Math.pow(Math.random(), 0.6) * 13;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          pos[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 1.25;
          pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.75;
          pos[i * 3 + 2] = r * Math.cos(phi);
          scl[i] = 0.5 + Math.random() * 1.8;
          seed[i] = Math.random();
        }

        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        pGeo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
        pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

        const pMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uScroll: { value: 0 },
            uPixelRatio: { value: dpr },
            uMouse: { value: new THREE.Vector2() },
            uTeal: { value: TEAL },
            uLime: { value: LIME },
          },
          vertexShader: PARTICLE_VERT,
          fragmentShader: PARTICLE_FRAG,
          transparent: true,
          depthWrite: false,
          // Additive is what makes overlapping points build into a glow. It
          // also means the layer can never darken anything behind it, so it is
          // safe to draw last.
          blending: THREE.AdditiveBlending,
        });

        const points = new THREE.Points(pGeo, pMat);
        points.renderOrder = 2;
        world.add(points);

        /* ------------------------------------------------------------- core */

        const coreGeo = new THREE.IcosahedronGeometry(2.6, light ? 24 : 48);
        const coreMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uScroll: { value: 0 },
            // Amplitude is what stops this reading as "a sphere". At 0.42 the
            // silhouette stayed round; 0.55 lets the noise actually deform it,
            // which is the difference between a wireframe ball and something
            // that looks alive.
            uAmp: { value: 0.55 },
            uFreq: { value: 1.5 },
            // Rim exponent confines the glow to the silhouette edge; at 2.6 the
            // falloff was wide enough to light the whole face. The scrim in
            // HeroCanvas now guarantees the headline's legibility, so the core
            // can be bright enough to actually be seen.
            uRim: { value: 2.9 },
            uAlpha: { value: 1.15 },
            uTeal: { value: TEAL_DEEP },
            uLime: { value: LIME },
          },
          vertexShader: CORE_VERT,
          fragmentShader: CORE_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.renderOrder = 1;
        world.add(core);

        /* ---------------------------------------------------- lattice shell */

        const shellGeo = new THREE.IcosahedronGeometry(4.1, light ? 2 : 3);
        const shellMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uScroll: { value: 0 },
            // A different frequency and amplitude from the core, over the same
            // noise field: related motion, not identical motion. Identical is
            // what makes two shells look like one object with a fat outline.
            uAmp: { value: 0.85 },
            uFreq: { value: 0.85 },
            uRim: { value: 1.9 },
            uAlpha: { value: 0.30 },
            uTeal: { value: TEAL },
            // NOT lime. The shell has a large displacement amplitude, so most
            // of its surface clears the lime threshold in the shared fragment
            // shader -- feeding it LIME turned the entire lattice yellow-green
            // and the scene stopped reading as teal at all. A cold cyan
            // highlight keeps the lattice in one family, and leaves lime as
            // something only the core does.
            uLime: { value: new THREE.Color('#7ef9e4') },
          },
          vertexShader: CORE_VERT,
          fragmentShader: CORE_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          wireframe: true,
        });
        const shell = new THREE.Mesh(shellGeo, shellMat);
        shell.renderOrder = 0;
        world.add(shell);

        /* ------------------------------------------------------ interaction */

        const mouse = new THREE.Vector2();
        const mouseTarget = new THREE.Vector2();

        const onPointerMove = (e: PointerEvent) => {
          mouseTarget.set(
            (e.clientX / window.innerWidth) * 2 - 1,
            -((e.clientY / window.innerHeight) * 2 - 1),
          );
        };
        window.addEventListener('pointermove', onPointerMove, { passive: true });

        const onResize = () => {
          const el = mountRef.current;
          if (!el) return;
          const w = el.clientWidth || window.innerWidth;
          const h = el.clientHeight || window.innerHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          layout(w);
        };
        window.addEventListener('resize', onResize);

        // Stop rendering when the hero is off-screen or the tab is hidden. A
        // WebGL loop that never stops is the single most common reason a
        // portfolio drains a phone battery.
        let onScreen = true;
        const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }, {
          threshold: 0,
        });
        io.observe(mount);

        // A lost GPU context must not leave a frozen half-drawn canvas on the
        // page. Hide the canvas and let the CSS gradient behind it take over.
        const onContextLost = (e: Event) => {
          e.preventDefault();
          renderer.domElement.style.display = 'none';
        };
        renderer.domElement.addEventListener('webglcontextlost', onContextLost);

        /* ------------------------------------------------------------- loop */

        // Reduced motion: draw the scene once, beautifully, and never animate.
        // Removing it entirely would be the easy read of the preference and the
        // wrong one -- the visitor asked for less MOTION, not less design.
        const still =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const clock = new THREE.Clock();
        let raf = 0;
        let scroll = 0;

        const render = () => {
          const t = clock.getElapsedTime();

          // Scroll progress is read from the element's own box rather than
          // passed in from GSAP. One source of truth, and it cannot desync from
          // the wrapper's parallax.
          const rect = mount.getBoundingClientRect();
          const raw = -rect.top / Math.max(rect.height, 1);
          const targetScroll = Math.min(Math.max(raw, 0), 1);
          scroll += (targetScroll - scroll) * 0.08;

          mouse.lerp(mouseTarget, 0.04);

          pMat.uniforms.uTime.value = t;
          pMat.uniforms.uScroll.value = scroll;
          pMat.uniforms.uMouse.value.copy(mouse);

          coreMat.uniforms.uTime.value = t;
          coreMat.uniforms.uScroll.value = scroll;
          shellMat.uniforms.uTime.value = t;
          shellMat.uniforms.uScroll.value = scroll;

          world.rotation.y = t * 0.045 + mouse.x * 0.28;
          world.rotation.x = Math.sin(t * 0.12) * 0.07 + mouse.y * 0.16;
          shell.rotation.z = -t * 0.03;
          points.rotation.y = -t * 0.012;

          // Dolly toward the field as the hero scrolls past.
          camera.position.z = camBaseZ - scroll * 4.2;
          camera.position.y = scroll * 0.9;

          renderer.render(scene, camera);
        };

        const tick = () => {
          raf = requestAnimationFrame(tick);
          if (!onScreen || document.hidden) return;
          render();
        };

        if (still) {
          render();
        } else {
          tick();
        }

        cleanup = () => {
          cancelAnimationFrame(raf);
          io.disconnect();
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('resize', onResize);
          renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
          pGeo.dispose();
          pMat.dispose();
          coreGeo.dispose();
          coreMat.dispose();
          shellGeo.dispose();
          shellMat.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode === mount) {
            mount.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        // Shader compile failure, missing extension, exhausted context -- any of
        // it. Leave the gradient showing and say so once, for whoever is
        // reading a console. Never a blank hero.
        console.warn('[hero3d] scene disabled:', err);
        mount.querySelector('canvas')?.remove();
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
