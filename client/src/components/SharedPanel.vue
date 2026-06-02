<template>
  <div>
    <div class="panel-header">
      <h2>Shared Zone</h2>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading shared content...</p>
    </div>

    <!-- Content -->
    <div v-else class="shared-content">
      <!-- Schema editor -->
      <section class="shared-section">
        <div class="section-header">
          <h3>Schema (schema.md)</h3>
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

        <div v-if="previewSchema" class="markdown-preview" v-html="renderMarkdown(schema)"></div>
        <textarea
          v-else
          v-model="schema"
          class="schema-editor"
          @input="schemaEdited = true"
          spellcheck="false"
        ></textarea>
      </section>

      <!-- Shared index -->
      <section class="shared-section">
        <div class="section-header">
          <h3>Shared Index (index.md)</h3>
        </div>
        <div class="markdown-preview" v-html="renderMarkdown(sharedIndex)"></div>
      </section>

      <!-- Shared log -->
      <section class="shared-section">
        <div class="section-header">
          <h3>Global Log (log.md)</h3>
        </div>
        <div class="log-viewer" v-html="renderMarkdown(sharedLog)"></div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue'
import { marked } from 'marked'

const toast = inject('toast')
const api = inject('api')

const loading = ref(false)
const saving = ref(false)
const schema = ref('')
const schemaEdited = ref(false)
const previewSchema = ref(false)
const sharedIndex = ref('')
const sharedLog = ref('')

function renderMarkdown(text) {
  return marked(text)
}

async function loadShared() {
  loading.value = true
  try {
    const data = await api('/shared')
    schema.value = data.schema || ''
    sharedIndex.value = data.index || ''
    sharedLog.value = data.log || ''
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    loading.value = false
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

onMounted(() => {
  loadShared()
})
</script>

<style scoped>
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

.shared-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.shared-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.section-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.schema-editor {
  width: 100%;
  min-height: 400px;
  padding: 16px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.6;
  resize: vertical;
}

.schema-editor:focus {
  outline: none;
}

.markdown-preview {
  padding: 16px;
  line-height: 1.7;
}

.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3) {
  margin-top: 20px;
  margin-bottom: 10px;
}

.markdown-preview :deep(h1:first-child),
.markdown-preview :deep(h2:first-child),
.markdown-preview :deep(h3:first-child) {
  margin-top: 0;
}

.markdown-preview :deep(p) {
  margin-bottom: 10px;
}

.markdown-preview :deep(code) {
  background: var(--color-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85em;
}

.markdown-preview :deep(pre) {
  background: var(--color-bg);
  padding: 16px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin-bottom: 16px;
}

.markdown-preview :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin-bottom: 10px;
  padding-left: 24px;
}

.log-viewer {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 0.85rem;
  line-height: 1.6;
}

.log-viewer :deep(h2) {
  font-size: 0.9rem;
  margin-top: 16px;
  margin-bottom: 8px;
  color: var(--color-text-muted);
}

.log-viewer :deep(h2:first-child) {
  margin-top: 0;
}

.log-viewer :deep(p) {
  margin-bottom: 8px;
}
</style>
