// The CSS font stack for a project's document typeface setting.
// "sans" means the interface font chosen in Settings; serif and mono are fixed.
const SANS_FALLBACK = "Futura, system-ui, sans-serif";

export function documentFontStack(
  font: "serif" | "sans" | "mono" | undefined,
  interfaceFont: string,
): string {
  if (font === "serif") return "Times New Roman, serif";
  if (font === "mono") return "Courier New, monospace";
  const chosen = interfaceFont.trim();
  if (!chosen) return SANS_FALLBACK;
  if (chosen.includes(",")) return chosen;
  return `"${chosen.replace(/^["']|["']$/g, "")}", system-ui, sans-serif`;
}
