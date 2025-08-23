import requests
from sys import exit
from parse_metals import parse_metals_file


OUTPUT_FILE_NAME = "test.xls"
DOWNLOAD_LINK = "https://pmsmk.ru/f/nalichie_td_uralskaya_metallobaza.xls"

try:
    response = requests.get(DOWNLOAD_LINK)
except Exception as e:
    print(f"Request error: {e}")
    exit(1)

try:
    response.raise_for_status()
except requests.exceptions.HTTPError as e:
    print(f"File download error: {e}")
    exit(1)

try:
    with open(OUTPUT_FILE_NAME, "wb") as output_file:
        output_file.write(response.content)
except (IOError, OSError) as e:
    print(f"File writing error: {e}")
    exit(1)

parse_metals_file(OUTPUT_FILE_NAME)