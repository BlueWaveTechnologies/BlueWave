import numpy as np

#-------------------------------------------------------------------------------
# UTILS
#-------------------------------------------------------------------------------
class Box:
    def __init__(self, xmin, ymin, xmax, ymax):
        self.xmin = xmin
        self.ymin = ymin
        self.xmax = xmax
        self.ymax = ymax
        self.width = xmax - xmin
        self.height = ymax - ymin
        self.area = self.width * self.height

    def __repr__(self):
        return f'({self.xmin},{self.ymin},{self.xmax},{self.ymax})'

    def intersection(self, box2):
        xmin = max(self.xmin, box2.xmin)
        xmax = min(self.xmax, box2.xmax)
        ymin = max(self.ymin, box2.ymin)
        ymax = min(self.ymax, box2.ymax)
        width = xmax - xmin
        height = ymax - ymin
        if width > 0 and height > 0:
            return Box(xmin, ymin, xmax, ymax)

    def expand(self, box2):
        xmin = min(self.xmin, box2.xmin)
        xmax = max(self.xmax, box2.xmax)
        ymin = min(self.ymin, box2.ymin)
        ymax = max(self.ymax, box2.ymax)
        return Box(xmin, ymin, xmax, ymax)

    def box_distance(self, box2):
        new_area = self.expand(box2).area
        intersection = self.intersection(box2)
        if intersection:
            union_area = self.area + box2.area - intersection.area
        else:
            union_area = self.area + box2.area
        # new_area can be infinitely large, union_area is at most the sum
        #  of the two box areas
        d = (new_area / union_area) - 1
        return max(0, d) # no negative distances

    def as_tuple(self):
        return (self.xmin, self.ymin, self.xmax, self.ymax)


# class Block:
#     def __init__(self, text, digits, cum_len_text, cum_len_digits, bbox, page_num, block_num):
#         self.text = text
#         self.digits = digits
#         self.cum_len_text = cum_len_text
#         self.cum_len_digits = cum_len_digits
#         self.bbox = bbox
#         self.page_num = page_num
#         self.block_num = block_num

#     def merge(self, block2):
#         new_text = self.text + ''
#         new_digits = ''
#         cums_text = []
#         cums_digits = []
#         ps = []
#         block_nums = []
#         for block in blocks:
#             new_text = new_text + ' ' + block['text']
#             new_digits = new_digits + ' ' + block['text']
#             cums.append(block['cum_len'])
#             ps.append(block['page_num'])
#             block_nums.append(block['block_num'])
#         boxes = [b['bbox'] for b in blocks]
#         new_box = functools.reduce(lambda box_a, box_b: box_a.expand(box_b), boxes)
#         new_block = {
#             'text': new_text,
#             'digits': new_digits,
#             'cum_len': min(cums),
#             'cum_len': min(cums),
#             'bbox': new_box,
#             'page_num': min(ps),
#             'block_num': min(block_nums),
#         }



def get_datadir():
    import os 
    from pathlib import Path
    currdir = os.path.dirname(os.path.realpath(__file__)) 
    parentdir = str(Path(currdir).parent) 
    return parentdir + os.path.sep + 'data'


def list_of_unique_dicts(L):
    import json
    # https://stackoverflow.com/questions/11092511/python-list-of-unique-dictionaries
    return list({json.dumps(v, sort_keys=True): v for v in L}.values())


def get_digits(text):
    digits = ''
    n_letters = 0
    for c in text:
        if c.isnumeric():
            digits += c
            n_letters += 1
        elif c.isalpha():
            n_letters += 1
    try:
        if len(text) > 10 and len(digits) / n_letters < 0.1:
            return ''
    except ZeroDivisionError:
        pass

    return digits


def logit(p):
    return np.log(p / (1 - p))


def logistic(x):
    return 1 / (np.exp(-x) + 1)


# from sklearn.linear_model import LinearRegression
# # https://stackoverflow.com/questions/44234682/how-to-use-sklearn-when-target-variable-is-a-proportion
# class LogitRegression(LinearRegression):

#     def fit(self, x, p):
#         p = np.asarray(p)
#         y = np.log(p / (1 - p))
#         return super().fit(x, y)

#     def predict(self, x):
#         y = super().predict(x)
#         return 1 / (np.exp(-y) + 1)