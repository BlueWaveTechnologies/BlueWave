from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
import pandas as pd
import pickle
import numpy as np
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

    df = pd.read_csv('data/pair_output_1.csv')
    df = df.drop_duplicates(['text'])
    df['text'] = df['text'].fillna('')

    return df


# def get_vectors(texts_train):
#     vectorizer = TfidfVectorizer(min_df=3)
#     X = vectorizer.fit_transform(texts_train)
#     with open('data/vectorizer.p', 'wb') as f:
#         pickle.dump(vectorizer, f)
#     print('Vectorizer saved.')
#     return X


def create_and_train_classifier(X_train, y_train):
    import compare_pdfs_util
    from sklearn import linear_model
    # clf = LogisticRegression(random_state=0)
    # clf = RandomForestClassifier(random_state=0)
    y_train_clipped = np.clip(y_train, 0.0001, 0.9999)
    y_train_transf = compare_pdfs_util.logit(y_train_clipped)
    clf = linear_model.LinearRegression()
    clf.fit(X_train, y_train_transf)
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
    # if os.path.exists('classification_report.txt'):
        # os.rm('classification_report.txt')

    # Read data
    df = read_text_training_data()

    # X
    vectorizer = TfidfVectorizer(min_df=3)
    vecs = vectorizer.fit_transform(df['text']).toarray()
    dummies = pd.get_dummies(df['type']).values
    X_train = np.hstack((vecs, dummies))

    # y
    y_train = df['importance'].astype(float).fillna(0)

    clf = create_and_train_classifier(X_train, y_train)
    # create_performance_report(X_train, labels_train)

    all_my_stuff = (vectorizer, clf)
    with open('data/clf.p', 'wb') as f:
        pickle.dump(all_my_stuff, f, protocol=4)
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