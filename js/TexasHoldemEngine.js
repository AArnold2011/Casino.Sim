

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
            return { value: chip.value, color: chip.color, name: chip.name };
        }
    }
    return { value: 1, color: 'white', name: '$1' };
}

const HandEvaluator = (() => {

    function preFlopStrength(holeCards) {
        if (!holeCards || holeCards.length < 2) return 0.3;
        const [a, b] = holeCards;
        const hi   = Math.max(a.value, b.value);
        const lo   = Math.min(a.value, b.value);
        const pair = hi === lo;
        const suited = a.suit === b.suit;
        const gap    = hi - lo;

        if (pair) {
            if (hi >= 13) return 0.92;
            if (hi >= 10) return 0.82;
            if (hi >= 7)  return 0.70;
            return 0.55;
        }
        if (hi === 14) {
            if (lo >= 13) return 0.88;
            if (lo >= 11) return 0.78;
            if (suited)   return 0.68;
            return 0.60;
        }
        if (hi >= 11 && lo >= 10)       return suited ? 0.72 : 0.65;
        if (suited && gap === 1)         return 0.60;
        if (suited && gap <= 2 && lo >= 7) return 0.55;
        if (hi >= 10 && lo >= 8)        return 0.50;
        if (gap >= 5 || lo < 5)         return 0.20;
        return 0.30;
    }

    function rankHand(cards) {
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
        if (sortedVals[0] - sortedVals[4] === 4 && new Set(sortedVals).size === 5) return true;
        if (sortedVals[0] === 14) {
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

    function handToEquity(handScore) {
        if (!handScore) return 0.3;
        const baseEquity = [0.20, 0.45, 0.60, 0.72, 0.80, 0.87, 0.92, 0.96, 0.99];
        let eq = baseEquity[handScore.rank] || 0.20;
        const topCard = handScore.tiebreakers[0] || 7;
        eq += (topCard - 7) * 0.005;
        return Math.min(Math.max(eq, 0.05), 0.99);
    }

    return { preFlopStrength, rankHand, handToEquity };
})();

class TexasHoldemGame {
    constructor() {
        this.deck           = [];
        this.players        = [];
        this.communityCards = [];
        this.pot            = 0;
        this.currentBet     = 0;
        this.gameActive     = false;
        this.gamePhase      = 'preFlop';
        this.smallBlindIndex = 0;
        this.bigBlindIndex  = 1;
        this.gameRound      = 0;
        this._actionLock    = false;
        this._handStartChips = null;

        this.initializePlayers();
        this.setupEventListeners();
        this.loadPlayerPoints();
    }

    get playerObj()  { return this.players[0]; }

    savePoints() {
        if (typeof setPlayerPoints === 'function') setPlayerPoints(this.playerObj.chips);
    }

    loadPlayerPoints() {
        const pts = (typeof getPlayerPoints === 'function') ? getPlayerPoints() : 1000;
        this.playerObj.chips    = pts;
        this.playerObj.maxChips = pts;
        const botStart = Math.max(Math.floor(pts * 0.5), 200);
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
            chips: 1000, maxChips: 1000,
            hand: [], bet: 0, folded: false, isBot: false,
            botAction: '', personality: null
        });
        const personalities = ['tight', 'aggressive', 'loose', 'passive', 'balanced', 'tight'];
        for (let i = 1; i <= 6; i++) {
            this.players.push({
                id: `bot${i}`, name: `Bot ${i}`,
                chips: 500, maxChips: 500,
                hand: [], bet: 0, folded: false, isBot: true,
                botAction: '', personality: personalities[i - 1]
            });
        }
    }

    setupEventListeners() {
        document.getElementById('betBtn').addEventListener('click',        () => this.openBetModal());
        document.getElementById('checkBtn').addEventListener('click',      () => this.checkAction());
        document.getElementById('foldBtn').addEventListener('click',       () => this.foldAction());
        document.getElementById('startGameBtn').addEventListener('click',  () => this.startNewGame());
        document.getElementById('resetGameBtn').addEventListener('click',  () => this.resetGame());
        document.getElementById('confirmBetBtn').addEventListener('click', () => this.placeBet());
        document.getElementById('cancelBetBtn').addEventListener('click',  () => this.closeBetModal());
    }

    createDeck() {
        const suits      = ['♠','♣','♥','♦'];
        const suitNames  = ['spades','clubs','hearts','diamonds'];
        const ranks      = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        const rankValues = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
        this.deck = [];
        for (let i = 0; i < suits.length; i++) {
            for (const r of ranks) {
                this.deck.push({ suit: suits[i], suitName: suitNames[i], rank: r, value: rankValues[r], display: `${r}${suits[i]}` });
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

    dealHoleCards() {
        const order = [0, 6, 1, 2, 3, 4, 5];
        const delay = 200;
        order.forEach((pi, n) => {
            setTimeout(() => { this.players[pi].hand.push(this.deck.pop()); this.animateDealCard(pi, 0); }, n * delay);
        });
        order.forEach((pi, n) => {
            setTimeout(() => { this.players[pi].hand.push(this.deck.pop()); this.animateDealCard(pi, 1); }, (order.length + n) * delay);
        });
        const totalDealTime = order.length * 2 * delay + 400;
        setTimeout(() => this.displayPlayerCards(), totalDealTime);
        return totalDealTime;
    }

    animateDealCard(pi, pos) {
        if (pi === 0) {
            const el = document.getElementById(`playerCard${pos + 1}`);
            if (el) { el.classList.add('card-dealing'); setTimeout(() => el.classList.remove('card-dealing'), 400); }
        } else {
            const el = document.getElementById(`botCards${pi}`);
            if (el) {
                const cards = el.querySelectorAll('.card');
                if (cards[pos]) { cards[pos].classList.add('card-dealing'); setTimeout(() => cards[pos].classList.remove('card-dealing'), 400); }
            }
        }
    }

    displayPlayerCards() {
        const [c1, c2] = this.playerObj.hand;
        const set = (id, card) => {
            const el = document.getElementById(id);
            if (el && card) {
                el.textContent = card.display;
                el.className = 'card card-revealed ' + (['hearts','diamonds'].includes(card.suitName) ? 'red' : 'black');
            }
        };
        set('playerCard1', c1);
        set('playerCard2', c2);
    }

    dealCommunityCards(count) {
        const startIdx = this.communityCards.length;
        const toDeal   = Math.min(count, 5 - startIdx);
        for (let i = 0; i < toDeal; i++) {
            this.communityCards.push(this.deck.pop());
        }
        for (let i = 0; i < toDeal; i++) {
            const idx = startIdx + i;
            setTimeout(() => this.revealCommunityCard(idx), i * 350);
        }
        return toDeal * 350 + 200;
    }

    revealCommunityCard(index) {
        const card = this.communityCards[index];
        const el   = document.getElementById(`communityCard${index + 1}`);
        if (el && card) {
            el.classList.add('card-flip');
            setTimeout(() => {
                el.textContent = card.display;
                el.className = 'card card-revealed ' + (['hearts','diamonds'].includes(card.suitName) ? 'red' : 'black');
            }, 250);
        }
    }

    rotateBlind() {
        this.smallBlindIndex = (this.smallBlindIndex + 1) % 7;
        this.bigBlindIndex   = (this.bigBlindIndex   + 1) % 7;
    }

    updateBlindDisplay() {
        for (let i = 0; i < this.players.length; i++) {
            const el = i === 0 ? document.getElementById('playerBlind') : document.getElementById(`botBlind${i}`);
            if (el) { el.textContent = ''; el.className = 'blind-indicator'; }
        }
        const sbEl = this.smallBlindIndex === 0 ? document.getElementById('playerBlind') : document.getElementById(`botBlind${this.smallBlindIndex}`);
        if (sbEl) { sbEl.textContent = 'SB'; sbEl.classList.add('small-blind'); }
        const bbEl = this.bigBlindIndex === 0   ? document.getElementById('playerBlind') : document.getElementById(`botBlind${this.bigBlindIndex}`);
        if (bbEl) { bbEl.textContent = 'BB'; bbEl.classList.add('big-blind'); }
    }

    startNewGame() {
        if (this.gameActive) return;
        this._actionLock    = false;
        this.gameActive     = true;
        this._handStartChips = this.playerObj.chips;
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
            if (p.chips <= 0) p.chips = p.maxChips || Math.max(Math.floor(this.playerObj.chips * 0.5), 100);
        }

        this.clearBotDisplays();
        this.createDeck();
        this.updateBlindDisplay();

        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`communityCard${i}`);
            if (el) { el.textContent = ''; el.className = 'card card-empty'; }
        }

        this.updateDisplay();
        this.showMessage('New game started! Dealing cards…');

        const dealDone = this.dealHoleCards();
        setTimeout(() => this.startBettingRound(), dealDone + 300);
    }

    startBettingRound() {
        if (!this.gameActive) return;

        for (const p of this.players) p.bet = 0;
        this.currentBet = 0;

        const active = this.players.filter(p => !p.folded && p.chips > 0);
        if (active.length <= 1) {
            this.endHand();
            return;
        }

        this.updateDisplay();

        const playerIn = !this.playerObj.folded && this.playerObj.chips > 0;
        if (playerIn) {
            this.enablePlayerActions();
            this.showMessage(this.phaseLabel() + ' — Your turn. Bet, check, or fold.');
        } else {
            this.disableActions(true);
            setTimeout(() => this.executeBotActions(), 600);
        }
    }

    phaseLabel() {
        return { preFlop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River' }[this.gamePhase] || this.gamePhase;
    }

    enablePlayerActions() {
        document.getElementById('betBtn').disabled   = false;
        document.getElementById('checkBtn').disabled = false;
        document.getElementById('foldBtn').disabled  = false;
    }

    disableActions(disable) {
        document.getElementById('betBtn').disabled   = disable;
        document.getElementById('checkBtn').disabled = disable;
        document.getElementById('foldBtn').disabled  = disable;
    }

    openBetModal() {
        const input       = document.getElementById('betInput');
        input.max         = this.playerObj.chips;
        input.placeholder = `Max: ${this.playerObj.chips}`;
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
        if (isNaN(betAmount) || betAmount < 1 || betAmount > this.playerObj.chips) {
            alert('Invalid bet amount'); return;
        }
        this.playerObj.chips -= betAmount;
        this.playerObj.bet    = betAmount;
        this.pot             += betAmount;
        this.currentBet       = betAmount;
        this.closeBetModal();
        this.updateDisplay();
        this.showMessage(`You bet ${betAmount} chips`);
        this.disableActions(true);
        this.savePoints();
        setTimeout(() => this.executeBotActions(), 800);
    }

    checkAction() {
        if (this._actionLock) return;
        this._actionLock = true;
        this.disableActions(true);
        this.showMessage('You checked');
        setTimeout(() => { this._actionLock = false; this.executeBotActions(); }, 800);
    }

    foldAction() {
        if (this._actionLock) return;
        this._actionLock = true;
        this.playerObj.folded = true;
        this.disableActions(true);
        this.showMessage('You folded');
        this.savePoints();
        setTimeout(() => {
            this._actionLock = false;
            const active = this.players.filter(p => !p.folded);
            if (active.length === 1) this.endHand();
            else this.executeBotActions();
        }, 800);
    }

    computeBotEquity(bot) {
        const allCards = [...bot.hand, ...this.communityCards];
        if (this.communityCards.length === 0) return HandEvaluator.preFlopStrength(bot.hand);
        const handScore = HandEvaluator.rankHand(allCards);
        return HandEvaluator.handToEquity(handScore);
    }

    determineBotDecision(bot) {
        const equity      = this.computeBotEquity(bot);
        const personality = bot.personality || 'balanced';
        const pot         = this.pot || 1;
        const toCall      = this.currentBet - bot.bet;
        const maxBet      = bot.chips;

        const foldThreshold  = { tight: 0.42, loose: 0.25, aggressive: 0.30, passive: 0.38, balanced: 0.35 }[personality];
        const raiseThreshold = { tight: 0.72, loose: 0.58, aggressive: 0.55, passive: 0.80, balanced: 0.65 }[personality];
        const bluffRate      = { tight: 0.04, loose: 0.14, aggressive: 0.18, passive: 0.02, balanced: 0.08 }[personality];

        const bluffing  = Math.random() < bluffRate;
        const effEquity = bluffing ? 0.75 : equity;

        if (toCall > 0) {
            const potOdds = toCall / (pot + toCall);
            if (effEquity < foldThreshold || effEquity < potOdds * 0.8) return { action: 'fold', amount: 0 };
            if (effEquity >= raiseThreshold && maxBet > toCall) {
                const raise = this.calcBetSize(bot, effEquity, pot, personality);
                return { action: 'raise', amount: Math.min(raise, maxBet) };
            }
            return { action: 'call', amount: Math.min(toCall, maxBet) };
        }

        if (effEquity < foldThreshold - 0.05) return { action: 'check', amount: 0 };
        if (effEquity >= raiseThreshold - 0.10) {
            const bet = this.calcBetSize(bot, effEquity, pot, personality);
            return { action: 'bet', amount: Math.min(bet, maxBet) };
        }
        return { action: 'check', amount: 0 };
    }

    calcBetSize(bot, equity, pot, personality) {
        const fraction = Math.max(0.25, Math.min(1.0, 0.33 + (equity - 0.5) * 1.34));
        let size = Math.floor(pot * fraction);
        if (personality === 'aggressive') size = Math.floor(size * 1.35);
        if (personality === 'passive')    size = Math.floor(size * 0.65);
        size = Math.max(size, Math.ceil(pot * 0.20), 5);
        return Math.min(size, bot.chips);
    }

    executeBotActions() {
        const botsToAct = this.players.filter((p, i) => i !== 0 && !p.folded && p.chips > 0);

        if (botsToAct.length === 0) {
            setTimeout(() => this.advanceGamePhase(), 400);
            return;
        }

        let seq = 0;
        const BOT_DELAY = 850;

        const runNext = () => {
            if (seq >= botsToAct.length) {
                const stillIn = this.players.filter(p => !p.folded);
                if (stillIn.length <= 1) { this.endHand(); return; }
                setTimeout(() => this.advanceGamePhase(), 600);
                return;
            }

            const bot      = botsToAct[seq];
            const decision = this.determineBotDecision(bot);
            seq++;

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
                    bot.botAction = `${label[0].toUpperCase() + label.slice(1)} ${amt}`;
                    this.showMessage(`${bot.name} ${label} ${amt}`);
                    break;
                }
                default:
                    bot.botAction = 'Checked';
                    this.showMessage(`${bot.name} checked`);
            }

            this.updateDisplay();
            setTimeout(runNext, BOT_DELAY);
        };

        runNext();
    }

    advanceGamePhase() {
        if (!this.gameActive) return;

        if (this.gamePhase === 'preFlop') {
            this.gamePhase = 'flop';
            this.showMessage('Flop!');
            const dealMs = this.dealCommunityCards(3);
            setTimeout(() => this.startBettingRound(), dealMs + 500);

        } else if (this.gamePhase === 'flop') {
            this.gamePhase = 'turn';
            this.showMessage('Turn!');
            const dealMs = this.dealCommunityCards(1);
            setTimeout(() => this.startBettingRound(), dealMs + 500);

        } else if (this.gamePhase === 'turn') {
            this.gamePhase = 'river';
            this.showMessage('River!');
            const dealMs = this.dealCommunityCards(1);
            setTimeout(() => this.startBettingRound(), dealMs + 500);

        } else if (this.gamePhase === 'river') {
            this.endHand();
        }
    }

    endHand() {
        if (!this.gameActive) return;
        this.gameActive = false;
        this.disableActions(true);

        const active = this.players.filter(p => !p.folded);
        let winner   = null;

        if (active.length === 1) {
            winner = active[0];
        } else {
            winner = active.reduce((best, p) => {
                const score     = HandEvaluator.rankHand([...p.hand, ...this.communityCards]);
                const bestScore = HandEvaluator.rankHand([...best.hand, ...this.communityCards]);
                return this.compareHandScores(score, bestScore) > 0 ? p : best;
            });
        }

        if (winner) {
            winner.chips += this.pot;
            this.showMessage(`${winner.name} wins ${this.pot} chips!`);
        }

        // Stats: wagered = chips the player committed this hand; returned = chips
        // back from the pot (only if the player won). Net = returned - wagered.
        if (typeof this._handStartChips === 'number' && typeof recordRound === 'function') {
            const chipsAfterPot = this.playerObj.chips;
            const playerWonPot  = winner && winner.id === 'player';
            const potBackToPlayer = playerWonPot ? this.pot : 0;
            const wagered = (this._handStartChips - chipsAfterPot) + potBackToPlayer;
            if (wagered > 0) {
                recordRound('holdem', { wagered: wagered, returned: potBackToPlayer });
            }
            this._handStartChips = null;
        }

        this.revealBotCards();
        this.savePoints();
        this.updateDisplay();

        setTimeout(() => {
            if (this.playerObj.chips > 0) this.startNewGame();
            else this.resetGame();
        }, 4000);
    }

    compareHandScores(a, b) {
        if (!a) return -1;
        if (!b) return  1;
        if (a.rank !== b.rank) return a.rank - b.rank;
        for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
            const diff = (a.tiebreakers[i] || 0) - (b.tiebreakers[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    resetGame() {
        this.gameActive = false;
        this.disableActions(true);
        this.communityCards = [];
        this.pot            = 0;
        this.currentBet     = 0;
        this._actionLock    = false;

        for (const p of this.players) {
            p.hand   = [];
            p.bet    = 0;
            p.folded = false;
            if (p.id === 'player') {
                const pts = (typeof getPlayerPoints === 'function') ? getPlayerPoints() : 1000;
                p.chips    = pts;
                p.maxChips = pts;
            } else {
                p.chips    = Math.max(Math.floor(this.playerObj.chips * 0.5), 100);
                p.maxChips = p.chips;
            }
        }

        for (let i = 1; i <= 2; i++) {
            const el = document.getElementById(`playerCard${i}`);
            if (el) { el.textContent = ''; el.className = 'card card-empty'; }
        }
        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`communityCard${i}`);
            if (el) { el.textContent = ''; el.className = 'card card-empty'; }
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

    updateDisplay() {
        const potInfoEl = document.getElementById('potAmountInfo');
        const potChipEl = document.getElementById('potAmountChip');
        if (potInfoEl) potInfoEl.textContent = this.pot;
        if (potChipEl) potChipEl.textContent = this.pot;

        const potFallback = document.getElementById('potAmount');
        if (potFallback && !potInfoEl) potFallback.textContent = this.pot;

        const curBetEl = document.getElementById('currentBet');
        if (curBetEl) curBetEl.textContent = this.currentBet;

        const playerChipsInfoEl = document.getElementById('playerChipsInfo');
        if (playerChipsInfoEl) playerChipsInfoEl.textContent = this.playerObj.chips;

        const statusEl = document.getElementById('gameStatus');
        if (statusEl) statusEl.textContent = this.gameActive ? `Phase: ${this.phaseLabel()}` : 'Waiting…';

        const playerChipDenom = getChipDenomination(this.playerObj.chips);
        const playerDispEl    = document.getElementById('playerChipsDisplay');
        if (playerDispEl) {
            playerDispEl.textContent = this.playerObj.chips;
            if (playerDispEl.parentElement) playerDispEl.parentElement.className = `chip-stack chip-${playerChipDenom.color}`;
        }

        for (let i = 1; i < this.players.length; i++) {
            const bot     = this.players[i];
            const chipEl  = document.getElementById(`botChips${i}`);
            const stackEl = document.getElementById(`botChipStack${i}`);
            if (chipEl) {
                const denom = getChipDenomination(bot.chips);
                chipEl.textContent = bot.chips;
                if (stackEl) stackEl.className = `chip-stack chip-${denom.color}`;
            }
        }

        this.updateBotDisplays();
    }

    updateBotDisplays() {
        for (let i = 1; i <= 6; i++) {
            const bot      = this.players[i];
            const actionEl = document.getElementById(`botAction${i}`);
            const cardsEl  = document.getElementById(`botCards${i}`);
            if (actionEl) actionEl.textContent = bot.botAction || '';
            if (cardsEl)  cardsEl.classList.toggle('folded', bot.folded);
        }
    }

    revealBotCards() {
        for (let i = 1; i <= 6; i++) {
            const bot     = this.players[i];
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
        if (!el) return;
        el.textContent = text;
        el.classList.remove('active');
        void el.offsetWidth;
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.holdemGame = new TexasHoldemGame();
    window.holdemGame.updateDisplay();
});