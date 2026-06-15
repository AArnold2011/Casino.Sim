class BlackjackEngine {
    constructor() {
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.bet = 0;
        this.state = 'idle';
        this.points = typeof getPlayerPoints === 'function' ? getPlayerPoints() : 1000;
        this.dealDelay = 700;
        this.revealDelay = 650;
        this.dealerDrawDelay = 750;
        this.roundTimeout = null;

        this.elements = {
            betAmount: document.getElementById('betAmount'),
            dealBtn: document.getElementById('dealBtn'),
            hitBtn: document.getElementById('hitBtn'),
            standBtn: document.getElementById('standBtn'),
            newRoundBtn: document.getElementById('newRoundBtn'),
            statusMessage: document.getElementById('statusMessage'),
            currentBetValue: document.getElementById('currentBetValue'),
            playerCards: document.getElementById('playerCards'),
            dealerCards: document.getElementById('dealerCards'),
            playerTotal: document.getElementById('playerTotal'),
            dealerTotal: document.getElementById('dealerTotal')
        };

        this.bindEvents();
        this.refreshPoints();
        this.savePoints();
        this.render();
    }

    bindEvents() {
        this.elements.dealBtn.addEventListener('click', () => this.startRound());
        this.elements.hitBtn.addEventListener('click', () => this.hit());
        this.elements.standBtn.addEventListener('click', () => this.stand());
        this.elements.newRoundBtn.addEventListener('click', () => this.resetRound());
        this.elements.betAmount.addEventListener('input', () => this.clampBetInput());
    }

    // Pull the latest shared balance into this engine (used at startup so
    // points carried over from other games are reflected here).
    refreshPoints() {
        this.points = typeof getPlayerPoints === 'function' ? getPlayerPoints() : this.points;
    }

    // Persist this engine's current balance to the shared store. Must NOT
    // re-read first, or local changes (bets, winnings) would be discarded.
    savePoints() {
        if (typeof setPlayerPoints === 'function') {
            setPlayerPoints(this.points);
        }
    }

    clampBetInput() {
        const value = Math.max(1, Math.floor(Number(this.elements.betAmount.value) || 1));
        const maxBet = Math.max(1, this.points);
        this.elements.betAmount.value = String(Math.min(value, maxBet));
    }

    createDeck() {
        const suits = ['♠', '♣', '♥', '♦'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.deck = [];

        for (const suit of suits) {
            for (const rank of ranks) {
                this.deck.push({
                    suit,
                    rank,
                    color: suit === '♥' || suit === '♦' ? 'red' : 'black'
                });
            }
        }

        for (let index = this.deck.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [this.deck[index], this.deck[swapIndex]] = [this.deck[swapIndex], this.deck[index]];
        }
    }

    drawCard() {
        return this.deck.pop();
    }

    getCardValue(card) {
        if (card.rank === 'A') {
            return 11;
        }

        if (['K', 'Q', 'J'].includes(card.rank)) {
            return 10;
        }

        return Number(card.rank);
    }

    getHandValue(hand) {
        let total = 0;
        let aces = 0;

        for (const card of hand) {
            total += this.getCardValue(card);
            if (card.rank === 'A') {
                aces += 1;
            }
        }

        while (total > 21 && aces > 0) {
            total -= 10;
            aces -= 1;
        }

        return total;
    }

    isBlackjack(hand) {
        return hand.length === 2 && this.getHandValue(hand) === 21;
    }

    canAct() {
        return this.state === 'playerTurn';
    }

    startRound() {
        if (this.state === 'playerTurn' || this.state === 'dealerTurn') {
            return;
        }

        if (this.roundTimeout) {
            window.clearTimeout(this.roundTimeout);
            this.roundTimeout = null;
        }

        this.clampBetInput();
        const bet = Math.max(1, Math.floor(Number(this.elements.betAmount.value) || 0));

        if (bet > this.points) {
            this.setStatus('Bet cannot exceed your current points.');
            return;
        }

        this.bet = bet;
        this.points -= bet;
        this.savePoints();
        this.setStatus(`Bet ${bet} placed. ${this.points} points remaining.`);

        this.playerHand = [];
        this.dealerHand = [];
        this.createDeck();
        this.state = 'dealing';
        this.render();

        this.roundTimeout = window.setTimeout(() => {
            this.playerHand.push(this.drawCard());
            this.render();

            this.roundTimeout = window.setTimeout(() => {
                this.dealerHand.push(this.drawCard());
                this.render();

                this.roundTimeout = window.setTimeout(() => {
                    this.playerHand.push(this.drawCard());
                    this.render();

                    this.roundTimeout = window.setTimeout(() => {
                        this.dealerHand.push(this.drawCard());
                        this.state = 'playerTurn';
                        this.setStatus('Your move. Hit or stand.');
                        this.render();

                        if (this.isBlackjack(this.playerHand) || this.isBlackjack(this.dealerHand)) {
                            this.resolveNaturals();
                        }
                    }, this.dealDelay);
                }, this.dealDelay);
            }, this.dealDelay);
        }, this.dealDelay);
    }

    hit() {
        if (!this.canAct()) {
            return;
        }

        this.state = 'playerDrawing';
        this.setStatus('Drawing your card...');
        this.render();

        window.setTimeout(() => {
            this.playerHand.push(this.drawCard());
            const playerTotal = this.getHandValue(this.playerHand);

            if (playerTotal > 21) {
                this.setStatus('You busted. Dealer wins.');
                this.render();
                this.finishRound('bust');
                return;
            }

            this.state = 'playerTurn';
            this.setStatus(`You drew a card. Total: ${playerTotal}.`);
            this.render();
        }, this.revealDelay);
    }

    stand() {
        if (!this.canAct()) {
            return;
        }

        this.state = 'dealerTurn';
        this.setStatus('You stand. Dealer will draw to 17.');
        this.render();

        const dealerStep = () => {
            const dealerTotal = this.getHandValue(this.dealerHand);

            if (dealerTotal < 17) {
                this.dealerHand.push(this.drawCard());
                this.setStatus(`Dealer draws to ${this.getHandValue(this.dealerHand)}.`);
                this.render();
                this.roundTimeout = window.setTimeout(dealerStep, this.dealerDrawDelay);
                return;
            }

            this.setStatus(`Dealer stands on ${dealerTotal}.`);
            this.render();
            this.finishRound(this.getOutcome());
        };

        this.roundTimeout = window.setTimeout(dealerStep, this.dealerDrawDelay);
    }

    resolveNaturals() {
        this.state = 'dealerTurn';
        this.render();

        this.setStatus('Checking for blackjack...');

        this.roundTimeout = window.setTimeout(() => {
            const playerBlackjack = this.isBlackjack(this.playerHand);
            const dealerBlackjack = this.isBlackjack(this.dealerHand);

            if (playerBlackjack && dealerBlackjack) {
                this.finishRound('push', 'Both hands are blackjack. Push.');
                return;
            }

            if (playerBlackjack) {
                this.finishRound('blackjack');
                return;
            }

            if (dealerBlackjack) {
                this.finishRound('dealer-blackjack');
            }
        }, this.revealDelay);
    }

    getOutcome() {
        const playerTotal = this.getHandValue(this.playerHand);
        const dealerTotal = this.getHandValue(this.dealerHand);

        if (playerTotal > 21) {
            return 'bust';
        }

        if (dealerTotal > 21) {
            return 'dealer-bust';
        }

        if (playerTotal > dealerTotal) {
            return 'win';
        }

        if (playerTotal < dealerTotal) {
            return 'lose';
        }

        return 'push';
    }

    finishRound(result, customMessage = '') {
        if (this.roundTimeout) {
            window.clearTimeout(this.roundTimeout);
            this.roundTimeout = null;
        }

        const wagered = this.bet;
        let returned = 0;

        if (result === 'blackjack') {
            returned = Math.floor(this.bet * 2.5);
            this.points += returned;
            this.setStatus('Blackjack pays 3:2. You win.');
        } else if (result === 'dealer-bust' || result === 'win') {
            returned = this.bet * 2;
            this.points += returned;
            this.setStatus(result === 'dealer-bust' ? 'Dealer busts. You win.' : 'You win.');
        } else if (result === 'push') {
            returned = this.bet;
            this.points += returned;
            this.setStatus(customMessage || 'Push. Your bet is returned.');
        } else if (result === 'dealer-blackjack' || result === 'lose' || result === 'bust') {
            returned = 0;
            this.setStatus(
                result === 'dealer-blackjack' ? 'Dealer has blackjack. You lose.' :
                result === 'bust' ? 'You busted. Dealer wins.' :
                'Dealer wins.'
            );
        }

        if (wagered > 0 && typeof recordRound === 'function') {
            recordRound('blackjack', { wagered: wagered, returned: returned });
        }

        this.bet = 0;
        this.state = 'roundOver';
        this.savePoints();
        this.elements.betAmount.disabled = false;
        this.render();
    }

    resetRound() {
        if (this.roundTimeout) {
            window.clearTimeout(this.roundTimeout);
            this.roundTimeout = null;
        }

        this.playerHand = [];
        this.dealerHand = [];
        this.bet = 0;
        this.state = 'idle';
        this.setStatus('Place a bet and deal a hand.');
        this.render();
    }

    setStatus(message) {
        this.elements.statusMessage.textContent = message;
    }

    renderCard(card, faceDown = false) {
        const cardElement = document.createElement('div');
        cardElement.className = faceDown ? 'card face-down' : `card face-up ${card.color}`;

        if (!faceDown) {
            cardElement.textContent = `${card.rank}${card.suit}`;
            cardElement.classList.add('revealed');
        }

        return cardElement;
    }

    renderHand(container, hand, hideFirstCard) {
        container.innerHTML = '';

        hand.forEach((card, index) => {
            const faceDown = hideFirstCard && index === 1 && this.state !== 'roundOver';
            container.appendChild(this.renderCard(card, faceDown));
        });
    }

    updateButtons() {
        const inRound = this.state === 'playerTurn' || this.state === 'dealerTurn' || this.state === 'playerDrawing' || this.state === 'dealing';
        this.elements.dealBtn.disabled = inRound;
        this.elements.hitBtn.disabled = this.state !== 'playerTurn';
        this.elements.standBtn.disabled = this.state !== 'playerTurn';
        this.elements.newRoundBtn.disabled = this.state === 'idle' || this.state === 'dealing' || this.state === 'playerTurn' || this.state === 'dealerTurn' || this.state === 'playerDrawing';
        this.elements.betAmount.disabled = this.state === 'dealing' || this.state === 'playerDrawing' || this.state === 'dealerTurn';
    }

    render() {
        this.elements.currentBetValue.textContent = String(this.bet);
        this.elements.playerTotal.textContent = String(this.getHandValue(this.playerHand));

        const dealerShouldHideCard = this.state === 'playerTurn' || this.state === 'dealing';
        const dealerTotal = dealerShouldHideCard && this.dealerHand.length > 0
            ? this.getCardValue(this.dealerHand[0])
            : this.getHandValue(this.dealerHand);

        this.elements.dealerTotal.textContent = String(dealerTotal);

        this.renderHand(this.elements.playerCards, this.playerHand, false);
        this.renderHand(this.elements.dealerCards, this.dealerHand, dealerShouldHideCard);
        this.updateButtons();

        if (typeof updateSharedPointsDisplay === 'function') {
            updateSharedPointsDisplay(this.points);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.blackjackGame = new BlackjackEngine();
});