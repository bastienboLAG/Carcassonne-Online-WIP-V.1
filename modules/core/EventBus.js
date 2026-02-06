/**
 * EventBus - Système de communication pub/sub entre modules
 * Permet aux modules de communiquer sans dépendances directes
 */
export class EventBus {
    constructor() {
        this.events = {};
        this.debug = true; // Activer pour debug
    }

    /**
     * S'abonner à un événement
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction à appeler
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        
        if (this.debug) {
            console.log(`📡 EventBus: Listener ajouté pour "${event}"`);
        }
    }

    /**
     * Se désabonner d'un événement
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction à retirer
     */
    off(event, callback) {
        if (!this.events[event]) return;
        
        this.events[event] = this.events[event].filter(cb => cb !== callback);
        
        if (this.debug) {
            console.log(`📡 EventBus: Listener retiré pour "${event}"`);
        }
    }

    /**
     * Émettre un événement
     * @param {string} event - Nom de l'événement
     * @param {*} data - Données à transmettre
     */
    emit(event, data) {
        if (!this.events[event]) {
            if (this.debug) {
                console.log(`📡 EventBus: Aucun listener pour "${event}"`);
            }
            return;
        }
        
        if (this.debug) {
            console.log(`📡 EventBus: Émission "${event}"`, data);
        }
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`❌ EventBus: Erreur dans listener "${event}":`, error);
            }
        });
    }

    /**
     * S'abonner à un événement une seule fois
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction à appeler
     */
    once(event, callback) {
        const onceWrapper = (data) => {
            callback(data);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
    }

    /**
     * Supprimer tous les listeners d'un événement
     * @param {string} event - Nom de l'événement
     */
    clear(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
        
        if (this.debug) {
            console.log(`📡 EventBus: Listeners supprimés pour "${event || 'tous'}"`);
        }
    }

    /**
     * Lister tous les événements enregistrés
     */
    listEvents() {
        console.log('📡 EventBus: Événements enregistrés:');
        Object.keys(this.events).forEach(event => {
            console.log(`  - ${event}: ${this.events[event].length} listener(s)`);
        });
    }
}
