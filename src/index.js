import Queue from './Queue.js';
import Publisher from './publisher.js';
import Subscriber from './subscriber.js';
import RedisManager from './redis-manager.js';
import Logger from './logger.js';

// Crear el objeto de exportación
const qtask = {
    Logger,
    Subscriber,
    RedisManager
};

// Exportar la clase principal Queue
export { Queue };

// Exportar las clases individuales para compatibilidad hacia atrás
export { Publisher, Subscriber, RedisManager, Logger };

// Exportar para ESM
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
