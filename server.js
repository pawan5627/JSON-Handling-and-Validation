import express from "express";
import bodyParser from "body-parser";
import Ajv from "ajv";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import client from "./redisClient.js";
import esClient from "./elasticClient.js";
import rabbit from "./rabbitmqClient.js";
import protobuf from "protobufjs";
import cors from "cors";
import addFormats from "ajv-formats";

  // <-- this enables 'date-time', 'email', etc.



const app = express();
app.use(bodyParser.json({ limit: "5mb" }));
app.use(cors()); // allow all origins for development
// ---------- Load JSON Schema ----------
const schema = JSON.parse(fs.readFileSync("./schema.json", "utf8"));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// ---------- Server-Sent Events for live RabbitMQ events (public)
app.get("/events", (req, res) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders && res.flushHeaders();

  const send = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      console.error("SSE write error", err);
    }
  };

  // send a ping so client knows it's connected
  res.write(`: connected\n\n`);

  rabbit.emitter.on("event", send);

  req.on("close", () => {
    rabbit.emitter.off("event", send);
  });
});

// Load plan.proto
const root = await protobuf.load("./plan.proto");
const PlanMessage = root.lookupType("Plan");

// ---------- Google JWT Verification ----------
const jwks = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
  cache: true,
  rateLimit: true
});

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyGoogleToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }
  const token = auth.split(" ")[1];
  jwt.verify(token, getKey, { algorithms: ["RS256"], issuer: "https://accounts.google.com" }, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token", detail: err.message });
    req.user = decoded;
    next();
  });
}

if (process.env.SKIP_AUTH === "true") {
  console.warn("⚠️ Skipping JWT verification because SKIP_AUTH=true");
} else {
  app.use(verifyGoogleToken);
}

// ---------- Utility ----------
function genETag(obj) {
  return crypto.createHash("md5").update(JSON.stringify(obj)).digest("hex");
}

// ---------- CRUD + PATCH ----------

// CREATE
app.post("/plans", async (req, res) => {
  const plan = req.body;
  const validate = ajv.compile(schema);
  const valid = validate(plan);
  if (!valid) return res.status(400).json({ errors: validate.errors });

  const id = plan.objectId;
  const exists = await client.exists(id);
  if (exists) return res.status(409).json({ error: "Already exists" });

  // Save in Redis with type namespaces to avoid key collisions (e.g., plan and its cost share sharing the same objectId)
  await client.set(`plan:${id}`, JSON.stringify(plan));
  // Save in Redis: explode into 7 child docs to total 8 entries
  if (plan.planCostShares && plan.planCostShares.objectId) {
    await client.set(`membercostshare:${plan.planCostShares.objectId}`, JSON.stringify({
      ...plan.planCostShares,
      parentPlanId: id
    }));
  }
  if (Array.isArray(plan.linkedPlanServices)) {
    for (const svc of plan.linkedPlanServices) {
      if (svc.objectId) {
        await client.set(`planservice:${svc.objectId}`, JSON.stringify({ ...svc, parentPlanId: id }));
      }
      if (svc.linkedService && svc.linkedService.objectId) {
        await client.set(`service:${svc.linkedService.objectId}`, JSON.stringify({
          ...svc.linkedService,
          parentPlanId: id,
          parentPlanServiceId: svc.objectId
        }));
      }
      if (svc.planserviceCostShares && svc.planserviceCostShares.objectId) {
        await client.set(`membercostshare:${svc.planserviceCostShares.objectId}`, JSON.stringify({
          ...svc.planserviceCostShares,
          parentPlanId: id,
          parentPlanServiceId: svc.objectId
        }));
      }
    }
  }

  // Publish event to RabbitMQ for indexing (consumer will update ES)
  await rabbit.publish({ type: "create", payload: plan });

  const etag = genETag(plan);
  res.set("ETag", etag).status(201).json(plan);
});

// READ with If-None-Match
app.get("/plans/:id", async (req, res) => {
  const data = await client.get(req.params.id);
  if (!data) return res.status(404).json({ error: "Not found" });
  const obj = JSON.parse(data);
  const etag = genETag(obj);

  if (req.headers["if-none-match"] === etag) return res.status(304).end();

  res.set("ETag", etag);

  // Check if client wants protobuf
  if (req.headers["accept"] === "application/x-protobuf") {
    const message = PlanMessage.create(obj);
    const buffer = PlanMessage.encode(message).finish();
    res.setHeader("Content-Type", "application/x-protobuf");
    return res.send(buffer);
  }

  res.json(obj);
});

// PUT (replace)
app.put("/plans/:id", async (req, res) => {
  const id = req.params.id;
  const existingRaw = await client.get(id);
  if (!existingRaw) return res.status(404).json({ error: "Not found" });
  const existing = JSON.parse(existingRaw);

  const ifMatch = req.headers["if-match"];
  if (ifMatch && ifMatch !== genETag(existing)) {
    return res.status(412).json({ error: "ETag mismatch" });
  }

  const validate = ajv.compile(schema);
  const valid = validate(req.body);
  if (!valid) return res.status(400).json({ errors: validate.errors });

  await client.set(id, JSON.stringify(req.body));

  // Publish update event to RabbitMQ (consumer will update ES)
  await rabbit.publish({ type: "update", payload: req.body });

  const newEtag = genETag(req.body);
  res.set("ETag", newEtag).json(req.body);
});

// PATCH (merge)
app.patch("/plans/:id", async (req, res) => {
  const id = req.params.id;
  const existingRaw = await client.get(id);
  if (!existingRaw) return res.status(404).json({ error: "Not found" });

  const existing = JSON.parse(existingRaw);
  const ifMatch = req.headers["if-match"];
  if (ifMatch && ifMatch !== genETag(existing)) {
    return res.status(412).json({ error: "ETag mismatch" });
  }

  const merged = { ...existing, ...req.body };
  const validate = ajv.compile(schema);
  const valid = validate(merged);
  if (!valid) return res.status(400).json({ errors: validate.errors });

  await client.set(id, JSON.stringify(merged));

  // Publish patch/merge event to RabbitMQ to update ES
  await rabbit.publish({ type: "patch", payload: merged });

  const newEtag = genETag(merged);
  res.set("ETag", newEtag).json(merged);
});

// DELETE
app.delete("/plans/:id", async (req, res) => {
  const del = await client.del(req.params.id);
  if (!del) return res.status(404).json({ error: "Not found" });

  // Publish delete event to RabbitMQ (consumer will delete from ES cascade)
  await rabbit.publish({ type: "delete", payload: { objectId: req.params.id } });

  res.status(204).end();
});

// ---------- Optional Search: Parent-Child ----------
app.get("/plans/search/:serviceName", async (req, res) => {
  const { serviceName } = req.params;
  const result = await esClient.client.search({
    index: "plans",
    query: {
      nested: {
        path: "linkedPlanServices",
        query: {
          match: { "linkedPlanServices.linkedService.name": serviceName }
        }
      }
    }
  });
  res.json(result.hits.hits.map(hit => hit._source));
});

// ---------- ES proxy helpers for demo ----------
// Delete-by-query (match_all) on plans index
app.post("/es/plans/_delete_by_query", async (req, res) => {
  try {
    const body = req.body && Object.keys(req.body).length ? req.body : { query: { match_all: {} } };
    const resp = await esClient.client.deleteByQuery({ index: "plans", body });
    res.json(resp);
  } catch (err) {
    res.status(500).json({ error: "delete_by_query failed", detail: err.message });
  }
});

// Search (match_all) on plans index
app.get("/es/plans/_search", async (req, res) => {
  try {
    const body = req.body && Object.keys(req.body).length ? req.body : { query: { match_all: {} } };
    const resp = await esClient.client.search({ index: "plans", ...body });
    res.json(resp.hits);
  } catch (err) {
    res.status(500).json({ error: "search failed", detail: err.message });
  }
});

// ---------- Conditional Example ----------
app.get("/plans/:id/conditional", async (req, res) => {
  const data = await client.get(req.params.id);
  if (!data) return res.status(404).json({ error: "Not found" });
  const obj = JSON.parse(data);

  if (req.query.requireType && obj.objectType !== req.query.requireType) {
    return res.status(412).json({ error: "Condition not met" });
  }

  res.json(obj);
});

// ---------- Root ----------
app.get("/", (req, res) => res.send("Demo 2 + Phase 2 API running ✅ (use /plans endpoints)"));

const PORT = process.env.PORT || 3000;
// Start consumer to process indexing events from RabbitMQ
async function startConsumer() {
  try {
    // ensure index exists before consuming
    await esClient.ensureIndex();

    await rabbit.consume(async (event) => {
      console.log("📥 Received event", event.type);
      try {
        switch (event.type) {
          case "create":
            await esClient.indexPlanWithChildren(event.payload);
            break;
          case "update":
          case "patch":
            await esClient.updatePlanWithChildren(event.payload);
            break;
          case "delete":
            await esClient.deletePlanCascade(event.payload.objectId);
            break;
          default:
            console.warn("Unknown event type", event.type);
        }
      } catch (err) {
        console.error("Error handling event", err);
        throw err;
      }
    });
  } catch (err) {
    console.error("Failed to start RabbitMQ consumer", err);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  // start background consumer
  await startConsumer();
});
