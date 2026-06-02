<template>
  <div>
    <div class="panel-header">
      <h2>Q&A</h2>
    </div>

    <!-- Chat messages -->
    <div class="chat-messages" ref="chatContainer">
      <div v-if="messages.length === 0" class="empty-state">
        <h3>Ask the Wiki</h3>
        <p>Ask a question about this customer's wiki content.</p>
      </div>

      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="chat-message"
        :class="'msg-' + msg.role"
      >
        <div class="msg-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
        <div class="msg-body">
          <div class="msg-text" v-html="msg.role === 'assistant' ? renderMarkdown(msg.text) : escapeHtml(msg.text)"></div>
          <div v-if="msg.role === 'assistant'" class="msg-actions">
            <button class="btn btn-sm" @click="fileAnswer(msg)" :disabled="msg._filing">
              {{ msg._filing ? 'Filing...' : 'File to Wiki' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="chat-message msg-assistant">
        <div class="msg-avatar">🤖</div>
        <div class="msg-body">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="chat-input-area">
      <input
        v-model="question"
        placeholder="Ask a question about the wiki..."
        class="chat-input"
        @keyup.enter="ask"
        :disabled="loading"
      />
      <button
        class="btn btn-primary"
        @click="ask"
        :disabled="loading || !question.trim()"
      >
        Ask
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, inject } from 'vue'
import { marked } from 'marked'

const props = defineProps({ customer: Object })

const toast = inject('toast')
const api = inject('api')

const messages = ref([])
const question = ref('')
const loading = ref(false)
const chatContainer = ref(null)

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function renderMarkdown(text) {
  const html = marked(text)
  // Convert [[Wiki-Links]] to clickable spans
  return html.replace(/\[\[([^\]]+)\]\]/g, '<a class="wiki-link">$1</a>')
}

async function scrollToBottom() {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

async function ask() {
  const q = question.value.trim()
  if (!q || loading.value) return

  messages.value.push({ role: 'user', text: q })
  question.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    const result = await api(`/customers/${props.customer.id}/wiki/query`, {
      method: 'POST',
      body: JSON.stringify({ question: q }),
    })
    messages.value.push({ role: 'assistant', text: result.answer || 'No answer generated.' })
  } catch (e) {
    messages.value.push({ role: 'assistant', text: `Error: ${e.message}` })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

async function fileAnswer(msg) {
  msg._filing = true
  try {
    // For v1: just show a toast — actual filing would need a dedicated endpoint
    toast('Answer filing is not yet implemented in v1', 'error')
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    msg._filing = false
  }
}
</script>

<style scoped>
.chat-messages {
  max-height: 500px;
  overflow-y: auto;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-message {
  display: flex;
  gap: 12px;
  max-width: 80%;
}

.msg-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-assistant {
  align-self: flex-start;
}

.msg-avatar {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.msg-body {
  padding: 12px 16px;
  border-radius: var(--radius);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.msg-user .msg-body {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.msg-text {
  line-height: 1.6;
}

.msg-text :deep(p) {
  margin-bottom: 8px;
}

.msg-text :deep(p:last-child) {
  margin-bottom: 0;
}

.msg-text :deep(code) {
  background: rgba(0,0,0,0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85em;
}

.msg-user .msg-text :deep(code) {
  background: rgba(255,255,255,0.2);
}

.msg-text :deep(.wiki-link) {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.msg-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.msg-user .msg-actions {
  border-top-color: rgba(255,255,255,0.2);
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}

.chat-input-area {
  display: flex;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.chat-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
}

.chat-input:focus {
  outline: none;
  border-color: var(--color-primary);
}
</style>
