# Meridian Order Management

Legacy order system for Meridian Medical Supply. Holds customers (clinics and
pharmacies across Pune, Mumbai and Bengaluru), their orders, and the shipments
that carry orders from warehouses. Shipments report carrier, cold-chain flag,
status (on_time / delayed / delivered / rerouted), promised date and delay reason.

Run: `uvicorn main:app --port 8101`
