# About Me
I use Gemini AI to transform your handwritten notes or Google Docs into professional, structured PDFs and PowerPoints.

**Key Features**
1. Intelligent Elaboration: Automatically detects underlined words or phrases and provides detailed context and explanations.
2. Contextual Filling: Identifies empty headings and generates concise, relevant content to fill the gaps.
3. Diagram Recreation: Detects sketches or diagrams in your notes and uses AI to generate clean, professional digital versions.
4. Multi-Format Export: Choose between structured PDF documents or professional PowerPoint presentations.
5. Google Docs Integration: Connect your Google account to import notes directly from digital documents.

   
**Google OAuth Setup - Required Steps**
To enable Google Docs integration, you must configure your Google Cloud project:
Open the Google Cloud Console: https://console.cloud.google.com/apis/credentials
Create OAuth 2.0 Client ID:
Application type: Web application
Add these Authorized redirect URIs:
Development: https://ais-dev-45gpiyzhyzd5bbgc6yuxcg-168071429108.asia-southeast1.run.app/auth/callback
Shared/Deployed: https://ais-pre-45gpiyzhyzd5bbgc6yuxcg-168071429108.asia-southeast1.run.app/auth/callback
Set Environment Variables in the AI Studio Secrets panel:
GOOGLE_CLIENT_ID: Your Google Client ID
GOOGLE_CLIENT_SECRET: Your Google Client Secret
APP_URL: https://ais-dev-45gpiyzhyzd5bbgc6yuxcg-168071429108.asia-southeast1.run.app (or the shared URL)

**How to use:**
Upload: Drag and drop photos of your handwritten notes or paste a Google Doc link.
Connect: If using Google Docs, click "Connect Google Docs" to authorize access.
Generate: Click "Generate Smart Notes". The AI will analyze your input, elaborate on emphasized points, and recreate diagrams.
Review: Preview the structured output in the app.
Export: Download your final document as a PDF or PPTX.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
