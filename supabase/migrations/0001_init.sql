-- Wingfoil Hunt: initial schema
-- All access goes through the server with the service role key.
-- RLS is enabled with no policies, so the anon key can read or write nothing.

create table users (
  id uuid primary key default gen_random_uuid(),
  igsid text unique,               -- Instagram-scoped id from DMs to the Wingfoil account
  ig_user_id text unique,          -- id from Instagram Login (voters)
  handle text,
  account_type text,
  followers_count int,
  media_count int,
  is_hunter boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index users_handle_lower_idx on users (lower(handle)) where handle is not null;

create table rounds (
  id bigserial primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  winner_submission_id uuid,
  closed_at timestamptz
);
create unique index rounds_one_open_idx on rounds (status) where status = 'open';

create table submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references users(id),
  media_type text not null check (media_type in ('image', 'video')),
  media_url text not null,         -- public URL in our own storage
  storage_path text not null,
  content_type text,
  caption text,
  athlete_handle text,
  rights_confirmed boolean not null default false,
  rights_confirmed_at timestamptz,
  status text not null default 'awaiting_rights'
    check (status in ('awaiting_rights', 'pending', 'approved', 'rejected', 'flagged', 'published')),
  screening_reason text,
  screening jsonb,
  round_id bigint references rounds(id),
  vote_count int not null default 0,
  report_count int not null default 0,
  ig_media_id text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index submissions_round_idx on submissions (round_id, status, vote_count desc);
create index submissions_status_idx on submissions (status, created_at desc);

alter table rounds add constraint rounds_winner_fk
  foreign key (winner_submission_id) references submissions(id);

create table votes (
  user_id uuid not null references users(id),
  submission_id uuid not null references submissions(id) on delete cascade,
  round_id bigint not null references rounds(id),
  ip_hash text,
  created_at timestamptz not null default now(),
  primary key (user_id, round_id)   -- one vote per person per round
);
create index votes_ip_round_idx on votes (round_id, ip_hash);

create table reports (
  id bigserial primary key,
  submission_id uuid not null references submissions(id) on delete cascade,
  reporter_id uuid references users(id),
  ip_hash text,
  reason text,
  created_at timestamptz not null default now()
);

-- DM conversation state per sender
create table conversations (
  igsid text primary key,
  state text not null default 'idle' check (state in ('idle', 'awaiting_rights')),
  pending_submission_id uuid references submissions(id),
  last_user_message_at timestamptz,
  last_text text,
  last_text_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Raw message log (in and out), also used for dedupe of webhook retries
create table messages (
  id bigserial primary key,
  igsid text not null,
  direction text not null check (direction in ('in', 'out')),
  mid text unique,
  text text,
  attachments jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index messages_igsid_idx on messages (igsid, created_at desc);

create table publish_log (
  id bigserial primary key,
  round_id bigint references rounds(id),
  submission_id uuid references submissions(id),
  dry_run boolean not null,
  payload jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);

alter table users enable row level security;
alter table rounds enable row level security;
alter table submissions enable row level security;
alter table votes enable row level security;
alter table reports enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table publish_log enable row level security;

-- Atomic vote: one per user per round, capped per IP per round.
create or replace function cast_vote(
  p_user uuid, p_submission uuid, p_ip_hash text, p_max_per_ip int
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round bigint;
  v_status text;
  v_ip_count int;
begin
  select s.round_id, s.status into v_round, v_status
  from submissions s join rounds r on r.id = s.round_id
  where s.id = p_submission and r.status = 'open' and r.ends_at > now();

  if v_round is null or v_status <> 'approved' then
    return 'not_votable';
  end if;

  if exists (select 1 from votes where user_id = p_user and round_id = v_round) then
    return 'already_voted';
  end if;

  if p_ip_hash is not null then
    select count(*) into v_ip_count from votes where round_id = v_round and ip_hash = p_ip_hash;
    if v_ip_count >= p_max_per_ip then
      return 'ip_limit';
    end if;
  end if;

  insert into votes (user_id, submission_id, round_id, ip_hash)
  values (p_user, p_submission, v_round, p_ip_hash);
  update submissions set vote_count = vote_count + 1 where id = p_submission;
  return 'ok';
exception when unique_violation then
  return 'already_voted';
end;
$$;

revoke execute on function cast_vote(uuid, uuid, text, int) from public, anon, authenticated;

-- Public media bucket (Meta media URLs expire, so we keep our own copy)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
