  const redNumbers = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    
    const spinner = document.getElementById('spinner');
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

       
        const spdmod = 1 / (lifetime + 0.001)+1;

        rotation += (spdmod + 10) * rndspdmod;
        spinner.style.transform = `rotate(${rotation}deg)`;

        animationId = requestAnimationFrame(animateSpin);
    }

    const wheelNumbers = [0, 26, 3, 35, 12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1, 33, 16, 24, 5, 10, 23, 8, 30, 11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15, 32];
    
    function getWheelNumber(angle) {
        let normalizedAngle = ((angle % 360) + 360) % 360;
        const degreesPerSlot = 360 / 37;
        const slotIndex = Math.round(normalizedAngle / degreesPerSlot) % 37;
        return wheelNumbers[slotIndex];
    }

    function displayWheelResult() {
        const resultNumber = getWheelNumber(rotation);
        betMessage.textContent = "Wheel Result: " + resultNumber;
        resolveAllBets(resultNumber);
        return resultNumber;
    }
   
    const betMessage = document.getElementById('betMessage');
    const pointsDisplay = document.getElementById('pointsDisplay');
    const pointsValue = document.getElementById('pointsValue');
    const betAmountInput = document.getElementById('betAmount');
    const totalBetSpan = document.getElementById('totalBet');
    const activeBetsDiv = document.getElementById('activeBets');

    let playerPoints = typeof getPlayerPoints === 'function' ? getPlayerPoints() : 100;
    let activeBets = []; 

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

    function disableBetting() {
        // Disable all roulette boxes
        const allBoxes = document.querySelectorAll('.roulette-box');
        allBoxes.forEach(box => {
            box.classList.add('disabled');
        });
        
        // Disable bet amount input and clear bets button
        betAmountInput.disabled = true;
        document.getElementById('clearBetsBtn').disabled = true;
        document.getElementById('spinBtn').disabled = true;
    }

    function enableBetting() {
        // Enable all roulette boxes
        const allBoxes = document.querySelectorAll('.roulette-box');
        allBoxes.forEach(box => {
            box.classList.remove('disabled');
        });
        
        // Enable bet amount input and clear bets button
        betAmountInput.disabled = false;
        document.getElementById('clearBetsBtn').disabled = false;
        document.getElementById('spinBtn').disabled = false;
    }

    function clearAllBets() {
        if (isSpinning) return;
        
        // Remove selected class from all boxes
        activeBets.forEach(bet => {
            if (bet.element) {
                bet.element.classList.remove('selected');
            }
        });
        activeBets = [];
        updateTotalBet();
        updateActiveBetsList();
        betMessage.textContent = 'All bets cleared';
    }

    // return an object with multiplier and label for display given an internal choice string
    function getPayoutForChoice(choice) {
        if (!choice) return { multiplier: 0, label: '-' };
        const c = choice.toLowerCase().trim();
        // straight numeric
        if (/^\d+$/.test(c)) return { multiplier: 35, label: '35:1' };
        // even money
        if (['red','black','even','odd','low','high'].includes(c)) return { multiplier: 1, label: '1:1' };
        // dozens
        if (['first','first dozen','dozen1','second','second dozen','dozen2','third','third dozen','dozen3'].includes(c)) return { multiplier: 2, label: '2:1' };
        // columns
        if (['columnone','columntwo','columnthree','col1','col2','col3','column 1','column 2','column 3'].includes(c)) return { multiplier: 2, label: '2:1' };
        return { multiplier: 0, label: '-' };
    }

    // Toggle a bet when clicking a box
    function toggleBet(choice, displayLabel, element) {
        if (isSpinning) {
            betMessage.textContent = 'Cannot change bets while spinning';
            return;
        }
        
        const amount = Number(betAmountInput.value) || 0;
        if (!choice) { betMessage.textContent = 'No choice selected'; return; }
        if (!Number.isFinite(amount) || amount <= 0) { betMessage.textContent = 'Enter a valid bet amount'; return; }
        
        // Check if this bet already exists
        const existingBetIndex = activeBets.findIndex(bet => bet.choice === choice);
        
        if (existingBetIndex !== -1) {
            // Remove the bet (toggle off)
            activeBets.splice(existingBetIndex, 1);
            element.classList.remove('selected');
            betMessage.textContent = `Removed bet on '${displayLabel}'`;
        } else {
            // Add the bet (toggle on)
            activeBets.push({ 
                amount: amount, 
                choice: choice, 
                displayLabel: displayLabel,
                element: element 
            });
            element.classList.add('selected');
            const payoutInfo = getPayoutForChoice(choice);
            betMessage.textContent = `Added bet: ${amount} on '${displayLabel}' — Payout: ${payoutInfo.label}`;
        }
        
        updateTotalBet();
        updateActiveBetsList();
    }

    function resolveAllBets(resultNumber) {
        if (activeBets.length === 0) return;
        
        let totalWon = 0;
        let totalLost = 0;
        const results = [];
        
        activeBets.forEach(bet => {
            const stake = bet.amount;
            const choiceRaw = bet.choice.toLowerCase();
            
            // French roulette rule: la partage -> even-money bets lose only half when 0 appears
            const evenMoneySet = new Set(['red','black','even','odd','low','high']);
            if (resultNumber === 0 && evenMoneySet.has(choiceRaw)) {
                const returned = stake / 2;
                playerPoints += returned;
                results.push(`${bet.displayLabel}: Lost half (${returned} returned)`);
                totalLost += stake / 2;
                return;
            }
            
            let win = false;
            let profitMultiplier = 0;

            // numeric straight bet
            if (/^\d+$/.test(choiceRaw)) {
                const n = parseInt(choiceRaw, 10);
                if (n === resultNumber) { win = true; profitMultiplier = 35; }
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
                if (resultNumber >=1 && resultNumber <=12) { win = true; profitMultiplier = 2; }
            } else if (choiceRaw === 'second' || choiceRaw === 'second dozen' || choiceRaw === 'dozen2') {
                if (resultNumber >=13 && resultNumber <=24) { win = true; profitMultiplier = 2; }
            } else if (choiceRaw === 'third' || choiceRaw === 'third dozen' || choiceRaw === 'dozen3') {
                if (resultNumber >=25 && resultNumber <=36) { win = true; profitMultiplier = 2; }
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
                totalWon += stake * profitMultiplier;
                results.push(`${bet.displayLabel}: Won ${stake * profitMultiplier}`);
            } else {
                totalLost += stake;
                results.push(`${bet.displayLabel}: Lost ${stake}`);
            }
        });

        // Show summary
        const netResult = totalWon - totalLost;
        if (netResult > 0) {
            betMessage.textContent = `Result: ${resultNumber}. Net win: +${netResult}!`;
        } else if (netResult < 0) {
            betMessage.textContent = `Result: ${resultNumber}. Net loss: ${netResult}`;
        } else {
            betMessage.textContent = `Result: ${resultNumber}. Break even`;
        }
        
        // Keep the bets active (don't clear them)
        updatePointsDisplay();
        updateActiveBetsList();
    }

    updatePointsDisplay();
    updateTotalBet();
    updateActiveBetsList();

    function setupRouletteControls() {
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) {
            spinBtn.addEventListener('click', startSpin);
        }

        const clearBetsBtn = document.getElementById('clearBetsBtn');
        if (clearBetsBtn) {
            clearBetsBtn.addEventListener('click', clearAllBets);
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        setupRouletteControls();
        applyColors();
    });
    
    if (document.readyState === 'loading') {
        // DOM not ready yet
    } else {
        // DOM is ready
        applyColors();
    }
    
    function applyColors() {
        const allDivs = document.querySelectorAll('div[class="0"], div[class="1"], div[class="2"], div[class="3"], div[class="4"], div[class="5"], div[class="6"], div[class="7"], div[class="8"], div[class="9"], div[class="10"], div[class="11"], div[class="12"], div[class="13"], div[class="14"], div[class="15"], div[class="16"], div[class="17"], div[class="18"], div[class="19"], div[class="20"], div[class="21"], div[class="22"], div[class="23"], div[class="24"], div[class="25"], div[class="26"], div[class="27"], div[class="28"], div[class="29"], div[class="30"], div[class="31"], div[class="32"], div[class="33"], div[class="34"], div[class="35"], div[class="36"], div.Red, div.Black, div.Even, div.Odd, div.Low, div.High, div.first, div.second, div.third, div.columnone, div.columntwo, div.columnthree');
        
        allDivs.forEach(div => {
            
            div.classList.add('roulette-box');


            // handle click to toggle bet
            div.addEventListener('click', function() {
                // Check if betting is disabled
                if (isSpinning || this.classList.contains('disabled')) {
                    betMessage.textContent = 'Cannot change bets while spinning';
                    return;
                }
                
                // build a candidate list from classList, ignoring helper classes
                const rawClasses = Array.from(this.classList || []);
                const filtered = rawClasses.filter(c => c !== 'roulette-box' && c !== 'selected' && c !== 'disabled');

                // find a canonical class: prefer numeric slot, then known keys
                let canonical = '';
                for (const c of filtered) { if (/^\d+$/.test(c)) { canonical = c; break; } }
                if (!canonical) {
                    const known = ['columnone','columntwo','columnthree','first','second','third','red','black','even','odd','low','high'];
                    for (const c of filtered) { if (known.includes(c.toLowerCase())) { canonical = c.toLowerCase(); break; } }
                }
                if (!canonical) canonical = filtered[0] || '';

                // map to friendly label and internal key
                function friendlyLabelFromClass(c) {
                    if (!c) return '';
                    if (/^\d+$/.test(c)) return c;
                    const map = {
                        'columnone': 'Column 1', 'columntwo': 'Column 2', 'columnthree': 'Column 3',
                        'first': '1st dozen (1-12)', 'second': '2nd dozen (13-24)', 'third': '3rd dozen (25-36)',
                        'red': 'Red', 'black': 'Black', 'even': 'Even', 'odd': 'Odd',
                        'low': '1-18', 'high': '19-36'
                    };
                    const key = c.toLowerCase();
                    return map[key] || map[c] || c.replace(/[-_]/g,' ').replace(/(^|\s)\S/g, s => s.toUpperCase());
                }

                function internalChoiceFromClass(c) {
                    if (!c) return '';
                    if (/^\d+$/.test(c)) return c;
                    return c.toLowerCase();
                }

                const displayLabel = friendlyLabelFromClass(canonical) || (this.textContent || '').trim();
                const choice = internalChoiceFromClass(canonical);

                // Toggle the bet
                toggleBet(choice, displayLabel, this);
            });
        });
    }