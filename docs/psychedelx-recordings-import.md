# PsychedelX Recordings Import

Generated on 2026-06-15 and updated on 2026-06-16 for the one-time PsychedelX historical recording backfill.

## Source

- Channel: https://www.youtube.com/@psychedelx3035
- Channel ID: `UCioNwyZTdnV-PsfGPnBVtdA`
- Public channel count observed: 145 videos
- Metadata collection used the public YouTube channel, playlist, and watch pages rendered through Jina Reader because direct local YouTube requests reset during this run.
- The visible playlist/channel metadata produced 143 video IDs from PsychedelX playlists and the channel uploads page. The Promotional Materials playlist includes at least one visible item uploaded by Haley Maria Dourron, PhD rather than the PsychedelX channel, so promotional items were not seeded as member-portal recordings.

## Seed Coverage

- Reviewed rows in `supabase/seed-psychedelx-recordings.sql`: 143
- Ambiguous or excluded rows below: 0
- Category counts: Participant Talk: 102, Panel: 8, Q&A: 11, Keynote Speech: 18, Closing Ceremony: 3, Other: 1
- Year counts: 2021: 27, 2022: 31, 2023: 21, 2024: 29, 2025: 35

The SQL seed updates existing rows by `recording_source_id` or canonical YouTube `recording_url`, then inserts missing rows. Imported rows are published immediately and appear in the Events recordings tab under `event_type = 'PsychedelX'`.

## Ambiguous Or Excluded Videos

All previously ambiguous videos have now been labeled and included in the seed.

| Published | Raw title | URL | Category |
|---|---|---|---|
| 2021-01-28 | Why PsychedelX? | https://www.youtube.com/watch?v=iGxqWmMII58 | Other |
| 2021-02-22 | I am a Psychedelic Student | https://www.youtube.com/watch?v=lCC4O681zJA | Participant Talk |
| 2023-08-07 | From Art Historian to Psychedelic Scientist: Getting to Know Your Vehicle w/ Dr. Meghan DellaCrosse | https://www.youtube.com/watch?v=Sh2TiWtxv3c | Keynote Speech |
| 2023-08-07 | The Evolution of Consciousness & The Consciousness of Evolution w/ Jay & Lindy Nelson | https://www.youtube.com/watch?v=NrsorRExnP8 | Panel |
| 2023-08-12 | PsychedelX 2023: Psychedelic Training Center Series | https://www.youtube.com/watch?v=ZYLEE77HDhM | Panel |

## Verification SQL

After running the seed in Supabase, use these checks:

```sql
select count(*) as psychedelx_recordings
from public.events
where event_type = 'PsychedelX'
  and is_recording = true
  and status = 'published';

select recording_source_id, count(*)
from public.events
where event_type = 'PsychedelX'
  and is_recording = true
  and recording_provider = 'YouTube'
group by recording_source_id
having count(*) > 1;

select extract(year from coalesce(recording_published_at, starts_at))::int as year, count(*)
from public.events
where event_type = 'PsychedelX'
  and is_recording = true
group by 1
order by 1;

select recording_category, count(*)
from public.events
where event_type = 'PsychedelX'
  and is_recording = true
group by recording_category
order by recording_category;
```
