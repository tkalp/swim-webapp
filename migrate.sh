#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: ./migrate.sh '<supabase-password>'"
  echo "Example: ./migrate.sh 'MySecretPassword123'"
  echo "Note: Wrap password in single quotes if it contains special characters (!, $, etc.)"
  exit 1
fi

PASSWORD="$1"

python scripts/migrate_from_supabase.py \
  --source "postgresql://postgres.rusrkwvbypbgluaalxcq:${PASSWORD}@aws-1-ca-central-1.pooler.supabase.com:6543/postgres" \
  --target "postgresql://aquilus:aquilus@localhost:5432/aquilus"