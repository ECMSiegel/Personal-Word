import { type Page } from "@playwright/test";

// Properties an animation in this app may touch (docs/design-system.md, Motion).
export const ALLOWED = ["transform", "opacity", "clipPath", "clip-path", "visibility"];

declare global {
  interface Window {
    __animatedProperties: () => string[];
    __motionSamples: { props: string[]; count: number }[];
    __motionStopAt: number;
    __motionDone: boolean;
  }
}

// Installed in every page: what each running animation animates.
export async function installProbe(page: Page) {
  await page.addInitScript(() => {
    window.__animatedProperties = () =>
      document.getAnimations().flatMap((a) => {
        if (a instanceof CSSTransition) return [a.transitionProperty];
        const effect = a.effect as KeyframeEffect | null;
        return (effect?.getKeyframes() ?? []).flatMap((frame) =>
          Object.keys(frame).filter((k) => !["offset", "easing", "composite", "computedOffset"].includes(k)),
        );
      });
  });
}

export async function animatedProperties(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__animatedProperties());
}

// Samples every animation frame from now until 300 ms after `act` has run.
export async function sampleDuring(page: Page, act: () => Promise<void>) {
  await page.evaluate(() => {
    window.__motionSamples = [];
    window.__motionStopAt = Infinity;
    window.__motionDone = false;
    const tick = () => {
      window.__motionSamples.push({
        props: window.__animatedProperties(),
        count: document.getAnimations().length,
      });
      if (performance.now() < window.__motionStopAt) requestAnimationFrame(tick);
      else window.__motionDone = true;
    };
    requestAnimationFrame(tick);
  });
  await act();
  await page.evaluate(() => (window.__motionStopAt = performance.now() + 300));
  await page.waitForFunction(() => window.__motionDone);
  return page.evaluate(() => window.__motionSamples);
}
