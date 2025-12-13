import React, { useState, useEffect } from "react";
import axios from "axios";
import PlanList from "./components/PlanList";
import PlanForm from "./components/PlanForm";
import RabbitEvents from "./components/RabbitEvents";
import RabbitDashboard from "./components/RabbitDashboard";

function App() {
  const [token, setToken] = useState(null);
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);

  // Google Auth button
  useEffect(() => {
    window.google.accounts.id.initialize({
      client_id: "222590128873-3tkgkcrvilv6ms03hnf7tei731eoiisc.apps.googleusercontent.com", // replace with your client ID
      callback: (response) => setToken(response.credential),
    });
    window.google.accounts.id.renderButton(document.getElementById("googleSignIn"), {
      theme: "outline",
      size: "large",
    });
  }, []);

  // Fetch plans from backend
  const fetchPlans = () => {
    if (token) {
      axios
        .get("http://localhost:3000/plans", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setPlans(Array.isArray(res.data) ? res.data : [res.data]))
        .catch(err => console.error(err));
    }
  };

  useEffect(() => { fetchPlans(); }, [token]);

  if (!token) return <div id="googleSignIn"></div>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Plans Dashboard</h1>
      <button onClick={() => setEditingPlan({})}>Add Plan</button>
      {editingPlan && (
        <PlanForm
          token={token}
          plan={editingPlan}
          onClose={() => { setEditingPlan(null); fetchPlans(); }}
        />
      )}
      <PlanList plans={plans} onEdit={setEditingPlan} token={token} refresh={fetchPlans} />
      <RabbitEvents />
      <RabbitDashboard />
    </div>
  );
}

export default App;
