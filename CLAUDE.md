# wp-ai-admin — Project Instructions

> Tipo: App local Node.js
> Layers: fluent-boards
> Ultima actualizacion: 2026-03-24

## Que es este proyecto

App web local para gestionar sitios WordPress via Claude AI + WP-CLI.
Interfaz de chat donde el usuario habla en lenguaje natural y Claude ejecuta comandos WP-CLI sobre el sitio seleccionado.

## Stack

- **Runtime**: Node.js 20+
- **Backend**: Express.js
- **Frontend**: HTML + Tailwind v4 (CDN) + Vanilla JS
- **AI**: Claude API (@anthropic-ai/sdk) con tool use
- **WP-CLI**: Ejecucion local (--path=) y remota (SSH)
- **Storage**: JSON files (sites.json, history.json)

## Estructura

```
wp-ai-admin/
├── server.js              # Express + rutas API
├── lib/
│   ├── claude.js           # Cliente Claude API con tools
│   ├── wp-cli.js           # Executor WP-CLI (local + SSH)
│   └── tools.js            # Definicion de tools para Claude
├── public/
│   ├── index.html          # UI principal (chat + sidebar)
│   └── app.js              # Frontend logic
├── config/
│   └── sites.json          # Credenciales sitios WP
├── .env                    # ANTHROPIC_API_KEY
└── package.json
```

## Testing

```bash
npm run dev    # Servidor con --watch en http://localhost:3848
npm start      # Produccion
```

## Git Workflow

Ramas: main (proyecto simple, deadline jueves 27)
