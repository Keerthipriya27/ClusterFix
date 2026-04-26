import * as THREE from 'three';

/** --- UI BINDINGS AND STATE --- **/
let totalReward = 0;
let isSimulationRunning = false;
let currentPhase = "idle"; // idle, intake, analyze, fix, verify
let currentActiveAgentIndex = -1; // 0: Analyzer, 1: Orchestrator, 2: Fixer
let graphZoom = 1;

const GRAPH_ZOOM_MIN = 1;
const GRAPH_ZOOM_MAX = 2.5;
const GRAPH_ZOOM_STEP = 0.2;

const SCENE_ZOOM_DEFAULT = 10.0;
const SCENE_ZOOM_MIN = 8;
const SCENE_ZOOM_MAX = 12.5;
const SCENE_ZOOM_STEP = 0.7;
let sceneZoom = SCENE_ZOOM_DEFAULT;
let reportSections = [];
let reportSectionIndex = 0;

// --- PAGE WIZARD ---
window.goToPage = function(num) {
  const p3d = document.getElementById('panel-3d');
  const pIntake = document.getElementById('panel-intake');
  const pStatus = document.getElementById('panel-status');
  const pLog = document.getElementById('panel-log');
  const rhPanelWrapper = pIntake.parentElement;
  
  const modal = document.getElementById('report-modal');
  const modalContent = document.getElementById('modal-content');
  
  if (num === 1) {
    p3d.classList.add('hidden'); p3d.classList.remove('flex');
    pIntake.classList.remove('hidden'); pIntake.classList.add('flex');
    pStatus.classList.add('hidden'); pStatus.classList.remove('flex');
    pLog.classList.add('hidden'); pLog.classList.remove('flex');
    rhPanelWrapper.classList.remove('lg:w-[460px]'); 
    rhPanelWrapper.classList.add('lg:w-3/4', 'mx-auto');
    
    modal.classList.add('opacity-0', 'pointer-events-none', 'hidden'); 
    modal.classList.remove('flex');
  } else if (num === 2) {
    p3d.classList.remove('hidden'); p3d.classList.add('flex');
    pIntake.classList.add('hidden'); pIntake.classList.remove('flex');
    pStatus.classList.remove('hidden'); pStatus.classList.add('flex');
    pLog.classList.remove('hidden'); pLog.classList.add('flex');
    rhPanelWrapper.classList.add('lg:w-[460px]');
    rhPanelWrapper.classList.remove('lg:w-3/4', 'mx-auto');
    
    modal.classList.add('opacity-0', 'pointer-events-none', 'hidden');
    modal.classList.remove('flex');
    
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
  } else if (num === 3) {
    p3d.classList.add('hidden'); p3d.classList.remove('flex');
    rhPanelWrapper.classList.add('hidden'); rhPanelWrapper.classList.remove('flex');
    
    modal.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
    modal.classList.add('flex');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  }
};

window.closeModal = () => {
  // Go back to input phase and reset UI
  document.getElementById('report-modal').classList.add('hidden');
  document.getElementById('panel-intake').parentElement.classList.remove('hidden');
  document.getElementById('panel-intake').parentElement.classList.add('flex');
  
  goToPage(1);
  resetTicketCube();
  
  document.getElementById('incident-input').value = "";
  document.getElementById('project-context').value = "";
  document.getElementById('incident-logs').value = "";
  document.getElementById('incident-metrics').value = "";
  
  document.getElementById('dispatch-text').innerText = "Execute Analysis";
  document.getElementById('dispatch-btn').disabled = false;
  isSimulationRunning = false;
  currentActiveAgentIndex = -1;
  updateUIStatus('IDLE', -1, 0);
};

window.fillSample = (text) => {
  document.getElementById('incident-input').value = text;
};

function buildClientApiErrorPayload(message, detail = "") {
  return {
    summary:
`Root Cause:
Frontend/Backend transport failure while calling AI provider.

Issue Summary:
The request failed before a valid AI response was returned. The simulation is completed in resilient mode.

Impact:
AI response unavailable for this run

Severity:
High

Recommended Fix:
- Verify ClusterFix backend server.py is running.
- Verify GEMINI_API_KEY and provider endpoint settings.
- Provider detail: ${detail || message}

Automation Possibility:
Partial

Confidence Score:
90%`,
    steps: [
      { phase: "intake", agent: 0, text: "Ingesting incident payload in fallback mode...", duration: 1200, reward: 0 },
      { phase: "analyze", agent: 1, text: "Transport issue detected. Running resilient analysis mode...", duration: 1500, reward: 3 },
      { phase: "plan", agent: 2, text: "Compiling API/provider validation report...", duration: 1600, reward: 7 },
      { phase: "fix", agent: 3, text: "Building retry guidance and endpoint checklist...", duration: 1500, reward: 0 },
      { phase: "verify", agent: 4, text: "Validation complete. Operator action required.", duration: 1200, reward: 9 }
    ],
    chart: { cpu: [60, 58, 50, 40, 32, 22], error: [100, 96, 85, 55, 20, 5] },
    status: "api_error",
    api_error: {
      provider: "frontend",
      status_code: 0,
      detail: detail || message
    }
  };
}

window.fillSmartScenario = (type) => {
  if (type === 'db_crash') {
    document.getElementById('project-context').value = "EKS Cluster: us-east-1\nDatabase: Postgres 14 (Primary/Replica)\nMessage Broker: Kafka";
    document.getElementById('incident-logs').value = "[2026-04-25 10:14:22] ERROR [Checkout] - HikariPool-1 - Connection is not available, request timed out.\n[2026-04-25 10:14:25] FATAL [PaymentGateway] - JDBCConnectionException";
    document.getElementById('incident-metrics').value = "CheckoutService CPU: 99%\nPostgres Primary Connections: 100/100 (Maxed)\nHTTP 500 Error Rate: Spike to 45%";
    document.getElementById('incident-input').value = "Many users are reporting the checkout page is freezing and displaying 500 errors. This started immediately following the new inventory-service deployment 5 minutes ago.";
  } else if (type === 'memory_leak') {
    document.getElementById('project-context').value = "NodeJS Backend (v18)\nRedis Cache Cluster\nDocker Swarm";
    document.getElementById('incident-logs').value = "FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory";
    document.getElementById('incident-metrics').value = "NodeJS Process Memory: 1.4GB/1.4GB (OOM)\nPod Restarts: 12 in last hour\nRedis Eviction Rate: 500/s";
    document.getElementById('incident-input').value = "The analytics dashboard keeps crashing. Server alerts show constant container restarts.";
  } else if (type === 'network_timeout') {
    document.getElementById('project-context').value = "API Gateway: Kong\nMicroservice: UserAuth\nService Mesh: Istio";
    document.getElementById('incident-logs').value = "[warn] upstream server temporarily disabled while connecting to upstream\n[error] 111#111: *1402 connect() failed";
    document.getElementById('incident-metrics').value = "Kong Gateway Latency: 5000ms+\nUserAuth Service Availability: 40%\nIstio Dropped Packets: High";
    document.getElementById('incident-input').value = "Users cannot log into the mobile app, getting widespread timeout errors.";
  }
};

const fileUpload = document.getElementById('file-upload');
if (fileUpload) {
  fileUpload.addEventListener('change', async (e) => {
    const files = e.target.files;
    const ctxBox = document.getElementById('project-context');
    let newText = "\n--- Mapped Project Files (MCP Context) ---\n";
    for (let file of files) {
      if (file.type.startsWith("image")) continue;
      const text = await file.text();
      newText += `**${file.name}**:\n${text.substring(0, 1500)}...\n\n`;
    }
    if (ctxBox) {
      ctxBox.value += newText;
    }
  });
}

document.getElementById('dispatch-btn').addEventListener('click', async () => {
  if (isSimulationRunning) return;
  const input = document.getElementById('incident-input').value;
  const context = document.getElementById('project-context').value;
  const logs = document.getElementById('incident-logs').value;
  const metrics = document.getElementById('incident-metrics').value;
  
  if(!input.trim()) {
    alert("System Error: Please provide an Incident Ticket description to begin the root cause analysis!");
    return;
  }

  isSimulationRunning = true;
  document.getElementById('dispatch-btn').disabled = true;
  document.getElementById('dispatch-text').innerText = "Analyzing Telemetry...";
  document.getElementById('progress-bar').style.width = "0%";
  
  // Transition to Page 2 (Execution)
  goToPage(2);


  let payload;
  try {
    const res = await fetch('/api/solve', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: input, context: context, logs: logs, metrics: metrics })
    });

    if (res.ok) {
      try {
        const data = await res.json();
        if (data.error) {
          payload = buildClientApiErrorPayload("Backend validation error", data.error);
        } else {
          payload = data;
        }
      } catch (err) {
        payload = buildClientApiErrorPayload("Failed to parse JSON response", String(err));
      }
    } else {
      let errText = await res.text();
      payload = buildClientApiErrorPayload("Server responded with an error", errText || "No body returned.");
    }
  } catch (e) {
    console.error(e);
    payload = buildClientApiErrorPayload("Unable to reach backend API", e.message);
  }

  startSimulation(
    payload.steps || [],
    payload.summary || "Simulation completed.",
    payload.chart || { cpu: [70, 60, 40, 30, 20, 10], error: [100, 80, 50, 20, 10, 0] },
    {
      status: payload.status || "ok",
      apiError: payload.api_error || null,
      category: payload.category || "general",
      confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
      tee_verification: payload.tee_verification || null
    }
  );
});

function logEvent(agentIndex, message, rewardDelta) {
  const logContainer = document.getElementById('action-log');
  const d = new Date();
  const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  
  const div = document.createElement('div');
  
  let agentTag = `<span class="text-gray-600">[SYSTEM]</span>`;
  if (agentIndex === 0) agentTag = `<span class="text-neonCyan font-bold">[ANALYZER]</span>`;
  else if (agentIndex === 1) agentTag = `<span class="text-fuchsia-400 font-bold">[SEARCHER]</span>`;
  else if (agentIndex === 2) agentTag = `<span class="text-neonViolet font-bold">[ORCHESTRATOR]</span>`;
  else if (agentIndex === 3) agentTag = `<span class="text-[#5eead4] font-bold">[FIXER]</span>`;
  else if (agentIndex === 4) agentTag = `<span class="text-green-400 font-bold">[VERIFIER]</span>`;

  let rewardHtml = '';
  if (rewardDelta > 0) {
    rewardHtml = `<span class="text-neonViolet font-bold ml-2">(+${rewardDelta})</span>`;
    totalReward += rewardDelta;
    animateRewardUpdate(totalReward);
  }

  div.innerHTML = `<span class="text-gray-500">[${timeStr}]</span> ${agentTag} <span class="ml-1 text-gray-300">${message}</span>${rewardHtml}`;
  logContainer.appendChild(div);
  
  // Auto-scroll
  logContainer.scrollTop = logContainer.scrollHeight;
}

function animateRewardUpdate(newTotal) {
  const el = document.getElementById('reward-total');
  el.innerText = newTotal;
  el.classList.add('scale-125');
  setTimeout(()=> el.classList.remove('scale-125'), 300);
}

function updateUIStatus(phase, agentIndex, reward) {
  currentPhase = phase;
  currentActiveAgentIndex = agentIndex;
  
  document.getElementById('current-phase-display').innerText = phase;
  
  // Update phase reward display
  const rwEl = document.getElementById('phase-reward');
  rwEl.innerText = reward > 0 ? `+${reward}` : `0`;
  
  // Sub-title labels on the 3D scene
  const ids = ['status-analyzer', 'status-searcher', 'status-orchestrator', 'status-fixer', 'status-verifier'];
  for (let i=0; i<5; i++) {
    const statusEl = document.getElementById(ids[i]);
    const badgeEl = document.getElementById(`badge-${i}`);
    if (i === agentIndex) {
      statusEl.innerText = phase.toUpperCase();
      statusEl.className = `text-[11px] sm:text-xs uppercase tracking-widest px-2 py-0.5 rounded border ${
        i===0 ? 'text-black bg-neonCyan border-neonCyan glow-cyan' :
        i===1 ? 'text-black bg-fuchsia-400 border-fuchsia-400 shadow-md shadow-fuchsia-400/50' :
        i===2 ? 'text-black bg-neonViolet border-neonViolet glow-violet' :
        i===3 ? 'text-black bg-[#5eead4] border-[#5eead4]' :
        'text-black bg-green-400 border-green-400'
      }`;
      badgeEl.className = `w-2 h-2 rounded-full border border-white/50 ${
        i===0 ? 'bg-neonCyan shadow-[0_0_8px_#22d3ee]' :
        i===1 ? 'bg-fuchsia-400 shadow-[0_0_8px_#d946ef]' :
        i===2 ? 'bg-neonViolet shadow-[0_0_8px_#a78bfa]' :
        i===3 ? 'bg-[#5eead4] shadow-[0_0_8px_#5eead4]' :
        'bg-green-400 shadow-[0_0_8px_#4ade80]'
      }`;
    } else {
      statusEl.innerText = "STANDBY";
      statusEl.className = "text-[11px] sm:text-xs text-gray-500 uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded border border-white/10 transition-colors duration-300";
      badgeEl.className = "w-2 h-2 rounded-full border border-white/30 bg-black/50 transition-colors";
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyGraphZoom() {
  const stage = document.getElementById('resolution-chart-stage');
  const level = document.getElementById('chart-zoom-level');
  if (!stage || !level) {
    return;
  }

  const zoomPercent = Math.round(graphZoom * 100);
  stage.style.width = `${zoomPercent}%`;
  stage.style.minWidth = `${Math.round(640 * graphZoom)}px`;
  level.innerText = `${zoomPercent}%`;

  if (resChart) {
    resChart.resize();
  }
}

function adjustGraphZoom(delta) {
  graphZoom = clamp(graphZoom + delta, GRAPH_ZOOM_MIN, GRAPH_ZOOM_MAX);
  applyGraphZoom();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractField(summary, field) {
  const regex = new RegExp(`(?:^|\\n)${field}:\\s*([^\\n]+)`, 'i');
  const match = String(summary || '').match(regex);
  return match ? match[1].trim() : '';
}

function parseSummaryInsights(summary) {
  const rawSeverity = extractField(summary, 'Severity') || 'Unknown';
  const rawConfidence = extractField(summary, 'Confidence Score');
  const rawAutomation = extractField(summary, 'Automation Possibility') || 'Unknown';

  const confidenceMatch = String(rawConfidence).match(/(\d{1,3})/);
  const confidence = confidenceMatch ? clamp(parseInt(confidenceMatch[1], 10), 0, 100) : 0;

  return {
    severity: rawSeverity,
    confidence,
    automation: rawAutomation,
  };
}

function parseSummarySections(summary) {
  const preferredOrder = ['root cause', 'issue summary', 'impact', 'recommended fix'];
  const ignored = new Set(['severity', 'confidence score', 'automation possibility', 'category']);
  const sectionMap = new Map();
  let current = '';

  for (const rawLine of String(summary || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const titleOnly = line.match(/^([A-Za-z ]+):$/);
    const inlineTitle = line.match(/^([A-Za-z ]+):\s+(.+)$/);

    if (titleOnly) {
      const title = titleOnly[1].trim();
      const key = title.toLowerCase();
      if (ignored.has(key)) {
        current = '';
        continue;
      }
      current = key;
      if (!sectionMap.has(key)) {
        sectionMap.set(key, { title, lines: [] });
      }
      continue;
    }

    if (inlineTitle) {
      const title = inlineTitle[1].trim();
      const key = title.toLowerCase();
      if (ignored.has(key)) {
        current = '';
        continue;
      }
      current = key;
      if (!sectionMap.has(key)) {
        sectionMap.set(key, { title, lines: [] });
      }
      sectionMap.get(key).lines.push(inlineTitle[2].trim());
      continue;
    }

    if (current && sectionMap.has(current)) {
      sectionMap.get(current).lines.push(line);
    }
  }

  const ordered = [];
  for (const key of preferredOrder) {
    if (sectionMap.has(key)) {
      ordered.push(sectionMap.get(key));
      sectionMap.delete(key);
    }
  }
  for (const [, value] of sectionMap.entries()) {
    ordered.push(value);
  }

  if (!ordered.length) {
    ordered.push({ title: 'Resolution Details', lines: [String(summary || 'No summary available.')] });
  }

  return ordered;
}

function renderSectionContent(lines) {
  let html = '';
  let inList = false;
  let inCode = false;

  for (const rawLine of lines) {
    const line = String(rawLine || '').trimRight();
    if (!line && !inCode) continue;

    if (line.startsWith('```')) {
      if (!inCode) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<pre class="bg-[#0f172a] text-[#38bdf8] p-3 rounded text-xs overflow-x-auto border border-white/10 mt-2 mb-2 font-mono drop-shadow-md"><code>';
        inCode = true;
      } else {
        html += '</code></pre>';
        inCode = false;
      }
      continue;
    }

    if (inCode) {
      html += escapeHtml(line) + '\\n';
      continue;
    }
    
    if (line.trim().startsWith('- ')) {
      if (!inList) {
        html += '<ul class="list-disc ml-4 space-y-1 text-gray-200">';
        inList = true;
      }
      html += `<li>${escapeHtml(line.trim().slice(2))}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p class="text-gray-200 mb-1">${escapeHtml(line.trim())}</p>`;
    }
  }

  if (inList) html += '</ul>';
  if (inCode) html += '</code></pre>';

  return html || '<p class="text-gray-300">No details available.</p>';
}

function renderReportSection() {
  const stepEl = document.getElementById('report-section-step');
  const dotsEl = document.getElementById('report-section-dots');
  const titleEl = document.getElementById('report-section-title');
  const bodyEl = document.getElementById('report-section-body');
  const prevBtn = document.getElementById('report-section-prev');
  const nextBtn = document.getElementById('report-section-next');

  if (!stepEl || !dotsEl || !titleEl || !bodyEl || !prevBtn || !nextBtn || !reportSections.length) {
    return;
  }

  const active = reportSections[reportSectionIndex];
  stepEl.innerText = `Section ${reportSectionIndex + 1} of ${reportSections.length}`;
  titleEl.innerText = active.title;
  bodyEl.innerHTML = renderSectionContent(active.lines);

  dotsEl.innerHTML = '';
  reportSections.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `w-2 h-2 rounded-full border transition-all ${index === reportSectionIndex ? 'bg-neonCyan border-neonCyan shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-white/10 border-white/20 hover:bg-white/30'}`;
    dot.addEventListener('click', () => {
      reportSectionIndex = index;
      renderReportSection();
    });
    dotsEl.appendChild(dot);
  });

  prevBtn.disabled = reportSectionIndex === 0;
  prevBtn.classList.toggle('opacity-40', reportSectionIndex === 0);
  nextBtn.innerText = reportSectionIndex === reportSections.length - 1 ? 'Restart' : 'Next';
}

function bindReportSectionControls() {
  const prevBtn = document.getElementById('report-section-prev');
  const nextBtn = document.getElementById('report-section-next');
  if (!prevBtn || !nextBtn || prevBtn.dataset.bound === 'true') {
    return;
  }

  prevBtn.addEventListener('click', () => {
    if (reportSectionIndex > 0) {
      reportSectionIndex -= 1;
      renderReportSection();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (!reportSections.length) {
      return;
    }
    if (reportSectionIndex >= reportSections.length - 1) {
      reportSectionIndex = 0;
    } else {
      reportSectionIndex += 1;
    }
    renderReportSection();
  });

  prevBtn.dataset.bound = 'true';
}

function updateUITaskText(agentIndex, text) {
  const ids = ['task-analyzer', 'task-searcher', 'task-orchestrator', 'task-fixer', 'task-verifier'];
  for (let i = 0; i < 5; i++) {
    const el = document.getElementById(ids[i]);
    if (i === agentIndex) {
      el.innerText = text;
      el.classList.remove('opacity-0');
      el.classList.add('opacity-100');
    } else {
      el.classList.remove('opacity-100');
      el.classList.add('opacity-0');
    }
  }
}

async function startSimulation(playbookSteps, summary, chartData, meta = { status: "ok", apiError: null }) {
  let simTotalReward = 0;

  document.getElementById('dispatch-text').innerText = "Simulating...";
  
  logEvent(-1, "INCIDENT TICKET INGESTED. INITIALIZING RAG PIPELINE...", 0);
  
  // Bring ticket into scene
  resetTicketCube();
  ticketCube.visible = true;

  const totalSteps = playbookSteps.length || 1;
  for (let i=0; i<playbookSteps.length; i++) {
    const step = playbookSteps[i];
    simTotalReward += step.reward || 0;
    
    // UI Update
    updateUIStatus(step.phase, step.agent, step.reward);
    updateUITaskText(step.agent, step.text);
    logEvent(step.agent, step.text, step.reward);
    
    // 3D Engine Event Flags trigger lerps
    agentPulse(step.agent);
    moveTicketToAgent(step.agent);

    const pct = Math.round(((i + 1) / totalSteps) * 100);
    document.getElementById('progress-bar').style.width = `${pct}%`;

    await new Promise(r => setTimeout(r, step.duration || 2000));
  }

  // Finish
  updateUITaskText(-1, "");
  logEvent(-1, "RESOLUTION CONFIRMED. COMPILING DIAGNOSTICS.", 0);
  updateUIStatus("idle", -1, 0);
  document.getElementById('progress-bar').style.width = "100%";
  
  // Hide ticket block
  ticketCube.visible = false;
  
  isSimulationRunning = false;
  document.getElementById('dispatch-btn').disabled = false;
  document.getElementById('dispatch-text').innerText = "Execute Analysis";

  // Let the user see the final robot settle back down and the completion percentage for 2.5s
  await new Promise(r => setTimeout(r, 2500));

  // Show Chart Modal Data
  showReportModal(simTotalReward, summary, chartData, meta);
}

let resChart;
function showReportModal(rw, summary, chartData, meta = { status: "ok", apiError: null }) {
  goToPage(3);
  const modal = document.getElementById('report-modal');
  const content = document.getElementById('modal-content');
  const statusEl = document.getElementById('modal-status');
  const summaryEl = document.getElementById('modal-rag-summary');
  const severityEl = document.getElementById('insight-severity');
  const categoryEl = document.getElementById('insight-category');
  const confidenceEl = document.getElementById('insight-confidence');
  const confidenceBarEl = document.getElementById('insight-confidence-bar');
  const automationEl = document.getElementById('insight-automation');

  const insights = parseSummaryInsights(summary);

  document.getElementById('modal-reward').innerText = "+" + rw;
  bindReportSectionControls();
  reportSections = parseSummarySections(summary || "RCA Report Generation successful.");
  if (meta && meta.tee_verification) {
    const tee = meta.tee_verification;
    const badge = tee.passed ? "🟢 TEE AST Validation Passed" : "🔴 TEE AST Validation Failed";
    reportSections.push({
      title: "Executable Sandbox Runbook",
      lines: [
        `**Security Status**: ${badge}`,
        `**SHA-256 Signature**: \`${tee.signature}\``,
        "",
        "```python",
        ...tee.code.split('\n'),
        "```"
      ]
    });
  }
  reportSectionIndex = 0;
  renderReportSection();
  if (severityEl) {
    severityEl.innerText = insights.severity;
    const sev = insights.severity.toLowerCase();
    severityEl.className = `text-xs font-mono font-bold uppercase ${
      sev.includes('critical') ? 'text-red-200' :
      sev.includes('high') ? 'text-red-300' :
      sev.includes('medium') ? 'text-amber-300' :
      'text-green-300'
    }`;
  }
  if (categoryEl) {
    const category = meta.category || extractField(summary, 'Category') || 'General';
    categoryEl.innerText = category;
  }
  const resolvedConfidence = typeof meta.confidence === 'number'
    ? (meta.confidence <= 1 ? Math.round(meta.confidence * 100) : Math.round(meta.confidence))
    : insights.confidence;
  if (confidenceEl) {
    confidenceEl.innerText = `${resolvedConfidence}%`;
  }
  if (confidenceBarEl) {
    confidenceBarEl.style.width = `${clamp(resolvedConfidence, 0, 100)}%`;
  }

  if (meta.status === "api_error") {
    statusEl.innerText = "API KEY ERROR";
    statusEl.className = "text-red-300 border border-red-400/40 bg-red-500/10 px-4 py-1 rounded font-mono font-bold uppercase tracking-widest";
  } else if (meta.status === "fallback") {
    statusEl.innerText = "FALLBACK MODE";
    statusEl.className = "text-amber-300 border border-amber-400/30 bg-amber-500/10 px-4 py-1 rounded font-mono font-bold uppercase tracking-widest";
  } else {
    statusEl.innerText = "RESOLVED";
    statusEl.className = "text-neonCyan border border-neonCyan/30 bg-neonCyan/10 px-4 py-1 rounded font-mono font-bold uppercase tracking-widest glow-cyan";
  }
  
  modal.classList.remove('opacity-0', 'pointer-events-none');
  content.classList.replace('scale-95', 'scale-100');
  applyGraphZoom();

  // Draw chart
  const cpuData = (chartData && chartData.cpu) ? chartData.cpu : [95, 98, 90, 60, 45, 20];
  const errData = (chartData && chartData.error) ? chartData.error : [100, 100, 80, 20, 5, 0];
  
  const ctx = document.getElementById('resolutionChart').getContext('2d');
  if(resChart) resChart.destroy();
  
  resChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Incident', 'Triage', 'Log Parse', 'Orchestration', 'Fix Apply', 'Resolution (SLA)'],
      datasets: [
        {
          label: 'GPU / CPU Utilization (%)',
          data: cpuData,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167, 139, 250, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Error Rate (%)',
          data: errData,
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34, 211, 238, 0.2)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { family: "'JetBrains Mono', monospace" } } }
      },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } },
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } }
      }
    }
  });
}


/** --- THREE.JS SCENE SETUP --- **/
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070a, 0.05);

const initialWidth = container.clientWidth || 800;
const initialHeight = container.clientHeight || 600;

const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 0.1, 100);
camera.position.set(0, 3.6, sceneZoom);
camera.lookAt(0, 1.4, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(initialWidth, initialHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Resize handler
window.addEventListener('resize', () => {
  const w = container.clientWidth || 800;
  const h = container.clientHeight || 600;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (resChart) {
    resChart.resize();
  }
});

function applySceneZoom() {
  camera.position.z = sceneZoom;
  camera.lookAt(0, 1.4, 0);
  const level = document.getElementById('scene-zoom-level');
  if (level) {
    const sceneZoomPercent = Math.round((SCENE_ZOOM_DEFAULT / sceneZoom) * 100);
    level.innerText = `${sceneZoomPercent}%`;
  }
}

function adjustSceneZoom(delta) {
  sceneZoom = clamp(sceneZoom + delta, SCENE_ZOOM_MIN, SCENE_ZOOM_MAX);
  applySceneZoom();
}

function ensureIdleRobotVisible() {
  if (isSimulationRunning || currentActiveAgentIndex >= 0) {
    return;
  }

  const idleBot = bots[0];
  bots.forEach((bot, index) => {
    const isIdle = index === 0;
    bot.visible = isIdle;
    bot.userData.isActive = isIdle;
    bot.userData.entering = false;
    bot.userData.entryProgress = 1;
  });

  idleBot.position.x = 0;
  idleBot.position.z = 0;
  ring.material.color.setHex(idleBot.userData.baseColor);
}

const sceneZoomInBtn = document.getElementById('scene-zoom-in');
const sceneZoomOutBtn = document.getElementById('scene-zoom-out');
const sceneZoomResetBtn = document.getElementById('scene-zoom-reset');

if (sceneZoomInBtn) {
  sceneZoomInBtn.addEventListener('click', () => adjustSceneZoom(-SCENE_ZOOM_STEP));
}
if (sceneZoomOutBtn) {
  sceneZoomOutBtn.addEventListener('click', () => adjustSceneZoom(SCENE_ZOOM_STEP));
}
if (sceneZoomResetBtn) {
  sceneZoomResetBtn.addEventListener('click', () => {
    sceneZoom = SCENE_ZOOM_DEFAULT;
    applySceneZoom();
  });
}

container.addEventListener('wheel', (event) => {
  event.preventDefault();
  const direction = event.deltaY < 0 ? -SCENE_ZOOM_STEP : SCENE_ZOOM_STEP;
  adjustSceneZoom(direction);
}, { passive: false });

const chartZoomInBtn = document.getElementById('chart-zoom-in');
const chartZoomOutBtn = document.getElementById('chart-zoom-out');
const chartZoomResetBtn = document.getElementById('chart-zoom-reset');
const chartScrollArea = document.getElementById('resolution-chart-scroll');

if (chartZoomInBtn) {
  chartZoomInBtn.addEventListener('click', () => adjustGraphZoom(GRAPH_ZOOM_STEP));
}
if (chartZoomOutBtn) {
  chartZoomOutBtn.addEventListener('click', () => adjustGraphZoom(-GRAPH_ZOOM_STEP));
}
if (chartZoomResetBtn) {
  chartZoomResetBtn.addEventListener('click', () => {
    graphZoom = 1;
    applyGraphZoom();
  });
}
if (chartScrollArea) {
  chartScrollArea.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) {
      return;
    }
    event.preventDefault();
    const direction = event.deltaY < 0 ? GRAPH_ZOOM_STEP : -GRAPH_ZOOM_STEP;
    adjustGraphZoom(direction);
  }, { passive: false });
}

applySceneZoom();
applyGraphZoom();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.42);
scene.add(ambientLight);

const cyanLight = new THREE.PointLight(0x22d3ee, 100, 20);
cyanLight.position.set(-4, 3, 2);
scene.add(cyanLight);

const violetLight = new THREE.PointLight(0xa78bfa, 80, 20);
violetLight.position.set(4, 3, -2);
scene.add(violetLight);

const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
topLight.position.set(0, 10, 5);
scene.add(topLight);

const frontFillLight = new THREE.PointLight(0xffffff, 0.6, 18);
frontFillLight.position.set(0, 3.5, 6);
scene.add(frontFillLight);

/** --- SCENE OBJECTS --- **/

// Platform
const platformGeo = new THREE.CylinderGeometry(3.5, 4.0, 0.5, 64);
const platformMat = new THREE.MeshStandardMaterial({ 
  color: 0x0a0f1c, 
  roughness: 0.2, 
  metalness: 0.8 
});
const platform = new THREE.Mesh(platformGeo, platformMat);
platform.position.y = -0.25;
scene.add(platform);

// Glowing Rings
const ringGeo = new THREE.RingGeometry(3.0, 3.1, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = -Math.PI/2;
ring.position.y = 0.01;
scene.add(ring);

/** --- ROBOTS --- **/
function createRobot(colorHex) {
  const group = new THREE.Group();
  
  // Materials
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.2 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: colorHex });

  // -- HEAD --
  const headGroup = new THREE.Group();
  headGroup.position.y = 2.4;
  
  const headGeo = new THREE.SphereGeometry(0.8, 32, 32);
  const headMesh = new THREE.Mesh(headGeo, whiteMat);
  headMesh.scale.set(1.1, 0.95, 1.05);
  headGroup.add(headMesh);
  
  const visorGeo = new THREE.CapsuleGeometry(0.35, 0.7, 16, 32);
  const visorMesh = new THREE.Mesh(visorGeo, blackMat);
  visorMesh.rotation.z = Math.PI / 2;
  visorMesh.position.set(0, -0.05, 0.72);
  visorMesh.scale.set(1, 1, 0.4);
  headGroup.add(visorMesh);
  
  const eyeGeo = new THREE.CapsuleGeometry(0.04, 0.25, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, glowMat);
  leftEye.rotation.z = Math.PI / 2;
  leftEye.position.set(-0.25, -0.05, 0.86);
  headGroup.add(leftEye);
  
  const rightEye = new THREE.Mesh(eyeGeo, glowMat);
  rightEye.rotation.z = Math.PI / 2;
  rightEye.position.set(0.25, -0.05, 0.86);
  headGroup.add(rightEye);
  
  const earGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 32);
  const leftEar = new THREE.Mesh(earGeo, whiteMat);
  leftEar.rotation.z = Math.PI / 2;
  leftEar.position.set(-0.85, 0, 0);
  const leftEarGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.11, 32), glowMat);
  leftEarGlow.rotation.z = Math.PI / 2;
  leftEarGlow.position.set(-0.86, 0, 0);
  headGroup.add(leftEar);
  headGroup.add(leftEarGlow);
  
  const rightEar = new THREE.Mesh(earGeo, whiteMat);
  rightEar.rotation.z = Math.PI / 2;
  rightEar.position.set(0.85, 0, 0);
  const rightEarGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.11, 32), glowMat);
  rightEarGlow.rotation.z = Math.PI / 2;
  rightEarGlow.position.set(0.86, 0, 0);
  headGroup.add(rightEar);
  headGroup.add(rightEarGlow);
  
  group.add(headGroup);
  
  // -- BODY --
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 1.0;
  
  const torsoGeo = new THREE.CapsuleGeometry(0.5, 0.4, 16, 32);
  const torsoMesh = new THREE.Mesh(torsoGeo, whiteMat);
  bodyGroup.add(torsoMesh);
  
  const chestGeo = new THREE.BoxGeometry(0.1, 0.45, 0.1);
  const chestLight = new THREE.Mesh(chestGeo, glowMat);
  chestLight.position.set(0, 0.1, 0.46);
  bodyGroup.add(chestLight);
  
  const pelvisGeo = new THREE.SphereGeometry(0.4, 32, 32);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, blackMat);
  pelvisMesh.position.set(0, -0.4, 0);
  pelvisMesh.scale.set(1, 0.6, 1);
  bodyGroup.add(pelvisMesh);
  
  group.add(bodyGroup);
  
  // -- ARMS --
  const armGeo = new THREE.CapsuleGeometry(0.15, 0.4, 16, 16);
  const shoulderGeo = new THREE.SphereGeometry(0.2, 16, 16);
  
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.6, 1.3, 0);
  leftArm.rotation.z = 0.2;
  const lShoulder = new THREE.Mesh(shoulderGeo, whiteMat);
  leftArm.add(lShoulder);
  const lUpperArm = new THREE.Mesh(armGeo, whiteMat);
  lUpperArm.position.set(-0.05, -0.3, 0);
  leftArm.add(lUpperArm);
  const lHandGlow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.15), glowMat);
  lHandGlow.position.set(-0.05, -0.6, 0.05);
  leftArm.add(lHandGlow);
  group.add(leftArm);
  
  const rightArm = new THREE.Group();
  rightArm.position.set(0.6, 1.3, 0);
  rightArm.rotation.z = -0.2;
  const rShoulder = new THREE.Mesh(shoulderGeo, whiteMat);
  rightArm.add(rShoulder);
  const rUpperArm = new THREE.Mesh(armGeo, whiteMat);
  rUpperArm.position.set(0.05, -0.3, 0);
  rightArm.add(rUpperArm);
  const rHandGlow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.15), glowMat);
  rHandGlow.position.set(0.05, -0.6, 0.05);
  rightArm.add(rHandGlow);
  group.add(rightArm);
  
  // -- LEGS --
  const legGeo = new THREE.CapsuleGeometry(0.15, 0.3, 16, 16);
  const footGeo = new THREE.BoxGeometry(0.3, 0.15, 0.4);
  const footGlowGeo = new THREE.BoxGeometry(0.2, 0.05, 0.3);
  
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.3, 0.5, 0);
  const lThigh = new THREE.Mesh(legGeo, whiteMat);
  leftLeg.add(lThigh);
  const lFoot = new THREE.Mesh(footGeo, whiteMat);
  lFoot.position.set(0, -0.35, 0.1);
  leftLeg.add(lFoot);
  const lFootGlow = new THREE.Mesh(footGlowGeo, glowMat);
  lFootGlow.position.set(0, -0.3, 0.11);
  leftLeg.add(lFootGlow);
  group.add(leftLeg);
  
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.3, 0.5, 0);
  const rThigh = new THREE.Mesh(legGeo, whiteMat);
  rightLeg.add(rThigh);
  const rFoot = new THREE.Mesh(footGeo, whiteMat);
  rFoot.position.set(0, -0.35, 0.1);
  rightLeg.add(rFoot);
  const rFootGlow = new THREE.Mesh(footGlowGeo, glowMat);
  rFootGlow.position.set(0, -0.3, 0.11);
  rightLeg.add(rFootGlow);
  group.add(rightLeg);

  // -- COMPUTER DESK --
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, 0.4, 0.7);
  
  const deskGeo = new THREE.BoxGeometry(0.8, 0.05, 0.4);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  deskGroup.add(desk);

  const monitorGeo = new THREE.BoxGeometry(0.6, 0.35, 0.05);
  const monitorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  const monitor = new THREE.Mesh(monitorGeo, monitorMat);
  monitor.position.set(0, 0.25, -0.1);
  monitor.rotation.x = -0.15;
  deskGroup.add(monitor);
  
  const screenGeo = new THREE.PlaneGeometry(0.55, 0.3);
  const screenMat = new THREE.MeshBasicMaterial({ color: colorHex, opacity: 0.8, transparent: true });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 0.25, -0.07);
  screen.rotation.x = -0.15;
  deskGroup.add(screen);
  
  const keyboardGeo = new THREE.PlaneGeometry(0.4, 0.15);
  const keyboardMat = new THREE.MeshBasicMaterial({ color: colorHex, opacity: 0.4, transparent: true });
  const keyboard = new THREE.Mesh(keyboardGeo, keyboardMat);
  keyboard.position.set(0, 0.03, 0.05);
  keyboard.rotation.x = -Math.PI / 2;
  deskGroup.add(keyboard);
  
  group.add(deskGroup);

  // Hover Glow Ring
  const hoverRingGeo = new THREE.TorusGeometry(1.2, 0.05, 8, 32);
  const hoverRingMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.6 });
  const hoverRing = new THREE.Mesh(hoverRingGeo, hoverRingMat);
  hoverRing.position.y = 0.1;
  hoverRing.rotation.x = Math.PI/2;
  group.add(hoverRing);

  group.position.x = 0; 
  group.scale.setScalar(0.75);
  
  // Custom properties for animation loops
  group.userData = {
    baseY: 0.4,
    initialScale: 0.75, // Lock the scale to prevent over-inflation in animate loop
    hoverOffset: Math.random() * Math.PI,
    isActive: false,
    entering: false,
    entryProgress: 1,
    hoverRing: hoverRing,
    head: headGroup,
    leftArm: leftArm,
    rightArm: rightArm,
    visor: { color: { setHex: () => {} } }, // Mock object preventing older scripts from crashing
    baseColor: colorHex
  };
  
  return group;
}

const bots = [
  createRobot(0x22d3ee), // Analyzer 
  createRobot(0xd946ef), // Searcher 
  createRobot(0xa78bfa), // Orchestrator 
  createRobot(0x5eead4), // Fixer 
  createRobot(0x4ade80), // Verifier 
];

// Start focused on Center front
bots.forEach(b => {
  scene.add(b);
  b.visible = false;
});
bots[0].visible = true; // Show Analyzer by default on startup
bots[0].userData.isActive = true;


/** --- TICKET CUBE --- **/
const tGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const tEdges = new THREE.EdgesGeometry(tGeo);
const tMat = new THREE.LineBasicMaterial({ color: 0xff9b5a, linewidth: 2 });
const ticketCube = new THREE.LineSegments(tEdges, tMat);
ticketCube.visible = false;
scene.add(ticketCube);

// ProcessBeam has been completely removed as requested.

let ticketTargetPos = new THREE.Vector3(0, 8, 0);

function moveTicketToAgent(agentIndex) {
  ticketTargetPos.set(0, 3.2, 1.2); // Present ticket in front of the single bot
}

function resetTicketCube() {
  ticketCube.position.set(0, 10, 0);
  ticketTargetPos.set(0, 10, 0);
}

function agentPulse(agentIndex) {
  bots.forEach((b, i) => {
    const wasActive = b.userData.isActive;
    const isNowActive = (i === agentIndex);
    b.userData.isActive = isNowActive;
    b.visible = isNowActive; // Keep one primary actor visible, but animate its handoff entrance.
    
    if (isNowActive) {
      ring.material.color.setHex(b.userData.baseColor); // Change floor ring to match bot
      b.userData.visor.color.setHex(0xffffff); // Flash bright white
      setTimeout(() => {
        b.userData.visor.color.setHex(b.userData.baseColor);
      }, 500);
    }
  });
}

/** --- PARTICLES --- **/
const pGeo = new THREE.BufferGeometry();
const pCount = 300;
const pPos = new Float32Array(pCount * 3);
for(let i=0; i<pCount*3; i++) {
  pPos[i] = (Math.random() - 0.5) * 15;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({ size: 0.05, color: 0x22d3ee, transparent: true, opacity: 0.4 });
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

/** --- RENDER LOOP --- **/
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const delta = clock.getDelta();

  // Tick robots
  ensureIdleRobotVisible();

  bots.forEach(bot => {
    const data = bot.userData;
    const baseScale = data.initialScale || 1.05;

    if (!bot.visible) {
      return;
    }

    // Hover bob
    const bob = Math.sin(time * 2 + data.hoverOffset) * 0.1;
    const targetY = data.baseY + bob;

    // Active states: Typing/Analyzing Animation
    if (data.isActive && isSimulationRunning) {
      data.hoverRing.rotation.z += 0.05;
      
      // Look rapidly around at data
      if(data.head) {
        data.head.rotation.y = Math.sin(time * 8) * 0.3 + Math.cos(time * 3) * 0.2;
        data.head.rotation.x = Math.sin(time * 5) * 0.1;
      }
      
      // Rapidly typing/interacting with invisible holographic interface
      if(data.leftArm && data.rightArm) {
        data.leftArm.rotation.x = -0.5 - Math.abs(Math.sin(time * 20)) * 0.6;
        data.rightArm.rotation.x = -0.5 - Math.abs(Math.cos(time * 22)) * 0.6;
      }
      
      // Fast processing bob
      bot.position.y = targetY + Math.abs(Math.sin(time * 12)) * 0.05;
      
      // Pulse ring when active
      ring.material.opacity = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(time * 6));
    } else {
      data.hoverRing.rotation.z += 0.01;
      
      // Return gracefully to idle
      bot.position.x = THREE.MathUtils.lerp(bot.position.x, 0, 0.1);
      bot.position.z = THREE.MathUtils.lerp(bot.position.z, 0, 0.1);
      bot.rotation.y = THREE.MathUtils.lerp(bot.rotation.y, 0, 0.1);
      bot.position.y = targetY;
      
      // Settle arms and head
      if(data.head) {
        data.head.rotation.y = THREE.MathUtils.lerp(data.head.rotation.y, 0, 0.1);
        data.head.rotation.x = THREE.MathUtils.lerp(data.head.rotation.x, 0, 0.1);
      }
      if(data.leftArm && data.rightArm) {
        data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, 0, 0.1);
        data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, 0, 0.1);
      }
      
      if (!isSimulationRunning) {
        ring.material.opacity = 0.4;
      }
    }
  });

  // Ticket movements (Lerp)
  if (ticketCube.visible) {
    ticketCube.position.lerp(ticketTargetPos, 0.05);
    ticketCube.rotation.x += 0.02;
    ticketCube.rotation.y += 0.03;
  }

  // Particle drift
  const pAttr = particles.geometry.attributes.position;
  for(let i=0; i<pCount; i++) {
    pAttr.setY(i, pAttr.getY(i) + 0.01);
    if (pAttr.getY(i) > 8) {
      pAttr.setY(i, -2);
    }
  }
  pAttr.needsUpdate = true;

  renderer.render(scene, camera);
}

animate();

// --- Theme Toggle Handler ---
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const themeLabel = document.getElementById('theme-label');
if(themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    
    if(isLight) {
      themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>`;
      if(themeLabel) themeLabel.innerText = "Dark Theme";
      // Change Three.js fog
      if(scene && scene.fog) scene.fog.color.setHex(0xffffff);
    } else {
      themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;
      if(themeLabel) themeLabel.innerText = "Light Theme";
      // Revert Three.js fog perfectly to Pure Black
      if(scene && scene.fog) scene.fog.color.setHex(0x000000);
    }
  });
}

// --- PHASE 1: MOCK LIVE TELEMETRY WEBHOOK POLLER ---
setInterval(async () => {
    if (isSimulationRunning) return; // Don't interrupt active processes
    
    try {
        const res = await fetch('/api/alerts/poll');
        const data = await res.json();
        
        if (data.has_alert && data.alert) {
            const al = data.alert;
            // Auto fill UI mapping
            document.getElementById('incident-input').value = `[${al.id}] ${al.title}: ${al.description}`;
            document.getElementById('project-context').value = al.context;
            document.getElementById('incident-logs').value = al.logs;
            document.getElementById('incident-metrics').value = al.metrics;
            
            // Auto-Trigger the analysis
            document.getElementById('dispatch-btn').click();
        }
    } catch (e) {
        // Silently fail polling if backend is unreachable
    }
}, 3000);
