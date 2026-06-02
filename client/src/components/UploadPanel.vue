<template>
  <div>
    <div class="panel-header">
      <h2>Upload Documents</h2>
    </div>
    <div
      class="dropzone"
      :class="{ 'dropzone-active': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="handleDrop"
    >
      <p><strong>Drop files here</strong></p>
      <p class="hint">PDF, DOCX, XLSX, CSV, TXT, MD — max {{ maxSizeMB }} MB</p>
      <input
        type="file"
        ref="fileInput"
        multiple
        @change="handleFiles"
        class="file-input-hidden"
        :accept="acceptStr"
      />
      <button class="btn btn-primary" @click="$refs.fileInput.click()">
        Browse files
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'

const props = defineProps({ customer: Object })
const emit = defineEmits(['uploaded'])

const toast = inject('toast')
const api   = inject('api')
const loadCustomers = inject('loadCustomers')

const dragging = ref(false)
const maxSizeMB = props.customer?.settings?.maxFileSizeMB || 50
const acceptStr = '.pdf,.docx,.xlsx,.csv,.txt,.md'

async function handleFiles(e) {
  const files = e.target?.files || e.dataTransfer?.files
  if (!files?.length) return
  for (const f of files) await upload(f)
  e.target.value = ''
  loadCustomers()
}

function handleDrop(e) {
  dragging.value = false
  handleFiles(e)
}

async function upload(file) {
  const form = new FormData()
  form.append('file', file)
  try {
    const res = await fetch(`/api/customers/${props.customer.id}/documents`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error?.message || res.statusText)
    }
    toast(`Uploaded ${file.name}`)
  } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  padding: 48px 24px;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}

.dropzone-active {
  border-color: var(--color-primary);
  background: rgba(37,99,235,0.04);
}

.hint { color: var(--color-text-muted); font-size: 0.85rem; margin-bottom: 16px; }

.file-input-hidden { display: none; }
</style>
