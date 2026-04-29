const { fork } = require("child_process");
const path = require("path");
const RedisQueue = require("./shared/redisQueue");

const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random().toString(36).slice(2, 8)}`;
const redisQueue = new RedisQueue(WORKER_ID);

const activePeers = new Map(); // peerId -> childProcess

console.log(`[${WORKER_ID}] Daemon started. Connecting to Redis...`);

// 1. Send heartbeats every 5 seconds
setInterval(() => {
  redisQueue.sendHeartbeat().catch(err => console.error(`[${WORKER_ID}] Heartbeat error:`, err));
}, 5000);

// 2. Listen for STOP commands from Orchestrator
redisQueue.subscribe("worker:commands", async msg => {
  if (msg.type === "STOP_PEER" && msg.workerId === WORKER_ID) {
    console.log(`[${WORKER_ID}] Received command to stop peer ${msg.peerId}`);
    const child = activePeers.get(msg.peerId);
    if (child) {
      child.send({ type: "STOP" });
      activePeers.delete(msg.peerId);
      await redisQueue.unregisterTask(WORKER_ID, msg.peerId);
      await redisQueue.publish("worker:events", { type: "STOPPED", peerId: msg.peerId, workerId: WORKER_ID });
    }
  }
});

// 3. Process task queue
async function processQueue() {
  console.log(`[${WORKER_ID}] Waiting for tasks...`);
  while (true) {
    try {
      // popTask blocks until a task is available
      const task = await redisQueue.popTask();
      if (task) {
        console.log(`[${WORKER_ID}] Picked up task for peer ${task.peerId}`);
        await handleTask(task);
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] Error processing queue:`, err);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function handleTask(config) {
  const peerId = config.peerId;
  
  // Register the task to this worker in Redis
  await redisQueue.registerActiveTask(WORKER_ID, config);

  const worker = fork(path.join(__dirname, "worker.js"), [], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });

  worker.stdout.on("data", d => process.stdout.write(`[${WORKER_ID}|${peerId.slice(0, 6)}] ${d}`));
  worker.stderr.on("data", d => process.stderr.write(`[${WORKER_ID}|${peerId.slice(0, 6)}] ${d}`));

  activePeers.set(peerId, worker);

  worker.on("message", async msg => {
    // Proxy messages from child process to Redis
    msg.workerId = WORKER_ID;
    
    // We can also let the UI know via worker:events
    await redisQueue.publish("worker:events", msg);
  });

  worker.on("exit", async code => {
    console.log(`[${WORKER_ID}] Worker process ${peerId} exited with code ${code}`);
    activePeers.delete(peerId);
    await redisQueue.unregisterTask(WORKER_ID, peerId);
    await redisQueue.publish("worker:events", { type: "EXITED", peerId, workerId: WORKER_ID });
  });

  // Start the actual peer logic
  worker.send({ type: "START", config });
}

// Start processing
processQueue();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(`\n[${WORKER_ID}] Shutting down...`);
  for (const [id, worker] of activePeers.entries()) {
    try { worker.kill(); } catch {}
  }
  try { redisQueue.disconnect(); } catch {}
  process.exit(0);
});
