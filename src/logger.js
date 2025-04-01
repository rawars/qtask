import pino from 'pino';

/**
 * Class for handling logs with different levels
 */
class Logger {
  /**
   * Constructor
   * @param {string} [level='info'] - Log level (silent, debug, info, warn, error)
   * @param {string} [prefix=''] - Prefix for log messages
   */
  constructor(level = 'info', prefix = '') {
    this.level = level;
    this.prefix = prefix;

    // Configurar pino con colores y formato bonito
    this.logger = pino({
      level: level === 'silent' ? 'silent' : level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: prefix ? `[${prefix}] {msg}` : '{msg}',
          customColors: 'debug:blue,info:green,warn:yellow,error:red'
        }
      }
    });
  }

  /**
   * Gets the current log level
   * @returns {string} Current log level
   */
  get logLevel() {
    return this.level;
  }

  /**
   * Debug level log
   * @param {string} message - Message to log
   * @param {Object} [context] - Additional context to log
   */
  debug(message, context = {}) {
    if (this.shouldLog('debug')) {
      this.logger.debug(context, message);
    }
  }

  /**
   * Info level log
   * @param {string} message - Message to log
   * @param {Object} [context] - Additional context to log
   */
  info(message, context = {}) {
    if (this.shouldLog('info')) {
      this.logger.info(context, message);
    }
  }

  /**
   * Warning level log
   * @param {string} message - Message to log
   * @param {Object} [context] - Additional context to log
   */
  warn(message, context = {}) {
    if (this.shouldLog('warn')) {
      this.logger.warn(context, message);
    }
  }

  /**
   * Error level log
   * @param {string} message - Message to log
   * @param {Object} [context] - Additional context to log
   */
  error(message, context = {}) {
    if (this.shouldLog('error')) {
      this.logger.error(context, message);
    }
  }

  /**
   * Determines if a message should be logged based on the configured level
   * @param {string} level - Log level to check
   * @returns {boolean} true if the message should be logged, false otherwise
   */
  shouldLog(level) {
    if (this.level === 'silent') return false;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.level);
    const targetLevelIndex = levels.indexOf(level);
    
    return targetLevelIndex >= currentLevelIndex;
  }

  /**
   * Crea una nueva instancia del logger con un prefijo adicional
   * @param {string} prefix - Prefijo adicional para los mensajes
   * @returns {Logger} Nueva instancia del logger
   */
  child(prefix) {
    return new Logger(this.level, this.prefix ? `${this.prefix}:${prefix}` : prefix);
  }
}

export default Logger; 