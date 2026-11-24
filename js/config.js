// Base partagée. Laisser tout vide = mode local (chaque navigateur garde ses parties).
//
// Option 1, Supabase : collez l'URL du projet et la clé publique
// (Supabase > Project Settings > API Keys : « publishable » ou « anon public »).
// Cette clé peut être publique : les tables sont fermées et chaque appel vérifie
// le mot de passe de la partie.
//
// Option 2, Google Sheets : rien à remplir si l'outil est ouvert par le lien Apps Script ;
// sinon collez l'URL du déploiement Apps Script (elle finit par /exec).
window.STRAT_CONFIG = {
  supabaseUrl: "https://woxavwyljpqzhljutprg.supabase.co",
  supabaseCle: "sb_publishable_EP1fMsE6_INYupnQajGZbA_jGDX2rDp",
  appsScriptUrl: ""
};
