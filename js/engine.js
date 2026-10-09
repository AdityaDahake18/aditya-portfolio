/**
 * ============================================================================
 * ADITYA DAHAKE PORTFOLIO — HIGH-PERFORMANCE 3D ROBOT LOCOMOTION ENGINE
 * Architecture: Full-Viewport Fixed Robot Background (z-index: 0)
 * Performance: Deferred Post-Paint Three.js load, Single Render Loop (gsap.ticker),
 *              Adaptive Quality Governor, Local DRACO Decoder, Zero Shadow Maps.
 * Choreography: Continuous Locomotion Controller (Idle/Walk/Run Blending,
 *               Foot-Sync & Phase Matching, Facing Direction, Gesture Cooldowns).
 * ============================================================================
 */

(function () {
  'use strict';

  const canvas = document.getElementById('stage-canvas');
  const fallbackImg = document.getElementById('stage-fallback');
  const stageWrap = document.getElementById('stage-wrap');

  if (!canvas) return;

  // 1. Accessibility & Low-End Hardware Heuristics
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const isMobile = window.innerWidth <= 820;

  function isWebGLAvailable() {
    try {
      const testCanvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  // If user prefers reduced motion, saves data, has low concurrency, or lacks WebGL:
  // Gracefully stick to the crisp static poster visual with zero WebGL overhead.
  if (prefersReducedMotion || saveData || isLowEnd || !isWebGLAvailable()) {
    if (stageWrap) stageWrap.classList.add('poster-only');
    return;
  }

  // 2. Engine State Variables
  let scene, camera, renderer;
  let robotRoot = null;
  let robotPivot = null;
  let mixer = null;
  let actions = {};
  let clock = null;
  let isPaused = false;
  let isFirstFrameRendered = false;

  // Locomotion & Physics State
  let currentAnimName = 'idle';
  let manualOverrideActive = false;
  let manualOverrideTimeout = null;
  let activeGestureAction = null;
  let gestureCooldowns = {};

  let currentRobotX = isMobile ? 0 : 1.2;
  let targetRobotX = currentRobotX;
  let prevRobotX = currentRobotX;
  let currentRobotZ = 0;
  let targetRobotZ = 0;
  let currentRotY = -0.35;
  let targetRotY = -0.35;
  let restRotY = -0.35;
  let smoothedSpeed = 0;

  // Cursor Parallax & Lights
  let mouseTarget = { x: 0, y: 0 };
  let currentParallax = { x: 0, y: 0 };
  let keyLight, rimLight, ambientLight, coreLight;

  // Adaptive Quality Governor State
  let frameTimeSamples = [];
  let currentDPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);
  let lowFPSCounter = 0;
  let highFPSCounter = 0;

  // Section Poses Definition (Phase 4)
  const SECTION_POSES = {
    '#hero': {
      x: isMobile ? 0 : 1.2,
      z: 0,
      rotY: -0.32,
      camY: 1.05,
      camZ: 3.8,
      restAnim: 'idle',
      gesture: null,
      accentColor: 0x00e5ff
    },
    '#about': {
      x: isMobile ? 0 : -1.2,
      z: 0,
      rotY: 0.35,
      camY: 1.1,
      camZ: 3.5,
      restAnim: 'idle',
      gesture: 'agree', // One nod on enter
      accentColor: 0x00c4e6
    },
    '#projects': {
      x: isMobile ? 0 : 1.25,
      z: 0,
      rotY: -0.4,
      camY: 0.98,
      camZ: 3.9,
      restAnim: 'idle',
      gesture: 'sneak_pose', // Inspection scan feel
      accentColor: 0x00d9f5
    },
    '#skills': {
      x: isMobile ? 0 : -1.2,
      z: 0,
      rotY: 0.5,
      camY: 1.2,
      camZ: 3.2,
      restAnim: 'idle',
      gesture: null,
      accentColor: 0x00e5ff
    },
    '#next': {
      x: isMobile ? 0 : 1.15,
      z: 0,
      rotY: -0.15,
      camY: 1.1,
      camZ: 4.2,
      restAnim: 'idle',
      gesture: null,
      accentColor: 0x00bfe0
    },
    '#contact': {
      x: isMobile ? 0 : 0.75,
      z: 0,
      rotY: -0.22,
      camY: 1.05,
      camZ: 3.5,
      restAnim: 'idle',
      gesture: 'agree', // Welcoming nod
      accentColor: 0x00e5ff
    }
  };

  // 3. Post-First-Paint Script Loader
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        return resolve();
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  let initStarted = false;
  function startDeferredInit() {
    if (initStarted) return;
    initStarted = true;

    // Load Three, GLTFLoader, DRACOLoader in order
    loadScript('js/vendor/three.min.js')
      .then(function () {
        return loadScript('js/vendor/DRACOLoader.js');
      })
      .then(function () {
        return loadScript('js/vendor/GLTFLoader.js');
      })
      .then(function () {
        initThreeEngine();
      })
      .catch(function (err) {
        console.warn('3D Engine scripts failed to load, retaining poster fallback:', err);
      });
  }

  window.addEventListener('load', function () {
    // Immediate trigger on first user interaction
    const triggerInit = function () {
      window.removeEventListener('scroll', triggerInit);
      window.removeEventListener('touchstart', triggerInit);
      window.removeEventListener('mousemove', triggerInit);
      startDeferredInit();
    };

    window.addEventListener('scroll', triggerInit, { passive: true, once: true });
    window.addEventListener('touchstart', triggerInit, { passive: true, once: true });
    window.addEventListener('mousemove', triggerInit, { passive: true, once: true });

    // Idle fallback if visitor remains stationary
    const idleDelay = isMobile ? 8000 : 1200;
    if (window.requestIdleCallback) {
      window.requestIdleCallback(function () {
        setTimeout(startDeferredInit, idleDelay);
      });
    } else {
      setTimeout(startDeferredInit, isMobile ? 8000 : 2500);
    }
  });

  // 4. Initialize Three.js Engine
  function initThreeEngine() {
    clock = new THREE.Clock();

    // Scene & Camera
    scene = new THREE.Scene();
    const isMob = window.innerWidth <= 820;
    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
    if (isMob) {
      camera.position.set(0, 1.4, 4.5);
      camera.lookAt(0, 1.3, 0);
    } else {
      camera.position.set(0, 1.05, 3.8);
      camera.lookAt(0, 0.92, 0);
    }

    // Pivot group for robot translation and rotation
    robotPivot = new THREE.Group();
    robotPivot.position.set(currentRobotX, 0, currentRobotZ);
    robotPivot.rotation.y = currentRotY;
    scene.add(robotPivot);

    // Renderer setup (Clamped DPR, High Performance, Zero Shadow Maps)
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      console.warn('WebGL Renderer creation failed:', err);
      return;
    }

    renderer.setPixelRatio(currentDPR);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1; // Dimmed slightly so robot never blows out over white/text
    renderer.outputEncoding = THREE.sRGBEncoding;

    // Lighting Rig (Max 3 lights + Core Accent)
    setupLighting();

    // Soft Contact Shadow Plane under feet (Zero shadow map overhead)
    setupContactShadow();

    // Load Optimized Draco GLB (assets/models/xbot.glb)
    loadDracoModel();

    // Event listeners
    window.addEventListener('resize', onWindowResize, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Register into GSAP ticker (Single Render Loop)
    if (window.gsap) {
      window.gsap.ticker.add(engineTick);
    } else {
      // Fallback if GSAP is still loading
      const checkGsap = setInterval(function () {
        if (window.gsap) {
          clearInterval(checkGsap);
          window.gsap.ticker.add(engineTick);
        }
      }, 50);
    }
  }

  function setupLighting() {
    // 1. Ambient Light (Deep sapphire fill)
    ambientLight = new THREE.AmbientLight(0x0e1b2e, 1.6);
    scene.add(ambientLight);

    // 2. Key Light (Crisp directional white/blue from front-left)
    keyLight = new THREE.DirectionalLight(0xd9e8ff, 2.0);
    keyLight.position.set(2.5, 4.0, 3.5);
    scene.add(keyLight);

    // 3. Rim Light (Sharp high-tech cyan back-light)
    rimLight = new THREE.DirectionalLight(0x00e5ff, 2.6);
    rimLight.position.set(-2.0, 3.5, -3.0);
    scene.add(rimLight);

    // Chest Core Point Light (Subtle cyan pulse)
    coreLight = new THREE.PointLight(0x00e5ff, 1.8, 3.0);
    coreLight.position.set(0, 1.25, 0.4);
    scene.add(coreLight);
  }

  function setupContactShadow() {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.005;
    robotPivot.add(shadowMesh);
  }

  function loadDracoModel() {
    const loader = new THREE.GLTFLoader();
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('js/vendor/draco/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      'assets/models/xbot.glb',
      function (gltf) {
        onModelLoaded(gltf);
      },
      undefined,
      function (err) {
        console.warn('Draco model load failed, checking fallback:', err);
      }
    );
  }

  function onModelLoaded(gltf) {
    robotRoot = gltf.scene;
    robotRoot.position.set(0, 0, 0);
    robotRoot.scale.set(1, 1, 1);

    // Materials: clean white armor + dark carbon chassis
    const whiteArmorMat = new THREE.MeshStandardMaterial({
      color: 0xe6edf8,
      metalness: 0.25,
      roughness: 0.32,
      skinning: true
    });
    const darkChassisMat = new THREE.MeshStandardMaterial({
      color: 0x121722,
      metalness: 0.85,
      roughness: 0.26,
      skinning: true
    });

    let meshIdx = 0;
    robotRoot.traverse(function (child) {
      if (child.isMesh || child.isSkinnedMesh) {
        child.material = meshIdx === 0 ? whiteArmorMat : darkChassisMat;
        meshIdx++;
      }
    });

    robotPivot.add(robotRoot);

    // Setup Animation Mixer & Actions
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(robotRoot);
      gltf.animations.forEach(function (clip) {
        const action = mixer.clipAction(clip);
        actions[clip.name] = action;

        // Base clips loop infinitely
        if (['idle', 'walk', 'run'].includes(clip.name)) {
          action.setLoop(THREE.LoopRepeat);
          action.enabled = true;
          action.setEffectiveWeight(clip.name === 'idle' ? 1 : 0);
          action.play();
        } else {
          // One-shot gesture clips
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
        }
      });

      mixer.addEventListener('finished', function (e) {
        if (activeGestureAction === e.action) {
          activeGestureAction = null;
        }
      });
    }

    // Setup ScrollTrigger Choreography (Phase 4)
    setupScrollChoreography();
  }

  function setupScrollChoreography() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    Object.keys(SECTION_POSES).forEach(function (selector) {
      const el = document.querySelector(selector);
      if (!el) return;

      const pose = SECTION_POSES[selector];

      ScrollTrigger.create({
        trigger: el,
        start: 'top 65%',
        end: 'bottom 35%',
        onEnter: function () {
          transitionToPose(selector, pose, 'forward');
        },
        onEnterBack: function () {
          transitionToPose(selector, pose, 'backward');
        }
      });
    });
  }

  function transitionToPose(selector, pose, direction) {
    if (selector !== '#hero' || window.pageYOffset > 50) {
      wakeRender(1600);
    }
    targetRobotX = isMobile ? 0 : pose.x;
    targetRobotZ = pose.z;
    restRotY = pose.rotY;

    // Camera movement
    gsap.to(camera.position, {
      y: pose.camY,
      z: pose.camZ,
      duration: 1.1,
      ease: 'power2.out'
    });

    // Lighting color subtle shift (cyan #00e5ff family only)
    if (rimLight && pose.accentColor) {
      gsap.to(rimLight.color, {
        r: ((pose.accentColor >> 16) & 255) / 255,
        g: ((pose.accentColor >> 8) & 255) / 255,
        b: (pose.accentColor & 255) / 255,
        duration: 0.8
      });
    }

    // Trigger one-shot gesture if defined and not cooling down
    if (pose.gesture && actions[pose.gesture] && !manualOverrideActive) {
      const now = Date.now();
      const lastTrigger = gestureCooldowns[selector] || 0;
      if (now - lastTrigger > 4000) {
        gestureCooldowns[selector] = now;
        triggerGesture(pose.gesture);
      }
    }
  }

  function triggerGesture(name) {
    if (!actions[name] || manualOverrideActive) return;

    // Never trigger headShake or sad_pose in automatic choreography
    if (name === 'headShake' || name === 'sad_pose') return;

    const gestureAction = actions[name];
    gestureAction.reset();
    gestureAction.setEffectiveWeight(1);
    gestureAction.crossFadeFrom(actions['idle'], 0.4, true);
    gestureAction.play();
    activeGestureAction = gestureAction;

    window.dispatchEvent(new CustomEvent('humanoid:anim', { detail: { name: name } }));
  }

  function manualTrigger(name) {
    if (!actions[name]) return;

    manualOverrideActive = true;
    clearTimeout(manualOverrideTimeout);

    // Crossfade to chosen action
    Object.keys(actions).forEach(function (key) {
      if (key === name) {
        actions[key].reset();
        actions[key].setEffectiveWeight(1);
        actions[key].play();
      } else {
        actions[key].setEffectiveWeight(0);
      }
    });

    currentAnimName = name;
    window.dispatchEvent(new CustomEvent('humanoid:anim', { detail: { name: name } }));

    manualOverrideTimeout = setTimeout(function () {
      manualOverrideActive = false;
      actions['idle'].setEffectiveWeight(1);
      actions['idle'].play();
      currentAnimName = 'idle';
      window.dispatchEvent(new CustomEvent('humanoid:anim', { detail: { name: 'idle' } }));
    }, 8000);
  }

  // Demand-driven rendering: render actively during motion/scroll/interaction, quiet at rest
  let renderWakeUntil = Date.now() + 300;
  function wakeRender(durationMs) {
    renderWakeUntil = Math.max(renderWakeUntil, Date.now() + (durationMs || 1000));
  }

  // 5. Engine Tick (Driven by gsap.ticker)
  function engineTick(time, delta) {
    if (isPaused || !renderer || !scene || !camera || document.hidden) return;
    if (Date.now() > renderWakeUntil) return; // Completely idle when at rest

    const dt = Math.min(delta / 1000, 0.05); // Clamp dt to 50ms (avoids jumping after tab switches)
    const elapsed = clock ? clock.getElapsedTime() : time;

    // A. Adaptive Quality Governor
    updateQualityGovernor(dt);

    // B. Smooth Robot Translation towards target
    prevRobotX = currentRobotX;
    const dx = (targetRobotX - currentRobotX) * (1 - Math.exp(-dt * 4.5));
    currentRobotX += dx;
    currentRobotZ += (targetRobotZ - currentRobotZ) * (1 - Math.exp(-dt * 4.5));

    if (robotPivot) {
      robotPivot.position.x = currentRobotX;
      robotPivot.position.z = currentRobotZ;

      // Subtle breathing hover
      robotPivot.position.y = Math.sin(elapsed * 1.5) * 0.012;
    }

    // C. Travel Speed Computation & Facing Direction
    const travelDelta = Math.abs(currentRobotX - prevRobotX);
    const instantSpeed = travelDelta / Math.max(dt, 0.001);
    smoothedSpeed += (instantSpeed - smoothedSpeed) * 0.15;

    // Facing direction: when moving laterally, face direction of travel (±75°)
    let targetFacing = restRotY;
    if (smoothedSpeed > 0.3) {
      const travelDir = targetRobotX > currentRobotX ? 1 : -1;
      targetFacing = travelDir * 1.3; // Side profile ~75° while walking
    }

    // Shortest-angle interpolation for facing rotation
    let rotDiff = (targetFacing - currentRotY);
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    currentRotY += rotDiff * (1 - Math.exp(-dt * 5.0));

    if (robotPivot) {
      // D. Desktop Subtle Cursor Parallax (Head & Upper Body turns up to ±12° toward pointer)
      currentParallax.x += (mouseTarget.x * 0.2 - currentParallax.x) * 0.06;
      currentParallax.y += (mouseTarget.y * 0.12 - currentParallax.y) * 0.06;

      robotPivot.rotation.y = currentRotY + currentParallax.x;
      robotPivot.rotation.x = -currentParallax.y;
    }

    // E. Locomotion Blend Weights & Foot-Sync
    if (mixer && !manualOverrideActive) {
      updateLocomotionWeights(smoothedSpeed, dt);
      mixer.update(dt);
    } else if (mixer && manualOverrideActive) {
      mixer.update(dt);
    }

    // F. Pulse Chest Core Light
    if (coreLight) {
      coreLight.intensity = 1.7 + Math.sin(elapsed * 2.8) * 0.6;
    }

    // G. Render Scene
    renderer.render(scene, camera);

    // Crossfade fallback poster on first successful render
    if (!isFirstFrameRendered) {
      isFirstFrameRendered = true;
      if (fallbackImg) fallbackImg.classList.add('fade-out');
    }
  }

  function updateLocomotionWeights(speed, dt) {
    if (!actions['idle'] || !actions['walk'] || !actions['run']) return;

    if (activeGestureAction && activeGestureAction.isRunning()) {
      // During gesture, let gesture take priority
      return;
    }

    let wIdle = 0, wWalk = 0, wRun = 0;

    if (speed < 0.12) {
      wIdle = 1.0;
      wWalk = 0;
      wRun = 0;
      currentAnimName = 'idle';
    } else if (speed < 1.4) {
      // Walk gait dominates
      const t = (speed - 0.12) / (1.4 - 0.12);
      wIdle = 1.0 - t;
      wWalk = t;
      wRun = 0;
      currentAnimName = 'walk';
    } else {
      // Run sprint dominates
      const t = Math.min((speed - 1.4) / 1.6, 1.0);
      wIdle = 0;
      wWalk = 1.0 - t;
      wRun = t;
      currentAnimName = 'run';
    }

    // Foot-sync: clamp timeScale 0.6 - 1.6 to prevent sliding
    const strideSpeed = Math.max(0.6, Math.min(speed * 0.85, 1.6));
    actions['walk'].setEffectiveTimeScale(strideSpeed);
    actions['run'].setEffectiveTimeScale(strideSpeed);

    // Phase-matching between walk and run so legs don't cross awkwardly
    if (wWalk > 0.05 && wRun > 0.05) {
      const walkDuration = actions['walk'].getClip().duration;
      const runDuration = actions['run'].getClip().duration;
      actions['run'].time = actions['walk'].time * (runDuration / walkDuration);
    }

    // Apply weights smoothly
    actions['idle'].setEffectiveWeight(wIdle);
    actions['walk'].setEffectiveWeight(wWalk);
    actions['run'].setEffectiveWeight(wRun);

    window.dispatchEvent(new CustomEvent('humanoid:anim', { detail: { name: currentAnimName } }));
  }

  function updateQualityGovernor(dt) {
    frameTimeSamples.push(dt);
    if (frameTimeSamples.length > 60) frameTimeSamples.shift();

    const avgFrameTime = frameTimeSamples.reduce((a, b) => a + b, 0) / frameTimeSamples.length;

    // If frame time > 24ms (dropping below 41 FPS), reduce DPR
    if (avgFrameTime > 0.024) {
      lowFPSCounter++;
      if (lowFPSCounter > 45 && currentDPR > 0.75) {
        currentDPR = Math.max(0.75, currentDPR - 0.2);
        renderer.setPixelRatio(currentDPR);
        lowFPSCounter = 0;
      }
    } else if (avgFrameTime < 0.012) {
      highFPSCounter++;
      if (highFPSCounter > 150 && currentDPR < 1.5) {
        currentDPR = Math.min(1.5, currentDPR + 0.15);
        renderer.setPixelRatio(currentDPR);
        highFPSCounter = 0;
      }
    }
  }

  function onWindowResize() {
    if (!camera || !renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMob = w <= 820;

    camera.aspect = w / h;
    if (isMob) {
      camera.position.set(0, 1.4, 4.5);
      camera.lookAt(0, 1.3, 0);
    } else {
      camera.position.set(0, 1.05, 3.8);
      camera.lookAt(0, 0.92, 0);
    }
    camera.updateProjectionMatrix();

    renderer.setSize(w, h);
    currentDPR = Math.min(window.devicePixelRatio || 1, isMob ? 1.25 : 1.5);
    renderer.setPixelRatio(currentDPR);
    wakeRender(600);
  }

  function onMouseMove(e) {
    mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
    wakeRender(450);
  }

  window.addEventListener('scroll', function () {
    wakeRender(1200);
  }, { passive: true });

  function onVisibilityChange() {
    isPaused = document.hidden;
    if (!isPaused && clock) {
      clock.getDelta();
      wakeRender(1200);
    }
  }

  // 6. Public API for UI & Motion FAB
  window.humanoidEngine = {
    fadeToAction: manualTrigger,
    wake: wakeRender,
    togglePause: function () {
      isPaused = !isPaused;
      return isPaused;
    },
    isPaused: function () {
      return isPaused;
    },
    getCurrentAnim: function () {
      return currentAnimName;
    }
  };
})();
