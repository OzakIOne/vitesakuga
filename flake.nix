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
        nub = import ./nix/nub.nix { inherit pkgs; };
      in
      {
        packages.nub = nub;
        packages.default = nub;

        devShells.default = pkgs.mkShell {
          name = "vitesakuga";

          packages = [
            nub
            pkgs.nodejs_26
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

            echo "→ nub install && nub run dcu && nub run db migrate && nub run dev"
          '';
        };
      }
    );
}
