import { v4 as uuidv4 } from 'uuid';
import Logger from './logger.js';

/**
 * Class representing a queue consumer
 */
class Consumer {
    constructor(sessionId, queueName, callback, logLevel = 'info') {
        this.uid = uuidv4();
        this.status = 'SLEEPING';
        this.sessionId = sessionId;
        this.queueName = queueName;
        this.callback = callback;
        this.logger = new Logger(logLevel, `Consumer:${queueName}`);
    }

    async process(job) {
        if (this.status === 'RUNNING') {
            this.logger.warn(`Consumer for queue ${this.queueName} is already running.`);
            throw new Error(`Consumer for queue ${this.queueName} is already running.`);
        }
        
        this.status = 'RUNNING';
        this.logger.info(`Starting to process job ${job.id} in queue ${this.queueName}`);

        try {
            await new Promise((resolve, reject) => {
                this.callback(job, (err) => {
                    if (err) {
                        this.logger.error(`Error processing job ${job.id}: ${err.message}`);
                        reject(err);
                    } else {
                        this.logger.info(`Job ${job.id} processed successfully`);
                        resolve();
                    }
                });
            });
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Error in consumer for ${this.queueName}: ${error.message}`);
            } else {
                this.logger.error(`Unknown error in consumer for ${this.queueName}: ${String(error)}`);
            }
            throw error;
        } finally {
            this.status = 'SLEEPING';
            this.logger.debug(`Consumer for ${this.queueName} returns to SLEEPING state`);
        }
    }
}

export default Consumer; 