# 🏍️ TRAIL MÉTÉO

Dashboard météo orienté **moto trail & enduro**. Pour une ville donnée, il calcule un **indice de roulabilité** (0–100) à partir des facteurs qui comptent vraiment quand on part rouler : vent, rafales, pluie, ressenti et visibilité. Verdict immédiat : **GO / BON / PRUDENCE / NO-GO**.

Aucune clé API, aucun backend, aucune dépendance à installer — du HTML/CSS/JS pur, prêt pour GitHub Pages.

[https://weexee.github.io/Trail-meteo/](https://weexee.github.io/Trail-Meteo/)
---

## ✨ Fonctionnalités

- **Jauge de roulabilité** : un score sur 100 avec aiguille type instrument de bord et verdict coloré.
- **Points de vigilance** : alertes contextuelles (rafales, boue, verglas, brouillard…).
- **Conditions actuelles** : ressenti, vent + direction, rafales, pluie, humidité, état du ciel.
- **Meilleurs créneaux du jour** : les 12 prochaines heures, avec les 3 meilleures fenêtres mises en avant.
- **Prévisions 7 jours** : un indice de roulabilité par jour, en un coup d'œil.
- **Recherche de ville** avec autocomplétion (navigation clavier ↑ ↓ Entrée).
- **Villes favorites** mémorisées localement (`localStorage`).
- **Responsive** mobile / desktop + accessibilité clavier et `prefers-reduced-motion`.

---

## 🧮 Comment l'indice est calculé

Le score part de 100 et applique des pénalités selon chaque facteur :

| Facteur | Seuils | Impact |
|---|---|---|
| Pluie / averses | léger → fort (mm + probabilité) | −9 à −38 |
| Vent moyen | ≥ 35 / ≥ 55 km/h | −12 / −24 |
| Rafales | ≥ 55 / ≥ 75 km/h | −14 / −26 |
| Ressenti | froid ≤ 6 °C / ≤ 0 °C ou chaud ≥ 30 / ≥ 36 °C | −6 à −22 |
| Visibilité | < 3 km / < 1 km | −13 / −30 |
| Phénomènes | orage, neige, verglas | −26 à −30 |

Verdict final : **GO** (≥ 80) · **BON** (60–79) · **PRUDENCE** (40–59) · **NO-GO** (< 40).

> ⚠️ Indicatif uniquement. La logique de scoring est dans `computeScore()` (`script.js`) — facile à ajuster selon ta pratique (enduro pur, trail routier, etc.).

---

## 🛠️ Stack technique

| Élément | Détail |
|---|---|
| Langages | HTML, CSS, JavaScript (vanilla, sans framework) |
| Données météo | [Open-Meteo Forecast API](https://open-meteo.com/) — gratuite, sans clé |
| Recherche de ville | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) |
| Stockage | `localStorage` (favoris + dernière ville) |
| Typographies | Anton (display), Sora (texte), Space Mono (données) |
| Déploiement | GitHub Pages |

---

## 📁 Structure

```
trail-meteo/
├── index.html    # Structure de la page
├── style.css     # Direction artistique (terre + orange haute-visibilité)
├── script.js     # Géocodage, scoring, rendu, favoris
└── README.md     # Ce fichier
```

---

## 🚀 Déployer sur GitHub Pages

1. Crée un repo sur [github.com](https://github.com) → **New repository** → nom : `trail-meteo`.
2. Pousse les 3 fichiers (`index.html`, `style.css`, `script.js`) + ce README :
   ```bash
   git init
   git add .
   git commit -m "Trail Météo"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/trail-meteo.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Source : `main` / `/ (root)`** → **Save**.
4. Après ~1 min, ton URL publique : `https://TON-PSEUDO.github.io/trail-meteo/`

> 💡 Tester en local : ouvre simplement `index.html` dans le navigateur, ou lance `python3 -m http.server` dans le dossier.

---

## 🔧 Personnalisation rapide

- **Ville par défaut** : fin de `script.js`, fonction `init()` (Toulouse par défaut).
- **Seuils de scoring** : fonction `computeScore()`.
- **Couleurs** : variables CSS en haut de `style.css` (`:root`).
