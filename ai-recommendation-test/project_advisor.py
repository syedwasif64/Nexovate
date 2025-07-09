#!/usr/bin/env python3
"""
fyp_advisor.py – Stand‑alone script (hard‑coded demo values)

• Asks the same questionnaire via the console.
• Calls Gemini 1.5 Flash to generate a recommendation.
• Lets you optionally add an extra requirement.
• Generates a PDF that includes the recommendation text plus six mock‑up
  screenshots (hard‑coded PostImage links).

Dependencies  (Python 3.8+)
------------------------------------------------
pip install google-generativeai pillow requests fpdf2
"""

import os
import re
import tempfile
from io import BytesIO
from pathlib import Path

import google.generativeai as genai
import requests
from fpdf import FPDF
from PIL import Image

from dotenv import load_dotenv  # <-- Add this

load_dotenv()  
# ---------------------------------------------------------------------------
# 1)  Gemini API setup  –––––––––––––––––––––––––––––––––––––––––––––––––––––--
# ---------------------------------------------------------------------------
# Either export an environment variable *or* paste the key directly:
#
#   export GEMINI_API_KEY="your_api_key"
#
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# if GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
#     print("⚠️  Edit the script and set GEMINI_API_KEY before running.")
#     exit(1)
# import google.generativeai as genai

# Set your API key (ensure it's a string and valid)
# genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
GEMINI_MODEL = genai.GenerativeModel("gemini-1.5-flash-latest")

# ---------------------------------------------------------------------------
# 2)  Questionnaire (hard‑coded same as notebook)
# ---------------------------------------------------------------------------
QUESTIONS = {
    "App Type (Web, Mobile, Hybrid)": None,
    "Core Features (Authentication, Payments, API integrations, Chat, etc.)": None,
    "Tech Preferences (React, Node.js, Flutter, etc.)": None,
    "Database (SQL, NoSQL)": None,
    "Budget ($10K, $15K, $18K, $20K, $25K)": None,
    "Timeline (3 months, 4 months, 5 months, 6 months)": None,
    "Industry (E-commerce, Social Media, FinTech, etc.)": None,
    "Project Complexity (Medium, High)": None,
    "User Base (Small, Medium, Large)": None,
    "Maintenance Plan (Basic, Full, Premium Support)": None,
    "Project Category (Infrastructure, Security, AI, Website Development)": None,
}

def collect_user_answers() -> tuple[dict[str, str], str]:
    answers = {}
    for q in QUESTIONS:
        print(f"\n{q}")
        answers[q] = input("Your Answer: ")

    extra = input(
        "\n🗒️  Anything else you'd like us to know about your project idea? "
        "(Optional)\nYour Note: "
    )
    return answers, extra.strip()

# ---------------------------------------------------------------------------
# 3)  Gemini recommendation
# ---------------------------------------------------------------------------
def generate_recommendation(answers: dict[str, str], notes: str) -> str:
    summary = "\n".join(f"{k}: {v}" for k, v in answers.items())
    if notes:
        summary += f"\nExtra Notes: {notes}"

    prompt = f"""
You are an intelligent Final Year Project Advisor for Computer Science students located in Pakistan.
Considering the local context and resources, based on the user's inputs below, do the following:

- Recommend the most suitable project type, stack, and scope.
- If user choices seem suboptimal, suggest better ones and explain why.
- Include reasoning and suggestions based on modern tech trends, project success, and the practical realities of developing in Pakistan.
- Personalize suggestions if the user included any notes at the end.

User inputs:
{summary}

Your recommendation:
"""
    resp = GEMINI_MODEL.generate_content(prompt)
    return resp.text

# ---------------------------------------------------------------------------
# 4)  PDF helpers
# ---------------------------------------------------------------------------
def clean_text(txt: str) -> str:
    replacements = {
        "“": '"', "”": '"', "‘": "'", "’": "'",
        "–": "-", "—": "-", "•": "-", "…": "...", "\u2011": "-",
    }
    for src, tgt in replacements.items():
        txt = txt.replace(src, tgt)
    return re.sub(r"[^\x00-\x7F]+", "", txt)

class PDF(FPDF):
    def header(self):
        self.set_font("Arial", "B", 16)
        self.cell(0, 10, "FYP Project Advisor - Recommendations",
                  ln=True, align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 10)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

def add_centered_image(pdf: FPDF, url: str, *, margin_mm=15,
                       top_y=None, add_new_page=True, quality=90):
    import requests, tempfile, os
    from io import BytesIO
    from PIL import Image

    # ---- download & convert ----
    res = requests.get(url, timeout=30)
    res.raise_for_status()
    pil = Image.open(BytesIO(res.content)).convert("RGB")

    # Save to temp file and close it immediately to release handle
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp_path = tmp.name
        pil.save(tmp_path, "JPEG", quality=quality)

    if add_new_page:
        pdf.add_page()
        top_y = margin_mm
    if top_y is None:
        top_y = pdf.get_y()

    # Fit image to remaining rectangle
    avail_w = pdf.w - 2 * margin_mm
    avail_h = pdf.h - top_y - margin_mm
    dpi = pil.info.get("dpi", (72, 72))[0] or 72
    img_w_mm = pil.width  * 25.4 / dpi
    img_h_mm = pil.height * 25.4 / dpi
    scale = min(avail_w / img_w_mm, avail_h / img_h_mm)
    disp_w, disp_h = img_w_mm * scale, img_h_mm * scale
    x = (pdf.w - disp_w) / 2
    y = top_y + (avail_h - disp_h) / 2

    # Embed image from file
    pdf.image(tmp_path, x=x, y=y, w=disp_w, h=disp_h)

    # 🔒 Now safe to delete the temp file
    try:
        os.unlink(tmp_path)
    except PermissionError:
        print(f"⚠️ Could not delete temp file: {tmp_path}")


def build_pdf(recommendation: str, image_links: list[str], output: str) -> Path:
    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # write recommendation text
    bullet = 1
    for line in clean_text(recommendation).split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.lower().startswith("final year project recommendation:"):
            pdf.set_font("Arial", "B", 15); pdf.ln(5)
            pdf.multi_cell(0, 10, re.sub(r"[#*]+", "", stripped).strip()); pdf.ln(2)
        elif re.match(r"^[A-Z][\w\s\-()]+:$", stripped):
            pdf.set_font("Arial", "B", 14); pdf.ln(4)
            pdf.cell(0, 10, re.sub(r"[#*]+", "", stripped).strip(), ln=True)
            bullet = 1
        elif re.match(r"^\*\*.+\*\*$", stripped):
            pdf.set_font("Arial", "B", 13); pdf.ln(3)
            pdf.cell(0, 9, re.sub(r"[*]+", "", stripped).strip(), ln=True)
        elif stripped.startswith("*"):
            pdf.set_font("Arial", "", 12)
            pdf.multi_cell(0, 7, f"{bullet}. {re.sub(r'[*]+', '', stripped).strip()}"); pdf.ln(1)
            bullet += 1
        elif re.match(r"^#+\s*.+\s*#+$", stripped):
            pdf.set_font("Arial", "B", 13); pdf.ln(4)
            pdf.cell(0, 10, re.sub(r"[#+]", "", stripped).strip(), ln=True)
        else:
            pdf.set_font("Arial", "", 11)
            pdf.multi_cell(0, 7, stripped); pdf.ln(1)

    # UI mock‑ups
    if image_links:
        pdf.add_page()
        pdf.set_font("Arial", "B", 14)
        pdf.cell(0, 12, "UI Screens / Mockups", ln=True, align="C")
        pdf.ln(4)
        first, *rest = image_links
        add_centered_image(pdf, first, add_new_page=False)
        for link in rest:
            add_centered_image(pdf, link)

    pdf.output(output)
    return Path(output)

# ---------------------------------------------------------------------------
# 5)  Main program flow
# ---------------------------------------------------------------------------
def main() -> None:
    answers, extra_notes = collect_user_answers()
    recommendation = generate_recommendation(answers, extra_notes)
    print("\n🎯 Recommendation:\n")
    print(recommendation)

    # Optional loop to add new requirement
    while True:
        choice = input("\nDo you want to add any missing requirement?\n1. Yes\n2. No\nChoice: ")
        if choice == "1":
            req = input("Enter the additional requirement: ")
            recommendation = generate_recommendation(answers, extra_notes + " " + req)
            print("\nAltered Recommendation:\n")
            print(recommendation)
        elif choice == "2":
            break
        else:
            print("Invalid choice. Please type 1 or 2.")

    # Hard‑coded screenshot links
    image_links = [
        "https://i.postimg.cc/FHHzNfrZ/Desktop1.webp",
        "https://i.postimg.cc/dtTZgZ0T/Mob1.webp",
        "https://i.postimg.cc/vZ01Vrqk/Mob3.webp",
        "https://i.postimg.cc/j262dPn8/Mob2.webp",
        "https://i.postimg.cc/VvFscw2p/desktop3.webp",
        "https://i.postimg.cc/44vxcvnP/Desktop2.webp",
    ]

    pdf_path = build_pdf(recommendation, image_links, "FYP_Recommendation_with_UI.pdf")
    print("\n✅ PDF saved to", pdf_path.resolve())

if __name__ == "__main__":
    main()
