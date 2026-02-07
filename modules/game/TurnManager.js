/**
 * TurnManager - Gère les tours de jeu
 * Responsable de : pioche, fin de tour, passage au joueur suivant
 */
import { Tile } from '../Tile.js';

export class TurnManager {
    constructor(eventBus, gameState, deck) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.deck = deck;
        this.currentTile = null;
        this.tilePlaced = false;
        this.meeplePlaced = false;
    }

    /**
     * Initialiser les listeners
     */
    init() {
        // Écouter les événements
        this.eventBus.on('tile-placed', this.onTilePlaced.bind(this));
        this.eventBus.on('meeple-placed', this.onMeeplePlaced.bind(this));
        this.eventBus.on('turn-end-requested', this.endTurn.bind(this));
    }

    /**
     * Démarrer le premier tour
     */
    startFirstTurn() {
        console.log('🎲 TurnManager: Premier tour');
        this.drawTile();
    }

    /**
     * Piocher une tuile
     */
    drawTile() {
        if (this.deck.remaining() === 0) {
            console.log('🏁 TurnManager: Plus de tuiles, fin de partie');
            this.eventBus.emit('game-ended', { reason: 'no-more-tiles' });
            return null;
        }

        const tileData = this.deck.draw();
        this.currentTile = new Tile(tileData);
        this.tilePlaced = false;
        this.meeplePlaced = false;

        console.log(`🎲 TurnManager: Tuile piochée ${this.currentTile.id}`);
        
        this.eventBus.emit('tile-drawn', {
            tile: this.currentTile,
            remaining: this.deck.remaining(),
            total: this.deck.total()
        });

        return this.currentTile;
    }

    /**
     * Callback quand une tuile est posée
     */
    onTilePlaced(data) {
        console.log('🎲 TurnManager: Tuile posée détectée');
        this.tilePlaced = true;
        this.currentTile = null;
    }

    /**
     * Callback quand un meeple est posé
     */
    onMeeplePlaced(data) {
        console.log('🎲 TurnManager: Meeple posé détecté');
        this.meeplePlaced = true;
    }

    /**
     * Terminer le tour
     */
    endTurn() {
        // Vérifier qu'une tuile a été posée
        if (!this.tilePlaced) {
            console.warn('⚠️ TurnManager: Impossible de terminer le tour sans poser de tuile');
            this.eventBus.emit('turn-end-failed', { reason: 'no-tile-placed' });
            return false;
        }

        console.log('🎲 TurnManager: Fin du tour');

        // Passer au joueur suivant
        this.gameState.nextPlayer();
        const nextPlayer = this.gameState.getCurrentPlayer();

        this.eventBus.emit('turn-ended', {
            previousPlayer: this.gameState.players[this.gameState.currentPlayerIndex - 1] || this.gameState.players[this.gameState.players.length - 1],
            nextPlayer: nextPlayer,
            nextPlayerIndex: this.gameState.currentPlayerIndex
        });

        // Démarrer le nouveau tour
        this.eventBus.emit('turn-started', {
            player: nextPlayer,
            playerIndex: this.gameState.currentPlayerIndex
        });

        // Piocher la prochaine tuile
        this.drawTile();

        return true;
    }

    /**
     * Obtenir la tuile en main
     */
    getCurrentTile() {
        return this.currentTile;
    }

    /**
     * Vérifier si une tuile a été posée ce tour
     */
    isTilePlaced() {
        return this.tilePlaced;
    }

    /**
     * Vérifier si un meeple a été posé ce tour
     */
    isMeeplePlaced() {
        return this.meeplePlaced;
    }
}
