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

// Common setup lines — $t mock and icon spritesheet injection
const SETUP_I18N = `import { getCurrentInstance } from "vue"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback`;

const SETUP_ICONS = `import iconLib from "@fkui/icon-lib-default"
onMounted(() => { iconLib.f.injectSpritesheet() })`;

function setupBlock(imports, { i18n = false, icons = false, extra = "" } = {}) {
  const vueImports = ["vue", imports];
  const lines = [];
  lines.push(`import { ${vueImports.join(", ")} } from "@fkui/vue"`);
  if (icons) lines.push(SETUP_ICONS);
  if (i18n) lines.push(SETUP_I18N);
  if (extra) lines.push(extra);
  return lines.join("\n");
}

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
import { onMounted, getCurrentInstance } from "vue"
import { ${importList} } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
<\/script>`;
}

const TEMPLATES = {
  FBadge: `<template>
  <div style="padding:2rem;display:flex;gap:1rem;flex-wrap:wrap">
    <FBadge status="default">Default</FBadge>
    <FBadge status="warning">Warning</FBadge>
    <FBadge status="error">Error</FBadge>
    <FBadge status="success">Success</FBadge>
    <FBadge status="info">Info</FBadge>
  </div>
</template>
<script setup>
import { FBadge } from "@fkui/vue"
<\/script>`,
  FButton: `<template>
  <div class="density-default" style="padding:2rem;display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-start">
    <FButton>Primär</FButton>
    <FButton variant="secondary">Sekundär</FButton>
    <FButton variant="tertiary">Tertiär</FButton>
    <FButton size="small">Liten</FButton>
  </div>
</template>
<script setup>
import { FButton } from "@fkui/vue"
<\/script>`,
  FCalendar: `<template>
  <div style="padding:2rem">
    <FCalendar v-model="date" :min-date="minDate" :max-date="maxDate">
      <template #default="{ date: day }">
        <FCalendarDay :day="day" />
      </template>
    </FCalendar>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FCalendar, FCalendarDay } from "@fkui/vue"
import { FDate } from "@fkui/date"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const date = ref(FDate.fromIso("2027-01-15"))
const minDate = ref(FDate.fromIso("2027-01-01"))
const maxDate = ref(FDate.fromIso("2027-12-31"))
<\/script>`,
  FCard: `<template>
  <div style="padding:2rem;max-width:600px">
    <FCard>
      <template #header="{ headingSlotClass }">
        <h3 :class="headingSlotClass">Rubrik</h3>
      </template>
      <template #default>Innehåll</template>
    </FCard>
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
import { ref, onMounted, getCurrentInstance } from "vue"
import { FContextMenu, FButton } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const btn = ref(null)
const open = ref(false)
const items = [{ key:"edit", label:"Redigera" },{ key:"copy", label:"Kopiera" }]
<\/script>`,
  FCrudDataset: `<template>
  <div style="padding:2rem">
    <FCrudDataset v-model="fruits" @created="save" @updated="save" @deleted="save">
      <template #default="{ updateItem, deleteItem }">
        <FInteractiveTable :rows="fruits" key-attribute="id">
          <template #caption><b>Frukter</b></template>
          <template #default="{ row }">
            <FTableColumn title="Namn" type="text" shrink>{{ row.name }}</FTableColumn>
            <FTableColumn title="Land" type="text" shrink>{{ row.origin }}</FTableColumn>
            <FTableColumn title="Åtgärd" type="action" shrink>
              <FTableButton icon="pen" @click="updateItem(row)">Ändra</FTableButton>
              <FTableButton icon="trashcan" @click="deleteItem(row)">Ta bort</FTableButton>
            </FTableColumn>
          </template>
        </FInteractiveTable>
      </template>
      <template #modify="{ item }">
        <FTextField v-model="item.name" type="text">Namn</FTextField>
        <FTextField v-model="item.origin" type="text">Land</FTextField>
      </template>
      <template #add="{ item }">
        <FTextField v-model="item.id" type="text">ID</FTextField>
        <FTextField v-model="item.name" type="text">Namn</FTextField>
        <FTextField v-model="item.origin" type="text">Land</FTextField>
      </template>
      <template #delete="{ item }">
        Vill du verkligen radera "{{ item.name }}"?
      </template>
    </FCrudDataset>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FCrudDataset, FInteractiveTable, FTableButton, FTableColumn, FTextField } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const fruits = ref([
  { id: "1", name: "Äpple", origin: "Sverige" },
  { id: "2", name: "Banan", origin: "Colombia" },
  { id: "3", name: "Citron", origin: "Spanien" },
])
function save(row) { console.log("Saved:", row) }
<\/script>`,
  FDataTable: `<template>
  <div style="padding:2rem">
    <FDataTable :rows="people" key-attribute="id">
      <template #caption><b>Personer</b></template>
      <template #default="{ row }">
        <FTableColumn title="Namn" type="text" shrink>{{ row.name }}</FTableColumn>
        <FTableColumn title="Ålder" type="numeric">{{ row.age }}</FTableColumn>
        <FTableColumn title="Stad" type="text">{{ row.city }}</FTableColumn>
      </template>
    </FDataTable>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FDataTable, FTableColumn } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const people = ref([
  { id: "1", name: "Anna", age: 30, city: "Stockholm" },
  { id: "2", name: "Erik", age: 25, city: "Göteborg" },
  { id: "3", name: "Sara", age: 28, city: "Malmö" },
])
<\/script>`,
  FDatepickerField: `<template>
  <div style="padding:2rem;max-width:400px">
    <FDatepickerField v-model="d">
      <template #default>Välj datum</template>
    </FDatepickerField>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FDatepickerField, ValidationPlugin } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const app = getCurrentInstance().appContext.app
app.use(ValidationPlugin)
app.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const d = ref("")
<\/script>`,
  FDefinitionList: `<template>
  <div style="padding:2rem;max-width:600px">
    <FDefinitionList :definitions="defs" />
  </div>
</template>
<script setup>
import { FDefinitionList } from "@fkui/vue"
const defs = [
  { term: "Skulle ha jobbat", definition: "8 timmar" },
  { term: "Vabbade", definition: "8 timmar" },
  { term: "Omfattning", definition: "100 procent" },
]
<\/script>`,
  FDetailsPanel: `<template>
  <div style="padding:2rem">
    <FButton @click="openPanel">Öppna panel</FButton>
    <FDetailsPanel name="demo">
      <template #default="panelScope">
        <h2 :slot="panelScope.header">Detaljpanel</h2>
        <p :slot="panelScope.content">Detaljerat innehåll här.</p>
      </template>
    </FDetailsPanel>
  </div>
</template>
<script setup>
import { onMounted, getCurrentInstance } from "vue"
import { FButton, FDetailsPanel, useDetailsPanel } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const panel = useDetailsPanel("demo")
function openPanel() { panel.open({}) }
<\/script>`,
  FDialogueTree: `<template>
  <div style="padding:2rem">
    <FDialogueTree v-model="progress" :dialogue-tree="tree">
      <template #default="{ userData }"><p>Resultat: {{ userData }}</p></template>
    </FDialogueTree>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FDialogueTree } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const tree = { label:"Vill du fortsätta?", options:[{ label:"Ja", question:{ label:"Bekräftelse", userData:"ja" } },{ label:"Nej", question:{ label:"Avbryt", userData:"nej" } }] }
const progress = ref({})
<\/script>`,
  FErrorList: `<template>
  <div style="padding:2rem;max-width:600px">
    <FErrorList :items="items">
      <template #title>Kolla på felen nedan</template>
    </FErrorList>
    <FTextField id="fornamn">Förnamn</FTextField>
    <FTextField id="efternamn">Efternamn</FTextField>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FErrorList, FTextField } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const items = ref([
  { id: "fornamn", title: "Förnamn" },
  { id: "efternamn", title: "Efternamn" },
])
<\/script>`,
  FExpand: `<template>
  <div style="padding:2rem">
    <FButton @click="show=!show">Visa/dölj</FButton>
    <FExpand>
      <p v-if="show">Detta innehåll expanderar och kollapsar med animering.</p>
    </FExpand>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FExpand, FButton } from "@fkui/vue"
const show = ref(true)
<\/script>`,
  FExpandablePanel: `<template>
  <div style="padding:2rem;max-width:600px">
    <FExpandablePanel :expanded="open" @toggle="open=!open">
      <template #title>Mer information</template>
      <p>Här är innehållet som visas när panelen är expanderad.</p>
    </FExpandablePanel>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FExpandablePanel } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const open = ref(false)
<\/script>`,
  FExpandableParagraph: `<template>
  <div style="padding:2rem;max-width:600px">
    <FExpandableParagraph :expanded="open" header-tag="span" @toggle="open=!open">
      <template #title>Mer information</template>
      <template #default><p>Här är innehållet som visas när stycket är expanderat.</p></template>
    </FExpandableParagraph>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FExpandableParagraph } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const open = ref(false)
<\/script>`,
  FFieldset: `<template>
  <div style="padding:2rem;max-width:600px">
    <FFieldset name="colors">
      <template #label>Välj färg</template>
      <template #default>
        <FCheckboxField v-model="checks" :value="'röd'">Röd</FCheckboxField>
        <FCheckboxField v-model="checks" :value="'blå'">Blå</FCheckboxField>
      </template>
    </FFieldset>
  </div>
</template>
<script setup>
import { ref, getCurrentInstance } from "vue"
import { FFieldset, FCheckboxField } from "@fkui/vue"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
const checks = ref([])
<\/script>`,
  FFileItem: `<template>
  <div style="padding:2rem;max-width:600px">
    <FFileItem file-name="dokument.pdf" mime-type="application/pdf" />
  </div>
</template>
<script setup>
import { getCurrentInstance, onMounted } from "vue"
import { FFileItem } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
onMounted(() => { iconLib.f.injectSpritesheet() })
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
appContext.config.globalProperties.$t = (key, fallback) => fallback
<\/script>`,
  FFileSelector: `<template>
  <div style="padding:2rem;max-width:600px">
    <FFileSelector @change="onFile">Välj fil</FFileSelector>
    <p v-if="file" style="margin-top:1rem">Vald fil: {{ file }}</p>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FFileSelector } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const file = ref("")
function onFile(e) { file.value = e[0]?.name || "" }
<\/script>`,
  FFixedPane: `<template>
  <div style="padding:2rem">
    <FFixedPane><p>Fast panelinnehåll</p></FFixedPane>
  </div>
</template>
<script setup>
import { FFixedPane } from "@fkui/vue"
<\/script>`,
  FIcon: `<template>
  <div style="padding:2rem">
    <div v-for="lib in libraries" :key="lib.name" style="margin-bottom:1.5rem">
      <h4>{{ lib.name }} ({{ lib.icons.length }})</h4>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
        <div v-for="icon in lib.icons" :key="icon" style="text-align:center;width:60px">
          <FIcon :name="icon" :library="lib.name" />
          <div style="font-size:10px;margin-top:2px;word-break:break-all">{{ icon }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, getCurrentInstance, ref } from "vue"
import { FIcon } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
const libraries = ref([])
function decamelize(v) { return v.replaceAll(/([A-Z])/g, (_, c) => "-" + c.toLowerCase()) }
onMounted(() => {
  Object.values(iconLib).forEach(e => { if (e.injectSpritesheet) e.injectSpritesheet() })
  libraries.value = Object.entries(iconLib)
    .filter(([_, e]) => e.metadata)
    .map(([n, e]) => ({ name: decamelize(n), icons: e.metadata.map(i => i.name) }))
})
<\/script>`,
  FInteractiveTable: `<template>
  <div style="padding:2rem">
    <FSortFilterDataset :data="rows" :sortable-attributes="sortableAttributes">
      <template #header>
        <FButton variant="tertiary" icon-left="trashcan" size="small" @click="onRemoveSelectedRows">
          Ta bort valda frukter
        </FButton>
      </template>
      <template #default="{ sortFilterResult }">
        <FTable v-model:selected-rows="valdaRader" :rows="sortFilterResult" :columns="columns" striped selectable="multi">
          <template #caption><span class="sr-only">Fruktexempel</span></template>
        </FTable>
      </template>
    </FSortFilterDataset>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FSortFilterDataset, FButton, FTable, defineTableColumns, useDatasetRef, useModal, removeDatasetRows } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const lander = ["", "Colombia", "Costa Rica", "Dominikanska republiken", "Ecuador", "Frankrike", "Italien", "Spanien", "Sverige", "Sydafrika"]
const columns = defineTableColumns([
  { type: "text", header: "Frukt", key: "namn" },
  { type: "select", options: lander, header: "Land", label: () => "Val av land", key: "land" },
  { type: "text:currency", header: "Pris", key: "pris" },
  { type: "text", editable: true, label: (row) => "Kommentar till " + row.namn, header: "Kommentar", key: "kommentar" },
])
const rows = useDatasetRef([
  { namn: "Apelsin", land: "", kommentar: "", sorter: [
    { namn: "Navelina", land: "Spanien", pris: 28.73 },
    { namn: "Navel (Navels)", land: "Spanien", pris: 18 },
    { namn: "Tarocco (Blodapelsin)", land: "Italien", pris: 35 },
    { namn: "Valencia (Juiceapelsin)", land: "Sydafrika", pris: 22 },
  ]},
  { namn: "Äpple", land: "", kommentar: "Säsongsvariationer förekommer", sorter: [
    { namn: "Ingrid Marie", land: "Sverige", pris: 29.9 },
    { namn: "Aroma", land: "Sverige", pris: 32.5 },
    { namn: "Royal Gala", land: "Italien", pris: 24.95 },
    { namn: "Granny Smith", land: "Frankrike", pris: 28 },
    { namn: "Pink Lady", land: "Italien", pris: 42 },
  ]},
  { namn: "Banan", land: "", kommentar: "Säljs oftast per kilo", sorter: [
    { namn: "Cavendish", land: "Ecuador", pris: 21.9 },
    { namn: "Ekologiska Bananer", land: "Dominikanska republiken", pris: 28.5 },
    { namn: "Fairtrade Bananer", land: "Colombia", pris: 26 },
    { namn: "Babybanan", land: "Ecuador", pris: 45 },
  ]},
], "sorter")
const sortableAttributes = { namn: "Frukt" }
const valdaRader = ref([])
const { confirmModal } = useModal()
async function onRemoveSelectedRows() {
  if (valdaRader.value.length === 0) return
  const confirmed = await confirmModal({ heading: "Ta bort frukt(er)", content: "Är du säker att du vill ta bort valda frukt(er)?", confirm: "Ja, ta bort", dismiss: "Nej, behåll" })
  if (confirmed) removeDatasetRows(rows, valdaRader)
}
<\/script>`,
  FLabel: `<template>
  <div style="padding:2rem;max-width:400px">
    <FLabel for="demo-input">Etikett</FLabel>
    <input id="demo-input" style="width:100%;padding:0.5rem" />
  </div>
</template>
<script setup>
import { FLabel } from "@fkui/vue"
<\/script>`,
  FLayoutApplicationTemplate: `<template>
  <FLayoutApplicationTemplate>
    <template #header>
      <div style="background-color:green;color:white"><a href="#">[sidhuvud]</a></div>
    </template>
    <template #top-navigation>
      <div style="background-color:lightgray"><a href="#">[toppnavigering]</a></div>
    </template>
    <FLayoutLeftPanel initial-width="180">
      <template #heading><h3>Meny</h3></template>
      <template #content>[innehåll]</template>
      <template #default>
        <FLayoutRightPanel>
          <template #heading><h3>{{ selectedTitle }}</h3></template>
          <template #content>
            <p>{{ selectedText }}</p>
            <FButton @click="closePanel()">Stäng</FButton>
          </template>
          <template #default>
            <div style="padding:2rem">
              <h1>Primäryta</h1>
              <p>Klicka nedan för att se mer i sekundärpanelen.</p>
              <ul>
                <li v-for="item in items" :key="item.title">
                  <a href="javascript:void(0)" @click="openPanel(item)">{{ item.title }}</a>
                </li>
              </ul>
            </div>
          </template>
        </FLayoutRightPanel>
      </template>
    </FLayoutLeftPanel>
    <template #footer>
      <div style="background-color:green;color:white;text-align:center"><a href="#">[sidfot]</a></div>
    </template>
  </FLayoutApplicationTemplate>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FLayoutApplicationTemplate, FLayoutLeftPanel, FLayoutRightPanel, FLayoutRightPanelService, FButton } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const selectedText = ref("")
const selectedTitle = ref("")
const items = [
  { title: "Träutensilier", text: "Träutensilierna i ett tryckeri äro ingalunde en oviktig faktor, för trevnadens, ordningens och ekonomiens upprätthållande." },
  { title: "Lorem ipsum", text: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." },
]
function openPanel(item) { selectedTitle.value = item.title; selectedText.value = item.text; FLayoutRightPanelService.open() }
function closePanel() { FLayoutRightPanelService.close() }
<\/script>
<style>
html, body { height: 100%; margin: 0; overflow: hidden; }
.layout-application-template { height: 100%; overflow: hidden; }
.layout-application-template__main { overflow: auto; }
.layout-navigation__navigation[aria-expanded="false"] { width: 2.5rem !important; }
.layout-navigation__navigation[aria-expanded="false"] ~ #layout-navigation__primary { margin-left: 2.5rem !important; }
.layout-secondary__secondary { max-width: 40%; }
</style>`,
  FLayoutLeftPanel: `<template>
  <FPageLayout layout="three-column">
    <template #default="layoutScope">
      <FResizePane :slot="layoutScope.left" min="150px" max="40%" initial="250px">
        <FLayoutLeftPanel>
          <template #heading><h3>Meny</h3></template>
          <template #content>
            <ul style="list-style:none;padding:0">
              <li style="padding:0.25rem 0"><a href="#">Länk 1</a></li>
              <li style="padding:0.25rem 0"><a href="#">Länk 2</a></li>
              <li style="padding:0.25rem 0"><a href="#">Länk 3</a></li>
            </ul>
          </template>
          <template #default>
            <div style="padding:2rem">
              <h2>Huvudinnehåll</h2>
              <p>Här visas sidans innehåll.</p>
            </div>
          </template>
        </FLayoutLeftPanel>
      </FResizePane>
    </template>
  </FPageLayout>
</template>
<script setup>
import { onMounted, getCurrentInstance } from "vue"
import { FLayoutLeftPanel, FPageLayout, FResizePane } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
<\/script>`,
  FLayoutRightPanel: `<template>
  <FLayoutRightPanel>
    <template #default><div style="padding:2rem"><p>Huvudinnehåll</p><FButton @click="open">Öppna panel</FButton></div></template>
    <template #heading>Detaljer</template>
    <template #content><div style="padding:1rem"><p>Högerpanelinnehåll</p></div></template>
  </FLayoutRightPanel>
</template>
<script setup>
import { onMounted, getCurrentInstance } from "vue"
import { FLayoutRightPanel, FButton } from "@fkui/vue"
import { FLayoutRightPanelService } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
function open() { FLayoutRightPanelService.open() }
<\/script>`,
  FList: `<template>
  <div style="padding:2rem;max-width:400px">
    <FList :items="items" key-attribute="id"><template #default="{ item }">{{ item.name }}</template></FList>
  </div>
</template>
<script setup>
import { getCurrentInstance } from "vue"
import { FList } from "@fkui/vue"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
const items = [{ id:1, name:"Äpple" },{ id:2, name:"Banan" },{ id:3, name:"Citron" }]
<\/script>`,
  FLoader: `<template>
  <div style="padding:2rem">
    <FLoader :show="true" />
  </div>
</template>
<script setup>
import { getCurrentInstance } from "vue"
import { FLoader } from "@fkui/vue"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
<\/script>`,
  FLogo: `<template>
  <div style="padding:2rem;background:#f4f4f4">
    <FLogo>Försäkringskassan</FLogo>
  </div>
</template>
<script setup>
import { FLogo } from "@fkui/vue"
<\/script>
<style>
:root {
  --f-logo-image-small: url("data:image/svg+xml,%3Csvg id='Lager_1' data-name='Lager 1' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 47.74 53.27'%3E%3Cdefs%3E%3Cstyle%3E.cls-1{fill:none;stroke:%23005aad;stroke-width:0.59px;}.cls-2{fill:%23005aad;}%3C/style%3E%3C/defs%3E%3Cg id='Lager_1-2' data-name='Lager 1'%3E%3Cpath class='cls-1' d='M47.16,44.81a2.33,2.33,0,0,1-2.34,2.35H2.64A2.34,2.34,0,0,1,.3,44.81V2.64A2.34,2.34,0,0,1,2.64.3H44.82a2.34,2.34,0,0,1,2.34,2.34V44.81Z'/%3E%3Cpath class='cls-2' d='M19.7,19a.77.77,0,0,0-.77.78v11a2.09,2.09,0,0,0,.55,1.33L30.9,43.49a2.2,2.2,0,0,0,1.35.56h11a.8.8,0,0,0,.79-.78V32.33A2.12,2.12,0,0,0,43.45,31L32,19.58A2.17,2.17,0,0,0,30.68,19Z'/%3E%3Cpath class='cls-2' d='M4.15,3.4a.79.79,0,0,0-.78.78V43.27c0,.44.25.54.55.22L15.25,32.1a2.17,2.17,0,0,0,.54-1.34V16.67a.79.79,0,0,1,.79-.78h14.1A2.2,2.2,0,0,0,32,15.34L43.44,4c.31-.3.2-.54-.23-.54H4.15Z'/%3E%3C/g%3E%3C/svg%3E");
  --f-logo-image-large: url("data:image/svg+xml,%3Csvg id='Lager_1' data-name='Lager 1' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 47.74 53.27'%3E%3Cdefs%3E%3Cstyle%3E.cls-1{fill:none;stroke:%23005aad;stroke-width:0.59px;}.cls-2{fill:%23005aad;}%3C/style%3E%3C/defs%3E%3Cg id='Lager_1-2' data-name='Lager 1'%3E%3Cpath class='cls-1' d='M47.16,44.81a2.33,2.33,0,0,1-2.34,2.35H2.64A2.34,2.34,0,0,1,.3,44.81V2.64A2.34,2.34,0,0,1,2.64.3H44.82a2.34,2.34,0,0,1,2.34,2.34V44.81Z'/%3E%3Cpath class='cls-2' d='M19.7,19a.77.77,0,0,0-.77.78v11a2.09,2.09,0,0,0,.55,1.33L30.9,43.49a2.2,2.2,0,0,0,1.35.56h11a.8.8,0,0,0,.79-.78V32.33A2.12,2.12,0,0,0,43.45,31L32,19.58A2.17,2.17,0,0,0,30.68,19Z'/%3E%3Cpath class='cls-2' d='M4.15,3.4a.79.79,0,0,0-.78.78V43.27c0,.44.25.54.55.22L15.25,32.1a2.17,2.17,0,0,0,.54-1.34V16.67a.79.79,0,0,1,.79-.78h14.1A2.2,2.2,0,0,0,32,15.34L43.44,4c.31-.3.2-.54-.23-.54H4.15Z'/%3E%3C/g%3E%3C/svg%3E");
  --f-logo-size-small: 0.6rem;
  --f-logo-size-large: 0.6rem 4rem;
}
</style>`,
  FMessageBox: `<template>
  <div style="padding:2rem;max-width:600px">
    <FMessageBox type="info"><template #default="{ headingSlotClass }"><h2 :class="headingSlotClass">Informationsmeddelande</h2><p>Detta är ett exempel på en meddelanderuta.</p></template></FMessageBox>
  </div>
</template>
<script setup>
import { onMounted, getCurrentInstance } from "vue"
import { FMessageBox } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
<\/script>`,
  FMinimizablePanel: `<template>
  <FPageLayout layout="three-column">
    <template #default="layoutScope">
      <FResizePane :slot="layoutScope.left" min="150px" max="40%" initial="600px">
        <FMinimizablePanel>
          <template #default="panelScope">
            <template v-if="panelScope.isOpen">
              <h1 :slot="panelScope.header" style="background:#e5e5f5;padding:0.5rem 1rem;margin:0">Rubrik</h1>
              <p :slot="panelScope.content" style="padding:1rem">Innehåll</p>
              <div :slot="panelScope.footer" style="background:#f4f4f4;padding:0.5rem 1rem;border-top:1px solid #ccc">Fot</div>
            </template>
          </template>
        </FMinimizablePanel>
      </FResizePane>
      <div :slot="layoutScope.content" style="padding:2rem;background:#fff">
        <h2>Applikationsyta</h2>
        <p>Här visas huvudinnehållet.</p>
      </div>
    </template>
  </FPageLayout>
</template>
<script setup>
import { onMounted, getCurrentInstance } from "vue"
import { FMinimizablePanel, FPageLayout, FResizePane } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
<\/script>`,
  FModal: `<template>
  <div style="padding:2rem">
    <FButton @click="open=true">Öppna modal</FButton>
    <FModal :is-open="open" @close="open=false">
      <template #header>Modal</template>
      <template #content><p>Innehåll</p></template>
    </FModal>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FModal, FButton } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const open = ref(false)
<\/script>`,
  FNavigationMenu: `<template>
  <div style="padding:2rem">
    <FNavigationMenu :routes="[{label:'Hem',route:'/home'},{label:'Om',route:'/about'}]" />
  </div>
</template>
<script setup>
import { onMounted, getCurrentInstance } from "vue"
import { FNavigationMenu } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
<\/script>`,
  FOffline: `<script lang="ts">
import { defineComponent } from "vue"
import { FButton, FOffline } from "@fkui/vue"
export default defineComponent({
  components: { FButton, FOffline },
  data() {
    return {
      isPushed: false,
      offlineMessage: "Det verkar som att du inte har någon internetuppkoppling just nu. Tänk på att du behöver uppkoppling för att kunna signera",
    }
  },
  methods: {
    toggle() {
      if (this.isPushed) {
        window.dispatchEvent(new Event("online"))
        this.isPushed = false
      } else {
        window.dispatchEvent(new Event("offline"))
        this.isPushed = true
      }
    },
  },
})
<\/script>
<template>
  <div style="padding:2rem">
    <f-offline> {{ offlineMessage }} </f-offline>
    <f-button @click="toggle">Visa/Dölj komponent</f-button>
  </div>
</template>`,
  FOutputField: `<template>
  <div style="padding:2rem;max-width:400px">
    <FOutputField id="output-demo" for="input-demo">
      <template #label>Summa</template>
      Exempelvärde
    </FOutputField>
  </div>
</template>
<script setup>
import { FOutputField } from "@fkui/vue"
<\/script>`,
  FPageHeader: `<template>
  <FPageHeader>Min applikation</FPageHeader>
</template>
<script setup>
import { FPageHeader } from "@fkui/vue"
<\/script>`,
  FPageLayout: `<template>
  <f-page-layout layout="three-column">
    <template #default="{ header, left, right, content, footer }">
      <header :slot="header" style="background:darkred;color:white;padding:1rem">[header]</header>
      <div :slot="left" style="background:greenyellow;padding:1rem;flex-grow:1;width:25cqw">[left]</div>
      <div :slot="right" style="background:hotpink;padding:1rem;flex-grow:1;width:25cqw">[right]</div>
      <main :slot="content" style="flex-grow:1;padding:1rem">[main]</main>
      <footer :slot="footer" style="background:cyan;color:black;padding:1rem">[footer]</footer>
    </template>
  </f-page-layout>
</template>
<script setup>
import { FPageLayout } from "@fkui/vue"
<\/script>`,
  FPaginateDataset: `<template>
  <div style="padding:2rem">
    <FPaginateDataset :items="items" :itemsPerPage="3">
      <template #default="{ items: currentPageItems }">
        <FList :items="currentPageItems" key-attribute="id">
          <template #default="{ item }"><h6>{{ item.name }} ({{ item.id }})</h6></template>
        </FList>
        <FPaginator navigator-label="Navigate between persons" />
      </template>
    </FPaginateDataset>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FPaginateDataset, FPaginator, FList } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const items = [{id:1,name:"Anna"},{id:2,name:"Erik"},{id:3,name:"Sara"},{id:4,name:"Olof"},{id:5,name:"Karin"},{id:6,name:"Nils"}]
<\/script>`,
  FPaginator: `<template>
  <div style="padding:2rem">
    <FPaginator :number-of-pages="5" v-model="page" />
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FPaginator } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const page = ref(1)
<\/script>`,
  FProgressbar: `<template>
  <div style="padding:2rem;max-width:400px">
    <FProgressbar :value="65" aria-label="Uppladdningsförlopp" />
  </div>
</template>
<script setup>
import { FProgressbar } from "@fkui/vue"
<\/script>`,
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
  FResizePane: `<template>
  <f-page-layout layout="left-panel">
    <template #default="{ left, content }">
      <f-resize-pane :slot="left" min="100px" max="40%" initial="25%">
        <div class="panel">
          <p>Panel</p>
        </div>
      </f-resize-pane>
      <div :slot="content" style="padding:2rem">
        <h2>Huvudyta</h2>
        <p>Drag i handtaget för att ändra storlek.</p>
      </div>
    </template>
  </f-page-layout>
</template>
<script setup>
import { FResizePane, FPageLayout } from "@fkui/vue"
<\/script>
<style>
.panel { padding:1rem; background:#e5e5f5; height:100%; border-right:2px solid #ccc; }
</style>`,
  FSelectField: `<template>
  <div style="padding:2rem;max-width:400px">
    <f-select-field id="dropplista" v-model="v">
      <template #label>Etikett rubrik</template>
      <option disabled hidden value="">Välj…</option>
      <option value="1">Alternativ 1</option>
      <option value="2">Alternativ 2</option>
      <option value="3">Alternativ 3</option>
    </f-select-field>
  </div>
</template>
<script setup>
import { ref, onMounted } from "vue"
import { FSelectField } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
onMounted(() => { iconLib.f.injectSpritesheet() })
const v = ref("")
<\/script>`,
  FSortFilterDataset: `<template>
  <div style="padding:2rem">
    <FSortFilterDataset :data="fruits" default-sort-attribute="name" :default-sort-ascending="true" :sortable-attributes="sortableAttributes">
      <template #default="{ sortFilterResult }">
        <FInteractiveTable :rows="sortFilterResult" striped key-attribute="id">
          <template #caption><span class="sr-only">Frukter</span></template>
          <template #default="{ row }">
            <FTableColumn name="name" title="Namn" type="text" shrink>{{ row.name }}</FTableColumn>
            <FTableColumn name="origin" title="Land" type="text" shrink>{{ row.origin }}</FTableColumn>
          </template>
        </FInteractiveTable>
      </template>
    </FSortFilterDataset>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FSortFilterDataset, FInteractiveTable, FTableColumn } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const sortableAttributes = { name: "Namn", origin: "Land" }
const fruits = ref([
  { id:1, name:"Äpple", origin:"Sverige" },
  { id:2, name:"Banan", origin:"Colombia" },
  { id:3, name:"Citron", origin:"Spanien" },
  { id:4, name:"Apelsin", origin:"Spanien" },
  { id:5, name:"Vattenmelon", origin:"Spanien" },
])
<\/script>`,
  FStaticField: `<template>
  <div style="padding:2rem;max-width:400px">
    <FStaticField><template #label>Namn</template>Anna Andersson</FStaticField>
  </div>
</template>
<script setup>
import { FStaticField } from "@fkui/vue"
<\/script>`,
  FTable: `<template>
  <div style="padding:2rem">
    <FSortFilterDataset :data="rows" :sortable-attributes="{ namn: 'Frukt' }">
      <template #default="{ sortFilterResult }">
        <FTable :rows="sortFilterResult" :columns striped key-attribute="namn">
          <template #caption><span class="sr-only">Frukter</span></template>
        </FTable>
      </template>
    </FSortFilterDataset>
  </div>
</template>
<script setup>
import { onMounted, getCurrentInstance } from "vue"
import { FTable, FSortFilterDataset, defineTableColumns, useDatasetRef } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const columns = defineTableColumns([
  { type: "text", header: "Frukt", key: "namn" },
  { type: "text", header: "Land", key: "land" },
  { type: "text:currency", header: "Pris", key: "pris" },
])
const rows = useDatasetRef([
  { namn:"Apelsin", land:"", sorter:[
    { namn:"Navelina", land:"Spanien", pris:28.73 },
    { namn:"Tarocco", land:"Italien", pris:35 },
    { namn:"Valencia", land:"Sydafrika", pris:22 },
  ]},
  { namn:"Äpple", land:"", sorter:[
    { namn:"Ingrid Marie", land:"Sverige", pris:29.9 },
    { namn:"Royal Gala", land:"Italien", pris:24.95 },
    { namn:"Pink Lady", land:"Italien", pris:42 },
  ]},
  { namn:"Banan", land:"", sorter:[
    { namn:"Cavendish", land:"Ecuador", pris:21.9 },
    { namn:"Fairtrade", land:"Colombia", pris:26 },
    { namn:"Babybanan", land:"Ecuador", pris:45 },
  ]},
], "sorter")
<\/script>`,
  FTableButton: `<template>
  <div style="padding:2rem">
    <FInteractiveTable :rows="items" key-attribute="id">
      <template #caption>Frukter</template>
      <template #default="{ row }">
        <FTableColumn title="Namn" type="text" shrink>{{ row.name }}</FTableColumn>
        <FTableColumn title="Land" type="text" shrink>{{ row.origin }}</FTableColumn>
        <FTableColumn title="Åtgärd" type="action" shrink>
          <FTableButton icon="pen" @click="edit(row)">Ändra</FTableButton>
          <FTableButton icon="trashcan" @click="remove(row)">Ta bort</FTableButton>
        </FTableColumn>
      </template>
    </FInteractiveTable>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FInteractiveTable, FTableColumn, FTableButton } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const items = ref([
  { id:"1", name:"Äpple", origin:"Sverige" },
  { id:"2", name:"Banan", origin:"Colombia" },
  { id:"3", name:"Citron", origin:"Spanien" },
])
function edit(row) { const n = prompt("Namn:", row.name); if (n) row.name = n }
function remove(row) { items.value = items.value.filter(r => r.id !== row.id) }
<\/script>`,
  FTableColumn: `<template>
  <div style="padding:2rem">
    <FDataTable :rows="people" key-attribute="id">
      <template #caption>Personer</template>
      <template #default="{ row }">
        <FTableColumn title="Namn" type="text" shrink>{{ row.name }}</FTableColumn>
        <FTableColumn title="Ålder" type="numeric" shrink>{{ row.age }}</FTableColumn>
        <FTableColumn title="Stad" type="text">{{ row.city }}</FTableColumn>
      </template>
    </FDataTable>
  </div>
</template>
<script setup>
import { onMounted, getCurrentInstance } from "vue"
import { FDataTable, FTableColumn } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const people = [
  { id:"1", name:"Anna", age:30, city:"Stockholm" },
  { id:"2", name:"Erik", age:25, city:"Göteborg" },
  { id:"3", name:"Sara", age:28, city:"Malmö" },
]
<\/script>`,
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
import { onMounted } from "vue"
import { FTooltip } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
onMounted(() => { iconLib.f.injectSpritesheet() })
<\/script>`,
  FValidationForm: `<template>
  <div style="padding:2rem;max-width:400px">
    <FValidationForm @submit="onSubmit">
      <template #error-message> Oj, du har glömt fylla i något. Gå till: </template>
      <template #default>
        <FPhoneTextField v-model="phone" v-validation.required>Telefonnummer</FPhoneTextField>
        <FEmailTextField v-model="email" v-validation.required>E-postadress</FEmailTextField>
        <FFieldset v-validation.required name="info">
          <template #label> Hur vill du få information? </template>
          <template #default>
            <FRadioField v-model="info" value="mejl">Mejl</FRadioField>
            <FRadioField v-model="info" value="sms">Sms</FRadioField>
          </template>
        </FFieldset>
        <FFieldset v-validation.required name="type">
          <template #label> Vilken information? </template>
          <template #default>
            <FCheckboxField v-model="news" :value="true">Nyheter</FCheckboxField>
            <FCheckboxField v-model="tips" :value="true">Tips</FCheckboxField>
          </template>
        </FFieldset>
        <div class="button-group">
          <FButton class="button-group__item" size="large" type="submit">Spara</FButton>
          <FButton class="button-group__item" size="large" variant="secondary" @click="onCancel">Avbryt</FButton>
        </div>
      </template>
    </FValidationForm>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FButton, FCheckboxField, FEmailTextField, FFieldset, FPhoneTextField, FRadioField, FValidationForm, ValidationPlugin } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const app = getCurrentInstance().appContext.app
app.use(ValidationPlugin)
app.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const phone = ref("")
const email = ref("")
const info = ref("")
const news = ref(false)
const tips = ref(false)
function onSubmit() { alert("Spara") }
function onCancel() { alert("Avbryt") }
<\/script>`,
  FValidationGroup: `<template>
  <div style="padding:2rem;max-width:400px">
    <FValidationGroup v-model="valid">
      <FTextField id="frukt" v-model="frukt" v-validation.required maxlength="100">Favoritfrukt</FTextField>
      <FTextField id="godis" v-model="godis" v-validation.required maxlength="100">Favoritgodis</FTextField>
    </FValidationGroup>
    <div class="button-group" style="margin-top:1rem">
      <FButton :disabled="!valid?.isValid" @click="onSubmit">Spara</FButton>
    </div>
    <p style="margin-top:1rem">Grupp giltig: {{ valid?.isValid ?? "–" }}</p>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FButton, FTextField, FValidationGroup, ValidationPlugin } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const app = getCurrentInstance().appContext.app
app.use(ValidationPlugin)
app.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const frukt = ref("")
const godis = ref("")
const valid = ref(null)
function onSubmit() { alert("Spara") }
<\/script>`,
  FWizard: `<template>
  <div style="padding:2rem">
    <FWizard v-model="current" header-tag="h2" disable-initial-focus @completed="onCompleted">
      <FWizardStep key="step1" :use-error-list="false" title="Steg 1">
        <FTextField v-model="name" v-validation.required>Namn</FTextField>
      </FWizardStep>
      <FWizardStep key="step2" :use-error-list="false" title="Steg 2">
        <FTextField v-model="city" v-validation.required>Stad</FTextField>
      </FWizardStep>
      <FWizardStep key="step3" :use-error-list="false" title="Klar">
        <p>Allt är ifyllt!</p>
        <template #next-button-text> Klar </template>
      </FWizardStep>
    </FWizard>
    <p v-if="done" style="margin-top:1rem">Wizard slutförd</p>
  </div>
</template>
<script setup>
import { ref, onMounted, getCurrentInstance } from "vue"
import { FWizard, FWizardStep, FTextField, ValidationPlugin } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
const app = getCurrentInstance().appContext.app
app.use(ValidationPlugin)
app.config.globalProperties.$t = (key, fallback) => fallback
onMounted(() => { iconLib.f.injectSpritesheet() })
const current = ref(undefined)
const name = ref("")
const city = ref("")
const done = ref(false)
function onCompleted() { done.value = true }
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
  return btoa(String.fromCharCode(...zipped));
}

function makeUrl(template) {
  const data = JSON.stringify({
    "App.vue": template,
    "style.css": `@import url("https://cdn.jsdelivr.net/npm/@fkui/design@${FKUI_VERSION}/lib/fkui.css");`,
    "import-map.json": JSON.stringify({
      imports: {
        "vue": "https://play.vuejs.org/vue.runtime.esm-browser.js",
        "@fkui/vue": `https://esm.sh/@fkui/vue@${FKUI_VERSION}?external=vue,@fkui/logic,@fkui/date`,
        "@fkui/date": `https://esm.sh/@fkui/date@${FKUI_VERSION}?external=vue`,
        "@fkui/logic": `https://esm.sh/@fkui/logic@${FKUI_VERSION}?external=vue,@fkui/date`,
        "@fkui/icon-lib-default": `https://esm.sh/@fkui/icon-lib-default@${FKUI_VERSION}`,
      },
    }),
  });
  return `https://play.vuejs.org/#${utoa(data)}`;
}

// ─── HTML Generation ───────────────────────────────────────────────────────

function generateHTML(vueData, scssOnly, totalScssDirs) {
  const vueRows = vueData.map((c, i) => {
    const bp = c.breakpoints > 0
      ? `<strong>${c.breakpoints}</strong>${c.jsBp > 0 ? ` <small>(${c.scssBp} SCSS + ${c.jsBp} JS)</small>` : ""}`
      : "0";
    const link = c.playgroundUrl
      ? `<a href="${c.playgroundUrl}" target="_blank" rel="noopener" title="Live demo for ${c.name}">Live demo →</a>`
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

  <section style="margin-top:2rem;padding:1rem;background:#fff;border-radius:4px;font-size:0.9rem;color:#555">
    <p><strong>Total:</strong> ${vueData.length} Vue components + ${scssOnly.length} SCSS-only = <strong>${vueData.length + scssOnly.length} components</strong>.</p>
    <p>Of ${totalScssDirs} SCSS directories in <code>@fkui/design</code>, ${totalScssDirs - scssOnly.length} have corresponding Vue wrappers (shown in the Vue table above). The remaining ${scssOnly.length} have no Vue wrapper and are listed in the second table.</p>
  </section>

  <footer style="margin-top:3rem;padding-top:1rem;border-top:1px solid #e0e0e0;color:#888;font-size:0.8rem">
    Generated by <a href="https://github.com/pattespatte/fkui-components-list">fkui-components-list</a>
  </footer>
</main>
</body>
</html>`;
}

// ─── Markdown Generation ──────────────────────────────────────────────────

function generateMarkdown(vueData, scssOnly, totalScssDirs) {
  const mdVueRows = vueData.map((c, i) => {
    const bp = c.breakpoints > 0
      ? `**${c.breakpoints}**${c.jsBp > 0 ? ` (${c.scssBp} SCSS + ${c.jsBp} JS)` : ""}`
      : "0";
    const link = c.playgroundUrl
      ? `[Live demo](${c.playgroundUrl})`
      : "—";
    const scssCell = c.scssName !== "—" ? c.scssName : "—";
    return `| ${i + 1} | ${c.name} | ${scssCell} | ${bp} | ${link} |`;
  }).join("\n");

  const mdScssRows = scssOnly.map((c, i) => {
    const bp = c.breakpoints > 0 ? `**${c.breakpoints}**` : "0";
    return `| ${i + 1} | ${c.name} | ${bp} | CSS-only |`;
  }).join("\n");

  return `# FKUI Component Breakpoint Report

> All FKUI components with breakpoint counts and Vue Playground links.
> Generated from @fkui/vue@${FKUI_VERSION}.

## Vue Components

| # | Component | SCSS | Breakpoints | Playground |
|--:|-----------|:----:|:-----------:|:----------:|
${mdVueRows}

## SCSS-only Components (no Vue wrapper)

| # | Component | Breakpoints | Note |
|--:|-----------|:-----------:|------|
${mdScssRows}

## Summary

- **${vueData.length}** Vue components
- **${scssOnly.length}** SCSS-only components (no Vue wrapper)
- **${vueData.length + scssOnly.length}** total components
- **${vueData.filter(c => c.breakpoints > 0).length}** Vue components with responsive breakpoints
- **${scssOnly.filter(c => c.breakpoints > 0).length}** SCSS-only components with responsive breakpoints
- **0** Vue components without Playground template

Of ${totalScssDirs} SCSS directories in \`@fkui/design\`, ${totalScssDirs - scssOnly.length} have corresponding Vue wrappers (shown in the Vue table above). The remaining ${scssOnly.length} have no Vue wrapper and are listed in the SCSS-only table.
`;
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
  const html = generateHTML(vueData, scssOnly, scssDirs.length);
  const distDir = join(ROOT, "dist");
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
  const outPath = join(distDir, "index.html");
  writeFileSync(outPath, html, "utf8");
  console.log(`Generated: ${outPath}`);

  // 5. Generate Markdown (write to parent repo if symlink exists)
  const md = generateMarkdown(vueData, scssOnly, scssDirs.length);
  const parentMd = join(ROOT, "..", "fkui-responsiveness", "component-breakpoints.md");
  const localMd = join(distDir, "component-breakpoints.md");
  const mdPath = existsSync(parentMd) ? parentMd : localMd;
  writeFileSync(mdPath, md, "utf8");
  console.log(`Generated: ${mdPath}`);

  console.log(`  ${vueData.length} Vue components, ${scssOnly.length} SCSS-only`);
  console.log(`  ${vueData.filter(c => c.breakpoints > 0).length} with breakpoints`);
  console.log(`  @fkui/vue@${FKUI_VERSION}`);
}

main();
