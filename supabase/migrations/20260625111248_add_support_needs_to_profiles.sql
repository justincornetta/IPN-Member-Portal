alter table public.profiles add column if not exists support_needs text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    country,
    state,
    city,
    city_lat,
    city_lng,
    persona,
    affiliation,
    school,
    field,
    psychedelic_field_status,
    psychedelic_field_barriers,
    role_and_goals,
    inspiration,
    support_needs,
    referral_source
  ) values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'city',
    (new.raw_user_meta_data->>'city_lat')::float8,
    (new.raw_user_meta_data->>'city_lng')::float8,
    new.raw_user_meta_data->>'persona',
    new.raw_user_meta_data->>'affiliation',
    new.raw_user_meta_data->>'school',
    new.raw_user_meta_data->>'field',
    new.raw_user_meta_data->>'psychedelic_field_status',
    case
      when new.raw_user_meta_data ? 'psychedelic_field_barriers'
      then array(
        select jsonb_array_elements_text(
          new.raw_user_meta_data->'psychedelic_field_barriers'
        )
      )
      else null
    end,
    new.raw_user_meta_data->>'role_and_goals',
    new.raw_user_meta_data->>'inspiration',
    new.raw_user_meta_data->>'support_needs',
    new.raw_user_meta_data->>'referral_source'
  );

  insert into public.member_contacts (
    user_id,
    email
  ) values (
    new.id,
    new.email
  )
  on conflict (user_id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;
