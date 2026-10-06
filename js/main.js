/**
 * ============================================================================
 * ADITYA DAHAKE PORTFOLIO — MAIN INTERACTION & MOTION LOGIC
 * Features: Lenis Smooth Scroll, GSAP ScrollTrigger, Projects Gallery,
 *           Rotating line, Preloader, Read-More drawers, Clipboard copy.
 * ============================================================================
 */

(function () {
  'use strict';

  // 1. Accessibility: Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 2. Preloader Logic (Max 1.2s, Skippable)
  const preloader = document.getElementById('preloader');
  const skipPreloaderBtn = document.getElementById('skip-preloader');
  let preloaderDismissed = false;

  function dismissPreloader() {
    if (preloaderDismissed || !preloader) return;
    preloaderDismissed = true;
    preloader.classList.add('fade-out');
    setTimeout(function () {
      preloader.style.display = 'none';
    }, 450);
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('nopreloader') === '1' || urlParams.get('nopreloader') === 'true') {
    if (preloader) preloader.style.display = 'none';
    preloaderDismissed = true;
  }

  const scrollTargetId = urlParams.get('scroll');
  if (scrollTargetId) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        const target = document.getElementById(scrollTargetId);
        if (target) {
          target.scrollIntoView({ behavior: 'auto' });
          if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        }
      }, 60);
    });
  }

  if (skipPreloaderBtn) {
    skipPreloaderBtn.addEventListener('click', dismissPreloader);
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') dismissPreloader();
  });

  // Auto-dismiss after 1.15 seconds
  setTimeout(dismissPreloader, 1150);

  // 3. Lenis Smooth Scroll Integration (Synced with ScrollTrigger)
  let lenis = null;
  if (!prefersReducedMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.1,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      orientation: 'vertical',
      smoothWheel: true
    });

    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    if (scrollTargetId) {
      const target = document.getElementById(scrollTargetId);
      if (target) {
        lenis.scrollTo(target, { immediate: true, offset: -40 });
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      }
    }

    // Anchor link smooth scroll handling
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId && targetId !== '#') {
          const target = document.querySelector(targetId);
          if (target) {
            e.preventDefault();
            lenis.scrollTo(target, { offset: -60 });
          }
        }
      });
    });
  }

  // Scroll Progress Line Tracking
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
  if (lenis) {
    lenis.on('scroll', updateScrollProgress);
  }
  updateScrollProgress();

  // 4. Hero Rotating Line ("Autonomous Navigation" / "SLAM" / "Toward Humanoids")
  const rotatingTrack = document.getElementById('rotating-track');
  if (rotatingTrack) {
    const roles = [
      'Autonomous Navigation',
      'SLAM',
      'Toward Humanoids'
    ];
    let roleIndex = 0;

    setInterval(function () {
      roleIndex = (roleIndex + 1) % roles.length;
      if (typeof gsap !== 'undefined' && !prefersReducedMotion) {
        gsap.to(rotatingTrack, {
          opacity: 0,
          y: -8,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: function () {
            rotatingTrack.textContent = roles[roleIndex];
            gsap.fromTo(rotatingTrack, 
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
            );
          }
        });
      } else {
        rotatingTrack.textContent = roles[roleIndex];
      }
    }, 2800);
  }

  // 5. Projects Horizontal Slide Gallery
  const gallery = document.getElementById('projects-gallery');
  const prevBtn = document.getElementById('gallery-prev');
  const nextBtn = document.getElementById('gallery-next');
  const counterEl = document.getElementById('gallery-counter');
  const progressFill = document.getElementById('gallery-progress-fill');
  const dotsContainer = document.getElementById('projects-dots');

  if (gallery) {
    const cards = gallery.querySelectorAll('.project-card');
    const totalCards = cards.length;
    const dots = dotsContainer ? dotsContainer.querySelectorAll('.dot-btn') : [];

    // Project-specific humanoid motion mapping
    const projectAnims = ['walk', 'sneak_pose', 'agree', 'headShake'];

    function getActiveIndex() {
      const scrollLeft = gallery.scrollLeft;
      const cardWidth = cards[0] ? cards[0].offsetWidth : 1;
      return Math.min(Math.max(Math.round(scrollLeft / cardWidth), 0), totalCards - 1);
    }

    let lastProjectIndex = -1;
    function updateGalleryUI() {
      const index = getActiveIndex();
      if (counterEl) {
        const displayIndex = String(index + 1).padStart(2, '0');
        const displayTotal = String(totalCards).padStart(2, '0');
        counterEl.textContent = displayIndex + ' / ' + displayTotal;
      }
      if (progressFill) {
        const percent = ((index + 1) / totalCards) * 100;
        progressFill.style.width = percent + '%';
      }

      // Update slide jump dots
      dots.forEach(function (dot, i) {
        if (i === index) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });

      // Synchronize robot animation when switching projects
      if (index !== lastProjectIndex) {
        lastProjectIndex = index;
        if (window.humanoidEngine && projectAnims[index]) {
          window.humanoidEngine.fadeToAction(projectAnims[index], 0.7);
        }
      }
    }

    function scrollToIndex(index) {
      if (index < 0 || index >= totalCards) return;
      const targetCard = cards[index];
      if (targetCard) {
        gallery.scrollTo({
          left: targetCard.offsetLeft - gallery.offsetLeft,
          behavior: 'smooth'
        });
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        scrollToIndex(getActiveIndex() - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        scrollToIndex(getActiveIndex() + 1);
      });
    }

    // Direct jump via dots
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        const slideIdx = parseInt(this.getAttribute('data-slide'), 10);
        scrollToIndex(slideIdx);
      });
    });

    // Listen for gallery scroll to update indicator
    let scrollTimeout;
    gallery.addEventListener('scroll', function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateGalleryUI, 50);
    }, { passive: true });

    // Keyboard arrow keys navigation inside gallery
    gallery.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToIndex(getActiveIndex() + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollToIndex(getActiveIndex() - 1);
      }
    });

    updateGalleryUI();
  }

  // 6. Expandable "Read More" Drawers
  document.querySelectorAll('.read-more-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      const targetId = this.getAttribute('aria-controls');
      const content = document.getElementById(targetId);
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

        // Recompute ScrollTrigger positions upon drawer expansion
        if (typeof ScrollTrigger !== 'undefined') {
          setTimeout(function () {
            ScrollTrigger.refresh();
          }, 100);
        }
      }
    });
  });

  // 7. Clipboard Email Copy Button
  const copyBtn = document.getElementById('copy-email-btn');
  const copyToast = document.getElementById('copy-toast');
  const emailLink = document.getElementById('email-link');

  if (copyBtn && emailLink) {
    copyBtn.addEventListener('click', function () {
      const email = emailLink.textContent.trim();
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
          setTimeout(function () {
            copyToast.classList.remove('show');
          }, 2200);
        }
      }).catch(function (err) {
        console.warn('Clipboard write failed:', err);
      });
    });
  }

  // 8. Desktop Custom Cursor (Non-Distracting, High Contrast)
  const cursor = document.getElementById('custom-cursor');
  if (cursor && window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;

    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function updateCursor() {
      cursorX += (mouseX - cursorX) * 0.2;
      cursorY += (mouseY - cursorY) * 0.2;
      cursor.style.transform = 'translate(' + cursorX + 'px, ' + cursorY + 'px)';
      requestAnimationFrame(updateCursor);
    }
    requestAnimationFrame(updateCursor);

    // Hover effect on interactive elements
    const interactiveSelectors = 'a, button, input, .info-card, .project-card, .contact-card';
    document.querySelectorAll(interactiveSelectors).forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        cursor.classList.add('hovering');
      });
      el.addEventListener('mouseleave', function () {
        cursor.classList.remove('hovering');
      });
    });

    document.addEventListener('mouseleave', function () {
      cursor.style.opacity = '0';
    });
    document.addEventListener('mouseenter', function () {
      cursor.style.opacity = '1';
    });
  }

  // 9. Section Entrance Animations (Clip-Path Wipe + 24px Fade)
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && !prefersReducedMotion) {
    document.querySelectorAll('.content-panel').forEach(function (panel) {
      gsap.fromTo(panel,
        {
          opacity: 0,
          y: 24,
          clipPath: 'inset(4% 0% 0% 0%)'
        },
        {
          opacity: 1,
          y: 0,
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: panel,
            start: 'top 85%',
            once: true
          }
        }
      );
    });
  }

  // 10. Interactive 3D Stage Motion HUD & Canvas Interaction
  const hudButtons = document.querySelectorAll('.hud-btn');
  const hudAnimBadge = document.getElementById('hud-anim-badge');

  hudButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const animName = this.getAttribute('data-anim');
      if (window.humanoidEngine && animName) {
        window.humanoidEngine.fadeToAction(animName, 0.6);
      }
      updateHudUI(animName);
    });
  });

  function updateHudUI(animName) {
    hudButtons.forEach(function (btn) {
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
      updateHudUI(e.detail.name);
    }
  });

  // Clicking on stage canvas makes robot nod ("agree")
  const stageCanvas = document.getElementById('stage-canvas');
  if (stageCanvas) {
    stageCanvas.addEventListener('dblclick', function () {
      if (window.humanoidEngine) {
        window.humanoidEngine.fadeToAction('agree', 0.5);
      }
    });
  }

  // 11. Sliding Profile Spec Deck Tabs (About Section)
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

      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
    });
  });

  // 12. Sliding Segmented Skill Deck Tiers (Skills Section)
  const skillSegBtns = document.querySelectorAll('.skill-seg-btn');
  const skillPanels = document.querySelectorAll('.skill-tier-panel');

  skillSegBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetTier = this.getAttribute('data-tier');
      skillSegBtns.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');

      skillPanels.forEach(function (panel) {
        if (panel.id === 'tier-' + targetTier) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });

      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
    });
  });

  // 13. Interactive Trajectory Steps (Next Section)
  const trajSteps = document.querySelectorAll('.trajectory-step');
  const trajPoses = ['walk', 'run', 'headShake'];

  trajSteps.forEach(function (step, idx) {
    step.addEventListener('click', function () {
      trajSteps.forEach(function (s) { s.classList.remove('active'); });
      this.classList.add('active');

      if (window.humanoidEngine && trajPoses[idx]) {
        window.humanoidEngine.fadeToAction(trajPoses[idx], 0.7);
      }
    });
  });

  // 14. Interactive Fluid Competency Stream Rows (Skills Section)
  const skillRows = document.querySelectorAll('.skill-stream-row');
  const skillPoses = {
    'ros2': 'agree',
    'nav2': 'walk',
    'slam': 'sneak_pose',
    'gazebo': 'agree',
    'cpp': 'agree',
    'python': 'agree',
    'linux': 'idle',
    'lidar': 'headShake'
  };

  skillRows.forEach(function (row) {
    row.addEventListener('click', function () {
      const parent = this.closest('.skills-fluid-stream');
      if (parent) {
        parent.querySelectorAll('.skill-stream-row').forEach(function (r) {
          r.classList.remove('active');
        });
      }
      this.classList.add('active');

      const skillKey = this.getAttribute('data-skill');
      if (window.humanoidEngine && skillKey && skillPoses[skillKey]) {
        window.humanoidEngine.fadeToAction(skillPoses[skillKey], 0.6);
      }
    });

    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });
})();
