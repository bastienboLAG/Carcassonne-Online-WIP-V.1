/**
 * BaseRules - Règles de base du jeu Carcassonne
 * Toujours actives, ne peuvent pas être désactivées
 */
export class BaseRules {
    constructor(eventBus, config) {
        this.eventBus = eventBus;
        this.config = config;
        this.enabled = false;
    }

    /**
     * Enregistrer les règles (s'abonner aux événements)
     */
    register() {
        this.enabled = true;
        console.log('📜 BaseRules: Règles de base enregistrées');

        // Écouter les événements pour appliquer les règles
        this.eventBus.on('tile-placement-check', this.validateTilePlacement.bind(this));
        this.eventBus.on('meeple-placement-check', this.validateMeeplePlacement.bind(this));
        this.eventBus.on('turn-end-check', this.validateTurnEnd.bind(this));
    }

    /**
     * Désactiver les règles (se désabonner)
     */
    unregister() {
        this.enabled = false;
        console.log('📜 BaseRules: Règles de base désactivées');

        this.eventBus.off('tile-placement-check', this.validateTilePlacement);
        this.eventBus.off('meeple-placement-check', this.validateMeeplePlacement);
        this.eventBus.off('turn-end-check', this.validateTurnEnd);
    }

    /**
     * Valider le placement d'une tuile
     * @param {object} data - {x, y, tile, board}
     * @returns {object} - {valid: boolean, reason?: string}
     */
    validateTilePlacement(data) {
        const { x, y, tile, board } = data;

        // 1. Vérifier que la position est libre
        if (!board.isFree(x, y)) {
            return {
                valid: false,
                reason: 'Position déjà occupée'
            };
        }

        // 2. Vérifier qu'il y a au moins un voisin (sauf première tuile)
        const neighbors = this.getNeighbors(x, y, board);
        if (neighbors.length === 0 && Object.keys(board.placedTiles).length > 0) {
            return {
                valid: false,
                reason: 'La tuile doit être adjacente à une tuile existante'
            };
        }

        // 3. Vérifier que les bords correspondent
        const isValid = board.canPlaceTile(x, y, tile);
        
        if (!isValid) {
            return {
                valid: false,
                reason: 'Les bords de la tuile ne correspondent pas aux tuiles voisines'
            };
        }

        return { valid: true };
    }

    /**
     * Valider le placement d'un meeple
     * @param {object} data - {x, y, position, meepleType, player, zoneMerger}
     * @returns {object} - {valid: boolean, reason?: string}
     */
    validateMeeplePlacement(data) {
        const { x, y, position, meepleType, player, zoneMerger } = data;

        // 1. Vérifier que le joueur a des meeples disponibles
        if (player.meeples <= 0) {
            return {
                valid: false,
                reason: 'Vous n\'avez plus de meeples disponibles'
            };
        }

        // 2. Vérifier que la zone n'est pas déjà occupée
        const mergedZone = zoneMerger.findMergedZoneForPosition(x, y, position);
        
        if (mergedZone) {
            const zoneMeeples = zoneMerger.getZoneMeeples(mergedZone, {});
            
            if (zoneMeeples.length > 0) {
                return {
                    valid: false,
                    reason: 'Cette zone est déjà occupée par un meeple'
                };
            }
        }

        // 3. Vérifier le type de meeple correspond au type de zone
        // (Cette logique pourrait être étendue plus tard)

        return { valid: true };
    }

    /**
     * Valider la fin de tour
     * @param {object} data - {player, tilePlaced}
     * @returns {object} - {valid: boolean, reason?: string}
     */
    validateTurnEnd(data) {
        const { player, tilePlaced } = data;

        // 1. Vérifier qu'une tuile a été posée
        if (!tilePlaced) {
            return {
                valid: false,
                reason: 'Vous devez poser une tuile avant de terminer votre tour'
            };
        }

        return { valid: true };
    }

    /**
     * Obtenir les tuiles voisines
     * @param {number} x
     * @param {number} y
     * @param {object} board
     * @returns {Array}
     */
    getNeighbors(x, y, board) {
        const neighbors = [];
        const positions = [
            { x: x, y: y - 1 }, // Nord
            { x: x + 1, y: y }, // Est
            { x: x, y: y + 1 }, // Sud
            { x: x - 1, y: y }  // Ouest
        ];

        positions.forEach(pos => {
            const key = `${pos.x},${pos.y}`;
            if (board.placedTiles[key]) {
                neighbors.push({
                    x: pos.x,
                    y: pos.y,
                    tile: board.placedTiles[key]
                });
            }
        });

        return neighbors;
    }

    /**
     * Calculer le score de base pour une zone
     * Cette méthode peut être override par des extensions
     */
    calculateBaseScore(zone, isComplete) {
        switch (zone.type) {
            case 'city':
                return isComplete 
                    ? (zone.tiles.length * 2) + (zone.shields * 2)
                    : zone.tiles.length + zone.shields;
            
            case 'road':
                return zone.tiles.length;
            
            case 'abbey':
                return isComplete ? 9 : 1 + this.countAdjacentTiles(zone);
            
            default:
                return 0;
        }
    }

    /**
     * Compter les tuiles adjacentes à une abbaye
     */
    countAdjacentTiles(abbeyZone) {
        // Logique à implémenter si nécessaire
        return 0;
    }
}
