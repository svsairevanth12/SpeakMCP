#!/bin/bash

mkdir -p resources/bin

cd whispo-rs

cargo build -r

cp target/release/whispo-rs ../resources/bin/whispo-rs

cd ..

# Sign the binary on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🔐 Signing Rust binary..."
    ./scripts/sign-binary.sh
fi
