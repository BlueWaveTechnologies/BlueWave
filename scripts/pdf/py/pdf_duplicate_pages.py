import compare_pdfs_util


def find_duplicate_pages(data_a, data_b):
    """
    block:                     
        block = {
                        'text': block_text,
                        'cum_len': cum_block_len,
                        'bbox': bbox,
                        'page_num': page.number+1,
                        'block_num': block_num,
                    }
    """
    import numpy as np
    from sklearn.metrics.pairwise import pairwise_distances
    from sklearn.feature_extraction.text import TfidfVectorizer

    def get_page_texts(data):
        d = {}
        for block in data['blocks']:
            l = d.get(block['page_num'], [])
            l.append(block['text'])
            d[block['page_num']] = l

        # Also include image hashes in page texts
        for hash_, bbox, p in data['image_hashes']:
            l = d.get(p, [])
            l.append(hash_)
            d[p] = l

        result = [(p, ' '.join(texts)) for p, texts in d.items()]
        return zip(*result)

    page_nums_a, texts_a = get_page_texts(data_a)
    page_nums_b, texts_b = get_page_texts(data_b)

    vectorizer = TfidfVectorizer(
        analyzer='char',
        ngram_range=(5,5)
        )
    corpus = texts_a + texts_b
    X = vectorizer.fit_transform(corpus)
    
    m = pairwise_distances(X, X, metric='cosine')
    
    np.fill_diagonal(m, 1)
    m[np.tril_indices(len(m))] = 1
    
    page_tups_a = [(page_num, data_a['file_index'], text) for page_num, text in zip(page_nums_a, texts_a)]
    page_tups_b = [(page_num, data_b['file_index'], text) for page_num, text in zip(page_nums_b, texts_b)]
    combined_pages = page_tups_a + page_tups_b
    idxs_1, idxs_2 = np.where(m < 0.01)

    pairs = [((combined_pages[i], combined_pages[j]), m[i][j]) for i, j in zip(idxs_1, idxs_2)]
    return pairs


def get_dup_page_results(duplicate_pages):
    cross_pairs = [p for p in duplicate_pages if p[0][0][1] != p[0][1][1]]

    results = []
    for pair in cross_pairs:
        tups, dist = pair
        page1, file_index1, text1 = tups[0]
        page2, file_index2, text2 = tups[1]
        sus_result = {
            'type': 'Duplicate page',
            'cosine_distance': dist,
            'page_text': text1,
            'pages': [
                {
                    'file_index': file_index1,
                    'page': page1,
                    'bbox': (0.01, 0.01, 0.99, 0.99),
                }, {
                    'file_index': file_index2, 
                    'page': page2,
                    'bbox': (0.01, 0.01, 0.99, 0.99),
                },
            ]
        }
        results.append(sus_result)

    return results
    

def remove_duplicate_pages(file_data, duplicate_pages):
    """
    Rewrite the data object as if the duplicate pages didnt exist.

    Image hash element: (hash_, bbox, page.number+1)

    block = {
        'text': block_text,
        'cum_len': cum_block_len,
        'bbox': bbox,
        'page_num': page.number+1,
        'block_num': block_num,
    }

    Inputs:
        duplicate_pages - list of tups [(((page, file_index), (page_file_index)), dist), ...]

    """
    pages_to_ignore = set()
    for pair, dist in duplicate_pages:
        betw_files = pair[0][1] != pair[1][1]
        if betw_files:
            for page, file_index, text in pair:
                if file_index == file_data['file_index']:
                    pages_to_ignore.add(page)
        else:
            if pair[0][1] == file_data['file_index']:
                # Add second occurrence of page
                pages_to_ignore.add(pair[1][0])

    # assert all(p < file_data['n_pages'] for p in pages_to_ignore)

    new_block_num = 0
    new_cum_len_text = 0
    new_cum_len_digits = 0
    new_blocks = []
    for old_block in file_data['blocks']:
        if old_block['page_num'] not in pages_to_ignore:
            # Recalculate cumulative length and block number
            new_block = {
                'text': old_block['text'],
                'digits': old_block['digits'],
                'cum_len_text': new_cum_len_text,
                'cum_len_digits': new_cum_len_digits,
                'bbox': old_block['bbox'],
                'page_num': old_block['page_num'],
                'block_num': new_block_num,
            }
            new_blocks.append(new_block)
            new_cum_len_text += len(new_block['text'])
            new_cum_len_digits += len(new_block['digits'])
            new_block_num += 1
            
    new_image_hashes = [i for i in file_data['image_hashes'] if i[2] not in pages_to_ignore]

    new_full_text = ''.join(b['text'] for b in new_blocks)
    new_full_digits = ''.join(b['digits'] for b in new_blocks)

    file_data_new = {
        'path_to_file': file_data['path_to_file'],
        'filename': file_data['filename'],
        'file_index': file_data['file_index'],
        'blocks': new_blocks,
        'full_text': new_full_text,
        'full_digits': new_full_digits,
        'image_hashes': new_image_hashes,
        'n_pages': file_data['n_pages'],
    }

    return file_data_new
