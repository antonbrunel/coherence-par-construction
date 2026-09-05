#!/usr/bin/env node
/* Les quatre contrôles, lancés ensemble.

     node check.mjs                 tous les contrôles
     node check.mjs faits palette   ceux qu'on nomme
     node check.mjs --config autre.json

   Sort en 1 si un contrôle échoue : c'est ce qui le rend utile en pre-commit et en CI.
   Un contrôle qui n'est pas branché sur quelque chose qui bloque n'existe pas.
   Zéro dépendance, rien à installer. */
import { config } from './controles/lib.mjs';
import { run as palette } from './controles/palette.mjs';
import { run as faits } from './controles/faits.mjs';
import { run as deploiement } from './controles/deploiement.mjs';
import { run as langues } from './controles/langues.mjs';

const CONTROLES = { palette, faits, deploiement, langues };

const args = process.argv.slice(2);
const iConfig = args.indexOf('--config');
const cheminConfig = iConfig === -1 ? undefined : args[iConfig + 1];
/* La valeur qui suit --config n'est pas un nom de contrôle. Sans --config, aucun
   indice n'est à écarter : iConfig + 1 vaudrait 0 et mangerait le premier argument. */
const iValeur = iConfig === -1 ? -1 : iConfig + 1;
const demandes = args.filter((a, i) => !a.startsWith('--') && i !== iValeur);

const inconnus = demandes.filter((d) => !(d in CONTROLES));
if (inconnus.length) {
  console.error(`Contrôle inconnu : ${inconnus.join(', ')}. Connus : ${Object.keys(CONTROLES).join(', ')}.`);
  process.exit(2);
}

const cfg = config(cheminConfig);
const choisis = demandes.length ? demandes : Object.keys(CONTROLES);

let echecs = 0;
for (const nom of choisis) {
  let r;
  try {
    r = await CONTROLES[nom](cfg);
  } catch (e) {
    r = { name: nom, errors: [`le contrôle a levé : ${e.message}`], warnings: [] };
  }
  for (const w of r.warnings) console.warn(`  ! ${w}`);
  for (const e of r.errors) console.error(`  x ${e}`);
  console.log(`${r.errors.length ? 'ECHEC' : r.skipped ? '  -  ' : '  ok '} ${r.name}`);
  if (r.errors.length) echecs++;
}

console.log(echecs ? `\n${echecs} contrôle(s) en échec.` : '\nTout est cohérent.');
process.exit(echecs ? 1 : 0);
