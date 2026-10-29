from fastapi import FastAPI

app = FastAPI(title="Pata Talanta API")

@app.get("/")
def home():
    return {"message": "Pata Talanta is running"}
