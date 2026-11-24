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
    libre: "Option du catalogue ou pion sur mesure"
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
        annee: a,
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


  // ---------- Placement sur la table (grille de 30 colonnes) ----------
  // Pose les pions avec leur forme réelle, groupe par groupe (dépenses fixes, puis chaque armée).
  // Pions rigides : socle et pions ajoutés (largeur x hauteur, rotation permise).
  // Les DORESE d'une capacité à 100 % sont posées au contact de la capacité.
  // Les montants libres (investissements, options, pions sur mesure) sont sécables :
  // ils comblent les cases restantes de leur groupe.
  var LARGEUR = 30;
  var ORDRE_GROUPES = ["Fixes", "Interarmées", "Terre", "Marine", "Air et Espace"];

  function Plateau(lignesInit) {
    this.l = LARGEUR;
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
  Plateau.prototype.premiereLigneLibre = function () {
    for (var k = 0; k < this.occ.length; k++) if (this.occ[k] === null) return Math.floor(k / this.l);
    return this.h;
  };

  function placerAnnee(pions, lignes, params, annee) {
    var idx = indexPions(pions);
    params = params || parametresParDefaut();
    var tableCases = Number(params.table) || 600;
    var plateau = new Plateau(Math.ceil(tableCases / LARGEUR));
    var pieces = [];
    var retires = {}, passes100 = {};
    lignes.forEach(function (l) {
      if (!quantite(l, annee)) return;
      if (l.type === "retrait") retires[l.pion] = true;
      if (l.type === "dorese") passes100[l.pion] = l;
    });

    // Constitution des groupes.
    var groupes = {};
    ORDRE_GROUPES.forEach(function (g) { groupes[g] = { rigides: [], secables: [] }; });
    function groupe(nom) { return groupes[nom] || groupes["Interarmées"]; }
    pions.forEach(function (p) {
      if (!estDansSocle(p, annee, params) || retires[p.id]) return;
      var l100 = passes100[p.id];
      var g = p.type === "gris" ? "Fixes" : (l100 ? armeeDeLigne(l100, idx) : p.armee);
      groupe(g).rigides.push({ pion: p, w: p.l || 1, h: p.h || 1, armee: g === "Fixes" ? p.armee : g, nature: p.type,
        libelle: p.nom, niveau: l100 ? 100 : 50, dorese: l100 ? nbDorese(p) : 0, detailDorese: p.dorese, socle: true });
    });
    lignes.forEach(function (l) {
      var q = quantite(l, annee);
      if (!q || l.type === "dorese" || l.type === "retrait") return;
      var arm = armeeDeLigne(l, idx);
      if (l.type === "ajout") {
        var p = idx[l.pion];
        if (!p) return;
        for (var i = 0; i < q; i++) {
          var cent = Number(l.niveau) === 100;
          groupe(arm).rigides.push({ pion: p, w: p.l || 1, h: p.h || 1, armee: arm, nature: p.type, libelle: "+ " + p.nom,
            niveau: cent ? 100 : 50, dorese: cent ? nbDorese(p) : 0, detailDorese: p.dorese, role: l.role, ligne: l.id });
        }
      } else if (l.type === "libre") {
        var n = Math.round((Number(l.cout_unitaire) || 0) * q / CASE);
        if (n > 0) groupe(arm).secables.push({ cases: n, armee: arm, nature: "libre", libelle: l.libelle || "Ligne libre", role: l.role, ligne: l.id, horsCatalogue: !l.modele });
      }
    });

    var cellules = []; // cases isolées : DORESE et montants sécables
    ORDRE_GROUPES.forEach(function (nomG) {
      var g = groupes[nomG];
      if (!g.rigides.length && !g.secables.length) return;
      var r0 = plateau.premiereLigneLibre();
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
          niveau: it.nature === "capacite" ? it.niveau : null, role: it.role || null, groupe: nomG, cases: pos.w * pos.h });
        // DORESE au contact : cases libres voisines de la capacité (ou de ses DORESE déjà posées).
        var types = [];
        ["ao", "mco", "rh"].forEach(function (k) { for (var n = 0; n < (it.detailDorese || {})[k]; n++) types.push(k); });
        var amas = [{ r: pos.r, c: pos.c, w: pos.w, h: pos.h }];
        types.slice(0, it.dorese).forEach(function (t) {
          var cand = voisinLibre(plateau, amas);
          if (!cand) { var p2 = plateau.chercher(1, 1, r0); cand = { r: p2.r, c: p2.c, loin: true }; }
          plateau.marquer(cand.r, cand.c, 1, 1, "d" + id);
          amas.push({ r: cand.r, c: cand.c, w: 1, h: 1 });
          cellules.push({ r: cand.r, c: cand.c, armee: it.armee, nature: "dorese", type: t, libelle: "DORESE " + t.toUpperCase() + " · " + it.libelle, role: it.role || null, loin: !!cand.loin });
        });
      });
      // Montants sécables : on comble les trous du groupe, dans l'ordre de lecture.
      g.secables.forEach(function (it) {
        var reste = it.cases;
        var k = r0 * plateau.l;
        while (reste > 0) {
          if (k >= plateau.occ.length) plateau.agrandir(1);
          if (plateau.occ[k] === null) {
            plateau.occ[k] = "s";
            cellules.push({ r: Math.floor(k / plateau.l), c: k % plateau.l, armee: it.armee, nature: "libre", libelle: it.libelle, role: it.role, horsCatalogue: it.horsCatalogue });
            reste--;
          }
          k++;
        }
      });
    });

    return {
      largeur: LARGEUR,
      hauteur: Math.max(plateau.h, Math.ceil(tableCases / LARGEUR)),
      table: tableCases,
      plafond: Number((params.plafonds || {})[annee]) || 0,
      occupees: plateau.occ.filter(function (x) { return x !== null; }).length,
      pieces: pieces,
      cellules: cellules
    };
  }

  function voisinLibre(plateau, amas) {
    var meilleur = null;
    amas.forEach(function (b) {
      for (var r = b.r - 1; r <= b.r + b.h; r++) {
        for (var c = b.c - 1; c <= b.c + b.w; c++) {
          var bord = (r === b.r - 1 || r === b.r + b.h) !== (c === b.c - 1 || c === b.c + b.w); // côté, pas coin
          if (!bord || !plateau.libre(r, c)) continue;
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
    blocsAnnee: blocsAnnee,
    placerAnnee: placerAnnee,
    STATUTS: STATUTS,
    arbitrageDe: arbitrageDe,
    ligneArbitree: ligneArbitree,
    lignesApresArbitrage: lignesApresArbitrage,
    reportHorsLpm: reportHorsLpm,
    arrondiCase: arrondiCase,
    LARGEUR: LARGEUR
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else racine.STRAT_MOTEUR = API;
})(typeof window !== "undefined" ? window : this);
