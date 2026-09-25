-- SplitMate Phase 2 Supabase schema
-- Safe to run as a new migration. This script creates only new objects and does not
-- delete or alter existing application data.
-- Never expose the service_role key in the browser. Frontend access uses the
-- publishable/anon key plus these RLS policies.

create extension if not exists pgcrypto;

create type public.group_member_role as enum ('admin', 'member');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_month_start_first_day check (month_start = date_trunc('month', month_start)::date),
  constraint budgets_user_month_unique unique (user_id, month_start)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'Other' check (category in ('Food', 'Rent', 'Travel', 'Shopping', 'Bills', 'Education', 'Entertainment', 'Health', 'Other')),
  expense_date date not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.group_member_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.shared_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 160),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  paid_by_user_id uuid not null references auth.users(id) on delete restrict,
  expense_date date not null,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_expense_participants (
  shared_expense_id uuid not null references public.shared_expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_owed numeric(12, 2) not null check (amount_owed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shared_expense_id, user_id)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete restrict,
  to_user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  settled_at timestamptz,
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_distinct_users check (from_user_id <> to_user_id)
);

create index if not exists budgets_user_month_idx on public.budgets (user_id, month_start);
create index if not exists expenses_user_date_idx on public.expenses (user_id, expense_date desc);
create index if not exists group_members_user_idx on public.group_members (user_id, group_id);
create index if not exists shared_expenses_group_date_idx on public.shared_expenses (group_id, expense_date desc);
create index if not exists shared_expenses_paid_by_idx on public.shared_expenses (paid_by_user_id);
create index if not exists shared_expense_participants_user_idx on public.shared_expense_participants (user_id, shared_expense_id);
create index if not exists settlements_group_date_idx on public.settlements (group_id, created_at desc);
create index if not exists settlements_from_user_idx on public.settlements (from_user_id);
create index if not exists settlements_to_user_idx on public.settlements (to_user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at before update on public.budgets for each row execute function public.set_updated_at();
drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses for each row execute function public.set_updated_at();
drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at before update on public.groups for each row execute function public.set_updated_at();
drop trigger if exists group_members_set_updated_at on public.group_members;
create trigger group_members_set_updated_at before update on public.group_members for each row execute function public.set_updated_at();
drop trigger if exists shared_expenses_set_updated_at on public.shared_expenses;
create trigger shared_expenses_set_updated_at before update on public.shared_expenses for each row execute function public.set_updated_at();
drop trigger if exists shared_expense_participants_set_updated_at on public.shared_expense_participants;
create trigger shared_expense_participants_set_updated_at before update on public.shared_expense_participants for each row execute function public.set_updated_at();
drop trigger if exists settlements_set_updated_at on public.settlements;
create trigger settlements_set_updated_at before update on public.settlements for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- SECURITY DEFINER helpers avoid recursive group_members RLS policy evaluation.
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id and gm.user_id = auth.uid() and gm.role = 'admin'
  ) or exists (
    select 1 from public.groups g
    where g.id = target_group_id and g.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
revoke all on function public.is_group_admin(uuid) from public;
grant execute on function public.is_group_admin(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.shared_expenses enable row level security;
alter table public.shared_expense_participants enable row level security;
alter table public.settlements enable row level security;

-- Re-runnable policy creation.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists budgets_own on public.budgets;
create policy budgets_own on public.budgets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists expenses_own on public.expenses;
create policy expenses_own on public.expenses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists groups_member_select on public.groups;
create policy groups_member_select on public.groups for select to authenticated using (owner_id = auth.uid() or public.is_group_member(id));
drop policy if exists groups_owner_insert on public.groups;
create policy groups_owner_insert on public.groups for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists groups_owner_update on public.groups;
create policy groups_owner_update on public.groups for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists groups_owner_delete on public.groups;
create policy groups_owner_delete on public.groups for delete to authenticated using (owner_id = auth.uid());

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to authenticated using (public.is_group_member(group_id) or public.is_group_admin(group_id));
drop policy if exists group_members_admin_insert on public.group_members;
create policy group_members_admin_insert on public.group_members for insert to authenticated with check (public.is_group_admin(group_id));
drop policy if exists group_members_admin_update on public.group_members;
create policy group_members_admin_update on public.group_members for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
drop policy if exists group_members_admin_delete on public.group_members;
create policy group_members_admin_delete on public.group_members for delete to authenticated using (public.is_group_admin(group_id));

-- The group member check also ensures the payer and creator belong to the group.
drop policy if exists shared_expenses_member_select on public.shared_expenses;
create policy shared_expenses_member_select on public.shared_expenses for select to authenticated using (public.is_group_member(group_id));
drop policy if exists shared_expenses_member_insert on public.shared_expenses;
create policy shared_expenses_member_insert on public.shared_expenses for insert to authenticated with check (public.is_group_member(group_id) and created_by_user_id = auth.uid() and public.is_group_member(group_id));
drop policy if exists shared_expenses_member_update on public.shared_expenses;
create policy shared_expenses_member_update on public.shared_expenses for update to authenticated using (public.is_group_member(group_id)) with check (public.is_group_member(group_id) and created_by_user_id = auth.uid());
drop policy if exists shared_expenses_creator_delete on public.shared_expenses;
create policy shared_expenses_creator_delete on public.shared_expenses for delete to authenticated using (created_by_user_id = auth.uid() or public.is_group_admin(group_id));

drop policy if exists shared_participants_member_select on public.shared_expense_participants;
create policy shared_participants_member_select on public.shared_expense_participants for select to authenticated using (exists (select 1 from public.shared_expenses se where se.id = shared_expense_id and public.is_group_member(se.group_id)));
drop policy if exists shared_participants_member_insert on public.shared_expense_participants;
create policy shared_participants_member_insert on public.shared_expense_participants for insert to authenticated with check (exists (select 1 from public.shared_expenses se where se.id = shared_expense_id and public.is_group_member(se.group_id)));
drop policy if exists shared_participants_member_update on public.shared_expense_participants;
create policy shared_participants_member_update on public.shared_expense_participants for update to authenticated using (exists (select 1 from public.shared_expenses se where se.id = shared_expense_id and public.is_group_member(se.group_id))) with check (exists (select 1 from public.shared_expenses se where se.id = shared_expense_id and public.is_group_member(se.group_id)));
drop policy if exists shared_participants_creator_delete on public.shared_expense_participants;
create policy shared_participants_creator_delete on public.shared_expense_participants for delete to authenticated using (exists (select 1 from public.shared_expenses se where se.id = shared_expense_id and (se.created_by_user_id = auth.uid() or public.is_group_admin(se.group_id))));

drop policy if exists settlements_member_select on public.settlements;
create policy settlements_member_select on public.settlements for select to authenticated using (public.is_group_member(group_id));
drop policy if exists settlements_member_insert on public.settlements;
create policy settlements_member_insert on public.settlements for insert to authenticated with check (public.is_group_member(group_id) and created_by_user_id = auth.uid());
drop policy if exists settlements_creator_update on public.settlements;
create policy settlements_creator_update on public.settlements for update to authenticated using (created_by_user_id = auth.uid() or public.is_group_admin(group_id)) with check (public.is_group_member(group_id));
drop policy if exists settlements_creator_delete on public.settlements;
create policy settlements_creator_delete on public.settlements for delete to authenticated using (created_by_user_id = auth.uid() or public.is_group_admin(group_id));

-- Keep the API surface explicit. Supabase grants table privileges separately from RLS.
grant select, insert, update, delete on public.profiles, public.budgets, public.expenses, public.groups, public.group_members, public.shared_expenses, public.shared_expense_participants, public.settlements to authenticated;
revoke all on public.profiles, public.budgets, public.expenses, public.groups, public.group_members, public.shared_expenses, public.shared_expense_participants, public.settlements from anon;
