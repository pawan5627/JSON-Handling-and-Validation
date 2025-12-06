import React from "react";

export default function PlanCard({ plan }) {
  return (
    <div style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "10px" }}>
      <h3>{plan.objectId} - {plan.planType}</h3>
      <p>Cost Shares: Deductible {plan.planCostShares.deductible}, Copay {plan.planCostShares.copay}</p>
      {plan.linkedPlanServices.map((service, idx) => (
        <div key={idx} style={{ marginLeft: "20px", borderLeft: "2px solid #999", paddingLeft: "10px" }}>
          <p>Service: {service.linkedService.name}</p>
          <p>Deductible: {service.planserviceCostShares.deductible}, Copay: {service.planserviceCostShares.copay}</p>
        </div>
      ))}
    </div>
  );
}
