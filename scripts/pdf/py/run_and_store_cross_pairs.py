"""
The purpose of this script is to take a bunch of filenames
and run the document comparison for all the pairs, storing
the outputs in one big file. This big file will then be 
manually labeled for use as training data for the importance
classifier.
"""
import os
import compare_pdfs
import pandas as pd

def main():
	FILENAMES = [
		"C:/upload/K211048/K211048.pdf",
		"C:/upload/K211071/K211071.pdf",
		"C:/upload/K211587/K211587.pdf",
		"C:/upload/K211674/K211674.pdf",
		"C:/upload/K211743/K211743.pdf",
		"C:/upload/K211796/K211796.pdf",
		# "C:/upload/K211089/K211089.pdf", Missing
		"C:/upload/K212816/K212816.pdf",
		"C:/upload/K213284/K213284.pdf",
		"C:/upload/K213502/K213502.pdf",
	]

	all_result_pairs = []
	print(FILENAMES)
	for i in range(len(FILENAMES)):
		for j in range(i, len(FILENAMES)):
			if i == j:
				continue
			fname_a = FILENAMES[i]
			fname_b = FILENAMES[j]

			result = compare_pdfs.main(
				filenames=[fname_a, fname_b],
				verbose=True,
				methods=None,
				pretty_print=False,
			)
			pairs = result['suspicious_pairs']
			all_result_pairs.extend(pairs)


	df = pd.DataFrame(all_result_pairs)

	df['text'] = df['block_text']
	df.loc[df['page_text'].notnull(), 'text'] = df['page_text']

	df = df[['pages', 'type', 'length', 'text']]

	df.to_csv('pair_output_1.csv', index=False)

if __name__ == '__main__':
	main()