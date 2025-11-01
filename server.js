import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import Ajv from "ajv";
import fs from "fs";
import client from "./redisClient.js";

const app = express();
const PORT = 3000;

app.use(bodyParser.json({ limit: "5mb" }));

// Load JSON Schema
const schema = JSON.parse(fs.readFileSync("./schema.json", "utf-8"));
const ajv = new Ajv({ allErrors: true, strict: true });

// Compile schema once
const validate = ajv.compile(schema);

// Utility: generate MD5 ETag
function generateETag(jsonStr) {
  return crypto.createHash("md5").update(jsonStr).digest("hex");
}

// --------------------------- POST /plan ---------------------------
app.post("/plan", async (req, res) => {
  const data = req.body;

  // Validate JSON against schema
  const valid = validate(data);
  if (!valid) {
    return res.status(400).json({
      errors: validate.errors.map((err) => ({
        path: err.instancePath || "(root)",
        message: err.message,
      })),
    });
  }

  const id = data.objectId;
  const jsonStr = JSON.stringify(data);
  const etag = generateETag(jsonStr);

  // Save in Redis
  await client.set(id, jsonStr);

  res.setHeader("ETag", etag);
  return res.status(201).json(data);
});

// --------------------------- GET /plan/:id ---------------------------
app.get("/plan/:id", async (req, res) => {
  const { id } = req.params;
  const ifNoneMatch = req.headers["if-none-match"];

  const data = await client.get(id);
  if (!data) {
    return res.status(404).json({ error: "Not found" });
  }

  const etag = generateETag(data);

  if (ifNoneMatch && ifNoneMatch === etag) {
    return res.status(304).end();
  }

  res.setHeader("ETag", etag);
  return res.status(200).send(data);
});

// --------------------------- GET /plan ---------------------------
app.get("/plan", async (req, res) => {
  const keys = await client.keys("*");
  const allPlans = [];
  for (const key of keys) {
    const plan = await client.get(key);
    allPlans.push(JSON.parse(plan));
  }
  res.json(allPlans);
});

// --------------------------- DELETE /plan/:id ---------------------------
app.delete("/plan/:id", async (req, res) => {
  const { id } = req.params;

  const exists = await client.exists(id);
  if (!exists) {
    return res.status(404).json({ error: "Not found" });
  }

  await client.del(id);
  return res.status(204).end();
});

// --------------------------- Start Server ---------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
