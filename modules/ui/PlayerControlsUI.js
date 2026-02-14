/**
 * PlayerControlsUI - Gère les contrôles du joueur
 * Responsabilités :
 * - Rotation de la tuile en main (clic sur aperçu)
 * - Bouton "Fin de tour"
 * - Activation/désactivation selon isMyTurn
 */
export class PlayerControlsUI {
    constructor(eventBus, gameSync) {
        this.eventBus = eventBus;
        this.gameSync = gameSync;
        
        // État
        this.isMyTurn = false;
        this.currentTile = null;
        this.tilePlaced = false;
        
        // Éléments DOM
        this.tilePreviewEl = null;
        this.tileImgEl = null;
        this.endTurnBtn = null;
    }

    /**
     * Initialiser les contrôles
     */
    init() {
        // Récupérer les éléments DOM
        this.tilePreviewEl = document.getElementById('tile-preview');
        this.endTurnBtn = document.getElementById('end-turn-btn');
        
        if (!this.tilePreviewEl || !this.endTurnBtn) {
            console.error('❌ PlayerControlsUI: Éléments DOM manquants');
            return;
        }
        
        // Setup rotation (clic sur aperçu)
        this.setupTileRotation();
        
        // Setup bouton fin de tour
        this.setupEndTurnButton();
        
        // Écouter les événements
        this.eventBus.on('turn-changed', (data) => this.onTurnChanged(data));
        this.eventBus.on('tile-drawn', (data) => this.onTileDrawn(data));
        this.eventBus.on('tile-placed', () => this.onTilePlaced());
        
        console.log('✅ PlayerControlsUI initialisé');
    }

    /**
     * Setup rotation de la tuile par clic
     */
    setupTileRotation() {
        this.tilePreviewEl.addEventListener('click', () => {
            if (!this.isMyTurn) {
                console.log('⚠️ Pas votre tour !');
                return;
            }
            
            if (!this.currentTile || this.tilePlaced) {
                return;
            }
            
            this.rotateTile();
        });
    }

    /**
     * Rotation de la tuile
     */
    rotateTile() {
        this.tileImgEl = document.getElementById('current-tile-img');
        if (!this.tileImgEl) return;
        
        // Mettre à jour la rotation de la tuile
        this.currentTile.rotation = (this.currentTile.rotation + 90) % 360;
        
        // Animation visuelle (rotation continue sans reset)
        const currentTransform = this.tileImgEl.style.transform;
        const currentDeg = parseInt(currentTransform.match(/rotate\((\d+)deg\)/)?.[1] || '0');
        const newDeg = currentDeg + 90;
        this.tileImgEl.style.transform = `rotate(${newDeg}deg)`;
        
        // Synchroniser avec les autres joueurs
        if (this.gameSync) {
            this.gameSync.syncTileRotation(this.currentTile.rotation);
        }
        
        // Émettre événement pour rafraîchir les slots
        this.eventBus.emit('tile-rotated', { 
            rotation: this.currentTile.rotation 
        });
    }

    /**
     * Setup bouton fin de tour
     */
    setupEndTurnButton() {
        this.endTurnBtn.onclick = () => {
            if (!this.isMyTurn) {
                console.log('⚠️ Ce n\'est pas votre tour');
                return;
            }
            
            if (!this.tilePlaced) {
                alert('Vous devez poser la tuile avant de terminer votre tour !');
                return;
            }
            
            // Émettre événement pour que home.js gère la fin de tour
            this.eventBus.emit('end-turn-requested');
        };
    }

    /**
     * Quand le tour change
     */
    onTurnChanged(data) {
        this.isMyTurn = data.isMyTurn;
        this.updateButtonStates();
    }

    /**
     * Quand une tuile est piochée
     */
    onTileDrawn(data) {
        if (data.tileData) {
            // Importer Tile si nécessaire
            import('../Tile.js').then(module => {
                this.currentTile = new module.Tile(data.tileData);
            });
        }
        this.tilePlaced = false;
        this.updateButtonStates();
    }

    /**
     * Quand une tuile est placée
     */
    onTilePlaced() {
        this.tilePlaced = true;
        this.updateButtonStates();
    }

    /**
     * Mettre à jour l'état des boutons
     */
    updateButtonStates() {
        if (!this.endTurnBtn) return;
        
        // Bouton fin de tour : actif uniquement si c'est notre tour ET tuile posée
        this.endTurnBtn.disabled = !this.isMyTurn || !this.tilePlaced;
        
        // Visuel du bouton
        if (this.isMyTurn && this.tilePlaced) {
            this.endTurnBtn.style.opacity = '1';
            this.endTurnBtn.style.cursor = 'pointer';
        } else {
            this.endTurnBtn.style.opacity = '0.5';
            this.endTurnBtn.style.cursor = 'not-allowed';
        }
    }

    /**
     * Afficher un message dans l'aperçu de tuile
     */
    showMessage(msg) {
        if (this.tilePreviewEl) {
            this.tilePreviewEl.innerHTML = `<p style="text-align: center; color: white;">${msg}</p>`;
        }
    }

    /**
     * Réinitialiser pour une nouvelle partie
     */
    reset() {
        this.isMyTurn = false;
        this.currentTile = null;
        this.tilePlaced = false;
        this.updateButtonStates();
    }
}
