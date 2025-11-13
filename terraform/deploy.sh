#!/bin/bash

terraform apply -auto-approve

echo "Waiting for droplet to initialize..."
sleep 60

# Get the droplet IP from terraform output
DROPLET_IP=$(terraform output -raw droplet_ip 2>/dev/null)

if [ -n "$DROPLET_IP" ]; then
  echo ""
  echo "=========================================="
  echo "Deployment complete!"
  echo "Droplet IP: $DROPLET_IP"
  echo "=========================================="
  echo ""
  echo "Connecting to droplet via SSH..."
  ssh root@$DROPLET_IP
else
  echo "Could not retrieve droplet IP from terraform output"
fi

sleep 20
