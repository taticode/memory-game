import { gameState } from './data.js';

const CONFIG = Object.freeze({
    defaultCategory: 'animales',
    pairsPerGame: 18,
    flipDelay: 800,
    storage: { history: 'mem_history', decks: 'mem_decks', tutorial: 'mem_tut' },
    categoryColors: { animales: '#f14343', vegetales: '#22ac0a', comida: '#ff8800', eventos: '#ff00ff', colegio: '#2196f3' }
});

const State = {
    flippedCards: [], moves: 0, timer: 0, interval: null, lock: false, matches: 0,
    currentCategory: CONFIG.defaultCategory, totalPairs: 0, history: {}, decks: {}, 
    tutorialSeen: false, isMuted: false,
    voices: { english: null, spanish: null }
};

const dom = {
    board: document.getElementById('game-board'),
    catNav: document.getElementById('cat-nav'),
    scorePanel: document.getElementById('score-panel'),
    progressBar: document.getElementById('progress-bar'),
    timerDisplay: document.getElementById('timer'),
    movesDisplay: document.getElementById('moves'),
    pairsCount: document.getElementById('pairs-count'),
    feedbackText: document.getElementById('feedback-text'),
    modal: document.getElementById('modal-overlay'),
    modalBody: document.getElementById('modal-content'),
    sideMenu: document.getElementById('side-menu'),
    menuToggle: document.getElementById('menu-toggle'),
    menuClose: document.getElementById('menu-close'),
    menuOverlay: document.getElementById('menu-overlay'),
    resetPanel: document.getElementById('reset-panel-btn'),
    resetAll: document.getElementById('reset-all-btn'),
    helpBtn: document.getElementById('help-btn'),
    soundToggle: document.getElementById('sound-toggle'),
    shine: document.getElementById('global-shine'),
    sparkles: document.getElementById('sparkles-container')
};

/* ─── VOZ (SOLUCIÓN AL DELAY) ────────────────────────────────────────────── */
function initVoices() {
    const load = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) {
            // Prioridad a voces locales para evitar latencia de red
            State.voices.english = v.find(x => (x.lang === 'en-US' || x.lang === 'en_US') && !x.localService) || 
                                   v.find(x => x.lang.startsWith('en'));
            State.voices.spanish = v.find(x => (x.lang === 'es-ES' || x.lang === 'es_ES') && !x.localService) || 
                                   v.find(x => x.lang.startsWith('es'));
        }
    };

    load();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = load;
    }
    // Re-intento por si el navegador es lento cargando el catálogo
    setTimeout(load, 1000);
}

function speak(text, type) {
    if (State.isMuted || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = type === 'english' ? State.voices.english : State.voices.spanish;
    
    if (voice) utterance.voice = voice;
    utterance.lang = type === 'english' ? 'en-US' : 'es-ES';
    utterance.rate = 1.0;
    
    window.speechSynthesis.speak(utterance);
}

/* ─── JUEGO ──────────────────────────────────────────────────────────────── */
function bootstrap() {
    State.history = JSON.parse(localStorage.getItem(CONFIG.storage.history) || '{}');
    State.decks = JSON.parse(localStorage.getItem(CONFIG.storage.decks) || '{}');
    State.tutorialSeen = localStorage.getItem(CONFIG.storage.tutorial) === 'true';
    bindEvents();
    initVoices();
    init(CONFIG.defaultCategory);
}

function init(category) {
    State.currentCategory = category;
    State.flippedCards = []; State.lock = false; State.matches = 0;
    State.timer = 0; State.moves = 0;
    clearInterval(State.interval); State.interval = null;
    
    dom.board.className = `board-grid ${category}`;
    closeSideMenu();
    updateMenuData();
    
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
    renderStats();
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
        const txt = el('div', data.text, 'word-text');
        imgWrapper.appendChild(img);
        front.append(imgWrapper, txt);
        inner.append(back, front);
        card.appendChild(inner);

        card.onclick = () => handleCardClick(card, data);
        dom.board.appendChild(card);
    });
}

function handleCardClick(card, data) {
    if (card.classList.contains('matched') || card.classList.contains('flipped')) {
        speak(data.text, data.type);
        return;
    }
    if (State.lock) return;

    if (!State.interval) startTimer();
    
    speak(data.text, data.type);
    card.classList.add('flipped');
    State.flippedCards.push({ card, id: data.id });

    if (State.flippedCards.length === 2) {
        State.lock = true;
        State.moves++;
        renderStats();
        checkMatch();
    }
}

function checkMatch() {
    const [c1, c2] = State.flippedCards;
    if (c1.id === c2.id) {
        c1.card.classList.add('matched');
        c2.card.classList.add('matched');
        State.matches++;
        State.flippedCards = [];
        State.lock = false;
        const pct = (State.matches / State.totalPairs) * 100;
        setProgress(pct, State.matches, State.totalPairs);
        if (State.matches === State.totalPairs) handleWin();
    } else {
        setTimeout(() => {
            c1.card.classList.remove('flipped');
            c2.card.classList.remove('flipped');
            State.flippedCards = [];
            State.lock = false;
        }, CONFIG.flipDelay);
    }
}

function handleWin() {
    clearInterval(State.interval);
    State.history[State.currentCategory] = { moves: State.moves, timer: State.timer, totalPairs: State.totalPairs };
    localStorage.setItem(CONFIG.storage.history, JSON.stringify(State.history));
    fireConfetti();
    showPopup('victory');
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

function updateMenuData() {
    dom.catNav.innerHTML = '';
    gameState.categoriasNames.forEach(name => {
        const isComp = !!State.history[name];
        const btn = el('button', name.toUpperCase() + (isComp ? ' ✓' : ''), `btn-cat${isComp ? ' completed' : ''}`);
        btn.style.backgroundColor = CONFIG.categoryColors[name];
        btn.onclick = () => init(name);
        dom.catNav.appendChild(btn);
    });
}

function openSideMenu() { dom.sideMenu.classList.add('active'); dom.menuOverlay.style.display = 'block'; }
function closeSideMenu() { dom.sideMenu.classList.remove('active'); dom.menuOverlay.style.display = 'none'; }

function showPopup(type) {
    dom.modalBody.innerHTML = '';
    
    if (type === 'victory') {
        // 1. Contenedor de la imagen (Jirafa)
        const imgWrapper = el('div', null, 'modal-image-container');
        const img = el('img');
        img.src = "./assets/img/jirafa.png"; 
        img.alt = "Jirafa celebrando";
        imgWrapper.appendChild(img);

        // 2. Títulos
        const title = el('h2', '¡GENIAL!', 'modal-title');
        const subtitle = el('p', 'Has completado el nivel', 'modal-subtitle');

        // 3. Estadísticas del panel terminado
        const statsRow = el('div', null, 'modal-stats-row');
        
        const timeStat = el('div', null, 'modal-stat-item');
        timeStat.append(el('span', 'TIEMPO', 'stat-label'), el('span', dom.timerDisplay.textContent, 'stat-value'));
        
        const movesStat = el('div', null, 'modal-stat-item');
        movesStat.append(el('span', 'PASOS', 'stat-label'), el('span', State.moves.toString(), 'stat-value'));
        
        statsRow.append(timeStat, movesStat);

        // 4. Botón de acción
        const nextBtn = el('button', 'SIGUIENTE NIVEL', 'btn-action primary');
        nextBtn.onclick = () => {
            dom.modal.classList.remove('active');
            openSideMenu(); // Sugerimos elegir otro nivel
        };

        dom.modalBody.append(imgWrapper, title, subtitle, statsRow, nextBtn);
        
    } else {
        // Modal de Tutorial (Simple)
        dom.modalBody.append(
            el('h4', '¿CÓMO JUGAR?', 'modal-title-small'),
            el('p', 'Encuentra las parejas relacionando la palabra en inglés con su traducción al español.', 'modal-text'),
            el('button', '¡ENTENDIDO!', 'btn-action secondary')
        );
        dom.modalBody.querySelector('button').onclick = () => dom.modal.classList.remove('active');
    }

    dom.modal.classList.add('active');
}

function fireConfetti() { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }

function bindEvents() {
    dom.menuToggle.onclick = openSideMenu;
    dom.menuClose.onclick = closeSideMenu;
    dom.menuOverlay.onclick = closeSideMenu;
    dom.helpBtn.onclick = () => showPopup('tutorial');
    
    dom.soundToggle.onclick = () => {
        State.isMuted = !State.isMuted;
        dom.soundToggle.textContent = State.isMuted ? '🔇' : '🔊';
        dom.soundToggle.setAttribute('aria-label', State.isMuted ? 'Activar sonido' : 'Desactivar sonido');
    };

    dom.resetAll.onclick = () => {
        if (confirm('¿Borrar todos tus récords?')) {
            localStorage.clear();
            location.reload();
        }
    };

    document.querySelectorAll('.accordion-header').forEach(h => {
        h.onclick = () => {
            h.classList.toggle('active');
            const target = document.getElementById(h.dataset.target);
            target.classList.toggle('open');
        };
    });
}

// EXPOSICIÓN MANUAL: Esto saca la función al exterior
window.debugWin = () => showPopup('victory');

// Auto-ejecución al cargar para no tener que escribir nada
setTimeout(() => window.debugWin(), 500);

bootstrap();