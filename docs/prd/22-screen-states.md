# Part 22 — Screen States

Five states, one implementation (`StateView`), used by every module. A single implementation is what stops the twentieth screen from inventing its own empty state.

## Loading

Skeletons shaped like the content they replace — `SkeletonRows` mimics table rows so the page keeps its rhythm and does not jump when data arrives.

App boot shows a branded screen while the seed is built and the follow-up engine runs its catch-up pass. That work is genuinely asynchronous; the screen is honest, not decorative.

Loading regions carry `role="status"` and `aria-live="polite"`.

## Empty

Empty states distinguish two situations that are constantly conflated:

**Nothing exists yet** — explain what will appear here and offer the action that creates the first one.
*"No patients yet. Register the first patient to get started."*

**Nothing matches the filter** — name the query and suggest how to widen it.
*"No patients match 'xyz'. Try a partial name, the patient code, or the last digits of a phone number."*

An empty state that says only "No data" wastes the one moment the user is definitely looking at that region.

Where the empty state is *good news* — no overdue follow-ups — it says so plainly rather than implying something is broken.

## Error

Icon, plain-language cause, and a recovery action. `role="alert"`.

A missing record (a stale deep link) gets a specific message and a route back to the list, not a generic failure — the user's next move is obvious and the screen should offer it.

## Offline

Detected via `navigator.onLine`. A persistent banner appears above the shell: *"You are offline. Changes are saved on this device only."*

The application keeps working — this prototype is local-first, so offline genuinely is a degraded rather than broken state, and the banner says exactly what is degraded rather than blocking the interface.

## Permission denied

Guarded routes **render the denial** rather than redirecting, naming the current role and how to get access.

A silent redirect leaves the user unsure whether they mis-clicked or were refused. Showing the wall is more respectful and, in a prototype whose job is to demonstrate a permission model, it is the only way to see that the model has teeth.

Partial access **degrades content instead of blanking the page**: a receptionist opening a patient record sees the record, with clinical sections replaced by an explanation. The patient is still findable, bookable and contactable.

## Coverage

Every list and detail view wires all five. The design system page renders all five side by side for review in both themes.
