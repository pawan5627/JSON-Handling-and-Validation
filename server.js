import express from "express";
import bodyParser from "body-parser";
import Ajv from "ajv";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import client from "./redisClient.js";

const app = express();
app.use(bodyParser.json());

// ---------- Load JSON Schema ----------
const schema = JSON.parse(fs.readFileSync("./schema.json", "utf8"));
const ajv = new Ajv({ allErrors: true });

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

app.use(verifyGoogleToken);

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

  await client.set(id, JSON.stringify(plan));
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

  res.set("ETag", etag).json(obj);
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
  const newEtag = genETag(merged);
  res.set("ETag", newEtag).json(merged);
});

// DELETE
app.delete("/plans/:id", async (req, res) => {
  const del = await client.del(req.params.id);
  if (!del) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
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

// ---------- Server ----------
app.get("/", (req, res) => res.send("Demo 2 API running ✅ (use /plans endpoints)"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
