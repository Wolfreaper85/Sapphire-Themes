/**
 * Cosmos Solar System — Animated space/solar system canvas.
 * Full orbital system with star field, nebula clouds, planets, and effects.
 *
 * Visual layers (back→front):
 *   1.  Deep space background (#020108)
 *   2.  Nebula clouds (soft radial gradients)
 *   3.  Star field with mouse proximity glow
 *   4.  Shooting stars
 *   5.  Orbit paths (faint ellipses)
 *   6.  Asteroid belt
 *   7.  Sun with corona and lens flares
 *   8.  Planets with atmospheres and moons
 *   9.  Saturn rings
 *  10.  Thinking effect (sun flare + pulse rings)
 *  11.  Speaking effect (wave ripple + atmosphere pulses)
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    let canvas, ctx, animId;
    let W = 0, H = 0;
    let tick = 0;
    let scale = 1;

    // Mouse tracking (document-level since canvas is pointer-events:none)
    let mouseX = -9999, mouseY = -9999;

    // State
    let isThinking = false;
    let thinkingTick = 0;
    let isSpeaking = false;
    let speakingTick = 0;

    // Performance
    let perfTier = 'auto';
    let effectiveTier = 'high';
    let targetFPS = 60;

    // Dynamic elements
    let stars = [];
    let nebulae = [];
    let asteroids = [];
    let shootingStars = [];
    let thinkingRings = [];

    // Planet definitions (populated in init)
    let planets = [];

    // ── Canvas Setup ──────────────────────────────────────
    function ensureCanvas() {
        if (canvas && canvas.parentNode) return true;
        canvas = document.createElement('canvas');
        canvas.id = 'cosmos-solar-canvas';
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
        scale = Math.min(W, H) / 1000;
    }

    // ── Performance Detection ─────────────────────────────
    function detectPerformance() {
        const stored = localStorage.getItem('cosmos-perf-tier');
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

    // ── Initialize dynamic elements ───────────────────────
    function initStars() {
        stars = [];
        const count = effectiveTier === 'low' ? 150 : effectiveTier === 'medium' ? 300 : 400;
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 0.5 + Math.random() * 2.0,
                baseAlpha: 0.3 + Math.random() * 0.7,
                twinkleSpeed: 0.01 + Math.random() * 0.03,
                twinkleOffset: Math.random() * Math.PI * 2,
            });
        }
    }

    function initNebulae() {
        nebulae = [];
        if (effectiveTier === 'low') return;
        const count = 3 + Math.floor(Math.random() * 3); // 3-5
        const palette = [
            { r: 120, g: 40, b: 160 },  // purple
            { r: 40, g: 60, b: 180 },   // blue
            { r: 160, g: 50, b: 120 },  // pink
            { r: 60, g: 80, b: 200 },   // deeper blue
            { r: 140, g: 30, b: 140 },  // magenta
        ];
        for (let i = 0; i < count; i++) {
            nebulae.push({
                x: W * (0.1 + Math.random() * 0.8),
                y: H * (0.1 + Math.random() * 0.8),
                radius: 150 + Math.random() * 250,
                color: palette[i % palette.length],
                alpha: 0.03 + Math.random() * 0.03,
                driftAngle: Math.random() * Math.PI * 2,
                driftSpeed: 0.0003 + Math.random() * 0.0005,
                driftRadius: 20 + Math.random() * 40,
            });
        }
    }

    function initPlanets() {
        planets = [
            {
                name: 'mercury', radius: 3, color: '#8c8c8c',
                orbitRadius: 80, speed: 0.012, angle: Math.random() * Math.PI * 2,
                eccentricity: 0.04, atmosphereColor: { r: 140, g: 140, b: 140 },
            },
            {
                name: 'venus', radius: 5, color: '#e8c56d',
                orbitRadius: 110, speed: 0.009, angle: Math.random() * Math.PI * 2,
                eccentricity: 0.03, atmosphereColor: { r: 232, g: 197, b: 109 },
            },
            {
                name: 'earth', radius: 6, color: '#4a90d9',
                orbitRadius: 150, speed: 0.007, angle: Math.random() * Math.PI * 2,
                eccentricity: 0.03, atmosphereColor: { r: 74, g: 144, b: 217 },
                moon: { radius: 1.5, orbitRadius: 14, speed: 0.04, angle: Math.random() * Math.PI * 2, color: '#aaaaaa' },
            },
            {
                name: 'mars', radius: 4, color: '#c1440e',
                orbitRadius: 190, speed: 0.005, angle: Math.random() * Math.PI * 2,
                eccentricity: 0.05, atmosphereColor: { r: 193, g: 68, b: 14 },
            },
            {
                name: 'jupiter', radius: 14, color: '#c88b3a',
                orbitRadius: 260, speed: 0.002, angle: Math.random() * Math.PI * 2,
                eccentricity: 0.03, atmosphereColor: { r: 200, g: 139, b: 58 },
                bands: ['#c88b3a', '#a67c52', '#d4a04a', '#b8884a', '#c88b3a', '#a67c52', '#d4a04a'],
                hasRedSpot: true,
            },
            {
                name: 'saturn', radius: 12, color: '#d4a04a',
                orbitRadius: 330, speed: 0.0012, angle: Math.random() * Math.PI * 2,
                eccentricity: 0.03, atmosphereColor: { r: 212, g: 160, b: 74 },
                hasRings: true,
            },
            {
                name: 'uranus', radius: 8, color: '#7de8d4',
                orbitRadius: 400, speed: 0.0007, angle: Math.random() * Math.PI * 2,
                eccentricity: 0.02, atmosphereColor: { r: 125, g: 232, b: 212 },
            },
            {
                name: 'neptune', radius: 8, color: '#3454d1',
                orbitRadius: 460, speed: 0.0004, angle: Math.random() * Math.PI * 2,
                eccentricity: 0.02, atmosphereColor: { r: 52, g: 84, b: 209 },
            },
        ];
    }

    function initAsteroids() {
        asteroids = [];
        if (effectiveTier === 'low') return;
        const count = effectiveTier === 'medium' ? 50 : 80;
        for (let i = 0; i < count; i++) {
            asteroids.push({
                angle: Math.random() * Math.PI * 2,
                orbitRadius: 220 + Math.random() * 30,
                speed: 0.003 + Math.random() * 0.002,
                size: 0.5 + Math.random() * 0.5,
                alpha: 0.2 + Math.random() * 0.3,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // DRAWING LAYERS
    // ═══════════════════════════════════════════════════════

    // ── 1. Background ─────────────────────────────────────
    function drawBackground() {
        ctx.fillStyle = '#020108';
        ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Nebula Clouds ──────────────────────────────────
    function drawNebulae() {
        if (effectiveTier === 'low') return;
        nebulae.forEach(n => {
            // Slowly drift
            n.driftAngle += n.driftSpeed;
            const dx = Math.cos(n.driftAngle) * n.driftRadius;
            const dy = Math.sin(n.driftAngle * 0.7) * n.driftRadius;
            const nx = n.x + dx;
            const ny = n.y + dy;

            const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.radius);
            grad.addColorStop(0, `rgba(${n.color.r},${n.color.g},${n.color.b},${n.alpha})`);
            grad.addColorStop(0.5, `rgba(${n.color.r},${n.color.g},${n.color.b},${n.alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(nx, ny, n.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ── 3. Star Field ─────────────────────────────────────
    function drawStars() {
        stars.forEach(s => {
            // Twinkling
            const twinkle = Math.sin(tick * s.twinkleSpeed + s.twinkleOffset);
            let alpha = s.baseAlpha * (0.6 + 0.4 * twinkle);
            let radius = s.r;

            // Mouse proximity effect
            const dx = s.x - mouseX;
            const dy = s.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                const proximity = 1 - dist / 150;
                alpha = Math.min(1, alpha + proximity * 0.6);
                radius = s.r + proximity * 1.5;
            }

            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ── 4. Shooting Stars ─────────────────────────────────
    function updateAndDrawShootingStars() {
        if (effectiveTier === 'low') return;

        // Spawn
        if (shootingStars.length < 3 && Math.random() < 0.002) {
            const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.3;
            const speed = 8 + Math.random() * 6;
            shootingStars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0,
                maxLife: 20 + Math.floor(Math.random() * 15),
                length: 30 + Math.random() * 20,
            });
        }

        // Update and draw
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const ss = shootingStars[i];
            ss.x += ss.vx;
            ss.y += ss.vy;
            ss.life++;

            if (ss.life >= ss.maxLife || ss.x > W + 50 || ss.y > H + 50 || ss.x < -50 || ss.y < -50) {
                shootingStars.splice(i, 1);
                continue;
            }

            const progress = ss.life / ss.maxLife;
            const headAlpha = Math.max(0, 1 - progress);
            const tailX = ss.x - (ss.vx / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.length;
            const tailY = ss.y - (ss.vy / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.length;

            const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
            grad.addColorStop(0, `rgba(255,255,255,0)`);
            grad.addColorStop(0.7, `rgba(255,255,255,${headAlpha * 0.3})`);
            grad.addColorStop(1, `rgba(255,255,255,${headAlpha})`);

            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(ss.x, ss.y);
            ctx.stroke();

            // Bright head dot
            ctx.fillStyle = `rgba(255,255,255,${headAlpha})`;
            ctx.beginPath();
            ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── 5. Orbit Paths ────────────────────────────────────
    function drawOrbitPaths() {
        const cx = W / 2, cy = H / 2;

        planets.forEach(p => {
            const orbitRx = p.orbitRadius * scale;
            const orbitRy = orbitRx * (1 - p.eccentricity);

            ctx.strokeStyle = `rgba(255,255,255,0.07)`;
            ctx.lineWidth = 0.5;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.ellipse(cx, cy, orbitRx, orbitRy, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }

    // ── 6. Asteroid Belt ──────────────────────────────────
    function drawAsteroidBelt() {
        if (effectiveTier === 'low') return;
        const cx = W / 2, cy = H / 2;

        asteroids.forEach(a => {
            a.angle += a.speed * 0.016;
            const rx = a.orbitRadius * scale;
            const ry = rx * 0.96;
            const ax = cx + Math.cos(a.angle) * rx;
            const ay = cy + Math.sin(a.angle) * ry;

            ctx.fillStyle = `rgba(160,140,120,${a.alpha})`;
            ctx.beginPath();
            ctx.arc(ax, ay, a.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ── 7. Sun ────────────────────────────────────────────
    function drawSun() {
        const cx = W / 2, cy = H / 2;
        const baseR = 35 * scale;
        const pulse = Math.sin(tick * 0.02) * 2 * scale;
        const r = baseR + pulse;

        // Thinking boost
        const thinkBoost = isThinking ? 1 + Math.sin(thinkingTick * 0.08) * 0.4 : 1;

        // Corona glow (large, soft)
        const coronaR = r * 4 * thinkBoost;
        const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, coronaR);
        corona.addColorStop(0, `rgba(255,200,50,${0.15 * thinkBoost})`);
        corona.addColorStop(0.3, `rgba(255,160,20,${0.06 * thinkBoost})`);
        corona.addColorStop(0.6, `rgba(255,100,0,${0.02 * thinkBoost})`);
        corona.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = corona;
        ctx.beginPath();
        ctx.arc(cx, cy, coronaR, 0, Math.PI * 2);
        ctx.fill();

        // Sun body
        const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        sunGrad.addColorStop(0, `rgba(255,255,240,${0.95 * thinkBoost})`);
        sunGrad.addColorStop(0.3, `rgba(255,230,140,${0.9 * thinkBoost})`);
        sunGrad.addColorStop(0.7, `rgba(255,180,50,${0.7 * thinkBoost})`);
        sunGrad.addColorStop(1, 'rgba(255,120,0,0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Lens flare — horizontal
        const flareW = r * 5;
        const hFlare = ctx.createLinearGradient(cx - flareW, cy, cx + flareW, cy);
        hFlare.addColorStop(0, 'rgba(0,0,0,0)');
        hFlare.addColorStop(0.4, `rgba(255,220,100,${0.03 * thinkBoost})`);
        hFlare.addColorStop(0.5, `rgba(255,255,200,${0.06 * thinkBoost})`);
        hFlare.addColorStop(0.6, `rgba(255,220,100,${0.03 * thinkBoost})`);
        hFlare.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hFlare;
        ctx.fillRect(cx - flareW, cy - 1.5, flareW * 2, 3);

        // Lens flare — vertical
        const vFlare = ctx.createLinearGradient(cx, cy - flareW * 0.5, cx, cy + flareW * 0.5);
        vFlare.addColorStop(0, 'rgba(0,0,0,0)');
        vFlare.addColorStop(0.4, `rgba(255,220,100,${0.02 * thinkBoost})`);
        vFlare.addColorStop(0.5, `rgba(255,255,200,${0.04 * thinkBoost})`);
        vFlare.addColorStop(0.6, `rgba(255,220,100,${0.02 * thinkBoost})`);
        vFlare.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vFlare;
        ctx.fillRect(cx - 1, cy - flareW * 0.5, 2, flareW);
    }

    // ── 8. Planets ────────────────────────────────────────
    function drawPlanets() {
        const cx = W / 2, cy = H / 2;
        const speakPulse = isSpeaking ? 1 + Math.sin(speakingTick * 0.1) * 0.3 : 1;

        planets.forEach(p => {
            p.angle += p.speed;
            const orbitRx = p.orbitRadius * scale;
            const orbitRy = orbitRx * (1 - p.eccentricity);
            const px = cx + Math.cos(p.angle) * orbitRx;
            const py = cy + Math.sin(p.angle) * orbitRy;
            const pr = p.radius * scale;

            // Atmosphere glow
            const atmosR = pr * 2.5 * speakPulse;
            const atmos = ctx.createRadialGradient(px, py, pr * 0.5, px, py, atmosR);
            atmos.addColorStop(0, `rgba(${p.atmosphereColor.r},${p.atmosphereColor.g},${p.atmosphereColor.b},0.15)`);
            atmos.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = atmos;
            ctx.beginPath();
            ctx.arc(px, py, atmosR, 0, Math.PI * 2);
            ctx.fill();

            // Saturn rings — draw behind planet
            if (p.hasRings) {
                drawSaturnRings(px, py, pr);
            }

            // Jupiter bands
            if (p.bands) {
                drawJupiter(px, py, pr, p);
            } else {
                // Regular planet body
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(px, py, pr, 0, Math.PI * 2);
                ctx.fill();

                // Subtle shading (lit from center/sun direction)
                const shadeDx = px - cx;
                const shadeDy = py - cy;
                const shadeDist = Math.sqrt(shadeDx * shadeDx + shadeDy * shadeDy);
                if (shadeDist > 0) {
                    const shadeGrad = ctx.createRadialGradient(
                        px - (shadeDx / shadeDist) * pr * 0.3,
                        py - (shadeDy / shadeDist) * pr * 0.3,
                        0, px, py, pr
                    );
                    shadeGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
                    shadeGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
                    shadeGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
                    ctx.fillStyle = shadeGrad;
                    ctx.beginPath();
                    ctx.arc(px, py, pr, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Earth's moon
            if (p.moon) {
                p.moon.angle += p.moon.speed;
                const moonR = p.moon.radius * scale;
                const moonOrbit = p.moon.orbitRadius * scale;
                const mx = px + Math.cos(p.moon.angle) * moonOrbit;
                const my = py + Math.sin(p.moon.angle) * moonOrbit;

                ctx.fillStyle = p.moon.color;
                ctx.beginPath();
                ctx.arc(mx, my, moonR, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    function drawJupiter(px, py, pr, planet) {
        // Clip to planet circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.clip();

        // Draw bands
        const bandCount = planet.bands.length;
        const bandH = (pr * 2) / bandCount;
        for (let i = 0; i < bandCount; i++) {
            ctx.fillStyle = planet.bands[i];
            ctx.fillRect(px - pr, py - pr + i * bandH, pr * 2, bandH + 1);
        }

        // Great Red Spot
        if (planet.hasRedSpot) {
            const spotAngle = tick * 0.015;
            const spotX = px + Math.cos(spotAngle) * pr * 0.4;
            const spotY = py + pr * 0.15;
            ctx.fillStyle = 'rgba(180,60,30,0.6)';
            ctx.beginPath();
            ctx.ellipse(spotX, spotY, pr * 0.2, pr * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Outer circle stroke for definition
        ctx.strokeStyle = 'rgba(160,120,60,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawSaturnRings(px, py, pr) {
        const ringOuterRx = pr * 2.2;
        const ringOuterRy = pr * 0.6;
        const ringInnerRx = pr * 1.4;
        const ringInnerRy = pr * 0.4;

        // Outer ring
        ctx.strokeStyle = 'rgba(210,180,120,0.35)';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.ellipse(px, py, ringOuterRx, ringOuterRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Middle ring
        ctx.strokeStyle = 'rgba(200,170,100,0.25)';
        ctx.lineWidth = 2 * scale;
        const midRx = (ringOuterRx + ringInnerRx) / 2;
        const midRy = (ringOuterRy + ringInnerRy) / 2;
        ctx.beginPath();
        ctx.ellipse(px, py, midRx, midRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring
        ctx.strokeStyle = 'rgba(190,160,90,0.2)';
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.ellipse(px, py, ringInnerRx, ringInnerRy, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    // ── 10. Thinking Effect ───────────────────────────────
    function drawThinkingEffect() {
        if (!isThinking) {
            // Fade out existing rings
            for (let i = thinkingRings.length - 1; i >= 0; i--) {
                thinkingRings[i].alpha -= 0.02;
                if (thinkingRings[i].alpha <= 0) thinkingRings.splice(i, 1);
            }
        } else {
            thinkingTick++;

            // Spawn golden pulse rings
            if (thinkingTick % 20 === 0) {
                thinkingRings.push({
                    radius: 40 * scale,
                    alpha: 0.5,
                    speed: 2,
                });
            }
        }

        const cx = W / 2, cy = H / 2;
        for (let i = thinkingRings.length - 1; i >= 0; i--) {
            const ring = thinkingRings[i];
            ring.radius += ring.speed;
            ring.alpha -= 0.005;

            if (ring.alpha <= 0) {
                thinkingRings.splice(i, 1);
                continue;
            }

            ctx.strokeStyle = `rgba(255,200,50,${ring.alpha})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ── 11. Speaking Effect ───────────────────────────────
    function drawSpeakingEffect() {
        if (!isSpeaking) return;
        speakingTick++;

        const cx = W / 2, cy = H / 2;

        // Wave ripples from sun
        for (let i = 0; i < 3; i++) {
            const phase = (speakingTick * 0.03 + i * 0.8) % 2.5;
            const r = 40 * scale + phase * Math.min(W, H) * 0.1;
            const alpha = Math.max(0, 0.2 - phase * 0.08);
            ctx.strokeStyle = `rgba(255,220,100,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ═══════════════════════════════════════════════════════
    // MAIN RENDER LOOP
    // ═══════════════════════════════════════════════════════

    let lastFrameTime = 0;
    function render(timestamp) {
        if (!canvas || !canvas.parentNode || document.documentElement.getAttribute('data-theme') !== 'cosmos') {
            cleanup();
            return;
        }

        const frameInterval = 1000 / targetFPS;
        if (timestamp - lastFrameTime < frameInterval) {
            animId = requestAnimationFrame(render);
            return;
        }
        lastFrameTime = timestamp;

        tick++;

        ctx.clearRect(0, 0, W, H);

        // Draw all layers back to front
        drawBackground();
        drawNebulae();
        drawStars();
        updateAndDrawShootingStars();
        drawOrbitPaths();
        drawAsteroidBelt();
        drawSun();
        drawPlanets();
        drawThinkingEffect();
        drawSpeakingEffect();

        animId = requestAnimationFrame(render);
    }

    // ═══════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════

    function start() {
        if (animId) return;
        if (!ensureCanvas()) return;
        detectPerformance();
        initStars();
        initNebulae();
        initPlanets();
        initAsteroids();
        shootingStars = [];
        thinkingRings = [];
        tick = 0;
        animId = requestAnimationFrame(render);
    }

    function cleanup() {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        const el = document.getElementById('cosmos-solar-canvas');
        if (el) el.remove();
        canvas = null;
        ctx = null;
    }

    function onThemeChange() {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'cosmos') {
            start();
        } else {
            cleanup();
        }
    }

    new MutationObserver(onThemeChange)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    window.addEventListener('resize', () => {
        resize();
        initStars();
        initNebulae();
        initAsteroids();
    });

    // Mouse tracking on document (canvas is pointer-events:none)
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
    window.addEventListener('cosmos-perf-change', (e) => {
        perfTier = e.detail;
        detectPerformance();
        initStars();
        initNebulae();
        initAsteroids();
    });

    // Initial launch
    if (document.documentElement.getAttribute('data-theme') === 'cosmos') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    console.log('[cosmos-solar] Cosmos Solar System loaded');
})();
