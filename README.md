# Nail Salon — Tables, Services & Payments

Vite + React 18 + TypeScript · shadcn/ui + Tailwind · Clerk (sign-in) · Supabase (data, RLS) · TanStack Query · Recharts.
Full design: [docs/spec.md](docs/spec.md).

## Setup (one time)

### 1. Clerk
1. Create an app at <https://dashboard.clerk.com> and enable **Email** (and/or Google) sign-in.
2. Enable the Supabase integration (**Integrations → Supabase**) and note the **Clerk domain**.
3. Go to **Sessions → Customize session token** and add an email claim so the database can recognise the owner:
   ```json
   { "email": "{{user.primary_email_address}}" }
   ```
4. Copy the **Publishable key**.

### 2. Supabase
1. Create a project at <https://supabase.com>.
2. **Authentication → Sign In / Providers → Third-Party Auth → Add provider → Clerk**, paste the Clerk domain.
3. **SQL Editor** → paste all of [supabase/schema.sql](supabase/schema.sql) → Run. (Includes 8 sample tables and 10 sample services.)
4. Copy the **Project URL** and **publishable key** (Project Settings → API).

### 3. Run the app
```bash
cp .env.example .env.local   # then fill in the 3 values
npm install
npm run dev
```
Open <http://localhost:5173>. Sign in as `buitritinht@gmail.com` → automatically **Owner (admin)**.
Anyone else who signs up is **Pending**; the Owner assigns a role under **Staff**.

## Roles
| Role | Can do |
|---|---|
| Owner (admin) | Everything: services, tables, staff, overview, bills |
| Receptionist / Cashier | Open tables, add services, take payment, cancel bills, view bills & overview |
| Technician | View the floor plan and open bills |
| Pending | Sees a waiting screen only |

> **Simple mode is ON:** in `supabase/schema.sql`, `ensure_profile` has `v_everyone_is_admin := true`, so **every account that signs in is an Owner (admin)**. Because of that, restrict who can sign up in Clerk (User & authentication → Restrictions → sign-up mode "Restricted"/invite-only, or an allowlist), otherwise anyone who finds the URL could register and get full access. To bring back approval by the owner, set the constant to `false` and re-run the file.

Permissions are enforced in the **database (RLS)**, not just by hiding buttons. Opening, paying and cancelling go through SQL functions (`open_ticket`, `pay_ticket`, `cancel_ticket`).

## Commands
- `npm run dev` — run · `npm run build` — build · `npm run lint`
- Add a shadcn component: `npx shadcn@latest add <name>`

## Languages (i18n)
English and Vietnamese, built with `i18next` + `react-i18next`. Use the **EN | VI** switch (sidebar, phone top bar, sign-in page); the choice is remembered in the browser. On first visit it follows the browser language (Vietnamese browsers get Vietnamese, everything else English). The Clerk sign-in screens switch language too, (dates and money are always US-style, see below).

- Texts live in `src/i18n/locales/en.json` and `vi.json` — keep both files on the same keys.
- To add a language: create `src/i18n/locales/<code>.json`, register it in `src/i18n/index.ts` (`LANGUAGES` + `resources`), and map its Clerk pack in `src/main.tsx`.
- Service and table names are data you enter yourself, so they are not translated.

## Time zone & date format
Dates and times use the US format (`10/25/2026`, `2:35 PM`) in **the salon's time zone**, whatever time zone the phone or computer is set to — so "today", the daily totals and the bill times are the same on every device. Default is Pacific (`America/Los_Angeles`). Change it with `VITE_SALON_TIMEZONE` in `.env.local` (see `.env.example` for the list) and restart `npm run dev`. The current salon time (e.g. `2:35 PM PDT`) is shown in the sidebar. Daylight-saving changes are handled automatically.

## Currency
Everything is in **US dollars** (`$35.00`). Amounts are stored in the database as integer **cents** (`3500`), so there are no rounding errors; the price/discount/tip fields accept `35` or `35.50`.

## Signing out / switching accounts
Click **Sign out** at the bottom of the sidebar (laptop/tablet) or tap your avatar in the top bar (phone) → **Sign out**, then sign in with the other account. The waiting-for-approval and "can't connect" screens have a Sign out button too.

## Phone & tablet
The whole app is responsive and tuned for touch: bottom tab bar on phones (sidebar from tablet size up), 2-column floor plan, one-tap service tiles with a count badge, and on the Bill screen a sticky **View bill** bar that opens the bill as a bottom sheet with the Total and **Pay** button always in reach. Layouts were checked at 340px, 820px and 1280px wide, in English and Vietnamese. On a phone you can use the browser's "Add to Home Screen" for a full-screen app feel.

## One technician, one open bill
A technician who is working on an open bill (not yet paid or cancelled) cannot be assigned to another table. In the technician lists they show as greyed out with "busy at Table 3"; they are free again as soon as that bill is paid or cancelled. The rule is also enforced in the database (`check_technician_free` trigger in `schema.sql`), so it holds on every device.

## Notes
- The floor plan auto-refreshes every 5 seconds so several devices stay in sync.
- Not included yet: appointments, customer loyalty, technician payroll, receipt printing, real payment gateway (see spec section 1).
