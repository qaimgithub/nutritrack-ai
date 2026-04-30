# Workflow: Food Tracker v1 — Build & Iterate

## Objective
Build a premium, automated food logging web app that tracks calories, protein, carbs, and fats with smart input methods (natural language, search, photo).

## Architecture
- **Frontend**: Single-page app (index.html + style.css + app.js)
- **Data**: Built-in food database (150+ common foods with USDA-accurate macros)
- **Storage**: localStorage (client-side, no backend needed for v1)
- **AI Integration**: Placeholder for photo recognition (requires API key in .env)

## Features (v1)
1. **Dashboard** — Circular macro rings, daily calorie budget, at-a-glance nutrition
2. **Quick Add (NL)** — Type "2 eggs and a banana" → auto-parsed and logged
3. **Food Search** — Fuzzy search across built-in database
4. **Meal Sections** — Breakfast, Lunch, Dinner, Snacks with individual totals
5. **Serving Sizes** — Handles grams, oz, cups, pieces, slices, tbsp
6. **Date Navigation** — Browse past days
7. **Goal Setting** — Calorie and macro targets
8. **Data Persistence** — All data in localStorage, survives refresh

## Design System
- **Theme**: Dark mode, glassmorphism panels
- **Font**: Inter (Google Fonts)
- **Macro Colors**: Calories=#f59e0b, Protein=#3b82f6, Carbs=#10b981, Fat=#f43f5e
- **Background**: #0a0a0f with subtle gradient
- **Animations**: Smooth micro-transitions on all interactive elements

## Known Constraints
- localStorage limit: ~5MB (sufficient for years of daily logs)
- No backend = no cross-device sync (v2 consideration)
- Photo recognition requires OpenAI/Gemini API key
- NL parser uses regex + fuzzy matching (good for common entries, not perfect)

## Future Enhancements (v2+)
- [ ] Barcode scanning via camera
- [ ] AI photo recognition (OpenAI Vision / Gemini)
- [ ] Backend with user accounts
- [ ] Weekly/monthly trend charts
- [ ] Meal planning & suggestions
- [ ] Export to CSV/Google Sheets
- [ ] PWA for mobile install
