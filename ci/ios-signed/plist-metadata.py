"""Future worker-only plist conversion. Never reads a private signing key."""
import base64
import datetime
import hashlib
import json
import plistlib
import sys


def json_safe(value):
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, datetime.datetime):
        return value.replace(tzinfo=datetime.timezone.utc).isoformat()
    raise TypeError("Unsupported plist metadata")


try:
    action = sys.argv[1]
    if action == "encode":
        sys.stdout.buffer.write(plistlib.dumps(json.load(sys.stdin), fmt=plistlib.FMT_XML))
    else:
        data = plistlib.loads(sys.stdin.buffer.read())
        if action == "profile":
            data = {
                "uuid": data.get("UUID"), "name": data.get("Name"),
                "teams": data.get("TeamIdentifier", []),
                "prefixes": data.get("ApplicationIdentifierPrefix", []),
                "expires": data.get("ExpirationDate"), "created": data.get("CreationDate"),
                "platforms": data.get("Platform", []),
                "hasDevices": "ProvisionedDevices" in data,
                "allDevices": data.get("ProvisionsAllDevices", False),
                "entitlements": data.get("Entitlements", {}),
                "certificateSha1": [hashlib.sha1(c).hexdigest().upper() for c in data.get("DeveloperCertificates", [])],
            }
        elif action != "decode":
            raise ValueError("Unknown action")
        sys.stdout.write(json.dumps(data, default=json_safe))
except Exception:
    # No raw plist, profile, certificate or exception detail is printed.
    sys.stderr.write("Private metadata conversion failed\n")
    sys.exit(1)
