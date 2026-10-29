import { useEffect, useLayoutEffect, useRef, useId, type ReactNode } from "react";

export type NameDialog = { title: string; label: string; value: string; action: (name: string) => Promise<void> | void };
export type ChoiceDialog = { title: string; body: string; actions: { label: string; run: () => Promise<void> | void; primary?: boolean; destructive?: boolean; keep?: boolean }[] };

/** Owns dialog focus only; project mutations and asynchronous state remain in App. */
export function ModalFrame({ title, busy = false, onCancel, children }: { title: string; busy?: boolean; onCancel: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(document.activeElement as HTMLElement);
  const label = useId();
  useLayoutEffect(() => {
    const prior = previous.current;
    const focus = box.current?.querySelector<HTMLElement>("input:not([disabled]), button:not([disabled]), [tabindex='0']");
    (focus ?? box.current)?.focus();
    return () => { if (prior?.isConnected) prior.focus(); };
  }, []);
  // Escape must close the dialog even when focus has left it (a click on the backdrop drops focus to the page).
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || box.current?.contains(document.activeElement)) return;
      event.preventDefault();
      if (!busyRef.current) cancelRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return <div className="modal-backdrop"><div className="dialog" ref={box} role="dialog" aria-modal="true" aria-labelledby={label} tabIndex={-1}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel(); }
      if (event.key !== "Tab") return;
      const controls = [...(box.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex='0']") ?? [])].filter((e) => e.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); box.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <div className="eyebrow">PERSONAL WORD</div><h2 id={label}>{title}</h2>{children}
  </div></div>;
}

export function ProjectDialogs({ name, choice, busy, setName, setChoice, setBusy, run }: {
  name: NameDialog | null; choice: ChoiceDialog | null; busy: boolean;
  setName: (value: NameDialog | null) => void; setChoice: (value: ChoiceDialog | null) => void;
  setBusy: (value: boolean) => void; run: (action: () => Promise<void>) => Promise<void>;
}) {
  return <>
    {name && <ModalFrame key="name" title={name.title} busy={busy} onCancel={() => setName(null)}>
      <form onSubmit={(e) => { e.preventDefault(); if (!name.value.trim() || busy) return; setBusy(true); void run(async () => { await name.action(name.value.trim()); setName(null); }).finally(() => setBusy(false)); }}>
        <label>{name.label}<input value={name.value} onChange={(e) => setName({ ...name, value: e.target.value })} /></label>
        <div className="dialog-actions"><button type="button" disabled={busy} onClick={() => setName(null)}>Cancel</button><button className="primary" type="submit" disabled={!name.value.trim() || busy}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
    </ModalFrame>}
    {choice && <ModalFrame key="choice" title={choice.title} busy={busy} onCancel={() => setChoice(null)}>
      <p className="dialog-body">{choice.body}</p><div className="dialog-actions"><button type="button" disabled={busy} onClick={() => setChoice(null)}>Cancel</button>
        {choice.actions.map((a) => <button key={a.label} type="button" className={a.primary ? "primary" + (a.destructive ? " destructive" : "") : ""} disabled={busy} onClick={() => { setBusy(true); void run(async () => { await a.run(); if (!a.keep) setChoice(null); }).finally(() => setBusy(false)); }}>{a.label}</button>)}
      </div>
    </ModalFrame>}
  </>;
}
