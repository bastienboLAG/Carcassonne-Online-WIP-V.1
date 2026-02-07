/**
 * TileRotationUI - Gère la rotation de la tuile en main
 */
export class TileRotationUI {
    constructor(eventBus, tilePlacement, gameSync) {
        this.eventBus = eventBus;
        this.tilePlacement = tilePlacement;
        this.gameSync = gameSync;
        this.previewElement = null;
        this.isMyTurn = false;
        this.playerId = null;
    }

    /**
     * Définir le playerId
     */
    setPlayerId(playerId) {
        this.playerId = playerId;
    }

    /**
     * Initialiser
     */
    init() {
        this.previewElement = document.getElementById('tile-preview');
        
        if (!this.previewElement) {
            console.error('❌ TileRotationUI: Element #tile-preview introuvable');
            return;
        }

        // En solo ou si pas de playerId, toujours actif
        if (!this.playerId) {
            this.isMyTurn = true;
        }

        // Écouter événements
        this.eventBus.on('turn-started', this.onTurnStarted.bind(this));

        // Gérer le clic pour rotation
        this.previewElement.addEventListener('click', () => {
            if (!this.isMyTurn) return;
            
            const currentTile = this.tilePlacement.currentTile;
            if (!currentTile) return;

            // Faire tourner
            currentTile.rotate();

            // Émettre événement
            this.eventBus.emit('tile-rotated', {
                rotation: currentTile.rotation
            });

            // Synchroniser
            if (this.gameSync) {
                this.gameSync.syncTileRotation(currentTile.rotation);
            }
        });

        console.log('✅ TileRotationUI initialisé');
    }

    /**
     * Callback tour commencé
     */
    onTurnStarted(data) {
        if (this.playerId) {
            this.isMyTurn = data.player && data.player.id === this.playerId;
        }
    }
}
