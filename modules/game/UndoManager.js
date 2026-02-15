/**
 * UndoManager - Gère l'annulation des actions pendant un tour
 * Permet d'annuler la pose de meeple, puis la pose de tuile
 */
export class UndoManager {
    constructor(eventBus, gameState, plateau, zoneRegistry) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.plateau = plateau;
        this.zoneRegistry = zoneRegistry;
        
        // Snapshots pour l'annulation
        this.turnStartSnapshot = null;    // État au début du tour
        this.afterTilePlacedSnapshot = null; // État après pose de tuile
        
        // État du tour
        this.tilePlacedThisTurn = false;
        this.meeplePlacedThisTurn = false;
        this.lastTilePlaced = null; // {x, y, tile}
        this.lastMeeplePlaced = null; // {x, y, position, key}
    }

    /**
     * Sauvegarder l'état au début du tour
     */
    saveTurnStart(placedMeeples) {
        console.log('📸 Sauvegarde snapshot début de tour');
        
        this.turnStartSnapshot = {
            placedTiles: this.deepCopy(this.plateau.placedTiles),
            zones: this.zoneRegistry.serialize(),
            placedMeeples: this.deepCopy(placedMeeples),
            playerMeeples: this.gameState.players.map(p => ({
                id: p.id,
                meeples: p.meeples
            }))
        };
        
        // Reset état du tour
        this.tilePlacedThisTurn = false;
        this.meeplePlacedThisTurn = false;
        this.lastTilePlaced = null;
        this.lastMeeplePlaced = null;
        this.afterTilePlacedSnapshot = null;
    }

    /**
     * Sauvegarder l'état après placement de tuile
     */
    saveAfterTilePlaced(x, y, tile, placedMeeples) {
        console.log('📸 Sauvegarde snapshot après pose tuile');
        
        this.afterTilePlacedSnapshot = {
            placedTiles: this.deepCopy(this.plateau.placedTiles),
            zones: this.zoneRegistry.serialize(),
            placedMeeples: this.deepCopy(placedMeeples),
            playerMeeples: this.gameState.players.map(p => ({
                id: p.id,
                meeples: p.meeples
            }))
        };
        
        this.tilePlacedThisTurn = true;
        this.lastTilePlaced = { x, y, tile };
    }

    /**
     * Marquer qu'un meeple a été placé
     */
    markMeeplePlaced(x, y, position, key) {
        console.log('🎭 Meeple placé ce tour:', key);
        this.meeplePlacedThisTurn = true;
        this.lastMeeplePlaced = { x, y, position, key };
    }

    /**
     * Annuler la dernière action
     * @returns {Object|null} - Info sur ce qui a été annulé, ou null si rien à annuler
     */
    undo(placedMeeples) {
        // Cas 1 : Annuler la pose de meeple
        if (this.meeplePlacedThisTurn && this.afterTilePlacedSnapshot) {
            console.log('⏪ Annulation : retrait du meeple');
            
            // Restaurer l'état après placement de tuile (avant meeple)
            this.restoreSnapshot(this.afterTilePlacedSnapshot, placedMeeples);
            
            const undoneAction = {
                type: 'meeple',
                meeple: this.lastMeeplePlaced
            };
            
            this.meeplePlacedThisTurn = false;
            this.lastMeeplePlaced = null;
            
            return undoneAction;
        }
        
        // Cas 2 : Annuler la pose de tuile
        if (this.tilePlacedThisTurn && this.turnStartSnapshot) {
            console.log('⏪ Annulation : retrait de la tuile');
            
            // Restaurer l'état au début du tour
            this.restoreSnapshot(this.turnStartSnapshot, placedMeeples);
            
            const undoneAction = {
                type: 'tile',
                tile: this.lastTilePlaced
            };
            
            this.tilePlacedThisTurn = false;
            this.lastTilePlaced = null;
            this.afterTilePlacedSnapshot = null;
            
            return undoneAction;
        }
        
        // Rien à annuler
        console.log('⚠️ Rien à annuler');
        return null;
    }

    /**
     * Restaurer un snapshot
     */
    restoreSnapshot(snapshot, placedMeeples) {
        // Restaurer plateau
        this.plateau.placedTiles = this.deepCopy(snapshot.placedTiles);
        
        // Restaurer zones
        this.zoneRegistry.deserialize(snapshot.zones);
        
        // Restaurer meeples placés (vider l'objet et le remplir)
        Object.keys(placedMeeples).forEach(key => delete placedMeeples[key]);
        Object.assign(placedMeeples, this.deepCopy(snapshot.placedMeeples));
        
        // Restaurer compteur de meeples des joueurs
        snapshot.playerMeeples.forEach(saved => {
            const player = this.gameState.players.find(p => p.id === saved.id);
            if (player) {
                player.meeples = saved.meeples;
            }
        });
    }

    /**
     * Vérifier si on peut annuler
     */
    canUndo() {
        return this.meeplePlacedThisTurn || this.tilePlacedThisTurn;
    }

    /**
     * Reset à la fin du tour
     */
    reset() {
        this.turnStartSnapshot = null;
        this.afterTilePlacedSnapshot = null;
        this.tilePlacedThisTurn = false;
        this.meeplePlacedThisTurn = false;
        this.lastTilePlaced = null;
        this.lastMeeplePlaced = null;
    }

    /**
     * Deep copy d'un objet
     */
    deepCopy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Détruire le module
     */
    destroy() {
        console.log('🧹 UndoManager: cleanup');
        this.reset();
    }
}
