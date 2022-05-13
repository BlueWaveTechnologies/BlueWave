"""
python3 py/compare_pdfs.py -f data/test_pdfs/00026_04_fda-K071597_test_data.pdf data/test_pdfs/small_test/copied_data.pdf
"""
import time
import datetime
import pickle

import get_file_data
import compare_pdfs_util
import importance_score

VERSION = "1.6.4"




#-------------------------------------------------------------------------------
# COMPARISON
#-------------------------------------------------------------------------------

import compare_pdfs_text
import pdf_duplicate_pages

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
        methods = ['pages', 'digits', 'images', 'text']
    if verbose: print('Using methods:', ', '.join(methods))

    suspicious_pairs = []

    if verbose: print('Reading files...')
    file_data = get_file_data.main(filenames, regen_cache, version=VERSION)

    for i in range(len(filenames)-1):
        for j in range(i+1, len(filenames)):
            # i always less than j
            a = file_data[i]
            b = file_data[j]

            # Find duplicate pages and remove those from the analysis
            if 'pages' in methods:
                if verbose: print('Finding duplicate pages...')
                duplicate_pages = pdf_duplicate_pages.find_duplicate_pages(
                    data_a=a,
                    data_b=b
                )
                dup_page_results = pdf_duplicate_pages.get_dup_page_results(duplicate_pages)
                suspicious_pairs.extend(dup_page_results)

                a_new = pdf_duplicate_pages.remove_duplicate_pages(a, duplicate_pages)
                b_new = pdf_duplicate_pages.remove_duplicate_pages(b, duplicate_pages)
            else:
                a_new = a
                b_new = b

            # Compare numbers
            if 'digits' in methods:
                if verbose: print('Comparing digits...')
                digit_results = compare_pdfs_text.main(
                    data_a=a_new,
                    data_b=b_new,
                    text_suffix='digits',
                    min_len=20,
                    comparison_type_name='Common digit sequence',
                )
                suspicious_pairs.extend(digit_results)

            # Compare texts
            if 'text' in methods:
                if verbose: print('Comparing texts...')
                text_results = compare_pdfs_text.main(
                    data_a=a_new,
                    data_b=b_new,
                    text_suffix='text',
                    min_len=300,
                    comparison_type_name='Common text string',
                )
                suspicious_pairs.extend(text_results)

            # Compare images
            if 'images' in methods:
                if verbose: print('Comparing images...')
                identical_images = compare_images(
                    a_new['image_hashes'],
                    b_new['image_hashes'],
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
    suspicious_pairs = compare_pdfs_util.list_of_unique_dicts(suspicious_pairs)

    # Filter out irrelevant sus pairs
    # if verbose: print('Removing irrelevant pairs...')
    # suspicious_pairs = filter_sus_pairs(suspicious_pairs)

    # Calculate some more things for the final output
    if verbose: print('Gathering output...')
    if verbose: print('\tAdd importance scores...')
    suspicious_pairs = importance_score.main(suspicious_pairs)
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

    import json
    import sys
    if pretty_print:
        print(json.dumps(result, indent=2), file=sys.stdout)
    else:
        print(json.dumps(result), file=sys.stdout)

    return result


if __name__ == '__main__':
    import argparse
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
