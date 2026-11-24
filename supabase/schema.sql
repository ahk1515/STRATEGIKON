-- STRATEGIKON : base partagée Supabase.
-- À coller une seule fois dans Supabase > SQL Editor > New query, puis « Run ».
-- Les tables sont fermées à l'accès direct ; la page passe uniquement par les
-- fonctions ci-dessous, qui vérifient le mot de passe de la partie à chaque appel.

create extension if not exists pgcrypto;

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) between 1 and 80),
  mdp_hash text not null,
  params jsonb not null default '{}'::jsonb,
  cree_le timestamptz not null default now()
);
create unique index if not exists parties_nom_unique on public.parties (lower(trim(nom)));

create table if not exists public.lignes (
  id text primary key,
  partie_id uuid not null references public.parties(id) on delete cascade,
  role text not null,
  donnees jsonb not null,
  maj_le timestamptz not null default now()
);
create index if not exists lignes_partie on public.lignes (partie_id);

alter table public.parties enable row level security;
alter table public.lignes enable row level security;
revoke all on public.parties from anon, authenticated;
revoke all on public.lignes from anon, authenticated;

create or replace function public._partie_autorisee(p_nom text, p_mdp text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_hash text;
begin
  select id, mdp_hash into v_id, v_hash from public.parties where lower(trim(nom)) = lower(trim(p_nom));
  if v_id is null then raise exception 'Partie introuvable'; end if;
  if v_hash <> crypt(coalesce(p_mdp, ''), v_hash) then raise exception 'Mot de passe incorrect'; end if;
  return v_id;
end $$;

create or replace function public._partie_json(p_id uuid)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', id, 'nom', nom, 'params', params, 'cree_le', cree_le) from public.parties where id = p_id
$$;

create or replace function public.lister_parties()
returns jsonb language sql security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('nom', nom, 'cree_le', cree_le) order by cree_le desc), '[]'::jsonb) from public.parties
$$;

create or replace function public.creer_partie(p_nom text, p_mdp text, p_params jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if length(trim(coalesce(p_nom, ''))) = 0 then raise exception 'Donnez un nom à la partie'; end if;
  if length(coalesce(p_mdp, '')) < 4 then raise exception 'Le mot de passe doit faire au moins 4 caractères'; end if;
  begin
    insert into public.parties (nom, mdp_hash, params)
    values (trim(p_nom), crypt(p_mdp, gen_salt('bf')), coalesce(p_params, '{}'::jsonb))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Une partie porte déjà ce nom';
  end;
  return public._partie_json(v_id);
end $$;

create or replace function public.ouvrir_partie(p_nom text, p_mdp text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  return public._partie_json(public._partie_autorisee(p_nom, p_mdp));
end $$;

create or replace function public.lire_etat(p_nom text, p_mdp text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_lignes jsonb;
begin
  v_id := public._partie_autorisee(p_nom, p_mdp);
  select coalesce(jsonb_agg(l.donnees || jsonb_build_object('id', l.id, 'role', l.role, 'maj_le', l.maj_le) order by l.maj_le), '[]'::jsonb)
    into v_lignes from public.lignes l where l.partie_id = v_id;
  return jsonb_build_object('partie', public._partie_json(v_id), 'lignes', v_lignes);
end $$;

create or replace function public.maj_params(p_nom text, p_mdp text, p_params jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.parties set params = coalesce(p_params, '{}'::jsonb) where id = public._partie_autorisee(p_nom, p_mdp);
  return true;
end $$;

create or replace function public.ecrire_ligne(p_nom text, p_mdp text, p_ligne jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_autre uuid;
begin
  v_id := public._partie_autorisee(p_nom, p_mdp);
  if p_ligne->>'id' is null or p_ligne->>'role' is null then raise exception 'Ligne incomplète'; end if;
  select partie_id into v_autre from public.lignes where id = p_ligne->>'id';
  if v_autre is not null and v_autre <> v_id then raise exception 'Cette ligne appartient à une autre partie'; end if;
  insert into public.lignes (id, partie_id, role, donnees, maj_le)
  values (p_ligne->>'id', v_id, p_ligne->>'role', p_ligne - 'id' - 'role' - 'maj_le', now())
  on conflict (id) do update set role = excluded.role, donnees = excluded.donnees, maj_le = now();
  return true;
end $$;

create or replace function public.supprimer_ligne(p_nom text, p_mdp text, p_id text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.lignes where id = p_id and partie_id = public._partie_autorisee(p_nom, p_mdp);
  return true;
end $$;

revoke execute on function public._partie_autorisee(text, text) from public, anon, authenticated;
revoke execute on function public._partie_json(uuid) from public, anon, authenticated;
grant execute on function public.lister_parties() to anon, authenticated;
grant execute on function public.creer_partie(text, text, jsonb) to anon, authenticated;
grant execute on function public.ouvrir_partie(text, text) to anon, authenticated;
grant execute on function public.lire_etat(text, text) to anon, authenticated;
grant execute on function public.maj_params(text, text, jsonb) to anon, authenticated;
grant execute on function public.ecrire_ligne(text, text, jsonb) to anon, authenticated;
grant execute on function public.supprimer_ligne(text, text, text) to anon, authenticated;
