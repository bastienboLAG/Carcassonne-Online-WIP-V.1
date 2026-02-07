/**
 * TilePreviewUI - Gère l'affichage de la tuile en main
 */
export class TilePreviewUI {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.previewContainer = null;
        this.counterElement = null;
        this.currentTile = null;
    }

    /**
     * Initialiser
     */
    init() {
        this.previewContainer = document.getElementById('tile-preview');
        this.counterElement = document.getElementById('tile-counter');

        if (!this.previewContainer) {
            console.error('❌ TilePreviewUI: Element #tile-preview introuvable');
            return;
        }

        // Écouter les événements
        this.eventBus.on('tile-drawn', this.onTileDrawn.bind(this));
        this.eventBus.on('tile-rotated', this.onTileRotated.bind(this));
        this.eventBus.on('tile-placed', this.onTilePlaced.bind(this));

        console.log('✅ TilePreviewUI initialisé');
    }

    /**
     * Afficher une tuile piochée
     */
    onTileDrawn(data) {
        this.currentTile = data.tile;
        this.showTile(data.tile);
        this.updateCounter(data.remaining, data.total);
    }

    /**
     * Mettre à jour la rotation
     */
    onTileRotated(data) {
        if (this.currentTile) {
            this.currentTile.rotation = data.rotation;
            const img = this.previewContainer.querySelector('img');
            if (img) {
                img.style.transform = `rotate(${data.rotation}deg)`;
            }
        }
    }

    /**
     * Quand la tuile est posée
     */
    onTilePlaced(data) {
        this.currentTile = null;
        this.showCardBack();
    }

    /**
     * Afficher une tuile
     */
    showTile(tile) {
        if (!this.previewContainer) return;

        this.previewContainer.innerHTML = `
            <img 
                id="current-tile-img" 
                src="${tile.imagePath}" 
                style="width: 120px; border: 2px solid gold; transform: rotate(${tile.rotation}deg);"
                alt="Tuile en main"
            >
        `;
    }

    /**
     * Afficher le dos de carte
     */
    showCardBack() {
        if (!this.previewContainer) return;

        this.previewContainer.innerHTML = `
            <img 
                src="./assets/verso.png" 
                style="width: 120px; border: 2px solid #666;"
                alt="Dos de carte"
            >
        `;
    }

    /**
     * Mettre à jour le compteur de tuiles
     */
    updateCounter(remaining, total) {
        if (!this.counterElement) return;

        this.counterElement.textContent = `Tuiles : ${remaining} / ${total}`;
    }

    /**
     * Afficher un message
     */
    showMessage(message) {
        if (!this.previewContainer) return;

        this.previewContainer.innerHTML = `
            <p style="text-align: center; color: white;">${message}</p>
        `;
    }
}
