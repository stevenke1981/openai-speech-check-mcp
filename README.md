# OpenAI Speech Check MCP

A local MCP server that transcribes an audio file with OpenAI `gpt-transcribe` and compares the transcript with a reference script. It also compares two existing texts offline.

## Tools

- `check_audio_against_script`: uploads an entire local audio file to OpenAI, then reports suspected omissions, additions and substitutions. Arguments: `audio_path` (absolute path), `reference` (script), and optional `languages` (for example `["zh-tw"]`). **Each call sends the audio to OpenAI and may incur API charges.** Get the user's authorization before submitting a recording.
- `compare_transcripts`: compares `reference` and `transcript` offline without an API request.

Comparison ignores case, punctuation, symbols and whitespace, and applies Unicode NFKC normalization. It does not convert between traditional and simplified Chinese. Differences may be transcription errors: listen to the recording to confirm them. The reported approximate character error rate is based on diff blocks, may exceed 1, and is not a pronunciation score.

## Requirements

- [Bun](https://bun.sh/) installed and available on PATH.
- An OpenAI API key with access to `gpt-transcribe` for audio transcription. Set the `OPENAI_API_KEY` environment variable securely in your operating system or MCP client; do not commit it. Restart the client after changing its environment. Offline comparison does not require a key.
- Audio files must be mp3, mp4, mpeg, mpga, m4a, wav or webm, no larger than 25 MB. Scripts and transcripts have a 10,000-character limit. This version does not split long recordings or return timestamps. See the [OpenAI speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text).

## Setup

```sh
git clone https://github.com/stevenke1981/openai-speech-check-mcp.git
cd openai-speech-check-mcp
bun install --frozen-lockfile
bun run test
```

Configure any MCP client for stdio transport with `bun` as its command and the **absolute path** of this project's `index.ts` as its sole argument. The client must receive `OPENAI_API_KEY` in its environment for transcription. For example:

```json
{
  "mcpServers": {
    "openai-speech-check": {
      "command": "bun",
      "args": ["/absolute/path/to/openai-speech-check-mcp/index.ts"]
    }
  }
}
```

Use the equivalent Windows path and Bun executable if configuring on Windows. For Codex, register the server with:

```sh
codex mcp add openai-speech-check -- bun /absolute/path/to/openai-speech-check-mcp/index.ts
```

The tests exercise MCP discovery, comparison, missing-key handling, and a mocked API response. They do not submit recordings or validate live API access.

## License

MIT. See [LICENSE](LICENSE).

