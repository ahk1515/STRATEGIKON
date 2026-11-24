// Interface STRATEGIKON : accueil (parties), saisie par rôle, synthèse, table, paramètres.
(function () {
  "use strict";

  var M = window.STRAT_MOTEUR;
  var S = window.STRAT_STOCKAGE;
  var PIONS = window.STRAT_PIONS || [];
  var CATALOGUE = window.STRAT_CATALOGUE_ROLES || [];
  function optionDe(code) { return code ? CATALOGUE.filter(function (o) { return o.code === code; })[0] || null : null; }
  function fourchette(o) {
    var u = o.annuel ? "/an" : (o.periodicite && o.periodicite !== "non précisée" ? " (" + o.periodicite + ")" : "");
    if (o.cout === null || o.cout === undefined) return o.statut_cout === "a_definir" ? "coût à définir" : "non chiffré";
    if (o.cout_max && o.cout_max !== o.cout) return o.cout + " à " + o.cout_max + " M€" + u;
    return o.cout + " M€" + u;
  }
  var IDX = M.indexPions(PIONS);
  var ROLES_EDITION_PARAMS = ["Animateur", "SC-Plans", "CEMA"];
  var ROLES_ARBITRAGE = ["CEMA", "Animateur"];
  var ROLES_VUE_COMPLETE = ["CEMA", "Animateur", "SC-Plans"];
  function vueComplete() { return ROLES_VUE_COMPLETE.indexOf(etat.role) !== -1; }
  function visible(l) { return vueComplete() || l.role === etat.role; }

  var etat = {
    partie: null, // { id, nom, params }
    mdp: "",
    role: "",
    lignes: [],
    onglet: "demande",
    anneeTable: M.ANNEES[0],
    vueTable: "demandes"
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
    if (etat.onglet === "arbitrage" && (complet || !$("vue-arbitrage").contains(actif))) rendreArbitrage();
    if (etat.onglet === "parametres" && (complet || !$("form-parametres").contains(actif))) rendreParametres();
  }

  function changerOnglet(nom) {
    etat.onglet = nom;
    document.querySelectorAll(".onglets button").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-onglet") === nom ? "true" : "false");
    });
    ["demande", "synthese", "table", "arbitrage", "parametres"].forEach(function (v) { $("vue-" + v).hidden = v !== nom; });
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
      l.libelle = ""; l.modele = null; l.cout_unitaire = 100; l.dorese = { ao: 0, mco: 0, rh: 0 }; l.armee = r.armee;
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
      var choix = el("select", { "aria-label": "Option du catalogue" });
      choix.appendChild(el("option", { value: "", texte: "Pion sur mesure (hors catalogue)" }));
      var rolesCat = vueComplete()
        ? [etat.role].concat(M.ROLES.map(function (r) { return r.code; }).filter(function (c) { return c !== etat.role; }))
        : [etat.role];
      rolesCat.forEach(function (rc) {
        var opts = CATALOGUE.filter(function (o) { return o.role === rc; });
        if (!opts.length) return;
        var g = el("optgroup", { label: "Fiche " + rc });
        opts.forEach(function (o) { g.appendChild(el("option", { value: o.code, texte: o.libelle + " · " + fourchette(o) })); });
        choix.appendChild(g);
      });
      choix.value = l.modele || "";
      var o = optionDe(l.modele);
      var lib = el("input", { value: l.libelle || "", placeholder: "Intitulé du pion", "aria-label": "Intitulé" });
      var cu = el("input", { classe: "court", type: "number", min: 0, step: 100, value: l.cout_unitaire, "aria-label": "Prix fixé en M€" });
      var noteCu = el("div", { classe: "sous" });
      var d = l.dorese || { ao: 0, mco: 0, rh: 0 };
      function champDor(k, nomCourt) {
        var i = el("input", { type: "number", min: 0, step: 1, value: d[k] || 0, "aria-label": "DORESE " + nomCourt });
        i.addEventListener("input", function () { l.dorese = l.dorese || {}; l.dorese[k] = Number(i.value) || 0; changer(); });
        return el("label", null, [nomCourt + " ", i]);
      }
      function majNote(brut) {
        var txt = [];
        if (!l.cout_unitaire) txt.push("Fixez le prix : la ligne ne compte pas tant qu'il est à 0");
        if (brut !== undefined && Number(brut) !== l.cout_unitaire && l.cout_unitaire) txt.push("Arrondi à la case : " + md(l.cout_unitaire));
        if (brut === undefined && o && o.cout && o.cout % M.CASE && l.cout_unitaire) txt.push("Prix de la fiche " + md(o.cout) + ", arrondi à " + md(l.cout_unitaire) + " : à confirmer");
        if (o && o.cout !== null && o.cout !== undefined) {
          var hautO = o.cout_max || o.cout;
          if (l.cout_unitaire < M.arrondiCase(o.cout) && l.cout_unitaire < o.cout || l.cout_unitaire > Math.max(M.arrondiCase(hautO), hautO)) txt.push("Hors fourchette de la fiche (" + fourchette(o) + ")");
        }
        noteCu.textContent = txt.join(" · ");
        noteCu.className = "sous" + (txt.length ? " alerte-texte" : "");
      }
      choix.addEventListener("change", function () {
        var opt = optionDe(choix.value);
        if (!opt) { l.modele = null; l.source = null; changer(); rendreDemande(); return; }
        l.modele = opt.code; l.libelle = opt.libelle; l.armee = opt.armee; l.source = opt.source;
        l.cout_unitaire = opt.cout ? M.arrondiCase(opt.cout) : 0;
        l.dorese = opt.dorese ? { ao: opt.dorese.ao || 0, mco: opt.dorese.mco || 0, rh: opt.dorese.rh || 0 } : { ao: 0, mco: 0, rh: 0 };
        changer(); rendreDemande();
      });
      lib.addEventListener("input", function () { l.libelle = lib.value; enregistrer(l); });
      cu.addEventListener("input", function () { l.cout_unitaire = M.arrondiCase(cu.value); majChiffres(); majNote(cu.value); enregistrer(l); });
      cu.addEventListener("change", function () { cu.value = l.cout_unitaire; majNote(); });
      objet.appendChild(choix);
      objet.appendChild(el("div", { style: "margin-top:.25rem" }, [lib]));
      if (o) {
        var infos = [fourchette(o) + (o.periodicite ? " · " + o.periodicite : "")];
        if (o.etalement) infos.push("Étalement : " + o.etalement);
        if (o.delai) infos.push("Délai : " + o.delai);
        objet.appendChild(el("div", { classe: "sous", texte: "Fiche : " + infos.join(" · ") }));
        if (o.alerte) objet.appendChild(el("div", { classe: "sous alerte-texte", texte: o.alerte }));
        if (o.source || o.edition) objet.appendChild(el("div", { classe: "sous", texte: [o.source, o.edition].filter(Boolean).join(" · ") }));
        if (o.conditions) objet.appendChild(el("details", { classe: "sous" }, [el("summary", { texte: "Conditions" }), el("p", { texte: o.conditions })]));
      } else {
        var val = ((params().validations || {})[l.id]);
        objet.appendChild(el("div", { classe: "badge " + (val ? "badge-ok" : "badge-attente"), texte: val ? "Sur mesure · validé par l'animateur" : "Sur mesure · à valider par l'animateur" }));
      }
      objet.appendChild(el("div", { classe: "dor" }, [el("label", null, ["Prix fixé (M€ par an) ", cu])]));
      objet.appendChild(noteCu);
      objet.appendChild(el("div", { classe: "dor" }, ["DORESE incluses :", champDor("ao", "AO"), champDor("mco", "MCO"), champDor("rh", "RH")]));
      objet.appendChild(el("div", { classe: "sous", texte: "Les cases des années indiquent combien de fois ce prix est posé. Pour un investissement étalé, posez une fois par année concernée." }));
      majNote();
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
    var synArb = M.synthese(PIONS, M.lignesApresArbitrage(etat.lignes, params()), params());
    rangee(["Total après arbitrage"], function (x) { return synArb[x.annee].total; });
    rangee(["Marge après arbitrage"], function (x) { return synArb[x.annee].marge; }, function (v) { return v < 0 ? "neg" : "pos"; });
    rangee(["dont DORESE demandées"], function (s) { return (s.dorese.ao + s.dorese.mco + s.dorese.rh) * M.CASE; });
    t.appendChild(corps);

    // Par rôle
    var tr2 = $("table-roles");
    vider(tr2);
    tr2.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "Rôle" }), el("th", { classe: "num", texte: "Lignes" })].concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); })).concat([el("th", { classe: "num", texte: "Total" })]))]));
    var c2 = el("tbody");
    var rolesPresents = M.ROLES.filter(function (r) { return (vueComplete() || r.code === etat.role) && etat.lignes.some(function (l) { return l.role === r.code; }); });
    $("note-vue").textContent = vueComplete() ? "" : "Vue limitée à vos postes de dépense : le détail des autres rôles est réservé au CEMA, au SC-Plans et à l'animateur. Les totaux par armée restent visibles.";
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
    var lignesVisibles = etat.lignes.filter(visible);
    if (!lignesVisibles.length) c3.appendChild(el("tr", null, [el("td", { colspan: 6 + M.ANNEES.length, classe: "vide-etat", texte: vueComplete() ? "Les lignes des joueurs apparaîtront ici." : "Vos lignes apparaîtront ici." })]));
    lignesVisibles.forEach(function (l) {
      var c = M.coutLigne(l, IDX);
      c3.appendChild(el("tr", null, [el("td", { texte: l.role }), el("td", { texte: M.TYPES_LIGNE[l.type] || l.type }), el("td", { texte: libelleLigne(l) }), el("td", { texte: M.armeeDeLigne(l, IDX) })]
        .concat(M.ANNEES.map(function (a) { return el("td", { classe: "num", texte: c.annees[a].cout ? md(c.annees[a].cout) : "·" }); }))
        .concat([el("td", { classe: "num", texte: md(c.total) }), el("td", { texte: l.justification || "" })])));
    });
    t3.appendChild(c3);
  }

  // ---------- Arbitrage ----------
  var fileParams = Promise.resolve();
  function modifierParams(fn) {
    // Lecture puis écriture, à la suite, pour ne pas écraser un arbitrage voisin.
    fileParams = fileParams.then(function () {
      return S.lireEtat(etat.partie.nom, etat.mdp).then(function (e) {
        var p = e.partie.params && e.partie.params.plafonds ? e.partie.params : M.parametresParDefaut();
        fn(p);
        return S.majParams(etat.partie.nom, etat.mdp, p).then(function () { etat.partie.params = p; rendre(false); });
      });
    }).catch(function (e) { toast("Non enregistré : " + e.message); });
    return fileParams;
  }

  function rendreArbitrage() {
    var p = params();
    var edit = ROLES_ARBITRAGE.indexOf(etat.role) !== -1;
    $("aide-arbitrage").textContent = (edit
      ? "Pour chaque ligne : retenue, différée d'une à trois années, ou renoncée. "
      : "Lecture seule : seuls le CEMA et l'animateur arbitrent. ")
      + "Un différé décale la ligne ; ce qui dépasse 2032 est reporté hors LPM.";
    var dem = M.synthese(PIONS, etat.lignes, p);
    var arb = M.synthese(PIONS, M.lignesApresArbitrage(etat.lignes, p), p);
    var t = $("table-arb-annees");
    vider(t);
    t.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "M€" })].concat(M.ANNEES.map(function (a) { return el("th", { classe: "num", texte: String(a) }); })))]));
    var c = el("tbody");
    [["Total demandé", function (a) { return dem[a].total; }],
     ["Total après arbitrage", function (a) { return arb[a].total; }],
     ["Plafond", function (a) { return arb[a].plafond; }],
     ["Marge après arbitrage", function (a) { return arb[a].marge; }, true]].forEach(function (r) {
      c.appendChild(el("tr", null, [el("td", { texte: r[0] })].concat(M.ANNEES.map(function (a) {
        var v = r[1](a); return el("td", { classe: "num " + (r[2] ? (v < 0 ? "neg" : "pos") : ""), texte: md(v) });
      }))));
    });
    t.appendChild(c);

    var tl = $("table-arb-lignes");
    vider(tl);
    tl.appendChild(el("thead", null, [el("tr", null, ["Rôle", "Objet", "Armée", "Demandé (6 ans)", "Décision", "Après arbitrage", "Sur mesure"].map(function (h, i) { return el("th", { classe: i === 3 || i === 5 ? "num" : "", texte: h }); }))]));
    var cl = el("tbody");
    var aArbitrer = etat.lignes.filter(visible);
    if (!aArbitrer.length) cl.appendChild(el("tr", null, [el("td", { colspan: 7, classe: "vide-etat", texte: "Aucune demande à arbitrer pour l'instant." })]));
    aArbitrer.forEach(function (l) {
      var a = M.arbitrageDe(l, p);
      var avant = M.coutLigne(l, IDX).total;
      var la = M.ligneArbitree(l, p);
      var apres = la ? M.coutLigne(la, IDX).total : 0;
      var st = el("select", { "aria-label": "Décision", disabled: edit ? null : "disabled" });
      Object.keys(M.STATUTS).forEach(function (k) { st.appendChild(el("option", { value: k, texte: M.STATUTS[k] })); });
      st.value = a.statut;
      var dec = el("select", { "aria-label": "Décalage", disabled: edit ? null : "disabled", hidden: a.statut === "differe" ? null : "hidden" });
      [1, 2, 3].forEach(function (n) { dec.appendChild(el("option", { value: n, texte: "de " + n + " an" + (n > 1 ? "s" : "") })); });
      dec.value = String(a.decalage || 1);
      function enreg() {
        var val = { statut: st.value, decalage: st.value === "differe" ? Number(dec.value) : 0 };
        modifierParams(function (pp) { pp.arbitrages = pp.arbitrages || {}; pp.arbitrages[l.id] = val; });
      }
      st.addEventListener("change", function () { dec.hidden = st.value !== "differe"; enreg(); });
      dec.addEventListener("change", enreg);
      var celMesure = el("td");
      if (l.type === "libre" && !l.modele) {
        var cb = el("input", { type: "checkbox", id: "valide-" + l.id, disabled: edit ? null : "disabled" });
        cb.checked = !!(p.validations || {})[l.id];
        cb.addEventListener("change", function () { modifierParams(function (pp) { pp.validations = pp.validations || {}; pp.validations[l.id] = cb.checked; }); });
        celMesure.appendChild(el("label", { for: cb.id }, [cb, " validé"]));
      }
      var report = M.reportHorsLpm(l, p, IDX);
      cl.appendChild(el("tr", { classe: "arb-ligne" }, [
        el("td", { texte: l.role }),
        el("td", { classe: "statut-" + a.statut, texte: libelleLigne(l) }),
        el("td", { texte: M.armeeDeLigne(l, IDX) }),
        el("td", { classe: "num", texte: md(avant) }),
        el("td", null, [st, " ", dec]),
        el("td", { classe: "num", texte: md(apres) + (report ? " (+" + md(report) + " hors LPM)" : "") }),
        celMesure
      ]));
    });
    tl.appendChild(cl);

    var tr = $("table-renoncements");
    vider(tr);
    var ren = etat.lignes.filter(function (l) { return visible(l) && M.arbitrageDe(l, p).statut === "renonce"; });
    tr.appendChild(el("thead", null, [el("tr", null, ["Rôle", "Objet", "Armée", "Montant renoncé (6 ans)", "Justification du demandeur"].map(function (h, i) { return el("th", { classe: i === 3 ? "num" : "", texte: h }); }))]));
    var cr = el("tbody");
    if (!ren.length) cr.appendChild(el("tr", null, [el("td", { colspan: 5, classe: "vide-etat", texte: "Aucun renoncement pour l'instant." })]));
    var totalRen = 0;
    ren.forEach(function (l) {
      var v = M.coutLigne(l, IDX).total; totalRen += v;
      cr.appendChild(el("tr", null, [el("td", { texte: l.role }), el("td", { texte: libelleLigne(l) }), el("td", { texte: M.armeeDeLigne(l, IDX) }), el("td", { classe: "num", texte: md(v) }), el("td", { texte: l.justification || "" })]));
    });
    tr.appendChild(cr);
    if (ren.length) tr.appendChild(el("tfoot", null, [el("tr", null, [el("td", { colspan: 3, texte: "Total renoncé" }), el("td", { classe: "num", texte: md(totalRen) }), el("td")])]));
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
    etat.lignes.filter(visible).forEach(function (l) {
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
    var lignesVues = etat.vueTable === "arbitrage" ? M.lignesApresArbitrage(etat.lignes, p) : etat.lignes;
    var t = M.placerAnnee(PIONS, lignesVues, p, a);
    var syn = M.synthese(PIONS, lignesVues, p)[a];

    var ch = $("table-chiffres");
    vider(ch);
    [["Cases occupées", t.occupees + " sur " + t.plafond + " autorisées"], ["Montant", md(syn.total)], [syn.marge >= 0 ? "Marge" : "Dépassement", md(Math.abs(syn.marge))]].forEach(function (x, i) {
      ch.appendChild(el("span", { classe: i === 2 ? (syn.marge >= 0 ? "pos" : "neg") : "" }, [x[0] + " : ", el("b", { texte: x[1] })]));
    });

    var pl = $("plateau");
    vider(pl);
    pl.style.gridTemplateRows = "repeat(" + t.hauteur + ", var(--case))";
    // Fond : une case par emplacement, rouge pâle au-delà du plafond, hachurée hors table.
    for (var k = 0; k < t.hauteur * t.largeur; k++) {
      var cl = "fond";
      if (k >= t.table) cl += " fond-horstable";
      else if (k >= t.plafond) cl += " fond-hors";
      pl.appendChild(el("div", { classe: cl, style: "grid-row:" + (Math.floor(k / t.largeur) + 1) + ";grid-column:" + (k % t.largeur + 1) }));
    }
    function depasse(r, c, w, h) {
      for (var i = r; i < r + h; i++) for (var j = c; j < c + w; j++) if (i * t.largeur + j >= t.plafond) return true;
      return false;
    }
    t.pieces.forEach(function (x) {
      var couleur = x.groupe === "Fixes" ? "var(--gris)" : x.nature === "violet" ? "var(--violet)" : couleurArmee(x.armee);
      var classes = ["pion"];
      if (x.niveau === 50) classes.push("pion-50");
      if (depasse(x.r, x.c, x.w, x.h)) classes.push("pion-debord");
      if (x.w * x.h <= 2) classes.push("pion-petit");
      if (x.role && !vueComplete() && x.role !== etat.role) x.libelle = "Demande " + x.armee;
      var titre = x.libelle + " · " + x.armee + " · " + x.cases + " case" + (x.cases > 1 ? "s" : "") + (x.niveau ? " · " + x.niveau + " %" : "") + (x.role && (vueComplete() || x.role === etat.role) ? " · demande " + x.role : "");
      pl.appendChild(el("div", { classe: classes.join(" "), title: titre,
        style: "grid-row:" + (x.r + 1) + " / span " + x.h + ";grid-column:" + (x.c + 1) + " / span " + x.w + ";background:" + couleur }, [
        el("span", { texte: x.libelle.replace(/^Capacité /, "").replace(/^Brigade /, "Bde ") })
      ]));
    });
    t.cellules.forEach(function (x) {
      var classes = ["pion", "pion-case"];
      if (x.nature === "dorese") classes.push("pion-dorese");
      if (x.horsCatalogue) classes.push("pion-mesure");
      if (x.r * t.largeur + x.c >= t.plafond) classes.push("pion-debord");
      if (x.role && !vueComplete() && x.role !== etat.role) x.libelle = x.nature === "dorese" ? "DORESE" : "Demande " + x.armee;
      pl.appendChild(el("div", { classe: classes.join(" "), title: x.libelle + " · " + x.armee + (x.role && (vueComplete() || x.role === etat.role) ? " · demande " + x.role : ""),
        style: "grid-row:" + (x.r + 1) + ";grid-column:" + (x.c + 1) + ";background:" + couleurArmee(x.armee) }, [
        el("span", { texte: x.nature === "dorese" ? { ao: "AO", mco: "M", rh: "RH" }[x.type] : "" })
      ]));
    });

    var lg = $("legende");
    vider(lg);
    function puce(style, classe, texte) { return el("span", null, [el("span", { classe: "puce-legende " + (classe || ""), style: style }), texte]); }
    lg.appendChild(puce("background:var(--gris)", "", "Dépense fixe"));
    lg.appendChild(puce("background:var(--violet)", "", "Investissement"));
    M.ARMEES.forEach(function (arm) { lg.appendChild(puce("background:" + couleurArmee(arm), "", arm)); });
    lg.appendChild(puce("background:var(--terre)", "pion-50", "Capacité à 50 %"));
    lg.appendChild(puce("background:var(--terre)", "pion-dorese", "DORESE (AO, MCO, RH)"));
    lg.appendChild(puce("background:var(--terre)", "pion-mesure", "Pion sur mesure"));
    lg.appendChild(puce("", "fond-hors", "Au-delà du plafond"));
    lg.appendChild(puce("background:var(--marine)", "pion-debord", "Pion au-delà du plafond"));
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
    $("table-vue").addEventListener("change", function () { etat.vueTable = $("table-vue").value; rendreTable(); });
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
