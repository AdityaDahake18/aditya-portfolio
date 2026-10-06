/**
 * ============================================================================
 * ADITYA DAHAKE PORTFOLIO — 3D HUMANOID ENGINE (Three.js + GSAP ScrollTrigger)
 * Models: assets/models/unitree_g1.glb (Unitree G1) / assets/models/xbot.glb
 * Features: PBR lighting, soft contact shadow, drag-to-rotate inertia,
 *           scroll-driven camera & model choreography, auto-pause offscreen.
 * ============================================================================
 */

(function () {
  'use strict';

  const stageWrap = document.getElementById('stage-wrap');
  const canvas = document.getElementById('stage-canvas');
  const overlay = document.getElementById('stage-overlay');

  if (!stageWrap || !canvas) return;

  // WebGL Support Check
  function isWebGLAvailable() {
    try {
      const testCanvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
        (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  if (!isWebGLAvailable()) {
    stageWrap.classList.add('webgl-failed');
    return;
  }

  // Scene & Core Three.js Objects
  let scene, camera, renderer;
  let robotRoot = null;
  let robotPivot = null;
  let mixer = null;
  let actions = {};
  let activeAction = null;
  let currentAnimName = 'idle';
  let isPaused = false;
  let clock = new THREE.Clock();

  // Visual Atmosphere Objects
  let holoPedestal = null;
  let holoParticles = null;
  let corePointLight = null;
  let mouseTarget = { x: 0, y: 0 };

  // Drag Interaction State
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let dragVelocity = 0;
  let manualRotationY = 0;
  let baseScrollRotationY = 0;
  let hasInteracted = false;

  // Models priority
  const MODEL_PRIMARY = 'assets/models/xbot.glb';
  const MODEL_FALLBACK = 'assets/models/unitree_g1.glb';

  function initEngine() {
    // 1. Scene setup
    scene = new THREE.Scene();

    // 2. Camera setup with intelligent framing
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    // 3. Pivot group for smooth rotations
    robotPivot = new THREE.Group();
    scene.add(robotPivot);

    // 4. Renderer setup
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      console.warn('WebGL initialization failed:', err);
      stageWrap.classList.add('webgl-failed');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.outputEncoding = THREE.sRGBEncoding;

    updateDimensions();

    // 5. Lighting Rig (PBR, Soft Ground, Dynamic Core & Rim)
    setupLighting();

    // 6. Contact Shadow Plane & Holographic Pedestal
    setupContactShadow();
    setupHoloPedestal();

    // 7. Ambient Cyber Data Particles
    setupHoloParticles();

    // 8. Load Humanoid Model
    loadHumanoidModel();

    // 9. Event Listeners & Interaction Parallax
    setupInteractionEvents();
    setupScrollChoreography();

    // 10. Lifecycle & Performance Monitors
    setupPerformanceMonitors();

    // 11. Start Render Loop
    requestAnimationFrame(renderLoop);
  }

  function updateDimensions() {
    if (!stageWrap || !camera || !renderer) return;
    const width = stageWrap.clientWidth || window.innerWidth * 0.5;
    const height = stageWrap.clientHeight || window.innerHeight;
    const aspect = width / height;

    camera.aspect = aspect;

    // Adjust camera distance based on aspect ratio so robot is always fully framed
    if (aspect > 1.2) {
      // Wide format (like mobile sticky strip ~35vh)
      camera.position.set(0, 0.95, 4.4);
    } else {
      // Tall/Square format (desktop 50vw panel)
      camera.position.set(0, 1.05, 3.8);
    }
    camera.lookAt(0, 0.92, 0);
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  }

  function setupLighting() {
    // Ambient light (Deep sapphire fill)
    const ambientLight = new THREE.AmbientLight(0x18263e, 1.8);
    scene.add(ambientLight);

    // Key Light (Crisp directional white from top-front-left)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(2.5, 4.5, 3.5);
    scene.add(keyLight);

    // Fill Light (Cool steel blue from opposite side)
    const fillLight = new THREE.DirectionalLight(0x4070a8, 1.5);
    fillLight.position.set(-3.5, 1.5, 2.5);
    scene.add(fillLight);

    // Rim Light (Sharp high-tech cyan back-light)
    const rimLight = new THREE.DirectionalLight(0x00e5ff, 3.2);
    rimLight.position.set(0, 3.5, -3.5);
    scene.add(rimLight);

    // Bottom bounce light
    const bounceLight = new THREE.DirectionalLight(0x0c1e34, 1.2);
    bounceLight.position.set(0, -2, 2);
    scene.add(bounceLight);

    // Dynamic Core Point Light (pulsing chest glow)
    corePointLight = new THREE.PointLight(0x00e5ff, 2.4, 3.5);
    corePointLight.position.set(0, 1.3, 0.45);
    scene.add(corePointLight);
  }

  function setupContactShadow() {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const ctx = shadowCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(2.6, 2.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.75
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.005;
    scene.add(shadowMesh);
  }

  function setupHoloPedestal() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 512;
    pCanvas.height = 512;
    const ctx = pCanvas.getContext('2d');
    const cx = 256, cy = 256;

    ctx.clearRect(0, 0, 512, 512);

    // Outer thin calibration boundary
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 240, 0, Math.PI * 2);
    ctx.stroke();

    // Outer dashed telemetry track
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.arc(cx, cy, 218, 0, Math.PI * 2);
    ctx.stroke();

    // Middle degree tick marks
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 36; i++) {
      const angle = (i * 10) * Math.PI / 180;
      const r1 = (i % 3 === 0) ? 190 : 198;
      const r2 = 208;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
      ctx.stroke();
    }

    // Inner glowing sensor ring
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 168, 0, Math.PI * 2);
    ctx.stroke();

    // Central alignment crosshairs
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 145, cy);
    ctx.lineTo(cx - 30, cy);
    ctx.moveTo(cx + 30, cy);
    ctx.lineTo(cx + 145, cy);
    ctx.moveTo(cx, cy - 145);
    ctx.lineTo(cx, cy - 30);
    ctx.moveTo(cx, cy + 30);
    ctx.lineTo(cx, cy + 145);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(pCanvas);
    const geo = new THREE.PlaneGeometry(2.4, 2.4);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    holoPedestal = new THREE.Mesh(geo, mat);
    holoPedestal.rotation.x = -Math.PI / 2;
    holoPedestal.position.y = 0.012; // Elevated slightly above dark shadow
    scene.add(holoPedestal);
  }

  function setupHoloParticles() {
    const count = 90;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vels = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 0.4 + Math.random() * 1.35;
      pos[i * 3] = Math.cos(angle) * dist;
      pos[i * 3 + 1] = Math.random() * 2.2;
      pos[i * 3 + 2] = Math.sin(angle) * dist;
      vels[i] = 0.002 + Math.random() * 0.003;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(0, 229, 255, 1)');
    grad.addColorStop(0.35, 'rgba(0, 229, 255, 0.65)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 32, 32);

    const pTex = new THREE.CanvasTexture(pCanvas);
    const pMat = new THREE.PointsMaterial({
      size: 0.045,
      map: pTex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    holoParticles = new THREE.Points(geo, pMat);
    holoParticles.userData = { vels: vels };
    scene.add(holoParticles);
  }

  function loadHumanoidModel() {
    const loader = new THREE.GLTFLoader();

    // Use Draco decoder if available
    if (window.THREE && THREE.DRACOLoader) {
      const dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(dracoLoader);
    }

    loader.load(
      MODEL_PRIMARY,
      function (gltf) {
        onModelLoaded(gltf, true);
      },
      undefined,
      function (err) {
        console.warn('Unitree G1 model load failed, falling back to Xbot...', err);
        loader.load(
          MODEL_FALLBACK,
          function (gltf) {
            onModelLoaded(gltf, false);
          },
          undefined,
          function (error) {
            console.error('All 3D models failed to load:', error);
            stageWrap.classList.add('webgl-failed');
          }
        );
      }
    );
  }

  function onModelLoaded(gltf) {
    robotRoot = gltf.scene;

    let hasSkinnedMesh = false;
    robotRoot.traverse(function (child) {
      if (child.isSkinnedMesh) hasSkinnedMesh = true;
    });

    const isG1 = !hasSkinnedMesh;

    // Materials for rigid robot links & skinned meshes
    const whiteArmorMat = new THREE.MeshStandardMaterial({
      color: 0xebf2fa,
      metalness: 0.2,
      roughness: 0.28,
      skinning: true
    });

    const darkChassisMat = new THREE.MeshStandardMaterial({
      color: 0x141b27,
      metalness: 0.88,
      roughness: 0.22,
      skinning: true
    });

    const cyanAccentMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      skinning: true
    });

    // Apply materials and cast shadows
    let meshIndex = 0;
    robotRoot.traverse(function (child) {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (isG1) {
          // Style Unitree G1 robot links
          const name = (child.name || '').toLowerCase();
          if (name.includes('head') || name.includes('torso') || name.includes('pelvis') || (meshIndex % 3 === 0)) {
            child.material = whiteArmorMat;
          } else if (meshIndex % 7 === 0) {
            child.material = cyanAccentMat;
          } else {
            child.material = darkChassisMat;
          }
        } else {
          // Style Xbot humanoid robot meshes
          if (meshIndex === 0) {
            child.material = whiteArmorMat;
          } else {
            child.material = darkChassisMat;
          }
        }
        meshIndex++;
      }
    });

    // Normalize and scale robot to fit scene
    if (isG1) {
      robotRoot.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(robotRoot);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetHeight = 1.82; // Human scale
      const scaleFactor = targetHeight / (maxDim || 1);

      robotRoot.scale.setScalar(scaleFactor);

      // Recompute after scaling
      robotRoot.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(robotRoot);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

      robotRoot.position.x = -scaledCenter.x;
      robotRoot.position.y = -scaledBox.min.y; // Align feet with ground y=0
      robotRoot.position.z = -scaledCenter.z;
    } else {
      // Skinned humanoid mesh: authored in meters (1.81m, feet at ground y=0)
      robotRoot.position.set(0, 0, 0);
      robotRoot.scale.set(1, 1, 1);
    }

    robotPivot.add(robotRoot);

    // 9. Skeletal Animation Mixer Setup & Clip Registry
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(robotRoot);
      gltf.animations.forEach(function (clip) {
        actions[clip.name] = mixer.clipAction(clip);
      });

      // Default to natural idle pose
      if (actions['idle']) {
        activeAction = actions['idle'];
        activeAction.play();
        currentAnimName = 'idle';
      }
    }
  }

  function fadeToAction(name, duration) {
    if (typeof duration !== 'number') duration = 0.6;
    const nextAction = actions[name];
    if (!nextAction || nextAction === activeAction) return;

    if (activeAction) {
      nextAction.reset();
      nextAction.time = 0.0;
      nextAction.enabled = true;
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);
      nextAction.crossFadeFrom(activeAction, duration, true);
      nextAction.play();
    } else {
      nextAction.play();
    }
    activeAction = nextAction;
    currentAnimName = name;

    window.dispatchEvent(new CustomEvent('humanoid:anim', { detail: { name: name } }));
  }

  // Expose engine controls for UI interactions & ScrollTrigger
  window.humanoidEngine = {
    fadeToAction: fadeToAction,
    getAnimations: function () {
      return Object.keys(actions);
    },
    getCurrentAnim: function () {
      return currentAnimName;
    }
  };

  function setupInteractionEvents() {
    stageWrap.addEventListener('mousedown', function (e) {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      dragVelocity = 0;
      dismissHint();
    });

    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      dragVelocity = deltaX * 0.008;
      manualRotationY += dragVelocity;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', function () {
      isDragging = false;
    });

    stageWrap.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        dragVelocity = 0;
        dismissHint();
      }
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      dragVelocity = deltaX * 0.008;
      manualRotationY += dragVelocity;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    window.addEventListener('resize', updateDimensions);

    window.addEventListener('mousemove', function (e) {
      mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true });
  }

  function dismissHint() {
    if (!hasInteracted && overlay) {
      hasInteracted = true;
      overlay.style.opacity = '0';
      setTimeout(function () {
        if (overlay) overlay.style.display = 'none';
      }, 500);
    }
  }

  function setupScrollChoreography() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    const sectionPoses = [
      { id: '#hero', rotY: 0, camY: 1.05, camZ: 3.8, anim: 'idle' },
      { id: '#about', rotY: 0.28, camY: 1.1, camZ: 3.6, anim: 'agree' },
      { id: '#projects', rotY: -0.75, camY: 1.0, camZ: 3.9, anim: 'walk' },
      { id: '#skills', rotY: 0.45, camY: 1.25, camZ: 2.8, anim: 'sneak_pose' }, // Close-up inspection
      { id: '#next', rotY: -0.25, camY: 1.1, camZ: 3.5, anim: 'run' }, // Momentum toward future
      { id: '#contact', rotY: -0.45, camY: 1.05, camZ: 3.7, anim: 'agree' } // Look toward CTA
    ];

    sectionPoses.forEach(function (pose) {
      const el = document.querySelector(pose.id);
      if (!el) return;

      ScrollTrigger.create({
        trigger: el,
        start: 'top center',
        end: 'bottom center',
        onEnter: function () {
          animateToPose(pose);
        },
        onEnterBack: function () {
          animateToPose(pose);
        }
      });
    });
  }

  function animateToPose(pose) {
    if (pose.anim && actions[pose.anim]) {
      fadeToAction(pose.anim, 0.8);
    }

    gsap.to({ val: baseScrollRotationY }, {
      val: pose.rotY,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: function () {
        baseScrollRotationY = this.targets()[0].val;
      }
    });

    gsap.to(camera.position, {
      y: pose.camY,
      z: pose.camZ || 3.8,
      duration: 1.2,
      ease: 'power2.out'
    });
  }

  function setupPerformanceMonitors() {
    document.addEventListener('visibilitychange', function () {
      isPaused = document.hidden;
      if (!isPaused) clock.getDelta();
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          isPaused = !entry.isIntersecting;
        });
      }, { threshold: 0.05 });
      observer.observe(canvas);
    }
  }

  function renderLoop() {
    requestAnimationFrame(renderLoop);

    if (isPaused) return;

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    // 1. Advance skeletal animation if active
    if (mixer) {
      mixer.update(delta);
    }

    // 2. Rotate and pulse holographic calibration pedestal
    if (holoPedestal) {
      holoPedestal.rotation.z -= 0.003;
      holoPedestal.material.opacity = 0.55 + Math.sin(time * 2.2) * 0.15;
    }

    // 3. Animate rising ambient data particles
    if (holoParticles) {
      const positions = holoParticles.geometry.attributes.position.array;
      const vels = holoParticles.userData.vels;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += vels[i / 3];
        if (positions[i + 1] > 2.2) {
          positions[i + 1] = 0.05;
        }
      }
      holoParticles.geometry.attributes.position.needsUpdate = true;
      holoParticles.rotation.y = time * 0.035;
    }

    // 4. Pulse dynamic core light
    if (corePointLight) {
      corePointLight.intensity = 1.9 + Math.sin(time * 2.8) * 0.7;
    }

    // 5. Damping on manual drag rotation
    if (!isDragging) {
      dragVelocity *= 0.92;
      manualRotationY += dragVelocity;
    }

    // 6. Apply smooth rotation, breathing & subtle cursor parallax follow
    if (robotPivot) {
      const targetY = baseScrollRotationY + manualRotationY + (mouseTarget.x * 0.14);
      robotPivot.rotation.y += (targetY - robotPivot.rotation.y) * 0.08;

      const targetPitch = -mouseTarget.y * 0.06;
      robotPivot.rotation.x += (targetPitch - robotPivot.rotation.x) * 0.05;

      const targetRoll = -mouseTarget.x * 0.035;
      robotPivot.rotation.z += (targetRoll - robotPivot.rotation.z) * 0.05;

      // Subtle heroic breathing hover
      robotPivot.position.y = Math.sin(time * 1.6) * 0.012;
    }

    renderer.render(scene, camera);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEngine);
  } else {
    initEngine();
  }
})();
