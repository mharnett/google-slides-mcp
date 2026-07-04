# Google Slides MCP Server

This project provides a Model Context Protocol (MCP) server for interacting with the Google Slides API. It allows you to create, read, and modify Google Slides presentations programmatically.

## Prerequisites

*   Node.js (v18 or later recommended)
*   npm (usually comes with Node.js)
*   Google Cloud Project with the Google Slides API enabled.
*   OAuth 2.0 Credentials (Client ID and Client Secret) for your Google Cloud Project.
*   A Google Refresh Token associated with the OAuth 2.0 credentials and the necessary Google Slides API scopes.

## Setup

1.  **Clone the repository (if applicable) or ensure you are in the project directory.**

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the Server:**
    Compile the TypeScript code to JavaScript:
    ```bash
    npm run build
    ```
    This will create a `build` directory containing the compiled JavaScript code.

4.  **Obtain Google API Credentials:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a new project or select an existing one.
    *   Navigate to "APIs & Services" > "Enabled APIs & services".
    *   Click "+ ENABLE APIS AND SERVICES", search for "Google Slides API", and enable it.
    *   Navigate to "APIs & Services" > "Credentials".
    *   Click "+ CREATE CREDENTIALS" > "OAuth client ID".
    *   If prompted, configure the OAuth consent screen. For "User type", choose "External" unless you have a Google Workspace account and want to restrict it internally. Provide an app name, user support email, and developer contact information.
    *   On the "Scopes" page during consent screen setup, click "ADD OR REMOVE SCOPES". Search for and add the single scope this server needs:
        *   `https://www.googleapis.com/auth/presentations` (view and manage presentations — every tool uses only this; no Drive scope is required or requested)
    *   Save the consent screen configuration.
    *   Go back to "Credentials", click "+ CREATE CREDENTIALS" > "OAuth client ID".
    *   Select "Desktop app" as the Application type.
    *   Give it a name (e.g., "Slides MCP Client").
    *   Click "Create". You will see your **Client ID** and **Client Secret**. **Copy these down securely.** You can also download the JSON file containing these credentials.

5.  **Obtain a Google Refresh Token (PKCE loopback flow):**
    A refresh token lets the server obtain access tokens without re-prompting you each time. This repo ships a **self-contained OAuth helper** that runs Google's installed-app loopback flow hardened with **PKCE (RFC 7636, S256)**. It reads nothing from your home directory and needs no shared OAuth-client keyfile — you bring your own Desktop-app client.

    There are two equivalent onboarding paths; both use PKCE, the same `http://localhost/callback` loopback redirect form, and resolve the OAuth scope from the same source (`config.json` → the presentations default):

    *   **Standalone helper (no build required):**
        ```bash
        export GOOGLE_CLIENT_ID=...      # your Desktop-app client ID
        export GOOGLE_CLIENT_SECRET=...  # your Desktop-app client secret
        node get-refresh-token.cjs
        ```
    *   **Runtime path (builds first, then runs the compiled CLI):**
        ```bash
        export GOOGLE_CLIENT_ID=...
        export GOOGLE_CLIENT_SECRET=...
        npm run get-token
        ```

    Either command opens your browser, asks you to sign in as the Google account the server should act for, and — on success — prints a single line to **stdout**:

    ```
    GOOGLE_REFRESH_TOKEN=1//0g...
    ```

    Copy that value into your environment / MCP settings (below). Do not redirect the command's stdout to a shared log — the refresh token is a secret.

    **Scope configuration (optional):** the scope requested defaults to the minimum this server needs (`https://www.googleapis.com/auth/presentations`). To request a different scope, copy `config.example.json` to `config.json` (gitignored, per-user) and edit `oauth.scope`. Both onboarding paths and the running server read the scope from `config.json`, so they never drift. `config.example.json` is only a template and is never read at runtime.

6.  **Configure Credentials and Command in MCP Settings:**
    Locate your MCP settings file (e.g., `.../User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`). Find or create the entry for `"google-slides-mcp"` and configure it with the command to run the server and your credentials:
    ```json
    "google-slides-mcp": {
      "transportType": "stdio",
      "command": "node",
      "args": [
        "/path/to/google-slides-mcp/build/index.js"
      ],
      "env": {
        "GOOGLE_CLIENT_ID": "YOUR_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "GOOGLE_REFRESH_TOKEN": "YOUR_REFRESH_TOKEN"
      }
      // ... other optional settings like description ...
    }
    ```
    Replace `/path/to/google-slides-mcp/build/index.js` with the actual path to the compiled server index file on your system. Replace `YOUR_CLIENT_ID`, `YOUR_CLIENT_SECRET`, and `YOUR_REFRESH_TOKEN` with the actual values you obtained. The MCP runner will inject these values into the server's environment when it starts.

## Running the Server

Execute the compiled code:

```bash
npm run start
```

The server will start and listen for MCP requests on standard input/output (stdio). You should see a message like: `Google Slides MCP server running and connected via stdio.`

## Available Tools

The server exposes the following tools via the Model Context Protocol:

*   **`create_presentation`**: Creates a new Google Slides presentation.
    *   **Input:**
        *   `title` (string, required): The title for the new presentation.
    *   **Output:** JSON object representing the created presentation details.

*   **`get_presentation`**: Retrieves details about an existing presentation.
    *   **Input:**
        *   `presentationId` (string, required): The ID of the presentation to retrieve.
        *   `fields` (string, optional): A field mask (e.g., "slides,pageSize") to limit the returned data.
    *   **Output:** JSON object representing the presentation details.

*   **`batch_update_presentation`**: Applies a series of updates to a presentation. This is the primary method for modifying slides (adding text, shapes, images, creating slides, etc.).
    *   **Input:**
        *   `presentationId` (string, required): The ID of the presentation to update.
        *   `requests` (array, required): An array of request objects defining the updates. Refer to the [Google Slides API `batchUpdate` documentation](https://developers.google.com/slides/api/reference/rest/v1/presentations/batchUpdate#requestbody) for the structure of individual requests.
        *   `writeControl` (object, optional): Controls write request execution (e.g., using revision IDs).
    *   **Output:** JSON object representing the result of the batch update.

*   **`get_page`**: Retrieves details about a specific page (slide) within a presentation.
    *   **Input:**
        *   `presentationId` (string, required): The ID of the presentation containing the page.
        *   `pageObjectId` (string, required): The object ID of the page (slide) to retrieve.
    *   **Output:** JSON object representing the page details.

*   **`summarize_presentation`**: Extracts and formats all text content from a presentation for easier summarization.
    *   **Input:**
        *   `presentationId` (string, required): The ID of the presentation to summarize.
        *   `include_notes` (boolean, optional): Whether to include speaker notes in the summary. Defaults to false.
    *   **Output:** JSON object containing:
        *   `title`: The presentation's title
        *   `slideCount`: Total number of slides
        *   `lastModified`: Revision information
        *   `slides`: Array of slide objects containing:
            *   `slideNumber`: Position in presentation
            *   `slideId`: Object ID of the slide
            *   `content`: All text extracted from the slide
            *   `notes`: Speaker notes (if requested and available)

*(More tools can be added by extending `src/index.ts`)*
