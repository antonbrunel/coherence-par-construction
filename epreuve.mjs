#!/usr/bin/env node
/* L'épreuve des garde-fous : un contrôle qui n'a jamais échoué ne prouve rien.

   Pour chaque dérive que les contrôles prétendent empêcher, on copie le site d'exemple
   dans un dossier temporaire, on y introduit la dérive, et on exige que le contrôle
   la voie. Un contrôle qui laisse passer sa propre dérive fait échouer cette épreuve.

   C'est le pendant du principe : rendre l'état incorrect bruyant. Encore faut-il
   vérifier que le bruit se déclenche.

     node epreuve.mjs

   Zéro dépendance. */
import { cpSync, rmSync, mkdtempSync, readFileSync, writeFileSync, rmSync as suppr } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { run as palette } from './controles/palette.mjs';
import { run as faits } from './controles/faits.mjs';
import { run as deploiement } from './controles/deploiement.mjs';
import { run as langues } from './controles/langues.mjs';

const RACINE = fileURLToPath(new URL('.', import.meta.url));
const BASE = JSON.parse(readFileSync(join(RACINE, 'coherence.config.json'), 'utf8'));
const SOURCE = join(RACINE, BASE.racine);

const CAS = [
  {
    quoi: 'un chiffre change dans la source mais pas dans le fichier tenu à la main',
    controle: faits,
    derive: (d) => remplacer(d, 'llms.txt', '214 abris', '215 abris'),
    attendu: 'llms.txt',
  },
  {
    quoi: 'une couleur hors charte entre dans le CSS',
    controle: palette,
    derive: (d) => remplacer(d, 'style.css', 'color: var(--gris);', 'color: #ff00ff;'),
    attendu: 'hors charte #ff00ff',
  },
  {
    quoi: 'une fonte hors charte entre dans le CSS',
    controle: palette,
    derive: (d) => remplacer(d, 'style.css', 'line-height: 1.6;', 'font-family: "Comic Sans MS";'),
    attendu: 'fonte hors charte',
  },
  {
    quoi: 'un fichier requis disparaît',
    controle: deploiement,
    derive: (d) => suppr(join(d, 'llms.txt')),
    attendu: 'llms.txt : manquant',
  },
  {
    quoi: 'robots.txt désigne un sitemap sur un autre domaine',
    controle: deploiement,
    derive: (d) => remplacer(d, 'robots.txt', 'https://exemple.test/sitemap.xml', 'https://ancien-domaine.test/sitemap.xml'),
    attendu: 'hors du domaine canonique',
  },
  {
    quoi: 'une page générée est corrigée à la main',
    controle: langues,
    derive: (d) => remplacer(d, 'index.html', 'Abris de montagne</h1>', 'Abris de montagne !</h1>'),
    attendu: 'diverge de sa source',
  },
  {
    quoi: 'une clé existe dans une langue et pas dans l\'autre',
    controle: langues,
    derive: (d) => {
      const f = join(d, 'data/i18n/en.json');
      const o = JSON.parse(readFileSync(f, 'utf8'));
      delete o.pied;
      writeFileSync(f, JSON.stringify(o, null, 2));
    },
    attendu: 'clé « pied » absente',
  },
  {
    quoi: 'une page indexable manque au sitemap',
    controle: langues,
    derive: (d) => remplacer(d, 'sitemap.xml', '<loc>https://exemple.test/en/</loc>', '<loc>https://exemple.test/ailleurs/</loc>'),
    attendu: 'manquant',
  },
];

function remplacer(dossier, fichier, avant, apres) {
  const f = join(dossier, fichier);
  const txt = readFileSync(f, 'utf8');
  if (!txt.includes(avant)) throw new Error(`épreuve mal écrite : « ${avant} » introuvable dans ${fichier}`);
  writeFileSync(f, txt.replace(avant, apres));
}

let echecs = 0;
console.log(`L'épreuve : ${CAS.length} dérives, chacune doit être vue.\n`);

for (const cas of CAS) {
  const atelier = mkdtempSync(join(tmpdir(), 'epreuve-'));
  const site = join(atelier, 'site');
  try {
    cpSync(SOURCE, site, { recursive: true });
    cas.derive(site);
    const r = await cas.controle({ ...BASE, _racine: site });
    const vu = r.errors.some((e) => e.includes(cas.attendu));
    if (vu) {
      console.log(`  ok  ${cas.quoi}`);
    } else {
      echecs++;
      console.error(`ECHEC ${cas.quoi}`);
      console.error(`      attendu une erreur contenant « ${cas.attendu} »`);
      console.error(`      obtenu : ${r.errors.length ? r.errors.join(' | ') : 'aucune erreur'}`);
    }
  } finally {
    rmSync(atelier, { recursive: true, force: true });
  }
}

console.log(echecs
  ? `\n${echecs} dérive(s) passée(s) inaperçue(s) : un garde-fou ne garde pas.`
  : '\nLes huit dérives sont vues. Les garde-fous gardent.');
process.exit(echecs ? 1 : 0);
