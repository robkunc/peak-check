
# Sierra Club Peak Conditions Assistant  
Version: 0.1 – Requirements & Architecture (Next.js + Firecrawl)

---

## 1. Overview

The **Sierra Club Peak Conditions Assistant** is a small internal web application for Sierra Club outing leaders in Southern California. It aggregates current information about ~250 peaks from multiple online sources and from leader-submitted notes, and presents a simple, easy-to-read “conditions” page per peak.

Instead of writing traditional HTML scrapers by hand, the system will use an **AI-based scraping service (e.g., Firecrawl)** to fetch and structurally summarize content from configured URLs (land manager pages, road status pages, etc.).

The app will be built using **Next.js** and deployed as a small, internal tool for a limited set of users (~30 leaders).

---

## 2. Goals

### 2.1 Primary Goals (MVP)

1. Maintain a **catalog of SoCal peaks** (name, region, GPS, etc.).  
2. For each peak, **aggregate conditions data** from multiple sources:
   - NOAA weather (by GPS)
   - Land manager sites (NPS, USFS, etc.)
   - Road status (Caltrans or similar)
   - Manual leader notes
   - (Optional/MVP+) Trail info summary from AllTrails (only if ToS allows)
3. Provide a **simple “Conditions” page per peak**, with:
   - Human-readable summaries
   - Clear source labels
   - “Last updated” timestamps per data source
4. Allow **leaders to submit manual notes** (trip reports) per peak.
5. Use **Firecrawl (or a similar AI-based scraping service)** to:
   - Periodically fetch content from configured URLs
   - Return structured text that we can parse/summarize into status objects

### 2.2 Non-Goals (MVP)

- No public-facing consumer app; this is an internal tool for leaders.
- No complex ML prediction engine in v1 (simple rule-based hints only, if any).
- No turn-by-turn route navigation or GPX management.
- No full-featured forum/message board.

---

## 3. Users & Roles

### 3.1 Personas

**Sierra Club Outing Leader**  
- ~30 users, generally older and not very tech-savvy.  
- Needs a quick way to check whether a given peak is accessible and reasonable for an outing.

**Admin**  
- Small subset (e.g., 1–3 users, including the maintainer and the developer).  
- Manages peaks, configures URLs for sources, and handles basic data hygiene.

### 3.2 Roles & Permissions

- **Leader**
  - View all peaks and conditions.
  - Add manual notes for a peak.
- **Admin**
  - All leader capabilities.
  - CRUD operations on peaks.
  - Configure source URLs / IDs per peak.
  - Trigger manual refresh jobs for a peak (optional/MVP+).

---

## 4. Functional Requirements

### 4.1 Peak Catalog

- The system SHALL maintain a list of peaks with:
  - Name
  - Short identifier / slug
  - Region (e.g., San Gabriels, San Bernardinos, etc.)
  - GPS coordinates (lat/lng)
  - Optional notes or metadata (e.g., typical trailhead)
- The system SHALL allow admins to:
  - Create new peaks
  - Edit existing peaks
  - Archive/remove peaks (soft delete recommended)

### 4.2 Conditions View Per Peak

For each peak, the **Conditions** page SHALL display:

1. **Basic Info**
   - Peak name, region, GPS coordinates
2. **Weather Summary (NOAA)**
   - Current conditions and short-term forecast
   - Source label (NOAA)
   - Last updated timestamp
3. **Land Manager Status**
   - Extracted from one or more land manager URLs (NPS, USFS, etc.)
   - Parsed/summarized status (e.g., “Trail open”, “Area closed due to fire”, “Special restrictions”)
   - Source label(s)
   - Last updated timestamp(s)
4. **Road Status**
   - Status summary for key access roads (e.g., open, closed, chains required)
   - Source label (e.g., Caltrans)
   - Last updated timestamp
5. **Manual Leader Notes**
   - List of notes with:
     - Author name
     - Text
     - Timestamp
   - Ordered with most recent first.

UI requirements:

- Conditions must fit on a single scrollable page with clear sections.
- All technical jargon should be minimized; use plain language sections and labels.

### 4.3 Manual Notes

- Leaders SHALL be able to submit notes for a peak from the conditions page.
- Required fields:
  - Peak (implicit from context)
  - Text (free-form)
- Automatically stored:
  - Author (from authenticated user)
  - Timestamp
- Notes SHALL be visible to all authenticated users.

### 4.4 Admin Configuration

Admins SHALL be able to configure for each peak:

- One or more **land manager URLs** (NPS/USFS/etc.).
- One or more **road status URLs** or identifiers (e.g., Caltrans pages).
- Optional: **trail info URL** (e.g., AllTrails) if allowed.

Admins SHALL be able to view the last ingestion status (e.g., last Firecrawl call result, last successful parse).

### 4.5 Data Refresh / Sync

- The system SHALL periodically refresh data from:
  - NOAA (direct API)
  - Land manager URLs (via Firecrawl)
  - Road status URLs (via Firecrawl)
- Refresh frequency (initial suggestion):
  - NOAA: hourly or every 3 hours
  - Land manager pages: every 3–6 hours
  - Road status pages: every 1–3 hours
- The system SHALL store “last successful fetch” for each source per peak.
- If a refresh fails, the system SHALL:
  - Keep and display the last known data.
  - Optionally display a small warning like “Unable to refresh since [timestamp].”

---

## 5. Non-Functional Requirements

- **Usability:** Very simple UI, large clickable targets, high contrast, minimal clutter.
- **Reliability:** The app should continue to function even if Firecrawl or a single data source is temporarily unavailable.
- **Performance:** Peak conditions page loads in ~1–2 seconds under normal conditions.
- **Security:** Role-based access; no anonymous editing. Maintain basic auditability for notes.
- **Compliance:** Respect external site ToS; where necessary, fall back to manual notes if scraping is not allowed.

---

## 6. Tech Stack

- **Frontend / Backend:** Next.js (App Router)
- **Language:** TypeScript
- **Database:** Postgres (via Prisma) or MongoDB (via Mongoose). This spec assumes Prisma/Postgres, but can be adapted.
- **Auth:** NextAuth or similar; use low-friction login (e.g., email link, or Google/Microsoft if aligned with Sierra Club usage).
- **AI Scraping:** Firecrawl (or comparable AI-based scraping API) for structured extraction from arbitrary URLs.
- **Deployment:** Vercel (for the Next.js app) + scheduled jobs (Vercel Cron) or an external worker for background tasks.

---

## 7. High-Level Architecture

### 7.1 Main Components

1. **Next.js App (UI + API Routes)**
   - Serves pages for:
     - Peak list
     - Peak conditions
     - Admin peak management
   - Contains API routes / route handlers for:
     - CRUD on peaks
     - CRUD on notes
     - Aggregated conditions endpoint

2. **Database Layer**
   - Stores peaks, users, notes, and snapshot data from sources.

3. **Background Job Layer**
   - Cron-triggered tasks calling internal APIs / functions that:
     - Call NOAA directly
     - Call Firecrawl to scrape configured URLs
     - Parse and persist results

4. **External Services**
   - NOAA API
   - Firecrawl API
   - (Indirectly) land manager and road status sites, via Firecrawl

### 7.2 Data Flow Example – Land Manager Status

1. Cron triggers a job (e.g., `/api/jobs/refresh-land-status`).
2. Job fetches all peaks that have land manager URLs configured.
3. For each URL:
   - Call Firecrawl API with the URL and desired extraction options (e.g., “extract main content as text”).
   - Receive cleaned text / structured JSON.
   - Run a small parser / heuristic on our side to extract key status signals (e.g., “Closed”, “Open”, “Restrictions”).
   - Store the result in a `LandManagerStatusSnapshot` table with `fetched_at` timestamp.
4. When the user opens `/peaks/[id]`, Next.js fetches the latest snapshot per source and renders the conditions page.

### 7.3 Data Flow Example – Road Status

Same as above, but with road status URLs and a parser tuned to typical patterns like “Chains required”, “Road closed”, “One lane”, etc.

---

## 8. Data Model (Proposed – Prisma/SQL-flavored)

This is conceptual and can be translated into an actual Prisma schema.

```sql
TABLE users (
  id              UUID PRIMARY KEY,
  name            TEXT,
  email           TEXT UNIQUE,
  role            TEXT CHECK (role IN ('leader', 'admin')),
  external_auth_id TEXT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

TABLE peaks (
  id              UUID PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  region          TEXT,
  gps_lat         DOUBLE PRECISION,
  gps_lng         DOUBLE PRECISION,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

TABLE peak_sources (
  id              UUID PRIMARY KEY,
  peak_id         UUID REFERENCES peaks(id) ON DELETE CASCADE,
  source_type     TEXT CHECK (source_type IN ('land_manager', 'road_status', 'trail_info')),
  label           TEXT,   -- e.g., "Angeles NF Current Conditions"
  url             TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

TABLE weather_snapshots (
  id              UUID PRIMARY KEY,
  peak_id         UUID REFERENCES peaks(id) ON DELETE CASCADE,
  source          TEXT DEFAULT 'NOAA',
  raw_json        JSONB,
  summary_text    TEXT,
  fetched_at      TIMESTAMPTZ NOT NULL
);

TABLE land_status_snapshots (
  id              UUID PRIMARY KEY,
  peak_id         UUID REFERENCES peaks(id) ON DELETE CASCADE,
  peak_source_id  UUID REFERENCES peak_sources(id) ON DELETE CASCADE,
  raw_text        TEXT,
  status_summary  TEXT,   -- e.g., "Trail open", "Area closed due to fire"
  status_code     TEXT,   -- e.g., "open", "closed", "restricted"
  fetched_at      TIMESTAMPTZ NOT NULL
);

TABLE road_status_snapshots (
  id              UUID PRIMARY KEY,
  peak_id         UUID REFERENCES peaks(id) ON DELETE CASCADE,
  peak_source_id  UUID REFERENCES peak_sources(id) ON DELETE CASCADE,
  raw_text        TEXT,
  status_summary  TEXT,   -- e.g., "Road open", "Chains required"
  status_code     TEXT,   -- e.g., "open", "closed", "chains_required"
  fetched_at      TIMESTAMPTZ NOT NULL
);

TABLE manual_notes (
  id              UUID PRIMARY KEY,
  peak_id         UUID REFERENCES peaks(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  text            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. Firecrawl Integration Design

### 9.1 Conceptual Usage

For each configured URL (land manager or road status):

1. The backend calls Firecrawl with:
   - Target URL
   - Optional instructions or mode:
     - e.g., “extract main body text as markdown”, or
     - “return structured JSON if possible”
2. Firecrawl returns cleaned text / parsed structure.
3. The backend runs a **lightweight parser** to:
   - Identify keywords like “closed”, “open”, “restricted”, “chains required”.
   - Map them into `status_code` and `status_summary` fields.
4. The result is stored as a snapshot row in the database.

### 9.2 Firecrawl Call (Pseudo-Code)

> Note: This is **conceptual**; exact Firecrawl API parameters should be updated based on official documentation.

```ts
async function fetchWithFirecrawl(url: string): Promise<{ rawText: string }> {
  const res = await fetch("https://api.firecrawl.example/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      mode: "extract_main_text", // adjust per real API
    }),
  });

  if (!res.ok) {
    throw new Error(`Firecrawl error for ${url}: ${res.status}`);
  }

  const data = await res.json();
  return { rawText: data.text ?? "" };
}
```

### 9.3 Simple Status Parsing (Example)

```ts
function inferStatusFromText(rawText: string): { statusCode: string; summary: string } {
  const text = rawText.toLowerCase();

  if (text.includes("closed") || text.includes("closure")) {
    return {
      statusCode: "closed",
      summary: "Closed (see source for details).",
    };
  }

  if (text.includes("chains required") || text.includes("chains are required")) {
    return {
      statusCode: "chains_required",
      summary: "Chains required on access roads.",
    };
  }

  if (text.includes("open")) {
    return {
      statusCode: "open",
      summary: "Open (see source for details).",
    };
  }

  return {
    statusCode: "unknown",
    summary: "Status unclear; please read source for details.",
  };
}
```

---

## 10. API Design (High-Level)

Using Next.js route handlers under `/app/api`.

### 10.1 Peaks

- `GET /api/peaks`
  - Returns list of peaks (for the peak list page and dropdowns).
- `POST /api/peaks` (admin)
  - Create a new peak.

- `GET /api/peaks/[id]`
  - Returns details of a single peak (basic info).

- `PATCH /api/peaks/[id]` (admin)
  - Update peak details.

- `DELETE /api/peaks/[id]` (admin)
  - Soft delete or archive a peak.

### 10.2 Sources (PeakSource)

- `GET /api/peaks/[id]/sources` (admin)
  - List configured sources for the peak.
- `POST /api/peaks/[id]/sources` (admin)
  - Add a new source (land_manager, road_status, trail_info).
- `PATCH /api/sources/[sourceId]` (admin)
  - Update a source.
- `DELETE /api/sources/[sourceId]` (admin)
  - Delete a source.

### 10.3 Conditions

- `GET /api/peaks/[id]/conditions`
  - Returns aggregated data:
    - Latest weather snapshot
    - Latest land manager status snapshots
    - Latest road status snapshots
    - Recent manual notes

### 10.4 Manual Notes

- `GET /api/peaks/[id]/notes`
  - Returns list of notes (paginated).
- `POST /api/peaks/[id]/notes`
  - Create a new note for the peak (leader or admin).

### 10.5 Jobs (Internal / Cron)

These endpoints should be **protected** (e.g., by a secret token or restricted host).

- `POST /api/jobs/refresh-weather`
- `POST /api/jobs/refresh-land-status`
- `POST /api/jobs/refresh-road-status`

Each job processes all peaks (or a subset) and stores snapshots.

---

## 11. Frontend Pages & UX

### 11.1 `/peaks` – Peak List

- Displays a searchable list of peaks:
  - Name
  - Region
  - Basic metadata
- Clicking a peak goes to `/peaks/[slug]` (conditions page).

### 11.2 `/peaks/[slug]` – Conditions Page

Sections:

1. Header with peak name, region, GPS.  
2. Weather summary panel:  
   - Key info: conditions, temp, maybe icons, last updated timestamp.  
3. Land manager status panel:  
   - Summarized status and last updated; link to source.  
4. Road status panel:  
   - Summarized status and last updated; link to source.  
5. Manual notes panel:  
   - List of notes, newest first.  
   - Form to add a new note (text area + submit).  

UI style: large fonts, high contrast, minimal text blocks, simple language.

### 11.3 `/admin/peaks` – Admin Peak Management

- Table of peaks with:
  - Name, region, active status, edit button.
- “Create peak” button.

### 11.4 `/admin/peaks/[slug]` – Admin Peak Config

- Form for editing peak basic info.
- List of sources with:
  - Type (land_manager, road_status, trail_info)
  - Label
  - URL
  - Edit/delete buttons
- Button to “Add source”.
- Optional button to trigger immediate refresh for that peak.

---

## 12. Authentication & Authorization

- Use **NextAuth** or equivalent.
- Auth options:
  - Email magic link (simplest, but requires users to manage email-based login).  
  - Google/Microsoft OAuth if Sierra Club users already have standard accounts.  
- Role is stored in the `users` table (`leader`, `admin`).
- Middleware in Next.js protects:
  - All `/admin` routes → requires `admin` role.
  - All `/peaks` and `/api/peaks/*` routes → requires authenticated user.

---

## 13. Implementation Roadmap

### Phase 1 – Foundation

- Set up Next.js project (TypeScript, App Router).
- Configure database (Prisma + Postgres).
- Implement `users` and `peaks` models and basic CRUD.
- Implement auth with NextAuth and role handling.

### Phase 2 – Conditions & Manual Notes

- Implement `manual_notes` model and API.
- Build `/peaks` list page.
- Build `/peaks/[slug]` conditions page showing:
  - Peak info
  - Manual notes
- Implement manual note creation from UI.

### Phase 3 – Weather Integration

- Implement NOAA integration (direct API).
- Add `weather_snapshots` model.
- Add background job to fetch and store weather snapshots.
- Render weather summary on conditions page.

### Phase 4 – Firecrawl Integration (Land Manager & Road Status)

- Implement `peak_sources`, `land_status_snapshots`, `road_status_snapshots` models.
- Implement Firecrawl integration code.
- Implement background jobs for:
  - Land manager status
  - Road status
- Render land and road panels on conditions page.

### Phase 5 – Admin Screens & Polish

- Implement `/admin/peaks` and `/admin/peaks/[slug]` pages.
- Add controls for sources.
- Improve UX, error handling, and status indicators.
- Add basic logging / monitoring for jobs.

### Phase 6 – Optional Enhancements

- Simple rule-based “hints” (e.g., likely snow) based on weather + notes.
- Email or in-app notifications for major changes to selected peaks.
- Fine-tune Firecrawl prompts/config for better extraction.

---

## 14. Notes for Cursor AI Usage

- Treat this file as the main **spec** for the project.
- When asking Cursor’s agent to scaffold code, reference specific sections:
  - Example: “Implement the database schema from section 8 using Prisma.”
  - Example: “Implement the `/peaks/[slug]` conditions page as described in section 11.2.”
- Keep this document updated as implementation decisions solidify (e.g., confirm auth provider, database choice, and Firecrawl API details).
