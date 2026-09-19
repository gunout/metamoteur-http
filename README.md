# 🛰 FTP METASEARCH

> Métamoteur de recherche **100 % frontend** qui agrège plusieurs sources de fichiers (audio, vidéo, livres) — **aucun backend, aucune inscription, aucune clé API**.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-success?logo=github)](https://gunout.github.io/metamoteur-http/)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![No Backend](https://img.shields.io/badge/backend-none-brightgreen)]()
[![No API Key](https://img.shields.io/badge/API%20key-not%20required-brightgreen)]()

🔗 **Démo live** : [https://gunout.github.io/metamoteur-http/](https://gunout.github.io/metamoteur-http/)

---

## 📖 Sommaire

- [✨ Fonctionnalités](#-fonctionnalités)
- [📡 Sources supportées](#-sources-supportées)
- [🚀 Utilisation](#-utilisation)
- [🛠 Stack technique](#-stack-technique)
- [📁 Structure du projet](#-structure-du-projet)
- [🎯 Comment ça marche](#-comment-ça-marche)
- [🤝 Contribuer](#-contribuer)
- [⚠️ Avertissement légal](#️-avertissement-légal)
- [📄 License](#-license)

---

## ✨ Fonctionnalités

- 🔍 **Recherche multi-sources en parallèle** — interroge toutes les sources simultanément
- 🎯 **Filtres par type** — Audio, Vidéo, Livres, Archives
- 🎨 **Interface cyber** responsive, sans framework
- ⚡ **100 % frontend** — pas de serveur, pas de backend
- 🆓 **Aucune inscription** — juste GitHub Pages
- 🔓 **Aucune clé API** — utilise des APIs publiques à CORS ouvert
- 🔗 **Liens HTTP directs** quand disponibles
- 🚀 **Déploiement automatique** via GitHub Pages

---

## 📡 Sources supportées

### ✅ Sources intégrées (recherche dans la page)

| Source | Type | CORS | Statut |
|---|---|:---:|:---:|
| **Internet Archive** | Audio · Vidéo · Livres | ✅ | Actif |
| **Wikimedia Commons** | Audio · Vidéo | ✅ | Actif |
| **Open Library** | Livres | ✅ | Actif |

### ↗ Sources externes (bouton — ouvrent un onglet)

| Source | Type | Note |
|---|---|---|
| **Napalm FTP Indexer** | FTP | Index FTP public |
| **Mamont's Open FTP Index** | FTP | 4,29 milliards de fichiers |
| **Project Gutenberg** | Livres | Domaine public |
| **Jamendo** | Audio | Musique libre de droits |

> Les sources externes nécessitent un backend ou un proxy CORS pour fonctionner.
> Ici, elles s'ouvrent dans un nouvel onglet pour contourner la limitation.

---

## 🚀 Utilisation

### En ligne

Ouvre simplement :
```
https://gunout.github.io/metamoteur-http/
```

### En local

1. Clone le repo :
```bash
git clone https://github.com/gunout/metamoteur-http.git
cd metamoteur-http
```

2. Ouvre `docs/index.html` dans ton navigateur :
```bash
# Linux
xdg-open docs/index.html

# macOS
open docs/index.html

# Windows
start docs/index.html
```

Ou utilise un petit serveur local :
```bash
python3 -m http.server 8000
# puis http://localhost:8000/docs/
```

### Utilisation

1. Tape un mot-clé (ex: `Nirvana`, `Victor Hugo`, `Pink Floyd`)
2. Coche les sources voulues
3. Choisis un filtre : **Tout / Audio / Vidéo / Livres / Archives**
4. Clique **CHERCHER**
5. Les résultats apparaissent avec :
   - 🎵 / 🎬 / 📚 / 📦 icône selon le type
   - Titre et métadonnées
   - URL directe
   - Boutons **Ouvrir** (↗) et **Télécharger** (⬇)

---

## 🛠 Stack technique

| Couche | Technologie |
|---|---|
| **Frontend** | HTML5 · CSS3 · JavaScript vanilla |
| **APIs** | Internet Archive · Wikimedia Commons · Open Library |
| **Hébergement** | GitHub Pages |
| **Backend** | Aucun |

**Aucune dépendance** — pas de npm, pas de build, pas de framework.

---

## 📁 Structure du projet

```
metamoteur-http/
│
├── docs/
│   └── index.html          # Application complète (HTML + CSS + JS)
│
├── .gitignore
├── LICENSE                 # MIT
└── README.md
```

Le fichier `docs/index.html` contient **tout** :
- Structure HTML
- Styles CSS
- Logique JavaScript
- Appels API

---

## 🎯 Comment ça marche

### 1. Recherche parallèle

Quand tu cliques **CHERCHER**, le script envoie **3 requêtes simultanées** aux APIs :

```javascript
const promises = activeSources.map(src => src.search(keyword));
await Promise.allSettled(promises);
```

Chaque source retourne un tableau d'objets :
```javascript
{ title, url, downloadUrl, source, type, extra }
```

### 2. Déduplication

Les résultats sont filtrés pour retirer les URLs en double :

```javascript
const seen = new Set();
results.filter(r => {
  if (seen.has(r.url)) return false;
  seen.add(r.url);
  return true;
});
```

### 3. Détection du type

L'extension du fichier détermine son type :

```javascript
function detectType(str) {
  const ext = str.split('.').pop().toLowerCase();
  if (['mp3','flac','m4a'].includes(ext)) return 'audio';
  if (['mp4','mkv','avi'].includes(ext)) return 'video';
  if (['epub','pdf','mobi'].includes(ext)) return 'book';
  return 'other';
}
```

### 4. Filtres

Les filtres s'appliquent côté client, sans nouvelle requête :

```javascript
const filtered = currentFilter === 'all'
  ? allResults
  : allResults.filter(r => r.type === currentFilter);
```

---

## 🚀 Déploiement GitHub Pages

### Activer GitHub Pages

1. Va sur `https://github.com/gunout/metamoteur-http/settings/pages`
2. **Source** : `Deploy from a branch`
3. **Branch** : `main`
4. **Folder** : `/docs`
5. Clique **Save**

Attends 1-2 minutes. Ton site sera live sur :
```
https://gunout.github.io/metamoteur-http/
```

### Mise à jour

Chaque `git push` sur `main` déclenche automatiquement un redéploiement.

---

## 🤝 Contribuer

Les contributions sont bienvenues !

### Ajouter une nouvelle source

1. Ouvre `docs/index.html`
2. Trouve le tableau `SOURCES`
3. Ajoute un nouvel objet :

```javascript
{
  id: 'ma-source',
  name: 'Ma Source',
  desc: 'Description courte',
  enabled: true,
  async search(query) {
    const url = 'https://api.exemple.com/search?q=' + encodeURIComponent(query);
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    return data.results.map(r => ({
      title: r.title,
      url: r.url,
      downloadUrl: r.downloadUrl || r.url,
      source: 'Ma Source',
      type: detectType(r.url),
      extra: r.description || ''
    }));
  }
}
```

**⚠️ La source doit autoriser CORS** (`Access-Control-Allow-Origin: *`), sinon elle échouera.

### Tester le CORS d'une API

Ouvre la console (F12) et teste :

```javascript
fetch('https://api.exemple.com/search?q=test')
  .then(r => r.json())
  .then(d => console.log('OK', d))
  .catch(e => console.error('CORS FAIL', e));
```

### Processus de contribution

1. Fork le projet
2. Crée une branche (`git checkout -b feature/nouvelle-source`)
3. Commit (`git commit -m 'Ajout source XYZ'`)
4. Push (`git push origin feature/nouvelle-source`)
5. Ouvre une Pull Request

---

## ⚠️ Avertissement légal

> **Cet outil n'héberge aucun fichier.**
> Il agrège uniquement les résultats d'APIs publiques et de médiathèques libres
> (Internet Archive, Wikimedia Commons, Open Library).
> Respecte les lois de ton pays concernant le téléchargement de contenu protégé.
> Les auteurs ne sont pas responsables de l'usage qui en est fait.

---

## 📄 License

Ce projet est sous licence **MIT** — voir [LICENSE](./LICENSE).

---

## ⭐ Remerciements

- [Internet Archive](https://archive.org) — médiathèque universelle
- [Wikimedia Commons](https://commons.wikimedia.org) — médias libres
- [Open Library](https://openlibrary.org) — livres ouverts
- [GitHub Pages](https://pages.github.com) — hébergement gratuit

---

<p align="center">
  <b>🛰 FTP METASEARCH</b><br>
  Fait avec ❤️ pour la communauté open-source<br>
  <a href="https://gunout.github.io/metamoteur-http/">Voir la démo live</a>
</p>
