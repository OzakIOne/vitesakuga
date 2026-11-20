{ pkgs }:
let
  inherit (pkgs) lib stdenv fetchurl;

  systems = {
    "aarch64-darwin" = {
      file = "pnpm-darwin-arm64.tar.gz";
      hash = "sha256-XE1zAY4A3WAlMc5xRiVZT7aTy+EQ5nGd8rBDsK5iqxo=";
    };
    "x86_64-darwin" = {
      file = "pnpm-darwin-x64.tar.gz";
      hash = "sha256-QVwFrkJiyJuPJMpYxpO+XZaYVq6QnAhqoGmWlR/KMOo=";
    };
    "aarch64-linux" = {
      file = "pnpm-linux-arm64.tar.gz";
      hash = "sha256-bFkTpIyTs6VWtxw72b8Sxr+fv7u9LcvR1SqFxTl1G54=";
    };
    "x86_64-linux" = {
      file = "pnpm-linux-x64.tar.gz";
      hash = "sha256-hMR3O89KIX9Ag817KpHkzuYQPPQkJsEoLvN9MI9VpBA=";
    };
  };

  asset =
    systems.${stdenv.hostPlatform.system}
      or (throw "pnpm: unsupported system ${stdenv.hostPlatform.system}");
  version = "12.21.0";
in
stdenv.mkDerivation {
  pname = "pnpm";
  inherit version;

  src = fetchurl {
    url = "https://github.com/pnpm/pnpm/releases/download/v${version}/${asset.file}";
    hash = asset.hash;
  };

  sourceRoot = ".";

  nativeBuildInputs = lib.optionals stdenv.hostPlatform.isLinux [ pkgs.autoPatchelfHook ];
  buildInputs = lib.optionals stdenv.hostPlatform.isLinux [ pkgs.stdenv.cc.cc.lib ];

  dontConfigure = true;
  dontBuild = true;
  # The binary is a Node.js single executable application: stripping it drops
  # the injected JavaScript blob.
  dontStrip = true;

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/libexec/pnpm" "$out/bin"
    cp -a pnpm dist "$out/libexec/pnpm/"
    ln -s "$out/libexec/pnpm/pnpm" "$out/bin/pnpm"
    cat > "$out/bin/pnpx" <<EOF
    #!${stdenv.shell}
    exec "$out/libexec/pnpm/pnpm" dlx "\$@"
    EOF
    chmod +x "$out/bin/pnpx"
    runHook postInstall
  '';

  meta = {
    description = "Fast, disk space efficient package manager (prebuilt native release)";
    homepage = "https://pnpm.io";
    downloadPage = "https://github.com/pnpm/pnpm/releases";
    license = lib.licenses.mit;
    mainProgram = "pnpm";
    platforms = builtins.attrNames systems;
  };
}
