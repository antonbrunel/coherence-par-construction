/* Contrôle 3 : la mise en ligne échoue fermée.

   Le problème qu'il résout : une checklist de déploiement écrite dans une doc est une
   checklist qu'on saute le jour où on est pressé, et c'est le jour où on est pressé
   qu'on met en ligne une page sans canonical ou un sitemap qui pointe l'ancien domaine.

   La forme : le contrôle refuse de laisser passer si un fichier requis manque ou est
   vide, ou si les affirmations de la page se contredisent entre elles. Fail-closed :
   en cas de doute, il bloque.

   Ce qui est un avertissement plutôt qu'une erreur : ce qui est souhaitable mais dont
   l'absence ne casse rien (une image de partage, par exemple). Un avertissement qui
   bloque finit par être contourné, et le contrôle entier perd son autorité. */
import { lecteur, attribut, inactif } from './lib.mjs';

export function run(cfg) {
  if (!cfg.deploiement) return inactif('Déploiement');
  const d = cfg.deploiement;
  const { lire, existe, manque } = lecteur(cfg);
  const errors = [];
  const warnings = [];

  /* 1. Les fichiers requis sont là, et non vides. Si non, on s'arrête : le reste
     lirait des fichiers absents et rendrait un bruit illisible. */
  for (const f of d.requis || []) {
    if (manque(f)) errors.push(`${f} : manquant`);
    else if (!existe(f)) errors.push(`${f} : présent mais vide`);
  }
  if (errors.length) return { name: 'Déploiement (fail-closed)', errors, warnings };

  /* 2. Tout JSON déclaré requis doit parser. */
  for (const f of (d.requis || []).filter((f) => f.endsWith('.json'))) {
    try { JSON.parse(lire(f)); } catch (e) { errors.push(`${f} : JSON invalide (${e.message})`); }
  }

  /* 3. La page d'entrée porte ce qu'il faut pour être partagée et indexée. */
  const html = lire(d.page);
  const canonical = attribut(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
  const ogUrl = attribut(html, /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/);
  const exiges = {
    canonical,
    'og:url': ogUrl,
    'og:title': attribut(html, /property="og:title"[^>]+content="([^"]+)"/),
    'og:description': attribut(html, /property="og:description"[^>]+content="([^"]+)"/),
    'twitter:card': attribut(html, /name="twitter:card"[^>]+content="([^"]+)"/),
    'JSON-LD': /application\/ld\+json/.test(html) ? 'présent' : undefined,
  };
  for (const [nom, v] of Object.entries(exiges)) {
    if (!v) errors.push(`${d.page} : ${nom} manquant`);
  }

  /* 4. La page ne se contredit pas : l'adresse qu'elle déclare canonique est celle
     qu'elle donne à partager. */
  if (canonical && ogUrl && canonical !== ogUrl) {
    errors.push(`${d.page} : og:url (${ogUrl}) ne vaut pas canonical (${canonical})`);
  }

  /* 5. Le domaine canonique est celui du sitemap, et robots.txt désigne ce sitemap. */
  if (canonical) {
    let origine;
    try { origine = new URL(canonical).origin; } catch { errors.push(`${d.page} : canonical « ${canonical} » n'est pas une URL`); }
    if (origine && d.sitemap && !lire(d.sitemap).includes(origine)) {
      errors.push(`${d.sitemap} : ne contient pas ${origine}`);
    }
    if (origine && d.robots) {
      const ligne = lire(d.robots).match(/Sitemap:\s*(\S+)/i);
      if (!ligne) errors.push(`${d.robots} : ligne « Sitemap: » manquante`);
      else {
        try {
          if (new URL(ligne[1]).origin !== origine) {
            errors.push(`${d.robots} : sitemap ${ligne[1]} hors du domaine canonique ${origine}`);
          }
        } catch { errors.push(`${d.robots} : « ${ligne[1]} » n'est pas une URL`); }
      }
    }
  }

  /* 6. Souhaitable, non bloquant. */
  if (!/property="og:image"/.test(html)) {
    warnings.push(`${d.page} : og:image absent, le partage n'aura pas d'aperçu`);
  }

  return { name: 'Déploiement (fail-closed)', errors, warnings };
}
