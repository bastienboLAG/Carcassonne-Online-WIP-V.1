import { Multiplayer } from './modules/Multiplayer.js';
import { Tile } from './modules/Tile.js';
import { Board } from './modules/Board.js';
import { Deck } from './modules/Deck.js';
import { GameState } from './modules/state/GameState.js';
import { GameSync } from './modules/GameSync.js';
import { ZoneMerger } from './modules/game/ZoneMerger.js';
import { Scoring } from './modules/game/Scoring.js';
import { GameEngine } from './modules/core/GameEngine.js';
import { TurnManager } from './modules/game/TurnManager.js';
import { TilePlacement } from './modules/game/TilePlacement.js';
import { MeeplePlacement } from './modules/game/MeeplePlacement.js';
import { ScorePanelUI } from './modules/ui/ScorePanelUI.js';
import { GameBoardUI } from './modules/ui/GameBoardUI.js';
import { TilePreviewUI } from './modules/ui/TilePreviewUI.js';
import { MeepleCursorsUI } from './modules/ui/MeepleCursorsUI.js';
import { TileRotationUI } from './modules/ui/TileRotationUI.js';
import { ButtonsUI } from './modules/ui/ButtonsUI.js';

// ========== GAME ENGINE ==========
const engine = new GameEngine();
await engine.initialize();
const eventBus = engine.getEventBus();
const config = engine.getConfig();

// ========== VARIABLES ==========
const multiplayer = new Multiplayer();
const plateau = new Board();
const deck = new Deck();

let gameState = null;
let gameSync = null;
let zoneMerger = null;
let scoring = null;
let turnManager = null;
let tilePlacement = null;
let meeplePlacement = null;

// Modules UI
let scorePanelUI, gameBoardUI, tilePreviewUI, meepleCursorsUI, tileRotationUI, buttonsUI;

// Lobby
let gameCode = null;
let playerName = '';
let playerColor = 'blue';
let players = [];
let takenColors = [];
let inLobby = false;
let isHost = false;

const colorImages = {
    'black': './assets/Meeples/Black/Normal.png',
    'red': './assets/Meeples/Red/Normal.png',
    'pink': './assets/Meeples/Pink/Normal.png',
    'green': './assets/Meeples/Green/Normal.png',
    'blue': './assets/Meeples/Blue/Normal.png',
    'yellow': './assets/Meeples/Yellow/Normal.png'
};

// ========== LOBBY - Fonctions utilitaires ==========
function getAvailableColor() {
    const allColors = ['black', 'red', 'pink', 'green', 'blue', 'yellow'];
    return allColors.find(c => !takenColors.includes(c)) || 'blue';
}

function updateAvailableColors() {
    takenColors = players.filter(p => p.id !== multiplayer.playerId).map(p => p.color);
    document.querySelectorAll('.color-option').forEach(option => {
        const color = option.dataset.color;
        const input = option.querySelector('input');
        if (takenColors.includes(color)) {
            option.classList.add('taken');
            input.disabled = true;
        } else {
            option.classList.remove('taken');
            input.disabled = false;
        }
    });
}

function updateColorPickerVisibility() {
    const colorPicker = document.querySelector('.color-picker');
    if (colorPicker) {
        colorPicker.style.display = inLobby ? 'block' : 'none';
    }
}

function updatePlayersList() {
    const playersList = document.getElementById('players-list');
    if (!playersList) return;

    playersList.innerHTML = '';
    
    if (players.length === 0) {
        playersList.innerHTML = '<div class="player-slot empty"><span class="player-name">En attente de joueurs...</span></div>';
        return;
    }

    players.forEach(player => {
        const slot = document.createElement('div');
        slot.className = 'player-slot filled';
        
        const meepleImg = document.createElement('img');
        meepleImg.src = colorImages[player.color];
        meepleImg.className = 'meeple-img-list';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.name;
        
        slot.appendChild(meepleImg);
        slot.appendChild(nameSpan);
        
        if (player.id === multiplayer.playerId) {
            const badge = document.createElement('span');
            badge.className = 'you-badge';
            badge.textContent = 'Vous';
            slot.appendChild(badge);
        }
        
        if (isHost && player.id === multiplayer.hostId) {
            const hostBadge = document.createElement('span');
            hostBadge.className = 'host-badge';
            hostBadge.textContent = '👑 Hôte';
            slot.appendChild(hostBadge);
        }
        
        playersList.appendChild(slot);
    });
}

function updateLobbyUI() {
    const startGameBtn = document.getElementById('start-game-btn');
    
    if (!startGameBtn) return;

    if (isHost) {
        startGameBtn.style.display = 'block';
    } else {
        startGameBtn.style.display = 'none';
    }
}

// ========== LOBBY - Event Listeners ==========
document.getElementById('create-game-btn').addEventListener('click', async () => {
    playerName = document.getElementById('pseudo-input').value.trim();
    if (!playerName) {
        alert('Veuillez entrer un pseudo');
        return;
    }

    gameCode = await multiplayer.createGame();
    isHost = true;
    inLobby = true;
    
    players.push({
        id: multiplayer.playerId,
        name: playerName,
        color: playerColor
    });

    document.getElementById('game-code-text').textContent = gameCode;
    document.getElementById('game-code-container').style.display = 'block';
    
    updatePlayersList();
    updateLobbyUI();
    updateColorPickerVisibility();
    
    multiplayer.onPlayerJoined = (playerId) => {
        console.log('Joueur rejoint:', playerId);
    };

    multiplayer.onDataReceived = (data, from) => {
        if (data.type === 'join-request') {
            const newPlayer = {
                id: from,
                name: data.playerName,
                color: data.playerColor
            };
            players.push(newPlayer);
            updatePlayersList();
            updateAvailableColors();
            
            multiplayer.sendTo(from, {
                type: 'join-accepted',
                players: players,
                hostId: multiplayer.playerId
            });
            
            multiplayer.broadcast({
                type: 'player-joined',
                player: newPlayer
            });
        }
    };
});

document.getElementById('join-game-btn').addEventListener('click', async () => {
    // Ouvrir la modale
    const modal = document.getElementById('join-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
});

// Gérer la confirmation du join dans la modale
document.getElementById('join-confirm-btn')?.addEventListener('click', async () => {
    playerName = document.getElementById('pseudo-input').value.trim();
    gameCode = document.getElementById('join-code-input').value.trim().toUpperCase();

    if (!playerName || !gameCode) {
        const errorElem = document.getElementById('join-error');
        if (errorElem) {
            errorElem.textContent = 'Veuillez remplir tous les champs';
            errorElem.style.display = 'block';
        }
        return;
    }

    const success = await multiplayer.joinGame(gameCode);
    if (!success) {
        const errorElem = document.getElementById('join-error');
        if (errorElem) {
            errorElem.textContent = 'Code de partie invalide';
            errorElem.style.display = 'block';
        }
        return;
    }

    // Fermer la modale
    const modal = document.getElementById('join-modal');
    if (modal) {
        modal.style.display = 'none';
    }

    inLobby = true;
    isHost = false;

    players.push({
        id: multiplayer.playerId,
        name: playerName,
        color: playerColor
    });

    multiplayer.sendTo(multiplayer.hostId, {
        type: 'join-request',
        playerName: playerName,
        playerColor: playerColor
    });

    multiplayer.onDataReceived = (data, from) => {
        if (data.type === 'join-accepted') {
            players = data.players;
            multiplayer.hostId = data.hostId;
            updatePlayersList();
            updateAvailableColors();
            updateLobbyUI();
            updateColorPickerVisibility();
        }
        
        if (data.type === 'player-joined') {
            players.push(data.player);
            updatePlayersList();
            updateAvailableColors();
        }
    };

    updateLobbyUI();
    updateColorPickerVisibility();
});

// Gérer l'annulation
document.getElementById('join-cancel-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('join-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    const errorElem = document.getElementById('join-error');
    if (errorElem) {
        errorElem.style.display = 'none';
    }
});

document.querySelectorAll('.color-option input').forEach(input => {
    input.addEventListener('change', (e) => {
        if (e.target.checked) {
            playerColor = e.target.value;
            
            const myPlayer = players.find(p => p.id === multiplayer.playerId);
            if (myPlayer) {
                myPlayer.color = playerColor;
                updatePlayersList();
                
                multiplayer.broadcast({
                    type: 'player-color-changed',
                    playerId: multiplayer.playerId,
                    color: playerColor
                });
            }
        }
    });
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    if (!isHost) return;
    
    multiplayer.broadcast({
        type: 'game-starting'
    });
    
    startGame();
});

// ========== GAME - Démarrage ==========
async function startGame() {
    console.log('🎮 Démarrage de la partie...');
    
    document.getElementById('lobby-page').style.display = 'none';
    document.getElementById('game-page').style.display = 'flex';
    
    // Initialiser GameState
    gameState = new GameState();
    players.forEach(player => {
        gameState.addPlayer(player.id, player.name, player.color);
    });
    
    // Initialiser modules game
    gameSync = new GameSync(multiplayer, gameState);
    gameSync.init();
    
    zoneMerger = new ZoneMerger(plateau);
    scoring = new Scoring(zoneMerger, eventBus);
    
    turnManager = new TurnManager(eventBus, gameState, deck);
    tilePlacement = new TilePlacement(eventBus, plateau, zoneMerger, gameSync);
    meeplePlacement = new MeeplePlacement(eventBus, zoneMerger, gameState);
    
    turnManager.init();
    tilePlacement.init();
    meeplePlacement.init();
    
    // Initialiser modules UI
    scorePanelUI = new ScorePanelUI(eventBus);
    gameBoardUI = new GameBoardUI(eventBus, gameState);
    gameBoardUI.setPlayerId(multiplayer.playerId);
    
    tilePreviewUI = new TilePreviewUI(eventBus);
    meepleCursorsUI = new MeepleCursorsUI(eventBus, gameState, multiplayer.playerId);
    tileRotationUI = new TileRotationUI(eventBus, tilePlacement, gameSync);
    tileRotationUI.setPlayerId(multiplayer.playerId);
    
    buttonsUI = new ButtonsUI(eventBus, scoring, meeplePlacement, deck, gameState);
    buttonsUI.setPlayerId(multiplayer.playerId);
    
    scorePanelUI.init();
    gameBoardUI.init();
    tilePreviewUI.init();
    meepleCursorsUI.init();
    tileRotationUI.init();
    buttonsUI.init();
    
    // Connecter événements
    setupGameEventListeners();
    
    // Charger config et démarrer
    config.loadFromDOM();
    await engine.startGame(gameState, deck, plateau);
    
    // Callbacks GameSync
    setupGameSyncCallbacks();
    
    // Si hôte, charger deck et démarrer
    if (isHost) {
        await deck.loadAllTiles(config.get('useTestDeck') || false);
        gameSync.broadcastGameStart(deck, gameState);
        
        // Placer première tuile
        const firstTile = deck.tiles[0];
        tilePlacement.placeFirstTile(firstTile);
        
        // Démarrer premier tour
        turnManager.startFirstTurn();
    }
    
    scorePanelUI.updateWithGameState(gameState);
    setupNavigation(document.getElementById('board-container'), document.getElementById('board'));
}

// ========== GAME - Event Listeners ==========
function setupGameEventListeners() {
    // Clic sur slot → placer tuile
    eventBus.on('slot-clicked', (data) => {
        const currentTile = tilePlacement.currentTile;
        if (currentTile) {
            tilePlacement.placeTile(data.x, data.y, currentTile);
        }
    });
    
    // Clic sur curseur meeple → placer meeple
    eventBus.on('meeple-cursor-clicked', (data) => {
        meeplePlacement.placeMeeple(data.x, data.y, data.position, data.type, data.playerId);
    });
}

// ========== GAME - GameSync Callbacks ==========
function setupGameSyncCallbacks() {
    gameSync.onGameStarted = (deckData, gameStateData) => {
        deck.tiles = deckData.tiles;
        deck.currentIndex = deckData.currentIndex;
        deck.totalTiles = deckData.totalTiles;
        gameState.deserialize(gameStateData);
        
        turnManager.startFirstTurn();
    };
    
    gameSync.onTileRotated = (rotation) => {
        if (tilePlacement.currentTile) {
            tilePlacement.currentTile.rotation = rotation;
            eventBus.emit('tile-rotated', { rotation });
        }
    };
    
    gameSync.onTilePlaced = (x, y, tileId, rotation) => {
        const tileData = deck.tiles.find(t => t.id === tileId);
        if (tileData) {
            const tile = new Tile(tileData);
            tile.rotation = rotation;
            tilePlacement.placeTile(x, y, tile);
        }
    };
    
    gameSync.onTurnEnded = (nextPlayerIndex, gameStateData) => {
        gameState.deserialize(gameStateData);
        eventBus.emit('turn-started', {
            player: gameState.getCurrentPlayer(),
            gameState
        });
    };
    
    gameSync.onMeeplePlaced = (x, y, position, meepleType, color, playerId) => {
        meeplePlacement.placeMeeple(x, y, position, meepleType, playerId);
    };
    
    gameSync.onScoreUpdate = (scoringResults, meeplesToReturn) => {
        scoringResults.forEach(({ playerId, points }) => {
            const player = gameState.players.find(p => p.id === playerId);
            if (player) player.score += points;
        });
        
        eventBus.emit('score-calculated', {
            scoringResults,
            meeplesToReturn
        });
    };
    
    gameSync.onMeepleCountUpdate = (playerId, meeples) => {
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            player.meeples = meeples;
            eventBus.emit('meeple-count-updated', { playerId, meeples });
        }
    };
}

// ========== NAVIGATION PLATEAU ==========
function setupNavigation(container, board) {
    let isDragging = false;
    let startX, startY, scrollLeft, scrollTop;

    container.addEventListener('mousedown', (e) => {
        if (e.target === board || e.target.classList.contains('tile') || e.target.classList.contains('slot')) {
            return;
        }
        isDragging = true;
        startX = e.pageX - container.offsetLeft;
        startY = e.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
        container.style.cursor = 'grabbing';
    });

    container.addEventListener('mouseleave', () => {
        isDragging = false;
        container.style.cursor = 'grab';
    });

    container.addEventListener('mouseup', () => {
        isDragging = false;
        container.style.cursor = 'grab';
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const y = e.pageY - container.offsetTop;
        const walkX = (x - startX) * 2;
        const walkY = (y - startY) * 2;
        container.scrollLeft = scrollLeft - walkX;
        container.scrollTop = scrollTop - walkY;
    });

    document.getElementById('recenter-btn').addEventListener('click', () => {
        container.scrollLeft = (board.offsetWidth - container.offsetWidth) / 2;
        container.scrollTop = (board.offsetHeight - container.offsetHeight) / 2;
    });
}

// ========== DÉMARRAGE ==========
updateColorPickerVisibility();
console.log('✅ Carcassonne Online chargé');
