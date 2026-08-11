#!/usr/bin/env bash
# check-npm-sync.sh — vérifie que le paquet npm publié `keepsake-mcp` contient
# les mêmes outils MCP que le code local, À CONTENU IDENTIQUE.
#
# Deux modes de défaillance réels, tous deux invisibles à un diff de versions :
#   1. « outils ajoutés sans bump » — même numéro des deux côtés, mais le
#      tarball npm ne contient pas les nouveaux outils (cas réel : commit
#      2500f65, 4 outils note_comments présents en HTTP mais absents du npm
#      1.6.0). → comparaison de la LISTE des outils.
#   2. « champ ajouté au schéma d'un outil existant » — même liste d'outils
#      des deux côtés, mais le schéma (ou la description, ou le handler) d'un
#      outil a changé sans republication (cas réel : champ `archived` d'
#      update_tag, août 2026). → comparaison du CONTENU de chaque outil.
#
# Le contenu est comparé build-contre-build (build/tools.js local, re-généré
# si src/tools.ts est plus récent, contre build/tools.js du tarball npm) pour
# ne pas diffuser du TypeScript contre du JavaScript compilé. Les espaces sont
# normalisés avant hachage pour tolérer les différences de formatage de tsc.
#
# Usage : keepsake-mcp/scripts/check-npm-sync.sh   (depuis n'importe où)
# Sortie : ✅ aligné (exit 0) / ❌ désaligné avec le détail (exit 1)

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
MCP_DIR=$(dirname "$SCRIPT_DIR")
TOOLS_SRC="$MCP_DIR/src/tools.ts"
LOCAL_BUILD="$MCP_DIR/build/tools.js"

if [ ! -f "$TOOLS_SRC" ]; then
  echo "❌ Introuvable : $TOOLS_SRC" >&2
  exit 2
fi

# Build local à jour ? (le hachage se fait sur le JS compilé)
if [ ! -f "$LOCAL_BUILD" ] || [ "$TOOLS_SRC" -nt "$LOCAL_BUILD" ]; then
  echo "Build local absent ou plus vieux que src/tools.ts — npm run build…"
  if ! (cd "$MCP_DIR" && npm run build --silent > /dev/null); then
    echo "❌ npm run build a échoué dans $MCP_DIR" >&2
    exit 2
  fi
fi

# name<TAB>md5 pour chaque bloc registerTool("name", …) — le bloc court
# jusqu'au registerTool suivant (ou la fin du fichier) et couvre donc le
# schéma, les annotations, la description ET le handler. Les lignes de
# commentaires sont exclues du hash : les dividers de section (« // ----- »)
# suivent le `);` de l'outil précédent et changeraient son hash à chaque
# insertion de section (faux positif constaté sur `search`). Espaces
# normalisés pour tolérer les différences de formatage de tsc.
extract_tool_hashes() {
  perl -0777 -MDigest::MD5=md5_hex -ne '
    while (/registerTool\(\s*["\x27]([^"\x27]+)["\x27](.*?)(?=registerTool\(|\z)/gs) {
      my ($name, $body) = ($1, $2);
      $body =~ s{^\s*//[^\n]*$}{}gm;
      $body =~ s/\s+/ /g;
      print "$name\t", md5_hex($body), "\n";
    }
  ' "$1" | sort
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Téléchargement du tarball npm publié (keepsake-mcp@latest)…"
if ! (cd "$tmp" && npm pack keepsake-mcp --silent > /dev/null 2>"$tmp/npm-pack.err"); then
  echo "❌ npm pack keepsake-mcp a échoué (réseau ? registre ?) :" >&2
  cat "$tmp/npm-pack.err" >&2
  exit 2
fi

tarball=$(ls "$tmp"/keepsake-mcp-*.tgz)
tar -xzf "$tarball" -C "$tmp"
NPM_TOOLS_JS="$tmp/package/build/tools.js"

if [ ! -f "$NPM_TOOLS_JS" ]; then
  echo "❌ build/tools.js absent du tarball npm ($tarball)" >&2
  exit 2
fi

local_version=$(node -p "require('$MCP_DIR/package.json').version")
npm_version=$(node -p "require('$tmp/package/package.json').version")

extract_tool_hashes "$LOCAL_BUILD" > "$tmp/local-hashes.txt"
extract_tool_hashes "$NPM_TOOLS_JS" > "$tmp/npm-hashes.txt"

cut -f1 "$tmp/local-hashes.txt" > "$tmp/local-tools.txt"
cut -f1 "$tmp/npm-hashes.txt" > "$tmp/npm-tools.txt"

local_count=$(wc -l < "$tmp/local-tools.txt" | tr -d ' ')
npm_count=$(wc -l < "$tmp/npm-tools.txt" | tr -d ' ')

missing_on_npm=$(comm -23 "$tmp/local-tools.txt" "$tmp/npm-tools.txt")
extra_on_npm=$(comm -13 "$tmp/local-tools.txt" "$tmp/npm-tools.txt")
# Outils présents des deux côtés mais dont le contenu compilé diffère
changed=$(join -t "$(printf '\t')" -j 1 "$tmp/local-hashes.txt" "$tmp/npm-hashes.txt" \
  | awk -F '\t' '$2 != $3 { print $1 }')

echo ""
echo "Local  : version $local_version — $local_count outils (build/tools.js)"
echo "npm    : version $npm_version — $npm_count outils (tarball publié)"
echo ""

if [ -z "$missing_on_npm" ] && [ -z "$extra_on_npm" ] && [ -z "$changed" ]; then
  echo "✅ npm aligné — les $npm_count outils publiés correspondent au code local (liste ET contenu)"
  exit 0
fi

echo "❌ npm DÉSALIGNÉ — publier keepsake-mcp AVANT de pousser main"
if [ -n "$missing_on_npm" ]; then
  echo ""
  echo "Outils présents en local mais ABSENTS du paquet npm :"
  echo "$missing_on_npm" | sed 's/^/  - /'
fi
if [ -n "$extra_on_npm" ]; then
  echo ""
  echo "Outils présents sur npm mais absents du code local (supprimés ?) :"
  echo "$extra_on_npm" | sed 's/^/  - /'
fi
if [ -n "$changed" ]; then
  echo ""
  echo "Outils au même nom mais au contenu MODIFIÉ (schéma, description ou handler) :"
  echo "$changed" | sed 's/^/  - /'
fi
if [ "$local_version" = "$npm_version" ]; then
  echo ""
  echo "⚠️  Les versions sont identiques ($local_version) : penser à INCRÉMENTER la"
  echo "   version (package.json, server.json, manifest.json) avant npm publish."
fi
exit 1
