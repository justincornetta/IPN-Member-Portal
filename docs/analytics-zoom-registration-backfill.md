# Zoom Registration Backfill

This is the one-time path for backfilling historical IPN Labs registration counts into Portal Analytics.

## Why the API snapshot is missing IPN Labs registrants

The legacy Zoom refresh had attendee reports for the historical IPN Labs meetings, but Zoom returned no rows from the normal meeting registrants endpoints for those same meetings.

Tested endpoints for the historical IPN Labs meeting IDs and UUIDs:

- `GET /meetings/{meetingId}/registrants`
- `GET /meetings/{meetingUuid}/registrants`
- `GET /past_meetings/{meetingUuid}/registrants`
- `GET /report/meetings/{meetingId}/registrants`
- `GET /report/meetings/{meetingUuid}/registrants`
- `GET /meetings/{meetingId}/registrants?occurrence_id={eventStartEpochMs}`

All returned zero registrants for the historical IPN Labs rows. `GET /meetings/{meetingId}?show_previous_occurrences=true` also returns no meeting detail for those expired historical meetings, so occurrence IDs are not available through the API for this one-time recovery.

The successful API recovery path is:

`GET /report/meetings/{meetingId}/participants?include_fields=registrant_id`

That endpoint returns report participant rows with `registrant_id`. The one-time importer dedupes those rows by email, falling back to `registrant_id`, and writes them as report-derived registrant rows. This recovers registered attendees. It may not include registered no-shows, because Zoom no longer returns the expired registration report through the regular registrants endpoints.

For exact historical total registration counts, enter the manually confirmed Zoom count in the manifest `registrants` field. The importer will use that manual total for the event-level registrant count while preserving any recovered person-level report rows for detail tables.

## Missing IPN Labs reports

The generated manifest is at:

`/Users/jcornetta/Code/ipn-dashboard/data/zoom_registration_backfill_manifest.json`

It currently expects CSV exports for:

- `2025-10-21` - IPN Labs Seminar with Rebekah Senanayake
- `2025-11-12` - IPN Labs Seminar: On Connectedness and Integration with Dr. Rosalind Watts
- `2026-01-08` - IPN Labs Seminar: Integrating 5-MeO-DMT with Otto Maier
- `2026-03-11` - IPN Labs Roundtable Talk: Best Practices for Psychedelic Integration
- `2026-04-22` - IPN Labs Seminar: Psychedelics & Quantum Consciousness w/ Dr. Justin Riddle
- `2026-05-08` - Using Psychedelic Phenomenology to Map the Structure of Consciousness with Andres Gomez-Emilsson

## Import flow

1. Generate or update the missing-event manifest:

```bash
npm run analytics:zoom-registration-backfill -- --init-manifest /Users/jcornetta/Code/ipn-dashboard/data/zoom_registration_backfill_manifest.json --legacy-dir /Users/jcornetta/Code/ipn-dashboard
```

2. Pull report-derived registrants from Zoom:

```bash
npm run analytics:zoom-registration-backfill -- --pull-zoom-participant-registrants /Users/jcornetta/Code/ipn-dashboard/data/zoom_registration_backfill_manifest.json --legacy-dir /Users/jcornetta/Code/ipn-dashboard
```

3. Rebuild the Portal analytics snapshot:

```bash
npm run analytics:build-snapshot -- /Users/jcornetta/Code/ipn-dashboard
```

4. Run verification:

```bash
npm run lint
npm run build
```

The importer writes:

`/Users/jcornetta/Code/ipn-dashboard/data/zoom_registration_backfill.json`

The snapshot builder merges those rows into historical Zoom events only when the API snapshot has no registrant rows. This keeps Zoom registrants as a one-time historical recovery path while preserving Member Portal RSVPs as the future registration source of truth.

## Scheduled refresh protection

The portal analytics refresh workflow restores private Zoom backfill artifacts from GitHub Actions secrets before it rebuilds `src/lib/admin/analytics/legacy-snapshot.json`.

Set these repository secrets:

- `ZOOM_REGISTRATION_BACKFILL_GZIP_B64`
- `ZOOM_ATTENDEE_BACKFILL_GZIP_B64`

Generate each value from the private legacy dashboard data files:

```bash
gzip -c /Users/jcornetta/Code/ipn-dashboard/data/zoom_registration_backfill.json | base64 | tr -d '\n'
gzip -c /Users/jcornetta/Code/ipn-dashboard/data/zoom_attendee_backfill.json | base64 | tr -d '\n'
```

The files contain private registrant and attendee information, so keep them out of git. They are ignored by `/data`.

If the secrets are temporarily missing, the snapshot builder preserves previously backfilled historical aggregate values from the committed snapshot for pre-July 2026 Zoom rows. This prevents a refresh from nulling known historical registration or attendance totals, but detail rows and first-time recoveries still require the private backfill artifacts.

## Manual count override

If Zoom or an internal record provides the exact total count, update the manifest row like this:

```json
{
  "eventId": "MEC+Fc0KR9qN8OCYHNGhSQ==",
  "meetingId": "83862482263",
  "topic": "IPN Labs Seminar with Rebekah Senanayake",
  "date": "2025-10-21T21:55:35Z",
  "registrants": 42,
  "file": ""
}
```

Then rerun either the report-derived pull or the manifest import:

```bash
npm run analytics:zoom-registration-backfill -- --pull-zoom-participant-registrants /Users/jcornetta/Code/ipn-dashboard/data/zoom_registration_backfill_manifest.json --legacy-dir /Users/jcornetta/Code/ipn-dashboard
npm run analytics:build-snapshot -- /Users/jcornetta/Code/ipn-dashboard
```

If only a manual count is available and no detail rows are needed, run:

```bash
npm run analytics:zoom-registration-backfill -- --manifest /Users/jcornetta/Code/ipn-dashboard/data/zoom_registration_backfill_manifest.json --legacy-dir /Users/jcornetta/Code/ipn-dashboard
npm run analytics:build-snapshot -- /Users/jcornetta/Code/ipn-dashboard
```

## CSV fallback

If exact registration reports including no-shows are exported from the Zoom web portal, update the manifest `file` fields with absolute CSV paths and run:

```bash
npm run analytics:zoom-registration-backfill -- --manifest /Users/jcornetta/Code/ipn-dashboard/data/zoom_registration_backfill_manifest.json --legacy-dir /Users/jcornetta/Code/ipn-dashboard
```

The importer dedupes registrants by email and skips non-approved rows when an `Approval Status` column is present.

Current CSV-backed import:

- `2025-10-21` - Rebekah Senanayake - 50 approved unique registrants
- `2025-11-12` - Rosalind Watts - 46 approved unique registrants
- `2026-01-08` - Otto Maier - 59 approved unique registrants
- `2026-03-11` - Best Practices for Psychedelic Integration - 72 approved unique registrants
- `2026-04-22` - Justin Riddle - 52 approved unique registrants
- `2026-05-08` - Andres Gomez-Emilsson - 52 approved unique registrants

The `2025-09-09` CSV for `IPN Labs Seminar: The Dark Side of Psychedelics - The Media's Role in Confronting Shadows` has 49 approved unique registrants, but the current legacy Zoom event snapshot does not contain that event ID or meeting ID. Add or recover the event row before it can be shown in Portal Analytics.

## Attendee CSV backfill

Historical Zoom webinar attendee exports can be imported separately from registration reports:

```bash
npm run analytics:zoom-attendee-backfill -- --manifest /Users/jcornetta/Code/ipn-dashboard/data/zoom_attendee_backfill_manifest.json --legacy-dir /Users/jcornetta/Code/ipn-dashboard
npm run analytics:build-snapshot -- /Users/jcornetta/Code/ipn-dashboard
```

The attendee importer:

- Aggregates multiple attendee-report CSV files into one event-level record.
- Excludes host emails listed in the manifest.
- Includes attendee and panelist rows.
- Dedupes by email across all files.
- Merges overlapping join/leave intervals so duplicate role rows do not double-count duration.
- Preserves per-person duration, days attended, role, country, and registration timestamp when available.

Current PsychedelX 2026 attendee import:

- Source files: June 26, June 27, and June 28 attendee reports for webinar `89543551090`.
- Reported day-level unique viewers: 61, 39, and 30.
- Deduped conference-level unique attendees: 85.
- Combined actual conference duration: 926 minutes.
- Average attendee duration: 199.9 minutes.
- Average retention across the combined conference runtime: 21.6%.
