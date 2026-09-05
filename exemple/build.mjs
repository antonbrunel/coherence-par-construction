#!/usr/bin/env node
/* Le générateur du site d'exemple : gabarit + textes + chiffres → pages.
   Il est la SEULE façon d'écrire index.html et en/index.html. Le contrôle
   `controles/langues.mjs` l'appelle et compare son résultat aux fichiers sur
   le disque : une page éditée à la main est détectée immédiatement.

   Il exporte ce que le contrôle attend de tout générateur :
     LANGUES    les langues servies
     PAGES      les pages, et le chemin de chaque version
     urlDe()    l'URL canonique d'un chemin
     construire()  la liste { chemin, contenu } que le site devrait contenir

   node exemple/build.mjs   écrit les pages
   Zéro dépendance. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = fileURLToPath(new URL('.', import.meta.url));
const lire = (p) => readFileSync(join(ICI, p), 'utf8');

export const ORIGINE = 'https://exemple.test';
export const LANGUES = ['fr', 'en'];
export const PAGES = [
  { nom: 'accueil', sorties: { fr: 'index.html', en: 'en/index.html' } },
];

/* L'URL canonique d'un chemin : la racine s'écrit sans « index.html ». */
export function urlDe(chemin) {
  const propre = chemin.replace(/(^|\/)index\.html$/, '$1');
  return `${ORIGINE}/${propre}`;
}

/* Le retour à la racine depuis une page : « » ou « ../ ». */
const racineDepuis = (chemin) => '../'.repeat(chemin.split('/').length - 1);

/* Les liens hreflang d'une page : une ligne par langue, soi compris, plus x-default. */
function alternates(page) {
  const lignes = LANGUES.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${urlDe(page.sorties[l])}">`
  );
  lignes.push(`<link rel="alternate" hreflang="x-default" href="${urlDe(page.sorties[LANGUES[0]])}">`);
  return lignes.join('\n');
}

export function construire() {
  const gabarit = lire('src/page.html');
  const { faits } = JSON.parse(lire('data/facts.json'));
  const chiffres = Object.fromEntries(faits.map((f) => [f.cle, f.valeur]));
  const sorties = [];
  for (const page of PAGES) {
    for (const langue of LANGUES) {
      const chemin = page.sorties[langue];
      const textes = JSON.parse(lire(`data/i18n/${langue}.json`));
      const valeurs = {
        ...textes,
        ...chiffres,
        langue,
        canonical: urlDe(chemin),
        racine: racineDepuis(chemin),
        alternates: alternates(page),
      };
      const contenu = gabarit.replace(/\{\{(\w+)\}\}/g, (_, cle) => {
        if (!(cle in valeurs)) throw new Error(`${chemin} : la clé « ${cle} » manque`);
        return valeurs[cle];
      });
      sorties.push({ chemin, contenu });
    }
  }
  return sorties;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const { chemin, contenu } of construire()) {
    mkdirSync(dirname(join(ICI, chemin)), { recursive: true });
    writeFileSync(join(ICI, chemin), contenu);
    console.log(`écrit ${chemin}`);
  }
}
