-- Production missed the original newsletter prerequisites. Preserve every
-- existing allowed type and add newsletter without replaying old seed content.
set local lock_timeout = '5s';
alter table public.resources drop constraint if exists resources_resource_type_check;
alter table public.resources add constraint resources_resource_type_check
  check (resource_type in ('affiliate_benefit', 'blog_post', 'partner', 'newsletter'));
create unique index if not exists resources_mailchimp_newsletter_source_id_uidx
  on public.resources (source_id)
  where resource_type = 'newsletter'
    and source_name = 'Mailchimp'
    and source_id is not null;
