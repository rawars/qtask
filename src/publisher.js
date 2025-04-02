import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import Logger from './logger.js';

/**
 * Class representing a publisher that adds jobs to queues
 */
class Publisher {
    constructor(redisManager, options = {}) {
        this.uid = uuidv4();
        this.logger = options.logger || new Logger({ level: options.logLevel || 'info' });
        this.redisManager = redisManager;
        this.publisherClient = new Redis(redisManager.credentials);
    }

    async init() {
        await this.redisManager.init();
        this.logger.info('Publisher initialized');
    }

    async add(queueName, groupName, data, options = {}) {
        const client = await this.redisManager.getClient();
        try {
            const scriptSha = this.redisManager.getScriptSha('enqueue');
            if (!scriptSha) {
                this.logger.error('Enqueue script not loaded');
                return null;
            }

            const queueKey = `qtask:${queueName}:groups`;
            const groupKey = `qtask:${queueName}:group:${groupName}`;
            
            const jobId = await client.evalsha(
                scriptSha,
                2,
                queueKey,
                groupKey,
                JSON.stringify(data),
                groupName,
                options.priority || 0,
                options.delay || 0,
                options.ttl || 0
            );
            
            await this.publisherClient.publish('qtask:newjob', JSON.stringify({ 
                queueName, 
                groupName 
            }));
            
            this.logger.debug(`Job ${jobId} added to queue ${queueName}, group ${groupName}`);
            return jobId;
        } catch (error) {
            this.logger.error(`Error adding job: ${error.message}`);
            return null;
        } finally {
            await this.redisManager.releaseClient(client);
        }
    }

    async close() {
        if (this.publisherClient) {
            this.publisherClient.disconnect();
        }
        await this.redisManager.close();
        this.logger.info('Publisher closed');
    }
}

export default Publisher; 