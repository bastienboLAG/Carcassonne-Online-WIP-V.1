/**
 * Gère le merge incrémental des zones
 */
import { ZoneRegistry } from '../ZoneRegistry.js';

export class ZoneMerger {
    constructor(board) {
        this.board = board;
        this.registry = new ZoneRegistry();
        
        // Map pour retrouver rapidement quelle zone contient quelle tuile
        // "x,y,zoneIndex" → zoneId
        this.tileToZone = new Map();
    }

    /**
     * Mise à jour incrémentale après placement d'une nouvelle tuile
     */
    updateZonesForNewTile(x, y) {
        console.log(`🔄 Mise à jour des zones pour nouvelle tuile (${x},${y})`);
        
        const tile = this.board.placedTiles[`${x},${y}`];
        if (!tile) {
            console.error('❌ Tuile non trouvée');
            return;
        }

        // Pour chaque zone de la nouvelle tuile
        tile.zones.forEach((zone, zoneIndex) => {
            this._processNewZone(x, y, zoneIndex, zone);
        });

        // Vérifier les fermetures et mettre à jour isComplete
        this._updateCompletionStatus();
        
        // Marquer les villes fermées dans l'historique
        this._updateClosedCitiesHistory();

        // Debug
        this.registry.listAll();
    }

    /**
     * Traiter une zone de la nouvelle tuile
     * @private
     */
    _processNewZone(x, y, zoneIndex, zone) {
        console.log(`  Traitement zone ${zoneIndex} (${zone.type})`);
        
        const key = `${x},${y},${zoneIndex}`;
        
        // Vérifier si cette zone touche des zones existantes
        const adjacentZones = this._findAdjacentZones(x, y, zoneIndex, zone);
        
        console.log(`    Zones adjacentes trouvées: ${adjacentZones.length}`);

        if (adjacentZones.length === 0) {
            // Nouvelle zone isolée
            const newZone = this.registry.createZone(zone.type);
            newZone.tiles.push({ x, y, zoneIndex });
            this._addShields(newZone, zone);
            this.tileToZone.set(key, newZone.id);
            
        } else if (adjacentZones.length === 1) {
            // Étendre une zone existante
            const existingZone = this.registry.getZone(adjacentZones[0]);
            existingZone.tiles.push({ x, y, zoneIndex });
            this._addShields(existingZone, zone);
            this.tileToZone.set(key, existingZone.id);
            console.log(`    ✅ Ajouté à zone existante ${adjacentZones[0]}`);
            
        } else {
            // Fusionner plusieurs zones + la nouvelle tuile
            console.log(`    🔗 Fusion de ${adjacentZones.length} zones`);
            const primaryZone = this.registry.getZone(adjacentZones[0]);
            
            // Ajouter la nouvelle tuile
            primaryZone.tiles.push({ x, y, zoneIndex });
            this._addShields(primaryZone, zone);
            this.tileToZone.set(key, primaryZone.id);
            
            // Fusionner les autres zones dans la primaire
            for (let i = 1; i < adjacentZones.length; i++) {
                const zoneToMerge = this.registry.getZone(adjacentZones[i]);
                
                // ✅ CORRECTION : Ne pas fusionner si c'est une zone de la MÊME tuile
                // qui a déjà été traitée (et qui n'est pas dans connectedTo)
                const isSameTileZone = zoneToMerge.tiles.some(t => t.x === x && t.y === y);
                if (isSameTileZone) {
                    console.log(`    ⚠️ Skip fusion ${adjacentZones[i]} (même tuile, pas connectée)`);
                    continue;
                }
                
                // Mettre à jour tileToZone pour toutes les tuiles de la zone fusionnée
                zoneToMerge.tiles.forEach(t => {
                    const tKey = `${t.x},${t.y},${t.zoneIndex}`;
                    this.tileToZone.set(tKey, primaryZone.id);
                });
                
                // Fusionner
                this.registry.mergeZones(primaryZone.id, adjacentZones[i]);
            }
        }
        
        // Traiter les zones connectées sur la même tuile
        if (zone.connectedTo) {
            zone.connectedTo.forEach(connectedIndex => {
                const connectedKey = `${x},${y},${connectedIndex}`;
                const currentZoneId = this.tileToZone.get(key);
                const connectedZoneId = this.tileToZone.get(connectedKey);
                
                if (connectedZoneId && currentZoneId !== connectedZoneId) {
                    // Fusionner les zones connectées
                    const zone1 = this.registry.getZone(currentZoneId);
                    const zone2 = this.registry.getZone(connectedZoneId);
                    
                    if (zone1 && zone2 && zone1.type === zone2.type) {
                        console.log(`    🔗 Fusion connexion interne ${currentZoneId} + ${connectedZoneId}`);
                        
                        // Mettre à jour tileToZone
                        zone2.tiles.forEach(t => {
                            const tKey = `${t.x},${t.y},${t.zoneIndex}`;
                            this.tileToZone.set(tKey, currentZoneId);
                        });
                        
                        this.registry.mergeZones(currentZoneId, connectedZoneId);
                    }
                }
            });
        }
    }

    /**
     * Trouver les zones adjacentes qui touchent cette zone
     * @private
     */
    _findAdjacentZones(x, y, zoneIndex, zone) {
        const adjacentZoneIds = new Set();
        
        if (!zone.edges) return [];

        const tile = this.board.placedTiles[`${x},${y}`];
        const rotation = tile ? tile.rotation : 0;

        const edges = Array.isArray(zone.edges) ? zone.edges : [zone.edges];
        
        console.log(`      🔎 Recherche voisins pour zone ${zoneIndex}, edges originaux:`, zone.edges);
        
        const directions = [
            { edge: 'north', dx: 0, dy: -1, opposite: 'south' },
            { edge: 'east', dx: 1, dy: 0, opposite: 'west' },
            { edge: 'south', dx: 0, dy: 1, opposite: 'north' },
            { edge: 'west', dx: -1, dy: 0, opposite: 'east' }
        ];

        edges.forEach(edge => {
            // ✅ Ne PAS simplifier, garder l'edge complet avec suffixes
            const rotatedEdge = this._rotateEdge(edge, rotation);
            
            console.log(`        Edge "${edge}" → après rotation → "${rotatedEdge}"`);
            
            // Extraire la direction principale pour trouver le voisin
            const mainDirection = rotatedEdge.split('-')[0];
            const dir = directions.find(d => d.edge === mainDirection);
            if (!dir) {
                console.log(`          ⚠️ Direction principale "${mainDirection}" non trouvée`);
                return;
            }

            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const neighborTile = this.board.placedTiles[`${nx},${ny}`];

            if (!neighborTile) {
                console.log(`          Pas de voisin à (${nx},${ny})`);
                return;
            }

            console.log(`          Voisin trouvé à (${nx},${ny}), rotation ${neighborTile.rotation}°`);

            // Trouver les zones du voisin qui touchent le bord opposé et ont le même type
            neighborTile.zones.forEach((neighborZone, neighborZoneIndex) => {
                if (neighborZone.type !== zone.type) return;
                if (!neighborZone.edges) return;

                const neighborEdges = Array.isArray(neighborZone.edges) ? neighborZone.edges : [neighborZone.edges];
                
                console.log(`            Zone ${neighborZoneIndex} du voisin: edges originaux =`, neighborZone.edges);
                
                // ✅ Appliquer la rotation aux edges du voisin (garder suffixes)
                const rotatedNeighborEdges = neighborEdges.map(e => {
                    const rotated = this._rotateEdge(e, neighborTile.rotation);
                    console.log(`              "${e}" → rotation ${neighborTile.rotation}° → "${rotated}"`);
                    return rotated;
                });
                
                // ✅ Calculer l'opposé de l'edge complet
                const oppositeEdge = this._getOppositeEdge(rotatedEdge);
                
                const hasOppositeEdge = rotatedNeighborEdges.includes(oppositeEdge);
                
                console.log(`            Cherche "${oppositeEdge}" dans`, rotatedNeighborEdges, '→', hasOppositeEdge ? '✅' : '❌');

                if (hasOppositeEdge) {
                    // ✅ Chercher dans le registry au lieu de tileToZone
                    const adjacentZone = this.registry.findZoneContaining(nx, ny, neighborZoneIndex);
                    if (adjacentZone) {
                        console.log(`            → Zone mergée ${adjacentZone.id} trouvée !`);
                        adjacentZoneIds.add(adjacentZone.id);
                    }
                }
            });
        });

        console.log(`      → Total zones adjacentes: ${adjacentZoneIds.size}`);
        return Array.from(adjacentZoneIds);
    }

    /**
     * Appliquer rotation à un edge (avec suffixes -top/-bottom/-left/-right)
     * @private
     */
    _rotateEdge(edge, rotation) {
        if (rotation === 0) return edge;
        
        const rotationTable = {
            90: {
                'north': 'east',
                'north-left': 'east-top',
                'north-right': 'east-bottom',
                'east': 'south',
                'east-top': 'south-right',
                'east-bottom': 'south-left',
                'south': 'west',
                'south-left': 'west-top',
                'south-right': 'west-bottom',
                'west': 'north',
                'west-top': 'north-right',
                'west-bottom': 'north-left'
            },
            180: {
                'north': 'south',
                'north-left': 'south-right',
                'north-right': 'south-left',
                'east': 'west',
                'east-top': 'west-bottom',
                'east-bottom': 'west-top',
                'south': 'north',
                'south-left': 'north-right',
                'south-right': 'north-left',
                'west': 'east',
                'west-top': 'east-bottom',
                'west-bottom': 'east-top'
            },
            270: {
                'north': 'west',
                'north-left': 'west-bottom',
                'north-right': 'west-top',
                'east': 'north',
                'east-top': 'north-left',
                'east-bottom': 'north-right',
                'south': 'east',
                'south-left': 'east-bottom',
                'south-right': 'east-top',
                'west': 'south',
                'west-top': 'south-left',
                'west-bottom': 'south-right'
            }
        };
        
        return rotationTable[rotation]?.[edge] || edge;
    }

    /**
     * Obtenir l'edge opposé (avec suffixes inversés)
     * @private
     */
    _getOppositeEdge(edge) {
        const opposites = {
            'north': 'south',
            'north-left': 'south-left',
            'north-right': 'south-right',
            'east': 'west',
            'east-top': 'west-top',
            'east-bottom': 'west-bottom',
            'south': 'north',
            'south-left': 'north-left',
            'south-right': 'north-right',
            'west': 'east',
            'west-top': 'east-top',
            'west-bottom': 'east-bottom'
        };
        
        return opposites[edge] || edge;
    }

    /**
     * Ajouter les blasons et adjacentCities d'une zone à une zone mergée
     * @private
     */
    _addShields(mergedZone, localZone) {
        if (localZone.features) {
            const features = Array.isArray(localZone.features) ? localZone.features : [localZone.features];
            if (features.includes('shield')) {
                mergedZone.shields++;
            }
            
            // ✅ Ajouter adjacentCities si présent
            if (typeof localZone.features === 'object' && localZone.features.adjacentCities) {
                const cities = Array.isArray(localZone.features.adjacentCities) 
                    ? localZone.features.adjacentCities 
                    : [localZone.features.adjacentCities];
                
                mergedZone.adjacentCities = [...new Set([...mergedZone.adjacentCities, ...cities])];
            }
        }
    }

    /**
     * Mettre à jour le statut de fermeture de toutes les zones
     * @private
     */
    _updateCompletionStatus() {
        for (const [id, zone] of this.registry.zones) {
            if (zone.type === 'city') {
                zone.isComplete = this._isCityComplete(zone);
            } else if (zone.type === 'road') {
                zone.isComplete = this._isRoadComplete(zone);
            } else if (zone.type === 'abbey') {
                zone.isComplete = this._isAbbeyComplete(zone);
            }
        }
    }

    /**
     * Mettre à jour l'historique des villes fermées
     * @private
     */
    _updateClosedCitiesHistory() {
        for (const [id, zone] of this.registry.zones) {
            if (zone.type === 'city' && zone.isComplete) {
                this.registry.markCityAsClosed(id);
            }
        }
    }

    /**
     * Vérifier si une ville est complète
     * @private
     */
    _isCityComplete(mergedZone) {
        for (const { x, y, zoneIndex } of mergedZone.tiles) {
            const tile = this.board.placedTiles[`${x},${y}`];
            const zone = tile.zones[zoneIndex];

            if (!zone.edges) continue;

            const edges = Array.isArray(zone.edges) ? zone.edges : [zone.edges];

            for (const edge of edges) {
                // ✅ Garder l'edge complet
                const rotatedEdge = this._rotateEdge(edge, tile.rotation);
                
                // Extraire direction principale pour trouver le voisin
                const mainDirection = rotatedEdge.split('-')[0];
                
                const directions = {
                    'north': { dx: 0, dy: -1 },
                    'east': { dx: 1, dy: 0 },
                    'south': { dx: 0, dy: 1 },
                    'west': { dx: -1, dy: 0 }
                };

                const dir = directions[mainDirection];
                if (!dir) continue;

                const nx = x + dir.dx;
                const ny = y + dir.dy;
                const neighborTile = this.board.placedTiles[`${nx},${ny}`];

                if (!neighborTile) return false;

                // ✅ Calculer l'opposé de l'edge complet
                const oppositeEdge = this._getOppositeEdge(rotatedEdge);

                const hasMatchingCity = neighborTile.zones.some(nz => {
                    if (nz.type !== 'city' || !nz.edges) return false;
                    const nEdges = Array.isArray(nz.edges) ? nz.edges : [nz.edges];
                    const rotatedNEdges = nEdges.map(e => this._rotateEdge(e, neighborTile.rotation));
                    return rotatedNEdges.includes(oppositeEdge);
                });

                if (!hasMatchingCity) return false;
            }
        }

        return true;
    }

    /**
     * Vérifier si une route est complète
     * @private
     */
    _isRoadComplete(mergedZone) {
        for (const { x, y, zoneIndex } of mergedZone.tiles) {
            const tile = this.board.placedTiles[`${x},${y}`];
            const zone = tile.zones[zoneIndex];

            if (!zone.edges) continue;

            const edges = Array.isArray(zone.edges) ? zone.edges : [zone.edges];
            
            const directions = {
                'north': { dx: 0, dy: -1, opposite: 'south' },
                'east': { dx: 1, dy: 0, opposite: 'west' },
                'south': { dx: 0, dy: 1, opposite: 'north' },
                'west': { dx: -1, dy: 0, opposite: 'east' }
            };

            for (const edge of edges) {
                // ✅ Garder l'edge complet
                const rotatedEdge = this._rotateEdge(edge, tile.rotation);
                
                // Extraire direction principale pour trouver le voisin
                const mainDirection = rotatedEdge.split('-')[0];
                
                const directions = {
                    'north': { dx: 0, dy: -1 },
                    'east': { dx: 1, dy: 0 },
                    'south': { dx: 0, dy: 1 },
                    'west': { dx: -1, dy: 0 }
                };
                
                const dir = directions[mainDirection];
                if (!dir) continue;

                const nx = x + dir.dx;
                const ny = y + dir.dy;
                const neighborTile = this.board.placedTiles[`${nx},${ny}`];

                if (!neighborTile) return false;

                // ✅ Calculer l'opposé de l'edge complet
                const oppositeEdge = this._getOppositeEdge(rotatedEdge);

                const hasMatchingRoad = neighborTile.zones.some(nz => {
                    if (nz.type !== 'road' || !nz.edges) return false;
                    const nEdges = Array.isArray(nz.edges) ? nz.edges : [nz.edges];
                    const rotatedNEdges = nEdges.map(e => this._rotateEdge(e, neighborTile.rotation));
                    return rotatedNEdges.includes(oppositeEdge);
                });

                if (!hasMatchingRoad) return false;
            }
        }

        return true;
    }

    /**
     * Vérifier si une abbaye est complète
     * @private
     */
    _isAbbeyComplete(mergedZone) {
        if (mergedZone.tiles.length === 0) return false;

        const { x, y } = mergedZone.tiles[0];
        const directions = [
            { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
            { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
        ];

        let surroundingTiles = 0;
        directions.forEach(({ dx, dy }) => {
            if (this.board.placedTiles[`${x + dx},${y + dy}`]) {
                surroundingTiles++;
            }
        });

        return surroundingTiles === 8;
    }

    /**
     * Trouver la zone mergée qui contient une position de meeple
     */
    findMergedZoneForPosition(x, y, position) {
        const tile = this.board.placedTiles[`${x},${y}`];
        if (!tile) return null;

        // Trouver quelle zone locale contient cette position
        let targetZoneIndex = null;
        
        tile.zones.forEach((zone, index) => {
            const positions = Array.isArray(zone.meeplePosition) 
                ? zone.meeplePosition 
                : [zone.meeplePosition];
            
            positions.forEach(originalPos => {
                const rotatedPos = this._rotatePosition(originalPos, tile.rotation);
                
                if (rotatedPos === position) {
                    targetZoneIndex = index;
                }
            });
        });

        if (targetZoneIndex === null) return null;

        // Trouver la zone mergée via tileToZone
        const key = `${x},${y},${targetZoneIndex}`;
        const zoneId = this.tileToZone.get(key);
        
        return zoneId ? this.registry.getZone(zoneId) : null;
    }

    /**
     * Obtenir tous les meeples dans une zone mergée
     */
    getZoneMeeples(mergedZone, placedMeeples) {
        const meeples = [];

        mergedZone.tiles.forEach(({ x, y, zoneIndex }) => {
            const tile = this.board.placedTiles[`${x},${y}`];
            const zone = tile.zones[zoneIndex];

            const positions = Array.isArray(zone.meeplePosition) 
                ? zone.meeplePosition 
                : [zone.meeplePosition];

            positions.forEach(pos => {
                const rotatedPos = this._rotatePosition(pos, tile.rotation);
                const key = `${x},${y},${rotatedPos}`;

                if (placedMeeples[key]) {
                    meeples.push({
                        ...placedMeeples[key],
                        x, y, position: rotatedPos, key
                    });
                }
            });
        });

        return meeples;
    }

    /**
     * Rotation de position
     * @private
     */
    _rotatePosition(position, rotation) {
        if (rotation === 0) return position;
        
        const row = Math.floor((position - 1) / 5);
        const col = (position - 1) % 5;
        
        let newRow = row;
        let newCol = col;
        
        const rotations = rotation / 90;
        for (let i = 0; i < rotations; i++) {
            const tempRow = newRow;
            newRow = newCol;
            newCol = 4 - tempRow;
        }
        
        return (newRow * 5) + newCol + 1;
    }

    /**
     * Obtenir toutes les zones mergées (pour scoring)
     */
    getAllZones() {
        return Array.from(this.registry.zones.values());
    }

    /**
     * Obtenir les villes fermées (pour scoring field)
     */
    getClosedCities() {
        return this.registry.getClosedCities();
    }
}
