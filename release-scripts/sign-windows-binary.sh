#!/usr/bin/env bash

# create files as needed
CERT_FILE=cert.pem
if [ ! -f "$CERT_FILE" ]; then
  echo "$SIGNING_CERT" | base64 --decode > "$CERT_FILE"
fi

# create files as needed
KEY_FILE=key.pem
if [ ! -f "$KEY_FILE" ]; then
  echo "$SIGNING_KEY" | base64 --decode > "$KEY_FILE"
fi

osslsigncode sign -h sha512 \
  -certs cert.pem \
  -key key.pem \
  -n "Snyk CLI" \
  -i "https://snyk.io" \
  -t "http://timestamp.comodoca.com/authenticode" \
  -in snyk-win.exe \
  -out snyk-win-signed.exe

sha256sum snyk-win-signed.exe > snyk-win-signed.exe.sha256