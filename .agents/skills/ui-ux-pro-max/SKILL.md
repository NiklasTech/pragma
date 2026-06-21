---
name: ui-ux-pro-max
description: >
'  Comprehensive UI/UX design intelligence for building professional interfaces across web and mobile.
  Use when the user requests any of the following: UI/UX design, landing pages, dashboards, mobile apps,
  design systems, color palettes, typography pairing, style selection, UX reviews, accessibility checks,
  component design, frontend implementation guidance, React/Next.js/Vue/Svelte/Angular/Astro/Laravel styling,
  React Native/Flutter/SwiftUI/Jetpack Compose UI, dark mode, responsive design, charts/data visualization,
  or conversion optimization.'
---

# UI/UX Pro Max

Dieser Skill liefert Design-Intelligenz für professionelle UI/UX auf Basis einer durchsuchbaren Wissensdatenbank (161 Produkttypen, 67 Styles, 161 Farbpaletten, 57 Schriftpaare, 99 UX-Richtlinien, 15 Tech-Stacks).

## Voraussetzungen

Python 3 ist erforderlich.

```bash
python3 --version
```

Falls nicht installiert:

- **macOS:** `brew install python3`
- **Ubuntu/Debian:** `sudo apt update && sudo apt install python3`
- **Windows:** `winget install Python.Python.3.12`

## Wann dieser Skill verwenden

**Muss verwendet werden bei:**

- Neuer Seite/Komponente (Landing Page, Dashboard, Admin, SaaS, Mobile App)
- Auswahl von Stil, Farben, Schriftarten oder Layout-System
- UX-Review, Accessibility-Check oder visuelle Qualitätskontrolle
- Navigation, Animation, Responsive Behavior, Dark Mode
- Design-System oder Komponentenbibliothek

**Kann übersprungen werden bei:**

- Reiner Backend-Logik, API-Design, Datenbankschema
- DevOps/Infrastruktur
- Nicht-visuellen Skripten

## Workflow

### Schritt 1: Anforderungen analysieren

Extrahiere aus der Nutzeranfrage:

- **Produkttyp:** SaaS, E-Commerce, Portfolio, Healthcare, Fintech, Beauty, Service …
- **Zielgruppe:** Endnutzer, B2B, Alter, Nutzungskontext
- **Stil-Keywords:** minimalistisch, verspielt, dunkel, premium, content-first …
- **Stack:** React, Next.js, Vue, Svelte, Astro, shadcn/ui, HTML+Tailwind, SwiftUI, React Native, Flutter, Jetpack Compose, Laravel, Angular

### Schritt 2: Design-System generieren (ERFORDERLICH)

Starte **immer** mit `--design-system`, um ein vollständiges, begründetes Design-System zu erhalten:

```bash
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "<produkttyp> <branche> <keywords>" --design-system -p "Projektname"
```

Das Kommando sucht parallel in den Domains Produkt, Stil, Farbe, Landing-Pattern und Typografie und wendet branchenspezifische Reasoning-Regeln an.

**Beispiele:**

```bash
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness" --design-system -p "Serenity Spa"
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "fintech banking dark" --design-system -p "FinVault"
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "saas dashboard analytics" --design-system -p "DataView"
```

**Design-System persistieren (Master + Overrides Pattern):**

```bash
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "saas dashboard" --design-system --persist -p "MyApp"
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "saas dashboard" --design-system --persist -p "MyApp" --page "dashboard"
```

Erzeugt `design-system/<projekt>/MASTER.md` und optional `design-system/<projekt>/pages/<page>.md`. Bei der Implementierung einer konkreten Seite gilt: Seiten-Datei überschreibt MASTER.md.

### Schritt 3: Detail-Suchen (bei Bedarf)

Nach dem Design-System können gezielte Domain-Suchen weitere Details liefern:

```bash
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n 5]
```

| Bedarf             | Domain         | Beispiel                                   |
| ------------------ | -------------- | ------------------------------------------ |
| Produkttyp-Muster  | `product`      | `--domain product "healthcare clinic"`     |
| Stil-Optionen      | `style`        | `--domain style "glassmorphism dark"`      |
| Farbpaletten       | `color`        | `--domain color "fintech trust"`           |
| Schriftpaare       | `typography`   | `--domain typography "elegant serif"`      |
| Chart-Typen        | `chart`        | `--domain chart "real-time dashboard"`     |
| UX-Richtlinien     | `ux`           | `--domain ux "animation accessibility"`    |
| Landing-Struktur   | `landing`      | `--domain landing "hero social-proof"`     |
| React-Performance  | `react`        | `--domain react "rerender memo list"`      |
| App-Interface/A11y | `web`          | `--domain web "accessibilityLabel touch"`  |
| Icons              | `icons`        | `--domain icons "settings menu"`           |
| Google Fonts       | `google-fonts` | `--domain google-fonts "monospace coding"` |

### Schritt 4: Stack-Richtlinien

Für implementierungsspezifische Best Practices:

```bash
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack <stack>
```

**Verfügbare Stacks:**
`react`, `nextjs`, `vue`, `svelte`, `astro`, `swiftui`, `react-native`, `flutter`, `nuxtjs`, `nuxt-ui`, `html-tailwind`, `shadcn`, `jetpack-compose`, `threejs`, `angular`, `laravel`

### Schritt 5: UX-Review vor Auslieferung

Vor der finalen Auslieferung:

1. Lese `references/quick-reference.md` für die prioritätsgeordnete Checkliste.
2. Prüfe insbesondere:
   - Kontrast 4.5:1 für Text
   - Touch-Targets ≥44×44pt (iOS) / ≥48×48dp (Android)
   - `cursor-pointer` auf allen klickbaren Elementen
   - Fokus-Status sichtbar
   - `prefers-reduced-motion` beachtet
   - Keine Emojis als Icons (SVG/Lucide/Heroicons)
   - Keine Layout-shifting Hovers
   - Responsive Breakpoints: 375px, 768px, 1024px, 1440px

## Ausgabeformate

```bash
# ASCII-Box (Standard, gut für Terminal)
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system

# Markdown (gut für Dokumentation)
python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown
```

## Beispiel-Workflow

**Nutzer:** "Baue eine Landing Page für mein SaaS-Produkt."

1. **Anforderungen:** Produkttyp SaaS, Zielgruppe B2B, Stil modern/minimal.
2. **Design-System:**
   ```bash
   python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "saas b2b modern minimal" --design-system -p "MySaaS"
   ```
3. **Details bei Bedarf:**
   ```bash
   python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "minimalism" --domain style
   python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "hero cta conversion" --domain landing
   ```
4. **Stack (z. B. React):**
   ```bash
   python3 ~/.kimi/skills/ui-ux-pro-max/scripts/search.py "form validation responsive" --stack react
   ```
5. **Implementiere das UI** mit den generierten Tokens (Farben, Typografie, Abstände, Schatten) und führe die Pre-Delivery-Checkliste aus.

## Wichtige Hinweise

- Verwende **keine Emojis** als Icons. Nutze Lucide, Heroicons oder Phosphor.
- Verwende **semantische Farb-Tokens** (`--color-primary`, `--color-background` usw.) statt hartkodierter Hex-Werte in Komponenten.
- Designe **Light und Dark Mode gemeinsam**, nicht nachträglich.
- Bevorzuge **native/systemkonforme Komponenten**, wenn Branding es zulässt.
- Jede Animation braucht einen Sinn (Ursache-Wirkung), nicht nur Dekoration.

## Referenzen

Detaillierte, priorisierte UX-Regeln und Anti-Patterns:

- [`references/quick-reference.md`](references/quick-reference.md)
