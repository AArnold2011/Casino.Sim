const POINTS_KEY = 'casinoPoints';

function getPlayerPoints() {
    const stored = parseInt(localStorage.getItem(POINTS_KEY), 10);
    if (!Number.isFinite(stored) || stored < 0) {
        setPlayerPoints(1000);
        return 1000;
    }
    return stored;
}

function setPlayerPoints(value) {
    const points = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    localStorage.setItem(POINTS_KEY, String(points));
    updateSharedPointsDisplay(points);
}

function adjustPlayerPoints(delta) {
    const current = getPlayerPoints();
    setPlayerPoints(current + delta);
}

function updateSharedPointsDisplay(value) {
    const points = Number.isFinite(value) ? value : getPlayerPoints();
    const pointsValue = document.getElementById('pointsValue');
    if (pointsValue) {
        pointsValue.textContent = points;
    }
}

function initializeSharedPoints() {
    const points = getPlayerPoints();
    updateSharedPointsDisplay(points);
}

window.getPlayerPoints = getPlayerPoints;
window.setPlayerPoints = setPlayerPoints;
window.adjustPlayerPoints = adjustPlayerPoints;
window.initializeSharedPoints = initializeSharedPoints;
