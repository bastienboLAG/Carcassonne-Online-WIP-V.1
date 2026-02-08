/**
 * ButtonsUI - Gère les boutons de l'interface de jeu
 */
export class ButtonsUI {
    constructor(eventBus, scoring, meeplePlacement, deck, gameState) {
        this.eventBus = eventBus;
        this.scoring = scoring;
        this.meeplePlacement = meeplePlacement;
        this.deck = deck;
        this.gameState = gameState;
        this.isMyTurn = true; // TRUE par défaut
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
        this.setupEndTurnButton();
        this.setupInfoButtons();

        // Écouter événements
        this.eventBus.on('turn-started', this.updateButtonStates.bind(this));
        this.eventBus.on('tile-drawn', this.updateButtonStates.bind(this));

        console.log('✅ ButtonsUI initialisé');
    }

    /**
     * Configurer le bouton de fin de tour
     */
    setupEndTurnButton() {
        const btn = document.getElementById('end-turn-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            if (!this.isMyTurn) return;

            // Vérifier si c'est la fin de partie
            if (this.deck.remaining() === 0) {
                this.calculateFinalScores();
            } else {
                this.endTurn();
            }
        });
    }

    /**
     * Configurer les boutons d'info
     */
    setupInfoButtons() {
        // Bouton tuiles restantes
        const remainingBtn = document.querySelector('[data-action="show-remaining"]');
        if (remainingBtn) {
            remainingBtn.addEventListener('click', () => {
                alert(`Tuiles restantes : ${this.deck.remaining()} / ${this.deck.total()}`);
            });
        }
    }

    /**
     * Terminer le tour
     */
    endTurn() {
        // Calculer scores zones fermées
        const { scoringResults, meeplesToReturn } = this.scoring.scoreClosedZones(
            this.meeplePlacement.getPlacedMeeples()
        );

        // Appliquer scores
        scoringResults.forEach(({ playerId, points }) => {
            const player = this.gameState.players.find(p => p.id === playerId);
            if (player) player.score += points;
        });

        // Émettre événement de fin de tour
        this.eventBus.emit('turn-end-requested');
    }

    /**
     * Calculer les scores finaux
     */
    calculateFinalScores() {
        console.log('🏁 Calcul des scores finaux...');

        const finalResults = this.scoring.calculateFinalScores(
            this.meeplePlacement.getPlacedMeeples(),
            this.gameState
        );

        // Appliquer scores finaux
        finalResults.forEach(({ playerId, points }) => {
            const player = this.gameState.players.find(p => p.id === playerId);
            if (player) player.score += points;
        });

        // Émettre événement de fin de partie
        this.eventBus.emit('game-ended', {
            gameState: this.gameState,
            reason: 'all-tiles-placed'
        });

        // Afficher les résultats
        this.showFinalScores();
    }

    /**
     * Afficher les scores finaux
     */
    showFinalScores() {
        const sorted = [...this.gameState.players].sort((a, b) => b.score - a.score);
        
        let message = '🏆 SCORES FINAUX 🏆\n\n';
        sorted.forEach((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            message += `${medal} ${player.name}: ${player.score} points\n`;
        });

        alert(message);
    }

    /**
     * Mettre à jour l'état des boutons
     */
    updateButtonStates(data) {
        if (data.player && this.playerId) {
            this.isMyTurn = data.player.id === this.playerId;
        }

        const endTurnBtn = document.getElementById('end-turn-btn');
        if (!endTurnBtn) return;

        // Activer/désactiver
        endTurnBtn.disabled = !this.isMyTurn;
        endTurnBtn.style.opacity = this.isMyTurn ? '1' : '0.5';
        endTurnBtn.style.cursor = this.isMyTurn ? 'pointer' : 'not-allowed';

        // Changer texte si fin de partie
        if (this.deck.remaining() === 0) {
            endTurnBtn.textContent = 'Calculer le score final';
            endTurnBtn.classList.add('final-score-btn');
        } else {
            endTurnBtn.textContent = 'Terminer mon tour';
            endTurnBtn.classList.remove('final-score-btn');
        }
    }
}
