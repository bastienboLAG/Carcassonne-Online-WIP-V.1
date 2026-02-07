/**
 * MeeplePlacement - Gère le placement des meeples
 * Responsable de : validation, curseurs, contraintes
 */
export class MeeplePlacement {
    constructor(eventBus, zoneMerger, gameState) {
        this.eventBus = eventBus;
        this.zoneMerger = zoneMerger;
        this.gameState = gameState;
        this.lastPlacedTile = null;
        this.placedMeeples = {}; // "x,y,position" => {type, color, playerId}
    }

    /**
     * Initialiser les listeners
     */
    init() {
        this.eventBus.on('tile-placed', this.onTilePlaced.bind(this));
        this.eventBus.on('meeple-placed', this.onMeeplePlaced.bind(this));
        this.eventBus.on('score-calculated', this.onScoreCalculated.bind(this));
    }

    /**
     * Callback quand une tuile est posée
     */
    onTilePlaced(data) {
        this.lastPlacedTile = { x: data.x, y: data.y };
        
        // Émettre les positions valides pour placer un meeple
        this.eventBus.emit('meeple-positions-available', {
            x: data.x,
            y: data.y,
            tile: data.tile
        });
    }

    /**
     * Callback quand un meeple est posé
     */
    onMeeplePlaced(data) {
        const key = `${data.x},${data.y},${data.position}`;
        this.placedMeeples[key] = {
            type: data.meepleType,
            playerId: data.playerId,
            x: data.x,
            y: data.y,
            position: data.position
        };
    }

    /**
     * Callback quand les scores sont calculés (pour retourner les meeples)
     */
    onScoreCalculated(data) {
        if (data.meeplesToReturn) {
            data.meeplesToReturn.forEach(key => {
                if (this.placedMeeples[key]) {
                    const meeple = this.placedMeeples[key];
                    
                    // Incrémenter les meeples du joueur
                    const player = this.gameState.players.find(p => p.id === meeple.playerId);
                    if (player && player.meeples < 7) {
                        player.meeples++;
                        
                        this.eventBus.emit('meeple-returned', {
                            playerId: meeple.playerId,
                            meeples: player.meeples,
                            key: key
                        });
                    }
                    
                    delete this.placedMeeples[key];
                }
            });
        }
    }

    /**
     * Valider le placement d'un meeple
     */
    validatePlacement(x, y, position, meepleType, playerId) {
        // 1. Vérifier que le joueur a des meeples
        const player = this.gameState.players.find(p => p.id === playerId);
        if (!player || player.meeples <= 0) {
            return {
                valid: false,
                reason: 'Pas de meeples disponibles'
            };
        }

        // 2. Vérifier que la zone n'est pas déjà occupée
        const mergedZone = this.zoneMerger.findMergedZoneForPosition(x, y, position);
        
        if (mergedZone) {
            const zoneMeeples = this.zoneMerger.getZoneMeeples(mergedZone, this.placedMeeples);
            
            if (zoneMeeples.length > 0) {
                return {
                    valid: false,
                    reason: 'Zone déjà occupée'
                };
            }
        }

        return { valid: true };
    }

    /**
     * Placer un meeple
     */
    placeMeeple(x, y, position, meepleType, playerId) {
        // Valider
        const validation = this.validatePlacement(x, y, position, meepleType, playerId);
        if (!validation.valid) {
            console.warn('❌ MeeplePlacement:', validation.reason);
            this.eventBus.emit('meeple-placement-failed', {
                x, y, position, meepleType, playerId,
                reason: validation.reason
            });
            return false;
        }

        // Décrémenter les meeples du joueur
        const player = this.gameState.players.find(p => p.id === playerId);
        if (player) {
            player.meeples--;
            
            this.eventBus.emit('meeple-count-updated', {
                playerId: playerId,
                meeples: player.meeples
            });
        }

        // Sauvegarder
        const key = `${x},${y},${position}`;
        this.placedMeeples[key] = {
            type: meepleType,
            playerId: playerId,
            x: x,
            y: y,
            position: position
        };

        console.log(`✅ MeeplePlacement: Meeple posé en (${x}, ${y}, ${position})`);

        // Émettre événement
        this.eventBus.emit('meeple-placed', {
            x, y, position, meepleType, playerId
        });

        return true;
    }

    /**
     * Obtenir tous les meeples placés
     */
    getPlacedMeeples() {
        return this.placedMeeples;
    }

    /**
     * Vérifier si un joueur a des meeples disponibles
     */
    hasAvailableMeeples(playerId) {
        const player = this.gameState.players.find(p => p.id === playerId);
        return player && player.meeples > 0;
    }

    /**
     * Obtenir la dernière tuile posée
     */
    getLastPlacedTile() {
        return this.lastPlacedTile;
    }
}
