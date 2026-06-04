// Texas Hold'em Poker Game Engine

// Chip denomination system
const CHIP_VALUES = [
    { value: 5000, color: 'brown', name: '$5,000' },
    { value: 2000, color: 'light-blue', name: '$2,000' },
    { value: 1000, color: 'yellow', name: '$1,000' },
    { value: 500, color: 'purple', name: '$500' },
    { value: 250, color: 'pink', name: '$250' },
    { value: 100, color: 'black', name: '$100' },
    { value: 50, color: 'orange', name: '$50' },
    { value: 25, color: 'green', name: '$25' },
    { value: 20, color: 'grey', name: '$20' },
    { value: 10, color: 'blue', name: '$10' },
    { value: 5, color: 'red', name: '$5' },
    { value: 1, color: 'white', name: '$1' }
];

function getChipDenomination(amount) {
    // Return the highest denomination chip that fits in the amount
    for (let chip of CHIP_VALUES) {
        if (amount >= chip.value) {
            return {
                value: chip.value,
                color: chip.color,
                name: chip.name,
                quantity: Math.floor(amount / chip.value)
            };
        }
    }
    return {
        value: 1,
        color: 'white',
        name: '$1',
        quantity: amount
    };
}

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
        this.dealerIndex = 5; // Dealer position (always Bot 6)
        this.smallBlindIndex = 0; // Player starts as small blind
        this.bigBlindIndex = 1; // Bot 1 starts as big blind
        this.gameRound = 0;
        this.initializePlayers();
        this.setupEventListeners();
        this.loadPlayerPoints();
    }

    loadPlayerPoints() {
        // Get persistent points from PointsManager
        if (typeof getPlayerPoints === 'function') {
            this.playerChips = getPlayerPoints();
        } else {
            this.playerChips = 1000;
        }
        
        // Reset player
        this.players[0].chips = this.playerChips;
        this.players[0].maxChips = this.playerChips;
        
        // Scale bot chips to player chips (50% of player chips each)
        const botStartChips = Math.floor(this.playerChips * 0.5);
        for (let i = 1; i < this.players.length; i++) {
            this.players[i].chips = botStartChips;
            this.players[i].maxChips = botStartChips;
        }
        
        this.updateDisplay();
    }

    initializePlayers() {
        this.players = [];
        
        // Create player (human)
        this.players.push({
            id: 'player',
            name: 'You',
            chips: this.playerChips,
            maxChips: this.playerChips,
            hand: [],
            bet: 0,
            folded: false,
            isBot: false,
            isDealer: false
        });

        // Create 6 bots
        for (let i = 1; i <= 6; i++) {
            this.players.push({
                id: `bot${i}`,
                name: `Bot ${i}`,
                chips: 500,
                maxChips: 500,
                hand: [],
                bet: 0,
                folded: false,
                isBot: true,
                isDealer: i === 6
            });
        }
    }

    setupEventListeners() {
        document.getElementById('betBtn').addEventListener('click', () => this.openBetModal());
        document.getElementById('checkBtn').addEventListener('click', () => this.checkAction());
        document.getElementById('foldBtn').addEventListener('click', () => this.foldAction());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startNewGame());
        document.getElementById('resetGameBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('confirmBetBtn').addEventListener('click', () => this.placeBet());
        document.getElementById('cancelBetBtn').addEventListener('click', () => this.closeBetModal());
    }

    createDeck() {
        const suits = ['♠', '♣', '♥', '♦'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const suitNames = ['spades', 'clubs', 'hearts', 'diamonds'];
        const rankValues = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
            'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };

        this.deck = [];
        for (let i = 0; i < suits.length; i++) {
            for (let j = 0; j < ranks.length; j++) {
                this.deck.push({
                    suit: suits[i],
                    suitName: suitNames[i],
                    rank: ranks[j],
                    value: rankValues[ranks[j]],
                    display: `${ranks[j]}${suits[i]}`
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

    dealHoleCards() {
        // Deal clockwise starting from player (position 0)
        // Clockwise order: Player, Bot6, Bot1, Bot2, Bot3, Bot4, Bot5
        const dealOrder = [0, 6, 1, 2, 3, 4, 5];
        const cardDelay = 200; // Delay between each card being dealt
        
        dealOrder.forEach((playerIndex, cardNum) => {
            setTimeout(() => {
                if (cardNum < dealOrder.length) {
                    const card = this.deck.pop();
                    this.players[playerIndex].hand.push(card);
                    this.animateDealCard(playerIndex, cardNum % 2);
                }
            }, cardNum * cardDelay);
        });

        // Deal second round
        dealOrder.forEach((playerIndex, cardNum) => {
            setTimeout(() => {
                const card = this.deck.pop();
                this.players[playerIndex].hand.push(card);
                this.animateDealCard(playerIndex, 1);
            }, (dealOrder.length + cardNum) * cardDelay);
        });

        // Display player cards after dealing
        setTimeout(() => this.displayPlayerCards(), dealOrder.length * 2 * cardDelay + 500);
    }

    animateDealCard(playerIndex, cardPosition) {
        // Add animation effect for card being dealt
        const player = this.players[playerIndex];
        if (playerIndex === 0 || !player.isBot) {
            const cardElement = cardPosition === 0 ? 
                document.getElementById('playerCard1') : 
                document.getElementById('playerCard2');
            if (cardElement) {
                cardElement.classList.add('card-dealing');
                setTimeout(() => cardElement.classList.remove('card-dealing'), 400);
            }
        } else {
            const botCardElement = document.getElementById(`botCards${playerIndex}`);
            if (botCardElement) {
                const cards = botCardElement.querySelectorAll('.card');
                if (cards[cardPosition]) {
                    cards[cardPosition].classList.add('card-dealing');
                    setTimeout(() => cards[cardPosition].classList.remove('card-dealing'), 400);
                }
            }
        }
    }

    displayPlayerCards() {
        const playerCard1 = document.getElementById('playerCard1');
        const playerCard2 = document.getElementById('playerCard2');
        const playerHand = this.players[0].hand;

        if (playerHand.length >= 2) {
            playerCard1.textContent = playerHand[0].display;
            playerCard1.className = 'card card-revealed ' + (playerHand[0].suitName === 'hearts' || playerHand[0].suitName === 'diamonds' ? 'red' : 'black');

            playerCard2.textContent = playerHand[1].display;
            playerCard2.className = 'card card-revealed ' + (playerHand[1].suitName === 'hearts' || playerHand[1].suitName === 'diamonds' ? 'red' : 'black');
        }
    }

    dealCommunityCards(count) {
        const startIndex = this.communityCards.length;
        const dealDelay = 300; // Delay between community card flips
        
        for (let i = 0; i < count; i++) {
            if (this.communityCards.length < 5) {
                this.communityCards.push(this.deck.pop());
            }
        }

        // Animate community cards with flip
        this.communityCards.forEach((card, index) => {
            if (index >= startIndex) {
                setTimeout(() => this.revealCommunityCard(index), (index - startIndex) * dealDelay);
            }
        });
    }

    revealCommunityCard(index) {
        const card = this.communityCards[index];
        const cardElement = document.getElementById(`communityCard${index + 1}`);
        
        if (cardElement && card) {
            cardElement.classList.add('card-flip');
            setTimeout(() => {
                cardElement.textContent = card.display;
                cardElement.className = 'card card-revealed ' + (card.suitName === 'hearts' || card.suitName === 'diamonds' ? 'red' : 'black');
            }, 250);
        }
    }

    rotateBlind() {
        // Rotate blinds clockwise: Player (0) -> Bot6 (6) -> Bot1 (1) -> Bot2 (2) -> Bot3 (3) -> Bot4 (4) -> Bot5 (5) -> Player
        this.smallBlindIndex = (this.smallBlindIndex + 1) % 7;
        this.bigBlindIndex = (this.bigBlindIndex + 1) % 7;
    }

    updateBlindDisplay() {
        // Clear all blind indicators
        for (let i = 0; i < this.players.length; i++) {
            const blindElement = i === 0 ? 
                document.getElementById('playerBlind') : 
                document.getElementById(`botBlind${i}`);
            if (blindElement) {
                blindElement.textContent = '';
                blindElement.className = 'blind-indicator';
            }
        }

        // Set small blind
        const smallBlindElement = this.smallBlindIndex === 0 ? 
            document.getElementById('playerBlind') : 
            document.getElementById(`botBlind${this.smallBlindIndex}`);
        if (smallBlindElement) {
            smallBlindElement.textContent = 'SB';
            smallBlindElement.classList.add('small-blind');
        }

        // Set big blind
        const bigBlindElement = this.bigBlindIndex === 0 ? 
            document.getElementById('playerBlind') : 
            document.getElementById(`botBlind${this.bigBlindIndex}`);
        if (bigBlindElement) {
            bigBlindElement.textContent = 'BB';
            bigBlindElement.classList.add('big-blind');
        }
    }

    startNewGame() {
        this.gameActive = true;
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.gamePhase = 'preFlop';
        this.gameRound++;

        // Rotate blinds
        this.rotateBlind();

        // Reset all players
        for (let player of this.players) {
            player.hand = [];
            player.bet = 0;
            player.folded = false;
            if (player.chips <= 0) {
                player.chips = this.playerChips * 0.5;
                player.maxChips = player.chips;
            }
        }

        this.createDeck();
        this.updateBlindDisplay();
        
        // Clear community cards
        for (let i = 1; i <= 5; i++) {
            const cardElement = document.getElementById(`communityCard${i}`);
            cardElement.textContent = '';
            cardElement.className = 'card card-empty';
        }

        this.updateDisplay();
        this.showMessage('New game started! Dealing cards...');
        
        // Deal cards with animation
        setTimeout(() => this.dealHoleCards(), 500);

        // Start betting after dealing
        setTimeout(() => {
            this.startBettingRound();
        }, 3500);
    }

    startBettingRound() {
        this.currentBet = 0;
        const activePlayers = this.players.filter(p => !p.folded && p.chips > 0);
        
        if (activePlayers.length <= 1) {
            this.endHand();
            return;
        }

        const playerIndex = this.players.findIndex(p => p.id === 'player' && !p.folded);
        
        if (playerIndex !== -1 && this.players[playerIndex].chips > 0) {
            this.currentPlayerTurn = playerIndex;
            this.enablePlayerActions();
        } else {
            this.endBettingRound();
        }
    }

    enablePlayerActions() {
        const player = this.players[0];
        if (player.chips > 0 && !player.folded) {
            document.getElementById('betBtn').disabled = false;
            document.getElementById('checkBtn').disabled = false;
            document.getElementById('foldBtn').disabled = false;
        }
    }

    disableActions(disable) {
        document.getElementById('betBtn').disabled = disable;
        document.getElementById('checkBtn').disabled = disable;
        document.getElementById('foldBtn').disabled = disable;
    }

    openBetModal() {
        const betModal = document.getElementById('betModal');
        const betInput = document.getElementById('betInput');
        const player = this.players[0];

        betInput.max = player.chips;
        betInput.placeholder = `Max: ${player.chips}`;
        betInput.value = '';
        betModal.classList.add('active');
        betInput.focus();
    }

    closeBetModal() {
        document.getElementById('betModal').classList.remove('active');
    }

    placeBet() {
        const betInput = document.getElementById('betInput');
        const betAmount = parseInt(betInput.value);
        const player = this.players[0];

        if (isNaN(betAmount) || betAmount < 1 || betAmount > player.chips) {
            alert('Invalid bet amount');
            return;
        }

        player.chips -= betAmount;
        player.bet = betAmount;
        this.pot += betAmount;
        this.currentBet = betAmount;

        this.closeBetModal();
        this.updateDisplay();
        this.showMessage(`You bet ${betAmount} chips`);
        this.disableActions(true);

        // Simulate bot actions
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
            const activePlayers = this.players.filter(p => !p.folded);
            if (activePlayers.length === 1) {
                this.endHand();
            } else {
                this.executeBotActions();
            }
        }, 1000);
    }

    executeBotActions() {
        let actedCount = 0;
        const botsToAct = this.players.filter((p, i) => i !== 0 && !p.folded && p.chips > 0).length;

        for (let i = 1; i < this.players.length; i++) {
            const bot = this.players[i];
            if (!bot.folded && bot.chips > 0) {
                setTimeout(() => {
                    const action = this.determineBotAction(bot);
                    
                    if (action === 'fold') {
                        bot.folded = true;
                        this.showMessage(`${bot.name} folded`);
                    } else if (action === 'bet') {
                        const betAmount = Math.min(Math.floor(Math.random() * bot.chips * 0.3) + 10, bot.chips);
                        bot.chips -= betAmount;
                        bot.bet = betAmount;
                        this.pot += betAmount;
                        this.currentBet = Math.max(this.currentBet, betAmount);
                        this.showMessage(`${bot.name} bet ${betAmount}`);
                    } else if (action === 'check') {
                        this.showMessage(`${bot.name} checked`);
                    }
                    
                    this.updateDisplay();
                    actedCount++;

                    if (actedCount === botsToAct) {
                        setTimeout(() => this.advanceGamePhase(), 800);
                    }
                }, (i - 1) * 800);
            }
        }
    }

    determineBotAction(bot) {
        const handStrength = Math.random();
        
        if (handStrength < 0.3) {
            return 'fold';
        } else if (handStrength < 0.7) {
            return bot.bet === 0 ? 'check' : 'fold';
        } else {
            return 'bet';
        }
    }

    advanceGamePhase() {
        if (this.gamePhase === 'preFlop') {
            this.gamePhase = 'flop';
            this.showMessage('Flop revealed!');
            setTimeout(() => this.dealCommunityCards(3), 500);
            setTimeout(() => this.startBettingRound(), 2500);
        } else if (this.gamePhase === 'flop') {
            this.gamePhase = 'turn';
            this.showMessage('Turn revealed!');
            setTimeout(() => this.dealCommunityCards(1), 500);
            setTimeout(() => this.startBettingRound(), 1500);
        } else if (this.gamePhase === 'turn') {
            this.gamePhase = 'river';
            this.showMessage('River revealed!');
            setTimeout(() => this.dealCommunityCards(1), 500);
            setTimeout(() => this.startBettingRound(), 1500);
        } else if (this.gamePhase === 'river') {
            this.endHand();
        }
    }

    endHand() {
        const activePlayers = this.players.filter(p => !p.folded);
        let winner = null;

        if (activePlayers.length === 1) {
            winner = activePlayers[0];
        } else {
            // Simplified - just pick first active player
            winner = activePlayers[0];
        }

        if (winner) {
            winner.chips += this.pot;
            this.showMessage(`${winner.name} wins ${this.pot} chips!`);
        }

        this.gameActive = false;
        this.disableActions(true);
        this.playerChips = this.players[0].chips;
        
        // Save points back to PointsManager
        if (typeof setPlayerPoints === 'function') {
            setPlayerPoints(this.playerChips);
        }
        
        this.updateDisplay();

        setTimeout(() => {
            if (this.players[0].chips > 0) {
                this.startNewGame();
            } else {
                this.resetGame();
            }
        }, 2500);
    }

    endBettingRound() {
        const activePlayers = this.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            this.endHand();
        } else {
            this.advanceGamePhase();
        }
    }

    resetGame() {
        this.gameActive = false;
        this.disableActions(true);
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;

        // Reset all players
        for (let player of this.players) {
            player.hand = [];
            player.bet = 0;
            player.folded = false;
            if (player.id === 'player') {
                player.chips = this.playerChips;
                player.maxChips = this.playerChips;
            } else {
                player.chips = Math.floor(this.playerChips * 0.5);
                player.maxChips = player.chips;
            }
        }

        // Clear all cards
        for (let i = 1; i <= 2; i++) {
            const cardElement = document.getElementById(`playerCard${i}`);
            cardElement.textContent = '';
            cardElement.className = 'card card-empty';
        }

        for (let i = 1; i <= 5; i++) {
            const cardElement = document.getElementById(`communityCard${i}`);
            cardElement.textContent = '';
            cardElement.className = 'card card-empty';
        }

        // Clear bot cards and blinds
        for (let i = 1; i <= 6; i++) {
            const botCardsElement = document.getElementById(`botCards${i}`);
            botCardsElement.innerHTML = '<div class="card card-back"></div><div class="card card-back"></div>';
            const blindElement = document.getElementById(`botBlind${i}`);
            if (blindElement) {
                blindElement.textContent = '';
                blindElement.className = 'blind-indicator';
            }
        }

        const playerBlind = document.getElementById('playerBlind');
        if (playerBlind) {
            playerBlind.textContent = '';
            playerBlind.className = 'blind-indicator';
        }

        this.updateDisplay();
        this.showMessage('Game reset. Click "Start New Game" to begin.');
    }

    updateDisplay() {
        // Update pot and game info
        document.getElementById('potAmount').textContent = this.pot;
        document.getElementById('currentBet').textContent = this.currentBet;
        document.getElementById('playerChips').textContent = this.playerChips;
        
        // Update player chip stack with denomination
        const playerChipStack = document.getElementById('playerChipStack');
        const playerChipsAmount = document.getElementById('playerChipsDisplay');
        const playerChipDenom = getChipDenomination(this.players[0].chips);
        
        playerChipsAmount.textContent = this.players[0].chips;
        playerChipsAmount.parentElement.className = `chip-stack chip-${playerChipDenom.color}`;

        // Update bot displays with chip denominations
        for (let i = 1; i < this.players.length; i++) {
            const bot = this.players[i];
            const chipElement = document.getElementById(`botChips${i}`);
            const chipStack = document.getElementById(`botChipStack${i}`);
            
            if (chipElement) {
                const botChipDenom = getChipDenomination(bot.chips);
                chipElement.textContent = bot.chips;
                chipStack.className = `chip-stack chip-${botChipDenom.color}`;
            }
        }

        document.getElementById('gameStatus').textContent = this.gameActive ? `Phase: ${this.gamePhase}` : 'Waiting for game to start...';
    }

    showMessage(text) {
        const messageElement = document.getElementById('gameMessage');
        messageElement.textContent = text;
        messageElement.classList.remove('active');
        // Force reflow to restart animation
        void messageElement.offsetWidth;
        messageElement.classList.add('active');

        setTimeout(() => {
            messageElement.classList.remove('active');
        }, 5000);
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new TexasHoldemGame();
    game.updateDisplay();
});
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
        this.dealerIndex = 5; // Dealer position (always Bot 6)
        this.smallBlindIndex = 0; // Player starts as small blind
        this.bigBlindIndex = 1; // Bot 1 starts as big blind
        this.gameRound = 0;
        this.initializePlayers();
        this.setupEventListeners();
        this.loadPlayerPoints();
    }

    loadPlayerPoints() {
        // Get persistent points from PointsManager
        if (typeof getPlayerPoints === 'function') {
            this.playerChips = getPlayerPoints();
        } else {
            this.playerChips = 1000;
        }
        
        // Reset player
        this.players[0].chips = this.playerChips;
        this.players[0].maxChips = this.playerChips;
        
        // Scale bot chips to player chips (50% of player chips each)
        const botStartChips = Math.floor(this.playerChips * 0.5);
        for (let i = 1; i < this.players.length; i++) {
            this.players[i].chips = botStartChips;
            this.players[i].maxChips = botStartChips;
        }
        
        this.updateDisplay();
    }

    initializePlayers() {
        this.players = [];
        
        // Create player (human)
        this.players.push({
            id: 'player',
            name: 'You',
            chips: this.playerChips,
            maxChips: this.playerChips,
            hand: [],
            bet: 0,
            folded: false,
            isBot: false,
            isDealer: false
        });

        // Create 6 bots
        for (let i = 1; i <= 6; i++) {
            this.players.push({
                id: `bot${i}`,
                name: `Bot ${i}`,
                chips: 500,
                maxChips: 500,
                hand: [],
                bet: 0,
                folded: false,
                isBot: true,
                isDealer: i === 6
            });
        }
    }

    setupEventListeners() {
        document.getElementById('betBtn').addEventListener('click', () => this.openBetModal());
        document.getElementById('checkBtn').addEventListener('click', () => this.checkAction());
        document.getElementById('foldBtn').addEventListener('click', () => this.foldAction());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startNewGame());
        document.getElementById('resetGameBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('confirmBetBtn').addEventListener('click', () => this.placeBet());
        document.getElementById('cancelBetBtn').addEventListener('click', () => this.closeBetModal());
    }

    createDeck() {
        const suits = ['♠', '♣', '♥', '♦'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const suitNames = ['spades', 'clubs', 'hearts', 'diamonds'];
        const rankValues = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
            'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };

        this.deck = [];
        for (let i = 0; i < suits.length; i++) {
            for (let j = 0; j < ranks.length; j++) {
                this.deck.push({
                    suit: suits[i],
                    suitName: suitNames[i],
                    rank: ranks[j],
                    value: rankValues[ranks[j]],
                    display: `${ranks[j]}${suits[i]}`
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

    dealHoleCards() {
        // Deal clockwise starting from player (position 0)
        // Clockwise order: Player, Bot6, Bot1, Bot2, Bot3, Bot4, Bot5
        const dealOrder = [0, 6, 1, 2, 3, 4, 5];
        const cardDelay = 200; // Delay between each card being dealt
        
        dealOrder.forEach((playerIndex, cardNum) => {
            setTimeout(() => {
                if (cardNum < dealOrder.length) {
                    const card = this.deck.pop();
                    this.players[playerIndex].hand.push(card);
                    this.animateDealCard(playerIndex, cardNum % 2);
                }
            }, cardNum * cardDelay);
        });

        // Deal second round
        dealOrder.forEach((playerIndex, cardNum) => {
            setTimeout(() => {
                const card = this.deck.pop();
                this.players[playerIndex].hand.push(card);
                this.animateDealCard(playerIndex, 1);
            }, (dealOrder.length + cardNum) * cardDelay);
        });

        // Display player cards after dealing
        setTimeout(() => this.displayPlayerCards(), dealOrder.length * 2 * cardDelay + 500);
    }

    animateDealCard(playerIndex, cardPosition) {
        // Add animation effect for card being dealt
        const player = this.players[playerIndex];
        if (playerIndex === 0 || !player.isBot) {
            const cardElement = cardPosition === 0 ? 
                document.getElementById('playerCard1') : 
                document.getElementById('playerCard2');
            if (cardElement) {
                cardElement.classList.add('card-dealing');
                setTimeout(() => cardElement.classList.remove('card-dealing'), 400);
            }
        } else {
            const botCardElement = document.getElementById(`botCards${playerIndex}`);
            if (botCardElement) {
                const cards = botCardElement.querySelectorAll('.card');
                if (cards[cardPosition]) {
                    cards[cardPosition].classList.add('card-dealing');
                    setTimeout(() => cards[cardPosition].classList.remove('card-dealing'), 400);
                }
            }
        }
    }

    displayPlayerCards() {
        const playerCard1 = document.getElementById('playerCard1');
        const playerCard2 = document.getElementById('playerCard2');
        const playerHand = this.players[0].hand;

        if (playerHand.length >= 2) {
            playerCard1.textContent = playerHand[0].display;
            playerCard1.className = 'card card-revealed ' + (playerHand[0].suitName === 'hearts' || playerHand[0].suitName === 'diamonds' ? 'red' : 'black');

            playerCard2.textContent = playerHand[1].display;
            playerCard2.className = 'card card-revealed ' + (playerHand[1].suitName === 'hearts' || playerHand[1].suitName === 'diamonds' ? 'red' : 'black');
        }
    }

    dealCommunityCards(count) {
        const startIndex = this.communityCards.length;
        const dealDelay = 300; // Delay between community card flips
        
        for (let i = 0; i < count; i++) {
            if (this.communityCards.length < 5) {
                this.communityCards.push(this.deck.pop());
            }
        }

        // Animate community cards with flip
        this.communityCards.forEach((card, index) => {
            if (index >= startIndex) {
                setTimeout(() => this.revealCommunityCard(index), (index - startIndex) * dealDelay);
            }
        });
    }

    revealCommunityCard(index) {
        const card = this.communityCards[index];
        const cardElement = document.getElementById(`communityCard${index + 1}`);
        
        if (cardElement && card) {
            cardElement.classList.add('card-flip');
            setTimeout(() => {
                cardElement.textContent = card.display;
                cardElement.className = 'card card-revealed ' + (card.suitName === 'hearts' || card.suitName === 'diamonds' ? 'red' : 'black');
            }, 250);
        }
    }

    rotateBlind() {
        // Rotate blinds clockwise: Player (0) -> Bot6 (6) -> Bot1 (1) -> Bot2 (2) -> Bot3 (3) -> Bot4 (4) -> Bot5 (5) -> Player
        this.smallBlindIndex = (this.smallBlindIndex + 1) % 7;
        this.bigBlindIndex = (this.bigBlindIndex + 1) % 7;
    }

    updateBlindDisplay() {
        // Clear all blind indicators
        for (let i = 0; i < this.players.length; i++) {
            const blindElement = i === 0 ? 
                document.getElementById('playerBlind') : 
                document.getElementById(`botBlind${i}`);
            if (blindElement) {
                blindElement.textContent = '';
                blindElement.className = 'blind-indicator';
            }
        }

        // Set small blind
        const smallBlindElement = this.smallBlindIndex === 0 ? 
            document.getElementById('playerBlind') : 
            document.getElementById(`botBlind${this.smallBlindIndex}`);
        if (smallBlindElement) {
            smallBlindElement.textContent = 'SB';
            smallBlindElement.classList.add('small-blind');
        }

        // Set big blind
        const bigBlindElement = this.bigBlindIndex === 0 ? 
            document.getElementById('playerBlind') : 
            document.getElementById(`botBlind${this.bigBlindIndex}`);
        if (bigBlindElement) {
            bigBlindElement.textContent = 'BB';
            bigBlindElement.classList.add('big-blind');
        }
    }

    startNewGame() {
        this.gameActive = true;
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.gamePhase = 'preFlop';
        this.gameRound++;

        // Rotate blinds
        this.rotateBlind();

        // Reset all players
        for (let player of this.players) {
            player.hand = [];
            player.bet = 0;
            player.folded = false;
            if (player.chips <= 0) {
                player.chips = this.playerChips * 0.5;
                player.maxChips = player.chips;
            }
        }

        this.createDeck();
        this.updateBlindDisplay();
        
        // Clear community cards
        for (let i = 1; i <= 5; i++) {
            const cardElement = document.getElementById(`communityCard${i}`);
            cardElement.textContent = '';
            cardElement.className = 'card card-empty';
        }

        this.updateDisplay();
        this.showMessage('New game started! Dealing cards...');
        
        // Deal cards with animation
        setTimeout(() => this.dealHoleCards(), 500);

        // Start betting after dealing
        setTimeout(() => {
            this.startBettingRound();
        }, 3500);
    }

    startBettingRound() {
        this.currentBet = 0;
        const activePlayers = this.players.filter(p => !p.folded && p.chips > 0);
        
        if (activePlayers.length <= 1) {
            this.endHand();
            return;
        }

        const playerIndex = this.players.findIndex(p => p.id === 'player' && !p.folded);
        
        if (playerIndex !== -1 && this.players[playerIndex].chips > 0) {
            this.currentPlayerTurn = playerIndex;
            this.enablePlayerActions();
        } else {
            this.endBettingRound();
        }
    }

    enablePlayerActions() {
        const player = this.players[0];
        if (player.chips > 0 && !player.folded) {
            document.getElementById('betBtn').disabled = false;
            document.getElementById('checkBtn').disabled = false;
            document.getElementById('foldBtn').disabled = false;
        }
    }

    disableActions(disable) {
        document.getElementById('betBtn').disabled = disable;
        document.getElementById('checkBtn').disabled = disable;
        document.getElementById('foldBtn').disabled = disable;
    }

    openBetModal() {
        const betModal = document.getElementById('betModal');
        const betInput = document.getElementById('betInput');
        const player = this.players[0];

        betInput.max = player.chips;
        betInput.placeholder = `Max: ${player.chips}`;
        betInput.value = '';
        betModal.classList.add('active');
        betInput.focus();
    }

    closeBetModal() {
        document.getElementById('betModal').classList.remove('active');
    }

    placeBet() {
        const betInput = document.getElementById('betInput');
        const betAmount = parseInt(betInput.value);
        const player = this.players[0];

        if (isNaN(betAmount) || betAmount < 1 || betAmount > player.chips) {
            alert('Invalid bet amount');
            return;
        }

        player.chips -= betAmount;
        player.bet = betAmount;
        this.pot += betAmount;
        this.currentBet = betAmount;

        this.closeBetModal();
        this.updateDisplay();
        this.showMessage(`You bet ${betAmount} chips`);
        this.disableActions(true);

        // Simulate bot actions
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
            const activePlayers = this.players.filter(p => !p.folded);
            if (activePlayers.length === 1) {
                this.endHand();
            } else {
                this.executeBotActions();
            }
        }, 1000);
    }

    executeBotActions() {
        let actedCount = 0;
        const botsToAct = this.players.filter((p, i) => i !== 0 && !p.folded && p.chips > 0).length;

        for (let i = 1; i < this.players.length; i++) {
            const bot = this.players[i];
            if (!bot.folded && bot.chips > 0) {
                setTimeout(() => {
                    const action = this.determineBotAction(bot);
                    
                    if (action === 'fold') {
                        bot.folded = true;
                        this.showMessage(`${bot.name} folded`);
                    } else if (action === 'bet') {
                        const betAmount = Math.min(Math.floor(Math.random() * bot.chips * 0.3) + 10, bot.chips);
                        bot.chips -= betAmount;
                        bot.bet = betAmount;
                        this.pot += betAmount;
                        this.currentBet = Math.max(this.currentBet, betAmount);
                        this.showMessage(`${bot.name} bet ${betAmount}`);
                    } else if (action === 'check') {
                        this.showMessage(`${bot.name} checked`);
                    }
                    
                    this.updateDisplay();
                    actedCount++;

                    if (actedCount === botsToAct) {
                        setTimeout(() => this.advanceGamePhase(), 800);
                    }
                }, (i - 1) * 800);
            }
        }
    }

    determineBotAction(bot) {
        const handStrength = Math.random();
        
        if (handStrength < 0.3) {
            return 'fold';
        } else if (handStrength < 0.7) {
            return bot.bet === 0 ? 'check' : 'fold';
        } else {
            return 'bet';
        }
    }

    advanceGamePhase() {
        if (this.gamePhase === 'preFlop') {
            this.gamePhase = 'flop';
            this.showMessage('Flop revealed!');
            setTimeout(() => this.dealCommunityCards(3), 500);
            setTimeout(() => this.startBettingRound(), 2500);
        } else if (this.gamePhase === 'flop') {
            this.gamePhase = 'turn';
            this.showMessage('Turn revealed!');
            setTimeout(() => this.dealCommunityCards(1), 500);
            setTimeout(() => this.startBettingRound(), 1500);
        } else if (this.gamePhase === 'turn') {
            this.gamePhase = 'river';
            this.showMessage('River revealed!');
            setTimeout(() => this.dealCommunityCards(1), 500);
            setTimeout(() => this.startBettingRound(), 1500);
        } else if (this.gamePhase === 'river') {
            this.endHand();
        }
    }

    endHand() {
        const activePlayers = this.players.filter(p => !p.folded);
        let winner = null;

        if (activePlayers.length === 1) {
            winner = activePlayers[0];
        } else {
            // Simplified - just pick first active player
            winner = activePlayers[0];
        }

        if (winner) {
            winner.chips += this.pot;
            this.showMessage(`${winner.name} wins ${this.pot} chips!`);
        }

        this.gameActive = false;
        this.disableActions(true);
        this.playerChips = this.players[0].chips;
        
        // Save points back to PointsManager
        if (typeof setPlayerPoints === 'function') {
            setPlayerPoints(this.playerChips);
        }
        
        this.updateDisplay();

        setTimeout(() => {
            if (this.players[0].chips > 0) {
                this.startNewGame();
            } else {
                this.resetGame();
            }
        }, 2500);
    }

    endBettingRound() {
        const activePlayers = this.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            this.endHand();
        } else {
            this.advanceGamePhase();
        }
    }

    resetGame() {
        this.gameActive = false;
        this.disableActions(true);
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;

        // Reset all players
        for (let player of this.players) {
            player.hand = [];
            player.bet = 0;
            player.folded = false;
            if (player.id === 'player') {
                player.chips = this.playerChips;
                player.maxChips = this.playerChips;
            } else {
                player.chips = Math.floor(this.playerChips * 0.5);
                player.maxChips = player.chips;
            }
        }

        // Clear all cards
        for (let i = 1; i <= 2; i++) {
            const cardElement = document.getElementById(`playerCard${i}`);
            cardElement.textContent = '';
            cardElement.className = 'card card-empty';
        }

        for (let i = 1; i <= 5; i++) {
            const cardElement = document.getElementById(`communityCard${i}`);
            cardElement.textContent = '';
            cardElement.className = 'card card-empty';
        }

        // Clear bot cards and blinds
        for (let i = 1; i <= 6; i++) {
            const botCardsElement = document.getElementById(`botCards${i}`);
            botCardsElement.innerHTML = '<div class="card card-back"></div><div class="card card-back"></div>';
            const blindElement = document.getElementById(`botBlind${i}`);
            if (blindElement) {
                blindElement.textContent = '';
                blindElement.className = 'blind-indicator';
            }
        }

        const playerBlind = document.getElementById('playerBlind');
        if (playerBlind) {
            playerBlind.textContent = '';
            playerBlind.className = 'blind-indicator';
        }

        this.updateDisplay();
        this.showMessage('Game reset. Click "Start New Game" to begin.');
    }

    updateDisplay() {
        // Update pot and game info
        document.getElementById('potAmount').textContent = this.pot;
        document.getElementById('currentBet').textContent = this.currentBet;
        document.getElementById('playerChips').textContent = this.playerChips;
        document.getElementById('playerChipsDisplay').textContent = this.players[0].chips;

        // Update bot displays
        for (let i = 1; i < this.players.length; i++) {
            const bot = this.players[i];
            const chipElement = document.getElementById(`botChips${i}`);
            if (chipElement) {
                chipElement.textContent = bot.chips;
            }
        }

        document.getElementById('gameStatus').textContent = this.gameActive ? `Phase: ${this.gamePhase}` : 'Waiting for game to start...';
    }

    showMessage(text) {
        const messageElement = document.getElementById('gameMessage');
        messageElement.textContent = text;
        messageElement.classList.remove('active');
        // Force reflow to restart animation
        void messageElement.offsetWidth;
        messageElement.classList.add('active');

        setTimeout(() => {
            messageElement.classList.remove('active');
        }, 5000);
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new TexasHoldemGame();
    game.updateDisplay();
});

