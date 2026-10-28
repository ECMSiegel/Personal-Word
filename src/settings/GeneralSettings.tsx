import type { ReactNode } from "react";
import { Dropdown } from "../components/Dropdown";
import { Segmented } from "../components/Segmented";
import {
  SWATCHES,
  type Appearance,
  type Palette,
  type Theme,
} from "../appearance";

// The General settings block, lifted out of App.tsx unchanged so the same
// element can be shown in the Settings destination and in the dialog the
// Projects screen opens from its gear button. Persistence stays with the
// caller: every handler here is a plain setter.
export function GeneralSettings({
  appearance,
  onAppearance,
  hoverReveal,
  onHoverReveal,
  restoreTabs,
  onRestoreTabs,
  storagePath,
  onShowPath,
  children,
}: {
  appearance: Appearance;
  onAppearance: (appearance: Appearance) => void;
  hoverReveal: boolean;
  onHoverReveal: (value: boolean) => void;
  restoreTabs: boolean;
  onRestoreTabs: (value: boolean) => void;
  storagePath: string | null;
  onShowPath?: (path: string) => void;
  children?: ReactNode;
}) {
  return (
    <>
      <section className="settings-section">
        <h2>General</h2>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={restoreTabs}
            onChange={(e) => onRestoreTabs(e.target.checked)}
          />
          Restore open project tabs at launch
        </label>
        <div className="settings-form">
          <div className="settings-field">
            <span className="settings-label">Appearance</span>
            <Segmented<Theme>
              label="Appearance"
              value={appearance.theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(theme) => onAppearance({ ...appearance, theme })}
            />
          </div>
          <div className="settings-field">
            <span className="settings-label">Palette</span>
            <Segmented<Palette>
              label="Palette"
              value={appearance.palette}
              options={[
                { value: "plain", label: "Plain" },
                { value: "color", label: "Color" },
              ]}
              onChange={(palette) => onAppearance({ ...appearance, palette })}
            />
          </div>
          {appearance.palette === "color" && (
            <div className="settings-field settings-field--wide">
              <span className="settings-label">Section colours</span>
              <div className="section-swatches">
                {(
                  [
                    ["manuscript", "Manuscript colour"],
                    ["fragments", "Fragments colour"],
                    ["research", "Research colour"],
                  ] as const
                ).map(([section, label]) => (
                  <Dropdown
                    key={section}
                    label={label}
                    width="100%"
                    value={appearance.sections[section]}
                    options={SWATCHES.map((swatch) => {
                      const name =
                        swatch[0].toUpperCase() + swatch.slice(1);
                      return {
                        value: swatch,
                        label: name,
                        render: (
                          <span className="swatch-option">
                            <span
                              aria-hidden="true"
                              className="swatch-chip"
                              data-swatch={swatch}
                            />
                            {name}
                          </span>
                        ),
                      };
                    })}
                    onChange={(swatch) =>
                      onAppearance({
                        ...appearance,
                        sections: { ...appearance.sections, [section]: swatch },
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={hoverReveal}
            onChange={(e) => onHoverReveal(e.target.checked)}
          />
          Reveal sidebar on hover
        </label>
        <div className="settings-form">
          <div className="settings-field">
            <span className="settings-label">Storage location</span>
            <button
              className="settings-button"
              title={storagePath ?? undefined}
              onClick={() => storagePath && onShowPath?.(storagePath)}
            >
              Show path
            </button>
          </div>
        </div>
      </section>
      {children}
    </>
  );
}
