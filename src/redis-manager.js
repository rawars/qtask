import { join } from 'path';
import { createPool } from 'generic-pool';
import { promises as fs } from 'fs';
import Redis from 'ioredis';
import Logger from './logger.js';

/**
 * Options for RedisManager
 */
const IRedisManagerOptions = {
  credentials: {
    // Assuming RedisOptions is imported from 'ioredis'
  },
  scripts: ["dequeue", "enqueue", "get_status", "update_status"],
  logLevel: ['silent', 'debug', 'info', 'warn', 'error'][Math.floor(Math.random() * 5)]
};

/**
 * Class for managing Redis connections and Lua scripts
 */
class RedisManager {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.scripts = options.scripts || ["dequeue", "enqueue", "get_status", "update_status"];
    this.scriptsDir = join(process.cwd(), 'src/scripts');
    this.scriptContents = new Map();
    this.scriptShas = new Map();

    this.pool = createPool({
      create: async () => {
        return new Redis(options.credentials);
      },
      destroy: async (client) => {
        await client.quit();
      }
    });
  }

  getScriptSha(scriptName) {
    return this.scriptShas.get(scriptName);
  }

  async init() {
    try {
      this.logger.info('Initializing Redis manager');
      await this.loadAndRegisterLuaScripts();
      this.logger.info('Redis manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Redis manager:', error);
      throw error;
    }
  }

  async loadAndRegisterLuaScripts() {
    this.logger.info('Loading Lua scripts');
    const client = await this.pool.acquire();
    
    try {
      for (const scriptName of this.scripts) {
        const scriptContent = await this.loadLuaScript(scriptName);
        
        if (scriptContent) {
          const sha = await client.script('LOAD', scriptContent);
          this.scriptShas.set(scriptName, sha);
          this.scriptContents.set(scriptName, scriptContent);
          this.logger.info(`Script ${scriptName} loaded with SHA: ${sha}`);
        }
      }
    } finally {
      await this.pool.release(client);
    }
  }

  async loadLuaScript(scriptName) {
    try {
      const scriptPath = join(this.scriptsDir, `${scriptName}.lua`);
      const content = await fs.readFile(scriptPath, 'utf8');
      return content;
    } catch (error) {
      this.logger.error(`Error loading script ${scriptName}: ${error.message || error}`);
      return null;
    }
  }

  async getClient() {
    try {
      return await this.pool.acquire();
    } catch (error) {
      this.logger.error('Failed to acquire Redis client:', error);
      throw error;
    }
  }

  async releaseClient(client) {
    try {
      await this.pool.release(client);
    } catch (error) {
      this.logger.error('Failed to release Redis client:', error);
      throw error;
    }
  }

  async close() {
    this.logger.info('Closing Redis manager');
    await this.pool.drain();
    await this.pool.clear();
    this.logger.info('Redis manager closed');
  }
}

export default RedisManager; 