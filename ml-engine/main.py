import os
import uvicorn
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq

# Custom ML Engine and Parser imports
from src.parser import extract_text_from_pdf
from src.matcher import SkillDeltaEngine

# Load environment variables from the .env file
load_dotenv()

# Securely fetch the API key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize Groq Client
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Fallback skills in case the API is down, out of quota, or key is missing
FALLBACK_SKILLS = ["React", "Python", "SQL", "Machine Learning", "Data Analysis", "Cloud Computing", "API Integration"]

# A master dictionary to extract structured skills from messy job descriptions
TECH_DICTIONARY = [
    "React", "Python", "Node.js", "Machine Learning", "Data Analysis", 
    "Cloud Computing", "API", "Git", "SQL", "TensorFlow", "AWS", "Docker", 
    "Kubernetes", "Java", "C++", "C#", "Azure", "GCP", "MongoDB", "PostgreSQL", 
    "GraphQL", "CI/CD", "Agile", "Linux", "Cybersecurity", "TypeScript", 
    "JavaScript", "HTML", "CSS", "Tailwind", "Pandas", "NumPy", "PyTorch"
]

app = FastAPI()

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the AI Model once
engine = SkillDeltaEngine()

def fetch_live_job_skills(job_role: str):
    """Fetches real job listings and extracts required skills using Groq."""
    if not client:
        print("[!] GROQ API KEY MISSING. TRIGGERING PROCEDURAL BACKUP.")
        return FALLBACK_SKILLS

    try:
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "system",
                    "content": "You are a technical recruiter. List 15 core technical skills required for the given role. Return ONLY a comma-separated list of skills."
                },
                {
                    "role": "user",
                    "content": job_role
                }
            ],
            temperature=0.3,
            max_tokens=150
        )
        
        response_text = completion.choices[0].message.content.lower()
        
        # Scan the AI response for our known tech skills
        extracted_skills = []
        for skill in TECH_DICTIONARY:
            if skill.lower() in response_text:
                extracted_skills.append(skill)
        
        # Return unique skills found, or fallback if none matched
        return list(set(extracted_skills)) if extracted_skills else FALLBACK_SKILLS

    except Exception as e:
        print(f"[!] GROQ API FAILED OR BLOCKED. TRIGGERING PROCEDURAL BACKUP. ERROR: {e}")
        return FALLBACK_SKILLS

# ROUTE UPDATED: Now accepts an optional job_role from the frontend
@app.post("/analyze_syllabus")
async def analyze_syllabus(
    file: UploadFile = File(...), 
    job_role: str = Form(default="Software Engineer") 
):
    os.makedirs("data/raw_syllabi", exist_ok=True)
    file_location = f"data/raw_syllabi/{file.filename}"
    
    with open(file_location, "wb+") as file_object:
        file_object.write(await file.read())
        
    raw_text = extract_text_from_pdf(file_location)
    syllabus_topics = [line.strip() for line in raw_text.split('\n') if len(line.strip()) > 5]
    
    live_industry_requirements = fetch_live_job_skills(job_role)
    
    # STRICTER MATCHING: Threshold raised to 0.70 to force weak matches into the "Gaps" column
    covered, missing = engine.extract_delta(syllabus_topics, live_industry_requirements, threshold=0.70)
    
    if os.path.exists(file_location):
        os.remove(file_location)
        
    return {
        "filename": file.filename,
        "target_role": job_role, 
        "coverage_stats": {
            "total_job_skills": len(live_industry_requirements),
            "covered_count": len(covered)
        },
        "covered_skills": covered,
        "skill_delta": missing
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)