/**
 * MeepleCursorsUI - Gère l'affichage des curseurs de placement de meeples
 */
export class MeepleCursorsUI {
    constructor(eventBus, gameState, playerId) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.playerId = playerId;
        this.boardElement = null;
        this.currentCursors = null;
        this.isMyTurn = true; // TRUE par défaut
    }

    /**
     * Initialiser
     */
    init() {
        this.boardElement = document.getElementById('board');

        if (!this.boardElement) {
            console.error('❌ MeepleCursorsUI: Element #board introuvable');
            return;
        }

        // Écouter les événements
        this.eventBus.on('meeple-positions-available', this.showCursors.bind(this));
        this.eventBus.on('meeple-placed', this.hideCursors.bind(this));
        this.eventBus.on('turn-ended', this.hideCursors.bind(this));
        this.eventBus.on('turn-started', this.onTurnStarted.bind(this));

        console.log('✅ MeepleCursorsUI initialisé');
    }

    /**
     * Callback tour commencé
     */
    onTurnStarted(data) {
        if (this.playerId) {
            this.isMyTurn = data.player && data.player.id === this.playerId;
        }
    }

    /**
     * Afficher les curseurs de meeple
     */
    showCursors(data) {
        // Ne montrer que si c'est mon tour
        if (!this.isMyTurn) return;

        // Vérifier si le joueur a des meeples
        const player = this.gameState.players.find(p => p.id === this.playerId);
        if (!player || player.meeples <= 0) {
            console.log('❌ Pas de meeples disponibles');
            return;
        }

        const { x, y, tile } = data;

        // Supprimer les anciens curseurs
        this.hideCursors();

        // Créer le conteneur des curseurs
        const cursorsContainer = document.createElement('div');
        cursorsContainer.className = 'meeple-cursors-container';
        cursorsContainer.style.gridColumn = x;
        cursorsContainer.style.gridRow = y;

        // Obtenir les zones de la tuile
        if (!tile.zones) {
            console.warn('⚠️ MeepleCursorsUI: Tuile sans zones');
            return;
        }

        // Obtenir la couleur du joueur
        const playerColor = player.color;

        tile.zones.forEach(zone => {
            if (!zone.meeplePosition) return;

            const position = zone.meeplePosition;

            // Créer le curseur normal
            const normalCursor = this.createCursor(position, 'normal', zone.type, playerColor);
            cursorsContainer.appendChild(normalCursor);

            // Créer le curseur farmer si c'est un champ
            if (zone.type === 'field') {
                const farmerCursor = this.createCursor(position, 'farmer', zone.type, playerColor);
                cursorsContainer.appendChild(farmerCursor);
            }
        });

        this.boardElement.appendChild(cursorsContainer);
        this.currentCursors = cursorsContainer;

        console.log(`🎭 MeepleCursorsUI: Curseurs affichés pour (${x}, ${y})`);
    }

    /**
     * Créer un curseur
     */
    createCursor(position, type, zoneType, color) {
        const cursor = document.createElement('div');
        cursor.className = `meeple-cursor ${type}-cursor`;
        cursor.dataset.position = position;
        cursor.dataset.type = type;

        // Position du curseur (grid 5x5)
        const gridPos = this.getGridPosition(position);
        cursor.style.gridColumn = gridPos.col;
        cursor.style.gridRow = gridPos.row;

        // Image du curseur
        const img = document.createElement('img');
        const colorCap = color.charAt(0).toUpperCase() + color.slice(1);
        
        if (type === 'farmer') {
            img.src = `./assets/Meeples/${colorCap}/Farmer.png`;
        } else {
            img.src = `./assets/Meeples/${colorCap}/Normal.png`;
        }

        img.style.opacity = '0.7';
        cursor.appendChild(img);

        return cursor;
    }

    /**
     * Cacher les curseurs
     */
    hideCursors() {
        document.querySelectorAll('.meeple-cursors-container').forEach(c => c.remove());
        this.currentCursors = null;
    }

    /**
     * Convertir une position (1-25) en position grid
     */
    getGridPosition(position) {
        const pos = parseInt(position);
        const row = Math.ceil(pos / 5);
        const col = ((pos - 1) % 5) + 1;
        return { row, col };
    }
}

