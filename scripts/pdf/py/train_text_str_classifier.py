from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
import pandas as pd
import pickle


def read_training_data():

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
	with open('classification_report.txt', 'w') as f:
		f.write(time.ctime()+'\n')
		f.write(report)


def train_and_save_model(X_train, y_train):
	clf = create_and_train_classifier(X_train, y_train)
	with open('data/text_clf.p', 'wb') as f:
		pickle.dump(clf, f)
	print('Model saved.')


def main():
	texts_train, labels_train = read_training_data()
	X_train = get_vectors(texts_train)
	create_performance_report(X_train, labels_train)
	train_and_save_model(X_train, labels_train)


if __name__ == '__main__':
	main()