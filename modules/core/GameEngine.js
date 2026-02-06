/**
 * GameEngine - Moteur principal du jeu
 * Orchestre l'initialisation, les tours, et la fin de partie
 */
import { EventBus } from './EventBus.js';
import { RuleRegistry } from './RuleRegistry.js';
import { ConfigManager } from './ConfigManager.js';
import { BaseRules } from '../rules/BaseRules.js';

export class GameEngine {
    constructor() {
        // Créer les systèmes core
        this.eventBus = new EventBus();
        this.config = new ConfigManager(this.eventBus);
        this.ruleRegistry = new RuleRegistry(this.eventBus, this.config);
        
        // État du jeu
        this.isInitialized = false;
        this.isRunning = false;
        
        console.log('🎮 GameEngine: Moteur de jeu créé');
    }

    /**
     * Initialiser le moteur de jeu
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('⚠️ GameEngine: Déjà initialisé');
            return;
        }

        console.log('🎮 GameEngine: Initialisation...');

        // 1. Enregistrer les règles de base (toujours actives)
        this.ruleRegistry.register('base', BaseRules);
        this.ruleRegistry.enable('base');

        // 2. Charger la configuration
        this.config.loadFromDOM();

        // 3. Émettre événement d'initialisation
        this.eventBus.emit('engine-initialized', {
            eventBus: this.eventBus,
            config: this.config,
            ruleRegistry: this.ruleRegistry
        });

        this.isInitialized = true;
        
        console.log('✅ GameEngine: Initialisé');
    }

    /**
     * Démarrer une partie
     * @param {object} gameState - État du jeu
     * @param {object} deck - Pioche
     * @param {object} board - Plateau
     */
    async startGame(gameState, deck, board) {
        if (!this.isInitialized) {
            throw new Error('GameEngine doit être initialisé avant de démarrer');
        }

        if (this.isRunning) {
            console.warn('⚠️ GameEngine: Partie déjà en cours');
            return;
        }

        console.log('🎮 GameEngine: Démarrage de la partie...');

        // Émettre événement de démarrage
        this.eventBus.emit('game-starting', {
            gameState,
            deck,
            board,
            config: this.config.getAll()
        });

        this.isRunning = true;

        // Démarrer le premier tour
        this.eventBus.emit('game-started', {
            gameState,
            deck,
            board
        });

        console.log('✅ GameEngine: Partie démarrée');
    }

    /**
     * Terminer la partie
     */
    endGame(gameState) {
        if (!this.isRunning) {
            console.warn('⚠️ GameEngine: Aucune partie en cours');
            return;
        }

        console.log('🎮 GameEngine: Fin de la partie');

        this.eventBus.emit('game-ending', { gameState });

        this.isRunning = false;

        this.eventBus.emit('game-ended', { gameState });

        console.log('🏁 GameEngine: Partie terminée');
    }

    /**
     * Mettre en pause
     */
    pause() {
        if (!this.isRunning) return;
        
        this.eventBus.emit('game-paused');
        console.log('⏸️ GameEngine: Partie en pause');
    }

    /**
     * Reprendre
     */
    resume() {
        if (!this.isRunning) return;
        
        this.eventBus.emit('game-resumed');
        console.log('▶️ GameEngine: Partie reprise');
    }

    /**
     * Réinitialiser le moteur
     */
    reset() {
        console.log('🎮 GameEngine: Réinitialisation...');

        if (this.isRunning) {
            this.endGame(null);
        }

        // Désactiver toutes les règles sauf base
        this.ruleRegistry.disableAll();
        this.ruleRegistry.enable('base');

        // Réinitialiser la config
        this.config.reset();

        // Nettoyer les événements
        this.eventBus.clear();

        this.isInitialized = false;

        console.log('✅ GameEngine: Réinitialisé');
    }

    /**
     * Obtenir l'EventBus (pour les autres modules)
     */
    getEventBus() {
        return this.eventBus;
    }

    /**
     * Obtenir le ConfigManager
     */
    getConfig() {
        return this.config;
    }

    /**
     * Obtenir le RuleRegistry
     */
    getRuleRegistry() {
        return this.ruleRegistry;
    }

    /**
     * Afficher l'état du moteur (debug)
     */
    status() {
        console.log('🎮 GameEngine: État du moteur');
        console.log(`  Initialisé: ${this.isInitialized}`);
        console.log(`  En cours: ${this.isRunning}`);
        console.log('  Règles:');
        this.ruleRegistry.status();
        console.log('  Configuration:');
        console.log(this.config.getAll());
    }
}
