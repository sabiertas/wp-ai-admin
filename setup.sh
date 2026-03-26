#!/bin/bash
# WP AI Admin — One-command setup
# Usage: curl -fsSL https://raw.githubusercontent.com/yourusername/wp-ai-admin/main/setup.sh | bash
# Or:    git clone ... && cd wp-ai-admin && bash setup.sh

set -e

# Colors
AMBER='\033[0;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${AMBER}${BOLD}  ╔═══════════════════════════════╗${NC}"
echo -e "${AMBER}${BOLD}  ║       WP AI Admin Setup       ║${NC}"
echo -e "${AMBER}${BOLD}  ║   Claude + WP-CLI + WordPress ║${NC}"
echo -e "${AMBER}${BOLD}  ╚═══════════════════════════════╝${NC}"
echo ""

# 1. Check Node.js
echo -e "${DIM}[1/5]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Install it: https://nodejs.org (v18+)${NC}"
    exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js v18+ required (found v$(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# 2. Check WP-CLI
echo -e "${DIM}[2/5]${NC} Checking WP-CLI..."
if command -v wp &> /dev/null; then
    WP_VERSION=$(wp --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓${NC} WP-CLI $WP_VERSION"
else
    echo -e "${AMBER}⚠ WP-CLI not found locally.${NC}"
    echo ""
    if [ -t 0 ]; then
        echo -e "  ${BOLD}Where is your WordPress?${NC}"
        echo -e "  ${DIM}1)${NC} Local — MAMP / MAMP Pro"
        echo -e "  ${DIM}2)${NC} Local — Local WP (Flywheel)"
        echo -e "  ${DIM}3)${NC} Remote server (SSH access)"
        echo -e "  ${DIM}4)${NC} Skip — I'll set it up later"
        echo ""
        read -p "  Choose [1-4]: " WP_ENV

        case $WP_ENV in
            1)
                echo ""
                echo -e "  ${BOLD}Installing WP-CLI...${NC}"
                curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
                chmod +x wp-cli.phar
                sudo mv wp-cli.phar /usr/local/bin/wp 2>/dev/null || {
                    mkdir -p "$HOME/.local/bin"
                    mv wp-cli.phar "$HOME/.local/bin/wp"
                    echo -e "  ${DIM}Installed to ~/.local/bin/wp (add to PATH if needed)${NC}"
                }
                if command -v wp &> /dev/null; then
                    echo -e "  ${GREEN}✓${NC} WP-CLI installed: $(wp --version 2>/dev/null)"
                else
                    echo -e "  ${GREEN}✓${NC} WP-CLI downloaded. Run: export PATH=\"\$HOME/.local/bin:\$PATH\""
                fi
                echo ""
                echo -e "  ${AMBER}Tip MAMP:${NC} si wp da error de DB, añade en wp-config.php:"
                echo -e "  ${DIM}define('DB_HOST', 'localhost:/Applications/MAMP/tmp/mysql/mysql.sock');${NC}"
                ;;
            2)
                echo ""
                echo -e "  ${GREEN}✓${NC} Local WP ya incluye WP-CLI."
                echo -e "  ${DIM}Abre tu sitio en Local → 'Open Site Shell' → wp ya funciona.${NC}"
                echo -e "  ${DIM}En WP AI Admin, añade el sitio con la ruta que Local te muestra.${NC}"
                ;;
            3)
                echo ""
                echo -e "  ${GREEN}✓${NC} WP-CLI no es necesario en local para servidores remotos."
                echo -e "  ${DIM}La app se conectara via SSH y usara el WP-CLI del servidor.${NC}"
                echo -e "  ${DIM}En Settings, añade tu sitio con: host, usuario SSH y ruta al WordPress.${NC}"
                ;;
            *)
                echo -e "  ${DIM}OK — puedes configurar WP-CLI mas tarde.${NC}"
                ;;
        esac
    else
        echo -e "  ${DIM}Install WP-CLI: https://wp-cli.org/#installing${NC}"
    fi
fi

# 3. Install dependencies
echo -e "${DIM}[3/5]${NC} Installing dependencies..."
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✓${NC} Dependencies installed"

# 4. Clone WordPress Agent Skills
echo -e "${DIM}[4/5]${NC} Downloading WordPress Agent Skills..."
if [ -d "vendor/agent-skills" ]; then
    echo -e "${GREEN}✓${NC} Agent Skills already present ($(ls vendor/agent-skills/skills/ | wc -l | tr -d ' ') skills)"
else
    git clone --depth 1 --quiet https://github.com/WordPress/agent-skills.git vendor/agent-skills 2>/dev/null
    echo -e "${GREEN}✓${NC} Agent Skills downloaded ($(ls vendor/agent-skills/skills/ | wc -l | tr -d ' ') skills)"
fi

# 5. Create config directory
echo -e "${DIM}[5/5]${NC} Setting up config..."
mkdir -p config
if [ ! -f "config/sites.json" ]; then
    echo '{"sites":[]}' > config/sites.json
fi
if [ ! -f ".env" ]; then
    echo -e "${AMBER}⚠ No .env file found.${NC}"
    echo ""
    if [ -t 0 ]; then
        read -p "  Enter your Anthropic API key (or press Enter to skip): " API_KEY
    fi
    if [ -n "$API_KEY" ]; then
        echo "ANTHROPIC_API_KEY=$API_KEY" > .env
        echo -e "${GREEN}✓${NC} API key saved to .env"
    else
        echo -e "${DIM}  You can add it later in Settings or create .env manually.${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} .env exists"
fi

# Done
echo ""
echo -e "${GREEN}${BOLD}  ✓ Setup complete!${NC}"
echo ""
echo -e "  Start the app:"
echo -e "    ${BOLD}npm start${NC}          ${DIM}# production${NC}"
echo -e "    ${BOLD}npm run dev${NC}        ${DIM}# with auto-reload${NC}"
echo ""
echo -e "  Then open: ${AMBER}${BOLD}http://localhost:3848${NC}"
echo ""
echo -e "${DIM}  Next steps:${NC}"
echo -e "${DIM}  1. Add your API key in Settings (if not done above)${NC}"
echo -e "${DIM}  2. Add a WordPress site (local MAMP path or SSH remote)${NC}"
echo -e "${DIM}  3. Start chatting — ask anything about your WordPress site${NC}"
echo ""
