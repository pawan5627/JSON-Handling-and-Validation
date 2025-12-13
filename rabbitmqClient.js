import amqplib from "amqplib";
import EventEmitter from "events";

let channel = null;
let connection = null;
const QUEUE_NAME = process.env.RABBITMQ_QUEUE || "plan-events";
const RABBIT_URL = process.env.RABBITMQ_URL || "amqp://localhost";

const emitter = new EventEmitter();

async function connect() {
  if (channel) return channel;
  connection = await amqplib.connect(RABBIT_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  console.log("✅ Connected to RabbitMQ", RABBIT_URL);
  return channel;
}

async function publish(event) {
  const ch = await connect();
  const payload = Buffer.from(JSON.stringify(event));
  ch.sendToQueue(QUEUE_NAME, payload, { persistent: true });
  // also emit locally so SSE/web clients can get live events without another consumer
  try {
    emitter.emit("event", event);
  } catch (err) {
    console.warn("Emitter error", err);
  }
}

async function consume(onMessage) {
  const ch = await connect();
  await ch.consume(
    QUEUE_NAME,
    async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        await onMessage(content);
        ch.ack(msg);
      } catch (err) {
        console.error("Error processing message", err);
        // optionally send to a DLQ or nack
        ch.nack(msg, false, false);
      }
    },
    { noAck: false }
  );
}

export default { connect, publish, consume, QUEUE_NAME, emitter };
