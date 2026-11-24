// Teste apps-script/Code.gs avec une fausse feuille Google : node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");

function fauxGoogle() {
  const feuilles = {};
  function Feuille(nom) {
    this.nom = nom; this.cellules = [];
  }
  Feuille.prototype.getLastRow = function () { return this.cellules.length; };
  Feuille.prototype.getLastColumn = function () { return Math.max(0, ...this.cellules.map((l) => l.length)); };
  Feuille.prototype.appendRow = function (v) {
    // Comme Sheets : une apostrophe en tête force le texte et disparaît ; une date ISO devient une Date.
    this.cellules.push(v.map((x) => (typeof x === "string" && x[0] === "'" ? x.slice(1) : (typeof x === "string" && /^\d{4}-\d\d-\d\dT/.test(x) ? new Date(x) : x))));
  };
  Feuille.prototype.deleteRow = function (r) { this.cellules.splice(r - 1, 1); };
  Feuille.prototype.setFrozenRows = function () {};
  Feuille.prototype.getRange = function (r, c, nr, nc) {
    const f = this;
    nr = nr || 1; nc = nc || 1;
    return {
      setValues(v) { v.forEach((ligne, i) => ligne.forEach((x, j) => { (f.cellules[r - 1 + i] = f.cellules[r - 1 + i] || [])[c - 1 + j] = x; })); return this; },
      setValue(x) { (f.cellules[r - 1] = f.cellules[r - 1] || [])[c - 1] = x; return this; },
      setFontWeight() { return this; },
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const l = []; for (let j = 0; j < nc; j++) l.push((f.cellules[r - 1 + i] || [])[c - 1 + j] ?? ""); out.push(l); } return out; }
    };
  };
  return {
    feuilles,
    SpreadsheetApp: { getActive: () => ({ getSheetByName: (n) => feuilles[n] || null, insertSheet: (n) => (feuilles[n] = new Feuille(n)) }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
      computeDigest: (alg, t) => [...crypto.createHash("sha256").update(t, "utf8").digest()].map((b) => (b > 127 ? b - 256 : b)),
      getUuid: () => crypto.randomUUID()
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 1 } },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) }
  };
}

function charger() {
  const g = fauxGoogle();
  const ctx = vm.createContext(Object.assign({ JSON, Date, String, Math }, g));
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../apps-script/Code.gs"), "utf8"), ctx);
  ctx.api = (action, args) => JSON.parse(ctx.appeler(action, args));
  return ctx;
}

test("créer, ouvrir, écrire, relire et supprimer dans une partie", () => {
  const s = charger();
  const p = s.api("creerPartie", { nom: "Bageia 5", mdp: "secret", params: { table: 600 } });
  assert.strictEqual(p.nom, "Bageia 5");
  assert.deepStrictEqual(s.api("listerParties").map((x) => x.nom), ["Bageia 5"]);
  assert.throws(() => s.api("creerPartie", { nom: "bageia 5 ", mdp: "autre" }), /déjà ce nom/);
  assert.throws(() => s.api("ouvrirPartie", { nom: "Bageia 5", mdp: "faux" }), /Mot de passe incorrect/);
  assert.strictEqual(s.api("ouvrirPartie", { nom: "bageia 5", mdp: "secret" }).id, p.id);

  const l = { id: "l1", role: "EMAT", type: "ajout", pion: "P24", niveau: 100, qte: { 2028: 1 } };
  s.api("ecrireLigne", { nom: "Bageia 5", mdp: "secret", ligne: l });
  l.qte[2029] = 2;
  s.api("ecrireLigne", { nom: "Bageia 5", mdp: "secret", ligne: l });
  let e = s.api("lireEtat", { nom: "Bageia 5", mdp: "secret" });
  assert.strictEqual(e.lignes.length, 1);
  assert.deepStrictEqual(e.lignes[0].qte, { 2028: 1, 2029: 2 });
  assert.strictEqual(e.lignes[0].role, "EMAT");

  s.api("majParams", { nom: "Bageia 5", mdp: "secret", params: { table: 600, plafonds: { 2027: 590 } } });
  e = s.api("lireEtat", { nom: "Bageia 5", mdp: "secret" });
  assert.strictEqual(e.partie.params.plafonds[2027], 590);

  s.api("supprimerLigne", { nom: "Bageia 5", mdp: "secret", id: "l1" });
  assert.strictEqual(s.api("lireEtat", { nom: "Bageia 5", mdp: "secret" }).lignes.length, 0);
});

test("deux parties ne se mélangent pas", () => {
  const s = charger();
  s.api("creerPartie", { nom: "A", mdp: "aaaa" });
  s.api("creerPartie", { nom: "B", mdp: "bbbb" });
  s.api("ecrireLigne", { nom: "A", mdp: "aaaa", ligne: { id: "x", role: "EMM", type: "libre" } });
  assert.strictEqual(s.api("lireEtat", { nom: "B", mdp: "bbbb" }).lignes.length, 0);
  assert.throws(() => s.api("ecrireLigne", { nom: "B", mdp: "bbbb", ligne: { id: "x", role: "EMM", type: "libre" } }), /autre partie/);
});

test("doPost renvoie le résultat en JSON", () => {
  const s = charger();
  const r = s.doPost({ postData: { contents: JSON.stringify({ action: "creerPartie", args: { nom: "C", mdp: "cccc" } }) } });
  assert.strictEqual(JSON.parse(r.t).ok, true);
  const r2 = s.doPost({ postData: { contents: JSON.stringify({ action: "ouvrirPartie", args: { nom: "C", mdp: "x" } }) } });
  assert.match(JSON.parse(r2.t).erreur, /Mot de passe/);
});
