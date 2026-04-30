# NutriTrack AI

AI-powered nutrition tracking PWA with smart macro logging, body composition analytics, and personalized coaching.

## Features
- **Food Logging** — Natural language input + smart search with 500+ foods database
- **Macro Tracking** — Real-time calorie, protein, carb, and fat visualization with circular progress rings
- **Body Composition** — Navy BF% formula, anthropometric tracking, measurement history
- **AI Coach** — Personalized nutrition insights powered by Gemini API
- **Water Tracking** — Daily hydration goals with quick-add buttons

## Tech Stack
- Vanilla HTML/CSS/JS (single-page PWA)
- Gemini API for AI features
- localStorage for data persistence
- GitHub Pages for deployment

## Files
| File | Purpose |
|------|---------|
| `index.html` | Main app shell, tabs, UI structure |
| `style.css` | All styling, glassmorphism, animations |
| `core.js` | Food logging, data persistence, chart rendering |
| `features.js` | Water tracking, workout log, extended features |
| `coach.js` | AI Coach tab, Gemini integration |
| `body.js` | Body composition tab, measurements |
| `food-db.js` | Built-in food database (500+ items) |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker for offline caching |
| `food-tracker-v1.md` | Original workflow / spec document |

## Deployment
Served via GitHub Pages. After changes:
1. `git add -A && git commit -m "message" && git push origin main`
2. Bump `sw.js` cache version so PWAs refresh
