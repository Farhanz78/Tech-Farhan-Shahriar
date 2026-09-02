'use client';

import { useEffect, useRef } from 'react';

/**
 * Hero background scene.
 *
 * Plain three.js rather than react-three-fiber: this is one self-contained
 * scene, so the R3F + drei reconciler (~150 KB gzipped on top of three) would
 * buy nothing here. The whole module is lazy-loaded by HeroCanvas so it never
 * blocks first paint, and it bails out entirely on devices that should not run
 * it -- see shouldRender3D below.
 *
 * The scene: a slowly rotating icosahedral wireframe lattice with a second
 * inner solid, lit from two sides in the site's lime/amber accents. It reacts
 * to the pointer with damped parallax and drifts on its own when idle, so it
 * never looks frozen. Geometry is procedural -- no downloaded model assets.
 */

export function shouldRender3D(): boolean {
  if (typeof window === 'undefined') return false;

  // Check WebGL availability
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import('three');
      if (disposed || !mountRef.current) return;

      const width = mount.clientWidth;
      const height = mount.clientHeight;

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0, 8.5);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      // Cap DPR at 2: beyond that the pixel cost doubles for no visible gain.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mount.appendChild(renderer.domElement);

      const group = new THREE.Group();
      const updateLayout = (w: number) => {
        const offsetX = w < 900 ? 0.9 : 2.1;
        group.position.set(offsetX, 0.35, 0);
        group.scale.setScalar(1.0);
      };
      updateLayout(width);
      scene.add(group);

      // Outer wireframe shell.
      const shellGeo = new THREE.IcosahedronGeometry(2.35, 1);
      const shellMat = new THREE.MeshBasicMaterial({
        color: 0xc4f82a,
        wireframe: true,
        transparent: true,
        opacity: 0.22,
      });
      group.add(new THREE.Mesh(shellGeo, shellMat));

      // Inner solid, faceted so the two lights read as distinct planes.
      const coreGeo = new THREE.IcosahedronGeometry(1.5, 0);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x14181c,
        roughness: 0.35,
        metalness: 0.65,
        flatShading: true,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      // Sparse point field for depth. Kept low so it stays cheap.
      const starCount = 220;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 4.5 + Math.random() * 5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.035,
        transparent: true,
        opacity: 0.5,
      });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);

      const limeLight = new THREE.DirectionalLight(0xc4f82a, 3.2);
      limeLight.position.set(-4, 3, 4);
      scene.add(limeLight);

      const amberLight = new THREE.DirectionalLight(0xffb020, 2.0);
      amberLight.position.set(5, -2, 2);
      scene.add(amberLight);

      scene.add(new THREE.AmbientLight(0xffffff, 0.35));

      // --- interaction -----------------------------------------------------
      const pointer = { x: 0, y: 0 };
      const target = { x: 0, y: 0 };

      const onPointerMove = (e: PointerEvent) => {
        target.x = (e.clientX / window.innerWidth) * 2 - 1;
        target.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches && e.touches.length > 0) {
          target.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
          target.y = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
        }
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });

      const onResize = () => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth || window.innerWidth;
        const h = mountRef.current.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        updateLayout(w);
      };
      window.addEventListener('resize', onResize);

      // Stop rendering entirely when the hero scrolls out of view or the tab is
      // hidden. A permanently running WebGL loop is the most common reason a
      // portfolio drains a phone battery.
      let visible = true;
      const io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
        },
        { threshold: 0 },
      );
      io.observe(mount);

      const onVisibility = () => {
        visible = document.visibilityState === 'visible' && visible;
      };
      document.addEventListener('visibilitychange', onVisibility);

      let raf = 0;
      const clock = new THREE.Clock();

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible || document.hidden) return;

        const t = clock.getElapsedTime();

        // Damped pointer follow, so it glides instead of snapping.
        pointer.x += (target.x - pointer.x) * 0.045;
        pointer.y += (target.y - pointer.y) * 0.045;

        group.rotation.y = t * 0.16 + pointer.x * 0.5;
        group.rotation.x = Math.sin(t * 0.22) * 0.14 + pointer.y * 0.32;
        core.rotation.y = -t * 0.28;
        core.rotation.z = Math.sin(t * 0.35) * 0.16;
        stars.rotation.y = t * 0.02;

        renderer.render(scene, camera);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        shellGeo.dispose();
        shellMat.dispose();
        coreGeo.dispose();
        coreMat.dispose();
        starGeo.dispose();
        starMat.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
