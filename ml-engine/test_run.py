from src.matcher import SkillDeltaEngine

engine = SkillDeltaEngine()

college_syllabus = [
    "Arrays, Linked Lists, Stacks, Queues, and Trees",
    "Relational Database Management Systems and SQL Queries",
    "Object-Oriented Programming principles using Java"
]

industry_job_requirements = [
    "Data Structures and Algorithms",
    "SQL Database Architecture",
    "Docker Containerization",
    "React Frontend Development"
]

covered, missing = engine.extract_delta(college_syllabus, industry_job_requirements, threshold=0.45)

print("\n==============================")
print("  SKILLS COVERED BY SYLLABUS  ")
print("==============================")
for item in covered:
    print(f"  [MATCH] {item['skill']} -> '{item['matched_with']}' ({item['confidence']}%)")

print("\n==============================")
print("  SKILL DELTA (GAPS TO LEARN) ")
print("==============================")
for item in missing:
    print(f"  [MISSING] {item['skill']} (Best match was only {item['top_similarity']}%)")