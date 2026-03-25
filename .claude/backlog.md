# Backlog — wp-ai-admin

> Plan: `.claude/plans/2026-03-24-wp-ai-admin.md` (en claude-workflow)
> Board: 48 (Desarrollo Interno), Label: wp-aiadm (600)

## Issues Activos

### F0 — MVP Chat + WP-CLI

| ID | Estado | Titulo | Complejidad |
|---|---|---|---|
| WPAI-001 | ✅ done | Scaffolding proyecto (Express + estructura + package.json) | D1 |
| WPAI-002 | ✅ done | Backend: endpoint POST /api/chat con Claude API (tool use) | D3 |
| WPAI-003 | ✅ done | Definir 8 tools WP-CLI (plugin/post/user/option/theme/health) | D2 |
| WPAI-004 | ✅ done | Executor WP-CLI: child_process + parsing output | D2 |
| WPAI-005 | ✅ done | Frontend: chat UI con paleta amber Flowtitude | D2 |
| WPAI-006 | ✅ done | Frontend: mostrar tool calls ejecutadas (comando + resultado) | D2 |

### F1 — Gestion de Sitios + Settings

| ID | Estado | Titulo | Complejidad |
|---|---|---|---|
| WPAI-007 | ✅ done | Backend: CRUD /api/sites (sites.json) | D2 |
| WPAI-008 | ✅ done | Frontend: panel Settings add/edit/delete sitios | D2 |
| WPAI-009 | ✅ done | Frontend: selector de sitio activo en sidebar | D1 |
| WPAI-010 | ✅ done | Backend: test de conexion por sitio (wp core version) | D1 |
| WPAI-011 | ✅ done | Frontend: indicador conexion por sitio (online/offline) | D1 |
| WPAI-012 | ✅ done | Settings: campo API key Claude (.env) | D1 |

### F2 — Polish + Demo Ready

| ID | Estado | Titulo | Complejidad |
|---|---|---|---|
| WPAI-013 | 🔵 open | Historial de comandos funcional | D1 |
| WPAI-014 | 🔵 open | Quick actions sidebar (health, plugins, posts) | D1 |
| WPAI-015 | 🔵 open | Confirmacion antes de acciones destructivas en UI | D1 |
| WPAI-016 | 🔵 open | Tool wp_post_create (crear posts/pages via chat) | D2 |
| WPAI-017 | 🔵 open | Tool wp_db_export (backup base de datos) | D1 |

## Session Log

### Plan Miércoles 25

- [ ] Post LinkedIn: WordPress 7 + sorpresa WP AI Admin (usar plantilla WP7, cambiar texto)
- [ ] Post X: versión corta del mismo
- [ ] Recordatorio grupo meetup para el jueves
