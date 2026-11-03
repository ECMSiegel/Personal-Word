import { useState, type RefObject } from "react";
import { lookupIdentifier } from "./lookup";
import { addLookedUpSource } from "./citationActions";
import type { ResearchData } from "./types";

export function useLookup(latest: RefObject<ResearchData>, onChange: (data: ResearchData) => void) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: "", error: false });
  const notify = (text: string, error = false) => setStatus({ text, error });
  const run = async (): Promise<string | null> => {
    const value = input.trim();
    if (!value || busy) return null;
    setBusy(true); notify("Looking up...");
    try {
      const result = await lookupIdentifier(value);
      const id = crypto.randomUUID();
      onChange(addLookedUpSource(latest.current, result.source, () => id).data);
      setInput("");
      notify(`Found on ${result.provider} -- review the details`);
      return id;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Lookup failed", true);
      return null;
    } finally { setBusy(false); }
  };
  return { input, setInput, busy, status, notify, run };
}
