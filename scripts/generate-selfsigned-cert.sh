#!/bin/bash
# Generate self-signed certificate for local development

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$CERT_DIR"

echo "Generating self-signed certificate for localhost..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/selfsigned.key" \
    -out "$CERT_DIR/selfsigned.crt" \
    -subj "/C=US/ST=Local/L=Local/O=Development/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Certificate generated:"
echo "  - $CERT_DIR/selfsigned.crt"
echo "  - $CERT_DIR/selfsigned.key"
echo ""
echo "Note: Your browser will show a security warning. This is normal for self-signed certs."
echo "You can add an exception in your browser."
