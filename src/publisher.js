const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const { Consumer } = require('./consumer');
const { ICallback, IJobData, IQueueOptions, IAddJobOptions } = require('./interfaces/queue.interface');
const { Logger } = require('./utils/logger');
const { RedisManager } = require('./utils/redis-manager');

/**
 * Main class for managing the job queue
 */
class Publisher {
  constructor(redisManager, options = {}) {
    this.uid = uuidv4();
    this.logger = options.logger || console;
    this.subscriberClient = null;
    this.publisherClient = null;
    this.type = options.type;
    this.redisManager = redisManager;
    this.consumerLimits = options.consumerLimits || null;
    this.consumers = new Map();
    this.activeProcessingInterval = null;
    this.scripts = ["dequeue", "enqueue", "get_status", "update_status"];

    this.logger.info(`Initializing queue with UID: ${this.uid}`);

    if (options.type === 'subscriber') {
      this.subscriberClient = new Redis(options.credentials);
      this.setupSubscriber();
    }

    if (options.type === 'publisher') {
      this.publisherClient = new Redis(options.credentials);
    }
  }

  async init() {
    await this.redisManager.init();
    
    if (this.type === 'subscriber') {
      this.startActiveProcessing();
    }
  }

  getUid() {
    return this.uid;
  }

  startActiveProcessing() {
    if (this.activeProcessingInterval) {
      clearInterval(this.activeProcessingInterval);
    }
    
    this.activeProcessingInterval = setInterval(async () => {
      for (const [queueName, consumer] of this.consumers.entries()) {
        if (consumer.status === 'SLEEPING') {
          await this.processQueueTasks(queueName, consumer);
        }
      }
    }, 5000);
  }

  async processQueueTasks(queueName, consumer) {
    const client = await this.redisManager.getClient();
    try {
      const scriptSha = this.redisManager.getScriptSha('dequeue');
      if (!scriptSha) {
        this.logger.error('Dequeue script not loaded');
        return;
      }

      const queueGroupsKey = `qtask:${queueName}:groups`;
      const groups = await client.smembers(queueGroupsKey);
      
      if (groups.length === 0) {
        return;
      }

      for (const groupKey of groups) {
        const jobCount = await client.zcard(groupKey);
        if (jobCount === 0) {
          await client.srem(queueGroupsKey, groupKey);
          continue;
        }

        const result = await client.evalsha(scriptSha, 1, groupKey);
        if (!result || !Array.isArray(result)) {
          continue;
        }

        const [jobId, jobDataStr, groupName] = result;
        
        try {
          const jobData = JSON.parse(jobDataStr);
          
          const job = {
            id: jobId,
            data: jobData,
            groupName
          };
          
          await consumer.process(job);
        } catch (error) {
          this.logger.error(`Error processing job ${jobId}: ${error.message || error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing queue tasks: ${error.message || error}`);
    } finally {
      this.redisManager.releaseClient(client);
    }
  }

  setupSubscriber() {
    if (!this.subscriberClient) {
      return;
    }

    this.subscriberClient.subscribe('qtask:newjob', (err) => {
      if (err) {
        this.logger.error(`Error subscribing to new job notifications: ${err.message}`);
        return;
      }
      this.logger.info('Subscribed to new job notifications');
    });

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
                await this.processQueueTasks(jobInfo.queueName, consumer);
              }
            } finally {
              this.redisManager.releaseClient(client);
            }
          }
        } catch (error) {
          this.logger.error(`Error handling new job message: ${error.message || error}`);
        }
      }
    });
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
      
      if (this.publisherClient) {
        await this.publisherClient.publish('qtask:newjob', JSON.stringify({ queueName, groupName }));
      }
      
      return jobId;
    } catch (error) {
      this.logger.error(`Error adding job: ${error.message || error}`);
      return null;
    } finally {
      this.redisManager.releaseClient(client);
    }
  }

  async process(queueName, callback) {
    if (this.type !== 'subscriber') {
      throw new Error('Only subscriber instances can process jobs');
    }

    if (this.consumers.has(queueName)) {
      throw new Error(`A processor for queue '${queueName}' already exists`);
    }

    const consumer = new Consumer(uuidv4(), queueName, callback, this.logger.logLevel);
    this.consumers.set(queueName, consumer);
    
    if (this.type === 'subscriber') {
      await this.processQueueTasks(queueName, consumer);
    }
  }

  async close() {
    if (this.activeProcessingInterval) {
      clearInterval(this.activeProcessingInterval);
      this.activeProcessingInterval = null;
    }

    if (this.subscriberClient) {
      this.subscriberClient.disconnect();
    }

    if (this.publisherClient) {
      this.publisherClient.disconnect();
    }

    await this.redisManager.close();
    
    this.logger.info('Queue closed');
  }
}

module.exports = Publisher; 