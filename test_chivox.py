"""Quick test: Chivox MCP connectivity via China site endpoint."""
import asyncio
import os
import sys

# Load env
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("CHIVOX_API_KEY", "")
MCP_URL = os.getenv("CHIVOX_MCP_URL", "")

print(f"API Key: {API_KEY[:12]}...{API_KEY[-6:]}")
print(f"MCP URL: {MCP_URL}")
print()


async def test_connection():
    from mcp.client.streamable_http import streamablehttp_client
    from mcp import ClientSession

    print("[1] Connecting to Chivox MCP server...")
    try:
        async with streamablehttp_client(
            MCP_URL,
            headers={"Authorization": f"Bearer {API_KEY}"},
        ) as (read_stream, write_stream, _):
            print("[2] Transport connected. Initializing session...")
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                print("[3] Session initialized!")

                # List available tools
                tools = await session.list_tools()
                print(f"[4] Available tools ({len(tools.tools)}):")
                for t in tools.tools:
                    print(f"    - {t.name}: {t.description[:60] if t.description else ''}")

                print("\n[SUCCESS] Chivox MCP connection fully working!")
                return True
    except Exception as e:
        print(f"\n[FAILED] Error: {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    result = asyncio.run(test_connection())
    sys.exit(0 if result else 1)
