/**
 * STRATEGIKON : serveur Google Apps Script.
 * Il sert la page (Index.html) et range les parties dans la feuille Google
 * à laquelle ce script est rattaché (onglets « Parties » et « Lignes », créés seuls).
 *
 * Toutes les opérations passent par api_(), qui vérifie le mot de passe de la partie.
 */

var FEUILLE_PARTIES = 'Parties';
var FEUILLE_LIGNES = 'Lignes';
var ENTETE_PARTIES = ['id', 'nom', 'sel', 'mdp_hash', 'params', 'cree_le'];
var ENTETE_LIGNES = ['id', 'partie_id', 'role', 'donnees', 'maj_le'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('STRATEGIKON LPM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Accès depuis une page hébergée ailleurs (ex. GitHub Pages) : POST {action, args}.
function doPost(e) {
  var sortie;
  try {
    var corps = JSON.parse(e.postData.contents);
    sortie = { ok: true, resultat: api_(corps.action, corps.args || {}) };
  } catch (err) {
    sortie = { ok: false, erreur: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(sortie)).setMimeType(ContentService.MimeType.JSON);
}

// Point d'entrée appelé par la page via google.script.run.
function appeler(action, args) {
  return JSON.stringify(api_(action, args || {}));
}

function api_(action, a) {
  switch (action) {
    case 'listerParties': return listerParties_();
    case 'creerPartie': return creerPartie_(a.nom, a.mdp, a.params);
    case 'ouvrirPartie': return publique_(partieAutorisee_(a.nom, a.mdp));
    case 'lireEtat': return lireEtat_(a.nom, a.mdp);
    case 'majParams': return majParams_(a.nom, a.mdp, a.params);
    case 'ecrireLigne': return ecrireLigne_(a.nom, a.mdp, a.ligne);
    case 'supprimerLigne': return supprimerLigne_(a.nom, a.mdp, a.id);
    default: throw new Error('Action inconnue : ' + action);
  }
}

// ---------- Feuilles ----------
function feuille_(nom, entete) {
  var classeur = SpreadsheetApp.getActive();
  var f = classeur.getSheetByName(nom);
  if (!f) {
    f = classeur.insertSheet(nom);
    f.getRange(1, 1, 1, entete.length).setValues([entete]).setFontWeight('bold');
    f.setFrozenRows(1);
  }
  return f;
}

function lignesDe_(f) {
  var n = f.getLastRow();
  if (n < 2) return [];
  return f.getRange(2, 1, n - 1, f.getLastColumn()).getValues();
}

function cleNom_(nom) { return String(nom || '').trim().toLowerCase(); }

function hacher_(texte) {
  var octets = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texte, Utilities.Charset.UTF_8);
  return octets.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function avecVerrou_(fn) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try { return fn(); } finally { verrou.releaseLock(); }
}

// ---------- Parties ----------
function trouverPartie_(nom) {
  var f = feuille_(FEUILLE_PARTIES, ENTETE_PARTIES);
  var lignes = lignesDe_(f);
  for (var i = 0; i < lignes.length; i++) {
    if (cleNom_(lignes[i][1]) === cleNom_(nom)) {
      return { rang: i + 2, id: lignes[i][0], nom: lignes[i][1], sel: lignes[i][2], mdp_hash: lignes[i][3], params: JSON.parse(lignes[i][4] || '{}'), cree_le: lignes[i][5] };
    }
  }
  return null;
}

function partieAutorisee_(nom, mdp) {
  var p = trouverPartie_(nom);
  if (!p) throw new Error('Partie introuvable');
  if (hacher_(p.sel + String(mdp || '')) !== p.mdp_hash) throw new Error('Mot de passe incorrect');
  return p;
}

function publique_(p) {
  return { id: p.id, nom: p.nom, params: p.params, cree_le: p.cree_le instanceof Date ? p.cree_le.toISOString() : String(p.cree_le) };
}

function listerParties_() {
  return lignesDe_(feuille_(FEUILLE_PARTIES, ENTETE_PARTIES))
    .map(function (l) { return { nom: String(l[1]), cree_le: l[5] instanceof Date ? l[5].toISOString() : String(l[5]) }; })
    .sort(function (a, b) { return a.cree_le < b.cree_le ? 1 : -1; });
}

function creerPartie_(nom, mdp, params) {
  nom = String(nom || '').trim();
  if (!nom || nom.length > 80) throw new Error('Donnez un nom de partie (80 caractères au plus)');
  if (String(mdp || '').length < 4) throw new Error('Le mot de passe doit faire au moins 4 caractères');
  return avecVerrou_(function () {
    if (trouverPartie_(nom)) throw new Error('Une partie porte déjà ce nom');
    var sel = Utilities.getUuid();
    var p = { id: Utilities.getUuid(), nom: nom, sel: sel, mdp_hash: hacher_(sel + mdp), params: params || {}, cree_le: new Date().toISOString() };
    feuille_(FEUILLE_PARTIES, ENTETE_PARTIES).appendRow([p.id, "'" + p.nom, p.sel, p.mdp_hash, JSON.stringify(p.params), p.cree_le]);
    return publique_(p);
  });
}

function majParams_(nom, mdp, params) {
  return avecVerrou_(function () {
    var p = partieAutorisee_(nom, mdp);
    feuille_(FEUILLE_PARTIES, ENTETE_PARTIES).getRange(p.rang, 5).setValue(JSON.stringify(params || {}));
    return true;
  });
}

// ---------- Lignes ----------
function lireEtat_(nom, mdp) {
  var p = partieAutorisee_(nom, mdp);
  var lignes = lignesDe_(feuille_(FEUILLE_LIGNES, ENTETE_LIGNES))
    .filter(function (l) { return l[1] === p.id; })
    .map(function (l) {
      var d = JSON.parse(l[3] || '{}');
      d.id = String(l[0]); d.role = String(l[2]);
      d.maj_le = l[4] instanceof Date ? l[4].toISOString() : String(l[4]);
      return d;
    });
  return { partie: publique_(p), lignes: lignes };
}

function ecrireLigne_(nom, mdp, ligne) {
  if (!ligne || !ligne.id || !ligne.role) throw new Error('Ligne incomplète');
  return avecVerrou_(function () {
    var p = partieAutorisee_(nom, mdp);
    var f = feuille_(FEUILLE_LIGNES, ENTETE_LIGNES);
    var donnees = JSON.parse(JSON.stringify(ligne));
    delete donnees.id; delete donnees.role; delete donnees.maj_le;
    var valeurs = [String(ligne.id), p.id, String(ligne.role), JSON.stringify(donnees), new Date().toISOString()];
    var lignes = lignesDe_(f);
    for (var i = 0; i < lignes.length; i++) {
      if (String(lignes[i][0]) === String(ligne.id)) {
        if (lignes[i][1] !== p.id) throw new Error('Cette ligne appartient à une autre partie');
        f.getRange(i + 2, 1, 1, valeurs.length).setValues([valeurs]);
        return true;
      }
    }
    f.appendRow(valeurs);
    return true;
  });
}

function supprimerLigne_(nom, mdp, id) {
  return avecVerrou_(function () {
    var p = partieAutorisee_(nom, mdp);
    var f = feuille_(FEUILLE_LIGNES, ENTETE_LIGNES);
    var lignes = lignesDe_(f);
    for (var i = lignes.length - 1; i >= 0; i--) {
      if (String(lignes[i][0]) === String(id) && lignes[i][1] === p.id) f.deleteRow(i + 2);
    }
    return true;
  });
}
