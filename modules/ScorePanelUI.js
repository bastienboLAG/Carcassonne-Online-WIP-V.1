/**
 * ScorePanelUI - Affichage du tableau de scores avec les meeples
 * CONNECTÉ À EVENTBUS
 */
export class ScorePanelUI {
    constructor(eventBus, gameState) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        
        // S'abonner aux événements
        this.eventBus.on('score-updated', this.onScoreUpdated.bind(this));
        this.eventBus.on('turn-changed', this.onTurnChanged.bind(this));
        this.eventBus.on('meeple-count-updated', this.onMeepleCountUpdated.bind(this));
    }

    /**
     * Quand le score est mis à jour
     */
    onScoreUpdated(data) {
        this.update();
    }

    /**
     * Quand le tour change
     */
    onTurnChanged(data) {
        this.update();
    }

    /**
     * Quand le compteur de meeples change
     */
    onMeepleCountUpdated(data) {
        this.update();
    }

    /**
     * Mettre à jour l'affichage du tableau de scores
     */
    update() {
        const playersScoresDiv = document.getElementById('players-scores');
        if (!playersScoresDiv || !this.gameState) return;
        
        playersScoresDiv.innerHTML = '';
        
        const currentPlayer = this.gameState.getCurrentPlayer();
        
        this.gameState.players.forEach(player => {
            const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;
            
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
            name.textContent = player.name + (player.isHost ? ' 👑' : '');
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
            playersScoresDiv.appendChild(card);
        });
    }
}
