/**
 * ============================================================================
 * ADITYA DAHAKE PORTFOLIO — MAIN INTERACTION & FRONT-LAYER 3D MOTION LOGIC
 * Features: Unified GSAP Ticker Render Loop, Lenis Smooth Scroll (Touch Native),
 *           Phase 5 Front-Layer 3D Entrance Transitions, Skill-Meter Transforms,
 *           Floating Motion FAB Controller & Drawer, Clipboard & Gallery Logic.
 * ============================================================================
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  // 1. Lenis Smooth Scroll (Unified inside gsap.ticker, Native on Touch)
  let lenis = null;
  if (!prefersReducedMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      lerp: 0.12,
      smoothWheel: true,
      syncTouch: false // Native scroll on touch devices to ensure optimal INP & frame time
    });

    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', function (e) {
        ScrollTrigger.update();
        if (window.humanoidEngine) window.humanoidEngine.wake(1200);
      });
    }

    if (typeof gsap !== 'undefined') {
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    // Accessible & Clamped 0.9-1.1s Smooth Anchor Navigation
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId && targetId !== '#') {
          const target = document.querySelector(targetId);
          if (target) {
            e.preventDefault();
            lenis.scrollTo(target, {
              offset: -40,
              duration: 1.0,
              easing: function (t) {
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
              }
            });
          }
        }
      });
    });
  }

  // Instant Section Jump for Deep-linking & Visual Audits
  const urlParams = new URLSearchParams(window.location.search);
  const scrollTargetId = urlParams.get('scroll');
  if (scrollTargetId) {
    const target = document.getElementById(scrollTargetId);
    if (target) {
      window.scrollTo(0, target.offsetTop);
      if (lenis) {
        lenis.scrollTo(target, { immediate: true, offset: 0 });
      }
      setTimeout(function () {
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      }, 50);
    }
  }

  // 2. Reading Progress Indicator
  const progressBar = document.getElementById('scroll-progress-line');
  function updateScrollProgress() {
    if (!progressBar) return;
    const docEl = document.documentElement;
    const scrollTop = window.pageYOffset || docEl.scrollTop;
    const scrollHeight = docEl.scrollHeight - docEl.clientHeight;
    const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
  }
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  if (lenis) lenis.on('scroll', updateScrollProgress);
  updateScrollProgress();

  // 3. Hero Rotating Line ("Autonomous Navigation" / "SLAM" / "Toward Humanoids")
  const rotatingTrack = document.getElementById('rotating-track');
  if (rotatingTrack) {
    const roles = ['Autonomous Navigation', 'SLAM', 'Toward Humanoids'];
    let roleIndex = 0;

    setInterval(function () {
      roleIndex = (roleIndex + 1) % roles.length;
      if (typeof gsap !== 'undefined' && !prefersReducedMotion) {
        gsap.to(rotatingTrack, {
          opacity: 0,
          y: -8,
          duration: 0.22,
          ease: 'power2.in',
          onComplete: function () {
            rotatingTrack.textContent = roles[roleIndex];
            gsap.fromTo(rotatingTrack,
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' }
            );
          }
        });
      } else {
        rotatingTrack.textContent = roles[roleIndex];
      }
    }, 2800);
  }

  // 4. Desktop Custom Cursor (Positioned via transform inside gsap.ticker)
  const cursor = document.getElementById('custom-cursor');
  if (cursor && isFinePointer && !prefersReducedMotion) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;

    let hasMoved = false;
    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMoved = true;
    }, { passive: true });

    // Update inside GSAP ticker (No independent rAF loop, idle-conscious)
    if (typeof gsap !== 'undefined') {
      gsap.ticker.add(function () {
        if (!hasMoved) return;
        cursorX += (mouseX - cursorX) * 0.22;
        cursorY += (mouseY - cursorY) * 0.22;
        cursor.style.transform = 'translate3d(' + cursorX + 'px, ' + cursorY + 'px, 0)';
        if (Math.abs(mouseX - cursorX) < 0.15 && Math.abs(mouseY - cursorY) < 0.15) {
          hasMoved = false;
        }
      });
    }

    const interactiveSelectors = 'a, button, input, .project-card, .info-card, .deck-tab';
    document.querySelectorAll(interactiveSelectors).forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('hovering'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('hovering'); });
    });

    document.addEventListener('mouseleave', function () { cursor.style.opacity = '0'; });
    document.addEventListener('mouseenter', function () { cursor.style.opacity = '1'; });
  }

  // 5. Phase 5: Front-Layer 3D Entrance Transitions ("Information Rotates In")
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && !prefersReducedMotion) {
    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('.content-section:not(#hero)').forEach(function (section) {
      const panel = section.querySelector('.content-panel');
      if (!panel) return;

      const isRightSide = section.classList.contains('align-right');
      const rotY = isRightSide ? -14 : 14; // Mirror rotation based on zig-zag
      const transX = isRightSide ? 40 : -40;

      gsap.fromTo(panel,
        {
          opacity: 0,
          rotateY: rotY,
          x: transX,
          y: 20,
          z: -60
        },
        {
          opacity: 1,
          rotateY: 0,
          x: 0,
          y: 0,
          z: 0,
          duration: 0.72,
          ease: 'power3.out',
          clearProps: 'transform', // Perfectly flat and crisp at rest!
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            end: 'bottom 20%',
            toggleActions: 'play none none reverse',
            once: false
          }
        }
      );
    });

    // Animate skill meter bars using transform: scaleX() on scroll
    document.querySelectorAll('.content-section#skills').forEach(function (skillsSection) {
      ScrollTrigger.create({
        trigger: skillsSection,
        start: 'top 75%',
        onEnter: function () {
          skillsSection.querySelectorAll('.sk-meter-bar').forEach(function (bar) {
            bar.classList.add('animated');
          });
        }
      });
    });
  }

  // 6. Floating Motion FAB & Drawer Controls
  const motionFab = document.getElementById('motion-fab');
  const motionDrawer = document.getElementById('motion-drawer');
  const pauseMotionBtn = document.getElementById('pause-motion-btn');
  const hudAnimBadge = document.getElementById('hud-anim-badge');
  const motionButtons = document.querySelectorAll('.motion-btn');

  if (motionFab && motionDrawer) {
    motionFab.addEventListener('click', function () {
      const isOpen = motionDrawer.classList.contains('is-open');
      if (isOpen) {
        motionDrawer.classList.remove('is-open');
        motionDrawer.hidden = true;
        motionFab.setAttribute('aria-expanded', 'false');
      } else {
        motionDrawer.hidden = false;
        motionDrawer.classList.add('is-open');
        motionFab.setAttribute('aria-expanded', 'true');
      }
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!motionFab.contains(e.target) && !motionDrawer.contains(e.target)) {
        motionDrawer.classList.remove('is-open');
        motionDrawer.hidden = true;
        motionFab.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && motionDrawer.classList.contains('is-open')) {
        motionDrawer.classList.remove('is-open');
        motionDrawer.hidden = true;
        motionFab.setAttribute('aria-expanded', 'false');
      }
    });
  }

  motionButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const anim = this.getAttribute('data-anim');
      if (window.humanoidEngine && anim) {
        window.humanoidEngine.fadeToAction(anim);
      }
      updateMotionButtonsUI(anim);
    });
  });

  function updateMotionButtonsUI(animName) {
    motionButtons.forEach(function (btn) {
      if (btn.getAttribute('data-anim') === animName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    if (hudAnimBadge) {
      hudAnimBadge.textContent = animName.toUpperCase();
    }
  }

  window.addEventListener('humanoid:anim', function (e) {
    if (e.detail && e.detail.name) {
      updateMotionButtonsUI(e.detail.name);
    }
  });

  if (pauseMotionBtn) {
    pauseMotionBtn.addEventListener('click', function () {
      if (window.humanoidEngine) {
        const isPaused = window.humanoidEngine.togglePause();
        pauseMotionBtn.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
        const label = pauseMotionBtn.querySelector('.pause-label');
        if (label) {
          label.textContent = isPaused ? 'Resume Motion' : 'Pause Motion';
        }
      }
    });
  }

  // 7. Profile Spec Deck Tabs (About Section)
  const deckTabs = document.querySelectorAll('.deck-tab');
  const deckSlides = document.querySelectorAll('.deck-slide');

  deckTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const targetDeck = this.getAttribute('data-deck');
      deckTabs.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');

      deckSlides.forEach(function (slide) {
        if (slide.id === 'deck-' + targetDeck) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });

      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    });
  });

  // 8. Skill Deck Tiers Switcher (Skills Section)
  const tierButtons = document.querySelectorAll('.tier-btn');
  const skillDocks = document.querySelectorAll('.skill-dock');

  tierButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetTier = this.getAttribute('data-tier');
      tierButtons.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');

      skillDocks.forEach(function (dock) {
        if (dock.id === 'tier-' + targetTier) {
          dock.classList.add('active');
        } else {
          dock.classList.remove('active');
        }
      });

      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    });
  });

  // 9. Read-More Drawers (Project technical details)
  const readMoreButtons = document.querySelectorAll('.read-more-btn');
  readMoreButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const contentId = this.getAttribute('aria-controls');
      const content = document.getElementById(contentId);
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      const icon = this.querySelector('.rm-icon');

      if (!content) return;

      if (isExpanded) {
        this.setAttribute('aria-expanded', 'false');
        content.hidden = true;
        if (icon) icon.textContent = '+';
      } else {
        this.setAttribute('aria-expanded', 'true');
        content.hidden = false;
        if (icon) icon.textContent = '−';
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      }
    });
  });

  // 10. Copy Email to Clipboard
  const copyBtn = document.getElementById('copy-email-btn');
  const copyToast = document.getElementById('copy-toast');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      const email = this.getAttribute('data-email') || 'adityadahake18@gmail.com';
      navigator.clipboard.writeText(email).then(function () {
        const origText = copyBtn.textContent;
        copyBtn.textContent = 'Copied ✓';
        copyBtn.style.color = '#00E5FF';
        copyBtn.style.borderColor = 'rgba(0, 229, 255, 0.6)';
        setTimeout(function () {
          copyBtn.textContent = origText;
          copyBtn.style.color = '';
          copyBtn.style.borderColor = '';
        }, 2000);
        if (copyToast) {
          copyToast.classList.add('show');
          setTimeout(function () { copyToast.classList.remove('show'); }, 2200);
        }
      }).catch(function (err) {
        console.warn('Clipboard write failed:', err);
      });
    });
  }

  // Refresh ScrollTrigger once fonts and images load
  window.addEventListener('load', function () {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  });
})();
