# UI UX Pro Max assessment for Personal Word

Inspected 2026-10-18: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), main branch as retrieved that day. The branch is mutable; no pinned source is vendored and no runtime code/data is copied.

The repository supplies authoring guidance. Its `src/ui-ux-pro-max/scripts/search.py` dispatches CLI arguments to `core.search`, `search_stack`, or `design_system.generate_design_system`; CSV files contain recommendations. This mechanism does not render an editor or validate a running Tauri app. Installing the CLI is unnecessary for this pass.

The [MIT license](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/LICENSE) credits Next Level Builder (2024). This assessment paraphrases general ideas; it includes no substantial source/data copy. Any future code/data reuse needs the appropriate notice and a pinned source reference.

| Useful guidance | Personal Word application | Evidence to collect |
| --- | --- | --- |
| Focus, keyboard navigation, semantic control state | Correct shared Dropdown focus/listbox behavior and App dialogs | Keyboard open/select/Escape/Tab tests and focus assertions |
| Overflow and resilient compact text | Keep menus operable at minimum window size and with long values | Bounding-box/scroll tests, screenshots |
| Platform-specific sizes rather than universal mobile dimensions | Improve desktop control hit areas while retaining compact toolbar | Supported-window checks and visual inspection |
| Reduced motion and light/dark contrast | Preserve existing system preference behavior | Browser preference emulation plus native qualification where possible |
| Avoid duplicate state, clean up subscriptions/timers | Extract layout/dialog responsibilities without another project-state owner | Existing undo/navigation/save tests after extraction |

Sources: [UX guidelines CSV](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/data/ux-guidelines.csv), [React guidance](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/data/stacks/react.csv), [search dispatcher](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/scripts/search.py).

Do not adopt landing-page templates, remote font imports, decorative animation, automatic palette replacement, mobile-first breakpoints, or a new component framework. Personal Word already has specific product rules, local fonts, separate document typography, and a minimum supported desktop window. The reference does not solve persistence, citation correctness, export fidelity, native rendering, or privacy. Automated behavior checks and owner real-use confirmation remain necessary.
