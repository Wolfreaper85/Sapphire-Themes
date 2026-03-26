/**
 * Marauder's Map — Aged parchment with ink-drawn castle map,
 * walking footprints, and magical calligraphy flourishes.
 *
 * Visual layers (back to front):
 *   1.  Parchment background with paper grain texture
 *   2.  Aged staining patches and fold/crease lines
 *   3.  Faint hand-drawn map grid
 *   4.  Ornate double-line border with corner flourishes
 *   5.  Ink corridor/room outlines (animated draw-in)
 *   6.  Room labels in faded serif
 *   7.  Walking footprints with name tags
 *   8.  Ink splotches (mouse interaction)
 *   9.  Magical calligraphy flourishes
 *  10.  Ink drip particles
 *  11.  "I solemnly swear..." intro text
 *  12.  Thinking/speaking effects
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    let canvas, ctx, animId;
    let W = 0, H = 0;
    let tick = 0;

    // ── Color Constants ─────────────────────────────────────
    const PARCHMENT_BG    = '#2a1f14';
    const PARCHMENT_LIGHT = '#3d2e1f';
    const INK_DARK        = '#1a0f05';
    const INK_BROWN       = '#5c3a1e';
    const INK_MEDIUM      = '#8b6914';
    const INK_GOLD        = '#c4943a';
    const INK_CREAM       = '#d4c4a0';
    const INK_FADED       = 'rgba(139, 69, 19, 0.15)';

    const SERIF_FONT = 'Georgia, "Palatino Linotype", serif';

    // ── State ───────────────────────────────────────────────
    let isThinking = false;
    let thinkingTick = 0;
    let isSpeaking = false;
    let speakingTick = 0;

    // Performance
    let perfTier = 'auto';
    let effectiveTier = 'high';
    let targetFPS = 60;

    // Visual state
    let rooms = [];
    let walkers = [];
    let footprints = [];
    let splotches = [];
    let flourishes = [];
    let inkDrips = [];
    let introState = null; // { text, charIndex, startTime, phase }
    let drawInProgress = 0; // 0-1, room draw-in animation
    let drawInStartTime = 0;
    let backgroundTexture = null; // offscreen canvas for parchment grain
    let mouseX = -1000, mouseY = -1000;
    let lastSplotchTime = 0;
    let thinkingTextState = null;

    // ── Canvas Setup ────────────────────────────────────────
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
        backgroundTexture = null; // regenerate on resize
    }

    // ── Performance Detection ───────────────────────────────
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

    // ── Utility ─────────────────────────────────────────────
    function jitter(val, amount) {
        return val + (Math.random() - 0.5) * amount;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function dist(x1, y1, x2, y2) {
        const dx = x1 - x2, dy = y1 - y2;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Seeded pseudo-random for consistent textures
    let _seed = 42;
    function seededRandom() {
        _seed = (_seed * 16807 + 0) % 2147483647;
        return (_seed - 1) / 2147483646;
    }

    // ── Initialize Rooms ────────────────────────────────────
    function initRooms() {
        rooms = [];
        const isLow = effectiveTier === 'low';

        const roomDefs = isLow ? [
            { x: 0.08, y: 0.12, w: 0.18, h: 0.14, label: 'Great Hall', doorSide: 'bottom' },
            { x: 0.35, y: 0.08, w: 0.12, h: 0.10, label: 'Library', doorSide: 'right' },
            { x: 0.60, y: 0.10, w: 0.15, h: 0.12, label: 'Astronomy Tower', doorSide: 'left' },
            { x: 0.10, y: 0.55, w: 0.14, h: 0.16, label: 'Dungeon', doorSide: 'top' },
            { x: 0.50, y: 0.50, w: 0.16, h: 0.12, label: 'Common Room', doorSide: 'left' },
            { x: 0.75, y: 0.55, w: 0.12, h: 0.18, label: 'Potions', doorSide: 'top' },
        ] : [
            { x: 0.08, y: 0.10, w: 0.20, h: 0.16, label: 'Great Hall', doorSide: 'bottom' },
            { x: 0.35, y: 0.06, w: 0.12, h: 0.12, label: 'Library', doorSide: 'right' },
            { x: 0.55, y: 0.08, w: 0.14, h: 0.10, label: 'Astronomy Tower', doorSide: 'left' },
            { x: 0.78, y: 0.10, w: 0.12, h: 0.14, label: 'Charms', doorSide: 'bottom' },
            { x: 0.08, y: 0.42, w: 0.14, h: 0.18, label: 'Dungeon', doorSide: 'top' },
            { x: 0.30, y: 0.38, w: 0.18, h: 0.14, label: 'Common Room', doorSide: 'right' },
            { x: 0.55, y: 0.35, w: 0.12, h: 0.12, label: 'Defense', doorSide: 'left' },
            { x: 0.75, y: 0.40, w: 0.14, h: 0.16, label: 'Potions', doorSide: 'top' },
            { x: 0.15, y: 0.72, w: 0.16, h: 0.12, label: 'Entrance', doorSide: 'top' },
            { x: 0.42, y: 0.68, w: 0.10, h: 0.14, label: 'Corridor', doorSide: 'right' },
            { x: 0.62, y: 0.70, w: 0.14, h: 0.12, label: 'Kitchen', doorSide: 'left' },
            { x: 0.82, y: 0.68, w: 0.10, h: 0.16, label: 'Trophy Room', doorSide: 'top' },
        ];

        // Corridors connect some rooms (pairs of indices)
        const corridorPairs = isLow ? [
            [0, 1], [1, 2], [3, 4], [4, 5]
        ] : [
            [0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7],
            [0, 4], [1, 5], [8, 9], [9, 10], [10, 11], [5, 9]
        ];

        roomDefs.forEach(def => {
            rooms.push({
                x: def.x, y: def.y, w: def.w, h: def.h,
                label: def.label, doorSide: def.doorSide,
                // pixel coords calculated at draw time from W/H
            });
        });

        rooms._corridorPairs = corridorPairs;
    }

    // ── Initialize Walkers ──────────────────────────────────
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

        const count = effectiveTier === 'low' ? 3 : effectiveTier === 'medium' ? 5 : 6;

        for (let i = 0; i < count; i++) {
            const def = walkerDefs[i];
            // Generate a random walking path (waypoints as percentages)
            const waypoints = generateWalkerPath(i, count);
            walkers.push({
                name: def.name,
                speed: def.speed,
                waypoints: waypoints,
                waypointIndex: 0,
                progress: 0, // 0-1 between current and next waypoint
                x: waypoints[0].x * W,
                y: waypoints[0].y * H,
                footStep: 0, // alternates left/right
                lastFootprintDist: 0,
            });
        }
    }

    function generateWalkerPath(index, total) {
        // Distribute walkers across different areas of the map
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

    // ── Initialize Flourishes ───────────────────────────────
    function initFlourishes() {
        flourishes = [];
    }

    // ── Initialize Ink Drips ────────────────────────────────
    function initInkDrips() {
        inkDrips = [];
        if (effectiveTier === 'low') return;
        const count = effectiveTier === 'medium' ? 12 : 20;
        for (let i = 0; i < count; i++) {
            inkDrips.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vy: 0.1 + Math.random() * 0.3,
                vx: (Math.random() - 0.5) * 0.15,
                size: 0.8 + Math.random() * 1.2,
                alpha: 0.08 + Math.random() * 0.12,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // DRAWING LAYERS
    // ═══════════════════════════════════════════════════════

    // ── 1. Parchment Background with Texture ────────────────
    function drawParchmentBackground() {
        // Base color
        ctx.fillStyle = PARCHMENT_BG;
        ctx.fillRect(0, 0, W, H);

        // Generate cached texture if needed
        if (!backgroundTexture) {
            backgroundTexture = document.createElement('canvas');
            backgroundTexture.width = W;
            backgroundTexture.height = H;
            const tctx = backgroundTexture.getContext('2d');

            _seed = 42; // Reset seed for consistency

            // Paper grain — many tiny speckles
            const grainCount = Math.floor(W * H * 0.003);
            for (let i = 0; i < grainCount; i++) {
                const gx = seededRandom() * W;
                const gy = seededRandom() * H;
                const bright = seededRandom() > 0.5;
                const alpha = 0.02 + seededRandom() * 0.06;
                tctx.fillStyle = bright
                    ? `rgba(80, 60, 40, ${alpha})`
                    : `rgba(20, 12, 5, ${alpha})`;
                tctx.fillRect(gx, gy, 1, 1);
            }

            // Aged staining patches — large low-opacity circles
            for (let i = 0; i < 8; i++) {
                const sx = seededRandom() * W;
                const sy = seededRandom() * H;
                const sr = 50 + seededRandom() * 150;
                tctx.beginPath();
                tctx.arc(sx, sy, sr, 0, Math.PI * 2);
                tctx.fillStyle = seededRandom() > 0.5
                    ? `rgba(20, 12, 5, 0.04)`
                    : `rgba(70, 50, 30, 0.03)`;
                tctx.fill();
            }

            // Fold/crease lines
            tctx.strokeStyle = 'rgba(20, 12, 5, 0.06)';
            tctx.lineWidth = 1;
            // Horizontal crease
            tctx.beginPath();
            tctx.moveTo(0, H * 0.48);
            tctx.lineTo(W, H * 0.52);
            tctx.stroke();
            // Vertical crease
            tctx.beginPath();
            tctx.moveTo(W * 0.47, 0);
            tctx.lineTo(W * 0.53, H);
            tctx.stroke();
            // Diagonal crease
            tctx.beginPath();
            tctx.moveTo(W * 0.2, 0);
            tctx.lineTo(W * 0.8, H);
            tctx.stroke();
        }

        ctx.drawImage(backgroundTexture, 0, 0);
    }

    // ── 2. Map Grid Lines ───────────────────────────────────
    function drawMapGrid() {
        const spacing = 90;
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.06)';
        ctx.lineWidth = 0.5;

        // Vertical lines with slight waviness
        for (let x = spacing; x < W; x += spacing) {
            ctx.beginPath();
            for (let y = 0; y <= H; y += 10) {
                const wx = x + Math.sin(y * 0.02 + x * 0.01) * 1.5;
                if (y === 0) ctx.moveTo(wx, y);
                else ctx.lineTo(wx, y);
            }
            ctx.stroke();
        }

        // Horizontal lines with slight waviness
        for (let y = spacing; y < H; y += spacing) {
            ctx.beginPath();
            for (let x = 0; x <= W; x += 10) {
                const wy = y + Math.sin(x * 0.02 + y * 0.01) * 1.5;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }
    }

    // ── 3. Ornate Border ────────────────────────────────────
    function drawBorder() {
        const m = 35; // margin
        const gap = 6; // gap between double lines

        // Outer border (thicker)
        ctx.strokeStyle = `rgba(92, 58, 30, 0.45)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(m, m, W - m * 2, H - m * 2);

        // Inner border (thinner)
        ctx.strokeStyle = `rgba(92, 58, 30, 0.35)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(m + gap, m + gap, W - (m + gap) * 2, H - (m + gap) * 2);

        // Corner flourishes
        drawCornerFlourish(m, m, 1, 1);           // top-left
        drawCornerFlourish(W - m, m, -1, 1);       // top-right
        drawCornerFlourish(m, H - m, 1, -1);       // bottom-left
        drawCornerFlourish(W - m, H - m, -1, -1);  // bottom-right
    }

    function drawCornerFlourish(cx, cy, dx, dy) {
        ctx.strokeStyle = `rgba(92, 58, 30, 0.5)`;
        ctx.lineWidth = 1.5;

        // Outer curl
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(
            cx + dx * 20, cy,
            cx + dx * 25, cy + dy * 15,
            cx + dx * 15, cy + dy * 25
        );
        ctx.stroke();

        // Inner curl
        ctx.beginPath();
        ctx.moveTo(cx + dx * 5, cy + dy * 5);
        ctx.bezierCurveTo(
            cx + dx * 18, cy + dy * 5,
            cx + dx * 20, cy + dy * 18,
            cx + dx * 10, cy + dy * 22
        );
        ctx.stroke();

        // Small dot
        ctx.fillStyle = `rgba(92, 58, 30, 0.4)`;
        ctx.beginPath();
        ctx.arc(cx + dx * 12, cy + dy * 12, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── 4. Room Outlines ────────────────────────────────────
    function drawRooms() {
        const progress = effectiveTier === 'low' ? 1 : drawInProgress;

        rooms.forEach((room, idx) => {
            const rx = room.x * W;
            const ry = room.y * H;
            const rw = room.w * W;
            const rh = room.h * H;

            // Mouse proximity opacity boost
            const roomCx = rx + rw / 2;
            const roomCy = ry + rh / 2;
            const mouseDist = dist(mouseX, mouseY, roomCx, roomCy);
            const proximityBoost = mouseDist < 100 ? 0.15 * (1 - mouseDist / 100) : 0;

            const baseAlpha = 0.3 + proximityBoost;
            ctx.strokeStyle = `rgba(92, 58, 30, ${baseAlpha + 0.1})`;
            ctx.lineWidth = 1.2;

            // Calculate perimeter for draw-in animation
            const perimeter = 2 * (rw + rh);
            const drawLen = perimeter * progress;

            if (progress >= 1) {
                // Draw complete room with doorway gap
                drawRoomRect(rx, ry, rw, rh, room.doorSide);
            } else {
                // Animate drawing the room outline
                drawPartialRoom(rx, ry, rw, rh, drawLen, perimeter);
            }
        });
    }

    function drawRoomRect(x, y, w, h, doorSide) {
        const doorSize = Math.min(w, h) * 0.25;

        ctx.beginPath();
        // Top edge
        if (doorSide === 'top') {
            const mid = x + w / 2;
            ctx.moveTo(x, y);
            ctx.lineTo(mid - doorSize / 2, y);
            ctx.moveTo(mid + doorSize / 2, y);
            ctx.lineTo(x + w, y);
        } else {
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y);
        }
        ctx.stroke();

        // Right edge
        ctx.beginPath();
        if (doorSide === 'right') {
            const mid = y + h / 2;
            ctx.moveTo(x + w, y);
            ctx.lineTo(x + w, mid - doorSize / 2);
            ctx.moveTo(x + w, mid + doorSize / 2);
            ctx.lineTo(x + w, y + h);
        } else {
            ctx.moveTo(x + w, y);
            ctx.lineTo(x + w, y + h);
        }
        ctx.stroke();

        // Bottom edge
        ctx.beginPath();
        if (doorSide === 'bottom') {
            const mid = x + w / 2;
            ctx.moveTo(x + w, y + h);
            ctx.lineTo(mid + doorSize / 2, y + h);
            ctx.moveTo(mid - doorSize / 2, y + h);
            ctx.lineTo(x, y + h);
        } else {
            ctx.moveTo(x + w, y + h);
            ctx.lineTo(x, y + h);
        }
        ctx.stroke();

        // Left edge
        ctx.beginPath();
        if (doorSide === 'left') {
            const mid = y + h / 2;
            ctx.moveTo(x, y + h);
            ctx.lineTo(x, mid + doorSize / 2);
            ctx.moveTo(x, mid - doorSize / 2);
            ctx.lineTo(x, y);
        } else {
            ctx.moveTo(x, y + h);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    function drawPartialRoom(x, y, w, h, drawLen, perimeter) {
        // Trace around the rectangle clockwise, drawing only up to drawLen
        const segments = [
            { x1: x, y1: y, x2: x + w, y2: y, len: w },           // top
            { x1: x + w, y1: y, x2: x + w, y2: y + h, len: h },   // right
            { x1: x + w, y1: y + h, x2: x, y2: y + h, len: w },   // bottom
            { x1: x, y1: y + h, x2: x, y2: y, len: h },           // left
        ];

        let remaining = drawLen;
        ctx.beginPath();
        ctx.moveTo(x, y);

        for (const seg of segments) {
            if (remaining <= 0) break;
            const t = Math.min(1, remaining / seg.len);
            const ex = lerp(seg.x1, seg.x2, t);
            const ey = lerp(seg.y1, seg.y2, t);
            ctx.lineTo(ex, ey);
            remaining -= seg.len;
        }
        ctx.stroke();
    }

    // ── 5. Corridors ────────────────────────────────────────
    function drawCorridors() {
        if (!rooms._corridorPairs) return;
        const progress = effectiveTier === 'low' ? 1 : drawInProgress;
        if (progress < 0.3) return; // corridors start appearing after rooms begin

        const corridorAlpha = Math.min(1, (progress - 0.3) / 0.7) * 0.25;
        ctx.strokeStyle = `rgba(92, 58, 30, ${corridorAlpha})`;
        ctx.lineWidth = 0.8;

        const gap = 4; // half-width of corridor

        rooms._corridorPairs.forEach(pair => {
            if (pair[0] >= rooms.length || pair[1] >= rooms.length) return;
            const r1 = rooms[pair[0]];
            const r2 = rooms[pair[1]];

            const x1 = (r1.x + r1.w / 2) * W;
            const y1 = (r1.y + r1.h / 2) * H;
            const x2 = (r2.x + r2.w / 2) * W;
            const y2 = (r2.y + r2.h / 2) * H;

            // Draw double-line corridor (two parallel lines)
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const perpX = Math.cos(angle + Math.PI / 2) * gap;
            const perpY = Math.sin(angle + Math.PI / 2) * gap;

            ctx.beginPath();
            ctx.moveTo(x1 + perpX, y1 + perpY);
            ctx.lineTo(x2 + perpX, y2 + perpY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1 - perpX, y1 - perpY);
            ctx.lineTo(x2 - perpX, y2 - perpY);
            ctx.stroke();
        });
    }

    // ── 6. Room Labels ──────────────────────────────────────
    function drawRoomLabels() {
        const progress = effectiveTier === 'low' ? 1 : drawInProgress;
        if (progress < 0.6) return;

        const labelAlpha = Math.min(1, (progress - 0.6) / 0.4) * 0.35;
        ctx.font = `italic 9px ${SERIF_FONT}`;
        ctx.fillStyle = `rgba(139, 105, 20, ${labelAlpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        rooms.forEach(room => {
            const cx = (room.x + room.w / 2) * W;
            const cy = (room.y + room.h / 2) * H;
            ctx.fillText(room.label, cx, cy);
        });

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    // ── 7. Footprints and Walkers ───────────────────────────
    function updateWalkers(dt) {
        const speedMult = isThinking ? 2.0 : 1.0;

        walkers.forEach(walker => {
            const wp = walker.waypoints;
            const curr = wp[walker.waypointIndex];
            const next = wp[(walker.waypointIndex + 1) % wp.length];

            const targetX = next.x * W;
            const targetY = next.y * H;

            walker.progress += walker.speed * speedMult * dt * 0.015;

            if (walker.progress >= 1) {
                walker.progress = 0;
                walker.waypointIndex = (walker.waypointIndex + 1) % wp.length;
            }

            const prevX = curr.x * W;
            const prevY = curr.y * H;
            walker.x = lerp(prevX, targetX, walker.progress);
            walker.y = lerp(prevY, targetY, walker.progress);

            // Calculate distance moved for footprint spacing
            walker.lastFootprintDist += Math.abs(walker.speed * speedMult * dt * 0.015) * dist(prevX, prevY, targetX, targetY);

            if (walker.lastFootprintDist > 18) {
                walker.lastFootprintDist = 0;
                walker.footStep++;

                // Direction of movement for footprint orientation
                const angle = Math.atan2(targetY - prevY, targetX - prevX);

                // Offset left/right foot perpendicular to direction
                const side = walker.footStep % 2 === 0 ? 1 : -1;
                const perpX = Math.cos(angle + Math.PI / 2) * 3 * side;
                const perpY = Math.sin(angle + Math.PI / 2) * 3 * side;

                footprints.push({
                    x: walker.x + perpX,
                    y: walker.y + perpY,
                    angle: angle,
                    birth: tick,
                    alpha: 0.4,
                });
            }
        });

        // Fade and remove old footprints (5 second lifetime at ~60fps = ~300 ticks)
        const maxAge = targetFPS * 5;
        footprints = footprints.filter(fp => {
            const age = tick - fp.birth;
            fp.alpha = 0.4 * (1 - age / maxAge);
            return fp.alpha > 0.01;
        });
    }

    function drawFootprints() {
        footprints.forEach(fp => {
            // Mouse proximity boost
            const md = dist(mouseX, mouseY, fp.x, fp.y);
            const boost = md < 100 ? 0.15 * (1 - md / 100) : 0;
            const alpha = Math.min(0.6, fp.alpha + boost);

            ctx.save();
            ctx.translate(fp.x, fp.y);
            ctx.rotate(fp.angle);

            ctx.fillStyle = `rgba(92, 58, 30, ${alpha})`;

            // Draw a small oval footprint
            ctx.beginPath();
            ctx.ellipse(0, 0, 2.5, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Toe dots
            ctx.beginPath();
            ctx.arc(-1.2, -4, 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(1.2, -4, 0.8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    }

    function drawWalkerNames() {
        ctx.font = `italic 10px ${SERIF_FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        walkers.forEach(walker => {
            // Mouse proximity boost
            const md = dist(mouseX, mouseY, walker.x, walker.y);
            const boost = md < 100 ? 0.2 * (1 - md / 100) : 0;
            const alpha = 0.6 + boost;

            ctx.fillStyle = `rgba(196, 148, 58, ${alpha})`;
            ctx.fillText(walker.name, walker.x + 8, walker.y - 8);
        });
    }

    // ── 8. Ink Splotches (Mouse Interaction) ────────────────
    function drawSplotches() {
        splotches = splotches.filter(sp => {
            const age = (tick - sp.birth) / targetFPS;
            sp.alpha = sp.baseAlpha * (1 - age / 4); // 4 second fade
            return sp.alpha > 0.01;
        });

        splotches.forEach(sp => {
            ctx.fillStyle = `rgba(92, 58, 30, ${sp.alpha})`;
            // Draw 3-4 overlapping circles for irregular blob
            for (let i = 0; i < sp.blobs.length; i++) {
                const b = sp.blobs[i];
                ctx.beginPath();
                ctx.arc(sp.x + b.ox, sp.y + b.oy, b.r, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    function addSplotch(x, y) {
        if (splotches.length >= 30) splotches.shift();
        const blobs = [];
        const count = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            blobs.push({
                ox: (Math.random() - 0.5) * 6,
                oy: (Math.random() - 0.5) * 6,
                r: 2 + Math.random() * 4,
            });
        }
        splotches.push({
            x, y,
            blobs,
            birth: tick,
            baseAlpha: 0.15 + Math.random() * 0.10,
            alpha: 0.20,
        });
    }

    // ── 9. Magical Flourishes ───────────────────────────────
    function updateFlourishes() {
        if (effectiveTier === 'low') return;

        // Spawn new flourish occasionally
        const spawnInterval = targetFPS * (3 + Math.random() * 2); // 3-5 seconds
        if (flourishes.length < 4 && tick % Math.floor(spawnInterval) === 0) {
            // Find an empty area (not too close to rooms)
            let fx, fy, attempts = 0;
            do {
                fx = 0.1 + Math.random() * 0.8;
                fy = 0.1 + Math.random() * 0.8;
                attempts++;
            } while (attempts < 10 && rooms.some(r =>
                fx > r.x - 0.02 && fx < r.x + r.w + 0.02 &&
                fy > r.y - 0.02 && fy < r.y + r.h + 0.02
            ));

            flourishes.push({
                x: fx * W,
                y: fy * H,
                birth: tick,
                drawProgress: 0,
                fadeAlpha: 1,
                type: Math.floor(Math.random() * 3), // different flourish shapes
                scale: 0.6 + Math.random() * 0.8,
            });
        }

        // Update flourishes
        const intensify = isThinking ? 1.5 : 1.0;
        flourishes = flourishes.filter(fl => {
            const age = (tick - fl.birth) / targetFPS;

            if (age < 1.5) {
                // Drawing phase
                fl.drawProgress = Math.min(1, age / 1.5) * intensify;
                fl.fadeAlpha = 1;
            } else if (age < 3.0) {
                // Hold phase
                fl.drawProgress = 1;
                fl.fadeAlpha = 1;
            } else if (age < 4.5) {
                // Fade phase
                fl.drawProgress = 1;
                fl.fadeAlpha = 1 - (age - 3.0) / 1.5;
            } else {
                return false;
            }
            return true;
        });
    }

    function drawFlourishes() {
        flourishes.forEach(fl => {
            const alpha = 0.2 * fl.fadeAlpha;
            ctx.save();
            ctx.translate(fl.x, fl.y);
            ctx.scale(fl.scale, fl.scale);
            ctx.strokeStyle = `rgba(196, 148, 58, ${alpha})`;
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
                // S-curve flourish
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
                // Ornamental curl
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

    // ── 10. Ink Drip Particles ──────────────────────────────
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
            ctx.fillStyle = `rgba(92, 58, 30, ${drip.alpha})`;
            ctx.beginPath();
            ctx.arc(drip.x, drip.y, drip.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ── 11. Intro Text — "I solemnly swear..." ──────────────
    function updateIntroText() {
        if (!introState) return;

        const elapsed = (performance.now() - introState.startTime) / 1000;

        if (introState.phase === 'writing') {
            // Reveal ~2 chars per frame at 60fps → finish in ~1.5s
            introState.charIndex = Math.min(
                introState.text.length,
                Math.floor(elapsed * 30)
            );
            if (introState.charIndex >= introState.text.length) {
                introState.phase = 'hold';
                introState.phaseStart = performance.now();
            }
        } else if (introState.phase === 'hold') {
            const holdElapsed = (performance.now() - introState.phaseStart) / 1000;
            if (holdElapsed >= 2) {
                introState.phase = 'fade';
                introState.phaseStart = performance.now();
            }
        } else if (introState.phase === 'fade') {
            const fadeElapsed = (performance.now() - introState.phaseStart) / 1000;
            introState.fadeAlpha = 1 - Math.min(1, fadeElapsed / 1.0);
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
        ctx.font = `italic 19px ${SERIF_FONT}`;
        ctx.fillStyle = `rgba(196, 148, 58, ${0.8 * alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, W / 2, H / 2);

        // Subtle "quill" cursor
        if (introState.phase === 'writing' && introState.charIndex < introState.text.length) {
            const textWidth = ctx.measureText(displayText).width;
            const cursorX = W / 2 + textWidth / 2 + 2;
            ctx.fillStyle = `rgba(196, 148, 58, ${0.5 + Math.sin(tick * 0.3) * 0.3})`;
            ctx.fillRect(cursorX, H / 2 - 10, 1.5, 20);
        }

        ctx.restore();
    }

    // ── 12. Thinking Effect — "Mischief Managed" ────────────
    function updateThinkingText() {
        if (!thinkingTextState) return;

        const elapsed = (performance.now() - thinkingTextState.startTime) / 1000;

        if (thinkingTextState.phase === 'writing') {
            thinkingTextState.charIndex = Math.min(
                thinkingTextState.text.length,
                Math.floor(elapsed * 25)
            );
            if (thinkingTextState.charIndex >= thinkingTextState.text.length) {
                thinkingTextState.phase = 'hold';
                thinkingTextState.phaseStart = performance.now();
            }
        } else if (thinkingTextState.phase === 'hold') {
            // Hold while thinking
            if (!isThinking) {
                thinkingTextState.phase = 'fade';
                thinkingTextState.phaseStart = performance.now();
            }
        } else if (thinkingTextState.phase === 'fade') {
            const fadeElapsed = (performance.now() - thinkingTextState.phaseStart) / 1000;
            thinkingTextState.fadeAlpha = 1 - Math.min(1, fadeElapsed / 1.0);
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
        ctx.font = `italic 18px ${SERIF_FONT}`;
        ctx.fillStyle = `rgba(196, 148, 58, ${0.7 * alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, W / 2, H / 2 + 30);
        ctx.restore();
    }

    function drawThinkingEffect() {
        if (!isThinking) return;
        thinkingTick++;

        // Room outlines pulse slightly brighter
        const pulse = 0.05 * Math.sin(thinkingTick * 0.08);
        rooms.forEach(room => {
            const rx = room.x * W;
            const ry = room.y * H;
            const rw = room.w * W;
            const rh = room.h * H;
            ctx.strokeStyle = `rgba(196, 148, 58, ${0.12 + pulse})`;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(rx, ry, rw, rh);
        });
    }

    // ── 13. Speaking Effect ─────────────────────────────────
    function drawSpeakingEffect() {
        if (!isSpeaking) return;
        speakingTick++;
        const cx = W / 2, cy = H / 2;

        // Golden ink ripple expanding from center
        for (let i = 0; i < 3; i++) {
            const phase = (speakingTick * 0.03 + i * 0.8) % 2.5;
            const r = 20 + phase * Math.min(W, H) * 0.08;
            const alpha = Math.max(0, 0.15 - phase * 0.06);
            ctx.strokeStyle = `rgba(196, 148, 58, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Warm parchment pulse at center
        const pulseAlpha = Math.sin(speakingTick * 0.1) * 0.03 + 0.03;
        ctx.fillStyle = `rgba(196, 148, 58, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();

        // Footprints near center briefly glow gold
        footprints.forEach(fp => {
            const d = dist(fp.x, fp.y, cx, cy);
            if (d < 120) {
                const goldAlpha = 0.2 * (1 - d / 120) * Math.sin(speakingTick * 0.12);
                if (goldAlpha > 0) {
                    ctx.fillStyle = `rgba(196, 148, 58, ${goldAlpha})`;
                    ctx.beginPath();
                    ctx.arc(fp.x, fp.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // MAIN RENDER LOOP
    // ═══════════════════════════════════════════════════════

    let lastFrameTime = 0;
    function render(timestamp) {
        if (!canvas || !canvas.parentNode || document.documentElement.getAttribute('data-theme') !== 'marauder') {
            cleanup();
            return;
        }

        const frameInterval = 1000 / targetFPS;
        if (timestamp - lastFrameTime < frameInterval) {
            animId = requestAnimationFrame(render);
            return;
        }
        const dt = Math.min(3, (timestamp - lastFrameTime) / frameInterval); // delta in frame units
        lastFrameTime = timestamp;

        tick++;

        // Update draw-in animation (3 second duration)
        if (drawInProgress < 1 && effectiveTier !== 'low') {
            const elapsed = (performance.now() - drawInStartTime) / 1000;
            drawInProgress = Math.min(1, elapsed / 3.0);
        }

        // Update dynamic elements
        updateWalkers(dt);
        updateFlourishes();
        updateInkDrips();
        updateIntroText();
        updateThinkingText();

        ctx.clearRect(0, 0, W, H);

        // Draw all layers back to front
        drawParchmentBackground();
        drawMapGrid();
        drawBorder();
        drawCorridors();
        drawRooms();
        drawRoomLabels();
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
        initRooms();
        initWalkers();
        initFlourishes();
        initInkDrips();

        tick = 0;
        drawInProgress = effectiveTier === 'low' ? 1 : 0;
        drawInStartTime = performance.now();
        splotches = [];
        footprints = [];

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
        backgroundTexture = null;
        introState = null;
        thinkingTextState = null;
    }

    function onThemeChange() {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'marauder') {
            start();
        } else {
            cleanup();
        }
    }

    // ── Observer & Event Listeners ──────────────────────────

    new MutationObserver(onThemeChange)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    window.addEventListener('resize', () => {
        resize();
        if (canvas) {
            initRooms();
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

        const now = performance.now();
        if (now - lastSplotchTime > 100 && canvas) {
            lastSplotchTime = now;
            addSplotch(mouseX, mouseY);
        }
    });

    // State events
    window.addEventListener('thinking-start', () => {
        isThinking = true;
        thinkingTick = 0;
        // Show "Mischief Managed" text
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

    // Performance setting
    window.addEventListener('marauder-perf-change', (e) => {
        perfTier = e.detail;
        detectPerformance();
        initRooms();
        initWalkers();
        initFlourishes();
        initInkDrips();
    });

    // Initial launch
    if (document.documentElement.getAttribute('data-theme') === 'marauder') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    console.log('[marauder-map] Marauder\'s Map loaded');
})();
