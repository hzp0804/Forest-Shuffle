import os
import fitz  # PyMuPDF
from PIL import Image
import io
import json

# 配置
PDF_PATH = r'..\森森不息PNP（高清重制版.pdf'
OUTPUT_DIR = r'..\miniprogram\images\cards'
INDEX_FILE = r'..\miniprogram\data\cardIndex.js'

# PNP 布局配置 (假设是 A4 纸 3x3 布局)
ROWS = 3
COLS = 3

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def process_pdf():
    print(f"正在处理文件: {PDF_PATH}")
    
    if not os.path.exists(PDF_PATH):
        print("错误: 找不到 PDF 文件。请确认文件名是否正确。")
        return

    ensure_dir(OUTPUT_DIR)
    
    try:
        doc = fitz.open(PDF_PATH)
    except Exception as e:
        print(f"打开 PDF 失败: {e}")
        print("请尝试运行: pip install pymupdf pillow")
        return

    card_list = []
    card_id = 1

    print(f"共发现 {len(doc)} 页")

    for page_num, page in enumerate(doc):
        print(f"正在处理第 {page_num + 1} 页...")
        
        # 将页面渲染为高分辨率图像
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_data = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_data))
        
        width, height = img.size
        
        # 计算单张卡牌尺寸 (假设没有出血线，均匀分布)
        # 如果有出血线或边距，这里需要调整
        # 这里采用简单的 3x3 均分策略作为起点
        card_w = width / COLS
        card_h = height / ROWS

        for r in range(ROWS):
            for c in range(COLS):
                # 跳过某些页面的空白位置 (可选，这里全切)
                
                left = c * card_w
                top = r * card_h
                right = left + card_w
                bottom = top + card_h
                
                # 裁剪
                crop_img = img.crop((left, top, right, bottom))
                
                # 保存
                filename = f"card_{card_id:03d}.jpg"
                save_path = os.path.join(OUTPUT_DIR, filename)
                
                # 转换 RGB 防止保存错误
                if crop_img.mode in ("RGBA", "P"): 
                    crop_img = crop_img.convert("RGB")
                
                crop_img.save(save_path, "JPEG", quality=85)
                
                # 添加到索引
                card_list.append({
                    "id": str(card_id),
                    "image": f"/images/cards/{filename}",
                    "name": f"Card {card_id}" # 暂时用 ID 命名
                })
                
                card_id += 1

    # 生成索引文件
    js_content = "const cardIndex = " + json.dumps(card_list, indent=2, ensure_ascii=False) + ";\n\nmodule.exports = { cardIndex };"
    
    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"处理完成！生成了 {len(card_list)} 张卡牌图片。")
    print(f"索引文件已保存至: {INDEX_FILE}")

if __name__ == "__main__":
    process_pdf()
