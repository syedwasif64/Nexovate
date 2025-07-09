#!/usr/bin/env python3
import sys
import json
from pathlib import Path
from project_advisor import generate_recommendation, build_pdf

def main():
    input_path = sys.argv[1]
    with open(input_path, 'r') as f:
        data = json.load(f)

    answers = data['answers']
    notes = data.get('extraNotes', '')
    recommendation = generate_recommendation(answers, notes)

    # Get image links from JSON, fallback to hardcoded
    image_links = data.get('imageLinks', [
        "https://i.postimg.cc/FHHzNfrZ/Desktop1.webp",
        "https://i.postimg.cc/dtTZgZ0T/Mob1.webp",
        "https://i.postimg.cc/vZ01Vrqk/Mob3.webp",
        "https://i.postimg.cc/j262dPn8/Mob2.webp",
        "https://i.postimg.cc/VvFscw2p/desktop3.webp",
        "https://i.postimg.cc/44vxcvnP/Desktop2.webp",
    ])

    output_file = Path(f"FYP_Recommendation_{data['userId']}.pdf")
    build_pdf(recommendation, image_links, str(output_file))

    print(str(output_file.resolve()))

if __name__ == "__main__":
    main()
