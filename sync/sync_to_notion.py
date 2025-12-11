import sys
import os

# Add project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import argparse
import json
from datetime import datetime
from common.parser import Parser
from sync.client import NotionClient

MAX_CHILDREN_PER_REQUEST = 100


def has_meaningful_text(rich_text_list):
    if not isinstance(rich_text_list, list):
        return False
    for rt in rich_text_list:
        text = (rt.get("plain_text") or rt.get("text", {}).get("content") or "").strip()
        if text:
            return True
    return False


def prune_empty_blocks(blocks):
    """Remove empty blocks (no text and no children), keep dividers."""
    pruned = []
    for blk in blocks or []:
        blk_type = blk.get("type")
        type_payload = blk.get(blk_type, {}) if blk_type else {}

        # Recurse into children (top-level key or inside type payload)
        children = blk.get("children") or type_payload.get("children") or []
        cleaned_children = prune_empty_blocks(children)

        # Attach cleaned children back to top-level "children"
        if cleaned_children:
            blk["children"] = cleaned_children
        elif "children" in blk:
            blk.pop("children", None)
        if blk_type and blk_type in blk and "children" in blk[blk_type]:
            blk[blk_type].pop("children", None)

        is_divider = blk_type == "divider"
        rich_text = type_payload.get("rich_text", [])
        keep = is_divider or has_meaningful_text(rich_text) or bool(cleaned_children)
        if keep:
            pruned.append(blk)
    return pruned


def notion_blockify(block):
    """Ensure block has Notion API shape: object + type-specific payload + children."""
    blk_type = block.get("type")
    payload = block.get(blk_type, {})
    result = {
        "object": "block",
        "type": blk_type,
        blk_type: payload,
    }

    # Ensure defaults
    if blk_type == "to_do":
        payload.setdefault("checked", False)
    if blk_type == "code":
        payload.setdefault("language", "plain text")
        if payload.get("language") == "cpp":
            payload["language"] = "c++"

    # Move children (if any) to top-level "children"
    children = block.get("children") or payload.get("children")
    if children:
        result["children"] = [notion_blockify(child) for child in children]
    return result


def load_blocks_from_json(file_path):
    """Load Notion-style JSON exported by the UI (title + blocks)."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    blocks = data.get("blocks")
    if blocks is None:
        raise ValueError("JSON file does not contain 'blocks' array")

    blocks = prune_empty_blocks(blocks)
    blocks = [notion_blockify(b) for b in blocks]
    title = data.get("title") or os.path.splitext(os.path.basename(file_path))[0]
    return title, blocks

def load_config():
    # Try to load from config.json in the same directory
    current_dir = os.path.dirname(__file__)
    config_path = os.path.join(current_dir, 'config.json')
    config = {}
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
        except Exception as e:
            print(f"Warning: Could not parse config.json: {e}")

    # Also try to load .env manually if not in environment
    env_path = os.path.join(current_dir, '.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        # Remove quotes if present
                        value = value.strip("'").strip('"')
                        if key not in os.environ:
                            os.environ[key] = value
        except Exception:
            pass
            
    return config

def main():
    parser = argparse.ArgumentParser(description="Sync local notes to Notion.")
    parser.add_argument("file", help="Path to the text/JSON file to sync")
    parser.add_argument("--title", help="Title for the Notion page (default: filename or JSON title)")
    args = parser.parse_args()

    file_path = args.file
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    # Load Config
    config = load_config()
    api_key = os.environ.get("NOTION_API_KEY") or config.get("NOTION_API_KEY")
    parent_page_id = os.environ.get("NOTION_PARENT_PAGE_ID") or config.get("NOTION_PARENT_PAGE_ID")

    if not api_key:
        print("Error: NOTION_API_KEY not found in environment variables or config.json")
        sys.exit(1)
    
    if not parent_page_id:
        print("Error: NOTION_PARENT_PAGE_ID not found in environment variables or config.json")
        sys.exit(1)

    # Decide parsing mode: JSON export vs plain text
    use_json = file_path.lower().endswith(".json")

    if use_json:
        print(f"Loading JSON blocks from {file_path}...")
        try:
            json_title, blocks = load_blocks_from_json(file_path)
        except Exception as e:
            print(f"Error reading JSON: {e}")
            sys.exit(1)
        page_title = args.title or json_title
        print(f"Found {len(blocks)} top-level blocks after pruning empties.")
    else:
        # Read File
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text_content = f.read()
        except Exception as e:
            print(f"Error reading file: {e}")
            sys.exit(1)

        # Parse
        print(f"Parsing {file_path}...")
        parser_instance = Parser()
        blocks = parser_instance.parse(text_content)
        print(f"Found {len(blocks)} top-level blocks.")

        # Determine Title
        page_title = args.title
        if not page_title:
            filename = os.path.basename(file_path)
            page_title = os.path.splitext(filename)[0]

    # Sync
    print(f"Syncing to Notion page '{page_title}'...")
    client = NotionClient(api_key)
    try:
        if use_json:
            response = client.create_page_from_raw_blocks(parent_page_id, page_title, blocks)
        else:
            response = client.create_page(parent_page_id, page_title, blocks)
        page_url = response.get("url")
        print(f"Success! Page created: {page_url}")
    except Exception as e:
        print(f"Sync failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
