/**
 * Nexus Network Canvas — Animated node-and-connection network.
 * Adapted from a CodePen particle network effect with vanilla JS easing
 * replacing GSAP/TweenLite, plus performance tiers, thinking/speaking
 * effects, background stars, node glow, and connection pulses.
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    let canvas, ctx, animId;
    let W = 0, H = 0;
    let tick = 0;

    // Network state
    let points = [];
    let stars = [];
    let pulses = [];
    let target = { x: 0, y: 0 };
    let animateHeader = true;

    // Thinking / speaking
    let isThinking = false;
    let thinkingTick = 0;
    let isSpeaking = false;
    let speakingTick = 0;
    let speakingFade = 0;

    // Performance
    let perfTier = 'auto';
    let effectiveTier = 'high';
    let targetFPS = 60;

    // ── Circular Ease In-Out ────────────────────────────────
    function circEaseInOut(t) {
        return t < 0.5
            ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
            : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
    }

    // ── Distance (squared) ─────────────────────────────────
    function getDistance(p1, p2) {
        return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
    }

    // ── Canvas Setup ────────────────────────────────────────
    function ensureCanvas() {
        if (canvas && canvas.parentNode) return true;
        canvas = document.createElement('canvas');
        canvas.id = 'nexus-network-canvas';
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
        target.x = W / 2;
        target.y = H / 2;
    }

    // ── Performance Detection ───────────────────────────────
    function detectPerformance() {
        const stored = localStorage.getItem('nexus-perf-tier');
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

    // ── Grid Divisor per Tier ───────────────────────────────
    function getGridDivisor() {
        return effectiveTier === 'low' ? 15 : 20;
    }

    // ── Assign New Tween Target ─────────────────────────────
    function assignNewTarget(p) {
        p.startX = p.x;
        p.startY = p.y;
        p.targetX = p.originX - 50 + Math.random() * 100;
        p.targetY = p.originY - 50 + Math.random() * 100;
        p.progress = 0;
        // Duration: 1-2 seconds worth of frames at 60fps baseline
        p.duration = (1 + Math.random()) * 60;
    }

    // ── Update Point Tween ──────────────────────────────────
    function updatePointTween(p) {
        p.progress += 1 / p.duration;
        if (p.progress >= 1) {
            p.progress = 1;
            p.x = p.targetX;
            p.y = p.targetY;
            assignNewTarget(p);
        } else {
            var eased = circEaseInOut(p.progress);
            p.x = p.startX + (p.targetX - p.startX) * eased;
            p.y = p.startY + (p.targetY - p.startY) * eased;
        }
    }

    // ── Initialize Points ───────────────────────────────────
    function initPoints() {
        points = [];
        var divisor = getGridDivisor();
        var stepX = W / divisor;
        var stepY = H / divisor;

        for (var gx = 0; gx < W; gx += stepX) {
            for (var gy = 0; gy < H; gy += stepY) {
                var px = gx + Math.random() * stepX;
                var py = gy + Math.random() * stepY;
                var p = {
                    x: px, y: py,
                    originX: px, originY: py,
                    startX: px, startY: py,
                    targetX: px, targetY: py,
                    progress: 0,
                    duration: (1 + Math.random()) * 60,
                    active: 0,
                    circleActive: 0,
                    radius: 2 + Math.random() * 2,
                    closest: []
                };
                points.push(p);
            }
        }

        // Find 5 closest neighbours for each point
        for (var i = 0; i < points.length; i++) {
            var closest = [];
            var p1 = points[i];
            for (var j = 0; j < points.length; j++) {
                if (i === j) continue;
                var p2 = points[j];
                var dist = getDistance(p1, p2);

                if (closest.length < 5) {
                    closest.push({ point: p2, dist: dist });
                    closest.sort(function(a, b) { return a.dist - b.dist; });
                } else if (dist < closest[4].dist) {
                    closest[4] = { point: p2, dist: dist };
                    closest.sort(function(a, b) { return a.dist - b.dist; });
                }
            }
            p1.closest = closest.map(function(c) { return c.point; });
        }

        // Start each point's tween
        for (var k = 0; k < points.length; k++) {
            assignNewTarget(points[k]);
        }
    }

    // ── Initialize Stars ────────────────────────────────────
    function initStars() {
        stars = [];
        var count = effectiveTier === 'low' ? 40 : effectiveTier === 'medium' ? 60 : 80;
        for (var i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: 0.5 + Math.random() * 0.5,
                baseAlpha: 0.1 + Math.random() * 0.2,
                phase: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.02
            });
        }
    }

    // ── Initialize Pulses ───────────────────────────────────
    function initPulses() {
        pulses = [];
    }

    function maybeSpawnPulse() {
        if (pulses.length > 3) return;
        if (Math.random() > 0.005) return; // ~0.5% chance per frame

        // Find an active point with active neighbours
        var candidates = [];
        for (var i = 0; i < points.length; i++) {
            if (points[i].active > 0.05) {
                for (var j = 0; j < points[i].closest.length; j++) {
                    if (points[i].closest[j].active > 0.05) {
                        candidates.push({ from: points[i], to: points[i].closest[j] });
                    }
                }
            }
        }
        if (candidates.length === 0) return;

        var pair = candidates[Math.floor(Math.random() * candidates.length)];
        pulses.push({
            from: pair.from,
            to: pair.to,
            progress: 0,
            speed: 0.015 + Math.random() * 0.01
        });
    }

    // ── Drawing ─────────────────────────────────────────────

    function drawBackground() {
        // Deep space black fill
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, W, H);

        // Subtle warm amber glow from the right
        var amberX = W * 0.85;
        var amberY = H * 0.4;
        var amberR = Math.max(W, H) * 0.6;
        var amberGrad = ctx.createRadialGradient(amberX, amberY, 0, amberX, amberY, amberR);
        amberGrad.addColorStop(0, 'rgba(232, 168, 76, 0.03)');
        amberGrad.addColorStop(0.5, 'rgba(232, 168, 76, 0.015)');
        amberGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = amberGrad;
        ctx.fillRect(0, 0, W, H);
    }

    function drawStars() {
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var alpha = s.baseAlpha + Math.sin(tick * s.speed + s.phase) * 0.1;
            if (alpha < 0) alpha = 0;
            ctx.fillStyle = 'rgba(156, 217, 249, ' + alpha + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawLines(p) {
        if (!p.active) return;

        // Thinking boost
        var boost = 0;
        if (isThinking) {
            boost = Math.sin(thinkingTick * 0.08) * 0.15;
        }

        for (var i = 0; i < p.closest.length; i++) {
            var alpha = p.active + boost;
            if (alpha > 1) alpha = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.closest[i].x, p.closest[i].y);
            ctx.strokeStyle = 'rgba(156, 217, 249, ' + alpha + ')';
            ctx.lineWidth = 0.6;
            ctx.stroke();
        }
    }

    function drawCircle(p) {
        if (!p.circleActive) return;

        var alpha = p.circleActive;

        // Thinking boost
        if (isThinking) {
            alpha += Math.sin(thinkingTick * 0.08) * 0.2;
            if (alpha > 1) alpha = 1;
        }

        // Glow effect for active nodes near mouse
        if (p.circleActive > 0.2) {
            var glowR = p.radius * 4;
            var glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
            glow.addColorStop(0, 'rgba(156, 217, 249, ' + (alpha * 0.3) + ')');
            glow.addColorStop(1, 'rgba(156, 217, 249, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
        }

        // Core circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = 'rgba(156, 217, 249, ' + alpha + ')';
        ctx.fill();
    }

    function drawPulses() {
        for (var i = pulses.length - 1; i >= 0; i--) {
            var pulse = pulses[i];
            pulse.progress += pulse.speed;
            if (pulse.progress >= 1) {
                pulses.splice(i, 1);
                continue;
            }

            var px = pulse.from.x + (pulse.to.x - pulse.from.x) * pulse.progress;
            var py = pulse.from.y + (pulse.to.y - pulse.from.y) * pulse.progress;

            // Fade in and out
            var alpha = pulse.progress < 0.5
                ? pulse.progress * 2
                : (1 - pulse.progress) * 2;
            alpha *= 0.8;

            var glowR = 4;
            var glow = ctx.createRadialGradient(px, py, 0, px, py, glowR);
            glow.addColorStop(0, 'rgba(200, 230, 255, ' + alpha + ')');
            glow.addColorStop(1, 'rgba(156, 217, 249, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(px - glowR, py - glowR, glowR * 2, glowR * 2);

            // Bright center dot
            ctx.beginPath();
            ctx.arc(px, py, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(220, 240, 255, ' + alpha + ')';
            ctx.fill();
        }
    }

    function drawSpeakingWave() {
        if (!isSpeaking && speakingFade <= 0) return;

        if (isSpeaking) {
            speakingFade = Math.min(speakingFade + 0.05, 1);
        } else {
            speakingFade = Math.max(speakingFade - 0.03, 0);
        }
        if (speakingFade <= 0) return;

        var cx = W / 2;
        var cy = H / 2;
        var maxR = Math.max(W, H) * 0.8;
        var waveR = (speakingTick * 3) % maxR;
        var waveAlpha = (1 - waveR / maxR) * 0.08 * speakingFade;

        if (waveAlpha > 0.001) {
            ctx.beginPath();
            ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(156, 217, 249, ' + waveAlpha + ')';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // ── Main Render Loop ────────────────────────────────────

    var lastFrameTime = 0;

    function render(timestamp) {
        if (!canvas || !canvas.parentNode || document.documentElement.getAttribute('data-theme') !== 'nexus') {
            cleanup();
            return;
        }

        var frameInterval = 1000 / targetFPS;
        if (timestamp - lastFrameTime < frameInterval) {
            animId = requestAnimationFrame(render);
            return;
        }
        lastFrameTime = timestamp;

        tick++;
        if (isThinking) thinkingTick++;
        if (isSpeaking) speakingTick++;

        // Update all point tweens
        for (var i = 0; i < points.length; i++) {
            updatePointTween(points[i]);
        }

        // Compute activity levels based on mouse proximity
        var thinkingBoost = isThinking ? 1.5 : 1;
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            var dist = getDistance(target, p);

            // Speaking wave activation
            var speakingActive = 0;
            if (isSpeaking || speakingFade > 0) {
                var cx = W / 2, cy = H / 2;
                var distFromCenter = Math.sqrt(getDistance({ x: cx, y: cy }, p));
                var maxR = Math.max(W, H) * 0.8;
                var waveR = (speakingTick * 3) % maxR;
                var waveDist = Math.abs(distFromCenter - waveR);
                if (waveDist < 80) {
                    speakingActive = (1 - waveDist / 80) * 0.2 * speakingFade;
                }
            }

            if (dist < 4000 * thinkingBoost) {
                p.active = 0.3 + speakingActive;
                p.circleActive = 0.6 + speakingActive;
            } else if (dist < 20000 * thinkingBoost) {
                p.active = 0.1 + speakingActive;
                p.circleActive = 0.3 + speakingActive;
            } else if (dist < 40000 * thinkingBoost) {
                p.active = 0.02 + speakingActive;
                p.circleActive = 0.1 + speakingActive;
            } else {
                p.active = speakingActive;
                p.circleActive = speakingActive;
            }
        }

        // Draw
        ctx.clearRect(0, 0, W, H);
        drawBackground();
        drawStars();

        for (var i = 0; i < points.length; i++) {
            drawLines(points[i]);
            drawCircle(points[i]);
        }

        maybeSpawnPulse();
        drawPulses();
        drawSpeakingWave();

        animId = requestAnimationFrame(render);
    }

    // ── Lifecycle ───────────────────────────────────────────

    function start() {
        if (animId) return;
        if (!ensureCanvas()) return;
        detectPerformance();
        initPoints();
        initStars();
        initPulses();
        tick = 0;
        thinkingTick = 0;
        speakingTick = 0;
        speakingFade = 0;
        lastFrameTime = 0;
        animId = requestAnimationFrame(render);
    }

    function cleanup() {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        var el = document.getElementById('nexus-network-canvas');
        if (el) el.remove();
        canvas = null;
        ctx = null;
        points = [];
        stars = [];
        pulses = [];
    }

    function onThemeChange() {
        var theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'nexus') {
            start();
        } else {
            cleanup();
        }
    }

    // ── Event Listeners ─────────────────────────────────────

    new MutationObserver(onThemeChange)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    window.addEventListener('resize', function() {
        resize();
        if (canvas) {
            initPoints();
            initStars();
        }
    });

    // Mouse tracking on document (canvas has pointer-events:none)
    document.addEventListener('mousemove', function(e) {
        var posx, posy;
        if (e.pageX || e.pageY) {
            posx = e.pageX;
            posy = e.pageY;
        } else {
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        target.x = posx;
        target.y = posy;
    });

    window.addEventListener('scroll', function() {
        if (document.body.scrollTop > H) animateHeader = false;
        else animateHeader = true;
    });

    // Thinking / speaking
    window.addEventListener('thinking-start', function() { isThinking = true; thinkingTick = 0; });
    window.addEventListener('thinking-end', function() { isThinking = false; });
    window.addEventListener('speaking-start', function() { isSpeaking = true; speakingTick = 0; });
    window.addEventListener('speaking-end', function() { isSpeaking = false; });

    // Performance setting
    window.addEventListener('nexus-perf-change', function(e) {
        perfTier = e.detail;
        detectPerformance();
        if (canvas) {
            initPoints();
            initStars();
            initPulses();
        }
    });

    // Initial launch
    if (document.documentElement.getAttribute('data-theme') === 'nexus') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    console.log('[nexus-network] Nexus network loaded');
})();
