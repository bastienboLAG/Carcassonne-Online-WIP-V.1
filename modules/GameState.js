/**
 * Gère l'état partagé du jeu entre tous les joueurs
 */
export class GameState {
    constructor() {
        this.players = []; // Liste des joueurs
        this.currentPlayerIndex = 0; // Index du joueur actuel
        this.placedTiles = {}; // Tuiles posées sur le plateau
        this.deck = []; // Pioche (seulement côté hôte)
    }

    /**
     * Ajouter un joueur
     */
    addPlayer(playerId, playerName, color) {
        this.players.push({
            id: playerId,
            name: playerName,
            color: color,
            score: 0,
            meeples: 7 // Nombre de meeples disponibles
        });
    }

    /**
     * Retirer un joueur
     */
    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
    }

    /**
     * Obtenir le joueur actuel
     */
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    /**
     * Passer au joueur suivant
     */
    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    /**
     * Ajouter des points à un joueur
     */
    addScore(playerId, points) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.score += points;
            return true;
        }
        return false;
    }

    /**
     * Obtenir un joueur par son ID
     */
    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    /**
     * Décrémenter le nombre de meeples d'un joueur
     */
    decrementMeeples(playerId) {
        const player = this.getPlayer(playerId);
        if (player && player.meeples > 0) {
            player.meeples--;
            return player.meeples;
        }
        return null;
    }

    /**
     * Incrémenter le nombre de meeples d'un joueur
     */
    incrementMeeples(playerId) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.meeples++;
            return player.meeples;
        }
        return null;
    }

    /**
     * Vérifier si c'est le tour d'un joueur
     */
    isPlayerTurn(playerId) {
        const currentPlayer = this.getCurrentPlayer();
        return currentPlayer && currentPlayer.id === playerId;
    }

    /**
     * Sérialiser l'état pour l'envoyer
     */
    serialize() {
        return {
            players: this.players,
            currentPlayerIndex: this.currentPlayerIndex,
            placedTiles: this.placedTiles
        };
    }

    /**
     * Restaurer l'état depuis des données reçues
     */
    deserialize(data) {
        // Copier les joueurs (objets plain)
        this.players = (data.players || []).map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            score: p.score || 0,
            meeples: p.meeples || 7
        }));
        this.currentPlayerIndex = data.currentPlayerIndex || 0;
        this.placedTiles = data.placedTiles || {};
    }
}
