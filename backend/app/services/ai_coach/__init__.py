"""AI Coach service -- Claude-powered workout generation with ChromaDB RAG."""
from .workout_generator import generate_workout, check_chromadb
from .client import generate_workout_description, generate_workout_title
