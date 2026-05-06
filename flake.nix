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
      in
      {
        devShells.default = pkgs.mkShell {
          name = "vitesakuga";

          packages = with pkgs; [
            nodejs_22
            pnpm
            pkg-config
            python3
            vips
            glib
            sqlite
            docker
            docker-compose
            postgresql
          ];

          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";

          shellHook = ''
            echo "ViteSakuga dev shell"

            if [ ! -f .env ]; then
              echo "→ Copy .env.example to .env and configure"
            fi

            echo "→ pnpm install && pnpm dcu && pnpm db migrate && pnpm dev"
          '';
        };
      }
    );
}
