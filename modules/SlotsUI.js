import { Tile } from './Tile.js';

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
        // Stocker la tuile pour pouvoir afficher les slots même si on n'est pas le joueur actif
        if (data.tileData) {
            this.currentTile = new Tile(data.tileData);
        }
        
        // Rafraîchir les slots si on n'est PAS le joueur actif (pour voir les slots du joueur actif)
        // Le joueur actif rafraîchira via turn-changed
        if (!this.isMyTurn && this.firstTilePlaced) {
            console.log('🔄 Refresh slots pour joueur inactif après tile-drawn');
            this.refresh();
        }
    }
    
    /**
     * Quand une tuile est placée
     */
    onTilePlaced(data) {
        this.firstTilePlaced = true;
        // Ne PAS refresh ici - les slots seront rafraîchis par turn-changed après la fin du tour
        // Si on refresh ici, isMyTurn n'est pas encore à jour et on crée les slots du mauvais joueur
    }
    
    /**
     * Quand une tuile est tournée
     */
    onTileRotated(data) {
        // Mettre à jour la rotation de currentTile
        if (this.currentTile && data.rotation !== undefined) {
            this.currentTile.rotation = data.rotation;
        }
        // Rafraîchir les slots car les possibilités changent
        this.refresh();
    }
    
    /**
     * Quand le tour change
     */
    onTurnChanged(data) {
        console.log('🔄 SlotsUI.onTurnChanged - isMyTurn:', data.isMyTurn);
        this.isMyTurn = data.isMyTurn;
        
        // Mettre à jour les slots existants (readonly ou non)
        const slots = document.querySelectorAll('.slot');
        console.log(`🔄 Mise à jour de ${slots.length} slots existants`);
        slots.forEach(slot => {
            if (!this.isMyTurn) {
                slot.classList.add('slot-readonly');
                slot.style.cursor = 'default';
                slot.style.pointerEvents = 'none'; // Désactiver hover
                console.log('  → Slot mis en readonly');
            } else {
                slot.classList.remove('slot-readonly');
                slot.style.cursor = 'pointer';
                slot.style.pointerEvents = 'auto'; // Réactiver
                console.log('  → Slot mis en actif');
            }
        });
        
        this.refresh();
    }
    
    /**
     * Rafraîchir l'affichage des slots
     */
    refresh() {
        if (this.firstTilePlaced) {
            this.refreshAllSlots();
        }
        // Note: Les slots sont affichés pour TOUS les joueurs
        // mais en readonly (pointer-events: none) pour les joueurs inactifs
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
        
        // ✅ Si ce n'est pas notre tour : readonly, pas de clic, pas de hover
        if (!this.isMyTurn) {
            slot.classList.add('slot-readonly');
            slot.style.cursor = 'default';
            slot.style.pointerEvents = 'none';
            console.log('🔒 Slot central readonly (pas notre tour)');
        } else {
            // ✅ Seulement le joueur actif a un onclick
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
     * Rafraîchir tous les slots - COPIE EXACTE de rafraichirTousLesSlots()\n     */
    refreshAllSlots() {
        console.log('🔄 refreshAllSlots - firstTilePlaced:', this.firstTilePlaced, 'isMyTurn:', this.isMyTurn);
        
        if (this.firstTilePlaced) {
            document.querySelectorAll('.slot:not(.slot-central)').forEach(s => s.remove());
        }
        
        // Utiliser currentTile (tuile piochée) au lieu de getTileEnMain()
        // pour que le joueur inactif voit aussi les slots
        const tile = this.currentTile || this.getTileEnMain();
        console.log('🎴 Tuile:', tile ? tile.id : 'null', '(currentTile:', this.currentTile?.id, 'getTileEnMain:', this.getTileEnMain()?.id + ')');
        
        if (!tile) return;
        
        console.log('📍 Tuiles placées:', Object.keys(this.plateau.placedTiles).length);
        for (let coord in this.plateau.placedTiles) {
            const [x, y] = coord.split(',').map(Number);
            this.generateSlotsAround(x, y, tile);
        }
    }

    /**
     * Générer les slots autour d'une position - COPIE EXACTE de genererSlotsAutour()
     */
    generateSlotsAround(x, y, tile) {
        const directions = [{dx:0, dy:-1}, {dx:1, dy:0}, {dx:0, dy:1}, {dx:-1, dy:0}];
        directions.forEach(dir => {
            const nx = x + dir.dx, ny = y + dir.dy;
            const isFree = this.plateau.isFree(nx, ny);
            const canPlace = tile && this.plateau.canPlaceTile(nx, ny, tile);
            console.log(`  Slot (${nx},${ny}): free=${isFree} canPlace=${canPlace} tile=${tile?.id}`);
            
            if (tile && isFree && canPlace) {
                const slot = document.createElement('div');
                slot.className = "slot";
                slot.style.gridColumn = nx;
                slot.style.gridRow = ny;
                
                console.log(`🔧 Création slot (${nx},${ny}) - isMyTurn:`, this.isMyTurn);
                
                // ✅ Si ce n'est pas notre tour : readonly, pas de clic, pas de hover
                if (!this.isMyTurn) {
                    slot.classList.add('slot-readonly');
                    slot.style.cursor = 'default';
                    slot.style.pointerEvents = 'none';
                    // PAS de onclick
                } else {
                    // ✅ Seulement le joueur actif a un onclick
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
