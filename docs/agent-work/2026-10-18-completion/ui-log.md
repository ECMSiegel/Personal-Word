# T4 UI evidence

Status: implementation complete; root's acceptance runs passed.

## Baseline and fail-first

Root ran the planned browser command against the unchanged UI source with the new `tests/accessibility.spec.ts`. The first test failed at the intended assertion: `expect(listbox).toBeFocused()` received `inactive`. Playwright saved the failure at `node_modules/.cache/personal-word-completion/accessibility-dropdown-lis-28d57-s-it-on-Escape-or-selection/error-context.md`. This demonstrated that the old button retained focus while `aria-activedescendant` was attached to it, rather than using a focusable listbox.

The initial run did not reach later assertions: the follow-on interaction waited on the unfocused listbox until the run ended. The first fallback attempt also ended before reaching its control because the compact toolbar moved Page view into More formatting. The test now opens More formatting when the target control is overflowed and uses page-level keyboard input after asserting listbox focus. The planned command must be rerun against the source implementation.

## Changes

- `src/components/Dropdown.tsx` moves focus into a focusable listbox, places `aria-activedescendant` on that listbox, keeps arrow/Home/End/typeahead behavior, restores trigger focus after Escape or selection, and allows Tab to continue out of the menu.
- `src/components/dropdown.css` bounds menu dimensions to the viewport, allows long labels to wrap, and adds visible keyboard focus. Runtime placement selects an available side above or below and left or right of the trigger.
- `src/Writer.tsx` extracts page-footnote measurement into `useFootnoteLayout` and displays a keyboard-operable continuous-view fallback when measured notes exceed the page reserve.
- `src/editor/useFootnoteLayout.ts` retains the existing editor instance, reserve calculation, three-pass page reassignment, resize/update/font listeners, and cleanup while reporting overlong page notes.
- `src/editor/editor.css` gives compact toolbar controls 32px hit areas and focus outlines, and styles the footnote overflow fallback.
- `tests/accessibility.spec.ts` covers focus ownership, active option updates, Home/End/typeahead, Escape/select, Tab, viewport bounds at 850×600 in light/dark with reduced motion, editor DOM identity and undo after layout measurement, and keyboard use of the long-footnote fallback.

## Validation

- Baseline: first focus assertion failed for the expected accessibility defect, as described above. The subsequent baseline run was incomplete because later actions waited on an unfocused listbox.
- Acceptance: `npm run test:e2e -- --workers=1` passed 37/37, including all four accessibility scenarios, both dropdown keyboard cases, and the toolbar overflow and page-layout scenarios. An earlier extended run of the five UI-related spec files passed 18/18.
- Native WebKit/VoiceOver behavior is not evidenced by the browser suite and remains for owner confirmation.
