#!/usr/bin/env python3

import html
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


CARD_RE = re.compile(
    r'(<a class="card"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h3 class="cardtitle">)'
    r'([\s\S]*?)'
    r'(</h3>[\s\S]*?<p class="cardsub">)'
    r'([\s\S]*?)'
    r'(</p>[\s\S]*?</a>)'
)


def get_video_id(url_value):
    try:
        parsed = urllib.parse.urlparse(url_value)
    except Exception:
        return None

    host = parsed.netloc.lower()
    if "youtu.be" in host:
        return parsed.path.lstrip("/") or None
    if "youtube.com" in host:
        query = urllib.parse.parse_qs(parsed.query)
        values = query.get("v")
        return values[0] if values else None
    return None


def fetch_text(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_meta(video_id):
    oembed_url = (
        "https://www.youtube.com/oembed?url="
        + urllib.parse.quote(f"https://www.youtube.com/watch?v={video_id}", safe="")
        + "&format=json"
    )
    watch_url = f"https://www.youtube.com/watch?v={video_id}"

    oembed_text = fetch_text(oembed_url)
    watch_text = fetch_text(watch_url)

    title_match = re.search(r'"title"\s*:\s*"((?:\\.|[^"\\])*)"', oembed_text)
    if not title_match:
        raise RuntimeError("titulo nao encontrado no oEmbed")

    raw_title = bytes(title_match.group(1), "utf-8").decode("unicode_escape").strip()
    if not raw_title:
        raise RuntimeError("titulo vazio")

    year_match = re.search(r'"publishDate":"(\d{4})-\d{2}-\d{2}"', watch_text)
    year = year_match.group(1) if year_match else None
    return raw_title, year


def replace_cards(html_source):
    changed = 0

    def repl(match):
        nonlocal changed

        title_prefix, href, _old_title, title_suffix, old_sub, subtitle_suffix = match.groups()
        video_id = get_video_id(href)
        if not video_id:
            return match.group(0)

        try:
            title, year = fetch_meta(video_id)
        except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError) as err:
            print(f"Ignorado {video_id}: {err}")
            return match.group(0)

        prefix = old_sub.split("•")[0].strip() or "YouTube"
        subtitle = f"{prefix} • {year}" if year else prefix
        changed += 1
        print(f"Atualizado {video_id}: {title}" + (f" ({year})" if year else ""))

        return (
            title_prefix
            + html.escape(title, quote=True)
            + title_suffix
            + html.escape(subtitle, quote=True)
            + subtitle_suffix
        )

    return CARD_RE.sub(repl, html_source), changed


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "index.html"

    with open(target, "r", encoding="utf-8") as f:
        content = f.read()

    updated, changed = replace_cards(content)
    if changed == 0:
        print("Nenhum card atualizado.")
        return

    with open(target, "w", encoding="utf-8") as f:
        f.write(updated)

    print(f"Concluido. {changed} card(s) atualizado(s) em {target}.")


if __name__ == "__main__":
    main()
