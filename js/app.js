// STRATEGIKON, conception « table d'abord » : le joueur agit sur la table de l'année,
// les lignes de la base sont écrites en arrière-plan.
(function () {
  "use strict";

  var M = window.STRAT_MOTEUR;
  var S = window.STRAT_STOCKAGE;
  var PIONS = window.STRAT_PIONS || [];
  var CATALOGUE = window.STRAT_CATALOGUE_ROLES || [];
  var REGLES = window.STRAT_CONTRAINTES_ROLES || [];
  var IDX = M.indexPions(PIONS);
  var ROLES_REGLAGES = ["Animateur", "SC-Plans", "CEMA"];
  var ROLES_ARBITRAGE = ["CEMA", "Animateur"];
  var ROLES_VUE_COMPLETE = ["CEMA", "Animateur", "SC-Plans"];
  var ROLES_CONTRAINTE = ["MINARM", "Animateur"];           // cochent la contrainte politique
  var ROLES_FINANCEMENT = ["DGRIS", "DGA", "MEFR", "Animateur"]; // proposent un montage de financement
  var ROLES_ETALEMENT = ["CEMA", "SC-Plans", "Animateur"];   // placent les lignes sur la trajectoire
  var FIN = M.ANNEES[M.ANNEES.length - 1];
  var CLE_SESSION = "strategikon.table";

  var etat = {
    partie: null, mdp: "", role: "", lignes: [], annee: M.ANNEES[0], vue: "demandes",
    volet: "poser", filtre: "capacites", portee: "suite", recherche: "", selection: null, neuf: null, maTable: true,
    phase: null // "cible" (modèle 2032) ou "trajectoire" (2027-2032)
  };
  var enAttente = {};
  var signature = "";

  // ---------- Outils ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === "texte") n.textContent = v;
      else if (k === "classe") n.className = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
    });
    (enfants || []).forEach(function (e) { if (e !== null && e !== undefined && e !== false) n.appendChild(typeof e === "string" ? document.createTextNode(e) : e); });
    return n;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function md(m) {
    var signe = m < 0 ? "−" : "";
    m = Math.abs(m);
    if (m >= 1000) return signe + (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " Md€";
    return signe + m.toLocaleString("fr-FR") + " M€";
  }
  function couleur(a) { return { "Terre": "var(--terre)", "Marine": "var(--marine)", "Air et Espace": "var(--air)", "Interarmées": "var(--inter)" }[a] || "var(--inter)"; }
  function nouvelId() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "l-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function role(code) { return M.ROLES.filter(function (r) { return r.code === code; })[0] || M.ROLES[0]; }
  function vueComplete() { return ROLES_VUE_COMPLETE.indexOf(etat.role) !== -1; }
  function arbitre() { return ROLES_ARBITRAGE.indexOf(etat.role) !== -1; }
  function visible(l) { return vueComplete() || l.role === etat.role; }
  function params() { return (etat.partie && etat.partie.params && etat.partie.params.plafonds) ? etat.partie.params : M.parametresParDefaut(); }
  function phase() { return etat.phase || (params().phase === "trajectoire" ? "trajectoire" : "cible"); }
  function enCible() { return phase() === "cible"; }
  // Lignes telles qu'elles pèsent dans la phase : au modèle 2032, les lignes cibles ne sont qu'en 2032 ;
  // sur la trajectoire, elles entrent à l'année fixée par l'étalement.
  function paramsPhase() { var p = params(); return enCible() ? Object.assign({}, p, { debuts: {} }) : p; }
  function lignesJeu() { return M.lignesEnTrajectoire(etat.lignes, paramsPhase()); }
  function effective(l) { return M.ligneEffective(l, paramsPhase()); }
  // Chiffrage d'une ligne pour la France : phase, financement et remboursements compris.
  function chiffre(l) {
    var e = effective(l), p = params();
    var f = M.financements(e, IDX, p), r = M.remboursements(e, IDX, p), c = M.coutLigne(e, IDX);
    var tot = 0, an = {};
    M.ANNEES.forEach(function (a) { an[a] = f[a].cout + (r[a] || 0); tot += an[a]; });
    return { total: tot, brut: c.total, annees: an, totalDorese: c.totalDorese, hors: (r.hors || 0) + (e.horsLpm || 0) };
  }
  function peutContraindre() { return ROLES_CONTRAINTE.indexOf(etat.role) !== -1; }
  function peutEtaler() { return ROLES_ETALEMENT.indexOf(etat.role) !== -1; }
  function libellePriorite(n) { return n ? "P" + n : "—"; }
  function optionDe(code) { return code ? CATALOGUE.filter(function (o) { return o.code === code; })[0] || null : null; }
  function ligneDe(id) { return id ? etat.lignes.filter(function (l) { return l.id === id; })[0] || null : null; }
  function armeeDuRole() { return role(etat.role).armee; }
  function dansMonPerimetre(p) {
    if (vueComplete()) return true;
    var a = armeeDuRole();
    return a === "Interarmées" ? true : p.armee === a;
  }
  // Pions en place qui relèvent de mon rôle (vue « Ma demande »).
  function pionAMoi(p) {
    if (!p || p.type === "gris" || p.type === "orange" || vueComplete()) return false;
    return p.armee === armeeDuRole();
  }
  function fourchette(o) {
    var u = o.annuel ? "/an" : "";
    if (o.cout === null || o.cout === undefined) return o.statut_cout === "a_definir" ? "coût à définir" : "non chiffré";
    if (o.cout_max && o.cout_max !== o.cout) return o.cout + " à " + o.cout_max + " M€" + u;
    return o.cout + " M€" + u;
  }
  function libelleLigne(l) {
    if (l.type === "libre") return l.libelle || "Pion sur mesure";
    var p = IDX[l.pion];
    return p ? p.nom : l.pion;
  }
  function natureLigne(l) {
    if (l.type === "ajout") return "Nouvel exemplaire à " + (Number(l.niveau) === 100 ? "100 %" : "50 %");
    if (l.type === "dorese") return "Renforcement à 100 %";
    if (l.type === "retrait") return "Dissolution";
    if (l.type === "degrade") return "Repassage à 50 %";
    return l.modele ? "Option de la fiche " + ((optionDe(l.modele) || {}).role || "") : "Pion sur mesure";
  }
  function anneesDe(l) {
    l = effective(l);
    if (l.cible && M.debutDe(l, params()) === M.APRES_LPM && !enCible()) return "après 2032";
    var a = M.ANNEES.filter(function (x) { return M.quantite(l, x) > 0; });
    if (!a.length) return "aucune année";
    var suite = a.length > 1 && a[a.length - 1] - a[0] === a.length - 1;
    return suite ? a[0] + "–" + a[a.length - 1] : a.join(", ");
  }
  function anneesPortee() {
    if (enCible()) return [FIN];
    return etat.portee === "annee" ? [etat.annee] : M.ANNEES.filter(function (a) { return a >= etat.annee; });
  }
  function textePortee() {
    if (enCible()) return "au modèle 2032";
    return etat.portee === "annee" ? "en " + etat.annee : etat.annee === M.ANNEES[M.ANNEES.length - 1] ? "en " + etat.annee : "de " + etat.annee + " à " + M.ANNEES[M.ANNEES.length - 1];
  }
  var minuteur;
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(minuteur); minuteur = setTimeout(function () { t.hidden = true; }, 2600); }
  function memoriser() {
    try {
      if (etat.partie && etat.role) sessionStorage.setItem(CLE_SESSION, JSON.stringify({ nom: etat.partie.nom, mdp: etat.mdp, role: etat.role, annee: etat.annee, phase: etat.phase }));
      else sessionStorage.removeItem(CLE_SESSION);
    } catch (e) { /* rien */ }
  }

  // ---------- Accueil ----------
  function chargerParties() {
    var sel = $("rej-partie");
    vider(sel);
    return S.listerParties().then(function (liste) {
      if (!liste.length) sel.appendChild(el("option", { value: "", texte: "Aucune partie ouverte" }));
      liste.forEach(function (p) { sel.appendChild(el("option", { value: p.nom, texte: p.nom })); });
    }).catch(function (e) { sel.appendChild(el("option", { value: "", texte: "Liste indisponible" })); $("rej-erreur").textContent = e.message; });
  }
  function etapeAccueil(nom) {
    $("form-rejoindre").hidden = nom !== "rejoindre";
    $("form-creer").hidden = nom !== "creer";
    $("etape-role").hidden = nom !== "role";
  }
  function montrerRoles(partie, mdp) {
    etat.partie = partie; etat.mdp = mdp;
    $("ecran-partie").hidden = true; $("ecran-accueil").hidden = false;
    etapeAccueil("role");
    $("nom-partie-role").textContent = partie.nom;
    var g = $("grille-roles");
    vider(g);
    M.ROLES.forEach(function (r) {
      g.appendChild(el("button", { classe: "role-ligne", type: "button", style: "--c:" + couleur(r.armee), onclick: function () { entrer(r.code); } }, [
        el("b", { texte: r.code }), el("span", { texte: r.nom })
      ]));
    });
  }
  function entrer(code) {
    etat.role = code;
    etat.selection = null;
    etat.maTable = !vueComplete();
    etat.volet = "poser";
    etat.filtre = role(code).armee === "Interarmées" && CATALOGUE.some(function (o) { return o.role === code; }) ? "options" : "capacites";
    $("ecran-accueil").hidden = true;
    $("ecran-partie").hidden = false;
    $("poste-partie").textContent = etat.partie.nom;
    $("insigne-code").textContent = code;
    $("insigne-nom").textContent = role(code).nom;
    memoriser();
    signature = "";
    return recharger(true);
  }
  function quitter() {
    etat.partie = null; etat.mdp = ""; etat.role = ""; etat.lignes = []; signature = "";
    memoriser();
    $("ecran-partie").hidden = true; $("ecran-accueil").hidden = false;
    etapeAccueil("rejoindre");
    chargerParties();
  }

  // ---------- Données ----------
  function recharger(forcer) {
    if (!etat.partie) return Promise.resolve();
    var nom = etat.partie.nom;
    return S.lireEtat(nom, etat.mdp).then(function (e) {
      if (!etat.partie || etat.partie.nom !== nom) return;
      var lignes = e.lignes.slice().sort(function (a, b) { return (a.cree_le || "") < (b.cree_le || "") ? -1 : 1; });
      lignes = lignes.map(function (l) { return enAttente[l.id] ? (ligneDe(l.id) || l) : l; });
      etat.lignes.forEach(function (l) { if (enAttente[l.id] && !lignes.some(function (x) { return x.id === l.id; })) lignes.push(l); });
      var sig = JSON.stringify(lignes) + JSON.stringify(e.partie.params);
      etat.partie.params = e.partie.params;
      etat.lignes = lignes;
      if (forcer || sig !== signature) { signature = sig; rendre(forcer); }
    }).catch(function (e) { toast(e.message); });
  }
  function enregistrer(l) {
    clearTimeout(enAttente[l.id]);
    enAttente[l.id] = setTimeout(function () {
      S.ecrireLigne(etat.partie.nom, etat.mdp, l).then(function () { delete enAttente[l.id]; })
        .catch(function (e) { delete enAttente[l.id]; toast("Non enregistré : " + e.message); });
    }, 350);
  }
  function supprimer(l) {
    clearTimeout(enAttente[l.id]); delete enAttente[l.id];
    etat.lignes = etat.lignes.filter(function (x) { return x.id !== l.id; });
    S.supprimerLigne(etat.partie.nom, etat.mdp, l.id).catch(function (e) { toast(e.message); });
  }
  var fileParams = Promise.resolve();
  function modifierParams(fn) {
    fileParams = fileParams.then(function () {
      return S.lireEtat(etat.partie.nom, etat.mdp).then(function (e) {
        var p = e.partie.params && e.partie.params.plafonds ? e.partie.params : M.parametresParDefaut();
        fn(p);
        return S.majParams(etat.partie.nom, etat.mdp, p).then(function () { etat.partie.params = p; rendre(false); });
      });
    }).catch(function (e) { toast("Non enregistré : " + e.message); });
    return fileParams;
  }

  // ---------- Gestes sur la table : ils écrivent les lignes ----------
  function memeGeste(l, g) {
    if (l.role !== etat.role || l.type !== g.type || !!l.cible !== enCible()) return false;
    if (g.type === "ajout") return l.pion === g.pion && Number(l.niveau) === Number(g.niveau);
    if (g.type === "dorese" || g.type === "retrait" || g.type === "degrade") return l.pion === g.pion;
    if (g.type === "libre") return !!g.modele && l.modele === g.modele;
    return false;
  }
  // Pose un pion (ou un renforcement, une dissolution) sur les années de la portée.
  function poser(g) {
    var ans = anneesPortee();
    var l = etat.lignes.filter(function (x) { return memeGeste(x, g); })[0];
    if (!l) {
      var r = role(etat.role);
      l = { id: nouvelId(), role: etat.role, type: g.type, qte: {}, justification: "", cree_le: new Date().toISOString() };
      if (enCible()) l.cible = true;
      M.ANNEES.forEach(function (a) { l.qte[a] = 0; });
      if (g.type === "libre") {
        var o = optionDe(g.modele);
        l.modele = o ? o.code : null;
        l.libelle = g.libelle || (o ? o.libelle : "");
        l.armee = g.armee || (o ? o.armee : r.armee);
        l.source = o ? o.source : null;
        l.cout_unitaire = g.cout !== undefined ? M.arrondiCase(g.cout) : (o && o.cout ? M.arrondiCase(o.cout) : 0);
        l.dorese = o && o.dorese ? { ao: o.dorese.ao || 0, mco: o.dorese.mco || 0, rh: o.dorese.rh || 0 } : { ao: 0, mco: 0, rh: 0 };
      } else {
        var p = IDX[g.pion];
        l.pion = p.id;
        l.niveau = g.niveau || 100;
        l.armee = r.armee !== "Interarmées" ? r.armee : p.armee;
      }
      etat.lignes.push(l);
    }
    ans.forEach(function (a) {
      var q = Number(l.qte[a]) || 0;
      l.qte[a] = g.type === "ajout" || (g.type === "libre" && !g.modele) ? q + 1 : 1;
    });
    enregistrer(l);
    etat.selection = { ligne: l.id, pion: l.pion || null };
    etat.neuf = l.id;
    etat.volet = "selection";
    rendre(true);
    toast(natureLigne(l) + " · " + libelleLigne(l) + " · " + textePortee());
    return l;
  }
  // Retire le geste sur les années de la portée ; la ligne disparaît quand plus rien n'est posé.
  function enlever(l) {
    anneesPortee().forEach(function (a) {
      var q = Number(l.qte[a]) || 0;
      l.qte[a] = l.type === "ajout" || l.type === "libre" ? Math.max(0, q - 1) : 0;
    });
    if (!M.ANNEES.some(function (a) { return M.quantite(l, a) > 0; })) { supprimer(l); etat.selection = null; etat.volet = "poser"; }
    else enregistrer(l);
    rendre(true);
  }

  // ---------- Rendu ----------
  // Alertes des règles des fiches : recalculées à chaque rendu, jamais bloquantes.
  var ALERTES = [];
  function calculerAlertes() {
    try { ALERTES = M.alertes(PIONS, etat.lignes, paramsPhase(), CATALOGUE); } catch (e) { ALERTES = []; }
  }
  function alertesDe(id) { return ALERTES.filter(function (a) { return a.ligne === id; }); }
  function alertesVisibles() { return ALERTES.filter(function (a) { var l = ligneDe(a.ligne); return !a.ligne || (l && visible(l)); }); }
  function regleDe(id) { return REGLES.filter(function (r) { return r.id === id; })[0] || null; }
  function marqueAlerte(liste) {
    var fortes = liste.filter(function (a) { return a.niveau === "alerte"; });
    if (!fortes.length) return null;
    return el("span", { classe: "marque-alerte", title: fortes.map(function (a) { return a.regle + " : " + a.message; }).join("\n") }, ["!"]);
  }
  function listeAlertes(liste, avecLigne) {
    var ul = el("ul", { classe: "alertes" });
    liste.forEach(function (a) {
      var r = regleDe(a.regle), l = ligneDe(a.ligne);
      ul.appendChild(el("li", { classe: "alerte-" + a.niveau }, [
        el("span", { classe: "regle-tete" }, [el("b", { texte: a.niveau === "alerte" ? "Alerte" : "À savoir" }), el("span", { classe: "badge", texte: a.regle }),
          avecLigne && l ? el("button", { type: "button", classe: "btn-lien", texte: libelleLigne(l) + " · " + l.role, onclick: function () { etat.selection = { ligne: l.id, pion: l.pion || null }; etat.volet = "selection"; rendre(true); } }) : null]),
        el("span", { texte: a.message }),
        r ? el("small", { texte: r.regle + (r.qui_peut_lever ? " · Levée : " + r.qui_peut_lever : "") + " · " + r.source + (r.pages ? " p. " + r.pages : "") }) : null
      ]));
    });
    return ul;
  }

  function rendre(complet) {
    if (enCible()) etat.annee = FIN;
    calculerAlertes();
    rendreParcours();
    rendreJauges();
    rendreTable();
    var actif = document.activeElement;
    var saisie = actif && /^(INPUT|TEXTAREA|SELECT)$/.test(actif.tagName) && $("volet").contains(actif);
    if (complet || !saisie) rendreVolet();
  }

  function rendreParcours() {
    var g = $("parcours");
    if (!g) return;
    vider(g);
    [["cible", "1", "Modèle 2032", "chaque pôle compose sa table 2032, le CEMA arbitre"], ["trajectoire", "2", "Trajectoire 2027-2032", "on étale ce qui est retenu sous les plafonds"]].forEach(function (x) {
      g.appendChild(el("button", { type: "button", "aria-pressed": phase() === x[0] ? "true" : "false", title: x[3], onclick: function () {
        etat.phase = x[0];
        if (x[0] === "trajectoire" && etat.annee === FIN) etat.annee = M.ANNEES[0];
        memoriser(); rendre(true);
      } }, [el("b", { texte: x[1] }), x[2]]));
    });
  }

  function rendreJauges() {
    var j = $("jauges");
    vider(j);
    var p = params();
    var lignes = etat.vue === "arbitrage" ? M.lignesApresArbitrage(lignesJeu(), p) : lignesJeu();
    var syn = M.synthese(PIONS, lignes, p);
    M.ANNEES.forEach(function (a) {
      if (enCible() && a !== FIN) return;
      var s = syn[a];
      var tableMax = Math.max(s.table, s.total);
      var barre = el("span", { classe: "mini-barre" }, [
        el("span", { style: "width:" + (100 * Math.min(s.total, tableMax) / tableMax) + "%", classe: s.marge < 0 ? "trop" : "" }),
        el("i", { style: "left:" + (100 * s.plafond / tableMax) + "%" })
      ]);
      j.appendChild(el("button", { classe: "an-jauge", type: "button", role: "tab", "aria-selected": a === etat.annee ? "true" : "false",
        onclick: function () { etat.annee = a; memoriser(); rendre(true); } }, [
        el("span", { classe: "an-jauge-an", texte: String(a) }),
        barre,
        el("span", { classe: "an-jauge-val " + (s.marge < 0 ? "neg" : "pos"), texte: s.marge < 0 ? "dépasse de " + md(-s.marge) : "marge " + md(s.marge) })
      ]));
    });
  }

  function selectionCorrespond(x) {
    var s = etat.selection;
    if (!s) return false;
    if (s.ligne && x.ligne === s.ligne) return true;
    return !s.ligne && s.pion && x.socle && x.pion === s.pion;
  }

  function rendreTable() {
    var p = params();
    var lignes = etat.vue === "arbitrage" ? M.lignesApresArbitrage(lignesJeu(), p) : lignesJeu();
    var syn = M.synthese(PIONS, lignes, p)[etat.annee];
    // Ligne de flottaison de l'année : les demandes qui passent sous le plafond.
    var flot = M.flottaison(PIONS, lignes, p, etat.annee);
    var sousLigne = {};
    flot.sous.forEach(function (it) { if (it.ligne) sousLigne[it.ligne.id] = true; if (it.enveloppe) sousLigne["env:" + it.enveloppe.id] = true; });
    // Filtre « Ma demande » : on ne pose que mes pions, regroupés sur une table compacte.
    var filtre = etat.maTable;
    var t = filtre
      ? M.placerAnnee(PIONS, lignes.filter(function (l) { return l.role === etat.role; }), p, etat.annee, function (x) { return pionAMoi(x); }, { apresArbitrage: etat.vue === "arbitrage" })
      : M.placerAnnee(PIONS, lignes, p, etat.annee, null, { apresArbitrage: etat.vue === "arbitrage" });
    if (filtre) {
      var bas = 0;
      t.pieces.forEach(function (x) { bas = Math.max(bas, x.r + x.h); });
      t.cellules.forEach(function (x) { bas = Math.max(bas, x.r + 1); });
      t.hauteur = Math.max(4, bas + 2);
    }
    document.querySelectorAll(".bascule button[data-vue]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-vue") === etat.vue ? "true" : "false"); });
    document.querySelectorAll(".bascule button[data-filtre]").forEach(function (b) { b.setAttribute("aria-pressed", (b.getAttribute("data-filtre") === "mien") === etat.maTable ? "true" : "false"); });

    var rel = $("table-releve");
    vider(rel);
    [filtre ? ["Ma demande " + etat.annee, md(t.occupees * M.CASE) + " · " + t.occupees + " cases", ""] : ["Table " + etat.annee, t.occupees + " / " + t.plafond + " cases", ""], ["Montant total", md(syn.total), ""], ["Plafond", md(syn.plafond), ""],
      [syn.marge >= 0 ? "Marge" : "Dépassement", md(Math.abs(syn.marge)), syn.marge >= 0 ? "pos" : "neg"]].forEach(function (x) {
      rel.appendChild(el("div", { classe: "releve" }, [el("small", { texte: x[0] }), el("b", { classe: x[2], texte: x[1] })]));
    });
    $("consigne").textContent = (enCible() ? "Étape 1 · modèle 2032. " : "Étape 2 · trajectoire " + etat.annee + ". ") + (arbitre()
      ? "Les demandes à trancher sont regroupées en bas, dans le cadre « Demandes à arbitrer ». Cliquez sur l'une d'elles pour la retenir, la différer ou y renoncer."
      : filtre ? "Vos pions seuls, regroupés. Cliquez sur un pion pour le modifier, sur une case vide pour en poser un nouveau. « Toute la table » les remet parmi les autres."
      : "Les pions en place sont votre point de départ. Cliquez sur un pion pour le modifier, sur une case vide pour en poser un nouveau.")
      + (function () { var n = alertesVisibles().filter(function (a) { return a.niveau === "alerte"; }).length; return n ? " " + n + " alerte" + (n > 1 ? "s" : "") + " des fiches (pastille « ! »)." : ""; })()
      + (flot.sous.length ? " " + flot.sous.length + " demande" + (flot.sous.length > 1 ? "s passent" : " passe") + " sous la ligne de flottaison (barre rouge)." : "");

    var pl = $("plateau");
    vider(pl);
    pl.style.gridTemplateRows = "repeat(" + t.hauteur + ", var(--case))";
    for (var k = 0; k < t.hauteur * t.largeur; k++) {
      pl.appendChild(el("div", { classe: "fond fond-clic" + (filtre ? "" : k >= t.table ? " fond-horstable" : k >= t.plafond ? " fond-hors" : ""), title: "Poser un nouveau pion en " + etat.annee, style: "grid-row:" + (Math.floor(k / t.largeur) + 1) + ";grid-column:" + (k % t.largeur + 1),
        onclick: function () { etat.selection = null; etat.volet = "poser"; rendre(true); toast("Choisissez à droite le pion à poser en " + etat.annee); } }));
    }
    // Zone des demandes non encore arbitrées : un cadre et son titre.
    var enZone = t.pieces.filter(function (x) { return x.groupe === "Attente"; }).concat(t.cellules.filter(function (x) { return x.groupe === "Attente"; }));
    if (enZone.length) {
      var r1 = Math.min.apply(null, enZone.map(function (x) { return x.r; }));
      var r2 = Math.max.apply(null, enZone.map(function (x) { return x.r + (x.h || 1); }));
      var parStatut = { attente: {}, differe: {}, renonce: {} };
      enZone.forEach(function (x) { if (x.ligne && parStatut[x.statut]) parStatut[x.statut][x.ligne] = true; });
      var attente = Object.keys(parStatut.attente);
      var montant = attente.reduce(function (acc, id) { var l = ligneDe(id); return acc + (l ? chiffre(l).annees[etat.annee] : 0); }, 0);
      var morceaux = [attente.length + " en attente d'arbitrage" + (attente.length ? " (" + md(montant) + ")" : "")];
      var nd = Object.keys(parStatut.differe).length, nr = Object.keys(parStatut.renonce).length;
      if (nd) morceaux.push(nd + " différée" + (nd > 1 ? "s" : ""));
      if (nr) morceaux.push(nr + " renoncée" + (nr > 1 ? "s" : ""));
      pl.appendChild(el("div", { classe: "zone-attente", style: "grid-row:" + r1 + " / " + (r2 + 1) + ";grid-column:1 / -1" }));
      pl.appendChild(el("div", { classe: "zone-attente-titre", style: "grid-row:" + r1 + ";grid-column:1 / -1" }, [el("span", { texte: "Demandes à arbitrer · " + morceaux.join(" · ") })]));
    }
    function depasse(r, c, w, h) { if (filtre) return false; for (var i = r; i < r + h; i++) for (var j = c; j < c + w; j++) if (i * t.largeur + j >= t.plafond) return true; return false; }
    function masque(x) { return x.role && !vueComplete() && x.role !== etat.role; }
    function estompe(x) { return false; }
    function choisir(x) {
      return function () {
        etat.selection = { ligne: x.ligne || null, pion: x.pion || null, socle: !!x.socle && !x.ligne };
        etat.volet = "selection";
        rendre(true);
      };
    }
    var F = window.STRAT_FIGURATIFS;
    function court(nom) { return nom.replace(/^Capacité /, "").replace(/^Brigade /, "Bde ").replace(/^\+ Capacité /, "+ "); }
    t.pieces.forEach(function (x) {
      var bande = x.groupe === "Fixes" ? "var(--gris-carte)" : x.nature === "violet" ? "var(--violet)" : x.nature === "orange" ? "var(--orange-carte)" : couleur(x.armee);
      var cl = ["pion", "pion-clic", "fig"];
      var aire = x.w * x.h, petit = Math.min(x.w, x.h) === 1 && Math.max(x.w, x.h) <= 3;
      cl.push(x.w >= x.h ? "fig-h" : "fig-v");
      if (petit) cl.push("fig-mini");
      if (x.nature === "orange") cl.push("fig-alea");
      if (x.niveau === 50) cl.push("fig-rouge");
      if (x.statut) cl.push("pion-" + x.statut);
      if (depasse(x.r, x.c, x.w, x.h)) cl.push("pion-debord");
      if (x.role && x.role === etat.role) cl.push("pion-mien");
      if (selectionCorrespond(x)) cl.push("pion-choisi");
      if (x.ligne && x.ligne === etat.neuf) cl.push("pion-neuf");
      if (estompe(x)) cl.push("pion-estompe");
      var mq = x.marques || null;
      if (x.ligne && sousLigne[x.ligne]) cl.push("pion-sous");
      if (mq && mq.defection) cl.push("pion-defection");
      var cache = masque(x);
      var nom = cache ? "Demande " + x.armee : x.libelle;
      var pion = x.pion ? IDX[x.pion] : null;
      var picto = cache ? null : F.svg(F.pictoDe(x.libelle) || "puce");
      var enfants = [el("span", { classe: "fig-bande" }, [el("span", { classe: "fig-titre", texte: court(nom) })])];
      if (picto) enfants.push(el("span", { classe: "fig-picto" }, [picto]));
      var notes = [];
      if (mq && mq.contrainte) { enfants.push(el("span", { classe: "drapeau drapeau-pion", title: "Contrainte politique : non arbitrable" })); notes.push("contrainte politique"); }
      if (mq && mq.part < 1) { enfants.push(el("span", { classe: "part-alliee", style: "width:" + Math.round(100 * (1 - mq.part)) + "%" })); }
      if (mq && mq.financement) {
        enfants.push(el("span", { classe: "marque-fin" + (mq.financementActif ? "" : " marque-proposee"), title: M.MODES_FINANCEMENT[mq.financement] }, [mq.financement === "mutualise" ? F.svg("globe") : el("b", { texte: "UE" })]));
        notes.push(mq.financement === "mutualise" ? "dépendant d'un allié" : M.MODES_FINANCEMENT[mq.financement].toLowerCase());
      }
      if (mq && mq.defection) notes.push("défection de l'allié");
      if (x.ligne && sousLigne[x.ligne]) notes.push("sous la ligne de flottaison");
      var ma = x.ligne && !cache ? marqueAlerte(alertesDe(x.ligne)) : null;
      if (ma) { enfants.push(ma); notes.push("alerte des fiches"); }
      if (pion && pion.type === "capacite" && M.nbDorese(pion) && !petit && aire >= 4) {
        var co = el("span", { classe: "fig-coins" });
        ["ao", "mco", "rh"].forEach(function (k) {
          var ic = F.svg(F.DORESE[k]);
          co.appendChild(el("span", { classe: "fig-coin", title: "DORESE " + k.toUpperCase() + " requises" }, [ic, el("b", { texte: String(pion.dorese[k]) })]));
        });
        enfants.push(co);
      }
      pl.appendChild(el("button", { type: "button", classe: cl.join(" "), title: nom + (x.niveau ? " · " + (x.niveau === 50 ? "face rouge (dégradée)" : "à 100 %") : "") + (x.role && !cache ? " · " + x.role : "") + (x.statut ? " · " + M.STATUTS[x.statut].toLowerCase() : x.socle ? " · socle arbitré" : " · retenu") + (notes.length ? " · " + notes.join(" · ") : ""),
        style: "grid-row:" + (x.r + 1) + " / span " + x.h + ";grid-column:" + (x.c + 1) + " / span " + x.w + ";--bande:" + bande, onclick: choisir(x) }, enfants));
    });
    var drapeauxPoses = {}, alertesPosees = {};
    t.cellules.forEach(function (x) {
      var cl = ["pion", "pion-case", "pion-clic"];
      cl.push(x.nature === "dorese" ? "jeton" : "jeton-option");
      if (x.statut) cl.push("pion-" + x.statut);
      if (x.horsCatalogue) cl.push("pion-mesure");
      if (x.allie) cl.push("jeton-allie");
      if ((x.ligne && sousLigne[x.ligne]) || (x.enveloppe && sousLigne["env:" + x.enveloppe])) cl.push("pion-sous");
      if (x.marques && x.marques.defection) cl.push("pion-defection");
      if (x.enveloppe) cl.push("jeton-enveloppe");
      var drap = x.marques && x.marques.contrainte && x.ligne && !drapeauxPoses[x.ligne];
      if (drap) drapeauxPoses[x.ligne] = true;
      var alerteCase = null;
      if (x.ligne && x.nature !== "dorese" && !alertesPosees[x.ligne] && !masque(x)) { alerteCase = marqueAlerte(alertesDe(x.ligne)); if (alerteCase) alertesPosees[x.ligne] = true; }
      if (x.r * t.largeur + x.c >= t.plafond) cl.push("pion-debord");
      if (x.role && x.role === etat.role) cl.push("pion-mien");
      var cible = x.nature === "dorese" && x.parent !== undefined ? t.pieces[x.parent] : x;
      if (x.ligne && x.ligne === etat.neuf) cl.push("pion-neuf");
      if (selectionCorrespond(cible) || (x.ligne && etat.selection && etat.selection.ligne === x.ligne)) cl.push("pion-choisi");
      if (x.nature === "dorese" ? estompe(cible) && estompe(x) : estompe(x)) cl.push("pion-estompe");
      var nom = masque(x) ? (x.nature === "dorese" ? "DORESE" : "Demande " + x.armee) : x.libelle;
      var ic = x.nature === "dorese" ? F.svg(F.DORESE[x.type]) : F.svg(masque(x) ? "document" : (F.pictoDe(x.libelle) || "document"));
      var titre = nom + (x.allie ? " · part alliée (ne compte pas pour la France)" : "") + (x.enveloppe ? " · cliquez pour voir l'enveloppe" : "");
      pl.appendChild(el("button", { type: "button", classe: cl.join(" "), title: titre, style: "grid-row:" + (x.r + 1) + ";grid-column:" + (x.c + 1) + ";--bande:" + couleur(x.armee),
        onclick: x.enveloppe ? function () { etat.volet = "enveloppes"; rendre(true); } : x.ligne && x.nature !== "dorese" ? choisir(x) : x.ligne ? choisir({ ligne: x.ligne, pion: cible.pion }) : choisir(cible) },
        [ic, drap ? el("span", { classe: "drapeau drapeau-pion" }) : null, alerteCase]));
    });
    etat.neuf = null;

    var hors = $("hors-table");
    vider(hors);
    var absents = lignes.filter(function (l) { return (l.type === "retrait" || l.type === "degrade") && M.quantite(l, etat.annee) && visible(l); });
    if (absents.length) {
      hors.appendChild(el("span", { classe: "hors-titre", texte: "Retiré de la table en " + etat.annee + " :" }));
      absents.forEach(function (l) {
        hors.appendChild(el("button", { type: "button", classe: "hors-pion", onclick: function () { etat.selection = { ligne: l.id, pion: l.pion }; etat.volet = "selection"; rendre(true); } },
          [libelleLigne(l) + (l.type === "degrade" ? " (DORESE rendues)" : "") + " · " + l.role]));
      });
    }

    var lg = $("legende");
    vider(lg);
    function puce(style, cl, txt) { return el("span", null, [el("span", { classe: "puce-legende " + (cl || ""), style: style }), txt]); }
    lg.appendChild(puce("background:var(--gris)", "", "Dépense fixe"));
    lg.appendChild(puce("background:var(--violet)", "", "Investissement"));
    M.ARMEES.forEach(function (a) { lg.appendChild(puce("background:" + couleur(a), "", a)); });
    lg.appendChild(puce("background:var(--rouge)", "", "Face rouge : capacité dégradée"));
    ["ao", "mco", "rh"].forEach(function (k) {
      lg.appendChild(el("span", null, [el("span", { classe: "puce-legende jeton-legende", style: "--bande:var(--marine)" }, [F.svg(F.DORESE[k])]), { ao: "DORESE activité", mco: "DORESE MCO", rh: "DORESE RH" }[k]]));
    });
    lg.appendChild(puce("background:var(--case-vide)", "pion-mien", "Ma demande"));
    lg.appendChild(puce("background:var(--hors)", "", "Au-delà du plafond"));
    lg.appendChild(puce("background:var(--carte)", "pion-attente", "En attente d'arbitrage"));
    lg.appendChild(puce("background:var(--carte)", "pion-renonce", "Renoncé"));
    lg.appendChild(el("span", null, [el("span", { classe: "drapeau" }), "Contrainte politique"]));
    lg.appendChild(puce("background:var(--carte)", "jeton-allie", "Part alliée, hors budget"));
    lg.appendChild(puce("background:var(--carte)", "pion-sous", "Sous la ligne de flottaison"));
    lg.appendChild(el("span", null, [el("span", { classe: "puce-legende puce-alerte", texte: "!" }), "Alerte des fiches (non bloquante)"]));
    lg.appendChild(el("span", { classe: "note-legende", texte: "Le socle 2027 est considéré comme arbitré." }));
  }

  // ---------- Volet ----------
  function onglets() {
    var o = [["poser", "Poser"], ["selection", "Sélection"], ["demande", "Ma demande"], ["flottaison", "Flottaison"]];
    if (enveloppesVisibles().length) o.push(["enveloppes", "Enveloppes"]);
    if (!enCible()) o.push(["trajectoire", "Trajectoire"]);
    if (arbitre() || vueComplete()) o.push(["arbitrage", "Arbitrage"]);
    o.push(["bilan", "Bilan"]);
    if (ROLES_REGLAGES.indexOf(etat.role) !== -1) o.push(["reglages", "Réglages"]);
    return o;
  }
  function rendreVolet() {
    var nav = $("volet-onglets");
    vider(nav);
    if (!onglets().some(function (o) { return o[0] === etat.volet; })) etat.volet = "poser";
    onglets().forEach(function (o) {
      nav.appendChild(el("button", { type: "button", role: "tab", "aria-selected": etat.volet === o[0] ? "true" : "false", texte: o[1],
        onclick: function () { etat.volet = o[0]; rendreVolet(); } }));
    });
    var v = $("volet");
    vider(v);
    ({ poser: voletPoser, selection: voletSelection, demande: voletDemande, flottaison: voletFlottaison, enveloppes: voletEnveloppes, trajectoire: voletTrajectoire,
      arbitrage: voletArbitrage, bilan: voletBilan, reglages: voletReglages }[etat.volet] || voletPoser)(v);
  }

  function choixPortee() {
    if (enCible()) return el("p", { classe: "aide portee-cible", texte: "Modèle 2032 : vous composez la table cible. L'étalement année par année vient à l'étape 2." });
    var g = el("div", { classe: "portee", role: "group", "aria-label": "Années concernées" });
    var dernier = etat.annee === M.ANNEES[M.ANNEES.length - 1];
    [["suite", dernier ? String(etat.annee) : etat.annee + " → " + M.ANNEES[M.ANNEES.length - 1]], ["annee", etat.annee + " seulement"]].forEach(function (x) {
      if (dernier && x[0] === "annee") return;
      g.appendChild(el("button", { type: "button", "aria-pressed": etat.portee === x[0] || dernier ? "true" : "false", texte: x[1],
        onclick: function () { etat.portee = x[0]; rendreVolet(); } }));
    });
    return el("div", { classe: "portee-bloc" }, [el("small", { texte: "S'applique" }), g]);
  }

  function forme(p) {
    var f = el("span", { classe: "forme", style: "grid-template-columns:repeat(" + Math.min(p.l || 1, 6) + ",7px);--c:" + (p.type === "violet" ? "var(--violet)" : p.type === "gris" ? "var(--gris)" : couleur(p.armee)) });
    for (var i = 0; i < Math.min((p.l || 1) * (p.h || 1), 24); i++) f.appendChild(el("i"));
    return f;
  }

  function voletPoser(v) {
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Poser un pion sur la table" }));
    v.appendChild(choixPortee());
    var f = el("div", { classe: "filtres", role: "group" });
    [["capacites", "Capacités"], ["options", "Options de ma fiche"], ["mesure", "Sur mesure"]].forEach(function (x) {
      f.appendChild(el("button", { classe: "filtre", type: "button", "aria-pressed": etat.filtre === x[0] ? "true" : "false", texte: x[1], onclick: function () { etat.filtre = x[0]; rendreVolet(); } }));
    });
    v.appendChild(f);
    if (etat.filtre !== "mesure") {
      var rech = el("input", { type: "search", placeholder: "Chercher…", "aria-label": "Chercher", value: etat.recherche });
      rech.addEventListener("input", function () { etat.recherche = rech.value; var l = $("liste-poser"); vider(l); remplir(l); });
      v.appendChild(rech);
    }
    var liste = el("div", { classe: "liste-poser", id: "liste-poser" });
    v.appendChild(liste);
    remplir(liste);

    function remplir(liste) {
      var q = etat.recherche.trim().toLowerCase();
      function ok(t) { return !q || t.toLowerCase().indexOf(q) !== -1; }
      if (etat.filtre === "capacites") {
        var vus = {};
        PIONS.filter(function (p) { return (p.type === "capacite" || p.type === "violet") && dansMonPerimetre(p) && ok(p.nom); }).forEach(function (p) {
          var cle = p.nom.replace(/ \d$/, "");
          if (vus[cle]) return; vus[cle] = true;
          var boutons = el("span", { classe: "poser-boutons" });
          if (p.type === "capacite" && M.nbDorese(p)) {
            boutons.appendChild(el("button", { type: "button", classe: "btn-poser", title: "Version dégradée, sans DORESE", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: 50 }); } }, ["50 %", el("small", { texte: md(p.cout50) })]));
            boutons.appendChild(el("button", { type: "button", classe: "btn-poser plein", title: "Avec ses " + M.nbDorese(p) + " DORESE", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: 100 }); } }, ["100 %", el("small", { texte: md(p.cout100) })]));
          } else {
            boutons.appendChild(el("button", { type: "button", classe: "btn-poser plein", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: 50 }); } }, ["Poser", el("small", { texte: md(p.cout50) })]));
          }
          liste.appendChild(el("div", { classe: "carte-poser" }, [forme(p), el("span", { classe: "carte-poser-nom" }, [cle, el("small", { texte: p.armee + " · " + (p.l * p.h) + " cases" + (M.nbDorese(p) ? " + " + M.nbDorese(p) + " DORESE" : "") })]), boutons]));
        });
      } else if (etat.filtre === "options") {
        var opts = CATALOGUE.filter(function (o) { return (vueComplete() || o.role === etat.role) && ok(o.libelle + " " + (o.categorie || "")); });
        if (!opts.length) liste.appendChild(el("p", { classe: "vide", texte: "Votre fiche ne propose pas d'option. Utilisez « Sur mesure »." }));
        opts.forEach(function (o) {
          var p = { l: 2, h: 1, armee: o.armee, type: /Violet/.test(o.type_pion || "") ? "violet" : "capacite" };
          liste.appendChild(el("div", { classe: "carte-poser" }, [forme(p),
            el("span", { classe: "carte-poser-nom" }, [o.libelle, el("small", { texte: fourchette(o) + (vueComplete() ? " · fiche " + o.role : "") })]),
            el("span", { classe: "poser-boutons" }, [el("button", { type: "button", classe: "btn-poser plein", onclick: function () { poser({ type: "libre", modele: o.code }); } }, ["Poser"])])]));
        });
      } else {
        var nom = el("input", { placeholder: "Intitulé", "aria-label": "Intitulé", maxlength: 120 });
        var prix = el("input", { type: "number", min: 100, step: 100, placeholder: "M€ par an", "aria-label": "Prix en M€ par an" });
        var arm = el("select", { "aria-label": "Armée" });
        M.ARMEES.forEach(function (a) { arm.appendChild(el("option", { value: a, texte: a })); });
        arm.value = armeeDuRole();
        var err = el("p", { classe: "erreur" });
        liste.appendChild(el("form", { classe: "form-mesure", onsubmit: function (ev) {
          ev.preventDefault();
          if (!nom.value.trim()) { err.textContent = "Donnez un intitulé."; return; }
          if (!(Number(prix.value) > 0)) { err.textContent = "Fixez un prix : il sera arrondi à la case de 100 M€."; return; }
          poser({ type: "libre", libelle: nom.value.trim(), cout: Number(prix.value), armee: arm.value });
        } }, [
          el("p", { classe: "aide", texte: "Un besoin hors catalogue. Il restera « à valider » jusqu'à l'accord de l'animateur." }),
          el("label", null, ["Intitulé", nom]), el("label", null, ["Prix, M€ par an", prix]), el("label", null, ["Armée qui le porte", arm]),
          el("button", { classe: "btn-laiton", type: "submit", texte: "Poser sur la table" }), err
        ]));
      }
    }
  }

  function badgeDecision(l) {
    var a = M.arbitrageDe(l, params());
    if (a.contrainte) return el("span", { classe: "badge badge-politique" }, [el("span", { classe: "drapeau" }), "Contrainte politique"]);
    if (a.statut === "attente") return el("span", { classe: "badge badge-attente", texte: "En attente du CEMA" });
    return el("span", { classe: "badge " + (a.statut === "retenu" ? "badge-ok" : a.statut === "renonce" ? "badge-alerte" : "badge-attente"),
      texte: "CEMA : " + M.STATUTS[a.statut] + (a.statut === "differe" ? " de " + a.decalage + " an" + (a.decalage > 1 ? "s" : "") : "") });
  }

  function blocArbitrage(l) {
    var p = params();
    var a = M.arbitrageDe(l, p);
    if (a.contrainte) return el("p", { classe: "aide politique", texte: "Contrainte politique : pas d'arbitrage possible. La ligne reste au-dessus de la ligne de flottaison." });
    var choix = el("div", { classe: "choix" });
    Object.keys(M.STATUTS).forEach(function (k) {
      choix.appendChild(el("button", { type: "button", "data-statut": k, "aria-pressed": a.statut === k ? "true" : "false", texte: M.STATUTS[k],
        onclick: function () { modifierParams(function (pp) { pp.arbitrages = pp.arbitrages || {}; pp.arbitrages[l.id] = { statut: k, decalage: k === "differe" ? (a.decalage || 1) : 0 }; }); } }));
    });
    if (a.statut === "differe") {
      var dec = el("select", { "aria-label": "Décalage" });
      [1, 2, 3].forEach(function (n) { dec.appendChild(el("option", { value: n, texte: "de " + n + " an" + (n > 1 ? "s" : "") })); });
      dec.value = String(a.decalage || 1);
      dec.addEventListener("change", function () { modifierParams(function (pp) { pp.arbitrages = pp.arbitrages || {}; pp.arbitrages[l.id] = { statut: "differe", decalage: Number(dec.value) }; }); });
      choix.appendChild(dec);
    }
    if (l.type === "libre" && !l.modele) {
      var cb = el("input", { type: "checkbox", id: "val-" + l.id });
      cb.checked = !!(p.validations || {})[l.id];
      cb.addEventListener("change", function () { modifierParams(function (pp) { pp.validations = pp.validations || {}; pp.validations[l.id] = cb.checked; }); });
      choix.appendChild(el("label", { for: cb.id, classe: "petit" }, [cb, " pion sur mesure validé"]));
    }
    return choix;
  }

  function voletSelection(v) {
    var s = etat.selection;
    if (!s) {
      v.appendChild(el("p", { classe: "vide", texte: "Cliquez sur un pion de la table pour voir ce que vous pouvez en faire." }));
      return;
    }
    var l = ligneDe(s.ligne);
    if (l) return ficheLigne(v, l);
    var p = IDX[s.pion];
    if (!p) { etat.selection = null; return voletSelection(v); }
    ficheSocle(v, p);
  }

  // Un pion du socle : le renforcer, le dissoudre.
  function ficheSocle(v, p) {
    var plein = M.nbManquantes(p) === 0;
    v.appendChild(el("p", { classe: "volet-sur", texte: (p.type === "gris" ? "Dépense fixe" : p.type === "violet" ? "Investissement" : p.type === "orange" ? "Pion de scénario" : "Capacité") + " · " + p.armee }));
    v.appendChild(el("h2", { classe: "volet-titre", texte: p.nom }));
    var dep = M.doreseDepart(p);
    var lignesEtat = [["Coût sur la table", md(M.coutSocle(p)) + " par an"], ["Place", (p.l * p.h) + " cases"]];
    if (p.type === "capacite") lignesEtat.push(["DORESE posées", M.nbDepart(p) + " / " + M.nbDorese(p) + (M.nbDorese(p) ? " (" + dep.ao + " AO, " + dep.mco + " MCO, " + dep.rh + " RH)" : "")]);
    var lActive = function (type) { var l = etat.lignes.filter(function (x) { return x.type === type && x.pion === p.id && M.quantite(effective(x), etat.annee); })[0]; return l; };
    if (p.type === "capacite") lignesEtat.push(["État en " + etat.annee, lActive("degrade") ? "à 50 %, DORESE rendues (" + lActive("degrade").role + ")" : lActive("dorese") ? "à 100 %, renforcée (" + lActive("dorese").role + ")" : plein ? "à 100 %" : "dégradée"]);
    v.appendChild(el("dl", { classe: "etat-pion" }, lignesEtat.reduce(function (acc, x) { return acc.concat([el("dt", { texte: x[0] }), el("dd", { texte: x[1] })]); }, [])));
    if (p.remarque) v.appendChild(el("p", { classe: "aide", texte: p.remarque }));

    if (p.type === "gris" || p.type === "orange") {
      v.appendChild(el("p", { classe: "aide", texte: p.type === "gris" ? "Dépense fixe : elle ne se négocie pas à la table." : "Pion de scénario : l'animateur le pose ou le retire dans les Réglages." }));
      if (p.type === "orange" || M.contrainteDe("pion:" + p.id, params())) v.appendChild(blocContrainte("pion:" + p.id, null));
      return;
    }
    if (M.contrainteDe("pion:" + p.id, params()) || peutContraindre()) v.appendChild(blocContrainte("pion:" + p.id, null));
    if (!dansMonPerimetre(p)) { v.appendChild(el("p", { classe: "aide", texte: "Ce pion relève d'un autre pôle." })); return; }

    v.appendChild(choixPortee());
    var actions = el("div", { classe: "actions-pion" });
    var renf = etat.lignes.filter(function (x) { return memeGeste(x, { type: "dorese", pion: p.id }); })[0];
    var diss = etat.lignes.filter(function (x) { return memeGeste(x, { type: "retrait", pion: p.id }); })[0];
    var degr = etat.lignes.filter(function (x) { return memeGeste(x, { type: "degrade", pion: p.id }); })[0];
    var degrCetteAnnee = degr && M.quantite(effective(degr), etat.annee);
    if (degrCetteAnnee) {
      actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { enlever(degr); } }, [
        el("b", { texte: "Revenir à 100 %" }), el("span", { texte: "Reposer ses DORESE " + textePortee() }), el("em", { texte: "+" + md(M.nbDepart(p) * M.CASE) + " par an" })]));
    } else if (p.type === "capacite" && M.nbDepart(p) && !(renf && M.quantite(effective(renf), etat.annee))) {
      var dd = M.doreseDepart(p);
      actions.appendChild(el("button", { type: "button", classe: "action action-retrait", onclick: function () { poser({ type: "degrade", pion: p.id }); } }, [
        el("b", { texte: "Repasser à 50 %" }),
        el("span", { texte: "Rend ses " + M.nbDepart(p) + " DORESE (" + dd.ao + " AO, " + dd.mco + " MCO, " + dd.rh + " RH) : capacité dégradée" }),
        el("em", { texte: "−" + md(M.nbDepart(p) * M.CASE) + " par an" })]));
    }
    if (renf && M.quantite(effective(renf), etat.annee)) {
      actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { enlever(renf); } }, [
        el("b", { texte: "Annuler le renforcement" }), el("span", { texte: "Retire les DORESE ajoutées " + textePortee() }), el("em", { texte: "−" + md(M.nbManquantes(p) * M.CASE) + " par an" })]));
    } else if (!plein && !degrCetteAnnee) {
      var mq = M.doreseManquantes(p);
      actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { poser({ type: "dorese", pion: p.id }); } }, [
        el("b", { texte: "Renforcer à 100 %" }),
        el("span", { texte: "Ajoute " + M.nbManquantes(p) + " DORESE au contact (" + mq.ao + " AO, " + mq.mco + " MCO, " + mq.rh + " RH)" }),
        el("em", { texte: "+" + md(M.nbManquantes(p) * M.CASE) + " par an" })
      ]));
    }
    actions.appendChild(el("button", { type: "button", classe: "action action-retrait", onclick: function () { poser({ type: "retrait", pion: p.id }); } }, [
      el("b", { texte: "Dissoudre" }),
      el("span", { texte: "Retire le pion de la table " + textePortee() }),
      el("em", { texte: "−" + md(M.coutSocle(p)) + " par an" })
    ]));
    actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: M.nbDorese(p) ? 100 : 50 }); } }, [
      el("b", { texte: "Ajouter un exemplaire" }),
      el("span", { texte: "Un " + p.nom.replace(/ \d$/, "") + " de plus" + (M.nbDorese(p) ? ", à 100 %" : "") }),
      el("em", { texte: "+" + md(M.nbDorese(p) ? p.cout100 : p.cout50) + " par an" })
    ]));
    v.appendChild(actions);
    [renf, diss, degr].forEach(function (l) { if (l) v.appendChild(el("p", { classe: "aide" }, ["Déjà dans votre demande : " + natureLigne(l).toLowerCase() + " (" + anneesDe(l) + "). ", el("button", { classe: "btn-lien", type: "button", texte: "Ouvrir", onclick: function () { etat.selection = { ligne: l.id, pion: l.pion }; rendreVolet(); } })])); });
  }

  // Une demande (ligne) : la régler ou l'enlever.
  function ficheLigne(v, l) {
    var mien = l.role === etat.role;
    var p = IDX[l.pion];
    var o = optionDe(l.modele);
    if (!visible(l)) {
      v.appendChild(el("p", { classe: "volet-sur", texte: "Demande d'un autre pôle" }));
      v.appendChild(el("h2", { classe: "volet-titre", texte: "Demande " + M.armeeDeLigne(l, IDX) }));
      v.appendChild(el("p", { classe: "aide", texte: "Son détail n'est visible que de son pôle, du CEMA, du SC-Plans et de l'animateur." }));
      v.appendChild(blocPriorite(l));
      if (ROLES_FINANCEMENT.indexOf(etat.role) !== -1) v.appendChild(blocFinancement(l));
      return;
    }
    v.appendChild(el("p", { classe: "volet-sur", texte: natureLigne(l) + " · " + l.role }));
    var titre = el("h2", { classe: "volet-titre", texte: libelleLigne(l) });
    v.appendChild(titre);
    v.appendChild(el("div", { classe: "badges" }, [badgeDecision(l),
      l.type === "libre" && !l.modele ? el("span", { classe: "badge " + ((params().validations || {})[l.id] ? "badge-ok" : "badge-attente"), texte: (params().validations || {})[l.id] ? "Validé par l'animateur" : "À valider par l'animateur" }) : null]));

    var mesAlertes = alertesDe(l.id);
    if (mesAlertes.length) v.appendChild(el("section", { classe: "bloc-conception bloc-alertes" }, [el("h3", { texte: "Alertes des fiches de rôle" }),
      el("p", { classe: "aide", texte: "Elles ne bloquent rien : à vous de les assumer, ou au CEMA de les arbitrer." }), listeAlertes(mesAlertes, false)]));
    var c = chiffre(l);
    var u = M.unitaire(l, IDX);
    var resume = el("dl", { classe: "etat-pion" }, [
      el("dt", { texte: "Par an posé" }), el("dd", { texte: u.cout ? md(u.cout) : "prix à fixer" }),
      el("dt", { texte: "Années" }), el("dd", { texte: anneesDe(l) }),
      el("dt", { texte: "Total LPM" }), el("dd", { texte: md(c.total) + (c.totalDorese ? " · " + c.totalDorese + " DORESE" : "") }),
      el("dt", { texte: "Imputé à" }), el("dd", { texte: M.armeeDeLigne(l, IDX) })
    ]);
    v.appendChild(resume);
    [blocPriorite(l), blocContrainte(l.id, l.role), blocFinancement(l), blocEnveloppe(l), blocTrajectoire(l)].forEach(function (b) { if (b) v.appendChild(b); });

    if (mien) {
      if (l.type === "ajout" && p && p.type === "capacite" && M.nbDorese(p)) {
        var seg = el("div", { classe: "segment", role: "group", "aria-label": "Niveau" });
        [[50, "À 50 % · " + md(p.cout50)], [100, "À 100 % · " + md(p.cout100)]].forEach(function (x) {
          seg.appendChild(el("button", { type: "button", "aria-pressed": Number(l.niveau) === x[0] ? "true" : "false", texte: x[1], onclick: function () { l.niveau = x[0]; enregistrer(l); rendre(true); } }));
        });
        v.appendChild(seg);
      }
      if (l.type === "libre") {
        var prix = el("input", { type: "number", min: 0, step: 100, value: l.cout_unitaire || "", placeholder: "M€", "aria-label": "Prix fixé en M€ par an" });
        var note = el("p", { classe: "alerte-texte" });
        function majNote() {
          var t = [];
          if (!l.cout_unitaire) t.push("Fixez le prix : la demande ne compte pas tant qu'il est vide.");
          if (o && o.cout && l.cout_unitaire && (l.cout_unitaire < M.arrondiCase(o.cout) || l.cout_unitaire > Math.max(M.arrondiCase(o.cout_max || o.cout), o.cout_max || o.cout))) t.push("Hors fourchette de la fiche (" + fourchette(o) + ").");
          note.textContent = t.join(" ");
        }
        prix.addEventListener("change", function () { l.cout_unitaire = M.arrondiCase(prix.value); prix.value = l.cout_unitaire || ""; enregistrer(l); rendre(true); });
        majNote();
        v.appendChild(el("label", { classe: "champ" }, ["Prix fixé, M€ par an (arrondi à la case)", prix]));
        if (o) v.appendChild(el("p", { classe: "aide", texte: "Fiche : " + fourchette(o) + (o.periodicite ? " · " + o.periodicite : "") }));
        v.appendChild(note);
        v.appendChild(blocTranches(l));
      }
      var cal = el("div", { classe: "cal" });
      (l.cible ? [FIN] : M.ANNEES).forEach(function (a) {
        var q = M.quantite(l, a);
        var unique = l.type !== "ajout" && !(l.type === "libre" && !l.modele);
        cal.appendChild(el("button", { type: "button", classe: "cal-an" + (q ? " actif" : ""), "aria-pressed": q ? "true" : "false", title: unique ? "Poser ou retirer en " + a : "Clic : +1 · Maj+clic : −1",
          onclick: function (ev) {
            l.qte[a] = unique ? (q ? 0 : 1) : ev.shiftKey ? Math.max(0, q - 1) : q + 1;
            if (!M.ANNEES.some(function (x) { return M.quantite(l, x) > 0; })) { supprimer(l); etat.selection = null; etat.volet = "demande"; }
            else enregistrer(l);
            rendre(true);
          } }, [el("small", { texte: String(a) }), el("b", { texte: unique ? (q ? "✓" : "—") : String(q) })]));
      });
      v.appendChild(el("div", { classe: "champ" }, [el("span", { texte: l.cible ? "Au modèle 2032" : "Années sur la table" }), cal]));
      var arm = el("select", { "aria-label": "Armée qui porte le projet" });
      M.ARMEES.forEach(function (a) { arm.appendChild(el("option", { value: a, texte: a })); });
      arm.value = M.armeeDeLigne(l, IDX);
      arm.addEventListener("change", function () { l.armee = arm.value; enregistrer(l); rendre(true); });
      v.appendChild(el("label", { classe: "champ" }, ["Surcoût imputé à", arm]));
      var just = el("textarea", { placeholder: "Votre argument pour l'arbitrage du CEMA", "aria-label": "Justification" });
      just.value = l.justification || "";
      just.addEventListener("input", function () { l.justification = just.value; enregistrer(l); });
      v.appendChild(el("label", { classe: "champ" }, ["Justification", just]));
      v.appendChild(el("div", { classe: "actions-bas" }, [
        el("button", { type: "button", classe: "btn-contour", texte: "Enlever de la table " + textePortee(), onclick: function () { enlever(l); } }),
        el("button", { type: "button", classe: "btn-lien", texte: "Supprimer toute la demande", onclick: function (ev) {
          var b = ev.currentTarget;
          if (b.dataset.arme !== "1") { b.dataset.arme = "1"; b.textContent = "Confirmer la suppression"; return; }
          supprimer(l); etat.selection = null; etat.volet = "demande"; rendre(true);
        } })
      ]));
      v.appendChild(choixPortee());
    } else if (l.justification) {
      v.appendChild(el("blockquote", { classe: "citation", texte: l.justification }));
    }
    if (arbitre()) {
      v.appendChild(el("h3", { texte: "Décision du CEMA" }));
      v.appendChild(blocArbitrage(l));
    }
  }

  // Règles de jeu tirées des fiches de rôle, pour référence (l'animateur les voit toutes).
  function blocRegles() {
    var regles = REGLES.filter(function (r) { return etat.role === "Animateur" || r.role === etat.role || r.porteur === etat.role; });
    if (!regles.length) return null;
    var noms = { blocage: "Blocage", alerte: "Alerte", "surcoût automatique": "Surcoût", drapeau: "Drapeau" };
    var ul = el("ul", { classe: "regles" });
    regles.forEach(function (r) {
      ul.appendChild(el("li", null, [
        el("span", { classe: "regle-tete" }, [el("b", { texte: r.theme || r.id }), el("span", { classe: "badge regle-" + (r.application || "").replace(/[^a-z]/g, ""), texte: noms[r.application] || r.application }),
          r.a_verifier ? el("span", { classe: "badge badge-attente", texte: "à vérifier" }) : null]),
        el("span", { texte: r.regle }),
        el("small", { texte: (etat.role === "Animateur" ? r.role + " · " : "") + (r.qui_peut_lever ? "Levée : " + r.qui_peut_lever + " · " : "") + r.source + (r.pages ? " p. " + r.pages : "") })
      ]));
    });
    return el("details", { classe: "details-regles" }, [el("summary", { texte: "Règles de jeu " + (etat.role === "Animateur" ? "de toutes les fiches" : "de ma fiche") + " (" + regles.length + ")" }),
      el("p", { classe: "aide", texte: "Tirées des fiches de rôle. Aucune ne bloque : celles que l'outil sait vérifier sortent en alerte sur le pion et dans la demande ; les autres, l'animateur les fait respecter." }), ul]);
  }

  function voletDemande(v) {
    var miennes = etat.lignes.filter(function (l) { return l.role === etat.role; }).sort(M.comparerEmpilement(params()));
    var mien = M.synthese(PIONS, lignesJeu(), params(), function (l) { return l.role === etat.role; });
    var tot = 0, dor = 0;
    M.ANNEES.forEach(function (a) { tot += mien[a].totalDemandes; dor += mien[a].dorese.ao + mien[a].dorese.mco + mien[a].dorese.rh; });
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Demande " + etat.role }));
    v.appendChild(el("p", { classe: "total-demande" }, [el("b", { texte: md(tot) }), " sur 2027-2032 · " + dor + " DORESE"]));
    var mesAl = ALERTES.filter(function (a) { return a.role === etat.role; });
    if (mesAl.length) v.appendChild(el("details", { classe: "details-regles", open: true }, [el("summary", { texte: "Alertes sur ma demande (" + mesAl.length + ")" }), listeAlertes(mesAl, true)]));
    var rg = blocRegles();
    if (rg) v.appendChild(rg);
    if (!miennes.length) { v.appendChild(el("p", { classe: "vide", texte: "Rien encore. Posez un pion depuis l'onglet « Poser », ou cliquez sur un pion de la table." })); return; }
    var ul = el("ul", { classe: "liste-demande" });
    miennes.forEach(function (l) {
      ul.appendChild(el("li", null, [el("button", { type: "button", style: "--c:" + couleur(M.armeeDeLigne(l, IDX)), onclick: function () { etat.selection = { ligne: l.id, pion: l.pion || null }; etat.volet = "selection"; rendre(true); } }, [
        el("span", null, [el("b", null, [(M.contrainteAcquise(l.id, params()) ? el("span", { classe: "prio-pastille" }, [el("span", { classe: "drapeau" })]) : el("span", { classe: "prio-pastille", texte: "P" + M.prioriteDe(l, params()).valeur })), libelleLigne(l)]), el("small", { texte: natureLigne(l) + " · " + anneesDe(l) + (l.cible ? " · modèle 2032" : "") })]),
        el("span", { classe: "num" }, [md(chiffre(l).total), badgeDecision(l), alertesDe(l.id).some(function (a) { return a.niveau === "alerte"; }) ? el("span", { classe: "badge badge-alerte", texte: "alerte" }) : null])
      ])]));
    });
    v.appendChild(ul);
  }

  function voletArbitrage(v) {
    var p = params();
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Arbitrage" }));
    var arb = M.synthese(PIONS, M.lignesApresArbitrage(lignesJeu(), p), p);
    var tab = el("table", { classe: "mini-tableau" }, [el("thead", null, [el("tr", null, [el("th", { texte: "" }), el("th", { classe: "num", texte: "Retenu" }), el("th", { classe: "num", texte: "Marge" })])])]);
    var tb = el("tbody");
    M.ANNEES.forEach(function (a) { tb.appendChild(el("tr", null, [el("td", { texte: String(a) }), el("td", { classe: "num", texte: md(arb[a].total) }), el("td", { classe: "num " + (arb[a].marge < 0 ? "neg" : "pos"), texte: md(arb[a].marge) })])); });
    tab.appendChild(tb);
    v.appendChild(tab);
    var lignes = etat.lignes.filter(visible);
    var groupes = { attente: [], retenu: [], differe: [], renonce: [] };
    lignes.forEach(function (l) { groupes[M.arbitrageDe(l, p).statut].push(l); });
    Object.keys(groupes).forEach(function (k) {
      if (!groupes[k].length) return;
      var total = groupes[k].reduce(function (s, l) { return s + chiffre(l).total; }, 0);
      v.appendChild(el("h3", { texte: M.STATUTS[k] + " · " + groupes[k].length + " · " + md(total) }));
      var ul = el("ul", { classe: "liste-demande" });
      groupes[k].forEach(function (l) {
        ul.appendChild(el("li", null, [el("button", { type: "button", style: "--c:" + couleur(M.armeeDeLigne(l, IDX)), onclick: function () { etat.selection = { ligne: l.id, pion: l.pion || null }; etat.volet = "selection"; var a1 = M.ANNEES.filter(function (a) { return M.quantite(l, a); })[0]; if (a1) etat.annee = a1; rendre(true); } }, [
          el("span", null, [el("b", { texte: libelleLigne(l) }), el("small", { texte: l.role + " · " + natureLigne(l) + " · " + anneesDe(l) })]),
          el("span", { classe: "num" }, [md(chiffre(l).total), alertesDe(l.id).some(function (a) { return a.niveau === "alerte"; }) ? el("span", { classe: "badge badge-alerte", texte: "alerte" }) : null])
        ])]));
      });
      v.appendChild(ul);
    });
    if (!lignes.length) v.appendChild(el("p", { classe: "vide", texte: "Aucune demande pour l'instant." }));
  }

  function voletBilan(v) {
    var p = params();
    var syn = M.synthese(PIONS, lignesJeu(), p);
    var arb = M.synthese(PIONS, M.lignesApresArbitrage(lignesJeu(), p), p);
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Bilan 2027-2032" }));
    var t = el("table", { classe: "mini-tableau" });
    t.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "Md€" }), el("th", { classe: "num", texte: "Socle" }), el("th", { classe: "num", texte: "Demandes" }), el("th", { classe: "num", texte: "Plafond" }), el("th", { classe: "num", texte: "Marge après arb." })])]));
    var tb = el("tbody");
    function n(m) { return (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    M.ANNEES.forEach(function (a) {
      tb.appendChild(el("tr", null, [el("td", { texte: String(a) }), el("td", { classe: "num", texte: n(syn[a].totalSocle) }), el("td", { classe: "num", texte: n(syn[a].totalDemandes) }), el("td", { classe: "num", texte: n(syn[a].plafond) }), el("td", { classe: "num " + (arb[a].marge < 0 ? "neg" : "pos"), texte: n(arb[a].marge) })]));
    });
    t.appendChild(tb);
    v.appendChild(t);
    v.appendChild(el("h3", { texte: "Demandes par armée, sur 6 ans" }));
    var ul = el("ul", { classe: "par-armee" });
    M.ARMEES.forEach(function (arm) {
      var s = M.ANNEES.reduce(function (acc, a) { return acc + syn[a].demandes[arm]; }, 0);
      ul.appendChild(el("li", null, [el("span", { classe: "pastille", style: "background:" + couleur(arm) }), arm, el("b", { classe: "num", texte: md(s) })]));
    });
    v.appendChild(ul);
    v.appendChild(el("h3", { texte: "Règles des fiches : tableau de bord" }));
    var vis = alertesVisibles(), fortes = vis.filter(function (a) { return a.niveau === "alerte"; });
    var force = fortes.filter(function (a) { var l = ligneDe(a.ligne); return l && M.arbitrageDe(l, p).statut === "retenu"; });
    v.appendChild(el("dl", { classe: "etat-pion" }, [
      el("dt", { texte: "Alertes actives" }), el("dd", { texte: String(fortes.length) }),
      el("dt", { texte: "Passées en force" }), el("dd", { texte: force.length + " (retenues malgré l'alerte)" }),
      el("dt", { texte: "À savoir" }), el("dd", { texte: String(vis.length - fortes.length) })
    ]));
    if (vis.length) v.appendChild(el("details", { classe: "details-regles" }, [el("summary", { texte: "Voir les alertes" }), listeAlertes(vis, true)]));
    v.appendChild(el("button", { classe: "btn-contour", type: "button", texte: "Télécharger les lignes (CSV)", onclick: telechargerCsv }));
  }
  function telechargerCsv() {
    var p = params();
    var ent = ["Pôle", "Action", "Objet", "Armée"].concat(M.ANNEES.map(String)).concat(["Total (M€)", "Décision", "Justification"]);
    var out = [ent.join(";")];
    etat.lignes.filter(visible).forEach(function (l) {
      var c = chiffre(l);
      var v = [l.role, natureLigne(l), libelleLigne(l), M.armeeDeLigne(l, IDX)].concat(M.ANNEES.map(function (a) { return c.annees[a]; }))
        .concat([c.total, M.STATUTS[M.arbitrageDe(l, p).statut], (l.justification || "").replace(/\s+/g, " ")]);
      out.push(v.map(function (x) { var s = String(x); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";"));
    });
    var a = el("a", { href: URL.createObjectURL(new Blob(["﻿" + out.join("\n")], { type: "text/csv;charset=utf-8" })), download: "strategikon-" + etat.partie.nom + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
  }

  function voletReglages(v) {
    var p = params();
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Réglages de la partie" }));
    var f = el("form", { classe: "form-reglages" });
    f.appendChild(el("h3", { texte: "Plafond annuel, en cases de 100 M€" }));
    var pf = el("div", { classe: "plafonds" });
    M.ANNEES.forEach(function (a) { pf.appendChild(el("label", null, [String(a), el("input", { id: "plafond-" + a, type: "number", min: 0, max: 2000, value: p.plafonds[a] })])); });
    f.appendChild(pf);
    f.appendChild(el("h3", { texte: "Pions de scénario posés" }));
    PIONS.filter(function (x) { return x.type === "orange"; }).forEach(function (o) {
      var an = ((p.aleas || {})[o.id] || []).map(Number);
      f.appendChild(el("div", { classe: "alea" }, [el("span", { texte: o.nom + " · " + md(o.cout50) }), el("div", { classe: "alea-annees" }, M.ANNEES.map(function (a) {
        var cb = el("input", { type: "checkbox", "data-pion": o.id, "data-annee": a });
        cb.checked = an.indexOf(a) !== -1;
        return el("label", null, [cb, " " + a]);
      }))]));
    });
    f.appendChild(el("h3", { texte: "Étape de la partie" }));
    var ph = el("select", { id: "reg-phase", "aria-label": "Étape de la partie" });
    [["cible", "1 · Modèle 2032"], ["trajectoire", "2 · Trajectoire 2027-2032"]].forEach(function (x) { ph.appendChild(el("option", { value: x[0], texte: x[1] })); });
    ph.value = p.phase === "trajectoire" ? "trajectoire" : "cible";
    f.appendChild(el("label", { classe: "champ" }, ["Étape affichée à l'entrée des joueurs", ph]));

    f.appendChild(el("h3", { texte: "Enveloppes internes des pôles" }));
    f.appendChild(el("p", { classe: "aide", texte: "Montant annuel en M€. Le pôle y range ses lignes par priorité ; seul l'excédent pèse sur la table." }));
    var envs = M.enveloppesDe(p).map(function (e) { return Object.assign({}, e); });
    var boiteEnv = el("div", { classe: "enveloppes-reglage" });
    function dessinerEnv() {
      vider(boiteEnv);
      envs.forEach(function (e, i) {
        var r = el("select", { "aria-label": "Pôle" });
        M.ROLES.forEach(function (x) { r.appendChild(el("option", { value: x.code, texte: x.code })); });
        r.value = e.role;
        r.addEventListener("change", function () { e.role = r.value; });
        var nom = el("input", { value: e.nom, "aria-label": "Nom de l'enveloppe", maxlength: 40 });
        nom.addEventListener("input", function () { e.nom = nom.value; });
        var mt = el("input", { type: "number", min: 0, step: 100, value: e.montant, "aria-label": "Montant annuel en M€" });
        mt.addEventListener("input", function () { e.montant = Number(mt.value) || 0; });
        boiteEnv.appendChild(el("div", { classe: "env-ligne" }, [r, nom, mt, el("button", { type: "button", classe: "btn-lien", texte: "Retirer", onclick: function () { envs.splice(i, 1); dessinerEnv(); } })]));
      });
      boiteEnv.appendChild(el("button", { type: "button", classe: "btn-contour", texte: "Ajouter une enveloppe", onclick: function () {
        envs.push({ id: "env-" + Date.now().toString(36), role: "DGA", nom: "Nouvelle enveloppe", montant: 500, pion: null }); dessinerEnv();
      } }));
    }
    dessinerEnv();
    f.appendChild(boiteEnv);

    f.appendChild(el("button", { classe: "btn-laiton", type: "submit", texte: "Enregistrer" }));
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var plaf = {}, aleas = {};
      var phaseChoisie = ph.value;
      var envOk = envs.filter(function (e) { return e.nom && e.nom.trim(); }).map(function (e) { return { id: e.id, role: e.role, nom: e.nom.trim(), montant: Math.max(0, Number(e.montant) || 0), pion: e.pion || null }; });
      M.ANNEES.forEach(function (a) { plaf[a] = Math.max(0, Number($("plafond-" + a).value) || 0); });
      f.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
        var id = cb.getAttribute("data-pion"); aleas[id] = aleas[id] || [];
        if (cb.checked) aleas[id].push(Number(cb.getAttribute("data-annee")));
      });
      modifierParams(function (pp) { pp.plafonds = plaf; pp.aleas = aleas; pp.phase = phaseChoisie; pp.enveloppes = envOk; }).then(function () { toast("Réglages enregistrés"); });
    });
    v.appendChild(f);
  }

  // ---------- Lot de conception : priorité, contrainte politique, financement, enveloppe, trajectoire ----------
  function segmentPrio(courant, fn, vide) {
    var g = el("div", { classe: "segment segment-prio", role: "group" });
    M.PRIORITES.forEach(function (n) {
      g.appendChild(el("button", { type: "button", "aria-pressed": courant === n ? "true" : "false", texte: "P" + n, onclick: function () { fn(n); } }));
    });
    if (vide) g.appendChild(el("button", { type: "button", "aria-pressed": !courant ? "true" : "false", texte: "—", title: vide, onclick: function () { fn(null); } }));
    return g;
  }
  function blocPriorite(l) {
    var p = params(), pr = M.prioriteDe(l, p);
    var b = el("section", { classe: "bloc-conception" });
    b.appendChild(el("h3", { texte: "Priorité" }));
    if (M.contrainteAcquise(l.id, p)) {
      b.appendChild(el("p", { classe: "aide", texte: "Contrainte politique : placée avant P1, au-dessus de la ligne de flottaison." }));
      return b;
    }
    b.appendChild(el("p", { classe: "prio-etat" }, [
      el("span", null, ["Pôle ", el("b", { texte: libellePriorite(pr.pole) })]),
      el("span", null, ["CEMA ", el("b", { texte: libellePriorite(pr.cema) })]),
      el("span", { classe: "prio-retenue" }, ["Retenue ", el("b", { texte: "P" + pr.valeur })]),
      pr.fixee ? null : el("small", { texte: "non fixée : comptée en P4" })
    ]));
    if (l.role === etat.role) {
      b.appendChild(el("div", { classe: "champ" }, [el("span", { texte: "Priorité de mon pôle" }),
        segmentPrio(pr.pole, function (n) { l.priorite = n; enregistrer(l); rendre(true); })]));
    }
    if (arbitre()) {
      b.appendChild(el("div", { classe: "champ" }, [el("span", { texte: "Priorité fixée par le CEMA" }),
        segmentPrio(pr.cema, function (n) { modifierParams(function (pp) { pp.priorites = pp.priorites || {}; if (n) pp.priorites[l.id] = n; else delete pp.priorites[l.id]; }); }, "Revenir à la priorité du pôle")]));
    } else if (l.role !== etat.role) {
      var mienne = pr.propositions.filter(function (x) { return x.role === etat.role; })[0];
      b.appendChild(el("div", { classe: "champ" }, [el("span", { texte: "Proposer une priorité au CEMA" }),
        segmentPrio(mienne ? mienne.p : null, function (n) {
          modifierParams(function (pp) {
            pp.propositions = pp.propositions || {};
            var liste = (pp.propositions[l.id] || []).filter(function (x) { return x.role !== etat.role; });
            if (n) liste.push({ role: etat.role, p: n });
            if (liste.length) pp.propositions[l.id] = liste; else delete pp.propositions[l.id];
          }).then(function () { toast(n ? "Proposition P" + n + " transmise au CEMA" : "Proposition retirée"); });
        }, "Retirer ma proposition")]));
    }
    if (pr.propositions.length) {
      var ul = el("ul", { classe: "propositions" });
      pr.propositions.forEach(function (x) {
        ul.appendChild(el("li", null, [el("span", { texte: x.role + " propose P" + x.p }),
          arbitre() ? el("span", { classe: "prop-boutons" }, [
            el("button", { type: "button", classe: "btn-mini", texte: "Accepter", onclick: function () {
              modifierParams(function (pp) { pp.priorites = pp.priorites || {}; pp.priorites[l.id] = x.p; pp.propositions[l.id] = (pp.propositions[l.id] || []).filter(function (y) { return y.role !== x.role; }); });
            } }),
            el("button", { type: "button", classe: "btn-mini btn-mini-non", texte: "Écarter", onclick: function () {
              modifierParams(function (pp) { pp.propositions = pp.propositions || {}; pp.propositions[l.id] = (pp.propositions[l.id] || []).filter(function (y) { return y.role !== x.role; }); });
            } })]) : null]));
      });
      b.appendChild(ul);
    }
    return b;
  }

  // cle : id de la ligne, ou « pion:<id> » pour un pion du socle. proprio : le pôle qui porte la demande.
  function blocContrainte(cle, proprio) {
    var p = params(), c = M.contrainteDe(cle, p);
    var acquise = !!(c && c.etat === "acquise");
    var b = el("section", { classe: "bloc-conception" });
    b.appendChild(el("h3", null, [acquise ? el("span", { classe: "drapeau drapeau-titre", "aria-hidden": "true" }) : null, "Contrainte politique"]));
    b.appendChild(el("p", { classe: "aide", texte: acquise ? "Acquise (" + (c.par || "MINARM") + ") : non arbitrable, toujours au-dessus de la ligne de flottaison, avant P1."
      : c ? "Demandée par " + c.par + " : MINARM ou l'animateur doivent la cocher." : "Aucune. Seuls MINARM et l'animateur peuvent la cocher ; un pôle peut la demander." }));
    if (peutContraindre()) {
      var cb = el("input", { type: "checkbox", id: "contrainte-" + cle });
      cb.checked = acquise;
      cb.addEventListener("change", function () {
        modifierParams(function (pp) { pp.contraintes = pp.contraintes || {}; pp.contraintes[cle] = cb.checked ? { etat: "acquise", par: etat.role } : null; });
      });
      b.appendChild(el("label", { for: cb.id, classe: "case-cocher" }, [cb, " Contrainte politique : non arbitrable"]));
    } else if (proprio === etat.role && !acquise) {
      b.appendChild(el("button", { type: "button", classe: "btn-contour", texte: c ? "Retirer ma demande" : "Demander la contrainte politique", onclick: function () {
        modifierParams(function (pp) { pp.contraintes = pp.contraintes || {}; pp.contraintes[cle] = c ? null : { etat: "demandee", par: etat.role }; });
      } }));
    }
    return b;
  }

  function blocFinancement(l) {
    var p = params(), f = M.financementDe(l, p);
    var b = el("section", { classe: "bloc-conception" });
    b.appendChild(el("h3", { texte: "Financement" }));
    var c = chiffre(l);
    var etatTxt = M.MODES_FINANCEMENT[f.mode];
    if (f.mode === "mutualise") etatTxt += " · part française " + (f.part || 0) + " %" + (f.partenaires ? " · avec " + f.partenaires : "");
    if (f.mode === "subvention") etatTxt += " · " + (f.part || 0) + " % subventionnés";
    if (f.mode === "pret") etatTxt += " · " + (f.part || 0) + " % empruntés, remboursés sur 3 ans";
    var badges = [el("span", { classe: "badge " + (f.mode === "national" ? "badge-neutre" : "badge-allie"), texte: etatTxt })];
    if (f.mode !== "national") {
      badges.push(el("span", { classe: "badge " + (f.valide ? "badge-ok" : "badge-attente"), texte: (f.propose_par ? "proposé par " + f.propose_par + " · " : "") + (f.valide ? "validé par l'animateur" : "à valider par l'animateur") }));
      if (f.mode === "mutualise") badges.push(el("span", { classe: "badge badge-allie", texte: "dépendant d'un allié" }));
      if (M.defectionDe(l, p)) badges.push(el("span", { classe: "badge badge-alerte", texte: "défection de l'allié : à réarbitrer" }));
    }
    b.appendChild(el("div", { classe: "badges" }, badges));
    if (c.brut !== c.total || c.hors) b.appendChild(el("p", { classe: "aide", texte: "Pour la France : " + md(c.total) + " sur " + md(c.brut) + " (coût plein)" + (c.hors ? " · " + md(c.hors) + " reportés après 2032" : "") + "." }));

    var peutProposer = l.role === etat.role || ROLES_FINANCEMENT.indexOf(etat.role) !== -1;
    if (peutProposer) {
      var mode = el("select", { "aria-label": "Mode de financement" });
      Object.keys(M.MODES_FINANCEMENT).forEach(function (k) { mode.appendChild(el("option", { value: k, texte: M.MODES_FINANCEMENT[k] })); });
      mode.value = f.mode;
      var part = el("input", { type: "number", min: 0, max: 100, step: 5, value: f.part !== undefined ? f.part : 50, "aria-label": "Pourcentage" });
      var lPart = el("span");
      var partn = el("input", { placeholder: "Allemagne, Italie…", value: f.partenaires || "", "aria-label": "Partenaires" });
      var lignePart = el("label", { classe: "champ" }, [lPart, part]);
      var lignePartn = el("label", { classe: "champ" }, ["Partenaires", partn]);
      function maj() {
        var m = mode.value;
        lignePart.hidden = m === "national";
        lignePartn.hidden = m !== "mutualise";
        lPart.textContent = m === "mutualise" ? "Part française, %" : m === "subvention" ? "Part subventionnée par l'UE, %" : "Part empruntée à l'UE, %";
      }
      mode.addEventListener("change", maj);
      maj();
      var formF = el("div", { classe: "form-financement" }, [el("label", { classe: "champ" }, ["Mode", mode]), lignePart, lignePartn,
        el("button", { type: "button", classe: "btn-contour", texte: mode.value === "national" && f.mode === "national" ? "Proposer ce montage" : "Proposer ce montage", onclick: function () {
          var m = mode.value;
          modifierParams(function (pp) {
            pp.financements = pp.financements || {};
            if (m === "national") delete pp.financements[l.id];
            else pp.financements[l.id] = { mode: m, part: Math.max(0, Math.min(100, Number(part.value) || 0)), partenaires: partn.value.trim(), propose_par: etat.role, valide: etat.role === "Animateur" };
            if (pp.defections) delete pp.defections[l.id];
          }).then(function () { toast(m === "national" ? "Financement national" : "Montage proposé : l'animateur doit le valider"); });
        } })]);
      b.appendChild(el("details", { classe: "details-financement" }, [el("summary", { texte: "Proposer un montage (DGRIS, DGA, MEFR ou le pôle)" }), formF]));
    }
    if (etat.role === "Animateur" && f.mode !== "national") {
      var cb = el("input", { type: "checkbox", id: "fin-val-" + l.id });
      cb.checked = !!f.valide;
      cb.addEventListener("change", function () { modifierParams(function (pp) { pp.financements = pp.financements || {}; if (pp.financements[l.id]) pp.financements[l.id].valide = cb.checked; }); });
      b.appendChild(el("label", { for: cb.id, classe: "case-cocher" }, [cb, " Partenaire plausible : montage validé"]));
      var def = M.defectionDe(l, p);
      b.appendChild(el("button", { type: "button", classe: "btn-contour " + (def ? "" : "btn-alerte"), texte: def ? "Annuler la défection" : "Déclencher la défection de l'allié", onclick: function () {
        modifierParams(function (pp) {
          pp.defections = pp.defections || {};
          if (def) delete pp.defections[l.id];
          else { pp.defections[l.id] = true; if (pp.arbitrages) delete pp.arbitrages[l.id]; }
        }).then(function () { toast(def ? "Défection annulée" : "Défection : la part française remonte, la ligne repasse en attente d'arbitrage"); });
      } }));
    }
    return b;
  }

  function enveloppesVisibles() {
    return M.enveloppesDe(params()).filter(function (e) { return vueComplete() || e.role === etat.role; });
  }
  function blocEnveloppe(l) {
    var envs = M.enveloppesDe(params()).filter(function (e) { return e.role === l.role; });
    if (!envs.length && !l.enveloppe) return null;
    var b = el("section", { classe: "bloc-conception" });
    b.appendChild(el("h3", { texte: "Enveloppe interne" }));
    var e = M.enveloppeDe(l, params());
    if (l.role === etat.role) {
      var sel = el("select", { "aria-label": "Enveloppe" });
      sel.appendChild(el("option", { value: "", texte: "Hors enveloppe : pèse directement sur la table" }));
      envs.forEach(function (x) { sel.appendChild(el("option", { value: x.id, texte: x.nom + " · " + md(x.montant) + " par an" })); });
      sel.value = l.enveloppe || "";
      sel.addEventListener("change", function () { l.enveloppe = sel.value || null; enregistrer(l); rendre(true); });
      b.appendChild(el("label", { classe: "champ" }, ["Ranger dans", sel]));
    } else {
      b.appendChild(el("p", { classe: "aide", texte: e ? "Rangée dans l'enveloppe " + e.nom + " (" + e.role + ")." : "Hors enveloppe." }));
    }
    if (e) b.appendChild(el("p", { classe: "aide" }, ["Seul l'excédent de l'enveloppe pèse sur la table. ", el("button", { type: "button", classe: "btn-lien", texte: "Voir l'enveloppe", onclick: function () { etat.volet = "enveloppes"; rendreVolet(); } })]));
    return b;
  }

  function blocTranches(l) {
    if (l.type !== "libre" || l.role !== etat.role) return null;
    var tr = M.tranchesDe(l);
    var inp = el("input", { placeholder: "ex. 300, 500, 200", value: tr.join(", "), "aria-label": "Tranches en M€" });
    inp.addEventListener("change", function () {
      l.tranches = inp.value.split(/[;,\s]+/).map(function (x) { return M.arrondiCase(x); }).filter(function (x) { return x > 0; });
      if (!l.tranches.length) delete l.tranches;
      enregistrer(l); rendre(true);
    });
    return el("label", { classe: "champ" }, ["Programme en tranches N1, N2…, M€ (facultatif)", inp,
      el("small", { classe: "aide", texte: "Sur la trajectoire, N1 est payée l'année d'entrée, N2 l'année suivante, etc." })]);
  }

  function selectDebut(l, apres) {
    var sel = el("select", { "aria-label": "Année d'entrée" });
    sel.appendChild(el("option", { value: "", texte: "non placée (2032 seulement)" }));
    M.ANNEES.forEach(function (a) { sel.appendChild(el("option", { value: a, texte: "dès " + a })); });
    sel.appendChild(el("option", { value: M.APRES_LPM, texte: "après 2032" }));
    var d = M.debutDe(l, params());
    sel.value = d === null ? "" : String(d);
    sel.addEventListener("change", function () {
      modifierParams(function (pp) { pp.debuts = pp.debuts || {}; if (sel.value) pp.debuts[l.id] = Number(sel.value); else delete pp.debuts[l.id]; }).then(apres || function () {});
    });
    return sel;
  }
  function blocTrajectoire(l) {
    if (!l.cible) return null;
    var b = el("section", { classe: "bloc-conception" });
    b.appendChild(el("h3", { texte: "Trajectoire 2027-2032" }));
    var d = M.debutDe(l, params());
    b.appendChild(el("p", { classe: "aide", texte: "Ligne du modèle 2032. " + (d === null ? "Pas encore placée sur la trajectoire." : d === M.APRES_LPM ? "Glisse après 2032." : "Entre en " + d + ".") }));
    if (!enCible() && peutEtaler()) b.appendChild(el("label", { classe: "champ" }, ["Année d'entrée", selectDebut(l)]));
    return b;
  }

  // ---------- Vues : flottaison, enveloppes, trajectoire ----------
  function nomVisible(l) { return visible(l) ? libelleLigne(l) : "Demande " + M.armeeDeLigne(l, IDX); }
  function voletFlottaison(v) {
    var p = params();
    var lignes = etat.vue === "arbitrage" ? M.lignesApresArbitrage(lignesJeu(), p) : lignesJeu();
    var f = M.flottaison(PIONS, lignes, p, etat.annee);
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Ligne de flottaison " + etat.annee }));
    v.appendChild(el("p", { classe: "aide", texte: "On empile le socle et les économies, puis les contraintes politiques, puis les demandes de P1 à P4. Ce qui passe sous la ligne du plafond est à abandonner ou à différer." }));
    var ol = el("ol", { classe: "flottaison" });
    ol.appendChild(el("li", { classe: "flot-base" }, [el("span", { classe: "flot-rang", texte: "Socle" }), el("span", { classe: "flot-nom", texte: "Socle et économies" }), el("span", { classe: "num", texte: md(f.base) })]));
    var ligneTracee = false;
    function tracer() {
      ol.appendChild(el("li", { classe: "flot-ligne" }, [el("span", { texte: "Plafond " + etat.annee + " · " + md(f.plafond) })]));
      ligneTracee = true;
    }
    f.items.forEach(function (it) {
      if (it.sous && !ligneTracee) tracer();
      var rang = it.contrainte ? el("span", { classe: "flot-rang" }, [el("span", { classe: "drapeau", title: "Contrainte politique" })]) : el("span", { classe: "flot-rang", texte: "P" + it.rang });
      var nom = it.ligne ? nomVisible(it.ligne) : "Excédent enveloppe " + it.enveloppe.nom;
      var qui = it.ligne ? it.ligne.role : it.enveloppe.role;
      ol.appendChild(el("li", { classe: "flot-item" + (it.sous ? " flot-sous" : "") }, [
        el("button", { type: "button", onclick: function () {
          if (it.ligne) { etat.selection = { ligne: it.ligne.id, pion: it.ligne.pion || null }; etat.volet = "selection"; }
          else etat.volet = "enveloppes";
          rendre(true);
        } }, [rang, el("span", { classe: "flot-nom" }, [nom, el("small", { texte: qui + (it.sous ? " · sous la ligne : à abandonner ou différer" : "") })]),
          el("span", { classe: "num" }, [md(it.cout), el("small", { texte: "cumul " + md(it.cumul) })])])]));
    });
    if (!ligneTracee) tracer();
    v.appendChild(ol);
    v.appendChild(el("p", { classe: "total-demande" }, [el("b", { classe: f.marge < 0 ? "neg" : "pos", texte: f.marge < 0 ? "Dépassement " + md(-f.marge) : "Marge " + md(f.marge) }),
      f.sous.length ? " · " + f.sous.length + " demande" + (f.sous.length > 1 ? "s" : "") + " sous la ligne" : ""]));
  }

  function voletEnveloppes(v) {
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Enveloppes internes " + etat.annee }));
    v.appendChild(el("p", { classe: "aide", texte: "Le pôle range ses lignes dans son enveloppe, par priorité. Il voit ce qui tient et ce qui déborde avant l'arbitrage ; seul l'excédent pèse sur la table." }));
    var envs = enveloppesVisibles();
    if (!envs.length) { v.appendChild(el("p", { classe: "vide", texte: "Aucune enveloppe pour ce pôle." })); return; }
    envs.forEach(function (e) {
      var et = M.etatEnveloppe(e, PIONS, lignesJeu(), params(), etat.annee);
      var max = Math.max(et.montant, et.total) || 1;
      var bloc = el("section", { classe: "enveloppe" });
      bloc.appendChild(el("h3", { texte: e.nom + " · " + e.role + " · " + md(et.montant) + " par an" }));
      var barre = el("div", { classe: "env-barre" }, [el("span", { classe: "env-plein", style: "width:" + (100 * Math.min(et.total, et.montant) / max) + "%" }),
        et.depassement ? el("span", { classe: "env-trop", style: "width:" + (100 * et.depassement / max) + "%" }) : null,
        el("i", { style: "left:" + (100 * et.montant / max) + "%" })]);
      bloc.appendChild(barre);
      bloc.appendChild(el("p", { classe: "aide", texte: md(et.total) + " rangés · " + (et.depassement ? "excédent " + md(et.depassement) + ", posé sur la table" : "reste " + md(et.reste)) }));
      var ul = el("ul", { classe: "liste-demande" });
      et.items.forEach(function (it) {
        var l = it.ligne;
        ul.appendChild(el("li", { classe: it.tient ? "" : "env-deborde" }, [el("button", { type: "button", style: "--c:" + couleur(M.armeeDeLigne(l, IDX)), onclick: function () { etat.selection = { ligne: l.id, pion: l.pion || null }; etat.volet = "selection"; rendre(true); } }, [
          el("span", null, [el("b", { texte: libelleLigne(l) }), el("small", { texte: "P" + M.prioriteDe(l, params()).valeur + " · " + (it.tient ? "tient dans l'enveloppe" : "déborde") })]),
          el("span", { classe: "num" }, [md(it.cout), el("small", { texte: "cumul " + md(it.cumul) })])])]));
      });
      if (!et.items.length) ul.appendChild(el("li", { classe: "vide", texte: "Rien de rangé en " + etat.annee + ". Ouvrez une demande de votre pôle et choisissez « Ranger dans " + e.nom + " »." }));
      bloc.appendChild(ul);
      v.appendChild(bloc);
    });
  }

  function voletTrajectoire(v) {
    var p = params();
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Trajectoire 2027-2032" }));
    v.appendChild(el("p", { classe: "aide", texte: "On étale ce qui a été retenu au modèle 2032 année par année, sous les plafonds. Les investissements suivent leurs tranches N1, N2… ; les DORESE arrivent avec leur capacité ; ce qui déborde glisse à l'année suivante." }));
    if (peutEtaler()) {
      v.appendChild(el("button", { type: "button", classe: "btn-laiton", texte: "Étaler automatiquement", onclick: function () {
        var r = M.etalerAuto(PIONS, etat.lignes, params());
        modifierParams(function (pp) { pp.debuts = Object.assign({}, pp.debuts || {}, r.debuts); })
          .then(function () { toast(Object.keys(r.debuts).length + " ligne(s) placée(s)" + (r.horsLpm.length ? " · " + r.horsLpm.length + " glisse(nt) après 2032" : "")); });
      } }));
    }
    var cibles = etat.lignes.filter(function (l) { return l.cible && visible(l) && M.arbitrageDe(l, p).statut !== "renonce"; }).sort(M.comparerEmpilement(p));
    if (!cibles.length) { v.appendChild(el("p", { classe: "vide", texte: "Aucune ligne du modèle 2032 pour l'instant. Composez d'abord le modèle (étape 1)." })); return; }
    function n(m) { return m ? (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""; }
    var arb = M.synthese(PIONS, M.lignesApresArbitrage(lignesJeu(), p), p);
    var entete = el("div", { classe: "traj-bande traj-entete" }, M.ANNEES.map(function (a) { return el("span", { texte: String(a) }); }));
    var ul = el("ul", { classe: "trajectoire" }, [el("li", { classe: "traj-tete" }, [el("span", { texte: "En Md€ par an" }), entete])]);
    cibles.forEach(function (l) {
      var c = chiffre(l), st = M.arbitrageDe(l, p).statut, d = M.debutDe(l, p);
      var bande = el("div", { classe: "traj-bande" }, M.ANNEES.map(function (a) { return el("span", { classe: c.annees[a] ? "traj-on" : "", texte: n(c.annees[a]) }); }));
      var meta = l.role + " · " + (M.contrainteAcquise(l.id, p) ? "contrainte politique" : "P" + M.prioriteDe(l, p).valeur) + " · " + M.STATUTS[st].toLowerCase();
      ul.appendChild(el("li", { classe: d === M.APRES_LPM ? "traj-hors" : "" }, [
        el("div", { classe: "traj-nom" }, [
          el("button", { type: "button", classe: "btn-lien", texte: libelleLigne(l), onclick: function () { etat.selection = { ligne: l.id, pion: l.pion || null }; etat.volet = "selection"; rendre(true); } }),
          el("small", { texte: meta + (c.hors ? " · " + md(c.hors) + " après 2032" : "") }),
          peutEtaler() ? selectDebut(l) : el("small", { classe: "traj-debut", texte: d === null ? "non placée" : d === M.APRES_LPM ? "après 2032" : "entre en " + d })
        ]), bande]));
    });
    ul.appendChild(el("li", { classe: "traj-marge" }, [el("span", { texte: "Marge après arbitrage" }),
      el("div", { classe: "traj-bande" }, M.ANNEES.map(function (a) { return el("span", { classe: arb[a].marge < 0 ? "neg" : "pos", texte: n(arb[a].marge) || "0" }); }))]));
    v.appendChild(ul);
  }

  // ---------- Démarrage ----------
  function demarrer() {
    $("note-mode").textContent = S.mode === "partage" ? "Base partagée : chaque pôle voit les autres avancer en quelques secondes." : "Mode local : les parties restent dans ce navigateur.";
    $("btn-montrer-creer").addEventListener("click", function () { etapeAccueil("creer"); $("cre-nom").focus(); });
    $("btn-montrer-rejoindre").addEventListener("click", function () { etapeAccueil("rejoindre"); });
    $("form-rejoindre").addEventListener("submit", function (ev) {
      ev.preventDefault();
      $("rej-erreur").textContent = "";
      var nom = $("rej-partie").value, mdp = $("rej-mdp").value;
      if (!nom) { $("rej-erreur").textContent = "Ouvrez d'abord une partie, ou demandez son nom à l'animateur."; return; }
      S.ouvrirPartie(nom, mdp).then(function (p) { montrerRoles(p, mdp); }).catch(function (e) { $("rej-erreur").textContent = e.message; });
    });
    $("form-creer").addEventListener("submit", function (ev) {
      ev.preventDefault();
      $("cre-erreur").textContent = "";
      var nom = $("cre-nom").value.trim(), mdp = $("cre-mdp").value;
      if (mdp !== $("cre-mdp2").value) { $("cre-erreur").textContent = "Les deux mots de passe diffèrent."; return; }
      S.creerPartie(nom, mdp, M.parametresParDefaut()).then(function (p) { montrerRoles(p, mdp); }).catch(function (e) { $("cre-erreur").textContent = e.message; });
    });
    $("btn-retour-partie").addEventListener("click", quitter);
    $("btn-quitter").addEventListener("click", quitter);
    $("btn-role").addEventListener("click", function () { montrerRoles(etat.partie, etat.mdp); });
    document.querySelectorAll(".bascule button[data-vue]").forEach(function (b) { b.addEventListener("click", function () { etat.vue = b.getAttribute("data-vue"); rendre(false); }); });
    document.querySelectorAll(".bascule button[data-filtre]").forEach(function (b) { b.addEventListener("click", function () { etat.maTable = b.getAttribute("data-filtre") === "mien"; rendre(false); }); });
    setInterval(function () { if (etat.partie && etat.role && !Object.keys(enAttente).length) recharger(false); }, S.mode === "partage" ? 6000 : 5000);

    etapeAccueil("rejoindre");
    chargerParties().then(function () {
      var mem = null;
      try { mem = JSON.parse(sessionStorage.getItem(CLE_SESSION)); } catch (e) { mem = null; }
      if (mem && mem.nom && mem.role) {
        S.ouvrirPartie(mem.nom, mem.mdp).then(function (p) {
          etat.partie = p; etat.mdp = mem.mdp; if (mem.annee) etat.annee = mem.annee; if (mem.phase) etat.phase = mem.phase;
          return entrer(mem.role);
        }).catch(function () { etat.partie = null; memoriser(); });
      }
    });
  }

  demarrer();
})();
