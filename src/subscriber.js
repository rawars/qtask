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
        this.consumerLimits = options.consumerLimits || {};
    }

    async init() {
        await this.redisManager.init();
        this.subscriberClient = new Redis(this.redisManager.credentials);
        await this.setupSubscriber();
        await this.checkPendingJobs();
        this.logger.info('Subscriber initialized');
    }

    async checkPendingJobs() {
        const client = await this.redisManager.getClient();
        try {
            for (const [queueName, consumer] of this.consumers.entries()) {
                if (consumer.status !== 'SLEEPING') continue;

                const queueGroupsKey = `qtask:${queueName}:groups`;
                const groups = await client.smembers(queueGroupsKey);

                this.logger.debug(`Checking pending jobs for queue ${queueName}, found ${groups.length} groups`);

                for (const groupKey of groups) {
                    // Extraer el nombre del grupo del groupKey (qtask:queueName:group:groupName)
                    const groupName = groupKey.split(':').pop();
                    const jobCount = await client.zcard(groupKey);
                    
                    if (jobCount > 0) {
                        this.logger.debug(`Found ${jobCount} pending jobs in group ${groupName}`);
                        await this.processQueueTasks(queueName, groupName);
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Error checking pending jobs: ${error.message}`);
        } finally {
            await this.redisManager.releaseClient(client);
        }
    }

    async setupSubscriber() {
        if (!this.subscriberClient) return;

        await this.subscriberClient.subscribe('qtask:newjob');
        this.logger.info('Subscribed to new job notifications');

        this.subscriberClient.on('message', async (channel, message) => {
            if (channel === 'qtask:newjob') {
                try {
                    const jobInfo = JSON.parse(message);
                    const queueName = jobInfo.queueName;
                    // Si recibimos un groupKey completo, extraer el groupName
                    const groupName = jobInfo.groupName.includes(':') 
                        ? jobInfo.groupName.split(':').pop() 
                        : jobInfo.groupName;

                    this.logger.debug(`Received new job notification for queue ${queueName}, group ${groupName}`);
                    await this.processQueueTasks(queueName, groupName);
                } catch (error) {
                    this.logger.error(`Error handling new job message: ${error.message}`);
                }
            }
        });
    }

    async processQueueTasks(queueName, groupName) {
        const consumer = this.consumers.get(queueName);
        if (!consumer || consumer.status !== 'SLEEPING') {
            this.logger.debug(`No available consumer for queue ${queueName} or consumer is busy`);
            return;
        }

        const client = await this.redisManager.getClient();
        try {
            const scriptSha = this.redisManager.getScriptSha('dequeue');
            if (!scriptSha) {
                this.logger.error('Dequeue script not loaded');
                return;
            }

            const groupKey = `qtask:${queueName}:group:${groupName}`;
            const queueGroupsKey = `qtask:${queueName}:groups`;
            
            let jobCount = await client.zcard(groupKey);
            if (jobCount === 0) {
                await client.srem(queueGroupsKey, groupKey);
                this.logger.debug(`No jobs found in group ${groupName}`);
                return;
            }

            this.logger.debug(`Processing ${jobCount} jobs from group ${groupName} in queue ${queueName}`);

            while (consumer.status === 'SLEEPING' && jobCount > 0) {
                const result = await client.evalsha(scriptSha, 1, groupKey);
                if (!result || !Array.isArray(result)) {
                    this.logger.debug('No more jobs available in group');
                    break;
                }

                const [jobId, jobDataStr] = result;
                
                try {
                    const jobData = JSON.parse(jobDataStr);
                    this.logger.debug(`Processing job ${jobId}`);
                    await consumer.process({
                        id: jobId,
                        data: jobData,
                        groupName
                    });
                } catch (error) {
                    this.logger.error(`Error processing job ${jobId}: ${error.message}`);
                    break;
                }

                jobCount = await client.zcard(groupKey);
                if (jobCount === 0) {
                    await client.srem(queueGroupsKey, groupKey);
                    this.logger.debug(`Group ${groupName} is now empty`);
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

        // Verificar trabajos pendientes para este nuevo consumidor
        setImmediate(() => {
            this.checkPendingJobs().catch(error => {
                this.logger.error(`Error checking pending jobs for new consumer: ${error.message}`);
            });
        });
    }

    async close() {
        if (this.subscriberClient) {
            this.subscriberClient.disconnect();
        }

        await this.redisManager.close();
        this.logger.info('Subscriber closed');
    }
}

export default Subscriber; 