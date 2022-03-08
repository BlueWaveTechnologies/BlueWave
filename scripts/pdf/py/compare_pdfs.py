"""
python3 py/compare_pdfs.py -f data/test_pdfs/00026_04_fda-K071597_test_data.pdf data/test_pdfs/small_test/copied_data.pdf
"""
import os 
import re
import sys
import json
import math
import pickle
import hashlib
import functools
import time
import unicodedata
import datetime
import itertools
import subprocess
from pathlib import Path 

import numpy as np
from itertools import groupby
from itertools import combinations
from operator import itemgetter
from random import randint
import sklearn
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import pairwise_distances

# from scipy.stats import chisquare

# PyMuPDF
import fitz
fitz.TOOLS.mupdf_display_errors(False)
import warnings
warnings.filterwarnings("ignore")

from pydivsufsort import divsufsort, kasai

import argparse

VERSION = "1.4.1"

TEXT_SEP = '^_^'
PAGE_SEP = '@@@'

#-------------------------------------------------------------------------------
# UTILS
#-------------------------------------------------------------------------------
class Box:
    def __init__(self, xmin, ymin, xmax, ymax):
        self.xmin = xmin
        self.ymin = ymin
        self.xmax = xmax
        self.ymax = ymax
        self.width = xmax - xmin
        self.height = ymax - ymin
        self.area = self.width * self.height

    def __repr__(self):
        return f'({self.xmin},{self.ymin},{self.xmax},{self.ymax})'

    def intersection(self, box2):
        xmin = max(self.xmin, box2.xmin)
        xmax = min(self.xmax, box2.xmax)
        ymin = max(self.ymin, box2.ymin)
        ymax = min(self.ymax, box2.ymax)
        width = xmax - xmin
        height = ymax - ymin
        if width > 0 and height > 0:
            return Box(xmin, ymin, xmax, ymax)

    def expand(self, box2):
        xmin = min(self.xmin, box2.xmin)
        xmax = max(self.xmax, box2.xmax)
        ymin = min(self.ymin, box2.ymin)
        ymax = max(self.ymax, box2.ymax)
        return Box(xmin, ymin, xmax, ymax)

    def box_distance(self, box2):
        new_area = self.expand(box2).area
        intersection = self.intersection(box2)
        if intersection:
            union_area = self.area + box2.area - intersection.area
        else:
            union_area = self.area + box2.area
        # new_area can be infinitely large, union_area is at most the sum
        #  of the two box areas
        d = (new_area / union_area) - 1
        return max(0, d) # no negative distances

    def as_tuple(self):
        return (self.xmin, self.ymin, self.xmax, self.ymax)


def get_datadir(): 
    currdir = os.path.dirname(os.path.realpath(__file__)) 
    parentdir = str(Path(currdir).parent) 
    return parentdir + os.path.sep + 'data'


def list_of_unique_dicts(L):
    # https://stackoverflow.com/questions/11092511/python-list-of-unique-dictionaries
    return list({json.dumps(v, sort_keys=True): v for v in L}.values())


def find_common_substrings(text1, text2, min_len):
    # Find all common non-overlapping substrings between two strings.
    # minLen is the minimum acceptable length of resulting common substrings.
    #
    # findCommonSubstrings("abcde", "bcbcd", 2)
    #  -> ["bcd"]
    #  Note: "bc" and "cd" are also common substrings, but they are substrings
    #      of "bcd" and therefore do not count.
    #
    # combined: "abcdebcbcd"
    # suffix array:    [0 5 7 1 6 8 2 9 3 4]
    # suffixes:
    #  - abcdebcbcd
    #  - bcbcd
    #  - bcd
    #  - bcdebcbcd
    #  - cbcd
    #  - cd
    #  - cdebcbcd
    #  - d
    #  - debcbcd
    #  - ebcbcd
    # LCP array:       [0 0 2 3 0 1 2 0 1 0]
    #
    # Iterating through LCP we check to see if the LCP value is greater than
    # minLen (meaning the overlap is long enough), and if the overlap occurs
    # in both texts.
    # We get some candidates:
    #   - bc
    #   - bcd
    #   - cd
    #
    # We sort the candidates by length and remove those that are substrings of
    # any previous candidate. Thus we are left with "bcd".

    text_combined = text1 + TEXT_SEP + text2
    sa = divsufsort(text_combined)
    lcp = kasai(text_combined, sa)
    lcp = list(lcp)
    lcp = np.array(lcp[:-1])

    # Collect candidates
    candidates = []
    l = len(text1)
    j1s = np.array(sa[:-1])
    j2s = np.array(sa[1:])
    j_min = np.minimum(j1s, j2s)
    j_max = np.maximum(j1s, j2s)

    is_long_enough = lcp > min_len
    is_in_both = (j_min < l) & (j_max > l)
    does_not_cross = ~((j_min < l) & (j_min + lcp > l))

    is_ok = is_long_enough & is_in_both & does_not_cross

    my_jmin = j_min[is_ok]
    my_jmax = j_max[is_ok]
    my_h = lcp[is_ok]

    # Remove candidates that are a substring of other candidates

    # Sort by length, descending
    sorted_idxs = np.argsort(-my_h)
    my_jmin = my_jmin[sorted_idxs]
    my_jmax = my_jmax[sorted_idxs]
    my_h = my_h[sorted_idxs]

    # Go through and take out overlapping substrings

    def is_subset_of_any_existing(new, existing):
        new_start, new_end = new
        for j1, _, h in existing:
            ex_start = j1
            ex_end = j1 + h
            if ex_start <= new_start and new_end <= ex_end:
                return True
        return False

    offset = l+len(TEXT_SEP) # What to substract to get index of occurrence in text2 
    non_overlapping = []
    LIMIT = 100000
    for j1, j2, h in zip(my_jmin[:LIMIT], my_jmax[:LIMIT], my_h[:LIMIT]):
        start = j1
        end = j1 + h
        if not is_subset_of_any_existing(new=(start, end), existing=non_overlapping):
            non_overlapping.append((j1, j2-offset, h))

    result = []
    for k1, k2, h in non_overlapping:
        substr = text1[k1:k1+h]
        if len(substr.strip()) > min_len:
            result.append((substr, k1, k2, h))

    return result


#-------------------------------------------------------------------------------
# READING FILES
#-------------------------------------------------------------------------------
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


def read_blocks_and_hashes(filename):
    if filename[-4:] != '.pdf':
        raise Exception('Fitz cannot read non-PDF file', filename)
    
    text_blocks = []
    image_hashes = []
    
    with fitz.open(filename) as doc:

        n_pages = 0
        cum_block_len = 0
        for page in doc:
            n_pages += 1
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
                    block = {
                        'text': block_text,
                        'cum_len': cum_block_len,
                        'bbox': bbox,
                        'page_num': page.number+1,
                        'block_num': block_num,
                    }
                    text_blocks.append(block)
                    cum_block_len += len(block_text)
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


def get_file_data(filenames, regen_cache):

    data = []
    for i, full_filename in enumerate(filenames):
       
        blocks_text, image_hashes, n_pages = None, None, None

        # Check if cached exists next to PDF
        cached_filename = full_filename + '.jsoncached'
        try:
            if os.path.exists(cached_filename) and not regen_cache:
                with open(cached_filename, 'rb') as f:
                    cached = json.load(f)
                    if is_compatible(VERSION, cached['version']):
                        blocks_text, image_hashes, n_pages = cached['data']
        except:
            pass

        if not blocks_text and not image_hashes and not n_pages:
            blocks_text, image_hashes, n_pages = read_blocks_and_hashes(full_filename)

            blocks_text = add_ignore_to_blocks(blocks_text)

            # And cache the data
            with open(cached_filename, 'w') as f:
                json.dump({
                    'version': VERSION,
                    'data': [blocks_text, image_hashes, n_pages],
                }, f)

        # Convert block boxes to Box class instances
        for block in blocks_text:
            block['bbox'] = Box(*block['bbox'])

        path_to_file = (os.path.sep).join(full_filename.split(os.path.sep)[:-1])
        filename = full_filename.split(os.path.sep)[-1]
        
        blocks_digits = []
        cum = 0
        for block in blocks_text:
            new_block = {k: v for k, v in block.items()} # copy
            digits = get_digits(block['text'])
            new_block['text'] = digits
            new_block['cum_len'] = cum
            cum += len(digits)
            blocks_digits.append(new_block)

        full_text = ''.join(b['text'] for b in blocks_text)
        full_digits = ''.join(b['text'] for b in blocks_digits)

        file_data = {
            'path_to_file': path_to_file,
            'filename': filename,
            'file_index': i,
            'blocks_text': blocks_text,
            'blocks_digits': blocks_digits,
            'full_text': full_text,
            'full_digits': full_digits,
            'image_hashes': image_hashes,
            'n_pages': n_pages,
        }
        data.append(file_data)
    return data


#-------------------------------------------------------------------------------
# COMPARISON
#-------------------------------------------------------------------------------
def get_digits(text):
    digits = ''
    n_letters = 0
    for c in text:
        if c.isnumeric():
            digits += c
            n_letters += 1
        elif c.isalpha():
            n_letters += 1
    # try:
    #     if len(text) > 10 and len(digits) / n_letters < 0.2:
    #         return ''
    # except ZeroDivisionError:
    #     pass

    return digits

def compare_images(hash_info_a, hash_info_b):
    # hash_info_a and hash_info_b are lists of tuples
    # (img_hash, bbox, page_number)

    # Create these dicts so that we can look up info later
    info_a = {hsh: (bbx, p) for hsh, bbx, p in hash_info_a}
    info_b = {hsh: (bbx, p) for hsh, bbx, p in hash_info_b}
    
    hashes_a = set(info_a)
    hashes_b = set(info_b)
    common_hashes = hashes_a.intersection(hashes_b)

    common_hash_info = []
    for h in common_hashes:
        result = (h, info_a[h], info_b[h])
        common_hash_info.append(result)

    return common_hash_info


def benford_test(text):
    """
    Check distribution of leading digits against benford distribution.
    The input text string here will typically be a paragraph.
    """
    if len(text) < 140:
        return 1.0

    n_digits = sum(c.isnumeric() for c in text)
    n_letters = sum(c.isalpha() for c in text)
    try:
        if n_digits / n_letters < 0.1:
            return 1.0
    except ZeroDivisionError:
        pass

    # First replace decimals and commas
    page_text2 = text.replace('.', '')
    page_text2 = page_text2.replace(',', '')

    # Then iterate thru and get lead digits
    leading_digits = []
    for prev, cur in zip(' '+page_text2[:-1], page_text2):
        if cur.isnumeric() and not prev.isnumeric():
            leading_digits.append(cur)
    # print('Leading digits:', leading_digits)
    if not leading_digits:
        return 1.0

    # Get counts
    counts = [leading_digits.count(str(d)) for d in range(1, 10)]
    percentages = [100*c/sum(counts) for c in counts]
    # print('Percentages:', percentages)

    # Benford's Law percentages for leading digits 1-9
    BENFORD = [30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6]

    # Chi square test
    p = chisquare(percentages, f_exp=BENFORD).pvalue

    return p


def find_blocks_of_sus_substr(blocks, sus_start, h):
    """
    Inputs:
        blocks - list of tups (text, cum_txt_len, bbox, page_num)
        sus_start - int index of occurrence of substring
        h - length of sus substr

    Returns (page number int, bbox tup)
    """
    blocks_covered = []
    for block in blocks:
        text, block_start, bbox, page_num = block
        block_end = block_start + len(text)
        # block_start comes from len() and so is IN the block
        # block_end is NOT in the block
        is_left = sus_start < block_start and sus_start+h < block_start
        is_right = block_end <= sus_start and block_end <= sus_start+h
        if not (is_left or is_right):
            blocks_covered.append(block)

    return blocks_covered


def get_lined_up_blocks(blocks1, blocks2, j1, j2, h):
    """
    Inputs:
        blocks1 - list of dicts
            blocks in text1 where the string is located
        blocks2 - list of dicts
            blocks in text2 where the string is located
        j1 - index of occurrence in text 1
        j2 - index of occurrence in text 2
        h - length of suspicious string

    Outputs:
        list of tups of lists of blocks:
        [
            (blocks1a, blocks2a),
            (blocks1b, blocks2b),
            ...
        ]
        blocks1a and blocks2a "line up" and contain approximately the same text
    """
    def get_page_str_block_str(blocks, j, h):
        """
        Inputs:
            blocks - list of dicts
            j - index of occurrence in text
            h - length of suspicious string
        """
        pages = []
        block_idxs = []
        block_i = 0
        for block in blocks:
            pages += [block['page_num']]*len(block['text'])
            block_idxs += [block_i]*len(block['text'])
            block_i += 1
        # trim
        pad_start = j - blocks[0]['cum_len'] # How many chars until we see the sus string
        pad_end = (blocks[-1]['cum_len'] + len(blocks[-1]['text'])) - (j+h) # Extra chars at the end
        if pad_end == 0: # because [-0] index works weirdly
            pages = pages[pad_start:]
            block_idxs = block_idxs[pad_start:]
        else:
            pages = pages[pad_start:-pad_end]
            block_idxs = block_idxs[pad_start:-pad_end]
        return pages, block_idxs

    pages1, block_idxs_1 = get_page_str_block_str(blocks1, j1, h)
    pages2, block_idxs_2 = get_page_str_block_str(blocks2, j2, h)
    assert len(block_idxs_1) == len(block_idxs_2) # Should be same bc the common substring is same
    assert len(blocks1) >= max(block_idxs_1)

    result = []
    queue1 = set([block_idxs_1[0]])
    queue2 = set([block_idxs_2[0]])
    for i in range(1, len(block_idxs_1)):
        blocks1_change = block_idxs_1[i] != block_idxs_1[i-1]
        blocks2_change = block_idxs_2[i] != block_idxs_2[i-1]
        page1_change = pages1[i] != pages1[i-1]
        page2_change = pages2[i] != pages2[i-1]
        both_blocks_changed = blocks1_change and blocks2_change
        any_pages_changed = page1_change or page2_change
        if both_blocks_changed or any_pages_changed:
            result.append((list(queue1), list(queue2)))
            queue1 = set([block_idxs_1[i]])
            queue2 = set([block_idxs_2[i]])
        else:
            queue1.add(block_idxs_1[i])
            queue2.add(block_idxs_2[i])

    result2 = []
    for idxs1, idxs2 in result:
        lblocks1 = [blocks1[i] for i in idxs1]
        lblocks2 = [blocks2[i] for i in idxs2]
        result2.append((lblocks1, lblocks2))

    return result2


def get_bboxes_by_page(sus_str, blocks1, blocks2, j1, j2, h):
    """
    Inputs:
        sus_str - the suspiciuos str
        blocks1 - list of tups (text, cum_txt_len, bbox, page_num)
            blocks in text1 where the string is located
        blocks2 - list of tups (text, cum_txt_len, bbox, page_num)
            blocks in text2 where the string is located
        j1 - index of occurrence in text 1
        j2 - index of occurrence in text 2
        h - length of suspicious string
    
    Outputs:
        list of tups (sus_substr, page_a, bbox_a, page_b, bbox_b)
    """
    uniq_page_blocks = {}
    for i in range(len(pages1)):
        page_pair = (pages1[i], pages2[i])
        try:
            block_1_i = blocks1[block_idxs_1[i]]
            block_2_i = blocks2[block_idxs_2[i]]
            uniq_page_blocks[page_pair]['blocks1'][block_1_i] = 0
            uniq_page_blocks[page_pair]['blocks2'][block_2_i] = 0
            uniq_page_blocks[page_pair]['str_len'] += 1
        except KeyError:
            uniq_page_blocks[page_pair] = {
                'blocks1': {block_1_i: 0},
                'blocks2': {block_2_i: 0},
                'str_len': 1
            }

    result = []
    for page_pair, block_dict in uniq_page_blocks.items():
        page_a, page_b = page_pair
        
        bbox_a = [box for txt, cum, box, p in block_dict['blocks1']]
        bbox_b = [box for txt, cum, box, p in block_dict['blocks2']]
        bbox_a = combine_bboxes(bbox_a)
        bbox_b = combine_bboxes(bbox_b)

        page_str = ''.join(txt for txt, cum, box, p in block_dict['blocks1'])
        if sus_str in page_str:
            result.append((sus_str, page_a, bbox_a, page_b, bbox_b))
        elif page_str in sus_str:
            result.append((page_str, page_a, bbox_a, page_b, bbox_b))
        else:        
            # Try from start
            from_start = page_str[:block_dict['str_len']]
            from_end = page_str[-block_dict['str_len']:]
            if from_start in sus_str:
                result.append((from_start, page_a, bbox_a, page_b, bbox_b))
            elif from_end in sus_str:
                result.append((from_end, page_a, bbox_a, page_b, bbox_b))
            else:
                print(page_str, sus_str, block_dict['str_len'])
                raise Exception('Cant get substring')

    return result


def find_page_of_sus_image(pages, sus_hash):
    for page_num, page_hashes in pages:
        if sus_hash in page_hashes:
            return page_num
    return 'Page not found'


def filter_sus_pairs(suspicious_pairs):
    # TODO
    return significant_text_pairs + significant_other_pairs


def merge_blocks(blocks):
    new_text = ''
    cums = []
    ps = []
    block_nums = []
    for block in blocks:
        new_text = new_text + ' ' + block['text']
        cums.append(block['cum_len'])
        ps.append(block['page_num'])
        block_nums.append(block['block_num'])
    boxes = [b['bbox'] for b in blocks]
    new_box = functools.reduce(lambda box_a, box_b: box_a.expand(box_b), boxes)
    new_block = {
        'text': new_text,
        'cum_len': min(cums),
        'bbox': new_box,
        'page_num': min(ps),
        'block_num': min(block_nums),
    }
    return new_block


def agglomerative_cluster_blocks(block_pairs, threshold=0.5):
    """
    If the bboxes are close together, combine them into one.
    We check this by comparing the sum of areas over the area of the combined
    bbox. If it's over a threshold, we go ahead and combine.

    Blocks that are on different pages are considered infinitely far apart
    and will never be merged.

    Inputs:
        block_pairs - list of tuples, where each tuple has a 
            first block and a second block; block is a dict

    Outputs:
        same format
    """

    if len(block_pairs) == 1:
        return block_pairs

    def distance(idx1, idx2):
        # block pair 1 and block pair 2 are both elements of the list block_pairs.
        # We pass indexes here because the pairwise_distances function needs something
        #  that can be turned into a numpy array, and block_pairs doesn't seem to work.
        block_pair_1 = block_pairs[int(idx1[0])]
        block_pair_2 = block_pairs[int(idx2[0])]
        
        def block_distance(block1, block2):
            # block1 and block2 must be blocks on the same document
            if block1['page_num'] != block2['page_num']: # Different page blocks will not be merged
                return 1e99
            return block1['bbox'].box_distance(block2['bbox'])

        dist0 = block_distance(block_pair_1[0], block_pair_2[0])
        dist1 = block_distance(block_pair_2[1], block_pair_2[1])
        # Return the max of the two distances to prevent wrong mergers
        return max(dist0, dist1) 

    idxs = [[i] for i in range(len(block_pairs))]
    m = pairwise_distances(idxs, idxs, metric=distance)

    agg = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=threshold,
        affinity='precomputed',
        linkage='single',
    )

    u = agg.fit_predict(m)
    clusters = {}
    # print(m)
    for block_pair, label in zip(block_pairs, u):
        block1, block2 = block_pair
        try:
            clust_block1, clust_block2 = clusters[label]
            new_block1 = merge_blocks([block1, clust_block1])
            new_block2 = merge_blocks([block2, clust_block2])
            clusters[label] = (new_block1, new_block2)
        except KeyError:
            clusters[label] = block_pair

    clustered_block_pairs = [bp for l, bp in clusters.items()]
    return clustered_block_pairs


def compare_texts(data_a, data_b, text_suffix, min_len, comparison_type_name):
    """
    Inputs:
        data_a - data for first PDF
        data_b - data for second PDF
        text_suffix - suffix to determine which data field to use (text or digits)
        min_len - minimum acceptable length of duplicate text
        comparison_type_name - what to put in the output for "type"
    """
    results = []
    common_substrings = find_common_substrings(
        text1=data_a[f'full_{text_suffix}'],
        text2=data_b[f'full_{text_suffix}'],
        min_len=min_len
    )

    if any(common_substrings):
        all_lined_up_blocks = []

        for sus_str, j1, j2, h in common_substrings:

            lined_up_blocks = get_lined_up_blocks(
                data_a[f'blocks_{text_suffix}'],
                data_b[f'blocks_{text_suffix}'],
                j1, j2, h
            )
            all_lined_up_blocks.extend(lined_up_blocks)

        # Merge all the lined up blocks
        merged_blocks = []
        for line_a, line_b in all_lined_up_blocks:
            merged_blocks.append(
                (merge_blocks(line_a), merge_blocks(line_b))
            )

        # Intelligently combine the merged blocks
        intelligently_combined_block_pairs = agglomerative_cluster_blocks(merged_blocks)

        # Filter out merged blocks
        #TODO

        for block0, block1 in intelligently_combined_block_pairs:
            sus_substr = block0['text'] # Temporary
            if len(sus_substr) <= 5:
                continue

            str_preview = sus_substr
            if len(str_preview) > 97:
                str_preview = str_preview[:97].replace('\n', ' ')+'...'

            sus_result = {
                'type': comparison_type_name,
                'string': sus_substr,
                'string_preview': str_preview,
                'length': len(sus_substr),
                'pages': [
                    {
                        'file_index': data_a['file_index'],
                        'page': block0['page_num'],
                        'bbox': block0['bbox'].as_tuple(),
                    }, {
                        'file_index': data_b['file_index'], 
                        'page': block1['page_num'],
                        'bbox': block1['bbox'].as_tuple(),
                    },
                ]
            }
            results.append(sus_result)


            # blocks_a = find_blocks_of_sus_substr(data_a[f'blocks_{text_suffix}'], j1, h)
            # blocks_b = find_blocks_of_sus_substr(data_b[f'blocks_{text_suffix}'], j2, h)



            # combined_blocks = combine_blocks(sus_str, blocks_a, blocks_b, j1, j2, h)

            # for sus_substr, blocks_a, blocks_b, bbox_a, page_b, bbox_b in combined_blocks:

                # if len(sus_substr) < 5:
                    # continue
    return results


#-------------------------------------------------------------------------------
# GATHERING RESULTS
#-------------------------------------------------------------------------------
def get_file_info(file_data, suspicious_pairs):
    # Set of suspicious pages for filename
    sus_page_sets = [set() for i in file_data]
    for pair in suspicious_pairs:
        pages = pair['pages']
        for page in pages:
            sus_page_sets[page['file_index']].add(page['page'])

    file_info = []
    for i, data in enumerate(file_data):
        file_sus_pages = list(sus_page_sets[i])
        fi = {
            'filename': data['filename'], 
            'path_to_file': data['path_to_file'],
            'n_pages': data['n_pages'],
            'n_suspicious_pages': len(file_sus_pages),
            'suspicious_pages': file_sus_pages,
        }
        file_info.append(fi)
    return file_info


def get_similarity_scores(file_data, suspicious_pairs, methods_run):
    METHOD_NAMES = [
        ('Common digit sequence', 'digits'),
        ('Common text string', 'text'), 
        ('Identical image', 'images'),
    ]

    # Reorganize the suspicious pairs so we can efficiently access when looping
    reorg_sus_pairs = {}
    for sus in suspicious_pairs:
        file_a, file_b = [p['file_index'] for p in sus['pages']]
        method = sus['type']
        if file_a not in reorg_sus_pairs:
            reorg_sus_pairs[file_a] = {}
        if file_b not in reorg_sus_pairs[file_a]:
            reorg_sus_pairs[file_a][file_b] = {}
        if method not in reorg_sus_pairs[file_a][file_b]:
            reorg_sus_pairs[file_a][file_b][method] = []

        reorg_sus_pairs[file_a][file_b][method].append(sus)

    # Only upper triangle not incl. diagonal of cross matrix
    similarity_scores = {}
    for a in range(len(file_data)-1):
        for b in range(a+1, len(file_data)):

            if a not in similarity_scores:
                similarity_scores[a] = {}
            if b not in similarity_scores[a]:
                similarity_scores[a][b] = {}

            for method_long, method_short in METHOD_NAMES:
                if method_short in methods_run:
                    try:
                        suspairs = reorg_sus_pairs[a][b].get(method_long, [])
                    except KeyError:
                        suspairs = []

                    if method_long == 'Common digit sequence':
                        intersect = sum(s['length'] for s in suspairs)
                        a_clean = file_data[a]['full_digits']
                        b_clean = file_data[b]['full_digits']
                        union = len(a_clean) + len(b_clean) - intersect
                    elif method_long == 'Common text string':
                        intersect = sum(s['length'] for s in suspairs)
                        a_clean = file_data[a]['full_text']
                        b_clean = file_data[b]['full_text']
                        union = len(a_clean) + len(b_clean) - intersect
                    elif method_long == 'Identical image':
                        intersect = len(suspairs)
                        union = (len(file_data[a]['image_hashes']) + 
                            len(file_data[b]['image_hashes']) - intersect)
                    if union == 0:
                        jaccard = 'Undefined'
                    else:
                        jaccard = intersect / union
                    similarity_scores[a][b][method_long] = jaccard
                else:
                    similarity_scores[a][b][method_long] = 'Not run'

    return similarity_scores


def get_version():
    # repo = Repo()
    # ver = repo.git.describe('--always')
    # currdir = os.path.dirname(os.path.realpath(__file__)) 
    # ver = subprocess.check_output(["git", "describe", "--always"], cwd=currdir).strip()
    # return ver.decode("utf-8") 
    return VERSION


#-------------------------------------------------------------------------------
# MAIN
#-------------------------------------------------------------------------------
def main(filenames, methods, pretty_print, verbose=False, regen_cache=False):
    t0 = time.time()
    assert len(filenames) >= 2, 'Must have at least 2 files to compare!'

    if not methods:
        if verbose: print('Methods not specified, using default (all).')
        methods = ['digits', 'images', 'text']
    if verbose: print('Using methods:', ', '.join(methods))

    suspicious_pairs = []

    if verbose: print('Reading files...')
    file_data = get_file_data(filenames, regen_cache)

    for i in range(len(filenames)-1):
        for j in range(i+1, len(filenames)):
            # i always less than j
            a = file_data[i]
            b = file_data[j]

            # Compare numbers
            if 'digits' in methods:
                if verbose: print('Comparing digits...')
                digit_results = compare_texts(
                    data_a=a,
                    data_b=b,
                    text_suffix='digits',
                    min_len=10,
                    comparison_type_name='Common digit sequence'
                )
                suspicious_pairs.extend(digit_results)

            # Compare texts
            if 'text' in methods:
                if verbose: print('Comparing texts...')
                text_results = compare_texts(
                    data_a=a,
                    data_b=b,
                    text_suffix='text',
                    min_len=200,
                    comparison_type_name='Common text string'
                )
                suspicious_pairs.extend(text_results)

            # Compare images
            if 'images' in methods:
                if verbose: print('Comparing images...')
                identical_images = compare_images(
                    a['image_hashes'],
                    b['image_hashes'],
                )
                any_images_are_sus = len(identical_images) > 0
                if any_images_are_sus:
                    for img_hash, info_a, info_b in identical_images:
                        bbox_a, sus_page_a = info_a
                        bbox_b, sus_page_b = info_b
                        sus_result = {
                            'type': 'Identical image',
                            'image_hash': img_hash,
                            'pages': [
                                {
                                    'file_index': a['file_index'], 
                                    'page': sus_page_a,
                                    'bbox': bbox_a,
                                }, {
                                    'file_index': b['file_index'],
                                    'page': sus_page_b,
                                    'bbox': bbox_b,
                                },
                            ]
                        }
                        suspicious_pairs.append(sus_result)

    # Remove duplicate suspicious pairs (this might happen if a page has
    # multiple common substrings with another page)
    if verbose: print('Removing duplicate sus pairs...')
    suspicious_pairs = list_of_unique_dicts(suspicious_pairs)

    # Filter out irrelevant sus pairs
    # if verbose: print('Removing irrelevant pairs...')
    # suspicious_pairs = filter_sus_pairs(suspicious_pairs)

    # Calculate some more things for the final output
    if verbose: print('Gathering output...')
    if verbose: print('\tGet file info...')
    file_info = get_file_info(file_data, suspicious_pairs)
    if verbose: print('\tGet total pages...')
    total_page_pairs = sum(f['n_pages'] for f in file_info)
    if verbose: print('\tGet similarity score...')
    similarity_scores = get_similarity_scores(file_data, suspicious_pairs, methods)
    if verbose: print('\tGet version...')
    version = get_version()
    if verbose: print('\tResults gathered.')

    dt = time.time() - t0
    if dt == 0:
        pages_per_second = -1
    else:
        pages_per_second = total_page_pairs/dt

    result = {
        'files': file_info,
        'suspicious_pairs': suspicious_pairs,
        'num_suspicious_pairs': len(suspicious_pairs),
        'elapsed_time_sec': dt,
        'pages_per_second': pages_per_second,
        'similarity_scores': similarity_scores,
        'version': version,
        'time': datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    if pretty_print:
        print(json.dumps(result, indent=2), file=sys.stdout)
    else:
        print(json.dumps(result), file=sys.stdout)

    return


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-f',
        '--filenames', 
        help='PDF filenames to compare', 
        nargs='+',
    )
    parser.add_argument(
        '-m',
        '--methods', 
        help='Which of the three comparison methods to use: text, digits, images', 
        nargs='+',
    )
    parser.add_argument(
        '-p',
        '--pretty_print',
        help='Pretty print output',
        action='store_true'
    )
    parser.add_argument(
        '-c',
        '--regen_cache',
        help='Ignore and overwrite cached data',
        action='store_true'
    )
    parser.add_argument(
        '-v',
        '--verbose',
        help='Print things while running',
        action='store_true'
    )
    parser.add_argument(
        '--version',
        help='Print version',
        action='store_true'
    )
    args = parser.parse_args()

    if args.version:
        print(VERSION)
    else:
        main(
            filenames=args.filenames, 
            methods=args.methods,
            pretty_print=args.pretty_print,
            verbose=args.verbose,
            regen_cache=args.regen_cache
            )

# Within-file tests:
#    - Benford's Law
# for file in filenames:
#     a = file_data[file.split('/')[-1]]
#     for page_num, page_text in a['page_texts']:
#         paragraphs = re.split(r'[ \n]{4,}', page_text)
#         for paragraph in paragraphs:
#             p = benford_test(paragraph)
#             if p < 0.05:
#                 sus_result = {
#                     'type': 'Failed Benford Test',
#                     'p_value': p,
#                     'pages': [
#                         {'filename': a['filename'], 'page': page_num},
#                         {'filename': a['filename'], 'page': page_num},
#                     ]
#                 }
