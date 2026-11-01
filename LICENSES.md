# Dependencies, reuse and licences

The application uses original project C++/HTML/CSS/JavaScript with disclosed AI assistance. There are no third-party frontend libraries, fonts, icons, solver libraries, or copied application source files.

Build tools: CMake (BSD 3-Clause), Apple Clang/LLVM (Apache-2.0 with LLVM exceptions; Mac binary only), MinGW-w64 headers/runtime (component-specific permissive licences), GCC libstdc++ and libgcc (GPL with GCC Runtime Library Exception). The Windows executable statically links libstdc++/libgcc and the MinGW runtime; Windows system DLLs are supplied by Windows 11 and are not redistributed. See the bundled `licenses/` directory for the actual installed MinGW/GCC licence notices and exception text.

Build tools and documentation-generation libraries are not bundled as executable application dependencies. No package installation or build is performed at first launch.

Before redistribution, the candidate should confirm their ownership statement and the sample-data CC0 dedication in data/PROVENANCE.md. No claim of exclusive human authorship is made.
