# Supabase — Back-end Structure

Supabase provides our database (Postgres), authentication, and row-level security. This doc covers the current schema, how auth flows, and how to extend things as we build.

---

## Initial setup (do once per environment)

1. **Create a Supabase project** at [supabase.com](https://supabase.com) → New project
2. **Get your keys**: Project Settings → API → copy **Project URL**, **anon public key**, and **service_role key**
3. **Create `.env.local`** from `.env.example` and paste those values in
4. **Run the schema**: SQL Editor → New query → paste `supabase/schema.sql` → Run
5. **Configure auth settings** (see Auth section below)

---

## Auth

We use Supabase's built-in email + password auth. No third-party providers in v1.

### How registration works

1. User completes the 4-step registration form at `/register`
2. `signUp()` is called with `email`, `password`, and all form fields packed into `user_metadata`
3. Supabase creates the session immediately (email confirmation disabled)
4. User is redirected to `/dashboard`
5. The `on_auth_user_created` trigger fires synchronously on step 2 and copies `user_metadata` into the `profiles` table; `signUp()` then immediately updates the `email` column (the trigger doesn't capture it)

### Password reset flow

1. User visits `/forgot-password` → `resetPasswordForEmail()` sends a reset link
2. Link hits `/auth/callback?token_hash=...&type=recovery&next=/reset-password`
3. Callback calls `verifyOtp({ token_hash, type })` → session created → redirect to `/reset-password`
4. User enters new password → `supabase.auth.updateUser({ password })`

### Supabase Auth settings to configure

In your Supabase project → Authentication → Settings:

| Setting | Value |
|---|---|
| **Site URL** | `https://ipn-member-portal.netlify.app` until `members.ipn.org` moves to Netlify |
| **Redirect URLs** | Add `http://localhost:3000/**`, `https://ipn-member-portal.netlify.app/**`, and `https://deploy-preview-*--ipn-member-portal.netlify.app/**` |
| **Email confirmation** | Disabled (skip for demo) |
| **Secure email change** | Enabled (default) |

> Tip: Supabase allows multiple redirect URLs, including wildcard patterns for Netlify Deploy Previews. Keep `https://members.ipn.org/**` listed if the production domain is already in use or about to move.

---

## Tables

### `public.profiles`

One row per user. Created automatically on signup via trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key; references `auth.users.id` |
| `email` | `text` | Copied from `auth.users.email` by `signUp()`; mirrored into `member_contacts` for contact reveal |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `country` | `text` | |
| `state` | `text` | US state/territory or Canadian province |
| `city` | `text` | Display name as entered by the user |
| `city_lat` | `float8` | Latitude — geocoded from city + country via Nominatim on signup; `null` if lookup failed |
| `city_lng` | `float8` | Longitude — same source as `city_lat`; used for map view (v1.1) |
| `persona` | `text` | One of: `High School`, `Undergraduate`, `Graduate Student`, `Professional Degree Student`, `Psychedelic Professional`, `Professional`, `Other` |
| `affiliation` | `text` | Organization or employer; set for professional personas not affiliated with a university |
| `school` | `text` | Canonical school name; set for student personas and university-affiliated professionals |
| `field` | `text` | Primary field of study/work |
| `psychedelic_field_status` | `text` | Currently working in / interested / not sure |
| `psychedelic_field_barriers` | `text[]` | Array — "why not" checkboxes |
| `role_and_goals` | `text` | Long-form answer |
| `inspiration` | `text` | Long-form answer |
| `referral_source` | `text` | How they heard about IPN |
| `bio` | `text` | Short public bio; set on profile edit page |
| `area_of_interest` | `text` | **Deprecated** — replaced by `interest_tags`; kept for historical data |
| `interest_tags` | `text[]` | Up to 3 structured interest tags (e.g. `{Psilocybin, Harm Reduction, PTSD}`); displayed on directory cards and filterable |
| `linkedin_url` | `text` | LinkedIn profile URL |
| `is_discoverable` | `boolean` | Default `true`; `false` hides the member from the directory |
| `share_location` | `boolean` | Default `true`; controls location-based discovery |
| `avatar_url` | `text` | Public URL of avatar in the `avatars` Storage bucket |
| `role` | `text` | Portal access tier: `superadmin` (full admin access), `admin` (leadership/analytics access), `null` (regular member) |
| `admin_role` | `text` | IPN leadership title (e.g. "Director of Strategy"); set by superadmins; displayed publicly in member profiles |
| `team` | `text` | IPN team assignment: `Strategy`, `Media`, `PsychedelX`, or `Community`; check constraint enforced |
| `created_at` | `timestamptz` | Set on insert |
| `updated_at` | `timestamptz` | Updated by `updateProfile` server action on every save |

> **Migration SQL** (run against any existing database):
> ```sql
> alter table public.profiles add column if not exists email text;
> alter table public.profiles add column if not exists interest_tags text[] default '{}';
> alter table public.profiles add column if not exists share_location boolean not null default true;
> alter table public.profiles add column if not exists role text;
> alter table public.profiles add column if not exists admin_role text;
> alter table public.profiles add column if not exists team text
>   check (team in ('Strategy', 'Media', 'PsychedelX', 'Community'));
>
> -- Backfill emails from auth.users
> update public.profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;
>
> -- Persona short-label migration
> update public.profiles set persona = case persona
>   when 'High school / pre-college'                        then 'High School'
>   when 'Undergraduate student'                            then 'Undergraduate'
>   when 'Graduate student (Master''s or PhD)'              then 'Graduate Student'
>   when 'Professional degree student (MD, JD, MBA, etc.)' then 'Professional Degree Student'
>   when 'Professional in psychedelics'                     then 'Psychedelic Professional'
>   when 'Professional in another field'                    then 'Professional'
>   else persona
> end;
> ```

### Row-Level Security on `profiles`

| Policy | Allows |
|---|---|
| `Users can view own profile` | `auth.uid() = id` |
| `Users can update own profile` | `auth.uid() = id` |
| `Users can insert own profile` | `auth.uid() = id` |
| `Members can view discoverable profiles` | `is_discoverable = true` (authenticated) |
| `Connected users can view each other's profiles` | Accepted connection exists between viewer and target |
| `Pending connection parties can view each other's profiles` | Pending connection exists in either direction |

Admin/service-role queries bypass RLS entirely (used in `src/lib/supabase/admin.ts`).

---

### `public.connections`

One row per connection request. Enables the Community page friending system.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `requester_id` | `uuid` | References `public.profiles(id)` |
| `addressee_id` | `uuid` | References `public.profiles(id)` |
| `status` | `text` | `pending`, `accepted`, or `declined` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Unique constraint on `(requester_id, addressee_id)`. Self-connections prevented by check constraint. RLS: users can view/delete rows where they are requester or addressee; only addressees can update status; only requesters can insert.

> **Migration SQL:**
> ```sql
> create table if not exists public.connections (
>   id           uuid primary key default gen_random_uuid(),
>   requester_id uuid not null references public.profiles(id) on delete cascade,
>   addressee_id uuid not null references public.profiles(id) on delete cascade,
>   status       text not null default 'pending'
>     check (status in ('pending', 'accepted', 'declined')),
>   created_at   timestamptz not null default now(),
>   updated_at   timestamptz not null default now(),
>   constraint connections_no_self  check (requester_id != addressee_id),
>   constraint connections_unique   unique (requester_id, addressee_id)
> );
> alter table public.connections enable row level security;
> create policy "Users can view their own connections"   on public.connections for select to authenticated using (auth.uid() = requester_id or auth.uid() = addressee_id);
> create policy "Users can send connection requests"     on public.connections for insert to authenticated with check (auth.uid() = requester_id);
> create policy "Addressee can update connection status" on public.connections for update to authenticated using (auth.uid() = addressee_id);
> create policy "Users can delete their own connections" on public.connections for delete to authenticated using (auth.uid() = requester_id or auth.uid() = addressee_id);
>
> -- Allow viewing profiles of pending connection parties
> create policy "Pending connection parties can view each other's profiles"
>   on public.profiles for select to authenticated
>   using (exists (
>     select 1 from public.connections
>     where status = 'pending'
>       and ((requester_id = auth.uid() and addressee_id = profiles.id)
>            or (addressee_id = auth.uid() and requester_id = profiles.id))
>   ));
>
> -- Allow viewing profiles of accepted connections
> create policy "Connected users can view each other's profiles"
>   on public.profiles for select to authenticated
>   using (exists (
>     select 1 from public.connections
>     where status = 'accepted'
>       and ((requester_id = auth.uid() and addressee_id = profiles.id)
>            or (addressee_id = auth.uid() and requester_id = profiles.id))
>   ));
>
> -- Set yourself as superadmin (replace with your UUID)
> -- update public.profiles set role = 'superadmin' where id = '<your-uuid>';
> ```

### `public.member_contacts`

Private contact details that are revealed only after an accepted connection.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | Primary key; references `auth.users.id` |
| `email` | `text` | Mirrored from the member's Supabase Auth email |
| `whatsapp_url` | `text` | Optional WhatsApp link managed from the profile page |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

RLS allows members to view, insert, and update their own contact row. Accepted connections can select the row, which lets the directory modal reveal email and WhatsApp after the connection is accepted.

---

## Triggers

### `on_auth_user_created`

Fires after every `INSERT` on `auth.users`. Reads `raw_user_meta_data` (set by `signUp()`) and creates the corresponding `profiles` row. It also creates or updates the member's `member_contacts` row with their auth email. Defined in `supabase/schema.sql`.

---

## Storage

### `avatars` bucket

Public bucket. Each user's avatar is stored at a path equal to their UUID (no file extension). Uploaded as JPEG after client-side crop.

- **Upload / update**: restricted to the owning user via RLS (`auth.uid()::text = name`)
- **Read**: public (no auth required)
- **Public URL pattern**: `{SUPABASE_URL}/storage/v1/object/public/avatars/{userId}`

The `avatar_url` column stores the full public URL with a `?t={timestamp}` cache-busting parameter.

### `resource-assets` bucket

Public bucket for resource-card artwork (partner logos, affiliate promo images).

- **Read**: public (no auth required)
- **Write**: managed by admins/service-role tooling only

---

### `public.events`

Portal-owned event records for the member-facing Events section.

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
| `chat_platform` / `chat_external_url` / `chat_status` | `text` | Optional event chat link; v1 uses `chat_platform = 'whatsapp'`, `chat_external_url` as the WhatsApp invite URL, and `chat_status = 'active'` when shown to registered members |
| `is_recording` | `boolean` | Marks past recording rows |
| `recording_url` / `recording_provider` / `recording_source_id` / `recording_published_at` | various | Recording metadata |
| `speaker_resources` | `jsonb` | Optional papers, links, and event resources for IPN Lab detail pages |
| `status` | `text` | `draft`, `published`, or `cancelled` |
| `registration_count` | `integer` | Maintained by trigger |

### `public.event_registrations`

| Column | Type | Notes |
|---|---|---|
| `event_id` | `uuid` | References `events.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `created_at` | `timestamptz` | RSVP timestamp |
| `reminder_state` | `text` | Placeholder for future email reminders |

Primary key is `(event_id, user_id)`. A trigger increments/decrements `events.registration_count`.

### `public.resources`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `slug` | `text` | Unique stable identifier |
| `resource_type` | `text` | `affiliate_benefit`, `blog_post`, or `partner` |
| `title` / `description` | `text` | Member-facing card copy |
| `url` | `text` | External source |
| `category` | `text` | Display label |
| `image_url` / `image_alt` / `thumbnail_url` | `text` | Card artwork |
| `benefit_note` / `detail_body` / `author` | `text` | Content fields |
| `published_at` / `source_id` / `source_name` | various | Source metadata |
| `featured` | `boolean` | Internal sort priority |
| `sort_order` | `integer` | Manual ordering |
| `status` | `text` | `draft`, `published`, or `archived` |

---

## Admin & service-role client

`src/lib/supabase/admin.ts` exports `createAdminClient()` which uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS. Used only in server components and server actions for admin-tier operations. Never import in client components.

Required env var: `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role key). Add to `.env.local` and to Netlify environment variables.

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

**Admin / service-role** — use `src/lib/supabase/admin.ts` (server only):
```ts
const admin = createAdminClient()
const { data } = await admin.from("profiles").select("*") // bypasses RLS
```

RLS ensures users only get back rows they're allowed to see regardless of which user client is used.
