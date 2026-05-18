const { createClient } = require('redis');

let redisClient = null;
let isMock = false;

// Custom In-Memory Mock client that resembles Redis v4 interface
class InMemoryMockRedis {
  constructor() {
    this.store = new Map();
    this.timeouts = new Map();
    this.isMock = true;
    console.log('💾 [Redis Cache] Initialized high-fidelity In-Memory Cache fallback.');
  }

  async connect() {
    return this;
  }

  async get(key) {
    const val = this.store.get(key);
    return val !== undefined ? val : null;
  }

  async set(key, value, options) {
    this.store.set(key, value);
    
    // Handle expiration (EX)
    if (options && options.EX) {
      if (this.timeouts.has(key)) {
        clearTimeout(this.timeouts.get(key));
      }
      const timeout = setTimeout(() => {
        this.store.delete(key);
        this.timeouts.delete(key);
        console.log(`💾 [Redis Cache] In-Memory key "${key}" expired.`);
      }, options.EX * 1000);
      this.timeouts.set(key, timeout);
    }
    return 'OK';
  }

  async del(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async quit() {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.store.clear();
    this.timeouts.clear();
  }
}

async function initRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  console.log(`⚡ [Redis Cache] Attempting to connect to Redis server at ${redisUrl}...`);
  
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 1500, // Fail quickly to avoid blocking startup
      reconnectStrategy: (retries) => {
        if (retries > 0) {
          // Immediately fail and trigger the error fallback
          return new Error('Redis connection failed');
        }
        return 200;
      }
    }
  });

  client.on('error', (err) => {
    if (!isMock && !redisClient) {
      console.warn('⚠️ [Redis Cache] Real Redis connection error. Switching to In-Memory cache...');
      isMock = true;
      redisClient = new InMemoryMockRedis();
    }
  });

  try {
    await client.connect();
    console.log('⚡ [Redis Cache] Connected to REAL Redis server successfully.');
    redisClient = client;
    redisClient.isMock = false;
    isMock = false;
  } catch (err) {
    console.warn('⚠️ [Redis Cache] Real Redis server connection failed. Switching to In-Memory cache...');
    isMock = true;
    redisClient = new InMemoryMockRedis();
  }
}

// Start connection attempt immediately
initRedis();

module.exports = {
  getRedisClient: () => redisClient,
  isMock: () => isMock
};
