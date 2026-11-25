-- STRATEGIKON : réinitialiser toutes les parties de la base Supabase.
-- À exécuter dans Supabase > SQL Editor > New query, en dehors d'une séance de jeu.
-- La page publique ne peut pas effacer de partie (la clé publique n'y donne pas droit) :
-- seul le propriétaire du projet Supabase le fait, ici.

-- 1. Sauvegarde. Lancez cette requête seule, puis « Export » > CSV (ou copiez la cellule)
--    pour garder une copie de toutes les parties, de leurs paramètres et de leurs lignes.
select jsonb_pretty(coalesce(jsonb_agg(jsonb_build_object(
  'nom', p.nom,
  'cree_le', p.cree_le,
  'params', p.params,
  'lignes', (select coalesce(jsonb_agg(l.donnees order by l.maj_le), '[]'::jsonb) from public.lignes l where l.partie_id = p.id)
) order by p.cree_le), '[]'::jsonb)) as sauvegarde
from public.parties p;

-- 2. Effacement. Supprime toutes les parties ; leurs lignes partent avec (on delete cascade).
--    Les tables et les fonctions restent en place : on recrée une partie depuis la page d'accueil.
delete from public.parties;

-- 3. Contrôle : doit renvoyer 0 et 0.
select (select count(*) from public.parties) as parties, (select count(*) from public.lignes) as lignes;
