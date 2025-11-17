#!/bin/bash

scp -o StrictHostKeyChecking=no -r backend/chroma_db root@$(cd terraform; terraform output -raw droplet_ip):/root/aquilus-webapp/backend/