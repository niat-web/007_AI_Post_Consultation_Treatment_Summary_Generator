import os

from dotenv import load_dotenv


load_dotenv()


class Config:
    SQLALCHEMY_DATABASE_URI = (os.getenv('DB_URL', 'postgres'))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    PROMPT_VERSION = os.getenv("PROMPT_VERSION", "v1")
