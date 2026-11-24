// Stockage des parties. Deux modes, même interface (toutes les méthodes renvoient une Promise) :
//  - « partagé » : base Supabase (clés dans js/config.js), ou feuille Google via Apps Script ;
//  - « local »   : navigateur seul (localStorage), pour essayer l'outil sans rien installer.
// Interface : listerParties, creerPartie, ouvrirPartie, lireEtat, majParams, ecrireLigne, supprimerLigne.
(function (racine) {
  "use strict";

  var CONFIG = racine.STRAT_CONFIG || {};

  // ---------- Mode partagé : Google Sheets via Apps Script ----------
  // Page servie par Apps Script : on passe par google.script.run.
  // Page hébergée ailleurs : on appelle l'URL du script (config.appsScriptUrl) en POST.
  function Partage(url) {
    this.mode = "partage";
    this.url = url || "";
  }
  Partage.prototype.appel = function (action, args) {
    var url = this.url;
    if (racine.google && racine.google.script && racine.google.script.run) {
      return new Promise(function (ok, ko) {
        racine.google.script.run
          .withSuccessHandler(function (r) { ok(JSON.parse(r)); })
          .withFailureHandler(function (e) { ko(new Error(String((e && e.message) || e).replace(/^Error:\s*/, ""))); })
          .appeler(action, args || {});
      });
    }
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: action, args: args || {} })
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r.ok) throw new Error(r.erreur || "Erreur du serveur");
      return r.resultat;
    });
  };
  Partage.prototype.listerParties = function () { return this.appel("listerParties"); };
  Partage.prototype.creerPartie = function (nom, mdp, params) { return this.appel("creerPartie", { nom: nom, mdp: mdp, params: params }); };
  Partage.prototype.ouvrirPartie = function (nom, mdp) { return this.appel("ouvrirPartie", { nom: nom, mdp: mdp }); };
  Partage.prototype.lireEtat = function (nom, mdp) { return this.appel("lireEtat", { nom: nom, mdp: mdp }); };
  Partage.prototype.majParams = function (nom, mdp, params) { return this.appel("majParams", { nom: nom, mdp: mdp, params: params }); };
  Partage.prototype.ecrireLigne = function (nom, mdp, ligne) { return this.appel("ecrireLigne", { nom: nom, mdp: mdp, ligne: ligne }); };
  Partage.prototype.supprimerLigne = function (nom, mdp, id) { return this.appel("supprimerLigne", { nom: nom, mdp: mdp, id: id }); };

  // ---------- Mode partagé : Supabase (fonctions SQL de supabase/schema.sql) ----------
  function Supabase(url, cle) {
    this.mode = "partage";
    this.url = url.replace(/\/+$/, "");
    this.cle = cle;
  }
  Supabase.prototype.rpc = function (fonction, args) {
    var entetes = { "Content-Type": "application/json", apikey: this.cle };
    // Ancienne clé « anon » (JWT) : on la passe aussi en Authorization. Nouvelle clé sb_publishable_ : apikey seul.
    if (this.cle.indexOf("sb_") !== 0) entetes.Authorization = "Bearer " + this.cle;
    return fetch(this.url + "/rest/v1/rpc/" + fonction, {
      method: "POST", headers: entetes, body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var corps = null;
        try { corps = t ? JSON.parse(t) : null; } catch (e) { corps = { message: t }; }
        if (!r.ok) throw new Error((corps && corps.message) || "Erreur du serveur (" + r.status + ")");
        return corps;
      });
    }, function () { throw new Error("Base injoignable : vérifiez la connexion internet."); });
  };
  Supabase.prototype.listerParties = function () { return this.rpc("lister_parties"); };
  Supabase.prototype.creerPartie = function (nom, mdp, params) { return this.rpc("creer_partie", { p_nom: nom, p_mdp: mdp, p_params: params }); };
  Supabase.prototype.ouvrirPartie = function (nom, mdp) { return this.rpc("ouvrir_partie", { p_nom: nom, p_mdp: mdp }); };
  Supabase.prototype.lireEtat = function (nom, mdp) { return this.rpc("lire_etat", { p_nom: nom, p_mdp: mdp }); };
  Supabase.prototype.majParams = function (nom, mdp, params) { return this.rpc("maj_params", { p_nom: nom, p_mdp: mdp, p_params: params }); };
  Supabase.prototype.ecrireLigne = function (nom, mdp, ligne) { return this.rpc("ecrire_ligne", { p_nom: nom, p_mdp: mdp, p_ligne: ligne }); };
  Supabase.prototype.supprimerLigne = function (nom, mdp, id) { return this.rpc("supprimer_ligne", { p_nom: nom, p_mdp: mdp, p_id: id }); };

  // ---------- Mode local (un seul navigateur) ----------
  var CLE_LOCALE = "strategikon.v1";

  function Local() { this.mode = "local"; }
  Local.prototype.lire = function () {
    try { return JSON.parse(localStorage.getItem(CLE_LOCALE)) || { parties: {} }; }
    catch (e) { return memoire; }
  };
  var memoire = { parties: {} };
  Local.prototype.ecrire = function (etat) {
    memoire = etat;
    try { localStorage.setItem(CLE_LOCALE, JSON.stringify(etat)); } catch (e) { /* stockage refusé : on garde en mémoire */ }
  };
  function cleNom(nom) { return String(nom || "").trim().toLowerCase(); }
  function hacher(texte) {
    if (racine.crypto && racine.crypto.subtle && racine.TextEncoder) {
      return racine.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      });
    }
    var h = 0;
    for (var i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) | 0;
    return Promise.resolve("simple-" + h);
  }
  Local.prototype.verifier = function (nom, mdp) {
    var etat = this.lire();
    var p = etat.parties[cleNom(nom)];
    if (!p) return Promise.reject(new Error("Partie introuvable"));
    return hacher(p.sel + mdp).then(function (h) {
      if (h !== p.mdp_hash) throw new Error("Mot de passe incorrect");
      return { etat: etat, partie: p };
    });
  };
  Local.prototype.listerParties = function () {
    var etat = this.lire();
    return Promise.resolve(Object.keys(etat.parties).map(function (k) {
      return { nom: etat.parties[k].nom, cree_le: etat.parties[k].cree_le };
    }).sort(function (a, b) { return a.cree_le < b.cree_le ? 1 : -1; }));
  };
  Local.prototype.creerPartie = function (nom, mdp, params) {
    var self = this;
    nom = String(nom || "").trim();
    if (!nom) return Promise.reject(new Error("Donnez un nom à la partie"));
    if (String(mdp || "").length < 4) return Promise.reject(new Error("Le mot de passe doit faire au moins 4 caractères"));
    var etat = this.lire();
    if (etat.parties[cleNom(nom)]) return Promise.reject(new Error("Une partie porte déjà ce nom"));
    var sel = Math.random().toString(36).slice(2);
    return hacher(sel + mdp).then(function (h) {
      var p = { id: "local-" + Date.now(), nom: nom, sel: sel, mdp_hash: h, params: params, cree_le: new Date().toISOString(), lignes: {} };
      etat.parties[cleNom(nom)] = p;
      self.ecrire(etat);
      return { id: p.id, nom: p.nom, params: p.params, cree_le: p.cree_le };
    });
  };
  Local.prototype.ouvrirPartie = function (nom, mdp) {
    return this.verifier(nom, mdp).then(function (r) {
      return { id: r.partie.id, nom: r.partie.nom, params: r.partie.params, cree_le: r.partie.cree_le };
    });
  };
  Local.prototype.majParams = function (nom, mdp, params) {
    var self = this;
    return this.verifier(nom, mdp).then(function (r) { r.partie.params = params; self.ecrire(r.etat); });
  };
  Local.prototype.lireEtat = function (nom, mdp) {
    return this.verifier(nom, mdp).then(function (r) {
      return {
        partie: { id: r.partie.id, nom: r.partie.nom, params: r.partie.params, cree_le: r.partie.cree_le },
        lignes: Object.keys(r.partie.lignes).map(function (k) { return JSON.parse(JSON.stringify(r.partie.lignes[k])); })
      };
    });
  };
  Local.prototype.ecrireLigne = function (nom, mdp, ligne) {
    var self = this;
    return this.verifier(nom, mdp).then(function (r) {
      var existante = r.partie.lignes[ligne.id];
      var l = JSON.parse(JSON.stringify(ligne));
      l.maj_le = existante ? existante.maj_le : new Date().toISOString();
      r.partie.lignes[ligne.id] = l;
      self.ecrire(r.etat);
    });
  };
  Local.prototype.supprimerLigne = function (nom, mdp, id) {
    var self = this;
    return this.verifier(nom, mdp).then(function (r) { delete r.partie.lignes[id]; self.ecrire(r.etat); });
  };

  var dansAppsScript = !!(racine.google && racine.google.script && racine.google.script.run);
  racine.STRAT_STOCKAGE = dansAppsScript ? new Partage("")
    : (CONFIG.supabaseUrl && CONFIG.supabaseCle) ? new Supabase(CONFIG.supabaseUrl, CONFIG.supabaseCle)
    : CONFIG.appsScriptUrl ? new Partage(CONFIG.appsScriptUrl)
    : new Local();
})(window);
