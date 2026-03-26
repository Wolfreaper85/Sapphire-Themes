/**
 * Sapphire Themes — Shared Nav Icon Replacer
 * Replaces emoji nav icons with SVGs when a custom theme is active.
 * Uses a generic 'themes-icon' class so it works for any theme.
 * Each theme's CSS defines colors via [data-theme="X"] .nav-icon.themes-icon svg.
 *
 * Licensed under AGPL-3.0
 */
(function() {
    'use strict';

    var ICONS = {
        chat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',

        personas: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',

        schedule: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',

        mind: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.8-3.5 6L14 20H10l-1.5-5C6.3 13.8 5 11.5 5 9a7 7 0 0 1 7-7z"/><line x1="10" y1="22" x2="14" y2="22"/></svg>',

        settings: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>',

        help: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',

        apps: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',

        mission: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>'
    };

    var VIEW_MAP = {
        'chat': 'chat',
        'personas': 'personas',
        'schedule': 'schedule',
        'mind': 'mind',
        'settings': 'settings',
        'help': 'help',
        'mc-apps': 'apps',
        'mission-control': 'mission'
    };

    // Themes managed by this plugin — external themes (like lattice) handle their own icons
    var MANAGED_THEMES = [];

    var parser = new DOMParser();

    function safeParseSVG(svgString) {
        try {
            var doc = parser.parseFromString(svgString, 'image/svg+xml');
            var err = doc.querySelector('parsererror');
            if (err) return null;
            var svg = doc.documentElement;
            if (svg.nodeName !== 'svg') return null;
            return document.importNode(svg, true);
        } catch (e) {
            return null;
        }
    }

    function isOurTheme() {
        var theme = document.documentElement.getAttribute('data-theme');
        return MANAGED_THEMES.indexOf(theme) !== -1;
    }

    function applyIcons() {
        if (!isOurTheme()) {
            revertIcons();
            return;
        }

        var navItems = document.querySelectorAll('#nav-rail .nav-item, #nav-rail .nav-group-parent');
        for (var i = 0; i < navItems.length; i++) {
            var item = navItems[i];
            var view = item.getAttribute('data-view');
            var iconKey = VIEW_MAP[view];
            if (!iconKey || !ICONS[iconKey]) continue;

            var iconEl = item.querySelector('.nav-icon');
            if (!iconEl) continue;

            if (!iconEl.dataset.originalContent) {
                iconEl.dataset.originalContent = iconEl.textContent;
            }

            // Already applied — but verify SVG is still there
            // (another theme plugin may have reverted the icon while our class remains)
            if (iconEl.classList.contains('themes-icon')) {
                if (iconEl.querySelector('svg')) continue;
                // SVG was stripped by another plugin's revert — remove stale class and re-apply
                iconEl.classList.remove('themes-icon');
            }

            var svg = safeParseSVG(ICONS[iconKey]);
            if (!svg) continue;

            while (iconEl.firstChild) iconEl.removeChild(iconEl.firstChild);
            iconEl.appendChild(svg);
            iconEl.classList.add('themes-icon');
            svg.style.transition = 'all 0.3s ease';
        }
    }

    function revertIcons() {
        var icons = document.querySelectorAll('.nav-icon.themes-icon');
        for (var i = 0; i < icons.length; i++) {
            var el = icons[i];
            if (el.dataset.originalContent) {
                while (el.firstChild) el.removeChild(el.firstChild);
                el.appendChild(document.createTextNode(el.dataset.originalContent));
                el.classList.remove('themes-icon');
            }
        }
    }

    // Count nav items that should have icons vs how many we've applied
    function hasUnappliedIcons() {
        if (!isOurTheme()) return false;
        var navItems = document.querySelectorAll('#nav-rail .nav-item, #nav-rail .nav-group-parent');
        for (var i = 0; i < navItems.length; i++) {
            var view = navItems[i].getAttribute('data-view');
            if (!VIEW_MAP[view]) continue;
            var iconEl = navItems[i].querySelector('.nav-icon');
            if (iconEl && !iconEl.classList.contains('themes-icon')) return true;
        }
        return false;
    }

    // Watch for theme changes — apply immediately AND after a short delay
    // to handle race with external theme plugins (e.g. Lattice) that may
    // revert their icons after our first pass
    new MutationObserver(function() {
        applyIcons();
        setTimeout(applyIcons, 50);
        setTimeout(applyIcons, 200);
    }).observe(
        document.documentElement,
        { attributes: true, attributeFilter: ['data-theme'] }
    );

    // Watch for nav changes (plugins adding buttons dynamically)
    function watchNav() {
        var rail = document.getElementById('nav-rail');
        if (!rail) {
            setTimeout(watchNav, 200);
            return;
        }
        // Observe child additions (new nav items from other plugins)
        new MutationObserver(function() {
            if (isOurTheme()) applyIcons();
        }).observe(rail, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    }

    // Re-apply on emotion events
    window.addEventListener('sapphire-emotion', function() {
        if (isOurTheme()) applyIcons();
    });

    // Retry loop — catches late-loading plugins that add nav buttons
    // after our MutationObserver fires. Stops once all icons are applied.
    var retryCount = 0;
    var retryMax = 20; // ~10 seconds max
    function retryApply() {
        if (retryCount >= retryMax) return;
        retryCount++;
        if (hasUnappliedIcons()) {
            applyIcons();
        }
        if (hasUnappliedIcons()) {
            setTimeout(retryApply, 500);
        }
    }

    // Also re-apply when other plugin scripts finish loading
    window.addEventListener('load', function() {
        if (isOurTheme()) {
            setTimeout(applyIcons, 100);
            setTimeout(applyIcons, 500);
            setTimeout(applyIcons, 1500);
        }
    });

    // Public API
    window.sapphireThemesNavIcons = {
        apply: applyIcons,
        revert: revertIcons,
        registerTheme: function(themeName) {
            if (MANAGED_THEMES.indexOf(themeName) === -1) {
                MANAGED_THEMES.push(themeName);
            }
        }
    };

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            applyIcons();
            watchNav();
            setTimeout(retryApply, 500);
        });
    } else {
        applyIcons();
        watchNav();
        setTimeout(retryApply, 500);
    }
})();
