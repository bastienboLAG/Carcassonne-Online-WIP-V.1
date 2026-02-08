/**
 * TilePlacement - Gère le placement des tuiles
 * Responsable de : validation, affichage, slots
 */
export class TilePlacement {
    constructor(eventBus, board, zoneMerger, gameSync) {
        this.eventBus = eventBus;
        this.board = board;
        this.zoneMerger = zoneMerger;
        this.gameSync = gameSync;
        this.currentTile = null;
        this.validSlots = [];
        this.firstTilePlaced = false;
    }

    /**
     * Initialiser les listeners
     */
    init() {
        this.eventBus.on('tile-drawn', this.onTileDrawn.bind(this));
        this.eventBus.on('tile-rotated', this.onTileRotated.bind(this));
    }

    /**
     * Callback quand une tuile est piochée
     */
    onTileDrawn(data) {
        this.currentTile = data.tile;
        this.refreshValidSlots();
    }

    /**
     * Callback quand une tuile est tournée
     */
    onTileRotated(data) {
        if (this.currentTile) {
            this.currentTile.rotation = data.rotation;
            this.refreshValidSlots();
        }
    }

    /**
     * Rafraîchir les emplacements valides
     */
    refreshValidSlots() {
        if (!this.currentTile) return;

        this.validSlots = [];

        // Si aucune tuile placée, pas de slots
        if (Object.keys(this.board.placedTiles).length === 0) {
            return;
        }

        // Parcourir toutes les tuiles placées
        Object.keys(this.board.placedTiles).forEach(key => {
            const [x, y] = key.split(',').map(Number);
            
            // Vérifier les 4 positions adjacentes
            const positions = [
                { x: x, y: y - 1 }, // Nord
                { x: x + 1, y: y }, // Est
                { x: x, y: y + 1 }, // Sud
                { x: x - 1, y: y }  // Ouest
            ];

            positions.forEach(pos => {
                if (this.board.isFree(pos.x, pos.y) && 
                    this.board.canPlaceTile(pos.x, pos.y, this.currentTile)) {
                    
                    // Éviter les doublons
                    const slotKey = `${pos.x},${pos.y}`;
                    if (!this.validSlots.find(s => s.key === slotKey)) {
                        this.validSlots.push({
                            x: pos.x,
                            y: pos.y,
                            key: slotKey
                        });
                    }
                }
            });
        });

        this.eventBus.emit('valid-slots-updated', {
            slots: this.validSlots,
            count: this.validSlots.length
        });
    }

    /**
     * Valider le placement d'une tuile
     */
    validatePlacement(x, y, tile) {
        // Vérifier que la position est libre
        if (!this.board.isFree(x, y)) {
            return {
                valid: false,
                reason: 'Position occupée'
            };
        }

        // Si première tuile, toujours valide
        if (!this.firstTilePlaced) {
            return { valid: true };
        }

        // Vérifier que les bords correspondent
        if (!this.board.canPlaceTile(x, y, tile)) {
            return {
                valid: false,
                reason: 'Les bords ne correspondent pas'
            };
        }

        return { valid: true };
    }

    /**
     * Placer une tuile
     */
    placeTile(x, y, tile, isFirstTile = false) {
        // Valider
        const validation = this.validatePlacement(x, y, tile);
        if (!validation.valid) {
            console.warn('❌ TilePlacement:', validation.reason);
            this.eventBus.emit('tile-placement-failed', {
                x, y, tile,
                reason: validation.reason
            });
            return false;
        }

        // Ajouter au plateau
        const tileCopy = tile.clone();
        this.board.addTile(x, y, tileCopy);

        // Mettre à jour les zones
        if (this.zoneMerger) {
            this.zoneMerger.updateZonesForNewTile(x, y);
        }

        console.log(`✅ TilePlacement: Tuile posée en (${x}, ${y})`);

        // Synchroniser via GameSync
        if (this.gameSync) {
            this.gameSync.syncTilePlacement(x, y, tile);
        }

        // Émettre événement
        this.eventBus.emit('tile-placed', {
            x, y,
            tile: tileCopy,
            isFirstTile,
            isLocal: true // Placement local (pas reçu par sync)
        });

        if (isFirstTile) {
            this.firstTilePlaced = true;
        }

        this.currentTile = null;
        this.validSlots = [];

        return true;
    }

    /**
     * Placer une tuile reçue d'un autre joueur (sync)
     * Ne déclenche pas les événements de meeple
     */
    placeRemoteTile(x, y, tile) {
        // Ajouter au plateau
        const tileCopy = tile.clone();
        this.board.addTile(x, y, tileCopy);

        // Mettre à jour les zones
        if (this.zoneMerger) {
            this.zoneMerger.updateZonesForNewTile(x, y);
        }

        console.log(`✅ TilePlacement: Tuile distante posée en (${x}, ${y})`);

        // Émettre événement SANS isLocal (ou isLocal: false)
        this.eventBus.emit('tile-placed', {
            x, y,
            tile: tileCopy,
            isFirstTile: false,
            isLocal: false // Placement distant
        });

        return true;
    }

    /**
     * Placer la première tuile (centre du plateau)
     */
    placeFirstTile(tile) {
        return this.placeTile(50, 50, tile, true);
    }

    /**
     * Obtenir les emplacements valides
     */
    getValidSlots() {
        return this.validSlots;
    }

    /**
     * Vérifier si une position est un emplacement valide
     */
    isValidSlot(x, y) {
        return this.validSlots.some(slot => slot.x === x && slot.y === y);
    }

    /**
     * Définir la tuile en main
     */
    setCurrentTile(tile) {
        this.currentTile = tile;
    }
}
