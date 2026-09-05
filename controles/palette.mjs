/* Contrôle 2 : la charte devient contraignante.

   Le problème qu'il résout : une charte graphique écrite dans un document est respectée
   par discipline. Au bout de quelques mois, le CSS contient onze gris au lieu de trois,
   chacun arrivé pour une bonne raison, et plus personne ne sait lequel fait foi.

   La forme : la charte est la source. Le contrôle en extrait les couleurs et les
   familles de fontes déclarées, puis refuse tout hex et toute fonte qui n'y sont pas.
   Aucune couleur n'est écrite dans ce fichier : ajouter une couleur au site passe
   forcément par la charte.

   Périmètre assumé : les littéraux hexadécimaux. Les rgba() d'ombres et de lueurs
   expriment de la lumière, pas de la charte, et sont ignorés. */
import { lecteur, inactif } from './lib.mjs';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

/* Le corps d'une section « ## Titre » d'un Markdown. */
function section(md, titre) {
  const m = md.match(new RegExp(`^##\\s+${titre}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'm'));
  return m ? m[1] : '';
}

function declare(lire, p) {
  const md = lire(p.charte);
  const couleurs = new Set(
    (section(md, p.sectionCouleurs).match(HEX) || []).map((h) => h.toLowerCase())
  );
  /* Les familles sont les puces en gras de la section typographie : - **Nom** … */
  const familles = new Set(
    [...section(md, p.sectionFontes).matchAll(/^-\s+\*\*([^*]+)\*\*/gm)]
      .map((m) => m[1].trim().toLowerCase())
  );
  return { couleurs, familles };
}

/* Retire ce qui n'exprime pas la charte : data-URI, pochoirs de masque (#000/#fff y
   valent une opacité, pas une couleur), et les ancres et identifiants du HTML. */
function horsCharte(txt, fichier, couleurs) {
  const nettoye = txt
    .replace(/url\([^)]*\)/g, '')
    .replace(/(?:-webkit-)?mask[a-z-]*:\s*[^;]*/gi, '')
    .replace(/\b(?:href|id|xlink:href)="[^"]*"/g, '');
  const vus = new Set();
  for (const brut of nettoye.match(HEX) || []) {
    if (!couleurs.has(brut.toLowerCase())) vus.add(`${fichier} : couleur hors charte ${brut}`);
  }
  return [...vus];
}

function fontesHorsCharte(css, fichier, familles, generiques) {
  const permis = new Set([
    ...familles,
    ...generiques,
    'cursive', 'fantasy', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
    'inherit', 'initial', 'unset', 'revert',
  ]);
  const vus = new Set();
  for (const bloc of css.match(/@font-face\s*\{[^}]*\}/g) || []) {
    const nom = bloc.match(/font-family:\s*['"]?([^'";]+)['"]?/);
    if (nom && !familles.has(nom[1].trim().toLowerCase())) {
      vus.add(`${fichier} : @font-face hors charte « ${nom[1].trim()} »`);
    }
  }
  for (const decl of css.match(/font-family:\s*[^;}]+/g) || []) {
    const valeur = decl.replace(/^font-family:\s*/, '');
    if (valeur.includes('var(')) continue;
    for (const part of valeur.split(',')) {
      const nom = part.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (nom && !permis.has(nom)) vus.add(`${fichier} : fonte hors charte « ${part.trim()} »`);
    }
  }
  return [...vus];
}

export function run(cfg) {
  if (!cfg.palette) return inactif('Palette et typographie');
  const p = cfg.palette;
  const { lire } = lecteur(cfg);
  const { couleurs, familles } = declare(lire, p);
  const errors = [];

  if (!couleurs.size) errors.push(`${p.charte} : aucune couleur dans la section « ${p.sectionCouleurs} »`);
  if (!familles.size) errors.push(`${p.charte} : aucune fonte dans la section « ${p.sectionFontes} »`);

  const generiques = (p.fontesGeneriques || []).map((f) => f.toLowerCase());
  for (const f of p.feuilles || []) {
    const css = lire(f);
    errors.push(...horsCharte(css, f, couleurs));
    errors.push(...fontesHorsCharte(css, f, familles, generiques));
  }
  for (const f of p.pages || []) errors.push(...horsCharte(lire(f), f, couleurs));

  return {
    name: `Palette et typographie (${couleurs.size} couleurs, ${familles.size} fontes)`,
    errors,
    warnings: [],
  };
}
