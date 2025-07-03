#!/bin/bash

# Script to properly sign the Rust binary with the same certificate as the main app

BINARY_PATH="resources/bin/speakmcp-rs"
ENTITLEMENTS_PATH="build/entitlements.mac.plist"

if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Binary not found at $BINARY_PATH"
    exit 1
fi

if [ ! -f "$ENTITLEMENTS_PATH" ]; then
    echo "❌ Entitlements file not found at $ENTITLEMENTS_PATH"
    exit 1
fi

# Get the signing identity from environment or use self-signing for development
if [ -n "${CSC_NAME:-}" ]; then
    IDENTITY="$CSC_NAME"
    echo "🔐 Signing binary with certificate: $IDENTITY"
else
    IDENTITY="-"
    echo "🔐 Self-signing binary for development"
fi

# Sign the binary with the same entitlements as the main app
codesign --force --sign "$IDENTITY" --entitlements "$ENTITLEMENTS_PATH" "$BINARY_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Binary signed successfully"

    # Verify the signature
    echo "🔍 Verifying signature..."
    codesign -dv "$BINARY_PATH"
else
    echo "❌ Failed to sign binary"
    exit 1
fi
