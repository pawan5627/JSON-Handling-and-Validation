import React from "react";

function RabbitDashboard() {
  return (
    <div style={{ border: "1px solid #eee", padding: 12, marginTop: 12 }}>
      <h3>RabbitMQ Dashboard</h3>
      <p style={{ margin: 0 }}>Open the RabbitMQ management UI to inspect queues, messages and exchanges.</p>
      <p style={{ marginTop: 8 }}>Default local URL: <a href="http://localhost:15672" target="_blank" rel="noreferrer">http://localhost:15672</a></p>
      <p style={{ marginTop: 4, fontSize: 13 }}><strong>Default credentials:</strong> <code>guest</code> / <code>guest</code> (only for local demos)</p>
      <button
        onClick={() => window.open("http://localhost:15672", "_blank")}
        style={{ marginTop: 8, padding: "6px 10px" }}
      >
        Open RabbitMQ Dashboard
      </button>
    </div>
  );
}

export default RabbitDashboard;
