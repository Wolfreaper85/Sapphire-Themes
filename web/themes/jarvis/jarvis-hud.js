/**
 * JARVIS HUD v2 — Full Iron Man holographic interface.
 * Centered radial design with 16 visual layers.
 *
 * Visual layers (back→front):
 *   1.  Deep navy background with radial gradient
 *   2.  Perspective grid floor (vanishing point)
 *   3.  Hex grid overlay (honeycomb)
 *   4.  Wireframe sphere (rotating 3D→2D projection)
 *   5.  Arc reactor core (multi-ring glow + lens flare)
 *   6.  Ring system (9 concentric rings, segmented, varied speeds)
 *   7.  Ring telemetry text (data scrolling along arcs)
 *   8.  Orbiting data nodes with trails + connection web
 *   9.  Targeting reticle overlay
 *  10.  Power level bars (side diagnostics)
 *  11.  Circuit trace patterns
 *  12.  Floating data particles (upward motes)
 *  13.  HUD corner brackets + side decorations
 *  14.  Status text readouts + telemetry
 *  15.  Scanning sweep (radar style)
 *  16.  Thinking pulse / speaking wave
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    let canvas, ctx, animId;
    let W = 0, H = 0;
    let tick = 0;

    const COLORS = {
        blue:     { r: 0,   g: 168, b: 255 },
        cyan:     { r: 0,   g: 224, b: 255 },
        lightBlue:{ r: 120, g: 200, b: 255 },
        dimBlue:  { r: 15,  g: 50,  b: 100 },
        gold:     { r: 255, g: 170, b: 0   },
        white:    { r: 200, g: 225, b: 255 },
        faintBlue:{ r: 8,   g: 30,  b: 60  },
    };

    let activeColor   = { ...COLORS.blue };
    let targetColor   = { ...COLORS.blue };
    let gridIntensity = 0.85;
    let targetIntensity = 1.0;
    let isThinking = false;
    let thinkingTick = 0;
    let isSpeaking = false;
    let speakingTick = 0;
    let speakingFade = 0;

    // Performance
    let perfTier = 'auto';
    let effectiveTier = 'high';
    let targetFPS = 60;

    // Data nodes
    let dataNodes = [];
    // Circuit traces
    let circuits = [];
    // Particles
    let particles = [];

    function rgba(c, a) {
        return `rgba(${c.r},${c.g},${c.b},${a})`;
    }

    // ── Canvas Setup ──────────────────────────────────────
    function ensureCanvas() {
        if (canvas && canvas.parentNode) return true;
        canvas = document.createElement('canvas');
        canvas.id = 'jarvis-hud-canvas';
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
        const stored = localStorage.getItem('jarvis-perf-tier');
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
    function initDataNodes() {
        dataNodes = [];
        const count = effectiveTier === 'low' ? 4 : effectiveTier === 'medium' ? 6 : 10;
        for (let i = 0; i < count; i++) {
            dataNodes.push({
                angle: (Math.PI * 2 / count) * i,
                radius: 0.25 + Math.random() * 0.15,
                speed: (0.002 + Math.random() * 0.004) * (Math.random() > 0.5 ? 1 : -1),
                size: 2 + Math.random() * 3,
                trail: [],
                trailMax: 15 + Math.floor(Math.random() * 10),
                pulse: Math.random() * Math.PI * 2,
            });
        }
    }

    function initCircuits() {
        circuits = [];
        if (effectiveTier === 'low') return;
        const cx = W / 2, cy = H / 2;
        const count = effectiveTier === 'medium' ? 6 : 10;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
            const startR = Math.min(W, H) * (0.18 + Math.random() * 0.08);
            const points = [];
            let px = cx + Math.cos(angle) * startR;
            let py = cy + Math.sin(angle) * startR;
            points.push({ x: px, y: py });

            const segments = 3 + Math.floor(Math.random() * 5);
            for (let j = 0; j < segments; j++) {
                const outward = Math.random() > 0.3;
                const len = 15 + Math.random() * 50;
                if (outward) {
                    px += Math.cos(angle) * len;
                    py += Math.sin(angle) * len;
                } else {
                    const perpAngle = angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                    px += Math.cos(perpAngle) * len;
                    py += Math.sin(perpAngle) * len;
                }
                px = Math.max(20, Math.min(W - 20, px));
                py = Math.max(20, Math.min(H - 20, py));
                points.push({ x: px, y: py });
            }
            circuits.push(points);
        }
    }

    function initParticles() {
        particles = [];
        const count = effectiveTier === 'low' ? 12 : effectiveTier === 'medium' ? 25 : 45;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.2,
                vy: -Math.random() * 0.4 - 0.1,
                size: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.25 + 0.05,
                life: Math.random(),
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // DRAWING LAYERS
    // ═══════════════════════════════════════════════════════

    // ── 1. Background ─────────────────────────────────────
    function drawBackground() {
        if (document.documentElement.getAttribute('data-custom-overlay') === 'jarvis') {
            ctx.clearRect(0, 0, W, H);
            return;
        }
        ctx.fillStyle = '#04080e';
        ctx.fillRect(0, 0, W, H);

        // Radial glow from center
        const cx = W / 2, cy = H / 2;
        const r = Math.max(W, H) * 0.6;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, rgba(COLORS.faintBlue, 0.4));
        grad.addColorStop(0.5, rgba(COLORS.faintBlue, 0.15));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Perspective Grid Floor ─────────────────────────
    function drawPerspectiveGrid() {
        const cx = W / 2;
        const horizon = H * 0.35;
        const bottom = H;
        const lines = 20;
        const spread = W * 1.5;

        ctx.strokeStyle = rgba(COLORS.blue, 0.04);
        ctx.lineWidth = 0.5;

        // Horizontal lines (perspective)
        for (let i = 0; i <= lines; i++) {
            const t = i / lines;
            const y = horizon + (bottom - horizon) * Math.pow(t, 0.7);
            const perspScale = 0.1 + t * 0.9;
            const halfW = spread * perspScale * 0.5;
            ctx.beginPath();
            ctx.moveTo(cx - halfW, y);
            ctx.lineTo(cx + halfW, y);
            ctx.stroke();
        }

        // Vertical lines (converging)
        const vLines = 30;
        for (let i = -vLines / 2; i <= vLines / 2; i++) {
            const bottomX = cx + (i / (vLines / 2)) * spread * 0.5;
            const topX = cx + (i / (vLines / 2)) * spread * 0.05;
            ctx.beginPath();
            ctx.moveTo(topX, horizon);
            ctx.lineTo(bottomX, bottom);
            ctx.stroke();
        }
    }

    // ── 3. Hex Grid Overlay ───────────────────────────────
    function drawHexGrid() {
        if (effectiveTier === 'low') return;
        const hexR = 28;
        const hexH = hexR * Math.sqrt(3);
        const cx = W / 2, cy = H / 2;
        const maxDist = Math.min(W, H) * 0.45;

        ctx.strokeStyle = rgba(COLORS.blue, 0.015);
        ctx.lineWidth = 0.5;

        const cols = Math.ceil(W / (hexR * 3)) + 2;
        const rows = Math.ceil(H / hexH) + 2;

        for (let row = -1; row < rows; row++) {
            for (let col = -1; col < cols; col++) {
                const hx = col * hexR * 3 + (row % 2 ? hexR * 1.5 : 0);
                const hy = row * hexH * 0.5;
                const dist = Math.sqrt((hx - cx) ** 2 + (hy - cy) ** 2);
                if (dist > maxDist) continue;

                const fade = 1 - (dist / maxDist);
                ctx.strokeStyle = rgba(COLORS.blue, 0.015 * fade);
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    const x = hx + hexR * 0.85 * Math.cos(a);
                    const y = hy + hexR * 0.85 * Math.sin(a);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
    }

    // ── 4. Wireframe Sphere ───────────────────────────────
    function drawWireframeSphere() {
        const cx = W / 2, cy = H / 2;
        const r = Math.min(W, H) * 0.16;
        const rotY = tick * 0.008;
        const tiltX = 0.3;
        const longLines = effectiveTier === 'low' ? 8 : 16;
        const latLines = effectiveTier === 'low' ? 6 : 12;

        ctx.lineWidth = 0.6;

        // Longitude lines (vertical great circles)
        for (let i = 0; i < longLines; i++) {
            const phi = (i / longLines) * Math.PI * 2 + rotY;
            ctx.beginPath();
            for (let j = 0; j <= 40; j++) {
                const theta = (j / 40) * Math.PI;
                let x = r * Math.sin(theta) * Math.cos(phi);
                let z = r * Math.sin(theta) * Math.sin(phi);
                let y = r * Math.cos(theta);

                // Tilt around X axis
                const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
                const z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX);

                const depth = (z2 + r) / (2 * r); // 0 = back, 1 = front
                const alpha = 0.03 + depth * 0.12;
                ctx.strokeStyle = rgba(COLORS.cyan, alpha);

                const sx = cx + x;
                const sy = cy + y2;
                if (j === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
        }

        // Latitude lines (horizontal circles)
        for (let i = 1; i < latLines; i++) {
            const theta = (i / latLines) * Math.PI;
            const latR = r * Math.sin(theta);
            const latY = r * Math.cos(theta);

            ctx.beginPath();
            for (let j = 0; j <= 60; j++) {
                const phi = (j / 60) * Math.PI * 2;
                let x = latR * Math.cos(phi + rotY);
                let z = latR * Math.sin(phi + rotY);
                let y = latY;

                const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
                const z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX);

                const depth = (z2 + r) / (2 * r);
                const alpha = 0.02 + depth * 0.10;
                ctx.strokeStyle = rgba(COLORS.cyan, alpha);

                const sx = cx + x;
                const sy = cy + y2;
                if (j === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
        }

        // Equator ring (brighter)
        ctx.strokeStyle = rgba(COLORS.cyan, 0.2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = 0; j <= 60; j++) {
            const phi = (j / 60) * Math.PI * 2;
            const x = r * Math.cos(phi + rotY);
            const z = r * Math.sin(phi + rotY);
            const y2 = -z * Math.sin(tiltX);
            const sx = cx + x;
            const sy = cy + y2;
            if (j === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // ── 5. Arc Reactor Core ───────────────────────────────
    function drawArcReactor() {
        const cx = W / 2, cy = H / 2;
        const r = Math.min(W, H) * 0.04;

        // Outer glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
        glow.addColorStop(0, rgba(COLORS.white, 0.15));
        glow.addColorStop(0.3, rgba(COLORS.cyan, 0.08));
        glow.addColorStop(0.7, rgba(COLORS.blue, 0.03));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);

        // Core ring
        ctx.strokeStyle = rgba(COLORS.cyan, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glow
        const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        inner.addColorStop(0, rgba(COLORS.white, 0.6));
        inner.addColorStop(0.5, rgba(COLORS.cyan, 0.3));
        inner.addColorStop(1, rgba(COLORS.blue, 0.1));
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Horizontal lens flare
        const flareW = r * 6;
        const flareGrad = ctx.createLinearGradient(cx - flareW, cy, cx + flareW, cy);
        flareGrad.addColorStop(0, 'rgba(0,0,0,0)');
        flareGrad.addColorStop(0.4, rgba(COLORS.cyan, 0.04));
        flareGrad.addColorStop(0.5, rgba(COLORS.white, 0.08));
        flareGrad.addColorStop(0.6, rgba(COLORS.cyan, 0.04));
        flareGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flareGrad;
        ctx.fillRect(cx - flareW, cy - 1.5, flareW * 2, 3);

        // Vertical lens flare
        const vFlareGrad = ctx.createLinearGradient(cx, cy - flareW * 0.6, cx, cy + flareW * 0.6);
        vFlareGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vFlareGrad.addColorStop(0.4, rgba(COLORS.cyan, 0.02));
        vFlareGrad.addColorStop(0.5, rgba(COLORS.white, 0.05));
        vFlareGrad.addColorStop(0.6, rgba(COLORS.cyan, 0.02));
        vFlareGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vFlareGrad;
        ctx.fillRect(cx - 1, cy - flareW * 0.6, 2, flareW * 1.2);
    }

    // ── 6. Ring System (9 concentric rings) ───────────────
    function drawRingSystem() {
        const cx = W / 2, cy = H / 2;
        const baseR = Math.min(W, H) * 0.05;

        // Ring definitions: [radiusMult, segments, speed, lineWidth, colorKey, dashPattern]
        const rings = [
            [1.8,  30, 0.005,  1.5, 'blue',  null],
            [2.2,  0,  0,      0.5, 'blue',  [2, 6]],       // dashed
            [2.8,  20, -0.008, 1.5, 'cyan',  null],
            [3.3,  0,  0,      0.5, 'dimBlue', [4, 4]],      // dashed
            [3.8,  40, 0.003,  2,   'blue',  null],
            [4.2,  12, -0.012, 1,   'gold',  null],           // gold accent
            [4.6,  0,  0,      0.5, 'blue',  [1, 8]],        // dashed
            [5.0,  24, 0.006,  1.5, 'cyan',  null],
            [5.5,  36, -0.004, 1,   'blue',  null],
        ];

        rings.forEach(([rm, segments, speed, lw, colorKey, dash]) => {
            const r = baseR * rm;
            const color = COLORS[colorKey];

            if (dash) {
                // Continuous dashed ring
                ctx.strokeStyle = rgba(color, 0.15);
                ctx.lineWidth = lw;
                ctx.setLineDash(dash);
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (segments > 0) {
                // Segmented ring
                const segAngle = (Math.PI * 2) / segments;
                const gap = 0.06;
                ctx.lineWidth = lw;

                for (let i = 0; i < segments; i++) {
                    const startA = i * segAngle + gap + tick * speed;
                    const endA = (i + 1) * segAngle - gap + tick * speed;
                    const midA = (startA + endA) / 2;
                    const fade = 0.15 + Math.sin(midA + tick * 0.02) * 0.08;
                    ctx.strokeStyle = rgba(color, fade);
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, startA, endA);
                    ctx.stroke();
                }
            }

            // Tick marks on segmented rings
            if (segments >= 20 && !dash) {
                const tickCount = segments * 2;
                ctx.strokeStyle = rgba(color, 0.08);
                ctx.lineWidth = 0.5;
                for (let i = 0; i < tickCount; i++) {
                    const a = (i / tickCount) * Math.PI * 2 + tick * speed;
                    const inner = r - 3;
                    const outer = r + 3;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
                    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
                    ctx.stroke();
                }
            }
        });
    }

    // ── 7. Ring Telemetry Text ─────────────────────────────
    function drawRingTelemetry() {
        if (effectiveTier === 'low') return;
        const cx = W / 2, cy = H / 2;
        const baseR = Math.min(W, H) * 0.05;

        const telemetry = [
            { rm: 2.0, text: 'ARC::04.21', speed: 0.004 },
            { rm: 3.1, text: 'PWR:98.7%', speed: -0.006 },
            { rm: 4.0, text: 'SHD:ONLINE', speed: 0.003 },
            { rm: 4.4, text: 'SYS:NOMINAL', speed: -0.005 },
            { rm: 4.9, text: 'TMP:312K', speed: 0.007 },
            { rm: 5.3, text: 'FRQ:47.2GHz', speed: -0.003 },
        ];

        ctx.font = '7px "Consolas", monospace';

        telemetry.forEach(t => {
            const r = baseR * t.rm;
            const angle = tick * t.speed;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.translate(r, 0);
            ctx.rotate(-angle); // Keep text readable

            ctx.fillStyle = rgba(COLORS.lightBlue, 0.2);
            ctx.fillText(t.text, 0, 0);

            ctx.restore();
        });
    }

    // ── 8. Orbiting Data Nodes ────────────────────────────
    function drawDataNodes() {
        const cx = W / 2, cy = H / 2;
        const maxR = Math.min(W, H) * 0.3;

        // Update positions
        dataNodes.forEach(node => {
            node.angle += node.speed;
            node.pulse += 0.03;
            const r = maxR * node.radius;
            const x = cx + Math.cos(node.angle) * r;
            const y = cy + Math.sin(node.angle) * r * 0.6; // Elliptical

            // Trail
            node.trail.push({ x, y });
            if (node.trail.length > node.trailMax) node.trail.shift();
        });

        // Connection web between nearby nodes
        ctx.strokeStyle = rgba(COLORS.blue, 0.04);
        ctx.lineWidth = 0.5;
        for (let i = 0; i < dataNodes.length; i++) {
            const a = dataNodes[i].trail[dataNodes[i].trail.length - 1];
            if (!a) continue;
            for (let j = i + 1; j < dataNodes.length; j++) {
                const b = dataNodes[j].trail[dataNodes[j].trail.length - 1];
                if (!b) continue;
                const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
                if (dist < 200) {
                    const alpha = (1 - dist / 200) * 0.06;
                    ctx.strokeStyle = rgba(COLORS.cyan, alpha);
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        // Dashed lines to center
        ctx.setLineDash([3, 6]);
        dataNodes.forEach(node => {
            const pos = node.trail[node.trail.length - 1];
            if (!pos) return;
            ctx.strokeStyle = rgba(COLORS.blue, 0.03);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        });
        ctx.setLineDash([]);

        // Draw nodes and trails
        dataNodes.forEach(node => {
            // Trail
            node.trail.forEach((p, i) => {
                const alpha = (i / node.trail.length) * 0.15;
                ctx.fillStyle = rgba(COLORS.cyan, alpha);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
                ctx.fill();
            });

            // Node glow
            const pos = node.trail[node.trail.length - 1];
            if (!pos) return;
            const pulseSize = node.size + Math.sin(node.pulse) * 1.5;
            const glowR = pulseSize * 3;

            const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
            glow.addColorStop(0, rgba(COLORS.cyan, 0.2));
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(pos.x - glowR, pos.y - glowR, glowR * 2, glowR * 2);

            // Node dot
            ctx.fillStyle = rgba(COLORS.white, 0.7);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pulseSize, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ── 9. Targeting Reticle ──────────────────────────────
    function drawTargetingReticle() {
        const cx = W / 2, cy = H / 2;
        const r = Math.min(W, H) * 0.08;

        // Crosshairs
        ctx.strokeStyle = rgba(COLORS.blue, 0.12);
        ctx.lineWidth = 0.5;
        const gap = r * 0.3;
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx - gap, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + r, cy);
        ctx.stroke();
        // Vertical
        ctx.beginPath();
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - gap);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + r);
        ctx.stroke();

        // Rotating gold brackets
        const bracketR = r * 0.85;
        const bracketAngle = tick * 0.01;
        ctx.strokeStyle = rgba(COLORS.gold, 0.25);
        ctx.lineWidth = 1.5;

        for (let i = 0; i < 4; i++) {
            const a = bracketAngle + (Math.PI / 2) * i;
            const startA = a - 0.15;
            const endA = a + 0.15;
            ctx.beginPath();
            ctx.arc(cx, cy, bracketR, startA, endA);
            ctx.stroke();

            // Bracket end caps
            const capLen = 6;
            for (const ea of [startA, endA]) {
                const ex = cx + Math.cos(ea) * bracketR;
                const ey = cy + Math.sin(ea) * bracketR;
                const inx = cx + Math.cos(ea) * (bracketR - capLen);
                const iny = cy + Math.sin(ea) * (bracketR - capLen);
                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(inx, iny);
                ctx.stroke();
            }
        }
    }

    // ── 10. Power Level Bars ──────────────────────────────
    function drawPowerBars() {
        const labels = ['PWR', 'ARC', 'SHD', 'SYS'];
        const values = [
            0.95 + Math.sin(tick * 0.01) * 0.03,
            0.98 + Math.sin(tick * 0.015) * 0.02,
            0.87 + Math.sin(tick * 0.02) * 0.06,
            0.94 + Math.sin(tick * 0.012) * 0.04,
        ];
        const colors = [COLORS.cyan, COLORS.blue, COLORS.cyan, COLORS.blue];

        const barW = 6;
        const barH = H * 0.12;
        const startY = H * 0.35;
        const gap = 20;

        // Left side
        const lx = W * 0.05;
        labels.forEach((label, i) => {
            const by = startY + i * gap;
            const fillH = values[i] * barH;

            // Label
            ctx.font = '7px "Consolas", monospace';
            ctx.fillStyle = rgba(COLORS.lightBlue, 0.35);
            ctx.textAlign = 'right';
            ctx.fillText(label, lx - 4, by + barH / 2 + 3);
            ctx.textAlign = 'left';

            // Bar background
            ctx.fillStyle = rgba(COLORS.dimBlue, 0.15);
            ctx.fillRect(lx, by, barW, barH);

            // Bar fill
            ctx.fillStyle = rgba(colors[i], 0.35);
            ctx.fillRect(lx, by + barH - fillH, barW, fillH);

            // Border
            ctx.strokeStyle = rgba(COLORS.blue, 0.15);
            ctx.lineWidth = 0.5;
            ctx.strokeRect(lx, by, barW, barH);

            // Value
            ctx.font = '7px "Consolas", monospace';
            ctx.fillStyle = rgba(COLORS.white, 0.25);
            ctx.fillText((values[i] * 100).toFixed(0) + '%', lx + barW + 4, by + barH / 2 + 3);
        });

        // Right side (mirror)
        const rx = W * 0.95 - barW;
        const rightLabels = ['FRQ', 'BND', 'TMP', 'NET'];
        const rightValues = [
            0.72 + Math.sin(tick * 0.018) * 0.1,
            0.65 + Math.sin(tick * 0.022) * 0.08,
            0.78 + Math.sin(tick * 0.014) * 0.05,
            0.88 + Math.sin(tick * 0.025) * 0.07,
        ];
        rightLabels.forEach((label, i) => {
            const by = startY + i * gap;
            const fillH = rightValues[i] * barH;

            ctx.font = '7px "Consolas", monospace';
            ctx.fillStyle = rgba(COLORS.lightBlue, 0.35);
            ctx.fillText(label, rx + barW + 4, by + barH / 2 + 3);

            ctx.fillStyle = rgba(COLORS.dimBlue, 0.15);
            ctx.fillRect(rx, by, barW, barH);

            ctx.fillStyle = rgba(colors[i % colors.length], 0.35);
            ctx.fillRect(rx, by + barH - fillH, barW, fillH);

            ctx.strokeStyle = rgba(COLORS.blue, 0.15);
            ctx.lineWidth = 0.5;
            ctx.strokeRect(rx, by, barW, barH);
        });
    }

    // ── 11. Circuit Traces ────────────────────────────────
    function drawCircuitTraces() {
        if (effectiveTier === 'low') return;

        circuits.forEach(points => {
            ctx.strokeStyle = rgba(COLORS.blue, 0.06);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            // End node
            const last = points[points.length - 1];
            ctx.fillStyle = rgba(COLORS.cyan, 0.12);
            ctx.beginPath();
            ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Start node (small)
            const first = points[0];
            ctx.fillStyle = rgba(COLORS.blue, 0.08);
            ctx.beginPath();
            ctx.arc(first.x, first.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ── 12. Floating Particles ────────────────────────────
    function drawParticles() {
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.001;

            if (p.y < -10 || p.life <= 0) {
                p.y = H + 10;
                p.x = Math.random() * W;
                p.life = 1;
            }
            if (p.x < -10) p.x = W + 10;
            if (p.x > W + 10) p.x = -10;

            ctx.fillStyle = rgba(COLORS.cyan, p.alpha * p.life);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ── 13. HUD Corner Brackets ───────────────────────────
    function drawHUDBrackets() {
        const m = 12;
        const len = 40;
        const innerLen = 20;

        ctx.strokeStyle = rgba(COLORS.blue, 0.3);
        ctx.lineWidth = 1.5;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
        ctx.stroke();
        ctx.strokeStyle = rgba(COLORS.cyan, 0.15);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m + 5, m + 5 + innerLen); ctx.lineTo(m + 5, m + 5); ctx.lineTo(m + 5 + innerLen, m + 5);
        ctx.stroke();

        // Top-right
        ctx.strokeStyle = rgba(COLORS.blue, 0.3);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(W - m - len, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + len);
        ctx.stroke();
        ctx.strokeStyle = rgba(COLORS.cyan, 0.15);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W - m - 5 - innerLen, m + 5); ctx.lineTo(W - m - 5, m + 5); ctx.lineTo(W - m - 5, m + 5 + innerLen);
        ctx.stroke();

        // Bottom-left
        ctx.strokeStyle = rgba(COLORS.blue, 0.3);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m, H - m - len); ctx.lineTo(m, H - m); ctx.lineTo(m + len, H - m);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(W - m - len, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - len);
        ctx.stroke();

        // Side accent bars
        const accentLen = 60;
        const accentY = H * 0.5;
        ctx.strokeStyle = rgba(COLORS.blue, 0.12);
        ctx.lineWidth = 2;
        // Left
        ctx.beginPath();
        ctx.moveTo(m, accentY - accentLen / 2); ctx.lineTo(m, accentY + accentLen / 2);
        ctx.stroke();
        // Right
        ctx.beginPath();
        ctx.moveTo(W - m, accentY - accentLen / 2); ctx.lineTo(W - m, accentY + accentLen / 2);
        ctx.stroke();

        // Horizontal top lines
        ctx.strokeStyle = rgba(COLORS.blue, 0.06);
        ctx.lineWidth = 0.5;
        const lineY = m + 3;
        ctx.beginPath();
        ctx.moveTo(m + len + 10, lineY); ctx.lineTo(W * 0.3, lineY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(W * 0.7, lineY); ctx.lineTo(W - m - len - 10, lineY);
        ctx.stroke();
    }

    // ── 14. Status Text Readouts ──────────────────────────
    function drawStatusText() {
        const cx = W / 2;

        // Top center: JARVIS label
        ctx.font = '10px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.lightBlue, 0.3);
        ctx.textAlign = 'center';
        ctx.fillText('J.A.R.V.I.S. v4.2.1', cx, 25);

        // Bottom center: STARK INDUSTRIES
        ctx.font = 'bold 10px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.blue, 0.25);
        ctx.fillText('STARK INDUSTRIES', cx, H - 15);

        // Bottom sub-text
        ctx.font = '8px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.lightBlue, 0.18);
        ctx.fillText('MARK VII INTERFACE  //  ALL SYSTEMS NOMINAL', cx, H - 30);
        ctx.textAlign = 'left';

        // Top-left readouts
        const tlx = 20, tly = 55;
        ctx.font = '8px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.blue, 0.25);
        ctx.fillText('ARC REACTOR: ' + (95 + Math.sin(tick * 0.01) * 3).toFixed(1) + '%', tlx, tly);
        ctx.fillText('CORE TEMP: ' + (305 + Math.sin(tick * 0.015) * 12).toFixed(0) + ' K', tlx, tly + 14);

        // Top-right readouts
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        ctx.textAlign = 'right';
        ctx.fillStyle = rgba(COLORS.cyan, 0.3);
        ctx.font = '11px "Consolas", monospace';
        ctx.fillText(timeStr, W - 20, 55);
        ctx.font = '8px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.blue, 0.2);
        ctx.fillText(now.toLocaleDateString(), W - 20, 69);
        ctx.textAlign = 'left';
    }

    // ── 15. Scanner Sweep ─────────────────────────────────
    function drawScannerSweep() {
        if (effectiveTier === 'low') return;

        const cx = W / 2, cy = H / 2;
        const r = Math.min(W, H) * 0.28;
        const angle = tick * 0.012;

        for (let i = 0; i < 25; i++) {
            const a = angle - (i / 25) * 0.6;
            const alpha = (1 - i / 25) * 0.05;
            ctx.strokeStyle = rgba(COLORS.cyan, alpha);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            ctx.stroke();
        }
    }

    // ── 16. Thinking / Speaking Effects ───────────────────
    function drawThinkingEffect() {
        if (!isThinking) return;
        thinkingTick++;
        const cx = W / 2, cy = H / 2;

        // Multiple expanding pulse rings
        for (let i = 0; i < 4; i++) {
            const phase = (thinkingTick * 0.025 + i * 1.0) % 3.5;
            const r = phase * Math.min(W, H) * 0.12;
            const alpha = Math.max(0, 0.3 - phase * 0.09);
            ctx.strokeStyle = rgba(COLORS.gold, alpha);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Gold flash on core
        const flashAlpha = Math.sin(thinkingTick * 0.1) * 0.15 + 0.1;
        const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
        flash.addColorStop(0, rgba(COLORS.gold, flashAlpha));
        flash.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flash;
        ctx.fillRect(cx - 30, cy - 30, 60, 60);
    }

    function drawSpeakingEffect() {
        if (!isSpeaking) return;
        speakingTick++;
        const cx = W / 2, cy = H / 2;

        // Expanding wave rings
        for (let i = 0; i < 3; i++) {
            const phase = (speakingTick * 0.04 + i * 0.9) % 2.5;
            const r = 20 + phase * Math.min(W, H) * 0.08;
            const alpha = Math.max(0, 0.25 - phase * 0.1);
            ctx.strokeStyle = rgba(COLORS.cyan, alpha);
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
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'jarvis';
        if (!canvas || !canvas.parentNode || (document.documentElement.getAttribute('data-theme') !== 'jarvis' && !isCustomOverlay)) {
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
        drawPerspectiveGrid();
        drawHexGrid();
        drawCircuitTraces();
        drawWireframeSphere();
        drawArcReactor();
        drawRingSystem();
        drawRingTelemetry();
        drawScannerSweep();
        drawDataNodes();
        drawTargetingReticle();
        drawPowerBars();
        drawParticles();
        drawHUDBrackets();
        drawStatusText();
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
        initDataNodes();
        initCircuits();
        initParticles();
        tick = 0;
        animId = requestAnimationFrame(render);
    }

    function cleanup() {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        const el = document.getElementById('jarvis-hud-canvas');
        if (el) el.remove();
        canvas = null;
        ctx = null;
    }

    function onThemeChange() {
        const theme = document.documentElement.getAttribute('data-theme');
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'jarvis';
        if (theme === 'jarvis' || isCustomOverlay) {
            start();
        } else {
            cleanup();
        }
    }

    new MutationObserver(onThemeChange)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-custom-overlay'] });

    window.addEventListener('resize', () => {
        resize();
        initCircuits();
    });

    // State events
    window.addEventListener('thinking-start', () => { isThinking = true; thinkingTick = 0; });
    window.addEventListener('thinking-end', () => { isThinking = false; });
    window.addEventListener('speaking-start', () => { isSpeaking = true; speakingTick = 0; });
    window.addEventListener('speaking-end', () => { isSpeaking = false; });

    // Performance setting
    window.addEventListener('jarvis-perf-change', (e) => {
        perfTier = e.detail;
        detectPerformance();
        initDataNodes();
        initCircuits();
        initParticles();
    });

    // Initial launch
    const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'jarvis';
    if (document.documentElement.getAttribute('data-theme') === 'jarvis' || isCustomOverlay) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    console.log('[jarvis-hud] JARVIS HUD v2 loaded');
})();
