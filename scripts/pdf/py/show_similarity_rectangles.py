import argparse
import fitz
import json
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image, ImageDraw, ImageFont
import os


def save_page_image(path_to_file, filename, page):
    full_filename = path_to_file + os.sep + filename
    doc = fitz.open(full_filename)

    pix = doc.get_page_pixmap(page-1)
    name = f'{filename}_{page}'
    pix.save(f'similarity_rectangle_result/{name}.png')


def main(filename):
    try:
        with open(filename, 'r') as f:
            result = json.load(f)
    except:
        with open(filename, 'r', encoding='utf-16') as f:
            result = json.loads(f.read())

    # First generate and store images of page w no rectangles
    if not os.path.exists('similarity_rectangle_result'):
        os.mkdir('similarity_rectangle_result')
    for file in result['files']:
        for sus_page in file['suspicious_pages']:
            save_page_image(file['path_to_file'], file['filename'], sus_page)

    # Add rectangles w labels to images
    sp_id = 0
    for sp in result['suspicious_pairs']:
        sp_id += 1
        print('-'*50)
        print(sp_id)
        print(sp)
        for page in sp['pages']:
            path_to = result['files'][page['file_index']]['path_to_file']
            filename = result['files'][page['file_index']]['filename']
            page_num = page['page']

            name = f'{filename}_{page_num}'

            # Open the image
            im = Image.open(f'similarity_rectangle_result/{name}.png')

            # Determine the boundaries of the bbox
            print(page['bbox'])
            w, h = im.size
            px0, py0, px1, py1 = page['bbox']
            x0, x1 = px0*w, px1*w
            y0, y1 = py0*h, py1*h

            # Draw the rectangle
            COLORS = {
                'Common text string': 'red',
                'Common digit sequence': 'blue',
                'Identical image': 'green',
            }
            color = COLORS.get(sp['type'], 'black')
            # create rectangle image
            shape = [x0, y0, x1, y1]
            rect = ImageDraw.Draw(im)  
            rect.rectangle(shape, fill=None, outline=color)

            # Add label
            label = ImageDraw.Draw(im)
            label.text((x1+4, y0), str(sp_id), color)

            im.save(f'similarity_rectangle_result/{name}.png')
            # # Get the current reference
            # ax = plt.gca()

            # # Display the image
            # plt.imshow(im)

            # # Create a Rectangle patch
            # rect = patches.Rectangle(top_left, w_rect, h_rect, 
            #     linewidth=1, edgecolor='r', facecolor='none')

            # # Add the patch to the Axes
            # ax.add_patch(rect)

            # # plt.show()
            # plt.savefig(f'similarity_rectangle_result/{name}.png', 
            #     bbox_inches='tight', pad_inches=0)



if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-f',
        '--filename', 
        help='PDF comparison result filename to create thumbnails of', 
        required=True,
    )
    args = parser.parse_args()

    main(filename=args.filename)