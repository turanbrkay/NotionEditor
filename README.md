BURADA KENDİ EDİTORUMUZDEN COPY PASTE YAPAMIYORUZ DÜZELT.
BİR BOŞLUK BIRAKIP ALT SATIRA GEÇEMİYORUM BUNU DÜZELT.


# Notion-like Offline Editor (React + TypeScript + Vite)

Local-only, block-based editor that exports Notion-compatible JSON. Vite is configured with `base: './'` so the bundled app runs directly from `file://` with no server.

## Quick start (dev)
- Install once: `npm ci`
- Run dev server: `npm run dev`
- Type checking + build: `npm run build`

## Ship a static bundle (no npm on target machine)
These steps create a ready-to-run bundle you can open via `file://` at work.

1) Build locally  
`npm run build`

2) Package the static output  
- Windows (PowerShell): `Compress-Archive -Path dist\\* -DestinationPath dist.zip -Force`  
- macOS/Linux: `cd dist && zip -r ../dist.zip .`

3) Move `dist.zip` to the target machine (GitHub release/artifact, repo checkout, or USB), unzip it, and open `dist/index.html` in the browser. No Node/npm is required.

Tip: keep `dist/` checked in if you want versioned bundles without rebuilding at work.

## Optional Docker path (if Docker is allowed)
- Build image locally: `docker build -t notion-editor .`
- Export image: `docker save notion-editor > notion-editor.tar`
- Copy `notion-editor.tar` to work, load with `docker load -i notion-editor.tar`, and run `docker run -p 4173:4173 notion-editor` (still no npm install on-site).
