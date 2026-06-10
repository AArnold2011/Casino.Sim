    const SLOT_SYMBOLS = {
        seven:  { glyph: '7',    cls: 'sym-seven'  },
        bar:    { glyph: 'BAR',  cls: 'sym-bar'    },
        bell:   { glyph: '\uD83D\uDD14', cls: 'sym-bell'   },
        grape:  { glyph: '\uD83C\uDF47', cls: 'sym-grape'  },
        orange: { glyph: '\uD83C\uDF4A', cls: 'sym-orange' },
        lemon:  { glyph: '\uD83C\uDF4B', cls: 'sym-lemon'  },
        cherry: { glyph: '\uD83C\uDF52', cls: 'sym-cherry' }
    };

    const REEL_STRIP = [
        'seven', 'lemon', 'bell', 'orange', 'cherry',
        'lemon', 'grape', 'bar', 'lemon', 'orange',
        'bell', 'grape', 'lemon', 'cherry', 'orange',
        'bar', 'lemon', 'grape', 'bell', 'orange'
    ];
    const STRIP_LENGTH = REEL_STRIP.length;
    const STRIP_COPIES = 3;
    const REEL_COUNT = 3;

    const THREE_OF_A_KIND_PAYS = {
        seven: 120,
        bar: 40,
        bell: 18,
        grape: 12,
        cherry: 10,
        orange: 8,
        lemon: 6
    };
    const TWO_CHERRIES_PAYS = 5;
    const ONE_CHERRY_PAYS = 2;

    const BET_MIN = 5;
    const BET_MAX = 500;
    const BET_STEP = 5;

    const slotMessage = document.getElementById('slotMessage');
    const creditsValue = document.getElementById('creditsValue');
    const betReadout = document.getElementById('betReadout');
    const betValue = document.getElementById('betValue');
    const lastWinValue = document.getElementById('lastWinValue');
    const spinBtn = document.getElementById('spinBtn');
    const betBtn = document.getElementById('betBtn');
    const lever = document.getElementById('lever');
    const betPopup = document.getElementById('betPopup');
    const betPopupValue = document.getElementById('betPopupValue');
    const betUpBtn = document.getElementById('betUpBtn');
    const betDownBtn = document.getElementById('betDownBtn');
    const betConfirmBtn = document.getElementById('betConfirmBtn');
    const reelWindow = document.getElementById('reelWindow');
    const slotMachine = document.querySelector('.slot-machine');
    const reelStrips = [
        document.getElementById('reelStrip0'),
        document.getElementById('reelStrip1'),
        document.getElementById('reelStrip2')
    ];

    let playerPoints = typeof getPlayerPoints === 'function' ? getPlayerPoints() : 1000;
    let betAmount = 25;
    let isSpinning = false;
    let cellHeight = 0;
    let spinStartTime = null;

    const reels = [];
    for (let i = 0; i < REEL_COUNT; i++) {
        reels.push({ offset: i * 5, from: 0, target: 0, duration: 0, done: true });
    }

    function buildReels() {
        reelStrips.forEach(function(strip) {
            strip.innerHTML = '';
            for (let copy = 0; copy < STRIP_COPIES; copy++) {
                REEL_STRIP.forEach(function(key) {
                    const cell = document.createElement('div');
                    const symbol = SLOT_SYMBOLS[key];
                    cell.className = 'reel-cell ' + symbol.cls;
                    cell.textContent = symbol.glyph;
                    strip.appendChild(cell);
                });
            }
        });
        measureCells();
        reels.forEach(function(reel, i) { renderReel(i); });
    }

    function measureCells() {
        const firstCell = reelStrips[0].querySelector('.reel-cell');
        cellHeight = firstCell ? firstCell.offsetHeight : 0;
    }

    function renderReel(i) {
        const pos = ((reels[i].offset % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH;
        reelStrips[i].style.transform = 'translateY(' + (-pos * cellHeight) + 'px)';
    }

    function currentBet() {
        return betAmount;
    }

    function updatePointsDisplay() {
        creditsValue.textContent = playerPoints;
        if (typeof setPlayerPoints === 'function') {
            setPlayerPoints(playerPoints);
        }
    }

    function updateBetDisplay() {
        betReadout.textContent = currentBet();
        betValue.textContent = currentBet();
        betPopupValue.textContent = currentBet();
        betDownBtn.disabled = betAmount <= BET_MIN;
        betUpBtn.disabled = betAmount >= BET_MAX;
    }

    function adjustBet(delta) {
        betAmount = Math.min(BET_MAX, Math.max(BET_MIN, betAmount + delta));
        updateBetDisplay();
    }

    function openBetPopup() {
        if (isSpinning) return;
        updateBetDisplay();
        betPopup.classList.remove('hidden');
        betConfirmBtn.focus();
    }

    function closeBetPopup() {
        betPopup.classList.add('hidden');
        slotMessage.textContent = 'Bet set to ' + currentBet();
        betBtn.focus();
    }

    function setControlsEnabled(enabled) {
        spinBtn.disabled = !enabled;
        betBtn.disabled = !enabled;
        lever.classList.toggle('disabled', !enabled);
    }

    function startSpin() {
        if (isSpinning) return;

        const bet = currentBet();
        if (bet > playerPoints) {
            slotMessage.textContent = 'Not enough points for that bet';
            return;
        }

        isSpinning = true;
        setControlsEnabled(false);
        reelWindow.classList.remove('win');
        slotMachine.classList.remove('celebrate');

        playerPoints -= bet;
        updatePointsDisplay();
        lastWinValue.textContent = 0;
        slotMessage.textContent = 'Spinning...';

        reels.forEach(function(reel, i) {
            const stop = Math.floor(Math.random() * STRIP_LENGTH);
            const current = ((reel.offset % STRIP_LENGTH) + STRIP_LENGTH) % STRIP_LENGTH;
            const delta = ((stop - current) % STRIP_LENGTH + STRIP_LENGTH) % STRIP_LENGTH;
            const loops = 3 + i; 
            reel.from = reel.offset;
            reel.target = reel.offset + loops * STRIP_LENGTH + delta;
            reel.duration = 1300 + i * 550;
            reel.done = false;
        });

        spinStartTime = null;
        requestAnimationFrame(animateReels);
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function animateReels(timestamp) {
        if (spinStartTime === null) spinStartTime = timestamp;
        const elapsed = timestamp - spinStartTime;
        let allDone = true;

        reels.forEach(function(reel, i) {
            if (reel.done) return;
            const t = Math.min(elapsed / reel.duration, 1);
            reel.offset = reel.from + (reel.target - reel.from) * easeOutCubic(t);
            if (t >= 1) {
                reel.offset = reel.target;
                reel.done = true;
                const reelEl = reelStrips[i].parentElement;
                reelEl.classList.add('reel-stopped');
                setTimeout(function() { reelEl.classList.remove('reel-stopped'); }, 220);
            } else {
                allDone = false;
            }
            renderReel(i);
        });

        if (!allDone) {
            requestAnimationFrame(animateReels);
        } else {
            resolveSpin();
        }
    }

    function paylineSymbols() {
        return reels.map(function(reel) {
            const stop = Math.round(reel.offset) % STRIP_LENGTH;
            return REEL_STRIP[(stop + 1) % STRIP_LENGTH]; // middle row of the window
        });
    }

    function resolveSpin() {
        const line = paylineSymbols();
        const bet = currentBet();
        let payout = 0;
        let label = '';

        if (line[0] === line[1] && line[1] === line[2]) {
            payout = bet * THREE_OF_A_KIND_PAYS[line[0]];
            label = line[0] === 'seven' ? 'JACKPOT! Three sevens!'
                  : 'Three of a kind — ' + line[0] + '!';
        } else {
            const cherries = line.filter(function(s) { return s === 'cherry'; }).length;
            if (cherries === 2) {
                payout = bet * TWO_CHERRIES_PAYS;
                label = 'Two cherries!';
            } else if (cherries === 1) {
                payout = bet * ONE_CHERRY_PAYS;
                label = 'Cherry pays!';
            }
        }

        if (payout > 0) {
            playerPoints += payout;
            lastWinValue.textContent = payout;
            slotMessage.textContent = label + ' Won ' + payout;
            reelWindow.classList.add('win');
            slotMachine.classList.add('celebrate');
        } else {
            slotMessage.textContent = 'No luck — spin again';
        }

        updatePointsDisplay();
        isSpinning = false;
        setControlsEnabled(true);
    }

    function pullLever() {
        if (isSpinning || lever.classList.contains('pulled')) return;
        const bet = currentBet();
        if (bet > playerPoints) {
            slotMessage.textContent = 'Not enough points for that bet';
            return;
        }
        lever.classList.add('pulled');
        setTimeout(startSpin, 240);
        setTimeout(function() { lever.classList.remove('pulled'); }, 700);
    }

    function setupSlotsControls() {
        spinBtn.addEventListener('click', startSpin);
        betBtn.addEventListener('click', openBetPopup);
        betUpBtn.addEventListener('click', function() { adjustBet(BET_STEP); });
        betDownBtn.addEventListener('click', function() { adjustBet(-BET_STEP); });
        betConfirmBtn.addEventListener('click', closeBetPopup);
        betPopup.addEventListener('click', function(event) {
            if (event.target === betPopup) closeBetPopup();
        });
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && !betPopup.classList.contains('hidden')) {
                closeBetPopup();
            }
        });
        lever.addEventListener('click', pullLever);
        lever.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                pullLever();
            }
        });
        window.addEventListener('resize', function() {
            measureCells();
            reels.forEach(function(reel, i) { renderReel(i); });
        });
    }

    function initializeSlots() {
        buildReels();
        updatePointsDisplay();
        updateBetDisplay();
        setupSlotsControls();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSlots);
    } else {
        initializeSlots();
    }