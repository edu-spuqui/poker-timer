// --- PRESETS CONFIGURATION ---
const PRESETS = {
    "psop": { name: "Pilarzinho Series of Poker", file: "./PSOP.json" },
    "new1": { name: "Slot Livre 1", file: "./new1.json" }, // Example for future use
    "new2": { name: "Slot Livre 2", file: "./new2.json" } // Example
};

// Global state
let currentLevels = []; 
let levelDuration = 720; 
let breakDuration = 900; 
let currentLevel = 0;
let timeLeft = 12 * 60;
let timerId = null;
let isStarted = false; // New flag to lock the UI after the first start

// --- CONFIGURATION LOGIC ---

// This helper is for the initial page load only
async function loadPSOP() {
    try {
        const response = await fetch('./PSOP.json');
        const data = await response.json();
        applyConfig(data);
    } catch (err) {
        console.error("Erro no carregamento inicial:", err);
    }
}
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
        document.getElementById('input-break-time').value = data.breakTime;
        document.getElementById('input-blinds').value = data.levels.join('\n');
        
        console.log(`Formulário populado com: ${PRESETS[selectedKey].name}`);
    } catch (err) {
        alert("Erro ao carregar o preset. Verifique se o arquivo .json existe.");
        console.error(err);
    }
}

// Renamed for clarity: This is what actually starts the game with form values
function saveAndApplyConfig() {
    const rawBlinds = document.getElementById('input-blinds').value;
    const blindArray = rawBlinds.split('\n')
        // .map(s => s.trim())
        .filter(line => line.trim() !== "");

    if (blindArray.length === 0) {
        alert("A estrutura de blinds não pode estar vazia!");
        return;
    }

    const customData = {
        name: "Sessão Personalizada", // This name identifies the save
        levelTime: parseInt(document.getElementById('input-level-time').value) || 12,
        breakTime: parseInt(document.getElementById('input-break-time').value) || 15,
        levels: blindArray
    };

    // RESTORED: Save to local storage
    localStorage.setItem('customPokerConfig', JSON.stringify(customData));
    
    applyConfig(customData);
}
function applyConfig(data) {
    releaseWakeLock();
	
	// 1. Stop the timer and clear the interval
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }

    // 2. Reset the Start Button UI and State
    document.body.classList.remove('rolling');
    document.body.classList.remove('paused');
    document.body.classList.remove('warning');
	const btn = document.getElementById('playBtn');
    if (btn) {
        btn.innerText = "Iniciar Jogo";
        btn.className = "state-btn btn-green";
    }
    isStarted = false; // Allow adjustment arrows to reappear
	
    // 3. Load the data into the app's engine
    currentLevels = data.levels;
    levelDuration = (data.levelTime || 12) * 60;
    breakDuration = (data.breakTime || 15) * 60;
    currentLevel = 0;
    
    // Set initial time based on first level content
    
	if (currentLevels[0].toLowerCase().includes("intervalo")) {
        timeLeft = breakDuration;
    } else {
        timeLeft = levelDuration;
    }

    // 4. SYNC: Update the form fields to match the new configuration
    syncFormWithConfig(data);

    // 5. Refresh the UI and Close
    updateDisplay();
    hideConfig();
}
function syncFormWithConfig(config) {
    const inputLevel = document.getElementById('input-level-time');
    const inputBreak = document.getElementById('input-break-time');
    const inputBlinds = document.getElementById('input-blinds');

    if (inputLevel) inputLevel.value = config.levelTime;
    if (inputBreak) inputBreak.value = config.breakTime;
    if (inputBlinds) inputBlinds.value = config.levels.join('\n');
}
function saveCustomGame() {
    const rawBlinds = document.getElementById('input-blinds').value;
    const blindArray = rawBlinds.split('\n').filter(line => line.trim() !== "");

    const customData = {
        name: "Custom Game",
        levelTime: parseInt(document.getElementById('input-level-time').value),
        breakTime: parseInt(document.getElementById('input-break-time').value),
        levels: blindArray
    };

    localStorage.setItem('customPokerConfig', JSON.stringify(customData));
    applyConfig(customData);
}
function showConfig() {
    document.getElementById('config-overlay').style.display = 'flex';
}
function hideConfig() {
    document.getElementById('config-overlay').style.display = 'none';
}

// --- CORE TIMER LOGIC ---
function updateDisplay() {
    if (currentLevels.length === 0) {
        document.getElementById('blinds').innerText = "Carregar Jogo";
        document.getElementById('next').innerText = "Abra as configurações";
        return;
    }

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    document.getElementById('timer').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    document.getElementById('blinds').innerText = currentLevels[currentLevel];
    document.getElementById('next').innerText = "Próximo nível: " + (currentLevels[currentLevel + 1] || "Acabou!");
    
	// Update buttons visibility based on isStarted
    const adjButtons = document.querySelectorAll('.adj-btn');
    adjButtons.forEach(btn => {
        // Hide if the game has started, regardless of pause state
        btn.style.visibility = isStarted ? 'hidden' : 'visible';
    });
	
   	const levelText = currentLevels[currentLevel].toLowerCase();
    const isBreak = levelText.includes("intervalo");
    document.getElementById('blinds').style.color = isBreak ? "#fa0" : "#fff";
    const body = document.getElementById('mainBody');
	if (timeLeft <= 10)	body.classList.add('warning');
}
function changeLevel(direction) {
    if (currentLevels.length === 0) return;
	document.body.classList.remove('warning');

    currentLevel += direction;
    if (currentLevel < 0) currentLevel = 0;
    if (currentLevel >= currentLevels.length) currentLevel = currentLevels.length - 1;
    
	const levelText = currentLevels[currentLevel].toLowerCase();
    if (levelText.includes("intervalo")) { timeLeft = breakDuration; }
	else { timeLeft = levelDuration; }
    
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
function adjustTime(seconds) {
    timeLeft += seconds;
    if (timeLeft < 0) timeLeft = 0;
    updateDisplay();
}

// --- UTILITIES & AUDIO ---
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
let wakeLock = null;
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

// --- INITIALIZATION ---
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