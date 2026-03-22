/* 
  G-Block Tetris: Liquid Candy
  Architecture: Canvas 2D + Game Engine with requestAnimationFrame
*/

const COLS = 10;
const ROWS = 20;
let BLOCK_SIZE = 30; // will be calculated dynamically based on canvas width

// Pastel Liquid Candy Colors 🌈
const COLORS = [
    null,
    ['#ff9a9e', '#fecfef'], // Pastel Pink
    ['#ffdfba', '#ffb3ba'], // Pastel Peach
    ['#baffc9', '#81ecec'], // Pastel Green
    ['#a29bfe', '#dfe6e9'], // Pastel Purple
    ['#74b9ff', '#81ecec'], // Pastel Blue
    ['#ffeaa7', '#fdcb6e'], // Pastel Yellow
    ['#fab1a0', '#ff7675']  // Pastel Coral
];

// Tetrominoes
const SHAPES = [
    [],
    [[1,1,1,1]], // I
    [[2,0,0],[2,2,2]], // J
    [[0,0,3],[3,3,3]], // L
    [[4,4],[4,4]], // O
    [[0,5,5],[5,5,0]], // S
    [[0,6,0],[6,6,6]], // T
    [[7,7,0],[0,7,7]]  // Z
];

class Tetromino {
    constructor(type) {
        this.type = type;
        this.matrix = SHAPES[type];
        this.x = Math.floor(COLS / 2) - Math.floor(this.matrix[0].length / 2);
        this.y = 0;
    }
}

// Global Game State
const GAME = {
    canvas: null,
    ctx: null,
    nextCtx: null,
    board: Array.from({length: ROWS}, () => Array(COLS).fill(0)),
    piece: null,
    nextPiece: null,
    dropInterval: 1000,
    dropCounter: 0,
    lastTime: 0,
    score: 0,
    lives: 3,
    state: 'START', // START, PLAYING, GAMEOVER
    particles: [],
    slowTimeActive: false,
    combo: 0,
    notified90: false,
    notified50: false,
    slowItems: 0,
    giftItems: 0
};

// UI Elements
const UI = {
    startScreen: document.getElementById('start-screen'),
    popupOverlay: document.getElementById('popup-overlay'),
    score: document.getElementById('score'),
    lives: document.getElementById('lives-count'),
    pizzaFill: document.getElementById('pizza-fill'),
    pizzaText: document.getElementById('pizza-text'),
    floatContainer: document.getElementById('floating-text-container')
};

/* --- RENDERER --- */
function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Fit grid into container
    BLOCK_SIZE = Math.min(width / COLS, height / ROWS);
    
    GAME.canvas.width = BLOCK_SIZE * COLS;
    GAME.canvas.height = BLOCK_SIZE * ROWS;
}

function initCanvas() {
    GAME.canvas = document.getElementById('game-canvas');
    GAME.ctx = GAME.canvas.getContext('2d');
    const nextCanvas = document.getElementById('next-canvas');
    GAME.nextCtx = nextCanvas.getContext('2d');
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}

function drawBlock(ctx, x, y, type, alpha = 1, isGhost = false, customSize = 0) {
    if (!type) return;
    
    const colors = COLORS[type];
    const size = customSize || BLOCK_SIZE;
    const px = x * size;
    const py = y * size;
    const padding = customSize ? 0 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    
    if (isGhost) {
        ctx.fillStyle = `rgba(255,255,255,0.15)`;
        ctx.strokeStyle = colors[0];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(px + padding, py + padding, size - padding * 2, size - padding * 2);
        ctx.fill();
        ctx.stroke();
    } else {
        const w = size - padding * 2;
        const h = size - padding * 2;
        const bx = px + padding;
        const by = py + padding;

        const bevel = Math.max(2, size * 0.15);

        // Base background (Lighter)
        ctx.fillStyle = colors[1];
        ctx.fillRect(bx, by, w, h);

        // Top Bevel Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + w, by);
        ctx.lineTo(bx + w - bevel, by + bevel);
        ctx.lineTo(bx + bevel, by + bevel);
        ctx.fill();

        // Left Bevel Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by + h);
        ctx.lineTo(bx + bevel, by + h - bevel);
        ctx.lineTo(bx + bevel, by + bevel);
        ctx.fill();

        // Bottom Bevel Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(bx, by + h);
        ctx.lineTo(bx + w, by + h);
        ctx.lineTo(bx + w - bevel, by + h - bevel);
        ctx.lineTo(bx + bevel, by + h - bevel);
        ctx.fill();

        // Right Bevel Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(bx + w, by);
        ctx.lineTo(bx + w, by + h);
        ctx.lineTo(bx + w - bevel, by + h - bevel);
        ctx.lineTo(bx + w - bevel, by + bevel);
        ctx.fill();

        // Center Solid (Darker)
        ctx.fillStyle = colors[0];
        ctx.fillRect(bx + bevel, by + bevel, w - bevel * 2, h - bevel * 2);

        // Center Glass Glare (Upper Half)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(bx + bevel, by + bevel, w - bevel * 2, (h - bevel * 2) / 2);
    }
    
    ctx.restore();
}

function drawBoard() {
    // Grid lines for glass effect
    GAME.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    GAME.ctx.lineWidth = 1.5;
    for(let i=0; i<=COLS; i++) {
        GAME.ctx.beginPath(); GAME.ctx.moveTo(i*BLOCK_SIZE, 0); GAME.ctx.lineTo(i*BLOCK_SIZE, GAME.canvas.height); GAME.ctx.stroke();
    }
    for(let i=0; i<=ROWS; i++) {
        GAME.ctx.beginPath(); GAME.ctx.moveTo(0, i*BLOCK_SIZE); GAME.ctx.lineTo(GAME.canvas.width, i*BLOCK_SIZE); GAME.ctx.stroke();
    }

    // Draw landed blocks
    GAME.board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                drawBlock(GAME.ctx, x, y, value);
            }
        });
    });
}

function getGhostY() {
    let ghostY = GAME.piece.y;
    while (!collide(GAME.board, GAME.piece, 0, 1, ghostY)) {
        ghostY++;
    }
    return ghostY;
}

function drawPiece() {
    if (!GAME.piece) return;

    // Draw Ghost
    const ghostY = getGhostY();
    GAME.piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                drawBlock(GAME.ctx, GAME.piece.x + x, ghostY + y, value, 1, true);
            }
        });
    });

    // Draw Active
    GAME.piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                drawBlock(GAME.ctx, GAME.piece.x + x, GAME.piece.y + y, value);
            }
        });
    });
}

function drawNextPiece() {
    GAME.nextCtx.clearRect(0, 0, 70, 70);
    if (!GAME.nextPiece) return;
    
    const previewSize = 16;
    const offsetX = (70 - GAME.nextPiece.matrix[0].length * previewSize) / 2;
    const offsetY = (70 - GAME.nextPiece.matrix.length * previewSize) / 2;

    GAME.nextCtx.save();
    GAME.nextCtx.translate(offsetX, offsetY);
    GAME.nextPiece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                drawBlock(GAME.nextCtx, x, y, value, 1, false, previewSize);
            }
        });
    });
    GAME.nextCtx.restore();
}

function drawParticles() {
    for (let i = GAME.particles.length - 1; i >= 0; i--) {
        const p = GAME.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 2;
        p.vy += 0.15; // smooth gravity
        p.rotation += p.rv;

        if (p.life <= 0) {
            GAME.particles.splice(i, 1);
            continue;
        }

        GAME.ctx.save();
        GAME.ctx.translate(p.x * BLOCK_SIZE, p.y * BLOCK_SIZE);
        GAME.ctx.rotate(p.rotation);
        
        // Base shard color
        GAME.ctx.fillStyle = p.color;
        GAME.ctx.globalAlpha = p.life / 100;
        GAME.ctx.beginPath();
        GAME.ctx.rect(-p.size, -p.size/2, p.size*2, p.size);
        GAME.ctx.fill();
        
        // Shiny reflection on shard
        GAME.ctx.fillStyle = `rgba(255,255,255,0.8)`;
        GAME.ctx.rect(-p.size, -p.size/2, p.size, p.size/2);
        GAME.ctx.fill();

        GAME.ctx.restore();
    }
}

function render() {
    GAME.ctx.clearRect(0,0, GAME.canvas.width, GAME.canvas.height);
    drawBoard();
    drawPiece();
    drawParticles();
    drawNextPiece();
}

/* --- GAME LOGIC --- */
function createPiece(type) {
    if(!type) type = Math.floor(Math.random() * 7) + 1;
    return new Tetromino(type);
}

function resetGame() {
    GAME.board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
    GAME.score = 0;
    GAME.dropInterval = 1000;
    GAME.combo = 0;
    GAME.notified90 = false;
    GAME.notified50 = false;
    GAME.slowItems = 0;
    GAME.giftItems = 0;
    document.getElementById('inv-slow-count').innerText = "0";
    document.getElementById('inv-gift-count').innerText = "0";
    GAME.piece = createPiece();
    GAME.nextPiece = createPiece();
    GAME.particles = [];
    updateScore();
}

function collide(board, piece, offX=0, offY=0, checkY=null) {
    const p = piece;
    const testY = checkY !== null ? checkY : p.y;
    for (let y = 0; y < p.matrix.length; ++y) {
        for (let x = 0; x < p.matrix[y].length; ++x) {
            if (p.matrix[y][x] !== 0 &&
               (board[y + testY + offY] && board[y + testY + offY][x + p.x + offX]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge() {
    GAME.piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                GAME.board[y + GAME.piece.y][x + GAME.piece.x] = value;
            }
        });
    });
}

function rotate(piece) {
    const origMatrix = piece.matrix;
    const yLen = origMatrix.length;
    const xLen = origMatrix[0].length;
    let newMatrix = Array.from({length: xLen}, () => Array(yLen).fill(0));
    
    for (let y = 0; y < yLen; ++y) {
        for (let x = 0; x < xLen; ++x) {
            newMatrix[x][yLen - 1 - y] = origMatrix[y][x];
        }
    }
    
    const prevMatrix = piece.matrix;
    piece.matrix = newMatrix;
    
    let offset = 1;
    let limit = 5;
    let pos = piece.x;
    while(collide(GAME.board, piece)) {
        piece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        limit--;
        if(limit === 0) {
            piece.matrix = prevMatrix;
            piece.x = pos;
            return;
        }
    }
    vibrate(10);
}

function playSound(type) {
    // Optional placeholder.
}

function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

function showFloatText(text, x, y, color="#fff") {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.innerText = text;
    el.style.left = `calc(50% + ${Math.random()*40 - 20}px)`;
    el.style.top = `calc(50% + ${Math.random()*40 - 20}px)`;
    el.style.color = color;
    UI.floatContainer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function checkLines() {
    let linesCleared = 0;
    
    outer: for (let y = ROWS - 1; y >= 0; --y) {
        for (let x = 0; x < COLS; ++x) {
            if (GAME.board[y][x] === 0) {
                continue outer;
            }
        }
        
        // Clear row
        const removedRow = GAME.board.splice(y, 1)[0];
        
        // Glass shatter Particles
        for(let px=0; px<COLS; px++) {
            const val = removedRow[px];
            if(val > 0) {
                const color = COLORS[val][1]; // Use bright part
                for(let i=0; i<4; i++) {
                    if(GAME.particles.length > 80) break;
                    GAME.particles.push({
                        x: px + 0.5 + (Math.random() - 0.5),
                        y: y + 0.5 + (Math.random() - 0.5),
                        vx: (Math.random() - 0.5) * 0.8,
                        vy: (Math.random() - 1) * 0.8,
                        life: 100 + Math.random() * 20,
                        size: Math.random() * 4 + 2,
                        rotation: Math.random() * Math.PI * 2,
                        rv: (Math.random() - 0.5) * 0.4,
                        color: color
                    });
                }
            }
        }
        
        GAME.board.unshift(Array(COLS).fill(0));
        ++y;
        linesCleared++;
    }

    if (linesCleared > 0) {
        GAME.combo++;
        let points = linesCleared * 10 * GAME.combo;
        GAME.score += points;
        
        GAME.dropInterval = Math.max(200, 1000 - (GAME.score * 2));
        updateScore();
        vibrate([30, 50, 30]);
        
        if (GAME.combo > 1) {
            showFloatText(`Combo x${GAME.combo}!`, 0, 0, '#ffeb3b');
        } else {
            showFloatText(`+${points}`, 0, 0);
        }
    } else {
        GAME.combo = 0;
    }
}

function checkMarketingHooks() {
    if (GAME.score >= 100 && GAME.state !== 'WON') {
        GAME.state = 'WON';
        GAME.giftItems++;
        document.getElementById('inv-gift-count').innerText = GAME.giftItems;
        showPopup('Tuyệt vời!', '🍕', 'Bạn đã đạt 100 điểm và trúng 1 voucher Pizza miễn phí!', [
            { id: 'btn-claim-pizza', show: true },
            { id: 'btn-continue', show: true, text: 'Chơi tiếp đeeee' }
        ]);
        vibrate([100, 50, 100, 50, 100]);
    } else if (GAME.score >= 50 && !GAME.notified50) {
        GAME.notified50 = true;
        GAME.slowItems++;
        document.getElementById('inv-slow-count').innerText = GAME.slowItems;
        
        GAME.state = 'PAUSED'; 
        showPopup('Tiếp sức!', '⏳', 'Chúc mừng mốc 50 điểm! Bạn được tặng 1 lượt làm chậm thời gian chơi.', [
            { id: 'btn-continue', show: true, text: 'Nhận & Chơi tiếp' }
        ]);
        vibrate([50, 100, 50]);
    } else if (GAME.score >= 90 && GAME.score < 100 && !GAME.notified90) {
        GAME.notified90 = true;
        UI.pizzaText.innerText = `Chỉ còn ${100 - GAME.score} điểm nữa nhận Pizza! Cố lên!`;
        UI.pizzaText.style.color = '#ffeb3b';
        setTimeout(() => UI.pizzaText.style.color = '', 3000);
    }
}

function gameOver() {
    GAME.state = 'GAMEOVER';
    if(GAME.lives > 0) GAME.lives--;
    updateLives();
    vibrate([200, 100, 200]);
    
    // Marketing text
    if (GAME.score >= 80 && GAME.score < 100) {
        showPopup('Tiếc quá!', '😭', `Lêu lêu! Suýt nữa thì trúng Pizza. Còn thiếu ${document.getElementById('100 - GAME.score') ? '' : (100 - GAME.score)} điểm thôi!`, [
            { id: 'btn-continue', show: GAME.lives > 0, text: 'Chơi lại đi!' },
            { id: 'btn-ads', show: GAME.lives === 0 },
            { id: 'btn-buy', show: GAME.lives === 0 }
        ]);
    } else {
        showPopup('Thua mất rồi!', '😛', `Lêu lêu, chơi lại đi! Điểm: ${GAME.score}`, [
            { id: 'btn-continue', show: GAME.lives > 0, text: 'Chơi Ngay' },
            { id: 'btn-ads', show: GAME.lives === 0 },
            { id: 'btn-buy', show: GAME.lives === 0 }
        ]);
    }
}

function playerDrop() {
    if (GAME.state !== 'PLAYING') return;

    if (!collide(GAME.board, GAME.piece, 0, 1)) {
        GAME.piece.y++;
        GAME.dropCounter = 0;
    } else {
        merge();
        checkLines();
        checkMarketingHooks();
        GAME.piece = GAME.nextPiece;
        GAME.nextPiece = createPiece();
        GAME.piece.y = 0;
        GAME.dropCounter = 0;
        
        if (collide(GAME.board, GAME.piece)) {
            gameOver();
        }
    }
    vibrate(5);
}

function playerHardDrop() {
    if (GAME.state !== 'PLAYING') return;
    while (!collide(GAME.board, GAME.piece, 0, 1)) {
        GAME.piece.y++;
    }
    playerDrop();
    GAME.dropCounter = 1000;
}

function playerMove(dir) {
    if (GAME.state !== 'PLAYING') return;
    if (!collide(GAME.board, GAME.piece, dir, 0)) {
        GAME.piece.x += dir;
        vibrate(5);
    }
}

// Game Loop
function update(time = 0) {
    if (GAME.state === 'PLAYING') {
        const deltaTime = time - GAME.lastTime;
        GAME.lastTime = time;

        const effectiveInterval = GAME.slowTimeActive ? GAME.dropInterval * 2 : GAME.dropInterval;
        
        GAME.dropCounter += deltaTime;
        if (GAME.dropCounter > effectiveInterval) {
            playerDrop();
        }
    } else {
        GAME.lastTime = time; // keep fast sync
    }

    render();
    requestAnimationFrame(update);
}

/* --- INPUTS --- */
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

document.addEventListener('keydown', e => {
    switch (e.keyCode) {
        case 37: playerMove(-1); break;
        case 39: playerMove(1); break;
        case 40: playerDrop(); break;
        case 38: rotate(GAME.piece); break;
        case 32: playerHardDrop(); break;
    }
});

function bindTouch() {
    const el = document.getElementById('canvas-container');
    el.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchMoved = false;
    });

    el.addEventListener('touchmove', e => {
        e.preventDefault(); // prevent scroll
        if (!touchStartX || !touchStartY) return;
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        const dx = x - touchStartX;
        const dy = y - touchStartY;
        
        if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
            touchMoved = true;
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) playerMove(1);
                else playerMove(-1);
            } else {
                if (dy > 0) playerDrop();
            }
            touchStartX = x; 
            touchStartY = y;
        }
    }, {passive: false});

    el.addEventListener('touchend', e => {
        if (!touchMoved) {
            rotate(GAME.piece);
        }
        touchStartX = 0;
        touchStartY = 0;
    });
}

/* --- UI MANAGE --- */
function updateScore() {
    UI.score.innerText = GAME.score;
    let percent = Math.min(100, (GAME.score / 100) * 100);
    UI.pizzaFill.style.width = percent + '%';
    
    if (GAME.score < 90) {
        UI.pizzaText.innerText = 'Cố lên! Đạt 100 điểm để nhận Pizza 🍕';
    }
}

function updateLives() {
    localStorage.setItem('blockLives', GAME.lives);
    UI.lives.innerText = GAME.lives;
    if (GAME.lives < 3 && !localStorage.getItem('blockLifeTimer')) {
        localStorage.setItem('blockLifeTimer', Date.now());
    }
}

function checkLivesTimer() {
    if (GAME.lives >= 3) {
        document.getElementById('life-timer').classList.add('hidden');
        return;
    }
    document.getElementById('life-timer').classList.remove('hidden');
    
    const startObj = localStorage.getItem('blockLifeTimer');
    if (startObj) {
        const diff = Date.now() - parseInt(startObj);
        const mins10 = 10 * 60 * 1000;
        
        if (diff >= mins10) {
            GAME.lives = Math.min(3, GAME.lives + Math.floor(diff / mins10));
            if (GAME.lives === 3) {
                localStorage.removeItem('blockLifeTimer');
                alert("Bạn đã hồi đầy mạng! Vào chơi lại nào 🎮");
            } else {
                localStorage.setItem('blockLifeTimer', Date.now() - (diff % mins10));
            }
            updateLives();
        } else {
            const rem = mins10 - diff;
            const m = Math.floor(rem/1000/60).toString().padStart(2, '0');
            const s = Math.floor((rem/1000)%60).toString().padStart(2, '0');
            document.getElementById('life-timer').innerText = `Hồi sau: ${m}:${s}`;
        }
    }
}

function showPopup(title, emoji, msg, actions) {
    document.getElementById('popup-title').innerText = title;
    document.getElementById('popup-emoji').innerText = emoji;
    document.getElementById('popup-message').innerText = msg;
    
    // Hide all
    ['btn-continue', 'btn-ads', 'btn-buy', 'btn-claim-pizza'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    // Show needed
    actions.forEach(a => {
        if(a.show) {
            const btn = document.getElementById(a.id);
            btn.classList.remove('hidden');
            if(a.text) btn.innerText = a.text;
        }
    });
    
    UI.popupOverlay.classList.remove('hidden');
}

function hidePopup() {
    UI.popupOverlay.classList.add('hidden');
}

function startGame() {
    if (GAME.lives <= 0) {
        showPopup('Hết mạng!', '😵', 'Bạn đã hết mạng. Vui lòng đợi hoặc xem quảng cáo để đổi mạng.', [
            { id: 'btn-ads', show: true },
            { id: 'btn-buy', show: true }
        ]);
        return;
    }
    
    UI.startScreen.classList.add('hidden');
    hidePopup();
    resetGame();
    GAME.state = 'PLAYING';
    GAME.lastTime = performance.now();
}

/* --- INIT --- */
function init() {
    initCanvas();
    bindTouch();
    
    // Load local storage
    GAME.lives = parseInt(localStorage.getItem('blockLives'));
    if(isNaN(GAME.lives)) GAME.lives = 3;
    updateLives();
    setInterval(checkLivesTimer, 1000);
    
    // Bind buttons
    document.getElementById('btn-start').onclick = startGame;
    
    document.getElementById('btn-continue').onclick = () => {
        if (GAME.state === 'PAUSED' || GAME.state === 'WON') {
            hidePopup();
            GAME.state = 'PLAYING';
            GAME.lastTime = performance.now();
        } else {
            startGame();
        }
    };
    
    document.getElementById('btn-pause').onclick = () => {
        if (GAME.state === 'PLAYING') {
            GAME.state = 'PAUSED';
            showPopup('Tạm dừng', '⏸️', 'Bạn đang tạm dừng game.', [
                { id: 'btn-continue', show: true, text: 'Chơi tiếp' }
            ]);
        }
    };
    
    document.getElementById('btn-restart').onclick = () => {
        if (GAME.state === 'PLAYING' || GAME.state === 'PAUSED' || GAME.state === 'GAMEOVER') {
            if (confirm('Bạn có chắc chắn muốn chơi lại từ đầu?')) {
                startGame();
            }
        }
    };
    
    document.getElementById('btn-ads').onclick = () => {
        GAME.lives++;
        updateLives();
        alert('Đã xem xong Ads! +1 Mạng');
        hidePopup();
        startGame();
    };
    
    document.getElementById('btn-buy').onclick = () => {
        GAME.lives = 3;
        updateLives();
        alert('Đã nạp thành công! Đầy mạng.');
        hidePopup();
        startGame();
    };

    document.getElementById('btn-claim-pizza').onclick = () => {
        alert('Mở trang điền form nhận Pizza (Mockup)');
        // Reload after claim
        GAME.lives = 3;
        updateLives();
        location.reload();
    };

    // Inventory items
    document.getElementById('btn-slow').onclick = () => {
        if(GAME.state !== 'PLAYING' || GAME.slowTimeActive || GAME.slowItems <= 0) return;
        GAME.slowItems--;
        document.getElementById('inv-slow-count').innerText = GAME.slowItems;
        
        GAME.slowTimeActive = true;
        document.getElementById('btn-slow').style.opacity = '0.5';
        setTimeout(() => {
            GAME.slowTimeActive = false;
            document.getElementById('btn-slow').style.opacity = '1';
        }, 10000); // 10s slow
    };
    
    requestAnimationFrame(update); // Start loop early for render
}

window.onload = init;
