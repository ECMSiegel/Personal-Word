import type { ReactNode } from "react";
import { Segmented } from "../components/Segmented";
import { AppearanceSettings } from "./AppearanceSettings";
import {
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
  floating,
  onFloating,
  restoreTabs,
  onRestoreTabs,
  storagePath,
  onShowPath,
  sidebarExtras,
  children,
}: {
  appearance: Appearance;
  onAppearance: (appearance: Appearance) => void;
  hoverReveal: boolean;
  onHoverReveal: (value: boolean) => void;
  floating: boolean;
  onFloating: (value: boolean) => void;
  restoreTabs: boolean;
  onRestoreTabs: (value: boolean) => void;
  storagePath: string | null;
  onShowPath?: (path: string) => void;
  sidebarExtras?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <section className="settings-section stack gap-4">
        <h2>General</h2>
        <label className="settings-check cluster gap-2">
          <input
            type="checkbox"
            checked={restoreTabs}
            onChange={(e) => onRestoreTabs(e.target.checked)}
          />
          Restore open project tabs at launch
        </label>
        <div className="settings-form stack gap-3">
          <div className="settings-field row gap-3">
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
          <div className="settings-field row gap-3">
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
          <AppearanceSettings />
        </div>
        <div className="settings-form stack gap-3">
          <div className="settings-field row gap-3">
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
      <section className="settings-section stack gap-4">
        <h2>Sidebar</h2>
        <label className="settings-check cluster gap-2">
          <input
            type="checkbox"
            checked={hoverReveal}
            onChange={(e) => onHoverReveal(e.target.checked)}
          />
          Reveal sidebar on hover
        </label>
        <label className="settings-check cluster gap-2">
          <input
            type="checkbox"
            checked={floating}
            onChange={(e) => onFloating(e.target.checked)}
          />
          Floating sidebar and research
        </label>
        {sidebarExtras}
      </section>
      {children}
    </>
  );
}
