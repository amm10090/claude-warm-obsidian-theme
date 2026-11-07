import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const css = fs.readFileSync(path.join(root, "theme.css"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const errors = [];

const statuses = [
  ["/", "Incomplete"],
  ["-", "Canceled"],
  [">", "Forwarded"],
  ["<", "Scheduling"],
  ["?", "Question"],
  ["!", "Important"],
  ["*", "Star"],
  ['"', "Quote"],
  ["l", "Location"],
  ["b", "Bookmark"],
  ["i", "Information"],
  ["S", "Savings"],
  ["I", "Idea"],
  ["p", "Pros"],
  ["c", "Cons"],
  ["f", "Fire"],
  ["k", "Key"],
  ["w", "Win"],
  ["u", "Up"],
  ["d", "Down"]
];

const start = css.indexOf("/* cw-alternate-checkboxes:start");
const end = css.indexOf("/* cw-alternate-checkboxes:end */");
if (start < 0 || end < start) errors.push("Missing alternate checkbox markers");
const block = start >= 0 ? css.slice(start, end) : "";

if (!css.includes("--theme-alternative-checkboxes: enable")) {
  errors.push("Theme must default --theme-alternative-checkboxes to enable");
}
if (!block.includes("@container style(--theme-alternative-checkboxes: enable)")) {
  errors.push("Alternate rules must live in the enable style query");
}
if (!css.includes("--checkbox-color: var(--interactive-accent)")) {
  errors.push("Plain checkbox accent color was removed");
}

for (const [character, name] of statuses) {
  const attr = character === '"' ? '[data-task="\\""]' : `[data-task="${character}"]`;
  if (!block.includes(attr)) errors.push(`Missing selector ${attr}`);
  const label = character === '"' ? '[\\"]' : `[${character}]`;
  if (!block.includes(`${label} ${name}`)) errors.push(`Missing label for ${name}`);
  if (!readme.includes(`- [${character}]`)) errors.push(`README missing syntax - [${character}]`);
}

for (const plain of ['[data-task="x"]', '[data-task="X"]', '[data-task=" "]']) {
  if (block.includes(plain)) errors.push(`Plain task matched by alternate rules: ${plain}`);
}

if (/!important\b/.test(css)) errors.push("theme.css uses !important");
if (css.includes(":has(")) errors.push("theme.css uses :has(");
if (/https?:\/\//.test(css)) errors.push("theme.css contains a remote URL");

const marks = [...block.matchAll(/--cw-task-mark:\s*(url\("data:image\/svg\+xml,[^"]+"\))/g)].map((match) => match[1]);
if (marks.length !== statuses.length) errors.push(`Expected ${statuses.length} marks, found ${marks.length}`);
if (new Set(marks).size !== marks.length) errors.push("Alternate marks are not unique");
for (const mark of marks) {
  const encoded = mark.slice('url("data:image/svg+xml,'.length, -2);
  const svg = decodeURIComponent(encoded);
  if (!svg.startsWith("<svg") || !svg.includes('viewBox="0 0 16 16"')) {
    errors.push("A mark is not an inline 16x16 SVG");
  }
  if (/lucide|heroicons|currentColor/i.test(svg)) errors.push("A mark still carries third-party icon markup");
}

const openBraces = (css.match(/{/g) || []).length;
const closeBraces = (css.match(/}/g) || []).length;
if (openBraces !== closeBraces) errors.push(`CSS brace mismatch: ${openBraces} open, ${closeBraces} close`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Static alternate-checkbox checks passed.");

const chrome = process.env.CHROME || "google-chrome";
if (!commandExists(chrome)) {
  console.log(`Browser checks skipped: ${chrome} is not available.`);
  process.exit(0);
}

const artifactDir = process.env.ALT_CHECKBOX_ARTIFACTS || "/opt/cursor/artifacts";
fs.mkdirSync(artifactDir, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "cw-alt-"));
const htmlPath = path.join(work, "fixture.html");
fs.writeFileSync(htmlPath, fixtureHtml(css));

const chromeProc = startChrome(chrome);
try {
  const version = await waitForJson(chromeProc.port);
  const browser = await connect(version.webSocketDebuggerUrl);

  const enabled = await open(browser, `${fileUrl(htmlPath)}#light`);
  assertPage(await evaluate(browser, enabled, "window.__results"), "light");
  await shoot(browser, enabled, path.join(artifactDir, "alt-checkboxes-light.png"), 960);

  const dark = await open(browser, `${fileUrl(htmlPath)}#dark`);
  assertPage(await evaluate(browser, dark, "window.__results"), "dark");
  await shoot(browser, dark, path.join(artifactDir, "alt-checkboxes-dark.png"), 960);

  const narrowLight = await open(browser, `${fileUrl(htmlPath)}#light-narrow`);
  assertPage(await evaluate(browser, narrowLight, "window.__results"), "narrow light");
  await assertNarrow(browser, narrowLight);
  await shoot(browser, narrowLight, path.join(artifactDir, "alt-checkboxes-light-narrow.png"), 390);

  const narrowDark = await open(browser, `${fileUrl(htmlPath)}#dark-narrow`);
  assertPage(await evaluate(browser, narrowDark, "window.__results"), "narrow dark");
  await assertNarrow(browser, narrowDark);
  await shoot(browser, narrowDark, path.join(artifactDir, "alt-checkboxes-dark-narrow.png"), 390);

  const disabled = await open(browser, `${fileUrl(htmlPath)}#light-disable`);
  assertPage(await evaluate(browser, disabled, "window.__results"), "disabled light");
  await shoot(browser, disabled, path.join(artifactDir, "alt-checkboxes-disabled-light.png"), 960);

  console.log("Browser fixture checks passed.");
  console.log(`Screenshots: ${artifactDir}`);
} finally {
  chromeProc.child.kill("SIGKILL");
  await new Promise((resolve) => chromeProc.child.on("exit", resolve));
}

function assertPage(results, label) {
  const text = String(results || "");
  const failures = text.split("\n").filter((line) => line.startsWith("FAIL"));
  if (!text.includes("PASS") || failures.length) {
    throw new Error(`${label} fixture failed:\n${text}`);
  }
  console.log(`\n${label}\n${text}`);
}

function fixtureHtml(themeCss) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* Synthetic stand-in for the checkbox rules shipped with Obsidian.
     This is not app.css and it is not the Obsidian runtime. */
  /* Property model taken from Obsidian 1.15 app.css (checkbox mask, focus ring,
     and strikethrough only on x/X). The check glyph here is a test stand-in. */
  body {
    --checkbox-size: 16px;
    --checkbox-marker-color: var(--background-primary);
    --checklist-done-decoration: line-through;
    --checklist-done-color: var(--text-muted);
  }
  input[type="checkbox"] {
    appearance: none;
    width: var(--checkbox-size);
    height: var(--checkbox-size);
    box-sizing: border-box;
    border: 1px solid var(--checkbox-border-color, currentColor);
    border-radius: var(--checkbox-radius, 2px);
    background: var(--background-primary, white);
    position: relative;
    margin: 0 0.45em 0 0;
    vertical-align: -2px;
    flex: 0 0 auto;
  }
  input[type="checkbox"]:checked {
    background: var(--checkbox-color);
    border-color: var(--checkbox-color);
  }
  input[type="checkbox"]:checked::after {
    content: "";
    top: -1px;
    inset-inline-start: -1px;
    position: absolute;
    width: var(--checkbox-size);
    height: var(--checkbox-size);
    display: block;
    background-color: var(--checkbox-marker-color);
    -webkit-mask-position: 52% 52%;
    -webkit-mask-size: 65%;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath fill='%23000' d='M1 4.5 4.2 7.2 11 1'/%3E%3C/svg%3E");
  }
  input[type="checkbox"]:focus {
    outline: 0;
    border-color: var(--checkbox-border-color-hover);
  }
  input[type="checkbox"]:focus-visible {
    box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
  }
  .markdown-preview-view li.task-list-item[data-task="x"],
  .markdown-preview-view li.task-list-item[data-task="X"],
  .markdown-rendered li.task-list-item[data-task="x"],
  .markdown-rendered li.task-list-item[data-task="X"],
  .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task="x"],
  .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task="X"] {
    text-decoration: var(--checklist-done-decoration);
    color: var(--checklist-done-color);
  }
</style>
<style>${themeCss}</style>
<style>
  body {
    margin: 0;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-text-theme);
    line-height: 1.45;
  }
  .note { max-width: 880px; margin: 0 auto; padding: 28px 28px 48px; }
  .banner, .meta {
    font-family: var(--font-interface-theme);
    color: var(--text-faint);
    font-size: 12px;
  }
  h1 { font-size: 1.6rem; font-weight: 560; margin: 0.2em 0 0.4em; }
  h2 {
    font-family: var(--font-interface-theme);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 1.4em 0 0.4em;
  }
  ul.tasks, .live { display: grid; grid-template-columns: 1fr 1fr; gap: 0.15em 1.4em; }
  ul.tasks { list-style: none; padding: 0; margin: 0; }
  li.task-list-item { margin: 0.15em 0; }
  .live { display: block; }
  .cm-line { padding: 0.12em 0; }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 0.45em;
    font-family: var(--font-interface-theme);
  }
  .long { grid-column: 1 / -1; }
  @media (max-width: 640px) {
    .note { padding: 16px; }
    ul.tasks { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<main class="note" id="root"></main>
<script>
const params = new URLSearchParams(location.hash.slice(1).replaceAll("&", "&"));
const hash = location.hash;
document.body.className = hash.includes("dark") ? "theme-dark" : "theme-light";
if (hash.includes("disable")) {
  const extra = document.createElement("style");
  extra.textContent = "body { --theme-alternative-checkboxes: disable; }";
  document.head.appendChild(extra);
}
if (hash.includes("narrow")) {
  const extra = document.createElement("style");
  extra.textContent = "html,body{width:390px !important;max-width:390px !important;overflow-x:hidden} ul.tasks{grid-template-columns:1fr !important}";
  document.head.appendChild(extra);
}

const tasks = [
  [" ", "To-do", false],
  ["x", "Done", true],
  ["X", "Done uppercase", true],
  ["/", "Incomplete", true],
  ["-", "Canceled", true],
  [">", "Forwarded", true],
  ["<", "Scheduling", true],
  ["?", "Question", true],
  ["!", "Important", true],
  ["*", "Star", true],
  ['"', "Quote", true],
  ["l", "Location", true],
  ["b", "Bookmark", true],
  ["i", "Information", true],
  ["S", "Savings", true],
  ["I", "Idea", true],
  ["p", "Pros", true],
  ["c", "Cons", true],
  ["f", "Fire", true],
  ["k", "Key", true],
  ["w", "Win", true],
  ["u", "Up", true],
  ["d", "Down", true],
  ["n", "Unknown status", true]
];

const root = document.getElementById("root");
root.innerHTML = \`
  <p class="banner">Synthetic HTML/CSS fixture. It approximates Obsidian task markup and a minimal checkbox baseline, then loads Claude Warm. It is not the Obsidian app.</p>
  <h1>Alternate checkboxes</h1>
  <p class="meta" id="mode"></p>
  <h2>Reading view</h2>
  <div class="markdown-preview-view markdown-rendered">
    <ul class="tasks contains-task-list" id="reading"></ul>
  </div>
  <h2>Live Preview</h2>
  <div class="markdown-source-view mod-cm6 is-live-preview" id="live"></div>
  <h2>Paragraph, nested, and narrow text</h2>
  <div class="markdown-preview-view markdown-rendered">
    <ul class="tasks contains-task-list" id="extra"></ul>
  </div>
  <h2>Plain controls</h2>
  <div class="settings">
    <label class="checkbox-container"><input id="settings-off" type="checkbox"> Show line numbers</label>
    <label class="checkbox-container"><input id="settings-on" type="checkbox" checked> Use theme accent</label>
    <p class="meta" id="focus-report"></p>
  </div>
\`;
document.getElementById("mode").textContent = document.body.className + (hash.includes("disable") ? " · alternate marks disabled" : " · alternate marks enabled");

const reading = document.getElementById("reading");
for (const [character, name, checked] of tasks) {
  reading.append(taskItem(character, name, checked, character === "?"));
}
const quote = taskItem('"', "Quote inside a paragraph", true, false, true);
quote.classList.add("long");
const parent = taskItem("b", "Bookmark with a nested key", true);
const nested = document.createElement("ul");
nested.className = "contains-task-list";
nested.append(taskItem("k", "Nested key", true));
parent.append(nested);
const long = taskItem("i", "Information that has to wrap inside a narrow mobile column without stretching the checkbox or pushing the line outside the page.", true);
long.classList.add("long");
long.id = "wrap-line";
document.getElementById("extra").append(quote, parent, long);

const live = document.getElementById("live");
for (const [character, name, checked] of [[" ", "To-do", false], ["x", "Done", true], ["/", "Incomplete", true], [">", "Forwarded", true], ["-", "Canceled", true]]) {
  const line = document.createElement("div");
  line.className = "cm-line HyperMD-task-line";
  line.dataset.task = character;
  const label = document.createElement("label");
  label.className = "task-list-label";
  label.append(checkbox(character, checked, false));
  line.append(document.createTextNode("- "), label, document.createTextNode(" " + name + " in Live Preview"));
  live.append(line);
}

function taskItem(character, name, checked, focus, paragraph) {
  const li = document.createElement("li");
  li.className = "task-list-item" + (checked ? " is-checked" : "");
  li.dataset.task = character;
  const input = checkbox(character, checked, focus);
  if (paragraph) {
    const p = document.createElement("p");
    p.append(input, document.createTextNode(" " + name));
    li.append(p);
  } else {
    li.append(input, document.createTextNode(" " + name));
  }
  return li;
}
function checkbox(character, checked, focus) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "task-list-item-checkbox";
  input.dataset.task = character;
  input.checked = checked;
  if (focus) input.id = "focus-target";
  return input;
}

const lines = [];
const disabled = hash.includes("disable");
const pass = (name, ok, detail = "") => lines.push((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
const styleOf = (el, pseudo) => getComputedStyle(el, pseudo || null);
const readingInput = (character) => [...reading.querySelectorAll("input")].find((input) => input.dataset.task === character);

const plain = readingInput("x");
const blank = readingInput(" ");
const upper = readingInput("X");
const slash = readingInput("/");
const canceled = readingInput("-");
const unknown = readingInput("n");
const quoteInput = [...document.querySelectorAll("#extra input")].find((input) => input.dataset.task === '"');
const nestedInput = document.querySelector("#extra ul input[data-task='k']");
const liveSlash = document.querySelector("#live .HyperMD-task-line[data-task='/'] input");
const liveCanceled = document.querySelector("#live .HyperMD-task-line[data-task='-']");
const settings = document.getElementById("settings-on");

function maskOf(input) {
  const after = styleOf(input, "::after");
  const mask = after.maskImage && after.maskImage !== "none" ? after.maskImage : after.webkitMaskImage;
  return mask || "none";
}

pass("blank task is not masked", maskOf(blank) === "none", maskOf(blank));
pass("done task keeps a check marker", styleOf(plain).getPropertyValue("--checkbox-marker-color").trim() !== "transparent");
pass("uppercase done keeps a check marker", styleOf(upper).getPropertyValue("--checkbox-marker-color").trim() !== "transparent");
pass("done background uses the accent", colorsClose(styleOf(plain).backgroundColor, styleOf(plain).getPropertyValue("--interactive-accent").trim() || styleOf(document.body).getPropertyValue("--interactive-accent")));
pass("done text stays struck", styleOf(plain.closest("li")).textDecorationLine === "line-through");
const plainMask = maskOf(plain);
pass("unknown status keeps the plain check", styleOf(unknown).getPropertyValue("--checkbox-marker-color").trim() !== "transparent" && maskOf(unknown) === plainMask);
pass("settings checkbox keeps the plain check", maskOf(settings) === plainMask && styleOf(settings).getPropertyValue("--checkbox-marker-color").trim() !== "transparent");

const masks = new Set();
for (const [character] of tasks) {
  if (" xXn".includes(character) || character === " ") continue;
  const input = readingInput(character);
  const mask = maskOf(input);
  const marker = styleOf(input).getPropertyValue("--checkbox-marker-color").trim();
  const after = styleOf(input, "::after");
  pass("mask " + character, !disabled ? mask !== "none" && mask !== plainMask : mask === plainMask, mask.slice(0, 64));
  pass("marker " + character, !disabled ? marker === "transparent" : marker !== "transparent", marker);
  if (!disabled) {
    const upright = after.transform === "none" || after.transform.indexOf("matrix(1, 0, 0, 1") === 0;
    pass("mark box " + character, parseFloat(after.height) >= 13 && upright, after.height + " " + after.transform);
    pass("mark ink " + character, colorEquals(after.backgroundColor, styleOf(input).borderTopColor), after.backgroundColor);
    masks.add(mask);
  }
}
if (!disabled) pass("reading masks are unique", masks.size === 20, String(masks.size));

const canceledLine = styleOf(canceled.closest("li"));
pass("canceled reading text", disabled || (canceledLine.textDecorationLine === "line-through" && colorEquals(canceledLine.color, cssColor(document.body, "--text-faint"))), canceledLine.textDecorationLine + " " + canceledLine.color);
pass("incomplete reading text is not struck", disabled || styleOf(slash.closest("li")).textDecorationLine === "none", styleOf(slash.closest("li")).textDecorationLine);
pass("quote inside paragraph", !disabled ? maskOf(quoteInput) !== plainMask : maskOf(quoteInput) === plainMask);
pass("nested key", !disabled ? maskOf(nestedInput) !== plainMask : maskOf(nestedInput) === plainMask);
pass("live preview slash", !disabled ? maskOf(liveSlash) !== plainMask : maskOf(liveSlash) === plainMask);
pass("live preview canceled strike", disabled || styleOf(liveCanceled).textDecorationLine === "line-through", styleOf(liveCanceled).textDecorationLine);
pass("checkbox size", styleOf(slash).width === "16px", styleOf(slash).width);
pass("pointer events stay on", styleOf(slash).pointerEvents !== "none");

if (!disabled) {
  const accent = cssColor(document.body, "--cw-task-accent");
  pass("incomplete uses the warm accent", colorEquals(styleOf(slash).borderTopColor, accent), styleOf(slash).borderTopColor + " vs " + accent);
  const important = readingInput("!");
  const orange = cssColor(document.body, "--color-orange-rgb");
  pass("important uses orange", colorEquals(styleOf(important).borderTopColor, orange), styleOf(important).borderTopColor + " vs " + orange);
}
pass("plain radius", styleOf(blank).borderTopLeftRadius === "4px", styleOf(blank).borderTopLeftRadius);

const focus = document.getElementById("focus-target");
focus.focus({ focusVisible: true });
const focused = styleOf(focus);
pass("focus ring remains", focused.boxShadow !== "none" && focused.outlineStyle === "none", focused.boxShadow + " / outline " + focused.outlineStyle);
pass("focus target is the question box", document.activeElement === focus);
document.getElementById("focus-report").textContent = "Keyboard focus ring: " + focused.boxShadow;

if (disabled) {
  pass("disabled slash uses the plain check", maskOf(slash) === plainMask && styleOf(slash).getPropertyValue("--checkbox-marker-color").trim() !== "transparent");
  pass("disabled done still checked", styleOf(plain).backgroundColor === styleOf(slash).backgroundColor);
}

window.__results = lines.join("\\n");
window.__ready = true;

function cssColor(el, name) {
  let value = styleOf(el).getPropertyValue(name).trim();
  if (/^[\\d.\\s,]+$/.test(value)) value = "rgb(" + value + ")";
  if (value.startsWith("rgb")) return value;
  const probe = document.createElement("span");
  probe.style.color = value;
  document.body.append(probe);
  const color = styleOf(probe).color;
  probe.remove();
  return color;
}
function colorEquals(a, b) {
  return String(a).replace(/\\s/g, "") === String(b).replace(/\\s/g, "");
}
function colorsClose(background, accentValue) {
  const probe = document.createElement("span");
  probe.style.color = accentValue || "transparent";
  document.body.append(probe);
  const accent = styleOf(probe).color;
  probe.remove();
  return colorEquals(background, accent);
}
</script>
</body>
</html>`;
}

function startChrome(command) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cw-chrome-"));
  const port = 9400 + Math.floor(Math.random() * 500);
  const child = spawn(command, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--allow-file-access-from-files",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    "about:blank"
  ], { stdio: "ignore" });
  return { child, port, dir };
}

async function waitForJson(port) {
  let last = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error.message;
    }
    await delay(200);
  }
  throw new Error(`Chrome debug port did not open (${last})`);
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let next = 0;
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        send(method, params = {}, sessionId) {
          const id = ++next;
          ws.send(JSON.stringify({ id, method, params, sessionId }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
        close() { ws.close(); }
      });
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const { res, rej } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rej(new Error(JSON.stringify(message.error)));
      else res(message.result);
    });
    ws.addEventListener("error", () => reject(new Error("Chrome DevTools socket failed")));
  });
}

async function open(browser, url) {
  const created = await browser.send("Target.createTarget", { url });
  const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = await evaluate(browser, sessionId, "window.__ready === true");
    if (ready === true) return sessionId;
    await delay(100);
  }
  const text = await evaluate(browser, sessionId, "document.body ? document.body.innerText.slice(0, 500) : 'no body'");
  throw new Error(`Fixture did not finish: ${text}`);
}

async function evaluate(browser, sessionId, expression) {
  const result = await browser.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function setWidth(browser, sessionId, width) {
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 800,
    deviceScaleFactor: 1,
    mobile: width < 500
  }, sessionId);
  await delay(50);
  const height = await evaluate(browser, sessionId, "Math.ceil(document.documentElement.scrollHeight + 24)");
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 500
  }, sessionId);
  await delay(50);
}

async function assertNarrow(browser, sessionId) {
  const layout = await evaluate(browser, sessionId, `(() => {
    const shortItem = document.querySelector("#reading li");
    const wrapped = document.querySelector("#wrap-line");
    return {
      width: Math.ceil(document.body.getBoundingClientRect().width),
      overflow: document.body.scrollWidth <= 391,
      columns: getComputedStyle(document.querySelector("ul.tasks")).gridTemplateColumns,
      checkbox: getComputedStyle(document.querySelector("ul.tasks input")).width,
      wrapped: wrapped.getBoundingClientRect().height > shortItem.getBoundingClientRect().height * 1.6
    };
  })()`);
  if (layout.width > 390 || !layout.overflow || layout.columns.includes(" ") || layout.checkbox !== "16px" || !layout.wrapped) {
    throw new Error(`Narrow layout did not reflow: ${JSON.stringify(layout)}`);
  }
}

async function shoot(browser, sessionId, file, width) {
  await setWidth(browser, sessionId, Math.max(width, 800));
  const shot = await browser.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: width <= 420 ? {
      x: 0,
      y: 0,
      width: 390,
      height: await evaluate(browser, sessionId, "Math.ceil(document.documentElement.scrollHeight)"),
      scale: 1
    } : undefined
  }, sessionId);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  const png = fs.readFileSync(file);
  const imageWidth = png.readUInt32BE(16);
  const imageHeight = png.readUInt32BE(20);
  if (png.length < 8000 || imageWidth < 300 || imageHeight < 400) {
    throw new Error(`Screenshot looks empty: ${file} ${imageWidth}x${imageHeight} ${png.length} bytes`);
  }
  console.log(`Wrote ${file} (${imageWidth}x${imageHeight})`);
}

function commandExists(command) {
  const paths = (process.env.PATH || "").split(path.delimiter);
  return paths.some((dir) => fs.existsSync(path.join(dir, command)));
}

function fileUrl(file) {
  return `file://${file}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
