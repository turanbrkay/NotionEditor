import os
import sys
import json
from typing import List, Dict, Any

from dotenv import load_dotenv

# --- Path fix: parent (build) klasörünü sys.path'e ekle ---
BASE_DIR = os.path.dirname(__file__)                  # .../build/sync
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))  # .../build

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Artık hem sync/client.py hem de common/* import edilebilir
from client import NotionClient


def main():
    # .env dosyasını sync klasöründen yükle
    env_path = os.path.join(BASE_DIR, ".env")
    load_dotenv(env_path)

    # JSON path: argüman verilmişse onu kullan, yoksa sync/config.json
    if len(sys.argv) >= 2:
        json_path = sys.argv[1]
        if not os.path.isabs(json_path):
            json_path = os.path.join(BASE_DIR, json_path)
    else:
        json_path = os.path.join(BASE_DIR, "config.json")

    if not os.path.exists(json_path):
        print(f"Hata: JSON dosyası bulunamadı: {json_path}")
        sys.exit(1)

    # JSON bloklarını oku
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            blocks: List[Dict[str, Any]] = json.load(f)
    except Exception as e:
        print(f"JSON okunurken hata: {e}")
        sys.exit(1)

    # ENV değişkenlerini al (.env içinden)
    api_key = os.getenv("NOTION_API_KEY")
    parent_page_id = os.getenv("NOTION_PARENT_PAGE_ID")

    if not api_key:
        print("Hata: NOTION_API_KEY .env içinde bulunamadı.")
        sys.exit(1)

    if not parent_page_id:
        print("Hata: NOTION_PARENT_PAGE_ID .env içinde bulunamadı.")
        sys.exit(1)

    # Başlık: argümanla geldi ise 2. argüman, yoksa default
    page_title = sys.argv[2] if len(sys.argv) >= 3 else "NotionViewer Export"

    client = NotionClient(api_key)

    # client.py içine daha önce eklediğimiz metodu kullanıyoruz:
    # create_page_from_raw_blocks(parent_page_id, title, blocks_json)
    try:
        resp = client.create_page_from_raw_blocks(parent_page_id, page_title, blocks)
        print("Sayfa oluşturuldu!")
        print("URL:", resp.get("url"))
    except Exception as e:
        print("Notion'a gönderirken hata:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
