import { Client } from "@elastic/elasticsearch";

const esClient = new Client({ node: "http://localhost:9200" });

esClient.ping()
  .then(() => console.log(" Connected to Elasticsearch"))
  .catch((err) => console.error(" Elasticsearch connection error:", err));

export default esClient;
