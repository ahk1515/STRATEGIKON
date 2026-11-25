// STRATEGIKON, conception « table d'abord » : le joueur agit sur la table de l'année,
// les lignes de la base sont écrites en arrière-plan.
(function () {
  "use strict";

  var M = window.STRAT_MOTEUR;
  var S = window.STRAT_STOCKAGE;
  var PIONS_BASE = window.STRAT_PIONS || [];
  var PIONS = PIONS_BASE;
  var CATALOGUE = window.STRAT_CATALOGUE_ROLES || [];
  var REGLES = window.STRAT_CONTRAINTES_ROLES || [];
  var IDX = M.indexPions(PIONS);
  var ROLES_REGLAGES = ["Animateur", "SC-Plans", "CEMA"];
  var ROLES_ARBITRAGE = ["CEMA", "Animateur"];
  var ROLES_VUE_COMPLETE = ["CEMA", "Animateur", "SC-Plans"];
  var ROLES_CONTRAINTE = ["MINARM", "Animateur"];           // cochent la contrainte politique
  var ROLES_FINANCEMENT = ["DGRIS", "DGA", "MEFR", "Animateur"]; // proposent un montage de financement
  var ROLES_ETALEMENT = ["CEMA", "SC-Plans", "Animateur"];   // placent les lignes sur la trajectoire
  var ROLES_COCA = ["COCA", "Animateur"];                    // rapport d'alerte et grille des scénarios (COCA-01, COCA-02)
  var ROLES_CONTRATS = ["CEMA", "Animateur"];                // notent les contrats opérationnels (CEMA-02)
  var FIN = M.ANNEES[M.ANNEES.length - 1];
  var CLE_SESSION = "strategikon.table";

  var etat = {
    partie: null, mdp: "", role: "", lignes: [], annee: M.ANNEES[0], vue: "demandes",
    volet: "poser", filtre: "capacites", portee: "suite", recherche: "", selection: null, neuf: null, filtreTable: "tout",
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
  function couleurZone(z) { return { "DGA": "#6d52a8", "International": "#2a7f8f", "SGA": "#7a6a4f", "MEFR": "#2f6b4f", "MINARM": "#8a2d3b", "Fixes": "var(--gris)" }[z] || couleur(z); }
  function couleur(a) { return { "Terre": "var(--terre)", "Marine": "var(--marine)", "Air et Espace": "var(--air)", "Interarmées": "var(--inter)" }[a] || "var(--inter)"; }
  function nouvelId() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "l-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function role(code) { return M.ROLES.filter(function (r) { return r.code === code; })[0] || M.ROLES[0]; }
  function vueComplete() { return ROLES_VUE_COMPLETE.indexOf(etat.role) !== -1; }
  function arbitre() { return ROLES_ARBITRAGE.indexOf(etat.role) !== -1; }
  // Table commune : chacun voit toutes les demandes brutes, avec leur porteur.
  function visible(l) { return true; }
  function params() { return (etat.partie && etat.partie.params && etat.partie.params.plafonds) ? etat.partie.params : M.parametresParDefaut(); }
  // Référence sur la table : on remplace, en lecture seule, les lignes et paramètres affichés par ceux du fichier.
  var VUE_REF = null;
  function lectureSeule() {
    if (!VUE_REF) return false;
    toast("Vous regardez la référence : rien n'est modifiable. Revenez aux joueurs pour agir.");
    return true;
  }
  function voirReference(on) {
    if (on && !VUE_REF) {
      var ref = chargerReference();
      if (!ref) { toast("Importez d'abord une trajectoire de référence (onglet Échanges)."); return; }
      var r = M.partieDepuisEchange(ref, params());
      VUE_REF = { lignes: etat.lignes, params: etat.partie.params, ref: ref };
      etat.lignes = r.lignes; etat.partie.params = r.params;
      etat.phase = "trajectoire";
      etat.selection = null;
      rendre(true);
    } else if (!on && VUE_REF) {
      var g = VUE_REF; VUE_REF = null;
      etat.lignes = g.lignes; etat.partie.params = g.params; etat.phase = "trajectoire";
      etat.selection = null;
      rendre(true); recharger(true);
    }
  }
  // Filtre par acteur (rôles qui voient toute la table) : les demandes d'un rôle et les pions de son armée.
  function pionDuRole(p, r) {
    if (!p || p.type === "gris" || p.type === "orange") return false;
    var a = role(r).armee;
    return a !== "Interarmées" && p.armee === a;
  }
  // Pions de la partie : ceux de la base, avec les noms et coûts modifiés par l'animateur.
  var SIG_PIONS = "";
  function majPions() {
    var sig = JSON.stringify(params().pionsModifies || {});
    if (sig === SIG_PIONS) return;
    SIG_PIONS = sig; PIONS = M.pionsDeLaPartie(PIONS_BASE, params()); IDX = M.indexPions(PIONS);
  }
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
    if (l.type === "durci") return "Durcissement (sur-dotation)";
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
    etat.filtreTable = "tout";
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
    if (!etat.partie || VUE_REF) return Promise.resolve();
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
    if (lectureSeule()) return;
    clearTimeout(enAttente[l.id]);
    enAttente[l.id] = setTimeout(function () {
      S.ecrireLigne(etat.partie.nom, etat.mdp, l).then(function () { delete enAttente[l.id]; })
        .catch(function (e) { delete enAttente[l.id]; toast("Non enregistré : " + e.message); });
    }, 350);
  }
  function supprimer(l) {
    if (lectureSeule()) return;
    clearTimeout(enAttente[l.id]); delete enAttente[l.id];
    etat.lignes = etat.lignes.filter(function (x) { return x.id !== l.id; });
    S.supprimerLigne(etat.partie.nom, etat.mdp, l.id).catch(function (e) { toast(e.message); });
  }
  var fileParams = Promise.resolve();
  function modifierParams(fn) {
    if (lectureSeule()) return Promise.resolve();
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
    if (g.type === "dorese" || g.type === "retrait" || g.type === "degrade" || g.type === "durci") return l.pion === g.pion;
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

  // Durcissement (SCP-03) : ajoute ou retire une DORESE de sur-dotation à une capacité du socle.
  function durcir(p, k, delta) {
    var l = etat.lignes.filter(function (x) { return memeGeste(x, { type: "durci", pion: p.id }); })[0];
    if (!l) l = poser({ type: "durci", pion: p.id });
    l.dorese_sup = M.doreseSup(l);
    l.dorese_sup[k] = Math.max(0, l.dorese_sup[k] + delta);
    var n = l.dorese_sup.ao + l.dorese_sup.mco + l.dorese_sup.rh;
    if (!n) { supprimer(l); etat.selection = { pion: p.id }; etat.volet = "selection"; rendre(true); return; }
    enregistrer(l);
    rendre(true);
    toast("Durcissement : " + n + " DORESE au-delà de 100 %");
  }

  // ---------- Rendu ----------
  // Alertes des règles des fiches : recalculées à chaque rendu, jamais bloquantes.
  var ALERTES = [];
  var CHAUDS = {};
  function calculerAlertes() {
    try { ALERTES = M.alertes(PIONS, etat.lignes, paramsPhase(), CATALOGUE); } catch (e) { ALERTES = []; }
    try { CHAUDS = M.pointsChauds(PIONS, etat.lignes, paramsPhase(), CATALOGUE, etat.annee); } catch (e) { CHAUDS = {}; }
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
    majPions();
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
    if (etat.role === "Animateur" && (VUE_REF || chargerReference())) {
      g.appendChild(el("div", { classe: "bascule bascule-ref", role: "group", "aria-label": "Trajectoire affichée" }, [
        el("button", { type: "button", "aria-pressed": VUE_REF ? "false" : "true", id: "voir-joueurs", onclick: function () { voirReference(false); } }, ["Joueurs"]),
        el("button", { type: "button", "aria-pressed": VUE_REF ? "true" : "false", id: "voir-reference", onclick: function () { voirReference(true); } }, ["Référence"])]));
    }
    document.body.classList.toggle("en-reference", !!VUE_REF);
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
    // Filtres : « Ma demande » (mes pions seuls) ; « Où faut-il arbitrer ? » (les points chauds seuls) ; tables compactes.
    var rf = vueComplete() ? etat.roleFiltre : "";
    var filtre = etat.filtreTable !== "tout" || !!rf;
    var t = rf
      ? M.placerAnnee(PIONS, lignes.filter(function (l) { return l.role === rf; }), p, etat.annee, function (x) { return pionDuRole(x, rf); }, { apresArbitrage: etat.vue === "arbitrage" })
      : etat.filtreTable === "mien"
      ? M.placerAnnee(PIONS, lignes.filter(function (l) { return l.role === etat.role; }), p, etat.annee, function (x) { return pionAMoi(x); }, { apresArbitrage: etat.vue === "arbitrage" })
      : etat.filtreTable === "chaud"
      ? M.placerAnnee(PIONS, lignes.filter(function (l) { return CHAUDS[l.id]; }), p, etat.annee, function () { return false; }, { apresArbitrage: etat.vue === "arbitrage" })
      : M.placerAnnee(PIONS, lignes, p, etat.annee, null, { apresArbitrage: etat.vue === "arbitrage", zones: true });
    var paquets = t.zones && t.zones.length > 0;
    // En paquets, les demandes d'un acteur hors armées prennent la couleur de son paquet.
    var ACTEURS = { DGA: 1, International: 1, SGA: 1, MEFR: 1, MINARM: 1 };
    function teinte(x) { return paquets && ACTEURS[x.groupe] ? couleurZone(x.groupe) : couleur(x.armee); }
    if (filtre) {
      var bas = 0;
      t.pieces.forEach(function (x) { bas = Math.max(bas, x.r + x.h); });
      t.cellules.forEach(function (x) { bas = Math.max(bas, x.r + 1); });
      t.hauteur = Math.max(4, bas + 2);
    }
    document.querySelectorAll(".bascule button[data-vue]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-vue") === etat.vue ? "true" : "false"); });
    document.querySelectorAll(".bascule button[data-filtre]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-filtre") === etat.filtreTable ? "true" : "false"); });
    var selR = $("filtre-role");
    if (!selR) {
      selR = el("select", { id: "filtre-role", "aria-label": "Acteur affiché" });
      selR.addEventListener("change", function () { etat.roleFiltre = selR.value; rendre(false); });
      document.querySelector(".bascules").appendChild(selR);
    }
    vider(selR);
    selR.hidden = !vueComplete();
    selR.appendChild(el("option", { value: "", texte: "Tous les acteurs" }));
    var presents = {}; etat.lignes.forEach(function (l) { presents[l.role] = true; });
    M.ROLES.forEach(function (r) { if (presents[r.code]) selR.appendChild(el("option", { value: r.code, texte: r.code })); });
    if (rf && !presents[rf]) selR.appendChild(el("option", { value: rf, texte: rf }));
    selR.value = rf || "";
    var nChauds = Object.keys(CHAUDS).length;
    var bChaud = document.querySelector('.bascule button[data-filtre="chaud"]');
    if (bChaud) bChaud.textContent = "Où faut-il arbitrer ?" + (nChauds ? " (" + nChauds + ")" : "");

    var rel = $("table-releve");
    vider(rel);
    [filtre ? [(rf ? rf + " (socle de son armée + demandes) " : etat.filtreTable === "chaud" ? "À arbitrer " : "Ma demande ") + etat.annee, md(t.occupees * M.CASE) + " · " + t.occupees + " cases", ""] : ["Table " + etat.annee, t.occupees + " / " + t.plafond + " cases", ""], ["Montant total", md(syn.total), ""], ["Plafond", md(syn.plafond), ""],
      [syn.marge >= 0 ? "Marge" : "Dépassement", md(Math.abs(syn.marge)), syn.marge >= 0 ? "pos" : "neg"]].forEach(function (x) {
      rel.appendChild(el("div", { classe: "releve" }, [el("small", { texte: x[0] }), el("b", { classe: x[2], texte: x[1] })]));
    });
    $("consigne").textContent = (VUE_REF ? "Trajectoire de référence (" + (VUE_REF.ref.partie || "fichier importé") + "), lecture seule, " + etat.annee + ". Bouton « Joueurs » en haut pour revenir. " : enCible() ? "Étape 1 · modèle 2032. " : "Étape 2 · trajectoire " + etat.annee + ". ") + (rf ? "Seules les demandes de " + rf + " et les pions de son armée. " : "") + (arbitre()
      ? "Table commune : toutes les demandes, avec leur porteur et les avis de chacun. Les points chauds s'allument ; « Où faut-il arbitrer ? » ne garde qu'eux. Cliquez sur un pion pour voir ses avis et trancher."
      : etat.filtreTable === "chaud" ? "Seuls les points chauds : avis divergents, alertes des fiches, demandes sous la ligne de flottaison. Cliquez sur un pion pour donner votre avis."
      : filtre ? "Vos pions seuls, regroupés. Cliquez sur un pion pour le modifier, sur une case vide pour en poser un nouveau."
      : "Table commune : tout le monde voit toutes les demandes, avec leur porteur. Proposez un pion (case vide), ou cliquez sur un pion pour le modifier ou donner votre avis.")
      + (function () { var n = alertesVisibles().filter(function (a) { return a.niveau === "alerte"; }).length; return n ? " " + n + " alerte" + (n > 1 ? "s" : "") + " des fiches (pastille « ! »)." : ""; })()
      + (flot.sous.length ? " " + flot.sous.length + " demande" + (flot.sous.length > 1 ? "s passent" : " passe") + " sous la ligne de flottaison (barre rouge)." : "");

    var pl = $("plateau");
    vider(pl);
    pl.style.gridTemplateRows = "repeat(" + t.hauteur + ", var(--case))";
    for (var k = 0; k < t.hauteur * t.largeur; k++) {
      pl.appendChild(el("div", { classe: "fond fond-clic" + (filtre || paquets ? "" : k >= t.table ? " fond-horstable" : k >= t.plafond ? " fond-hors" : ""), title: "Poser un nouveau pion en " + etat.annee, style: "grid-row:" + (Math.floor(k / t.largeur) + 1) + ";grid-column:" + (k % t.largeur + 1),
        onclick: function () { etat.selection = null; etat.volet = "poser"; rendre(true); toast("Choisissez à droite le pion à poser en " + etat.annee); } }));
    }
    // Table en paquets : un cadre et un titre par entité.
    (t.zones || []).forEach(function (z) {
      var mien = z.nom === ({ EMAT: "Terre", EMM: "Marine", EMAAE: "Air et Espace", DGA: "DGA", DGRIS: "International", MEAE: "International", SGA: "SGA", MEFR: "MEFR", MINARM: "MINARM" }[etat.role]);
      pl.appendChild(el("div", { classe: "zone-entite" + (mien ? " zone-mienne" : ""), style: "grid-row:" + (z.r + 1) + " / " + (z.r + z.h + 1) + ";grid-column:" + (z.c + 1) + " / " + (z.c + z.w + 1) + ";--c:" + couleurZone(z.nom) }));
      pl.appendChild(el("div", { classe: "zone-entite-titre", style: "grid-row:" + (z.r + 1) + ";grid-column:" + (z.c + 1) + " / " + (z.c + z.w + 1) + ";--c:" + couleurZone(z.nom) }, [el("span", { texte: z.nom + " · " + md(z.cases * M.CASE) })]));
    });
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
    function depasse(r, c, w, h) { if (filtre || paquets) return false; for (var i = r; i < r + h; i++) for (var j = c; j < c + w; j++) if (i * t.largeur + j >= t.plafond) return true; return false; }
    function masque(x) { return false; }
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
      var bande = x.groupe === "Fixes" ? "var(--gris-carte)" : x.nature === "violet" ? "var(--violet)" : x.nature === "orange" ? "var(--orange-carte)" : teinte(x);
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
      if (x.ligne && CHAUDS[x.ligne]) cl.push("pion-chaud");
      if (mq && mq.defection) cl.push("pion-defection");
      if (x.durci) { cl.push("pion-durci"); }
      var cache = masque(x);
      var nom = cache ? "Demande " + x.armee : x.libelle;
      var pion = x.pion ? IDX[x.pion] : null;
      var picto = cache ? null : F.svg(F.pictoDe(x.libelle) || (pion && pion.nom_origine && F.pictoDe(pion.nom_origine)) || "puce");
      var enfants = [el("span", { classe: "fig-bande" }, [el("span", { classe: "fig-titre", texte: court(nom) }), x.role && !x.socle ? el("span", { classe: "porteur", texte: x.role }) : null])];
      if (picto) enfants.push(el("span", { classe: "fig-picto" }, [picto]));
      var notes = [];
      if (mq && mq.contrainte) { enfants.push(el("span", { classe: "drapeau drapeau-pion", title: "Contrainte politique : non arbitrable" })); notes.push("contrainte politique"); }
      if (mq && mq.part < 1) { enfants.push(el("span", { classe: "part-alliee", style: "width:" + Math.round(100 * (1 - mq.part)) + "%" })); }
      if (mq && mq.financement) {
        var sv = M.souveraineteDe(ligneDe(x.ligne) || { id: x.ligne }, p);
        enfants.push(el("span", { classe: "marque-fin" + (mq.financementActif ? "" : " marque-proposee") + (sv.zone === "hors_ue" || sv.zone === "mixte" ? " marque-horsue" : ""), title: sv.libelle }, [mq.financement === "mutualise" ? F.svg("globe") : el("b", { texte: "UE" })]));
        notes.push(sv.libelle);
      }
      if (mq && mq.defection) notes.push("défection de l'allié");
      if (x.durci) { notes.push("durcie (DORESE au-delà de 100 %)"); enfants.push(el("span", { classe: "marque-durci", title: "Capacité durcie" }, ["D+"])); }
      if (x.ligne && sousLigne[x.ligne]) notes.push("sous la ligne de flottaison");
      if (x.ligne && CHAUDS[x.ligne]) notes.push("à arbitrer : " + CHAUDS[x.ligne].join(", "));
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
      if (x.ligne && CHAUDS[x.ligne] && x.nature !== "dorese") cl.push("pion-chaud");
      if ((x.ligne && sousLigne[x.ligne]) || (x.enveloppe && sousLigne["env:" + x.enveloppe])) cl.push("pion-sous");
      if (x.marques && x.marques.defection) cl.push("pion-defection");
      if (x.enveloppe) cl.push("jeton-enveloppe");
      var drap = x.marques && x.marques.contrainte && x.ligne && !drapeauxPoses[x.ligne];
      if (drap) drapeauxPoses[x.ligne] = true;
      var alerteCase = null;
      if (x.ligne && x.nature !== "dorese" && !alertesPosees[x.ligne] && !masque(x)) { alerteCase = marqueAlerte(alertesDe(x.ligne)); if (alerteCase) alertesPosees[x.ligne] = true; }
      if (!paquets && x.r * t.largeur + x.c >= t.plafond) cl.push("pion-debord");
      if (x.role && x.role === etat.role) cl.push("pion-mien");
      var cible = x.nature === "dorese" && x.parent !== undefined ? t.pieces[x.parent] : x;
      if (x.ligne && x.ligne === etat.neuf) cl.push("pion-neuf");
      if (selectionCorrespond(cible) || (x.ligne && etat.selection && etat.selection.ligne === x.ligne)) cl.push("pion-choisi");
      if (x.nature === "dorese" ? estompe(cible) && estompe(x) : estompe(x)) cl.push("pion-estompe");
      var nom = masque(x) ? (x.nature === "dorese" ? "DORESE" : "Demande " + x.armee) : x.libelle;
      var ic = x.nature === "dorese" ? F.svg(F.DORESE[x.type]) : F.svg(masque(x) ? "document" : (F.pictoDe(x.libelle) || "document"));
      var titre = nom + (x.role ? " · " + x.role : "") + (x.ligne && CHAUDS[x.ligne] ? " · à arbitrer : " + CHAUDS[x.ligne].join(", ") : "") + (x.allie ? " · part alliée (ne compte pas pour la France)" : "") + (x.enveloppe ? " · cliquez pour voir l'enveloppe" : "");
      pl.appendChild(el("button", { type: "button", classe: cl.join(" "), title: titre, style: "grid-row:" + (x.r + 1) + ";grid-column:" + (x.c + 1) + ";--bande:" + teinte(x),
        onclick: x.enveloppe ? function () { etat.volet = "enveloppes"; rendre(true); } : x.ligne && x.nature !== "dorese" ? choisir(x) : x.ligne ? choisir({ ligne: x.ligne, pion: cible.pion }) : choisir(cible) },
        [ic, drap ? el("span", { classe: "drapeau drapeau-pion" }) : null, alerteCase]));
    });
    // Nom des demandes en cases (options, pions sur mesure) : une étiquette sur la plus longue
    // rangée de cases contiguës de la ligne, pour qu'on lise ce qui est posé.
    var parLigne = {};
    t.cellules.forEach(function (x) { if (x.nature === "libre" && (x.ligne || x.carburant)) { var k = x.ligne || "carburants"; (parLigne[k] = parLigne[k] || []).push(x); } });
    Object.keys(parLigne).forEach(function (id) {
      var cs = parLigne[id], meilleur = null;
      cs.forEach(function (x) {
        var long = 1;
        while (cs.some(function (y) { return y.r === x.r && y.c === x.c + long; })) long++;
        var debut = !cs.some(function (y) { return y.r === x.r && y.c === x.c - 1; });
        if (debut && (!meilleur || long > meilleur.w)) meilleur = { r: x.r, c: x.c, w: long };
      });
      if (!meilleur) return;
      var x0 = cs[0];
      pl.appendChild(el("span", { classe: "etiquette-ligne" + (meilleur.w < 3 ? " etiquette-courte" : ""), "aria-hidden": "true",
        style: "grid-row:" + (meilleur.r + 1) + ";grid-column:" + (meilleur.c + 1) + " / span " + meilleur.w + ";--bande:" + (x0.carburant ? "var(--orange-carte)" : teinte(x0)) },
        [el("b", { texte: x0.carburant ? "Carburants " + md(cs.length * M.CASE) : court(x0.libelle) }), x0.role ? el("small", { texte: x0.role }) : null]));
    });
    // Plateaux hors table à conquérir : posés sous la table, avec leur budget.
    if (!filtre) {
      var hAvant = t.hauteur, r0 = t.hauteur + 1;
      M.conquetesDe(p).forEach(function (c) {
        var n = Math.round(c.montant / M.CASE), h = Math.max(1, Math.ceil(n / t.largeur)) + 1;
        var conquis = c.annees.indexOf(etat.annee) !== -1;
        pl.appendChild(el("div", { classe: "conquete" + (conquis ? " conquete-acquise" : ""), style: "grid-row:" + (r0 + 1) + " / span " + h + ";grid-column:1 / -1" }, [
          el("span", { classe: "conquete-titre", texte: c.nom + " · " + md(c.montant) + " · " + (conquis ? "conquis en " + etat.annee + " : ajouté au plafond" : "à conquérir") + (c.annees.length && !conquis ? " (conquis en " + c.annees.join(", ") + ")" : "") })]));
        r0 += h + 1;
      });
      t.hauteur = r0;
      pl.style.gridTemplateRows = "repeat(" + t.hauteur + ", var(--case))";
      for (var kk = hAvant * t.largeur; kk < t.hauteur * t.largeur; kk++) {
        pl.insertBefore(el("div", { classe: "fond fond-conquete", style: "grid-row:" + (Math.floor(kk / t.largeur) + 1) + ";grid-column:" + (kk % t.largeur + 1) }), pl.firstChild);
      }
    }
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
    lg.appendChild(puce("background:var(--carte)", "pion-chaud", "Point chaud : à arbitrer"));
    lg.appendChild(el("span", { classe: "note-legende", texte: "Le socle 2027 est considéré comme arbitré." }));
  }

  // ---------- Volet ----------
  function onglets() {
    var o = [["poser", "Poser"], ["selection", "Sélection"], ["demande", "Ma demande"], ["flottaison", "Flottaison"]];
    if (enveloppesVisibles().length) o.push(["enveloppes", "Enveloppes"]);
    if (!enCible()) o.push(["trajectoire", "Trajectoire"]);
    if (arbitre() || vueComplete()) o.push(["arbitrage", "Arbitrage"]);
    o.push(["redteam", "Red team"]);
    o.push(["bilan", "Bilan"]);
    if (ROLES_REGLAGES.indexOf(etat.role) !== -1) o.push(["reglages", "Réglages"]);
    if (etat.role === "Animateur") o.push(["echanges", "Échanges"]);
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
      arbitrage: voletArbitrage, redteam: voletRedTeam, bilan: voletBilan, reglages: voletReglages, echanges: voletEchanges }[etat.volet] || voletPoser)(v);
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
    if (p.type === "capacite") {
      var ops = M.etatCapacite(p, lignesJeu(), params(), etat.annee);
      lignesEtat.push(["Opérationnalité", ops.retire ? "retirée" : ops.taux + " % · face " + ops.face + (ops.durci ? " (+" + ops.durci + " DORESE)" : "")]);
    }
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
    var durc = etat.lignes.filter(function (x) { return memeGeste(x, { type: "durci", pion: p.id }); })[0];
    if (p.type === "capacite" && M.nbDorese(p) && !degrCetteAnnee && (plein || (renf && M.quantite(effective(renf), etat.annee)))) {
      var boutonsD = el("span", { classe: "durcir-types" });
      [["ao", "AO"], ["mco", "MCO"], ["rh", "RH"]].forEach(function (k) {
        boutonsD.appendChild(el("button", { type: "button", classe: "btn-mini", texte: "+1 " + k[1], onclick: function (ev) { ev.stopPropagation(); durcir(p, k[0], 1); } }));
      });
      actions.appendChild(el("div", { classe: "action" }, [el("b", { texte: "Durcir (sur-dotation)" }),
        el("span", { texte: "DORESE au-delà de 100 % pour la haute intensité, à la demande de l'armée (SCP-03). " + textePortee().replace(/^./, function (c) { return c.toUpperCase(); }) + "." }),
        el("em", { texte: "+" + md(M.CASE) + " par DORESE et par an" }), boutonsD]));
    }
    actions.appendChild(el("button", { type: "button", classe: "action action-retrait", onclick: function () { poser({ type: "retrait", pion: p.id }); } }, [
      el("b", { texte: "Dissoudre" }),
      el("span", { texte: "Décidé en COCEM : le pion reste payé " + M.delaiRetrait(params()) + " ans après la décision, puis quitte la table (SCP-05)." }),
      el("em", { texte: "−" + md(M.coutSocle(p)) + " par an" })
    ]));
    actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: M.nbDorese(p) ? 100 : 50 }); } }, [
      el("b", { texte: "Ajouter un exemplaire" }),
      el("span", { texte: "Un " + p.nom.replace(/ \d$/, "") + " de plus" + (M.nbDorese(p) ? ", à 100 %" : "") }),
      el("em", { texte: "+" + md(M.nbDorese(p) ? p.cout100 : p.cout50) + " par an" })
    ]));
    v.appendChild(actions);
    [renf, diss, degr, durc].forEach(function (l) { if (l) v.appendChild(el("p", { classe: "aide" }, ["Déjà dans votre demande : " + natureLigne(l).toLowerCase() + " (" + anneesDe(l) + "). ", el("button", { classe: "btn-lien", type: "button", texte: "Ouvrir", onclick: function () { etat.selection = { ligne: l.id, pion: l.pion }; rendreVolet(); } })])); });
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
    var decisionPosee = false;
    if (arbitre()) {
      v.appendChild(blocAvis(l));
      v.appendChild(el("section", { classe: "bloc-conception" }, [el("h3", { texte: "Décision du CEMA" }), blocArbitrage(l)]));
      decisionPosee = true;
    }
    [arbitre() ? null : blocAvis(l), blocCoca(l), blocPriorite(l), blocContrainte(l.id, l.role), blocFinancement(l), blocEnveloppe(l), blocTrajectoire(l)].forEach(function (b) { if (b) v.appendChild(b); });

    if (mien && l.type === "durci" && p) {
      var su = M.doreseSup(l);
      var gD = el("div", { classe: "durcir-reglage" });
      [["ao", "AO"], ["mco", "MCO"], ["rh", "RH"]].forEach(function (k) {
        gD.appendChild(el("span", { classe: "durcir-type" }, [el("b", { texte: k[1] + " " + su[k[0]] }),
          el("button", { type: "button", classe: "btn-mini btn-mini-non", texte: "−", onclick: function () { durcir(p, k[0], -1); } }),
          el("button", { type: "button", classe: "btn-mini", texte: "+", onclick: function () { durcir(p, k[0], 1); } })]));
      });
      v.appendChild(el("div", { classe: "champ" }, [el("span", { texte: "DORESE de sur-dotation (au-delà de 100 %)" }), gD]));
    }
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
    if (arbitre() && !decisionPosee) {
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
          el("span", { classe: "num" }, [md(chiffre(l).total), alertesDe(l.id).some(function (a) { return a.niveau === "alerte"; }) ? el("span", { classe: "badge badge-alerte", texte: "alerte" }) : null,
            CHAUDS[l.id] ? el("span", { classe: "badge badge-chaud", title: CHAUDS[l.id].join(" · "), texte: "à arbitrer" }) : null,
            M.avisDe(l, p).length ? el("span", { classe: "badge badge-neutre", texte: M.avisDe(l, p).length + " avis" }) : null])
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
    v.appendChild(blocContrats());
    var cv = M.couvertureScenarios(p);
    if (cv) v.appendChild(el("p", { classe: "aide" }, [el("b", { texte: "Scénarios de crise (COCA) : " }), cv.taux + " % de couverture · " + cv.satisfaisant + " satisfaisant(s), " + cv.partiel + " partiel(s), " + cv.insuffisant + " insuffisant(s)."]));
    var budgetNotes = M.ANNEES.map(function (a) {
      var x = [];
      if (M.inflationDe(p, a)) x.push("inflation −" + md(M.inflationDe(p, a)));
      if (M.carburantsDe(p, a)) x.push("carburants +" + md(M.carburantsDe(p, a)));
      if (M.conquisDe(p, a)) x.push("conquête +" + md(M.conquisDe(p, a)));
      return x.length ? a + " : " + x.join(", ") : null;
    }).filter(Boolean);
    if (budgetNotes.length) v.appendChild(el("p", { classe: "aide" }, [el("b", { texte: "Budget piloté par l'animateur : " }), budgetNotes.join(" · ") + "."]));
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
    v.appendChild(el("h3", { texte: "Souveraineté" }));
    var sou = M.syntheseSouverainete(PIONS, M.lignesApresArbitrage(lignesJeu(), p), p);
    var tot = { envisage: 0, national: 0, partage_ue: 0, partage_hors_ue: 0, allie_ue: 0, allie_hors_ue: 0, finance_ue: 0, total: 0 };
    M.ANNEES.forEach(function (a) { Object.keys(tot).forEach(function (k) { tot[k] += sou[a][k]; }); });
    var ind = tot.total ? Math.round(100 * tot.national / tot.total) : 100;
    v.appendChild(el("p", { classe: "total-demande" }, [el("b", { texte: ind + " %" }), " des demandes sur 2027-2032 restent sous décision nationale"]));
    v.appendChild(el("dl", { classe: "etat-pion" }, [
      el("dt", { texte: "Partagé avec l'UE" }), el("dd", { texte: md(tot.partage_ue) + " dont " + md(tot.allie_ue) + " payés par les alliés" }),
      el("dt", { texte: "Partagé hors UE" }), el("dd", { texte: md(tot.partage_hors_ue) + " dont " + md(tot.allie_hors_ue) + " payés par les alliés" }),
      el("dt", { texte: "Financé par l'UE" }), el("dd", { texte: md(tot.finance_ue) + " (subventions et prêts)" }),
      el("dt", { texte: "National" }), el("dd", { texte: md(tot.national) + (tot.envisage ? ", dont " + md(tot.envisage) + " qu'un montage envisagé partagerait" : "") })
    ]));
    var bandeS = el("div", { classe: "traj-bande souv-bande" }, M.ANNEES.map(function (a) { return el("span", { title: a + " : " + sou[a].indice + " % national", texte: sou[a].indice + " %" }); }));
    v.appendChild(el("div", { classe: "champ" }, [el("span", { texte: "Part nationale, année par année" }), el("div", { classe: "traj-bande traj-entete" }, M.ANNEES.map(function (a) { return el("span", { texte: String(a) }); })), bandeS]));
    v.appendChild(el("h3", { texte: "Avis et points chauds" }));
    var nAvis = etat.lignes.reduce(function (t, l) { return t + M.avisDe(l, p).length; }, 0);
    v.appendChild(el("dl", { classe: "etat-pion" }, [el("dt", { texte: "Points chauds" }), el("dd", { texte: String(Object.keys(CHAUDS).length) }), el("dt", { texte: "Avis donnés" }), el("dd", { texte: String(nAvis) })]));
    v.appendChild(el("h3", { texte: "Règles des fiches : tableau de bord" }));
    var vis = alertesVisibles(), fortes = vis.filter(function (a) { return a.niveau === "alerte"; });
    var force = fortes.filter(function (a) { var l = ligneDe(a.ligne); return l && M.arbitrageDe(l, p).statut === "retenu"; });
    var forceAvis = etat.lignes.filter(passageEnForce);
    v.appendChild(el("dl", { classe: "etat-pion" }, [
      el("dt", { texte: "Alertes actives" }), el("dd", { texte: String(fortes.length) }),
      el("dt", { texte: "Passées en force" }), el("dd", { texte: force.length + " malgré une alerte · " + forceAvis.length + " malgré un avis défavorable" }),
      el("dt", { texte: "À savoir" }), el("dd", { texte: String(vis.length - fortes.length) })
    ]));
    if (vis.length) v.appendChild(el("details", { classe: "details-regles" }, [el("summary", { texte: "Voir les alertes" }), listeAlertes(vis, true)]));
    v.appendChild(el("button", { classe: "btn-contour", type: "button", texte: "Télécharger les lignes (CSV)", onclick: telechargerCsv }));
  }
  // Contrats opérationnels 2027 (CEMA-02) : évaluation indicative en 2032 après arbitrage, notée par le CEMA.
  function blocContrats() {
    var p = params(), ks = M.evaluerContrats(PIONS, lignesJeu(), p);
    var peut = ROLES_CONTRATS.indexOf(etat.role) !== -1;
    var n = { tenu: 0, partiel: 0, non_tenu: 0 };
    ks.forEach(function (k) { n[k.etat]++; });
    var b = el("section", { classe: "bloc-conception bloc-contrats" });
    b.appendChild(el("h3", { texte: "Contrats opérationnels en 2032" }));
    b.appendChild(el("p", { classe: "total-demande" }, [el("b", { texte: n.tenu + " / " + ks.length }), " tenus · " + n.partiel + " partiel(s) · " + n.non_tenu + " non tenu(s)"]));
    var ul = el("ul", { classe: "contrats" });
    ks.forEach(function (k) {
      var droite;
      if (peut) {
        droite = el("select", { "aria-label": "Note " + k.nom });
        droite.appendChild(el("option", { value: "", texte: "Auto : " + M.ETATS_CONTRAT[k.auto] }));
        Object.keys(M.ETATS_CONTRAT).forEach(function (e) { droite.appendChild(el("option", { value: e, texte: M.ETATS_CONTRAT[e] })); });
        droite.value = k.note || "";
        droite.addEventListener("change", function () { var val = droite.value; modifierParams(function (pp) { pp.contrats = pp.contrats || {}; if (val) pp.contrats[k.id] = val; else delete pp.contrats[k.id]; }); });
      } else droite = el("span", { classe: "badge contrat-" + k.etat, texte: M.ETATS_CONTRAT[k.etat] });
      ul.appendChild(el("li", { classe: "contrat contrat-li-" + k.etat }, [el("span", null, [el("b", { texte: k.milieu + " · " + k.nom }), el("small", { texte: k.detail + (k.note ? " · noté par le CEMA (auto : " + M.ETATS_CONTRAT[k.auto].toLowerCase() + ")" : "") })]), droite]));
    });
    b.appendChild(ul);
    b.appendChild(el("p", { classe: "aide", texte: "Évaluation indicative à partir des pions qui portent chaque contrat (100 % = tenu, face rouge = partiel, retiré = non tenu)." + (peut ? " Le CEMA corrige la note si besoin." : "") }));
    return b;
  }

  // Onglet Red team (COCA-01 à COCA-03) : grille des scénarios de crise, rapport d'alerte, aléa Baltique.
  function voletRedTeam(v) {
    var p = params(), peut = ROLES_COCA.indexOf(etat.role) !== -1;
    v.appendChild(el("h2", { classe: "volet-titre", texte: "COCA / Red team" }));
    v.appendChild(el("p", { classe: "aide", texte: "Le COCA (ou la Red team) évalue chaque scénario de crise et peut poser sur une demande : urgence, tuile requalifiée, renoncement assumé, alarme à l'exécutif. Le CEMA lève ces statuts." }));
    var cv = M.couvertureScenarios(p);
    v.appendChild(el("h3", { texte: "Scénarios de crise" + (cv ? " · couverture " + cv.taux + " %" : "") }));
    var scs = (p.scenarios || []).map(function (x) { return Object.assign({}, x); });
    var ul = el("ul", { classe: "scenarios" });
    scs.forEach(function (x, i) {
      if (peut) {
        var nom = el("input", { value: x.nom || "", "aria-label": "Scénario", maxlength: 80 });
        var note = el("select", { "aria-label": "Évaluation" }); note.appendChild(el("option", { value: "", texte: "À évaluer" }));
        Object.keys(M.NOTES_SCENARIO).forEach(function (k) { note.appendChild(el("option", { value: k, texte: M.NOTES_SCENARIO[k] })); }); note.value = x.note || "";
        var ecart = el("input", { value: x.ecart || "", placeholder: "Écart capacitaire", "aria-label": "Écart capacitaire", maxlength: 200 });
        var reco = el("select", { "aria-label": "Recommandation" }); reco.appendChild(el("option", { value: "", texte: "Recommandation…" }));
        Object.keys(M.RECOMMANDATIONS).forEach(function (k) { reco.appendChild(el("option", { value: k, texte: M.RECOMMANDATIONS[k] })); }); reco.value = x.recommandation || "";
        function sauver() { modifierParams(function (pp) { pp.scenarios = pp.scenarios || []; var y = pp.scenarios.filter(function (z) { return z.id === x.id; })[0]; if (!y) return; y.nom = nom.value.trim(); y.note = note.value || null; y.ecart = ecart.value.trim(); y.recommandation = reco.value || null; }); }
        [nom, note, ecart, reco].forEach(function (c) { c.addEventListener("change", sauver); });
        ul.appendChild(el("li", { classe: "scenario scenario-" + (x.note || "vide") }, [el("div", { classe: "scenario-ligne" }, [nom, note]), el("div", { classe: "scenario-ligne" }, [ecart, reco]),
          el("button", { type: "button", classe: "btn-lien", texte: "Retirer", onclick: function () { modifierParams(function (pp) { pp.scenarios = (pp.scenarios || []).filter(function (z) { return z.id !== x.id; }); }); } })]));
      } else {
        ul.appendChild(el("li", { classe: "scenario scenario-" + (x.note || "vide") }, [el("b", { texte: x.nom || "Scénario" }),
          el("span", { classe: "badge", texte: x.note ? M.NOTES_SCENARIO[x.note] : "À évaluer" }),
          el("small", { texte: [x.ecart, x.recommandation ? M.RECOMMANDATIONS[x.recommandation] : ""].filter(Boolean).join(" · ") })]));
      }
    });
    if (!scs.length) ul.appendChild(el("li", { classe: "vide", texte: "Aucun scénario évalué pour l'instant." }));
    v.appendChild(ul);
    if (peut) v.appendChild(el("button", { type: "button", classe: "btn-contour", texte: "Ajouter un scénario", onclick: function () {
      modifierParams(function (pp) { pp.scenarios = pp.scenarios || []; pp.scenarios.push({ id: "sc-" + Date.now().toString(36), nom: pp.scenarios.length ? "Nouveau scénario" : "Haute intensité Baltique", note: null, ecart: "", recommandation: null }); });
    } }));
    if (p.aleaBaltique) {
      var bb = M.besoinBaltique(PIONS, lignesJeu(), p, FIN);
      v.appendChild(el("section", { classe: "bloc-conception bloc-alea" }, [el("h3", { texte: "Aléa Baltique (COCA-03)" }),
        el("p", { texte: "Les partenaires européens limitent leur participation : la France doit fournir jusqu'à 30 % de capacités en plus." }),
        el("p", { classe: "total-demande" }, [el("b", { texte: "+" + md(bb.supplement) }), " par an, soit 30 % des " + md(bb.base) + " que coûtent en 2032 les capacités des contrats opérationnels."]),
        el("p", { classe: "aide", texte: "Ordre de grandeur à confronter au modèle retenu : rien n'est ajouté d'office à la table." })]));
    }
    var marquees = etat.lignes.filter(function (l) { return M.cocaDe(l, p); });
    v.appendChild(el("h3", { texte: "Rapport d'alerte sur les demandes (" + marquees.length + ")" }));
    if (!marquees.length) v.appendChild(el("p", { classe: "vide", texte: peut ? "Ouvrez une demande sur la table pour y poser un statut COCA." : "Aucun statut COCA posé." }));
    else {
      var ul2 = el("ul", { classe: "liste-demande" });
      marquees.forEach(function (l) {
        var c = M.cocaDe(l, p);
        ul2.appendChild(el("li", null, [el("button", { type: "button", style: "--c:" + couleur(M.armeeDeLigne(l, IDX)), onclick: function () { etat.selection = { ligne: l.id, pion: l.pion || null }; etat.volet = "selection"; rendre(true); } }, [
          el("span", null, [el("b", { texte: libelleLigne(l) }), el("small", { texte: l.role + " · " + Object.keys(M.STATUTS_COCA).filter(function (k) { return c[k]; }).map(function (k) { return M.STATUTS_COCA[k]; }).join(", ") + (c.texte ? " · " + c.texte : "") })]),
          el("span", { classe: "num" }, [badgeDecision(l)])])]));
      });
      v.appendChild(ul2);
    }
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

  // Animateur : renommer un pion de la table ou changer son coût, pour cette partie seulement.
  function blocPionsPartie() {
    var mod = params().pionsModifies || {};
    var n = Object.keys(mod).length;
    var d = el("details", { classe: "pions-partie", id: "pions-partie" });
    if (etat.pionsOuverts) d.open = true;
    d.addEventListener("toggle", function () { etat.pionsOuverts = d.open; });
    d.appendChild(el("summary", { texte: "Pions de la table pour cette partie" + (n ? " (" + n + " modifié" + (n > 1 ? "s" : "") + ")" : "") }));
    d.appendChild(el("p", { classe: "aide", texte: "Changez le nom ou le coût d'un pion (en M€, sans ses DORESE, par pas de 100). Il change pour tous les joueurs de cette partie, toutes années, et sa forme sur la table suit le nombre de cases. Les autres parties ne sont pas touchées. Enregistré dès que vous quittez le champ." }));
    var filtre = el("input", { type: "search", placeholder: "Chercher un pion", "aria-label": "Chercher un pion" });
    d.appendChild(filtre);
    var liste = el("div", { classe: "pions-liste" });
    d.appendChild(liste);
    function sauver(id, champ, valeur) {
      modifierParams(function (pp) {
        pp.pionsModifies = pp.pionsModifies || {};
        var m = pp.pionsModifies[id] || {};
        if (valeur === null) delete m[champ]; else m[champ] = valeur;
        if (Object.keys(m).length) pp.pionsModifies[id] = m; else delete pp.pionsModifies[id];
      }).then(function () { toast("Pion enregistré pour cette partie"); });
    }
    PIONS_BASE.forEach(function (b) {
      var p = IDX[b.id] || b, m = mod[b.id] || {};
      var nom = el("input", { type: "text", value: p.nom, "aria-label": "Nom de " + b.nom, "data-pion-nom": b.id });
      var cout = el("input", { type: "number", min: 100, step: 100, value: p.cout50, "aria-label": "Coût de " + b.nom + " en M€", "data-pion-cout": b.id });
      nom.addEventListener("change", function () { var v = nom.value.trim(); sauver(b.id, "nom", v && v !== b.nom ? v : null); });
      cout.addEventListener("change", function () { var v = Math.max(100, Math.round((Number(cout.value) || 0) / 100) * 100); sauver(b.id, "cout", v !== b.cout50 ? v : null); });
      var info = (m.nom || m.cout !== undefined) ? "d'origine : " + b.nom + " · " + md(b.cout50) : (M.nbDorese(b) ? "+ " + M.nbDorese(b) + " DORESE" : "");
      var ligne = el("div", { classe: "pion-reglage" + (p.modifie ? " pion-modifie" : ""), "data-recherche": (b.nom + " " + p.nom + " " + b.armee).toLowerCase() }, [
        el("span", { classe: "pion-reglage-arm", texte: b.armee }), nom, cout,
        el("small", { texte: info }),
        p.modifie ? el("button", { type: "button", classe: "btn-lien", texte: "Rétablir", onclick: function () { modifierParams(function (pp) { if (pp.pionsModifies) delete pp.pionsModifies[b.id]; }); } }) : el("span")]);
      liste.appendChild(ligne);
    });
    filtre.addEventListener("input", function () {
      var q = filtre.value.trim().toLowerCase();
      Array.prototype.forEach.call(liste.children, function (x) { x.style.display = !q || x.getAttribute("data-recherche").indexOf(q) !== -1 ? "" : "none"; });
    });
    return d;
  }
  function voletReglages(v) {
    var p = params();
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Réglages de la partie" }));
    var f = el("form", { classe: "form-reglages" });
    // Budget de chaque année : plafond, inflation (MEFR-03), carburants (MEFR-02), conquêtes hors table.
    f.appendChild(el("h3", { texte: "Budget année par année" }));
    f.appendChild(el("p", { classe: "aide", texte: "Plafond en Md€. L'inflation est retirée du plafond ; les carburants sont posés sur la table ; une conquête cochée ajoute son budget au plafond de l'année." }));
    var conqs = M.conquetesDe(p);
    var tb = el("table", { classe: "mini-tableau budget-annees" });
    tb.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "" }), el("th", { classe: "num", texte: "Plafond Md€" }), el("th", { classe: "num", texte: "Inflation M€" }), el("th", { classe: "num", texte: "Carburants M€" })]
      .concat(conqs.map(function (c) { return el("th", { texte: c.nom + " (" + md(c.montant) + ")" }); })).concat([el("th", { classe: "num", texte: "Effectif" })]))]));
    var corpsB = el("tbody");
    var effectifs = {};
    M.ANNEES.forEach(function (a) {
      var pl = el("input", { id: "plafond-" + a, type: "number", min: 0, max: 200, step: 0.1, value: ((Number(p.plafonds[a]) || 0) / 10).toFixed(1), "aria-label": "Plafond " + a + " en Md€" });
      var inf = el("input", { id: "inflation-" + a, type: "number", min: 0, step: 50, value: M.inflationDe(p, a) || "", placeholder: "0", "aria-label": "Inflation " + a + " en M€" });
      var carb = el("input", { id: "carburants-" + a, type: "number", min: 0, step: 100, value: M.carburantsDe(p, a) || "", placeholder: "0", "aria-label": "Carburants " + a + " en M€" });
      var eff = el("td", { classe: "num" });
      effectifs[a] = eff;
      var cases = conqs.map(function (c) { var cb = el("input", { type: "checkbox", "data-conquete": c.id, "data-annee": a, "aria-label": c.nom + " " + a }); cb.checked = c.annees.indexOf(a) !== -1; return el("td", null, [cb]); });
      corpsB.appendChild(el("tr", null, [el("td", { texte: String(a) }), el("td", { classe: "num" }, [pl]), el("td", { classe: "num" }, [inf]), el("td", { classe: "num" }, [carb])].concat(cases).concat([eff])));
    });
    tb.appendChild(corpsB);
    function majEffectifs() {
      M.ANNEES.forEach(function (a) {
        var plaf = Math.round(10 * (Number($("plafond-" + a).value) || 0)) * M.CASE;
        var conq = conqs.reduce(function (t, c) { var cb = tb.querySelector('input[data-conquete="' + c.id + '"][data-annee="' + a + '"]'); return t + (cb && cb.checked ? c.montant : 0); }, 0);
        effectifs[a].textContent = md(plaf - (Number($("inflation-" + a).value) || 0) + conq);
      });
    }
    tb.addEventListener("input", majEffectifs);
    tb.addEventListener("change", majEffectifs);
    f.appendChild(tb);
    // Plateaux à conquérir de cette partie : enregistrés tout de suite (ils changent les colonnes du tableau).
    f.appendChild(el("h3", { texte: "Plateaux hors table à conquérir (cette partie)" }));
    var boiteC = el("div", { classe: "enveloppes-reglage" });
    conqs.forEach(function (c) {
      var nomC = el("input", { value: c.nom, "aria-label": "Nom du plateau", maxlength: 40 });
      var mtC = el("input", { type: "number", min: 0, step: 100, value: c.montant, "aria-label": "Budget du plateau en M€" });
      function sauverC() { modifierParams(function (pp) { (pp.conquetes || []).forEach(function (x) { if (x.id === c.id) { x.nom = nomC.value.trim() || x.nom; x.montant = Math.max(0, Number(mtC.value) || 0); } }); }); }
      nomC.addEventListener("change", sauverC); mtC.addEventListener("change", sauverC);
      boiteC.appendChild(el("div", { classe: "env-ligne" }, [nomC, mtC, el("button", { type: "button", classe: "btn-lien", texte: "Retirer", onclick: function () { modifierParams(function (pp) { pp.conquetes = (pp.conquetes || []).filter(function (x) { return x.id !== c.id; }); }); } })]));
    });
    if (!conqs.length) boiteC.appendChild(el("p", { classe: "vide", texte: "Aucun plateau à conquérir dans cette partie." }));
    boiteC.appendChild(el("button", { type: "button", classe: "btn-contour", texte: "Ajouter un plateau", onclick: function () {
      modifierParams(function (pp) { pp.conquetes = pp.conquetes || []; pp.conquetes.push({ id: "cq-" + Date.now().toString(36), nom: "Nouveau plateau", montant: 1000, annees: [] }); });
    } }));
    if (!conqs.length) boiteC.appendChild(el("button", { type: "button", classe: "btn-lien", texte: "Reprendre le relevé de la table 2032 (C'est la guerre 8,6 Md€, C'est pas la guerre 3,1 Md€)", onclick: function () {
      modifierParams(function (pp) { pp.conquetes = M.CONQUETES_RELEVE_2032.map(function (x) { return { id: x.id, nom: x.nom, montant: x.montant, annees: [] }; }); });
    } }));
    f.appendChild(boiteC);
    var presets = el("div", { classe: "presets" }, [el("small", { texte: "Inflation MEFR-03 dès" })]);
    var dPreset = el("select", { "aria-label": "Inflation à partir de" });
    M.ANNEES.forEach(function (a) { dPreset.appendChild(el("option", { value: a, texte: String(a) })); });
    presets.appendChild(dPreset);
    Object.keys(M.SCENARIOS_INFLATION).forEach(function (k) {
      var x = M.SCENARIOS_INFLATION[k];
      presets.appendChild(el("button", { type: "button", classe: "btn-mini", title: x.nom, texte: x.nom.split(" ")[0] + " −" + md(x.montant), onclick: function () {
        M.ANNEES.forEach(function (a) { $("inflation-" + a).value = a >= Number(dPreset.value) ? x.montant : ""; }); majEffectifs();
      } }));
    });
    presets.appendChild(el("button", { type: "button", classe: "btn-mini btn-mini-non", texte: "Aucune", onclick: function () { M.ANNEES.forEach(function (a) { $("inflation-" + a).value = ""; }); majEffectifs(); } }));
    f.appendChild(presets);
    setTimeout(majEffectifs, 0);
    f.appendChild(el("h3", { texte: "Pions de scénario posés" }));
    PIONS.filter(function (x) { return x.type === "orange"; }).forEach(function (o) {
      var an = ((p.aleas || {})[o.id] || []).map(Number);
      f.appendChild(el("div", { classe: "alea" }, [el("span", { texte: o.nom + " · " + md(o.cout50) }), el("div", { classe: "alea-annees" }, M.ANNEES.map(function (a) {
        var cb = el("input", { type: "checkbox", "data-pion": o.id, "data-annee": a });
        cb.checked = an.indexOf(a) !== -1;
        return el("label", null, [cb, " " + a]);
      }))]));
    });
    f.appendChild(el("h3", { texte: "Aléas tirés des fiches" }));
    var balt = el("input", { type: "checkbox", id: "reg-baltique" }); balt.checked = !!p.aleaBaltique;
    f.appendChild(el("label", { for: "reg-baltique", classe: "case-cocher" }, [balt, " Aléa Baltique (COCA-03) : les Européens limitent leur participation, +30 % de besoin"]));
    var delai = el("select", { id: "reg-delai-retrait", "aria-label": "Délai de retrait" });
    [[2, "2 ans"], [3, "3 ans"]].forEach(function (x) { delai.appendChild(el("option", { value: x[0], texte: x[1] })); });
    delai.value = String(M.delaiRetrait(p));
    f.appendChild(el("label", { classe: "champ" }, ["Retrait d'une capacité (SCP-05) : payée encore", delai]));

    if (etat.role === "Animateur") f.appendChild(blocPionsPartie());
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
      var inflA = {}, carbA = {};
      M.ANNEES.forEach(function (a) {
        plaf[a] = Math.max(0, Math.round(10 * (Number($("plafond-" + a).value) || 0)));
        var i = Math.max(0, Number($("inflation-" + a).value) || 0), c = Math.max(0, Number($("carburants-" + a).value) || 0);
        if (i) inflA[a] = i; if (c) carbA[a] = c;
      });
      var conquetes = conqs.map(function (c) { return { id: c.id, nom: c.nom, montant: c.montant, annees: M.ANNEES.filter(function (a) { var cb = tb.querySelector('input[data-conquete="' + c.id + '"][data-annee="' + a + '"]'); return cb && cb.checked; }) }; });
      f.querySelectorAll("input[type=checkbox][data-pion]").forEach(function (cb) {
        var id = cb.getAttribute("data-pion"); aleas[id] = aleas[id] || [];
        if (cb.checked) aleas[id].push(Number(cb.getAttribute("data-annee")));
      });
      var aleaB = balt.checked, delaiR = Number(delai.value);
      // L'inflation saisie année par année remplace un éventuel scénario global ; une grille vide n'en garde aucune.
      modifierParams(function (pp) { pp.plafonds = plaf; pp.aleas = aleas; pp.phase = phaseChoisie; pp.enveloppes = envOk; pp.inflationAnnees = Object.keys(inflA).length ? inflA : { aucune: 0 }; pp.inflation = null; pp.carburants = carbA; pp.conquetes = conquetes; pp.aleaBaltique = aleaB; pp.delaiRetrait = delaiR; }).then(function () { toast("Réglages enregistrés"); });
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

  // Avis : chacun qualifie un pion ; le CEMA voit tous les avis empilés.
  function naturesPourMoi() {
    return Object.keys(M.NATURES_AVIS).filter(function (k) { var n = M.NATURES_AVIS[k]; return !n.roles || n.roles.indexOf(etat.role) !== -1; });
  }
  // Passage en force : ligne retenue par le CEMA malgré un avis défavorable, un refus industriel ou un avis d'insoutenabilité.
  function passageEnForce(l) {
    var p = params();
    return M.arbitrageDe(l, p).statut === "retenu" && !M.arbitrageDe(l, p).contrainte && M.avisDe(l, p).some(function (x) { return /^(defavorable|refus|insoutenable)$/.test(x.valeur); });
  }
  function blocAvis(l) {
    var p = params(), av = M.avisDe(l, p);
    var b = el("section", { classe: "bloc-conception bloc-avis" });
    b.appendChild(el("h3", { texte: "Avis des acteurs" + (av.length ? " (" + av.length + ")" : "") }));
    if (CHAUDS[l.id]) b.appendChild(el("p", { classe: "chaud-raisons" }, [el("b", { texte: "À arbitrer : " }), CHAUDS[l.id].join(" · ")]));
    if (passageEnForce(l)) b.appendChild(el("p", { classe: "chaud-raisons force" }, [el("b", { texte: "Passage en force : " }), "retenue par le CEMA malgré un avis défavorable. Tracé et visible du MINARM."]));
    if (av.length) {
      var ul = el("ul", { classe: "avis-liste" });
      av.sort(function (a, c) { return (a.role < c.role ? -1 : 1); }).forEach(function (x) {
        var n = M.NATURES_AVIS[x.nature];
        ul.appendChild(el("li", { classe: "avis-" + x.valeur }, [el("span", { classe: "avis-tete" }, [el("b", { texte: x.role }), el("span", { texte: n.nom + " : " + n.valeurs[x.valeur] })]),
          x.texte ? el("span", { classe: "avis-texte", texte: x.texte }) : null]));
      });
      b.appendChild(ul);
    } else b.appendChild(el("p", { classe: "aide", texte: "Aucun avis pour l'instant." }));
    if (arbitre() && etat.role === "CEMA") return b;
    naturesPourMoi().forEach(function (k) {
      var n = M.NATURES_AVIS[k], cle = etat.role + ":" + k;
      var actuel = (((p.avis || {})[l.id]) || {})[cle] || {};
      var seg = el("div", { classe: "segment segment-avis", role: "group", "aria-label": n.nom });
      var texte = el("input", { placeholder: "Motif, en une phrase (facultatif)", value: actuel.texte || "", "aria-label": "Motif " + n.nom, maxlength: 200 });
      function enregistrerAvis(valeur) {
        modifierParams(function (pp) {
          pp.avis = pp.avis || {}; pp.avis[l.id] = pp.avis[l.id] || {};
          if (valeur) pp.avis[l.id][cle] = { role: etat.role, nature: k, valeur: valeur, texte: texte.value.trim(), le: new Date().toISOString() };
          else delete pp.avis[l.id][cle];
        }).then(function () { toast(valeur ? n.nom + " enregistré" : n.nom + " retiré"); });
      }
      Object.keys(n.valeurs).forEach(function (v) {
        seg.appendChild(el("button", { type: "button", "data-avis": v, "aria-pressed": actuel.valeur === v ? "true" : "false", texte: n.valeurs[v], onclick: function () { enregistrerAvis(actuel.valeur === v ? null : v); } }));
      });
      texte.addEventListener("change", function () { if (actuel.valeur) enregistrerAvis(actuel.valeur); });
      b.appendChild(el("div", { classe: "champ" }, [el("span", { texte: (k === "avis" ? "Mon avis" : n.nom) + " (" + etat.role + ")" }), seg, texte]));
    });
    return b;
  }

  // Rapport d'alerte COCA / Red team (COCA-01) : statuts posés par le COCA, levés par le CEMA.
  function blocCoca(l) {
    var p = params(), c = M.cocaDe(l, p) || {};
    var poses = Object.keys(M.STATUTS_COCA).filter(function (k) { return c[k]; });
    var peut = ROLES_COCA.indexOf(etat.role) !== -1, leve = etat.role === "CEMA";
    if (!poses.length && !peut) return null;
    var b = el("section", { classe: "bloc-conception bloc-coca" });
    b.appendChild(el("h3", { texte: "Rapport COCA / Red team" }));
    if (poses.length) b.appendChild(el("div", { classe: "badges" }, poses.map(function (k) { return el("span", { classe: "badge badge-coca", texte: M.STATUTS_COCA[k] }); })));
    if (c.texte) b.appendChild(el("blockquote", { classe: "citation", texte: c.texte + (c.par ? " (" + c.par + ")" : "") }));
    function ecrire(fn) { return modifierParams(function (pp) { pp.coca = pp.coca || {}; var x = Object.assign({}, pp.coca[l.id] || {}); fn(x); x.par = etat.role; var reste = Object.keys(M.STATUTS_COCA).some(function (k) { return x[k]; }) || x.texte; if (reste) pp.coca[l.id] = x; else delete pp.coca[l.id]; }); }
    if (peut) {
      var g = el("div", { classe: "segment segment-avis", role: "group", "aria-label": "Statuts COCA" });
      Object.keys(M.STATUTS_COCA).forEach(function (k) {
        g.appendChild(el("button", { type: "button", "aria-pressed": c[k] ? "true" : "false", texte: M.STATUTS_COCA[k], onclick: function () { ecrire(function (x) { x[k] = !x[k]; }); } }));
      });
      var t = el("input", { placeholder: "Motif du rapport, en une phrase", value: c.texte || "", "aria-label": "Motif COCA", maxlength: 240 });
      t.addEventListener("change", function () { ecrire(function (x) { x.texte = t.value.trim(); }); });
      b.appendChild(g); b.appendChild(t);
    } else if (leve && poses.length) {
      b.appendChild(el("button", { type: "button", classe: "btn-contour", texte: "Lever le rapport COCA", onclick: function () { modifierParams(function (pp) { if (pp.coca) delete pp.coca[l.id]; }); } }));
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
    var sv = M.souveraineteDe(l, p);
    b.appendChild(el("p", { classe: "souverainete souv-" + sv.niveau + (sv.zone ? " souv-" + sv.zone : "") }, [el("b", { texte: "Souveraineté · " }), sv.libelle + (sv.envisage ? " (montage envisagé, pas encore validé)" : "") + "."]));
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
      var zone = el("select", { "aria-label": "Zone des partenaires" });
      [["ue", "Partenaires de l'UE"], ["hors_ue", "Partenaires hors UE"], ["mixte", "UE et hors UE"]].forEach(function (z) { zone.appendChild(el("option", { value: z[0], texte: z[1] })); });
      zone.value = f.zone || M.zoneProbable(f.partenaires) || "ue";
      partn.addEventListener("input", function () { var z = M.zoneProbable(partn.value); if (z) zone.value = z; });
      var ligneZone = el("label", { classe: "champ" }, ["Zone", zone]);
      function maj() {
        var m = mode.value;
        lignePart.hidden = m === "national";
        lignePartn.hidden = m !== "mutualise";
        ligneZone.hidden = m !== "mutualise";
        lPart.textContent = m === "mutualise" ? "Part française, %" : m === "subvention" ? "Part subventionnée par l'UE, %" : "Part empruntée à l'UE, %";
      }
      mode.addEventListener("change", maj);
      maj();
      var formF = el("div", { classe: "form-financement" }, [el("label", { classe: "champ" }, ["Mode", mode]), lignePart, lignePartn, ligneZone,
        el("button", { type: "button", classe: "btn-contour", texte: mode.value === "national" && f.mode === "national" ? "Proposer ce montage" : "Proposer ce montage", onclick: function () {
          var m = mode.value;
          modifierParams(function (pp) {
            pp.financements = pp.financements || {};
            if (m === "national") delete pp.financements[l.id];
            else pp.financements[l.id] = { mode: m, part: Math.max(0, Math.min(100, Number(part.value) || 0)), partenaires: partn.value.trim(), zone: m === "mutualise" ? zone.value : "ue", propose_par: etat.role, valide: etat.role === "Animateur" };
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

  // ---------- Échanges (animateur) : exports, import d'une trajectoire de référence, comparaison ----------
  var REFERENCE = null;
  function cleReference() { return "strategikon.reference." + (etat.partie ? etat.partie.nom : ""); }
  function chargerReference() {
    if (REFERENCE && REFERENCE._partie === (etat.partie && etat.partie.nom)) return REFERENCE;
    REFERENCE = null;
    try { var t = localStorage.getItem(cleReference()); if (t) { REFERENCE = M.lireEchange(t); REFERENCE._partie = etat.partie.nom; } } catch (e) { REFERENCE = null; }
    return REFERENCE;
  }
  function telecharger(nom, contenu, type) {
    var a = el("a", { href: URL.createObjectURL(new Blob([contenu], { type: type })), download: nom });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function nomFichier(type, ext) {
    var d = new Date(), z = function (n) { return String(n).padStart(2, "0"); };
    return "strategikon-" + (etat.partie.nom || "partie").replace(/[^\w-]+/g, "-") + "-" + type + "-" + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + "-" + z(d.getHours()) + z(d.getMinutes()) + "." + ext;
  }
  function exporter(type) { return M.exporterPartie(PIONS, VUE_REF ? VUE_REF.lignes : etat.lignes, VUE_REF ? VUE_REF.params : params(), CATALOGUE, type, etat.partie.nom); }
  function boutonsExport(type) {
    return el("div", { classe: "export-boutons" }, [
      el("button", { type: "button", classe: "btn-laiton", texte: "JSON", title: "Fichier complet, à me transmettre", onclick: function () { telecharger(nomFichier(type, "json"), JSON.stringify(exporter(type), null, 1), "application/json"); toast("Export " + (type === "trajectoire" ? "de la trajectoire" : "du modèle 2032") + " téléchargé"); } }),
      el("button", { type: "button", classe: "btn-contour", texte: "CSV (tableur)", onclick: function () { telecharger(nomFichier(type, "csv"), "﻿" + M.echangeEnCsv(exporter(type)), "text/csv;charset=utf-8"); } })
    ]);
  }
  // Modèle 2032 préparé hors de l'outil pour CETTE partie (ex. relevé de table) : on l'écrit au modèle 2032.
  var MODELE_PARTIE = null;
  function memeNom(a, b) { return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase(); }
  function blocModelePartie() {
    var bloc = el("section", { classe: "bloc-conception", id: "bloc-modele-partie" }, [el("h3", { texte: "Charger un modèle 2032 préparé pour cette partie" }),
      el("p", { classe: "aide", texte: "Pour un fichier « modèle 2032 » préparé pour une partie précise (par exemple le relevé d'une table). Ses lignes sont posées au modèle 2032, retenues, et rien de ce que les joueurs ont déjà posé n'est retiré. Le fichier n'est accepté que dans la partie dont il porte le nom." })]);
    var fichier = el("input", { type: "file", accept: ".json,application/json", "aria-label": "Modèle 2032 de la partie (JSON)", id: "fichier-modele-partie" });
    var err = el("p", { classe: "erreur" });
    var apercu = el("div");
    bloc.appendChild(el("label", { classe: "champ" }, ["Fichier JSON", fichier]));
    bloc.appendChild(err); bloc.appendChild(apercu);
    fichier.addEventListener("change", function () {
      var f = fichier.files && fichier.files[0];
      err.textContent = ""; apercu.innerHTML = ""; MODELE_PARTIE = null;
      if (!f) return;
      f.text().then(function (t) {
        var m = M.lireModelePartie(t, PIONS);
        if (!memeNom(m.partie, etat.partie.nom)) throw new Error("Ce modèle est prévu pour la partie « " + m.partie + " », pas pour « " + etat.partie.nom + " ». Rien n'a été chargé.");
        MODELE_PARTIE = m;
        afficherApercu(apercu, m);
      }).catch(function (e) { err.textContent = e.message; });
    });
    return bloc;
  }
  function afficherApercu(boite, m) {
    var p = JSON.parse(JSON.stringify(params()));
    M.appliquerModeleParams(p, m);
    var ids = {}; m.lignes.forEach(function (l) { ids[l.id] = true; });
    var deja = etat.lignes.filter(function (l) { return ids[l.id]; }).length;
    var autres = etat.lignes.filter(function (l) { return !ids[l.id]; });
    var fin = M.ANNEES[M.ANNEES.length - 1];
    var avant = M.synthese(PIONS, M.lignesApresArbitrage(M.lignesEnTrajectoire(etat.lignes, params()), params()), params())[fin].total;
    var apres = M.synthese(PIONS, M.lignesApresArbitrage(M.lignesEnTrajectoire(autres.concat(m.lignes), p), p), p)[fin].total;
    var parRole = {};
    m.lignes.forEach(function (l) { parRole[l.role] = (parRole[l.role] || 0) + 1; });
    boite.appendChild(el("p", { classe: "aide", texte: m.lignes.length + " ligne(s) pour " + m.partie + " : " + Object.keys(parRole).map(function (r) { return r + " " + parRole[r]; }).join(", ") + "." }));
    boite.appendChild(el("p", { classe: "aide", texte: "Table " + fin + " : " + n1(avant) + " Md€ aujourd'hui, " + n1(apres) + " Md€ après chargement" + (m.total_attendu ? " (relevé de la table : " + n1(m.total_attendu) + " Md€)." : ".") }));
    if (deja) boite.appendChild(el("p", { classe: "aide", texte: "Ce modèle a déjà été chargé (" + deja + " ligne(s) présentes) : recharger remet ces lignes telles que dans le fichier." }));
    if (m.conquetes.length && !(params().conquetes || []).length) boite.appendChild(el("p", { classe: "aide", texte: "Plateaux hors table à conquérir : " + m.conquetes.map(function (c) { return c.nom + " (" + n1(c.montant) + " Md€)"; }).join(", ") + "." }));
    var btn = el("button", { type: "button", classe: "btn-laiton", id: "charger-modele-partie", texte: (deja ? "Recharger" : "Charger") + " dans " + etat.partie.nom });
    btn.addEventListener("click", function () { btn.disabled = true; chargerModelePartie(m, btn); });
    boite.appendChild(btn);
  }
  function chargerModelePartie(m, btn) {
    if (lectureSeule()) { btn.disabled = false; return Promise.resolve(); }
    var nom = etat.partie.nom, mdp = etat.mdp, k = 0;
    var suite = Promise.resolve();
    m.lignes.forEach(function (l) {
      suite = suite.then(function () { return S.ecrireLigne(nom, mdp, l); }).then(function () { k++; btn.textContent = "Chargement " + k + " / " + m.lignes.length; });
    });
    return suite.then(function () { return modifierParams(function (pp) { M.appliquerModeleParams(pp, m); }); })
      .then(function () { return recharger(true); })
      .then(function () { MODELE_PARTIE = null; toast(m.lignes.length + " lignes du modèle 2032 chargées dans " + nom); rendreVolet(); })
      .catch(function (e) { btn.disabled = false; btn.textContent = "Réessayer"; toast("Chargement interrompu (" + k + " / " + m.lignes.length + ") : " + e.message); });
  }
  function voletEchanges(v) {
    var p = VUE_REF ? VUE_REF.params : params();
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Échanges et comparaison" }));
    if (VUE_REF) v.appendChild(el("p", { classe: "aide", texte: "Vous regardez la référence sur la table. Les chiffres ci-dessous restent ceux des joueurs." }));
    var cibles = (VUE_REF ? VUE_REF.lignes : etat.lignes).filter(function (l) { return l.cible; });
    var attente = cibles.filter(function (l) { return M.arbitrageDe(l, p).statut === "attente"; }).length;
    v.appendChild(el("section", { classe: "bloc-conception" }, [el("h3", { texte: "1 · Modèle 2032 arbitré" }),
      el("p", { classe: "aide", texte: cibles.length + " ligne(s) au modèle 2032" + (attente ? ", dont " + attente + " encore en attente du CEMA." : ", toutes arbitrées.") + " Le fichier contient le socle, les pions, DORESE, priorités, contraintes politiques, financements et décisions du CEMA." }),
      boutonsExport("modele2032")]));
    var places = cibles.filter(function (l) { return M.debutDe(l, p) !== null; }).length;
    v.appendChild(el("section", { classe: "bloc-conception" }, [el("h3", { texte: "2 · Trajectoire des joueurs" }),
      el("p", { classe: "aide", texte: "Les années 2027 à 2032 telles que les joueurs les ont construites : " + places + " ligne(s) du modèle placée(s) sur la trajectoire, plus les autres demandes, année par année." }),
      boutonsExport("trajectoire")]));
    v.appendChild(blocModelePartie());
    var ref = chargerReference();
    var fichier = el("input", { type: "file", accept: ".json,application/json", "aria-label": "Trajectoire de référence (JSON)" });
    var err = el("p", { classe: "erreur" });
    fichier.addEventListener("change", function () {
      var f = fichier.files && fichier.files[0];
      if (!f) return;
      f.text().then(function (t) {
        var o = M.lireEchange(t);
        try { localStorage.setItem(cleReference(), t); } catch (e) { /* gardée pour la séance seulement */ }
        o._partie = etat.partie.nom; REFERENCE = o;
        toast("Trajectoire de référence importée"); rendre(true);
      }).catch(function (e) { err.textContent = e.message; });
    });
    var imp = el("section", { classe: "bloc-conception" }, [el("h3", { texte: "3 · Trajectoire de référence" }),
      el("p", { classe: "aide", texte: ref ? "Importée : " + (ref.partie || "sans nom") + ", exportée le " + new Date(ref.exporte_le).toLocaleString("fr-FR") + ". Elle reste dans ce navigateur, invisible des joueurs." : "Importez le fichier JSON de la trajectoire construite hors de l'outil. Elle reste dans ce navigateur, invisible des joueurs." }),
      el("label", { classe: "champ" }, [ref ? "Remplacer" : "Fichier JSON", fichier]), err]);
    if (ref) imp.appendChild(el("button", { type: "button", classe: "btn-laiton", id: "btn-voir-ref", texte: VUE_REF ? "Revenir à la table des joueurs" : "Voir la référence sur la table", onclick: function () { voirReference(!VUE_REF); } }));
    if (ref) imp.appendChild(el("button", { type: "button", classe: "btn-lien", texte: "Retirer la référence", onclick: function () { voirReference(false); try { localStorage.removeItem(cleReference()); } catch (e) { /* rien */ } REFERENCE = null; rendre(true); } }));
    v.appendChild(imp);
    if (!ref) return;
    var cmp = M.comparerTrajectoires(exporter("trajectoire"), ref);
    v.appendChild(el("section", { classe: "bloc-conception" }, [el("h3", { texte: "4 · Comparaison" }), resumeComparaison(cmp),
      el("button", { type: "button", classe: "btn-laiton", texte: "Afficher les deux trajectoires côte à côte", onclick: function () { ouvrirComparaison(cmp, ref); } })]));
  }
  function n1(m) { return (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function resumeComparaison(cmp) {
    var t = el("table", { classe: "mini-tableau" });
    t.appendChild(el("thead", null, [el("tr", null, ["Md€", "Joueurs", "Référence", "Écart"].map(function (x, i) { return el("th", { classe: i ? "num" : "", texte: x }); }))]));
    var tb = el("tbody");
    cmp.annees.forEach(function (a) {
      tb.appendChild(el("tr", null, [el("td", { texte: String(a.annee) }),
        el("td", { classe: "num " + (a.depassement_joueurs ? "neg" : ""), texte: n1(a.joueurs.total || 0) }),
        el("td", { classe: "num " + (a.depassement_reference ? "neg" : ""), texte: n1(a.reference.total || 0) }),
        el("td", { classe: "num", texte: (a.ecart_total > 0 ? "+" : "") + n1(a.ecart_total) })]));
    });
    t.appendChild(tb);
    var r = cmp.resume;
    return el("div", null, [t, el("ul", { classe: "cmp-resume" }, [
      el("li", { texte: r.plus_tot_joueurs + " ligne(s) entrent plus tôt chez les joueurs, " + r.plus_tard_joueurs + " plus tard." }),
      el("li", { texte: "Après 2032 : " + r.apres_2032_joueurs + " chez les joueurs, " + r.apres_2032_reference + " dans la référence." }),
      el("li", { texte: "Renoncements : " + r.renonces_joueurs + " chez les joueurs, " + r.renonces_reference + " dans la référence." }),
      el("li", { texte: "Alertes des fiches franchies : " + r.alertes_joueurs + " chez les joueurs, " + r.alertes_reference + " dans la référence." })
    ])]);
  }
  // Vue plein écran : les deux trajectoires 2027-2032 côte à côte, ligne par ligne.
  // Par acteur et par année : ce que chacun paie et ce qui entre, chez les joueurs et dans la référence.
  function coutLigneAn(l, a) { return l && l.decision.statut !== "renonce" && l.annees[a] ? l.annees[a].cout || 0 : 0; }
  function tableauActeurs(cmp, roleVu) {
    var roles = [];
    cmp.lignes.forEach(function (x) { if (roles.indexOf(x.role) === -1) roles.push(x.role); });
    roles.sort(function (a, b) { return M.ROLES.map(function (r) { return r.code; }).indexOf(a) - M.ROLES.map(function (r) { return r.code; }).indexOf(b); });
    var t = el("table", { classe: "mini-tableau tableau-acteurs" });
    t.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "Md€ · joueurs / référence" })].concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); })))]));
    var tb = el("tbody");
    roles.forEach(function (r) {
      var ls = cmp.lignes.filter(function (x) { return x.role === r; });
      tb.appendChild(el("tr", null, [el("td", { texte: r })].concat(M.ANNEES.map(function (a) {
        var j = 0, f = 0;
        ls.forEach(function (x) { j += coutLigneAn(x.joueurs, a); f += coutLigneAn(x.reference, a); });
        var d = j - f;
        return el("td", { classe: "num" + (d > 0 ? " neg" : d < 0 ? " pos" : ""), title: d ? (d > 0 ? "joueurs au-dessus de " : "joueurs en dessous de ") + n1(Math.abs(d)) + " Md€" : "identique", texte: n1(j) + " / " + n1(f) });
      }))));
    });
    t.appendChild(tb);
    // Entrées de chaque année : ce que les joueurs et la référence font entrer.
    var ent = el("table", { classe: "mini-tableau tableau-entrees" });
    ent.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "Entre en" }), el("th", { texte: "Joueurs" }), el("th", { texte: "Référence" })])]));
    var eb = el("tbody");
    M.ANNEES.concat([M.APRES_LPM]).forEach(function (a) {
      function liste(cote) {
        return cmp.lignes.filter(function (x) { return x[cote] && x["entree_" + (cote === "joueurs" ? "joueurs" : "reference")] === a && !x["renonce_" + (cote === "joueurs" ? "joueurs" : "reference")]; })
          .map(function (x) { return x.libelle + (roleVu ? "" : " (" + x.role + ")"); });
      }
      var j = liste("joueurs"), f = liste("reference");
      if (!j.length && !f.length) return;
      eb.appendChild(el("tr", null, [el("td", { texte: a === M.APRES_LPM ? "après 2032" : String(a) }), el("td", { texte: j.join(" · ") || "—" }), el("td", { texte: f.join(" · ") || "—" })]));
    });
    ent.appendChild(eb);
    return el("div", null, [el("div", { classe: "cmp-defile" }, [t]), el("h4", { texte: "Ce qui entre chaque année" }), el("div", { classe: "cmp-defile" }, [ent])]);
  }
  function ouvrirComparaison(cmp, ref, roleVu) {
    var ancien = $("comparaison"); if (ancien) ancien.remove();
    roleVu = roleVu || "";
    var tousRoles = {}; cmp.lignes.forEach(function (x) { tousRoles[x.role] = true; });
    var choixRole = el("select", { id: "cmp-role", "aria-label": "Acteur" }, [el("option", { value: "", texte: "Tous les acteurs" })].concat(M.ROLES.filter(function (r) { return tousRoles[r.code]; }).map(function (r) { return el("option", { value: r.code, texte: r.code }); })));
    choixRole.value = roleVu;
    choixRole.addEventListener("change", function () { ouvrirComparaison(cmp, ref, choixRole.value); });
    cmp = { annees: cmp.annees, resume: cmp.resume, lignes: cmp.lignes.filter(function (x) { return !roleVu || x.role === roleVu; }), _tout: cmp._tout || cmp };
    function bande(l) {
      return el("div", { classe: "traj-bande" }, M.ANNEES.map(function (a) {
        var c = l && l.decision.statut !== "renonce" && l.annees[a] ? l.annees[a].cout : 0;
        return el("span", { classe: c ? "traj-on" : "", texte: c ? n1(c) : "" });
      }));
    }
    function jauge(s) {
      var max = Math.max(s.plafond || 1, s.total || 0);
      return el("span", { classe: "mini-barre" }, [el("span", { style: "width:" + (100 * (s.total || 0) / max) + "%", classe: (s.marge || 0) < 0 ? "trop" : "" }), el("i", { style: "left:" + (100 * (s.plafond || 0) / max) + "%" })]);
    }
    var tete = el("div", { classe: "cmp-ligne cmp-tete" }, [el("span", { texte: "" }), el("b", { texte: "Joueurs" }), el("b", { texte: "Référence" })]);
    var annees = el("div", { classe: "cmp-annees" }, cmp.annees.map(function (a) {
      return el("div", { classe: "cmp-ligne" }, [el("b", { texte: String(a.annee) }),
        el("span", { classe: "cmp-cell" }, [jauge(a.joueurs), el("small", { classe: (a.joueurs.marge || 0) < 0 ? "neg" : "pos", texte: n1(a.joueurs.total || 0) + " Md€ · " + ((a.joueurs.marge || 0) < 0 ? "dépasse de " : "marge ") + n1(Math.abs(a.joueurs.marge || 0)) })]),
        el("span", { classe: "cmp-cell" }, [jauge(a.reference), el("small", { classe: (a.reference.marge || 0) < 0 ? "neg" : "pos", texte: n1(a.reference.total || 0) + " Md€ · " + ((a.reference.marge || 0) < 0 ? "dépasse de " : "marge ") + n1(Math.abs(a.reference.marge || 0)) })])]);
    }));
    var entete = el("div", { classe: "cmp-ligne cmp-tete" }, [el("span", { texte: "Ligne" }),
      el("div", { classe: "traj-bande traj-entete" }, M.ANNEES.map(function (a) { return el("span", { texte: String(a) }); })),
      el("div", { classe: "traj-bande traj-entete" }, M.ANNEES.map(function (a) { return el("span", { texte: String(a) }); }))]);
    var lignes = cmp.lignes.slice().sort(function (x, y) { return Math.abs(y.ecart_entree || 0) - Math.abs(x.ecart_entree || 0) || (x.role < y.role ? -1 : 1); });
    var corps = lignes.map(function (x) {
      var note = [];
      if (x.ecart_entree) note.push(x.ecart_entree < 0 ? "joueurs " + -x.ecart_entree + " an(s) plus tôt" : "joueurs " + x.ecart_entree + " an(s) plus tard");
      if (x.renonce_joueurs !== x.renonce_reference) note.push(x.renonce_joueurs ? "renoncée par les joueurs" : "renoncée dans la référence");
      else if (x.renonce_joueurs) note.push("renoncée des deux côtés");
      if (!x.joueurs || !x.reference) note.push(x.joueurs ? "absente de la référence" : "absente chez les joueurs");
      if (x.alertes_joueurs || x.alertes_reference) note.push("alertes " + x.alertes_joueurs + " / " + x.alertes_reference);
      return el("div", { classe: "cmp-ligne" + (note.length ? " cmp-diff" : "") }, [
        el("span", { classe: "cmp-nom" }, [el("b", { texte: x.libelle }), el("small", { texte: x.role + (note.length ? " · " + note.join(" · ") : "") })]),
        bande(x.joueurs), bande(x.reference)]);
    });
    var boite = el("section", { classe: "comparaison", id: "comparaison", role: "dialog", "aria-label": "Comparaison des trajectoires" }, [
      el("div", { classe: "comparaison-in" }, [
        el("div", { classe: "comparaison-tete" }, [el("h2", { classe: "volet-titre", texte: "Trajectoires 2027-2032 : joueurs et référence" }),
          el("button", { type: "button", classe: "btn-contour", texte: "Fermer", onclick: function () { boite.remove(); } })]),
        el("p", { classe: "aide", texte: "Montants payés par la France, en Md€, après arbitrage. Référence : " + (ref.partie || "fichier importé") + "." }),
        resumeComparaison(cmp), tete, annees,
        el("h3", { texte: "Choix annuels par acteur" }), el("label", { classe: "champ champ-ligne" }, ["Acteur", choixRole]), tableauActeurs(cmp, roleVu),
        el("h3", { texte: "Ligne par ligne" + (roleVu ? " · " + roleVu : "") }), entete].concat(corps))]);
    document.body.appendChild(boite);
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
    document.querySelectorAll(".bascule button[data-filtre]").forEach(function (b) { b.addEventListener("click", function () { etat.filtreTable = b.getAttribute("data-filtre"); rendre(false); }); });
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
