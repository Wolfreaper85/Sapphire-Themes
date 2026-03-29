/**
 * Custom Theme — custom-canvas.js
 * Draws user background image + loads selected overlay effect.
 *
 * Settings stored in localStorage:
 *   custom-bg-image      — data URL of user's background image
 *   custom-accent-color  — hex color string (e.g. "#ff6600")
 *   custom-font          — font family key (e.g. "monospace")
 *   custom-overlay        — overlay id (e.g. "matrix", "nexus", "none")
 *   custom-image-dim      — image dimming 0-100 (default 40)
 *   custom-overlay-opacity — overlay opacity 0-100 (default 70)
 *   custom-chat-style     — "transparent" or "glass"
 *   custom-blur-amount    — glass blur in px (default 12)
 *
 * Licensed under AGPL-3.0
 */
(function () {
    'use strict';

    const PLUGIN = 'sapphire-themes';
    const BASE = `/plugin-web/${PLUGIN}`;
    const CANVAS_ID = 'custom-theme-canvas';

    // ── Guard: only run when custom theme is active ─────────
    function isActive() {
        return document.documentElement.getAttribute('data-theme') === 'custom';
    }
    if (!isActive()) return;

    // ── Canvas setup ────────────────────────────────────────
    let canvas = document.getElementById(CANVAS_ID);
    if (canvas) canvas.remove();

    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let W, H, animId;

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // ── Background image ────────────────────────────────────
    let bgImage = null;
    let bgImageLoaded = false;

    function loadBgImage() {
        const dataUrl = localStorage.getItem('custom-bg-image');
        if (!dataUrl) {
            bgImage = null;
            bgImageLoaded = false;
            return;
        }
        bgImage = new Image();
        bgImage.onload = () => { bgImageLoaded = true; };
        bgImage.onerror = () => { bgImage = null; bgImageLoaded = false; };
        bgImage.src = dataUrl;
    }
    loadBgImage();

    // ── Accent color → CSS variables ────────────────────────
    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }

    function applyAccentColor(hex) {
        if (!hex) hex = '#4a9eff';
        const { r, g, b } = hexToRgb(hex);
        const root = document.documentElement;

        root.style.setProperty('--custom-accent', hex);
        root.style.setProperty('--custom-accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
        root.style.setProperty('--custom-accent-light', `rgba(${r}, ${g}, ${b}, 0.12)`);
        root.style.setProperty('--custom-accent-border', `rgba(${r}, ${g}, ${b}, 0.4)`);
        root.style.setProperty('--custom-accent-50', `rgba(${r}, ${g}, ${b}, 0.55)`);

        // Also update emotion colors to match
        root.style.setProperty('--emotion-color', hex);
        root.style.setProperty('--emotion-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
        root.style.setProperty('--emotion-light', `rgba(${r}, ${g}, ${b}, 0.12)`);
        root.style.setProperty('--emotion-border', `rgba(${r}, ${g}, ${b}, 0.4)`);
        root.style.setProperty('--emotion-50', `rgba(${r}, ${g}, ${b}, 0.55)`);

        // Derive background tints from accent
        root.style.setProperty('--custom-bg', `rgb(${Math.round(r * 0.04)}, ${Math.round(g * 0.04)}, ${Math.round(b * 0.04 + 10)})`);
        root.style.setProperty('--custom-bg-secondary', `rgb(${Math.round(r * 0.06)}, ${Math.round(g * 0.06)}, ${Math.round(b * 0.06 + 12)})`);
        root.style.setProperty('--custom-bg-dark', `rgb(${Math.round(r * 0.02)}, ${Math.round(g * 0.02)}, ${Math.round(b * 0.02 + 8)})`);
        root.style.setProperty('--custom-bg-tertiary', `rgb(${Math.round(r * 0.07)}, ${Math.round(g * 0.07)}, ${Math.round(b * 0.07 + 16)})`);
        root.style.setProperty('--custom-bg-hover', `rgb(${Math.round(r * 0.1)}, ${Math.round(g * 0.1)}, ${Math.round(b * 0.1 + 20)})`);

        // Text colors — light variant of accent
        root.style.setProperty('--custom-text', `rgb(${Math.min(r + 160, 255)}, ${Math.min(g + 160, 255)}, ${Math.min(b + 160, 255)})`);
        root.style.setProperty('--custom-text-light', `rgb(${Math.min(r + 120, 255)}, ${Math.min(g + 120, 255)}, ${Math.min(b + 120, 255)})`);
        root.style.setProperty('--custom-text-secondary', `rgb(${Math.min(r + 70, 255)}, ${Math.min(g + 70, 255)}, ${Math.min(b + 70, 255)})`);
        root.style.setProperty('--custom-text-tertiary', `rgb(${Math.round(r * 0.4)}, ${Math.round(g * 0.4)}, ${Math.round(b * 0.4 + 40)})`);
        root.style.setProperty('--custom-text-muted', `rgb(${Math.round(r * 0.25)}, ${Math.round(g * 0.25)}, ${Math.round(b * 0.25 + 30)})`);

        // Border colors
        root.style.setProperty('--custom-border', `rgba(${r}, ${g}, ${b}, 0.15)`);
        root.style.setProperty('--custom-border-light', `rgba(${r}, ${g}, ${b}, 0.22)`);
        root.style.setProperty('--custom-border-hover', `rgba(${r}, ${g}, ${b}, 0.35)`);
    }

    applyAccentColor(localStorage.getItem('custom-accent-color') || '#4a9eff');

    // ── Font ────────────────────────────────────────────────
    const FONT_MAP = {
        'system': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        'inter': "'Inter', system-ui, sans-serif",
        'roboto': "'Roboto', system-ui, sans-serif",
        'poppins': "'Poppins', system-ui, sans-serif",
        'open-sans': "'Open Sans', system-ui, sans-serif",
        'lato': "'Lato', system-ui, sans-serif",
        'nunito': "'Nunito', system-ui, sans-serif",
        'montserrat': "'Montserrat', system-ui, sans-serif",
        'raleway': "'Raleway', system-ui, sans-serif",
        'playfair': "'Playfair Display', Georgia, serif",
        'merriweather': "'Merriweather', Georgia, serif",
        'georgia': "Georgia, 'Palatino Linotype', serif",
        'lora': "'Lora', Georgia, serif",
        'monospace': "'Consolas', 'JetBrains Mono', 'Courier New', monospace",
        'fira-code': "'Fira Code', 'Consolas', monospace",
        'source-code': "'Source Code Pro', 'Consolas', monospace",
        'jetbrains': "'JetBrains Mono', 'Consolas', monospace",
        'ubuntu-mono': "'Ubuntu Mono', 'Consolas', monospace",
        'cascadia': "'Cascadia Code', 'Consolas', monospace",
        'comic-neue': "'Comic Neue', 'Comic Sans MS', cursive",
        'caveat': "'Caveat', cursive",
        'pacifico': "'Pacifico', cursive",
    };

    // Google Fonts loader — loads font from Google Fonts CDN if needed
    const loadedFonts = new Set();

    function loadGoogleFont(fontKey) {
        // System, monospace, and Georgia don't need loading
        const skipLoad = ['system', 'monospace', 'georgia'];
        if (skipLoad.includes(fontKey) || loadedFonts.has(fontKey)) return;

        const fontNameMap = {
            'inter': 'Inter',
            'roboto': 'Roboto',
            'poppins': 'Poppins',
            'open-sans': 'Open+Sans',
            'lato': 'Lato',
            'nunito': 'Nunito',
            'montserrat': 'Montserrat',
            'raleway': 'Raleway',
            'playfair': 'Playfair+Display',
            'merriweather': 'Merriweather',
            'lora': 'Lora',
            'fira-code': 'Fira+Code',
            'source-code': 'Source+Code+Pro',
            'jetbrains': 'JetBrains+Mono',
            'ubuntu-mono': 'Ubuntu+Mono',
            'cascadia': 'Cascadia+Code',
            'comic-neue': 'Comic+Neue',
            'caveat': 'Caveat',
            'pacifico': 'Pacifico',
        };

        const googleName = fontNameMap[fontKey];
        if (!googleName) return;

        const linkId = `custom-font-${fontKey}`;
        if (document.getElementById(linkId)) { loadedFonts.add(fontKey); return; }

        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${googleName}:wght@300;400;500;600;700&display=swap`;
        document.head.appendChild(link);
        loadedFonts.add(fontKey);
    }

    function applyFont(fontKey) {
        if (!fontKey) fontKey = 'system';
        const fontFamily = FONT_MAP[fontKey] || FONT_MAP['system'];
        loadGoogleFont(fontKey);
        document.documentElement.style.setProperty('--custom-font', fontFamily);
    }

    applyFont(localStorage.getItem('custom-font'));

    // ── Overlay management ──────────────────────────────────
    let currentOverlay = null;

    // Map overlay IDs to their script paths
    const OVERLAY_SCRIPTS = {
        'matrix': `${BASE}/themes/matrix/matrix-rain.js`,
        'jarvis': `${BASE}/themes/jarvis/jarvis-hud.js`,
        'ironman': `${BASE}/themes/ironman/ironman-hud.js`,
        'nexus': `${BASE}/themes/nexus/nexus-network.js`,
        'cosmos': `${BASE}/themes/cosmos/cosmos-solar.js`,
        'prism': `${BASE}/themes/prism/prism-rain.js`,
        'marauder': `${BASE}/themes/marauder/marauder-map.js`,
        'lattice': `/plugin-web/sapphire-lattice-theme/lattice-grid.js`,
    };

    function loadOverlay(overlayId) {
        // Remove previous overlay canvas & script
        unloadOverlay();

        if (!overlayId || overlayId === 'none') {
            currentOverlay = null;
            return;
        }

        const scriptUrl = OVERLAY_SCRIPTS[overlayId];
        if (!scriptUrl) return;

        // Set the overlay's expected data-theme temporarily so the overlay script
        // thinks its theme is active (they check data-theme to decide whether to run)
        // We do this by adding a data attribute the overlay scripts can also check
        document.documentElement.setAttribute('data-custom-overlay', overlayId);

        currentOverlay = overlayId;

        // Load the overlay script
        const scriptId = `custom-overlay-script`;
        const s = document.createElement('script');
        s.id = scriptId;
        s.src = scriptUrl + '?custom=1&v=' + Date.now();
        document.body.appendChild(s);
    }

    function unloadOverlay() {
        // Remove overlay script
        const oldScript = document.getElementById('custom-overlay-script');
        if (oldScript) oldScript.remove();

        // Remove any overlay canvases (they use known IDs)
        const canvasIds = [
            'matrix-rain-canvas',
            'jarvis-hud-canvas',
            'ironman-hud-canvas',
            'nexus-network-canvas',
            'cosmos-solar-canvas',
            'prism-rain-canvas',
            'marauder-map-canvas',
            'lattice-grid-canvas',
        ];
        canvasIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // Remove Lattice data overlay (HUD text element)
        const latticeOverlay = document.getElementById('lattice-data-overlay');
        if (latticeOverlay) latticeOverlay.remove();

        document.documentElement.removeAttribute('data-custom-overlay');
        currentOverlay = null;
    }

    // ── Blur amount ─────────────────────────────────────────
    function applyBlur(px) {
        document.documentElement.style.setProperty('--custom-blur', (px || 12) + 'px');
    }
    applyBlur(localStorage.getItem('custom-blur-amount'));

    // ── Overlay opacity ─────────────────────────────────────
    const OVERLAY_CANVAS_IDS = [
        'matrix-rain-canvas', 'jarvis-hud-canvas', 'ironman-hud-canvas',
        'nexus-network-canvas', 'cosmos-solar-canvas', 'prism-rain-canvas',
        'marauder-map-canvas', 'lattice-grid-canvas',
    ];

    function applyOverlayOpacity() {
        const v = parseInt(localStorage.getItem('custom-overlay-opacity') || '70', 10);
        const opac = Math.max(0, Math.min(100, v)) / 100;
        OVERLAY_CANVAS_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.opacity = opac;
        });
    }

    // Watch for overlay canvases being added to the DOM and apply opacity
    new MutationObserver(() => {
        if (isActive()) applyOverlayOpacity();
    }).observe(document.body, { childList: true, subtree: true });

    // Also apply on opacity slider change
    window.addEventListener('custom-opacity-change', () => applyOverlayOpacity());

    // ── Main render loop — draws background image ───────────
    const dimAlpha = () => {
        const v = parseInt(localStorage.getItem('custom-image-dim') || '40', 10);
        return Math.max(0, Math.min(100, v)) / 100;
    };

    function drawFrame() {
        if (!isActive()) {
            cleanup();
            return;
        }

        ctx.clearRect(0, 0, W, H);

        // Draw background image (cover-scaled)
        if (bgImage && bgImageLoaded) {
            const imgW = bgImage.naturalWidth;
            const imgH = bgImage.naturalHeight;
            const scale = Math.max(W / imgW, H / imgH);
            const dw = imgW * scale;
            const dh = imgH * scale;
            const dx = (W - dw) / 2;
            const dy = (H - dh) / 2;

            ctx.drawImage(bgImage, dx, dy, dw, dh);

            // Dimming overlay
            const dim = dimAlpha();
            if (dim > 0) {
                ctx.fillStyle = `rgba(0, 0, 0, ${dim})`;
                ctx.fillRect(0, 0, W, H);
            }
        } else {
            // No image — just fill with theme bg color
            const accent = localStorage.getItem('custom-accent-color') || '#4a9eff';
            const { r, g, b } = hexToRgb(accent);
            ctx.fillStyle = `rgb(${Math.round(r * 0.04)}, ${Math.round(g * 0.04)}, ${Math.round(b * 0.04 + 10)})`;
            ctx.fillRect(0, 0, W, H);
        }

        animId = requestAnimationFrame(drawFrame);
    }

    animId = requestAnimationFrame(drawFrame);

    // Load saved overlay — wait for DOM to be fully ready
    function autoLoadOverlay() {
        const savedOverlay = localStorage.getItem('custom-overlay') || 'none';
        if (savedOverlay !== 'none') {
            loadOverlay(savedOverlay);
        }
    }

    if (document.readyState === 'complete') {
        setTimeout(autoLoadOverlay, 200);
    } else {
        window.addEventListener('load', () => setTimeout(autoLoadOverlay, 300));
    }

    // ── Event listeners for settings changes ────────────────
    window.addEventListener('custom-accent-change', (e) => {
        applyAccentColor(e.detail);
    });

    window.addEventListener('custom-font-change', (e) => {
        applyFont(e.detail);
    });

    window.addEventListener('custom-image-change', () => {
        loadBgImage();
    });

    window.addEventListener('custom-overlay-change', (e) => {
        loadOverlay(e.detail);
    });

    window.addEventListener('custom-blur-change', (e) => {
        applyBlur(e.detail);
    });

    // ── Cleanup on theme switch ─────────────────────────────
    function cleanup() {
        cancelAnimationFrame(animId);
        unloadOverlay();
        const c = document.getElementById(CANVAS_ID);
        if (c) c.remove();

        // Clean up CSS custom properties
        const props = [
            '--custom-accent', '--custom-accent-glow', '--custom-accent-light',
            '--custom-accent-border', '--custom-accent-50',
            '--custom-bg', '--custom-bg-secondary', '--custom-bg-dark',
            '--custom-bg-tertiary', '--custom-bg-hover',
            '--custom-text', '--custom-text-light', '--custom-text-secondary',
            '--custom-text-tertiary', '--custom-text-muted',
            '--custom-border', '--custom-border-light', '--custom-border-hover',
            '--custom-font', '--custom-blur',
        ];
        props.forEach(p => document.documentElement.style.removeProperty(p));
    }

    // Watch for theme changes
    new MutationObserver(() => {
        if (!isActive()) cleanup();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

})();
