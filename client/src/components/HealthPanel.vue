<template>
  <div>
    <div class="panel-header">
      <h2>Health Check</h2>
      <button
        class="btn btn-primary"
        @click="runLint"
        :disabled="running"
      >
        {{ running ? 'Running...' : 'Run Health Check' }}
      </button>
    </div>

    <!-- Idle state -->
    <div v-if="!results && !running" class="empty-state">
      <h3>Wiki Health Check</h3>
      <p>Run a health check to find contradictions, orphan pages, missing cross-references, and content gaps.</p>
    </div>

    <!-- Running state -->
    <div v-if="running" class="loading-state">
      <div class="spinner"></div>
      <p>Running health check... This may take a moment.</p>
    </div>

    <!-- Results -->
    <div v-if="results && !running" class="lint-results">
      <div class="results-summary">
        <span class="summary-badge" :class="totalIssues === 0 ? 'healthy' : 'issues'">
          {{ totalIssues === 0 ? 'Wiki is healthy!' : `${totalIssues} issue${totalIssues > 1 ? 's' : ''} found` }}
        </span>
        <span class="summary-meta">
          {{ results.static?.pageCount || 0 }} pages &middot; Linted {{ formatDate(results.static?.lintedAt) }}
        </span>
      </div>

      <!-- AI report -->
      <div v-if="results.ai?.report" class="ai-report">
        <h3>AI Analysis</h3>
        <div class="report-content" v-html="renderMarkdown(results.ai.report)"></div>
      </div>

      <!-- Static issues -->
      <div v-if="results.static?.issues" class="issue-sections">
        <!-- Contradictions -->
        <div v-if="results.static.issues.contradictions?.length" class="issue-section">
          <h3>⚠️ Contradictions ({{ results.static.issues.contradictions.length }})</h3>
          <ul>
            <li v-for="(item, i) in results.static.issues.contradictions" :key="i">
              <strong>{{ item.page }}</strong> — {{ item.issue }}
            </li>
          </ul>
        </div>

        <!-- Orphan pages -->
        <div v-if="results.static.issues.orphanPages?.length" class="issue-section">
          <h3>🔗 Orphan Pages ({{ results.static.issues.orphanPages.length }})</h3>
          <ul>
            <li v-for="(item, i) in results.static.issues.orphanPages" :key="i">
              <strong>{{ item.page }}</strong> — {{ item.issue }}
            </li>
          </ul>
        </div>

        <!-- Missing cross-references -->
        <div v-if="results.static.issues.missingCrossRefs?.length" class="issue-section">
          <h3>📝 Missing Cross-References ({{ results.static.issues.missingCrossRefs.length }})</h3>
          <ul>
            <li v-for="(item, i) in results.static.issues.missingCrossRefs" :key="i">
              <strong>{{ item.page }}</strong> — {{ item.issue }}
            </li>
          </ul>
        </div>

        <!-- Content gaps -->
        <div v-if="results.static.issues.contentGaps?.length" class="issue-section">
          <h3>🔍 Content Gaps ({{ results.static.issues.contentGaps.length }})</h3>
          <ul>
            <li v-for="(item, i) in results.static.issues.contentGaps" :key="i">
              <strong>{{ item.page }}</strong> — {{ item.issue }}
            </li>
          </ul>
        </div>
      </div>

      <!-- No issues -->
      <div v-if="totalIssues === 0 && results.static" class="no-issues">
        <p>No structural issues found. The wiki is well-organized.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { marked } from 'marked'

const props = defineProps({ customer: Object })

const toast = inject('toast')
const api = inject('api')

const running = ref(false)
const results = ref(null)

const totalIssues = computed(() => {
  if (!results.value?.static?.issues) return 0
  const { contradictions = [], orphanPages = [], missingCrossRefs = [], contentGaps = [] } = results.value.static.issues
  return contradictions.length + orphanPages.length + missingCrossRefs.length + contentGaps.length
})

function renderMarkdown(text) {
  return marked(text)
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function runLint() {
  running.value = true
  results.value = null
  try {
    results.value = await api(`/customers/${props.customer.id}/wiki/lint`, { method: 'POST' })
    if (totalIssues.value === 0) {
      toast('Wiki is healthy!')
    } else {
      toast(`Found ${totalIssues.value} issue(s)`, 'error')
    }
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    running.value = false
  }
}
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

.lint-results {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.results-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.summary-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
}

.summary-badge.healthy {
  background: #d1fae5;
  color: #065f46;
}

.summary-badge.issues {
  background: #fee2e2;
  color: #991b1b;
}

@media (prefers-color-scheme: dark) {
  .summary-badge.healthy { background: #064e3b; color: #6ee7b7; }
  .summary-badge.issues { background: #4c1d1d; color: #fca5a5; }
}

.summary-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.ai-report {
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ai-report h3 {
  margin-bottom: 12px;
  font-size: 1rem;
}

.report-content {
  line-height: 1.7;
}

.report-content :deep(p) {
  margin-bottom: 8px;
}

.issue-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.issue-section {
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.issue-section h3 {
  margin-bottom: 12px;
  font-size: 1rem;
}

.issue-section ul {
  list-style: none;
  padding: 0;
}

.issue-section li {
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9rem;
}

.issue-section li:last-child {
  border-bottom: none;
}

.issue-section li strong {
  color: var(--color-primary);
}

.no-issues {
  padding: 24px;
  text-align: center;
  background: var(--color-surface);
  border: 1px solid #d1fae5;
  border-radius: var(--radius);
  color: #065f46;
}

@media (prefers-color-scheme: dark) {
  .no-issues {
    border-color: #064e3b;
    color: #6ee7b7;
  }
}
</style>
