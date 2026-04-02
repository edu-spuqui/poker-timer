// Global state
let currentLevels = []; 
let levelDuration = 720; 
let breakDuration = 900; 
let currentLevel = 0;
let timeLeft = 12 * 60;
let timerId = null;

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

// This now ONLY fills the form, it doesn't apply the config to the game
async function loadPSOPIntoForm() {
    try {
        const response = await fetch('./PSOP.json');
        const data = await response.json();
        syncFormWithConfig(data);
        console.log("Formulário resetado para o padrão PSOP.");
    } catch (err) {
        console.error("Erro ao buscar PSOP.json:", err);
    }
}

// Renamed for clarity: This is what actually starts the game with form values
function saveAndApplyConfig() {
    const rawBlinds = document.getElementById('input-blinds').value;
    const blindArray = rawBlinds.split('\n')
        .map(s => s.trim())
        .filter(line => line !== "");

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

async function applyConfig(config) {
    levelDuration = (parseInt(config.levelTime) || 12) * 60;
    breakDuration = (parseInt(config.breakTime) || 15) * 60;
    currentLevels = config.levels;

    currentLevel = 0;
    const isBreak = currentLevels[currentLevel] === "Intervalo";
    timeLeft = isBreak ? breakDuration : levelDuration;

    // SINCRONIZA O FORMULÁRIO
    syncFormWithConfig(config);

    hideConfig();
    updateDisplay();
}

function clearSavedConfig() {
    if(confirm("Deseja apagar sua configuração salva e voltar ao padrão PSOP?")) {
        localStorage.removeItem('customPokerConfig');
        loadPSOP();
        hideConfig();
    }
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
    
    const isBreak = currentLevels[currentLevel] === "Intervalo";
    document.getElementById('blinds').style.color = isBreak ? "#ffaa00" : "#00ff00";
    document.getElementById('timer').style.color = timeLeft <= 15 ? "#ff4444" : "#fff";
}

function changeLevel(direction) {
    if (currentLevels.length === 0) return;

    currentLevel += direction;
    if (currentLevel < 0) currentLevel = 0;
    if (currentLevel >= currentLevels.length) currentLevel = currentLevels.length - 1;
    
    const isBreak = currentLevels[currentLevel] === "Intervalo";
    timeLeft = isBreak ? breakDuration : levelDuration;
    
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
        btn.innerHTML = "Jogo<br>Pausado";
        btn.className = "state-btn btn-red";
        body.classList.remove('rolling');
    } else {
        btn.innerHTML = "Jogo<br>Rolando";
        btn.className = "state-btn btn-green";
        body.classList.add('rolling');
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
    requestWakeLock();
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