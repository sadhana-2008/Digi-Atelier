# PRODUCT REQUIREMENTS DOCUMENT (PRD) - FINAL LOCK
## Project Name: Digital Habitat (V1 MVP)
## Strategy Philosophy: "A Room That Remembers"

---

## 1. SYSTEM ARCHITECTURE & TECH STACK (THB STACK)
- **Frontend Framework:** React (Vite) + Tailwind CSS + Framer Motion
- **Backend Framework:** FastAPI (Python)
- **Database Storage:** SQLite (`database.db`)

---

## 2. SCREEN VIEWS & COMPONENT BOUNDARIES
The viewport consists of ONE single absolute-positioned interface container containing exactly 5 fixed interactive areas:
- `#room-viewport`: Relative parent box filling the screen. Handles the background and contains the custom polygon walls and grid lines.
- `#window-node`: Absolute-positioned indicator displaying weather icons.
- `#isometric-desk`: Absolute-positioned interactive container for the desk. Supports drag-and-drop positioning.
- `#lamp-target`: Static click target on top of the desk.
- `#book-target`: Static click target on top of the desk.
- `#plant-container`: Static state-based asset container on top of the desk.

---

## 3. FUNCTIONAL REQUIREMENTS & RULE LOGIC

### REQ-001: Ambient Atmospheric Toggle (The Lamp)
- **Trigger:** Clicking `#lamp-target` toggles the global state boolean `isNightMode`.
- **Day Mode (`isNightMode == false`):** Apply bright morning colors to the custom polygon walls and floor in `#room-viewport`.
- **Night Mode (`isNightMode == true`):** Apply deep midnight colors to the custom polygon walls and floor in `#room-viewport`.

### REQ-002: Window Environmental Sync (The Window)
- **Behavior:** The `#window-node` reflects the active atmospheric toggle state.
- **Day State:** Render the Sun icon ☀️.
- **Night State:** Render the Moon icon 🌙 and Stars.

### REQ-003: Journal Entry Lifecycle (The Book)
- **Trigger:** Clicking `#book-target` opens a centered React state UI modal.
- **Modal Specifications:** Displays the current date, a standard scrollable `<textarea>`, a "Save" button, and a "Cancel" button.
- **Save Operation:** Submitting triggers an asynchronous HTTP POST request to FastAPI to store the text string.

### REQ-004: State-Based Progression (The Plant)
- **Trigger:** On boot and on journal save, query total row counts from the database.
- **Stage Matrix:**
  - **Stage 1 (Tiny Seed 🌱):** Total row count in database == `0`.
  - **Stage 2 (Small Sprout 🌿):** Total row count in database is between `1` and `4`.
  - **Stage 3 (Big Bush 🌳):** Total row count in database >= `5`.

### REQ-005: Workspace Asset Drag-and-Drop
- **Behavior:** The `#isometric-desk` can be dragged around `#room-viewport` via pointer events.
- **Snapping Rules:** Upon release, the desk snaps to the nearest of the two bottom floor crosshairs (`T-Left` or `T-Right`). It must never snap to the top wall crosshairs (`W-Left` or `W-Right`).

---

## 4. DB STORAGE SCHEMAS (SQLite - UPGRADED)

### Table: `journal_entries` 
- `id` (INTEGER, Primary Key, Autoincrement)
- `date` (TEXT)
- `content` (TEXT)

### Table: `app_settings` 
- `key` (TEXT, e.g., 'theme')
- `value` (TEXT, e.g., 'night')

---

## 5. STRICT BOUNDARY LIMITATIONS (FORBIDDEN)
- ❌ No sliding inventory shelves or furniture shops.
- ❌ No user accounts, logins, cloud sync, or AI assistant integrations.
