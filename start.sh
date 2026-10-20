#!/bin/bash
echo "Démarrage de MyAPI en mode PRODUCTION..."
sudo docker compose up -d --build
echo "L'application est disponible (par défaut) sur http://localhost:8081"
