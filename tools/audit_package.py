"""Audit archive integrity, hashes, required files and extracted source compilation."""
import hashlib,json,subprocess,tempfile,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
archive=root/'dist/CandidateID_Workbench.zip'
checks=[]
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    checks.append('PASS ZIP CRC integrity')
    names=z.namelist()
    assert all(not n.startswith('/') and '..' not in Path(n).parts for n in names)
    checks.append('PASS relative safe archive paths')
    required=['Launch.exe','CMakeLists.txt','README.md','.vscode/tasks.json','web/index.html','web/app.js','web/style.css','data/sample.stl','data/temperatures.csv','docs/Report.pdf','docs/AI_USE_LOG.md','docs/OWNERSHIP.md','results/WALKTHROUGH.html','version-control.bundle','docs/COMMIT_LOG.txt','tests/core_tests.exe']
    required += ['web/enhancements.css','web/evidence.js','web/accuracy.js','docs/RUBRIC_REVIEW.md','docs/WINDOWS_ACCEPTANCE.md','docs/DEFENCE_GUIDE.md','src/verification.cpp']
    assert all(n in names for n in required)
    checks.append('PASS required package file inventory')
    assert z.read('Launch.exe')[:2]==b'MZ'
    checks.append('PASS Windows executable signature (not a Windows launch test)')
    for name,sha in json.loads(z.read('SHA256SUMS.json')).items():
        assert hashlib.sha256(z.read(name)).hexdigest()==sha,name
    checks.append('PASS per-file SHA256 manifest')
    destination=Path(tempfile.mkdtemp(prefix='workbench-audit-'))
    z.extractall(destination)
build=destination/'native-build'
for command in [['cmake','-S',str(destination),'-B',str(build),'-DCMAKE_BUILD_TYPE=Release'],['cmake','--build',str(build),'-j','4'],['ctest','--test-dir',str(build),'--output-on-failure']]:
    completed=subprocess.run(command,capture_output=True,text=True)
    if completed.returncode:raise RuntimeError(completed.stderr+completed.stdout)
checks.append('PASS fresh extracted source configures, compiles and passes CTest on Mac')
text='\n'.join(checks)+'\nWindows execution and candidate handwritten appendix remain unverified/outstanding.\n'
(root/'results/generated/package_audit.log').write_text(text)
print(text)
