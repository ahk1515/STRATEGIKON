// Tests du moteur de calcul : node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../js/moteur.js");

global.window = {};
eval(fs.readFileSync(path.join(__dirname, "../data/pions.js"), "utf8"));
const PIONS = global.window.STRAT_PIONS;
const IDX = M.indexPions(PIONS);
const P = M.parametresParDefaut();

test("la base compte 53 pions ; au départ seul l'A400M n'est pas à 100 %", () => {
  assert.strictEqual(PIONS.length, 53);
  const manquants = PIONS.filter((p) => M.nbManquantes(p) > 0);
  assert.deepStrictEqual(manquants.map((p) => p.id), ["P27"]);
  assert.strictEqual(M.nbManquantes(IDX.P27), 1);
});

test("situation de départ : la photo 2027 (39,9 Md€), répétée jusqu'en 2032", () => {
  const s = M.synthese(PIONS, [], P);
  M.ANNEES.forEach((a) => assert.strictEqual(s[a].totalSocle, 39900));
  assert.strictEqual(s[2027].plafond, 59000);
  assert.strictEqual(s[2027].marge, 59000 - 39900);
});

test("un pion orange activé une année ne compte que cette année-là", () => {
  const p = M.parametresParDefaut();
  p.aleas = { P12: [2029], P13: [] };
  const s = M.synthese(PIONS, [], p);
  assert.strictEqual(s[2029].totalSocle - s[2028].totalSocle, 2500);
});

test("+1 Serval à 100 % en 2028 coûte 600 M€ et 3 DORESE", () => {
  const l = { role: "EMAT", type: "ajout", pion: "P24", niveau: 100, qte: { 2028: 1 } };
  const c = M.coutLigne(l, IDX);
  assert.strictEqual(c.annees[2028].cout, 600);
  assert.strictEqual(c.annees[2027].cout, 0);
  assert.strictEqual(c.totalDorese, 3);
});

test("renforcer l'A400M coûte la DORESE qui manque : 1 case par an", () => {
  const l = { role: "EMAAE", type: "dorese", pion: "P27", qte: { 2027: 1, 2028: 1, 2029: 1, 2030: 1, 2031: 1, 2032: 1 } };
  assert.strictEqual(M.coutLigne(l, IDX).total, 6 * 100);
  const rafale = { role: "EMAAE", type: "dorese", pion: "P33", qte: { 2027: 1 } };
  assert.strictEqual(M.coutLigne(rafale, IDX).total, 0);
});

test("une ligne DORESE ne peut compter qu'un exemplaire par an", () => {
  const l = { role: "EMAAE", type: "dorese", pion: "P27", qte: { 2027: 5 } };
  assert.strictEqual(M.coutLigne(l, IDX).annees[2027].cout, 100);
});

test("le surcoût est imputé à l'armée choisie sur la ligne", () => {
  const l = { role: "DGRIS", type: "libre", libelle: "Roumanie", cout_unitaire: 200, armee: "Terre", qte: { 2027: 1 } };
  const s = M.synthese(PIONS, [l], P)[2027];
  assert.strictEqual(s.demandes.Terre, 200);
  assert.strictEqual(s.demandes["Interarmées"], 0);
});

test("un retrait libère la place du pion tel qu'il est posé", () => {
  const l = { role: "EMAT", type: "retrait", pion: "P24", qte: { 2030: 1 } };
  const s = M.synthese(PIONS, [l], P);
  assert.strictEqual(s[2030].total, s[2029].total - 600);
});

test("la grille pose les DORESE juste après leur capacité", () => {
  const l = { role: "EMAAE", type: "dorese", pion: "P27", qte: { 2027: 1 } };
  const blocs = M.blocsAnnee(PIONS, [l], P, 2027);
  const i = blocs.findIndex((b) => b.libelle === "Capacité A400M");
  assert.strictEqual(blocs[i].niveau, 100);
  assert.strictEqual(blocs[i + 1].nature, "dorese");
  assert.strictEqual(blocs[i + 1].cases, 2);
  assert.strictEqual(blocs[i + 2].cases, 1);
  const totalCases = blocs.reduce((s, b) => s + b.cases, 0);
  assert.strictEqual(totalCases, 399 + 1);
});

test("placement : formes réelles, aucun chevauchement, DORESE au contact", () => {
  const L = [
    { id: "a", role: "EMAAE", type: "dorese", pion: "P27", qte: { 2027: 1 } },
    { id: "b", role: "EMAAE", type: "dorese", pion: "P33", qte: { 2027: 1 } },
    { id: "c", role: "EMAT", type: "ajout", pion: "P22", niveau: 100, qte: { 2027: 2 } },
    { id: "d", role: "DGRIS", type: "libre", libelle: "Roumanie", cout_unitaire: 200, armee: "Terre", qte: { 2027: 1 } }
  ];
  const t = M.placerAnnee(PIONS, L, P, 2027);
  const occ = new Map();
  const poser = (r, c) => { const k = r + ":" + c; assert.ok(!occ.has(k), "chevauchement en " + k); occ.set(k, true); };
  t.pieces.forEach((p) => { for (let i = p.r; i < p.r + p.h; i++) for (let j = p.c; j < p.c + p.w; j++) poser(i, j); });
  t.cellules.forEach((c) => poser(c.r, c.c));
  const total = M.synthese(PIONS, L, P)[2027].total / 100;
  assert.strictEqual(occ.size, total);
  assert.strictEqual(t.occupees, total);
  const rafale = t.pieces.find((p) => p.libelle === "Capacité Rafale");
  assert.strictEqual(rafale.w * rafale.h, 8);
  const dorRafale = t.cellules.filter((c) => c.nature === "dorese" && c.libelle.endsWith("Capacité Rafale"));
  assert.strictEqual(dorRafale.length, 5);
  dorRafale.forEach((d) => assert.ok(!d.loin, "DORESE posée loin de sa capacité"));
});

test("arbitrage : renoncé retire la ligne, différé la décale et reporte hors LPM", () => {
  const l = { id: "x", role: "EMAT", type: "ajout", pion: "P24", niveau: 50, qte: { 2031: 1, 2032: 1 } };
  const p = M.parametresParDefaut();
  p.arbitrages = { x: { statut: "differe", decalage: 1 } };
  const la = M.ligneArbitree(l, p);
  assert.deepStrictEqual(la.qte, { 2032: 1 });
  assert.strictEqual(M.reportHorsLpm(l, p, IDX), 300);
  p.arbitrages.x = { statut: "renonce" };
  assert.strictEqual(M.lignesApresArbitrage([l], p).length, 0);
  assert.strictEqual(M.arrondiCase(150), 200);
  assert.strictEqual(M.arrondiCase(249), 200);
});

test("repasser une capacité à 50 % rend ses DORESE et les ôte de la table", () => {
  const l = { id: "g", role: "EMAAE", type: "degrade", pion: "P33", qte: { 2027: 1 } };
  assert.strictEqual(M.coutLigne(l, IDX).annees[2027].cout, -500);
  const s = M.synthese(PIONS, [l], P)[2027];
  assert.strictEqual(s.total, 39900 - 500);
  const t = M.placerAnnee(PIONS, [l], P, 2027);
  const rafale = t.pieces.find((p) => p.libelle === "Capacité Rafale");
  assert.strictEqual(rafale.niveau, 50);
  assert.strictEqual(t.cellules.filter((c) => c.libelle.endsWith("Capacité Rafale")).length, 0);
  assert.strictEqual(t.occupees, 399 - 5);
});

test("les pions ajoutés en attente d'arbitrage sont posés côte à côte, à part du socle", () => {
  const L = [
    { id: "a1", role: "EMAT", type: "ajout", pion: "P24", niveau: 100, qte: { 2027: 1 } },
    { id: "a2", role: "EMM", type: "ajout", pion: "P42", niveau: 50, qte: { 2027: 1 } },
    { id: "a3", role: "EMAAE", type: "ajout", pion: "P31", niveau: 50, qte: { 2027: 1 } }
  ];
  const p = M.parametresParDefaut();
  p.arbitrages = { a3: { statut: "retenu" } };
  const t = M.placerAnnee(PIONS, L, p, 2027);
  const att = t.pieces.filter((x) => x.groupe === "Attente");
  assert.deepStrictEqual(att.map((x) => x.statut).sort(), ["attente", "attente"]);
  const bas = Math.max(...t.pieces.filter((x) => x.groupe !== "Attente").map((x) => x.r + x.h));
  att.forEach((x) => assert.ok(x.r >= bas, "pion en attente mêlé au socle"));
  const c130 = t.pieces.find((x) => x.libelle === "+ Capacité C130J");
  assert.strictEqual(c130.groupe, "Air et Espace");
  assert.strictEqual(c130.statut, null);
});

// ---------- Lot de conception : priorités, contraintes, financements, enveloppes, flottaison, trajectoire ----------
function pp(extra) { return Object.assign(M.parametresParDefaut(), extra || {}); }
const ANS = (v) => ({ 2027: v, 2028: v, 2029: v, 2030: v, 2031: v, 2032: v });

test("priorité : le pôle fixe, le CEMA modifie, les deux sont gardées", () => {
  const l = { id: "a", priorite: 3 };
  assert.deepStrictEqual([M.prioriteDe(l, pp()).pole, M.prioriteDe(l, pp()).valeur], [3, 3]);
  const p = pp({ priorites: { a: 1 } });
  assert.deepStrictEqual([M.prioriteDe(l, p).pole, M.prioriteDe(l, p).cema, M.prioriteDe(l, p).valeur], [3, 1, 1]);
  assert.strictEqual(M.prioriteDe({ id: "b" }, pp()).valeur, 4); // non fixée : comptée en P4
});

test("contrainte politique : SMV contraint d'office ; une ligne contrainte n'est pas arbitrable", () => {
  assert.ok(M.contrainteAcquise("pion:P12", pp()));
  assert.ok(!M.contrainteAcquise("pion:P12", pp({ contraintes: { "pion:P12": null } })));
  const p = pp({ contraintes: { x: { etat: "acquise", par: "MINARM" } }, arbitrages: { x: { statut: "renonce" } } });
  assert.strictEqual(M.arbitrageDe({ id: "x" }, p).statut, "retenu");
  const d = pp({ contraintes: { x: { etat: "demandee", par: "EMAT" } } });
  assert.strictEqual(M.arbitrageDe({ id: "x" }, d).statut, "attente");
});

test("financement mutualisé : seule la part française compte, après validation de l'animateur", () => {
  const l = { id: "m", role: "DGRIS", type: "libre", cout_unitaire: 400, armee: "Terre", qte: ANS(1) };
  const propose = pp({ financements: { m: { mode: "mutualise", part: 50, partenaires: "Allemagne" } } });
  assert.strictEqual(M.synthese(PIONS, [l], propose)[2028].totalDemandes, 400);
  const valide = pp({ financements: { m: { mode: "mutualise", part: 50, partenaires: "Allemagne", valide: true } } });
  const s = M.synthese(PIONS, [l], valide)[2028];
  assert.strictEqual(s.totalDemandes, 200);
  assert.strictEqual(s.allie, 200);
  // Défection alliée : la part française remonte.
  valide.defections = { m: true };
  assert.strictEqual(M.synthese(PIONS, [l], valide)[2028].totalDemandes, 400);
});

test("subvention UE déduite ; prêt UE : soulagement immédiat, remboursement sur 3 ans", () => {
  const l = { id: "s", role: "DGA", type: "libre", cout_unitaire: 300, qte: { 2027: 1 } };
  const sub = pp({ financements: { s: { mode: "subvention", part: 100 / 3 * 1, valide: true } } });
  assert.strictEqual(M.synthese(PIONS, [l], sub)[2027].totalDemandes, 200);
  const pret = pp({ financements: { s: { mode: "pret", part: 100, valide: true } } });
  const s = M.synthese(PIONS, [l], pret);
  assert.deepStrictEqual(M.ANNEES.map((a) => s[a].totalDemandes), [0, 100, 100, 100, 0, 0]);
  const tard = { id: "s", role: "DGA", type: "libre", cout_unitaire: 300, qte: { 2031: 1 } };
  assert.strictEqual(M.remboursements(tard, IDX, pret).hors, 200);
});

test("enveloppe R&D DGA (900 M€) : les lignes rangées dedans ne pèsent que pour leur excédent", () => {
  const l1 = { id: "e1", role: "DGA", type: "libre", cout_unitaire: 600, enveloppe: "rd-dga", priorite: 1, qte: { 2028: 1 } };
  const l2 = { id: "e2", role: "DGA", type: "libre", cout_unitaire: 500, enveloppe: "rd-dga", priorite: 2, qte: { 2028: 1 } };
  const p = pp();
  const et = M.etatEnveloppe(M.enveloppesDe(p)[0], PIONS, [l2, l1], p, 2028);
  assert.deepStrictEqual(et.items.map((i) => [i.ligne.id, i.tient]), [["e1", true], ["e2", false]]);
  assert.strictEqual(et.depassement, 200);
  assert.strictEqual(M.synthese(PIONS, [l1, l2], p)[2028].totalDemandes, 200);
  const t = M.placerAnnee(PIONS, [l1, l2], p, 2028);
  assert.strictEqual(t.cellules.filter((c) => c.enveloppe === "rd-dga").length, 2);
  // Parties anciennes sans enveloppes en paramètres : l'enveloppe par défaut s'applique.
  const ancien = pp(); delete ancien.enveloppes;
  assert.strictEqual(M.enveloppesDe(ancien)[0].montant, 900);
});

test("flottaison : contraintes d'abord, puis P1 à P4 ; ce qui dépasse le plafond passe sous la ligne", () => {
  const p = pp({ plafonds: Object.assign({}, M.parametresParDefaut().plafonds, { 2030: 420 }) });
  // socle 2030 : 39 900 ; plafond 42 000 ; marge 2 100.
  const L = (id, c, pr) => ({ id, role: "EMAT", type: "libre", cout_unitaire: c, priorite: pr, qte: { 2030: 1 }, cree_le: id });
  const lignes = [L("p4", 1000, 4), L("p1", 1000, 1), L("p2", 1000, 2), { id: "eco", role: "EMAT", type: "retrait", pion: "P19", qte: { 2030: 1 } }];
  const f = M.flottaison(PIONS, lignes, p, 2030);
  assert.strictEqual(f.base, 39900 - 400);
  assert.deepStrictEqual(f.items.map((i) => [i.ligne.id, i.sous]), [["p1", false], ["p2", false], ["p4", true]]);
  p.contraintes = { p4: { etat: "acquise", par: "MINARM" } };
  assert.deepStrictEqual(M.flottaison(PIONS, lignes, p, 2030).items.map((i) => [i.ligne.id, i.sous]), [["p4", false], ["p1", false], ["p2", true]]);
});

test("trajectoire : une ligne cible entre l'année choisie ; un programme en tranches paie N1, N2…", () => {
  const c = { id: "c", role: "EMAT", type: "ajout", pion: "P24", niveau: 100, cible: true, qte: { 2032: 1 } };
  assert.deepStrictEqual(M.ANNEES.map((a) => M.quantite(M.ligneEffective(c, pp()), a)), [0, 0, 0, 0, 0, 1]);
  assert.deepStrictEqual(M.ANNEES.map((a) => M.quantite(M.ligneEffective(c, pp({ debuts: { c: 2029 } })), a)), [0, 0, 1, 1, 1, 1]);
  const t = { id: "t", role: "DGA", type: "libre", cout_unitaire: 300, cible: true, tranches: [300, 500, 200], qte: { 2032: 1 } };
  const e = M.ligneEffective(t, pp({ debuts: { t: 2031 } }));
  const cl = M.coutLigne(e, IDX);
  assert.deepStrictEqual(M.ANNEES.map((a) => cl.annees[a].cout), [0, 0, 0, 0, 300, 500]);
  assert.strictEqual(e.horsLpm, 200);
});

test("étalement automatique : par priorité, à la première année qui tient ; le reste glisse après 2032", () => {
  // Plafond serré : 405 cases (40 500) chaque année ; socle 39 900 ; marge 600 par an.
  const p = pp({ plafonds: ANS(405) });
  const L = (id, pion, pr) => ({ id, role: "EMAT", type: "ajout", pion, niveau: 100, cible: true, priorite: pr, qte: { 2032: 1 }, cree_le: id });
  const lignes = [L("b", "P25", 2), L("a", "P24", 1), L("z", "P26", 3)];
  p.arbitrages = { a: { statut: "retenu" }, b: { statut: "retenu" }, z: { statut: "retenu" } };
  const r = M.etalerAuto(PIONS, lignes, p);
  assert.strictEqual(r.debuts.a, 2027);          // P1 entre tout de suite (600)
  assert.strictEqual(r.debuts.b, M.APRES_LPM);   // plus de place : glisse
  assert.deepStrictEqual(r.horsLpm.sort(), ["b", "z"]);
});
