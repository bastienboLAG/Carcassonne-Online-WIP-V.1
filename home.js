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
import { UndoManager } from './modules/game/UndoManager.js';
import { TilePlacement } from './modules/game/TilePlacement.js';
import { MeeplePlacement } from './modules/game/MeeplePlacement.js';
import { ScorePanelUI } from './modules/ScorePanelUI.js';
import { SlotsUI } from './modules/SlotsUI.js';
import { TilePreviewUI } from './modules/TilePreviewUI.js';
import { MeepleCursorsUI } from './modules/MeepleCursorsUI.js';
import { MeepleSelectorUI } from './modules/MeepleSelectorUI.js';
import { MeepleDisplayUI } from './modules/MeepleDisplayUI.js';
import { LobbyUI } from './modules/ui/LobbyUI.js';
import { ModalUI } from './modules/ui/ModalUI.js';
// ========== VARIABLES LOBBY ==========
const multiplayer = new Multiplayer();
const lobbyUI = new LobbyUI(multiplayer);
const modalUI = new ModalUI();
let gameCode = null;
let playerName = '';
let playerColor = 'blue';
let players = []; // Synchronisé avec lobbyUI.getPlayers()
let takenColors = [];
let inLobby = false;
let isHost = false;
let eventListenersInstalled = false; // Éviter double listeners

// Configuration de la partie (règles et options)
let gameConfig = {
    playFields: true,
    showRemainingTiles: true
};

// ========== VARIABLES JEU ==========
const plateau = new Board();
const deck = new Deck();
let gameState = null;

// ========== EVENTBUS ==========
const eventBus = new EventBus();
const ruleRegistry = new RuleRegistry(eventBus);
let turnManager = null;
let undoManager = null;
let meeplePlacement = null;
let tilePlacement = null;
eventBus.setDebug(true); // Debug activé pour voir les événements
eventBus.on('tile-drawn', (data) => {
    if (data.tileData) {
        tuileEnMain = new Tile(data.tileData);
        tuileEnMain.rotation = data.tileData.rotation || 0;
        tuilePosee = false;
        
        // Afficher la tuile dans la preview
        if (tilePreviewUI) {
            tilePreviewUI.showTile(tuileEnMain);
        }
        
        // 📸 Sauvegarder snapshot au début du tour (POUR TOUT LE MONDE)
        // Même si on n'est pas le joueur actif, on sauvegarde pour pouvoir restaurer les annulations distantes
        // NE PAS sauvegarder si c'est une annulation (fromUndo: true)
        if (undoManager && !data.fromNetwork && !data.fromUndo) {
            undoManager.saveTurnStart(placedMeeples);
        }
        
        // Synchroniser si c'est notre tour et pas depuis le réseau ET pas une annulation
        if (!data.fromNetwork && !data.fromUndo && turnManager && turnManager.getIsMyTurn() && gameSync) {
            gameSync.syncTileDraw(data.tileData.id, tuileEnMain.rotation);
        }
        
        // ✅ Vérifier si la tuile est plaçable (seulement pour le joueur qui vient de piocher)
        if (!data.fromNetwork && !data.fromUndo && tilePlacement) {
            console.log('🔍 Vérification placement tuile:', tuileEnMain.id, '- tilePlacement.plateau:', !!tilePlacement.plateau);
            const placeable = isTilePlaceable(tuileEnMain);
            console.log('🔍 Résultat isTilePlaceable:', placeable);
            if (!placeable) {
                console.log('⛔ Tuile implaçable détectée:', tuileEnMain.id);
                const actionText = gameConfig?.unplaceableAction === 'reshuffle' 
                    ? 'remise dans la pioche' 
                    : 'détruite';
                showUnplaceableBadge(tuileEnMain, actionText);
            }
        }
    }
});
eventBus.on('turn-changed', (data) => {
    isMyTurn = data.isMyTurn;
    console.log('🔄 Sync isMyTurn global:', isMyTurn);
    // Mettre à jour l'affichage du bouton
    updateTurnDisplay();
});

// ✅ Écouter turn-ended pour synchroniser TOUS les joueurs (pas juste le nouveau joueur actif)
eventBus.on('turn-ended', (data) => {
    console.log('⏭️ Turn ended - recalcul isMyTurn et refresh slots pour tous');
    // Recalculer isMyTurn pour ce joueur
    if (gameState && multiplayer) {
        const currentPlayer = gameState.getCurrentPlayer();
        const newIsMyTurn = currentPlayer && currentPlayer.id === multiplayer.playerId;
        
        console.log('   currentPlayer:', currentPlayer?.name, 'newIsMyTurn:', newIsMyTurn);
        
        // TOUJOURS émettre turn-changed pour rafraîchir les slots
        // Même si isMyTurn ne change pas, les slots doivent être recréés avec la nouvelle tuile
        console.log('   → Émission turn-changed pour rafraîchir slots');
        eventBus.emit('turn-changed', {
            isMyTurn: newIsMyTurn,
            currentPlayer: currentPlayer
        });
    }
});


// Écouter meeple-placed pour afficher et synchroniser
eventBus.on('meeple-placed', (data) => {
    // Afficher le meeple
    if (meepleDisplayUI) {
        meepleDisplayUI.showMeeple(data.x, data.y, data.position, data.meepleType, data.playerColor);
    }
    
    // Synchroniser si ce n'est pas déjà synchronisé
    if (!data.skipSync && gameSync) {
        gameSync.syncMeeplePlacement(data.x, data.y, data.position, data.meepleType, data.playerColor);
    }
});

// Écouter meeple-count-updated pour synchroniser
eventBus.on('meeple-count-updated', (data) => {
    if (gameSync && data.playerId === multiplayer.playerId) {
        gameSync.multiplayer.broadcast({
            type: 'meeple-count-update',
            playerId: data.playerId,
            meeples: data.meeples
        });
    }
});

let gameSync = null;
let originalLobbyHandler = null; // Handler de joinGame pour les messages lobby
let zoneMerger = null;
let scoring = null;
let tuileEnMain = null;
let tuilePosee = false;
let waitingToRedraw = false; // Mode repioche après destruction
let zoomLevel = 1;
let firstTilePlaced = false;
let scorePanelUI = null;
let slotsUI = null;
let tilePreviewUI = null;
let meepleCursorsUI = null;
let meepleSelectorUI = null;
let meepleDisplayUI = null;
let isMyTurn = false;
let gameEnded = false; // Indique si la partie est terminée
let finalScoresData = null; // Stocke les scores détaillés

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
                lobbyUI.updatePlayersList();
            }
            
            multiplayer.broadcast({
                type: 'color-change',
                playerId: multiplayer.playerId,
                color: playerColor
            });
        }
    });
});


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
        lobbyUI.setPlayers(players);
        lobbyUI.setIsHost(true);
        
        console.log('🎮 Partie créée ! Code:', gameCode);
        
        // Listeners pour synchroniser les checkboxes d'options
        document.getElementById('base-fields').addEventListener('change', (e) => {
            multiplayer.broadcast({
                type: 'option-change',
                option: 'base-fields',
                value: e.target.checked
            });
        });
        
        document.getElementById('list-remaining').addEventListener('change', (e) => {
            multiplayer.broadcast({
                type: 'option-change',
                option: 'list-remaining',
                value: e.target.checked
            });
        });
        
        multiplayer.onPlayerJoined = (playerId) => {
            console.log('👤 Nouveau joueur connecté (ID):', playerId);
        };
        
        multiplayer.onDataReceived = (data, from) => {
            console.log('📨 [HÔTE] Reçu:', data);
            
            if (data.type === 'player-info') {
                const existingPlayer = players.find(p => p.id === from);
                if (!existingPlayer) {
                    // Mettre à jour takenColors depuis lobbyUI
                    lobbyUI.setPlayers(players);
                    const takenColors = players.map(p => p.color);
                    
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
                    lobbyUI.setPlayers(players);
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
                        lobbyUI.updatePlayersList();
                        
                        multiplayer.broadcast({
                            type: 'players-update',
                            players: players
                        });
                    }
                }
            }
            
            if (data.type === 'player-order-update') {
                console.log('🔄 Ordre des joueurs mis à jour');
                players = data.players;
                lobbyUI.setPlayers(players);
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
        // Créer et sauvegarder le handler lobby (AVANT que GameSync le modifie)
        const lobbyHandler = (data, from) => {
            console.log('📨 [INVITÉ] Reçu:', data);
            
            if (data.type === 'welcome') {
                console.log('🎉', data.message);
            }
            
            if (data.type === 'players-update') {
                console.log('👥 Mise à jour liste joueurs:', data.players);
                players = data.players;
                lobbyUI.setPlayers(players);
                
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
            }
            
            if (data.type === 'color-change') {
                console.log('🎨 [INVITÉ] Changement de couleur reçu:', data.playerId, '→', data.color);
                const player = players.find(p => p.id === data.playerId);
                if (player) {
                    player.color = data.color;
                    lobbyUI.updatePlayersList();
                }
            }
            
            if (data.type === 'player-order-update') {
                console.log('🔄 [INVITÉ] Ordre des joueurs mis à jour');
                players = data.players;
                lobbyUI.setPlayers(players);
            }
            
            if (data.type === 'return-to-lobby') {
                console.log('🔙 [INVITÉ] Retour au lobby demandé');
                returnToLobby();
            }
            
            if (data.type === 'option-change') {
                console.log('⚙️ [INVITÉ] Option changée:', data.option, '=', data.value);
                const checkbox = document.getElementById(data.option);
                if (checkbox) {
                    checkbox.checked = data.value;
                }
            }
            
            // ✅ NOUVEAU : Écouter le signal de démarrage
            if (data.type === 'game-starting') {
                console.log('🎮 [INVITÉ] L\'hôte démarre la partie !');
                
                // Recevoir la configuration
                if (data.config) {
                    gameConfig = data.config;
                    console.log('⚙️ [INVITÉ] Configuration reçue:', gameConfig);
                }
                
                startGameForInvite();
            }
            
            // ✅ Écouter le retour au lobby
            if (data.type === 'return-to-lobby') {
                console.log('🔙 [INVITÉ] Retour au lobby demandé par l\'hôte');
                returnToLobby();
            }
        };
        
        // Sauvegarder globalement ET assigner
        originalLobbyHandler = lobbyHandler;
        multiplayer.onDataReceived = lobbyHandler;
        
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
    
    // Lire les options du lobby
    gameConfig = {
        playFields: document.getElementById('base-fields').checked,
        showRemainingTiles: document.getElementById('list-remaining').checked,
        testDeck: document.getElementById('use-test-deck').checked,
        enableDebug: document.getElementById('enable-debug').checked,
        unplaceableAction: document.querySelector('input[name="unplaceable"]:checked')?.value || 'destroy',
        extensions: {
            base: true // Toujours activé pour l'instant
        }
    };
    console.log('⚙️ Configuration:', gameConfig);
    
    // Envoyer le signal aux invités avec la config
    if (isHost) {
        multiplayer.broadcast({
            type: 'game-starting',
            message: 'L\'hôte démarre la partie !',
            config: gameConfig
        });
    }
    
    // Démarrer le jeu
    await startGame();
});

// ✅ FONCTION COMMUNE D'INITIALISATION DES MODULES
function initializeGameModules() {
    console.log('🔧 Initialisation des modules de jeu...');
    
    // ScorePanelUI
    scorePanelUI = new ScorePanelUI(eventBus, gameState);
    
    // SlotsUI (UNE SEULE INSTANCE)
    slotsUI = new SlotsUI(plateau, gameSync, eventBus, () => tuileEnMain);
    slotsUI.init();
    slotsUI.setSlotClickHandler(poserTuile);
    slotsUI.isMyTurn = isMyTurn;
    slotsUI.firstTilePlaced = firstTilePlaced;
    
    // TilePreviewUI
    tilePreviewUI = new TilePreviewUI(eventBus);
    tilePreviewUI.init();
    
    // ZoneMerger et Scoring
    zoneMerger = new ZoneMerger(plateau);
    scoring = new Scoring(zoneMerger);
    console.log('🔗 ZoneMerger et Scoring initialisés');
    
    // TilePlacement
    tilePlacement = new TilePlacement(eventBus, plateau, zoneMerger);
    console.log('📐 TilePlacement initialisé');
    
    // MeeplePlacement
    meeplePlacement = new MeeplePlacement(eventBus, gameState, zoneMerger);
    meeplePlacement.setPlacedMeeples(placedMeeples);
    console.log('🎭 MeeplePlacement initialisé');
    
    // MeepleCursorsUI
    meepleCursorsUI = new MeepleCursorsUI(multiplayer, zoneMerger, plateau, gameConfig);
    meepleCursorsUI.init();
    
    // MeepleSelectorUI
    meepleSelectorUI = new MeepleSelectorUI(multiplayer, gameState, gameConfig);
    
    // MeepleDisplayUI
    meepleDisplayUI = new MeepleDisplayUI();
    meepleDisplayUI.init();
    
    // UndoManager
    undoManager = new UndoManager(eventBus, gameState, plateau, zoneMerger);
    console.log('⏪ UndoManager initialisé');
    
    console.log('✅ Tous les modules initialisés');
}

// ✅ FONCTION POUR DÉMARRER LE JEU (HÔTE)
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
        gameState.addPlayer(player.id, player.name, player.color, player.isHost);
    });
    console.log('👥 Joueurs ajoutés au GameState:', gameState.players);
    
    // Initialiser GameSync (hôte n'a pas de lobby handler à préserver)
    gameSync = new GameSync(multiplayer, gameState, null);
    gameSync.init();
    console.log('🔗 GameSync initialisé');
    
    // Initialiser TurnManager
    turnManager = new TurnManager(eventBus, gameState, deck, multiplayer);
    turnManager.init(); // Initialiser le tour
    console.log('🔄 TurnManager initialisé');
    
    // Initialiser tous les modules (fonction commune)
    initializeGameModules();
    
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
        updateTurnDisplay();
    };
    
    gameSync.onTileRotated = (rotation) => {
        console.log('🔄 [SYNC] Rotation reçue:', rotation);
        if (tuileEnMain) {
            tuileEnMain.rotation = rotation; // Valeur logique (0-270)
            
            const currentImg = document.getElementById('current-tile-img');
            if (currentImg) {
                // Lire la rotation CSS actuelle et ajouter 90 (comme l'hôte)
                const currentTransform = currentImg.style.transform;
                const currentDeg = parseInt(currentTransform.match(/rotate\((\d+)deg\)/)?.[1] || '0');
                const newDeg = currentDeg + 90;
                currentImg.style.transform = `rotate(${newDeg}deg)`;
                console.log(`  → CSS: ${currentDeg}deg + 90 = ${newDeg}deg`);
            }
            // Émettre tile-rotated pour que SlotsUI rafraîchisse
            eventBus.emit('tile-rotated', { rotation });
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
    
    gameSync.onMeepleCountUpdate = (playerId, meeples) => {
        console.log('🎭 [SYNC] Mise à jour compteur reçue:', playerId, meeples);
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            player.meeples = meeples;
            eventBus.emit('meeple-count-updated', { playerId, meeples });
        }
    };
    
    gameSync.onScoreUpdate = (scoringResults, meeplesToReturn) => {
        console.log('💰 [SYNC] Mise à jour des scores reçue');
        
        // Appliquer les scores
        scoringResults.forEach(({ playerId, points, reason, zoneType }) => {
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                player.score += points;
                
                // ✅ Incrémenter le détail selon le type de zone
                if (zoneType === 'city') {
                    player.scoreDetail.cities += points;
                } else if (zoneType === 'road') {
                    player.scoreDetail.roads += points;
                } else if (zoneType === 'abbey') {
                    player.scoreDetail.monasteries += points;
                }
                
                console.log(`  ${player.name} +${points} pts (${reason})`);
            }
        });
        
        // Retirer les meeples
        meeplesToReturn.forEach(key => {
            document.querySelectorAll(`.meeple[data-key="${key}"]`).forEach(el => el.remove());
            delete placedMeeples[key];
        });
        
        // Mettre à jour l'affichage
        updateTurnDisplay();
    };
    
    gameSync.onTurnUndo = (undoneAction) => {
        console.log('⏪ [SYNC] Annulation distante reçue');
        handleRemoteUndo(undoneAction);
    };
    
    gameSync.onGameEnded = (detailedScores) => {
        console.log('🏁 [SYNC] Fin de partie reçue');
        gameEnded = true;
        finalScoresData = detailedScores;
        
        // Mettre à jour les scores dans le gameState local
        detailedScores.forEach(playerScore => {
            const player = gameState.players.find(p => p.id === playerScore.id);
            if (player) {
                player.score = playerScore.total;
                player.scoreDetail = {
                    cities: playerScore.cities,
                    roads: playerScore.roads,
                    monasteries: playerScore.monasteries,
                    fields: playerScore.fields
                };
            }
        });
        
        eventBus.emit('score-updated'); // Mettre à jour le panneau de droite
        updateTurnDisplay(); // Mettre à jour le bouton
        showFinalScoresModal(detailedScores);
    };
    
    gameSync.onTileDestroyed = (tileId, playerName) => {
        console.log('🗑️ [SYNC] Tuile détruite:', tileId, 'par', playerName);
        // Masquer la tuile détruite
        if (tilePreviewUI) {
            tilePreviewUI.showBackside();
        }
        showTileDestroyedModal(tileId, playerName, false);
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
        updateTurnDisplay();
        
        // ✅ Créer le slot central APRÈS updateTurnDisplay (pour que isMyTurn soit défini)
        console.log('🎯 Appel de creerSlotCentral...');
        slotsUI.createCentralSlot();
    } else {
        console.log('👤 [INVITÉ] En attente de la pioche...');
        afficherMessage('En attente de l\'hôte...');
    }
    
    console.log('✅ Initialisation terminée');
    
    // Afficher bouton retour lobby (hôte uniquement)
    document.getElementById('back-to-lobby-btn').style.display = 'block';
    
    // Enregistrer et activer les règles de base avec la configuration
    ruleRegistry.register('base', BaseRules, gameConfig);
    ruleRegistry.enable('base');
    console.log('📋 Règles actives:', ruleRegistry.getActiveRules());
    
    // Gérer le bouton tuiles restantes selon la config
    const remainingTilesBtn = document.getElementById('remaining-tiles-btn');
    if (gameConfig.showRemainingTiles) {
        remainingTilesBtn.style.display = 'block';
    } else {
        remainingTilesBtn.style.display = 'none';
    }
    
    // Gérer le bouton de test debug selon la config
    const testModalBtn = document.getElementById('test-modal-btn');
    if (gameConfig.enableDebug) {
        testModalBtn.style.display = 'block';
    } else {
        testModalBtn.style.display = 'none';
    }
}

async function startGameForInvite() {
    console.log('🎮 [INVITÉ] Initialisation du jeu...');
    
    // Cacher le lobby, afficher le jeu
    // Masquer le lobby, afficher le jeu
    lobbyUI.hide();
    
    // Initialiser le GameState
    gameState = new GameState();
    players.forEach(player => {
        gameState.addPlayer(player.id, player.name, player.color, player.isHost);
    });
    
    // Initialiser GameSync avec handler lobby original pour préserver game-starting
    gameSync = new GameSync(multiplayer, gameState, originalLobbyHandler);
    gameSync.init();
    console.log('🔗 GameSync initialisé');
    
    // Initialiser TurnManager
    turnManager = new TurnManager(eventBus, gameState, deck, multiplayer);
    turnManager.init(); // Initialiser le tour
    console.log('🔄 TurnManager initialisé');
    
    // Initialiser tous les modules (fonction commune)
    initializeGameModules();
    
    // Callbacks pour GameSync (identiques à l'hôte)
    // Callbacks
    gameSync.onGameStarted = (deckData, gameStateData) => {
        console.log('🎮 [INVITÉ] Pioche reçue !');
        deck.tiles = deckData.tiles;
        deck.currentIndex = deckData.currentIndex;
        deck.totalTiles = deckData.totalTiles;
        console.log('📦 [INVITÉ] Index reçu de l\'hôte:', deck.currentIndex);
        gameState.deserialize(gameStateData);
        eventBus.emit('deck-updated', { remaining: deck.remaining(), total: deck.total() });
        updateTurnDisplay();
        
        // ✅ Créer le slot central APRÈS avoir défini isMyTurn
        slotsUI.createCentralSlot();
    };
    
    gameSync.onTileRotated = (rotation) => {
        if (tuileEnMain) {
            tuileEnMain.rotation = rotation; // Valeur logique (0-270)
            
            const currentImg = document.getElementById('current-tile-img');
            if (currentImg) {
                // Lire la rotation CSS actuelle et ajouter 90 (comme l'hôte)
                const currentTransform = currentImg.style.transform;
                const currentDeg = parseInt(currentTransform.match(/rotate\((\d+)deg\)/)?.[1] || '0');
                const newDeg = currentDeg + 90;
                currentImg.style.transform = `rotate(${newDeg}deg)`;
            }
            // Émettre tile-rotated pour que SlotsUI rafraîchisse
            eventBus.emit('tile-rotated', { rotation });
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
    
    gameSync.onTileDrawn = (tileId, rotation) => {
        turnManager.receiveTileDrawn(tileId, rotation);
    
    gameSync.onMeepleCountUpdate = (playerId, meeples) => {
        console.log('🎭 [SYNC] Mise à jour compteur reçue:', playerId, meeples);
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            player.meeples = meeples;
            eventBus.emit('meeple-count-updated', { playerId, meeples });
        }
    };
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
    
    gameSync.onMeepleCountUpdate = (playerId, meeples) => {
        console.log('🎭 [SYNC] Mise à jour compteur reçue:', playerId, meeples);
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            player.meeples = meeples;
            eventBus.emit('meeple-count-updated', { playerId, meeples });
        }
    };
    
    gameSync.onScoreUpdate = (scoringResults, meeplesToReturn) => {
        console.log('💰 [SYNC] Mise à jour des scores reçue');
        
        scoringResults.forEach(({ playerId, points, reason, zoneType }) => {
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                player.score += points;
                
                // ✅ Incrémenter le détail selon le type de zone
                if (zoneType === 'city') {
                    player.scoreDetail.cities += points;
                } else if (zoneType === 'road') {
                    player.scoreDetail.roads += points;
                } else if (zoneType === 'abbey') {
                    player.scoreDetail.monasteries += points;
                }
                
                console.log(`  ${player.name} +${points} pts (${reason})`);
            }
        });
        
        meeplesToReturn.forEach(key => {
            document.querySelectorAll(`.meeple[data-key="${key}"]`).forEach(el => el.remove());
            delete placedMeeples[key];
        });
        
        updateTurnDisplay();
    };
    
    gameSync.onTurnUndo = (undoneAction) => {
        console.log('⏪ [SYNC] Annulation distante reçue');
        handleRemoteUndo(undoneAction);
    };
    
    gameSync.onGameEnded = (detailedScores) => {
        console.log('🏁 [SYNC] Fin de partie reçue');
        gameEnded = true;
        finalScoresData = detailedScores;
        
        // Mettre à jour les scores dans le gameState local
        detailedScores.forEach(playerScore => {
            const player = gameState.players.find(p => p.id === playerScore.id);
            if (player) {
                player.score = playerScore.total;
                player.scoreDetail = {
                    cities: playerScore.cities,
                    roads: playerScore.roads,
                    monasteries: playerScore.monasteries,
                    fields: playerScore.fields
                };
            }
        });
        
        eventBus.emit('score-updated'); // Mettre à jour le panneau de droite
        updateTurnDisplay(); // Mettre à jour le bouton
        showFinalScoresModal(detailedScores);
    };
    
    gameSync.onTileDestroyed = (tileId, playerName) => {
        console.log('🗑️ [SYNC] Tuile détruite:', tileId, 'par', playerName);
        // Masquer la tuile détruite
        if (tilePreviewUI) {
            tilePreviewUI.showBackside();
        }
        showTileDestroyedModal(tileId, playerName, false);
    };
    
    // Enregistrer et activer les règles de base avec la configuration
    ruleRegistry.register('base', BaseRules, gameConfig);
    ruleRegistry.enable('base');
    console.log('📋 [INVITÉ] Règles actives:', ruleRegistry.getActiveRules());
    
    // Gérer le bouton tuiles restantes selon la config
    const remainingTilesBtn = document.getElementById('remaining-tiles-btn');
    if (gameConfig.showRemainingTiles) {
        remainingTilesBtn.style.display = 'block';
    } else {
        remainingTilesBtn.style.display = 'none';
    }
    
    // Gérer le bouton de test debug selon la config
    const testModalBtn = document.getElementById('test-modal-btn');
    if (gameConfig.enableDebug) {
        testModalBtn.style.display = 'block';
    } else {
        testModalBtn.style.display = 'none';
    }
    
    setupEventListeners();
    setupNavigation(document.getElementById('board-container'), document.getElementById('board'));
    
    afficherMessage('En attente de l\'hôte...');
    
    // ✅ Le slot central sera créé quand l'invité recevra la pioche et que isMyTurn sera défini
}

// ========== FONCTIONS JEU ==========
/**
 * Gérer l'annulation reçue d'un autre joueur
 */
function handleRemoteUndo(undoneAction) {
    if (!undoManager) return;
    
    console.log('⏪ Application de l\'annulation distante:', undoneAction);
    
    // Appliquer directement selon le type (ne pas utiliser undoManager.undo() 
    // car il ne connaît pas l'état local du joueur actif)
    if (undoneAction.type === 'meeple') {
        const key = undoneAction.meeple.key;
        
        // Restaurer snapshot AVANT pose meeple (afterTilePlacedSnapshot)
        if (undoManager.afterTilePlacedSnapshot) {
            undoManager.restoreSnapshot(undoManager.afterTilePlacedSnapshot, placedMeeples);
            console.log('  🔄 Snapshot après tuile restauré');
        }
        
        // Retirer visuellement le meeple
        document.querySelectorAll(`.meeple[data-key="${key}"]`).forEach(el => el.remove());
        console.log('✅ Meeple distant annulé');
        
    } else if (undoneAction.type === 'tile') {
        const x = undoneAction.tile.x;
        const y = undoneAction.tile.y;
        const tileKey = `${x},${y}`;
        
        // Restaurer snapshot début de tour (turnStartSnapshot)
        if (undoManager.turnStartSnapshot) {
            undoManager.restoreSnapshot(undoManager.turnStartSnapshot, placedMeeples);
            console.log('  🔄 Snapshot début tour restauré');
        }
        
        // Retirer visuellement la tuile
        let tileEl = document.querySelector(`.tile[data-pos="${tileKey}"]`);
        if (!tileEl) {
            const tiles = document.querySelectorAll('.tile');
            tileEl = Array.from(tiles).find(el => 
                el.style.gridColumn == x && el.style.gridRow == y
            );
        }
        if (tileEl) {
            tileEl.remove();
        }
        
        // Si tuile centrale, recréer le slot et remettre firstTilePlaced à false
        if (x === 50 && y === 50) {
            firstTilePlaced = false;
            if (slotsUI) {
                slotsUI.firstTilePlaced = false;
                slotsUI.currentTile = null;
            }
            if (tilePlacement) {
                tilePlacement.firstTilePlaced = false;
            }
            
            document.querySelectorAll('.slot-central').forEach(s => s.remove());
            if (slotsUI) {
                slotsUI.createCentralSlot();
            }
        }
        
        console.log('✅ Tuile distante annulée');
    }
    
    // Mettre à jour l'affichage
    eventBus.emit('score-updated');
}

function updateTurnDisplay() {
    if (!gameState || gameState.players.length === 0) {
        isMyTurn = true;
        return;
    }
    
    const currentPlayer = gameState.getCurrentPlayer();
    isMyTurn = currentPlayer.id === multiplayer.playerId;
    
    // Mettre à jour l'état du bouton "Terminer mon tour" ou "Détails des scores"
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        if (gameEnded) {
            // Partie terminée : bouton devient "Détails des scores" (toujours actif)
            endTurnBtn.textContent = '📊 Détails des scores';
            endTurnBtn.disabled = false;
            endTurnBtn.style.opacity = '1';
            endTurnBtn.style.cursor = 'pointer';
            endTurnBtn.classList.add('final-score-btn');
        } else if (waitingToRedraw && isMyTurn) {
            // Mode repioche : bouton devient "Repiocher"
            endTurnBtn.textContent = '🎲 Repiocher';
            endTurnBtn.disabled = false;
            endTurnBtn.style.opacity = '1';
            endTurnBtn.style.cursor = 'pointer';
            endTurnBtn.classList.remove('final-score-btn');
        } else {
            // Partie en cours : comportement normal
            endTurnBtn.textContent = 'Terminer mon tour';
            endTurnBtn.classList.remove('final-score-btn');
            
            endTurnBtn.disabled = !isMyTurn;
            if (!isMyTurn) {
                endTurnBtn.style.opacity = '0.5';
                endTurnBtn.style.cursor = 'not-allowed';
            } else {
                endTurnBtn.style.opacity = '1';
                endTurnBtn.style.cursor = 'pointer';
            }
        }
    }
    
    // Mettre à jour l'état du bouton "Annuler le coup !"
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        const undoEnabled = isMyTurn && !gameEnded;
        undoBtn.disabled = !undoEnabled;
        if (!undoEnabled) {
            undoBtn.style.opacity = '0.5';
            undoBtn.style.cursor = 'not-allowed';
        } else {
            undoBtn.style.opacity = '1';
            undoBtn.style.cursor = 'pointer';
        }
    }
    
    // ✅ Mettre à jour le tableau de scores
    eventBus.emit('score-updated');
}


function afficherMessage(msg) {
    document.getElementById('tile-preview').innerHTML = `<p style="text-align: center; color: white;">${msg}</p>`;
}

function setupEventListeners() {
    // N'installer les listeners qu'une seule fois
    if (eventListenersInstalled) {
        console.log('⚠️ Event listeners déjà installés, skip');
        return;
    }
    
    document.getElementById('tile-preview').addEventListener('click', () => {
        if (!isMyTurn && gameSync) {
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
            
            // Émettre événement pour rafraîchir les slots
            eventBus.emit('tile-rotated', { rotation: tuileEnMain.rotation });
            
            if (firstTilePlaced) {
            }
        }
    });
    
    document.getElementById('end-turn-btn').onclick = () => {
        // Si la partie est terminée, ouvrir la modale des scores
        if (gameEnded) {
            if (finalScoresData) {
                showFinalScoresModal(finalScoresData);
            }
            return;
        }
        
        // Si en mode repioche, piocher une nouvelle tuile
        if (waitingToRedraw && isMyTurn) {
            document.getElementById('tile-destroyed-modal').style.display = 'none';
            turnManager.drawTile();
            setRedrawMode(false);
            return;
        }
        
        // Sinon, logique normale de fin de tour
        if (!isMyTurn && gameSync) {
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
                scoringResults.forEach(({ playerId, points, reason, zoneType }) => {
                    const player = gameState.players.find(p => p.id === playerId);
                    if (player) {
                        player.score += points;
                        
                        // ✅ Incrémenter le détail selon le type de zone
                        if (zoneType === 'city') {
                            player.scoreDetail.cities += points;
                        } else if (zoneType === 'road') {
                            player.scoreDetail.roads += points;
                        } else if (zoneType === 'abbey') {
                            player.scoreDetail.monasteries += points;
                        }
                        
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
                updateTurnDisplay();
            }
        }
        
        // ✅ Nettoyer les curseurs de meeple
        document.querySelectorAll('.meeple-cursors-container').forEach(c => c.remove());
        // Note: on ne réinitialise PAS lastPlacedTile pour garder la référence pour le bouton highlight
        
        if (gameSync) {
            // Synchroniser la fin de tour (qui met à jour gameState.currentPlayerIndex)
            gameSync.syncTurnEnd();
            
            // ✅ 6) IMPORTANT : Mettre à jour isMyTurn localement APRÈS avoir changé de tour
            const currentPlayer = gameState.getCurrentPlayer();
            isMyTurn = currentPlayer.id === multiplayer.playerId;
            console.log('🔄 Mise à jour isMyTurn:', isMyTurn, 'Tour de:', currentPlayer.name);
            
            // ✅ Émettre turn-changed pour rafraîchir les slots (joueur devient inactif)
            eventBus.emit('turn-changed', {
                isMyTurn: isMyTurn,
                currentPlayer: currentPlayer
            });
        }
        
        // ✅ Vérifier si c'est la fin de partie (deck vide)
        if (deck.currentIndex >= deck.totalTiles) {
            console.log('🏁 FIN DE PARTIE - Calcul des scores finaux');
            
            if (scoring && zoneMerger) {
                // Utiliser la nouvelle méthode qui applique ET retourne le détail
                const detailedScores = scoring.applyAndGetFinalScores(placedMeeples, gameState);
                
                console.log('💰 Scores finaux détaillés:', detailedScores);
                
                // Marquer la fin de partie
                gameEnded = true;
                finalScoresData = detailedScores;
                
                // Mettre à jour l'affichage des scores (émettre score-updated pour le panneau)
                eventBus.emit('score-updated');
                updateTurnDisplay();
                
                // Afficher la modale des scores
                showFinalScoresModal(detailedScores);
                
                // Synchroniser l'état de fin de partie
                if (gameSync) {
                    gameSync.syncGameEnded(detailedScores);
                }
            }
            
            return; // Ne pas piocher de nouvelle tuile
        }
        
        // ⏪ Reset UndoManager AVANT de piocher (sinon efface le nouveau snapshot)
        if (undoManager) {
            undoManager.reset();
        }
        
        // Le nouveau joueur actif piochera dans receiveTurnEnded()
        // L'ancien joueur actif recevra tile-drawn via le réseau et fera draw() dans receiveTileDrawn()
        
        // Mettre à jour l'affichage du tour
        if (gameState) {
            updateTurnDisplay();
        }
    };
    
    document.getElementById('recenter-btn').onclick = () => {
        const container = document.getElementById('board-container');
        container.scrollLeft = 10400 - (container.clientWidth / 2);
        container.scrollTop = 10400 - (container.clientHeight / 2);
    };
    
    document.getElementById('highlight-tile-btn').onclick = () => {
        if (!lastPlacedTile) {
            // Aucune tuile posée, ne rien faire silencieusement
            return;
        }
        
        const { x, y } = lastPlacedTile;
        const tileElement = document.querySelector(`.tile[data-pos="${x},${y}"]`);
        
        if (!tileElement) {
            console.warn('⚠️ Tuile non trouvée pour highlight');
            return;
        }
        
        // Ajouter la classe d'animation
        tileElement.classList.add('tile-highlight');
        
        // Retirer après 3 secondes
        setTimeout(() => {
            tileElement.classList.remove('tile-highlight');
        }, 3000);
        
        console.log('✨ Highlight activé sur tuile', x, y);
    };
    
    document.getElementById('back-to-lobby-btn').onclick = () => {
        if (confirm('Retourner au lobby ? (La partie sera terminée mais les joueurs resteront connectés)')) {
            returnToLobby();
        }
    };
    
    // Bouton fermer la modale
    document.getElementById('close-final-scores-btn').onclick = () => {
        document.getElementById('final-scores-modal').style.display = 'none';
    };
    
    // Bouton "Confirmer" de la modale implaçable → détruire la tuile
    document.getElementById('unplaceable-confirm-btn').onclick = () => {
        const currentPlayer = gameState?.getCurrentPlayer();
        const tileId = tuileEnMain?.id || '?';
        const playerName = currentPlayer?.name || '?';
        
        // Fermer badge + modale implaçable
        hideUnplaceableBadge();
        
        // Masquer la tuile en main (afficher le verso)
        if (tilePreviewUI) {
            tilePreviewUI.showBackside();
        }
        
        // Afficher modale info pour TOUS
        showTileDestroyedModal(tileId, playerName, true);
        
        // Synchroniser la destruction pour les autres joueurs
        if (gameSync) {
            gameSync.syncTileDestroyed(tileId, playerName);
        }
        
        // Passer en mode repioche
        setRedrawMode(true);
    };
    
    // Bouton "Examiner le plateau" de la modale implaçable
    document.getElementById('unplaceable-examine-btn').onclick = () => {
        document.getElementById('unplaceable-modal').style.display = 'none';
    };
    
    // Bouton "OK" de la modale info destruction
    document.getElementById('tile-destroyed-ok-btn').onclick = () => {
        document.getElementById('tile-destroyed-modal').style.display = 'none';
    };
    
    // Bouton de test debug (seulement si enableDebug = true)
    document.getElementById('test-modal-btn').onclick = () => {
        // Si des scores finaux existent, les utiliser
        if (finalScoresData) {
            showFinalScoresModal(finalScoresData);
            return;
        }
        // Sinon construire un aperçu avec les scores actuels
        if (gameState && gameState.players.length > 0) {
            const currentScores = gameState.players
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    color: p.color,
                    cities: p.scoreDetail?.cities || 0,
                    roads: p.scoreDetail?.roads || 0,
                    monasteries: p.scoreDetail?.monasteries || 0,
                    fields: p.scoreDetail?.fields || 0,
                    total: p.score
                }))
                .sort((a, b) => b.total - a.total);
            showFinalScoresModal(currentScores);
        }
    };
    
    eventListenersInstalled = true;
    console.log('✅ Event listeners installés');
}

/**
 * Vérifie si une tuile peut être posée quelque part sur le plateau
 */
function isTilePlaceable(tile) {
    const board = tilePlacement?.plateau;
    if (!board) {
        console.log('⚠️ isTilePlaceable: pas de plateau');
        return true;
    }

    const placedCount = Object.keys(board.placedTiles).length;
    console.log(`🔍 isTilePlaceable: ${placedCount} tuiles posées, test de ${tile.id}`);

    // Pas encore de tuile posée → on laisse passer
    if (placedCount === 0) {
        console.log('  ⏭️ Plateau vide, pas de vérification');
        return true;
    }

    const rotations = [0, 90, 180, 270];
    const originalRotation = tile.rotation;

    for (const rotation of rotations) {
        tile.rotation = rotation;

        for (const coord in board.placedTiles) {
            const [x, y] = coord.split(',').map(Number);
            const directions = [{dx:0,dy:-1},{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0}];
            for (const {dx, dy} of directions) {
                const nx = x + dx, ny = y + dy;
                if (board.isFree(nx, ny) && board.canPlaceTile(nx, ny, tile)) {
                    tile.rotation = originalRotation;
                    console.log(`  ✅ Placement possible à (${nx},${ny}) rotation ${rotation}°`);
                    return true;
                }
            }
        }
    }

    tile.rotation = originalRotation;
    console.log('  ❌ Aucune position valide pour aucune rotation');
    return false;
}

/**
 * Afficher le badge + modale tuile implaçable
 */
function showUnplaceableBadge(tile, actionText) {
    const badge = document.getElementById('unplaceable-badge');
    const modal = document.getElementById('unplaceable-modal');
    const modalText = document.getElementById('unplaceable-modal-text');
    
    modalText.textContent = `Cette tuile ne peut être placée nulle part sur le plateau. Elle va être ${actionText}.`;
    
    badge.style.display = 'block';
    modal.style.display = 'flex';
    
    badge.onclick = () => { modal.style.display = 'flex'; };
    
    document.getElementById('unplaceable-examine-btn').onclick = () => {
        modal.style.display = 'none';
    };
}

/**
 * Cacher le badge tuile implaçable
 */
function hideUnplaceableBadge() {
    document.getElementById('unplaceable-badge').style.display = 'none';
    document.getElementById('unplaceable-modal').style.display = 'none';
}

/**
 * Afficher la modale info destruction
 */
function showTileDestroyedModal(tileId, playerName, isActivePlayer) {
    const modal = document.getElementById('tile-destroyed-modal');
    const text = document.getElementById('tile-destroyed-text');
    
    if (isActivePlayer) {
        text.textContent = `La tuile ${tileId} était impossible à placer, elle a été détruite. Cliquez sur Repiocher pour continuer.`;
    } else {
        text.textContent = `La tuile ${tileId} était impossible à placer, elle a été détruite. ${playerName} va repiocher.`;
    }
    
    modal.style.display = 'flex';
}

/**
 * Activer/désactiver le mode repioche
 */
function setRedrawMode(active) {
    waitingToRedraw = active;
    updateTurnDisplay();
}

/**
 * Afficher la modale des scores finaux
 */
function showFinalScoresModal(detailedScores) {
    const modal = document.getElementById('final-scores-modal');
    const tbody = document.getElementById('final-scores-body');
    
    // Vider le tableau
    tbody.innerHTML = '';
    
    // Remplir avec les scores (déjà triés par score décroissant)
    detailedScores.forEach(player => {
        const row = document.createElement('tr');
        
        // Colonne joueur avec meeple coloré
        const nameCell = document.createElement('td');
        const colorCapitalized = player.color.charAt(0).toUpperCase() + player.color.slice(1);
        nameCell.innerHTML = `
            <div class="player-name-cell">
                <img src="assets/Meeples/${colorCapitalized}/Normal.png" alt="${player.color}">
                <span>${player.name}</span>
            </div>
        `;
        row.appendChild(nameCell);
        
        // Colonnes des scores
        const citiesCell = document.createElement('td');
        citiesCell.textContent = player.cities;
        row.appendChild(citiesCell);
        
        const roadsCell = document.createElement('td');
        roadsCell.textContent = player.roads;
        row.appendChild(roadsCell);
        
        const monasteriesCell = document.createElement('td');
        monasteriesCell.textContent = player.monasteries;
        row.appendChild(monasteriesCell);
        
        const fieldsCell = document.createElement('td');
        fieldsCell.textContent = player.fields;
        row.appendChild(fieldsCell);
        
        const totalCell = document.createElement('td');
        totalCell.textContent = player.total;
        totalCell.style.fontWeight = 'bold';
        row.appendChild(totalCell);
        
        tbody.appendChild(row);
    });
    
    // Afficher la modale
    modal.style.display = 'flex';
}

/**
 * Retourner au lobby sans déconnecter les joueurs
 */
function returnToLobby() {
    console.log('🔙 Retour au lobby...');
    
    // Notifier les autres joueurs AVANT de faire les changements locaux
    if (isHost && multiplayer && multiplayer.peer && multiplayer.peer.open) {
        console.log('📡 Envoi broadcast return-to-lobby');
        multiplayer.broadcast({
            type: 'return-to-lobby'
        });
    }
    
    // Masquer le bouton retour lobby
    document.getElementById('back-to-lobby-btn').style.display = 'none';
    
    // Cacher badge et modales implaçables
    hideUnplaceableBadge();
    document.getElementById('tile-destroyed-modal').style.display = 'none';
    
    // ✅ CLEANUP COMPLET DES MODULES via leurs méthodes destroy()
    console.log('🧹 Nettoyage des modules...');
    
    // Détruire les modules UI
    if (tilePreviewUI) {
        tilePreviewUI.destroy();
        tilePreviewUI = null;
    }
    if (slotsUI) {
        slotsUI.destroy();
        slotsUI = null;
    }
    if (meepleCursorsUI) {
        meepleCursorsUI.destroy();
        meepleCursorsUI = null;
    }
    if (meepleSelectorUI) {
        meepleSelectorUI.destroy();
        meepleSelectorUI = null;
    }
    if (meepleDisplayUI) {
        meepleDisplayUI.destroy();
        meepleDisplayUI = null;
    }
    if (scorePanelUI) {
        scorePanelUI.destroy();
        scorePanelUI = null;
    }
    
    // Réinitialiser les modules de jeu
    if (undoManager) {
        undoManager.destroy();
        undoManager = null;
    }
    gameSync = null;
    zoneMerger = null;
    scoring = null;
    tilePlacement = null;
    meeplePlacement = null;
    turnManager = null;
    waitingToRedraw = false;
    
    // Désactiver les règles
    if (ruleRegistry) {
        ruleRegistry.disable('base');
    }
    
    // Réinitialiser le deck (IMPORTANT pour éviter l'addition)
    if (deck) {
        deck.tiles = [];
        deck.currentIndex = 0;
        deck.totalTiles = 0;
    }
    
    // Réinitialiser le plateau (IMPORTANT pour éviter tuiles fantômes)
    if (plateau) {
        plateau.reset();
    }
    
    // Réinitialiser l'état du jeu
    gameState = null;
    tuileEnMain = null;
    tuilePosee = false;
    firstTilePlaced = false;
    zoomLevel = 1;
    placedMeeples = {};
    lastPlacedTile = null;
    isMyTurn = false;
    gameEnded = false;
    finalScoresData = null;
    
    // Fermer la modale des scores si ouverte
    const modal = document.getElementById('final-scores-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Nettoyer le plateau (board vidé par les destroy() mais on s'assure)
    document.getElementById('board').innerHTML = '';
    
    // Afficher le lobby (via LobbyUI)
    lobbyUI.show();
    lobbyUI.reset();
    lobbyUI.setPlayers(players);
    
    // Réafficher les boutons du lobby
    updateLobbyUI();
    
    console.log('✅ Retour au lobby terminé');
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
    if (isMyTurn && gameSync) {
        gameSync.syncTileDraw(tileData.id, 0);
    }

    eventBus.emit('deck-updated', { remaining: deck.remaining(), total: deck.total() });
    
    if (gameState) {
        updateTurnDisplay();
    }
    
    // ✅ 5) Rafraîchir les slots APRÈS updateTurnDisplay pour que isMyTurn soit à jour
    if (firstTilePlaced) {
    }
}

function poserTuile(x, y, tile, isFirst = false) {
    console.log('🎯 poserTuile appelé:', { x, y, tile, isFirst, tuileEnMain });
    
    // Utiliser TilePlacement
    const success = tilePlacement.placeTile(x, y, tile, { isFirst });
    
    if (!success) {
        return;
    }
    
    // Mise à jour de l'état global
    tuilePosee = true;
    firstTilePlaced = true;
    lastPlacedTile = { x, y };
    
    // Supprimer les slots
    document.querySelectorAll('.slot').forEach(s => s.remove());
    
    // Afficher le verso
    document.getElementById('tile-preview').innerHTML = '<img src="./assets/verso.png" style="width: 120px; border: 2px solid #666;">';
    
    // Synchroniser
    if (gameSync) {
        gameSync.syncTilePlacement(x, y, tile);
    }
    
    // Afficher curseurs meeples si notre tour
    if (isMyTurn && gameSync) {
        meepleCursorsUI.showCursors(x, y, gameState, placedMeeples, afficherSelecteurMeeple);
    }
    
    // 📸 Sauvegarder snapshot après pose de tuile
    if (undoManager && isMyTurn) {
        undoManager.saveAfterTilePlaced(x, y, tile, placedMeeples);
    }
    
    tuileEnMain = null;
}
function poserTuileSync(x, y, tile) {
    console.log('🔄 poserTuileSync appelé:', { x, y, tile });
    
    // Utiliser TilePlacement (skipSync pour éviter de re-synchroniser)
    const isFirst = !firstTilePlaced;
    tilePlacement.placeTile(x, y, tile, { isFirst, skipSync: true });
    
    // Mise à jour état global
    if (!firstTilePlaced) {
        firstTilePlaced = true;
    }
    tuilePosee = true; // Important: empêcher double placement
    lastPlacedTile = { x, y }; // Pour le bouton highlight
    
    // 📸 Sauvegarder snapshot après pose de tuile (pour pouvoir restaurer les annulations distantes)
    if (undoManager) {
        undoManager.saveAfterTilePlaced(x, y, tile, placedMeeples);
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
    if (!gameState || !multiplayer) return;
    
    console.log('🎭 placerMeeple appelé:', { x, y, position, meepleType });
    
    // Utiliser MeeplePlacement
    const success = meeplePlacement.placeMeeple(x, y, position, meepleType, multiplayer.playerId);
    
    if (!success) {
        return;
    }
    
    // 🎭 Marquer placement meeple dans UndoManager
    if (undoManager && isMyTurn) {
        const key = `${x},${y},${position}`;
        undoManager.markMeeplePlaced(x, y, position, key);
    }
    
    // Faire disparaître tous les curseurs (un seul meeple par tour)
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

// Initialiser LobbyUI
lobbyUI.init();

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
        eventBus.emit('score-updated');
        
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
        eventBus.emit('score-updated');
        
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

// Bouton "Annuler le coup !"
document.getElementById('undo-btn').addEventListener('click', () => {
    if (!undoManager) {
        alert('Aucune partie en cours');
        return;
    }
    
    if (!isMyTurn) {
        // Bouton déjà grisé, ne rien faire
        return;
    }
    
    if (!undoManager.canUndo()) {
        alert('Rien à annuler');
        return;
    }
    
    console.log('⏪ Annulation de l\'action...');
    
    // Annuler localement
    const undoneAction = undoManager.undo(placedMeeples);
    
    if (!undoneAction) {
        return;
    }
    
    // Appliquer les changements visuels
    if (undoneAction.type === 'meeple') {
        // Retirer le meeple du DOM
        const key = undoneAction.meeple.key;
        document.querySelectorAll(`.meeple[data-key="${key}"]`).forEach(el => el.remove());
        
        // Réafficher les curseurs
        if (lastPlacedTile) {
            meepleCursorsUI.showCursors(
                lastPlacedTile.x, 
                lastPlacedTile.y, 
                gameState, 
                placedMeeples, 
                afficherSelecteurMeeple
            );
        }
        
        console.log('✅ Meeple annulé');
    } else if (undoneAction.type === 'tile') {
        // Retirer la tuile du DOM
        const x = undoneAction.tile.x;
        const y = undoneAction.tile.y;
        const tileKey = `${x},${y}`;
        
        // Chercher par data-pos (nouvelle méthode) ou par gridColumn/gridRow (fallback)
        let tileEl = document.querySelector(`.tile[data-pos="${tileKey}"]`);
        if (!tileEl) {
            // Fallback : chercher par position CSS
            const tiles = document.querySelectorAll('.tile');
            tileEl = Array.from(tiles).find(el => 
                el.style.gridColumn == x && el.style.gridRow == y
            );
        }
        
        if (tileEl) {
            tileEl.remove();
            console.log('  🗑️ Élément DOM retiré:', tileKey);
        } else {
            console.warn('  ⚠️ Élément DOM non trouvé:', tileKey);
        }
        
        // Remettre la tuile en main
        tuileEnMain = undoneAction.tile.tile;
        tuilePosee = false;
        
        // Si c'est la tuile centrale (première tuile), remettre firstTilePlaced à false
        if (x === 50 && y === 50) {
            firstTilePlaced = false;
            if (slotsUI) {
                slotsUI.firstTilePlaced = false;
                slotsUI.currentTile = null; // Réinitialiser
            }
            if (tilePlacement) {
                tilePlacement.firstTilePlaced = false;
            }
            console.log('  🔄 firstTilePlaced remis à false');
        }
        
        // Réafficher la tuile dans la preview
        tilePreviewUI.showTile(tuileEnMain);
        
        // Réémettre tile-drawn pour que SlotsUI mette à jour currentTile (avec la rotation actuelle)
        // IMPORTANT : ajouter fromUndo: true pour éviter de sauvegarder un nouveau snapshot
        eventBus.emit('tile-drawn', { 
            tileData: {
                ...tuileEnMain,
                rotation: tuileEnMain.rotation
            },
            fromUndo: true  // Flag pour indiquer que c'est une annulation
        });
        
        // Si c'est la tuile centrale, supprimer l'ancien slot et en recréer un nouveau
        if (x === 50 && y === 50) {
            console.log('  🎯 Recréation du slot central');
            // Supprimer l'ancien slot s'il existe
            document.querySelectorAll('.slot-central').forEach(s => s.remove());
            if (slotsUI) {
                slotsUI.createCentralSlot();
            }
        }
        
        // Réafficher les slots
        if (slotsUI && firstTilePlaced) {
            slotsUI.refreshAllSlots();
        }
        
        // Masquer les curseurs
        meepleCursorsUI.hideCursors();
        
        console.log('✅ Tuile annulée');
    }
    
    // Synchroniser avec les autres joueurs
    if (gameSync) {
        gameSync.syncUndo(undoneAction);
    }
    
    // Mettre à jour l'affichage
    eventBus.emit('score-updated');
});

// Bouton "Tuiles restantes dans la pioche ?"
document.getElementById('remaining-tiles-btn').addEventListener('click', () => {
    if (!deck) {
        alert('Aucune partie en cours');
        return;
    }
    
    const remainingTiles = deck.getRemainingTilesByType();
    const totalRemaining = deck.remaining();
    
    modalUI.showRemainingTiles(remainingTiles, totalRemaining);
});

// Bouton "Règles de cette partie ?"
document.getElementById('rules-btn').addEventListener('click', () => {
    if (!gameConfig) {
        alert('Aucune partie en cours');
        return;
    }
    
    modalUI.showGameRules(gameConfig);
});

