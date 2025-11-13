#!/bin/bash
# Quick deployment script - pulls changes and restarts services
# Usage: ./quick-deploy.sh

set -e

DROPLET_IP=$(terraform output -raw droplet_ip 2>/dev/null)
DOMAIN="aquilus.app"

echo "🚀 Quick Deploy to $DOMAIN ($DROPLET_IP)"
echo "================================================"

# SSH into the droplet and execute deployment commands
ssh -T root@$DROPLET_IP << 'ENDSSH'
set -e

echo "📦 Navigating to app directory..."
cd /root/aquilus-webapp

echo "🔄 Pulling latest changes from git..."
git pull origin feature/deploying-to-digital-ocean

echo "🛑 Stopping containers..."
docker-compose down

echo "🔨 Building new images..."
docker-compose build --no-cache

echo "🚀 Starting containers..."
docker-compose up -d

echo "⏳ Waiting for containers to be ready..."
sleep 5

echo "🔍 Checking for SSL certificates..."
if [ -f /etc/letsencrypt/live/aquilus.app/fullchain.pem ]; then
    echo "✅ SSL certificates found - switching to HTTPS configuration"

    docker cp /tmp/nginx-https.conf aquilus-frontend:/etc/nginx/nginx.conf
    docker exec aquilus-frontend nginx -s reload
    echo "✅ Nginx reloaded with HTTPS config"
else
    echo "⚠️  No SSL certificates found - keeping HTTP configuration"
fi

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "🧹 Cleaning up old Docker resources..."
docker system prune -f

echo "✅ Deployment complete!"
echo ""
echo "📊 Container status:"
docker-compose ps

echo ""
echo "📝 Recent backend logs:"
docker-compose logs --tail=20 backend

echo ""
echo "📝 Recent frontend logs:"
docker-compose logs --tail=20 frontend

ENDSSH

echo ""
echo "================================================"
echo "✅ Quick deploy complete!"
echo "🌐 App should be live at: https://$DOMAIN"
echo ""
echo "📋 To view live logs:"
echo "   ssh root@$DROPLET_IP 'cd /root/aquilus-webapp && docker compose logs -f'"
echo ""
echo "🔍 To check status:"
echo "   ssh root@$DROPLET_IP 'cd /root/aquilus-webapp && docker compose ps'"
