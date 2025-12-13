import React, { useEffect, useState } from "react";

function RabbitEvents() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    const es = new EventSource("http://localhost:3000/events");
    es.onmessage = (e) => {
      try {
        const obj = JSON.parse(e.data);
        setEvents(prev => [obj, ...prev].slice(0, 100));
      } catch (err) {
        console.error("Failed to parse SSE event", err);
      }
    };
    es.onerror = (err) => {
      console.error("SSE error", err);
      // keep the connection open; browser will retry by default
    };
    return () => es.close();
  }, []);

  return (
    <div style={{ border: "1px solid #ddd", padding: "10px", marginTop: "20px" }}>
      <h3>Live Events (RabbitMQ)</h3>
      {events.length === 0 && <div>No events yet</div>}
      <ul style={{ maxHeight: 300, overflow: "auto" }}>
        {events.map((ev, idx) => (
          <li key={idx} style={{ fontFamily: "monospace", fontSize: 12 }}>
            <strong>{ev.type}</strong> — {JSON.stringify(ev.payload)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RabbitEvents;
