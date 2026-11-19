import type { DocumentSettings } from "../research/types";
import { pageLabel, pageLabelPosition } from "../export/pageLabel";
import type { paperGeometry } from "./formatting";

type Props = {
  pages: number;
  geometry: ReturnType<typeof paperGeometry>;
  margin: number;
  settings: DocumentSettings;
  templateId: string | undefined;
};

/** The page header text and number, drawn in one corner of every page sheet. */
export function PageLabels({ pages, geometry, margin, settings, templateId }: Props) {
  const position = pageLabelPosition(settings);
  const atTop = position.startsWith("top");
  const centred = position.endsWith("center");
  return (
    <>
      {Array.from({ length: pages }, (_, page) => {
        const label = pageLabel(settings, templateId, page);
        if (label === null) return null;
        const sheetTop = page * (geometry.height + geometry.gap);
        return (
          <div
            key={page}
            className="page-label"
            data-page={page}
            data-position={position}
            aria-hidden="true"
            style={{
              top: atTop ? sheetTop + margin / 2 : sheetTop + geometry.height - margin / 2,
              ...(position.endsWith("left")
                ? { left: margin }
                : centred
                  ? { left: "50%" }
                  : { right: margin }),
              transform: centred ? "translate(-50%, -50%)" : "translateY(-50%)",
            }}
          >
            {label}
          </div>
        );
      })}
    </>
  );
}
