# RabbitMQ message-rate helper

This project includes small helper scripts to generate RabbitMQ messages so you can observe the message publish/deliver rate graphs in the RabbitMQ management UI (http://localhost:15672).

Files added

- `scripts/publish.js` — a simple publisher that sends messages at a configurable rate.
- `scripts/consume.js` — a simple consumer that reads messages and logs per-second counts.
- `package.json` — updated with npm scripts `rabbit:publish` and `rabbit:consume`.

Quick usage

1. Start RabbitMQ (already running on this machine):

   sudo systemctl start rabbitmq-server

2. Open the management UI in your browser:

   http://localhost:15672/

   Default guest/guest works from localhost only. Go to the "Queues" tab and open the queue named `plan-events` (or set `RABBITMQ_QUEUE` env var to another name).

3. Start a consumer (optional) to observe deliver rates:

```bash
npm run rabbit:consume
```

4. Start the publisher. Examples:

- Send 100 messages at 50 msgs/sec:

```bash
RABBIT_RATE=50 RABBIT_COUNT=100 npm run rabbit:publish
```

- Run continuously at 20 msgs/sec:

```bash
RABBIT_RATE=20 npm run rabbit:publish
```

Customization

- `RABBIT_RATE` — messages per second (default 10)
- `RABBIT_COUNT` — total messages to send (default: run indefinitely)
- `RABBITMQ_QUEUE` — queue name (default `plan-events`)
- `RABBITMQ_URL` — AMQP URL (default `amqp://localhost`)

What to watch in management UI

- In the queue's detail page you will see graphs for:
  - Publish rate (messages/sec)
  - Deliver rate (messages/sec)
  - A simple histogram of ready/unacked messages

Generating traffic this way will cause the publish/deliver graphs to show real-time activity.

If you'd like, I can also:

- Add an HTTP endpoint to `server.js` that toggles the publisher on/off so you can control traffic from the web UI.
- Produce messages with real records from `schema.json` instead of sample payloads.

