#!/bin/bash
echo "Démarrage de MyAPI en mode DÉVELOPPEMENT (Vite, Live Reload)..."
sudo docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
