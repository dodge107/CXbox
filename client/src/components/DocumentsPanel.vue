<template>
  <div>
    <div class="panel-header">
      <h2>Documents</h2>
      <div class="doc-actions">
        <select v-model="statusFilter" class="filter-select">
          <option value="">All statuses</option>
          <option value="uploaded">Uploaded</option>
          <option value="extracting">Extracting</option>
          <option value="extracted">Extracted</option>
          <option value="processing">Processing</option>
          <option value="wiki_ready">Wiki Ready</option>
          <option value="failed">Failed</option>
        </select>
        <button class="btn btn-sm" @click="loadDocuments" :disabled="loading">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading && !documents.length" class="loading-state">
      <div class="spinner"></div>
      <p>Loading documents...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredDocs.length === 0" class="empty-state">
      <h3>{{ documents.length === 0 ? 'No documents yet' : 'No documents match filter' }}</h3>
      <p v-if="documents.length === 0">Upload your first document to get started.</p>
      <p v-else>Try changing the status filter.</p>
    </div>

    <!-- Document table -->
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Status</th>
            <th>Uploaded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in filteredDocs" :key="doc.id">
            <td class="doc-name">{{ doc.filename }}</td>
            <td><code>.{{ doc.ext }}</code></td>
            <td>{{ doc.sizeHuman }}</td>
            <td>
              <span class="status-badge" :class="'status-' + doc.status">
                {{ statusLabel(doc.status) }}
              </span>
            </td>
            <td class="date-cell">{{ formatDate(doc.uploadedAt) }}</td>
            <td class="actions-cell">
              <button
                v-if="doc.status === 'uploaded'"
                class="btn btn-sm btn-primary"
                @click="extract(doc)"
                :disabled="doc._actionLoading"
              >
                Extract
              </button>
              <button
                v-if="doc.status === 'extracted'"
                class="btn btn-sm btn-primary"
                @click="buildWiki(doc)"
                :disabled="doc._actionLoading"
              >
                Build Wiki
              </button>
              <button
                v-if="['uploaded', 'extracted'].includes(doc.status)"
                class="btn btn-sm"
                @click="process(doc)"
                :disabled="doc._actionLoading"
              >
                Process
              </button>
              <button
                class="btn btn-sm btn-danger"
                @click="remove(doc)"
                :disabled="doc._actionLoading"
              >
                Delete
              </button>
              <span v-if="doc.error" class="error-hint" :title="doc.error">⚠️</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'

const props = defineProps({ customer: Object })

const toast = inject('toast')
const api = inject('api')
const loadCustomers = inject('loadCustomers')

const documents = ref([])
const loading = ref(false)
const statusFilter = ref('')

const filteredDocs = computed(() => {
  if (!statusFilter.value) return documents.value
  return documents.value.filter(d => d.status === statusFilter.value)
})

function statusLabel(status) {
  const labels = {
    uploaded: 'Uploaded',
    extracting: 'Extracting...',
    extracted: 'Extracted',
    processing: 'Processing...',
    wiki_ready: 'Wiki Ready',
    failed: 'Failed',
  }
  return labels[status] || status
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function loadDocuments() {
  loading.value = true
  try {
    documents.value = await api(`/customers/${props.customer.id}/documents`)
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    loading.value = false
  }
}

async function setActionLoading(docId, loading) {
  const doc = documents.value.find(d => d.id === docId)
  if (doc) doc._actionLoading = loading
}

async function extract(doc) {
  await setActionLoading(doc.id, true)
  try {
    await api(`/customers/${props.customer.id}/documents/${doc.id}/extract`, { method: 'POST' })
    toast(`Extracted ${doc.filename}`)
    await loadDocuments()
    loadCustomers()
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    await setActionLoading(doc.id, false)
  }
}

async function buildWiki(doc) {
  await setActionLoading(doc.id, true)
  try {
    await api(`/customers/${props.customer.id}/documents/${doc.id}/build-wiki`, { method: 'POST' })
    toast(`Wiki built for ${doc.filename}`)
    await loadDocuments()
    loadCustomers()
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    await setActionLoading(doc.id, false)
  }
}

async function process(doc) {
  await setActionLoading(doc.id, true)
  try {
    await api(`/customers/${props.customer.id}/documents/${doc.id}/process`, { method: 'POST' })
    toast(`Processed ${doc.filename}`)
    await loadDocuments()
    loadCustomers()
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    await setActionLoading(doc.id, false)
  }
}

async function remove(doc) {
  if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return
  await setActionLoading(doc.id, true)
  try {
    await api(`/customers/${props.customer.id}/documents/${doc.id}`, { method: 'DELETE' })
    toast(`Deleted ${doc.filename}`)
    await loadDocuments()
    loadCustomers()
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    await setActionLoading(doc.id, false)
  }
}

onMounted(() => {
  loadDocuments()
})
</script>

<style scoped>
.doc-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-select {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.8rem;
}

.doc-name {
  font-weight: 500;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-cell {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.actions-cell {
  display: flex;
  gap: 4px;
  align-items: center;
}

.error-hint {
  cursor: help;
  font-size: 0.9rem;
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

.btn-danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.btn-danger:hover {
  background: var(--color-danger);
  color: #fff;
}
</style>
