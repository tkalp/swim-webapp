# Digital Ocean Deployment Guide

## Overview
This guide covers deploying the Aquilus swimming app to Digital Ocean using Terraform for infrastructure provisioning and automated SSL certificate setup.

## Architecture
- **Single Droplet**: Ubuntu 22.04 running Docker Compose
- **Frontend**: React app served by Nginx (ports 80/443)
- **Backend**: FastAPI application (internal port 8000)
- **SSL**: Automated Let's Encrypt certificates via Certbot
- **Domain**: Optional custom domain with DNS automation

---

## Prerequisites

### 1. Digital Ocean Account
- Create an account at https://digitalocean.com
- Generate an API token: Account → API → Generate New Token
- Save the token securely (starts with `dop_v1_...`)

### 2. GitHub Deploy Key (for private repository)
The droplet needs SSH access to clone your private repository.

**Generate deploy key:**
```bash
ssh-keygen -t ed25519 -C "aquilus-droplet-deploy" -f ~/.ssh/aquilus_deploy_key -N ""
```

This creates:
- `~/.ssh/aquilus_deploy_key` (private key - keep secret!)
- `~/.ssh/aquilus_deploy_key.pub` (public key)

**Add public key to GitHub:**
1. Go to: https://github.com/lablytics/aquilus-webapp/settings/keys
2. Click "Add deploy key"
3. Paste the public key:
   ```bash
   cat ~/.ssh/aquilus_deploy_key.pub
   ```
4. Title: `aquilus-droplet-deploy`
5. ❌ **Do NOT check** "Allow write access" (read-only is safer)

### 3. Domain Setup (Optional)
If using a custom domain:
1. Have domain registered with Digital Ocean
2. Note the exact domain name (e.g., `aquilus.app`)
3. DNS will be automatically configured by Terraform

---

## Configuration

### Create `terraform.tfvars`

Create `terraform/terraform.tfvars` with your values:

```hcl
# ============================================
# DIGITAL OCEAN
# ============================================
do_token = "dop_v1_your_token_here"

# Your personal SSH key (for accessing the droplet via ssh root@ip)
ssh_public_key = "ssh-ed25519 AAAAC3... your-email@example.com"

# ============================================
# GITHUB DEPLOY KEY
# ============================================
github_deploy_key = <<-EOT
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
... (paste entire private key from ~/.ssh/aquilus_deploy_key)
-----END OPENSSH PRIVATE KEY-----
EOT

# ============================================
# SUPABASE
# ============================================
supabase_url = "https://your-project.supabase.co"
supabase_anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
supabase_service_role_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ============================================
# AI / API KEYS
# ============================================
anthropic_api_key = "sk-ant-api03-..."

# ============================================
# FRONTEND CONFIGURATION
# ============================================
vite_api_url = "/api"  # Use relative path (nginx proxies to backend)

# ============================================
# CORS CONFIGURATION
# ============================================
# Will be automatically populated with droplet IP + localhost
allowed_origins = "http://localhost:5173"  # Updated by user-data script

# ============================================
# DOMAIN (OPTIONAL)
# ============================================
# Leave empty ("") for IP-only access
# Set to your domain (e.g., "aquilus.app") for SSL/HTTPS
domain_name = ""

# ============================================
# DROPLET CONFIGURATION (OPTIONAL)
# ============================================
region = "tor1"  # Toronto (default), see: https://slugs.do-api.dev/
droplet_size = "s-1vcpu-2gb"  # $18/mo (default)
```

### Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `do_token` | ✅ | Digital Ocean API token | `dop_v1_xxx` |
| `ssh_public_key` | ✅ | Your SSH public key for droplet access | `ssh-ed25519 AAAAC3...` |
| `github_deploy_key` | ✅ | Private SSH key for GitHub clone | See heredoc format above |
| `supabase_url` | ✅ | Supabase project URL | `https://xxx.supabase.co` |
| `supabase_anon_key` | ✅ | Supabase anonymous key | `eyJhbGci...` |
| `supabase_service_role_key` | ✅ | Supabase service role key | `eyJhbGci...` |
| `anthropic_api_key` | ✅ | Anthropic Claude API key | `sk-ant-api03-...` |
| `vite_api_url` | ✅ | Frontend API endpoint | `/api` (recommended) |
| `allowed_origins` | ✅ | CORS allowed origins | Auto-populated with droplet IP |
| `domain_name` | ❌ | Custom domain name | `aquilus.app` or `""` |
| `region` | ❌ | Droplet region | `tor1` (default) |
| `droplet_size` | ❌ | Droplet size/price | `s-1vcpu-2gb` (default) |

**Important:** Add `terraform.tfvars` to `.gitignore` (already done) - never commit secrets!

---

## Deployment Steps

### 1. Initialize Terraform
```bash
cd terraform
terraform init
```

### 2. Validate Configuration
```bash
terraform validate
terraform plan
```

Review the plan to ensure:
- Droplet will be created in correct region
- DNS record created (if domain specified)
- All variables properly substituted

### 3. Deploy
```bash
terraform apply
```

Type `yes` when prompted. Deployment takes 5-10 minutes:
1. Droplet created
2. User-data script runs (installs Docker, clones repo)
3. Docker containers built and started
4. DNS propagation checked (if domain specified)
5. SSL certificate obtained (if domain specified)

### 4. Get Droplet IP
```bash
terraform output droplet_ip
```

---

## Post-Deployment

### Access Your Application

**Without domain:**
```
http://<droplet-ip>
```

**With domain (after SSL setup):**
```
https://aquilus.app
```

### SSH into Droplet
```bash
ssh root@<droplet-ip>
```

---

## Manual Operations

### View Deployment Logs
```bash
ssh root@<droplet-ip>
tail -f /var/log/cloud-init-output.log
```

### Check Docker Status
```bash
docker ps
docker-compose -f /root/aquilus-webapp/docker-compose.yml ps
```

### View Container Logs
```bash
cd /root/aquilus-webapp
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Manually Obtain SSL Certificate
If SSL setup failed during deployment:

```bash
ssh root@<droplet-ip>

# Wait for DNS to propagate
dig +short aquilus.app
# Should return your droplet IP

# Ensure nginx is running
docker ps | grep frontend

# Request certificate
certbot certonly --webroot --webroot-path=/var/www/certbot \
  -d aquilus.app \
  --agree-tos --email your-email@example.com \
  --non-interactive

# Enable HTTPS config
cd /root/aquilus-webapp
export DOMAIN="aquilus.app"
envsubst '${DOMAIN}' < frontend/nginx-https.conf > /tmp/nginx-https.conf
docker cp /tmp/nginx-https.conf aquilus-frontend:/etc/nginx/nginx.conf
docker exec aquilus-frontend nginx -t
docker exec aquilus-frontend nginx -s reload
```

### Update Application Code
```bash
ssh root@<droplet-ip>
cd /root/aquilus-webapp
./deploy.sh
```

This script:
1. Pulls latest code from GitHub
2. Rebuilds Docker containers
3. Restarts services with zero downtime

### Update Environment Variables
```bash
ssh root@<droplet-ip>
nano /root/aquilus-webapp/.env
cd /root/aquilus-webapp
docker-compose down
docker-compose up -d
```

---

## Troubleshooting

### DNS Not Propagating

**Symptom:** SSL certificate fails with "DNS not propagated" error

**Check DNS:**
```bash
# From your local machine
dig +short aquilus.app @8.8.8.8

# Should return droplet IP
terraform output droplet_ip
```

**Solutions:**
1. Wait 10-20 minutes for DNS to propagate globally
2. Manually update DNS in Digital Ocean dashboard if Terraform didn't update it
3. Run certbot manually after DNS propagates (see "Manually Obtain SSL Certificate")

**Debug DNS on droplet:**
```bash
ssh root@<droplet-ip>
tail -f /var/log/cloud-init-output.log
# Look for "Waiting for DNS..." messages
```

### Nginx Container Crash Loop

**Symptom:** `docker ps` shows frontend restarting constantly

**Check logs:**
```bash
docker logs aquilus-frontend --tail 50
```

**Common causes:**
1. **SSL certificate missing**: If nginx.conf references SSL certs that don't exist yet
   - Solution: Ensure `nginx-http.conf` is used initially
2. **Port conflict**: Port 80 or 443 already in use
   - Solution: `netstat -tlnp | grep -E ':80|:443'`
3. **Config syntax error**: Invalid nginx configuration
   - Solution: `docker exec aquilus-frontend nginx -t`

**Fix:**
```bash
cd /root/aquilus-webapp
git pull  # Get latest configs
docker-compose down
docker-compose build frontend
docker-compose up -d
```

### Backend API Not Responding

**Check backend status:**
```bash
docker logs aquilus-backend --tail 50
docker exec aquilus-backend curl -f http://localhost:8000/health
```

**Common causes:**
1. **Missing environment variables**: Check `.env` file
2. **Supabase connection**: Verify SUPABASE_URL and keys
3. **Anthropic API key invalid**: Check ANTHROPIC_API_KEY

**Fix environment:**
```bash
nano /root/aquilus-webapp/.env
docker-compose restart backend
```

### CORS Errors

**Symptom:** Browser console shows "CORS policy" errors

**Check ALLOWED_ORIGINS:**
```bash
cat /root/aquilus-webapp/.env | grep ALLOWED_ORIGINS
```

**Should include:**
- Your domain: `http://aquilus.app` or `https://aquilus.app`
- Droplet IP: `http://<droplet-ip>`
- Local dev: `http://localhost:5173`

**Fix:**
```bash
nano /root/aquilus-webapp/.env
# Update ALLOWED_ORIGINS to comma-separated list
docker-compose restart backend
```

### Certbot Rate Limits

**Symptom:** "too many certificates already issued"

Let's Encrypt has rate limits:
- 5 failed validation attempts per hour
- 50 certificates per domain per week

**Solutions:**
1. Wait 1 hour before retrying
2. Use staging server for testing:
   ```bash
   certbot certonly --webroot --webroot-path=/var/www/certbot \
     -d aquilus.app \
     --staging \
     --agree-tos --email your-email@example.com \
     --non-interactive
   ```
3. Clean up test certificates: `certbot delete --cert-name aquilus.app`

### Docker Compose Not Found

**Symptom:** `docker-compose: command not found`

**Check Docker Compose:**
```bash
docker-compose --version
# or
docker compose version  # Docker Compose V2
```

**Fix:**
```bash
# Install Docker Compose V2
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### Nginx Can't Read SSL Certificates

**Symptom:** `BIO_new_file() failed` or permission denied

**Check permissions:**
```bash
ls -la /etc/letsencrypt/live/aquilus.app/
```

**Fix:**
```bash
chmod 755 /etc/letsencrypt/live/
chmod 755 /etc/letsencrypt/archive/
docker-compose restart frontend
```

### User-Data Script Failed

**View full logs:**
```bash
ssh root@<droplet-ip>
cat /var/log/cloud-init-output.log
```

**Check script status:**
```bash
cloud-init status --long
```

**If script didn't run:**
```bash
# Manually run the script
bash /var/lib/cloud/instance/scripts/part-001
```

---

## Destroying Resources

### Remove Everything
```bash
cd terraform
terraform destroy
```

**Warning:** This permanently deletes:
- Droplet (all data lost)
- DNS records
- Firewall rules

**To keep data:**
1. Backup database from Supabase dashboard
2. Download any logs you need: `scp root@<droplet-ip>:/root/aquilus-webapp/logs/* ./`

---

## Cost Breakdown

| Resource | Cost | Notes |
|----------|------|-------|
| Droplet (s-1vcpu-2gb) | $18/mo | Can scale up/down |
| Bandwidth | Included | 2TB/month included |
| DNS Hosting | Free | If using Digital Ocean domain |
| SSL Certificate | Free | Let's Encrypt auto-renewal |
| **Total** | **~$18/mo** | Plus any bandwidth overage |

---

## Security Best Practices

### ✅ Implemented
- SSH key authentication only (no password login)
- Firewall restricts ports to 22, 80, 443
- SSL/TLS encryption (HTTPS)
- Deploy key is read-only
- Environment variables not committed to git
- Terraform state stored locally (not in repo)

### 🔒 Recommended Improvements
1. **Restrict SSH access by IP:**
   ```hcl
   # In droplet.tf firewall
   source_addresses = ["YOUR_IP/32"]  # Instead of 0.0.0.0/0
   ```

2. **Enable automatic security updates:**
   ```bash
   apt-get install unattended-upgrades
   dpkg-reconfigure --priority=low unattended-upgrades
   ```

3. **Set up monitoring:**
   - Enable Digital Ocean monitoring
   - Configure uptime alerts
   - Set up log aggregation

4. **Backup strategy:**
   - Enable Digital Ocean droplet backups ($3.60/mo)
   - Regular database backups from Supabase
   - Store deploy keys securely (1Password, etc.)

5. **Secrets management:**
   - Consider using Digital Ocean Spaces for terraform.tfvars
   - Use Terraform Cloud for remote state
   - Rotate API keys regularly

---

## Additional Resources

- [Digital Ocean Regions](https://slugs.do-api.dev/)
- [Terraform Digital Ocean Provider](https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs)
- [Let's Encrypt Rate Limits](https://letsencrypt.org/docs/rate-limits/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)

---

## Support

For issues with this deployment:
1. Check troubleshooting section above
2. Review `/var/log/cloud-init-output.log` on droplet
3. Check container logs: `docker-compose logs`
4. Verify DNS propagation: `dig +short yourdomain.com`
5. Test SSL: `https://www.ssllabs.com/ssltest/`
