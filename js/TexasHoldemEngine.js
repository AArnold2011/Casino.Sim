// Texas Hold'em Poker Game Engine

// ─────────────────────────────────────────────
// Chip denomination system
// ─────────────────────────────────────────────
const CHIP_VALUES = [
    { value: 5000, color: 'brown',      name: '$5,000' },
    { value: 2000, color: 'light-blue', name: '$2,000' },
    { value: 1000, color: 'yellow',     name: '$1,000' },
    { value: 500,  color: 'purple',     name: '$500'   },
    { value: 250,  color: 'pink',       name: '$250'   },
    { value: 100,  color: 'black',      name: '$100'   },
    { value: 50,   color: 'orange',     name: '$50'    },
    { value: 25,   color: 'green',      name: '$25'    },
    { value: 20,   color: 'grey',       name: '$20'    },
    { value: 10,   color: 'blue',       name: '$10'    },
    { value: 5,    color: 'red',        name: '$5'     },
    { value: 1,    color: 'white',      name: '$1'     }
];

function getChipDenomination(amount) {
    for (const chip of CHIP_VALUES) {
        if (amount >= chip.value) {
            return { value: chip.value, color: chip.color, name: chip.name,
                     quantity: Math.floor(amount / chip.value) };
        }
    }
    return { value: 1, color: 'white', name: '$1', quantity: amount };
}

// ─────────────────────────────────────────────
// Hand Evaluator
// Returns a numeric score 0-1 where higher = stronger hand.
// Works for 2 hole cards alone (pre-flop) or any 5-7 card set.
// ─────────────────────────────────────────────
const HandEvaluator = (() => {

    // --- Pre-flop starting-hand strength (0-1) ---
    function preFlopStrength(holeCards) {
        if (!holeCards || holeCards.length < 2) return 0.3;
        const [a, b] = holeCards;
        const hi   = Math.max(a.value, b.value);
        const lo   = Math.min(a.value, b.value);
        const pair = hi === lo;
        const suited = a.suit === b.suit;
        const gap    = hi - lo;

        // Pocket pairs
        if (pair) {
            if (hi >= 13) return 0.92;   // KK / AA
            if (hi >= 10) return 0.82;   // TT / JJ / QQ
            if (hi >= 7)  return 0.70;   // 77-99
            return 0.55;                  // 22-66
        }
        // Ace high
        if (hi === 14) {
            if (lo >= 13) return 0.88;   // AK
            if (lo >= 11) return 0.78;   // AQ / AJ
            if (suited)   return 0.68;
            return 0.60;
        }
        // Broadway / suited connectors
        if (hi >= 11 && lo >= 10)       return suited ? 0.72 : 0.65;
        if (suited && gap === 1)         return 0.60;
        if (suited && gap <= 2 && lo >= 7) return 0.55;
        if (hi >= 10 && lo >= 8)        return 0.50;
        // Weak hands
        if (gap >= 5 || lo < 5)         return 0.20;
        return 0.30;
    }

    // --- Full hand rank for 5-7 cards (returns { rank, tiebreakers }) ---
    // rank: 8=Straight Flush, 7=Quads, 6=Full House, 5=Flush,
    //       4=Straight, 3=Three of a kind, 2=Two pair, 1=Pair, 0=High card
    function rankHand(cards) {
        // Generate all C(n,5) combinations
        const combos = combinations(cards, 5);
        let best = null;
        for (const combo of combos) {
            const score = scoreHand5(combo);
            if (!best || compareTiebreakers(score, best) > 0) best = score;
        }
        return best;
    }

    function scoreHand5(cards) {
        const vals  = cards.map(c => c.value).sort((a,b) => b-a);
        const suits = cards.map(c => c.suit);
        const flush   = suits.every(s => s === suits[0]);
        const straight = isStraight(vals);
        const counts  = countValues(vals);
        const freqs   = Object.values(counts).sort((a,b) => b-a);

        if (flush && straight)  return { rank: 8, tiebreakers: vals };
        if (freqs[0] === 4)     return { rank: 7, tiebreakers: groupedOrder(counts, vals) };
        if (freqs[0] === 3 && freqs[1] === 2) return { rank: 6, tiebreakers: groupedOrder(counts, vals) };
        if (flush)              return { rank: 5, tiebreakers: vals };
        if (straight)           return { rank: 4, tiebreakers: vals };
        if (freqs[0] === 3)     return { rank: 3, tiebreakers: groupedOrder(counts, vals) };
        if (freqs[0] === 2 && freqs[1] === 2) return { rank: 2, tiebreakers: groupedOrder(counts, vals) };
        if (freqs[0] === 2)     return { rank: 1, tiebreakers: groupedOrder(counts, vals) };
        return                         { rank: 0, tiebreakers: vals };
    }

    function isStraight(sortedVals) {
        // Normal straight
        if (sortedVals[0] - sortedVals[4] === 4 && new Set(sortedVals).size === 5) return true;
        // Wheel (A-2-3-4-5): A=14, treat as 1
        if (sortedVals[0] === 14) {
            const wheel = [5,4,3,2,1];
            const low = sortedVals.slice(1);
            if (JSON.stringify(low) === JSON.stringify([5,4,3,2])) return true;
        }
        return false;
    }

    function countValues(vals) {
        const c = {};
        for (const v of vals) c[v] = (c[v] || 0) + 1;
        return c;
    }

    function groupedOrder(counts, sortedVals) {
        // Sort by frequency desc, then by value desc
        const groups = {};
        for (const [v, f] of Object.entries(counts)) {
            if (!groups[f]) groups[f] = [];
            groups[f].push(Number(v));
        }
        const result = [];
        for (const f of [4,3,2,1]) {
            if (groups[f]) result.push(...groups[f].sort((a,b) => b-a));
        }
        return result;
    }

    function compareTiebreakers(a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
            const diff = (a.tiebreakers[i] || 0) - (b.tiebreakers[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    function combinations(arr, k) {
        if (k === 0) return [[]];
        if (arr.length === 0) return [];
        const [first, ...rest] = arr;
        const withFirst    = combinations(rest, k - 1).map(c => [first, ...c]);
        const withoutFirst = combinations(rest, k);
        return [...withFirst, ...withoutFirst];
    }

    // --- Convert hand rank to a 0-1 equity estimate ---
    function handToEquity(handScore) {
        if (!handScore) return 0.3;
        // rank 0-8, map to rough equity:
        const baseEquity = [0.20, 0.45, 0.60, 0.72, 0.80, 0.87, 0.92, 0.96, 0.99];
        let eq = baseEquity[handScore.rank] || 0.20;
        // Slight adjustment for high-card tiebreakers
        const topCard = handScore.tiebreakers[0] || 7;
        eq += (topCard - 7) * 0.005;
        return Math.min(Math.max(eq, 0.05), 0.99);
    }

    return { preFlopStrength, rankHand, handToEquity };
})();

// ─────────────────────────────────────────────
// Main Game Class
// ─────────────────────────────────────────────
class TexasHoldemGame {
    constructor() {
        this.deck = [];
        this.players = [];
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.gameActive = false;
        this.currentPlayerTurn = -1;
        this.gamePhase = 'preFlop';
        this.playerChips = 0;
        this.dealerIndex = 5;
        this.smallBlindIndex = 0;
        this.bigBlindIndex = 1;
        this.gameRound = 0;
        this.initializePlayers();
        this.setupEventListeners();
        this.loadPlayerPoints();
    }

    loadPlayerPoints() {
        this.playerChips = (typeof getPlayerPoints === 'function') ? getPlayerPoints() : 1000;
        this.players[0].chips    = this.playerChips;
        this.players[0].maxChips = this.playerChips;
        const botStart = Math.floor(this.playerChips * 0.5);
        for (let i = 1; i < this.players.length; i++) {
            this.players[i].chips    = botStart;
            this.players[i].maxChips = botStart;
        }
        this.updateDisplay();
    }

    initializePlayers() {
        this.players = [];
        this.players.push({
            id: 'player', name: 'You',
            chips: this.playerChips, maxChips: this.playerChips,
            hand: [], bet: 0, folded: false, isBot: false,
            isDealer: false, botAction: '', personality: null
        });
        // Bot personalities: 'tight', 'loose', 'aggressive', 'passive', 'balanced'
        const personalities = ['tight', 'aggressive', 'loose', 'passive', 'balanced', 'tight'];
        for (let i = 1; i <= 6; i++) {
            this.players.push({
                id: `bot${i}`, name: `Bot ${i}`,
                chips: 500, maxChips: 500,
                hand: [], bet: 0, folded: false,
                isBot: true, isDealer: i === 6,
                botAction: '', personality: personalities[i - 1]
            });
        }
    }

    setupEventListeners() {
        document.getElementById('betBtn').addEventListener('click',       () => this.openBetModal());
        document.getElementById('checkBtn').addEventListener('click',     () => this.checkAction());
        document.getElementById('foldBtn').addEventListener('click',      () => this.foldAction());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startNewGame());
        document.getElementById('resetGameBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('confirmBetBtn').addEventListener('click',() => this.placeBet());
        document.getElementById('cancelBetBtn').addEventListener('click', () => this.closeBetModal());
    }

    createDeck() {
        const suits     = ['♠','♣','♥','♦'];
        const suitNames = ['spades','clubs','hearts','diamonds'];
        const ranks     = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        const rankValues = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
        this.deck = [];
        for (let i = 0; i < suits.length; i++) {
            for (const r of ranks) {
                this.deck.push({
                    suit: suits[i], suitName: suitNames[i],
                    rank: r, value: rankValues[r],
                    display: `${r}${suits[i]}`
                });
            }
        }
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // ─── Dealing ───────────────────────────────
    dealHoleCards() {
        const dealOrder = [0, 6, 1, 2, 3, 4, 5];
        const delay = 200;
        dealOrder.forEach((pi, n) => {
            setTimeout(() => {
                this.players[pi].hand.push(this.deck.pop());
                this.animateDealCard(pi, 0);
            }, n * delay);
        });
        dealOrder.forEach((pi, n) => {
            setTimeout(() => {
                this.players[pi].hand.push(this.deck.pop());
                this.animateDealCard(pi, 1);
            }, (dealOrder.length + n) * delay);
        });
        setTimeout(() => this.displayPlayerCards(), dealOrder.length * 2 * delay + 500);
    }

    animateDealCard(playerIndex, cardPosition) {
        if (playerIndex === 0) {
            const el = document.getElementById(`playerCard${cardPosition + 1}`);
            if (el) { el.classList.add('card-dealing'); setTimeout(() => el.classList.remove('card-dealing'), 400); }
        } else {
            const el = document.getElementById(`botCards${playerIndex}`);
            if (el) {
                const cards = el.querySelectorAll('.card');
                if (cards[cardPosition]) {
                    cards[cardPosition].classList.add('card-dealing');
                    setTimeout(() => cards[cardPosition].classList.remove('card-dealing'), 400);
                }
            }
        }
    }

    displayPlayerCards() {
        const [c1, c2] = this.players[0].hand;
        const set = (id, card) => {
            const el = document.getElementById(id);
            if (el && card) {
                el.textContent = card.display;
                el.className = 'card card-revealed ' +
                    (['hearts','diamonds'].includes(card.suitName) ? 'red' : 'black');
            }
        };
        set('playerCard1', c1);
        set('playerCard2', c2);
    }

    dealCommunityCards(count) {
        const startIdx = this.communityCards.length;
        for (let i = 0; i < count && this.communityCards.length < 5; i++) {
            this.communityCards.push(this.deck.pop());
        }
        this.communityCards.forEach((card, idx) => {
            if (idx >= startIdx) {
                setTimeout(() => this.revealCommunityCard(idx), (idx - startIdx) * 300);
            }
        });
    }

    revealCommunityCard(index) {
        const card = this.communityCards[index];
        const el   = document.getElementById(`communityCard${index + 1}`);
        if (el && card) {
            el.classList.add('card-flip');
            setTimeout(() => {
                el.textContent = card.display;
                el.className = 'card card-revealed ' +
                    (['hearts','diamonds'].includes(card.suitName) ? 'red' : 'black');
            }, 250);
        }
    }

    // ─── Blinds ────────────────────────────────
    rotateBlind() {
        this.smallBlindIndex = (this.smallBlindIndex + 1) % 7;
        this.bigBlindIndex   = (this.bigBlindIndex   + 1) % 7;
    }

    updateBlindDisplay() {
        for (let i = 0; i < this.players.length; i++) {
            const el = i === 0 ? document.getElementById('playerBlind')
                               : document.getElementById(`botBlind${i}`);
            if (el) { el.textContent = ''; el.className = 'blind-indicator'; }
        }
        const sbEl = this.smallBlindIndex === 0
            ? document.getElementById('playerBlind')
            : document.getElementById(`botBlind${this.smallBlindIndex}`);
        if (sbEl) { sbEl.textContent = 'SB'; sbEl.classList.add('small-blind'); }

        const bbEl = this.bigBlindIndex === 0
            ? document.getElementById('playerBlind')
            : document.getElementById(`botBlind${this.bigBlindIndex}`);
        if (bbEl) { bbEl.textContent = 'BB'; bbEl.classList.add('big-blind'); }
    }

    // ─── Game flow ─────────────────────────────
    startNewGame() {
        this.gameActive     = true;
        this.communityCards = [];
        this.pot            = 0;
        this.currentBet     = 0;
        this.gamePhase      = 'preFlop';
        this.gameRound++;
        this.rotateBlind();

        for (const p of this.players) {
            p.hand      = [];
            p.bet       = 0;
            p.folded    = false;
            p.botAction = '';
            if (p.chips <= 0) {
                p.chips    = Math.floor(this.playerChips * 0.5);
                p.maxChips = p.chips;
            }
        }

        this.clearBotDisplays();
        this.createDeck();
        this.updateBlindDisplay();

        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`communityCard${i}`);
            el.textContent = '';
            el.className = 'card card-empty';
        }

        this.updateDisplay();
        this.showMessage('New game started! Dealing cards...');
        setTimeout(() => this.dealHoleCards(), 500);
        setTimeout(() => this.startBettingRound(), 3500);
    }

    startBettingRound() {
        this.currentBet = 0;
        const active = this.players.filter(p => !p.folded && p.chips > 0);
        if (active.length <= 1) { this.endHand(); return; }

        const playerIdx = this.players.findIndex(p => p.id === 'player' && !p.folded);
        if (playerIdx !== -1 && this.players[playerIdx].chips > 0) {
            this.currentPlayerTurn = playerIdx;
            this.enablePlayerActions();
        } else {
            this.endBettingRound();
        }
    }

    enablePlayerActions() {
        const p = this.players[0];
        const ok = p.chips > 0 && !p.folded;
        document.getElementById('betBtn').disabled   = !ok;
        document.getElementById('checkBtn').disabled = !ok;
        document.getElementById('foldBtn').disabled  = !ok;
    }

    disableActions(disable) {
        document.getElementById('betBtn').disabled   = disable;
        document.getElementById('checkBtn').disabled = disable;
        document.getElementById('foldBtn').disabled  = disable;
    }

    openBetModal() {
        const player = this.players[0];
        const input  = document.getElementById('betInput');
        input.max         = player.chips;
        input.placeholder = `Max: ${player.chips}`;
        input.value       = '';
        document.getElementById('betModal').classList.add('active');
        input.focus();
    }

    closeBetModal() {
        document.getElementById('betModal').classList.remove('active');
    }

    placeBet() {
        const input     = document.getElementById('betInput');
        const betAmount = parseInt(input.value);
        const player    = this.players[0];
        if (isNaN(betAmount) || betAmount < 1 || betAmount > player.chips) {
            alert('Invalid bet amount'); return;
        }
        player.chips    -= betAmount;
        player.bet       = betAmount;
        this.pot        += betAmount;
        this.currentBet  = betAmount;
        this.closeBetModal();
        this.updateDisplay();
        this.showMessage(`You bet ${betAmount} chips`);
        this.disableActions(true);
        setTimeout(() => this.executeBotActions(), 1000);
    }

    checkAction() {
        this.disableActions(true);
        this.showMessage('You checked');
        setTimeout(() => this.executeBotActions(), 1000);
    }

    foldAction() {
        this.players[0].folded = true;
        this.disableActions(true);
        this.showMessage('You folded');
        setTimeout(() => {
            const active = this.players.filter(p => !p.folded);
            if (active.length === 1) this.endHand();
            else this.executeBotActions();
        }, 1000);
    }

    // ─── Bot AI ────────────────────────────────

    /**
     * Compute a 0-1 equity estimate for a bot at any game stage.
     */
    computeBotEquity(bot) {
        const allCards = [...bot.hand, ...this.communityCards];

        // Pre-flop: use starting-hand heuristic
        if (this.communityCards.length === 0) {
            return HandEvaluator.preFlopStrength(bot.hand);
        }

        // Post-flop: evaluate actual best hand
        const handScore = HandEvaluator.rankHand(allCards);
        return HandEvaluator.handToEquity(handScore);
    }

    /**
     * Decide what action a bot takes and how much to bet.
     * Returns { action: 'fold'|'check'|'call'|'raise', amount: number }
     */
    determineBotDecision(bot) {
        const equity       = this.computeBotEquity(bot);
        const personality  = bot.personality || 'balanced';
        const pot          = this.pot || 1;
        const toCall       = this.currentBet - bot.bet;
        const maxBet       = bot.chips;

        // Personality modifiers
        const foldThreshold  = { tight: 0.42, loose: 0.25, aggressive: 0.30, passive: 0.38, balanced: 0.35 }[personality];
        const raiseThreshold = { tight: 0.72, loose: 0.58, aggressive: 0.55, passive: 0.80, balanced: 0.65 }[personality];
        const bluffRate      = { tight: 0.04, loose: 0.14, aggressive: 0.18, passive: 0.02, balanced: 0.08 }[personality];

        // Occasional bluff (ignore equity)
        const bluffing = Math.random() < bluffRate;

        // Effective equity (bluff overrides toward raise)
        const effEquity = bluffing ? 0.75 : equity;

        // If there's a bet to call, use pot-odds logic
        if (toCall > 0) {
            const potOdds = toCall / (pot + toCall); // breakeven equity needed
            if (effEquity < foldThreshold || effEquity < potOdds * 0.8) {
                return { action: 'fold', amount: 0 };
            }
            if (effEquity >= raiseThreshold && maxBet > toCall) {
                const raise = this.calcBetSize(bot, effEquity, pot, personality);
                return { action: 'raise', amount: Math.min(raise, maxBet) };
            }
            return { action: 'call', amount: Math.min(toCall, maxBet) };
        }

        // No bet to call — check or bet
        if (effEquity < foldThreshold - 0.05) {
            return { action: 'check', amount: 0 }; // weakish hand, check for free
        }
        if (effEquity >= raiseThreshold - 0.10) {
            const bet = this.calcBetSize(bot, effEquity, pot, personality);
            return { action: 'bet', amount: Math.min(bet, maxBet) };
        }
        return { action: 'check', amount: 0 };
    }

    /**
     * Size a bet / raise proportional to hand strength and pot.
     */
    calcBetSize(bot, equity, pot, personality) {
        // Bet between 33% and 100% of pot, scaled by equity
        const fraction = 0.33 + (equity - 0.5) * 1.34; // 0.5 equity → ~33%, 1.0 → ~100%
        const clampedFraction = Math.max(0.25, Math.min(1.0, fraction));
        let size = Math.floor(pot * clampedFraction);

        // Aggression tweak
        if (personality === 'aggressive') size = Math.floor(size * 1.35);
        if (personality === 'passive')    size = Math.floor(size * 0.65);

        // Minimum meaningful bet
        size = Math.max(size, Math.ceil(pot * 0.20), 5);
        return Math.min(size, bot.chips);
    }

    executeBotActions() {
        const botsToAct = this.players.filter((p, i) => i !== 0 && !p.folded && p.chips > 0);
        let actedCount  = 0;
        const total     = botsToAct.length;

        botsToAct.forEach((bot, seq) => {
            setTimeout(() => {
                const decision = this.determineBotDecision(bot);

                switch (decision.action) {
                    case 'fold':
                        bot.folded    = true;
                        bot.botAction = 'Folded';
                        this.showMessage(`${bot.name} folded`);
                        break;

                    case 'call': {
                        const amt   = decision.amount;
                        bot.chips  -= amt;
                        bot.bet    += amt;
                        this.pot   += amt;
                        bot.botAction = `Called ${amt}`;
                        this.showMessage(`${bot.name} called ${amt}`);
                        break;
                    }

                    case 'bet':
                    case 'raise': {
                        const amt   = decision.amount;
                        bot.chips  -= amt;
                        bot.bet    += amt;
                        this.pot   += amt;
                        this.currentBet = Math.max(this.currentBet, bot.bet);
                        const label = decision.action === 'raise' ? 'raised' : 'bet';
                        bot.botAction = `${label.charAt(0).toUpperCase() + label.slice(1)} ${amt}`;
                        this.showMessage(`${bot.name} ${label} ${amt}`);
                        break;
                    }

                    default: // check
                        bot.botAction = 'Checked';
                        this.showMessage(`${bot.name} checked`);
                }

                this.updateDisplay();
                actedCount++;

                if (actedCount === total) {
                    setTimeout(() => this.advanceGamePhase(), 800);
                }
            }, seq * 900); // Stagger each bot's action visibly
        });

        // Edge case: no bots to act
        if (total === 0) {
            setTimeout(() => this.advanceGamePhase(), 800);
        }
    }

    advanceGamePhase() {
        if (this.gamePhase === 'preFlop') {
            this.gamePhase = 'flop';
            this.showMessage('Flop!');
            setTimeout(() => this.dealCommunityCards(3), 500);
            setTimeout(() => this.startBettingRound(), 2500);
        } else if (this.gamePhase === 'flop') {
            this.gamePhase = 'turn';
            this.showMessage('Turn!');
            setTimeout(() => this.dealCommunityCards(1), 500);
            setTimeout(() => this.startBettingRound(), 1500);
        } else if (this.gamePhase === 'turn') {
            this.gamePhase = 'river';
            this.showMessage('River!');
            setTimeout(() => this.dealCommunityCards(1), 500);
            setTimeout(() => this.startBettingRound(), 1500);
        } else {
            this.endHand();
        }
    }

    // ─── Showdown ──────────────────────────────
    endHand() {
        const active = this.players.filter(p => !p.folded);
        let winner   = null;

        if (active.length === 1) {
            winner = active[0];
        } else {
            // Full hand comparison at showdown
            winner = active.reduce((best, p) => {
                const allCards    = [...p.hand, ...this.communityCards];
                const score       = HandEvaluator.rankHand(allCards);
                const bestAllCards = [...best.hand, ...this.communityCards];
                const bestScore   = HandEvaluator.rankHand(bestAllCards);
                return this.compareHandScores(score, bestScore) > 0 ? p : best;
            });
        }

        if (winner) {
            winner.chips += this.pot;
            this.showMessage(`${winner.name} wins ${this.pot} chips!`);
        }

        this.gameActive = false;
        this.revealBotCards();
        this.disableActions(true);
        this.playerChips = this.players[0].chips;

        if (typeof setPlayerPoints === 'function') {
            setPlayerPoints(this.playerChips);
        }

        this.updateDisplay();

        setTimeout(() => {
            if (this.players[0].chips > 0) this.startNewGame();
            else this.resetGame();
        }, 3000);
    }

    compareHandScores(a, b) {
        if (!a) return -1;
        if (!b) return 1;
        if (a.rank !== b.rank) return a.rank - b.rank;
        for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
            const diff = (a.tiebreakers[i] || 0) - (b.tiebreakers[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    endBettingRound() {
        const active = this.players.filter(p => !p.folded);
        if (active.length === 1) this.endHand();
        else this.advanceGamePhase();
    }

    resetGame() {
        this.gameActive = false;
        this.disableActions(true);
        this.communityCards = [];
        this.pot            = 0;
        this.currentBet     = 0;

        for (const p of this.players) {
            p.hand   = [];
            p.bet    = 0;
            p.folded = false;
            if (p.id === 'player') {
                p.chips    = this.playerChips;
                p.maxChips = this.playerChips;
            } else {
                p.chips    = Math.floor(this.playerChips * 0.5);
                p.maxChips = p.chips;
            }
        }

        for (let i = 1; i <= 2; i++) {
            const el = document.getElementById(`playerCard${i}`);
            el.textContent = ''; el.className = 'card card-empty';
        }
        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`communityCard${i}`);
            el.textContent = ''; el.className = 'card card-empty';
        }

        this.clearBotDisplays();

        for (let i = 1; i <= 6; i++) {
            const el = document.getElementById(`botBlind${i}`);
            if (el) { el.textContent = ''; el.className = 'blind-indicator'; }
        }
        const pb = document.getElementById('playerBlind');
        if (pb) { pb.textContent = ''; pb.className = 'blind-indicator'; }

        this.updateDisplay();
        this.showMessage('Game reset. Click "Start New Game" to begin.');
    }

    // ─── Display helpers ───────────────────────
    updateDisplay() {
        document.getElementById('potAmount').textContent   = this.pot;
        document.getElementById('currentBet').textContent  = this.currentBet;
        document.getElementById('playerChips').textContent = this.playerChips;

        const playerChipDenom = getChipDenomination(this.players[0].chips);
        document.getElementById('playerChipsDisplay').textContent = this.players[0].chips;
        document.getElementById('playerChipsDisplay').parentElement.className =
            `chip-stack chip-${playerChipDenom.color}`;

        for (let i = 1; i < this.players.length; i++) {
            const bot       = this.players[i];
            const chipEl    = document.getElementById(`botChips${i}`);
            const stackEl   = document.getElementById(`botChipStack${i}`);
            if (chipEl) {
                const denom = getChipDenomination(bot.chips);
                chipEl.textContent     = bot.chips;
                stackEl.className      = `chip-stack chip-${denom.color}`;
            }
        }

        document.getElementById('gameStatus').textContent =
            this.gameActive ? `Phase: ${this.gamePhase}` : 'Waiting for game to start...';

        this.updateBotDisplays();
    }

    updateBotDisplays() {
        for (let i = 1; i <= 6; i++) {
            const bot       = this.players[i];
            const actionEl  = document.getElementById(`botAction${i}`);
            const cardsEl   = document.getElementById(`botCards${i}`);
            if (actionEl) actionEl.textContent = bot.botAction || '';
            if (cardsEl)  cardsEl.classList.toggle('folded', bot.folded);
        }
    }

    revealBotCards() {
        for (let i = 1; i <= 6; i++) {
            const bot    = this.players[i];
            const cardsEl = document.getElementById(`botCards${i}`);
            if (!cardsEl) continue;
            if (bot.folded) {
                bot.botAction = 'Folded';
                cardsEl.classList.add('folded');
                continue;
            }
            const cards = cardsEl.querySelectorAll('.card');
            if (bot.hand.length >= 2) {
                [0,1].forEach(j => {
                    cards[j].textContent = bot.hand[j].display;
                    cards[j].className = 'card card-revealed ' +
                        (['hearts','diamonds'].includes(bot.hand[j].suitName) ? 'red' : 'black') +
                        ' card-flip';
                });
            }
        }
        this.updateBotDisplays();
    }

    clearBotDisplays() {
        for (let i = 1; i <= 6; i++) {
            const actionEl = document.getElementById(`botAction${i}`);
            const cardsEl  = document.getElementById(`botCards${i}`);
            if (actionEl) actionEl.textContent = '';
            if (cardsEl) {
                cardsEl.classList.remove('folded');
                cardsEl.innerHTML = '<div class="card card-back"></div><div class="card card-back"></div>';
            }
            if (this.players[i]) this.players[i].botAction = '';
        }
    }

    showMessage(text) {
        const el = document.getElementById('gameMessage');
        el.textContent = text;
        el.classList.remove('active');
        void el.offsetWidth; // force reflow
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 5000);
    }
}

// Initialise when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new TexasHoldemGame();
    game.updateDisplay();
});