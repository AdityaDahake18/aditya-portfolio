# Aditya Dahake — Robotics & Automation Portfolio

Flagship personal engineering website of **Aditya Dahake ("Adyy")**, Robotics & Automation engineering student and R&D intern. Positioned around autonomous navigation (ROS 2, Nav2, SLAM) as a proven foundation building toward humanoid and aerial robotics.

Designed with high craft, restraint, and precision: dark cinematic theme, WCAG AAA text contrast (>= 7:1), split desktop / sticky mobile layout, and an interactive 3D humanoid centerpiece.

---

## 🛠 Tech Stack & Architecture

- **Markup & Layout:** Semantic HTML5, accessible ARIA landmarks, WCAG AAA compliant frosted-glass panels (`rgba(6, 14, 27, 0.86)` with `backdrop-filter: blur(24px)`).
- **Styling:** Vanilla CSS with custom properties, responsive breakpoints (Desktop `>= 1024px`, Tablet `< 1024px`, Mobile `< 480px`).
- **3D Graphics:** Three.js (r128), GLTFLoader, DRACOLoader, PBR lighting rig, soft contact ground shadow, drag-to-rotate inertia, WebGL poster fallback.
- **Motion & Smooth Scroll:** GSAP 3.12.5, ScrollTrigger, Lenis smooth scrolling with ticker synchronization, `@media (prefers-reduced-motion)` overrides.
- **Zero Build Step:** Runs purely on static files without Node or bundlers. 100% compatible with GitHub Pages, Cloudflare Pages, Netlify, and Vercel.

---

## 🚀 Local Run Instructions

To preview locally on any computer:

```bash
# Navigate to the project root
cd /home/adyy/portfolio

# Start a local Python HTTP server
python3 -m http.server 8080
```

Open your browser at:
👉 **`http://localhost:8080`**

---

## 📦 Deployment Instructions

### Option 1: GitHub Pages (Recommended & Zero Cost)

1. Ensure all changes are committed:
   ```bash
   git add .
   git commit -m "feat: complete flagship redesign with 3D humanoid & WCAG AAA contrast"
   ```

2. Link your GitHub remote repository (if not already linked):
   ```bash
   git remote add origin https://github.com/AdityaDahake18/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```

3. Enable GitHub Pages:
   - Go to your repository on GitHub -> **Settings** -> **Pages**.
   - Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
   - Select branch `main` and folder `/ (root)`, then click **Save**.
   - Your site will be live at `https://AdityaDahake18.github.io/<your-repo-name>/`.

### Option 2: Vercel / Netlify
- Drag and drop the `/home/adyy/portfolio` directory directly into the Vercel or Netlify dashboard.
- No build commands or output directories needed (pure static).

---

## 📂 Project Structure

```
portfolio/
├── index.html                   # Semantic structure & WCAG AAA panel layout
├── sitemap.xml                  # Search engine sitemap
├── README.md                    # Documentation & run instructions
├── css/
│   └── style.css                # Dark cinematic design tokens & responsive CSS
├── js/
│   ├── engine.js                # Three.js 3D humanoid engine & scroll poses
│   ├── main.js                  # Lenis scroll, GSAP animations & gallery
│   └── vendor/                  # Localized Three.js, GSAP, Lenis libraries
└── assets/
    ├── CREDITS.md               # Open source license & asset attributions
    ├── favicon.svg              # Geometric robotics brand icon
    ├── models/
    │   ├── xbot.glb             # 2.93MB Three.js humanoid robot (MIT)
    │   └── unitree_g1.glb       # Unitree G1 humanoid robot (Apache 2.0)
    ├── images/
    │   └── humanoid-poster.webp # High-res WebGL poster fallback
    └── projects/                # Visual project media (replace with your real photos)
        ├── nav-stack.webp
        ├── hexapod.webp
        ├── emo-robot.webp
        └── livox-lidar.webp
```

---

## 📝 Updating Your Content (`[FILL]` Placeholders)

The website is production-ready, with clean tags marked `[FILL]` for any remaining personal media:
- **Project Media**: Replace the preview images in `assets/projects/` with your real photos, videos, or RViz point cloud screenshots when ready.
