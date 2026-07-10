# Recommendation-engine-backend

## Environment variables

Create a `.env` file with:

```env
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
```

`GEMINI_API_KEY` is used only to generate the human-readable explanation for each recommendation. If it is missing, the backend falls back to a local explanation.
