import os
import requests
import json
from typing import List, Dict, Any, Optional
from common.models import Block, BlockType, RichText

class NotionClient:
    """
    Client for interacting with the Notion API.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.notion.com/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
        }

    def create_page(self, parent_page_id: str, title: str, blocks: List[Block]) -> Dict[str, Any]:
        """
        Creates a new page in Notion under the specified parent page.
        """
        url = f"{self.base_url}/pages"
        
        children_payload = [self._block_to_json(b) for b in blocks]
        
        payload = {
            "parent": {"page_id": parent_page_id},
            "properties": {
                "title": {
                    "title": [
                        {
                            "text": {
                                "content": title
                            }
                        }
                    ]
                }
            },
            "children": children_payload
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        if response.status_code != 200:
            raise Exception(f"Failed to create page: {response.status_code} {response.text}")
        
        return response.json()

    def _rich_text_to_json(self, rich_text_list: List[RichText]) -> List[Dict[str, Any]]:
        result = []
        for rt in rich_text_list:
            item = {
                "type": "text",
                "text": {
                    "content": rt.plain_text
                },
                "annotations": rt.annotations
            }
            result.append(item)
        return result

    def _block_to_json(self, block: Block) -> Dict[str, Any]:
        """
        Converts an internal Block object to a Notion API block object.
        """
        # Map internal types to Notion types
        notion_type = {
            BlockType.PARAGRAPH: "paragraph",
            BlockType.HEADING_1: "heading_1",
            BlockType.HEADING_2: "heading_2",
            BlockType.HEADING_3: "heading_3",
            BlockType.TOGGLE_HEADING_1: "heading_1",
            BlockType.TOGGLE_HEADING_2: "heading_2",
            BlockType.TOGGLE_HEADING_3: "heading_3",
            BlockType.BULLET_LIST_ITEM: "bulleted_list_item",
            BlockType.TO_DO: "to_do",
            BlockType.CODE: "code"
        }.get(block.block_type, "paragraph")

        block_content = {
            "rich_text": self._rich_text_to_json(block.content)
        }

        # Add specific properties
        if block.block_type in [BlockType.TOGGLE_HEADING_1, BlockType.TOGGLE_HEADING_2, BlockType.TOGGLE_HEADING_3]:
            block_content["is_toggleable"] = True
        
        if block.block_type == BlockType.TO_DO:
            block_content["checked"] = block.properties.get("checked", False)
            
        if block.block_type == BlockType.CODE:
            block_content["language"] = block.properties.get("language", "plain text")

        # Handle Block Color
        # Notion API supports 'color' for most text blocks
        if "color" in block.properties:
            block_content["color"] = block.properties["color"]

        # Handle children
        if block.children:
            block_content["children"] = [self._block_to_json(child) for child in block.children]

        return {
            "object": "block",
            "type": notion_type,
            notion_type: block_content
        }
    def append_block_children(self, block_id: str, children: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Appends block children to an existing block (or page).
        Returns the list of created blocks (results).
        """
        url = f"{self.base_url}/blocks/{block_id}/children"
        
        # Notion API limit: 100 blocks per request
        # We should handle batching if needed, but for now let's assume < 100 or handle basic batching
        
        all_results = []
        
        # Simple batching
        batch_size = 100
        for i in range(0, len(children), batch_size):
            batch = children[i:i+batch_size]
            payload = {"children": batch}
            
            response = requests.patch(url, headers=self.headers, json=payload)
            if response.status_code != 200:
                raise Exception(f"Failed to append children: {response.status_code} {response.text}")
            
            data = response.json()
            all_results.extend(data.get("results", []))
            
        return all_results

    def upload_blocks_recursively(self, parent_id: str, blocks: Any):
        """
        Recursively uploads blocks to Notion.
        1. Uploads current level blocks (without their children).
        2. Gets IDs of created blocks.
        3. Recursively uploads children for each block.
        """
        if not blocks:
            return

        # Accept both a raw list of blocks and the `{ "children": [...] }` shape
        if isinstance(blocks, dict):
            blocks = blocks.get("children") or blocks.get("results") or []

        if not isinstance(blocks, list):
            raise TypeError(f"Expected a list of blocks, got {type(blocks).__name__}")

        # Prepare blocks for upload: strip children to avoid nesting limits
        # We need to keep track of which original block corresponds to which stripped block
        blocks_to_upload = []
        for b in blocks:
            if not isinstance(b, dict):
                raise TypeError(f"Each block should be a dict. Got {type(b).__name__}")
            # Create a shallow copy to modify
            b_copy = b.copy()
            # Strip client-side ids; Notion will assign UUIDs
            b_copy.pop("id", None)
            # Remove children from payload now; we'll append recursively
            if "children" in b_copy:
                b_copy.pop("children", None)

            type_name = b_copy.get("type")
            if type_name and type_name in b_copy:
                type_obj = b_copy[type_name]
                if isinstance(type_obj, dict) and "children" in type_obj:
                    type_obj = type_obj.copy()
                    type_obj.pop("children", None)
                    b_copy[type_name] = type_obj
            
            blocks_to_upload.append(b_copy)

        # Upload this level
        created_blocks = self.append_block_children(parent_id, blocks_to_upload)

        # Recurse
        if len(created_blocks) != len(blocks):
            print(f"Warning: Mismatch in uploaded blocks count. Sent {len(blocks)}, got {len(created_blocks)}")
            return

        for original, created in zip(blocks, created_blocks):
            # Check if original had children (top-level or inside type payload)
            type_name = original.get("type")
            children = []
            if "children" in original:
                children = original["children"]
            elif type_name and type_name in original:
                children = original[type_name].get("children", [])

            if children:
                self.upload_blocks_recursively(created["id"], children)

    def create_page_from_raw_blocks(self, parent_page_id: str, title: str, blocks_json: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Creates a page and recursively uploads blocks to handle deep nesting.
        """
        url = f"{self.base_url}/pages"

        # 1. Create the page WITHOUT children first
        payload = {
            "parent": {"page_id": parent_page_id},
            "properties": {
                "title": {
                    "title": [
                        {
                            "text": {
                                "content": title
                            }
                        }
                    ]
                }
            }
        }

        response = requests.post(url, headers=self.headers, json=payload)
        if response.status_code != 200:
            raise Exception(f"Failed to create page: {response.status_code} {response.text}")
        
        page_data = response.json()
        page_id = page_data["id"]
        
        # 2. Upload blocks recursively
        try:
            self.upload_blocks_recursively(page_id, blocks_json)
        except Exception as e:
            print(f"Error uploading blocks recursively: {e}")
            # We re-raise so the main script knows it failed, 
            # but the page was already created.
            raise e

        return page_data

