#!/usr/bin/env python3
"""
Lightning Whisper MLX Transcriber
A Python script to interface with lightning-whisper-mlx for audio transcription.
"""

import sys
import json
import argparse
import os

def check_dependencies():
    """Check if lightning-whisper-mlx is installed."""
    try:
        import lightning_whisper_mlx
        return True
    except ImportError:
        return False

def install_dependencies():
    """Install lightning-whisper-mlx if not present."""
    import subprocess
    try:
        # Redirect stdout and stderr to suppress pip output
        # Only the JSON result should be printed to stdout
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "lightning-whisper-mlx"],
            capture_output=True,
            text=True,
            check=True
        )
        return True
    except subprocess.CalledProcessError as e:
        # Log the error to stderr for debugging, but don't let it interfere with JSON output
        print(f"Installation failed: {e.stderr}", file=sys.stderr)
        return False

def transcribe_audio(audio_path, model="distil-medium.en", batch_size=12, quant=None):
    """
    Transcribe audio using lightning-whisper-mlx.

    Args:
        audio_path (str): Path to the audio file
        model (str): Model to use for transcription
        batch_size (int): Batch size for processing
        quant (str): Quantization level (4bit, 8bit, or None)

    Returns:
        dict: Transcription result with text and metadata
    """
    try:
        from lightning_whisper_mlx import LightningWhisperMLX

        # Initialize the whisper model
        whisper = LightningWhisperMLX(
            model=model,
            batch_size=batch_size,
            quant=quant
        )

        # Transcribe the audio
        result = whisper.transcribe(audio_path=audio_path)

        return {
            "success": True,
            "text": result.get("text", ""),
            "segments": result.get("segments", []),
            "language": result.get("language", ""),
            "model": model,
            "batch_size": batch_size,
            "quant": quant
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "model": model,
            "batch_size": batch_size,
            "quant": quant
        }

def main():
    parser = argparse.ArgumentParser(description="Lightning Whisper MLX Transcriber")
    parser.add_argument("audio_path", nargs="?", help="Path to the audio file")
    parser.add_argument("--model", default="distil-medium.en", help="Model to use")
    parser.add_argument("--batch-size", type=int, default=12, help="Batch size")
    parser.add_argument("--quant", choices=["4bit", "8bit"], help="Quantization level")
    parser.add_argument("--check-deps", action="store_true", help="Check if dependencies are installed")
    parser.add_argument("--install-deps", action="store_true", help="Install dependencies")

    args = parser.parse_args()

    # Handle dependency checking
    if args.check_deps:
        result = {
            "dependencies_installed": check_dependencies()
        }
        print(json.dumps(result))
        return

    # Handle dependency installation
    if args.install_deps:
        result = {
            "installation_success": install_dependencies()
        }
        print(json.dumps(result))
        return

    # For transcription, we need an audio file
    if not args.check_deps and not args.install_deps:
        if not args.audio_path:
            result = {
                "success": False,
                "error": "Audio file path is required for transcription"
            }
            print(json.dumps(result))
            sys.exit(1)

        # Check if dependencies are installed
        if not check_dependencies():
            result = {
                "success": False,
                "error": "lightning-whisper-mlx is not installed. Please install it first."
            }
            print(json.dumps(result))
            sys.exit(1)

        # Check if audio file exists
        if not os.path.exists(args.audio_path):
            result = {
                "success": False,
                "error": f"Audio file not found: {args.audio_path}"
            }
            print(json.dumps(result))
            sys.exit(1)

    # Perform transcription
    result = transcribe_audio(
        audio_path=args.audio_path,
        model=args.model,
        batch_size=args.batch_size,
        quant=args.quant
    )

    # Output result as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()
