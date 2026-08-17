from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

class SkillDeltaEngine:
    def __init__(self):
        print("Loading AI Model...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')

    def extract_delta(self, syllabus_topics, job_skills, threshold=0.45):
        # Generate semantic vector embeddings
        syllabus_embeddings = self.model.encode(syllabus_topics)
        job_embeddings = self.model.encode(job_skills)
        
        # Calculate cosine similarity matrix
        similarity_matrix = cosine_similarity(job_embeddings, syllabus_embeddings)
        
        covered = []
        missing = []
        
        for idx, skill in enumerate(job_skills):
            max_sim = float(np.max(similarity_matrix[idx]))
            matched_idx = int(np.argmax(similarity_matrix[idx]))
            
            if max_sim >= threshold:
                matched_topic = syllabus_topics[matched_idx]
                covered.append({
                    "skill": skill,
                    "matched_with": matched_topic,
                    "confidence": round(max_sim * 100, 1)
                })
            else:
                missing.append({
                    "skill": skill,
                    "top_similarity": round(max_sim * 100, 1)
                })
                
        return covered, missing