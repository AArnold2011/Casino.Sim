class BaccaratEngine {
    constructor() {
        this.deck = [];
        this.playerHand = [];
        this.bankerHand = [];
        this.bet = 0;
        this.betTarget = '';
        this.state = 'idle';
        this.points = typeof getPlayerPoints === 'function' ? getPlayerPoints() : 1000;
        this.dealDelay = 480;
        this.roundTimeout = null;

        this.stats = { player: 0, banker: 0, tie: 0, rounds: 0 };

        this.elements = {
            betAmount:       document.getElementById('betAmount'),
            dealBtn:         document.getElementById('dealBtn'),
            newRoundBtn:     document.getElementById('newRoundBtn'),
            statusMessage:   document.getElementById('statusMessage'),
            currentBetValue: document.getElementById('currentBetValue'),
            betTargetValue:  document.getElementById('betTargetValue'),
            playerCards:     document.getElementById('playerCards'),
            bankerCards:     document.getElementById('bankerCards'),
            playerScore:     document.getElementById('playerScore'),
            bankerScore:     document.getElementById('bankerScore'),
            playerNatural:   document.getElementById('playerNatural'),
            bankerNatural:   document.getElementById('bankerNatural'),
            statPlayer:      document.getElementById('statPlayer'),
            statBanker:      document.getElementById('statBanker'),
            statTie:         document.getElementById('statTie'),
            statRounds:      document.getElementById('statRounds'),
            betPlayer:       document.getElementById('betTargetPlayer'),
            betBanker:       document.getElementById('betTargetBanker'),
            betTie:          document.getElementById('betTargetTie'),
        };

        this.bindEvents();
        this.syncPoints();
        this.render();
    }

    bindEvents() {
        this.elements.dealBtn.addEventListener('click',     () => this.startRound());
        this.elements.newRoundBtn.addEventListener('click', () => this.resetRound());
        this.elements.betAmount.addEventListener('input',   () => this.clampBetInput());

        this.elements.betPlayer.addEventListener('click', () => this.selectTarget('player'));
        this.elements.betBanker.addEventListener('click', () => this.selectTarget('banker'));
        this.elements.betTie.addEventListener('click',    () => this.selectTarget('tie'));
    }

    syncPoints() {
        this.points = typeof getPlayerPoints === 'function' ? getPlayerPoints() : this.points;
        if (typeof setPlayerPoints === 'function') setPlayerPoints(this.points);
    }

    clampBetInput() {
        const value = Math.max(1, Math.floor(Number(this.elements.betAmount.value) || 1));
        this.elements.betAmount.value = String(Math.min(value, Math.max(1, this.points)));
    }

    selectTarget(target) {
        if (this.state !== 'idle' && this.state !== 'roundOver') return;
        this.betTarget = target;
        this.elements.betPlayer.className = 'bet-target-btn' + (target === 'player' ? ' active-player' : '');
        this.elements.betBanker.className = 'bet-target-btn' + (target === 'banker' ? ' active-banker' : '');
        this.elements.betTie.className    = 'bet-target-btn' + (target === 'tie'    ? ' active-tie'    : '');
        const labels = { player: 'Player', banker: 'Banker', tie: 'Tie' };
        this.elements.betTargetValue.textContent = labels[target];
    }

    createDeck() {
        const suits = ['♠', '♣', '♥', '♦'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        this.deck = [];
        for (let d = 0; d < 6; d++) {
            for (const suit of suits) {
                for (const rank of ranks) {
                    this.deck.push({
                        suit,
                        rank,
                        color: (suit === '♥' || suit === '♦') ? 'red' : 'black'
                    });
                }
            }
        }
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    drawCard() { return this.deck.pop(); }

    cardValue(card) {
        if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
        if (card.rank === 'A') return 1;
        return Number(card.rank);
    }

    handTotal(hand) {
        return hand.reduce((sum, c) => sum + this.cardValue(c), 0) % 10;
    }

    isNatural(hand) {
        return hand.length === 2 && this.handTotal(hand) >= 8;
    }

    playerDrawsThird(playerTotal) {
        return playerTotal <= 5;
    }

    bankerDrawsThird(bankerTotal, playerThirdCard) {
        if (playerThirdCard === null) return bankerTotal <= 5;
        const p = this.cardValue(playerThirdCard);
        if (bankerTotal <= 2) return true;
        if (bankerTotal === 3) return p !== 8;
        if (bankerTotal === 4) return p >= 2 && p <= 7;
        if (bankerTotal === 5) return p >= 4 && p <= 7;
        if (bankerTotal === 6) return p === 6 || p === 7;
        return false;
    }

    startRound() {
        if (this.state === 'dealing' || this.state === 'resolving') return;
        if (this.roundTimeout) { window.clearTimeout(this.roundTimeout); this.roundTimeout = null; }

        if (!this.betTarget) {
            this.setStatus('Choose Player, Banker, or Tie before dealing.');
            return;
        }

        this.clampBetInput();
        const bet = Math.max(1, Math.floor(Number(this.elements.betAmount.value) || 0));
        if (bet > this.points) {
            this.setStatus('Bet cannot exceed your current points.');
            return;
        }

        this.bet = bet;
        this.points -= bet;
        this.syncPoints();

        this.playerHand = [];
        this.bankerHand = [];
        this.state = 'dealing';
        this.setStatus('Dealing…');
        this.render();
        this.createDeck();

        const seq = [
            () => { this.playerHand.push(this.drawCard()); this.render(); },
            () => { this.bankerHand.push(this.drawCard()); this.render(); },
            () => { this.playerHand.push(this.drawCard()); this.render(); },
            () => { this.bankerHand.push(this.drawCard()); this.render(); },
            () => this.resolveNaturalsOrDraw(),
        ];

        seq.slice(0, 4).forEach((fn, i) => {
            this.roundTimeout = window.setTimeout(fn, this.dealDelay * (i + 1));
        });
        this.roundTimeout = window.setTimeout(seq[4], this.dealDelay * 5);
    }

    resolveNaturalsOrDraw() {
        const pt = this.handTotal(this.playerHand);
        const bt = this.handTotal(this.bankerHand);

        if (this.isNatural(this.playerHand) || this.isNatural(this.bankerHand)) {
            this.state = 'resolving';
            this.setStatus('Natural! Revealing result…');
            this.render();
            this.roundTimeout = window.setTimeout(() => this.finishRound(), this.dealDelay * 2);
            return;
        }

        let playerThird = null;

        if (this.playerDrawsThird(pt)) {
            this.roundTimeout = window.setTimeout(() => {
                playerThird = this.drawCard();
                this.playerHand.push(playerThird);
                this.state = 'resolving';
                this.render();

                const shouldBankerDraw = this.bankerDrawsThird(bt, playerThird);
                if (shouldBankerDraw) {
                    this.roundTimeout = window.setTimeout(() => {
                        this.bankerHand.push(this.drawCard());
                        this.render();
                        this.roundTimeout = window.setTimeout(() => this.finishRound(), this.dealDelay);
                    }, this.dealDelay);
                } else {
                    this.roundTimeout = window.setTimeout(() => this.finishRound(), this.dealDelay);
                }
            }, this.dealDelay);
        } else {
            if (this.bankerDrawsThird(bt, null)) {
                this.roundTimeout = window.setTimeout(() => {
                    this.bankerHand.push(this.drawCard());
                    this.state = 'resolving';
                    this.render();
                    this.roundTimeout = window.setTimeout(() => this.finishRound(), this.dealDelay);
                }, this.dealDelay);
            } else {
                this.state = 'resolving';
                this.render();
                this.roundTimeout = window.setTimeout(() => this.finishRound(), this.dealDelay * 2);
            }
        }
    }

    finishRound() {
        const pt = this.handTotal(this.playerHand);
        const bt = this.handTotal(this.bankerHand);
        this.stats.rounds++;

        let outcome;
        if (pt > bt) outcome = 'player';
        else if (bt > pt) outcome = 'banker';
        else outcome = 'tie';

        this.stats[outcome]++;

        let winnings = 0;
        let msg = '';

        if (outcome === this.betTarget) {
            if (outcome === 'player') { winnings = this.bet * 2; msg = `Player wins ${pt} vs ${bt}. You win ${this.bet}!`; }
            else if (outcome === 'banker') {
                const profit = Math.floor(this.bet * 0.95);
                winnings = this.bet + profit;
                msg = `Banker wins ${bt} vs ${pt}. You win ${profit}! (5% commission)`;
            } else {
                winnings = this.bet * 9;
                msg = `Tie! Both scored ${pt}. You win ${this.bet * 8}!`;
            }
        } else if (outcome === 'tie' && this.betTarget !== 'tie') {
            winnings = this.bet;
            msg = `Tie (${pt} each). Bet returned.`;
        } else {
            const winner = outcome === 'player' ? `Player ${pt}` : `Banker ${bt}`;
            msg = `${winner} wins. You lose.`;
        }

        this.points += winnings;
        this.syncPoints();
        this.setStatus(msg);
        this.state = 'roundOver';
        this.render();
        this.updateStats();
    }

    resetRound() {
        if (this.roundTimeout) { window.clearTimeout(this.roundTimeout); this.roundTimeout = null; }
        this.playerHand = [];
        this.bankerHand = [];
        this.bet = 0;
        this.state = 'idle';
        this.setStatus('Place a bet and deal.');
        this.render();
    }

    setStatus(msg) { this.elements.statusMessage.textContent = msg; }

    renderCard(card) {
        const el = document.createElement('div');
        el.className = `card face-up ${card.color} revealed`;
        el.textContent = `${card.rank}${card.suit}`;
        return el;
    }

    renderHand(container, hand) {
        container.innerHTML = '';
        hand.forEach(card => container.appendChild(this.renderCard(card)));
    }

    updateStats() {
        this.elements.statPlayer.textContent = this.stats.player;
        this.elements.statBanker.textContent = this.stats.banker;
        this.elements.statTie.textContent    = this.stats.tie;
        this.elements.statRounds.textContent = this.stats.rounds;
    }

    render() {
        const pt = this.handTotal(this.playerHand);
        const bt = this.handTotal(this.bankerHand);

        this.elements.currentBetValue.textContent = String(this.bet);
        this.elements.playerScore.textContent = this.playerHand.length ? String(pt) : '-';
        this.elements.bankerScore.textContent = this.bankerHand.length ? String(bt) : '-';

        this.renderHand(this.elements.playerCards, this.playerHand);
        this.renderHand(this.elements.bankerCards, this.bankerHand);

        const playerNat = this.isNatural(this.playerHand);
        const bankerNat = this.isNatural(this.bankerHand);
        this.elements.playerNatural.classList.toggle('visible', playerNat);
        this.elements.bankerNatural.classList.toggle('visible', bankerNat);
        this.elements.playerNatural.textContent = playerNat ? 'Natural ' + pt : '';
        this.elements.bankerNatural.textContent = bankerNat ? 'Natural ' + bt : '';

        const inRound = this.state === 'dealing' || this.state === 'resolving';
        this.elements.dealBtn.disabled     = inRound;
        this.elements.newRoundBtn.disabled = this.state === 'idle' || inRound;
        this.elements.betAmount.disabled   = inRound;
        this.elements.betPlayer.disabled   = inRound;
        this.elements.betBanker.disabled   = inRound;
        this.elements.betTie.disabled      = inRound;

        if (typeof updateSharedPointsDisplay === 'function') {
            updateSharedPointsDisplay(this.points);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.baccaratGame = new BaccaratEngine();
});
