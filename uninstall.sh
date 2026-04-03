#!/bin/bash

# Dokploy Extended - Uninstall Script
# Usage: curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/uninstall.sh | sh -s -- --purge
# Usage: curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/uninstall.sh | sh -s -- --yes
# Usage: curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/uninstall.sh | sh -s -- --purge --yes

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m"

# Parse arguments — works with pipe
FORCE_YES=0
DO_PURGE=0
for arg in "$@"; do
    [ "$arg" = "--yes" ] || [ "$arg" = "-y" ] && FORCE_YES=1
    [ "$arg" = "--purge" ] && DO_PURGE=1
done

echo ""
printf "${RED}=================================================${NC}\n"
printf "${RED}  Dokploy Extended Uninstaller${NC}\n"
printf "${RED}=================================================${NC}\n"
echo ""

if [ "$(id -u)" != "0" ]; then
    echo "This script must be run as root" >&2
    exit 1
fi

if [ "$FORCE_YES" = "0" ]; then
    printf "${YELLOW}WARNING: This will remove Dokploy and all its services.${NC}\n"
    if [ "$DO_PURGE" = "1" ]; then
        printf "${RED}--purge flag detected: volumes and config will also be deleted!${NC}\n"
    else
        printf "${YELLOW}Your app data (volumes) will NOT be deleted unless you use --purge.${NC}\n"
    fi
    echo ""
    printf "Are you sure? Type 'yes' to continue: "
    read confirm </dev/tty
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""
printf "${BLUE}Stopping and removing Dokploy services...${NC}\n"

docker service rm dokploy 2>/dev/null && echo "  v dokploy removed" || echo "  - dokploy not found"
docker service rm dokploy-postgres 2>/dev/null && echo "  v dokploy-postgres removed" || echo "  - dokploy-postgres not found"
docker service rm dokploy-redis 2>/dev/null && echo "  v dokploy-redis removed" || echo "  - dokploy-redis not found"

docker stop dokploy-traefik 2>/dev/null && echo "  v dokploy-traefik stopped" || echo "  - dokploy-traefik not found"
docker rm dokploy-traefik 2>/dev/null && echo "  v dokploy-traefik removed" || true

echo ""
printf "${BLUE}Removing Docker secrets...${NC}\n"
docker secret rm dokploy_postgres_password 2>/dev/null && echo "  v postgres secret removed" || echo "  - secret not found"

echo ""
printf "${BLUE}Removing Docker network...${NC}\n"
docker network rm dokploy-network 2>/dev/null && echo "  v dokploy-network removed" || echo "  - network not found"

echo ""
printf "${BLUE}Leaving Docker Swarm...${NC}\n"
docker swarm leave --force 2>/dev/null && echo "  v Swarm left" || echo "  - Not in swarm"

if [ "$DO_PURGE" = "1" ]; then
    echo ""
    printf "${RED}Removing all data volumes...${NC}\n"
    docker volume rm dokploy 2>/dev/null && echo "  v dokploy volume removed" || echo "  - not found"
    docker volume rm dokploy-postgres 2>/dev/null && echo "  v dokploy-postgres volume removed" || echo "  - not found"
    docker volume rm dokploy-redis 2>/dev/null && echo "  v dokploy-redis volume removed" || echo "  - not found"
    echo ""
    printf "${RED}Removing /etc/dokploy config directory...${NC}\n"
    rm -rf /etc/dokploy && echo "  v /etc/dokploy removed" || true
fi

echo ""
printf "${GREEN}=================================================${NC}\n"
printf "${GREEN}  Dokploy Extended uninstalled successfully!${NC}\n"
if [ "$DO_PURGE" = "0" ]; then
    printf "${YELLOW}  Note: Data volumes were kept. Use --purge to delete them.${NC}\n"
fi
printf "${GREEN}=================================================${NC}\n"
echo ""
