"""
python3 py/compare_pdfs.py -f data/test_pdfs/00026_04_fda-K071597_test_data.pdf data/test_pdfs/small_test/copied_data.pdf
"""

import os
import re
import sys
import json
import math
import pickle
import time
import argparse
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

    text_combined = text1 + '||' + text2
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
    my_h = lcp[is_ok]

    # Remove candidates that are a substring of other candidates

    # Sort by length, descending
    sorted_idxs = np.argsort(-my_h)
    my_jmin = my_jmin[sorted_idxs]
    my_h = my_h[sorted_idxs]

    # Go through and take out overlapping substrings

    def is_subset_of_any_existing(new, existing):
        new_start, new_end = new
        for ex_start, ex_end in existing:
            if ex_start <= new_start and new_end <= ex_end:
                return True
        return False

    non_overlapping = []
    LIMIT = 100000
    for j1, h in zip(my_jmin[:LIMIT], my_h[:LIMIT]):
        start = j1
        end = j1 + h
        if not is_subset_of_any_existing(new=(start, end), existing=non_overlapping):
            non_overlapping.append((start, end))

    result = [text1[start:end] for start, end in non_overlapping]

    return result


#-------------------------------------------------------------------------------
# READING FILES
#-------------------------------------------------------------------------------
def get_page_texts(filename):
    texts = []
    if filename[-4:] != '.pdf':
        raise Exception('Fitz cannot read non-PDF file', filename)
    with fitz.open(filename) as doc:
        for page in doc:
            page_text = page.get_text()
            page_text_ascii = ''.join(c if c.isascii() else ' ' for c in page_text)
            texts.append((page.number+1, page_text_ascii))

    return texts


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


def get_file_data(filenames):
    data = []
    for i, full_filename in enumerate(filenames):

        # Check if cached exists next to PDF
        cached_filename = full_filename + '.jsoncached'
        if os.path.exists(cached_filename):
            with open(cached_filename, 'rb') as f:
                cached_data = json.load(f)
            pages_text = cached_data['pages_text']
            pages_image_hashes = cached_data['pages_image_hashes']
        else: # If not, read the PDF
            pages_text = get_page_texts(full_filename)
            pages_image_hashes = get_page_image_hashes(full_filename)

            # And cache the data
            cached_data = {
                'pages_text': pages_text,
                'pages_image_hashes': pages_image_hashes,
            }
            with open(cached_filename, 'w') as f:
                cached_data = json.dump(cached_data, f)

        pages_digits = [(n, get_digits(t)) for n, t in pages_text]
        full_text = '|'.join(t.strip() for n, t in pages_text)
        full_digits = '|'.join(t for n, t in pages_digits)
        full_image_hashes = sum([h for n, h in pages_image_hashes], [])
        path_to_file = (os.path.sep).join(full_filename.split(os.path.sep)[:-1])
        filename = full_filename.split(os.path.sep)[-1]

        file_data = {
            'path_to_file': path_to_file,
            'filename': filename,
            'file_index': i,
            'pages_text': pages_text,
            'pages_digits': pages_digits,
            'pages_image_hashes': pages_image_hashes,
            'full_text': full_text,
            'full_digits': full_digits,
            'full_image_hashes': full_image_hashes,
        }
        data.append(file_data)
    return data


#-------------------------------------------------------------------------------
# COMPARISON
#-------------------------------------------------------------------------------
def get_digits(text):
    result = ''.join(c for c in text if c.isnumeric() or c=='|')
    return result


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
    results = []
    common_substrings = find_common_substrings(
        text1=data_a[f'full_{text_suffix}'],
        text2=data_b[f'full_{text_suffix}'],
        min_len=min_len
    )

    common_substrings = [s.strip('|').split('|')[0] for s in common_substrings]
    if any(common_substrings):
        for sus_substr in common_substrings:
            sus_page_a = find_page_of_sus_substr(data_a[f'pages_{text_suffix}'], sus_substr)
            sus_page_b = find_page_of_sus_substr(data_b[f'pages_{text_suffix}'], sus_substr)
            str_preview = sus_substr[:97].replace('\n', ' ')+'...' if len(sus_substr) > 97 else sus_substr
            sus_result = {
                'type': comparison_type_name,
                'string': sus_substr,
                'string_preview': str_preview,
                'length': len(sus_substr),
                'pages': [
                    {'file_index': data_a['file_index'], 'page': sus_page_a},
                    {'file_index': data_b['file_index'], 'page': sus_page_b},
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
            'n_pages': len(data['pages_text']),
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
                        union = (len(file_data[a]['full_digits']) +
                            len(file_data[b]['full_digits'])) - intersect
                    elif method_long == 'Common text string':
                        intersect = sum(s['length'] for s in suspairs)
                        union = (len(file_data[a]['full_text']) +
                            len(file_data[b]['full_text']) - intersect)
                    elif method_long == 'Identical image':
                        intersect = len(suspairs)
                        union = (len(file_data[a]['full_image_hashes']) +
                            len(file_data[b]['full_image_hashes']) - intersect)
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
    return '1.0.0'


#-------------------------------------------------------------------------------
# MAIN
#-------------------------------------------------------------------------------
def main(filenames, methods, pretty_print, verbose=False):
    t0 = time.time()
    assert len(filenames) >= 2, 'Must have at least 2 files to compare!'

    if not methods:
        if verbose: print('Methods not specified, using default (all).')
        methods = ['digits', 'images', 'text']
    if verbose: print('Using methods:', ', '.join(methods))

    suspicious_pairs = []

    if verbose: print('Reading files...')
    file_data = get_file_data(filenames)

    for i in range(len(filenames)-1):
        for j in range(i+1, len(filenames)):
            # i always less than j
            a = file_data[i]
            b = file_data[j]

            # Compare numbers
            if 'digits' in methods:
                if verbose: print('Comparing digits...')
                digit_results = compare_texts(
                    data_a=file_data[i],
                    data_b=file_data[j],
                    text_suffix='digits',
                    min_len=40,
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
                    a['full_image_hashes'],
                    b['full_image_hashes'],
                )
                images_are_sus = len(identical_images) > 0
                if images_are_sus:
                    for img_hash in identical_images:
                        sus_page_a = find_page_of_sus_image(a['pages_image_hashes'], img_hash)
                        sus_page_b = find_page_of_sus_image(b['pages_image_hashes'], img_hash)
                        sus_result = {
                            'type': 'Identical image',
                            'image_hash': img_hash,
                            'pages': [
                                {'file_index': a['file_index'], 'page': sus_page_a},
                                {'file_index': b['file_index'], 'page': sus_page_b},
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

    result = {
        'files': file_info,
        'suspicious_pairs': suspicious_pairs,
        'num_suspicious_pairs': len(suspicious_pairs),
        'elapsed_time_sec': dt,
        'pages_per_second': total_page_pairs/dt,
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
        ver = get_version()
        print(ver)
    else:
        main(
            filenames=args.filenames,
            methods=args.methods,
            pretty_print=args.pretty_print,
            verbose=args.verbose,
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
