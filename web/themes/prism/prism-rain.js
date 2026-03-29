/**
 * Prism Rain — Rainbow prismatic rain canvas animation.
 * A geometric prism splits white light into cascading rainbow columns.
 *
 * Visual layers (back→front):
 *   1.  Dark background (#080810)
 *   2.  Background stars + nebula clouds
 *   3.  Rainbow rain columns (main effect)
 *   4.  Central prism crystal with light refraction
 *   5.  Mouse reactivity glow
 *   6.  Bottom reflection pool
 *   7.  Particle bursts
 *   8.  Thinking pulse / speaking wave
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    let canvas, ctx, animId;
    let W = 0, H = 0;
    let tick = 0;

    // Custom overlay speed multiplier
    const CUSTOM_SPEED_MAP = { slow: 0.5, normal: 1.0, fast: 1.8 };
    let customSpeedMult = CUSTOM_SPEED_MAP[localStorage.getItem('custom-overlay-speed') || 'normal'];

    // State
    let isThinking = false;
    let thinkingTick = 0;
    let isSpeaking = false;
    let speakingTick = 0;

    // Performance
    let perfTier = 'auto';
    let effectiveTier = 'high';
    let targetFPS = 60;

    // Mouse
    let mouseX = -9999, mouseY = -9999;

    // Accent color
    let accentMode = 'rainbow';
    let accentHue = 0;
    const HUE_MAP = {
        red: 0, orange: 30, gold: 45, green: 120,
        blue: 220, purple: 270, pink: 330, cyan: 185
    };

    // Columns
    let columns = [];
    // Stars
    let stars = [];
    // Nebula
    let nebulae = [];
    // Particles
    let particles = [];
    // Ripples
    let ripples = [];

    // ── Accent Color ────────────────────────────────────────
    function loadAccent() {
        const stored = localStorage.getItem('prism-accent');
        if (stored && (stored === 'rainbow' || HUE_MAP[stored] !== undefined)) {
            accentMode = stored;
            if (stored !== 'rainbow') accentHue = HUE_MAP[stored];
        } else {
            accentMode = 'rainbow';
        }
    }

    // ── Canvas Setup ────────────────────────────────────────
    function ensureCanvas() {
        if (canvas && canvas.parentNode) return true;
        canvas = document.createElement('canvas');
        canvas.id = 'prism-rain-canvas';
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

    // ── Performance Detection ───────────────────────────────
    function detectPerformance() {
        const stored = localStorage.getItem('prism-perf-tier');
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

    // ── Initialize Columns ──────────────────────────────────
    function initColumns() {
        columns = [];
        const spacing = 3;
        let count = Math.floor(W / spacing);
        if (effectiveTier === 'low') count = Math.min(count, 200);
        for (let i = 0; i < count; i++) {
            const depth = Math.random();
            columns.push({
                x: i * spacing,
                y: Math.random() * H,
                vy: 1 + Math.random() * 2,
                hue: getColumnHue(i, count),
                depth: depth,
                width: depth > 0.7 ? 2.5 : depth > 0.4 ? 2 : 1.5,
                opacity: depth > 0.7 ? 1.0 : depth > 0.4 ? 0.7 : 0.45,
            });
        }
    }

    function getColumnHue(index, total) {
        if (accentMode === 'rainbow') {
            return (index / total) * 360;
        }
        return accentHue + (Math.random() * 30 - 15);
    }

    function updateColumnHues() {
        const total = columns.length;
        for (let i = 0; i < total; i++) {
            columns[i].hue = getColumnHue(i, total);
        }
    }

    // ── Initialize Stars ────────────────────────────────────
    function initStars() {
        stars = [];
        if (effectiveTier === 'low') return;
        const count = effectiveTier === 'medium' ? 100 : 200;
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: 0.5 + Math.random() * 1.5,
                brightness: 0.2 + Math.random() * 0.6,
                phase: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.03,
            });
        }
    }

    // ── Initialize Nebulae ──────────────────────────────────
    function initNebulae() {
        nebulae = [];
        if (effectiveTier === 'low') return;
        const count = effectiveTier === 'medium' ? 2 : 3;
        for (let i = 0; i < count; i++) {
            nebulae.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.6,
                radius: 150 + Math.random() * 200,
                hue: Math.random() * 360,
                vx: (Math.random() - 0.5) * 0.15,
                vy: (Math.random() - 0.5) * 0.08,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // DRAWING LAYERS
    // ═══════════════════════════════════════════════════════

    // ── 1. Background ───────────────────────────────────────
    function drawBackground() {
        if (document.documentElement.getAttribute('data-custom-overlay') === 'prism') {
            // Semi-transparent clear to preserve trail effect over custom bg
            ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';
            return;
        }
        ctx.fillStyle = 'rgba(8, 8, 16, 0.04)';
        ctx.fillRect(0, 0, W, H);
    }

    function drawFullBackground() {
        if (document.documentElement.getAttribute('data-custom-overlay') === 'prism') {
            ctx.clearRect(0, 0, W, H);
            return;
        }
        ctx.fillStyle = '#080810';
        ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Stars + Nebula ───────────────────────────────────
    function drawStars() {
        if (effectiveTier === 'low') return;
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const twinkle = Math.sin(tick * s.speed + s.phase) * 0.3 + 0.7;
            const alpha = s.brightness * twinkle;
            ctx.fillStyle = `rgba(220, 225, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawNebulae() {
        if (effectiveTier === 'low') return;
        for (let i = 0; i < nebulae.length; i++) {
            const n = nebulae[i];
            n.x += n.vx;
            n.y += n.vy;
            if (n.x < -n.radius) n.x = W + n.radius;
            if (n.x > W + n.radius) n.x = -n.radius;
            if (n.y < -n.radius) n.y = H * 0.6 + n.radius;
            if (n.y > H * 0.6 + n.radius) n.y = -n.radius;
            n.hue += 0.05;

            const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            grad.addColorStop(0, `hsla(${n.hue % 360}, 70%, 40%, 0.03)`);
            grad.addColorStop(0.5, `hsla(${(n.hue + 40) % 360}, 60%, 30%, 0.015)`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(n.x - n.radius, n.y - n.radius, n.radius * 2, n.radius * 2);
        }
    }

    // ── 3. Rainbow Rain Columns ─────────────────────────────
    function drawRainColumns() {
        const thinkMult = isThinking ? 1.5 : 1;

        for (let i = 0; i < columns.length; i++) {
            const c = columns[i];

            // Acceleration
            c.vy += 0.05 * thinkMult;
            c.y += c.vy * thinkMult;

            // Reset check
            if (c.y > H && Math.random() < 0.01) {
                c.y = -10 - Math.random() * 50;
                c.vy = 0;

                // Spawn particles on impact
                if (effectiveTier !== 'low') {
                    spawnParticles(c.x, H, c.hue);
                }

                // Spawn ripple
                if (effectiveTier !== 'low') {
                    spawnRipple(c.x);
                }
            }

            // Speaking wave offset
            let drawY = c.y;
            if (isSpeaking) {
                const distFromCenter = (c.x - W / 2) / W;
                drawY += Math.sin(distFromCenter * 10 + speakingTick * 0.08) * 8;
            }

            // Mouse proximity
            let lightness = 50;
            let extraWidth = 0;
            const dx = c.x - mouseX;
            const dy = drawY - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                const factor = 1 - dist / 150;
                lightness = 50 + factor * 20;
                extraWidth = factor * 1.5;
            }

            // Thinking brightness boost
            if (isThinking) {
                lightness = Math.min(lightness + 10, 80);
            }

            // Column body
            const colW = c.width + extraWidth;
            ctx.fillStyle = `hsla(${c.hue}, 80%, ${lightness}%, ${c.opacity})`;
            ctx.fillRect(c.x, drawY, colW, 6);

            // Bright head
            ctx.fillStyle = `hsla(${c.hue}, 85%, 80%, ${Math.min(c.opacity + 0.2, 1)})`;
            ctx.fillRect(c.x - 0.5, drawY, colW + 1, 2);
        }
    }

    // ── 4. Prism Crystal ────────────────────────────────────
    function drawPrism() {
        const cx = W / 2;
        const cy = H / 2;
        const size = 90;

        // Wobble
        const wobbleSpeed = isThinking ? 0.05 : 0.008;
        const wobble = Math.sin(tick * wobbleSpeed) * 0.04;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(wobble);

        // Triangle vertices (pointing up)
        const topX = 0, topY = -size / 2;
        const blX = -size * 0.55, blY = size / 2;
        const brX = size * 0.55, brY = size / 2;

        // Incoming white beam from top of screen
        ctx.save();
        ctx.rotate(-wobble); // undo rotation for beam
        const beamGrad = ctx.createLinearGradient(0, -cy, 0, topY);
        const beamAlpha = isThinking ? 0.5 : 0.25;
        beamGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
        beamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${beamAlpha * 0.5})`);
        beamGrad.addColorStop(1, `rgba(255, 255, 255, ${beamAlpha})`);
        ctx.strokeStyle = beamGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -cy);
        ctx.lineTo(0, topY);
        ctx.stroke();

        // Beam glow
        const beamGlow = ctx.createLinearGradient(0, -cy, 0, topY);
        beamGlow.addColorStop(0, 'rgba(255,255,255,0)');
        beamGlow.addColorStop(1, `rgba(255,255,255,${beamAlpha * 0.15})`);
        ctx.lineWidth = 12;
        ctx.strokeStyle = beamGlow;
        ctx.beginPath();
        ctx.moveTo(0, -cy);
        ctx.lineTo(0, topY);
        ctx.stroke();
        ctx.restore();

        // Refracted rainbow rays from bottom edge
        const rayCount = 12;
        for (let i = 0; i < rayCount; i++) {
            const t = i / (rayCount - 1);
            const startX = blX + (brX - blX) * t;
            const startY = blY;
            const angle = -Math.PI * 0.15 + t * Math.PI * 0.3 + Math.PI / 2;
            const rayLen = H * 0.6;
            const endX = startX + Math.cos(angle) * rayLen;
            const endY = startY + Math.sin(angle) * rayLen;
            const hue = t * 300;

            const rayGrad = ctx.createLinearGradient(startX, startY, endX, endY);
            const rayAlpha = 0.15 + (isThinking ? 0.1 : 0);
            rayGrad.addColorStop(0, `hsla(${hue}, 90%, 60%, ${rayAlpha})`);
            rayGrad.addColorStop(0.4, `hsla(${hue}, 80%, 50%, ${rayAlpha * 0.5})`);
            rayGrad.addColorStop(1, `hsla(${hue}, 70%, 40%, 0)`);
            ctx.strokeStyle = rayGrad;
            ctx.lineWidth = 4 + Math.sin(tick * 0.02 + i) * 1;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Prism fill
        const thinkGlow = isThinking ? 0.08 : 0;
        const speakGlow = isSpeaking ? Math.sin(speakingTick * 0.06) * 0.05 : 0;
        ctx.fillStyle = `rgba(200, 210, 255, ${0.06 + thinkGlow + speakGlow})`;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(blX, blY);
        ctx.lineTo(brX, brY);
        ctx.closePath();
        ctx.fill();

        // Prism edges
        const shimmer = Math.sin(tick * 0.03) * 0.15 + 0.5;
        const edgeAlpha = isThinking ? Math.min(shimmer + 0.3, 1) : shimmer;
        ctx.strokeStyle = `rgba(220, 230, 255, ${edgeAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(blX, blY);
        ctx.lineTo(brX, brY);
        ctx.closePath();
        ctx.stroke();

        // Edge shimmer flashes (occasional)
        if (effectiveTier !== 'low') {
            const flashPhase = (tick * 0.04) % (Math.PI * 2);
            if (flashPhase < 0.3) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - flashPhase / 0.3)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(topX, topY);
                ctx.lineTo(brX, brY);
                ctx.stroke();
            } else if (flashPhase > 2 && flashPhase < 2.3) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - (flashPhase - 2) / 0.3)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(topX, topY);
                ctx.lineTo(blX, blY);
                ctx.stroke();
            }
        }

        // Core glow
        const coreGlowAlpha = 0.08 + thinkGlow * 2 + speakGlow;
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.6);
        coreGrad.addColorStop(0, `rgba(200, 220, 255, ${coreGlowAlpha})`);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreGrad;
        ctx.fillRect(-size, -size, size * 2, size * 2);

        ctx.restore();

        // Thinking: white flash pulse rings from prism
        if (isThinking) {
            for (let i = 0; i < 3; i++) {
                const phase = (thinkingTick * 0.03 + i * 1.2) % 4;
                const r = phase * Math.min(W, H) * 0.1;
                const alpha = Math.max(0, 0.25 - phase * 0.06);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    // ── 5. Mouse Reactivity Glow ────────────────────────────
    function drawMouseGlow() {
        if (mouseX < 0 || mouseY < 0) return;

        // Find nearest column hue
        let nearestHue = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < columns.length; i++) {
            const d = Math.abs(columns[i].x - mouseX);
            if (d < nearestDist) {
                nearestDist = d;
                nearestHue = columns[i].hue;
            }
        }

        if (nearestDist < 150) {
            const grad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 120);
            grad.addColorStop(0, `hsla(${nearestHue}, 80%, 60%, 0.08)`);
            grad.addColorStop(0.5, `hsla(${nearestHue}, 70%, 50%, 0.03)`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(mouseX - 120, mouseY - 120, 240, 240);
        }
    }

    // ── 6. Bottom Reflection Pool ───────────────────────────
    function drawReflectionPool() {
        if (effectiveTier === 'low') return;

        const poolTop = H * 0.85;

        // Water surface line
        const surfaceAlpha = 0.15 + (isSpeaking ? Math.sin(speakingTick * 0.05) * 0.08 : 0);
        const surfGrad = ctx.createLinearGradient(0, poolTop, W, poolTop);
        surfGrad.addColorStop(0, `rgba(100, 140, 255, 0)`);
        surfGrad.addColorStop(0.3, `rgba(150, 180, 255, ${surfaceAlpha})`);
        surfGrad.addColorStop(0.5, `rgba(200, 220, 255, ${surfaceAlpha * 1.2})`);
        surfGrad.addColorStop(0.7, `rgba(150, 180, 255, ${surfaceAlpha})`);
        surfGrad.addColorStop(1, `rgba(100, 140, 255, 0)`);
        ctx.strokeStyle = surfGrad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, poolTop);
        ctx.lineTo(W, poolTop);
        ctx.stroke();

        // Reflected columns (upward, faint)
        const reflCount = Math.min(columns.length, effectiveTier === 'medium' ? 100 : 200);
        const step = Math.max(1, Math.floor(columns.length / reflCount));
        for (let i = 0; i < columns.length; i += step) {
            const c = columns[i];
            if (c.y < poolTop - 20) continue; // only reflect columns near bottom

            const reflY = poolTop + (poolTop - c.y) * 0.3;
            if (reflY > H) continue;
            const reflH = Math.min(20, H - reflY);
            ctx.fillStyle = `hsla(${c.hue}, 70%, 45%, ${c.opacity * 0.15})`;
            ctx.fillRect(c.x, reflY, c.width, reflH);
        }

        // Ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.radius += 0.8;
            r.life -= 0.015;
            if (r.life <= 0) {
                ripples.splice(i, 1);
                continue;
            }
            const intensify = isSpeaking ? 1.5 : 1;
            ctx.strokeStyle = `hsla(${r.hue}, 60%, 55%, ${r.life * 0.2 * intensify})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(r.x, poolTop, r.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function spawnRipple(x) {
        if (ripples.length > 30) return;
        const nearCol = columns.find(c => Math.abs(c.x - x) < 5);
        ripples.push({
            x: x,
            radius: 1,
            life: 1,
            hue: nearCol ? nearCol.hue : Math.random() * 360,
        });
    }

    // ── 7. Particle Bursts ──────────────────────────────────
    function drawParticles() {
        if (effectiveTier === 'low') return;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // gravity
            p.life--;

            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            const alpha = p.life / p.maxLife;
            ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function spawnParticles(x, y, hue) {
        if (particles.length > 50) return;
        const count = effectiveTier === 'high' ? 5 : 3;
        for (let i = 0; i < count; i++) {
            const life = 30 + Math.floor(Math.random() * 10);
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 3,
                vy: -(1 + Math.random() * 3),
                hue: hue + (Math.random() - 0.5) * 20,
                size: 1 + Math.random() * 2,
                life: life,
                maxLife: life,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // MAIN RENDER LOOP
    // ═══════════════════════════════════════════════════════

    let lastFrameTime = 0;
    let firstFrame = true;

    function render(timestamp) {
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'prism';
        if (!canvas || !canvas.parentNode || (document.documentElement.getAttribute('data-theme') !== 'prism' && !isCustomOverlay)) {
            cleanup();
            return;
        }

        const frameInterval = 1000 / targetFPS;
        if (timestamp - lastFrameTime < frameInterval) {
            animId = requestAnimationFrame(render);
            return;
        }
        lastFrameTime = timestamp;

        tick += (document.documentElement.getAttribute('data-custom-overlay') ? customSpeedMult : 1);

        // First frame: full opaque background to avoid flash
        if (firstFrame) {
            drawFullBackground();
            firstFrame = false;
        }

        // Fade trail
        drawBackground();

        // Persistent layers redrawn over fade
        drawStars();
        drawNebulae();

        // Main rain
        drawRainColumns();

        // Prism
        drawPrism();

        // Mouse
        drawMouseGlow();

        // Reflection
        drawReflectionPool();

        // Particles
        drawParticles();

        animId = requestAnimationFrame(render);
    }

    // ═══════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════

    function start() {
        if (animId) return;
        if (!ensureCanvas()) return;
        detectPerformance();
        loadAccent();
        initColumns();
        initStars();
        initNebulae();
        particles = [];
        ripples = [];
        tick = 0;
        firstFrame = true;
        animId = requestAnimationFrame(render);
    }

    function cleanup() {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        const el = document.getElementById('prism-rain-canvas');
        if (el) el.remove();
        canvas = null;
        ctx = null;
    }

    function onThemeChange() {
        const theme = document.documentElement.getAttribute('data-theme');
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'prism';
        if (theme === 'prism' || isCustomOverlay) {
            start();
        } else {
            cleanup();
        }
    }

    new MutationObserver(onThemeChange)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-custom-overlay'] });

    window.addEventListener('resize', () => {
        resize();
        initColumns();
        initStars();
        initNebulae();
    });

    // Mouse tracking (on document since canvas is pointer-events:none)
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // State events
    window.addEventListener('thinking-start', () => { isThinking = true; thinkingTick = 0; });
    window.addEventListener('thinking-end', () => { isThinking = false; });
    window.addEventListener('speaking-start', () => { isSpeaking = true; speakingTick = 0; });
    window.addEventListener('speaking-end', () => { isSpeaking = false; });

    // Performance setting
    window.addEventListener('prism-perf-change', (e) => {
        perfTier = e.detail;
        detectPerformance();
        initColumns();
        initStars();
        initNebulae();
        particles = [];
        ripples = [];
    });

    // Accent color change
    window.addEventListener('prism-accent-change', (e) => {
        const val = e.detail;
        if (val === 'rainbow' || HUE_MAP[val] !== undefined) {
            accentMode = val;
            if (val !== 'rainbow') accentHue = HUE_MAP[val];
            updateColumnHues();
        }
    });

    // Custom overlay speed change
    window.addEventListener('custom-speed-change', (e) => {
        customSpeedMult = CUSTOM_SPEED_MAP[e.detail] || 1.0;
    });

    // Initial launch
    const isCustomOverlayInit = document.documentElement.getAttribute('data-custom-overlay') === 'prism';
    if (document.documentElement.getAttribute('data-theme') === 'prism' || isCustomOverlayInit) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    console.log('[prism-rain] Prism Rainbow loaded');
})();
