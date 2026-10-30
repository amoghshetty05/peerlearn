#!/usr/bin/env sh
# Self-signed certificate for local demos. Use a real certificate (e.g. Let's Encrypt) in production.
set -e
mkdir -p "$(dirname "$0")/certs"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$(dirname "$0")/certs/server.key" -out "$(dirname "$0")/certs/server.crt" \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
echo "Certificate written to infra/certs/"
