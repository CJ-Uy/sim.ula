# SimBayan — Urban Policy Simulation Platform
## Claude Code Implementation Prompt

Build a single-page React app (Vite + React + Tailwind CSS) for an urban policy simulation platform called **SimBayan**. This is a hackathon prototype — all data is hardcoded, no backend.

---

## Design Philosophy

**Minimalist. Lots of whitespace. Let the data breathe.**

Think: gov.uk meets Stripe's documentation. Clean, typographic, quietly confident. No decoration for decoration's sake. Every element earns its space.

- **Light theme.** Off-white background (`#FAFAF9`), near-black text (`#1C1917`), stone grays for secondary elements.
- **One accent color only:** `#0D9488` (teal-600). Used sparingly — CTAs, active states, the score gauge. Nothing else gets color except the three dimension indicators (blue `#2563EB`, green `#16A34A`, amber `#D97706`) which appear only on the results screen.
- **Typography:** Import `"Source Serif 4"` (Google Fonts) for headings. Use system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) for body. No decorative fonts.
- **No shadows, no gradients, no rounded-xl cards, no noise textures.** Use borders (`#E7E5E4`) sparingly. Spacing and typography do all the work.
- **Animations:** Minimal. Subtle opacity fades (200-300ms) on screen transitions. No bouncing, no sliding, no staggered reveals. The loading stepper is the one exception where animation matters.

---

## Project Structure

```
simbayan/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx
    ├── index.css
    ├── App.jsx
    ├── components/
    │   ├── PolicyInput.jsx      # Screen 1
    │   ├── SimulationLoading.jsx # Screen 2
    │   ├── SimulationResults.jsx # Screen 3
    │   ├── ScoreGauge.jsx        # SVG circular gauge
    │   ├── DimensionCard.jsx     # Reusable impact card
    │   ├── TimelineStep.jsx      # Single timeline milestone
    │   └── StakeholderCard.jsx   # Persona quote card
    └── data/
        └── mockResults.js        # All hardcoded simulation data
```

---

## Screen 1: Policy Input

Centered column, max-width 640px. Generous top padding (20vh on desktop).

**Elements top to bottom:**

1. **Title:** "SimBayan" in Source Serif 4, 2rem, font-weight 600. Below it in small muted text: "Urban policy simulation for Quezon City". That's it for branding — no logos, no taglines, no decorative elements.

2. **Textarea:** Clean, border-bottom only (no full border box), 5 rows. Placeholder: "Describe your policy proposal..." — Focus state: border-bottom turns teal. Character count bottom-right, muted, only visible when typing. Max 1000 chars.

3. **Category selector:** Label "Category" in small caps tracking-wide muted text. Below it, a single row of text-only buttons (not pills, not chips — just text with an underline on the selected one). Options:
   - Waste Management
   - Green Infrastructure
   - Transportation
   - Housing
   - Water & Flood Control
   - Energy

   Default: none selected. Selected state: teal text + thin teal underline. Unselected: muted gray text.

4. **Location input:** Label "Location (optional)" same style as category label. Simple text input, border-bottom only, placeholder "e.g., Barangay Commonwealth".

5. **Submit button:** "Run Simulation →" — Text-only style, teal colored, no background, no border. On hover: underline. Disabled until textarea > 20 chars AND a category is selected. Disabled state: gray text, no pointer.

6. **Footer note:** Tiny muted text at the bottom: "Simulates impact across economic, environmental, and social dimensions using historical policy data."

**No cards, no icons, no emoji on this screen.** Pure typography.

---

## Screen 2: Simulation Loading

Centered, max-width 480px, vertically centered in viewport.

1. **User's policy text** shown at top in italics, muted, truncated to 120 chars with ellipsis if longer.

2. **Stepper:** Five lines of text, stacked vertically with 1.5rem gap. No icons, no circles, no connecting lines. Just text.

   ```
   Retrieving relevant policy cases     ✓
   Analyzing economic impact             ✓
   Simulating environmental outcomes     ✓
   Evaluating social effects             ·  ← currently active
   Computing sustainability score
   ```

   - Completed steps: black text + a simple checkmark (✓) right-aligned
   - Active step: black text + a small pulsing dot (·) right-aligned, or a simple CSS spinner (just a small rotating border)
   - Pending steps: muted gray text, nothing right-aligned

   Steps complete one by one, ~1.2 seconds apart. Total loading time: ~6 seconds. After all complete, pause 0.5s, then transition to Screen 3.

3. **Below the stepper:** Small muted text "Analyzing against 73 historical cases" — static, no animation.

---

## Screen 3: Simulation Results

Single scrollable column, max-width 720px, centered. Sections separated by generous whitespace (4-5rem between sections). Use thin horizontal rules (`<hr>`) between major sections — 1px, `#E7E5E4`.

### Section A — Header

- Small muted label: "SIMULATION RESULTS" in small caps, tracking-wide
- User's policy text as a blockquote — left border 2px teal, left padding, body text
- Below: category as plain text label + "March 28, 2026" as date, both muted, on same line separated by a middot (·)

### Section B — Sustainability Score

- The number "72" displayed huge (6rem, Source Serif 4, font-weight 700)
- Directly below: "/100" in smaller muted text
- Below that: thin horizontal bar (full width, 4px tall). Background: `#E7E5E4`. Filled portion: teal, width animated from 0 to 72% on mount over 1 second with ease-out.
- Below the bar: one sentence in muted text: "Strong environmental potential with moderate economic considerations."

**No donut chart, no circular gauge.** Just the number and a bar. Minimalism means the number IS the visual.

### Section C — Impact Dimensions

Three blocks stacked vertically (NOT side-by-side cards). Each block:

```
Economic Impact                                      65/100
───────────────────────████████████░░░░░░░ (blue bar)

· Estimated ₱2.3M annual savings in landfill costs
· 12-15 new direct jobs created within the facility
· Moderate initial capital expenditure of ~₱18M required
```

Structure per block:
- Dimension name (left) and score (right) on the same line, body weight
- Thin progress bar below (same style as sustainability bar but using dimension color)
- Three findings as a plain list with middot (·) bullets, muted text, compact line height

Dimensions and their data:

**Economic Impact** — Score: 65, Color: `#2563EB`
- Estimated ₱2.3M annual savings in landfill costs
- 12-15 new direct jobs created within the facility
- Moderate initial capital expenditure of ~₱18M required

**Environmental Impact** — Score: 82, Color: `#16A34A`
- Projected 30% reduction in barangay-level waste to landfill
- Decreased methane emissions equivalent to 450 tons CO₂/year
- Positive downstream effects on Marikina River watershed

**Social Impact** — Score: 68, Color: `#D97706`
- Community health improvement from reduced open waste burning
- Initial NIMBY resistance expected from nearby residential zones
- Potential model for barangay-level waste entrepreneurship

Separate each dimension block with 2rem spacing. No cards, no borders, no background colors.

### Section D — Projected Timeline

Label: "PROJECTED TIMELINE" in small caps, tracking-wide, muted.

Three blocks, each structured as:

```
1 Month — Setup
Site assessment complete. Community consultations initiated.
Initial resistance from 2 adjacent barangays.

6 Months — Operational
MRF processing 12 tons/day at 60% capacity.
8 jobs filled. First revenue from recyclable sales.

1 Year — Scaling
Full 20 ton/day capacity reached. Waste diversion rate at 28%.
Adjacent barangays requesting replication.
```

- Timeframe in bold + phase name after an em dash, same line
- Description in muted body text below
- Vertical spacing between each block, nothing else (no lines, no connectors, no icons)

### Section E — Stakeholder Perspectives

Label: "STAKEHOLDER PERSPECTIVES" in small caps, tracking-wide, muted.

Three blocks, each structured as:

```
Community Supporter
"This is exactly what Commonwealth needs. We've been burning
trash for years. My kids can finally play outside."

Concerned Resident
"I support waste management but not next door. Truck traffic
and smell worry me. Will there be a complaints mechanism?"

Local Business Owner
"If the MRF buys sorted recyclables, this could create a supply
chain for my packaging business."
```

- Persona name in semibold
- Quote in italics, muted, with quotation marks
- No avatars, no icons, no colored backgrounds

### Section F — Actions

At the end of the report, after generous whitespace:

Two links side by side (not buttons — just styled text links):

- "← Simulate another policy" (teal, on click: resets all state, returns to Screen 1)
- "Export as PDF" (muted gray, non-functional for now)

---

## Data File: `src/data/mockResults.js`

Export a single object containing all the hardcoded results data — sustainability score, three dimension scores + findings, timeline milestones, stakeholder quotes. Components import from here. This makes it trivial to swap in real API data later.

---

## Implementation Notes for Claude Code

1. **Initialize with:** `npm create vite@latest simbayan -- --template react` then install Tailwind following official Vite+Tailwind docs.

2. **State management:** Single `useState` in App.jsx tracking `{ screen: 'input' | 'loading' | 'results', policy: '', category: '', location: '' }`. Pass state down as props. No context, no reducer, no state library.

3. **Screen transitions:** Simple conditional rendering in App.jsx with CSS opacity transition. Wrap each screen in a div that fades in.

4. **Loading screen timer:** `useEffect` in SimulationLoading.jsx that runs a sequence of `setTimeout` calls to advance through the 5 steps, then calls `onComplete()` prop to advance to results.

5. **Score bar animation:** Use a `useEffect` + `useState` pattern. Start width at 0%, set to target% after a short delay. CSS `transition: width 1s ease-out` on the bar element.

6. **Google Font:** Add `<link>` tag in `index.html` head for Source Serif 4 (weights 400, 600, 700).

7. **Tailwind config:** Extend with the custom colors (teal accent, stone backgrounds, dimension colors). Use Tailwind's `stone` palette for grays.

8. **Keep it simple.** If you're reaching for a library, you probably don't need it. Zero dependencies beyond React, Vite, and Tailwind.

9. **Test the full flow:** Input → Loading → Results → "Simulate another" → back to Input with cleared state.

---

## What This Should Feel Like

Open a quality print magazine — a long-form article in Monocle or a policy brief from Brookings Institution. Quiet confidence. No visual noise. The content is the interface. White space is the design. Typography is the hierarchy. Color is used like punctuation — rarely, and only when it means something.
