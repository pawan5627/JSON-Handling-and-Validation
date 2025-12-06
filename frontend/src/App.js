import React, { useEffect, useState } from "react";
import axios from "axios";
import PlanCard from "./components/PlanCard";

function App() {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await axios.get("http://localhost:3000/plans"); // change port if your backend differs
        setPlans(res.data);
      } catch (err) {
        console.error("Error fetching plans:", err);
      }
    };

    fetchPlans();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Plans Viewer</h1>
      {plans.map(plan => (
        <PlanCard key={plan.objectId} plan={plan} />
      ))}
    </div>
  );
}

export default App;
