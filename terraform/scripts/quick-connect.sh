#!/bin/bash

DROPLET_IP=$(terraform output -raw droplet_ip 2>/dev/null)
ssh root@$DROPLET_IP