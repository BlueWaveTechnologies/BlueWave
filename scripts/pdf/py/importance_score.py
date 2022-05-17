import compare_pdfs_util


def main(suspicious_pairs):
    import pickle
    import numpy as np
    import re
    import os
    import scipy.sparse

    datadir = compare_pdfs_util.get_datadir()
    try:
        with open(f'{datadir}{os.path.sep}clf.p', 'rb') as f:
            vectorizer, clf = pickle.load(f)
    except:
        raise Exception(f'{datadir}{os.path.sep}clf.p not found or invalid.')


    corpus = []
    dummies = [] # Alpha order: (Common digit sequence, Common text string, Duplicate page, Identical image)
    for sus_pair in suspicious_pairs:
        if sus_pair['type'] == ['Duplicate page']:
            corpus.append(sus_pair['page_text'])
            dummies.append((0, 0, 1, 0))
        elif sus_pair['type'] == 'Common text string':
            corpus.append(sus_pair['block_text'])
            dummies.append((0, 1, 0, 0))
        elif sus_pair['type'] == 'Common digit sequence':
            corpus.append(sus_pair['block_text'])
            dummies.append((1, 0, 0, 0))
        elif sus_pair['type'] == ['Identical image']:
            corpus.append('')
            dummies.append((0, 0, 0, 1))
        else:
            corpus.append('')
            dummies.append((0, 0, 0, 0))

    if suspicious_pairs:
        vecs = vectorizer.transform(corpus).toarray()
        dummies = np.array(dummies)
        X = np.hstack((vecs, dummies))

        importance_pred = clf.predict(X).flatten()
        importance_pred = compare_pdfs_util.logistic(importance_pred)
    else:
        importance_pred = []

    decimal_re = re.compile(r'\d\.\d')
    degit_newline_re = re.compile(r'(?:[1-9]\n)|(?:\n[1-9])')
    for sus, ml_importance in zip(suspicious_pairs, importance_pred):
        # ML importance is 50% of the score
        ml_importance_100 = 100*ml_importance

        # Calculated importance is the other 50%
        calc_importance = 0
        txt = sus.get('block_text', sus.get('page_text', ''))
        
        deci_count = len(decimal_re.findall(txt)) / 2
        calc_importance += deci_count

        newline_num = len(degit_newline_re.findall(txt))
        calc_importance += newline_num

        calc_importance = min(100, calc_importance) # Cannot exceed 100

        # take avg
        importance = 0.5*(ml_importance_100 + calc_importance)

        # Special rule for tables with lots of zeros
        n_zeros = txt.count('0')
        if n_zeros / (n_zeros + deci_count + 1) > 0.90:
            importance = importance - 45

        # to int
        importance = int(round(importance))
        # clip
        importance = min(max(importance, 0), 100)

        sus['importance'] = importance


    sorted_sus_pairs = sorted(suspicious_pairs, key=lambda sus: -sus['importance'])

    return sorted_sus_pairs
