#!/usr/bin/env python3
"""Install this project's pinned Linux Android toolchain without writing to HOME."""
import argparse
import hashlib
import os
from pathlib import Path
import shlex
import shutil
import tarfile
import urllib.request
from urllib.parse import urlparse
import zipfile


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--tool-root", type=Path, default=Path("/workspace/shared/android-tools"))
args = parser.parse_args()
root = args.tool_root.resolve()
root.mkdir(parents=True, exist_ok=True)


def download(name, url, checksum):
    target = root / name
    if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != checksum:
        partial = target.with_suffix(target.suffix + ".part")
        with urllib.request.urlopen(url, timeout=180) as response, partial.open("wb") as output:
            shutil.copyfileobj(response, output)
        if hashlib.sha256(partial.read_bytes()).hexdigest() != checksum:
            partial.unlink()
            raise RuntimeError(f"SHA-256 mismatch for {name}")
        partial.replace(target)
    return target


def unzip(archive, destination):
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as contents:
        for entry in contents.infolist():
            path = (destination / entry.filename).resolve()
            if not path.is_relative_to(destination.resolve()):
                raise RuntimeError("Unsafe ZIP entry")
        contents.extractall(destination)
        for entry in contents.infolist():
            mode = entry.external_attr >> 16
            if mode:
                os.chmod(destination / entry.filename, mode)


jdk_dir = root / "jdk-21.0.12.1+1"
if not (jdk_dir / "bin/javac").exists():
    filename = "OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz"
    archive = download(filename,
        "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/" + filename,
        "ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94")
    with tarfile.open(archive) as contents:
        contents.extractall(root, filter="data")

gradle_dir = root / "gradle-8.11.1"
if not (gradle_dir / "bin/gradle").exists():
    unzip(download("gradle-8.11.1-bin.zip",
        "https://downloads.gradle.org/distributions/gradle-8.11.1-bin.zip",
        "f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6"), root)

sdk = root / "sdk"
for name, checksum, destination in [
    ("platform-36_r02.zip", "37607369a28c5b640b3a7998868d45898ebcb777565a0e85f9acf36f29631d2e", sdk / "platforms/android-36"),
    ("build-tools_r35_linux.zip", "bd3a4966912eb8b30ed0d00b0cda6b6543b949d5ffe00bea54c04c81e1561d88", sdk / "build-tools/35.0.0"),
    ("platform-tools_r37.0.1-linux.zip", "d230f13842f60f782a8645f9c813f8f845bf36089ea7289f28c48f17979313f1", sdk / "platform-tools"),
]:
    if destination.exists():
        continue
    archive = download(name, "https://dl.google.com/android/repository/" + name, checksum)
    temporary = root / ("extract-" + name)
    unzip(archive, temporary)
    directories = [entry for entry in temporary.iterdir() if entry.is_dir()]
    if len(directories) != 1:
        raise RuntimeError(f"Unexpected layout in {name}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(directories[0]), destination)
    shutil.rmtree(temporary)

# These fully installed SDK packages need no package downloads at Gradle runtime.
# Any additional SDK package must be installed normally after reviewing its license.
gradle_home = root / "gradle-home"
gradle_home.mkdir(exist_ok=True)
android_user = root / "android-user"
android_user.mkdir(exist_ok=True)
properties = []
proxy = urlparse(os.environ.get("HTTPS_PROXY", ""))
if proxy.hostname:
    if proxy.username or proxy.password:
        raise RuntimeError("Configure authenticated Java proxy privately; this script never copies proxy credentials")
    for protocol in ["https", "http"]:
        properties += [f"systemProp.{protocol}.proxyHost={proxy.hostname}", f"systemProp.{protocol}.proxyPort={proxy.port or 8080}"]
    properties.append("systemProp.http.nonProxyHosts=localhost|127.*")
truststore = Path("/etc/ssl/certs/java/cacerts")
if truststore.exists():
    properties.append(f"systemProp.javax.net.ssl.trustStore={truststore}")
properties_path = gradle_home / "gradle.properties"
if not properties_path.exists():
    properties_path.write_text("\n".join(properties) + "\n")

exports = {
    "JAVA_HOME": jdk_dir,
    "ANDROID_HOME": sdk,
    "ANDROID_USER_HOME": android_user,
    "GRADLE_USER_HOME": gradle_home,
}
environment = root / "toolchain.env"
environment.write_text("".join(f"export {name}={shlex.quote(str(value))}\n" for name, value in exports.items()))
print(f"Pinned Android toolchain ready. Run: source {shlex.quote(str(environment))}")
