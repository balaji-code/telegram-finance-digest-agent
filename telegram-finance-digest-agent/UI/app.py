from pathlib import Path
import subprocess
import streamlit as st

PHASE4_SCRIPT = Path("pipeline/step4_daily_digest.py")
FULL_PIPELINE_SCRIPT = Path("pipeline/run_full_pipeline.py")

def run_phase4():
    result = subprocess.run(
        ["python", str(PHASE4_SCRIPT)],
        capture_output=True,
        text=True
    )
    return result

def run_full_pipeline():
    result = subprocess.run(
        ["python", str(FULL_PIPELINE_SCRIPT)],
        capture_output=True,
        text=True
    )
    return result

col1, col2 = st.columns(2)

with col1:
    if st.button("Run Full Pipeline"):
        with st.spinner("Running full pipeline..."):
            result = run_full_pipeline()

        if result.returncode != 0:
            st.error("Pipeline failed.")
            st.code(result.stderr)
        else:
            st.success("Full pipeline completed successfully.")

with col2:
    if st.button("Generate Today’s Digest"):
        with st.spinner("Generating digest..."):
            result = run_phase4()

        if result.returncode != 0:
            st.error("Failed to generate digest.")
            st.code(result.stderr)
        else:
            st.success("Digest generated successfully.")
