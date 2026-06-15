/*
 * StatsManager.js — shared stats + leaderboard layer for Casino Simulator.
 *
 * Each game reports one resolved round via recordRound(gameKey, { wagered, returned }).
 *   wagered  = total points the player put at risk this round
 *   returned = total points paid back (0 = total loss; == wagered = push/break-even)
 * Net profit for the round is (returned - wagered).
 *
 * Data is persisted to localStorage under STATS_KEY. Personal bests and
 * aggregate per-game figures are derived here so individual engines stay thin.
 */
(function (global) {
    'use strict';

    const STATS_KEY = 'casinoStats';
    const GAMES = ['roulette', 'blackjack', 'baccarat', 'slots', 'holdem'];
    const GAME_LABELS = {
        roulette: 'Roulette',
        blackjack: 'Blackjack',
        baccarat: 'Baccarat',
        slots: 'Slots',
        holdem: "Texas Hold'em"
    };

    function emptyGameStats() {
        return {
            rounds: 0,
            wins: 0,
            losses: 0,
            pushes: 0,
            wagered: 0,      // cumulative points risked
            returned: 0,     // cumulative points paid back
            earned: 0,       // sum of positive net rounds (money won)
            lost: 0,         // sum of |negative net rounds| (money lost)
            biggestWin: 0,   // largest single-round net gain
            biggestLoss: 0,  // largest single-round net loss (stored positive)
            currentStreak: 0,
            bestStreak: 0    // longest consecutive winning streak
        };
    }

    function emptyStats() {
        const games = {};
        GAMES.forEach(function (g) { games[g] = emptyGameStats(); });
        return {
            version: 1,
            games: games,
            firstPlayed: null,
            lastPlayed: null
        };
    }

    function load() {
        let raw = null;
        try { raw = global.localStorage.getItem(STATS_KEY); } catch (e) { raw = null; }
        if (!raw) return emptyStats();
        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) { return emptyStats(); }
        // Merge against the current shape so older saves don't break on new fields.
        const base = emptyStats();
        if (parsed && parsed.games) {
            GAMES.forEach(function (g) {
                if (parsed.games[g]) {
                    base.games[g] = Object.assign(emptyGameStats(), parsed.games[g]);
                }
            });
            base.firstPlayed = parsed.firstPlayed || null;
            base.lastPlayed = parsed.lastPlayed || null;
        }
        return base;
    }

    function save(stats) {
        try { global.localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* storage full or blocked */ }
    }

    function recordRound(gameKey, result) {
        if (GAMES.indexOf(gameKey) === -1) return null;
        const wagered = Number(result && result.wagered) || 0;
        const returned = Number(result && result.returned) || 0;
        if (wagered <= 0) return null;

        const stats = load();
        const g = stats.games[gameKey];
        const net = returned - wagered;

        g.rounds += 1;
        g.wagered += wagered;
        g.returned += returned;

        if (net > 0) {
            g.wins += 1;
            g.earned += net;
            g.currentStreak += 1;
            if (g.currentStreak > g.bestStreak) g.bestStreak = g.currentStreak;
            if (net > g.biggestWin) g.biggestWin = net;
        } else if (net < 0) {
            g.losses += 1;
            g.lost += Math.abs(net);
            g.currentStreak = 0;
            if (Math.abs(net) > g.biggestLoss) g.biggestLoss = Math.abs(net);
        } else {
            g.pushes += 1;
            // a push doesn't reset a win streak
        }

        const now = Date.now();
        if (!stats.firstPlayed) stats.firstPlayed = now;
        stats.lastPlayed = now;

        save(stats);

        const summary = {
            gameKey: gameKey,
            net: net,
            gameStats: g,
            totals: computeTotals(stats)
        };

        // Hand off to the achievements layer if present.
        if (typeof global.evaluateAchievements === 'function') {
            try { global.evaluateAchievements(stats, summary); } catch (e) { /* never let achievements break a round */ }
        }
        return summary;
    }

    function computeTotals(stats) {
        const t = { rounds: 0, wagered: 0, returned: 0, earned: 0, lost: 0, net: 0, gamesPlayed: 0 };
        GAMES.forEach(function (key) {
            const g = stats.games[key];
            t.rounds += g.rounds;
            t.wagered += g.wagered;
            t.returned += g.returned;
            t.earned += g.earned;
            t.lost += g.lost;
            if (g.rounds > 0) t.gamesPlayed += 1;
        });
        t.net = t.returned - t.wagered;
        return t;
    }

    function getStats() { return load(); }

    function getTotals() { return computeTotals(load()); }

    function resetStats() { save(emptyStats()); }

    global.StatsManager = {
        STATS_KEY: STATS_KEY,
        GAMES: GAMES,
        GAME_LABELS: GAME_LABELS,
        recordRound: recordRound,
        getStats: getStats,
        getTotals: getTotals,
        computeTotals: computeTotals,
        resetStats: resetStats
    };

    // Convenience global mirroring PointsManager's flat-function style.
    global.recordRound = recordRound;
})(typeof window !== 'undefined' ? window : this);
