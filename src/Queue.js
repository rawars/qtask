import Publisher from './publisher.js';
import Subscriber from './subscriber.js';
import RedisManager from './redis-manager.js';
import Logger from './logger.js';

class Queue {
    constructor(options = {}) {
        const { credentials, type, logLevel = 'info', consumerLimits = {} } = options;

        // Validar el tipo
        if (!['publisher', 'subscriber'].includes(type)) {
            throw new Error('Queue type must be either "publisher" or "subscriber"');
        }

        // Crear logger
        this.logger = new Logger(logLevel);

        // Crear RedisManager
        this.redisManager = new RedisManager({
            credentials,
            logger: this.logger
        });

        this.type = type;
        this.consumerLimits = consumerLimits;

        // Crear la instancia correspondiente según el tipo
        if (type === 'publisher') {
            this.instance = new Publisher(this.redisManager, { logger: this.logger });
        } else {
            this.instance = new Subscriber(this.redisManager, {
                logger: this.logger,
                consumerLimits
            });
        }
    }

    async init() {
        try {
            // Inicializar RedisManager
            await this.redisManager.init();
            
            // Inicializar la instancia si tiene método init
            if (this.instance.init) {
                await this.instance.init();
            }

            this.logger.info(`Queue initialized as ${this.type}`);
        } catch (error) {
            this.logger.error('Failed to initialize queue:', error);
            throw error;
        }
    }

    // Métodos del Publisher
    async add(queueName, groupName, data) {
        if (this.type !== 'publisher') {
            throw new Error('Method "add" is only available for publisher instances');
        }
        return this.instance.add(queueName, groupName, data);
    }

    // Métodos del Subscriber
    process(queueName, handler) {
        if (this.type !== 'subscriber') {
            throw new Error('Method "process" is only available for subscriber instances');
        }
        return this.instance.process(queueName, handler);
    }

    async close() {
        try {
            // Cerrar la instancia si tiene método close
            if (this.instance.close) {
                await this.instance.close();
            }

            // Cerrar RedisManager
            await this.redisManager.close();

            this.logger.info('Queue closed successfully');
        } catch (error) {
            this.logger.error('Error closing queue:', error);
            throw error;
        }
    }
}

export default Queue; 