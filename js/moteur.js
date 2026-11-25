// Moteur de calcul STRATEGIKON : aucune dépendance à la page, testable avec Node.
// Unités : les montants sont en M€ ; 1 case = 100 M€ ; 1 pion DORESE = 1 case.
(function (racine) {
  "use strict";

  var CASE = 100; // M€
  var ANNEES = [2027, 2028, 2029, 2030, 2031, 2032];
  var ARMEES = ["Terre", "Marine", "Air et Espace", "Interarmées"];

  // Rôles des joueurs. « armee » = armée imputée par défaut aux lignes saisies.
  var ROLES = [
    { code: "EMAT", nom: "État-major de l'armée de Terre", armee: "Terre" },
    { code: "EMM", nom: "État-major de la Marine", armee: "Marine" },
    { code: "EMAAE", nom: "État-major de l'armée de l'Air et de l'Espace", armee: "Air et Espace" },
    { code: "COCA", nom: "EMA / COCA", armee: "Interarmées" },
    { code: "SC-Plans", nom: "Sous-chef d'état-major Plans", armee: "Interarmées" },
    { code: "CEMA", nom: "Cabinet du CEMA", armee: "Interarmées" },
    { code: "DGRIS", nom: "Direction générale des relations internationales et de la stratégie", armee: "Interarmées" },
    { code: "DGA", nom: "Direction générale de l'armement", armee: "Interarmées" },
    { code: "SGA", nom: "Secrétariat général pour l'administration", armee: "Interarmées" },
    { code: "MINARM", nom: "Cabinet du ministre des Armées", armee: "Interarmées" },
    { code: "MEFR", nom: "Ministère de l'Économie et des Finances", armee: "Interarmées" },
    { code: "MEAE", nom: "Ministère de l'Europe et des Affaires étrangères", armee: "Interarmées" },
    { code: "Animateur", nom: "Animateur de la partie", armee: "Interarmées" }
  ];

  // Types de ligne qu'un acteur peut saisir.
  var TYPES_LIGNE = {
    dorese: "Passer à 100 % (ajout des DORESE)",
    ajout: "Ajouter un pion",
    retrait: "Retirer un pion du socle",
    degrade: "Repasser une capacité à 50 % (retirer ses DORESE)",
    durci: "Durcir une capacité (DORESE au-delà de 100 %)",
    libre: "Option du catalogue ou pion sur mesure"
  };

  function parametresParDefaut() {
    return {
      table: 600, // cases par année (60 Md€)
      plafonds: { 2027: 590, 2028: 580, 2029: 570, 2030: 590, 2031: 590, 2032: 590 }, // cases
      // id de pion orange -> années où il est posé. Photo 2027 : SMV et munitions posés, répétés jusqu'en 2032.
      aleas: { P12: ANNEES.slice(), P13: ANNEES.slice() },
      // Enveloppes internes d'un pôle : les lignes rangées dedans sont payées par l'enveloppe, seul l'excédent pèse en plus.
      enveloppes: ENVELOPPES_DEFAUT.map(function (e) { return JSON.parse(JSON.stringify(e)); })
    };
  }
  var ENVELOPPES_DEFAUT = [{ id: "rd-dga", role: "DGA", nom: "R&D", montant: 900, pion: "P10" }];
  // Contraintes politiques posées d'office (clé : id de ligne, ou « pion:<id> » pour un pion du socle).
  var CONTRAINTES_DEFAUT = { "pion:P12": { etat: "acquise", par: "MINARM" } };

  // Scénarios d'inflation du MEFR (MEFR-03) : perte de pouvoir d'achat en M€ par an, déclenchée par l'animateur.
  var SCENARIOS_INFLATION = {
    stabilisation: { nom: "Stabilisation européenne", montant: 850 },
    conflit: { nom: "Conflit régional prolongé", montant: 1500 },
    energie: { nom: "Choc énergétique", montant: 2800 },
    otan_russie: { nom: "Guerre OTAN-Russie", montant: 4900 }
  };
  // Plateaux hors table à conquérir : propres à chaque partie (params.conquetes), aucun par défaut.
  // Relevé de la table 2032 de la maquette du 25/11, proposé à l'animateur comme point de départ.
  var CONQUETES_RELEVE_2032 = [
    { id: "guerre", nom: "C'est la guerre", montant: 8600 },
    { id: "paix", nom: "C'est pas la guerre", montant: 3100 }
  ];
  function conquetesDe(params) {
    var c = (params || {}).conquetes;
    return (c || []).map(function (x) { return { id: x.id, nom: x.nom, montant: Number(x.montant) || 0, annees: (x.annees || []).map(Number) }; });
  }
  function conquisDe(params, annee) {
    return conquetesDe(params).reduce(function (t, x) { return t + (x.annees.indexOf(annee) !== -1 ? x.montant : 0); }, 0);
  }
  // Surcoûts carburants (MEFR-02), saisis par l'animateur année par année : posés sur la table.
  function carburantsDe(params, annee) { return Math.max(0, Number((((params || {}).carburants) || {})[annee]) || 0); }
  function inflationDe(params, annee) {
    var ia = (params || {}).inflationAnnees;
    if (ia && Object.keys(ia).length) return Math.max(0, Number(ia[annee]) || 0);
    var i = (params || {}).inflation;
    if (!i || !SCENARIOS_INFLATION[i.scenario]) return 0;
    return annee >= (Number(i.debut) || ANNEES[0]) ? SCENARIOS_INFLATION[i.scenario].montant : 0;
  }
  // Plafond effectif d'une année, en M€ : plafond fixé moins l'inflation.
  function plafondMontant(params, annee) {
    return (Number(((params || {}).plafonds || {})[annee]) || 0) * CASE - inflationDe(params, annee) + conquisDe(params, annee);
  }

  function indexPions(pions) {
    var idx = {};
    pions.forEach(function (p) { idx[p.id] = p; });
    return idx;
  }

  function nbDorese(pion) {
    return pion ? pion.dorese.ao + pion.dorese.mco + pion.dorese.rh : 0;
  }

  // Situation de départ (photo 2027) : DORESE déjà posées sur chaque capacité du socle.
  function doreseDepart(pion) {
    var d = (pion && pion.depart) || {};
    return { ao: d.ao || 0, mco: d.mco || 0, rh: d.rh || 0 };
  }
  function nbDepart(pion) { var d = doreseDepart(pion); return d.ao + d.mco + d.rh; }
  // DORESE qui manquent à une capacité du socle pour être à 100 %.
  function doreseManquantes(pion) {
    if (!pion) return { ao: 0, mco: 0, rh: 0 };
    var d = doreseDepart(pion);
    return { ao: Math.max(0, pion.dorese.ao - d.ao), mco: Math.max(0, pion.dorese.mco - d.mco), rh: Math.max(0, pion.dorese.rh - d.rh) };
  }
  function nbManquantes(pion) { var m = doreseManquantes(pion); return m.ao + m.mco + m.rh; }
  // Coût annuel d'un pion du socle tel qu'il est posé au départ.
  function coutSocle(pion) { return pion.cout50 + nbDepart(pion) * CASE; }
  function typesDorese(d) {
    var t = [];
    ["ao", "mco", "rh"].forEach(function (k) { for (var n = 0; n < (d[k] || 0); n++) t.push(k); });
    return t;
  }

  // Le socle : ce qui est posé d'office chaque année (gris, violets, capacités à 50 %,
  // et les pions orange que l'animateur a activés pour l'année).
  function estDansSocle(pion, annee, params) {
    if (pion.type === "orange") {
      var annees = (params.aleas || {})[pion.id] || [];
      return annees.indexOf(annee) !== -1 || annees.indexOf(String(annee)) !== -1;
    }
    return true;
  }

  // Coût unitaire d'une ligne (M€) et DORESE unitaires.
  function unitaire(ligne, idx) {
    var pion = idx[ligne.pion];
    var vide = { cout: 0, dorese: { ao: 0, mco: 0, rh: 0 } };
    switch (ligne.type) {
      case "dorese":
        if (!pion) return vide;
        return { cout: nbManquantes(pion) * CASE, dorese: doreseManquantes(pion) };
      case "ajout":
        if (!pion) return vide;
        if (Number(ligne.niveau) === 100) return { cout: pion.cout100, dorese: copie(pion.dorese) };
        return { cout: pion.cout50, dorese: { ao: 0, mco: 0, rh: 0 } };
      case "degrade":
        if (!pion) return vide;
        var dd = doreseDepart(pion);
        return { cout: -nbDepart(pion) * CASE, dorese: { ao: -dd.ao, mco: -dd.mco, rh: -dd.rh } };
      case "durci":
        if (!pion) return vide;
        var sup = doreseSup(ligne);
        return { cout: (sup.ao + sup.mco + sup.rh) * CASE, dorese: sup };
      case "retrait":
        if (!pion) return vide;
        return { cout: -coutSocle(pion), dorese: { ao: 0, mco: 0, rh: 0 } };
      case "libre":
        return {
          cout: Number(ligne.cout_unitaire) || 0,
          dorese: {
            ao: Number((ligne.dorese || {}).ao) || 0,
            mco: Number((ligne.dorese || {}).mco) || 0,
            rh: Number((ligne.dorese || {}).rh) || 0
          }
        };
      default:
        return vide;
    }
  }

  function copie(d) { return { ao: d.ao, mco: d.mco, rh: d.rh }; }
  // DORESE de sur-dotation d'une ligne « durci » (SCP-03).
  function doreseSup(ligne) {
    var d = (ligne && ligne.dorese_sup) || {};
    return { ao: Math.max(0, Number(d.ao) || 0), mco: Math.max(0, Number(d.mco) || 0), rh: Math.max(0, Number(d.rh) || 0) };
  }

  function quantite(ligne, annee) {
    var q = Number((ligne.qte || {})[annee]) || 0;
    // Un pion du socle n'existe qu'en un exemplaire : on plafonne à 1.
    if (ligne.type === "dorese" || ligne.type === "retrait" || ligne.type === "degrade" || ligne.type === "durci") q = Math.max(0, Math.min(1, q));
    return Math.max(0, q);
  }

  // Coût d'une ligne par année : { 2027: {cout, dorese:{ao,mco,rh}}, ..., total }
  function coutLigne(ligne, idx) {
    var u = unitaire(ligne, idx);
    var res = { total: 0, totalDorese: 0, annees: {} };
    ANNEES.forEach(function (a) {
      var q = quantite(ligne, a);
      var d = { ao: u.dorese.ao * q, mco: u.dorese.mco * q, rh: u.dorese.rh * q };
      var cout = coutFixe(ligne, a);
      cout = cout === null ? u.cout * q : cout;
      res.annees[a] = { cout: cout, dorese: d };
      res.total += cout;
      res.totalDorese += d.ao + d.mco + d.rh;
    });
    return res;
  }

  // Programme en tranches placé sur la trajectoire : montant fixé année par année.
  function coutFixe(ligne, a) {
    var c = ligne.cout_annee;
    if (!c) return null;
    return Number(c[a]) || 0;
  }

  function armeeDeLigne(ligne, idx) {
    if (ligne.armee) return ligne.armee;
    var pion = idx[ligne.pion];
    return pion ? pion.armee : "Interarmées";
  }

  function zeroArmees() {
    var o = {};
    ARMEES.forEach(function (a) { o[a] = 0; });
    return o;
  }

  // Synthèse d'une partie, année par année.
  // filtre(ligne) -> bool permet de ne compter qu'une partie des lignes (ex. un rôle).
  function synthese(pions, lignes, params, filtre) {
    var idx = indexPions(pions);
    params = params || parametresParDefaut();
    var res = {};
    ANNEES.forEach(function (a) {
      var socle = zeroArmees();
      var demandes = zeroArmees();
      pions.forEach(function (p) {
        if (estDansSocle(p, a, params)) socle[p.armee] = (socle[p.armee] || 0) + coutSocle(p);
      });
      if (!filtre) socle["Interarmées"] += carburantsDe(params, a);
      var dorese = { ao: 0, mco: 0, rh: 0 };
      var allie = 0, horsEnveloppe = {};
      lignes.forEach(function (l) {
        if (filtre && !filtre(l)) return;
        var c = coutLigne(l, idx).annees[a];
        dorese.ao += c.dorese.ao; dorese.mco += c.dorese.mco; dorese.rh += c.dorese.rh;
        if (enveloppeDe(l, params)) return; // payé par l'enveloppe : seul l'excédent compte, plus bas
        var f = financements(l, idx, params)[a];
        var arm = armeeDeLigne(l, idx);
        demandes[arm] = (demandes[arm] || 0) + f.cout;
        allie += f.allie + f.subvention;
      });
      // Remboursements d'emprunts UE contractés les années précédentes.
      lignes.forEach(function (l) {
        if (filtre && !filtre(l)) return;
        if (enveloppeDe(l, params)) return;
        var r = remboursements(l, idx, params)[a] || 0;
        if (r) { var arm = armeeDeLigne(l, idx); demandes[arm] = (demandes[arm] || 0) + r; }
      });
      enveloppesDe(params).forEach(function (e) {
        var et = etatEnveloppe(e, pions, lignes.filter(function (l) { return !filtre || filtre(l); }), params, a);
        if (et.depassement > 0) {
          var arm = (idx[e.pion] || {}).armee || "Interarmées";
          demandes[arm] = (demandes[arm] || 0) + et.depassement;
          horsEnveloppe[e.id] = et.depassement;
        }
      });
      var totalSocle = somme(socle);
      var totalDemandes = somme(demandes);
      var plafond = plafondMontant(params, a);
      var total = totalSocle + totalDemandes;
      res[a] = {
        annee: a,
        socle: socle,
        demandes: demandes,
        totalSocle: totalSocle,
        totalDemandes: totalDemandes,
        total: total,
        plafond: plafond,
        table: (Number(params.table) || 600) * CASE,
        marge: plafond - total,
        dorese: dorese,
        allie: allie,
        depassementsEnveloppes: horsEnveloppe
      };
    });
    return res;
  }

  function somme(o) {
    return Object.keys(o).reduce(function (s, k) { return s + o[k]; }, 0);
  }

  // Remplissage de la grille d'une année : renvoie une liste de blocs
  // { armee, nature: 'gris'|'violet'|'orange'|'capacite'|'dorese'|'libre'|'retrait', libelle, cases }
  // dans l'ordre de pose. Les DORESE suivent immédiatement leur capacité (règle « Au contact »).
  function blocsAnnee(pions, lignes, params, annee) {
    var idx = indexPions(pions);
    var blocs = [];
    var retires = {};
    var passes100 = {}, degrades = {};
    lignes.forEach(function (l) {
      var q = quantite(l, annee);
      if (!q) return;
      if (l.type === "retrait") retires[l.pion] = true;
      if (l.type === "dorese") passes100[l.pion] = l;
      if (l.type === "degrade") degrades[l.pion] = l;
    });
    var ordreType = { gris: 0, violet: 1, orange: 2, capacite: 3 };
    var socle = pions.filter(function (p) { return estDansSocle(p, annee, params) && !retires[p.id]; });
    // Fixes d'abord, puis armée par armée.
    socle.sort(function (a, b) {
      var fa = a.type === "gris" ? 0 : 1, fb = b.type === "gris" ? 0 : 1;
      if (fa !== fb) return fa - fb;
      var aa = ARMEES.indexOf(a.armee), ab = ARMEES.indexOf(b.armee);
      if (aa !== ab) return aa - ab;
      return ordreType[a.type] - ordreType[b.type];
    });
    socle.forEach(function (p) {
      var dg = !!degrades[p.id] && !passes100[p.id];
      var plein = p.type === "capacite" && nbManquantes(p) === 0 && !dg;
      blocs.push({ armee: p.armee, nature: p.type, libelle: p.nom, cases: p.cout50 / CASE, niveau: plein || passes100[p.id] ? 100 : 50 });
      if (nbDepart(p) && !dg) blocs.push({ armee: p.armee, nature: "dorese", libelle: "DORESE " + p.nom, cases: nbDepart(p) });
      if (passes100[p.id] && nbManquantes(p)) {
        blocs[blocs.length - 1 - (nbDepart(p) ? 1 : 0)].niveau = 100;
        blocs.push({ armee: armeeDeLigne(passes100[p.id], idx), nature: "dorese", libelle: "DORESE " + p.nom, cases: nbManquantes(p) });
      }
    });
    lignes.forEach(function (l) {
      var q = quantite(l, annee);
      if (!q || l.type === "dorese" || l.type === "retrait" || l.type === "degrade" || l.type === "durci") return;
      var arm = armeeDeLigne(l, idx);
      if (l.type === "ajout") {
        var p = idx[l.pion];
        if (!p) return;
        for (var i = 0; i < q; i++) {
          blocs.push({ armee: arm, nature: "capacite", libelle: "+ " + p.nom, cases: p.cout50 / CASE, niveau: Number(l.niveau), role: l.role });
          if (Number(l.niveau) === 100 && nbDorese(p)) {
            blocs.push({ armee: arm, nature: "dorese", libelle: "DORESE + " + p.nom, cases: nbDorese(p), role: l.role });
          }
        }
      } else if (l.type === "libre") {
        var c = (Number(l.cout_unitaire) || 0) * q / CASE;
        if (c > 0) blocs.push({ armee: arm, nature: "libre", libelle: l.libelle || "Ligne libre", cases: Math.round(c), role: l.role });
      }
    });
    return blocs;
  }


  // ---------- Placement sur la table (grille de 30 colonnes) ----------
  // Pose les pions avec leur forme réelle, groupe par groupe (dépenses fixes, puis chaque armée).
  // Pions rigides : socle et pions ajoutés (largeur x hauteur, rotation permise).
  // Les DORESE d'une capacité à 100 % sont posées au contact de la capacité.
  // Les montants libres (investissements, options, pions sur mesure) sont sécables :
  // ils comblent les cases restantes de leur groupe.
  var LARGEUR = 30;
  // « Attente » : les pions ajoutés qui n'ont pas encore été arbitrés, posés côte à côte après le socle.
  var ORDRE_GROUPES = ["Fixes", "Interarmées", "Terre", "Marine", "Air et Espace", "Attente"];
  // Table « en paquets » : chaque entité forme un bloc compact, les blocs s'imbriquent sur la table.
  var ORDRE_ZONES = ["Terre", "Marine", "Air et Espace", "Interarmées", "DGA", "International", "SGA", "MEFR", "MINARM", "Fixes"];
  var ENTITE_DU_ROLE = { EMAT: "Terre", EMM: "Marine", EMAAE: "Air et Espace", DGA: "DGA", DGRIS: "International", MEAE: "International",
    SGA: "SGA", MEFR: "MEFR", MINARM: "MINARM", COCA: "Interarmées", "SC-Plans": "Interarmées", CEMA: "Interarmées", Animateur: "Interarmées" };

  function Plateau(lignesInit, largeur) {
    this.l = largeur || LARGEUR;
    this.h = lignesInit;
    this.occ = [];
    for (var i = 0; i < this.l * this.h; i++) this.occ.push(null);
  }
  Plateau.prototype.agrandir = function (n) {
    for (var i = 0; i < n * this.l; i++) this.occ.push(null);
    this.h += n;
  };
  Plateau.prototype.libre = function (r, c) {
    return r >= 0 && c >= 0 && c < this.l && r < this.h && this.occ[r * this.l + c] === null;
  };
  Plateau.prototype.tient = function (r, c, w, h) {
    if (c + w > this.l || r + h > this.h) return false;
    for (var i = r; i < r + h; i++) for (var j = c; j < c + w; j++) if (!this.libre(i, j)) return false;
    return true;
  };
  Plateau.prototype.marquer = function (r, c, w, h, id) {
    for (var i = r; i < r + h; i++) for (var j = c; j < c + w; j++) this.occ[i * this.l + j] = id;
  };
  // Première position libre (haut-gauche d'abord) à partir de la rangée r0.
  Plateau.prototype.chercher = function (w, h, r0) {
    for (;;) {
      for (var r = r0; r < this.h; r++) {
        for (var c = 0; c < this.l; c++) {
          if (this.tient(r, c, w, h)) return { r: r, c: c, w: w, h: h };
          if (w !== h && this.tient(r, c, h, w)) return { r: r, c: c, w: h, h: w };
        }
      }
      this.agrandir(Math.max(h, w > this.l ? 1 : 1));
      if (w > this.l && h > this.l) return null;
    }
  };
  Plateau.prototype.apresDerniereLigne = function () {
    for (var k = this.occ.length - 1; k >= 0; k--) if (this.occ[k] !== null) return Math.floor(k / this.l) + 1;
    return 0;
  };
  Plateau.prototype.premiereLigneLibre = function () {
    for (var k = 0; k < this.occ.length; k++) if (this.occ[k] === null) return Math.floor(k / this.l);
    return this.h;
  };

  // filtreSocle(pion) -> bool (facultatif) : ne pose que ces pions du socle (vue « ma demande »).
  // options.apresArbitrage : les lignes sont déjà arbitrées (différés décalés), seules les « en attente » restent à part.
  function placerAnnee(pions, lignes, params, annee, filtreSocle, options) {
    options = options || {};
    function statutDe(l) {
      var st = arbitrageDe(l, params).statut;
      if (st === "retenu") return null;
      if (options.apresArbitrage && st !== "attente") return null;
      return st;
    }
    var idx = indexPions(pions);
    params = params || parametresParDefaut();
    var tableCases = Number(params.table) || 600;
    var plateau = new Plateau(Math.ceil(tableCases / LARGEUR));
    var pieces = [];
    var retires = {}, passes100 = {}, degrades = {}, durcis = {};
    lignes.forEach(function (l) {
      if (!quantite(l, annee)) return;
      if (l.type === "retrait") retires[l.pion] = true;
      if (l.type === "dorese") passes100[l.pion] = l;
      if (l.type === "degrade") degrades[l.pion] = l;
      if (l.type === "durci") durcis[l.pion] = l;
    });

    // Constitution des groupes.
    var groupes = {};
    var enZones = !!options.zones;
    ORDRE_GROUPES.concat(ORDRE_ZONES).forEach(function (g) { groupes[g] = groupes[g] || { rigides: [], secables: [] }; });
    function groupe(nom) { return groupes[nom] || groupes["Interarmées"]; }
    pions.forEach(function (p) {
      if (!estDansSocle(p, annee, params) || retires[p.id]) return;
      if (filtreSocle && !filtreSocle(p)) return;
      var l100 = passes100[p.id] && nbManquantes(p) ? passes100[p.id] : null;
      var g = p.type === "gris" ? "Fixes" : (l100 ? armeeDeLigne(l100, idx) : p.armee);
      var dg = degrades[p.id] && !passes100[p.id] ? degrades[p.id] : null;
      var types = (dg ? [] : typesDorese(doreseDepart(p))).concat(l100 ? typesDorese(doreseManquantes(p)) : []);
      var plein = types.length >= nbDorese(p);
      // Sources des DORESE ajoutées (renforcement puis durcissement), dans l'ordre des types.
      var sources = (l100 ? typesDorese(doreseManquantes(p)) : []).map(function () { return { ligne: l100.id, role: l100.role, statut: statutDe(l100) }; });
      var ld = durcis[p.id] && !dg ? durcis[p.id] : null;
      if (ld) {
        var tsup = typesDorese(doreseSup(ld));
        types = types.concat(tsup);
        tsup.forEach(function () { sources.push({ ligne: ld.id, role: ld.role, statut: statutDe(ld) }); });
      }
      groupe(g).rigides.push({ pion: p, w: p.l || 1, h: p.h || 1, armee: g === "Fixes" ? p.armee : g, nature: p.type,
        libelle: p.nom, niveau: plein ? 100 : 50, dorese: types.length, types: types, socle: true,
        nDepart: dg ? 0 : nbDepart(p), ligneDorese: l100 ? l100.id : null, roleDorese: l100 ? l100.role : null, degrade: dg ? dg.id : null,
        statutDorese: l100 ? statutDe(l100) : null, contrainte: contrainteAcquise("pion:" + p.id, params), sources: sources, durci: ld ? ld.id : null });
    });
    lignes.forEach(function (l) {
      var q = quantite(l, annee);
      if (!q || l.type === "dorese" || l.type === "retrait" || l.type === "degrade" || l.type === "durci") return;
      if (enveloppeDe(l, params)) return; // dans l'enveloppe de son pôle : seul l'excédent est posé
      var arm = armeeDeLigne(l, idx);
      var st = statutDe(l);
      var dest = enZones ? (ENTITE_DU_ROLE[l.role] || arm) : st ? "Attente" : arm;
      var fin = financementDe(l, params);
      var marques = { part: partFrancaise(l, idx, params, annee), financement: fin.mode !== "national" ? fin.mode : null, financementActif: financementActif(l, params),
        defection: defectionDe(l, params), contrainte: contrainteAcquise(l.id, params), contrainteDemandee: !!(contrainteDe(l.id, params) && !contrainteAcquise(l.id, params)) };
      if (l.type === "ajout") {
        var p = idx[l.pion];
        if (!p) return;
        for (var i = 0; i < q; i++) {
          var cent = Number(l.niveau) === 100;
          groupe(dest).rigides.push({ pion: p, w: p.l || 1, h: p.h || 1, armee: arm, nature: p.type, libelle: "+ " + p.nom,
            niveau: cent ? 100 : 50, dorese: cent ? nbDorese(p) : 0, detailDorese: p.dorese, role: l.role, ligne: l.id, statut: st, marques: marques });
        }
      } else if (l.type === "libre") {
        var fixe = coutFixe(l, annee);
        var n = Math.round((fixe === null ? (Number(l.cout_unitaire) || 0) * q : fixe) / CASE);
        if (n > 0) groupe(dest).secables.push({ cases: n, armee: arm, nature: "libre", libelle: l.libelle || "Ligne libre", role: l.role, ligne: l.id, horsCatalogue: !l.modele, statut: st, marques: marques });
      }
    });
    // Surcoûts carburants (MEFR-02) : posés comme une dépense fixe de l'année.
    var nCarb = Math.round(carburantsDe(params, annee) / CASE);
    if (nCarb > 0 && !filtreSocle) groupe("Fixes").secables.push({ cases: nCarb, armee: "Interarmées", nature: "libre", libelle: "Surcoût carburants (MEFR-02)", role: null, ligne: null, carburant: true, statut: null });
    // Excédent des enveloppes internes : posé comme un montant sécable, au nom de l'enveloppe.
    enveloppesDe(params).forEach(function (e) {
      var et = etatEnveloppe(e, pions, lignes, params, annee);
      var n = Math.ceil(et.depassement / CASE);
      if (n > 0) {
        var arm = (idx[e.pion] || {}).armee || "Interarmées";
        groupe(enZones ? (ENTITE_DU_ROLE[e.role] || arm) : arm).secables.push({ cases: n, armee: arm, nature: "libre", libelle: "Excédent enveloppe " + e.nom + " (" + e.role + ")", role: e.role, ligne: null, enveloppe: e.id, statut: null });
      }
    });

    var cellules = []; // cases isolées : DORESE et montants sécables
    var zones = [];
    function placerGroupe(plateau, nomG, r0, rMin) {
      var g = groupes[nomG];
      g.rigides.sort(function (a, b) { return (b.w * b.h + b.dorese) - (a.w * a.h + a.dorese) || b.w - a.w; });
      g.rigides.forEach(function (it) {
        var id = pieces.length;
        var pos;
        // Avec DORESE : on cherche d'abord une place pour la capacité et ses DORESE en bande à droite.
        if (it.dorese) {
          var col = Math.ceil(it.dorese / it.h);
          pos = null;
          for (var r = r0; r < plateau.h && !pos; r++) {
            for (var c = 0; c < plateau.l; c++) {
              if (plateau.tient(r, c, it.w + col, it.h)) { pos = { r: r, c: c, w: it.w, h: it.h }; break; }
            }
          }
          if (!pos) pos = plateau.chercher(it.w, it.h, r0);
        } else {
          pos = plateau.chercher(it.w, it.h, r0);
        }
        plateau.marquer(pos.r, pos.c, pos.w, pos.h, id);
        pieces.push({ r: pos.r, c: pos.c, w: pos.w, h: pos.h, armee: it.armee, nature: it.nature, libelle: it.libelle,
          pion: it.pion ? it.pion.id : null, ligne: it.ligne || null, socle: !!it.socle, ligneDorese: it.ligneDorese || null, degrade: it.degrade || null,
          niveau: it.nature === "capacite" ? it.niveau : null, role: it.role || null, groupe: nomG, cases: pos.w * pos.h, statut: it.statut || null, durci: it.durci || null,
          marques: it.marques || (it.contrainte ? { contrainte: true, part: 1 } : null) });
        // DORESE au contact : cases libres voisines de la capacité (ou de ses DORESE déjà posées).
        var types = it.types || typesDorese(it.detailDorese || {});
        var amas = [{ r: pos.r, c: pos.c, w: pos.w, h: pos.h }];
        types.slice(0, it.dorese).forEach(function (t, n) {
          var ajoutee = it.socle && n >= (it.nDepart || 0);
          var src = ajoutee && it.sources ? it.sources[n - (it.nDepart || 0)] : null;
          var cand = voisinLibre(plateau, amas, rMin);
          if (!cand) { var p2 = plateau.chercher(1, 1, r0); cand = { r: p2.r, c: p2.c, loin: true }; }
          plateau.marquer(cand.r, cand.c, 1, 1, "d" + id);
          amas.push({ r: cand.r, c: cand.c, w: 1, h: 1 });
          cellules.push({ r: cand.r, c: cand.c, armee: it.armee, nature: "dorese", type: t, libelle: "DORESE " + t.toUpperCase() + " · " + it.libelle,
            role: src ? src.role : ajoutee ? it.roleDorese : (it.role || null), loin: !!cand.loin, parent: id, ligne: src ? src.ligne : ajoutee ? it.ligneDorese : (it.ligne || null),
            groupe: nomG, statut: src ? (src.statut || null) : ajoutee ? (it.statutDorese || null) : (it.statut || null) });
        });
      });
      // Montants sécables : premier trou libre du groupe, puis cases voisines pour garder le bloc d'un seul tenant.
      g.secables.forEach(function (it) {
        var amas = [];
        var francaises = it.marques ? Math.round(it.cases * it.marques.part) : it.cases;
        for (var n = 0; n < it.cases; n++) {
          var cand = amas.length ? voisinLibre(plateau, amas, rMin) : null;
          if (!cand) {
            var k = r0 * plateau.l;
            while (true) {
              if (k >= plateau.occ.length) plateau.agrandir(1);
              if (plateau.occ[k] === null) break;
              k++;
            }
            cand = { r: Math.floor(k / plateau.l), c: k % plateau.l };
          }
          plateau.marquer(cand.r, cand.c, 1, 1, "s");
          amas.push({ r: cand.r, c: cand.c, w: 1, h: 1 });
          cellules.push({ r: cand.r, c: cand.c, armee: it.armee, nature: "libre", libelle: it.libelle, role: it.role, horsCatalogue: it.horsCatalogue, ligne: it.ligne, groupe: nomG, statut: it.statut || null,
            marques: it.marques || null, allie: n >= francaises, enveloppe: it.enveloppe || null, carburant: !!it.carburant });
        }
      });
    }

    if (!enZones) {
      ORDRE_GROUPES.forEach(function (nomG) {
        var g = groupes[nomG];
        if (!g.rigides.length && !g.secables.length) return;
        // La zone « Attente » commence sous tout le reste, pour rester à part (une ligne vide pour son titre).
        var r0 = nomG === "Attente" ? plateau.apresDerniereLigne() + 1 : plateau.premiereLigneLibre();
        placerGroupe(plateau, nomG, r0, nomG === "Attente" ? r0 : 0);
      });
    } else {
      // Chaque entité est posée sur sa propre petite table, de largeur adaptée à son volume,
      // puis les blocs sont imbriqués sur la grande table, en haut à gauche d'abord.
      var global = new Plateau(1);
      ORDRE_ZONES.forEach(function (nomG) {
        var g = groupes[nomG];
        if (!g.rigides.length && !g.secables.length) return;
        var cases = 0, minW = 1;
        g.rigides.forEach(function (it) { cases += it.w * it.h + it.dorese; minW = Math.max(minW, Math.min(it.w, it.h) + Math.ceil(it.dorese / Math.max(it.w, it.h))); });
        g.secables.forEach(function (it) { cases += it.cases; });
        var w = Math.min(LARGEUR - 1, Math.max(minW, Math.max(...g.rigides.map(function (it) { return Math.max(it.w, it.h); }).concat([1])), Math.ceil(Math.sqrt(cases * 1.6)), 6));
        var local = new Plateau(1, w);
        var p0 = pieces.length, c0 = cellules.length;
        placerGroupe(local, nomG, 0, 0);
        var h = local.apresDerniereLigne();
        // Emplacement du bloc (titre + contenu + une case d'écart) : première place libre.
        var W = Math.min(LARGEUR, w + 1), H = h + 2, pos = null;
        for (var r = 0; !pos; r++) {
          if (r + H > global.h) global.agrandir(r + H - global.h);
          for (var c = 0; c + w <= LARGEUR && !pos; c++) if (global.tient(r, c, Math.min(W, LARGEUR - c), H)) pos = { r: r, c: c };
        }
        global.marquer(pos.r, pos.c, Math.min(W, LARGEUR - pos.c), H, nomG);
        for (var k = p0; k < pieces.length; k++) { pieces[k].r += pos.r + 1; pieces[k].c += pos.c; }
        for (var k2 = c0; k2 < cellules.length; k2++) { cellules[k2].r += pos.r + 1; cellules[k2].c += pos.c; }
        var occ = local.occ.filter(function (x) { return x !== null; }).length;
        zones.push({ nom: nomG, r: pos.r, c: pos.c, w: w, h: h + 1, cases: occ });
      });
      plateau = { h: global.apresDerniereLigne(), occ: [] };
      zones.forEach(function (z) { for (var i = 0; i < z.cases; i++) plateau.occ.push(1); });
    }

    return {
      zones: zones,
      largeur: LARGEUR,
      hauteur: Math.max(plateau.h, Math.ceil(tableCases / LARGEUR)),
      table: tableCases,
      plafond: Math.floor(plafondMontant(params, annee) / CASE),
      // Cases payées par la France : la part alliée (hachurée) ne compte pas.
      occupees: plateau.occ.filter(function (x) { return x !== null; }).length
        - cellules.filter(function (x) { return x.allie; }).length
        - pieces.reduce(function (s2, x) { return s2 + (x.marques && x.marques.part < 1 ? Math.round(x.cases * (1 - x.marques.part)) : 0); }, 0),
      pieces: pieces,
      cellules: cellules
    };
  }

  function voisinLibre(plateau, amas, rMin) {
    var meilleur = null;
    amas.forEach(function (b) {
      for (var r = b.r - 1; r <= b.r + b.h; r++) {
        for (var c = b.c - 1; c <= b.c + b.w; c++) {
          var bord = (r === b.r - 1 || r === b.r + b.h) !== (c === b.c - 1 || c === b.c + b.w); // côté, pas coin
          if (!bord || r < (rMin || 0) || !plateau.libre(r, c)) continue;
          if (!meilleur || r * plateau.l + c < meilleur.r * plateau.l + meilleur.c) meilleur = { r: r, c: c };
        }
      }
    });
    return meilleur;
  }


  // ---------- Arbitrage CEMA ----------
  // params.arbitrages[idLigne] = { statut: 'attente'|'retenu'|'differe'|'renonce', decalage: n }
  var STATUTS = { attente: "En attente", retenu: "Retenu", differe: "Différé", renonce: "Renoncé" };

  function arbitrageDe(ligne, params) {
    if (contrainteAcquise(ligne.id, params)) return { statut: "retenu", decalage: 0, contrainte: true };
    var a = ((params || {}).arbitrages || {})[ligne.id];
    return a && STATUTS[a.statut] ? a : { statut: "attente", decalage: 0 };
  }

  // Ligne telle qu'elle pèse après arbitrage (null si renoncée). Un différé décale les années ;
  // ce qui sort de la période est reporté hors LPM.
  function ligneArbitree(ligne, params) {
    var a = arbitrageDe(ligne, params);
    if (a.statut === "renonce") return null;
    if (a.statut !== "differe" || !Number(a.decalage)) return ligne;
    var n = Number(a.decalage), qte = {};
    ANNEES.forEach(function (an) {
      var q = (ligne.qte || {})[an];
      if (q && ANNEES.indexOf(an + n) !== -1) qte[an + n] = (qte[an + n] || 0) + Number(q);
    });
    var copie = JSON.parse(JSON.stringify(ligne));
    copie.qte = qte;
    return copie;
  }

  function lignesApresArbitrage(lignes, params) {
    return lignes.map(function (l) { return ligneArbitree(l, params); }).filter(Boolean);
  }

  // Montant reporté au-delà de 2032 par un différé (M€).
  function reportHorsLpm(ligne, params, idx) {
    var a = arbitrageDe(ligne, params);
    if (a.statut !== "differe") return 0;
    var avant = coutLigne(ligne, idx).total;
    var apres = coutLigne(ligneArbitree(ligne, params), idx).total;
    return avant - apres;
  }

  // Arrondi d'un prix à la case de 100 M€ (au moins une case).
  function arrondiCase(m) {
    var n = Number(m) || 0;
    if (n <= 0) return 0;
    return Math.max(CASE, Math.round(n / CASE) * CASE);
  }

  // ---------- Priorités, contraintes politiques ----------
  // Le pôle fixe sa priorité (ligne.priorite, 1 à 4) ; le CEMA peut la modifier (params.priorites) :
  // les deux valeurs sont gardées. Les autres pôles proposent (params.propositions[id] = [{role, p}]).
  var PRIORITES = [1, 2, 3, 4];
  function prioriteDe(ligne, params) {
    var pole = Number(ligne.priorite) || null;
    var cema = Number(((params || {}).priorites || {})[ligne.id]) || null;
    return { pole: pole, cema: cema, valeur: cema || pole || 4, fixee: !!(cema || pole), propositions: ((params || {}).propositions || {})[ligne.id] || [] };
  }
  // Contrainte politique : « demandee » par un pôle, « acquise » quand MINARM ou l'animateur la cochent.
  function contrainteDe(cle, params) {
    var c = ((params || {}).contraintes || {});
    if (Object.prototype.hasOwnProperty.call(c, cle)) return c[cle] && c[cle].etat ? c[cle] : null;
    return CONTRAINTES_DEFAUT[cle] || null;
  }
  function contrainteAcquise(cle, params) { var c = contrainteDe(cle, params); return !!(c && c.etat === "acquise"); }
  // Ordre d'empilement : contraintes politiques d'abord, puis P1 à P4, puis ancienneté.
  function rangEmpilement(ligne, params) { return contrainteAcquise(ligne.id, params) ? 0 : prioriteDe(ligne, params).valeur; }
  function comparerEmpilement(params) {
    return function (a, b) { return rangEmpilement(a, params) - rangEmpilement(b, params) || ((a.cree_le || "") < (b.cree_le || "") ? -1 : (a.cree_le || "") > (b.cree_le || "") ? 1 : 0); };
  }

  // ---------- Modes de financement ----------
  // params.financements[id] = { mode: 'national'|'mutualise'|'subvention'|'pret', part, partenaires, propose_par, valide }
  // mutualise : part = part française (%) ; subvention : part subventionnée (%) ; pret : part empruntée (%), remboursée sur 3 ans.
  var MODES_FINANCEMENT = { national: "National", mutualise: "Mutualisé avec des alliés", subvention: "Subvention UE", pret: "Prêt UE" };
  var DUREE_REMBOURSEMENT = 3;
  function financementDe(ligne, params) {
    var f = ((params || {}).financements || {})[ligne.id];
    return f && MODES_FINANCEMENT[f.mode] ? f : { mode: "national" };
  }
  function defectionDe(ligne, params) { return !!(((params || {}).defections || {})[ligne.id]); }
  // Le montage ne joue qu'une fois validé par l'animateur, et tant que l'allié tient.
  function financementActif(ligne, params) {
    var f = financementDe(ligne, params);
    return f.mode !== "national" && !!f.valide && !defectionDe(ligne, params);
  }
  // Par année : brut (coût plein), cout (part payée par la France cette année), allie, subvention, emprunt.
  function financements(ligne, idx, params) {
    var c = coutLigne(ligne, idx);
    var f = financementDe(ligne, params);
    var actif = financementActif(ligne, params);
    var part = Math.max(0, Math.min(100, Number(f.part) || 0));
    var res = {};
    ANNEES.forEach(function (a) {
      var brut = c.annees[a].cout;
      var o = { brut: brut, cout: brut, allie: 0, subvention: 0, emprunt: 0 };
      if (actif && brut > 0) {
        if (f.mode === "mutualise") { o.cout = Math.round(brut * part / 100); o.allie = brut - o.cout; }
        else if (f.mode === "subvention") { o.subvention = Math.round(brut * part / 100); o.cout = brut - o.subvention; }
        else if (f.mode === "pret") { o.emprunt = Math.round(brut * part / 100); o.cout = brut - o.emprunt; }
      }
      res[a] = o;
    });
    return res;
  }
  // Remboursement des prêts UE : par parts égales les 3 années suivantes ; au-delà de 2032, hors LPM (clé « hors »).
  function remboursements(ligne, idx, params) {
    var res = { hors: 0 };
    if (!financementActif(ligne, params) || financementDe(ligne, params).mode !== "pret") return res;
    var f = financements(ligne, idx, params);
    ANNEES.forEach(function (a) {
      var e = f[a].emprunt;
      if (!e) return;
      var base = Math.floor(e / DUREE_REMBOURSEMENT), reste = e - base * DUREE_REMBOURSEMENT;
      for (var k = 1; k <= DUREE_REMBOURSEMENT; k++) {
        var m = base + (k === DUREE_REMBOURSEMENT ? reste : 0);
        if (ANNEES.indexOf(a + k) !== -1) res[a + k] = (res[a + k] || 0) + m;
        else res.hors += m;
      }
    });
    return res;
  }
  // Part de la ligne comptée pour la France une année donnée (1 = tout).
  function partFrancaise(ligne, idx, params, annee) {
    var f = financements(ligne, idx, params)[annee];
    return f.brut > 0 ? f.cout / f.brut : 1;
  }

  // ---------- Enveloppes internes ----------
  function enveloppesDe(params) {
    var e = (params || {}).enveloppes;
    return Array.isArray(e) ? e : ENVELOPPES_DEFAUT;
  }
  function enveloppeDe(ligne, params) {
    if (!ligne.enveloppe) return null;
    return enveloppesDe(params).filter(function (e) { return e.id === ligne.enveloppe; })[0] || null;
  }
  // Ce qui tient dans l'enveloppe une année : lignes rangées par priorité, cumul, excédent.
  function etatEnveloppe(env, pions, lignes, params, annee) {
    var idx = indexPions(pions);
    var montant = Number(env.montant) || 0;
    var dedans = lignes.filter(function (l) { return l.enveloppe === env.id && arbitrageDe(l, params).statut !== "renonce"; }).sort(comparerEmpilement(params));
    var cumul = 0;
    var items = [];
    dedans.forEach(function (l) {
      var c = financements(l, idx, params)[annee].cout;
      if (!c) return;
      cumul += c;
      items.push({ ligne: l, cout: c, cumul: cumul, tient: cumul <= montant });
    });
    return { enveloppe: env, montant: montant, items: items, total: cumul, depassement: Math.max(0, cumul - montant), reste: Math.max(0, montant - cumul) };
  }

  // ---------- Ligne de flottaison ----------
  // Base : le socle et les économies (dissolutions, repassages à 50 %). On empile ensuite les demandes :
  // contraintes politiques, puis P1 à P4. Ce qui passe sous le plafond est à abandonner ou différer.
  function flottaison(pions, lignes, params, annee) {
    var idx = indexPions(pions);
    params = params || parametresParDefaut();
    var base = 0;
    pions.forEach(function (p) { if (estDansSocle(p, annee, params)) base += coutSocle(p); });
    base += carburantsDe(params, annee);
    var items = [];
    lignes.forEach(function (l) {
      if (arbitrageDe(l, params).statut === "renonce" || enveloppeDe(l, params)) return;
      var c = financements(l, idx, params)[annee].cout + (remboursements(l, idx, params)[annee] || 0);
      if (!c) return;
      if (c < 0) { base += c; return; }
      items.push({ ligne: l, cout: c, rang: rangEmpilement(l, params), contrainte: contrainteAcquise(l.id, params) });
    });
    items.sort(function (a, b) { return comparerEmpilement(params)(a.ligne, b.ligne); });
    enveloppesDe(params).forEach(function (e) {
      var et = etatEnveloppe(e, pions, lignes, params, annee);
      if (!et.depassement) return;
      var rang = et.items.reduce(function (m, it) { return Math.min(m, rangEmpilement(it.ligne, params)); }, 4);
      var it = { enveloppe: e, cout: et.depassement, rang: rang, contrainte: false };
      var k = 0;
      while (k < items.length && items[k].rang <= rang) k++;
      items.splice(k, 0, it);
    });
    var plafond = plafondMontant(params, annee);
    var cumul = base;
    items.forEach(function (it) { cumul += it.cout; it.cumul = cumul; it.sous = cumul > plafond; });
    return { annee: annee, base: base, plafond: plafond, items: items, total: cumul, marge: plafond - cumul,
      sous: items.filter(function (it) { return it.sous; }) };
  }

  // ---------- Parcours : modèle 2032, puis trajectoire ----------
  // Une ligne « cible » est posée sur le modèle 2032. Sur la trajectoire, params.debuts[id] fixe son année
  // d'entrée : elle est alors présente de cette année à 2032 ; un programme en tranches (ligne.tranches,
  // N1, N2…) paie N1 l'année d'entrée, N2 l'année suivante, etc. 2033 = au-delà de la LPM.
  var APRES_LPM = ANNEES[ANNEES.length - 1] + 1;
  function debutDe(ligne, params) {
    var d = ((params || {}).debuts || {})[ligne.id];
    return d === undefined || d === null ? null : Number(d);
  }
  function tranchesDe(ligne) {
    return (Array.isArray(ligne.tranches) ? ligne.tranches : []).map(Number).filter(function (x) { return x > 0; });
  }
  // Retrait d'une capacité (SCP-05) : le pion reste payé 2 ans (3 si réglé ainsi) après la décision.
  function delaiRetrait(params) { return Number((params || {}).delaiRetrait) === 3 ? 3 : 2; }
  function anneeDecisionRetrait(ligne, params) {
    if (ligne.cible) { var d = debutDe(ligne, params); return d === null ? ANNEES[0] : d; }
    for (var k = 0; k < ANNEES.length; k++) if (Number((ligne.qte || {})[ANNEES[k]]) > 0) return ANNEES[k];
    return null;
  }
  function ligneEffective(ligne, params) {
    var c = ligneEffectiveBrute(ligne, params);
    if (ligne.type !== "retrait") return c;
    var dec = anneeDecisionRetrait(ligne, params);
    if (dec === null) return c;
    var effet = dec + delaiRetrait(params);
    if (!ANNEES.some(function (a) { return a < effet && Number((c.qte || {})[a]) > 0; })) return c;
    var r = JSON.parse(JSON.stringify(c));
    ANNEES.forEach(function (a) { if (a < effet) r.qte[a] = 0; });
    r.retraitDecide = dec; r.retraitEffet = effet;
    return r;
  }
  function ligneEffectiveBrute(ligne, params) {
    if (!ligne.cible) return ligne;
    var d = debutDe(ligne, params);
    var tr = tranchesDe(ligne);
    var fin = ANNEES[ANNEES.length - 1];
    var q = Number((ligne.qte || {})[fin]) || 1;
    var c = JSON.parse(JSON.stringify(ligne));
    c.qte = {};
    ANNEES.forEach(function (a) { c.qte[a] = 0; });
    c.horsLpm = 0;
    if (d === null) {
      // Pas encore placée sur la trajectoire : elle ne figure qu'au modèle 2032.
      c.qte[fin] = q;
      if (tr.length) { c.cout_annee = {}; c.cout_annee[fin] = tr[0]; }
      return c;
    }
    if (tr.length) {
      c.cout_annee = {};
      tr.forEach(function (m, k) {
        if (d + k <= fin) { c.cout_annee[d + k] = m; c.qte[d + k] = 1; } else c.horsLpm += m;
      });
    } else {
      ANNEES.forEach(function (a) { if (a >= d) c.qte[a] = q; });
    }
    return c;
  }
  function lignesEnTrajectoire(lignes, params) {
    return lignes.map(function (l) { return ligneEffective(l, params); });
  }
  // Étalement automatique : on place les lignes cibles retenues par ordre d'empilement, chacune à la
  // première année d'entrée qui tient sous le plafond jusqu'en 2032 ; ce qui ne tient jamais glisse après 2032.
  function etalerAuto(pions, lignes, params) {
    var idx = indexPions(pions);
    var autres = lignesApresArbitrage(lignes.filter(function (l) { return !l.cible; }), params);
    var syn = synthese(pions, autres, params);
    var charge = {}, plafond = {};
    ANNEES.forEach(function (a) { charge[a] = syn[a].total; plafond[a] = syn[a].plafond; });
    var debuts = {}, horsLpm = [];
    var cibles = lignes.filter(function (l) { return l.cible && arbitrageDe(l, params).statut === "retenu"; }).sort(comparerEmpilement(params));
    cibles.forEach(function (l) {
      var choisi = null, profil = null;
      for (var k = 0; k < ANNEES.length && choisi === null; k++) {
        var y = ANNEES[k];
        var essai = JSON.parse(JSON.stringify(params));
        essai.debuts = {}; essai.debuts[l.id] = y;
        var eff = ligneEffective(l, essai);
        var f = financements(eff, idx, params), r = remboursements(eff, idx, params);
        var p = {}, ok = true;
        ANNEES.forEach(function (a) { p[a] = f[a].cout + (r[a] || 0); if (charge[a] + p[a] > plafond[a]) ok = false; });
        if (ok) { choisi = y; profil = p; }
      }
      if (choisi === null) { debuts[l.id] = APRES_LPM; horsLpm.push(l.id); return; }
      debuts[l.id] = choisi;
      ANNEES.forEach(function (a) { charge[a] += profil[a]; });
    });
    return { debuts: debuts, horsLpm: horsLpm, charge: charge };
  }

  // ---------- Alertes tirées des règles des fiches de rôle ----------
  // Jamais bloquantes : elles signalent. niveau « alerte » = règle enfreinte ; « info » = rappel utile.
  // catalogue : options des fiches (pour le délai de mise en service et les partenaires).
  var REGLE_DELAI = [
    [/^DGA-SEAD/, "DGA-13"], [/^DGA-IA-/, "DGA-14"], [/^DGA-LAD-/, "DGA-15"], [/^DGA-STOCK-/, "DGA-12"], [/^DGA-EURODRONE/, "DGA-16"],
    [/^DGA-QUAI-/, "DGA-17"], [/^DGA-CHAR-/, "DGA-18"], [/^DGA-MGCS-/, "DGA-19"], [/^DGA-(VBCI-NG|VBAE|TIGRE-SUCC|HIL)/, "DGA-20"],
    [/^DGA-(AED|HYPER|ESSAIM|ARGONAUTE)/, "DGA-24"]
  ];
  var ANNEE_DECISION = ANNEES[0];
  // Année de mise en service au plus tôt, d'après le champ « délai » de la fiche (null si rien d'exploitable).
  function miseEnService(option, debut) {
    var d = String((option && option.delai) || "");
    if (!d) return null;
    var an = d.match(/(?:Livraison initiale|production à partir de)\s+(\d{4})/i);
    if (an) return Number(an[1]) + (/production à partir/i.test(d) && /1 an après/i.test(d) ? 1 : 0);
    if (/^Immédiat/i.test(d)) return null;
    var n = d.match(/N\+(\d+)/) || d.match(/(\d+)-\d+\s*ans/) || d.match(/(\d+)\s*(?:à\s*\d+\s*)?(?:ans?|tours)/);
    return n ? debut + Number(n[1]) : null;
  }
  function premiereAnnee(l, idx) {
    var c = coutLigne(l, idx);
    for (var k = 0; k < ANNEES.length; k++) if (c.annees[ANNEES[k]].cout || quantite(l, ANNEES[k])) return ANNEES[k];
    return null;
  }
  function alertes(pions, lignes, params, catalogue) {
    params = params || parametresParDefaut();
    var idx = indexPions(pions);
    var opts = {};
    (catalogue || []).forEach(function (o) { opts[o.code] = o; });
    var res = [];
    function ajouter(regle, l, niveau, message, annee) { res.push({ regle: regle, ligne: l ? l.id : null, role: l ? l.role : null, niveau: niveau, message: message, annee: annee || null }); }
    var eff = lignes.map(function (l) { return { brute: l, e: ligneEffective(l, params) }; })
      .filter(function (x) { return arbitrageDe(x.brute, params).statut !== "renonce"; });
    var munitionsDemandees = eff.some(function (x) { return estMunitions(x.brute, idx) && premiereAnnee(x.e, idx) !== null; });

    eff.forEach(function (x) {
      var l = x.brute, e = x.e, o = opts[l.modele];
      // Retrait : payé 2 ou 3 ans après la décision, prise en COCEM (SCP-05).
      if (l.type === "retrait" && e.retraitDecide) {
        var finLpm = ANNEES[ANNEES.length - 1];
        ajouter("SCP-05", l, "info", "Retrait décidé en " + e.retraitDecide + " (COCEM) : la capacité reste payée jusqu'en " + (e.retraitEffet - 1) + ", l'économie ne compte " + (e.retraitEffet > finLpm ? "qu'après 2032." : "qu'à partir de " + e.retraitEffet + "."));
      }
      var debut = premiereAnnee(e, idx);
      if (debut === null) return;
      var c = coutLigne(e, idx);
      // Délais de mise en service (DGA-12 à DGA-20, DGA-24).
      if (o) {
        var regle = null;
        REGLE_DELAI.forEach(function (r) { if (!regle && r[0].test(o.code)) regle = r[1]; });
        var ms = miseEnService(o, l.cible && debutDe(l, params) === null ? ANNEE_DECISION : debut);
        if (regle && ms) {
          if (ms > ANNEES[ANNEES.length - 1]) ajouter(regle, l, "alerte", "Mise en service au plus tôt en " + ms + ", après la LPM : payé sans effet avant 2033 (" + o.delai + ").");
          else if (ms > debut) ajouter(regle, l, "info", "Payé dès " + debut + ", mais opérationnel au plus tôt en " + ms + " (" + o.delai + ").");
        }
        // Partenaires d'une capacité multinationale (DGRIS-01, DGRIS-02).
        if (o.partenaires && !/pays hôte/i.test(o.partenaires)) {
          var f = financementDe(l, params);
          if (f.mode !== "mutualise") ajouter("DGRIS-02", l, "alerte", "Programme avec partenaires (" + o.partenaires + ") : la part française n'est pas explicitée. Proposez un montage mutualisé.");
          else if (!f.valide) ajouter("DGRIS-01", l, "alerte", "Capacité multinationale non acquise : l'animateur n'a pas encore jugé le partenaire plausible.");
        }
      }
      // Second porte-avions : 5 annuités consécutives et un quai (DGA-23, EMM-01, DGA-22).
      if (/PANG2/.test(l.modele || "")) {
        var ans = ANNEES.filter(function (a) { return c.annees[a].cout > 0; });
        if (ans.length < 5) ajouter("EMM-01", l, "alerte", "Second PA-NG : calendrier obligatoire sur 5 années avec au moins une annuité par an ; " + ans.length + " année(s) seulement dans la LPM.");
        var quai = eff.some(function (y) { return /QUAI-PERM/.test(y.brute.modele || "") && premiereAnnee(y.e, idx) !== null; });
        if (!quai) ajouter("DGA-22", l, "alerte", "Pas de quai permanent porte-avions dans la demande : seul le quai permanent permet un double PA.");
      }
      // Cadence industrielle : ±25 % d'une année à l'autre (DGA-01).
      if (l.type === "libre" || l.type === "ajout") {
        for (var k = 1; k < ANNEES.length; k++) {
          var a0 = c.annees[ANNEES[k - 1]].cout, a1 = c.annees[ANNEES[k]].cout;
          if (a0 > 0 && a1 > 0 && Math.abs(a1 - a0) / a0 > 0.25) {
            ajouter("DGA-01", l, "alerte", "Cadence : de " + a0 + " à " + a1 + " M€ entre " + ANNEES[k - 1] + " et " + ANNEES[k] + " (plus de 25 % d'écart).", ANNEES[k]);
            break;
          }
        }
      }
      // Nouvelle capacité : 3 ans d'activation (SCP-04).
      if (l.type === "ajout" && !(l.cible && debutDe(l, params) === null) && debut + 3 > ANNEES[ANNEES.length - 1]) {
        ajouter("SCP-04", l, "info", "Nouvelle capacité posée en " + debut + " : 3 ans d'activation, opérationnelle en " + (debut + 3) + ".");
      }
      // Opérationnalité (SCP-02) : capacité posée ou repassée sans toutes ses DORESE.
      var pc = idx[l.pion];
      if (pc && pc.type === "capacite" && nbDorese(pc) && ((l.type === "ajout" && Number(l.niveau) !== 100) || l.type === "degrade")) {
        ajouter("SCP-02", l, "info", "Capacité dégradée : " + pc.nom.replace(/ \d$/, "") + " à 50 % d'opérationnalité, faute de ses DORESE.");
      }
      // Durcissement (SCP-03) : dépense supplémentaire de l'armée.
      if (l.type === "durci") {
        var su = doreseSup(l);
        ajouter("SCP-03", l, "info", "Capacité durcie : " + (su.ao + su.mco + su.rh) + " DORESE au-delà de 100 % (haute intensité), comptées en dépense de l'armée.");
      }
      // Plan de munitions (DGA-09) : une capacité de frappe demandée sans ligne de munitions.
      if (estFrappe(l, idx, opts) && !munitionsDemandees) {
        ajouter("DGA-09", l, "alerte", "Capacité de frappe sans plan de munitions : aucune ligne de munitions n'est demandée (stocks, achats, dépôts). Risque de rupture capacitaire.");
      }
      // Défection d'un allié (DGRIS-03).
      if (defectionDe(l, params)) ajouter("DGRIS-03", l, "alerte", "Défection de l'allié : la part française remonte, la ligne est à réarbitrer.");
    });
    // Masse salariale : au plus 4 DORESE RH de plus par an, toutes armées confondues (SGA-01).
    var prec = 0;
    ANNEES.forEach(function (a) {
      var rh = 0;
      eff.forEach(function (x) { var d = coutLigne(x.e, idx).annees[a].dorese.rh; if (d > 0) rh += d; });
      if (rh - prec > 4) ajouter("SGA-01", null, "alerte", "Masse salariale : +" + (rh - prec) + " DORESE RH en " + a + " (au plus 4 de plus par an, toutes armées confondues).", a);
      prec = rh;
    });
    // Stocks 30 jours (DGA-10) : une année sans le pion Munitions du socle ni ligne de munitions.
    var sansStock = ANNEES.filter(function (a) {
      var socle = pions.some(function (p) { return /^Munitions/i.test(p.nom) && p.type === "orange" && estDansSocle(p, a, params); });
      return !socle && !eff.some(function (x) { return estMunitions(x.brute, idx) && coutLigne(x.e, idx).annees[a].cout > 0; });
    });
    if (sansStock.length) ajouter("DGA-10", null, "alerte", "Stocks OTAN de 30 jours non financés en " + sansStock.join(", ") + " : ni pion Munitions ni ligne de munitions. Repères : une division tire 500 à 600 obus de 155 mm par jour ; 50 Rafale armés demandent 200 à 250 MICA.");
    // Fin de vie (EMAAE-01, EMM-03) : rupture si aucune décision n'est prise sur la période.
    function decide(re) { return eff.some(function (x) { return re.test(x.brute.modele || "") && premiereAnnee(x.e, idx) !== null; }); }
    if (!decide(/^EMAAE-C130H/)) ajouter("EMAAE-01", null, "alerte", "C-130H en fin de vie, coûteux à entretenir : aucune décision de retrait ou de remplacement (option « Retrait ou remplacement des C-130H »).");
    if (!decide(/^EMM-FDA/)) ajouter("EMM-03", null, "alerte", "Frégates de défense aérienne Forbin à remplacer rapidement : aucune ligne de remplacement retenue sur la période.");
    if (!decide(/^EMM-MAWS/)) ajouter("EMM-03", null, "alerte", "Atlantique 2 en fin de vie : aucune ligne MAWS (successeur) retenue sur la période.");
    // Contrats opérationnels (CEMA-02) : une dissolution ou un repassage à 50 % fait passer un contrat sous le seuil.
    eff.forEach(function (x) {
      var l = x.brute;
      if ((l.type !== "retrait" && l.type !== "degrade") || premiereAnnee(x.e, idx) === null) return;
      CONTRATS.forEach(function (k) {
        if (k.pions.indexOf(l.pion) !== -1) ajouter("CEMA-02", l, "alerte", "Contrat opérationnel menacé : " + k.nom + " (" + k.milieu + "). " + (l.type === "retrait" ? "Dissolution" : "Repassage à 50 %") + " de " + ((idx[l.pion] || {}).nom || l.pion) + ".");
      });
    });
    // Alliés défaillants en Baltique (COCA-03) : aléa déclenché par l'animateur.
    if (params.aleaBaltique) ajouter("COCA-03", null, "alerte", "Aléa Baltique : les partenaires européens limitent leur participation ; la France doit fournir jusqu'à 30 % de capacités en plus. Confrontez le modèle retenu (onglet Red team).");
    // Inflation (MEFR-03).
    var infl = ANNEES.filter(function (a) { return inflationDe(params, a) > 0; });
    if (infl.length) ajouter("MEFR-03", null, "alerte", "Inflation : " + infl.map(function (a) { return a + " −" + inflationDe(params, a) + " M€"; }).join(", ") + " de pouvoir d'achat, retirés du plafond.");
    var carb = ANNEES.filter(function (a) { return carburantsDe(params, a) > 0; });
    if (carb.length) ajouter("MEFR-02", null, "alerte", "Surcoûts carburants posés sur la table : " + carb.map(function (a) { return a + " +" + carburantsDe(params, a) + " M€"; }).join(", ") + ".");
    return res;
  }

  // ---------- Munitions et capacités de frappe (DGA-09, DGA-10) ----------
  var RE_MUNITIONS = /munition|obus|missile|stock|MICA|SCALP|d[ée]p[ôo]ts? de mun/i;
  var RE_FRAPPE = /rafale|SEAD|fr[ée]gate|FDI|FREMM|MGCS|char\b|chars|leclerc|artillerie|CAESAR|LRU|frappe|hypers|chasse|porte-avions|PA-?NG|SNA\b/i;
  function estMunitions(l, idx) {
    if (/STOCK|MUN-|DEPOTS/.test(l.modele || "")) return true;
    if (l.type !== "libre") return false;
    return RE_MUNITIONS.test(l.libelle || "") && !/autonomes et essaims/i.test(l.libelle || "");
  }
  function estFrappe(l, idx, opts) {
    if (l.type === "ajout" || l.type === "durci") { var p = idx[l.pion]; return !!(p && RE_FRAPPE.test(p.nom)); }
    if (l.type === "libre") return RE_FRAPPE.test(l.libelle || "") && !estMunitions(l, idx);
    return false;
  }

  // ---------- Cycle de vie : opérationnalité d'une capacité du socle (SCP-02, SCP-03, SCP-05) ----------
  // Taux : 100 % avec toutes ses DORESE ; face rouge de 90 % à 50 % sinon ; 50 % sans DORESE additionnelle ;
  // au-delà de 100 % si elle est durcie. 0 si elle est retirée.
  function etatCapacite(pion, lignes, params, annee) {
    params = params || parametresParDefaut();
    var actif = function (type) { return lignes.filter(function (l) { var e = ligneEffective(l, params); return l.pion === pion.id && l.type === type && quantite(e, annee) > 0 && arbitrageDe(l, params).statut !== "renonce"; })[0] || null; };
    if (actif("retrait")) return { taux: 0, posees: 0, total: nbDorese(pion), retire: true, durci: 0, face: "retirée" };
    var total = nbDorese(pion);
    var posees = actif("degrade") ? 0 : nbDepart(pion) + (actif("dorese") ? nbManquantes(pion) : 0);
    var ld = actif("durci"), sup = ld ? doreseSup(ld) : { ao: 0, mco: 0, rh: 0 }, nsup = sup.ao + sup.mco + sup.rh;
    var taux = !total ? 100 : posees >= total ? 100 : posees <= 0 ? 50 : Math.round(50 + 40 * posees / total);
    if (taux === 100 && nsup && total) taux = 100 + Math.round(100 * nsup / total / 4);
    return { taux: taux, posees: posees, total: total, retire: false, durci: nsup, face: taux >= 100 ? (nsup ? "durcie" : "verte") : "rouge" };
  }

  // ---------- Contrats opérationnels 2027 (CEMA-02) ----------
  // Chaque contrat est rattaché aux pions du socle qui le portent ; « un » = un seul pion suffit.
  var CONTRATS = [
    { id: "air-chasse", milieu: "Air", nom: "45 chasseurs", pions: ["P33"] },
    { id: "air-mrtt", milieu: "Air", nom: "6 MRTT", pions: ["P28"] },
    { id: "air-transport", milieu: "Air", nom: "15 avions de transport", pions: ["P27", "P31"] },
    { id: "air-male", milieu: "Air", nom: "8 systèmes MALE", pions: ["P30"] },
    { id: "mer-gan", milieu: "Mer", nom: "1 groupe aéronaval", pions: ["P41", "P38"] },
    { id: "mer-permanence", milieu: "Mer", nom: "2 SNA et 3 frégates en permanence à la mer", pions: ["P34", "P40", "P42"] },
    { id: "mer-patmar", milieu: "Mer", nom: "6 ATL2 / MAWS", pions: ["P39"] },
    { id: "terre-guepard", milieu: "Terre", nom: "1 brigade Guépard", pions: ["P20", "P21", "P22", "P23", "P24", "P25"], un: true },
    { id: "terre-chars", milieu: "Terre", nom: "120 chars disponibles", pions: ["P20", "P21"] },
    { id: "terre-rapide", milieu: "Terre", nom: "1 capacité d'intervention rapide permanente", pions: ["P14", "P26"], un: true }
  ];
  var ETATS_CONTRAT = { tenu: "Tenu", partiel: "Partiel", non_tenu: "Non tenu" };
  // Évaluation en fin de LPM, après arbitrage ; params.contrats[id] = note posée par le CEMA ou l'animateur.
  function evaluerContrats(pions, lignes, params, annee) {
    params = params || parametresParDefaut();
    annee = annee || ANNEES[ANNEES.length - 1];
    var idx = indexPions(pions);
    // Seules les décisions prises comptent : une demande en attente ne change pas encore le contrat.
    var arb = lignesApresArbitrage(lignes.filter(function (l) { return arbitrageDe(l, params).statut === "retenu"; }), params);
    return CONTRATS.map(function (k) {
      var etats = k.pions.filter(function (id) { return idx[id]; }).map(function (id) { return { pion: idx[id], etat: etatCapacite(idx[id], arb, params, annee) }; });
      var pleins = etats.filter(function (x) { return x.etat.taux >= 100; }).length, retires = etats.filter(function (x) { return x.etat.retire; }).length;
      var auto = k.un ? (pleins ? "tenu" : retires === etats.length ? "non_tenu" : "partiel")
        : (pleins === etats.length ? "tenu" : retires ? "non_tenu" : "partiel");
      var note = ((params.contrats || {})[k.id]) || null;
      return { id: k.id, milieu: k.milieu, nom: k.nom, auto: auto, note: note, etat: note || auto,
        detail: etats.map(function (x) { return x.pion.nom + " " + (x.etat.retire ? "retirée" : x.etat.taux + " %"); }).join(" · ") };
    });
  }

  // ---------- COCA / Red team (COCA-01, COCA-02, COCA-03) ----------
  // params.coca[idLigne] = { urgence, assume, alarme, requalifie, texte, par } ; levée par le CEMA.
  var STATUTS_COCA = { urgence: "Urgence COCA", requalifie: "Tuile requalifiée", assume: "Renoncement assumé", alarme: "Alarme exécutif" };
  function cocaDe(ligne, params) { return (((params || {}).coca || {})[ligne.id]) || null; }
  // params.scenarios = [{ id, nom, note: satisfaisant|partiel|insuffisant, ecart, recommandation }]
  var NOTES_SCENARIO = { satisfaisant: "Satisfaisant", partiel: "Partiel", insuffisant: "Insuffisant" };
  var RECOMMANDATIONS = { renforcement: "Renforcement", alerte: "Alerte", renoncement: "Renoncement assumé" };
  function couvertureScenarios(params) {
    var sc = ((params || {}).scenarios || []).filter(function (x) { return NOTES_SCENARIO[x.note]; });
    if (!sc.length) return null;
    var pts = sc.reduce(function (t, x) { return t + (x.note === "satisfaisant" ? 1 : x.note === "partiel" ? 0.5 : 0); }, 0);
    return { taux: Math.round(100 * pts / sc.length), evalues: sc.length,
      satisfaisant: sc.filter(function (x) { return x.note === "satisfaisant"; }).length,
      partiel: sc.filter(function (x) { return x.note === "partiel"; }).length,
      insuffisant: sc.filter(function (x) { return x.note === "insuffisant"; }).length };
  }
  // Aléa Baltique (COCA-03) : +30 % de besoin sur les capacités des contrats opérationnels, en M€ par an.
  function besoinBaltique(pions, lignes, params, annee) {
    var idx = indexPions(pions), vus = {}, cout = 0;
    var arb = lignesApresArbitrage(lignes, params);
    CONTRATS.forEach(function (k) { k.pions.forEach(function (id) {
      if (vus[id] || !idx[id]) return; vus[id] = true;
      var e = etatCapacite(idx[id], arb, params, annee);
      if (!e.retire) cout += idx[id].cout50 + Math.min(e.posees, e.total) * CASE;
    }); });
    return { base: cout, supplement: Math.round(cout * 0.3 / CASE) * CASE };
  }

  // ---------- Avis des acteurs ----------
  // params.avis[idLigne][role + ":" + nature] = { role, nature, valeur, texte, le }
  // nature : « avis » (tous), « industriel » (DGA), « soutenabilite » (MEFR, SGA).
  var NATURES_AVIS = {
    avis: { nom: "Avis", valeurs: { favorable: "Favorable", reserve: "Réservé", defavorable: "Défavorable" } },
    industriel: { nom: "Avis industriel", roles: ["DGA"], valeurs: { favorable: "Favorable", report: "Report de cadence", mutualisation: "Mutualisation", alternative: "Alternative", refus: "Refus industriel" } },
    soutenabilite: { nom: "Soutenabilité", roles: ["MEFR", "SGA"], valeurs: { soutenable: "Soutenable", fragile: "Fragile", insoutenable: "Insoutenable" } }
  };
  var AVIS_NEGATIFS = { defavorable: true, refus: true, insoutenable: true };
  var AVIS_POSITIFS = { favorable: true, soutenable: true };
  function avisDe(ligne, params) {
    var a = (((params || {}).avis || {})[ligne.id]) || {};
    return Object.keys(a).map(function (k) { return a[k]; }).filter(function (x) { return x && NATURES_AVIS[x.nature] && x.valeur; });
  }

  // ---------- Souveraineté ----------
  // Ce qu'on partage quand un programme est mutualisé (part alliée, UE ou hors UE) ou financé par l'UE.
  var ZONES = { ue: "partenaires UE", hors_ue: "partenaires hors UE", mixte: "partenaires UE et hors UE" };
  var PAYS_UE = /allemagne|italie|espagne|pologne|roumanie|balte|estonie|lettonie|lituanie|belgique|pays-bas|grèce|suède|finlande|portugal|autriche|tchèque|danemark|europ|\bue\b|esa\b/i;
  var PAYS_HORS_UE = /royaume-uni|états-unis|etats-unis|norvège|otan|canada|turquie|japon|corée|australie|inde|émirats|djibouti/i;
  function zoneProbable(texte) {
    var t = String(texte || ""), u = PAYS_UE.test(t), h = PAYS_HORS_UE.test(t);
    return u && h ? "mixte" : h ? "hors_ue" : u ? "ue" : null;
  }
  // Pour une ligne : niveau ('national'|'partage'|'finance_ue'), part de la décision gardée par la France, zone.
  function souveraineteDe(ligne, params) {
    var f = financementDe(ligne, params);
    if (f.mode === "national") return { niveau: "national", part: 100, zone: null, envisage: false, libelle: "Souveraineté pleine" };
    var actif = financementActif(ligne, params);
    if (f.mode === "mutualise") {
      var z = f.zone || zoneProbable(f.partenaires) || "ue";
      return { niveau: "partage", part: Math.max(0, Math.min(100, Number(f.part) || 0)), zone: z, envisage: !actif,
        libelle: "Programme partagé avec des " + ZONES[z] + " : la France garde " + (Number(f.part) || 0) + " % de la décision" };
    }
    return { niveau: "finance_ue", part: 100, zone: "ue", envisage: !actif,
      libelle: (f.mode === "pret" ? "Prêt UE" : "Subvention UE") + " : programme national, dépendance financière à l'UE" };
  }
  // Synthèse par année (montages actifs seulement) : montants bruts selon la souveraineté.
  function syntheseSouverainete(pions, lignes, params) {
    var idx = indexPions(pions);
    var res = {};
    ANNEES.forEach(function (a) { res[a] = { envisage: 0, national: 0, partage_ue: 0, partage_hors_ue: 0, allie_ue: 0, allie_hors_ue: 0, finance_ue: 0, total: 0, indice: 100 }; });
    lignes.forEach(function (l) {
      if (arbitrageDe(l, params).statut === "renonce") return;
      var sv = souveraineteDe(l, params), f = financements(l, idx, params);
      ANNEES.forEach(function (a) {
        var x = f[a], r = res[a];
        if (x.brut <= 0) return;
        r.total += x.brut;
        if (sv.envisage) r.envisage += x.brut;
        if (sv.niveau === "national" || sv.envisage) r.national += x.brut;
        else if (sv.niveau === "finance_ue") { r.finance_ue += x.subvention + x.emprunt; r.national += x.brut - x.subvention - x.emprunt; }
        else if (sv.zone === "hors_ue") { r.partage_hors_ue += x.brut; r.allie_hors_ue += x.allie; }
        else { r.partage_ue += x.brut; r.allie_ue += x.allie; }
      });
    });
    ANNEES.forEach(function (a) { var r = res[a]; r.indice = r.total ? Math.round(100 * r.national / r.total) : 100; });
    return res;
  }

  // ---------- Points chauds : là où il faut arbitrer ----------
  // Avis divergents ou négatifs, alerte de fiche, ligne sous la ligne de flottaison, priorité contestée.
  function pointsChauds(pions, lignes, params, catalogue, annee) {
    var res = {};
    function ajouter(id, raison) { (res[id] = res[id] || []).indexOf(raison) === -1 && res[id].push(raison); }
    lignes.forEach(function (l) {
      if (arbitrageDe(l, params).statut === "renonce") return;
      var av = avisDe(l, params);
      var neg = av.filter(function (x) { return AVIS_NEGATIFS[x.valeur]; }), pos = av.filter(function (x) { return AVIS_POSITIFS[x.valeur]; });
      if (neg.length && pos.length) ajouter(l.id, "avis divergents");
      else if (neg.length) ajouter(l.id, "avis défavorable (" + neg.map(function (x) { return x.role; }).join(", ") + ")");
      var pr = prioriteDe(l, params);
      if (pr.propositions.some(function (x) { return x.p !== pr.valeur; })) ajouter(l.id, "priorité contestée");
      if (defectionDe(l, params)) ajouter(l.id, "défection d'un allié");
      var c = contrainteDe(l.id, params);
      if (c && c.etat === "demandee") ajouter(l.id, "contrainte politique demandée");
      var cc = cocaDe(l, params);
      if (cc && cc.urgence) ajouter(l.id, "urgence COCA");
      if (cc && cc.alarme) ajouter(l.id, "alarme exécutif");
    });
    alertes(pions, lignes, params, catalogue).forEach(function (a) { if (a.ligne && a.niveau === "alerte") ajouter(a.ligne, "alerte de fiche " + a.regle); });
    var eff = lignesEnTrajectoire(lignes, params);
    flottaison(pions, eff, params, annee).sous.forEach(function (it) { if (it.ligne) ajouter(it.ligne.id, "sous la ligne de flottaison"); });
    return res;
  }

  // ---------- Échanges : export d'une partie, comparaison de deux trajectoires ----------
  // Un même format pour le modèle 2032 arbitré et pour une trajectoire 2027-2032 : assez riche pour
  // reconstruire une trajectoire hors de l'outil, puis la réimporter et la comparer.
  var FORMAT_ECHANGE = "strategikon-echange";
  var NATURES = { dorese: "renforcement à 100 %", ajout: "nouvel exemplaire", retrait: "dissolution", degrade: "repassage à 50 %", durci: "durcissement", libre: "option ou pion sur mesure" };
  function exporterPartie(pions, lignes, params, catalogue, type, nomPartie) {
    params = params || parametresParDefaut();
    var idx = indexPions(pions);
    var opts = {};
    (catalogue || []).forEach(function (o) { opts[o.code] = o; });
    var trajectoire = type === "trajectoire";
    var pp = trajectoire ? params : Object.assign({}, params, { debuts: {} });
    var fin = ANNEES[ANNEES.length - 1];
    var al = alertes(pions, lignes, pp, catalogue);
    var lignesX = lignes.map(function (l) {
      var e = ligneEffective(l, pp);
      var f = financements(e, idx, pp), r = remboursements(e, idx, pp), c = coutLigne(e, idx);
      var arb = arbitrageDe(l, pp), pr = prioriteDe(l, pp), fin0 = financementDe(l, pp), o = opts[l.modele];
      var annees = {};
      ANNEES.forEach(function (a) {
        if (!trajectoire && a !== fin) return;
        annees[a] = { cout: f[a].cout + (r[a] || 0), brut: f[a].brut, quantite: quantite(e, a), dorese: c.annees[a].dorese };
      });
      var entree = null;
      ANNEES.forEach(function (a) { if (entree === null && (c.annees[a].cout || quantite(e, a))) entree = a; });
      if (trajectoire && l.cible && debutDe(l, pp) === APRES_LPM) entree = APRES_LPM;
      var pion = idx[l.pion];
      return {
        id: l.id, role: l.role, type: l.type, nature: NATURES[l.type] || l.type,
        libelle: l.type === "libre" ? (l.libelle || "Pion sur mesure") : (pion ? pion.nom : l.pion),
        pion: l.pion || null, modele: l.modele || null, niveau: l.niveau || null, armee: armeeDeLigne(l, idx), cible: !!l.cible,
        cout_unitaire: unitaire(l, idx).cout, tranches: tranchesDe(l), dorese_unitaire: unitaire(l, idx).dorese,
        priorite: { pole: pr.pole, cema: pr.cema, retenue: pr.valeur }, contrainte_politique: contrainteDe(l.id, pp),
        financement: fin0.mode === "national" ? { mode: "national" } : Object.assign({ actif: financementActif(l, pp), defection: defectionDe(l, pp) }, fin0),
        enveloppe: l.enveloppe || null,
        decision: { statut: arb.statut, decalage: arb.decalage || 0, contrainte: !!arb.contrainte },
        entree: entree, annees: annees, total: Object.keys(annees).reduce(function (t, a) { return t + annees[a].cout; }, 0),
        hors_lpm: (r.hors || 0) + (e.horsLpm || 0),
        delai_fiche: o ? o.delai || null : null, mise_en_service: o ? miseEnService(o, entree && entree <= fin ? entree : ANNEE_DECISION) : null,
        avis: avisDe(l, pp), souverainete: souveraineteDe(l, pp),
        justification: l.justification || "",
        alertes: al.filter(function (x) { return x.ligne === l.id; }).map(function (x) { return { regle: x.regle, niveau: x.niveau, message: x.message }; })
      };
    });
    var syn = synthese(pions, lignesApresArbitrage(lignesEnTrajectoire(lignes, pp), pp), pp);
    var synX = {};
    ANNEES.forEach(function (a) {
      if (!trajectoire && a !== fin) return;
      synX[a] = { socle: syn[a].totalSocle, demandes: syn[a].totalDemandes, total: syn[a].total, plafond: syn[a].plafond, marge: syn[a].marge, part_alliee: syn[a].allie };
    });
    return {
      format: FORMAT_ECHANGE, version: 1, type: trajectoire ? "trajectoire" : "modele2032", partie: nomPartie || null,
      exporte_le: new Date().toISOString(), unite: "M€ (1 case = 100 M€)",
      regles_de_lecture: "annees[a].cout = part payée par la France cette année, financement et remboursements compris ; synthese = après arbitrage (renoncés retirés, différés décalés) ; entree " + APRES_LPM + " = glisse après 2032.",
      parametres: { table: params.table, plafonds: params.plafonds, aleas: params.aleas, enveloppes: enveloppesDe(params), debuts: trajectoire ? (params.debuts || {}) : {} },
      socle: pions.map(function (p) { return { id: p.id, nom: p.nom, type: p.type, armee: p.armee, cout: coutSocle(p), cout50: p.cout50, cout100: p.cout100, cases: [p.l, p.h], dorese_requises: p.dorese, dorese_posees: doreseDepart(p), contrainte_politique: contrainteDe("pion:" + p.id, params) }; }),
      lignes: lignesX,
      synthese: synX,
      alertes_globales: al.filter(function (x) { return !x.ligne; })
    };
  }
  // Modèle 2032 préparé pour une partie précise (format « strategikon-modele-partie ») :
  // renvoie les lignes prêtes à écrire (au modèle 2032) et ce qu'il faut ajouter aux paramètres.
  var FORMAT_MODELE_PARTIE = "strategikon-modele-partie";
  function lireModelePartie(texte, pions) {
    var o = typeof texte === "string" ? JSON.parse(texte) : texte;
    if (!o || o.format !== FORMAT_MODELE_PARTIE || !Array.isArray(o.lignes)) throw new Error("Ce fichier n'est pas un modèle 2032 de partie STRATEGIKON.");
    var idx = indexPions(pions || []);
    var fin = ANNEES[ANNEES.length - 1];
    var roles = ROLES.map(function (r) { return r.code; });
    var arbitrages = {}, validations = {};
    var lignes = o.lignes.map(function (x, k) {
      if (!x.id || !x.role || !x.type) throw new Error("Ligne " + (k + 1) + " incomplète.");
      if (roles.indexOf(x.role) === -1) throw new Error("Ligne " + x.id + " : rôle inconnu (" + x.role + ").");
      if (x.type !== "libre" && !idx[x.pion]) throw new Error("Ligne " + x.id + " : pion inconnu (" + x.pion + ").");
      var l = { id: x.id, role: x.role, type: x.type, cible: true, qte: {}, justification: x.justification || "", cree_le: "2026-11-25T00:00:" + String(k).padStart(2, "0") + ".000Z", modele_partie: o.partie || null };
      ANNEES.forEach(function (a) { l.qte[a] = 0; });
      l.qte[fin] = Math.max(1, Number(x.qte) || 1);
      if (x.type === "libre") {
        l.modele = null; l.source = null;
        l.libelle = x.libelle || "";
        l.armee = x.armee || "Interarmées";
        l.cout_unitaire = arrondiCase(Number(x.cout_unitaire) || 0);
        l.dorese = { ao: (x.dorese || {}).ao || 0, mco: (x.dorese || {}).mco || 0, rh: (x.dorese || {}).rh || 0 };
        validations[x.id] = true;
      } else {
        l.pion = x.pion;
        if (x.type === "ajout") l.niveau = Number(x.niveau) === 50 ? 50 : 100;
        l.armee = x.armee || idx[x.pion].armee;
      }
      arbitrages[x.id] = { statut: x.statut || o.statut || "retenu", decalage: 0 };
      return l;
    });
    return { partie: o.partie || "", lignes: lignes, arbitrages: arbitrages, validations: validations,
      conquetes: Array.isArray(o.conquetes) ? o.conquetes : [], total_attendu: o.total_attendu_2032 || null };
  }
  // Charge le modèle dans les paramètres d'une partie (sans rien retirer de ce qui y est déjà).
  function appliquerModeleParams(params, modele) {
    params.arbitrages = params.arbitrages || {};
    params.validations = params.validations || {};
    Object.keys(modele.arbitrages).forEach(function (id) { params.arbitrages[id] = modele.arbitrages[id]; });
    Object.keys(modele.validations).forEach(function (id) { params.validations[id] = modele.validations[id]; });
    if (modele.conquetes.length && !(params.conquetes || []).length) params.conquetes = JSON.parse(JSON.stringify(modele.conquetes));
    return params;
  }
  // Pions modifiés par l'animateur pour une partie : nom et coût (sans DORESE), dans params.pionsModifies.
  // La forme sur la table suit le nouveau nombre de cases en gardant l'allure du pion d'origine.
  function formePour(cases, l0, h0) {
    if (cases <= 0) return { l: 1, h: 1 };
    var cible = (l0 || 1) / (h0 || 1), best = null;
    for (var w = 1; w <= Math.min(cases, 10); w++) {
      if (cases % w) continue;
      var h = cases / w, ecart = Math.abs(Math.log((w / h) / cible));
      if (!best || ecart < best.e) best = { l: w, h: h, e: ecart };
    }
    if (!best || best.h > 10) { var lw = Math.min(10, Math.max(1, l0 || 1)); return { l: lw, h: Math.ceil(cases / lw) }; }
    return { l: best.l, h: best.h };
  }
  function pionsDeLaPartie(pions, params) {
    var mod = (params && params.pionsModifies) || {};
    if (!Object.keys(mod).length) return pions;
    return pions.map(function (p) {
      var m = mod[p.id];
      if (!m) return p;
      var c = JSON.parse(JSON.stringify(p));
      c.nom_origine = p.nom;
      if (m.nom && String(m.nom).trim()) c.nom = String(m.nom).trim();
      if (m.cout !== undefined && m.cout !== null && m.cout !== "") {
        var cout = Math.max(CASE, arrondiCase(Number(m.cout) || 0));
        c.cout50 = cout;
        c.cout100 = cout + nbDorese(p) * CASE;
        if (cout !== p.cout50) { var fo = formePour(cout / CASE, p.l, p.h); c.l = fo.l; c.h = fo.h; }
        c.cout_origine = p.cout50;
      }
      c.modifie = true;
      return c;
    });
  }
  // Reconstruit, en lecture seule, l'état d'une partie à partir d'un export (trajectoire de référence) :
  // les lignes et les paramètres (plafonds, pions de scénario, années d'entrée, décisions, montages).
  function partieDepuisEchange(ref, paramsBase) {
    var p = JSON.parse(JSON.stringify(paramsBase || parametresParDefaut()));
    var rp = ref.parametres || {};
    ["table", "plafonds", "aleas", "enveloppes", "debuts"].forEach(function (k) { if (rp[k] !== undefined) p[k] = JSON.parse(JSON.stringify(rp[k])); });
    p.debuts = p.debuts || {};
    p.phase = "trajectoire";
    p.arbitrages = {}; p.financements = {}; p.validations = {}; p.defections = {};
    var lignes = (ref.lignes || []).map(function (x) {
      var l = { id: x.id, role: x.role, type: x.type, qte: {}, justification: x.justification || "", cree_le: x.cree_le || "" };
      if (x.cible) l.cible = true;
      if (x.type === "libre") {
        l.modele = x.modele || null; l.libelle = x.libelle || ""; l.armee = x.armee;
        l.cout_unitaire = Number(x.cout_unitaire) || 0;
        l.dorese = x.dorese_unitaire || { ao: 0, mco: 0, rh: 0 };
        p.validations[x.id] = true;
      } else {
        l.pion = x.pion; l.armee = x.armee;
        if (x.niveau) l.niveau = x.niveau;
      }
      if (x.tranches && x.tranches.length) l.tranches = x.tranches.slice();
      if (x.enveloppe) l.enveloppe = x.enveloppe;
      var an = x.annees || {};
      ANNEES.forEach(function (a) { l.qte[a] = an[a] ? Number(an[a].quantite) || 0 : 0; });
      if (l.cible) {
        var q = 0;
        ANNEES.forEach(function (a) { q = Math.max(q, l.qte[a]); });
        ANNEES.forEach(function (a) { l.qte[a] = 0; });
        l.qte[ANNEES[ANNEES.length - 1]] = q || 1;
        if (p.debuts[x.id] === undefined && x.entree) p.debuts[x.id] = x.entree;
      }
      if (x.decision) p.arbitrages[x.id] = { statut: x.decision.statut || "attente", decalage: x.decision.decalage || 0 };
      if (x.financement && x.financement.mode && x.financement.mode !== "national") {
        var f = JSON.parse(JSON.stringify(x.financement)); f.valide = f.actif !== false || !!f.defection; p.financements[x.id] = f;
        if (f.defection) p.defections[x.id] = true;
      }
      return l;
    });
    return { lignes: lignes, params: p };
  }
  function lireEchange(texte) {
    var o = typeof texte === "string" ? JSON.parse(texte) : texte;
    if (!o || o.format !== FORMAT_ECHANGE || !Array.isArray(o.lignes)) throw new Error("Ce fichier n'est pas un export STRATEGIKON.");
    if (o.type !== "trajectoire") throw new Error("Ce fichier est un modèle 2032 : importez une trajectoire 2027-2032.");
    return o;
  }
  // Comparaison : a = trajectoire des joueurs, b = trajectoire de référence. Lignes appariées par id.
  function comparerTrajectoires(a, b) {
    var annees = ANNEES.map(function (an) {
      var x = (a.synthese || {})[an] || {}, y = (b.synthese || {})[an] || {};
      return { annee: an, joueurs: x, reference: y, ecart_total: (x.total || 0) - (y.total || 0),
        depassement_joueurs: Math.max(0, -(x.marge || 0)), depassement_reference: Math.max(0, -(y.marge || 0)) };
    });
    var parId = {};
    a.lignes.forEach(function (l) { parId[l.id] = { id: l.id, libelle: l.libelle, role: l.role, joueurs: l, reference: null }; });
    b.lignes.forEach(function (l) { (parId[l.id] = parId[l.id] || { id: l.id, libelle: l.libelle, role: l.role, joueurs: null, reference: null }).reference = l; });
    var lignes = Object.keys(parId).map(function (k) {
      var x = parId[k], j = x.joueurs, r = x.reference;
      var sj = j ? j.decision.statut : null, sr = r ? r.decision.statut : null;
      x.entree_joueurs = j && sj !== "renonce" ? j.entree : null;
      x.entree_reference = r && sr !== "renonce" ? r.entree : null;
      x.ecart_entree = x.entree_joueurs && x.entree_reference ? x.entree_joueurs - x.entree_reference : null;
      x.total_joueurs = j && sj !== "renonce" ? j.total : 0;
      x.total_reference = r && sr !== "renonce" ? r.total : 0;
      x.renonce_joueurs = sj === "renonce"; x.renonce_reference = sr === "renonce";
      x.alertes_joueurs = j ? j.alertes.filter(function (y) { return y.niveau === "alerte"; }).length : 0;
      x.alertes_reference = r ? r.alertes.filter(function (y) { return y.niveau === "alerte"; }).length : 0;
      return x;
    });
    function compte(f) { return lignes.filter(f).length; }
    return {
      annees: annees, lignes: lignes,
      resume: {
        plus_tot_joueurs: compte(function (x) { return x.ecart_entree < 0; }),
        plus_tard_joueurs: compte(function (x) { return x.ecart_entree > 0; }),
        apres_2032_joueurs: compte(function (x) { return x.entree_joueurs === APRES_LPM; }),
        apres_2032_reference: compte(function (x) { return x.entree_reference === APRES_LPM; }),
        renonces_joueurs: compte(function (x) { return x.renonce_joueurs; }),
        renonces_reference: compte(function (x) { return x.renonce_reference; }),
        alertes_joueurs: lignes.reduce(function (t, x) { return t + x.alertes_joueurs; }, 0) + (a.alertes_globales || []).length,
        alertes_reference: lignes.reduce(function (t, x) { return t + x.alertes_reference; }, 0) + (b.alertes_globales || []).length
      }
    };
  }
  // Export à plat pour un tableur.
  function echangeEnCsv(o) {
    var ent = ["id", "Pôle", "Objet", "Nature", "Armée", "Modèle 2032", "Priorité pôle", "Priorité CEMA", "Priorité retenue", "Contrainte politique", "Financement", "Part (%)", "Décision", "Entrée"]
      .concat(ANNEES.map(String)).concat(["Total LPM (M€)", "Hors LPM (M€)", "DORESE AO/MCO/RH par unité", "Tranches", "Délai fiche", "Mise en service", "Alertes", "Justification"]);
    var out = [ent.join(";")];
    o.lignes.forEach(function (l) {
      var v = [l.id, l.role, l.libelle, l.nature, l.armee, l.cible ? "oui" : "", l.priorite.pole || "", l.priorite.cema || "", l.priorite.retenue,
        l.contrainte_politique ? l.contrainte_politique.etat : "", l.financement.mode, l.financement.part !== undefined ? l.financement.part : "", l.decision.statut, l.entree || ""]
        .concat(ANNEES.map(function (a) { return l.annees[a] ? l.annees[a].cout : ""; }))
        .concat([l.total, l.hors_lpm, [l.dorese_unitaire.ao, l.dorese_unitaire.mco, l.dorese_unitaire.rh].join("/"), l.tranches.join(" "), l.delai_fiche || "", l.mise_en_service || "",
          l.alertes.map(function (x) { return x.regle; }).join(" "), (l.justification || "").replace(/\s+/g, " ")]);
      out.push(v.map(function (x) { var s2 = String(x === null || x === undefined ? "" : x); return /[";\n]/.test(s2) ? '"' + s2.replace(/"/g, '""') + '"' : s2; }).join(";"));
    });
    out.push("");
    out.push(["Année", "Socle", "Demandes", "Total", "Plafond", "Marge"].join(";"));
    Object.keys(o.synthese).forEach(function (a) { var y = o.synthese[a]; out.push([a, y.socle, y.demandes, y.total, y.plafond, y.marge].join(";")); });
    return out.join("\n");
  }

  var API = {
    CASE: CASE,
    ANNEES: ANNEES,
    ARMEES: ARMEES,
    ROLES: ROLES,
    TYPES_LIGNE: TYPES_LIGNE,
    parametresParDefaut: parametresParDefaut,
    indexPions: indexPions,
    nbDorese: nbDorese,
    doreseDepart: doreseDepart,
    nbDepart: nbDepart,
    doreseManquantes: doreseManquantes,
    nbManquantes: nbManquantes,
    coutSocle: coutSocle,
    unitaire: unitaire,
    quantite: quantite,
    coutLigne: coutLigne,
    armeeDeLigne: armeeDeLigne,
    synthese: synthese,
    blocsAnnee: blocsAnnee,
    placerAnnee: placerAnnee,
    STATUTS: STATUTS,
    arbitrageDe: arbitrageDe,
    ligneArbitree: ligneArbitree,
    lignesApresArbitrage: lignesApresArbitrage,
    reportHorsLpm: reportHorsLpm,
    arrondiCase: arrondiCase,
    LARGEUR: LARGEUR,
    PRIORITES: PRIORITES,
    prioriteDe: prioriteDe,
    contrainteDe: contrainteDe,
    contrainteAcquise: contrainteAcquise,
    comparerEmpilement: comparerEmpilement,
    MODES_FINANCEMENT: MODES_FINANCEMENT,
    financementDe: financementDe,
    financementActif: financementActif,
    defectionDe: defectionDe,
    financements: financements,
    remboursements: remboursements,
    partFrancaise: partFrancaise,
    ENVELOPPES_DEFAUT: ENVELOPPES_DEFAUT,
    enveloppesDe: enveloppesDe,
    enveloppeDe: enveloppeDe,
    etatEnveloppe: etatEnveloppe,
    flottaison: flottaison,
    APRES_LPM: APRES_LPM,
    debutDe: debutDe,
    tranchesDe: tranchesDe,
    ligneEffective: ligneEffective,
    lignesEnTrajectoire: lignesEnTrajectoire,
    etalerAuto: etalerAuto,
    alertes: alertes,
    NATURES_AVIS: NATURES_AVIS,
    avisDe: avisDe,
    ZONES: ZONES,
    zoneProbable: zoneProbable,
    souveraineteDe: souveraineteDe,
    syntheseSouverainete: syntheseSouverainete,
    pointsChauds: pointsChauds,
    FORMAT_ECHANGE: FORMAT_ECHANGE,
    exporterPartie: exporterPartie,
    lireEchange: lireEchange,
    partieDepuisEchange: partieDepuisEchange,
    formePour: formePour,
    pionsDeLaPartie: pionsDeLaPartie,
    FORMAT_MODELE_PARTIE: FORMAT_MODELE_PARTIE,
    lireModelePartie: lireModelePartie,
    appliquerModeleParams: appliquerModeleParams,
    comparerTrajectoires: comparerTrajectoires,
    echangeEnCsv: echangeEnCsv,
    miseEnService: miseEnService,
    SCENARIOS_INFLATION: SCENARIOS_INFLATION,
    CONQUETES_RELEVE_2032: CONQUETES_RELEVE_2032,
    conquetesDe: conquetesDe,
    conquisDe: conquisDe,
    carburantsDe: carburantsDe,
    inflationDe: inflationDe,
    plafondMontant: plafondMontant,
    doreseSup: doreseSup,
    delaiRetrait: delaiRetrait,
    etatCapacite: etatCapacite,
    CONTRATS: CONTRATS,
    ETATS_CONTRAT: ETATS_CONTRAT,
    evaluerContrats: evaluerContrats,
    STATUTS_COCA: STATUTS_COCA,
    cocaDe: cocaDe,
    NOTES_SCENARIO: NOTES_SCENARIO,
    RECOMMANDATIONS: RECOMMANDATIONS,
    couvertureScenarios: couvertureScenarios,
    besoinBaltique: besoinBaltique,
    estMunitions: estMunitions
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else racine.STRAT_MOTEUR = API;
})(typeof window !== "undefined" ? window : this);
