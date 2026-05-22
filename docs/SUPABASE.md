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
| **Site URL** | `https://ipn-member-portal.netlify.app` until `members.ipn.org` moves to Netlify |
| **Redirect URLs** | Add `http://localhost:3000/**`, `https://ipn-member-portal.netlify.app/**`, and `https://deploy-preview-*--ipn-member-portal.netlify.app/**` |
| **Email confirmation** | Enabled (default) |
| **Secure email change** | Enabled (default) |

> Tip: Supabase allows multiple redirect URLs, including wildcard patterns for Netlify Deploy Previews. Keep `https://members.ipn.org/**` listed if the production domain is already in use or about to move.

---

## Tables

### `public.profiles`

One row per user. Created automatically on signup via trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key; references `auth.users.id` |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `country` | `text` | |
| `state` | `text` | US state/territory or Canadian province |
| `city` | `text` | Display name as entered by the user |
| `city_lat` | `float8` | Latitude — geocoded from city + country via Nominatim on signup; `null` if lookup failed |
| `city_lng` | `float8` | Longitude — same source as `city_lat`; used for map view (v1.1) |
| `persona` | `text` | "What best describes you?" — one of: High school, Undergraduate student, Graduate student, Professional degree student, Professional in psychedelics, Professional in another field, Other |
| `affiliation` | `text` | Organization or employer; set for professional/other personas, `null` for students |
| `school` | `text` | Canonical school name from the Hipo dataset; set for college/grad/professional-degree students, `null` otherwise |
| `field` | `text` | Primary field of study/work |
| `psychedelic_field_status` | `text` | Currently working in / interested / not sure |
| `psychedelic_field_barriers` | `text[]` | Array — "why not" checkboxes |
| `role_and_goals` | `text` | Long-form answer |
| `inspiration` | `text` | Long-form answer |
| `referral_source` | `text` | How they heard about IPN |
| `bio` | `text` | Short public bio; set on profile edit page |
| `area_of_interest` | `text` | Free-text area of interest (e.g. "Psilocybin therapy, harm reduction") |
| `linkedin_url` | `text` | LinkedIn profile URL |
| `is_discoverable` | `boolean` | Default `true`; `false` hides the member from the directory |
| `avatar_url` | `text` | Public URL of avatar in the `avatars` Storage bucket |
| `created_at` | `timestamptz` | Set on insert |
| `updated_at` | `timestamptz` | Updated by `updateProfile` server action on every save |

> **Migrating an existing database:** if the `profiles` table was created before this change, run:
> ```sql
> alter table public.profiles add column if not exists school text;
> alter table public.profiles drop column if exists education_status;
> alter table public.profiles add column if not exists city_lat float8;
> alter table public.profiles add column if not exists city_lng float8;
> alter table public.profiles add column if not exists bio text;
> alter table public.profiles add column if not exists area_of_interest text;
> alter table public.profiles add column if not exists linkedin_url text;
> alter table public.profiles add column if not exists is_discoverable boolean not null default true;
> alter table public.profiles add column if not exists avatar_url text;
> ```
> Then re-run `supabase/schema.sql` to update the trigger function. The `affiliation` and `persona` columns already existed under these names.

### Row-Level Security

RLS is enabled on `profiles`. Current policies: users can only read, insert, and update **their own row** (`auth.uid() = id`). Admins will need a separate service-role query or a `role` column + policy once the admin portal is built.

---

## Triggers

### `on_auth_user_created`

Fires after every `INSERT` on `auth.users`. Reads `raw_user_meta_data` (set by `signUp()`) and creates the corresponding `profiles` row. Defined in `supabase/schema.sql`.

---

---

## Storage

### `avatars` bucket

Public bucket. Each user's avatar is stored at a path equal to their UUID (e.g. `abc123-def456-...`), no file extension. Content-type is stored separately by Supabase.

- **Upload / update**: restricted to the owning user via RLS (`auth.uid()::text = name`)
- **Read**: public (no auth required)
- **Public URL pattern**: `{SUPABASE_URL}/storage/v1/object/public/avatars/{userId}`

The `avatar_url` column in `profiles` stores the full public URL with a cache-busting timestamp query parameter appended on upload (`?t={timestamp}`).

To create the bucket and policies, run `supabase/schema.sql` (section 4).

---

### `public.events`

Portal-owned event records for the member-facing Events section. For v1,
leadership adds and edits these rows directly in Supabase; the Admin Portal
will add a friendlier event editor later.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `slug` | `text` | Unique URL slug, used at `/dashboard/events/[slug]` |
| `title` | `text` | Event title |
| `event_type` | `text` | e.g. IPN Lab, PsychedelX, Regional Meetup |
| `starts_at` / `ends_at` | `timestamptz` | Event timing |
| `timezone` | `text` | Defaults to `America/New_York` |
| `summary` / `description` | `text` | Tile copy + detail-page copy |
| `speakers` | `text` | Display text for speakers |
| `location_label` / `location_details` | `text` | e.g. Zoom, Denver, or room details |
| `join_url` | `text` | Zoom/event link; Join opens 15 min before start |
| `thumbnail_url` | `text` | Custom event graphic/PNG URL |
| `status` | `text` | `draft`, `published`, or `cancelled` |
| `registration_count` | `integer` | Maintained by trigger; used for 10+/20+ display |

RLS allows authenticated members to read only `published` events.

### `public.event_registrations`

One row per member RSVP.

| Column | Type | Notes |
|---|---|---|
| `event_id` | `uuid` | References `events.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `created_at` | `timestamptz` | RSVP timestamp |
| `reminder_state` | `text` | Placeholder for future Mailchimp reminders |

The primary key is `(event_id, user_id)`, so a member can RSVP only once per
event. RLS allows members to view and create only their own registrations. A
trigger updates `events.registration_count` after RSVP insert/delete.

### `public.resources`

Links-only content surface for launch. Rows can represent IPN content links,
partner/sponsor organizations, or approved affiliate/member benefits.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `slug` | `text` | Unique stable identifier used for seed upserts |
| `resource_type` | `text` | `content`, `partner`, or `affiliate_benefit` |
| `title` / `description` | `text` | Member-facing card copy |
| `url` | `text` | External link opened from the card |
| `category` | `text` | Display label such as `Recordings` or `Member benefits` |
| `image_url` / `image_alt` | `text` | Optional logo or artwork and alt text |
| `benefit_note` | `text` | Optional member benefit / discount copy |
| `featured` | `boolean` | Drives sort order and badge treatment |
| `sort_order` | `integer` | Manual ordering within the member resources page |
| `status` | `text` | `draft`, `published`, or `archived` |

RLS allows authenticated members to read only `published` resources. Content is
managed directly in Supabase until Admin Portal CRUD is built.

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
