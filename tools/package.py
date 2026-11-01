"""Create a source-inclusive portable Windows package from the verified release build."""
from pathlib import Path
from shutil import copy2,copytree,rmtree
import hashlib,json,zipfile,tempfile
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'dist').mkdir(exist_ok=True)
# Always stage a fresh inventory; removed source files must not survive from an older release.
staging=tempfile.TemporaryDirectory(prefix='workbench-stage-',dir=ROOT/'dist')
DEST=Path(staging.name)/'Workbench'
DEST.mkdir()
for name in ['web','data','src','tests','cmake','docs','results','licenses','.vscode']:
    copytree(ROOT/name,DEST/name,dirs_exist_ok=True)
for name in ['CMakeLists.txt','README.md','LICENSES.md','dependencies.lock.json','.clang-format','.gitignore','.gitattributes']:
    copy2(ROOT/name,DEST/name)
copytree(ROOT/'tools',DEST/'tools',dirs_exist_ok=True)
copy2(ROOT/'build/windows/Launch.exe',DEST/'Launch.exe')
copy2(ROOT/'build/windows/core_tests.exe',DEST/'tests/core_tests.exe')
if (ROOT/'version-control.bundle').exists():copy2(ROOT/'version-control.bundle',DEST/'version-control.bundle')
manifest={str(p.relative_to(DEST)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(DEST.rglob('*')) if p.is_file() and p.name!='SHA256SUMS.json'}
(DEST/'SHA256SUMS.json').write_text(json.dumps(manifest,indent=2))
archive=ROOT/'dist/CandidateID_Workbench.zip'
pending=Path(staging.name)/archive.name
with zipfile.ZipFile(pending,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(DEST.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(DEST))
with zipfile.ZipFile(pending) as z:
    assert z.testzip() is None
    assert 'Launch.exe' in z.namelist() and 'web/index.html' in z.namelist()
pending.replace(archive) # Keep the previous archive intact until the new ZIP is valid.
extracted=ROOT/'dist/Workbench'
if extracted.exists():rmtree(extracted) # Generated staging output only; source is never removed.
DEST.replace(extracted)
staging.cleanup()
print(f'Created {archive.name}: {archive.stat().st_size} bytes, {len(manifest)} manifested files')
