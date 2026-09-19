'use strict';

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   CORS — autorise GitHub Pages + localhost + Render/Vercel
   ========================================================= */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'https://gunout.github.io',
  /\.onrender\.com$/,
  /\.vercel\.app$/,
  /\.railway\.app$/
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl / Postman
    const ok = ALLOWED_ORIGINS.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    callback(null, ok); // renvoie true/false, pas d'erreur bloquante
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false
}));

app.use(express.json());

/* =========================================================
   STATIC — sert docs/ en priorité, puis public/
   ========================================================= */
const DOCS_DIR = path.join(__dirname, 'docs');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (fs.existsSync(DOCS_DIR)) app.use(express.static(DOCS_DIR));
if (fs.existsSync(PUBLIC_DIR)) app.use(express.static(PUBLIC_DIR));
app.use(express.static(__dirname)); // fallback racine

/* =========================================================
   CONFIG HTTP
   ========================================================= */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8'
};

/* =========================================================
   UTILS
   ========================================================= */
function detectType(str) {
  const ext = (String(str).split('?')[0].split('.').pop() || '').toLowerCase();
  if (['mp3','flac','m4a','ogg','wav','aac','opus'].includes(ext)) return 'audio';
  if (['mp4','mkv','avi','webm','mov','mpg','mpeg','ogv'].includes(ext)) return 'video';
  if (['epub','pdf','mobi','azw3','djvu','txt'].includes(ext)) return 'book';
  if (['zip','rar','7z','iso','tar','gz'].includes(ext)) return 'archive';
  return 'other';
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

/* =========================================================
   MOTEUR 1 : Internet Archive
   ========================================================= */
async function searchArchive(query) {
  try {
    const url = 'https://archive.org/advancedsearch.php?q=' +
      encodeURIComponent(query) +
      '&fl[]=identifier&fl[]=title&fl[]=mediatype&fl[]=creator&fl[]=year' +
      '&rows=30&output=json';
    const res = await axios.get(url, { timeout: 12000 });
    const docs = safeArray(res.data?.response?.docs);

    return docs.map(d => {
      let type = 'book';
      if (d.mediatype === 'audio') type = 'audio';
      else if (d.mediatype === 'movies') type = 'video';

      return {
        title: d.title || d.identifier,
        url: 'https://archive.org/details/' + d.identifier,
        downloadUrl: 'https://archive.org/download/' + d.identifier,
        source: 'Internet Archive',
        type,
        extra: [d.creator, d.year].filter(Boolean).join(' · ')
      };
    });
  } catch (e) {
    console.error('[Archive]', e.message);
    return [];
  }
}

/* =========================================================
   MOTEUR 2 : Wikimedia Commons
   ========================================================= */
async function searchCommons(query) {
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=' +
      encodeURIComponent(query) + '&srnamespace=6&format=json&origin=*&srlimit=30';
    const res = await axios.get(url, { timeout: 12000 });
    const items = safeArray(res.data?.query?.search);

    return items.map(r => {
      const fileTitle = r.title.replace('File:', '');
      return {
        title: fileTitle,
        url: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(fileTitle),
        downloadUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(fileTitle),
        source: 'Wikimedia Commons',
        type: detectType(fileTitle),
        extra: (r.snippet || '').replace(/<[^>]+>/g, '').slice(0, 150)
      };
    });
  } catch (e) {
    console.error('[Commons]', e.message);
    return [];
  }
}

/* =========================================================
   MOTEUR 3 : Open Library
   ========================================================= */
async function searchOpenLib(query) {
  try {
    const url = 'https://openlibrary.org/search.json?q=' + encodeURIComponent(query) + '&limit=30';
    const res = await axios.get(url, { timeout: 12000 });
    const docs = safeArray(res.data?.docs);

    return docs.map(d => ({
      title: d.title + (d.author_name ? ' — ' + d.author_name.join(', ') : ''),
      url: 'https://openlibrary.org' + d.key,
      downloadUrl: 'https://openlibrary.org' + d.key,
      source: 'Open Library',
      type: 'book',
      extra: [d.first_publish_year, d.publisher && d.publisher[0]].filter(Boolean).join(' · ')
    }));
  } catch (e) {
    console.error('[OpenLib]', e.message);
    return [];
  }
}

/* =========================================================
   MOTEUR 4 : Project Gutenberg
   ========================================================= */
async function searchGutenberg(query) {
  try {
    const url = 'https://gutendex.com/books?search=' + encodeURIComponent(query);
    const res = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const books = safeArray(res.data?.results);

    return books.slice(0, 30).map(b => {
      const formats = b.formats || {};
      const dl = formats['application/epub+zip'] ||
                 formats['application/pdf'] ||
                 formats['text/html'] ||
                 formats['text/plain'] ||
                 'https://www.gutenberg.org/ebooks/' + b.id;
      return {
        title: b.title + (b.authors?.[0] ? ' — ' + b.authors[0].name : ''),
        url: 'https://www.gutenberg.org/ebooks/' + b.id,
        downloadUrl: dl,
        source: 'Project Gutenberg',
        type: 'book',
        extra: safeArray(b.subjects).slice(0, 2).join(' · ')
      };
    });
  } catch (e) {
    console.error('[Gutenberg]', e.message);
    return [];
  }
}

/* =========================================================
   MOTEUR 5 : arXiv
   ========================================================= */
async function searchArxiv(query) {
  try {
    const url = 'http://export.arxiv.org/api/query?search_query=all:' +
      encodeURIComponent(query) + '&start=0&max_results=30';
    const res = await axios.get(url, { timeout: 12000 });
    const $ = cheerio.load(res.data, { xmlMode: true });
    const results = [];

    $('entry').each((i, el) => {
      const title = $(el).find('title').text().trim().replace(/\s+/g, ' ');
      const id = $(el).find('id').text().trim();
      const summary = $(el).find('summary').text().trim().replace(/\s+/g, ' ').slice(0, 180);
      const authors = $(el).find('author name').map((j, a) => $(a).text()).get().join(', ');
      const pdf = $(el).find('link[title="pdf"]').attr('href');

      if (id) {
        results.push({
          title,
          url: id,
          downloadUrl: pdf || id,
          source: 'arXiv',
          type: 'book',
          extra: authors
        });
      }
    });

    return results;
  } catch (e) {
    console.error('[arXiv]', e.message);
    return [];
  }
}

/* =========================================================
   MOTEUR 6 : FilePursuit
   ========================================================= */
async function searchFilePursuit(query) {
  try {
    const url = 'https://filepursuit.com/pursuit?q=' + encodeURIComponent(query) + '&type=all';
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results = [];

    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href || text.length < 3 || text.length > 300) return;
      if (!/\.(mp3|flac|m4a|ogg|wav|mp4|mkv|avi|webm|epub|pdf|mobi|azw3|zip|rar|7z|iso)$/i.test(href) &&
          !href.includes('/file/')) return;

      const fullUrl = href.startsWith('http') ? href : 'https://filepursuit.com' + href;
      results.push({
        title: text,
        url: fullUrl,
        downloadUrl: fullUrl,
        source: 'FilePursuit',
        type: detectType(href)
      });
    });

    return results.slice(0, 50);
  } catch (e) {
    console.error('[FilePursuit]', e.message);
    return [];
  }
}

/* =========================================================
   MOTEUR 7 : Mamont FTP
   ========================================================= */
async function searchMamont(query) {
  try {
    const url = 'https://www.mmnt.net/db/0/0?search=' + encodeURIComponent(query);
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results = [];

    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href || text.length < 3) return;
      if (!href.startsWith('ftp://') && !href.startsWith('http')) return;
      results.push({
        title: text,
        url: href,
        downloadUrl: href,
        source: 'Mamont FTP',
        type: detectType(href)
      });
    });

    return results.slice(0, 50);
  } catch (e) {
    console.error('[Mamont]', e.message);
    return [];
  }
}

/* =========================================================
   MOTEUR 8 : Napalm FTP Indexer
   ========================================================= */
async function searchNapalm(query) {
  try {
    const target = 'https://www.searchftps.net/?query=' + encodeURIComponent(query);
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(target);
    const res = await axios.get(proxyUrl, { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data);
    const results = [];

    $('tr').each((i, el) => {
      const cells = $(el).find('td');
      if (cells.length < 2) return;
      const name = $(cells[0]).text().trim();
      const link = $(cells[0]).find('a').attr('href') || $(cells[1]).find('a').attr('href');
      if (!name || !link || name.length < 3) return;

      const fullUrl = link.startsWith('http') || link.startsWith('ftp')
        ? link : 'https://www.searchftps.net' + link;

      results.push({
        title: name,
        url: fullUrl,
        downloadUrl: fullUrl,
        source: 'Napalm FTP',
        type: detectType(name)
      });
    });

    return results.slice(0, 50);
  } catch (e) {
    console.error('[Napalm]', e.message);
    return [];
  }
}

/* =========================================================
   MOTEUR 9 : Jamendo
   ========================================================= */
async function searchJamendo(query) {
  try {
    const url = 'https://api.jamendo.com/v3.0/tracks/?client_id=56d30c95&format=json&limit=30&search=' +
      encodeURIComponent(query) + '&audioformat=mp32';
    const res = await axios.get(url, { timeout: 12000 });
    const tracks = safeArray(res.data?.results);

    return tracks.map(t => ({
      title: t.name + (t.artist_name ? ' — ' + t.artist_name : ''),
      url: t.shareurl || ('https://www.jamendo.com/track/' + t.id),
      downloadUrl: t.audiodownload || t.audio,
      source: 'Jamendo',
      type: 'audio',
      extra: [t.album_name, t.releasedate].filter(Boolean).join(' · ')
    }));
  } catch (e) {
    console.error('[Jamendo]', e.message);
    return [];
  }
}

/* =========================================================
   REGISTRE DES MOTEURS
   ========================================================= */
const ENGINES = {
  archive:     { name: 'Internet Archive',   fn: searchArchive },
  commons:     { name: 'Wikimedia Commons',  fn: searchCommons },
  openlib:     { name: 'Open Library',       fn: searchOpenLib },
  gutenberg:   { name: 'Project Gutenberg',  fn: searchGutenberg },
  arxiv:       { name: 'arXiv',              fn: searchArxiv },
  filepursuit: { name: 'FilePursuit',        fn: searchFilePursuit },
  mamont:      { name: 'Mamont FTP',         fn: searchMamont },
  napalm:      { name: 'Napalm FTP',         fn: searchNapalm },
  jamendo:     { name: 'Jamendo',            fn: searchJamendo }
};

/* =========================================================
   ROUTES
   ========================================================= */
app.get('/api/engines', (req, res) => {
  res.json({
    engines: Object.entries(ENGINES).map(([id, e]) => ({ id, name: e.name }))
  });
});

app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.status(400).json({ error: 'Paramètre q requis' });

  const requested = (req.query.sources || Object.keys(ENGINES).join(','))
    .split(',').map(s => s.trim()).filter(Boolean);

  const active = requested.filter(id => ENGINES[id]);
  if (active.length === 0) return res.status(400).json({ error: 'Aucune source valide' });

  console.log(`[SEARCH] "${query}" — ${active.join(', ')}`);

  const settled = await Promise.allSettled(
    active.map(id => ENGINES[id].fn(query))
  );

  const all = [];
  const stats = {};

  settled.forEach((r, i) => {
    const id = active[i];
    if (r.status === 'fulfilled') {
      stats[id] = r.value.length;
      all.push(...r.value);
    } else {
      stats[id] = 0;
      console.error(`[${id}]`, r.reason?.message);
    }
  });

  const seen = new Set();
  const deduped = all.filter(item => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  res.json({
    query,
    total: deduped.length,
    stats,
    results: deduped
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

/* =========================================================
   SPA FALLBACK — sert index.html depuis docs/, public/ ou racine
   ========================================================= */
app.get('*', (req, res) => {
  const candidates = [
    path.join(__dirname, 'docs', 'index.html'),
    path.join(__dirname, 'public', 'index.html'),
    path.join(__dirname, 'index.html')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  res.status(404).send('index.html introuvable');
});

/* =========================================================
   LANCEMENT
   ========================================================= */
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  🛰  FTP METASEARCH — Serveur démarré');
  console.log('═══════════════════════════════════════════');
  console.log(`  → http://localhost:${PORT}`);
  console.log('');
  console.log('  Moteurs disponibles :');
  Object.entries(ENGINES).forEach(([id, e]) => {
    console.log(`    • ${e.name.padEnd(22)} (${id})`);
  });
  console.log('═══════════════════════════════════════════');
  console.log('');
});
