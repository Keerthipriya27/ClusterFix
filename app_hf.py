"""HF Spaces entry point - directly runs the Flask backend."""
import sys
import importlib.machinery
import importlib.util
from pathlib import Path

# Load server.py as a module directly
server_path = Path(__file__).parent / 'custerfix-ui' / 'server.py'
loader = importlib.machinery.SourceFileLoader('server_module', str(server_path))
spec = importlib.util.spec_from_loader(loader.name, loader)
server = importlib.util.module_from_spec(spec)
loader.exec_module(server)

app = server.app

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", "7860"))
    print(f"🚀 Starting ClusterFix Backend on port {port}...")
    print("✅ API endpoints ready: /api/solve, /solve, /api/health, /api/metrics")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
