# 🎓 Kursstufenkasse - Abiturjahrgang Einnahmenverwaltung

Eine moderne, sichere und vollständig funktionsfähige Webanwendung zur Verwaltung der Kursstufenkasse. Entwickelt für den Abiturjahrgang - läuft 2+ Jahre wartungsfrei.

## ✨ Features

### 🎓 Schülerbereich
- **Persönlicher Login** über 4-stelligen Zugangscode
- **Dashboard** mit Zielbetrag, erwirtschaftet, fehlend, Fortschrittsbalken
- **Einnahmen-Historie** (nur eigene Daten sichtbar)
- **Keine Bearbeitungsmöglichkeit** - nur Lesen

### 👑 Administratorbereich
- **Sichere Anmeldung** mit Passwort (gehasht in Datenbank)
- **Schüler-Verwaltung**: Hinzufügen, Bearbeiten, Löschen
- **Zugangscode generieren/neu generieren** per Knopfdruck
- **Individuelle Zielbeträge** pro Schüler oder globaler Standard
- **Einnahmen buchen** mit Beschreibung & Datum
- **Buchungen stornieren**
- **Admin-Passwort ändern** im Interface
- **CSV-Export** aller Daten (Excel-kompatibel)
- **Gesamtübersicht** der gesamten Kursstufe

### 🛡 Technisch
- **Supabase (PostgreSQL)** - Daten bleiben für immer erhalten
- **Render.com** - Kostenloses Hosting, SSL, Custom Domain möglich
- **Responsive Design** - funktioniert auf Smartphone, Tablet, PC
- **Farbschema**: Himmelblau, Weiß, Schwarz

---

## 🚀 Schritt-für-Schritt Anleitung: Von 0 bis Live

### Voraussetzungen
- **GitHub Account** (kostenlos): [github.com](https://github.com)
- **Render Account** (kostenlos): [render.com](https://render.com) → "Get Started for Free" → mit GitHub anmelden
- **Supabase Account** (kostenlos): [supabase.com](https://supabase.com) → "Start your project" → mit GitHub anmelden
- **Node.js** (für lokalen Test): [nodejs.org](https://nodejs.org) → LTS Version installieren
- **Git** (für Upload): [git-scm.com/download/win](https://git-scm.com/download/win) → Standard-Installation

---

### Phase 1: Supabase Datenbank einrichten (2 Minuten)

1. **Projekt erstellen**
   - Gehe zu [supabase.com](https://supabase.com) → Anmelden → **New Project**
   - Name: `kursstufenkasse`
   - Datenbank-Passwort: **Notieren!** (brauchst du nicht mehr, aber sicher ist sicher)
   - Region: **Frankfurt (eu-central-1)**
   - **Create new project** → warten bis "Database ready" (ca. 2 Min)

2. **Tabellen anlegen**
   - Links im Menü: **SQL Editor** → **New Query**
   - **Kopiere den kompletten folgenden Block** und klicke **Run**:

```sql
-- Tabellen anlegen
CREATE TABLE settings (id int PRIMARY KEY DEFAULT 1, default_target numeric(10,2) NOT NULL DEFAULT 50.00);
CREATE TABLE students (id text PRIMARY KEY, name text NOT NULL, code text UNIQUE NOT NULL, target numeric(10,2));
CREATE TABLE transactions (id text PRIMARY KEY, student_id text REFERENCES students(id) ON DELETE CASCADE, amount numeric(10,2) NOT NULL, description text, date date NOT NULL);
CREATE TABLE admin_auth (id int PRIMARY KEY DEFAULT 1, password_hash text NOT NULL);

-- Admin Passwort Hash für 'admin123' (SHA-256)
INSERT INTO admin_auth (password_hash) VALUES ('ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f');

-- Start-Daten
INSERT INTO settings (default_target) VALUES (50.00);
INSERT INTO students (id, name, code, target) VALUES
  ('st-1', 'Maximilian Müller', 'AB12', 50.00),
  ('st-2', 'Sophie Schmidt', 'CD34', 50.00),
  ('st-3', 'Leon Weber', 'EF56', 60.00);
INSERT INTO transactions (id, student_id, amount, description, date) VALUES
  ('tx-1', 'st-1', 20.00, 'Kuchenverkauf Schulfest', '2026-03-01'),
  ('tx-2', 'st-1', 5.00, 'Spende', '2026-03-05'),
  ('tx-3', 'st-2', 15.00, 'Getränkeverkauf', '2026-03-02'),
  ('tx-4', 'st-3', 30.00, 'Muffinsverkauf', '2026-03-04');
```

3. **API-Keys holen**
   - Links: **Settings (Zahnrad)** → **API**
   - Kopiere **Project URL** (z. B. `https://abcxyz.supabase.co`)
   - Kopiere **`service_role` Key** (der **geheime**, NICHT `anon` public!)

---

### Phase 2: Code auf GitHub laden (3 Minuten)

**Option A: GitHub Desktop (empfohlen, grafisch)**
1. [GitHub Desktop](https://desktop.github.com/) installieren & mit GitHub anmelden
2. In GitHub Desktop: **File** → **Add local repository** → Ordner `C:\Users\Fuchs\Desktop\claude` wählen
3. Meldung "This directory does not appear to be a Git repository" → **create a repository** klicken
4. Name: `kursstufenkasse` → **Create repository**
5. Oben: **Publish repository** → Haken bei "Keep this code private" **ENTFERNEN** (Public für kostenloses Render) → **Publish repository**

**Option B: Kommandozeile (PowerShell / Git Bash)**
```powershell
cd "C:\Users\Fuchs\Desktop\claude"
git init
git add .
git commit -m "Initial commit Kursstufenkasse"
# Dann auf github.com/new Repository 'kursstufenkasse' erstellen (Public, kein README)
git remote add origin https://github.com/DEIN-USERNAME/kursstufenkasse.git
git branch -M main
git push -u origin main
```

---

### Phase 3: Render Web Service erstellen (3 Minuten)

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. **Connect** dein GitHub Repository `kursstufenkasse`
3. Einstellungen:
   - **Name:** `kursstufenkasse`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. **Environment Variables** (ganz wichtig!):
   - `SUPABASE_URL` → Deine Project URL aus Supabase
   - `SUPABASE_SERVICE_KEY` → Dein `service_role` Key aus Supabase
5. **Create Web Service** klicken

**Warten bis "Your service is live" (ca. 2-3 Min).** Deine URL: `https://kursstufenkasse.onrender.com`

---

### Phase 4: Lokale Entwicklung (Optional)

```powershell
cd "C:\Users\Fuchs\Desktop\claude"
# 1. .env Datei erstellen (kopiere .env.example zu .env und fülle Werte)
copy .env.example .env
# Dann .env mit Editor öffnen und DEINE Supabase-Werte eintragen

# 2. Dependencies installieren
npm install

# 3. Server starten
npm start
# → http://localhost:3000
```

---

## 🔑 Standard-Zugangsdaten (nach Setup)

| Rolle | Zugang |
|-------|--------|
| **Admin** | Passwort: `admin123` (im Interface unter Einstellungen änderbar) |
| **Schüler (Beispiele)** | `AB12` (Maximilian), `CD34` (Sophie), `EF56` (Leon) |

**Neue Schüler anlegen:** Admin einloggen → "+ Schüler hinzufügen" → Code wird automatisch generiert (oder selbst eingeben) → Speichern → Fertig. Kein Neustart nötig!

---

## 📁 Projektstruktur

```
kursstufenkasse/
├── .env.example          # Vorlage für lokale Config
├── .gitignore            # Schützt .env & node_modules
├── package.json          # Dependencies & Scripts
├── server.js             # Backend (Node.js + Supabase)
├── README.md             # Diese Datei
└── public/               # Frontend (wird von Server ausgeliefert)
    ├── index.html        # Haupt-HTML (Login, Student, Admin Views)
    ├── css/
    │   └── styles.css    # Styling (Himmelblau/Weiß/Schwarz)
    └── js/
        └── app.js        # Frontend-Logik
```

---

## 🛠 Wartung & Updates

**Code ändern & deployen:**
1. Lokal Änderungen machen
2. In GitHub Desktop: **Commit to main** → **Push origin**
3. Render baut **automatisch** neu und deployed (ca. 2 Min)

**Datenbank-Backup:** Supabase Dashboard → Settings → Database → Backups (automatisch täglich)

**Kosten:** **0 € / Monat** (Supabase Free 500 MB + Render Free Tier)

---

## 🆘 Häufige Probleme

| Problem | Lösung |
|---------|--------|
| `npm install` schlägt fehl | Node.js LTS neu installieren, PowerShell neu starten |
| "ENOENT package.json" auf Render | Root Directory in Render Settings prüfen (sollte leer sein) |
| Admin-Login klappt nicht | Supabase SQL nochmal prüfen (Hash muss exakt sein) |
| CORS Fehler | Render URL in Supabase nicht nötig (Server-seitig) |
| Daten nicht aktuell | Browser-Cache leeren (Strg+F5) |

---

## 📞 Support

Bei Problemen:
1. Render Logs prüfen (Dashboard → Service → Logs)
2. Browser DevTools (F12) → Console / Network Tab
3. Supabase Logs (Dashboard → Logs → Database)

**Viel Erfolg mit der Kursstufenkasse! 🎓💰**