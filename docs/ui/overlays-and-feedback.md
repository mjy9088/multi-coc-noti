# Overlays and Feedback

## Terminology

Use specific component names instead of “popup”:

- **Dialog**: modal task or decision that blocks background interaction.
- **Toast**: brief global feedback that does not block the current task.
- **Popover**: contextual non-modal content anchored to a control; not currently required.

Save results are Toasts. Destructive confirmation and the resource-status question are Dialog compositions. Quick Paste is
primarily a workflow requirement, not a predetermined component: a Dialog is the leading candidate only while it makes the
common import path faster and keeps review information usable.

## Dialog primitive — implemented

Implement the owned API using an accessible headless primitive rather than custom document-level event handling.

Required behavior:

- labelled by a visible title and optional description;
- focus moves to the first required or safest meaningful control;
- focus remains inside while modal;
- Escape closes unless an irreversible mutation is actively pending;
- closing restores focus to the trigger;
- background content is inert and cannot scroll on mobile;
- clicking the backdrop may close only when losing entered data is harmless;
- pending actions cannot be submitted twice;
- narrow screens respect safe areas and leave controls reachable above the software keyboard;
- a bottom sheet with only its top corners rounded sits flush against the viewport bottom; safe-area spacing appears once
  inside its controls rather than as an outer gap or duplicated container padding;
- long Korean and English text wraps without horizontal overflow;
- reduced-motion users do not receive unnecessary entrance/exit animation.

The primitive owns accessibility and overlay mechanics. Feature compositions own copy, form state, mutations, and whether
closing is safe.

## Fast import workflow — implemented product composition

Quick Paste reads the clipboard and opens the shared import workflow in an App Shell-owned Dialog without changing the
current URL. On narrow screens the owned Dialog becomes a near-full-height bottom sheet. The full `/settings/paste` route
uses the same feature state and rendering for deliberate or larger imports.

The workflow is globally available because:

- Quick Paste is available from every route;
- route navigation loses the user's current visual context;
- the App Shell already persists across route changes and is the correct entry/provider boundary;
- import success can refresh cached Dashboard and History data without making Settings the active screen.

Flow:

1. The user activates Quick Paste. This user gesture starts clipboard reading and exposes visible progress immediately.
2. Reading state is visible and announced.
3. If clipboard access fails or content is empty, show a manual Textarea and explicit Review action.
4. Parse and preview using the same feature use case as `/settings/paste`.
5. Show matched/new village, export time, changes, slots, detected upgrades, and validation warnings.
6. Require a Display Name only for a new tag.
7. Import once confirmed. Keep the active composition open with a pending state and prevent duplicate submission.
8. If resource status is required, continue in the same flow rather than stacking another modal over it.
9. On success, finish the transient composition if one is used, restore focus appropriately, invalidate affected queries,
   and show a success Toast.
10. On failure, retain entered/review data and show actionable error feedback in the active composition.

Dialog behavior:

- opening Quick Paste does not change the URL;
- closing it returns to the exact route and scroll context;
- the title stays outside the scrolling region while a long Review scrolls inside the Dialog, keeping the final action
  reachable with pointer, touch, and keyboard input;
- `/settings/paste` remains the full-page import workflow for direct access, troubleshooting, and larger review work;
- transient state is ephemeral and is not restored by reload or browser history.

Use the full route when the preview is too dense, browser history/reload recovery matters, or troubleshooting needs more
space. The transient Dialog remains optimized for the common clipboard path and intentionally does not survive reload.

The fast path and Settings screen share the production import state and rendering; parsing and mutation behavior must not
diverge between the two presentations.

## Other Dialog compositions

### Resource status

Ask only after an import with active upgrades needs notification policy. It can be a step inside Quick Paste or a standalone
Dialog after full-page import. Dismissing it preserves the imported export and leaves the state unanswered.

### Destructive confirmation

Village deletion uses explicit village identity, a danger action, and a non-destructive default focus target. Generic
“Are you sure?” copy is insufficient.

### Complex settings on mobile

Do not turn ordinary Settings pages into Dialogs. Use Dialog only for bounded tasks or decisions; persistent, linkable
configuration remains route content.

## Toast system — implemented and mounted in Dashboard

The Toast provider belongs in the persistent App Shell so feedback survives route-content replacement without moving page
layout.

Required API concepts:

- intent: success, error, warning, information;
- title plus optional description;
- optional action and dismiss control;
- stable ID for replacing/deduplicating feedback;
- duration policy controlled by intent, with an explicit persistent option.

Behavior:

- success and informational Toasts dismiss after a short readable interval;
- error Toasts remain until dismissed or replaced unless the same error is also fully visible in the active form;
- mutation pending state appears at the initiating control, not as a “loading” Toast;
- Toasts never serve as the only location for validation errors or irreversible information;
- new Toasts are announced through an appropriate live region without repeatedly reading the whole viewport;
- keyboard users can reach actions and dismiss controls without focus being stolen on appearance;
- the viewport respects mobile safe areas, the software keyboard, and PWA standalone mode;
- identical repeated events are updated or deduplicated rather than producing an unbounded stack;
- route navigation does not clear feedback prematurely.

Settings mutation feedback now uses the global system for Quick Paste, deletion, group ordering, alert overrides, and
village saving. New features must publish through the same provider rather than introduce a local toast viewport.

## Inline feedback versus Toast

Use inline feedback when it explains or blocks the current control or form:

- validation errors;
- clipboard permission/manual-paste fallback;
- preview/import failure while the active import composition retains data;
- stale cached screen data;
- initial request failure and retry.

Use Toast when the user can continue and needs confirmation across the application:

- settings saved;
- import completed;
- village deleted;
- background refresh failed while valid content remains visible.

Some mutations need both: inline pending/error state for the initiating form and a success Toast after completion.
