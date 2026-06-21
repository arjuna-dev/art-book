#!/usr/bin/env python3
"""
Generate images for conceptual art pieces from list.json.

Dependencies:
  python3 -m pip install openai google-genai pillow requests python-dotenv

Environment variables can be exported in the shell or placed in .env beside this script:
  OPENAI_API_KEY                 Required for --providers openai
  VERTEX_PROJECT or GOOGLE_CLOUD_PROJECT
                                 Required for --providers gemini
  VERTEX_LOCATION                Optional for --providers gemini; defaults to global
  MAI_API_KEY                    Required for --providers mai
  MAI_ENDPOINT                   Required for --providers mai unless --mai-endpoint is set
  MAI_MODEL                      Optional MAI deployment name; defaults to MAI-Image-2

Example:
  python3 generate_images.py --providers openai gemini --limit 3
  python3 generate_images.py --providers openai --openai-quality low
  python3 generate_images.py --providers gemini --modifying-prompt
  python3 generate_images.py --providers mai --mai-endpoint https://YOUR-RESOURCE.services.ai.azure.com/mai/v1/images/generations
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR / "list.json"
DEFAULT_OUTPUT_DIR = SCRIPT_DIR / "generated-images"
DEFAULT_ENV_FILE = SCRIPT_DIR / ".env"

DEFAULT_PRE_PROMPT = (
    "Generate a realistic documentary photograph of this conceptual art piece as a physical artwork "
    "installed in its intended setting. Show the artwork with enough museum, gallery, public, or outdoor "
    "context to make its scale, placement, and environment clear; avoid isolated close-ups unless the "
    "concept cannot be shown any other way. Render only the artwork and its surroundings. Do not include "
    "readable text, labels, title cards, plaques, captions, signatures, watermarks, artist names, artwork "
    "titles, series names, dates, or years anywhere in the image. Avoid illustration, cartoon, CGI-looking "
    "renders, fake text artifacts, and fantasy styling unless the art piece explicitly requires them. "
    "Return only the generated image; do not write back any text as part of your answer."
)


@dataclass(frozen=True)
class ArtPiece:
    index: int
    artist_name: str
    series_name: str
    art_piece_name: str
    year: str
    technique_used: str
    short_description: str
    long_description: str
    display_context: str
    aspect_ratio: str
    image_prompt: str
    modifying_prompt: str
    should_generate: bool


def slugify(value: str, max_len: int = 80) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return (value or "untitled")[:max_len].strip("-")


def load_art_pieces(input_path: Path) -> list[ArtPiece]:
    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    pieces: list[ArtPiece] = []
    for artist in data:
        for piece in artist.get("art_pieces", []):
            pieces.append(
                ArtPiece(
                    index=len(pieces) + 1,
                    artist_name=artist.get("artist_name", ""),
                    series_name=artist.get("series_name", ""),
                    art_piece_name=piece.get("art_piece_name", ""),
                    year=str(piece.get("year", "")),
                    technique_used=piece.get("technique_used", ""),
                    short_description=piece.get("short_description", ""),
                    long_description=piece.get("long_description", ""),
                    display_context=piece.get("display_context", ""),
                    aspect_ratio=piece.get("aspect_ratio", "1:1"),
                    image_prompt=piece.get("image_prompt", ""),
                    modifying_prompt=piece.get("modifying_prompt") or "",
                    should_generate=piece.get("should_generate", True),
                )
            )
    return pieces


def build_prompt(piece: ArtPiece, pre_prompt: str) -> str:
    display_context = (
        piece.display_context or "Museum gallery or outdoor public art setting"
    )
    sections = [
        pre_prompt,
        f"Aspect ratio: {piece.aspect_ratio}",
        f"Installation context to show: {display_context}",
        f"Technique and materials: {piece.technique_used}",
        f"Artwork subject: {piece.short_description}",
        f"Concept details: {piece.long_description}",
        f"Visual brief: {piece.image_prompt}",
        "Composition requirement: use a medium or wide documentary view that shows the full artwork, "
        "its physical surroundings, and its scale in the space. No readable exhibition text or art "
        "information should appear in the image.",
    ]
    return "\n\n".join(s for s in sections if s.strip())


def build_modifying_prompt(piece: ArtPiece) -> str:
    return "\n\n".join(
        (
            "Modify the supplied image according to the following instruction. "
            "Preserve the original artwork, composition, installation context, "
            "and photographic realism except where the instruction explicitly "
            "requests a change. Return only the modified image.",
            piece.modifying_prompt.strip(),
            f"Requested output aspect ratio: {gemini_aspect_for(piece.aspect_ratio)}.",
        )
    )


def output_path_for(piece: ArtPiece, provider: str, output_dir: Path) -> Path:
    artist = slugify(piece.artist_name, 36)
    title = slugify(piece.art_piece_name, 72)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{piece.index:03d}-{artist}-{title}-{timestamp}.png"
    return output_dir / provider / filename


def existing_output_for(
    piece: ArtPiece, provider: str, output_dir: Path
) -> Path | None:
    artist = slugify(piece.artist_name, 36)
    title = slugify(piece.art_piece_name, 72)
    pattern = f"{piece.index:03d}-{artist}-{title}-*.png"
    return next(iter(sorted((output_dir / provider).glob(pattern))), None)


def source_image_for(
    piece: ArtPiece, provider: str, output_dir: Path
) -> Path | None:
    artist = slugify(piece.artist_name, 36)
    title = slugify(piece.art_piece_name, 72)
    pattern = f"*-{artist}-{title}-*.png"
    matches = list((output_dir / provider).glob(pattern))
    if not matches:
        return None

    def timestamp_key(path: Path) -> tuple[str, str]:
        timestamp = re.search(r"\d{8}T\d{6}Z", path.name)
        return (timestamp.group(0) if timestamp else "", path.name)

    return max(matches, key=timestamp_key)


def is_retryable_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(
        marker in message
        for marker in (
            "429",
            "resource_exhausted",
            "resource has been exhausted",
            "503",
            "service unavailable",
            "timed out",
            "timeout",
        )
    )


def openai_size_for_aspect(aspect_ratio: str) -> str:
    landscape = {"16:9", "4:3", "3:2"}
    portrait = {"9:16", "4:5", "3:4", "2:3"}
    if aspect_ratio in landscape:
        return "1536x1024"
    if aspect_ratio in portrait:
        return "1024x1536"
    return "1024x1024"


def parse_size(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"\s*(\d+)\s*x\s*(\d+)\s*", value)
    if not match:
        raise ValueError(f"Expected size in WIDTHxHEIGHT format, got: {value}")
    return int(match.group(1)), int(match.group(2))


def mai_dimensions_for_aspect(aspect_ratio: str) -> tuple[int, int]:
    # MAI requires width and height >= 768 and total pixels <= 1,048,576.
    dimensions = {
        "16:9": (1365, 768),
        "4:3": (1024, 768),
        "3:2": (1152, 768),
        "5:4": (1024, 819),
        "1:1": (1024, 1024),
        "4:5": (819, 1024),
        "3:4": (768, 1024),
        "2:3": (768, 1152),
        "9:16": (768, 1365),
    }
    return dimensions.get(aspect_ratio, (1024, 1024))


def validate_mai_dimensions(width: int, height: int) -> None:
    if width < 768 or height < 768:
        raise ValueError("MAI width and height must both be at least 768 pixels")
    if width * height > 1_048_576:
        raise ValueError("MAI width * height must not exceed 1,048,576 pixels")


def gemini_aspect_for(aspect_ratio: str) -> str:
    supported = {"1:1", "3:4", "4:3", "9:16", "16:9"}
    if aspect_ratio in supported:
        return aspect_ratio
    if aspect_ratio == "4:5":
        return "3:4"
    if aspect_ratio == "5:4":
        return "4:3"
    return "1:1"


def generate_openai(
    prompt: str, piece: ArtPiece, args: argparse.Namespace
) -> tuple[bytes, str]:
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "Install the OpenAI SDK: python3 -m pip install openai"
        ) from exc

    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set")

    model = args.openai_model
    size = args.openai_size or openai_size_for_aspect(piece.aspect_ratio)
    quality = args.openai_quality
    client = OpenAI()
    response = client.images.generate(
        model=model,
        prompt=prompt,
        n=1,
        size=size,
        quality=quality,
    )
    item = response.data[0]
    b64_json = getattr(item, "b64_json", None)
    if b64_json:
        return base64.b64decode(b64_json), model

    url = getattr(item, "url", None)
    if url:
        return download_url(url), model

    raise RuntimeError("OpenAI response did not contain b64_json or url image data")


def generate_gemini(
    prompt: str, piece: ArtPiece, args: argparse.Namespace
) -> tuple[bytes, str]:
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise RuntimeError(
            "Install the Gemini SDK: python3 -m pip install google-genai"
        ) from exc

    model = args.gemini_model
    project = (
        args.vertex_project
        or os.environ.get("VERTEX_PROJECT")
        or os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GOOGLE_CLOUD_PROJECT_ID")
    )
    if not project:
        raise RuntimeError(
            "Vertex project is not set. Use --vertex-project or set VERTEX_PROJECT/GOOGLE_CLOUD_PROJECT."
        )

    location = args.vertex_location or os.environ.get("VERTEX_LOCATION") or "global"
    aspect_ratio = args.gemini_aspect_ratio or gemini_aspect_for(piece.aspect_ratio)
    if args.modifying_prompt:
        source_path = source_image_for(
            piece, args.source_provider, args.output_dir
        )
        if not source_path:
            raise RuntimeError(
                f"No source image found for {piece.art_piece_name!r} in "
                f"{args.output_dir / args.source_provider}"
            )
        source_bytes = source_path.read_bytes()
        source_part = types.Part.from_bytes(
            data=source_bytes,
            mime_type="image/png",
        )
        contents: Any = types.Content(
            role="user",
            parts=[
                source_part,
                types.Part.from_text(text=prompt),
            ],
        )
    else:
        contents = "\n\n".join(
            [
                prompt,
                f"Requested output aspect ratio: {aspect_ratio}.",
            ]
        )

    client = genai.Client(
        vertexai=True,
        project=project,
        location=location,
    )
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
    )
    image_bytes = image_bytes_from_gemini_content(response)
    return image_bytes, model


def image_bytes_from_gemini_content(response: Any) -> bytes:
    text_parts: list[str] = []
    for candidate in getattr(response, "candidates", []) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", []) or []:
            inline_data = getattr(part, "inline_data", None)
            if inline_data and getattr(inline_data, "data", None):
                data = inline_data.data
                return data if isinstance(data, bytes) else base64.b64decode(data)
            text = getattr(part, "text", None)
            if text:
                text_parts.append(text)

    suffix = f" Text response: {' '.join(text_parts)[:500]}" if text_parts else ""
    raise RuntimeError(
        f"Gemini Vertex response did not contain inline image data.{suffix}"
    )


def generate_mai(
    prompt: str, piece: ArtPiece, args: argparse.Namespace
) -> tuple[bytes, str]:
    """
    Microsoft MAI image access expects a Foundry MAI image generation endpoint:

      https://YOUR-RESOURCE.services.ai.azure.com/mai/v1/images/generations
    """
    endpoint = args.mai_endpoint or os.environ.get("MAI_ENDPOINT")
    api_key = os.environ.get("MAI_API_KEY") or os.environ.get("AZURE_OPENAI_API_KEY")
    if not endpoint:
        raise RuntimeError(
            "MAI endpoint is not set. Use --mai-endpoint or MAI_ENDPOINT."
        )
    if not api_key:
        raise RuntimeError("MAI_API_KEY or AZURE_OPENAI_API_KEY is not set")

    model = args.mai_model or os.environ.get("MAI_MODEL") or "MAI-Image-2"
    try:
        width, height = (
            parse_size(args.mai_size)
            if args.mai_size
            else mai_dimensions_for_aspect(piece.aspect_ratio)
        )
        validate_mai_dimensions(width, height)
    except ValueError as exc:
        raise RuntimeError(str(exc)) from exc

    url = endpoint
    if args.mai_api_version and "api-version=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}api-version={args.mai_api_version}"

    headers = {
        "Content-Type": "application/json",
        "api-key": api_key,
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": model,
        "prompt": prompt,
        "width": width,
        "height": height,
    }
    try:
        response = post_json(url, headers, payload)
    except RuntimeError as exc:
        if "DeploymentNotFound" in str(exc):
            raise RuntimeError(
                f"MAI deployment {model!r} was not found. Deploy the MAI image model in Foundry, "
                "or set --mai-model/MAI_MODEL to the exact deployment name shown in Foundry."
            ) from exc
        raise
    image_bytes = image_bytes_from_response(response)
    return image_bytes, model


def post_json(
    url: str, headers: dict[str, str], payload: dict[str, Any]
) -> dict[str, Any]:
    try:
        import requests
    except ImportError as exc:
        raise RuntimeError("Install requests: python3 -m pip install requests") from exc

    r = requests.post(url, headers=headers, json=payload, timeout=300)
    if not r.ok:
        raise RuntimeError(f"POST {url} failed with {r.status_code}: {r.text[:1000]}")
    return r.json()


def download_url(url: str) -> bytes:
    try:
        import requests
    except ImportError as exc:
        raise RuntimeError("Install requests: python3 -m pip install requests") from exc

    r = requests.get(url, timeout=300)
    if not r.ok:
        raise RuntimeError(f"Download failed with {r.status_code}: {r.text[:1000]}")
    return r.content


def image_bytes_from_response(response: dict[str, Any]) -> bytes:
    data = response.get("data")
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            for key in ("b64_json", "base64", "image_base64"):
                if first.get(key):
                    return base64.b64decode(first[key])
            if first.get("url"):
                return download_url(first["url"])

    for key in ("b64_json", "base64", "image_base64"):
        if response.get(key):
            return base64.b64decode(response[key])
    if response.get("url"):
        return download_url(response["url"])

    raise RuntimeError(
        "Response did not contain b64_json, base64, image_base64, or url image data"
    )


def save_png_with_metadata(
    image_bytes: bytes,
    output_path: Path,
    metadata: dict[str, str],
) -> None:
    try:
        from PIL import Image
        from PIL.PngImagePlugin import PngInfo
    except ImportError as exc:
        raise RuntimeError(
            "Install Pillow for metadata support: python3 -m pip install pillow"
        ) from exc

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(BytesIO(image_bytes))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")

    png_info = PngInfo()
    for key, value in metadata.items():
        png_info.add_text(key, "" if value is None else str(value))

    image.save(output_path, format="PNG", pnginfo=png_info)


def provider_names(values: list[str]) -> list[str]:
    providers: list[str] = []
    for value in values:
        for part in value.split(","):
            name = part.strip().lower()
            if not name:
                continue
            if name == "all":
                for provider in ("openai", "gemini", "mai"):
                    if provider not in providers:
                        providers.append(provider)
                continue
            if name not in {"openai", "gemini", "mai"}:
                raise argparse.ArgumentTypeError(f"Unsupported provider: {name}")
            if name not in providers:
                providers.append(name)
    return providers


def load_environment(env_file: Path) -> None:
    if not env_file.exists():
        return

    try:
        from dotenv import load_dotenv
    except ImportError as exc:
        raise RuntimeError(
            "Install python-dotenv to load .env files: python3 -m pip install python-dotenv"
        ) from exc

    load_dotenv(env_file, override=False)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate images for art pieces in list.json using OpenAI, Gemini, and/or MAI."
    )
    parser.add_argument(
        "--input", type=Path, default=DEFAULT_INPUT, help="Path to list.json"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for generated PNGs",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=DEFAULT_ENV_FILE,
        help="Path to .env file with API keys",
    )
    parser.add_argument(
        "--providers",
        nargs="+",
        required=True,
        help="One or more providers: openai gemini mai, comma-separated values, or all",
    )
    parser.add_argument(
        "--pre-prompt",
        default=DEFAULT_PRE_PROMPT,
        help="Instruction prepended to every prompt",
    )
    parser.add_argument(
        "--limit", type=int, default=None, help="Generate only this many pieces"
    )
    parser.add_argument(
        "--start", type=int, default=1, help="1-based art piece index to start from"
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip output files that already exist",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned prompts without calling APIs",
    )
    parser.add_argument(
        "--modifying-prompt",
        action="store_true",
        help=(
            "Use each artwork's modifying_prompt and its latest local source "
            "image instead of generating from text alone; Gemini only"
        ),
    )
    parser.add_argument(
        "--source-provider",
        default="gemini",
        help="Source image subdirectory under the output directory",
    )
    parser.add_argument(
        "--modified-output-provider",
        default="gemini-modified",
        help="Output subdirectory used for Gemini image modifications",
    )
    parser.add_argument(
        "--sleep", type=float, default=0.0, help="Seconds to sleep between API calls"
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=4,
        help="Retries for quota, service unavailable, and timeout errors",
    )
    parser.add_argument(
        "--retry-delay",
        type=float,
        default=15.0,
        help="Initial retry delay in seconds; doubles after each attempt",
    )

    parser.add_argument(
        "--openai-model", default="gpt-image-2", help="OpenAI image model"
    )
    parser.add_argument(
        "--openai-size", default=None, help="Override OpenAI size, e.g. 1024x1024"
    )
    parser.add_argument(
        "--openai-quality",
        default="low",
        choices=("low", "medium", "high", "auto"),
        help="OpenAI image quality; defaults to low for cheaper drafts",
    )

    parser.add_argument(
        "--gemini-model",
        default="gemini-3.1-flash-image-preview",
        help="Gemini Vertex image model",
    )
    parser.add_argument(
        "--gemini-aspect-ratio", default=None, help="Override Gemini aspect ratio"
    )
    parser.add_argument(
        "--vertex-project",
        default=None,
        help="Google Cloud project for Gemini on Vertex AI",
    )
    parser.add_argument(
        "--vertex-location",
        default=None,
        help="Vertex AI location; defaults to VERTEX_LOCATION or global",
    )

    parser.add_argument(
        "--mai-model",
        default=None,
        help="Microsoft/MAI deployment name; defaults to MAI_MODEL or MAI-Image-2",
    )
    parser.add_argument(
        "--mai-endpoint", default=None, help="Microsoft/MAI image generation endpoint"
    )
    parser.add_argument(
        "--mai-api-version",
        default=None,
        help="Optional Azure api-version query parameter",
    )
    parser.add_argument(
        "--mai-size", default=None, help="Override MAI image size, e.g. 1024x1024"
    )

    args = parser.parse_args()
    args.providers = provider_names(args.providers)
    return args


def main() -> int:
    args = parse_args()
    if args.modifying_prompt and args.providers != ["gemini"]:
        print(
            "error: --modifying-prompt currently requires --providers gemini",
            file=sys.stderr,
        )
        return 2

    try:
        load_environment(args.env_file)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    pieces = load_art_pieces(args.input)
    # Filter for should_generate=True first, then apply start/limit filtering
    generate_pieces = [
        piece
        for piece in pieces
        if piece.should_generate
        and (not args.modifying_prompt or piece.modifying_prompt.strip())
    ]
    selected = [piece for piece in generate_pieces if piece.index >= args.start]
    if args.limit is not None:
        selected = selected[: args.limit]

    if not selected:
        print("No art pieces selected.", file=sys.stderr)
        return 1

    generators = {
        "openai": generate_openai,
        "gemini": generate_gemini,
        "mai": generate_mai,
    }

    failures = 0
    for piece in selected:
        prompt = (
            build_modifying_prompt(piece)
            if args.modifying_prompt
            else build_prompt(piece, args.pre_prompt)
        )
        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
        for provider in args.providers:
            output_provider = (
                args.modified_output_provider
                if args.modifying_prompt and provider == "gemini"
                else provider
            )
            existing_output = existing_output_for(
                piece, output_provider, args.output_dir
            )
            if args.skip_existing and existing_output:
                print(f"skip existing: {existing_output}")
                continue

            output_path = output_path_for(
                piece, output_provider, args.output_dir
            )

            print(f"{provider}: {piece.index:03d} {piece.art_piece_name}")
            if args.dry_run:
                print(f"would write: {output_path}")
                if args.modifying_prompt:
                    source_path = source_image_for(
                        piece, args.source_provider, args.output_dir
                    )
                    print(f"source image: {source_path or 'NOT FOUND'}")
                print(prompt)
                print("-" * 80)
                continue

            try:
                for attempt in range(args.retries + 1):
                    try:
                        image_bytes, model = generators[provider](
                            prompt, piece, args
                        )
                        break
                    except Exception as exc:
                        if attempt >= args.retries or not is_retryable_error(exc):
                            raise
                        delay = args.retry_delay * (2**attempt)
                        print(
                            f"retry: {provider} {piece.index:03d} in {delay:g}s "
                            f"after: {exc}",
                            file=sys.stderr,
                        )
                        time.sleep(delay)
                metadata = {
                    "prompt": prompt,
                    "prompt_sha256": prompt_hash,
                    "model": model,
                    "provider": provider,
                    "generation_mode": (
                        "image-modification"
                        if args.modifying_prompt
                        else "text-to-image"
                    ),
                    "source_image": (
                        str(
                            source_image_for(
                                piece,
                                args.source_provider,
                                args.output_dir,
                            )
                            or ""
                        )
                        if args.modifying_prompt
                        else ""
                    ),
                    "openai_quality": (
                        args.openai_quality if provider == "openai" else ""
                    ),
                    "artist_name": piece.artist_name,
                    "series_name": piece.series_name,
                    "art_piece_name": piece.art_piece_name,
                    "aspect_ratio": piece.aspect_ratio,
                    "source_json": str(args.input),
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
                save_png_with_metadata(image_bytes, output_path, metadata)
                print(f"saved: {output_path}")
            except Exception as exc:  # noqa: BLE001 - keep batch generation moving.
                failures += 1
                print(
                    f"error: {provider} {piece.index:03d} {piece.art_piece_name}: {exc}",
                    file=sys.stderr,
                )

            if args.sleep:
                time.sleep(args.sleep)

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
