# Cohérence par construction

Quatre garde-fous pour un site statique, en Node sans aucune dépendance.

Ils rendent l'état correct automatique et l'état incorrect bruyant, plutôt que de compter
sur la discipline de qui écrit. Le principe tient en une phrase : **une seule source par
fait, tout le reste dérivé, et une dérive silencieuse rendue impossible.**

> *In English: four zero-dependency Node guardrails for a static site. They enforce a
> single source of truth for numbers, make a design charter binding, fail a deploy that
> contradicts itself, and prove that generated pages match their source. Clone, run
> `node check.mjs`, everything passes. Run `node epreuve.mjs` and eight deliberate
> regressions are each caught.*

## Le problème

Un site statique n'a pas de compilateur pour dire non. Rien n'empêche

- un chiffre juste à un endroit et périmé à quatre autres, parce qu'on l'a mis à jour une
  fois sur cinq et que rien n'a signalé l'oubli ;
- une charte graphique de quatre couleurs qui en compte onze au bout de six mois, chacune
  arrivée pour une bonne raison, sans que personne sache laquelle fait foi ;
- une mise en ligne avec un sitemap qui pointe encore l'ancien domaine, le jour où on
  était pressé, c'est-à-dire le seul jour où ça arrive ;
- une coquille corrigée directement dans une page générée, écrasée à la génération
  suivante, ou pire, survivante.

Aucun de ces quatre défauts ne se voit à la relecture. Tous se voient à un contrôle qui
échoue.

## Essayer, en trente secondes

```bash
git clone https://github.com/antonbrunel/coherence-par-construction
cd coherence-par-construction
node check.mjs
```

```
  ok  Palette et typographie (4 couleurs, 2 fontes)
  ok  Chiffres (2 faits)
  ok  Déploiement (fail-closed)
  ok  Langues (fr, en, 6 clés, 2 pages)

Tout est cohérent.
```

Le dépôt contient un site d'exemple minuscule, dans `exemple/` : deux pages générées en
deux langues, une charte, des chiffres, un sitemap. Les contrôles tournent dessus.

Maintenant, casse-le. Change `214` en `215` dans `exemple/data/facts.json`, ajoute
`color: #ff00ff` dans `exemple/style.css`, corrige un titre à la main dans
`exemple/index.html`, et relance :

```
  x style.css : couleur hors charte #ff00ff
ECHEC Palette et typographie (4 couleurs, 2 fontes)
  x llms.txt : « 214 » (abris) absent, dérive de la source unique
ECHEC Chiffres (2 faits)
  ok  Déploiement (fail-closed)
  x index.html : diverge de sa source, lancer le générateur (ne jamais éditer une page rendue)
ECHEC Langues (fr, en, 6 clés, 2 pages)

3 contrôle(s) en échec.
```

Code de sortie 1. C'est tout l'intérêt : branché en pre-commit ou en CI, le commit ne
passe pas.

## Les quatre contrôles

| Contrôle | Ce qu'il rend impossible |
|---|---|
| [`controles/faits.mjs`](controles/faits.mjs) | Changer un chiffre à un endroit et l'oublier ailleurs. Un fichier déclare chaque chiffre et la liste des fichiers où il doit apparaître. |
| [`controles/palette.mjs`](controles/palette.mjs) | Employer une couleur ou une fonte hors charte. La charte est la source ; aucune couleur n'est écrite dans le code du contrôle. |
| [`controles/deploiement.mjs`](controles/deploiement.mjs) | Mettre en ligne un site qui se contredit : fichier requis manquant, canonical différent de `og:url`, sitemap ou robots hors du domaine canonique. Fail-closed. |
| [`controles/langues.mjs`](controles/langues.mjs) | Éditer une page générée à la main, oublier une clé dans une langue, casser la réciprocité des `hreflang`. Le contrôle appelle le générateur et exige l'égalité octet par octet. |

Le quatrième est le plus utile des quatre, et le moins évident : il ne relit pas la page
pour deviner si elle est correcte, **il la reconstruit et exige l'égalité**. Un fichier
généré qu'on peut éditer à la main sans que rien ne proteste finit édité à la main.

## L'épreuve

Un contrôle qui n'a jamais échoué ne prouve rien. `epreuve.mjs` introduit huit dérives
réelles dans une copie du site, une par invariant, et exige que chacune soit vue.

```bash
node epreuve.mjs
```

```
L'épreuve : 8 dérives, chacune doit être vue.

  ok  un chiffre change dans la source mais pas dans le fichier tenu à la main
  ok  une couleur hors charte entre dans le CSS
  ok  une fonte hors charte entre dans le CSS
  ok  un fichier requis disparaît
  ok  robots.txt désigne un sitemap sur un autre domaine
  ok  une page générée est corrigée à la main
  ok  une clé existe dans une langue et pas dans l'autre
  ok  une page indexable manque au sitemap

Les huit dérives sont vues. Les garde-fous gardent.
```

## Le brancher sur ton site

Tout ce qui est propre à un site vit dans [`coherence.config.json`](coherence.config.json),
et nulle part dans le code des contrôles. Changer `racine` et les chemins suffit. Une
section absente désactive son contrôle : on peut n'en prendre qu'un.

Le contrôle des langues attend de ton générateur qu'il exporte `LANGUES`, `PAGES`,
`urlDe()` et `construire()`. [`exemple/build.mjs`](exemple/build.mjs) montre la forme, en
soixante lignes.

En pre-commit :

```bash
git config core.hooksPath .githooks   # avec .githooks/pre-commit qui lance node check.mjs
```

En CI : [`.github/workflows/coherence.yml`](.github/workflows/coherence.yml) lance les
contrôles et l'épreuve à chaque poussée.

## Le raisonnement

[`playbook.md`](playbook.md) est la méthode derrière ces quatre scripts : comment
diagnostiquer un dépôt, quels patterns appliquer, et surtout quand ne rien faire. Le
principal risque de cette approche est la sur-ingénierie : un mécanisme qui protège un
site statique ne doit jamais peser plus lourd que le site. `controles/` fait 410 lignes,
commentaires compris.

## D'où ça vient

Extrait de [antton-brunel.com](https://antton-brunel.com), où ces quatre contrôles
tournent en pre-commit et en CI depuis juillet 2026 sur un site vanilla sans build. Le
site d'exemple de ce dépôt en est une miniature : la mécanique est celle qui tourne, pas
une reconstitution.

MIT. Fais-en ce que tu veux.
