/* Contrôle 1 : la source unique des chiffres.

   Le problème qu'il résout : un chiffre juste, écrit à cinq endroits, devient faux à
   quatre dès qu'on le met à jour au premier. Aucune relecture n'attrape ça de façon
   fiable, parce que rien ne signale l'oubli.

   La forme : un fichier déclare chaque chiffre, sa valeur, et la liste des fichiers où
   il doit apparaître. Le contrôle vérifie la présence, fichier par fichier.

   Ce que ce contrôle est, et n'est pas : un filet contre la dérive, pas une preuve
   formelle. Une valeur courte (« 3 ») peut se trouver par hasard dans un fichier, donc
   un faux négatif est possible. Mais changer un chiffre en oubliant un fichier déclaré
   est toujours attrapé, et c'est le seul cas qui arrive en vrai. */
import { lecteur, normaliser, inactif } from './lib.mjs';

export function run(cfg) {
  if (!cfg.faits) return inactif('Chiffres');
  const { lire } = lecteur(cfg);
  const { faits } = JSON.parse(lire(cfg.faits.source));
  const errors = [];

  for (const { cle, valeur, presence } of faits) {
    const cible = normaliser(String(valeur));
    for (const fichier of presence) {
      let contenu;
      try {
        contenu = normaliser(lire(fichier));
      } catch {
        errors.push(`${fichier} : déclaré pour « ${cle} » mais introuvable`);
        continue;
      }
      if (!contenu.includes(cible)) {
        errors.push(`${fichier} : « ${valeur} » (${cle}) absent, dérive de la source unique`);
      }
    }
  }

  return { name: `Chiffres (${faits.length} faits)`, errors, warnings: [] };
}
