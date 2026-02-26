## Instagram Thumbnail API (Meta oEmbed)

Executa um endpoint local para retornar thumbnail estável de links do Instagram:

- Endpoint: `GET /api/instagram-thumb?url=<instagram-post-or-reel-url>`
- Health: `GET /health`
- Porta padrão: `8787`

### 1) Defina o token da Meta

```bash
export INSTAGRAM_ACCESS_TOKEN="SEU_TOKEN_META_AQUI"
```

### 2) Rode o servidor

```bash
node scripts/instagram-thumb-api.mjs
```

### 3) Teste rápido

```bash
curl "http://localhost:8787/api/instagram-thumb?url=https://www.instagram.com/reel/DSH4ZQykTUN/"
```

### Cache

- TTL padrão: `86400` segundos (24h)
- Arquivo padrão: `.cache/instagram-oembed-cache.json`

Variáveis opcionais:

- `PORT`
- `INSTAGRAM_CACHE_TTL_SEC`
- `INSTAGRAM_CACHE_FILE`

### Observação

Sem `INSTAGRAM_ACCESS_TOKEN`, o endpoint responde `503`.
