// State & Constants
const PRESETS = {
    "psop": { name: "Pilarzinho Series of Poker", file: "./PSOP.json" },
    "new1": { name: "Slot Livre 1", file: "./new1.json" }, // Example for future use
    "new2": { name: "Slot Livre 2", file: "./new2.json" } // Example
};

let isStarted = false;
let wakeLock = null;
let currentLevels = []; 
let currentLevel = 0;
let levelDuration = 720; 
let timeLeft = 12 * 60;
let timerId = null;
let adjustmentWindowTimeout = null;
let showNextLevelOnly = false;

// Main UI
function updateDisplay() {
    const current = currentLevels[currentLevel];
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    
    document.getElementById('timer').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Main Blinds Display
    document.getElementById('blinds').innerText = current.displayValue;
    document.getElementById('blinds').style.color = current.isBreak ? "#fa0" : "#fff";
    
    // "Next Level" Logic
    const next = currentLevels[currentLevel + 1];
    let nextText = "Próximo: ";

    if (!next) {
        // "Acabou!" case
        nextText += `<span class="orange-text">Acabou!</span>`;
    } else if (next.isBreak) {
        // "Intervalo" case in the preview
        nextText += `<span class="orange-text">${next.displayValue}</span>`;
    } else {
        // Standard numeric level
        nextText += next.displayValue;
    }

    document.getElementById('next').innerHTML = nextText;
    
    // UI Housekeeping
    const adjButtons = document.querySelectorAll('.adj-btn');
    adjButtons.forEach(btn => {
        if (!isStarted) {
            // 1. Before game starts: Show everything (Time, Level -, Level +)
            btn.style.visibility = 'visible';
        } else if (showNextLevelOnly && btn.id === 'btn-next-level') {
            // 2. During the 30s window: Show ONLY the 'Next Level' arrow
            btn.style.visibility = 'visible';
        } else {
            // 3. Otherwise: Hide everything (The "Drunk-Proof" state)
            btn.style.visibility = 'hidden';
        }
    });
    if (timeLeft <= 10) document.body.classList.add('warning');
}
function changeLevel(direction) {
    if (currentLevels.length === 0) return;
	document.body.classList.remove('warning');

    currentLevel += direction;
    if (currentLevel < 0) currentLevel = 0;
    if (currentLevel >= currentLevels.length) currentLevel = currentLevels.length - 1;
    
	timeLeft = currentLevels[currentLevel].duration;
    
    updateDisplay();
}
function toggleTimer() {
    if (currentLevels.length === 0) {
        showConfig();
        return;
    }

    const btn = document.getElementById('playBtn');
    const body = document.getElementById('mainBody');

    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        btn.innerHTML = "Jogo Pausado";
        btn.className = "state-btn btn-red";
        body.classList.remove('rolling');
        body.classList.add('paused');
    } else {
		// Starting or Retuming
        if (!isStarted) {
            isStarted = true;
            requestWakeLock();
        }        
		
		openAdjustmentWindow();
		
		btn.innerHTML = "Jogo Rolando";
        btn.className = "state-btn btn-green";
        body.classList.add('rolling');
        body.classList.remove('paused');
        timerId = setInterval(() => {
            if (timeLeft === 6) playAlarm();
            if (timeLeft <= 0) {
                changeLevel(1);
            } else {
                timeLeft--;
            }
            updateDisplay();
        }, 1000);
    }
}
function openAdjustmentWindow() {
    showNextLevelOnly = true;
    updateDisplay(); // Show the button immediately

    // Reset the timer if it was already running
    if (adjustmentWindowTimeout) clearTimeout(adjustmentWindowTimeout);

    adjustmentWindowTimeout = setTimeout(() => {
        showNextLevelOnly = false;
        adjustmentWindowTimeout = null;
        updateDisplay(); // Hide the button after 30 seconds
    }, 7000);
}

// Config UI
async function loadPresetIntoForm() {
    const selector = document.getElementById('preset-selector');
    const selectedKey = selector.value;
    
    if (!selectedKey) return;

    try {
        const response = await fetch(PRESETS[selectedKey].file);
        if (!response.ok) throw new Error("Arquivo não encontrado");
        
        const data = await response.json();
        
        // Populate the form fields
        document.getElementById('input-level-time').value = data.levelTime;
        document.getElementById('input-blinds').value = data.levels.join('\n');
        
        console.log(`Formulário populado com: ${PRESETS[selectedKey].name}`);
    } catch (err) {
        alert("Erro ao carregar o preset. Verifique se o arquivo .json existe.");
        console.error(err);
    }
}
function saveAndApplyConfig() {
    const rawBlinds = document.getElementById('input-blinds').value;
    const blindArray = rawBlinds.split('\n')
        .map(s => s.trim())
        .filter(line => line.trim() !== "");

    if (blindArray.length === 0) {
        alert("A estrutura de blinds não pode estar vazia!");
        return;
    }

    const customData = {
        name: "Sessão Personalizada", // This name identifies the save
        levelTime: parseInt(document.getElementById('input-level-time').value),
        levels: blindArray
    };

    // RESTORED: Save to local storage
    localStorage.setItem('customPokerConfig', JSON.stringify(customData));
    
    applyConfig(customData);
}
function applyConfig(data) {
    releaseWakeLock();
    if (timerId) { clearInterval(timerId); timerId = null; }

    document.body.classList.remove('rolling', 'paused', 'warning');
    document.getElementById('playBtn').innerText = "Iniciar Jogo";
    document.getElementById('playBtn').className = "state-btn btn-green";
    isStarted = false;

    currentLevels = data.levels.map(line => getLevelData(line));
    
    levelDuration = data.levelTime * 60;
    currentLevel = 0;
    timeLeft = currentLevels[0].duration; // Use the first level's duration

    syncFormWithConfig(data);
    updateDisplay();
    hideConfig();
}
function syncFormWithConfig(config) {
    const inputLevel = document.getElementById('input-level-time');
    const inputBlinds = document.getElementById('input-blinds');

    if (inputLevel) inputLevel.value = config.levelTime;
    if (inputBlinds) inputBlinds.value = config.levels.join('\n');
}
function showConfig() {
    document.getElementById('config-overlay').style.display = 'flex';
}
function hideConfig() {
    document.getElementById('config-overlay').style.display = 'none';
}
function getLevelData(line) {
    const parts = line.split(':');
    const labelPart = parts[0].trim();
    const duration = parts[1] ? parseInt(parts[1]) * 60 : levelDuration;
    const bigBlindNum = parseFloat(labelPart);

    if (isNaN(bigBlindNum)) {
        return { 
            displayValue: labelPart, 
            duration: duration, 
            isBreak: true
        };
    } else {
        const smallBlindNum = bigBlindNum / 2;
        const sbDisplay = formatShorthand(smallBlindNum);
        const bbDisplay = formatShorthand(bigBlindNum);

        return { 
            displayValue: `${sbDisplay} | ${bbDisplay}`, 
            duration: duration,
            isBreak: false
        };
    }
}
function formatShorthand(num) {
    if (isNaN(num)) return num;

    const entry = num.toString();
    // Use Number.isInteger to avoid "0.0K" for simple cases
    let kValue = (num / 1000);
    let withMultiplier = (Number.isInteger(kValue) ? kValue : kValue.toFixed(1)) + "K";

    // "The Efficiency Check"
    // Example: 500 (3 chars) vs 0.5K (4 chars) -> Use 500
    // Example: 1000 (4 chars) vs 1K (2 chars) -> Use 1K
    return withMultiplier.length <= entry.length ? withMultiplier : entry;
}
function adjustTime(seconds) {
    timeLeft += seconds;
    if (timeLeft < 0) timeLeft = 0;
    updateDisplay();
}

// System/Init
function startWallClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('wall-clock').innerText = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    }, 1000);
}
function playAlarm() {
    const audio = document.getElementById('alarmSound');
    audio.currentTime = 0;
    audio.play().catch(() => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
        osc.start(); osc.stop(ctx.currentTime + 1);
    });
}
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}
async function releaseWakeLock() {
    if (wakeLock !== null) {
        try {
            await wakeLock.release();
            wakeLock = null; // Important: Clear the reference
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
}
async function init() {
    startWallClock();
    
    const saved = localStorage.getItem('customPokerConfig');
    
    if (saved) {
        // applyConfig agora chama syncFormWithConfig internamente
        applyConfig(JSON.parse(saved));
    } else {
        loadPSOP(); // O loadPSOP original que chama applyConfig
    }
}

init();