import Logger from './logger.js';
import Subscriber from './subscriber.js';
import RedisManager from './redis-manager.js';

// Crear el objeto de exportación
const qtask = {
    Logger,
    Subscriber,
    RedisManager
};

// Exportar para ESM
export { Logger, Subscriber, RedisManager };
export default qtask;

// Exportar para CommonJS
if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
        exports.Logger = Logger;
        exports.Subscriber = Subscriber;
        exports.RedisManager = RedisManager;
        module.exports = qtask;
        // Asegurar que las exportaciones nombradas también funcionen en CommonJS
        module.exports.default = qtask;
    }
}
