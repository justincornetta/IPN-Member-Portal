alter table public.resources drop constraint if exists resources_resource_type_check;
alter table public.resources add constraint resources_resource_type_check
  check (resource_type in (
    'affiliate_benefit',
    'blog_post',
    'newsletter',
    'partner'
  ));

insert into public.resources (
  slug,
  resource_type,
  title,
  description,
  url,
  category,
  author,
  published_at,
  source_id,
  source_name,
  featured,
  sort_order,
  status
)
values
  (
    'newsletter-august-2026',
    'newsletter',
    'IPN Members Newsletter - August 2026',
    'The latest monthly update for IPN members, including community news, opportunities, and upcoming programs.',
    'https://eepurl.com/jccYiYwGYy',
    'Monthly newsletter',
    'Intercollegiate Psychedelics Network',
    '2026-08-01T12:00:00Z',
    'https://eepurl.com/jccYiYwGYy',
    'Mailchimp',
    true,
    10,
    'published'
  ),
  (
    'newsletter-july-2026',
    'newsletter',
    'IPN Members Newsletter - July 2026',
    'The July monthly update for IPN members.',
    'https://eepurl.com/g9_33y7qAY',
    'Monthly newsletter',
    'Intercollegiate Psychedelics Network',
    '2026-07-03T12:00:00Z',
    'https://eepurl.com/g9_33y7qAY',
    'Mailchimp',
    false,
    20,
    'published'
  ),
  (
    'newsletter-june-2026',
    'newsletter',
    'IPN Members Newsletter - June 2026',
    'The June monthly update for IPN members.',
    'https://eepurl.com/1SSPfBtgif',
    'Monthly newsletter',
    'Intercollegiate Psychedelics Network',
    '2026-06-01T12:00:00Z',
    'https://eepurl.com/1SSPfBtgif',
    'Mailchimp',
    false,
    30,
    'published'
  ),
  (
    'newsletter-may-2026',
    'newsletter',
    'IPN Members Newsletter - May 2026',
    'The May monthly update for IPN members.',
    'https://eepurl.com/hdnYtGNMVx',
    'Monthly newsletter',
    'Intercollegiate Psychedelics Network',
    '2026-05-04T12:00:00Z',
    'https://eepurl.com/hdnYtGNMVx',
    'Mailchimp',
    false,
    40,
    'published'
  )
on conflict (slug) do update
set
  resource_type = excluded.resource_type,
  title = excluded.title,
  description = excluded.description,
  url = excluded.url,
  category = excluded.category,
  author = excluded.author,
  published_at = excluded.published_at,
  source_id = excluded.source_id,
  source_name = excluded.source_name,
  featured = excluded.featured,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();
