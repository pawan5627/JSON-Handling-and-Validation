import React, { useEffect, useState } from "react";
import axios from "axios";

function PlanViewer() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get("http://localhost:3000/plans/search/Yearly physical", {
        headers: {
          Authorization: "Bearer YOUR_GOOGLE_TOKEN" // Replace with a valid token
        }
      });
      setPlans(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Plans</h1>
      {plans.length === 0 ? <p>No plans found</p> : (
        <ul>
          {plans.map(plan => (
            <li key={plan.objectId}>
              <strong>{plan.objectId}</strong>: {plan.planType}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PlanViewer;
