/**
 * ModalUI - Gère l'affichage des modals (tuiles restantes, règles, etc.)
 */
export class ModalUI {
    constructor() {
        this.modalContainer = null;
        this.init();
    }

    /**
     * Initialiser le conteneur de modal
     */
    init() {
        // Créer le conteneur si il n'existe pas
        if (!document.getElementById('modal-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'modal-overlay';
            overlay.style.cssText = `
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 1000;
                justify-content: center;
                align-items: center;
            `;
            
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.hide();
                }
            };
            
            document.body.appendChild(overlay);
            this.modalContainer = overlay;
        } else {
            this.modalContainer = document.getElementById('modal-overlay');
        }
    }

    /**
     * Afficher une modal avec les tuiles restantes
     */
    showRemainingTiles(tiles, totalRemaining) {
        const modal = document.createElement('div');
        modal.className = 'modal-content';
        modal.style.cssText = `
            background: #2a2a2a;
            border-radius: 10px;
            padding: 30px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        `;
        
        // Titre
        const title = document.createElement('h2');
        title.textContent = `🎴 Tuiles restantes : ${totalRemaining}`;
        title.style.cssText = `
            color: white;
            margin: 0 0 20px 0;
            text-align: center;
        `;
        modal.appendChild(title);
        
        // Grille de tuiles
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        `;
        
        tiles.forEach(tile => {
            const tileCard = document.createElement('div');
            tileCard.style.cssText = `
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 8px;
                background: #3a3a3a;
                border-radius: 8px;
                transition: transform 0.2s;
            `;
            
            tileCard.onmouseenter = () => {
                tileCard.style.transform = 'scale(1.05)';
            };
            
            tileCard.onmouseleave = () => {
                tileCard.style.transform = 'scale(1)';
            };
            
            // Image
            const img = document.createElement('img');
            img.src = tile.imagePath;
            img.style.cssText = `
                width: 100px;
                height: 100px;
                object-fit: contain;
                margin-bottom: 5px;
            `;
            tileCard.appendChild(img);
            
            // Badge quantité (en bas à droite)
            const badge = document.createElement('div');
            badge.textContent = tile.count;
            badge.style.cssText = `
                position: absolute;
                bottom: 8px;
                right: 8px;
                background: linear-gradient(135deg, #d4af37, #f4d03f);
                color: #1a1a1a;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
                box-shadow: 0 2px 8px rgba(212, 175, 55, 0.4);
            `;
            tileCard.appendChild(badge);
            
            grid.appendChild(tileCard);
        });
        
        modal.appendChild(grid);
        
        // Bouton fermer
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Fermer';
        closeBtn.style.cssText = `
            display: block;
            margin: 0 auto;
            padding: 10px 30px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        `;
        closeBtn.onclick = () => this.hide();
        modal.appendChild(closeBtn);
        
        this.show(modal);
    }

    /**
     * Afficher la modal
     */
    show(content) {
        this.modalContainer.innerHTML = '';
        this.modalContainer.appendChild(content);
        this.modalContainer.style.display = 'flex';
    }

    /**
     * Masquer la modal
     */
    hide() {
        this.modalContainer.style.display = 'none';
        this.modalContainer.innerHTML = '';
    }
}
