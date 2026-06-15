/*
 * AchievementsManager.js — achievement definitions, unlock evaluation, and toast UI.
 *
 * Loads after StatsManager.js. StatsManager.recordRound() calls the global
 * evaluateAchievements(stats, summary) after each round; this file defines it.
 * Unlocked IDs persist to localStorage. On unlock, a toast slides in (injected
 * CSS, so it works on every game page without per-page markup).
 */
(function (global) {
    'use strict';

    const ACH_KEY = 'casinoAchievements';

    // Each achievement: id, name, description (icon), and a test(stats, summary) predicate.
    const ACHIEVEMENTS = [
        { id: 'first_win',     icon: '🎉', name: 'Beginner\'s Luck',  desc: 'Win your first round.',
          test: function (s, sum) { return sum.net > 0; } },
        { id: 'high_roller',   icon: '💰', name: 'High Roller',       desc: 'Win 500 or more in a single round.',
          test: function (s, sum) { return sum.net >= 500; } },
        { id: 'jackpot',       icon: '🎰', name: 'Jackpot',           desc: 'Win 2000 or more in a single round.',
          test: function (s, sum) { return sum.net >= 2000; } },
        { id: 'hot_streak',    icon: '🔥', name: 'Hot Streak',        desc: 'Win 5 rounds in a row in one game.',
          test: function (s, sum) { return sum.gameStats.currentStreak >= 5; } },
        { id: 'on_fire',       icon: '⚡', name: 'On Fire',           desc: 'Win 10 rounds in a row in one game.',
          test: function (s, sum) { return sum.gameStats.currentStreak >= 10; } },
        { id: 'comeback',      icon: '📈', name: 'Comeback Kid',      desc: 'Win a round while down to under 100 points.',
          test: function (s, sum) {
              const pts = (typeof global.getPlayerPoints === 'function') ? global.getPlayerPoints() : Infinity;
              return sum.net > 0 && (pts - sum.net) < 100;
          } },
        { id: 'veteran',       icon: '🎖️', name: 'Veteran',          desc: 'Play 100 rounds across all games.',
          test: function (s, sum) { return sum.totals.rounds >= 100; } },
        { id: 'in_the_black',  icon: '🟢', name: 'In the Black',      desc: 'Reach a positive lifetime net profit.',
          test: function (s, sum) { return sum.totals.net > 0; } },
        { id: 'whale',         icon: '🐋', name: 'Whale',             desc: 'Wager 10,000 lifetime points.',
          test: function (s, sum) { return sum.totals.wagered >= 10000; } },
        { id: 'world_tour',    icon: '🌍', name: 'World Tour',        desc: 'Play every game at least once.',
          test: function (s, sum) { return sum.totals.gamesPlayed >= (global.StatsManager ? global.StatsManager.GAMES.length : 5); } },
        { id: 'house_wins',    icon: '🏛️', image: 'images/FNV_Mr_House_Screen.jpg', name: 'The House Always Wins', desc: 'Hit 0 points at the end of a round.',
          test: function (s, sum) {
              const pts = (typeof global.getPlayerPoints === 'function') ? global.getPlayerPoints() : null;
              return pts === 0;
          } }
    ];

    // Build the icon markup for an achievement: an <img> when an image path is
    // set, otherwise the emoji glyph. Drop a file path into the achievement's
    // `image` field (e.g. 'images/house-always-wins.png') to use custom art.
    function iconMarkup(a, fallbackGlyph) {
        if (a && a.image) {
            return '<img src="' + a.image + '" alt="' + (a.name || '') + '" ' +
                   'style="width:1em;height:1em;object-fit:contain;display:block;" ' +
                   'onerror="this.replaceWith(document.createTextNode(\'' + (a.icon || '🏆') + '\'))">';
        }
        return fallbackGlyph != null ? fallbackGlyph : (a && a.icon ? a.icon : '🏆');
    }

    function loadUnlocked() {
        let raw = null;
        try { raw = global.localStorage.getItem(ACH_KEY); } catch (e) { raw = null; }
        if (!raw) return {};
        try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
    }

    function saveUnlocked(map) {
        try { global.localStorage.setItem(ACH_KEY, JSON.stringify(map)); } catch (e) { /* ignore */ }
    }

    function evaluateAchievements(stats, summary) {
        const unlocked = loadUnlocked();
        let changed = false;
        for (let i = 0; i < ACHIEVEMENTS.length; i++) {
            const a = ACHIEVEMENTS[i];
            if (unlocked[a.id]) continue;
            let pass = false;
            try { pass = a.test(stats, summary); } catch (e) { pass = false; }
            if (pass) {
                unlocked[a.id] = Date.now();
                changed = true;
                showToast(a);
            }
        }
        if (changed) saveUnlocked(unlocked);
    }

    function getAchievements() {
        const unlocked = loadUnlocked();
        return ACHIEVEMENTS.map(function (a) {
            return {
                id: a.id, icon: a.icon, image: a.image || '', name: a.name, desc: a.desc,
                unlocked: !!unlocked[a.id], unlockedAt: unlocked[a.id] || null
            };
        });
    }

    function resetAchievements() { saveUnlocked({}); }

    /* ---- Toast UI (CSS injected once) ---- */
    let stylesInjected = false;
    let toastContainer = null;

    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const css = '' +
            '#ach-toast-wrap{position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;}' +
            '.ach-toast{display:flex;align-items:center;gap:12px;min-width:240px;max-width:340px;padding:12px 16px;' +
              'background:linear-gradient(135deg,#1e0404 0%,#3d1010 100%);border:1px solid #c9a84c;border-radius:10px;' +
              'box-shadow:0 6px 24px rgba(0,0,0,0.55),0 0 16px rgba(201,168,76,0.35);color:#f5ead8;' +
              "font-family:'Inter',system-ui,sans-serif;transform:translateX(400px);opacity:0;transition:transform .45s cubic-bezier(.2,.9,.3,1.2),opacity .45s ease;}" +
            '.ach-toast.show{transform:translateX(0);opacity:1;}' +
            '.ach-toast .ach-ic{font-size:1.8rem;line-height:1;filter:drop-shadow(0 0 6px rgba(201,168,76,0.5));}' +
            '.ach-toast .ach-tx{display:flex;flex-direction:column;gap:2px;}' +
            '.ach-toast .ach-eyebrow{font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;color:#c9a84c;font-weight:600;}' +
            '.ach-toast .ach-name{font-size:.95rem;font-weight:600;color:#f0dc96;}' +
            '.ach-toast .ach-desc{font-size:.75rem;color:#a89070;}';
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    function ensureContainer() {
        if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
        toastContainer = document.getElementById('ach-toast-wrap');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'ach-toast-wrap';
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    function showToast(a) {
        if (typeof document === 'undefined' || !document.body) return;
        injectStyles();
        const wrap = ensureContainer();

        const toast = document.createElement('div');
        toast.className = 'ach-toast';
        toast.innerHTML =
            '<div class="ach-ic">' + iconMarkup(a) + '</div>' +
            '<div class="ach-tx">' +
                '<div class="ach-eyebrow">Achievement Unlocked</div>' +
                '<div class="ach-name">' + a.name + '</div>' +
                '<div class="ach-desc">' + a.desc + '</div>' +
            '</div>';
        wrap.appendChild(toast);

        requestAnimationFrame(function () {
            requestAnimationFrame(function () { toast.classList.add('show'); });
        });

        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500);
        }, 4200);
    }

    global.AchievementsManager = {
        ACH_KEY: ACH_KEY,
        getAchievements: getAchievements,
        iconMarkup: iconMarkup,
        resetAchievements: resetAchievements,
        evaluateAchievements: evaluateAchievements
    };
    global.evaluateAchievements = evaluateAchievements;
})(typeof window !== 'undefined' ? window : this);