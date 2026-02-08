/**
 * Gère la synchronisation du jeu en multijoueur
 */
export class GameSync {
    constructor(multiplayer, gameState) {
        this.multiplayer = multiplayer;
        this.gameState = gameState;
        this.isHost = multiplayer.isHost;
        
        // Callbacks pour les actions de jeu
        this.onDeckReceived = null;
        this.onTileRotated = null;
        this.onTilePlaced = null;
        this.onTurnEnded = null;
        this.onGameStarted = null;
        this.onTileDrawn = null;
        this.onMeeplePlaced = null;
        this.onScoreUpdate = null;
    }

    /**
     * Initialiser les listeners pour les messages réseau
     */
    init() {
        this.multiplayer.onDataReceived = (data, from) => {
            this._handleGameMessage(data, from);
        };
    }

    /**
     * [HÔTE] Démarrer la partie et envoyer la pioche à tous
     */
    startGame(deck) {
        if (!this.isHost) return;

        const deckData = {
            tiles: deck.tiles,
            currentIndex: deck.currentIndex,
            totalTiles: deck.totalTiles
        };

        console.log('🎮 [HÔTE] Envoi de la pioche aux joueurs...');
        
        this.multiplayer.broadcast({
            type: 'game-start',
            deck: deckData,
            gameState: this.gameState.serialize()
        });
    }

    /**
     * Synchroniser la rotation d'une tuile
     */
    syncTileRotation(rotation) {
        console.log('🔄 Sync rotation:', rotation);
        this.multiplayer.broadcast({
            type: 'tile-rotated',
            rotation: rotation,
            playerId: this.multiplayer.playerId
        });
    }

    /**
     * Synchroniser le placement d'une tuile
     */
    syncTilePlacement(x, y, tile) {
        console.log('📍 Sync placement:', x, y, tile.id, tile.rotation);
        this.multiplayer.broadcast({
            type: 'tile-placed',
            x: x,
            y: y,
            tileId: tile.id,
            rotation: tile.rotation,
            playerId: this.multiplayer.playerId
        });
    }

    /**
     * Synchroniser la fin du tour
     */
    syncTurnEnd() {
        console.log('⏭️ Sync fin de tour');
        
        // Passer au joueur suivant
        this.gameState.nextPlayer();
        
        // Diffuser aux autres joueurs
        this.multiplayer.broadcast({
            type: 'turn-ended',
            playerId: this.multiplayer.playerId,
            nextPlayerIndex: this.gameState.currentPlayerIndex,
            gameState: this.gameState.serialize()
        });
        
        return true;
    }

    /**
     * Synchroniser la pioche d'une nouvelle tuile
     */
    syncTileDraw(tileId, rotation) {
        console.log('🎲 Sync pioche tuile:', tileId);
        this.multiplayer.broadcast({
            type: 'tile-drawn',
            tileId: tileId,
            rotation: rotation,
            playerId: this.multiplayer.playerId
        });
    }

    /**
     * Synchroniser le placement d'un meeple
     */
    syncMeeplePlacement(x, y, position, meepleType, color) {
        console.log('🎭 Sync placement meeple:', x, y, position, meepleType);
        this.multiplayer.broadcast({
            type: 'meeple-placed',
            x: x,
            y: y,
            position: position,
            meepleType: meepleType,
            color: color,
            playerId: this.multiplayer.playerId
        });
    }

    /**
     * Synchroniser la mise à jour des scores
     */
    syncScoreUpdate(scoringResults, meeplesToReturn) {
        console.log('💰 Sync score update:', scoringResults);
        this.multiplayer.broadcast({
            type: 'score-update',
            scoringResults: scoringResults,
            meeplesToReturn: meeplesToReturn,
            playerId: this.multiplayer.playerId
        });
    }

    /**
     * Gérer les messages reçus
     * @private
     */
    _handleGameMessage(data, from) {
        console.log('📨 [SYNC] Message reçu:', data.type);

        switch (data.type) {
            case 'game-start':
                if (!this.isHost && this.onGameStarted) {
                    console.log('🎮 [INVITÉ] Réception de la pioche');
                    this.onGameStarted(data.deck, data.gameState);
                }
                break;

            case 'tile-rotated':
                if (this.onTileRotated && data.playerId !== this.multiplayer.playerId) {
                    console.log('🔄 [SYNC] Rotation reçue:', data.rotation);
                    this.onTileRotated(data.rotation);
                }
                break;

            case 'tile-placed':
                if (this.onTilePlaced && data.playerId !== this.multiplayer.playerId) {
                    console.log('📍 [SYNC] Placement reçu:', data.x, data.y, data.tileId);
                    this.onTilePlaced(data.x, data.y, data.tileId, data.rotation);
                }
                break;

            case 'turn-ended':
                if (this.onTurnEnded && data.playerId !== this.multiplayer.playerId) {
                    console.log('⏭️ [SYNC] Fin de tour reçue');
                    this.onTurnEnded(data.nextPlayerIndex, data.gameState);
                }
                break;

            case 'tile-drawn':
                if (this.onTileDrawn && data.playerId !== this.multiplayer.playerId) {
                    console.log('🎲 [SYNC] Pioche tuile reçue:', data.tileId);
                    this.onTileDrawn(data.tileId, data.rotation, data.playerId);
                }
                break;

            case 'meeple-placed':
                if (this.onMeeplePlaced && data.playerId !== this.multiplayer.playerId) {
                    console.log('🎭 [SYNC] Meeple placé reçu:', data.x, data.y, data.position);
                    this.onMeeplePlaced(data.x, data.y, data.position, data.meepleType, data.color, data.playerId);
                }
                break;

            case 'score-update':
                if (this.onScoreUpdate && data.playerId !== this.multiplayer.playerId) {
                    console.log('💰 [SYNC] Mise à jour des scores reçue');
                    this.onScoreUpdate(data.scoringResults, data.meeplesToReturn);
                }
                break;

            case 'meeple-count-update':
                if (data.playerId !== this.multiplayer.playerId) {
                    console.log('🎭 [SYNC] Mise à jour compteur meeples:', data.playerId, data.meeples);
                    const player = this.gameState.players.find(p => p.id === data.playerId);
                    if (player) {
                        player.meeples = data.meeples;
                        // Déclencher updateScorePanel si disponible
                        if (typeof updateScorePanel === 'function') {
                            updateScorePanel();
                        }
                    }
                }
                break;
        }
    }
}
