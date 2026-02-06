export class Board {
    constructor() { 
        this.placedTiles = {}; 
    }

    addTile(x, y, tile) { 
        this.placedTiles[`${x},${y}`] = tile; 
    }

    isFree(x, y) { 
        return !this.placedTiles[`${x},${y}`]; 
    }

    /**
     * Vérifie si une tuile peut être placée à une position donnée
     * @param {number} x - Coordonnée X
     * @param {number} y - Coordonnée Y
     * @param {Tile} newTile - La tuile à placer
     * @returns {boolean} - true si le placement est valide
     */
    canPlaceTile(x, y, newTile) {
        // Définition des voisins et des positions à vérifier pour chaque bord
        const neighbors = [
            {
                // Voisin du haut (y-1)
                nx: x, 
                ny: y - 1,
                checks: [
                    { newEdge: 'north-left', neighborEdge: 'south-left' },
                    { newEdge: 'north', neighborEdge: 'south' },
                    { newEdge: 'north-right', neighborEdge: 'south-right' }
                ]
            },
            {
                // Voisin de droite (x+1)
                nx: x + 1, 
                ny: y,
                checks: [
                    { newEdge: 'east-top', neighborEdge: 'west-top' },
                    { newEdge: 'east', neighborEdge: 'west' },
                    { newEdge: 'east-bottom', neighborEdge: 'west-bottom' }
                ]
            },
            {
                // Voisin du bas (y+1)
                nx: x, 
                ny: y + 1,
                checks: [
                    { newEdge: 'south-left', neighborEdge: 'north-left' },
                    { newEdge: 'south', neighborEdge: 'north' },
                    { newEdge: 'south-right', neighborEdge: 'north-right' }
                ]
            },
            {
                // Voisin de gauche (x-1)
                nx: x - 1, 
                ny: y,
                checks: [
                    { newEdge: 'west-top', neighborEdge: 'east-top' },
                    { newEdge: 'west', neighborEdge: 'east' },
                    { newEdge: 'west-bottom', neighborEdge: 'east-bottom' }
                ]
            }
        ];

        let hasNeighbor = false;

        // Vérifier chaque voisin
        for (const neighbor of neighbors) {
            const targetTile = this.placedTiles[`${neighbor.nx},${neighbor.ny}`];
            
            if (targetTile) {
                hasNeighbor = true;

                // Vérifier les 3 positions du bord
                for (const check of neighbor.checks) {
                    const newType = newTile.getEdgeType(check.newEdge);
                    const neighborType = targetTile.getEdgeType(check.neighborEdge);

                    // Si les types ne correspondent pas, placement invalide
                    if (newType !== neighborType) {
                        return false;
                    }
                }
            }
        }

        // La tuile doit avoir au moins un voisin
        return hasNeighbor;
    }
}
