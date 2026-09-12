{ pkgs }:
let
  inherit (pkgs) lib stdenv fetchurl;

  systems = {
    "aarch64-darwin" = {
      file = "nub-darwin-arm64.tar.gz";
      hash = "sha256-CC5NMNNYsZdrIZQJ4I89hFA61gniNHJCPTBmDH77bTw=";
    };
    "x86_64-darwin" = {
      file = "nub-darwin-x64.tar.gz";
      hash = "sha256-jFlTTT48onl5ubRF/a2hC7QYqsTbShiwNM6x3C0Pywo=";
    };
    "aarch64-linux" = {
      file = "nub-linux-arm64.tar.gz";
      hash = "sha256-SvWSRGH/qyHpFuogHcb+nAPvdS72JJdvbwEwkuigSc4=";
    };
    "x86_64-linux" = {
      file = "nub-linux-x64.tar.gz";
      hash = "sha256-GwU+MnDee5o8D6V/F2MS0yWtxb1X+6j+hmlW69UuXsA=";
    };
  };

  asset =
    systems.${stdenv.hostPlatform.system}
      or (throw "nub: unsupported system ${stdenv.hostPlatform.system}");
  version = "0.9.0";
in
stdenv.mkDerivation {
  pname = "nub";
  inherit version;

  src = fetchurl {
    url = "https://github.com/nubjs/nub/releases/download/v${version}/${asset.file}";
    hash = asset.hash;
  };

  sourceRoot = ".";

  nativeBuildInputs = lib.optionals stdenv.hostPlatform.isLinux [ pkgs.autoPatchelfHook ];
  buildInputs = lib.optionals stdenv.hostPlatform.isLinux [ pkgs.stdenv.cc.cc.lib ];

  dontConfigure = true;
  dontBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p "$out"
    cp -r bin "$out/bin"
    cp -r runtime "$out/runtime"
    chmod +x "$out/bin/nub"
    if [ ! -f "$out/bin/nubx" ]; then ln -s nub "$out/bin/nubx"; fi
    chmod +x "$out/bin/nubx"
    runHook postInstall
  '';

  meta = {
    description = "Fast TypeScript-first runtime and pnpm-compatible package manager for Node";
    homepage = "https://nubjs.com";
    downloadPage = "https://github.com/nubjs/nub/releases";
    license = lib.licenses.mit;
    mainProgram = "nub";
    platforms = builtins.attrNames systems;
  };
}
