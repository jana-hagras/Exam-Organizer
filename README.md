# Exam Organizer 📚

A small, lightweight client-side app to create and manage exam schedules with materials and a checklist for each subject. Data is stored locally in the browser (localStorage), and you can print/export a schedule as PDF.

## Features ✅
- Add/Edit/Delete exams (subject, date, time, question types)
- Add a list of material items per exam and mark each as completed
- Material checklist is synced between the edit form and the exam card
- Sortable schedule view and printable/exportable schedule (print to PDF)
- Responsive UI and accessible interactions (keyboard supported)

## Quick start 🚀
### Run locally
1. Open `index.html` in your browser.
2. Or serve with a small static server (optional):

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000/
```

### Usage
- Click **Add Exam** to create a new exam.
- Click **Edit** on an exam card to modify it — the form will scroll into view and focus for convenience.
- Add materials in the form and mark them done. Changes will reflect live on the corresponding exam card and persist to localStorage.
- Click **Print / Save PDF** to generate a printable schedule.

## Development 🛠️
- Files to edit: `index.html`, `style.css`, `script.js`.
- No build step required; open the files directly in a browser.
- Consider adding a small HTTP server for testing in some browsers.

*Created with ❤️ — feel free to customize this README with screenshots or usage examples.*

