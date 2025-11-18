#!/bin/bash
set -e

# Update system
apt-get update
apt-get install -y docker.io docker-compose git curl certbot s3cmd

# Configure s3cmd for DigitalOcean Spaces
cat > /root/.s3cfg << 'S3CFG'
[default]
access_key = ${spaces_access_key}
secret_key = ${spaces_secret_key}
host_base = ${spaces_region}.digitaloceanspaces.com
host_bucket = %(bucket)s.${spaces_region}.digitaloceanspaces.com
use_https = True
S3CFG

# Start Docker
systemctl enable docker
systemctl start docker

# Set up SSH for GitHub
mkdir -p /root/.ssh
chmod 700 /root/.ssh

# Create webroot directory for Certbot
mkdir -p /var/www/certbot
mkdir -p /etc/letsencrypt

# Try to download existing SSL certificates from Spaces
echo "Checking for existing SSL certificates in Spaces..."
if s3cmd ls s3://${spaces_bucket}/letsencrypt/ > /dev/null 2>&1; then
  echo "✓ Found existing certificates, downloading..."
  s3cmd sync s3://${spaces_bucket}/letsencrypt/ /etc/letsencrypt/ --follow-symlinks
  echo "✓ Certificates downloaded successfully"
  
  # Recreate symlinks if live folder doesn't have the .pem files but archive does
  if [ -d "/etc/letsencrypt/archive/${domain_name}" ] && [ ! -L "/etc/letsencrypt/live/${domain_name}/fullchain.pem" ]; then
    echo "Recreating certificate symlinks..."
    mkdir -p /etc/letsencrypt/live/${domain_name}
    
    ln -sf ../../archive/${domain_name}/cert1.pem /etc/letsencrypt/live/${domain_name}/cert.pem
    ln -sf ../../archive/${domain_name}/chain1.pem /etc/letsencrypt/live/${domain_name}/chain.pem
    ln -sf ../../archive/${domain_name}/fullchain1.pem /etc/letsencrypt/live/${domain_name}/fullchain.pem
    ln -sf ../../archive/${domain_name}/privkey1.pem /etc/letsencrypt/live/${domain_name}/privkey.pem
    
    echo "✓ Certificate symlinks recreated"
  fi
else
  echo "No existing certificates found in Spaces"
fi

# Write deploy key
cat > /root/.ssh/deploy_key << 'DEPLOYKEY'
${deploy_key}
DEPLOYKEY
chmod 600 /root/.ssh/deploy_key

# Configure SSH
cat > /root/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/deploy_key
  StrictHostKeyChecking no
EOF
chmod 600 /root/.ssh/config

# Clone repository
cd /root
git clone git@github.com:lablytics/aquilus-webapp.git

cd aquilus-webapp
git checkout feature/improving-layout

# Create .env file with secrets from Terraform
cat > /root/aquilus-webapp/.env << 'ENVFILE'
# Supabase
SUPABASE_URL=${supabase_url}
SUPABASE_ANON_KEY=${supabase_anon_key}
SUPABASE_SERVICE_ROLE_KEY=${supabase_service_role_key}
SUPABASE_JWT_SECRET=${supabase_jwt_secret}


# Frontend environment variables
VITE_SUPABASE_URL=${vite_supabase_url}
VITE_SUPABASE_ANON_KEY=${vite_supabase_anon_key}
VITE_API_URL=${vite_api_url}
VITE_MIXPANEL_TOKEN=${mixpanel_token}

# Backend environment variables
ANTHROPIC_API_KEY=${anthropic_api_key}
CHROMA_DB_PATH=/app/chroma_db
ALLOWED_ORIGINS=${allowed_origins}
USE_OXYLABS_PROXY=${use_oxylabs_proxy}
OXYLABS_USERNAME=${oxylabs_username}
OXYLABS_PASSWORD=${oxylabs_password}
OXYLABS_COUNTRY=US
ENVFILE

# Install Docker Compose v2
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create deploy script in the aquilus-webapp folder
cat > /root/aquilus-webapp/deploy.sh << 'DEPLOYSCRIPT'
#!/bin/bash
cd /root/aquilus-webapp
git pull
docker-compose down
docker-compose build
docker-compose up -d
DEPLOYSCRIPT
chmod +x /root/aquilus-webapp/deploy.sh

# Set up log rotation
cat > /etc/logrotate.d/aquilus << 'LOGROTATE'
/root/aquilus-webapp/jobs/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
LOGROTATE

# Create a marker file to indicate repository is ready for chroma_db transfer
touch /root/aquilus-webapp/READY_FOR_CHROMADB

echo "=========================================="
echo "Repository cloned and ready"
echo "Waiting for chroma_db to be transferred..."
echo "=========================================="

# Wait for chroma_db to be transferred (marker file will be created by deploy.sh via SSH)
timeout=600  # 10 minutes max
elapsed=0
while [ ! -f /root/aquilus-webapp/CHROMADB_TRANSFERRED ] && [ $elapsed -lt $timeout ]; do
  sleep 5
  elapsed=$((elapsed + 5))
  if [ $((elapsed % 30)) -eq 0 ]; then
    echo "Still waiting for chroma_db... ($${elapsed}s elapsed)"
  fi
done

if [ -f /root/aquilus-webapp/CHROMADB_TRANSFERRED ]; then
  echo "✓ chroma_db transfer confirmed"
  rm /root/aquilus-webapp/CHROMADB_TRANSFERRED
else
  echo "⚠ Timeout waiting for chroma_db, proceeding anyway..."
fi

# Run the deployment script to start the application
/root/aquilus-webapp/deploy.sh

# SSL Certificate Setup (only if domain is provided)
if [ -n "${domain_name}" ]; then
  echo "=========================================="
  echo "Setting up SSL certificate for ${domain_name}..."
  echo "=========================================="
  
  # Get current droplet IP from metadata service
  DROPLET_IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address)
  echo "✓ Current droplet IP: $DROPLET_IP"
  
  # Check if we already have valid certificates
  # Use -e to check if symlink target exists, not just the symlink itself
  has_valid_cert=false
  if [ -e "/etc/letsencrypt/live/${domain_name}/fullchain.pem" ] && [ -e "/etc/letsencrypt/live/${domain_name}/privkey.pem" ]; then
    echo "✓ Valid SSL certificate files found"
    
    # Verify certificate is not expired and is readable
    if openssl x509 -checkend 604800 -noout -in /etc/letsencrypt/live/${domain_name}/fullchain.pem 2>/dev/null; then
      echo "✓ Certificate is valid for at least 7 more days"
      has_valid_cert=true
    else
      echo "⚠ Certificate expires soon, will renew"
    fi
  fi
  
  # Wait for DNS propagation (20 minutes max)
  echo ""
  echo "Checking DNS propagation..."
  max_attempts=120  # 20 minutes (120 * 10 seconds)
  attempt=0
  dns_ready=false
  
  while [ $attempt -lt $max_attempts ]; do
    resolved_ip=$(dig +short ${domain_name} @8.8.8.8 | tail -n1)
    
    if [ "$resolved_ip" = "$DROPLET_IP" ]; then
      echo "✓ DNS propagated successfully! ${domain_name} -> $DROPLET_IP"
      dns_ready=true
      break
    fi
    
    # Show progress every 30 seconds
    if [ $((attempt % 3)) -eq 0 ]; then
      minutes=$((attempt / 6))
      echo "  Waiting for DNS... ${domain_name} -> $resolved_ip (expected: $DROPLET_IP) [$minutes min]"
    fi
    
    sleep 10
    attempt=$((attempt + 1))
  done
  
  if [ "$dns_ready" = false ]; then
    echo ""
    echo "✗ ERROR: DNS did not propagate within 20 minutes."
    echo "  Current DNS: ${domain_name} -> $resolved_ip"
    echo "  Expected:    ${domain_name} -> $DROPLET_IP"
    echo ""
    
    # If we have a valid cert, enable HTTPS anyway
    if [ "$has_valid_cert" = true ]; then
      echo "✓ Valid certificate exists, enabling HTTPS..."
      export DOMAIN="${domain_name}"
      envsubst '$${DOMAIN}' < /root/aquilus-webapp/frontend/nginx-https.conf > /tmp/nginx-https.conf
      docker cp /tmp/nginx-https.conf aquilus-frontend:/etc/nginx/nginx.conf
      docker exec aquilus-frontend nginx -s reload
      echo "✓ HTTPS is enabled with existing certificate"
      exit 0
    fi
    
    echo "To obtain SSL certificate manually after DNS propagates:"
    echo "  certbot certonly --webroot --webroot-path=/var/www/certbot \\"
    echo "    -d ${domain_name} --agree-tos --email teddy.kalp@cultivatedcode.com --non-interactive"
    exit 0
  fi
  
  # DNS is ready - if we have valid cert, enable HTTPS immediately
  if [ "$has_valid_cert" = true ]; then
    echo ""
    echo "✓ DNS propagated and valid certificate exists"
    echo "Enabling HTTPS configuration..."
    export DOMAIN="${domain_name}"
    envsubst '$${DOMAIN}' < /root/aquilus-webapp/frontend/nginx-https.conf > /tmp/nginx-https.conf
    docker cp /tmp/nginx-https.conf aquilus-frontend:/etc/nginx/nginx.conf
    docker exec aquilus-frontend nginx -s reload
    echo "✓ HTTPS is enabled with existing certificate"
    exit 0
  fi
  
  # Wait for nginx to be fully operational
  echo ""
  echo "Waiting for nginx to be ready..."
  sleep 60
  
  # Verify nginx is responding
  if curl -f -s http://localhost/ > /dev/null 2>&1; then
    echo "✓ Nginx is responding"
  else
    echo "⚠ Nginx health check failed, waiting 30 more seconds..."
    sleep 30
  fi
  
  # Request SSL certificate
  echo ""
  echo "Requesting SSL certificate from Let's Encrypt..."
  certbot certonly --webroot --webroot-path=/var/www/certbot \
    -d "${domain_name}" \
    --agree-tos --email "teddy.kalp@cultivatedcode.com" \
    --non-interactive
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✓ SSL certificate obtained successfully!"
    
    # Upload certificates to Spaces
    echo ""
    echo "Backing up certificates to DigitalOcean Spaces..."
    s3cmd sync /etc/letsencrypt/ s3://${spaces_bucket}/letsencrypt/ --follow-symlinks --delete-removed
    echo "✓ Certificates backed up to Spaces"
    
    # Switch nginx to HTTPS configuration
    echo ""
    echo "Enabling HTTPS configuration..."
    export DOMAIN="${domain_name}"
    envsubst '$${DOMAIN}' < /root/aquilus-webapp/frontend/nginx-https.conf > /tmp/nginx-https.conf
    docker cp /tmp/nginx-https.conf aquilus-frontend:/etc/nginx/nginx.conf
    
    # Validate and reload nginx
    echo "Testing nginx configuration..."
    if docker exec aquilus-frontend nginx -t 2>&1; then
      echo "✓ Nginx config valid"
      docker exec aquilus-frontend nginx -s reload
      echo "✓ Nginx reloaded with HTTPS configuration"
      echo ""
      echo "=========================================="
      echo "✓ HTTPS is now enabled for ${domain_name}"
      echo "=========================================="
    else
      echo "✗ ERROR: Nginx config test failed"
    fi
  else
    echo ""
    echo "✗ ERROR: Failed to obtain SSL certificate"
    echo "  Check certbot logs: /var/log/letsencrypt/letsencrypt.log"
  fi
fi

# Set up certificate auto-renewal with Spaces backup
cat > /etc/cron.daily/certbot-renew << 'CRONSCRIPT'
#!/bin/bash
certbot renew --quiet --webroot --webroot-path=/var/www/certbot
if [ $? -eq 0 ]; then
  # Backup to Spaces after renewal
  s3cmd sync /etc/letsencrypt/ s3://${spaces_bucket}/letsencrypt/ --follow-symlinks --delete-removed
  # Reload nginx
  docker exec aquilus-frontend nginx -s reload
fi
CRONSCRIPT
chmod +x /etc/cron.daily/certbot-renew