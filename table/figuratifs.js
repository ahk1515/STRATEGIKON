// Figuratifs des pions : pictogrammes noirs, dessinés pour l'outil (viewBox 24 x 24).
(function () {
  "use strict";
  var T = 'stroke="currentColor" fill="none" stroke-linecap="round"';
  var I = {
    char: '<path d="M2 15.5h20l-2.4 4H4.4z"/><path d="M5 11.6h11.5l2.4 3.2H4z"/><rect x="7.5" y="8.6" width="6.5" height="3.4" rx="1"/><path d="M13.5 9.4l9-1.3v1.5l-9 1z"/>',
    helico: '<path d="M2 5.4h20v1.3H2z"/><rect x="11.3" y="6.5" width="1.4" height="3"/><path d="M5.5 9.5h8.5c3 0 4.5 2 4.5 4.2v.8H8.5C6.6 14.5 5 13 5 11.2z"/><path d="M17.5 11.4h5.5v1.6h-5.5z"/><path d="M21.6 9.4h1v5h-1z"/><path d="M6 17.6h11.5v1.2H6z"/><path d="M8 14.2h1v3.6H8zM14.5 14.2h1v3.6h-1z"/>',
    avion: '<path d="M12 1.5l1.5 6.2 7.5 5.1v2.1l-7.5-2.1-.5 5.2 2.6 2v1.5L12 20.4l-3.6 1.1V20l2.6-2-.5-5.2L3 14.9v-2.1l7.5-5.1z"/>',
    transport: '<path d="M10.8 2h2.4l.6 6.8L23 11.6v2.2l-9.2-1.6-.4 5.9 3.3 1.6v1.6L12 20.4l-4.7.9v-1.6l3.3-1.6-.4-5.9L1 13.8v-2.2l9.2-2.8z"/>',
    drone: '<path d="M11.2 5h1.6l.5 5.4 9.7 1.4v1.5l-9.7-.4-.4 4.8 2.6 1.6V21L12 20l-3.5 1v-1.6l2.6-1.6-.4-4.8-9.7.4v-1.5l9.7-1.4z"/><circle cx="12" cy="4" r="1.6"/>',
    navire: '<path d="M1 14.6h22l-3.2 5.2H4.4z"/><path d="M5.5 10.6h12v4H5.5z"/><path d="M8.5 6.8h5v3.8h-5z"/><path d="M10.5 2.5h1.2v4.3h-1.2z"/><path d="M15 8.6h4v2h-4z"/>',
    porteavions: '<path d="M1 13.4h22l-2.6 5.6H4z"/><path d="M15.2 8.2h4v5.2h-4z"/><path d="M16.8 5h1v3.2h-1z"/><path d="M4 12.2l3-.6 1 .6-1 .6z"/>',
    sousmarin: '<path d="M2 14.6c0-2.1 2.2-3.6 5.2-3.6h11.1c2.5 0 4.2 1.5 4.2 3.6s-1.7 3.6-4.2 3.6H7.2c-3 0-5.2-1.5-5.2-3.6z"/><path d="M9.5 7.2h4.2v4H9.5z"/><path d="M11 4.2h1v3h-1z"/>',
    parachute: '<path d="M2.5 10.5a9.5 7.5 0 0 1 19 0z"/><path d="M3 11l8 7.2M21 11l-8 7.2M12 11v7" ' + T + ' stroke-width="1.2"/><circle cx="12" cy="20" r="1.9"/>',
    reseau: '<circle cx="12" cy="12" r="3.3"/><circle cx="4" cy="4.5" r="2.2"/><circle cx="20" cy="4.5" r="2.2"/><circle cx="4" cy="19.5" r="2.2"/><circle cx="20" cy="19.5" r="2.2"/><path d="M5.5 6l5 4.4M18.5 6l-5 4.4M5.5 18l5-4.4M18.5 18l-5-4.4" ' + T + ' stroke-width="1.6"/>',
    antenne: '<path d="M4 3.5a9 9 0 0 0 11.5 11.5z"/><path d="M9.5 9l6.5-6.5" ' + T + ' stroke-width="1.6"/><circle cx="16.6" cy="2.6" r="1.4"/><path d="M10.5 14.5l-3.5 8h10l-3.5-8z"/>',
    caisse: '<rect x="2.5" y="11" width="9" height="9"/><rect x="12.5" y="11" width="9" height="9"/><rect x="7.5" y="2.5" width="9" height="7.5"/><path d="M5 15.5h4M15 15.5h4M10 6.2h4" stroke="#fff" stroke-width="1.2"/>',
    cle: '<path d="M15 2.5a5.2 5.2 0 0 0-4.8 7.3L2.6 17.4l3.6 3.6 7.6-7.6A5.2 5.2 0 0 0 21 8.6l-3.2 3.1-3.1-.5-.5-3.1 3.1-3.1A5.2 5.2 0 0 0 15 2.5z"/>',
    sante: '<path d="M9 2.5h6v6.5h6.5v6H15v6.5H9V15H2.5V9H9z"/>',
    batiment: '<path d="M2 20.2h20v1.6H2z"/><path d="M12 2.5l9.5 5.3H2.5z"/><path d="M4 9h2.4v10.4H4zM8.4 9h2.4v10.4H8.4zM13.2 9h2.4v10.4h-2.4zM17.6 9H20v10.4h-2.4z"/>',
    globe: '<circle cx="12" cy="12" r="9.2" ' + T + ' stroke-width="1.7"/><path d="M7.5 5.5c2 1 .6 3 2.8 4s1.2 3.2-.9 4.1-.9 3.3.2 4.6M15.5 4.4c-1.2 2 .9 3 2.1 4s3 .9 3.2 2.3M13.6 14c1.2.9 3.3.8 3.1 3.4" ' + T + ' stroke-width="1.5"/>',
    missile: '<path d="M12 1c2.1 2.1 3.1 5 3.1 8v8.2H8.9V9c0-3 1-5.9 3.1-8z"/><path d="M8.9 12.6L5.6 17v3.4l3.3-1.4zM15.1 12.6l3.3 4.4v3.4l-3.3-1.4z"/><path d="M10.2 18h3.6l-.9 4.2h-1.8z"/>',
    puce: '<rect x="7" y="7" width="10" height="10" rx="1.2"/><path d="M9.5 3v4M12 3v4M14.5 3v4M9.5 17v4M12 17v4M14.5 17v4M3 9.5h4M3 12h4M3 14.5h4M17 9.5h4M17 12h4M17 14.5h4" ' + T + ' stroke-width="1.5"/>',
    soldat: '<circle cx="12" cy="8.2" r="3.9"/><path d="M7.4 6.4c.6-3.4 8.6-3.4 9.2 0v.8H7.4z"/><path d="M3.2 21.5c0-5 3.9-8 8.8-8s8.8 3 8.8 8z"/>',
    document: '<path d="M5.5 2h9.5l4 4v16H5.5z"/><path d="M8.5 10h7.5M8.5 13.2h7.5M8.5 16.4h5" stroke="#fff" stroke-width="1.3"/>',
    obus: '<path d="M5.5 22V10.5c0-3.2 2.2-6.5 2.2-6.5s2.3 3.3 2.3 6.5V22z"/><path d="M14 22V10.5c0-3.2 2.2-6.5 2.2-6.5s2.3 3.3 2.3 6.5V22z"/>',
    oeil: '<path d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.3" fill="#fff"/><circle cx="12" cy="12" r="1.5"/>',
    etoile: '<path d="M12 1.8l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9l7.1-.6z"/>',
    // DORESE
    botte: '<path d="M6.5 1.8h8v9.8l5.8 2.7c1.6.8 2.2 2.1 2.2 3.6v3.3H4.5V12z"/><path d="M4.5 18.5h18" stroke="#fff" stroke-width="1"/>',
    camion: '<path d="M1 5.5h13.5v10H1z"/><path d="M14.5 8.8h5.2l3.3 3.6v3.1h-8.5z"/><circle cx="5.2" cy="17.6" r="2.3"/><circle cx="18.3" cy="17.6" r="2.3"/><path d="M5 10.5h5.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="4.6" cy="10.5" r="1.2" fill="#fff"/>'
  };
  I.buste = I.soldat;

  var REGLES = [
    [/Dissuasion/i, "missile"], [/Infrastructure/i, "batiment"], [/OPEX/i, "globe"], [/Secr[ée]tariat|SGA/i, "document"],
    [/R&D/i, "puce"], [/Cyber/i, "puce"], [/SIC/i, "reseau"], [/Renseign/i, "antenne"], [/sant[ée]/i, "sante"],
    [/Soutien|logistique/i, "caisse"], [/maintenance/i, "cle"], [/Planification/i, "etoile"], [/forces sp[ée]ciales|FUSCO/i, "parachute"],
    [/Socle Terre|Service militaire|SMV/i, "soldat"], [/Leclerc|Scorpion|Serval/i, "char"], [/a[ée]romobile/i, "helico"],
    [/porte-h[ée]licopt/i, "navire"], [/h[ée]licopt/i, "helico"], [/Rafale|Socle Air/i, "avion"], [/A400M|C130|MRTT|Atlantique/i, "transport"],
    [/drones? MALE|drone/i, "drone"], [/SNA|sous-marin/i, "sousmarin"], [/porte-avions|PA-NG/i, "porteavions"],
    [/surveillance|souverainet/i, "oeil"], [/FREMM|FDI|FDA|ravitaillement|HIL|fr[ée]gate|patrouill/i, "navire"],
    [/Munition|missile|obus/i, "obus"], [/IA |num[ée]rique|spatial|satellite/i, "puce"]
  ];
  function pictoDe(nom) {
    for (var i = 0; i < REGLES.length; i++) if (REGLES[i][0].test(nom || "")) return REGLES[i][1];
    return null;
  }
  function svg(nom) {
    var c = I[nom];
    if (!c) return null;
    var n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    n.setAttribute("viewBox", "0 0 24 24");
    n.setAttribute("aria-hidden", "true");
    n.setAttribute("fill", "currentColor");
    n.innerHTML = c;
    return n;
  }
  window.STRAT_FIGURATIFS = { svg: svg, pictoDe: pictoDe, DORESE: { ao: "botte", mco: "camion", rh: "buste" } };
})();
