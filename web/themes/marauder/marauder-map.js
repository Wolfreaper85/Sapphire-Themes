/**
 * Marauder's Map — Parchment background image with animated ink overlays.
 *
 * Visual layers (back to front):
 *   1.  parchment.png background image (cover-scaled)
 *   2.  Dark overlay for UI readability
 *   3.  Walking footprints with name tags
 *   4.  Ink splotches (mouse interaction)
 *   5.  Magical calligraphy flourishes
 *   6.  Ink drip particles
 *   7.  "I solemnly swear..." intro text
 *   8.  Thinking/speaking effects
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    let canvas, ctx, animId;
    let W = 0, H = 0;
    let tick = 0;

    // Custom overlay speed/density multipliers
    const CUSTOM_SPEED_MAP = { slow: 0.5, normal: 1.0, fast: 1.8 };
    let customSpeedMult = CUSTOM_SPEED_MAP[localStorage.getItem('custom-overlay-speed') || 'normal'];
    const CUSTOM_DENSITY_MAP = { sparse: 0.5, medium: 1.0, dense: 1.5 };
    let customDensityMult = CUSTOM_DENSITY_MAP[localStorage.getItem('custom-overlay-density') || 'medium'];

    // ── Constants ─────────────────────────────────────────
    const PARCHMENT_FALLBACK = '#2a1f14';
    const SERIF_FONT = 'Georgia, "Palatino Linotype", serif';

    // ── Background Image ──────────────────────────────────
    let bgImage = null;
    let bgImageLoaded = false;

    function loadBackgroundImage() {
        bgImage = new Image();
        // Derive base URL from this script's own src, fallback to known path
        let baseUrl = '/plugin-web/sapphire-themes/themes/marauder/';
        try {
            const scripts = document.querySelectorAll('script[src]');
            for (let i = scripts.length - 1; i >= 0; i--) {
                const src = scripts[i].src;
                if (src.includes('marauder-map')) {
                    baseUrl = src.substring(0, src.lastIndexOf('/') + 1);
                    break;
                }
            }
        } catch (_) { /* use fallback */ }
        bgImage.src = baseUrl + 'parchment.png';
        bgImage.onload = () => { bgImageLoaded = true; };
    }

    // ── State ─────────────────────────────────────────────
    let isThinking = false;
    let thinkingTick = 0;
    let isSpeaking = false;
    let speakingTick = 0;

    // Performance
    let perfTier = 'auto';
    let effectiveTier = 'high';
    let targetFPS = 60;

    // Visual state
    let walkers = [];
    let footprints = [];
    let splotches = [];
    let flourishes = [];
    let inkDrips = [];
    let introState = null;
    let mouseX = -1000, mouseY = -1000;
    let lastSplotchTime = 0;
    let thinkingTextState = null;
    let showNames = localStorage.getItem('marauder-show-names') !== 'false';

    // ── Canvas Setup ──────────────────────────────────────
    function ensureCanvas() {
        if (canvas && canvas.parentNode) return true;
        canvas = document.createElement('canvas');
        canvas.id = 'marauder-map-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resize();
        return true;
    }

    function resize() {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ── Performance Detection ─────────────────────────────
    function detectPerformance() {
        const stored = localStorage.getItem('marauder-perf-tier');
        if (stored && stored !== 'auto') {
            perfTier = stored;
            effectiveTier = stored;
        } else {
            const cores = navigator.hardwareConcurrency || 4;
            if (cores <= 2) effectiveTier = 'low';
            else if (cores <= 4) effectiveTier = 'medium';
            else effectiveTier = 'high';
        }
        targetFPS = effectiveTier === 'low' ? 24 : effectiveTier === 'medium' ? 30 : 60;
    }

    // ── Utility ───────────────────────────────────────────
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function dist(x1, y1, x2, y2) {
        const dx = x1 - x2, dy = y1 - y2;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ── Initialize Walkers ────────────────────────────────
    function initWalkers() {
        walkers = [];
        footprints = [];

        const walkerDefs = [
            { name: 'Harry Potter', speed: 0.6 },
            { name: 'Ron Weasley', speed: 0.5 },
            { name: 'Hermione Granger', speed: 0.55 },
            { name: 'Albus Dumbledore', speed: 0.35 },
            { name: 'Severus Snape', speed: 0.45 },
            { name: 'Fred & George', speed: 0.7 },
        ];

        const baseCount = effectiveTier === 'low' ? 3 : effectiveTier === 'medium' ? 5 : 6;
        const count = Math.min(walkerDefs.length, Math.round(baseCount * (document.documentElement.getAttribute('data-custom-overlay') ? customDensityMult : 1)));

        for (let i = 0; i < count; i++) {
            const def = walkerDefs[i];
            const waypoints = generateWalkerPath(i);
            walkers.push({
                name: def.name,
                speed: def.speed,
                waypoints: waypoints,
                waypointIndex: 0,
                progress: 0,
                x: waypoints[0].x * W,
                y: waypoints[0].y * H,
                footStep: 0,
                lastFootprintDist: 0,
            });
        }
    }

    function generateWalkerPath(index) {
        const paths = [
            // Harry: top-left area wandering
            [{x:0.15,y:0.18},{x:0.25,y:0.22},{x:0.38,y:0.15},{x:0.42,y:0.25},{x:0.30,y:0.30},{x:0.18,y:0.28}],
            // Ron: middle area
            [{x:0.35,y:0.42},{x:0.45,y:0.48},{x:0.50,y:0.40},{x:0.42,y:0.52},{x:0.38,y:0.45}],
            // Hermione: library area
            [{x:0.38,y:0.10},{x:0.42,y:0.15},{x:0.48,y:0.12},{x:0.44,y:0.20},{x:0.36,y:0.18}],
            // Dumbledore: wide ranging
            [{x:0.20,y:0.30},{x:0.40,y:0.50},{x:0.60,y:0.35},{x:0.75,y:0.50},{x:0.55,y:0.65},{x:0.30,y:0.55}],
            // Snape: dungeon area
            [{x:0.12,y:0.50},{x:0.18,y:0.58},{x:0.22,y:0.48},{x:0.15,y:0.62},{x:0.10,y:0.55}],
            // Fred & George: all over
            [{x:0.70,y:0.15},{x:0.80,y:0.30},{x:0.65,y:0.45},{x:0.78,y:0.55},{x:0.85,y:0.40},{x:0.72,y:0.25}],
        ];
        return paths[index] || paths[0];
    }

    // ── Initialize Flourishes ─────────────────────────────
    function initFlourishes() {
        flourishes = [];
    }

    // ── Initialize Ink Drips ──────────────────────────────
    function initInkDrips() {
        inkDrips = [];
        if (effectiveTier === 'low') return;
        const count = effectiveTier === 'medium' ? 15 : 20;
        for (let i = 0; i < count; i++) {
            inkDrips.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vy: 0.08 + Math.random() * 0.2,
                vx: (Math.random() - 0.5) * 0.12,
                size: 0.8 + Math.random() * 1.2,
                alpha: 0.04 + Math.random() * 0.06,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // DRAWING LAYERS
    // ═══════════════════════════════════════════════════════

    // ── 1. Background Image ───────────────────────────────
    function drawBackground() {
        if (document.documentElement.getAttribute('data-custom-overlay') === 'marauder') {
            ctx.clearRect(0, 0, W, H);
            return;
        }
        if (bgImageLoaded && bgImage) {
            // Cover-style scaling: maintain aspect ratio, fill canvas, center
            const imgW = bgImage.naturalWidth;
            const imgH = bgImage.naturalHeight;
            const scaleX = W / imgW;
            const scaleY = H / imgH;
            const scale = Math.max(scaleX, scaleY);
            const drawW = imgW * scale;
            const drawH = imgH * scale;
            const offsetX = (W - drawW) / 2;
            const offsetY = (H - drawH) / 2;
            ctx.drawImage(bgImage, offsetX, offsetY, drawW, drawH);
        } else {
            // Fallback while image loads
            ctx.fillStyle = PARCHMENT_FALLBACK;
            ctx.fillRect(0, 0, W, H);
        }

        // Dark overlay for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Footprints and Walkers ─────────────────────────
    function updateWalkers(dt) {
        const speedMult = isThinking ? 2.0 : 1.0;

        walkers.forEach(walker => {
            const wp = walker.waypoints;
            const curr = wp[walker.waypointIndex];
            const next = wp[(walker.waypointIndex + 1) % wp.length];

            const targetX = next.x * W;
            const targetY = next.y * H;
            const prevX = curr.x * W;
            const prevY = curr.y * H;

            walker.progress += walker.speed * speedMult * dt * 0.015;

            if (walker.progress >= 1) {
                walker.progress = 0;
                walker.waypointIndex = (walker.waypointIndex + 1) % wp.length;
            }

            walker.x = lerp(prevX, targetX, walker.progress);
            walker.y = lerp(prevY, targetY, walker.progress);

            // Distance moved for footprint spacing
            walker.lastFootprintDist += Math.abs(walker.speed * speedMult * dt * 0.015) * dist(prevX, prevY, targetX, targetY);

            if (walker.lastFootprintDist > 18) {
                walker.lastFootprintDist = 0;
                walker.footStep++;

                const angle = Math.atan2(targetY - prevY, targetX - prevX);

                // Offset left/right foot perpendicular to direction
                const side = walker.footStep % 2 === 0 ? 1 : -1;
                const perpX = Math.cos(angle + Math.PI / 2) * 5 * side;
                const perpY = Math.sin(angle + Math.PI / 2) * 5 * side;

                footprints.push({
                    x: walker.x + perpX,
                    y: walker.y + perpY,
                    angle: angle,
                    birth: performance.now(),
                    side: side,
                });

                // Cap at 80 per walker (approximate by total cap)
                if (footprints.length > 80 * walkers.length) {
                    footprints.shift();
                }
            }
        });

        // Fade and remove old footprints (6 second lifetime)
        const now = performance.now();
        footprints = footprints.filter(fp => {
            const age = (now - fp.birth) / 1000;
            return age < 6;
        });
    }

    function drawFootprints() {
        const now = performance.now();

        footprints.forEach(fp => {
            const age = (now - fp.birth) / 1000;
            const baseAlpha = 0.7 * (1 - age / 6);
            if (baseAlpha <= 0.01) return;

            // Mouse proximity boost
            const md = dist(mouseX, mouseY, fp.x, fp.y);
            const boost = md < 100 ? 0.15 * (1 - md / 100) : 0;
            const alpha = Math.min(0.8, baseAlpha + boost);

            ctx.save();
            ctx.translate(fp.x, fp.y);
            ctx.rotate(fp.angle);

            ctx.fillStyle = `rgba(90, 50, 20, ${alpha})`;

            // Small oval footprint (~4x6px)
            ctx.beginPath();
            ctx.ellipse(0, 0, 3, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Toe dots
            ctx.beginPath();
            ctx.arc(-1.5, -5.5, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(1.5, -5.5, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, -6, 0.8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    }

    function drawWalkerNames() {
        walkers.forEach(walker => {
            // Mouse proximity boost
            const md = dist(mouseX, mouseY, walker.x, walker.y);
            const boost = md < 150 ? 0.2 * (1 - md / 150) : 0;

            // Tiny dot at exact position (always visible)
            const dotAlpha = 0.9 + boost * 0.1;
            ctx.fillStyle = `rgba(120, 70, 20, ${dotAlpha})`;
            ctx.beginPath();
            ctx.arc(walker.x, walker.y, 2, 0, Math.PI * 2);
            ctx.fill();

            if (!showNames) return;

            // Name label — bright and bold
            const nameAlpha = Math.min(1, 0.95 + boost);
            ctx.font = `italic bold 12px ${SERIF_FONT}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // Dark shadow for contrast against parchment
            ctx.fillStyle = `rgba(30, 15, 5, ${nameAlpha * 0.4})`;
            ctx.fillText(walker.name, walker.x + 9, walker.y - 9);

            // Main text — warm dark brown, much more visible
            ctx.fillStyle = `rgba(60, 25, 5, ${nameAlpha})`;
            ctx.fillText(walker.name, walker.x + 8, walker.y - 10);
        });
    }

    // ── 3. Ink Splotches (Mouse Interaction) ──────────────
    function drawSplotches() {
        if (effectiveTier === 'low') return;

        const now = performance.now();
        splotches = splotches.filter(sp => {
            const age = (now - sp.birth) / 1000;
            return age < 4;
        });

        splotches.forEach(sp => {
            const age = (now - sp.birth) / 1000;
            const alpha = sp.baseAlpha * (1 - age / 4);
            if (alpha <= 0.01) return;

            ctx.fillStyle = `rgba(90, 50, 20, ${alpha})`;
            for (let i = 0; i < sp.blobs.length; i++) {
                const b = sp.blobs[i];
                ctx.beginPath();
                ctx.arc(sp.x + b.ox, sp.y + b.oy, b.r, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    function addSplotch(x, y) {
        if (splotches.length >= 25) splotches.shift();
        const blobs = [];
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            blobs.push({
                ox: (Math.random() - 0.5) * 8,
                oy: (Math.random() - 0.5) * 8,
                r: 2 + Math.random() * 4,
            });
        }
        splotches.push({
            x, y,
            blobs,
            birth: performance.now(),
            baseAlpha: 0.08 + Math.random() * 0.06,
        });
    }

    // ── 4. Magical Flourishes ─────────────────────────────
    let lastFlourishSpawn = 0;

    function updateFlourishes() {
        if (effectiveTier === 'low') return;

        const now = performance.now();

        // Spawn new flourish every 4-6 seconds
        if (flourishes.length < 3 && now - lastFlourishSpawn > (4000 + Math.random() * 2000)) {
            lastFlourishSpawn = now;
            flourishes.push({
                x: (0.1 + Math.random() * 0.8) * W,
                y: (0.1 + Math.random() * 0.8) * H,
                birth: now,
                drawProgress: 0,
                fadeAlpha: 1,
                type: Math.floor(Math.random() * 3),
                scale: 0.6 + Math.random() * 0.8,
            });
        }

        // Update flourishes
        flourishes = flourishes.filter(fl => {
            const age = (now - fl.birth) / 1000;

            if (age < 1.5) {
                // Drawing phase — animate from 0 to 1
                fl.drawProgress = Math.min(1, age / 1.5);
                fl.fadeAlpha = 1;
            } else if (age < 3.5) {
                // Hold phase
                fl.drawProgress = 1;
                fl.fadeAlpha = 1;
            } else if (age < 5.0) {
                // Fade phase
                fl.drawProgress = 1;
                fl.fadeAlpha = 1 - (age - 3.5) / 1.5;
            } else {
                return false;
            }
            return true;
        });
    }

    function drawFlourishes() {
        flourishes.forEach(fl => {
            const alpha = 0.3 * fl.fadeAlpha;
            ctx.save();
            ctx.translate(fl.x, fl.y);
            ctx.scale(fl.scale, fl.scale);
            ctx.strokeStyle = `rgba(160, 120, 50, ${alpha})`;
            ctx.lineWidth = 1;

            const p = fl.drawProgress;

            if (fl.type === 0) {
                // Spiral flourish
                ctx.beginPath();
                for (let t = 0; t <= p * Math.PI * 3; t += 0.1) {
                    const r = t * 3;
                    const x = Math.cos(t) * r;
                    const y = Math.sin(t) * r;
                    if (t === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            } else if (fl.type === 1) {
                // S-curve bezier flourish
                ctx.beginPath();
                ctx.moveTo(-20, 0);
                const endX = lerp(-20, 20, p);
                ctx.bezierCurveTo(-10, -15 * p, 10, 15 * p, endX, 0);
                ctx.stroke();
                // Small curl at end
                if (p > 0.7) {
                    ctx.beginPath();
                    ctx.arc(endX, 0, 5 * (p - 0.7) / 0.3, 0, Math.PI * 1.5 * ((p - 0.7) / 0.3));
                    ctx.stroke();
                }
            } else {
                // Ornamental double-curl
                ctx.beginPath();
                ctx.moveTo(0, -15);
                ctx.bezierCurveTo(15 * p, -15, 20 * p, 0, 10 * p, 10 * p);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, -15);
                ctx.bezierCurveTo(-15 * p, -15, -20 * p, 0, -10 * p, 10 * p);
                ctx.stroke();
            }

            ctx.restore();
        });
    }

    // ── 5. Ink Drip Particles ─────────────────────────────
    function updateInkDrips() {
        inkDrips.forEach(drip => {
            drip.y += drip.vy;
            drip.x += drip.vx;
            if (drip.y > H + 5) {
                drip.y = -5;
                drip.x = Math.random() * W;
            }
            if (drip.x < 0) drip.x = W;
            if (drip.x > W) drip.x = 0;
        });
    }

    function drawInkDrips() {
        inkDrips.forEach(drip => {
            ctx.fillStyle = `rgba(90, 50, 20, ${drip.alpha})`;
            ctx.beginPath();
            ctx.arc(drip.x, drip.y, drip.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ── 6. Intro Text — "I solemnly swear..." ─────────────
    function updateIntroText() {
        if (!introState) return;

        const elapsed = (performance.now() - introState.startTime) / 1000;

        if (introState.phase === 'writing') {
            // ~50ms per character = 20 chars/sec
            introState.charIndex = Math.min(
                introState.text.length,
                Math.floor(elapsed * 20)
            );
            if (introState.charIndex >= introState.text.length) {
                introState.phase = 'hold';
                introState.phaseStart = performance.now();
            }
        } else if (introState.phase === 'hold') {
            const holdElapsed = (performance.now() - introState.phaseStart) / 1000;
            if (holdElapsed >= 2.5) {
                introState.phase = 'fade';
                introState.phaseStart = performance.now();
            }
        } else if (introState.phase === 'fade') {
            const fadeElapsed = (performance.now() - introState.phaseStart) / 1000;
            introState.fadeAlpha = 1 - Math.min(1, fadeElapsed / 1.5);
            if (introState.fadeAlpha <= 0) {
                introState = null;
            }
        }
    }

    function drawIntroText() {
        if (!introState) return;

        const alpha = introState.phase === 'fade' ? introState.fadeAlpha : 1;
        const displayText = introState.text.substring(0, introState.charIndex);

        ctx.save();
        ctx.font = `italic 22px ${SERIF_FONT}`;
        ctx.fillStyle = `rgba(90, 50, 20, ${0.85 * alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, W / 2, H / 2);

        // Subtle quill cursor while writing
        if (introState.phase === 'writing' && introState.charIndex < introState.text.length) {
            const textWidth = ctx.measureText(displayText).width;
            const cursorX = W / 2 + textWidth / 2 + 2;
            ctx.fillStyle = `rgba(90, 50, 20, ${0.5 + Math.sin(tick * 0.3) * 0.3})`;
            ctx.fillRect(cursorX, H / 2 - 10, 1.5, 20);
        }

        ctx.restore();
    }

    // ── 7. Thinking Effect — "Mischief Managed" ───────────
    function updateThinkingText() {
        if (!thinkingTextState) return;

        const elapsed = (performance.now() - thinkingTextState.startTime) / 1000;

        if (thinkingTextState.phase === 'writing') {
            thinkingTextState.charIndex = Math.min(
                thinkingTextState.text.length,
                Math.floor(elapsed * 20)
            );
            if (thinkingTextState.charIndex >= thinkingTextState.text.length) {
                thinkingTextState.phase = 'hold';
                thinkingTextState.phaseStart = performance.now();
            }
        } else if (thinkingTextState.phase === 'hold') {
            if (!isThinking) {
                thinkingTextState.phase = 'fade';
                thinkingTextState.phaseStart = performance.now();
            }
        } else if (thinkingTextState.phase === 'fade') {
            const fadeElapsed = (performance.now() - thinkingTextState.phaseStart) / 1000;
            thinkingTextState.fadeAlpha = 1 - Math.min(1, fadeElapsed / 1.5);
            if (thinkingTextState.fadeAlpha <= 0) {
                thinkingTextState = null;
            }
        }
    }

    function drawThinkingText() {
        if (!thinkingTextState) return;

        const alpha = thinkingTextState.phase === 'fade' ? thinkingTextState.fadeAlpha : 1;
        const displayText = thinkingTextState.text.substring(0, thinkingTextState.charIndex);

        ctx.save();
        ctx.font = `italic 22px ${SERIF_FONT}`;
        ctx.fillStyle = `rgba(90, 50, 20, ${0.85 * alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, W / 2, H / 2 + 30);
        ctx.restore();
    }

    function drawThinkingEffect() {
        if (!isThinking) return;
        thinkingTick++;

        // Golden ink shimmer — brief warm overlay pulse
        const shimmer = 0.04 * Math.sin(thinkingTick * 0.06);
        if (shimmer > 0) {
            ctx.fillStyle = `rgba(160, 120, 50, ${shimmer})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    // ── 8. Speaking Effect ────────────────────────────────
    function drawSpeakingEffect() {
        if (!isSpeaking) return;
        speakingTick++;
        const cx = W / 2, cy = H / 2;

        // Warm golden ripple expanding from center
        for (let i = 0; i < 3; i++) {
            const phase = (speakingTick * 0.03 + i * 0.8) % 2.5;
            const r = 20 + phase * Math.min(W, H) * 0.08;
            const alpha = Math.max(0, 0.12 - phase * 0.05);
            ctx.strokeStyle = `rgba(160, 120, 50, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Subtle brightness pulse on the overlay
        const pulseAlpha = Math.sin(speakingTick * 0.1) * 0.02 + 0.02;
        if (pulseAlpha > 0) {
            ctx.fillStyle = `rgba(160, 120, 50, ${pulseAlpha})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    // ═══════════════════════════════════════════════════════
    // MAIN RENDER LOOP
    // ═══════════════════════════════════════════════════════

    let lastFrameTime = 0;
    function render(timestamp) {
        const isMarauderTheme = document.documentElement.getAttribute('data-theme') === 'marauder';
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'marauder';
        if (!canvas || !canvas.parentNode || (!isMarauderTheme && !isCustomOverlay)) {
            cleanup();
            return;
        }

        const frameInterval = 1000 / targetFPS;
        if (timestamp - lastFrameTime < frameInterval) {
            animId = requestAnimationFrame(render);
            return;
        }
        const dt = Math.min(3, (timestamp - lastFrameTime) / frameInterval);
        lastFrameTime = timestamp;

        tick += (document.documentElement.getAttribute('data-custom-overlay') ? customSpeedMult : 1);

        // Update dynamic elements
        updateWalkers(dt);
        updateFlourishes();
        updateInkDrips();
        updateIntroText();
        updateThinkingText();

        // ── Draw all layers ────────────────────────────────
        // 1. Background image (covers entire canvas — clean slate each frame)
        drawBackground();

        // 2. Animated overlays
        drawInkDrips();
        drawFootprints();
        drawWalkerNames();
        drawSplotches();
        drawFlourishes();
        drawThinkingEffect();
        drawSpeakingEffect();
        drawIntroText();
        drawThinkingText();

        animId = requestAnimationFrame(render);
    }

    // ═══════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════

    function start() {
        if (animId) return;
        if (!ensureCanvas()) return;
        detectPerformance();
        loadBackgroundImage();
        initWalkers();
        initFlourishes();
        initInkDrips();

        tick = 0;
        splotches = [];
        footprints = [];
        lastFlourishSpawn = 0;

        // Start intro text
        introState = {
            text: 'I solemnly swear that I am up to no good',
            charIndex: 0,
            startTime: performance.now(),
            phase: 'writing',
            phaseStart: 0,
            fadeAlpha: 1,
        };

        animId = requestAnimationFrame(render);
    }

    function cleanup() {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        const el = document.getElementById('marauder-map-canvas');
        if (el) el.remove();
        canvas = null;
        ctx = null;
        bgImage = null;
        bgImageLoaded = false;
        introState = null;
        thinkingTextState = null;
    }

    function onThemeChange() {
        const isMarauderTheme = document.documentElement.getAttribute('data-theme') === 'marauder';
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'marauder';
        if (isMarauderTheme || isCustomOverlay) {
            start();
        } else {
            cleanup();
        }
    }

    // ── Observer & Event Listeners ────────────────────────

    new MutationObserver(onThemeChange)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-custom-overlay'] });

    window.addEventListener('resize', () => {
        resize();
        if (canvas) {
            initInkDrips();
            // Re-position walkers relative to new canvas size
            walkers.forEach(walker => {
                const wp = walker.waypoints[walker.waypointIndex];
                const next = walker.waypoints[(walker.waypointIndex + 1) % walker.waypoints.length];
                walker.x = lerp(wp.x * W, next.x * W, walker.progress);
                walker.y = lerp(wp.y * H, next.y * H, walker.progress);
            });
        }
    });

    // Mouse tracking for ink splotches
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (effectiveTier === 'low') return;

        const now = performance.now();
        if (now - lastSplotchTime > 80 && canvas) {
            lastSplotchTime = now;
            addSplotch(mouseX, mouseY);
        }
    });

    // State events
    window.addEventListener('thinking-start', () => {
        isThinking = true;
        thinkingTick = 0;
        thinkingTextState = {
            text: 'Mischief Managed',
            charIndex: 0,
            startTime: performance.now(),
            phase: 'writing',
            phaseStart: 0,
            fadeAlpha: 1,
        };
    });
    window.addEventListener('thinking-end', () => { isThinking = false; });
    window.addEventListener('speaking-start', () => { isSpeaking = true; speakingTick = 0; });
    window.addEventListener('speaking-end', () => { isSpeaking = false; });

    // Names toggle
    window.addEventListener('marauder-names-change', (e) => {
        showNames = e.detail !== 'false' && e.detail !== false;
    });

    // Performance setting
    window.addEventListener('marauder-perf-change', (e) => {
        perfTier = e.detail;
        detectPerformance();
        initWalkers();
        initFlourishes();
        initInkDrips();
    });

    // Custom overlay speed/density change
    window.addEventListener('custom-speed-change', (e) => {
        customSpeedMult = CUSTOM_SPEED_MAP[e.detail] || 1.0;
    });
    window.addEventListener('custom-density-change', (e) => {
        customDensityMult = CUSTOM_DENSITY_MAP[e.detail] || 1.0;
        if (canvas) {
            initWalkers();
            initInkDrips();
        }
    });

    // Initial launch
    const isMarauderTheme = document.documentElement.getAttribute('data-theme') === 'marauder';
    const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'marauder';
    if (isMarauderTheme || isCustomOverlay) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    console.log('[marauder-map] Marauder\'s Map loaded');
})();
