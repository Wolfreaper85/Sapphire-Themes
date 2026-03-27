/**
 * Sapphire Themes Plugin — main.js
 * Manages bundled themes and detects external theme plugins (e.g. Lattice).
 *
 * Bundled themes live in /plugin-web/sapphire-themes/themes/{name}/
 * External themes are detected via /api/webui/plugins and included in the picker.
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    const PLUGIN = 'sapphire-themes';
    const BASE = `/plugin-web/${PLUGIN}`;

    // ── Registry of all known themes ──────────────────────────
    // Bundled themes are defined here. External themes are discovered at runtime.
    const BUNDLED_THEMES = {
        matrix: {
            name: 'Matrix',
            id: 'matrix',
            icon: '🟢',
            description: 'Classic green digital rain',
            css: `${BASE}/themes/matrix/matrix.css`,
            scripts: [`${BASE}/themes/matrix/matrix-rain.js`],
            preview: {
                bg: '#000000',
                accent: '#00ff46',
                text: '#00ff46',
            },
        },
        jarvis: {
            name: 'JARVIS',
            id: 'jarvis',
            icon: '🔵',
            description: 'Iron Man HUD holographics',
            css: `${BASE}/themes/jarvis/jarvis.css`,
            scripts: [`${BASE}/themes/jarvis/jarvis-hud.js`],
            preview: {
                bg: '#04080e',
                accent: '#00a8ff',
                text: '#b0d4f1',
            },
        },
        ironman: {
            name: 'Iron Man',
            id: 'ironman',
            icon: '🔴',
            description: 'Helmet HUD combat system',
            css: `${BASE}/themes/ironman/ironman.css`,
            scripts: [`${BASE}/themes/ironman/ironman-hud.js`],
            preview: {
                bg: '#0a0404',
                accent: '#cc0000',
                text: '#e8d0c0',
            },
        },
        nexus: {
            name: 'Nexus',
            id: 'nexus',
            icon: '🔗',
            description: 'Neural network constellation',
            css: `${BASE}/themes/nexus/nexus.css`,
            scripts: [`${BASE}/themes/nexus/nexus-network.js`],
            preview: {
                bg: '#050510',
                accent: '#9cd9f9',
                text: '#d0dce8',
            },
        },
        cosmos: {
            name: 'Cosmos',
            id: 'cosmos',
            icon: '🪐',
            description: 'Solar system with interactive stars',
            css: `${BASE}/themes/cosmos/cosmos.css`,
            scripts: [`${BASE}/themes/cosmos/cosmos-solar.js`],
            preview: {
                bg: '#020108',
                accent: '#7b68ee',
                text: '#d4d0e8',
            },
        },
        prism: {
            name: 'Prism',
            id: 'prism',
            icon: '🌈',
            description: 'Rainbow light refraction',
            css: `${BASE}/themes/prism/prism.css`,
            scripts: [`${BASE}/themes/prism/prism-rain.js`],
            preview: {
                bg: '#080810',
                accent: '#7b68ee',
                text: '#e0dce8',
            },
        },
        marauder: {
            name: "Marauder's Map",
            id: 'marauder',
            icon: '🗺️',
            description: 'Enchanted parchment with ink footprints',
            css: `${BASE}/themes/marauder/marauder.css`,
            scripts: [`${BASE}/themes/marauder/marauder-map.js`],
            preview: {
                bg: '#2a1f14',
                accent: '#c4943a',
                text: '#d4c4a0',
            },
        },
        // Add more bundled themes here:
    };

    // External themes discovered at runtime
    const externalThemes = {};

    // Combined registry — populated on init
    const allThemes = {};

    // ── 1. Load shared nav icons ──────────────────────────────
    if (!document.getElementById('themes-plugin-nav')) {
        const s = document.createElement('script');
        s.id = 'themes-plugin-nav';
        s.src = `${BASE}/nav-icons.js`;
        document.body.appendChild(s);

        // Register bundled themes with nav icons once loaded
        s.onload = function() {
            if (window.sapphireThemesNavIcons) {
                Object.keys(BUNDLED_THEMES).forEach(function(id) {
                    window.sapphireThemesNavIcons.registerTheme(id);
                });
            }
        };
    }

    // ── 2. Inject active bundled theme's CSS ──────────────────
    function loadBundledThemeCSS(themeId) {
        const theme = BUNDLED_THEMES[themeId];
        if (!theme) return;

        // Inject CSS
        const existingCSS = document.getElementById('themes-plugin-css');
        if (existingCSS) {
            existingCSS.href = theme.css;
        } else {
            const link = document.createElement('link');
            link.id = 'themes-plugin-css';
            link.rel = 'stylesheet';
            link.href = theme.css;
            document.head.appendChild(link);
        }

        // Load scripts (rain, etc.)
        theme.scripts.forEach(function(src, i) {
            const scriptId = `themes-plugin-script-${themeId}-${i}`;
            if (!document.getElementById(scriptId)) {
                const s = document.createElement('script');
                s.id = scriptId;
                s.src = src;
                document.body.appendChild(s);
            }
        });
    }

    function unloadBundledThemeCSS() {
        const css = document.getElementById('themes-plugin-css');
        if (css) css.remove();
    }

    // ── 3. Detect external theme plugins ──────────────────────
    async function detectExternalThemes() {
        try {
            const resp = await fetch('/api/webui/plugins');
            if (!resp.ok) return;
            const data = await resp.json();
            const plugins = data.plugins || [];

            for (const p of plugins) {
                // Skip ourselves and disabled plugins
                if (p.name === PLUGIN || !p.enabled) continue;

                // Look for theme plugins by name pattern
                if (!p.name.includes('theme')) continue;

                // Skip if it's a bundled theme (shouldn't happen, but safety check)
                const themeId = extractThemeId(p.name);
                if (BUNDLED_THEMES[themeId]) continue;

                externalThemes[themeId] = {
                    name: p.title || p.name.replace('sapphire-', '').replace('-theme', '').replace(/(^|\s)\S/g, function(t) { return t.toUpperCase(); }),
                    id: themeId,
                    icon: p.icon || '🎨',
                    description: p.description || 'External theme plugin',
                    external: true,
                    pluginName: p.name,
                    preview: guessPreviewColors(themeId),
                };
            }
        } catch (e) {
            console.warn(`[${PLUGIN}] Failed to detect external themes:`, e);
        }
    }

    function extractThemeId(pluginName) {
        // "sapphire-lattice-theme" → "lattice"
        return pluginName
            .replace(/^sapphire-/, '')
            .replace(/-theme$/, '');
    }

    function guessPreviewColors(themeId) {
        // Known external themes get accurate previews
        const known = {
            lattice: { bg: '#020408', accent: '#00b4ff', text: '#7fdbff' },
        };
        return known[themeId] || { bg: '#1a1a2e', accent: '#4a9eff', text: '#ccc' };
    }

    // ── 4. Build combined theme registry ──────────────────────
    function buildRegistry() {
        // Always include the built-in defaults
        allThemes['dark'] = {
            name: 'Dark',
            id: 'dark',
            icon: '🌙',
            description: 'Default dark theme',
            builtin: true,
            preview: { bg: '#1e1e2e', accent: '#4a9eff', text: '#e0e0e0' },
        };
        allThemes['light'] = {
            name: 'Light',
            id: 'light',
            icon: '☀️',
            description: 'Default light theme',
            builtin: true,
            preview: { bg: '#ffffff', accent: '#2563eb', text: '#333333' },
        };

        // Add bundled themes
        Object.assign(allThemes, BUNDLED_THEMES);

        // Add external themes
        Object.assign(allThemes, externalThemes);
    }

    // ── 5. Patch theme list in themes.json ────────────────────
    const _origFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await _origFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            if (url.includes('themes/themes.json')) {
                const clone = response.clone();
                const data = await clone.json();
                if (Array.isArray(data.themes)) {
                    let modified = false;
                    // Add all bundled theme IDs
                    Object.keys(BUNDLED_THEMES).forEach(function(id) {
                        if (!data.themes.includes(id)) {
                            data.themes.push(id);
                            modified = true;
                        }
                    });
                    if (modified) {
                        return new Response(JSON.stringify(data), {
                            status: response.status,
                            statusText: response.statusText,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
            }
        } catch (e) {
            // pass through
        }
        return response;
    };

    // ── 6. Intercept theme CSS loading for bundled themes ─────
    function patchThemeLink() {
        const link = document.getElementById('theme-stylesheet');
        if (!link) return;

        const observer = new MutationObserver(function() {
            Object.keys(BUNDLED_THEMES).forEach(function(id) {
                if (link.href && link.href.includes(`/themes/${id}.css`)) {
                    link.href = BUNDLED_THEMES[id].css;
                }
            });
        });
        observer.observe(link, { attributes: true, attributeFilter: ['href'] });

        // Also patch on initial load
        Object.keys(BUNDLED_THEMES).forEach(function(id) {
            if (link.href && link.href.includes(`/themes/${id}.css`)) {
                link.href = BUNDLED_THEMES[id].css;
            }
        });
    }

    // ── 7. Handle theme activation ────────────────────────────
    function activateTheme(themeId) {
        document.documentElement.setAttribute('data-theme', themeId);
        localStorage.setItem('sapphire-theme', themeId);

        const link = document.getElementById('theme-stylesheet');
        const bust = Date.now();

        if (BUNDLED_THEMES[themeId]) {
            // Bundled theme — load our CSS
            const cssUrl = BUNDLED_THEMES[themeId].css + '?v=' + bust;
            if (link) {
                link.href = cssUrl;
            } else {
                const l = document.createElement('link');
                l.id = 'theme-stylesheet';
                l.rel = 'stylesheet';
                l.href = cssUrl;
                document.head.appendChild(l);
            }
            loadBundledThemeCSS(themeId);
        } else if (externalThemes[themeId]) {
            // External theme — let its own plugin handle CSS
            // Just set data-theme and the external plugin's MutationObserver picks it up
            if (link) {
                link.href = `/plugin-web/${externalThemes[themeId].pluginName}/${themeId}.css?v=${bust}`;
            }
        } else {
            // Built-in theme (dark/light)
            if (link) link.href = `/static/themes/${themeId}.css?v=${bust}`;
            unloadBundledThemeCSS();
        }

        // Save to server
        fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify({ THEME: themeId })
        }).catch(function() {});
    }

    // Expose for settings UI
    window.sapphireThemes = {
        getAll: function() { return allThemes; },
        getBundled: function() { return BUNDLED_THEMES; },
        getExternal: function() { return externalThemes; },
        activate: activateTheme,
        getCurrent: function() {
            return document.documentElement.getAttribute('data-theme') || 'dark';
        },
    };

    // ── Random Theme on Startup ───────────────────────────────
    function applyRandomThemeIfEnabled() {
        const enabled = localStorage.getItem('sapphire-random-enabled') === 'true';
        if (!enabled) return false;

        const poolRaw = localStorage.getItem('sapphire-random-pool');
        let pool;
        try {
            pool = poolRaw ? JSON.parse(poolRaw) : [];
        } catch (_) {
            pool = [];
        }

        // Filter pool to only themes that actually exist
        pool = pool.filter(function(id) { return allThemes[id]; });

        // If pool is empty, use all available themes
        if (pool.length === 0) {
            pool = Object.keys(allThemes);
        }

        // Pick a random theme
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) {
            console.log(`[${PLUGIN}] Random startup theme: ${pick}`);
            activateTheme(pick);
            return true;
        }
        return false;
    }

    // ── Init ──────────────────────────────────────────────────
    async function init() {
        await detectExternalThemes();
        buildRegistry();

        // Apply random theme on startup if enabled
        if (!applyRandomThemeIfEnabled()) {
            // Otherwise load current theme's assets
            const current = document.documentElement.getAttribute('data-theme');
            if (BUNDLED_THEMES[current]) {
                loadBundledThemeCSS(current);
            }
        }

        patchThemeLink();

        console.log(`[${PLUGIN}] Theme manager ready — ${Object.keys(allThemes).length} themes available (${Object.keys(externalThemes).length} external)`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
