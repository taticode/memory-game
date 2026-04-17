import { gameState } from './data.js';

let flippedCards = [];
let moves = 0;
let timer = 0;
let interval = null;
let lock = false;
let matches = 0;
let currentCategory = 'animales';
let totalPairs = 0;

let gameHistory = JSON.parse(localStorage.getItem('mem_history')) || {};
let activeDecks = JSON.parse(localStorage.getItem('mem_decks')) || {};
let tutorialSeen = localStorage.getItem('mem_tut') === 'true';

const dom = {
    board: document.getElementById('game-board'),
    catNav: document.getElementById('cat-nav'),
    scorePanel: document.getElementById('score-panel'),
    progressBar: document.getElementById('progress-bar'),
    pairsCount: document.getElementById('pairs-count'),
    feedbackText: document.getElementById('feedback-text'),
    movesDisplay: document.getElementById('moves'),
    timerDisplay: document.getElementById('timer'),
    modal: document.getElementById('modal-overlay'),
    modalBody: document.getElementById('modal-content'),
    sideMenu: document.getElementById('side-menu'),
    menuToggle: document.getElementById('menu-toggle'),
    menuClose: document.getElementById('menu-close'),
    menuOverlay: document.getElementById('menu-overlay'),
    resetPanel: document.getElementById('reset-panel-btn'),
    resetAll: document.getElementById('reset-all-btn'),
    helpBtn: document.getElementById('help-btn'),
    shine: document.getElementById('global-shine'),
    sparkles: document.getElementById('sparkles-container')
};

function init(category) {
    currentCategory = category;
    flippedCards = [];
    lock = false;
    matches = 0;
    
    dom.modal.classList.remove('active');
    dom.sideMenu.classList.remove('active');
    
    clearInterval(interval);
    interval = null;

    updateMenuData();
    toggleWinEffects(false);

    if (gameHistory[category]) {
        loadCompleted(category);
    } else {
        loadNew(category);
    }

    if (!tutorialSeen) {
        showPopup('tutorial');
        tutorialSeen = true;
        localStorage.setItem('mem_tut', 'true');
    }
}

function loadCompleted(cat) {
    const data = gameHistory[cat];
    timer = data.timer;
    moves = data.moves;
    totalPairs = data.totalPairs;
    matches = totalPairs;
    
    renderStats();
    dom.progressBar.style.width = '100%';
    dom.pairsCount.textContent = `${totalPairs}/${totalPairs}`;
    dom.feedbackText.textContent = "¡Hecho!";
    renderBoard(activeDecks[cat], true);
    toggleWinEffects(true);
}

function loadNew(cat) {
    timer = 0; moves = 0;
    renderStats();
    dom.progressBar.style.width = '0%';
    
    let deck = activeDecks[cat];
    if (!deck) {
        const pool = [...gameState[cat]].sort(() => Math.random() - 0.5).slice(0, 18);
        deck = [];
        pool.forEach(item => {
            deck.push({ id: item.clave, text: item.languages.english, img: item.icono, type: 'english' });
            deck.push({ id: item.clave, text: item.languages.spanish, img: item.icono, type: 'spanish' });
        });
        deck.sort(() => Math.random() - 0.5);
        activeDecks[cat] = deck;
        localStorage.setItem('mem_decks', JSON.stringify(activeDecks));
    }
    
    totalPairs = deck.length / 2;
    dom.pairsCount.textContent = `0/${totalPairs}`;
    dom.feedbackText.textContent = "¡Busca!";
    renderBoard(deck, false);
}

function renderBoard(deck, isDone) {
    dom.board.innerHTML = '';
    deck.forEach(data => {
        const card = document.createElement('div');
        card.className = `card ${isDone ? 'flipped matched' : ''}`;
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-back"></div>
                <div class="card-face card-front ${data.type}">
                    <div class="image-wrapper"><img src="${data.img}" class="icon-img"></div>
                    <div class="word-text">${data.text}</div>
                </div>
            </div>`;
        if (!isDone) card.onclick = () => handleCardClick(card, data.id);
        dom.board.appendChild(card);
    });
}

function handleCardClick(card, id) {
    if (lock || card.classList.contains('flipped')) return;
    if (!interval) startTimer();

    card.classList.add('flipped');
    flippedCards.push({ card, id });

    if (flippedCards.length === 2) {
        lock = true;
        moves++;
        renderStats();
        
        const [c1, c2] = flippedCards;
        if (c1.id === c2.id) {
            c1.card.classList.add('matched');
            c2.card.classList.add('matched');
            matches++;
            flippedCards = [];
            lock = false;
            dom.progressBar.style.width = `${(matches/totalPairs)*100}%`;
            dom.pairsCount.textContent = `${matches}/${totalPairs}`;
            if (matches === totalPairs) handleWin();
        } else {
            setTimeout(() => {
                c1.card.classList.remove('flipped');
                c2.card.classList.remove('flipped');
                flippedCards = [];
                lock = false;
            }, 800);
        }
    }
}

function handleWin() {
    clearInterval(interval);
    gameHistory[currentCategory] = { moves, timer, totalPairs };
    localStorage.setItem('mem_history', JSON.stringify(gameHistory));
    toggleWinEffects(true);
    showPopup('victory');
    updateMenuData();
}

function toggleWinEffects(active) {
    if (active) {
        dom.shine.classList.add('active');
        createSparkles();
    } else {
        dom.shine.classList.remove('active');
        dom.sparkles.innerHTML = '';
    }
}

function createSparkles() {
    dom.sparkles.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.animationDelay = Math.random() * 2 + 's';
        dom.sparkles.appendChild(sparkle);
    }
}

function updateMenuData() {
    dom.catNav.innerHTML = '';
    const colors = { animales: '#f14343', vegetales: '#22ac0a', comida: '#ff8800', eventos: '#ff00ff', colegio: '#2196f3' };
    gameState.categoriasNames.forEach(name => {
        const isComp = !!gameHistory[name];
        const btn = document.createElement('button');
        btn.className = `btn-cat ${isComp ? 'completed' : ''}`;
        btn.style.backgroundColor = colors[name] || '#333';
        btn.innerHTML = `${name.toUpperCase()} ${isComp ? '✓' : ''}`;
        if (!isComp) btn.onclick = () => init(name);
        dom.catNav.appendChild(btn);
    });
    dom.scorePanel.innerHTML = '';
    Object.entries(gameHistory).forEach(([cat, data]) => {
        const div = document.createElement('div');
        div.className = 'score-entry';
        div.innerHTML = `<span>${cat.toUpperCase()}</span><span>${formatTime(data.timer)} | ${data.moves}</span>`;
        dom.scorePanel.appendChild(div);
    });
}

function showPopup(type) {
    dom.modalBody.innerHTML = '';
    if (type === 'victory') {
        dom.modalBody.innerHTML = `<h3>🏆 ¡GENIAL!</h3><p>Nivel ${currentCategory} completado.</p><button class="btn-action secondary" style="width:100%;margin-top:10px" onclick="location.reload()">SIGUIENTE</button>`;
    } else if (type === 'tutorial') {
        dom.modalBody.innerHTML = `<div class="modal-flex"><div class="modal-mascot-side"><div class="modal-speech">Hello!</div><img src="./assets/img/jirafa.png" class="modal-mascot-img"></div><div class="modal-text-side"><h4>¿Cómo jugar?</h4><p style="font-size:0.6rem">Empareja inglés/español. ¡Sin scroll!</p></div></div><button class="btn-action secondary" style="width:100%; margin-top: 10px;" onclick="document.getElementById('modal-overlay').classList.remove('active')">¡VAMOS!</button>`;
    } else if (type === 'confirmReset') {
        dom.modalBody.innerHTML = `<h3>¿BORRAR?</h3><div style="display:flex;gap:10px;margin-top:10px"><button class="btn-action danger" id="btn-yes-all">SÍ</button><button class="btn-action secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">NO</button></div>`;
        document.getElementById('btn-yes-all').onclick = () => { localStorage.clear(); location.reload(); };
    }
    dom.modal.classList.add('active');
}

function startTimer() { interval = setInterval(() => { timer++; renderStats(); }, 1000); }
function renderStats() { dom.timerDisplay.textContent = formatTime(timer); dom.movesDisplay.textContent = moves; }
function formatTime(s) { return `${Math.floor(s/60).toString().padStart(2, '0')}:${(s%60).toString().padStart(2, '0')}`; }

document.querySelectorAll('.accordion-header').forEach(header => {
    header.onclick = () => {
        const content = document.getElementById(header.dataset.target);
        header.classList.toggle('active');
        content.classList.toggle('open');
    };
});

dom.menuToggle.onclick = () => dom.sideMenu.classList.add('active');
dom.menuClose.onclick = () => dom.sideMenu.classList.remove('active');
dom.menuOverlay.onclick = () => dom.sideMenu.classList.remove('active');
dom.resetPanel.onclick = () => { delete activeDecks[currentCategory]; delete gameHistory[currentCategory]; localStorage.setItem('mem_decks', JSON.stringify(activeDecks)); localStorage.setItem('mem_history', JSON.stringify(gameHistory)); init(currentCategory); };
dom.resetAll.onclick = () => showPopup('confirmReset');
dom.helpBtn.onclick = () => showPopup('tutorial');

init('animales');