/**
 * TilePreviewUI - Gère l'affichage de la tuile en main et du compteur
 * CONNECTÉ À EVENTBUS
 */
export class TilePreviewUI {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.previewElement = null;
        this.counterElement = null;
        
        // S'abonner aux événements
        this.eventBus.on('tile-drawn', (data) => this.onTileDrawn(data));
        // Note: tile-rotated n'est PAS écouté car la rotation est gérée directement dans home.js
        this.eventBus.on('tile-placed', () => this.showBackside());
        this.eventBus.on('deck-updated', (data) => this.updateCounter(data.remaining, data.total));
    }

    init() {
        this.previewElement = document.getElementById('tile-preview');
        this.counterElement = document.getElementById('tile-counter');
    }

    /**
     * Quand une tuile est piochée
     */
    onTileDrawn(data) {
        console.log('🎴 TilePreviewUI: onTileDrawn appelé', data);
        if (!this.previewElement) {
            console.error('❌ previewElement est null');
            return;
        }
        // TurnManager envoie tileData, mais home.js crée tuileEnMain
        // On attend que tuileEnMain soit créé par le listener dans home.js
        // Pour l'instant on ne fait rien ici, showTile sera appelé directement
    }

    /**
     * Afficher une tuile dans la preview
     */
    showTile(tuileEnMain) {
        if (!this.previewElement) return;
        
        this.previewElement.innerHTML = `<img id="current-tile-img" src="${tuileEnMain.imagePath}" style="cursor: pointer; transform: rotate(${tuileEnMain.rotation}deg);" title="Cliquez pour tourner">`;
    }

    /**
     * Afficher le verso (après placement)
     */
    showBackside() {
        if (!this.previewElement) return;
        
        this.previewElement.innerHTML = '<img src="./assets/verso.png" style="width: 120px; border: 2px solid #666;">';
    }

    /**
     * Afficher un message
     */
    showMessage(msg) {
        if (!this.previewElement) return;
        
        this.previewElement.innerHTML = `<p style="text-align: center; color: white;">${msg}</p>`;
    }

    /**
     * Mettre à jour le compteur de tuiles
     */
    updateCounter(remaining, total) {
        if (!this.counterElement) return;
        
        console.log(`📊 Compteur: ${remaining} / ${total}`);
        this.counterElement.textContent = `Tuiles : ${remaining} / ${total}`;
    }

}
