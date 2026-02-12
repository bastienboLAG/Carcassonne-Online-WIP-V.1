import { Multiplayer } from './modules/Multiplayer.js';
import { Tile } from './modules/Tile.js';
import { Board } from './modules/Board.js';
import { Deck } from './modules/Deck.js';
import { GameState } from './modules/GameState.js';
import { GameSync } from './modules/GameSync.js';
import { ZoneMerger } from './modules/ZoneMerger.js';
import { Scoring } from './modules/Scoring.js';

import { EventBus } from './modules/core/EventBus.js';
import { RuleRegistry } from './modules/core/RuleRegistry.js';
import { BaseRules } from './modules/rules/BaseRules.js';
import { TurnManager } from './modules/game/TurnManager.js';
import { ScorePanelUI } from './modules/ScorePanelUI.js';
import { SlotsUI } from './modules/SlotsUI.js';
import { TilePreviewUI } from './modules/TilePreviewUI.js';
import { MeepleCursorsUI } from './modules/MeepleCursorsUI.js';
import { MeepleSelectorUI } from './modules/MeepleSelectorUI.js';
import { MeepleDisplayUI } from './modules/MeepleDisplayUI.js';
// ========== VARIABLES LOBBY ==========
const multiplayer = new Multiplayer();
let gameCode = null;
let playerName = '';
let playerColor = 'blue';
let players = [];
let takenColors = [];
let inLobby = false;
let isHost = false;

// ========== VARIABLES JEU ==========
const plateau = new Board();
const deck = new Deck();
let gameState = null;

// ========== EVENTBUS ==========
const eventBus = new EventBus();
const ruleRegistry = new RuleRegistry(eventBus);
eventBus.setDebug(true); // Debug activé pour voir les événements

n// TurnManager
let turnManager = null;
let gameSync = null;
let zoneMerger = null;
let scoring = null;
let tuileEnMain = null;
let tuilePosee = false;
let zoomLevel = 1;
let firstTilePlaced = false;
let scorePanelUI = null;
let slotsUI = null;
let tilePreviewUI = null;
let meepleCursorsUI = null;
let meepleSelectorUI = null;
let meepleDisplayUI = null;
let isMyTurn = false;

// ✅ NOUVEAU : Variables pour les meeples
let lastPlacedTile = null; // Dernière tuile posée {x, y}
let placedMeeples = {}; // Meeples placés: "x,y,position" => {type, color, playerId}

let isDragging = false;
let startX = 0;
let startY = 0;
let scrollLeft = 0;
let scrollTop = 0;

const colorImages = {
    'black': './assets/Meeples/Black/Normal.png',
    'red': './assets/Meeples/Red/Normal.png',
    'pink': './assets/Meeples/Pink/Normal.png',
    'green': './assets/Meeples/Green/Normal.png',
    'blue': './assets/Meeples/Blue/Normal.png',
    'yellow': './assets/Meeples/Yellow/Normal.png'
};

const allColors = ['black', 'red', 'pink', 'green', 'blue', 'yellow'];

// ========== FONCTIONS LOBBY ==========
document.getElementById('pseudo-input').addEventListener('input', (e) => {
    playerName = e.target.value.trim();
});

function getAvailableColor() {
    for (const color of allColors) {
        if (!takenColors.includes(color)) {
            return color;
        }
    }
    return 'blue';
}

function updateAvailableColors() {
    const colorOptions = document.querySelectorAll('.color-option');
    
    colorOptions.forEach(option => {
        const color = option.dataset.color;
        const input = option.querySelector('input');
        
        if (takenColors.includes(color) && color !== playerColor) {
            option.classList.add('disabled');
            input.disabled = true;
        } else {
            option.classList.remove('disabled');
            input.disabled = false;
        }
    });
}

function updateColorPickerVisibility() {
    const colorPicker = document.querySelector('.color-picker');
    
    if (inLobby) {
        colorPicker.style.display = 'block';
    } else {
        colorPicker.style.display = 'none';
    }
}

function updateOptionsAccess() {
    const configInputs = document.querySelectorAll('.home-right input');
    const configLabels = document.querySelectorAll('.home-right label');
    const startButton = document.getElementById('start-game-btn');
    
    if (inLobby && !isHost) {
        configInputs.forEach(input => {
            input.disabled = true;
        });
        configLabels.forEach(label => {
            label.style.opacity = '0.5';
            label.style.pointerEvents = 'none';
        });
        
        if (startButton) {
            startButton.style.pointerEvents = 'none';
            startButton.style.opacity = '0.5';
            startButton.textContent = 'En attente de l\'hôte...';
        }
    } else if (inLobby && isHost) {
        configInputs.forEach(input => {
            input.disabled = false;
        });
        configLabels.forEach(label => {
            label.style.opacity = '1';
            label.style.pointerEvents = 'auto';
        });
        
        if (startButton) {
            startButton.style.pointerEvents = 'auto';
            startButton.style.opacity = '1';
            startButton.textContent = 'Démarrer la partie';
        }
    }
}

function updateLobbyUI() {
    const createBtn = document.getElementById('create-game-btn');
    const joinBtn = document.getElementById('join-game-btn');
    
    if (inLobby) {
        createBtn.style.display = 'none';
        joinBtn.style.display = 'none';
    } else {
        createBtn.style.display = 'block';
        joinBtn.style.display = 'block';
    }
    
    updateColorPickerVisibility();
    updateOptionsAccess();
}

const colorOptions = document.querySelectorAll('.color-option');
colorOptions.forEach(option => {
    option.addEventListener('click', () => {
        if (option.classList.contains('disabled')) return;
        
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        const input = option.querySelector('input');
        input.checked = true;
        playerColor = input.value;
        
        if (multiplayer.peer && multiplayer.peer.open) {
            const me = players.find(p => p.id === multiplayer.playerId);
            if (me) {
                me.color = playerColor;
                updatePlayersList();
            }
            
            multiplayer.broadcast({
                type: 'color-change',
                playerId: multiplayer.playerId,
                color: playerColor
            });
        }
    });
});

function updatePlayersList() {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    takenColors = players.map(p => p.color);
    updateAvailableColors();
    
    if (players.length === 0) {
        playersList.innerHTML = '<div class="player-slot empty"><span class="player-name">En attente de joueurs...</span></div>';
        return;
    }
    
    players.forEach((player) => {
        const slot = document.createElement('div');
        slot.className = 'player-slot';
        slot.innerHTML = `
            <span class="player-name">${player.name}${player.isHost ? ' 👑' : ''}</span>
            <img src="${colorImages[player.color]}" class="player-meeple-img" alt="${player.color}">
        `;
        playersList.appendChild(slot);
    });
    
    for (let i = players.length; i < 6; i++) {
        const slot = document.createElement('div');
        slot.className = 'player-slot empty';
        slot.innerHTML = '<span class="player-name">En attente...</span>';
        playersList.appendChild(slot);
    }
}

document.getElementById('create-game-btn').addEventListener('click', async () => {
    if (!playerName) {
        alert('Veuillez entrer un pseudo !');
        return;
    }
    
    try {
        gameCode = await multiplayer.createGame();
        
        inLobby = true;
        isHost = true;
        updateLobbyUI();
        
        document.getElementById('game-code-container').style.display = 'block';
        document.getElementById('game-code-text').textContent = `Code: ${gameCode}`;
        
        players.push({
            id: multiplayer.playerId,
            name: playerName,
            color: playerColor,
            isHost: true
        });
        updatePlayersList();
        
        console.log('🎮 Partie créée ! Code:', gameCode);
        
        multiplayer.onPlayerJoined = (playerId) => {
            console.log('👤 Nouveau joueur connecté (ID):', playerId);
        };
        
        multiplayer.onDataReceived = (data, from) => {
            console.log('📨 [HÔTE] Reçu:', data);
            
            if (data.type === 'player-info') {
                const existingPlayer = players.find(p => p.id === from);
                if (!existingPlayer) {
                    let assignedColor = data.color;
                    if (takenColors.includes(data.color)) {
                        assignedColor = getAvailableColor();
                    }
                    
                    players.push({
                        id: from,
                        name: data.name,
                        color: assignedColor,
                        isHost: false
                    });
                    updatePlayersList();
                }
                
                multiplayer.broadcast({
                    type: 'players-update',
                    players: players
                });
            }
            
            if (data.type === 'color-change') {
                console.log('🎨 Changement de couleur reçu:', data.playerId, '→', data.color);
                const player = players.find(p => p.id === data.playerId);
                if (player) {
                    const colorTaken = players.some(p => p.id !== data.playerId && p.color === data.color);
                    
                    if (!colorTaken) {
                        player.color = data.color;
                        updatePlayersList();
                        
                        multiplayer.broadcast({
                            type: 'players-update',
                            players: players
                        });
                    }
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        alert('Erreur lors de la création de la partie: ' + error.message);
        inLobby = false;
        isHost = false;
        updateLobbyUI();
    }
});

document.getElementById('copy-code-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(gameCode).then(() => {
        const btn = document.getElementById('copy-code-btn');
        btn.textContent = '✅ Copié !';
        setTimeout(() => {
            btn.textContent = '📋 Copier';
        }, 2000);
    }).catch(err => {
        console.error('Erreur copie:', err);
    });
});

document.getElementById('join-game-btn').addEventListener('click', () => {
    if (!playerName) {
        alert('Veuillez entrer un pseudo !');
        return;
    }
    
    document.getElementById('join-modal').style.display = 'flex';
    document.getElementById('join-code-input').value = '';
    document.getElementById('join-error').style.display = 'none';
    document.getElementById('join-code-input').focus();
});

document.getElementById('join-confirm-btn').addEventListener('click', async () => {
    const code = document.getElementById('join-code-input').value.trim();
    
    if (!code) {
        showJoinError('Veuillez entrer un code !');
        return;
    }
    
    try {
        multiplayer.onDataReceived = (data, from) => {
            console.log('📨 [INVITÉ] Reçu:', data);
            
            if (data.type === 'welcome') {
                console.log('🎉', data.message);
            }
            
            if (data.type === 'players-update') {
                console.log('👥 Mise à jour liste joueurs:', data.players);
                players = data.players;
                
                const me = players.find(p => p.id === multiplayer.playerId);
                if (me && me.color !== playerColor) {
                    playerColor = me.color;
                    const colorOption = document.querySelector(`.color-option[data-color="${playerColor}"]`);
                    if (colorOption) {
                        colorOptions.forEach(opt => opt.classList.remove('selected'));
                        colorOption.classList.add('selected');
                        colorOption.querySelector('input').checked = true;
                    }
                }
                
                updatePlayersList();
            }
            
            if (data.type === 'color-change') {
                console.log('🎨 [INVITÉ] Changement de couleur reçu:', data.playerId, '→', data.color);
                const player = players.find(p => p.id === data.playerId);
                if (player) {
                    player.color = data.color;
                    updatePlayersList();
                }
            }
            
            // ✅ NOUVEAU : Écouter le signal de démarrage
            if (data.type === 'game-starting') {
                console.log('🎮 [INVITÉ] L\'hôte démarre la partie !');
                startGameForInvite();
            }
        };
        
        await multiplayer.joinGame(code);
        document.getElementById('join-modal').style.display = 'none';
        inLobby = true;
        isHost = false;
        updateLobbyUI();
        
        setTimeout(() => {
            multiplayer.broadcast({
                type: 'player-info',
                name: playerName,
                color: playerColor
            });
        }, 500);
        
    } catch (error) {
        console.error('❌ Erreur de connexion:', error);
        showJoinError('Impossible de rejoindre: ' + error.message);
    }
});

document.getElementById('join-cancel-btn').addEventListener('click', () => {
    document.getElementById('join-modal').style.display = 'none';
});

function showJoinError(message) {
    const errorEl = document.getElementById('join-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

// ✅ NOUVEAU : Gérer le clic sur "Démarrer la partie"
document.getElementById('start-game-btn').addEventListener('click', async () => {
    if (!inLobby) return;
    
    console.log('🎮 Démarrage de la partie...');
    
    // Envoyer le signal aux invités
    if (isHost) {
        multiplayer.broadcast({
            type: 'game-starting',
            message: 'L\'hôte démarre la partie !'
        });
    }
    
    // Démarrer le jeu
    await startGame();
});

// ✅ FONCTION POUR DÉMARRER LE JEU
async function startGame() {
    console.log('🎮 [HÔTE] Initialisation du jeu...');
    
    // Cacher le lobby, afficher le jeu
    const lobbyPage = document.getElementById('lobby-page');
    const gamePage = document.getElementById('game-page');
    
    lobbyPage.style.display = 'none';
    gamePage.style.display = 'flex';
    
    console.log('✅ Lobby caché, page de jeu affichée');
    console.log('📏 Game page dimensions:', gamePage.offsetWidth, 'x', gamePage.offsetHeight);
    
    // Initialiser le GameState
    gameState = new GameState();
    players.forEach(player => {
    scorePanelUI = new ScorePanelUI(eventBus);
        gameState.addPlayer(player.id, player.name, player.color);
    slotsUI = new SlotsUI(plateau, gameSync, eventBus);
    slotsUI.init();
    slotsUI.setSlotClickHandler(poserTuile);
    slotsUI.isMyTurn = isMyTurn;
    slotsUI.firstTilePlaced = firstTilePlaced;
    });
    tilePreviewUI = new TilePreviewUI(eventBus);
    tilePreviewUI.init();
    console.log('👥 Joueurs ajoutés au GameState:', gameState.players);
    // Initialiser ZoneMerger et Scoring AVANT meepleCursorsUI
    zoneMerger = new ZoneMerger(plateau);
    scoring = new Scoring(zoneMerger);
    meepleCursorsUI = new MeepleCursorsUI(multiplayer, zoneMerger, plateau);
    meepleCursorsUI.init();
    
    meepleSelectorUI = new MeepleSelectorUI(multiplayer, gameState);
    // Initialiser GameSync
    meepleDisplayUI = new MeepleDisplayUI();
    meepleDisplayUI.init();
    gameSync = new GameSync(multiplayer, gameState);
    gameSync.init();
    console.log('🔗 GameSync initialisé');
    
    // Initialiser TurnManager
    turnManager = new TurnManager(eventBus, gameState, deck, multiplayer);
    console.log('🔄 TurnManager initialisé');
    
    // ✅ Initialiser ZoneMerger et Scoring
    console.log('🔗 ZoneMerger et Scoring initialisés');
    
    // Callbacks pour les actions synchronisées
    gameSync.onGameStarted = (deckData, gameStateData) => {
        console.log('🎮 [INVITÉ] Pioche reçue !');
        
        // Restaurer la pioche
        deck.tiles = deckData.tiles;
        deck.currentIndex = deckData.currentIndex;
        deck.totalTiles = deckData.totalTiles;
        
        // Restaurer le GameState
        gameState.deserialize(gameStateData);
        
        // Piocher la première tuile
        turnManager.drawTile();
        eventBus.emit('deck-updated', { remaining: deck.remaining(), total: deck.total() });
        turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
    };
    
    gameSync.onTileRotated = (rotation) => {
        console.log('🔄 [SYNC] Rotation reçue:', rotation);
        if (tuileEnMain) {
            tuileEnMain.rotation = rotation;
            const currentImg = document.getElementById('current-tile-img');
            if (currentImg) {
                currentImg.style.transform = `rotate(${rotation}deg)`;
            }
            if (firstTilePlaced) {
            }
        }
    };
    
    gameSync.onTilePlaced = (x, y, tileId, rotation) => {
        console.log('📍 [SYNC] Placement reçu:', x, y, tileId, rotation);
        
        const tileData = deck.tiles.find(t => t.id === tileId);
        if (tileData) {
            const tile = new Tile(tileData);
            tile.rotation = rotation;
            poserTuileSync(x, y, tile);
        }
    };
    
    gameSync.onTurnEnded = (nextPlayerIndex, gameStateData) => {
        turnManager.receiveTurnEnded(nextPlayerIndex, gameStateData);
    };
    };
    
    gameSync.onTileDrawn = (tileId, rotation) => {
        turnManager.receiveTileDrawn(tileId, rotation);
    };
            eventBus.emit('deck-updated', { remaining: deck.remaining(), total: deck.total() });
        }
    };
    
    gameSync.onMeeplePlaced = (x, y, position, meepleType, color, playerId) => {
        console.log('🎭 [SYNC] Meeple placé par un autre joueur');
        
        const key = `${x},${y},${position}`;
        placedMeeples[key] = {
            type: meepleType,
            color: color,
            playerId: playerId
        };
        
        meepleDisplayUI.showMeeple(x, y, position, meepleType, color);
    };
    
    gameSync.onScoreUpdate = (scoringResults, meeplesToReturn) => {
        console.log('💰 [SYNC] Mise à jour des scores reçue');
        
        // Appliquer les scores
        scoringResults.forEach(({ playerId, points, reason }) => {
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                player.score += points;
                console.log(`  ${player.name} +${points} pts (${reason})`);
            }
        });
        
        // Retirer les meeples
        meeplesToReturn.forEach(key => {
            document.querySelectorAll(`.meeple[data-key="${key}"]`).forEach(el => el.remove());
            delete placedMeeples[key];
        });
        
        // Mettre à jour l'affichage
        turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
    };
    
    // Setup de l'interface
    console.log('🔧 Setup des event listeners...');
    setupEventListeners();
    console.log('🔧 Setup de la navigation...');
    setupNavigation(document.getElementById('board-container'), document.getElementById('board'));
    
    // Si on est l'hôte, charger et envoyer la pioche
    if (isHost) {
        console.log('👑 [HÔTE] Chargement de la pioche...');
        await deck.loadAllTiles(document.getElementById('use-test-deck')?.checked || false);
        console.log('📦 Deck chargé par l\'hôte:', deck.tiles.length, 'tuiles');
        
        // Envoyer la pioche à tous les joueurs
        gameSync.startGame(deck);
        
        // Piocher la première tuile
        turnManager.drawTile();
        eventBus.emit('deck-updated', { remaining: deck.remaining(), total: deck.total() });
        turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
        
        // ✅ Créer le slot central APRÈS updateTurnDisplay (pour que isMyTurn soit défini)
        console.log('🎯 Appel de creerSlotCentral...');
        slotsUI.createCentralSlot();
    } else {
        console.log('👤 [INVITÉ] En attente de la pioche...');
        afficherMessage('En attente de l\'hôte...');
    }
    
    console.log('✅ Initialisation terminée');
    
    // Enregistrer et activer les règles de base
    ruleRegistry.register('base', BaseRules);
    ruleRegistry.enable('base');
    console.log('📋 Règles actives:', ruleRegistry.getActiveRules());
}

async function startGameForInvite() {
    console.log('🎮 [INVITÉ] Initialisation du jeu...');
    
    // Cacher le lobby, afficher le jeu
    document.getElementById('lobby-page').style.display = 'none';
    document.getElementById('game-page').style.display = 'flex';
    
    // Initialiser le GameState
    gameState = new GameState();
    players.forEach(player => {
    scorePanelUI = new ScorePanelUI(eventBus);
    slotsUI = new SlotsUI(plateau, gameSync, eventBus);
    slotsUI.init();
    slotsUI.setSlotClickHandler(poserTuile);
    slotsUI.isMyTurn = isMyTurn;
    slotsUI.firstTilePlaced = firstTilePlaced;
        gameState.addPlayer(player.id, player.name, player.color);
    tilePreviewUI = new TilePreviewUI(eventBus);
    tilePreviewUI.init();
    // Initialiser ZoneMerger et Scoring AVANT meepleCursorsUI
    zoneMerger = new ZoneMerger(plateau);
    scoring = new Scoring(zoneMerger);
    });
    meepleCursorsUI = new MeepleCursorsUI(multiplayer, zoneMerger, plateau);
    meepleCursorsUI.init();
    
    meepleSelectorUI = new MeepleSelectorUI(multiplayer, gameState);
    // Initialiser GameSync
    meepleDisplayUI = new MeepleDisplayUI();
    meepleDisplayUI.init();
    gameSync = new GameSync(multiplayer, gameState);
    gameSync.init();
    
    // Initialiser TurnManager
    turnManager = new TurnManager(eventBus, gameState, deck, multiplayer);
    console.log('🔄 TurnManager initialisé');
    // ✅ Initialiser ZoneMerger et Scoring
    
    // Callbacks
    gameSync.onGameStarted = (deckData, gameStateData) => {
        console.log('🎮 [INVITÉ] Pioche reçue !');
        deck.tiles = deckData.tiles;
        deck.currentIndex = deckData.currentIndex;
        deck.totalTiles = deckData.totalTiles;
        gameState.deserialize(gameStateData);
        turnManager.drawTile();
        eventBus.emit('deck-updated', { remaining: deck.remaining(), total: deck.total() });
        turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
        
        // ✅ Créer le slot central APRÈS avoir défini isMyTurn
        slotsUI.createCentralSlot();
    };
    
    gameSync.onTileRotated = (rotation) => {
        if (tuileEnMain) {
            tuileEnMain.rotation = rotation;
            const currentImg = document.getElementById('current-tile-img');
            if (currentImg) {
                currentImg.style.transform = `rotate(${rotation}deg)`;
            }
        }
    };
    
    gameSync.onTilePlaced = (x, y, tileId, rotation) => {
        const tileData = deck.tiles.find(t => t.id === tileId);
        if (tileData) {
            const tile = new Tile(tileData);
            tile.rotation = rotation;
            poserTuileSync(x, y, tile);
        }
    };
    
    gameSync.onTurnEnded = (nextPlayerIndex, gameStateData) => {
        turnManager.receiveTurnEnded(nextPlayerIndex, gameStateData);
    };
    };
    
    gameSync.onTileDrawn = (tileId, rotation) => {
        turnManager.receiveTileDrawn(tileId, rotation);
    };
    
    gameSync.onMeeplePlaced = (x, y, position, meepleType, color, playerId) => {
        console.log('🎭 [SYNC] Meeple placé par un autre joueur');
        
        const key = `${x},${y},${position}`;
        placedMeeples[key] = {
            type: meepleType,
            color: color,
            playerId: playerId
        };
        
        meepleDisplayUI.showMeeple(x, y, position, meepleType, color);
    };
    
    gameSync.onScoreUpdate = (scoringResults, meeplesToReturn) => {
        console.log('💰 [SYNC] Mise à jour des scores reçue');
        
        scoringResults.forEach(({ playerId, points, reason }) => {
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                player.score += points;
                console.log(`  ${player.name} +${points} pts (${reason})`);
            }
        });
        
        meeplesToReturn.forEach(key => {
            document.querySelectorAll(`.meeple[data-key="${key}"]`).forEach(el => el.remove());
            delete placedMeeples[key];
        });
        
        turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
    };
    
    setupEventListeners();
    setupNavigation(document.getElementById('board-container'), document.getElementById('board'));
    
    afficherMessage('En attente de l\'hôte...');
    
    // ✅ Le slot central sera créé quand l'invité recevra la pioche et que isMyTurn sera défini
}

// ========== FONCTIONS JEU ==========
function updateTurnDisplay() {
    if (!gameState || gameState.players.length === 0) {
        isMyTurn = true;
        return;
    }
    
    const currentPlayer = gameState.getCurrentPlayer();
    isMyTurn = currentPlayer.id === multiplayer.playerId;
    
    // Mettre à jour l'état du bouton "Terminer mon tour"
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.disabled = !isMyTurn;
        if (!isMyTurn) {
            endTurnBtn.style.opacity = '0.5';
            endTurnBtn.style.cursor = 'not-allowed';
        } else {
            endTurnBtn.style.opacity = '1';
            endTurnBtn.style.cursor = 'pointer';
        }
        
        // ✅ Changer le texte si le deck est vide
        if (deck.currentIndex >= deck.totalTiles) {
            endTurnBtn.textContent = 'Calculer le score final';
            endTurnBtn.classList.add('final-score-btn');
        } else {
            endTurnBtn.textContent = 'Terminer mon tour';
            endTurnBtn.classList.remove('final-score-btn');
        }
    }
    
    // ✅ Mettre à jour le tableau de scores
    eventBus.emit('score-updated', gameState);
}


function afficherMessage(msg) {
    document.getElementById('tile-preview').innerHTML = `<p style="text-align: center; color: white;">${msg}</p>`;
}

function setupEventListeners() {
    document.getElementById('tile-preview').addEventListener('click', () => {
        if (!turnManager.getIsMyTurn() && gameSync) {
            console.log('⚠️ Pas votre tour !');
            return;
        }
        
        if (tuileEnMain && !tuilePosee) {
            const currentImg = document.getElementById('current-tile-img');
            tuileEnMain.rotation = (tuileEnMain.rotation + 90) % 360;
            const currentTransform = currentImg.style.transform;
            const currentDeg = parseInt(currentTransform.match(/rotate\((\d+)deg\)/)?.[1] || '0');
            const newDeg = currentDeg + 90;
            currentImg.style.transform = `rotate(${newDeg}deg)`;
            
            if (gameSync) {
                gameSync.syncTileRotation(tuileEnMain.rotation);
            }
            
            if (firstTilePlaced) {
            }
        }
    });
    
    document.getElementById('end-turn-btn').onclick = () => {
        if (!turnManager.getIsMyTurn() && gameSync) {
            alert('Ce n\'est pas votre tour !');
            return;
        }
        
        if (!tuilePosee) {
            alert('Vous devez poser la tuile avant de terminer votre tour !');
            return;
        }
        
        console.log('⏭️ Fin de tour - passage au joueur suivant');
        
        // ✅ Calculer les scores des zones fermées
        if (scoring && zoneMerger) {
            const { scoringResults, meeplesToReturn } = scoring.scoreClosedZones(placedMeeples);
            
            if (scoringResults.length > 0) {
                console.log('💰 Scores calculés:', scoringResults);
                
                // Appliquer les scores localement
                scoringResults.forEach(({ playerId, points, reason }) => {
                    const player = gameState.players.find(p => p.id === playerId);
                    if (player) {
                        player.score += points;
                        console.log(`  ${player.name} +${points} pts (${reason})`);
                    }
                });
                
                // Retirer les meeples des zones fermées
                meeplesToReturn.forEach(key => {
                    const meeple = placedMeeples[key];
                    if (meeple) {
                        console.log(`  Retour meeple de ${meeple.playerId} à ${key}`);
                        // ✅ Incrémenter le nombre de meeples disponibles
                        incrementPlayerMeeples(meeple.playerId);

                        
                        // ✅ Retirer visuellement - chercher tous les meeples et vérifier data-key
                        const [x, y, position] = key.split(',');
                        document.querySelectorAll('.meeple').forEach(el => {
                            if (el.dataset.key === key) {
                                console.log('    Meeple visuel retiré');
                                el.remove();
                            }
                        });
                        
                        // Retirer des données
                        delete placedMeeples[key];
                    }
                });
                
                // Synchroniser les scores
                if (gameSync) {
                    gameSync.syncScoreUpdate(scoringResults, meeplesToReturn);
                }
                
                // Mettre à jour l'affichage
                turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
            }
        }
        
        // ✅ Nettoyer les curseurs de meeple
        document.querySelectorAll('.meeple-cursors-container').forEach(c => c.remove());
        lastPlacedTile = null;
        
        if (gameSync) {
            // Synchroniser la fin de tour (qui met à jour gameState.currentPlayerIndex)
            gameSync.syncTurnEnd();
            
            // ✅ 6) IMPORTANT : Mettre à jour isMyTurn localement APRÈS avoir changé de tour
            const currentPlayer = gameState.getCurrentPlayer();
            isMyTurn = currentPlayer.id === multiplayer.playerId;
            console.log('🔄 Mise à jour isMyTurn:', isMyTurn, 'Tour de:', currentPlayer.name);
        }
        
        // ✅ Vérifier si c'est la fin de partie (deck vide)
        if (deck.currentIndex >= deck.totalTiles) {
            console.log('🏁 FIN DE PARTIE - Calcul des scores finaux');
            
            if (scoring && zoneMerger) {
                const finalScores = scoring.calculateFinalScores(placedMeeples, gameState);
                
                console.log('💰 Scores finaux:', finalScores);
                
                // Appliquer les scores finaux
                finalScores.forEach(({ playerId, points, reason }) => {
                    const player = gameState.players.find(p => p.id === playerId);
                    if (player) {
                        player.score += points;
                        console.log(`  ${player.name} +${points} pts (${reason})`);
                    }
                });
                
                // Mettre à jour l'affichage
                turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
                
                // Afficher le gagnant
                const winner = gameState.players.reduce((a, b) => a.score > b.score ? a : b);
                setTimeout(() => {
                    alert(`🏆 Partie terminée !
${winner.name} gagne avec ${winner.score} points !

Scores finaux :
${gameState.players.map(p => `${p.name}: ${p.score} pts`).join('\n')}`);
                }, 500);
            }
            
            return; // Ne pas piocher de nouvelle tuile
        }
        
        // Piocher la nouvelle tuile localement
        turnManager.drawTile();
        
        // Mettre à jour l'affichage du tour
        if (gameState) {
            turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
        }
    };
    
    document.getElementById('recenter-btn').onclick = () => {
        const container = document.getElementById('board-container');
        container.scrollLeft = 10400 - (container.clientWidth / 2);
        container.scrollTop = 10400 - (container.clientHeight / 2);
    };
    
    document.getElementById('back-to-lobby-btn').onclick = () => {
        if (confirm('Voulez-vous vraiment quitter la partie ?')) {
            location.reload();
        }
    };
}

function piocherNouvelleTuile() {
    console.log('🎲 Pioche d\'une nouvelle tuile...');
    const tileData = deck.draw();
    
    if (!tileData) {
        console.log('⚠️ Pioche vide !');
        alert('Partie terminée ! Plus de tuiles dans la pioche.');
        document.getElementById('tile-preview').innerHTML = '<p>Fin de partie</p>';
        document.getElementById('end-turn-btn').disabled = true;
        return;
    }

    console.log('🃏 Tuile piochée:', tileData.id);
    tuileEnMain = new Tile(tileData);
    tuileEnMain.rotation = 0;
    tuilePosee = false;

    // ✅ TOUT LE MONDE voit la tuile
    const previewContainer = document.getElementById('tile-preview');
    // Émettre événement tile-drawn
    eventBus.emit('tile-drawn', { tile: tuileEnMain });
    // ✅ Synchroniser la pioche si c'est notre tour
    if (turnManager.getIsMyTurn() && gameSync) {
        gameSync.syncTileDraw(tileData.id, 0);
    }

    eventBus.emit('deck-updated', { remaining: deck.remaining(), total: deck.total() });
    
    if (gameState) {
        turnManager.updateTurnState(); eventBus.emit('turn-changed', { isMyTurn: turnManager.getIsMyTurn(), currentPlayer: turnManager.getCurrentPlayer() });
    }
    
    // ✅ 5) Rafraîchir les slots APRÈS updateTurnDisplay pour que isMyTurn soit à jour
    if (firstTilePlaced) {
    }
}

function poserTuile(x, y, tile, isFirst = false) {
    if (!isFirst && !plateau.canPlaceTile(x, y, tile)) return;

    const boardElement = document.getElementById('board');
    const img = document.createElement('img');
    img.src = tile.imagePath;
    img.className = "tile";
    img.style.gridColumn = x;
    img.style.gridRow = y;
    img.style.transform = `rotate(${tile.rotation}deg)`;
    boardElement.appendChild(img);
    
    const copy = tile.clone();
    plateau.addTile(x, y, copy);

    if (isFirst) {
        console.log('✅ Première tuile posée');
        firstTilePlaced = true;
        eventBus.emit('tile-placed', { x, y, tile });
        tuilePosee = true;
        document.querySelectorAll('.slot').forEach(s => s.remove());
        
        document.getElementById('tile-preview').innerHTML = '<img src="./assets/verso.png" style="width: 120px; border: 2px solid #666;">';
        
        if (gameSync) {
            gameSync.syncTilePlacement(x, y, tile);
        }
        
        lastPlacedTile = {x, y};
        
        // ✅ Garder tuileEnMain temporairement pour rafraîchir les slots
        const tempTile = tuileEnMain;
        tuileEnMain = null;
        tuileEnMain = tempTile;
        
        // ✅ Merger les zones après placement
        if (zoneMerger) {
            zoneMerger.updateZonesForNewTile(x, y);
        }
        
        if (turnManager.getIsMyTurn() && gameSync) {
            meepleCursorsUI.showCursors(x, y, gameState, placedMeeples, afficherSelecteurMeeple);
        }
        
        tuileEnMain = null;
    } else {
        tuilePosee = true;
        document.querySelectorAll('.slot').forEach(s => s.remove());
        
        document.getElementById('tile-preview').innerHTML = '<img src="./assets/verso.png" style="width: 120px; border: 2px solid #666;">';
        
        if (gameSync) {
            gameSync.syncTilePlacement(x, y, tile);
        }
        
        lastPlacedTile = {x, y};
        
        // ✅ Sauvegarder tuileEnMain avant de mettre à null
        const savedTile = tuileEnMain;
        tuileEnMain = null;
        
        // ✅ Merger les zones après placement
        if (zoneMerger) {
            zoneMerger.updateZonesForNewTile(x, y);
        }
        
        if (turnManager.getIsMyTurn() && gameSync) {
            meepleCursorsUI.showCursors(x, y, gameState, placedMeeples, afficherSelecteurMeeple);
        }
    }
}

function poserTuileSync(x, y, tile) {
    const boardElement = document.getElementById('board');
    const img = document.createElement('img');
    img.src = tile.imagePath;
    img.className = "tile";
    img.style.gridColumn = x;
    img.style.gridRow = y;
    img.style.transform = `rotate(${tile.rotation}deg)`;
    boardElement.appendChild(img);
    
    const copy = tile.clone();
    plateau.addTile(x, y, copy);
    
    // ✅ Merger les zones pour les tuiles synchronisées
    if (zoneMerger) {
        zoneMerger.updateZonesForNewTile(x, y);
    }

    if (!firstTilePlaced) {
        firstTilePlaced = true;
        eventBus.emit('tile-placed', { x, y, tile });
        tuilePosee = true;
        document.querySelectorAll('.slot').forEach(s => s.remove());
        document.getElementById('tile-preview').innerHTML = '<img src="./assets/verso.png" style="width: 120px; border: 2px solid #666;">';
        tuileEnMain = null;
    } else {
        tuilePosee = true;
        document.querySelectorAll('.slot').forEach(s => s.remove());
        
        // ✅ Afficher le verso après placement synchronisé
        document.getElementById('tile-preview').innerHTML = '<img src="./assets/verso.png" style="width: 120px; border: 2px solid #666;">';
        
        tuileEnMain = null;
    }
}

function mettreAJourCompteur() {
    const remaining = deck.remaining();
    const total = deck.total();
    console.log(`📊 Compteur: ${remaining} / ${total}`);
    document.getElementById('tile-counter').textContent = `Tuiles : ${remaining} / ${total}`;
}

// ========== MEEPLES ==========

/**
 * Calculer la position après rotation (grille 5x5)
 * @param {number} position - Position originale (1-25)
 * @param {number} rotation - Rotation en degrés (0, 90, 180, 270)
 * @returns {number} Position après rotation
 */
function rotatePosition(position, rotation) {
    if (rotation === 0) return position;
    
    // Convertir position en coordonnées (row, col)
    const row = Math.floor((position - 1) / 5);
    const col = (position - 1) % 5;
    
    let newRow = row;
    let newCol = col;
    
    // Appliquer les rotations successives
    const rotations = rotation / 90;
    for (let i = 0; i < rotations; i++) {
        const tempRow = newRow;
        newRow = newCol;
        newCol = 4 - tempRow;
    }
    
    // Reconvertir en position (1-25)
    return (newRow * 5) + newCol + 1;
}

/**
 * Récupérer les positions de meeple valides pour une tuile avec rotation
 */

/**
 * Afficher les curseurs de placement de meeple sur une tuile
 */

/**
 * Afficher le sélecteur de type de meeple (menu compact)
 */

/**
 * Placer un meeple
 */
/**
 * Wrapper pour afficherSelecteurMeeple - appelle meepleSelectorUI
 */
function afficherSelecteurMeeple(x, y, position, zoneType, mouseX, mouseY) {
    meepleSelectorUI.show(x, y, position, zoneType, mouseX, mouseY, placerMeeple);
}

function placerMeeple(x, y, position, meepleType) {
    // Obtenir la couleur du joueur
    if (!gameState || !multiplayer) return;
    const player = gameState.players.find(p => p.id === multiplayer.playerId);
    const playerColor = player ? player.color.charAt(0).toUpperCase() + player.color.slice(1) : 'Blue';
    const key = `${x},${y},${position}`;
    
    console.log('🎭 Placement meeple:', meepleType, 'à', x, y, 'position', position);
    
    // Sauvegarder
    placedMeeples[key] = {
        type: meepleType,
        color: playerColor,
        playerId: multiplayer.playerId
    };
    
    
    // ✅ Décrémenter le nombre de meeples disponibles
    decrementPlayerMeeples(multiplayer.playerId);

    // Afficher le meeple
    meepleDisplayUI.showMeeple(x, y, position, meepleType, playerColor);
    
    // Synchroniser
    if (gameSync) {
        gameSync.syncMeeplePlacement(x, y, position, meepleType, playerColor);
    }
    
    // ✅ Faire disparaître TOUS les curseurs (un seul meeple par tour)
    document.querySelectorAll('.meeple-cursors-container').forEach(c => c.remove());
}

/**
 * Afficher un meeple sur le plateau
 */

/**
 * Récupérer la couleur du joueur actuel
 */

// ==========

function setupNavigation(container, board) {
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomLevel += e.deltaY > 0 ? -0.1 : 0.1;
        zoomLevel = Math.max(0.2, Math.min(3, zoomLevel));
        board.style.transform = `scale(${zoomLevel})`;
    }, { passive: false });

    container.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('tile') || e.target.classList.contains('slot')) {
            return;
        }
        isDragging = true;
        container.style.cursor = 'grabbing';
        startX = e.pageX - container.offsetLeft;
        startY = e.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
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

    container.scrollLeft = 10400 - (container.clientWidth / 2);
    container.scrollTop = 10400 - (container.clientHeight / 2);
}

updateColorPickerVisibility();
console.log('Page chargée');

// ========================================
// GESTION DU TABLEAU DE SCORES
// ========================================

/**
 */
function decrementPlayerMeeples(playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player && player.meeples > 0) {
        player.meeples--;
        console.log(`🎭 ${player.name} a maintenant ${player.meeples} meeples disponibles`);
        eventBus.emit('score-updated', gameState);
        
        // Synchroniser
        if (gameSync) {
            gameSync.multiplayer.broadcast({
                type: 'meeple-count-update',
                playerId: playerId,
                meeples: player.meeples
            });
        }
    }
}

/**
 * Incrémenter le nombre de meeples d'un joueur
 */
function incrementPlayerMeeples(playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player && player.meeples < 7) {
        player.meeples++;
        console.log(`🎭 ${player.name} récupère un meeple (${player.meeples}/7)`);
        eventBus.emit('score-updated', gameState);
        
        // Synchroniser
        if (gameSync) {
            gameSync.multiplayer.broadcast({
                type: 'meeple-count-update',
                playerId: playerId,
                meeples: player.meeples
            });
        }
    }
}

/**
 * Vérifier si le joueur a des meeples disponibles
 */

// ========================================
// ÉVÉNEMENTS DES NOUVEAUX BOUTONS
// ========================================

// Bouton "Annuler le coup !" (à implémenter plus tard)
document.getElementById('undo-btn').addEventListener('click', () => {
    console.log('⏮️ Annulation du coup (fonctionnalité à implémenter)');
    alert('Fonctionnalité à venir : Annuler le dernier coup joué');
});

// Bouton "Tuiles restantes dans la pioche ?"
document.getElementById('remaining-tiles-btn').addEventListener('click', () => {
    if (!deck) {
        alert('Aucune partie en cours');
        return;
    }
    
    const remaining = deck.remaining();
    const total = deck.total();
    alert(`🎴 Tuiles restantes : ${remaining} / ${total}`);
});

// Bouton "Règles de cette partie ?"
document.getElementById('rules-btn').addEventListener('click', () => {
    console.log('📜 Affichage des règles (fonctionnalité à implémenter)');
    alert('Fonctionnalité à venir : Afficher les règles actives pour cette partie');
});

