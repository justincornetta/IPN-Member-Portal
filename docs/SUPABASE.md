# Supabase — Back-end Structure

Supabase provides our database (Postgres), authentication, and row-level security. This doc covers the current schema, how auth flows, and how to extend things as we build.

---

## Initial setup (do once per environment)

1. **Create a Supabase project** at [supabase.com](https://supabase.com) → New project
2. **Get your keys**: Project Settings → API → copy **Project URL** and **anon public key**
3. **Create `.env.local`** from `.env.example` and paste those values in
4. **Run the schema**: SQL Editor → New query → paste `supabase/schema.sql` → Run
5. **Configure auth settings** (see Auth section below)

---

## Auth

We use Supabase's built-in email + password auth. No third-party providers in v1.

### How registration works

1. User completes the 4-step registration form at `/register`
2. `signUp()` is called with `email`, `password`, and all form fields packed into `user_metadata`
3. Supabase sends a confirmation email with a magic link
4. User clicks the link → redirected to `/auth/callback` → session created → redirected to `/dashboard`
5. The `on_auth_user_created` database trigger fires on step 2 and copies `user_metadata` into the `profiles` table

### Supabase Auth settings to configure

In your Supabase project → Authentication → Settings:

| Setting | Value |
|---|---|
| **Site URL** | `https://members.ipn.org` (prod) or `http://localhost:3000` (local) |
| **Redirect URLs** | Add both `https://members.ipn.org/auth/callback` and `http://localhost:3000/auth/callback` |
| **Email confirmation** | Enabled (default) |
| **Secure email change** | Enabled (default) |

> Tip: Supabase allows multiple redirect URLs, so you can add both prod and localhost at the same time.

---

## Tables

### `public.profiles`

One row per user. Created automatically on signup via trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key; references `auth.users.id` |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `affiliation` | `text` | University, company, self-employed, etc. |
| `country` | `text` | |
| `state` | `text` | US state/territory or Canadian province |
| `city` | `text` | |
| `persona` | `text` | "Which best describes you?" answer |
| `field` | `text` | Primary field of study/work |
| `psychedelic_field_status` | `text` | Currently working in / interested / not sure |
| `psychedelic_field_barriers` | `text[]` | Array — "why not" checkboxes |
| `role_and_goals` | `text` | Long-form answer |
| `inspiration` | `text` | Long-form answer |
| `referral_source` | `text` | How they heard about IPN |
| `created_at` | `timestamptz` | Set on insert |
| `updated_at` | `timestamptz` | Update manually or via trigger when profile edits land |

### Row-Level Security

RLS is enabled on `profiles`. Current policies: users can only read, insert, and update **their own row** (`auth.uid() = id`). Admins will need a separate service-role query or a `role` column + policy once the admin portal is built.

---

## Triggers

### `on_auth_user_created`

Fires after every `INSERT` on `auth.users`. Reads `raw_user_meta_data` (set by `signUp()`) and creates the corresponding `profiles` row. Defined in `supabase/schema.sql`.

---

## Tables coming in v1.0

These don't exist yet — schema will be added as each feature is built.

| Table | Feature |
|---|---|
| `events` | Events list + detail (#5 in build queue) |
| `event_registrations` | One-click event registration (#6) |
| `resources` | Resource library (#10) |

---

## Querying from the app

**Server Components / Server Actions** — use `src/lib/supabase/server.ts`:
```ts
const supabase = await createClient()
const { data } = await supabase.from("profiles").select("*").eq("id", user.id)
```

**Client Components** — use `src/lib/supabase/client.ts`:
```ts
const supabase = createClient()
const { data } = await supabase.from("profiles").select("*").eq("id", userId)
```

RLS ensures users only get back rows they're allowed to see regardless of which client is used.
