import { gameState } from './data.js';

/* ─── CONFIG ──────────────────────────────────────────────────────────────── */
const CONFIG = Object.freeze({
    defaultCategory: 'animales',
    pairsPerGame: 18,
    flipDelay: 800,
    storage: { 
        history: 'mem_history', 
        decks: 'mem_decks', 
        tutorial: 'mem_tut' 
    },
    categoryColors: { 
        animales: '#f14343', 
        vegetales: '#22ac0a', 
        comida: '#ff8800', 
        eventos: '#ff00ff', 
        colegio: '#2196f3' 
    }
});

/* ─── STATE ───────────────────────────────────────────────────────────────── */
const State = {
    flippedCards: [], moves: 0, timer: 0, interval: null, lock: false, matches: 0,
    currentCategory: CONFIG.defaultCategory, totalPairs: 0, 
    history: {}, 
    decks: {}, 
    tutorialSeen: false, isMuted: false,
    voices: { english: null, spanish: null }
};

/* ─── DOM ────────────────────────────────────────────────────────────────── */
const dom = {
    board: document.getElementById('game-board'),
    catNav: document.getElementById('cat-nav'),
    scorePanel: document.getElementById('score-panel'),
    progressBar: document.getElementById('progress-bar'),
    timerDisplay: document.getElementById('timer'),
    movesDisplay: document.getElementById('moves'),
    pairsCount: document.getElementById('pairs-count'),
    modal: document.getElementById('modal-overlay'),
    modalBody: document.getElementById('modal-content'),
    sideMenu: document.getElementById('side-menu'),
    menuToggle: document.getElementById('menu-toggle'),
    menuClose: document.getElementById('menu-close'),
    menuOverlay: document.getElementById('menu-overlay'),
    resetAll: document.getElementById('reset-all-btn'),
    helpBtn: document.getElementById('help-btn'),
    soundToggle: document.getElementById('sound-toggle')
};

/* ─── BOOTSTRAP ──────────────────────────────────────────────────────────── */
function bootstrap() {
    const savedHistory = localStorage.getItem(CONFIG.storage.history);
    State.history = savedHistory ? JSON.parse(savedHistory) : {};
    State.decks = JSON.parse(localStorage.getItem(CONFIG.storage.decks) || '{}');
    State.tutorialSeen = localStorage.getItem(CONFIG.storage.tutorial) === 'true';
    
    bindEvents();
    initVoices();
    init(CONFIG.defaultCategory);
}

/* ─── LÓGICA DE VOZ ──────────────────────────────────────────────────────── */
function initVoices() {
    const load = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) {
            State.voices.english = v.find(x => x.lang.startsWith('en'));
            State.voices.spanish = v.find(x => x.lang.startsWith('es'));
        }
    };
    load();
    if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = load;
}

function speak(t, lang) {
    if (State.isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const ut = new SpeechSynthesisUtterance(t);
    const v = lang === 'english' ? State.voices.english : State.voices.spanish;
    if (v) ut.voice = v;
    ut.lang = lang === 'english' ? 'en-US' : 'es-ES';
    window.speechSynthesis.speak(ut);
}

/* ─── CORE JUEGO ─────────────────────────────────────────────────────────── */
function init(category) {
    State.currentCategory = category;
    State.flippedCards = []; State.lock = false; State.matches = 0;
    State.timer = 0; State.moves = 0;
    clearInterval(State.interval); State.interval = null;
    
    dom.board.className = `board-grid ${category}`;
    closeSideMenu();
    updateMenuData();
    renderStats();
    
    if (State.history[category]) loadCompleted(category);
    else loadNew(category);
}

function loadNew(cat) {
    let deck = State.decks[cat];
    if (!deck) {
        const pool = [...gameState[cat]].sort(() => Math.random() - 0.5).slice(0, CONFIG.pairsPerGame);
        deck = [];
        pool.forEach(item => {
            deck.push({ id: item.clave, text: item.languages.english, img: item.icono, type: 'english' });
            deck.push({ id: item.clave, text: item.languages.spanish, img: item.icono, type: 'spanish' });
        });
        deck.sort(() => Math.random() - 0.5);
        State.decks[cat] = deck;
        localStorage.setItem(CONFIG.storage.decks, JSON.stringify(State.decks));
    }
    State.totalPairs = deck.length / 2;
    renderBoard(deck, false);
    setProgress(0, 0, State.totalPairs);
}

function loadCompleted(cat) {
    const d = State.history[cat];
    State.timer = d.timer; State.moves = d.moves; State.totalPairs = d.totalPairs; State.matches = d.totalPairs;
    renderStats();
    setProgress(100, d.totalPairs, d.totalPairs);
    renderBoard(State.decks[cat], true);
}

function renderBoard(deck, isDone) {
    dom.board.innerHTML = '';
    deck.forEach(data => {
        const card = el('div', null, `card${isDone ? ' flipped matched' : ''}`);
        const inner = el('div', null, 'card-inner');
        const front = el('div', null, `card-face card-front ${data.type}`);
        const back = el('div', null, 'card-face card-back');
        const imgWrapper = el('div', null, 'img-wrapper');
        const img = el('img'); img.src = data.img; img.className = 'icon-img';
        imgWrapper.appendChild(img);
        front.append(imgWrapper, el('div', data.text, 'word-text'));
        inner.append(back, front);
        card.appendChild(inner);
        card.onclick = () => handleCardClick(card, data);
        dom.board.appendChild(card);
    });
}

function handleCardClick(card, data) {
    if (card.classList.contains('matched') || card.classList.contains('flipped') || State.lock) return;
    if (!State.interval) startTimer();
    speak(data.text, data.type);
    card.classList.add('flipped');
    State.flippedCards.push({ card, id: data.id });
    if (State.flippedCards.length === 2) {
        State.lock = true; State.moves++; renderStats(); checkMatch();
    }
}

function checkMatch() {
    const [c1, c2] = State.flippedCards;
    if (c1.id === c2.id) {
        [c1.card, c2.card].forEach(c => c.classList.add('matched'));
        State.matches++; State.flippedCards = []; State.lock = false;
        setProgress((State.matches / State.totalPairs) * 100, State.matches, State.totalPairs);
        if (State.matches === State.totalPairs) handleWin();
    } else {
        setTimeout(() => {
            [c1.card, c2.card].forEach(c => c.classList.remove('flipped'));
            State.flippedCards = []; State.lock = false;
        }, CONFIG.flipDelay);
    }
}

/* ─── VICTORIA Y GUARDADO ───────────────────────────────────────────────── */
function handleWin() {
    clearInterval(State.interval);
    
    const finalTimeStr = dom.timerDisplay.textContent;

    State.history[State.currentCategory] = { 
        moves: State.moves, 
        timer: State.timer, 
        totalPairs: State.totalPairs,
        timeStr: finalTimeStr
    };
    
    localStorage.setItem(CONFIG.storage.history, JSON.stringify(State.history));
    
    if (typeof confetti === 'function') {
        confetti({ 
            particleCount: 200, 
            spread: 90, 
            origin: { y: 0.7 },
            zIndex: 10000 
        });
    }
    
    updateMenuData();
    showPopup('victory');
}

function showPopup(type) {
    dom.modalBody.innerHTML = '';
    if (type === 'victory') {
        const imgCont = el('div', null, 'modal-image-container');
        const img = el('img'); 
        img.src = "./assets/img/jirafa.png"; 
        imgCont.appendChild(img);

        const statsRow = el('div', null, 'modal-stats-row');
        statsRow.append(
            createStatItem('TIEMPO', dom.timerDisplay.textContent),
            createStatItem('PASOS', State.moves.toString())
        );

        const btn = el('button', 'SIGUIENTE NIVEL', 'btn-action primary');
        btn.onclick = () => { dom.modal.classList.remove('active'); openSideMenu(); };

        dom.modalBody.append(imgCont, el('h2', '¡GENIAL!', 'modal-title'), el('p', 'Nivel completado', 'modal-subtitle'), statsRow, btn);
    } else {
        const btn = el('button', '¡VAMOS!', 'btn-action secondary');
        btn.onclick = () => dom.modal.classList.remove('active');
        dom.modalBody.append(el('h4', 'TUTORIAL', 'modal-title-small'), el('p', 'Une las parejas de inglés y español.', 'modal-text'), btn);
    }
    dom.modal.classList.add('active');
}

function createStatItem(label, value) {
    const item = el('div', null, 'modal-stat-item');
    item.append(el('span', label, 'stat-label'), el('span', value, 'stat-value'));
    return item;
}

/* ─── UI HELPERS ────────────────────────────────────────────────────────── */
function el(tag, text, className) {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    if (className) e.className = className;
    return e;
}

function setProgress(pct, m, t) {
    dom.progressBar.style.width = `${pct}%`;
    dom.pairsCount.textContent = `${m}/${t}`;
}

function startTimer() { State.interval = setInterval(() => { State.timer++; renderStats(); }, 1000); }

function renderStats() {
    const m = Math.floor(State.timer / 60).toString().padStart(2, '0');
    const s = (State.timer % 60).toString().padStart(2, '0');
    dom.timerDisplay.textContent = `${m}:${s}`;
    dom.movesDisplay.textContent = State.moves;
}

function updateRecordsList() {
    dom.scorePanel.innerHTML = '';
    const records = Object.entries(State.history);
    
    if (records.length === 0) {
        dom.scorePanel.innerHTML = '<p class="empty-msg">Aún no tienes récords</p>';
        return;
    }

    records.forEach(([cat, data]) => {
        let displayTime = data.timeStr;
        if (!displayTime && data.timer !== undefined) {
            const m = Math.floor(data.timer / 60).toString().padStart(2, '0');
            const s = (data.timer % 60).toString().padStart(2, '0');
            displayTime = `${m}:${s}`;
        }

        const row = el('div', null, 'score-row');
        row.innerHTML = `
            <span class="score-cat">${cat}</span>
            <span class="score-data">⏱ ${displayTime || '--:--'} | 👟 ${data.moves || 0}</span>
        `;
        dom.scorePanel.appendChild(row);
    });
}

function updateMenuData() {
    dom.catNav.innerHTML = '';
    gameState.categoriasNames.forEach(name => {
        const record = State.history[name];
        const btn = el('button', name.toUpperCase() + (record ? ' ✓' : ''), `btn-cat${record ? ' completed' : ''}`);
        btn.style.backgroundColor = CONFIG.categoryColors[name];
        btn.onclick = () => init(name);
        dom.catNav.appendChild(btn);
    });
    updateRecordsList(); 
}

function openSideMenu() { dom.sideMenu.classList.add('active'); dom.menuOverlay.classList.add('active'); }
function closeSideMenu() { dom.sideMenu.classList.remove('active'); dom.menuOverlay.classList.remove('active'); }

function bindEvents() {
    dom.menuToggle.onclick = openSideMenu;
    dom.menuClose.onclick = closeSideMenu;
    dom.menuOverlay.onclick = closeSideMenu;
    dom.helpBtn.onclick = () => showPopup('tutorial');
    dom.soundToggle.onclick = () => {
        State.isMuted = !State.isMuted;
        dom.soundToggle.textContent = State.isMuted ? '🔇' : '🔊';
    };
    dom.resetAll.onclick = () => { if(confirm('¿Borrar récords?')){ localStorage.clear(); location.reload(); }};
    
    document.querySelectorAll('.accordion-header').forEach(h => {
        h.onclick = () => {
            h.classList.toggle('active');
            const target = document.getElementById(h.dataset.target);
            target.classList.toggle('open');
        };
    });
}

bootstrap();