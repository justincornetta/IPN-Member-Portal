create unique index if not exists resources_mailchimp_newsletter_source_id_uidx
  on public.resources (source_id)
  where resource_type = 'newsletter'
    and source_name = 'Mailchimp'
    and source_id is not null;
