from fastapi import FastAPI

app = FastAPI(title="data-engine")


@app.get("/health")
def health():
    return {"status": "ok"}
