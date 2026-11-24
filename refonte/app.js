// STRATEGIKON, interface « salle d'état-major ».
// Même moteur (js/moteur.js), même stockage (js/stockage.js), mêmes données que la version en ligne.
(function () {
  "use strict";

  var M = window.STRAT_MOTEUR;
  var S = window.STRAT_STOCKAGE;
  var PIONS = window.STRAT_PIONS || [];
  var CATALOGUE = window.STRAT_CATALOGUE_ROLES || [];
  var IDX = M.indexPions(PIONS);
  var ROLES_REGLAGES = ["Animateur", "SC-Plans", "CEMA"];
  var ROLES_ARBITRAGE = ["CEMA", "Animateur"];
  var ROLES_VUE_COMPLETE = ["CEMA", "Animateur", "SC-Plans"];
  var MISSIONS = {
    EMAT: "Défend les capacités Terre", EMM: "Défend les capacités Marine", EMAAE: "Défend les capacités Air et Espace",
    COCA: "Porte les besoins opérationnels", "SC-Plans": "Tient la table budgétaire", CEMA: "Arbitre",
    DGRIS: "Porte les partenariats", DGA: "Porte les programmes", SGA: "Porte l'humain et l'infrastructure",
    MINARM: "Porte l'ambition politique", MEFR: "Tient les finances publiques", MEAE: "Porte la diplomatie",
    Animateur: "Règle la partie"
  };

  var etat = { partie: null, mdp: "", role: "", lignes: [], onglet: "composer", annee: M.ANNEES[0], vueTable: "demandes", filtre: "renforcer", recherche: "", ouverte: null };
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
  function nCases(m) { var n = Math.round(m / M.CASE); return n + (Math.abs(n) > 1 ? " cases" : " case"); }
  function couleur(a) { return { "Terre": "var(--terre)", "Marine": "var(--marine)", "Air et Espace": "var(--air)", "Interarmées": "var(--inter)" }[a] || "var(--inter)"; }
  function nouvelId() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "l-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function role(code) { return M.ROLES.filter(function (r) { return r.code === code; })[0] || M.ROLES[0]; }
  function vueComplete() { return ROLES_VUE_COMPLETE.indexOf(etat.role) !== -1; }
  function visible(l) { return vueComplete() || l.role === etat.role; }
  function params() { return (etat.partie && etat.partie.params && etat.partie.params.plafonds) ? etat.partie.params : M.parametresParDefaut(); }
  function optionDe(code) { return code ? CATALOGUE.filter(function (o) { return o.code === code; })[0] || null : null; }
  function fourchette(o) {
    var u = o.annuel ? "/an" : "";
    if (o.cout === null || o.cout === undefined) return o.statut_cout === "a_definir" ? "coût à définir" : "non chiffré";
    if (o.cout_max && o.cout_max !== o.cout) return o.cout + " à " + o.cout_max + " M€" + u;
    return o.cout + " M€" + u;
  }
  var minuteur;
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(minuteur); minuteur = setTimeout(function () { t.hidden = true; }, 2600); }
  function memoriser() {
    try {
      if (etat.partie) sessionStorage.setItem("strategikon.v2", JSON.stringify({ nom: etat.partie.nom, mdp: etat.mdp, role: etat.role, onglet: etat.onglet }));
      else sessionStorage.removeItem("strategikon.v2");
    } catch (e) { /* rien */ }
  }
  function libelleLigne(l) {
    if (l.type === "libre") return l.libelle || "Pion sur mesure";
    var p = IDX[l.pion];
    return p ? p.nom : l.pion;
  }
  var ACTIONS = {
    dorese: "Renforcer à 100 %",
    ajout: "Créer",
    retrait: "Dissoudre",
    libre: "Option"
  };
  function natureLigne(l) {
    if (l.type === "ajout") return "Créer à " + (Number(l.niveau) === 100 ? "100 %" : "50 %");
    if (l.type === "libre") return l.modele ? "Option de la fiche " + (optionDe(l.modele) || {}).role : "Pion sur mesure";
    return ACTIONS[l.type];
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

  function montrerRoles(partie, mdp) {
    etat.partie = partie; etat.mdp = mdp;
    $("etape-partie").hidden = true;
    $("etape-role").hidden = false;
    $("nom-partie-role").textContent = partie.nom;
    var g = $("grille-roles");
    vider(g);
    M.ROLES.forEach(function (r) {
      g.appendChild(el("button", { classe: "role-tuile", type: "button", style: "--couleur:" + couleur(r.armee), onclick: function () { entrer(r.code); } }, [
        el("span", { classe: "role-mission", texte: MISSIONS[r.code] || "" }),
        el("b", { texte: r.code }),
        el("small", { texte: r.nom })
      ]));
    });
  }

  function entrer(codeRole) {
    etat.role = codeRole;
    $("ecran-accueil").hidden = true;
    $("ecran-partie").hidden = false;
    $("poste-partie").textContent = etat.partie.nom;
    var r = role(codeRole);
    $("insigne-code").textContent = r.code;
    $("insigne-nom").textContent = r.nom;
    $("onglet-reglages").hidden = ROLES_REGLAGES.indexOf(codeRole) === -1;
    etat.filtre = r.armee === "Interarmées" && CATALOGUE.some(function (o) { return o.role === codeRole; }) ? "options" : "renforcer";
    memoriser();
    signature = "";
    return recharger(true);
  }

  function quitter() {
    etat.partie = null; etat.mdp = ""; etat.lignes = []; signature = "";
    memoriser();
    $("ecran-partie").hidden = true;
    $("ecran-accueil").hidden = false;
    $("etape-partie").hidden = false;
    $("etape-role").hidden = true;
    chargerParties();
  }

  // ---------- Données ----------
  function recharger(forcer) {
    if (!etat.partie) return Promise.resolve();
    var nom = etat.partie.nom;
    return S.lireEtat(nom, etat.mdp).then(function (e) {
      if (!etat.partie || etat.partie.nom !== nom) return;
      var lignes = e.lignes.slice().sort(function (a, b) { return (a.cree_le || "") < (b.cree_le || "") ? -1 : 1; });
      lignes = lignes.map(function (l) { return enAttente[l.id] ? (etat.lignes.filter(function (x) { return x.id === l.id; })[0] || l) : l; });
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
    }, 400);
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

  // ---------- Rendu ----------
  function rendre(complet) {
    var actif = document.activeElement;
    rendreJauges();
    if (etat.onglet === "composer") {
      rendreArsenal();
      if (complet || !$("fiches").contains(actif)) rendreFiches(); else rendreTotalDossier();
    }
    if (etat.onglet === "table") rendreTable();
    if (etat.onglet === "arbitrage") rendreArbitrage();
    if (etat.onglet === "bilan") rendreBilan();
    if (etat.onglet === "reglages" && (complet || !$("form-parametres").contains(actif))) rendreReglages();
  }

  function changerOnglet(nom) {
    etat.onglet = nom;
    document.querySelectorAll(".parcours button").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-onglet") === nom ? "true" : "false"); });
    ["composer", "table", "arbitrage", "bilan", "reglages"].forEach(function (v) { $("vue-" + v).hidden = v !== nom; });
    memoriser();
    rendre(true);
  }

  // Jauges : une par année, toujours visibles.
  function rendreJauges() {
    var j = $("jauges");
    vider(j);
    var syn = M.synthese(PIONS, etat.lignes, params());
    var max = Math.max.apply(null, M.ANNEES.map(function (a) { return Math.max(syn[a].total, syn[a].table); }));
    M.ANNEES.forEach(function (a) {
      var s = syn[a];
      var barre = el("div", { classe: "jauge-barre" });
      barre.appendChild(el("span", { style: "width:" + (100 * s.totalSocle / max) + "%;background:var(--gris)" }));
      M.ARMEES.forEach(function (arm) { var v = Math.max(0, s.demandes[arm]); if (v) barre.appendChild(el("span", { style: "width:" + (100 * v / max) + "%;background:" + couleur(arm) })); });
      barre.appendChild(el("span", { classe: "jauge-plafond", style: "left:" + (100 * s.plafond / max) + "%" }));
      j.appendChild(el("button", { classe: "jauge", type: "button", "aria-pressed": a === etat.annee ? "true" : "false", title: "Voir la table " + a,
        onclick: function () { etat.annee = a; changerOnglet("table"); } }, [
        el("div", { classe: "jauge-tete" }, [el("span", { classe: "jauge-an", texte: String(a) }), el("span", { classe: "jauge-val", texte: md(s.total) + " / " + md(s.plafond) })]),
        barre,
        el("span", { classe: "jauge-etat " + (s.marge >= 0 ? "pos" : "neg"), texte: s.marge >= 0 ? "Marge " + md(s.marge) : "Dépassement " + md(-s.marge) })
      ]));
    });
  }

  // ---------- 1. Composer : l'arsenal ----------
  var FILTRES = [
    ["renforcer", "Renforcer"],
    ["creer", "Créer une capacité"],
    ["options", "Options de ma fiche"],
    ["dissoudre", "Dissoudre"],
    ["mesure", "Sur mesure"]
  ];

  function armeeDuRole() { return role(etat.role).armee; }
  function pionDeMonPerimetre(p) {
    if (vueComplete()) return true;
    var a = armeeDuRole();
    return a === "Interarmées" ? true : p.armee === a;
  }

  function forme(p) {
    var f = el("span", { classe: "forme", style: "grid-template-columns:repeat(" + Math.min(p.l || 1, 6) + ",8px);--c:" + (p.type === "violet" ? "var(--violet)" : p.type === "gris" ? "var(--gris)" : couleur(p.armee)) });
    for (var i = 0; i < Math.min((p.l || 1) * (p.h || 1), 24); i++) f.appendChild(el("i"));
    return f;
  }
  function pips(n) { var s = el("span", { classe: "pips", title: n + " DORESE" }); for (var i = 0; i < n; i++) s.appendChild(el("i")); return s; }

  function rendreArsenal() {
    var f = $("filtres");
    vider(f);
    FILTRES.forEach(function (x) {
      f.appendChild(el("button", { classe: "filtre", type: "button", "aria-pressed": etat.filtre === x[0] ? "true" : "false", texte: x[1], onclick: function () { etat.filtre = x[0]; rendreArsenal(); } }));
    });
    var a = $("arsenal");
    vider(a);
    var q = etat.recherche.trim().toLowerCase();
    function correspond(txt) { return !q || txt.toLowerCase().indexOf(q) !== -1; }
    var cartes = [];

    if (etat.filtre === "renforcer") {
      PIONS.filter(function (p) { return p.type === "capacite" && M.nbDorese(p) > 0 && pionDeMonPerimetre(p) && correspond(p.nom); }).forEach(function (p) {
        var deja = etat.lignes.some(function (l) { return l.type === "dorese" && l.pion === p.id && l.role === etat.role; });
        cartes.push(carte(p, p.nom, [md(M.nbDorese(p) * M.CASE) + " par an", pips(M.nbDorese(p)), p.dorese.ao + " AO · " + p.dorese.mco + " MCO · " + p.dorese.rh + " RH"],
          deja ? "✓" : "+", function () { ajouter({ type: "dorese", pion: p.id, toutes: true }); }, "Passer " + p.nom + " de 50 % à 100 % en ajoutant ses DORESE"));
      });
    } else if (etat.filtre === "creer") {
      PIONS.filter(function (p) { return (p.type === "capacite" || p.type === "violet") && pionDeMonPerimetre(p) && correspond(p.nom); }).forEach(function (p) {
        var info = p.type === "capacite" && M.nbDorese(p)
          ? ["À 50 % : " + md(p.cout50), "À 100 % : " + md(p.cout100)]
          : [md(p.cout50) + " par an"];
        cartes.push(carte(p, p.nom.replace(/ \d$/, ""), info, "+", function () { ajouter({ type: "ajout", pion: p.id, niveau: p.type === "capacite" && M.nbDorese(p) ? 100 : 50 }); }, "Créer un nouvel exemplaire de " + p.nom));
      });
    } else if (etat.filtre === "dissoudre") {
      PIONS.filter(function (p) { return (p.type === "capacite" || p.type === "violet") && pionDeMonPerimetre(p) && correspond(p.nom); }).forEach(function (p) {
        cartes.push(carte(p, p.nom, ["Libère " + md(p.cout50) + " par an"], "−", function () { ajouter({ type: "retrait", pion: p.id }); }, "Dissoudre " + p.nom));
      });
    } else if (etat.filtre === "options") {
      var opts = CATALOGUE.filter(function (o) { return (vueComplete() || o.role === etat.role) && correspond(o.libelle + " " + (o.categorie || "")); });
      opts.forEach(function (o) {
        var p = { l: 2, h: 1, armee: o.armee, type: /Violet/.test(o.type_pion || "") ? "violet" : "capacite" };
        cartes.push(carte(p, o.libelle, [fourchette(o), vueComplete() ? "Fiche " + o.role : (o.categorie || "")], "+", function () { ajouter({ type: "libre", modele: o.code }); }, o.description || o.libelle));
      });
      if (!opts.length) a.appendChild(el("p", { classe: "vide-arsenal", texte: "Votre fiche ne propose pas d'option chiffrée. Utilisez « Sur mesure » pour créer un pion." }));
    } else if (etat.filtre === "mesure") {
      a.appendChild(el("div", { classe: "dossier-vide" }, [
        el("b", { texte: "Un besoin hors catalogue ?" }),
        el("p", { texte: "Créez votre propre pion : intitulé, prix, années, DORESE. Il restera « à valider » jusqu'à l'accord de l'animateur." }),
        el("button", { classe: "btn-laiton", type: "button", texte: "Créer un pion sur mesure", onclick: function () { ajouter({ type: "libre" }); } })
      ]));
    }
    cartes.forEach(function (c) { a.appendChild(c); });
    if (!cartes.length && etat.filtre !== "mesure" && etat.filtre !== "options") a.appendChild(el("p", { classe: "vide-arsenal", texte: "Aucun pion ne correspond." }));
  }

  function carte(p, nom, infos, signe, action, titre) {
    return el("button", { classe: "carte-pion", type: "button", title: titre, onclick: action }, [
      forme(p),
      el("span", null, [el("span", { classe: "carte-pion-nom", texte: nom }), el("span", { classe: "carte-pion-info" }, infos.map(function (i) { return typeof i === "string" ? el("span", { texte: i }) : i; }))]),
      el("span", { classe: "plus", "aria-hidden": "true", texte: signe })
    ]);
  }

  function ajouter(o) {
    var r = role(etat.role);
    var l = { id: nouvelId(), role: etat.role, type: o.type, qte: {}, justification: "", cree_le: new Date().toISOString() };
    if (o.type === "libre") {
      var opt = optionDe(o.modele);
      l.modele = opt ? opt.code : null;
      l.libelle = opt ? opt.libelle : "";
      l.armee = opt ? opt.armee : r.armee;
      l.source = opt ? opt.source : null;
      l.cout_unitaire = opt && opt.cout ? M.arrondiCase(opt.cout) : 0;
      l.dorese = opt && opt.dorese ? { ao: opt.dorese.ao || 0, mco: opt.dorese.mco || 0, rh: opt.dorese.rh || 0 } : { ao: 0, mco: 0, rh: 0 };
      M.ANNEES.forEach(function (a) { l.qte[a] = opt && opt.annuel ? 1 : 0; });
      if (!opt || !opt.annuel) l.qte[M.ANNEES[0]] = 1;
    } else {
      var p = IDX[o.pion];
      l.pion = p.id;
      l.niveau = o.niveau || 100;
      l.armee = r.armee !== "Interarmées" ? r.armee : p.armee;
      M.ANNEES.forEach(function (a) { l.qte[a] = 1; });
    }
    etat.lignes.push(l);
    etat.ouverte = l.id;
    enregistrer(l);
    rendreFiches();
    rendreJauges();
    var f = document.querySelector('[data-fiche="' + l.id + '"]');
    if (f) f.scrollIntoView({ behavior: "smooth", block: "nearest" });
    toast(natureLigne(l) === libelleLigne(l) ? "Fiche ajoutée : " + libelleLigne(l) : natureLigne(l) + " : " + libelleLigne(l));
  }

  // ---------- 1. Composer : les fiches ----------
  function rendreTotalDossier() {
    var mien = M.synthese(PIONS, etat.lignes, params(), function (l) { return l.role === etat.role; });
    var tot = 0, dor = 0;
    M.ANNEES.forEach(function (a) { tot += mien[a].totalDemandes; dor += mien[a].dorese.ao + mien[a].dorese.mco + mien[a].dorese.rh; });
    var t = $("dossier-total");
    vider(t);
    t.appendChild(el("div", null, [el("b", { texte: md(tot) }), el("small", { texte: "Ma demande sur 6 ans" })]));
    t.appendChild(el("div", null, [el("b", { texte: String(dor) }), el("small", { texte: "DORESE" })]));
  }

  function rendreFiches() {
    var r = role(etat.role);
    $("titre-dossier").textContent = "Demande " + r.code;
    rendreTotalDossier();
    var f = $("fiches");
    vider(f);
    var miennes = etat.lignes.filter(function (l) { return l.role === etat.role; });
    if (!miennes.length) {
      f.appendChild(el("div", { classe: "dossier-vide" }, [
        el("b", { texte: "Votre dossier est vide" }),
        el("p", { texte: "Choisissez dans l'arsenal : renforcez une capacité existante, créez-en une, retenez une option de votre fiche ou dissolvez ce qui ne sert plus." })
      ]));
      return;
    }
    miennes.slice().reverse().forEach(function (l) { f.appendChild(fiche(l)); });
  }

  function fiche(l) {
    var p = IDX[l.pion];
    var o = optionDe(l.modele);
    var armee = M.armeeDeLigne(l, IDX);
    var boite = el("article", { classe: "fiche", "data-fiche": l.id, style: "--c:" + couleur(armee) });
    var cout = el("div", { classe: "fiche-cout" });
    var calendrier = el("div", { classe: "calendrier" });
    var notePrix = el("div", { classe: "alerte-texte" });

    function majCout() {
      var c = M.coutLigne(l, IDX);
      var u = M.unitaire(l, IDX);
      vider(cout);
      cout.appendChild(el("b", { texte: md(c.total) }));
      cout.appendChild(el("small", { texte: (u.cout ? md(u.cout) + " par an posé" : "prix à fixer") + (c.totalDorese ? " · " + c.totalDorese + " DORESE" : "") }));
      rendreTotalDossier();
      rendreJauges();
    }
    function changer() { majCout(); enregistrer(l); }

    // En-tête
    var titre = el("div", { classe: "fiche-titre" }, [el("span", { classe: "fiche-type", texte: natureLigne(l) })]);
    if (l.type === "libre" && !o) {
      var lib = el("input", { value: l.libelle || "", placeholder: "Intitulé du pion", "aria-label": "Intitulé" });
      lib.addEventListener("input", function () { l.libelle = lib.value; enregistrer(l); });
      titre.appendChild(el("div", { classe: "fiche-nom" }, [lib]));
    } else {
      titre.appendChild(el("div", { classe: "fiche-nom", texte: libelleLigne(l) }));
    }
    var sous = [];
    if (p && l.type === "dorese") sous.push("Ajoute " + M.nbDorese(p) + " DORESE (" + p.dorese.ao + " AO, " + p.dorese.mco + " MCO, " + p.dorese.rh + " RH) à la capacité existante");
    if (p && l.type === "retrait") sous.push("Retire la capacité de la table les années cochées");
    if (p && l.type === "ajout") sous.push("Nouvel exemplaire, en plus du socle");
    if (o) sous.push("Fiche : " + fourchette(o) + (o.periodicite ? " · " + o.periodicite : ""));
    if (sous.length) titre.appendChild(el("div", { classe: "fiche-sous", texte: sous.join(" · ") }));
    if (l.type === "libre" && !o) {
      var val = (params().validations || {})[l.id];
      titre.appendChild(el("span", null, [el("span", { classe: "badge " + (val ? "badge-ok" : "badge-attente"), texte: val ? "Validé par l'animateur" : "À valider par l'animateur" })]));
    }
    var arb = M.arbitrageDe(l, params());
    if (arb.statut !== "attente") titre.appendChild(el("span", null, [el("span", { classe: "badge " + (arb.statut === "retenu" ? "badge-ok" : arb.statut === "renonce" ? "badge-alerte" : "badge-attente"), texte: "CEMA : " + M.STATUTS[arb.statut] + (arb.statut === "differe" ? " de " + arb.decalage + " an" + (arb.decalage > 1 ? "s" : "") : "") })]));

    var suppr = el("button", { classe: "suppr", type: "button", texte: "Retirer de ma demande" });
    suppr.addEventListener("click", function () {
      if (suppr.dataset.arme !== "1") { suppr.dataset.arme = "1"; suppr.textContent = "Confirmer le retrait"; setTimeout(function () { suppr.dataset.arme = ""; suppr.textContent = "Retirer de ma demande"; }, 3000); return; }
      clearTimeout(enAttente[l.id]); delete enAttente[l.id];
      etat.lignes = etat.lignes.filter(function (x) { return x.id !== l.id; });
      S.supprimerLigne(etat.partie.nom, etat.mdp, l.id).then(function () { toast("Fiche retirée"); }).catch(function (e) { toast(e.message); });
      rendreFiches(); rendreJauges(); rendreArsenal();
    });
    boite.appendChild(el("div", { classe: "fiche-tete" }, [titre, cout, suppr]));

    // Réglages
    var reg = el("div", { classe: "fiche-reglages" });
    if (l.type === "ajout" && p && p.type === "capacite" && M.nbDorese(p)) {
      var seg = el("div", { classe: "segment", role: "group", "aria-label": "Niveau" });
      [[50, "À 50 % · " + md(p.cout50)], [100, "À 100 % · " + md(p.cout100)]].forEach(function (x) {
        seg.appendChild(el("button", { type: "button", "aria-pressed": Number(l.niveau) === x[0] ? "true" : "false", texte: x[1], onclick: function () { l.niveau = x[0]; changer(); rendreFiches(); } }));
      });
      reg.appendChild(seg);
    }
    if (l.type === "libre") {
      var prix = el("input", { classe: "prix", type: "number", min: 0, step: 100, value: l.cout_unitaire || "", placeholder: "0", "aria-label": "Prix fixé en M€" });
      function majNote(brut) {
        var t = [];
        if (!l.cout_unitaire) t.push("Fixez le prix : la fiche ne compte pas tant qu'il est vide.");
        else if (brut !== undefined && Number(brut) !== l.cout_unitaire) t.push("Arrondi à la case : " + md(l.cout_unitaire) + ".");
        else if (brut === undefined && o && o.cout && o.cout % M.CASE) t.push("Prix de la fiche " + md(o.cout) + ", arrondi à " + md(l.cout_unitaire) + " : à confirmer.");
        if (o && o.cout && l.cout_unitaire && (l.cout_unitaire < M.arrondiCase(o.cout) || l.cout_unitaire > Math.max(M.arrondiCase(o.cout_max || o.cout), o.cout_max || o.cout))) t.push("Hors fourchette de la fiche (" + fourchette(o) + ").");
        notePrix.textContent = t.join(" ");
      }
      prix.addEventListener("input", function () { l.cout_unitaire = M.arrondiCase(prix.value); changer(); majNote(prix.value); });
      prix.addEventListener("change", function () { prix.value = l.cout_unitaire || ""; majNote(); });
      reg.appendChild(el("label", null, ["Prix fixé, M€ par an posé", prix]));
      var d = l.dorese || { ao: 0, mco: 0, rh: 0 };
      ["ao", "mco", "rh"].forEach(function (k) {
        var i = el("input", { classe: "dor", type: "number", min: 0, step: 1, value: d[k] || 0, "aria-label": "DORESE " + k.toUpperCase() });
        i.addEventListener("input", function () { l.dorese = l.dorese || {}; l.dorese[k] = Number(i.value) || 0; changer(); });
        reg.appendChild(el("label", null, ["DORESE " + k.toUpperCase(), i]));
      });
      majNote();
    }
    var arm = el("select", { "aria-label": "Armée qui porte le projet" });
    M.ARMEES.forEach(function (a) { arm.appendChild(el("option", { value: a, texte: a })); });
    arm.value = armee;
    arm.addEventListener("change", function () { l.armee = arm.value; boite.style.setProperty("--c", couleur(arm.value)); changer(); });
    reg.appendChild(el("label", null, ["Imputé à", arm]));
    boite.appendChild(reg);
    if (l.type === "libre") boite.appendChild(notePrix);

    // Calendrier
    var unique = l.type === "dorese" || l.type === "retrait";
    M.ANNEES.forEach(function (a) {
      var q = M.quantite(l, a);
      var c = el("div", { classe: "an-case" + (q ? " actif" : "") }, [el("small", { texte: String(a) })]);
      if (unique) {
        c.appendChild(el("button", { classe: "coche", type: "button", "aria-pressed": q ? "true" : "false", texte: q ? (l.type === "retrait" ? "Retiré" : "À 100 %") : "—",
          onclick: function () { l.qte[a] = q ? 0 : 1; changer(); remplacer(); } }));
      } else {
        var out = el("output", { texte: String(q) });
        c.appendChild(el("div", { classe: "pas" }, [
          el("button", { type: "button", "aria-label": "Moins en " + a, texte: "−", onclick: function () { l.qte[a] = Math.max(0, q - 1); changer(); remplacer(); } }),
          out,
          el("button", { type: "button", "aria-label": "Plus en " + a, texte: "+", onclick: function () { l.qte[a] = q + 1; changer(); remplacer(); } })
        ]));
      }
      calendrier.appendChild(c);
    });
    boite.appendChild(calendrier);
    function remplacer() { var n = fiche(l); boite.replaceWith(n); }

    // Justification et conditions
    var just = el("textarea", { placeholder: "Pourquoi ce besoin ? Votre argument pour l'arbitrage.", "aria-label": "Justification" });
    just.value = l.justification || "";
    just.addEventListener("input", function () { l.justification = just.value; enregistrer(l); });
    boite.appendChild(just);
    if (o && (o.conditions || o.alerte)) {
      boite.appendChild(el("details", null, [el("summary", { texte: "Ce que dit la fiche" }),
        o.alerte ? el("p", { classe: "alerte-texte", texte: o.alerte }) : null,
        o.conditions ? el("p", { texte: o.conditions }) : null,
        el("p", { texte: [o.source, o.edition].filter(Boolean).join(" · ") })]));
    }
    majCout();
    return boite;
  }

  // ---------- 2. La table ----------
  function rendreTable() {
    var ans = $("annees-table");
    vider(ans);
    M.ANNEES.forEach(function (a) { ans.appendChild(el("button", { type: "button", "aria-pressed": a === etat.annee ? "true" : "false", texte: String(a), onclick: function () { etat.annee = a; rendreTable(); rendreJauges(); } })); });
    document.querySelectorAll(".bascule button").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-vue") === etat.vueTable ? "true" : "false"); });
    var p = params();
    var lignes = etat.vueTable === "arbitrage" ? M.lignesApresArbitrage(etat.lignes, p) : etat.lignes;
    var t = M.placerAnnee(PIONS, lignes, p, etat.annee);
    var syn = M.synthese(PIONS, lignes, p)[etat.annee];

    var rel = $("table-releve");
    vider(rel);
    [["Année", String(etat.annee), ""], ["Cases posées", t.occupees + " / " + t.plafond, ""], ["Montant", md(syn.total), ""], [syn.marge >= 0 ? "Marge" : "Dépassement", md(Math.abs(syn.marge)), syn.marge >= 0 ? "pos" : "neg"]].forEach(function (x) {
      rel.appendChild(el("div", { classe: "releve" }, [el("small", { texte: x[0] }), el("b", { classe: x[2], texte: x[1] })]));
    });

    var pl = $("plateau");
    vider(pl);
    pl.style.gridTemplateRows = "repeat(" + t.hauteur + ", var(--case))";
    for (var k = 0; k < t.hauteur * t.largeur; k++) {
      pl.appendChild(el("div", { classe: "fond" + (k >= t.table ? " fond-horstable" : k >= t.plafond ? " fond-hors" : ""), style: "grid-row:" + (Math.floor(k / t.largeur) + 1) + ";grid-column:" + (k % t.largeur + 1) }));
    }
    function depasse(r, c, w, h) { for (var i = r; i < r + h; i++) for (var j = c; j < c + w; j++) if (i * t.largeur + j >= t.plafond) return true; return false; }
    function masque(x) { return x.role && !vueComplete() && x.role !== etat.role; }
    t.pieces.forEach(function (x) {
      var c = x.groupe === "Fixes" ? "var(--gris)" : x.nature === "violet" ? "var(--violet)" : couleur(x.armee);
      var cl = ["pion"];
      if (x.niveau === 50) cl.push("pion-50");
      if (depasse(x.r, x.c, x.w, x.h)) cl.push("pion-debord");
      if (x.w * x.h <= 2) cl.push("pion-petit");
      if (x.role && x.role === etat.role) cl.push("pion-mien");
      var nom = masque(x) ? "Demande " + x.armee : x.libelle;
      pl.appendChild(el("div", { classe: cl.join(" "), title: nom + " · " + x.cases + " case" + (x.cases > 1 ? "s" : "") + (x.niveau ? " · " + x.niveau + " %" : "") + (x.role && !masque(x) ? " · " + x.role : ""),
        style: "grid-row:" + (x.r + 1) + " / span " + x.h + ";grid-column:" + (x.c + 1) + " / span " + x.w + ";background:" + c }, [
        el("span", { texte: nom.replace(/^Capacité /, "").replace(/^Brigade /, "Bde ") })]));
    });
    t.cellules.forEach(function (x) {
      var cl = ["pion", "pion-case"];
      if (x.nature === "dorese") cl.push("pion-dorese");
      if (x.horsCatalogue) cl.push("pion-mesure");
      if (x.r * t.largeur + x.c >= t.plafond) cl.push("pion-debord");
      if (x.role && x.role === etat.role) cl.push("pion-mien");
      var nom = masque(x) ? (x.nature === "dorese" ? "DORESE" : "Demande " + x.armee) : x.libelle;
      pl.appendChild(el("div", { classe: cl.join(" "), title: nom, style: "grid-row:" + (x.r + 1) + ";grid-column:" + (x.c + 1) + ";background:" + couleur(x.armee) }, [
        el("span", { texte: x.nature === "dorese" ? { ao: "AO", mco: "M", rh: "RH" }[x.type] : "" })]));
    });

    var lg = $("legende");
    vider(lg);
    function puce(style, cl, txt) { return el("span", null, [el("span", { classe: "puce-legende " + (cl || ""), style: style }), txt]); }
    lg.appendChild(puce("background:var(--gris)", "", "Dépense fixe"));
    lg.appendChild(puce("background:var(--violet)", "", "Investissement"));
    M.ARMEES.forEach(function (a) { lg.appendChild(puce("background:" + couleur(a), "", a)); });
    lg.appendChild(puce("background:var(--terre)", "pion-50", "Capacité à 50 %"));
    lg.appendChild(puce("background:var(--terre)", "pion-dorese", "DORESE"));
    lg.appendChild(puce("background:var(--terre)", "pion-mien", "Ma demande"));
    lg.appendChild(puce("background:var(--hors)", "", "Au-delà du plafond"));
  }

  // ---------- 3. Arbitrage ----------
  function rendreArbitrage() {
    var p = params();
    var edit = ROLES_ARBITRAGE.indexOf(etat.role) !== -1;
    $("aide-arbitrage").textContent = edit
      ? "Pour chaque demande : retenir, différer d'une à trois années, ou renoncer. Un différé qui dépasse 2032 sort de la LPM."
      : "Le CEMA et l'animateur tranchent. Vous voyez ici les décisions sur vos demandes.";
    var dem = M.synthese(PIONS, etat.lignes, p);
    var arb = M.synthese(PIONS, M.lignesApresArbitrage(etat.lignes, p), p);
    var ra = $("arb-annees");
    vider(ra);
    M.ANNEES.forEach(function (a) {
      ra.appendChild(el("div", { classe: "arb-an" }, [
        el("span", { classe: "an", texte: String(a) }),
        el("span", { classe: "l" }, ["Demandé", el("b", { texte: md(dem[a].total) })]),
        el("span", { classe: "l" }, ["Retenu", el("b", { texte: md(arb[a].total) })]),
        el("span", { classe: "l" }, ["Plafond", el("b", { texte: md(arb[a].plafond) })]),
        el("span", { classe: "l " + (arb[a].marge >= 0 ? "pos" : "neg") }, [arb[a].marge >= 0 ? "Marge" : "Dépassement", el("b", { classe: arb[a].marge >= 0 ? "pos" : "neg", texte: md(Math.abs(arb[a].marge)) })])
      ]));
    });

    var zl = $("arb-lignes");
    vider(zl);
    var lignes = etat.lignes.filter(visible);
    if (!lignes.length) zl.appendChild(el("p", { classe: "vide", texte: "Aucune demande pour l'instant." }));
    lignes.forEach(function (l) {
      var a = M.arbitrageDe(l, p);
      var avant = M.coutLigne(l, IDX).total;
      var la = M.ligneArbitree(l, p);
      var apres = la ? M.coutLigne(la, IDX).total : 0;
      var report = M.reportHorsLpm(l, p, IDX);
      var choix = el("div", { classe: "choix" });
      Object.keys(M.STATUTS).forEach(function (k) {
        choix.appendChild(el("button", { type: "button", "data-statut": k, "aria-pressed": a.statut === k ? "true" : "false", disabled: edit ? null : "disabled", texte: M.STATUTS[k],
          onclick: function () { modifierParams(function (pp) { pp.arbitrages = pp.arbitrages || {}; pp.arbitrages[l.id] = { statut: k, decalage: k === "differe" ? (a.decalage || 1) : 0 }; }); } }));
      });
      if (a.statut === "differe") {
        var dec = el("select", { "aria-label": "Décalage", disabled: edit ? null : "disabled" });
        [1, 2, 3].forEach(function (n) { dec.appendChild(el("option", { value: n, texte: "de " + n + " an" + (n > 1 ? "s" : "") })); });
        dec.value = String(a.decalage || 1);
        dec.addEventListener("change", function () { modifierParams(function (pp) { pp.arbitrages = pp.arbitrages || {}; pp.arbitrages[l.id] = { statut: "differe", decalage: Number(dec.value) }; }); });
        choix.appendChild(dec);
      }
      if (l.type === "libre" && !l.modele && edit) {
        var cb = el("input", { type: "checkbox", id: "val-" + l.id });
        cb.checked = !!(p.validations || {})[l.id];
        cb.addEventListener("change", function () { modifierParams(function (pp) { pp.validations = pp.validations || {}; pp.validations[l.id] = cb.checked; }); });
        choix.appendChild(el("label", { for: cb.id, style: "font-size:.8rem;color:var(--sourdine);margin-left:.5rem" }, [cb, " pion sur mesure validé"]));
      }
      zl.appendChild(el("div", { classe: "decision", style: "--c:" + couleur(M.armeeDeLigne(l, IDX)) }, [
        el("div", { classe: "decision-tete" }, [
          el("span", { classe: "decision-nom" }, [libelleLigne(l), el("small", { texte: l.role + " · " + natureLigne(l) + " · " + M.armeeDeLigne(l, IDX) + (l.justification ? " · « " + l.justification + " »" : "") })]),
          el("span", { classe: "num" }, [md(avant), apres !== avant ? el("small", { classe: "fiche-sous", texte: " → " + md(apres) + (report ? " (+" + md(report) + " après 2032)" : "") }) : null])
        ]),
        choix
      ]));
    });

    var zr = $("arb-renoncements");
    vider(zr);
    var ren = etat.lignes.filter(function (l) { return visible(l) && M.arbitrageDe(l, p).statut === "renonce"; });
    if (!ren.length) zr.appendChild(el("p", { classe: "vide", texte: "Aucun renoncement." }));
    var tot = 0;
    ren.forEach(function (l) {
      var v = M.coutLigne(l, IDX).total; tot += v;
      zr.appendChild(el("div", { classe: "renonce" }, [el("div", { texte: libelleLigne(l) }), el("small", { classe: "fiche-sous", texte: l.role + " · " }), el("b", { texte: md(v) })]));
    });
    if (ren.length) zr.appendChild(el("p", { classe: "fiche-sous", texte: "Total renoncé sur la période : " + md(tot) }));
  }

  // ---------- Bilan ----------
  function rendreBilan() {
    var p = params();
    $("note-vue").textContent = vueComplete() ? "Vue complète de la partie." : "Vue limitée à vos postes de dépense ; les totaux par armée restent visibles.";
    var syn = M.synthese(PIONS, etat.lignes, p);
    var arb = M.synthese(PIONS, M.lignesApresArbitrage(etat.lignes, p), p);
    var tr = $("trajectoire");
    vider(tr);
    var max = Math.max.apply(null, M.ANNEES.map(function (a) { return Math.max(syn[a].total, syn[a].table); }));
    M.ANNEES.forEach(function (a) {
      var s = syn[a];
      var b = el("div", { classe: "traj-barre" });
      b.appendChild(el("span", { style: "width:" + (100 * s.totalSocle / max) + "%;background:var(--gris)" }));
      M.ARMEES.forEach(function (arm) { var v = Math.max(0, s.demandes[arm]); if (v) b.appendChild(el("span", { style: "width:" + (100 * v / max) + "%;background:" + couleur(arm), title: arm + " " + md(v) })); });
      b.appendChild(el("span", { classe: "traj-plafond", style: "left:" + (100 * s.plafond / max) + "%" }));
      tr.appendChild(el("div", { classe: "traj-ligne" }, [el("span", { classe: "traj-an", texte: String(a) }), b, el("span", { classe: "num " + (s.marge < 0 ? "neg" : ""), texte: md(s.total) })]));
    });
    var t = $("table-synthese");
    vider(t);
    t.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "M€" })].concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); })).concat([el("th", { classe: "num", texte: "Total" })]))]));
    var c = el("tbody");
    function rangee(lib, f, cl) {
      var tot = 0;
      var cells = M.ANNEES.map(function (a) { var v = f(a); tot += v; return el("td", { classe: "num " + (cl ? cl(v) : ""), texte: md(v) }); });
      c.appendChild(el("tr", null, [el("td", null, lib)].concat(cells).concat([el("td", { classe: "num", texte: md(tot) })])));
    }
    rangee([el("span", { classe: "pastille", style: "background:var(--gris)" }), "Socle"], function (a) { return syn[a].totalSocle; });
    M.ARMEES.forEach(function (arm) { rangee([el("span", { classe: "pastille", style: "background:" + couleur(arm) }), "Demandes " + arm], function (a) { return syn[a].demandes[arm]; }); });
    rangee(["Total demandé"], function (a) { return syn[a].total; });
    rangee(["Total après arbitrage"], function (a) { return arb[a].total; });
    rangee(["Plafond"], function (a) { return syn[a].plafond; });
    rangee(["Marge après arbitrage"], function (a) { return arb[a].marge; }, function (v) { return v < 0 ? "neg" : "pos"; });
    t.appendChild(c);

    var t3 = $("table-toutes");
    vider(t3);
    t3.appendChild(el("thead", null, [el("tr", null, ["Pôle", "Action", "Objet", "Armée"].map(function (h) { return el("th", { texte: h }); }).concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); })).concat([el("th", { classe: "num", texte: "Total" }), el("th", { texte: "Décision" })]))]));
    var c3 = el("tbody");
    etat.lignes.filter(visible).forEach(function (l) {
      var cl = M.coutLigne(l, IDX);
      c3.appendChild(el("tr", null, [el("td", { texte: l.role }), el("td", { texte: natureLigne(l) }), el("td", { texte: libelleLigne(l) }), el("td", { texte: M.armeeDeLigne(l, IDX) })]
        .concat(M.ANNEES.map(function (a) { return el("td", { classe: "num", texte: cl.annees[a].cout ? md(cl.annees[a].cout) : "·" }); }))
        .concat([el("td", { classe: "num", texte: md(cl.total) }), el("td", { texte: M.STATUTS[M.arbitrageDe(l, p).statut] })])));
    });
    t3.appendChild(c3);
  }

  function csv() {
    var p = params();
    var ent = ["Pôle", "Action", "Objet", "Armée"].concat(M.ANNEES.map(String)).concat(["Total (M€)", "Décision", "Justification"]);
    var out = [ent.join(";")];
    etat.lignes.filter(visible).forEach(function (l) {
      var c = M.coutLigne(l, IDX);
      var v = [l.role, natureLigne(l), libelleLigne(l), M.armeeDeLigne(l, IDX)].concat(M.ANNEES.map(function (a) { return c.annees[a].cout; }))
        .concat([c.total, M.STATUTS[M.arbitrageDe(l, p).statut], (l.justification || "").replace(/\s+/g, " ")]);
      out.push(v.map(function (x) { var s = String(x); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";"));
    });
    return out.join("\n");
  }

  // ---------- Réglages ----------
  function rendreReglages() {
    var p = params();
    var edit = ROLES_REGLAGES.indexOf(etat.role) !== -1;
    $("aide-parametres").textContent = edit ? "Plafonds et pions de scénario valent pour toute la partie." : "Lecture seule.";
    var pf = $("plafonds");
    vider(pf);
    M.ANNEES.forEach(function (a) {
      var i = el("input", { id: "plafond-" + a, type: "number", min: 0, max: 2000, step: 1, value: p.plafonds[a], disabled: edit ? null : "disabled" });
      var s = el("small", { texte: md((Number(p.plafonds[a]) || 0) * M.CASE) });
      i.addEventListener("input", function () { s.textContent = md((Number(i.value) || 0) * M.CASE); });
      pf.appendChild(el("label", { for: i.id }, [String(a), i, s]));
    });
    var al = $("aleas");
    vider(al);
    PIONS.filter(function (x) { return x.type === "orange"; }).forEach(function (o) {
      var an = ((p.aleas || {})[o.id] || []).map(Number);
      al.appendChild(el("div", { classe: "alea" }, [el("span", { texte: o.nom + " (" + o.cout50 / M.CASE + " cases par an)" }), el("div", { classe: "alea-annees" }, M.ANNEES.map(function (a) {
        var cb = el("input", { type: "checkbox", id: "alea-" + o.id + "-" + a, "data-pion": o.id, "data-annee": a, disabled: edit ? null : "disabled" });
        cb.checked = an.indexOf(a) !== -1;
        return el("label", { for: cb.id }, [cb, " " + a]);
      }))]));
    });
    $("btn-parametres").hidden = !edit;
  }

  function enregistrerReglages(ev) {
    ev.preventDefault();
    var plaf = {}, aleas = {};
    M.ANNEES.forEach(function (a) { plaf[a] = Math.max(0, Number($("plafond-" + a).value) || 0); });
    document.querySelectorAll("#aleas input[type=checkbox]").forEach(function (cb) {
      var id = cb.getAttribute("data-pion"); aleas[id] = aleas[id] || [];
      if (cb.checked) aleas[id].push(Number(cb.getAttribute("data-annee")));
    });
    modifierParams(function (pp) { pp.plafonds = plaf; pp.aleas = aleas; }).then(function () { $("param-etat").textContent = "Réglages enregistrés."; toast("Réglages enregistrés"); });
  }

  // ---------- Démarrage ----------
  function demarrer() {
    $("mode").textContent = S.mode === "partage" ? "Base partagée" : "Mode local";
    $("note-mode").textContent = S.mode === "partage"
      ? "Les parties sont conservées d'une séance à l'autre ; chaque pôle voit les autres avancer en quelques secondes."
      : "Mode local : les parties restent dans ce navigateur.";
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
      S.creerPartie(nom, mdp, M.parametresParDefaut()).then(function (p) { toast("Partie « " + p.nom + " » ouverte"); montrerRoles(p, mdp); })
        .catch(function (e) { $("cre-erreur").textContent = e.message; });
    });
    $("btn-retour-partie").addEventListener("click", quitter);
    $("btn-quitter").addEventListener("click", quitter);
    $("btn-role").addEventListener("click", function () {
      $("ecran-partie").hidden = true; $("ecran-accueil").hidden = false; montrerRoles(etat.partie, etat.mdp);
    });
    document.querySelectorAll(".parcours button").forEach(function (b) { b.addEventListener("click", function () { changerOnglet(b.getAttribute("data-onglet")); }); });
    document.querySelectorAll(".bascule button").forEach(function (b) { b.addEventListener("click", function () { etat.vueTable = b.getAttribute("data-vue"); rendreTable(); }); });
    $("recherche").addEventListener("input", function () { etat.recherche = $("recherche").value; rendreArsenal(); });
    $("form-parametres").addEventListener("submit", enregistrerReglages);
    $("btn-copier-csv").addEventListener("click", function () {
      try { navigator.clipboard.writeText(csv()).then(function () { toast("CSV copié : collez-le dans Excel"); }, function () { toast("Copie refusée par le navigateur"); }); }
      catch (e) { toast("Copie refusée par le navigateur"); }
    });
    $("btn-telecharger-csv").addEventListener("click", function () {
      var a = el("a", { href: URL.createObjectURL(new Blob(["﻿" + csv()], { type: "text/csv;charset=utf-8" })), download: "strategikon-" + (etat.partie ? etat.partie.nom : "partie") + ".csv" });
      document.body.appendChild(a); a.click(); a.remove();
    });
    setInterval(function () { if (etat.partie && etat.role && !Object.keys(enAttente).length) recharger(false); }, S.mode === "partage" ? 6000 : 5000);

    chargerParties().then(function () {
      var mem = null;
      try { mem = JSON.parse(sessionStorage.getItem("strategikon.v2")); } catch (e) { mem = null; }
      if (mem && mem.nom && mem.role) {
        S.ouvrirPartie(mem.nom, mem.mdp).then(function (p) {
          etat.partie = p; etat.mdp = mem.mdp;
          return entrer(mem.role).then(function () { if (mem.onglet) changerOnglet(mem.onglet); });
        }).catch(function () { etat.partie = null; memoriser(); });
      }
    });
  }

  demarrer();
})();
