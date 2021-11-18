"""
Example usages: 

    python py/pdf_to_img.py -f data/test_pdfs/00026_04_fda-K071597_test_data.pdf -p 4 -o .

    python py/pdf_to_img.py -f data/test_pdfs/00026_04_fda-K071597_test_data.pdf -p 4-9 -o tmp

    python py/pdf_to_img.py -f data/test_pdfs/00026_04_fda-K071597_test_data.pdf -p 1,2,4-9 -o tmp

Pages can be specified 1,2,3 and/or 10-20. The out directory must exist 
beforehand (e.g. mkdir tmp)

Note that, for page input, pages start with 1 (not zero)
"""


import argparse
import fitz


def get_pagelist(pages: str):
    """ Pages is a string that could equal:
        "1,2,3"
        "3-4",
        "14-4" (invalid),
        "1,5-10,14"
    """
    segments = pages.split(',')
    pagelist = []
    for s in segments:
        try:
            pagelist.append(int(s))
        except ValueError:
            if '-' in s:
                lo, hi = [int(v) for v in s.split('-')]
                assert hi > lo, f'Invalid page range {lo}-{hi}'
                for p in range(lo, hi+1):
                    pagelist.append(p)
            else:
                raise 'pages input not valid'
    return sorted(pagelist)


def main(filename: str, pages: str, outpath: str):
    doc = fitz.open(filename)

    pagelist = get_pagelist(pages)

    for p in pagelist:
        pix = doc.get_page_pixmap(p-1)
        pix.save(f'{outpath}/{p}.png')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-f',
        '--filename', 
        help='PDF filename to create thumbnails of', 
        required=True,
    )
    parser.add_argument(
        '-p',
        '--pages',
        help='Pages to create thumbnails of (e.g. "1,2,3" or "3,5-10")',
        required=True,
    )
    parser.add_argument(
        '-o',
        '--outpath', 
        help='path where to save resulting images', 
        required=True,
    )
    args = parser.parse_args()

    main(filename=args.filename, pages=args.pages, outpath=args.outpath)