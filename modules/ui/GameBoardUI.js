/**
 * GameBoardUI - Gère l'affichage et les interactions du plateau
 */
export class GameBoardUI {
    constructor(eventBus, gameState) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.boardElement = null;
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
        this.boardElement = document.getElementById('board');
        
        if (!this.boardElement) {
            console.error('❌ GameBoardUI: Element #board introuvable');
            return;
        }

        // En solo ou si pas de playerId, toujours actif
        if (!this.playerId) {
            this.isMyTurn = true;
        }

        // Écouter les événements
        this.eventBus.on('tile-placed', this.onTilePlaced.bind(this));
        this.eventBus.on('valid-slots-updated', this.updateSlots.bind(this));
        this.eventBus.on('meeple-placed', this.onMeeplePlaced.bind(this));
        this.eventBus.on('meeple-returned', this.onMeepleReturned.bind(this));
        this.eventBus.on('turn-started', this.onTurnStarted.bind(this));

        // Gérer les clics
        this.setupClickHandlers();

        console.log('✅ GameBoardUI initialisé');
    }

    /**
     * Configurer les gestionnaires de clics
     */
    setupClickHandlers() {
        this.boardElement.addEventListener('click', (e) => {
            if (!this.isMyTurn) return;

            const target = e.target;

            // Clic sur slot
            if (target.classList.contains('slot')) {
                const x = parseInt(target.dataset.x);
                const y = parseInt(target.dataset.y);
                this.eventBus.emit('slot-clicked', { x, y });
            }

            // Clic sur curseur meeple
            const cursor = target.closest('.meeple-cursor');
            if (cursor) {
                const container = cursor.closest('.meeple-cursors-container');
                const x = parseInt(container.style.gridColumn);
                const y = parseInt(container.style.gridRow);
                const position = cursor.dataset.position;
                const type = cursor.dataset.type;

                this.eventBus.emit('meeple-cursor-clicked', {
                    x, y, position, type,
                    playerId: this.playerId
                });
            }
        });
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
     * Afficher une tuile
     */
    onTilePlaced(data) {
        const { x, y, tile } = data;

        const img = document.createElement('img');
        img.src = tile.imagePath;
        img.className = 'tile';
        img.style.gridColumn = x;
        img.style.gridRow = y;
        img.style.transform = `rotate(${tile.rotation}deg)`;
        
        this.boardElement.appendChild(img);
        console.log(`🎨 GameBoardUI: Tuile affichée en (${x}, ${y})`);
    }

    /**
     * Mettre à jour les slots
     */
    updateSlots(data) {
        document.querySelectorAll('.slot').forEach(slot => slot.remove());

        data.slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = 'slot';
            slotElement.style.gridColumn = slot.x;
            slotElement.style.gridRow = slot.y;
            slotElement.dataset.x = slot.x;
            slotElement.dataset.y = slot.y;
            this.boardElement.appendChild(slotElement);
        });

        console.log(`🎨 GameBoardUI: ${data.slots.length} slots`);
    }

    /**
     * Afficher un meeple
     */
    onMeeplePlaced(data) {
        const { x, y, position, meepleType, playerId } = data;

        let container = document.querySelector(`.meeple-container[data-pos="${x},${y}"]`);
        if (!container) {
            container = document.createElement('div');
            container.className = 'meeple-container';
            container.dataset.pos = `${x},${y}`;
            container.style.gridColumn = x;
            container.style.gridRow = y;
            this.boardElement.appendChild(container);
        }

        const meeple = document.createElement('div');
        meeple.className = 'meeple';
        meeple.dataset.key = `${x},${y},${position}`;

        const gridPos = this.getGridPosition(position);
        meeple.style.gridColumn = gridPos.col;
        meeple.style.gridRow = gridPos.row;

        const img = document.createElement('img');
        const color = this.getPlayerColor(playerId);
        const colorCap = color.charAt(0).toUpperCase() + color.slice(1);
        
        if (meepleType === 'farmer') {
            img.src = `./assets/Meeples/${colorCap}/Farmer.png`;
        } else {
            img.src = `./assets/Meeples/${colorCap}/Normal.png`;
        }

        meeple.appendChild(img);
        container.appendChild(meeple);
    }

    /**
     * Retirer un meeple
     */
    onMeepleReturned(data) {
        const meeple = document.querySelector(`.meeple[data-key="${data.key}"]`);
        if (meeple) meeple.remove();
    }

    /**
     * Convertir position en grid
     */
    getGridPosition(position) {
        const pos = parseInt(position);
        const row = Math.ceil(pos / 5);
        const col = ((pos - 1) % 5) + 1;
        return { row, col };
    }

    /**
     * Obtenir couleur joueur
     */
    getPlayerColor(playerId) {
        if (!this.gameState) return 'blue';
        const player = this.gameState.players.find(p => p.id === playerId);
        return player ? player.color : 'blue';
    }

    /**
     * Nettoyer
     */
    clear() {
        if (this.boardElement) {
            this.boardElement.innerHTML = '';
        }
    }
}
