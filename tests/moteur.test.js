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

test("la base compte 52 pions et le passage à 100 % coûte 7,4 Md€", () => {
  assert.strictEqual(PIONS.length, 52);
  const surcout = PIONS.reduce((s, p) => s + (p.cout100 - p.cout50), 0);
  assert.strictEqual(surcout, 7400);
});

test("socle 2027 : gris + violets + capacités à 50 %, sans les pions orange", () => {
  const s = M.synthese(PIONS, [], P)[2027];
  assert.strictEqual(s.totalSocle, 9000 + 2900 + 14400);
  assert.strictEqual(s.plafond, 59000);
  assert.strictEqual(s.marge, 59000 - 26300);
});

test("un pion orange activé une année ne compte que cette année-là", () => {
  const p = M.parametresParDefaut();
  p.aleas = { P12: [2029] };
  const s = M.synthese(PIONS, [], p);
  assert.strictEqual(s[2029].totalSocle - s[2028].totalSocle, 2500);
});

test("+1 Serval à 100 % en 2028 coûte 500 M€ et 2 DORESE", () => {
  const l = { role: "EMAT", type: "ajout", pion: "P24", niveau: 100, qte: { 2028: 1 } };
  const c = M.coutLigne(l, IDX);
  assert.strictEqual(c.annees[2028].cout, 500);
  assert.strictEqual(c.annees[2027].cout, 0);
  assert.strictEqual(c.totalDorese, 2);
});

test("passer le Rafale à 100 % sur 6 ans coûte 5 cases par an", () => {
  const l = { role: "EMAAE", type: "dorese", pion: "P33", qte: { 2027: 1, 2028: 1, 2029: 1, 2030: 1, 2031: 1, 2032: 1 } };
  assert.strictEqual(M.coutLigne(l, IDX).total, 6 * 500);
});

test("une ligne DORESE ne peut compter qu'un exemplaire par an", () => {
  const l = { role: "EMAT", type: "dorese", pion: "P24", qte: { 2027: 5 } };
  assert.strictEqual(M.coutLigne(l, IDX).annees[2027].cout, 200);
});

test("le surcoût est imputé à l'armée choisie sur la ligne", () => {
  const l = { role: "DGRIS", type: "libre", libelle: "Roumanie", cout_unitaire: 200, armee: "Terre", qte: { 2027: 1 } };
  const s = M.synthese(PIONS, [l], P)[2027];
  assert.strictEqual(s.demandes.Terre, 200);
  assert.strictEqual(s.demandes["Interarmées"], 0);
});

test("un retrait libère la place du pion", () => {
  const l = { role: "EMAT", type: "retrait", pion: "P24", qte: { 2030: 1 } };
  const s = M.synthese(PIONS, [l], P);
  assert.strictEqual(s[2030].total, s[2029].total - 300);
});

test("la grille pose les DORESE juste après leur capacité", () => {
  const l = { role: "EMAT", type: "dorese", pion: "P24", qte: { 2027: 1 } };
  const blocs = M.blocsAnnee(PIONS, [l], P, 2027);
  const i = blocs.findIndex((b) => b.libelle === "Brigade Serval 1");
  assert.strictEqual(blocs[i].niveau, 100);
  assert.strictEqual(blocs[i + 1].nature, "dorese");
  assert.strictEqual(blocs[i + 1].cases, 2);
  const totalCases = blocs.reduce((s, b) => s + b.cases, 0);
  assert.strictEqual(totalCases, 263 + 2);
});
