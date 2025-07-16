#!/usr/bin/env python3
import sys
import json
import argparse
from pathlib import Path
from project_advisor import generate_recommendation, build_pdf, refine_recommendation

def main():
    parser = argparse.ArgumentParser(description='Generate FYP recommendation')
    parser.add_argument('input_path', help='Path to input JSON file')
    parser.add_argument('--draft-only', action='store_true',
                        help='Return only the generated text without creating PDF')
    parser.add_argument('--refine', help='Existing recommendation text to refine')
    parser.add_argument('--modifications', help='User requested changes')
    args = parser.parse_args()

    with open(args.input_path, 'r') as f:
        data = json.load(f)

    # Handle all cases:
    # 1. Refinement request
    # 2. Pre-generated recommendation
    # 3. Fresh generation from answers
    if args.refine and args.modifications:
        recommendation = refine_recommendation(args.refine, args.modifications)
    elif 'recommendation' in data:
        recommendation = data['recommendation']
    else:
        answers = data['answers']
        notes = data.get('extraNotes', '')
        recommendation = generate_recommendation(answers, notes)

    if args.draft_only:
        print(recommendation)
        return

    image_links = data.get('imageLinks', [
        "https://i.postimg.cc/FHHzNfrZ/Desktop1.webp",
        "https://i.postimg.cc/dtTZgZ0T/Mob1.webp",
        "https://i.postimg.cc/vZ01Vrqk/Mob3.webp",
        "https://i.postimg.cc/j262dPn8/Mob2.webp",
        "https://i.postimg.cc/VvFscw2p/desktop3.webp",
        "https://i.postimg.cc/44vxcvnP/Desktop2.webp",
    ])

    # Get projectTitle from input JSON, default if not present
    project_title = data.get('projectTitle', "Project Recommendation") # <-- Extract projectTitle

    output_file = Path(f"FYP_Recommendation_{data.get('userId', 'final')}.pdf")
    # Pass project_title to build_pdf
    build_pdf(recommendation, image_links, str(output_file), project_title=project_title) # <-- Pass project_title
    print(str(output_file.resolve()))

if __name__ == "__main__":
    main()