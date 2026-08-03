alter table public.legacy_member_sot_rows
  drop constraint if exists legacy_member_sot_rows_self_description_canonical_check;

alter table public.profiles
  drop constraint if exists profiles_persona_registration_values_check;

update public.legacy_member_sot_rows
set self_description = case self_description
  when 'High School' then 'High school / pre-college'
  when 'Undergraduate' then 'Undergraduate student'
  when 'Graduate Student' then 'Graduate student (Master''s or PhD)'
  when 'Professional Degree Student' then 'Professional degree student (MD, JD, MBA, etc.)'
  when 'Psychedelic Professional' then 'Professional in psychedelics'
  when 'Professional' then 'Professional in another field'
  else self_description
end
where self_description is not null;

update public.profiles
set persona = case persona
  when 'High School' then 'High school / pre-college'
  when 'Undergraduate' then 'Undergraduate student'
  when 'Graduate Student' then 'Graduate student (Master''s or PhD)'
  when 'Professional Degree Student' then 'Professional degree student (MD, JD, MBA, etc.)'
  when 'Psychedelic Professional' then 'Professional in psychedelics'
  when 'Professional' then 'Professional in another field'
  else persona
end
where persona is not null;

alter table public.legacy_member_sot_rows
  add constraint legacy_member_sot_rows_self_description_canonical_check
  check (
    self_description is null
    or self_description = any (array[
      'High school / pre-college',
      'Undergraduate student',
      'Graduate student (Master''s or PhD)',
      'Professional degree student (MD, JD, MBA, etc.)',
      'Professional in psychedelics',
      'Professional in another field',
      'Other'
    ])
  );

alter table public.profiles
  add constraint profiles_persona_registration_values_check
  check (
    persona is null
    or persona = any (array[
      'High school / pre-college',
      'Undergraduate student',
      'Graduate student (Master''s or PhD)',
      'Professional degree student (MD, JD, MBA, etc.)',
      'Professional in psychedelics',
      'Professional in another field',
      'Other'
    ])
  );
