import subprocess
import sys

STEPS = [
    "telegram_ingest/download.py",
    "pipeline/step1_ocr.py",
    "pipeline/step2_llm_confidence.py",
    "pipeline/step3_semantic_dedup.py",
    "pipeline/step4_daily_digest.py",
]

def run_step(step):
    print(f"\n▶ Running {step}")
    result = subprocess.run(
        [sys.executable, step],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(result.stderr)
        raise RuntimeError(f"Pipeline failed at {step}")

    print(result.stdout)


def main():
    for step in STEPS:
        run_step(step)

    print("\n✅ Full pipeline completed successfully.")


if __name__ == "__main__":
    main()