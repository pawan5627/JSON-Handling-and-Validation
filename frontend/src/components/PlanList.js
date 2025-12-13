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
            <button
              onClick={async () => {
                // Simple demo patch: increment first linked service copay by 1
                if (!plan.linkedPlanServices || plan.linkedPlanServices.length === 0) return;
                const updated = { ...plan };
                updated.linkedPlanServices = updated.linkedPlanServices.map((s, idx) => {
                  if (idx === 0) {
                    return {
                      ...s,
                      planserviceCostShares: {
                        ...s.planserviceCostShares,
                        copay: (s.planserviceCostShares.copay || 0) + 1
                      }
                    };
                  }
                  return s;
                });

                try {
                  const res = await fetch(`/plans/${plan.objectId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updated)
                  });
                  if (res.ok) {
                    window.location.reload();
                  } else {
                    const err = await res.json();
                    alert("Patch failed: " + JSON.stringify(err));
                  }
                } catch (err) {
                  console.error(err);
                  alert("Network error");
                }
              }}
            >
              Quick Patch (inc copay)
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlanList;
