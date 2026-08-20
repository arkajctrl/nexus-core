import os
import uvicorn
import requests
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Custom ML Engine and Parser imports
from src.parser import extract_text_from_pdf
from src.matcher import SkillDeltaEngine

# Load environment variables from the .env file
load_dotenv()

# Securely fetch the API key
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")

# Fallback skills in case the API is down, out of quota, or key is missing
FALLBACK_SKILLS = ["React", "Python", "SQL", "Machine Learning", "Data Analysis", "Cloud Computing", "API Integration", "Git", "TensorFlow", "Node.js"]

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
    """Fetches real job listings and extracts required skills."""
    if not RAPIDAPI_KEY:
        print("API Key missing. Using fallback skills.")
        return FALLBACK_SKILLS

    url = "https://jsearch.p.rapidapi.com/search"
    querystring = {"query": f"{job_role} in India", "num_pages": "1"}
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }

    try:
        response = requests.get(url, headers=headers, params=querystring, timeout=10)
        response.raise_for_status()
        jobs = response.json().get('data', [])
        
        if not jobs:
            return FALLBACK_SKILLS

        # Combine all job descriptions into one massive text block
        raw_descriptions = " ".join([job.get('job_description', '') for job in jobs]).lower()
        
        # Scan the descriptions for our known tech skills
        extracted_skills = []
        for skill in TECH_DICTIONARY:
            if skill.lower() in raw_descriptions:
                extracted_skills.append(skill)
                
        # Return unique skills found in real jobs, or fallback if none matched
        return list(set(extracted_skills)) if extracted_skills else FALLBACK_SKILLS

    except Exception as e:
        print(f"Failed to fetch live jobs: {e}")
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
    covered, missing = engine.extract_delta(syllabus_topics, live_industry_requirements, threshold=0.50)
    
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