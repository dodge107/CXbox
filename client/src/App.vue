<template>
  <div class="app-shell">
    <!-- Header -->
    <header class="app-header">
      <div class="app-logo">CXbox</div>
      <div class="app-header-right">
        <div class="customer-selector">
          <select v-model="activeCustomerId" @change="selectCustomer">
            <option value="">— Select customer —</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>
        <div class="customer-create">
          <input
            v-model="newCustomerName"
            placeholder="New customer…"
            @keyup.enter="createCustomer"
          />
          <button class="btn btn-primary btn-sm" @click="createCustomer">+ New</button>
        </div>
        <div class="app-stats" v-if="activeCustomer">
          Docs: {{ activeCustomer.docCount }} &nbsp;|&nbsp; Pages: {{ activeCustomer.wikiPageCount }}
        </div>
      </div>
    </header>

    <!-- Tab bar -->
    <nav class="tab-bar" v-if="activeCustomerId">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- Content -->
    <main class="app-content">
      <!-- Landing dashboard (no customer selected) -->
      <div v-if="!activeCustomerId" class="landing">
        <!-- Stats row -->
        <section class="stats-row">
          <div class="stat-card">
            <div class="stat-icon">📁</div>
            <div class="stat-value">{{ stats.customerCount }}</div>
            <div class="stat-label">Customers</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📄</div>
            <div class="stat-value">{{ stats.totalDocs }}</div>
            <div class="stat-label">Documents</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📖</div>
            <div class="stat-value">{{ stats.totalWikiPages }}</div>
            <div class="stat-label">Wiki Pages</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⚠️</div>
            <div class="stat-value">{{ stats.failedDocs }}</div>
            <div class="stat-label">Failed</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🤖</div>
            <div class="stat-value">{{ aiStatus === 'connected' ? 'Online' : 'Offline' }}</div>
            <div class="stat-label">AI Engine</div>
          </div>
        </section>

        <!-- Customer list -->
        <section class="customer-list" v-if="customers.length">
          <h3>Recent Customers</h3>
          <div class="customer-grid">
            <div
              v-for="c in customers.slice(0, 6)"
              :key="c.id"
              class="customer-card"
              @click="activeCustomerId = c.id; selectCustomer()"
            >
              <div class="cc-name">{{ c.name }}</div>
              <div class="cc-meta">
                <span>{{ c.docCount }} doc{{ c.docCount !== 1 ? 's' : '' }}</span>
                <span class="sep">·</span>
                <span>{{ c.wikiPageCount }} page{{ c.wikiPageCount !== 1 ? 's' : '' }}</span>
              </div>
              <div class="cc-date">{{ formatDate(c.createdAt) }}</div>
            </div>
          </div>
        </section>

        <!-- Shared zone -->
        <section class="shared-section">
          <div class="section-header">
            <h3>Shared Zone — Schema</h3>
            <div class="section-actions">
              <button class="btn btn-sm" @click="previewSchema = !previewSchema">
                {{ previewSchema ? 'Edit' : 'Preview' }}
              </button>
              <button
                class="btn btn-sm btn-primary"
                @click="saveSchema"
                :disabled="saving || !schemaEdited"
              >
                {{ saving ? 'Saving...' : 'Save Schema' }}
              </button>
            </div>
          </div>

          <div v-if="sharedLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading shared content...</p>
          </div>
          <div v-else-if="previewSchema" class="markdown-preview" v-html="renderMarkdown(schema)"></div>
          <textarea
            v-else
            v-model="schema"
            class="schema-editor"
            @input="schemaEdited = true"
            spellcheck="false"
          ></textarea>
        </section>
      </div>

      <!-- Panels -->
      <UploadPanel    v-if="activeTab === 'upload'    && activeCustomerId" :customer="activeCustomer" />
      <DocumentsPanel v-if="activeTab === 'documents' && activeCustomerId" :customer="activeCustomer" />
      <WikiPanel      v-if="activeTab === 'wiki'      && activeCustomerId" :customer="activeCustomer" />
      <QAPanel        v-if="activeTab === 'qa'        && activeCustomerId" :customer="activeCustomer" />
      <HealthPanel    v-if="activeTab === 'health'    && activeCustomerId" :customer="activeCustomer" />
    </main>

    <!-- Status bar -->
    <footer class="app-status">
      <span v-if="activeCustomerId">Active: {{ activeCustomer?.name || '...' }}</span>
      <span v-else>CXbox v0.1.0</span>
      <span>AI: {{ aiStatus }}</span>
    </footer>

    <!-- Toast notifications -->
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="'toast-' + t.type"
      >
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, provide } from 'vue'
import { marked } from 'marked'
import UploadPanel    from './components/UploadPanel.vue'
import DocumentsPanel from './components/DocumentsPanel.vue'
import WikiPanel      from './components/WikiPanel.vue'
import QAPanel        from './components/QAPanel.vue'
import HealthPanel    from './components/HealthPanel.vue'

const customers = ref([])
const activeCustomerId = ref('')
const activeTab = ref('upload')
const newCustomerName = ref('')
const toasts = ref([])
const aiStatus = ref('unknown')

const tabs = [
  { id: 'upload',    label: 'Upload' },
  { id: 'documents', label: 'Documents' },
  { id: 'wiki',      label: 'Wiki' },
  { id: 'qa',        label: 'Q&A' },
  { id: 'health',    label: 'Health' },
]

const activeCustomer = computed(() =>
  customers.value.find(c => c.id === activeCustomerId.value)
)

/* --- Landing stats --- */
const stats = ref({
  customerCount: 0,
  totalDocs: 0,
  totalWikiPages: 0,
  failedDocs: 0,
})

function computeStats() {
  stats.value.customerCount = customers.value.length
  stats.value.totalDocs = customers.value.reduce((sum, c) => sum + (c.docCount || 0), 0)
  stats.value.totalWikiPages = customers.value.reduce((sum, c) => sum + (c.wikiPageCount || 0), 0)
  // failed docs requires per-customer fetch — approximate from visible data
  stats.value.failedDocs = 0
}

/* --- Shared zone (landing) --- */
const schema = ref('')
const schemaEdited = ref(false)
const previewSchema = ref(false)
const saving = ref(false)
const sharedLoading = ref(false)

function renderMarkdown(text) {
  return marked(text)
}

async function loadShared() {
  sharedLoading.value = true
  try {
    const data = await api('/shared')
    schema.value = data.schema || ''
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    sharedLoading.value = false
  }
}

async function saveSchema() {
  saving.value = true
  try {
    await api('/shared/schema', {
      method: 'PUT',
      body: JSON.stringify({ content: schema.value }),
    })
    schemaEdited.value = false
    toast('Schema saved')
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* --- API helpers --- */
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || res.statusText)
  }
  return res.json()
}

let toastId = 0

function toast(message, type = 'success') {
  const t = { id: ++toastId, message, type }
  toasts.value.push(t)
  setTimeout(() => {
    toasts.value = toasts.value.filter(x => x.id !== t.id)
  }, 3000)
}

/* --- Customer actions --- */
async function loadCustomers() {
  try {
    customers.value = await api('/customers')
    computeStats()
  } catch (e) { /* offline */ }
}

async function createCustomer() {
  const name = newCustomerName.value.trim()
  if (!name) return
  try {
    const c = await api('/customers', { method: 'POST', body: JSON.stringify({ name }) })
    customers.value.push(c)
    activeCustomerId.value = c.id
    newCustomerName.value = ''
    computeStats()
    toast(`Created "${c.name}"`)
  } catch (e) { toast(e.message, 'error') }
}

function selectCustomer() {
  activeTab.value = 'upload'
}

/* --- AI health check --- */
async function checkAI() {
  try {
    await api('/health')
    aiStatus.value = 'connected'
  } catch { aiStatus.value = 'offline' }
}

onMounted(() => {
  loadCustomers()
  checkAI()
  loadShared()
})

// Provide dependencies for child components via inject()
provide('toast', toast)
provide('api', api)
provide('loadCustomers', loadCustomers)

// Expose toast & api so child components can emit events
defineExpose({ toast, api, loadCustomers })
</script>
