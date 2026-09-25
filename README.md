# SplitMate

Track. Split. Save.

## Project overview
SplitMate is a lightweight, mobile-first expense tracker and split expense planner designed for students. It helps users manage a monthly budget, track personal spending, create shared expenses, and calculate who owes whom without requiring a backend or login.

## Features
- Monthly budget tracking and reminders
- Personal expense logging with categories and notes
- Dynamic dashboard totals and month-based summaries
- Search, filter, and edit/delete expense actions
- Shared expense splitting for 2+ participants
- Net-balance and suggested settlement calculations
- Group-based expense tracking and settlement suggestions
- Settlement history with pending/settled actions
- Local JSON export/import backup support
- Light/dark mode
- Local-only storage using browser localStorage

## Technology
- HTML5
- CSS3
- Vanilla JavaScript
- localStorage for persistence
- Responsive design for mobile, tablet, and desktop

## How local storage works
Version 1 stores all data in the browser using localStorage. This includes:
- settings
- monthly budgets
- expenses
- groups
- members
- shared expenses
- settlements

The app reads and writes JSON safely, and it handles missing or corrupted data gracefully with fallback defaults.

## How to run locally
1. Download or clone the repository.
2. Open `index.html` directly in a browser, or serve the folder with a simple local static server.
3. For example:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000/
```

## How to deploy to GitHub Pages
1. Push the project files to a GitHub repository.
2. In the repository settings, enable GitHub Pages.
3. Choose the branch that contains the site files (for example `main`).
4. Set the folder to `/root` if using the repository root.
5. Save the settings.
6. GitHub will publish the site at:

```text
https://USERNAME.github.io/SplitMate/
```

This app is compatible with GitHub Pages because it uses static files only and no server-side routing.

## Privacy note
SplitMate Version 1 stores everything locally in the browser. No financial data is sent to any server, no analytics are used, and no external APIs are called.

## Future roadmap
- User authentication
- Cloud sync
- Real-time group sharing
- Multi-device synchronization
- PWA/mobile installation
- Optional backend integration
- Notifications
- Advanced analytics

## Notes
This is intentionally a lightweight Version 1, designed to be easy to understand, maintain, and deploy to GitHub Pages without any paid services or infrastructure.
