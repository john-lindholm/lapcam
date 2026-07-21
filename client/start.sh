#!/bin/bash
# Start LapCam Client using system packages
cd "$(dirname "$0")"
export PYTHONPATH=/usr/lib/python3/dist-packages:$PYTHONPATH
exec python3 main.py "$@"
