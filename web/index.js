// plugins/sapphire-themes/web/index.js — Theme Picker Settings UI

import { registerPluginSettings } from '/static/shared/plugin-registry.js';

const PLUGIN_NAME = 'sapphire-themes';

registerPluginSettings({
    id: PLUGIN_NAME,
    name: 'Themes',
    icon: '🎨',
    helpText: 'Browse and activate themes. Includes bundled themes and auto-detected external theme plugins.',

    render(container) {
        const api = window.sapphireThemes;
        if (!api) {
            container.innerHTML = '<p style="color:var(--text-muted)">Theme manager loading...</p>';
            setTimeout(() => this.render(container), 500);
            return;
        }

        const themes = api.getAll();
        const current = api.getCurrent();

        // Random theme settings
        const randomEnabled = localStorage.getItem('sapphire-random-enabled') === 'true';
        let randomPool;
        try {
            randomPool = JSON.parse(localStorage.getItem('sapphire-random-pool') || '[]');
        } catch (_) {
            randomPool = [];
        }

        // If random is enabled but pool is empty, populate with all theme IDs
        if (randomEnabled && randomPool.length === 0) {
            randomPool = Object.keys(themes);
            localStorage.setItem('sapphire-random-pool', JSON.stringify(randomPool));
        }

        // Group themes
        const builtinThemes = [];
        const bundledThemes = [];
        const externalThemes = [];

        Object.values(themes).forEach(t => {
            if (t.builtin) builtinThemes.push(t);
            else if (t.external) externalThemes.push(t);
            else bundledThemes.push(t);
        });

        container.innerHTML = `
            <div style="margin-bottom: 16px">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px">
                    <span style="font-size:1.5em">🎨</span>
                    <div style="flex:1">
                        <strong>Theme Manager</strong>
                        <div class="text-muted" style="font-size:0.85em">
                            ${Object.keys(themes).length} themes available
                            ${externalThemes.length ? ` (${externalThemes.length} from other plugins)` : ''}
                        </div>
                    </div>
                </div>

                <!-- Random Theme on Startup -->
                <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:8px;">
                    <span style="font-size:1.2em">🎲</span>
                    <div style="flex:1">
                        <div style="font-size:0.85em; font-weight:600; color:var(--text);">Random Theme on Startup</div>
                        <div style="font-size:0.7em; color:var(--text-muted);">Load a random theme each time${randomEnabled ? ' — click 🔀 on theme cards to include/exclude' : ''}</div>
                    </div>
                    <label style="position:relative; display:inline-block; width:40px; height:22px; cursor:pointer;">
                        <input type="checkbox" id="random-toggle" ${randomEnabled ? 'checked' : ''} style="opacity:0; width:0; height:0;">
                        <span style="
                            position:absolute; top:0; left:0; right:0; bottom:0;
                            background:${randomEnabled ? 'var(--trim, #4a9eff)' : 'var(--border)'};
                            border-radius:11px; transition:background 0.2s;
                        "></span>
                        <span style="
                            position:absolute; top:2px; left:${randomEnabled ? '20px' : '2px'};
                            width:18px; height:18px; background:#fff; border-radius:50%;
                            transition:left 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.3);
                        "></span>
                    </label>
                </div>
            </div>

            ${_renderSection('Default', builtinThemes, current, randomEnabled, randomPool)}
            ${_renderSection('Bundled', bundledThemes, current, randomEnabled, randomPool)}
            ${externalThemes.length ? _renderSection('External Plugins', externalThemes, current, randomEnabled, randomPool) : ''}

            <!-- Per-theme settings (only for active bundled themes) -->
            <div id="theme-settings-panel"></div>
        `;

        // Bind random toggle
        container.querySelector('#random-toggle')?.addEventListener('change', (e) => {
            localStorage.setItem('sapphire-random-enabled', e.target.checked ? 'true' : 'false');
            // Re-render to show/hide shuffle icons
            setTimeout(() => this.render(container), 100);
        });

        // Bind shuffle toggle clicks on each card
        container.querySelectorAll('.random-pool-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't trigger theme activation
                const id = btn.dataset.themeId;
                let pool;
                try {
                    pool = JSON.parse(localStorage.getItem('sapphire-random-pool') || '[]');
                } catch (_) {
                    pool = [];
                }
                const idx = pool.indexOf(id);
                if (idx >= 0) {
                    pool.splice(idx, 1);
                } else {
                    pool.push(id);
                }
                localStorage.setItem('sapphire-random-pool', JSON.stringify(pool));
                setTimeout(() => this.render(container), 100);
            });
        });

        // Bind click events on theme cards
        container.querySelectorAll('.theme-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.themeId;
                if (id === current) return;
                api.activate(id);
                // Re-render to update active states
                setTimeout(() => this.render(container), 300);
            });
        });

        // Render per-theme settings if a bundled theme is active
        const settingsPanel = container.querySelector('#theme-settings-panel');
        if (settingsPanel && THEME_SETTINGS[current]) {
            THEME_SETTINGS[current](settingsPanel);
        } else if (settingsPanel && externalThemes.find(t => t.id === current)) {
            settingsPanel.innerHTML = `
                <div style="padding:12px 0; border-top:1px solid var(--border); margin-top:8px;">
                    <div style="font-size:0.8em; color:var(--text-muted);">
                        Settings for this theme are managed by its own plugin.
                        Check the <strong>${externalThemes.find(t => t.id === current)?.name}</strong> settings tab.
                    </div>
                </div>
            `;
        }
    },

    load: async () => ({}),
    save: async () => ({ success: true }),
    getSettings: () => ({}),
});


function _renderSection(title, themes, current, randomEnabled, randomPool) {
    if (!themes.length) return '';
    return `
        <div style="margin-bottom: 20px">
            <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:8px; padding-top:8px; border-top:1px solid var(--border)">
                ${title}
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:10px;">
                ${themes.map(t => _renderCard(t, current, randomEnabled, randomPool)).join('')}
            </div>
        </div>
    `;
}

// ── Per-Theme Settings ────────────────────────────────────────
// Each bundled theme can register a settings renderer here.
// External themes handle their own settings via their plugin.

const THEME_SETTINGS = {
    matrix: (panel) => {
        const currentDensity = localStorage.getItem('matrix-rain-density') || 'medium';
        const currentSpeed = localStorage.getItem('matrix-rain-speed') || 'normal';
        const currentPerf = localStorage.getItem('matrix-perf-tier') || 'auto';
        const currentChatStyle = localStorage.getItem('matrix-chat-style') || 'transparent';

        panel.innerHTML = `
            <div style="padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
                <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">
                    Matrix Settings
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div class="setting-label">
                        <label for="mx-chat-style">Chat Style</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How messages appear over the rain</div>
                    </div>
                    <div class="setting-input">
                        <select id="mx-chat-style" class="setting-select" style="min-width:100px;">
                            <option value="transparent" ${currentChatStyle === 'transparent' ? 'selected' : ''}>Transparent</option>
                            <option value="glass" ${currentChatStyle === 'glass' ? 'selected' : ''}>Frosted Glass</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="mx-density">Rain Density</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Number of falling columns</div>
                    </div>
                    <div class="setting-input">
                        <select id="mx-density" class="setting-select" style="min-width:100px;">
                            <option value="sparse" ${currentDensity === 'sparse' ? 'selected' : ''}>Sparse</option>
                            <option value="medium" ${currentDensity === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="dense" ${currentDensity === 'dense' ? 'selected' : ''}>Dense</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="mx-speed">Rain Speed</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How fast characters fall</div>
                    </div>
                    <div class="setting-input">
                        <select id="mx-speed" class="setting-select" style="min-width:100px;">
                            <option value="slow" ${currentSpeed === 'slow' ? 'selected' : ''}>Slow</option>
                            <option value="normal" ${currentSpeed === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="fast" ${currentSpeed === 'fast' ? 'selected' : ''}>Fast</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="mx-perf">Performance Tier</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Lower tiers reduce GPU usage</div>
                    </div>
                    <div class="setting-input">
                        <select id="mx-perf" class="setting-select" style="min-width:100px;">
                            <option value="auto" ${currentPerf === 'auto' ? 'selected' : ''}>Auto-detect</option>
                            <option value="low" ${currentPerf === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${currentPerf === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${currentPerf === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        // Bind events
        panel.querySelector('#mx-chat-style')?.addEventListener('change', (e) => {
            localStorage.setItem('matrix-chat-style', e.target.value);
            window.dispatchEvent(new CustomEvent('matrix-chatstyle-change', { detail: e.target.value }));
            _applyChatStyle(e.target.value);
        });

        panel.querySelector('#mx-density')?.addEventListener('change', (e) => {
            localStorage.setItem('matrix-rain-density', e.target.value);
            window.dispatchEvent(new CustomEvent('matrix-density-change', { detail: e.target.value }));
        });

        panel.querySelector('#mx-speed')?.addEventListener('change', (e) => {
            localStorage.setItem('matrix-rain-speed', e.target.value);
            window.dispatchEvent(new CustomEvent('matrix-speed-change', { detail: e.target.value }));
        });

        panel.querySelector('#mx-perf')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'auto') {
                localStorage.removeItem('matrix-perf-tier');
            } else {
                localStorage.setItem('matrix-perf-tier', val);
            }
            window.dispatchEvent(new CustomEvent('matrix-perf-change', { detail: val }));
        });

        // Apply current chat style on render
        _applyChatStyle(currentChatStyle);
    },

    jarvis: (panel) => {
        const currentPerf = localStorage.getItem('jarvis-perf-tier') || 'auto';
        const currentChatStyle = localStorage.getItem('jarvis-chat-style') || 'transparent';

        panel.innerHTML = `
            <div style="padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
                <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">
                    JARVIS Settings
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div class="setting-label">
                        <label for="jv-chat-style">Chat Style</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How messages appear over the HUD</div>
                    </div>
                    <div class="setting-input">
                        <select id="jv-chat-style" class="setting-select" style="min-width:100px;">
                            <option value="transparent" ${currentChatStyle === 'transparent' ? 'selected' : ''}>Transparent</option>
                            <option value="glass" ${currentChatStyle === 'glass' ? 'selected' : ''}>Frosted Glass</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="jv-perf">Performance Tier</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Lower tiers reduce GPU usage</div>
                    </div>
                    <div class="setting-input">
                        <select id="jv-perf" class="setting-select" style="min-width:100px;">
                            <option value="auto" ${currentPerf === 'auto' ? 'selected' : ''}>Auto-detect</option>
                            <option value="low" ${currentPerf === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${currentPerf === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${currentPerf === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        panel.querySelector('#jv-chat-style')?.addEventListener('change', (e) => {
            localStorage.setItem('jarvis-chat-style', e.target.value);
            _applyJarvisChatStyle(e.target.value);
        });

        panel.querySelector('#jv-perf')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'auto') {
                localStorage.removeItem('jarvis-perf-tier');
            } else {
                localStorage.setItem('jarvis-perf-tier', val);
            }
            window.dispatchEvent(new CustomEvent('jarvis-perf-change', { detail: val }));
        });

        _applyJarvisChatStyle(currentChatStyle);
    },

    ironman: (panel) => {
        const currentPerf = localStorage.getItem('ironman-perf-tier') || 'auto';
        const currentChatStyle = localStorage.getItem('ironman-chat-style') || 'transparent';

        panel.innerHTML = `
            <div style="padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
                <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">
                    Iron Man Settings
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div class="setting-label">
                        <label for="im-chat-style">Chat Style</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How messages appear over the HUD</div>
                    </div>
                    <div class="setting-input">
                        <select id="im-chat-style" class="setting-select" style="min-width:100px;">
                            <option value="transparent" ${currentChatStyle === 'transparent' ? 'selected' : ''}>Transparent</option>
                            <option value="glass" ${currentChatStyle === 'glass' ? 'selected' : ''}>Frosted Glass</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="im-perf">Performance Tier</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Lower tiers reduce GPU usage</div>
                    </div>
                    <div class="setting-input">
                        <select id="im-perf" class="setting-select" style="min-width:100px;">
                            <option value="auto" ${currentPerf === 'auto' ? 'selected' : ''}>Auto-detect</option>
                            <option value="low" ${currentPerf === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${currentPerf === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${currentPerf === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        panel.querySelector('#im-chat-style')?.addEventListener('change', (e) => {
            localStorage.setItem('ironman-chat-style', e.target.value);
            _applyIronmanChatStyle(e.target.value);
        });

        panel.querySelector('#im-perf')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'auto') {
                localStorage.removeItem('ironman-perf-tier');
            } else {
                localStorage.setItem('ironman-perf-tier', val);
            }
            window.dispatchEvent(new CustomEvent('ironman-perf-change', { detail: val }));
        });

        _applyIronmanChatStyle(currentChatStyle);
    },

    nexus: (panel) => {
        const currentPerf = localStorage.getItem('nexus-perf-tier') || 'auto';
        const currentChatStyle = localStorage.getItem('nexus-chat-style') || 'transparent';

        panel.innerHTML = `
            <div style="padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
                <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">
                    Nexus Settings
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div class="setting-label">
                        <label for="nx-chat-style">Chat Style</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How messages appear over the network</div>
                    </div>
                    <div class="setting-input">
                        <select id="nx-chat-style" class="setting-select" style="min-width:100px;">
                            <option value="transparent" ${currentChatStyle === 'transparent' ? 'selected' : ''}>Transparent</option>
                            <option value="glass" ${currentChatStyle === 'glass' ? 'selected' : ''}>Frosted Glass</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="nx-perf">Performance Tier</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Lower tiers reduce GPU usage</div>
                    </div>
                    <div class="setting-input">
                        <select id="nx-perf" class="setting-select" style="min-width:100px;">
                            <option value="auto" ${currentPerf === 'auto' ? 'selected' : ''}>Auto-detect</option>
                            <option value="low" ${currentPerf === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${currentPerf === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${currentPerf === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        panel.querySelector('#nx-chat-style')?.addEventListener('change', (e) => {
            localStorage.setItem('nexus-chat-style', e.target.value);
            _applyNexusChatStyle(e.target.value);
        });

        panel.querySelector('#nx-perf')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'auto') {
                localStorage.removeItem('nexus-perf-tier');
            } else {
                localStorage.setItem('nexus-perf-tier', val);
            }
            window.dispatchEvent(new CustomEvent('nexus-perf-change', { detail: val }));
        });

        _applyNexusChatStyle(currentChatStyle);
    },

    cosmos: (panel) => {
        const currentPerf = localStorage.getItem('cosmos-perf-tier') || 'auto';
        const currentChatStyle = localStorage.getItem('cosmos-chat-style') || 'transparent';

        panel.innerHTML = `
            <div style="padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
                <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">
                    Cosmos Settings
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div class="setting-label">
                        <label for="cs-chat-style">Chat Style</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How messages appear over the solar system</div>
                    </div>
                    <div class="setting-input">
                        <select id="cs-chat-style" class="setting-select" style="min-width:100px;">
                            <option value="transparent" ${currentChatStyle === 'transparent' ? 'selected' : ''}>Transparent</option>
                            <option value="glass" ${currentChatStyle === 'glass' ? 'selected' : ''}>Frosted Glass</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="cs-perf">Performance Tier</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Lower tiers reduce GPU usage</div>
                    </div>
                    <div class="setting-input">
                        <select id="cs-perf" class="setting-select" style="min-width:100px;">
                            <option value="auto" ${currentPerf === 'auto' ? 'selected' : ''}>Auto-detect</option>
                            <option value="low" ${currentPerf === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${currentPerf === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${currentPerf === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        panel.querySelector('#cs-chat-style')?.addEventListener('change', (e) => {
            localStorage.setItem('cosmos-chat-style', e.target.value);
            _applyCosmosChatStyle(e.target.value);
        });

        panel.querySelector('#cs-perf')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'auto') {
                localStorage.removeItem('cosmos-perf-tier');
            } else {
                localStorage.setItem('cosmos-perf-tier', val);
            }
            window.dispatchEvent(new CustomEvent('cosmos-perf-change', { detail: val }));
        });

        _applyCosmosChatStyle(currentChatStyle);
    },

    prism: (panel) => {
        const currentPerf = localStorage.getItem('prism-perf-tier') || 'auto';
        const currentChatStyle = localStorage.getItem('prism-chat-style') || 'transparent';
        const currentAccent = localStorage.getItem('prism-accent') || 'rainbow';

        const accentOptions = [
            { value: 'rainbow', label: '🌈 Rainbow' },
            { value: 'red', label: '🔴 Red' },
            { value: 'orange', label: '🟠 Orange' },
            { value: 'gold', label: '🟡 Gold' },
            { value: 'green', label: '🟢 Green' },
            { value: 'blue', label: '🔵 Blue' },
            { value: 'purple', label: '🟣 Purple' },
            { value: 'pink', label: '🩷 Pink' },
            { value: 'cyan', label: '🩵 Cyan' },
        ];

        panel.innerHTML = `
            <div style="padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
                <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">
                    Prism Settings
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div class="setting-label">
                        <label for="pr-accent">Accent Color</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">UI and rain color scheme</div>
                    </div>
                    <div class="setting-input">
                        <select id="pr-accent" class="setting-select" style="min-width:120px;">
                            ${accentOptions.map(o => `<option value="${o.value}" ${currentAccent === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="pr-chat-style">Chat Style</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How messages appear over the rain</div>
                    </div>
                    <div class="setting-input">
                        <select id="pr-chat-style" class="setting-select" style="min-width:100px;">
                            <option value="transparent" ${currentChatStyle === 'transparent' ? 'selected' : ''}>Transparent</option>
                            <option value="glass" ${currentChatStyle === 'glass' ? 'selected' : ''}>Frosted Glass</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="pr-perf">Performance Tier</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Lower tiers reduce GPU usage</div>
                    </div>
                    <div class="setting-input">
                        <select id="pr-perf" class="setting-select" style="min-width:100px;">
                            <option value="auto" ${currentPerf === 'auto' ? 'selected' : ''}>Auto-detect</option>
                            <option value="low" ${currentPerf === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${currentPerf === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${currentPerf === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        panel.querySelector('#pr-accent')?.addEventListener('change', (e) => {
            localStorage.setItem('prism-accent', e.target.value);
            document.documentElement.setAttribute('data-prism-accent', e.target.value);
            window.dispatchEvent(new CustomEvent('prism-accent-change', { detail: e.target.value }));
        });

        panel.querySelector('#pr-chat-style')?.addEventListener('change', (e) => {
            localStorage.setItem('prism-chat-style', e.target.value);
            _applyPrismChatStyle(e.target.value);
        });

        panel.querySelector('#pr-perf')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'auto') {
                localStorage.removeItem('prism-perf-tier');
            } else {
                localStorage.setItem('prism-perf-tier', val);
            }
            window.dispatchEvent(new CustomEvent('prism-perf-change', { detail: val }));
        });

        // Apply current accent and chat style
        document.documentElement.setAttribute('data-prism-accent', currentAccent);
        _applyPrismChatStyle(currentChatStyle);
    },

    marauder: (panel) => {
        const currentPerf = localStorage.getItem('marauder-perf-tier') || 'auto';
        const currentChatStyle = localStorage.getItem('marauder-chat-style') || 'transparent';
        const currentShowNames = localStorage.getItem('marauder-show-names') !== 'false';

        panel.innerHTML = `
            <div style="padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
                <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px; font-family: Georgia, 'Palatino Linotype', serif;">
                    Marauder's Map Settings
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div class="setting-label">
                        <label for="mm-chat-style">Chat Style</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How messages appear over the map</div>
                    </div>
                    <div class="setting-input">
                        <select id="mm-chat-style" class="setting-select" style="min-width:100px;">
                            <option value="transparent" ${currentChatStyle === 'transparent' ? 'selected' : ''}>Transparent</option>
                            <option value="glass" ${currentChatStyle === 'glass' ? 'selected' : ''}>Frosted Parchment</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="mm-names">Show Names</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Display character names next to footprints</div>
                    </div>
                    <div class="setting-input">
                        <select id="mm-names" class="setting-select" style="min-width:100px;">
                            <option value="true" ${currentShowNames ? 'selected' : ''}>Show</option>
                            <option value="false" ${!currentShowNames ? 'selected' : ''}>Hide</option>
                        </select>
                    </div>
                </div>

                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="mm-perf">Performance Tier</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Lower tiers reduce GPU usage</div>
                    </div>
                    <div class="setting-input">
                        <select id="mm-perf" class="setting-select" style="min-width:100px;">
                            <option value="auto" ${currentPerf === 'auto' ? 'selected' : ''}>Auto-detect</option>
                            <option value="low" ${currentPerf === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${currentPerf === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${currentPerf === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        panel.querySelector('#mm-names')?.addEventListener('change', (e) => {
            localStorage.setItem('marauder-show-names', e.target.value);
            window.dispatchEvent(new CustomEvent('marauder-names-change', { detail: e.target.value }));
        });

        panel.querySelector('#mm-chat-style')?.addEventListener('change', (e) => {
            localStorage.setItem('marauder-chat-style', e.target.value);
            _applyMarauderChatStyle(e.target.value);
        });

        panel.querySelector('#mm-perf')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'auto') {
                localStorage.removeItem('marauder-perf-tier');
            } else {
                localStorage.setItem('marauder-perf-tier', val);
            }
            window.dispatchEvent(new CustomEvent('marauder-perf-change', { detail: val }));
        });

        _applyMarauderChatStyle(currentChatStyle);
    },

    custom: (panel) => {
        const currentAccent = localStorage.getItem('custom-accent-color') || '#4a9eff';
        const currentFont = localStorage.getItem('custom-font') || 'system';
        const currentOverlay = localStorage.getItem('custom-overlay') || 'none';
        const currentChatStyle = localStorage.getItem('custom-chat-style') || 'transparent';
        const currentDim = localStorage.getItem('custom-image-dim') || '40';
        const currentOpacity = localStorage.getItem('custom-overlay-opacity') || '70';
        const currentBlur = localStorage.getItem('custom-blur-amount') || '12';
        const hasImage = !!localStorage.getItem('custom-bg-image');

        const fontOptions = [
            { group: 'Sans-Serif', fonts: [
                { value: 'system', label: 'System Default' },
                { value: 'inter', label: 'Inter' },
                { value: 'roboto', label: 'Roboto' },
                { value: 'poppins', label: 'Poppins' },
                { value: 'open-sans', label: 'Open Sans' },
                { value: 'lato', label: 'Lato' },
                { value: 'nunito', label: 'Nunito' },
                { value: 'montserrat', label: 'Montserrat' },
                { value: 'raleway', label: 'Raleway' },
            ]},
            { group: 'Serif', fonts: [
                { value: 'playfair', label: 'Playfair Display' },
                { value: 'merriweather', label: 'Merriweather' },
                { value: 'georgia', label: 'Georgia' },
                { value: 'lora', label: 'Lora' },
            ]},
            { group: 'Monospace', fonts: [
                { value: 'monospace', label: 'Consolas' },
                { value: 'fira-code', label: 'Fira Code' },
                { value: 'source-code', label: 'Source Code Pro' },
                { value: 'jetbrains', label: 'JetBrains Mono' },
                { value: 'ubuntu-mono', label: 'Ubuntu Mono' },
                { value: 'cascadia', label: 'Cascadia Code' },
            ]},
            { group: 'Fun', fonts: [
                { value: 'comic-neue', label: 'Comic Neue' },
                { value: 'caveat', label: 'Caveat' },
                { value: 'pacifico', label: 'Pacifico' },
            ]},
        ];

        const overlayOptions = [
            { value: 'none', label: 'None' },
            { value: 'matrix', label: 'Matrix Rain' },
            { value: 'nexus', label: 'Nexus Network' },
            { value: 'cosmos', label: 'Cosmos Solar' },
            { value: 'prism', label: 'Prism Rain' },
            { value: 'jarvis', label: 'JARVIS HUD' },
            { value: 'ironman', label: 'Iron Man HUD' },
            { value: 'marauder', label: "Marauder's Map" },
        ];

        panel.innerHTML = `
            <div style="padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
                <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">
                    Custom Theme Settings
                </div>

                <!-- Background Image -->
                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div class="setting-label">
                        <label>Background Image</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">${hasImage ? 'Image loaded — click to change' : 'Select an image from your computer'}</div>
                    </div>
                    <div class="setting-input" style="display:flex; gap:6px; align-items:center;">
                        <input type="file" id="ct-bg-file" accept="image/*" style="display:none;">
                        <button id="ct-bg-btn" class="btn" style="font-size:0.8em; padding:4px 12px; cursor:pointer;">
                            ${hasImage ? 'Change' : 'Choose'}
                        </button>
                        ${hasImage ? '<button id="ct-bg-clear" class="btn" style="font-size:0.8em; padding:4px 8px; cursor:pointer; color:var(--error);" title="Remove image">✕</button>' : ''}
                    </div>
                </div>

                <!-- Image Dimming -->
                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="ct-dim">Image Dimming</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Darken the background image</div>
                    </div>
                    <div class="setting-input" style="display:flex; align-items:center; gap:8px;">
                        <input type="range" id="ct-dim" min="0" max="90" value="${currentDim}" style="width:80px; accent-color:var(--custom-accent, #4a9eff);">
                        <span id="ct-dim-val" style="font-size:0.75em; min-width:28px; text-align:right;">${currentDim}%</span>
                    </div>
                </div>

                <!-- Accent Color -->
                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="ct-accent">Accent Color</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">UI color scheme and glow effects</div>
                    </div>
                    <div class="setting-input">
                        <input type="color" id="ct-accent" value="${currentAccent}" style="
                            width:36px; height:28px; border:2px solid var(--border);
                            border-radius:4px; cursor:pointer; background:transparent;
                            padding:0;
                        ">
                    </div>
                </div>

                <!-- Font -->
                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="ct-font">Font</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">UI typeface (code blocks stay monospace)</div>
                    </div>
                    <div class="setting-input">
                        <select id="ct-font" class="setting-select" style="min-width:130px;">
                            ${fontOptions.map(group => `
                                <optgroup label="${group.group}">
                                    ${group.fonts.map(f => `<option value="${f.value}" ${currentFont === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
                                </optgroup>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <!-- Overlay Effect -->
                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="ct-overlay">Overlay Effect</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Animated effect over the background</div>
                    </div>
                    <div class="setting-input">
                        <select id="ct-overlay" class="setting-select" style="min-width:130px;">
                            ${overlayOptions.map(o => `<option value="${o.value}" ${currentOverlay === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- Overlay Opacity -->
                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="ct-opacity">Overlay Opacity</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How visible the overlay effect is</div>
                    </div>
                    <div class="setting-input" style="display:flex; align-items:center; gap:8px;">
                        <input type="range" id="ct-opacity" min="10" max="100" value="${currentOpacity}" style="width:80px; accent-color:var(--custom-accent, #4a9eff);">
                        <span id="ct-opacity-val" style="font-size:0.75em; min-width:28px; text-align:right;">${currentOpacity}%</span>
                    </div>
                </div>

                <!-- Chat Style -->
                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="ct-chat-style">Chat Style</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">How messages appear over the background</div>
                    </div>
                    <div class="setting-input">
                        <select id="ct-chat-style" class="setting-select" style="min-width:130px;">
                            <option value="transparent" ${currentChatStyle === 'transparent' ? 'selected' : ''}>Transparent</option>
                            <option value="glass" ${currentChatStyle === 'glass' ? 'selected' : ''}>Frosted Glass</option>
                        </select>
                    </div>
                </div>

                <!-- Glass Blur Amount -->
                <div class="setting-row" style="padding:8px 0; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
                    <div class="setting-label">
                        <label for="ct-blur">Glass Blur</label>
                        <div class="setting-help" style="font-size:0.75em; color:var(--text-muted);">Blur amount for frosted glass mode</div>
                    </div>
                    <div class="setting-input" style="display:flex; align-items:center; gap:8px;">
                        <input type="range" id="ct-blur" min="0" max="30" value="${currentBlur}" style="width:80px; accent-color:var(--custom-accent, #4a9eff);">
                        <span id="ct-blur-val" style="font-size:0.75em; min-width:28px; text-align:right;">${currentBlur}px</span>
                    </div>
                </div>

                <!-- Reset to Defaults -->
                <div style="padding:12px 0; border-top:1px solid var(--border); margin-top:4px; text-align:center;">
                    <button id="ct-reset" class="btn" style="font-size:0.8em; padding:6px 20px; cursor:pointer; color:var(--error); border-color:var(--error-border);">
                        Reset to Defaults
                    </button>
                </div>
            </div>
        `;

        // ── Bind events ─────────────────────────────────────

        // Background image file picker
        const fileInput = panel.querySelector('#ct-bg-file');
        panel.querySelector('#ct-bg-btn')?.addEventListener('click', () => fileInput.click());

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Resize large images to avoid localStorage limits
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const maxDim = 1920;
                    let w = img.width, h = img.height;
                    if (w > maxDim || h > maxDim) {
                        const scale = maxDim / Math.max(w, h);
                        w = Math.round(w * scale);
                        h = Math.round(h * scale);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const c = canvas.getContext('2d');
                    c.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    try {
                        localStorage.setItem('custom-bg-image', dataUrl);
                        window.dispatchEvent(new CustomEvent('custom-image-change'));
                        // Update help text
                        const help = panel.querySelector('.setting-label .setting-help');
                        if (help) help.textContent = 'Image loaded — click to change';
                    } catch (err) {
                        alert('Image too large for storage. Try a smaller image.');
                    }
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Clear image
        panel.querySelector('#ct-bg-clear')?.addEventListener('click', () => {
            localStorage.removeItem('custom-bg-image');
            window.dispatchEvent(new CustomEvent('custom-image-change'));
            // Re-render settings panel
            const settingsPanel = panel.closest('#theme-settings-panel') || panel;
            THEME_SETTINGS.custom(settingsPanel);
        });

        // Dimming slider
        panel.querySelector('#ct-dim')?.addEventListener('input', (e) => {
            localStorage.setItem('custom-image-dim', e.target.value);
            panel.querySelector('#ct-dim-val').textContent = e.target.value + '%';
        });

        // Accent color
        panel.querySelector('#ct-accent')?.addEventListener('input', (e) => {
            localStorage.setItem('custom-accent-color', e.target.value);
            window.dispatchEvent(new CustomEvent('custom-accent-change', { detail: e.target.value }));
        });

        // Font
        panel.querySelector('#ct-font')?.addEventListener('change', (e) => {
            localStorage.setItem('custom-font', e.target.value);
            window.dispatchEvent(new CustomEvent('custom-font-change', { detail: e.target.value }));
        });

        // Overlay
        panel.querySelector('#ct-overlay')?.addEventListener('change', (e) => {
            localStorage.setItem('custom-overlay', e.target.value);
            window.dispatchEvent(new CustomEvent('custom-overlay-change', { detail: e.target.value }));
        });

        // Overlay opacity
        panel.querySelector('#ct-opacity')?.addEventListener('input', (e) => {
            localStorage.setItem('custom-overlay-opacity', e.target.value);
            panel.querySelector('#ct-opacity-val').textContent = e.target.value + '%';
            window.dispatchEvent(new CustomEvent('custom-opacity-change', { detail: e.target.value }));
        });

        // Chat style
        panel.querySelector('#ct-chat-style')?.addEventListener('change', (e) => {
            localStorage.setItem('custom-chat-style', e.target.value);
            _applyCustomChatStyle(e.target.value);
        });

        // Blur slider
        panel.querySelector('#ct-blur')?.addEventListener('input', (e) => {
            localStorage.setItem('custom-blur-amount', e.target.value);
            panel.querySelector('#ct-blur-val').textContent = e.target.value + 'px';
            window.dispatchEvent(new CustomEvent('custom-blur-change', { detail: e.target.value }));
        });

        // Reset to defaults
        panel.querySelector('#ct-reset')?.addEventListener('click', () => {
            if (!confirm('Reset all Custom theme settings to defaults?')) return;

            // Clear all custom settings from localStorage
            const keys = [
                'custom-bg-image', 'custom-accent-color', 'custom-font',
                'custom-overlay', 'custom-image-dim', 'custom-overlay-opacity',
                'custom-chat-style', 'custom-blur-amount',
            ];
            keys.forEach(k => localStorage.removeItem(k));

            // Dispatch reset events so canvas picks up changes
            window.dispatchEvent(new CustomEvent('custom-accent-change', { detail: '#4a9eff' }));
            window.dispatchEvent(new CustomEvent('custom-font-change', { detail: 'system' }));
            window.dispatchEvent(new CustomEvent('custom-image-change'));
            window.dispatchEvent(new CustomEvent('custom-overlay-change', { detail: 'none' }));
            window.dispatchEvent(new CustomEvent('custom-blur-change', { detail: '12' }));
            _applyCustomChatStyle('transparent');

            // Re-render settings panel
            const settingsPanel = panel.closest('#theme-settings-panel') || panel;
            THEME_SETTINGS.custom(settingsPanel);
        });

        // Apply current chat style
        _applyCustomChatStyle(currentChatStyle);
    },

    // Add settings for future themes here:
};


function _applyChatStyle(style) {
    document.documentElement.setAttribute('data-matrix-chat', style);
}

function _applyJarvisChatStyle(style) {
    document.documentElement.setAttribute('data-jarvis-chat', style);
}

function _applyIronmanChatStyle(style) {
    document.documentElement.setAttribute('data-ironman-chat', style);
}

function _applyNexusChatStyle(style) {
    document.documentElement.setAttribute('data-nexus-chat', style);
}

function _applyCosmosChatStyle(style) {
    document.documentElement.setAttribute('data-cosmos-chat', style);
}

function _applyPrismChatStyle(style) {
    document.documentElement.setAttribute('data-prism-chat', style);
}

function _applyMarauderChatStyle(style) {
    document.documentElement.setAttribute('data-marauder-chat', style);
}

function _applyCustomChatStyle(style) {
    document.documentElement.setAttribute('data-custom-chat', style);
}

// Apply saved chat styles on load and theme change
(function() {
    function applyForTheme(theme) {
        // Clear all chat style attributes
        document.documentElement.removeAttribute('data-matrix-chat');
        document.documentElement.removeAttribute('data-jarvis-chat');
        document.documentElement.removeAttribute('data-ironman-chat');
        document.documentElement.removeAttribute('data-nexus-chat');
        document.documentElement.removeAttribute('data-cosmos-chat');
        document.documentElement.removeAttribute('data-prism-chat');
        document.documentElement.removeAttribute('data-prism-accent');
        document.documentElement.removeAttribute('data-marauder-chat');
        document.documentElement.removeAttribute('data-custom-chat');
        document.documentElement.removeAttribute('data-custom-overlay');

        if (theme === 'matrix') {
            const style = localStorage.getItem('matrix-chat-style') || 'transparent';
            document.documentElement.setAttribute('data-matrix-chat', style);
        } else if (theme === 'jarvis') {
            const style = localStorage.getItem('jarvis-chat-style') || 'transparent';
            document.documentElement.setAttribute('data-jarvis-chat', style);
        } else if (theme === 'ironman') {
            const style = localStorage.getItem('ironman-chat-style') || 'transparent';
            document.documentElement.setAttribute('data-ironman-chat', style);
        } else if (theme === 'nexus') {
            const style = localStorage.getItem('nexus-chat-style') || 'transparent';
            document.documentElement.setAttribute('data-nexus-chat', style);
        } else if (theme === 'cosmos') {
            const style = localStorage.getItem('cosmos-chat-style') || 'transparent';
            document.documentElement.setAttribute('data-cosmos-chat', style);
        } else if (theme === 'prism') {
            const style = localStorage.getItem('prism-chat-style') || 'transparent';
            document.documentElement.setAttribute('data-prism-chat', style);
            const accent = localStorage.getItem('prism-accent') || 'rainbow';
            document.documentElement.setAttribute('data-prism-accent', accent);
        } else if (theme === 'marauder') {
            const style = localStorage.getItem('marauder-chat-style') || 'transparent';
            document.documentElement.setAttribute('data-marauder-chat', style);
        } else if (theme === 'custom') {
            const style = localStorage.getItem('custom-chat-style') || 'transparent';
            document.documentElement.setAttribute('data-custom-chat', style);
        }
    }

    applyForTheme(document.documentElement.getAttribute('data-theme'));

    new MutationObserver(function() {
        applyForTheme(document.documentElement.getAttribute('data-theme'));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();


function _renderCard(theme, current, randomEnabled, randomPool) {
    const isActive = theme.id === current;
    const p = theme.preview || { bg: '#1a1a2e', accent: '#4a9eff', text: '#ccc' };
    const inPool = !randomPool || randomPool.length === 0 || randomPool.includes(theme.id);
    const showShuffle = randomEnabled;

    return `
        <div class="theme-card" data-theme-id="${theme.id}"
             style="
                cursor: ${isActive ? 'default' : 'pointer'};
                border: 2px solid ${isActive ? p.accent : 'var(--border)'};
                background: var(--bg-secondary);
                padding: 0;
                overflow: hidden;
                transition: border-color 0.2s, box-shadow 0.2s;
                ${isActive ? 'box-shadow: 0 0 12px ' + p.accent + '40;' : ''}
             "
             onmouseover="if(!${isActive})this.style.borderColor='${p.accent}80'"
             onmouseout="if(!${isActive})this.style.borderColor='var(--border)'"
        >
            <!-- Preview swatch -->
            <div style="
                height: 60px;
                background: ${p.bg};
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 8px;
            ">
                <!-- Mini preview elements -->
                <div style="width:8px; height:30px; background:${p.accent}30; border-left:2px solid ${p.accent};"></div>
                <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                    <div style="height:4px; width:80%; background:${p.text}40; border-radius:2px;"></div>
                    <div style="height:4px; width:60%; background:${p.text}25; border-radius:2px;"></div>
                    <div style="height:4px; width:70%; background:${p.text}20; border-radius:2px;"></div>
                </div>
                ${showShuffle ? `
                    <span class="random-pool-toggle" data-theme-id="${theme.id}"
                          title="${inPool ? 'Included in random rotation — click to exclude' : 'Excluded from random rotation — click to include'}"
                          style="
                              position:absolute; top:4px; right:4px;
                              width:20px; height:20px;
                              display:flex; align-items:center; justify-content:center;
                              font-size:0.7em; line-height:1;
                              background:${inPool ? p.accent + '25' : 'rgba(0,0,0,0.5)'};
                              border:2px solid ${inPool ? p.accent : 'rgba(255,255,255,0.25)'};
                              border-radius:3px;
                              cursor:pointer;
                              color:${inPool ? p.accent : 'transparent'};
                              font-weight:bold;
                              transition: all 0.2s;
                          "
                    >${inPool ? '✓' : ''}</span>
                ` : ''}
            </div>

            <!-- Label -->
            <div style="padding:8px 10px; display:flex; align-items:center; gap:6px;">
                <span style="font-size:1.1em">${theme.icon || '🎨'}</span>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.85em; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${theme.name}
                    </div>
                    <div style="font-size:0.7em; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${theme.description || ''}
                    </div>
                </div>
                ${isActive ? '<span style="color:var(--success); font-size:0.75em;">Active</span>' : ''}
                ${theme.external ? '<span style="font-size:0.65em; color:var(--text-tertiary); margin-left:2px;" title="From external plugin">ext</span>' : ''}
            </div>
        </div>
    `;
}
