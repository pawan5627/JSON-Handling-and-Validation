import rabbit from '../rabbitmqClient.js';

const RATE = parseFloat(process.env.RABBIT_RATE || '10'); // messages per second
const COUNT = process.env.RABBIT_COUNT ? parseInt(process.env.RABBIT_COUNT, 10) : null; // total messages, null = endless
const QUEUE = process.env.RABBITMQ_QUEUE || rabbit.QUEUE_NAME || 'plan-events';

if (isNaN(RATE) || RATE <= 0) {
  console.error('Invalid RABBIT_RATE, must be > 0');
  process.exit(1);
}

const intervalMs = Math.max(1, Math.round(1000 / RATE));
let sent = 0;
let running = true;

console.log(`Starting publisher -> queue=${QUEUE} rate=${RATE} msgInterval=${intervalMs}ms count=${COUNT||'infinite'}`);

async function sendOne() {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    ts: new Date().toISOString(),
    type: 'plan-event',
    payload: {
      sampleValue: Math.floor(Math.random() * 1000),
      text: 'auto-generated sample event'
    }
  };

  try {
    await rabbit.publish(event);
    sent++;
    if (sent % Math.max(1, Math.floor(RATE)) === 0) {
      process.stdout.write(`sent=${sent}\r`);
    }

    if (COUNT && sent >= COUNT) {
      console.log(`\nReached target count=${COUNT}. Exiting.`);
      running = false;
      process.exit(0);
    }
  } catch (err) {
    console.error('Publish error', err);
  }
}

let timer = null;

async function start() {
  // ensure connection
  await rabbit.connect();
  timer = setInterval(() => {
    // fire-and-forget: don't await to keep steady rate
    if (!running) return;
    sendOne();
  }, intervalMs);
}

process.on('SIGINT', () => {
  console.log('\nInterrupted. Shutting down publisher...');
  running = false;
  if (timer) clearInterval(timer);
  setTimeout(() => process.exit(0), 200);
});

start().catch(err => {
  console.error('Failed to start publisher', err);
  process.exit(1);
});
