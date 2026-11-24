// Interface STRATEGIKON : accueil (parties), saisie par rôle, synthèse, table, paramètres.
(function () {
  "use strict";

  var M = window.STRAT_MOTEUR;
  var S = window.STRAT_STOCKAGE;
  var PIONS = window.STRAT_PIONS || [];
  var OPTIONS = window.STRAT_OPTIONS || [];
  var IDX = M.indexPions(PIONS);
  var ROLES_EDITION_PARAMS = ["Animateur", "SC-Plans", "CEMA"];

  var etat = {
    partie: null, // { id, nom, params }
    mdp: "",
    role: "",
    lignes: [],
    onglet: "demande",
    anneeTable: M.ANNEES[0]
  };
  var enAttente = {}; // id de ligne -> minuteur d'enregistrement
  var signatureLignes = "";

  // ---------- Outils ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "texte") n.textContent = attrs[k];
      else if (k === "classe") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (e) { if (e !== null && e !== undefined) n.appendChild(typeof e === "string" ? document.createTextNode(e) : e); });
    return n;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function md(m) { // M€ -> « 5,9 Md€ » ou « 300 M€ »
    var signe = m < 0 ? "−" : "";
    m = Math.abs(m);
    if (m >= 1000) return signe + (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " Md€";
    return signe + m.toLocaleString("fr-FR") + " M€";
  }
  function cases(m) { return (m / M.CASE).toLocaleString("fr-FR", { maximumFractionDigits: 1 }); }
  function classeArmee(a) { return { "Terre": "a-Terre", "Marine": "a-Marine", "Air et Espace": "a-Air", "Interarmées": "a-Inter" }[a] || "a-Inter"; }
  function couleurArmee(a) { return { "Terre": "var(--terre)", "Marine": "var(--marine)", "Air et Espace": "var(--air)", "Interarmées": "var(--inter)" }[a] || "var(--inter)"; }
  function nouvelId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "l-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function role(code) { return M.ROLES.filter(function (r) { return r.code === code; })[0] || M.ROLES[0]; }
  var minuteurToast;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(minuteurToast); minuteurToast = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function memoriser() {
    try {
      if (etat.partie) sessionStorage.setItem("strategikon.session", JSON.stringify({ nom: etat.partie.nom, mdp: etat.mdp, role: etat.role, onglet: etat.onglet }));
      else sessionStorage.removeItem("strategikon.session");
    } catch (e) { /* session non mémorisée */ }
  }
  function peutEditerParams() { return ROLES_EDITION_PARAMS.indexOf(etat.role) !== -1; }
  function params() { return etat.partie.params || M.parametresParDefaut(); }

  // ---------- Accueil ----------
  function remplirRoles(select, valeur) {
    vider(select);
    M.ROLES.forEach(function (r) {
      select.appendChild(el("option", { value: r.code, texte: r.code + " · " + r.nom }));
    });
    if (valeur) select.value = valeur;
  }

  function chargerParties() {
    var sel = $("rej-partie");
    vider(sel);
    return S.listerParties().then(function (liste) {
      if (!liste.length) sel.appendChild(el("option", { value: "", texte: "Aucune partie pour l'instant" }));
      liste.forEach(function (p) { sel.appendChild(el("option", { value: p.nom, texte: p.nom })); });
    }).catch(function (e) {
      sel.appendChild(el("option", { value: "", texte: "Liste indisponible" }));
      $("rej-erreur").textContent = e.message;
    });
  }

  function entrer(partie, mdp, codeRole) {
    etat.partie = partie;
    if (!etat.partie.params || !etat.partie.params.plafonds) etat.partie.params = M.parametresParDefaut();
    etat.mdp = mdp;
    etat.role = codeRole;
    $("ecran-accueil").hidden = true;
    $("ecran-partie").hidden = false;
    $("session").hidden = false;
    $("session-partie").textContent = partie.nom;
    remplirRoles($("session-role"), codeRole);
    memoriser();
    return rechargerLignes(true);
  }

  function quitter() {
    etat.partie = null; etat.mdp = ""; etat.lignes = []; signatureLignes = "";
    memoriser();
    $("ecran-partie").hidden = true;
    $("session").hidden = true;
    $("ecran-accueil").hidden = false;
    chargerParties();
  }

  // ---------- Données ----------
  function rechargerLignes(forcer) {
    if (!etat.partie) return Promise.resolve();
    var nom = etat.partie.nom;
    return S.lireEtat(nom, etat.mdp).then(function (e) {
      if (!etat.partie || etat.partie.nom !== nom) return;
      var r = [e.lignes, e.partie];
      var lignes = r[0].slice().sort(function (a, b) { return (a.cree_le || "") < (b.cree_le || "") ? -1 : 1; });
      // On garde la version locale des lignes en cours d'enregistrement.
      lignes = lignes.map(function (l) {
        if (enAttente[l.id]) return etat.lignes.filter(function (x) { return x.id === l.id; })[0] || l;
        return l;
      });
      etat.lignes.forEach(function (l) {
        if (enAttente[l.id] && !lignes.some(function (x) { return x.id === l.id; })) lignes.push(l);
      });
      var sig = JSON.stringify(lignes) + JSON.stringify(r[1].params);
      etat.partie.params = r[1].params && r[1].params.plafonds ? r[1].params : M.parametresParDefaut();
      etat.lignes = lignes;
      if (forcer || sig !== signatureLignes) {
        signatureLignes = sig;
        rendre(forcer);
      }
    }).catch(function (e) { toast(e.message); });
  }

  function enregistrer(ligne) {
    clearTimeout(enAttente[ligne.id]);
    enAttente[ligne.id] = setTimeout(function () {
      S.ecrireLigne(etat.partie.nom, etat.mdp, ligne).then(function () {
        delete enAttente[ligne.id];
      }).catch(function (e) { delete enAttente[ligne.id]; toast("Non enregistré : " + e.message); });
    }, 400);
  }

  // ---------- Rendu général ----------
  function rendre(complet) {
    var actif = document.activeElement;
    var saisieEnCours = actif && $("table-demande").contains(actif);
    if (complet || !saisieEnCours) rendreDemande();
    else rendreBilan();
    if (etat.onglet === "synthese") rendreSynthese();
    if (etat.onglet === "table") rendreTable();
    if (etat.onglet === "parametres" && (complet || !$("form-parametres").contains(actif))) rendreParametres();
  }

  function changerOnglet(nom) {
    etat.onglet = nom;
    document.querySelectorAll(".onglets button").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-onglet") === nom ? "true" : "false");
    });
    ["demande", "synthese", "table", "parametres"].forEach(function (v) { $("vue-" + v).hidden = v !== nom; });
    memoriser();
    rendre(true);
  }

  // ---------- Ma demande ----------
  function pionsPour(type) {
    return PIONS.filter(function (p) {
      if (type === "dorese") return p.type === "capacite" && M.nbDorese(p) > 0;
      if (type === "ajout") return p.type === "capacite" || p.type === "violet";
      if (type === "retrait") return p.type !== "gris";
      return false;
    });
  }

  function selectPion(ligne) {
    var s = el("select", { "aria-label": "Pion" });
    var groupes = {};
    pionsPour(ligne.type).forEach(function (p) {
      if (!groupes[p.armee]) { groupes[p.armee] = el("optgroup", { label: p.armee }); s.appendChild(groupes[p.armee]); }
      var txt = p.nom + " · " + p.cout50 / M.CASE + " c." + (M.nbDorese(p) ? " +" + M.nbDorese(p) + " DORESE" : "");
      groupes[p.armee].appendChild(el("option", { value: p.id, texte: txt }));
    });
    s.value = ligne.pion;
    return s;
  }

  function nouvelleLigne(type) {
    var r = role(etat.role);
    var l = { id: nouvelId(), role: etat.role, type: type, qte: {}, justification: "", cree_le: new Date().toISOString() };
    if (type === "libre") {
      l.libelle = ""; l.cout_unitaire = 100; l.dorese = { ao: 0, mco: 0, rh: 0 }; l.armee = r.armee;
    } else {
      var candidats = pionsPour(type);
      var duRole = candidats.filter(function (p) { return p.armee === r.armee; });
      var p = (duRole[0] || candidats[0]);
      l.pion = p.id;
      l.niveau = 100;
      l.armee = r.armee !== "Interarmées" ? r.armee : p.armee;
      if (type !== "ajout") M.ANNEES.forEach(function (a) { l.qte[a] = 1; });
      else l.qte[M.ANNEES[0]] = 1;
    }
    return l;
  }

  function rendreDemande() {
    var r = role(etat.role);
    $("titre-demande").textContent = "Demande " + r.code;
    var t = $("table-demande");
    vider(t);
    var mesLignes = etat.lignes.filter(function (l) { return l.role === etat.role; });
    var tete = el("tr", null, [el("th", { texte: "Type" }), el("th", { texte: "Objet" }), el("th", { texte: "Armée imputée" })]
      .concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); }))
      .concat([el("th", { classe: "num", texte: "Unitaire" }), el("th", { classe: "num", texte: "Total 6 ans" }), el("th", { texte: "Justification" }), el("th", { html: "" })]));
    t.appendChild(el("thead", null, [tete]));
    var corps = el("tbody");
    if (!mesLignes.length) {
      corps.appendChild(el("tr", null, [el("td", { colspan: 11 + M.ANNEES.length - 6, classe: "vide-etat", texte: "Aucune ligne pour " + r.code + ". Choisissez un type de ligne en haut à droite, puis « Ajouter la ligne »." })]));
    }
    mesLignes.forEach(function (l) { corps.appendChild(rangeeSaisie(l)); });
    t.appendChild(corps);
    rendreBilan();
  }

  function rangeeSaisie(l) {
    var tr = el("tr");
    var totalCellule = el("td", { classe: "num" });
    var unitCellule = el("td", { classe: "num" });

    function majChiffres() {
      var u = M.unitaire(l, IDX);
      var c = M.coutLigne(l, IDX);
      unitCellule.textContent = md(u.cout);
      vider(totalCellule);
      totalCellule.appendChild(document.createTextNode(md(c.total)));
      if (c.totalDorese) totalCellule.appendChild(el("div", { classe: "sous", texte: c.totalDorese + " DORESE" }));
      rendreBilan();
    }
    function changer() { majChiffres(); enregistrer(l); }

    tr.appendChild(el("td", null, [el("span", { texte: M.TYPES_LIGNE[l.type] })]));

    // Objet
    var objet = el("td", { classe: "objet" });
    if (l.type === "libre") {
      var choix = el("select", { "aria-label": "Modèle de ligne" });
      choix.appendChild(el("option", { value: "", texte: "Modèle (facultatif)…" }));
      OPTIONS.forEach(function (o) { choix.appendChild(el("option", { value: o.code, texte: o.role + " · " + o.libelle + " · " + md(o.cout) + "/an" })); });
      var lib = el("input", { value: l.libelle || "", placeholder: "Intitulé (ex. Renforcement Roumanie)", "aria-label": "Intitulé" });
      var cu = el("input", { classe: "court", type: "number", step: 100, value: l.cout_unitaire, "aria-label": "Montant annuel en M€" });
      var d = l.dorese || { ao: 0, mco: 0, rh: 0 };
      function champDor(k, nomCourt) {
        var i = el("input", { type: "number", min: 0, step: 1, value: d[k] || 0, "aria-label": "DORESE " + nomCourt });
        i.addEventListener("input", function () { l.dorese = l.dorese || {}; l.dorese[k] = Number(i.value) || 0; changer(); });
        return el("label", null, [nomCourt + " ", i]);
      }
      choix.addEventListener("change", function () {
        var o = OPTIONS.filter(function (x) { return x.code === choix.value; })[0];
        if (!o) return;
        l.libelle = o.libelle; l.cout_unitaire = o.cout; l.armee = o.armee; l.source = o.source;
        l.dorese = o.dorese ? { ao: o.dorese.ao, mco: o.dorese.mco, rh: o.dorese.rh } : { ao: 0, mco: 0, rh: 0 };
        changer(); rendreDemande();
      });
      lib.addEventListener("input", function () { l.libelle = lib.value; enregistrer(l); });
      cu.addEventListener("input", function () { l.cout_unitaire = Number(cu.value) || 0; changer(); });
      objet.appendChild(choix);
      objet.appendChild(el("div", { style: "margin-top:.25rem" }, [lib]));
      objet.appendChild(el("div", { classe: "dor" }, [el("label", null, ["M€ par exemplaire et par an ", cu])]));
      objet.appendChild(el("div", { classe: "dor" }, ["DORESE incluses :", champDor("ao", "AO"), champDor("mco", "MCO"), champDor("rh", "RH")]));
      if (l.source) objet.appendChild(el("div", { classe: "sous", texte: "Source : " + l.source }));
    } else {
      var sp = selectPion(l);
      sp.addEventListener("change", function () { l.pion = sp.value; changer(); rendreDemande(); });
      objet.appendChild(sp);
      if (l.type === "ajout") {
        var niv = el("select", { "aria-label": "Niveau" }, [el("option", { value: "50", texte: "à 50 % (face dégradée)" }), el("option", { value: "100", texte: "à 100 % (avec DORESE)" })]);
        niv.value = String(l.niveau || 50);
        niv.addEventListener("change", function () { l.niveau = Number(niv.value); changer(); });
        objet.appendChild(el("div", { style: "margin-top:.25rem" }, [niv]));
      }
      var p = IDX[l.pion];
      if (p) {
        var info = l.type === "dorese"
          ? "DORESE : " + p.dorese.ao + " AO · " + p.dorese.mco + " MCO · " + p.dorese.rh + " RH"
          : l.type === "retrait" ? "Libère " + p.cout50 / M.CASE + " cases par année cochée"
          : "50 % : " + p.cout50 / M.CASE + " c. · 100 % : " + p.cout100 / M.CASE + " c.";
        objet.appendChild(el("div", { classe: "sous", texte: info }));
      }
    }
    tr.appendChild(objet);

    // Armée imputée
    var arm = el("select", { "aria-label": "Armée imputée" });
    M.ARMEES.forEach(function (a) { arm.appendChild(el("option", { value: a, texte: a })); });
    arm.value = M.armeeDeLigne(l, IDX);
    arm.addEventListener("change", function () { l.armee = arm.value; changer(); });
    tr.appendChild(el("td", null, [arm]));

    // Années
    M.ANNEES.forEach(function (a) {
      var max = (l.type === "dorese" || l.type === "retrait") ? 1 : 99;
      var i = el("input", { classe: "qte", type: "number", min: 0, max: max, step: 1, value: (l.qte || {})[a] || 0, "aria-label": "Quantité " + a });
      i.addEventListener("input", function () {
        var v = Math.max(0, Math.min(max, Math.round(Number(i.value) || 0)));
        l.qte = l.qte || {}; l.qte[a] = v;
        changer();
      });
      tr.appendChild(el("td", { classe: "num" }, [i]));
    });

    tr.appendChild(unitCellule);
    tr.appendChild(totalCellule);

    var just = el("textarea", { rows: 1, placeholder: "Pourquoi ce besoin ?", "aria-label": "Justification" });
    just.value = l.justification || "";
    just.addEventListener("input", function () { l.justification = just.value; enregistrer(l); });
    tr.appendChild(el("td", null, [just]));

    var sup = el("button", { classe: "suppr", type: "button", title: "Supprimer la ligne", "aria-label": "Supprimer la ligne", texte: "×" });
    sup.addEventListener("click", function () {
      if (sup.dataset.arme !== "1") { sup.dataset.arme = "1"; sup.textContent = "Confirmer"; setTimeout(function () { sup.dataset.arme = ""; sup.textContent = "×"; }, 3000); return; }
      clearTimeout(enAttente[l.id]); delete enAttente[l.id];
      etat.lignes = etat.lignes.filter(function (x) { return x.id !== l.id; });
      S.supprimerLigne(etat.partie.nom, etat.mdp, l.id).then(function () { toast("Ligne supprimée"); }).catch(function (e) { toast(e.message); });
      rendreDemande();
    });
    tr.appendChild(el("td", null, [sup]));

    majChiffres();
    return tr;
  }

  function rendreBilan() {
    var b = $("bilan-role");
    vider(b);
    var mien = M.synthese(PIONS, etat.lignes, params(), function (l) { return l.role === etat.role; });
    var tout = M.synthese(PIONS, etat.lignes, params());
    M.ANNEES.forEach(function (a) {
      var m = mien[a], t = tout[a];
      var d = m.dorese;
      b.appendChild(el("div", { classe: "bilan-an" }, [
        el("span", { classe: "an", texte: String(a) }),
        el("span", { classe: "l" }, ["Ma demande", el("b", { texte: md(m.totalDemandes) })]),
        el("span", { classe: "l" }, ["DORESE", el("b", { texte: (d.ao + d.mco + d.rh) + " (" + d.ao + "/" + d.mco + "/" + d.rh + ")" })]),
        el("span", { classe: "l" }, ["Partie entière", el("b", { texte: md(t.total) })]),
        el("span", { classe: "l" }, ["Plafond", el("b", { texte: md(t.plafond) })]),
        el("span", { classe: "etat " + (t.marge >= 0 ? "ok" : "ko"), texte: t.marge >= 0 ? "Marge " + md(t.marge) : "Dépassement " + md(-t.marge) })
      ]));
    });
  }

  // ---------- Synthèse ----------
  function rendreSynthese() {
    var syn = M.synthese(PIONS, etat.lignes, params());
    // Trajectoire
    var tr = $("trajectoire");
    vider(tr);
    var echelleMax = Math.max.apply(null, M.ANNEES.map(function (a) { return Math.max(syn[a].total, syn[a].table); }));
    M.ANNEES.forEach(function (a) {
      var s = syn[a];
      var barre = el("div", { classe: "traj-barre", title: "Socle " + md(s.totalSocle) + ", demandes " + md(s.totalDemandes) });
      barre.appendChild(el("span", { classe: "traj-socle", style: "width:" + (100 * s.totalSocle / echelleMax) + "%" }));
      M.ARMEES.forEach(function (arm) {
        var v = Math.max(0, s.demandes[arm]);
        if (v) barre.appendChild(el("span", { style: "width:" + (100 * v / echelleMax) + "%;background:" + couleurArmee(arm), title: arm + " " + md(v) }));
      });
      barre.appendChild(el("span", { classe: "traj-plafond", style: "left:" + (100 * s.plafond / echelleMax) + "%", title: "Plafond " + md(s.plafond) }));
      tr.appendChild(el("div", { classe: "traj-ligne" }, [
        el("span", { classe: "traj-an", texte: String(a) }), barre,
        el("span", { classe: "traj-val " + (s.marge < 0 ? "neg" : ""), texte: md(s.total) })
      ]));
    });
    tr.appendChild(el("div", { classe: "traj-echelle" }, [el("span"), el("div", null, [el("span", { texte: "0" }), el("span", { texte: md(echelleMax / 2) }), el("span", { texte: md(echelleMax) })]), el("span")]));
    var leg = el("div", { classe: "legende" }, [el("span", null, [el("span", { classe: "pastille n-gris" }), "Socle"])]
      .concat(M.ARMEES.map(function (a) { return el("span", null, [el("span", { classe: "pastille " + classeArmee(a) }), "Demandes " + a]); }))
      .concat([el("span", { texte: "Trait noir : plafond de l'année" })]));
    tr.appendChild(leg);

    // Tableau par année et par armée
    var t = $("table-synthese");
    vider(t);
    t.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "M€" })].concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); })).concat([el("th", { classe: "num", texte: "Total" })]))]));
    var corps = el("tbody");
    function rangee(lib, f, classe) {
      var tot = 0;
      var cells = M.ANNEES.map(function (a) { var v = f(syn[a]); tot += v; return el("td", { classe: "num " + (classe ? classe(v) : ""), texte: md(v) }); });
      corps.appendChild(el("tr", null, [el("td", null, lib)].concat(cells).concat([el("td", { classe: "num", texte: md(tot) })])));
    }
    rangee([el("span", { classe: "pastille n-gris" }), "Socle (pions posés d'office)"], function (s) { return s.totalSocle; });
    M.ARMEES.forEach(function (arm) {
      rangee([el("span", { classe: "pastille " + classeArmee(arm) }), "Demandes " + arm], function (s) { return s.demandes[arm]; });
    });
    rangee(["Total sur la table"], function (s) { return s.total; });
    rangee(["Plafond"], function (s) { return s.plafond; });
    rangee(["Marge (+) ou dépassement (−)"], function (s) { return s.marge; }, function (v) { return v < 0 ? "neg" : "pos"; });
    rangee(["dont DORESE demandées"], function (s) { return (s.dorese.ao + s.dorese.mco + s.dorese.rh) * M.CASE; });
    t.appendChild(corps);

    // Par rôle
    var tr2 = $("table-roles");
    vider(tr2);
    tr2.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "Rôle" }), el("th", { classe: "num", texte: "Lignes" })].concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); })).concat([el("th", { classe: "num", texte: "Total" })]))]));
    var c2 = el("tbody");
    var rolesPresents = M.ROLES.filter(function (r) { return etat.lignes.some(function (l) { return l.role === r.code; }); });
    if (!rolesPresents.length) c2.appendChild(el("tr", null, [el("td", { colspan: 3 + M.ANNEES.length, classe: "vide-etat", texte: "Aucune demande saisie dans cette partie." })]));
    rolesPresents.forEach(function (r) {
      var s = M.synthese(PIONS, etat.lignes, params(), function (l) { return l.role === r.code; });
      var tot = 0;
      var n = etat.lignes.filter(function (l) { return l.role === r.code; }).length;
      c2.appendChild(el("tr", null, [el("td", { texte: r.code }), el("td", { classe: "num", texte: String(n) })]
        .concat(M.ANNEES.map(function (a) { tot += s[a].totalDemandes; return el("td", { classe: "num", texte: md(s[a].totalDemandes) }); }))
        .concat([el("td", { classe: "num", texte: md(tot) })])));
    });
    tr2.appendChild(c2);

    // Toutes les lignes
    var t3 = $("table-toutes");
    vider(t3);
    t3.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "Rôle" }), el("th", { texte: "Type" }), el("th", { texte: "Objet" }), el("th", { texte: "Armée" })]
      .concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); })).concat([el("th", { classe: "num", texte: "Total" }), el("th", { texte: "Justification" })]))]));
    var c3 = el("tbody");
    if (!etat.lignes.length) c3.appendChild(el("tr", null, [el("td", { colspan: 6 + M.ANNEES.length, classe: "vide-etat", texte: "Les lignes des joueurs apparaîtront ici." })]));
    etat.lignes.forEach(function (l) {
      var c = M.coutLigne(l, IDX);
      c3.appendChild(el("tr", null, [el("td", { texte: l.role }), el("td", { texte: M.TYPES_LIGNE[l.type] || l.type }), el("td", { texte: libelleLigne(l) }), el("td", { texte: M.armeeDeLigne(l, IDX) })]
        .concat(M.ANNEES.map(function (a) { return el("td", { classe: "num", texte: c.annees[a].cout ? md(c.annees[a].cout) : "·" }); }))
        .concat([el("td", { classe: "num", texte: md(c.total) }), el("td", { texte: l.justification || "" })])));
    });
    t3.appendChild(c3);
  }

  function libelleLigne(l) {
    if (l.type === "libre") return l.libelle || "Ligne libre";
    var p = IDX[l.pion];
    var nom = p ? p.nom : l.pion;
    if (l.type === "ajout") return nom + " à " + (l.niveau || 50) + " %";
    return nom;
  }

  function csv() {
    var sep = ";";
    var ent = ["Rôle", "Type", "Objet", "Armée imputée"].concat(M.ANNEES.map(String)).concat(["Total (M€)", "Justification"]);
    var lignes = [ent.join(sep)];
    etat.lignes.forEach(function (l) {
      var c = M.coutLigne(l, IDX);
      var v = [l.role, M.TYPES_LIGNE[l.type], libelleLigne(l), M.armeeDeLigne(l, IDX)]
        .concat(M.ANNEES.map(function (a) { return c.annees[a].cout; })).concat([c.total, (l.justification || "").replace(/\s+/g, " ")]);
      lignes.push(v.map(function (x) { var s = String(x); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(sep));
    });
    return lignes.join("\n");
  }

  // ---------- Table ----------
  function rendreTable() {
    var sel = $("table-annee");
    if (!sel.options.length) M.ANNEES.forEach(function (a) { sel.appendChild(el("option", { value: a, texte: String(a) })); });
    sel.value = String(etat.anneeTable);
    var a = etat.anneeTable;
    var p = params();
    var blocs = M.blocsAnnee(PIONS, etat.lignes, p, a);
    var syn = M.synthese(PIONS, etat.lignes, p)[a];
    var tableCases = Number(p.table) || 600;
    var plafondCases = Number(p.plafonds[a]) || 0;
    var occupees = blocs.reduce(function (s, b) { return s + b.cases; }, 0);
    var total = Math.max(tableCases, Math.ceil(occupees / 30) * 30);

    var ch = $("table-chiffres");
    vider(ch);
    [["Cases occupées", occupees + " / " + plafondCases + " (plafond)"], ["Montant", md(syn.total)], [syn.marge >= 0 ? "Marge" : "Dépassement", md(Math.abs(syn.marge))]].forEach(function (x, i) {
      ch.appendChild(el("span", { classe: i === 2 ? (syn.marge >= 0 ? "pos" : "neg") : "" }, [x[0] + " : ", el("b", { texte: x[1] })]));
    });

    var pl = $("plateau");
    vider(pl);
    var cellules = [];
    blocs.forEach(function (b) {
      for (var i = 0; i < b.cases; i++) cellules.push({ bloc: b, debut: i === 0 });
    });
    for (var k = 0; k < total; k++) {
      var c = cellules[k];
      var classes = ["case"];
      var style = "";
      var titre = "Case libre";
      if (c) {
        classes.push("pleine");
        var b = c.bloc;
        var couleur = b.nature === "gris" ? "var(--gris)" : b.nature === "violet" ? "var(--violet)" : couleurArmee(b.armee);
        if (b.nature === "orange") couleur = "var(--inter)";
        style = "background:" + couleur;
        if (b.nature === "capacite" && b.niveau !== 100) classes.push("c50");
        if (b.nature === "dorese") classes.push("dor");
        if (c.debut) classes.push("debut");
        titre = b.libelle + " · " + b.armee + (b.nature === "capacite" ? " · " + (b.niveau === 100 ? "100 %" : "50 %") : "") + (b.role ? " · demande " + b.role : "");
      }
      if (k >= plafondCases && k < tableCases) classes.push(c ? "debord" : "hors");
      if (k >= tableCases) classes.push("debord");
      if (k >= plafondCases && !c) titre = k < tableCases ? "Au-delà du plafond " + a : "Hors table";
      pl.appendChild(el("div", { classe: classes.join(" "), style: style, title: titre }));
    }

    var lg = $("legende");
    vider(lg);
    var items = [["n-gris", "Dépense fixe"], ["n-violet", "Investissement"]].map(function (x) { return el("span", null, [el("span", { classe: "case pleine", style: "background:var(--" + (x[0] === "n-gris" ? "gris" : "violet") + ")" }), x[1]]); });
    M.ARMEES.forEach(function (arm) { items.push(el("span", null, [el("span", { classe: "case pleine", style: "background:" + couleurArmee(arm) }), arm])); });
    items.push(el("span", null, [el("span", { classe: "case pleine c50", style: "background:var(--terre)" }), "Capacité à 50 %"]));
    items.push(el("span", null, [el("span", { classe: "case pleine dor", style: "background:var(--terre)" }), "DORESE"]));
    items.push(el("span", null, [el("span", { classe: "case hors" }), "Au-delà du plafond"]));
    items.push(el("span", null, [el("span", { classe: "case pleine debord", style: "background:var(--marine)" }), "Pion au-delà du plafond"]));
    items.forEach(function (i) { lg.appendChild(i); });
  }

  // ---------- Paramètres ----------
  function rendreParametres() {
    var p = params();
    var edit = peutEditerParams();
    $("aide-parametres").textContent = edit
      ? "Les plafonds et les pions de scénario s'appliquent à toute la partie."
      : "Lecture seule : seuls l'animateur, le SC-Plans et le CEMA modifient ces paramètres.";
    var pf = $("plafonds");
    vider(pf);
    M.ANNEES.forEach(function (a) {
      var i = el("input", { id: "plafond-" + a, type: "number", min: 0, max: 2000, step: 1, value: p.plafonds[a], disabled: edit ? null : "disabled" });
      var aide = el("span", { classe: "sous", texte: md((Number(p.plafonds[a]) || 0) * M.CASE) });
      i.addEventListener("input", function () { aide.textContent = md((Number(i.value) || 0) * M.CASE); });
      pf.appendChild(el("label", { for: "plafond-" + a }, [String(a), i, aide]));
    });
    var al = $("aleas");
    vider(al);
    PIONS.filter(function (x) { return x.type === "orange"; }).forEach(function (o) {
      var annees = (p.aleas || {})[o.id] || [];
      var boites = M.ANNEES.map(function (a) {
        var cb = el("input", { type: "checkbox", id: "alea-" + o.id + "-" + a, "data-pion": o.id, "data-annee": a, disabled: edit ? null : "disabled" });
        cb.checked = annees.map(Number).indexOf(a) !== -1;
        return el("label", { for: cb.id }, [cb, " " + a]);
      });
      al.appendChild(el("div", { classe: "alea" }, [el("span", { texte: o.nom + " (" + o.cout50 / M.CASE + " cases par an)" }), el("div", { classe: "alea-annees" }, boites)]));
    });
    $("btn-parametres").hidden = !edit;
  }

  function enregistrerParametres(ev) {
    ev.preventDefault();
    if (!peutEditerParams()) return;
    var p = JSON.parse(JSON.stringify(params()));
    M.ANNEES.forEach(function (a) { p.plafonds[a] = Math.max(0, Number($("plafond-" + a).value) || 0); });
    p.aleas = {};
    document.querySelectorAll("#aleas input[type=checkbox]").forEach(function (cb) {
      var id = cb.getAttribute("data-pion");
      p.aleas[id] = p.aleas[id] || [];
      if (cb.checked) p.aleas[id].push(Number(cb.getAttribute("data-annee")));
    });
    S.majParams(etat.partie.nom, etat.mdp, p).then(function () {
      etat.partie.params = p;
      $("param-etat").textContent = "Paramètres enregistrés.";
      toast("Paramètres enregistrés");
      rendre(true);
    }).catch(function (e) { $("param-etat").textContent = e.message; });
  }

  // ---------- Démarrage ----------
  function demarrer() {
    $("mode").textContent = S.mode === "partage" ? "Base partagée" : "Mode local";
    $("note-mode").textContent = S.mode === "partage"
      ? "Les parties sont enregistrées dans la base partagée : elles restent disponibles d'une séance à l'autre, et chaque joueur voit les demandes des autres en quelques secondes."
      : "Mode local : les parties restent dans ce navigateur. Pour jouer à plusieurs, ouvrez l'outil par le lien que donne l'animateur.";
    remplirRoles($("rej-role"), "EMAT");
    var ty = $("ajout-type");
    Object.keys(M.TYPES_LIGNE).forEach(function (k) { ty.appendChild(el("option", { value: k, texte: M.TYPES_LIGNE[k] })); });

    $("form-rejoindre").addEventListener("submit", function (ev) {
      ev.preventDefault();
      $("rej-erreur").textContent = "";
      var nom = $("rej-partie").value, mdp = $("rej-mdp").value;
      if (!nom) { $("rej-erreur").textContent = "Créez d'abord une partie, ou demandez son nom à l'animateur."; return; }
      S.ouvrirPartie(nom, mdp).then(function (p) { return entrer(p, mdp, $("rej-role").value); })
        .catch(function (e) { $("rej-erreur").textContent = e.message; });
    });
    $("form-creer").addEventListener("submit", function (ev) {
      ev.preventDefault();
      $("cre-erreur").textContent = "";
      var nom = $("cre-nom").value.trim(), mdp = $("cre-mdp").value;
      if (mdp !== $("cre-mdp2").value) { $("cre-erreur").textContent = "Les deux mots de passe diffèrent."; return; }
      S.creerPartie(nom, mdp, M.parametresParDefaut()).then(function (p) { toast("Partie « " + p.nom + " » créée"); return entrer(p, mdp, "Animateur"); })
        .catch(function (e) { $("cre-erreur").textContent = e.message; });
    });
    $("btn-quitter").addEventListener("click", quitter);
    $("session-role").addEventListener("change", function () { etat.role = $("session-role").value; memoriser(); rendre(true); });
    document.querySelectorAll(".onglets button").forEach(function (b) {
      b.addEventListener("click", function () { changerOnglet(b.getAttribute("data-onglet")); });
    });
    $("btn-ajouter").addEventListener("click", function () {
      var l = nouvelleLigne($("ajout-type").value);
      etat.lignes.push(l);
      enregistrer(l);
      rendreDemande();
    });
    $("table-annee").addEventListener("change", function () { etat.anneeTable = Number($("table-annee").value); rendreTable(); });
    $("form-parametres").addEventListener("submit", enregistrerParametres);
    $("btn-copier-csv").addEventListener("click", function () {
      var texte = csv();
      try {
        navigator.clipboard.writeText(texte).then(function () { toast("CSV copié : collez-le dans Excel"); }, function () { toast("Copie refusée par le navigateur"); });
      } catch (e) { toast("Copie refusée par le navigateur"); }
    });
    $("btn-telecharger-csv").addEventListener("click", function () {
      var blob = new Blob(["﻿" + csv()], { type: "text/csv;charset=utf-8" });
      var a = el("a", { href: URL.createObjectURL(blob), download: "strategikon-" + (etat.partie ? etat.partie.nom : "partie") + ".csv" });
      document.body.appendChild(a); a.click(); a.remove();
    });

    setInterval(function () { if (etat.partie && !Object.keys(enAttente).length) rechargerLignes(false); }, S.mode === "partage" ? 8000 : 5000);

    chargerParties().then(function () {
      var mem = null;
      try { mem = JSON.parse(sessionStorage.getItem("strategikon.session")); } catch (e) { mem = null; }
      if (mem && mem.nom) {
        S.ouvrirPartie(mem.nom, mem.mdp).then(function (p) {
          return entrer(p, mem.mdp, mem.role).then(function () { if (mem.onglet) changerOnglet(mem.onglet); });
        }).catch(function () { memoriser(); });
      }
    });
  }

  demarrer();
})();
