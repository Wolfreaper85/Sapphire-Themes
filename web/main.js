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
        custom: {
            name: 'Custom',
            id: 'custom',
            icon: '🎨',
            description: 'Your theme, your rules',
            css: `${BASE}/themes/custom/custom.css`,
            scripts: [`${BASE}/themes/custom/custom-canvas.js`],
            preview: {
                bg: '#0a0a14',
                accent: '#4a9eff',
                text: '#e0e0e8',
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

    // ── 5. Single fetch interceptor for themes.json + CSS redirects ─
    const _origFetch = window.fetch;
    window.fetch = async function(...args) {
        try {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

            // Redirect /static/themes/{bundled}.css to our plugin CSS path
            for (const id of Object.keys(BUNDLED_THEMES)) {
                if (url.includes('/static/themes/' + id + '.css')) {
                    const newUrl = BUNDLED_THEMES[id].css;
                    args[0] = typeof args[0] === 'string' ? newUrl : new Request(newUrl, args[0]);
                    break;
                }
            }
        } catch (_) { /* pass through */ }

        const response = await _origFetch.apply(this, args);

        try {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            // Inject bundled theme IDs into themes.json response
            if (url.includes('themes/themes.json')) {
                const clone = response.clone();
                const data = await clone.json();
                if (Array.isArray(data.themes)) {
                    let modified = false;
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
    let linkPatched = false;
    function patchThemeLink() {
        const link = document.getElementById('theme-stylesheet');
        if (!link || linkPatched) return;
        linkPatched = true;

        // Helper: check if a URL points to a bundled theme in the wrong path
        function getBundledRedirect(val) {
            if (!val) return null;
            for (const id of Object.keys(BUNDLED_THEMES)) {
                if (val.includes('/static/themes/' + id + '.css') ||
                    (val.includes('/themes/' + id + '.css') && !val.includes('/plugin-web/'))) {
                    return BUNDLED_THEMES[id].css;
                }
            }
            return null;
        }

        // Override the href PROPERTY setter (catches link.href = ...)
        const descriptor = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href');
        if (descriptor && descriptor.set) {
            const originalSet = descriptor.set;
            Object.defineProperty(link, 'href', {
                get: function() {
                    return descriptor.get.call(this);
                },
                set: function(val) {
                    const redirect = getBundledRedirect(val);
                    originalSet.call(this, redirect || val);
                },
                configurable: true,
            });
        }

        // Override setAttribute (catches link.setAttribute('href', ...))
        const origSetAttribute = link.setAttribute.bind(link);
        link.setAttribute = function(attr, val) {
            if (attr === 'href') {
                const redirect = getBundledRedirect(val);
                origSetAttribute(attr, redirect || val);
            } else {
                origSetAttribute(attr, val);
            }
        };

        // Also check current value on initial load
        const currentHref = link.getAttribute('href');
        const initRedirect = getBundledRedirect(currentHref);
        if (initRedirect) {
            origSetAttribute('href', initRedirect);
        }
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

        // Save to server — PUT /api/settings/THEME with { value: themeId }
        _origFetch('/api/settings/THEME', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify({ value: themeId })
        }).catch(function() {});
    }

    // ── Declarative settings for the Visual settings page ────
    // The appearance tab reads these via getSettings(id) and renders
    // native controls. Values are stored in localStorage and dispatched
    // via 'sapphire-theme-setting' events which we bridge below.

    const chatStyleSetting = function(prefix, helpText) {
        return { key: prefix + '-chat-style', label: 'Chat Style', help: helpText || 'How messages appear over the background', type: 'select', default: 'transparent', options: [
            { value: 'transparent', label: 'Transparent' },
            { value: 'glass', label: 'Frosted Glass' },
        ]};
    };

    const perfSetting = function(prefix) {
        return { key: prefix + '-perf-tier', label: 'Performance Tier', help: 'Lower tiers reduce GPU usage', type: 'select', default: 'auto', options: [
            { value: 'auto', label: 'Auto-detect' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
        ]};
    };

    const THEME_SETTINGS_SCHEMA = {
        matrix: [
            chatStyleSetting('matrix', 'How messages appear over the rain'),
            { key: 'matrix-rain-density', label: 'Rain Density', help: 'Number of falling columns', type: 'select', default: 'medium', options: [
                { value: 'sparse', label: 'Sparse' }, { value: 'medium', label: 'Medium' }, { value: 'dense', label: 'Dense' },
            ]},
            { key: 'matrix-rain-speed', label: 'Rain Speed', help: 'How fast characters fall', type: 'select', default: 'normal', options: [
                { value: 'slow', label: 'Slow' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Fast' },
            ]},
            perfSetting('matrix'),
        ],
        jarvis: [
            chatStyleSetting('jarvis', 'How messages appear over the HUD'),
            perfSetting('jarvis'),
        ],
        ironman: [
            chatStyleSetting('ironman', 'How messages appear over the HUD'),
            perfSetting('ironman'),
        ],
        nexus: [
            chatStyleSetting('nexus', 'How messages appear over the network'),
            perfSetting('nexus'),
        ],
        cosmos: [
            chatStyleSetting('cosmos', 'How messages appear over the solar system'),
            perfSetting('cosmos'),
        ],
        prism: [
            { key: 'prism-accent', label: 'Accent Color', help: 'UI and rain color scheme', type: 'select', default: 'rainbow', options: [
                { value: 'rainbow', label: 'Rainbow' }, { value: 'red', label: 'Red' },
                { value: 'orange', label: 'Orange' }, { value: 'gold', label: 'Gold' },
                { value: 'green', label: 'Green' }, { value: 'blue', label: 'Blue' },
                { value: 'purple', label: 'Purple' }, { value: 'pink', label: 'Pink' },
                { value: 'cyan', label: 'Cyan' },
            ]},
            chatStyleSetting('prism', 'How messages appear over the rain'),
            perfSetting('prism'),
        ],
        marauder: [
            chatStyleSetting('marauder', 'How messages appear over the map'),
            { key: 'marauder-show-names', label: 'Show Names', help: 'Display character names next to footprints', type: 'select', default: 'true', options: [
                { value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' },
            ]},
            perfSetting('marauder'),
        ],
        custom: [
            { key: 'custom-overlay', label: 'Overlay Effect', help: 'Animated overlay from any theme', type: 'select', default: 'none', options: [
                { value: 'none', label: 'None' }, { value: 'matrix', label: 'Matrix Rain' },
                { value: 'nexus', label: 'Nexus Network' }, { value: 'cosmos', label: 'Cosmos' },
                { value: 'prism', label: 'Prism Rain' }, { value: 'jarvis', label: 'JARVIS HUD' },
                { value: 'ironman', label: 'Iron Man HUD' }, { value: 'marauder', label: "Marauder's Map" },
                { value: 'lattice', label: 'Lattice Grid' },
            ]},
            chatStyleSetting('custom', 'How messages appear over your background'),
            { key: 'custom-image-dim', label: 'Image Dimming', help: 'Darken background image', type: 'range', default: '40', min: 0, max: 100, step: 5 },
            { key: 'custom-overlay-opacity', label: 'Overlay Opacity', help: 'Transparency of overlay effect', type: 'range', default: '70', min: 0, max: 100, step: 5 },
            { key: 'custom-overlay-density', label: 'Overlay Density', help: 'Amount of overlay particles/columns', type: 'select', default: 'medium', options: [
                { value: 'sparse', label: 'Sparse' }, { value: 'medium', label: 'Medium' }, { value: 'dense', label: 'Dense' },
            ]},
            { key: 'custom-overlay-speed', label: 'Overlay Speed', help: 'Animation speed of overlay effect', type: 'select', default: 'normal', options: [
                { value: 'slow', label: 'Slow' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Fast' },
            ]},
            { key: 'custom-blur-amount', label: 'Glass Blur', help: 'Blur intensity for frosted glass chat', type: 'range', default: '12', min: 2, max: 30, step: 1 },
        ],
    };

    // ── Event bridge: Visual page → theme-specific events ────
    // The Visual settings page dispatches 'sapphire-theme-setting'
    // with { key, value }. We translate that into the specific events
    // each theme script expects for live updates.
    const SETTING_EVENT_MAP = {
        'matrix-rain-density':   'matrix-density-change',
        'matrix-rain-speed':     'matrix-speed-change',
        'matrix-perf-tier':      'matrix-perf-change',
        'jarvis-perf-tier':      'jarvis-perf-change',
        'ironman-perf-tier':     'ironman-perf-change',
        'nexus-perf-tier':       'nexus-perf-change',
        'cosmos-perf-tier':      'cosmos-perf-change',
        'prism-accent':          'prism-accent-change',
        'prism-perf-tier':       'prism-perf-change',
        'marauder-show-names':   'marauder-names-change',
        'marauder-perf-tier':    'marauder-perf-change',
        'custom-overlay':        'custom-overlay-change',
        'custom-overlay-opacity':'custom-opacity-change',
        'custom-overlay-density':'custom-density-change',
        'custom-overlay-speed':  'custom-speed-change',
        'custom-blur-amount':    'custom-blur-change',
        'custom-image-dim':      'custom-dim-change',
    };

    // Chat style keys need a data-attribute set on <html>
    const CHAT_STYLE_KEYS = [
        'matrix-chat-style', 'jarvis-chat-style', 'ironman-chat-style',
        'nexus-chat-style', 'cosmos-chat-style', 'prism-chat-style',
        'marauder-chat-style', 'custom-chat-style',
    ];

    window.addEventListener('sapphire-theme-setting', function(e) {
        var key = e.detail && e.detail.key;
        var value = e.detail && e.detail.value;
        if (!key) return;

        // Bridge to theme-specific event
        var eventName = SETTING_EVENT_MAP[key];
        if (eventName) {
            window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
        }

        // Prism accent also sets data attribute
        if (key === 'prism-accent') {
            document.documentElement.setAttribute('data-prism-accent', value);
        }
    });

    // Expose for settings UI
    window.sapphireThemes = {
        getAll: function() { return allThemes; },
        getBundled: function() { return BUNDLED_THEMES; },
        getExternal: function() { return externalThemes; },
        activate: activateTheme,
        getCurrent: function() {
            return document.documentElement.getAttribute('data-theme') || 'dark';
        },
        getSettings: function(themeId) {
            return THEME_SETTINGS_SCHEMA[themeId] || [];
        },
    };

    // ── Extended Fonts — inject into Visual settings page ──────
    // Sapphire uses [data-font] → --font-body CSS vars. We inject
    // additional font options + matching CSS rules from our plugin.

    const EXTENDED_FONTS = [
        { group: 'Sans-Serif', fonts: [
            { value: 'inter', label: 'Inter', family: "'Inter', system-ui, sans-serif", google: 'Inter' },
            { value: 'roboto', label: 'Roboto', family: "'Roboto', system-ui, sans-serif", google: 'Roboto' },
            { value: 'poppins', label: 'Poppins', family: "'Poppins', system-ui, sans-serif", google: 'Poppins' },
            { value: 'open-sans', label: 'Open Sans', family: "'Open Sans', system-ui, sans-serif", google: 'Open+Sans' },
            { value: 'lato', label: 'Lato', family: "'Lato', system-ui, sans-serif", google: 'Lato' },
            { value: 'nunito', label: 'Nunito', family: "'Nunito', system-ui, sans-serif", google: 'Nunito' },
            { value: 'montserrat', label: 'Montserrat', family: "'Montserrat', system-ui, sans-serif", google: 'Montserrat' },
            { value: 'raleway', label: 'Raleway', family: "'Raleway', system-ui, sans-serif", google: 'Raleway' },
        ]},
        { group: 'Serif', fonts: [
            { value: 'playfair', label: 'Playfair Display', family: "'Playfair Display', Georgia, serif", google: 'Playfair+Display' },
            { value: 'merriweather', label: 'Merriweather', family: "'Merriweather', Georgia, serif", google: 'Merriweather' },
            { value: 'lora', label: 'Lora', family: "'Lora', Georgia, serif", google: 'Lora' },
        ]},
        { group: 'Monospace', fonts: [
            { value: 'fira-code', label: 'Fira Code', family: "'Fira Code', 'Consolas', monospace", google: 'Fira+Code' },
            { value: 'source-code', label: 'Source Code Pro', family: "'Source Code Pro', 'Consolas', monospace", google: 'Source+Code+Pro' },
            { value: 'jetbrains', label: 'JetBrains Mono', family: "'JetBrains Mono', 'Consolas', monospace", google: 'JetBrains+Mono' },
            { value: 'ubuntu-mono', label: 'Ubuntu Mono', family: "'Ubuntu Mono', 'Consolas', monospace", google: 'Ubuntu+Mono' },
            { value: 'cascadia', label: 'Cascadia Code', family: "'Cascadia Code', 'Consolas', monospace", google: 'Cascadia+Code' },
        ]},
        { group: 'Fun', fonts: [
            { value: 'comic-neue', label: 'Comic Neue', family: "'Comic Neue', 'Comic Sans MS', cursive", google: 'Comic+Neue' },
            { value: 'caveat', label: 'Caveat', family: "'Caveat', cursive", google: 'Caveat' },
            { value: 'pacifico', label: 'Pacifico', family: "'Pacifico', cursive", google: 'Pacifico' },
        ]},
    ];

    // 1. Inject CSS rules: [data-font="inter"] { --font-body: ... }
    (function injectFontCSS() {
        if (document.getElementById('themes-extended-fonts-css')) return;
        var css = '';
        EXTENDED_FONTS.forEach(function(group) {
            group.fonts.forEach(function(f) {
                css += '[data-font="' + f.value + '"] { --font-body: ' + f.family + '; --font-heading: var(--font-body); }\n';
            });
        });
        var style = document.createElement('style');
        style.id = 'themes-extended-fonts-css';
        style.textContent = css;
        document.head.appendChild(style);
    })();

    // 2. Load Google Font on demand
    var loadedGoogleFonts = {};
    function loadGoogleFont(fontValue) {
        if (loadedGoogleFonts[fontValue]) return;
        var googleName = null;
        EXTENDED_FONTS.forEach(function(group) {
            group.fonts.forEach(function(f) {
                if (f.value === fontValue) googleName = f.google;
            });
        });
        if (!googleName) return;
        var linkId = 'google-font-' + fontValue;
        if (document.getElementById(linkId)) { loadedGoogleFonts[fontValue] = true; return; }
        var link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + googleName + ':wght@300;400;500;600;700&display=swap';
        document.head.appendChild(link);
        loadedGoogleFonts[fontValue] = true;
    }

    // 3. Apply saved font on startup (if it's one of ours)
    (function applyStartupFont() {
        var saved = localStorage.getItem('sapphire-font');
        if (!saved) return;
        var isOurs = false;
        EXTENDED_FONTS.forEach(function(group) {
            group.fonts.forEach(function(f) {
                if (f.value === saved) isOurs = true;
            });
        });
        if (isOurs) loadGoogleFont(saved);
    })();

    // 4. Inject our font options into #app-font select when settings page renders
    function injectFontOptions() {
        var select = document.getElementById('app-font');
        if (!select || select.dataset.themesExtended) return;
        select.dataset.themesExtended = 'true';

        // Add a separator and our grouped options
        EXTENDED_FONTS.forEach(function(group) {
            var optgroup = document.createElement('optgroup');
            optgroup.label = group.group;
            group.fonts.forEach(function(f) {
                var opt = document.createElement('option');
                opt.value = f.value;
                opt.textContent = f.label;
                if (localStorage.getItem('sapphire-font') === f.value) opt.selected = true;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        });

        // Hook change to load Google Font when our font is selected
        select.addEventListener('change', function() {
            loadGoogleFont(select.value);
        });
    }

    // Watch for settings page rendering (the select is created dynamically)
    new MutationObserver(function() {
        injectFontOptions();
    }).observe(document.body, { childList: true, subtree: true });

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

    // ── Patch link element IMMEDIATELY (before async init) ─────
    // This must run as early as possible to intercept the app's
    // initial theme CSS load and prevent the 404
    patchThemeLink();

    // Also try again after DOM is ready in case the link element
    // didn't exist yet when the script first ran
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { patchThemeLink(); });
    }

    // ── Init ──────────────────────────────────────────────────
    async function init() {
        await detectExternalThemes();
        buildRegistry();

        // Ensure link is patched (covers edge case where element was created late)
        patchThemeLink();

        // Apply random theme on startup if enabled
        if (!applyRandomThemeIfEnabled()) {
            // Otherwise load current theme's assets
            const current = document.documentElement.getAttribute('data-theme');
            if (BUNDLED_THEMES[current]) {
                loadBundledThemeCSS(current);
            }
        }

        console.log(`[${PLUGIN}] Theme manager ready — ${Object.keys(allThemes).length} themes available (${Object.keys(externalThemes).length} external)`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
