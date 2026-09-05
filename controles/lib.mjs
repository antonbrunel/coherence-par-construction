/* Le peu de plomberie partagée par les quatre contrôles : lire la configuration,
   lire un fichier du site, et la forme du résultat qu'un contrôle rend.

   Un contrôle exporte `run(config)` et rend { name, errors, warnings }. Rien d'autre.
   Pas de framework, pas de dépendance : ce qui protège un site statique ne doit jamais
   peser plus lourd que le site. */
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE_PROJET = fileURLToPath(new URL('..', import.meta.url));

/* La configuration, et la racine du site qu'elle désigne. */
export function config(chemin = 'coherence.config.json') {
  const brut = JSON.parse(readFileSync(join(RACINE_PROJET, chemin), 'utf8'));
  return { ...brut, _racine: resolve(RACINE_PROJET, brut.racine || '.') };
}

/* Un lecteur de fichiers relatif à la racine du site, avec cache. */
export function lecteur(cfg) {
  const cache = new Map();
  const chemin = (f) => join(cfg._racine, f);
  return {
    chemin,
    lire(f) {
      if (!cache.has(f)) cache.set(f, readFileSync(chemin(f), 'utf8'));
      return cache.get(f);
    },
    existe(f) {
      try { return statSync(chemin(f)).size > 0; } catch { return false; }
    },
    manque(f) {
      try { statSync(chemin(f)); return false; } catch { return true; }
    },
  };
}

/* Compare à travers les représentations d'un même texte : &nbsp;, insécables, espaces. */
export const normaliser = (s) => s.replace(/&nbsp;| | /g, ' ').replace(/\s+/g, ' ');

/* Le premier groupe capturant d'une expression, ou undefined. */
export const attribut = (html, re) => (html.match(re) || [])[1];

/* Un contrôle désactivé (sa section manque dans la configuration) le dit sans échouer. */
export const inactif = (nom) => ({ name: `${nom} (désactivé)`, errors: [], warnings: [], skipped: true });
