-- À coller dans Supabase → SQL Editor → Run.
-- Une ligne par utilisateur, qui contient toutes ses données en JSON.

create table if not exists public.sl_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.sl_data enable row level security;

-- Chacun ne peut lire / écrire QUE sa propre ligne.
create policy "lecture perso" on public.sl_data
  for select using (auth.uid() = user_id);
create policy "ajout perso" on public.sl_data
  for insert with check (auth.uid() = user_id);
create policy "modif perso" on public.sl_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
