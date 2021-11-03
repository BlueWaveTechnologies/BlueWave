import sys
import json
import time
import difflib
import argparse
from itertools import combinations
import fitz  # this is pymupdf


def _run_statistical_test():
    # Some statistical testing
    import random
    import string
    import numpy as np
    L = 124
    n_iter = 10000
    # n_common_substrings_over_10 = []
    n_common_substrings_over_k = []
    for i in range(n_iter):
        numbers1 = ''.join(random.choice(string.digits) for _ in range(L))
        numbers2 = ''.join(random.choice(string.digits) for _ in range(L))

        # com_substrs = get_common_substrings(a, b, min_length=10)
        com_substrs = get_common_substrings(numbers1, numbers2, min_length=10)
        n_common_substrings_over_k.append(len(com_substrs))

    two_or_more = sum(n>2 for n in n_common_substrings_over_k)
    print(two_or_more / n_iter)


def list_of_unique_dicts(L):
    # https://stackoverflow.com/questions/11092511/python-list-of-unique-dictionaries
    return list({json.dumps(v, sort_keys=True): v for v in L}.values())


def get_filename_pdf_text(filename):

    doc = fitz.open(filename)
    text = {
        'filename': filename,
        'full_text': '',
        'pages': [],
    }
    for page in doc:
        page_text = page.get_text()
        text['full_text'] += page_text+'|'
        text['pages'].append((page.number+1, page_text)) 

    return text


def get_common_substrings(a, b, min_length):
    """
    https://skeptric.com/common-substring/
    """
    seqs = []
    seqmatcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for tag, a0, a1, b0, b1 in seqmatcher.get_opcodes():
        if tag == 'equal' and a1 - a0 >= min_length:
            seqs.append(a[a0:a1])
    return seqs


def get_numbers(text):
    result = ''.join(c for c in text if c.isnumeric() or c=='|')
    return result


def compare_texts(a: str, b: str):
    nums_a = get_numbers(a)
    nums_b = get_numbers(b)
    com_substrs = get_common_substrings(nums_a, nums_b, min_length=15)
    com_substrs = [s.strip('|') for s in com_substrs]
    return len(com_substrs) > 0, com_substrs


def find_page_of_sus_substr(pages, sus_substr):
    if '|' in sus_substr:
        for page_a, page_b in zip(pages[:-1], pages[1:]):
            page_num_a, page_text_a = page_a
            page_num_b, page_text_b = page_b

            page_a_text_numeric = get_numbers(page_text_a)
            page_b_text_numeric = get_numbers(page_text_b)

            substr_a, substr_b = sus_substr.split('|')[:2]
            if substr_a in page_a_text_numeric and substr_b in page_b_text_numeric:
                return page_num_a            
    else:
        for page_num, page_text in pages:
            page_text_numeric = get_numbers(page_text)
            if sus_substr in page_text_numeric:
                return page_num
    return 'Page not found'


def get_suspicious_pairs(text_dicts):
    suspicious_pairs = []

    for a, b in combinations(text_dicts, 2):
        
        is_suspicious, sus_substrs = compare_texts(a['full_text'], b['full_text'])
        
        if is_suspicious:
            for sus_substr in sus_substrs:
                sus_page_a = find_page_of_sus_substr(a['pages'], sus_substr)
                sus_page_b = find_page_of_sus_substr(b['pages'], sus_substr)
                sus_result = [
                    {'filename': a['filename'], 'page': sus_page_a},
                    {'filename': b['filename'], 'page': sus_page_b},
                ]
                suspicious_pairs.append(sus_result)

    # Remove duplicate suspicious pairs (this might happen if a page has
    # multiple common substrings with another page)
    suspicious_pairs = list_of_unique_dicts(suspicious_pairs)
    return suspicious_pairs


def gather_sus_pages(suspicious_pairs):
    
    def safe_add(d, k, v):
        try:
            d[k].add(v)
        except KeyError:
            d[k] = set([v])

    sus_pages = {}
    for a, b in suspicious_pairs:
        safe_add(d=sus_pages, k=a['filename'], v=a['page'])
        safe_add(d=sus_pages, k=b['filename'], v=b['page'])
    return sus_pages


def get_file_info(text_dicts, sus_pages):
    file_info = []
    for t in text_dicts:
        file_sus_pages = list(sus_pages.get(t['filename'], []))
        fi = {
            'filename': t['filename'], 
            'n_pages': len(t['pages']),
            'n_suspicious_pages': len(file_sus_pages),
            'suspicious_pages': file_sus_pages,
        }
        file_info.append(fi)
    return file_info


def main(filenames, pretty_print):
    t0 = time.time()

    assert len(filenames) >= 2, 'Must have at least 2 files to compare!'

    text_dicts = [get_filename_pdf_text(f) for f in filenames]

    suspicious_pairs = get_suspicious_pairs(text_dicts)
    sus_pages = gather_sus_pages(suspicious_pairs)
    file_info = get_file_info(text_dicts, sus_pages)
    total_pages = sum(f['n_pages'] for f in file_info)
    message = 'Did not find any long common digit sequences.'
    if suspicious_pairs:
        message = ('Found pairs of files that have long digit '
                'sequences in common. This is extremely unlikely to be random '
                'and indicates copied data or numbers.')

    dt = time.time() - t0

    result = {
        'files': file_info,
        'suspicious_pairs': suspicious_pairs,
        'elapsed_time_sec': dt,
        'pages_per_second': total_pages/dt,
        'message': message
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
    args = parser.parse_args()
    
    main(filenames=args.filenames, pretty_print=args.pretty_print)
