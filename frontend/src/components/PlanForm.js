import React, { useState } from "react";
import axios from "axios";

function PlanForm({ fetchPlans }) {
  const [plan, setPlan] = useState({
    _org: "example.com",
    objectId: "",
    objectType: "plan",
    planType: "inNetwork",
    creationDate: new Date().toISOString(),
    planCostShares: {
      _org: "example.com",
      objectId: "",
      objectType: "membercostshare",
      deductible: 0,
      copay: 0,
    },
    linkedPlanServices: [
      {
        _org: "example.com",
        objectId: "",
        objectType: "planservice",
        linkedService: {
          _org: "example.com",
          objectId: "",
          objectType: "service",
          name: "",
        },
        planserviceCostShares: {
          _org: "example.com",
          objectId: "",
          objectType: "planservicecostshare",
          deductible: 0,
          copay: 0,
        },
      },
    ],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:3000/plans", plan);
      alert("Plan added!");
      fetchPlans();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.errors || err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ margin: "20px 0" }}>
      <h2>Add Plan</h2>
      <input
        placeholder="Plan ID"
        value={plan.objectId}
        onChange={(e) => setPlan({ ...plan, objectId: e.target.value })}
        required
      />
      <br />
      <input
        type="number"
        placeholder="Deductible"
        value={plan.planCostShares.deductible}
        onChange={(e) =>
          setPlan({
            ...plan,
            planCostShares: {
              ...plan.planCostShares,
              deductible: parseInt(e.target.value),
            },
          })
        }
        required
      />
      <input
        type="number"
        placeholder="Copay"
        value={plan.planCostShares.copay}
        onChange={(e) =>
          setPlan({
            ...plan,
            planCostShares: {
              ...plan.planCostShares,
              copay: parseInt(e.target.value),
            },
          })
        }
        required
      />
      <br />
      <input
        placeholder="Linked Service Name"
        value={plan.linkedPlanServices[0].linkedService.name}
        onChange={(e) => {
          const newLinked = [...plan.linkedPlanServices];
          newLinked[0].linkedService.name = e.target.value;
          setPlan({ ...plan, linkedPlanServices: newLinked });
        }}
        required
      />
      <button type="submit">Save Plan</button>
    </form>
  );
}

export default PlanForm;
