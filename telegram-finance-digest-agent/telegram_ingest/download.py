from telethon import TelegramClient
from telethon.tl.types import PeerChannel
from pathlib import Path
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

load_dotenv()

API_ID = int(os.getenv("TELEGRAM_API_ID"))
API_HASH = os.getenv("TELEGRAM_API_HASH")

if API_ID is None or API_HASH is None:
    raise RuntimeError("TELEGRAM_API_ID or TELEGRAM_API_HASH not set in environment")

OUTPUT_DIR = Path("daily_inputs")
OUTPUT_DIR.mkdir(exist_ok=True)

with TelegramClient("session", API_ID, API_HASH) as client:
    channel = "https://t.me/moneypurseadv"  # or channel ID
    today = datetime.now(timezone.utc).date()

    for msg in client.iter_messages(channel):
        if msg.date is None:
            continue
        if msg.date.date() != today:
            break
        if msg.photo:
            file_path = OUTPUT_DIR / f"{msg.id}.jpg"
            client.loop.run_until_complete(
                client.download_media(msg.photo, file_path)
            )
        elif msg.text:
            with open(OUTPUT_DIR / "text.txt", "a") as f:
                f.write(msg.text + "\n\n")