variable "do_token" {
  description = "Digital Ocean API Token"
  type        = string
  sensitive   = true
}

variable "ssh_key_name" {
  description = "SSH key name in Digital Ocean"
  type        = string
  default     = "aquilus-deploy-key"
}

variable "ssh_public_key" {
  description = "Public SSH key content"
  type        = string
}

variable "github_deploy_key" {
  description = "Private SSH key for GitHub repository access (deploy key)"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "Digital Ocean region"
  type        = string
  default     = "tor1"
}

variable "droplet_size" {
  description = "Droplet size"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "domain_name" {
  description = "Domain name for the app"
  type        = string
  default     = ""
}

# Application secrets
variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
}

variable "vite_api_url" {
  description = "API URL for frontend (e.g., http://your-ip/api)"
  type        = string
}

variable "allowed_origins" {
  description = "List of approved domains for API CORS"
  type        = list(string)
  default     = []
}

variable "supabase_jwt_secret" {
  description = "Supabase JWT secret"
  type        = string
  sensitive   = true
}

variable "spaces_access_key" {
  description = "DigitalOcean Spaces access key"
  type        = string
  sensitive   = true
}

variable "spaces_secret_key" {
  description = "DigitalOcean Spaces secret key"
  type        = string
  sensitive   = true
}

variable "spaces_bucket" {
  description = "DigitalOcean Spaces bucket name"
  type        = string
  default     = "aquilus-app-bucket"
}

variable "spaces_region" {
  description = "DigitalOcean Spaces region"
  type        = string
  default     = "sfo3"
}

variable "use_oxylabs_proxy" {
  description = "Whether to use Oxylabs residential proxy for data ingestion"
  type        = string
  default     = "false"
}

variable "oxylabs_username" {
  description = "Oxylabs proxy username"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oxylabs_password" {
  description = "Oxylabs proxy password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oxylabs_country" {
  description = "Oxylabs proxy country code (e.g., US, GB)"
  type        = string
  default     = "US"
}

variable "mixpanel_token" {
  description = "Mixpanel project token"
  type        = string
  sensitive   = true
}