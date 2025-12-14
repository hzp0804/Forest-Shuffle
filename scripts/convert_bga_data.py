import re
import json
import os

# Paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARD_JS_PATH = os.path.join(ROOT_DIR, 'forestshuffle', 'card.js')
CSS_PATH = os.path.join(ROOT_DIR, 'forestshuffle', 'forestshuffle.css')
OUTPUT_PATH = os.path.join(ROOT_DIR, 'miniprogram', 'data', 'bgaCardData.js')

def parse_card_js(file_path):
    print(f"Reading {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    cards = {}
    
    # Python equivalent of the JS $f helper
    # $f([TREE, [LINDEN], [LINDEN], BASIC_DECK])
    # Returns: { type: data[0], species: data[1], tree_symbol: data[2], deck: data[3] }
    
    # Regex to find lines like: 149: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
    pattern = re.compile(r'(\d+):\s*\$f\(\[(.*?)\]\)')
    
    matches = pattern.findall(content)
    print(f"Found {len(matches)} card definitions in JS.")

    for card_id, args_str in matches:
        # Split args by comma, but simulate JS array parsing roughly
        # This is a bit hacky, args_str is like: TREE, [LINDEN], [LINDEN], BASIC_DECK
        
        # Simple parsing assumming constant names don't have commas
        # Clean up brackets per item
        args = []
        current_arg = ""
        depth = 0
        for char in args_str:
            if char == '[': depth += 1
            elif char == ']': depth -= 1
            
            if char == ',' and depth == 0:
                args.append(current_arg.strip())
                current_arg = ""
            else:
                current_arg += char
        args.append(current_arg.strip()) # Last arg

        # Map contents
        if len(args) >= 4:
            c_type = args[0]
            c_species = args[1].replace('[', '').replace(']', '').replace("'", "").split(',')
            c_tree_symbol = args[2].replace('[', '').replace(']', '').replace("'", "").split(',')
            c_deck = args[3]
            
            # Clean up list items
            c_species = [s.strip() for s in c_species if s.strip()]
            c_tree_symbol = [s.strip() for s in c_tree_symbol if s.strip()]

            cards[card_id] = {
                "id": card_id,
                "type": c_type,
                "species": c_species,
                "tree_symbols": c_tree_symbol,
                "deck": c_deck
            }
            
    # Also parse SPECIES_DATA to get names and readable attributes
    # Structure: Blackberries: { name: "Blackberries", ... }
    # This is harder to regex comfortably. For now, let's stick to the card structure.
    # We might need species data for names later, but let's see if we can live without it for the gallery grid first.
    
    return cards

def parse_css(file_path):
    print(f"Reading {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    css_data = {}
    
    # Normalize content to make regex easier (remove newlines inside blocks)
    # But this CSS is minified/single-line mostly in the view provided.
    
    # Regex for finding .card[data-id="1"]... { ... }
    # Since selectors can be grouped: .card[data-id="1"], .card[data-id="2"] { ... }
    # We find blocks: SELECTORS { BODY }
    
    block_pattern = re.compile(r'([^\{\}]+)\{([^\{\}]+)\}')
    blocks = block_pattern.findall(content)
    
    print(f"Found {len(blocks)} CSS blocks to analyze.")

    for selectors, body in blocks:
        # Check if this block relates to cards with data-id
        if 'data-id=' not in selectors:
            continue
            
        # Parse body for background props
        bg_image_match = re.search(r'background-image:\s*url\((.*?)\)', body)
        bg_pos_match = re.search(r'background-position(-[xy])?:\s*([^;]+)', body) # simplified
        
        # Better bg parsing: split by semicolon
        props = {}
        for prop in body.split(';'):
            if ':' in prop:
                k, v = prop.split(':', 1)
                props[k.strip()] = v.strip()
        
        bg_image = props.get('background-image')
        bg_pos_x = props.get('background-position-x')
        bg_pos_y = props.get('background-position-y')
        bg_pos = props.get('background-position')
        
        # Calculate final x/y
        final_x = "0%"
        final_y = "0%"
        
        if bg_pos:
            parts = bg_pos.split()
            if len(parts) >= 1: final_x = parts[0]
            if len(parts) >= 2: final_y = parts[1]
        
        if bg_pos_x: final_x = bg_pos_x
        if bg_pos_y: final_y = bg_pos_y
        
        # Clean image url
        image_file = None
        if bg_image:
            # url(img/trees.jpg) -> trees.webp
            match = re.search(r'img/([^/\)]+)', bg_image)
            if match:
                fname = match.group(1)
                # Map extension and name
                base_name = os.path.splitext(fname)[0]
                # Special cases if any, otherwise assume webp for all main sheets
                # Based on file listing: trees.webp, hCards.webp, vCards.webp, mountain.webp, but woodlands.jpg
                if 'woodlands' in base_name.lower():
                    image_file = '/images/cards/woodlands.jpg' # It is jpg
                else:
                    image_file = f'/images/cards/{base_name}.webp' # Others are webp
        
        # Apply to all relevant IDs in selector
        # Selector format: .card[data-id="67"], .card[data-id="68"] ...
        id_pattern = re.compile(r'data-id="(\d+)"')
        ids = id_pattern.findall(selectors)
        
        for cid in ids:
            if cid not in css_data:
                css_data[cid] = {}
            
            # CSS cascades, so overwriting is correct behavior if we iterate in order
            # The regex findall iterates in file order.
            if image_file:
                css_data[cid]['image'] = image_file
            if final_x and final_y:
                css_data[cid]['pos_x'] = final_x
                css_data[cid]['pos_y'] = final_y

    return css_data

def generate_js_data(cards, css_data):
    output = "module.exports = {\n"
    output += "  cards: {\n"
    
    # Sort by ID numerically
    sorted_ids = sorted([int(k) for k in cards.keys()])
    
    for cid_int in sorted_ids:
        cid = str(cid_int)
        card = cards[cid]
        css = css_data.get(cid, {})
        
        # Merge info
        entry = {
            "id": int(cid),
            "type": card['type'],
            "species": card['species'],
            "img": css.get('image', ''),
            "x": css.get('pos_x', '0%'),
            "y": css.get('pos_y', '0%')
        }
        
        output += f"    {cid}: {json.dumps(entry, ensure_ascii=False)},\n"
        
    output += "  }\n"
    output += "};\n"
    
    return output

if __name__ == "__main__":
    cards = parse_card_js(CARD_JS_PATH)
    css_data = parse_css(CSS_PATH)
    
    result = generate_js_data(cards, css_data)
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(result)
    
    print(f"Successfully generated {OUTPUT_PATH}")
