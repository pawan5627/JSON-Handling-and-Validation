import rabbit from '../rabbitmqClient.js';

let received = 0;
let lastLog = Date.now();

async function onMessage(msg) {
  received++;
  const now = Date.now();
  if (now - lastLog >= 1000) {
    console.log(`received=${received}`);
    lastLog = now;
    received = 0;
  }
  // process message quickly (simulate)
}

async function start() {
  await rabbit.consume(onMessage);
  console.log('Consumer started, listening to queue:', rabbit.QUEUE_NAME);
}

start().catch(err => {
  console.error('Failed to start consumer', err);
  process.exit(1);
});
