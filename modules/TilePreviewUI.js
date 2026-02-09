/**
 * TilePreviewUI - Gère l'affichage de la tuile en main et du compteur
 * CODE COPIÉ de piocherNouvelleTuile (partie UI) et mettreAJourCompteur
 */
export class TilePreviewUI {
    constructor() {
        this.previewElement = null;
        this.counterElement = null;
    }

    init() {
        this.previewElement = document.getElementById('tile-preview');
        this.counterElement = document.getElementById('tile-counter');
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
     * Mettre à jour le compteur de tuiles - COPIE EXACTE de mettreAJourCompteur()
     */
    updateCounter(remaining, total) {
        if (!this.counterElement) return;
        
        console.log(`📊 Compteur: ${remaining} / ${total}`);
        this.counterElement.textContent = `Tuiles : ${remaining} / ${total}`;
    }

    /**
     * Mettre à jour la rotation visuelle
     */
    updateRotation(rotation) {
        const img = document.getElementById('current-tile-img');
        if (img) {
            img.style.transform = `rotate(${rotation}deg)`;
        }
    }
}
