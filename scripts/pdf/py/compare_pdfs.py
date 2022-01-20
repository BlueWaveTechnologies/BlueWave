"""
python3 py/compare_pdfs.py -f data/test_pdfs/00026_04_fda-K071597_test_data.pdf data/test_pdfs/small_test/copied_data.pdf
"""

import re
import sys
import json
import math
import pickle
import time
import argparse

import itertools
from itertools import groupby
from itertools import combinations
from operator import itemgetter
from random import randint
# from scipy.stats import chisquare

# PyMuPDF
import fitz
fitz.TOOLS.mupdf_display_errors(False)
import warnings
warnings.filterwarnings("ignore")

from pydivsufsort import divsufsort, kasai


#-------------------------------------------------------------------------------
# UTILS
#-------------------------------------------------------------------------------
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

    text_combined = text1 + '||' + text2
    sa = divsufsort(text_combined)
    lcp = kasai(text_combined, sa)
    lcp = list(lcp)
    lcp = [lcp[-1]] + lcp[:-1]

    # Collect candidates
    candidates = []
    for i in range(1, len(sa)):
        is_long_enough = lcp[i] >= min_len;
        if is_long_enough:
            j1 = sa[i-1]
            j2 = sa[i]
            h = lcp[i]
            j_min = min(j1, j2)
            j_max = max(j1, j2)
            is_in_both = j_min < len(text1) and j_max > len(text1)
            does_not_cross = not (j_min < len(text1) and j_min+h > len(text1))
            if is_in_both and does_not_cross:
                substring = text_combined[j1:j1+h]
                candidates.append((substring, j1, j1+h))
    
    # Remove candidates that are a substring of other candidates

    # Sort by length, descending
    candidates = sorted(candidates, key=lambda tup: -len(tup[0]))
    non_overlapping = []
    def is_subset_of_any_existing(new, existing):
        # for existing_str in existing:
        #     if new in existing:
        #         return True
        new_str, new_start, new_end = new
        for ex_str, ex_start, ex_end in existing:
            if ex_start <= new_start and new_end <= ex_end:
                return True
        return False

    # Go through and take out overlapping substrings
    for new in candidates:
        if not is_subset_of_any_existing(new=new, existing=non_overlapping):
            non_overlapping.append(new)
    
    result = [i[0] for i in non_overlapping]
    
    return result

#-------------------------------------------------------------------------------
# COMPARISON
#-------------------------------------------------------------------------------

def get_digits(text):
    result = ''.join(c for c in text if c.isnumeric() or c=='|')
    return result


def compare_texts(full_text_a, full_text_b, min_len):
    com_substrs = find_common_substrings(full_text_a, full_text_b, min_len)

    com_substrs = [s.split('|')[0] for s in com_substrs]

    return com_substrs


def compare_images(hashes_a, hashes_b):
    common_hashes = set(hashes_a).intersection(set(hashes_b))
    return list(common_hashes)


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


def get_page_texts(filename):
    texts = []
    with fitz.open(filename) as doc:
        for page in doc:
            page_text = page.get_text()
            page_text_ascii = ''.join(c if c.isascii() else ' ' for c in page_text)
            texts.append((page.number+1, page_text_ascii))

    return texts


def get_page_image_hashes(filename):
    hashes = []
    filename = filename.replace('\\', '/')
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

    with open('data/vectorizer.p', 'rb') as f:
        vectorizer = pickle.load(f)
    with open('data/text_clf.p', 'rb') as f:
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
            bad_page_1 = (pair['pages'][0]['filename'], pair['pages'][0]['page'])
            bad_page_2 = (pair['pages'][1]['filename'], pair['pages'][1]['page'])
            bad_pages.add(bad_page_1)
            bad_pages.add(bad_page_2)

    significant_other_pairs = []
    for pair in all_other_pairs:
        page1 = (pair['pages'][0]['filename'], pair['pages'][0]['page'])
        page2 = (pair['pages'][1]['filename'], pair['pages'][1]['page'])
        if page1 in bad_pages or page2 in bad_pages:
            continue
        else:
            significant_other_pairs.append(pair)


    return significant_text_pairs + significant_other_pairs


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

    if verbose: print('Reading files...')
    file_data = get_file_data(filenames)

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

    # Between-file tests:
    #     - Duplicate digits
    #     - Duplicate text
    #     - Duplicate images (based on hash)
    for file_a, file_b in combinations(filenames, 2):
        a = file_data[file_a.split('/')[-1]]
        b = file_data[file_b.split('/')[-1]]

        # Compare numbers
        if verbose: print('Comparing numbers...')
        com_num_substrs = compare_texts(
            full_text_a=a['full_digits'], 
            full_text_b=b['full_digits'], 
            min_len=20
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
            a['full_text'], b['full_text'], min_len=280)
        if verbose: print('\tGathering text results...')
        text_is_sus = len(com_txt_substrs) > 0
        if text_is_sus:
            for sus_substr in com_txt_substrs:
                sus_page_a = find_page_of_sus_substr(a['page_texts'], sus_substr)
                sus_page_b = find_page_of_sus_substr(b['page_texts'], sus_substr)
                str_preview = sus_substr[:97].replace('\n', ' ')+'...' if len(sus_substr) > 97 else sus_substr
                sus_result = {
                    'type': 'Common text string',
                    'string_preview': str_preview,
                    'string': sus_substr[:2000],
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

    # Filter out irrelevant sus pairs
    suspicious_pairs = filter_sus_pairs(suspicious_pairs)

    file_info = get_file_info(file_data, suspicious_pairs)
    total_page_pairs = math.prod(f['n_pages'] for f in file_info)
    
    dt = time.time() - t0

    result = {
        'files': file_info,
        'suspicious_pairs': suspicious_pairs,
        'num_suspicious_pairs': len(suspicious_pairs),
        'elapsed_time_sec': dt,
        'pages_per_second': total_page_pairs/dt,
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