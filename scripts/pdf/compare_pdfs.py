"""
python3 py/compare_pdfs.py -f data/test_pdfs/00026_04_fda-K071597_test_data.pdf data/test_pdfs/copied_data.pdf
"""

import sys
import json
import time
import difflib
import argparse
import itertools
from itertools import groupby
from itertools import combinations
from operator import itemgetter
from random import randint
import fitz  # this is pymupdf


#-------------------------------------------------------------------------------
# UTILS
#-------------------------------------------------------------------------------
def list_of_unique_dicts(L):
    # https://stackoverflow.com/questions/11092511/python-list-of-unique-dictionaries
    return list({json.dumps(v, sort_keys=True): v for v in L}.values())


def longest_common_substring(text):
    """Get the longest common substrings and their positions.
    >>> longest_common_substring('banana')
    {'ana': [1, 3]}
    >>> text = "not so Agamemnon, who spoke fiercely to "
    >>> sorted(longest_common_substring(text).items())
    [(' s', [3, 21]), ('no', [0, 13]), ('o ', [5, 20, 38])]
    This function can be easy modified for any criteria, e.g. for searching ten
    longest non overlapping repeated substrings.
    """
    sa, rsa, lcp = suffix_array(text)
    maxlen = max(lcp)
    result = {}
    for i in range(1, len(text)):
        if lcp[i] == maxlen:
            j1, j2, h = sa[i - 1], sa[i], lcp[i]
            assert text[j1:j1 + h] == text[j2:j2 + h]
            substring = text[j1:j1 + h]
            if substring not in result:
                result[substring] = [j1]
            result[substring].append(j2)
    return dict((k, sorted(v)) for k, v in result.items())


def suffix_array(text, _step=16):
    """Analyze all common strings in the text.
    Short substrings of the length _step a are first pre-sorted. The are the
    results repeatedly merged so that the garanteed number of compared
    characters bytes is doubled in every iteration until all substrings are
    sorted exactly.
    Arguments:
        text:  The text to be analyzed.
        _step: Is only for optimization and testing. It is the optimal length
               of substrings used for initial pre-sorting. The bigger value is
               faster if there is enough memory. Memory requirements are
               approximately (estimate for 32 bit Python 3.3):
                   len(text) * (29 + (_size + 20 if _size > 2 else 0)) + 1MB
    Return value:      (tuple)
      (sa, rsa, lcp)
        sa:  Suffix array                  for i in range(1, size):
               assert text[sa[i-1]:] < text[sa[i]:]
        rsa: Reverse suffix array          for i in range(size):
               assert rsa[sa[i]] == i
        lcp: Longest common prefix         for i in range(1, size):
               assert text[sa[i-1]:sa[i-1]+lcp[i]] == text[sa[i]:sa[i]+lcp[i]]
               if sa[i-1] + lcp[i] < len(text):
                   assert text[sa[i-1] + lcp[i]] < text[sa[i] + lcp[i]]
    >>> suffix_array(text='banana')
    ([5, 3, 1, 0, 4, 2], [3, 2, 5, 1, 4, 0], [0, 1, 3, 0, 0, 2])
    Explanation: 'a' < 'ana' < 'anana' < 'banana' < 'na' < 'nana'
    The Longest Common String is 'ana': lcp[2] == 3 == len('ana')
    It is between  tx[sa[1]:] == 'ana' < 'anana' == tx[sa[2]:]
    """
    tx = text
    t0 = time.time()
    size = len(tx)
    step = min(max(_step, 1), len(tx))
    sa = list(range(len(tx)))
    # log.debug('%6.3f pre sort', time.time() - t0)
    sa.sort(key=lambda i: tx[i:i + step])
    # log.debug('%6.3f after sort', time.time() - t0)
    grpstart = size * [False] + [True]  # a boolean map for iteration speedup.
    # It helps to skip yet resolved values. The last value True is a sentinel.
    rsa = size * [None]
    stgrp, igrp = '', 0
    for i, pos in enumerate(sa):
        st = tx[pos:pos + step]
        if st != stgrp:
            grpstart[igrp] = (igrp < i - 1)
            stgrp = st
            igrp = i
        rsa[pos] = igrp
        sa[i] = pos
    grpstart[igrp] = (igrp < size - 1 or size == 0)
    # log.debug('%6.3f after group', time.time() - t0)
    while grpstart.index(True) < size:
        # assert step <= size
        nmerge = 0
        nextgr = grpstart.index(True)
        while nextgr < size:
            igrp = nextgr
            nextgr = grpstart.index(True, igrp + 1)
            glist = []
            for ig in range(igrp, nextgr):
                pos = sa[ig]
                if rsa[pos] != igrp:
                    break
                newgr = rsa[pos + step] if pos + step < size else -1
                glist.append((newgr, pos))
            glist.sort()
            for ig, g in groupby(glist, key=itemgetter(0)):
                g = [x[1] for x in g]
                sa[igrp:igrp + len(g)] = g
                grpstart[igrp] = (len(g) > 1)
                for pos in g:
                    rsa[pos] = igrp
                igrp += len(g)
            nmerge += len(glist)
        # log.debug('%6.3f for step=%d nmerge=%d', time.time() - t0, step, nmerge)
        step *= 2
    del grpstart
    # create LCP array
    lcp = size * [None]
    h = 0
    for i in range(size):
        if rsa[i] > 0:
            j = sa[rsa[i] - 1]
            while i != size - h and j != size - h and tx[i + h] == tx[j + h]:
                h += 1
            lcp[rsa[i]] = h
            if h > 0:
                h -= 1
    if size > 0:
        lcp[0] = 0
    # log.debug('%6.3f end', time.time() - t0)
    return sa, rsa, lcp


#-------------------------------------------------------------------------------
# COMPARISON
#-------------------------------------------------------------------------------

def get_digits(text):
    result = ''.join(c for c in text if c.isnumeric() or c=='|')
    return result


def compare_texts(full_text_a, full_text_b, min_len):
    combined_text = (full_text_a + '&&' + full_text_b)
    lcs_result = sorted(lcs.longest_common_substring(combined_text).items())
    my_lcs = []
    for s, posns in lcs_result:
        if len(s) < min_len:
            continue
        # Make sure occurrence is between different texts
        l = len(full_text_a)
        if not (min(posns) < l and max(posns) > l):
            continue
        my_lcs.append(s.strip('|'))
    return my_lcs


def compare_images(hashes_a, hashes_b):
    common_hashes = set(hashes_a).intersection(set(hashes_b))
    return list(common_hashes)


def get_page_texts(filename):
    texts = []
    with fitz.open(filename) as doc:
        for page in doc:
            page_text = page.get_text()
            texts.append((page.number+1, page_text))
    return texts


def get_page_image_hashes(filename):
    hashes = []
    with fitz.open(filename) as doc:
        for page in doc:
            page_images = page.get_image_info(hashes=True)
            page_hashes = [d['digest'].hex() for d in page_images]
            hashes.append((page.number+1, page_hashes))
    return hashes


def get_file_data(filenames):
    data = {}
    for full_filename in filenames:
        page_texts = get_page_texts(full_filename)
        page_digits = [(n, get_digits(t)) for n, t in page_texts]
        page_image_hashes = get_page_image_hashes(full_filename)
        full_text = '|'.join(t.strip() for n, t in page_texts)
        full_digits = '|'.join(t for n, t in page_digits)
        full_image_hashes = sum([h for n, h in page_image_hashes], [])
        path_to_file = '/'.join(full_filename.split('/')[:-1])
        filename = full_filename.split('/')[-1]

        file_data = {
            'path_to_file': path_to_file,
            'filename': filename,
            'page_texts': page_texts,
            'page_digits': page_digits,
            'page_image_hashes': page_image_hashes,
            'full_text': full_text,
            'full_digits': full_digits,
            'full_image_hashes': full_image_hashes,
        }
        data[filename] = file_data
    return data


def find_page_of_sus_substr(pages, sus_substr):
    if '|' in sus_substr:
        for page_a, page_b in zip(pages[:-1], pages[1:]):
            page_num_a, page_text_a = page_a
            page_num_b, page_text_b = page_b

            substr_a, substr_b = sus_substr.split('|')[:2]
            if substr_a in page_text_a and substr_b in page_text_b:
                return page_num_a            
    else:
        for page_num, page_text in pages:
            if sus_substr in page_text:
                return page_num
    return 'Page not found'


def find_page_of_sus_image(pages, sus_hash):
    for page_num, page_hashes in pages:
        if sus_hash in page_hashes:
            return page_num
    return 'Page not found'


def get_file_info(file_data, suspicious_pairs):
    filename_sus_pages = {filename: set() for filename in file_data.keys()}
    for pair in suspicious_pairs:
        pages = pair['pages']
        for page in pages:
            filename = page['filename']
            filename_sus_pages[filename].add(page['page'])

    file_info = []
    for filename, data in file_data.items():
        file_sus_pages = list(filename_sus_pages.get(filename, []))
        fi = {
            'filename': filename, 
            'n_pages': len(data['page_texts']),
            'n_suspicious_pages': len(file_sus_pages),
            'suspicious_pages': file_sus_pages,
        }
        file_info.append(fi)
    return file_info


def main(filenames, pretty_print, verbose=False):
    t0 = time.time()

    assert len(filenames) >= 2, 'Must have at least 2 files to compare!'

    suspicious_pairs = []

    file_data = get_file_data(filenames)

    for file_a, file_b in combinations(filenames, 2):
        a = file_data[file_a.split('/')[-1]]
        b = file_data[file_b.split('/')[-1]]

        # Compare numbers
        if verbose: print('Comparing numbers...')
        com_num_substrs = compare_texts(
            full_text_a=a['full_digits'], 
            full_text_b=b['full_digits'], 
            min_len=15
        )
        numbers_are_sus = len(com_num_substrs) > 0
        if numbers_are_sus:
            for sus_substr in com_num_substrs:
                sus_page_a = find_page_of_sus_substr(a['page_digits'], sus_substr)
                sus_page_b = find_page_of_sus_substr(b['page_digits'], sus_substr)
                str_preview = sus_substr[:97].replace('\n', ' ')+'...' if len(sus_substr) > 97 else sus_substr
                sus_result = {
                    'type': 'Common digit string',
                    'string_preview': str_preview,
                    'num_digits': len(sus_substr),
                    'pages': [
                        {'filename': a['filename'], 'page': sus_page_a},
                        {'filename': b['filename'], 'page': sus_page_b},
                    ]
                }
                suspicious_pairs.append(sus_result)

        # Compare texts
        if verbose: print('Comparing texts...')
        com_txt_substrs = compare_texts(
            a['full_text'], b['full_text'], min_len=300)
        text_is_sus = len(com_txt_substrs) > 0
        if text_is_sus:
            for sus_substr in com_txt_substrs:
                sus_page_a = find_page_of_sus_substr(a['page_texts'], sus_substr)
                sus_page_b = find_page_of_sus_substr(b['page_texts'], sus_substr)
                str_preview = sus_substr[:97].replace('\n', ' ')+'...' if len(sus_substr) > 97 else sus_substr
                sus_result = {
                    'type': 'Common text string',
                    'string_preview': str_preview,
                    'num_characters': len(sus_substr),
                    'pages': [
                        {'filename': a['filename'], 'page': sus_page_a},
                        {'filename': b['filename'], 'page': sus_page_b},
                    ]
                }
                suspicious_pairs.append(sus_result)

        # Compare images
        if verbose: print('Comparing images...')
        identical_images = compare_images(
            a['full_image_hashes'],
            b['full_image_hashes'],
        )
        images_are_sus = len(identical_images) > 0
        if images_are_sus:
            for img_hash in identical_images:
                sus_page_a = find_page_of_sus_image(a['page_image_hashes'], img_hash)
                sus_page_b = find_page_of_sus_image(b['page_image_hashes'], img_hash)
                sus_result = {
                    'type': 'Identical image',
                    'pages': [
                        {'filename': a['filename'], 'page': sus_page_a},
                        {'filename': b['filename'], 'page': sus_page_b},
                    ]
                }
                suspicious_pairs.append(sus_result)

    # Remove duplicate suspicious pairs (this might happen if a page has
    # multiple common substrings with another page)
    suspicious_pairs = list_of_unique_dicts(suspicious_pairs)

    file_info = get_file_info(file_data, suspicious_pairs)
    total_pages = sum(f['n_pages'] for f in file_info)
    
    dt = time.time() - t0

    result = {
        'files': file_info,
        'suspicious_pairs': suspicious_pairs,
        'elapsed_time_sec': dt,
        'pages_per_second': total_pages/dt,
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
        required=True,
        nargs='+',
    )
    parser.add_argument(
        '-p',
        '--pretty_print',
        help='Pretty print output',
        action='store_true'
    )
    parser.add_argument(
        '-v',
        '--verbose',
        help='Print things while running',
        action='store_true'
    )
    args = parser.parse_args()
    
    main(
        filenames=args.filenames, 
        pretty_print=args.pretty_print,
        verbose=args.verbose,
        )