// STRATEGIKON, conception « table d'abord » : le joueur agit sur la table de l'année,
// les lignes de la base sont écrites en arrière-plan.
(function () {
  "use strict";

  var M = window.STRAT_MOTEUR;
  var S = window.STRAT_STOCKAGE;
  var PIONS = window.STRAT_PIONS || [];
  var CATALOGUE = window.STRAT_CATALOGUE_ROLES || [];
  var IDX = M.indexPions(PIONS);
  var ROLES_REGLAGES = ["Animateur", "SC-Plans", "CEMA"];
  var ROLES_ARBITRAGE = ["CEMA", "Animateur"];
  var ROLES_VUE_COMPLETE = ["CEMA", "Animateur", "SC-Plans"];
  var CLE_SESSION = "strategikon.table";

  var etat = {
    partie: null, mdp: "", role: "", lignes: [], annee: M.ANNEES[0], vue: "demandes",
    volet: "poser", filtre: "capacites", portee: "suite", recherche: "", selection: null, neuf: null, maTable: true
  };
  var enAttente = {};
  var signature = "";

  // ---------- Outils ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === "texte") n.textContent = v;
      else if (k === "classe") n.className = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
    });
    (enfants || []).forEach(function (e) { if (e !== null && e !== undefined && e !== false) n.appendChild(typeof e === "string" ? document.createTextNode(e) : e); });
    return n;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function md(m) {
    var signe = m < 0 ? "−" : "";
    m = Math.abs(m);
    if (m >= 1000) return signe + (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " Md€";
    return signe + m.toLocaleString("fr-FR") + " M€";
  }
  function couleur(a) { return { "Terre": "var(--terre)", "Marine": "var(--marine)", "Air et Espace": "var(--air)", "Interarmées": "var(--inter)" }[a] || "var(--inter)"; }
  function nouvelId() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "l-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function role(code) { return M.ROLES.filter(function (r) { return r.code === code; })[0] || M.ROLES[0]; }
  function vueComplete() { return ROLES_VUE_COMPLETE.indexOf(etat.role) !== -1; }
  function arbitre() { return ROLES_ARBITRAGE.indexOf(etat.role) !== -1; }
  function visible(l) { return vueComplete() || l.role === etat.role; }
  function params() { return (etat.partie && etat.partie.params && etat.partie.params.plafonds) ? etat.partie.params : M.parametresParDefaut(); }
  function optionDe(code) { return code ? CATALOGUE.filter(function (o) { return o.code === code; })[0] || null : null; }
  function ligneDe(id) { return id ? etat.lignes.filter(function (l) { return l.id === id; })[0] || null : null; }
  function armeeDuRole() { return role(etat.role).armee; }
  function dansMonPerimetre(p) {
    if (vueComplete()) return true;
    var a = armeeDuRole();
    return a === "Interarmées" ? true : p.armee === a;
  }
  function fourchette(o) {
    var u = o.annuel ? "/an" : "";
    if (o.cout === null || o.cout === undefined) return o.statut_cout === "a_definir" ? "coût à définir" : "non chiffré";
    if (o.cout_max && o.cout_max !== o.cout) return o.cout + " à " + o.cout_max + " M€" + u;
    return o.cout + " M€" + u;
  }
  function libelleLigne(l) {
    if (l.type === "libre") return l.libelle || "Pion sur mesure";
    var p = IDX[l.pion];
    return p ? p.nom : l.pion;
  }
  function natureLigne(l) {
    if (l.type === "ajout") return "Nouvel exemplaire à " + (Number(l.niveau) === 100 ? "100 %" : "50 %");
    if (l.type === "dorese") return "Renforcement à 100 %";
    if (l.type === "retrait") return "Dissolution";
    if (l.type === "degrade") return "Repassage à 50 %";
    return l.modele ? "Option de la fiche " + ((optionDe(l.modele) || {}).role || "") : "Pion sur mesure";
  }
  function anneesDe(l) {
    var a = M.ANNEES.filter(function (x) { return M.quantite(l, x) > 0; });
    if (!a.length) return "aucune année";
    var suite = a.length > 1 && a[a.length - 1] - a[0] === a.length - 1;
    return suite ? a[0] + "–" + a[a.length - 1] : a.join(", ");
  }
  function anneesPortee() {
    return etat.portee === "annee" ? [etat.annee] : M.ANNEES.filter(function (a) { return a >= etat.annee; });
  }
  function textePortee() {
    return etat.portee === "annee" ? "en " + etat.annee : etat.annee === M.ANNEES[M.ANNEES.length - 1] ? "en " + etat.annee : "de " + etat.annee + " à " + M.ANNEES[M.ANNEES.length - 1];
  }
  var minuteur;
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(minuteur); minuteur = setTimeout(function () { t.hidden = true; }, 2600); }
  function memoriser() {
    try {
      if (etat.partie && etat.role) sessionStorage.setItem(CLE_SESSION, JSON.stringify({ nom: etat.partie.nom, mdp: etat.mdp, role: etat.role, annee: etat.annee }));
      else sessionStorage.removeItem(CLE_SESSION);
    } catch (e) { /* rien */ }
  }

  // ---------- Accueil ----------
  function chargerParties() {
    var sel = $("rej-partie");
    vider(sel);
    return S.listerParties().then(function (liste) {
      if (!liste.length) sel.appendChild(el("option", { value: "", texte: "Aucune partie ouverte" }));
      liste.forEach(function (p) { sel.appendChild(el("option", { value: p.nom, texte: p.nom })); });
    }).catch(function (e) { sel.appendChild(el("option", { value: "", texte: "Liste indisponible" })); $("rej-erreur").textContent = e.message; });
  }
  function etapeAccueil(nom) {
    $("form-rejoindre").hidden = nom !== "rejoindre";
    $("form-creer").hidden = nom !== "creer";
    $("etape-role").hidden = nom !== "role";
  }
  function montrerRoles(partie, mdp) {
    etat.partie = partie; etat.mdp = mdp;
    $("ecran-partie").hidden = true; $("ecran-accueil").hidden = false;
    etapeAccueil("role");
    $("nom-partie-role").textContent = partie.nom;
    var g = $("grille-roles");
    vider(g);
    M.ROLES.forEach(function (r) {
      g.appendChild(el("button", { classe: "role-ligne", type: "button", style: "--c:" + couleur(r.armee), onclick: function () { entrer(r.code); } }, [
        el("b", { texte: r.code }), el("span", { texte: r.nom })
      ]));
    });
  }
  function entrer(code) {
    etat.role = code;
    etat.selection = null;
    etat.maTable = !vueComplete();
    etat.volet = "poser";
    etat.filtre = role(code).armee === "Interarmées" && CATALOGUE.some(function (o) { return o.role === code; }) ? "options" : "capacites";
    $("ecran-accueil").hidden = true;
    $("ecran-partie").hidden = false;
    $("poste-partie").textContent = etat.partie.nom;
    $("insigne-code").textContent = code;
    $("insigne-nom").textContent = role(code).nom;
    memoriser();
    signature = "";
    return recharger(true);
  }
  function quitter() {
    etat.partie = null; etat.mdp = ""; etat.role = ""; etat.lignes = []; signature = "";
    memoriser();
    $("ecran-partie").hidden = true; $("ecran-accueil").hidden = false;
    etapeAccueil("rejoindre");
    chargerParties();
  }

  // ---------- Données ----------
  function recharger(forcer) {
    if (!etat.partie) return Promise.resolve();
    var nom = etat.partie.nom;
    return S.lireEtat(nom, etat.mdp).then(function (e) {
      if (!etat.partie || etat.partie.nom !== nom) return;
      var lignes = e.lignes.slice().sort(function (a, b) { return (a.cree_le || "") < (b.cree_le || "") ? -1 : 1; });
      lignes = lignes.map(function (l) { return enAttente[l.id] ? (ligneDe(l.id) || l) : l; });
      etat.lignes.forEach(function (l) { if (enAttente[l.id] && !lignes.some(function (x) { return x.id === l.id; })) lignes.push(l); });
      var sig = JSON.stringify(lignes) + JSON.stringify(e.partie.params);
      etat.partie.params = e.partie.params;
      etat.lignes = lignes;
      if (forcer || sig !== signature) { signature = sig; rendre(forcer); }
    }).catch(function (e) { toast(e.message); });
  }
  function enregistrer(l) {
    clearTimeout(enAttente[l.id]);
    enAttente[l.id] = setTimeout(function () {
      S.ecrireLigne(etat.partie.nom, etat.mdp, l).then(function () { delete enAttente[l.id]; })
        .catch(function (e) { delete enAttente[l.id]; toast("Non enregistré : " + e.message); });
    }, 350);
  }
  function supprimer(l) {
    clearTimeout(enAttente[l.id]); delete enAttente[l.id];
    etat.lignes = etat.lignes.filter(function (x) { return x.id !== l.id; });
    S.supprimerLigne(etat.partie.nom, etat.mdp, l.id).catch(function (e) { toast(e.message); });
  }
  var fileParams = Promise.resolve();
  function modifierParams(fn) {
    fileParams = fileParams.then(function () {
      return S.lireEtat(etat.partie.nom, etat.mdp).then(function (e) {
        var p = e.partie.params && e.partie.params.plafonds ? e.partie.params : M.parametresParDefaut();
        fn(p);
        return S.majParams(etat.partie.nom, etat.mdp, p).then(function () { etat.partie.params = p; rendre(false); });
      });
    }).catch(function (e) { toast("Non enregistré : " + e.message); });
    return fileParams;
  }

  // ---------- Gestes sur la table : ils écrivent les lignes ----------
  function memeGeste(l, g) {
    if (l.role !== etat.role || l.type !== g.type) return false;
    if (g.type === "ajout") return l.pion === g.pion && Number(l.niveau) === Number(g.niveau);
    if (g.type === "dorese" || g.type === "retrait" || g.type === "degrade") return l.pion === g.pion;
    if (g.type === "libre") return !!g.modele && l.modele === g.modele;
    return false;
  }
  // Pose un pion (ou un renforcement, une dissolution) sur les années de la portée.
  function poser(g) {
    var ans = anneesPortee();
    var l = etat.lignes.filter(function (x) { return memeGeste(x, g); })[0];
    if (!l) {
      var r = role(etat.role);
      l = { id: nouvelId(), role: etat.role, type: g.type, qte: {}, justification: "", cree_le: new Date().toISOString() };
      M.ANNEES.forEach(function (a) { l.qte[a] = 0; });
      if (g.type === "libre") {
        var o = optionDe(g.modele);
        l.modele = o ? o.code : null;
        l.libelle = g.libelle || (o ? o.libelle : "");
        l.armee = g.armee || (o ? o.armee : r.armee);
        l.source = o ? o.source : null;
        l.cout_unitaire = g.cout !== undefined ? M.arrondiCase(g.cout) : (o && o.cout ? M.arrondiCase(o.cout) : 0);
        l.dorese = o && o.dorese ? { ao: o.dorese.ao || 0, mco: o.dorese.mco || 0, rh: o.dorese.rh || 0 } : { ao: 0, mco: 0, rh: 0 };
      } else {
        var p = IDX[g.pion];
        l.pion = p.id;
        l.niveau = g.niveau || 100;
        l.armee = r.armee !== "Interarmées" ? r.armee : p.armee;
      }
      etat.lignes.push(l);
    }
    ans.forEach(function (a) {
      var q = Number(l.qte[a]) || 0;
      l.qte[a] = g.type === "ajout" || (g.type === "libre" && !g.modele) ? q + 1 : 1;
    });
    enregistrer(l);
    etat.selection = { ligne: l.id, pion: l.pion || null };
    etat.neuf = l.id;
    etat.volet = "selection";
    rendre(true);
    toast(natureLigne(l) + " · " + libelleLigne(l) + " · " + textePortee());
    return l;
  }
  // Retire le geste sur les années de la portée ; la ligne disparaît quand plus rien n'est posé.
  function enlever(l) {
    anneesPortee().forEach(function (a) {
      var q = Number(l.qte[a]) || 0;
      l.qte[a] = l.type === "ajout" || l.type === "libre" ? Math.max(0, q - 1) : 0;
    });
    if (!M.ANNEES.some(function (a) { return M.quantite(l, a) > 0; })) { supprimer(l); etat.selection = null; etat.volet = "poser"; }
    else enregistrer(l);
    rendre(true);
  }

  // ---------- Rendu ----------
  function rendre(complet) {
    rendreJauges();
    rendreTable();
    var actif = document.activeElement;
    var saisie = actif && /^(INPUT|TEXTAREA|SELECT)$/.test(actif.tagName) && $("volet").contains(actif);
    if (complet || !saisie) rendreVolet();
  }

  function rendreJauges() {
    var j = $("jauges");
    vider(j);
    var p = params();
    var lignes = etat.vue === "arbitrage" ? M.lignesApresArbitrage(etat.lignes, p) : etat.lignes;
    var syn = M.synthese(PIONS, lignes, p);
    M.ANNEES.forEach(function (a) {
      var s = syn[a];
      var tableMax = Math.max(s.table, s.total);
      var barre = el("span", { classe: "mini-barre" }, [
        el("span", { style: "width:" + (100 * Math.min(s.total, tableMax) / tableMax) + "%", classe: s.marge < 0 ? "trop" : "" }),
        el("i", { style: "left:" + (100 * s.plafond / tableMax) + "%" })
      ]);
      j.appendChild(el("button", { classe: "an-jauge", type: "button", role: "tab", "aria-selected": a === etat.annee ? "true" : "false",
        onclick: function () { etat.annee = a; memoriser(); rendre(true); } }, [
        el("span", { classe: "an-jauge-an", texte: String(a) }),
        barre,
        el("span", { classe: "an-jauge-val " + (s.marge < 0 ? "neg" : "pos"), texte: s.marge < 0 ? "dépasse de " + md(-s.marge) : "marge " + md(s.marge) })
      ]));
    });
  }

  function selectionCorrespond(x) {
    var s = etat.selection;
    if (!s) return false;
    if (s.ligne && x.ligne === s.ligne) return true;
    return !s.ligne && s.pion && x.socle && x.pion === s.pion;
  }

  function rendreTable() {
    var p = params();
    var lignes = etat.vue === "arbitrage" ? M.lignesApresArbitrage(etat.lignes, p) : etat.lignes;
    var t = M.placerAnnee(PIONS, lignes, p, etat.annee);
    var syn = M.synthese(PIONS, lignes, p)[etat.annee];
    document.querySelectorAll(".bascule button[data-vue]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-vue") === etat.vue ? "true" : "false"); });
    document.querySelectorAll(".bascule button[data-filtre]").forEach(function (b) { b.setAttribute("aria-pressed", (b.getAttribute("data-filtre") === "mien") === etat.maTable ? "true" : "false"); });

    var rel = $("table-releve");
    vider(rel);
    [["Table " + etat.annee, t.occupees + " / " + t.plafond + " cases", ""], ["Montant", md(syn.total), ""], ["Plafond", md(syn.plafond), ""],
      [syn.marge >= 0 ? "Marge" : "Dépassement", md(Math.abs(syn.marge)), syn.marge >= 0 ? "pos" : "neg"]].forEach(function (x) {
      rel.appendChild(el("div", { classe: "releve" }, [el("small", { texte: x[0] }), el("b", { classe: x[2], texte: x[1] })]));
    });
    $("consigne").textContent = arbitre()
      ? "Cliquez sur une demande posée sur la table pour la retenir, la différer ou y renoncer."
      : "Les pions en place sont votre point de départ. Cliquez sur un pion pour le modifier, sur une case vide pour en poser un nouveau.";

    var pl = $("plateau");
    vider(pl);
    pl.style.gridTemplateRows = "repeat(" + t.hauteur + ", var(--case))";
    for (var k = 0; k < t.hauteur * t.largeur; k++) {
      pl.appendChild(el("div", { classe: "fond fond-clic" + (k >= t.table ? " fond-horstable" : k >= t.plafond ? " fond-hors" : ""), title: "Poser un nouveau pion en " + etat.annee, style: "grid-row:" + (Math.floor(k / t.largeur) + 1) + ";grid-column:" + (k % t.largeur + 1),
        onclick: function () { etat.selection = null; etat.volet = "poser"; rendre(true); toast("Choisissez à droite le pion à poser en " + etat.annee); } }));
    }
    function depasse(r, c, w, h) { for (var i = r; i < r + h; i++) for (var j = c; j < c + w; j++) if (i * t.largeur + j >= t.plafond) return true; return false; }
    function masque(x) { return x.role && !vueComplete() && x.role !== etat.role; }
    // « Ma demande » : mes pions posés et les pions en place de mon armée.
    function aMoi(x) {
      if (x.role) return x.role === etat.role;
      var p = x.pion && IDX[x.pion];
      if (!x.socle || !p || p.type === "gris" || p.type === "orange" || vueComplete()) return false;
      return p.armee === armeeDuRole();
    }
    function estompe(x) { return etat.maTable && !aMoi(x); }
    function choisir(x) {
      return function () {
        etat.selection = { ligne: x.ligne || null, pion: x.pion || null, socle: !!x.socle && !x.ligne };
        etat.volet = "selection";
        rendre(true);
      };
    }
    var F = window.STRAT_FIGURATIFS;
    function court(nom) { return nom.replace(/^Capacité /, "").replace(/^Brigade /, "Bde ").replace(/^\+ Capacité /, "+ "); }
    t.pieces.forEach(function (x) {
      var bande = x.groupe === "Fixes" ? "var(--gris-carte)" : x.nature === "violet" ? "var(--violet)" : x.nature === "orange" ? "var(--orange-carte)" : couleur(x.armee);
      var cl = ["pion", "pion-clic", "fig"];
      var aire = x.w * x.h, petit = Math.min(x.w, x.h) === 1 && Math.max(x.w, x.h) <= 3;
      cl.push(x.w >= x.h ? "fig-h" : "fig-v");
      if (petit) cl.push("fig-mini");
      if (x.nature === "orange") cl.push("fig-alea");
      if (x.niveau === 50) cl.push("fig-rouge");
      if (depasse(x.r, x.c, x.w, x.h)) cl.push("pion-debord");
      if (x.role && x.role === etat.role) cl.push("pion-mien");
      if (selectionCorrespond(x)) cl.push("pion-choisi");
      if (x.ligne && x.ligne === etat.neuf) cl.push("pion-neuf");
      if (estompe(x)) cl.push("pion-estompe");
      var cache = masque(x);
      var nom = cache ? "Demande " + x.armee : x.libelle;
      var pion = x.pion ? IDX[x.pion] : null;
      var picto = cache ? null : F.svg(F.pictoDe(x.libelle) || "puce");
      var enfants = [el("span", { classe: "fig-bande" }, [el("span", { classe: "fig-titre", texte: court(nom) })])];
      if (picto) enfants.push(el("span", { classe: "fig-picto" }, [picto]));
      if (pion && pion.type === "capacite" && M.nbDorese(pion) && !petit && aire >= 4) {
        var co = el("span", { classe: "fig-coins" });
        ["ao", "mco", "rh"].forEach(function (k) {
          var ic = F.svg(F.DORESE[k]);
          co.appendChild(el("span", { classe: "fig-coin", title: "DORESE " + k.toUpperCase() + " requises" }, [ic, el("b", { texte: String(pion.dorese[k]) })]));
        });
        enfants.push(co);
      }
      pl.appendChild(el("button", { type: "button", classe: cl.join(" "), title: nom + (x.niveau ? " · " + (x.niveau === 50 ? "face rouge (dégradée)" : "à 100 %") : "") + (x.role && !cache ? " · " + x.role : ""),
        style: "grid-row:" + (x.r + 1) + " / span " + x.h + ";grid-column:" + (x.c + 1) + " / span " + x.w + ";--bande:" + bande, onclick: choisir(x) }, enfants));
    });
    t.cellules.forEach(function (x) {
      var cl = ["pion", "pion-case", "pion-clic"];
      cl.push(x.nature === "dorese" ? "jeton" : "jeton-option");
      if (x.horsCatalogue) cl.push("pion-mesure");
      if (x.r * t.largeur + x.c >= t.plafond) cl.push("pion-debord");
      if (x.role && x.role === etat.role) cl.push("pion-mien");
      var cible = x.nature === "dorese" && x.parent !== undefined ? t.pieces[x.parent] : x;
      if (x.ligne && x.ligne === etat.neuf) cl.push("pion-neuf");
      if (selectionCorrespond(cible) || (x.ligne && etat.selection && etat.selection.ligne === x.ligne)) cl.push("pion-choisi");
      if (x.nature === "dorese" ? estompe(cible) && estompe(x) : estompe(x)) cl.push("pion-estompe");
      var nom = masque(x) ? (x.nature === "dorese" ? "DORESE" : "Demande " + x.armee) : x.libelle;
      var ic = x.nature === "dorese" ? F.svg(F.DORESE[x.type]) : F.svg(masque(x) ? "document" : (F.pictoDe(x.libelle) || "document"));
      pl.appendChild(el("button", { type: "button", classe: cl.join(" "), title: nom, style: "grid-row:" + (x.r + 1) + ";grid-column:" + (x.c + 1) + ";--bande:" + couleur(x.armee),
        onclick: x.ligne && x.nature !== "dorese" ? choisir(x) : x.ligne ? choisir({ ligne: x.ligne, pion: cible.pion }) : choisir(cible) }, [ic]));
    });
    etat.neuf = null;

    var hors = $("hors-table");
    vider(hors);
    var absents = lignes.filter(function (l) { return (l.type === "retrait" || l.type === "degrade") && M.quantite(l, etat.annee) && visible(l); });
    if (absents.length) {
      hors.appendChild(el("span", { classe: "hors-titre", texte: "Retiré de la table en " + etat.annee + " :" }));
      absents.forEach(function (l) {
        hors.appendChild(el("button", { type: "button", classe: "hors-pion", onclick: function () { etat.selection = { ligne: l.id, pion: l.pion }; etat.volet = "selection"; rendre(true); } },
          [libelleLigne(l) + (l.type === "degrade" ? " (DORESE rendues)" : "") + " · " + l.role]));
      });
    }

    var lg = $("legende");
    vider(lg);
    function puce(style, cl, txt) { return el("span", null, [el("span", { classe: "puce-legende " + (cl || ""), style: style }), txt]); }
    lg.appendChild(puce("background:var(--gris)", "", "Dépense fixe"));
    lg.appendChild(puce("background:var(--violet)", "", "Investissement"));
    M.ARMEES.forEach(function (a) { lg.appendChild(puce("background:" + couleur(a), "", a)); });
    lg.appendChild(puce("background:var(--rouge)", "", "Face rouge : capacité dégradée"));
    ["ao", "mco", "rh"].forEach(function (k) {
      lg.appendChild(el("span", null, [el("span", { classe: "puce-legende jeton-legende", style: "--bande:var(--marine)" }, [F.svg(F.DORESE[k])]), { ao: "DORESE activité", mco: "DORESE MCO", rh: "DORESE RH" }[k]]));
    });
    lg.appendChild(puce("background:var(--case-vide)", "pion-mien", "Ma demande"));
    lg.appendChild(puce("background:var(--hors)", "", "Au-delà du plafond"));
  }

  // ---------- Volet ----------
  function onglets() {
    var o = [["poser", "Poser"], ["selection", "Sélection"], ["demande", "Ma demande"]];
    if (arbitre() || vueComplete()) o.push(["arbitrage", "Arbitrage"]);
    o.push(["bilan", "Bilan"]);
    if (ROLES_REGLAGES.indexOf(etat.role) !== -1) o.push(["reglages", "Réglages"]);
    return o;
  }
  function rendreVolet() {
    var nav = $("volet-onglets");
    vider(nav);
    onglets().forEach(function (o) {
      nav.appendChild(el("button", { type: "button", role: "tab", "aria-selected": etat.volet === o[0] ? "true" : "false", texte: o[1],
        onclick: function () { etat.volet = o[0]; rendreVolet(); } }));
    });
    var v = $("volet");
    vider(v);
    ({ poser: voletPoser, selection: voletSelection, demande: voletDemande, arbitrage: voletArbitrage, bilan: voletBilan, reglages: voletReglages }[etat.volet] || voletPoser)(v);
  }

  function choixPortee() {
    var g = el("div", { classe: "portee", role: "group", "aria-label": "Années concernées" });
    var dernier = etat.annee === M.ANNEES[M.ANNEES.length - 1];
    [["suite", dernier ? String(etat.annee) : etat.annee + " → " + M.ANNEES[M.ANNEES.length - 1]], ["annee", etat.annee + " seulement"]].forEach(function (x) {
      if (dernier && x[0] === "annee") return;
      g.appendChild(el("button", { type: "button", "aria-pressed": etat.portee === x[0] || dernier ? "true" : "false", texte: x[1],
        onclick: function () { etat.portee = x[0]; rendreVolet(); } }));
    });
    return el("div", { classe: "portee-bloc" }, [el("small", { texte: "S'applique" }), g]);
  }

  function forme(p) {
    var f = el("span", { classe: "forme", style: "grid-template-columns:repeat(" + Math.min(p.l || 1, 6) + ",7px);--c:" + (p.type === "violet" ? "var(--violet)" : p.type === "gris" ? "var(--gris)" : couleur(p.armee)) });
    for (var i = 0; i < Math.min((p.l || 1) * (p.h || 1), 24); i++) f.appendChild(el("i"));
    return f;
  }

  function voletPoser(v) {
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Poser un pion sur la table" }));
    v.appendChild(choixPortee());
    var f = el("div", { classe: "filtres", role: "group" });
    [["capacites", "Capacités"], ["options", "Options de ma fiche"], ["mesure", "Sur mesure"]].forEach(function (x) {
      f.appendChild(el("button", { classe: "filtre", type: "button", "aria-pressed": etat.filtre === x[0] ? "true" : "false", texte: x[1], onclick: function () { etat.filtre = x[0]; rendreVolet(); } }));
    });
    v.appendChild(f);
    if (etat.filtre !== "mesure") {
      var rech = el("input", { type: "search", placeholder: "Chercher…", "aria-label": "Chercher", value: etat.recherche });
      rech.addEventListener("input", function () { etat.recherche = rech.value; var l = $("liste-poser"); vider(l); remplir(l); });
      v.appendChild(rech);
    }
    var liste = el("div", { classe: "liste-poser", id: "liste-poser" });
    v.appendChild(liste);
    remplir(liste);

    function remplir(liste) {
      var q = etat.recherche.trim().toLowerCase();
      function ok(t) { return !q || t.toLowerCase().indexOf(q) !== -1; }
      if (etat.filtre === "capacites") {
        var vus = {};
        PIONS.filter(function (p) { return (p.type === "capacite" || p.type === "violet") && dansMonPerimetre(p) && ok(p.nom); }).forEach(function (p) {
          var cle = p.nom.replace(/ \d$/, "");
          if (vus[cle]) return; vus[cle] = true;
          var boutons = el("span", { classe: "poser-boutons" });
          if (p.type === "capacite" && M.nbDorese(p)) {
            boutons.appendChild(el("button", { type: "button", classe: "btn-poser", title: "Version dégradée, sans DORESE", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: 50 }); } }, ["50 %", el("small", { texte: md(p.cout50) })]));
            boutons.appendChild(el("button", { type: "button", classe: "btn-poser plein", title: "Avec ses " + M.nbDorese(p) + " DORESE", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: 100 }); } }, ["100 %", el("small", { texte: md(p.cout100) })]));
          } else {
            boutons.appendChild(el("button", { type: "button", classe: "btn-poser plein", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: 50 }); } }, ["Poser", el("small", { texte: md(p.cout50) })]));
          }
          liste.appendChild(el("div", { classe: "carte-poser" }, [forme(p), el("span", { classe: "carte-poser-nom" }, [cle, el("small", { texte: p.armee + " · " + (p.l * p.h) + " cases" + (M.nbDorese(p) ? " + " + M.nbDorese(p) + " DORESE" : "") })]), boutons]));
        });
      } else if (etat.filtre === "options") {
        var opts = CATALOGUE.filter(function (o) { return (vueComplete() || o.role === etat.role) && ok(o.libelle + " " + (o.categorie || "")); });
        if (!opts.length) liste.appendChild(el("p", { classe: "vide", texte: "Votre fiche ne propose pas d'option. Utilisez « Sur mesure »." }));
        opts.forEach(function (o) {
          var p = { l: 2, h: 1, armee: o.armee, type: /Violet/.test(o.type_pion || "") ? "violet" : "capacite" };
          liste.appendChild(el("div", { classe: "carte-poser" }, [forme(p),
            el("span", { classe: "carte-poser-nom" }, [o.libelle, el("small", { texte: fourchette(o) + (vueComplete() ? " · fiche " + o.role : "") })]),
            el("span", { classe: "poser-boutons" }, [el("button", { type: "button", classe: "btn-poser plein", onclick: function () { poser({ type: "libre", modele: o.code }); } }, ["Poser"])])]));
        });
      } else {
        var nom = el("input", { placeholder: "Intitulé", "aria-label": "Intitulé", maxlength: 120 });
        var prix = el("input", { type: "number", min: 100, step: 100, placeholder: "M€ par an", "aria-label": "Prix en M€ par an" });
        var arm = el("select", { "aria-label": "Armée" });
        M.ARMEES.forEach(function (a) { arm.appendChild(el("option", { value: a, texte: a })); });
        arm.value = armeeDuRole();
        var err = el("p", { classe: "erreur" });
        liste.appendChild(el("form", { classe: "form-mesure", onsubmit: function (ev) {
          ev.preventDefault();
          if (!nom.value.trim()) { err.textContent = "Donnez un intitulé."; return; }
          if (!(Number(prix.value) > 0)) { err.textContent = "Fixez un prix : il sera arrondi à la case de 100 M€."; return; }
          poser({ type: "libre", libelle: nom.value.trim(), cout: Number(prix.value), armee: arm.value });
        } }, [
          el("p", { classe: "aide", texte: "Un besoin hors catalogue. Il restera « à valider » jusqu'à l'accord de l'animateur." }),
          el("label", null, ["Intitulé", nom]), el("label", null, ["Prix, M€ par an", prix]), el("label", null, ["Armée qui le porte", arm]),
          el("button", { classe: "btn-laiton", type: "submit", texte: "Poser sur la table" }), err
        ]));
      }
    }
  }

  function badgeDecision(l) {
    var a = M.arbitrageDe(l, params());
    if (a.statut === "attente") return el("span", { classe: "badge badge-attente", texte: "En attente du CEMA" });
    return el("span", { classe: "badge " + (a.statut === "retenu" ? "badge-ok" : a.statut === "renonce" ? "badge-alerte" : "badge-attente"),
      texte: "CEMA : " + M.STATUTS[a.statut] + (a.statut === "differe" ? " de " + a.decalage + " an" + (a.decalage > 1 ? "s" : "") : "") });
  }

  function blocArbitrage(l) {
    var p = params();
    var a = M.arbitrageDe(l, p);
    var choix = el("div", { classe: "choix" });
    Object.keys(M.STATUTS).forEach(function (k) {
      choix.appendChild(el("button", { type: "button", "data-statut": k, "aria-pressed": a.statut === k ? "true" : "false", texte: M.STATUTS[k],
        onclick: function () { modifierParams(function (pp) { pp.arbitrages = pp.arbitrages || {}; pp.arbitrages[l.id] = { statut: k, decalage: k === "differe" ? (a.decalage || 1) : 0 }; }); } }));
    });
    if (a.statut === "differe") {
      var dec = el("select", { "aria-label": "Décalage" });
      [1, 2, 3].forEach(function (n) { dec.appendChild(el("option", { value: n, texte: "de " + n + " an" + (n > 1 ? "s" : "") })); });
      dec.value = String(a.decalage || 1);
      dec.addEventListener("change", function () { modifierParams(function (pp) { pp.arbitrages = pp.arbitrages || {}; pp.arbitrages[l.id] = { statut: "differe", decalage: Number(dec.value) }; }); });
      choix.appendChild(dec);
    }
    if (l.type === "libre" && !l.modele) {
      var cb = el("input", { type: "checkbox", id: "val-" + l.id });
      cb.checked = !!(p.validations || {})[l.id];
      cb.addEventListener("change", function () { modifierParams(function (pp) { pp.validations = pp.validations || {}; pp.validations[l.id] = cb.checked; }); });
      choix.appendChild(el("label", { for: cb.id, classe: "petit" }, [cb, " pion sur mesure validé"]));
    }
    return choix;
  }

  function voletSelection(v) {
    var s = etat.selection;
    if (!s) {
      v.appendChild(el("p", { classe: "vide", texte: "Cliquez sur un pion de la table pour voir ce que vous pouvez en faire." }));
      return;
    }
    var l = ligneDe(s.ligne);
    if (l) return ficheLigne(v, l);
    var p = IDX[s.pion];
    if (!p) { etat.selection = null; return voletSelection(v); }
    ficheSocle(v, p);
  }

  // Un pion du socle : le renforcer, le dissoudre.
  function ficheSocle(v, p) {
    var plein = M.nbManquantes(p) === 0;
    v.appendChild(el("p", { classe: "volet-sur", texte: (p.type === "gris" ? "Dépense fixe" : p.type === "violet" ? "Investissement" : p.type === "orange" ? "Pion de scénario" : "Capacité") + " · " + p.armee }));
    v.appendChild(el("h2", { classe: "volet-titre", texte: p.nom }));
    var dep = M.doreseDepart(p);
    var lignesEtat = [["Coût sur la table", md(M.coutSocle(p)) + " par an"], ["Place", (p.l * p.h) + " cases"]];
    if (p.type === "capacite") lignesEtat.push(["DORESE posées", M.nbDepart(p) + " / " + M.nbDorese(p) + (M.nbDorese(p) ? " (" + dep.ao + " AO, " + dep.mco + " MCO, " + dep.rh + " RH)" : "")]);
    var lActive = function (type) { var l = etat.lignes.filter(function (x) { return x.type === type && x.pion === p.id && M.quantite(x, etat.annee); })[0]; return l; };
    if (p.type === "capacite") lignesEtat.push(["État en " + etat.annee, lActive("degrade") ? "à 50 %, DORESE rendues (" + lActive("degrade").role + ")" : lActive("dorese") ? "à 100 %, renforcée (" + lActive("dorese").role + ")" : plein ? "à 100 %" : "dégradée"]);
    v.appendChild(el("dl", { classe: "etat-pion" }, lignesEtat.reduce(function (acc, x) { return acc.concat([el("dt", { texte: x[0] }), el("dd", { texte: x[1] })]); }, [])));
    if (p.remarque) v.appendChild(el("p", { classe: "aide", texte: p.remarque }));

    if (p.type === "gris" || p.type === "orange") {
      v.appendChild(el("p", { classe: "aide", texte: p.type === "gris" ? "Dépense fixe : elle ne se négocie pas à la table." : "Pion de scénario : l'animateur le pose ou le retire dans les Réglages." }));
      return;
    }
    if (!dansMonPerimetre(p)) { v.appendChild(el("p", { classe: "aide", texte: "Ce pion relève d'un autre pôle." })); return; }

    v.appendChild(choixPortee());
    var actions = el("div", { classe: "actions-pion" });
    var renf = etat.lignes.filter(function (x) { return memeGeste(x, { type: "dorese", pion: p.id }); })[0];
    var diss = etat.lignes.filter(function (x) { return memeGeste(x, { type: "retrait", pion: p.id }); })[0];
    var degr = etat.lignes.filter(function (x) { return memeGeste(x, { type: "degrade", pion: p.id }); })[0];
    var degrCetteAnnee = degr && M.quantite(degr, etat.annee);
    if (degrCetteAnnee) {
      actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { enlever(degr); } }, [
        el("b", { texte: "Revenir à 100 %" }), el("span", { texte: "Reposer ses DORESE " + textePortee() }), el("em", { texte: "+" + md(M.nbDepart(p) * M.CASE) + " par an" })]));
    } else if (p.type === "capacite" && M.nbDepart(p) && !(renf && M.quantite(renf, etat.annee))) {
      var dd = M.doreseDepart(p);
      actions.appendChild(el("button", { type: "button", classe: "action action-retrait", onclick: function () { poser({ type: "degrade", pion: p.id }); } }, [
        el("b", { texte: "Repasser à 50 %" }),
        el("span", { texte: "Rend ses " + M.nbDepart(p) + " DORESE (" + dd.ao + " AO, " + dd.mco + " MCO, " + dd.rh + " RH) : capacité dégradée" }),
        el("em", { texte: "−" + md(M.nbDepart(p) * M.CASE) + " par an" })]));
    }
    if (renf && M.quantite(renf, etat.annee)) {
      actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { enlever(renf); } }, [
        el("b", { texte: "Annuler le renforcement" }), el("span", { texte: "Retire les DORESE ajoutées " + textePortee() }), el("em", { texte: "−" + md(M.nbManquantes(p) * M.CASE) + " par an" })]));
    } else if (!plein && !degrCetteAnnee) {
      var mq = M.doreseManquantes(p);
      actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { poser({ type: "dorese", pion: p.id }); } }, [
        el("b", { texte: "Renforcer à 100 %" }),
        el("span", { texte: "Ajoute " + M.nbManquantes(p) + " DORESE au contact (" + mq.ao + " AO, " + mq.mco + " MCO, " + mq.rh + " RH)" }),
        el("em", { texte: "+" + md(M.nbManquantes(p) * M.CASE) + " par an" })
      ]));
    }
    actions.appendChild(el("button", { type: "button", classe: "action action-retrait", onclick: function () { poser({ type: "retrait", pion: p.id }); } }, [
      el("b", { texte: "Dissoudre" }),
      el("span", { texte: "Retire le pion de la table " + textePortee() }),
      el("em", { texte: "−" + md(M.coutSocle(p)) + " par an" })
    ]));
    actions.appendChild(el("button", { type: "button", classe: "action", onclick: function () { poser({ type: "ajout", pion: p.id, niveau: M.nbDorese(p) ? 100 : 50 }); } }, [
      el("b", { texte: "Ajouter un exemplaire" }),
      el("span", { texte: "Un " + p.nom.replace(/ \d$/, "") + " de plus" + (M.nbDorese(p) ? ", à 100 %" : "") }),
      el("em", { texte: "+" + md(M.nbDorese(p) ? p.cout100 : p.cout50) + " par an" })
    ]));
    v.appendChild(actions);
    [renf, diss, degr].forEach(function (l) { if (l) v.appendChild(el("p", { classe: "aide" }, ["Déjà dans votre demande : " + natureLigne(l).toLowerCase() + " (" + anneesDe(l) + "). ", el("button", { classe: "btn-lien", type: "button", texte: "Ouvrir", onclick: function () { etat.selection = { ligne: l.id, pion: l.pion }; rendreVolet(); } })])); });
  }

  // Une demande (ligne) : la régler ou l'enlever.
  function ficheLigne(v, l) {
    var mien = l.role === etat.role;
    var p = IDX[l.pion];
    var o = optionDe(l.modele);
    if (!visible(l)) {
      v.appendChild(el("p", { classe: "volet-sur", texte: "Demande d'un autre pôle" }));
      v.appendChild(el("h2", { classe: "volet-titre", texte: "Demande " + M.armeeDeLigne(l, IDX) }));
      v.appendChild(el("p", { classe: "aide", texte: "Son détail n'est visible que de son pôle, du CEMA, du SC-Plans et de l'animateur." }));
      return;
    }
    v.appendChild(el("p", { classe: "volet-sur", texte: natureLigne(l) + " · " + l.role }));
    var titre = el("h2", { classe: "volet-titre", texte: libelleLigne(l) });
    v.appendChild(titre);
    v.appendChild(el("div", { classe: "badges" }, [badgeDecision(l),
      l.type === "libre" && !l.modele ? el("span", { classe: "badge " + ((params().validations || {})[l.id] ? "badge-ok" : "badge-attente"), texte: (params().validations || {})[l.id] ? "Validé par l'animateur" : "À valider par l'animateur" }) : null]));

    var c = M.coutLigne(l, IDX);
    var u = M.unitaire(l, IDX);
    var resume = el("dl", { classe: "etat-pion" }, [
      el("dt", { texte: "Par an posé" }), el("dd", { texte: u.cout ? md(u.cout) : "prix à fixer" }),
      el("dt", { texte: "Années" }), el("dd", { texte: anneesDe(l) }),
      el("dt", { texte: "Total LPM" }), el("dd", { texte: md(c.total) + (c.totalDorese ? " · " + c.totalDorese + " DORESE" : "") }),
      el("dt", { texte: "Imputé à" }), el("dd", { texte: M.armeeDeLigne(l, IDX) })
    ]);
    v.appendChild(resume);

    if (mien) {
      if (l.type === "ajout" && p && p.type === "capacite" && M.nbDorese(p)) {
        var seg = el("div", { classe: "segment", role: "group", "aria-label": "Niveau" });
        [[50, "À 50 % · " + md(p.cout50)], [100, "À 100 % · " + md(p.cout100)]].forEach(function (x) {
          seg.appendChild(el("button", { type: "button", "aria-pressed": Number(l.niveau) === x[0] ? "true" : "false", texte: x[1], onclick: function () { l.niveau = x[0]; enregistrer(l); rendre(true); } }));
        });
        v.appendChild(seg);
      }
      if (l.type === "libre") {
        var prix = el("input", { type: "number", min: 0, step: 100, value: l.cout_unitaire || "", placeholder: "M€", "aria-label": "Prix fixé en M€ par an" });
        var note = el("p", { classe: "alerte-texte" });
        function majNote() {
          var t = [];
          if (!l.cout_unitaire) t.push("Fixez le prix : la demande ne compte pas tant qu'il est vide.");
          if (o && o.cout && l.cout_unitaire && (l.cout_unitaire < M.arrondiCase(o.cout) || l.cout_unitaire > Math.max(M.arrondiCase(o.cout_max || o.cout), o.cout_max || o.cout))) t.push("Hors fourchette de la fiche (" + fourchette(o) + ").");
          note.textContent = t.join(" ");
        }
        prix.addEventListener("change", function () { l.cout_unitaire = M.arrondiCase(prix.value); prix.value = l.cout_unitaire || ""; enregistrer(l); rendre(true); });
        majNote();
        v.appendChild(el("label", { classe: "champ" }, ["Prix fixé, M€ par an (arrondi à la case)", prix]));
        if (o) v.appendChild(el("p", { classe: "aide", texte: "Fiche : " + fourchette(o) + (o.periodicite ? " · " + o.periodicite : "") }));
        v.appendChild(note);
      }
      var cal = el("div", { classe: "cal" });
      M.ANNEES.forEach(function (a) {
        var q = M.quantite(l, a);
        var unique = l.type !== "ajout" && !(l.type === "libre" && !l.modele);
        cal.appendChild(el("button", { type: "button", classe: "cal-an" + (q ? " actif" : ""), "aria-pressed": q ? "true" : "false", title: unique ? "Poser ou retirer en " + a : "Clic : +1 · Maj+clic : −1",
          onclick: function (ev) {
            l.qte[a] = unique ? (q ? 0 : 1) : ev.shiftKey ? Math.max(0, q - 1) : q + 1;
            if (!M.ANNEES.some(function (x) { return M.quantite(l, x) > 0; })) { supprimer(l); etat.selection = null; etat.volet = "demande"; }
            else enregistrer(l);
            rendre(true);
          } }, [el("small", { texte: String(a) }), el("b", { texte: unique ? (q ? "✓" : "—") : String(q) })]));
      });
      v.appendChild(el("div", { classe: "champ" }, [el("span", { texte: "Années sur la table" }), cal]));
      var arm = el("select", { "aria-label": "Armée qui porte le projet" });
      M.ARMEES.forEach(function (a) { arm.appendChild(el("option", { value: a, texte: a })); });
      arm.value = M.armeeDeLigne(l, IDX);
      arm.addEventListener("change", function () { l.armee = arm.value; enregistrer(l); rendre(true); });
      v.appendChild(el("label", { classe: "champ" }, ["Surcoût imputé à", arm]));
      var just = el("textarea", { placeholder: "Votre argument pour l'arbitrage du CEMA", "aria-label": "Justification" });
      just.value = l.justification || "";
      just.addEventListener("input", function () { l.justification = just.value; enregistrer(l); });
      v.appendChild(el("label", { classe: "champ" }, ["Justification", just]));
      v.appendChild(el("div", { classe: "actions-bas" }, [
        el("button", { type: "button", classe: "btn-contour", texte: "Enlever de la table " + textePortee(), onclick: function () { enlever(l); } }),
        el("button", { type: "button", classe: "btn-lien", texte: "Supprimer toute la demande", onclick: function (ev) {
          var b = ev.currentTarget;
          if (b.dataset.arme !== "1") { b.dataset.arme = "1"; b.textContent = "Confirmer la suppression"; return; }
          supprimer(l); etat.selection = null; etat.volet = "demande"; rendre(true);
        } })
      ]));
      v.appendChild(choixPortee());
    } else if (l.justification) {
      v.appendChild(el("blockquote", { classe: "citation", texte: l.justification }));
    }
    if (arbitre()) {
      v.appendChild(el("h3", { texte: "Décision du CEMA" }));
      v.appendChild(blocArbitrage(l));
    }
  }

  function voletDemande(v) {
    var miennes = etat.lignes.filter(function (l) { return l.role === etat.role; });
    var mien = M.synthese(PIONS, etat.lignes, params(), function (l) { return l.role === etat.role; });
    var tot = 0, dor = 0;
    M.ANNEES.forEach(function (a) { tot += mien[a].totalDemandes; dor += mien[a].dorese.ao + mien[a].dorese.mco + mien[a].dorese.rh; });
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Demande " + etat.role }));
    v.appendChild(el("p", { classe: "total-demande" }, [el("b", { texte: md(tot) }), " sur 2027-2032 · " + dor + " DORESE"]));
    if (!miennes.length) { v.appendChild(el("p", { classe: "vide", texte: "Rien encore. Posez un pion depuis l'onglet « Poser », ou cliquez sur un pion de la table." })); return; }
    var ul = el("ul", { classe: "liste-demande" });
    miennes.forEach(function (l) {
      ul.appendChild(el("li", null, [el("button", { type: "button", style: "--c:" + couleur(M.armeeDeLigne(l, IDX)), onclick: function () { etat.selection = { ligne: l.id, pion: l.pion || null }; etat.volet = "selection"; rendre(true); } }, [
        el("span", null, [el("b", { texte: libelleLigne(l) }), el("small", { texte: natureLigne(l) + " · " + anneesDe(l) })]),
        el("span", { classe: "num" }, [md(M.coutLigne(l, IDX).total), badgeDecision(l)])
      ])]));
    });
    v.appendChild(ul);
  }

  function voletArbitrage(v) {
    var p = params();
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Arbitrage" }));
    var arb = M.synthese(PIONS, M.lignesApresArbitrage(etat.lignes, p), p);
    var tab = el("table", { classe: "mini-tableau" }, [el("thead", null, [el("tr", null, [el("th", { texte: "" }), el("th", { classe: "num", texte: "Retenu" }), el("th", { classe: "num", texte: "Marge" })])])]);
    var tb = el("tbody");
    M.ANNEES.forEach(function (a) { tb.appendChild(el("tr", null, [el("td", { texte: String(a) }), el("td", { classe: "num", texte: md(arb[a].total) }), el("td", { classe: "num " + (arb[a].marge < 0 ? "neg" : "pos"), texte: md(arb[a].marge) })])); });
    tab.appendChild(tb);
    v.appendChild(tab);
    var lignes = etat.lignes.filter(visible);
    var groupes = { attente: [], retenu: [], differe: [], renonce: [] };
    lignes.forEach(function (l) { groupes[M.arbitrageDe(l, p).statut].push(l); });
    Object.keys(groupes).forEach(function (k) {
      if (!groupes[k].length) return;
      var total = groupes[k].reduce(function (s, l) { return s + M.coutLigne(l, IDX).total; }, 0);
      v.appendChild(el("h3", { texte: M.STATUTS[k] + " · " + groupes[k].length + " · " + md(total) }));
      var ul = el("ul", { classe: "liste-demande" });
      groupes[k].forEach(function (l) {
        ul.appendChild(el("li", null, [el("button", { type: "button", style: "--c:" + couleur(M.armeeDeLigne(l, IDX)), onclick: function () { etat.selection = { ligne: l.id, pion: l.pion || null }; etat.volet = "selection"; var a1 = M.ANNEES.filter(function (a) { return M.quantite(l, a); })[0]; if (a1) etat.annee = a1; rendre(true); } }, [
          el("span", null, [el("b", { texte: libelleLigne(l) }), el("small", { texte: l.role + " · " + natureLigne(l) + " · " + anneesDe(l) })]),
          el("span", { classe: "num", texte: md(M.coutLigne(l, IDX).total) })
        ])]));
      });
      v.appendChild(ul);
    });
    if (!lignes.length) v.appendChild(el("p", { classe: "vide", texte: "Aucune demande pour l'instant." }));
  }

  function voletBilan(v) {
    var p = params();
    var syn = M.synthese(PIONS, etat.lignes, p);
    var arb = M.synthese(PIONS, M.lignesApresArbitrage(etat.lignes, p), p);
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Bilan 2027-2032" }));
    var t = el("table", { classe: "mini-tableau" });
    t.appendChild(el("thead", null, [el("tr", null, [el("th", { texte: "Md€" }), el("th", { classe: "num", texte: "Socle" }), el("th", { classe: "num", texte: "Demandes" }), el("th", { classe: "num", texte: "Plafond" }), el("th", { classe: "num", texte: "Marge après arb." })])]));
    var tb = el("tbody");
    function n(m) { return (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    M.ANNEES.forEach(function (a) {
      tb.appendChild(el("tr", null, [el("td", { texte: String(a) }), el("td", { classe: "num", texte: n(syn[a].totalSocle) }), el("td", { classe: "num", texte: n(syn[a].totalDemandes) }), el("td", { classe: "num", texte: n(syn[a].plafond) }), el("td", { classe: "num " + (arb[a].marge < 0 ? "neg" : "pos"), texte: n(arb[a].marge) })]));
    });
    t.appendChild(tb);
    v.appendChild(t);
    v.appendChild(el("h3", { texte: "Demandes par armée, sur 6 ans" }));
    var ul = el("ul", { classe: "par-armee" });
    M.ARMEES.forEach(function (arm) {
      var s = M.ANNEES.reduce(function (acc, a) { return acc + syn[a].demandes[arm]; }, 0);
      ul.appendChild(el("li", null, [el("span", { classe: "pastille", style: "background:" + couleur(arm) }), arm, el("b", { classe: "num", texte: md(s) })]));
    });
    v.appendChild(ul);
    v.appendChild(el("button", { classe: "btn-contour", type: "button", texte: "Télécharger les lignes (CSV)", onclick: telechargerCsv }));
  }
  function telechargerCsv() {
    var p = params();
    var ent = ["Pôle", "Action", "Objet", "Armée"].concat(M.ANNEES.map(String)).concat(["Total (M€)", "Décision", "Justification"]);
    var out = [ent.join(";")];
    etat.lignes.filter(visible).forEach(function (l) {
      var c = M.coutLigne(l, IDX);
      var v = [l.role, natureLigne(l), libelleLigne(l), M.armeeDeLigne(l, IDX)].concat(M.ANNEES.map(function (a) { return c.annees[a].cout; }))
        .concat([c.total, M.STATUTS[M.arbitrageDe(l, p).statut], (l.justification || "").replace(/\s+/g, " ")]);
      out.push(v.map(function (x) { var s = String(x); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";"));
    });
    var a = el("a", { href: URL.createObjectURL(new Blob(["﻿" + out.join("\n")], { type: "text/csv;charset=utf-8" })), download: "strategikon-" + etat.partie.nom + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
  }

  function voletReglages(v) {
    var p = params();
    v.appendChild(el("h2", { classe: "volet-titre", texte: "Réglages de la partie" }));
    var f = el("form", { classe: "form-reglages" });
    f.appendChild(el("h3", { texte: "Plafond annuel, en cases de 100 M€" }));
    var pf = el("div", { classe: "plafonds" });
    M.ANNEES.forEach(function (a) { pf.appendChild(el("label", null, [String(a), el("input", { id: "plafond-" + a, type: "number", min: 0, max: 2000, value: p.plafonds[a] })])); });
    f.appendChild(pf);
    f.appendChild(el("h3", { texte: "Pions de scénario posés" }));
    PIONS.filter(function (x) { return x.type === "orange"; }).forEach(function (o) {
      var an = ((p.aleas || {})[o.id] || []).map(Number);
      f.appendChild(el("div", { classe: "alea" }, [el("span", { texte: o.nom + " · " + md(o.cout50) }), el("div", { classe: "alea-annees" }, M.ANNEES.map(function (a) {
        var cb = el("input", { type: "checkbox", "data-pion": o.id, "data-annee": a });
        cb.checked = an.indexOf(a) !== -1;
        return el("label", null, [cb, " " + a]);
      }))]));
    });
    f.appendChild(el("button", { classe: "btn-laiton", type: "submit", texte: "Enregistrer" }));
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var plaf = {}, aleas = {};
      M.ANNEES.forEach(function (a) { plaf[a] = Math.max(0, Number($("plafond-" + a).value) || 0); });
      f.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
        var id = cb.getAttribute("data-pion"); aleas[id] = aleas[id] || [];
        if (cb.checked) aleas[id].push(Number(cb.getAttribute("data-annee")));
      });
      modifierParams(function (pp) { pp.plafonds = plaf; pp.aleas = aleas; }).then(function () { toast("Réglages enregistrés"); });
    });
    v.appendChild(f);
  }

  // ---------- Démarrage ----------
  function demarrer() {
    $("note-mode").textContent = S.mode === "partage" ? "Base partagée : chaque pôle voit les autres avancer en quelques secondes." : "Mode local : les parties restent dans ce navigateur.";
    $("btn-montrer-creer").addEventListener("click", function () { etapeAccueil("creer"); $("cre-nom").focus(); });
    $("btn-montrer-rejoindre").addEventListener("click", function () { etapeAccueil("rejoindre"); });
    $("form-rejoindre").addEventListener("submit", function (ev) {
      ev.preventDefault();
      $("rej-erreur").textContent = "";
      var nom = $("rej-partie").value, mdp = $("rej-mdp").value;
      if (!nom) { $("rej-erreur").textContent = "Ouvrez d'abord une partie, ou demandez son nom à l'animateur."; return; }
      S.ouvrirPartie(nom, mdp).then(function (p) { montrerRoles(p, mdp); }).catch(function (e) { $("rej-erreur").textContent = e.message; });
    });
    $("form-creer").addEventListener("submit", function (ev) {
      ev.preventDefault();
      $("cre-erreur").textContent = "";
      var nom = $("cre-nom").value.trim(), mdp = $("cre-mdp").value;
      if (mdp !== $("cre-mdp2").value) { $("cre-erreur").textContent = "Les deux mots de passe diffèrent."; return; }
      S.creerPartie(nom, mdp, M.parametresParDefaut()).then(function (p) { montrerRoles(p, mdp); }).catch(function (e) { $("cre-erreur").textContent = e.message; });
    });
    $("btn-retour-partie").addEventListener("click", quitter);
    $("btn-quitter").addEventListener("click", quitter);
    $("btn-role").addEventListener("click", function () { montrerRoles(etat.partie, etat.mdp); });
    document.querySelectorAll(".bascule button[data-vue]").forEach(function (b) { b.addEventListener("click", function () { etat.vue = b.getAttribute("data-vue"); rendre(false); }); });
    document.querySelectorAll(".bascule button[data-filtre]").forEach(function (b) { b.addEventListener("click", function () { etat.maTable = b.getAttribute("data-filtre") === "mien"; rendre(false); }); });
    setInterval(function () { if (etat.partie && etat.role && !Object.keys(enAttente).length) recharger(false); }, S.mode === "partage" ? 6000 : 5000);

    etapeAccueil("rejoindre");
    chargerParties().then(function () {
      var mem = null;
      try { mem = JSON.parse(sessionStorage.getItem(CLE_SESSION)); } catch (e) { mem = null; }
      if (mem && mem.nom && mem.role) {
        S.ouvrirPartie(mem.nom, mem.mdp).then(function (p) {
          etat.partie = p; etat.mdp = mem.mdp; if (mem.annee) etat.annee = mem.annee;
          return entrer(mem.role);
        }).catch(function () { etat.partie = null; memoriser(); });
      }
    });
  }

  demarrer();
})();
