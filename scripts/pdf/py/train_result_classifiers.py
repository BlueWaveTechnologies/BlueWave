from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
import pandas as pd
import pickle
# import argparse


# def label_and_add_to_training(filename):
#     try:
#         with open(filename, 'r') as f:
#             result = json.load(f)
#     except:
#         with open(filename, 'r', encoding='utf-16') as f:
#             result = json.loads(f.read())


#     labels = []
#     i = 0
#     stopped = False
#     while not stopped:
#         sp = result['suspicious_pairs'][i]
#         print('-'*50)
#         print(i+1)
#         print(sp)
#         print('\n')
#         print('Is this sus pair [B]ad or [o]kay? (or e[x]clude it...)')
#         label = input()
#         if label in ['B', 'o', 'x']:
#             labels.append(label)
#             i += 1
#         else:
#             print('Improper input.')


def read_text_training_data():

    def fix_and_eval(s):
        s = ''.join(c for c in s if c.isascii())
        s = s.strip()
        s = s.replace("'", '')
        s = s.replace('"', '')
        s = "'" + s + "'"
        return eval(s)

    df = pd.read_csv('data/model_training_data.csv')
    df = pd.read_csv('data/model_training_data.txt', 
        sep='\t', encoding="ISO-8859-1")
    df['text'] = df['text_repr'].apply(fix_and_eval)

    return list(df['text']), list(df['is_significant'])


def get_vectors(texts_train):
    vectorizer = TfidfVectorizer(min_df=2)
    X = vectorizer.fit_transform(texts_train)
    with open('data/vectorizer.p', 'wb') as f:
        pickle.dump(vectorizer, f)
    print('Vectorizer saved.')
    return X


def create_and_train_classifier(X_train, y_train):
    clf = LogisticRegression(random_state=0)
    # clf = RandomForestClassifier(random_state=0)
    clf.fit(X_train, y_train)
    return clf


def create_performance_report(X, y):
    import time
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=0)

    clf = create_and_train_classifier(X_train, y_train)

    y_pred = clf.predict(X_test)
    target_names = ['not significant', 'significant']
    report = classification_report(y_test, y_pred, target_names=target_names)
    with open('classification_report.txt', 'a') as f:
        f.write(time.ctime()+'\n')
        f.write(report)


def main(filename):
    # if filename:
    #     label_and_add_to_training(filename)

    # Clear classification report
    if os.path.exists('classification_report.txt'):
        os.rm('classification_report.txt')

    # Text
    texts_train_t, labels_train_t = read_text_training_data()
    vectorizer_t = TfidfVectorizer(min_df=2)
    X_train_t = vectorizer_t.fit_transform(texts_train_t)
    clf_t = create_and_train_classifier(X_train_t, labels_train_t)
    create_performance_report(X_train_t, labels_train_t)

    # Digits
    texts_train_d, labels_train_d = read_digits_training_data()
    vectorizer_d = TfidfVectorizer(min_df=2, analyzer='char', ngram_range=(3,3))
    X_train_d = vectorizer_d.fit_transform(texts_train_d)
    clf_d = create_and_train_classifier(X_train_d, y_train_d)
    create_performance_report(X_train_d, labels_train_d)

    all_my_stuff = (vectorizer_t, clf_t, vectorizer_d, clf_d)
    with open('data/clf.p', 'wb') as f:
        pickle.dump(all_my_stuff, f)
    print('Model saved.')

if __name__ == '__main__':
    # parser = argparse.ArgumentParser()
    # parser.add_argument(
    #     '-f',
    #     '--filename',
    #     help='json of PDF script output for user to label'
    # )
    # args = parser.parse_args()
    # main(filename=args.filename)
    main(filename=None)