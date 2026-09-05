/* Contrôle 4 : la page rendue ne peut pas mentir sur sa construction.

   Le problème qu'il résout : dès qu'un site a des pages générées, quelqu'un finit par
   corriger une coquille directement dans la page rendue. La correction est écrasée à la
   génération suivante, ou pire, elle survit et la page ne correspond plus à sa source.
   Le même désordre touche les traductions : une clé ajoutée dans une langue et oubliée
   dans l'autre ne se voit pas avant la mise en ligne.

   La forme, et c'est le pattern le plus utile du lot : le contrôle appelle le générateur
   et compare son résultat, octet par octet, aux fichiers sur le disque. Il ne relit pas
   la page pour deviner si elle est correcte, il la reconstruit et exige l'égalité.
   Un fichier généré qu'on peut éditer à la main sans que rien ne proteste finit édité
   à la main.

   Il vérifie ensuite ce que la génération seule ne garantit pas : la parité des clés
   entre langues, et la réciprocité des liens hreflang entre versions. */
import { lecteur, attribut, inactif } from './lib.mjs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

/* Les chemins de clés d'un objet, feuilles seulement (un tableau est une feuille). */
function cles(o, prefixe = '') {
  const out = [];
  for (const [k, v] of Object.entries(o)) {
    const c = prefixe ? `${prefixe}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...cles(v, c));
    else out.push([c, v]);
  }
  return out;
}

export async function run(cfg) {
  if (!cfg.langues) return inactif('Langues');
  const l = cfg.langues;
  const { lire, chemin } = lecteur(cfg);
  const errors = [];
  const warnings = [];

  /* Le générateur du site est importé tel quel : c'est lui la référence. */
  let gen;
  try {
    gen = await import(pathToFileURL(join(cfg._racine, l.generateur)).href);
  } catch (e) {
    return { name: 'Langues', errors: [`${l.generateur} : import impossible (${e.message})`], warnings };
  }
  const { LANGUES, PAGES, urlDe, construire } = gen;
  if (!LANGUES || !PAGES || !urlDe || !construire) {
    return {
      name: 'Langues',
      errors: [`${l.generateur} : doit exporter LANGUES, PAGES, urlDe et construire`],
      warnings,
    };
  }

  /* 1. Mêmes clés partout, aucune valeur vide. */
  const dicts = {};
  for (const langue of LANGUES) {
    const f = l.dictionnaires.replace('{langue}', langue);
    try { dicts[langue] = new Map(cles(JSON.parse(lire(f)))); } catch (e) {
      errors.push(`${f} : illisible (${e.message})`);
    }
  }
  for (const langue of LANGUES) {
    if (!dicts[langue]) continue;
    for (const [c, v] of dicts[langue]) {
      if (v === '' || (Array.isArray(v) && !v.length)) errors.push(`${langue} : « ${c} » vide`);
      for (const autre of LANGUES) {
        if (autre !== langue && dicts[autre] && !dicts[autre].has(c)) {
          errors.push(`${autre} : clé « ${c} » absente, présente en ${langue}`);
        }
      }
    }
  }

  /* 2. Ce qui est écrit est exactement ce que le générateur produit. */
  let sorties;
  try {
    sorties = await construire();
  } catch (e) {
    errors.push(`construction impossible : ${e.message}`);
    return { name: 'Langues', errors, warnings };
  }
  for (const { chemin: c, contenu } of sorties) {
    let ecrit;
    try { ecrit = lire(c); } catch {
      errors.push(`${c} : absent, lancer le générateur`);
      continue;
    }
    if (ecrit !== contenu) {
      errors.push(`${c} : diverge de sa source, lancer le générateur (ne jamais éditer une page rendue)`);
    }
  }

  /* 3. Chaque page dit vrai sur elle-même, et ses traductions lui répondent. */
  const sitemap = l.sitemap ? lire(l.sitemap) : '';
  for (const page of PAGES) {
    const versions = Object.entries(page.sorties).filter(([lg]) => LANGUES.includes(lg));
    for (const [langue, c] of versions) {
      let html;
      try { html = lire(c); } catch { continue; }
      const attendu = urlDe(c);

      const lang = attribut(html, /<html[^>]*\slang="([^"]+)"/);
      if (lang !== langue) errors.push(`${c} : lang="${lang}" au lieu de "${langue}"`);

      const canonical = attribut(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
      const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html);
      if (!noindex) {
        if (!canonical) errors.push(`${c} : canonical manquant`);
        else if (canonical !== attendu) errors.push(`${c} : canonical ${canonical} au lieu de ${attendu}`);
        if (sitemap && !sitemap.includes(`<loc>${attendu}</loc>`)) {
          errors.push(`${l.sitemap} : ${attendu} manquant`);
        }
      }

      if (versions.length < 2) continue;
      const liens = Object.fromEntries(
        [...html.matchAll(/<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"/g)]
          .map((m) => [m[1], m[2]])
      );
      for (const [autre, cAutre] of versions) {
        const uAutre = urlDe(cAutre);
        if (liens[autre] !== uAutre) {
          errors.push(`${c} : hreflang="${autre}" attendu vers ${uAutre}, trouvé ${liens[autre] || 'rien'}`);
        }
        if (autre === langue) continue;
        let htmlAutre;
        try { htmlAutre = lire(cAutre); } catch { continue; }
        const retour = attribut(
          htmlAutre,
          new RegExp(`<link[^>]+rel="alternate"[^>]+hreflang="${langue}"[^>]+href="([^"]+)"`)
        );
        if (retour !== attendu) {
          errors.push(`${cAutre} : ne renvoie pas vers ${attendu} en hreflang="${langue}" (réciprocité)`);
        }
      }
      if (!liens['x-default']) errors.push(`${c} : hreflang="x-default" manquant`);
    }
  }

  const n = dicts[LANGUES[0]] ? dicts[LANGUES[0]].size : 0;
  return { name: `Langues (${LANGUES.join(', ')}, ${n} clés, ${sorties.length} pages)`, errors, warnings };
}
