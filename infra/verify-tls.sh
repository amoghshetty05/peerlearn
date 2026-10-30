#!/usr/bin/env sh
# TC-19 / SR-01 manual check: plain HTTP redirects, TLS 1.2+ accepted, TLS 1.1 refused.
HOST="${1:-localhost}"
echo "== HTTP should redirect to HTTPS"
curl -sI "http://$HOST/" | head -n 3
echo "== TLS 1.2 should connect"
echo | openssl s_client -connect "$HOST:443" -tls1_2 2>/dev/null | grep -E "Protocol|Cipher" | head -n 2
echo "== TLS 1.1 should be refused"
echo | openssl s_client -connect "$HOST:443" -tls1_1 2>&1 | grep -E "alert|no protocols|Protocol" | head -n 2
