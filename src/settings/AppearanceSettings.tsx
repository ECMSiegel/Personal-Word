// Interface font and added fonts in Settings.
import type { JSX } from "react";
import { useMemo, useRef, useState } from "react";
import { Dropdown } from "../components/Dropdown";
import { addUserFont, removeUserFont } from "../fonts/store";
import { fontValue } from "../fonts/names";
import { BUILT_IN_FONTS, refreshFonts, setInterfaceFont, useInterfaceFont, useSystemFamilies, useUserFonts } from "../fonts/registry";

export function AppearanceSettings(): JSX.Element | null {
  const userFonts = useUserFonts();
  const systemFamilies = useSystemFamilies();
  const current = useInterfaceFont();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const options = useMemo(() => {
    const seen = new Set<string>();
    const result = BUILT_IN_FONTS.map(({ label, stack }) => {
      seen.add(label.toLowerCase());
      return { value: stack, label, style: { fontFamily: stack } };
    });
    for (const family of [...userFonts.map(({ family }) => family), ...systemFamilies]) {
      const key = family.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const value = fontValue(family);
      result.push({ value, label: family, style: { fontFamily: value } });
    }
    return result;
  }, [systemFamilies, userFonts]);

  const addFiles = async (files: File[]) => {
    setError("");
    for (const file of files) {
      try { await addUserFont(file); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add that font"); break; }
    }
    await refreshFonts();
  };
  const chooseFiles = async () => {
    setError("");
    input.current?.click();
  };
  const removeFamily = async (family: string) => {
    setError("");
    try {
      for (const font of userFonts.filter((item) => item.family === family)) await removeUserFont(font.id);
      await refreshFonts();
      if (current.toLowerCase().startsWith(`"${family.toLowerCase()}"`)) setInterfaceFont(BUILT_IN_FONTS[0]!.stack);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove that font"); }
  };

  return <div className="settings-field settings-field--wide appearance-fonts row gap-3">
    <span className="settings-label">Interface font</span>
    <div className="appearance-fonts__row">
      <Dropdown label="Interface font" value={current} options={options} onChange={setInterfaceFont} className="appearance-fonts__menu" />
      <button className="settings-button" type="button" onClick={() => void chooseFiles()}>Add font...</button>
      <input ref={input} type="file" accept=".ttf,.otf" multiple hidden onChange={(event) => { void addFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
    </div>
    {userFonts.length > 0 && <ul className="appearance-fonts__list">{Array.from(new Set(userFonts.map(({ family }) => family))).map((family) => {
      const styleLabels = { regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "Bold italic" };
      const availableStyles = new Set(userFonts.filter((font) => font.family === family).map(({ style }) => style));
      const styles = (["regular", "bold", "italic", "boldItalic"] as const)
        .filter((style) => availableStyles.has(style))
        .map((style) => styleLabels[style])
        .join(", ");
      return <li key={family}><span>{family} <span className="appearance-fonts__styles">({styles})</span></span><button type="button" className="settings-button appearance-fonts__remove" onClick={() => void removeFamily(family)}>Remove</button></li>;
    })}</ul>}
    {error && <div className="appearance-fonts__error" role="alert">{error}</div>}
  </div>;
}
