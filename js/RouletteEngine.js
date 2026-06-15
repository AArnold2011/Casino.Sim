    const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

    // Wheel layout (single-zero European order), index aligns with slot angle.
    const wheelNumbers = [0, 26, 3, 35, 12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1, 33, 16, 24, 5, 10, 23, 8, 30, 11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15, 32];

    // Non-numeric betting boxes; their CSS class doubles as the bet choice.
    const OUTSIDE_BETS = ['Red', 'Black', 'Even', 'Odd', 'Low', 'High', 'first', 'second', 'third', 'columnone', 'columntwo', 'columnthree'];

    const FRIENDLY_LABELS = {
        columnone: 'Column 1', columntwo: 'Column 2', columnthree: 'Column 3',
        first: '1st dozen (1-12)', second: '2nd dozen (13-24)', third: '3rd dozen (25-36)',
        red: 'Red', black: 'Black', even: 'Even', odd: 'Odd',
        low: '1-18', high: '19-36'
    };

    const spinner = document.getElementById('spinner');
    const betMessage = document.getElementById('betMessage');
    const pointsValue = document.getElementById('pointsValue');
    const betAmountInput = document.getElementById('betAmount');
    const totalBetSpan = document.getElementById('totalBet');
    const activeBetsDiv = document.getElementById('activeBets');

    let playerPoints = typeof getPlayerPoints === 'function' ? getPlayerPoints() : 100;
    let activeBets = [];

    let rotation = 0;
    let startTime = null;
    let animationId = null;
    let rndspdmod = 1;
    let isSpinning = false;

    function startSpin() {
        if (activeBets.length === 0) {
            betMessage.textContent = 'Place at least one bet first';
            return;
        }

        const totalAmount = activeBets.reduce((sum, bet) => sum + bet.amount, 0);
        if (totalAmount > playerPoints) {
            betMessage.textContent = 'Not enough points for all bets';
            return;
        }

        isSpinning = true;
        disableBetting();

        playerPoints -= totalAmount;
        updatePointsDisplay();
        betMessage.textContent = `Spinning... Total bet: ${totalAmount}`;

        startTime = null;
        rndspdmod = 0.5 + Math.random();
        if (!animationId) animationId = requestAnimationFrame(animateSpin);
    }

    function animateSpin(timestamp) {
        if (startTime === null) startTime = timestamp;
        const lifetime = (timestamp - startTime) / 1000;

        if (lifetime > 4.67) {
            animationId = null;
            displayWheelResult();
            isSpinning = false;
            enableBetting();
            return;
        }

        const spdmod = 1 / (lifetime + 0.001) + 1;
        rotation += (spdmod + 10) * rndspdmod;
        spinner.style.transform = `rotate(${rotation}deg)`;

        animationId = requestAnimationFrame(animateSpin);
    }

    function getWheelNumber(angle) {
        const normalizedAngle = ((angle % 360) + 360) % 360;
        const degreesPerSlot = 360 / 37;
        const slotIndex = Math.round(normalizedAngle / degreesPerSlot) % 37;
        return wheelNumbers[slotIndex];
    }

    function displayWheelResult() {
        const resultNumber = getWheelNumber(rotation);
        betMessage.textContent = 'Wheel Result: ' + resultNumber;
        resolveAllBets(resultNumber);
        return resultNumber;
    }

    function updatePointsDisplay() {
        pointsValue.textContent = playerPoints;
        if (typeof setPlayerPoints === 'function') {
            setPlayerPoints(playerPoints);
        }
    }

    function updateTotalBet() {
        const total = activeBets.reduce((sum, bet) => sum + bet.amount, 0);
        totalBetSpan.textContent = total;
    }

    function updateActiveBetsList() {
        if (activeBets.length === 0) {
            activeBetsDiv.innerHTML = '<div style="color: #999;">No active bets</div>';
        } else {
            activeBetsDiv.innerHTML = '<strong>Active Bets:</strong><br>' +
                activeBets.map(bet => `• ${bet.displayLabel}: ${bet.amount}`).join('<br>');
        }
    }

    function setBettingDisabled(disabled) {
        document.querySelectorAll('.roulette-box').forEach(box => {
            box.classList.toggle('disabled', disabled);
        });
        betAmountInput.disabled = disabled;
        document.getElementById('clearBetsBtn').disabled = disabled;
        document.getElementById('spinBtn').disabled = disabled;
    }

    function disableBetting() { setBettingDisabled(true); }
    function enableBetting() { setBettingDisabled(false); }

    function clearAllBets() {
        if (isSpinning) return;
        activeBets.forEach(bet => {
            if (bet.element) bet.element.classList.remove('selected');
        });
        activeBets = [];
        updateTotalBet();
        updateActiveBetsList();
        betMessage.textContent = 'All bets cleared';
    }

    function payoutLabelForChoice(choice) {
        if (!choice) return '-';
        const c = choice.toLowerCase().trim();
        if (/^\d+$/.test(c)) return '35:1';
        if (['red', 'black', 'even', 'odd', 'low', 'high'].includes(c)) return '1:1';
        return '2:1';
    }

    function toggleBet(choice, displayLabel, element) {
        if (isSpinning) {
            betMessage.textContent = 'Cannot change bets while spinning';
            return;
        }

        const amount = Number(betAmountInput.value) || 0;
        if (!choice) { betMessage.textContent = 'No choice selected'; return; }
        if (!Number.isFinite(amount) || amount <= 0) { betMessage.textContent = 'Enter a valid bet amount'; return; }

        const existingBetIndex = activeBets.findIndex(bet => bet.choice === choice);
        if (existingBetIndex !== -1) {
            activeBets.splice(existingBetIndex, 1);
            element.classList.remove('selected');
            betMessage.textContent = `Removed bet on '${displayLabel}'`;
        } else {
            activeBets.push({ amount, choice, displayLabel, element });
            element.classList.add('selected');
            betMessage.textContent = `Added bet: ${amount} on '${displayLabel}' — Payout: ${payoutLabelForChoice(choice)}`;
        }

        updateTotalBet();
        updateActiveBetsList();
    }

    function resolveAllBets(resultNumber) {
        if (activeBets.length === 0) return;

        let totalWon = 0;
        let totalLost = 0;
        let roundWagered = 0;
        let roundReturned = 0;
        const evenMoneySet = new Set(['red', 'black', 'even', 'odd', 'low', 'high']);

        activeBets.forEach(bet => {
            const stake = bet.amount;
            const choiceRaw = bet.choice.toLowerCase();

            // La Partage: even-money bets lose only half when the ball lands on 0.
            roundWagered += stake;

            if (resultNumber === 0 && evenMoneySet.has(choiceRaw)) {
                const refund = stake / 2;
                playerPoints += refund;
                roundReturned += refund;
                totalLost += refund;
                return;
            }

            let win = false;
            let profitMultiplier = 0;

            if (/^\d+$/.test(choiceRaw)) {
                if (parseInt(choiceRaw, 10) === resultNumber) { win = true; profitMultiplier = 35; }
            } else if (choiceRaw === 'red') {
                if (redNumbers.has(resultNumber)) { win = true; profitMultiplier = 1; }
            } else if (choiceRaw === 'black') {
                if (resultNumber !== 0 && !redNumbers.has(resultNumber)) { win = true; profitMultiplier = 1; }
            } else if (choiceRaw === 'even') {
                if (resultNumber !== 0 && resultNumber % 2 === 0) { win = true; profitMultiplier = 1; }
            } else if (choiceRaw === 'odd') {
                if (resultNumber % 2 === 1) { win = true; profitMultiplier = 1; }
            } else if (choiceRaw === 'low' || choiceRaw === '1-18') {
                if (resultNumber >= 1 && resultNumber <= 18) { win = true; profitMultiplier = 1; }
            } else if (choiceRaw === 'high' || choiceRaw === '19-36') {
                if (resultNumber >= 19 && resultNumber <= 36) { win = true; profitMultiplier = 1; }
            } else if (choiceRaw === 'first' || choiceRaw === 'first dozen' || choiceRaw === 'dozen1') {
                if (resultNumber >= 1 && resultNumber <= 12) { win = true; profitMultiplier = 2; }
            } else if (choiceRaw === 'second' || choiceRaw === 'second dozen' || choiceRaw === 'dozen2') {
                if (resultNumber >= 13 && resultNumber <= 24) { win = true; profitMultiplier = 2; }
            } else if (choiceRaw === 'third' || choiceRaw === 'third dozen' || choiceRaw === 'dozen3') {
                if (resultNumber >= 25 && resultNumber <= 36) { win = true; profitMultiplier = 2; }
            } else if (choiceRaw === 'columnone' || choiceRaw === 'column 1' || choiceRaw === 'col1') {
                if (resultNumber !== 0 && (resultNumber % 3) === 1) { win = true; profitMultiplier = 2; }
            } else if (choiceRaw === 'columntwo' || choiceRaw === 'column 2' || choiceRaw === 'col2') {
                if (resultNumber !== 0 && (resultNumber % 3) === 2) { win = true; profitMultiplier = 2; }
            } else if (choiceRaw === 'columnthree' || choiceRaw === 'column 3' || choiceRaw === 'col3') {
                if (resultNumber !== 0 && (resultNumber % 3) === 0) { win = true; profitMultiplier = 2; }
            }

            if (win) {
                const payout = stake * (1 + profitMultiplier);
                playerPoints += payout;
                roundReturned += payout;
                totalWon += stake * profitMultiplier;
            } else {
                totalLost += stake;
            }
        });

        const netResult = totalWon - totalLost;
        if (netResult > 0) {
            betMessage.textContent = `Result: ${resultNumber}. Net win: +${netResult}!`;
        } else if (netResult < 0) {
            betMessage.textContent = `Result: ${resultNumber}. Net loss: ${netResult}`;
        } else {
            betMessage.textContent = `Result: ${resultNumber}. Break even`;
        }

        if (roundWagered > 0 && typeof recordRound === 'function') {
            recordRound('roulette', { wagered: roundWagered, returned: roundReturned });
        }

        updatePointsDisplay();
        updateActiveBetsList();
    }

    function friendlyLabelFromClass(c) {
        if (!c) return '';
        if (/^\d+$/.test(c)) return c;
        const key = c.toLowerCase();
        return FRIENDLY_LABELS[key] || c.replace(/[-_]/g, ' ').replace(/(^|\s)\S/g, s => s.toUpperCase());
    }

    function canonicalChoiceFromClasses(classList) {
        const filtered = Array.from(classList || [])
            .filter(c => c !== 'roulette-box' && c !== 'selected' && c !== 'disabled');

        for (const c of filtered) {
            if (/^\d+$/.test(c)) return c;
        }
        const known = OUTSIDE_BETS.map(b => b.toLowerCase());
        for (const c of filtered) {
            if (known.includes(c.toLowerCase())) return c.toLowerCase();
        }
        return (filtered[0] || '').toLowerCase();
    }

    function handleBoxClick(event) {
        const box = event.currentTarget;
        if (isSpinning || box.classList.contains('disabled')) {
            betMessage.textContent = 'Cannot change bets while spinning';
            return;
        }
        const canonical = canonicalChoiceFromClasses(box.classList);
        const displayLabel = friendlyLabelFromClass(canonical) || (box.textContent || '').trim();
        toggleBet(canonical, displayLabel, box);
    }

    function applyColors() {
        // Number boxes (class "0".."36") plus the named outside-bet boxes.
        const numberSelectors = Array.from({ length: 37 }, (_, n) => `div[class="${n}"]`);
        const outsideSelectors = OUTSIDE_BETS.map(name => `div.${name}`);
        const selector = numberSelectors.concat(outsideSelectors).join(', ');

        document.querySelectorAll(selector).forEach(div => {
            div.classList.add('roulette-box');
            div.addEventListener('click', handleBoxClick);
        });
    }

    function setupRouletteControls() {
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) spinBtn.addEventListener('click', startSpin);

        const clearBetsBtn = document.getElementById('clearBetsBtn');
        if (clearBetsBtn) clearBetsBtn.addEventListener('click', clearAllBets);
    }

    function initializeRoulette() {
        updatePointsDisplay();
        updateTotalBet();
        updateActiveBetsList();
        setupRouletteControls();
        applyColors();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeRoulette);
    } else {
        initializeRoulette();
    }
