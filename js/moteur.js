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
    libre: "Ligne libre (investissement, option…)"
  };

  function parametresParDefaut() {
    return {
      table: 600, // cases par année (60 Md€)
      plafonds: { 2027: 590, 2028: 580, 2029: 570, 2030: 590, 2031: 590, 2032: 590 }, // cases
      aleas: {} // id de pion orange -> liste des années où il est posé
    };
  }

  function indexPions(pions) {
    var idx = {};
    pions.forEach(function (p) { idx[p.id] = p; });
    return idx;
  }

  function nbDorese(pion) {
    return pion ? pion.dorese.ao + pion.dorese.mco + pion.dorese.rh : 0;
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
        return { cout: nbDorese(pion) * CASE, dorese: copie(pion.dorese) };
      case "ajout":
        if (!pion) return vide;
        if (Number(ligne.niveau) === 100) return { cout: pion.cout100, dorese: copie(pion.dorese) };
        return { cout: pion.cout50, dorese: { ao: 0, mco: 0, rh: 0 } };
      case "retrait":
        if (!pion) return vide;
        return { cout: -pion.cout50, dorese: { ao: 0, mco: 0, rh: 0 } };
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

  function quantite(ligne, annee) {
    var q = Number((ligne.qte || {})[annee]) || 0;
    // Un pion du socle n'existe qu'en un exemplaire : on plafonne à 1.
    if (ligne.type === "dorese" || ligne.type === "retrait") q = Math.max(0, Math.min(1, q));
    return Math.max(0, q);
  }

  // Coût d'une ligne par année : { 2027: {cout, dorese:{ao,mco,rh}}, ..., total }
  function coutLigne(ligne, idx) {
    var u = unitaire(ligne, idx);
    var res = { total: 0, totalDorese: 0, annees: {} };
    ANNEES.forEach(function (a) {
      var q = quantite(ligne, a);
      var d = { ao: u.dorese.ao * q, mco: u.dorese.mco * q, rh: u.dorese.rh * q };
      res.annees[a] = { cout: u.cout * q, dorese: d };
      res.total += u.cout * q;
      res.totalDorese += d.ao + d.mco + d.rh;
    });
    return res;
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
        if (estDansSocle(p, a, params)) socle[p.armee] = (socle[p.armee] || 0) + p.cout50;
      });
      var dorese = { ao: 0, mco: 0, rh: 0 };
      lignes.forEach(function (l) {
        if (filtre && !filtre(l)) return;
        var c = coutLigne(l, idx).annees[a];
        var arm = armeeDeLigne(l, idx);
        demandes[arm] = (demandes[arm] || 0) + c.cout;
        dorese.ao += c.dorese.ao; dorese.mco += c.dorese.mco; dorese.rh += c.dorese.rh;
      });
      var totalSocle = somme(socle);
      var totalDemandes = somme(demandes);
      var plafond = (Number((params.plafonds || {})[a]) || 0) * CASE;
      var total = totalSocle + totalDemandes;
      res[a] = {
        socle: socle,
        demandes: demandes,
        totalSocle: totalSocle,
        totalDemandes: totalDemandes,
        total: total,
        plafond: plafond,
        table: (Number(params.table) || 600) * CASE,
        marge: plafond - total,
        dorese: dorese
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
    var passes100 = {};
    lignes.forEach(function (l) {
      var q = quantite(l, annee);
      if (!q) return;
      if (l.type === "retrait") retires[l.pion] = true;
      if (l.type === "dorese") passes100[l.pion] = l;
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
      blocs.push({ armee: p.armee, nature: p.type, libelle: p.nom, cases: p.cout50 / CASE, niveau: 50 });
      if (passes100[p.id]) {
        blocs[blocs.length - 1].niveau = 100;
        blocs.push({ armee: armeeDeLigne(passes100[p.id], idx), nature: "dorese", libelle: "DORESE " + p.nom, cases: nbDorese(p) });
      }
    });
    lignes.forEach(function (l) {
      var q = quantite(l, annee);
      if (!q || l.type === "dorese" || l.type === "retrait") return;
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

  var API = {
    CASE: CASE,
    ANNEES: ANNEES,
    ARMEES: ARMEES,
    ROLES: ROLES,
    TYPES_LIGNE: TYPES_LIGNE,
    parametresParDefaut: parametresParDefaut,
    indexPions: indexPions,
    nbDorese: nbDorese,
    unitaire: unitaire,
    quantite: quantite,
    coutLigne: coutLigne,
    armeeDeLigne: armeeDeLigne,
    synthese: synthese,
    blocsAnnee: blocsAnnee
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else racine.STRAT_MOTEUR = API;
})(typeof window !== "undefined" ? window : this);
