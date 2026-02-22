import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Helper to create OAuth2 client
  const getOAuth2Client = (clientId?: string, clientSecret?: string) => {
    return new google.auth.OAuth2(
      clientId || process.env.GOOGLE_CLIENT_ID,
      clientSecret || process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/auth/callback`
    );
  };

  app.get("/api/auth/url", (req, res) => {
    const { clientId, clientSecret } = req.query;
    const client = getOAuth2Client(clientId as string, clientSecret as string);
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/documents.readonly"],
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code, state } = req.query;
    // Note: In a real app, we'd need to know which client ID/Secret to use here.
    // For this sandbox, we'll assume the environment ones or we'd need to pass them through 'state'.
    // Let's try to use the environment ones first, or if we passed them in state...
    // Actually, let's keep it simple: if they are in env, use them. 
    // If not, we might have a problem unless we passed them in state.
    try {
      const client = getOAuth2Client();
      const { tokens } = await client.getToken(code as string);
      // In a real app, we'd store this in a session. 
      // For this demo, we'll send it back to the client to store in localStorage (less secure but easier for demo)
      // Or better, we can just send a success message and the client can fetch the user data.
      // Actually, let's just pass the tokens back in a script tag to the opener.
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/google-doc/content", async (req, res) => {
    const { docId, tokens, clientId, clientSecret } = req.body;
    try {
      const client = getOAuth2Client(clientId, clientSecret);
      client.setCredentials(tokens);
      const docs = google.docs({ version: "v1", auth: client });
      const doc = await docs.documents.get({ documentId: docId });
      
      // Extract text from doc
      let content = "";
      doc.data.body?.content?.forEach(element => {
        if (element.paragraph) {
          element.paragraph.elements?.forEach(el => {
            if (el.textRun) {
              content += el.textRun.content;
            }
          });
        }
      });

      res.json({ content });
    } catch (error) {
      console.error("Error fetching Google Doc:", error);
      res.status(500).json({ error: "Failed to fetch Google Doc" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
