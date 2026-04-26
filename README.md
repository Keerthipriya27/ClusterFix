---
title: ClusterFix
emoji: "🚀"
colorFrom: blue
colorTo: green
sdk: gradio
app_file: app.py
pinned: false
---
# 🚀 ClusterFix: Autonomous AIOps with RL and TEE Sandboxing

Welcome to **ClusterFix**, an advanced, autonomous IT Incident Responder designed to eliminate alert fatigue. By combining **Multi-Agent Reinforcement Learning**, **Large Language Models (Gemini 1.5)**, and a strict **Software Trusted Execution Environment (TEE)**, ClusterFix can safely diagnose, triage, and execute remediation scripts for enterprise server crashes without human intervention.

## 🎯 Hackathon Submission Deliverables
*⚠️ **EVALUATORS:** All required submission links are provided below:*

- **💻 Code Repository Link:** [https://github.com/Keerthipriya27/ClusterFix](https://github.com/Keerthipriya27/ClusterFix)
- **🚀 Hugging Face Live Demo:** [https://huggingface.co/spaces/Keerthipriya27/ClusterFix](https://huggingface.co/spaces/Keerthipriya27/ClusterFix)
- **📓 Training Notebook:** See `train.ipynb` inside the repo or run it on Google Colab for the offline RL algorithm proof.

---

## 🛑 The Problem
Modern IT structures generate enormous amounts of noisy telemetry. When critical incidents occur (like DB timeouts or OOM loops), engineers spend precious time manually parsing logs and writing fixes. While standard LLMs can generate code quickly, **running AI-generated code blindly on production servers is a massive security risk.** If an LLM hallucinates or gets hijacked by a malicious prompt, it can wipe the entire infrastructure.

## 💡 The Solution
ClusterFix is the bridge between AI speed and structural enterprise security. 

### Core Innovations:
1. **The TEE Security Sandbox (The "Hacker Shield")**
   We implemented an Application-Level Software TEE using Python's Abstract Syntax Tree (`ast`). Before any AI-generated Python runbook executes, the TEE statically analyzes the logical nodes. If it detects unapproved, destructive commands (like `import os` or `rm -rf /`), it intercepts the code, denies the cryptographic hash signature, marks it as a `REJECTED_PAYLOAD`, and protects the cluster.
2. **Reinforcement Learning (RL) Penalties**
   ClusterFix operates as a strict Markov Decision Process (MDP). If the AI is hijacked into generating a malicious runbook and the TEE fails it, the environment instantly applies a mathematical **-50 point scalar penalty**, visibly punishing the agent to align its training away from destructive behaviors.
3. **Multi-Agent Decoupling (Google Gemini)**
   Instead of one massive prompt, tasks are safely decoupled across specialized "Agents" (Analyzer, Orchestrator, Fixer). They dynamically infer Topologies and Logs using few-shot prompted LLMs before converging on consensus.

---

## 🧠 Architecture Overview
The system runs via an **`Arbiter`** pattern over a discrete **`AgentRegistry`**:
- 🛡️ **Log Ranger**: Sentinels scanning syslog traces for early structural faults.
- 🌐 **Net Sentinel**: Edge-traffic vanguard analyzing socket timeouts and DNS routes.
- ⚙️ **Config Mage**: Policy enforcement logic parsing manifest drift.
- 🗄️ **Data Forge**: State machine monitoring pool contention and memory leaks.
- 🩺 **App Guardian**: Liveness probe operator.

---

## 💻 Local Setup & Execution

1. **Clone the repository**
   ```bash
   git clone https://github.com/Keerthipriya27/ClusterFix.git
   cd ClusterFix
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set Up the Gemini Generative AI Key**
   ```bash
   export GEMINI_API_KEY="your_google_gemini_key_here"
   ```

4. **Launch the Interface locally**
   ```bash
   python custerfix-ui/server.py
   ```
   Navigate to `http://localhost:7860` in your web browser to view the interactive 3D agent dashboard and run the TEE Sandbox benchmarks!
