/**
 * ScorePanelUI - Affichage des scores et du joueur actif
 * CODE COPIÉ de l'ancien home.js (updateTurnDisplay)
 */
export class ScorePanelUI {
    constructor(multiplayer) {
        this.multiplayer = multiplayer;
        this.colorImages = {
            'black': './assets/Meeples/Black/Normal.png',
            'red': './assets/Meeples/Red/Normal.png',
            'pink': './assets/Meeples/Pink/Normal.png',
            'green': './assets/Meeples/Green/Normal.png',
            'blue': './assets/Meeples/Blue/Normal.png',
            'yellow': './assets/Meeples/Yellow/Normal.png'
        };
    }

    /**
     * Mettre à jour l'affichage - COPIE EXACTE de updateTurnDisplay()
     * RETOURNE isMyTurn pour que home.js puisse l'utiliser
     */
    update(gameState) {
        // Calculer isMyTurn
        let isMyTurn = true;
        
        if (!gameState || gameState.players.length === 0) {
            return isMyTurn;
        }
        
        const currentPlayer = gameState.getCurrentPlayer();
        isMyTurn = currentPlayer.id === this.multiplayer.playerId;
        
        // Créer ou récupérer le conteneur de la liste des joueurs
        let playersDisplay = document.getElementById('players-display');
        if (!playersDisplay) {
            playersDisplay = document.createElement('div');
            playersDisplay.id = 'players-display';
            playersDisplay.style.cssText = 'padding: 10px; background: rgba(0,0,0,0.3); border-radius: 5px; margin: 10px 0; width: 100%;';
            document.getElementById('game-ui').insertBefore(playersDisplay, document.getElementById('current-tile-container'));
        }
        
        // Construire la liste HTML
        let html = '<div style="font-size: 14px;">';
        
        gameState.players.forEach((player, index) => {
            const isActive = index === gameState.currentPlayerIndex;
            const meepleImg = this.colorImages[player.color];
            const indicator = isActive ? '▶' : '';
            const bgColor = isActive ? 'rgba(46, 204, 113, 0.2)' : 'transparent';
            
            html += `
                <div style="display: flex; align-items: center; gap: 8px; padding: 5px; margin: 3px 0; background: ${bgColor}; border-radius: 3px;">
                    <span style="color: #2ecc71; font-weight: bold; width: 15px;">${indicator}</span>
                    <img src="${meepleImg}" style="width: 24px; height: 24px;">
                    <span style="flex: 1; color: ${isActive ? '#2ecc71' : '#ecf0f1'}; font-weight: ${isActive ? 'bold' : 'normal'};">${player.name} (${player.score || 0} pts)</span>
                </div>
            `;
        });
        
        html += '</div>';
        playersDisplay.innerHTML = html;
        
        return isMyTurn;
    }
}
