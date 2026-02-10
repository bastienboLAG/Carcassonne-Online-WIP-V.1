/**
 * MeepleCursorsUI - Gère l'affichage des curseurs de placement de meeples
 * CODE COPIÉ EXACTEMENT de afficherCurseursMeeple, afficherSelecteurMeeple
 */
export class MeepleCursorsUI {
    constructor(multiplayer, zoneMerger, placedMeeples, plateau) {
        this.multiplayer = multiplayer;
        this.zoneMerger = zoneMerger;
        this.placedMeeples = placedMeeples;
        this.plateau = plateau;
        this.boardElement = null;
    }

    init() {
        this.boardElement = document.getElementById('board');
    }

    /**
     * Obtenir les positions valides de meeple depuis les zones
     */
    getValidMeeplePositions(x, y) {
        const tile = this.plateau.getTile(x, y);
        if (!tile || !tile.zones) return [];
        
        const validPositions = [];
        tile.zones.forEach(zone => {
            if (zone.meeplePosition) {
                validPositions.push({
                    position: zone.meeplePosition,
                    zoneType: zone.type
                });
            }
        });
        
        return validPositions;
    }

    /**
     * Vérifier si le joueur a des meeples disponibles
     */
    hasAvailableMeeples(playerId, gameState) {
        if (!gameState) return false;
        const player = gameState.players.find(p => p.id === playerId);
        return player && player.meeples > 0;
    }

    /**
     * Afficher les curseurs de meeple - COPIE EXACTE de afficherCurseursMeeple()
     */
    showCursors(x, y, gameState, onCursorClick) {
        console.log('🎯 Affichage des curseurs de meeple sur', x, y);
        
        // ✅ Vérifier si le joueur a des meeples disponibles
        if (!this.hasAvailableMeeples(this.multiplayer.playerId, gameState)) {
            console.log('❌ Pas de meeples disponibles, pas d\'affichage de curseurs');
            return;
        }
        
        // Nettoyer les anciens curseurs et conteneurs
        document.querySelectorAll('.meeple-cursors-container').forEach(c => c.remove());
        
        // ✅ Récupérer les positions valides depuis les zones de la tuile
        const validPositions = this.getValidMeeplePositions(x, y);
        if (validPositions.length === 0) {
            console.log('⚠️ Aucune position de meeple valide sur cette tuile');
            return;
        }
        
        console.log('✅ Positions valides:', validPositions);
        
        // Créer un conteneur pour les curseurs sur cette tuile
        const container = document.createElement('div');
        container.className = 'meeple-cursors-container';
        container.style.gridColumn = x;
        container.style.gridRow = y;
        container.style.position = 'relative';
        container.style.width = '208px';
        container.style.height = '208px';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '100';
        
        // Créer un curseur pour chaque position valide
        validPositions.forEach(({position, zoneType}) => {
            const key = `${x},${y},${position}`;
            
            // Vérifier si la position est déjà occupée
            if (this.placedMeeples[key]) {
                console.log('⏭️ Position', position, 'déjà occupée, pas de curseur');
                return;
            }
            
            // ✅ Vérifier si la zone mergée contient déjà un meeple
            if (this.zoneMerger) {
                const mergedZone = this.zoneMerger.findMergedZoneForPosition(x, y, position);
                if (mergedZone) {
                    const meeplesInZone = this.zoneMerger.getZoneMeeples(mergedZone, this.placedMeeples);
                    if (meeplesInZone.length > 0) {
                        console.log('⏭️ Position', position, 'dans une zone avec meeple(s), pas de curseur');
                        return;
                    }
                }
            }
            
            const cursor = document.createElement('div');
            cursor.className = 'meeple-cursor';
            cursor.dataset.zoneType = zoneType;
            
            // Calculer la position dans la grille 5x5
            const row = Math.floor((position - 1) / 5);
            const col = (position - 1) % 5;
            
            const offsetX = 20.8 + (col * 41.6);
            const offsetY = 20.8 + (row * 41.6);
            
            cursor.style.position = 'absolute';
            cursor.style.left = `${offsetX}px`;
            cursor.style.top = `${offsetY}px`;
            cursor.style.width = '12px';
            cursor.style.height = '12px';
            cursor.style.borderRadius = '50%';
            cursor.style.backgroundColor = 'rgba(255, 215, 0, 0.6)';
            cursor.style.border = '2px solid gold';
            cursor.style.cursor = 'pointer';
            cursor.style.pointerEvents = 'auto';
            cursor.style.transition = 'all 0.2s';
            cursor.style.transform = 'translate(-50%, -50%)';
            
            cursor.onmouseenter = () => {
                cursor.style.backgroundColor = 'rgba(255, 215, 0, 1)';
                cursor.style.transform = 'translate(-50%, -50%) scale(1.3)';
            };
            
            cursor.onmouseleave = () => {
                cursor.style.backgroundColor = 'rgba(255, 215, 0, 0.6)';
                cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            };
            
            cursor.onclick = (e) => {
                e.stopPropagation();
                onCursorClick(x, y, position, zoneType, e.clientX, e.clientY);
            };
            
            container.appendChild(cursor);
        });
        
        this.boardElement.appendChild(container);
    }

    /**
     * Cacher tous les curseurs
     */
    hideCursors() {
        document.querySelectorAll('.meeple-cursors-container').forEach(c => c.remove());
    }
}
