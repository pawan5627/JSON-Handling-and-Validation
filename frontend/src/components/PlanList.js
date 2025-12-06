import React from "react";

function PlanList({ plans }) {
  if (!plans || plans.length === 0) return <p>No plans found</p>;

  return (
    <div>
      <h2>Existing Plans</h2>
      <ul>
        {plans.map((plan) => (
          <li key={plan.objectId}>
            <strong>{plan.objectId}</strong> - {plan.planType} -{" "}
            {plan.creationDate}
            <ul>
              {plan.linkedPlanServices.map((svc) => (
                <li key={svc.objectId}>
                  {svc.linkedService.name} | Copay: {svc.planserviceCostShares.copay} | Deductible: {svc.planserviceCostShares.deductible}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlanList;
