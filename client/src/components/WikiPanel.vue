<template>
  <div class="wiki-panel">
    <div class="panel-header">
      <h2>Wiki</h2>
      <div class="wiki-actions">
        <input
          v-model="searchQuery"
          placeholder="Search wiki..."
          class="wiki-search"
          @input="handleSearch"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading wiki...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="pages.length === 0 && !selectedPage" class="empty-state">
      <h3>No wiki pages yet</h3>
      <p>Process a document to build the wiki.</p>
    </div>

    <!-- Wiki browser -->
    <div v-else class="wiki-browser">
      <!-- Sidebar: page list -->
      <aside class="wiki-sidebar">
        <h3>Pages ({{ pages.length }})</h3>
        <ul>
          <li
            v-for="page in pages"
            :key="page.name"
            :class="{ active: selectedPage?.name === page.name }"
            @click="selectPage(page.name)"
          >
            <span class="page-title">{{ page.description || page.name }}</span>
          </li>
        </ul>
      </aside>

      <!-- Main: page content -->
      <main class="wiki-content">
        <div v-if="pageLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading page...</p>
        </div>

        <div v-else-if="selectedPage" class="page-view">
          <div class="page-header">
            <h3>{{ selectedPage.frontmatter.title || selectedPage.name }}</h3>
            <div class="page-meta">
              <span v-if="selectedPage.frontmatter.type" class="meta-tag type">{{ selectedPage.frontmatter.type }}</span>
              <span v-for="tag in (selectedPage.frontmatter.tags || [])" :key="tag" class="meta-tag tag">{{ tag }}</span>
              <span v-if="selectedPage.frontmatter.updatedAt" class="meta-date">
                Updated {{ formatDate(selectedPage.frontmatter.updatedAt) }}
              </span>
            </div>
          </div>
          <div class="page-body" v-html="renderedContent"></div>
        </div>

        <div v-else class="empty-state">
          <p>Select a page from the sidebar to view its content.</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { marked } from 'marked'

const props = defineProps({ customer: Object })

const toast = inject('toast')
const api = inject('api')

const pages = ref([])
const loading = ref(false)
const selectedPage = ref(null)
const pageLoading = ref(false)
const searchQuery = ref('')
const searchResults = ref(null)

const renderedContent = computed(() => {
  if (!selectedPage.value?.content) return ''
  const html = marked(selectedPage.value.content)
  // Convert [[Wiki-Links]] to clickable spans
  return html.replace(/\[\[([^\]]+)\]\]/g, '<a class="wiki-link" data-page="$1" href="#">$1</a>')
})

async function loadWikiIndex() {
  loading.value = true
  try {
    const data = await api(`/customers/${props.customer.id}/wiki`)
    pages.value = data.pages
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    loading.value = false
  }
}

async function selectPage(name) {
  pageLoading.value = true
  try {
    selectedPage.value = await api(`/customers/${props.customer.id}/wiki/${name}`)
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    pageLoading.value = false
  }
}

let searchTimeout = null
function handleSearch() {
  clearTimeout(searchTimeout)
  if (!searchQuery.value.trim()) {
    searchResults.value = null
    return
  }
  searchTimeout = setTimeout(async () => {
    try {
      searchResults.value = await api(`/customers/${props.customer.id}/wiki/search?q=${encodeURIComponent(searchQuery.value)}`)
    } catch (e) {
      toast(e.message, 'error')
    }
  }, 300)
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Handle wiki-link clicks
function handleWikiLinkClick(e) {
  const link = e.target.closest('.wiki-link')
  if (link) {
    e.preventDefault()
    selectPage(link.dataset.page)
  }
}

onMounted(() => {
  loadWikiIndex()
})
</script>

<style scoped>
.wiki-panel {
  display: flex;
  flex-direction: column;
}

.wiki-actions {
  display: flex;
  gap: 8px;
}

.wiki-search {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  width: 200px;
}

.wiki-browser {
  display: flex;
  gap: 24px;
  min-height: 500px;
}

.wiki-sidebar {
  width: 250px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  padding-right: 16px;
  overflow-y: auto;
  max-height: 600px;
}

.wiki-sidebar h3 {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.wiki-sidebar ul {
  list-style: none;
}

.wiki-sidebar li {
  padding: 8px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.1s;
}

.wiki-sidebar li:hover {
  background: var(--color-bg);
}

.wiki-sidebar li.active {
  background: var(--color-primary);
  color: #fff;
}

.page-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wiki-content {
  flex: 1;
  min-width: 0;
}

.page-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.page-header h3 {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.page-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.meta-tag {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.meta-tag.type {
  background: var(--color-primary);
  color: #fff;
}

.meta-tag.tag {
  background: var(--color-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.meta-date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.page-body {
  line-height: 1.8;
}

.page-body :deep(h1), .page-body :deep(h2), .page-body :deep(h3) {
  margin-top: 24px;
  margin-bottom: 12px;
}

.page-body :deep(p) {
  margin-bottom: 12px;
}

.page-body :deep(code) {
  background: var(--color-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85em;
}

.page-body :deep(pre) {
  background: var(--color-bg);
  padding: 16px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin-bottom: 16px;
}

.page-body :deep(pre code) {
  background: none;
  padding: 0;
}

.page-body :deep(ul), .page-body :deep(ol) {
  margin-bottom: 12px;
  padding-left: 24px;
}

.page-body :deep(li) {
  margin-bottom: 4px;
}

.page-body :deep(a) {
  color: var(--color-primary);
}

.page-body :deep(.wiki-link) {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.loading-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--color-text-muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
