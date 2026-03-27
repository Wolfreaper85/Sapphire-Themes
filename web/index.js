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
    const inPool = randomPool && randomPool.length > 0 ? randomPool.includes(theme.id) : true;
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
                              width:22px; height:22px;
                              display:flex; align-items:center; justify-content:center;
                              font-size:0.75em;
                              background:${inPool ? p.accent + '30' : 'rgba(0,0,0,0.4)'};
                              border:1px solid ${inPool ? p.accent : 'rgba(255,255,255,0.2)'};
                              border-radius:4px;
                              cursor:pointer;
                              opacity:${inPool ? '1' : '0.5'};
                              transition: opacity 0.2s, background 0.2s;
                          "
                    >${inPool ? '🔀' : '⏸️'}</span>
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
