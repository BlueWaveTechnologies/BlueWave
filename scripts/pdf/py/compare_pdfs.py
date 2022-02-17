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
# from scipy.stats import chisquare

# PyMuPDF
import fitz
fitz.TOOLS.mupdf_display_errors(False)
import warnings
warnings.filterwarnings("ignore")

from pydivsufsort import divsufsort, kasai

import argparse

VERSION = "1.3.1"

TEXT_SEP = '^_^'
PAGE_SEP = '@@@'

#-------------------------------------------------------------------------------
# UTILS
#-------------------------------------------------------------------------------


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
                    text_blocks.append((block_text, cum_block_len, bbox, page.number+1))
                    cum_block_len += len(block_text)
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
                        blocks_text = [(t, c, tuple(b), p) for t, c, b, p in blocks_text]
                        # Sadly JSON doesnt understand tuples
        except:
            pass

        if not blocks_text and not image_hashes and not n_pages:
        # if True:
            blocks_text, image_hashes, n_pages = read_blocks_and_hashes(full_filename)

            # And cache the data
            with open(cached_filename, 'w') as f:
                json.dump({
                    'version': VERSION,
                    'data': [blocks_text, image_hashes, n_pages],
                }, f)

        path_to_file = (os.path.sep).join(full_filename.split(os.path.sep)[:-1])
        filename = full_filename.split(os.path.sep)[-1]
        # blocks_text_lengths = [len(t) for t, b, p in blocks_text]
        blocks_digits = []
        cum = 0
        for t, c, b, p in blocks_text:
            ds = get_digits(t)
            blocks_digits.append((ds, cum, b, p))
            cum += len(ds)
        # blocks_digits_lengths = [len(t) for t, b, p in blocks_digits]
        full_text = ''.join(t for t, c, bbx, p in blocks_text)
        full_digits = ''.join(t for t, c, bbx, p in blocks_digits)

        file_data = {
            'path_to_file': path_to_file,
            'filename': filename,
            'file_index': i,
            'blocks_text': blocks_text,
            # 'blocks_text_lengths': blocks_text_lengths,
            'blocks_digits': blocks_digits,
            # 'blocks_digits_lengths': blocks_digits_lengths,
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
    result = ''.join(c for c in text if c.isnumeric())
    return result


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
        if n_digits / n_letters < 0.5:
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


def combine_bboxes(bboxes, threshold=0.6):
    """
    If the bboxes are close together, combine them into one.
    We check this by comparing the sum of areas over the area of the combined
    bbox. If it's over a threshold, we go ahead and combine.

    Inputs:
        bboxes - list of (x0, y0, x1, y1)
        thresold - area threshold to combine
    """
    sum_areas = sum((x1-x0) * (y1-y0) for x0, y0, x1, y1 in bboxes)
    cx0 = min(x0 for x0, y0, x1, y1 in bboxes)
    cx1 = max(x1 for x0, y0, x1, y1 in bboxes)
    cy0 = min(y0 for x0, y0, x1, y1 in bboxes)
    cy1 = max(y1 for x0, y0, x1, y1 in bboxes)
    new_area = (cx1-cx0) * (cy1-cy0)
    if sum_areas / new_area > threshold:
        return [(cx0, cy0, cx1, cy1)]
    else:
        return bboxes


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
    def get_page_str_block_str(blocks, j, h):
        pages = []
        block_idxs = []
        block_i = 0
        for txt, cum, box, p in blocks:
            pages += [p]*len(txt)
            block_idxs += [block_i]*len(txt)
            block_i += 1
        # trim
        pad_start = j - blocks[0][1] # How many chars until we see the sus string
        pad_end = (blocks[-1][1]+len(blocks[-1][0])) - (j+h) # Extra chars at the end
        if pad_end == 0: # because [-0] index works weirdly
            pages = pages[pad_start:]
            block_idxs = block_idxs[pad_start:]
        else:
            pages = pages[pad_start:-pad_end]
            block_idxs = block_idxs[pad_start:-pad_end]
        return pages, block_idxs

    pages1, block_idxs_1 = get_page_str_block_str(blocks1, j1, h)
    pages2, block_idxs_2 = get_page_str_block_str(blocks2, j2, h)
    assert len(pages1) == len(pages2) # Should be same bc the common substring is same

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
    common_text_sus_pairs = []
    all_other_pairs = []
    for p in suspicious_pairs:
        if p['type'] == 'Common text string':
            common_text_sus_pairs.append(p)
        else:
            all_other_pairs.append(p)

    if not common_text_sus_pairs:
        return suspicious_pairs

    datadir = get_datadir()
    with open(f'{datadir}/vectorizer.p', 'rb') as f:
        vectorizer = pickle.load(f)
    with open(f'{datadir}/text_clf.p', 'rb') as f:
        clf = pickle.load(f)

    text_strs = [p['string'] for p in common_text_sus_pairs]
    X = vectorizer.transform(text_strs)
    y_pred = clf.predict(X)

    # Go through and identify whether text pairs are good or bad.
    # Save which pages have insignificant (bad) text pairs and remember those,
    # we will ignore other matches from those pages as well.
    significant_text_pairs = []
    bad_pages = set()
    for pair, prediction in zip(common_text_sus_pairs, y_pred):
        if prediction==1:
            significant_text_pairs.append(pair)
        else:
            bad_page_1 = (pair['pages'][0]['file_index'], pair['pages'][0]['page'])
            bad_page_2 = (pair['pages'][1]['file_index'], pair['pages'][1]['page'])
            bad_pages.add(bad_page_1)
            bad_pages.add(bad_page_2)

    significant_other_pairs = []
    for pair in all_other_pairs:
        page1 = (pair['pages'][0]['file_index'], pair['pages'][0]['page'])
        page2 = (pair['pages'][1]['file_index'], pair['pages'][1]['page'])
        if page1 in bad_pages or page2 in bad_pages:
            continue
        else:
            significant_other_pairs.append(pair)


    return significant_text_pairs + significant_other_pairs


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
        for sus_str, j1, j2, h in common_substrings:

            blocks_a = find_blocks_of_sus_substr(data_a[f'blocks_{text_suffix}'], j1, h)
            blocks_b = find_blocks_of_sus_substr(data_b[f'blocks_{text_suffix}'], j2, h)

            bboxes = get_bboxes_by_page(sus_str, blocks_a, blocks_b, j1, j2, h)

            for sus_substr, page_a, bbox_a, page_b, bbox_b in bboxes:

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
                            'page': page_a,
                            'bbox': bbox_a,
                        }, {
                            'file_index': data_b['file_index'],
                            'page': page_b,
                            'bbox': bbox_b,
                        },
                    ]
                }
                results.append(sus_result)
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
                    min_len=30,
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
                    min_len=280,
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
                                    'bbox': [bbox_a],
                                }, {
                                    'file_index': b['file_index'],
                                    'page': sus_page_b,
                                    'bbox': [bbox_b],
                                },
                            ]
                        }
                        suspicious_pairs.append(sus_result)

    # Remove duplicate suspicious pairs (this might happen if a page has
    # multiple common substrings with another page)
    if verbose: print('Removing duplicate sus pairs...')
    suspicious_pairs = list_of_unique_dicts(suspicious_pairs)

    # Filter out irrelevant sus pairs
    if verbose: print('Removing irrelevant pairs...')
    suspicious_pairs = filter_sus_pairs(suspicious_pairs)

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
