const API_BASE = "http://localhost:3000"; // your backend

export async function fetchPlans() {
  const res = await fetch(`${API_BASE}/plans`);
  return res.json();
}

export async function addPlan(plan) {
  const res = await fetch(`${API_BASE}/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  return res.json();
}
