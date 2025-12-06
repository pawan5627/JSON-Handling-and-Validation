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
export default esClient;