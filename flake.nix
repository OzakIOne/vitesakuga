{
  description = "ViteSakuga — fullstack web application";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        pnpm = import ./nix/pnpm.nix { inherit pkgs; };
      in
      {
        packages.pnpm = pnpm;
        packages.default = pnpm;

        devShells.default = pkgs.mkShell {
          name = "vitesakuga";

          packages = [
            pnpm
            pkgs.nodejs_latest
            pkgs.pkg-config
            pkgs.python3
            pkgs.vips
            pkgs.glib
            pkgs.sqlite
            pkgs.docker
            pkgs.docker-compose
            pkgs.postgresql
          ];

          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";

          shellHook = ''
            echo "ViteSakuga dev shell"

            if [ ! -f .env ]; then
              echo "→ Copy .env.example to .env and configure"
            fi

            echo "→ pnpm install && pnpm run dcu && pnpm run db migrate && pnpm run dev"
          '';
        };
      }
    );
}
