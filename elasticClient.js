import { Client } from "@elastic/elasticsearch";

const esClient = new Client({
  node: "http://localhost:9200", 
  // HTTPS
  // auth: {
  //   username: "elastic", // default user, or your user
  //   password: "YOUR_PASSWORD_HERE" // replace with your elastic user password
  // },
  // tls: {
  //   rejectUnauthorized: false // ignore self-signed certs for local dev
  // }
});
const INDEX = process.env.ES_INDEX || "plans";

async function ensureIndex() {
  const exists = await esClient.indices.exists({ index: INDEX });
  if (exists) return;

  // Create index with join field for parent-child
  await esClient.indices.create({
    index: INDEX,
    body: {
      mappings: {
        properties: {
          join_field: { type: "join", relations: { plan: ["planservice", "service", "membercostshare"] } },
          linkedPlanServices: { type: "nested" },
          objectId: { type: "keyword" },
          objectType: { type: "keyword" },
          creationDate: { type: "date", ignore_malformed: true },
          planCostShares: {
            properties: {
              objectId: { type: "keyword" },
              objectType: { type: "keyword" },
              deductible: { type: "double" },
              copay: { type: "double" }
            }
          },
          linkedService: {
            properties: {
              objectId: { type: "keyword" },
              objectType: { type: "keyword" },
              name: { type: "text" }
            }
          },
          planserviceCostShares: {
            properties: {
              objectId: { type: "keyword" },
              objectType: { type: "keyword" },
              deductible: { type: "double" },
              copay: { type: "double" }
            }
          }
        }
      }
    }
  });
  console.log(`✅ Created index ${INDEX} with parent-child mapping`);
}

// Index a plan parent and its children as separate docs (children use routing)
async function indexPlanWithChildren(plan) {
  await ensureIndex();
  const id = plan.objectId;

  // index parent
  await esClient.index({
    index: INDEX,
    id,
    routing: id,
    document: {
      ...plan,
      join_field: { name: "plan" }
    }
  });

  // index children (planservice) separately
  if (Array.isArray(plan.linkedPlanServices)) {
    for (const svc of plan.linkedPlanServices) {
      // use child's objectId as id
      await esClient.index({
        index: INDEX,
        id: svc.objectId,
        routing: id,
        document: {
          ...svc,
          join_field: { name: "planservice", parent: id }
        }
      });

      // also index the linked service as a child doc
      if (svc.linkedService && svc.linkedService.objectId) {
        await esClient.index({
          index: INDEX,
          id: svc.linkedService.objectId,
          routing: id,
          document: {
            ...svc.linkedService,
            join_field: { name: "service", parent: id },
            parentPlanId: id,
            parentPlanServiceId: svc.objectId
          }
        });
      }

      // also index the planservice cost shares as a child doc
      if (svc.planserviceCostShares && svc.planserviceCostShares.objectId) {
        await esClient.index({
          index: INDEX,
          id: svc.planserviceCostShares.objectId,
          routing: id,
          document: {
            ...svc.planserviceCostShares,
            join_field: { name: "membercostshare", parent: id },
            parentPlanId: id,
            parentPlanServiceId: svc.objectId
          }
        });
      }
    }
  }

  // index the parent plan's cost shares as a child doc as well to reach 8 total docs
  if (plan.planCostShares && plan.planCostShares.objectId) {
    await esClient.index({
      index: INDEX,
      id: plan.planCostShares.objectId,
      routing: id,
      document: {
        ...plan.planCostShares,
        join_field: { name: "membercostshare", parent: id },
        parentPlanId: id
      }
    });
  }
  await esClient.indices.refresh({ index: INDEX });
}

// Update parent and children
async function updatePlanWithChildren(plan) {
  await ensureIndex();
  const id = plan.objectId;

  // update parent (doc) - use doc for partial update
  await esClient.update({
    index: INDEX,
    id,
    routing: id,
    doc: {
      ...plan,
      join_field: { name: "plan" }
    },
    doc_as_upsert: true
  });

  // refresh children: for simplicity, delete existing children for this parent then re-index
  await esClient.deleteByQuery({
    index: INDEX,
    routing: id,
    query: {
      bool: {
        should: [
          { parent_id: { type: "planservice", id } },
          { parent_id: { type: "service", id } },
          { parent_id: { type: "membercostshare", id } }
        ]
      }
    }
  });

  if (Array.isArray(plan.linkedPlanServices)) {
    for (const svc of plan.linkedPlanServices) {
      await esClient.index({
        index: INDEX,
        id: svc.objectId,
        routing: id,
        document: {
          ...svc,
          join_field: { name: "planservice", parent: id }
        }
      });

      if (svc.linkedService && svc.linkedService.objectId) {
        await esClient.index({
          index: INDEX,
          id: svc.linkedService.objectId,
          routing: id,
          document: {
            ...svc.linkedService,
            join_field: { name: "service", parent: id },
            parentPlanId: id,
            parentPlanServiceId: svc.objectId
          }
        });
      }

      if (svc.planserviceCostShares && svc.planserviceCostShares.objectId) {
        await esClient.index({
          index: INDEX,
          id: svc.planserviceCostShares.objectId,
          routing: id,
          document: {
            ...svc.planserviceCostShares,
            join_field: { name: "membercostshare", parent: id },
            parentPlanId: id,
            parentPlanServiceId: svc.objectId
          }
        });
      }
    }
  }

  if (plan.planCostShares && plan.planCostShares.objectId) {
    await esClient.index({
      index: INDEX,
      id: plan.planCostShares.objectId,
      routing: id,
      document: {
        ...plan.planCostShares,
        join_field: { name: "membercostshare", parent: id },
        parentPlanId: id
      }
    });
  }
  await esClient.indices.refresh({ index: INDEX });
}

// Cascaded delete: delete children then parent
async function deletePlanCascade(id) {
  await ensureIndex();
  // delete children
  await esClient.deleteByQuery({
    index: INDEX,
    routing: id,
    query: {
      bool: {
        should: [
          { parent_id: { type: "planservice", id } },
          { parent_id: { type: "service", id } },
          { parent_id: { type: "membercostshare", id } }
        ]
      }
    }
  });

  // delete parent
  await esClient.delete({ index: INDEX, id, routing: id, ignore_unavailable: true });
  await esClient.indices.refresh({ index: INDEX });
}

export default {
  client: esClient,
  ensureIndex,
  indexPlanWithChildren,
  updatePlanWithChildren,
  deletePlanCascade
};