/**
 * ConfigManager - Gère la configuration de la partie
 * Stocke les paramètres sélectionnés dans le lobby
 */
export class ConfigManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.config = this.getDefaultConfig();
    }

    /**
     * Configuration par défaut
     */
    getDefaultConfig() {
        return {
            // Départ
            startType: 'unique', // 'unique', 'river1', 'river2', 'carcassonne'
            
            // Visuel
            visual: 'c2', // 'c2', 'c3'
            
            // Options
            placementAssist: true,
            listRemaining: false,
            useTestDeck: false,
            
            // Extensions actives
            extensions: {
                base: true, // Toujours actif
                fields: true, // Les champs
                river: false,
                inns: false,
                traders: false,
                abbey: false,
                tower: false
            },
            
            // Multijoueur
            isMultiplayer: false,
            isHost: false,
            gameCode: null,
            
            // Joueurs
            maxPlayers: 6,
            players: []
        };
    }

    /**
     * Définir une valeur de config
     * @param {string} key - Clé (peut être nested avec '.')
     * @param {*} value - Valeur
     */
    set(key, value) {
        const keys = key.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];
        current[lastKey] = value;
        
        console.log(`⚙️ ConfigManager: "${key}" = ${JSON.stringify(value)}`);
        
        // Émettre événement si changement
        if (oldValue !== value) {
            this.eventBus.emit('config-changed', { key, value, oldValue });
        }
    }

    /**
     * Obtenir une valeur de config
     * @param {string} key - Clé (peut être nested avec '.')
     * @returns {*}
     */
    get(key) {
        const keys = key.split('.');
        let current = this.config;
        
        for (const k of keys) {
            if (current[k] === undefined) {
                return undefined;
            }
            current = current[k];
        }
        
        return current;
    }

    /**
     * Obtenir toute la config
     * @returns {object}
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Charger une config complète
     * @param {object} newConfig - Nouvelle configuration
     */
    load(newConfig) {
        this.config = {
            ...this.getDefaultConfig(),
            ...newConfig
        };
        
        console.log('⚙️ ConfigManager: Configuration chargée', this.config);
        
        this.eventBus.emit('config-loaded', this.config);
    }

    /**
     * Réinitialiser aux valeurs par défaut
     */
    reset() {
        this.config = this.getDefaultConfig();
        
        console.log('⚙️ ConfigManager: Configuration réinitialisée');
        
        this.eventBus.emit('config-reset', this.config);
    }

    /**
     * Activer/désactiver une extension
     * @param {string} extensionName - Nom de l'extension
     * @param {boolean} enabled - Activer ou désactiver
     */
    setExtension(extensionName, enabled) {
        this.set(`extensions.${extensionName}`, enabled);
    }

    /**
     * Vérifier si une extension est active
     * @param {string} extensionName - Nom de l'extension
     * @returns {boolean}
     */
    isExtensionEnabled(extensionName) {
        return this.get(`extensions.${extensionName}`) === true;
    }

    /**
     * Obtenir la liste des extensions actives
     * @returns {Array<string>}
     */
    getActiveExtensions() {
        const extensions = this.get('extensions');
        return Object.keys(extensions).filter(key => extensions[key] === true);
    }

    /**
     * Charger la config depuis le DOM (lobby)
     */
    loadFromDOM() {
        // Départ
        const startRadio = document.querySelector('input[name="start"]:checked');
        if (startRadio) {
            this.set('startType', startRadio.value);
        }

        // Visuel
        const visualRadio = document.querySelector('input[name="visual"]:checked');
        if (visualRadio) {
            this.set('visual', visualRadio.value);
        }

        // Options
        const listRemaining = document.getElementById('list-remaining');
        if (listRemaining) {
            this.set('listRemaining', listRemaining.checked);
        }

        const useTestDeck = document.getElementById('use-test-deck');
        if (useTestDeck) {
            this.set('useTestDeck', useTestDeck.checked);
        }

        // Extensions
        const baseFields = document.getElementById('base-fields');
        if (baseFields) {
            this.set('extensions.fields', baseFields.checked);
        }

        console.log('⚙️ ConfigManager: Configuration chargée depuis le DOM');
    }

    /**
     * Sauvegarder la config dans localStorage
     * @param {string} key - Clé de sauvegarde
     */
    save(key = 'carcassonne_config') {
        try {
            localStorage.setItem(key, JSON.stringify(this.config));
            console.log('💾 ConfigManager: Configuration sauvegardée');
        } catch (error) {
            console.error('❌ ConfigManager: Erreur de sauvegarde', error);
        }
    }

    /**
     * Charger la config depuis localStorage
     * @param {string} key - Clé de sauvegarde
     */
    loadSaved(key = 'carcassonne_config') {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const config = JSON.parse(saved);
                this.load(config);
                return true;
            }
        } catch (error) {
            console.error('❌ ConfigManager: Erreur de chargement', error);
        }
        return false;
    }
}
