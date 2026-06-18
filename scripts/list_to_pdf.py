#!/usr/bin/env python3
"""Convert list.json into a readable markdown file and PDF."""

import json
import subprocess
import sys
from pathlib import Path


def load_data(json_path: Path) -> list:
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def generate_markdown(artists: list) -> str:
    lines = []
    lines.append("# Art Book - Collection Overview\n")

    for artist in artists:
        name = artist.get("artist_name", "Unknown Artist")
        intro = artist.get("artist_introduction", "")
        long_desc = artist.get("artist_long_description", "")
        series = artist.get("series_name", "")

        lines.append(f"## {name}\n")

        if intro:
            lines.append(f"*{intro}*\n")

        if long_desc:
            lines.append(f"{long_desc}\n")

        if series:
            lines.append(f"**Series:** {series}\n")

        pieces = artist.get("art_pieces", [])
        if pieces:
            lines.append("---\n")

        for piece in pieces:
            piece_name = piece.get("art_piece_name", "Untitled")
            year = piece.get("year", "")
            technique = piece.get("technique_used", "")
            short_desc = piece.get("short_description", "")
            long_desc_piece = piece.get("long_description", "")
            display = piece.get("display_context", "")
            include = piece.get("include_in_book", True)

            title = f"### {piece_name}"
            if year:
                title += f" ({year})"
            lines.append(f"{title}\n")

            if not include:
                lines.append("*[Excluded from book]*\n")

            if technique:
                lines.append(f"**Technique:** {technique}\n")

            if display:
                lines.append(f"**Display:** {display}\n")

            if short_desc:
                lines.append(f"{short_desc}\n")

            if long_desc_piece:
                lines.append(f"{long_desc_piece}\n")

            lines.append("")

        lines.append("\n---\n")

    return "\n".join(lines)


def markdown_to_pdf(md_path: Path, pdf_path: Path):
    """Convert markdown to PDF using pandoc if available."""
    try:
        subprocess.run(["pandoc", "--version"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("pandoc not found. Trying with python-markdown + weasyprint...")
        markdown_to_pdf_python(md_path, pdf_path)
        return

    cmd = [
        "pandoc",
        str(md_path),
        "-o", str(pdf_path),
        "--pdf-engine=xelatex",
        "-V", "geometry:margin=1in",
        "-V", "mainfont:Helvetica Neue",
        "-V", "fontsize=11pt",
        "--toc",
        "--toc-depth=2",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"PDF created: {pdf_path}")
        else:
            # Try without xelatex font options
            cmd_fallback = [
                "pandoc",
                str(md_path),
                "-o", str(pdf_path),
                "-V", "geometry:margin=1in",
                "-V", "fontsize=11pt",
                "--toc",
                "--toc-depth=2",
            ]
            result = subprocess.run(cmd_fallback, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"PDF created: {pdf_path}")
            else:
                print(f"pandoc PDF failed: {result.stderr}")
                print("Falling back to Python-based PDF generation...")
                markdown_to_pdf_python(md_path, pdf_path)
    except Exception as e:
        print(f"pandoc error: {e}")
        markdown_to_pdf_python(md_path, pdf_path)


def markdown_to_pdf_python(md_path: Path, pdf_path: Path):
    """Fallback: convert markdown to PDF using markdown + weasyprint."""
    try:
        import markdown
        from weasyprint import HTML
    except ImportError:
        print(
            "Install weasyprint and markdown for Python-based PDF:\n"
            "  pip install weasyprint markdown\n"
            "Or install pandoc: brew install pandoc"
        )
        sys.exit(1)

    md_text = md_path.read_text(encoding="utf-8")
    html_body = markdown.markdown(md_text, extensions=["extra"])

    html_doc = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body {{
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        max-width: 700px;
        margin: 0 auto;
        padding: 2cm;
        color: #1a1a1a;
    }}
    h1 {{ font-size: 24pt; margin-top: 1em; }}
    h2 {{ font-size: 18pt; margin-top: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }}
    h3 {{ font-size: 13pt; margin-top: 1.2em; }}
    em {{ color: #555; }}
    strong {{ color: #333; }}
    hr {{ border: none; border-top: 1px solid #ddd; margin: 2em 0; }}
    @page {{ size: A4; margin: 2cm; }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

    HTML(string=html_doc).write_pdf(str(pdf_path))
    print(f"PDF created: {pdf_path}")


def main():
    repo_root = Path(__file__).resolve().parent.parent
    json_path = repo_root / "list.json"
    output_dir = repo_root

    md_path = output_dir / "list.md"
    pdf_path = output_dir / "list.pdf"

    artists = load_data(json_path)
    md_content = generate_markdown(artists)

    md_path.write_text(md_content, encoding="utf-8")
    print(f"Markdown created: {md_path}")

    markdown_to_pdf(md_path, pdf_path)


if __name__ == "__main__":
    main()
