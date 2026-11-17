-- Reports are written by the server with the service role key. Browsers never
-- talk to Supabase directly, so RLS is enabled with no public policies.

create table if not exists public.reports (
  id          text primary key,
  source_key  text not null,
  status      text not null check (status in ('queued', 'running', 'done', 'failed')),
  is_sample   boolean not null default false,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists reports_source_key_created_idx on public.reports (source_key, created_at desc);
create index if not exists reports_recent_idx on public.reports (created_at desc) where status = 'done' and not is_sample;

alter table public.reports enable row level security;

-- Frames (face-blurred) and rendered cards. Public so reverse-search engines
-- can fetch frames by URL.
insert into storage.buckets (id, name, public)
values ('frames', 'frames', true)
on conflict (id) do nothing;
