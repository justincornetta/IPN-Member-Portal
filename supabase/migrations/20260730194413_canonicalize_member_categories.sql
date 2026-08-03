-- The current Member Portal registration values are the canonical analytics
-- taxonomy. Raw source values remain available in raw_legacy for auditing.

update public.legacy_member_sot_rows
set self_description = case
  when self_description is null or btrim(self_description) = '' then null
  when lower(btrim(self_description)) in (
    'high school',
    'high school student',
    'high school / pre-college'
  ) then 'High School'
  when lower(btrim(self_description)) in (
    'undergraduate',
    'undergraduate student',
    'undergraduate student (b.a./b.s.)'
  ) then 'Undergraduate'
  when lower(btrim(self_description)) in (
    'graduate student',
    'graduate student (master''s or phd)',
    'graduate student (m.a./m.s./ph.d/mba)'
  ) then 'Graduate Student'
  when lower(btrim(self_description)) in (
    'professional degree student',
    'professional degree student (md, jd, mba, etc.)',
    'professional student (m.d./j.d./d.o)'
  ) then 'Professional Degree Student'
  when lower(btrim(self_description)) in (
    'psychedelic professional',
    'professional in psychedelics',
    'professional in the psychedelic field (e.g., clinician, researcher, policy advocate)',
    'current industry professional'
  ) then 'Psychedelic Professional'
  when lower(btrim(self_description)) in (
    'professional',
    'professional in another field',
    'professional in a related field (e.g., healthcare, education, nonprofit, tech, law)'
  ) then 'Professional'
  else 'Other'
end;

update public.legacy_member_sot_rows
set referral_source = case
  when referral_source is null or btrim(referral_source) = '' then null
  when lower(regexp_replace(btrim(referral_source), '\s*/\s*', '/', 'g')) = 'social media'
    then 'Social Media'
  when lower(regexp_replace(btrim(referral_source), '\s*/\s*', '/', 'g')) in (
    'a friend/colleague',
    'friend/colleague'
  ) then 'Friend / Colleague'
  when lower(regexp_replace(btrim(referral_source), '\s*/\s*', '/', 'g')) = 'google/search engine'
    then 'Google / Search Engine'
  when lower(regexp_replace(btrim(referral_source), '\s*/\s*', '/', 'g')) = 'email/newsletter'
    then 'Email / Newsletter'
  when lower(regexp_replace(btrim(referral_source), '\s*/\s*', '/', 'g')) = 'event/conference'
    then 'Event / Conference'
  when lower(regexp_replace(btrim(referral_source), '\s*/\s*', '/', 'g')) = 'academic/professional organization'
    then 'Academic / Professional Organization'
  else 'Other'
end;

update public.legacy_member_sot_rows
set primary_field = case lower(btrim(primary_field))
  when 'science, technology, engineering, & mathematics'
    then 'Science, Technology, Engineering, Mathematics (STEM)'
  when 'science, technology, engineering, and mathematics'
    then 'Science, Technology, Engineering, Mathematics (STEM)'
  when 'science, technology, engineering, & mathematics (stem)'
    then 'Science, Technology, Engineering, Mathematics (STEM)'
  when 'law and policy' then 'Law & Policy'
  when 'trade and personal services' then 'Skilled Trades & Personal Services'
  when 'trade & personal services' then 'Skilled Trades & Personal Services'
  else primary_field
end
where primary_field is not null and btrim(primary_field) <> '';

update public.legacy_member_sot_rows
set psychedelic_field_status = case
  when psychedelic_field_status in (
    'Yes – I currently work in the field',
    'Yes — I currently work in the field'
  ) then 'Yes — I currently work in the field'
  when psychedelic_field_status in (
    'No – I don’t plan to work in the field',
    'No — I don''t plan to work in the field'
  ) then 'No — I don''t plan to work in the field'
  when psychedelic_field_status in (
    'Not yet – I’m interested in working in the field',
    'Not yet — I''m interested in working in the field'
  ) then 'Not yet — I''m interested in working in the field'
  when psychedelic_field_status in ('I’m not sure', 'I''m not sure')
    then 'I''m not sure'
  else psychedelic_field_status
end
where psychedelic_field_status is not null and btrim(psychedelic_field_status) <> '';

update public.legacy_member_sot_rows
set psychedelic_field_barriers = replace(
  replace(psychedelic_field_barriers, '’', ''''),
  '‘',
  ''''
)
where psychedelic_field_barriers is not null
  and psychedelic_field_barriers ~ '[’‘]';

alter table public.legacy_member_sot_rows
  add constraint legacy_member_sot_rows_self_description_canonical_check
  check (
    self_description is null
    or self_description = any (array[
      'High School',
      'Undergraduate',
      'Graduate Student',
      'Professional Degree Student',
      'Psychedelic Professional',
      'Professional',
      'Other'
    ])
  ),
  add constraint legacy_member_sot_rows_referral_source_canonical_check
  check (
    referral_source is null
    or referral_source = any (array[
      'Social Media',
      'Friend / Colleague',
      'Google / Search Engine',
      'Email / Newsletter',
      'Event / Conference',
      'Academic / Professional Organization',
      'Other'
    ])
  ),
  add constraint legacy_member_sot_rows_primary_field_canonical_check
  check (
    primary_field is null
    or primary_field = any (array[
      'Arts & Humanities',
      'Business',
      'Health & Medicine',
      'Law & Policy',
      'Multi-Disciplinary',
      'Public & Social Services',
      'Science, Technology, Engineering, Mathematics (STEM)',
      'Social Sciences',
      'Skilled Trades & Personal Services',
      'Education',
      'Media, Journalism & Communications',
      'Other'
    ])
  ),
  add constraint legacy_member_sot_rows_psychedelic_status_canonical_check
  check (
    psychedelic_field_status is null
    or psychedelic_field_status = any (array[
      'Yes — I currently work in the field',
      'No — I don''t plan to work in the field',
      'Not yet — I''m interested in working in the field',
      'I''m not sure'
    ])
  );

alter table public.profiles
  add constraint profiles_persona_registration_values_check
  check (
    persona is null
    or persona = any (array[
      'High School',
      'Undergraduate',
      'Graduate Student',
      'Professional Degree Student',
      'Psychedelic Professional',
      'Professional',
      'Other'
    ])
  ),
  add constraint profiles_referral_source_registration_values_check
  check (
    referral_source is null
    or referral_source = any (array[
      'Social Media',
      'Friend / Colleague',
      'Google / Search Engine',
      'Email / Newsletter',
      'Event / Conference',
      'Academic / Professional Organization',
      'Other'
    ])
  ),
  add constraint profiles_field_registration_values_check
  check (
    field is null
    or field = any (array[
      'Arts & Humanities',
      'Business',
      'Health & Medicine',
      'Law & Policy',
      'Multi-Disciplinary',
      'Public & Social Services',
      'Science, Technology, Engineering, Mathematics (STEM)',
      'Social Sciences',
      'Skilled Trades & Personal Services',
      'Education',
      'Media, Journalism & Communications'
    ])
  ),
  add constraint profiles_psychedelic_status_registration_values_check
  check (
    psychedelic_field_status is null
    or psychedelic_field_status = any (array[
      'Yes — I currently work in the field',
      'No — I don''t plan to work in the field',
      'Not yet — I''m interested in working in the field',
      'I''m not sure'
    ])
  );
