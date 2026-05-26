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
3. Supabase creates the session immediately (email confirmation disabled)
4. User is redirected to `/dashboard`
5. The `on_auth_user_created` database trigger fires on step 2 and copies `user_metadata` into the `profiles` table

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
| `first_name` | `text` | |
| `last_name` | `text` | |
| `country` | `text` | |
| `state` | `text` | US state/territory or Canadian province |
| `city` | `text` | Display name as entered by the user |
| `city_lat` | `float8` | Latitude — geocoded from city + country via Nominatim on signup; `null` if lookup failed |
| `city_lng` | `float8` | Longitude — same source as `city_lat`; used for map view (v1.1) |
| `persona` | `text` | "What best describes you?" — one of: `High School`, `Undergraduate`, `Graduate Student`, `Professional Degree Student`, `Psychedelic Professional`, `Professional`, `Other` |
| `affiliation` | `text` | Organization or employer; set for professional personas who are **not** affiliated with a university, `null` otherwise |
| `school` | `text` | Canonical school name from the Hipo dataset; set for student personas **and** for professional personas who check "I work at a university", `null` otherwise |
| `field` | `text` | Primary field of study/work |
| `psychedelic_field_status` | `text` | Currently working in / interested / not sure |
| `psychedelic_field_barriers` | `text[]` | Array — "why not" checkboxes |
| `role_and_goals` | `text` | Long-form answer |
| `inspiration` | `text` | Long-form answer |
| `referral_source` | `text` | How they heard about IPN |
| `bio` | `text` | Short public bio; set on profile edit page |
| `area_of_interest` | `text` | **Deprecated** — replaced by `interest_tags`; kept for historical data |
| `interest_tags` | `text[]` | Up to 3 structured interest tags selected from a fixed list (e.g. `{Psilocybin, Harm Reduction, PTSD}`); displayed on directory cards and filterable |
| `linkedin_url` | `text` | LinkedIn profile URL |
| `is_discoverable` | `boolean` | Default `true`; `false` hides the member from the directory |
| `avatar_url` | `text` | Public URL of avatar in the `avatars` Storage bucket |
| `share_location` | `boolean` | Default `true`; controls location-based discovery (used in future "Near You" tab) |
| `created_at` | `timestamptz` | Set on insert |
| `updated_at` | `timestamptz` | Updated by `updateProfile` server action on every save |

> **Migrating an existing database:**
>
> **One-time schema additions** (run if columns are missing):
> ```sql
> alter table public.profiles add column if not exists school text;
> alter table public.profiles drop column if exists education_status;
> alter table public.profiles add column if not exists city_lat float8;
> alter table public.profiles add column if not exists city_lng float8;
> alter table public.profiles add column if not exists bio text;
> alter table public.profiles add column if not exists area_of_interest text;
> alter table public.profiles add column if not exists interest_tags text[] default '{}';
> alter table public.profiles add column if not exists linkedin_url text;
> alter table public.profiles add column if not exists is_discoverable boolean not null default true;
> alter table public.profiles add column if not exists share_location boolean not null default true;
> alter table public.profiles add column if not exists avatar_url text;
> ```
>
> **Persona value migration** (short labels — run once to update existing rows):
> ```sql
> update profiles set persona = case persona
>   when 'High school / pre-college'                        then 'High School'
>   when 'Undergraduate student'                            then 'Undergraduate'
>   when 'Graduate student (Master''s or PhD)'              then 'Graduate Student'
>   when 'Professional degree student (MD, JD, MBA, etc.)' then 'Professional Degree Student'
>   when 'Professional in psychedelics'                     then 'Psychedelic Professional'
>   when 'Professional in another field'                    then 'Professional'
>   else persona
> end;
> ```
>
> **Directory RLS policy** (allow members to view discoverable profiles):
> ```sql
> create policy "Members can view discoverable profiles"
>   on public.profiles for select
>   to authenticated
>   using (is_discoverable = true);
> ```
>
> Then re-run `supabase/schema.sql` to update the trigger function.

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

### `resource-assets` bucket

Public bucket for resource-card artwork such as partner logos, affiliate promo
images, and other non-sensitive media assets.

- **Read**: public (no auth required)
- **Write**: managed by admins/service-role tooling only
- **Public URL pattern**: `{SUPABASE_URL}/storage/v1/object/public/resource-assets/{path}`

### `public.resources`

Member-only resource surface. Rows can represent approved affiliate/member
benefits, IPN Labs recordings, PsychedelX recordings, IPN blog posts, or
partner/sponsor organizations.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `slug` | `text` | Unique stable identifier used for seed upserts |
| `resource_type` | `text` | `affiliate_benefit`, `ipn_lab_recording`, `psychedelx_recording`, `blog_post`, or `partner` |
| `title` / `description` | `text` | Member-facing card copy |
| `url` | `text` | External source opened by the Learn More CTA |
| `category` | `text` | Display label such as `Recordings` or `Member benefits` |
| `image_url` / `image_alt` | `text` | Optional logo or artwork and alt text |
| `thumbnail_url` | `text` | Optional video/article thumbnail for card and detail views |
| `benefit_note` | `text` | Optional member benefit / discount copy |
| `detail_body` | `text` | Detail-page body copy for recordings/articles |
| `author` | `text` | Optional author byline for blog posts |
| `published_at` | `timestamptz` | Optional source publish date |
| `source_id` | `text` | Optional external source identifier, such as a YouTube video ID |
| `source_name` | `text` | Optional source label, such as YouTube or IPN Blog |
| `featured` | `boolean` | Internal sort priority; not shown as a public sponsor tier |
| `sort_order` | `integer` | Manual ordering within the member resources page |
| `status` | `text` | `draft`, `published`, or `archived` |

RLS allows authenticated members to read only `published` resources. Content and
asset URLs are managed directly in Supabase until Admin Portal CRUD is built.

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
