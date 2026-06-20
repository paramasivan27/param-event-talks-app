# BigQuery Release Notes Explorer & Poster

A lightweight, modern web application that aggregates, categorizes, and formats Google Cloud BigQuery release notes into draft social media updates (tweets/posts) for Twitter/X.

---

## Features

- **Live RSS Sync**: Fetches the official Google Cloud BigQuery RSS feed XML in real time.
- **Granular Update Parsing**: Splices composite monthly/weekly feed entries into distinct update cards (by splitting on nested `<h3>` headings).
- **Auto-Categorization**: Tags updates dynamically into standard classes: `Feature`, `Announcement`, `Deprecation`, and `Fix`.
- **Filtering & Search**: Instantly filters updates by category or searches across all note details via keyword matching.
- **Tweet Composer**: 
  - Dynamic character counter with a visual circular progress ring.
  - Auto-generated tweet template layout based on update details.
  - Quick-toggle tags list (e.g., `#BigQuery`, `#GoogleCloud`).
  - Text truncation protection to keep tweets within the 280-character limit.
  - Quick buttons to copy the draft or share directly to Twitter/X.
- **Premium Styling**: Responsive, modern dark-themed interface built using curated HSL color tokens and micro-interactions.

---

## File Structure

- [`app.py`](file:///Users/paramasivandorai/agy-cli-projects/app.py): Core Flask server logic, XML fetcher, and proxy API endpoint.
- [`templates/index.html`](file:///Users/paramasivandorai/agy-cli-projects/templates/index.html): Page markup and UI outline.
- [`static/app.js`](file:///Users/paramasivandorai/agy-cli-projects/static/app.js): DOM manipulation, client-side feed parsing, state management, and character layout tracking.
- [`static/style.css`](file:///Users/paramasivandorai/agy-cli-projects/static/style.css): Main CSS variables, typography, layout styling, and transition styles.
- [`.gitignore`](file:///Users/paramasivandorai/agy-cli-projects/.gitignore): Excludes build artifacts, caches, virtual environments, and IDE workspace configs from Git.

---

## Quick Start

### 1. Prerequisites
Make sure you have **Python 3** installed.

### 2. Set Up a Virtual Environment (Recommended)
From the project root directory, run:
```bash
# Create a virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate
```

### 3. Install Dependencies
Install Flask:
```bash
pip install Flask
```

### 4. Run the Server
Start the development server:
```bash
python app.py
```
Or use the Flask CLI:
```bash
flask run --port 5000
```

### 5. Access the Application
Open your web browser and navigate to:
[http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## How It Works

1. **Proxy Endpoint**: When the UI calls `/api/release-notes`, Flask requests the XML feed from Google Cloud, parses it into basic JSON structures, and returns it to the client.
2. **Client Parsing**: The browser uses `DOMParser` to parse the content block HTML of each release note. Headings (like `<h3>`) indicate individual updates within a single release entry.
3. **Draft Compilation**: Selecting an update extracts the plaintext text and structures it into a pre-formatted tweet text area.
