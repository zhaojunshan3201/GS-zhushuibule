# Aethera Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a responsive image-backed Aethera landing page at /aethera without changing the existing application shell.

**Architecture:** Route selection stays in the React entry point. A small shared predicate makes routing testable; the new page is a standalone component with isolated fonts and animation styles. The confirmed oilfield image is a Vite public asset, so no API or database change is needed.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind CSS 4, Node test runner.

---

## File structure

- Create src/shared/aetheraLanding.ts: exact /aethera route predicate.
- Create src/components/AetheraLandingPage.tsx: isolated navigation and hero.
- Create src/styles/fonts.css: Instrument Serif and Inter font import.
- Create src/styles/theme.css: Aethera animation rules.
- Create tests/aetheraLanding.test.ts: route, component, style contract tests.
- Create public/aethera/oilfield-river.png: confirmed user image.
- Modify src/main.tsx: select the landing page only at /aethera.
- Modify src/index.css: import the isolated styles.

### Task 1: Establish the standalone route

**Files:**
- Create: src/shared/aetheraLanding.ts
- Create: tests/aetheraLanding.test.ts

- [ ] **Step 1: Write the failing route test**

~~~ts
import assert from "node:assert/strict";
import test from "node:test";
import { isAetheraLandingPath } from "../src/shared/aetheraLanding";

test("only /aethera selects the Aethera landing page", () => {
  assert.equal(isAetheraLandingPath("/aethera"), true);
  assert.equal(isAetheraLandingPath("/"), false);
  assert.equal(isAetheraLandingPath("/aethera/"), false);
  assert.equal(isAetheraLandingPath("/aethera-preview"), false);
});
~~~

- [ ] **Step 2: Run the test and confirm it fails**

Run: npm exec tsx -- --test tests/aetheraLanding.test.ts

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement the minimal predicate**

~~~ts
export function isAetheraLandingPath(pathname: string) {
  return pathname === "/aethera";
}
~~~

- [ ] **Step 4: Verify the targeted test passes**

Run: npm exec tsx -- --test tests/aetheraLanding.test.ts

Expected: one passing test.

- [ ] **Step 5: Commit**

~~~powershell
git add src/shared/aetheraLanding.ts tests/aetheraLanding.test.ts
git commit -m "feat: add Aethera route predicate"
~~~

### Task 2: Add static assets and styles

**Files:**
- Create: public/aethera/oilfield-river.png
- Create: src/styles/fonts.css
- Create: src/styles/theme.css
- Modify: src/index.css:1
- Modify: tests/aetheraLanding.test.ts

- [ ] **Step 1: Extend the test with styles and asset checks**

~~~ts
import { existsSync, readFileSync } from "node:fs";

const fontsSource = readFileSync(new URL("../src/styles/fonts.css", import.meta.url), "utf8");
const themeSource = readFileSync(new URL("../src/styles/theme.css", import.meta.url), "utf8");
const indexCssSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("Aethera styles include fonts, animations, and confirmed image", () => {
  assert.match(fontsSource, /Instrument Serif/);
  assert.match(fontsSource, /Inter/);
  assert.match(themeSource, /@keyframes fade-rise/);
  assert.match(themeSource, /\.animate-fade-rise-delay-2/);
  assert.match(themeSource, /@keyframes aethera-image-enter/);
  assert.match(indexCssSource, /@import "\.\/styles\/fonts\.css";/);
  assert.match(indexCssSource, /@import "\.\/styles\/theme\.css";/);
  assert.equal(existsSync(new URL("../public/aethera/oilfield-river.png", import.meta.url)), true);
});
~~~

- [ ] **Step 2: Run the test and confirm it fails**

Run: npm exec tsx -- --test tests/aetheraLanding.test.ts

Expected: FAIL because stylesheets and image asset are absent.

- [ ] **Step 3: Add confirmed image and styles**

Copy C:\Users\31541\AppData\Local\Temp\codex-clipboard-7923db82-f6fb-426e-a32c-c12dec42dbab.png to public/aethera/oilfield-river.png.

~~~css
/* src/styles/fonts.css */
@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap");

/* src/styles/theme.css */
@keyframes fade-rise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes aethera-image-enter { from { opacity: 0; transform: scale(1.03); } to { opacity: 0.92; transform: scale(1); } }
.animate-fade-rise { animation: fade-rise .8s ease-out both; }
.animate-fade-rise-delay { animation: fade-rise .8s ease-out .2s both; }
.animate-fade-rise-delay-2 { animation: fade-rise .8s ease-out .4s both; }
.animate-aethera-image-enter { animation: aethera-image-enter 1s ease-out both; }
~~~

Add directly after the Tailwind import in src/index.css:

~~~css
@import "./styles/fonts.css";
@import "./styles/theme.css";
~~~

- [ ] **Step 4: Verify the targeted test passes**

Run: npm exec tsx -- --test tests/aetheraLanding.test.ts

Expected: route and style tests pass.

- [ ] **Step 5: Commit**

~~~powershell
git add public/aethera/oilfield-river.png src/styles/fonts.css src/styles/theme.css src/index.css tests/aetheraLanding.test.ts
git commit -m "feat: add Aethera landing page styles"
~~~

### Task 3: Implement the isolated hero

**Files:**
- Create: src/components/AetheraLandingPage.tsx
- Modify: tests/aetheraLanding.test.ts

- [ ] **Step 1: Add a failing hero contract test**

~~~ts
const pageSource = readFileSync(new URL("../src/components/AetheraLandingPage.tsx", import.meta.url), "utf8");

test("Aethera hero uses the confirmed image, copy, overlay, and animations", () => {
  assert.match(pageSource, /src="\/aethera\/oilfield-river\.png"/);
  assert.match(pageSource, /Beyond/);
  assert.match(pageSource, /silence,/);
  assert.match(pageSource, /the eternal\./);
  assert.match(pageSource, /Building platforms for brilliant minds/);
  assert.match(pageSource, /bg-gradient-to-b/);
  assert.match(pageSource, /animate-fade-rise-delay-2/);
  assert.match(pageSource, /Aethera/);
  assert.match(pageSource, /Begin Journey/);
});
~~~

- [ ] **Step 2: Run the test and confirm it fails**

Run: npm exec tsx -- --test tests/aetheraLanding.test.ts

Expected: FAIL because AetheraLandingPage.tsx is absent.

- [ ] **Step 3: Implement the component**

~~~tsx
const menuItems = ["Home", "Studio", "About", "Journal", "Reach Us"];

export default function AetheraLandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white text-black">
      <img className="animate-aethera-image-enter absolute inset-x-0 top-[300px] bottom-0 h-auto w-full object-cover object-center max-sm:top-[230px]" src="/aethera/oilfield-river.png" alt="油田河流航拍图" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-transparent to-white" />
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
        <span className="font-[Instrument_Serif] text-3xl tracking-tight">Aethera<sup className="text-[0.55em]">®</sup></span>
        <div className="hidden gap-6 text-sm sm:flex">{menuItems.map((item) => <span key={item} className={item === "Home" ? "text-black" : "text-[#6F6F6F]"}>{item}</span>)}</div>
        <button type="button" className="rounded-full bg-black px-6 py-2.5 text-sm text-white transition-transform hover:scale-[1.03]">Begin Journey</button>
      </nav>
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pb-40 pt-[calc(8rem-75px)] text-center">
        <h1 className="animate-fade-rise max-w-7xl font-[Instrument_Serif] text-5xl font-normal leading-[0.95] tracking-[-2.46px] sm:text-7xl md:text-8xl">Beyond <em className="text-[#6F6F6F]">silence,</em> we build <em className="text-[#6F6F6F]">the eternal.</em></h1>
        <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-[#6F6F6F] sm:text-lg">Building platforms for brilliant minds, fearless makers, and thoughtful souls. Through the noise, we craft digital havens for deep work and pure flows.</p>
        <button type="button" className="animate-fade-rise-delay-2 mt-12 rounded-full bg-black px-14 py-5 text-base text-white transition-transform hover:scale-[1.03]">Begin Journey</button>
      </main>
    </div>
  );
}
~~~

- [ ] **Step 4: Verify the hero contract test passes**

Run: npm exec tsx -- --test tests/aetheraLanding.test.ts

Expected: all targeted tests pass.

- [ ] **Step 5: Commit**

~~~powershell
git add src/components/AetheraLandingPage.tsx tests/aetheraLanding.test.ts
git commit -m "feat: add Aethera landing hero"
~~~

### Task 4: Integrate and verify both routes

**Files:**
- Modify: src/main.tsx
- Modify: tests/aetheraLanding.test.ts

- [ ] **Step 1: Add a failing entry-point contract test**

~~~ts
const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("entry point selects Aethera only at its standalone route", () => {
  assert.match(mainSource, /import AetheraLandingPage from "\.\/components\/AetheraLandingPage\.tsx"/);
  assert.match(mainSource, /isAetheraLandingPath\(window\.location\.pathname\)/);
  assert.match(mainSource, /<AetheraLandingPage \/>/);
  assert.match(mainSource, /<App \/>/);
});
~~~

- [ ] **Step 2: Run the test and confirm it fails**

Run: npm exec tsx -- --test tests/aetheraLanding.test.ts

Expected: FAIL because main.tsx does not select the landing page.

- [ ] **Step 3: Wire the entry point minimally**

~~~tsx
import AetheraLandingPage from "./components/AetheraLandingPage.tsx";
import { isAetheraLandingPath } from "./shared/aetheraLanding.ts";

const root = createRoot(document.getElementById("root")!);
const rootContent = isAetheraLandingPath(window.location.pathname) ? <AetheraLandingPage /> : <App />;

root.render(<StrictMode>{rootContent}</StrictMode>);
~~~

Keep existing App and index.css imports unchanged.

- [ ] **Step 4: Run all automated verification**

Run: npm exec tsx -- --test tests/aetheraLanding.test.ts; npm test; npm run lint; npm run build

Expected: targeted tests and existing suite pass, TypeScript has no diagnostics, and Vite produces a build.

- [ ] **Step 5: Verify both live routes**

Run: Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/aethera | Select-Object -ExpandProperty StatusCode; Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/ | Select-Object -ExpandProperty StatusCode

Expected: both commands return 200. Inspect /aethera at desktop and narrow widths for the image, gradient overlay, fonts, staggered entrance, and hover scale. Inspect / and confirm the existing management shell renders.

- [ ] **Step 6: Commit**

~~~powershell
git add src/main.tsx tests/aetheraLanding.test.ts
git commit -m "feat: expose Aethera landing page"
~~~

## Plan self-review

- **Spec coverage:** Tasks 1 and 4 preserve route behavior; Task 2 covers confirmed image, fonts, and animations; Task 3 covers hero layout, copy, colors, navigation, CTA, overlay, and responsiveness; Task 4 verifies both routes.
- **Completeness scan:** Every task names exact files, commands, implementation code, and expected verification results.
- **Type consistency:** isAetheraLandingPath is defined in Task 1 and used under the same name in Task 4. Animation class names in Task 2 match Task 3.
