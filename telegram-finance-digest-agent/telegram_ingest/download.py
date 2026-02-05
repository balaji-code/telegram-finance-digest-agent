from pathlib import Path
from datetime import datetime, timezone
import os

from dotenv import load_dotenv
from telethon import TelegramClient


def _load_telegram_credentials() -> tuple[int, str]:
    """
    Load and validate Telegram API credentials from environment variables.

    Returns:
        A tuple of (API_ID, API_HASH).

    Raises:
        RuntimeError: If the required environment variables are missing or invalid.
    """
    load_dotenv()

    api_id_str = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")

    if not api_id_str or not api_hash:
        raise RuntimeError(
            "TELEGRAM_API_ID or TELEGRAM_API_HASH not set in environment"
        )

    try:
        api_id = int(api_id_str)
    except ValueError as exc:
        raise RuntimeError("TELEGRAM_API_ID must be an integer") from exc

    return api_id, api_hash


def download_today_messages() -> None:
    """
    Download today's messages from the configured Telegram channel.

    - Photos are saved as `<message_id>.jpg` under the `daily_inputs` directory.
    - Text messages are appended to `daily_inputs/text.txt`.
    """
    api_id, api_hash = _load_telegram_credentials()

    output_dir = Path("daily_inputs")
    output_dir.mkdir(parents=True, exist_ok=True)

    with TelegramClient("session", api_id, api_hash) as client:
        channel = "https://t.me/moneypurseadv"  # or channel ID
        today = datetime.now(timezone.utc).date()

        for msg in client.iter_messages(channel):
            if msg.date is None:
                continue
            if msg.date.date() != today:
                break

            if msg.photo:
                file_path = output_dir / f"{msg.id}.jpg"
                client.loop.run_until_complete(
                    client.download_media(msg.photo, file_path)
                )
            elif msg.text:
                with open(output_dir / "text.txt", "a", encoding="utf-8") as f:
                    f.write(msg.text + "\n\n")


if __name__ == "__main__":
    download_today_messages()