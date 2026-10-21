#!/bin/bash
echo "Démarrage de MyAPI en mode DÉVELOPPEMENT..."
sudo docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
echo "L'application est disponible (par défaut) sur http://localhost:8081"
