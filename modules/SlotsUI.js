/**
 * SlotsUI - Gère l'affichage des slots de placement
 * CONNECTÉ À EVENTBUS
 */
export class SlotsUI {
    constructor(plateau, gameSync, eventBus, getTileEnMain) {
        this.plateau = plateau;
        this.gameSync = gameSync;
        this.eventBus = eventBus;
        this.boardElement = null;
        this.getTileEnMain = getTileEnMain; // Fonction pour obtenir tuileEnMain
        
        // État local
        this.isMyTurn = false;
        this.firstTilePlaced = false;
        this.onSlotClick = null;
        
        // S'abonner aux événements
        this.eventBus.on('tile-drawn', (data) => this.onTileDrawn(data));
        this.eventBus.on('tile-placed', (data) => this.onTilePlaced(data));
        this.eventBus.on('turn-changed', (data) => this.onTurnChanged(data));
        this.eventBus.on('tile-rotated', (data) => this.onTileRotated(data));
    }

    init() {
        this.boardElement = document.getElementById('board');
    }
    
    /**
     * Définir le callback de clic sur slot
     */
    setSlotClickHandler(callback) {
        this.onSlotClick = callback;
    }
    
    /**
     * Quand une tuile est piochée
     */
    onTileDrawn(data) {
        // Ne plus stocker tuileEnMain localement
        this.refresh();
    }
    
    /**
     * Quand une tuile est placée
     */
    onTilePlaced(data) {
        this.firstTilePlaced = true;
        this.refresh();
    }
    
    /**
     * Quand une tuile est tournée
     */
    onTileRotated(data) {
        // Rafraîchir les slots car les possibilités changent
        this.refresh();
    }
    
    /**
     * Quand le tour change
     */
    onTurnChanged(data) {
        this.isMyTurn = data.isMyTurn;
        this.refresh();
    }
    
    /**
     * Rafraîchir l'affichage des slots
     */
    refresh() {
        if (this.firstTilePlaced) {
            this.refreshAllSlots();
        }
    }

    /**
     * Créer le slot central - COPIE EXACTE de creerSlotCentral()
     */
    createCentralSlot() {
        console.log('🎯 Création du slot central...');
        const board = this.boardElement;
        console.log('📋 Board element:', board);
        
        const slot = document.createElement('div');
        slot.className = "slot slot-central";
        slot.style.gridColumn = 50;
        slot.style.gridRow = 50;
        
        // ✅ Appliquer le style readonly si ce n'est pas notre tour
        if (!this.isMyTurn && this.gameSync) {
            slot.classList.add('slot-readonly');
            slot.style.cursor = 'default';
            console.log('🔒 Slot central readonly (pas notre tour)');
        } else {
            slot.onclick = () => {
                if (this.getTileEnMain() && !this.firstTilePlaced && this.onSlotClick) {
                    console.log('✅ Clic sur slot central - pose de la tuile');
                    this.onSlotClick(50, 50, this.getTileEnMain(), true);
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
    refreshAllSlots() {
        if (this.firstTilePlaced) {
            document.querySelectorAll('.slot:not(.slot-central)').forEach(s => s.remove());
        }
        
        if (!this.getTileEnMain()) return;
        
        for (let coord in this.plateau.placedTiles) {
            const [x, y] = coord.split(',').map(Number);
            this.generateSlotsAround(x, y);
        }
    }

    /**
     * Générer les slots autour d'une position - COPIE EXACTE de genererSlotsAutour()
     */
    generateSlotsAround(x, y) {
        const directions = [{dx:0, dy:-1}, {dx:1, dy:0}, {dx:0, dy:1}, {dx:-1, dy:0}];
        directions.forEach(dir => {
            const nx = x + dir.dx, ny = y + dir.dy;
            if (this.getTileEnMain() && this.plateau.isFree(nx, ny) && this.plateau.canPlaceTile(nx, ny, this.getTileEnMain())) {
                const slot = document.createElement('div');
                slot.className = "slot";
                slot.style.gridColumn = nx;
                slot.style.gridRow = ny;
                
                // ✅ Si ce n'est pas notre tour : même apparence mais sans onclick et sans hover gold
                if (!this.isMyTurn && this.gameSync) {
                    slot.classList.add('slot-readonly');
                    slot.style.cursor = 'default';
                } else {
                    slot.onclick = () => {
                        if (this.onSlotClick) {
                            this.onSlotClick(nx, ny, this.getTileEnMain());
                        }
                    };
                }
                
                this.boardElement.appendChild(slot);
            }
        });
    }
}
