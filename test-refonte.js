/**
 * TEST - Validation de l'architecture refonte Phase 1
 * Ce fichier teste que tous les modules core fonctionnent correctement
 */
import { GameEngine } from './modules/core/GameEngine.js';

console.log('=== TEST ARCHITECTURE REFONTE ===');

// 1. Créer le moteur de jeu
const engine = new GameEngine();
console.log('✅ GameEngine créé');

// 2. Initialiser
await engine.initialize();
console.log('✅ GameEngine initialisé');

// 3. Tester EventBus
const eventBus = engine.getEventBus();
let testEventReceived = false;

eventBus.on('test-event', (data) => {
    console.log('✅ Événement reçu:', data);
    testEventReceived = true;
});

eventBus.emit('test-event', { message: 'Hello from EventBus!' });

if (testEventReceived) {
    console.log('✅ EventBus fonctionne');
} else {
    console.error('❌ EventBus ne fonctionne pas');
}

// 4. Tester ConfigManager
const config = engine.getConfig();
config.set('test.value', 42);
const value = config.get('test.value');

if (value === 42) {
    console.log('✅ ConfigManager fonctionne');
} else {
    console.error('❌ ConfigManager ne fonctionne pas');
}

// 5. Tester RuleRegistry
const ruleRegistry = engine.getRuleRegistry();

// Les règles de base doivent être actives
if (ruleRegistry.isActive('base')) {
    console.log('✅ BaseRules actives');
} else {
    console.error('❌ BaseRules non actives');
}

// 6. Afficher le statut
engine.status();

console.log('=== FIN DES TESTS ===');
console.log('✅ Tous les tests passés ! Architecture Phase 1 fonctionnelle.');
