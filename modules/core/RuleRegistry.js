/**
 * RuleRegistry - Gère l'enregistrement et l'activation des règles du jeu
 * Permet d'activer/désactiver dynamiquement les extensions
 */
export class RuleRegistry {
    constructor(eventBus, config) {
        this.eventBus = eventBus;
        this.config = config;
        this.rules = new Map(); // name → rule instance
        this.activeRules = new Set(); // rules actuellement actives
    }

    /**
     * Enregistrer une règle/extension
     * @param {string} name - Nom unique de la règle
     * @param {class} RuleClass - Classe de la règle
     */
    register(name, RuleClass) {
        if (this.rules.has(name)) {
            console.warn(`⚠️ RuleRegistry: Règle "${name}" déjà enregistrée, écrasement`);
        }

        const ruleInstance = new RuleClass(this.eventBus, this.config);
        this.rules.set(name, ruleInstance);
        
        console.log(`📋 RuleRegistry: Règle "${name}" enregistrée`);
        
        return ruleInstance;
    }

    /**
     * Activer une règle
     * @param {string} name - Nom de la règle
     */
    enable(name) {
        const rule = this.rules.get(name);
        
        if (!rule) {
            console.error(`❌ RuleRegistry: Règle "${name}" non trouvée`);
            return false;
        }

        if (this.activeRules.has(name)) {
            console.warn(`⚠️ RuleRegistry: Règle "${name}" déjà active`);
            return true;
        }

        // Appeler la méthode register() de la règle
        if (typeof rule.register === 'function') {
            rule.register();
        }

        this.activeRules.add(name);
        
        console.log(`✅ RuleRegistry: Règle "${name}" activée`);
        
        // Émettre événement
        this.eventBus.emit('rule-enabled', { name, rule });
        
        return true;
    }

    /**
     * Désactiver une règle
     * @param {string} name - Nom de la règle
     */
    disable(name) {
        const rule = this.rules.get(name);
        
        if (!rule) {
            console.error(`❌ RuleRegistry: Règle "${name}" non trouvée`);
            return false;
        }

        if (!this.activeRules.has(name)) {
            console.warn(`⚠️ RuleRegistry: Règle "${name}" déjà inactive`);
            return true;
        }

        // Appeler la méthode unregister() de la règle
        if (typeof rule.unregister === 'function') {
            rule.unregister();
        }

        this.activeRules.delete(name);
        
        console.log(`🔴 RuleRegistry: Règle "${name}" désactivée`);
        
        // Émettre événement
        this.eventBus.emit('rule-disabled', { name, rule });
        
        return true;
    }

    /**
     * Vérifier si une règle est active
     * @param {string} name - Nom de la règle
     * @returns {boolean}
     */
    isActive(name) {
        return this.activeRules.has(name);
    }

    /**
     * Obtenir une règle
     * @param {string} name - Nom de la règle
     * @returns {object|null}
     */
    getRule(name) {
        return this.rules.get(name) || null;
    }

    /**
     * Obtenir toutes les règles enregistrées
     * @returns {Array}
     */
    getAllRules() {
        return Array.from(this.rules.keys());
    }

    /**
     * Obtenir toutes les règles actives
     * @returns {Array}
     */
    getActiveRules() {
        return Array.from(this.activeRules);
    }

    /**
     * Activer plusieurs règles à la fois
     * @param {Array<string>} names - Liste des noms de règles
     */
    enableMultiple(names) {
        names.forEach(name => this.enable(name));
    }

    /**
     * Désactiver toutes les règles actives
     */
    disableAll() {
        const activeRules = Array.from(this.activeRules);
        activeRules.forEach(name => this.disable(name));
    }

    /**
     * Afficher l'état des règles (debug)
     */
    status() {
        console.log('📋 RuleRegistry: État des règles');
        console.log(`  Total enregistrées: ${this.rules.size}`);
        console.log(`  Total actives: ${this.activeRules.size}`);
        
        this.rules.forEach((rule, name) => {
            const isActive = this.activeRules.has(name);
            console.log(`  - ${name}: ${isActive ? '✅ ACTIVE' : '🔴 INACTIVE'}`);
        });
    }
}
