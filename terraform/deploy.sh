#!/bin/bash

terraform apply -auto-approve

# Get the droplet IP
DROPLET_IP=$(terraform output -raw droplet_ip 2>/dev/null)

if [ -n "$DROPLET_IP" ]; then
  echo "Droplet IP: $DROPLET_IP"
  echo "Waiting for repository to be ready..."
  
  # Wait for the READY_FOR_CHROMADB marker
  until ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@$DROPLET_IP "test -f /root/aquilus-webapp/READY_FOR_CHROMADB" 2>/dev/null; do
    echo "Waiting for repository..."
    sleep 5
  done
  
  echo "✓ Repository ready"
  echo ""
  
  # Transfer chroma_db
  echo "Transferring chroma_db..."
  scp -o StrictHostKeyChecking=no -r ../backend/chroma_db root@$DROPLET_IP:/root/aquilus-webapp/backend/
  echo "✓ chroma_db transferred"
  echo ""
  
  # Create marker to signal transfer is complete
  ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "touch /root/aquilus-webapp/CHROMADB_TRANSFERRED"
  echo "✓ Signaled transfer complete"
  echo ""
  
  echo "Watching deployment progress..."
  ssh root@$DROPLET_IP "tail -f /var/log/cloud-init-output.log"
else
  echo "Could not retrieve droplet IP"
fi