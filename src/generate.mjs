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
    <FCalendar v-model="date" :min-date="minDate" :max-date="maxDate">
      <template #default="{ date: day }">
        <FCalendarDay :day="day" />
      </template>
    </FCalendar>
  </div>
</template>
<script setup>
import { ref, onMounted } from "vue"
import { FCalendar, FCalendarDay } from "@fkui/vue"
import { FDate } from "@fkui/date"
import iconLib from "@fkui/icon-lib-default"
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
import { ref } from "vue"
import { FContextMenu, FButton } from "@fkui/vue"
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
import { ref, onMounted } from "vue"
import { FCrudDataset, FInteractiveTable, FTableButton, FTableColumn, FTextField } from "@fkui/vue"
import iconLib from "@fkui/icon-lib-default"
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
      <template #default="{ close }">
        <p>Detaljerat innehåll här.</p>
        <FButton @click="close">Stäng</FButton>
      </template>
    </FDetailsPanel>
  </div>
</template>
<script setup>
import { FButton, FDetailsPanel } from "@fkui/vue"
import { createDetailsPanel } from "@fkui/logic"
const panel = createDetailsPanel("demo")
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
import { ref } from "vue"
import { FDialogueTree } from "@fkui/vue"
const tree = { label:"Vill du fortsätta?", options:[{ label:"Ja", question:{ label:"Bekräftelse", userData:"ja" } },{ label:"Nej", question:{ label:"Avbryt", userData:"nej" } }] }
const progress = ref({})
<\/script>`,
  FErrorList: `<template>
  <div style="padding:2rem;max-width:600px">
    <FErrorList :items="[{title:'Namn är obligatoriskt'},{title:'Ogiltig e-postadress',id:'email'}]" />
  </div>
</template>
<script setup>
import { FErrorList } from "@fkui/vue"
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
import { ref } from "vue"
import { FExpandablePanel } from "@fkui/vue"
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
import { ref } from "vue"
import { FExpandableParagraph } from "@fkui/vue"
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
import { ref } from "vue"
import { FFieldset, FCheckboxField } from "@fkui/vue"
const checks = ref([])
<\/script>`,
  FFileItem: `<template>
  <div style="padding:2rem;max-width:600px">
    <FFileItem file-name="dokument.pdf" mime-type="application/pdf" />
  </div>
</template>
<script setup>
import { getCurrentInstance } from "vue"
import { FFileItem } from "@fkui/vue"
const { appContext } = getCurrentInstance()
appContext.config.globalProperties.$t = (key, fallback) => fallback
<\/script>`,
  FFileSelector: `<template>
  <div style="padding:2rem;max-width:600px">
    <FFileSelector @change="onFile">Välj fil</FFileSelector>
    <p v-if="file" style="margin-top:1rem">Vald fil: {{ file }}</p>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FFileSelector } from "@fkui/vue"
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
    <template #header><div style="padding:0.5rem 1rem;background:#0066cc;color:white">Rubrik</div></template>
    <template #default><div style="padding:2rem">Huvudinnehåll</div></template>
  </FLayoutApplicationTemplate>
</template>
<script setup>
import { FLayoutApplicationTemplate } from "@fkui/vue"
<\/script>`,
  FLayoutLeftPanel: simpleTemplate("FLayoutLeftPanel"),
  FLayoutRightPanel: `<template>
  <FLayoutRightPanel>
    <template #default><div style="padding:2rem"><p>Huvudinnehåll</p><FButton @click="open">Öppna panel</FButton></div></template>
    <template #heading>Detaljer</template>
    <template #content><div style="padding:1rem"><p>Högerpanelinnehåll</p></div></template>
  </FLayoutRightPanel>
</template>
<script setup>
import { FLayoutRightPanel, FButton } from "@fkui/vue"
import { FLayoutRightPanelService } from "@fkui/vue"
function open() { FLayoutRightPanelService.open() }
<\/script>`,
  FList: `<template>
  <div style="padding:2rem;max-width:400px">
    <FList :items="items" key-attribute="id"><template #default="{ item }">{{ item.name }}</template></FList>
  </div>
</template>
<script setup>
import { FList } from "@fkui/vue"
const items = [{ id:1, name:"Äpple" },{ id:2, name:"Banan" },{ id:3, name:"Citron" }]
<\/script>`,
  FLoader: `<template>
  <div style="padding:2rem">
    <FLoader :show="true" />
  </div>
</template>
<script setup>
import { FLoader } from "@fkui/vue"
<\/script>`,
  FLogo: `<template>
  <div style="padding:2rem">
    <FLogo>Försäkringskassan</FLogo>
  </div>
</template>
<script setup>
import { FLogo } from "@fkui/vue"
<\/script>`,
  FMessageBox: `<template>
  <div style="padding:2rem;max-width:600px">
    <FMessageBox type="info"><template #default="{ headingSlotClass }"><h2 :class="headingSlotClass">Informationsmeddelande</h2><p>Detta är ett exempel på en meddelanderuta.</p></template></FMessageBox>
  </div>
</template>
<script setup>
import { FMessageBox } from "@fkui/vue"
<\/script>`,
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
  FOffline: `<template>
  <div style="padding:2rem">
    <FOffline><template #default>Du verkar inte ha någon internetuppkoppling.</template></FOffline>
  </div>
</template>
<script setup>
import { FOffline } from "@fkui/vue"
<\/script>`,
  FOutputField: `<template>
  <div style="padding:2rem;max-width:400px"><FOutputField>Exempelvärde</FOutputField></div>
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
  <FPageLayout layout="simple">
    <template #header><div style="padding:0.5rem 1rem;background:#0066cc;color:white">Rubrik</div></template>
    <template #content><div style="padding:2rem">Sidinnehåll</div></template>
  </FPageLayout>
</template>
<script setup>
import { FPageLayout } from "@fkui/vue"
<\/script>`,
  FPaginateDataset: `<template>
  <div style="padding:2rem">
    <FPaginateDataset v-model="page" :items="items" :items-per-page="3">
      <template #default="{ items: rows, currentPage, numberOfPages }">
        <div v-for="item in rows" :key="item.id" style="padding:0.25rem 0">{{ item.name }}</div>
        <p style="margin-top:1rem">Sida {{ currentPage }} av {{ numberOfPages }}</p>
      </template>
    </FPaginateDataset>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FPaginateDataset } from "@fkui/vue"
const page = ref(1)
const items = [{id:1,name:"Anna"},{id:2,name:"Erik"},{id:3,name:"Sara"},{id:4,name:"Olof"},{id:5,name:"Karin"},{id:6,name:"Nils"}]
<\/script>`,
  FPaginator: `<template>
  <div style="padding:2rem">
    <FPaginator :number-of-pages="5" v-model="page" />
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FPaginator } from "@fkui/vue"
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
  <div style="padding:2rem">
    <FResizePane min="100px" max="600px" initial="300px"><p>Storleksändringsbart panelinnehåll</p></FResizePane>
  </div>
</template>
<script setup>
import { FResizePane } from "@fkui/vue"
<\/script>`,
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
    <FTable :columns="[{header:'Namn',key:'name'},{header:'Ålder',key:'age'}]" :rows="[{name:'Anna',age:30},{name:'Erik',age:25}]" key-attribute="name" />
  </div>
</template>
<script setup>
import { FTable } from "@fkui/vue"
<\/script>`,
  FTableButton: `<template>
  <div style="padding:2rem">
    <FTableButton label>Redigera</FTableButton>
  </div>
</template>
<script setup>
import { FTableButton } from "@fkui/vue"
<\/script>`,
  FTableColumn: `<template>
  <div style="padding:2rem">
    <FDataTable :rows="[{name:'Anna',age:30}]"><template #default><FTableColumn name="name" title="Namn" /><FTableColumn name="age" title="Ålder" type="numeric" /></template></FDataTable>
  </div>
</template>
<script setup>
import { FDataTable, FTableColumn } from "@fkui/vue"
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
import { FTooltip } from "@fkui/vue"
<\/script>`,
  FValidationForm: `<template>
  <div style="padding:2rem;max-width:400px">
    <FValidationForm @submit="onSubmit">
      <FTextField v-model="name"><template #default>Namn</template></FTextField>
      <FButton type="submit" style="margin-top:1rem">Skicka</FButton>
    </FValidationForm>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FValidationForm, FTextField, FButton } from "@fkui/vue"
const name = ref("")
function onSubmit() {}
<\/script>`,
  FValidationGroup: `<template>
  <div style="padding:2rem;max-width:400px">
    <FValidationGroup v-model="valid">
      <FTextField v-model="name"><template #default>Namn</template></FTextField>
    </FValidationGroup>
    <p style="margin-top:1rem">Grupp giltig: {{ valid?.isValid ?? "?" }}</p>
  </div>
</template>
<script setup>
import { ref } from "vue"
import { FValidationGroup, FTextField } from "@fkui/vue"
const name = ref("")
const valid = ref(null)
<\/script>`,
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
        "@fkui/icon-lib-default": `https://esm.sh/@fkui/icon-lib-default@${FKUI_VERSION}`,
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
