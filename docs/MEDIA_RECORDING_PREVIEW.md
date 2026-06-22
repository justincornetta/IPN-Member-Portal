# Media Recording Preview Runbook

Use this runbook when the media team needs a shareable member-directory map link with fuller location coverage.

## Environment isolation

Do not seed production Supabase.

The recording link should be a Netlify Deploy Preview backed by a staging Supabase project. In Netlify, configure the Deploy Preview context with staging values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Keep the staging service-role key local only. Do not add it to Netlify unless a server-side feature explicitly needs it.

For the June 2026 media recording setup, Deploy Previews are scoped to the staging Supabase project `kbmdltomsbrryfpungsq`. The deploy-preview `SUPABASE_SERVICE_ROLE_KEY` is intentionally disabled so preview functions cannot reach production data with a service-role key.

In staging Supabase, add these auth redirect URLs:

- `https://deploy-preview-*--ipn-member-portal.netlify.app/**`
- the exact deploy preview URL if Supabase requires it

## Source data

Use an exported source-of-truth aggregate or dashboard JSON with location fields. The seed script supports:

- JSON array of rows
- JSON object with `rows`
- CSV with headers
- analytics dashboard `location_geocodes.json` cache

Rows may include `city`, `state`, `country`, and either `lat`/`lng` or `city_lat`/`city_lng`. If coordinates are not in the source rows, pass the geocode cache with `--geocodes`.

Do not commit source exports, geocode cache files, generated seed files, or service-role keys.

## Preview the seed plan

From a clean local clone:

```bash
npm install
npm run recording:seed:summary -- \
  --source "/path/to/sot_dashboard.json" \
  --geocodes "/path/to/location_geocodes.json" \
  --max-members 650 \
  --cap-per-location 5
```

The summary should show the number of geocoded locations, planned placeholder profiles, skipped rows, top countries, and top cities.

## Seed staging

Set staging-only environment variables:

```bash
export SUPABASE_URL="https://<staging-project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<staging-service-role-key>"
export RECORDING_SEED_CONFIRM_STAGING=true
export RECORDING_MEDIA_EMAIL="media-recording@example.org"
export RECORDING_MEDIA_PASSWORD="<temporary-password>"
```

Then run:

```bash
npm run recording:seed -- \
  --source "/path/to/sot_dashboard.json" \
  --geocodes "/path/to/location_geocodes.json" \
  --batch recording_seed_2026_06_22 \
  --max-members 650 \
  --cap-per-location 5 \
  --yes
```

This creates generic placeholder users such as `IPN Member` with real aggregate locations only. Each seeded auth user/profile is marked with the batch ID for deterministic cleanup. If `RECORDING_MEDIA_EMAIL` and `RECORDING_MEDIA_PASSWORD` are set, the command also creates a non-discoverable media-team login.

## Share with media

After Netlify finishes the PR Deploy Preview, share:

- Deploy Preview URL
- test login email/password
- route: `/dashboard/directory?view=map`
- instruction: clear filters before recording

## Cleanup after recording

Run cleanup immediately after the media team confirms the clip is recorded:

```bash
export SUPABASE_URL="https://<staging-project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<staging-service-role-key>"
export RECORDING_SEED_CONFIRM_STAGING=true

npm run recording:seed:cleanup -- \
  --batch recording_seed_2026_06_22 \
  --yes
```

The command prints the number of seed users/profiles found and verifies that zero remain after deletion.

If the profiles were seeded directly in staging SQL instead of through the service-role script, use this cleanup query in the staging Supabase SQL editor:

```sql
delete from public.profiles
where referral_source in ('recording_seed_2026_06_22', 'recording_seed_2026_06_22:login');

delete from auth.users
where raw_app_meta_data->>'recording_seed_batch' = 'recording_seed_2026_06_22'
   or email = 'media-recording@intercollegiatepsychedelics.net';

select
  count(*) filter (where referral_source = 'recording_seed_2026_06_22') as seeded_profiles,
  count(*) filter (where referral_source = 'recording_seed_2026_06_22:login') as media_login_profiles
from public.profiles;
```

## Production guardrail

If the deploy preview uses the production Supabase project, stop. Configure staging Supabase for Deploy Previews first, or use a local/staging tunnel. Do not seed production for the launch recording.
