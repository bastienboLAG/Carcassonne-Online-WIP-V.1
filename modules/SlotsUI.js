/**
 * SlotsUI - Gère l'affichage des slots de placement
 * CODE COPIÉ de creerSlotCentral, rafraichirTousLesSlots, genererSlotsAutour
 */
export class SlotsUI {
    constructor(plateau, gameSync) {
        this.plateau = plateau;
        this.gameSync = gameSync;
        this.boardElement = null;
    }

    init() {
        this.boardElement = document.getElementById('board');
    }

    /**
     * Créer le slot central - COPIE EXACTE de creerSlotCentral()
     */
    createCentralSlot(isMyTurn, firstTilePlaced, tuileEnMain, onSlotClick) {
        console.log('🎯 Création du slot central...');
        const board = this.boardElement;
        console.log('📋 Board element:', board);
        
        const slot = document.createElement('div');
        slot.className = "slot slot-central";
        slot.style.gridColumn = 50;
        slot.style.gridRow = 50;
        
        // ✅ Appliquer le style readonly si ce n'est pas notre tour
        if (!isMyTurn && this.gameSync) {
            slot.classList.add('slot-readonly');
            slot.style.cursor = 'default';
            console.log('🔒 Slot central readonly (pas notre tour)');
        } else {
            slot.onclick = () => {
                if (tuileEnMain && !firstTilePlaced) {
                    console.log('✅ Clic sur slot central - pose de la tuile');
                    onSlotClick(50, 50, tuileEnMain, true);
                }
            };
            console.log('✅ Slot central cliquable (notre tour)');
        }
        
        board.appendChild(slot);
        console.log('✅ Slot central ajouté au board');
    }

    /**
     * Rafraîchir tous les slots - COPIE EXACTE de rafraichirTousLesSlots()
     */
    refreshAllSlots(firstTilePlaced, tuileEnMain, isMyTurn, onSlotClick) {
        if (firstTilePlaced) {
            document.querySelectorAll('.slot:not(.slot-central)').forEach(s => s.remove());
        }
        
        if (!tuileEnMain) return;
        
        for (let coord in this.plateau.placedTiles) {
            const [x, y] = coord.split(',').map(Number);
            this.generateSlotsAround(x, y, tuileEnMain, isMyTurn, onSlotClick);
        }
    }

    /**
     * Générer les slots autour d'une position - COPIE EXACTE de genererSlotsAutour()
     */
    generateSlotsAround(x, y, tuileEnMain, isMyTurn, onSlotClick) {
        const directions = [{dx:0, dy:-1}, {dx:1, dy:0}, {dx:0, dy:1}, {dx:-1, dy:0}];
        directions.forEach(dir => {
            const nx = x + dir.dx, ny = y + dir.dy;
            if (tuileEnMain && this.plateau.isFree(nx, ny) && this.plateau.canPlaceTile(nx, ny, tuileEnMain)) {
                const slot = document.createElement('div');
                slot.className = "slot";
                slot.style.gridColumn = nx;
                slot.style.gridRow = ny;
                
                // ✅ Si ce n'est pas notre tour : même apparence mais sans onclick et sans hover gold
                if (!isMyTurn && this.gameSync) {
                    slot.classList.add('slot-readonly');
                    slot.style.cursor = 'default';
                } else {
                    // ✅ Seulement le joueur actif a un onclick
                    slot.onclick = () => {
                        onSlotClick(nx, ny, tuileEnMain, false);
                    };
                }
                
                this.boardElement.appendChild(slot);
            }
        });
    }
}
