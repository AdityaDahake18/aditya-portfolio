# Performance Audit & Engineering Report: Robot-as-Background Overhaul

**Target Site:** Aditya Dahake Portfolio (`https://adityadahake18.github.io/`)  
**Environment:** Production static build served locally on `127.0.0.1:8088` (Node v20.18.0, Chrome 154 headless, Lighthouse 12.8.2)  
**Date:** October 2026

---

## 1. Executive Summary & Goals

This report documents the performance engineering, architecture revamp, and verification of the personal portfolio of Aditya Dahake. The overhaul transitions the site from a sluggish split-screen view with render-blocking assets to a high-speed, full-viewport 3D robot background with layered, highly legible front-matter.

### Acceptance Criteria & Targets

| Metric | Target | Baseline (Phase 1) | Post-Fix (Phase 2) | Final Build (Phase 5) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Lighthouse Mobile Score** (Slow 4G, 4x CPU) | ≥ 90 | **29** / 100 | TBD | TBD | Pending Fixes |
| **Lighthouse Desktop Score** | ≥ 95 | **53** / 100 | TBD | TBD | Pending Fixes |
| **Mobile LCP** | ≤ 2.5 s | **21.8 s** | TBD | TBD | Pending Fixes |
| **Mobile TBT** | ≤ 200 ms | **9,570 ms** | TBD | TBD | Pending Fixes |
| **Desktop TBT** | ≤ 200 ms | **20,520 ms** | TBD | TBD | Pending Fixes |
| **Mobile CLS** | ≤ 0.1 | **0.000** | TBD | TBD | MET |
| **Desktop CLS** | ≤ 0.1 | **0.001** | TBD | TBD | MET |
| **Scroll FPS** (1080p Desktop) | ≥ 55 FPS | ~32 FPS (jank spikes) | TBD | TBD | Pending Fixes |
| **Critical Transfer** (before 3D) | ≤ 250 KB | **959.3 KB** | TBD | TBD | Pending Fixes |
| **GLB Transferred** | ≤ 2.0 MB | **2.86 MB** (2,930 KB) | TBD | TBD | Pending Fixes |
| **Font Requests** | ≤ 4 WOFF2, 0 3rd party | 2 Google CSS + 2 WOFF2 | TBD | TBD | Pending Fixes |
| **Render Loops** | Exactly 1 | **4 independent rAFs** | TBD | TBD | Pending Fixes |

---

## 2. Phase 1: Baseline Measurements

### A. Lighthouse Audit Results (Unthrottled Production Server)

#### Desktop Performance (Lighthouse 12.8.2)
- **Performance Score:** **53 / 100**
- **First Contentful Paint (FCP):** 1.3 s
- **Largest Contentful Paint (LCP):** 1.3 s
- **Total Blocking Time (TBT):** **20,520 ms** (severe main-thread saturation)
- **Cumulative Layout Shift (CLS):** 0.001
- **Speed Index:** 8.4 s
- **Time to Interactive (TTI):** 41.0 s
- **Total Requests:** 20 requests
- **Total Transferred:** 3,967.5 KB (3.87 MB)

#### Mobile Performance (Simulated Moto G Power, Slow 4G, 4x CPU throttle)
- **Performance Score:** **29 / 100**
- **First Contentful Paint (FCP):** 6.7 s
- **Largest Contentful Paint (LCP):** **21.8 s**
- **Total Blocking Time (TBT):** **9,570 ms**
- **Cumulative Layout Shift (CLS):** 0.000
- **Speed Index:** 6.7 s
- **Time to Interactive (TTI):** 22.3 s
- **Total Requests:** 17 requests
- **Total Transferred:** 3,912.2 KB (3.82 MB)

---

### B. Asset Breakdown Audit

| Asset | Type | Raw Size | Gzip Size | Critical Path Blocking? |
| :--- | :--- | :--- | :--- | :--- |
| `index.html` | Document | 47.8 KB | 9.3 KB | Yes (initial HTML) |
| `css/style.css` | Stylesheet | 38.4 KB | 7.4 KB | Yes (critical CSS) |
| `Google Fonts CSS` | Stylesheet | 1.8 KB | 0.8 KB | Yes (cross-origin render blocking) |
| `js/vendor/three.min.js` | Script | 589.3 KB | 145.3 KB | **Yes** (in `<head>`, no `defer`) |
| `js/vendor/GLTFLoader.js` | Script | 94.3 KB | 21.4 KB | **Yes** (in `<head>`, no `defer`) |
| `js/vendor/DRACOLoader.js` | Script | 13.1 KB | 3.8 KB | **Yes** (in `<head>`, no `defer`) |
| `js/vendor/gsap.min.js` | Script | 70.5 KB | 27.4 KB | **Yes** (in `<head>`, no `defer`) |
| `js/vendor/ScrollTrigger.min.js` | Script | 42.4 KB | 17.2 KB | **Yes** (in `<head>`, no `defer`) |
| `js/vendor/lenis.min.js` | Script | 13.3 KB | 3.7 KB | **Yes** (in `<head>`, no `defer`) |
| `js/engine.js` | Script | 20.2 KB | 6.1 KB | Deferred (end of body) |
| `js/main.js` | Script | 16.6 KB | 4.4 KB | Deferred (end of body) |
| `assets/models/xbot.glb` | 3D Mesh | 2,861.4 KB | 1,112.7 KB | High bandwidth download |
| `assets/images/humanoid-poster.webp` | Image | 14.4 KB | 12.9 KB | LCP candidate fallback |
| **Pre-3D Critical Transfer** | — | **959.3 KB** | **238.1 KB** | **Fails ≤ 250 KB target (raw)** |

#### 3D Model Geometry (`assets/models/xbot.glb`)
- **Triangles:** 49,112
- **Materials:** 2
- **Textures:** 0 embedded textures
- **Animation Clips (7):** `agree`, `headShake`, `idle`, `run`, `sad_pose`, `sneak_pose`, `walk`
- **License Attribution:** MIT License (Three.js Authors, verified in `assets/CREDITS.md`)

---

### C. Suspected Culprits Audit (Verification Matrix)

| Suspected Culprit | Status | Evidence & Impact |
| :--- | :--- | :--- |
| **1. Six vendor `<script>` tags in `<head>` without `defer`** | **YES** | Lines 37–42 in `index.html` load `three`, `GLTFLoader`, `DRACOLoader`, `gsap`, `ScrollTrigger`, and `lenis` synchronously in `<head>`. Totaling 823 KB of JS execution blocking HTML parser. |
| **2. Google Fonts render-blocking cross-origin stylesheet** | **YES** | Line 31 in `index.html` requests 8 font weights across 2 font families (`Inter Tight` & `Space Grotesk`) from `fonts.googleapis.com` + `fonts.gstatic.com`. |
| **3. `backdrop-filter` (frosted glass) over live WebGL** | **YES** | 14 declarations of `backdrop-filter: blur(...)` across `.profile-deck`, `.glass-card`, `.dock-btn`, `.carousel-btn`, `.project-card`, `.gallery-indicator`, `.contact-card`. Severe GPU fill-rate penalty. |
| **4. Uncapped DPR, shadow maps, MSAA in engine.js** | **YES** | `antialias: true` enabled (MSAA), `setPixelRatio(Math.min(window.devicePixelRatio, 2))` caps at 2.0 instead of 1.5/1.25 with no adaptive governor. |
| **5. Multiple `requestAnimationFrame` loops** | **YES** | 4 separate loops: `engine.js` (`renderLoop`), `main.js` (`updateCursor`), Lenis smooth scroll ticker, and GSAP ticker. |
| **6. Preloader on fixed timer delaying first paint/LCP** | **YES** | `main.js` lines 56–57 hardcodes `setTimeout(dismissPreloader, 1150)` with a 450 ms fade-out, directly delaying visibility by 1.6 s. |
| **7. Oversized or uncompressed GLB** | **YES** | `xbot.glb` is 2.86 MB uncompressed without Draco/meshopt compression. |
| **8. Lenis configuration causing laggy scroll** | **YES** | `main.js` sets `duration: 1.1`, exponential easing curve, and default `syncTouch: true`, creating floaty/spongey touch experience. |
| **9. Scroll handlers reading layout every frame** | **YES** | `stageWrap.clientWidth` layout query performed during frame routines. |
| **10. CSS animations on layout properties (`width`, `box-shadow`)** | **YES** | `style.css` transitions `width` on `.skill-meter-fill` (`0.8s`) and `.dock-progress-bar`, triggering continuous reflows. |

---
