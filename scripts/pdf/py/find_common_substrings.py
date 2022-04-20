import numpy as np
from pydivsufsort import divsufsort, kasai
TEXT_SEP = '^_^'
PAGE_SEP = '@@@'


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
