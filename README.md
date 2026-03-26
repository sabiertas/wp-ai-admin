# WP AI Admin

🇬🇧 [Read in English](README.en.md)

> Gestiona tus sitios WordPress con lenguaje natural — con Claude AI + WP-CLI.

![WP AI Admin](https://img.shields.io/badge/WordPress-AI%20Admin-ff9d36?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square) ![Node](https://img.shields.io/badge/node-18%2B-green?style=flat-square)

WP AI Admin es una aplicacion web local que te permite gestionar cualquier sitio WordPress a traves de un chat. Escribe lo que necesitas en lenguaje natural y Claude AI lo traduce en comandos WP-CLI que se ejecutan en tiempo real.

## Inicio rapido

```bash
git clone https://github.com/sabiertas/wp-ai-admin.git
cd wp-ai-admin
bash setup.sh
npm start
```

Abre **http://localhost:3848** en tu navegador.

> El directorio `wp-ai-admin/` se crea donde ejecutes el `git clone`. Para volver a arrancarlo otro dia, entra en ese directorio y ejecuta `npm start`.

### Actualizar

```bash
cd wp-ai-admin
git pull
npm start
```

Tu configuracion (API key y sitios) se conserva al actualizar.

### Que hace `setup.sh`

1. Comprueba Node.js >= 18
2. **Detecta tu entorno** (MAMP, Local WP o servidor remoto SSH) y te guia para instalar WP-CLI
3. Instala dependencias (`npm install`)
4. Descarga los [WordPress Agent Skills](https://github.com/WordPress/agent-skills) oficiales
5. Crea la carpeta de configuracion
6. Opcionalmente configura tu API key de Anthropic

> Si WP-CLI no esta instalado, el instalador te guia paso a paso segun tu entorno.

### Primer uso

1. **Settings** → pega tu API key de Anthropic
2. **Add Site** → selecciona la ruta de tu instalacion WordPress (la carpeta que contiene `wp-config.php`)
3. **Chat** → escribe lo que necesitas

## Requisitos

- **Node.js 18+** ([descargar](https://nodejs.org))
- **API key de Anthropic** ([obtener aqui](https://console.anthropic.com/)) — hay plan gratuito para empezar
- Un sitio WordPress (local o remoto via SSH)
- **WP-CLI** — `setup.sh` lo detecta y te ayuda a instalarlo si falta

## Funcionalidades

- **Gestion WordPress en lenguaje natural** — "lista los plugins activos", "crea un borrador sobre SEO", "haz un audit de seguridad"
- **29 herramientas WP-CLI** + `wp_cli_run` generico que ejecuta CUALQUIER comando WP-CLI
- **14 WordPress Agent Skills** del [repositorio oficial de WordPress](https://github.com/WordPress/agent-skills) — se cargan automaticamente segun contexto
- **21 Workflows listos para usar** — recetas multi-paso: audit de seguridad, revision de rendimiento, limpieza de BD, migracion de dominio, debug WindPress/Tailwind, y mas
- **Multi-sitio** — añade sitios locales (MAMP) o remotos (SSH)
- **Historial de comandos** — log completo de cada comando WP-CLI ejecutado
- **Instalable como PWA** — usalo como app de escritorio
- **Workflows personalizados** — crea, edita y comparte tus propias recetas

## Añadir un sitio WordPress

### Local (MAMP / Local WP)

1. Ve a **Settings** → **+ Add site**
2. Nombre: `Mi sitio local`
3. Tipo: `Local`
4. Ruta: `/ruta/a/tu/wordpress/` (el directorio con `wp-config.php`)

### Remoto (SSH)

1. Tipo: `Remote`
2. SSH Host: `tu-servidor.com`
3. SSH User: `root` (o tu usuario SSH)
4. Ruta: `/var/www/html/` (ruta del WordPress en el servidor)

> Asegurate de tener autenticacion por clave SSH configurada para sitios remotos.

## Arquitectura

```
wp-ai-admin/
├── server.js              # Servidor Express + rutas API
├── lib/
│   ├── claude.js          # Cliente Claude API con tool_use
│   ├── tools.js           # 29 definiciones de herramientas WP-CLI
│   ├── wp-cli.js          # Ejecutor de comandos (local + SSH)
│   └── wp-skills.js       # Cargador dinamico de WordPress/agent-skills
├── public/
│   ├── index.html         # UI (Tailwind v4 + paleta amber)
│   ├── app.js             # Logica frontend
│   └── manifest.json      # Manifiesto PWA
├── config/
│   ├── skills.json        # Recetas de workflows (editables desde la UI)
│   └── sites.json         # Credenciales de sitios (en .gitignore)
├── vendor/
│   └── agent-skills/      # Skills oficiales de WordPress (auto-clonados)
└── setup.sh               # Instalador en un comando
```

### Como funciona

1. Escribes un mensaje en el chat
2. El sistema identifica los WordPress Agent Skills relevantes analizando tu mensaje
3. Los skills se inyectan en el prompt de Claude como contexto experto
4. Claude decide que herramientas WP-CLI ejecutar
5. Los comandos se ejecutan en el sitio WordPress activo
6. Los resultados se muestran en el chat junto con los comandos ejecutados

## Stack tecnico

- **Backend**: Node.js + Express
- **IA**: Claude API (claude-sonnet-4-20250514) con tool_use
- **Frontend**: Vanilla JS + Tailwind CSS v4 (CDN)
- **Diseno**: Flowtitude Design System, paleta amber
- **WordPress**: WP-CLI (cualquier comando)

## Licencia

MIT

## Creditos

- [Anthropic Claude API](https://docs.anthropic.com/) — motor de IA
- [WordPress/agent-skills](https://github.com/WordPress/agent-skills) — conocimiento experto en WordPress
- [Flowtitude Design System](https://flowtitude.com) — identidad visual
- [WP-CLI](https://wp-cli.org/) — linea de comandos WordPress
