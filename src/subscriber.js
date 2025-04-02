import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import Logger from './logger.js';
import Consumer from './consumer.js';

/**
 * Class representing a subscriber that manages multiple consumers
 */
class Subscriber {
    constructor(redisManager, options = {}) {
        this.uid = uuidv4();
        this.logger = options.logger || new Logger(options.level || 'info');
        this.redisManager = redisManager;
        this.consumers = new Map();
        this.subscriberClient = null;
        this.activeProcessingInterval = null;
        this.consumerLimits = options.consumerLimits || {};
    }

    async init() {
        await this.redisManager.init();
        this.subscriberClient = new Redis(this.redisManager.credentials);
        await this.setupSubscriber();
        this.startActiveProcessing();
        this.logger.info('Subscriber initialized');
    }

    async setupSubscriber() {
        if (!this.subscriberClient) return;

        await this.subscriberClient.subscribe('qtask:newjob');
        this.logger.info('Subscribed to new job notifications');

        this.subscriberClient.on('message', async (channel, message) => {
            if (channel === 'qtask:newjob') {
                try {
                    const jobInfo = JSON.parse(message);
                    const consumer = this.consumers.get(jobInfo.queueName);
                    
                    if (consumer && consumer.status === 'SLEEPING') {
                        const groupKey = `qtask:${jobInfo.queueName}:group:${jobInfo.groupName}`;
                        const client = await this.redisManager.getClient();
                        
                        try {
                            const jobCount = await client.zcard(groupKey);
                            if (jobCount > 0) {
                                await this.processQueueTasks(jobInfo.queueName);
                            }
                        } finally {
                            await this.redisManager.releaseClient(client);
                        }
                    }
                } catch (error) {
                    this.logger.error(`Error handling new job message: ${error.message}`);
                }
            }
        });
    }

    startActiveProcessing() {
        if (this.activeProcessingInterval) {
            clearInterval(this.activeProcessingInterval);
        }
        
        this.activeProcessingInterval = setInterval(async () => {
            for (const [queueName, consumer] of this.consumers.entries()) {
                if (consumer.status === 'SLEEPING') {
                    await this.processQueueTasks(queueName);
                }
            }
        }, 5000);
    }

    async processQueueTasks(queueName) {
        const consumer = this.consumers.get(queueName);
        if (!consumer) return;

        const client = await this.redisManager.getClient();
        try {
            const scriptSha = this.redisManager.getScriptSha('dequeue');
            if (!scriptSha) {
                this.logger.error('Dequeue script not loaded');
                return;
            }

            const queueGroupsKey = `qtask:${queueName}:groups`;
            const groups = await client.smembers(queueGroupsKey);
            
            if (groups.length === 0) return;

            for (const groupKey of groups) {
                const jobCount = await client.zcard(groupKey);
                if (jobCount === 0) {
                    await client.srem(queueGroupsKey, groupKey);
                    continue;
                }

                const result = await client.evalsha(scriptSha, 1, groupKey);
                if (!result || !Array.isArray(result)) continue;

                const [jobId, jobDataStr, groupName] = result;
                
                try {
                    const jobData = JSON.parse(jobDataStr);
                    await consumer.process({
                        id: jobId,
                        data: jobData,
                        groupName
                    });
                } catch (error) {
                    this.logger.error(`Error processing job ${jobId}: ${error.message}`);
                }
            }
        } catch (error) {
            this.logger.error(`Error processing queue tasks: ${error.message}`);
        } finally {
            await this.redisManager.releaseClient(client);
        }
    }

    process(queueName, callback) {
        if (this.consumers.has(queueName)) {
            throw new Error(`A processor for queue '${queueName}' already exists`);
        }

        const consumerLimit = this.consumerLimits[queueName];
        if (consumerLimit && this.consumers.size >= consumerLimit) {
            throw new Error(`Consumer limit reached for queue '${queueName}'`);
        }

        const consumer = new Consumer(uuidv4(), queueName, callback, this.logger.level);
        this.consumers.set(queueName, consumer);
        this.logger.info(`New consumer registered for queue '${queueName}'`);
    }

    async close() {
        if (this.activeProcessingInterval) {
            clearInterval(this.activeProcessingInterval);
            this.activeProcessingInterval = null;
        }

        if (this.subscriberClient) {
            this.subscriberClient.disconnect();
        }

        await this.redisManager.close();
        this.logger.info('Subscriber closed');
    }
}

export default Subscriber; 