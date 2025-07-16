#!/usr/bin/env python3
"""
fyp_advisor.py – Stand‑alone script (hard‑coded demo values)

• Asks the same questionnaire via the console.
• Calls Gemini 1.5 Flash to generate a recommendation.
• Lets you optionally add an extra requirement.
• Generates a PDF that includes the recommendation text plus six mock‑up
  screenshots (hard‑coded PostImage links).

Dependencies  (Python 3.8+)
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

from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
GEMINI_MODEL = genai.GenerativeModel("gemini-1.5-flash-latest")

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
}

def refine_recommendation(existing_recommendation: str, modifications: str) -> str:
    prompt = f"""
You are an intelligent Final Year Project Advisor. Below is your previous recommendation
and the user's requested changes. Please update the recommendation accordingly.

Previous Recommendation:
{existing_recommendation}

Requested Changes:
{modifications}

Updated Recommendation:
"""
    resp = GEMINI_MODEL.generate_content(prompt)
    return resp.text

def collect_user_answers() -> tuple[dict[str, str], str]:
    answers = {}
    for q in QUESTIONS:
        print(f"\n{q}")
        answers[q] = input("Your Answer: ")

    extra = input(
        "\n🗒️  Anything else you'd like us to know about your project idea? "
        "(Optional)\nYour Note: "
    )
    return answers, extra.strip()

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

# --- MODIFIED PDF HELPERS ---
def clean_text(txt: str) -> str:
    replacements = {
        "“": '"', "”": '"', "‘": "'", "’": "'",
        "–": "-", "—": "-", "•": "-", "…": "...", "\u2011": "-",
    }
    for src, tgt in replacements.items():
        txt = txt.replace(src, tgt)
    return re.sub(r"[^\x00-\x7F]+", "", txt)

class PDF(FPDF):
    def __init__(self, *args, project_title="Project Recommendation", **kwargs):
        super().__init__(*args, **kwargs)
        self.project_title = project_title # Store the project title

    def header(self):
        # >>> MODIFIED <<<
        # Use a larger, bolder font for the main project title header
        self.set_font("Arial", "B", 18) # Changed font size for prominence
        # Calculate width of title and position it dynamically
        title_w = self.get_string_width(self.project_title)
        self.set_x((self.w - title_w) / 2) # Center the text
        self.cell(title_w, 10, self.project_title, border=0, ln=False, align="C", fill=False)
        self.ln(15) # Move cursor down for content (increased spacing)

    def footer(self):
        self.set_y(-15) # Position at 1.5 cm from bottom
        self.set_font("Arial", "I", 8) # Smaller font for footer

        # Left-aligned copyright
        self.cell(self.w / 2, 10, "© Trust Nexus", align="L", border=0)

        # Right-aligned page number
        self.cell(self.w / 2, 10, f"Page {self.page_no()}", align="R", border=0)


def add_centered_image(pdf: FPDF, url: str, *, margin_mm=15,
                       top_y=None, add_new_page=True, quality=90):
    import requests, tempfile, os
    from io import BytesIO
    from PIL import Image

    res = requests.get(url, timeout=30)
    res.raise_for_status()
    pil = Image.open(BytesIO(res.content)).convert("RGB")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp_path = tmp.name
        pil.save(tmp_path, "JPEG", quality=quality)

    if add_new_page:
        pdf.add_page()
        top_y = margin_mm
    if top_y is None:
        top_y = pdf.get_y()

    avail_w = pdf.w - 2 * margin_mm
    avail_h = pdf.h - top_y - margin_mm
    dpi = pil.info.get("dpi", (72, 72))[0] or 72
    img_w_mm = pil.width * 25.4 / dpi
    img_h_mm = pil.height * 25.4 / dpi
    scale = min(avail_w / img_w_mm, avail_h / img_h_mm)
    disp_w, disp_h = img_w_mm * scale, img_h_mm * scale
    x = (pdf.w - disp_w) / 2
    y = top_y + (avail_h - disp_h) / 2

    pdf.image(tmp_path, x=x, y=y, w=disp_w, h=disp_h)

    try:
        os.unlink(tmp_path)
    except PermissionError:
        print(f"⚠️ Could not delete temp file: {tmp_path}")


# MODIFIED: build_pdf now accepts project_title
def build_pdf(recommendation: str, image_links: list[str], output: str, project_title: str) -> Path:
    pdf = PDF(project_title=project_title) # Pass project_title to PDF constructor
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    bullet = 1
    for line in clean_text(recommendation).split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        # >>> MODIFIED <<<
        # Removed the specific handling for "Final Year Project Recommendation:"
        # as the main project title is now in the header.
        # This will render AI-generated headings like "## Safe Path AI Project Recommendation (Updated)"
        # as a regular bold heading within the content, not the main header.
        if re.match(r"^[A-Z][\w\s\-()]+:$", stripped):
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
            # This handles both "## Safe Path AI Project Recommendation (Updated)"
            # and other H2/H3 markdown headings from the AI.
            pdf.set_font("Arial", "B", 15); pdf.ln(5) # Slightly larger for H2/H3
            pdf.multi_cell(0, 10, re.sub(r"[#*]+", "", stripped).strip()); pdf.ln(2)
        else:
            pdf.set_font("Arial", "", 11)
            pdf.multi_cell(0, 7, stripped); pdf.ln(1)

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
# 5)  Main program flow (NO CHANGES HERE FOR NODE.JS INTEGRATION)
# ---------------------------------------------------------------------------
def main() -> None:
    answers, extra_notes = collect_user_answers()
    recommendation = generate_recommendation(answers, extra_notes)
    print("\n🎯 Recommendation:\n")
    print(recommendation)

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

    image_links = [
        "https://i.postimg.cc/FHHzNfrZ/Desktop1.webp",
        "https://i.postimg.cc/dtTZgZ0T/Mob1.webp",
        "https://i.postimg.cc/vZ01Vrqk/Mob3.webp",
        "https://i.postimg.cc/j262dPn8/Mob2.webp",
        "https://i.postimg.cc/VvFscw2p/desktop3.webp",
        "https://i.postimg.cc/44vxcvnP/Desktop2.webp",
    ]
    # For standalone, if you want project title, you'd need to prompt for it here or hardcode it
    pdf_path = build_pdf(recommendation, image_links, "FYP_Recommendation_with_UI.pdf", project_title="My Standalone Project")
    print("\n✅ PDF saved to", pdf_path.resolve())

if __name__ == "__main__":
    main()