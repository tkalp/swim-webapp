# SSH Key
resource "digitalocean_ssh_key" "default" {
  name       = var.ssh_key_name
  public_key = var.ssh_public_key
}

# Droplet
resource "digitalocean_droplet" "aquilus" {
  name   = "aquilus-app"
  region = var.region
  size   = var.droplet_size
  image  = "ubuntu-22-04-x64"

  ssh_keys = [digitalocean_ssh_key.default.id]

  user_data = templatefile("${path.module}/scripts/user-data.sh", {
    deploy_key              = var.github_deploy_key
    supabase_url            = var.supabase_url
    supabase_anon_key       = var.supabase_anon_key
    supabase_service_role_key = var.supabase_service_role_key
    anthropic_api_key       = var.anthropic_api_key
    vite_supabase_url       = var.supabase_url
    vite_supabase_anon_key  = var.supabase_anon_key
    vite_api_url            = var.vite_api_url
    domain_name             = var.domain_name
    allowed_origins         = join(",", var.allowed_origins)
    supabase_jwt_secret     = var.supabase_jwt_secret
    spaces_access_key         = var.spaces_access_key
    spaces_secret_key         = var.spaces_secret_key
    spaces_bucket             = var.spaces_bucket
    spaces_region             = var.spaces_region
    use_oxylabs_proxy         = var.use_oxylabs_proxy
    oxylabs_username          = var.oxylabs_username
    oxylabs_password          = var.oxylabs_password
    oxylabs_country           = var.oxylabs_country
    mixpanel_token            = var.mixpanel_token
    scraper_max_workers       = var.scraper_max_workers
    auto_gen_days_ahead       = var.auto_gen_days_ahead
    auto_gen_schedule_hour    = var.auto_gen_schedule_hour
    auto_gen_schedule_minute  = var.auto_gen_schedule_minute
  })

  tags = ["aquilus", "production"]
}

# Firewall
resource "digitalocean_firewall" "aquilus" {
  name = "aquilus-firewall"

  droplet_ids = [digitalocean_droplet.aquilus.id]

  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Allow all outbound
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Domain (optional)
data "digitalocean_domain" "aquilus" {
  count = var.domain_name != "" ? 1 : 0
  name  = var.domain_name
}


resource "digitalocean_record" "aquilus" {
  count  = var.domain_name != "" ? 1 : 0
  domain = data.digitalocean_domain.aquilus[0].id
  type   = "A"
  name   = "@"
  value  = digitalocean_droplet.aquilus.ipv4_address
}