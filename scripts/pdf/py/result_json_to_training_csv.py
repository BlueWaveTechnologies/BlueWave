import argparse
import json
import pandas as pd


def main(filename):
    try:
        with open(filename, 'r') as f:
            result = json.load(f)
    except:
        with open(filename, 'r', encoding='utf-16') as f:
            result = json.loads(f.read())

    text_data = {'sp': [], 'text': [], 'is_bad': []}
    digits_data = {'sp': [], 'text': [], 'is_bad': []}

    for sp in result['suspicious_pairs']:
        if sp['type'] == 'Common text string':
            text_data['sp'].append(sp)
            text_data['text'].append(sp['string'])
            text_data['is_bad'].append(None)
        if sp['type'] == 'Common digit sequence':
            digits_data['sp'].append(sp)
            digits_data['text'].append(sp['string'])
            digits_data['is_bad'].append(None)

    if text_data:
        pd.DataFrame(text_data).to_csv('data/text_training_data.csv', index=False)
    if digits_data:
        pd.DataFrame(digits_data).to_csv('data/digits_training_data.csv', index=False)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-f',
        '--filename',
        help='json file to turn into editable csv (in excel) for manual labeling'
    )
    args = parser.parse_args()
    main(filename=args.filename)