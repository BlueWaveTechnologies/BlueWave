import functools


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


def get_lined_up_blocks(blocks1, blocks2, text_suffix, sus_str, j1, j2, h):
    """
    Inputs:
        blocks1 - list of dicts
        blocks2 - list of dicts
        text_suffix - "text" or "digits"
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
            too_early = block[f'cum_len_{text_suffix}'] + len(block[text_suffix]) < j
            too_late = block[f'cum_len_{text_suffix}'] > j + h + 1
            if too_early or too_late:
                block_i += 1
            else:
                pages += [block['page_num']]*len(block[text_suffix])
                block_idxs += [block_i]*len(block[text_suffix])
                block_i += 1
        # trim
        first_block = blocks[block_idxs[0]]
        last_block = blocks[block_idxs[-1]]
        pad_start = j - first_block[f'cum_len_{text_suffix}'] # How many chars until we see the sus string
        pad_end = (last_block[f'cum_len_{text_suffix}'] + len(last_block[text_suffix])) - (j+h) # Extra chars at the end

        if pad_end == 0: # because [-0] index works weirdly
            pages = pages[pad_start:]
            block_idxs = block_idxs[pad_start:]
        else:
            pages = pages[pad_start:-pad_end]
            block_idxs = block_idxs[pad_start:-pad_end]
        return pages, block_idxs

    pages1, block_idxs_1 = get_page_str_block_str(blocks1, j1, h)
    pages2, block_idxs_2 = get_page_str_block_str(blocks2, j2, h)
    assert len(blocks1) > 0
    assert len(block_idxs_1) == len(block_idxs_2) # Should be same bc the common substring is same
    assert len(blocks1) >= max(block_idxs_1)
    assert len(pages1) == len(sus_str)

    result = []
    sus_str_bit = sus_str[0] # First char
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
            result.append((list(queue1), list(queue2), sus_str_bit))
            sus_str_bit = ''
            queue1 = set([block_idxs_1[i]])
            queue2 = set([block_idxs_2[i]])
        else:
            sus_str_bit += sus_str[i]
            queue1.add(block_idxs_1[i])
            queue2.add(block_idxs_2[i])

    result2 = []
    for idxs1, idxs2, sus_str_bit in result:
        lblocks1 = [blocks1[i] for i in idxs1]
        lblocks2 = [blocks2[i] for i in idxs2]
        result2.append((lblocks1, lblocks2, sus_str_bit))

    return result2


def find_page_of_sus_image(pages, sus_hash):
    for page_num, page_hashes in pages:
        if sus_hash in page_hashes:
            return page_num
    return 'Page not found'


def filter_sus_pairs(suspicious_pairs):
    # TODO
    return significant_text_pairs + significant_other_pairs


def merge_blocks(blocks):
    new_text = ' '.join(b['text'] for b in blocks if b['text'])
    new_digits = ' '.join(b['digits'] for b in blocks if b['digits'])
    new_cum_len_text = min(b['cum_len_text'] for b in blocks)
    new_cum_len_digits = min(b['cum_len_digits'] for b in blocks)
    new_page_num = min(b['page_num'] for b in blocks)
    new_block_num = min(b['block_num'] for b in blocks if b['page_num']==new_page_num)
    boxes = [b['bbox'] for b in blocks]
    new_box = functools.reduce(lambda box_a, box_b: box_a.expand(box_b), boxes)
    new_block = {
        'text': new_text,
        'digits': new_digits,
        'cum_len_text': new_cum_len_text,
        'cum_len_digits': new_cum_len_digits,
        'bbox': new_box,
        'page_num': new_page_num,
        'block_num': new_block_num,
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
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics.pairwise import pairwise_distances

    if len(block_pairs) <= 1:
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
        block1, block2, sus_str = block_pair
        try:
            clust_block1, clust_block2, clust_sus_str = clusters[label]
            new_block1 = merge_blocks([block1, clust_block1])
            new_block2 = merge_blocks([block2, clust_block2])
            new_sus_str = sus_str + clust_sus_str
            clusters[label] = (new_block1, new_block2, new_sus_str)
        except KeyError:
            clusters[label] = block_pair

    clustered_block_pairs = [bp for l, bp in clusters.items()]
    return clustered_block_pairs


def main(data_a, data_b, text_suffix, min_len, comparison_type_name):
    """
    Inputs:
        data_a - data for first PDF
        data_b - data for second PDF
        text_suffix - suffix to determine which data field to use (text or digits)
        min_len - minimum acceptable length of duplicate text
        comparison_type_name - what to put in the output for "type"
    """
    import find_common_substrings

    results = []
    common_substrings = find_common_substrings.find_common_substrings(
        text1=data_a[f'full_{text_suffix}'],
        text2=data_b[f'full_{text_suffix}'],
        min_len=min_len
    )

    if any(common_substrings):
        all_lined_up_blocks = []

        for sus_str, j1, j2, h in common_substrings:

            lined_up_blocks = get_lined_up_blocks(
                data_a[f'blocks'],
                data_b[f'blocks'],
                text_suffix,
                sus_str, j1, j2, h
            )
            all_lined_up_blocks.extend(lined_up_blocks)

        # Merge all the lined up blocks
        merged_blocks = []
        for line_a, line_b, sus_str in all_lined_up_blocks:
            merged_blocks.append(
                (merge_blocks(line_a), merge_blocks(line_b), sus_str)
            )

        # Intelligently combine the merged blocks
        intelligently_combined_block_pairs = agglomerative_cluster_blocks(merged_blocks)

        # Filter out merged blocks
        #TODO

        for block0, block1, sus_substr in intelligently_combined_block_pairs:
            # sus_substr = block0['text'] # Temporary
            if len(sus_substr) <= int(min_len*0.75):
                continue

            str_preview = sus_substr
            if len(str_preview) > 97:
                str_preview = str_preview[:97].replace('\n', ' ')+'...'

            sus_result = {
                'type': comparison_type_name,
                'block_text': block0['text'],
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

    return results