/**
 * ScorePanelUI - Gère l'affichage du panneau de scores
 */
export class ScorePanelUI {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.container = null;
    }

    /**
     * Initialiser le panneau
     */
    init() {
        this.container = document.getElementById('players-scores');
        
        if (!this.container) {
            console.error('❌ ScorePanelUI: Element #players-scores introuvable');
            return;
        }

        // Écouter les événements
        this.eventBus.on('turn-started', this.update.bind(this));
        this.eventBus.on('score-calculated', this.update.bind(this));
        this.eventBus.on('meeple-count-updated', this.update.bind(this));
        this.eventBus.on('meeple-returned', this.update.bind(this));
        this.eventBus.on('game-started', this.update.bind(this));

        console.log('✅ ScorePanelUI initialisé');
    }

    /**
     * Mettre à jour l'affichage
     */
    update(data) {
        if (!this.container) return;

        const gameState = data.gameState || (data.player && data.player.gameState);
        
        if (!gameState || !gameState.players) {
            console.warn('⚠️ ScorePanelUI: Pas de gameState disponible');
            return;
        }

        this.render(gameState);
    }

    /**
     * Afficher le panneau
     */
    render(gameState) {
        if (!this.container) return;

        this.container.innerHTML = '';

        const currentPlayer = gameState.getCurrentPlayer();

        gameState.players.forEach(player => {
            const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;

            // Créer la carte du joueur
            const card = document.createElement('div');
            card.className = 'player-score-card';
            if (isCurrentPlayer) {
                card.classList.add('active');
            }

            // Header avec nom et score
            const header = document.createElement('div');
            header.className = 'player-score-header';

            if (isCurrentPlayer) {
                const indicator = document.createElement('span');
                indicator.className = 'turn-indicator';
                indicator.textContent = '▶';
                header.appendChild(indicator);
            }

            const name = document.createElement('span');
            name.className = 'player-score-name';
            name.textContent = player.name;
            header.appendChild(name);

            const points = document.createElement('span');
            points.className = 'player-score-points';
            points.textContent = `${player.score} point${player.score > 1 ? 's' : ''}`;
            header.appendChild(points);

            card.appendChild(header);

            // Affichage des meeples disponibles
            const meeplesDisplay = document.createElement('div');
            meeplesDisplay.className = 'player-meeples-display';

            const colorCapitalized = player.color.charAt(0).toUpperCase() + player.color.slice(1);

            for (let i = 0; i < 7; i++) {
                const meeple = document.createElement('img');
                meeple.src = `./assets/Meeples/${colorCapitalized}/Normal.png`;
                meeple.alt = 'Meeple';

                if (i >= player.meeples) {
                    meeple.classList.add('unavailable');
                }

                meeplesDisplay.appendChild(meeple);
            }

            card.appendChild(meeplesDisplay);
            this.container.appendChild(card);
        });
    }

    /**
     * Mettre à jour manuellement avec un gameState
     */
    updateWithGameState(gameState) {
        this.render(gameState);
    }
}
