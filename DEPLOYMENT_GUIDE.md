# AutoOpsEnv — Hackathon Deployment Guide

This guide walks you through publishing your AutoOpsEnv project to GitHub, Google Colab, Kaggle, and Hugging Face Spaces for the OpenEnv Hackathon India 2026.

## Verification Checklist (Before Publishing)

Confirm all required files exist and are working:

- [ ] `env/ticket_env.py` — OpenEnv-compatible environment
- [ ] `openenv.yaml` — Metadata file
- [ ] `app/gradio_app.py` — Interactive web app (with CLI fallback)
- [ ] `app.py` — Wrapper for HF Spaces
- [ ] `training/train.ipynb` — Colab-ready notebook
- [ ] `plots/reward.png` — Learning curve proof
- [ ] `plots/loss.png` — Optimization curve proof
- [ ] `README.md` — Complete documentation
- [ ] `requirements.txt` — Dependency list (with `gradio==4.35.0`)

Run these verification commands (from project root):

```bash
# Verify environment works
python -m env.ticket_env

# Verify app runs (will show CLI output if Gradio unavailable)
python app/gradio_app.py

# Check all required files exist
ls -la env/ openenv.yaml app/ training/ plots/
```

---

## Step 1: Publish to GitHub

### 1.1 Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Create repository: `autoopsenv`
3. Set to **Public**
4. Do NOT initialize with README (we have one)
5. Click **Create Repository**

### 1.2 Push Code to GitHub

```bash
cd c:\Users\DELL\softickets

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: AutoOpsEnv environment with training pipeline"

# Add remote and push
git remote add origin https://github.com/<YOUR-USERNAME>/autoopsenv.git
git branch -M main
git push -u origin main
```

### 1.3 Verify on GitHub

- Visit `https://github.com/<YOUR-USERNAME>/autoopsenv`
- Confirm all files are present:
   - [ ] `env/ticket_env.py`
   - [ ] `openenv.yaml`
   - [ ] `app/gradio_app.py`
   - [ ] `training/train.ipynb`
   - [ ] `plots/reward.png`
   - [ ] `plots/loss.png`
   - [ ] `README.md`

---

## Step 2: Deploy to Hugging Face Spaces

### 2.1 Create Hugging Face Space

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces)
2. Click **Create New Space**
3. **Owner:** Your username
4. **Space Name:** `autoopsenv`
5. **License:** MIT
6. **SDK:** Gradio
7. **Space Visibility:** Public
8. Click **Create Space**

### 2.2 Connect GitHub Repo (Option A — Recommended)

1. Go to Space **Settings**
2. Under **Repository**, connect GitHub:
   - Link to `https://github.com/<YOUR-USERNAME>/autoopsenv`
   - Set branch to `main`
   - Set app file to `app.py`
3. Space will auto-update when you push to GitHub

**OR**

### 2.2 Upload Files Directly (Option B)

1. Clone the repo locally:
   ```bash
   git clone https://github.com/<YOUR-USERNAME>/autoopsenv.git
   ```
2. On HF Space, use the **Files** tab to upload:
   - repository contents (all files)
   - `requirements.txt` (update with `gradio==4.35.0`)
3. Create a `.gitignore` in Space root:
   ```
   __pycache__/
   venv/
   *.pyc
   .DS_Store
   ```

### 2.3 Configure Space Runtime

1. **Hardware:** CPU (sufficient; GPU optional)
2. **Persistent Storage:** None needed
3. **Environment variables:** None
4. **App file:** `app.py`
5. **App directory:** (leave blank)

### 2.4 Test Space

- Space will build and deploy automatically
- Wait for **Space Running** status
- Click **Embed** or visit Space URL
- Test the app:
  1. Enter a ticket (e.g., "Database connection timeout")
  2. Select "After Training (Improved Policy)"
  3. Click **Submit**
  4. Verify actions, rewards, and outcome appear

---

## Step 3: Create Google Colab Link

### 3.1 Open Notebook in Colab

1. Go to [colab.research.google.com](https://colab.research.google.com)
2. Click **File → Open Notebook**
3. Go to **GitHub** tab
4. Enter: `https://github.com/<YOUR-USERNAME>/autoopsenv`
5. Select branch: `main`
6. Select file: `training/train.ipynb`
7. Click **Open**

### 3.2 Test Run

- Go through each cell top-to-bottom
- **Cell 1:** Install dependencies (~2 min)
- **Cell 2:** Imports and setup
- **Cell 3:** Baseline evaluation
- **Cell 4:** TRL + PyTorch initialization
- **Cell 5:** Online RL training (~5 min for 60 episodes)
- **Cell 6:** Post-training evaluation
- **Cell 7:** Plot generation
- Confirm: `reward.png` and `loss.png` are created

### 3.3 Get Shareable Link

After running in Colab:
1. Click **Share** (top right)
2. Copy **Shareable link** (anyone with link can view/run)
3. Example: `https://colab.research.google.com/github/<YOUR-USERNAME>/autoopsenv/blob/main/training/train.ipynb`

---

## Step 4: Run Extended Training on Kaggle

### 4.1 Import Notebook

1. Go to [kaggle.com/code](https://kaggle.com/code)
2. Create a new notebook and import `training/train.ipynb`
3. Enable GPU if available

### 4.2 Train and Export Artifacts

1. Run extended episodes for better learning curves.
2. Save outputs (`reward.png`, `loss.png`, optional checkpoints).
3. Push artifacts back to GitHub repo.

---

## Step 5: Create Demo Video or Blog (Optional but Recommended)

### Option A: 2-Minute Video Demo

1. Screen record using OBS or Screenflow:
   - Show the Gradio/CLI app interface
   - Input a ticket (e.g., "server down" scenario)
   - Run with "Before Training" mode (poor performance)
   - Run with "After Training" mode (improved performance)
   - Show the reward/loss curves in `plots/`
   - Narrate: Problem → Solution → Results

2. Upload to:
   - YouTube (unlisted or public)
   - Loom
   - GitHub Releases

3. Get shareable link and add to `README.md`

### Option B: Hugging Face Blog Post

Write a short blog on [huggingface.co/blog](https://huggingface.co/blog):
- Title: "AutoOpsEnv: Training IT Ticket Resolution Agents"
- Sections:
  1. Problem Statement
  2. Environment Design
  3. Training Pipeline
  4. Results & Metrics
  5. Links to Space, Colab, GitHub

---

## Step 6: Update README with Real Links

Once all deployments are live, update `README.md`:

```markdown
## Required Submission Links

- **GitHub Repo:** https://github.com/<YOUR-USERNAME>/autoopsenv
- **Hugging Face Space:** https://huggingface.co/spaces/<YOUR-USERNAME>/autoopsenv
- **Colab Notebook:** https://colab.research.google.com/github/<YOUR-USERNAME>/autoopsenv/blob/main/training/train.ipynb
- **Demo Video:** https://youtube.com/... (or HF blog link)
```

---

## Final Submission Checklist

- [ ] GitHub repo exists and is public
- [ ] All code files are present in GitHub
- [ ] `plots/reward.png` and `plots/loss.png` are committed
- [ ] HF Space is public and accessible without login
- [ ] HF Space demo runs successfully
- [ ] Colab notebook is accessible and runnable
- [ ] Kaggle notebook run is completed and referenced
- [ ] All links in README are non-broken
- [ ] `openenv.yaml` is valid YAML
- [ ] `TicketEnv` has `reset()`, `step()`, `state()` methods
- [ ] Training notebook demonstrates environment interaction
- [ ] Reward curve shows learning improvement
- [ ] README includes embedded images for `reward.png` and `loss.png`

---

## Troubleshooting

### Issue: Gradio import fails locally

**Solution:** This is expected on machines with disk constraints. The app has a CLI fallback that works perfectly. On HF Spaces (with ample storage), the full Gradio web interface will load.

### Issue: HF Space says "Space is building"

**Solution:** Wait 5–10 minutes for initial build. Check **Logs** tab for errors. Ensure `requirements.txt` is present and uses `gradio==4.35.0`.

### Issue: Colab notebook fails on imports

**Solution:** The first cell includes `!pip -q install ...`. Ensure it runs successfully before proceeding. If it times out, run each package individually in a new cell:
```python
!pip -q install torch transformers trl accelerate
```

### Issue: Plots not appearing in README

**Solution:** Ensure `plots/reward.png` and `plots/loss.png` exist and are committed to GitHub. Use relative paths in README markdown:
```markdown
![Reward Curve](plots/reward.png)
![Loss Curve](plots/loss.png)
```

---

## Validation by Hackathon Judges

The automated validator will check:

1. **OpenEnv API:** Can instantiate `TicketEnv`, call `reset()`, `step()`, `state()`
2. **Reward Logic:** Confirms +20, +10, +5, -5, -10 rewards are implemented
3. **Scenarios:** Verifies 5 ticket scenarios are present
4. **Notebooks:** Runs `training/train.ipynb` end-to-end
5. **Plots:** Confirms `reward.png` and `loss.png` exist and are valid images
6. **YAML:** Parses `openenv.yaml` for required fields
7. **Public Access:** Verifies GitHub is public, HF Space is accessible, Colab link works

---

## Quick Reference: All Submission Links Format

Fill in <YOUR-USERNAME> and submit these:

| Component | URL |
|-----------|-----|
| **GitHub Repo** | `https://github.com/<YOUR-USERNAME>/autoopsenv` |
| **HF Space** | `https://huggingface.co/spaces/<YOUR-USERNAME>/autoopsenv` |
| **Colab Notebook** | `https://colab.research.google.com/github/<YOUR-USERNAME>/autoopsenv/blob/main/training/train.ipynb` |
| **Video/Blog** | Your choice of platform |

---

Congratulations! Your OpenEnv-compliant, multi-agent IT ticket resolution environment is ready for judging. Good luck at the hackathon! 🚀
