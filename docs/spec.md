# Nail Salon Management System — Spec & Plan (v1)

Date: 2026-10-25 · Status: first draft, open for feedback

## 1. Goal
A web app for salon staff to use every day: **see the floor plan, open a table for a customer, add services, choose the technician, take payment** — and for the owner to see a **revenue dashboard**.
Users are **non-technical**: big text, big buttons, few steps, plain English, one task per screen.

**Out of scope for v1 (noted for later):** appointments, customer profiles/loyalty, technician payroll/commission, real payment gateway (VietQR/Stripe), receipt printing, inventory, multiple branches.

## 2. Tech (my choices — open to change)
| Area | Choice | Notes |
|---|---|---|
| Frontend | Vite + React 18 + TypeScript | |
| UI | **shadcn/ui** + Tailwind CSS | larger text/buttons than the defaults |
| Sign-in | Clerk | native third-party auth with Supabase |
| Backend / DB | Supabase (Postgres + RLS) | no custom server |
| Data fetching | TanStack Query | |
| Charts | Recharts | |
| Router | React Router | |

## 3. Roles
| Role | Permissions |
|---|---|
| `admin` (Owner) | Everything: services, tables, staff & roles, dashboard, all bills |
| `receptionist` (Receptionist / Cashier) | Floor plan, open tables, add services, take payment, cancel bills; view dashboard |
| `technician` | View floor plan and open bills; cannot take payment or see revenue |
| `pending` | Just signed up, not yet approved — only sees "Waiting for owner approval" |

- `buitritinht@gmail.com` is **automatically `admin`** on first sign-in (checked in the database, never trusted from the client).
- New sign-ups default to `pending`; the admin assigns roles on the **Staff** page.

## 4. Screens
1. **Floor plan** (home): large table cards colored by status — green = free, orange = in service (customer name, elapsed time, running total). Tap to open or view the bill.
2. **Bill**: customer name + phone (optional), big service buttons by category, technician per line, quantity +/−, discount, tip → **Pay** (Cash / Bank transfer / Card) → bill paid, table becomes free.
3. **Bills**: list by day with detail view.
4. **Services** (admin): add / edit / hide (name, category, price, duration).
5. **Manage tables** (admin): add / rename / hide tables.
6. **Staff** (admin): list accounts, assign roles, lock accounts.
7. **Overview** (admin, receptionist): revenue today / 7 days / 30 days / month, bill count, average bill, tips, daily revenue chart, top services, revenue per technician, payment methods.

## 5. Data (Supabase)
- `profiles` (clerk_user_id, email, full_name, role, active)
- `services` (name, category, price, duration_min, active)
- `salon_tables` (name, sort_order, active)
- `tickets` (table_id, customer_name, customer_phone, status `open|paid|cancelled`, discount, tip, total, payment_method, opened_at, paid_at, created_by)
- `ticket_items` (ticket_id, service_id, name, price, qty, technician_id) — name/price stored at time of sale
- Constraint: each table has at most **one `open` ticket** (partial unique index).
- Paying runs through `pay_ticket()` in the DB so totals are computed safely.
- RLS on every table; role resolved from `profiles` via `auth.jwt()->>'sub'`. See `supabase/schema.sql`.

## 6. UI/UX principles for non-technical users
- Base font 18px, buttons ≥ 48px tall, large tap targets; big icon + label navigation.
- Money is US dollars, formatted `$35.00` (stored as integer cents); dates `25/10/2026`.
- Confirmations in plain sentences ("Cancel this bill?"), no technical jargon.
- Errors in friendly English.

## 7. What you need to set up
1. Create a **Clerk** app; enable the Supabase integration and add the `email` claim to the session token: `{"email": "{{user.primary_email_address}}"}`.
2. Create a **Supabase** project; Authentication → Third-party → add Clerk (Clerk domain); run `supabase/schema.sql` in the SQL Editor.
3. Fill in `.env.local` from `.env.example`.

## 8. Plan
1. SQL schema + RLS + sample data
2. Project skeleton (Vite, TS, Tailwind, shadcn/ui, `@` alias)
3. Auth (Clerk) + Supabase client + roles + route guards + layout
4. Floor plan + bill + payment
5. Services / tables / staff management
6. Bills history + Dashboard (Recharts)
7. Build, verify, run instructions
