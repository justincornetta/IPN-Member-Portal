alter table public.member_education
  add column if not exists education_level text,
  add column if not exists area_of_study text;

alter table public.member_education
  drop constraint if exists member_education_education_level_check;

alter table public.member_education
  add constraint member_education_education_level_check check (
    education_level is null or education_level in (
      'high_school',
      'undergraduate',
      'graduate',
      'professional_degree',
      'certificate',
      'other'
    )
  );

update public.member_education education
set education_level = case profile.persona
  when 'High School' then 'high_school'
  when 'Undergraduate' then 'undergraduate'
  when 'Graduate Student' then 'graduate'
  when 'Professional Degree Student' then 'professional_degree'
  else education.education_level
end
from public.profiles profile
where profile.id = education.user_id
  and education.education_level is null
  and profile.persona in (
    'High School',
    'Undergraduate',
    'Graduate Student',
    'Professional Degree Student'
  );
