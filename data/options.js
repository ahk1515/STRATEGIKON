// Options chiffrées tirées des fiches de rôle (DGRIS, DGA). Elles servent de modèles
// de « lignes libres » : le joueur les choisit puis ajuste montants et années.
// Montants en M€ par année. « source » renvoie à la fiche ; tout est à valider par l'animateur.
window.STRAT_OPTIONS = [
  { code: "DGRIS-ROU", role: "DGRIS", armee: "Interarmées", libelle: "Renforcement Roumanie (forces terrestres, navales et aériennes)", cout: 200, source: "Fiche DGRIS" },
  { code: "DGRIS-POL-HUB", role: "DGRIS", armee: "Terre", libelle: "Hub divisionnaire Pologne", cout: 200, source: "Fiche DGRIS (150 à 300 M€/an)" },
  { code: "DGRIS-POL-LOG", role: "DGRIS", armee: "Terre", libelle: "Hub logistique Pologne", cout: 300, source: "Fiche DGRIS (250 M€, arrondi à la case)" },
  { code: "DGRIS-POL-PRE", role: "DGRIS", armee: "Interarmées", libelle: "Forces prépositionnées en Pologne (air et terre)", cout: 100, source: "Fiche DGRIS" },
  { code: "DGRIS-BAL", role: "DGRIS", armee: "Interarmées", libelle: "Base Baltique", cout: 200, source: "Fiche DGRIS (150 M€, arrondi à la case)" },
  { code: "DGRIS-DJI", role: "DGRIS", armee: "Interarmées", libelle: "Renforcement Djibouti", cout: 100, source: "Fiche DGRIS" },
  { code: "DGRIS-IPAC", role: "DGRIS", armee: "Interarmées", libelle: "Renforcement Indo-Pacifique", cout: 200, source: "Fiche DGRIS" },
  { code: "DGA-SAMPT", role: "DGA", armee: "Air et Espace", libelle: "Système sol-air SAMP/T NG (investissement)", cout: 400, dorese: { ao: 0, mco: 1, rh: 0 }, source: "Fiche DGA" },
  { code: "DGA-SEAD", role: "DGA", armee: "Air et Espace", libelle: "Escadron SEAD Rafale F5 + munitions", cout: 400, dorese: { ao: 0, mco: 1, rh: 2 }, source: "Fiche DGA" },
  { code: "DGA-MGCS", role: "DGA", armee: "Terre", libelle: "Escadron MGCS (12 chars + soutien)", cout: 400, dorese: { ao: 0, mco: 1, rh: 1 }, source: "Fiche DGA" },
  { code: "DGA-CIFS", role: "DGA", armee: "Terre", libelle: "Batterie CIFS (artillerie du futur)", cout: 100, source: "Fiche DGA" },
  { code: "DGA-EURODRONE", role: "DGA", armee: "Air et Espace", libelle: "Eurodrone (3 drones + soutien)", cout: 200, dorese: { ao: 0, mco: 1, rh: 1 }, source: "Fiche DGA" },
  { code: "DGA-IA-C2", role: "DGA", armee: "Interarmées", libelle: "IA C2 interarmées", cout: 300, dorese: { ao: 0, mco: 1, rh: 1 }, source: "Fiche DGA" },
  { code: "DGA-LAD", role: "DGA", armee: "Interarmées", libelle: "Lutte anti-drones, système intégré", cout: 100, source: "Fiche DGA" },
  { code: "DGA-ARGONAUTE", role: "DGA", armee: "Air et Espace", libelle: "Argonaute (spatial), annuité", cout: 200, source: "Fiche DGA (lancement 500 M€ puis 200 M€/an)" },
  { code: "DGA-HYPER", role: "DGA", armee: "Interarmées", libelle: "Missiles hypersoniques (opérationnel N+5)", cout: 200, source: "Fiche DGA" },
  { code: "DGA-QUANT", role: "DGA", armee: "Interarmées", libelle: "Cyberdéfense quantique", cout: 200, source: "Fiche DGA" },
  { code: "DGA-ESSAIM", role: "DGA", armee: "Interarmées", libelle: "Essaim de drones (opérationnel N+6)", cout: 200, source: "Fiche DGA" },
  { code: "DGA-MUN-155", role: "DGA", armee: "Terre", libelle: "Stock 30 jours artillerie division", cout: 100, source: "Fiche DGA" },
  { code: "DGA-QUAI", role: "DGA", armee: "Marine", libelle: "Quai permanent porte-avions", cout: 300, source: "Fiche DGA (actif en N+3)" }
];
