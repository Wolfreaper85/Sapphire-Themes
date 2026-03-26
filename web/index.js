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
                    <div>
                        <strong>Theme Manager</strong>
                        <div class="text-muted" style="font-size:0.85em">
                            ${Object.keys(themes).length} themes available
                            ${externalThemes.length ? ` (${externalThemes.length} from other plugins)` : ''}
                        </div>
                    </div>
                </div>
            </div>

            ${_renderSection('Default', builtinThemes, current)}
            ${_renderSection('Bundled', bundledThemes, current)}
            ${externalThemes.length ? _renderSection('External Plugins', externalThemes, current) : ''}

            <!-- Per-theme settings (only for active bundled themes) -->
            <div id="theme-settings-panel"></div>
        `;

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


function _renderSection(title, themes, current) {
    if (!themes.length) return '';
    return `
        <div style="margin-bottom: 20px">
            <div style="font-size:0.8em; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:8px; padding-top:8px; border-top:1px solid var(--border)">
                ${title}
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:10px;">
                ${themes.map(t => _renderCard(t, current)).join('')}
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
        }
    }

    applyForTheme(document.documentElement.getAttribute('data-theme'));

    new MutationObserver(function() {
        applyForTheme(document.documentElement.getAttribute('data-theme'));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();


function _renderCard(theme, current) {
    const isActive = theme.id === current;
    const p = theme.preview || { bg: '#1a1a2e', accent: '#4a9eff', text: '#ccc' };

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
