# Screenshots Guide

## Required Screenshots for Landing Page

Capture these screenshots from the production app with demo data to showcase features on the landing page.

### 1. Squad Dashboard (`squad-dashboard.png`)
**Route:** `/squads/[squad-id]`

**What to capture:**
- Full roster view with 8-10 demo swimmers
- Attendance statistics card showing recent practice attendance
- Recent sessions list with dates and workout previews
- Squad details header with squad name and swimmer count
- Performance metrics or quick stats if visible

**Screenshot specs:**
- Capture at: 1600x1000px
- Crop to: 800x500px
- Format: PNG
- Save as: `squad-dashboard.png`

**Demo data setup:**
- Create a squad named "Demo Elite Squad" or similar
- Add 8-10 swimmers with varied names and ages
- Add a few recent training sessions
- Ensure UI looks polished and populated

---

### 2. AI Coach Interface (`ai-coach.png`)
**Route:** `/ai-coach`

**What to capture:**
- Left panel with prompt textarea filled with sample workout request
  - Example prompt: "Generate a 3000m freestyle endurance workout for advanced high school swimmers focusing on aerobic development"
- Right panel displaying a generated workout with:
  - Properly formatted sets (e.g., "8 x 100 @ 1:30 Free")
  - Warm-up, main set, and cool-down sections
  - Total distance calculation
- "Generate Workout" button visible

**Screenshot specs:**
- Capture at: 1600x1000px
- Crop to: 800x500px
- Format: PNG
- Save as: `ai-coach.png`

**Demo data setup:**
- Generate a sample workout using AI
- Ensure workout is well-formatted and professional looking
- Show clear sections and proper swimming nomenclature

---

### 3. Analytics & FINA Points (`analytics-fina.png`)
**Route:** Swimmer detail page with analytics view

**What to capture:**
- Performance chart showing FINA points over time (line or bar chart)
- Best times table with multiple events showing:
  - Event name (e.g., "100 Free", "200 IM")
  - Best time
  - FINA points value
  - Date achieved
- Improvement percentage cards or metrics
- Clean, data-rich visualization

**Screenshot specs:**
- Capture at: 1600x1000px
- Crop to: 800x500px
- Format: PNG
- Save as: `analytics-fina.png`

**Demo data setup:**
- Add multiple best times for a demo swimmer
- Ensure FINA points are calculated and displaying
- Show upward trend in performance if possible
- Include 4-6 different events for variety

---

### 4. Training Calendar (`training-calendar.png`)
**Route:** `/calendar`

**What to capture:**
- Week view or month view of training calendar
- Multiple training sessions scheduled across different days
- Session cards showing:
  - Date and time
  - Workout name or preview
  - Squad assignment
  - Session type (e.g., "Morning Practice", "Evening Workout")
- Sidebar with upcoming sessions list if available
- Clean, organized calendar layout

**Screenshot specs:**
- Capture at: 1600x1000px
- Crop to: 800x500px
- Format: PNG
- Save as: `training-calendar.png`

**Demo data setup:**
- Create training schedules for multiple days
- Add variety: morning/evening, different workout types
- Ensure calendar view is populated but not cluttered
- Show at least 5-7 sessions across the week

---

## Capture Instructions

### Tools:
- **Windows:** Snipping Tool, Snip & Sketch, or PrtScn
- **Mac:** Cmd+Shift+4 for selective screenshot
- **Browser DevTools:** Adjust viewport to exact dimensions (1600x1000)

### Process:
1. Set browser window to 1600x1000px using DevTools Device Toolbar
2. Navigate to the specified route
3. Ensure demo data is loaded and visible
4. Take full-page screenshot
5. Crop to 800x500px focusing on the most important UI elements
6. Save with exact filename in this directory

### Image Optimization:
After capturing, optimize PNGs:
```bash
# Using ImageOptim (Mac) or TinyPNG (Web)
# Reduce file size while maintaining quality
# Target: <200KB per image
```

### Quality Checklist:
- [ ] Sharp, clear text (no blurry fonts)
- [ ] Realistic demo data (no "test" or placeholder text)
- [ ] Consistent UI theme across all screenshots
- [ ] No visible errors or console warnings
- [ ] Professional appearance (production-ready)
- [ ] Adequate whitespace and visual hierarchy

---

## Placeholder Images (Temporary)

Until real screenshots are captured, gray placeholder boxes are displayed with the feature icon and filename text.

To replace placeholders, simply add the PNG files to this directory with the exact filenames listed above.

---

## Future Screenshots (Optional)

Additional screenshots that could enhance the landing page:

- `attendance.png` - Attendance tracking interface
- `workout-library.png` - Workout library browse view
- `time-standards.png` - Time standards comparison table
- `coach-network.png` - Coach network/connections page

These can be added later to expand the feature showcase section.
