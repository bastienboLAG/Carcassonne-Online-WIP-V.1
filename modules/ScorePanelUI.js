/**
 * ScorePanelUI - Affichage du tableau de scores avec les meeples
 * CODE COPIÉ EXACTEMENT de updateScorePanel() du home.js v2
 */
export class ScorePanelUI {
    constructor() {
        // Pas besoin de paramètres
    }

    /**
     * Mettre à jour l'affichage du tableau de scores
     * CODE COPIÉ de updateScorePanel()
     */
    update(gameState) {
        const playersScoresDiv = document.getElementById('players-scores');
        if (!playersScoresDiv || !gameState) return;
        
        playersScoresDiv.innerHTML = '';
        
        const currentPlayer = gameState.getCurrentPlayer();
        
        gameState.players.forEach(player => {
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
            playersScoresDiv.appendChild(card);
        });
    }
}
