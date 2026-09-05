# Cohérence par construction, la méthode

La méthode derrière les quatre contrôles de ce dépôt. Le corps est générique et portable :
il vaut pour n'importe quel dépôt, pas seulement pour un site statique. La dernière
section montre comment il s'applique ici.

Écrit pour être lu par un agent IA autant que par une personne, d'où le tutoiement direct
et le vocabulaire anglais donné en regard : ce sont les termes à mettre dans un prompt.

---

Tu es un agent IA chargé de rendre un dépôt plus maintenable. Ce document te donne une méthode
éprouvée et son vocabulaire. **Lis-le comme une boîte à outils, pas comme une liste de tâches à
cocher.** Tout n'est pas pertinent pour tous les dépôts : appliquer un pattern qui ne résout aucun
problème réel est de la sur-ingénierie, et c'est une dérive en soi.

Avant d'appliquer quoi que ce soit, fais un **diagnostic** et n'agis que sur les vraies opportunités :

1. **Cherche la connaissance dupliquée** : une même information vit-elle à deux endroits (une doc qui
   redit ce que dit le code, une table tenue à la main qui liste ce qui existe déjà ailleurs, une
   valeur recopiée) ?
2. **Cherche ce qui périme** : docs datées, listes manuelles, numéros de version, exemples, statuts
   « fait / à faire », tout ce qui se démode dès que le code bouge.
3. **Cherche les conventions tenues seulement par discipline** : frontières de couches, formats,
   règles de nommage, invariants, respectés parce qu'on y pense, pas parce que quelque chose casse
   si on les enfreint.
4. **Pour chaque trouvaille réelle**, choisis le pattern adapté ci-dessous et **applique-le jusqu'au
   bout** : source → génération → contrôle → CI. Un correctif de surface donne une fausse confiance,
   ce qui est pire que rien.
5. **Ne touche pas à ce qui n'a pas de problème réel.** Pas de nouveau mécanisme sans une dérive
   concrète qu'il empêche.

Critère de « jusqu'au bout » à garder en tête tout du long : un contrôle qui n'est pas branché en CI
n'existe pas ; une source unique dont un seul consommateur dérive pendant que les autres recopient à
la main n'est pas une source unique ; un fichier généré qu'on peut éditer à la main sans que rien ne
proteste finira édité à la main.

## Le principe-chapeau

Vise la **cohérence par construction** plutôt que par discipline : rends l'état correct *automatique*
et l'état incorrect *impossible ou bruyant*. N'espère jamais qu'un humain « pense à » mettre à jour :
ce qui repose sur la mémoire dérive toujours.

L'idée mère est le vrai **DRY** (Pragmatic Programmer) : « toute connaissance doit avoir une
représentation unique, non ambiguë et faisant autorité dans le système ». DRY parle de *connaissance*,
pas de lignes copiées. Ta cible n'est pas « moins de code dupliqué », c'est « une seule source par
fait, tout le reste dérivé, et une dérive silencieuse rendue impossible ».

## Les patterns qu'on a utilisés, nommés

| Pattern | Nom canonique (FR) | Terme à mettre dans un prompt (EN) |
|---|---|---|
| Un fichier fait autorité, le reste en dérive | Source unique de vérité | **single source of truth (SSOT)** |
| Une doc/table régénérée depuis le code ou la config | Documentation générée | **docs-as-code**, **generated-from-source** |
| Un `--check` qui casse la CI si le généré diverge | Détection de dérive | **drift detection / drift check** |
| Récit à la main (jugement) + inventaire généré (faits) | Séparer jugement et faits | **human-authored narrative + generated inventory** |
| Une procédure écrite qui s'exécute | Documentation exécutable | **living documentation**, **executable specification** |
| Le contrôle en CI comme invariant d'architecture | Garde-fou vérifié en continu | **fitness function**, **guardrail** |
| Régénérer donne exactement le même résultat | Génération idempotente | **idempotent / deterministic generation** |
| Découverte des cibles par marqueur | Opt-in par convention | **convention over configuration** |
| Des paliers machine-vérifiables de « prêt » | Contrat de complétude | **definition of done/ready**, **quality gate** |
| Refuser d'agir si l'état n'est pas sûr | Échec par défaut sûr | **fail-closed**, **secure by default** |
| Un passage périodique qui recolle au réel | Boucle de réconciliation | **reconciliation loop** |

## Formules prêtes à coller dans tes prompts

- « Traite `<fichier>` comme la **source unique de vérité** ; tout le reste doit en être
  **dérivé/généré**, jamais dupliqué à la main. »
- « Ajoute un **contrôle anti-dérive** : un `--check` qui **échoue en CI** si l'artefact généré
  diverge de sa source, et branche-le sur les chemins qui le déclenchent. »
- « Sépare le **récit** (jugement, à la main, intemporel) de l'**inventaire** (faits, généré). »
- « **Fais échouer bruyamment plutôt que dériver silencieusement** (fail-closed). »
- « Rends le **bon geste automatique** et le **mauvais geste impossible ou visible**. »
- « Marque les fichiers générés « ne pas éditer » et régénère-les de façon **idempotente**. »
- « Découvre les cibles **par convention** (marqueur), pas par une liste codée en dur. »

## Comment aller plus loin, par paliers

1. **Shift-left** : régénération + `--check` en **pre-commit**, pas seulement en CI.
2. **Auto-fix** : pour un fichier 100 % dérivé, un bot qui régénère et commite ; échec dur pour ce
   qui exige un jugement.
3. **Schémas** : valide le format des fichiers structurés (Zod, JSON Schema, frontmatter).
4. **Frontières en tests** : dependency-cruiser / import-linter font échouer la CI si une couche
   importe ce qu'elle ne doit pas (*architecture fitness functions*).
5. **Changelog/versions générés** depuis les *conventional commits*.
6. **ADR** : une décision structurante = un ADR court et immuable.

Signes d'un palier resté en surface : un check déclenché par aucun chemin CI ; un schéma défini
jamais appelé ; un hook local sans équivalent CI (contournable) ; un ADR écrit après coup.

## Pratiques voisines dans la même direction

- **Guardrails / paved road / golden path** : le chemin le plus facile est le chemin correct.
- **Policy as code** (OPA, Conftest) : règles de conformité vérifiées en pipeline.
- **Contract testing** (Pact) : deux composants respectent un contrat partagé, vérifié.
- **Approval / golden-master / snapshot testing** : figer une sortie, casser au moindre écart.
- **Living documentation / specification by example** : la doc est la suite de tests.
- **Boucle de réconciliation** (Kubernetes) : comparer désiré et réel, corriger en continu.

---

À retenir en une phrase : **une seule source de vérité, tout le reste généré, une dérive silencieuse
rendue impossible, le pipeline régénère ou casse.**


## Application à ce dépôt

Les quatre contrôles de `controles/` sont ce playbook appliqué à un site statique sans
build, en version légère : quatre scripts Node, 410 lignes commentaires compris, aucune
dépendance. Chacun instancie un pattern nommé plus haut.

| Contrôle | Patterns instanciés |
|---|---|
| `faits.mjs` | Source unique de vérité, détection de dérive |
| `palette.mjs` | Source unique de vérité (la charte), garde-fou vérifié en continu |
| `deploiement.mjs` | Échec par défaut sûr, contrat de complétude |
| `langues.mjs` | Génération idempotente, détection de dérive, documentation générée |
| `epreuve.mjs` | Le garde-fou lui-même mis à l'épreuve |

`epreuve.mjs` mérite un mot : c'est le palier qu'on saute presque toujours. Un contrôle
qu'on n'a jamais vu échouer n'a pas été vérifié, il a été supposé. L'épreuve introduit
huit dérives réelles, une par invariant, et exige que chacune soit vue. C'est peu de
code, et c'est ce qui distingue un garde-fou d'une décoration.

Ce qui a été délibérément laissé de côté ici, faute de problème réel à résoudre : les
schémas de validation, les frontières de couches en tests, le changelog généré. Les
ajouter à un site de quelques pages coûterait plus que la dérive qu'ils éviteraient. Le
palier suivant se prend quand la douleur existe, pas avant.
