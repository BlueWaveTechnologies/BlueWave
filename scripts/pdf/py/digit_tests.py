
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
        if n_digits / n_letters < 0.1:
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
