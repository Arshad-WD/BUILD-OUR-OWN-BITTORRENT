const Redis = require("ioredis");

// Connection options — use REDIS_URL from environment or fallback to localhost
const REDIS_OPTIONS = process.env.REDIS_URL || { host: "localhost", port: 6379 };

class RedisQueue {
  constructor(nodeId = "orchestrator") {
    this.nodeId = nodeId;
    // We need separate clients for normal commands, pub, and sub
    this.client = new Redis(REDIS_OPTIONS);
    this.pub = new Redis(REDIS_OPTIONS);
    this.sub = new Redis(REDIS_OPTIONS);

    // Track active subscriptions
    this.subscriptions = new Map();

    this.sub.on("message", (channel, message) => {
      try {
        const parsed = JSON.parse(message);
        if (this.subscriptions.has(channel)) {
          this.subscriptions.get(channel)(parsed);
        }
      } catch (err) {
        console.error(`[RedisQueue] Error parsing message on ${channel}`, err);
      }
    });

    this.client.on("error", err => console.error("[RedisQueue] Client error", err));
  }

  // ─── TASK QUEUE (WORKER ASSIGNMENT) ──────────

  /**
   * Pushes a task to the shared worker queue
   * @param {Object} task The task config
   */
  async pushTask(task) {
    const payload = JSON.stringify(task);
    await this.client.rpush("worker:queue", payload);
  }

  /**
   * Blocks and waits for the next task from the worker queue
   * @param {number} timeout Seconds to wait (0 for infinite)
   * @returns {Object|null} The parsed task
   */
  async popTask(timeout = 0) {
    // blpop returns [queueName, value]
    const result = await this.client.blpop("worker:queue", timeout);
    if (!result) return null;
    return JSON.parse(result[1]);
  }

  // ─── PUB/SUB (MESSAGING & STATS) ─────────────

  async publish(channel, message) {
    await this.pub.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel, callback) {
    this.subscriptions.set(channel, callback);
    await this.sub.subscribe(channel);
  }

  async unsubscribe(channel) {
    this.subscriptions.delete(channel);
    await this.sub.unsubscribe(channel);
  }

  // ─── HEARTBEAT & FAILURES ────────────────────

  /**
   * Worker nodes call this to report they are alive
   */
  async sendHeartbeat() {
    await this.client.set(`worker:heartbeat:${this.nodeId}`, Date.now(), "EX", 10);
  }

  /**
   * Retrieves all active workers and dead workers
   * @param {number} thresholdMs Milliseconds before considering dead
   */
  async getWorkersHealth(thresholdMs = 15000) {
    const keys = await this.client.keys("worker:heartbeat:*");
    const active = [];
    const dead = [];
    const now = Date.now();

    for (const key of keys) {
      const id = key.split(":")[2];
      const lastSeen = parseInt(await this.client.get(key), 10);
      
      if (now - lastSeen > thresholdMs) {
        dead.push(id);
      } else {
        active.push(id);
      }
    }

    return { active, dead };
  }

  /**
   * Register that a worker is handling a specific peerId/torrent
   */
  async registerActiveTask(workerId, taskConfig) {
    await this.client.hset(`worker:tasks:${workerId}`, taskConfig.peerId, JSON.stringify(taskConfig));
  }

  /**
   * Unregister a task when it's done or stopped
   */
  async unregisterTask(workerId, peerId) {
    await this.client.hdel(`worker:tasks:${workerId}`, peerId);
  }

  /**
   * Gets all tasks assigned to a dead worker so they can be requeued
   */
  async getAndClearDeadWorkerTasks(workerId) {
    const tasksMap = await this.client.hgetall(`worker:tasks:${workerId}`);
    const tasks = Object.values(tasksMap).map(v => JSON.parse(v));
    
    // Clear the dead worker's state
    await this.client.del(`worker:tasks:${workerId}`);
    await this.client.del(`worker:heartbeat:${workerId}`);

    return tasks;
  }

  // ─── CLEANUP ─────────────────────────────────
  
  disconnect() {
    this.client.disconnect();
    this.pub.disconnect();
    this.sub.disconnect();
  }
}

module.exports = RedisQueue;
