#!/usr/bin/env node
// FKUI Components List — HTML Generator
// Scans @fkui/design and @fkui/vue, counts breakpoints, generates Vue Playground URLs.
//
// Usage: npm run generate
// Output: dist/index.html

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, strToU8, zlibSync } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Resolve FKUI paths ────────────────────────────────────────────────────

const designSrc = join(ROOT, "node_modules/@fkui/design");
const vuePkg = JSON.parse(readFileSync(join(ROOT, "node_modules/@fkui/vue/package.json"), "utf8"));
const FKUI_VERSION = vuePkg.version;

// SCSS source is in the npm package under src/ or dist/
// Try src/ first (may not exist in published package), fall back to counting compiled CSS
const SCSS_SRC = join(designSrc, "src/components");

// ─── Vue → SCSS mapping ────────────────────────────────────────────────────

const VUE_TO_SCSS = {
  FBadge: "badge",
  FButton: "button",
  FCalendar: "calendar-day",
  FCard: "card",
  FCheckboxField: "checkbox",
  FContextMenu: "contextmenu",
  FCrudDataset: "crud-dataset",
  FDataTable: "table",
  FDatepickerField: "datepicker-field",
  FDefinitionList: "definition-list",
  FDetailsPanel: null,
  FDialogueTree: "dialogue-tree",
  FErrorList: "error-list",
  FExpand: null,
  FExpandablePanel: "expandable-panel",
  FExpandableParagraph: "expandable-paragraph",
  FFieldset: "fieldset",
  FFileItem: "file-item",
  FFileSelector: "file-selector",
  FFixedPane: "static-panel",
  FIcon: "icon",
  FInteractiveTable: "table-ng",
  FLabel: "label",
  FLayoutApplicationTemplate: "layout-application-template",
  FLayoutLeftPanel: "layout-secondary",
  FLayoutRightPanel: "layout-secondary",
  FList: "list",
  FLoader: "loader",
  FLogo: "logo",
  FMessageBox: "message-box",
  FMinimizablePanel: null,
  FModal: "modal",
  FNavigationMenu: "navigation-menu",
  FOffline: "offline",
  FOutputField: "output-field",
  FPageHeader: "page-header",
  FPageLayout: "layout-application-template",
  FPaginateDataset: null,
  FPaginator: "paginator",
  FProgressbar: "progressbar",
  FRadioField: "radio-button",
  FResizePane: null,
  FSelectField: "select-field",
  FSortFilterDataset: "sort-filter-dataset",
  FStaticField: "output-field",
  FTable: "table",
  FTableButton: "table",
  FTableColumn: "table",
  FTextareaField: "textarea-field",
  FTextField: "text-field",
  FTooltip: "tooltip",
  FValidationForm: null,
  FValidationGroup: "group",
  FWizard: "wizard",
};

const JS_MEDIA_QUERY = { FDetailsPanel: 1, FMinimizablePanel: 1, FTooltip: 1 };

const FKUI_GITHUB = "https://github.com/Forsakringskassan/designsystem/blob/e3bf77abe4fe99b433bc62d2f6118c0776fa5898/packages";

// ─── SFC Templates ─────────────────────────────────────────────────────────

// Minimal templates — import component and render with basic props
function simpleTemplate(name, ...imports) {
  const tag = name;
  const importList = imports.length > 0 ? imports.join(", ") : name;
  return `<template>
  <div style="padding:2rem">
    <${tag} />
  </div>
</template>
<script setup>
import { ${importList} } from "@fkui/vue"
<\/script>`;
}

const TEMPLATES = {
  FBadge: simpleTemplate("FBadge"),
  FButton: `<template>
  <div style="padding:2rem;display:flex;gap:1rem;flex-wrap:wrap">
    <FButton>Primär</FButton>
    <FButton variant="secondary">Sekundär</FButton>
    <FButton variant="tertiary">Tertiär</FButton>
    <FButton size="small">Small</FButton>
  </div>
</template>
<script setup>
import { FButton } from "@fkui/vue"
<\/script>`,
  FCalendar: `<template>
  <div style="padding:2rem">
    <FCalendar v-model="date" :min-date="minDate" :max-date="maxDate" />
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FCalendar } from "@fkui/vue"
import { FDate } from "@fkui/date"
const date = ref(FDate.fromIso("2025-01-15"))
const minDate = ref(FDate.fromIso("2025-01-01"))
const maxDate = ref(FDate.fromIso("2025-12-31"))
<\/script>`,
  FCard: `<template>
  <div style="padding:2rem;max-width:600px">
    <FCard heading-tag="h2"><template #header>Rubrik</template><template #default>Innehåll</template></FCard>
  </div>
</template>
<script setup>
import { FCard } from "@fkui/vue"
<\/script>`,
  FCheckboxField: `<template>
  <div style="padding:2rem"><FCheckboxField v-model="v" :value="true">Kryssruta</FCheckboxField></div>
</template>
<script setup>
import { ref } from "vue"
import { FCheckboxField } from "@fkui/vue"
const v = ref(false)
<\/script>`,
  FContextMenu: `<template>
  <div style="padding:2rem">
    <FButton ref="btn" @click="open=true">Öppna meny</FButton>
    <FContextMenu :is-open="open" :items="items" :anchor="btn?.$el" @select="open=false" @close="open=false" />
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FContextMenu, FButton } from "@fkui/vue"
const btn = ref(null)
const open = ref(false)
const items = [{ key:"edit", label:"Redigera" },{ key:"copy", label:"Kopiera" }]
<\/script>`,
  FCrudDataset: `<template>
  <div style="padding:2rem">
    <FCrudDataset v-model="items">
      <template #add="{ item }"><FButton @click="items.push(item)">Lägg till</FButton></template>
    </FCrudDataset>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FCrudDataset, FButton } from "@fkui/vue"
const items = ref([{ name: "Exempel" }])
<\/script>`,
  FDataTable: `<template>
  <div style="padding:2rem">
    <FDataTable :rows="[{name:'Anna',age:30},{name:'Erik',age:25}]"><template #default><FTableColumn name="name" title="Namn" :sortable="true" /><FTableColumn name="age" title="Ålder" type="numeric" /></template></FDataTable>
  </div>
</template>
<script setup>
import { FDataTable, FTableColumn } from "@fkui/vue"
<\/script>`,
  FDatepickerField: `<template>
  <div style="padding:2rem"><FDatepickerField v-model="d"><template #default>Välj datum</template></FDatepickerField></div>
</template>
<script setup>
import { ref } from "vue"
import { FDatepickerField } from "@fkui/vue"
const d = ref("")
<\/script>`,
  FDefinitionList: simpleTemplate("FDefinitionList"),
  FDetailsPanel: simpleTemplate("FDetailsPanel"),
  FDialogueTree: `<template>
  <div style="padding:2rem">
    <FDialogueTree v-model="question" :dialogue-tree="tree" />
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FDialogueTree } from "@fkui/vue"
const tree = { question:"Vill du fortsätta?", options:[{ key:"yes", label:"Ja", nextQuestion:{ question:"Bra!", options:[] } },{ key:"no", label:"Nej", nextQuestion:{ question:"Tråkigt!", options:[] } }] }
const question = ref(tree)
<\/script>`,
  FErrorList: simpleTemplate("FErrorList"),
  FExpand: simpleTemplate("FExpand"),
  FExpandablePanel: simpleTemplate("FExpandablePanel"),
  FExpandableParagraph: simpleTemplate("FExpandableParagraph"),
  FFieldset: simpleTemplate("FFieldset"),
  FFileItem: simpleTemplate("FFileItem"),
  FFileSelector: simpleTemplate("FFileSelector"),
  FFixedPane: simpleTemplate("FFixedPane"),
  FIcon: `<template>
  <div style="padding:2rem">
    <FIcon name="hamburger" />
  </div>
</template>
<script setup>
import { FIcon } from "@fkui/vue"
<\/script>`,
  FInteractiveTable: `<template>
  <div style="padding:2rem">
    <FInteractiveTable :rows="[{name:'Anna',age:30},{name:'Erik',age:25}]"><template #default><FTableColumn name="name" title="Namn" /><FTableColumn name="age" title="Ålder" type="numeric" /></template></FInteractiveTable>
  </div>
</template>
<script setup>
import { FInteractiveTable, FTableColumn } from "@fkui/vue"
<\/script>`,
  FLabel: simpleTemplate("FLabel"),
  FLayoutApplicationTemplate: simpleTemplate("FLayoutApplicationTemplate"),
  FLayoutLeftPanel: simpleTemplate("FLayoutLeftPanel"),
  FLayoutRightPanel: simpleTemplate("FLayoutRightPanel"),
  FList: simpleTemplate("FList"),
  FLoader: simpleTemplate("FLoader"),
  FLogo: simpleTemplate("FLogo"),
  FMessageBox: simpleTemplate("FMessageBox"),
  FMinimizablePanel: simpleTemplate("FMinimizablePanel"),
  FModal: `<template>
  <div style="padding:2rem">
    <FButton @click="open=true">Öppna modal</FButton>
    <FModal :open="open" @close="open=false"><template #header>Modal</template><template #default>Innehåll</template></FModal>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FModal, FButton } from "@fkui/vue"
const open = ref(false)
<\/script>`,
  FNavigationMenu: `<template>
  <div style="padding:2rem">
    <FNavigationMenu :routes="[{label:'Hem',route:'/home'},{label:'Om',route:'/about'}]" />
  </div>
</template>
<script setup>
import { FNavigationMenu } from "@fkui/vue"
<\/script>`,
  FOffline: simpleTemplate("FOffline"),
  FOutputField: `<template>
  <div style="padding:2rem;max-width:400px"><FOutputField>Exempelvärde</FOutputField></div>
</template>
<script setup>
import { FOutputField } from "@fkui/vue"
<\/script>`,
  FPageHeader: simpleTemplate("FPageHeader"),
  FPageLayout: simpleTemplate("FPageLayout"),
  FPaginateDataset: simpleTemplate("FPaginateDataset"),
  FPaginator: simpleTemplate("FPaginator"),
  FProgressbar: simpleTemplate("FProgressbar"),
  FRadioField: `<template>
  <div style="padding:2rem">
    <FRadioField v-model="v" value="a">A</FRadioField>
    <FRadioField v-model="v" value="b">B</FRadioField>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FRadioField } from "@fkui/vue"
const v = ref("a")
<\/script>`,
  FResizePane: simpleTemplate("FResizePane"),
  FSelectField: `<template>
  <div style="padding:2rem;max-width:400px">
    <FSelectField v-model="v"><template #default>Välj</template>
      <option value="a">A</option><option value="b">B</option>
    </FSelectField>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FSelectField } from "@fkui/vue"
const v = ref("")
<\/script>`,
  FSortFilterDataset: `<template>
  <div style="padding:2rem">
    <FSortFilterDataset :data="data" :sortable-attributes="['name']">
      <template #default="{ data: items }">
        <div v-for="item in items" :key="item.id">{{ item.name }}</div>
      </template>
    </FSortFilterDataset>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FSortFilterDataset } from "@fkui/vue"
const data = ref([{ id:1, name:"Anna" },{ id:2, name:"Erik" },{ id:3, name:"Sara" }])
<\/script>`,
  FStaticField: simpleTemplate("FStaticField"),
  FTable: simpleTemplate("FTable"),
  FTableButton: simpleTemplate("FTableButton"),
  FTableColumn: simpleTemplate("FTableColumn"),
  FTextareaField: `<template>
  <div style="padding:2rem;max-width:400px"><FTextareaField v-model="v"><template #default>Text</template></FTextareaField></div>
</template>
<script setup>
import { ref } from "vue"
import { FTextareaField } from "@fkui/vue"
const v = ref("")
<\/script>`,
  FTextField: `<template>
  <div style="padding:2rem;max-width:400px"><FTextField v-model="v"><template #default>Fält</template></FTextField></div>
</template>
<script setup>
import { ref } from "vue"
import { FTextField } from "@fkui/vue"
const v = ref("")
<\/script>`,
  FTooltip: `<template>
  <div style="padding:2rem">
    <FTooltip screen-reader-text="Information"><template #default>Hovera här</template><template #content>Detta är en tooltip</template></FTooltip>
  </div>
</template>
<script setup>
import { FTooltip } from "@fkui/vue"
<\/script>`,
  FValidationForm: simpleTemplate("FValidationForm"),
  FValidationGroup: simpleTemplate("FValidationGroup"),
  FWizard: `<template>
  <div style="padding:2rem">
    <FWizard title="Guidat formulär" :steps="[{title:'Steg 1'},{title:'Steg 2'}]" />
  </div>
</template>
<script setup>
import { FWizard } from "@fkui/vue"
<\/script>`,
};

// ─── Breakpoint counting ───────────────────────────────────────────────────

function countInDir(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".scss")) continue;
      const content = readFileSync(full, "utf8");
      for (const line of content.split("\n")) {
        if (line.includes("@include") && line.includes("breakpoint")) count++;
        if (line.includes("@media") && !line.includes("forced-colors") && !line.includes("prefers-")) count++;
      }
    }
  }
  walk(dir);
  return count;
}

// ─── Playground URL generation ─────────────────────────────────────────────

function utoa(data) {
  const buffer = strToU8(data);
  const zipped = zlibSync(buffer, { level: 9 });
  const binary = strFromU8(zipped, true);
  return btoa(binary);
}

function makeUrl(template) {
  const data = JSON.stringify({
    "App.vue": template,
    "style.css": `@import url("https://cdn.jsdelivr.net/npm/@fkui/design@${FKUI_VERSION}/lib/fkui.css");`,
    "import-map.json": JSON.stringify({
      imports: {
        "vue": "https://play.vuejs.org/vue.runtime.esm-browser.js",
        "@fkui/vue": `https://esm.sh/@fkui/vue@${FKUI_VERSION}?external=vue`,
        "@fkui/date": `https://esm.sh/@fkui/date@${FKUI_VERSION}?external=vue`,
        "@fkui/logic": `https://esm.sh/@fkui/logic@${FKUI_VERSION}?external=vue`,
      },
    }),
  });
  return `https://play.vuejs.org/#${utoa(data)}`;
}

// ─── HTML Generation ───────────────────────────────────────────────────────

function generateHTML(vueData, scssOnly) {
  const vueRows = vueData.map((c, i) => {
    const bp = c.breakpoints > 0
      ? `<strong>${c.breakpoints}</strong>${c.jsBp > 0 ? ` <small>(${c.scssBp} SCSS + ${c.jsBp} JS)</small>` : ""}`
      : "0";
    const link = c.playgroundUrl
      ? `<a href="${c.playgroundUrl}" target="_blank" rel="noopener">Open →</a>`
      : "—";
    const scssCell = c.scssName !== "—"
      ? `<a href="${FKUI_GITHUB}/design/src/components/${c.scssName}/_${c.scssName}.scss" target="_blank" rel="noopener">${c.scssName}</a>`
      : "—";
    return `      <tr>
        <td>${i + 1}</td>
        <td><code><a href="${c.sourceUrl}" target="_blank" rel="noopener">${c.name}</a></code></td>
        <td>${scssCell}</td>
        <td>${bp}</td>
        <td>${link}</td>
      </tr>`;
  }).join("\n");

  const scssRows = scssOnly.map((c, i) => {
    const bp = c.breakpoints > 0 ? `<strong>${c.breakpoints}</strong>` : "0";
    return `      <tr>
        <td>${i + 1}</td>
        <td><code><a href="${FKUI_GITHUB}/design/src/components/${c.name}/_${c.name}.scss" target="_blank" rel="noopener">${c.name}</a></code></td>
        <td>${bp}</td>
        <td>CSS-only</td>
      </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FKUI Components — @fkui/vue@${FKUI_VERSION}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fkui/design@${FKUI_VERSION}/lib/fkui.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 2rem; background: #f5f5f5; }
    main { max-width: 1280px; margin: 0 auto; }
    h1 { margin-top: 0; }
    .meta { color: #666; margin-bottom: 2rem; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { padding: 0.5rem 1rem; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #fafafa; font-weight: 600; position: sticky; top: 0; }
    td:nth-child(4) { text-align: center; }
    td:nth-child(5) { text-align: center; }
    code { background: #f0f0f0; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    strong { color: #d40000; }
    small { color: #888; }
    .stats { display: flex; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .stat { background: white; padding: 1rem 1.5rem; border-radius: 4px; }
    .stat-number { font-size: 2rem; font-weight: 700; }
    .stat-label { color: #666; font-size: 0.85rem; }
    @media (max-width: 639px) {
      body { padding: 1rem; }
      th, td { padding: 0.3rem 0.5rem; font-size: 0.85rem; }
    }
  </style>
</head>
<body>
<main>
  <h1>FKUI Components</h1>
  <p class="meta">Generated from <code>@fkui/vue@${FKUI_VERSION}</code> on ${new Date().toISOString().split("T")[0]}</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-number">${vueData.length}</div>
      <div class="stat-label">Vue components</div>
    </div>
    <div class="stat">
      <div class="stat-number">${scssOnly.length}</div>
      <div class="stat-label">SCSS-only components</div>
    </div>
    <div class="stat">
      <div class="stat-number">${vueData.filter(c => c.breakpoints > 0).length}</div>
      <div class="stat-label">With breakpoints</div>
    </div>
  </div>

  <h2>Vue Components</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Component</th>
        <th>SCSS</th>
        <th>Breakpoints</th>
        <th>Playground</th>
      </tr>
    </thead>
    <tbody>
${vueRows}
    </tbody>
  </table>

  <h2>SCSS-only Components (no Vue wrapper)</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Component</th>
        <th>Breakpoints</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
${scssRows}
    </tbody>
  </table>

  <footer style="margin-top:3rem;padding-top:1rem;border-top:1px solid #e0e0e0;color:#888;font-size:0.8rem">
    Generated by <a href="https://github.com/pattespatte/fkui-components-list">fkui-components-list</a>
  </footer>
</main>
</body>
</html>`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  // 1. Get SCSS component dirs
  const scssDirs = existsSync(SCSS_SRC)
    ? readdirSync(SCSS_SRC, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()
    : [];

  const scssBp = {};
  for (const name of scssDirs) {
    scssBp[name] = countInDir(join(SCSS_SRC, name));
  }

  // 2. Vue components from mapping
  const vueNames = Object.keys(VUE_TO_SCSS).sort();
  const vueData = vueNames.map(name => {
    const scssName = VUE_TO_SCSS[name];
    const sBp = scssName ? (scssBp[scssName] || 0) : 0;
    const jBp = JS_MEDIA_QUERY[name] || 0;
    const template = TEMPLATES[name];
    return {
      name,
      scssName: scssName || "—",
      sourceUrl: `${FKUI_GITHUB}/vue/src/components/${name}/${name}.vue`,
      breakpoints: sBp + jBp,
      scssBp: sBp,
      jsBp: jBp,
      playgroundUrl: template ? makeUrl(template) : null,
    };
  });

  // 3. SCSS-only
  const mapped = new Set(Object.values(VUE_TO_SCSS).filter(Boolean));
  const scssOnly = scssDirs.filter(n => !mapped.has(n)).map(n => ({ name: n, breakpoints: scssBp[n] || 0 }));

  // 4. Generate HTML
  const html = generateHTML(vueData, scssOnly);
  const distDir = join(ROOT, "dist");
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
  const outPath = join(distDir, "index.html");
  writeFileSync(outPath, html, "utf8");
  console.log(`Generated: ${outPath}`);
  console.log(`  ${vueData.length} Vue components, ${scssOnly.length} SCSS-only`);
  console.log(`  ${vueData.filter(c => c.breakpoints > 0).length} with breakpoints`);
  console.log(`  @fkui/vue@${FKUI_VERSION}`);
}

main();
