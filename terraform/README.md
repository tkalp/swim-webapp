# Terraform Deployment for Aquilus

This directory contains Terraform configuration to deploy the Aquilus swimming app to Digital Ocean.

## Prerequisites

1. **Digital Ocean Account** with API token
2. **GitHub Deploy Key** for private repository access (see [DEPLOY_KEY_SETUP.md](./DEPLOY_KEY_SETUP.md))
3. **Terraform** installed (v1.0+)

## Quick Start

### 1. Set up GitHub Deploy Key

Follow the instructions in [DEPLOY_KEY_SETUP.md](./DEPLOY_KEY_SETUP.md) to generate and configure SSH access for the droplet to clone your private repository.

### 2. Create `terraform.tfvars`

```hcl
do_token = "dop_v1_your_token_here"

ssh_public_key = "ssh-ed25519 AAAAC3... your-email@example.com"

github_deploy_key = <<-EOT
-----BEGIN OPENSSH PRIVATE KEY-----
... (paste your deploy key here)
-----END OPENSSH PRIVATE KEY-----
EOT

# Optional: Custom configuration
region        = "tor1"         # Toronto (default)
droplet_size  = "s-1vcpu-2gb"  # $18/mo (default)
domain_name   = ""             # Leave empty for IP-only access
```

### 3. Initialize and Deploy

```bash
terraform init
terraform plan
terraform apply
```

### 4. Get Droplet IP

```bash
terraform output droplet_ip
```

### 5. Configure Application

SSH into the droplet:
```bash
ssh root@<droplet-ip>
```

Create the `.env` file:
```bash
cd /root/aquilus-webapp
nano .env
```

Add your environment variables:
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-your-key-here

# ChromaDB
CHROMA_DB_PATH=/app/chroma_db

# Frontend URLs (will be available via nginx)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://your-droplet-ip/api
```

### 6. Start the Application

```bash
cd /root/aquilus-webapp
docker-compose up -d
```

Check status:
```bash
docker-compose ps
docker-compose logs -f
```

## Architecture

**Single Droplet Setup:**
- **Nginx**: Frontend static files + reverse proxy to backend (port 80/443)
- **FastAPI Backend**: Python API server (internal port 8000)
- **Docker Compose**: Orchestrates both services

**Estimated Cost**: ~$18/month (s-1vcpu-2gb droplet)

## Files

- `main.tf` - Provider configuration
- `variables.tf` - Input variables
- `droplet.tf` - Droplet, SSH key, and firewall resources
- `cloud-init.yaml` - Bootstrap script for droplet setup
- `outputs.tf` - Output values (IP address, ID)
- `DEPLOY_KEY_SETUP.md` - GitHub deploy key configuration guide

## Useful Commands

### View Terraform State
```bash
terraform show
```

### Update Deployment
```bash
terraform apply
```

### Destroy Resources
```bash
terraform destroy
```

### SSH into Droplet
```bash
ssh root@$(terraform output -raw droplet_ip)
```

## Post-Deployment

### SSL/TLS Setup (Optional)

If you configured a domain, set up Let's Encrypt:

```bash
ssh root@<droplet-ip>

# Install certbot
apt update
apt install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d yourdomain.com

# Certbot will automatically configure nginx and set up auto-renewal
```

### Deploy Script

Use the included deploy script for updates:

```bash
ssh root@<droplet-ip>
cd /root/aquilus-webapp
./deploy.sh
```

This script:
1. Pulls latest code from GitHub
2. Rebuilds Docker images
3. Restarts containers with zero downtime

## Troubleshooting

### Check Cloud-Init Progress
```bash
ssh root@<droplet-ip>
tail -f /var/log/cloud-init-output.log
```

### Repository Clone Issues
See [DEPLOY_KEY_SETUP.md](./DEPLOY_KEY_SETUP.md) for GitHub access troubleshooting.

### Check Docker Services
```bash
ssh root@<droplet-ip>
cd /root/aquilus-webapp
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
```

### Firewall Issues
```bash
# Check if firewall is blocking
doctl compute firewall list
```

## Security Notes

- ✅ Deploy key is read-only and scoped to single repository
- ✅ All secrets in `terraform.tfvars` (git-ignored)
- ✅ Firewall restricts access to SSH (22), HTTP (80), HTTPS (443)
- ⚠️ Add your IP to SSH inbound rules for better security
- ⚠️ Set up SSL/TLS for production use
- ⚠️ Never commit `terraform.tfvars` or state files to git
