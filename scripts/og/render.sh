#!/usr/bin/env bash
# Renders scripts/og/og.html into public/og.jpg — the link preview card.
#
# Run with:  sh scripts/og/render.sh
#
# Notes that cost time the first time round:
#  - Chrome cannot write into the OneDrive folder (Access denied 0x5), so it
#    writes to %TEMP% and the file is copied into public/ afterwards.
#  - --user-data-dir is required, otherwise Chrome collides with the running
#    browser profile and silently writes nothing.
#  - JPEG, not PNG: some chat clients refuse to fetch large preview images, and
#    quality 86 at 1200x630 lands around 120 KB.
export PATH="/usr/bin:/bin:/c/Program Files/ImageMagick-7.1.2-Q16-HDRI:/c/WINDOWS/system32:$PATH"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
HERE_WIN="C:\\Users\\nisa8\\OneDrive\\Desktop\\spell website GSAP\\scripts\\og"
PUBLIC="/c/Users/nisa8/OneDrive/Desktop/spell website GSAP/public"
TMP="/c/Users/nisa8/AppData/Local/Temp"

"$CHROME" --headless=new --no-sandbox --disable-gpu --allow-file-access-from-files \
  --user-data-dir="$TMP/gcog" --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=8000 --window-size=1200,630 \
  --screenshot="$TMP\\og.png" "file:///$HERE_WIN/og.html" 2>&1 | grep -Ei "denied|cannot" | head -1

magick "$TMP/og.png" -quality 86 -strip "$PUBLIC/og.jpg"
magick identify "$PUBLIC/og.jpg"
