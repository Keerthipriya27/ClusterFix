"""HF Spaces entry point - directly runs the Flask backend."""
import sys
from pathlib import Path

# Ensure custerfix-ui is importable
sys.path.insert(0, str(Path(__file__).parent))

from custerfix_ui.server import app

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", "7860"))
    print(f"🚀 Starting ClusterFix Backend on port {port}...")
    print("✅ API endpoints ready: /api/solve, /solve, /api/health, /api/metrics")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
