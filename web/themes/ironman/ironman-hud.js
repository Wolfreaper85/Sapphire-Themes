/**
 * Iron Man Helmet HUD — View from inside the Iron Man faceplate.
 * Canvas 2D procedural animation with 16 visual layers.
 *
 * Visual layers (back→front):
 *   1.  Dark red-black background with warm radial glow
 *   2.  Helmet visor frame (curved faceplate edges)
 *   3.  Terrain wire mesh (scrolling parallax flight terrain)
 *   4.  Horizon line with warm glow
 *   5.  Flight data HUD (altitude, speed, heading)
 *   6.  Suit integrity display (humanoid silhouette)
 *   7.  Repulsor charge indicators (3 arc gauges)
 *   8.  Target lock brackets (drifting + lock-on)
 *   9.  Threat assessment markers (edge diamonds)
 *  10.  Vital signs strip (O2, G-FORCE, HR, TEMP)
 *  11.  Arc reactor power gauge (segmented ring)
 *  12.  Status text readouts (MARK VII, clock, STARK)
 *  13.  HUD corner brackets (red/gold)
 *  14.  Weapons system panel
 *  15.  Thinking effect (repulsor charge-up glow)
 *  16.  Speaking effect (chin waveform)
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    let canvas, ctx, animId;
    let W = 0, H = 0;
    let tick = 0;

    const COLORS = {
        red:       { r: 204, g: 0,   b: 0   },
        gold:      { r: 255, g: 170, b: 0   },
        orange:    { r: 255, g: 120, b: 0   },
        brightRed: { r: 255, g: 50,  b: 50  },
        warmWhite: { r: 255, g: 220, b: 180 },
        dimRed:    { r: 60,  g: 10,  b: 10  },
        green:     { r: 80,  g: 220, b: 80  },
    };

    let isThinking = false;
    let thinkingTick = 0;
    let isSpeaking = false;
    let speakingTick = 0;

    // Performance
    let perfTier = 'auto';
    let effectiveTier = 'high';
    let targetFPS = 60;

    // Dynamic state
    let targets = [];
    let terrainOffset = 0;
    let flightAlt = 12400;
    let flightSpeed = 340;
    let flightHeading = 47;

    function rgba(c, a) {
        return `rgba(${c.r},${c.g},${c.b},${a})`;
    }

    // ── Canvas Setup ──────────────────────────────────────
    function ensureCanvas() {
        if (canvas && canvas.parentNode) return true;
        canvas = document.createElement('canvas');
        canvas.id = 'ironman-hud-canvas';
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
        const stored = localStorage.getItem('ironman-perf-tier');
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
    function initTargets() {
        targets = [];
        if (effectiveTier === 'low') return;
        const count = effectiveTier === 'medium' ? 2 : 3;
        for (let i = 0; i < count; i++) {
            targets.push({
                x: 0.2 + Math.random() * 0.6,
                y: 0.15 + Math.random() * 0.5,
                vx: (Math.random() - 0.5) * 0.0003,
                vy: (Math.random() - 0.5) * 0.0002,
                lockTimer: 0,
                locked: false,
                lockCooldown: 200 + Math.floor(Math.random() * 400),
                size: 1.0,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // DRAWING LAYERS
    // ═══════════════════════════════════════════════════════

    // ── 1. Background ─────────────────────────────────────
    function drawBackground() {
        if (document.documentElement.getAttribute('data-custom-overlay') === 'ironman') {
            ctx.clearRect(0, 0, W, H);
            return;
        }
        ctx.fillStyle = '#0a0404';
        ctx.fillRect(0, 0, W, H);

        const cx = W / 2, cy = H / 2;
        const r = Math.max(W, H) * 0.65;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(40, 10, 5, 0.35)');
        grad.addColorStop(0.4, 'rgba(25, 5, 3, 0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Helmet Visor Frame ─────────────────────────────
    function drawVisorFrame() {
        const m = 0; // frame sits at the edge
        const edgeW = W * 0.08;
        const edgeH = H * 0.1;
        const chinH = H * 0.15;
        const browH = H * 0.08;

        // Dark metallic overlay around the edges (simulating helmet interior)
        ctx.save();

        // Top brow piece
        ctx.fillStyle = 'rgba(5, 2, 2, 0.92)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(W, 0);
        ctx.lineTo(W, browH * 0.5);
        ctx.quadraticCurveTo(W * 0.5, browH * 1.4, 0, browH * 0.5);
        ctx.closePath();
        ctx.fill();

        // Bottom chin piece
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(W, H);
        ctx.lineTo(W, H - chinH * 0.4);
        ctx.quadraticCurveTo(W * 0.5, H - chinH * 1.5, 0, H - chinH * 0.4);
        ctx.closePath();
        ctx.fill();

        // Left cheek
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(edgeW * 0.5, 0);
        ctx.bezierCurveTo(edgeW * 1.2, H * 0.25, edgeW * 1.2, H * 0.75, edgeW * 0.5, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();

        // Right cheek
        ctx.beginPath();
        ctx.moveTo(W, 0);
        ctx.lineTo(W - edgeW * 0.5, 0);
        ctx.bezierCurveTo(W - edgeW * 1.2, H * 0.25, W - edgeW * 1.2, H * 0.75, W - edgeW * 0.5, H);
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();

        // Inner edge glow - left
        const glowWidth = 3;
        ctx.strokeStyle = rgba(COLORS.red, 0.12);
        ctx.lineWidth = glowWidth;
        ctx.beginPath();
        ctx.bezierCurveTo(edgeW * 1.2, H * 0.25, edgeW * 1.2, H * 0.75, edgeW * 0.5, H);
        ctx.stroke();

        // Inner edge glow - right
        ctx.beginPath();
        ctx.moveTo(W - edgeW * 0.5, 0);
        ctx.bezierCurveTo(W - edgeW * 1.2, H * 0.25, W - edgeW * 1.2, H * 0.75, W - edgeW * 0.5, H);
        ctx.stroke();

        // Top inner glow
        ctx.strokeStyle = rgba(COLORS.red, 0.08);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, browH * 0.5);
        ctx.quadraticCurveTo(W * 0.5, browH * 1.4, W, browH * 0.5);
        ctx.stroke();

        // Bottom inner glow
        ctx.strokeStyle = rgba(COLORS.orange, 0.06);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, H - chinH * 0.4);
        ctx.quadraticCurveTo(W * 0.5, H - chinH * 1.5, W, H - chinH * 0.4);
        ctx.stroke();

        // Ambient red glow along inner edges
        const leftGlow = ctx.createLinearGradient(0, 0, edgeW * 2, 0);
        leftGlow.addColorStop(0, rgba(COLORS.red, 0.06));
        leftGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = leftGlow;
        ctx.fillRect(0, 0, edgeW * 2, H);

        const rightGlow = ctx.createLinearGradient(W, 0, W - edgeW * 2, 0);
        rightGlow.addColorStop(0, rgba(COLORS.red, 0.06));
        rightGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rightGlow;
        ctx.fillRect(W - edgeW * 2, 0, edgeW * 2, H);

        ctx.restore();
    }

    // ── 3. Terrain Wire Mesh ──────────────────────────────
    function drawTerrainMesh() {
        if (effectiveTier === 'low') return;

        const horizon = H * 0.4;
        const bottom = H * 0.85;
        const cx = W / 2;
        const gridRows = effectiveTier === 'medium' ? 12 : 18;
        const gridCols = effectiveTier === 'medium' ? 16 : 24;

        terrainOffset += 0.015;

        ctx.lineWidth = 0.5;

        // Draw scrolling terrain grid
        for (let row = 0; row < gridRows; row++) {
            const t = row / gridRows;
            const rowOffset = (t + terrainOffset) % 1.0;
            const y = horizon + (bottom - horizon) * Math.pow(rowOffset, 0.6);
            const perspScale = 0.05 + rowOffset * 0.95;
            const halfW = W * 0.8 * perspScale;
            const alpha = rowOffset * 0.08;

            ctx.strokeStyle = rgba(COLORS.gold, alpha);
            ctx.beginPath();

            for (let col = 0; col <= gridCols; col++) {
                const colT = col / gridCols;
                const x = cx - halfW + colT * halfW * 2;
                const hill = Math.sin(colT * 8 + tick * 0.01 + row * 0.5) * 4 * perspScale;
                const px = x;
                const py = y + hill;
                if (col === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // Vertical converging lines
        for (let col = 0; col <= gridCols; col++) {
            const colT = col / gridCols;
            ctx.strokeStyle = rgba(COLORS.orange, 0.03);
            ctx.beginPath();

            const topX = cx + (colT - 0.5) * W * 0.08;
            const botX = cx + (colT - 0.5) * W * 1.6;
            ctx.moveTo(topX, horizon);
            ctx.lineTo(botX, bottom);
            ctx.stroke();
        }
    }

    // ── 4. Horizon Line ───────────────────────────────────
    function drawHorizonLine() {
        const y = H * 0.4;
        const cx = W / 2;

        // Glow
        const grad = ctx.createLinearGradient(0, y - 8, 0, y + 8);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, rgba(COLORS.orange, 0.06));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(W * 0.1, y - 8, W * 0.8, 16);

        // Line
        ctx.strokeStyle = rgba(COLORS.gold, 0.15);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(W * 0.1, y);
        ctx.lineTo(W * 0.9, y);
        ctx.stroke();

        // Center notch
        ctx.strokeStyle = rgba(COLORS.gold, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 15, y);
        ctx.lineTo(cx - 5, y - 5);
        ctx.lineTo(cx + 5, y - 5);
        ctx.lineTo(cx + 15, y);
        ctx.stroke();
    }

    // ── 5. Flight Data HUD ────────────────────────────────
    function drawFlightData() {
        // Animate values with drift
        flightAlt = 12400 + Math.sin(tick * 0.005) * 200 + Math.sin(tick * 0.013) * 80;
        flightSpeed = 340 + Math.sin(tick * 0.007) * 30 + Math.sin(tick * 0.019) * 15;
        flightHeading = ((47 + tick * 0.05) % 360 + 360) % 360;

        ctx.font = '8px "Consolas", monospace';

        // ── Left: Altitude indicator ──
        const altX = W * 0.12;
        const altY = H * 0.3;
        const altH = H * 0.25;
        const altSteps = 8;
        const altBase = Math.floor(flightAlt / 500) * 500;

        ctx.strokeStyle = rgba(COLORS.gold, 0.15);
        ctx.lineWidth = 0.5;
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(altX + 30, altY);
        ctx.lineTo(altX + 30, altY + altH);
        ctx.stroke();

        for (let i = 0; i < altSteps; i++) {
            const t = i / (altSteps - 1);
            const y = altY + t * altH;
            const val = altBase + (altSteps / 2 - i) * 500;
            const isCurrent = Math.abs(val - flightAlt) < 250;

            // Tick
            ctx.strokeStyle = rgba(COLORS.gold, isCurrent ? 0.4 : 0.12);
            ctx.beginPath();
            ctx.moveTo(altX + 25, y);
            ctx.lineTo(altX + 30, y);
            ctx.stroke();

            // Value
            ctx.fillStyle = rgba(isCurrent ? COLORS.warmWhite : COLORS.gold, isCurrent ? 0.5 : 0.2);
            ctx.textAlign = 'right';
            ctx.fillText(val.toFixed(0), altX + 22, y + 3);
        }

        // Current alt box
        const curAltY = altY + altH * 0.5;
        ctx.fillStyle = rgba(COLORS.red, 0.15);
        ctx.fillRect(altX - 5, curAltY - 7, 38, 14);
        ctx.strokeStyle = rgba(COLORS.gold, 0.3);
        ctx.lineWidth = 0.5;
        ctx.strokeRect(altX - 5, curAltY - 7, 38, 14);
        ctx.fillStyle = rgba(COLORS.warmWhite, 0.6);
        ctx.textAlign = 'right';
        ctx.fillText(flightAlt.toFixed(0), altX + 28, curAltY + 3);

        // Label
        ctx.fillStyle = rgba(COLORS.gold, 0.3);
        ctx.textAlign = 'center';
        ctx.fillText('ALT FT', altX + 15, altY - 8);

        // ── Right: Speed indicator ──
        const spdX = W * 0.88;
        const spdY = H * 0.3;
        const spdH = H * 0.25;
        const spdSteps = 8;
        const spdBase = Math.floor(flightSpeed / 50) * 50;

        ctx.strokeStyle = rgba(COLORS.gold, 0.15);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(spdX - 30, spdY);
        ctx.lineTo(spdX - 30, spdY + spdH);
        ctx.stroke();

        for (let i = 0; i < spdSteps; i++) {
            const t = i / (spdSteps - 1);
            const y = spdY + t * spdH;
            const val = spdBase + (spdSteps / 2 - i) * 50;
            const isCurrent = Math.abs(val - flightSpeed) < 25;

            ctx.strokeStyle = rgba(COLORS.gold, isCurrent ? 0.4 : 0.12);
            ctx.beginPath();
            ctx.moveTo(spdX - 30, y);
            ctx.lineTo(spdX - 25, y);
            ctx.stroke();

            ctx.fillStyle = rgba(isCurrent ? COLORS.warmWhite : COLORS.gold, isCurrent ? 0.5 : 0.2);
            ctx.textAlign = 'left';
            ctx.fillText(val.toFixed(0), spdX - 22, y + 3);
        }

        // Current speed box
        const curSpdY = spdY + spdH * 0.5;
        ctx.fillStyle = rgba(COLORS.red, 0.15);
        ctx.fillRect(spdX - 35, curSpdY - 7, 38, 14);
        ctx.strokeStyle = rgba(COLORS.gold, 0.3);
        ctx.lineWidth = 0.5;
        ctx.strokeRect(spdX - 35, curSpdY - 7, 38, 14);
        ctx.fillStyle = rgba(COLORS.warmWhite, 0.6);
        ctx.textAlign = 'left';
        ctx.fillText(flightSpeed.toFixed(0), spdX - 30, curSpdY + 3);

        ctx.fillStyle = rgba(COLORS.gold, 0.3);
        ctx.textAlign = 'center';
        ctx.fillText('KTS', spdX - 15, spdY - 8);

        // ── Top: Heading/compass bar ──
        const hdgY = H * 0.1;
        const hdgCx = W / 2;
        const hdgW = W * 0.35;
        const hdgStep = 10; // degrees per tick

        ctx.strokeStyle = rgba(COLORS.gold, 0.15);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(hdgCx - hdgW / 2, hdgY + 12);
        ctx.lineTo(hdgCx + hdgW / 2, hdgY + 12);
        ctx.stroke();

        const cardinals = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

        for (let deg = -60; deg <= 60; deg += hdgStep) {
            const actualDeg = ((flightHeading + deg) % 360 + 360) % 360;
            const xOff = (deg / 60) * (hdgW / 2);
            const x = hdgCx + xOff;
            const isCardinal = actualDeg % 45 === 0;
            const isMajor = actualDeg % 30 === 0;

            ctx.strokeStyle = rgba(COLORS.gold, isCardinal ? 0.3 : isMajor ? 0.15 : 0.08);
            ctx.beginPath();
            ctx.moveTo(x, hdgY + 12);
            ctx.lineTo(x, hdgY + (isCardinal ? 4 : isMajor ? 7 : 9));
            ctx.stroke();

            if (isCardinal || isMajor) {
                ctx.fillStyle = rgba(isCardinal ? COLORS.warmWhite : COLORS.gold, isCardinal ? 0.45 : 0.2);
                ctx.textAlign = 'center';
                ctx.font = isCardinal ? '9px "Consolas", monospace' : '7px "Consolas", monospace';
                const label = cardinals[actualDeg] || actualDeg.toFixed(0);
                ctx.fillText(label, x, hdgY);
            }
        }

        // Center caret
        ctx.strokeStyle = rgba(COLORS.warmWhite, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hdgCx - 4, hdgY + 15);
        ctx.lineTo(hdgCx, hdgY + 12);
        ctx.lineTo(hdgCx + 4, hdgY + 15);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.font = '8px "Consolas", monospace';
    }

    // ── 6. Suit Integrity Display ─────────────────────────
    function drawSuitIntegrity() {
        const sx = W * 0.08;
        const sy = H * 0.65;
        const scale = Math.min(W, H) * 0.001;
        const s = Math.max(scale, 0.6);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(s, s);

        const integrity = 0.94 + Math.sin(tick * 0.005) * 0.02;
        const sections = [
            { label: 'HEAD', path: [[0, -40], [10, -40], [10, -25], [-10, -25], [-10, -40]], status: 1.0 },
            { label: 'TORSO', path: [[-15, -22], [15, -22], [15, 15], [-15, 15]], status: integrity },
            { label: 'L-ARM', path: [[-18, -20], [-28, -20], [-32, 10], [-18, 10]], status: 0.97 },
            { label: 'R-ARM', path: [[18, -20], [28, -20], [32, 10], [18, 10]], status: 1.0 },
            { label: 'L-LEG', path: [[-12, 18], [-4, 18], [-4, 50], [-14, 50]], status: integrity },
            { label: 'R-LEG', path: [[4, 18], [12, 18], [14, 50], [4, 50]], status: 1.0 },
        ];

        // Head as circle
        const headColor = COLORS.green;
        ctx.strokeStyle = rgba(headColor, 0.35);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, -33, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Body sections
        sections.forEach(sec => {
            if (sec.label === 'HEAD') return;
            const color = sec.status > 0.95 ? COLORS.green : COLORS.gold;
            ctx.strokeStyle = rgba(color, 0.35);
            ctx.lineWidth = 1;
            ctx.beginPath();
            sec.path.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p[0], p[1]);
                else ctx.lineTo(p[0], p[1]);
            });
            ctx.closePath();
            ctx.stroke();

            // Faint fill
            ctx.fillStyle = rgba(color, 0.05);
            ctx.fill();
        });

        ctx.restore();

        // Percentage label
        ctx.font = '9px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.green, 0.4);
        ctx.textAlign = 'center';
        ctx.fillText((integrity * 100).toFixed(0) + '%', sx, sy + 45 * s);
        ctx.font = '7px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.gold, 0.25);
        ctx.fillText('SUIT INTEGRITY', sx, sy + 55 * s);
        ctx.textAlign = 'left';
    }

    // ── 7. Repulsor Charge Indicators ─────────────────────
    function drawRepulsorGauges() {
        const gauges = [
            { x: W * 0.15, y: H * 0.88, r: 18, label: 'L-REP', charge: 0.85 + Math.sin(tick * 0.02) * 0.1 },
            { x: W * 0.85, y: H * 0.88, r: 18, label: 'R-REP', charge: 0.90 + Math.sin(tick * 0.025) * 0.08 },
            { x: W * 0.5,  y: H * 0.92, r: 22, label: 'UNIBEAM', charge: 0.97 + Math.sin(tick * 0.01) * 0.03 },
        ];

        gauges.forEach(g => {
            const startA = Math.PI * 0.75;
            const endA = Math.PI * 2.25;
            const fillA = startA + (endA - startA) * Math.min(g.charge, 1);

            // Background arc
            ctx.strokeStyle = rgba(COLORS.dimRed, 0.3);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(g.x, g.y, g.r, startA, endA);
            ctx.stroke();

            // Fill arc
            const pulse = Math.sin(tick * 0.03 + g.x) * 0.1;
            ctx.strokeStyle = rgba(COLORS.gold, 0.4 + pulse);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(g.x, g.y, g.r, startA, fillA);
            ctx.stroke();

            // Glow
            const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r * 1.5);
            glow.addColorStop(0, rgba(COLORS.gold, 0.04 + pulse * 0.05));
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(g.x - g.r * 2, g.y - g.r * 2, g.r * 4, g.r * 4);

            // Percentage text
            ctx.font = '8px "Consolas", monospace';
            ctx.fillStyle = rgba(COLORS.warmWhite, 0.45);
            ctx.textAlign = 'center';
            ctx.fillText((g.charge * 100).toFixed(0) + '%', g.x, g.y + 3);

            // Label
            ctx.font = '6px "Consolas", monospace';
            ctx.fillStyle = rgba(COLORS.gold, 0.25);
            ctx.fillText(g.label, g.x, g.y + g.r + 10);
        });

        ctx.textAlign = 'left';
    }

    // ── 8. Target Lock Brackets ───────────────────────────
    function drawTargetBrackets() {
        if (effectiveTier === 'low') return;

        targets.forEach(tgt => {
            // Drift
            tgt.x += tgt.vx;
            tgt.y += tgt.vy;
            if (tgt.x < 0.15 || tgt.x > 0.85) tgt.vx *= -1;
            if (tgt.y < 0.12 || tgt.y > 0.65) tgt.vy *= -1;

            // Lock-on logic
            tgt.lockTimer++;
            if (tgt.lockTimer > tgt.lockCooldown) {
                tgt.locked = true;
                if (tgt.lockTimer > tgt.lockCooldown + 60) {
                    tgt.locked = false;
                    tgt.lockTimer = 0;
                    tgt.lockCooldown = 200 + Math.floor(Math.random() * 400);
                }
            }

            const px = tgt.x * W;
            const py = tgt.y * H;
            const baseSize = 20;
            const size = tgt.locked ? baseSize * 0.7 : baseSize;
            const color = tgt.locked ? COLORS.gold : COLORS.red;
            const alpha = tgt.locked ? 0.6 : 0.2;
            const bracketLen = size * 0.4;

            ctx.strokeStyle = rgba(color, alpha);
            ctx.lineWidth = tgt.locked ? 1.5 : 1;

            // Corner brackets
            const corners = [
                [px - size, py - size, 1, 1],
                [px + size, py - size, -1, 1],
                [px - size, py + size, 1, -1],
                [px + size, py + size, -1, -1],
            ];

            corners.forEach(([cx, cy, dx, dy]) => {
                ctx.beginPath();
                ctx.moveTo(cx, cy + dy * bracketLen);
                ctx.lineTo(cx, cy);
                ctx.lineTo(cx + dx * bracketLen, cy);
                ctx.stroke();
            });

            // Crosshair
            if (tgt.locked) {
                ctx.strokeStyle = rgba(COLORS.gold, 0.35);
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 4);
                ctx.stroke();

                // Lock label
                ctx.font = '6px "Consolas", monospace';
                ctx.fillStyle = rgba(COLORS.gold, 0.5);
                ctx.textAlign = 'center';
                ctx.fillText('LOCKED', px, py - size - 4);
                ctx.textAlign = 'left';
            }
        });
    }

    // ── 9. Threat Assessment Markers ──────────────────────
    function drawThreatMarkers() {
        if (effectiveTier === 'low') return;

        const markers = [
            { x: W * 0.05, y: H * 0.3, label: 'CLEAR' },
            { x: W * 0.95, y: H * 0.45, label: 'CLEAR' },
            { x: W * 0.5, y: H * 0.05, label: 'TRACK' },
            { x: W * 0.92, y: H * 0.2, label: 'CLEAR' },
        ];

        markers.forEach(m => {
            const ds = 5;
            ctx.strokeStyle = rgba(m.label === 'TRACK' ? COLORS.gold : COLORS.red, 0.15);
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y - ds);
            ctx.lineTo(m.x + ds, m.y);
            ctx.lineTo(m.x, m.y + ds);
            ctx.lineTo(m.x - ds, m.y);
            ctx.closePath();
            ctx.stroke();

            ctx.font = '6px "Consolas", monospace';
            ctx.fillStyle = rgba(m.label === 'TRACK' ? COLORS.gold : COLORS.red, 0.2);
            ctx.textAlign = 'center';
            ctx.fillText(m.label, m.x, m.y + ds + 9);
        });

        ctx.textAlign = 'left';
    }

    // ── 10. Vital Signs Strip ─────────────────────────────
    function drawVitalSigns() {
        const y = H * 0.96;
        const cx = W / 2;
        const o2 = 98 + Math.sin(tick * 0.008) * 1;
        const gForce = 1.2 + Math.sin(tick * 0.012) * 0.3;
        const hr = 82 + Math.sin(tick * 0.02) * 8;
        const temp = 72 + Math.sin(tick * 0.006) * 2;

        const vitals = [
            'O2:' + o2.toFixed(0) + '%',
            'G:' + gForce.toFixed(1) + 'g',
            'HR:' + hr.toFixed(0) + 'BPM',
            'TEMP:' + temp.toFixed(0) + '\u00B0F',
        ];

        ctx.font = '7px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.warmWhite, 0.2);
        ctx.textAlign = 'center';

        const totalW = vitals.length * 85;
        const startX = cx - totalW / 2;

        vitals.forEach((v, i) => {
            ctx.fillText(v, startX + i * 85 + 42, y);
        });

        // Separator dots
        ctx.fillStyle = rgba(COLORS.red, 0.15);
        for (let i = 1; i < vitals.length; i++) {
            const dx = startX + i * 85 - 1;
            ctx.beginPath();
            ctx.arc(dx, y - 3, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.textAlign = 'left';
    }

    // ── 11. Arc Reactor Power Gauge ───────────────────────
    function drawArcReactorPower() {
        const cx = W * 0.5;
        const cy = H * 0.84;
        const r = 26;
        const power = 0.93 + Math.sin(tick * 0.008) * 0.04;
        const segments = 12;
        const segGap = 0.04;
        const arcSpan = Math.PI * 2;

        // Outer ring segments
        for (let i = 0; i < segments; i++) {
            const startA = (i / segments) * arcSpan - Math.PI / 2 + segGap;
            const endA = ((i + 1) / segments) * arcSpan - Math.PI / 2 - segGap;
            const filled = i / segments < power;

            ctx.strokeStyle = rgba(filled ? COLORS.gold : COLORS.dimRed, filled ? 0.35 : 0.12);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, r, startA, endA);
            ctx.stroke();
        }

        // Inner ring
        ctx.strokeStyle = rgba(COLORS.gold, 0.15);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
        ctx.stroke();

        // Core glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        glow.addColorStop(0, rgba(COLORS.gold, 0.12));
        glow.addColorStop(0.5, rgba(COLORS.orange, 0.04));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Center text
        ctx.font = '8px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.warmWhite, 0.5);
        ctx.textAlign = 'center';
        ctx.fillText((power * 100).toFixed(0) + '%', cx, cy + 3);
        ctx.font = '5px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.gold, 0.25);
        ctx.fillText('ARC PWR', cx, cy + 12);
        ctx.textAlign = 'left';
    }

    // ── 12. Status Text ───────────────────────────────────
    function drawStatusText() {
        const cx = W / 2;

        // Top-left: MARK VII
        ctx.font = 'bold 10px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.red, 0.35);
        ctx.textAlign = 'left';
        ctx.fillText('MARK VII', 25, 30);
        ctx.font = '7px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.gold, 0.2);
        ctx.fillText('IRON MAN COMBAT SYSTEM', 25, 42);

        // Top-right: clock
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        ctx.textAlign = 'right';
        ctx.font = '11px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.gold, 0.35);
        ctx.fillText(timeStr, W - 25, 30);
        ctx.font = '7px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.red, 0.2);
        ctx.fillText(now.toLocaleDateString(), W - 25, 42);

        // Bottom-center: STARK INDUSTRIES
        ctx.textAlign = 'center';
        ctx.font = 'bold 9px "Consolas", monospace';
        ctx.fillStyle = rgba(COLORS.red, 0.2);
        ctx.fillText('STARK INDUSTRIES', cx, H - 10);

        ctx.textAlign = 'left';
    }

    // ── 13. HUD Corner Brackets ───────────────────────────
    function drawHUDBrackets() {
        const m = 15;
        const len = 35;
        const innerLen = 18;

        // Outer brackets - red
        ctx.strokeStyle = rgba(COLORS.red, 0.3);
        ctx.lineWidth = 1.5;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(W - m - len, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + len);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(m, H - m - len); ctx.lineTo(m, H - m); ctx.lineTo(m + len, H - m);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(W - m - len, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - len);
        ctx.stroke();

        // Inner brackets - gold
        ctx.strokeStyle = rgba(COLORS.gold, 0.15);
        ctx.lineWidth = 1;

        const im = m + 5;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(im, im + innerLen); ctx.lineTo(im, im); ctx.lineTo(im + innerLen, im);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(W - im - innerLen, im); ctx.lineTo(W - im, im); ctx.lineTo(W - im, im + innerLen);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(im, H - im - innerLen); ctx.lineTo(im, H - im); ctx.lineTo(im + innerLen, H - im);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(W - im - innerLen, H - im); ctx.lineTo(W - im, H - im); ctx.lineTo(W - im, H - im - innerLen);
        ctx.stroke();

        // Thin connecting lines along top
        ctx.strokeStyle = rgba(COLORS.red, 0.06);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(m + len + 10, m + 3); ctx.lineTo(W * 0.3, m + 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(W * 0.7, m + 3); ctx.lineTo(W - m - len - 10, m + 3);
        ctx.stroke();
    }

    // ── 14. Weapons System Panel ──────────────────────────
    function drawWeaponsPanel() {
        const wx = W - 30;
        const wy = H * 0.12;
        const missiles = 12 - Math.floor(Math.sin(tick * 0.001) * 0.5 + 0.5);
        const flares = 6;

        ctx.font = '7px "Consolas", monospace';
        ctx.textAlign = 'right';

        const items = [
            { label: 'REPULSORS', value: 'ONLINE', color: COLORS.green },
            { label: 'MISSILES', value: '' + missiles, color: COLORS.gold },
            { label: 'FLARES', value: '' + flares, color: COLORS.gold },
            { label: 'UNIBEAM', value: 'STANDBY', color: COLORS.orange },
        ];

        items.forEach((item, i) => {
            const y = wy + i * 13;
            ctx.fillStyle = rgba(COLORS.red, 0.18);
            ctx.fillText(item.label + ':', wx - 40, y);
            ctx.fillStyle = rgba(item.color, 0.3);
            ctx.fillText(item.value, wx, y);
        });

        // Section header
        ctx.fillStyle = rgba(COLORS.red, 0.12);
        ctx.fillText('WEAPONS SYS', wx, wy - 10);

        ctx.textAlign = 'left';
    }

    // ── 15. Thinking Effect (Repulsor Charge-Up) ──────────
    function drawThinkingEffect() {
        if (!isThinking) return;
        thinkingTick++;

        // Gold glow intensifying from corners
        const intensity = Math.sin(thinkingTick * 0.04) * 0.15 + 0.2;
        const cornerR = Math.min(W, H) * 0.4;

        // Four corner glows expanding inward
        const corners = [
            [0, 0],
            [W, 0],
            [0, H],
            [W, H],
        ];

        corners.forEach(([cx, cy], i) => {
            const phase = thinkingTick * 0.03 + i * 1.2;
            const pulse = Math.sin(phase) * 0.05 + intensity;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cornerR);
            grad.addColorStop(0, rgba(COLORS.gold, pulse));
            grad.addColorStop(0.5, rgba(COLORS.orange, pulse * 0.3));
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(cx - cornerR, cy - cornerR, cornerR * 2, cornerR * 2);
        });

        // Center warm pulse
        const cx = W / 2, cy = H / 2;
        const cPulse = Math.sin(thinkingTick * 0.06) * 0.08 + 0.1;
        const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.3);
        cGrad.addColorStop(0, rgba(COLORS.gold, cPulse));
        cGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = cGrad;
        ctx.fillRect(0, 0, W, H);
    }

    // ── 16. Speaking Effect (Chin Waveform) ───────────────
    function drawSpeakingEffect() {
        if (!isSpeaking) return;
        speakingTick++;

        const chinY = H * 0.9;
        const waveW = W * 0.4;
        const cx = W / 2;
        const startX = cx - waveW / 2;
        const segments = 60;

        ctx.lineWidth = 1.5;

        // Primary waveform
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = startX + t * waveW;
            const envelope = Math.sin(t * Math.PI); // fade at edges
            const wave = Math.sin(t * 20 + speakingTick * 0.15) * 6
                       + Math.sin(t * 35 + speakingTick * 0.22) * 3
                       + Math.sin(t * 8 + speakingTick * 0.08) * 4;
            const y = chinY + wave * envelope;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = rgba(COLORS.red, 0.35);
        ctx.stroke();

        // Secondary shimmer
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = startX + t * waveW;
            const envelope = Math.sin(t * Math.PI) * 0.6;
            const wave = Math.sin(t * 25 + speakingTick * 0.18 + 1) * 4
                       + Math.sin(t * 12 + speakingTick * 0.1) * 3;
            const y = chinY + wave * envelope;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = rgba(COLORS.gold, 0.2);
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    // ═══════════════════════════════════════════════════════
    // MAIN RENDER LOOP
    // ═══════════════════════════════════════════════════════

    let lastFrameTime = 0;
    function render(timestamp) {
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'ironman';
        if (!canvas || !canvas.parentNode || (document.documentElement.getAttribute('data-theme') !== 'ironman' && !isCustomOverlay)) {
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
        drawTerrainMesh();
        drawHorizonLine();
        drawVisorFrame();
        drawFlightData();
        drawSuitIntegrity();
        drawRepulsorGauges();
        drawTargetBrackets();
        drawThreatMarkers();
        drawVitalSigns();
        drawArcReactorPower();
        drawStatusText();
        drawHUDBrackets();
        drawWeaponsPanel();
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
        initTargets();
        tick = 0;
        terrainOffset = 0;
        animId = requestAnimationFrame(render);
    }

    function cleanup() {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        const el = document.getElementById('ironman-hud-canvas');
        if (el) el.remove();
        canvas = null;
        ctx = null;
    }

    function onThemeChange() {
        const theme = document.documentElement.getAttribute('data-theme');
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'ironman';
        if (theme === 'ironman' || isCustomOverlay) {
            start();
        } else {
            cleanup();
        }
    }

    new MutationObserver(onThemeChange)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-custom-overlay'] });

    window.addEventListener('resize', () => {
        resize();
        initTargets();
    });

    // State events
    window.addEventListener('thinking-start', () => { isThinking = true; thinkingTick = 0; });
    window.addEventListener('thinking-end', () => { isThinking = false; });
    window.addEventListener('speaking-start', () => { isSpeaking = true; speakingTick = 0; });
    window.addEventListener('speaking-end', () => { isSpeaking = false; });

    // Performance setting
    window.addEventListener('ironman-perf-change', (e) => {
        perfTier = e.detail;
        detectPerformance();
        initTargets();
    });

    // Initial launch
    const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'ironman';
    if (document.documentElement.getAttribute('data-theme') === 'ironman' || isCustomOverlay) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    console.log('[ironman-hud] Iron Man HUD loaded');
})();
