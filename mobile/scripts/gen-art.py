"""
Generate one SparkXP art asset from a prompt + style reference image(s).

Uses OpenAI's image *edits* endpoint so the reference fixes the style — this is
what keeps every fox / island / backdrop in one visual world. See
`assets/ART_BRIEF.md` for the exact prompt and reference per asset.

    OPENAI_API_KEY=sk-... python3 scripts/gen-art.py OUT.png "PROMPT" REF1.png [REF2.png]

Env: SIZE (default 1024x1536), Q (low|medium|high, default high),
     MODEL (default gpt-image-2), BG=transparent for cut-outs.
Convert the result to WebP before committing:  cwebp -q 82 OUT.png -o OUT.webp
"""
import base64, json, os, sys, urllib.error, urllib.request, uuid

key = os.environ.get("OPENAI_API_KEY")
if not key or len(sys.argv) < 4:
    sys.exit(__doc__)
out, prompt, refs = sys.argv[1], sys.argv[2], sys.argv[3:]

boundary = "----" + uuid.uuid4().hex
parts = []


def field(name, value):
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())


field("model", os.environ.get("MODEL", "gpt-image-2"))
field("prompt", prompt)
field("size", os.environ.get("SIZE", "1024x1536"))
field("quality", os.environ.get("Q", "high"))
if os.environ.get("BG"):
    field("background", os.environ["BG"])
for ref in refs:
    head = (f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; '
            f'filename="{os.path.basename(ref)}"\r\nContent-Type: image/png\r\n\r\n')
    parts.append(head.encode() + open(ref, "rb").read() + b"\r\n")
parts.append(f"--{boundary}--\r\n".encode())

req = urllib.request.Request(
    "https://api.openai.com/v1/images/edits",
    data=b"".join(parts),
    headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
)
try:
    res = json.load(urllib.request.urlopen(req, timeout=600))
except urllib.error.HTTPError as err:
    sys.exit(f"HTTP {err.code}: {err.read().decode()[:400]}")
open(out, "wb").write(base64.b64decode(res["data"][0]["b64_json"]))
print("saved", out)
