-- ============================================================
-- LUHID (Livestock Unique Health ID) — Supabase / Postgres schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Matches the snake_case columns used by server.js.
-- ============================================================

-- Enable pgcrypto if you'd rather use UUID ids (optional — this schema uses
-- plain bigint identity ids, which is simpler and works fine with the API).

create table if not exists animals (
    id              bigint generated always as identity primary key,
    tag_code        varchar(16)   not null unique,      -- printed on the QR ear tag
    species         varchar(40)   not null,
    breed           varchar(80),
    sex             varchar(10),
    age_years       numeric(4,1),
    owner_name      varchar(120)  not null,
    owner_phone     varchar(20)   not null,
    village         varchar(120),
    district        varchar(120),
    notes           text,
    registered_at   timestamptz   not null default now(),
    is_lost         boolean       not null default false
);

create table if not exists health_logs (
    id              bigint generated always as identity primary key,
    animal_id       bigint not null references animals(id) on delete cascade,
    symptoms        text          not null,   -- comma/semicolon list of icon symptoms + free text
    severity        varchar(20),               -- mild / moderate / severe / emergency
    language        varchar(10),
    ai_advice       text,                      -- Gemini's returned first-aid triage text
    logged_at       timestamptz   not null default now(),
    source          varchar(20)   not null default 'online' -- online | synced-offline
);

create table if not exists vaccination_records (
    id              bigint generated always as identity primary key,
    animal_id       bigint not null references animals(id) on delete cascade,
    vaccine_name    varchar(120)  not null,
    given_on        date          not null,
    next_due_on     date,
    given_by        varchar(120)
);

create table if not exists rescue_alerts (
    id              bigint generated always as identity primary key,
    animal_id       bigint not null references animals(id) on delete cascade,
    latitude        double precision,
    longitude       double precision,
    message         varchar(300),
    created_at      timestamptz   not null default now()
);

-- Helpful index for the most common lookup (scanning a tag)
create index if not exists idx_animals_tag_code on animals(tag_code);
create index if not exists idx_health_logs_animal_id on health_logs(animal_id);
create index if not exists idx_vaccination_records_animal_id on vaccination_records(animal_id);
create index if not exists idx_rescue_alerts_animal_id on rescue_alerts(animal_id);

-- ============================================================
-- Row Level Security
-- ------------------------------------------------------------
-- server.js connects using the service_role key (SUPABASE_KEY), which
-- bypasses RLS entirely — so the API works immediately with no policies.
-- Still, enabling RLS is good practice in case anyone ever points the
-- anon/public key at these tables directly (e.g. from the browser).
-- The policies below deny all access to anon/authenticated roles; only
-- the service_role key (used by your backend) can read/write.
-- ============================================================
alter table animals enable row level security;
alter table health_logs enable row level security;
alter table vaccination_records enable row level security;
alter table rescue_alerts enable row level security;

-- No policies are created for anon/authenticated roles, so by default
-- those roles have zero access — only service_role (your server) can
-- read or write. If you later want the browser to talk to Supabase
-- directly instead of via server.js, add explicit, scoped policies here.
