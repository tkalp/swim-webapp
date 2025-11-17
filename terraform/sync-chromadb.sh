
#!/bin/bash

DROPLET_IP=$(terraform output -raw droplet_ip 2>/dev/null)
scp -r backend/chroma_db root@$DROPLET_IP:/root/aquilus-webapp/backend/