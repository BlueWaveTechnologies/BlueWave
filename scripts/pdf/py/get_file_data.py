import json
import os

import compare_pdfs_util

# PyMuPDF
import fitz
fitz.TOOLS.mupdf_display_errors(False)
import warnings
warnings.filterwarnings("ignore")


# def get_page_texts(filename):
#     texts = []
#     with fitz.open(filename) as doc:
#         for page in doc:
#             page_text = page.get_text()
#             page_text_ascii = ''.join(c if c.isascii() else ' ' for c in page_text)
#             texts.append((page.number+1, page_text_ascii))

#     return texts


def get_page_image_hashes(filename):
    hashes = []
    with fitz.open(filename) as doc:
        for page in doc:
            page_images = page.get_image_info(hashes=True)
            page_hashes = []
            for img in page_images:
                hash_ = img['digest'].hex()
                if img['height'] > 200 and img['width'] > 200:
                    page_hashes.append(hash_)
            hashes.append((page.number+1, page_hashes))
    return hashes


def page_skip_conditions(page_text):
    conds = [
        'FORM FDA ' in page_text,
        'Form FDA ' in page_text,
        'PAPERWORK REDUCTION ACT' in page_text,
        'PAYMENT IDENTIFICATION NUMBER' in page_text,
        'For more assistance with Adobe Reader' in page_text,
        'latest version of Adobe Reader' in page_text,
        '..................................................................' in page_text,
        'Safety Data Sheet' in page_text,
        'SAFETY DATA SHEET' in page_text,
        'Contains Nonbinding Recommendations' in page_text,
    ]
    return conds


def block_skip_conditions(block_text):
    conds = [
        '510(k)' in block_text,
        'New Hampshire Avenue' in block_text,
        'ISO ' in block_text,
        'IEC ' in block_text,
        '..............' in block_text,
        'Tel.:' in block_text,
        'TEL:' in block_text,
        'FAX:' in block_text,
        'Fax:' in block_text,
        '+86' in block_text,
        '86-519' in block_text,
        not block_text,
    ]
    return conds


def read_blocks_and_hashes(filename):
    if filename[-4:] != '.pdf':
        raise Exception('Fitz cannot read non-PDF file', filename)
    
    text_blocks = []
    image_hashes = []
    
    with fitz.open(filename) as doc:

        n_pages = 0
        cum_len_text = 0
        cum_len_digits = 0
        for page in doc:
            n_pages += 1

            if any(page_skip_conditions(page.get_text())):
                continue

            block_num = 0
            # t0 = time.time()
            # page_d = page.get_text('dict')
            page_blocks = page.get_text('blocks')
            page_images = page.get_image_info(hashes=True)
            w = page.rect.width
            h = page.rect.height
            # print(time.time()-t0, 'get text dict')

            # t0 = time.time()
            for img in page_images:
                hash_ = img['digest'].hex()
                x0, y0, x1, y1 = img['bbox']
                bbox = (x0/w, y0/h, x1/w, y1/h) # Relative to page size
                if img['height'] > 200 and img['width'] > 200:
                    image_hashes.append((hash_, bbox, page.number+1))

            for raw_block in page_blocks:
                x0, y0, x1, y1, block_text, n, typ = raw_block
                bbox = (x0/w, y0/h, x1/w, y1/h) # Relative to page size

                if typ == 0: # Only look at text blocks
                    block_text = block_text.strip()
                    block_text = block_text.encode("ascii", errors="ignore").decode()
                    block_digits = compare_pdfs_util.get_digits(block_text)
                    block = {
                        'text': block_text,
                        'digits': block_digits,
                        'cum_len_text': cum_len_text,
                        'cum_len_digits': cum_len_digits,
                        'bbox': bbox,
                        'page_num': page.number+1,
                        'block_num': block_num,
                    }
                    if not any(block_skip_conditions(block_text)):
                        text_blocks.append(block)
                        cum_len_text += len(block_text)
                        cum_len_digits += len(block_digits)
                        block_num += 1
            # print(time.time()-t0, 'other stuff')

    return text_blocks, image_hashes, n_pages


def is_compatible(v_current, v_cache):
    """
    v_current and v_cache are strings like 1.1.1
    compare first two digits
    """
    int_cur = int(''.join(v_current.split('.')[:2]))
    int_cache = int(''.join(v_cache.split('.')[:2]))
    return int_cur == int_cache


def add_ignore_to_blocks(blocks):
    # # Load vectorizer
    # datadir = get_datadir()
    # with open(f'{datadir}/vectorizer.p', 'rb') as f:
    #     vectorizer = pickle.load(f)
    # with open(f'{datadir}/text_clf.p', 'rb') as f:
    #     clf = pickle.load(f)

    # # Classify blocks
    # text_strs = [b['text'] for b in blocks]
    # X = vectorizer.transform(text_strs)
    # ignore_pred = clf.predict(X)

    # # Add labels to blocks
    # for block, ignore_pred in zip(blocks, ignore_pred):
    #     block['ignore'] = ignore_pred

    for block in blocks:
        block['ignore'] = False

    return blocks


def main(filenames, regen_cache, version):

    data = []
    for i, full_filename in enumerate(filenames):
       
        blocks, image_hashes, n_pages = None, None, None

        # Check if cached exists next to PDF
        # if exists, check if version is compatible
        cached_filename = full_filename + '.jsoncached'
        try:
            if os.path.exists(cached_filename) and not regen_cache:
                with open(cached_filename, 'rb') as f:
                    cached = json.load(f)
                if is_compatible(version, cached['version']):
                    blocks, image_hashes, n_pages = cached['data']
        except:
            pass

        if not blocks and not image_hashes and not n_pages:
            blocks, image_hashes, n_pages = read_blocks_and_hashes(full_filename)

            # blocks = add_ignore_to_blocks(blocks)

            # And cache the data
            with open(cached_filename, 'w') as f:
                json.dump({
                    'version': version,
                    'data': [blocks, image_hashes, n_pages],
                }, f)

        # Convert block boxes to Box class instances
        for block in blocks:
            block['bbox'] = compare_pdfs_util.Box(*block['bbox'])

        path_to_file = (os.path.sep).join(full_filename.split(os.path.sep)[:-1])
        filename = full_filename.split(os.path.sep)[-1]
        
        full_text = ''.join(b['text'] for b in blocks)
        full_digits = ''.join(b['digits'] for b in blocks)

        file_data = {
            'path_to_file': path_to_file,
            'filename': filename,
            'file_index': i,
            'blocks': blocks,
            'full_text': full_text,
            'full_digits': full_digits,
            'image_hashes': image_hashes,
            'n_pages': n_pages,
        }
        data.append(file_data)
    return data
