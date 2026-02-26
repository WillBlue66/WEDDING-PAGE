#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const CACHE_TTL_SEC = Number.parseInt(process.env.INSTAGRAM_CACHE_TTL_SEC || '86400', 10);
const CACHE_FILE = process.env.INSTAGRAM_CACHE_FILE
  || path.resolve(process.cwd(), '.cache/instagram-oembed-cache.json');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeInstagramUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (!hostname.endsWith('instagram.com')) return null;

    const match = parsed.pathname.match(/^\/(reel|p|tv)\/([^/?#]+)/i);
    if (!match) return null;

    const type = match[1].toLowerCase();
    const code = match[2];
    return `https://www.instagram.com/${type}/${code}/`;
  } catch {
    return null;
  }
}

function ensureCacheFile() {
  const dir = path.dirname(CACHE_FILE);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CACHE_FILE)) {
    fs.writeFileSync(CACHE_FILE, '{}');
  }
}

function readCache() {
  ensureCacheFile();
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  ensureCacheFile();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function getFreshCacheEntry(cache, key) {
  const entry = cache[key];
  if (!entry || typeof entry !== 'object') return null;

  const fetchedAt = Number.parseInt(entry.fetchedAt || '0', 10);
  const ageSec = Math.floor(Date.now() / 1000) - fetchedAt;
  if (ageSec > CACHE_TTL_SEC) return null;

  if (!entry.thumbnailUrl || typeof entry.thumbnailUrl !== 'string') return null;
  return entry;
}

async function fetchInstagramOembed(instagramUrl) {
  const apiUrl = `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(instagramUrl)}&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  const res = await fetch(apiUrl);
  const text = await res.text();

  if (!res.ok) {
    let errorMessage = text;
    try {
      const parsed = JSON.parse(text);
      errorMessage = parsed?.error?.message || text;
    } catch {
      // keep raw text
    }
    throw new Error(errorMessage || 'Falha ao consultar instagram_oembed');
  }

  const data = JSON.parse(text);
  if (!data || typeof data.thumbnail_url !== 'string' || !data.thumbnail_url.trim()) {
    throw new Error('A resposta da Meta API não trouxe thumbnail_url');
  }

  return {
    thumbnailUrl: data.thumbnail_url.trim(),
    authorName: typeof data.author_name === 'string' ? data.author_name : null,
    title: typeof data.title === 'string' ? data.title : null,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/health') {
    sendJson(res, 200, { ok: true, hasToken: Boolean(ACCESS_TOKEN) });
    return;
  }

  if (requestUrl.pathname !== '/api/instagram-thumb') {
    sendJson(res, 404, { error: 'Not Found' });
    return;
  }

  const rawUrl = requestUrl.searchParams.get('url') || '';
  const instagramUrl = normalizeInstagramUrl(rawUrl);
  if (!instagramUrl) {
    sendJson(res, 400, { error: 'Informe uma URL válida de post/reel do Instagram em ?url=' });
    return;
  }

  if (!ACCESS_TOKEN) {
    sendJson(res, 503, {
      error: 'INSTAGRAM_ACCESS_TOKEN não configurado no servidor.',
    });
    return;
  }

  const cache = readCache();
  const cacheKey = instagramUrl;
  const cached = getFreshCacheEntry(cache, cacheKey);
  if (cached) {
    sendJson(res, 200, {
      thumbnailUrl: cached.thumbnailUrl,
      authorName: cached.authorName || null,
      title: cached.title || null,
      cached: true,
    });
    return;
  }

  try {
    const data = await fetchInstagramOembed(instagramUrl);
    cache[cacheKey] = {
      ...data,
      fetchedAt: Math.floor(Date.now() / 1000),
    };
    writeCache(cache);

    sendJson(res, 200, {
      ...data,
      cached: false,
    });
  } catch (error) {
    sendJson(res, 502, {
      error: 'Falha ao obter thumbnail via Meta API.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

server.listen(PORT, () => {
  console.log(`Instagram thumb API online em http://localhost:${PORT}`);
  if (!ACCESS_TOKEN) {
    console.log('Aviso: defina INSTAGRAM_ACCESS_TOKEN para responder thumbnails.');
  }
});
