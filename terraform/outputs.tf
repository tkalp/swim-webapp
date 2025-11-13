output "droplet_ip" {
  value       = digitalocean_droplet.aquilus.ipv4_address
  description = "IP address of the droplet"
}

output "droplet_id" {
  value       = digitalocean_droplet.aquilus.id
  description = "ID of the droplet"
}