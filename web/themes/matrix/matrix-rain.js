/**
 * Matrix Rain — Classic falling character rain background.
 * Procedurally generated on HTML Canvas. State-reactive (thinking/speaking).
 *
 * Visual layers (back→front):
 *   1. Black background with subtle green radial vignette
 *   2. Falling character columns (the rain)
 *   3. Bright "head" characters at the bottom of each stream
 *   4. Glow/bloom effect on head characters
 *   5. Occasional bright flash columns (thinking state)
 *   6. HUD corner brackets (dim green)
 *
 * Modes: off | ambient | reactive | avatar
 * Events: 'sapphire-thinking', 'sapphire-tts', 'sapphire-message'
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    const MODES = ['off', 'ambient', 'reactive', 'avatar'];
    let currentMode = localStorage.getItem('matrix-rain-mode') || 'ambient';
    let canvas, ctx, animId;
    let W = 0, H = 0;
    let tick = 0;

    // ── Character Set ─────────────────────────────────────────
    // Half-width katakana + latin + digits + symbols (classic Matrix look)
    const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=<>?';
    const CHAR_ARR = CHARS.split('');

    function randomChar() {
        return CHAR_ARR[(Math.random() * CHAR_ARR.length) | 0];
    }

    // ── Color System ──────────────────────────────────────────
    const COLORS = {
        green:     { r: 0,   g: 255, b: 70  },
        dimGreen:  { r: 0,   g: 180, b: 50  },
        darkGreen: { r: 0,   g: 100, b: 30  },
        white:     { r: 220, g: 255, b: 220 },
        black:     { r: 0,   g: 0,   b: 0   },
    };

    let activeColor   = { ...COLORS.green };
    let targetColor   = { ...COLORS.green };

    let gridIntensity = 0.85;
    let targetIntensity = 1.0;
    let isThinking = false;
    let thinkingTick = 0;
    let isSpeaking = false;
    let speakingTick = 0;
    let speakingFade = 0;

    function rgba(c, a) {
        return `rgba(${c.r|0},${c.g|0},${c.b|0},${a})`;
    }

    function lerpColor(a, b, t) {
        return {
            r: a.r + (b.r - a.r) * t,
            g: a.g + (b.g - a.g) * t,
            b: a.b + (b.b - a.b) * t,
        };
    }

    // ── Performance Tiers ─────────────────────────────────────
    function detectPerfTier() {
        const stored = localStorage.getItem('matrix-perf-tier');
        if (stored && ['low', 'medium', 'high'].includes(stored)) return stored;
        const cores = navigator.hardwareConcurrency || 2;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile || cores <= 2) return 'low';
        if (cores <= 4) return 'medium';
        return 'high';
    }

    let perfTier = detectPerfTier();
    const PERF_CONFIG = {
        low:    { fontSize: 18, targetFps: 24, glowEnabled: false, maxColumns: 60  },
        medium: { fontSize: 16, targetFps: 30, glowEnabled: true,  maxColumns: 120 },
        high:   { fontSize: 14, targetFps: 40, glowEnabled: true,  maxColumns: 200 },
    };
    let PERF = PERF_CONFIG[perfTier];

    // ── Rain Density & Speed ──────────────────────────────────
    const DENSITY_MAP = { sparse: 0.4, medium: 0.7, dense: 1.0 };
    const SPEED_MAP   = { slow: 0.5, normal: 1.0, fast: 1.8 };

    let density = DENSITY_MAP[localStorage.getItem('matrix-rain-density') || 'medium'];
    let speed   = SPEED_MAP[localStorage.getItem('matrix-rain-speed') || 'normal'];

    // ── Column State ──────────────────────────────────────────
    let columns = [];
    let fontSize = PERF.fontSize;
    let numCols = 0;

    function initColumns() {
        fontSize = PERF.fontSize;
        numCols = Math.min(Math.ceil(W / fontSize), PERF.maxColumns);
        columns = [];

        for (let i = 0; i < numCols; i++) {
            columns.push(createColumn(i, true));
        }
    }

    function createColumn(index, scatter) {
        const maxLen = Math.floor(H / fontSize);
        const streamLen = 8 + (Math.random() * (maxLen * 0.6)) | 0;
        const baseSpeed = 0.3 + Math.random() * 0.7;

        // Each column holds an array of characters that change over time
        const chars = [];
        for (let j = 0; j < streamLen; j++) {
            chars.push({
                char: randomChar(),
                changeRate: 0.02 + Math.random() * 0.08, // probability of changing each frame
            });
        }

        return {
            x: index * fontSize,
            y: scatter ? -(Math.random() * H * 2) : -(streamLen * fontSize),
            speed: baseSpeed,
            streamLen,
            chars,
            brightness: 0.5 + Math.random() * 0.5,
            active: Math.random() < density,
            respawnDelay: 0,
        };
    }

    // ── Drawing ───────────────────────────────────────────────

    function drawBackground() {
        // When running as custom overlay, clear instead of filling so user's bg image shows
        if (document.documentElement.getAttribute('data-custom-overlay') === 'matrix') {
            ctx.clearRect(0, 0, W, H);
            return;
        }
        // Solid black with a subtle green radial vignette
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // Subtle green glow from center
        const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
        grd.addColorStop(0, 'rgba(0, 40, 10, 0.15)');
        grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
    }

    function drawRain() {
        const pri = activeColor;
        const intensityMod = gridIntensity;
        const speedMod = speed * (isThinking ? 2.0 : (isSpeaking ? 1.3 : 1.0));

        ctx.font = `${fontSize}px "MS Gothic", "Consolas", monospace`;
        ctx.textAlign = 'center';

        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];

            if (!col.active) {
                col.respawnDelay--;
                if (col.respawnDelay <= 0) {
                    columns[i] = createColumn(i, false);
                    columns[i].active = true;
                }
                continue;
            }

            // Move column down
            col.y += col.speed * speedMod * fontSize * 0.12;

            // Draw each character in the stream
            for (let j = 0; j < col.streamLen; j++) {
                const charY = col.y - j * fontSize;

                // Skip if off screen
                if (charY < -fontSize || charY > H + fontSize) continue;

                // Randomly mutate characters for the flickering effect
                if (Math.random() < col.chars[j].changeRate) {
                    col.chars[j].char = randomChar();
                }

                // Fade: head is brightest, tail fades out
                const headDist = j / col.streamLen;
                let alpha;

                if (j === 0) {
                    // Head character — bright white/green
                    alpha = 1.0 * intensityMod * col.brightness;
                    if (PERF.glowEnabled) {
                        ctx.shadowColor = rgba(pri, 0.8);
                        ctx.shadowBlur = 15;
                    }
                    ctx.fillStyle = rgba(COLORS.white, alpha);
                } else if (j < 3) {
                    // Near-head — bright green
                    alpha = (0.9 - headDist * 0.3) * intensityMod * col.brightness;
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = rgba(pri, alpha);
                } else {
                    // Body/tail — fading green
                    alpha = Math.max(0.05, (1 - headDist) * 0.7) * intensityMod * col.brightness;
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    const fadeColor = lerpColor(COLORS.darkGreen, pri, 1 - headDist);
                    ctx.fillStyle = rgba(fadeColor, alpha);
                }

                ctx.fillText(col.chars[j].char, col.x + fontSize / 2, charY);
            }

            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            // Check if column has scrolled off screen
            const tailY = col.y - col.streamLen * fontSize;
            if (tailY > H) {
                col.active = false;
                col.respawnDelay = (10 + Math.random() * 60) | 0;
            }
        }
    }

    function drawThinkingFlash() {
        if (!isThinking) return;
        thinkingTick++;

        // Occasional bright column flash
        if (thinkingTick % 8 === 0) {
            const flashX = (Math.random() * numCols | 0) * fontSize;
            const grad = ctx.createLinearGradient(flashX, 0, flashX, H);
            grad.addColorStop(0, 'rgba(0, 255, 70, 0)');
            grad.addColorStop(0.3, 'rgba(0, 255, 70, 0.08)');
            grad.addColorStop(0.5, 'rgba(0, 255, 70, 0.15)');
            grad.addColorStop(0.7, 'rgba(0, 255, 70, 0.08)');
            grad.addColorStop(1, 'rgba(0, 255, 70, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(flashX - fontSize, 0, fontSize * 2, H);
        }

        // Subtle overall green pulse
        const pulseAlpha = Math.sin(thinkingTick * 0.1) * 0.03 + 0.02;
        ctx.fillStyle = `rgba(0, 255, 70, ${pulseAlpha})`;
        ctx.fillRect(0, 0, W, H);
    }

    function drawSpeakingPulse() {
        if (!isSpeaking) {
            speakingFade = Math.max(0, speakingFade - 0.02);
            if (speakingFade <= 0) return;
        } else {
            speakingFade = Math.min(1, speakingFade + 0.05);
            speakingTick++;
        }

        // Gentle wave from bottom
        const waveH = H * 0.15;
        const waveY = H - waveH;
        const waveAlpha = (Math.sin(speakingTick * 0.08) * 0.04 + 0.06) * speakingFade;
        const grad = ctx.createLinearGradient(0, waveY, 0, H);
        grad.addColorStop(0, 'rgba(0, 255, 70, 0)');
        grad.addColorStop(1, `rgba(0, 255, 70, ${waveAlpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, waveY, W, waveH);
    }

    function drawHUDBrackets() {
        const pri = activeColor;
        const a = 0.25 * gridIntensity;
        const size = 30;
        const pad = 12;

        ctx.strokeStyle = rgba(pri, a);
        ctx.lineWidth = 1.5;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(pad, pad + size);
        ctx.lineTo(pad, pad);
        ctx.lineTo(pad + size, pad);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(W - pad - size, pad);
        ctx.lineTo(W - pad, pad);
        ctx.lineTo(W - pad, pad + size);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(pad, H - pad - size);
        ctx.lineTo(pad, H - pad);
        ctx.lineTo(pad + size, H - pad);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(W - pad - size, H - pad);
        ctx.lineTo(W - pad, H - pad);
        ctx.lineTo(W - pad, H - pad - size);
        ctx.stroke();
    }

    // ── Emotion Color Updates ─────────────────────────────────
    function updateColors() {
        // Smooth lerp active → target
        activeColor.r += (targetColor.r - activeColor.r) * 0.03;
        activeColor.g += (targetColor.g - activeColor.g) * 0.03;
        activeColor.b += (targetColor.b - activeColor.b) * 0.03;
        gridIntensity += (targetIntensity - gridIntensity) * 0.05;

        // Update CSS custom property for UI elements
        const r = activeColor.r | 0, g = activeColor.g | 0, b = activeColor.b | 0;
        document.documentElement.style.setProperty('--emotion-color', `rgb(${r},${g},${b})`);
        document.documentElement.style.setProperty('--emotion-glow', `rgba(${r},${g},${b},0.35)`);
        document.documentElement.style.setProperty('--emotion-light', `rgba(${r},${g},${b},0.12)`);
        document.documentElement.style.setProperty('--emotion-border', `rgba(${r},${g},${b},0.4)`);
        document.documentElement.style.setProperty('--emotion-50', `rgba(${r},${g},${b},0.55)`);
    }

    // ── Animation Loop ────────────────────────────────────────
    let lastFrame = 0;
    const frameBudget = 1000 / PERF.targetFps;

    function animate(now) {
        animId = requestAnimationFrame(animate);

        // Frame limiting
        if (now - lastFrame < frameBudget) return;
        lastFrame = now;

        const theme = document.documentElement.getAttribute('data-theme');
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'matrix';
        if ((theme !== 'matrix' && !isCustomOverlay) || currentMode === 'off') {
            if (canvas) canvas.style.display = 'none';
            return;
        }
        if (canvas) canvas.style.display = 'block';

        tick++;
        updateColors();

        drawBackground();
        drawRain();
        drawThinkingFlash();
        drawSpeakingPulse();
        drawHUDBrackets();
    }

    // ── Canvas Setup ──────────────────────────────────────────
    function createCanvas() {
        canvas = document.createElement('canvas');
        canvas.id = 'matrix-rain-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
        document.body.prepend(canvas);
        ctx = canvas.getContext('2d');
    }

    function resize() {
        if (!canvas) return;
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W;
        canvas.height = H;
        initColumns();
    }

    function init() {
        const theme = document.documentElement.getAttribute('data-theme');
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'matrix';
        createCanvas();
        resize();

        if (theme !== 'matrix' && !isCustomOverlay) {
            canvas.style.display = 'none';
        }

        window.addEventListener('resize', resize);
        animId = requestAnimationFrame(animate);
    }

    // ── Event Listeners ───────────────────────────────────────

    // Theme change — show/hide canvas
    new MutationObserver(() => {
        const theme = document.documentElement.getAttribute('data-theme');
        const isCustomOverlay = document.documentElement.getAttribute('data-custom-overlay') === 'matrix';
        if (canvas) {
            canvas.style.display = (theme === 'matrix' || isCustomOverlay) ? 'block' : 'none';
        }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-custom-overlay'] });

    // Sapphire state events
    window.addEventListener('sapphire-thinking', (e) => {
        isThinking = !!e.detail?.active;
        if (isThinking) {
            targetIntensity = 1.3;
            thinkingTick = 0;
        } else {
            targetIntensity = 1.0;
        }
    });

    window.addEventListener('sapphire-tts', (e) => {
        isSpeaking = !!e.detail?.active;
        if (isSpeaking) {
            speakingTick = 0;
        }
    });

    window.addEventListener('sapphire-emotion', (e) => {
        // Could map emotions to slight color shifts, but keep it green
        // Just pulse intensity
        targetIntensity = 1.1;
        setTimeout(() => { targetIntensity = 1.0; }, 2000);
    });

    // Settings changes
    window.addEventListener('matrix-density-change', (e) => {
        density = DENSITY_MAP[e.detail] || DENSITY_MAP.medium;
        initColumns();
    });

    window.addEventListener('matrix-speed-change', (e) => {
        speed = SPEED_MAP[e.detail] || SPEED_MAP.normal;
    });

    window.addEventListener('matrix-perf-change', (e) => {
        perfTier = e.detail === 'auto' ? detectPerfTier() : e.detail;
        PERF = PERF_CONFIG[perfTier] || PERF_CONFIG.medium;
        resize(); // reinit columns with new settings
    });

    window.addEventListener('lattice-mode-change', () => {}); // ignore lattice events

    // ── Init ──────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.matrixRain = {
        setMode(m) {
            if (MODES.includes(m)) {
                currentMode = m;
                localStorage.setItem('matrix-rain-mode', m);
            }
        },
        getMode() { return currentMode; },
    };
})();
