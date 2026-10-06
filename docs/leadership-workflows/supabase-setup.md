# Supabase setup verification — October 5, 2026

Project: Member Portal (`plgzakxecjlzepzeqiio`). Registered migration: `20261005221104_leadership_requests`.

Applied the reviewed local SQL through Supabase's migration API. The migration file was renamed to match the recorded remote version, preventing a duplicate schema application in future CLI migration runs. Added indexes for the workflow foreign keys before application.

- Six tables exist: workflow settings, requests, activity history, integration jobs, bank metadata and delivery locks. All have RLS enabled.
- Justin's existing non-banned superadmin profile is the sole expense approver. His existing Slack identity mapping is seeded as metadata; no notification is sent by this setup.
- Authenticated clients have only the intended read access. Anonymous reads and direct client inserts/updates are denied. Jobs and locks are server-only.
- Three functions use SECURITY INVOKER and grant execution only to service_role: save request, claim job and acquire Sheets lock.
- Live transaction verification saved temporary media and expense records through the service function, confirmed automatic audit entries, checked shared media versus private expense/history reads for another leader, confirmed submitter/approver access, and confirmed client writes and anonymous reads are denied. The transaction was rolled back. No test requests, activity or integration jobs remain.
- Security/performance advisors report no warning/error findings for the new workflow objects. Informational notices for server-only tables without client policies and currently unused indexes are expected. Existing project warnings remain: publicly executable SECURITY DEFINER functions, leaked-password protection disabled, and older policy performance notices. See [function access guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- No profile for Agnes Horie was found. She needs a portal account and leadership assignment before she can own requests; no account or permission was fabricated.

Slack app scopes/channel membership, Google service-account tracker access, Netlify production credentials and the Slack approval callback are now configured; see the rollout checklist in [README.md](README.md). Real-login end-to-end testing, merge and production activation remain deferred, with `WORKFLOW_INTEGRATION_MODE=off` in all contexts. No storage bucket, Edge Function, new project or paid Supabase branch was created. Source assets and receipts remain external links.
