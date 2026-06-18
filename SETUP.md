# Setup-Anleitung

## 1. Cloudinary vorbereiten

1. Melde dich bei cloudinary.com an
2. Geh zu **Settings → Upload → Upload presets**
3. Klick **Add upload preset**
   - Signing mode: **Unsigned**
   - Folder: `mergelskaul-haus` (optional)
4. Speichere den Preset-Namen
5. Trage in `public/app.js` ein:
   ```js
   const CLOUDINARY_CLOUD  = "dein-cloud-name";   // z.B. "dxabc123"
   const CLOUDINARY_PRESET = "dein-preset-name";  // z.B. "ml_default"
   ```

## 2. Cloudflare vorbereiten

### Wrangler installieren
```bash
npm install -g wrangler
wrangler login
```

### D1-Datenbank erstellen
```bash
wrangler d1 create mergelskaul-haus
```

Kopiere die `database_id` aus dem Output in `wrangler.toml`.

### Datenbank-Schema anlegen
```bash
wrangler d1 execute mergelskaul-haus --file=schema.sql
```

## 3. Auf GitHub pushen & deployen

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/daviddamjakob-claude/mergelskaul-haus.git
git push -u origin main
```

Dann in der Cloudflare-Konsole:
1. **Pages → Create a project → Connect to Git**
2. Repo `mergelskaul-haus` auswählen
3. Build settings:
   - Build command: *(leer lassen)*
   - Output directory: `public`
4. Bei **Environment variables / Bindings** → D1 binding hinzufügen:
   - Variable name: `DB`
   - D1 database: `mergelskaul-haus`
5. **Deploy!**

Die App ist dann unter `https://mergelskaul-haus.pages.dev` erreichbar — kostenlos, für alle Familienmitglieder zugänglich.
