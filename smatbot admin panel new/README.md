# SmatBot admin panel

SmatBot's staff panel: clients, renewals, coupons and the team. It's a separate app from the customer
dashboard (the ChatFlow app in the folder above). It has no server of its own: every call goes to
the billing API (`/api/billing/admin/*`, in `backend/src/billing/adminApi.ts`), which checks each
staff member's sign-in and role.

## Run it locally

1. Start the dashboard first (`npm run dev` in the folder above, port 5173). In development its
   dev server answers `/api/billing`.
2. Here: `npm install`, then `npm run dev`, and open http://localhost:5174.

Sign in with the owner login (`BILLING_ADMIN_EMAIL` / `BILLING_ADMIN_PASSWORD` in the dashboard's
`.env.local`) or an employee account added under Team.

## Settings

| Variable | Where | Default | What |
|---|---|---|---|
| `VITE_API_BASE_URL` | this app | `/api` (proxied to 5173 in dev) | The billing API in production |
| `VITE_DASHBOARD_URL` | this app | `http://localhost:5173` | Where "Log in as customer" opens |
| `VITE_ADMIN_URL` | the dashboard | `http://localhost:5174` | Where "Back to admin" goes |

## Log in as customer

The panel asks the server for a 2-minute signed ticket (written to the activity log) and opens the
dashboard's `/staff-login#ticket=…`. The dashboard swaps the ticket for the customer and opens their
dashboard with a "Back to admin" banner. A ticket can't be used as a staff session, nor the other way round.

In production, if this panel and the API are on different domains, the API must allow this panel's
origin (CORS), or serve both behind one domain.
